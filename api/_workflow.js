// PATCH 51 — Workflow de obras sem criar uma nova Serverless Function.
// Multiplexado por /api/audit?action=workflow_* para respeitar o limite de funções do Vercel.
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { canAccessModule, canWriteData, permissionError, normalizeRole } from './_permissions.js';
import { writeAudit } from './_audit.js';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

const cleanText = (value, max = 255) => String(value ?? '').replace(/\0/g, '').trim().slice(0, max);
const cleanId = (value, max = 80) => cleanText(value, max).replace(/[^A-Za-z0-9_.:@-]/g, '');
const cleanDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null;
const isManager = auth => ['superadmin','admin','gestor'].includes(normalizeRole(auth?.user?.perfil));
const actorId = auth => cleanId(auth?.user?.userId || auth?.user?.id, 64);

function sanitizePayload(input, maxKeys = 120) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(input).slice(0, maxKeys)) {
    const k = cleanText(key, 80).replace(/[^A-Za-z0-9_.-]/g, '');
    if (!k) continue;
    if (raw === null || typeof raw === 'boolean' || typeof raw === 'number') out[k] = raw;
    else if (typeof raw === 'string') out[k] = raw.slice(0, 4000);
  }
  return out;
}

function sanitizeStage(raw, order) {
  const id = cleanId(raw?.id || raw?.etapa_id, 80);
  if (!id) return null;
  return {
    etapa_id: id,
    ordem: Math.max(0, Math.min(999, Number.parseInt(raw?.ordem, 10) || order)),
    codigo: cleanText(raw?.codigo, 40),
    nome: cleanText(raw?.nome || `Etapa ${order + 1}`, 240),
    descricao: cleanText(raw?.descricao, 4000),
    tipo: cleanText(raw?.tipo, 40),
    tipo_label: cleanText(raw?.tipoLabel || raw?.tipo_label, 80),
    icone: cleanText(raw?.icone, 24),
    dias_sla: Math.max(1, Math.min(365, Number.parseInt(raw?.dias_sla, 10) || 30)),
    responsavel_user_id: cleanId(raw?.responsavel_user_id, 64) || null,
    responsavel_nome: cleanText(raw?.responsavel_nome, 255) || null,
    responsavel_perfil: cleanText(raw?.responsavel_perfil, 64) || null,
    observacoes: cleanText(raw?.observacoes, 4000),
    payload: sanitizePayload(raw?.payload)
  };
}

function sanitizeClauses(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 100).map((raw, index) => ({
    id: cleanId(raw?.id || `cl_${index + 1}`, 80) || `cl_${index + 1}`,
    secao: cleanText(raw?.secao, 120),
    numero: cleanText(raw?.numero || `CLÁUSULA ${index + 1}`, 80),
    titulo: cleanText(raw?.titulo, 300),
    texto: cleanText(raw?.texto, 12000)
  })).filter(c => c.titulo || c.texto);
}

async function ensureObra(sql, tenantId, obraId) {
  const id = cleanId(obraId, 64);
  if (!id) return null;
  const rows = await sql`SELECT id, nome, data_inicio FROM obras WHERE tenant_id=${tenantId} AND id=${id} LIMIT 1;`;
  return rows[0] || null;
}

async function validTenantUser(sql, tenantId, userId) {
  if (!userId) return null;
  const id = cleanId(userId, 64);
  const rows = await sql`
    SELECT id, nome, perfil, ativo
    FROM usuarios
    WHERE tenant_id=${tenantId} AND id=${id} AND ativo=TRUE
    LIMIT 1;
  `;
  return rows[0] || null;
}

async function updateForecast(sql, tenantId, obraId) {
  const rows = await sql`
    SELECT o.data_inicio, COALESCE(SUM(w.dias_sla),0)::int AS total_dias
    FROM obras o
    LEFT JOIN workflow_etapas w
      ON w.tenant_id=o.tenant_id AND w.obra_id=o.id
    WHERE o.tenant_id=${tenantId} AND o.id=${obraId}
    GROUP BY o.data_inicio;
  `;
  const base = rows[0];
  if (!base?.data_inicio) return { total_dias:Number(base?.total_dias || 0), data_previsao:null };
  const total = Number(base.total_dias || 0);
  const updated = await sql`
    UPDATE obras
    SET data_previsao = (${base.data_inicio}::date + ${total}::int)
    WHERE tenant_id=${tenantId} AND id=${obraId}
    RETURNING data_previsao;
  `;
  return { total_dias:total, data_previsao:updated[0]?.data_previsao || null };
}

