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
  assert(read('cloudflare-worker.js').includes("['dfe_sync', 'dfe_xml_completo'].includes(apiUrl.searchParams.get('action')) && env.FINOBRA_API_ORIGIN"));
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

// #31 — base64 via save/sync_all passa pela mesma política do /api/upload.
{
  const { validarArquivoBase64 } = await import('../api/_file-validation.js');
  const b64 = (t) => Buffer.from(t).toString('base64');
  const pdf = b64('%PDF-1.7\n1 0 obj');
  assert.equal(validarArquivoBase64({ nomeArquivo: 'nota.pdf', mime: 'application/pdf', base64: pdf }).ok, true);
  assert.equal(validarArquivoBase64({ nomeArquivo: 'nota.pdf', mime: 'application/pdf', base64: 'data:application/pdf;base64,' + pdf }).ok, true);
  assert.equal(validarArquivoBase64({ nomeArquivo: 'sem-extensao', mime: 'application/pdf', base64: pdf }).ok, true, 'extensão pelo MIME');
  assert.equal(validarArquivoBase64({ base64: null }).ok, true, 'sem arquivo');
  const html = 'data:text/html;charset=utf-8,' + encodeURIComponent('<script>alert(1)</script>');
  assert.equal(validarArquivoBase64({ nomeArquivo: 'Contrato.html', mime: 'text/html', base64: html }).code, 'FILE_TYPE_BLOCKED');
  assert.equal(validarArquivoBase64({ nomeArquivo: 'a.svg', mime: 'image/svg+xml', base64: b64('<svg/>') }).ok, false);
  assert.equal(validarArquivoBase64({ nomeArquivo: 'falso.pdf', mime: 'application/pdf', base64: b64('<html><script>x</script>') }).code, 'FILE_CONTENT_BLOCKED');
  assert.equal(validarArquivoBase64({ nomeArquivo: 'falso.png', mime: 'image/png', base64: pdf }).code, 'FILE_CONTENT_MISMATCH');
  assert.equal(validarArquivoBase64({ nomeArquivo: 'virus.exe.pdf', mime: 'application/pdf', base64: pdf }).ok, false, 'extensão oculta');
  assert.equal(validarArquivoBase64({ nomeArquivo: 'x.pdf', mime: 'text/plain', base64: pdf }).code, 'FILE_TYPE_MISMATCH');
  assert.equal(validarArquivoBase64({ nomeArquivo: 'grande.pdf', mime: 'application/pdf', base64: 'A'.repeat(21 * 1024 * 1024) }).code, 'FILE_TOO_LARGE');
  assert.equal(validarArquivoBase64({ nomeArquivo: 'planilha.csv', mime: 'text/csv', base64: b64('a;b\n1;2') }).ok, true);
  const mut = read('api/_db-mutations.js'); const sync = read('api/_db-sync.js');
  assert(mut.includes('validarArquivoBase64({ nomeArquivo: doc.nome_arquivo || doc.titulo') && mut.includes('arquivo_recusado: true'));
  assert(sync.includes('validarArquivoBase64({ nomeArquivo: doc.nome_arquivo || doc.titulo'));
  assert.equal(mut, read('backend/domains/database/_db-mutations.js'));
  assert.equal(sync, read('backend/domains/database/_db-sync.js'));
  assert.equal(read('api/_file-validation.js'), read('backend/domains/database/_file-validation.js'));
  console.log('  ✓ #31 Arquivo em base64 no save/sync validado como no /api/upload');
}

