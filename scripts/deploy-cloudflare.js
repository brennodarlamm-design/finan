// scripts/deploy-cloudflare.js — Deploy seguro no Cloudflare Pages/Worker com carregamento de .env.local
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error('❌ CLOUDFLARE_API_TOKEN não encontrado no arquivo .env.local');
  process.exit(1);
}

console.log('🚀 Iniciando deploy no Cloudflare Pages/Worker via Wrangler...');

try {
  execSync('npx wrangler deploy', {
    stdio: 'inherit',
    env: process.env
  });
  console.log('✅ Deploy no Cloudflare concluído com sucesso!');
} catch (err) {
  console.error('❌ Falha na execução do wrangler deploy:', err.message);
  process.exit(1);
}
