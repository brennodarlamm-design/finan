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
  if (localFailStore.size > 2000) {
    const oldestKey = localFailStore.keys().next().value;
    if (oldestKey) localFailStore.delete(oldestKey);
  }
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
    if (localBanStore.size > 2000) {
      const oldestKey = localBanStore.keys().next().value;
      if (oldestKey) localBanStore.delete(oldestKey);
    }

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
  if (localIdempotencyStore.size > 3000) {
    const oldestKey = localIdempotencyStore.keys().next().value;
    if (oldestKey) localIdempotencyStore.delete(oldestKey);
  }
  await setKvCache(env, normKey, record, IDEMPOTENCY_TTL_SECONDS);

  return { isDuplicate: false };
}

const MCP_RATE_LIMIT = 120; // 120 requisições por minuto por IP
const MCP_WINDOW_MS = 60 * 1000;
const localMcpRateStore = new Map();

export const KNOWN_MALICIOUS_IPS = new Set([
  '34.38.113.44', // GCP Bélgica (scanner ativo automatizado detectado no tráfego)
  '35.240.58.49', // GCP Bélgica (scanner ativo de .env e sondas de mídia)
  '40.160.65.14', // Microsoft Azure (probes automatizados de credenciais)
  '185.110.9.30', // Scanner de vulnerabilidades conhecido
  '45.138.12.42'  // Scanner de vulnerabilidades conhecido
]);

export function isKnownMaliciousIp(ip) {
  const norm = String(ip || '').trim();
  if (KNOWN_MALICIOUS_IPS.has(norm)) return true;
  // Bloqueio de subnets de scanners persistentes em datacenters estrangeiros (GCP Bélgica e Azure):
  if (norm.startsWith('34.38.') || norm.startsWith('35.240.') || norm.startsWith('40.160.')) return true;
  return false;
}

export const MALICIOUS_PATH_PATTERNS = [
  // Arquivos .env e backups de ambiente em qualquer nível (.env, .env.old, .env.staging, /api/.env, /config/.env)
  /(?:^|\/)[\w.-]*\.env(?:\.[\w.-]+)?(?:\/|$)/i,
  // WordPress / CMS probes (wp-config, wp-includes, wp-admin, wp-content, xmlrpc.php)
  /(?:^|\/)(?:wp-config|wp-includes|wp-admin|wp-content|xmlrpc\.php)(?:\.[\w.-]+)?/i,
  // Controle de versão e dot-directories de configuração (.git, .svn, .hg, .vscode, .idea, .DS_Store, .bash_history, .ssh, .kube)
  /(?:^|\/)\.(?:git|svn|hg|vscode|idea|DS_Store|bash_history|zsh_history|ssh|kube)(?:\/|$)/i,
  // Configurações de nuvem e AWS expostas (.aws/config, .aws/credentials, etc.)
  /(?:^|\/)\.aws(?:\/|$)/i,
  // Backups, dumps e arquivos temporários perigosos (.bak, .old, .backup, .swp, dump.sql, backup.sql)
  /(?:\.bak|\.old|\.backup|\.swp|\.save|dump\.sql|backup\.sql)$/i,
  // Executáveis/scripts PHP (não utilizados na stack FinGo)
  /\.php(?:\d+)?$/i,
  // Scanners de painéis administrativos de banco / frameworks
  /(?:phpmyadmin|pma|myadmin|adminer|\/webdav|\/actuator|\/_ignition)/i,
  // Credenciais de infraestrutura / docker
  /(?:docker-compose\.ya?ml|Dockerfile|\.docker\/config\.json)/i
];

export const MALICIOUS_USER_AGENTS = [
  /brickbluebot/i,
  /nikto/i,
  /sqlmap/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /acunetix/i,
  /havij/i,
  /dirbuster/i,
  /gobuster/i,
  /wpscan/i,
  /agenstrybot/i,
  /cloud-crawler/i,
  /censys/i,
  /shodan/i
];

/**
 * Avalia se o caminho ou o User-Agent corresponde a um scanner de vulnerabilidades conhecido.
 */
export function isMaliciousProbe(pathname, userAgent = '') {
  const rawPath = String(pathname || '');
  let decodedPath = rawPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {}

  const targets = [rawPath, decodedPath];
  for (const path of targets) {
    for (const pattern of MALICIOUS_PATH_PATTERNS) {
      if (pattern.test(path)) {
        return { blocked: true, reason: 'malicious_path_probe', pattern: pattern.toString() };
      }
    }
  }

  const normUa = String(userAgent || '').trim();
  if (normUa) {
    for (const pattern of MALICIOUS_USER_AGENTS) {
      if (pattern.test(normUa)) {
        return { blocked: true, reason: 'malicious_user_agent', pattern: pattern.toString() };
      }
    }
  }

  return { blocked: false };
}

/**
 * Rate limit em memória para proteção de exaustão do endpoint MCP e SSE.
 */
export function checkMcpRateLimit(ip) {
  const normIp = String(ip || '127.0.0.1').trim();
  const now = Date.now();
  const windowStart = now - MCP_WINDOW_MS;
  const history = (localMcpRateStore.get(normIp) || []).filter(ts => ts > windowStart);
  if (history.length >= MCP_RATE_LIMIT) {
    return { allowed: false, remaining: 0, retryAfter: 60 };
  }
  history.push(now);
  localMcpRateStore.set(normIp, history);
  if (localMcpRateStore.size > 2000) {
    const oldestKey = localMcpRateStore.keys().next().value;
    if (oldestKey) localMcpRateStore.delete(oldestKey);
  }
  return { allowed: true, remaining: MCP_RATE_LIMIT - history.length };
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

  // 1. Bloqueio imediato de IPs com reputação maliciosa conhecida (scanners ativos)
  if (isKnownMaliciousIp(ip)) {
    return Response.json({
      success: false,
      error: 'Acesso bloqueado por reputação de segurança de borda.',
      code: 'EDGE_IP_BANNED'
    }, {
      status: 403,
      headers: {
        'X-FinGo-Security': 'ip-reputation-blocked',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  // 2. Verifica se o IP está bloqueado pelo Fail2Ban
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

  // 3. Proteção contra Scanners e Probes Maliciosos (.env, wp-config, .git, bots ofensivos)
  let url = null;
  try {
    url = new URL(request.url);
  } catch {}
  const userAgent = request.headers.get('user-agent') || '';

  if (url) {
    const probe = isMaliciousProbe(url.pathname, userAgent);
    if (probe.blocked) {
      await recordFailedAttempt(env, ip, probe.reason);
      return Response.json({
        success: false,
        error: 'Acesso negado por política de segurança de borda.',
        code: 'EDGE_PROBE_BLOCKED'
      }, {
        status: 403,
        headers: {
          'X-FinGo-Security': 'probe-blocked',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }

    // 4. Rate limiting no endpoint do MCP e SSE
    if ((url.pathname === '/api/mcp' || url.pathname === '/mcp' || url.pathname === '/sse') && request.method !== 'OPTIONS') {
      const mcpRate = checkMcpRateLimit(ip);
      if (!mcpRate.allowed) {
        return Response.json({
          success: false,
          error: 'Limite de requisições excedido para o endpoint MCP / SSE.',
          code: 'MCP_RATE_LIMITED'
        }, {
          status: 429,
          headers: {
            'Retry-After': String(mcpRate.retryAfter || 60),
            'X-FinGo-Security': 'mcp-rate-limited'
          }
        });
      }
    }
  }

  // 5. Proteção de Idempotência para mutações financeiras
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
