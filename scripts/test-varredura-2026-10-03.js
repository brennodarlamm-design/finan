// scripts/test-varredura-2026-10-03.js
// Regressões da varredura geral de 03/10/2026 (docs/VARREDURA_SISTEMA_2026-10-03.md).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { EvolutionGoClient } from '../backend/domains/atendimento/evolution_client.js';
import { createCriticalR2Backup } from '../api/_edge-backup.js';

const read = (file) => fs.readFileSync(file, 'utf8');

console.log('=== Varredura 03/10/2026: correções rápidas ===\n');

// #13 — Resumo diário: interpolação dentro de comentário SQL vira parâmetro e derruba a query.
{
  const server = read('backend/server.js');
  const sqlTemplates = server.match(/sql`[\s\S]*?`/g) || [];
  for (const tpl of sqlTemplates) {
    assert(!/--[^\n]*\$\{/.test(tpl), `comentário SQL com interpolação: ${tpl.slice(0, 80)}`);
  }
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE lancamentos (id text, tenant_id text, tipo text, status text, obra_id text, data date, data_vencimento date);
      CREATE TABLE obras (id text, tenant_id text, nome text);
      INSERT INTO lancamentos VALUES ('l1','t1','despesa','a_pagar','o1','2026-10-01','2026-10-02');`);
    // Mesma forma da query do cron depois da correção ($1 = tenant, $2 = hoje).
    const rows = await db.query(`SELECT l.*, o.nome as obra_nome FROM lancamentos l LEFT JOIN obras o ON l.obra_id = o.id AND l.tenant_id = o.tenant_id
      WHERE l.tipo = 'despesa' AND l.tenant_id = $1 AND l.status IN ('a_pagar','pendente','em_atraso')
      AND (DATE(COALESCE(l.data_vencimento, l.data)) <= $2::date)`, ['t1', '2026-10-03']);
    assert.equal(rows.rows.length, 1);
    // A forma antiga (parâmetro sobrando só no comentário) falha no Postgres.
    await assert.rejects(db.query(`SELECT 1 FROM lancamentos l WHERE l.tenant_id = $1 -- l.tenant_id = $2`, ['t1', 'x']));
  } finally { await db.close(); }
  console.log('  ✓ Resumo das 08h: sem interpolação em comentário SQL e query válida no Postgres');
}

// #14 — DDD 55 (RS) recebia mensagem sem o código do país.
{
  const client = new EvolutionGoClient({ baseUrl: 'http://x', apiKey: 'k' });
  assert.equal(client.normalizePhoneNumber('(55) 99123-4567'), '5555991234567');
  assert.equal(client.normalizePhoneNumber('(55) 3222-1234'), '555532221234');
  assert.equal(client.normalizePhoneNumber('(11) 99123-4567'), '5511991234567');
  assert.equal(client.normalizePhoneNumber('+55 (55) 99123-4567'), '5555991234567');
  assert.equal(client.normalizePhoneNumber('5511991234567'), '5511991234567');
  const files = ['api/whatsapp.js', 'api/auth.js', 'api/admin.js', 'api/_admin-route.js', 'api/_webhook_pix_core.js', 'js/master.js', 'js/whatsapp.js', 'backend/domains/atendimento/evolution_client.js'];
  for (const f of files) {
    const src = read(f);
    assert(!/startsWith\('55'\)\s*\?/.test(src), `${f}: código do país decidido por startsWith('55')`);
    assert(!/&&\s*!\w+\.startsWith\('55'\)/.test(src), `${f}: 10/11 dígitos não podem depender de startsWith('55')`);
  }
  console.log('  ✓ Telefone: DDD 55 recebe o código do país (backend, admin, PIX e telas)');
}

// #31 — Arrastar arquivos: inline bloqueado pelo CSP; o barramento precisa tratar dragover.
{
  for (const f of ['js/nfe.js', 'js/ocr.js', 'js/fases_doc.js', 'js/documentos.js', 'js/contratos.js']) {
    assert(!/\son(dragover|dragleave|drop)=/.test(read(f)), `${f}: handler de arrastar inline (bloqueado pelo CSP)`);
  }
  const listeners = {};
  const ctx = vm.createContext({
    console, globalThis: {},
    document: { addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); } }
  });
  ctx.globalThis = ctx;
  vm.runInContext(read('js/patch26-events.js'), ctx);
  const classes = new Set();
  const zone = { classList: { add: c => classes.add(c), remove: c => classes.delete(c) }, contains: () => false, getAttribute: () => null };
  let prevented = false;
  const ev = { target: { closest: sel => (sel === '[data-fb-drop]' ? zone : null) }, preventDefault() { prevented = true; } };
  listeners.dragover.forEach(fn => fn(ev));
  assert.equal(prevented, true, 'dragover em [data-fb-drop] chama preventDefault (senão o drop não dispara)');
  assert(classes.has('drag-over'));
  listeners.dragleave.forEach(fn => fn({ ...ev, relatedTarget: null }));
  assert(!classes.has('drag-over'));
  let fora = false;
  listeners.dragover.forEach(fn => fn({ target: { closest: () => null }, preventDefault() { fora = true; } }));
  assert.equal(fora, false, 'fora de uma área de soltar, o navegador segue o padrão');
  console.log('  ✓ Arrastar arquivos: dragover tratado pelo barramento em NF-e, OCR e Fases');
}

// #25 — Valor por extenso (recibos e contratos).
{
  const ctx = vm.createContext({ console, window: {}, document: { addEventListener() {} }, navigator: {}, localStorage: { getItem: () => null, setItem() {} } });
  vm.runInContext(`${read('js/utils.js')}\nglobalThis.U = Utils;`, ctx);
  const casos = {
    1: 'um real', 100: 'cem reais', 101: 'cento e um reais', 1000: 'mil reais', 1001: 'mil e um reais',
    1200: 'mil e duzentos reais', 1250: 'mil duzentos e cinquenta reais',
    1000000: 'um milhão de reais', 2500000: 'dois milhões e quinhentos mil reais',
    14504.52: 'quatorze mil quinhentos e quatro reais e cinquenta e dois centavos',
    0.01: 'um centavo', 0: 'zero reais'
  };
  for (const [v, esperado] of Object.entries(casos)) assert.equal(ctx.U.extenso(Number(v)), esperado, `extenso(${v})`);
  assert.equal(ctx.U.numeroExtenso(85), 'oitenta e cinco');
  assert.equal(read('js/utils.js'), read('frontend/core/utils.js'), 'utils.js espelhado');
  console.log('  ✓ Extenso: "mil" (não "um mil"), "um milhão de reais" e "e" entre grupos pela regra');
}

// #18 — Contrato não imprime valores de exemplo.
{
  const src = read('js/contratos.js');
  assert(!/14504\.52/.test(src), 'entrada de exemplo R$ 14.504,52 não pode ser usada');
  assert(!/\|\|\s*'R\$ 10\.978,13'/.test(src), 'parcela de exemplo não pode ser valor padrão');
  assert(!/\|\|\s*'?122000/.test(src) && !/area_m2 \|\| '?40/.test(src), 'valor e área de exemplo não podem ser padrão');
  assert(/Não há valor de entrada com recursos próprios/.test(src), 'cláusula 08 sem entrada');
  assert.equal(src, read('frontend/domains/contratos/contratos.js'), 'contratos.js espelhado');
  console.log('  ✓ Contrato: sem valores de exemplo; entrada 0 gera cláusula própria');
}


// ── Proteção de dados ─────────────────────────────────────────────────────────

// Ambiente de navegador compartilhado entre "abas": mesmo localStorage, IndexedDB em memória.
function navegador() {
  const store = new Map();
  const idb = new Map();
  const tabs = [];
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem(k, v) {
      const old = store.has(k) ? store.get(k) : null;
      v = String(v); store.set(k, v);
      // Como no navegador: o evento "storage" chega nas OUTRAS abas.
      for (const t of tabs) if (t.writer !== this.__tab) t.fire({ key: k, oldValue: old, newValue: v });
    },
    removeItem(k) { store.delete(k); },
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; }
  };
  const IDBStorage = {
    isAvailable: () => true,
    async getItem(k) { return idb.has(k) ? structuredClone(idb.get(k)) : null; },
    async setItem(k, v) { idb.set(k, structuredClone(v)); },
    async removeItem(k) { idb.delete(k); },
    async getAllKeys() { return [...idb.keys()]; }
  };
  function abrirAba(nome) {
    const listeners = {};
    const tabLS = Object.create(localStorage);
    tabLS.__tab = nome;
    tabLS.setItem = function (k, v) { localStorage.setItem.call({ __tab: nome }, k, v); };
    const ctx = vm.createContext({
      console, structuredClone, setTimeout, clearTimeout, Promise,
      localStorage: tabLS, IDBStorage,
      Auth: { getCurrentTenantId: () => 't1', canModule: () => true, getAuthHeaders: () => ({}) },
      navigator: { onLine: false },
      window: { addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); }, dispatchEvent() {} },
      CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail; } },
      crypto: { randomUUID: () => Math.random().toString(16).slice(2) + Date.now().toString(16) },
      document: { getElementById: () => null }
    });
    vm.runInContext(`${read('js/data.js')}\nglobalThis.DB = DB;`, ctx);
    const tab = { nome, writer: null, fire: ev => (listeners.storage || []).forEach(fn => fn(ev)), DB: ctx.DB, ctx };
    tabs.push(tab);
    return tab;
  }
  return { abrirAba, store, idb, localStorage };
}

{
  const src = read('js/data.js');
  assert.equal((src.match(/^  init\(\) \{/gm) || []).length, 1, 'DB.init definido uma única vez');
  const initBody = src.slice(src.indexOf('  init() {'), src.indexOf('  _bindNetworkListeners() {'));
  assert(/_hydrateFromIndexedDB\(\)/.test(initBody) && /_bindCrossTabChannel\(\)/.test(initBody), 'init lê o IndexedDB e liga a sincronia entre abas');
  assert(!/purgeStorage\(\)/.test(initBody), 'purgeStorage não roda em toda abertura');
  assert.equal(src, read('frontend/core/data.js'), 'data.js espelhado');

  // IndexedDB é lido de volta quando o localStorage perdeu a coleção.
  const nav = navegador();
  await nav.idb.set('finobra_t1_lancamentos', [{ id: 'salvo-no-idb', valor: 10 }]);
  const a = nav.abrirAba('A');
  a.DB._syncQueueKey = () => 'finobra_t1_sync_queue';
  a.DB.syncToCloud = () => true;
  a.DB.init();
  await a.DB._hydrationPromise;
  assert.deepEqual(JSON.parse(JSON.stringify(a.DB.getAll('lancamentos').map(l => l.id))), ['salvo-no-idb'], 'coleção recuperada do IndexedDB');
  console.log('  ✓ DB.init único: IndexedDB recuperado, sincronia entre abas ativa, sem purge na abertura');
}

{
  // Duas abas offline: a aba 1 (cache antigo) não pode apagar o que a aba 2 lançou.
  const nav = navegador();
  const t1 = nav.abrirAba('1'), t2 = nav.abrirAba('2');
  for (const t of [t1, t2]) { t.DB.canWriteLocal = () => true; t.DB.init(); await t.DB._hydrationPromise; t.DB._flushCloudQueue = async () => {}; t.DB._scheduleFlush = () => {}; }
  t1.DB.getAll('lancamentos'); t1.DB._getSyncQueue(); // aba 1 já tem tudo em memória
  t2.DB.add('lancamentos', { id: 'X', valor: 100 });
  t1.DB.add('lancamentos', { id: 'Y', valor: 200 });
  const final = JSON.parse(nav.store.get('finobra_t1_lancamentos'));
  assert.deepEqual(final.map(l => l.id).sort(), ['X', 'Y'], 'as duas abas mantêm seus lançamentos');
  const fila = JSON.parse(nav.store.get('finobra_t1_sync_queue') || '[]').map(q => q.payload?.data?.id).sort();
  assert.deepEqual(fila, ['X', 'Y'], 'fila de envio com os dois lançamentos');
  console.log('  ✓ Duas abas offline: nenhuma sobrescreve o lançamento nem a fila da outra');
}

{
  // Sessão expirada não apaga a fila offline; logout explícito apaga, mas nunca a de outra empresa.
  const nav = navegador();
  const ctx = vm.createContext({ console, localStorage: nav.localStorage, sessionStorage: { getItem: () => null, removeItem() {} }, window: {} });
  vm.runInContext(`${read('js/auth.js')}\nglobalThis.Auth = Auth;`, ctx);
  const Auth = ctx.Auth;
  const prepara = () => {
    nav.localStorage.setItem(Auth.SESSION_KEY, JSON.stringify({ tenantId: 't1' }));
    nav.localStorage.setItem('finobra_t1_sync_queue', JSON.stringify([{ queueId: 'q1' }]));
    nav.localStorage.setItem('finobra_t1_lancamentos', '[{"id":"a"}]');
    nav.localStorage.setItem('finobra_t2_sync_queue', JSON.stringify([{ queueId: 'q2' }]));
  };
  prepara();
  Auth.logoutSilently({ preservarFila: true });
  assert(nav.store.has('finobra_t1_sync_queue'), 'sessão expirada preserva a fila do tenant');
  assert(!nav.store.has('finobra_t1_lancamentos'), 'o cache comum continua sendo limpo');
  prepara();
  Auth.logoutSilently();
  assert(!nav.store.has('finobra_t1_sync_queue'), 'logout explícito (já confirmado) apaga a fila do tenant');
  assert(nav.store.has('finobra_t2_sync_queue'), 'fila pendente de outra empresa nunca é apagada');
  const auth = read('js/auth.js');
  assert(/handleSessionExpired\(\) \{\s*\/\/[^\n]*\n\s*this\.logoutSilently\(\{ preservarFila: true \}\)/.test(auth), 'handleSessionExpired preserva a fila');
  assert(/alteração\(ões\) ainda não enviada\(s\)/.test(auth), 'logout pede confirmação com alterações pendentes');
  assert(/logoutSilently\(\{ preservarFila: true \}\)/.test(read('js/login_page.js')), 'tela de login (expired=1) preserva a fila');
  console.log('  ✓ Logout/expiração: fila offline preservada, confirmação antes de descartar e filas de outras empresas intactas');
}

{
  // Restaurar backup passa pela fila de sincronização.
  const cfg = read('js/configuracoes.js');
  const bloco = cfg.slice(cfg.indexOf('  importarBackup(input) {'), cfg.indexOf('  async sincronizarTudoNeon()'));
  assert(/DB\.syncToCloud\('save', tabela, item\)/.test(bloco), 'restauração enfileira os registros para a nuvem');
  console.log('  ✓ Restaurar backup envia os registros pela fila (não é desfeito no próximo sync)');
}

{
  // Backup diário: tabelas reais e falha de uma tabela não aborta as demais.
  const lidas = [];
  const sqlFactory = () => ({
    query: async (q) => {
      const t = q.match(/FROM "([^"]+)"/)[1];
      lidas.push(t);
      if (t === 'ocr_historico') throw new Error('relation "ocr_historico" does not exist');
      return [{ id: 1 }];
    }
  });
  const puts = [];
  const bucket = { put: async (key, body) => { puts.push(key); return { size: body.byteLength ?? body.length }; } };
  const env = { BACKUP_ENCRYPTION_KEY: 'k'.repeat(40), DATABASE_URL: 'postgres://x', BACKUPS_R2: bucket };
  const manifest = await createCriticalR2Backup(env, { force: true, sqlFactory });
  assert(!lidas.includes('clientes') && !lidas.includes('contas'), 'não consulta tabelas inexistentes');
  for (const t of ['obras', 'contas_bancarias', 'notas_fiscais', 'precompras', 'recibos', 'obra_doc_fases', 'tenant_preferences']) assert(lidas.includes(t), `backup inclui ${t}`);
  assert.equal(manifest.ok, false);
  assert.deepEqual(manifest.failedTables, ['ocr_historico']);
  assert.equal(manifest.tables.lancamentos, 1, 'as outras tabelas foram copiadas');
  assert(puts.some(k => k.endsWith('snapshot.json.enc')), 'snapshot gravado mesmo com uma tabela falhando');
  assert.equal(read('api/_edge-backup.js'), read('backend/domains/edge/_edge-backup.js'), '_edge-backup espelhado');
  console.log('  ✓ Backup diário: tabelas reais (sem clientes/contas), inclui notas/pré-compras/recibos e tolera falha isolada');
}


{
  // Concorrência otimista em todas as tabelas (antes só em lançamentos).
  const { handleSave } = await import('../api/_db-mutations.js');
  const { handleSyncAll } = await import('../api/_db-sync.js');
  const { jsonPayload } = await import('../api/_db-normalizers.js');
  const db = new PGlite();
  await db.exec(`CREATE TABLE contratos (tenant_id text NOT NULL, id text NOT NULL, obra_id text, numero text, status text, payload jsonb, updated_at timestamptz DEFAULT now(), PRIMARY KEY (tenant_id, id));
    CREATE TABLE fornecedores (id text PRIMARY KEY, tenant_id text, nome text);`);
  const sql = async (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += `$${i + 1}` + strings[i + 1];
    return (await db.query(text, values)).rows;
  };
  const auth = { tenantId: 't1', user: { id: 'u1', perfil: 'admin' } };
  const call = async (data) => {
    let status = 200, body;
    const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; }, setHeader() {} };
    await handleSave(sql, 't1', auth, { headers: {} }, res, 'contratos', data);
    return { status, body };
  };
  const novo = await call({ id: 'c1', numero: '1', status: 'pendente' });
  assert.equal(novo.status, 200);
  assert(novo.body.sync_version, 'resposta traz a versão nova');
  const v1 = novo.body.sync_version;
  const edit = await call({ id: 'c1', numero: '1', status: 'assinado', sync_version: v1 });
  assert.equal(edit.status, 200, 'edição com a versão atual grava');
  const v2 = edit.body.sync_version;
  assert.notEqual(v2, v1);
  const velho = await call({ id: 'c1', numero: '1', status: 'cancelado', sync_version: v1 });
  assert.equal(velho.status, 409, 'versão antiga não sobrescreve a edição mais nova');
  assert.equal(velho.body.code, 'SYNC_CONFLICT');
  assert.equal((await db.query(`SELECT status FROM contratos WHERE id='c1'`)).rows[0].status, 'assinado');
  const payload = (await db.query(`SELECT payload FROM contratos WHERE id='c1'`)).rows[0].payload;
  assert(!('sync_version' in payload), 'a versão não fica gravada dentro do payload');
  await db.exec(`DELETE FROM contratos WHERE id='c1'`);
  const recriar = await call({ id: 'c1', numero: '1', status: 'pendente', sync_version: v2 });
  assert.equal(recriar.status, 409, 'registro excluído em outro aparelho não é recriado');
  assert.equal(recriar.body.deleted, true);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM contratos`)).rows[0].n, 0);

  // "Sincronizar tudo" com cache velho: não sobrescreve e devolve o conflito.
  await call({ id: 'c2', numero: '2', status: 'pendente' });
  const atual = (await db.query(`SELECT xmin::text AS v FROM contratos WHERE id='c2'`)).rows[0].v;
  await call({ id: 'c2', numero: '2', status: 'assinado', sync_version: atual });
  let syncStatus = 200, syncBody;
  const res = { status(c) { syncStatus = c; return this; }, json(b) { syncBody = b; return this; }, setHeader() {} };
  await handleSyncAll(sql, 't1', auth, { headers: {} }, res, { contratos: [{ id: 'c2', numero: '2', status: 'pendente', sync_version: atual }] });
  assert.equal((await db.query(`SELECT status FROM contratos WHERE id='c2'`)).rows[0].status, 'assinado', 'sync_all não volta para a versão velha');
  assert(JSON.stringify(syncBody).includes('SYNC_CONFLICT'), 'sync_all informa o conflito');

  // Leitura devolve a versão da linha, não a do payload.
  assert.equal(jsonPayload({ id: 'x', payload: { a: 1, sync_version: 'velha' }, sync_version: '99' }).sync_version, '99');
  await db.close();
  console.log('  ✓ Versão em todas as tabelas: edição velha recusada (409), excluído não volta, sync_all protegido');
}


