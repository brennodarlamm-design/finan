import fs from 'fs';

let failed = 0;
let passed = 0;
const ok = (name, cond) => {
  if (cond) { console.log(`✅ ${name}`); passed++; }
  else { console.error(`❌ ${name}`); failed++; }
};
const read = p => fs.readFileSync(p, 'utf8');

const obra = read('./js/obra_detalhe.js');
const vercel = read('./vercel.json');
const pkg = JSON.parse(read('./package.json'));

console.log('=== Patch 25 — CSP strict prep / inline handlers ===');
ok('ObraDetalhe não contém onclick/onchange/oninput/mouse inline', !/\son(?:click|change|input|mouseenter|mouseleave)\s*=/.test(obra));
ok('bridge CSP allowlisted foi instalado', obra.includes('FINOBRA_PATCH25_EVENT_BRIDGE'));
ok('delegação usa addEventListener', obra.includes("bind('click', 'data-od-click')") && obra.includes("bind('input', 'data-od-input')"));
ok('não introduz eval/new Function', !/\beval\s*\(|new\s+Function\s*\(/.test(obra));
ok('janela de relatório remove onclick window.print/window.close', !/onclick="window\.(?:print|close)\(\)"/.test(obra));
ok('janela de relatório usa botões ligados por addEventListener', obra.includes('od-print-window-btn') && obra.includes("printButton.addEventListener('click'"));
ok('relatório de engenharia aplica CSP script-src none', obra.includes("script-src 'none'; script-src-attr 'none'"));
ok('CSP global mantém Report-Only estrito durante a migração do restante do app', vercel.includes('Content-Security-Policy-Report-Only') && vercel.includes("script-src-attr 'none'"));
ok('package executa Patch 25 depois do Patch 24', String(pkg.scripts?.postinstall || '').includes('apply-patch24-build.cjs && node apply-patch25-build.cjs'));

console.log(`\nPatch 25: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
