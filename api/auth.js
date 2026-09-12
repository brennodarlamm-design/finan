// api/auth.js — Endpoint Serverless de Autenticação Segura, Google OAuth e Recuperação de Senha

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { hashPassword, verifyPassword, signToken, resolveAuthAndTenant } from './_auth.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';

const googleClient = new OAuth2Client();

function getSql() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    throw new Error('Variável de ambiente DATABASE_URL não configurada.');
  }
  return neon(conn);
}

const ALLOWED_ORIGINS = [
  'https://finobra.app.br',
  'https://www.finobra.app.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey, x-tenant-id, x-finobra-token-mode');
}

const SESSION_COOKIE = 'finobra_session_token';

function cookieSecure(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return proto === 'https' || Boolean(process.env.VERCEL);
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

  const secret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();
  if (!secret) {
    console.error('🚨 [Auth] API_SECRET não configurado.');
    return res.status(500).json({ success:false, error:'Configuração de segurança pendente no servidor.' });
  }

  try {
    const sql = getSql();
    const action = req.query.action || (req.body && req.body.action);

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
        SELECT u.id, u.username, u.email, u.nome, u.perfil, u.avatar, u.tenant_id, u.permissoes,
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
          sessionId: effectiveSessionId
        },
        tenant: tenantData
      });
    }

    // ── 2. POST /api/auth?action=login ──────────────────────────────────────────
    if (req.method === 'POST' && action === 'login') {
      const clientIp = getClientIp(req);
      const rl = await checkRateLimit(`login:${clientIp}`, 10, 60000);
      if (!rl.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Muitas tentativas consecutivas de login. Aguarde 1 minuto antes de tentar novamente.'
        });
      }

      const { username, password, remember } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios.' });
      }

      const cleanUser = username.trim().toLowerCase();
      const rows = await sql`
        SELECT u.id, u.username, u.email, u.senha_hash, u.nome, u.perfil, u.avatar, u.ativo, u.tenant_id, u.permissoes,
               t.razao_social, t.nome_fantasia, t.status as tenant_status, t.created_at as tenant_created_at, t.vencimento as tenant_vencimento
        FROM usuarios u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE LOWER(u.username) = ${cleanUser} OR LOWER(u.email) = ${cleanUser}
        LIMIT 1;
      `;

      if (!rows.length) {
        return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
      }

      const user = rows[0];
      if (!user.ativo) {
        return res.status(403).json({ success: false, message: 'Conta de usuário inativa. Contate o administrador.' });
      }

      // Aplicação estrita de regras de status do SaaS
      if (user.tenant_status === 'bloqueado') {
        return res.status(403).json({
          success: false,
          message: 'Acesso bloqueado para esta empresa. Entre em contato com o suporte comercial FinObra.'
        });
      }
      if (user.tenant_status === 'cancelado') {
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
          return res.status(403).json({ success:false, message:'Seu período de teste gratuito expirou. Faça o upgrade de plano para continuar.' });
        }
      }

      const passwordMatches = verifyPassword(password, user.senha_hash);
      if (!passwordMatches) {
        return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
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
          remember: !!remember
        }
      });
    }

    // ── 3. POST /api/auth?action=register (Cadastro de novo Tenant SaaS no Neon) ─
    if (req.method === 'POST' && action === 'register') {
      const clientIp = getClientIp(req);
      const rl = await checkRateLimit(`reg:${clientIp}`, 5, 3600000); // 5 cadastros por hora por IP
      if (!rl.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Muitos cadastros a partir deste endereço IP. Aguarde antes de tentar novamente.'
        });
      }

      const { nome, username, email, password, senha, empresaNome, cnpj, telefone } = req.body || {};
      const userPass = (password || senha || '').trim();
      const rawNome = (nome || '').trim();
      const rawUsername = (username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const rawEmail = (email || '').trim().toLowerCase();

      if (!rawNome || !rawUsername || !userPass || !rawEmail) {
        return res.status(400).json({ success: false, message: 'Nome, usuário, e-mail e senha são obrigatórios.' });
      }

      if (!rawEmail.includes('@') || !rawEmail.includes('.')) {
        return res.status(400).json({ success: false, message: 'Informe um endereço de e-mail válido.' });
      }

      if (rawUsername.length < 3) {
        return res.status(400).json({ success: false, message: 'O nome de usuário deve ter pelo menos 3 caracteres alfanuméricos.' });
      }

      if (userPass.length < 8) {
        return res.status(400).json({ success: false, message: 'A senha deve ter no mínimo 8 caracteres.' });
      }

      // Verifica se usuário ou e-mail já existe
      const existing = await sql`
        SELECT id, username, email FROM usuarios
        WHERE LOWER(username) = ${rawUsername} OR LOWER(email) = ${rawEmail}
        LIMIT 1;
      `;

      if (existing.length > 0) {
        const isEmail = existing[0].email && existing[0].email.toLowerCase() === rawEmail;
        return res.status(409).json({
          success: false,
          message: isEmail ? 'Este e-mail já está cadastrado.' : 'Este nome de usuário já está em uso. Escolha outro.'
        });
      }

      // Criação Atômica de Tenant, Obra Sede e Usuário Administrador (H-13)
      const newTenantId = 'tenant_' + crypto.randomBytes(6).toString('hex');
      const newUserId = 'usr_' + crypto.randomBytes(6).toString('hex');
      const finalEmpresaNome = (empresaNome || rawNome + ' Empreendimentos').trim();
      const passHash = hashPassword(userPass);

      try {
        // Trava de segurança SaaS: Cadastro público SEMPRE inicia como plano 'trial' e status 'trial'
        await sql`
          INSERT INTO tenants (id, razao_social, nome_fantasia, email, telefone, cnpj, responsavel, plano, status)
          VALUES (
            ${newTenantId},
            ${finalEmpresaNome},
            ${finalEmpresaNome},
            ${rawEmail},
            ${(telefone || '').trim() || null},
            ${(cnpj || '').trim() || null},
            ${rawNome},
            'trial',
            'trial'
          );
        `;

        // Obra de sistema para integridade de lançamentos administrativos
        await sql`
          INSERT INTO obras (id, tenant_id, nome, cliente, status)
          VALUES ('escritorio', ${newTenantId}, 'Sede / Escritório Central', 'Administrativo', 'sistema')
          ON CONFLICT (tenant_id, id) DO NOTHING;
        `;

        await sql`
          INSERT INTO usuarios (id, tenant_id, username, email, senha_hash, nome, perfil, avatar, ativo)
          VALUES (
            ${newUserId},
            ${newTenantId},
            ${rawUsername},
            ${rawEmail},
            ${passHash},
            ${rawNome},
            'admin',
            ${rawNome.slice(0, 2).toUpperCase()},
            TRUE
          );
        `;
      } catch (atomicErr) {
        // Rollback compensatório para evitar tenants ou obras órfãs
        try {
          await sql`DELETE FROM usuarios WHERE tenant_id = ${newTenantId};`;
          await sql`DELETE FROM obras WHERE tenant_id = ${newTenantId};`;
          await sql`DELETE FROM tenants WHERE id = ${newTenantId};`;
        } catch {}
        throw atomicErr;
      }

      const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 dias
      const sessionId = await createAuthSession(sql, req, { userId:newUserId, tenantId:newTenantId, remember:true, exp });
      const payload = {
        userId: newUserId,
        username: rawUsername,
        email: rawEmail,
        nome: rawNome,
        perfil: 'admin',
        tenantId: newTenantId,
        tenantStatus: 'trial',
        empresaNome: finalEmpresaNome,
        avatar: rawNome.slice(0, 2).toUpperCase(),
        permissions: {},
        sessionId,
        exp
      };

      const token = signToken(payload, secret);
      setSessionCookie(req, res, token, exp);

      return res.status(200).json({
        success: true,
        ...tokenFieldForExplicitClient(req, token),
        user: {
          id: newUserId,
          username: rawUsername,
          email: rawEmail,
          nome: rawNome,
          perfil: 'admin',
          avatar: payload.avatar,
          tenantId: newTenantId,
          empresaNome: finalEmpresaNome,
          permissions: {},
          sessionId,
          remember: true
        }
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

      // Verifica se usuário já existe
      const existing = await sql`
        SELECT u.*, t.razao_social, t.nome_fantasia, t.status as tenant_status, t.created_at as tenant_created_at, t.vencimento as tenant_vencimento
        FROM usuarios u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE LOWER(u.email) = ${email} OR (u.google_sub IS NOT NULL AND u.google_sub = ${googleSub})
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
            message: 'Acesso da empresa bloqueado. Contate o suporte comercial FinObra.'
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
        // Provisiona novo Tenant isolado para novo usuário Google
        isNew = true;
        const newTenantId = 'tenant_g_' + crypto.randomBytes(6).toString('hex');
        const newUserId = 'usr_g_' + crypto.randomBytes(6).toString('hex');
        const cleanUser = email.split('@')[0].replace(/[^a-z0-9._-]/g, '') + '_' + crypto.randomBytes(2).toString('hex');
        const randomPassHash = hashPassword(crypto.randomBytes(32).toString('hex'));

        await sql`
          INSERT INTO tenants (id, razao_social, nome_fantasia, email, responsavel, plano, status)
          VALUES (
            ${newTenantId},
            ${nome + ' Construtora LTDA'},
            ${nome + ' Construtora'},
            ${email},
            ${nome},
            'trial',
            'trial'
          );
        `;

        await sql`
          INSERT INTO usuarios (id, tenant_id, username, email, senha_hash, nome, perfil, avatar, ativo, google_auth, google_sub)
          VALUES (
            ${newUserId},
            ${newTenantId},
            ${cleanUser},
            ${email},
            ${randomPassHash},
            ${nome},
            'admin',
            ${picture || nome.slice(0, 2).toUpperCase()},
            TRUE,
            TRUE,
            ${googleSub}
          );
        `;

        userRecord = {
          id: newUserId,
          username: cleanUser,
          email,
          nome,
          perfil: 'admin',
          avatar: picture || nome.slice(0, 2).toUpperCase(),
          tenant_id: newTenantId,
          tenant_status: 'trial',
          nome_fantasia: nome + ' Construtora',
          permissoes: {}
        };
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

    // ── 4. POST /api/auth?action=request_reset (Gera OTP Seguro no Neon com Rate Limiting)
    if (req.method === 'POST' && action === 'request_reset') {
      const clientIp = getClientIp(req);
      const rlReset = await checkRateLimit(`reset:${clientIp}`, 5, 60000);
      if (!rlReset.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Muitas tentativas de recuperação a partir deste IP. Aguarde 1 minuto.'
        });
      }

      const { identificador } = req.body || {};
      if (!identificador || !identificador.trim()) {
        return res.status(400).json({ success: false, message: 'Informe seu usuário ou e-mail cadastrado.' });
      }

      const clean = identificador.trim().toLowerCase();
      const rows = await sql`
        SELECT u.id, u.username, u.email, u.nome, u.tenant_id,
               t.telefone as tenant_telefone, t.nome_fantasia
        FROM usuarios u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE (LOWER(u.username) = ${clean} OR LOWER(u.email) = ${clean}) AND u.ativo = TRUE
        LIMIT 1;
      `;

      if (!rows.length) {
        // Prevenção contra Enumeração de Contas (H-09): responde com status 200 genérico idêntico
        return res.status(200).json({
          success: true,
          message: 'Se o usuário ou e-mail informado estiver cadastrado em nosso sistema, as instruções e o código de recuperação foram encaminhados com sucesso.',
          canalInfo: 'Canal seguro cadastrado',
          whatsappSent: false
        });
      }

      const user = rows[0];

      // Limite rigoroso de tentativas por conta (máximo 3 em 15 minutos)
      const recentOtpCount = await sql`
        SELECT COUNT(*) as count FROM recuperacao_senhas
        WHERE usuario_id = ${user.id} AND created_at > NOW() - INTERVAL '15 minutes';
      `;
      if (Number(recentOtpCount[0]?.count || 0) >= 3) {
        return res.status(429).json({
          success: false,
          message: 'Limite de solicitações de código atingido para esta conta (máximo 3 a cada 15 minutos). Aguarde para tentar novamente.'
        });
      }

      // Invalida solicitações anteriores ainda ativas
      await sql`
        UPDATE recuperacao_senhas
        SET usado = TRUE
        WHERE usuario_id = ${user.id} AND usado = FALSE;
      `;

      // Gera código de 6 dígitos numéricos aleatórios
      const otpCode = crypto.randomInt(100000, 999999).toString();
      const otpHash = hashPassword(otpCode);
      const resetId = 'rec_' + crypto.randomBytes(8).toString('hex');
      const expiraEm = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

      await sql`
        INSERT INTO recuperacao_senhas (id, usuario_id, codigo_hash, expira_em)
        VALUES (${resetId}, ${user.id}, ${otpHash}, ${expiraEm.toISOString()});
      `;

      // Envia notificação via WhatsApp para o telefone cadastrado da empresa
      const destPhone = (user.tenant_telefone || '').replace(/\D/g, '');
      let whatsappSent = false;
      let whatsappError = null;

      if (destPhone) {
        const numFmt = destPhone.startsWith('55') ? destPhone : `55${destPhone}`;
        const mensagemOtp = `*FinObra — Código de Verificação*\n\nOlá, ${user.nome}!\n\nSeu código seguro para redefinir sua senha é:\n\n👉 *${otpCode}*\n\nEste código é válido por *10 minutos*. Se você não solicitou esta redefinição, ignore esta mensagem.`;

        try {
          const waResp = await fetch('https://finan-wf12.onrender.com/send-message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': secret,
              'x-tenant-id': user.tenant_id
            },
            body: JSON.stringify({
              tenantId: user.tenant_id,
              phone: numFmt,
              message: mensagemOtp
            })
          });

          const waData = await waResp.json().catch(() => ({}));
          if (waResp.ok && waData.success) {
            whatsappSent = true;
          } else {
            whatsappError = waData.error || 'Falha no gateway WhatsApp';
          }
        } catch (errWa) {
          whatsappError = errWa.message;
        }
      }

      // Formata mensagem informativa amigável sem expor o código
      let canalInfo = '';
      if (destPhone && destPhone.length >= 8) {
        const ddd = destPhone.slice(-11, -9) || destPhone.slice(0, 2);
        const final = destPhone.slice(-4);
        canalInfo = `WhatsApp (**${ddd}) *****-${final}`;
      } else if (user.email) {
        const parts = user.email.split('@');
        const ini = parts[0].slice(0, 2);
        canalInfo = `E-mail (${ini}***@${parts[1]})`;
      } else {
        canalInfo = 'WhatsApp cadastrado da sua empresa';
      }

      return res.status(200).json({
        success: true,
        userId: user.id,
        userName: user.nome,
        canalInfo,
        whatsappSent,
        whatsappError
      });
    }

    // ── 5. POST /api/auth?action=verify_reset (Valida OTP e altera senha) ─────────
    if (req.method === 'POST' && action === 'verify_reset') {
      const { userId, code, newPassword } = req.body || {};
      const verifyIp = getClientIp(req);
      const verifyRl = await checkRateLimit(`verify-reset:${verifyIp}:${String(userId || '').slice(0,80)}`, 15, 10 * 60 * 1000);
      if (!verifyRl.allowed) {
        return res.status(429).json({ success:false, message:'Muitas tentativas de validação. Aguarde alguns minutos e tente novamente.' });
      }
      if (!userId || !code || !newPassword) {
        return res.status(400).json({ success: false, message: 'Dados incompletos para redefinição de senha.' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'A nova senha deve ter no mínimo 8 caracteres.' });
      }

      const activeResets = await sql`
        SELECT * FROM recuperacao_senhas
        WHERE usuario_id = ${userId} AND usado = FALSE AND expira_em > NOW()
        ORDER BY created_at DESC
        LIMIT 1;
      `;

      if (!activeResets.length) {
        return res.status(400).json({ success: false, message: 'Código expirado ou inválido. Solicite um novo código.' });
      }

      const rec = activeResets[0];
      if (rec.tentativas >= rec.max_tentativas) {
        await sql`UPDATE recuperacao_senhas SET usado = TRUE WHERE id = ${rec.id};`;
        return res.status(403).json({ success: false, message: 'Limite de tentativas excedido por segurança. Solicite um novo código.' });
      }

      const codeMatches = verifyPassword(code.toString().trim(), rec.codigo_hash);
      if (!codeMatches) {
        await sql`UPDATE recuperacao_senhas SET tentativas = tentativas + 1 WHERE id = ${rec.id};`;
        const restantes = rec.max_tentativas - (rec.tentativas + 1);
        return res.status(401).json({
          success: false,
          message: `Código incorreto. Você tem mais ${restantes > 0 ? restantes : 0} tentativa(s).`
        });
      }

      // Código válido: marca como usado, atualiza senha com novo scrypt hash e revoga sessões anteriores (H-12)
      const newHash = hashPassword(newPassword);
      await sql`
        UPDATE recuperacao_senhas SET usado = TRUE WHERE id = ${rec.id};
      `;
      await sql`
        UPDATE usuarios SET senha_hash = ${newHash}, updated_at = NOW() WHERE id = ${userId};
      `;
      await sql`
        UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = ${userId} AND revoked_at IS NULL;
      `;

      return res.status(200).json({
        success: true,
        message: 'Senha redefinida com sucesso! Você já pode realizar login.'
      });
    }

    return res.status(400).json({ success: false, error: `Ação '${action}' inválida para /api/auth.` });
  } catch (err) {
    console.error('Erro na API de autenticação:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao processar autenticação.', detail: err.message });
  }
}
