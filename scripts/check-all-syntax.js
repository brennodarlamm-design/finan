import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const dirs = ['api', 'backend', 'js', 'scripts'];
let errors = 0;
let checked = 0;

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const fullPath = path.join(dir, file);
    try {
      execSync(`node --check "${fullPath}"`);
      checked++;
    } catch (e) {
      console.error(`❌ Erro de sintaxe em ${fullPath}:`, e.message);
      errors++;
    }
  }
}

console.log(`\nVerificação concluída: ${checked} arquivos verificados, ${errors} erros de sintaxe.`);
if (errors > 0) process.exit(1);