{
  // Cursor do delta: hora do servidor no início do download, com 2 min de sobreposição.
  const nav = navegador();
  const aba = nav.abrirAba('cursor');
  const relogioServidor = Date.now() + 10 * 60 * 1000; // aparelho 10 min atrasado
  aba.DB._trackServerClock({ headers: { get: h => (h === 'date' ? new Date(relogioServidor).toUTCString() : null) } });
  const inicio = Date.now();
  const cursor = Date.parse(aba.DB._serverCursor(inicio));
  const esperado = relogioServidor - 2 * 60 * 1000;
  assert(Math.abs(cursor - esperado) < 2000, `cursor na hora do servidor menos 2 min (diferença ${cursor - esperado} ms)`);
  const src = read('js/data.js');
  assert(/this\.setSyncCursor\(this\._serverCursor\(inicioSnapshot\)\)/.test(src), 'sync completo usa o início do download');
  assert(/const nextCursor = new Date\(Date\.now\(\) - 2 \* 60 \* 1000\)/.test(read('api/_db-queries.js')), 'delta do servidor com sobreposição');
  console.log('  ✓ Delta sync: cursor no relógio do servidor, desde o início do download, com sobreposição de 2 min');
}


// ── OFX, NF-e e financeiro ────────────────────────────────────────────────────

