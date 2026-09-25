// backend/domains/auth/tenant_cache.js — Reexportação do Cache de Metadados de Tenant para o Backend Render
export {
  getCachedTenant,
  invalidateTenantCache,
  clearL1TenantCache
} from '../../../api/_tenant-cache.js';
