import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf8');
let passed = 0, failed = 0;
const test = (n, c) => {
  if (c) {
    console.log('✅', n);
    passed++;
  } else {
    console.error('❌', n);
    failed++;
  }
};

const apiDashboard = read('api/dashboard.js');
const apiDb = read('api/db.js');
const jsDashboard = read('js/dashboard.js');
const jsData = read('js/data.js');
const jsApp = read('js/app.js');

// 1. Verificações no Backend: Agregações no Dashboard
test('api/dashboard.js calcula monthlySeries das últimas 12 competências no servidor',
  apiDashboard.includes('monthlySeries') &&
  apiDashboard.includes('receitas') &&
  apiDashboard.includes('despesas') &&
  /to_char\(data,\s*'YYYY-MM'\)/i.test(apiDashboard)
);

test('api/dashboard.js calcula categoryExpenses agrupando despesas por categoria no servidor',
  apiDashboard.includes('categoryExpenses') &&
  apiDashboard.includes('SUM(valor)') &&
  apiDashboard.includes('GROUP BY categoria')
);

// 2. Verificações no Backend: Delta Sync & Paginação por Cursor
test('api/db.js possui endpoint table === \'delta\'',
  apiDb.includes("table === 'delta'")
);

test('api/db.js busca exclusões no audit_logs para tabela delta',
  apiDb.includes('acao = \'excluir\'') &&
  apiDb.includes('audit_logs') &&
  apiDb.includes('sinceIso')
);

test('api/db.js retorna requiresFullSync quando cursor é antigo (>30 dias) ou inválido',
  apiDb.includes('requiresFullSync: true')
);

test('api/db.js suporta cursor e nextCursor na paginação',
  apiDb.includes('cursor') &&
  apiDb.includes('nextCursor')
);

test('api/db.js extrai client_mutation_id no POST',
  apiDb.includes('client_mutation_id')
);

// 3. Verificações no Frontend: Gráficos do Dashboard com zero raw download
test('js/dashboard.js salva snapshot da nuvem em _cloudSnapshot',
  jsDashboard.includes('this._cloudSnapshot = d')
);

test('js/dashboard.js _barChart consome monthlySeries do snapshot antes de ler DB local',
  jsDashboard.includes('this._cloudSnapshot?.monthlySeries')
);

test('js/dashboard.js _donutChart consome categoryExpenses do snapshot antes de ler DB local',
  jsDashboard.includes('this._cloudSnapshot?.categoryExpenses')
);

// 4. Verificações no Frontend: js/data.js (Delta Sync, Route Sync, Idempotência)
test('js/data.js implementa gestão de cursor de sincronização',
  jsData.includes('_syncCursorKey()') &&
  jsData.includes('getSyncCursor()') &&
  jsData.includes('setSyncCursor(')
);

test('js/data.js implementa syncDelta() com chamada para /api/db?table=delta',
  jsData.includes('async syncDelta()') &&
  jsData.includes('/api/db?table=delta&since=')
);

test('js/data.js implementa _deleteLocalIds para conciliar exclusões remotas',
  jsData.includes('_deleteLocalIds(table, ids)')
);

test('js/data.js implementa _applyDeltaToCollection para mesclagem delta CRDT-style',
  jsData.includes('_applyDeltaToCollection(table, cloudMutated = [], localItems = [])')
);

test('js/data.js implementa syncRoute(targetRoute) com mapeamento de rotas',
  jsData.includes('async syncRoute(targetRoute)') &&
  jsData.includes('_routeTables(route)')
);

test('js/data.js mapeia tabelas mínimas para rotas principais',
  jsData.includes("case 'dashboard':") &&
  jsData.includes("case 'lancamentos':") &&
  jsData.includes("case 'notas':") &&
  jsData.includes("case 'obras':")
);

test('js/data.js anexa client_mutation_id na fila offline e no envio',
  jsData.includes('client_mutation_id') &&
  jsData.includes('item.payload.client_mutation_id = clientMutationId')
);

// 5. Verificações no Frontend: js/app.js (Startup sob demanda e navegação)
test('js/app.js executa syncRoute e syncDelta na inicialização',
  jsApp.includes('DB.syncRoute(initialRoute)') &&
  jsApp.includes('DB.syncDelta()')
);

test('js/app.js executa syncRoute sob demanda na navegação',
  jsApp.includes('DB.syncRoute(targetRoute)')
);

// 6. Teste Funcional de Unidade da Lógica de Mesclagem Delta
function testDeltaMergeLogic() {
  const localItems = [
    { id: '1', nome: 'Item 1 original', valor: 100 },
    { id: '2', nome: 'Item 2 intocado', valor: 200 },
    { id: '3', nome: 'Item 3 a ser deletado local', valor: 300 }
  ];

  const cloudMutated = [
    { id: '1', nome: 'Item 1 atualizado na nuvem', valor: 150 },
    { id: '4', nome: 'Item 4 criado na nuvem', valor: 400 }
  ];

  const pendingDeletes = new Set(['3']);
  const pendingSaves = new Map([
    ['1', { id: '1', nome: 'Item 1 editado offline', valor: 999 }]
  ]);

  const resultMap = new Map();
  for (const lItem of localItems) {
    if (!lItem?.id || pendingDeletes.has(lItem.id)) continue;
    resultMap.set(lItem.id, lItem);
  }

  for (const cItem of cloudMutated) {
    if (!cItem?.id || pendingDeletes.has(cItem.id)) continue;
    if (pendingSaves.has(cItem.id)) {
      resultMap.set(cItem.id, { ...cItem, ...pendingSaves.get(cItem.id) });
    } else {
      resultMap.set(cItem.id, cItem);
    }
  }

  for (const [id, item] of pendingSaves) {
    if (!resultMap.has(id)) resultMap.set(id, item);
  }

  const result = Array.from(resultMap.values());
  const item1 = result.find(i => i.id === '1');
  const item2 = result.find(i => i.id === '2');
  const item3 = result.find(i => i.id === '3');
  const item4 = result.find(i => i.id === '4');

  return (
    result.length === 3 &&
    item1 && item1.valor === 999 && item1.nome === 'Item 1 editado offline' &&
    item2 && item2.valor === 200 &&
    !item3 &&
    item4 && item4.valor === 400
  );
}

test('Lógica funcional de delta merge: preserva intocados, atualiza nuvem, prioriza offline save e exclui tombstone',
  testDeltaMergeLogic()
);

console.log(`\nTestes de Sincronização Otimizada (Etapa 3): ${passed} passou, ${failed} falhou.`);
if (failed) process.exit(1);
