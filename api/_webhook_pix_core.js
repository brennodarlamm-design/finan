// api/_webhook_pix_core.js — Motor Unificado de Processamento de Webhooks PIX SaaS
// Compatível com Asaas, OpenPix, Efí / Gerencianet, Mercado Pago e Chamada Direta / Simulação

import crypto from 'crypto';
import { triggerEmail, isTriggerConfigured } from './_trigger-client.js';
import { getPlanCyclePrice } from './_plans.js';

/**
 * Validação de Assinatura e Token de Autenticação do Webhook
 *
 * PATCH 50 — três correções de segurança:
 *   1. Exige PIX_WEBHOOK_SECRET dedicado; não aceita fallback para API_SECRET genérico.
 *   2. Usa crypto.timingSafeEqual em todas as comparações (previne timing attacks).
 *   3. Remove aceitação de segredo via query string (?key=, ?secret=, ?apiKey=),
 *      que podia vazar em logs de servidor, proxy e CDN.
 *
 * Métodos aceitos:
 *   - Header x-webhook-secret
 *   - Header asaas-access-token  (Asaas)
 *   - Header Authorization: Bearer <secret>
 *   - Header x-api-key / apikey
 */
export function isWebhookAuthorized(req) {
  const webhookSecret = String(process.env.PIX_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    console.error('🚨 [Webhook PIX] PIX_WEBHOOK_SECRET não configurado. Todas as requisições serão rejeitadas.');
    return { authorized: false, error: 'Configuração de segurança do webhook pendente no servidor.' };
  }

  const asaasToken = String(process.env.ASAAS_WEBHOOK_TOKEN || webhookSecret).trim();

  /** Comparação em tempo constante: evita timing side-channel e discrepâncias de comprimento */
  function safeCompare(a, b) {
    if (!a || !b) return false;
    const hashA = crypto.createHash('sha256').update(String(a)).digest();
    const hashB = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(hashA, hashB);
  }

  // 1. Header x-webhook-secret
  const headerSecret = String(req.headers?.['x-webhook-secret'] || '').trim();
  if (headerSecret && safeCompare(headerSecret, webhookSecret)) {
    return { authorized: true, source: 'x-webhook-secret' };
  }

  // 2. Header asaas-access-token
  const asaasHeader = String(req.headers?.['asaas-access-token'] || '').trim();
  if (asaasHeader && safeCompare(asaasHeader, asaasToken)) {
    return { authorized: true, source: 'asaas-access-token' };
  }

  // 3. Authorization: Bearer <secret>
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || '').trim();
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.substring(7).trim();
    if (bearer && safeCompare(bearer, webhookSecret)) {
      return { authorized: true, source: 'bearer-secret' };
    }
  }

  // 4. Header x-api-key / apikey
  const apiKey = String(req.headers?.['x-api-key'] || req.headers?.apikey || '').trim();
  if (apiKey && safeCompare(apiKey, webhookSecret)) {
    return { authorized: true, source: 'x-api-key' };
  }

  // Query string foi REMOVIDA intencionalmente (PATCH 50): segredos em URL vazam em logs.

  return {
    authorized: false,
    error: 'Não autorizado: Token, assinatura ou segredo de webhook inválido ou não fornecido.'
  };
}


/**
 * Normalizador de payloads de múltiplos gateways de pagamento
 */
