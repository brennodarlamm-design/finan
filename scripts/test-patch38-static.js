import fs from 'fs';

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Patch 38: ${message}`);
    process.exit(1);
  }
}

const worker = read('cloudflare-worker.js');
const build = read('scripts/build-cloudflare-pages.cjs');
const landing = read('landing.html');
const landingPage = read('js/landing_page.js');
const login = read('index.html');
const loginPage = read('js/login_page.js');
const redirects = read('cloudflare/_redirects');
const robots = read('data/robots.txt');
const sitemap = read('data/sitemap.xml');
const privacy = read('privacidade.html');
const terms = read('termos.html');
const validation = read('validar.html');

assert(worker.includes("new URL('/app.html', incoming)"), 'o app-shell deve resolver o arquivo app.html explicitamente.');
assert(worker.includes("new URL('/login.html', incoming)"), 'login/cadastro devem resolver o arquivo login.html explicitamente.');
assert(worker.includes("routeName = incoming.pathname === '/cadastro' ? 'signup-shell' : 'login-shell'"), 'login e cadastro precisam de identificadores de rota distintos.');
assert(worker.includes("headers.set('X-Robots-Tag', 'noindex, nofollow')"), 'rotas privadas devem enviar X-Robots-Tag noindex.');
assert(worker.includes("target.pathname === '/app.html'"), 'app.html deve possuir redirect canônico para /app.');

assert(build.includes("copyRequired(path.join(root, 'landing.html'), path.join(out, 'index.html'))"), 'a raiz pública deve ser materializada a partir da landing.');
assert(build.includes("copyRequired(path.join(root, 'index.html'), path.join(out, 'login.html'))"), 'o login deve ter arquivo dedicado no dist.');

assert(!redirects.includes('/login / 302'), 'o redirect legado /login -> / deve ter sido removido.');
assert(redirects.includes('/login /login.html 200'), 'assets devem possuir fallback explícito de /login para login.html.');
assert(redirects.includes('/cadastro /login.html 200'), 'assets devem possuir fallback explícito de /cadastro para login.html.');
assert(redirects.includes('/app/* /app.html 200'), 'assets devem possuir fallback explícito para rotas internas do app.');
assert(redirects.includes('/privacidade /privacidade.html 200'), 'Privacidade deve resolver explicitamente seu próprio documento.');
assert(redirects.includes('/termos /termos.html 200'), 'Termos deve resolver explicitamente seu próprio documento.');
assert(redirects.includes('/validar /validar.html 200'), 'Validação deve resolver explicitamente seu próprio documento.');
assert(redirects.includes('/robots.txt /data/robots.txt 200'), 'robots.txt deve ser publicado na raiz.');
assert(redirects.includes('/sitemap.xml /data/sitemap.xml 200'), 'sitemap.xml deve ser publicado na raiz.');

assert(landing.includes('<link rel="canonical" href="https://finobra.app.br/">'), 'a landing deve manter canonical apontando para a raiz.');
assert(landing.includes('href="/login"'), 'a landing deve apontar Entrar/Área do Cliente para /login.');
assert(landing.includes('href="/cadastro"'), 'a landing deve apontar teste grátis para /cadastro.');
assert(landingPage.includes("brandHomeLink.setAttribute('href', '/')"), 'o logo deve navegar diretamente para a home canônica.');
assert(landingPage.includes("window.matchMedia('(max-width: 700px)')"), 'FAQ deve possuir tratamento de visibilidade em telas pequenas.');

assert(login.includes('id="login-form"'), 'o shell de autenticação precisa conter o formulário de login.');
assert(login.includes('id="register-modal"'), 'o shell de autenticação precisa conter o cadastro.');
assert(loginPage.includes("window.location.pathname === '/cadastro'"), 'o cadastro deve abrir automaticamente ao acessar /cadastro.');
assert(loginPage.includes("window.location.replace('/app')"), 'login/cadastro concluídos devem entrar no app-shell.');

assert(privacy.includes('<title>Política de Privacidade — FinObra</title>'), 'Privacidade deve possuir conteúdo e título próprios.');
assert(terms.includes('<title>Termos de Serviço — FinObra</title>'), 'Termos deve possuir conteúdo e título próprios.');
assert(validation.includes('<title>Portal de Validação de Registros de Assinatura — FinObra</title>'), 'Validação deve possuir conteúdo e título próprios.');
assert(!privacy.includes('Portal de Validação de Registros de Assinatura'), 'Privacidade não pode conter o conteúdo do portal de validação.');

assert(robots.includes('Disallow: /app'), 'robots deve bloquear o app autenticado.');
assert(robots.includes('Disallow: /login'), 'robots deve bloquear login.');
assert(robots.includes('Disallow: /cadastro'), 'robots deve bloquear cadastro.');
assert(robots.includes('Sitemap: https://finobra.app.br/sitemap.xml'), 'robots deve anunciar o sitemap canônico.');
assert(sitemap.includes('<loc>https://finobra.app.br/</loc>'), 'sitemap deve incluir a landing canônica.');
assert(sitemap.includes('<loc>https://finobra.app.br/privacidade</loc>'), 'sitemap deve incluir Privacidade.');
assert(sitemap.includes('<loc>https://finobra.app.br/termos</loc>'), 'sitemap deve incluir Termos.');
assert(!sitemap.includes('/login'), 'sitemap não deve indexar login.');
assert(!sitemap.includes('/cadastro'), 'sitemap não deve indexar cadastro.');
assert(!sitemap.includes('/app'), 'sitemap não deve indexar área autenticada.');

console.log('✅ Patch 38: roteamento público, SEO, legal, landing e invariantes de shell validados.');
