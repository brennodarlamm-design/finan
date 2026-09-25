// api/_tenant-cache.js — Camada de Cache Distribuído de Metadados de Tenant (Upstash Redis + L1 Memória)
// Reduz até 50% das consultas repetidas de plano, status e quotas no Neon PostgreSQL.

import { redisGet, redisSet, redisDel } from './_edge-redis.js';

const L1_CACHE = new Map();
const DEFAULT_TTL_SECONDS = 300; // 5 minutos padrão

/**
 * Obtém os metadados e plano de um tenant via Cache (L1 Memória -> L2 Upstash Redis -> L3 Neon DB).
 * @param {string} tenantId 
 * @param {Function} sql 
 * @param {object} [env] 
 * @returns {Promise<object|null>}
 */
export async function getCachedTenant(tenantId, sql, env = process.env) {
  if (!tenantId) return null;
  const tid = String(tenantId).trim();
  const cacheKey = `tenant:meta:${tid}`;

  // 1. L1: Memória local do processo (0ms)
  const mem = L1_CACHE.get(cacheKey);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.data;
  }

  // 2. L2: Upstash Redis Distribuído (< 15ms)
  try {
    const cached = await redisGet(cacheKey, env);
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      L1_CACHE.set(cacheKey, { data, expiresAt: Date.now() + 60000 }); // 1 min no L1
      return data;
    }
  } catch (err) {
    // Falha transitória do Redis não bloqueia a aplicação
  }

  // 3. L3: Neon PostgreSQL (Fonte da Verdade)
  if (!sql) return null;
  const rows = await sql`
    SELECT id, plano, status, razao_social, nome_fantasia, email, telefone, responsavel, vencimento, created_at
    FROM tenants
    WHERE id = ${tid}
    LIMIT 1;
  `;

  if (!rows || !rows.length) return null;
  const tenant = rows[0];

  // Grava no L1 e L2 com TTL defensivo
  L1_CACHE.set(cacheKey, { data: tenant, expiresAt: Date.now() + 60000 });
  try {
    await redisSet(cacheKey, tenant, DEFAULT_TTL_SECONDS, env);
  } catch {}

  return tenant;
}

/**
 * Invalida o cache do tenant imediatamente após qualquer UPDATE/ALTERAÇÃO.
 * @param {string} tenantId 
 * @param {object} [env] 
 */
export async function invalidateTenantCache(tenantId, env = process.env) {
  if (!tenantId) return;
  const tid = String(tenantId).trim();
  const cacheKey = `tenant:meta:${tid}`;

  L1_CACHE.delete(cacheKey);
  try {
    await redisDel(cacheKey, env);
  } catch {}
}

/**
 * Limpa o cache L1 em memória (útil para testes unitários).
 */
export function clearL1TenantCache() {
  L1_CACHE.clear();
}
