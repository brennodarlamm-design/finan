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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey, x-tenant-id');
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

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sql = getSql();
  const secret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();

  try {
    const action = req.query.action || (req.body && req.body.action);

    // ── 1. GET /api/auth?action=me (Sessão atual do usuário autenticado) ─────────
    if (req.method === 'GET' && action === 'me') {
      const auth = await resolveAuthAndTenant(req);
      if (!auth.authenticated) {
        return res.status(auth.status || 401).json({ success: false, error: auth.error });
      }

      if (auth.isSystem) {
        return res.status(200).json({
          success: true,
          user: auth.user,
          tenant: { id: auth.tenantId, nome_fantasia: 'Sistema Interno' }
        });
      }

      const users = await sql`
        SELECT u.id, u.username, u.email, u.nome, u.perfil, u.avatar, u.tenant_id,
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
      return res.status(200).json({
        success: true,
        user: {
          id: u.id,
          username: u.username,
          email: u.email,
          nome: u.nome,
          perfil: u.perfil,
          avatar: u.avatar || u.nome.slice(0, 2).toUpperCase(),
          tenantId: u.tenant_id,
          empresaNome: u.nome_fantasia || u.razao_social || 'Minha Empresa'
        },
        tenant: {
          id: u.tenant_id,
          razao_social: u.razao_social,
          nome_fantasia: u.nome_fantasia,
          cnpj: u.cnpj,
          telefone: u.telefone,
          plano: u.plano,
          status: u.tenant_status
        }
      });
    }

    // ── 2. POST /api/auth?action=login ──────────────────────────────────────────
    if (req.method === 'POST' && action === 'login') {
      const clientIp = getClientIp(req);
      const rl = checkRateLimit(`login:${clientIp}`, 10, 60000);
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
        SELECT u.id, u.username, u.email, u.senha_hash, u.nome, u.perfil, u.avatar, u.ativo, u.tenant_id,
               t.razao_social, t.nome_fantasia, t.status as tenant_status, t.created_at as tenant_created_at
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
      if (user.tenant_status === 'trial' && user.tenant_created_at) {
        const trialDays = 15;
        const diffMs = Date.now() - new Date(user.tenant_created_at).getTime();
        if (diffMs > trialDays * 24 * 60 * 60 * 1000) {
          return res.status(403).json({
            success: false,
            message: 'Seu período de teste gratuito de 15 dias expirou. Faça o upgrade de plano para continuar.'
          });
        }
      }

      const passwordMatches = verifyPassword(password, user.senha_hash);
      if (!passwordMatches) {
        return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
      }

      // Expiração da sessão: 30 dias para "lembrar-me", 2 dias padrão
      const durationDays = remember ? 30 : 2;
      const exp = Date.now() + durationDays * 24 * 60 * 60 * 1000;

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
        exp
      };

      const token = signToken(payload, secret);

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nome: user.nome,
          perfil: user.perfil,
          avatar: payload.avatar,
          tenantId: user.tenant_id,
          empresaNome: payload.empresaNome,
          remember: !!remember
        }
      });
    }

    // ── 3. POST /api/auth?action=register (Cadastro de novo Tenant SaaS no Neon) ─
    if (req.method === 'POST' && action === 'register') {
      const clientIp = getClientIp(req);
      const rl = checkRateLimit(`reg:${clientIp}`, 5, 3600000); // 5 cadastros por hora por IP
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

      if (userPass.length < 6) {
        return res.status(400).json({ success: false, message: 'A senha deve ter no mínimo 6 caracteres.' });
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

      // Cria Tenant e Usuário Isolados
      const newTenantId = 'tenant_' + crypto.randomBytes(6).toString('hex');
      const newUserId = 'usr_' + crypto.randomBytes(6).toString('hex');
      const finalEmpresaNome = (empresaNome || rawNome + ' Empreendimentos').trim();
      const passHash = hashPassword(userPass);

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

      const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 dias
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
        exp
      };

      const token = signToken(payload, secret);

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: newUserId,
          username: rawUsername,
          email: rawEmail,
          nome: rawNome,
          perfil: 'admin',
          avatar: payload.avatar,
          tenantId: newTenantId,
          empresaNome: finalEmpresaNome,
          remember: true
        }
      });
    }

    // ── 3.1 POST /api/auth?action=google (Autenticação Google com Verificação Criptográfica RSA)
    if (req.method === 'POST' && action === 'google') {
      const { credentialJwt } = req.body || {};
      if (!credentialJwt) {
        return res.status(400).json({ success: false, message: 'Token de credencial Google é obrigatório.' });
      }

      let profile = null;
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credentialJwt,
          audience: process.env.GOOGLE_CLIENT_ID
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
        SELECT u.*, t.razao_social, t.nome_fantasia, t.status as tenant_status, t.created_at as tenant_created_at
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
        if (userRecord.tenant_status === 'trial' && userRecord.tenant_created_at) {
          const trialMs = 15 * 24 * 60 * 60 * 1000;
          if (Date.now() > new Date(userRecord.tenant_created_at).getTime() + trialMs) {
            return res.status(403).json({ success:false, message:'Seu período de teste gratuito de 15 dias expirou. Faça o upgrade para continuar.' });
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
          nome_fantasia: nome + ' Construtora'
        };
      }

      const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 dias
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
        exp
      };

      const token = signToken(payload, secret);

      return res.status(200).json({
        success: true,
        token,
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
          remember: true
        }
      });
    }

    // ── 4. POST /api/auth?action=request_reset (Gera OTP Seguro no Neon com Rate Limiting)
    if (req.method === 'POST' && action === 'request_reset') {
      const clientIp = getClientIp(req);
      const rlReset = checkRateLimit(`reset:${clientIp}`, 5, 60000);
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
        return res.status(404).json({ success: false, message: 'Nenhuma conta localizada com este usuário ou e-mail.' });
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
              'x-api-key': secret
            },
            body: JSON.stringify({
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
      if (!userId || !code || !newPassword) {
        return res.status(400).json({ success: false, message: 'Dados incompletos para redefinição de senha.' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' });
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

      // Código válido: marca como usado e atualiza senha com novo scrypt hash
      await sql`UPDATE recuperacao_senhas SET usado = TRUE WHERE id = ${rec.id};`;
      const newHash = hashPassword(newPassword);
      await sql`UPDATE usuarios SET senha_hash = ${newHash}, updated_at = NOW() WHERE id = ${userId};`;

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
