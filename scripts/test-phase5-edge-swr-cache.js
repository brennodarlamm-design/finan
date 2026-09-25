// scripts/test-phase5-edge-swr-cache.js
// Suíte de Testes Automatizados — Validação da Fase 5: Cache Edge Stale-While-Revalidate com Upstash & Cloudflare

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SWR_CACHE_CONTROL,
  applySwrCacheHeaders,
  getCachedReference,
  cepCacheKey,
  tributarioCacheKey
} from '../api/_reference-cache.js';
import { handleSinapiQuery } from '../api/_db-queries.js';
import nfeHandler from '../api/nfe.js';

console.log('=== Testes da Fase 5: Cache Edge Stale-While-Revalidate (Upstash & Cloudflare) ===\n');

// 1. Validando Cabeçalhos Canônicos Stale-While-Revalidate
console.log('1. Validando cabeçalhos canônicos de Stale-While-Revalidate e telemetria...');
assert.equal(SWR_CACHE_CONTROL, 'public, max-age=3600, stale-while-revalidate=86400');

const mockHeadersMiss = {};
const mockResMiss = { setHeader: (k, v) => { mockHeadersMiss[k] = v; } };
applySwrCacheHeaders(mockResMiss, { isHit: false });
assert.equal(mockHeadersMiss['Cache-Control'], SWR_CACHE_CONTROL);
assert.equal(mockHeadersMiss['X-Cache'], 'MISS');
assert.equal(mockHeadersMiss['CF-Cache-Status'], 'MISS');

const mockHeadersHit = {};
const mockResHit = { setHeader: (k, v) => { mockHeadersHit[k] = v; } };
applySwrCacheHeaders(mockResHit, { isHit: true, provider: 'REDIS' });
assert.equal(mockHeadersHit['Cache-Control'], SWR_CACHE_CONTROL);
assert.equal(mockHeadersHit['X-Cache'], 'HIT-REDIS');
assert.equal(mockHeadersHit['CF-Cache-Status'], 'HIT');
console.log('   ✓ Cabeçalhos Cache-Control, X-Cache e CF-Cache-Status validados com sucesso.');

// 2. Benchmarking de Latência: Queda de ~120ms para < 15ms (p50 / p95)
console.log('\n2. Medindo latência em cache MISS vs cache HIT (meta: < 15ms no HIT)...');
const testKey = 'test_benchmark_reference_key_' + Date.now();
const mockFetchSlow = async () => {
  // Simula consulta pesada ao banco ou API governamental externa (~80ms)
  await new Promise(r => setTimeout(r, 80));
  return [
    { codigo: '104658', descricao: 'PISO CERÂMICO ESMALTADO', valor: 208.00 },
    { codigo: '45333', descricao: 'CONCRETO USINADO FCK 25MPA', valor: 199.02 }
  ];
};

// 2.1 Chamada Inicial (MISS)
const startMiss = performance.now();
const resMiss = await getCachedReference({}, testKey, mockFetchSlow, 3600);
const elapsedMiss = performance.now() - startMiss;

assert.equal(resMiss.fromCache, false);
assert.equal(resMiss.cacheSource, 'MISS');
assert.equal(resMiss.data.length, 2);
console.log(`   ✓ Cache MISS executou consulta original em ${elapsedMiss.toFixed(2)}ms.`);

// 2.2 Chamadas Subsequentes (HITS) com medição de percentis (p50 e p95)
const hitLatencies = [];
for (let i = 0; i < 20; i++) {
  const startHit = performance.now();
  const resHit = await getCachedReference({}, testKey, mockFetchSlow, 3600);
  const elapsedHit = performance.now() - startHit;
  hitLatencies.push(elapsedHit);

  assert.equal(resHit.fromCache, true);
  assert.equal(resHit.cacheSource, 'HIT-REDIS');
  assert.equal(resHit.data.length, 2);
}

hitLatencies.sort((a, b) => a - b);
const p50 = hitLatencies[Math.floor(hitLatencies.length * 0.5)];
const p95 = hitLatencies[Math.floor(hitLatencies.length * 0.95)];

console.log(`   📊 Estatísticas de Latência no Cache HIT:`);
console.log(`      p50: ${p50.toFixed(2)}ms`);
console.log(`      p95: ${p95.toFixed(2)}ms`);

