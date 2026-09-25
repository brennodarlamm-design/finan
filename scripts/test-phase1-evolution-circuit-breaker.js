// scripts/test-phase1-evolution-circuit-breaker.js
// Suíte de Testes Automatizados — Validação da Fase 1: Circuit Breaker & Health Probes no WhatsApp

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EvolutionGoClient } from '../backend/domains/atendimento/evolution_client.js';
import * as integrationModule from '../backend/domains/integrations/evolution_go.js';

console.log('=== Testes da Fase 1: Circuit Breaker & Health Probes no WhatsApp ===\n');

// 1. Verificação do módulo de integração oficial
console.log('1. Validando módulo de integração backend/domains/integrations/evolution_go.js...');
assert.equal(typeof integrationModule.EvolutionGoClient, 'function', 'EvolutionGoClient deve ser exportado');
assert.equal(typeof integrationModule.evolutionGo, 'object', 'Instância singleton evolutionGo deve ser exportada');
console.log('   ✓ Re-export do conector e cliente validado com sucesso.');

// 2. Máquina de Estados e Inicialização (CLOSED por padrão)
console.log('\n2. Validando inicialização e invariantes da máquina de estados do Circuit Breaker...');
const client = new EvolutionGoClient({
  baseUrl: 'http://127.0.0.1:59998', // Porta intencionalmente fechada para simular oscilação
  apiKey: 'test-api-key',
  timeoutMs: 300,
  failureThreshold: 3,
  cooldownMs: 1000 // Cooldown de 1s para o teste rodar rápido
});

assert.equal(client.getCircuitState(), 'CLOSED', 'Estado inicial deve ser CLOSED');
assert.equal(client.isCircuitOpen(), false, 'isCircuitOpen deve retornar false inicialmente');
assert.equal(client.consecutiveFailures, 0, 'Contador de falhas consecutivas deve iniciar em 0');
assert.equal(client.failureThreshold, 3, 'Limiar de abertura deve ser 3 falhas consecutivas');
console.log('   ✓ Estado inicial CLOSED com limiar de 3 falhas confirmado.');

// 3. Simulação de falhas consecutivas e abertura do circuito
console.log('\n3. Simulando falhas consecutivas de rede e acionamento do disjuntor...');
// 3.1 Primeira falha
const res1 = await client.sendTextMessage('tenant-cb-test', '11999998888', 'msg 1');
assert.equal(res1.ok, false);
assert.equal(client.consecutiveFailures, 1);
assert.equal(client.getCircuitState(), 'CLOSED', 'Circuito deve permanecer CLOSED com 1 falha');

// 3.2 Segunda falha
const res2 = await client.sendTextMessage('tenant-cb-test', '11999998888', 'msg 2');
assert.equal(res2.ok, false);
assert.equal(client.consecutiveFailures, 2);
assert.equal(client.getCircuitState(), 'CLOSED', 'Circuito deve permanecer CLOSED com 2 falhas');

// 3.3 Terceira falha consecutiva (deve disparar abertura)
const res3 = await client.sendTextMessage('tenant-cb-test', '11999998888', 'msg 3');
assert.equal(res3.ok, false);
assert.equal(client.consecutiveFailures, 3);
assert.equal(client.getCircuitState(), 'OPEN', 'Circuito deve abrir (OPEN) na 3ª falha consecutiva');
assert.equal(client.isCircuitOpen(), true, 'isCircuitOpen deve retornar true quando OPEN');
console.log('   ✓ Circuito abriu (OPEN) com exatidão após 3 falhas consecutivas.');

// 4. Benchmarking de latência no chaveamento: Fast Failover (< 50ms)
console.log('\n4. Validando tempo de resposta do failover com circuito aberto (< 50ms)...');
const startBench = performance.now();
const fastFailoverRes = await client.sendTextMessage('tenant-cb-test', '11999998888', 'msg rápida');
const elapsedBench = performance.now() - startBench;

