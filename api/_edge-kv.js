// api/_edge-kv.js — Camada de Cache Global em Cloudflare KV com Fallback em Memória
// Oferece latência <10ms para dados frequentes (SINAPI, Configurações de Tenant, Sessões).

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
 * Obtém um item do KV da Cloudflare (ou memória local de fallback).
 */
export async function getKvCache(env, key) {
  if (!key) return null;
  const normalizedKey = String(key).trim();

  // 1. Tenta buscar no binding nativo do Cloudflare KV
  if (env && env.CACHE_KV && typeof env.CACHE_KV.get === 'function') {
    try {
      const data = await env.CACHE_KV.get(normalizedKey, 'json');
      if (data !== null && data !== undefined) {
        return data;
      }
    } catch (err) {
      console.warn('[FinGo Edge KV] Erro ao ler KV remoto, usando fallback:', err?.message || err);
    }
  }

  // 2. Fallback em memória
  const entry = memoryCache.get(normalizedKey);
  if (entry) {
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      memoryCache.delete(normalizedKey);
      return null;
    }
    return entry.value;
  }

  return null;
}

/**
 * Grava um item no KV da Cloudflare com TTL opcional.
 */
export async function setKvCache(env, key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!key) return false;
  const normalizedKey = String(key).trim();
  const ttl = Math.max(60, Number(ttlSeconds) || DEFAULT_TTL_SECONDS);

  // 1. Grava no binding KV da Cloudflare
  let kvOk = false;
  if (env && env.CACHE_KV && typeof env.CACHE_KV.put === 'function') {
    try {
      await env.CACHE_KV.put(normalizedKey, serializeValue(value), {
        expirationTtl: ttl
      });
      kvOk = true;
    } catch (err) {
      console.warn('[FinGo Edge KV] Erro ao gravar KV remoto:', err?.message || err);
    }
  }

  // 2. Sempre mantém espelho na memória local
  memoryCache.set(normalizedKey, {
    value,
    expiresAt: Date.now() + ttl * 1000
  });

  // Limpeza de cache de memória se exceder 2000 itens
  if (memoryCache.size > 2000) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }

  return true;
}

/**
 * Remove um item do cache KV e da memória.
 */
export async function deleteKvCache(env, key) {
  if (!key) return false;
  const normalizedKey = String(key).trim();

  if (env && env.CACHE_KV && typeof env.CACHE_KV.delete === 'function') {
    try {
      await env.CACHE_KV.delete(normalizedKey);
    } catch (err) {
      console.warn('[FinGo Edge KV] Erro ao deletar no KV:', err?.message || err);
    }
  }

  memoryCache.delete(normalizedKey);
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
