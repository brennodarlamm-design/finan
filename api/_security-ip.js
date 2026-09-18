// api/_security-ip.js — Defesa distribuída contra brute force e abuso por IP
// Patch 56: Fail2Ban lógico para Vercel/Cloudflare/Render, sem depender de daemon local.

import crypto from 'crypto';

const DEFAULT_WEIGHTS = Object.freeze({
  invalid_password: 1,
  mfa_invalid: 2,
  rate_limit_exceeded: 4,
  invalid_session: 4,
  invalid_webhook: 5,
  cross_tenant_attempt: 8,
  malicious_upload: 10,
  path_traversal: 10,
  sql_injection_probe: 15
});

function isProduction() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function normalizeIp(value = '') {
  let ip = String(value || '').trim().toLowerCase();
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip.startsWith('[') && ip.includes(']')) ip = ip.slice(1, ip.indexOf(']'));
  return ip.slice(0, 80);
}

export function getTrustedClientIp(req) {
  const headers = req?.headers || {};

  // Vercel: prioriza headers definidos pela própria plataforma.
  if (process.env.VERCEL || headers['x-vercel-id']) {
    const vercelForwarded = String(headers['x-vercel-forwarded-for'] || '').trim();
    if (vercelForwarded) return normalizeIp(vercelForwarded.split(',')[0]);
    const real = String(headers['x-real-ip'] || '').trim();
    if (real) return normalizeIp(real);
    const forwarded = String(headers['x-forwarded-for'] || '').trim();
    if (forwarded) return normalizeIp(forwarded.split(',')[0]);
  }

  // Cloudflare: CF-Connecting-IP é a origem canônica quando a requisição passou pela edge.
  if (headers['cf-ray'] && headers['cf-connecting-ip']) {
    return normalizeIp(headers['cf-connecting-ip']);
  }

  const real = String(headers['x-real-ip'] || '').trim();
  if (real) return normalizeIp(real);

  // Fallback para ambientes locais/proxy controlado.
  const socketIp = normalizeIp(req?.socket?.remoteAddress || '');
  if (socketIp) return socketIp;

  const forwarded = String(headers['x-forwarded-for'] || '').trim();
  if (forwarded) return normalizeIp(forwarded.split(',')[0]);

  return '127.0.0.1';
}

export function getIpBanPepper(customPepper) {
  const value = String(customPepper || process.env.IP_BAN_PEPPER || '').trim();
  if (value) {
    if (value.length < 32) throw new Error('IP_BAN_PEPPER deve possuir pelo menos 32 caracteres.');
    return value;
  }

  // Em produção o mecanismo é fail-closed: banimento sem pepper dedicado não opera.
  if (isProduction()) {
    throw new Error('IP_BAN_PEPPER não configurado em produção.');
  }

  // Desenvolvimento pode reutilizar SESSION_SIGNING_SECRET, sem fallback hardcoded.
  const devFallback = String(process.env.SESSION_SIGNING_SECRET || '').trim();
  if (devFallback.length >= 32) return devFallback;
  return null;
}

export function hashIp(ip, customPepper) {
  const normalized = normalizeIp(ip);
  if (!normalized) return '';
  const pepper = getIpBanPepper(customPepper);
  if (!pepper) return '';
  return crypto.createHmac('sha256', pepper).update(normalized, 'utf8').digest('hex');
}

export function reasonWeight(reason, explicitWeight) {
  if (Number.isFinite(Number(explicitWeight))) {
    return Math.max(1, Math.min(20, Number(explicitWeight)));
  }
  return DEFAULT_WEIGHTS[String(reason || '').trim()] || 1;
}

function banProfile(score) {
  if (score >= 40) return { level: 4, seconds: 24 * 60 * 60 };
  if (score >= 25) return { level: 3, seconds: 6 * 60 * 60 };
  if (score >= 15) return { level: 2, seconds: 30 * 60 };
  if (score >= 8) return { level: 1, seconds: 5 * 60 };
  return null;
}

function isUndefinedTable(err) {
  return err?.code === '42P01' || /does not exist/i.test(String(err?.message || ''));
}

export async function checkIpBan(sql, ip, { customPepper } = {}) {
  let ipHash = '';
  try {
    ipHash = hashIp(ip, customPepper);
  } catch (err) {
    console.warn('[SecurityIP] Pepper indisponível para checagem de IP:', err?.message || err);
    return { blocked: false, reason: 'security_ip_unavailable' };
  }
  if (!sql || !ipHash) return { blocked: false, reason: 'security_ip_unavailable' };

  try {
    const allowed = await sql`
      SELECT ip_hash
      FROM security_ip_allowlist
      WHERE ip_hash = ${ipHash} AND enabled = TRUE
      LIMIT 1;
    `;
    if (allowed.length) return { blocked: false, allowlisted: true, ipHash };

    const rows = await sql`
      SELECT ip_hash, permanent, blocked_until, ban_level, ban_count, last_reason
      FROM security_ip_state
      WHERE ip_hash = ${ipHash}
      LIMIT 1;
    `;
    if (!rows.length) return { blocked: false, ipHash };

    const row = rows[0];
    const until = row.blocked_until ? new Date(row.blocked_until).getTime() : 0;
    const blocked = Boolean(row.permanent) || until > Date.now();
    return {
      blocked,
      permanent: Boolean(row.permanent),
      retryAfterMs: blocked && !row.permanent ? Math.max(0, until - Date.now()) : null,
      banLevel: Number(row.ban_level || 0),
      banCount: Number(row.ban_count || 0),
      reason: row.last_reason || null,
      ipHash
    };
  } catch (err) {
    if (isUndefinedTable(err)) return { blocked: false, reason: 'migration_pending', ipHash };
    console.error('[SecurityIP] Falha ao consultar banimento:', err?.message || err);
    return { blocked: false, reason: 'ban_check_error', ipHash };
  }
}

