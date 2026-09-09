// api/_ratelimit.js — Utilitário de Rate Limiting para APIs Serverless
// Utiliza algoritmo Sliding Window Log com expurgo automático

const rateLimitStore = new Map();

/**
 * Obtém o IP do cliente de forma segura em ambientes proxy/Vercel.
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Verifica se a requisição está dentro do limite configurado.
 * @param {string} key Identificador único (ex: 'login:192.168.1.1' ou 'tenant:tenant_123')
 * @param {number} limit Número máximo de requisições permitidas na janela
 * @param {number} windowMs Tamanho da janela em milissegundos
 * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
 */
export function checkRateLimit(key, limit = 10, windowMs = 60000) {
  const now = Date.now();
  const windowStart = now - windowMs;

  let timestamps = rateLimitStore.get(key) || [];

  // Remove timestamps fora da janela
  timestamps = timestamps.filter(ts => ts > windowStart);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const resetMs = oldest + windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, resetMs)
    };
  }

  timestamps.push(now);
  rateLimitStore.set(key, timestamps);

  // Limpeza preventiva periódica se o mapa crescer muito
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      const valid = v.filter(ts => ts > windowStart);
      if (valid.length === 0) {
        rateLimitStore.delete(k);
      } else {
        rateLimitStore.set(k, valid);
      }
    }
  }

  return {
    allowed: true,
    remaining: limit - timestamps.length,
    resetMs: windowMs
  };
}

/**
 * Reseta o contador para uma chave específica (usado em testes ou desbloqueio manual).
 */
export function resetRateLimit(key) {
  rateLimitStore.delete(key);
}