function appCtx(modulos) {
  const store = new Map();
  const toasts = [];
  const ctx = vm.createContext({
    console, structuredClone, setTimeout, clearTimeout, Promise, URLSearchParams,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: i => [...store.keys()][i] ?? null, get length() { return store.size; } },
    Auth: { getCurrentTenantId: () => 't1', canModule: () => true },
    navigator: { onLine: false },
    window: { addEventListener() {}, dispatchEvent() {} },
    document: { getElementById: () => null, querySelector: () => null, addEventListener() {} },
    crypto: { randomUUID: () => Math.random().toString(16).slice(2) + Date.now().toString(16) },
    confirm: () => true,
    App: { obraId: 'todas', route: 'x' }
  });
  ctx.globalThis = ctx;
  vm.runInContext(`${read('js/utils.js')}\nglobalThis.Utils = Utils;`, ctx);
  vm.runInContext(`${read('js/data.js')}\nglobalThis.DB = DB;`, ctx);
  ctx.Utils.toast = (m, k) => toasts.push({ m, k });
  ctx.Utils.today = () => '2026-10-03';
  ctx.Utils.closeModal = () => {};
  ctx.Utils.showModal = () => {};
  ctx.DB.canWriteLocal = () => true;
  ctx.DB.syncToCloud = () => true;
  for (const [arq, nome] of modulos) vm.runInContext(`${read(arq)}\nglobalThis.${nome} = ${nome};`, ctx);
  return { ctx, toasts, plain: v => JSON.parse(JSON.stringify(v)) };
}

