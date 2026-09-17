// PATCH 51 — lista mínima de usuários ativos para atribuição de etapas/RT interno.
// Multiplexado por /api/audit?action=workflow_users; não cria Serverless Function extra.
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { canAccessModule, permissionError } from './_permissions.js';
import { createTenantSql } from './_tenant-sql.js';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

export default async function workflowUsersHandler(req, res) {
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ success:false, error:auth.error || 'Acesso não autorizado.' });
  }
  if (req.method !== 'GET') return res.status(405).json({ success:false, error:'Método não permitido.' });
  if (!canAccessModule(auth, 'obras', 'read')) {
    return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN', 'obras'));
  }

  try {
    const baseSql = getSql();
    const sql = createTenantSql(baseSql, { tenantId: auth.tenantId, isSystem: auth.isSystem === true });
    const rows = await sql`
      SELECT id, nome, perfil
      FROM usuarios
      WHERE tenant_id=${auth.tenantId} AND ativo=TRUE
      ORDER BY nome ASC;
    `;
    return res.status(200).json({
      success:true,
      users:rows.map(row => ({ id:row.id, nome:row.nome || '', perfil:row.perfil || '' }))
    });
  } catch (err) {
    console.error('[Patch51 Workflow users]', err);
    return res.status(500).json({ success:false, code:'WORKFLOW_USERS_ERROR', error:'Não foi possível carregar os responsáveis agora.' });
  }
}
