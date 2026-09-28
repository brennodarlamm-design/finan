// api/_webhook_email.js — Sub-Handler de Webhook de E-mails Recebidos (Inbound)
// Captura respostas e novas mensagens para contato@fingo.api.br, suporte@fingo.api.br, etc.

import crypto from 'crypto';
import { resolveAuthAndTenant } from './_auth.js';
import { writeAudit } from './_audit.js';
import { createOwnerSql } from './_database.js';
import { parseInboundEmailPayload, EMAIL_CHANNELS } from './_email_service.js';

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isEmailWebhookAuthorized(req) {
  const emailSecret = String(process.env.EMAIL_WEBHOOK_SECRET || '').trim();
  const internalSecret = String(process.env.INTERNAL_API_SECRET || '').trim();
  const pixSecret = String(process.env.PIX_WEBHOOK_SECRET || '').trim();

  // 1. Header x-webhook-secret ou x-email-webhook-secret
  const headerSecret = String(req.headers?.['x-webhook-secret'] || req.headers?.['x-email-webhook-secret'] || '').trim();
  if (headerSecret) {
    if (emailSecret && safeCompare(headerSecret, emailSecret)) return { authorized: true, source: 'x-webhook-secret' };
    if (internalSecret && safeCompare(headerSecret, internalSecret)) return { authorized: true, source: 'internal-secret' };
    if (pixSecret && safeCompare(headerSecret, pixSecret)) return { authorized: true, source: 'pix-fallback' };
  }

  // 2. Authorization Bearer
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || '').trim();
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (emailSecret && safeCompare(bearer, emailSecret)) return { authorized: true, source: 'bearer-token' };
    if (internalSecret && safeCompare(bearer, internalSecret)) return { authorized: true, source: 'bearer-internal' };
  }

  // 3. Svix / Resend Webhook Signature (se configurado)
  const svixSig = String(req.headers?.['svix-signature'] || '').trim();
  if (svixSig && emailSecret) {
    // Svix signature presente
    return { authorized: true, source: 'svix-signature' };
  }

  return { authorized: false, error: 'Token ou assinatura de webhook de e-mail inválido ou não fornecido.' };
}

export { webhookEmailHandler as handleInboundEmailWebhook };
export default async function webhookEmailHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-webhook-secret, x-email-webhook-secret, svix-id, svix-timestamp, svix-signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
  }

  let authResult = isEmailWebhookAuthorized(req);
  let isSuperAdmin = false;

  if (!authResult.authorized) {
    // Permite disparo via sessão Super Admin (para testes / simulador do painel Master)
    const hasCredential = Boolean(req.headers?.authorization || req.headers?.cookie?.includes('finobra_session_token'));
    if (hasCredential) {
      try {
        const sessionAuth = await resolveAuthAndTenant(req);
        if (sessionAuth.authenticated && sessionAuth.user?.perfil === 'superadmin') {
          authResult = { authorized: true, source: 'superadmin-session' };
          isSuperAdmin = true;
        }
      } catch {}
    }
  }

  if (!authResult.authorized) {
    return res.status(401).json({
      success: false,
      error: authResult.error || 'Acesso não autorizado ao webhook de e-mails.'
    });
  }

  const payload = parseInboundEmailPayload(req.body, req.headers || {});
  if (!payload.from || !payload.to) {
    return res.status(400).json({
      success: false,
      error: 'Payload inválido: remetente (from) e destinatário (to) são obrigatórios.'
    });
  }

  const sql = createOwnerSql();
  const emailId = `eml_in_${crypto.randomBytes(12).toString('hex')}`;

  // Tenta associar tenant_id pelo e-mail do remetente
  let matchedTenantId = null;
  try {
    const userMatch = await sql`
      SELECT tenant_id FROM usuarios WHERE LOWER(email) = LOWER(${payload.from}) LIMIT 1;
    `;
    if (userMatch.length && userMatch[0].tenant_id) {
      matchedTenantId = userMatch[0].tenant_id;
    } else {
      const tenantMatch = await sql`
        SELECT id FROM tenants WHERE LOWER(email) = LOWER(${payload.from}) LIMIT 1;
      `;
      if (tenantMatch.length) matchedTenantId = tenantMatch[0].id;
    }
  } catch (lookupErr) {
    console.warn('⚠️ [Webhook Email] Falha na busca por tenant correspondente:', lookupErr.message);
  }

  // Tenta associar com e-mail anterior se houver inReplyTo
  if (!matchedTenantId && payload.inReplyTo) {
    try {
      const parentMatch = await sql`
        SELECT tenant_id FROM email_messages WHERE message_id = ${payload.inReplyTo} OR provider_id = ${payload.inReplyTo} LIMIT 1;
      `;
      if (parentMatch.length && parentMatch[0].tenant_id) {
        matchedTenantId = parentMatch[0].tenant_id;
      }
    } catch {}
  }

  try {
    await sql`
      INSERT INTO email_messages (
        id, tenant_id, direction, channel, sender, recipient, reply_to,
        subject, body_text, body_html, status, provider_id, message_id, in_reply_to,
        metadata, is_read, created_at, updated_at
      ) VALUES (
        ${emailId},
        ${matchedTenantId},
        'inbound',
        ${payload.channel},
        ${payload.from},
        ${payload.to},
        ${payload.from},
        ${payload.subject},
        ${payload.text},
        ${payload.html},
        'received',
        ${req.body?.id || req.body?.data?.id || null},
        ${payload.messageId || null},
        ${payload.inReplyTo || null},
        ${JSON.stringify({
          source: authResult.source,
          simulated: isSuperAdmin && Boolean(req.body?.simulated),
          attachments_count: payload.attachments.length
        })}::jsonb,
        false,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `;

    return res.status(200).json({
      success: true,
      id: emailId,
      channel: payload.channel,
      matchedTenantId,
      isReply: Boolean(payload.inReplyTo),
      message: 'E-mail recebido e registrado na Central de E-mails com sucesso.'
    });
  } catch (err) {
    console.error('❌ [Webhook Email] Erro ao gravar e-mail recebido:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao processar e-mail recebido.' });
  }
}
