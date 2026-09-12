// scripts/test-patch19-static.js — Validação da Fase 3: Engenharia de Custos, Planejamento & Orçamentação Avançada
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

console.log('=== Iniciando Testes Estáticos Patch 19 (Engenharia de Custos & Planejamento) ===\n');

const dataJs = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
const dashboardJs = fs.readFileSync(path.join(ROOT, 'js', 'dashboard.js'), 'utf8');
const obraDetalheJs = fs.readFileSync(path.join(ROOT, 'js', 'obra_detalhe.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const versionJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));

let passed = 0;
let total = 0;
function test(name, fn) {
  total++;
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}: ${err.message}`); process.exitCode = 1; }
}
function releasePatch(meta) {
  const m = String(meta?.build || '').match(/^20\d{2}\.\d{2}\.\d{2}-p(\d+)/i);
  return m ? Number(m[1]) : -1;
}
function semverAtLeast(version, major, minor) {
  const [maj=0, min=0] = String(version || '').split('.').map(Number);
  return maj > major || (maj === major && min >= minor);
}

console.log('[1] Data Layer: Curva S & Previsão EVM (js/data.js)');
test('DB implementa getCurvaS(obraId)', () => {
  if (!dataJs.includes('getCurvaS(obraId) {')) throw new Error('Método DB.getCurvaS deve estar implementado');
});
test('getCurvaS calcula PV pela curva harmônica/sigmoide', () => {
  if (!dataJs.includes('0.5 - 0.5 * Math.cos(Math.PI * (t / totalMeses))')) throw new Error('Cálculo de PV deve utilizar função harmônica sigmoide padrão');
});
test('getCurvaS calcula indicadores de Valor Agregado EVM (CPI, SPI, EAC, VAC)', () => {
  if (!dataJs.includes('cpi = acAtual > 0') || !dataJs.includes('spi = pvAtual > 0')) throw new Error('Deve calcular CPI (EV/AC) e SPI (EV/PV)');
  if (!dataJs.includes('eac = cpi > 0 ? Math.round(bac / cpi) : bac')) throw new Error('Deve calcular EAC (BAC/CPI)');
  if (!dataJs.includes('vac = bac - eac')) throw new Error('Deve calcular VAC (BAC - EAC)');
});
test('getCurvaS gera projeção futura (Forecast) conectando mês atual ao término', () => {
  if (!dataJs.includes('forecastData[mesAtualIdx] = acAtual')) throw new Error('Curva de projeção deve partir do ponto atual de custo real');
  if (!dataJs.includes('Math.round(acAtual + deltaCusto * progress)')) throw new Error('Deve interpolar a curva de tendência até o término');
});

console.log('\n[2] Data Layer: Cronograma Físico-Financeiro (js/data.js)');
test('DB implementa getCronogramaFisicoFinanceiro(obraId)', () => {
  if (!dataJs.includes('getCronogramaFisicoFinanceiro(obraId) {')) throw new Error('Método DB.getCronogramaFisicoFinanceiro deve estar implementado');
});
test('getCronogramaFisicoFinanceiro define perfis de distribuição temporal por macro-etapa', () => {
  if (!dataJs.includes('perfisEtapas = {') || !dataJs.includes('preliminares:') || !dataJs.includes('fundacao:')) throw new Error('Deve definir perfis técnicos ponderados de evolução por etapa');
});
test('getCronogramaFisicoFinanceiro calcula totais mensais e acumulados', () => {
  if (!dataJs.includes('totaisMensais = mesesKeys.map')) throw new Error('Deve calcular desembolsos previstos por mês');
  if (!dataJs.includes('totaisAcumulados = totaisMensais.map')) throw new Error('Deve calcular avanço acumulado que alimenta a Curva S');
});

console.log('\n[3] Data Layer: Curva ABC / Pareto (js/data.js)');
test('DB implementa getCurvaABC(obraId)', () => {
  if (!dataJs.includes('getCurvaABC(obraId) {')) throw new Error('Método DB.getCurvaABC deve estar implementado');
});
test('getCurvaABC aplica classificação de Pareto (Classe A: 80%, Classe B: 15%, Classe C: 5%)', () => {
  if (!dataJs.includes('pctAcumulado <= 80 || idx === 0')) throw new Error('Classe A deve concentrar os primeiros 80% do valor acumulado');
  if (!dataJs.includes('pctAcumulado <= 95')) throw new Error('Classe B deve cobrir o intervalo de 80% a 95% do valor');
  if (!dataJs.includes('classeA: totalClasseA,') || !dataJs.includes('classeB: totalClasseB,') || !dataJs.includes('classeC: totalClasseC,')) throw new Error('Deve retornar estatísticas consolidadas para as 3 classes ABC');
});

console.log('\n[4] Data Layer: Leis Sociais & BDI Oficial (js/data.js)');
test('DB implementa getLeisSociais com Grupos A, B, C e D', () => {
  if (!dataJs.includes('getLeisSociais(desonerado = false) {')) throw new Error('Método DB.getLeisSociais deve estar implementado');
  if (!dataJs.includes("codigo: 'A1'") || !dataJs.includes("codigo: 'B1'") || !dataJs.includes("codigo: 'C1'") || !dataJs.includes("codigo: 'D1'")) throw new Error('Deve discriminar encargos trabalhistas nos 4 grupos oficiais');
  if (!dataJs.includes('INSS Patronal') || !dataJs.includes('FGTS') || !dataJs.includes('Férias Anuais')) throw new Error('Deve conter rubricas oficiais da CLT e convenção da construção civil');
});
test('DB implementa getBDIConfig pela fórmula oficial do TCU (Acórdão 2622/2013)', () => {
  if (!dataJs.includes('getBDIConfig(obraId, customParams = {}) {')) throw new Error('Método DB.getBDIConfig deve estar implementado');
  if (!dataJs.includes('BDI = [ ( (1 + AC + S + R + G) * (1 + DF) * (1 + L) ) / (1 - I) ] - 1')) throw new Error('Fórmula oficial do Acórdão 2622/2013 TCU deve ser utilizada');
  if (!dataJs.includes('faixaReferenciaTCU: {')) throw new Error('Deve incluir faixas de referência e quartis do TCU');
});

console.log('\n[5] Hub 360° da Obra & Interface Executiva (js/obra_detalhe.js)');
test('ObraDetalhe define suporte a sub-abas de engenharia e inicialização', () => {
  if (!obraDetalheJs.includes("subTabOrcado: 'curva-s'")) throw new Error('ObraDetalhe deve ter subTabOrcado inicial');
  if (!obraDetalheJs.includes('setSubTabOrcado(subTab) {')) throw new Error('ObraDetalhe deve ter método setSubTabOrcado');
  if (!obraDetalheJs.includes('setRegimeLeisSociais(desonerado) {')) throw new Error('ObraDetalhe deve ter método setRegimeLeisSociais');
});
test('ObraDetalhe renderiza gráficos da Curva S e Curva ABC com Chart.js', () => {
  if (!obraDetalheJs.includes('_renderCurvaSChart(obraId) {')) throw new Error('Deve implementar _renderCurvaSChart');
  if (!obraDetalheJs.includes('_renderCurvaABCChart(obraId) {')) throw new Error('Deve implementar _renderCurvaABCChart');
  if (!obraDetalheJs.includes('canvas id="ch-curva-s"') || !obraDetalheJs.includes('canvas id="ch-curva-abc"')) throw new Error('Deve declarar elementos canvas para Curva S e Curva ABC');
});
test('ObraDetalhe implementa as 4 sub-visões de engenharia', () => {
  if (!obraDetalheJs.includes('_renderSubTabCurvaS(obraId)')) throw new Error('Deve implementar sub-aba de Curva S');
  if (!obraDetalheJs.includes('_renderSubTabCronograma(obraId)')) throw new Error('Deve implementar sub-aba de Cronograma Físico-Financeiro');
  if (!obraDetalheJs.includes('_renderSubTabCurvaABC(obraId)')) throw new Error('Deve implementar sub-aba de Curva ABC');
  if (!obraDetalheJs.includes('_renderSubTabLeisSociaisBDI(obraId)')) throw new Error('Deve implementar sub-aba de Leis Sociais & BDI');
});

console.log('\n[6] Dashboard Executivo (js/dashboard.js)');
test('Dashboard exibe indicadores de Curva S e Forecast (EAC)', () => {
  if (!dashboardJs.includes('DB.getCurvaS ? DB.getCurvaS(obraId) : null')) throw new Error('Dashboard deve consultar DB.getCurvaS');
  if (!dashboardJs.includes('Custo no Término (EAC)')) throw new Error('Dashboard deve exibir KPI de Custo no Término (EAC)');
});

console.log('\n[7] Controle de Versões & Release');
test('version.json representa Patch 19 ou superior', () => {
  const patch = releasePatch(versionJson);
  if (patch < 19) throw new Error(`version.json deve representar patch >=19; encontrado "${versionJson.build || versionJson.version}"`);
});
test('package.json está atualizado para 2.19.0+ e possui script test:patch19', () => {
  if (!semverAtLeast(packageJson.version, 2, 19)) throw new Error(`package.json deve ser >=2.19.0; encontrado ${packageJson.version}`);
  if (!packageJson.scripts['test:patch19']) throw new Error('package.json deve conter script test:patch19');
});

console.log(`\n========================================`);
console.log(`Testes Patch 19: ${passed} de ${total} passaram.`);
console.log(`========================================`);
if (process.exitCode) process.exit(1);
