import fs from 'fs';

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
}

const worker = fs.readFileSync('cloudflare-worker.js', 'utf8');
const wrangler = fs.readFileSync('wrangler.jsonc', 'utf8');

assert(worker.includes('API upstream loop detected'), 'Worker precisa bloquear loop quando API origin == request origin.');
assert(worker.includes("url.pathname === '/__finobra/health'"), 'Worker precisa expor health de edge para o cutover.');
assert(worker.includes('configuredApiOrigin'), 'Health deve informar o origin configurado sem depender do frontend.');
assert(worker.includes('loopRisk'), 'Health precisa sinalizar risco de loop de upstream.');
assert(wrangler.includes('FINOBRA_API_ORIGIN'), 'Wrangler deve manter FINOBRA_API_ORIGIN configurável.');
assert(wrangler.includes('FINOBRA_CANONICAL_ORIGIN'), 'Wrangler deve manter FINOBRA_CANONICAL_ORIGIN configurável.');

console.log('✅ Patch 29: guard de loop e health de cutover validados.');
