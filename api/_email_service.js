// api/_email_service.js — Central de E-mails FinGo: Multicanal, Resend & Neon DB
// Define canais dedicados e unifica disparo outbound, parsing inbound e persistência

import crypto from 'crypto';

export const EMAIL_CHANNELS = {
  CONTATO: {
    key: 'CONTATO',
    address: 'contato@fingo.api.br',
    formatted: 'FinGo <contato@fingo.api.br>',
    name: 'FinGo Institucional',
    role: 'principal',
    description: 'E-mail principal da empresa e canal padrão de recebimento'
  },
  SUPORTE: {
    key: 'SUPORTE',
    address: 'suporte@fingo.api.br',
    formatted: 'FinGo Suporte <suporte@fingo.api.br>',
    name: 'FinGo Suporte & FinBot',
    role: 'suporte',
    description: 'Disparos de suporte, chamados FinBot e alertas de SLA'
  },
  COMERCIAL: {
    key: 'COMERCIAL',
    address: 'comercial@fingo.api.br',
    formatted: 'FinGo Comercial <comercial@fingo.api.br>',
    name: 'FinGo Comercial & Faturamento',
    role: 'comercial',
    description: 'Envio de faturas, cobranças, notificações PIX e boas-vindas'
  },
  NO_REPLY: {
    key: 'NO_REPLY',
    address: 'no-reply@fingo.api.br',
    formatted: 'FinGo <no-reply@fingo.api.br>',
    name: 'FinGo Notificações Automáticas',
    role: 'no-reply',
    description: 'Códigos OTP, redefinição de senha e alertas transacionais de sistema'
  },
  NOVIDADES: {
    key: 'NOVIDADES',
    address: 'novidades@fingo.api.br',
    formatted: 'FinGo Novidades <novidades@fingo.api.br>',
    name: 'FinGo Radar & Novidades',
    role: 'novidades',
    description: 'Newsletter, comunicados e atualizações da plataforma'
  }
};

/**
 * Mapeia uma categoria ou finalidade para o canal oficial correspondente.
 */
export function resolveEmailChannel(category = 'geral') {
  const cat = String(category || '').toLowerCase().trim();
  if (['suporte', 'support', 'finbot', 'chamado', 'sla', 'atendimento'].includes(cat)) {
    return EMAIL_CHANNELS.SUPORTE;
  }
  if (['fatura', 'cobranca', 'billing', 'pix', 'comercial', 'welcome', 'boas-vindas', 'assinatura', 'plano'].includes(cat)) {
    return EMAIL_CHANNELS.COMERCIAL;
  }
  if (['newsletter', 'radar', 'novidades', 'comunicado', 'marketing'].includes(cat)) {
    return EMAIL_CHANNELS.NOVIDADES;
  }
  if (['otp', 'auth', 'senha', 'recuperacao', 'reset', 'security', 'token', 'sistema', 'no-reply', 'alerta'].includes(cat)) {
    return EMAIL_CHANNELS.NO_REPLY;
  }
  // Padrão: canal principal da empresa
  return EMAIL_CHANNELS.CONTATO;
}

/**
 * Normaliza o endereço do canal receptor a partir de uma string ou lista "To"
 */
export function matchChannelByAddress(addressStr = '') {
  const clean = String(addressStr || '').toLowerCase();
  if (clean.includes('suporte@fingo.api.br')) return EMAIL_CHANNELS.SUPORTE;
  if (clean.includes('comercial@fingo.api.br') || clean.includes('cobranca@fingo.api.br') || clean.includes('financeiro@fingo.api.br')) return EMAIL_CHANNELS.COMERCIAL;
  if (clean.includes('novidades@fingo.api.br') || clean.includes('newsletter@fingo.api.br')) return EMAIL_CHANNELS.NOVIDADES;
  if (clean.includes('no-reply@fingo.api.br') || clean.includes('nao-responder@fingo.api.br')) return EMAIL_CHANNELS.NO_REPLY;
  // Principal para recebimento da empresa
  return EMAIL_CHANNELS.CONTATO;
}

/**
 * Dispara e-mail via Resend e persiste o histórico em email_messages no Neon
 */
