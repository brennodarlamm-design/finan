// scripts/test-backend-architecture.js — Validador da Arquitetura Modular do Backend e Edge Caching
// Skill: architecture-patterns, api-design-principles, frontend-lighthouse

import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('🏛️  Iniciando suíte de testes da Arquitetura Backend Modular e Edge Cache...');
let passed = 0;
let total = 0;
const testQueue = [];

function test(name, fn) {
  testQueue.push({ name, fn });
}

// 1. Limite Inegociável da Vercel Hobby (Máximo 12 Serverless Functions)
test('Vercel Hobby: api/*.js não excede 12 Serverless Functions públicas', () => {
  const apiDir = path.resolve('api');
  const files = fs.readdirSync(apiDir);
  const serverlessFunctions = files.filter(f => f.endsWith('.js') && !f.startsWith('_'));
  
  console.log(`     Funções Serverless públicas encontradas (${serverlessFunctions.length}):`, serverlessFunctions.join(', '));
  assert.ok(
    serverlessFunctions.length <= 12,
    `Quantidade de funções serverless (${serverlessFunctions.length}) excede o limite de 12 da Vercel Hobby!`
  );
  assert.strictEqual(serverlessFunctions.length, 12, 'Deve haver exatamente 12 funções públicas consolidadas.');
});

// 2. Existência e Estrutura dos Módulos Internos com Prefixo '_'
test('Módulos de Domínio Internos prefixados com "_" existem e estão estruturados', () => {
  const expectedModules = [
    'api/_http.js',
    'api/_db-normalizers.js',
    'api/_db-queries.js',
    'api/_db-mutations.js',
    'api/_db-sync.js'
  ];

  for (const modPath of expectedModules) {
    assert.ok(fs.existsSync(path.resolve(modPath)), `Módulo interno esperado não encontrado: ${modPath}`);
  }
});

// 3. Validação do Módulo HTTP e Headers de Edge Caching
test('api/_http.js implementa CORS rigoroso, Edge Cache e No-Cache privado', async () => {
  const httpMod = await import('../api/_http.js');
  
  assert.strictEqual(typeof httpMod.setCORS, 'function', 'setCORS deve ser exportado');
  assert.strictEqual(typeof httpMod.setEdgeCacheHeaders, 'function', 'setEdgeCacheHeaders deve ser exportado');
  assert.strictEqual(typeof httpMod.setPrivateNoCache, 'function', 'setPrivateNoCache deve ser exportado');
  assert.strictEqual(typeof httpMod.sendSuccess, 'function', 'sendSuccess deve ser exportado');
  assert.strictEqual(typeof httpMod.sendError, 'function', 'sendError deve ser exportado');

  // Testar cabeçalhos de Edge Cache
  const mockHeaders = {};
  const mockRes = {
    setHeader: (k, v) => { mockHeaders[k.toLowerCase()] = v; }
  };

  httpMod.setEdgeCacheHeaders(mockRes, { sMaxAge: 3600, staleWhileRevalidate: 86400, isPublic: true });
  assert.ok(mockHeaders['cache-control'], 'Cache-Control deve ser definido');
  assert.ok(mockHeaders['cache-control'].includes('s-maxage=3600'), 's-maxage deve ser 3600');
  assert.ok(mockHeaders['cache-control'].includes('stale-while-revalidate=86400'), 'stale-while-revalidate deve ser 86400');
  assert.strictEqual(mockHeaders['cdn-cache-control'], 'public, s-maxage=3600, stale-while-revalidate=86400');

  // Testar no-cache privado
  const mockPrivateHeaders = {};
  const mockPrivateRes = {
    setHeader: (k, v) => { mockPrivateHeaders[k.toLowerCase()] = v; }
  };
  httpMod.setPrivateNoCache(mockPrivateRes);
  assert.ok(mockPrivateHeaders['cache-control'].includes('no-store'), 'Deve conter no-store');
  assert.ok(mockPrivateHeaders['cache-control'].includes('no-cache'), 'Deve conter no-cache');
  assert.strictEqual(mockPrivateHeaders['pragma'], 'no-cache');
});