assert.equal(fastFailoverRes.ok, false);
assert.equal(fastFailoverRes.status, 503);
assert.equal(fastFailoverRes.circuitOpen, true);
assert.match(fastFailoverRes.error, /Circuit Breaker aberto/);
assert.ok(elapsedBench < 50, `Tempo de resposta deve ser < 50ms durante o chaveamento (obtido: ${elapsedBench.toFixed(2)}ms)`);
console.log(`   ✓ Fast failover executado em ${elapsedBench.toFixed(2)}ms (< 50ms aprovado!).`);

// 5. Failover automático para motor de contingência
console.log('\n5. Validando chaveamento transparente para motor de contingência...');
let contingencyCalled = false;
client.setContingencyHandler(async (path, options) => {
  contingencyCalled = true;
  return {
    ok: true,
    status: 200,
    engine: 'contingencia-baileys',
    data: { messageId: 'msg-contingencia-ok' }
  };
});

const startContingency = performance.now();
const contingencyRes = await client.sendTextMessage('tenant-cb-test', '11999998888', 'msg contingência');
const elapsedContingency = performance.now() - startContingency;

assert.equal(contingencyCalled, true, 'Handler de contingência deve ter sido acionado');
assert.equal(contingencyRes.ok, true);
assert.equal(contingencyRes.contingencyUsed, true);
assert.equal(contingencyRes.circuitOpen, true);
assert.equal(contingencyRes.engine, 'contingencia-baileys');
assert.ok(elapsedContingency < 50, `Contingência executou em ${elapsedContingency.toFixed(2)}ms (< 50ms)`);
console.log(`   ✓ Chaveamento para motor de contingência concluído em ${elapsedContingency.toFixed(2)}ms.`);

// 6. Transição para HALF_OPEN após período de cooldown
console.log('\n6. Validando cooldown e transição para HALF_OPEN...');
// Força expiração do cooldown de 1000ms
client.lastFailureTime = Date.now() - 1500;
assert.equal(client.getCircuitState(), 'HALF_OPEN', 'Após cooldown, circuito deve transicionar para HALF_OPEN');
console.log('   ✓ Transição para HALF_OPEN confirmada após cooldown.');

// 7. Fechamento do circuito (recuperação) após sucesso em HALF_OPEN
console.log('\n7. Validando recuperação e fechamento automático do circuito...');
client.recordSuccess();
assert.equal(client.getCircuitState(), 'CLOSED', 'Sucesso em HALF_OPEN deve restaurar o estado para CLOSED');
assert.equal(client.consecutiveFailures, 0, 'Falhas consecutivas devem ser zeradas');
console.log('   ✓ Circuito recuperado e fechado (CLOSED) com sucesso.');

// 8. Health Probe dedicado do Evolution Go
console.log('\n8. Validando sonda de saúde checkHealth()...');
// 8.1 Cliente não configurado
const unconfClient = new EvolutionGoClient({ baseUrl: '', apiKey: '' });
const unconfHealth = await unconfClient.checkHealth();
assert.equal(unconfHealth.healthy, false);
assert.equal(unconfHealth.status, 'unconfigured');

// 8.2 Cliente com circuito aberto
client.tripCircuit();
const openHealth = await client.checkHealth();
assert.equal(openHealth.healthy, false);
assert.equal(openHealth.status, 'circuit_open');
assert.equal(openHealth.circuitState, 'OPEN');

// 8.3 Reset
client.resetCircuit();
assert.equal(client.getCircuitState(), 'CLOSED');
console.log('   ✓ Health Probes validados em múltiplos cenários operacionais.');

// 9. Integridade de backend/server.js
console.log('\n9. Validando rotas de saúde e Circuit Breaker em backend/server.js...');
const serverSrc = fs.readFileSync('backend/server.js', 'utf8');
assert.ok(serverSrc.includes("app.get('/health/evolution-go'"), 'server.js deve expor /health/evolution-go');
assert.ok(serverSrc.includes("evolutionGo.checkHealth()"), 'server.js deve sondar checkHealth()');
assert.ok(serverSrc.includes("circuitOpen: Boolean(evoResult.circuitOpen)"), 'server.js deve propagar circuitOpen');
console.log('   ✓ Invariantes no backend confirmados.');

console.log('\n======================================================');
console.log('🎉 FASE 1: CIRCUIT BREAKER & HEALTH PROBES 100% VALIDADOS!');
console.log('======================================================\n');
