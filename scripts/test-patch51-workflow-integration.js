import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
let passed = 0;
let total = 0;

async function step(name, fn) {
  total += 1;
  try {
    await fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
    throw err;
  }
}

console.log('PATCH 51 — integração sintética do workflow');

await step('schema base + migration 028 carregam em PostgreSQL compatível', async () => {
  await db.exec(`
    CREATE TABLE tenants (
      id VARCHAR(64) PRIMARY KEY
    );
    CREATE TABLE usuarios (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      nome VARCHAR(255) NOT NULL,
      perfil VARCHAR(64) NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE obras (
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      id VARCHAR(64) NOT NULL,
      nome VARCHAR(255) NOT NULL,
      data_inicio DATE,
      data_previsao DATE,
      PRIMARY KEY (tenant_id,id)
    );
  `);
  await db.exec(fs.readFileSync('migrations/028_patch51_workflow_obras.sql', 'utf8'));
});

await step('dados de dois tenants permanecem isolados', async () => {
  await db.exec(`
    INSERT INTO tenants(id) VALUES ('tenant_alpha'),('tenant_beta');
    INSERT INTO usuarios(id,tenant_id,nome,perfil) VALUES
      ('usr_a1','tenant_alpha','Arquiteta Alpha','admin'),
      ('usr_a2','tenant_alpha','Engenheiro Alpha','gestor'),
      ('usr_b1','tenant_beta','Usuário Beta','admin');
    INSERT INTO obras(tenant_id,id,nome,data_inicio) VALUES
      ('tenant_alpha','obra_1','Residência Alpha','2026-09-01'),
      ('tenant_beta','obra_1','Residência Beta','2026-09-01');
  `);

  const beta = await db.query(`SELECT id,nome FROM usuarios WHERE tenant_id='tenant_beta' ORDER BY id`);
  assert.deepEqual(beta.rows.map(r => r.id), ['usr_b1']);
});

await step('workflow inicia com somente a primeira etapa ativa', async () => {
  await db.exec(`
    INSERT INTO workflow_etapas(
      tenant_id,obra_id,etapa_id,ordem,codigo,nome,dias_sla,status,
      responsavel_user_id,responsavel_nome,responsavel_perfil,started_at
    ) VALUES
      ('tenant_alpha','obra_1','etapa_1',0,'PROJ-01','Estudo Preliminar',10,'em_andamento','usr_a1','Arquiteta Alpha','admin',NOW()),
      ('tenant_alpha','obra_1','etapa_2',1,'PROJ-02','Anteprojeto',20,'pendente','usr_a2','Engenheiro Alpha','gestor',NULL),
      ('tenant_alpha','obra_1','etapa_3',2,'PROJ-03','Projeto Executivo',30,'pendente',NULL,NULL,NULL,NULL);

    INSERT INTO workflow_historico(tenant_id,obra_id,etapa_id,evento,actor_user_id,responsavel_user_id,detalhes)
    VALUES ('tenant_alpha','obra_1','etapa_1','atribuida','usr_a1','usr_a1','{"inicial":true}'::jsonb);
  `);

  const active = await db.query(`SELECT etapa_id,responsavel_user_id FROM workflow_etapas WHERE tenant_id='tenant_alpha' AND obra_id='obra_1' AND status='em_andamento'`);
  assert.equal(active.rows.length, 1);
  assert.equal(active.rows[0].etapa_id, 'etapa_1');
  assert.equal(active.rows[0].responsavel_user_id, 'usr_a1');
});

