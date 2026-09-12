// Normaliza o único handler condicional gerado por template antes da migração CSP do Patch 25.
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'js/obra_detalhe.js');
let src = fs.readFileSync(target, 'utf8');
const before = 'onclick="Utils.closeModal(); ${isExcel ? `ObraDetalhe.exportarExcel(\'${op.modo}\', \'${id}\')` : `ObraDetalhe.imprimir(\'${op.modo}\', \'${id}\')`}"';
const after = 'data-od-click="Utils.closeModal(); ${isExcel ? `ObraDetalhe.exportarExcel(\'${op.modo}\', \'${id}\')` : `ObraDetalhe.imprimir(\'${op.modo}\', \'${id}\')`}"';

if (src.includes(after)) {
  console.log('[Patch25 prepare] handler condicional já normalizado.');
} else if (src.includes(before)) {
  src = src.replace(before, after);
  fs.writeFileSync(target, src);
  console.log('[Patch25 prepare] handler condicional normalizado.');
} else {
  console.error('[Patch25 prepare] handler condicional esperado não encontrado.');
  process.exit(1);
}
