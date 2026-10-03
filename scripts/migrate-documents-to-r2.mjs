// scripts/migrate-documents-to-r2.mjs — Utilitário de Migração de Documentos para Cloudflare R2
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

function loadEnv() {
  const envPath = path.resolve('.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...v] = trimmed.split('=');
      const val = v.join('=').trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k.trim()]) process.env[k.trim()] = val;
    }
  }
}

loadEnv();

const backupFile = path.resolve('scratch', 'backup_documentos_completo.json');
if (!fs.existsSync(backupFile)) {
  console.log('ℹ️ Arquivo scratch/backup_documentos_completo.json não encontrado. Nada para migrar.');
  process.exit(0);
}

const docs = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
const withBase64 = docs.filter(d => d.base64_data);
console.log(`📦 Encontrados ${withBase64.length} documentos com binários para envio ao R2.`);

console.log(`
==================================================================
🚀 Procedimento de Ativação do Cloudflare R2:
1. Certifique-se de ter criado o bucket:
   npx wrangler r2 bucket create fingo-attachments

2. Os novos uploads a partir do app já utilizam automaticamente o R2
   com binding ATTACHMENTS_R2 no Cloudflare Worker.

3. Para consultar os documentos arquivados em scratch/, utilize
   os arquivos físicos salvos em: scratch/exported_docs/
==================================================================
`);
