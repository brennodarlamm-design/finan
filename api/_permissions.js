// api/_permissions.js — RBAC central do FinObra
// Perfis suportados: superadmin, admin, gestor, operador, visualizador.

export const ROLE_RULES = Object.freeze({
  superadmin: Object.freeze({ read: true, write: true, delete: true, manageUsers: true, manageTenant: true, audit: true }),
  admin: Object.freeze({ read: true, write: true, delete: true, manageUsers: true, manageTenant: true, audit: true }),
  gestor: Object.freeze({ read: true, write: true, delete: true, manageUsers: false, manageTenant: false, audit: false }),
  operador: Object.freeze({ read: true, write: true, delete: false, manageUsers: false, manageTenant: false, audit: false }),
  visualizador: Object.freeze({ read: true, write: false, delete: false, manageUsers: false, manageTenant: false, audit: false })
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

export function permissionError(code = 'ROLE_FORBIDDEN') {
  const messages = {
    ROLE_READ_ONLY: 'Seu perfil é somente leitura e não pode alterar dados.',
    ROLE_DELETE_FORBIDDEN: 'Seu perfil não possui permissão para excluir registros.',
    ROLE_MANAGE_USERS_FORBIDDEN: 'Somente administradores podem gerenciar usuários.',
    ROLE_MANAGE_TENANT_FORBIDDEN: 'Somente administradores podem alterar os dados da empresa.',
    ROLE_AUDIT_FORBIDDEN: 'Somente administradores podem consultar a auditoria.'
  };
  return { success: false, code, error: messages[code] || 'Seu perfil não possui permissão para esta operação.' };
}
