// api/_webhook_pix.js — Sub-Handler de Webhook PIX e Baixa Automática SaaS
// Integrado via rewrite de /api/webhook-pix para /api/plano?sub=webhook_pix (Hobby Plan Limit <= 12)
// Compatível com Asaas, OpenPix, Efí / Gerencianet, Mercado Pago e Simulação

import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { writeAudit } from './_audit.js';
import { createOwnerSql } from './_database.js';
import {
  isWebhookAuthorized,
  parseWebhookPayload,
  settlePixPayment,
  sendPaymentReceipt
} from './_webhook_pix_core.js';

export default async function webhookPixHandler(req, res) {
  // CORS flexível para webhooks de provedores de pagamento
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-webhook-secret, asaas-access-token, x-api-key, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
  }

  // 1. Verificação de Autenticação / Segurança
  let authResult = isWebhookAuthorized(req);
  let isSuperAdminSession = false;

  if (!authResult.authorized) {
    // SEC-EDGE-02: Permite simulação apenas se houver credencial explícita na requisição, evitando DoS no Neon
    const hasAuthCredential = Boolean(req.headers?.authorization || req.headers?.cookie?.includes('finobra_session_token'));
    if (hasAuthCredential) {
      try {
        const sessionAuth = await resolveAuthAndTenant(req);
        if (sessionAuth.authenticated && sessionAuth.user?.perfil === 'superadmin') {
          authResult = { authorized: true, source: 'superadmin-session' };
          isSuperAdminSession = true;
        }
      } catch {
        // Ignora erro de sessão e mantém o erro de autorização padrão
      }
    }
  }

  if (!authResult.authorized) {
    return res.status(401).json({
      success: false,
      error: authResult.error || 'Acesso não autorizado ao webhook de pagamento.'
    });
  }

  // 2. Normalização do Payload
  const payload = parseWebhookPayload(req.body);

  if (payload.ignore) {
    return res.status(200).json({
      success: true,
      ignored: true,
      reason: payload.reason
    });
  }

  try {
    const sql = createOwnerSql();

    // 3. Liquidação Atômica no Banco de Dados
    const settleResult = await settlePixPayment(sql, payload, {
      source: isSuperAdminSession ? 'superadmin_simulation' : authResult.source
    });

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
      return res.status(422).json({
        success: false,
        error: settleResult.error || 'Falha ao processar liquidação da assinatura.'
      });
    }

    const data = settleResult.data;

    // 4. Auditoria de Segurança
    await writeAudit(sql, req, { tenantId: data.tenant_id, user: { id: 'webhook_pix' } }, {
      acao: payload.simulated ? 'pagamento_pix_simulado' : 'pagamento_pix_webhook',
      entidade: 'cobranca',
      entidadeId: data.invoice_id,
      depois: {
        tenantId: data.tenant_id,
        empresa: data.nome_fantasia || data.razao_social,
        plano: data.plan_id,
        ciclo: data.cycle,
        amount_cents: data.amount_cents,
        txid: data.txid,
        vencimento: data.vencimento,
        gateway: payload.gateway
      }
    });

    // 5. Envio de Comprovante via WhatsApp e E-mail (Best-Effort assíncrono)
    const receipt = await sendPaymentReceipt(data);

    return res.status(200).json({
      success: true,
      processed: true,
      gateway: payload.gateway,
      invoiceId: data.invoice_id,
      tenantId: data.tenant_id,
      tenantNome: data.nome_fantasia || data.razao_social,
      novoVencimento: data.vencimento,
      plano: data.plan_id,
      ciclo: data.cycle,
      receipt
    });
  } catch (err) {
    console.error('❌ [Webhook PIX] Falha no processamento:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Não foi possível processar o webhook de pagamento no momento.'
    });
  }
}
