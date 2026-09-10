// api/users.js — Gestão de usuários por tenant (Neon)
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { hashPassword, verifyPassword, resolveAuthAndTenant } from './_auth.js';
import { writeAudit } from './_audit.js';
import { canManageUsers, canManageTenant, permissionError } from './_permissions.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';

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


const SUPPORT_STATUSES = new Set(['bot','waiting','assigned','resolved','closed']);
const cleanSupportText = (v, max=4000) => String(v ?? '').replace(/\0/g, '').trim().slice(0, max);
const wantsHumanSupport = text => /\b(atendente|humano|pessoa|especialista|falar com algu[eé]m|suporte humano|chamar suporte|chamar atendente)\b/i.test(String(text || ''));

function supportBotReply(text) {
  const t = String(text || '').toLowerCase();
  if (/(atendente|humano|pessoa|especialista|falar com algu[eé]m)/i.test(t)) return null;
  if (/(nota fiscal|nfe|nf-e|xml|ocr)/i.test(t)) return 'Para NF-e e OCR, abra o módulo de Notas Fiscais. Você pode importar XML, PDF ou imagem; o sistema identifica fornecedor, valores e itens. Se algo não for reconhecido, me diga qual etapa apresentou erro.';
  if (/(mediç|medicao|caixa econômica|caixa economica)/i.test(t)) return 'No módulo Medições você registra o avanço da obra, percentuais e valores medidos. Depois é possível gerar o relatório/boletim da medição. Se quiser, informe o que você está tentando lançar.';
  if (/(ofx|concilia|extrato|banco)/i.test(t)) return 'Na Conciliação OFX, importe o arquivo .OFX gerado pelo banco. O FinObra cruza as transações com os lançamentos e sugere correspondências para conferência.';
  if (/(obra|cliente|contrato da obra|nova obra)/i.test(t)) return 'Para cadastrar uma obra, entre em Obras & Clientes e escolha Nova Obra. Informe cliente, datas, valor/contrato e demais dados. Os limites de obras ativas dependem do seu plano.';
  if (/(fornecedor|cnpj)/i.test(t)) return 'Fornecedores podem ser cadastrados pelo módulo Fornecedores. Informe CNPJ/CPF, razão social, contato, endereço, município e UF. Depois eles ficam disponíveis nos lançamentos e notas.';
  if (/(lançamento|lancamento|receita|despesa|contas a pagar|conta a pagar)/i.test(t)) return 'No Financeiro, use Novo Lançamento para registrar receita ou despesa, vencimento, fornecedor, obra/centro de custo e status. Se quiser, me diga qual tipo de lançamento você precisa fazer.';
  if (/(contrato|recibo)/i.test(t)) return 'Contratos e Recibos ficam salvos na nuvem do seu tenant. Você pode criar, editar, imprimir e, nos planos compatíveis, usar assinatura eletrônica e QR de validação.';
  if (/(assinatura|qr code|validar|validação|validacao)/i.test(t)) return 'A assinatura eletrônica gera um código de validação registrado no servidor. O QR Code leva à página pública de validação, que consulta o registro real no FinObra.';
  if (/(usuário|usuario|perfil|permiss|acesso)/i.test(t)) return 'Em Configurações > Usuários, o administrador pode criar usuários e definir perfis. Administrador tem gestão completa; Gestor opera dados; Operador não exclui; Visualizador é somente leitura.';
  if (/(plano|cobrança|cobranca|pix|mensalidade|pagamento)/i.test(t)) return 'Abra Planos & Cobrança para consultar seu plano, limites e mensalidade. Se houver uma cobrança PIX pendente, ela aparece com valor e identificação próprios.';
  if (/(whatsapp|mensagem)/i.test(t)) return 'O módulo WhatsApp depende da sessão conectada no servidor. Administradores podem gerenciar a conexão e usuários com permissão de escrita podem enviar mensagens permitidas pelo sistema.';
  if (/(erro|bug|não funciona|nao funciona|travou|problema)/i.test(t)) return 'Posso tentar identificar o problema. Informe em qual tela aconteceu, o que você clicou e qual mensagem apareceu. Se preferir atendimento humano, use o botão “Chamar atendente”.';
  return 'Posso ajudar com Obras, Financeiro, NF-e/OCR, Medições, OFX, Fornecedores, Contratos, Recibos, Usuários, Assinaturas, WhatsApp e Planos. Escreva sua dúvida ou clique em “Chamar atendente” para falar com uma pessoa.';
}

