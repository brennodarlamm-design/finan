// scripts/test-audit-2026-10-02.js
// Regressões da auditoria de segurança/backend de 02/10/2026 (F1–F11).
import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel) => {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  const pub = path.join(root, 'public', rel);
  if (fs.existsSync(pub)) return fs.readFileSync(pub, 'utf8');
  return fs.readFileSync(p, 'utf8');
};

function createMockResponse() {
  let statusCode = 200; let body; const headers = {};
  return {
    status(code) { statusCode = code; return this; },
    json(data) { body = data; return this; },
    send(data) { body = data; return this; },
    end() { return this; },
    setHeader(k, v) { headers[String(k).toLowerCase()] = v; },
    getStatusCode: () => statusCode,
    getBody: () => body,
    getHeaders: () => headers
  };
}

process.env.SESSION_SIGNING_SECRET = process.env.SESSION_SIGNING_SECRET || 'test-session-secret-audit-2026-10-02-xxxxxxxx';

console.log('=== Auditoria 2026-10-02 — regressões de segurança/backend ===\n');

const v2 = await import('../api/_v2-routes.js');
const v2Src = read('api/_v2-routes.js');

// F1 — Otimizador de mídia não pode ler o bucket sem sessão (backups expostos).
{
  const res = createMockResponse();
  await v2.handleV2EdgeMediaOptimize({
    url: '/api/v2/edge/media/optimize?key=backups/neon-critical/2026-10-02/snapshot.json',
    headers: {},
    env: { ATTACHMENTS_R2: { get: async () => { throw new Error('R2 não deveria ser consultado'); } } }
  }, res);
  assert.strictEqual(res.getStatusCode(), 401, 'F1: optimize sem sessão deve responder 401');
  const fnSrc = v2Src.slice(v2Src.indexOf('export async function handleV2EdgeMediaOptimize'), v2Src.indexOf('export async function handleV2AuditLedgerAppend'));
  assert(fnSrc.includes('tenants/${auth.tenantId}/'), 'F1: optimize deve restringir ao prefixo do tenant');
  assert(!fnSrc.includes("'public, max-age=31536000, immutable'"), 'F1: resposta não pode ser cacheável publicamente');
  console.log('  ✓ F1 media/optimize exige sessão, prefixo do tenant e cache privado');
}

// F2 — Webhook de e-mail: assinatura Svix precisa ser verificada de verdade.
{
  const { verifySvixSignature, isEmailWebhookAuthorized } = await import('../api/_webhook_email.js');
  const keyBytes = crypto.randomBytes(24);
  const secret = 'whsec_' + keyBytes.toString('base64');
  const id = 'msg_123'; const ts = String(Math.floor(Date.now() / 1000));
  const raw = '{"type":"email.received","data":{"from":"a@b.com"}}';
  const good = crypto.createHmac('sha256', keyBytes).update(`${id}.${ts}.${raw}`).digest('base64');
  assert.strictEqual(verifySvixSignature({ secret, id, timestamp: ts, signatureHeader: `v1,${good}`, rawBody: raw }), true, 'F2: assinatura válida deve passar');
  assert.strictEqual(verifySvixSignature({ secret, id, timestamp: ts, signatureHeader: 'v1,AAAA', rawBody: raw }), false, 'F2: assinatura inválida deve falhar');
  assert.strictEqual(verifySvixSignature({ secret, id, timestamp: String(Number(ts) - 3600), signatureHeader: `v1,${good}`, rawBody: raw }), false, 'F2: timestamp antigo deve falhar');

  const prev = { ...process.env };
  process.env.EMAIL_WEBHOOK_SECRET = secret;
  delete process.env.INTERNAL_API_SECRET; delete process.env.PIX_WEBHOOK_SECRET; delete process.env.RESEND_WEBHOOK_SECRET;
  const forged = isEmailWebhookAuthorized({ headers: { 'svix-signature': 'qualquer-coisa', 'svix-id': id, 'svix-timestamp': ts }, rawBody: raw, body: JSON.parse(raw) });
  assert.strictEqual(forged.authorized, false, 'F2: presença do header svix-signature não pode autorizar');
  const legit = isEmailWebhookAuthorized({ headers: { 'svix-signature': `v1,${good}`, 'svix-id': id, 'svix-timestamp': ts }, rawBody: raw, body: JSON.parse(raw) });
  assert.strictEqual(legit.authorized, true, 'F2: assinatura Svix válida deve autorizar');
  process.env = prev;
  assert(read('api/_edge-adapter.js').includes('rawBody'), 'F2: adapter Edge deve preservar o corpo bruto');
  assert(read('backend/server.js').includes("app.use(['/api/webhook-email', '/api/plano'], express.json(") && read('backend/server.js').includes('req.rawBody = buf.toString'), 'F2: Express deve preservar o corpo bruto nos webhooks');
  console.log('  ✓ F2 webhook de e-mail verifica HMAC Svix (header forjado rejeitado)');
}

