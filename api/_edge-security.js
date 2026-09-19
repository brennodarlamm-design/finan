// api/_edge-security.js — Fail2Ban Global Distribuído no KV, Geo-Fencing & Idempotência Criptográfica
// Protege a borda contra ataques de força bruta, requisições repetidas e acessos de regiões não autorizadas.

import { getKvCache, setKvCache, deleteKvCache } from './_edge-kv.js';
import { dispatchEdgeAlert } from './_edge-alerts.js';

const MAX_FAILED_ATTEMPTS = 5;
const BAN_DURATION_SECONDS = 30 * 60; // 30 minutos de banimento
const ATTEMPTS_WINDOW_SECONDS = 10 * 60; // Janela de 10 minutos
const IDEMPOTENCY_TTL_SECONDS = 120; // 2 minutos de proteção contra duplo clique

const localFailStore = new Map();
const localBanStore = new Map();
const localIdempotencyStore = new Map();

/**
 * Normaliza o IP do cliente a partir dos headers de borda.
 */
export function getClientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

/**
 * Verifica se o IP está banido globalmente pelo Fail2Ban.
 */
export async function isIpBanned(env, ip) {
  const normIp = String(ip).trim();
  const banKey = `ban:${normIp}`;

  // 1. Consulta no Cloudflare KV
  const kvBan = await getKvCache(env, banKey);
  if (kvBan) return true;

  // 2. Consulta no espelho local em memória
  const localBan = localBanStore.get(normIp);
  if (localBan && Date.now() < localBan.expiresAt) {
    return true;
  }

  return false;
}

/**
 * Registra uma tentativa falha de autenticação ou ação suspeita por IP.
 */
export async function recordFailedAttempt(env, ip, reason = 'auth_failed') {
  const normIp = String(ip).trim();
  const attemptsKey = `attempts:${normIp}`;

  // Recupera contagem atual
  let currentAttempts = (await getKvCache(env, attemptsKey)) || localFailStore.get(normIp) || 0;
  currentAttempts += 1;

  localFailStore.set(normIp, currentAttempts);
  await setKvCache(env, attemptsKey, currentAttempts, ATTEMPTS_WINDOW_SECONDS);

  // Se atingiu o limite de 5 falhas, aplica banimento global
  if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
    const banKey = `ban:${normIp}`;
    const banData = {
      bannedAt: new Date().toISOString(),
      reason,
      attempts: currentAttempts,
      expiresAt: Date.now() + BAN_DURATION_SECONDS * 1000
    };

    await setKvCache(env, banKey, banData, BAN_DURATION_SECONDS);
    localBanStore.set(normIp, { ...banData, expiresAt: Date.now() + BAN_DURATION_SECONDS * 1000 });

    // Dispara alerta operacional
    await dispatchEdgeAlert(env, {
      type: 'SECURITY_FAIL2BAN_TRIGGERED',
      severity: 'WARNING',
      title: `IP Bloqueado por Força Bruta: ${normIp}`,
      message: `O IP atingiu ${currentAttempts} falhas consecutivas e foi banido na borda por ${BAN_DURATION_SECONDS / 60} minutos. Motivo: ${reason}`,
      details: { ip: normIp, reason, attempts: currentAttempts }
    });

    return { banned: true, attempts: currentAttempts };
  }

  return { banned: false, attempts: currentAttempts, remaining: MAX_FAILED_ATTEMPTS - currentAttempts };
}

/**
 * Limpa o histórico de falhas ao obter autenticação bem-sucedida.
 */
export async function recordSuccessfulAuth(env, ip) {
  const normIp = String(ip).trim();
  localFailStore.delete(normIp);
  await deleteKvCache(env, `attempts:${normIp}`);
}

/**
 * Remove manualmente o banimento de um IP.
 */
export async function unbanIp(env, ip) {
  const normIp = String(ip).trim();
  localBanStore.delete(normIp);
  localFailStore.delete(normIp);
  await deleteKvCache(env, `ban:${normIp}`);
  await deleteKvCache(env, `attempts:${normIp}`);
}

/**
 * Garante idempotência para evitar cliques duplos em transações e lançamentos.
 */
export async function checkAndSetIdempotency(env, idempotencyKey, payload) {
  if (!idempotencyKey) return { isDuplicate: false };

  const normKey = `idempotency:${String(idempotencyKey).trim()}`;
  const existing = await getKvCache(env, normKey) || localIdempotencyStore.get(normKey);

  if (existing) {
    return {
      isDuplicate: true,
      firstProcessedAt: existing.createdAt,
      result: existing.result
    };
  }

  const record = {
    createdAt: new Date().toISOString(),
    payloadHash: typeof payload === 'string' ? payload : JSON.stringify(payload || {})
  };

  localIdempotencyStore.set(normKey, record);
  await setKvCache(env, normKey, record, IDEMPOTENCY_TTL_SECONDS);

  return { isDuplicate: false };
}

/**
 * Valida a geolocalização da requisição (Geo-Fencing).
 */
export function checkGeoFencing(request, allowedCountries = ['BR']) {
  const country = (request.headers.get('cf-ipcountry') || 'BR').toUpperCase();
  if (country === 'XX' || country === 'T1') {
    // Código de Tor ou rede anônima
    return { allowed: false, country, reason: 'Tor / Anonymous Proxy detected' };
  }
  const isAllowed = allowedCountries.includes(country);
  return { allowed: isAllowed, country };
}

/**
 * Middleware de Segurança Executado no Edge Gateway.
 */
export async function applyEdgeSecurityMiddleware(request, env) {
  const ip = getClientIp(request);

  // 1. Verifica se o IP está bloqueado pelo Fail2Ban
  if (await isIpBanned(env, ip)) {
    return Response.json({
      success: false,
      error: 'Acesso temporariamente bloqueado por excesso de tentativas incorretas.',
      code: 'IP_BLOCKED_FAIL2BAN'
    }, {
      status: 429,
      headers: {
        'Retry-After': '1800',
        'X-FinGo-Security': 'fail2ban-blocked'
      }
    });
  }

  // 2. Proteção de Idempotência para mutações financeiras
  const idempotencyHeader = request.headers.get('x-idempotency-key');
  if (idempotencyHeader && ['POST', 'PUT', 'DELETE'].includes(request.method)) {
    const check = await checkAndSetIdempotency(env, idempotencyHeader, request.url);
    if (check.isDuplicate) {
      return Response.json({
        success: false,
        error: 'Requisição duplicada já processada (proteção anti-duplo clique).',
        code: 'DUPLICATE_REQUEST_IDEMPOTENT',
        firstProcessedAt: check.firstProcessedAt
      }, {
        status: 409,
        headers: {
          'X-FinGo-Idempotency': 'duplicate-blocked'
        }
      });
    }
  }

  return null; // Prossegue normalmente
}
