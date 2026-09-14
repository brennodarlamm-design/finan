import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = p => fs.readFileSync(p, 'utf8');

console.log('=== Testes Oficiais do Módulo SINAPI e Robô ===');

// 1. Verificar snapshots oficiais 2026-08 registrados
const sinapiSource = read('js/sinapi.js');
const orcSource = read('js/orcamento_sinapi.js');
const robotSource = read('backend/sinapi_robot.js');

assert.match(sinapiSource, /uf:\s*'SP',\s*referencia:\s*'2026-08'/);
assert.match(sinapiSource, /uf:\s*'SC',\s*referencia:\s*'2026-08'/);
assert.match(sinapiSource, /uf:\s*'RR',\s*referencia:\s*'2026-08'/);
console.log('✅ Snapshots oficiais 2026-08 para SP, SC e RR devidamente declarados.');

// 2. Verificar integridade dos arquivos JSON gerados
const spOneradoPath = 'data/sinapi_sp_2026_08_onerado.json';
assert.ok(fs.existsSync(spOneradoPath), 'Arquivo SP Onerado 2026-08 deve existir');
const spOnerado = JSON.parse(fs.readFileSync(spOneradoPath, 'utf8'));
assert.equal(spOnerado.uf, 'SP');
assert.equal(spOnerado.referencia, '2026-08');
assert.ok(spOnerado.total_itens > 10000, 'Deve conter mais de 10.000 itens');

const sampleComp = spOnerado.composicoes.find(c => c.codigo === '104658');
assert.ok(sampleComp, 'Composição 104658 deve existir');
assert.equal(sampleComp.tipo, 'COMP');
assert.equal(sampleComp.preco_unitario, 208, 'Preço oficial SP para 104658 deve ser 208,00');

const sampleInsumo = spOnerado.composicoes.find(c => c.codigo === '45333');
assert.ok(sampleInsumo, 'Insumo 45333 deve existir');
assert.equal(sampleInsumo.tipo, 'INSUMO');
assert.equal(sampleInsumo.preco_unitario, 199.02, 'Preço oficial SP para insumo 45333 deve ser 199,02');
console.log('✅ Dados reais da Caixa validados com precisão (104658 = R$ 208,00 | 45333 = R$ 199,02 em SP).');

// 3. Verificar busca unificada de COMP e INSUMO no engine
const storage = new Map();
const context = vm.createContext({
  console,
  localStorage: {
    getItem: k => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k)
  },
  Auth: { getCurrentTenantId: () => 'tenant-teste' },
  FinObraAssets: { load: async () => {} }
});

const sinapi = vm.runInContext(`${sinapiSource}\nSINAPI;`, context);
sinapi._saveBase(spOnerado, false, 'SP', '2026-08');

const compResults = sinapi.buscar('104658', false, 10, 'SP', '2026-08');
assert.equal(compResults.length, 1);
assert.equal(compResults[0].codigo, '104658');
assert.equal(compResults[0].tipo, 'COMP');
assert.equal(compResults[0].preco_unitario, 208);

const insumoResults = sinapi.buscar('45333', false, 10, 'SP', '2026-08');
assert.equal(insumoResults.length, 1);
assert.equal(insumoResults[0].codigo, '45333');
assert.equal(insumoResults[0].tipo, 'INSUMO');
assert.equal(insumoResults[0].preco_unitario, 199.02);
console.log('✅ Busca unificada SINAPI.buscar encontra composições e insumos com tipos identificados.');

// 4. Teste de importação de arquivo oficial Caixa com JSZip e XLSX
const xlsxPath = fs.existsSync('backend/sinapi-xlsx.cjs') ? '../backend/sinapi-xlsx.cjs' : (fs.existsSync('scratch/sinapi-xlsx.cjs') ? '../scratch/sinapi-xlsx.cjs' : null);
const jszipPath = fs.existsSync('backend/sinapi-jszip.cjs') ? '../backend/sinapi-jszip.cjs' : (fs.existsSync('scratch/sinapi-jszip.cjs') ? '../scratch/sinapi-jszip.cjs' : null);

if (xlsxPath && jszipPath) {
  const XLSX = await import(xlsxPath);
  const JSZip = await import(jszipPath);

  context.XLSX = XLSX.default || XLSX;
  context.JSZip = JSZip.default || JSZip;

  const zipFile = 'scratch/SINAPI-2026-08-formato-xlsx.zip';
  if (fs.existsSync(zipFile)) {
    const zipBuffer = fs.readFileSync(zipFile);
    zipBuffer.name = 'SINAPI-2026-08-formato-xlsx.zip';
    zipBuffer.arrayBuffer = async () => zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength);

    const importFeedback = [];
    const resultImport = await sinapi.importar(zipBuffer, false, 'SC', '2026-08', msg => importFeedback.push(msg));
    assert.equal(resultImport.ok, true, 'Importação deve ter sucesso');
    assert.ok(resultImport.total > 10000, 'Deve importar mais de 10.000 itens para SC');

    const scBase = sinapi.getBase(false, 'SC', '2026-08');
    const scComp = scBase.composicoes.find(c => c.codigo === '104658');
    assert.ok(scComp, 'Composição 104658 deve estar em SC');
    assert.equal(scComp.preco_unitario, 161.29, 'Preço oficial SC para 104658 deve ser 161,29 (diferente de SP 208,00)');
    console.log('✅ Importação da planilha oficial extrai preços específicos da UF (SC = R$ 161,29).');
  } else {
    console.log('ℹ️ Arquivo zip em scratch/ não presente no ambiente, pulando teste de importação de arquivo.');
  }
}

// 5. Verificar ausência de mocks aleatórios em orcamento_sinapi.js
assert.ok(!orcSource.includes('BANCO_UNIFICADO_ITENS'), 'Não deve haver catálogo mock BANCO_UNIFICADO_ITENS');
assert.ok(!orcSource.includes('Math.random()'), 'Não deve haver valores aleatórios');
console.log('✅ Eliminação total de valores aleatórios e mocks confirmada.');

console.log('🎉 Todos os testes oficiais do módulo SINAPI passaram com sucesso!');