// #32 — newsletter com confirmação por e-mail e descadastro só pelo link assinado.
{
  process.env.SESSION_SIGNING_SECRET = process.env.SESSION_SIGNING_SECRET || 'teste-newsletter-segredo-de-sessao-com-mais-de-32-chars';
  const pg = new PGlite();
  const nsql = async (strings, ...values) => { let t = strings[0]; values.forEach((_, k) => { t += `$${k + 1}` + strings[k + 1]; }); return (await pg.query(t, values)).rows; };
  await pg.exec(read('migrations/033_newsletter_subscriptions.sql').replace(/REVOKE[^;]*;/g, ''));
  await pg.exec(read('migrations/041_newsletter_double_opt_in.sql'));
  const { handleV2Newsletter, assinarLinkNewsletter, verificarLinkNewsletter } = await import('../api/_v2-routes.js');
  const emails = [];
  const deps = { sql: nsql, sendEmail: async (_s, m) => { emails.push(m); return { success: true }; } };
  const call = (url, opts) => chamar((req, res) => handleV2Newsletter({ ...req, url }, res, deps), opts);
  const alvo = 'vitima@exemplo.com.br';
  let r = await call('/api/v2/public/newsletter/subscribe', { body: { email: alvo } });
  assert.equal(r.body.action, 'confirmation_sent');
  assert.equal((await nsql`SELECT status FROM newsletter_subscriptions WHERE email = ${alvo}`)[0].status, 'pending', 'só pendente até confirmar');
  assert.equal(emails.length, 1); assert(emails[0].ctaUrl.includes('/newsletter/confirm?'));
  await call('/api/v2/public/newsletter/subscribe', { body: { email: alvo } });
  assert.equal(emails.length, 1, 'não reenvia antes de 10 min');
  const link = new URL(emails[0].ctaUrl);
  const q = Object.fromEntries(link.searchParams);
  r = await call(link.pathname + link.search, { method: 'GET', query: { ...q, sig: q.sig.slice(0, -2) + 'xx' } });
  assert.equal(r.status, 302); assert(r.headers.location.includes('newsletter=invalido'));
  r = await call(link.pathname + link.search, { method: 'GET', query: q });
  assert(r.headers.location.includes('newsletter=confirmado'));
  assert.equal((await nsql`SELECT status FROM newsletter_subscriptions WHERE email = ${alvo}`)[0].status, 'subscribed');
  // Terceiro tenta descadastrar só com o e-mail: nada muda, o link vai para o dono.
  await nsql`UPDATE newsletter_subscriptions SET confirmation_sent_at = NULL`;
  r = await call('/api/v2/public/newsletter/unsubscribe', { body: { email: alvo } });
  assert.equal(r.body.action, 'unsubscribe_link_sent'); assert(!JSON.stringify(r.body).includes(alvo), 'não ecoa o e-mail');
  assert.equal((await nsql`SELECT status FROM newsletter_subscriptions WHERE email = ${alvo}`)[0].status, 'subscribed');
  const sair = new URL(emails.at(-1).ctaUrl);
  r = await call(sair.pathname, { method: 'GET', query: Object.fromEntries(sair.searchParams) });
  assert(r.headers.location.includes('newsletter=cancelado'));
  assert.equal((await nsql`SELECT status FROM newsletter_subscriptions WHERE email = ${alvo}`)[0].status, 'unsubscribed');
  // Link de confirmação não serve para descadastrar (e vice-versa) e expira.
  const exp = Date.now() + 1000;
  assert.equal(verificarLinkNewsletter('unsubscribe', alvo, exp, assinarLinkNewsletter('confirm', alvo, exp, 'k'), { key: 'k' }), false);
  assert.equal(verificarLinkNewsletter('confirm', alvo, exp, assinarLinkNewsletter('confirm', alvo, exp, 'k'), { key: 'k', now: exp + 1 }), false);
  r = await call('/api/v2/public/newsletter/subscribe', { method: 'GET', query: { email: alvo } });
  assert.equal(r.status, 405);
  await pg.close();
  assert.equal(read('api/_v2-routes.js'), read('backend/domains/edge/_v2-routes.js'));
  assert.equal(read('marketing/src/brand-sections.jsx'), read('marketing/brand-sections.jsx'));
  console.log('  ✓ #32 Newsletter: inscrição só após confirmar pelo e-mail; descadastro só pelo link assinado');
}

