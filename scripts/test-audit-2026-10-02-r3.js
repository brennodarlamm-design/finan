// scripts/test-audit-2026-10-02-r3.js
// Regressões da terceira rodada da auditoria de 02/10/2026 (T1–T9).
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('=== Auditoria 2026-10-02 (3ª rodada) — regressões ===\n');

// T1 — Reset de senha: a tentativa é reservada atomicamente antes de verificar o OTP.
{
  const src = read('api/auth.js');
  const block = src.slice(src.indexOf("action === 'verify_reset'"), src.indexOf('const newHash = await hashPassword(normalizedNewPassword);'));
  const reserveIdx = block.indexOf('SET tentativas = tentativas + 1');
  const verifyIdx = block.indexOf('verifyPassword(');
  assert(reserveIdx > 0 && verifyIdx > reserveIdx, 'T1: incremento atômico deve ocorrer antes da verificação do código');
  assert(block.includes('AND tentativas < COALESCE(max_tentativas, 5)'), 'T1: reserva deve respeitar max_tentativas no WHERE');
  assert(!block.includes('SELECT id, usuario_id, codigo_hash, tentativas, max_tentativas'), 'T1: leitura não atômica removida');
  console.log('  ✓ T1 verify_reset reserva a tentativa antes de verificar o código');
}

// T2 — MFA: limite por conta além do limite por IP (login direto e mfa_verify).
{
  const src = read('api/auth.js');
  assert(src.includes('async function mfaAccountLimited(userId)'), 'T2: helper de limite por conta');
  assert(src.includes('`mfa-user:'), 'T2: chave não pode começar com "mfa:" (seria tratada como IP pelo Fail2Ban)');
  assert.strictEqual(src.split('await mfaAccountLimited(').length - 1, 2, 'T2: limite aplicado no login e no mfa_verify');
  console.log('  ✓ T2 tentativas de MFA limitadas por conta');
}

// T3 — WhatsApp: ação de teste com limite de envio.
{
  const src = read('api/whatsapp.js');
  const block = src.slice(src.indexOf("if (action === 'test')"), src.indexOf("if (action === 'send')"));
  assert(block.indexOf('checkRateLimit(`wa_send:') > 0 && block.indexOf('checkRateLimit(`wa_send:') < block.indexOf('const destPhone'), 'T3: teste deve consumir o limite de envios');
  console.log('  ✓ T3 action=test do WhatsApp respeita o limite de envios');
}

// T4 — Upload v2 com lista fechada de tipos e assinatura binária.
{
  const { validateEdgeUpload } = await import('../api/_v2-routes.js');
  const pdf = Buffer.from('%PDF-1.7\n...');
  assert.deepStrictEqual(validateEdgeUpload('nota.pdf', pdf), { ok: true, contentType: 'application/pdf' }, 'T4: PDF válido');
  assert.strictEqual(validateEdgeUpload('x.html', Buffer.from('<html>')).ok, false, 'T4: HTML rejeitado');
  assert.strictEqual(validateEdgeUpload('x.svg', Buffer.from('<svg/>')).ok, false, 'T4: SVG rejeitado');
  assert.strictEqual(validateEdgeUpload('x.exe', Buffer.from('MZ')).ok, false, 'T4: executável rejeitado');
  assert.strictEqual(validateEdgeUpload('falso.pdf', Buffer.from('<html><script>')).ok, false, 'T4: extensão sem assinatura correspondente');
  assert.strictEqual(validateEdgeUpload('a.txt', Buffer.from('<script>alert(1)</script>')).ok, false, 'T4: texto com marcação ativa');
  assert.strictEqual(validateEdgeUpload('a.csv', Buffer.from('a;b\n1;2')).ok, true, 'T4: CSV simples aceito');
  const src = read('api/_v2-routes.js');
  const fn = src.slice(src.indexOf('export async function handleV2EdgeStorageUpload'), src.indexOf('export async function handleV2EdgeStorageGet'));
  assert(!fn.includes('body.contentType'), 'T4: Content-Type não pode vir do cliente');
  console.log('  ✓ T4 /api/v2/edge/storage/upload valida extensão, assinatura e Content-Type');
}

// T5/T6 — DF-e/NF-e: `force` só para superadmin, UF validada e limite no MeuDanfe.
{
  const src = read('api/nfe.js');
  assert(src.includes('force: canForce && req.body?.force === true'), 'T5: force restrito');
  assert(src.includes("auth.isSystem || auth.user?.perfil === 'superadmin'"), 'T5: canForce só para superadmin/sistema');
  assert(src.includes('/^\\d{2}$/.test(rawCodUf)'), 'T5: codUf validado');
  assert(src.includes('`meudanfe:tenant:${auth.tenantId}`'), 'T6: limite por empresa no MeuDanfe');
  console.log('  ✓ T5/T6 trava anti-flood da SEFAZ e créditos MeuDanfe protegidos');
}