export function parseWebhookPayload(rawBody = {}) {
  let body = rawBody;
  if (typeof rawBody === 'string') {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = {};
    }
  }

  // A. Formato Asaas (Webhook v3)
  if (body.event && (body.payment || body.bill)) {
    const p = body.payment || body.bill || {};
    const isPaymentConfirmed = [
      'PAYMENT_RECEIVED',
      'PAYMENT_CONFIRMED',
      'RECEIVED',
      'CONFIRMED'
    ].includes(String(body.event).toUpperCase());

    if (!isPaymentConfirmed) {
      return {
        ignore: true,
        reason: `Evento Asaas '${body.event}' não requer liquidação financeira.`
      };
    }

    const extRef = String(p.externalReference || '').trim();
    let tenantId = null;
    let invoiceId = null;
    if (extRef.includes(':')) {
      const parts = extRef.split(':');
      tenantId = parts[0];
      invoiceId = parts[1];
    } else if (extRef.startsWith('inv_') || extRef.startsWith('inv-') || extRef.startsWith('cobranca_')) {
      invoiceId = extRef;
    } else if (extRef) {
      tenantId = extRef;
    }

    const txid = p.pixTransaction?.txid || p.pixTransaction?.endToEndIdentifier || p.id || null;
    const amountVal = Number(p.value || p.netValue || 0);
    const amountCents = amountVal > 0 ? Math.round(amountVal * 100) : null;

    return {
      gateway: 'asaas',
      rawEvent: body.event,
      txid: txid ? String(txid).trim() : null,
      invoiceId: invoiceId ? String(invoiceId).trim() : null,
      tenantId: tenantId ? String(tenantId).trim() : null,
      amountCents,
      rawBody: body
    };
  }

  // B. Formato Efí / Gerencianet PIX (Webhook Oficial BACEN)
  if (Array.isArray(body.pix) && body.pix.length > 0) {
    const item = body.pix[0];
    const valor = parseFloat(item.valor || 0);
    return {
      gateway: 'efi_pix',
      rawEvent: 'pix_received',
      txid: String(item.txid || item.endToEndId || '').trim(),
      invoiceId: String(body.invoiceId || body.invoice_id || '').trim() || null,
      tenantId: String(body.tenantId || body.tenant_id || '').trim() || null,
      amountCents: Math.round(valor * 100),
      rawBody: body
    };
  }

  // C. Formato OpenPix / Woovi
  if (body.event === 'OPENPIX:CHARGE_COMPLETED' || (body.charge && body.event?.includes('COMPLETED'))) {
    const c = body.charge || {};
    return {
      gateway: 'openpix',
      rawEvent: body.event || 'CHARGE_COMPLETED',
      txid: String(c.transactionID || c.correlationID || '').trim() || null,
      invoiceId: String(c.correlationID || body.invoiceId || '').trim() || null,
      tenantId: String(body.tenantId || '').trim() || null,
      amountCents: Number(c.value || 0) || null,
      rawBody: body
    };
  }

  // D. Formato Mercado Pago
  if (body.action?.includes('payment') || body.type === 'payment') {
    const paymentId = body.data?.id || body.id;
    return {
      gateway: 'mercadopago',
      rawEvent: body.action || body.type,
      txid: paymentId ? `mp_${paymentId}` : null,
      invoiceId: String(body.invoiceId || body.external_reference || '').trim() || null,
      tenantId: String(body.tenantId || '').trim() || null,
      amountCents: body.transaction_amount ? Math.round(Number(body.transaction_amount) * 100) : null,
      rawBody: body
    };
  }

  // E. Formato Direto / Simulação FinObra
  const txid = body.txid || body.pixId || body.pix_id || body.transaction_id || null;
  const invoiceId = body.invoiceId || body.invoice_id || body.id || null;
  const tenantId = body.tenantId || body.tenant_id || null;
  const amount = body.amount || body.valor || body.value || 0;
  const amountCents = body.amount_cents ? Number(body.amount_cents) : (amount > 0 ? Math.round(Number(amount) * 100) : null);

  return {
    gateway: body.gateway || 'finobra_direct',
    rawEvent: body.event || 'direct_pix_settlement',
    txid: txid ? String(txid).trim() : null,
    invoiceId: invoiceId ? String(invoiceId).trim() : null,
    tenantId: tenantId ? String(tenantId).trim() : null,
    amountCents,
    simulated: Boolean(body.simulated),
    rawBody: body
  };
}

/**
 * Liquidação Atômica no Banco Neon com Garantia de Idempotência
 */