const completeStageSql = (etapaId, actorId) => `
  WITH current_stage AS (
    UPDATE workflow_etapas
    SET status='concluido', completed_at=NOW(), completed_by='${actorId}', updated_at=NOW()
    WHERE tenant_id='tenant_alpha'
      AND obra_id='obra_1'
      AND etapa_id='${etapaId}'
      AND status='em_andamento'
      AND responsavel_user_id IS NOT NULL
    RETURNING *
  ),
  next_candidate AS MATERIALIZED (
    SELECT w.*
    FROM workflow_etapas w
    JOIN current_stage c ON TRUE
    WHERE w.tenant_id='tenant_alpha'
      AND w.obra_id='obra_1'
      AND w.ordem>c.ordem
    ORDER BY w.ordem ASC
    LIMIT 1
    FOR UPDATE
  ),
  next_updated AS (
    UPDATE workflow_etapas w
    SET status=CASE WHEN n.responsavel_user_id IS NULL THEN 'bloqueado' ELSE 'em_andamento' END,
        started_at=CASE WHEN n.responsavel_user_id IS NULL THEN w.started_at ELSE COALESCE(w.started_at,NOW()) END,
        updated_at=NOW()
    FROM next_candidate n
    WHERE w.tenant_id=n.tenant_id AND w.obra_id=n.obra_id AND w.etapa_id=n.etapa_id
      AND w.status IN ('pendente','bloqueado')
    RETURNING w.*
  ),
  history_current AS (
    INSERT INTO workflow_historico(tenant_id,obra_id,etapa_id,evento,actor_user_id,responsavel_user_id,detalhes)
    SELECT tenant_id,obra_id,etapa_id,'concluida','${actorId}',responsavel_user_id,
           jsonb_build_object('ordem',ordem,'nome',nome)
    FROM current_stage
    RETURNING id
  ),
  history_next AS (
    INSERT INTO workflow_historico(tenant_id,obra_id,etapa_id,evento,actor_user_id,responsavel_user_id,detalhes)
    SELECT tenant_id,obra_id,etapa_id,
           CASE WHEN responsavel_user_id IS NULL THEN 'aguardando_responsavel' ELSE 'atribuida' END,
           '${actorId}',responsavel_user_id,jsonb_build_object('ordem',ordem,'nome',nome)
    FROM next_updated
    RETURNING id
  )
  SELECT
    (SELECT COUNT(*)::int FROM current_stage) AS completed_count,
    (SELECT etapa_id FROM next_updated LIMIT 1) AS next_stage_id,
    (SELECT status FROM next_updated LIMIT 1) AS next_stage_status;
`;

await step('marcar Pronto conclui a etapa e transfere automaticamente para o próximo responsável', async () => {
  const result = await db.query(completeStageSql('etapa_1','usr_a1'));
  assert.equal(Number(result.rows[0].completed_count), 1);
  assert.equal(result.rows[0].next_stage_id, 'etapa_2');
  assert.equal(result.rows[0].next_stage_status, 'em_andamento');

  const rows = await db.query(`SELECT etapa_id,status,responsavel_user_id,completed_by FROM workflow_etapas WHERE tenant_id='tenant_alpha' AND obra_id='obra_1' ORDER BY ordem`);
  assert.equal(rows.rows[0].status, 'concluido');
  assert.equal(rows.rows[0].completed_by, 'usr_a1');
  assert.equal(rows.rows[1].status, 'em_andamento');
  assert.equal(rows.rows[1].responsavel_user_id, 'usr_a2');
});

await step('duplo clique/repetição não conclui nem avança duas vezes', async () => {
  const before = await db.query(`SELECT COUNT(*)::int total FROM workflow_historico WHERE tenant_id='tenant_alpha' AND obra_id='obra_1'`);
  const retry = await db.query(completeStageSql('etapa_1','usr_a1'));
  const after = await db.query(`SELECT COUNT(*)::int total FROM workflow_historico WHERE tenant_id='tenant_alpha' AND obra_id='obra_1'`);
  assert.equal(Number(retry.rows[0].completed_count), 0);
  assert.equal(Number(after.rows[0].total), Number(before.rows[0].total));

  const active = await db.query(`SELECT etapa_id FROM workflow_etapas WHERE tenant_id='tenant_alpha' AND obra_id='obra_1' AND status='em_andamento'`);
  assert.deepEqual(active.rows.map(r => r.etapa_id), ['etapa_2']);
});

await step('próxima etapa sem responsável fica bloqueada e gera evento de espera', async () => {
  const result = await db.query(completeStageSql('etapa_2','usr_a2'));
  assert.equal(Number(result.rows[0].completed_count), 1);
  assert.equal(result.rows[0].next_stage_id, 'etapa_3');
  assert.equal(result.rows[0].next_stage_status, 'bloqueado');

  const history = await db.query(`SELECT evento FROM workflow_historico WHERE tenant_id='tenant_alpha' AND obra_id='obra_1' AND etapa_id='etapa_3' ORDER BY id DESC LIMIT 1`);
  assert.equal(history.rows[0].evento, 'aguardando_responsavel');
});

