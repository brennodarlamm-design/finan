// api/_auth.js — Autenticação segura, hashing scrypt e autorização multi-tenant com validação online

import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';

export function hashPassword(password) {
  if (!password || typeof password !== 'string') throw new Error('Senha inválida para hashing');
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  try {
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export function signToken(payload, secret) {
  const encHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${encHeader}.${encPayload}`).digest('base64url');
  return `${encHeader}.${encPayload}.${signature}`;
}

export function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, signature] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', secret).update(`${encHeader}.${encPayload}`).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const payload = JSON.parse(Buffer.from(encPayload, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  const raw = String(req.headers?.cookie || '');
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    try { return decodeURIComponent(part.slice(idx + 1).trim()); } catch { return part.slice(idx + 1).trim(); }
  }
  return '';
}

function allowedBrowserOrigins(req) {
  const origins = new Set([
    'https://finobra.app.br',
    'https://www.finobra.app.br',
    'http://localhost:3000',
    'http://localhost:3333',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3333',
    'http://127.0.0.1:5000'
  ]);
  for (const v of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    const host = String(v || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (host) origins.add(`https://${host}`);
  }
  const host = String(req.headers?.host || '').trim();
  if (host) {
    origins.add(`https://${host}`);
    origins.add(`http://${host}`);
  }
  return origins;
}

function getCredential(req) {
  // Patch 10: cookie HttpOnly é a credencial primária. Bearer/x-api-key permanecem
  // somente para compatibilidade com integrações e sessões legadas.
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return { value: authHeader.substring(7).trim(), source: 'bearer' };
  }
  const key = req.headers['x-api-key'] || req.headers.apikey || '';
  if (typeof key === 'string' && key.trim()) return { value: key.trim(), source: 'apikey' };
  const cookie = getCookie(req, 'finobra_session_token');
  return cookie ? { value: cookie, source: 'cookie' } : { value: '', source: 'none' };
}

function cookieMutationOriginAllowed(req) {
  const method = String(req.method || 'GET').toUpperCase();
  if (['GET','HEAD','OPTIONS'].includes(method)) return true;
  const origin = String(req.headers?.origin || '').trim();
  if (!origin) return false;
  return allowedBrowserOrigins(req).has(origin);
}

function trialExpired(createdAt, trialDays = 15, explicitDueDate = null) {
  if (explicitDueDate) {
    const due = new Date(String(explicitDueDate).slice(0, 10) + 'T23:59:59-04:00').getTime();
    if (Number.isFinite(due)) return Date.now() > due;
  }
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() > created + trialDays * 24 * 60 * 60 * 1000;
}

/**
 * Resolve autenticação e tenant com verificação ONLINE no Neon.
 * Isso faz bloqueio, cancelamento, expiração de trial, desativação de usuário
 * e alteração de perfil surtirem efeito imediatamente, sem esperar o token expirar.
 *
 * Segurança:
 * - superadmin é definido EXCLUSIVAMENTE por perfil='superadmin' no banco;
 * - username nunca concede privilégio;
 * - tenant informado pelo cliente só é aceito para superadmin ou chave interna;
 * - API_SECRET não é aceito por query string (evita vazamento em URL/logs).
 */
