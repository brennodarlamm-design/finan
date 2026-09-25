// scripts/sync-frontend-modules.js
// Validador e sincronizador de paridade entre frontend/ (core + domains) e js/ (pontes de compatibilidade)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const isFix = process.argv.includes('--fix') || process.argv.includes('--sync');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(walk(full));
    } else if (item.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const feCore = walk(path.join(root, 'frontend', 'core'));
const feDomains = walk(path.join(root, 'frontend', 'domains'));
const allFeFiles = [...feCore, ...feDomains];

const feByBase = new Map();
for (const f of allFeFiles) {
  feByBase.set(path.basename(f), f);
}

const jsDir = path.join(root, 'js');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

let missingInFrontend = [];
let missingInJs = [];
let contentDiffs = [];

// Checar arquivos em js/
for (const jsFile of jsFiles) {
  const fePath = feByBase.get(jsFile);
  const jsPath = path.join(jsDir, jsFile);
  if (!fePath) {
    missingInFrontend.push(jsFile);
  } else {
    const bufJs = fs.readFileSync(jsPath);
    const bufFe = fs.readFileSync(fePath);
    if (!bufJs.equals(bufFe)) {
      contentDiffs.push({ file: jsFile, jsPath, fePath });
      if (isFix) {
        // Copiar o mais recente
        const statJs = fs.statSync(jsPath);
        const statFe = fs.statSync(fePath);
        if (statJs.mtimeMs > statFe.mtimeMs) {
          fs.copyFileSync(jsPath, fePath);
          console.log(`[Sync] Sincronizado ${jsFile} -> frontend`);
        } else {
          fs.copyFileSync(fePath, jsPath);
          console.log(`[Sync] Sincronizado ${jsFile} -> js/`);
        }
      }
    }
  }
}

// Checar arquivos em frontend/
for (const [base, fePath] of feByBase.entries()) {
  const jsPath = path.join(jsDir, base);
  if (!fs.existsSync(jsPath)) {
    missingInJs.push(base);
    if (isFix) {
      fs.copyFileSync(fePath, jsPath);
      console.log(`[Sync] Criada ponte em js/ para ${base}`);
    }
  }
}

const hasErrors = missingInFrontend.length > 0 || missingInJs.length > 0 || (!isFix && contentDiffs.length > 0);

if (hasErrors) {
  console.error('❌ Inconsistências de paridade detectadas no Monólito Modular:');
  if (missingInFrontend.length) console.error('  - Ausentes em frontend/:', missingInFrontend);
  if (missingInJs.length) console.error('  - Ausentes em js/:', missingInJs);
  if (!isFix && contentDiffs.length) console.error('  - Conteúdo divergente:', contentDiffs.map(d => d.file));
  process.exit(1);
} else {
  console.log(`✅ Paridade 100% validada entre frontend/ (${allFeFiles.length} módulos) e js/ (${jsFiles.length} pontes).`);
  process.exit(0);
}