await step('retirar responsável bloqueia a etapa ativa e reatribuir retoma o andamento', async () => {
  await db.exec(`
    UPDATE workflow_etapas
    SET responsavel_user_id='usr_a2', responsavel_nome='Engenheiro Alpha', responsavel_perfil='gestor',
        status=CASE WHEN status='bloqueado' THEN 'em_andamento' ELSE status END,
        started_at=COALESCE(started_at,NOW()), updated_at=NOW()
    WHERE tenant_id='tenant_alpha' AND obra_id='obra_1' AND etapa_id='etapa_3';
  `);
  let row = await db.query(`SELECT status,responsavel_user_id FROM workflow_etapas WHERE tenant_id='tenant_alpha' AND obra_id='obra_1' AND etapa_id='etapa_3'`);
  assert.equal(row.rows[0].status, 'em_andamento');
  assert.equal(row.rows[0].responsavel_user_id, 'usr_a2');

  await db.exec(`
    UPDATE workflow_etapas
    SET responsavel_user_id=NULL, responsavel_nome=NULL, responsavel_perfil=NULL,
        status=CASE WHEN status='em_andamento' THEN 'bloqueado' ELSE status END, updated_at=NOW()
    WHERE tenant_id='tenant_alpha' AND obra_id='obra_1' AND etapa_id='etapa_3';
  `);
  row = await db.query(`SELECT status,responsavel_user_id FROM workflow_etapas WHERE tenant_id='tenant_alpha' AND obra_id='obra_1' AND etapa_id='etapa_3'`);
  assert.equal(row.rows[0].status, 'bloqueado');
  assert.equal(row.rows[0].responsavel_user_id, null);

  await db.exec(`
    UPDATE workflow_etapas
    SET responsavel_user_id='usr_a2', responsavel_nome='Engenheiro Alpha', responsavel_perfil='gestor',
        status=CASE WHEN status='bloqueado' THEN 'em_andamento' ELSE status END,
        started_at=COALESCE(started_at,NOW()), updated_at=NOW()
    WHERE tenant_id='tenant_alpha' AND obra_id='obra_1' AND etapa_id='etapa_3';
  `);
  row = await db.query(`SELECT status,responsavel_user_id FROM workflow_etapas WHERE tenant_id='tenant_alpha' AND obra_id='obra_1' AND etapa_id='etapa_3'`);
  assert.equal(row.rows[0].status, 'em_andamento');
  assert.equal(row.rows[0].responsavel_user_id, 'usr_a2');
});

await step('fila Minhas Etapas retorna somente etapa ativa do usuário autenticado', async () => {
  const mine = await db.query(`
    SELECT w.etapa_id,o.nome obra_nome
    FROM workflow_etapas w
    JOIN obras o ON o.tenant_id=w.tenant_id AND o.id=w.obra_id
    WHERE w.tenant_id='tenant_alpha' AND w.responsavel_user_id='usr_a2' AND w.status='em_andamento'
    ORDER BY w.ordem;
  `);
  assert.deepEqual(mine.rows.map(r => r.etapa_id), ['etapa_3']);

  const otherTenant = await db.query(`SELECT etapa_id FROM workflow_etapas WHERE tenant_id='tenant_beta' AND responsavel_user_id='usr_a2'`);
  assert.equal(otherTenant.rows.length, 0);
});

await step('soma de SLA determina previsão automática da obra', async () => {
  const sum = await db.query(`SELECT COALESCE(SUM(dias_sla),0)::int total FROM workflow_etapas WHERE tenant_id='tenant_alpha' AND obra_id='obra_1'`);
  assert.equal(Number(sum.rows[0].total), 60);

  await db.query(`
    UPDATE obras o
    SET data_previsao=(o.data_inicio + x.total_dias::int)
    FROM (
      SELECT tenant_id,obra_id,COALESCE(SUM(dias_sla),0)::int total_dias
      FROM workflow_etapas
      WHERE tenant_id='tenant_alpha' AND obra_id='obra_1'
      GROUP BY tenant_id,obra_id
    ) x
    WHERE o.tenant_id=x.tenant_id AND o.id=x.obra_id;
  `);
  const obra = await db.query(`SELECT data_previsao::text FROM obras WHERE tenant_id='tenant_alpha' AND id='obra_1'`);
  assert.equal(obra.rows[0].data_previsao, '2026-10-31');
});

console.log(`\n✅ Patch 51 workflow integration: ${passed}/${total} cenários passaram.`);
await db.close();
