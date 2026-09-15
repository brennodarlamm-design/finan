// api/audit.js — Multiplexador da auditoria e do cofre DEV sem criar função Vercel extra.
// O plano Hobby limita o deployment a 12 Serverless Functions; helpers com prefixo _ ficam internos.
import auditHandler from './_audit-route.js';
import devTenantKeysHandler from './_dev-tenant-keys.js';

export default async function handler(req, res) {
  const rawAction = String(req.query?.action || req.body?.action || '').trim().toLowerCase();
  const prefix = 'dev_tenant_keys_';

  if (rawAction.startsWith(prefix)) {
    const vaultAction = rawAction.slice(prefix.length);
    if (!['list', 'reveal', 'rotate'].includes(vaultAction)) {
      return res.status(400).json({ success: false, error: 'Ação inválida.' });
    }

    req.query = { ...(req.query || {}), action: vaultAction };
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      req.body = { ...req.body, action: vaultAction };
    }
    return devTenantKeysHandler(req, res);
  }

  return auditHandler(req, res);
}
