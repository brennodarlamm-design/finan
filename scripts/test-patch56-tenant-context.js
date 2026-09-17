// scripts/test-patch56-tenant-context.js
// Patch 56 / Fase B — valida o wrapper de contexto tenant para RLS.

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTenantSql, isTenantScopedSql } from '../api/_tenant-sql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

console.log('=== Patch 56 Tenant SQL Context ===');

function makeFakeNeon() {
  const calls = [];

  function txn(strings, ...values) {
    if (Array.isArray(strings) && Array.isArray(strings.raw)) {
      return { kind: 'template', text: strings.join('?'), values };
    }
    return { kind: 'raw', text: String(strings || ''), values };
  }

  const baseSql = function baseSql() {
    throw new Error('baseSql direto não deve ser usado neste teste.');
  };

  baseSql.transaction = async (builder) => {
    const queries = typeof builder === 'function' ? builder(txn) : builder;
    calls.push(queries);
    return queries.map((query, index) => index === 0
      ? [{ tenant_context: query.values?.[0] || '', system_context: query.values?.[1] || 'false' }]
      : [{ ok: true, query }]);
  };

  return { baseSql, calls };
}

const tenantId = 'tenant_test_123';
const fake = makeFakeNeon();
const sql = createTenantSql(fake.baseSql, { tenantId });

assert.strictEqual(isTenantScopedSql(sql), true, 'Wrapper deve ser marcado como tenant-scoped.');
assert.strictEqual(sql.tenantId, tenantId, 'Tenant normalizado deve ficar disponível para diagnóstico.');
assert.strictEqual(sql.isSystem, false, 'Tenant comum nunca pode nascer como system.');

const result = await sql`SELECT id FROM obras WHERE tenant_id = ${tenantId} LIMIT 1;`;
assert.strictEqual(result.length, 1);
assert.strictEqual(fake.calls.length, 1, 'Uma query lógica deve virar uma única transação Neon.');
assert.strictEqual(fake.calls[0].length, 2, 'Transação deve conter contexto + query do chamador.');

const contextQuery = fake.calls[0][0];
const userQuery = fake.calls[0][1];
assert(contextQuery.text.includes("set_config('app.current_tenant_id'"), 'Contexto deve definir app.current_tenant_id.');
assert(contextQuery.text.includes("set_config('app.is_system'"), 'Contexto deve definir app.is_system.');
assert.strictEqual(contextQuery.values[0], tenantId, 'Tenant deve ser bind parameter, nunca interpolado em SQL bruto.');
assert.strictEqual(contextQuery.values[1], 'false', 'Tenant comum deve usar app.is_system=false.');
assert.strictEqual(userQuery.values[0], tenantId, 'Parâmetros da query original devem ser preservados.');

const txResult = await sql.transaction(tx => [
  tx`UPDATE obras SET nome = ${'Obra Teste'} WHERE tenant_id = ${tenantId} AND id = ${'obra_1'};`,
  tx`SELECT id FROM obras WHERE tenant_id = ${tenantId} AND id = ${'obra_1'};`
]);
assert.strictEqual(txResult.length, 2, 'Resultado de transaction() deve remover apenas a query interna de contexto.');
assert.strictEqual(fake.calls[1].length, 3, 'Transação atômica deve conter contexto + todas as queries do builder.');

assert.throws(
  () => createTenantSql(fake.baseSql, {}),
  /Contexto tenant obrigatório/,
  'Acesso comum sem tenant deve falhar fechado.'
);

const systemFake = makeFakeNeon();
const systemSql = createTenantSql(systemFake.baseSql, { isSystem: true });
await systemSql`SELECT 1;`;
assert.strictEqual(systemFake.calls[0][0].values[0], '', 'Contexto system pode operar sem tenant específico.');
assert.strictEqual(systemFake.calls[0][0].values[1], 'true', 'Contexto system precisa ser explícito.');

await assert.rejects(
  async () => sql('SELECT 1'),
  /tagged template/,
  'Wrapper não deve aceitar SQL bruto fora do tagged template.'
);

const helperSource = read('api/_tenant-sql.js');
assert(helperSource.includes("set_config('app.current_tenant_id'"));
assert(helperSource.includes("set_config('app.is_system'"));
assert(helperSource.includes('true) AS tenant_context'), 'set_config precisa ser transaction-local (SET LOCAL sem vazamento).');
assert(!helperSource.includes('SET app.current_tenant_id ='), 'Não deve depender de SET persistente de sessão no Neon HTTP.');

// Integração piloto: a API central de dados passa a executar todas as consultas
// através do contexto tenant. Os WHERE tenant_id existentes continuam como defesa
// em profundidade e serão mantidos mesmo quando FORCE RLS entrar em produção.
const dbSource = read('api/db.js');
assert(dbSource.includes("import { createTenantSql } from './_tenant-sql.js';"), 'api/db.js deve importar createTenantSql.');
assert(dbSource.includes('const baseSql = getSql();'), 'api/db.js deve separar cliente base do cliente tenant-scoped.');
assert(dbSource.includes('createTenantSql(baseSql, { tenantId, isSystem: Boolean(auth.isSystem) })'), 'api/db.js deve criar contexto a partir do tenant autenticado.');
assert(!dbSource.includes('const sql = getSql();'), 'api/db.js não pode mais expor cliente SQL sem contexto após autenticação.');

const querySource = read('api/_db-queries.js');
assert(querySource.includes('WHERE tenant_id = ${tenantId}'), 'Filtros tenant explícitos devem permanecer como defesa em profundidade.');

console.log('✅ Patch 56: camada de contexto tenant transacional e integração piloto validadas.');
