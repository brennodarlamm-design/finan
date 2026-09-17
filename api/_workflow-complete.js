// PATCH 51 — conclusão atômica de etapa sem stored procedure.
// Fica atrás de /api/audit?action=workflow_complete para não criar função Vercel extra.
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { canAccessModule, canWriteData, normalizeRole, permissionError } from './_permissions.js';
import { writeAudit } from './_audit.js';
import { createTenantSql } from './_tenant-sql.js';

const clean = (v, max=80) => String(v ?? '').trim().replace(/[^A-Za-z0-9_.:@-]/g, '').slice(0,max);
const isManager = auth => ['superadmin','admin','gestor'].includes(normalizeRole(auth?.user?.perfil));
const actorId = auth => clean(auth?.user?.userId || auth?.user?.id, 64);

function sqlClient() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

async function updateForecast(sql, tenantId, obraId) {
  const rows = await sql`
    SELECT o.data_inicio, COALESCE(SUM(w.dias_sla),0)::int AS total_dias
    FROM obras o
    LEFT JOIN workflow_etapas w ON w.tenant_id=o.tenant_id AND w.obra_id=o.id
    WHERE o.tenant_id=${tenantId} AND o.id=${obraId}
    GROUP BY o.data_inicio
  `;
  const base = rows[0];
  const total = Number(base?.total_dias || 0);
  if (!base?.data_inicio) return { total_dias:total, data_previsao:null };
  const updated = await sql`
    UPDATE obras
    SET data_previsao=(${base.data_inicio}::date + ${total}::int)
    WHERE tenant_id=${tenantId} AND id=${obraId}
    RETURNING data_previsao
  `;
  return { total_dias:total, data_previsao:updated[0]?.data_previsao || null };
}

