import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf8');
let passed = 0;
let failed = 0;
function ok(name, cond) {
  if (cond) { console.log('✅', name); passed++; }
  else { console.error('❌', name); failed++; }
}

console.log('=== Patch 24 — XSS / CSP prep / Spreadsheet Injection ===\n');
const od = read('./js/obra_detalhe.js');

ok('ObraDetalhe possui normalizador HTML central', /_safeHtmlRecord\(record\)/.test(od));
ok('normalizador usa Utils.escapeHtml em strings persistidas', /typeof value === 'string' \? Utils\.escapeHtml\(value\)/.test(od));
ok('render principal usa obraRaw antes de criar objeto HTML-safe', /const obraRaw = DB\.getById\('clientes', id\);[\s\S]{0,220}const obra = this\._safeHtmlRecord\(obraRaw\)/.test(od));
ok('link do Drive passa por Utils.safeUrl', /driveLink = Utils\.safeUrl \? Utils\.safeUrl\(docObj\.url_externa\)/.test(od));
ok('impressão de engenharia usa obra e empresa HTML-safe', /const obra = this\._safeHtmlRecord\(obraRaw\);[\s\S]{0,160}const emp = this\._safeHtmlRecord\(empRaw\)/.test(od));
ok('logo de relatório usa URL validada a partir do registro cru', /const safeLogoUrl = Utils\.safeUrl \? Utils\.safeUrl\(empRaw\.logo_url\) : ''/.test(od));
ok('dossiê HTML usa obra HTML-safe', /gerarHTMLDossie\(obraId\)[\s\S]{0,260}const obra = this\._safeHtmlRecord\(obraRaw\)/.test(od));
ok('dossiê HTML usa empresa HTML-safe', /gerarHTMLDossie\(obraId\)[\s\S]{0,500}const emp = this\._safeHtmlRecord\(empRaw\)/.test(od));
ok('exportação XLSX possui proteção contra formula injection', /_safeSpreadsheetCell\(value\)/.test(od) && /\[=\+\\-@\]/.test(od));
ok('todas as células AOA passam por _safeSpreadsheetCell antes do XLSX', /safeData = data\.map\([\s\S]{0,150}_safeSpreadsheetCell\(cell\)/.test(od) && /aoa_to_sheet\(safeData\)/.test(od));
ok('nome da obra no PDF não é reinjetado cru no title', !/<title>\$\{tituloRelatorio\} - \$\{obraRaw\.nome\}/.test(od));
ok('logo do dossiê não usa emp.logo_url cru', !/<img src="\$\{emp\.logo_url\}/.test(od));

console.log(`\nResultado Patch 24: ${passed} passou, ${failed} falhou.`);
if (failed) process.exit(1);
