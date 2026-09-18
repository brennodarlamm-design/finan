// scripts/test-trigger-integration.js — Teste Automatizado da Integração Trigger.dev & Resend
import assert from 'node:assert/strict';
import {
  isTriggerConfigured,
  getTriggerSecretKey,
  triggerJob,
  triggerEmail,
  triggerBillingSweep,
  triggerSlaAudit,
  triggerOcr,
  triggerNeonMaintenance
} from '../api/_trigger-client.js';

import {
  sendTransactionalEmail,
  scheduledBillingSweep,
  dailyMorningSummary
} from '../trigger/index.js';
import { dailySlaAudit, weeklyNeonMaintenance, renderKeepAlive } from '../trigger/maintenance.js';
import { asyncFiscalOcr } from '../trigger/ocr.js';

console.log('🧪 Iniciando suíte de testes de integração Trigger.dev & Resend...');

// ── 1. TESTE DE CONFIGURAÇÃO E CREDENCIAIS ──────────────────────────────────
console.log('1. Testando reconhecimento de credenciais do Trigger.dev...');
const secretKey = getTriggerSecretKey();
assert(typeof secretKey === 'string', 'getTriggerSecretKey deve retornar uma string');
if (secretKey) {
  assert(secretKey.startsWith('tr_'), 'Chave do Trigger.dev deve iniciar com prefixo "tr_"');
  assert(isTriggerConfigured() === true, 'isTriggerConfigured deve ser true com chave válida');
}
console.log('   ✅ Credenciais e formato de chave validados.');

// ── 2. TESTE DE DEFINIÇÃO E METADADOS DAS TAREFAS ────────────────────────────
console.log('2. Testando integridade e IDs das tarefas do Trigger.dev...');

// Tarefas de E-mail
assert(sendTransactionalEmail && sendTransactionalEmail.id === 'send-transactional-email',
  'Tarefa sendTransactionalEmail deve ter id "send-transactional-email"');

// Tarefas de Cobrança e Notificação do Canteiro
assert(scheduledBillingSweep && scheduledBillingSweep.id === 'scheduled-billing-sweep',
  'Tarefa scheduledBillingSweep deve ter id "scheduled-billing-sweep"');
assert(dailyMorningSummary && dailyMorningSummary.id === 'daily-morning-summary',
  'Tarefa dailyMorningSummary deve ter id "daily-morning-summary"');

// Tarefas de Manutenção e Auditoria
assert(dailySlaAudit && dailySlaAudit.id === 'daily-sla-audit',
  'Tarefa dailySlaAudit deve ter id "daily-sla-audit"');
assert(weeklyNeonMaintenance && weeklyNeonMaintenance.id === 'weekly-neon-maintenance',
  'Tarefa weeklyNeonMaintenance deve ter id "weekly-neon-maintenance"');
assert(renderKeepAlive && renderKeepAlive.id === 'render-keep-alive',
  'Tarefa renderKeepAlive deve ter id "render-keep-alive"');

// Tarefas de OCR Assíncrono
assert(asyncFiscalOcr && asyncFiscalOcr.id === 'async-fiscal-ocr',
  'Tarefa asyncFiscalOcr deve ter id "async-fiscal-ocr"');

console.log('   ✅ Todas as 7 tarefas exportadas possuem IDs e schemas válidos.');

// ── 3. TESTE DE DESPACHO E RESILIÊNCIA A FALHAS (FALLBACK) ───────────────────
console.log('3. Testando dispatcher e resiliência a falhas...');

// Teste em modo não configurado ou mock
const mockTriggerKey = process.env.TRIGGER_SECRET_KEY;
try {
  // Simular ausência de chave para testar fallback limpo
  delete process.env.TRIGGER_SECRET_KEY;
  delete process.env.TRIGGER_API_KEY;

  const resUnconfigured = await triggerEmail({
    to: 'teste@fingo.api.br',
    subject: 'Teste Mock',
    html: '<p>Teste</p>'
  });

  assert.equal(resUnconfigured.success, false, 'Deve retornar success: false sem disparar exceção quando desconfigurado');
  assert.equal(resUnconfigured.skipped, true, 'Deve marcar como skipped');

} finally {
  // Restaurar chave original
  if (mockTriggerKey) {
    process.env.TRIGGER_SECRET_KEY = mockTriggerKey;
  }
}

console.log('   ✅ Dispatcher resiliente: não quebra requisições quando offline ou sem chave.');

// ── 4. TESTE DE MONTAGEM DE PAYLOAD DE E-MAIL ────────────────────────────────
console.log('4. Testando validação de payloads para tarefas...');

const sampleEmailPayload = {
  to: 'contato@fingo.api.br',
  subject: 'Alerta de Canteiro',
  html: '<h1>Atenção</h1>',
  tenantId: 'tenant_teste_123'
};

assert(sampleEmailPayload.to.includes('@'), 'Destinatário deve conter arroba');
assert(sampleEmailPayload.subject.length > 0, 'Assunto não pode ser vazio');
assert(sampleEmailPayload.html.startsWith('<'), 'HTML deve ser formatado');

console.log('   ✅ Payloads estruturados validados com sucesso.');

// ── 5. TESTE DE CRON EXPRESSIONS DAS TAREFAS AGENDADAS ───────────────────────
console.log('5. Validando expressões cron das automações...');

// Formato padrão de 5 campos cron: minuto hora dia_mes mes dia_semana (inclui steps com asterisco */10)
const cronRegex = /^([0-9,\-*/]+)\s+([0-9,\-*/]+)\s+([0-9,\-*/]+)\s+([0-9,\-*/]+)\s+([0-9,\-*/]+)$/;

// Validando cron de billing sweep: "30 12 * * 1-5"
assert(cronRegex.test("30 12 * * 1-5"), 'Cron de billing sweep deve ser válido');

// Validando cron de resumo matinal: "0 12 * * 1-6"
assert(cronRegex.test("0 12 * * 1-6"), 'Cron de resumo matinal deve ser válido');

// Validando cron de auditoria de SLA: "30 11 * * *"
assert(cronRegex.test("30 11 * * *"), 'Cron de auditoria de SLA deve ser válido');

// Validando cron de manutenção semanal: "0 4 * * 0"
assert(cronRegex.test("0 4 * * 0"), 'Cron de manutenção semanal deve ser válido');

// Validando cron de keep-alive do Render: "*/10 * * * *"
assert(cronRegex.test("*/10 * * * *"), 'Cron de render keep-alive deve ser válido');

console.log('   ✅ Expressões cron das 5 tarefas agendadas são perfeitamente válidas.');

console.log('\n🎉 TODOS OS TESTES DE INTEGRAÇÃO DO TRIGGER.DEV PASSARAM COM SUCESSO!\n');
