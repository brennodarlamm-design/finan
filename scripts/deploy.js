// scripts/deploy.js — Bloqueio do Vercel conforme AGENTS.md
console.error('❌ ERRO: O deploy no Vercel foi BANIDO conforme regra inegociável em AGENTS.md.');
console.error('👉 O destino único de produção é o Cloudflare Pages:');
console.error('   1. npm run build:cloudflare');
console.error('   2. npm run deploy:cloudflare');
process.exit(1);

