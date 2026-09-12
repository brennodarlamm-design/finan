// Emergency Patch 26 hotfix: classic scripts may declare modules with top-level `const`.
// Those bindings are visible by identifier across classic scripts, but are NOT properties
// of window/globalThis. The original CSP bridge resolved actions only from globalThis,
// making buttons such as Clientes.showForm() unavailable after inline handlers were removed.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'js', 'patch26-events.js');
if (!fs.existsSync(file)) {
  console.error('[Patch26 hotfix] js/patch26-events.js não existe. Execute apply-patch26-build.cjs primeiro.');
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');
if (src.includes('FINOBRA_PATCH26_LEXICAL_ROOTS_HOTFIX')) {
  console.log('[Patch26 hotfix] lexical roots já corrigidos.');
  process.exit(0);
}

const allowedMatch = src.match(/const ALLOWED = new Set\((\[[\s\S]*?\])\);/);
if (!allowedMatch) {
  console.error('[Patch26 hotfix] allowlist não encontrada no bridge.');
  process.exit(1);
}

let actions;
try {
  actions = JSON.parse(allowedMatch[1]);
} catch (err) {
  console.error('[Patch26 hotfix] allowlist inválida:', err?.message || err);
  process.exit(1);
}

const roots = [...new Set(actions.map(action => String(action).split('.')[0]))]
  .filter(name => /^[A-Za-z_$][\w$]*$/.test(name))
  .sort();

if (!roots.length) {
  console.error('[Patch26 hotfix] nenhuma raiz de ação encontrada.');
  process.exit(1);
}

const entries = roots.map(name => {
  const key = JSON.stringify(name);
  return `    ${key}: (typeof ${name} !== 'undefined' ? ${name} : globalThis[${key}])`;
}).join(',\n');

const eventsNeedle = '  const EVENTS = ';
if (!src.includes(eventsNeedle)) {
  console.error('[Patch26 hotfix] marcador EVENTS não encontrado.');
  process.exit(1);
}

src = src.replace(
  eventsNeedle,
  `  /* FINOBRA_PATCH26_LEXICAL_ROOTS_HOTFIX */\n  const ROOTS = Object.freeze({\n${entries}\n  });\n  ${eventsNeedle.trimStart()}`
);

const oldResolve = `  function resolve(path) {\n    if (!ALLOWED.has(path)) throw new Error('ação fora da allowlist');\n    const parts = path.split('.');\n    let ctx = globalThis;\n    let cur = globalThis;\n    for (let i = 0; i < parts.length; i++) { ctx = cur; cur = cur?.[parts[i]]; }\n    if (typeof cur !== 'function') throw new Error('ação indisponível');\n    return { fn: cur, ctx };\n  }`;

const newResolve = `  function resolve(path) {\n    if (!ALLOWED.has(path)) throw new Error('ação fora da allowlist');\n    const parts = path.split('.');\n    let ctx = globalThis;\n    let cur = Object.prototype.hasOwnProperty.call(ROOTS, parts[0]) ? ROOTS[parts[0]] : globalThis[parts[0]];\n    if (parts.length === 1) {\n      if (typeof cur !== 'function') throw new Error('ação indisponível');\n      return { fn: cur, ctx };\n    }\n    for (let i = 1; i < parts.length; i++) { ctx = cur; cur = cur?.[parts[i]]; }\n    if (typeof cur !== 'function') throw new Error('ação indisponível');\n    return { fn: cur, ctx };\n  }`;

if (!src.includes(oldResolve)) {
  console.error('[Patch26 hotfix] função resolve original não encontrada; abortando para não alterar árvore inesperada.');
  process.exit(1);
}

src = src.replace(oldResolve, newResolve);
fs.writeFileSync(file, src);

if (!src.includes("typeof Clientes !== 'undefined' ? Clientes")) {
  console.error('[Patch26 hotfix] raiz Clientes não foi registrada; árvore inesperada.');
  process.exit(1);
}
if (/\beval\s*\(|new\s+Function\s*\(/.test(src)) {
  console.error('[Patch26 hotfix] eval/new Function são proibidos.');
  process.exit(1);
}

console.log(`[Patch26 hotfix] ${roots.length} raízes léxicas registradas no bridge CSP-safe.`);
