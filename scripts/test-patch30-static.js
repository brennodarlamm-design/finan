import fs from 'fs';

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
}

const worker = fs.readFileSync('cloudflare-worker.js', 'utf8');
const wrangler = fs.readFileSync('wrangler.jsonc', 'utf8');

assert(worker.includes("const DEFAULT_API_ORIGIN = 'https://api.finobra.app.br'"), 'Worker deve usar api.finobra.app.br como upstream padrão.');
assert(worker.includes("const DEFAULT_CANONICAL_ORIGIN = 'https://finobra.app.br'"), 'Worker deve manter finobra.app.br como origem canônica.');
assert(wrangler.includes('"FINOBRA_API_ORIGIN": "https://api.finobra.app.br"'), 'Wrangler deve configurar o hostname dedicado da API.');
assert(wrangler.includes('"FINOBRA_CANONICAL_ORIGIN": "https://finobra.app.br"'), 'Wrangler deve manter o domínio principal como origem canônica.');
assert(wrangler.includes('"run_worker_first": ["/api/*", "/__finobra/health"]'), 'Wrangler deve executar o Worker para /api/* e /__finobra/health.');
assert(!wrangler.includes('"FINOBRA_API_ORIGIN": "https://finobra.app.br"'), 'API não pode voltar a usar o domínio principal, pois criaria risco de loop após o cutover.');
assert(worker.includes("url.pathname === '/__finobra/health'"), 'Endpoint de health deve permanecer implementado no Worker.');
assert(worker.includes('API upstream loop detected'), 'Guard de loop do Patch 29 deve permanecer ativo.');

console.log('✅ Patch 30: hostname dedicado, health route e proteção contra loop validados.');
