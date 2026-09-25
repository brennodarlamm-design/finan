// api/_neon-resilience.js
// Blindagem de Conexões Neon PostgreSQL — Timeouts, Cold Start e Retry com Jitter

import { neon } from '@neondatabase/serverless';

export const TRANSIENT_PG_ERRORS = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EPIPE',
  'EAI_AGAIN',
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  'COLD_START'
]);

/**
 * Identifica se o erro é transitório (queda de rede, cold start do Neon, reset de conexão)
 */
export function isTransientError(err) {
  if (!err) return false;
  const code = String(err.code || err.status || '');
  if (TRANSIENT_PG_ERRORS.has(code)) return true;

  const msg = String(err.message || '').toLowerCase();

  // statement_timeout não deve sofrer retry (query longa demais, deve liberar o pool imediatamente)
  if (code === '57014' || msg.includes('statement_timeout') || msg.includes('canceling statement due to statement timeout')) {
    return false;
  }

  return (
    msg.includes('connection reset') ||
    msg.includes('econnreset') ||
    msg.includes('connection terminated') ||
    msg.includes('terminating connection') ||
    msg.includes('cannot connect now') ||
    msg.includes('cold start') ||
    msg.includes('handshake') ||
    msg.includes('socket hang up') ||
    msg.includes('timeout while establishing') ||
    msg.includes('connection closed unexpectedly') ||
    msg.includes('fetch failed')
  );
}

/**
 * Injeta 'statement_timeout = 8000' (8 segundos) na URL de conexão do PostgreSQL
 */
export function injectStatementTimeout(urlStr, timeoutMs = 8000) {
  if (!urlStr || typeof urlStr !== 'string') return urlStr;
  try {
    const parsed = new URL(urlStr);
    const existingOptions = parsed.searchParams.get('options') || '';
    if (!existingOptions.includes('statement_timeout')) {
      const optionVal = `-c statement_timeout=${timeoutMs}`;
      const merged = existingOptions ? `${existingOptions} ${optionVal}` : optionVal;
      parsed.searchParams.set('options', merged);
      return parsed.toString();
    }
    return urlStr;
  } catch {
    return urlStr;
  }
}

/**
 * Calcula delay exponencial com Full Jitter para distribuir retentativas sem colisões determinísticas
 * Tentativa 0: ~200ms
 * Tentativa 1: ~800ms
 */
export function calculateJitterDelay(attempt, baseDelay = 200, maxDelay = 800) {
  const target = attempt === 0 ? baseDelay : maxDelay;
  const jitter = Math.floor(Math.random() * (target * 0.25)); // Jitter de 0 a 25%
  return target + jitter;
}

/**
 * Executa uma operação assíncrona com retry exponencial e jitter para falhas transitórias
 */
export async function executeWithRetry(operationFn, options = {}) {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelay = options.baseDelay ?? 200;
  const maxDelay = options.maxDelay ?? 800;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operationFn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isTransientError(err)) {
        const delay = calculateJitterDelay(attempt, baseDelay, maxDelay);
        options.onRetry?.(err, attempt, delay);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Instancia o cliente Neon blindado com statement_timeout = 8s e retry automático
 */
export function createResilientNeon(urlStr, options = {}) {
  const timeoutMs = options.statementTimeoutMs || 8000;
  const hardenedUrl = injectStatementTimeout(urlStr, timeoutMs);
  const rawSql = neon(hardenedUrl, options.neonOptions);

  const resilientSql = (strings, ...values) => {
    return executeWithRetry(() => rawSql(strings, ...values), {
      maxRetries: options.maxRetries ?? 2,
      baseDelay: options.baseDelay ?? 200,
      maxDelay: options.maxDelay ?? 800,
      onRetry: options.onRetry
    });
  };

  resilientSql.rawClient = rawSql;
  resilientSql.url = hardenedUrl;
  resilientSql.statementTimeoutMs = timeoutMs;
  if (typeof rawSql.transaction === 'function') {
    resilientSql.transaction = rawSql.transaction.bind(rawSql);
  }

  return resilientSql;
}
