// api/admin.js — Endpoint Serverless para Super Admin Master Backoffice
// Acesso restrito a usuários com perfil 'superadmin' ou chave de sistema

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { hashPassword, resolveAuthAndTenant, signToken } from './_auth.js';
import { writeAudit } from './_audit.js';

function getSql() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    throw new Error('DATABASE_URL não configurada no servidor.');
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey, x-tenant-id');
}

const cleanSupportText = (v, max=4000) => String(v ?? '').replace(/\0/g, '').trim().slice(0, max);

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Validação estrita de autorização: apenas SUPERADMIN ou Chave Mestra de Sistema
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Acesso não autorizado.' });
  }

  const isSuperAdmin = auth.isSystem || (auth.user && auth.user.perfil === 'superadmin');
  if (!isSuperAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Esta rota é restrita exclusivamente ao Super Administrador da plataforma.'
    });
  }

  const sql = getSql();
  const action = req.query.action || (req.body && req.body.action) || 'tenants';

  try {
    // ── Central de Atendimento DEV / Master ──────────────────────────────────
    if (req.method === 'GET' && action === 'support_list') {
      const requestedStatus = String(req.query?.status || 'active').trim().toLowerCase();
      const statusFilter = requestedStatus === 'all' ? null : requestedStatus;
      const rows = statusFilter === 'active'
        ? await sql`
            SELECT c.id, c.tenant_id, c.user_id, c.status, c.assigned_to, c.human_requested_at,
                   c.assigned_at, c.resolved_at, c.last_message_at, c.created_at, c.updated_at,
                   COALESCE(t.nome_fantasia,t.razao_social,c.tenant_id) AS tenant_nome,
                   COALESCE(u.nome,u.username,'Usuário') AS usuario_nome, u.email AS usuario_email,
                   COALESCE(a.nome,a.username,'') AS atendente_nome,
                   lm.body AS ultima_mensagem, lm.sender_type AS ultima_origem, lm.created_at AS ultima_mensagem_em
            FROM support_conversations c
            LEFT JOIN tenants t ON t.id=c.tenant_id
            LEFT JOIN usuarios u ON u.id=c.user_id
            LEFT JOIN usuarios a ON a.id=c.assigned_to
            LEFT JOIN LATERAL (
              SELECT body,sender_type,created_at FROM support_messages m
              WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1
            ) lm ON TRUE
            WHERE c.status IN ('bot','waiting','assigned')
            ORDER BY CASE c.status WHEN 'waiting' THEN 0 WHEN 'assigned' THEN 1 ELSE 2 END, c.last_message_at DESC NULLS LAST
            LIMIT 200;
          `
        : statusFilter
          ? await sql`
              SELECT c.id, c.tenant_id, c.user_id, c.status, c.assigned_to, c.human_requested_at,
                     c.assigned_at, c.resolved_at, c.last_message_at, c.created_at, c.updated_at,
                     COALESCE(t.nome_fantasia,t.razao_social,c.tenant_id) AS tenant_nome,
                     COALESCE(u.nome,u.username,'Usuário') AS usuario_nome, u.email AS usuario_email,
                     COALESCE(a.nome,a.username,'') AS atendente_nome,
                     lm.body AS ultima_mensagem, lm.sender_type AS ultima_origem, lm.created_at AS ultima_mensagem_em
              FROM support_conversations c
              LEFT JOIN tenants t ON t.id=c.tenant_id
              LEFT JOIN usuarios u ON u.id=c.user_id
              LEFT JOIN usuarios a ON a.id=c.assigned_to
              LEFT JOIN LATERAL (
                SELECT body,sender_type,created_at FROM support_messages m
                WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1
              ) lm ON TRUE
              WHERE c.status=${statusFilter}
              ORDER BY c.last_message_at DESC NULLS LAST
              LIMIT 200;
            `
          : await sql`
              SELECT c.id, c.tenant_id, c.user_id, c.status, c.assigned_to, c.human_requested_at,
                     c.assigned_at, c.resolved_at, c.last_message_at, c.created_at, c.updated_at,
                     COALESCE(t.nome_fantasia,t.razao_social,c.tenant_id) AS tenant_nome,
                     COALESCE(u.nome,u.username,'Usuário') AS usuario_nome, u.email AS usuario_email,
                     COALESCE(a.nome,a.username,'') AS atendente_nome,
                     lm.body AS ultima_mensagem, lm.sender_type AS ultima_origem, lm.created_at AS ultima_mensagem_em
              FROM support_conversations c
              LEFT JOIN tenants t ON t.id=c.tenant_id
              LEFT JOIN usuarios u ON u.id=c.user_id
              LEFT JOIN usuarios a ON a.id=c.assigned_to
              LEFT JOIN LATERAL (
                SELECT body,sender_type,created_at FROM support_messages m
                WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1
              ) lm ON TRUE
              ORDER BY c.last_message_at DESC NULLS LAST
              LIMIT 200;
            `;
      const countRows = await sql`
        SELECT
          COUNT(*) FILTER (WHERE status='waiting')::int AS waiting,
          COUNT(*) FILTER (WHERE status='assigned')::int AS assigned,
          COUNT(*) FILTER (WHERE status='bot')::int AS bot,
          COUNT(*) FILTER (WHERE status='resolved' AND resolved_at >= CURRENT_DATE)::int AS resolved_today
        FROM support_conversations;
      `;
      return res.status(200).json({ success:true, conversations:rows, summary:countRows[0] || {} });
    }

    if (req.method === 'GET' && action === 'support_messages') {
      const conversationId = cleanSupportText(req.query?.conversationId, 80);
      if (!conversationId) return res.status(400).json({ success:false, error:'Conversa não informada.' });
      const convRows = await sql`
        SELECT c.*, COALESCE(t.nome_fantasia,t.razao_social,c.tenant_id) AS tenant_nome,
               COALESCE(u.nome,u.username,'Usuário') AS usuario_nome, u.email AS usuario_email,
               COALESCE(a.nome,a.username,'') AS atendente_nome
        FROM support_conversations c
        LEFT JOIN tenants t ON t.id=c.tenant_id
        LEFT JOIN usuarios u ON u.id=c.user_id
        LEFT JOIN usuarios a ON a.id=c.assigned_to
        WHERE c.id=${conversationId} LIMIT 1;
      `;
      if (!convRows.length) return res.status(404).json({ success:false, error:'Conversa não encontrada.' });
      const messages = await sql`
        SELECT id,conversation_id,tenant_id,sender_type,sender_user_id,sender_name,body,created_at
        FROM support_messages WHERE conversation_id=${conversationId}
        ORDER BY created_at ASC,id ASC LIMIT 1000;
      `;
      return res.status(200).json({ success:true, conversation:convRows[0], messages });
    }

    if (req.method === 'POST' && action === 'support_assign') {
      const conversationId = cleanSupportText(req.body?.conversationId, 80);
      if (!conversationId) return res.status(400).json({ success:false, error:'Conversa não informada.' });
      const rows = await sql`
        UPDATE support_conversations SET status='assigned', assigned_to=${auth.user.userId || auth.user.id}, assigned_at=COALESCE(assigned_at,NOW()), updated_at=NOW()
        WHERE id=${conversationId} AND status IN ('bot','waiting','assigned') RETURNING *;
      `;
      if (!rows.length) return res.status(404).json({ success:false, error:'Conversa não encontrada ou já encerrada.' });
      await sql`
        INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_user_id,sender_name,body)
        VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversationId},${rows[0].tenant_id},'system',${auth.user.userId || auth.user.id},'FinObra',${`${auth.user.nome || 'Atendente'} entrou no atendimento.`});
      `;
      await writeAudit(sql, req, { ...auth, tenantId:rows[0].tenant_id }, { acao:'suporte_assumido', entidade:'support_conversation', entidadeId:conversationId, depois:{ atendente:auth.user.nome || auth.user.username } });
      return res.status(200).json({ success:true, conversation:rows[0] });
    }

    if (req.method === 'POST' && action === 'support_reply') {
      const conversationId = cleanSupportText(req.body?.conversationId, 80);
      const text = cleanSupportText(req.body?.text, 4000);
      if (!conversationId || !text) return res.status(400).json({ success:false, error:'Conversa e mensagem são obrigatórias.' });
      const convRows = await sql`SELECT * FROM support_conversations WHERE id=${conversationId} AND status IN ('bot','waiting','assigned') LIMIT 1;`;
      if (!convRows.length) return res.status(404).json({ success:false, error:'Conversa não encontrada ou encerrada.' });
      const conv = convRows[0];
      await sql`
        INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_user_id,sender_name,body)
        VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversationId},${conv.tenant_id},'agent',${auth.user.userId || auth.user.id},${auth.user.nome || auth.user.username || 'Atendente'},${text});
      `;
      await sql`
        UPDATE support_conversations SET status='assigned', assigned_to=${auth.user.userId || auth.user.id}, assigned_at=COALESCE(assigned_at,NOW()), last_message_at=NOW(), updated_at=NOW()
        WHERE id=${conversationId};
      `;
      return res.status(200).json({ success:true });
    }

    if (req.method === 'POST' && action === 'support_resolve') {
      const conversationId = cleanSupportText(req.body?.conversationId, 80);
      if (!conversationId) return res.status(400).json({ success:false, error:'Conversa não informada.' });
      const rows = await sql`UPDATE support_conversations SET status='resolved', resolved_at=NOW(), updated_at=NOW() WHERE id=${conversationId} RETURNING *;`;
      if (!rows.length) return res.status(404).json({ success:false, error:'Conversa não encontrada.' });
      await sql`
        INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_user_id,sender_name,body)
        VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversationId},${rows[0].tenant_id},'system',${auth.user.userId || auth.user.id},'FinObra',${'Atendimento marcado como resolvido.'});
      `;
      await writeAudit(sql, req, { ...auth, tenantId:rows[0].tenant_id }, { acao:'suporte_resolvido', entidade:'support_conversation', entidadeId:conversationId });
      return res.status(200).json({ success:true });
    }

    // ── 1. GET ?action=tenants (Listar Construtoras com Métricas Reais do Neon) ──
    if (req.method === 'GET' && action === 'tenants') {
      const rows = await sql`
        SELECT 
          t.id,
          t.razao_social,
          t.nome_fantasia,
          t.cnpj,
          t.telefone,
          t.email,
          t.responsavel,
          t.plano,
          t.status,
          t.vencimento,
          t.created_at,
          COUNT(DISTINCT o.id) as obras_qtd,
          COUNT(DISTINCT l.id) as lancamentos_qtd,
          COUNT(DISTINCT u.id) as usuarios_qtd
        FROM tenants t
        LEFT JOIN obras o ON t.id = o.tenant_id
        LEFT JOIN lancamentos l ON t.id = l.tenant_id
        LEFT JOIN usuarios u ON t.id = u.tenant_id
        GROUP BY t.id
        ORDER BY t.created_at DESC;
      `;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const tenants = rows.map(r => {
        let vencStr = '';
        if (r.vencimento) {
          const vDate = new Date(r.vencimento);
          if (!isNaN(vDate.getTime())) {
            vencStr = vDate.toISOString().split('T')[0];
          }
        }
        if (!vencStr && r.created_at) {
          const cDate = new Date(r.created_at);
          if (!isNaN(cDate.getTime())) {
            const addDays = (r.status === 'trial' || r.plano === 'trial') ? 15 : 30;
            cDate.setDate(cDate.getDate() + addDays);
            vencStr = cDate.toISOString().split('T')[0];
          }
        }

        let diasRestantes = null;
        let expirado = false;
        if (vencStr) {
          const target = new Date(vencStr + 'T00:00:00');
          const diffMs = target.getTime() - hoje.getTime();
          diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          expirado = diasRestantes < 0;
        }

        return {
          id: r.id,
          nome_fantasia: r.nome_fantasia || r.razao_social || 'Construtora',
          razao_social: r.razao_social || r.nome_fantasia || '',
          cnpj: r.cnpj || '—',
          responsavel: r.responsavel || 'Administrador',
          email: r.email || '',
          telefone: r.telefone || '',
          plano: r.plano || 'trial',
          status: r.status || 'ativo',
          vencimento: vencStr,
          diasRestantes,
          expirado,
          obrasQtd: Number(r.obras_qtd || 0),
          lancamentosQtd: Number(r.lancamentos_qtd || 0),
          usuariosQtd: Number(r.usuarios_qtd || 0),
          criadoEm: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
        };
      });

      return res.status(200).json({ success: true, tenants });
    }

    // ── Cobranças SaaS: lista e confirma pagamentos manualmente ───────────────
    if (req.method === 'GET' && action === 'billing') {
      await sql`UPDATE billing_invoices SET status='expired', updated_at=NOW() WHERE status='pending' AND expires_at IS NOT NULL AND expires_at < NOW();`;
      const tenantId = String(req.query?.tenantId || '').trim();
      const rows = await sql`
        SELECT b.id, b.tenant_id, b.plan_id, b.amount_cents, b.status, b.txid,
               b.paid_at, b.expires_at, b.created_at,
               COALESCE(t.nome_fantasia, t.razao_social, b.tenant_id) AS tenant_nome
        FROM billing_invoices b
        LEFT JOIN tenants t ON t.id=b.tenant_id
        WHERE (${tenantId}='' OR b.tenant_id=${tenantId})
        ORDER BY CASE WHEN b.status='pending' THEN 0 ELSE 1 END, b.created_at DESC
        LIMIT 100;
      `;
      const summaryRows = await sql`
        SELECT
          COUNT(*) FILTER (WHERE status='pending')::int AS pending_count,
          COALESCE(SUM(amount_cents) FILTER (WHERE status='pending'),0)::bigint AS pending_cents,
          COALESCE(SUM(amount_cents) FILTER (WHERE status='paid' AND paid_at >= date_trunc('month', NOW())),0)::bigint AS paid_month_cents
        FROM billing_invoices;
      `;
      return res.status(200).json({ success:true, invoices:rows, summary:summaryRows[0] || {} });
    }

    if (req.method === 'POST' && action === 'confirm_payment') {
      const invoiceId = String(req.body?.invoiceId || '').trim();
      if (!invoiceId) return res.status(400).json({ success:false, error:'Cobrança não informada.' });
      const rows = await sql`
        WITH paid AS (
          UPDATE billing_invoices
          SET status='paid', paid_at=NOW(), paid_by=${auth.user?.userId || auth.user?.id || 'system'}, updated_at=NOW()
          WHERE id=${invoiceId} AND status IN ('pending','expired')
          RETURNING id, tenant_id, plan_id, amount_cents, txid, paid_at
        ), tenant_upd AS (
          UPDATE tenants t
          SET plano=paid.plan_id,
              status='ativo',
              vencimento=(CASE WHEN t.vencimento IS NOT NULL AND t.vencimento >= CURRENT_DATE THEN t.vencimento ELSE CURRENT_DATE END + 30)::date,
              updated_at=NOW()
          FROM paid
          WHERE t.id=paid.tenant_id
          RETURNING t.id, t.nome_fantasia, t.plano, t.status, t.vencimento
        )
        SELECT paid.id AS invoice_id, paid.tenant_id, paid.plan_id, paid.amount_cents, paid.txid, paid.paid_at,
               tenant_upd.nome_fantasia, tenant_upd.status, tenant_upd.vencimento
        FROM paid JOIN tenant_upd ON tenant_upd.id=paid.tenant_id;
      `;
      if (!rows.length) return res.status(409).json({ success:false, error:'Cobrança não encontrada ou já processada/cancelada.' });
      const done = rows[0];
      await writeAudit(sql, req, { ...auth, tenantId:done.tenant_id }, {
        acao:'pagamento_confirmado', entidade:'cobranca', entidadeId:done.invoice_id,
        depois:{ plan_id:done.plan_id, amount_cents:Number(done.amount_cents || 0), txid:done.txid, vencimento:done.vencimento }
      });
      return res.status(200).json({ success:true, invoice:done, message:'Pagamento confirmado e assinatura renovada por 30 dias.' });
    }

    // Auditoria explícita do modo suporte/impersonação do Super Admin.
    if (req.method === 'POST' && (action === 'support_start' || action === 'support_end')) {
      const tenantId = String(req.body?.tenantId || '').trim();
      if (!tenantId) return res.status(400).json({ success:false, error:'Tenant de suporte não informado.' });
      const target = await sql`SELECT id, nome_fantasia, razao_social FROM tenants WHERE id=${tenantId} LIMIT 1;`;
      if (!target.length) return res.status(404).json({ success:false, error:'Empresa não encontrada.' });
      const event = action === 'support_start' ? 'suporte_iniciado' : 'suporte_encerrado';
      await writeAudit(sql, req, { ...auth, tenantId }, {
        acao:event, entidade:'suporte_master', entidadeId:tenantId,
        depois:{ empresa:target[0].nome_fantasia || target[0].razao_social || tenantId, superadmin:auth.user?.username || auth.user?.email || 'superadmin' }
      });
      return res.status(200).json({ success:true, tenant:{ id:target[0].id, nome_fantasia:target[0].nome_fantasia || target[0].razao_social } });
    }

    // ── 2. POST ?action=create_tenant (Criar Empresa e Usuário Admin no Neon) ──
    if (req.method === 'POST' && action === 'create_tenant') {
      const {
        nome_fantasia,
        razao_social,
        cnpj,
        responsavel,
        email,
        telefone,
        plano,
        status,
        username,
        senha
      } = req.body || {};

      const finalNome = (nome_fantasia || razao_social || '').trim();
      const finalEmail = (email || '').trim().toLowerCase();
      const finalSenha = (senha || '').trim();

      if (!finalNome || !finalEmail || !finalSenha) {
        return res.status(400).json({
          success: false,
          error: 'Nome da empresa, e-mail e senha inicial são obrigatórios.'
        });
      }

      if (finalSenha.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'A senha inicial deve ter no mínimo 6 caracteres.'
        });
      }

      const rawUser = (username || finalEmail.split('@')[0]).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const allowedPlans = ['trial', 'starter', 'pro', 'unlimited'];
      const finalPlano = String(plano || 'pro').toLowerCase();
      const finalStatus = String(status || 'ativo').toLowerCase();
      if (!allowedPlans.includes(finalPlano)) return res.status(400).json({ success:false, error:'Plano inválido.' });
      if (!['ativo','trial','inadimplente','bloqueado','cancelado'].includes(finalStatus)) return res.status(400).json({ success:false, error:'Status inválido.' });

      // Verifica se o usuário ou email já existe
      const existing = await sql`
        SELECT id FROM usuarios WHERE LOWER(username) = ${rawUser} OR LOWER(email) = ${finalEmail} LIMIT 1;
      `;
      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Este usuário ou e-mail já está cadastrado no sistema.'
        });
      }

      const tenantId = 'tenant_' + crypto.randomBytes(6).toString('hex');
      const userId = 'usr_' + crypto.randomBytes(6).toString('hex');
      const passHash = hashPassword(finalSenha);

      let finalVencimento = String(req.body?.vencimento || '').trim();
      if (!finalVencimento || !/^\d{4}-\d{2}-\d{2}$/.test(finalVencimento)) {
        const dt = new Date();
        dt.setDate(dt.getDate() + (finalStatus === 'trial' ? 15 : 30));
        finalVencimento = dt.toISOString().split('T')[0];
      }

      // Cria Tenant no Neon
      await sql`
        INSERT INTO tenants (id, razao_social, nome_fantasia, cnpj, telefone, email, responsavel, plano, status, vencimento)
        VALUES (
          ${tenantId},
          ${(razao_social || finalNome + ' LTDA').trim()},
          ${finalNome},
          ${(cnpj || '').trim() || null},
          ${(telefone || '').trim() || null},
          ${finalEmail},
          ${(responsavel || 'Administrador').trim()},
          ${finalPlano},
          ${finalStatus},
          ${finalVencimento}
        );
      `;

      // Cria Usuário Administrador da Empresa
      await sql`
        INSERT INTO usuarios (id, tenant_id, username, email, senha_hash, nome, perfil, avatar, ativo)
        VALUES (
          ${userId},
          ${tenantId},
          ${rawUser},
          ${finalEmail},
          ${passHash},
          ${(responsavel || finalNome).trim()},
          'admin',
          ${finalNome.slice(0, 2).toUpperCase()},
          TRUE
        );
      `;

      await writeAudit(sql, req, auth, { acao:'criar', entidade:'tenant', entidadeId:tenantId, depois:{ nome_fantasia:finalNome, email:finalEmail, plano:finalPlano, status:finalStatus, vencimento:finalVencimento } });

      return res.status(201).json({
        success: true,
        message: 'Construtora e usuário administrador criados com sucesso no Neon PostgreSQL!',
        tenant: {
          id: tenantId,
          nome_fantasia: finalNome,
          email: finalEmail,
          plano: finalPlano,
          status: finalStatus,
          vencimento: finalVencimento
        }
      });
    }

    // ── 3. PATCH / POST ?action=update_tenant (Atualizar Status, Plano e Vencimento no Neon) ─
    if ((req.method === 'PATCH' || req.method === 'POST') && action === 'update_tenant') {
      const { tenantId, status, plano, vencimento } = req.body || {};
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Identificador do tenant não informado.' });
      }

      const allowedStatus = ['ativo', 'trial', 'inadimplente', 'bloqueado', 'cancelado'];
      const allowedPlans = ['trial', 'starter', 'pro', 'unlimited'];
      if (status && !allowedStatus.includes(status.toLowerCase())) {
        return res.status(400).json({ success: false, error: `Status "${status}" inválido. Permitidos: ${allowedStatus.join(', ')}` });
      }

      if (plano && !allowedPlans.includes(String(plano).toLowerCase())) {
        return res.status(400).json({ success:false, error:'Plano inválido.' });
      }

      let cleanVenc = null;
      if (vencimento !== undefined && vencimento !== null && vencimento !== '') {
        const v = String(vencimento).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          cleanVenc = v;
        } else {
          return res.status(400).json({ success: false, error: 'Data de vencimento inválida (formato esperado: YYYY-MM-DD).' });
        }
      }

      const beforeRows = await sql`SELECT id, nome_fantasia, plano, status, vencimento FROM tenants WHERE id=${tenantId} LIMIT 1;`;
      if (!beforeRows.length) return res.status(404).json({ success:false, error:'Tenant não encontrado.' });

      const newStatus = status ? status.toLowerCase() : beforeRows[0].status;
      const newPlano = plano ? plano.toLowerCase() : beforeRows[0].plano;
      const newVenc = cleanVenc !== null ? cleanVenc : (beforeRows[0].vencimento ? new Date(beforeRows[0].vencimento).toISOString().split('T')[0] : null);

      await sql`
        UPDATE tenants 
        SET status = ${newStatus}, plano = ${newPlano}, vencimento = ${newVenc}, updated_at = NOW()
        WHERE id = ${tenantId};
      `;

      const afterRows = await sql`SELECT id, nome_fantasia, plano, status, vencimento FROM tenants WHERE id=${tenantId} LIMIT 1;`;
      await writeAudit(sql, req, auth, { acao:'atualizar', entidade:'tenant', entidadeId:tenantId, antes:beforeRows[0], depois:afterRows[0] });
      return res.status(200).json({
        success: true,
        message: 'Dados da construtora atualizados com sucesso no Neon!',
        tenant: afterRows[0]
      });
    }

    // ── 4. POST ?action=impersonate (Gerar Token Seguro para Visualização de Suporte) ──
    if (req.method === 'POST' && action === 'impersonate') {
      const { tenantId } = req.body || {};
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Identificador do tenant não informado.' });
      }

      const tenantRows = await sql`
        SELECT id, nome_fantasia, razao_social, plano, status, vencimento
        FROM tenants
        WHERE id = ${tenantId}
        LIMIT 1;
      `;
      if (!tenantRows.length) {
        return res.status(404).json({ success: false, error: 'Empresa solicitada não encontrada.' });
      }

      const target = tenantRows[0];
      const secret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();

      const impersonatedToken = signToken({
        userId: auth.user.id,
        username: auth.user.username,
        nome: auth.user.nome,
        email: auth.user.email,
        perfil: 'superadmin',
        tenantId: target.id,
        empresaNome: target.nome_fantasia || target.razao_social,
        impersonated: true,
        impersonatedBy: 'superadmin',
        originalTenantId: auth.user.tenantId || auth.tenantId,
        exp: Date.now() + (4 * 60 * 60 * 1000) // 4 horas
      }, secret);

      await writeAudit(sql, req, auth, {
        acao: 'impersonate',
        entidade: 'tenant',
        entidadeId: target.id,
        depois: { tenantId: target.id, empresa: target.nome_fantasia || target.razao_social }
      });

      return res.status(200).json({
        success: true,
        token: impersonatedToken,
        session: {
          userId: auth.user.id,
          username: auth.user.username,
          nome: auth.user.nome,
          perfil: 'superadmin',
          avatar: (target.nome_fantasia || 'SU').slice(0, 2).toUpperCase(),
          tenantId: target.id,
          empresaNome: target.nome_fantasia || target.razao_social,
          impersonated: true,
          impersonatedBy: 'superadmin',
          loginAt: new Date().toISOString()
        }
      });
    }

    return res.status(400).json({ success: false, error: `Ação "${action}" desconhecida.` });
  } catch (err) {
    console.error('Erro na API Master Admin:', err);
    return res.status(500).json({ success: false, error: 'Erro interno no servidor Master: ' + err.message });
  }
}
