import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import worker from '../cloudflare-worker.js';

const dataSource = fs.readFileSync('js/data.js', 'utf8');
function dataLayer() {
  const storage = new Map();
  const context = vm.createContext({
    console, URLSearchParams, localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    }
  });
  const db = vm.runInContext(`${dataSource}\nDB;`, context);
  db.isCoreCloudBootstrapped = () => true;
  db.isCloudCompletenessBootstrapped = () => true;
  return db;
}
const plain = value => JSON.parse(JSON.stringify(value));
const db = dataLayer();
assert.deepEqual(plain(db._reconcileCollection('lancamentos', [], [{ id:'deleted' }])), []);
db._saveSyncQueue([{ payload:{ action:'save', table:'lancamentos', data:{ id:'offline', valor:20 } } }]);
assert.equal(db._reconcileCollection('lancamentos', [], [{ id:'offline', valor:10 }])[0].valor, 20);
assert.equal(db._reconcileCollection('lancamentos', [], [])[0].valor, 20, 'Fila recupera cache expurgado');
db._saveSyncQueue([{ payload:{ action:'delete', table:'obras', id:'removed' } }]);
assert.equal(db._reconcileCollection('clientes', [{ id:'removed' }], []).length, 0);
db._saveSyncQueue([]);
db._saveSyncFailed([{ payload:{ action:'save', table:'lancamentos', data:{ id:'draft', valor:30 } } }]);
assert.equal(db._reconcileCollection('lancamentos', [], [{ id:'draft' }])[0].valor, 30);
db.isCoreCloudBootstrapped = () => false;
assert.equal(db._reconcileCollection('clientes', [], [{ id:'legacy' }]).length, 1);
db.isCoreCloudBootstrapped = () => true;
db._syncStorageFailure = true;
assert.equal(db._reconcileCollection('clientes', [], [{ id:'unsent' }]).length, 1);
db._fetchCloudSnapshot = async () => { db._localMutationRevision = 1; return {}; };
assert.equal(await db.syncFromCloud(), false, 'Não aplicar snapshot anterior à edição local');

const ackDb = dataLayer();
ackDb.save('lancamentos', [{ id:'a', valor:30, sync_version:'old' }]);
const sent = { queueId:'q', payload:{ table:'lancamentos', action:'save', data:{ id:'a', valor:20, sync_version:'old' } }, createdAt:'before' };
ackDb._saveSyncQueue([{ ...sent, updatedAt:'after', payload:{ ...sent.payload, data:{ ...sent.payload.data, valor:30 } } }]);
ackDb._acceptSyncVersion(sent, 'new');
assert.equal(ackDb._ackSyncQueueItem(sent), 1);
assert.equal(ackDb.getAll('lancamentos')[0].valor, 30);
assert.equal(ackDb._getSyncQueue()[0].payload.data.sync_version, 'new');
const sameTime = ackDb._getSyncQueue();
sameTime[0].updatedAt = sent.createdAt;
ackDb._saveSyncQueue(sameTime);
assert.equal(ackDb._ackSyncQueueItem(sent), 1, 'Edições no mesmo milissegundo também são preservadas');
ackDb._moveSyncItemToAttention(sent, { code:'SYNC_CONFLICT', status:409 });
assert.equal(ackDb._getSyncFailed()[0].payload.data.valor, 30, 'Conflito preserva edição mais recente');
ackDb.resolveSyncConflict('q', { id:'a', valor:50, sync_version:'remote' }, false);
assert.equal(ackDb.getAll('lancamentos')[0].valor, 50);
assert.equal(ackDb.getSyncFailedCount(), 0);
ackDb._saveSyncFailed([{ ...sent, errorCode:'SYNC_CONFLICT' }]);
assert.throws(() => ackDb.resolveSyncConflict('q', null, true), /excluído/);
assert.equal(ackDb.getSyncFailedCount(), 1);
ackDb._flushCloudQueue = () => {};
ackDb.resolveSyncConflict('q', { id:'a', valor:50, sync_version:'remote' }, true);
assert.equal(ackDb._getSyncQueue()[0].payload.data.sync_version, 'remote');
assert.equal(ackDb._getSyncQueue()[0].payload.data.valor, 20);
const pageDb = dataLayer();
pageDb._fetchCloudPage = async () => ({ data:[{ id:'a' }], pagination:{ hasMore:true, nextOffset:0 } });
await assert.rejects(pageDb._fetchCloudTablePaged('lancamentos'), /Paginação incompleta/);
console.log('✅ Reconciliação: exclusões remotas, offline, atenção, migração e edição durante envio.');

