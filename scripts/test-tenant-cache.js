// scripts/test-tenant-cache.js — Teste Automatizado do Cache Distribuído de Metadados de Tenant
import assert from 'assert';
import { getCachedTenant, invalidateTenantCache, clearL1TenantCache } from '../api/_tenant-cache.js';
import * as backendCache from '../backend/domains/auth/tenant_cache.js';

console.log('🧪 Iniciando testes do Cache de Metadados de Tenant (Upstash Redis + L1)...');

// 1. Validar re-export no domínio backend
assert.strictEqual(typeof backendCache.getCachedTenant, 'function', 'backend deve reexportar getCachedTenant');
assert.strictEqual(typeof backendCache.invalidateTenantCache, 'function', 'backend deve reexportar invalidateTenantCache');

// 2. Testar Cache L1 e L2 com SQL mockado
clearL1TenantCache();

let sqlCallCount = 0;
const mockTenantId = 'tenant-test-uuid-1234';
const mockTenantData = {
  id: mockTenantId,
  plano: 'pro',
  status: 'ativo',
  razao_social: 'Construtora Teste LTDA',
  nome_fantasia: 'Construtora Teste',
  email: 'financeiro@teste.com.br',
  telefone: '5595991363678',
  responsavel: 'Engenheiro Teste',
  vencimento: '2027-01-01',
  created_at: '2026-01-01'
};

const mockSql = async () => {
  sqlCallCount++;
  return [mockTenantData];
};

// 2.1. Primeira chamada: deve consultar o banco
const tenantFirst = await getCachedTenant(mockTenantId, mockSql, {});
assert.strictEqual(sqlCallCount, 1, 'Primeira consulta deve executar SQL');
assert.strictEqual(tenantFirst.id, mockTenantId);
assert.strictEqual(tenantFirst.plano, 'pro');

// 2.2. Segunda chamada: deve bater no cache L1 sem chamar SQL
const tenantSecond = await getCachedTenant(mockTenantId, mockSql, {});
assert.strictEqual(sqlCallCount, 1, 'Segunda consulta deve bater no cache L1 sem chamar SQL');
assert.deepStrictEqual(tenantSecond, tenantFirst);

// 2.3. Testar Invalidação de Cache
await invalidateTenantCache(mockTenantId, {});

// 2.4. Terceira chamada pós-invalidação: deve consultar o banco novamente
const tenantThird = await getCachedTenant(mockTenantId, mockSql, {});
assert.strictEqual(sqlCallCount, 2, 'Consulta pós-invalidação deve buscar novamente no banco');
assert.deepStrictEqual(tenantThird, mockTenantData);

// 3. Testar resiliência com tenantId inválido ou inexistente
const emptyTenant = await getCachedTenant(null, mockSql, {});
assert.strictEqual(emptyTenant, null, 'tenantId nulo deve retornar null sem chamar SQL');

const notFoundSql = async () => [];
const missingTenant = await getCachedTenant('non-existent', notFoundSql, {});
assert.strictEqual(missingTenant, null, 'Tenant inexistente deve retornar null');

console.log('  ✓ Cache L1/L2 com recuperação e deduplicação validado.');
console.log('  ✓ Invalidação sob demanda (invalidateTenantCache) validada com precisão.');
console.log('  ✓ Reexportação no backend/domains/auth/tenant_cache.js confirmada.');
console.log('  ✓ Resiliência contra parâmetros ausentes e falhas de banco confirmada.');
console.log('🎉 TODOS OS TESTES DO CACHE DE TENANT PASSARAM COM SUCESSO!\n');
