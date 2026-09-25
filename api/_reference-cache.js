// api/_reference-cache.js
// Cache de Dados de Referência na Borda (SINAPI, CEP, CUB e Parâmetros) com Upstash & Cloudflare
// Estratégia: Stale-While-Revalidate com latência < 15ms

import { getKvCache, setKvCache } from './_edge-kv.js';

export const SWR_CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';

/**
 * Aplica os cabeçalhos HTTP canônicos de Stale-While-Revalidate e telemetria de cache
 */
export function applySwrCacheHeaders(res, options = {}) {
  const isHit = Boolean(options.isHit);
  const provider = options.provider || 'REDIS';

  res.setHeader?.('Cache-Control', SWR_CACHE_CONTROL);
  res.setHeader?.('X-Cache', isHit ? `HIT-${provider}` : 'MISS');
  res.setHeader?.('CF-Cache-Status', isHit ? 'HIT' : 'MISS');
}

/**
 * Obtém dado de referência com cache multinível (L1 Memória -> L2 Upstash/KV -> Fetch Fresco)
 */
export async function getCachedReference(env, cacheKey, fetchFreshDataFn, ttlSeconds = 86400) {
  if (!cacheKey) {
    const data = await fetchFreshDataFn();
    return { data, fromCache: false, cacheSource: 'MISS' };
  }

  // 1. Consulta cache distribuído (L1 Memória / L2 Upstash Redis / Cloudflare KV)
  try {
    const cached = await getKvCache(env, cacheKey);
    if (cached !== null && cached !== undefined) {
      return {
        data: cached,
        fromCache: true,
        cacheSource: 'HIT-REDIS'
      };
    }
  } catch (err) {
    console.warn(`[ReferenceCache] Falha ao consultar cache para '${cacheKey}':`, err?.message || err);
  }

  // 2. Cache MISS: executa a busca oficial/upstream
  const freshData = await fetchFreshDataFn();

  // 3. Persiste no Upstash Redis / Cloudflare KV em segundo plano
  if (freshData !== null && freshData !== undefined) {
    try {
      await setKvCache(env, cacheKey, freshData, ttlSeconds);
    } catch (setErr) {
      console.warn(`[ReferenceCache] Falha ao gravar cache para '${cacheKey}':`, setErr?.message || setErr);
    }
  }

  return {
    data: freshData,
    fromCache: false,
    cacheSource: 'MISS'
  };
}

/**
 * Gera chave canônica de cache para CEP
 */
export function cepCacheKey(cep) {
  const clean = String(cep || '').replace(/\D/g, '').slice(0, 8);
  return `ref:cep:${clean}`;
}

/**
 * Gera chave canônica de cache para CUB / Parâmetros Tributários
 */
export function tributarioCacheKey(uf, anoMes = 'latest') {
  const cleanUf = String(uf || 'BR').trim().toUpperCase();
  const cleanComp = String(anoMes || 'latest').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return `ref:tributario:${cleanUf}:${cleanComp}`;
}
