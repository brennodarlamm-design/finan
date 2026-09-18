const fs = require('fs');
const path = require('path');

// Vercel build bypass
if (process.env.VERCEL === '1' || process.env.VERCEL || process.env.VERCEL_ENV) {
  process.exit(0);
}

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function read(name) {
  return fs.readFileSync(path.join(dist, name), 'utf8');
}

function write(name, content) {
  fs.writeFileSync(path.join(dist, name), content, 'utf8');
}

function injectBeforeHeadClose(html, fragment) {
  if (html.includes(fragment)) return html;
  if (!html.includes('</head>')) throw new Error('Patch 38: documento sem </head>.');
  return html.replace('</head>', `  ${fragment}\n</head>`);
}

function ensureCanonical(html, url) {
  const canonical = `<link rel="canonical" href="${url}">`;
  if (/<link\s+rel=["']canonical["']/i.test(html)) {
    return html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonical);
  }
  return injectBeforeHeadClose(html, canonical);
}

function patchLanding() {
  let html = read('index.html');
  html = html.replace('href="/landing" aria-label="FinObra"', 'href="/" aria-label="FinObra"');
  html = ensureCanonical(html, 'https://finobra.app.br/');
  if (!html.includes('property="og:type"')) {
    html = injectBeforeHeadClose(html, '<meta property="og:type" content="website">');
  }
  if (!html.includes('property="og:title"')) {
    html = injectBeforeHeadClose(html, '<meta property="og:title" content="FinObra — Sistema de Gestão Financeira e Obras para Construtoras">');
  }
  if (!html.includes('property="og:description"')) {
    html = injectBeforeHeadClose(html, '<meta property="og:description" content="Software de gestão de obras e financeiro para construtoras. Medições com retenções, orçamentos SINAPI oficiais e cronograma. Teste grátis por 15 dias!">');
  }
  if (!html.includes('property="og:url"')) {
    html = injectBeforeHeadClose(html, '<meta property="og:url" content="https://finobra.app.br/">');
  }
  if (!html.includes('name="twitter:card"')) {
    html = injectBeforeHeadClose(html, '<meta name="twitter:card" content="summary_large_image">');
  }
  write('index.html', html);
}

function patchLogin() {
  let html = read('login.html');
  html = html.replace('<meta name="robots" content="noindex,follow">', '<meta name="robots" content="noindex,nofollow">');
  html = ensureCanonical(html, 'https://finobra.app.br/login');
  html = injectBeforeHeadClose(html, '<link rel="stylesheet" href="/css/auth-patch38.css?v=20260913">');
  html = injectBeforeHeadClose(html, '<script src="/js/auth-route-patch38.js?v=20260913" defer></script>');
  write('login.html', html);
}

function patchDocument(file, canonicalUrl) {
  let html = read(file);
  html = ensureCanonical(html, canonicalUrl);
  write(file, html);
}

patchLanding();
patchLogin();
patchDocument('privacidade.html', 'https://finobra.app.br/privacidade');
patchDocument('termos.html', 'https://finobra.app.br/termos');
patchDocument('validar.html', 'https://finobra.app.br/validar');
patchDocument('master.html', 'https://finobra.app.br/master');

const builtLogin = read('login.html');
const builtHome = read('index.html');
if (!builtLogin.includes('/css/auth-patch38.css') ||
    !builtLogin.includes('/js/auth-route-patch38.js') ||
    !builtLogin.includes('noindex,nofollow')) {
  throw new Error('Patch 38: login final sem camada mobile/rota/noindex esperada.');
}
if (!builtHome.includes('href="/" aria-label="FinObra"') || !builtHome.includes('property="og:title"')) {
  throw new Error('Patch 38: landing final sem canonicalização/metadata esperada.');
}

if (!fs.existsSync(path.join(dist, 'robots.txt')) || !fs.existsSync(path.join(dist, 'sitemap.xml'))) {
  throw new Error('Patch 48: dist sem robots.txt ou sitemap.xml.');
}

console.log('✅ Patch 38 pós-build: SEO, canonical, mobile auth, robots.txt e sitemap.xml aplicados ao dist.');
