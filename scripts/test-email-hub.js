// scripts/test-email-hub.js — Testes de Conformidade do Painel e Central de E-mails FinGo
import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 Iniciando testes de conformidade da Central de E-mails FinGo...');

// 1. Validar Migration 037 (SQL DDL, Índices e Schema Version)
const migPath = path.resolve('migrations/037_email_hub_central.sql');
assert.ok(fs.existsSync(migPath), 'Arquivo migrations/037_email_hub_central.sql deve existir');
const migSql = fs.readFileSync(migPath, 'utf8');

assert.ok(migSql.includes('CREATE TABLE IF NOT EXISTS email_messages'), 'Migration 037 deve criar a tabela email_messages');
assert.ok(migSql.includes("channel VARCHAR(100) NOT NULL DEFAULT 'contato@fingo.api.br'"), 'Canal padrão deve ser contato@fingo.api.br');
assert.ok(migSql.includes("reply_to VARCHAR(255) DEFAULT 'contato@fingo.api.br'"), 'reply_to padrão deve ser contato@fingo.api.br');
assert.ok(migSql.includes('direction VARCHAR(10) NOT NULL'), 'Coluna direction obrigatória');
assert.ok(migSql.includes('is_read BOOLEAN NOT NULL DEFAULT FALSE'), 'Coluna is_read obrigatória');
assert.ok(migSql.includes('idx_email_messages_unread'), 'Índice de mensagens não lidas deve existir');
assert.ok(migSql.includes('idx_email_messages_channel'), 'Índice de canais deve existir');
assert.ok(migSql.includes("037_email_hub_central.sql"), 'Deve registrar 037_email_hub_central.sql em schema_migrations');
console.log('✅ [1/5] Migration 037 e DDL do PostgreSQL validados');

// 2. Validar Serviço de E-mails (Canais, Mapeamento e Parsing)
const emailServiceModule = await import('../api/_email_service.js');
const { EMAIL_CHANNELS, resolveEmailChannel, matchChannelByAddress, parseInboundEmailPayload } = emailServiceModule;

assert.ok(EMAIL_CHANNELS, 'EMAIL_CHANNELS deve ser exportado');
assert.strictEqual(EMAIL_CHANNELS.CONTATO.address, 'contato@fingo.api.br', 'Canal principal deve ser contato@fingo.api.br');
assert.strictEqual(EMAIL_CHANNELS.SUPORTE.address, 'suporte@fingo.api.br', 'Canal de suporte deve ser suporte@fingo.api.br');
assert.strictEqual(EMAIL_CHANNELS.COMERCIAL.address, 'comercial@fingo.api.br', 'Canal comercial deve ser comercial@fingo.api.br');
assert.strictEqual(EMAIL_CHANNELS.NOVIDADES.address, 'novidades@fingo.api.br', 'Canal novidades deve ser novidades@fingo.api.br');
assert.strictEqual(EMAIL_CHANNELS.NO_REPLY.address, 'no-reply@fingo.api.br', 'Canal no-reply deve ser no-reply@fingo.api.br');

// Teste de resolução de canais
assert.strictEqual(resolveEmailChannel('SUPORTE').address, 'suporte@fingo.api.br');
assert.strictEqual(resolveEmailChannel('COMERCIAL').address, 'comercial@fingo.api.br');
assert.strictEqual(resolveEmailChannel('DESCONHECIDO').address, 'contato@fingo.api.br', 'Canal inválido deve reverter para contato@');
assert.strictEqual(resolveEmailChannel(null).address, 'contato@fingo.api.br', 'Canal nulo deve reverter para contato@');

// Teste de matching por endereço
assert.strictEqual(matchChannelByAddress('suporte@fingo.api.br').key, 'SUPORTE');
assert.strictEqual(matchChannelByAddress('FinGo Suporte <suporte@fingo.api.br>').key, 'SUPORTE');
assert.strictEqual(matchChannelByAddress('comercial@fingo.api.br').key, 'COMERCIAL');
assert.strictEqual(matchChannelByAddress('cobranca@fingo.api.br').key, 'COMERCIAL');
assert.strictEqual(matchChannelByAddress('novidades@fingo.api.br').key, 'NOVIDADES');
assert.strictEqual(matchChannelByAddress('newsletter@fingo.api.br').key, 'NOVIDADES');
assert.strictEqual(matchChannelByAddress('no-reply@fingo.api.br').key, 'NO_REPLY');
assert.strictEqual(matchChannelByAddress('nao-responder@fingo.api.br').key, 'NO_REPLY');
assert.strictEqual(matchChannelByAddress('outro@externo.com').key, 'CONTATO', 'Endereço externo desconhecido reverte para contato@');

// Teste de Parsing de Webhook Inbound
const mockPayloadDirect = {
  from: 'cliente@construtora.com.br',
  to: 'contato@fingo.api.br',
  subject: 'Dúvida sobre orçamento de obra',
  text: 'Olá, gostaria de entender a importação SINAPI.',
  html: '<p>Olá, gostaria de entender a importação SINAPI.</p>',
  message_id: 'msg-test-123'
};
const parsedDirect = parseInboundEmailPayload(mockPayloadDirect);
assert.strictEqual(parsedDirect.sender, 'cliente@construtora.com.br');
assert.strictEqual(parsedDirect.recipient, 'contato@fingo.api.br');
assert.strictEqual(parsedDirect.channel, 'contato@fingo.api.br');
assert.strictEqual(parsedDirect.subject, 'Dúvida sobre orçamento de obra');