assert.ok(p50 < 15, `p50 deve ser < 15ms (obtido: ${p50.toFixed(2)}ms)`);
assert.ok(p95 < 20, `p95 deve ser < 20ms (obtido: ${p95.toFixed(2)}ms)`);
console.log('   ✓ Latência no Edge entregue em < 15ms instantaneamente (Aprovado!).');

// 3. Teste de Integração com handleSinapiQuery
console.log('\n3. Validando integração do cache SWR no endpoint de SINAPI...');
let sinapiDbCalls = 0;
const mockSinapiSql = async () => {
  sinapiDbCalls++;
  return [
    { id: 1, codigo: '104658', descricao: 'PISO CERÂMICO', valor: 208.00, estado: 'SP' }
  ];
};

const sinapiResHeaders = {};
const sinapiMockRes = {
  status: (c) => ({
    json: (d) => ({ statusCode: c, data: d })
  }),
  setHeader: (k, v) => { sinapiResHeaders[k] = v; }
};

// 3.1 Primeira busca (MISS)
const sinapiOut1 = await handleSinapiQuery(mockSinapiSql, { estado: 'SP', q: 'ceramico', competencia: '2026-08' }, sinapiMockRes, {});
assert.equal(sinapiResHeaders['X-Cache'], 'MISS');
assert.equal(sinapiResHeaders['Cache-Control'], SWR_CACHE_CONTROL);
assert.equal(sinapiDbCalls, 1);

// 3.2 Segunda busca com mesmos parâmetros (HIT)
const sinapiOut2 = await handleSinapiQuery(mockSinapiSql, { estado: 'SP', q: 'ceramico', competencia: '2026-08' }, sinapiMockRes, {});
assert.equal(sinapiResHeaders['X-Cache'], 'HIT-REDIS');
assert.equal(sinapiResHeaders['CF-Cache-Status'], 'HIT');
assert.equal(sinapiResHeaders['Cache-Control'], SWR_CACHE_CONTROL);
assert.equal(sinapiDbCalls, 1, 'Banco de dados não deve ser consultado no Cache HIT');
console.log('   ✓ SINAPI entrega resposta em cache com headers SWR e zero queries repetidas no banco.');

// 4. Teste de Integração na Consulta de CEP (api/nfe.js)
console.log('\n4. Validando cache SWR na consulta de CEP...');
const cepHeaders = {};
let cepStatusCode = 200;
let cepPayload = null;

const cepMockRes = {
  status: (code) => {
    cepStatusCode = code;
    return {
      json: (data) => {
        cepPayload = data;
        return { status: code, data };
      }
    };
  },
  setHeader: (k, v) => { cepHeaders[k] = v; }
};

const cepReq = {
  method: 'GET',
  query: { action: 'cep', cep: '69301000' },
  headers: { origin: 'https://fingo.api.br' },
  env: {}
};

// Primeira consulta (ou cache prévio)
await nfeHandler(cepReq, cepMockRes);
assert.ok(cepHeaders['Cache-Control']?.includes('stale-while-revalidate'));
assert.ok(cepHeaders['X-Cache'] === 'HIT-REDIS' || cepHeaders['X-Cache'] === 'MISS');

// Segunda consulta imediata (deve ser HIT-REDIS instantâneo)
await nfeHandler(cepReq, cepMockRes);
assert.equal(cepHeaders['X-Cache'], 'HIT-REDIS');
assert.equal(cepHeaders['CF-Cache-Status'], 'HIT');
assert.equal(cepHeaders['Cache-Control'], SWR_CACHE_CONTROL);
console.log('   ✓ CEP responde via Upstash Cache com cabeçalhos HIT-REDIS e SWR.');

// 5. Verificação dos Módulos e Re-exports
console.log('\n5. Validando re-export em backend/domains/integrations/reference_cache.js...');
const integrationCache = fs.readFileSync('backend/domains/integrations/reference_cache.js', 'utf8');
assert.ok(integrationCache.includes("from '../../../api/_reference-cache.js';"));
console.log('   ✓ Módulo de integração devidamente conectado.');

console.log('\n======================================================');
console.log('🎉 FASE 5: CACHE EDGE STALE-WHILE-REVALIDATE 100% VALIDADO!');
console.log('======================================================\n');
