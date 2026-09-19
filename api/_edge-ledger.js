// api/_edge-ledger.js — Detector de Anomalias Financeiras & Audit Ledger Criptográfico
// Fornece trilha imutável de auditoria com hash SHA-256 encadeado e análise de riscos em lançamentos de canteiro.

import crypto from 'node:crypto';
import { getKvCache, setKvCache } from './_edge-kv.js';

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
const localLedgerStore = new Map(); // tenantId -> Block[]

/**
 * Calcula o hash criptográfico SHA-256 de um bloco de auditoria.
 */
export function calculateBlockHash(block) {
  const content = `${block.index}|${block.timestamp}|${block.previousHash}|${block.tenantId}|${block.userId}|${block.action}|${block.resource}|${JSON.stringify(block.payload || {})}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Adiciona uma ação sensível à trilha imutável de auditoria (Audit Ledger).
 */
export async function appendLedgerBlock(env, event) {
  const {
    tenantId = 'global',
    userId = 'system',
    action = 'AUDIT_ACTION',
    resource = 'general',
    payload = {}
  } = event || {};

  const normTenant = String(tenantId).trim();
  const ledgerKey = `ledger:${normTenant}`;

  // Recupera histórico atual do tenant
  let chain = (await getKvCache(env, ledgerKey)) || localLedgerStore.get(normTenant) || [];

  const index = chain.length;
  const previousHash = index === 0 ? GENESIS_HASH : chain[index - 1].hash;
  const timestamp = new Date().toISOString();

  const newBlock = {
    index,
    timestamp,
    previousHash,
    tenantId: normTenant,
    userId: String(userId),
    action: String(action),
    resource: String(resource),
    payload
  };

  newBlock.hash = calculateBlockHash(newBlock);

  chain.push(newBlock);
  localLedgerStore.set(normTenant, chain);

  // Mantém os últimos 1.000 blocos no KV por tenant
  await setKvCache(env, ledgerKey, chain.slice(-1000), 30 * 24 * 3600);

  return newBlock;
}

/**
 * Verifica a integridade matemática da cadeia de blocos de auditoria.
 * Retorna se a trilha está intacta ou se houve adulteração no banco de dados.
 */
export function verifyLedgerIntegrity(chain = []) {
  if (!Array.isArray(chain) || chain.length === 0) {
    return { valid: true, blocksCount: 0, tampered: false };
  }

  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];
    const expectedPrevHash = i === 0 ? GENESIS_HASH : chain[i - 1].hash;

    // 1. Verifica se o ponteiro para o bloco anterior confere
    if (current.previousHash !== expectedPrevHash) {
      return {
        valid: false,
        tampered: true,
        failedAtBlockIndex: i,
        reason: `Ponteiro previousHash quebrado no bloco ${i}.`
      };
    }

    // 2. Recalcula o hash do conteúdo do bloco
    const recalculatedHash = calculateBlockHash(current);
    if (current.hash !== recalculatedHash) {
      return {
        valid: false,
        tampered: true,
        failedAtBlockIndex: i,
        reason: `Hash de conteúdo inválido no bloco ${i} (dados foram modificados).`
      };
    }
  }

  return {
    valid: true,
    tampered: false,
    blocksCount: chain.length,
    latestHash: chain[chain.length - 1].hash
  };
}

/**
 * Detector de Anomalias em Despesas e Medições de Canteiro.
 */
export function detectExpenseAnomaly(expense = {}, options = {}) {
  const { benchmarkPrice = null, historicalAverage = null, maxDeviationFactor = 2.0 } = options;

  const valorUnitario = Number(expense.preco_unitario || expense.valorUnitario || expense.valor || 0);
  const quantidade = Number(expense.quantidade || expense.qtd || 1);
  const valorTotal = Number(expense.valor_total || expense.total || valorUnitario * quantidade);

  const reference = benchmarkPrice || historicalAverage;

  if (!reference || reference <= 0 || valorUnitario <= 0) {
    return {
      isAnomaly: false,
      riskLevel: 'LOW',
      deviationPercentage: 0,
      reason: 'Valor dentro do padrão ou sem histórico comparativo.'
    };
  }

  const deviation = (valorUnitario - reference) / reference;
  const deviationPerc = Number((deviation * 100).toFixed(1));

  if (deviation >= maxDeviationFactor) { // +200% ou mais acima do benchmark
    return {
      isAnomaly: true,
      riskLevel: 'HIGH',
      deviationPercentage: deviationPerc,
      benchmarkReference: reference,
      currentUnitPrice: valorUnitario,
      reason: `Preço unitário R$ ${valorUnitario.toFixed(2)} está ${deviationPerc}% acima da referência de mercado (R$ ${reference.toFixed(2)}).`
    };
  }

  if (deviation >= 0.5) { // +50% a 200% acima do benchmark
    return {
      isAnomaly: false,
      riskLevel: 'MEDIUM',
      deviationPercentage: deviationPerc,
      benchmarkReference: reference,
      currentUnitPrice: valorUnitario,
      reason: `Preço unitário com variação moderada de +${deviationPerc}% em relação à média.`
    };
  }

  return {
    isAnomaly: false,
    riskLevel: 'LOW',
    deviationPercentage: deviationPerc,
    benchmarkReference: reference,
    currentUnitPrice: valorUnitario,
    reason: 'Valor em conformidade com as referências históricas e SINAPI.'
  };
}