{
  const { ctx, toasts } = appCtx([['js/ofx.js', 'OFX']]);
  const { DB, OFX } = ctx;
  OFX.viewImport = () => {}; OFX.render = () => ''; OFX.init = () => {};
  DB.add('lancamentos', { id: 'P1', tipo: 'despesa', descricao: 'Parcela 1/3', valor: 500, data: '2026-09-10', data_vencimento: '2026-09-10', status: 'a_pagar' });
  DB.add('lancamentos', { id: 'P2', tipo: 'despesa', descricao: 'Parcela 2/3', valor: 500, data: '2026-09-17', data_vencimento: '2026-09-17', status: 'a_pagar' });
  const ofx = `<OFX><BANKID>341</BANKID><ACCTID>1234</ACCTID><DTSTART>20260901</DTSTART><DTEND>20260930</DTEND><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260910</DTPOSTED><TRNAMT>-500.00</TRNAMT><FITID>X1</FITID><MEMO>Pagamento</MEMO></STMTTRN></OFX>`;
  OFX._importData = OFX._parseOFX(ofx); OFX.processImport();
  const imp1 = DB.getAll('ofximports')[0];
  OFX._confirmarTodosMatchesRobo(imp1.id);
  assert.equal(DB.getById('lancamentos', 'P1').status, 'pago');
  OFX._importData = OFX._parseOFX(ofx); OFX.processImport();
  assert.equal(DB.getAll('ofximports').length, 1, 'mesmo extrato não é importado de novo');
  assert(toasts.some(t => /já foi importado/.test(t.m)));
  assert.equal(DB.getById('lancamentos', 'P2').status, 'a_pagar', 'parcela 2 não é "paga" por reimportação');
  // Desconciliar desfaz a baixa feita pela conciliação.
  OFX.desconciliar(imp1.id, 'X1');
  const p1 = DB.getById('lancamentos', 'P1');
  assert.equal(p1.status, 'a_pagar'); assert.equal(p1.conciliado, false); assert(!p1.data_pagamento);
  // Lote: só valor exato.
  DB.add('lancamentos', { id: 'Q', tipo: 'despesa', descricao: 'Cimento', valor: 95, data: '2026-09-20', data_vencimento: '2026-09-20', status: 'a_pagar' });
  const ofx2 = `<OFX><BANKID>341</BANKID><ACCTID>1234</ACCTID><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260920</DTPOSTED><TRNAMT>-100.00</TRNAMT><FITID>X2</FITID><MEMO>Cimento</MEMO></STMTTRN></OFX>`;
  OFX._importData = OFX._parseOFX(ofx2); OFX.processImport();
  const imp2 = DB.getAll('ofximports').find(i => i.transacoes.some(t => t.fitid === 'X2'));
  OFX._confirmarTodosMatchesRobo(imp2.id);
  assert.equal(DB.getById('lancamentos', 'Q').status, 'a_pagar', 'diferença de R$ 5 não é conciliada em lote');
  for (const f of ['js/lancamentos.js', 'js/escritorio.js']) assert(!/conciliado: true/.test(read(f)), `${f}: baixa manual não marca conciliado`);
  console.log('  ✓ OFX: reimportação bloqueada por FITID, lote só com valor exato, desconciliar reabre a conta, baixa manual não concilia');
}

