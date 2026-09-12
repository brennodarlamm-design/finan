// scripts/test-patch20-static.js — Validação da Fase 4 / Patch 20: Exportação XLSX Multi-Aba & PDF Oficial de Engenharia
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

console.log('=== Iniciando Testes Estáticos Patch 20 (Exportação Excel XLSX & Relatório PDF de Engenharia) ===\n');

const obraDetalheJs = fs.readFileSync(path.join(ROOT, 'js', 'obra_detalhe.js'), 'utf8');
const exportarJs = fs.readFileSync(path.join(ROOT, 'js', 'exportar.js'), 'utf8');
const exportarTemplatesJs = fs.readFileSync(path.join(ROOT, 'js', 'exportar_templates.js'), 'utf8');
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

console.log('[1] ObraDetalhe: Motor de Exportação Excel (.xlsx)');
test('ObraDetalhe implementa exportarExcelEngenharia(obraId)', () => {
  if (!obraDetalheJs.includes('exportarExcelEngenharia(obraId) {')) throw new Error('Método ObraDetalhe.exportarExcelEngenharia deve estar implementado');
});
test('exportarExcelEngenharia gera pasta de trabalho XLSX com as 4 abas estruturadas', () => {
  const abasEsperadas = ['Cronograma Físico-Financ','Curva ABC','Orçado vs Realizado','BDI e Leis Sociais'];
  for (const aba of abasEsperadas) if (!obraDetalheJs.includes(`'${aba}'`)) throw new Error(`Aba "${aba}" deve ser adicionada à pasta de trabalho XLSX`);
});
test('exportarExcelEngenharia inclui linhas consolidadas de desembolso mensal e Curva S acumulada', () => {
  if (!obraDetalheJs.includes('DESEMBOLSO MENSAL PREVISTO (R$)') || !obraDetalheJs.includes('AVANÇO FÍSICO ACUMULADO (CURVA S %)')) throw new Error('Planilha de Cronograma deve incluir linhas de desembolso e Curva S acumulada');
});
test('exportarExcelEngenharia inclui métricas de Valor Agregado EVM (BAC, PV, EV, AC, CPI, SPI, EAC, VAC)', () => {
  if (!obraDetalheJs.includes('GESTÃO DE VALOR AGREGADO (EVM)') || !obraDetalheJs.includes('Índice de Desempenho de Custo (CPI)') || !obraDetalheJs.includes('Estimativa de Custo no Término (EAC)')) throw new Error('Aba Orçado vs Realizado deve conter indicadores analíticos de EVM');
});
test('exportarExcelEngenharia faz download nomeado seguro via Blob com fallback XLSX.writeFile', () => {
  if (!obraDetalheJs.includes('Dossie_Engenharia_') || !obraDetalheJs.includes('URL.createObjectURL(blob)') || !obraDetalheJs.includes('XLSX.writeFile(wb, nomeArq)')) throw new Error('Download do Excel deve seguir a convenção segura com fallback');
});

console.log('\n[2] ObraDetalhe: Motor de Exportação PDF Oficial A4');
test('ObraDetalhe implementa exportarPDFEngenharia(obraId)', () => {
  if (!obraDetalheJs.includes('exportarPDFEngenharia(obraId) {')) throw new Error('Método ObraDetalhe.exportarPDFEngenharia deve estar implementado');
});
test('imprimirOrcadoVsRealizado configura layout A4 Landscape com CSS de impressão e barra sem impressão', () => {
  if (!obraDetalheJs.includes('@page { size: A4 landscape; margin: 8mm; }') || !obraDetalheJs.includes('.no-print { display: none !important; }')) throw new Error('Documento de impressão deve ter regras @page A4 landscape e ocultação de .no-print');
});
test('Relatório PDF inclui cabeçalho com logo, contrato Caixa, KPIs EVM e conformidade TCU', () => {
  if (!obraDetalheJs.includes('DOSSIÊ EXECUTIVO DE ENGENHARIA DE CUSTOS') || !obraDetalheJs.includes('Contrato Caixa:') || !obraDetalheJs.includes('TCU Acórdão 2622/2013')) throw new Error('Relatório PDF deve conter identificação completa e embasamento legal');
});
test('Relatório PDF possui quadro de responsabilidade técnica e assinaturas com CREA/CAU', () => {
  if (!obraDetalheJs.includes('class="signatures"') || !obraDetalheJs.includes('CREA / CAU:')) throw new Error('Relatório PDF deve conter campo formal de assinatura para ART/RRT');
});

console.log('\n[3] Botões e Ações no Hub da Obra');
test('Barra de ferramentas do Hub da Obra possui botões Exportar Excel e Exportar PDF', () => {
  if (!obraDetalheJs.includes("ObraDetalhe.exportarExcelEngenharia('${obraId}')") || !obraDetalheJs.includes("ObraDetalhe.exportarPDFEngenharia('${obraId}')")) throw new Error('Cabeçalho da aba de Orçado vs Realizado deve conter botões diretos de Excel e PDF');
});
test('Sub-aba de Cronograma possui botões de ação para Excel e PDF', () => {
  if (!obraDetalheJs.includes('📊 Baixar Excel (.xlsx)') || !obraDetalheJs.includes('📄 Imprimir / PDF A4')) throw new Error('Sub-aba de Cronograma deve disponibilizar botões de exportação');
});

console.log('\n[4] Integração no Módulo Geral de Exportações');
test('exportar.js inclui botão para Dossiê de Engenharia no card Excel', () => {
  if (!exportarJs.includes("Exportar.exportarExcel('engenharia')")) throw new Error('Card Excel deve oferecer botão para Dossiê de Engenharia');
});
test('exportar.js inclui opção "engenharia" no seletor de modelos de relatório PDF', () => {
  if (!exportarJs.includes('value="engenharia"')) throw new Error('Select de relatórios PDF deve conter opção para Dossiê de Engenharia');
});
test('exportar.js delega tipo engenharia para ObraDetalhe.exportarExcelEngenharia', () => {
  if (!exportarJs.includes("if (tipo === 'engenharia')") || !exportarJs.includes('ObraDetalhe.exportarExcelEngenharia(obraId)')) throw new Error('exportarExcel deve delegar geração de engenharia para ObraDetalhe');
});
test('exportar_templates.js implementa template formatado para type === "engenharia"', () => {
  if (!exportarTemplatesJs.includes("if (type === 'engenharia')") || !exportarTemplatesJs.includes('Dossiê Executivo de Engenharia de Custos')) throw new Error('ExportarTemplates deve conter o gerador HTML do Dossiê de Engenharia');
});

console.log('\n[5] Versão e Scripts de Pipeline');
test('version.json representa Patch 20 ou superior', () => {
  const patch = releasePatch(versionJson);
  if (patch < 20) throw new Error(`version.json deve representar patch >=20; encontrado "${versionJson.build || versionJson.version}"`);
});
test('package.json está em 2.20.0 ou superior e contém script test:patch20', () => {
  if (!semverAtLeast(packageJson.version, 2, 20)) throw new Error(`package.json versão esperada >=2.20.0, encontrada "${packageJson.version}"`);
  if (!packageJson.scripts['test:patch20']) throw new Error('package.json deve conter script test:patch20');
});

console.log(`\n========================================`);
console.log(`Testes Patch 20: ${passed} de ${total} passaram.`);
console.log(`========================================`);
if (process.exitCode) process.exit(1);
