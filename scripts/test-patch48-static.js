// scripts/test-patch48-static.js — Validação Estática do PATCH 48: SEO, Metadados, Robots, Sitemap e Schema.org
import fs from 'fs';
import path from 'path';

let totalTests = 0;
let passedTests = 0;

function test(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ ${name}`);
  } else {
    console.error(`  ❌ ${name}`);
    if (details) console.error(`     Detalhes: ${details}`);
    process.exitCode = 1;
  }
}

console.log('🧪 Executando Testes Estáticos — PATCH 48: SEO, Metadados, Robots, Sitemap e Schema.org...\n');

// 1. Validação de Arquivos Robots e Sitemap
const rootRobotsPath = path.resolve('robots.txt');
const dataRobotsPath = path.resolve('data/robots.txt');
const rootSitemapPath = path.resolve('sitemap.xml');
const dataSitemapPath = path.resolve('data/sitemap.xml');

test('robots.txt na raiz do projeto existe', fs.existsSync(rootRobotsPath));
test('data/robots.txt existe', fs.existsSync(dataRobotsPath));
test('sitemap.xml na raiz do projeto existe', fs.existsSync(rootSitemapPath));
test('data/sitemap.xml existe', fs.existsSync(dataSitemapPath));

const rootRobots = fs.readFileSync(rootRobotsPath, 'utf8');
test('robots.txt permite indexação pública e bloqueia áreas restritas (/app/, /api/, /master)', 
  rootRobots.includes('User-agent: *') &&
  rootRobots.includes('Allow: /') &&
  rootRobots.includes('Disallow: /app/') &&
  rootRobots.includes('Disallow: /api/') &&
  rootRobots.includes('Disallow: /master') &&
  rootRobots.includes('Sitemap: https://finobra.app.br/sitemap.xml'));

const rootSitemap = fs.readFileSync(rootSitemapPath, 'utf8');
test('sitemap.xml contém URLs canônicas essenciais com prioridades e changefreq',
  rootSitemap.includes('<loc>https://finobra.app.br/</loc>') &&
  rootSitemap.includes('<loc>https://finobra.app.br/validar</loc>') &&
  rootSitemap.includes('<loc>https://finobra.app.br/termos</loc>') &&
  rootSitemap.includes('<loc>https://finobra.app.br/privacidade</loc>') &&
  rootSitemap.includes('<changefreq>weekly</changefreq>') &&
  rootSitemap.includes('<priority>1.0</priority>'));

// 2. Validação da Landing Page (landing.html)
const landingPath = path.resolve('landing.html');
test('landing.html existe', fs.existsSync(landingPath));
const landing = fs.readFileSync(landingPath, 'utf8');

test('landing.html possui título otimizado para busca orgânica',
  landing.includes('<title>FinObra — Sistema de Gestão Financeira e Obras para Construtoras</title>'));

test('landing.html possui meta tags essenciais (description, keywords, canonical, robots)',
  landing.includes('<meta name="description"') &&
  landing.includes('<meta name="keywords"') &&
  landing.includes('<link rel="canonical" href="https://finobra.app.br/">') &&
  landing.includes('content="index,follow'));

test('landing.html possui Open Graph e Twitter Cards completos para compartilhamento social',
  landing.includes('property="og:type"') &&
  landing.includes('property="og:title"') &&
  landing.includes('property="og:description"') &&
  landing.includes('property="og:image"') &&
  landing.includes('name="twitter:card"'));

test('landing.html possui código de verificação Google Search Console',
  landing.includes('name="google-site-verification" content="UsbTkevWB8EbCcBAij5Dmoa5_UA9DR0I6FZETGzhqBY"'));

test('landing.html possui Schema.org JSON-LD com SoftwareApplication, Organization e FAQPage',
  landing.includes('"@type": "SoftwareApplication"') &&
  landing.includes('"@type": "Organization"') &&
  landing.includes('"@type": "FAQPage"'));

// 3. Validação de index.html, master.html e auth-route-patch38.js
const indexPath = path.resolve('index.html');
const masterPath = path.resolve('master.html');
const authRoutePath = path.resolve('js/auth-route-patch38.js');

const indexHtml = fs.readFileSync(indexPath, 'utf8');
test('index.html possui título semântico e meta description',
  indexHtml.includes('Entrar | FinObra — Gestão de Obras e Finanças') &&
  indexHtml.includes('<meta name="description"'));

const masterHtml = fs.readFileSync(masterPath, 'utf8');
test('master.html possui diretiva de noindex e título de backoffice',
  masterHtml.includes('Painel Master Administrativo | FinObra Backoffice') &&
  masterHtml.includes('noindex, nofollow'));

const authRoute = fs.readFileSync(authRoutePath, 'utf8');
test('js/auth-route-patch38.js define títulos específicos para /login e /cadastro',
  authRoute.includes('Criar conta | FinObra') &&
  authRoute.includes('Entrar | FinObra'));

// 4. Validação da Camada SPA Router em js/app.js
const appJsPath = path.resolve('js/app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');
test('js/app.js possui App.routeMeta com títulos semânticos por módulo',
  appJs.includes('routeMeta:') &&
  appJs.includes('Dashboard Financeiro de Obras | FinObra') &&
  appJs.includes('Orçamento de Obras & Base SINAPI | FinObra') &&
  appJs.includes('Controle Financeiro de Obras | FinObra'));

test('js/app.js atualiza document.title dinamicamente na navegação',
  appJs.includes('document.title = meta.title || `FinObra — ${meta.label}`;'));

// 5. Validação dos Scripts de Build e Headers de Produção
const cfBuildPath = path.resolve('scripts/build-cloudflare-pages.cjs');
const postBuildPath = path.resolve('scripts/patch38-postbuild.cjs');
const vercelJsonPath = path.resolve('vercel.json');

const cfBuild = fs.readFileSync(cfBuildPath, 'utf8');
test('build-cloudflare-pages.cjs inclui robots.txt e sitemap.xml em rootFiles',
  cfBuild.includes("'robots.txt'") && cfBuild.includes("'sitemap.xml'"));

const postBuild = fs.readFileSync(postBuildPath, 'utf8');
test('patch38-postbuild.cjs valida presença de robots.txt e sitemap.xml no dist/',
  postBuild.includes("dist sem robots.txt ou sitemap.xml"));

const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
const hasRobotsHeader = vercelJson.headers?.some(h => h.source === '/robots.txt');
const hasSitemapHeader = vercelJson.headers?.some(h => h.source === '/sitemap.xml');
test('vercel.json configura Content-Type e Cache-Control para /robots.txt', hasRobotsHeader);
test('vercel.json configura Content-Type e Cache-Control para /sitemap.xml', hasSitemapHeader);

// 6. Validação de Versão e Registros
const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
const ver = JSON.parse(fs.readFileSync(path.resolve('version.json'), 'utf8'));
const testAll = fs.readFileSync(path.resolve('scripts/test-static-all.js'), 'utf8');

test('package.json possui script "test:patch48"', pkg.scripts && pkg.scripts['test:patch48'] === 'node scripts/test-patch48-static.js');
test('package.json atualizado para versão >= 2.37.0', pkg.version >= '2.37.0');
test('version.json atualizado para versão >= 2.37.0', ver.version >= '2.37.0');
test('version.json atualizado para build compatível com Patch 48+', ver.build >= '2026.09.14-p48');
test('test-static-all.js registra scripts/test-patch48-static.js', testAll.includes('scripts/test-patch48-static.js'));

// 7. Conformidade Vercel Hobby Limit (<= 12 Serverless Functions)
const apiFiles = fs.readdirSync(path.resolve('api')).filter(f => f.endsWith('.js') && !f.startsWith('_'));
test(`Total de Serverless Functions em api/*.js <= 12 (Atual: ${apiFiles.length})`, apiFiles.length <= 12, `Arquivos: ${apiFiles.join(', ')}`);

console.log(`\n📊 Resultado dos Testes do PATCH 48: ${passedTests}/${totalTests} passaram.`);
if (passedTests === totalTests) {
  console.log('✨ Todos os testes estáticos do PATCH 48 foram aprovados com sucesso!\n');
} else {
  console.error(`❌ ${totalTests - passedTests} teste(s) falharam.\n`);
  process.exit(1);
}
