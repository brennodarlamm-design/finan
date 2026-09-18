/**
 * scripts/audit-inline-styles.js
 * Executa auditoria estática da contagem de estilos inline e conformidade com tokens.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const JS_DIR = path.join(root, 'js');

const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));

let totalInline = 0;
const report = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
  const matches = content.match(/style\s*=\s*["'][^"']+["']/gi) || [];
  if (matches.length > 0) {
    totalInline += matches.length;
    report.push({ file, count: matches.length });
  }
}

report.sort((a, b) => b.count - a.count);

console.log('─── FINOBRA DESIGN SYSTEM: INLINE STYLES BURNDOWN REPORT ───');
console.table(report.slice(0, 15));
console.log(`Total de estilos inline restantes: ${totalInline}`);

if (process.argv.includes('--check-budget')) {
  const BUDGET = 6000; // Limite orçamentário seguro para a fase atual
  if (totalInline > BUDGET) {
    console.error(`❌ FALHA: Quantidade de inline styles (${totalInline}) excede o limite estabelecido (${BUDGET}).`);
    process.exit(1);
  } else {
    console.log('✅ SUCESSO: Dentro do orçamento de estilos permitido.');
  }
}