{
  const { ctx, toasts } = appCtx([['js/produtos.js', 'Produtos'], ['js/nfe.js', 'NFe']]);
  const { DB, NFe } = ctx;
  NFe.baixarDanfePDF = async () => null;
  DB.add('contas', { id: 'cc1', apelido: 'Itaú Obra', banco_nome: 'Itaú' });
  const campos = { 'nfe-dest-obra': 'obra1', 'nfe-dest-conta': 'cc1', 'nfe-dest-valor': '15430.50', 'nfe-dest-venc': '2026-11-01', 'nfe-ja-pago': false };
  ctx.document.getElementById = id => (id in campos ? { value: campos[id], checked: campos[id] === true } : null);
  const chave = '13261012345678000199550010000012341000012345';
  ctx.window._tempNFeParsed = { chave, numero_nf: '1234', emitente: 'CIMENTOS LTDA', cnpj_emitente: '12.345.678/0001-99', data_emissao: '2026-10-01', valor_bruto: 15430.5,
    duplicatas: [{ numero: '001', vencimento: '2026-11-01', valor: 5143.5 }, { numero: '002', vencimento: '2026-12-01', valor: 5143.5 }, { numero: '003', vencimento: '2027-01-01', valor: 5143.5 }] };
  await Promise.all([NFe._confirmarGeracaoLancamento(chave), NFe._confirmarGeracaoLancamento(chave)]);
  const lancs = DB.getAll('lancamentos');
  assert.equal(lancs.length, 3, 'uma conta por duplicata e clique duplo não duplica');
  assert.deepEqual(JSON.parse(JSON.stringify(lancs.map(l => [l.valor, l.data_vencimento]))), [[5143.5, '2026-11-01'], [5143.5, '2026-12-01'], [5143.5, '2027-01-01']]);
  assert(lancs.every(l => l.conta_bancaria === 'Itaú Obra'), 'conta preenchida pelo apelido');
  assert.equal(DB.getAll('fornecedores')[0].cnpj, '12345678000199');
  await NFe._confirmarGeracaoLancamento(chave);
  assert.equal(DB.getAll('lancamentos').length, 3, 'NF-e já lançada não é lançada de novo');
  assert(toasts.some(t => /já foi lançada/.test(t.m)));
  assert(/status: jaPago \? 'paga' : 'pendente'/.test(read('js/nfe.js')), 'nota paga usa o status "paga"');
  console.log('  ✓ NF-e: uma conta por duplicata, sem duplicar por clique duplo ou relançamento, conta e fornecedor corretos');
}

