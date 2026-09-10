import crypto from 'crypto';

export function requestIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim().slice(0, 80);
  return String(req.headers['x-real-ip'] || req.socket?.remoteAddress || '').slice(0, 80);
}

export async function writeAudit(sql, req, auth, { acao, entidade, entidadeId = null, antes = null, depois = null }) {
  try {
    const id = 'aud_' + crypto.randomBytes(10).toString('hex');
    const userId = auth?.user?.userId || auth?.user?.id || null;
    const tenantId = auth?.tenantId || auth?.user?.tenantId || null;
    const ip = requestIp(req) || null;
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
    console.error('[Audit] Falha ao registrar evento:', err.message);
  }
}
