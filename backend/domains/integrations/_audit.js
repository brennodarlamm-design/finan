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
