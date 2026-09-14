// api/admin.js — Endpoint Serverless para Super Admin Master Backoffice
// Acesso restrito a usuários com perfil 'superadmin' ou chave de sistema

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { hashPassword, resolveAuthAndTenant, signToken, verifyToken } from './_auth.js';
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
  res.setHeader('Vary', 'Origin');
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/finan-as(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey, x-tenant-id');
}

const cleanSupportText = (v, max=4000) => String(v ?? '').replace(/\0/g, '').trim().slice(0, max);

const SESSION_COOKIE = 'finobra_session_token';
const MASTER_RESTORE_COOKIE = 'finobra_master_restore_token';

function cookieSecure(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return proto === 'https' || Boolean(process.env.VERCEL);
}
function readCookie(req, name) {
  const raw = String(req.headers?.cookie || '');
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0 || part.slice(0, idx).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(idx + 1).trim()); } catch { return part.slice(idx + 1).trim(); }
  }
  return '';
}
function requestCredential(req) {
  const h = String(req.headers.authorization || req.headers.Authorization || '');
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return readCookie(req, SESSION_COOKIE);
}
function cookieLine(req, name, value, maxAgeSeconds) {
  const parts = [`${name}=${encodeURIComponent(value || '')}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds || 0))}`];
  if (cookieSecure(req)) parts.push('Secure');
  return parts.join('; ');
}
function setCookies(res, lines) {
  const current = res.getHeader('Set-Cookie');
  const base = Array.isArray(current) ? current : (current ? [current] : []);
  res.setHeader('Set-Cookie', [...base, ...lines]);
}

