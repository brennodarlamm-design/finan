// api/auth.js — Endpoint Serverless de Autenticação Segura, Google OAuth e Recuperação de Senha

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { hashPassword, verifyPassword, signToken, verifyToken, resolveAuthAndTenant, getSessionSigningSecret, getInternalApiSecret } from './_auth.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';
import { writeAudit } from './_audit.js';
import { getPlanRule } from './_plans.js';
import {
  resolveTenantByAccessKey,
  resolveTenantUserByLogin,
  normalizeTenantAccessKey,
  isTenantAccessKeyShapeValid
} from './_tenant-access-key.js';
import {
  generateTotpSecret,
  verifyTotpCode,
  generateTotpUri,
  generateBackupCodes,
  verifyBackupCode,
  generateQrSvg,
  encryptMfaSecret,
  decryptMfaSecret
} from './_totp.js';
import { triggerEmail, isTriggerConfigured } from './_trigger-client.js';
import { createOwnerSql } from './_database.js';

const googleClient = new OAuth2Client();

function getSql() {
  return createOwnerSql();
}

const ALLOWED_ORIGINS = [
  'https://fingo.api.br',
  'https://www.fingo.api.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

function setCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin);
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey, x-tenant-id, x-finobra-token-mode');
}

const SESSION_COOKIE = 'finobra_session_token';

function cookieSecure(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return proto === 'https' || Boolean(process.env.VERCEL) || Boolean(process.env.FINOBRA_CANONICAL_ORIGIN?.startsWith('https'));
}