// #33 — erros internos não vão para o cliente.
{
  const v2 = read('api/_v2-routes.js');
  assert(!/json\(\{ success: false, error: err\.message \}\)/.test(v2.replace("if (OCR_ERROS_PUBLICOS.includes(err?.message)) return res.status(400).json({ success: false, error: err.message });", '')), 'v2 sem err.message bruto');
  assert(!read('api/nfe.js').includes('${errDFe.message'));
  const dfe = read('api/_sefaz-dfe.js');
  assert(!dfe.includes('${errNet.message}') && !dfe.includes("+ errNet.message") && !dfe.includes('erro: err.message'));
  assert(read('api/assinaturas.js').includes("mensagensPublicas.includes(err?.message) ? err.message : 'Não foi possível ler o PDF.'"));
  for (const [a, b] of [['api/nfe.js', 'backend/domains/fiscal/nfe.js'], ['api/assinaturas.js', 'backend/domains/financeiro/assinaturas.js'], ['api/_v2-routes.js', 'backend/domains/edge/_v2-routes.js'], ['api/_sefaz-dfe.js', 'backend/domains/fiscal/_sefaz-dfe.js']]) assert.equal(read(a), read(b), b);
  console.log('  ✓ #33 Erros internos (DF-e, SEFAZ, IA, OCR, busca, ledger, verificação de PDF) ficam no log');
}

// #34 — OCR v2 não inventa dados e não explode a memória.
{
  const { runEdgeDocumentOcr } = await import('../api/_edge-ai.js');
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const semIA = await runEdgeDocumentOcr({}, png);
  assert.equal(semIA.success, false); assert.equal(semIA.data, undefined, 'sem dados inventados');
  const iaQuebrada = await runEdgeDocumentOcr({ AI: { run: async () => ({ response: 'não consegui ler' }) } }, png);
  assert.equal(iaQuebrada.success, false, 'resposta sem JSON vira falha');
  let recebido;
  const ok = await runEdgeDocumentOcr({ AI: { run: async (_m, input) => { recebido = input.image; return { response: '{"valor": 10}' }; } } }, png);
  assert.equal(typeof recebido, 'string'); assert(recebido.startsWith('data:image/png;base64,'), 'imagem vai como data URL');
  assert.equal(ok.data.fornecedor, null, 'não inventa fornecedor');
  await assert.rejects(() => runEdgeDocumentOcr({}, Buffer.from('%PDF-1.7').toString('base64')), /não suportado/);
  await assert.rejects(() => runEdgeDocumentOcr({}, 'A'.repeat(14 * 1024 * 1024)), /10 MB/);
  assert(!read('api/_edge-ai.js').includes('Array.from('));
  assert.equal(read('api/_edge-ai.js'), read('backend/domains/edge/_edge-ai.js'));
  console.log('  ✓ #34 OCR v2: falha honesta em vez de dados inventados; imagem como data URL, com limite de 10 MB');
}

// #35 — Replay do Sentry fora do bundle principal.
{
  const entry = read('scripts/sentry-entry.js');
  assert(!entry.includes('import * as Sentry') && !entry.includes('replayIntegration'), 'bundle principal sem Replay');
  assert(entry.includes("script.src = '/js/sentry-replay.js'") && entry.includes('(app|master)'));
  assert(read('scripts/sentry-replay-entry.js').includes('window.Sentry.addIntegration(replayIntegration())'));
  const { gzipSync } = await import('node:zlib');
  assert(gzipSync(fs.readFileSync('js/sentry.js')).length < 80 * 1024, 'sentry.js abaixo de 80 KB gzip');
  assert(fs.existsSync('js/sentry-replay.js'));
  for (const f of ['sentry.js', 'sentry-replay.js']) assert.equal(read(`js/${f}`), read(`frontend/core/${f}`), f);
  const build = read('scripts/build-cloudflare-pages.cjs');
  assert(build.includes("'sentry-replay-entry.js'") && build.includes("'sentry-replay.js'"));
  console.log('  ✓ #35 Sentry: 143 KB → 55 KB gzip em toda página; Replay sob demanda só no app e no master');
}

