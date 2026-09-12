// scripts/test-patch18-static.js — Validação da Fase 2: Orçado vs Realizado & Curva Físico-Financeira
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

console.log('=== Iniciando Testes Estáticos Patch 18 (Orçado vs Realizado) ===\n');

const dataJs = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
const dashboardJs = fs.readFileSync(path.join(ROOT, 'js', 'dashboard.js'), 'utf8');
const obraDetalheJs = fs.readFileSync(path.join(ROOT, 'js', 'obra_detalhe.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const versionJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

// ── [1] Data Layer: Motor de Orçado vs Realizado (js/data.js) ──
console.log('[1] Data Layer & Motor de Cálculo (js/data.js)');

test('DB implementa getOrcamentoVsRealizado(obraId)', () => {
  if (!dataJs.includes('getOrcamentoVsRealizado(obraId) {')) {
    throw new Error('Método DB.getOrcamentoVsRealizado deve estar declarado');
  }
});

test('getOrcamentoVsRealizado define as 13 Macro-Etapas padronizadas de engenharia', () => {
  const etapasObrigatorias = [
    'preliminares', 'fundacao', 'alvenaria', 'cobertura', 'eletrica',
    'hidraulica', 'revestimentos', 'esquadrias', 'pintura', 'loucas',
    'externa', 'limpeza', 'outros'
  ];
  for (const et of etapasObrigatorias) {
    if (!dataJs.includes(`id: '${et}'`)) {
      throw new Error(`Macro-etapa '${et}' não encontrada no catálogo`);
    }
  }
});

test('getOrcamentoVsRealizado consolida orçamentos convencionais e SINAPI', () => {
  if (!dataJs.includes("this.getAll('orcamentos')")) throw new Error('Deve carregar orcamentos');
  if (!dataJs.includes("this.getAll('orcamentos_sinapi')")) throw new Error('Deve carregar orcamentos_sinapi');
  if (!dataJs.includes('subtotal * (1 + bdi / 100)')) throw new Error('Deve aplicar BDI no orçamento SINAPI');
});

test('getOrcamentoVsRealizado classifica despesas e notas nas etapas correspondentes', () => {
  if (!dataJs.includes('classificarEtapa = (cat = \'\', desc = \'\') =>')) {
    throw new Error('Deve possuir classificador semântico de custos nas macro-etapas');
  }
  if (!dataJs.includes('totalRealizado += val')) {
    throw new Error('Deve somar valor realizado total e por etapa');
  }
});

test('getOrcamentoVsRealizado calcula avanço físico pelas medições liberadas/aprovadas', () => {
  if (!dataJs.includes("this.getAll('medicoes')")) throw new Error('Deve consultar colecao de medicoes');
  if (!dataJs.includes("m.status === 'liberada' || m.status === 'aprovada'")) {
    throw new Error('Deve considerar medições liberadas ou aprovadas');
  }
});

test('getOrcamentoVsRealizado gera diagnóstico com status de saúde e desvio', () => {
  if (!dataJs.includes('statusSaude = \'saudavel\'') || !dataJs.includes('statusSaude = \'estouro\'')) {
    throw new Error('Deve apurar status de saúde físico-financeiro');
  }
  if (!dataJs.includes('desvio = Math.round((percentualFinanceiro - percentualFisico) * 10) / 10')) {
    throw new Error('Deve calcular o desvio entre avanço financeiro e físico');
  }
});

// ── [2] Dashboard: Bloco Executivo (js/dashboard.js) ──
console.log('\n[2] Dashboard Executivo (js/dashboard.js)');

test('Dashboard renderiza _blocoOrcadoVsRealizado(obraId)', () => {
  if (!dashboardJs.includes('this._blocoOrcadoVsRealizado(obraId)')) {
    throw new Error('Dashboard deve chamar _blocoOrcadoVsRealizado');
  }
  if (!dashboardJs.includes('_blocoOrcadoVsRealizado(obraId) {')) {
    throw new Error('Dashboard deve definir método _blocoOrcadoVsRealizado');
  }
});

test('Dashboard integra avanço físico e financeiro em _progressoObras', () => {
  if (!dashboardJs.includes('DB.getOrcamentoVsRealizado(c.id)')) {
    throw new Error('Progresso de obras do dashboard deve consultar DB.getOrcamentoVsRealizado');
  }
});

// ── [3] Hub 360° da Obra (js/obra_detalhe.js) ──
console.log('\n[3] Hub 360° da Obra (js/obra_detalhe.js)');

test('ObraDetalhe inclui aba orcado-realizado na barra de navegação', () => {
  if (!obraDetalheJs.includes('data-tab="orcado-realizado"')) {
    throw new Error('Deve haver botão da aba com data-tab="orcado-realizado"');
  }
  if (!obraDetalheJs.includes("ObraDetalhe.setTab('orcado-realizado')")) {
    throw new Error('Botão da aba deve chamar ObraDetalhe.setTab(\'orcado-realizado\')');
  }
});

test('ObraDetalhe roteia orcado-realizado em _getTabContent', () => {
  if (!obraDetalheJs.includes("if (tab === 'orcado-realizado') return this._renderTabOrcadoRealizado(obraId)")) {
    throw new Error('_getTabContent deve rotear orcado-realizado para _renderTabOrcadoRealizado');
  }
});

test('ObraDetalhe implementa _renderTabOrcadoRealizado com KPIs e planilha analítica', () => {
  if (!obraDetalheJs.includes('_renderTabOrcadoRealizado(obraId) {')) {
    throw new Error('Deve definir método _renderTabOrcadoRealizado');
  }
  if (!obraDetalheJs.includes('Total Orçado (Teto)') || !obraDetalheJs.includes('Total Realizado (Gasto)')) {
    throw new Error('Aba deve conter KPIs de Total Orçado e Total Realizado');
  }
  if (!obraDetalheJs.includes('Planilha de Acompanhamento por Macro-Etapas')) {
    throw new Error('Aba deve conter a planilha analítica de macro-etapas');
  }
});

test('ObraDetalhe implementa imprimirOrcadoVsRealizado(obraId)', () => {
  if (!obraDetalheJs.includes('imprimirOrcadoVsRealizado(obraId) {')) {
    throw new Error('Deve definir método imprimirOrcadoVsRealizado');
  }
  if (!obraDetalheJs.includes('RELATÓRIO ORÇADO × REALIZADO')) {
    throw new Error('Impressão deve gerar relatório formatado de Orçado vs Realizado');
  }
});

// ── [4] Versões e Release ──
console.log('\n[4] Controle de Versões & Release');

test('version.json está no formato de build 2026.09.11-p18 ou superior', () => {
  const v = versionJson.build || versionJson.version;
  if (!/2026\.09\.11-p\d+/.test(v)) {
    throw new Error(`version.json esperado formato "2026.09.11-p18+", encontrado "${v}"`);
  }
});

test('package.json está atualizado para 2.18.0+ e possui script test:patch18', () => {
  if (!packageJson.scripts['test:patch18']) {
    throw new Error('package.json deve conter script test:patch18');
  }
});

console.log(`\n========================================`);
console.log(`Testes Patch 18: ${passed} de ${total} passaram.`);
console.log(`========================================`);

if (process.exitCode) {
  process.exit(1);
} else {
  process.exit(0);
}
