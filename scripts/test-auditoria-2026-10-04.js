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
  let comHash = '';
  try {
    comHash = execSync(`git grep -lE "\\b[0-9a-f]{32}:[0-9a-f]{128}\\b" -- . ":!node_modules"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch (err) {
    if (err.status !== 1) throw err; // status 1 = nenhum match
  }
  assert.equal(comHash, '', `hash de senha versionado em: ${comHash}`);
  assert(read('scripts/security-secrets-scanner.cjs').includes("name: 'Password Hash (scrypt salt:hash)'"));
  assert(!/mfa_enabled\s*=\s*FALSE/.test(read('scripts/apply-migration-023.js')), 'script não desliga mais o MFA do Master');
  console.log('  ✓ #3 Hash da senha do Master removido do repositório e bloqueado pelo scanner');
}

// #12 — Assinaturas: sem leitura pública entre empresas; validação por código continua.
{
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE tenants (id text primary key, nome_fantasia text, razao_social text, cnpj text, cidade text, uf text);
    CREATE TABLE document_signatures (id text primary key, tenant_id text, user_id text, codigo_validacao text unique, hash_sha256 text,
      nome text, doc text, papel text, doc_tipo text, doc_id text, doc_numero text, data_hora timestamptz, data_hora_fmt text,
      ip_dispositivo text, created_at timestamptz default now());
    INSERT INTO tenants VALUES ('t1','Construtora Um',null,null,'Boa Vista','RR'), ('t2','Construtora Dois',null,null,'Manaus','AM');
    INSERT INTO document_signatures (id, tenant_id, codigo_validacao, hash_sha256, nome, doc, ip_dispositivo)
      VALUES ('s1','t1','FIN-SIG-AAAA1111','aa11','Ana','11122233344','10.0.0.1'), ('s2','t2','FIN-SIG-BBBB2222','bb22','Bruno','55566677788','10.0.0.2');
    ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;
    ALTER TABLE document_signatures FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation_document_signatures ON document_signatures FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
    CREATE POLICY signatures_public_read ON document_signatures FOR SELECT USING (codigo_validacao IS NOT NULL);
    CREATE ROLE finobra_app;
    GRANT SELECT, INSERT ON document_signatures, tenants TO finobra_app;
  `);
  const comoApp = async (q, params = []) => {
    await pg.exec(`SET ROLE finobra_app; SELECT set_config('app.current_tenant_id', 't1', false);`);
    try { return (await pg.query(q, params)).rows; } finally { await pg.exec('RESET ROLE;'); }
  };
  assert.equal((await comoApp('SELECT count(*)::int c FROM document_signatures'))[0].c, 2, 'antes: empresa t1 lia a assinatura da t2 (bug)');
  await pg.exec(read('migrations/040_document_signatures_sem_leitura_publica.sql'));
  assert.equal((await comoApp('SELECT count(*)::int c FROM document_signatures'))[0].c, 1, 'depois: só as assinaturas da própria empresa');
  const pub = await comoApp('SELECT * FROM validar_assinatura_publica($1)', ['fin-sig-bbbb2222']);
  assert.equal(pub.length, 1); assert.equal(pub[0].nome, 'Bruno'); assert.equal(pub[0].nome_fantasia, 'Construtora Dois');
  assert.equal((await comoApp('SELECT * FROM validar_assinatura_publica($1)', ['FIN-SIG-NAOEXISTE'])).length, 0);
  assert.equal((await comoApp(`SELECT * FROM validar_assinatura_publica('')`)).length, 0);
  assert.equal((await comoApp('SELECT codigo_assinatura_status($1,$2,$3) st', ['FIN-SIG-BBBB2222', 't1', 'bb22']))[0].st, 'em_uso');
  assert.equal((await comoApp('SELECT codigo_assinatura_status($1,$2,$3) st', ['FIN-SIG-AAAA1111', 't1', 'AA11']))[0].st, 'mesmo_registro');
  assert.equal((await comoApp('SELECT codigo_assinatura_status($1,$2,$3) st', ['FIN-SIG-NOVO0000', 't1', 'x']))[0].st, 'livre');
  await pg.close();
  const src = read('api/assinaturas.js');
  assert(src.includes('SELECT * FROM validar_assinatura_publica(${code})') && src.includes('codigo_assinatura_status(${codigo}, ${auth.tenantId}, ${hash})'));
  assert.equal(src, read('backend/domains/financeiro/assinaturas.js'));
  console.log('  ✓ #12 Assinaturas: RLS volta a isolar por empresa; validação pública por código via função');
}

