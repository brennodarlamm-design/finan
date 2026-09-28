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

function escapeHtmlEmail(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Constrói o layout HTML padrão oficial com a arte, logo e identidade visual do FinGo.
 * Garante que qualquer e-mail enviado tenha design profissional com cabeçalho timbrado,
 * badge do canal oficial, head customizável, texto livre e botão de ação opcional.
 */
export function buildStandardEmailHtml({
  headTitle = '',
  title = '',
  bodyText = '',
  bodyHtml = '',
  channelKey = 'CONTATO',
  ctaText = '',
  ctaUrl = '',
  badge = '',
  previewText = ''
} = {}) {
  const channel = EMAIL_CHANNELS[channelKey] || EMAIL_CHANNELS.CONTATO;
  const channelName = channel.name || 'FinGo Oficial';
  const displayHead = String(headTitle || title || 'Comunicado Oficial FinGo').trim();
  const displayBadge = String(badge || channelName).trim();
  const snippet = String(previewText || displayHead).trim();

  // Converte texto simples para parágrafos se não houver HTML fornecido
  let contentHtml = bodyHtml;
  if (!contentHtml && bodyText) {
    const paragraphs = String(bodyText)
      .trim()
      .split(/\n\s*\n/)
      .map(p => {
        const lines = escapeHtmlEmail(p).replace(/\n/g, '<br />');
        return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#CBD5E1;">${lines}</p>`;
      })
      .join('\n');
    contentHtml = paragraphs || `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#CBD5E1;">${escapeHtmlEmail(bodyText)}</p>`;
  } else if (!contentHtml) {
    contentHtml = '<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#CBD5E1;">(Sem conteúdo)</p>';
  }

  const ctaButtonHtml = (ctaText && ctaUrl) ? `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:32px auto 16px;text-align:center;">
      <tr>
        <td align="center" style="border-radius:6px;background:#C6FF00;">
          <a href="${escapeHtmlEmail(ctaUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#C6FF00;border:1px solid #C6FF00;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:900;color:#0A0A0A;text-decoration:none;padding:14px 34px;letter-spacing:0.04em;text-transform:uppercase;box-shadow:0 4px 18px rgba(198,255,0,0.35);">
            ${escapeHtmlEmail(ctaText)} &rarr;
          </a>
        </td>
      </tr>
    </table>
  ` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlEmail(displayHead)}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F0F0E8;-webkit-font-smoothing:antialiased;">
  <!-- Preview Text -->
  <span style="display:none !important;visibility:hidden;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtmlEmail(snippet)}
  </span>

  <div style="background:#0A0A0A;padding:40px 16px;min-height:100vh;">
    <div style="max-width:620px;margin:0 auto;background:#141D12;border:1px solid #282828;border-radius:8px;overflow:hidden;box-shadow:0 20px 48px rgba(0,0,0,0.85);">
      
      <!-- Cabeçalho com Logotipo Oficial FinGo e Badge do Canal -->
      <div style="background:#0A0A0A;padding:24px 32px;border-bottom:3px solid #C6FF00;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td valign="middle" style="text-align:left;">
              <a href="https://fingo.api.br" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">
                <img src="https://fingo.api.br/img/fingo/fingo-logo-full.png" alt="FinGo — Obras em Fluxo" style="height:34px;width:auto;max-width:180px;object-fit:contain;display:block;border:0;" />
              </a>
            </td>
            <td valign="middle" style="text-align:right;">
              <span style="display:inline-block;padding:5px 12px;background:rgba(198,255,0,0.12);border:1px solid rgba(198,255,0,0.35);border-radius:4px;font-size:11px;font-weight:800;color:#C6FF00;text-transform:uppercase;letter-spacing:0.06em;">
                ${escapeHtmlEmail(displayBadge)}
              </span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Conteúdo Principal -->
      <div style="padding:36px 32px 28px;">
        <h1 style="margin:0 0 18px 0;font-size:22px;font-weight:900;color:#F0F0E8;line-height:1.3;letter-spacing:-0.4px;">
          ${escapeHtmlEmail(displayHead)}
        </h1>

        <div style="font-size:15px;line-height:1.65;color:#CBD5E1;">
          ${contentHtml}
        </div>

        ${ctaButtonHtml}
      </div>

      <!-- Rodapé Institucional FinGo -->
      <div style="background:#0A0A0A;padding:24px 32px;border-top:1px solid #282828;font-size:11px;color:#8E8E8E;line-height:1.6;text-align:center;">
        <strong style="color:#CBD5E1;">FinGo Tecnologia &amp; Gestão de Obras</strong> &bull; CNPJ 53.864.218/0001-20<br>
        Canal de Atendimento Oficial: <a href="mailto:${channel.address}" style="color:#C6FF00;text-decoration:none;font-weight:700;">${channel.address}</a><br>
        <span style="font-size:10px;color:#64748B;">Mensagem oficial da plataforma FinGo — Obras em Fluxo</span>
      </div>

    </div>
  </div>
</body>
</html>`;
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
  headTitle = '',
  html = '',
  text = '',
  ctaText = '',
  ctaUrl = '',
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

  // Garante que o e-mail sempre venha com a arte/logo padrão se não for HTML completo com DOCTYPE
  let finalHtml = html;
  if (!finalHtml || (!finalHtml.includes('<!DOCTYPE') && !finalHtml.includes('<html'))) {
    finalHtml = buildStandardEmailHtml({
      headTitle: headTitle || subject,
      title: subject,
      bodyText: text,
      bodyHtml: html,
      channelKey: channel.key,
      ctaText,
      ctaUrl
    });
  }
  const finalText = text || headTitle || subject;

  let providerId = null;
  let status = 'sent';
  let errorMessage = null;

  if (resendKey) {
    try {
      const payload = {
        from: senderFormatted,
        to: Array.isArray(to) ? to : [to],
        subject: subject || 'Mensagem FinGo',
        reply_to: replyToAddress,
        html: finalHtml,
        text: finalText
      };
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
