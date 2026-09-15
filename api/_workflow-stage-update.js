// PATCH 51 — ajuste transacional de SLA/responsável da etapa.
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { canAccessModule, canWriteData, permissionError, normalizeRole } from './_permissions.js';
import { writeAudit } from './_audit.js';

const sqlClient = () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
};
const text = (v, max=255) => String(v ?? '').replace(/\0/g, '').trim().slice(0, max);
const cleanId = (v, max=80) => text(v, max).replace(/[^A-Za-z0-9_.:@-]/g, '');
const manager = auth => ['superadmin','admin','gestor'].includes(normalizeRole(auth?.user?.perfil));
const actor = auth => cleanId(auth?.user?.userId || auth?.user?.id, 64);

async function forecast(sql, tenantId, obraId) {
  const rows = await sql`
    SELECT o.data_inicio, COALESCE(SUM(w.dias_sla),0)::int total_dias
    FROM obras o
    LEFT JOIN workflow_etapas w
      ON w.tenant_id=o.tenant_id AND w.obra_id=o.id
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

export default async function workflowStageUpdateHandler(req, res) {
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success:false, error:auth.error || 'Acesso não autorizado.' });
  if (req.method !== 'POST') return res.status(405).json({ success:false, error:'Método não permitido.' });
  if (!canWriteData(auth) || !canAccessModule(auth, 'obras', 'write')) return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN','obras'));
  if (!manager(auth)) return res.status(403).json({ success:false, code:'WORKFLOW_MANAGER_REQUIRED', error:'Somente administrador ou gestor pode ajustar SLA e responsável.' });

  const tenantId = auth.tenantId;
  const body = req.body || {};
  const obraId = cleanId(body.obraId || body.obra_id, 64);
  const etapaId = cleanId(body.etapaId || body.etapa_id, 80);
  if (!obraId || !etapaId) return res.status(400).json({ success:false, code:'WORKFLOW_STAGE_REQUIRED', error:'Obra e etapa são obrigatórias.' });

  const sql = sqlClient();
  try {
    const rows = await sql`
      SELECT * FROM workflow_etapas
      WHERE tenant_id=${tenantId} AND obra_id=${obraId} AND etapa_id=${etapaId}
      LIMIT 1
    `;
    if (!rows.length) return res.status(404).json({ success:false, code:'WORKFLOW_STAGE_NOT_FOUND', error:'Etapa não encontrada.' });
    const current = rows[0];
    if (current.status === 'concluido') return res.status(409).json({ success:false, code:'WORKFLOW_STAGE_COMPLETED', error:'Etapa concluída não pode ter SLA ou responsável alterado.' });

    const requestedDays = body.dias_sla === undefined ? Number(current.dias_sla) : Number.parseInt(body.dias_sla, 10);
    if (!Number.isFinite(requestedDays) || requestedDays < Number(current.dias_sla)) {
      return res.status(409).json({ success:false, code:'SLA_DECREASE_NOT_ALLOWED', error:'O SLA pode ser mantido ou aumentado, nunca reduzido.' });
    }
    const days = Math.min(365, requestedDays);

    const hasResponsible = Object.prototype.hasOwnProperty.call(body, 'responsavel_user_id');
    let responsible = null;
    if (hasResponsible && body.responsavel_user_id) {
      const userId = cleanId(body.responsavel_user_id, 64);
      const users = await sql`
        SELECT id,nome,perfil FROM usuarios
        WHERE tenant_id=${tenantId} AND id=${userId} AND ativo=TRUE
        LIMIT 1
      `;
      if (!users.length) return res.status(400).json({ success:false, code:'INVALID_WORKFLOW_USER', error:'Responsável inválido.' });
      responsible = users[0];
    }

    const responsibleId = hasResponsible ? (responsible?.id || null) : current.responsavel_user_id;
    const nextStatus = current.status === 'em_andamento' && !responsibleId
      ? 'bloqueado'
      : current.status === 'bloqueado' && responsibleId
        ? 'em_andamento'
        : current.status;
    const notes = body.observacoes === undefined ? current.observacoes : text(body.observacoes, 4000);

    const updated = await sql`
      UPDATE workflow_etapas
      SET dias_sla=${days},
          responsavel_user_id=${responsibleId},
          responsavel_nome=${hasResponsible ? (responsible?.nome || null) : current.responsavel_nome},
          responsavel_perfil=${hasResponsible ? (responsible?.perfil || null) : current.responsavel_perfil},
          status=${nextStatus},
          started_at=CASE WHEN ${nextStatus}='em_andamento' THEN COALESCE(started_at,NOW()) ELSE started_at END,
          observacoes=${notes},
          updated_at=NOW()
      WHERE tenant_id=${tenantId} AND obra_id=${obraId} AND etapa_id=${etapaId}
      RETURNING *
    `;

    const stage = updated[0];
    const details = JSON.stringify({
      dias_sla_anterior:Number(current.dias_sla),
      dias_sla_novo:Number(stage.dias_sla),
      responsavel_anterior:current.responsavel_user_id || null,
      responsavel_novo:stage.responsavel_user_id || null,
      status_anterior:current.status,
      status_novo:stage.status
    });
    await sql`
      INSERT INTO workflow_historico(tenant_id,obra_id,etapa_id,evento,actor_user_id,responsavel_user_id,detalhes)
      VALUES(${tenantId},${obraId},${etapaId},'ajustada',${actor(auth)},${stage.responsavel_user_id || null},${details}::jsonb)
    `;

    const dates = await forecast(sql, tenantId, obraId);
    await writeAudit(sql, req, auth, {
      acao:'ajustar',
      entidade:'workflow_etapa',
      entidadeId:`${obraId}:${etapaId}`,
      antes:{ dias_sla:Number(current.dias_sla), responsavel_user_id:current.responsavel_user_id || null, status:current.status },
      depois:{ dias_sla:Number(stage.dias_sla), responsavel_user_id:stage.responsavel_user_id || null, status:stage.status }
    });
    return res.json({ success:true, stage, ...dates });
  } catch (err) {
    console.error('[Patch51 stage_update]', err);
    if (/relation .* does not exist|column .* does not exist/i.test(String(err?.message || ''))) {
      return res.status(503).json({ success:false, code:'PATCH51_SCHEMA_NOT_READY', error:'Patch 51 aguardando migration de banco.' });
    }
    return res.status(500).json({ success:false, error:'Erro interno ao ajustar a etapa.' });
  }
}
