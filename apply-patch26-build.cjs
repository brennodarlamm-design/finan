// Patch 26 Stage A — migrate simple inline event handlers across the frontend.
// Build-time transformation only. Runtime bridge uses an exact action allowlist,
// never eval/new Function, and leaves complex handlers untouched for explicit migration.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const jsDir = path.join(root, 'js');
const htmlNames = ['app.html', 'index.html', 'master.html', 'landing.html', 'validar.html'];
const skipJs = new Set(['obra_detalhe.js', 'patch26-events.js']);
const eventAttr = /\s+on(click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop)="([^"]*)"/gi;
const actionPathRe = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\((.*)\);?$/s;
const excludedRoots = new Set(['document', 'window', 'this', 'event', 'alert', 'confirm', 'prompt', 'console', 'if', 'typeof']);

function splitArgs(input) {
  const out = [];
  let cur = '';
  let quote = null;
  let esc = false;
  let depth = 0;
  for (const ch of String(input || '')) {
    if (esc) { cur += ch; esc = false; continue; }
    if (ch === '\\') { cur += ch; esc = true; continue; }
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const encConst = value => encodeURIComponent(String(value));
const dynamicEncoded = expr => '${encodeURIComponent(String(' + expr + '))}';

function compileArg(raw) {
  const a = String(raw || '').trim();
  if (!a) return null;
  if (a === 'this') return { t: 'self' };
  if (a === 'event') return { t: 'event' };
  if (a === 'this.value') return { t: 'value' };
  if (a === 'this.checked') return { t: 'checked' };
  if (a === 'this.files') return { t: 'files' };

  let m = a.match(/^this\.dataset\.([A-Za-z_$][\w$]*)$/);
  if (m) return { t: 'dataset', v: encConst(m[1]) };
  if (/^parseFloat\(this\.value\)\s*\|\|\s*0$/.test(a)) return { t: 'float' };
  if (/^Number\(this\.value\)\s*\|\|\s*0$/.test(a)) return { t: 'float' };
  if (/^parseInt\(this\.value(?:,\s*10)?\)\s*\|\|\s*0$/.test(a)) return { t: 'int' };

  m = a.match(/^document\.getElementById\((['"])([^'"]+)\1\)(?:\?\.)?\.value\s*\|\|\s*(['"])\3$/);
  if (m) return { t: 'domvalue', v: encConst(m[2]) };
  m = a.match(/^document\.getElementById\((['"])([^'"]+)\1\)\.value$/);
  if (m) return { t: 'domvalue', v: encConst(m[2]) };

  if (a === 'true' || a === 'false') return { t: 'bool', v: a };
  if (a === 'null') return { t: 'null' };
  if (a === 'undefined') return { t: 'undefined' };
  if (/^-?\d+(?:\.\d+)?$/.test(a)) return { t: 'number', v: a };

  m = a.match(/^(['"])([\s\S]*)\1$/);
  if (m) {
    const body = m[2];
    const pure = body.match(/^\$\{([\s\S]+)\}$/);
    if (pure) return { t: 'string', v: dynamicEncoded(pure[1]) };
    if (!body.includes('${')) {
      return { t: 'string', v: encConst(body.replace(/\\'/g, "'").replace(/\\"/g, '"')) };
    }
    return null;
  }

  m = a.match(/^\$\{([\s\S]+)\}$/);
  if (m) return { t: 'auto', v: dynamicEncoded(m[1]) };

  m = a.match(/^decodeURIComponent\((['"])\$\{([\s\S]+)\}\1\)$/);
  if (m) return { t: 'string', v: dynamicEncoded(`decodeURIComponent(${m[2]})`) };
  return null;
}

function parseHandler(handler) {
  const s = String(handler || '').trim();
  const m = s.match(actionPathRe);
  if (!m) return null;
  const action = m[1];
  const rootName = action.split('.')[0];
  if (excludedRoots.has(rootName)) return null;
  const rawArgs = m[2].trim() ? splitArgs(m[2]) : [];
  const args = [];
  for (const raw of rawArgs) {
    const compiled = compileArg(raw);
    if (!compiled) return null;
    args.push(compiled);
  }
  return { action, args };
}

function attrsFor(eventName, parsed) {
  const e = eventName.toLowerCase();
  let out = ` data-fb-${e}="${parsed.action}" data-fb-${e}-n="${parsed.args.length}"`;
  parsed.args.forEach((arg, i) => {
    out += ` data-fb-${e}-t${i}="${arg.t}"`;
    if (arg.v !== undefined) out += ` data-fb-${e}-v${i}="${arg.v}"`;
  });
  return out;
}

const files = [];
for (const name of htmlNames) {
  const file = path.join(root, name);
  if (fs.existsSync(file)) files.push(file);
}
if (fs.existsSync(jsDir)) {
  for (const name of fs.readdirSync(jsDir)) {
    if (!name.endsWith('.js') || skipJs.has(name)) continue;
    files.push(path.join(jsDir, name));
  }
}

let migrated = 0;
let remaining = 0;
const actions = new Set();
const events = new Set();
const remainingByFile = new Map();

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(eventAttr, (full, eventName, handler) => {
    const parsed = parseHandler(handler);
    if (!parsed) {
      remaining++;
      const rel = path.relative(root, file).replace(/\\/g, '/');
      remainingByFile.set(rel, (remainingByFile.get(rel) || 0) + 1);
      return full;
    }
    migrated++;
    actions.add(parsed.action);
    events.add(eventName.toLowerCase());
    return attrsFor(eventName, parsed);
  });

  const existing = /data-fb-(click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop)="([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)"/g;
  for (const match of src.matchAll(existing)) {
    events.add(match[1]);
    actions.add(match[2]);
  }
  fs.writeFileSync(file, src);
}

const allowed = JSON.stringify([...actions].sort());
const eventList = JSON.stringify([...events].sort());
const bridge = `/* FINOBRA_PATCH26_EVENT_BRIDGE — generated at build time; no eval/new Function. */\n(() => {\n  if (globalThis.__finobraPatch26Bridge) return;\n  globalThis.__finobraPatch26Bridge = true;\n  const ALLOWED = new Set(${allowed});\n  const EVENTS = ${eventList};\n  const decode = v => { try { return decodeURIComponent(String(v ?? '')); } catch { return String(v ?? ''); } };\n  function auto(v) { const s = decode(v); if (s === 'true') return true; if (s === 'false') return false; if (s === 'null') return null; if (/^-?\\d+(?:\\.\\d+)?$/.test(s)) return Number(s); return s; }\n  function arg(el, ev, e, i) {\n    const t = el.getAttribute('data-fb-' + e + '-t' + i) || '';\n    const v = el.getAttribute('data-fb-' + e + '-v' + i);\n    if (t === 'self') return el;\n    if (t === 'event') return ev;\n    if (t === 'value') return el.value;\n    if (t === 'checked') return !!el.checked;\n    if (t === 'files') return el.files;\n    if (t === 'dataset') return el.dataset[decode(v)];\n    if (t === 'float') return parseFloat(el.value) || 0;\n    if (t === 'int') return parseInt(el.value, 10) || 0;\n    if (t === 'domvalue') return document.getElementById(decode(v))?.value || '';\n    if (t === 'bool') return v === 'true';\n    if (t === 'null') return null;\n    if (t === 'undefined') return undefined;\n    if (t === 'number') return Number(v);\n    if (t === 'auto') return auto(v);\n    if (t === 'string') return decode(v);\n    throw new Error('argumento não permitido');\n  }\n  function resolve(path) {\n    if (!ALLOWED.has(path)) throw new Error('ação fora da allowlist');\n    const parts = path.split('.');\n    let ctx = globalThis;\n    let cur = globalThis;\n    for (let i = 0; i < parts.length; i++) { ctx = cur; cur = cur?.[parts[i]]; }\n    if (typeof cur !== 'function') throw new Error('ação indisponível');\n    return { fn: cur, ctx };\n  }\n  function bind(e) {\n    document.addEventListener(e, ev => {\n      const attr = 'data-fb-' + e;\n      const el = ev.target?.closest?.('[' + attr + ']');\n      if (!el) return;\n      try {\n        const action = el.getAttribute(attr);\n        const { fn, ctx } = resolve(action);\n        const n = Number(el.getAttribute(attr + '-n') || 0);\n        const args = [];\n        for (let i = 0; i < n; i++) args.push(arg(el, ev, e, i));\n        const result = fn.apply(ctx, args);\n        if (result === false) ev.preventDefault();\n      } catch (err) {\n        console.error('[Patch26 CSP]', err?.message || err);\n        globalThis.Utils?.toast?.('Ação bloqueada por política de segurança.', 'warning');\n      }\n    }, true);\n  }\n  EVENTS.forEach(bind);\n})();\n`;

fs.writeFileSync(path.join(jsDir, 'patch26-events.js'), bridge);

for (const name of htmlNames) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('/js/patch26-events.js')) {
    const tag = '  <script src="/js/patch26-events.js"></script>\n';
    src = src.includes('</body>') ? src.replace('</body>', tag + '</body>') : src + '\n' + tag;
    fs.writeFileSync(file, src);
  }
}

const syntax = spawnSync(process.execPath, ['--check', path.join(jsDir, 'patch26-events.js')], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});
if (syntax.status !== 0) {
  console.error('[Patch26] bridge gerado possui erro de sintaxe.');
  console.error(syntax.stderr || syntax.stdout || 'node --check falhou');
  process.exit(syntax.status || 1);
}
if (/\beval\s*\(|new\s+Function\s*\(/.test(bridge)) {
  console.error('[Patch26] eval/new Function são proibidos.');
  process.exit(1);
}
if (!actions.size) {
  console.error('[Patch26] nenhuma ação CSP-safe encontrada; árvore inesperada.');
  process.exit(1);
}

console.log(`[Patch26] Stage A: ${migrated} handlers simples migrados; ${remaining} complexos permanecem para migração explícita.`);
for (const [file, count] of [...remainingByFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  - ${file}: ${count} restantes`);
}
