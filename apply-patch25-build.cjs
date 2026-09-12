// Patch 25 — remove inline event handlers from ObraDetalhe without eval/Function.
// Runs after Patch 24 and installs a strict allowlisted delegated event bridge.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const target = path.join(root, 'js/obra_detalhe.js');
let src = fs.readFileSync(target, 'utf8');
const MARKER = 'FINOBRA_PATCH25_EVENT_BRIDGE';

const allowedPaths = new Set([
  'Clientes.showForm',
  'App.navigate',
  'ObraDetalhe.imprimirDossie',
  'ObraDetalhe.setTab',
  'ObraDetalhe.setSubTabOrcado',
  'ObraDetalhe.exportarExcelEngenharia',
  'ObraDetalhe.exportarPDFEngenharia',
  'ObraDetalhe.abrirMenuExportar',
  'ObraDetalhe.abrirModalConfigCronograma',
  'ObraDetalhe.exportarExcel',
  'ObraDetalhe.imprimir',
  'ObraDetalhe.setRegimeLeisSociais',
  'ObraDetalhe.salvarBDI',
  'ObraDetalhe.salvarBDIPadrao',
  'ObraDetalhe.restaurarBDITCU',
  'ObraDetalhe.restaurarConfigCronograma',
  'ObraDetalhe.salvarConfigCronograma',
  'ObraDetalhe._atualizarSomaModalCronograma',
  'ObraDetalhe.recalcularBDIInput',
  'Utils.closeModal',
  'ImportarExcel.abrirModal',
  'OCR.abrirModal',
  'Lancamentos.showForm',
  'Lancamentos.edit',
  'Lancamentos.del',
  'FasesDoc.expandAll',
  'FasesDoc.collapseAll',
  'Medicoes.showForm',
  'Medicoes.del',
  'Recibos.novoReciboModal',
  'Recibos.visualizarRecibo',
  'Contratos.visualizarContrato'
]);

