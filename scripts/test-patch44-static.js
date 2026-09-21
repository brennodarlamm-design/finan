// scripts/test-patch44-static.js — Validação Estática do PATCH 44: Webhook PIX e Baixa Automática SaaS
import fs from 'fs';
import path from 'path';
import {
  isWebhookAuthorized,
  parseWebhookPayload
} from '../api/_webhook_pix_core.js';

let totalTests = 0;
let passedTests = 0;

function test(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ ${name}`);
  } else {
    console.error(`  ❌ ${name}`);
    if (details) console.error(`     Detalhes: ${details}`);
    process.exitCode = 1;
  }
}

console.log('🧪 Executando Testes Estáticos — PATCH 44: Webhook PIX e Baixa Automática SaaS...\n');

// 1. Arquivos Core e Endpoint
const corePath = path.resolve('api/_webhook_pix_core.js');
const subHandlerPath = path.resolve('api/_webhook_pix.js');
const planoPath = path.resolve('api/plano.js');
const vercelJsonPath = path.resolve('vercel.json');
const adminPath = path.resolve('api/admin.js');
const adminRoutePath = path.resolve('api/_admin-route.js');
const masterHtmlPath = path.resolve('master.html');
const masterJsPath = path.resolve('js/master.js');
const patch26EventsPath = path.resolve('js/patch26-events.js');
const migration020Path = path.resolve('migrations/020_webhook_pix_integration.sql');

test('api/_webhook_pix_core.js existe', fs.existsSync(corePath));
test('api/_webhook_pix.js existe', fs.existsSync(subHandlerPath));
test('migrations/020_webhook_pix_integration.sql existe', fs.existsSync(migration020Path));

const readNormalized = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const coreCode = readNormalized(corePath);
const subHandlerCode = readNormalized(subHandlerPath);
const planoCode = readNormalized(planoPath);
const vercelJson = readNormalized(vercelJsonPath);
const adminCode = readNormalized(adminPath);
const adminRouteCode = readNormalized(adminRoutePath);
const masterHtml = readNormalized(masterHtmlPath);
const masterJs = readNormalized(masterJsPath);
const patch26Events = readNormalized(patch26EventsPath);
const migration020 = readNormalized(migration020Path);

// 2. Validação da Migração 020
test('Migração 020 amplia txid para VARCHAR(128)', migration020.includes('ALTER TABLE billing_invoices ALTER COLUMN txid TYPE VARCHAR(128)'));
test('Migração 020 adiciona gateway e webhook_payload', migration020.includes('gateway VARCHAR(32)') && migration020.includes('webhook_payload JSONB'));
test('Migração 020 cria índice por txid e status', migration020.includes('idx_billing_invoices_txid_status'));

// 3. Teste Unitário de Autenticação do Webhook
process.env.PIX_WEBHOOK_SECRET = 'segredo_teste_finobra_pix_123';
process.env.ASAAS_WEBHOOK_TOKEN = 'asaas_token_teste_456';

const reqValidHeader = { headers: { 'x-webhook-secret': 'segredo_teste_finobra_pix_123' } };
const auth1 = isWebhookAuthorized(reqValidHeader);
test('isWebhookAuthorized aceita x-webhook-secret válido', auth1.authorized && auth1.source === 'x-webhook-secret');

const reqValidAsaas = { headers: { 'asaas-access-token': 'asaas_token_teste_456' } };
const auth2 = isWebhookAuthorized(reqValidAsaas);
test('isWebhookAuthorized aceita asaas-access-token válido', auth2.authorized && auth2.source === 'asaas-access-token');

const reqValidBearer = { headers: { authorization: 'Bearer segredo_teste_finobra_pix_123' } };
const auth3 = isWebhookAuthorized(reqValidBearer);
test('isWebhookAuthorized aceita Authorization: Bearer <secret>', auth3.authorized && auth3.source === 'bearer-secret');

const reqInvalid = { headers: { 'x-webhook-secret': 'token_errado' } };
const authInvalid = isWebhookAuthorized(reqInvalid);
test('isWebhookAuthorized rejeita credencial incorreta', !authInvalid.authorized);

// 4. Teste Unitário do Normalizador de Payloads
// A. Asaas
const asaasPayload = {
  event: 'PAYMENT_RECEIVED',
  payment: {
    id: 'pay_99887766',
    externalReference: 'construtora_alfa:inv_001',
    value: 279.90,
    pixTransaction: { txid: 'E1234567890123456789012' }
  }
};
const parsedAsaas = parseWebhookPayload(asaasPayload);
test('parseWebhookPayload normaliza evento Asaas recebido', (
  parsedAsaas.gateway === 'asaas' &&
  parsedAsaas.tenantId === 'construtora_alfa' &&
  parsedAsaas.invoiceId === 'inv_001' &&
  parsedAsaas.amountCents === 27990 &&
  parsedAsaas.txid === 'E1234567890123456789012'
));

const asaasIgnorePayload = {
  event: 'PAYMENT_CREATED',
  payment: { id: 'pay_0000' }
};
const parsedAsaasIgnore = parseWebhookPayload(asaasIgnorePayload);
test('parseWebhookPayload ignora eventos não liquidatórios do Asaas', parsedAsaasIgnore.ignore === true);

// B. Efí / Gerencianet
const efiPayload = {
  pix: [
    {
      txid: 'txid_efi_bacen_999',
      valor: '159.50',
      horario: '2026-09-14T10:00:00Z'
    }
  ],
  tenantId: 'construtora_beta'
};
const parsedEfi = parseWebhookPayload(efiPayload);
test('parseWebhookPayload normaliza payload Efí/BACEN', (
  parsedEfi.gateway === 'efi_pix' &&
  parsedEfi.tenantId === 'construtora_beta' &&
  parsedEfi.txid === 'txid_efi_bacen_999' &&
  parsedEfi.amountCents === 15950
));

// C. Direto / Simulação FinObra
const directPayload = {
  invoiceId: 'inv_master_123',
  tenantId: 'tenant_demo',
  amount_cents: 49990,
  txid: 'pix_manual_test_1',
  simulated: true
};
const parsedDirect = parseWebhookPayload(directPayload);
test('parseWebhookPayload normaliza payload direto/simulado', (
  parsedDirect.invoiceId === 'inv_master_123' &&
  parsedDirect.tenantId === 'tenant_demo' &&
  parsedDirect.amountCents === 49990 &&
  parsedDirect.simulated === true
));

// 5. Testes de Código Core e Idempotência
test('settlePixPayment possui checagem de idempotência para fatura já paga', (
  coreCode.includes("invoice.status === 'paid'") &&
  coreCode.includes('already_processed: true')
));

test('settlePixPayment executa renovação atômica em billing_invoices e tenants', (
  coreCode.includes("UPDATE billing_invoices") &&
  coreCode.includes("UPDATE tenants t") &&
  coreCode.includes("JOIN tenants t ON t.id = bi.tenant_id") &&
  coreCode.includes("FOR UPDATE OF bi, t") &&
  coreCode.includes("vencimento =")
));

test('settlePixPayment reconcilia PIX em trânsito sem bloquear reativação posterior', (
  coreCode.includes('WITH candidate AS') &&
  coreCode.includes('FOR UPDATE') &&
  coreCode.includes("status IN ('pending', 'expired', 'canceled')") &&
  coreCode.includes('candidate.prior_status') &&
  coreCode.includes("t.status = 'cancelamento_agendado' AND paid.prior_status = 'canceled'")
));

test('sendPaymentReceipt dispara comprovante via WhatsApp e E-mail', (
  coreCode.includes('/send-message') &&
  coreCode.includes('https://api.resend.com/emails') &&
  coreCode.includes('Pagamento PIX Confirmado') &&
  coreCode.includes("results.email.via = 'trigger_dev';\n          return results;")
));

// 6. Arquitetura Serverless e Rewrites Vercel (Hobby <= 12 functions)
test('Vercel não excede 12 Serverless Functions no plano Hobby', (
  fs.readdirSync('api').filter(f => f.endsWith('.js') && !f.startsWith('_')).length <= 12
));

test('vercel.json mapeia /api/webhook-pix para /api/plano?sub=webhook_pix', (
  vercelJson.includes('"source": "/api/webhook-pix"') &&
  vercelJson.includes('"destination": "/api/plano?sub=webhook_pix"')
));

test('api/plano.js despacha requisições de webhook PIX para _webhook_pix.js', (
  planoCode.includes("import webhookPixHandler from './_webhook_pix.js'") &&
  planoCode.includes('webhookPixHandler(req, res)')
));

// 7. Testes do Sub-Handler api/_webhook_pix.js
test('api/_webhook_pix.js implementa CORS flexível e tratamento de OPTIONS', (
  subHandlerCode.includes("Access-Control-Allow-Origin', '*'") &&
  subHandlerCode.includes("req.method === 'OPTIONS'")
));

test('api/_webhook_pix.js rejeita métodos não POST com HTTP 405', subHandlerCode.includes("req.method !== 'POST'") && subHandlerCode.includes('405'));
test('api/_webhook_pix.js valida autenticação via isWebhookAuthorized ou sessão Super Admin', subHandlerCode.includes('isWebhookAuthorized(req)') && subHandlerCode.includes('superadmin'));
test('api/_webhook_pix.js chama settlePixPayment e sendPaymentReceipt', subHandlerCode.includes('settlePixPayment(sql, payload') && subHandlerCode.includes('sendPaymentReceipt(data)'));
test('api/_webhook_pix.js registra evento em audit_logs', subHandlerCode.includes('writeAudit(sql, req'));

test('api/admin.js suporta action simulate_webhook_pix', (
  adminCode.includes("action === 'simulate_webhook_pix'") ||
  (adminCode.includes('originalAdminHandler') && adminRouteCode.includes("action === 'simulate_webhook_pix'"))
));
test('master.html possui botão Simular Webhook PIX no cabeçalho', masterHtml.includes('MasterAdmin.abrirSimuladorWebhookPix'));
test('js/master.js implementa simularWebhookPix e abrirSimuladorWebhookPix', (
  masterJs.includes('async simularWebhookPix(') &&
  masterJs.includes('async abrirSimuladorWebhookPix(')
));
test('js/master.js renderiza botão ⚡ Webhook na listagem de cobranças pendentes', masterJs.includes('MasterAdmin.simularWebhookPix'));
test('js/patch26-events.js autoriza métodos do Webhook PIX na allowlist CSP', (
  patch26Events.includes('"MasterAdmin.abrirSimuladorWebhookPix"') &&
  patch26Events.includes('"MasterAdmin.simularWebhookPix"')
));

console.log(`\n📊 Resultado dos Testes Estáticos PATCH 44: ${passedTests}/${totalTests} testes aprovados.`);

if (passedTests !== totalTests) {
  process.exit(1);
}