export default async function workflowCompleteHandler(req, res) {
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success:false, error:auth.error || 'Acesso não autorizado.' });
  if (!canWriteData(auth) || !canAccessModule(auth,'obras','write')) {
    return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN','obras'));
  }
  if (req.method !== 'POST') return res.status(405).json({ success:false, error:'Método não permitido.' });

  const tenantId = auth.tenantId;
  const obraId = clean(req.body?.obraId || req.body?.obra_id, 64);
  const etapaId = clean(req.body?.etapaId || req.body?.etapa_id, 80);
  const uid = actorId(auth);
  if (!obraId || !etapaId || !uid) return res.status(400).json({ success:false, code:'WORKFLOW_INVALID_INPUT', error:'Obra, etapa e usuário são obrigatórios.' });

  const baseSql = sqlClient();
  const sql = createTenantSql(baseSql, { tenantId, isSystem: auth.isSystem === true });
  try {
    const beforeRows = await sql`
      SELECT * FROM workflow_etapas
      WHERE tenant_id=${tenantId} AND obra_id=${obraId} AND etapa_id=${etapaId}
      LIMIT 1
    `;
    if (!beforeRows.length) return res.status(404).json({ success:false, code:'WORKFLOW_STAGE_NOT_FOUND', error:'Etapa não encontrada.' });
    const before = beforeRows[0];

    if (before.status === 'concluido') {
      const nextRows = await sql`
        SELECT * FROM workflow_etapas
        WHERE tenant_id=${tenantId} AND obra_id=${obraId} AND ordem>${before.ordem}
        ORDER BY ordem ASC LIMIT 1
      `;
      const forecast = await updateForecast(sql, tenantId, obraId);
      return res.status(200).json({ success:true, result:{ already_completed:true, completed_stage:etapaId, next_stage:nextRows[0] || null }, ...forecast });
    }
    if (before.status !== 'em_andamento') return res.status(409).json({ success:false, code:'WORKFLOW_STAGE_NOT_ACTIVE', error:'Somente a etapa em andamento pode ser concluída.' });
    if (!before.responsavel_user_id) return res.status(409).json({ success:false, code:'WORKFLOW_STAGE_UNASSIGNED', error:'Defina um responsável antes de concluir esta etapa.' });
    if (String(before.responsavel_user_id) !== uid && !isManager(auth)) {
      return res.status(403).json({ success:false, code:'WORKFLOW_NOT_ASSIGNED', error:'Esta etapa está atribuída a outro usuário.' });
    }

    // Um único statement PostgreSQL fecha a etapa, seleciona/trava a próxima,
    // transfere a responsabilidade e grava os dois eventos de histórico.
    const rows = await sql`
      WITH current_stage AS (
        UPDATE workflow_etapas
        SET status='concluido', completed_at=NOW(), completed_by=${uid}, updated_at=NOW()
        WHERE tenant_id=${tenantId}
          AND obra_id=${obraId}
          AND etapa_id=${etapaId}
          AND status='em_andamento'
          AND responsavel_user_id IS NOT NULL
        RETURNING *
      ),
      next_candidate AS MATERIALIZED (
        SELECT w.*
        FROM workflow_etapas w
        JOIN current_stage c ON TRUE
        WHERE w.tenant_id=${tenantId}
          AND w.obra_id=${obraId}
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
        SELECT tenant_id,obra_id,etapa_id,'concluida',${uid},responsavel_user_id,
               jsonb_build_object('ordem',ordem,'nome',nome)
        FROM current_stage
        RETURNING id
      ),
      history_next AS (
        INSERT INTO workflow_historico(tenant_id,obra_id,etapa_id,evento,actor_user_id,responsavel_user_id,detalhes)
        SELECT tenant_id,obra_id,etapa_id,
               CASE WHEN responsavel_user_id IS NULL THEN 'aguardando_responsavel' ELSE 'atribuida' END,
               ${uid},responsavel_user_id,jsonb_build_object('ordem',ordem,'nome',nome)
        FROM next_updated
        RETURNING id
      )
      SELECT
        (SELECT COUNT(*)::int FROM current_stage) AS completed_count,
        (SELECT to_jsonb(n) FROM next_updated n LIMIT 1) AS next_stage
    `;

    const resultRow = rows[0] || {};
    if (Number(resultRow.completed_count || 0) !== 1) {
      const latest = await sql`
        SELECT status FROM workflow_etapas
        WHERE tenant_id=${tenantId} AND obra_id=${obraId} AND etapa_id=${etapaId}
        LIMIT 1
      `;
      if (latest[0]?.status === 'concluido') {
        const nextRows = await sql`
          SELECT * FROM workflow_etapas
          WHERE tenant_id=${tenantId} AND obra_id=${obraId} AND ordem>${before.ordem}
          ORDER BY ordem ASC LIMIT 1
        `;
        const forecast = await updateForecast(sql, tenantId, obraId);
        return res.status(200).json({ success:true, result:{ already_completed:true, completed_stage:etapaId, next_stage:nextRows[0] || null }, ...forecast });
      }
      return res.status(409).json({ success:false, code:'WORKFLOW_CONCURRENT_CHANGE', error:'A etapa mudou enquanto era concluída. Atualize o workflow e tente novamente.' });
    }

    const forecast = await updateForecast(sql, tenantId, obraId);
    const result = { already_completed:false, completed_stage:etapaId, next_stage:resultRow.next_stage || null };
    await writeAudit(sql, req, auth, {
      acao:'concluir', entidade:'workflow_etapa', entidadeId:`${obraId}:${etapaId}`,
      antes:{ status:before.status, responsavel_user_id:before.responsavel_user_id },
      depois:{ status:'concluido', next_stage:result.next_stage?.etapa_id || null }
    });
    return res.status(200).json({ success:true, result, ...forecast });
  } catch (err) {
    console.error('[Patch51 Workflow complete]', err);
    if (/relation .* does not exist|column .* does not exist/i.test(String(err?.message || ''))) {
      return res.status(503).json({ success:false, code:'PATCH51_SCHEMA_NOT_READY', error:'A estrutura do Patch 51 ainda não foi aplicada neste ambiente.' });
    }
    return res.status(500).json({ success:false, code:'WORKFLOW_COMPLETE_ERROR', error:'Não foi possível concluir a etapa agora.' });
  }
}
