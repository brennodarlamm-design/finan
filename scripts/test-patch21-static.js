// scripts/test-patch21-static.js — Validação da Fase 5 / Patch 21: BDI Interativo & Editável, Cronograma Customizável & Exportação Modular (Junto ou Separado)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

console.log('=== Iniciando Testes Estáticos Patch 21 (BDI Editável, Cronograma Customizável & Exportação Modular) ===\n');

const obraDetalheJs = fs.readFileSync(path.join(ROOT, 'js', 'obra_detalhe.js'), 'utf8');
const dataJs = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
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

// ── [1] BDI Interativo & Persistência ──
console.log('[1] BDI Interativo & Persistência');

test('DB possui getBDIConfig, saveBDIConfig e saveBDIEmpresaPadrao', () => {
  if (!dataJs.includes('getBDIConfig(obraId, customParams = {})') ||
      !dataJs.includes('saveBDIConfig(obraId, config)') ||
      !dataJs.includes('saveBDIEmpresaPadrao(config)')) {
    throw new Error('Métodos de BDI devem estar presentes no DB em js/data.js');
  }
});

test('ObraDetalhe implementa recálculo dinâmico e persistência de BDI', () => {
  if (!obraDetalheJs.includes('recalcularBDIInput(obraId)') ||
      !obraDetalheJs.includes('salvarBDI(obraId)') ||
      !obraDetalheJs.includes('salvarBDIPadrao(obraId)') ||
      !obraDetalheJs.includes('restaurarBDITCU(obraId)')) {
    throw new Error('ObraDetalhe deve conter recalcularBDIInput, salvarBDI, salvarBDIPadrao e restaurarBDITCU');
  }
});

test('Sub-aba de BDI possui inputs numéricos interativos e mostrador dinâmico', () => {
  if (!obraDetalheJs.includes('id="od-bdi-ac"') ||
      !obraDetalheJs.includes('id="od-bdi-sg"') ||
      !obraDetalheJs.includes('id="od-bdi-r"') ||
      !obraDetalheJs.includes('id="od-bdi-df"') ||
      !obraDetalheJs.includes('id="od-bdi-l"') ||
      !obraDetalheJs.includes('id="od-bdi-t"') ||
      !obraDetalheJs.includes('id="od-bdi-val-display"')) {
    throw new Error('Sub-aba de BDI deve renderizar os inputs para AC, SG, R, DF, L, T e mostrador dinâmico');
  }
});

// ── [2] Cronograma Físico-Financeiro Completo & Editável ──
console.log('\n[2] Cronograma Físico-Financeiro Completo & Editável');

test('DB possui getCronogramaConfig, saveCronogramaConfig e 13 macro-etapas completas', () => {
  if (!dataJs.includes('getCronogramaConfig(obraId)') ||
      !dataJs.includes('saveCronogramaConfig(obraId, config)') ||
      !dataJs.includes('01. Serviços Preliminares & Canteiro') ||
      !dataJs.includes('13. Administração da Obra & Outros')) {
    throw new Error('DB deve suportar configuração personalizada e conter as 13 macro-etapas');
  }
});

test('getCronogramaFisicoFinanceiro estima valores a partir do contrato quando não há orçamento formal', () => {
  if (!dataJs.includes('origem = \'estimativa_contrato\'') ||
      !dataJs.includes('valor_financiado') ||
      !dataJs.includes('origem = \'configuracao_usuario\'')) {
    throw new Error('Motor de cronograma deve estimar a partir do contrato e suportar configuração do usuário');
  }
});

test('ObraDetalhe possui modal para configuração do cronograma com durações e valores previstos', () => {
  if (!obraDetalheJs.includes('abrirModalConfigCronograma(obraId)') ||
      !obraDetalheJs.includes('salvarConfigCronograma(obraId)') ||
      !obraDetalheJs.includes('restaurarConfigCronograma(obraId)')) {
    throw new Error('ObraDetalhe deve conter abrirModalConfigCronograma, salvarConfigCronograma e restaurarConfigCronograma');
  }
});

test('Sub-aba de Cronograma exibe badge com a fonte dos dados e botão de configuração', () => {
  if (!obraDetalheJs.includes('badgeFonte') ||
      !obraDetalheJs.includes('abrirModalConfigCronograma')) {
    throw new Error('Cronograma deve indicar a fonte dos dados e botão de configuração');
  }
});

