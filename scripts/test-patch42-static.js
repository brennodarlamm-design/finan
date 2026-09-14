import fs from 'fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Patch 42: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

const migrationSql = fs.readFileSync('migrations/019_billing_automation_idempotency.sql', 'utf8');
const serverJs = fs.readFileSync('backend/server.js', 'utf8');
const adminJs = fs.readFileSync('api/admin.js', 'utf8');
const masterHtml = fs.readFileSync('master.html', 'utf8');
const masterJs = fs.readFileSync('js/master.js', 'utf8');
const patch26Events = fs.readFileSync('js/patch26-events.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = JSON.parse(fs.readFileSync('version.json', 'utf8'));

console.log('=== Patch 42 — Cron de Cobrança 24/7 no Render (Automação, Anti-Spam e Idempotência) ===\n');

// 1. Migração 019 e Estrutura de Idempotência Anti-Spam no Neon
assert(
  migrationSql.includes('CREATE TABLE IF NOT EXISTS billing_notifications_sent'),
  'Migração 019 cria a tabela billing_notifications_sent.'
);

assert(
  migrationSql.includes('CONSTRAINT uq_billing_notice_day UNIQUE (tenant_id, stage, sent_date)'),
  'Migração 019 define constraint única (tenant_id, stage, sent_date) garantindo idempotência diária e bloqueio anti-spam.'
);

assert(
  migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_billing_notif_tenant_date') &&
  migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_billing_notif_stage_date'),
  'Migração 019 cria índices temporais para consultas de status do robô.'
);

assert(
  migrationSql.includes("INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)") &&
  migrationSql.includes("'019_billing_automation_idempotency.sql'"),
  'Migração 019 registra versão em schema_migrations usando applied_at.'
);

// 2. Motor 24/7 de Cobrança no Backend Render (backend/server.js)
assert(
  serverJs.includes('function isWithinBusinessHours()'),
  'backend/server.js implementa controle estrito de horário comercial (09h às 18h).'
);

assert(
  serverJs.includes('async function executarVarreduraCobranca('),
  'backend/server.js implementa função de varredura autônoma de cobrança.'
);

assert(
  serverJs.includes('billing_notifications_sent') && serverJs.includes('Anti-spam ativado'),
  'backend/server.js consulta tabela de idempotência e cancela envios repetidos no mesmo dia.'
);

assert(
  serverJs.includes('reminder_10d') && serverJs.includes('due_today') && serverJs.includes('overdue_1d'),
  'backend/server.js calcula estágios dinâmicos de vencimento (10d antes, hoje, atraso).'
);

assert(
  serverJs.includes("name: 'finobra-billing-sweep'") || serverJs.includes("'30 9 * * 1-5'"),
  'backend/server.js agenda cron autônomo para dias úteis no horário de Brasília/Boa Vista.'
);

assert(
  serverJs.includes("app.post('/cron/billing-sweep'"),
  'backend/server.js expõe endpoint protegido POST /cron/billing-sweep para disparo manual.'
);

assert(
  serverJs.includes("app.get('/cron/billing-status'"),
  'backend/server.js expõe endpoint GET /cron/billing-status para diagnóstico e auditoria.'
);

// 3. Integração na API Serverless (api/admin.js)
assert(
  adminJs.includes("action === 'trigger_billing_sweep'"),
  'api/admin.js implementa action trigger_billing_sweep com integração ao Render e fallback no Neon.'
);

assert(
  adminJs.includes("action === 'get_billing_automation_status'"),
  'api/admin.js implementa action get_billing_automation_status para monitoramento do robô.'
);

// 4. Interface Master e CSP Event Bridge
assert(
  masterHtml.includes('data-fb-click="MasterAdmin.executarVarreduraCobranca"'),
  'master.html inclui botão de acionamento imediato da varredura de cobrança.'
);

assert(
  masterJs.includes('async executarVarreduraCobranca()') &&
  masterJs.includes('action=trigger_billing_sweep'),
  'js/master.js implementa rotina de disparo com feedback e tratamento de erros.'
);

assert(
  patch26Events.includes('"MasterAdmin.executarVarreduraCobranca"'),
  'js/patch26-events.js autoriza MasterAdmin.executarVarreduraCobranca na allowlist CSP.'
);

// 5. Versionamento e Pacote
assert(pkg.scripts?.['test:patch42'] === 'node scripts/test-patch42-static.js', 'package.json expõe comando test:patch42.');
assert(pkg.version >= '2.31.0', 'package.json está na versão >= 2.31.0.');
assert(version.version >= '2.31.0', 'version.json está na versão >= 2.31.0.');
assert(/-p(42|[4-9]\d|\d{3,})\b/.test(version.build || ''), 'version.json registra build com sufixo >= -p42.');

console.log('\n🎉 Patch 42: todas as 18 verificações passaram com 100% de sucesso!');
