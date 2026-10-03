// scripts/test-varredura-2026-10-03.js
// Regressões da varredura geral de 03/10/2026 (docs/VARREDURA_SISTEMA_2026-10-03.md).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { EvolutionGoClient } from '../backend/domains/atendimento/evolution_client.js';
import { createCriticalR2Backup } from '../api/_edge-backup.js';

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

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
  OFX._importData = OFX._parseOFX(ofx); await OFX.processImport();
  const imp1 = DB.getAll('ofximports')[0];
  OFX._confirmarTodosMatchesRobo(imp1.id);
  assert.equal(DB.getById('lancamentos', 'P1').status, 'pago');
  OFX._importData = OFX._parseOFX(ofx); await OFX.processImport();
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
  OFX._importData = OFX._parseOFX(ofx2); await OFX.processImport();
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


// ── Cliente e cobrança ────────────────────────────────────────────────────────
{
  const { billingStageFor } = await import('../backend/billing_stages.js');
  const dia = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  // Vencimento em cada dia da semana (05/10/2026 é segunda); cron de segunda a sexta.
  for (let k = 0; k < 7; k++) {
    const venc = dia('2026-10-05', k);
    const enviados = [];
    for (let n = -12; n <= 16; n++) {
      const hoje = dia(venc, n);
      const semana = new Date(`${hoje}T12:00:00Z`).getUTCDay();
      if (semana === 0 || semana === 6) continue; // cron 1-5
      const { stage } = billingStageFor('pro', -n);
      if (stage && !enviados.includes(stage)) enviados.push(stage); // anti-spam por ciclo
    }
    for (const st of ['reminder_10d', 'reminder_3d', 'overdue_1d', 'overdue_5d']) {
      assert(enviados.includes(st), `vencimento ${venc}: estágio ${st} precisa sair (enviados: ${enviados.join(', ')})`);
    }
    const semanaVenc = new Date(`${venc}T12:00:00Z`).getUTCDay();
    if (semanaVenc >= 1 && semanaVenc <= 5) assert(enviados.includes('due_today'), `vencimento em dia útil ${venc}: aviso "vence hoje"`);
  }
  assert.equal(billingStageFor('pro', -2).situacaoTxt, 'vencido há 2 dias');
  assert.equal(billingStageFor('trial', 1).stage, 'trial_ending');
  const server = read('backend/server.js');
  assert(/billingStageFor\(t\.plano, diasRestantes\)/.test(server), 'servidor usa as faixas');
  assert(/INTERVAL '15 days'/.test(server), 'anti-spam por ciclo de vencimento');
  console.log('  ✓ Cobrança: nenhum aviso some quando o vencimento cai no fim de semana; um envio por estágio e ciclo');
}


