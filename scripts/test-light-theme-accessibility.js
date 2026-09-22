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

console.log('\n✅ Tokens, foco, estados semânticos e alto contraste claro validados.');
