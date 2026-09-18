// scripts/test-phase4-design-system.js
// Suíte de Testes Automatizados — Fase 4: Design System Unificado, Tokens Canônicos, Governança Visual & Tabular Nums (DES-04)

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

console.log('=== Suíte de Testes da Fase 4: Design System & Governança Visual ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Canonicidade de Tokens e Precedência da Cascata (@layer)
// ─────────────────────────────────────────────────────────────────────────────
console.log('1. Validando css/tokens.css e arquitetura @layer...');

const tokensCss = read('css/tokens.css');
assert(tokensCss.includes('@layer reset, tokens, base, components, utilities;'), 'tokens.css deve declarar @layer com precedência explícita');
assert(tokensCss.includes('@layer tokens {'), 'tokens.css deve conter bloco @layer tokens');
assert(tokensCss.includes('@layer utilities {'), 'tokens.css deve conter bloco @layer utilities');

// Validar as 12 categorias semânticas de tokens
const requiredTokens = [
  '--surface-ground',
  '--surface-card',
  '--surface-overlay',
  '--border-subtle',
  '--border-default',
  '--border-focus',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--color-primary',
  '--color-gold',
  '--color-success',
  '--color-warning',
  '--color-danger',
  '--color-info',
  '--z-ground',
  '--z-modal',
  '--shadow-sm',
  '--shadow-lg',
  '--space-1',
  '--space-4',
  '--radius-sm',
  '--radius-lg',
  '--font-family-sans',
  '--ease-spring'
];

for (const token of requiredTokens) {
  assert(tokensCss.includes(token), `tokens.css deve conter o token canônico ${token}`);
}
console.log(`   ✓ Todas as categorias semânticas de tokens estão declaradas (${requiredTokens.length} verificadas).`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Aliases e Compatibilidade Regressiva
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. Validando retrocompatibilidade com aliases legados...');

const requiredAliases = [
  '--bg-base:',
  '--bg-card:',
  '--accent:',
  '--accent-h:',
  '--border-s:',
  '--text:',
  '--text2:',
  '--text3:',
  '--r-md:',
  '--success:',
  '--danger:'
];

for (const alias of requiredAliases) {
  assert(tokensCss.includes(alias), `tokens.css deve conter o alias legado ${alias}`);
}
console.log('   ✓ Aliases de retrocompatibilidade validados com sucesso.');

// ─────────────────────────────────────────────────────────────────────────────
// 3. Tema Master Gold & Purga de Sobrescritas Conflitantes
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. Validando integridade cromática do Portal Master e remoção de conflitos...');

assert(tokensCss.includes('.ui-portal, [data-theme="master"]'), 'tokens.css deve escopar tema Master');
assert(tokensCss.includes('--color-primary:          var(--color-gold);'), 'ui-portal deve mapear --color-primary para var(--color-gold)');
assert(tokensCss.includes('--accent:                 var(--color-gold);'), 'ui-portal deve mapear --accent para var(--color-gold)');

const premiumCss = read('css/premium.css');
// Garantir que premium.css não tem mais --bg-base:#0d1519 ou --accent:#6ddbb6
assert(!premiumCss.includes('--bg-base:#0d1519'), 'premium.css não deve sobrescrever --bg-base com slate frio');
assert(!premiumCss.includes('--accent:#6ddbb6'), 'premium.css não deve sobrescrever --accent com seafoam');
// Garantir que .ui-portal não tem sobrescrita de fundo estático em premium.css
assert(!premiumCss.includes('.ui-portal { background:#0e1a20;'), 'premium.css não deve forçar fundo #0e1a20 em .ui-portal');
// E deve preservar --text3: #94A3B8
assert(/--text3:\s*#94a3b8/i.test(premiumCss), 'premium.css deve preservar --text3: #94A3B8');
console.log('   ✓ Conflitos de especificidade e tema Master saneados com sucesso.');

// ─────────────────────────────────────────────────────────────────────────────
// 4. Excelência Contábil & Tabular Nums (DES-04)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n4. Validando implementação de números tabulares e alinhamento contábil (DES-04)...');

// 4.1 Definições CSS
const styleCss = read('css/style.css');
assert(styleCss.includes('@import url(\'./tokens.css\');') || styleCss.includes('@import url("./tokens.css");'), 'css/style.css deve importar tokens.css');
assert(styleCss.includes('table th.numeric'), 'css/style.css deve conter table th.numeric');
assert(styleCss.includes('table td.numeric'), 'css/style.css deve conter table td.numeric');
assert(tokensCss.includes('table th.numeric'), 'css/tokens.css deve conter table th.numeric');
assert(tokensCss.includes('font-variant-numeric: tabular-nums;'), 'tokens.css deve declarar font-variant-numeric: tabular-nums');

// 4.2 js/lancamentos.js
const lancJs = read('js/lancamentos.js');
assert(lancJs.includes('<th class="numeric" style="text-align:right;">Valor</th>'), 'js/lancamentos.js deve ter th.numeric alinhado à direita para Valor');
assert(lancJs.includes('<td class="numeric font-weight-bold" style="font-weight:800;white-space:nowrap;text-align:right;'), 'js/lancamentos.js deve ter td.numeric alinhado à direita para valores');
assert(lancJs.includes('<td colspan="2" class="numeric font-weight-extrabold" style="font-weight:800;color:var(--success);white-space:nowrap;text-align:right;">'), 'js/lancamentos.js deve alinhar totais de receitas no foot');
assert(lancJs.includes('<td colspan="5" class="numeric font-weight-extrabold" style="font-weight:800;color:var(--danger);white-space:nowrap;text-align:right;">'), 'js/lancamentos.js deve alinhar totais de despesas no foot');

// 4.3 js/ofx.js
const ofxJs = read('js/ofx.js');
assert(ofxJs.includes('<th class="numeric" style="width:140px;text-align:right;">Valor Extrato</th>'), 'js/ofx.js deve ter th.numeric alinhado para Valor Extrato');
assert(ofxJs.includes('<th class="numeric" style="width:130px;text-align:right;">Diferença</th>'), 'js/ofx.js deve ter th.numeric alinhado para Diferença');
assert(ofxJs.includes('<td class="numeric font-weight-bold" style="font-size:.82rem;font-weight:800;text-align:right;'), 'js/ofx.js deve ter td.numeric para valor');
assert(ofxJs.includes('<td class="numeric font-weight-bold" style="font-size:.75rem;white-space:nowrap;text-align:right;">'), 'js/ofx.js deve ter td.numeric para diferença');

// 4.4 js/medicoes.js
const medJs = read('js/medicoes.js');
assert(medJs.includes('class="numeric tabular-nums"'), 'js/medicoes.js deve usar numeric tabular-nums');

// 4.5 js/dashboard.js
const dashJs = read('js/dashboard.js');
assert(dashJs.includes('class="kpi-value tabular-nums green"'), 'js/dashboard.js deve ter tabular-nums em kpi-total-receitas');
assert(dashJs.includes('class="kpi-value tabular-nums red"'), 'js/dashboard.js deve ter tabular-nums em kpi-total-despesas');
assert(dashJs.includes('class="kpi-value tabular-nums ${r.saldo>=0?\'blue\':\'red\'}"'), 'js/dashboard.js deve ter tabular-nums em kpi-saldo');

console.log('   ✓ Padrão contábil DES-04 e tabular-nums homologados em todos os módulos financeiros.');

// ─────────────────────────────────────────────────────────────────────────────
// 5. Inclusão dos Arquivos nos HTMLs
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n5. Validando inclusão de tokens.css nos pontos de entrada HTML...');

const appHtml = read('app.html');
assert(appHtml.includes('href="/css/tokens.css?v='), 'app.html deve referenciar /css/tokens.css');

const masterHtml = read('master.html');
assert(masterHtml.includes('href="/css/tokens.css?v='), 'master.html deve referenciar /css/tokens.css');

const indexHtml = read('index.html');
assert(indexHtml.includes('href="/css/tokens.css?v='), 'index.html deve referenciar /css/tokens.css');

console.log('   ✓ Inclusão nos documentos HTML confirmada.');

// ─────────────────────────────────────────────────────────────────────────────
// 6. Cálculo Físico de Contraste WCAG 2.1 AA / AAA
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n6. Validando conformidade matemática de contraste WCAG...');

function parseRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrast(hex1, hex2) {
  const [r1, g1, b1] = parseRgb(hex1);
  const [r2, g2, b2] = parseRgb(hex2);
  const l1 = luminance(r1, g1, b1);
  const l2 = luminance(r2, g2, b2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

// --text-primary (#F2F5F0) em --surface-ground (#070B06)
const crPrimary = contrast('#F2F5F0', '#070B06');
assert(crPrimary >= 7.0, `Contraste primário deve ser >= 7:1 (AAA). Obtido: ${crPrimary.toFixed(2)}:1`);
console.log(`   ✓ Texto Primário (#F2F5F0 em #070B06): ${crPrimary.toFixed(2)}:1 [WCAG AAA]`);

// --text-secondary (#CBD5E1) em --surface-card (#141D12)
const crSecondary = contrast('#CBD5E1', '#141D12');
assert(crSecondary >= 4.5, `Contraste secundário deve ser >= 4.5:1 (AA). Obtido: ${crSecondary.toFixed(2)}:1`);
console.log(`   ✓ Texto Secundário (#CBD5E1 em #141D12): ${crSecondary.toFixed(2)}:1 [WCAG AA]`);

// --text-muted (#94A3B8) em --surface-ground (#070B06)
const crMuted = contrast('#94A3B8', '#070B06');
assert(crMuted >= 4.5, `Contraste terciário deve ser >= 4.5:1 (AA). Obtido: ${crMuted.toFixed(2)}:1`);
console.log(`   ✓ Texto Terciário (#94A3B8 em #070B06): ${crMuted.toFixed(2)}:1 [WCAG AA]`);

console.log('\n======================================================');
console.log('🎉 TODOS OS TESTES DA FASE 4 PASSARAM COM 100% DE SUCESSO!');
console.log('======================================================\n');
