import fs from 'fs';
import path from 'path';

let failed = 0;
const ok = (name, cond) => {
  if (cond) console.log(`✓ ${name}`);
  else { console.error(`✗ ${name}`); failed++; }
};

const root = process.cwd();
const htmlNames = ['app.html', 'index.html', 'master.html', 'landing.html', 'validar.html'];
const eventAttr = /\bon(click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop)\s*=\s*"([^"]*)"/gi;
const dataAttr = /data-fb-(click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop)="/gi;

const files = [];
for (const name of htmlNames) {
  const file = path.join(root, name);
  if (fs.existsSync(file)) files.push(file);
}
const jsDir = path.join(root, 'js');
for (const name of fs.readdirSync(jsDir)) {
  if (!name.endsWith('.js') || name === 'obra_detalhe.js' || name === 'patch26-events.js') continue;
  files.push(path.join(jsDir, name));
}

let remaining = 0;
let migrated = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  remaining += [...src.matchAll(eventAttr)].length;
  migrated += [...src.matchAll(dataAttr)].length;
}

const bridgePath = path.join(jsDir, 'patch26-events.js');
const bridge = fs.existsSync(bridgePath) ? fs.readFileSync(bridgePath, 'utf8') : '';
const vercel = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

console.log('=== Patch 26 — CSP global Stage A ===\n');
ok('bridge CSP-safe foi gerado', bridge.includes('FINOBRA_PATCH26_EVENT_BRIDGE'));
ok('bridge usa allowlist exata de ações', bridge.includes('const ALLOWED = new Set(') && bridge.includes('ALLOWED.has(path)'));
ok('bridge não usa eval/new Function', !/\beval\s*\(|new\s+Function\s*\(/.test(bridge));
ok('mais de 500 handlers simples foram migrados para data-fb-*', migrated >= 500);
ok('handlers complexos restantes ficaram abaixo de 160', remaining > 0 && remaining <= 160);
ok('CSP estrita global ainda permanece somente em Report-Only durante a migração', vercel.includes("Content-Security-Policy-Report-Only") && vercel.includes("script-src-attr 'none'"));
ok('CSP ativa ainda mantém compatibilidade até zerar os handlers restantes', vercel.includes("script-src-attr 'unsafe-inline'"));
ok('postinstall executa Patch 26', String(packageJson.scripts?.postinstall || '').includes('apply-patch26-build.cjs'));
ok('pretest executa Patch 26', String(packageJson.scripts?.pretest || '').includes('apply-patch26-build.cjs'));

for (const name of htmlNames) {
  const src = fs.readFileSync(path.join(root, name), 'utf8');
  ok(`${name} carrega o bridge externo do Patch 26`, src.includes('/js/patch26-events.js'));
}

console.log(`\nMigrados: ${migrated} | inline restantes: ${remaining}`);
console.log(`Patch 26 Stage A: ${failed ? 'FALHOU' : 'OK'}\n`);
if (failed) process.exit(1);