{
  // Portal do cliente v2: link curto assinado; dados atuais vêm do servidor.
  process.env.SESSION_SIGNING_SECRET = process.env.SESSION_SIGNING_SECRET || 'teste-'.repeat(8);
  const portal = await import('../api/_portal-link.js');
  const db = new PGlite();
  await db.exec(`CREATE TABLE obras (id text, tenant_id text, nome text, cliente text, endereco text, status text, data_inicio date, data_previsao date, cronograma_config jsonb);
    CREATE TABLE tenants (id text, nome_fantasia text, razao_social text, logo_url text, telefone text, responsavel text);
    CREATE TABLE medicoes (id text, tenant_id text, obra_id text, numero int, etapa_descricao text, percentual_fisico numeric, valor_liberado numeric, valor_solicitado numeric, data date);
    CREATE TABLE lancamentos (id text, tenant_id text, obra_id text, tipo text, descricao text, categoria text, valor numeric, data date);
    CREATE TABLE documentos (id text, tenant_id text, tipo text, referencia_id text, titulo text, nome_arquivo text, tipo_arquivo text, url text, created_at timestamptz);
    CREATE TABLE contratos (id text, tenant_id text, obra_id text, status text, payload jsonb);
    INSERT INTO tenants VALUES ('acme','Acme Construtora',NULL,'','(95) 99999-0000','Ana');
    INSERT INTO obras VALUES ('ob1','acme','Casa Silva','João Silva','Rua A','em_andamento','2026-09-01','2027-02-01','{"processos_sla":[{"id":"p1","nome":"Fundação","dias_sla":10}]}');
    INSERT INTO obras VALUES ('ob9','outra','Obra de outra empresa','X','','em_andamento',NULL,NULL,NULL);
    INSERT INTO medicoes VALUES ('m1','acme','ob1',1,'Fundação',20,25000,NULL,'2026-09-20');
    INSERT INTO lancamentos VALUES ('l1','acme','ob1','despesa','Cimento','material',4500,'2026-09-15'), ('l2','acme','ob1','receita','Medição 1','receita',25000,'2026-09-21');
    INSERT INTO documentos VALUES ('d1','acme','obra','ob1','Projeto','p.pdf','application/pdf','https://drive.example.com/p.pdf','2026-09-02'), ('d2','acme','obra','ob1','Privado','x.pdf','application/pdf','r2://tenants/acme/x.pdf','2026-09-03');
    INSERT INTO contratos VALUES ('c1','acme','ob1','ativo','{"titulo":"Contrato de Obra","assinado_por_cliente":true}');`);
  const sql = async (strings, ...values) => { let t = strings[0]; values.forEach((_, k) => { t += `$${k + 1}` + strings[k + 1]; }); return (await db.query(t, values)).rows; };
  const call = async (fn, body, deps = {}) => { let status = 200, out; const res = { status(c) { status = c; return this; }, json(b) { out = b; return this; }, setHeader() {} }; await fn({ method: 'POST', headers: {}, body }, res, { sql, ...deps }); return { status, out }; };
  const auth = { authenticated: true, tenantId: 'acme', user: { id: 'u1', perfil: 'admin', tenantPlan: 'profissional' } };
  const link = await call(portal.handlePortalLinkSign, { obraId: 'ob1' }, { resolveAuth: async () => auth });
  assert.equal(link.status, 200); assert.equal(link.out.v, 2);
  const url = `https://fingo.api.br/portal?portal_obra=${link.out.obra}&tenant=${link.out.tenant}&exp=${link.out.exp}&sig=${link.out.sig}`;
  assert(url.length < 250, `link curto (${url.length} caracteres)`);
  assert.equal((await call(portal.handlePortalLinkSign, { obraId: 'ob9' }, { resolveAuth: async () => auth })).status, 404, 'obra de outra empresa não gera link');
  const ref = { tenant: link.out.tenant, obra: link.out.obra, exp: link.out.exp, sig: link.out.sig };
  const dados = await call(portal.handlePortalData, ref);
  assert.equal(dados.status, 200);
  const b = dados.out.bundle;
  assert.equal(b.o.n, 'Casa Silva'); assert.equal(b.emp.n, 'Acme Construtora');
  assert.equal(b.med[0].val, 25000); assert.equal(b.nfe.length, 1, 'só despesas'); assert.equal(b.nfe[0].val, 4500);
  assert.deepEqual(b.doc.map(d => d.url), ['', 'https://drive.example.com/p.pdf'], 'mais recente primeiro; arquivo privado sem URL e link externo mantido');
  assert(b.doc.every(d => !String(d.url).startsWith('r2://')), 'arquivo privado não vai para o portal');
  assert.equal(b.ctr[0].ass, true); assert.equal(b.o.sla_raw[0].nome, 'Fundação');
  // Dado novo aparece no mesmo link (antes ficava congelado).
  await db.exec(`INSERT INTO medicoes VALUES ('m2','acme','ob1',2,'Estrutura',45,30000,NULL,'2026-10-01')`);
  assert.equal((await call(portal.handlePortalData, ref)).out.bundle.med.length, 2, 'mesmo link mostra a medição nova');
  assert.equal((await call(portal.handlePortalData, { ...ref, obra: 'ob9' })).status, 401, 'trocar a obra invalida a assinatura');
  assert.equal((await call(portal.handlePortalData, { ...ref, tenant: 'outra' })).status, 401, 'trocar a empresa invalida a assinatura');
  const expirado = Date.now() - 1000;
  assert.equal((await call(portal.handlePortalData, { ...ref, exp: expirado, sig: portal.signPortalRef('acme', 'ob1', expirado) })).status, 401, 'link vencido');
  await db.close();
  const cli = read('js/portal_cliente.js');
  assert(!/em tempo real/.test(cli) && !/assinar documentos pendentes/.test(cli), 'mensagem não promete o que o portal não faz');
  assert(cli.includes("fetch('/api/v2/portal/data'") && cli.includes('JSON.stringify({ obraId })'), 'cliente usa o link v2');
  assert.equal(cli, read('frontend/domains/gestao/portal_cliente.js'));
  assert.equal(read('api/_portal-link.js'), read('backend/domains/edge/_portal-link.js'));
  console.log(`  ✓ Portal: link curto (${url.length} caracteres) e assinado, dados atuais do servidor, sem arquivos privados nem troca de obra/empresa`);
}


// ── Obras ─────────────────────────────────────────────────────────────────────

