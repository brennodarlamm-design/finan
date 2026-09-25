// backend/traceability.js
// Rastreabilidade Distribuída — Unificação do X-Request-Id entre Cloudflare Edge, Render e Neon

import crypto from 'crypto';

/**
 * Gera um identificador de requisição RFC 4122 v4
 */
export function generateRequestId() {
  return crypto.randomUUID();
}

/**
 * Normaliza e sanitiza o cabeçalho X-Request-Id recebido
 */
export function normalizeRequestId(rawId) {
  if (typeof rawId === 'string' && rawId.trim()) {
    const sanitized = rawId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (sanitized.length >= 8) return sanitized;
  }
  return generateRequestId();
}

/**
 * Envolve a instância neon template tagger para prefixar queries com comentário SQL do Request ID
 * Exemplo gerado: /* rid: c890e4f3-80b6-4c91-9121-6b21908d132a *\/ SELECT ...
 */
export function createTaggedSql(sqlInstance, requestId) {
  if (!sqlInstance) return null;
  const cleanId = normalizeRequestId(requestId);
  const prefix = `/* rid: ${cleanId} */ `;

  const tagged = (strings, ...values) => {
    if (typeof strings === 'string') {
      return sqlInstance(`${prefix}${strings}`);
    }
    if (Array.isArray(strings) && strings.length > 0) {
      const cloned = [...strings];
      cloned[0] = `${prefix}${cloned[0]}`;
      // Preserva raw property para compatibilidade estrita com ES6 Tagged Templates
      if (strings.raw) {
        cloned.raw = [...strings.raw];
        cloned.raw[0] = `${prefix}${cloned.raw[0]}`;
      }
      return sqlInstance(cloned, ...values);
    }
    return sqlInstance(strings, ...values);
  };

  // Preserva métodos utilitários caso o client exponha
  if (typeof sqlInstance.transaction === 'function') {
    tagged.transaction = sqlInstance.transaction.bind(sqlInstance);
  }

  return tagged;
}

/**
 * Middleware Express para injetar req.id, X-Request-Id e logger estruturado
 */
export function requestIdMiddleware(options = {}) {
  const getSql = typeof options.getSql === 'function' ? options.getSql : () => options.sql || null;

  return (req, res, next) => {
    const rawHeader = req.headers['x-request-id'] || req.headers['x-correlation-id'];
    const reqId = normalizeRequestId(rawHeader);

    req.id = reqId;
    res.setHeader('X-Request-Id', reqId);

    const activeSql = getSql();
    if (activeSql) {
      req.sql = createTaggedSql(activeSql, reqId);
    }

    req.log = (action, details = {}) => {
      const entry = {
        rid: reqId,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl || req.url,
        action,
        ...details
      };
      console.log(`[Req:${reqId}] ${action}`, JSON.stringify(entry));
    };

    next();
  };
}