// ── [3] Exportação Modular em Excel (.xlsx) ──
console.log('\n[3] Exportação Modular em Excel (.xlsx)');

test('ObraDetalhe implementa exportarExcel com suporte aos modos completo, cronograma, curva-abc, orcado-realizado e bdi', () => {
  if (!obraDetalheJs.includes('exportarExcel(modo = \'completo\', obraId = null)') ||
      !obraDetalheJs.includes('modo === \'cronograma\'') ||
      !obraDetalheJs.includes('modo === \'curva-abc\'') ||
      !obraDetalheJs.includes('modo === \'orcado-realizado\'') ||
      !obraDetalheJs.includes('modo === \'bdi\'')) {
    throw new Error('exportarExcel deve aceitar e tratar os 5 modos modulares');
  }
});

test('Cálculo de largura de colunas no Excel itera com segurança em todas as linhas', () => {
  if (!obraDetalheJs.includes('let maxCols = 0;') ||
      !obraDetalheJs.includes('Array.isArray(data[r]) && data[r].length > maxCols')) {
    throw new Error('addSheet deve calcular maxCols iterando sobre todas as linhas para evitar erro de colunas');
  }
});

test('Compatibilidade retroativa de exportarExcelEngenharia garantida', () => {
  if (!obraDetalheJs.includes('exportarExcelEngenharia(obraId) {') ||
      !obraDetalheJs.includes('this.exportarExcel(\'completo\', obraId)')) {
    throw new Error('exportarExcelEngenharia deve continuar funcionando como wrapper de exportarExcel(\'completo\')');
  }
});

// ── [4] Impressão / PDF Modular (Junto ou Separado) ──
console.log('\n[4] Impressão / PDF Modular (Junto ou Separado)');

test('ObraDetalhe implementa imprimir(modo, obraId) com os 5 modos', () => {
  if (!obraDetalheJs.includes('imprimir(modo = \'completo\', obraId = null)') ||
      !obraDetalheJs.includes('CRONOGRAMA FÍSICO-FINANCEIRO MENSAL OFICIAL') ||
      !obraDetalheJs.includes('CURVA ABC DE INSUMOS & SERVIÇOS (PARETO 80/20)') ||
      !obraDetalheJs.includes('MEMÓRIA DE CÁLCULO OFICIAL DE BDI & ENCARGOS SOCIAIS')) {
    throw new Error('imprimir deve suportar emissão dedicada de cada módulo');
  }
});

test('Modal abrirMenuExportar oferece escolha visual entre Tudo Junto e Separado', () => {
  if (!obraDetalheJs.includes('abrirMenuExportar(tipo, obraId)') ||
      !obraDetalheJs.includes('Dossiê Completo de Engenharia (Tudo Junto)') ||
      !obraDetalheJs.includes('Apenas Cronograma Físico-Financeiro Mensal') ||
      !obraDetalheJs.includes('Apenas Curva ABC de Insumos & Serviços (Pareto 80/20)')) {
    throw new Error('abrirMenuExportar deve renderizar o modal com opções completas e individuais');
  }
});

test('Compatibilidade retroativa de imprimirOrcadoVsRealizado e exportarPDFEngenharia', () => {
  if (!obraDetalheJs.includes('imprimirOrcadoVsRealizado(obraId) {') ||
      !obraDetalheJs.includes('exportarPDFEngenharia(obraId) {')) {
    throw new Error('Aliases de impressão devem continuar disponíveis');
  }
});

// ── [5] Versão e Metadados ──
console.log('\n[5] Versão e Metadados');

test('package.json está na versão 2.21.0', () => {
  if (packageJson.version !== '2.21.0') {
    throw new Error(`Esperado v2.21.0 no package.json, obtido ${packageJson.version}`);
  }
});

test('version.json está alinhado com 2.21.0', () => {
  if (versionJson.version !== '2.21.0') {
    throw new Error(`Esperado 2.21.0 no version.json, obtido ${versionJson.version}`);
  }
});

console.log(`\n=== Resumo dos Testes Patch 21: ${passed}/${total} passaram ===\n`);
if (passed === total) {
  console.log('🎉 Todos os testes estáticos do Patch 21 passaram com sucesso!');
} else {
  process.exit(1);
}
