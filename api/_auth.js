// api/_auth.js — Utilitários de Autenticação Segura, Hashing scrypt e Multi-Tenancy

import crypto from 'crypto';

/**
 * Gera um hash seguro para senha usando scrypt com salt aleatório de 16 bytes.
 * Formato retornado: <salt_hex>:<hash_hex>
 */
export function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Senha inválida para hashing');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Valida uma senha em texto claro contra o hash scrypt armazenado de forma segura contra timing attacks.
 */
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
  } catch (err) {
    return false;
  }
}

/**
 * Assina um token de sessão HMAC-SHA256 (JWT-like) com chave secreta do servidor.
 */
export function signToken(payload, secret) {
  const encHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encHeader}.${encPayload}`)
    .digest('base64url');
  return `${encHeader}.${encPayload}.${signature}`;
}

/**
 * Valida a assinatura de um token e seu tempo de expiração.
 */
export function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, signature] = parts;
  try {
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${encHeader}.${encPayload}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(encPayload, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Token expirado
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Resolve e valida autenticação e tenant do request:
 * - Se for API_SECRET direta (serviço interno / powershell / cron):
 *   Usa tenant do header 'x-tenant-id' ou 'angelim' como padrão.
 * - Se for token de sessão assinado:
 *   Extrai e valida tenantId cryptograficamente contido no token.
 */
export function resolveAuthAndTenant(req) {
  const secret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();
  if (!secret) {
    console.error('🚨 [Segurança] API_SECRET não configurado no ambiente.');
    return { authenticated: false, error: 'Configuração de segurança pendente no servidor.' };
  }

  // 1. Extrai credencial de headers ou query
  let rawToken = '';
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    rawToken = authHeader.substring(7).trim();
  } else if (req.headers['x-api-key'] || req.headers['apikey']) {
    rawToken = (req.headers['x-api-key'] || req.headers['apikey']).trim();
  } else if (req.query && req.query.secret) {
    rawToken = req.query.secret.trim();
  }

  if (!rawToken) {
    return { authenticated: false, error: 'Token ou chave de acesso não fornecida.' };
  }

  // 2. Verifica se é a chave mestra de sistema (API_SECRET)
  if (rawToken === secret) {
    const explicitTenant = (req.headers['x-tenant-id'] || (req.query && req.query.tenant_id) || 'angelim').toString().trim();
    return {
      authenticated: true,
      isSystem: true,
      tenantId: explicitTenant || 'angelim',
      user: { id: 'system', username: 'system', perfil: 'superadmin', tenantId: explicitTenant || 'angelim' }
    };
  }

  // 3. Verifica se é um token de sessão HMAC assinado
  const payload = verifyToken(rawToken, secret);
  if (payload && payload.tenantId) {
    if (payload.tenantStatus === 'bloqueado' || payload.tenantStatus === 'cancelado') {
      return {
        authenticated: false,
        status: 403,
        error: 'Acesso bloqueado para esta empresa. Contate o suporte FinObra.'
      };
    }

    // Se o usuário autenticado for superadmin, permite inspecionar outro tenant quando explicitamente informado via 'x-tenant-id' (suporte / impersonate)
    const isSuperAdminUser = payload.perfil === 'superadmin' || payload.username === 'admin';
    const explicitTenant = (req.headers['x-tenant-id'] || (req.query && req.query.tenant_id) || '').toString().trim();
    const effectiveTenantId = (isSuperAdminUser && explicitTenant) ? explicitTenant : payload.tenantId;

    return {
      authenticated: true,
      isSystem: false,
      tenantId: effectiveTenantId,
      user: payload
    };
  }

  return { authenticated: false, error: 'Token de autenticação inválido ou expirado.' };
}
