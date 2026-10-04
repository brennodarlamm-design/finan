// scripts/test-auditoria-2026-10-04.js
// Regressões da auditoria de 04/10/2026 (docs/AUDITORIA_2026-10-04.md).
// Roda os handlers reais com o banco trocado por um Postgres em memória (PGlite), via mock de módulo.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FLAG = '--experimental-test-module-mocks';
if (!process.execArgv.includes(FLAG)) {
  const r = spawnSync(process.execPath, [FLAG, '--no-warnings', fileURLToPath(import.meta.url)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const assert = (await import('node:assert/strict')).default;
const fs = await import('node:fs');
const { mock } = await import('node:test');
const { PGlite } = await import('@electric-sql/pglite');

process.env.SESSION_SIGNING_SECRET = 'teste-auditoria-2026-10-04-segredo-de-sessao-com-mais-de-32';
process.env.MFA_ENCRYPTION_KEY = 'teste-auditoria-2026-10-04-chave-mfa-com-mais-de-32-chars';

const db = new PGlite();
const sql = async (strings, ...values) => {
  let t = strings[0];
  values.forEach((_, k) => { t += `$${k + 1}` + strings[k + 1]; });
  return (await db.query(t, values)).rows;
};
sql.query = async (text, params = []) => (await db.query(text, params)).rows;
sql.transaction = async (fn) => (typeof fn === 'function' ? fn(sql) : Promise.all(fn));

const dbUrl = new URL('../api/_database.js', import.meta.url).href;
const realDb = await import(`${dbUrl}?real`);
mock.module(dbUrl, { namedExports: { ...realDb, createOwnerSql: () => sql, createRuntimeSql: () => sql } });

const read = (f) => fs.readFileSync(f, 'utf8');
function chamar(handler, { method = 'POST', query = {}, body = {}, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const hs = {};
    const res = {
      statusCode: 200,
      setHeader(k, v) { hs[k.toLowerCase()] = v; },
      getHeader(k) { return hs[k.toLowerCase()]; },
      appendHeader(k, v) { hs[k.toLowerCase()] = [].concat(hs[k.toLowerCase()] || [], v); },
      status(c) { this.statusCode = c; return this; },
      json(b) { resolve({ status: this.statusCode, body: b, headers: hs }); return this; },
      send(b) { resolve({ status: this.statusCode, body: b, headers: hs }); return this; },
      end() { resolve({ status: this.statusCode, body: null, headers: hs }); return this; }
    };
    const req = { method, query, body, headers: { 'user-agent': 'teste', origin: 'https://fingo.api.br', ...headers }, socket: { remoteAddress: '10.0.0.' + Math.floor(Math.random() * 250) } };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

console.log('=== Auditoria 04/10/2026 ===\n');

// #1 — MFA do superadmin não pode ser trocado só com a senha.
{
  await db.exec(`
    CREATE TABLE tenants (id text primary key, razao_social text, nome_fantasia text, status text);
    CREATE TABLE usuarios (id text primary key, username text, email text, nome text, perfil text, avatar text, tenant_id text,
      permissoes jsonb, mfa_secret text, mfa_enabled boolean default false, mfa_backup_codes jsonb, mfa_last_used_step bigint default 0);
    CREATE TABLE auth_sessions (id text primary key, user_id text, tenant_id text, device_name text, user_agent text, ip text,
      remember boolean, expires_at timestamptz, revoked_at timestamptz, created_at timestamptz default now(), last_seen_at timestamptz);
    CREATE TABLE audit_logs (id text, tenant_id text, usuario_id text, acao text, entidade text, entidade_id text, antes jsonb, depois jsonb, ip text, created_at timestamptz default now());
    INSERT INTO tenants VALUES ('fingo', 'FinGo', 'FinGo', 'ativo');
  `);
  const { signToken } = await import('../api/_auth.js');
  const { encryptMfaSecret, generateTotpSecret, generateTotpToken } = await import('../api/_totp.js');
  const { default: auth } = await import('../api/auth.js');
  const S = process.env.SESSION_SIGNING_SECRET;
  const segredoDono = generateTotpSecret(20);
  await db.query(`INSERT INTO usuarios (id, username, nome, perfil, tenant_id, permissoes, mfa_secret, mfa_enabled, mfa_backup_codes)
    VALUES ('sa', 'dono', 'Dono', 'superadmin', 'fingo', '{}', $1, true, '[]')`, [await encryptMfaSecret(segredoDono)]);
  const segredoAntes = (await db.query(`SELECT mfa_secret FROM usuarios WHERE id='sa'`)).rows[0].mfa_secret;

  // Ataque: senha certa → token "mfa_pending" → setup.
  const pendente = signToken({ userId: 'sa', username: 'dono', purpose: 'mfa_pending', exp: Date.now() + 60000 }, S);
  const r1 = await chamar(auth, { query: { action: 'mfa_setup' }, body: { mfa_token: pendente } });
  assert.equal(r1.status, 401, 'token mfa_pending não abre o setup');
  // Token de primeira configuração para quem já tem MFA → recusado.
  const setupTok = signToken({ userId: 'sa', username: 'dono', purpose: 'mfa_setup', exp: Date.now() + 60000 }, S);
  assert.equal((await chamar(auth, { query: { action: 'mfa_setup' }, body: { setup_token: setupTok } })).status, 409);
  // Mesmo com um token de ativação (sem "reconfigure"), o MFA ativo não é sobrescrito.
  const novo = generateTotpSecret(20);
  const conf = signToken({ userId: 'sa', username: 'dono', temp_secret: novo, backup_hashes: [], purpose: 'mfa_confirm_activation', exp: Date.now() + 60000 }, S);
  const r3 = await chamar(auth, { query: { action: 'mfa_activate' }, body: { setup_token: conf, totp_code: generateTotpToken(novo) } });
  assert.equal(r3.status, 409, 'activate não sobrescreve MFA ativo');
  assert.equal((await db.query(`SELECT mfa_secret FROM usuarios WHERE id='sa'`)).rows[0].mfa_secret, segredoAntes, 'segredo do dono intacto');

  // Primeiro acesso legítimo (MFA desligado) continua funcionando.
  await db.query(`INSERT INTO usuarios (id, username, nome, perfil, tenant_id, permissoes, mfa_enabled) VALUES ('sa2', 'novo', 'Novo', 'superadmin', 'fingo', '{}', false)`);
  const tok2 = signToken({ userId: 'sa2', username: 'novo', purpose: 'mfa_setup', exp: Date.now() + 60000 }, S);
  const s2 = await chamar(auth, { query: { action: 'mfa_setup' }, body: { setup_token: tok2 } });
  assert.equal(s2.status, 200);
  const a2 = await chamar(auth, { query: { action: 'mfa_activate' }, body: { setup_token: s2.body.setup_token, totp_code: generateTotpToken(s2.body.secret) } });
  assert.equal(a2.status, 200, JSON.stringify(a2.body));
  assert.equal((await db.query(`SELECT mfa_enabled FROM usuarios WHERE id='sa2'`)).rows[0].mfa_enabled, true);
  // Repetir a ativação com o mesmo token de confirmação não troca mais nada.
  assert.equal((await chamar(auth, { query: { action: 'mfa_activate' }, body: { setup_token: s2.body.setup_token, totp_code: generateTotpToken(s2.body.secret) } })).status, 409);
  assert.equal(read('api/auth.js'), read('backend/domains/auth/auth.js'));
  console.log('  ✓ #1 MFA: senha sozinha não cadastra autenticador novo; primeiro acesso continua funcionando');
}

// #2 — Código de redefinição: não vai para o WhatsApp da empresa; conta Master exige autenticador.
{
  await db.exec(`
    ALTER TABLE tenants ADD COLUMN telefone text;
    ALTER TABLE usuarios ADD COLUMN ativo boolean default true, ADD COLUMN senha_hash text, ADD COLUMN updated_at timestamptz;
    UPDATE tenants SET telefone = '95999990000' WHERE id = 'fingo';
    UPDATE usuarios SET email = 'adhomem@' WHERE id = 'sa';
    CREATE TABLE recuperacao_senhas (id text primary key, usuario_id text, codigo_hash text, expira_em timestamptz,
      usado boolean default false, tentativas int default 0, max_tentativas int default 5, created_at timestamptz default now());
  `);
  const { hashPassword } = await import('../api/_auth.js');
  const { decryptMfaSecret, generateTotpToken } = await import('../api/_totp.js');
  const { default: auth } = await import('../api/auth.js');
  const enviados = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { enviados.push(String(url)); return { ok: true, status: 200, json: async () => ({}) }; };
  try {
    const r = await chamar(auth, { query: { action: 'request_reset' }, body: { identificador: 'dono' } });
    assert.equal(r.status, 200);
    assert(!enviados.some(u => u.includes('/send-message')), 'código do Master não vai para o WhatsApp da empresa');
    assert.equal((await db.query(`SELECT count(*)::int c FROM recuperacao_senhas WHERE usuario_id='sa'`)).rows[0].c, 1);
  } finally { globalThis.fetch = fetchOriginal; }

  // verify_reset da conta Master: o código recebido sozinho não troca a senha.
  await db.query(`INSERT INTO recuperacao_senhas (id, usuario_id, codigo_hash, expira_em) VALUES ('rec_t', 'sa', $1, now() + interval '10 minutes')`, [await hashPassword('123456')]);
  const senhaAntes = (await db.query(`SELECT senha_hash FROM usuarios WHERE id='sa'`)).rows[0].senha_hash;
  const semFator = await chamar(auth, { query: { action: 'verify_reset' }, body: { requestId: 'rec_t', code: '123456', newPassword: 'NovaSenha#2026xy' } });
  assert.equal(semFator.status, 401); assert.equal(semFator.body.code, 'MFA_REQUIRED');
  assert.equal((await db.query(`SELECT senha_hash FROM usuarios WHERE id='sa'`)).rows[0].senha_hash, senhaAntes, 'senha não mudou');
  const errado = await chamar(auth, { query: { action: 'verify_reset' }, body: { requestId: 'rec_t', code: '123456', newPassword: 'NovaSenha#2026xy', totp_code: '000000' } });
  assert.equal(errado.status, 401); assert.equal(errado.body.code, 'MFA_INVALID');
  const segredo = (await decryptMfaSecret((await db.query(`SELECT mfa_secret FROM usuarios WHERE id='sa'`)).rows[0].mfa_secret)).secret;
  const ok = await chamar(auth, { query: { action: 'verify_reset' }, body: { requestId: 'rec_t', code: '123456', newPassword: 'NovaSenha#2026xy', totp_code: generateTotpToken(segredo) } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.notEqual((await db.query(`SELECT senha_hash FROM usuarios WHERE id='sa'`)).rows[0].senha_hash, senhaAntes);
  const src = read('api/auth.js');
  assert(src.includes("const destPhone = (!contaMaster && !emailValido)"), 'WhatsApp da empresa só sem e-mail válido');
  assert.equal(read('js/auth.js'), read('frontend/core/auth.js'));
  assert.equal(read('js/login_page.js'), read('frontend/core/login_page.js'));
  console.log('  ✓ #2 Redefinição: código vai ao e-mail da pessoa (WhatsApp da empresa só sem e-mail; nunca para o Master); Master exige autenticador');
}

// #4 — Cobrança: vencimento chega do driver como objeto Date; o cálculo precisa do texto 'AAAA-MM-DD'.
{
  const { createRequire } = await import('node:module');
  const req = createRequire(new URL('../backend/package.json', import.meta.url));
  const { types } = req('@neondatabase/serverless');
  const comoDriver = types.getTypeParser(1082, 'text')('2026-10-10');
  assert(comoDriver instanceof Date, 'o driver devolve DATE como Date (motivo do bug)');
  assert.notEqual(String(comoDriver).split('-').length, 3, 'String(Date).split quebrava o cálculo');
  // Com a coluna lida como texto, o mesmo cálculo do server.js chega ao estágio certo.
  const { billingStageFor } = await import('../backend/billing_stages.js');
  const venc = (await db.query(`SELECT '2026-10-10'::date::text AS v`)).rows[0].v;
  const parts = String(venc).split('-');
  const dias = Math.round((new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`) - new Date('2026-10-07T00:00:00')) / 86400000);
  assert.equal(dias, 3); assert.equal(billingStageFor('profissional', dias)?.stage, 'reminder_3d');
  const server = read('backend/server.js');
  assert.equal((server.match(/plano, status, vencimento::text AS vencimento/g) || []).length, 2, 'as duas consultas da varredura leem texto');
  assert(read('api/_webhook_pix_core.js').includes('tenant_upd.vencimento::text AS vencimento'), 'recibo PIX com data em texto');
  assert.equal(read('api/_webhook_pix_core.js'), read('backend/domains/financeiro/_webhook_pix_core.js'));
  console.log('  ✓ #4 Cobrança: vencimento lido como texto (o objeto Date zerava todos os avisos); recibo PIX com data certa');
}

// #5 e #6 — Resumo matinal e varredura manual.
{
  const server = read('backend/server.js');
  const resumo = server.slice(server.indexOf('async function executarResumoMatinal'), server.indexOf("cron.schedule('0 8 * * *'"));
  assert(!resumo.includes('t.telefone || TARGET_PHONE'), 'sem fallback para o telefone fixo');
  assert(resumo.includes("|| (explicitTenantId && tId === TARGET_TENANT_ID ? TARGET_PHONE : '')"));
  assert(resumo.includes("NOT IN ('bloqueado', 'cancelado', 'arquivado')"), 'não envia a empresas canceladas');
  assert(resumo.includes('LIMIT ${MAX_ITENS_RESUMO}'), 'mensagem com limite de itens');
  assert(resumo.includes("'daily_summary'") && resumo.includes('ON CONFLICT (tenant_id, stage, sent_date) DO NOTHING'), 'uma vez por dia');
  assert(server.includes("WHERE tenant_id = ${t.id} AND stage = ${stage} AND status = 'sent'"), 'anti-spam só conta envios reais');
  assert(server.includes('if (alreadySent.length > 0 && !(manualTrigger && forcedTenantId))'), 'clique manual geral respeita o anti-spam');
  for (const f of ['api/admin.js', 'api/_admin-route.js']) {
    const src = read(f);
    assert(!/'pending_dispatch',\s*\n?\s*\$\{JSON\.stringify/.test(src) && !/\$\{t\.email \|\| null\}, 'pending_dispatch'/.test(src), `${f}: não grava aviso que ninguém envia`);
  }
  assert(read('api/admin.js').includes("return res.status(sweepResult.success ? 200 : 503)"));
  assert.equal(read('api/admin.js'), read('backend/domains/integrations/admin.js'));
  assert.equal(read('api/_admin-route.js'), read('backend/domains/integrations/_admin-route.js'));
  assert.equal(read('js/master.js'), read('frontend/domains/configuracoes/master.js'));
  console.log('  ✓ #5 Resumo matinal: sem telefone fixo de fallback, sem empresas canceladas, até 20 itens, uma vez por dia');
  console.log('  ✓ #6 Varredura manual: não marca aviso como enviado sem enviar; clique geral respeita o anti-spam');
}

// #3 — Nenhum hash de senha versionado; script que zerava o MFA do Master desativado.
{
  const { execSync } = await import('node:child_process');
  const comHash = execSync(`git grep -lE "\\b[0-9a-f]{32}:[0-9a-f]{128}\\b" -- . ":!node_modules" || true`).toString().trim();
  assert.equal(comHash, '', `hash de senha versionado em: ${comHash}`);
  assert(read('scripts/security-secrets-scanner.cjs').includes("name: 'Password Hash (scrypt salt:hash)'"));
  assert(!/mfa_enabled\s*=\s*FALSE/.test(read('scripts/apply-migration-023.js')), 'script não desliga mais o MFA do Master');
  console.log('  ✓ #3 Hash da senha do Master removido do repositório e bloqueado pelo scanner');
}

await db.close();
console.log('\n✅ Auditoria 04/10/2026: tudo certo.');