{
  const { upsertDfeDocumento, decompressAndParseDocZip } = await import('../api/_sefaz-dfe.js');
  const zlib = await import('node:zlib');
  const ch = '13261012345678000199550010000012341000012345';
  const z = x => zlib.gzipSync(Buffer.from(x)).toString('base64');
  const nfe = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${ch}"><ide><dhEmi>2026-10-01T10:00:00-04:00</dhEmi></ide><emit><CNPJ>12345678000199</CNPJ><xNome>CIMENTOS LTDA</xNome></emit><total><ICMSTot><vNF>15430.50</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>${ch}</chNFe></infProt></protNFe></nfeProc>`;
  const ev = (tp, desc) => `<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe"><evento><infEvento><CNPJ>99888777000166</CNPJ><chNFe>${ch}</chNFe><dhEvento>2026-10-02T09:00:00-04:00</dhEvento><tpEvento>${tp}</tpEvento><detEvento><descEvento>${desc}</descEvento></detEvento></infEvento></evento></procEventoNFe>`;
  const db = new PGlite();
  await db.exec(`CREATE TABLE tenant_dfe_documentos (id text, tenant_id text, tipo_documento text, nsu text, chave text, cnpj_emitente text, nome_emitente text, valor_total numeric, data_emissao timestamptz, situacao text, schema_tipo text, xml_completo text, danfe_url text, manifesto_status text, updated_at timestamptz, UNIQUE(tenant_id, chave))`);
  const sql = async (strings, ...values) => { let t = strings[0]; values.forEach((_, i) => { t += `$${i + 1}` + strings[i + 1]; }); return (await db.query(t, values)).rows; };
  const doc = async () => (await db.query(`SELECT tipo_documento, nome_emitente, valor_total::float AS v, situacao, left(xml_completo, 8) AS x FROM tenant_dfe_documentos`)).rows[0];
  await upsertDfeDocumento(sql, 't1', decompressAndParseDocZip({ nsu: '1', schema: 'procNFe_v4.00.xsd', base64Content: z(nfe) }));
  await upsertDfeDocumento(sql, 't1', decompressAndParseDocZip({ nsu: '2', schema: 'procEventoNFe_v1.00.xsd', base64Content: z(ev('210210', 'Ciencia da Operacao')) }));
  let d = await doc();
  assert.equal(d.v, 15430.5); assert.equal(d.nome_emitente, 'CIMENTOS LTDA'); assert.equal(d.x, '<nfeProc'); assert.equal(d.situacao, 'autorizada');
  await upsertDfeDocumento(sql, 't1', decompressAndParseDocZip({ nsu: '3', schema: 'procEventoNFe_v1.00.xsd', base64Content: z(ev('110111', 'Cancelamento')) }));
  d = await doc();
  assert.equal(d.situacao, 'cancelada'); assert.equal(d.v, 15430.5);
  await upsertDfeDocumento(sql, 't1', decompressAndParseDocZip({ nsu: '4', schema: 'procNFe_v4.00.xsd', base64Content: z(nfe) }));
  assert.equal((await doc()).situacao, 'cancelada', 'NF-e reenviada não desfaz o cancelamento');
  await db.close();
  assert.equal(read('api/_sefaz-dfe.js'), read('backend/domains/fiscal/_sefaz-dfe.js'), '_sefaz-dfe espelhado');
  console.log('  ✓ DF-e: eventos não sobrescrevem a NF-e (valor, emitente e XML preservados) e cancelamento vale');
}

