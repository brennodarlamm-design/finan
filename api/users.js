// api/users.js — Gestão de usuários por tenant (Neon)
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { hashPassword, verifyPassword, resolveAuthAndTenant } from './_auth.js';
import { writeAudit } from './_audit.js';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

function cors(req, res) {
  const allowed = ['https://finobra.app.br','https://www.finobra.app.br','http://localhost:3000','http://localhost:3333','http://localhost:5000','http://127.0.0.1:3000','http://127.0.0.1:3333','http://127.0.0.1:5000'];
  const origin = req.headers.origin;
  if (origin && (allowed.includes(origin) || origin.endsWith('.vercel.app'))) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
}

const safeUser = u => ({
  id: u.id, username: u.username, email: u.email || '', nome: u.nome,
  perfil: u.perfil, avatar: u.avatar || (u.nome || 'US').slice(0,2).toUpperCase(),
  ativo: !!u.ativo, tenantId: u.tenant_id, googleAuth: !!u.google_auth,
  created_at: u.created_at
});

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success:false, error:auth.error });
  if (auth.isSystem) return res.status(403).json({ success:false, error:'Use uma sessão de usuário para gerenciar usuários.' });

  const sql = getSql();
  const actorIsAdmin = ['admin','superadmin'].includes(auth.user.perfil);
  const action = req.query.action || req.body?.action || '';

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, tenant_id, username, email, nome, perfil, avatar, ativo, google_auth, created_at
        FROM usuarios WHERE tenant_id = ${auth.tenantId}
        ORDER BY CASE WHEN id = ${auth.user.userId} THEN 0 ELSE 1 END, nome ASC;
      `;
      return res.status(200).json({ success:true, users:rows.map(safeUser) });
    }

    if (req.method === 'POST') {
      if (!actorIsAdmin) return res.status(403).json({ success:false, error:'Somente administradores podem criar usuários.' });
      const { nome, username, email, senha, perfil='gestor', avatar='' } = req.body || {};
      const n = String(nome || '').trim();
      const un = String(username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');
      const em = String(email || '').trim().toLowerCase();
      const pw = String(senha || '');
      const allowedProfiles = ['admin','gestor','visualizador','operador'];
      if (!n || un.length < 3 || !em || !em.includes('@') || pw.length < 6) {
        return res.status(400).json({ success:false, error:'Informe nome, usuário (mín. 3), e-mail válido e senha (mín. 6).' });
      }
      if (!allowedProfiles.includes(perfil)) return res.status(400).json({ success:false, error:'Perfil inválido.' });
      const exists = await sql`SELECT id FROM usuarios WHERE LOWER(username)=${un} OR LOWER(email)=${em} LIMIT 1;`;
      if (exists.length) return res.status(409).json({ success:false, error:'Usuário ou e-mail já cadastrado.' });
      const id = 'usr_' + crypto.randomBytes(8).toString('hex');
      const senhaHash = hashPassword(pw);
      const rows = await sql`
        INSERT INTO usuarios (id,tenant_id,username,email,senha_hash,nome,perfil,avatar,ativo)
        VALUES (${id},${auth.tenantId},${un},${em},${senhaHash},${n},${perfil},${String(avatar||'').trim() || n.slice(0,2).toUpperCase()},TRUE)
        RETURNING id,tenant_id,username,email,nome,perfil,avatar,ativo,google_auth,created_at;
      `;
      await writeAudit(sql, req, auth, { acao:'criar', entidade:'usuario', entidadeId:id, depois:safeUser(rows[0]) });
      return res.status(201).json({ success:true, user:safeUser(rows[0]) });
    }

    if (req.method === 'PATCH') {
      const { id, nome, username, email, perfil, avatar, ativo, senha, senha_atual } = req.body || {};
      const targetId = String(id || auth.user.userId);
      const isSelf = targetId === auth.user.userId;
      if (!isSelf && !actorIsAdmin) return res.status(403).json({ success:false, error:'Sem permissão para alterar outro usuário.' });

      const currentRows = await sql`SELECT * FROM usuarios WHERE id=${targetId} AND tenant_id=${auth.tenantId} LIMIT 1;`;
      if (!currentRows.length) return res.status(404).json({ success:false, error:'Usuário não encontrado.' });
      const cur = currentRows[0];
      // Um administrador de tenant nunca pode alterar uma conta superadmin.
      // Apenas outro superadmin autenticado pode fazê-lo.
      if (cur.perfil === 'superadmin' && auth.user.perfil !== 'superadmin') {
        return res.status(403).json({ success:false, error:'Conta superadmin protegida.' });
      }

      const newNome = nome !== undefined ? String(nome).trim() : cur.nome;
      const newUsername = username !== undefined ? String(username).trim().toLowerCase().replace(/[^a-z0-9._-]/g,'') : cur.username;
      const newEmail = email !== undefined ? String(email).trim().toLowerCase() : cur.email;
      const allowedProfiles = ['admin','gestor','visualizador','operador'];
      // Usuário comum pode editar seus próprios dados, mas nunca promover a si mesmo
      // nem reativar/desativar a própria conta via payload manual.
      const newPerfil = actorIsAdmin && perfil !== undefined ? String(perfil) : cur.perfil;
      const newAtivo = actorIsAdmin && ativo !== undefined ? !!ativo : !!cur.ativo;
      const newAvatar = avatar !== undefined ? (String(avatar).trim() || newNome.slice(0,2).toUpperCase()) : cur.avatar;

      if (!newNome || newUsername.length < 3 || !newEmail || !newEmail.includes('@')) return res.status(400).json({ success:false, error:'Dados de usuário inválidos.' });
      if (!allowedProfiles.includes(newPerfil)) return res.status(400).json({ success:false, error:'Perfil inválido.' });
      if (isSelf && !newAtivo) return res.status(400).json({ success:false, error:'Você não pode desativar sua própria conta.' });

      const dup = await sql`SELECT id FROM usuarios WHERE id<>${targetId} AND (LOWER(username)=${newUsername} OR LOWER(email)=${newEmail}) LIMIT 1;`;
      if (dup.length) return res.status(409).json({ success:false, error:'Usuário ou e-mail já utilizado.' });

      let senhaHash = cur.senha_hash;
      if (senha) {
        if (String(senha).length < 6) return res.status(400).json({ success:false, error:'A nova senha deve ter no mínimo 6 caracteres.' });
        if (isSelf && !actorIsAdmin) {
          if (!senha_atual || !verifyPassword(String(senha_atual), cur.senha_hash)) return res.status(403).json({ success:false, error:'Senha atual incorreta.' });
        }
        // Mesmo admin alterando a própria senha deve confirmar a atual.
        if (isSelf && actorIsAdmin && (!senha_atual || !verifyPassword(String(senha_atual), cur.senha_hash))) {
          return res.status(403).json({ success:false, error:'Senha atual incorreta.' });
        }
        senhaHash = hashPassword(String(senha));
      }

      const rows = await sql`
        UPDATE usuarios SET
          nome=${newNome}, username=${newUsername}, email=${newEmail}, perfil=${newPerfil},
          avatar=${newAvatar}, ativo=${newAtivo}, senha_hash=${senhaHash}, updated_at=NOW()
        WHERE id=${targetId} AND tenant_id=${auth.tenantId}
        RETURNING id,tenant_id,username,email,nome,perfil,avatar,ativo,google_auth,created_at;
      `;
      await writeAudit(sql, req, auth, { acao:'atualizar', entidade:'usuario', entidadeId:targetId, antes:safeUser(cur), depois:safeUser(rows[0]) });
      return res.status(200).json({ success:true, user:safeUser(rows[0]) });
    }

    return res.status(405).json({ success:false, error:'Método não permitido.' });
  } catch (err) {
    console.error('[Users API]', err);
    return res.status(500).json({ success:false, error:'Erro interno ao gerenciar usuários.' });
  }
}