function getSupportRenderBaseUrl() {
  const custom = String(process.env.RENDER_WHATSAPP_URL || '').trim();
  return custom ? custom.replace(/\/send-message\/?$/, '').replace(/\/+$/, '') : 'https://finan-wf12.onrender.com';
}

async function notifySupportHuman({ tenantName, userName, conversationId, message }) {
  const tasks = [];
  const notifyPhone = String(process.env.FINOBRA_SUPPORT_WHATSAPP || '5595991363678').replace(/\D/g, '');
  const internalSecret = String(process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();
  if (notifyPhone && internalSecret) {
    const text = `🔔 *FinObra — Atendimento solicitado*\n\nEmpresa: ${tenantName || 'Cliente'}\nUsuário: ${userName || 'Usuário'}\nChamado: ${conversationId}\nMensagem: ${cleanSupportText(message, 500) || 'Cliente solicitou atendimento humano.'}\n\nAbra o painel Master > Central de Atendimento.`;
    tasks.push(fetch(`${getSupportRenderBaseUrl()}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${internalSecret}`, 'x-api-key':internalSecret, 'User-Agent':'FinObra-Support/1.0' },
      body: JSON.stringify({ phone: notifyPhone, number: notifyPhone, message:text, text }),
      signal: AbortSignal.timeout(7000)
    }).catch(() => null));
  }

  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  const emailFrom = String(process.env.FINOBRA_SUPPORT_EMAIL_FROM || '').trim();
  const emailTo = String(process.env.FINOBRA_SUPPORT_EMAIL || 'brennodarlam@gmail.com').trim();
  if (resendKey && emailFrom && emailTo) {
    const html = `<h2>Novo atendimento FinObra</h2><p><strong>Empresa:</strong> ${String(tenantName || 'Cliente').replace(/[<>&]/g,'')}</p><p><strong>Usuário:</strong> ${String(userName || 'Usuário').replace(/[<>&]/g,'')}</p><p><strong>Chamado:</strong> ${conversationId}</p><p><strong>Mensagem:</strong> ${cleanSupportText(message, 1000).replace(/[<>&]/g,'')}</p><p>Abra o painel Master para responder.</p>`;
    tasks.push(fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${resendKey}`, 'Idempotency-Key':`support/${conversationId}` },
      body:JSON.stringify({ from:emailFrom, to:[emailTo], subject:`FinObra: atendimento solicitado — ${tenantName || 'Cliente'}`, html }),
      signal:AbortSignal.timeout(7000)
    }).catch(() => null));
  }
  if (tasks.length) await Promise.allSettled(tasks);
}

async function loadSupportConversation(sql, auth, conversationId='') {
  const rows = conversationId
    ? await sql`SELECT * FROM support_conversations WHERE id=${conversationId} AND tenant_id=${auth.tenantId} AND user_id=${auth.user.userId} LIMIT 1;`
    : await sql`SELECT * FROM support_conversations WHERE tenant_id=${auth.tenantId} AND user_id=${auth.user.userId} AND status IN ('bot','waiting','assigned') ORDER BY updated_at DESC LIMIT 1;`;
  return rows[0] || null;
}

async function loadSupportMessages(sql, auth, conversationId) {
  return sql`
    SELECT id, conversation_id, sender_type, sender_name, body, created_at
    FROM support_messages
    WHERE conversation_id=${conversationId} AND tenant_id=${auth.tenantId}
    ORDER BY created_at ASC, id ASC
    LIMIT 500;
  `;
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success:false, error:auth.error });
  if (auth.isSystem) return res.status(403).json({ success:false, error:'Use uma sessão de usuário para gerenciar usuários.' });

  const sql = getSql();
  const target = req.query.target || req.body?.target || '';

  // ── Central de Suporte do CLIENTE (compartilhada via Neon) ───────────────
  if (target === 'support') {
    if (auth.user?.isImpersonated || auth.user?.impersonatedBy) {
      return res.status(403).json({ success:false, error:'No modo suporte Master, use a Central de Atendimento DEV.' });
    }
    const action = String(req.query.action || req.body?.action || 'current').trim().toLowerCase();
    try {
      if (req.method === 'GET') {
        const conversation = await loadSupportConversation(sql, auth, String(req.query.conversationId || '').trim());
        if (!conversation) return res.status(200).json({ success:true, conversation:null, messages:[] });
        const messages = await loadSupportMessages(sql, auth, conversation.id);
        return res.status(200).json({ success:true, conversation, messages });
      }

      if (req.method !== 'POST') return res.status(405).json({ success:false, error:'Método não permitido.' });

      const rl = checkRateLimit(`support:${auth.tenantId}:${auth.user.userId}:${getClientIp(req)}`, 40, 60000);
      if (!rl.allowed) return res.status(429).json({ success:false, error:'Muitas mensagens em pouco tempo. Aguarde alguns instantes.' });

      if (action === 'start') {
        let conversation = await loadSupportConversation(sql, auth);
        if (!conversation) {
          const id = 'sup_' + crypto.randomBytes(10).toString('hex');
          const rows = await sql`
            INSERT INTO support_conversations (id,tenant_id,user_id,status,last_message_at,created_at,updated_at)
            VALUES (${id},${auth.tenantId},${auth.user.userId},'bot',NOW(),NOW(),NOW())
            RETURNING *;
          `;
          conversation = rows[0];
          await sql`
            INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_user_id,sender_name,body)
            VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${id},${auth.tenantId},'bot',NULL,'FinBot',${`Olá, ${auth.user.nome || 'tudo bem'}! Sou o FinBot, assistente do FinObra. Posso responder dúvidas sobre o sistema. Se preferir falar com uma pessoa, clique em “Chamar atendente”.`});
          `;
        }
        const messages = await loadSupportMessages(sql, auth, conversation.id);
        return res.status(200).json({ success:true, conversation, messages });
      }

      const conversationId = cleanSupportText(req.body?.conversationId, 80);
      if (!conversationId) return res.status(400).json({ success:false, error:'Conversa não informada.' });
      let conversation = await loadSupportConversation(sql, auth, conversationId);
      if (!conversation) return res.status(404).json({ success:false, error:'Conversa não encontrada.' });

      if (action === 'message') {
        const text = cleanSupportText(req.body?.text, 4000);
        if (!text) return res.status(400).json({ success:false, error:'Digite uma mensagem.' });
        await sql`
          INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_user_id,sender_name,body)
          VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversation.id},${auth.tenantId},'client',${auth.user.userId},${auth.user.nome || auth.user.username || 'Cliente'},${text});
        `;
        await sql`UPDATE support_conversations SET last_message_at=NOW(), updated_at=NOW() WHERE id=${conversation.id};`;

        if (wantsHumanSupport(text) && conversation.status === 'bot') {
          await sql`UPDATE support_conversations SET status='waiting', human_requested_at=COALESCE(human_requested_at,NOW()), last_message_at=NOW(), updated_at=NOW() WHERE id=${conversation.id};`;
          await sql`
            INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_name,body)
            VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversation.id},${auth.tenantId},'system','FinObra',${'Atendimento humano solicitado. Sua conversa entrou na fila do suporte.'});
          `;
        } else if (conversation.status === 'bot') {
          const reply = supportBotReply(text);
          if (reply) {
            await sql`
              INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_name,body)
              VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversation.id},${auth.tenantId},'bot','FinBot',${reply});
            `;
            await sql`UPDATE support_conversations SET last_message_at=NOW(), updated_at=NOW() WHERE id=${conversation.id};`;
          }
        }

        conversation = await loadSupportConversation(sql, auth, conversation.id);
        if (conversation.status === 'waiting' && !conversation.notified_at) {
          const tenantRows = await sql`SELECT COALESCE(nome_fantasia,razao_social,id) AS nome FROM tenants WHERE id=${auth.tenantId} LIMIT 1;`;
          await notifySupportHuman({ tenantName:tenantRows[0]?.nome, userName:auth.user.nome, conversationId:conversation.id, message:text });
          await sql`UPDATE support_conversations SET notified_at=NOW() WHERE id=${conversation.id} AND notified_at IS NULL;`;
        }
        const messages = await loadSupportMessages(sql, auth, conversation.id);
        return res.status(200).json({ success:true, conversation, messages });
      }

      if (action === 'escalate') {
        if (conversation.status === 'bot') {
          await sql`UPDATE support_conversations SET status='waiting', human_requested_at=COALESCE(human_requested_at,NOW()), last_message_at=NOW(), updated_at=NOW() WHERE id=${conversation.id};`;
          await sql`
            INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_name,body)
            VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversation.id},${auth.tenantId},'system','FinObra',${'Atendimento humano solicitado. Sua conversa entrou na fila do suporte.'});
          `;
        }
        conversation = await loadSupportConversation(sql, auth, conversation.id);
        if (!conversation.notified_at) {
          const tenantRows = await sql`SELECT COALESCE(nome_fantasia,razao_social,id) AS nome FROM tenants WHERE id=${auth.tenantId} LIMIT 1;`;
          const lastRows = await sql`SELECT body FROM support_messages WHERE conversation_id=${conversation.id} AND sender_type='client' ORDER BY created_at DESC LIMIT 1;`;
          await notifySupportHuman({ tenantName:tenantRows[0]?.nome, userName:auth.user.nome, conversationId:conversation.id, message:lastRows[0]?.body || 'Cliente solicitou atendimento humano.' });
          await sql`UPDATE support_conversations SET notified_at=NOW() WHERE id=${conversation.id} AND notified_at IS NULL;`;
        }
        const messages = await loadSupportMessages(sql, auth, conversation.id);
        return res.status(200).json({ success:true, conversation, messages, notified:true });
      }

      if (action === 'close') {
        await sql`UPDATE support_conversations SET status='closed', resolved_at=COALESCE(resolved_at,NOW()), updated_at=NOW() WHERE id=${conversation.id};`;
        await sql`
          INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_name,body)
          VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversation.id},${auth.tenantId},'system','FinObra',${'Conversa encerrada pelo cliente.'});
        `;
        return res.status(200).json({ success:true });
      }

      return res.status(400).json({ success:false, error:'Ação de suporte desconhecida.' });
    } catch (err) {
      console.error('[Support Client API]', err);
      return res.status(500).json({ success:false, error:'Não foi possível acessar o atendimento agora.' });
    }
  }

  // ── Integração Transparente com /api/tenant (limite 12 funções Vercel) ──
  if (target === 'tenant') {
    const pickTenant = t => ({
      id: t.id,
      razao_social: t.razao_social || '',
      nome_fantasia: t.nome_fantasia || '',
      cnpj: t.cnpj || '',
      telefone: t.telefone || '',
      email: t.email || '',
      cidade: t.cidade || '',
      uf: t.uf || '',
      endereco: t.endereco || '',
      responsavel: t.responsavel || '',
      logo_url: t.logo_url || '',
      crea_cau: t.crea_cau || '',
      plano: t.plano || 'trial',
      status: t.status || 'trial',
      vencimento: t.vencimento ? String(t.vencimento).slice(0, 10) : '',
      created_at: t.created_at
    });

    try {
      const rows = await sql`SELECT * FROM tenants WHERE id=${auth.tenantId} LIMIT 1;`;
      if (!rows.length) return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
      if (req.method === 'GET') return res.status(200).json({ success: true, tenant: pickTenant(rows[0]) });
      if (req.method === 'PATCH') {
        if (!canManageTenant(auth)) return res.status(403).json(permissionError('ROLE_MANAGE_TENANT_FORBIDDEN'));
        const b = req.body || {};
        const before = pickTenant(rows[0]);
        const nome = String(b.nome_fantasia ?? before.nome_fantasia).trim();
        const razao = String(b.razao_social ?? before.razao_social ?? nome).trim();
        if (!nome) return res.status(400).json({ success: false, error: 'Nome fantasia é obrigatório.' });
        const uf = String(b.uf ?? before.uf).trim().toUpperCase().slice(0, 2);
        const updated = await sql`
          UPDATE tenants SET
            nome_fantasia=${nome}, razao_social=${razao || nome}, cnpj=${String(b.cnpj ?? before.cnpj).trim() || null},
            telefone=${String(b.telefone ?? before.telefone).trim() || null}, email=${String(b.email ?? before.email).trim().toLowerCase() || null},
            cidade=${String(b.cidade ?? before.cidade).trim() || null}, uf=${uf || null}, endereco=${String(b.endereco ?? before.endereco).trim() || null},
            responsavel=${String(b.responsavel ?? before.responsavel).trim() || null}, logo_url=${String(b.logo_url ?? before.logo_url).trim() || null},
            crea_cau=${String(b.crea_cau ?? before.crea_cau).trim() || null}, updated_at=NOW()
          WHERE id=${auth.tenantId}
          RETURNING *;
        `;
        const after = pickTenant(updated[0]);
        await writeAudit(sql, req, auth, { acao: 'atualizar', entidade: 'tenant', entidadeId: auth.tenantId, antes: before, depois: after });
        return res.status(200).json({ success: true, tenant: after });
      }
      return res.status(405).json({ success: false, error: 'Método não permitido.' });
    } catch (err) {
      console.error('[Tenant API]', err);
      return res.status(500).json({ success: false, error: 'Erro interno ao atualizar a empresa.' });
    }
  }

  const actorIsAdmin = canManageUsers(auth);
  const action = req.query.action || req.body?.action || '';

  try {
    if (req.method === 'GET') {
      const rows = actorIsAdmin
        ? await sql`
            SELECT id, tenant_id, username, email, nome, perfil, avatar, ativo, google_auth, created_at
            FROM usuarios WHERE tenant_id = ${auth.tenantId}
            ORDER BY CASE WHEN id = ${auth.user.userId} THEN 0 ELSE 1 END, nome ASC;
          `
        : await sql`
            SELECT id, tenant_id, username, email, nome, perfil, avatar, ativo, google_auth, created_at
            FROM usuarios WHERE tenant_id = ${auth.tenantId} AND id = ${auth.user.userId}
            LIMIT 1;
          `;
      return res.status(200).json({ success:true, users:rows.map(safeUser), limited:!actorIsAdmin });
    }

    if (req.method === 'POST') {
      if (!actorIsAdmin) return res.status(403).json(permissionError('ROLE_MANAGE_USERS_FORBIDDEN'));
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

      // Evita deixar a empresa sem nenhum administrador ativo, o que bloquearia a gestão de usuários/empresa.
      if (cur.perfil === 'admin' && cur.ativo && (newPerfil !== 'admin' || !newAtivo)) {
        const otherAdmins = await sql`
          SELECT COUNT(*)::int AS total
          FROM usuarios
          WHERE tenant_id=${auth.tenantId} AND id<>${targetId} AND perfil='admin' AND ativo=TRUE;
        `;
        if (Number(otherAdmins[0]?.total || 0) < 1) {
          return res.status(409).json({ success:false, code:'LAST_ADMIN', error:'A empresa precisa manter pelo menos um administrador ativo. Crie ou promova outro administrador antes desta alteração.' });
        }
      }

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