function setSessionCookie(req, res, token, expMs) {
  if (!token) return;
  const maxAge = Math.max(60, Math.floor((Number(expMs) - Date.now()) / 1000));
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`
  ];
  if (cookieSecure(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req, res) {
  const makeExpired = (name) => {
    const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
    if (cookieSecure(req)) parts.push('Secure');
    return parts.join('; ');
  };
  res.setHeader('Set-Cookie', [makeExpired(SESSION_COOKIE), makeExpired('finobra_master_restore_token')]);
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

function deviceNameFromUserAgent(ua='') {
  const s = String(ua || '').slice(0, 500);
  const os = /Windows/i.test(s) ? 'Windows' : /Android/i.test(s) ? 'Android' : /iPhone|iPad|iPod/i.test(s) ? 'iPhone/iPad' : /Mac OS|Macintosh/i.test(s) ? 'Mac' : /Linux/i.test(s) ? 'Linux' : 'Dispositivo';
  const browser = /Edg\//i.test(s) ? 'Edge' : /OPR\//i.test(s) ? 'Opera' : /Chrome\//i.test(s) ? 'Chrome' : /Firefox\//i.test(s) ? 'Firefox' : /Safari\//i.test(s) ? 'Safari' : 'Navegador';
  return `${browser} · ${os}`.slice(0, 160);
}

async function createAuthSession(sql, req, { userId, tenantId, remember, exp }) {
  const id = 'sess_' + crypto.randomBytes(16).toString('hex');
  const ua = String(req.headers['user-agent'] || '').slice(0, 1000);
  const ip = getClientIp(req).slice(0, 80);
  const expiresAt = new Date(exp).toISOString();
  await sql`
    INSERT INTO auth_sessions (id,user_id,tenant_id,device_name,user_agent,ip,remember,expires_at)
    VALUES (${id},${userId},${tenantId},${deviceNameFromUserAgent(ua)},${ua || null},${ip || null},${!!remember},${expiresAt});
  `;
  return id;
}

function permissionsOf(row) {
  return row?.permissoes && typeof row.permissoes === 'object' ? row.permissoes : {};
}

function tokenFieldForExplicitClient(req, token) {
  const mode = String(req.headers['x-finobra-token-mode'] || '').trim().toLowerCase();
  return mode === 'bearer' && token ? { token } : {};
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action || (req.body && req.body.action);

  // Patch 37: health público de release, sem DB/sessão e sem nova Serverless Function.
  if ((req.method === 'GET' || req.method === 'HEAD') && action === 'health') {
    const commit = String(
      process.env.FINOBRA_RELEASE_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      'unknown'
    ).trim();
    const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || null;
    const releaseReady = !!commit && commit !== 'unknown';
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).json({
      ok:true,
      service:'finobra-api',
      releaseReady,
      release:{
        commit,
        deploymentId,
        source: process.env.VERCEL === '1' ? 'vercel' : 'serverless',
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
      }
    });
  }

  const secret = getSessionSigningSecret();
  if (!secret) {
    console.error('🚨 [Auth] Segredo de assinatura de sessão não configurado.');
    return res.status(500).json({ success:false, error:'Configuração de segurança pendente no servidor.' });
  }

  try {
    const sql = getSql();

    // ── 1. GET /api/auth?action=me (Sessão atual do usuário autenticado) ─────────
    if (req.method === 'GET' && action === 'me') {
      const auth = await resolveAuthAndTenant(req);
      if (!auth.authenticated) {
        return res.status(auth.status || 401).json({ success: false, error: auth.error });
      }

      // Patch 10: ao validar uma sessão legada via Bearer, promove a mesma credencial
      // para cookie HttpOnly. O frontend pode então apagar o token persistente.
      const legacyAuthHeader = String(req.headers.authorization || req.headers.Authorization || '');
      if (legacyAuthHeader.startsWith('Bearer ')) {
        const legacyToken = legacyAuthHeader.slice(7).trim();
        const legacyPayload = decodeJwtPayload(legacyToken);
        if (legacyToken && legacyPayload?.exp && Number(legacyPayload.exp) > Date.now()) {
          setSessionCookie(req, res, legacyToken, Number(legacyPayload.exp));
        }
      }

      if (auth.isSystem) {
        return res.status(200).json({
          success: true,
          user: auth.user,
          tenant: { id: auth.tenantId, nome_fantasia: 'Sistema Interno' }
        });
      }

      const users = await sql`
        SELECT u.id, u.username, u.email, u.nome, u.perfil, u.avatar, u.tenant_id, u.permissoes, u.mfa_enabled,
               t.razao_social, t.nome_fantasia, t.cnpj, t.telefone, t.plano, t.status as tenant_status
        FROM usuarios u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE u.id = ${auth.user.userId} AND u.ativo = TRUE
        LIMIT 1;
      `;

      if (!users.length) {
        return res.status(404).json({ success: false, error: 'Usuário não encontrado ou inativo.' });
      }

      const u = users[0];
      const effectiveTenantId = auth.tenantId || u.tenant_id;
      let tenantData = {
        id: u.tenant_id,
        razao_social: u.razao_social,
        nome_fantasia: u.nome_fantasia,
        cnpj: u.cnpj,
        telefone: u.telefone,
        plano: u.plano,
        status: u.tenant_status
      };

      if (effectiveTenantId !== u.tenant_id) {
        const targetTenants = await sql`
          SELECT id, razao_social, nome_fantasia, cnpj, telefone, plano, status
          FROM tenants
          WHERE id = ${effectiveTenantId}
          LIMIT 1;
        `;
        if (targetTenants.length) {
          const t = targetTenants[0];
          tenantData = {
            id: t.id,
            razao_social: t.razao_social,
            nome_fantasia: t.nome_fantasia,
            cnpj: t.cnpj,
            telefone: t.telefone,
            plano: t.plano,
            status: t.status
          };
        }
      }

      // Patch 08: ao primeiro refresh, tokens legados ganham uma sessão revogável.
      // Preserva o tenant efetivo (inclusive impersonação Master) e a expiração original.
      let refreshedToken = '';
      let effectiveSessionId = auth.user.sessionId || '';
      if (!effectiveSessionId) {
        const legacyExp = Number(auth.user.exp) > Date.now() ? Number(auth.user.exp) : Date.now() + 2 * 24 * 60 * 60 * 1000;
        effectiveSessionId = await createAuthSession(sql, req, {
          userId: u.id,
          tenantId: u.tenant_id,
          remember: legacyExp - Date.now() > 3 * 24 * 60 * 60 * 1000,
          exp: legacyExp
        });
        refreshedToken = signToken({
          ...auth.user,
          userId: u.id,
          username: u.username, email: u.email, nome: u.nome, perfil: u.perfil,
          tenantId: effectiveTenantId, realTenantId: u.tenant_id,
          empresaNome: tenantData.nome_fantasia || tenantData.razao_social || 'Minha Empresa',
          avatar: u.avatar || u.nome.slice(0, 2).toUpperCase(),
          permissions: permissionsOf(u), sessionId: effectiveSessionId, exp: legacyExp
        }, secret);
      }

      if (refreshedToken) setSessionCookie(req, res, refreshedToken, Number(auth.user.exp) > Date.now() ? Number(auth.user.exp) : Date.now() + 2 * 24 * 60 * 60 * 1000);
      return res.status(200).json({
        success: true,
        ...tokenFieldForExplicitClient(req, refreshedToken),
        user: {
          id: u.id,
          username: u.username,
          email: u.email,
          nome: u.nome,
          perfil: u.perfil,
          avatar: u.avatar || u.nome.slice(0, 2).toUpperCase(),
          tenantId: effectiveTenantId,
          realTenantId: u.tenant_id,
          isImpersonated: effectiveTenantId !== u.tenant_id,
          empresaNome: tenantData.nome_fantasia || tenantData.razao_social || 'Minha Empresa',
          permissions: permissionsOf(u),
          sessionId: effectiveSessionId,
          mfa_enabled: Boolean(u.mfa_enabled),
          mfa_verified: Boolean(auth.user?.mfa_verified)
        },
        tenant: tenantData,
        // Abertura usa somente regras de acesso; contagens e cobrança ficam em /api/plano.
        plan: {
          ...getPlanRule(tenantData.plano),
          status: tenantData.status || 'trial'
        }
      });
    }

    // ── 2. POST /api/auth?action=login ──────────────────────────────────────────
    if (req.method === 'POST' && action === 'login') {
      const clientIp = getClientIp(req);

      // Camada 1 — Rate limit por IP (5 tentativas/minuto)
      const ipLimit = await checkRateLimit(`login:ip:${clientIp}`, 5, 60000);
      if (!ipLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Muitas tentativas de login. Aguarde 1 minuto antes de tentar novamente.'
        });
      }

      const {
        username,
        password,
        remember,
        company_key,
        access_key,
        accessKey
      } = req.body || {};

      const companyKey = String(access_key || company_key || accessKey || '').trim();

      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios.' });
      }

      const cleanUser = String(username || '').trim().toLowerCase();

      // Fingerprint da chave para o rate limiter — nunca a chave em texto puro.
      // Usa normalizeTenantAccessKey para consistência com o hash armazenado no banco.
      const normalizedKey = companyKey ? normalizeTenantAccessKey(companyKey) : '';
      const companyKeyFingerprint = normalizedKey
        ? crypto.createHash('sha256').update(normalizedKey).digest('hex').slice(0, 16)
        : 'master';

      // Camada 2 — Rate limit por IP + usuário + empresa (5 tentativas/minuto)
      const credentialLimit = await checkRateLimit(
        `login:credential:${clientIp}:${companyKeyFingerprint}:${cleanUser}`,
        5,
        60000
      );
      if (!credentialLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Muitas tentativas de login. Aguarde 1 minuto antes de tentar novamente.'
        });
      }

      // ── Resolução Master-first ────────────────────────────────────────────────
      // Superadmin não pertence a uma empresa cliente; não exige Chave da Empresa.
      const masterRows = await sql`
        SELECT
          u.id,
          u.username,
          u.email,
          u.senha_hash,
          u.nome,
          u.perfil,
          u.avatar,
          u.ativo,
          u.tenant_id,
          u.permissoes,
          u.mfa_secret,
          u.mfa_enabled,
          u.mfa_backup_codes,
          u.mfa_last_used_step,
          t.razao_social,
          t.nome_fantasia,
          t.status      AS tenant_status,
          t.created_at  AS tenant_created_at,
          t.vencimento  AS tenant_vencimento
        FROM usuarios u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE
          u.perfil = 'superadmin'
          AND (
            LOWER(u.username) = ${cleanUser}
            OR LOWER(u.email)  = ${cleanUser}
          )
        LIMIT 1;
      `;

      let rows;

      if (masterRows.length) {
        // Conta Master encontrada — segue pelo pipeline existente (senha + MFA)
        rows = masterRows;
      } else {
        // ── Fluxo empresarial: Chave da Empresa obrigatória ───────────────────
        if (!companyKey) {
          return res.status(400).json({
            success: false,
            message: 'Chave da Empresa é obrigatória.'
          });
        }

        // Rejeita formato inválido imediatamente (sem bater no banco)
        if (!isTenantAccessKeyShapeValid(companyKey)) {
          return res.status(401).json({
            success: false,
            message: 'Credenciais de acesso inválidas.'
          });
        }

        const tenant = await resolveTenantByAccessKey(sql, companyKey);
        if (!tenant) {
          return res.status(401).json({
            success: false,
            message: 'Credenciais de acesso inválidas.'
          });
        }

        const tenantUser = await resolveTenantUserByLogin(sql, tenant.id, cleanUser);
        if (!tenantUser) {
          return res.status(401).json({
            success: false,
            message: 'Credenciais de acesso inválidas.'
          });
        }

        rows = [tenantUser];
      }

      if (!rows.length) {
        return res.status(401).json({ success: false, message: 'Credenciais de acesso inválidas.' });
      }

      const user = rows[0];
      if (!user.ativo) {
        await writeAudit(sql, req, { tenantId: user.tenant_id, user: { id: user.id } }, { acao: 'login_bloqueado', entidade: 'auth', entidadeId: user.id, depois: { motivo: 'user_inactive', ip: clientIp } });
        return res.status(403).json({ success: false, message: 'Conta de usuário inativa. Contate o administrador.' });
      }

      // Aplicação estrita de regras de status do SaaS
      if (user.tenant_status === 'bloqueado') {
        await writeAudit(sql, req, { tenantId: user.tenant_id, user: { id: user.id } }, { acao: 'login_bloqueado', entidade: 'auth', entidadeId: user.id, depois: { motivo: 'tenant_blocked', ip: clientIp } });
        return res.status(403).json({
          success: false,
          message: 'Acesso bloqueado para esta empresa. Entre em contato com o suporte comercial FinGo.'
        });
      }
      if (user.tenant_status === 'cancelado') {
        await writeAudit(sql, req, { tenantId: user.tenant_id, user: { id: user.id } }, { acao: 'login_bloqueado', entidade: 'auth', entidadeId: user.id, depois: { motivo: 'tenant_canceled', ip: clientIp } });
        return res.status(403).json({
          success: false,
          message: 'Assinatura cancelada. Regularize seu plano para restabelecer o acesso ao sistema.'
        });
      }
      if (user.tenant_status === 'trial') {
        const due = user.tenant_vencimento ? new Date(String(user.tenant_vencimento).slice(0,10) + 'T23:59:59-04:00').getTime() : null;
        const created = user.tenant_created_at ? new Date(user.tenant_created_at).getTime() : null;
        const fallbackDue = created ? created + 15 * 24 * 60 * 60 * 1000 : null;
        if ((due && Date.now() > due) || (!due && fallbackDue && Date.now() > fallbackDue)) {
          await writeAudit(sql, req, { tenantId: user.tenant_id, user: { id: user.id } }, { acao: 'login_bloqueado', entidade: 'auth', entidadeId: user.id, depois: { motivo: 'trial_expired', ip: clientIp } });
          return res.status(403).json({ success:false, message:'Seu período de teste gratuito expirou. Faça o upgrade de plano para continuar.' });
        }
      }
      if (user.tenant_status === 'cancelamento_agendado' && user.tenant_vencimento) {
        const cancelDue = new Date(String(user.tenant_vencimento).slice(0,10) + 'T23:59:59-04:00').getTime();
        if (Number.isFinite(cancelDue) && Date.now() > cancelDue) {
          try {
            await sql`
              UPDATE tenants
              SET status='cancelado', updated_at=NOW()
              WHERE id=${user.tenant_id}
                AND status='cancelamento_agendado'
                AND vencimento < CURRENT_DATE;
            `;
          } catch (finalizeErr) {
            console.warn('[Auth Login] Falha ao materializar cancelamento vencido:', finalizeErr?.message || finalizeErr);
          }
          await writeAudit(sql, req, { tenantId:user.tenant_id, user:{ id:user.id } }, { acao:'login_bloqueado', entidade:'auth', entidadeId:user.id, depois:{ motivo:'subscription_canceled_period_end', ip:clientIp } });
          return res.status(403).json({ success:false, message:'Sua assinatura foi encerrada ao final do período contratado. Reative um plano para continuar.' });
        }
      }

      const passwordMatches = verifyPassword(password, user.senha_hash);
      if (!passwordMatches) {
        await writeAudit(sql, req, { tenantId: user.tenant_id, user: { id: user.id } }, { acao: 'login_bloqueado', entidade: 'auth', entidadeId: user.id, depois: { motivo: 'invalid_password', ip: clientIp } });
        // Mensagem genérica — não revela se é usuário ou senha o problema (anti-enumeração)
        return res.status(401).json({ success: false, message: 'Credenciais de acesso inválidas.' });
      }

      // PATCH 49: Proteção MFA para Super Admin Master Backoffice
      const isSuperAdmin = user.perfil === 'superadmin';
      const totpCode = String(req.body.totp_code || req.body.mfa_code || '').trim();
      const backupCode = String(req.body.backup_code || '').trim();

      if (isSuperAdmin) {
        if (!user.mfa_enabled) {
          const setupToken = signToken({
            userId: user.id,
            username: user.username,
            purpose: 'mfa_setup',
            exp: Date.now() + 10 * 60 * 1000
          }, secret);

          return res.status(200).json({
            success: true,
            mfa_setup_required: true,
            mfa_token: setupToken,
            message: 'Configuração do Google Authenticator obrigatória para acesso ao Portal Master.'
          });
        }

        // Se MFA está ativo e o código não foi enviado na primeira requisição
        if (!totpCode && !backupCode) {
          const pendingToken = signToken({
            userId: user.id,
            username: user.username,
            purpose: 'mfa_pending',
            remember: !!remember,
            exp: Date.now() + 5 * 60 * 1000
          }, secret);

          return res.status(200).json({
            success: true,
            mfa_required: true,
            mfa_token: pendingToken,
            message: 'Insira o código do Google Authenticator para concluir a autenticação Master.'
          });
        }

        // Código enviado diretamente no formulário de login
        let mfaValid = false;
        let usedBackup = false;
        let newBackupCodes = user.mfa_backup_codes || [];
        let newStep = user.mfa_last_used_step || 0;

        if (backupCode) {
          const backupRes = verifyBackupCode(backupCode, user.mfa_backup_codes || []);
          if (backupRes.valid) {
            mfaValid = true;
            usedBackup = true;
            newBackupCodes = backupRes.remainingHashedCodes;
          }
        } else if (totpCode) {
          const { secret: decryptedSecret, isLegacy } = decryptMfaSecret(user.mfa_secret);
          const totpRes = verifyTotpCode(decryptedSecret, totpCode, {
            lastUsedStep: user.mfa_last_used_step || 0
          });
          if (totpRes.valid) {
            mfaValid = true;
            newStep = totpRes.step;
            if (isLegacy && decryptedSecret) {
              const reEncrypted = encryptMfaSecret(decryptedSecret);
              await sql`UPDATE usuarios SET mfa_secret = ${reEncrypted} WHERE id = ${user.id};`;
            }
          }
        }

        if (!mfaValid) {
          return res.status(401).json({
            success: false,
            message: backupCode ? 'Código de recuperação de emergência inválido.' : 'Código do Google Authenticator incorreto ou expirado.'
          });
        }

        if (usedBackup) {
          await sql`UPDATE usuarios SET mfa_backup_codes = ${JSON.stringify(newBackupCodes)}::jsonb WHERE id = ${user.id};`;
        } else if (newStep > 0) {
          await sql`UPDATE usuarios SET mfa_last_used_step = ${newStep} WHERE id = ${user.id};`;
        }
      }

      // Expiração da sessão: 30 dias para "lembrar-me", 2 dias padrão
      const durationDays = remember ? 30 : 2;
      const exp = Date.now() + durationDays * 24 * 60 * 60 * 1000;
      const sessionId = await createAuthSession(sql, req, { userId:user.id, tenantId:user.tenant_id, remember:!!remember, exp });

      const payload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        nome: user.nome,
        perfil: user.perfil,
        tenantId: user.tenant_id,
        tenantStatus: user.tenant_status || 'ativo',
        empresaNome: user.nome_fantasia || user.razao_social || 'Minha Empresa',
        avatar: user.avatar || user.nome.slice(0, 2).toUpperCase(),
        permissions: permissionsOf(user),
        sessionId,
        mfa_enabled: Boolean(user.mfa_enabled),
        mfa_verified: isSuperAdmin ? true : Boolean(user.mfa_enabled),
        exp
      };

      const token = signToken(payload, secret);
      setSessionCookie(req, res, token, exp);

      return res.status(200).json({
        success: true,
        ...tokenFieldForExplicitClient(req, token),
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nome: user.nome,
          perfil: user.perfil,
          avatar: payload.avatar,
          tenantId: user.tenant_id,
          empresaNome: payload.empresaNome,
          permissions: payload.permissions,
          sessionId,
          remember: !!remember,
          mfa_enabled: Boolean(user.mfa_enabled),
          mfa_verified: payload.mfa_verified
        }
      });
    }

    // ── 2.1 POST /api/auth?action=mfa_verify ────────────────────────────────────
    if (req.method === 'POST' && action === 'mfa_verify') {
      const clientIp = getClientIp(req);
      const rl = await checkRateLimit(`mfa:${clientIp}`, 8, 300000);
      if (!rl.allowed) {
        return res.status(429).json({ success: false, message: 'Muitas tentativas de código MFA. Aguarde 5 minutos.' });
      }

      const { mfa_token, totp_code, mfa_code, backup_code } = req.body || {};
      const tokenToVerify = mfa_token || req.headers['x-mfa-token'];
      if (!tokenToVerify) {
        return res.status(400).json({ success: false, message: 'Token de desafio MFA não fornecido.' });
      }

      const decoded = verifyToken(tokenToVerify, secret);
      if (!decoded || decoded.purpose !== 'mfa_pending' || !decoded.userId) {
        return res.status(401).json({ success: false, message: 'Desafio MFA expirado ou inválido. Refaça o login.' });
      }

      const rows = await sql`
        SELECT u.id, u.username, u.email, u.nome, u.perfil, u.avatar, u.ativo, u.tenant_id, u.permissoes,
               u.mfa_secret, u.mfa_enabled, u.mfa_backup_codes, u.mfa_last_used_step,
               t.razao_social, t.nome_fantasia, t.status as tenant_status
        FROM usuarios u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE u.id = ${decoded.userId}
        LIMIT 1;
      `;
      if (!rows.length || !rows[0].ativo) {
        return res.status(403).json({ success: false, message: 'Usuário não encontrado ou inativo.' });
      }

      const user = rows[0];
      const code = String(totp_code || mfa_code || '').trim();
      const bCode = String(backup_code || '').trim();

      let mfaValid = false;
      let usedBackup = false;
      let newBackupCodes = user.mfa_backup_codes || [];
      let newStep = user.mfa_last_used_step || 0;

      if (bCode) {
        const bRes = verifyBackupCode(bCode, user.mfa_backup_codes || []);
        if (bRes.valid) {
          mfaValid = true;
          usedBackup = true;
          newBackupCodes = bRes.remainingHashedCodes;
        }
      } else if (code) {
        let decryptedSecret = '';
        let isLegacy = false;
        try {
          const dec = decryptMfaSecret(user.mfa_secret);
          decryptedSecret = dec.secret;
          isLegacy = dec.isLegacy;
        } catch (mfaErr) {
          console.error('[Auth MFA] Falha ao descriptografar segredo MFA:', mfaErr.message || mfaErr);
          return res.status(500).json({
            success: false,
            message: 'Erro interno na validação de MFA. Verifique as configurações de criptografia do servidor ou use o código de emergência.'
          });
        }

        if (!decryptedSecret) {
          return res.status(400).json({
            success: false,
            message: 'Segredo MFA não configurado para esta conta. Utilize o código de recuperação.'
          });
        }

        const totpRes = verifyTotpCode(decryptedSecret, code, {
          lastUsedStep: user.mfa_last_used_step || 0
        });
        if (totpRes.valid) {
          mfaValid = true;
          newStep = totpRes.step;
          if (isLegacy && decryptedSecret) {
            try {
              const reEncrypted = encryptMfaSecret(decryptedSecret);
              await sql`UPDATE usuarios SET mfa_secret = ${reEncrypted} WHERE id = ${user.id};`;
            } catch (encErr) {
              console.warn('[Auth MFA] Migração para segredo criptografado adiada:', encErr.message || encErr);
            }
          }
        }
      } else {
        return res.status(400).json({ success: false, message: 'Código de autenticação ou de recuperação obrigatório.' });
      }

      if (!mfaValid) {
        await writeAudit(sql, req, { tenantId: user.tenant_id, user: { id: user.id } }, { acao: 'mfa_invalido', entidade: 'auth', entidadeId: user.id, depois: { ip: clientIp, type: bCode ? 'backup_code' : 'totp' } });
        return res.status(401).json({
          success: false,
          message: bCode ? 'Código de recuperação de emergência inválido ou já utilizado.' : 'Código do Google Authenticator incorreto ou expirado.'
        });
      }

      if (usedBackup) {
        await sql`UPDATE usuarios SET mfa_backup_codes = ${JSON.stringify(newBackupCodes)}::jsonb WHERE id = ${user.id};`;
      } else if (newStep > 0) {
        await sql`UPDATE usuarios SET mfa_last_used_step = ${newStep} WHERE id = ${user.id};`;
      }

      const remember = Boolean(decoded.remember);
      const durationDays = remember ? 30 : 2;
      const exp = Date.now() + durationDays * 24 * 60 * 60 * 1000;
      const sessionId = await createAuthSession(sql, req, { userId: user.id, tenantId: user.tenant_id, remember, exp });

      const payload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        nome: user.nome,
        perfil: user.perfil,
        tenantId: user.tenant_id,
        tenantStatus: user.tenant_status || 'ativo',
        empresaNome: user.nome_fantasia || user.razao_social || 'Minha Empresa',
        avatar: user.avatar || user.nome.slice(0, 2).toUpperCase(),
        permissions: permissionsOf(user),
        sessionId,
        mfa_enabled: true,
        mfa_verified: true,
        exp
      };

      const token = signToken(payload, secret);
      setSessionCookie(req, res, token, exp);

      return res.status(200).json({
        success: true,
        ...tokenFieldForExplicitClient(req, token),
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nome: user.nome,
          perfil: user.perfil,
          avatar: payload.avatar,
          tenantId: user.tenant_id,
          empresaNome: payload.empresaNome,
          permissions: payload.permissions,
          sessionId,
          remember,
          mfa_enabled: true,
          mfa_verified: true
        }
      });
    }

    // ── 2.2 POST /api/auth?action=mfa_setup ─────────────────────────────────────
    if (req.method === 'POST' && action === 'mfa_setup') {
      const { mfa_token, setup_token } = req.body || {};
      const rawSetupToken = mfa_token || setup_token; // aceita ambos os nomes de campo
      let targetUserId = null;
      let targetUsername = 'admin';

      if (rawSetupToken) {
        const decoded = verifyToken(rawSetupToken, secret);
        if (!decoded || (decoded.purpose !== 'mfa_setup' && decoded.purpose !== 'mfa_pending') || !decoded.userId) {
          return res.status(401).json({ success: false, message: 'Token de configuração MFA inválido ou expirado.' });
        }
        targetUserId = decoded.userId;
        targetUsername = decoded.username || 'admin';
      } else {
        const auth = await resolveAuthAndTenant(req);
        if (!auth.authenticated || auth.user?.perfil !== 'superadmin') {
          return res.status(403).json({ success: false, message: 'Apenas superadmin pode configurar o MFA.' });
        }
        targetUserId = auth.user.userId;
        targetUsername = auth.user.username;
      }

      const generatedSecret = generateTotpSecret(20);
      const uri = generateTotpUri({ issuer: 'FinGo Master', account: targetUsername, secret: generatedSecret });
      const qrSvg = generateQrSvg(uri, 220);
      const backup = generateBackupCodes(6);

      const confirmToken = signToken({
        userId: targetUserId,
        username: targetUsername,
        temp_secret: generatedSecret,
        backup_hashes: backup.hashedCodes,
        purpose: 'mfa_confirm_activation',
        exp: Date.now() + 15 * 60 * 1000
      }, secret);

      const formattedSecret = generatedSecret.match(/.{1,4}/g)?.join(' ') || generatedSecret;
      return res.status(200).json({
        success: true,
        secret: generatedSecret,
        secret_formatted: formattedSecret,   // campo esperado pelo frontend
        formatted_secret: formattedSecret,   // alias de compatibilidade
        uri,
        qr_svg: qrSvg,
        backup_codes: backup.rawCodes,
        setup_token: confirmToken,
        mfa_token: confirmToken              // alias para o frontend usar no activate
      });
    }

    // ── 2.3 POST /api/auth?action=mfa_activate ──────────────────────────────────
    if (req.method === 'POST' && action === 'mfa_activate') {
      const { setup_token, totp_code, mfa_code } = req.body || {};
      const code = String(totp_code || mfa_code || '').trim();

      if (!setup_token || !code) {
        return res.status(400).json({ success: false, message: 'Token de setup e código de 6 dígitos são obrigatórios.' });
      }

      const decoded = verifyToken(setup_token, secret);
      if (!decoded || decoded.purpose !== 'mfa_confirm_activation' || !decoded.temp_secret || !decoded.userId) {
        return res.status(401).json({ success: false, message: 'Token de setup expirado ou inválido. Inicie a configuração novamente.' });
      }

      const verifyRes = verifyTotpCode(decoded.temp_secret, code);
      if (!verifyRes.valid) {
        return res.status(400).json({ success: false, message: 'Código incorreto. Digite o código atual de 6 dígitos gerado pelo Google Authenticator.' });
      }

      // Persiste MFA ativado com segredo criptografado em repouso (AES-256-GCM)
      const encryptedSecret = encryptMfaSecret(decoded.temp_secret);
      await sql`
        UPDATE usuarios
        SET mfa_secret = ${encryptedSecret},
            mfa_enabled = TRUE,
            mfa_backup_codes = ${JSON.stringify(decoded.backup_hashes || [])}::jsonb,
            mfa_last_used_step = ${verifyRes.step}
        WHERE id = ${decoded.userId};
      `;

      const rows = await sql`
        SELECT u.id, u.username, u.email, u.nome, u.perfil, u.avatar, u.tenant_id, u.permissoes,
               t.razao_social, t.nome_fantasia, t.status as tenant_status
        FROM usuarios u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE u.id = ${decoded.userId}
        LIMIT 1;
      `;
      const user = rows[0];

      const durationDays = 2;
      const exp = Date.now() + durationDays * 24 * 60 * 60 * 1000;
      const sessionId = await createAuthSession(sql, req, { userId: user.id, tenantId: user.tenant_id, remember: false, exp });

      const payload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        nome: user.nome,
        perfil: user.perfil,
        tenantId: user.tenant_id,
        tenantStatus: user.tenant_status || 'ativo',
        empresaNome: user.nome_fantasia || user.razao_social || 'Minha Empresa',
        avatar: user.avatar || user.nome.slice(0, 2).toUpperCase(),
        permissions: permissionsOf(user),
        sessionId,
        mfa_enabled: true,
        mfa_verified: true,
        exp
      };

      const token = signToken(payload, secret);
      setSessionCookie(req, res, token, exp);

      return res.status(200).json({
        success: true,
        message: 'Google Authenticator configurado e ativado com sucesso!',
        ...tokenFieldForExplicitClient(req, token),
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nome: user.nome,
          perfil: user.perfil,
          avatar: payload.avatar,
          tenantId: user.tenant_id,
          empresaNome: payload.empresaNome,
          permissions: payload.permissions,
          sessionId,
          mfa_enabled: true,
          mfa_verified: true
        }
      });
    }

    // ── 3. POST /api/auth?action=register (Cadastro de novo Tenant SaaS no Neon) ─
    if (req.method === 'POST' && (action === 'register' || action === 'solicitar_acesso' || action === 'request_access')) {
      const clientIp = getClientIp(req);
      const rl = await checkRateLimit(`reg:${clientIp}`, 5, 3600000); // 5 solicitações por hora por IP
      if (!rl.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Muitas solicitações a partir deste endereço IP. Aguarde antes de tentar novamente.'
        });
      }

      const { nome, email, telefone, empresaNome, cnpj, mensagem } = req.body || {};
      const rawNome = (nome || '').trim();
      const rawEmail = (email || '').trim().toLowerCase();
      const rawTelefone = (telefone || '').trim();
      const rawEmpresa = (empresaNome || '').trim();
      const rawCnpj = (cnpj || '').trim();
      const rawMsg = (mensagem || '').trim();

      if (!rawNome || !rawEmail) {
        return res.status(400).json({ success: false, message: 'Nome e e-mail de contato são obrigatórios.' });
      }

      if (!rawEmail.includes('@') || !rawEmail.includes('.')) {
        return res.status(400).json({ success: false, message: 'Informe um endereço de e-mail válido.' });
      }

      const reqId = 'req_' + crypto.randomBytes(6).toString('hex');
      try {
        await sql`
          INSERT INTO access_requests (id, nome, email, telefone, empresa_nome, cnpj, mensagem, ip)
          VALUES (
            ${reqId},
            ${rawNome},
            ${rawEmail},
            ${rawTelefone || null},
            ${rawEmpresa || null},
            ${rawCnpj || null},
            ${rawMsg || null},
            ${clientIp}
          );
        `;
      } catch (insertErr) {
        console.error('Erro ao gravar solicitação de acesso:', insertErr.message);
        // PATCH 50: não silenciar falha de INSERT — o lead precisa ser registrado.
        // Retornar 503 para o cliente tentar novamente em vez de perder o lead.
        return res.status(503).json({
          success: false,
          message: 'Não foi possível registrar sua solicitação no momento. Por favor, tente novamente em instantes ou entre em contato diretamente pelo WhatsApp.'
        });
      }

      // Disparo de notificações transacionais via Resend
      let resendKey = String(process.env.RESEND_API_KEY || '').trim();
      if ((resendKey.startsWith('"') && resendKey.endsWith('"')) || (resendKey.startsWith("'") && resendKey.endsWith("'"))) {
        resendKey = resendKey.slice(1, -1);
      }
      const fromEmail = String(process.env.RESEND_FROM_EMAIL || 'FinGo <suporte@fingo.api.br>').trim();
      const adminEmails = [
        'brennodarlam@gmail.com',
        'suporte@fingo.api.br'
      ];
      if (process.env.ADMIN_NOTIFY_EMAIL && !adminEmails.includes(process.env.ADMIN_NOTIFY_EMAIL.trim())) {
        adminEmails.push(process.env.ADMIN_NOTIFY_EMAIL.trim());
      }

      if (resendKey) {
        try {
          const escapeHtmlLocal = (str) => String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

          const cleanPhone = rawTelefone.replace(/\D/g, '');
          const waLeadUrl = cleanPhone
            ? (cleanPhone.startsWith('55') ? `https://wa.me/${cleanPhone}` : `https://wa.me/55${cleanPhone}`)
            : '';
          const waAdminMsg = encodeURIComponent(`Olá ${rawNome}, sou da equipe comercial do FinGo! Recebi sua solicitação de acesso para a ${rawEmpresa || 'sua construtora'}.`);
          const waActionLink = waLeadUrl ? `${waLeadUrl}?text=${waAdminMsg}` : '';

          let dataHora = '';
          try {
            dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' });
          } catch {
            dataHora = new Date().toISOString();
          }

          // 1. E-mail de Alerta para o Administrador / Comercial
          const adminHtml = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F0F0E8;">
              <div style="max-width:600px;margin:24px auto;background:#141D12;border:1px solid #282828;border-radius:10px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.8);">
                <div style="background:#0A0A0A;padding:22px 28px;border-bottom:3px solid #C6FF00;">
                  <table style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td>
                        <a href="https://fingo.api.br" target="_blank" style="text-decoration:none;display:inline-block;">
                          <img src="https://fingo.api.br/img/fingo/fingo-logo-full.png" alt="FinGo" style="height:32px;display:block;border:0;" />
                        </a>
                      </td>
                      <td style="text-align:right;">
                        <span style="display:inline-block;padding:4px 10px;background:rgba(198,255,0,0.12);border:1px solid rgba(198,255,0,0.4);border-radius:4px;font-size:11px;font-weight:800;color:#C6FF00;text-transform:uppercase;">
                          NOVO LEAD COMERCIAL
                        </span>
                      </td>
                    </tr>
                  </table>
                </div>
                <div style="padding:28px;">
                  <h2 style="margin:0 0 14px;color:#FFFFFF;font-size:18px;font-weight:800;">
                    📥 Nova Solicitação de Acesso ao FinGo
                  </h2>
                  <p style="color:#94a3b8;font-size:14px;line-height:1.5;margin-bottom:20px;">
                    Um novo interessado preencheu o formulário comercial na página inicial solicitando acesso à plataforma.
                  </p>
                  
                  <div style="background:rgba(255,255,255,0.03);border:1px solid #282828;border-radius:8px;padding:16px 20px;margin-bottom:24px;font-size:14px;">
                    <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                      <span style="color:#8E8E8E;display:inline-block;width:140px;">Empresa / Construtora:</span>
                      <strong style="color:#C6FF00;font-size:15px;">${escapeHtmlLocal(rawEmpresa || 'Não informada')}</strong>
                    </div>
                    <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                      <span style="color:#8E8E8E;display:inline-block;width:140px;">Contato:</span>
                      <strong style="color:#FFFFFF;">${escapeHtmlLocal(rawNome)}</strong>
                    </div>
                    <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                      <span style="color:#8E8E8E;display:inline-block;width:140px;">E-mail:</span>
                      <a href="mailto:${escapeHtmlLocal(rawEmail)}" style="color:#38bdf8;text-decoration:none;font-weight:600;">${escapeHtmlLocal(rawEmail)}</a>
                    </div>
                    <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                      <span style="color:#8E8E8E;display:inline-block;width:140px;">WhatsApp / Fone:</span>
                      <strong style="color:#FFFFFF;">${escapeHtmlLocal(rawTelefone || 'Não informado')}</strong>
                    </div>
                    ${rawCnpj ? `
                    <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                      <span style="color:#8E8E8E;display:inline-block;width:140px;">CNPJ / Local:</span>
                      <span style="color:#CBD5E1;">${escapeHtmlLocal(rawCnpj)}</span>
                    </div>` : ''}
                    ${rawMsg ? `
                    <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                      <span style="color:#8E8E8E;display:inline-block;width:140px;">Mensagem:</span>
                      <span style="color:#CBD5E1;">${escapeHtmlLocal(rawMsg)}</span>
                    </div>` : ''}
                    <div style="padding:8px 0;">
                      <span style="color:#8E8E8E;display:inline-block;width:140px;">Data &amp; Hora:</span>
                      <span style="color:#94a3b8;font-family:monospace;font-size:12px;">${dataHora} (Manaus)</span>
                    </div>
                  </div>

                  <div style="margin-bottom:20px;">
                    ${waActionLink ? `
                    <a href="${waActionLink}" target="_blank" style="display:inline-block;padding:12px 20px;background:#22c55e;color:#052e16;font-weight:800;font-size:13px;border-radius:6px;text-decoration:none;margin-right:10px;margin-bottom:10px;">
                      💬 Iniciar Conversa no WhatsApp
                    </a>` : ''}
                    <a href="https://fingo.api.br/master" target="_blank" style="display:inline-block;padding:12px 20px;background:#C6FF00;color:#0A0A0A;font-weight:800;font-size:13px;border-radius:6px;text-decoration:none;margin-bottom:10px;">
                      🛡️ Abrir Master Backoffice
                    </a>
                  </div>
                </div>
                <div style="background:#0A0A0A;padding:16px 28px;border-top:1px solid #282828;font-size:11px;color:#8E8E8E;text-align:center;">
                  FinGo ERP — Obras em Fluxo &bull; ID da Solicitação: <code style="color:#C6FF00;">${reqId}</code>
                </div>
              </div>
            </body>
            </html>
          `;

          // 2. E-mail de confirmação para o Cliente/Lead
          const clientHtml = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F0F0E8;">
              <div style="max-width:580px;margin:24px auto;background:#141D12;border:1px solid #282828;border-radius:10px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.8);">
                <div style="background:#0A0A0A;padding:24px 30px;border-bottom:3px solid #C6FF00;">
                  <a href="https://fingo.api.br" target="_blank" style="text-decoration:none;display:inline-block;">
                    <img src="https://fingo.api.br/img/fingo/fingo-logo-full.png" alt="FinGo" style="height:34px;display:block;border:0;" />
                  </a>
                  <div style="font-size:11px;color:#8E8E8E;margin-top:6px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">
                    SaaS de Gestão para Construtoras &bull; Obras em Fluxo
                  </div>
                </div>
                <div style="padding:32px 30px;">
                  <h2 style="margin:0 0 12px;color:#FFFFFF;font-size:19px;font-weight:800;">
                    Olá, ${escapeHtmlLocal(rawNome)}!
                  </h2>
                  <p style="color:#CBD5E1;font-size:14px;line-height:1.6;margin-bottom:16px;">
                    Recebemos com sucesso sua solicitação de acesso ao <strong>FinGo ERP</strong> para a <strong>${escapeHtmlLocal(rawEmpresa || 'sua empresa')}</strong>.
                  </p>
                  <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin-bottom:24px;">
                    Nossa equipe técnica e comercial entrará em contato em instantes pelo WhatsApp <strong>${escapeHtmlLocal(rawTelefone || '')}</strong> ou por este e-mail para agendar uma demonstração rápida e liberar seu ambiente exclusivo de testes com fluxo de caixa, SINAPI, orçamentos e BIM 3D.
                  </p>

                  <div style="background:rgba(198,255,0,0.06);border:1px solid rgba(198,255,0,0.25);border-radius:8px;padding:18px;margin-bottom:24px;text-align:center;">
                    <div style="font-size:13px;color:#CBD5E1;margin-bottom:12px;font-weight:600;">
                      Prefere iniciar o atendimento agora mesmo?
                    </div>
                    <a href="https://wa.me/5595991232345?text=${encodeURIComponent(`Olá, acabei de solicitar acesso ao FinGo para a empresa ${rawEmpresa || rawNome}!`)}" target="_blank" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#052e16;font-weight:800;font-size:13px;border-radius:6px;text-decoration:none;">
                      💬 Falar com Especialista no WhatsApp
                    </a>
                  </div>

                  <p style="color:#64748b;font-size:12px;margin:0;">
                    Caso não tenha solicitado este contato, basta desconsiderar este e-mail.
                  </p>
                </div>
                <div style="background:#0A0A0A;padding:18px 30px;border-top:1px solid #282828;font-size:11px;color:#8E8E8E;text-align:center;line-height:1.5;">
                  FinGo — Plataforma de Gestão e Engenharia de Obras<br>
                  Dúvidas? Escreva para <a href="mailto:suporte@fingo.api.br" style="color:#C6FF00;text-decoration:none;">suporte@fingo.api.br</a>
                </div>
              </div>
            </body>
            </html>
          `;

          // Disparo concorrente para Admin e Cliente
          const emailDispatches = [];

          // Envia para os admins
          emailDispatches.push(
            fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: fromEmail,
                to: adminEmails,
                subject: `🔔 Novo Lead FinGo: ${rawEmpresa || rawNome}`,
                html: adminHtml
              }),
              signal: AbortSignal.timeout(10000)
            }).then(r => r.json().catch(() => ({})))
          );

          // Envia confirmação para o lead
          if (rawEmail && rawEmail.includes('@')) {
            emailDispatches.push(
              fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  from: fromEmail,
                  to: [rawEmail],
                  subject: `FinGo — Solicitação de Acesso Recebida (${rawEmpresa || 'Construtora'})`,
                  html: clientHtml
                }),
                signal: AbortSignal.timeout(10000)
              }).then(r => r.json().catch(() => ({})))
            );
          }

          await Promise.allSettled(emailDispatches);
        } catch (mailErr) {
          console.warn('[Register Access Request] Falha ao enviar notificações por e-mail:', mailErr?.message || mailErr);
        }
      }

      return res.status(200).json({
        success: true,
        commercial_request: true,
        message: 'Sua solicitação de acesso foi recebida com sucesso! Nossa equipe comercial entrará em contato para ativar sua construtora no FinGo.'
      });
    }

    // ── 3.1 POST /api/auth?action=google (Autenticação Google com Verificação Criptográfica RSA)
    if (req.method === 'POST' && action === 'google') {
      const googleIp = getClientIp(req);
      const googleRl = await checkRateLimit(`google:${googleIp}`, 20, 60000);
      if (!googleRl.allowed) {
        return res.status(429).json({ success:false, message:'Muitas tentativas de login Google. Aguarde um minuto.' });
      }
      const { credentialJwt } = req.body || {};
      if (!credentialJwt) {
        return res.status(400).json({ success: false, message: 'Token de credencial Google é obrigatório.' });
      }

      const googleClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
      if (!googleClientId) {
        console.error('🚨 [Google Auth] GOOGLE_CLIENT_ID não configurado.');
        return res.status(500).json({ success:false, message:'Login Google temporariamente indisponível.' });
      }

      let profile = null;
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credentialJwt,
          audience: googleClientId
        });
        profile = ticket.getPayload();
      } catch (verifyErr) {
        console.error('Falha na validação criptográfica do token Google:', verifyErr.message);
        return res.status(401).json({ success: false, message: 'Credencial Google inválida ou expirada.' });
      }

      if (!profile || !profile.email || !profile.email_verified || !profile.sub) {
        return res.status(401).json({ success: false, message: 'Token Google inválido ou e-mail não verificado pelo Google.' });
      }

      const email = profile.email.trim().toLowerCase();
      const nome = profile.name || profile.given_name || email.split('@')[0];
      const picture = profile.picture || '';
      const googleSub = profile.sub || '';

      // PATCH 50.2: Google OAuth multi-tenant com Chave da Empresa obrigatória (fail-closed antes de query SQL).
      // A arquitetura exige: chave -> tenant -> usuário vinculado àquele tenant.
      // Superadmin nunca é acessível via Google.
      const rawGoogleCompanyKey = String(req.body?.access_key || req.body?.company_key || req.body?.accessKey || '').trim();
      if (!rawGoogleCompanyKey) {
        return res.status(403).json({
          success: false,
          not_registered: true,
          google_needs_company_key: true,
          message: 'Para entrar com Google, informe a Chave da Empresa (6 dígitos) fornecida pelo administrador da sua construtora.'
        });
      }

      if (!isTenantAccessKeyShapeValid(rawGoogleCompanyKey)) {
        return res.status(403).json({
          success: false,
          not_registered: true,
          message: 'Chave da Empresa inválida. Verifique a chave de 6 dígitos fornecida pelo administrador.'
        });
      }

      const googleTenant = await resolveTenantByAccessKey(sql, rawGoogleCompanyKey);
      if (!googleTenant) {
        return res.status(403).json({
          success: false,
          not_registered: true,
          message: 'Chave da Empresa não encontrada ou empresa com acesso bloqueado.'
        });
      }
      const googleTenantId = googleTenant.id;

      // Busca usuário existente estritamente vinculado ao tenant resolvido pela chave
      const existing = await sql`
        SELECT u.*, t.razao_social, t.nome_fantasia, t.status as tenant_status, t.created_at as tenant_created_at, t.vencimento as tenant_vencimento
        FROM usuarios u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE (LOWER(u.email) = ${email} OR (u.google_sub IS NOT NULL AND u.google_sub = ${googleSub}))
          AND u.perfil <> 'superadmin'
          AND u.tenant_id = ${googleTenantId}
        LIMIT 1;
      `;

      let userRecord = null;
      let isNew = false;

      if (existing.length > 0) {
        userRecord = existing[0];
        if (!userRecord.ativo) {
          return res.status(403).json({ success:false, message:'Conta de usuário inativa. Contate o administrador.' });
        }
        if (userRecord.tenant_status === 'bloqueado' || userRecord.tenant_status === 'cancelado') {
          return res.status(403).json({
            success: false,
            message: 'Acesso da empresa bloqueado. Contate o suporte comercial FinGo.'
          });
        }
        if (userRecord.tenant_status === 'trial') {
          const due = userRecord.tenant_vencimento ? new Date(String(userRecord.tenant_vencimento).slice(0,10) + 'T23:59:59-04:00').getTime() : null;
          const created = userRecord.tenant_created_at ? new Date(userRecord.tenant_created_at).getTime() : null;
          const fallbackDue = created ? created + 15 * 24 * 60 * 60 * 1000 : null;
          if ((due && Date.now() > due) || (!due && fallbackDue && Date.now() > fallbackDue)) {
            return res.status(403).json({ success:false, message:'Seu período de teste gratuito expirou. Faça o upgrade para continuar.' });
          }
        }
        if (picture && (!userRecord.avatar || userRecord.avatar.length <= 2)) {
          await sql`UPDATE usuarios SET avatar = ${picture}, updated_at = NOW() WHERE id = ${userRecord.id};`;
          userRecord.avatar = picture;
        }
      } else {
        return res.status(403).json({
          success: false,
          not_registered: true,
          message: 'Esta conta Google não está vinculada a nenhuma construtora cadastrada no FinGo. Solicite acesso ao administrador da sua empresa ou à nossa equipe comercial.'
        });
      }

      const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 dias
      const sessionId = await createAuthSession(sql, req, { userId:userRecord.id, tenantId:userRecord.tenant_id, remember:true, exp });
      const payload = {
        userId: userRecord.id,
        username: userRecord.username,
        email: userRecord.email,
        nome: userRecord.nome,
        perfil: userRecord.perfil,
        tenantId: userRecord.tenant_id,
        tenantStatus: userRecord.tenant_status || 'ativo',
        empresaNome: userRecord.nome_fantasia || userRecord.nome + ' Construtora',
        avatar: userRecord.avatar,
        permissions: permissionsOf(userRecord),
        sessionId,
        exp
      };

      const token = signToken(payload, secret);
      setSessionCookie(req, res, token, exp);

      return res.status(200).json({
        success: true,
        ...tokenFieldForExplicitClient(req, token),
        isNew,
        user: {
          id: userRecord.id,
          username: userRecord.username,
          email: userRecord.email,
          nome: userRecord.nome,
          perfil: userRecord.perfil,
          avatar: userRecord.avatar,
          tenantId: userRecord.tenant_id,
          empresaNome: payload.empresaNome,
          permissions: payload.permissions,
          sessionId,
          remember: true
        }
      });
    }

    // ── 4. Sessões e dispositivos (Patch 08) ───────────────────────────────────
    if (req.method === 'GET' && action === 'sessions') {
      const auth = await resolveAuthAndTenant(req);
      if (!auth.authenticated) return res.status(auth.status || 401).json({ success:false, error:auth.error || 'Não autorizado.' });
      if (auth.isSystem) return res.status(200).json({ success:true, sessions:[] });
      const rows = await sql`
        SELECT id, device_name, ip, remember, created_at, last_seen_at, expires_at, revoked_at
        FROM auth_sessions
        WHERE user_id=${auth.user.userId}
        ORDER BY created_at DESC
        LIMIT 30;
      `;
      return res.status(200).json({
        success:true,
        currentSessionId: auth.user.sessionId || '',
        sessions: rows.map(r => ({ ...r, current:r.id === auth.user.sessionId, active:!r.revoked_at && new Date(r.expires_at).getTime() > Date.now() }))
      });
    }

    if (req.method === 'POST' && ['logout','revoke_session','revoke_other_sessions'].includes(action)) {
      const auth = await resolveAuthAndTenant(req);
      if (!auth.authenticated) {
        // Logout deve ser idempotente: cliente pode limpar a sessão mesmo se ela já expirou.
        if (action === 'logout') { clearSessionCookie(req, res); return res.status(200).json({ success:true }); }
        return res.status(auth.status || 401).json({ success:false, error:auth.error || 'Não autorizado.' });
      }
      if (auth.isSystem) { if (action === 'logout') clearSessionCookie(req, res); return res.status(200).json({ success:true }); }
      const currentId = String(auth.user.sessionId || '');
      if (action === 'logout') {
        if (currentId) await sql`UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE id=${currentId} AND user_id=${auth.user.userId};`;
        clearSessionCookie(req, res);
        return res.status(200).json({ success:true });
      }
      if (action === 'revoke_session') {
        const targetId = String(req.body?.sessionId || '').trim();
        if (!targetId) return res.status(400).json({ success:false, error:'Sessão não informada.' });
        await sql`UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE id=${targetId} AND user_id=${auth.user.userId};`;
        return res.status(200).json({ success:true, currentRevoked:targetId === currentId });
      }
      await sql`
        UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW())
        WHERE user_id=${auth.user.userId} AND revoked_at IS NULL AND (${currentId}='' OR id<>${currentId});
      `;
      return res.status(200).json({ success:true });
    }

    // ── 4. POST /api/auth?action=request_reset (OTP opaco, sem enumeração de conta) ──
    if (req.method === 'POST' && action === 'request_reset') {
      const clientIp = getClientIp(req);
      const rlReset = await checkRateLimit(`reset:${clientIp}`, 5, 60000);
      if (!rlReset.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Muitas tentativas de recuperação a partir deste IP. Aguarde 1 minuto.'
        });
      }

      // PATCH 50: reset multi-tenant — busca em duas etapas:
      // 1. Tentar superadmin primeiro (sem Chave da Empresa, igual ao login Master).
      // 2. Se não for superadmin, exigir company_key para isolar o tenant correto.
      const {
        identificador,
        company_key: resetCompanyKey,
        access_key: resetAccessKey,
        accessKey: resetCamelKey
      } = req.body || {};
      if (!identificador || !identificador.trim()) {
        return res.status(400).json({ success: false, message: 'Informe seu usuário ou e-mail cadastrado.' });
      }

      const genericResponse = (requestId) => res.status(200).json({
        success: true,
        requestId,
        message: 'Se a conta existir, enviaremos um código ao canal cadastrado. O código é válido por 10 minutos.',
        expiresInSeconds: 600
      });
      const fakeRequestId = () => 'rec_' + crypto.randomBytes(8).toString('hex');

      const clean = identificador.trim().toLowerCase();

      // Etapa 1: busca Master (superadmin) — não requer Chave da Empresa
      const masterResetRows = await sql`
        SELECT u.id, u.username, u.email, u.nome, u.tenant_id,
               t.telefone as tenant_telefone, t.nome_fantasia
        FROM usuarios u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE (LOWER(u.username) = ${clean} OR LOWER(u.email) = ${clean})
          AND u.perfil = 'superadmin'
          AND u.ativo = TRUE
        LIMIT 1;
      `;

      let rows;
      if (masterResetRows.length) {
        rows = masterResetRows;
      } else {
        // Etapa 2: usuário de tenant — exige Chave da Empresa para isolar o tenant correto.
        // Se access_key / company_key ausente, retornar resposta genérica (sem revelar que é obrigatória).
        const rawResetKey = String(resetAccessKey || resetCompanyKey || resetCamelKey || '').trim();
        if (!rawResetKey) {
          return genericResponse(fakeRequestId());
        }
        if (!isTenantAccessKeyShapeValid(rawResetKey)) {
          return genericResponse(fakeRequestId());
        }
        const resetTenant = await resolveTenantByAccessKey(sql, rawResetKey);
        if (!resetTenant) {
          return genericResponse(fakeRequestId());
        }
        const tenantUser = await resolveTenantUserByLogin(sql, resetTenant.id, clean);
        if (!tenantUser) {
          return genericResponse(fakeRequestId());
        }
        rows = [tenantUser];
      }

      if (!rows.length) {
        return genericResponse(fakeRequestId());
      }

      const user = rows[0];

      // Limite por conta não altera a resposta pública: evita enumeração por status/shape.
      const recentOtpCount = await sql`
        SELECT COUNT(*) as count FROM recuperacao_senhas
        WHERE usuario_id = ${user.id} AND created_at > NOW() - INTERVAL '15 minutes';
      `;
      if (Number(recentOtpCount[0]?.count || 0) >= 3) {
        return genericResponse(fakeRequestId());
      }

      await sql`
        UPDATE recuperacao_senhas
        SET usado = TRUE
        WHERE usuario_id = ${user.id} AND usado = FALSE;
      `;

      const otpCode = crypto.randomInt(100000, 1000000).toString();
      const otpHash = hashPassword(otpCode);
      const resetId = 'rec_' + crypto.randomBytes(8).toString('hex');
      const expiraEm = new Date(Date.now() + 10 * 60 * 1000);

      await sql`
        INSERT INTO recuperacao_senhas (id, usuario_id, codigo_hash, expira_em)
        VALUES (${resetId}, ${user.id}, ${otpHash}, ${expiraEm.toISOString()});
      `;

      // O envio é best-effort. A resposta pública nunca revela qual canal existe ou se o envio funcionou.
      const destPhone = (user.tenant_telefone || '').replace(/\D/g, '');
      if (destPhone) {
        const numFmt = destPhone.startsWith('55') ? destPhone : `55${destPhone}`;
        const mensagemOtp = `*FinGo — Código de Verificação*\n\nOlá, ${user.nome}!\n\nSeu código seguro para redefinir sua senha no FinGo é:\n\n👉 *${otpCode}*\n\nEste código é válido por *10 minutos*. Se você não solicitou esta redefinição, ignore esta mensagem.`;
        try {
          const renderBaseUrl = String(process.env.RENDER_WHATSAPP_URL || 'https://finan-backend-9rxw.onrender.com')
            .replace(/\/send-message\/?$/, '').replace(/\/+$/, '');
          const waResp = await fetch(`${renderBaseUrl}/send-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // PATCH 50.1: usa INTERNAL_API_SECRET dedicado, não SESSION_SIGNING_SECRET.
              'x-api-key': getInternalApiSecret(),
              'x-tenant-id': user.tenant_id
            },
            body: JSON.stringify({ tenantId: user.tenant_id, phone: numFmt, message: mensagemOtp }),
            signal: AbortSignal.timeout(10000)
          });
          if (!waResp.ok) {
            console.warn('[Auth] OTP WhatsApp respondeu HTTP', waResp.status);
          }
        } catch (errWa) {
          console.warn('[Auth] Falha ao enviar OTP por WhatsApp:', errWa?.message || errWa);
        }
      }

      const resendKey = (process.env.RESEND_API_KEY || '').trim();
      if ((resendKey || isTriggerConfigured()) && user.email) {
        try {
          const fromEmail = (process.env.RESEND_FROM_EMAIL || 'FinGo <nao-responder@fingo.api.br>').trim();
          const emailSubject = 'FinGo — Código de Recuperação de Senha';
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
              <h2 style="color: #0f172a; margin-top: 0;">Código de Verificação</h2>
              <p style="color: #334155; font-size: 15px;">Recebemos uma solicitação de redefinição de senha para sua conta no <strong>FinGo</strong>.</p>
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 18px; border-radius: 8px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0284c7; font-family: monospace;">${otpCode}</span>
              </div>
              <p style="color: #64748b; font-size: 13px; line-height: 1.5;">Este código de segurança expira em <strong>10 minutos</strong>.<br>Se você não fez esta solicitação, desconsidere esta mensagem.</p>
            </div>
          `;

          let dispatchedViaTrigger = false;
          if (isTriggerConfigured()) {
            const trigRes = await triggerEmail({
              from: fromEmail,
              to: user.email,
              subject: emailSubject,
              html: emailHtml
            }, {
              idempotencyKey: `otp-reset-${resetId}`
            });
            if (trigRes.success) {
              dispatchedViaTrigger = true;
            }
          }

          if (!dispatchedViaTrigger && resendKey) {
            const mailResp = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: fromEmail,
                to: [user.email],
                subject: emailSubject,
                html: emailHtml
              }),
              signal: AbortSignal.timeout(10000)
            });
            if (!mailResp.ok) {
              console.warn('[Auth] OTP e-mail respondeu HTTP', mailResp.status);
            }
          }
        } catch (errMail) {
          console.warn('[Auth] Falha ao enviar OTP por e-mail:', errMail?.message || errMail);
        }
      }

      return genericResponse(resetId);
    }

    // ── 5. POST /api/auth?action=verify_reset (OTP por requestId + alteração atômica) ──
    if (req.method === 'POST' && action === 'verify_reset') {
      const { requestId, code, newPassword } = req.body || {};
      const verifyIp = getClientIp(req);
      const safeRequestId = String(requestId || '').slice(0, 80);
      const verifyRl = await checkRateLimit(`verify-reset:${verifyIp}:${safeRequestId}`, 15, 10 * 60 * 1000);
      if (!verifyRl.allowed) {
        return res.status(429).json({ success:false, message:'Muitas tentativas de validação. Aguarde alguns minutos e tente novamente.' });
      }
      if (!requestId || !code || !newPassword) {
        return res.status(400).json({ success: false, message: 'Dados incompletos para redefinição de senha.' });
      }
      const normalizedNewPassword = String(newPassword);
      if (normalizedNewPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'A nova senha deve ter no mínimo 8 caracteres.' });
      }
      if (normalizedNewPassword.length > 128) {
        return res.status(400).json({ success: false, message: 'A nova senha excede o limite máximo permitido de 128 caracteres.' });
      }

      const activeResets = await sql`
        SELECT id, usuario_id, codigo_hash, tentativas, max_tentativas
        FROM recuperacao_senhas
        WHERE id = ${String(requestId)} AND usado = FALSE AND expira_em > NOW()
        LIMIT 1;
      `;

      if (!activeResets.length) {
        return res.status(400).json({ success: false, message: 'Código expirado ou inválido. Solicite um novo código.' });
      }

      const rec = activeResets[0];
      if (Number(rec.tentativas || 0) >= Number(rec.max_tentativas || 5)) {
        await sql`UPDATE recuperacao_senhas SET usado = TRUE WHERE id = ${rec.id};`;
        return res.status(403).json({ success: false, message: 'Limite de tentativas excedido por segurança. Solicite um novo código.' });
      }

      const codeMatches = verifyPassword(String(code).trim(), rec.codigo_hash);
      if (!codeMatches) {
        await sql`UPDATE recuperacao_senhas SET tentativas = tentativas + 1 WHERE id = ${rec.id};`;
        const restantes = Math.max(0, Number(rec.max_tentativas || 5) - (Number(rec.tentativas || 0) + 1));
        return res.status(401).json({ success: false, message: `Código incorreto. Você tem mais ${restantes} tentativa(s).` });
      }

      const newHash = hashPassword(normalizedNewPassword);
      const resetApplied = await sql`
        WITH consumed AS (
          UPDATE recuperacao_senhas
          SET usado = TRUE
          WHERE id = ${rec.id}
            AND usuario_id = ${rec.usuario_id}
            AND usado = FALSE
            AND expira_em > NOW()
            AND tentativas < max_tentativas
          RETURNING usuario_id
        ),
        password_upd AS (
          UPDATE usuarios u
          SET senha_hash = ${newHash}, updated_at = NOW()
          FROM consumed c
          WHERE u.id = c.usuario_id
          RETURNING u.id
        ),
        sessions_revoked AS (
          UPDATE auth_sessions s
          SET revoked_at = COALESCE(s.revoked_at, NOW())
          FROM consumed c
          WHERE s.user_id = c.usuario_id AND s.revoked_at IS NULL
          RETURNING s.id
        )
        SELECT password_upd.id AS user_id,
               (SELECT COUNT(*)::int FROM sessions_revoked) AS revoked_sessions
        FROM password_upd;
      `;

      if (!resetApplied.length) {
        return res.status(409).json({
          success: false,
          message: 'Este código já foi utilizado, expirou ou deixou de ser válido. Solicite um novo código.'
        });
      }

      return res.status(200).json({
        success: true,
        revokedSessions: Number(resetApplied[0]?.revoked_sessions || 0),
        message: 'Senha redefinida com sucesso! Por segurança, as sessões anteriores foram encerradas. Faça login novamente.'
      });
    }

    return res.status(400).json({ success: false, error: `Ação '${action}' inválida para /api/auth.` });
  } catch (err) {
    console.error('Erro na API de autenticação:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao processar autenticação.' });
  }
}