// #21 — SLA: atraso contado em cada etapa seguinte e +1 dia por etapa.
{
  const { ctx } = appCtx([['js/cronograma_sla.js', 'CronogramaSLA']]);
  const S = ctx.CronogramaSLA;
  const r = S.calcularCascata([
    { id: 'a', dias_sla: 10, status: 'em_andamento', data_inicio_real: '2026-09-01' },
    { id: 'b', dias_sla: 10, predecessor_id: 'a', status: 'pendente' },
    { id: 'c', dias_sla: 10, predecessor_id: 'b', status: 'pendente' }
  ], '2026-09-01');
  assert.equal(r[0].data_fim_prevista, '2026-09-10', '10 dias a partir de 01/09 terminam em 10/09');
  assert.deepEqual(JSON.parse(JSON.stringify(r.map(p => p.dias_atraso))), [23, 0, 0], 'só a etapa atrasada conta atraso');
  assert.equal(r[1].data_inicio_prevista, '2026-10-04', 'a seguinte é empurrada para depois de hoje');
  assert.equal(S._atrasoEntrega(r), 23, 'entrega atrasa 23 dias, não a soma das etapas');
  const semAtraso = S.calcularCascata([{ id: 'a', dias_sla: 30, status: 'pendente' }, { id: 'b', dias_sla: 30, predecessor_id: 'a', status: 'pendente' }], '2026-11-01');
  assert.deepEqual(JSON.parse(JSON.stringify(semAtraso.map(p => [p.data_inicio_prevista, p.data_fim_prevista]))), [['2026-11-01', '2026-11-30'], ['2026-12-01', '2026-12-30']], 'sem dia extra entre etapas');
  // Etapa concluída com atraso: a próxima, liberada e não iniciada, só conta desde que pôde começar.
  const r2 = S.calcularCascata([
    { id: 'a', dias_sla: 10, status: 'concluido', data_inicio_real: '2026-09-01', data_fim_real: '2026-09-25' },
    { id: 'b', dias_sla: 10, predecessor_id: 'a', status: 'pendente' }
  ], '2026-09-01');
  assert.deepEqual(JSON.parse(JSON.stringify(r2.map(p => p.dias_atraso))), [15, 7]);
  assert.equal(read('js/cronograma_sla.js'), read('frontend/domains/obras/cronograma_sla.js'));
  console.log('  ✓ SLA: cada etapa conta só o próprio atraso, sem +1 dia por etapa; entrega atrasa o que realmente atrasou');
}

// #22 — Curva S: fuso do Brasil e "todas as obras".
{
  const tzAntes = process.env.TZ;
  process.env.TZ = 'America/Sao_Paulo';
  try {
    const { ctx } = appCtx([]);
    const { DB } = ctx;
    DB.add('clientes', { id: 'o1', nome: 'A', data_inicio: '2026-09-01', data_previsao_termino: '2027-02-28' });
    DB.add('clientes', { id: 'o2', nome: 'B', data_inicio: '2026-09-01', data_previsao_termino: '2027-02-28' });
    DB.add('orcamentos', { id: 'r1', obra_id: 'o1', valor_total: 900000, itens: [] });
    DB.add('orcamentos', { id: 'r2', obra_id: 'o2', valor_total: 100000, itens: [] });
    DB.add('medicoes', { id: 'm1', obra_id: 'o1', status: 'liberada', percentual_fisico: 10, data: '2026-09-20' });
    DB.add('medicoes', { id: 'm2', obra_id: 'o2', status: 'liberada', percentual_fisico: 90, data: '2026-09-20' });
    const cs = DB.getCurvaS('o1');
    assert.equal(cs.mesesKeys[0], '2026-09', 'curva começa em setembro, não em agosto');
    const comp = DB.getOrcamentoVsRealizado('todas');
    assert(comp.totalOrcado > 0, 'orçamentos lidos'); assert.equal(comp.percentualFisico, 18, 'média ponderada pelo orçado (10% de 900 mil + 90% de 100 mil)');
    assert.equal(DB._pctFisicoCarteira(DB.getAll('clientes'), DB.getAll('medicoes'), [{ id: 'o1', peso: 0.9 }, { id: 'o2', peso: 0.1 }]), 18);
    assert.notEqual(comp.percentualFisico, 90, 'não usa o maior % de uma obra só');
  } finally {
    if (tzAntes === undefined) delete process.env.TZ; else process.env.TZ = tzAntes;
  }
  console.log('  ✓ Curva S: começa no mês certo no fuso do Brasil; carteira usa média ponderada pelo orçamento');
}

