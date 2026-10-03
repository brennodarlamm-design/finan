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

console.log('\n✅ Varredura 03/10/2026 (correções rápidas e proteção de dados): tudo certo.');