// 4. Validação dos Normalizadores e Sanitizadores
test('api/_db-normalizers.js exporta funções puras de tratamento de dados', async () => {
  const norm = await import('../api/_db-normalizers.js');
  
  assert.strictEqual(typeof norm.cleanDate, 'function');
  assert.strictEqual(typeof norm.cleanNum, 'function');
  assert.strictEqual(typeof norm.safeJsonParse, 'function');
  assert.strictEqual(typeof norm.normalizeOrcamento, 'function');
  assert.strictEqual(typeof norm.normalizeMedicao, 'function');
  assert.strictEqual(typeof norm.parsePagination, 'function');
  assert.strictEqual(typeof norm.pageResponse, 'function');

  // Sanitização numérica e monetária
  assert.strictEqual(norm.cleanNum('1500.50'), 1500.5);
  assert.strictEqual(norm.cleanNum(null), 0);
  assert.strictEqual(norm.cleanNum(undefined), 0);
  assert.strictEqual(norm.cleanNum('invalid'), 0);

  // Sanitização de data
  assert.strictEqual(norm.cleanDate('2026-09-16T12:00:00Z'), '2026-09-16');
  assert.strictEqual(norm.cleanDate('16/09/2026'), '2026-09-16');
  assert.strictEqual(norm.cleanDate(null), null);
  assert.strictEqual(norm.cleanDate('—'), null);

  // Paginação
  const p1 = norm.parsePagination({ limit: '50', offset: '100' });
  assert.deepStrictEqual(p1, { limit: 50, offset: 100, cursor: null });

  const pEnvelope = norm.pageResponse([{ id: '1' }, { id: '2' }], { limit: 2, offset: 0, cursor: null });
  assert.strictEqual(pEnvelope.success, true);
  assert.strictEqual(pEnvelope.pagination.count, 2);
  assert.strictEqual(pEnvelope.pagination.hasMore, true);
  assert.strictEqual(pEnvelope.pagination.nextCursor, '2');
});

// 5. Validação de Mutações, Validações de Tenant e Limites de Plano
test('api/_db-mutations.js exporta manipuladores de escrita e verificadores de tenant', async () => {
  const mut = await import('../api/_db-mutations.js');

  assert.strictEqual(typeof mut.validateObraTenant, 'function');
  assert.strictEqual(typeof mut.validateFornecedorTenant, 'function');
  assert.strictEqual(typeof mut.validateNotaFiscalTenant, 'function');
  assert.strictEqual(typeof mut.enforceObraPlanLimit, 'function');
  assert.strictEqual(typeof mut.validateBulkObraPlanLimit, 'function');
  assert.strictEqual(typeof mut.handleSave, 'function');
  assert.strictEqual(typeof mut.handleDelete, 'function');
});

// 6. Validação do Motor de Sincronização em Massa
test('api/_db-sync.js exporta handleSyncAll com suporte a coleções em lote', async () => {
  const syncMod = await import('../api/_db-sync.js');
  assert.strictEqual(typeof syncMod.handleSyncAll, 'function', 'handleSyncAll deve ser exportado');
});

// 7. Validação das Queries e Snapshot
test('api/_db-queries.js exporta endpoints de leitura e delta sync com Edge Cache em SINAPI', async () => {
  const qMod = await import('../api/_db-queries.js');
  assert.strictEqual(typeof qMod.handleDeltaSync, 'function');
  assert.strictEqual(typeof qMod.handleManifest, 'function');
  assert.strictEqual(typeof qMod.handleFullSnapshot, 'function');
  assert.strictEqual(typeof qMod.handleSinapiQuery, 'function');
  assert.strictEqual(typeof qMod.handleTableQuery, 'function');
});

// 8. Validação de Edge Caching em api/plano.js para Catálogo de Preços
test('api/plano.js suporta consulta pública de pricing com cabeçalhos de Edge Caching', () => {
  const planoSource = fs.readFileSync(path.resolve('api/plano.js'), 'utf8');
  assert.ok(planoSource.includes("req.query?.action === 'pricing'"), 'plano.js deve atender action === pricing');
  assert.ok(planoSource.includes('setEdgeCacheHeaders(res'), 'plano.js deve aplicar setEdgeCacheHeaders no pricing');
});

// 9. Roteador Serverless api/db.js Limpo e Modular
test('api/db.js é um roteador modular conciso delegando para submódulos de domínio', () => {
  const dbSource = fs.readFileSync(path.resolve('api/db.js'), 'utf8');
  assert.ok(dbSource.includes("from './_http.js'"), 'db.js importa de _http.js');
  assert.ok(dbSource.includes("from './_db-normalizers.js'"), 'db.js importa de _db-normalizers.js');
  assert.ok(dbSource.includes("from './_db-queries.js'"), 'db.js importa de _db-queries.js');
  assert.ok(dbSource.includes("from './_db-mutations.js'"), 'db.js importa de _db-mutations.js');
  assert.ok(dbSource.includes("from './_db-sync.js'"), 'db.js importa de _db-sync.js');
  assert.ok(dbSource.includes('export default async function handler'), 'db.js exporta handler padrão');
});

// Execução sequencial de todos os testes
for (const item of testQueue) {
  total++;
  try {
    await item.fn();
    console.log(`  ✅ [PASS] ${item.name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${item.name}`);
    console.error(`     Erro: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log(`\n🎉 Resultado: ${passed}/${total} testes passaram com sucesso!`);
if (passed !== total) {
  process.exit(1);
}