export async function resolveAuthAndTenant(req) {
  const secret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();
  if (!secret) {
    console.error('🚨 [Segurança] API_SECRET não configurado no ambiente.');
    return { authenticated: false, status: 500, error: 'Configuração de segurança pendente no servidor.' };
  }

  const credential = getCredential(req);
  const rawToken = credential.value;
  if (!rawToken) {
    return { authenticated: false, status: 401, error: 'Sessão ou chave de acesso não fornecida.' };
  }

  // Com autenticação por cookie, mutações exigem Origin same-site. Isso acrescenta
  // uma camada explícita contra CSRF além de SameSite=Lax. Integrações Bearer/API key
  // não dependem de Origin e continuam funcionando server-to-server.
  if (credential.source === 'cookie' && !cookieMutationOriginAllowed(req)) {
    return { authenticated:false, status:403, error:'Origem da requisição não autorizada.' };
  }

  // Chave interna para jobs/cron. Nunca deve existir no frontend.
  if (rawToken === secret) {
    // Chaves internas nunca assumem uma empresa padrão. Isso evita que um job mal
    // configurado leia/grave acidentalmente no tenant histórico da plataforma.
    const explicitTenant = String(req.headers['x-tenant-id'] || '').trim();
    if (!explicitTenant) {
      return { authenticated:false, status:400, error:'Cabeçalho x-tenant-id obrigatório para acesso interno.' };
    }
    return {
      authenticated: true,
      isSystem: true,
      tenantId: explicitTenant,
      user: { id: 'system', userId: 'system', username: 'system', perfil: 'superadmin', tenantId: explicitTenant }
    };
  }

  const payload = verifyToken(rawToken, secret);
  if (!payload?.userId || !payload?.tenantId) {
    return { authenticated: false, status: 401, error: 'Token de autenticação inválido ou expirado.' };
  }

  const conn = process.env.DATABASE_URL;
  if (!conn) {
    console.error('🚨 [Segurança] DATABASE_URL não configurada para validação da sessão.');
    return { authenticated: false, status: 500, error: 'Banco de autenticação indisponível.' };
  }

  try {
    const sql = neon(conn);
    const rows = await sql`
      SELECT
        u.id, u.username, u.email, u.nome, u.perfil, u.avatar, u.ativo, u.tenant_id, u.permissoes,
        t.nome_fantasia, t.razao_social, t.plano, t.status AS tenant_status, t.created_at AS tenant_created_at, t.vencimento AS tenant_vencimento
      FROM usuarios u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = ${payload.userId}
      LIMIT 1;
    `;

    if (!rows.length || !rows[0].ativo) {
      return { authenticated: false, status: 403, error: 'Usuário inexistente ou desativado.' };
    }

    const live = rows[0];
    const isSuperAdmin = live.perfil === 'superadmin';

    // Patch 08: sessões novas são revogáveis por dispositivo. Tokens legados sem
    // sessionId continuam válidos até expirar para não derrubar usuários no deploy.
    if (payload.sessionId) {
      const sessionRows = await sql`
        SELECT id, revoked_at, expires_at
        FROM auth_sessions
        WHERE id=${payload.sessionId} AND user_id=${payload.userId}
        LIMIT 1;
      `;
      const sess = sessionRows[0];
      if (!sess || sess.revoked_at || !sess.expires_at || new Date(sess.expires_at).getTime() <= Date.now()) {
        return { authenticated:false, status:401, error:'Esta sessão foi encerrada ou expirou. Entre novamente.' };
      }
      // Atualiza atividade no máximo a cada 15 minutos para reduzir escrita no Neon.
      sql`UPDATE auth_sessions SET last_seen_at=NOW() WHERE id=${payload.sessionId} AND last_seen_at < NOW() - INTERVAL '15 minutes';`.catch(() => {});
    }

    if (!isSuperAdmin) {
      if (live.tenant_status === 'bloqueado' || live.tenant_status === 'cancelado') {
        return { authenticated: false, status: 403, error: 'Acesso bloqueado para esta empresa. Contate o suporte FinObra.' };
      }
      if (live.tenant_status === 'trial' && trialExpired(live.tenant_created_at, 15, live.tenant_vencimento)) {
        return { authenticated: false, status: 403, error: 'O período de teste gratuito de 15 dias expirou. Regularize o plano para continuar.' };
      }
    }

    const requestedTenant = String(req.headers['x-tenant-id'] || '').trim();
    let effectiveTenantId = live.tenant_id;

    if (isSuperAdmin && payload.impersonated && payload.tenantId) {
      effectiveTenantId = payload.tenantId;
    }

    if (isSuperAdmin && requestedTenant) {
      const target = await sql`SELECT id FROM tenants WHERE id = ${requestedTenant} LIMIT 1;`;
      if (!target.length) {
        return { authenticated: false, status: 404, error: 'Tenant solicitado não encontrado.' };
      }
      effectiveTenantId = requestedTenant;
    }

    let targetTenantInfo = {
      nome_fantasia: live.nome_fantasia,
      razao_social: live.razao_social,
      plano: live.plano,
      tenant_status: live.tenant_status,
      vencimento: live.tenant_vencimento
    };

    if (effectiveTenantId !== live.tenant_id) {
      const targetRows = await sql`
        SELECT nome_fantasia, razao_social, plano, status, vencimento
        FROM tenants 
        WHERE id = ${effectiveTenantId} 
        LIMIT 1;
      `;
      if (targetRows.length) {
        targetTenantInfo = {
          nome_fantasia: targetRows[0].nome_fantasia,
          razao_social: targetRows[0].razao_social,
          plano: targetRows[0].plano,
          tenant_status: targetRows[0].status,
          vencimento: targetRows[0].vencimento
        };
      }
    }

    return {
      authenticated: true,
      isSystem: false,
      tenantId: effectiveTenantId,
      user: {
        ...payload,
        id: live.id,
        userId: live.id,
        username: live.username,
        email: live.email,
        nome: live.nome,
        perfil: live.perfil,
        avatar: live.avatar || (live.nome || 'US').slice(0, 2).toUpperCase(),
        tenantId: effectiveTenantId,
        realTenantId: live.tenant_id,
        isImpersonated: effectiveTenantId !== live.tenant_id,
        tenantStatus: targetTenantInfo.tenant_status,
        tenantPlan: targetTenantInfo.plano,
        tenantVencimento: targetTenantInfo.vencimento ? String(targetTenantInfo.vencimento).slice(0, 10) : '',
        empresaNome: targetTenantInfo.nome_fantasia || targetTenantInfo.razao_social || payload.empresaNome || 'Minha Empresa',
        permissions: (live.permissoes && typeof live.permissoes === 'object') ? live.permissoes : {},
        sessionId: payload.sessionId || ''
      }
    };
  } catch (err) {
    console.error('[Auth] Falha ao validar sessão no banco:', err.message);
    return { authenticated: false, status: 503, error: 'Não foi possível validar a sessão no momento.' };
  }
}
