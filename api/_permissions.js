// api/_permissions.js — RBAC central + restrições por módulo do FinObra
// Perfis suportados: superadmin, admin, gestor, operador, visualizador.

export const ROLE_RULES = Object.freeze({
  superadmin: Object.freeze({ read: true, write: true, delete: true, manageUsers: true, manageTenant: true, audit: true }),
  admin: Object.freeze({ read: true, write: true, delete: true, manageUsers: true, manageTenant: true, audit: true }),
  gestor: Object.freeze({ read: true, write: true, delete: true, manageUsers: false, manageTenant: false, audit: false }),
  operador: Object.freeze({ read: true, write: true, delete: false, manageUsers: false, manageTenant: false, audit: false }),
  visualizador: Object.freeze({ read: true, write: false, delete: false, manageUsers: false, manageTenant: false, audit: false })
});

export const MODULES = Object.freeze([
  'dashboard','obras','financeiro','fornecedores','produtos','precompras','recibos','contratos',
  'notas','orcamentos','medicoes','documentos','relatorios','contas','whatsapp','assinatura','planos','configuracoes'
]);

export const TABLE_MODULES = Object.freeze({
  obras:'obras', clientes:'obras',
  lancamentos:'financeiro',
  fornecedores:'fornecedores', produtos:'produtos',
  precompras:'precompras', recibos:'recibos', contratos:'contratos',
  notas:'notas', notas_fiscais:'notas', ocr_historico:'notas',
  orcamentos:'orcamentos', orcamentos_sinapi:'orcamentos',
  medicoes:'medicoes',
  documentos:'documentos', documento_conteudo:'documentos', doc_fases:'documentos',
  contas:'contas', contas_bancarias:'contas',
  preferencias:'configuracoes'
});

export function normalizeRole(role) {
  const key = String(role || 'visualizador').trim().toLowerCase();
  return ROLE_RULES[key] ? key : 'visualizador';
}

export function roleRule(role) {
  return ROLE_RULES[normalizeRole(role)];
}

export function can(role, capability) {
  return Boolean(roleRule(role)?.[capability]);
}

export function sanitizePermissions(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const module of MODULES) {
    const raw = input[module];
    if (raw === undefined || raw === null) continue;
    if (typeof raw === 'boolean') {
      out[module] = { read: raw };
      continue;
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) continue;
    const clean = {};
    for (const action of ['read','write','delete']) {
      if (typeof raw[action] === 'boolean') clean[action] = raw[action];
    }
    if (Object.keys(clean).length) out[module] = clean;
  }
  return out;
}

function customPermission(auth, module, action) {
  const perms = auth?.user?.permissions || auth?.user?.permissoes || {};
  const raw = perms?.[module];
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'boolean') return action === 'read' ? raw : null;
  if (typeof raw !== 'object') return null;
  return typeof raw[action] === 'boolean' ? raw[action] : null;
}

// Permissões customizadas só podem RESTRINGIR o que o perfil já permite; nunca elevam privilégios.
export function canAccessModule(auth, module, action = 'read') {
  if (auth?.isSystem) return true;
  const role = normalizeRole(auth?.user?.perfil);
  if (role === 'superadmin' || role === 'admin') return true;
  const base = Boolean(roleRule(role)?.[action]);
  if (!base) return false;
  if (!MODULES.includes(module)) return base;

  // Hierarquia de segurança: sem leitura não existe escrita/exclusão;
  // sem escrita não existe exclusão. A permissão customizada nunca eleva o perfil.
  const readCustom = customPermission(auth, module, 'read');
  if (readCustom === false) return false;
  if (action === 'delete') {
    const writeCustom = customPermission(auth, module, 'write');
    if (writeCustom === false) return false;
  }
  const custom = customPermission(auth, module, action);
  return custom === null ? base : Boolean(custom) && base;
}

export function canAccessTable(auth, table, action = 'read') {
  const module = TABLE_MODULES[String(table || '').trim()] || null;
  return module ? canAccessModule(auth, module, action) : Boolean(roleRule(auth?.user?.perfil)?.[action] || auth?.isSystem);
}

export function canWriteData(auth) {
  return Boolean(auth?.isSystem || can(auth?.user?.perfil, 'write'));
}

export function canDeleteData(auth) {
  return Boolean(auth?.isSystem || can(auth?.user?.perfil, 'delete'));
}

export function canManageUsers(auth) {
  return Boolean(auth?.isSystem || can(auth?.user?.perfil, 'manageUsers'));
}

export function canManageTenant(auth) {
  return Boolean(auth?.isSystem || can(auth?.user?.perfil, 'manageTenant'));
}

export function canViewAudit(auth) {
  return Boolean(auth?.isSystem || can(auth?.user?.perfil, 'audit'));
}

export function permissionError(code = 'ROLE_FORBIDDEN', module = '') {
  const messages = {
    ROLE_READ_ONLY: 'Seu perfil é somente leitura e não pode alterar dados.',
    ROLE_DELETE_FORBIDDEN: 'Seu perfil não possui permissão para excluir registros.',
    ROLE_MANAGE_USERS_FORBIDDEN: 'Somente administradores podem gerenciar usuários.',
    ROLE_MANAGE_TENANT_FORBIDDEN: 'Somente administradores podem alterar os dados da empresa.',
    ROLE_AUDIT_FORBIDDEN: 'Somente administradores podem consultar a auditoria.',
    MODULE_READ_FORBIDDEN: 'Seu usuário não possui acesso a este módulo.',
    MODULE_WRITE_FORBIDDEN: 'Seu usuário não possui permissão para alterar dados neste módulo.',
    MODULE_DELETE_FORBIDDEN: 'Seu usuário não possui permissão para excluir dados neste módulo.'
  };
  return { success: false, code, module: module || undefined, error: messages[code] || 'Seu perfil não possui permissão para esta operação.' };
}