export async function sendAndLogEmail(sql, {
  tenantId = null,
  category = 'geral',
  channelKey = null,
  from = null,
  to,
  subject,
  html = '',
  text = '',
  replyTo = null,
  metadata = {},
  inReplyTo = null
}) {
  const channel = (channelKey && EMAIL_CHANNELS[channelKey])
    ? EMAIL_CHANNELS[channelKey]
    : resolveEmailChannel(category);

  const senderFormatted = from || channel.formatted;
  // Padrão: contato@fingo.api.br como principal para respostas, exceto se especificado
  const replyToAddress = replyTo || EMAIL_CHANNELS.CONTATO.address;
  const resendKey = String(process.env.RESEND_API_KEY || '').trim();

  let providerId = null;
  let status = 'sent';
  let errorMessage = null;

  if (resendKey) {
    try {
      const payload = {
        from: senderFormatted,
        to: Array.isArray(to) ? to : [to],
        subject: subject || 'Mensagem FinGo',
        reply_to: replyToAddress
      };
      if (html) payload.html = html;
      if (text) payload.text = text;
      if (inReplyTo) {
        payload.headers = {
          'In-Reply-To': inReplyTo,
          'References': inReplyTo
        };
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.id) {
        providerId = data.id;
        status = 'delivered';
      } else {
        status = 'failed';
        errorMessage = data?.message || `HTTP ${res.status}`;
        console.error('❌ [EmailService] Resend rejeitou envio:', { status: res.status, data });
      }
    } catch (err) {
      status = 'failed';
      errorMessage = err.message;
      console.error('❌ [EmailService] Falha na conexão com Resend:', err);
    }
  } else {
    // Ambiente local / mock
    providerId = `mock_${crypto.randomBytes(8).toString('hex')}`;
    status = 'simulated';
  }

  const emailId = `eml_${crypto.randomBytes(12).toString('hex')}`;
  const recipientStr = Array.isArray(to) ? to.join(', ') : String(to || '');

  if (sql) {
    try {
      await sql`
        INSERT INTO email_messages (
          id, tenant_id, direction, channel, sender, recipient, reply_to,
          subject, body_text, body_html, status, provider_id, in_reply_to,
          metadata, is_read, created_at, updated_at
        ) VALUES (
          ${emailId},
          ${tenantId},
          'outbound',
          ${channel.address},
          ${senderFormatted},
          ${recipientStr},
          ${replyToAddress},
          ${subject || ''},
          ${text || ''},
          ${html || ''},
          ${status},
          ${providerId},
          ${inReplyTo || null},
          ${JSON.stringify({ ...metadata, category, error: errorMessage })}::jsonb,
          true,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        );
      `;
    } catch (dbErr) {
      console.error('⚠️ [EmailService] Falha ao persistir log outbound:', dbErr.message);
    }
  }

  return {
    id: emailId,
    providerId,
    status,
    channel: channel.address,
    success: status !== 'failed',
    error: errorMessage
  };
}

/**
 * Normaliza payloads recebidos via Inbound Webhook (Resend, Cloudflare Email Routing ou Simulação)
 */
export function parseInboundEmailPayload(body = {}, headers = {}) {
  // 1. Formato Resend Inbound Webhook (type: email.received ou payload direto)
  const isResendWrapped = body?.type === 'email.received' && body?.data;
  const data = isResendWrapped ? body.data : body;

  const from = String(data?.from?.email || data?.from || headers['from'] || '').trim();
  const toRaw = data?.to || headers['to'] || 'contato@fingo.api.br';
  const to = Array.isArray(toRaw) ? toRaw.join(', ') : String(toRaw);
  const subject = String(data?.subject || headers['subject'] || '(Sem Assunto)').trim();
  const text = String(data?.text || data?.body_text || '').trim();
  const html = String(data?.html || data?.body_html || '').trim();
  const messageId = String(data?.message_id || data?.headers?.['message-id'] || headers['message-id'] || '').trim();
  const inReplyTo = String(data?.in_reply_to || data?.headers?.['in-reply-to'] || headers['in-reply-to'] || '').trim();

  // Canal destinatário (ex: contato@, suporte@, comercial@...)
  const channel = matchChannelByAddress(to);

  return {
    from,
    to,
    sender: from,
    recipient: to,
    subject,
    text,
    html,
    messageId,
    inReplyTo,
    channel: channel.address,
    channelKey: channel.key,
    attachments: data?.attachments || []
  };
}
