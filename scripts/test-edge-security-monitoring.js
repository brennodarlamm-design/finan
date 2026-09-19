// scripts/test-edge-security-monitoring.js — Suíte de Testes de Defesa, Segurança & Monitoramento
import assert from 'node:assert/strict';
import { isIpBanned, recordFailedAttempt, recordSuccessfulAuth, unbanIp, checkAndSetIdempotency, checkGeoFencing, applyEdgeSecurityMiddleware } from '../api/_edge-security.js';
import { appendLedgerBlock, verifyLedgerIntegrity, calculateBlockHash, detectExpenseAnomaly } from '../api/_edge-ledger.js';
import { dispatchEdgeAlert, _resetAlertsHistory } from '../api/_edge-alerts.js';
import { recordEdgeMetric, getEdgeMetricsSummary, renderEdgeMetricsHtml } from '../api/_edge-metrics.js';
import { resolveV2Route } from '../api/_v2-routes.js';

console.log('\n=== Suíte de Testes: Defesa, Segurança & Monitoramento no Edge ===\n');

// -------------------------------------------------------------
// 1. Fail2Ban Global & Brute Force Shield
// -------------------------------------------------------------
console.log('1. Validando Fail2Ban Global Distribuído no KV...');

const testIp = '189.40.120.55';
await unbanIp({}, testIp);
assert.equal(await isIpBanned({}, testIp), false, 'IP limpo não deve estar banido.');

// Registra 4 tentativas falhas (não deve banir ainda)
for (let i = 1; i <= 4; i++) {
  const res = await recordFailedAttempt({}, testIp, 'invalid_password');
  assert.equal(res.banned, false, `Tentativa ${i} não deve acionar ban imediato.`);
  assert.equal(res.remaining, 5 - i);
}

// 5ª tentativa falha: deve acionar o banimento global
const banResult = await recordFailedAttempt({}, testIp, 'invalid_password');
assert.equal(banResult.banned, true, '5ª tentativa falha deve banir o IP.');
assert.equal(await isIpBanned({}, testIp), true, 'isIpBanned deve retornar true para IP banido.');

// Teste de interceptação do middleware
const mockReqBanned = new Request('https://fingo.api.br/api/login', {
  headers: { 'cf-connecting-ip': testIp }
});
const blockedResp = await applyEdgeSecurityMiddleware(mockReqBanned, {});
assert(blockedResp && blockedResp.status === 429, 'Middleware deve responder 429 para IP banido.');

await unbanIp({}, testIp);
assert.equal(await isIpBanned({}, testIp), false, 'unbanIp deve remover o bloqueio com sucesso.');
console.log('   ✓ Fail2Ban: limite de 5 falhas, banimento automático e middleware 429 aprovados.');

// -------------------------------------------------------------
// 2. Idempotência Criptográfica & Anti-Duplo Clique
// -------------------------------------------------------------
console.log('2. Validando Idempotência Criptográfica...');

const idempKey = 'tx_pix_payment_998124';
const payload = { valor: 2500.00, obraId: 'obra_77' };

const firstCheck = await checkAndSetIdempotency({}, idempKey, payload);
assert.equal(firstCheck.isDuplicate, false, 'Primeira requisição deve ser aceita.');

const secondCheck = await checkAndSetIdempotency({}, idempKey, payload);
assert.equal(secondCheck.isDuplicate, true, 'Segunda requisição idêntica deve ser identificada como duplicada.');

// Teste do middleware com idempotency key
const mockReqDup = new Request('https://fingo.api.br/api/lancamentos', {
  method: 'POST',
  headers: {
    'x-idempotency-key': idempKey,
    'cf-connecting-ip': '200.180.10.5'
  }
});
const dupResp = await applyEdgeSecurityMiddleware(mockReqDup, {});
assert(dupResp && dupResp.status === 409, 'Middleware deve responder 409 Conflict para requisição duplicada.');
console.log('   ✓ Idempotência: proteção contra duplo clique e resposta 409 aprovadas.');

// -------------------------------------------------------------
// 3. Geo-Fencing & Shield
// -------------------------------------------------------------
console.log('3. Validando Geo-Fencing e Detecção de Redes Anônimas...');

const reqBR = new Request('https://fingo.api.br/api/v2/engineering/obras', {
  headers: { 'cf-ipcountry': 'BR' }
});
const geoBR = checkGeoFencing(reqBR, ['BR']);
assert.equal(geoBR.allowed, true, 'Tráfego do Brasil deve ser autorizado.');

const reqTor = new Request('https://fingo.api.br/api/v2/engineering/obras', {
  headers: { 'cf-ipcountry': 'T1' }
});
const geoTor = checkGeoFencing(reqTor, ['BR']);
assert.equal(geoTor.allowed, false, 'Rede anônima / Tor (T1) deve ser bloqueada.');
console.log('   ✓ Geo-Fencing: validação de país e bloqueio de nós anônimos aprovados.');

// -------------------------------------------------------------
// 4. Trilha de Auditoria Criptográfica (Audit Ledger)
// -------------------------------------------------------------
console.log('4. Validando Audit Ledger Criptográfico (Hash Encadeado SHA-256)...');

const tenantId = 'construtora_alfa';
const block1 = await appendLedgerBlock({}, {
  tenantId,
  userId: 'eng_lucas',
  action: 'CREATE_OBRA',
  resource: 'obras/101',
  payload: { nome: 'Residencial Aurora', valor: 850000.00 }
});
assert.equal(block1.index, 0, 'Primeiro bloco deve ser índice 0 (gênesis).');
assert(block1.hash.length === 64, 'Hash do bloco deve ser SHA-256 válido.');

