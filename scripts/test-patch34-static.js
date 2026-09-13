import fs from 'fs';

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
}

const worker = fs.readFileSync('cloudflare-worker.js', 'utf8');
const wrangler = fs.readFileSync('wrangler.jsonc', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

assert(wrangler.includes('"/app/*"'), 'Wrangler deve executar o Worker antes dos assets em /app/*.');
assert(worker.includes('function isAppShellPath(pathname)'), 'Worker deve identificar rotas do app shell.');
assert(worker.includes("pathname.startsWith('/app/')"), 'Worker deve reconhecer rotas internas aninhadas do app.');
assert(worker.includes("new URL('/app', incoming)"), 'Rotas /app/* devem resolver pelo clean URL /app no binding de assets.');
assert(!worker.includes("new URL('/app.html', incoming)"), 'Worker não pode buscar /app.html, pois o clean URL da Cloudflare cria loop.');
assert(worker.includes("routeName = 'app-shell'") && worker.includes("headers.set('X-FinObra-Route', routeName)"), 'Resposta do app shell deve continuar identificável dentro do roteador multi-shell.');
assert(worker.includes('return fetchFrontendResponse(request, env);'), 'Fluxo frontend deve passar pelo resolvedor do app shell.');
assert(app.includes("if (path.startsWith('/app/'))"), 'Router cliente deve continuar lendo rotas limpas /app/*.');
assert(app.includes("const sub = path.substring(5)"), 'Router cliente deve extrair a rota após /app/.');

console.log('✅ Patch 34: deep links /app/* usam o app shell sem 404 nem loop de clean URL.');