// #7 a #11 — Dados de usuários, NF-e e OCR não viram HTML/ações na tela.
{
  const vm = await import('node:vm');
  const XSS = '"><img src=x data-fb-mouseover="Auth.logout"><b>';
  const store = new Map();
  const ctx = vm.createContext({
    console, structuredClone, setTimeout, clearTimeout, Promise, URL,
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: () => null, get length() { return 0; } },
    Auth: { getCurrentTenantId: () => 't1', canModule: () => true, getUser: () => ({ nome: 'U' }) },
    navigator: { onLine: false }, window: { addEventListener() {}, dispatchEvent() {}, location: { origin: 'https://fingo.api.br' } },
    document: { getElementById: () => null, querySelector: () => null, addEventListener() {}, body: { classList: { contains: () => false } } },
    crypto: { randomUUID: () => Math.random().toString(16).slice(2) }, App: { obraId: 'todas' }
  });
  ctx.globalThis = ctx;
  for (const m of ['Clientes', 'Configuracoes', 'Contas', 'Contratos', 'Dashboard', 'Escritorio', 'Exportar', 'FasesDoc', 'Fornecedores', 'Lancamentos', 'Medicoes', 'Notas', 'Orcamentos', 'PreCompras', 'Produtos', 'Recibos']) ctx[m] = {};
  vm.runInContext(`${read('js/utils.js')}\nglobalThis.Utils = Utils;`, ctx);
  vm.runInContext(`${read('js/data.js')}\nglobalThis.DB = DB;`, ctx);
  for (const [f, n] of [['js/app.js', 'App2'], ['js/documentos.js', 'Documentos'], ['js/exportar_templates.js', 'ExportarTemplates']]) {
    const nome = f === 'js/app.js' ? 'App' : n;
    vm.runInContext(`${read(f)}\nglobalThis.${n} = ${nome};`, ctx);
  }
  ctx.DB.canWriteLocal = () => true; ctx.DB.syncToCloud = () => true;
  ctx.DB.add('clientes', { id: 'o1', nome: XSS, cidade: XSS, estado: 'RR', num_contrato_caixa: XSS, status: 'em_andamento' });
  ctx.DB.add('lancamentos', { id: 'l1', obra_id: 'o1', tipo: 'despesa', descricao: XSS, fornecedor_beneficiario: XSS, valor: 10, data: '2026-10-01', status: 'a_pagar', categoria: 'material' });
  ctx.DB.add('medicoes', { id: 'm1', obra_id: 'o1', numero_medicao: 1, etapa_descricao: XSS, percentual_fisico: 5 });
  const semInjecao = (html, onde) => {
    assert(!/<img src=x/i.test(html), `${onde}: tag injetada`);
    assert(!/data-fb-mouseover="Auth\.logout"/.test(html.replace(/&quot;/g, '"').replace(/&lt;img[^]*?&gt;/g, '')), `${onde}: atributo injetado`);
  };
  semInjecao(ctx.App2._renderListaBuscaObras(''), 'busca de obras');
  let modal = '';
  ctx.Utils.showModal = h => { modal = h; };
  ctx.Documentos.abrirModal('lancamento', 'l1'); semInjecao(modal, 'anexos (lançamento)');
  ctx.Documentos.abrirModal('medicao', 'm1'); semInjecao(modal, 'anexos (medição)');
  for (const tipo of ['lancamentos', 'medicoes', 'engenharia']) semInjecao(ctx.ExportarTemplates.gerar(tipo, 'o1', {}), `exportação ${tipo}`);
  assert(ctx.ExportarTemplates.gerar('lancamentos', 'o1', {}).includes('&lt;img src=x'), 'o texto aparece escapado (não some)');
  // Nenhum value="${...}" sem escape nos módulos do app.
  const app = read('app.html');
  for (const f of [...new Set([...app.matchAll(/src="\/js\/([a-z0-9_\-]+\.js)/g)].map(m => m[1]))]) {
    if (!fs.existsSync(`js/${f}`) || f === 'utils.js') continue; // utils: listas fixas de categorias
    const src = read(`js/${f}`);
    if (!src.includes('Utils.')) continue;
    const ruins = [...src.matchAll(/value="\$\{([^{}`]+)\}"/g)].map(m => m[1].trim())
      .filter(ex => !/^(Utils\.(esc|escapeHtml|safeUrl|escapeJsAttr)|this\._esc|this\.esc|Patch51\.esc|esc\(|e\(|safeUrl\(|_esc\(|encodeURIComponent|\w+Esc$|descItem\.replace)/.test(ex));
    assert.deepEqual(ruins, [], `js/${f}: value sem escape`);
  }
  // NF-e/Notas/OCR.
  assert(read('js/nfe.js').includes('NF nº ${Utils.esc(parsed.numero_nf)} · ${Utils.esc(parsed.emitente)}'));
  assert(read('js/notas.js').includes('title="${Utils.esc(r.data.emitente)}">${Utils.esc(r.data.emitente)}</td>'));
  assert(read('js/ocr.js').includes("${this._esc(it.produto || '—')}"));
  // #11 Barramentos: eventos passivos não chamam ações; data-od-* parado no portal público.
  const ev = read('js/patch26-events.js');
  assert(ev.includes("if (PASSIVE_EVENTS.has(e) && !PASSIVE_ACTIONS.has(action))"));
  const od = read('js/obra_detalhe.js');
  assert(od.includes("if (document.body?.classList?.contains('portal-public-mode')) return;") && od.includes('hoverOnly: true'));
  for (const f of ['patch26-events', 'app', 'documentos', 'exportar_templates', 'nfe', 'notas', 'ocr', 'obra_detalhe', 'lancamentos', 'medicoes', 'escritorio']) {
    const m = ['frontend/core', ...fs.readdirSync('frontend/domains').map(d => `frontend/domains/${d}`)].map(d => `${d}/${f}.js`).find(p => fs.existsSync(p));
    assert.equal(read(`js/${f}.js`), read(m), `espelho de ${f}`);
  }
  console.log('  ✓ #7–#11 Telas e exportações mostram nomes/descrições/NF-e/OCR como texto; eventos passivos e data-od-* sem ações perigosas');
}

// #13 — Portal: o link leva, assinado, o que quem gerou pode ver.
{
  const portal = await import('../api/_portal-link.js');
  const key = 'x'.repeat(40);
  const exp = Date.now() + 60000;
  const sigF = portal.signPortalRef('acme', 'ob1', exp, key, 'm');
  assert.equal(portal.verifyPortalRef({ tenant: 'acme', obra: 'ob1', exp, sig: sigF, scope: 'm' }, key).escopo, 'm');
  assert.equal(portal.verifyPortalRef({ tenant: 'acme', obra: 'ob1', exp, sig: sigF, scope: 'fmcd' }, key).valid, false, 'aumentar o escopo invalida o link');
  assert.equal(portal.verifyPortalRef({ tenant: 'acme', obra: 'ob1', exp, sig: sigF }, key).valid, false, 'tirar o escopo invalida o link');
  const antigo = portal.signPortalRef('acme', 'ob1', exp, key);
  assert.equal(portal.verifyPortalRef({ tenant: 'acme', obra: 'ob1', exp, sig: antigo }, key).escopo, 'fmcd', 'link antigo continua até expirar');
  const consultas = [];
  const fakeSql = async (strings) => { const q = strings.join('?'); consultas.push(q); return /FROM obras/.test(q) ? [{ id: 'ob1', nome: 'Casa' }] : []; };
  const b = await portal.buildPortalBundle(fakeSql, 'acme', 'ob1', 'm');
  assert(consultas.some(q => /FROM medicoes/.test(q)) && !consultas.some(q => /FROM lancamentos|FROM contratos|FROM documentos/.test(q)), 'só consulta o que o escopo permite');
  assert.deepEqual(JSON.parse(JSON.stringify([b.nfe, b.ctr, b.doc])), [[], [], []]);
  assert(read('js/portal_cliente.js').includes("if (params.has('scope')) ref.scope = params.get('scope');"));
  assert.equal(read('api/_portal-link.js'), read('backend/domains/edge/_portal-link.js'));
  console.log('  ✓ #13 Portal: escopo assinado no link; quem não vê o financeiro gera link sem despesas; link antigo segue até expirar');
}

// #14 e #15 — "Sincronizar tudo": alterações chegam ao delta dos outros aparelhos; versões lidas em lote.
{
  const { handleSyncAll } = await import('../api/_db-sync.js');
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE fornecedores (id text PRIMARY KEY, tenant_id text, nome text, razao_social text, cnpj_cpf text, telefone text, email text,
      categoria text, chave_pix text, banco_info text, endereco text, municipio text, uf text, ativo boolean, created_at timestamptz DEFAULT now());
    CREATE TABLE audit_logs (id text, tenant_id text, user_id text, acao text, entidade text, entidade_id text, dados_anteriores jsonb,
      dados_novos jsonb, ip text, user_agent text, created_at timestamptz DEFAULT now());
    INSERT INTO fornecedores (id, tenant_id, nome, created_at) SELECT 'f' || g, 't1', 'Antigo ' || g, now() - interval '30 days' FROM generate_series(1, 300) g;
  `);
  let consultas = 0;
  const sqlPg = async (strings, ...values) => {
    consultas++;
    let t = strings[0];
    values.forEach((_, k) => { t += `$${k + 1}` + strings[k + 1]; });
    return (await pg.query(t, values)).rows;
  };
  const versoes = new Map((await pg.query(`SELECT id, xmin::text v FROM fornecedores`)).rows.map(r => [r.id, r.v]));
  const payload = { fornecedores: [...versoes.keys()].map(id => ({ id, nome: 'Novo ' + id, sync_version: versoes.get(id) })) };
  let status = 200, body;
  const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; }, setHeader() {} };
  const auth = { tenantId: 't1', user: { userId: 'u1', perfil: 'admin' } };
  await handleSyncAll(sqlPg, 't1', auth, { headers: {} }, res, payload);
  assert.equal(status, 200, JSON.stringify(body)); assert.equal(body.synced, 300);
  assert(consultas <= 300 + 5, `consultas ao banco: ${consultas} (antes eram ~600)`);
  // O delta usado pelos outros aparelhos (mesma regra de _db-queries.js) enxerga os 300 alterados.
  const since = new Date(Date.now() - 60_000).toISOString();
  const delta = (await pg.query(`SELECT count(*)::int c FROM fornecedores WHERE tenant_id='t1' AND (created_at >= $1 OR id IN (SELECT entidade_id FROM audit_logs WHERE tenant_id='t1' AND entidade='fornecedores' AND created_at >= $1))`, [since])).rows[0].c;
  assert.equal(delta, 300, 'outros aparelhos recebem as alterações do Sincronizar tudo');
  // Versão velha continua recusada (com a leitura em lote).
  const velho = { fornecedores: [{ id: 'f1', nome: 'X', sync_version: versoes.get('f1') }] };
  await handleSyncAll(sqlPg, 't1', auth, { headers: {} }, res, velho);
  assert.equal(status, 207); assert.equal(body.failed[0].code, 'SYNC_CONFLICT');
  await pg.close();
  for (const f of ['_db-sync', '_sync-guard', '_audit']) {
    const d = { '_db-sync': 'database', '_sync-guard': 'database', '_audit': 'integrations' }[f];
    assert.equal(read(`api/${f}.js`), read(`backend/domains/${d}/${f}.js`));
  }
  for (const f of ['_workflow', '_workflow-complete', '_workflow-stage-update']) {
    assert(read(`api/${f}.js`).includes("marcarAlteracao(sql"), `${f}: marca a obra alterada`);
    assert.equal(read(`api/${f}.js`), read(`backend/domains/obras/${f}.js`));
  }
  console.log(`  ✓ #14/#15 Sincronizar tudo: alterações chegam aos outros aparelhos; ${consultas} consultas para 300 registros (antes ~600)`);
}

// #16 a #19
{
  assert.equal((read('js/minhas_demandas.js').match(/getDemandas\(u\.userId \|\| u\.id\)/g) || []).length, 2, 'Minhas Demandas usa o userId da sessão');
  assert(read('js/notificacoes.js').includes('const uid = u ? (u.userId || u.id) : null;'));
  const orc = read('js/orcamentos.js');
  assert(orc.includes('despesas_por_etapa: porEtapa') && orc.includes('já tiveram despesas geradas') && orc.includes('if (this._gerandoDespesas) return;'));
  for (const f of ['precompras', 'escritorio']) {
    const src = read(`js/${f}.js`);
    assert(src.includes('if (this._salvando) return;') && src.includes('return await this._salvarImpl(event, id);'), `${f}: um salvamento por vez`);
  }
  for (const f of ['clientes', 'medicoes', 'precompras', 'orcamentos']) assert(/\{ allowHtml: true \}\);/.test(read(`js/${f}.js`)), `${f}: confirmação com HTML fixo`);
  assert(read('js/nfe.js').includes('if (data.success === false && !data.rateLimited) {'), 'SEFAZ: falha não aparece como sucesso');
  const dfe = read('api/_sefaz-dfe.js');
  assert(dfe.includes("SET proxima_consulta_permitida = NOW() + INTERVAL '2 minutes'") && dfe.includes("INTERVAL '15 minutes', -- pausa após erro"));
  assert(dfe.includes('codUf = CODIGO_UF_IBGE['));
  assert(read('cloudflare-worker.js').includes("apiUrl.searchParams.get('action') === 'dfe_sync' && env.FINOBRA_API_ORIGIN"));
  assert.equal(dfe, read('backend/domains/fiscal/_sefaz-dfe.js'));
  console.log('  ✓ #16–#19 Minhas Demandas, despesas do orçamento sem duplicar, salvar com anexo, SEFAZ (erro real, trava, UF, Render)');
}

// #20 a #29 — Rotinas, infraestrutura e configuração.
{
  const backup = await import('../api/_edge-backup.js');
  // #20 migração legada só na janela diária.
  const fora = await backup.migrateLegacyDocumentsToR2({ ATTACHMENTS_R2: { put() {} } }, { sql: { query: async () => { throw new Error('não deveria consultar'); } }, now: new Date('2026-10-05T12:00:00Z') });
  assert.equal(fora.reason, 'outside_migration_window');
  assert(read('api/_edge-backup.js').includes('ORDER BY md5(id || current_date::text)'));
  // #21 backup sem base64 dos documentos e com audit_logs de 90 dias (SQL real no Postgres).
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE documentos (id text, nome_arquivo text, base64_data text); INSERT INTO documentos VALUES ('d1','a.pdf','QUJD');
    CREATE TABLE audit_logs (id text, created_at timestamptz); INSERT INTO audit_logs VALUES ('novo', now()), ('velho', now() - interval '200 days');`);
  const consultas = [];
  const sqlFactory = () => ({ query: async (q) => { consultas.push(q); if (/FROM "(documentos|audit_logs)"/.test(q)) return (await pg.query(q)).rows; return []; } });
  const puts = {};
  const bucket = { put: async (k, body) => { puts[k] = body; return { size: body.byteLength ?? body.length }; }, head: async (k) => (puts[k] ? { key: k } : null) };
  const manifest = await backup.createCriticalR2Backup({ BACKUP_ENCRYPTION_KEY: 'k'.repeat(40), DATABASE_URL: 'postgres://x', BACKUPS_R2: bucket }, { force: true, sqlFactory });
  assert.equal(manifest.tables.documentos, 1); assert.equal(manifest.tables.audit_logs, 1, 'audit_logs só dos últimos 90 dias');
  assert(consultas.some(q => q.includes(`to_jsonb(t) - 'base64_data'`)), 'documentos sem base64_data');
  await pg.close();
  const alertas = [];
  const ok = await backup.verificarBackupDoDia({ BACKUPS_R2: bucket }, { force: true, now: new Date() });
  assert.equal(ok.ok, true, 'manifesto do dia encontrado');
  const falta = await backup.verificarBackupDoDia({ BACKUPS_R2: { put: async () => ({}), head: async () => null } }, { force: true });
  assert.equal(falta.ok, false, 'sem manifesto → alerta');
  assert(read('cloudflare-worker.js').includes('verificarBackupDoDia(env)'));
  assert.equal(read('api/_edge-backup.js'), read('backend/domains/edge/_edge-backup.js'));
  // #22 erro de criptografia não apaga sessões do WhatsApp.
  const server = read('backend/server.js');
  const handler = server.slice(server.indexOf("process.on('uncaughtException'"), server.indexOf("process.on('unhandledRejection'"));
  assert(!handler.includes('resetWhatsAppSession('), 'não reseta sessões em erro de decifragem');
  // #23 robô SINAPI grava tudo, em lote, e lê a linha das UFs uma vez.
  const robo = read('backend/sinapi_robot.js');
  assert(!robo.includes('batchItems.slice(0, 300)') && robo.includes('FROM unnest(') && !robo.includes("sheet_to_json(compSheet") && robo.includes('await new Promise(r => setImmediate(r));'));
  // #24 webhook de e-mail.
  const prev = { ...process.env };
  process.env.EMAIL_WEBHOOK_SECRET = 'segredo-email-' + 'x'.repeat(20); process.env.PIX_WEBHOOK_SECRET = 'segredo-pix-' + 'y'.repeat(20); process.env.INTERNAL_API_SECRET = 'segredo-int-' + 'z'.repeat(20);
  const { isEmailWebhookAuthorized } = await import('../api/_webhook_email.js');
  assert.equal(isEmailWebhookAuthorized({ headers: { 'x-webhook-secret': process.env.PIX_WEBHOOK_SECRET } }).authorized, false, 'segredo do PIX não abre o webhook de e-mail');
  assert.equal(isEmailWebhookAuthorized({ headers: { authorization: 'Bearer ' + process.env.INTERNAL_API_SECRET } }).authorized, false, 'segredo interno não abre');
  assert.equal(isEmailWebhookAuthorized({ headers: { 'x-webhook-secret': process.env.EMAIL_WEBHOOK_SECRET } }).authorized, true);
  process.env = prev;
  const wh = read('api/_webhook_email.js');
  assert(wh.includes("createHash('sha256').update(svixId)") && wh.includes('ON CONFLICT (id) DO NOTHING') && wh.includes('const remetente = '));
  assert.equal(wh, read('backend/domains/integrations/_webhook_email.js'));
  // #25 render.yaml.
  const ry = read('render.yaml');
  assert(!/\d{12,13}/.test(ry), 'sem telefone no render.yaml'); assert(/ORIGIN_ENFORCE_EDGE\r?\n\s+value: "true"/.test(ry));
  // #26 workflows.
  const pv = read('.github/workflows/cloudflare-pages-migration.yml');
  const jobValidate = pv.slice(pv.indexOf('  validate:'), pv.indexOf('    steps:', pv.indexOf('  validate:')));
  assert(!jobValidate.includes('CLOUDFLARE_API_TOKEN'), 'token fora do ambiente do job');
  assert(pv.includes('npm ci --ignore-scripts') && !pv.includes('npx --yes wrangler') && pv.includes('npx wrangler delete --name "$PREVIEW_NAME"'));
  assert(read('.github/workflows/production-cicd.yml').includes('environment: production'));
  // #27 build não reescreve arquivos versionados.
  const build = read('scripts/build-cloudflare-pages.cjs');
  assert(!build.includes("path.join(root, 'js', 'sentry.js')") && build.includes("empacotarSentry(path.join(out, 'js', 'sentry.js'));"));
  // #28 bibliotecas do próprio domínio, CSP sem cdnjs.
  const worker = read('cloudflare-worker.js');
  assert(!/script-src[^`]*cdnjs/.test(worker) && worker.includes(`"worker-src 'self' blob:",`));
  for (const f of ['jszip.min.js', 'jspdf.umd.min.js', 'pdf.min.mjs', 'pdf.worker.min.mjs', 'three.min.js']) assert(fs.existsSync(`js/vendor/${f}`), f);
  assert(read('js/vendor/jspdf.umd.min.js').includes('3.0.4'), 'jsPDF 3.0.4');
  assert(fs.existsSync('js/vendor/xlsx.full.min.js') && read('js/vendor/xlsx.full.min.js').includes('0.20.3'), 'xlsx 0.20.3 local');
  assert(read('js/assets.js').includes('/js/vendor/xlsx.full.min.js') && !worker.includes('cdn.sheetjs.com'));
  for (const f of ['js/assets.js', 'js/ocr.js', 'js/pdfjs_bootstrap.js', 'bim.html']) assert(!read(f).includes('cdnjs.cloudflare.com'), `${f} sem cdnjs`);
  // #29 workers.dev de produção.
  assert(worker.includes('function blockProductionWorkersDev(request, env)') && worker.includes("if (String(env?.FINOBRA_PREVIEW_COMMIT || '').trim()) return null;"));
  console.log('  ✓ #20–#29 Migração diária, backup enxuto com alerta, WhatsApp preservado, SINAPI completo, webhook de e-mail, render.yaml, workflows, build, bibliotecas locais e workers.dev');
}

await db.close();
console.log('\n✅ Auditoria 04/10/2026: tudo certo.');