function schemaNotReady(err) {
  const message = String(err?.message || '');
  return /relation .* does not exist|function finobra_complete_workflow_stage|column .* does not exist/i.test(message);
}

export default async function workflowHandler(req, res) {
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ success:false, error:auth.error || 'Acesso não autorizado.' });
  }

  if (!canAccessModule(auth, 'obras', 'read')) {
    return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN', 'obras'));
  }

  const tenantId = auth.tenantId;
  const sql = getSql();
  const action = cleanText(req.query?.action || req.body?.action, 80).toLowerCase();
  const body = req.body || {};

  try {
    if (req.method === 'GET' && action === 'meta_list') {
      const rows = await sql`
        SELECT *
        FROM obra_cadastro_geral
        WHERE tenant_id=${tenantId}
        ORDER BY updated_at DESC;
      `;
      return res.status(200).json({ success:true, data:rows });
    }

    if (req.method === 'GET' && action === 'list') {
      const obraId = cleanId(req.query?.obraId, 64);
      if (!obraId || !(await ensureObra(sql, tenantId, obraId))) {
        return res.status(404).json({ success:false, code:'OBRA_NOT_FOUND', error:'Obra não encontrada.' });
      }
      const [stages, history] = await Promise.all([
        sql`
          SELECT *
          FROM workflow_etapas
          WHERE tenant_id=${tenantId} AND obra_id=${obraId}
          ORDER BY ordem ASC;
        `,
        sql`
          SELECT *
          FROM workflow_historico
          WHERE tenant_id=${tenantId} AND obra_id=${obraId}
          ORDER BY created_at DESC
          LIMIT 200;
        `
      ]);
      return res.status(200).json({ success:true, stages, history });
    }

    if (req.method === 'GET' && action === 'my') {
      const uid = actorId(auth);
      const rows = await sql`
        SELECT w.*, o.nome AS obra_nome
        FROM workflow_etapas w
        JOIN obras o ON o.tenant_id=w.tenant_id AND o.id=w.obra_id
        WHERE w.tenant_id=${tenantId}
          AND w.responsavel_user_id=${uid}
          AND w.status IN ('em_andamento','bloqueado')
        ORDER BY
          CASE WHEN w.status='em_andamento' THEN 0 ELSE 1 END,
          w.updated_at ASC,
          w.ordem ASC;
      `;
      return res.status(200).json({ success:true, tasks:rows });
    }

    if (req.method === 'GET' && action === 'settings') {
      const rows = await sql`
        SELECT *
        FROM tenant_patch51_settings
        WHERE tenant_id=${tenantId}
        LIMIT 1;
      `;
      return res.status(200).json({
        success:true,
        settings:rows[0] || {
          tenant_id:tenantId, cub_modo:'fixo', cub_valor:0,
          cub_referencia:null, cub_uf:null, contract_clauses:[]
        }
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success:false, error:'Método não permitido.' });
    }
    if (!canWriteData(auth) || !canAccessModule(auth, 'obras', 'write')) {
      return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN', 'obras'));
    }

    if (action === 'meta_save') {
      const obraId = cleanId(body.obraId || body.obra_id, 64);
      const obra = await ensureObra(sql, tenantId, obraId);
      if (!obra) return res.status(404).json({ success:false, code:'OBRA_NOT_FOUND', error:'Obra não encontrada.' });

      const meta = body.meta && typeof body.meta === 'object' ? body.meta : body;
      const rtTipo = ['interno','externo'].includes(String(meta.responsavel_tecnico_tipo)) ? String(meta.responsavel_tecnico_tipo) : 'externo';
      let rtUser = null;
      if (rtTipo === 'interno') {
        rtUser = await validTenantUser(sql, tenantId, meta.responsavel_tecnico_usuario_id);
        if (!rtUser) return res.status(400).json({ success:false, code:'INVALID_INTERNAL_RT', error:'Selecione um responsável técnico interno ativo desta empresa.' });
      }

      const payload = sanitizePayload(meta.payload || {});
      const payloadJson = JSON.stringify(payload);
      const saved = await sql`
        INSERT INTO obra_cadastro_geral (
          tenant_id, obra_id, rg, orgao_expedidor, data_nascimento,
          responsavel_tecnico_tipo, responsavel_tecnico_usuario_id,
          responsavel_tecnico_nome, responsavel_tecnico_registro,
          subtitulo_capa, payload, updated_at
        ) VALUES (
          ${tenantId}, ${obraId}, ${cleanText(meta.rg,64) || null},
          ${cleanText(meta.orgao_expedidor,64) || null}, ${cleanDate(meta.data_nascimento)},
          ${rtTipo}, ${rtUser?.id || null},
          ${rtTipo === 'interno' ? rtUser?.nome : cleanText(meta.responsavel_tecnico_nome,255) || null},
          ${cleanText(meta.responsavel_tecnico_registro,120) || null},
          ${cleanText(meta.subtitulo_capa,255) || null}, ${payloadJson}::jsonb, NOW()
        )
        ON CONFLICT (tenant_id, obra_id) DO UPDATE SET
          rg=EXCLUDED.rg,
          orgao_expedidor=EXCLUDED.orgao_expedidor,
          data_nascimento=EXCLUDED.data_nascimento,
          responsavel_tecnico_tipo=EXCLUDED.responsavel_tecnico_tipo,
          responsavel_tecnico_usuario_id=EXCLUDED.responsavel_tecnico_usuario_id,
          responsavel_tecnico_nome=EXCLUDED.responsavel_tecnico_nome,
          responsavel_tecnico_registro=EXCLUDED.responsavel_tecnico_registro,
          subtitulo_capa=EXCLUDED.subtitulo_capa,
          payload=EXCLUDED.payload,
          updated_at=NOW()
        RETURNING *;
      `;
      await writeAudit(sql, req, auth, {
        acao:'salvar', entidade:'obra_cadastro_geral', entidadeId:obraId,
        depois:{ rg:!!saved[0]?.rg, responsavel_tecnico_tipo:rtTipo, subtitulo_capa:saved[0]?.subtitulo_capa || '' }
      });
      return res.status(200).json({ success:true, meta:saved[0] });
    }

    if (action === 'initialize') {
      const obraId = cleanId(body.obraId || body.obra_id, 64);
      const obra = await ensureObra(sql, tenantId, obraId);
      if (!obra) return res.status(404).json({ success:false, code:'OBRA_NOT_FOUND', error:'Obra ainda não foi confirmada na nuvem. Tente novamente em instantes.' });

      const existing = await sql`
        SELECT *
        FROM workflow_etapas
        WHERE tenant_id=${tenantId} AND obra_id=${obraId}
        ORDER BY ordem ASC;
      `;
      if (existing.length) {
        const forecast = await updateForecast(sql, tenantId, obraId);
        return res.status(200).json({ success:true, alreadyInitialized:true, stages:existing, ...forecast });
      }

      const inputStages = Array.isArray(body.stages) ? body.stages : [];
      const stages = inputStages.slice(0, 100).map((x,i) => sanitizeStage(x,i)).filter(Boolean);
      if (!stages.length) return res.status(400).json({ success:false, code:'WORKFLOW_EMPTY', error:'O workflow precisa de pelo menos uma etapa.' });

      // Normaliza ordem sequencial para garantir uma única próxima etapa.
      for (let i = 0; i < stages.length; i++) stages[i].ordem = i;

      const userIds = [...new Set(stages.map(s => s.responsavel_user_id).filter(Boolean))];
      const users = userIds.length ? await sql`
        SELECT id, nome, perfil
        FROM usuarios
        WHERE tenant_id=${tenantId} AND ativo=TRUE AND id = ANY(${userIds});
      ` : [];
      const userMap = new Map(users.map(u => [String(u.id), u]));
      for (const s of stages) {
        if (s.responsavel_user_id) {
          const u = userMap.get(String(s.responsavel_user_id));
          if (!u) return res.status(400).json({ success:false, code:'INVALID_WORKFLOW_USER', error:`Responsável inválido na etapa ${s.nome}.` });
          s.responsavel_nome = u.nome;
          s.responsavel_perfil = u.perfil;
        }
      }

      const stagesJson = JSON.stringify(stages);
      await sql`
        INSERT INTO workflow_etapas (
          tenant_id, obra_id, etapa_id, ordem, codigo, nome, descricao, tipo, tipo_label,
          icone, dias_sla, status, responsavel_user_id, responsavel_nome, responsavel_perfil,
          started_at, observacoes, payload
        )
        SELECT
          ${tenantId}, ${obraId}, x.etapa_id, x.ordem, x.codigo, x.nome, x.descricao,
          x.tipo, x.tipo_label, x.icone, x.dias_sla,
          CASE WHEN x.ordem=0 THEN 'em_andamento' ELSE 'pendente' END,
          x.responsavel_user_id, x.responsavel_nome, x.responsavel_perfil,
          CASE WHEN x.ordem=0 THEN NOW() ELSE NULL END,
          x.observacoes, x.payload
        FROM jsonb_to_recordset(${stagesJson}::jsonb) AS x(
          etapa_id VARCHAR(80), ordem INTEGER, codigo VARCHAR(40), nome VARCHAR(240),
          descricao TEXT, tipo VARCHAR(40), tipo_label VARCHAR(80), icone VARCHAR(24),
          dias_sla INTEGER, responsavel_user_id VARCHAR(64), responsavel_nome VARCHAR(255),
          responsavel_perfil VARCHAR(64), observacoes TEXT, payload JSONB
        )
        ON CONFLICT (tenant_id, obra_id, etapa_id) DO NOTHING;
      `;

      const first = stages[0];
      await sql`
        INSERT INTO workflow_historico (
          tenant_id, obra_id, etapa_id, evento, actor_user_id, responsavel_user_id, detalhes
        ) VALUES (
          ${tenantId}, ${obraId}, ${first.etapa_id}, 'atribuida', ${actorId(auth)},
          ${first.responsavel_user_id},
          ${JSON.stringify({ ordem:0, nome:first.nome, inicial:true })}::jsonb
        );
      `;
      const forecast = await updateForecast(sql, tenantId, obraId);
      const savedStages = await sql`
        SELECT * FROM workflow_etapas
        WHERE tenant_id=${tenantId} AND obra_id=${obraId}
        ORDER BY ordem ASC;
      `;
      await writeAudit(sql, req, auth, {
        acao:'criar', entidade:'workflow_obra', entidadeId:obraId,
        depois:{ etapas:savedStages.length, total_dias:forecast.total_dias }
      });
      return res.status(201).json({ success:true, stages:savedStages, ...forecast });
    }

    if (action === 'complete') {
      const obraId = cleanId(body.obraId || body.obra_id, 64);
      const etapaId = cleanId(body.etapaId || body.etapa_id, 80);
      const rows = await sql`
        SELECT *
        FROM workflow_etapas
        WHERE tenant_id=${tenantId} AND obra_id=${obraId} AND etapa_id=${etapaId}
        LIMIT 1;
      `;
      if (!rows.length) return res.status(404).json({ success:false, code:'WORKFLOW_STAGE_NOT_FOUND', error:'Etapa não encontrada.' });
      const stage = rows[0];
      const uid = actorId(auth);
      if (stage.responsavel_user_id && String(stage.responsavel_user_id) !== uid && !isManager(auth)) {
        return res.status(403).json({ success:false, code:'WORKFLOW_NOT_ASSIGNED', error:'Esta etapa está atribuída a outro usuário.' });
      }

      const resultRows = await sql`
        SELECT finobra_complete_workflow_stage(${tenantId}, ${obraId}, ${etapaId}, ${uid}) AS result;
      `;
      const forecast = await updateForecast(sql, tenantId, obraId);
      const result = resultRows[0]?.result || {};
      await writeAudit(sql, req, auth, {
        acao:'concluir', entidade:'workflow_etapa', entidadeId:`${obraId}:${etapaId}`,
        antes:{ status:stage.status, responsavel_user_id:stage.responsavel_user_id || null },
        depois:{ status:'concluido', next_stage:result?.next_stage?.etapa_id || null }
      });
      return res.status(200).json({ success:true, result, ...forecast });
    }

    if (action === 'stage_update') {
      if (!isManager(auth)) return res.status(403).json({ success:false, code:'WORKFLOW_MANAGER_REQUIRED', error:'Somente administrador ou gestor pode ajustar SLA e responsável.' });
      const obraId = cleanId(body.obraId || body.obra_id, 64);
      const etapaId = cleanId(body.etapaId || body.etapa_id, 80);
      const currentRows = await sql`
        SELECT * FROM workflow_etapas
        WHERE tenant_id=${tenantId} AND obra_id=${obraId} AND etapa_id=${etapaId}
        LIMIT 1;
      `;
      if (!currentRows.length) return res.status(404).json({ success:false, code:'WORKFLOW_STAGE_NOT_FOUND', error:'Etapa não encontrada.' });
      const current = currentRows[0];
      const nextDays = body.dias_sla === undefined ? Number(current.dias_sla) : Number.parseInt(body.dias_sla,10);
      if (!Number.isFinite(nextDays) || nextDays < Number(current.dias_sla)) {
        return res.status(409).json({ success:false, code:'SLA_DECREASE_NOT_ALLOWED', error:'O SLA pode ser mantido ou aumentado, nunca reduzido.' });
      }
      let nextUser = null;
      const hasUserPatch = Object.prototype.hasOwnProperty.call(body, 'responsavel_user_id');
      if (hasUserPatch && body.responsavel_user_id) {
        nextUser = await validTenantUser(sql, tenantId, body.responsavel_user_id);
        if (!nextUser) return res.status(400).json({ success:false, code:'INVALID_WORKFLOW_USER', error:'Responsável selecionado não pertence à empresa ou está inativo.' });
      }

      const updated = await sql`
        UPDATE workflow_etapas
        SET dias_sla=${Math.min(365,nextDays)},
            responsavel_user_id=${hasUserPatch ? (nextUser?.id || null) : current.responsavel_user_id},
            responsavel_nome=${hasUserPatch ? (nextUser?.nome || null) : current.responsavel_nome},
            responsavel_perfil=${hasUserPatch ? (nextUser?.perfil || null) : current.responsavel_perfil},
            observacoes=${body.observacoes === undefined ? current.observacoes : cleanText(body.observacoes,4000)},
            updated_at=NOW()
        WHERE tenant_id=${tenantId} AND obra_id=${obraId} AND etapa_id=${etapaId}
        RETURNING *;
      `;
      await sql`
        INSERT INTO workflow_historico (
          tenant_id, obra_id, etapa_id, evento, actor_user_id, responsavel_user_id, detalhes
        ) VALUES (
          ${tenantId}, ${obraId}, ${etapaId}, 'ajustada', ${actorId(auth)},
          ${updated[0]?.responsavel_user_id || null},
          ${JSON.stringify({ dias_sla_anterior:Number(current.dias_sla), dias_sla_novo:Number(updated[0]?.dias_sla), responsavel_anterior:current.responsavel_user_id || null })}::jsonb
        );
      `;
      const forecast = await updateForecast(sql, tenantId, obraId);
      await writeAudit(sql, req, auth, {
        acao:'atualizar', entidade:'workflow_etapa', entidadeId:`${obraId}:${etapaId}`,
        antes:{ dias_sla:current.dias_sla, responsavel_user_id:current.responsavel_user_id || null },
        depois:{ dias_sla:updated[0]?.dias_sla, responsavel_user_id:updated[0]?.responsavel_user_id || null }
      });
      return res.status(200).json({ success:true, stage:updated[0], ...forecast });
    }

    if (action === 'settings_save') {
      if (!isManager(auth)) return res.status(403).json({ success:false, code:'WORKFLOW_MANAGER_REQUIRED', error:'Somente administrador ou gestor pode alterar CUB e cláusulas gerais.' });
      const currentRows = await sql`SELECT * FROM tenant_patch51_settings WHERE tenant_id=${tenantId} LIMIT 1;`;
      const current = currentRows[0] || {};
      const mode = ['fixo','volante'].includes(String(body.cub_modo)) ? String(body.cub_modo) : (current.cub_modo || 'fixo');
      const cubRaw = body.cub_valor === undefined ? Number(current.cub_valor || 0) : Number(body.cub_valor);
      const cub = Number.isFinite(cubRaw) ? Math.max(0, Math.min(1000000, cubRaw)) : 0;
      const clauses = body.contract_clauses === undefined
        ? (Array.isArray(current.contract_clauses) ? current.contract_clauses : [])
        : sanitizeClauses(body.contract_clauses);
      const clausesJson = JSON.stringify(clauses);

      const saved = await sql`
        INSERT INTO tenant_patch51_settings (
          tenant_id, cub_modo, cub_valor, cub_referencia, cub_uf, contract_clauses, updated_at
        ) VALUES (
          ${tenantId}, ${mode}, ${cub}, ${cleanDate(body.cub_referencia) || current.cub_referencia || null},
          ${(cleanText(body.cub_uf || current.cub_uf,2).toUpperCase() || null)}, ${clausesJson}::jsonb, NOW()
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          cub_modo=EXCLUDED.cub_modo,
          cub_valor=EXCLUDED.cub_valor,
          cub_referencia=EXCLUDED.cub_referencia,
          cub_uf=EXCLUDED.cub_uf,
          contract_clauses=EXCLUDED.contract_clauses,
          updated_at=NOW()
        RETURNING *;
      `;

      const oldClauses = JSON.stringify(Array.isArray(current.contract_clauses) ? current.contract_clauses : []);
      if (body.contract_clauses !== undefined && clausesJson !== oldClauses) {
        const versions = await sql`
          SELECT COALESCE(MAX(versao),0)::int + 1 AS next_version
          FROM contract_clause_versions
          WHERE tenant_id=${tenantId};
        `;
        const version = Number(versions[0]?.next_version || 1);
        await sql`
          INSERT INTO contract_clause_versions (tenant_id, versao, clauses, created_by)
          VALUES (${tenantId}, ${version}, ${clausesJson}::jsonb, ${actorId(auth)});
        `;
      }

      await writeAudit(sql, req, auth, {
        acao:'atualizar', entidade:'patch51_settings', entidadeId:tenantId,
        antes:{ cub_modo:current.cub_modo || null, cub_valor:Number(current.cub_valor || 0) },
        depois:{ cub_modo:mode, cub_valor:cub, clausulas:clauses.length }
      });
      return res.status(200).json({ success:true, settings:saved[0] });
    }

    return res.status(400).json({ success:false, code:'WORKFLOW_ACTION_INVALID', error:'Ação de workflow inválida.' });
  } catch (err) {
    console.error('[Patch51 Workflow]', action, err);
    if (/SLA_DECREASE_NOT_ALLOWED/i.test(String(err?.message || ''))) {
      return res.status(409).json({ success:false, code:'SLA_DECREASE_NOT_ALLOWED', error:'O SLA pode ser mantido ou aumentado, nunca reduzido.' });
    }
    if (/WORKFLOW_STAGE_NOT_ACTIVE/i.test(String(err?.message || ''))) {
      return res.status(409).json({ success:false, code:'WORKFLOW_STAGE_NOT_ACTIVE', error:'A etapa não está ativa para conclusão.' });
    }
    if (schemaNotReady(err)) {
      return res.status(503).json({ success:false, code:'PATCH51_SCHEMA_NOT_READY', error:'A estrutura do Patch 51 ainda não foi aplicada neste ambiente.' });
    }
    return res.status(500).json({ success:false, code:'WORKFLOW_INTERNAL_ERROR', error:'Não foi possível processar o workflow agora.' });
  }
}