// #36/#37 — dependências e índices.
{
  const pkg = JSON.parse(read('package.json')); const back = JSON.parse(read('backend/package.json'));
  assert(!pkg.dependencies['@sentry/node'], '@sentry/node só no backend');
  for (const d of ['@sentry/browser', 'react', 'react-dom', 'esbuild']) assert(pkg.devDependencies[d] && !pkg.dependencies[d], `${d} é dependência de build`);
  assert.equal(pkg.dependencies['@neondatabase/serverless'], back.dependencies['@neondatabase/serverless'], 'mesmo driver do Neon no Worker e no Render');
  const m42 = read('migrations/042_audit_logs_indice_delta.sql');
  assert(m42.includes('ON audit_logs (tenant_id, entidade, created_at DESC) INCLUDE (entidade_id)') && !/DROP/i.test(m42.replace(/--.*$/gm, '')), '042 só aditiva');
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE audit_logs (id text primary key, tenant_id text, entidade text, entidade_id text, user_id text, created_at timestamptz default now());
    CREATE INDEX idx_audit_tenant_created ON audit_logs (tenant_id, created_at DESC);
    CREATE TABLE lancamentos (id text primary key, tenant_id text, obra_id text, status text, data date, data_vencimento date);
    CREATE INDEX idx_lancamentos_obra ON lancamentos (obra_id); CREATE INDEX idx_lancamentos_tenant ON lancamentos (tenant_id);`);
  await pg.exec(m42); await pg.exec(m42);
  await pg.exec(read('migrations/043_lancamentos_indices_redundantes.sql')); await pg.exec(read('migrations/043_lancamentos_indices_redundantes.sql'));
  const idx = (await pg.query(`SELECT indexname FROM pg_indexes WHERE tablename IN ('audit_logs','lancamentos')`)).rows.map(r => r.indexname);
  assert(idx.includes('idx_audit_logs_tenant_entidade_created') && !idx.includes('idx_lancamentos_obra') && !idx.includes('idx_audit_tenant_created'));
  await pg.close();
  console.log('  ✓ #36/#37 Dependências no grupo certo, driver do Neon alinhado, índice do delta e remoção dos redundantes (idempotentes)');
}

// #38–#40 — restos sem uso, parcela da Caixa e PII/timeout.
{
  for (const f of ['js/data_demo.js', 'frontend/core/data_demo.js', 'js/recovery-account-ux.js', 'frontend/core/recovery-account-ux.js']) assert(!fs.existsSync(f), `${f} removido`);
  for (const f of ['app.html', 'frontend/app.html']) assert(!read(f).includes('data_demo.js'), `${f} sem data_demo`);
  const ct = read('js/contratos.js');
  assert(!ct.includes('ent * 0.75'), 'sem 75% automático');
  assert(ct.includes("Informe a parcela paga na assinatura da Caixa (cláusula 08)."), 'salvar continua exigindo a parcela');
  assert.equal(ct, read('frontend/domains/contratos/contratos.js'));
  const server = read('backend/server.js');
  assert(!server.includes('enviado para ${destPhone}') && !server.includes('enviado para ${destEmail}') && !server.includes('Mensagem recebida de ${parsed.phone}'));
  const helpers = server.slice(server.indexOf('function mascararTelefone'), server.indexOf('function mascararEmail') + 400);
  const mt = new Function(helpers.slice(0, helpers.indexOf('function mascararEmail')) + 'return mascararTelefone;')();
  const trechoEmail = helpers.slice(helpers.indexOf('function mascararEmail'));
  const me = new Function(trechoEmail.slice(0, trechoEmail.indexOf('\n}') + 2) + '\nreturn mascararEmail;')();
  assert.equal(mt('+55 (95) 99123-4567'), '***4567'); assert.equal(me('financeiro@construtora.com.br'), 'fi***@construtora.com.br');
  for (const f of ['backend/server.js', 'api/_admin-route.js', 'api/_email_service.js', 'api/_webhook_pix_core.js', 'api/auth.js', 'api/users.js']) {
    const src = read(f); let i = -1;
    while ((i = src.indexOf("fetch('https://api.resend.com/emails'", i + 1)) >= 0) {
      const bloco = src.slice(i, src.indexOf('});', i));
      assert(bloco.includes('signal: AbortSignal.timeout('), `${f}: fetch do Resend com timeout`);
    }
  }
  assert.equal(read('api/_email_service.js'), read('backend/domains/integrations/_email_service.js'));
  console.log('  ✓ #38–#40 Arquivos mortos removidos, parcela da Caixa sem 75% inventado, logs sem telefone/e-mail inteiros e Resend com timeout');
}

// Pós-auditoria (06/10, log do navegador): anexo no R2, NF-e só com resumo e DANFE fora da Área do Cliente.
{
  const docs = read('js/documentos.js');
  assert(docs.includes("if (raw.startsWith('r2://')) return `/api/v2/edge/storage/file/${encodeURIComponent(raw.slice('r2://'.length))}`;"));
  assert(docs.includes(': this._urlDeLeitura(doc.url);') && docs.includes(': this._urlDeLeitura(json.url);'), 'r2:// nunca vai cru para o navegador');
  const parser = read('js/nfe_parser.js');
  assert(parser.includes('if (resNFe) return this._parseResumo(resNFe, get);') && parser.includes('resumo: true,'));
  const nfe = read('js/nfe.js');
  assert(nfe.includes("await FinObraAssets.load('danfe');"), 'DANFE gerado a partir do XML, sem MeuDanfe');
  assert(nfe.includes("if (resumoDfe) return { status: 'OK', data: resumoDfe, resumo: true };"), 'XML completo tem preferência sobre o resumo');
  for (const [a, b] of [['js/documentos.js', 'frontend/domains/contratos/documentos.js'], ['js/nfe.js', 'frontend/domains/fiscal/nfe.js'], ['js/nfe_parser.js', 'frontend/domains/fiscal/nfe_parser.js']]) assert.equal(read(a), read(b), b);
  console.log('  ✓ Pós-auditoria: anexo do R2 abre pela rota autenticada; NF-e com resumo preenche emitente e valor; DANFE busca a nota antes');
}

// Pós-auditoria: produtos da NF-e entram no controle de compras.
{
  const nfe = read('js/nfe.js');
  assert(nfe.includes("itens: i === 0 ? itensNota : [],") && nfe.includes('itens: itensNota,'), 'itens no 1º lançamento e na nota');
  assert(nfe.includes('Produtos.encontrarOuCriar(it.nome, unidade'), 'produto cadastrado/encontrado no módulo Produtos');
  assert(nfe.includes('action=dfe_xml_completo'), 'XML completo pela SEFAZ (ciência + consulta pela chave)');
  assert(nfe.includes('async puxarProdutosDoLancamento(lancId)'));
  assert(read('js/lancamentos.js').includes('data-fb-click="NFe.puxarProdutosDoLancamento"'));
  assert(read('js/patch26-events.js').includes('"NFe.puxarProdutosDoLancamento"'));
  for (const [a, b] of [['js/nfe.js', 'frontend/domains/fiscal/nfe.js'], ['js/lancamentos.js', 'frontend/domains/financeiro/lancamentos.js'], ['js/patch26-events.js', 'frontend/core/patch26-events.js']]) assert.equal(read(a), read(b), b);
  console.log('  ✓ Pós-auditoria: produtos da NF-e no lançamento, na nota e no controle de Produtos; botão para despesas antigas');
}

// SEFAZ sem MeuDanfe: ciência da operação assinada, XML completo pela chave, DANFE local e fornecedor.
{
  const zlib = await import('node:zlib');
  const nodeCrypto = await import('node:crypto');
  const { extrairChaveECertificadoDoPfx } = await import('../api/_certificado.js');
  const dfe = await import('../api/_sefaz-dfe.js');
  // Certificado A1 de teste gerado na hora (autoassinado, senha "Senha123"): nenhuma chave privada
  // fica no repositório.
  const os = await import('node:os'); const path = await import('node:path');
  const dirCert = fs.mkdtempSync(path.join(os.tmpdir(), 'fingo-a1-'));
  const resolveOpenSsl = () => {
    const probe = spawnSync('openssl', ['version'], { stdio: 'pipe' });
    if (!probe.error && probe.status === 0) return 'openssl';
    if (process.platform === 'win32') {
      const gitProbe = spawnSync('where', ['git'], { stdio: 'pipe', encoding: 'utf8' });
      if (!gitProbe.error && gitProbe.stdout) {
        for (const line of gitProbe.stdout.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed) {
            const candidate = path.resolve(path.dirname(trimmed), '..', 'usr', 'bin', 'openssl.exe');
            if (fs.existsSync(candidate)) return candidate;
          }
        }
      }
      for (const p of ['D:\\Git\\usr\\bin\\openssl.exe', 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe', 'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe']) {
        if (fs.existsSync(p)) return p;
      }
    }
    return 'openssl';
  };
  const opensslBin = resolveOpenSsl();
  const openssl = (args) => spawnSync(opensslBin, args, { cwd: dirCert, stdio: 'pipe' });
  openssl(['req', '-x509', '-newkey', 'rsa:2048', '-keyout', 'k.pem', '-out', 'c.pem', '-days', '2', '-nodes', '-subj', '/CN=EMPRESA TESTE:12345678000195']);
  openssl(['pkcs12', '-export', '-inkey', 'k.pem', '-in', 'c.pem', '-out', 'a1.pfx', '-passout', 'pass:Senha123']);
  const pfx = fs.readFileSync(path.join(dirCert, 'a1.pfx'));
  fs.rmSync(dirCert, { recursive: true, force: true });
  const { privateKey, certDer, cert } = extrairChaveECertificadoDoPfx(pfx, 'Senha123');
  assert.throws(() => extrairChaveECertificadoDoPfx(pfx, 'errada'), /chave privada/);
  const chave = '14261010159093000236550010009028961848516750';
  const env = dfe.montarEnvEventoCiencia({ cnpj: '12345678000195', chave, privateKey, certDer, idLote: 1, now: new Date('2026-10-06T15:00:00Z') });
  assert(env.includes(`<infEvento Id="ID210210${chave}01">`) && env.includes('<tpEvento>210210</tpEvento>') && env.includes('<descEvento>Ciencia da Operacao</descEvento>'));
  assert(env.includes('<dhEvento>2026-10-06T11:59:00-03:00</dhEvento>'), 'horário de Brasília, 1 min atrás');
  // Confere a assinatura: digest do infEvento canônico e RSA-SHA1 sobre o SignedInfo canônico.
  const canonInf = env.match(/<infEvento[\s\S]*?<\/infEvento>/)[0].replace('<infEvento ', '<infEvento xmlns="http://www.portalfiscal.inf.br/nfe" ');
  assert.equal(env.match(/<DigestValue>([^<]+)/)[1], nodeCrypto.createHash('sha1').update(canonInf).digest('base64'));
  const signedInfo = env.match(/<SignedInfo>[\s\S]*?<\/SignedInfo>/)[0].replace('<SignedInfo>', '<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">');
  assert(nodeCrypto.verify('sha1', Buffer.from(signedInfo), cert.publicKey, Buffer.from(env.match(/<SignatureValue>([^<]+)/)[1], 'base64')), 'assinatura RSA-SHA1 válida');
  assert.deepEqual(dfe.interpretarRetornoEvento('<retEnvEvento><cStat>128</cStat><retEvento><infEvento><cStat>135</cStat><xMotivo>Evento registrado</xMotivo></infEvento></retEvento></retEnvEvento>'), { ok: true, cStat: '135', xMotivo: 'Evento registrado' });
  assert.equal(dfe.interpretarRetornoEvento('<retEnvEvento><cStat>128</cStat><retEvento><infEvento><cStat>573</cStat></infEvento></retEvento></retEnvEvento>').ok, true, 'duplicidade = já tinha ciência');
  assert.equal(dfe.interpretarRetornoEvento('<retEnvEvento><cStat>128</cStat><retEvento><infEvento><cStat>596</cStat></infEvento></retEvento></retEnvEvento>').ok, false);

  // Banco: resumo → ciência → XML completo pela chave; resumo atrasado não apaga o completo.
  const pg = new PGlite();
  const psql = async (strings, ...values) => { let t = strings[0]; values.forEach((_, k) => { t += `$${k + 1}` + strings[k + 1]; }); return (await pg.query(t, values)).rows; };
  await pg.exec(`CREATE TABLE IF NOT EXISTS tenants (id varchar(100) primary key, uf text); INSERT INTO tenants VALUES ('t1','RR');
    CREATE TABLE IF NOT EXISTS schema_migrations (version text primary key, applied_at timestamptz default now(), checksum text, execution_time_ms int);`);
  await pg.exec(read('migrations/035_tenant_dfe_monitor.sql').replace(/ALTER TABLE[^;]*ENABLE ROW LEVEL SECURITY;|CREATE POLICY[\s\S]*?;|GRANT[^;]*;|REVOKE[^;]*;/g, ''));
  const resumo = `<resNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><chNFe>${chave}</chNFe><CNPJ>10159093000236</CNPJ><xNome>CASA DO CONSTRUTOR</xNome><dhEmi>2026-10-02T11:17:43-04:00</dhEmi><vNF>1030.75</vNF><cSitNFe>1</cSitNFe></resNFe>`;
  const completoXml = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chave}"><emit><CNPJ>10159093000236</CNPJ><xNome>CASA DO CONSTRUTOR</xNome></emit><det nItem="1"><prod><xProd>CIMENTO</xProd></prod></det><total><ICMSTot><vNF>1030.75</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>${chave}</chNFe></infProt></protNFe></nfeProc>`;
  const zip = (xml, schema, nsu) => ({ nsu, schema, base64Content: zlib.gzipSync(Buffer.from(xml)).toString('base64') });
  await dfe.upsertDfeDocumento(psql, 't1', dfe.decompressAndParseDocZip(zip(resumo, 'resNFe_v1.01.xsd', '1')));
  const enviadas = [];
  const enviar = async ({ chave: c }) => { enviadas.push(c); return { ok: true, cStat: '135' }; };
  const n = await dfe.darCienciaPendentes(psql, 't1', { pfxBuffer: pfx, passphrase: 'Senha123', cnpj: '12345678000195', enviar });
  assert.equal(n, 1); assert.deepEqual(enviadas, [chave]);
  assert.equal((await psql`SELECT manifesto_status FROM tenant_dfe_documentos WHERE chave = ${chave}`)[0].manifesto_status, 'ciencia');
  assert.equal(await dfe.darCienciaPendentes(psql, 't1', { pfxBuffer: pfx, passphrase: 'Senha123', cnpj: '1', enviar }), 0, 'não repete a ciência');
  const consultas = [];
  const r = await dfe.obterXmlCompletoNFe(psql, 't1', chave, { cert: { pfxBuffer: pfx, passphrase: 'Senha123', cnpj: '12345678000195' }, enviar, consultar: async (a) => { consultas.push(a); return { cStat: '138', docZipList: [zip(completoXml, 'procNFe_v4.00.xsd', '2')] }; } });
  assert.equal(r.completo, true); assert(r.xml.includes('<xProd>CIMENTO</xProd>'));
  assert.equal(consultas[0].chave, chave); assert.equal(consultas[0].codUf, '14');
  assert.equal(enviadas.length, 1, 'ciência já registrada não é reenviada');
  await dfe.upsertDfeDocumento(psql, 't1', dfe.decompressAndParseDocZip(zip(resumo, 'resNFe_v1.01.xsd', '3')));
  assert((await psql`SELECT xml_completo FROM tenant_dfe_documentos WHERE chave = ${chave}`)[0].xml_completo.includes('<infNFe'), 'resumo atrasado não troca o XML completo');
  // Marcação de "já lançada" (migração 044): marca, aparece na lista, desmarca.
  await pg.exec(read('migrations/044_dfe_documentos_lancada.sql'));
  const m1 = await dfe.marcarDFeLancada(psql, 't1', { chave, lancada: true, manual: true, userId: 'u1' });
  assert(m1.documento.lancada_em && m1.documento.lancada_manual === true);
  const lista = await dfe.listarDFeDocumentos(psql, 't1', {});
  assert(lista.documentos[0].lancada_em, 'lista devolve a marcação');
  const m2 = await dfe.marcarDFeLancada(psql, 't1', { chave, lancada: false });
  assert.equal(m2.documento.lancada_em, null);
  assert.equal((await dfe.marcarDFeLancada(psql, 't1', { chave: '123' })).success, false);
  const pend = await dfe.obterXmlCompletoNFe(psql, 't1', '1'.repeat(44), { cert: {}, enviar, consultar: async () => ({ cStat: '137' }) });
  assert.equal(pend.success, false); assert.match(pend.error, /não encontrada na SEFAZ/);
  await pg.close();

  const nfeSrv = read('api/nfe.js');
  assert(nfeSrv.includes("if (action === 'dfe_xml_completo') {") && nfeSrv.includes("canAccessModule(auth, 'notas', 'write')"));
  const nfeCli = read('js/nfe.js');
  assert(nfeCli.includes("await FinObraAssets.load('danfe');") && !nfeCli.includes('try { await this.buscarPorChave(chave); }') && !nfeCli.includes('await this.buscarPorChave(chave);\n        res = await pedirXml();'), 'sem busca paga automática no MeuDanfe');
  assert(nfeCli.includes('action=dfe_xml_completo'));
  assert(read('js/assets.js').includes("danfe: { src:'/js/danfe_simplificado.js"));
  const forn = read('js/fornecedores.js');
  assert(forn.includes("const campos = ['telefone', 'email', 'endereco', 'numero', 'bairro', 'municipio', 'uf', 'cep', 'ie'];"), 'completa só campos vazios');
  assert(nfeCli.includes('_acoesLancamento(chave, doc = null)') && nfeCli.includes('this._registrarLancadaNoServidor(chave);') && nfeCli.includes("Utils.toast('Esta NF-e já foi lançada. Use \"Ver lançamento\" para abrir a despesa.', 'warning');"));
  assert(!/data-fb-click="NFe\.gerarLancamentoDaNFe"[^`]*⚡ Lançar<\/button>\n\s*<button class="btn btn-sm btn-primary" data-fb-click="NFe\.abrirDanfe"/.test(nfeCli), 'listas usam o botão que sabe se a nota já foi lançada');
  assert(read('api/nfe.js').includes("if (action === 'dfe_marcar_lancada') {"));
  for (const a of ['NFe.verLancamentoDaNFe', 'NFe.marcarComoLancada', 'NFe._toggleOcultarLancadas']) assert(read('js/patch26-events.js').includes(`"${a}"`), a);
  assert(read('js/notas.js').includes('webkitdirectory') && read('js/patch26-events.js').includes('"Notas.triggerXmlFolderImport"'));
  for (const [a, b] of [['api/_sefaz-dfe.js', 'backend/domains/fiscal/_sefaz-dfe.js'], ['api/_certificado.js', 'backend/domains/fiscal/_certificado.js'], ['api/nfe.js', 'backend/domains/fiscal/nfe.js'], ['js/nfe.js', 'frontend/domains/fiscal/nfe.js'], ['js/nfe_parser.js', 'frontend/domains/fiscal/nfe_parser.js'], ['js/danfe_simplificado.js', 'frontend/domains/fiscal/danfe_simplificado.js'], ['js/fornecedores.js', 'frontend/domains/suprimentos/fornecedores.js'], ['js/notas.js', 'frontend/domains/fiscal/notas.js'], ['js/assets.js', 'frontend/core/assets.js']]) assert.equal(read(a), read(b), b);
  console.log('  ✓ SEFAZ sem MeuDanfe: ciência assinada, XML completo pela chave, DANFE local, fornecedor completado e pasta de XMLs');
}

await db.close();
console.log('\n✅ Auditoria 04/10/2026: tudo certo.');
