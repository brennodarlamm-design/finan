import crypto from 'crypto';
import { getTrustedClientIp, recordIpFailure } from './_security-ip.js';

export function requestIp(req) {
  return String(getTrustedClientIp(req) || '').slice(0, 80);
}

function securityFailureFromAudit(acao, depois) {
  const action = String(acao || '').trim();
  const reason = String(depois?.motivo || '').trim();

  if (action === 'mfa_invalido') {
    return { reason: 'mfa_invalid', weight: 2, source: 'audit:mfa' };
  }

  if (action === 'login_bloqueado' && reason === 'invalid_password') {
    return { reason: 'invalid_password', weight: 1, source: 'audit:login' };
  }

  return null;
}

export async function writeAudit(sql, req, auth, { acao, entidade, entidadeId = null, antes = null, depois = null }) {
  const ip = requestIp(req) || null;
  const userId = auth?.user?.userId || auth?.user?.id || null;
  const tenantId = auth?.tenantId || auth?.user?.tenantId || null;

  try {
    const id = 'aud_' + crypto.randomBytes(10).toString('hex');
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 1000) || null;
    await sql`
      INSERT INTO audit_logs (id, tenant_id, user_id, acao, entidade, entidade_id, dados_anteriores, dados_novos, ip, user_agent)
      VALUES (
        ${id}, ${tenantId}, ${userId}, ${acao}, ${entidade}, ${entidadeId},
        ${antes ? JSON.stringify(antes) : null}::jsonb,
        ${depois ? JSON.stringify(depois) : null}::jsonb,
        ${ip}, ${userAgent}
      );
    `;
  } catch (err) {
    // Auditoria não deve derrubar a operação principal, mas deve aparecer nos logs.
    console.error('[Audit] Falha ao registrar log de auditoria:', err.message);
  }

  // Patch 56: somente falhas autenticamente hostis aumentam score.
  // Executado de forma resiliente mesmo que a inserção de log falhe.
  try {
    const securityFailure = securityFailureFromAudit(acao, depois);
    if (securityFailure && ip) {
      await recordIpFailure(sql, ip, {
        ...securityFailure,
        metadata: {
          acao,
          entidade,
          entidadeId,
          tenantId: tenantId || null,
          userId: userId || null
        }
      });
    }
  } catch (secErr) {
    console.error('[Audit] Falha ao registrar evento Fail2Ban:', secErr.message);
  }
}

/**
 * AUDITORIA 2026-10-04 #14: registra vários (entidade, id) num único INSERT — usado pelo
 * "Sincronizar tudo" para o delta das outras telas enxergar os registros alterados.
 * Recebe Map<entidade, Set<id>>. Falha de auditoria não derruba a sincronização.
 */
export async function writeAuditBatch(sql, req, auth, acao, tocados, { lote = 1000 } = {}) {
  const ents = [];
  const ids = [];
  for (const [entidade, conjunto] of tocados || []) {
    for (const id of conjunto || []) { ents.push(String(entidade).slice(0, 80)); ids.push(String(id).slice(0, 128)); }
  }
  if (!ids.length) return 0;
  const ip = requestIp(req) || null;
  const userId = auth?.user?.userId || auth?.user?.id || null;
  const tenantId = auth?.tenantId || auth?.user?.tenantId || null;
  const userAgent = String(req?.headers?.['user-agent'] || '').slice(0, 1000) || null;
  let gravados = 0;
  try {
    for (let i = 0; i < ids.length; i += lote) {
      const parteIds = ids.slice(i, i + lote);
      const parteEnts = ents.slice(i, i + lote);
      const audIds = parteIds.map(() => 'aud_' + crypto.randomBytes(10).toString('hex'));
      await sql`
        INSERT INTO audit_logs (id, tenant_id, user_id, acao, entidade, entidade_id, ip, user_agent)
        SELECT t.a, ${tenantId}, ${userId}, ${acao}, t.e, t.r, ${ip}, ${userAgent}
        FROM unnest(${audIds}::text[], ${parteEnts}::text[], ${parteIds}::text[]) AS t(a, e, r);
      `;
      gravados += parteIds.length;
    }
  } catch (err) {
    console.error('[Audit] Falha ao registrar lote de auditoria:', err.message);
  }
  return gravados;
}

/**
 * AUDITORIA 2026-10-04 #14: marca um registro alterado por rotinas internas (workflows) para o
 * delta dos outros aparelhos enxergar a mudança. Não derruba a operação se falhar.
 */
export async function marcarAlteracao(sql, tenantId, entidade, entidadeId, acao = 'atualizar_automatico') {
  if (!tenantId || !entidadeId) return;
  try {
    const id = 'aud_' + crypto.randomBytes(10).toString('hex');
    await sql`
      INSERT INTO audit_logs (id, tenant_id, acao, entidade, entidade_id)
      VALUES (${id}, ${tenantId}, ${acao}, ${String(entidade).slice(0, 80)}, ${String(entidadeId).slice(0, 128)});
    `;
  } catch (err) {
    console.error('[Audit] Falha ao marcar alteração:', err.message);
  }
}

