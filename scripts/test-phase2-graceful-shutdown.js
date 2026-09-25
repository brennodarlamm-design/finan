// scripts/test-phase2-graceful-shutdown.js
// Suíte de Testes Automatizados — Validação da Fase 2: Graceful Shutdown & Drenagem Atômica no Render

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { createGracefulShutdownManager } from '../backend/graceful_shutdown.js';

console.log('=== Testes da Fase 2: Graceful Shutdown & Drenagem Atômica no Render ===\n');

// 1. Inicialização e Contrato do Gerenciador
console.log('1. Validando instanciação e invariantes do GracefulShutdownManager...');
const manager = createGracefulShutdownManager({ timeoutMs: 3000 });
assert.equal(manager.isShuttingDown, false, 'Inicialmente não deve estar em shutdown');
assert.equal(manager.activeRequestsCount, 0, 'Requisições ativas iniciais devem ser 0');
assert.equal(typeof manager.middleware, 'function', 'Deve expor método middleware');
assert.equal(typeof manager.shutdown, 'function', 'Deve expor método shutdown');
console.log('   ✓ Contrato e valores padrão verificados.');

// 2. Teste Sintético de Carga com Disparo de SIGTERM
console.log('\n2. Executando teste sintético de carga e drenagem limpa com SIGTERM...');

let poolClosed = false;
const mockPool = {
  end: async () => { poolClosed = true; }
};

let redisQuit = false;
const mockRedis = {
  quit: async () => { redisQuit = true; }
};

let cronStopped = false;
const mockCron = {
  getTasks: () => [
    { stop: () => { cronStopped = true; } }
  ]
};

const testManager = createGracefulShutdownManager({
  timeoutMs: 3000,
  cron: mockCron,
  pools: [mockPool],
  redisClients: [mockRedis]
});

// Cria servidor HTTP de teste montado com o middleware de shutdown
const server = http.createServer(async (req, res) => {
  // Simula express middleware pipeline
  testManager.middleware()(req, res, async () => {
    if (req.url === '/processar-transacao') {
      // Simula uma transação bancária/upload de comprovante que leva 120ms
      await new Promise(r => setTimeout(r, 120));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, processed: true }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
testManager.setServer(server);

// Dispara 5 transações ativas concorrentes
const CONCURRENT_REQUESTS = 5;
console.log(`   🚀 Disparando ${CONCURRENT_REQUESTS} transações concorrentes de longa duração (120ms)...`);

const activePromises = Array.from({ length: CONCURRENT_REQUESTS }).map((_, i) => {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}/processar-transacao`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.end();
  });
});

// Aguarda 40ms para garantir que todas as 5 requisições estejam em voo no servidor
await new Promise(r => setTimeout(r, 40));
assert.equal(testManager.activeRequestsCount, CONCURRENT_REQUESTS, `Deve haver exatamente ${CONCURRENT_REQUESTS} requisições em voo`);
console.log(`   ✓ ${testManager.activeRequestsCount} requisições ativas confirmadas em processamento simultâneo.`);

// Dispara o desligamento atômico (simulando SIGTERM do deploy no Render)
console.log('   🛑 Enviando sinal SIGTERM enquanto as requisições estão em processamento...');
const shutdownPromise = testManager.shutdown('SIGTERM', { exit: false, timeoutMs: 2500 });

assert.equal(testManager.isShuttingDown, true, 'Servidor deve entrar imediatamente em modo shutdown');

// Tenta enviar uma nova requisição enquanto está drenando (deve ser recusada pelo server.close ou retornar 503)
console.log('   🧪 Testando rejeição de nova requisição que chega durante a drenagem...');
let rejected = false;
try {
  const rejectedRes = await new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}/processar-transacao`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }));
    });
    req.on('error', reject);
    req.end();
  });
  if (rejectedRes.status === 503) {
    rejected = true;
    assert.equal(rejectedRes.data.shuttingDown, true);
    console.log('   ✓ Nova requisição rejeitada via middleware com HTTP 503 (shuttingDown: true).');
  }
} catch (netErr) {
  if (netErr.code === 'ECONNREFUSED') {
    rejected = true;
    console.log('   ✓ Nova conexão TCP imediatamente recusada (ECONNREFUSED) pelo server.close().');
  } else {
    throw netErr;
  }
}
assert.equal(rejected, true, 'Novas conexões devem ser recusadas durante o shutdown');

// Aguarda a finalização das requisições que estavam em andamento
const results = await Promise.all(activePromises);
console.log(`   📥 Todas as ${results.length} transações ativas concluíram seu processamento.`);

// Valida que 100% das transações ativas terminaram com sucesso total (200 OK)
assert.equal(results.length, CONCURRENT_REQUESTS);
for (const res of results) {
  assert.equal(res.status, 200, 'Todas as transações em voo devem completar com HTTP 200');
  assert.equal(res.data.processed, true, 'Dados da transação devem ser preservados');
}
console.log('   ✓ 100% das transações ativas foram concluídas com sucesso (zero corrupção / zero 502).');

// Aguarda encerramento do processo de shutdown
const shutdownResult = await shutdownPromise;
assert.equal(shutdownResult.success, true);
assert.equal(shutdownResult.drainedSuccessfully, true);
assert.equal(shutdownResult.activeRequestsRemaining, 0);
assert.equal(poolClosed, true, 'Pool Neon Postgres deve ter sido encerrado (pool.end())');
assert.equal(redisQuit, true, 'Cliente Redis deve ter sido desconectado (quit())');
assert.equal(cronStopped, true, 'Tarefas cron devem ter sido paralisadas');
console.log('   ✓ Pools de banco, clientes Redis e tarefas cron finalizados atomicamente.');

// 3. Verificação de Código e Invariantes em backend/server.js
console.log('\n3. Validando interceptação de SIGTERM e SIGINT em backend/server.js...');
const serverCode = fs.readFileSync('backend/server.js', 'utf8');
assert.ok(serverCode.includes("import { createGracefulShutdownManager } from './graceful_shutdown.js';"), 'server.js deve importar o manager');
assert.ok(serverCode.includes("app.use(shutdownManager.middleware())"), 'server.js deve usar middleware de shutdown');
assert.ok(serverCode.includes("shutdownManager.setServer(server)"), 'server.js deve associar instância do server');
assert.ok(serverCode.includes("process.on('SIGTERM'"), 'server.js deve escutar SIGTERM');
assert.ok(serverCode.includes("process.on('SIGINT'"), 'server.js deve escutar SIGINT');
assert.ok(serverCode.includes("shutdownManager.shutdown('SIGTERM')"), 'server.js deve chamar shutdown no SIGTERM');
assert.ok(serverCode.includes("shutdownManager.shutdown('SIGINT')"), 'server.js deve chamar shutdown no SIGINT');
console.log('   ✓ Invariantes de shutdown em backend/server.js confirmados com precisão.');

console.log('\n======================================================');
console.log('🎉 FASE 2: GRACEFUL SHUTDOWN & DRENAGEM ATÔMICA 100% VALIDADOS!');
console.log('======================================================\n');
