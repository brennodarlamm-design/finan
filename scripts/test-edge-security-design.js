// scripts/test-edge-security-design.js — Teste Automatizado de Hardening Edge e Design Fingo
import fs from 'fs';
import path from 'path';

let fails = 0;
function test(name, cond) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}`);
    fails++;
  }
}

console.log('=== Suíte de Testes: Hardening Edge & Design System FinGo ===\n');

const edgeAdapterCode = fs.readFileSync('api/_edge-adapter.js', 'utf8');
const cfWorkerCode = fs.readFileSync('cloudflare-worker.js', 'utf8');
const authCode = fs.readFileSync('api/auth.js', 'utf8');
const adminCode = fs.readFileSync('api/admin.js', 'utf8');
const adminRouteCode = fs.readFileSync('api/_admin-route.js', 'utf8');
const webhookPixCode = fs.readFileSync('api/_webhook_pix.js', 'utf8');
const webhookPixCoreCode = fs.readFileSync('api/_webhook_pix_core.js', 'utf8');
const premiumCssCode = fs.readFileSync('css/premium.css', 'utf8');

// 1. Edge Adapter Security Headers & HTTPS
console.log('\n[SEC-EDGE-01] Propagação HTTPS e Headers de Sessão no Edge:');
test('_edge-adapter.js injeta x-forwarded-proto HTTPS e cf-connecting-ip', /headers\['x-forwarded-proto'\]/.test(edgeAdapterCode) && /headers\['cf-connecting-ip'\]/.test(edgeAdapterCode));
test('api/auth.js cookieSecure suporta HTTPS canônico e x-forwarded-proto', /proto === 'https'/.test(authCode) && /FINOBRA_CANONICAL_ORIGIN/.test(authCode));
test('api/admin.js cookieSecure suporta HTTPS canônico e x-forwarded-proto', /proto === 'https'/.test(adminCode) && /FINOBRA_CANONICAL_ORIGIN/.test(adminCode));
test('api/_admin-route.js cookieSecure suporta HTTPS canônico e x-forwarded-proto', /proto === 'https'/.test(adminRouteCode) && /FINOBRA_CANONICAL_ORIGIN/.test(adminRouteCode));

// 2. Proteção de Webhooks & DoS
console.log('\n[SEC-EDGE-02 / 07 / 08] Proteção de Webhooks PIX contra DoS e Timing Attacks:');
test('_webhook_pix.js só resolve sessão se credencial estiver presente', /hasAuthCredential/.test(webhookPixCode) && /resolveAuthAndTenant/.test(webhookPixCode));
test('_webhook_pix_core.js usa SHA-256 com crypto.timingSafeEqual', /createHash\('sha256'\)/.test(webhookPixCoreCode) && /timingSafeEqual\(hashA,\s*hashB\)/.test(webhookPixCoreCode));
test('_webhook_pix_core.js referencia record.tenant_id corretamente', /tenantId:\s*record\.tenant_id\s*\|\|\s*null/.test(webhookPixCoreCode));

// 3. Sanitização de Logs e Headers de Borda
console.log('\n[SEC-EDGE-04 / 06] Sanitização de Logs e Headers Defensivos:');
test('_edge-adapter.js sanitiza credenciais de banco dos logs', /postgresql:\/\/\[REDACTED_CREDENTIALS\]/.test(edgeAdapterCode));
test('_edge-adapter.js aplica strict-transport-security e x-content-type-options', /strict-transport-security/.test(edgeAdapterCode) && /x-content-type-options/.test(edgeAdapterCode));
test('cloudflare-worker.js injeta HSTS e nosniff em handleApi', /Strict-Transport-Security/.test(cfWorkerCode) && /X-Content-Type-Options/.test(cfWorkerCode));

// 4. Design System & Eliminação de Teal Legado
console.log('\n[DESIGN] Purga de #12D9A0 e Adoção de Tokens Brutalist FinGo:');
test('premium.css .ui-auth utiliza tokens canônicos --fingo-acid e cantos 4px', /--fingo-acid/.test(premiumCssCode) && /var\(--radius-default,\s*4px\)/.test(premiumCssCode));

// Verificação de zero #12D9A0 em css/ e js/
const jsFiles = fs.readdirSync('js').filter(f => f.endsWith('.js'));
const cssFiles = fs.readdirSync('css').filter(f => f.endsWith('.css'));
let legacyTealCount = 0;
for (const f of [...jsFiles.map(x => 'js/' + x), ...cssFiles.map(x => 'css/' + x)]) {
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(/#12D9A0/gi) || [];
  legacyTealCount += matches.length;
}
test('Zero resquícios de #12D9A0 em css/ e js/', legacyTealCount === 0);

console.log(`\nResultado: ${12 - fails}/12 testes aprovados.`);
if (fails > 0) {
  process.exit(1);
}
console.log('🚀 Hardening Edge e Design System FinGo validados com sucesso!\n');