export async function settlePixPayment(sql, payload, meta = {}) {
  // Proteção 1: Rejeita simulação de pagamento vinda de webhook público não autorizado
  if (payload.simulated && meta.source !== 'superadmin_simulation') {
    return {
      success: false,
      error: 'Simulação de pagamento não é permitida em chamadas de webhook público.'
    };
  }

  let invoice = null;

  // 1. Busca estrita por invoiceId
  if (payload.invoiceId) {
    const rows = await sql`
      SELECT id, tenant_id, plan_id, COALESCE(cycle, 'monthly') AS cycle, amount_cents, status, txid, paid_at
      FROM billing_invoices
      WHERE id = ${payload.invoiceId}
      LIMIT 1;
    `;
    if (rows.length) invoice = rows[0];
  }

  // 2. Busca estrita por txid caso ainda não encontrado
  if (!invoice && payload.txid) {
    const rows = await sql`
      SELECT id, tenant_id, plan_id, COALESCE(cycle, 'monthly') AS cycle, amount_cents, status, txid, paid_at
      FROM billing_invoices
      WHERE txid = ${payload.txid}
      LIMIT 1;
    `;
    if (rows.length) invoice = rows[0];
  }

  // Se nenhuma fatura registrada foi encontrada, falha fechado imediatamente
  // (Elimina a criação arbitrária de cobrança ou liquidação cega por tenantId)
  if (!invoice) {
    return {
      success: false,
      error: 'Fatura de cobrança não encontrada para os identificadores fornecidos (invoiceId ou txid inválido).'
    };
  }

  // Proteção 2: Validação de isolamento do tenant da fatura
  if (payload.tenantId && String(payload.tenantId).trim() !== String(invoice.tenant_id).trim()) {
    return {
      success: false,
      error: 'Inconsistência de segurança: o tenantId do payload não coincide com a fatura registrada.'
    };
  }

  // Proteção 3: Idempotência — se a fatura já estiver paga, encerra com sucesso sem duplicar dias
  if (invoice.status === 'paid') {
    return {
      success: true,
      already_processed: true,
      message: 'Cobrança já liquidada anteriormente (idempotência preservada).',
      invoiceId: invoice.id,
      tenantId: invoice.tenant_id,
      txid: invoice.txid,
      paidAt: invoice.paid_at
    };
  }

  // Proteção 4: Conferência Rigorosa do Valor Pago contra o Valor da Fatura (Anti-Tampering)
  const expectedCents = Number(invoice.amount_cents || 0);
  const receivedCents = Number(payload.amountCents || 0);

  if (!receivedCents || receivedCents <= 0) {
    return {
      success: false,
      error: 'Valor pago não informado ou inválido no evento de pagamento.'
    };
  }

  if (receivedCents < expectedCents) {
    return {
      success: false,
      error: `Valor pago (R$ ${(receivedCents / 100).toFixed(2)}) é inferior ao valor da fatura (R$ ${(expectedCents / 100).toFixed(2)}). Liquidação rejeitada por subpagamento.`,
      expectedCents,
      receivedCents
    };
  }

  // Proteção 5: Validação de Consistência com o Catálogo Oficial de Preços do SaaS
  const canonicalPricing = getPlanCyclePrice(invoice.plan_id, invoice.cycle);
  if (canonicalPricing && canonicalPricing.totalCents > 0) {
    if (expectedCents < canonicalPricing.totalCents) {
      return {
        success: false,
        error: `Inconsistência cadastral: o valor da fatura (R$ ${(expectedCents / 100).toFixed(2)}) é inferior ao preço oficial do plano ${invoice.plan_id} no ciclo ${invoice.cycle} (R$ ${(canonicalPricing.totalCents / 100).toFixed(2)}).`
      };
    }
  }

  let resultRecord = null;
  const effectiveTxid = payload.txid || (invoice ? invoice.txid : `pix_${Date.now()}`);
  const payloadJson = payload.rawBody ? JSON.stringify(payload.rawBody) : '{}';

  // Fatura existente validada: atualização atômica da fatura e renovação de vencimento da empresa
  const updated = await sql`
    WITH paid AS (
      UPDATE billing_invoices
      SET status = 'paid',
          paid_at = NOW(),
          paid_by = ${meta.source || 'webhook_pix'},
          txid = COALESCE(billing_invoices.txid, ${effectiveTxid}),
          gateway = ${payload.gateway || 'pix_webhook'},
          webhook_payload = ${payloadJson}::jsonb,
          updated_at = NOW()
      WHERE id = ${invoice.id} AND status IN ('pending', 'expired')
      RETURNING id, tenant_id, plan_id, COALESCE(cycle, 'monthly') AS cycle, amount_cents, txid, paid_at
    ), tenant_upd AS (
      UPDATE tenants t
      SET plano = paid.plan_id,
          status = 'ativo',
          vencimento = (CASE WHEN t.vencimento IS NOT NULL AND t.vencimento >= CURRENT_DATE THEN t.vencimento ELSE CURRENT_DATE END + (
            CASE
              WHEN paid.cycle = 'annual' THEN 365
              WHEN paid.cycle = 'semiannual' THEN 180
              WHEN paid.cycle = 'quarterly' THEN 90
              ELSE 30
            END
          ))::date,
          updated_at = NOW()
      FROM paid
      WHERE t.id = paid.tenant_id
      RETURNING t.id, t.nome_fantasia, t.razao_social, t.telefone, t.email, t.responsavel, t.plano, t.status, t.vencimento
    )
    SELECT paid.id AS invoice_id, paid.tenant_id, paid.plan_id, paid.cycle, paid.amount_cents, paid.txid, paid.paid_at,
           tenant_upd.nome_fantasia, tenant_upd.razao_social, tenant_upd.telefone, tenant_upd.email,
           tenant_upd.responsavel, tenant_upd.status, tenant_upd.vencimento
    FROM paid JOIN tenant_upd ON tenant_upd.id = paid.tenant_id;
  `;

  if (updated.length) {
    resultRecord = updated[0];
  }

  if (!resultRecord) {
    return { success: false, error: 'Cobrança não pôde ser liquidada (possivelmente cancelada ou bloqueada).' };
  }

  return {
    success: true,
    processed: true,
    data: resultRecord
  };
}