// #23 e #30 — Medição: receita acompanha a edição, retenção vira "a receber", exclusão preserva o recebido.
{
  const { ctx, toasts } = appCtx([['js/medicoes.js', 'Medicoes']]);
  const { DB, Medicoes } = ctx;
  ctx.Utils.confirm = (_m, cb) => cb();
  DB.add('clientes', { id: 'o1', nome: 'Casa', modalidade_obra: 'particular', data_previsao_termino: '2027-03-31' });
  DB.add('medicoes', { id: 'M1', obra_id: 'o1', numero_medicao: 1, status: 'aprovada', valor_solicitado: 10000, percentual_fisico: 20 });
  const campos = { 'lib-val': '10000', 'lib-retencao': '500', 'lib-descontos': '0', 'lib-dt': '2026-10-01' };
  ctx.document.getElementById = id => (campos[id] !== undefined ? { value: campos[id] } : null);
  Medicoes._confirmLiberar('M1');
  ctx.document.getElementById = () => null;
  let m = DB.getById('medicoes', 'M1');
  const rec = DB.getById('lancamentos', m.lancamento_id);
  const ret = DB.getById('lancamentos', m.retencao_lancamento_id);
  assert.equal(rec.valor, 9500); assert.equal(rec.status, 'recebido');
  assert.equal(ret.valor, 500); assert.equal(ret.status, 'a_receber'); assert.equal(ret.data_vencimento, '2027-03-31', 'retenção volta no término da obra');
  // Edição: valor liberado e retenção mudam → receitas acompanham.
  DB.update('medicoes', 'M1', { valor_liberado: 12000, retencao_tecnica: 600 });
  Medicoes._sincronizarFinanceiro('M1');
  assert.equal(DB.getById('lancamentos', rec.id).valor, 11400);
  assert.equal(DB.getById('lancamentos', ret.id).valor, 600);
  // Receita conciliada não muda de valor.
  DB.update('lancamentos', rec.id, { conciliado: true });
  DB.update('medicoes', 'M1', { valor_liberado: 13000 });
  const avisos = Medicoes._sincronizarFinanceiro('M1');
  assert.equal(DB.getById('lancamentos', rec.id).valor, 11400); assert.equal(avisos.length, 1);
  // Exclusão: receita conciliada fica; retenção ainda a receber sai.
  Medicoes.del('M1');
  assert(DB.getById('lancamentos', rec.id), 'receita conciliada continua');
  assert.equal(DB.getById('lancamentos', ret.id), null, 'retenção em aberto sai junto');
  assert(toasts.some(t => /mantida no financeiro/.test(t.m)));
  // Voltar de "liberada" tira as receitas não conciliadas.
  DB.add('medicoes', { id: 'M2', obra_id: 'o1', numero_medicao: 2, status: 'liberada', valor_liberado: 5000, retencao_tecnica: 0, data_liberacao: '2026-10-02' });
  Medicoes._sincronizarFinanceiro('M2');
  const lan2 = DB.getById('medicoes', 'M2').lancamento_id;
  assert(DB.getById('lancamentos', lan2));
  DB.update('medicoes', 'M2', { status: 'aprovada' });
  Medicoes._sincronizarFinanceiro('M2');
  assert.equal(DB.getById('lancamentos', lan2), null);
  assert.equal(DB.getById('medicoes', 'M2').lancamento_id, null);
  // Pré-compra: pagamento feito não some; conta em aberto sai.
  const { ctx: c2 } = appCtx([['js/precompras.js', 'PreCompras']]);
  c2.Utils.confirm = (_m, cb) => cb(); c2.App.navigate = () => {};
  c2.DB.add('lancamentos', { id: 'PG', tipo: 'despesa', valor: 300, status: 'pago', precompra_id: 'PC1' });
  c2.DB.add('lancamentos', { id: 'AB', tipo: 'despesa', valor: 200, status: 'a_pagar', precompra_id: 'PC2' });
  c2.DB.add('precompras', { id: 'PC1', numero_ordem: 'OC-1', lancamento_id: 'PG' });
  c2.DB.add('precompras', { id: 'PC2', numero_ordem: 'OC-2', lancamento_id: 'AB' });
  c2.PreCompras.excluir('PC1'); c2.PreCompras.excluir('PC2');
  assert(c2.DB.getById('lancamentos', 'PG'), 'pagamento feito continua');
  assert.equal(c2.DB.getById('lancamentos', 'AB'), null, 'conta em aberto sai junto');
  // A retenção vinculada sobrevive ao recarregar da nuvem (vem do payload).
  const { normalizeMedicao } = await import('../api/_db-normalizers.js');
  assert.equal(normalizeMedicao({ id: 'x', payload: JSON.stringify({ retencao_lancamento_id: 'R9' }) }).retencao_lancamento_id, 'R9');
  for (const f of [['medicoes', 'obras'], ['precompras', 'suprimentos'], ['data', null]]) {
    assert.equal(read(`js/${f[0]}.js`), read(f[1] ? `frontend/domains/${f[1]}/${f[0]}.js` : `frontend/core/${f[0]}.js`));
  }
  console.log('  ✓ Medição: receita e retenção acompanham a edição; excluir medição/pré-compra não apaga o que já foi pago ou conciliado');
}