function splitStatements(input) {
  const out = [];
  let cur = '';
  let quote = null;
  let esc = false;
  let depth = 0;
  for (const ch of String(input)) {
    if (esc) { cur += ch; esc = false; continue; }
    if (ch === '\\') { cur += ch; esc = true; continue; }
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    if (ch === ')' || ch === '}' || ch === ']') depth--;
    if (ch === ';' && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function supportedStatement(stmt) {
  if (/^this\.style\.borderColor='var\(--(?:accent|border)\)'$/.test(stmt)) return true;
  if (/^App\.obraId='[^']*'$/.test(stmt)) return true;
  if (/^Lancamentos\.showForm \? Lancamentos\.showForm\('[^']*','[^']*'\) : Lancamentos\.edit\('[^']*'\)$/.test(stmt)) return true;
  if (/^Recibos\.novoReciboModal\(\{ obra_id: '[^']*' \}\)$/.test(stmt)) return true;
  const m = stmt.match(/^([A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*)\((.*)\)$/s);
  return !!(m && allowedPaths.has(m[1]));
}

function supportedHandler(handler) {
  return splitStatements(handler).every(supportedStatement);
}

if (!src.includes(MARKER)) {
  // Popup de impressão: não depende do bridge do documento principal.
  src = src.replace(/onclick="window\.print\(\)"/g, 'id="od-print-window-btn"');
  src = src.replace(/onclick="window\.close\(\)"/g, 'id="od-close-window-btn"');

  const printMetaNeedle = '<meta charset="UTF-8">\n        <title>${tituloRelatorio}';
  const printMetaReplacement = '<meta charset="UTF-8">\n        <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: https:; style-src \'unsafe-inline\'; font-src data: https:; script-src \'none\'; script-src-attr \'none\';">\n        <title>${tituloRelatorio}';
  if (src.includes(printMetaNeedle) && !src.includes("script-src-attr 'none';\">\n        <title>${tituloRelatorio}")) {
    src = src.replace(printMetaNeedle, printMetaReplacement);
  }

  const closeNeedle = '    win.document.close();\n    win.focus();';
  const closeReplacement = `    win.document.close();\n    const printButton = win.document.getElementById('od-print-window-btn');\n    const closeButton = win.document.getElementById('od-close-window-btn');\n    if (printButton) printButton.addEventListener('click', () => win.print());\n    if (closeButton) closeButton.addEventListener('click', () => win.close());\n    win.focus();`;
  if (src.includes(closeNeedle) && !src.includes("const printButton = win.document.getElementById('od-print-window-btn')")) {
    src = src.replace(closeNeedle, closeReplacement);
  }

  let migrated = 0;
  const eventAttr = /\s+on(click|change|input|mouseenter|mouseleave)="([^"]*)"/g;
  src = src.replace(eventAttr, (full, eventName, handler) => {
    if (!supportedHandler(handler)) {
      console.error(`[Patch25] handler não suportado (${eventName}): ${handler}`);
      process.exitCode = 1;
      return full;
    }
    migrated++;
    return ` data-od-${eventName}="${handler}"`;
  });
  if (process.exitCode) process.exit(process.exitCode);
  if (!migrated) {
    console.error('[Patch25] nenhum handler inline encontrado para migração; árvore inesperada.');
    process.exit(1);
  }

  const bridge = `\n\n/* ${MARKER} */\n(() => {\n  if (globalThis.__finobraObraDetalheEventBridge) return;\n  globalThis.__finobraObraDetalheEventBridge = true;\n\n  const allowed = {\n    'Clientes.showForm': (...a) => Clientes.showForm(...a),\n    'App.navigate': (...a) => App.navigate(...a),\n    'ObraDetalhe.imprimirDossie': (...a) => ObraDetalhe.imprimirDossie(...a),\n    'ObraDetalhe.setTab': (...a) => ObraDetalhe.setTab(...a),\n    'ObraDetalhe.setSubTabOrcado': (...a) => ObraDetalhe.setSubTabOrcado(...a),\n    'ObraDetalhe.exportarExcelEngenharia': (...a) => ObraDetalhe.exportarExcelEngenharia(...a),\n    'ObraDetalhe.exportarPDFEngenharia': (...a) => ObraDetalhe.exportarPDFEngenharia(...a),\n    'ObraDetalhe.abrirMenuExportar': (...a) => ObraDetalhe.abrirMenuExportar(...a),\n    'ObraDetalhe.abrirModalConfigCronograma': (...a) => ObraDetalhe.abrirModalConfigCronograma(...a),\n    'ObraDetalhe.exportarExcel': (...a) => ObraDetalhe.exportarExcel(...a),\n    'ObraDetalhe.imprimir': (...a) => ObraDetalhe.imprimir(...a),\n    'ObraDetalhe.setRegimeLeisSociais': (...a) => ObraDetalhe.setRegimeLeisSociais(...a),\n    'ObraDetalhe.salvarBDI': (...a) => ObraDetalhe.salvarBDI(...a),\n    'ObraDetalhe.salvarBDIPadrao': (...a) => ObraDetalhe.salvarBDIPadrao(...a),\n    'ObraDetalhe.restaurarBDITCU': (...a) => ObraDetalhe.restaurarBDITCU(...a),\n    'ObraDetalhe.restaurarConfigCronograma': (...a) => ObraDetalhe.restaurarConfigCronograma(...a),\n    'ObraDetalhe.salvarConfigCronograma': (...a) => ObraDetalhe.salvarConfigCronograma(...a),\n    'ObraDetalhe._atualizarSomaModalCronograma': (...a) => ObraDetalhe._atualizarSomaModalCronograma(...a),\n    'ObraDetalhe.recalcularBDIInput': (...a) => ObraDetalhe.recalcularBDIInput(...a),\n    'Utils.closeModal': (...a) => Utils.closeModal(...a),\n    'ImportarExcel.abrirModal': (...a) => ImportarExcel.abrirModal(...a),\n    'OCR.abrirModal': (...a) => OCR.abrirModal(...a),\n    'Lancamentos.showForm': (...a) => Lancamentos.showForm(...a),\n    'Lancamentos.edit': (...a) => Lancamentos.edit(...a),\n    'Lancamentos.del': (...a) => Lancamentos.del(...a),\n    'FasesDoc.expandAll': (...a) => FasesDoc.expandAll(...a),\n    'FasesDoc.collapseAll': (...a) => FasesDoc.collapseAll(...a),\n    'Medicoes.showForm': (...a) => Medicoes.showForm(...a),\n    'Medicoes.del': (...a) => Medicoes.del(...a),\n    'Recibos.novoReciboModal': (...a) => Recibos.novoReciboModal(...a),\n    'Recibos.visualizarRecibo': (...a) => Recibos.visualizarRecibo(...a),\n    'Contratos.visualizarContrato': (...a) => Contratos.visualizarContrato(...a)\n  };\n\n  function splitStatements(input) {\n    const out = []; let cur = ''; let quote = null; let esc = false; let depth = 0;\n    for (const ch of String(input || '')) {\n      if (esc) { cur += ch; esc = false; continue; }\n      if (ch === '\\\\') { cur += ch; esc = true; continue; }\n      if (quote) { cur += ch; if (ch === quote) quote = null; continue; }\n      if (ch === \"'\" || ch === '\"') { quote = ch; cur += ch; continue; }\n      if (ch === '(' || ch === '{' || ch === '[') depth++;\n      if (ch === ')' || ch === '}' || ch === ']') depth--;\n      if (ch === ';' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }\n      cur += ch;\n    }\n    if (cur.trim()) out.push(cur.trim());\n    return out;\n  }\n\n  function parseArgs(raw) {\n    const s = String(raw || '').trim();\n    if (!s) return [];\n    const parts = []; let cur = ''; let quote = null; let esc = false; let depth = 0;\n    for (const ch of s) {\n      if (esc) { cur += ch; esc = false; continue; }\n      if (ch === '\\\\') { cur += ch; esc = true; continue; }\n      if (quote) { cur += ch; if (ch === quote) quote = null; continue; }\n      if (ch === \"'\" || ch === '\"') { quote = ch; cur += ch; continue; }\n      if (ch === '{' || ch === '[' || ch === '(') depth++;\n      if (ch === '}' || ch === ']' || ch === ')') depth--;\n      if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }\n      cur += ch;\n    }\n    if (cur.trim()) parts.push(cur.trim());\n    return parts.map(v => {\n      if ((v.startsWith(\"'\") && v.endsWith(\"'\")) || (v.startsWith('\"') && v.endsWith('\"'))) {\n        return v.slice(1, -1).replace(/\\\\'/g, \"'\").replace(/\\\\\"/g, '\"').replace(/\\\\n/g, '\\n').replace(/\\\\r/g, '\\r').replace(/\\\\\\\\/g, '\\\\');\n      }\n      if (v === 'true') return true;\n      if (v === 'false') return false;\n      if (v === 'null') return null;\n      if (/^-?\\d+(?:\\.\\d+)?$/.test(v)) return Number(v);\n      throw new Error('Argumento CSP não permitido');\n    });\n  }\n\n  function runStatement(stmt, el) {\n    const hover = stmt.match(/^this\\.style\\.borderColor='(var\\(--(?:accent|border)\\))'$/);\n    if (hover) { el.style.borderColor = hover[1]; return; }\n\n    const assignObra = stmt.match(/^App\\.obraId='([^']*)'$/);\n    if (assignObra) { App.obraId = assignObra[1]; return; }\n\n    const ternary = stmt.match(/^Lancamentos\\.showForm \\? Lancamentos\\.showForm\\('([^']*)','([^']*)'\\) : Lancamentos\\.edit\\('([^']*)'\\)$/);\n    if (ternary) {\n      if (typeof Lancamentos.showForm === 'function') Lancamentos.showForm(ternary[1], ternary[2]);\n      else Lancamentos.edit(ternary[3]);\n      return;\n    }\n\n    const receipt = stmt.match(/^Recibos\\.novoReciboModal\\(\\{ obra_id: '([^']*)' \\}\\)$/);\n    if (receipt) { Recibos.novoReciboModal({ obra_id: receipt[1] }); return; }\n\n    const call = stmt.match(/^([A-Za-z_$][\\w$]*\\.[A-Za-z_$][\\w$]*)\\((.*)\\)$/s);\n    if (!call || !allowed[call[1]]) throw new Error('Ação CSP não permitida');\n    allowed[call[1]](...parseArgs(call[2]));\n  }\n\n  function execute(el, command) {\n    try {\n      for (const stmt of splitStatements(command)) runStatement(stmt, el);\n    } catch (err) {\n      console.error('[Patch25 CSP] ação bloqueada:', err?.message || err);\n      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Ação bloqueada por política de segurança.', 'warning');\n    }\n  }\n\n  const bind = (domEvent, attr, opts = {}) => document.addEventListener(domEvent, (ev) => {\n    const el = ev.target && ev.target.closest ? ev.target.closest('[' + attr + ']') : null;\n    if (!el) return;\n    if (opts.boundary && ev.relatedTarget && el.contains(ev.relatedTarget)) return;\n    execute(el, el.getAttribute(attr));\n  }, true);\n\n  bind('click', 'data-od-click');\n  bind('change', 'data-od-change');\n  bind('input', 'data-od-input');\n  bind('mouseover', 'data-od-mouseenter', { boundary: true });\n  bind('mouseout', 'data-od-mouseleave', { boundary: true });\n})();\n`;

  src += bridge;
  console.log(`[Patch25] ${migrated} handlers inline migrados para delegação CSP-safe.`);
} else {
  console.log('[Patch25] bridge já aplicado.');
}

if (/\son(?:click|change|input|mouseenter|mouseleave)\s*=/.test(src)) {
  console.error('[Patch25] ainda existem handlers inline no obra_detalhe.js após a transformação.');
  process.exit(1);
}
if (/\beval\s*\(|new\s+Function\s*\(/.test(src)) {
  console.error('[Patch25] eval/new Function são proibidos.');
  process.exit(1);
}

fs.writeFileSync(target, src);
const syntax = spawnSync(process.execPath, ['--check', target], { cwd: root, encoding: 'utf8' });
if (syntax.status !== 0) {
  console.error('[Patch25] erro de sintaxe após transformação.');
  console.error(syntax.stderr || syntax.stdout || 'node --check falhou');
  process.exit(syntax.status || 1);
}
console.log('[Patch25] migração de eventos concluída e sintaxe validada.');