/**
 * Envio de Comprovante de Pagamento Instantâneo via WhatsApp (Render) e E-mail (Resend)
 */
export async function sendPaymentReceipt(record) {
  const phone = String(record.telefone || '').replace(/\D/g, '');
  const email = String(record.email || '').trim();
  const nomeEmpresa = record.nome_fantasia || record.razao_social || 'Sua Empresa';
  const responsavel = record.responsavel || 'Gestor(a)';

  let fmtVenc = 'A definir';
  if (record.vencimento) {
    const parts = String(record.vencimento).split('-');
    fmtVenc = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(record.vencimento);
  }

  const cycleNames = {
    monthly: 'Mensal (30 dias)',
    quarterly: 'Trimestral (90 dias)',
    semiannual: 'Semestral (180 dias)',
    annual: 'Anual (365 dias)'
  };
  const cicloDesc = cycleNames[record.cycle] || '30 dias';
  const valorFmt = (Number(record.amount_cents || 0) / 100).toFixed(2).replace('.', ',');

  const message = `🎉 *Pagamento PIX Confirmado!*\n\nOlá, ${responsavel}! 👋\nConfirmamos com sucesso o recebimento do pagamento da assinatura do *FinObra* para a empresa *${nomeEmpresa}*.\n\n✅ *Status:* Assinatura Ativa & Liberada\n📦 *Plano:* ${String(record.plan_id || 'Profissional').toUpperCase()} (${cicloDesc})\n💰 *Valor:* R$ ${valorFmt}\n🗓️ *Novo Vencimento:* ${fmtVenc}\n🔑 *Identificador PIX (TXID):* ${record.txid || '—'}\n\nMuito obrigado pela confiança e parceria! Os acessos da sua equipe e a sincronização com os canteiros de obras continuam ativos normalmente.`;

  const results = {
    whatsapp: { attempted: false, success: false },
    email: { attempted: false, success: false }
  };

  // 1. WhatsApp via Robô Baileys no Render
  if (phone && phone.length >= 10) {
    results.whatsapp.attempted = true;
    try {
      const renderBaseUrl = (
        process.env.RENDER_WHATSAPP_URL || 'https://finan-backend-9rxw.onrender.com'
      ).replace(/\/send-message\/?$/, '').replace(/\/+$/, '');

      const secret = (process.env.INTERNAL_API_SECRET || '').trim();

      const wpRes = await fetch(`${renderBaseUrl}/send-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secret}`,
          'x-api-key': secret,
          'Content-Type': 'application/json',
          'x-tenant-id': process.env.FINOBRA_MASTER_TENANT || 'angelim'
        },
        body: JSON.stringify({ phone, message }),
        signal: AbortSignal.timeout(15000)
      });

      const wpData = await wpRes.json().catch(() => ({}));
      if (wpRes.ok && (wpData.success || wpData.messageId)) {
        results.whatsapp.success = true;
        results.whatsapp.messageId = wpData.messageId;
      } else {
        results.whatsapp.error = wpData.error || `HTTP ${wpRes.status}`;
      }
    } catch (wpErr) {
      results.whatsapp.error = wpErr.message;
      console.error('❌ [Webhook PIX] Falha no WhatsApp de recibo:', wpErr.message);
    }
  }

  // 2. E-mail via Resend (se chave e e-mail estiverem configurados)
  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  if (email && email.includes('@') && resendKey) {
    results.email.attempted = true;
    try {
      const emailFrom = String(process.env.FINOBRA_SUPPORT_EMAIL_FROM || 'FinGo <suporte@fingo.api.br>').trim();
      const subject = `🎉 FinGo — Pagamento Confirmado e Assinatura Renovada (${fmtVenc})`;

      const emailHtml = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;color:#1e293b;">
          <div style="background:linear-gradient(135deg,#0284c7,#0369a1);padding:24px 30px;color:#ffffff;">
            <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">FinGo · Gestão de Obras</h1>
            <p style="margin:6px 0 0 0;font-size:14px;color:#e0f2fe;">Comprovante Oficial de Liquidação de Assinatura</p>
          </div>
          <div style="padding:28px 30px;">
            <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">Olá, <strong>${responsavel}</strong>!</p>
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;">Confirmamos o recebimento do pagamento da assinatura do <strong>FinGo</strong> para a empresa <strong>${nomeEmpresa}</strong>.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px;margin-bottom:24px;">
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:6px 0;color:#64748b;">Status:</td><td style="padding:6px 0;font-weight:700;color:#16a34a;">🟢 Assinatura Ativa & Liberada</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Plano:</td><td style="padding:6px 0;font-weight:700;">${String(record.plan_id || 'Profissional').toUpperCase()} (${cicloDesc})</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Valor Liquidado:</td><td style="padding:6px 0;font-weight:700;">R$ ${valorFmt}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Novo Vencimento:</td><td style="padding:6px 0;font-weight:700;color:#0284c7;">${fmtVenc}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Identificador TXID:</td><td style="padding:6px 0;font-family:monospace;font-size:12px;">${record.txid || '—'}</td></tr>
              </table>
            </div>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#475569;">Agradecemos pela parceria contínua! Os acessos de todos os colaboradores e canteiros de obras estão ativos normalmente.</p>
            <div style="margin-top:28px;text-align:center;">
              <a href="https://fingo.api.br/login" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:700;font-size:14px;">Acessar o FinGo</a>
            </div>
          </div>
          <div style="background:#f1f5f9;padding:14px 30px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
            FinGo · Obras em Fluxo · Mensagem Automática gerada pelo Webhook PIX
          </div>
        </div>
      `;

      // Prioridade: Trigger.dev com retries resilientes e enfileiramento desacoplado
      if (isTriggerConfigured()) {
        const trigRes = await triggerEmail({
          from: emailFrom,
          to: email,
          subject,
          html: emailHtml,
          tenantId: record.tenant_id || null
        }, {
          idempotencyKey: `pix-receipt-${record.txid || record.id || Date.now()}`
        });

        if (trigRes.success) {
          results.email.success = true;
          results.email.id = trigRes.runId;
          results.email.via = 'trigger_dev';
          return;
        }
      }

      // Fallback: Disparo HTTP direto ao Resend
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [email],
          subject,
          html: emailHtml
        }),
        signal: AbortSignal.timeout(12000)
      });

      const emailData = await emailRes.json().catch(() => ({}));
      if (emailRes.ok && emailData.id) {
        results.email.success = true;
        results.email.id = emailData.id;
        results.email.via = 'resend_direct';
      } else {
        results.email.error = emailData.message || `HTTP ${emailRes.status}`;
      }
    } catch (eErr) {
      results.email.error = eErr.message;
      console.error('❌ [Webhook PIX] Falha no e-mail de recibo:', eErr.message);
    }
  }

  return results;
}