// #29 — Upload recusado pelo servidor não aparece como salvo.
{
  const { ctx, toasts } = appCtx([['js/documentos.js', 'Documentos']]);
  const D = ctx.Documentos;
  ctx.AbortSignal = AbortSignal;
  D.lerArquivoBase64 = async () => 'QUJD';
  D._idbSet = async () => {}; D.abrirModal = () => {};
  const arquivo = { name: 'planta.exe', size: 1000, type: 'application/x-msdownload' };
  ctx.fetch = async () => ({ ok: false, status: 400, json: async () => ({ success: false, error: 'Tipo de arquivo não permitido.' }) });
  await D._onUpload('obra', 'o1', { files: [arquivo], value: 'x' });
  assert.equal(D.getAll().length, 0, 'recusado não é salvo');
  assert(toasts.some(t => t.k === 'error' && /não permitido/.test(t.m)));
  ctx.fetch = async () => { throw new Error('offline'); };
  await D._onUpload('obra', 'o1', { files: [{ name: 'a.pdf', size: 1000, type: 'application/pdf' }], value: 'x' });
  assert.equal(D.getAll().length, 1, 'sem conexão fica neste aparelho');
  assert(toasts.some(t => t.k === 'warning' && /só neste aparelho/.test(t.m)));
  await D._onUpload('obra', 'o1', { files: [{ name: 'g.pdf', size: 16 * 1024 * 1024, type: 'application/pdf' }], value: 'x' });
  assert(toasts.some(t => /15MB/.test(t.m)), 'limite igual ao do servidor');
  assert.equal(read('js/documentos.js'), read('frontend/domains/contratos/documentos.js'));
  console.log('  ✓ Documentos: arquivo recusado pelo servidor não aparece como salvo; limite de 15 MB');
}


