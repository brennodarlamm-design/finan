// api/audit.js — Multiplexador da auditoria, cofre DEV e workflow sem criar funções Vercel extras.
// O plano Hobby limita o deployment a 12 Serverless Functions; helpers com prefixo _ ficam internos.
import auditHandler from './_audit-route.js';
import devTenantKeysHandler from './_dev-tenant-keys.js';
import workflowHandler from './_workflow.js';
import workflowCompleteHandler from './_workflow-complete.js';

export default async function handler(req, res) {
  const rawAction = String(req.query?.action || req.body?.action || '').trim().toLowerCase();
  // Mantém o contrato nominal do Patch 50 usado pelas suítes de regressão.
  const prefix = 'dev_tenant_keys_';
  const workflowPrefix = 'workflow_';

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

  if (rawAction.startsWith(workflowPrefix)) {
    const workflowAction = rawAction.slice(workflowPrefix.length);
    const allowed = new Set(['meta_list', 'meta_save', 'list', 'my', 'initialize', 'complete', 'stage_update', 'settings', 'settings_save']);
    if (!allowed.has(workflowAction)) {
      return res.status(400).json({ success:false, error:'Ação de workflow inválida.' });
    }

    req.query = { ...(req.query || {}), action: workflowAction };
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      req.body = { ...req.body, action: workflowAction };
    }
    if (workflowAction === 'complete') return workflowCompleteHandler(req, res);
    return workflowHandler(req, res);
  }

  return auditHandler(req, res);
}