{
  const { ctx, plain } = appCtx([['js/produtos.js', 'Produtos'], ['js/recibos.js', 'Recibos']]);
  const { DB, Produtos, Recibos } = ctx;
  DB.add('lancamentos', { id: 'a', tipo: 'despesa', valor: 1000, status: 'a_pagar', data_vencimento: '2026-10-10', obra_id: 'o1' });
  DB.add('lancamentos', { id: 'b', tipo: 'despesa', valor: 5000, status: 'em_atraso', data_vencimento: '2026-09-01', obra_id: 'o1' });
  DB.add('lancamentos', { id: 'c', tipo: 'despesa', valor: 70, status: 'a_pagar', data_vencimento: '2026-09-20', obra_id: 'o1' });
  const r = DB.getResumo('todas');
  assert.equal(r.aPagar, 3); assert.equal(r.aPagarValor, 6070, 'em_atraso entra no A Pagar');
  assert.deepEqual(plain(DB.getLancamentos(null, { status: 'em_atraso' }).map(l => l.id).sort()), ['b', 'c'], 'filtro "Em Atraso" pega pendentes vencidos');
  DB.add('lancamentos', { id: 'e1', tipo: 'despesa', valor: 300, status: 'pago', obra_id: 'escritorio' });
  DB.add('lancamentos', { id: 'e2', tipo: 'receita', valor: 5000, status: 'recebido', obra_id: 'escritorio' });
  assert.equal(DB.getResumoEscritorio().totalGeral, 300, 'receita da sede não entra como gasto do escritório');
  assert(/if \(venc < semanas\[0\]\.iniStr\) venc = semanas\[0\]\.iniStr;/.test(read('js/dashboard.js')), 'fluxo de 90 dias inclui o que já venceu');
  assert(/status IN \('a_pagar','pendente','em_atraso'\)/.test(read('api/dashboard.js')), 'dashboard do servidor inclui em_atraso');
  // Histórico de preços: compra do OCR (lançamento + nota com os mesmos itens) conta uma vez.
  DB.add('produtos', { id: 'p1', nome: 'Cimento', unidade: 'sc' });
  const itens = [{ produto_id: 'p1', qtd: 10, valor_unit: 45, total: 450 }];
  DB.add('lancamentos', { id: 'L', tipo: 'despesa', valor: 450, status: 'pago', itens });
  DB.add('notas', { id: 'N', lancamento_id: 'L', itens });
  const an = Produtos.getAnaliseGastos().find(x => x.id === 'p1');
  assert.equal(an.total, 450); assert.equal(an.qtd_total, 10);
  // Recibo: maior número do ano + 1.
  Recibos.salvarLista([{ id: 'r1', numero: '0001/2026' }, { id: 'r3', numero: '0003/2026' }, { id: 'r9', numero: '0009/2025' }]);
  assert.equal(Recibos._proximoNumero(), '0004/2026');
  console.log('  ✓ Financeiro: em atraso nos totais e filtro, escritório sem receitas, preço médio sem contagem dupla, recibo sem número repetido');
}

{
  const lanc = read('js/lancamentos.js');
  assert.equal((lanc.match(/^  _onContaChange\(/gm) || []).length, 1, 'um único _onContaChange');
  assert(/_onBaixaContaChange\(val\)/.test(lanc) && /data-fb-change="Lancamentos\._onBaixaContaChange"/.test(lanc));
  assert(read('js/patch26-events.js').includes('"Lancamentos._onBaixaContaChange"'), 'nova ação na allowlist do CSP');
  const notas = read('js/notas.js');
  assert(/vRetPIS/.test(notas) && !/vNF - impostos/.test(notas), 'valor a pagar desconta só retenções');
  assert(/cnpjEmpresa/.test(notas), 'entrada/saída pelo CNPJ da construtora');
  console.log('  ✓ Lançamento (conta manual), Notas (entrada/saída e valor líquido)');
}

console.log('\n✅ Varredura 03/10/2026 (rápidas, dados, OFX, NF-e e financeiro): tudo certo.');
