// scripts/package-release.js — Gerador Seguro de Pacotes de Release FinObra (Zero-Leak Policy)

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const BLOCKED_PATTERNS = [
  /^\.env/i,
  /\.env(\..+)?$/i,
  /^\.git($|[\\/])/i,
  /^\.vercel($|[\\/])/i,
  /(^|[\\/])node_modules($|[\\/])/i,
  /(^|[\\/])\.wwebjs_auth($|[\\/])/i,
  /(^|[\\/])auth_info_baileys($|[\\/])/i,
  /(^|[\\/])scratch($|[\\/])/i,
  /\.(pfx|p12|pem|key)$/i,
  /\.log$/i,
  /\.tmp$/i,
  /\.bak$/i,
  /\.zip$/i,
  /monitor-nfe[\\/]config\.json$/i,
  /monitor-nfe[\\/]logs($|[\\/])/i,
  /monitor-nfe[\\/]xmls($|[\\/])/i
];

function isBlocked(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  return BLOCKED_PATTERNS.some(re => re.test(normalized));
}

function getAllFiles(dir, baseDir = dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (isBlocked(relPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      results.push(relPath);
    }
  }

  return results;
}

export function generateReleasePackage() {
  console.log('📦 Iniciando geração do pacote seguro de release FinObra...');
  const rootDir = process.cwd();
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const version = pkg.version || '2.13.0';

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const zipName = `FINOBRA_RELEASE_v${version}_${dateStr}.zip`;
  const tempDir = path.join(rootDir, '.release_temp');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  const files = getAllFiles(rootDir);
  console.log(`🔍 Total de arquivos válidos para o pacote: ${files.length}`);

  let sensitiveCount = 0;
  for (const f of files) {
    if (isBlocked(f)) {
      console.error(`🚨 ALERTA: Arquivo sensível detectado e barrado: ${f}`);
      sensitiveCount++;
      continue;
    }

    const src = path.join(rootDir, f);
    const dest = path.join(tempDir, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }

  if (sensitiveCount > 0) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error('Falha na auditoria de segurança: arquivos sensíveis tentaram ser incluídos!');
  }

  // Gera o arquivo ZIP
  const outputPath = path.join(rootDir, zipName);
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  console.log(`🗜️ Comprimindo arquivos em ${zipName}...`);
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${tempDir}/*' -DestinationPath '${outputPath}' -Force"`);
  } else {
    execSync(`cd '${tempDir}' && zip -r '${outputPath}' ./*`);
  }

  fs.rmSync(tempDir, { recursive: true, force: true });

  const stats = fs.statSync(outputPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n======================================================`);
  console.log(`✅ Pacote de Release gerado com sucesso!`);
  console.log(`📁 Arquivo: ${zipName}`);
  console.log(`⚖️ Tamanho: ${sizeMb} MB`);
  console.log(`🛡️ Auditoria: 0 arquivos sensíveis (.env, .git, chaves privadas) incluídos.`);
  console.log(`======================================================\n`);

  return { zipName, sizeMb, fileCount: files.length };
}

// Execução direta via CLI
generateReleasePackage();

