// Build-time transform for Patch 24 — XSS + spreadsheet hardening.
// Deterministic and idempotent: each replacement is applied once and then syntax-checked.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const target = path.join(root, 'js/obra_detalhe.js');
let src = fs.readFileSync(target, 'utf8');

function ensureReplace(name, before, after, marker = after) {
  if (src.includes(marker)) {
    console.log(`[Patch24] já aplicado: ${name}`);
    return;
  }
  if (!src.includes(before)) {
    console.error(`[Patch24] trecho esperado não encontrado: ${name}`);
    process.exit(1);
  }
  src = src.replace(before, after);
  console.log(`[Patch24] aplicado: ${name}`);
}

ensureReplace(
  'helpers de saída segura',
  "  _filtroBusca: '',\n",
  "  _filtroBusca: '',\n\n  _safeHtmlRecord(record) {\n    if (!record || typeof record !== 'object') return record || {};\n    return Object.fromEntries(Object.entries(record).map(([key, value]) => [\n      key,\n      typeof value === 'string' ? Utils.escapeHtml(value) : value\n    ]));\n  },\n\n  _safeSpreadsheetCell(value) {\n    if (typeof value !== 'string') return value;\n    if (/^[\\t\\r ]*[=+\\-@]/.test(value)) return `\\'${value}`;\n    return value;\n  },\n",
  '_safeSpreadsheetCell(value) {'
);

ensureReplace(
  'obra segura no render principal',
  "    const obra = DB.getById('clientes', id);\n    if (!obra) {",
  "    const obraRaw = DB.getById('clientes', id);\n    const obra = this._safeHtmlRecord(obraRaw);\n    if (!obraRaw) {",
  "const obraRaw = DB.getById('clientes', id);\n    const obra = this._safeHtmlRecord(obraRaw);\n    if (!obraRaw)"
);

ensureReplace(
  'empresa segura no cabeçalho da obra',
  "    const mod = modMap[obra.modalidade_obra || 'caixa'] || modMap.caixa;\n\n    // Resumo documental",
  "    const mod = modMap[obra.modalidade_obra || 'caixa'] || modMap.caixa;\n    const empresaHtml = this._safeHtmlRecord((typeof DB.getEmpresa === 'function' ? DB.getEmpresa() : {}) || {});\n\n    // Resumo documental",
  'const empresaHtml = this._safeHtmlRecord'
);

ensureReplace(
  'URL segura do Google Drive',
  '              driveLink = docObj.url_externa;',
  "              driveLink = Utils.safeUrl ? Utils.safeUrl(docObj.url_externa) : '';",
  'driveLink = Utils.safeUrl ? Utils.safeUrl(docObj.url_externa)'
);

ensureReplace(
  'responsável técnico escapado',
  "${obra.engenheiro_responsavel || obra.responsavel || DB.getEmpresa()?.responsavel || 'Não informado'}",
  "${obra.engenheiro_responsavel || obra.responsavel || empresaHtml.responsavel || 'Não informado'}",
  'empresaHtml.responsavel'
);

ensureReplace(
  'neutralização de fórmulas XLSX',
  "      const ws = XLSX.utils.aoa_to_sheet(data);",
  "      const safeData = data.map(row => Array.isArray(row) ? row.map(cell => this._safeSpreadsheetCell(cell)) : row);\n      const ws = XLSX.utils.aoa_to_sheet(safeData);",
  'const safeData = data.map(row => Array.isArray(row)'
);

ensureReplace(
  'dados seguros na impressão de engenharia',
  "    const obra = DB.getById('clientes', id) || { nome: 'Todas as Obras / Geral' };\n    const emp = DB.getEmpresa() || {};\n    const empNome = emp.razao_social || emp.nome_fantasia || 'FINOBRA CONSTRUTORA';\n    const safeLogoUrl = Utils.safeUrl ? Utils.safeUrl(emp.logo_url) : emp.logo_url;",
  "    const obraRaw = DB.getById('clientes', id) || { nome: 'Todas as Obras / Geral' };\n    const obra = this._safeHtmlRecord(obraRaw);\n    const empRaw = DB.getEmpresa() || {};\n    const emp = this._safeHtmlRecord(empRaw);\n    const empNome = emp.razao_social || emp.nome_fantasia || 'FINOBRA CONSTRUTORA';\n    const safeLogoUrl = Utils.safeUrl ? Utils.safeUrl(empRaw.logo_url) : '';",
  "const obraRaw = DB.getById('clientes', id) || { nome: 'Todas as Obras / Geral' };"
);

ensureReplace(
  'dados seguros no dossiê',
  "  gerarHTMLDossie(obraId) {\n    const obra = DB.getById('clientes', obraId);\n    if (!obra) return '<p>Obra não encontrada</p>';\n\n    const emp = (typeof DB !== 'undefined' && DB.getEmpresa) ? DB.getEmpresa() : {};",
  "  gerarHTMLDossie(obraId) {\n    const obraRaw = DB.getById('clientes', obraId);\n    if (!obraRaw) return '<p>Obra não encontrada</p>';\n    const obra = this._safeHtmlRecord(obraRaw);\n\n    const empRaw = (typeof DB !== 'undefined' && DB.getEmpresa) ? (DB.getEmpresa() || {}) : {};\n    const emp = this._safeHtmlRecord(empRaw);",
  "gerarHTMLDossie(obraId) {\n    const obraRaw = DB.getById('clientes', obraId);"
);

ensureReplace(
  'logo seguro no dossiê',
  "    const empNome = emp.nome_fantasia || emp.razao_social || 'Minha Empresa';\n    const logoHtml = emp.logo_url \n      ? `<img src=\"${emp.logo_url}\" alt=\"${empNome}\" style=\"max-height:48px;max-width:130px;object-fit:contain;\">`",
  "    const empNome = emp.nome_fantasia || emp.razao_social || 'Minha Empresa';\n    const safeLogoUrl = Utils.safeUrl ? Utils.safeUrl(empRaw.logo_url) : '';\n    const logoHtml = safeLogoUrl\n      ? `<img src=\"${safeLogoUrl}\" alt=\"${empNome}\" style=\"max-height:48px;max-width:130px;object-fit:contain;\">`",
  "const safeLogoUrl = Utils.safeUrl ? Utils.safeUrl(empRaw.logo_url) : '';\n    const logoHtml = safeLogoUrl"
);

fs.writeFileSync(target, src);
const syntax = spawnSync(process.execPath, ['--check', target], { cwd: root, encoding: 'utf8' });
if (syntax.status !== 0) {
  console.error('[Patch24] erro de sintaxe após transformação.');
  console.error(syntax.stderr || syntax.stdout || 'node --check falhou');
  process.exit(syntax.status || 1);
}
console.log('[Patch24] transformação concluída e sintaxe validada.');