// ── UX e performance ──────────────────────────────────────────────────────────
{
  // #32 BIM sob demanda: nenhum <script> de BIM no app; lista na ordem certa para o carregador.
  const app = read('app.html');
  assert(!/<script[^>]+\/js\/bim_/.test(app), 'app.html não baixa o BIM no início');
  const meta = app.match(/<meta name="fingo-bim-scripts" content="([^"]+)">/);
  assert(meta, 'lista de scripts do BIM presente');
  const ordem = meta[1].split(',').map(u => u.replace(/\?.*$/, ''));
  assert.deepEqual(ordem, ['/js/bim_csg.js', '/js/bim_ifc_extended.js', '/js/bim_geometry_importer.js', '/js/bim_clash_engine.js', '/js/bim_presets.js', '/js/bim_viewer.js']);
  const od = read('js/obra_detalhe.js');
  assert(od.includes('_carregarBIM()') && od.includes("el.async = false"), 'aba 3D carrega o BIM em ordem');
  assert.equal(read('frontend/app.html'), app);
  assert.equal(read('frontend/domains/obras/obra_detalhe.js'), od);

  // #33 Sentry não bloqueia a renderização.
  for (const f of ['landing.html', 'marketing/pages/landing.html', 'index.html', 'master.html', 'app.html']) {
    assert(!read(f).includes('<script src="/js/sentry.js"></script>'), `${f}: sentry sem defer`);
  }

  // #34 Vídeo da landing só em tela larga e sem economia de dados.
  const mk = read('marketing/main.jsx');
  assert(mk.includes('function podeTocarVideo()') && mk.includes('(min-width: 768px)') && mk.includes('saveData'));
  assert(/\{ativo && !failed && \(\s*<video/.test(mk), 'vídeo nem é montado no celular');
  assert.equal(read('marketing/src/main.jsx'), mk);
  assert(fs.statSync('img/fingo/construction-background.mp4').size < 2 * 1024 * 1024, 'vídeo de fundo comprimido');

  // #35 Service worker: uma cópia por arquivo, sem vídeos nem /data.
  const sw = read('sw.js');
  assert(sw.includes('function chaveSemQuery(') && sw.includes('cache.put(chave,') && sw.includes('naoCachear(url)'));
  assert(sw.includes("event.request.mode === 'navigate'"), 'fora de JS/CSS/imagens só HTML de navegação é guardado');
  const headers = read('cloudflare/_headers');
  assert(/\/data\/sinapi_\*\n\s+Cache-Control: public, max-age=86400/.test(headers));

  // #36 Servidor indisponível ≠ sem internet.
  const { ctx } = appCtx([]);
  ctx.navigator.onLine = true;
  assert.equal(ctx.DB._statusFalhaSync(new Error('HTTP 503')), 'server_down');
  ctx.navigator.onLine = false;
  assert.equal(ctx.DB._statusFalhaSync(new Error('Failed to fetch')), 'offline');
  const appJs = read('js/app.js');
  assert(appJs.includes("server_down: ['⚠', 'Servidor indisponível'") && appJs.includes('_avisoServidor(status)'));
  for (const f of ['js/patch26-events.js', 'frontend/core/patch26-events.js']) {
    const ev = read(f);
    assert(ev.includes('"App.tentarReconectar"') && ev.includes('"App.fecharAvisoServidor"'), `${f}: ações do aviso liberadas`);
  }

  // #37 Acessibilidade: rótulos e nomes automáticos; alvo de toque mínimo.
  const ev = read('js/patch26-events.js');
  assert(ev.includes('function rotularCampo(') && ev.includes("b.setAttribute('aria-label', b.getAttribute('title') || 'Fechar')"));
  assert.equal(read('frontend/core/patch26-events.js'), ev);
  assert(read('css/style.css').includes('@media (pointer: coarse) {\n  button, .btn, a.btn, [role="button"] { min-height: 32px; }'));

  // #38 Sem estouro em 390px (verificado no Chromium; aqui as regras).
  assert(read('calculadora-bdi.html').includes('.nav-links a[href="/planos"]'));
  assert(read('validar.html').includes('.input-code { min-width: 0; }'));

  // #39 Imagens.
  assert(fs.statSync('img/og-fingo-cover.jpg').size < 200 * 1024 && fs.statSync('img/fingo-logo-512.jpg').size < 100 * 1024);
  for (const f of ['landing.html', 'sobre-nos.html', 'planos.html', 'blog.html', 'site.webmanifest', 'scripts/prerender-marketing.mjs']) {
    assert(!/og-finobra-cover|finobra_logo/.test(read(f)), `${f}: imagem com a marca antiga`);
  }
  for (const f of ['img/fingo/hero-video-preview.png', 'img/fingo/logo-reveal-frame120.png', 'img/fingo/logo-reveal-frame60.png', 'img/fingo/hero-video-frame160.png']) {
    assert(!fs.existsSync(f), `${f} órfão removido`);
  }
  assert(read('js/academia.js').includes('/img/fingo/logo-reveal-poster.jpg') && fs.existsSync('img/fingo/logo-reveal-poster.jpg'));

  // #40 Sem e-mails fictícios; histórico por empresa.
  const notif = read('js/notificacoes.js');
  assert(!notif.includes('engenhariabrasil.com.br') && !notif.includes('_emailsPadrao'));
  assert(notif.includes("DB._ck('finobra_email_logs')"));
  console.log('  ✓ UX/performance: BIM sob demanda, Sentry com defer, vídeo só no desktop, cache sem acúmulo, aviso de servidor fora, acessibilidade, 390px, imagens e e-mails reais');
}


// ── Pendentes opcionais ───────────────────────────────────────────────────────

// #8 — Registro de FITIDs no servidor: extrato importado num aparelho não entra de novo em outro.
{
  const { handleOfxFitids } = await import('../api/_ofx-registry.js');
  const db = new PGlite();
  const mig = read('migrations/039_ofx_transacoes_importadas.sql').replace(/DO \$\$[\s\S]*?END \$\$;/, '');
  await db.exec(mig);
  const sql = async (strings, ...values) => { let t = strings[0]; values.forEach((_, k) => { t += `$${k + 1}` + strings[k + 1]; }); return (await db.query(t, values)).rows; };
  const auth = { authenticated: true, tenantId: 'acme', user: { id: 'u1', perfil: 'admin' } };
  const call = async (body, a = auth) => { let status = 200, out; const res = { status(c) { status = c; return this; }, json(b) { out = b; return this; }, setHeader() {} }; await handleOfxFitids({ method: 'POST', headers: {}, body }, res, { sql, resolveAuth: async () => a, rateLimit: async () => ({ allowed: true }) }); return { status, out }; };
  assert.deepEqual((await call({ action: 'check', conta: '341|1234', fitids: ['X1', 'X2'] })).out.existentes, []);
  assert.equal((await call({ action: 'register', conta: '341|1234', fitids: ['X1', 'X2', 'X2'], import_id: 'imp1' })).out.registrados, 2);
  assert.equal((await call({ action: 'register', conta: '341|1234', fitids: ['X2', 'X3'], import_id: 'imp2' })).out.registrados, 1, 'repetido não duplica');
  assert.deepEqual([...(await call({ action: 'check', conta: '341|1234', fitids: ['X1', 'X9'] })).out.existentes], ['X1']);
  assert.deepEqual([...(await call({ action: 'check', conta: '001|9', fitids: ['X1'] })).out.existentes], [], 'outra conta não conflita');
  assert.deepEqual([...(await call({ action: 'check', conta: '341|1234', fitids: ['X1'] }, { ...auth, tenantId: 'outra' })).out.existentes], [], 'outra empresa não vê');
  assert.equal((await call({ action: 'unregister', import_id: 'imp1' })).out.removidos, 2);
  assert.deepEqual([...(await call({ action: 'check', conta: '341|1234', fitids: ['X1', 'X3'] })).out.existentes], ['X3'], 'excluir o import libera o extrato');
  assert.equal((await call({ action: 'check', conta: '341|1234', fitids: ['X1'] }, { authenticated: false, status: 401 })).status, 401);
  assert.equal((await call({ action: 'register', conta: '341|1234', fitids: ['Z'] }, { ...auth, user: { id: 'v', perfil: 'visualizador' } })).status, 403, 'somente leitura não registra');
  await db.close();

  // App: consulta o servidor antes de importar; sem servidor, segue só com a checagem local.
  const { ctx, toasts } = appCtx([['js/ofx.js', 'OFX']]);
  const { DB, OFX } = ctx;
  OFX.viewImport = () => {}; OFX.render = () => ''; OFX.init = () => {};
  const chamadas = [];
  ctx.DB._fetchWithTimeout = async (url, opts) => {
    const b = JSON.parse(opts.body); chamadas.push(b.action);
    return { ok: true, json: async () => (b.action === 'check' ? { success: true, existentes: ['Y1'] } : { success: true, registrados: 1 }) };
  };
  const ofx = `<OFX><BANKID>341</BANKID><ACCTID>1234</ACCTID><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260910</DTPOSTED><TRNAMT>-50.00</TRNAMT><FITID>Y1</FITID><MEMO>A</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260911</DTPOSTED><TRNAMT>-60.00</TRNAMT><FITID>Y2</FITID><MEMO>B</MEMO></STMTTRN></OFX>`;
  OFX._importData = OFX._parseOFX(ofx); await OFX.processImport();
  const imp = DB.getAll('ofximports')[0];
  assert.deepEqual(JSON.parse(JSON.stringify(imp.transacoes.map(t => t.fitid))), ['Y2'], 'transação importada em outro aparelho é ignorada');
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(chamadas, ['check', 'register']);
  assert.equal(DB.getById('ofximports', imp.id).registro_servidor, 'ok');
  // Offline: importa com aviso e deixa o registro pendente para reenviar.
  ctx.DB._fetchWithTimeout = async () => { throw new Error('offline'); };
  OFX._importData = OFX._parseOFX(ofx.replace(/Y1/g, 'W1').replace(/Y2/g, 'W2')); await OFX.processImport();
  const imp2 = DB.getAll('ofximports').find(i => i.id !== imp.id);
  await new Promise(r => setTimeout(r, 0));
  assert.equal(imp2.transacoes.length, 2); assert.equal(DB.getById('ofximports', imp2.id).registro_servidor, 'pendente');
  assert(toasts.some(t => /só para este aparelho/.test(t.m)));
  assert.equal(read('js/ofx.js'), read('frontend/domains/financeiro/ofx.js'));
  assert.equal(read('api/_ofx-registry.js'), read('backend/domains/edge/_ofx-registry.js'));
  console.log('  ✓ OFX: transações importadas ficam registradas no servidor (por empresa e conta); outro aparelho não reimporta');
}

// #41 — Boletim de medição: retenções conforme o tipo de serviço e alíquotas validadas.
{
  const { handleV2BoletimMedicao } = await import('../api/_v2-routes.js');
  const call = async (body) => { let status = 200, out; const res = { status(c) { status = c; return this; }, json(b) { out = b; return this; }, setHeader() {} }; await handleV2BoletimMedicao({ method: 'POST', headers: {}, body, socket: {} }, res); return { status, out }; };
  const obra = (await call({ valorBruto: 10000, aliqISS: 3 })).out.boletim;
  assert.equal(obra.retencoes.irrf.valor, 0, 'empreitada de obra sem IRRF');
  assert.equal(obra.retencoes.pisCofinsCsll.valor, 0, 'empreitada de obra sem CSRF');
  assert.equal(obra.retencoes.inss.valor, 1100);
  const simples = (await call({ valorBruto: 10000, tipoServico: 'engenharia_consultiva', optanteSimples: true, aliqIRRF: 1.5 })).out.boletim;
  assert.equal(simples.retencoes.irrf.valor, 0, 'Simples não sofre IRRF mesmo se pedirem');
  assert.equal(simples.retencoes.pisCofinsCsll.valor, 0);
  const cons = (await call({ valorBruto: 10000, tipoServico: 'engenharia_consultiva' })).out.boletim;
  assert.equal(cons.retencoes.irrf.valor, 150); assert.equal(cons.retencoes.pisCofinsCsll.valor, 465);
  for (const ruim of [{ aliqISS: -5 }, { aliqISS: 1 }, { aliqISS: 7 }, { aliqRetencaoGarantia: 50 }, { tipoServico: 'x' }, { tipoServico: 'manutencao', aliqIRRF: 9 }]) {
    assert.equal((await call({ valorBruto: 1000, ...ruim })).status, 400, JSON.stringify(ruim));
  }
  assert.equal(read('api/_v2-routes.js'), read('backend/domains/edge/_v2-routes.js'));
  console.log('  ✓ Boletim: sem IRRF/CSRF em empreitada de obra e no Simples; alíquotas fora da faixa legal recusadas');
}


// Documentos no Vercel Blob: a migração para o R2 leva o ORIGINAL e não troca por cópia degradada.
{
  const { migrateLegacyDocumentsToR2 } = await import('../api/_edge-backup.js');
  const db = new PGlite();
  await db.exec(`CREATE TABLE documentos (id text, tenant_id text, nome_arquivo text, tipo_arquivo text, tamanho_bytes bigint, base64_data text, url text, created_at timestamptz default now())`);
  const pdf = Buffer.from('%PDF-1.4 original da conta');
  const jpgDegradado = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).toString('base64');
  const V = 'https://abc123.public.blob.vercel-storage.com/angelim/documentos/2026/09/';
  const rows = [
    ['A', 'conta-A.pdf', 'application/pdf', pdf.length, jpgDegradado, V + 'conta-A.pdf'],            // original acessível
    ['B', 'conta-B.pdf', 'application/pdf', 18635, jpgDegradado, V + 'conta-B.pdf'],                 // sem original, cópia não confere
    ['C', 'danfe.pdf', 'application/pdf', pdf.length, pdf.toString('base64'), V + 'danfe.pdf'],      // sem original, cópia fiel
    ['D', 'foto.jpg', 'image/jpeg', 14, jpgDegradado, null],                                         // só no banco
    ['E', 'ja.pdf', 'application/pdf', 3, 'QUJD', 'r2://tenants/angelim/documentos/ja.pdf']          // já no R2
  ];
  for (const r of rows) await db.query(`INSERT INTO documentos (id, tenant_id, nome_arquivo, tipo_arquivo, tamanho_bytes, base64_data, url) VALUES ($1,'angelim',$2,$3,$4,$5,$6)`, r);
  const sql = async (strings, ...values) => { let t = strings[0]; values.forEach((_, k) => { t += `$${k + 1}` + strings[k + 1]; }); return (await db.query(t, values)).rows; };
  sql.query = async (text) => (await db.query(text)).rows;
  const r2 = new Map();
  const env = { ATTACHMENTS_R2: {
    put: async (key, data, opts) => { const bytes = Buffer.from(data); r2.set(key, { bytes, opts }); return { key, size: bytes.length, etag: 'e', httpMetadata: opts.httpMetadata }; },
    get: async (key) => (r2.has(key) ? { size: r2.get(key).bytes.length, httpMetadata: r2.get(key).opts.httpMetadata, customMetadata: r2.get(key).opts.customMetadata } : null)
  } };
  const fetchImpl = async (url) => (url.endsWith('conta-A.pdf')
    ? { ok: true, headers: { get: () => 'application/pdf' }, arrayBuffer: async () => pdf }
    : { ok: false, status: 404, headers: { get: () => '' } });
  const res = await migrateLegacyDocumentsToR2(env, { sql, fetchImpl });
  const doc = async id => (await db.query(`SELECT * FROM documentos WHERE id=$1`, [id])).rows[0];
  const a = await doc('A');
  assert(a.url.startsWith('r2://'), 'A migrado');
  const objA = [...r2.values()].find(o => o.opts.customMetadata.documentId === 'A');
  assert(objA.bytes.equals(pdf), 'A: R2 recebeu o PDF original, não o JPG do banco');
  assert.equal(objA.opts.customMetadata.migratedFrom, 'vercel_blob');
  const b = await doc('B');
  assert(b.url.startsWith(V) && b.base64_data === jpgDegradado, 'B: sem original e sem cópia fiel, nada muda');
  assert(res.failures.some(f => f.id === 'B'));
  assert((await doc('C')).url.startsWith('r2://'), 'C: cópia fiel usada');
  assert((await doc('D')).url.startsWith('r2://'), 'D: só no banco, migrado');
  assert.equal((await doc('E')).base64_data, null, 'E: já no R2, cópia duplicada limpa');
  assert.equal(res.migrated, 3);
  assert.equal(read('api/_edge-backup.js'), read('backend/domains/edge/_edge-backup.js'));
  await db.close();
  console.log('  ✓ Vercel → R2: leva o original; cópia do banco só se for fiel; nada é apagado quando não há original');
}

console.log('\n✅ Varredura 03/10/2026 (todas as correções, inclusive OFX no servidor, boletim e documentos do Vercel): tudo certo.');
