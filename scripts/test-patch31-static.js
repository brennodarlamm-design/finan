import fs from 'fs';

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
}

const worker = fs.readFileSync('cloudflare-worker.js', 'utf8');
const wrangler = fs.readFileSync('wrangler.jsonc', 'utf8');
const headers = fs.readFileSync('cloudflare/_headers', 'utf8');

assert(worker.includes('function canonicalRedirect(request, env)'), 'Worker deve implementar redirect canônico.');
assert(worker.includes('const wwwHost = `www.${canonical.hostname}`'), 'Redirect deve reconhecer o host www do domínio canônico.');
assert(worker.includes('status: 308'), 'Redirect canônico deve ser permanente e preservar método em navegadores compatíveis.');
assert(worker.includes('function buildContentSecurityPolicy(nonce)'), 'Worker deve gerar CSP dinâmico.');
assert(worker.includes("'nonce-${nonce}'"), 'CSP deve usar nonce por resposta.');
assert(worker.includes("contentType.includes('text/html')"), 'CSP dinâmico deve ser aplicado apenas a respostas HTML.');
assert(worker.includes("Cross-Origin-Opener-Policy', 'same-origin-allow-popups'"), 'HTML deve manter compatibilidade segura com popups do Google.');
assert(worker.includes("securityMode: 'nonce-csp'"), 'Health deve expor o modo de segurança do Patch 31.');

for (const route of ['/', '/index.html', '/app', '/app.html', '/landing', '/master', '/privacidade', '/termos', '/validar']) {
  assert(wrangler.includes(`"${route}"`), `Wrangler deve executar Worker antes dos assets em ${route}.`);
}

assert(!headers.includes('Content-Security-Policy:'), 'CSP estático deve sair de _headers para evitar dupla política com o nonce do Worker.');
assert(!headers.includes('sha256-lv5QAlKyRRFekfMCIK5/skjWMK/6hC6EOpqfQ5fJBrA='), 'Hash CSP transitório antigo não deve permanecer.');
assert(!headers.includes('sha256-RiQEu6B9cjyiSYCR3jRLuThqlZdv+wrEm71eFLqZjzI='), 'Segundo hash CSP transitório antigo não deve permanecer.');
assert(headers.includes('Cross-Origin-Opener-Policy: same-origin-allow-popups'), 'Headers estáticos devem manter COOP compatível com login Google.');
assert(worker.includes("const DEFAULT_API_ORIGIN = 'https://api.fingo.api.br'"), 'Patch 31 não pode alterar o upstream dedicado da API.');
assert(worker.includes('API upstream loop detected'), 'Proteção contra loop deve permanecer ativa.');

console.log('✅ Patch 31: redirect canônico, CSP com nonce e hardening do edge validados.');
