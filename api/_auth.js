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

function getCredential(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const key = req.headers['x-api-key'] || req.headers.apikey || '';
  return typeof key === 'string' ? key.trim() : '';
}

function trialExpired(createdAt, trialDays = 15) {
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

  const rawToken = getCredential(req);
  if (!rawToken) {
    return { authenticated: false, status: 401, error: 'Token ou chave de acesso não fornecida.' };
  }

  // Chave interna para jobs/cron. Nunca deve existir no frontend.
  if (rawToken === secret) {
    const explicitTenant = String(req.headers['x-tenant-id'] || 'angelim').trim() || 'angelim';
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
        u.id, u.username, u.email, u.nome, u.perfil, u.avatar, u.ativo, u.tenant_id,
        t.nome_fantasia, t.razao_social, t.plano, t.status AS tenant_status, t.created_at AS tenant_created_at
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

    if (!isSuperAdmin) {
      if (live.tenant_status === 'bloqueado' || live.tenant_status === 'cancelado') {
        return { authenticated: false, status: 403, error: 'Acesso bloqueado para esta empresa. Contate o suporte FinObra.' };
      }
      if (live.tenant_status === 'trial' && trialExpired(live.tenant_created_at, 15)) {
        return { authenticated: false, status: 403, error: 'O período de teste gratuito de 15 dias expirou. Regularize o plano para continuar.' };
      }
    }

    const requestedTenant = String(req.headers['x-tenant-id'] || '').trim();
    let effectiveTenantId = live.tenant_id;

    if (isSuperAdmin && requestedTenant) {
      const target = await sql`SELECT id FROM tenants WHERE id = ${requestedTenant} LIMIT 1;`;
      if (!target.length) {
        return { authenticated: false, status: 404, error: 'Tenant solicitado não encontrado.' };
      }
      effectiveTenantId = requestedTenant;
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
        tenantId: live.tenant_id,
        tenantStatus: live.tenant_status,
        tenantPlan: live.plano,
        empresaNome: live.nome_fantasia || live.razao_social || payload.empresaNome || 'Minha Empresa'
      }
    };
  } catch (err) {
    console.error('[Auth] Falha ao validar sessão no banco:', err.message);
    return { authenticated: false, status: 503, error: 'Não foi possível validar a sessão no momento.' };
  }
}