// T7 — Segredos internos comparados em tempo constante.
{
  const { secretsEqual } = await import('../api/_auth.js');
  assert.strictEqual(secretsEqual('abc', 'abc'), true);
  assert.strictEqual(secretsEqual('abc', 'abd'), false);
  assert.strictEqual(secretsEqual('', ''), false, 'T7: vazio nunca autoriza');
  assert(read('api/_auth.js').includes('secretsEqual(rawToken, internalSecret)'), 'T7: _auth usa comparação constante');
  assert(!/incomingKey === (evoKey|internalSecret)/.test(read('api/whatsapp.js')), 'T7: webhook WhatsApp (Edge) sem ===');
  const server = read('backend/server.js');
  assert(!/=== secret\b/.test(server.slice(server.indexOf('function hasInternalApiAuth'), server.indexOf('function requireAuth'))), 'T7: hasInternalApiAuth sem ===');
  assert(!server.includes('incomingKey === evoKey'), 'T7: webhook WhatsApp (Render) sem ===');
  console.log('  ✓ T7 comparação de segredos em tempo constante');
}

// T8 — Telemetria anônima não dispara alerta crítico.
{
  assert(read('api/_audit-route.js').includes("severity: tenantId ? 'CRITICAL' : 'WARNING'"), 'T8: severidade depende de sessão');
  console.log('  ✓ T8 pico de erros anônimos gera apenas WARNING');
}

// T9 — Recibo PIX por e-mail escapa dados do cadastro.
{
  const saved = { fetch: globalThis.fetch, resend: process.env.RESEND_API_KEY, trig: process.env.TRIGGER_SECRET_KEY };
  process.env.RESEND_API_KEY = 're_test_placeholder';
  delete process.env.TRIGGER_SECRET_KEY;
  let sentHtml = '';
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('resend')) sentHtml = JSON.parse(init.body).html;
    return { ok: true, status: 200, json: async () => ({ id: 'email_1' }) };
  };
  try {
    const { sendPaymentReceipt } = await import('../api/_webhook_pix_core.js');
    await sendPaymentReceipt({
      email: 'cliente@example.com',
      telefone: '',
      responsavel: '<a href="https://evil.example">Clique</a>',
      nome_fantasia: '<img src=x>',
      plan_id: 'pro',
      cycle: 'monthly',
      amount_cents: 9900,
      txid: '"><script>',
      vencimento: '2026-11-01'
    });
  } finally {
    globalThis.fetch = saved.fetch;
    if (saved.resend === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = saved.resend;
    if (saved.trig !== undefined) process.env.TRIGGER_SECRET_KEY = saved.trig;
  }
  assert(sentHtml, 'T9: e-mail deveria ser montado');
  assert(!sentHtml.includes('<a href="https://evil.example">') && !sentHtml.includes('<img src=x>') && !sentHtml.includes('"><script>'), 'T9: HTML do cadastro deve ser escapado');
  assert(sentHtml.includes('&lt;img src=x&gt;'), 'T9: conteúdo preservado como texto');
  console.log('  ✓ T9 recibo PIX por e-mail escapa nome, responsável e TXID');
}

// T10 — Troca/reset de senha encerra todas as sessões: token sem sessionId (não revogável) é recusado.
{
  const { resolveAuthAndTenant, signToken } = await import('../api/_auth.js');
  const saved = { secret: process.env.SESSION_SIGNING_SECRET, owner: process.env.DATABASE_OWNER_URL };
  process.env.SESSION_SIGNING_SECRET = 'test-only-session-signing-secret-r3-0123456789';
  process.env.DATABASE_OWNER_URL = 'postgresql://[USER]:[PASS]@127.0.0.1:9/neondb';
  try {
    const legacy = signToken({ userId: 'usr_1', tenantId: 't1', exp: Date.now() + 60000 }, process.env.SESSION_SIGNING_SECRET);
    const auth = await resolveAuthAndTenant({ method: 'GET', headers: { authorization: `Bearer ${legacy}` } });
    assert.strictEqual(auth.authenticated, false, 'T10: token sem sessionId deve ser recusado');
    assert.strictEqual(auth.status, 401, 'T10: recusado antes de consultar o banco');
  } finally {
    if (saved.secret === undefined) delete process.env.SESSION_SIGNING_SECRET; else process.env.SESSION_SIGNING_SECRET = saved.secret;
    if (saved.owner === undefined) delete process.env.DATABASE_OWNER_URL; else process.env.DATABASE_OWNER_URL = saved.owner;
  }
  const src = read('api/_auth.js');
  assert(src.includes("if (!payload.sessionId) {"), 'T10: _auth recusa token sem sessionId');
  const users = read('api/users.js');
  assert(users.includes('UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=${targetId}'), 'T10: troca de senha revoga sessões');
  assert(read('api/auth.js').includes('sessions_revoked AS ('), 'T10: reset de senha revoga sessões');
  console.log('  ✓ T10 troca/reset de senha encerra todas as sessões (inclusive tokens antigos)');
}

console.log('\n✅ Auditoria 2026-10-02 (3ª rodada): todas as regressões passaram.');
