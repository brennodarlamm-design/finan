// api/auth.js — Endpoint Serverless de Autenticação Segura, Google OAuth e Recuperação de Senha

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { hashPassword, verifyPassword, signToken, resolveAuthAndTenant } from './_auth.js';

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
  } catch {
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
      const auth = resolveAuthAndTenant(req);
      if (!auth.authenticated) {
        return res.status(401).json({ success: false, error: auth.error });
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
      const { username, password, remember } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios.' });
      }

      const cleanUser = username.trim().toLowerCase();
      const rows = await sql`
        SELECT u.id, u.username, u.email, u.senha_hash, u.nome, u.perfil, u.avatar, u.ativo, u.tenant_id,
               t.razao_social, t.nome_fantasia, t.status as tenant_status
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

    // ── 3. POST /api/auth?action=google ─────────────────────────────────────────
    if (req.method === 'POST' && action === 'google') {
      const { credentialJwt } = req.body || {};
      if (!credentialJwt) {
        return res.status(400).json({ success: false, message: 'Token de autenticação Google obrigatório.' });
      }

      const profile = decodeJwtPayload(credentialJwt);
      if (!profile || !profile.email || !profile.sub) {
        return res.status(400).json({ success: false, message: 'Token de credencial Google inválido ou malformado.' });
      }

      const email = profile.email.trim().toLowerCase();
      const nome = profile.name || profile.given_name || email.split('@')[0];
      const picture = profile.picture || '';
      const googleSub = profile.sub || '';

      // Verifica se usuário já existe
      const existing = await sql`
        SELECT u.*, t.razao_social, t.nome_fantasia
        FROM usuarios u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE LOWER(u.email) = ${email} OR (u.google_sub IS NOT NULL AND u.google_sub = ${googleSub})
        LIMIT 1;
      `;

      let userRecord = null;
      let isNew = false;

      if (existing.length > 0) {
        userRecord = existing[0];
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
            'pro',
            'ativo'
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

    // ── 4. POST /api/auth?action=request_reset (Gera OTP Seguro no Neon) ────────
    if (req.method === 'POST' && action === 'request_reset') {
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