// Teste Resend Inbound Wrap
const mockResendWrapped = {
  type: 'email.received',
  data: {
    from: 'engenheiro@obra.com',
    to: ['suporte@fingo.api.br'],
    subject: 'Chamado FinBot erro de login',
    text: 'FinBot não reconheceu meu CPF.',
    headers: { 'message-id': '<header-id-999>' }
  }
};
const parsedResend = parseInboundEmailPayload(mockResendWrapped);
assert.strictEqual(parsedResend.sender, 'engenheiro@obra.com');
assert.strictEqual(parsedResend.recipient, 'suporte@fingo.api.br');
assert.strictEqual(parsedResend.channel, 'suporte@fingo.api.br');
assert.strictEqual(parsedResend.messageId, '<header-id-999>');
console.log('✅ [2/5] api/_email_service.js (canais, roteamento e parser) validado');

// 3. Validar Rotas de API e Webhook
const adminRouteCode = fs.readFileSync(path.resolve('api/_admin-route.js'), 'utf8');
assert.ok(adminRouteCode.includes("action === 'email_logs'"), 'Admin route deve conter action email_logs');
assert.ok(adminRouteCode.includes("action === 'email_detail'"), 'Admin route deve conter action email_detail');
assert.ok(adminRouteCode.includes("action === 'email_mark_read'"), 'Admin route deve conter action email_mark_read');
assert.ok(adminRouteCode.includes("action === 'email_send'"), 'Admin route deve conter action email_send');
assert.ok(adminRouteCode.includes("action === 'email_simulate_inbound'"), 'Admin route deve conter action email_simulate_inbound');

const webhookCode = fs.readFileSync(path.resolve('api/_webhook_email.js'), 'utf8');
assert.ok(webhookCode.includes('handleInboundEmailWebhook'), 'Webhook de e-mail deve exportar handleInboundEmailWebhook');
assert.ok(webhookCode.includes('EMAIL_WEBHOOK_SECRET'), 'Webhook deve verificar segurança EMAIL_WEBHOOK_SECRET');

const v2RoutesCode = fs.readFileSync(path.resolve('api/_v2-routes.js'), 'utf8');
assert.ok(v2RoutesCode.includes('/api/v2/webhooks/email-inbound'), 'Rotas V2 devem documentar webhook de e-mail');

const serverCode = fs.readFileSync(path.resolve('backend/server.js'), 'utf8');
assert.ok(serverCode.includes("'/api/webhook-email'"), 'Servidor de desenvolvimento local deve rotear webhook-email');
console.log('✅ [3/5] Rotas do backend, segurança do webhook e dispatch validados');

// 4. Validar CSP e Event Delegation em patch26-events.js
const p26Code = fs.readFileSync(path.resolve('js/patch26-events.js'), 'utf8');
const p26ModCode = fs.readFileSync(path.resolve('frontend/core/patch26-events.js'), 'utf8');
const requiredEvents = [
  'MasterAdmin.abrirEmailModal',
  'MasterAdmin.abrirModalNovoEmail',
  'MasterAdmin.enviarEmailSubmit',
  'MasterAdmin.fecharEmailModal',
  'MasterAdmin.fecharModalNovoEmail',
  'MasterAdmin.filtrarEmailsCanal',
  'MasterAdmin.filtrarEmailsDirecao',
  'MasterAdmin.recarregarEmails',
  'MasterAdmin.simularEmailInboundTeste'
];

for (const evt of requiredEvents) {
  assert.ok(p26Code.includes(`"${evt}"`) || p26Code.includes(`'${evt}'`), `js/patch26-events.js deve autorizar '${evt}'`);
  assert.ok(p26ModCode.includes(`"${evt}"`) || p26ModCode.includes(`'${evt}'`), `frontend/core/patch26-events.js deve autorizar '${evt}'`);
}
console.log('✅ [4/5] CSP e Event Delegation (patch26-events.js) validados');

// 5. Validar Interface do Painel Master (HTML e JS)
const masterHtml = fs.readFileSync(path.resolve('master.html'), 'utf8');
assert.ok(masterHtml.includes('data-fb-click-v0="emails"'), 'master.html deve ter botão de navegação para e-mails');
assert.ok(masterHtml.includes('id="master-email-badge-header"'), 'master.html deve ter badge de e-mails não lidos no header');
assert.ok(masterHtml.includes('id="master-email-view-modal"'), 'master.html deve ter modal de visualização de e-mails');
assert.ok(masterHtml.includes('id="master-email-compose-modal"'), 'master.html deve ter modal de composição de e-mails');
assert.ok(masterHtml.includes('contato@fingo.api.br'), 'master.html deve conter canal contato@fingo.api.br');
assert.ok(masterHtml.includes('suporte@fingo.api.br'), 'master.html deve conter canal suporte@fingo.api.br');
assert.ok(masterHtml.includes('comercial@fingo.api.br'), 'master.html deve conter canal comercial@fingo.api.br');

const masterJs = fs.readFileSync(path.resolve('js/master.js'), 'utf8');
assert.ok(masterJs.includes('carregarEmails()'), 'master.js deve ter carregarEmails');
assert.ok(masterJs.includes('_renderEmails()'), 'master.js deve ter _renderEmails');
assert.ok(masterJs.includes('simularEmailInboundTeste()'), 'master.js deve ter simularEmailInboundTeste');
assert.ok(!masterJs.match(/await\s+fetch\(\s*['"]\/api/i), 'master.js NÃO deve usar raw fetch para /api (deve usar _fetchWithTimeout)');

console.log('✅ [5/5] Interface do Painel Master e Invariantes de Hardening validados');
console.log('🎉 Todos os testes de conformidade da Central de E-mails FinGo passaram com 100% de sucesso!');
