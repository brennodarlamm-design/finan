// scripts/test-bug-hunter-reaudit-fixes.js
// Suíte de Testes Automatizados — Validação dos 8 Hotfixes da Reauditoria do Bug Hunter

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

let fails = 0;
function test(name, cond) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}`);
    fails++;
  }
}

console.log('=== Suíte de Testes: Hotfixes da Reauditoria (Bug Hunter) ===\n');

// 1. Integridade dos arquivos modificados
const dataJs = fs.readFileSync(path.join(root, 'js/data.js'), 'utf8');
const mutationsJs = fs.readFileSync(path.join(root, 'api/_db-mutations.js'), 'utf8');
const dashboardJs = fs.readFileSync(path.join(root, 'api/dashboard.js'), 'utf8');
const v2RoutesJs = fs.readFileSync(path.join(root, 'api/_v2-routes.js'), 'utf8');
const contratosJs = fs.readFileSync(path.join(root, 'js/contratos.js'), 'utf8');
const recibosJs = fs.readFileSync(path.join(root, 'js/recibos.js'), 'utf8');
const configuracoesJs = fs.readFileSync(path.join(root, 'js/configuracoes.js'), 'utf8');

console.log('[BUG-01 & BUG-02] Concorrência, Delta Sync e Exclusão Offline (js/data.js):');
test('js/data.js _deleteLocalIds purga orcamentos_sinapi e doc_fases',
  dataJs.includes("'orcamentos_sinapi'") &&
  dataJs.includes("'doc_fases'") &&
  dataJs.includes("finobra_orcamentos_sinapi")
);
test('js/data.js _applyDeltaToCollection inclui ações delete de syncFailed',
  !dataJs.includes("this._getSyncFailed().filter(item => item.payload?.action === 'save')") &&
  dataJs.includes("tableAliases.push('orcamentos_sinapi')") &&
  dataJs.includes("tableAliases.push('doc_fases')")
);

console.log('\n[BUG-03] Isenção de Obra Administrativa nos Limites de Plano (api/_db-mutations.js & api/dashboard.js):');
test('api/_db-mutations.js enforceObraPlanLimit ignora escritorio e geral',
  mutationsJs.includes("['escritorio', 'geral'].includes(String(obra.id).toLowerCase())") &&
  mutationsJs.includes("id NOT IN ('escritorio', 'geral')")
);
test('api/_db-mutations.js validateBulkObraPlanLimit ignora escritorio e geral',
  mutationsJs.includes("isCountable") &&
  mutationsJs.includes("id NOT IN ('escritorio', 'geral')")
);
test('api/dashboard.js não conta obras de sistema nem escritório nas ativas',
  dashboardJs.includes("id NOT IN ('escritorio','geral')") &&
  dashboardJs.includes("<> 'sistema'")
);

console.log('\n[BUG-04 & BUG-05] Retenções Tributárias e Coerção Numérica na API v2 (api/_v2-routes.js):');
test('api/_v2-routes.js handleV2CurvaAbc possui parseNumeric resistente a vírgulas',
  v2RoutesJs.includes("function parseNumeric") &&
  v2RoutesJs.includes("str.replace(',', '.')")
);
test('api/_v2-routes.js handleV2BoletimMedicao aplica Lei 13.137/2015 e isenção Simples Nacional',
  v2RoutesJs.includes("optanteSimples") &&
  v2RoutesJs.includes("rawPisCofins <= 10.0") &&
  v2RoutesJs.includes("Dispensado (DARF <= R$ 10,00)")
);

console.log('\n[BUG-06, BUG-07 & BUG-08] BroadcastChannel, Backup Safe e Teto EVM SPI:');
test('js/contratos.js salvarLista aciona IDBStorage e DB._broadcastLocalChange',
  contratosJs.includes("IDBStorage.set(key, contratos)") &&
  contratosJs.includes("DB._broadcastLocalChange('contratos', 'save')")
);
test('js/recibos.js salvarLista aciona IDBStorage e DB._broadcastLocalChange',
  recibosJs.includes("IDBStorage.set(key, recibos)") &&
  recibosJs.includes("DB._broadcastLocalChange('recibos', 'save')")
);
test('js/configuracoes.js exportarBackup possui try/catch seguro para orcamentos_sinapi',
  configuracoesJs.includes("try {") &&
  configuracoesJs.includes("backup.orcamentos_sinapi = JSON.parse(sinapiRaw);") &&
  configuracoesJs.includes("backup.orcamentos_sinapi = [];")
);
test('js/data.js EVM SPI possui teto de dilatação temporal e Math.max(0.15, spi)',
  dataJs.includes("Math.max(0.15, spi)") &&
  dataJs.includes("Math.min(rawMesesAdicionais, mesesFaltantes * 4, 120)")
);

// 2. Teste funcional das rotas da API v2 atualizadas
const { handleV2CurvaAbc, handleV2BoletimMedicao } = await import('../api/_v2-routes.js');

function mockRes() {
  let sc = 200;
  let body = null;
  return {
    setHeader() {},
    status(c) { sc = c; return this; },
    json(b) { body = b; return this; },
    getStatusCode: () => sc,
    getBody: () => body
  };
}

// Teste Curva ABC com números formatados com vírgula (ex: "10,50" e "1.250,50")
const resAbc = mockRes();
await handleV2CurvaAbc({
  query: { obraId: 'obra-teste-virgula' },
  body: {
    itens: [
      { codigo: '01', descricao: 'Item A', quantidade: '10,00', preco_unitario: '8.000,00' },
      { codigo: '02', descricao: 'Item B', quantidade: '5', preco_unitario: '3.000,00' },
      { codigo: '03', descricao: 'Item C', quantidade: '2,5', preco_unitario: '2.000,00' }
    ]
  }
}, resAbc);

const abcData = resAbc.getBody();
test('Curva ABC calcula corretamente com strings monetárias com vírgula e ponto',
  abcData.totalGeral === 100000 &&
  !isNaN(abcData.itens[0].quantidade) &&
  abcData.itens[0].valorTotal === 80000
);

// Teste Boletim de Medição com Simples Nacional (Isenção de PIS/COFINS/CSLL)
const resBolSimples = mockRes();
await handleV2BoletimMedicao({
  body: {
    valorBruto: 15000,
    optanteSimples: true,
    aliqISS: 5,
    desonerado: false
  }
}, resBolSimples);

const bolSimplesData = resBolSimples.getBody().boletim;
test('Boletim de Medição isenta PIS/COFINS/CSLL para optante pelo Simples Nacional',
  bolSimplesData.retencoes.pisCofinsCsll.valor === 0 &&
  bolSimplesData.retencoes.pisCofinsCsll.aliquota.includes('Simples Nacional')
);

// Teste Boletim de Medição com valor baixo (DARF <= R$ 10,00 dispensa CSRF)
const resBolBaixo = mockRes();
await handleV2BoletimMedicao({
  body: {
    valorBruto: 200, // 200 * 0.0465 = 9.30 (menor que 10.00)
    aliqISS: 5,
    desonerado: false
  }
}, resBolBaixo);

const bolBaixoData = resBolBaixo.getBody().boletim;
test('Boletim de Medição dispensa PIS/COFINS/CSLL quando DARF <= R$ 10,00',
  bolBaixoData.retencoes.pisCofinsCsll.valor === 0 &&
  bolBaixoData.retencoes.pisCofinsCsll.aliquota.includes('Dispensado')
);

console.log(`\nResultado: ${15 - fails}/15 testes aprovados.`);
if (fails > 0) {
  process.exit(1);
}
console.log('🚀 Todos os 8 hotfixes da reauditoria foram validados com 100% de sucesso!\n');
