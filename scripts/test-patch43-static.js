import fs from 'fs';
import vm from 'vm';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Patch 43: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

const dataJs = fs.readFileSync('js/data.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = JSON.parse(fs.readFileSync('version.json', 'utf8'));

console.log('=== Patch 43 — Auditoria do Sync Engine, Ordenação Relacional e Resiliência Offline ===\n');

// 1. Verificação Estática de Código em js/data.js
assert(
  dataJs.includes('_getDependencyPriority(item)'),
  'js/data.js implementa analisador de prioridade por dependência relacional.'
);

assert(
  dataJs.includes('_sortQueueByDependency(queue)'),
  'js/data.js implementa algoritmo de ordenação topológica da fila offline.'
);

assert(
  dataJs.includes('const queue = this._sortQueueByDependency(rawQueue);'),
  'js/data.js aplica ordenação por dependência antes de selecionar o próximo item no _flushCloudQueue.'
);

assert(
  dataJs.includes('fases_doc'),
  'js/data.js purgeStorage limpa anexos pesados de fases de obras em contingência de espaço.'
);

// 2. Teste Comportamental em Contexto VM
const storage = new Map();
const context = vm.createContext({
  console,
  URLSearchParams,
  localStorage: {
    getItem: k => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k),
    key: idx => Array.from(storage.keys())[idx] ?? null,
    get length() { return storage.size; }
  }
});

const DB = vm.runInContext(`${dataJs}\nDB;`, context);

// Teste de prioridade para operações de 'save'
const prioObra = DB._getDependencyPriority({ payload: { table: 'obras', action: 'save' } });
const prioFornecedor = DB._getDependencyPriority({ payload: { table: 'fornecedores', action: 'save' } });
const prioConta = DB._getDependencyPriority({ payload: { table: 'contas', action: 'save' } });
const prioLancamento = DB._getDependencyPriority({ payload: { table: 'lancamentos', action: 'save' } });
const prioNota = DB._getDependencyPriority({ payload: { table: 'notas', action: 'save' } });
const prioDoc = DB._getDependencyPriority({ payload: { table: 'documentos', action: 'save' } });

assert(prioObra === 1 && prioFornecedor === 1 && prioConta === 1, 'Entidades pai fundamentais (obras, fornecedores, contas) têm Prioridade 1 no save.');
assert(prioLancamento === 3 && prioNota === 3, 'Entidades dependentes (lançamentos, notas) têm prioridade posterior (Nível 3) no save.');
assert(prioDoc === 4, 'Anexos e documentos têm prioridade Nível 4 no save.');
assert(prioObra < prioLancamento, 'Obra precede Lançamento no envio à nuvem, prevenindo violação de FK.');

// Teste de prioridade para operações de 'delete' (filhas excluídas antes dos pais)
const delLanc = DB._getDependencyPriority({ payload: { table: 'lancamentos', action: 'delete' } });
const delObra = DB._getDependencyPriority({ payload: { table: 'obras', action: 'delete' } });
assert(delLanc < delObra, 'Na exclusão, registros dependentes são deletados antes da entidade pai.');

// Teste de ordenação de fila mista
const filaDesordenada = [
  { queueId: '1', payload: { table: 'documentos', action: 'save' }, createdAt: '2026-09-14T10:00:00Z' },
  { queueId: '2', payload: { table: 'lancamentos', action: 'save', data: { obra_id: 'obra-1' } }, createdAt: '2026-09-14T10:01:00Z' },
  { queueId: '3', payload: { table: 'obras', action: 'save', data: { id: 'obra-1' } }, createdAt: '2026-09-14T10:02:00Z' },
  { queueId: '4', payload: { table: 'fornecedores', action: 'save' }, createdAt: '2026-09-14T10:03:00Z' }
];

const filaOrdenada = DB._sortQueueByDependency(filaDesordenada);
assert(filaOrdenada[0].payload.table === 'obras', 'Obra passa à frente do lançamento após ordenação de dependências.');
assert(filaOrdenada[1].payload.table === 'fornecedores', 'Fornecedor é priorizado antes do lançamento financeiro.');
assert(filaOrdenada[2].payload.table === 'lancamentos', 'Lançamento é enviado após os pais existirem.');
assert(filaOrdenada[3].payload.table === 'documentos', 'Documentos são enviados na retaguarda.');

// Teste do purgeStorage com anexos pesados
const docKey = DB._fasesDocKey('obra-1');
storage.set(docKey, JSON.stringify({
  durante_obra: [
    { id: 'doc-1', nome: 'Alvará', arquivos: [{ id: 'a1', nome: 'alvara.pdf', base64: 'JVBERi0xLjQK...' }] }
  ]
}));

DB.purgeStorage();
const cleanedDoc = JSON.parse(storage.get(docKey) || '{}');
assert(!cleanedDoc.durante_obra[0].arquivos[0].base64, 'purgeStorage expurgou com sucesso dados binários pesados de doc_fases.');
assert(cleanedDoc.durante_obra[0].arquivos[0].nome === 'alvara.pdf', 'purgeStorage preservou metadados do arquivo intactos.');

// 3. Versionamento e Pacote
assert(pkg.scripts?.['test:patch43'] === 'node scripts/test-patch43-static.js', 'package.json expõe comando test:patch43.');
assert(pkg.version >= '2.32.0', 'package.json está na versão >= 2.32.0.');
assert(version.version >= '2.32.0', 'version.json está na versão >= 2.32.0.');
assert(/-p(43|[4-9]\d|\d{3,})\b/.test(version.build || ''), 'version.json registra build com sufixo >= -p43.');

console.log('\n🎉 Patch 43: todas as 15 verificações passaram com 100% de sucesso!');
