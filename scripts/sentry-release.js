// scripts/sentry-release.js — Automatização de Releases do Sentry no FinGo
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Carregar variáveis de .env.local ou .env se existirem
for (const envFile of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
}

const token = process.env.SENTRY_AUTH_TOKEN;
const org = process.env.SENTRY_ORG || 'brenno-darlan-almeida-costa';
const project = process.env.SENTRY_PROJECT || 'javascript';

if (!token) {
  console.error('❌ ERRO: SENTRY_AUTH_TOKEN não encontrado em .env.local ou nas variáveis de ambiente.');
  console.error('Defina SENTRY_AUTH_TOKEN no arquivo .env.local ou execute:');
  console.error('$env:SENTRY_AUTH_TOKEN="seu_token" (PowerShell) ou export SENTRY_AUTH_TOKEN="seu_token" (Bash)');
  process.exit(1);
}

const env = {
  ...process.env,
  SENTRY_AUTH_TOKEN: token,
  SENTRY_ORG: org,
  SENTRY_PROJECT: project
};

try {
  console.log(`🚀 Iniciando processo de release no Sentry (${org}/${project})...`);

  // 1. Propor versão
  const version = execSync('npx @sentry/cli releases propose-version', { env, encoding: 'utf8' }).trim();
  console.log(`📌 Versão proposta: ${version}`);

  // 2. Criar nova release
  console.log(`➕ Criando release ${version}...`);
  execSync(`npx @sentry/cli releases new "${version}"`, { env, stdio: 'inherit' });

  // 3. Vincular commits
  console.log(`🔗 Associando commits automaticamente...`);
  try {
    execSync(`npx @sentry/cli releases set-commits "${version}" --auto`, { env, stdio: 'inherit' });
  } catch (commitErr) {
    console.warn(`⚠️ Não foi possível associar commits automaticamente (${commitErr.message}). Continuando...`);
  }

  // 4. Finalizar release
  console.log(`🏁 Finalizando release ${version}...`);
  execSync(`npx @sentry/cli releases finalize "${version}"`, { env, stdio: 'inherit' });

  console.log(`✅ Release ${version} publicada e finalizada no Sentry com sucesso!`);
} catch (error) {
  console.error('❌ Falha ao processar release no Sentry:', error.message);
  process.exit(1);
}