function escapeHtmlAdmin(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderBillingEmailHtml(vars) {
  const empresa = escapeHtmlAdmin(vars.EMPRESA);
  const responsavel = escapeHtmlAdmin(vars.RESPONSAVEL);
  const plano = escapeHtmlAdmin(vars.PLANO);
  const valor = escapeHtmlAdmin(vars.VALOR);
  const vencimento = escapeHtmlAdmin(vars.VENCIMENTO);
  const situacao = escapeHtmlAdmin(vars.SITUACAO);
  const badgeStatus = escapeHtmlAdmin(vars.BADGE_STATUS);
  const tituloAviso = escapeHtmlAdmin(vars.TITULO_AVISO);
  const pixChave = escapeHtmlAdmin(vars.PIX_CHAVE);
  const pixBeneficiario = escapeHtmlAdmin(vars.PIX_BENEFICIARIO);
  const mensagemExtra = escapeHtmlAdmin(vars.MENSAGEM_EXTRA).replace(/\r?\n/g, '<br>');
  const linkAcesso = encodeURI(vars.LINK_ACESSO || 'https://finobra.app.br/login');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Assinatura FinObra — ${empresa}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <span style="display:none !important;visibility:hidden;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Aviso de assinatura FinObra: ${situacao} — ${empresa}.
  </span>
  <div style="background:#0f172a;padding:36px 16px;min-height:100vh;">
    <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.35);">
      <div style="background:linear-gradient(135deg, #09121d 0%, #152438 100%);padding:28px 32px;border-bottom:3px solid #c9a227;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td>
              <div style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
                Fin<span style="color:#c9a227;">Obra</span>
              </div>
              <div style="font-size:12px;color:#94a3b8;margin-top:4px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">
                Faturamento &amp; Assinaturas SaaS
              </div>
            </td>
            <td style="text-align:right;">
              <span style="display:inline-block;padding:6px 12px;background:rgba(201,162,39,0.18);border:1px solid rgba(201,162,39,0.45);border-radius:20px;font-size:11px;font-weight:800;color:#facc15;text-transform:uppercase;">
                ${badgeStatus}
              </span>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:32px 32px 28px;">
        <h1 style="margin:0 0 10px;font-size:20px;font-weight:800;color:#0f172a;line-height:1.35;">
          ${tituloAviso}
        </h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">
          Olá, <strong>${responsavel}</strong>! Seguem as informações referentes à renovação da assinatura da empresa <strong>${empresa}</strong> no FinObra:
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr>
              <td style="padding:6px 0;color:#64748b;">Empresa:</td>
              <td style="padding:6px 0;font-weight:700;color:#0f172a;text-align:right;">${empresa}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;">Plano Contratado:</td>
              <td style="padding:6px 0;font-weight:700;color:#0f172a;text-align:right;">${plano}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;">Vencimento:</td>
              <td style="padding:6px 0;font-weight:700;color:#2563eb;text-align:right;">${vencimento} (${situacao})</td>
            </tr>
            <tr style="border-top:1px dashed #cbd5e1;">
              <td style="padding:10px 0 4px;font-size:14px;font-weight:700;color:#0f172a;">Valor da Assinatura:</td>
              <td style="padding:10px 0 4px;font-size:18px;font-weight:900;color:#16a34a;text-align:right;">R$ ${valor}</td>
            </tr>
          </table>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
          <div style="font-size:13px;font-weight:800;color:#166534;margin-bottom:8px;">
            ⚡ Pagamento Prático via PIX
          </div>
          <div style="font-size:12px;color:#334155;margin-bottom:10px;line-height:1.5;">
            Transfira o valor utilizando a chave PIX abaixo para renovação e manutenção dos acessos sem interrupção:
          </div>
          <div style="background:#ffffff;border:1px solid #86efac;border-radius:8px;padding:10px 14px;font-family:monospace;font-size:13px;font-weight:700;color:#0f172a;word-break:break-all;">
            ${pixChave}
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:6px;">
            Beneficiário: <strong>${pixBeneficiario}</strong>
          </div>
        </div>
        <div style="font-size:13px;color:#64748b;line-height:1.55;margin-bottom:24px;">
          ${mensagemExtra}
        </div>
        <div style="text-align:center;margin:28px 0 10px;">
          <a href="${linkAcesso}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">
            Acessar Painel FinObra &rarr;
          </a>
        </div>
      </div>
      <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;line-height:1.5;">
        Este e-mail foi enviado automaticamente pelo FinObra ERP para o responsável cadastrado na plataforma.<br>
        Em caso de dúvidas ou envio de comprovante, responda a este e-mail ou contate nosso suporte.
      </div>
    </div>
  </div>
</body>
</html>`;
}

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
        VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversationId},${rows[0].tenant_id},'system',${auth.user.userId || auth.user.id},'FinObra',${'Suporte entrou no atendimento.'});
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
        VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversationId},${conv.tenant_id},'agent',${auth.user.userId || auth.user.id},${'Suporte'},${text});
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
    if (req.method === 'GET' && action === 'integrity_status') {
      const constraintRows = await sql`
        SELECT conname AS constraint_name, conrelid::regclass::text AS table_name, convalidated AS validated
        FROM pg_constraint
        WHERE conname = ANY(ARRAY[
          'chk_obras_tenant_required','chk_fornecedores_tenant_required','chk_notas_fiscais_tenant_required',
          'chk_lancamentos_tenant_required','chk_orcamentos_tenant_required','chk_medicoes_tenant_required',
          'chk_documentos_tenant_required','chk_contas_bancarias_tenant_required','chk_produtos_tenant_required',
          'chk_ocr_historico_tenant_required','fk_notas_obra_tenant','fk_lanc_fornecedor_tenant',
          'fk_lanc_obra_tenant','fk_lanc_nota_tenant','fk_orcamentos_obra_tenant','fk_medicoes_obra_tenant'
        ]::text[])
        ORDER BY conname;
      `;
      let auditRows = [];
      try {
        auditRows = await sql`
          SELECT DISTINCT ON (constraint_name) constraint_name,table_name,issue_count,validated,notes,checked_at
          FROM tenant_integrity_audit
          ORDER BY constraint_name,checked_at DESC,id DESC;
        `;
      } catch {}
      const privateBlobReady = Boolean(String(process.env.FINOBRA_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || '').trim() || String(process.env.FINOBRA_BLOB_STORE_ID || '').trim());
      const configured = String(process.env.FINOBRA_BLOB_ACCESS || process.env.BLOB_ACCESS || '').trim().toLowerCase();
      const currentBuild = process.env.VERCEL_GIT_COMMIT_SHA
        ? `2026.09.14-p40 (${process.env.VERCEL_GIT_COMMIT_SHA.slice(0,7)})`
        : '2026.09.14-p40';
      return res.status(200).json({
        success:true,
        build: currentBuild,
        constraints:constraintRows,
        audit:auditRows,
        storage:{ private_ready:privateBlobReady, configured_access:configured || (privateBlobReady ? 'private' : 'public') }
      });
    }

    if (req.method === 'GET' && action === 'client_errors') {
      const limit = Math.min(Math.max(Number.parseInt(req.query?.limit || '100',10) || 100,1),200);
      const rows = await sql`
        SELECT e.id,e.tenant_id,e.user_id,e.route,e.message,e.source,e.line_no,e.col_no,e.stack,e.created_at,
               COALESCE(t.nome_fantasia,t.razao_social,e.tenant_id,'Tenant') AS tenant_nome,
               COALESCE(u.nome,u.username,'Usuário') AS usuario_nome
        FROM client_error_logs e
        LEFT JOIN tenants t ON t.id=e.tenant_id
        LEFT JOIN usuarios u ON u.id=e.user_id
        ORDER BY e.created_at DESC,e.id DESC
        LIMIT ${limit};
      `;
      const summaryRows = await sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last_7d,
          COUNT(DISTINCT tenant_id) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS tenants_24h
        FROM client_error_logs;
      `;
      return res.status(200).json({ success:true, errors:rows, summary:summaryRows[0] || {} });
    }

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
          RETURNING id, tenant_id, plan_id, COALESCE(cycle, 'monthly') AS cycle, amount_cents, txid, paid_at
        ), tenant_upd AS (
          UPDATE tenants t
          SET plano=paid.plan_id,
              status='ativo',
              vencimento=(CASE WHEN t.vencimento IS NOT NULL AND t.vencimento >= CURRENT_DATE THEN t.vencimento ELSE CURRENT_DATE END + (
                CASE
                  WHEN paid.cycle = 'annual' THEN 365
                  WHEN paid.cycle = 'semiannual' THEN 180
                  WHEN paid.cycle = 'quarterly' THEN 90
                  ELSE 30
                END
              ))::date,
              updated_at=NOW()
          FROM paid
          WHERE t.id=paid.tenant_id
          RETURNING t.id, t.nome_fantasia, t.plano, t.status, t.vencimento
        )
        SELECT paid.id AS invoice_id, paid.tenant_id, paid.plan_id, paid.cycle, paid.amount_cents, paid.txid, paid.paid_at,
               tenant_upd.nome_fantasia, tenant_upd.status, tenant_upd.vencimento
        FROM paid JOIN tenant_upd ON tenant_upd.id=paid.tenant_id;
      `;
      if (!rows.length) return res.status(409).json({ success:false, error:'Cobrança não encontrada ou já processada/cancelada.' });
      const done = rows[0];
      await writeAudit(sql, req, { ...auth, tenantId:done.tenant_id }, {
        acao:'pagamento_confirmado', entidade:'cobranca', entidadeId:done.invoice_id,
        depois:{ plan_id:done.plan_id, cycle:done.cycle, amount_cents:Number(done.amount_cents || 0), txid:done.txid, vencimento:done.vencimento }
      });
      return res.status(200).json({ success:true, invoice:done, message:`Pagamento confirmado e assinatura renovada (${done.cycle || 'mensal'}).` });
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

    // ── POST ?action=send_billing_notice (Notificação de Cobrança WhatsApp e E-mail SaaS) ──
    if (req.method === 'POST' && action === 'send_billing_notice') {
      const {
        tenantId,
        channel = 'both', // 'whatsapp' | 'email' | 'both' | 'preview'
        templateType = 'reminder', // 'reminder' | 'due_today' | 'overdue' | 'trial_ending' | 'custom'
        customMessage,
        customSubject,
        pixKey: userPixKey,
        pixBeneficiary: userPixBeneficiary,
        targetPhone: userPhone,
        targetEmail: userEmail
      } = req.body || {};

      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Empresa (tenantId) não informada.' });
      }

      const tenantRows = await sql`
        SELECT id, razao_social, nome_fantasia, cnpj, telefone, email, responsavel, plano, status, vencimento
        FROM tenants WHERE id = ${tenantId} LIMIT 1;
      `;
      if (!tenantRows.length) {
        return res.status(404).json({ success: false, error: 'Empresa não encontrada no banco de dados.' });
      }

      const t = tenantRows[0];
      const nomeEmpresa = t.nome_fantasia || t.razao_social || 'Sua Empresa';
      const responsavel = t.responsavel || 'Gestor(a)';
      const destPhone = String(userPhone || t.telefone || '').replace(/\D/g, '');
      const destEmail = String(userEmail || t.email || '').trim();

      const PLANOS_INFO = {
        starter: { nome: 'Básico', valor: '119,90' },
        pro: { nome: 'Profissional', valor: '279,90' },
        unlimited: { nome: 'Ilimitado', valor: '499,90' },
        trial: { nome: 'Trial (Período de Testes)', valor: '279,90' }
      };
      const planoInfo = PLANOS_INFO[t.plano] || { nome: String(t.plano || 'Profissional').toUpperCase(), valor: '279,90' };

      const pixKey = String(userPixKey || process.env.FINOBRA_PIX_KEY || process.env.FINOBRA_SUPPORT_WHATSAPP || '5595991363678').trim();
      const pixBeneficiary = String(userPixBeneficiary || process.env.FINOBRA_PIX_BENEFICIARY || 'FinObra Soluções Tecnológicas').trim();

      // Cálculo de vencimento e dias restantes
      let fmtVenc = 'A definir';
      let diasRestantes = 0;
      let situacaoTxt = '';
      let badgeStatus = 'Aviso';

      if (t.vencimento) {
        const parts = String(t.vencimento).split('-');
        fmtVenc = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(t.vencimento);
        const vencDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        diasRestantes = Math.round((vencDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diasRestantes > 1) {
          situacaoTxt = `vence em ${diasRestantes} dias`;
          badgeStatus = `Vence em ${diasRestantes}d`;
        } else if (diasRestantes === 1) {
          situacaoTxt = 'vence amanhã';
          badgeStatus = 'Vence Amanhã';
        } else if (diasRestantes === 0) {
          situacaoTxt = 'vence hoje';
          badgeStatus = 'Vence Hoje';
        } else {
          const pass = Math.abs(diasRestantes);
          situacaoTxt = `vencido há ${pass} dia${pass > 1 ? 's' : ''}`;
          badgeStatus = `Vencido há ${pass}d`;
        }
      }

      // Monta textos padrão por template
      let defaultSubject = `FinObra — Assinatura ${nomeEmpresa}`;
      let defaultMessage = '';
      let defaultTituloAviso = `Assinatura FinObra — ${nomeEmpresa}`;

      if (templateType === 'reminder') {
        defaultSubject = `🔔 FinObra — Lembrete de Renovação de Assinatura (${fmtVenc})`;
        defaultTituloAviso = `Lembrete de Renovação — ${situacaoTxt || 'próximo vencimento'}`;
        defaultMessage = `Olá, ${responsavel}! 👋\n\nPassando para lembrar que a assinatura do *FinObra* da empresa *${nomeEmpresa}* (Plano ${planoInfo.nome}) vence em *${fmtVenc}* (${situacaoTxt}).\n\n💰 *Valor:* R$ ${planoInfo.valor}\n🔑 *Chave PIX:* ${pixKey}\n👤 *Beneficiário:* ${pixBeneficiary}\n\nQualquer dúvida ou caso precise de emissão de NF, estamos à disposição!`;
      } else if (templateType === 'due_today') {
        defaultSubject = `⚠️ FinObra — Sua assinatura vence hoje (${fmtVenc})`;
        defaultTituloAviso = `Sua assinatura vence hoje (${fmtVenc})`;
        defaultMessage = `Olá, ${responsavel}! 🔔\n\nA assinatura do *FinObra* da empresa *${nomeEmpresa}* vence *hoje (${fmtVenc})*.\n\nPara garantir a continuidade dos acessos da sua equipe e sincronização das obras sem interrupção:\n\n💰 *Valor:* R$ ${planoInfo.valor}\n🔑 *Chave PIX:* ${pixKey}\n👤 *Beneficiário:* ${pixBeneficiary}\n\nApós o pagamento via PIX, a renovação é confirmada e os acessos continuam ativos normalmente.`;
      } else if (templateType === 'overdue') {
        defaultSubject = `🚨 FinObra — Aviso de Vencimento e Regularização de Acesso`;
        defaultTituloAviso = `Aviso de Regularização — ${situacaoTxt || 'Assinatura Pendente'}`;
        defaultMessage = `Olá, ${responsavel}! ⚠️\n\nIdentificamos que a assinatura do *FinObra* da empresa *${nomeEmpresa}* venceu em *${fmtVenc}* (${situacaoTxt}) e consta pendente.\n\nPara evitar o bloqueio preventivo dos acessos, emissão de relatórios e sincronização no canteiro de obras, solicitamos a regularização:\n\n💰 *Valor:* R$ ${planoInfo.valor}\n🔑 *Chave PIX:* ${pixKey}\n👤 *Beneficiário:* ${pixBeneficiary}\n\nSe já realizou o pagamento, por favor desconsidere este aviso ou nos envie o comprovante!`;
      } else if (templateType === 'trial_ending') {
        defaultSubject = `🚀 FinObra — Seu período de testes termina em ${fmtVenc}`;
        defaultTituloAviso = `Seu período de testes está terminando em ${fmtVenc}`;
        defaultMessage = `Olá, ${responsavel}! 🚀\n\nSeu período de teste gratuito do *FinObra* na empresa *${nomeEmpresa}* termina em *${fmtVenc}*.\n\nEsperamos que a plataforma esteja transformando a gestão das suas obras! Para continuar utilizando todos os recursos com a sua equipe:\n\n👉 Conheça os planos e assine: https://finobra.app.br/app.html#planos\n💰 *Valor de referência:* R$ ${planoInfo.valor}/mês (${planoInfo.nome})\n🔑 *Chave PIX:* ${pixKey}\n👤 *Beneficiário:* ${pixBeneficiary}\n\nEstamos à disposição para ajudar na escolha do melhor plano!`;
      } else {
        defaultSubject = `FinObra — Notificação de Assinatura (${nomeEmpresa})`;
        defaultTituloAviso = `Notificação de Assinatura — ${nomeEmpresa}`;
        defaultMessage = `Olá, ${responsavel}! Aqui é do FinObra referente à assinatura da empresa ${nomeEmpresa}.`;
      }

      const finalMessage = String(customMessage || defaultMessage).trim();
      const finalSubject = String(customSubject || defaultSubject).trim();

      // Se for apenas visualização/prévia
      if (channel === 'preview') {
        return res.status(200).json({
          success: true,
          preview: true,
          tenant: { id: t.id, nome: nomeEmpresa, responsavel, plano: planoInfo.nome, valor: planoInfo.valor, vencimento: fmtVenc, situacao: situacaoTxt },
          destPhone,
          destEmail,
          subject: finalSubject,
          message: finalMessage,
          pixKey,
          pixBeneficiary
        });
      }

      const results = {
        whatsapp: { attempted: false, success: false },
        email: { attempted: false, success: false },
        waLink: destPhone ? `https://wa.me/${destPhone}?text=${encodeURIComponent(finalMessage)}` : null
      };

      // 1. Disparo por WhatsApp
      if (channel === 'whatsapp' || channel === 'both') {
        results.whatsapp.attempted = true;
        if (!destPhone || destPhone.length < 10) {
          results.whatsapp.error = 'Telefone do cliente inválido ou não cadastrado.';
        } else {
          try {
            const renderBaseUrl = (process.env.RENDER_WHATSAPP_URL || 'https://finan-backend-9rxw.onrender.com').replace(/\/send-message\/?$/, '').replace(/\/+$/, '');
            const secret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();

            const wpRes = await fetch(`${renderBaseUrl}/send-message`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${secret}`,
                'x-api-key': secret,
                'Content-Type': 'application/json',
                'x-tenant-id': 'angelim'
              },
              body: JSON.stringify({
                phone: destPhone,
                message: finalMessage
              }),
              signal: AbortSignal.timeout(15000)
            });

            const wpData = await wpRes.json().catch(() => ({}));
            if (wpRes.ok && (wpData.success || wpData.messageId)) {
              results.whatsapp.success = true;
              results.whatsapp.messageId = wpData.messageId;
            } else {
              results.whatsapp.error = wpData.error || `Servidor WhatsApp retornou status ${wpRes.status}`;
            }
          } catch (wpErr) {
            results.whatsapp.error = `Não foi possível conectar ao robô de WhatsApp: ${wpErr.message}`;
          }
        }
      }

      // 2. Disparo por E-mail
      if (channel === 'email' || channel === 'both') {
        results.email.attempted = true;
        const resendKey = String(process.env.RESEND_API_KEY || '').trim();
        const emailFrom = String(process.env.FINOBRA_SUPPORT_EMAIL_FROM || 'FinObra <suporte@finobra.app.br>').trim();

        if (!destEmail || !destEmail.includes('@')) {
          results.email.error = 'E-mail da empresa inválido ou não cadastrado.';
        } else if (!resendKey) {
          results.email.error = 'Chave RESEND_API_KEY não configurada no servidor.';
        } else {
          try {
            const emailHtml = renderBillingEmailHtml({
              EMPRESA: nomeEmpresa,
              RESPONSAVEL: responsavel,
              PLANO: planoInfo.nome,
              VALOR: planoInfo.valor,
              VENCIMENTO: fmtVenc,
              SITUACAO: situacaoTxt || 'Renovação',
              BADGE_STATUS: badgeStatus,
              TITULO_AVISO: defaultTituloAviso,
              PIX_CHAVE: pixKey,
              PIX_BENEFICIARIO: pixBeneficiary,
              MENSAGEM_EXTRA: finalMessage,
              LINK_ACESSO: 'https://finobra.app.br/login'
            });

            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: emailFrom,
                to: [destEmail],
                subject: finalSubject,
                html: emailHtml
              }),
              signal: AbortSignal.timeout(12000)
            });

            const emailData = await emailRes.json().catch(() => ({}));
            if (emailRes.ok && emailData.id) {
              results.email.success = true;
              results.email.id = emailData.id;
            } else {
              results.email.error = emailData.message || `Resend retornou status ${emailRes.status}`;
            }
          } catch (emErr) {
            results.email.error = `Falha ao disparar e-mail via Resend: ${emErr.message}`;
          }
        }
      }

      // Grava auditoria
      await writeAudit(sql, req, { ...auth, tenantId }, {
        acao: 'cobranca_notificacao_enviada',
        entidade: 'tenant',
        entidadeId: tenantId,
        depois: {
          canal: channel,
          template: templateType,
          destPhone,
          destEmail,
          whatsapp: results.whatsapp,
          email: results.email
        }
      });

      return res.status(200).json({
        success: true,
        tenantId,
        nomeEmpresa,
        channel,
        results,
        message: 'Processamento de cobrança concluído com sucesso.'
      });
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

      if (finalSenha.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'A senha inicial deve ter no mínimo 8 caracteres.'
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
      if (auth.user?.impersonated === true || auth.user?.impersonatedBy || auth.user?.isImpersonated) {
        return res.status(409).json({ success:false, error:'Encerre o modo suporte atual antes de acessar outra empresa.' });
      }
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
      const originalCredential = requestCredential(req);
      const originalPayload = originalCredential ? verifyToken(originalCredential, secret) : null;
      const liveSessionId = String(auth.user?.sessionId || '');
      const originalSessionId = String(originalPayload?.sessionId || '');
      const originalTenantId = String(auth.user?.realTenantId || auth.user?.tenantId || auth.tenantId || '');
      const originalIsMaster = originalPayload && originalPayload.userId === auth.user.id && originalPayload.perfil === 'superadmin' && !originalPayload.impersonated;
      const sameSession = !liveSessionId || !originalSessionId || liveSessionId === originalSessionId;
      if (!originalCredential || !originalIsMaster || !sameSession || String(originalPayload.tenantId || '') !== originalTenantId) {
        return res.status(401).json({ success:false, error:'Não foi possível preservar a sessão Master para retorno seguro.' });
      }

      const maxSupportExp = Date.now() + (4 * 60 * 60 * 1000);
      const originalExp = Number(originalPayload.exp || 0);
      const impExp = Math.min(originalExp || maxSupportExp, maxSupportExp);
      if (!Number.isFinite(impExp) || impExp <= Date.now() + 60_000) {
        return res.status(401).json({ success:false, error:'Sua sessão Master está próxima de expirar. Entre novamente antes de iniciar o modo suporte.' });
      }

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
        originalTenantId,
        sessionId: liveSessionId,
        exp: impExp
      }, secret);

      const supportSeconds = Math.max(60, Math.floor((impExp - Date.now()) / 1000));
      const restoreSeconds = Math.max(60, Math.floor((originalExp - Date.now()) / 1000));
      setCookies(res, [
        cookieLine(req, MASTER_RESTORE_COOKIE, originalCredential, restoreSeconds),
        cookieLine(req, SESSION_COOKIE, impersonatedToken, supportSeconds)
      ]);

      await writeAudit(sql, req, auth, {
        acao: 'impersonate',
        entidade: 'tenant',
        entidadeId: target.id,
        depois: { tenantId: target.id, empresa: target.nome_fantasia || target.razao_social }
      });

      return res.status(200).json({
        success: true,
        cookieAuth: true,
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

    if (req.method === 'POST' && action === 'restore_master_session') {
      const secret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();
      let restoreToken = readCookie(req, MASTER_RESTORE_COOKIE);
      let payload = restoreToken ? verifyToken(restoreToken, secret) : null;
      let recoveredFromImpersonatedSession = false;

      // O cookie auxiliar pode ser descartado pelo navegador/proxy. O retorno só é
      // reconstruído a partir de uma sessão impersonada assinada, vinculada ao mesmo
      // superadmin e à mesma sessão revogável.
      const currentSessionId = String(auth.user?.sessionId || '');
      const restoreSessionId = String(payload?.sessionId || '');
      const realTenantId = String(auth.user?.realTenantId || auth.user?.originalTenantId || '').trim();
      const restoreCookieValid = Boolean(
        payload && payload.userId === auth.user.id && payload.perfil === 'superadmin' &&
        !payload.impersonated && String(payload.tenantId || '') === realTenantId &&
        (!currentSessionId || !restoreSessionId || currentSessionId === restoreSessionId)
      );
      if (!restoreCookieValid) {
        const isImpersonatedMaster = auth.user?.perfil === 'superadmin' && auth.user?.impersonated === true && auth.user?.impersonatedBy === 'superadmin' && Boolean(auth.user?.isImpersonated);
        if (!isImpersonatedMaster || !realTenantId) {
          return res.status(401).json({ success:false, error:'Não foi possível restaurar automaticamente a sessão Master. Entre novamente no painel Master.' });
        }
        const fallbackExp = Math.min(Number(auth.user?.exp || (Date.now() + 4 * 60 * 60 * 1000)), Date.now() + 4 * 60 * 60 * 1000);
        restoreToken = signToken({
          userId:auth.user.id,
          username:auth.user.username,
          nome:auth.user.nome,
          email:auth.user.email,
          perfil:'superadmin',
          tenantId:realTenantId,
          sessionId:auth.user.sessionId || '',
          exp:fallbackExp
        }, secret);
        payload = verifyToken(restoreToken, secret);
        recoveredFromImpersonatedSession = true;
      }

      const rows = await sql`SELECT perfil, ativo, tenant_id FROM usuarios WHERE id=${payload.userId} LIMIT 1;`;
      if (!rows.length || !rows[0].ativo || rows[0].perfil !== 'superadmin' || String(rows[0].tenant_id || '') !== String(payload.tenantId || '')) {
        return res.status(403).json({ success:false, error:'A conta Master não está autorizada.' });
      }
      const remaining = Math.max(60, Math.floor((Number(payload.exp || Date.now()) - Date.now()) / 1000));
      setCookies(res, [
        cookieLine(req, SESSION_COOKIE, restoreToken, remaining),
        cookieLine(req, MASTER_RESTORE_COOKIE, '', 0)
      ]);
      await writeAudit(sql, req, { ...auth, tenantId:auth.tenantId }, {
        acao:'suporte_encerrado', entidade:'suporte_master', entidadeId:String(req.body?.tenantId || auth.tenantId || ''),
        depois:{ restored:true, recoveredFromImpersonatedSession, superadmin:auth.user?.username || auth.user?.email || 'superadmin' }
      });
      return res.status(200).json({ success:true, restored:true, recoveredFromImpersonatedSession });
    }

    return res.status(400).json({ success: false, error: `Ação "${action}" desconhecida.` });
  } catch (err) {
    console.error('Erro na API Master Admin:', err);
    return res.status(500).json({ success: false, error: 'Erro interno no servidor Master: ' + err.message });
  }
}
