// scripts/test-phase3-distributed-traceability.js
// Suíte de Testes Automatizados — Validação da Fase 3: Rastreabilidade Distribuída (X-Request-Id Unificado)

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateRequestId, normalizeRequestId, createTaggedSql, requestIdMiddleware } from '../backend/traceability.js';
import { executeEdgeApi } from '../api/_edge-adapter.js';

console.log('=== Testes da Fase 3: Rastreabilidade Distribuída (X-Request-Id Unificado) ===\n');

// 1. Geração e Normalização de UUIDv4
console.log('1. Validando geração e normalização de X-Request-Id (UUIDv4)...');
const id1 = generateRequestId();
assert.match(id1, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'Deve gerar UUIDv4 canônico');

assert.equal(normalizeRequestId('custom-trace-id-12345'), 'custom-trace-id-12345');
assert.match(normalizeRequestId('invalid!@#$%^&*()'), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
assert.match(normalizeRequestId(''), /^[0-9a-f]{8}-/);
assert.match(normalizeRequestId(null), /^[0-9a-f]{8}-/);
console.log('   ✓ Geração e normalização de UUIDv4 validadas com sucesso.');

// 2. Injeção de Comentário SQL Atômico com createTaggedSql
console.log('\n2. Validando injeção de comentário SQL /* rid: <id> */ nas queries...');
let capturedQuery = null;
let capturedValues = null;

const mockSqlRunner = (strings, ...values) => {
  capturedQuery = Array.isArray(strings) ? strings.join('$?') : String(strings);
  capturedValues = values;
  return [{ result: 'ok' }];
};

const taggedSql = createTaggedSql(mockSqlRunner, 'trace-c890e4f3-80b6');
const tenantParam = 'angelim-construtora';
taggedSql`SELECT * FROM tenants WHERE id = ${tenantParam} AND active = ${true};`;

assert.ok(capturedQuery.startsWith('/* rid: trace-c890e4f3-80b6 */ SELECT * FROM tenants'));
assert.equal(capturedValues.length, 2);
assert.equal(capturedValues[0], 'angelim-construtora');
assert.equal(capturedValues[1], true);
console.log('   ✓ Comentário SQL de rastreabilidade injetado preservando parâmetros de binding.');

// 3. Middleware Express no Backend Render
console.log('\n3. Validando requestIdMiddleware no ciclo de requisição Express...');
const mockReq = { headers: {} };
const mockResHeaders = {};
const mockRes = {
  setHeader: (k, v) => { mockResHeaders[k.toLowerCase()] = v; }
};

let middlewareNextCalled = false;
const mw = requestIdMiddleware({ sql: mockSqlRunner });
mw(mockReq, mockRes, () => { middlewareNextCalled = true; });

assert.equal(middlewareNextCalled, true);
assert.ok(mockReq.id, 'req.id deve ser preenchido');
assert.equal(mockResHeaders['x-request-id'], mockReq.id, 'X-Request-Id deve ser devolvido no header');
assert.equal(typeof mockReq.sql, 'function', 'req.sql deve ser decorado com o ID atual');
assert.equal(typeof mockReq.log, 'function', 'req.log deve estar disponível para log estruturado');
console.log('   ✓ req.id, X-Request-Id e req.sql validados no middleware.');

// 4. Borda Cloudflare: Propagação de X-Request-Id no Edge Adapter
console.log('\n4. Validando geração automática de X-Request-Id no Cloudflare Edge...');
// 4.1 Requisição sem X-Request-Id -> Deve gerar automaticamente na borda
const edgeReqWithoutId = new Request('https://fingo.api.br/api/health', {
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
});

const edgeRes1 = await executeEdgeApi(edgeReqWithoutId, {});
const edgeResId1 = edgeRes1.headers.get('x-request-id');
assert.ok(edgeResId1, 'Edge deve gerar e retornar x-request-id no cabeçalho');
assert.match(edgeResId1, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'x-request-id deve ser UUIDv4');
console.log(`   ✓ X-Request-Id autogerado na borda: ${edgeResId1}`);

// 4.2 Requisição com X-Request-Id existente -> Deve propagar o mesmo ID intacto
const customTraceId = 'client-trace-999-888-777';
const edgeReqWithId = new Request('https://fingo.api.br/api/health', {
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'x-request-id': customTraceId
  }
});

const edgeRes2 = await executeEdgeApi(edgeReqWithId, {});
const edgeResId2 = edgeRes2.headers.get('x-request-id');
assert.equal(edgeResId2, customTraceId, 'Edge deve propagar o mesmo X-Request-Id fornecido pelo cliente');
console.log(`   ✓ X-Request-Id propagado sem mutação: ${edgeResId2}`);

// 5. Propagação de Cabeçalho nos Proxies Internos (WhatsApp Proxy -> Render)
console.log('\n5. Validando propagação nos proxies internos para o Render...');
const apiWaSrc = fs.readFileSync('api/whatsapp.js', 'utf8');
const backendWaSrc = fs.readFileSync('backend/domains/integrations/whatsapp.js', 'utf8');

assert.ok(apiWaSrc.includes("authHeaders['x-request-id'] = requestId"), 'api/whatsapp.js deve propagar x-request-id no authHeaders');
assert.ok(backendWaSrc.includes("authHeaders['x-request-id'] = requestId"), 'backend/domains/integrations/whatsapp.js deve propagar x-request-id no authHeaders');
console.log('   ✓ Propagação em fetch para o Render confirmada nos proxies de WhatsApp.');

// 6. Verificação de backend/server.js
console.log('\n6. Validando configuração em backend/server.js...');
const serverSrc = fs.readFileSync('backend/server.js', 'utf8');
assert.ok(serverSrc.includes("import { requestIdMiddleware, createTaggedSql } from './traceability.js';"), 'server.js deve importar traceability');
assert.ok(serverSrc.includes("app.use(requestIdMiddleware"), 'server.js deve usar requestIdMiddleware');
assert.ok(serverSrc.includes("const querySql = req.sql || sql;"), 'server.js deve usar querySql decorado com req.id');
assert.ok(serverSrc.includes("req_id: req.id"), 'server.js deve retornar req_id nas respostas críticas');
console.log('   ✓ Invariantes em backend/server.js confirmados com precisão.');

console.log('\n======================================================');
console.log('🎉 FASE 3: RASTREABILIDADE DISTRIBUÍDA 100% VALIDADA!');
console.log('======================================================\n');
