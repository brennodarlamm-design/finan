// api/_edge-redis.js — Cliente Edge-Native Upstash Redis REST para FinGo
// Oferece cache distribuído sub-10ms, deduplicação de webhooks e rate-limiting
// compatível com Cloudflare Pages Functions, Workers e Node.js.

const DEFAULT_UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://better-wallaby-298903.upstash.io';
const DEFAULT_UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

/**
 * Resolve as credenciais do Upstash Redis a partir do ambiente ou padrões de produção.
 */
export function getUpstashCredentials(env) {
  const url = (env?.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL || DEFAULT_UPSTASH_URL || '').trim();
  const token = (env?.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || DEFAULT_UPSTASH_TOKEN || '').trim();
  return {
    url,
    token,
    configured: Boolean(url && token)
  };
}

/**
 * Executa um comando Redis via Upstash REST API.
 * @param {Array<string|number>} command - Ex: ['GET', 'chave'] ou ['SET', 'chave', 'val', 'EX', 60]
 * @param {object} [env] - Ambiente Cloudflare Workers/Pages ou omitido
 * @returns {Promise<any>} - O campo result retornado pelo Redis
 */
export async function upstashCommand(command, env) {
  const { url, token, configured } = getUpstashCredentials(env);
  if (!configured || !Array.isArray(command) || command.length === 0) {
    return null;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(3000)
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.warn(`[Upstash Redis] Erro HTTP ${res.status}: ${errBody.slice(0, 120)}`);
      return null;
    }

    const data = await res.json();
    if (data.error) {
      console.warn(`[Upstash Redis] Erro no comando [${command[0]}]: ${data.error}`);
      return null;
    }

    return data.result !== undefined ? data.result : null;
  } catch (err) {
    console.warn(`[Upstash Redis] Falha na requisição [${command[0]}]:`, err?.message || err);
    return null;
  }
}

/**
 * Executa uma sequência de comandos em pipeline via Upstash REST API.
 * @param {Array<Array<string|number>>} commands - Ex: [['INCR', 'k'], ['EXPIRE', 'k', 60]]
 */
export async function upstashPipeline(commands, env) {
  const { url, token, configured } = getUpstashCredentials(env);
  if (!configured || !Array.isArray(commands) || commands.length === 0) {
    return null;
  }

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(3500)
    });

    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data.map(item => item?.result) : null;
  } catch (err) {
    console.warn('[Upstash Redis] Falha no pipeline:', err?.message || err);
    return null;
  }
}

/**
 * Lê uma chave do Redis com suporte a desserialização JSON.
 */
export async function redisGet(key, env) {
  if (!key) return null;
  const raw = await upstashCommand(['GET', String(key)], env);
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Grava uma chave no Redis com TTL opcional em segundos.
 */
export async function redisSet(key, value, ttlSeconds = 0, env) {
  if (!key) return false;
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const ttl = Math.floor(Number(ttlSeconds) || 0);

  const cmd = ttl > 0
    ? ['SET', String(key), serialized, 'EX', ttl]
    : ['SET', String(key), serialized];

  const res = await upstashCommand(cmd, env);
  return res === 'OK';
}

/**
 * Define uma chave somente se ela ainda não existir (SETNX atômico).
 * Ideal para travas distribuídas (mutex) e deduplicação de mensagens do WhatsApp.
 * Retorna true se a chave foi definida (primeira vez), false se já existia.
 */
export async function redisSetNx(key, value = '1', ttlSeconds = 60, env) {
  if (!key) return false;
  const ttl = Math.max(1, Math.floor(Number(ttlSeconds) || 60));
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);

  // SET key value EX ttl NX
  const res = await upstashCommand(['SET', String(key), serialized, 'EX', ttl, 'NX'], env);
  return res === 'OK';
}

/**
 * Exclui uma ou mais chaves do Redis.
 */
export async function redisDel(key, env) {
  if (!key) return false;
  const res = await upstashCommand(['DEL', String(key)], env);
  return Number(res) > 0;
}

/**
 * Incrementa um contador atômico no Redis.
 */
export async function redisIncr(key, env) {
  if (!key) return null;
  return await upstashCommand(['INCR', String(key)], env);
}

/**
 * Rate Limiting atômico de alta performance usando Upstash Redis Pipeline.
 * Executa INCR e EXPIRE em uma única viagem HTTP (sub-5ms de latência).
 */
export async function checkRateLimitRedis(key, limit = 10, windowSeconds = 60, env) {
  if (!key) return { allowed: true, remaining: limit, resetSeconds: windowSeconds };
  const safeLimit = Math.max(1, Number(limit) || 10);
  const safeWindow = Math.max(1, Number(windowSeconds) || 60);
  const rateKey = `rl:${key}`;

  const results = await upstashPipeline([
    ['INCR', rateKey],
    ['EXPIRE', rateKey, safeWindow]
  ], env);

  if (!results || !Array.isArray(results)) {
    return { allowed: true, remaining: safeLimit, resetSeconds: safeWindow, fallback: true };
  }

  const count = Number(results[0]) || 1;
  return {
    allowed: count <= safeLimit,
    remaining: Math.max(0, safeLimit - count),
    resetSeconds: safeWindow,
    count
  };
}

/**
 * Testa a conexão com o Upstash Redis.
 */
export async function redisPing(env) {
  const res = await upstashCommand(['PING'], env);
  return res === 'PONG';
}