// F3 — IP confiável não pode ser escolhido pelo cliente via headers da Vercel.
{
  const { getTrustedClientIp } = await import('../api/_security-ip.js');
  const hadVercel = process.env.VERCEL; delete process.env.VERCEL;
  const ip = getTrustedClientIp({ headers: {
    'x-vercel-id': 'forjado', 'x-vercel-forwarded-for': '6.6.6.6',
    'cf-ray': 'abc', 'cf-connecting-ip': '200.10.20.30'
  } });
  assert.strictEqual(ip, '200.10.20.30', 'F3: x-vercel-id do cliente não pode sobrepor CF-Connecting-IP');
  if (hadVercel !== undefined) process.env.VERCEL = hadVercel;
  console.log('  ✓ F3 headers x-vercel-* enviados pelo cliente são ignorados fora da Vercel');
}

// F4 — checkRateLimit(key, limit, windowMs): chamadas com `req` como 1º argumento
// colapsavam todos os usuários num único bucket "[object Object]".
{
  assert(!/checkRateLimit\(\s*req\s*,/.test(v2Src), 'F4: checkRateLimit não pode receber req como chave');
  console.log('  ✓ F4 rate limit das rotas v2 usa chave por tenant/IP');
}

// F5 — plano/perfil vêm de auth.user; auth.plan/auth.role não existem.
{
  const code = v2Src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert(!/\bauth\.(plan|role)\b/.test(code), 'F5: não usar auth.plan/auth.role');
  assert(code.includes('canUseFeature(authPlan(auth), \'ocr\')'), 'F5: OCR deve checar o plano real');
  assert(code.includes('can(authRole(auth), \'audit\')'), 'F5: ledger deve checar o perfil real');
  console.log('  ✓ F5 gates de plano (OCR/SINAPI) e de perfil (ledger) usam auth.user');
}

// F6 — sync_all verifica permissão de todas as coleções que grava.
{
  const dbSrc = read('api/db.js');
  const map = dbSrc.slice(dbSrc.indexOf('const SYNC_COLLECTION_TABLE'), dbSrc.indexOf('function deniedSyncCollection'));
  const syncSrc = read('api/_db-sync.js');
  const written = [...new Set([...syncSrc.matchAll(/payload\.([a-z_]+)/g)].map(m => m[1]))];
  for (const key of written) {
    assert(new RegExp(`\\b${key}\\s*:`).test(map), `F6: coleção '${key}' gravada pelo sync_all sem checagem de permissão`);
  }
  console.log(`  ✓ F6 sync_all checa permissão das ${written.length} coleções gravadas`);
}

// F7 — SINAPI: base real (itens_referenciais), plano real e sem lista fixa de preços.
{
  const res = createMockResponse();
  await v2.handleV2SinapiExport({ query: { uf: 'SP' } }, res, { sql: async () => { throw new Error('down'); } });
  assert.strictEqual(res.getStatusCode(), 503, 'F7: sem base deve responder 503');
  for (const rel of ['api/_v2-routes.js', 'api/_db-queries.js']) {
    const src = read(rel).split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert(!/FROM\s+sinapi_itens/i.test(src), `F7: ${rel} ainda consulta a tabela inexistente sinapi_itens`);
  }
  assert(!v2Src.includes("source = 'official_seed'"), 'F7: catálogo fixo removido');
  assert(read('api/_db-queries.js').includes("planFeatureErrorForTable(auth, 'orcamentos_sinapi')"), 'F7: plano real na consulta SINAPI');
  const { normalizeSinapiParams } = await import('../api/_sinapi-reference.js');
  assert.deepStrictEqual(
    { ...normalizeSinapiParams({ uf: 'xx', competencia: '2026-13', q: ' cimento ' }), limit: 0 },
    { uf: 'SP', referencia: null, desonerado: null, termo: 'cimento', limit: 0 }
  );
  console.log('  ✓ F7 SINAPI consulta itens_referenciais com filtros e não devolve lista fixa');
}

// F8 — página /qr do backend falha fechada.
{
  const src = read('backend/server.js');
  const qr = src.slice(src.indexOf("app.all('/qr'"), src.indexOf("app.all('/qr'") + 1500);
  assert(qr.includes('if (!secret)'), 'F8: /qr deve bloquear sem INTERNAL_API_SECRET');
  assert(qr.includes('qrAttemptBlocked'), 'F8: /qr deve limitar tentativas');
  console.log('  ✓ F8 /qr falha fechada e limita tentativas');
}

// F9 — métricas v2 restritas.
{
  const res = createMockResponse();
  await v2.handleV2SystemMetrics({ headers: {} }, res);
  assert.strictEqual(res.getStatusCode(), 401, 'F9: métricas sem sessão devem responder 401');
  console.log('  ✓ F9 /api/v2/system/metrics exige superadmin');
}

// F10/F11 — LGPD na validação pública e edição da própria conta superadmin.
{
  assert(read('api/assinaturas.js').includes('ip_dispositivo: maskIp('), 'F10: IP do signatário deve ser mascarado');
  assert(read('api/users.js').includes('keepsSuperadmin'), 'F11: superadmin deve conseguir editar a própria conta');
  console.log('  ✓ F10 IP mascarado na validação pública / F11 superadmin edita a própria conta');
}

// R1 — Worker não reenvia gravações ao Render após 5xx do Edge.
{
  const worker = read('cloudflare-worker.js');
  const handleApi = worker.slice(worker.indexOf('async function handleApi('), worker.indexOf('export default {'));
  assert(/status >= 500 && env\.FINOBRA_API_ORIGIN && \(!isMutating \|\| edgeDeclaredUnprocessed\)/.test(handleApi), 'R1: fallback 5xx só para métodos seguros');
  assert(handleApi.includes('!mutatingRequest'), 'R1: exceção em gravação não é reenviada');
  console.log('  ✓ R1 fallback do Worker não duplica gravações');
}

// R2 — Origem Render só confia no IP vindo do Worker com segredo compartilhado.
{
  const { createOriginTrustMiddleware } = await import('../backend/origin_trust.js');
  const run = (headers, env, path = '/api/db') => {
    const req = { headers: { ...headers }, path };
    let status = 0; let nextCalled = false;
    const res = { status(c) { status = c; return this; }, json() { return this; } };
    createOriginTrustMiddleware(() => env)(req, res, () => { nextCalled = true; });
    return { req, status, nextCalled };
  };
  const env = { ORIGIN_SHARED_SECRET: 's'.repeat(40) };
  const spoof = run({ 'cf-ray': 'x', 'cf-connecting-ip': '6.6.6.6', 'x-forwarded-for': '6.6.6.6, 177.1.2.3' }, env);
  assert.strictEqual(spoof.req.headers['cf-connecting-ip'], undefined, 'R2: cf-connecting-ip forjado deve ser descartado');
  assert.strictEqual(spoof.req.headers['x-real-ip'], '177.1.2.3', 'R2: vale o último salto do X-Forwarded-For');
  const edge = run({ 'x-fingo-origin-auth': 's'.repeat(40), 'x-fingo-client-ip': '200.1.1.1' }, env);
  assert.strictEqual(edge.req.headers['x-real-ip'], '200.1.1.1', 'R2: IP do cliente vindo do Worker autenticado');
  assert.strictEqual(edge.req.fromTrustedEdge, true);
  const blocked = run({}, { ...env, ORIGIN_ENFORCE_EDGE: 'true' });
  assert.strictEqual(blocked.status, 403, 'R2: modo estrito bloqueia acesso direto a /api/*');
  const webhook = run({}, { ...env, ORIGIN_ENFORCE_EDGE: 'true' }, '/api/webhook-pix');
  assert.strictEqual(webhook.nextCalled, true, 'R2: webhooks continuam liberados');
  const legacy = run({ 'cf-ray': 'x', 'cf-connecting-ip': '1.2.3.4' }, {});
  assert.strictEqual(legacy.req.headers['cf-connecting-ip'], '1.2.3.4', 'R2: sem segredo configurado nada muda');
  assert(read('cloudflare-worker.js').includes("headers.set('X-FinGo-Origin-Auth', originSecret)"), 'R2: Worker envia o segredo ao Render');
  console.log('  ✓ R2 origem Render descarta cabeçalhos de IP forjados e aceita só o Worker autenticado');
}

// R3 — Backup diário cifrado, em bucket próprio, falha fechada sem chave.
{
  const { createCriticalR2Backup, decryptBackupPayload } = await import('../api/_edge-backup.js');
  const store = {};
  const bucket = { put: async (k, v) => { store[k] = v; return { size: v.byteLength }; } };
  const sqlFactory = () => ({ query: async () => [{ id: 'u1', senha_hash: 'scrypt$segredo' }] });
  await assert.rejects(() => createCriticalR2Backup({ DATABASE_URL: 'postgres://x', BACKUPS_R2: bucket }, { force: true, sqlFactory }));
  assert.strictEqual(Object.keys(store).length, 0, 'R3: sem chave nada é gravado');
  const secret = 'k'.repeat(40);
  const manifest = await createCriticalR2Backup({ DATABASE_URL: 'postgres://x', BACKUPS_R2: bucket, BACKUP_ENCRYPTION_KEY: secret }, { force: true, sqlFactory });
  assert(manifest.key.endsWith('.enc') && manifest.isolatedBucket === true);
  assert(!Buffer.from(store[manifest.key]).includes('senha_hash'), 'R3: snapshot não pode conter texto puro');
  const plain = JSON.parse(new TextDecoder().decode(await decryptBackupPayload(store[manifest.key], secret)));
  assert.strictEqual(plain.tables.usuarios.rows[0].senha_hash, 'scrypt$segredo');
  assert(read('wrangler.jsonc').includes('"binding": "BACKUPS_R2"'), 'R3: binding do bucket dedicado');
  console.log('  ✓ R3 backup cifrado (AES-GCM), bucket dedicado e falha fechada sem chave');
}

// R4 — Rotas públicas com limite por IP.
{
  let last = 200;
  for (let i = 0; i < 31; i++) {
    const res = createMockResponse();
    await v2.handleV2CurvaAbc({ headers: { 'x-real-ip': '10.9.8.7' }, query: {}, body: { itens: [] } }, res);
    last = res.getStatusCode();
  }
  assert.strictEqual(last, 429, 'R4: curva-abc deve limitar a 30/min por IP');
  for (const fn of ['handleV2SinapiExport', 'handleV2BoletimMedicao', 'handleV2EdgeSinapiCached']) {
    const src = v2Src.slice(v2Src.indexOf(`export async function ${fn}`));
    assert(src.slice(0, 300).includes('publicRouteLimited('), `R4: ${fn} deve ter rate limit`);
  }
  console.log('  ✓ R4 rotas públicas limitadas por IP');
}

// R5 — Metadados de autenticação sem endpoints inexistentes.
{
  const worker = read('cloudflare-worker.js');
  const meta = worker.slice(worker.indexOf('const OPENID_CONFIGURATION_PAYLOAD'), worker.indexOf('const WEB_BOT_AUTH_JWKS_PAYLOAD'));
  for (const fake of ['agent-register', 'action=claim', 'action=token', 'client_credentials', '"RS256"']) {
    assert(!meta.includes(fake), `R5: metadado inexistente ainda anunciado: ${fake}`);
  }
  assert(!read('auth.md').includes('agent-register'), 'R5: auth.md sem endpoints inexistentes');
  assert(JSON.parse(read('.well-known/jwks.json')).keys.length === 0, 'R5: JWKS sem chaves fictícias');
  console.log('  ✓ R5 OIDC/JWKS/auth.md descrevem apenas o que existe');
}

console.log('\n✅ Auditoria 2026-10-02: todas as regressões passaram.');
