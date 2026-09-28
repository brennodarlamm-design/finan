// scripts/test-admin-email-api.js — Validação direta dos endpoints do Admin Route de E-mails
import assert from 'assert';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...v] = trimmed.split('=');
      const val = v.join('=').trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k.trim()]) {
        process.env[k.trim()] = val;
      }
    }
  }
}
loadEnv();

console.log('🧪 Testando rotas de API da Central de E-mails no backend...');

const { default: adminRouteHandler } = await import('../api/_admin-route.js');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end(data) { if (data) this.body = data; return this; }
  };
}

process.env.INTERNAL_API_SECRET ||= 'test-internal-secret-for-api-test-123456';
const authHeaders = {
  authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
  'x-tenant-id': 'master'
};

// 1. Testar action=email_logs
const reqLogs = {
  method: 'GET',
  query: { action: 'email_logs', limit: 20 },
  headers: { ...authHeaders }
};
const resLogs = createMockRes();
await adminRouteHandler(reqLogs, resLogs);

assert.strictEqual(resLogs.statusCode, 200, 'Status deve ser 200');
assert.ok(resLogs.body?.success, 'Deve retornar success: true');
assert.ok(Array.isArray(resLogs.body?.emails), 'Deve retornar array de e-mails');
assert.ok(resLogs.body.emails.length >= 6, 'Deve conter pelo menos as 6 mensagens semeadas');
assert.ok(resLogs.body?.stats, 'Deve retornar estatísticas agregadas');
assert.ok(resLogs.body.stats.total >= 6, 'Total de e-mails deve ser >= 6');
console.log('✅ 1. GET ?action=email_logs retornou', resLogs.body.emails.length, 'e-mails e stats:', resLogs.body.stats);

// 2. Testar action=email_detail
const firstEmail = resLogs.body.emails[0];
const reqDetail = {
  method: 'GET',
  query: { action: 'email_detail', id: firstEmail.id },
  headers: { ...authHeaders }
};
const resDetail = createMockRes();
await adminRouteHandler(reqDetail, resDetail);

assert.strictEqual(resDetail.statusCode, 200);
assert.ok(resDetail.body?.success);
assert.strictEqual(resDetail.body.email.id, firstEmail.id);
assert.ok(Array.isArray(resDetail.body.thread), 'Deve retornar thread de respostas');
console.log('✅ 2. GET ?action=email_detail retornou detalhes do e-mail:', firstEmail.subject);

// 3. Testar action=email_mark_read
const reqRead = {
  method: 'POST',
  query: { action: 'email_mark_read' },
  body: { id: firstEmail.id, is_read: true },
  headers: { ...authHeaders }
};
const resRead = createMockRes();
await adminRouteHandler(reqRead, resRead);

assert.strictEqual(resRead.statusCode, 200);
assert.ok(resRead.body?.success);
console.log('✅ 3. POST ?action=email_mark_read marcou mensagem como lida com sucesso');

// 4. Testar action=email_simulate_inbound
const reqSim = {
  method: 'POST',
  query: { action: 'email_simulate_inbound' },
  body: {
    from: 'teste.direto@construtora-teste.com',
    to: 'contato@fingo.api.br',
    subject: 'Simulação automatizada de proposta de canteiro',
    text: 'Esta é uma mensagem de teste enviada pela suíte automatizada.'
  },
  headers: { ...authHeaders }
};
const resSim = createMockRes();
await adminRouteHandler(reqSim, resSim);

assert.strictEqual(resSim.statusCode, 200);
assert.ok(resSim.body?.success);
assert.strictEqual(resSim.body.email.channel, 'contato@fingo.api.br');
assert.strictEqual(resSim.body.email.direction, 'inbound');
assert.strictEqual(resSim.body.email.is_read, false);
console.log('✅ 4. POST ?action=email_simulate_inbound criou e-mail inbound simulado ID:', resSim.body.email.id);

console.log('🎉 Todos os 4 fluxos de API do painel Master validados com sucesso!');
