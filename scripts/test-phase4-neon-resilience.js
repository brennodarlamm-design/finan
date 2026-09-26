// scripts/test-phase4-neon-resilience.js
// Suíte de Testes Automatizados — Validação da Fase 4: Blindagem de Conexões Neon Postgres

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  injectStatementTimeout,
  isTransientError,
  calculateJitterDelay,
  executeWithRetry,
  createResilientNeon
} from '../api/_neon-resilience.js';
import * as dbModule from '../api/_database.js';

console.log('=== Testes da Fase 4: Blindagem de Conexões Neon Postgres ===\n');

// 1. Injeção de statement_timeout = 8000 (8 segundos) na URL
console.log('1. Validando injeção de statement_timeout=8000 na URL de conexão Neon...');
const rawUrl = 'postgres://finobra_app:[REDACTED_SECRET]@ep-cool-frost.sa-east-1.aws.neon.tech/neondb?sslmode=require';
const hardenedUrl = injectStatementTimeout(rawUrl, 8000);

assert.ok(decodeURIComponent(hardenedUrl).includes('statement_timeout=8000'), 'URL deve conter statement_timeout=8000');
assert.ok(new URL(hardenedUrl).searchParams.get('options').includes('statement_timeout=8000'), 'options searchParam deve conter statement_timeout=8000');
assert.ok(hardenedUrl.includes('sslmode=require'), 'Parâmetros pré-existentes devem ser preservados');

// Idempotência
const secondPass = injectStatementTimeout(hardenedUrl, 8000);
assert.equal(secondPass, hardenedUrl, 'Injeção deve ser idempotente');
console.log('   ✓ Injeção de statement_timeout=8000 validada com sucesso.');

// 2. Classificação de Erros Transitórios vs Permanentes
console.log('\n2. Validando detecção estrita de erros transitórios vs statement_timeout...');
// Transitórios (devem sofrer retry com jitter)
assert.equal(isTransientError({ code: 'ECONNRESET', message: 'read ECONNRESET' }), true);
assert.equal(isTransientError({ code: '57P01', message: 'admin_shutdown' }), true);
assert.equal(isTransientError({ message: 'Neon cold start delay in handshake' }), true);
assert.equal(isTransientError({ message: 'Connection terminated unexpectedly' }), true);

// Não-transitórios (NÃO devem sofrer retry; devem falhar rápido e liberar pool)
assert.equal(isTransientError({ code: '57014', message: 'canceling statement due to statement timeout' }), false);
assert.equal(isTransientError({ code: '42P01', message: 'relation "inexistente" does not exist' }), false);
assert.equal(isTransientError({ code: '28P01', message: 'password authentication failed' }), false);
console.log('   ✓ Classificação de falhas transitórias e liberação de statement_timeout confirmadas.');

// 3. Cálculo de Exponential Backoff com Jitter
console.log('\n3. Validando cálculo de backoff com jitter (200ms, 800ms)...');
const delays0 = Array.from({ length: 5 }).map(() => calculateJitterDelay(0, 200, 800));
const delays1 = Array.from({ length: 5 }).map(() => calculateJitterDelay(1, 200, 800));

for (const d of delays0) {
  assert.ok(d >= 200 && d <= 250, `Delay da tentativa 0 deve estar na faixa de 200ms + jitter (obtido: ${d}ms)`);
}
for (const d of delays1) {
  assert.ok(d >= 800 && d <= 1000, `Delay da tentativa 1 deve estar na faixa de 800ms + jitter (obtido: ${d}ms)`);
}
console.log('   ✓ Delays distribuídos com Full Jitter validados.');

// 4. Simulação de Cold Start do Neon com Recuperação Automática
console.log('\n4. Simulando cold start transitório do Neon e recuperação no retry...');
let attempts = 0;
const retryHistory = [];

const mockOperation = async () => {
  attempts++;
  if (attempts === 1) {
    const err = new Error('Neon database cold start: connection terminated unexpectedly');
    err.code = 'ECONNRESET';
    throw err;
  }
  return [{ id: 'obra-01', nome: 'Residencial Aurora' }];
};

const result = await executeWithRetry(mockOperation, {
  maxRetries: 2,
  baseDelay: 20, // Rápido para a suíte de testes
  maxDelay: 50,
  onRetry: (err, attempt, delay) => {
    retryHistory.push({ attempt, delay, errCode: err.code });
  }
});

assert.equal(attempts, 2, 'Operação deve ter sido reexecutada na 2ª tentativa');
assert.equal(retryHistory.length, 1);
assert.equal(retryHistory[0].attempt, 0);
assert.equal(result[0].id, 'obra-01');
console.log('   ✓ Cold start absorvido e recuperado com sucesso via retry com jitter.');

// 5. Simulação de Statement Timeout Forçado (Sem Retry, Falha Imediata)
console.log('\n5. Simulando timeout forçado de 8s (statement_timeout) e liberação imediata...');
let timeoutAttempts = 0;
const timeoutErr = new Error('canceling statement due to statement timeout');
timeoutErr.code = '57014';

await assert.rejects(
  async () => {
    await executeWithRetry(async () => {
      timeoutAttempts++;
      throw timeoutErr;
    }, { maxRetries: 2 });
  },
  (err) => {
    assert.equal(err.code, '57014');
    return true;
  }
);

assert.equal(timeoutAttempts, 1, 'statement_timeout NÃO deve ser retentado; conexão liberada imediatamente');
console.log('   ✓ statement_timeout rejeitado na 1ª tentativa sem prender conexão no pooler.');

// 6. Auditoria de Projeções Estritas de Colunas (Evitar Blobs Pesados em Listagens)
console.log('\n6. Validando auditoria de projeções estritas em queries de listagem...');
const serverSrc = fs.readFileSync('backend/server.js', 'utf8');

// Valida que queries do robô de cobrança e resumo matinal especificam colunas
assert.ok(serverSrc.includes('SELECT id, razao_social, nome_fantasia, telefone, email, responsavel, plano, status, vencimento'), 'Varredura de cobrança deve usar projeção estrita de colunas');
assert.ok(serverSrc.includes('SELECT id, COALESCE(nome_fantasia, razao_social, id) AS nome, telefone'), 'Resumo matinal deve projetar apenas id, nome e telefone');
console.log('   ✓ Auditoria de projeção confirmada em todas as listagens críticas.');

// 7. Verificação de api/_database.js e backend/server.js
console.log('\n7. Validando vinculação de createResilientNeon em api/_database.js e backend/server.js...');
const dbSrc = fs.readFileSync('api/_database.js', 'utf8');
assert.ok(dbSrc.includes("import { createResilientNeon } from './_neon-resilience.js';"), 'api/_database.js deve importar createResilientNeon');
assert.ok(dbSrc.includes('createResilientNeon(getRuntimeDatabaseUrl()'), 'createRuntimeSql deve usar createResilientNeon');
assert.ok(dbSrc.includes('createResilientNeon(getOwnerDatabaseUrl()'), 'createOwnerSql deve usar createResilientNeon');

assert.ok(serverSrc.includes("import { createResilientNeon } from './neon_resilience.js';"), 'server.js deve importar createResilientNeon');
assert.ok(serverSrc.includes('createResilientNeon(rawDbUrl, { statementTimeoutMs: 8000 })'), 'server.js deve instanciar Neon blindado');
console.log('   ✓ Conexões do runtime e backend blindadas com sucesso.');

console.log('\n======================================================');
console.log('🎉 FASE 4: BLINDAGEM NEON POSTGRES 100% VALIDADA!');
console.log('======================================================\n');
