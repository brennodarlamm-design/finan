import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const style = read('css/style.css');
const premium = read('css/premium.css');

function luminance(hex) {
  const rgb = hex.replace('#', '').match(/.{2}/g).map(value => parseInt(value, 16) / 255);
  const [r, g, b] = rgb.map(value => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [first, second] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (first + 0.05) / (second + 0.05);
}

function requireContrast(name, foreground, background, minimum = 4.5) {
  const ratio = contrast(foreground, background);
  assert(ratio >= minimum, `${name} precisa ser >= ${minimum}:1; obtido ${ratio.toFixed(2)}:1`);
  console.log(`✓ ${name}: ${ratio.toFixed(2)}:1`);
}

console.log('=== Tema claro: acessibilidade visual ===\n');

for (const token of [
  '--surface-ground: var(--bg-base)',
  '--action-bg: #C6FF00',
  '--action-fg: #315A00',
  '--on-action: #101814',
  '--focus-ring: #456F00',
  '--color-success: var(--success)',
  '--color-warning: var(--warning)',
  '--color-danger: var(--danger)',
  '--color-info: var(--info)'
]) {
  assert(style.includes(token), `Token claro ausente: ${token}`);
}

requireContrast('Texto principal no canvas', '#101814', '#F6F8F7');
requireContrast('Texto secundário na superfície', '#33413A', '#FFFFFF');
requireContrast('Texto auxiliar na superfície', '#526158', '#FFFFFF');
requireContrast('Texto de ação na superfície', '#315A00', '#FFFFFF');
requireContrast('Foco na superfície', '#456F00', '#FFFFFF', 3);
requireContrast('Sucesso na superfície', '#167C45', '#FFFFFF');
requireContrast('Alerta na superfície', '#9A5C00', '#FFFFFF');
requireContrast('Erro na superfície', '#C42B35', '#FFFFFF');
requireContrast('Informação na superfície', '#6E3EA3', '#FFFFFF');
requireContrast('Texto de CTA no verde FinGo', '#101814', '#C6FF00');

assert(style.includes('[data-theme="light"][data-colorblind="high-contrast"]'), 'Tema claro precisa de variante própria de alto contraste');
assert(style.includes('--text: #000000 !important;'), 'Alto contraste claro precisa de texto preto');
assert(style.includes('filter: none;'), 'Alto contraste claro não pode depender de filtro global');
assert(premium.includes('background:var(--bg-header)'), 'Header premium deve respeitar o token de tema');
assert(premium.includes('color:var(--text);'), 'Hover de navegação premium deve respeitar o token de texto');
assert(!premium.includes('--text3: #e9ecf0;'), 'premium.css não deve sobrescrever --text3 no .ui-workspace com branco');

const dashboardCode = read('js/dashboard.js');
const obraDetalheCode = read('js/obra_detalhe.js');
assert(dashboardCode.includes('_getChartTheme()'), 'dashboard.js deve possuir helper para paleta de gráficos adaptável ao tema');
assert(obraDetalheCode.includes("data-theme') === 'light'"), 'obra_detalhe.js deve adaptar gráficos Curva S e Curva ABC ao tema claro');

requireContrast('KPI label no card claro', '#384840', '#FFFFFF');
requireContrast('KPI change no card claro', '#4A5A52', '#FFFFFF');
requireContrast('Nav accordion header no sidebar claro', '#384840', '#FFFFFF');
requireContrast('Nav section title no sidebar claro', '#384840', '#FFFFFF');
requireContrast('Table header text no th claro', '#384840', '#F2F5F3');
requireContrast('Form label no card claro', '#384840', '#FFFFFF');
requireContrast('Badge success text no fundo success', '#167C45', '#E7F6EC');
requireContrast('Badge danger text no fundo danger', '#C42B35', '#FCE8EA');
requireContrast('Badge warning text no fundo warning', '#9A5C00', '#FFF3DB');

assert(style.includes('[data-theme="light"] thead th'), 'style.css deve ter regras explícitas para cabeçalhos de tabela no tema claro');
assert(style.includes('[data-theme="light"] .form-control'), 'style.css deve ter regras explícitas para campos de formulário no tema claro');
assert(style.includes('[data-theme="light"] .modal'), 'style.css deve ter regras explícitas para modais no tema claro');

console.log('\n✅ Tokens, foco, estados semânticos, gráficos adaptativos, tabelas, formulários e alto contraste claro validados.');
