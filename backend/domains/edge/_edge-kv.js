// api/_edge-kv.js — Camada de Cache Global em Cloudflare KV com Fallback em Memória
// Oferece latência <10ms para dados frequentes (SINAPI, Configurações de Tenant, Sessões).

import { redisGet, redisSet, redisDel } from './_edge-redis.js';

const memoryCache = new Map();
const DEFAULT_TTL_SECONDS = 3600; // 1 hora padrão

/**
 * Normaliza o valor antes de persistir no KV.
 */
function serializeValue(val) {
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

/**
 * Desserializa o valor obtido do KV ou memória.
 */
function deserializeValue(val) {
  if (!val || typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

/**
 * Obtém um item da memória local (L1), KV da Cloudflare (L2a) ou Upstash Redis (L2b).
 */
export async function getKvCache(env, key) {
  if (!key) return null;
  const normalizedKey = String(key).trim();

  // 1. Tenta L1 em memória (0ms de latência)
  const entry = memoryCache.get(normalizedKey);
  if (entry) {
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      memoryCache.delete(normalizedKey);
    } else {
      return entry.value;
    }
  }

  // 2. Se houver binding nativo do Cloudflare KV (L2a), consulta exclusivamente nele
  if (env && env.CACHE_KV && typeof env.CACHE_KV.get === 'function') {
    try {
      const data = await env.CACHE_KV.get(normalizedKey, 'json');
      if (data !== null && data !== undefined) {
        memoryCache.set(normalizedKey, {
          value: data,
          expiresAt: Date.now() + 60 * 1000
        });
        return data;
      }
      return null;
    } catch (err) {
      console.warn('[FinGo Edge KV] Erro ao ler KV remoto, usando fallback:', err?.message || err);
    }
  }

  // 3. Caso não haja binding KV nativo, consulta no Upstash Redis distribuído (L2b)
  try {
    const redisData = await redisGet(normalizedKey, env);
    if (redisData !== null && redisData !== undefined) {
      memoryCache.set(normalizedKey, {
        value: redisData,
        expiresAt: Date.now() + 60 * 1000
      });
      return redisData;
    }
  } catch {
    // ignora e segue
  }

  return null;
}

/**
 * Grava um item no KV da Cloudflare ou Upstash Redis com TTL opcional.
 */
export async function setKvCache(env, key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!key) return false;
  const normalizedKey = String(key).trim();
  const ttl = Math.max(60, Number(ttlSeconds) || DEFAULT_TTL_SECONDS);

  // 1. Sempre mantém espelho na memória local (L1)
  memoryCache.set(normalizedKey, {
    value,
    expiresAt: Date.now() + ttl * 1000
  });

  // Limpeza de cache de memória se exceder 2000 itens
  if (memoryCache.size > 2000) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }

  // 2. Se houver binding KV da Cloudflare, grava nele (L2a)
  if (env && env.CACHE_KV && typeof env.CACHE_KV.put === 'function') {
    try {
      await env.CACHE_KV.put(normalizedKey, serializeValue(value), {
        expirationTtl: ttl
      });
    } catch (err) {
      console.warn('[FinGo Edge KV] Erro ao gravar KV remoto:', err?.message || err);
    }
    return true;
  }

  // 3. Caso contrário, persiste no Upstash Redis distribuído (L2b)
  try {
    await redisSet(normalizedKey, value, ttl, env);
  } catch {
    // fallback transparente
  }

  return true;
}

/**
 * Remove um item do cache KV da Cloudflare, Upstash Redis e da memória local.
 */
export async function deleteKvCache(env, key) {
  if (!key) return false;
  const normalizedKey = String(key).trim();

  // 1. Remove da memória local (L1)
  memoryCache.delete(normalizedKey);

  // 2. Se houver binding KV da Cloudflare, remove dele (L2a)
  if (env && env.CACHE_KV && typeof env.CACHE_KV.delete === 'function') {
    try {
      await env.CACHE_KV.delete(normalizedKey);
    } catch (err) {
      console.warn('[FinGo Edge KV] Erro ao deletar no KV:', err?.message || err);
    }
    return true;
  }

  // 3. Caso contrário, remove do Upstash Redis (L2b)
  try {
    await redisDel(normalizedKey, env);
  } catch {
    // fallback transparente
  }

  return true;
}

/**
 * Gera chave canônica para cache de consultas SINAPI.
 */
export function sinapiCacheKey(uf = 'BR', competencia = 'default', query = '') {
  const normUf = String(uf).trim().toUpperCase();
  const normComp = String(competencia).trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const normQuery = String(query).trim().toLowerCase().slice(0, 80);
  return `sinapi:${normUf}:${normComp}:${normQuery}`;
}

/**
 * Gera chave canônica para cache de configurações de Tenant.
 */
export function tenantConfigCacheKey(tenantId) {
  return `tenant_cfg:${String(tenantId || 'global').trim()}`;
}
