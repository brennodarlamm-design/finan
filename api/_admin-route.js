// api/admin.js — Endpoint Serverless para Super Admin Master Backoffice
// Acesso restrito a usuários com perfil 'superadmin' ou chave de sistema

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { hashPassword, verifyPassword, resolveAuthAndTenant, signToken, verifyToken, getSessionSigningSecret, getInternalApiSecret } from './_auth.js';
import { generateBackupCodes } from './_totp.js';
import { writeAudit } from './_audit.js';
import { parseWebhookPayload, settlePixPayment, sendPaymentReceipt } from './_webhook_pix_core.js';
import {
  generateTenantAccessKey,
  hashTenantAccessKey,
  tenantAccessKeyLast4
} from './_tenant-access-key.js';
import { triggerBillingSweep, isTriggerConfigured } from './_trigger-client.js';
import { createOwnerSql } from './_database.js';

/**
 * Retorna o cliente SQL com o role neondb_owner (conexão privilegiada).
 *
 * ⚠️  CAMINHO PRIVILEGIADO — NÃO substituir por createTenantSql().
 *
 * Todas as operações deste módulo são intencionalmente CROSS-TENANT:
 *   - Listagem global de tenants, cobranças e suporte
 *   - Impersonação e auditoria de suporte Master
 *   - Operações administrativas, faturamento e billing
 *   - Confirmação de pagamentos e webhooks PIX
 *
 * O isolamento RLS por tenant é responsabilidade de cada rota de tenant
 * (db.js, dashboard.js, users.js, etc.) via createTenantSql().
 * O admin route usa neondb_owner por design para acessar dados globais
 * sem restrição de tenant_id.
 *
 * Fronteira: neondb_owner (admin/cross-tenant) vs finobra_app (tenant-scoped via RLS)
 */
function getOwnerSql() {
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey, x-tenant-id');
}

const cleanSupportText = (v, max=4000) => String(v ?? '').replace(/\0/g, '').trim().slice(0, max);

const SESSION_COOKIE = 'finobra_session_token';
const MASTER_RESTORE_COOKIE = 'finobra_master_restore_token';

function cookieSecure(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return proto === 'https' || Boolean(process.env.VERCEL) || Boolean(process.env.FINOBRA_CANONICAL_ORIGIN?.startsWith('https'));
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

function onlyAscii(value, max) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 .\-]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

function tlv(id, value) {
  const v = String(value ?? '');
  return `${id}${String(v.length).padStart(2, '0')}${v}`;
}