export async function recordIpFailure(sql, ip, options = {}) {
  const normalizedIp = normalizeIp(ip);
  let ipHash = '';
  try {
    ipHash = hashIp(normalizedIp, options.customPepper);
  } catch (err) {
    console.warn('[SecurityIP] Pepper indisponível para registro de falha de IP:', err?.message || err);
    return { recorded: false, reason: 'security_ip_unavailable' };
  }
  if (!sql || !ipHash) return { recorded: false, reason: 'security_ip_unavailable' };

  const reason = String(options.reason || 'security_failure').slice(0, 80);
  const source = String(options.source || 'application').slice(0, 80);
  const weight = reasonWeight(reason, options.weight);
  const metadata = options.metadata && typeof options.metadata === 'object' ? options.metadata : {};

  try {
    const allowlisted = await sql`
      SELECT 1 FROM security_ip_allowlist WHERE ip_hash = ${ipHash} AND enabled = TRUE LIMIT 1;
    `;
    if (allowlisted.length) {
      return { recorded: false, allowlisted: true, ipHash };
    }

    const rows = await sql`
      INSERT INTO security_ip_state (
        ip_hash, failure_score, failure_count, first_failure_at, last_failure_at, last_reason, last_source
      ) VALUES (
        ${ipHash}, ${weight}, 1, NOW(), NOW(), ${reason}, ${source}
      )
      ON CONFLICT (ip_hash) DO UPDATE SET
        failure_score = CASE
          WHEN security_ip_state.last_failure_at < NOW() - INTERVAL '60 minutes' THEN ${weight}
          ELSE LEAST(1000, security_ip_state.failure_score + ${weight})
        END,
        failure_count = CASE
          WHEN security_ip_state.last_failure_at < NOW() - INTERVAL '24 hours' THEN 1
          ELSE security_ip_state.failure_count + 1
        END,
        last_failure_at = NOW(),
        last_reason = ${reason},
        last_source = ${source},
        updated_at = NOW()
      RETURNING failure_score, failure_count, blocked_until, permanent, ban_level, ban_count;
    `;

    const state = rows[0] || {};
    const score = Number(state.failure_score || weight);
    const profile = banProfile(score);
    let ban = null;

    if (profile && !state.permanent) {
      const banRows = await sql`
        UPDATE security_ip_state
        SET blocked_until = GREATEST(
              COALESCE(blocked_until, NOW()),
              NOW() + (${profile.seconds} * INTERVAL '1 second')
            ),
            ban_level = GREATEST(COALESCE(ban_level, 0), ${profile.level}),
            ban_count = COALESCE(ban_count, 0) + CASE
              WHEN blocked_until IS NULL OR blocked_until <= NOW() THEN 1 ELSE 0 END,
            updated_at = NOW()
        WHERE ip_hash = ${ipHash}
        RETURNING blocked_until, ban_level, ban_count;
      `;
      ban = banRows[0] || null;
    }

    await sql`
      INSERT INTO security_ip_events (ip_hash, event_type, reason, source, weight, metadata, created_at)
      VALUES (
        ${ipHash},
        ${ban ? 'ip_banned' : 'failure_recorded'},
        ${reason},
        ${source},
        ${weight},
        ${JSON.stringify(metadata)}::jsonb,
        NOW()
      );
    `;

    return {
      recorded: true,
      ipHash,
      score,
      failureCount: Number(state.failure_count || 1),
      banned: Boolean(ban),
      blockedUntil: ban?.blocked_until || state.blocked_until || null,
      banLevel: Number(ban?.ban_level || state.ban_level || 0),
      banCount: Number(ban?.ban_count || state.ban_count || 0)
    };
  } catch (err) {
    if (isUndefinedTable(err)) return { recorded: false, reason: 'migration_pending', ipHash };
    console.error('[SecurityIP] Falha ao registrar evento:', err?.message || err);
    return { recorded: false, reason: 'record_error', ipHash };
  }
}

export async function clearIpFailureScore(sql, ip, { customPepper } = {}) {
  const ipHash = hashIp(ip, customPepper);
  if (!sql || !ipHash) return false;
  try {
    await sql`
      UPDATE security_ip_state
      SET failure_score = GREATEST(0, failure_score - 2), updated_at = NOW()
      WHERE ip_hash = ${ipHash} AND permanent = FALSE;
    `;
    return true;
  } catch (err) {
    if (!isUndefinedTable(err)) console.warn('[SecurityIP] Falha ao reduzir score:', err?.message || err);
    return false;
  }
}
