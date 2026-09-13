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
const login = read('index.html');
const loginPage = read('js/login_page.js');

assert(worker.includes("new URL('/app.html', incoming)"), 'o app-shell deve resolver o arquivo app.html explicitamente.');
assert(worker.includes("new URL('/login.html', incoming)"), 'login/cadastro devem resolver o arquivo login.html explicitamente.');
assert(worker.includes("routeName = incoming.pathname === '/cadastro' ? 'signup-shell' : 'login-shell'"), 'login e cadastro precisam de identificadores de rota distintos.');
assert(worker.includes("headers.set('X-Robots-Tag', 'noindex, nofollow')"), 'rotas privadas devem enviar X-Robots-Tag noindex.');
assert(worker.includes("target.pathname === '/app.html'"), 'app.html deve possuir redirect canônico para /app.');

assert(build.includes("copyRequired(path.join(root, 'landing.html'), path.join(out, 'index.html'))"), 'a raiz pública deve ser materializada a partir da landing.');
assert(build.includes("copyRequired(path.join(root, 'index.html'), path.join(out, 'login.html'))"), 'o login deve ter arquivo dedicado no dist.');

assert(landing.includes('href="/login"'), 'a landing deve apontar Entrar/Área do Cliente para /login.');
assert(landing.includes('href="/cadastro"'), 'a landing deve apontar teste grátis para /cadastro.');
assert(login.includes('id="login-form"'), 'o shell de autenticação precisa conter o formulário de login.');
assert(login.includes('id="register-modal"'), 'o shell de autenticação precisa conter o cadastro.');
assert(loginPage.includes("window.location.pathname === '/cadastro'"), 'o cadastro deve abrir automaticamente ao acessar /cadastro.');
assert(loginPage.includes("window.location.replace('/app')"), 'login/cadastro concluídos devem entrar no app-shell.');

console.log('✅ Patch 38: roteamento público, login/cadastro e invariantes de shell validados.');
