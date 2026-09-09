// scripts/deploy.js — Executa o deploy no Vercel CLI usando o token do .env.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { spawn } from 'child_process';

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error('❌ VERCEL_TOKEN não encontrado em .env.local');
  process.exit(1);
}

console.log('🚀 Iniciando deploy em produção no Vercel CLI...');

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['vercel', 'deploy', '--prod', '--yes', '--token', token];

const child = spawn(cmd, args, { stdio: 'inherit', shell: true });

child.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Deploy finalizado com sucesso!');
  } else {
    console.error(`❌ Processo de deploy encerrou com código ${code}`);
  }
  process.exit(code);
});