// Executa as duas consultas reais da API em PostgreSQL local em memória.
const source = fs.readFileSync('api/db.js', 'utf8');
const queries = [...source.matchAll(/const saved = await sql`([\s\S]*?)`;/g)].map(match => match[1]);
assert.equal(queries.length, 2);
const pg = new PGlite();
try {
  await pg.exec(`CREATE TABLE lancamentos (
    id varchar(64) PRIMARY KEY, tenant_id varchar(64) NOT NULL,
    data date, data_vencimento date, data_pagamento date, descricao text,
    categoria varchar(100), fornecedor_beneficiario varchar(255), conta_bancaria varchar(100),
    tipo varchar(20), valor numeric(15,2), status varchar(50), obra_id varchar(64),
    nota_fiscal_id varchar(64), codigo_barras varchar(120), chave_nfe varchar(64),
    observacoes text, conciliado boolean, itens jsonb, created_at timestamptz DEFAULT now()
  )`);
  for (const query of queries) {
    await pg.exec('TRUNCATE lancamentos');
    const save = (l, tenantId = 'tenant-a') => vm.runInNewContext(`(async () => sql\`${query}\`)()`, {
      l, tenantId, dataLanc:'2026-09-13', dataVenc:'2026-09-13', dataPag:null,
      safeObraId:null, safeNotaId:null, itensJson:'[]', itensLancJson:'[]', cleanNum:Number,
      sql: async (parts, ...values) => (await pg.query(parts.reduce((text, part, index) => text + (index ? '$' + index : '') + part, ''), values)).rows
    });
    const original = { id:'record', descricao:'Original', valor:100 };
    const [created] = await save(original);
    assert.ok(created.sync_version);
    const [changed] = await save({ ...original, valor:200, sync_version:created.sync_version });
    assert.ok(changed.sync_version);
    assert.notEqual(changed.sync_version, created.sync_version);
    assert.equal((await save({ ...original, valor:300, sync_version:created.sync_version })).length, 0, 'Edição antiga bloqueada');
    assert.equal((await save({ ...original, valor:400 })).length, 0, 'Cliente legado não sobrescreve registro');
    assert.equal((await save({ ...original, valor:200, sync_version:created.sync_version })).length, 1, 'Retry idêntico é seguro');
    assert.equal((await save({ ...original, valor:999, sync_version:changed.sync_version }, 'tenant-b')).length, 0, 'Tenant não pode alterar registro alheio');
    assert.equal(Number((await pg.query('SELECT valor FROM lancamentos')).rows[0].valor), 200);
    await pg.exec('DELETE FROM lancamentos');
    assert.equal((await save({ ...original, sync_version:changed.sync_version })).length, 0, 'Registro excluído não é recriado por edição antiga');
  }
  console.log('✅ PostgreSQL: gravação individual e em lote, conflito, retry, isolamento e exclusão.');
} finally { await pg.close(); }

const assetPaths = [];
const env = { ASSETS:{ fetch: async request => {
  assetPaths.push(new URL(request.url).pathname);
  return new Response('<html>shell</html>', { headers:{ 'content-type':'text/html' } });
} } };
for (const [path, target] of [['/index.html','/'], ['/app.html','/app'], ['/login.html','/login']]) {
  const response = await worker.fetch(new Request('https://fingo.api.br' + path), env);
  assert.equal(response.status, 308);
  assert.equal(new URL(response.headers.get('location')).pathname, target);
}
for (const [path, file, route] of [['/','/index.html','landing-shell'], ['/app/dashboard','/app.html','app-shell'], ['/login','/login.html','login-shell'], ['/cadastro','/login.html','signup-shell']]) {
  const response = await worker.fetch(new Request('https://fingo.api.br' + path), env);
  assert.equal(response.status, 200);
  assert.equal(assetPaths.at(-1), file);
  assert.equal(response.headers.get('X-FinObra-Route'), route);
  assert.ok(response.headers.get('Content-Security-Policy'));
}
console.log('✅ Worker: redirects canônicos, conteúdo correto e CSP nas rotas públicas e privadas.');
