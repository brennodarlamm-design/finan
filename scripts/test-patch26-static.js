import fs from 'fs';
import path from 'path';

let failed = 0;
const ok = (name, cond) => {
  if (cond) console.log(`✓ ${name}`);
  else { console.error(`✗ ${name}`); failed++; }
};

const root = process.cwd();
const eventAttr = /\bon(click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop)\s*=\s*(['"])[\s\S]*?\2/gi;
const dataAttr = /data-fb-(click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop)="/gi;
const jsUrl = /(?:href|src)\s*=\s*(['"])\s*javascript\s*:/gi;

const files = [];
for (const name of fs.readdirSync(root)) {
  if (name.endsWith('.html')) files.push(path.join(root, name));
}
const jsDir = path.join(root, 'js');
for (const name of fs.readdirSync(jsDir)) {
  if (name.endsWith('.js')) files.push(path.join(jsDir, name));
}

let remaining = 0;
let migrated = 0;
let javascriptUrls = 0;
const offenders = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const inlineCount = [...src.matchAll(eventAttr)].length;
  const jsUrlCount = [...src.matchAll(jsUrl)].length;
  if (inlineCount || jsUrlCount) offenders.push(`${path.relative(root, file)}: handlers=${inlineCount}, javascriptUrls=${jsUrlCount}`);
  remaining += inlineCount;
  javascriptUrls += jsUrlCount;
  migrated += [...src.matchAll(dataAttr)].length;
}

const bridgePath = path.join(jsDir, 'patch26-events.js');
const bridge = fs.existsSync(bridgePath) ? fs.readFileSync(bridgePath, 'utf8') : '';
const actionsPath = path.join(jsDir, 'patch26-actions.js');
const actions = fs.existsSync(actionsPath) ? fs.readFileSync(actionsPath, 'utf8') : '';
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const globalHeaders = vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers || [];
const activeCsp = globalHeaders.find(h => h.key === 'Content-Security-Policy')?.value || '';

console.log('=== Patch 26 — CSP global enforcement ===\n');
ok('bridge CSP-safe foi materializado', bridge.includes('FINOBRA_PATCH26_EVENT_BRIDGE'));
ok('bridge usa allowlist exata de ações', bridge.includes('const ALLOWED = new Set(') && bridge.includes('ALLOWED.has(path)'));
ok('bridge não usa eval/new Function', !/\beval\s*\(|new\s+Function\s*\(/.test(bridge));
ok('ações complexas são explícitas e também não usam eval/new Function', actions.includes('globalThis.Patch26Actions') && !/\beval\s*\(|new\s+Function\s*\(/.test(actions));
ok('mais de 700 handlers permanecem migrados para data-fb-*', migrated >= 700);
ok('nenhum event handler inline permanece no frontend versionado', remaining === 0);
ok('nenhuma URL javascript: permanece no frontend versionado', javascriptUrls === 0);
ok('CSP ativa bloqueia atributos de script globalmente', activeCsp.includes("script-src-attr 'none'"));
ok('CSP ativa não contém unsafe-inline em script-src-attr', !activeCsp.includes("script-src-attr 'unsafe-inline'"));
const lifecycle = `${packageJson.scripts?.postinstall || ''} ${packageJson.scripts?.pretest || ''}`;
ok('CSP materializada não depende de transformadores no lifecycle npm', !/prepare-patch26|apply-patch26|apply-patch25|apply-patch24|apply-patch23|apply-patch22/.test(lifecycle));

for (const name of ['app.html', 'index.html', 'master.html', 'landing.html', 'validar.html']) {
  const src = fs.readFileSync(path.join(root, name), 'utf8');
  ok(`${name} carrega ações nomeadas antes do bridge`, src.includes('/js/patch26-actions.js') && src.includes('/js/patch26-events.js') && src.indexOf('/js/patch26-actions.js') < src.indexOf('/js/patch26-events.js'));
}

if (offenders.length) {
  console.error('\nSuperfícies CSP restantes:');
  offenders.forEach(v => console.error(`  - ${v}`));
}
console.log(`\nMigrados: ${migrated} | inline restantes: ${remaining} | javascript: URLs: ${javascriptUrls}`);
console.log(`Patch 26: ${failed ? 'FALHOU' : 'OK'}\n`);
if (failed) process.exit(1);
