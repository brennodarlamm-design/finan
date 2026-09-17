// api/_ratelimit.js — Rate limiting distribuído para Serverless/Vercel
// Patch 09: usa Neon como contador compartilhado entre instâncias e mantém
// fallback em memória apenas para indisponibilidade temporária do banco.
// Patch 56: integra bloqueio distribuído por IP e Fail2Ban lógico.

import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import { getTrustedClientIp, checkIpBan, recordIpFailure } from './_security-ip.js';

const localFallback = new Map();

export function getClientIp(req) {
  return getTrustedClientIp(req);
}

function fallbackCheck(key, limit, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;
  let timestamps = (localFallback.get(key) || []).filter(ts => ts > windowStart);
  if (timestamps.length >= limit) {
    const oldest = timestamps[0] || now;
    return { allowed:false, remaining:0, resetMs:Math.max(0, oldest + windowMs - now), distributed:false };
  }
  timestamps.push(now);
  localFallback.set(key, timestamps);
  if (localFallback.size > 5000) {
    for (const [k, values] of localFallback.entries()) {
      const valid = values.filter(ts => ts > windowStart);
      if (valid.length) localFallback.set(k, valid); else localFallback.delete(k);
    }
  }
  return { allowed:true, remaining:Math.max(0, limit - timestamps.length), resetMs:windowMs, distributed:false };
}

function bucketId(key, windowStart, windowMs) {
  return crypto.createHash('sha256').update(`${key}|${windowStart}|${windowMs}`).digest('hex');
}

function securityIpFromRateKey(key) {
  const value = String(key || '');
  if (value.startsWith('login:ip:')) return value.slice('login:ip:'.length);
  if (value.startsWith('mfa:')) return value.slice('mfa:'.length);
  if (value.startsWith('reset:ip:')) return value.slice('reset:ip:'.length);
  if (value.startsWith('password-reset:ip:')) return value.slice('password-reset:ip:'.length);
  return '';
}

/**
 * Rate limit distribuído em janela fixa.
 * A tabela api_rate_limits é criada pela migration 008.
 * Se o Neon estiver temporariamente indisponível, aplica fallback local em vez de
 * derrubar autenticação/serviços. O fallback é deliberadamente mais restrito.
 *
 * Patch 56:
 * - checa banimento por IP antes de consumir recursos de autenticação;
 * - cada violação de rate limit em login/MFA aumenta o score de abuso;
 * - reincidência causa ban progressivo distribuído.
 */
export async function checkRateLimit(key, limit = 10, windowMs = 60000) {
  const safeLimit = Math.max(1, Math.min(10000, Number(limit) || 10));
  const safeWindow = Math.max(1000, Math.min(24 * 60 * 60 * 1000, Number(windowMs) || 60000));
  const now = Date.now();
  const windowStart = Math.floor(now / safeWindow) * safeWindow;
  const expiresAt = windowStart + safeWindow;
  const bucket = bucketId(String(key || 'anonymous'), windowStart, safeWindow);
  const conn = String(process.env.DATABASE_URL || '').trim();
  const securityIp = securityIpFromRateKey(key);

  if (!conn) return fallbackCheck(String(key), safeLimit, safeWindow);

  try {
    const sql = neon(conn);

    if (securityIp) {
      const ban = await checkIpBan(sql, securityIp);
      if (ban.blocked) {
        return {
          allowed: false,
          remaining: 0,
          resetMs: Number.isFinite(Number(ban.retryAfterMs)) ? Number(ban.retryAfterMs) : safeWindow,
          distributed: true,
          banned: true,
          permanent: Boolean(ban.permanent),
          banLevel: Number(ban.banLevel || 0),
          reason: ban.reason || 'ip_banned'
        };
      }
    }

    const rows = await sql`
      INSERT INTO api_rate_limits (bucket_key, window_start, count, expires_at)
      VALUES (${bucket}, ${new Date(windowStart).toISOString()}, 1, ${new Date(expiresAt).toISOString()})
      ON CONFLICT (bucket_key) DO UPDATE
      SET count = api_rate_limits.count + 1
      RETURNING count, expires_at;
    `;
    const count = Number(rows[0]?.count || 1);

    if (Math.random() < 0.01) {
      sql`DELETE FROM api_rate_limits WHERE expires_at < NOW() - INTERVAL '1 hour';`.catch(() => {});
    }

    const allowed = count <= safeLimit;

    if (!allowed && securityIp) {
      await recordIpFailure(sql, securityIp, {
        reason: 'rate_limit_exceeded',
        weight: 4,
        source: 'rate_limit',
        metadata: {
          bucket: String(key || '').slice(0, 160),
          limit: safeLimit,
          windowMs: safeWindow,
          count
        }
      });
    }

    return {
      allowed,
      remaining: Math.max(0, safeLimit - count),
      resetMs: Math.max(0, expiresAt - Date.now()),
      distributed: true
    };
  } catch (err) {
    console.warn('[RateLimit] Neon indisponível ou camada de segurança indisponível; usando fallback local:', err?.message || err);
    return fallbackCheck(String(key), Math.max(1, Math.floor(safeLimit * 0.8)), safeWindow);
  }
}

export function resetRateLimit(key) {
  localFallback.delete(key);
}
