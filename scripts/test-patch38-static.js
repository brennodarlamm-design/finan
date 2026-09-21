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
const landing = read('landing.html') + read('marketing/main.jsx');
const landingPage = read('marketing/main.jsx') + read('marketing/brand-sections.jsx');
const login = read('index.html');
const loginPage = read('js/login_page.js');
const authRoute = read('js/auth-route-patch38.js');
const redirects = read('cloudflare/_redirects');
const robots = read('data/robots.txt');
const sitemap = read('data/sitemap.xml');
const privacy = read('privacidade.html');
const terms = read('termos.html');
const validation = read('validar.html');
const authCss = read('css/auth-patch38.css');
const postbuild = read('scripts/patch38-postbuild.cjs');
const pkg = JSON.parse(read('package.json'));

assert(worker.includes("assetPath = '/app.html'"), 'o app-shell deve resolver o arquivo app.html explicitamente.');
assert(worker.includes("assetPath = '/login.html'"), 'login/cadastro devem resolver o arquivo login.html explicitamente.');
assert(worker.includes("routeName = incoming.pathname === '/cadastro' ? 'signup-shell' : 'login-shell'"), 'login e cadastro precisam de identificadores de rota distintos.');
assert(worker.includes("headers.set('X-Robots-Tag', 'noindex, nofollow')"), 'rotas privadas devem enviar X-Robots-Tag noindex.');
assert(worker.includes("target.pathname === '/app.html'"), 'app.html deve possuir redirect canônico para /app.');

assert(build.includes("copyRequired(path.join(root, 'landing.html'), path.join(out, 'index.html'))"), 'a raiz pública deve ser materializada a partir da landing.');
assert(build.includes("copyRequired(path.join(root, 'index.html'), path.join(out, 'login.html'))"), 'o login deve ter arquivo dedicado no dist.');
assert(pkg.scripts['build:cloudflare'].includes('patch38-postbuild.cjs'), 'build Cloudflare deve executar o pós-build do Patch 38.');
assert(pkg.scripts.postinstall.includes('patch38-postbuild.cjs'), 'postinstall deve gerar o mesmo dist endurecido.');
assert(postbuild.includes("patchDocument('privacidade.html'"), 'pós-build deve canonicalizar Privacidade.');
assert(postbuild.includes("patchDocument('termos.html'"), 'pós-build deve canonicalizar Termos.');
assert(postbuild.includes("patchDocument('validar.html'"), 'pós-build deve canonicalizar Validação.');
assert(postbuild.includes('/css/auth-patch38.css'), 'pós-build deve incluir a folha mobile de autenticação.');
assert(postbuild.includes('/js/auth-route-patch38.js'), 'pós-build deve incluir o comportamento específico das rotas de autenticação.');

assert(!redirects.includes('/login / 302'), 'o redirect legado /login -> / deve ter sido removido.');
assert(redirects.includes('/login /login.html 200'), 'assets devem possuir fallback explícito de /login para login.html.');
assert(redirects.includes('/cadastro /login.html 200'), 'assets devem possuir fallback explícito de /cadastro para login.html.');
assert(redirects.includes('/app/* /app.html 200'), 'assets devem possuir fallback explícito para rotas internas do app.');
assert(redirects.includes('/privacidade /privacidade.html 200'), 'Privacidade deve resolver explicitamente seu próprio documento.');
assert(redirects.includes('/termos /termos.html 200'), 'Termos deve resolver explicitamente seu próprio documento.');
assert(redirects.includes('/validar /validar.html 200'), 'Validação deve resolver explicitamente seu próprio documento.');
assert(redirects.includes('/robots.txt /data/robots.txt 200'), 'robots.txt deve ser publicado na raiz.');
assert(redirects.includes('/sitemap.xml /data/sitemap.xml 200'), 'sitemap.xml deve ser publicado na raiz.');