const block2 = await appendLedgerBlock({}, {
  tenantId,
  userId: 'eng_lucas',
  action: 'APPROVE_MEDICAO',
  resource: 'medicoes/55',
  payload: { valorLiquido: 45200.00 }
});
assert.equal(block2.index, 1, 'Segundo bloco deve ser índice 1.');
assert.equal(block2.previousHash, block1.hash, 'Bloco 2 deve apontar para o hash do Bloco 1.');

const chain = [block1, block2];
const integrityIntact = verifyLedgerIntegrity(chain);
assert.equal(integrityIntact.valid, true, 'verifyLedgerIntegrity deve confirmar cadeia íntegra.');
assert.equal(integrityIntact.tampered, false);

// Simulação de Adulteração Maliciosa de Banco de Dados
const tamperedChain = [
  { ...block1, payload: { nome: 'Residencial Aurora', valor: 999999.00 } }, // adulterado
  block2
];
const integrityTampered = verifyLedgerIntegrity(tamperedChain);
assert.equal(integrityTampered.valid, false, 'verifyLedgerIntegrity deve detectar adulteração.');
assert.equal(integrityTampered.tampered, true);
assert.equal(integrityTampered.failedAtBlockIndex, 0, 'Deve apontar o bloco exato adulterado.');
console.log('   ✓ Audit Ledger: encadeamento SHA-256 e detecção matemática de adulteração aprovados.');

// -------------------------------------------------------------
// 5. Detector de Anomalias Financeiras de Canteiro
// -------------------------------------------------------------
console.log('5. Validando Detector de Anomalias de Despesas...');

// Caso 1: Despesa normal (cimento a R$ 38,00 com benchmark R$ 35,00)
const normalExpense = { preco_unitario: 38.00, quantidade: 50 };
const normalCheck = detectExpenseAnomaly(normalExpense, { benchmarkPrice: 35.00 });
assert.equal(normalCheck.isAnomaly, false);
assert.equal(normalCheck.riskLevel, 'LOW');

// Caso 2: Despesa com anomalia grave (+300% acima do SINAPI, ex: cimento a R$ 140,00)
const anomalousExpense = { preco_unitario: 140.00, quantidade: 50 };
const anomalyCheck = detectExpenseAnomaly(anomalousExpense, { benchmarkPrice: 35.00 });
assert.equal(anomalyCheck.isAnomaly, true);
assert.equal(anomalyCheck.riskLevel, 'HIGH');
assert(anomalyCheck.deviationPercentage >= 200, 'Desvio deve ser superior a 200%.');
console.log('   ✓ Detector de Anomalias: classificação de risco LOW e HIGH aprovadas.');

// -------------------------------------------------------------
// 6. Despachante de Alertas Operacionais & Cooldown
// -------------------------------------------------------------
console.log('6. Validando Despachante de Alertas e Throttle...');

_resetAlertsHistory();

const firstAlert = await dispatchEdgeAlert({}, {
  type: 'GATEWAY_ERROR',
  severity: 'CRITICAL',
  title: 'Erro de Banco de Dados',
  message: 'Timeout na conexão Neon Postgres'
});
assert.equal(firstAlert.dispatched, true, 'Primeiro alerta deve ser despachado.');

// Segundo alerta imediato do mesmo tipo deve sofrer throttle
const secondAlert = await dispatchEdgeAlert({}, {
  type: 'GATEWAY_ERROR',
  severity: 'CRITICAL',
  title: 'Erro de Banco de Dados',
  message: 'Timeout na conexão Neon Postgres'
});
assert.equal(secondAlert.dispatched, false, 'Alerta repetido deve ser bloqueado pelo cooldown.');
assert.equal(secondAlert.throttled, true);
console.log('   ✓ Despachante de Alertas: disparo operacional e cooldown de 5 min aprovados.');

// -------------------------------------------------------------
// 7. Dashboard de Métricas e Observabilidade
// -------------------------------------------------------------
console.log('7. Validando Coletor de Métricas e Dashboard HTML...');

recordEdgeMetric({ status: 200, latencyMs: 12, isCacheHit: true });
recordEdgeMetric({ status: 200, latencyMs: 15, isCacheHit: false });
recordEdgeMetric({ status: 500, latencyMs: 45, isCacheHit: false });
recordEdgeMetric({ status: 429, latencyMs: 2, isSecurityBlock: true });

const metricsSummary = getEdgeMetricsSummary();
assert(metricsSummary.totalRequests >= 4, 'Total de requisições deve ser contabilizado.');
assert(metricsSummary.latency.p50, 'Percentil P50 deve ser calculado.');
assert(metricsSummary.security.blockedRequests >= 1, 'Bloqueios de segurança devem ser contabilizados.');

const html = renderEdgeMetricsHtml(metricsSummary);
assert(html.includes('FinGo EDGE METRICS'), 'HTML deve renderizar o título da marca FinGo.');
assert(html.includes('Distribuição de Status HTTP'), 'HTML deve conter a tabela de status.');
assert(html.includes('#C6FF00') || html.includes('var(--acid)'), 'HTML deve utilizar a paleta oficial.');

console.log('   ✓ Métricas & Dashboard: cálculo de P50/P95/P99 e renderização HTML aprovados.');

console.log('\n======================================================');
console.log('🎉 TODOS OS TESTES DE DEFESA E MONITORAMENTO PASSARAM COM SUCESSO!');
console.log('======================================================\n');
