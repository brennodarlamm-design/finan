// trigger/email.js — Tarefa de Envio de E-mails Transacionais com Resend
import { task, logger } from "@trigger.dev/sdk";

export const sendTransactionalEmail = task({
  id: "send-transactional-email",
  retry: {
    maxAttempts: 4,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
    factor: 2,
    randomize: true
  },
  run: async (payload) => {
    const { to, subject, html, replyTo, attachments, tag, metadata } = payload || {};

    if (!to || !to.includes('@')) {
      logger.warn("Destinatário de e-mail inválido", { to });
      return { success: false, error: "Destinatário inválido" };
    }

    if (!subject || !html) {
      logger.warn("Assunto ou conteúdo HTML ausente", { subject });
      return { success: false, error: "Assunto ou conteúdo ausente" };
    }

    const resendKey = String(process.env.RESEND_API_KEY || '').trim();
    if (!resendKey) {
      logger.error("RESEND_API_KEY não configurada no ambiente de execução.");
      throw new Error("RESEND_API_KEY ausente");
    }

    const fromEmail = String(process.env.FINOBRA_SUPPORT_EMAIL_FROM || 'FinObra <suporte@fingo.api.br>').trim();

    logger.info("Enviando e-mail transacional via Resend", {
      to,
      subject,
      from: fromEmail,
      tag: tag || 'transactional'
    });

    const body = {
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      reply_to: replyTo || process.env.FINOBRA_SUPPORT_EMAIL || 'suporte@fingo.api.br'
    };

    if (Array.isArray(attachments) && attachments.length > 0) {
      body.attachments = attachments;
    }

    if (tag) {
      body.tags = [{ name: 'category', value: String(tag) }];
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      logger.error("Falha ao entregar e-mail pelo Resend", { status: res.status, data });
      // Lança erro para acionar a política de retry do Trigger.dev com backoff
      throw new Error(data?.message || `Erro Resend HTTP ${res.status}`);
    }

    logger.info("E-mail entregue com sucesso pelo Resend", { emailId: data.id, to });
    return {
      success: true,
      emailId: data.id,
      sentAt: new Date().toISOString(),
      to,
      metadata
    };
  }
});