assert(landing.includes('<link rel="canonical" href="https://fingo.api.br/">'), 'a landing deve manter canonical apontando para a raiz.');
assert(landing.includes('href="/login"'), 'a landing deve apontar Entrar/Área do Cliente para /login.');
assert(landing.includes('href="/cadastro"'), 'a landing deve apontar teste grátis para /cadastro.');
assert(landingPage.includes('href="/"'), 'o logo React navega para a home canônica.');
assert(landingPage.includes('<details') && landingPage.includes('<summary'), 'FAQ usa disclosure nativo acessível no celular.');

assert(login.includes('id="login-form"'), 'o shell de autenticação precisa conter o formulário de login.');
assert(login.includes('id="register-modal"'), 'o shell de autenticação precisa conter o cadastro.');
assert(loginPage.includes("window.location.pathname === '/cadastro'"), 'o cadastro deve abrir automaticamente ao acessar /cadastro.');
assert(loginPage.includes("window.location.replace('/app')"), 'login/cadastro concluídos devem entrar no app-shell.');
assert(loginPage.includes('Auth.loginWithGoogle'), 'login com Google deve permanecer disponível.');
assert(loginPage.includes('Auth.solicitarCodigoRecuperacao'), 'recuperação de senha deve permanecer disponível.');
assert(loginPage.includes("window.location.search.includes('expired=1')"), 'sessão expirada deve continuar tratada na tela de login.');
assert(authRoute.includes("document.title = 'Criar conta | FinGo'"), 'cadastro deve possuir título próprio.');
assert(authRoute.includes("window.location.assign('/login')"), 'fechamento do cadastro dedicado deve retornar ao login.');
assert(authRoute.includes("modal.setAttribute('aria-modal', 'true')"), 'modais de autenticação devem ser acessíveis.');
assert(authRoute.includes("event.key !== 'Escape'"), 'modais devem tratar tecla Escape.');
assert(authCss.includes('@media (max-width: 600px)'), 'autenticação deve possuir breakpoint mobile principal.');
assert(authCss.includes('@media (max-width: 390px)'), 'autenticação deve ser revisada em 390px.');
assert(authCss.includes('@media (max-width: 360px)'), 'autenticação deve ser revisada em 360px.');
assert(authCss.includes('#register-modal > div'), 'modal de cadastro deve virar sheet responsiva no mobile.');
assert(authCss.includes('#recovery-modal > div'), 'recuperação de senha deve virar sheet responsiva no mobile.');
assert(authCss.includes('.otp-box'), 'OTP deve possuir dimensionamento responsivo.');

assert(privacy.includes('<title>Política de Privacidade — FinGo</title>'), 'Privacidade deve possuir conteúdo e título próprios.');
assert(terms.includes('<title>Termos de Serviço — FinGo</title>'), 'Termos deve possuir conteúdo e título próprios.');
assert(validation.includes('<title>Portal de Validação de Registros de Assinatura — FinGo</title>'), 'Validação deve possuir conteúdo e título próprios.');
assert(!privacy.includes('Portal de Validação de Registros de Assinatura'), 'Privacidade não pode conter o conteúdo do portal de validação.');

assert(robots.includes('Disallow: /app'), 'robots deve bloquear o app autenticado.');
assert(robots.includes('Disallow: /login'), 'robots deve bloquear login.');
assert(robots.includes('Disallow: /cadastro'), 'robots deve bloquear cadastro.');
assert(robots.includes('Sitemap: https://fingo.api.br/sitemap.xml'), 'robots deve anunciar o sitemap canônico.');
assert(sitemap.includes('<loc>https://fingo.api.br/</loc>'), 'sitemap deve incluir a landing canônica.');
assert(sitemap.includes('<loc>https://fingo.api.br/privacidade</loc>'), 'sitemap deve incluir Privacidade.');
assert(sitemap.includes('<loc>https://fingo.api.br/termos</loc>'), 'sitemap deve incluir Termos.');
assert(!sitemap.includes('/login'), 'sitemap não deve indexar login.');
assert(!sitemap.includes('/cadastro'), 'sitemap não deve indexar cadastro.');
assert(!sitemap.includes('/app'), 'sitemap não deve indexar área autenticada.');

console.log('✅ Patch 38: roteamento público, SEO, legal, auth, mobile e invariantes de shell validados.');
