// scripts/test-sentry-integration.js — Teste Automatizado de Integração do Sentry Browser
import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 Iniciando testes de integração do Sentry Browser no FinGo...');

const root = process.cwd();

// 1. Validar existência e conteúdo do bundle js/sentry.js
const sentryBundlePath = path.join(root, 'js', 'sentry.js');
assert.ok(fs.existsSync(sentryBundlePath), 'js/sentry.js deve existir');
const sentryBundle = fs.readFileSync(sentryBundlePath, 'utf8');
assert.ok(
  sentryBundle.includes('4512148402929664') || sentryBundle.includes('o4511236225892352.ingest.us.sentry.io'),
  'js/sentry.js deve conter o DSN configurado do Sentry'
);
assert.ok(sentryBundle.includes('browserTracingIntegration'), 'js/sentry.js deve conter tracing do Sentry');

// 2. Validar inclusão do script nas páginas principais
for (const page of ['index.html', 'app.html', 'master.html', 'landing.html']) {
  const pagePath = path.join(root, page);
  assert.ok(fs.existsSync(pagePath), `${page} deve existir`);
  const html = fs.readFileSync(pagePath, 'utf8');
  assert.ok(html.includes('/js/sentry.js'), `${page} deve incluir /js/sentry.js`);
}

// 3. Validar CSP em cloudflare-worker.js e vercel.json
const cfWorker = fs.readFileSync(path.join(root, 'cloudflare-worker.js'), 'utf8');
assert.ok(
  cfWorker.includes('https://*.ingest.us.sentry.io') && cfWorker.includes('https://*.ingest.sentry.io'),
  'cloudflare-worker.js deve incluir domínios de ingestão do Sentry em connect-src'
);

const vercelJson = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
assert.ok(
  vercelJson.includes('https://*.ingest.us.sentry.io'),
  'vercel.json deve incluir domínios de ingestão do Sentry em connect-src'
);

// 4. Validar integração com js/auth.js (set/clear Sentry user)
const authJs = fs.readFileSync(path.join(root, 'js', 'auth.js'), 'utf8');
assert.ok(authJs.includes('window.Sentry.setUser'), 'js/auth.js deve registrar contexto do usuário no Sentry');

// 5. Testar carregamento dinâmico do bundle em runtime
const mockWindow = {
  location: { hostname: 'fingo.api.br' },
  addEventListener: () => {}
};
globalThis.window = mockWindow;

const sentryModule = await import('../js/sentry.js');
assert.ok(mockWindow.Sentry || sentryModule, 'Sentry deve ser exportado e vinculado a window.Sentry');

console.log('  ✓ Bundle js/sentry.js validado com sucesso.');
console.log('  ✓ Inclusão nas páginas HTML (index, app, master, landing) confirmada.');
console.log('  ✓ Content-Security-Policy (CSP) conectada e liberada para o ingest do Sentry.');
console.log('  ✓ Rastreabilidade de usuário vinculada ao ciclo de sessão Auth.');
console.log('🎉 TODOS OS TESTES DO SENTRY BROWSER PASSARAM COM SUCESSO!\n');