function crc16Ccitt(text) {
  let crc = 0xFFFF;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildPixPayload({ key, amountCents, txid, merchantName, merchantCity }) {
  const cleanKey = String(key || '').trim();
  if (!cleanKey) return '';
  const mName = onlyAscii(merchantName || 'FINGO SISTEMA', 25) || 'FINGO';
  const mCity = onlyAscii(merchantCity || 'BOA VISTA', 15) || 'BOA VISTA';
  const merchantAccount = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', cleanKey);
  const amount = (Number(amountCents || 0) / 100).toFixed(2);
  const additional = tlv('05', onlyAscii(txid, 25) || '***');
  const base =
    tlv('00', '01') +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (Number(amountCents) > 0 ? tlv('54', amount) : '') +
    tlv('58', 'BR') +
    tlv('59', mName) +
    tlv('60', mCity) +
    tlv('62', additional) +
    '6304';
  return base + crc16Ccitt(base);
}

function parseVencimento(venc) {
  if (!venc) return { iso: '', fmt: 'A definir', dias: 0, situacao: 'A definir', badge: 'Aviso' };
  let iso = '';
  if (venc instanceof Date && !isNaN(venc.getTime())) {
    iso = venc.toISOString().split('T')[0];
  } else {
    const s = String(venc).trim();
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      iso = `${m[1]}-${m[2]}-${m[3]}`;
    } else {
      const d = new Date(s);
      if (!isNaN(d.getTime())) iso = d.toISOString().split('T')[0];
    }
  }
  if (!iso) return { iso: String(venc), fmt: String(venc), dias: 0, situacao: '', badge: 'Aviso' };
  const [y, m, d] = iso.split('-');
  const fmt = `${d}/${m}/${y}`;

  let todayStr = '';
  try {
    todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch (_) {
    todayStr = new Date().toISOString().split('T')[0];
  }
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const targetUtc = Date.UTC(Number(y), Number(m) - 1, Number(d));
  const todayUtc = Date.UTC(ty, tm - 1, td);
  const dias = Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));

  let situacao = '';
  let badge = 'Aviso';
  if (dias > 1) {
    situacao = `vence em ${dias} dias`;
    badge = `Vence em ${dias}d`;
  } else if (dias === 1) {
    situacao = 'vence amanhã';
    badge = 'Vence Amanhã';
  } else if (dias === 0) {
    situacao = 'vence hoje';
    badge = 'Vence Hoje';
  } else {
    const pass = Math.abs(dias);
    situacao = `vencido há ${pass} dia${pass > 1 ? 's' : ''}`;
    badge = `Vencido há ${pass}d`;
  }
  return { iso, fmt, dias, situacao, badge };
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
  const pixPayload = escapeHtmlAdmin(vars.PIX_PAYLOAD || vars.PIX_CHAVE);
  const pixQrCodeUrl = encodeURI(vars.PIX_QR_CODE_URL || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=2&data=${encodeURIComponent(vars.PIX_PAYLOAD || vars.PIX_CHAVE || '')}`);
  const pixBeneficiario = escapeHtmlAdmin(vars.PIX_BENEFICIARIO);
  const mensagemExtra = escapeHtmlAdmin(vars.MENSAGEM_EXTRA).replace(/\r?\n/g, '<br>');
  const linkAcesso = encodeURI(vars.LINK_ACESSO || 'https://fingo.api.br/login');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Assinatura FinGo — ${empresa}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F0F0E8;">
  <span style="display:none !important;visibility:hidden;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Aviso de assinatura FinGo: ${situacao} — ${empresa}.
  </span>
  <div style="background:#0A0A0A;padding:40px 16px;min-height:100vh;">
    <div style="max-width:580px;margin:0 auto;background:#141D12;border:1px solid #282828;border-radius:6px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,0.8);">
      <div style="background:#0A0A0A;padding:28px 32px;border-bottom:3px solid #C6FF00;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td>
              <a href="https://fingo.api.br" target="_blank" style="text-decoration:none;display:inline-block;">
                <img src="https://fingo.api.br/img/fingo/fingo-logo-full.png" alt="FinGo — Obras em Fluxo" style="height:36px;width:auto;max-width:180px;object-fit:contain;display:block;border:0;" />
              </a>
              <div style="font-size:10px;color:#8E8E8E;margin-top:4px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">
                Faturamento &amp; Assinaturas SaaS
              </div>
            </td>
            <td style="text-align:right;">
              <span style="display:inline-block;padding:6px 12px;background:rgba(198,255,0,0.12);border:1px solid rgba(198,255,0,0.35);border-radius:4px;font-size:11px;font-weight:800;color:#C6FF00;text-transform:uppercase;">
                ${badgeStatus}
              </span>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:36px 32px 28px;">
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:900;color:#F0F0E8;line-height:1.3;letter-spacing:-0.4px;">
          ${tituloAviso}
        </h1>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#CBD5E1;">
          Olá, <strong>${responsavel}</strong>! Seguem as informações referentes à assinatura da empresa <strong>${empresa}</strong> no FinGo ERP:
        </p>
        <div style="background:#0A0A0A;border:1px solid #282828;border-radius:6px;padding:20px;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr>
              <td style="padding:6px 0;color:#8E8E8E;">Empresa:</td>
              <td style="padding:6px 0;font-weight:700;color:#F0F0E8;text-align:right;">${empresa}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#8E8E8E;">Plano Contratado:</td>
              <td style="padding:6px 0;font-weight:700;color:#F0F0E8;text-align:right;">${plano}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#8E8E8E;">Vencimento:</td>
              <td style="padding:6px 0;font-weight:700;color:#C6FF00;text-align:right;">${vencimento} (${situacao})</td>
            </tr>
            <tr style="border-top:1px dashed #282828;">
              <td style="padding:12px 0 4px;font-size:14px;font-weight:700;color:#F0F0E8;">Valor da Assinatura:</td>
              <td style="padding:12px 0 4px;font-size:20px;font-weight:900;color:#C6FF00;text-align:right;">R$ ${valor}</td>
            </tr>
          </table>
        </div>
        <div style="background:#0A0A0A;border:1px solid rgba(198,255,0,0.3);border-radius:8px;padding:24px 20px;margin-bottom:24px;text-align:center;">
          <div style="font-size:12px;font-weight:800;color:#C6FF00;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em;">
            ⚡ Pagamento Prático via PIX
          </div>
          <div style="font-size:13px;color:#CBD5E1;margin-bottom:14px;line-height:1.5;">
            Escaneie o QR Code abaixo no aplicativo do seu banco para liquidação imediata:
          </div>
          <div style="display:inline-block;background:#FFFFFF;padding:12px;border-radius:8px;margin:0 auto 12px;box-shadow:0 6px 22px rgba(0,0,0,0.7);">
            <img src="${pixQrCodeUrl}" alt="QR Code PIX" width="180" height="180" style="display:block;width:180px;height:180px;border:0;border-radius:4px;" />
          </div>
          <div style="font-size:12px;color:#8E8E8E;margin-bottom:14px;">
            Beneficiário: <strong style="color:#CBD5E1;">${pixBeneficiario}</strong> &bull; Valor: <strong style="color:#C6FF00;">R$ ${valor}</strong>
          </div>
          <div style="background:#141D12;border:1px solid #282828;border-radius:6px;padding:12px 14px;text-align:left;">
            <div style="font-size:10px;color:#8E8E8E;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;font-weight:700;">
              📱 No celular? Use a Chave PIX ou Código Copia e Cola:
            </div>
            <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:12px;font-weight:800;color:#C6FF00;word-break:break-all;user-select:all;margin-bottom:6px;">
              ${pixPayload}
            </div>
            <div style="font-size:11px;color:#8E8E8E;">
              Chave direta: <strong style="color:#CBD5E1;font-family:monospace;">${pixChave}</strong>
            </div>
          </div>
        </div>
        <div style="font-size:13px;color:#CBD5E1;line-height:1.6;margin-bottom:24px;">
          ${mensagemExtra}
        </div>
        <div style="text-align:center;margin:30px 0 10px;">
          <a href="${linkAcesso}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#C6FF00;color:#0A0A0A;font-size:14px;font-weight:900;padding:14px 34px;border-radius:4px;text-decoration:none;letter-spacing:0.04em;text-transform:uppercase;box-shadow:0 4px 20px rgba(198,255,0,0.3);">
            Acessar Painel FinGo &rarr;
          </a>
        </div>
      </div>
      <div style="background:#0A0A0A;padding:20px 32px;border-top:1px solid #282828;text-align:center;font-size:11px;color:#8E8E8E;line-height:1.6;">
        <strong style="color:#CBD5E1;">FinGo ERP — Obras em Fluxo</strong> &bull; CNPJ 53.864.218/0001-20<br>
        Em caso de dúvidas ou comprovante, contate: <a href="mailto:suporte@fingo.api.br" style="color:#C6FF00;text-decoration:none;">suporte@fingo.api.br</a>
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

  // PATCH 50: Validação MFA fail-closed — superadmin só acessa se MFA estiver habilitado E verificado.
  // Antes verificava apenas se mfa_enabled && !mfa_verified (fail-open para contas sem MFA configurado).
  if (!auth.isSystem && auth.user && auth.user.perfil === 'superadmin') {
    if (!auth.user.mfa_enabled || !auth.user.mfa_verified) {
      return res.status(403).json({
        success: false,
        mfa_required: true,
        error: 'Autenticação de dois fatores (Google Authenticator) obrigatória para esta operação. Configure o MFA antes de acessar o Portal Master.'
      });
    }
  }

  // Conexão privilegiada cross-tenant — intencional para operações Master/admin.
  // Para rotas de tenant, use createTenantSql() via api/_tenant-sql.js.
  const sql = getOwnerSql();
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
        VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversationId},${rows[0].tenant_id},'system',${auth.user.userId || auth.user.id},'FinGo',${'Suporte entrou no atendimento.'});
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
        VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversationId},${rows[0].tenant_id},'system',${auth.user.userId || auth.user.id},'FinGo',${'Atendimento marcado como resolvido.'});
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

    // ── Telemetria e Observabilidade de Erros (PATCH 46) ───────────────────
    if (req.method === 'GET' && action === 'client_errors') {
      const limit = Math.min(Math.max(Number.parseInt(req.query?.limit || '100', 10) || 100, 1), 200);
      const tenantFilter = String(req.query?.tenantId || '').trim();

      const rows = await sql`
        SELECT e.id, e.tenant_id, e.user_id, e.route, e.message, e.source, e.line_no, e.col_no, e.stack,
               e.metadata, e.status, e.user_agent, e.created_at,
               COALESCE(t.nome_fantasia, t.razao_social, e.tenant_id, 'Anônimo / Visitante') AS tenant_nome,
               COALESCE(u.nome, u.username, 'Usuário') AS usuario_nome
        FROM client_error_logs e
        LEFT JOIN tenants t ON t.id = e.tenant_id
        LEFT JOIN usuarios u ON u.id = e.user_id
        WHERE (${tenantFilter} = '' OR e.tenant_id = ${tenantFilter})
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT ${limit};
      `;

      const summaryRows = await sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last_7d,
          COUNT(DISTINCT tenant_id) FILTER (WHERE tenant_id IS NOT NULL AND created_at >= NOW() - INTERVAL '24 hours')::int AS tenants_24h,
          COUNT(*) FILTER (WHERE tenant_id IS NULL AND created_at >= NOW() - INTERVAL '24 hours')::int AS anonymous_24h
        FROM client_error_logs;
      `;

      const topRoutes = await sql`
        SELECT COALESCE(route, 'Geral') AS route, COUNT(*)::int AS count
        FROM client_error_logs
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY route
        ORDER BY count DESC
        LIMIT 6;
      `;

      const clusters = await sql`
        WITH grouped AS (
          SELECT
            LEFT(message, 140) AS signature,
            COALESCE(source, '—') AS source,
            id,
            tenant_id,
            created_at
          FROM client_error_logs
          WHERE created_at >= NOW() - INTERVAL '7 days'
        )
        SELECT
          MD5(CONCAT(signature, ':', source)) AS cluster_id,
          signature,
          source,
          COUNT(*)::int AS count,
          COUNT(DISTINCT tenant_id)::int AS affected_tenants,
          MAX(created_at) AS last_seen,
          MIN(created_at) AS first_seen,
          MAX(id) AS sample_id
        FROM grouped
        GROUP BY signature, source
        ORDER BY count DESC, last_seen DESC
        LIMIT 15;
      `;

      return res.status(200).json({
        success: true,
        errors: rows,
        summary: summaryRows[0] || {},
        top_routes: topRoutes,
        clusters
      });
    }

    if (req.method === 'POST' && (action === 'clear_old_client_errors' || action === 'limpar_erros_antigos')) {
      const days = Math.min(Math.max(Number.parseInt(req.body?.days || '30', 10) || 30, 1), 365);
      const deleted = await sql`
        DELETE FROM client_error_logs
        WHERE created_at < NOW() - (${days} || ' days')::interval
        RETURNING id;
      `;
      return res.status(200).json({
        success: true,
        deleted_count: deleted.length,
        message: `${deleted.length} registro(s) de telemetria com mais de ${days} dias foram expurgados.`
      });
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
          t.access_key_last4,
          t.access_key_created_at,
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
          access_key_last4: r.access_key_last4 || null,
          access_key_created_at: r.access_key_created_at ? new Date(r.access_key_created_at).toISOString() : null,
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

    // ── Gestão de Contas Bancárias e Conciliação Multi-Tenant ─────────────────
    if (req.method === 'GET' && (action === 'bank_accounts_overview' || action === 'contas_bancarias_overview')) {
      const tenantFilter = String(req.query?.tenantId || '').trim();

      // 1. Contas detalhadas
      const accounts = await sql`
        SELECT
          c.id, c.tenant_id, c.banco_nome, c.banco_codigo, c.agencia, c.numero,
          c.tipo, c.titular, c.apelido, c.obra_id,
          COALESCE(c.saldo_inicial, 0)::numeric AS saldo_inicial,
          COALESCE(c.saldo_atual, 0)::numeric AS saldo_atual,
          c.created_at, c.updated_at,
          COALESCE(t.nome_fantasia, t.razao_social, c.tenant_id) AS tenant_nome,
          t.plano AS tenant_plano,
          t.status AS tenant_status,
          o.nome AS obra_nome
        FROM contas_bancarias c
        LEFT JOIN tenants t ON t.id = c.tenant_id
        LEFT JOIN obras o ON o.id = c.obra_id AND o.tenant_id = c.tenant_id
        WHERE (${tenantFilter} = '' OR c.tenant_id = ${tenantFilter})
        ORDER BY t.nome_fantasia ASC, c.banco_nome ASC;
      `;

      // 2. Estatísticas de conciliação agrupadas por construtora
      const tenantStats = await sql`
        SELECT
          t.id AS tenant_id,
          COALESCE(t.nome_fantasia, t.razao_social, t.id) AS tenant_nome,
          t.plano AS tenant_plano,
          t.status AS tenant_status,
          COUNT(DISTINCT c.id)::int AS total_contas,
          COALESCE(SUM(c.saldo_atual), 0)::numeric AS saldo_total_contas,
          COUNT(l.id)::int AS total_lancamentos,
          COUNT(l.id) FILTER (WHERE l.conciliado = true)::int AS lancamentos_conciliados,
          COUNT(l.id) FILTER (WHERE l.conciliado = false OR l.conciliado IS NULL)::int AS lancamentos_pendentes,
          ROUND(
            (COUNT(l.id) FILTER (WHERE l.conciliado = true)::numeric / NULLIF(COUNT(l.id), 0)) * 100,
            1
          )::float AS taxa_conciliacao_pct
        FROM tenants t
        LEFT JOIN contas_bancarias c ON c.tenant_id = t.id
        LEFT JOIN lancamentos l ON l.tenant_id = t.id
        WHERE (${tenantFilter} = '' OR t.id = ${tenantFilter})
        GROUP BY t.id, t.nome_fantasia, t.razao_social, t.plano, t.status
        ORDER BY total_contas DESC, t.id ASC;
      `;

      // 3. Resumo Global SaaS
      const totalAccounts = accounts.length;
      const totalBalance = accounts.reduce((acc, a) => acc + Number(a.saldo_atual || 0), 0);
      const totalLancamentos = tenantStats.reduce((acc, s) => acc + Number(s.total_lancamentos || 0), 0);
      const totalConciliados = tenantStats.reduce((acc, s) => acc + Number(s.lancamentos_conciliados || 0), 0);
      const globalConciliationPct = totalLancamentos > 0 ? Math.round((totalConciliados / totalLancamentos) * 1000) / 10 : 0;

      return res.status(200).json({
        success: true,
        summary: {
          total_contas: totalAccounts,
          saldo_consolidado: totalBalance,
          total_lancamentos: totalLancamentos,
          lancamentos_conciliados: totalConciliados,
          taxa_global_pct: globalConciliationPct,
          tenants_com_contas: tenantStats.filter(s => s.total_contas > 0).length
        },
        accounts,
        tenant_stats: tenantStats
      });
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

    // ── POST ?action=simulate_webhook_pix (Simulação de Webhook PIX pelo Super Admin) ──
    if (req.method === 'POST' && (action === 'simulate_webhook_pix' || action === 'webhook_pix')) {
      const payload = parseWebhookPayload(req.body || {});
      payload.simulated = true;
      const settleResult = await settlePixPayment(sql, payload, { source: 'superadmin_master_simulator' });
      if (settleResult.already_processed) {
        return res.status(200).json({
          success: true,
          already_processed: true,
          message: settleResult.message,
          invoiceId: settleResult.invoiceId,
          tenantId: settleResult.tenantId,
          paidAt: settleResult.paidAt
        });
      }
      if (!settleResult.success) {
        return res.status(422).json({ success: false, error: settleResult.error || 'Falha ao processar liquidação da cobrança.' });
      }
      const data = settleResult.data;
      await writeAudit(sql, req, { ...auth, tenantId: data.tenant_id }, {
        acao: 'pagamento_pix_simulado',
        entidade: 'cobranca',
        entidadeId: data.invoice_id,
        depois: {
          tenantId: data.tenant_id,
          empresa: data.nome_fantasia || data.razao_social,
          plano: data.plan_id,
          ciclo: data.cycle,
          amount_cents: data.amount_cents,
          txid: data.txid,
          vencimento: data.vencimento
        }
      });
      const receipt = await sendPaymentReceipt(data);
      return res.status(200).json({
        success: true,
        processed: true,
        invoice: data,
        receipt,
        message: `Webhook PIX processado com sucesso! Assinatura da empresa ${data.nome_fantasia || data.razao_social} renovada até ${data.vencimento}.`
      });
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
      let destPhone = String(userPhone || t.telefone || '').replace(/\D/g, '');
      if (destPhone.length >= 10 && destPhone.length <= 11 && !destPhone.startsWith('55')) {
        destPhone = '55' + destPhone;
      }
      let destEmail = String(userEmail || t.email || '').trim();
      if (!destEmail) {
        try {
          const adminRows = await sql`
            SELECT email FROM usuarios 
            WHERE tenant_id = ${tenantId} AND email IS NOT NULL AND email != ''
            ORDER BY CASE perfil WHEN 'admin' THEN 1 WHEN 'superadmin' THEN 2 ELSE 3 END, created_at ASC 
            LIMIT 1;
          `;
          if (adminRows.length && adminRows[0].email) {
            destEmail = String(adminRows[0].email).trim();
          }
        } catch (_) {}
      }

      // Se o usuário informou telefone ou e-mail novo e o tenant não tinha, atualiza no banco para usos futuros
      if (userPhone && !t.telefone && destPhone) {
        await sql`UPDATE tenants SET telefone = ${destPhone}, updated_at = NOW() WHERE id = ${tenantId};`.catch(() => {});
      }
      if (userEmail && !t.email && destEmail) {
        await sql`UPDATE tenants SET email = ${destEmail}, updated_at = NOW() WHERE id = ${tenantId};`.catch(() => {});
      }

      const PLANOS_INFO = {
        starter: { nome: 'Básico', valor: '119,90', cents: 11990 },
        pro: { nome: 'Profissional', valor: '279,90', cents: 27990 },
        unlimited: { nome: 'Ilimitado', valor: '499,90', cents: 49990 },
        trial: { nome: 'Trial (Período de Testes)', valor: '279,90', cents: 27990 }
      };
      const planoInfo = PLANOS_INFO[t.plano] || { nome: String(t.plano || 'Profissional').toUpperCase(), valor: '279,90', cents: 27990 };

      const pixKey = String(userPixKey || process.env.FINOBRA_PIX_KEY || '5595991363678').trim();
      if (!pixKey) {
        return res.status(503).json({
          success:false,
          code:'BILLING_PIX_NOT_CONFIGURED',
          error:'Nenhuma chave PIX foi informada e FINOBRA_PIX_KEY não está configurada. O aviso de cobrança não foi enviado.'
        });
      }
      const pixBeneficiary = String(userPixBeneficiary || process.env.FINOBRA_PIX_BENEFICIARY || 'FinGo Soluções Tecnológicas').trim();

      // Cálculo de vencimento e dias restantes com parsing robusto (suporta Date, ISO, GMT)
      const vInfo = parseVencimento(t.vencimento);
      const fmtVenc = vInfo.fmt;
      const diasRestantes = vInfo.dias;
      const situacaoTxt = vInfo.situacao;
      const isTrial = t.status === 'trial' || t.plano === 'trial';
      const badgeStatus = isTrial && diasRestantes >= 0
        ? (diasRestantes === 0 ? 'Trial Termina Hoje' : `Trial: ${diasRestantes}d`)
        : vInfo.badge;

      // Gera o payload PIX EMV BRCode oficial e a URL do QR Code
      const amountCents = planoInfo.cents || Math.round(parseFloat(String(planoInfo.valor || '279.90').replace(',', '.')) * 100);
      const cleanTenantId = String(tenantId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 15);
      const pixPayload = buildPixPayload({
        key: pixKey,
        amountCents,
        txid: `FINGO${cleanTenantId}`,
        merchantName: pixBeneficiary || 'FINGO SISTEMA',
        merchantCity: 'BOA VISTA'
      }) || pixKey;

      const pixQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=2&data=${encodeURIComponent(pixPayload || pixKey)}`;

      // Monta textos padrão por template
      let defaultSubject = `FinGo — Assinatura ${nomeEmpresa}`;
      let defaultMessage = '';
      let defaultTituloAviso = `Assinatura FinGo — ${nomeEmpresa}`;

      if (templateType === 'reminder') {
        defaultSubject = `🔔 FinGo — Lembrete de Renovação de Assinatura (${fmtVenc})`;
        defaultTituloAviso = `Lembrete de Renovação — ${situacaoTxt || 'próximo vencimento'}`;
        defaultMessage = `Olá, ${responsavel}! 👋\n\nPassando para lembrar que a assinatura do *FinGo* da empresa *${nomeEmpresa}* (Plano ${planoInfo.nome}) vence em *${fmtVenc}* (${situacaoTxt}).\n\n💰 *Valor:* R$ ${planoInfo.valor}\n🔑 *Chave PIX:* ${pixKey}\n👤 *Beneficiário:* ${pixBeneficiary}\n\nQualquer dúvida ou caso precise de emissão de NF, estamos à disposição!`;
      } else if (templateType === 'due_today') {
        defaultSubject = `⚠️ FinGo — Sua assinatura vence hoje (${fmtVenc})`;
        defaultTituloAviso = `Sua assinatura vence hoje (${fmtVenc})`;
        defaultMessage = `Olá, ${responsavel}! 🔔\n\nA assinatura do *FinGo* da empresa *${nomeEmpresa}* vence *hoje (${fmtVenc})*.\n\nPara garantir a continuidade dos acessos da sua equipe e sincronização das obras sem interrupção:\n\n💰 *Valor:* R$ ${planoInfo.valor}\n🔑 *Chave PIX:* ${pixKey}\n👤 *Beneficiário:* ${pixBeneficiary}\n\nApós o pagamento via PIX, a renovação é confirmada e os acessos continuam ativos normalmente.`;
      } else if (templateType === 'overdue') {
        defaultSubject = `🚨 FinGo — Aviso de Vencimento e Regularização de Acesso`;
        defaultTituloAviso = `Aviso de Regularização — ${situacaoTxt || 'Assinatura Pendente'}`;
        defaultMessage = `Olá, ${responsavel}! ⚠️\n\nIdentificamos que a assinatura do *FinGo* da empresa *${nomeEmpresa}* venceu em *${fmtVenc}* (${situacaoTxt}) e consta pendente.\n\nPara evitar o bloqueio preventivo dos acessos, emissão de relatórios e sincronização no canteiro de obras, solicitamos a regularização:\n\n💰 *Valor:* R$ ${planoInfo.valor}\n🔑 *Chave PIX:* ${pixKey}\n👤 *Beneficiário:* ${pixBeneficiary}\n\nSe já realizou o pagamento, por favor desconsidere este aviso ou nos envie o comprovante!`;
      } else if (templateType === 'trial_ending') {
        defaultSubject = `🚀 FinGo — Seu período de testes termina em ${fmtVenc}`;
        defaultTituloAviso = `Seu período de testes está terminando em ${fmtVenc}`;
        defaultMessage = `Olá, ${responsavel}! 🚀\n\nSeu período de teste gratuito do *FinGo* na empresa *${nomeEmpresa}* termina em *${fmtVenc}*.\n\nEsperamos que a plataforma esteja transformando a gestão das suas obras! Para continuar utilizando todos os recursos com a sua equipe:\n\n👉 Conheça os planos e assine: https://fingo.api.br/app.html#planos\n💰 *Valor de referência:* R$ ${planoInfo.valor}/mês (${planoInfo.nome})\n🔑 *Chave PIX:* ${pixKey}\n👤 *Beneficiário:* ${pixBeneficiary}\n\nEstamos à disposição para ajudar na escolha do melhor plano!`;
      } else {
        defaultSubject = `FinGo — Notificação de Assinatura (${nomeEmpresa})`;
        defaultTituloAviso = `Notificação de Assinatura — ${nomeEmpresa}`;
        defaultMessage = `Olá, ${responsavel}! Aqui é do FinGo referente à assinatura da empresa ${nomeEmpresa}.`;
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
          pixPayload,
          pixQrCodeUrl,
          pixBeneficiary
        });
      }

      const results = {
        whatsapp: { attempted: false, success: false },
        email: { attempted: false, success: false },
        waLink: destPhone ? `https://wa.me/${destPhone}?text=${encodeURIComponent(finalMessage)}` : `https://web.whatsapp.com/send?text=${encodeURIComponent(finalMessage)}`
      };

      // 1. Disparo por WhatsApp
      if (channel === 'whatsapp' || channel === 'both') {
        results.whatsapp.attempted = true;
        if (!destPhone || destPhone.length < 10) {
          results.whatsapp.error = 'Telefone do cliente inválido ou não cadastrado.';
        } else {
          try {
            const renderBaseUrl = (process.env.RENDER_WHATSAPP_URL || 'https://finan-backend-9rxw.onrender.com').replace(/\/send-message\/?$/, '').replace(/\/+$/, '');
            const secret = getInternalApiSecret();

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
        let resendKey = String(process.env.RESEND_API_KEY || '').trim();
        if ((resendKey.startsWith('"') && resendKey.endsWith('"')) || (resendKey.startsWith("'") && resendKey.endsWith("'"))) {
          resendKey = resendKey.slice(1, -1);
        }
        let emailFrom = String(process.env.RESEND_FROM_EMAIL || process.env.FINOBRA_SUPPORT_EMAIL_FROM || 'FinGo <suporte@fingo.api.br>').trim();
        if ((emailFrom.startsWith('"') && emailFrom.endsWith('"')) || (emailFrom.startsWith("'") && emailFrom.endsWith("'"))) {
          emailFrom = emailFrom.slice(1, -1);
        }

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
              PIX_PAYLOAD: pixPayload,
              PIX_QR_CODE_URL: pixQrCodeUrl,
              PIX_BENEFICIARIO: pixBeneficiary,
              MENSAGEM_EXTRA: finalMessage,
              LINK_ACESSO: 'https://fingo.api.br/login'
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
              const errMsg = emailData.message || `Resend retornou status ${emailRes.status}`;
              // Se a chave estiver restrita ou não autorizada para fingo.api.br, tenta fallback com domínio secundário verificado
              if (errMsg.includes('is not authorized to send emails from') && emailFrom.includes('fingo.api.br')) {
                const fallbackFrom = 'FinGo <suporte@finobra.app.br>';
                try {
                  const retryRes = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${resendKey}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      from: fallbackFrom,
                      to: [destEmail],
                      subject: finalSubject,
                      html: emailHtml
                    }),
                    signal: AbortSignal.timeout(12000)
                  });
                  const retryData = await retryRes.json().catch(() => ({}));
                  if (retryRes.ok && retryData.id) {
                    results.email.success = true;
                    results.email.id = retryData.id;
                    results.email.fallbackUsed = fallbackFrom;
                  } else {
                    results.email.error = errMsg;
                  }
                } catch (_) {
                  results.email.error = errMsg;
                }
              } else {
                results.email.error = errMsg;
              }
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

    // ── POST ?action=trigger_billing_sweep (Disparar Varredura de Cobrança 24/7) ──
    if (req.method === 'POST' && action === 'trigger_billing_sweep') {
      const renderBaseUrl = (process.env.RENDER_WHATSAPP_URL || 'https://finan-backend-9rxw.onrender.com').replace(/\/send-message\/?$/, '').replace(/\/+$/, '');
      const secret = getInternalApiSecret();
      const forcedTenantId = req.body?.tenantId || null;

      let sweepResult = null;
      let usedEngine = 'render';

      // 1. Prioridade Máxima: Trigger.dev Background Job Cloud
      if (isTriggerConfigured()) {
        try {
          const trigRes = await triggerBillingSweep({
            tenantId: forcedTenantId,
            triggeredBy: auth.user?.email || auth.user?.userId || 'admin'
          });

          if (trigRes.success) {
            usedEngine = 'trigger_dev';
            sweepResult = {
              success: true,
              runId: trigRes.runId,
              message: 'Varredura de cobrança enfileirada no Trigger.dev com sucesso.'
            };
          }
        } catch (errTrig) {
          console.warn('[Admin] Trigger.dev indisponível para varredura, tentando Render:', errTrig?.message || errTrig);
        }
      }

      // 2. Fallback: Backend Render WhatsApp/Cron
      if (!sweepResult || !sweepResult.success) {
        try {
          const renderRes = await fetch(`${renderBaseUrl}/cron/billing-sweep`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${secret}`,
              'x-api-key': secret,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tenantId: forcedTenantId }),
            signal: AbortSignal.timeout(12000)
          });

          if (renderRes.ok) {
            sweepResult = await renderRes.json();
            usedEngine = 'render';
          }
        } catch (renderErr) {
          console.warn('Aviso: Render offline ou timeout ao disparar varredura, utilizando engine de fallback:', renderErr.message);
        }
      }

      // Fallback local via Neon caso o backend Render não responda
      if (!sweepResult || !sweepResult.success) {
        usedEngine = 'neon_fallback';
        const hoje = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Boa_Vista', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date());

        const tenants = forcedTenantId
          ? await sql`SELECT id, razao_social, nome_fantasia, telefone, email, responsavel, plano, status, vencimento FROM tenants WHERE id = ${forcedTenantId};`
          : await sql`SELECT id, razao_social, nome_fantasia, telefone, email, responsavel, plano, status, vencimento FROM tenants WHERE status NOT IN ('cancelado', 'arquivado') AND vencimento IS NOT NULL;`;

        let evaluated = 0;
        let notified = 0;
        let skipped = 0;

        for (const t of tenants) {
          evaluated++;
          const vInfo = parseVencimento(t.vencimento);
          if (!vInfo.iso) continue;
          const diff = vInfo.dias;

          let stage = null;
          if (t.plano === 'trial' && diff <= 2 && diff >= 0) stage = 'trial_ending';
          else if (diff === 10) stage = 'reminder_10d';
          else if (diff === 3) stage = 'reminder_3d';
          else if (diff === 0) stage = 'due_today';
          else if (diff === -1) stage = 'overdue_1d';
          else if (diff === -5) stage = 'overdue_5d';

          if (!stage) continue;

          const check = await sql`
            SELECT id FROM billing_notifications_sent
            WHERE tenant_id = ${t.id} AND stage = ${stage} AND sent_date = ${hoje}::date
            LIMIT 1;
          `;
          if (check.length > 0) {
            skipped++;
            continue;
          }

          // Grava idempotência no banco de dados
          await sql`
            INSERT INTO billing_notifications_sent (
              tenant_id, stage, channel, sent_date, recipient_phone, recipient_email, status, metadata
            ) VALUES (
              ${t.id}, ${stage}, 'email', ${hoje}::date, ${t.telefone || null}, ${t.email || null}, 'pending_dispatch',
              ${JSON.stringify({ diff, plano: t.plano, vencimento: t.vencimento, via: 'master_fallback' })}::jsonb
            ) ON CONFLICT (tenant_id, stage, sent_date) DO NOTHING;
          `;
          notified++;
        }

        sweepResult = {
          success: true,
          totalEvaluated: evaluated,
          notified,
          skippedAntiSpam: skipped
        };
      }

      await writeAudit(sql, req, auth, {
        acao: 'varredura_cobranca_executada',
        entidade: 'cobranca_cron',
        depois: { engine: usedEngine, result: sweepResult }
      });

      return res.status(200).json({
        success: true,
        engine: usedEngine,
        result: sweepResult,
        message: 'Varredura de cobrança executada com sucesso!'
      });
    }

    // ── GET ?action=get_billing_automation_status (Status do Robô e Histórico de Disparos) ──
    if (req.method === 'GET' && action === 'get_billing_automation_status') {
      const hoje = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Boa_Vista', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());

      const sentToday = await sql`
        SELECT b.*, COALESCE(t.nome_fantasia, t.razao_social, b.tenant_id) AS empresa_nome
        FROM billing_notifications_sent b
        LEFT JOIN tenants t ON t.id = b.tenant_id
        WHERE b.sent_date = ${hoje}::date
        ORDER BY b.created_at DESC;
      `;

      const history = await sql`
        SELECT b.*, COALESCE(t.nome_fantasia, t.razao_social, b.tenant_id) AS empresa_nome
        FROM billing_notifications_sent b
        LEFT JOIN tenants t ON t.id = b.tenant_id
        ORDER BY b.created_at DESC
        LIMIT 20;
      `;

      return res.status(200).json({
        success: true,
        today: hoje,
        active: true,
        schedule: 'Seg-Sex às 09:30 (Horário Comercial)',
        total_today: sentToday.length,
        notifications_today: sentToday,
        history
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

      // Gera Chave de Acesso exclusiva da construtora (P50)
      const rawAccessKey = generateTenantAccessKey();
      const keyHash = hashTenantAccessKey(rawAccessKey);
      const last4 = tenantAccessKeyLast4(rawAccessKey);

      // Cria Tenant no Neon
      await sql`
        INSERT INTO tenants (id, razao_social, nome_fantasia, cnpj, telefone, email, responsavel, plano, status, vencimento, access_key_hash, access_key_last4, access_key_created_at)
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
          ${finalVencimento},
          ${keyHash},
          ${last4},
          NOW()
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

      await writeAudit(sql, req, auth, {
        acao: 'criar',
        entidade: 'tenant',
        entidadeId: tenantId,
        depois: {
          nome_fantasia: finalNome,
          email: finalEmail,
          plano: finalPlano,
          status: finalStatus,
          vencimento: finalVencimento,
          access_key_last4: last4
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Construtora e usuário administrador criados com sucesso no Neon PostgreSQL!',
        tenant: {
          id: tenantId,
          nome_fantasia: finalNome,
          email: finalEmail,
          plano: finalPlano,
          status: finalStatus,
          vencimento: finalVencimento,
          accessKey: rawAccessKey, // EXIBIDA UMA ÚNICA VEZ NO CADASTRO
          access_key_last4: last4
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

    // ── 3.1 POST ?action=generate_tenant_access_key ou rotate_tenant_access_key ─────
    if (req.method === 'POST' && (action === 'generate_tenant_access_key' || action === 'rotate_tenant_access_key')) {
      const tenantId = String(req.body?.tenantId || '').trim();
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Identificador do tenant não informado.' });
      }

      const rows = await sql`
        SELECT id, nome_fantasia, razao_social, access_key_last4, access_key_created_at
        FROM tenants
        WHERE id = ${tenantId}
        LIMIT 1;
      `;
      if (!rows.length) {
        return res.status(404).json({ success: false, error: 'Construtora não encontrada.' });
      }

      const isRotation = Boolean(rows[0].access_key_last4);
      const rawAccessKey = generateTenantAccessKey();
      const keyHash = hashTenantAccessKey(rawAccessKey);
      const last4 = tenantAccessKeyLast4(rawAccessKey);
      const nowIso = new Date().toISOString();

      await sql`
        UPDATE tenants
        SET access_key_hash = ${keyHash},
            access_key_last4 = ${last4},
            access_key_created_at = NOW(),
            updated_at = NOW()
        WHERE id = ${tenantId};
      `;

      // Auditoria segura: armazena somente os últimos 4 dígitos, NUNCA a chave em texto puro ou hash
      await writeAudit(sql, req, auth, {
        acao: isRotation ? 'rotacionar_chave_acesso' : 'gerar_chave_acesso',
        entidade: 'tenant',
        entidadeId: tenantId,
        antes: {
          access_key_last4: rows[0].access_key_last4,
          access_key_created_at: rows[0].access_key_created_at
        },
        depois: {
          access_key_last4: last4,
          access_key_created_at: nowIso
        }
      });

      return res.status(200).json({
        success: true,
        message: isRotation
          ? 'Chave da Empresa rotacionada com sucesso! Guarde a nova chave agora, pois ela só é exibida uma única vez.'
          : 'Chave da Empresa gerada com sucesso! Guarde a chave agora, pois ela só é exibida uma única vez.',
        tenantId,
        accessKey: rawAccessKey, // EXIBIDA UMA ÚNICA VEZ
        access_key_last4: last4,
        access_key_created_at: nowIso
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
      const secret = getSessionSigningSecret();
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
      const secret = getSessionSigningSecret();
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

    // PATCH 49: Status do 2FA do Super Admin
    if (req.method === 'GET' && action === 'mfa_status') {
      const userId = auth.user?.userId || auth.user?.id;
      if (!userId) return res.status(400).json({ success: false, error: 'Usuário não identificado.' });
      const rows = await sql`
        SELECT id, username, email, mfa_enabled,
               (mfa_backup_codes IS NOT NULL AND jsonb_array_length(mfa_backup_codes) > 0) as has_backup_codes,
               COALESCE(jsonb_array_length(mfa_backup_codes), 0) as backup_codes_count
        FROM usuarios WHERE id = ${userId} LIMIT 1;
      `;
      if (!rows.length) return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
      const u = rows[0];
      return res.status(200).json({
        success: true,
        mfa_enabled: Boolean(u.mfa_enabled),
        has_backup_codes: Boolean(u.has_backup_codes),
        backup_codes_count: Number(u.backup_codes_count || 0)
      });
    }

    // PATCH 49: Regenerar códigos de emergência 2FA
    if (req.method === 'POST' && action === 'mfa_regenerate_backup_codes') {
      const userId = auth.user?.userId || auth.user?.id;
      const password = String(req.body?.password || '').trim();
      if (!password) {
        return res.status(400).json({ success: false, error: 'Senha atual é obrigatória para gerar novos códigos de emergência.' });
      }
      const users = await sql`SELECT id, senha_hash, mfa_enabled FROM usuarios WHERE id = ${userId} LIMIT 1;`;
      if (!users.length) return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
      const u = users[0];
      if (!verifyPassword(password, u.senha_hash)) {
        return res.status(401).json({ success: false, error: 'Senha incorreta.' });
      }
      if (!u.mfa_enabled) {
        return res.status(400).json({ success: false, error: '2FA não está ativo nesta conta.' });
      }
      const { codes, hashedCodes } = generateBackupCodes(8);
      await sql`UPDATE usuarios SET mfa_backup_codes = ${JSON.stringify(hashedCodes)}::jsonb WHERE id = ${userId};`;
      return res.status(200).json({
        success: true,
        backup_codes: codes,
        message: 'Novos códigos de recuperação gerados com sucesso. Guarde-os em local seguro!'
      });
    }

    return res.status(400).json({ success: false, error: `Ação "${action}" desconhecida.` });
  } catch (err) {
    console.error('Erro na API Master Admin:', err);
    return res.status(500).json({ success: false, error: 'Erro interno no servidor Master.' });
  }
}
