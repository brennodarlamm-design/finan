// scripts/sync-cloudflare-secrets.js
// Sincroniza segredos de produção do .env.local diretamente para o Cloudflare Worker via Wrangler CLI.

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const envFile = path.resolve('.env.local');
if (!fs.existsSync(envFile)) {
  console.error('❌ Arquivo .env.local não encontrado.');
  process.exit(1);
}

const lines = fs.readFileSync(envFile, 'utf8').split('\n');
const secrets = {};

// Chaves exclusivas da Vercel ou que não devem ir como secrets do Worker
const IGNORE_PREFIXES = ['VERCEL_'];
const IGNORE_KEYS = new Set([
  'NODE_ENV',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID'
]);

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

  const idx = trimmed.indexOf('=');
  const key = trimmed.slice(0, idx).trim();
  let val = trimmed.slice(idx + 1).trim();

  // Remove aspas simples ou duplas se existirem
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }

  if (IGNORE_KEYS.has(key)) continue;
  if (IGNORE_PREFIXES.some(p => key.startsWith(p))) continue;

  secrets[key] = val;
}

const secretKeys = Object.keys(secrets);
console.log(`🔐 Preparando envio de ${secretKeys.length} segredos para o Cloudflare Worker 'finan'...`);
console.log(`Chaves selecionadas: ${secretKeys.join(', ')}`);

// Escreve arquivo temporário de segredos com permissão restrita
const tempJsonPath = path.resolve('.secrets.temp.json');

try {
  fs.writeFileSync(tempJsonPath, JSON.stringify(secrets, null, 2), { mode: 0o600 });

  console.log('🚀 Enviando segredos via "wrangler secret bulk"...');
  const { execSync } = await import('child_process');
  execSync(`npx wrangler secret bulk "${tempJsonPath}"`, {
    stdio: 'inherit',
    env: process.env
  });

  console.log('✅ Todos os segredos foram gravados com sucesso no Cloudflare Worker!');
} catch (err) {
  console.error('❌ Falha ao sincronizar segredos:', err.message);
  process.exit(1);
} finally {
  // Limpeza de segurança: NUNCA deixa o JSON em disco
  if (fs.existsSync(tempJsonPath)) {
    fs.unlinkSync(tempJsonPath);
    console.log('🔒 Arquivo temporário de segredos eliminado.');
  }
}
