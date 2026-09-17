// scripts/test-seo-indexing.js
// Suíte de Testes Automatizados — SEO Técnico, Indexabilidade Google/Bing & Metatags Canônicas

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

console.log('=== Suíte de Testes de SEO Técnico e Indexabilidade ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Validação Estrutural do sitemap.xml
// ─────────────────────────────────────────────────────────────────────────────
console.log('1. Validando integridade e regras anti-redirecionamento do sitemap.xml...');

const sitemap = read('sitemap.xml');

// Regra anti-308: nunca incluir /landing no sitemap
assert(!sitemap.includes('/landing<'), 'sitemap.xml NÃO deve conter a rota /landing (gera redirecionamento 308)');
assert(!sitemap.includes('/landing.html'), 'sitemap.xml NÃO deve conter /landing.html');
assert(!sitemap.includes('/index.html'), 'sitemap.xml NÃO deve conter /index.html');

// URLs canônicas obrigatórias
assert(sitemap.includes('<loc>https://finobra.app.br/</loc>'), 'sitemap.xml deve conter https://finobra.app.br/ como home');
assert(sitemap.includes('<priority>1.0</priority>'), 'Home do sitemap.xml deve ter prioridade 1.0');
assert(sitemap.includes('<loc>https://finobra.app.br/validar</loc>'), 'sitemap.xml deve conter rota /validar');
assert(sitemap.includes('<loc>https://finobra.app.br/privacidade</loc>'), 'sitemap.xml deve conter rota /privacidade');
assert(sitemap.includes('<loc>https://finobra.app.br/termos</loc>'), 'sitemap.xml deve conter rota /termos');
assert(sitemap.includes('<loc>https://finobra.app.br/llms.txt</loc>'), 'sitemap.xml deve conter /llms.txt para motores de IA');
assert(sitemap.includes('<loc>https://finobra.app.br/llms-full.txt</loc>'), 'sitemap.xml deve conter /llms-full.txt para motores de IA');

// Contagem exata de URLs no sitemap
const urlMatches = sitemap.match(/<loc>/g) || [];
assert.strictEqual(urlMatches.length, 6, `sitemap.xml deve conter exatamente 6 URLs públicas canônicas. Encontradas: ${urlMatches.length}`);

// Verificação de URLs duplicadas
const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
const uniqueLocs = new Set(locs);
assert.strictEqual(locs.length, uniqueLocs.size, 'sitemap.xml não deve conter URLs duplicadas');

console.log(`   ✓ sitemap.xml validado com sucesso (${locs.length} URLs canônicas únicas, zero redirects 308).`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Validação do robots.txt
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. Validando conformidade e bloqueios de segurança no robots.txt...');

const robots = read('robots.txt');

assert(robots.includes('User-agent: *'), 'robots.txt deve definir User-agent: *');
assert(robots.includes('Allow: /\n') || robots.includes('Allow: /\r\n'), 'robots.txt deve permitir acesso à raiz Allow: /');
assert(!robots.includes('Allow: /landing'), 'robots.txt NÃO deve conter Allow: /landing');
assert(robots.includes('Disallow: /app'), 'robots.txt deve bloquear /app');
assert(robots.includes('Disallow: /login'), 'robots.txt deve bloquear /login');
assert(robots.includes('Disallow: /cadastro'), 'robots.txt deve bloquear /cadastro');
assert(robots.includes('Disallow: /master'), 'robots.txt deve bloquear /master');
assert(robots.includes('Disallow: /api/'), 'robots.txt deve bloquear /api/');
assert(robots.includes('Sitemap: https://finobra.app.br/sitemap.xml'), 'robots.txt deve apontar para o sitemap.xml canônico');

console.log('   ✓ robots.txt validado: crawl budget protegido, áreas privadas bloqueadas.');

// ─────────────────────────────────────────────────────────────────────────────
// 3. Metatags On-Page, OpenGraph 1200x630 e Schema.org em landing.html
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. Validando SEO on-page, OpenGraph e Schema.org em landing.html...');

const landing = read('landing.html');

// Meta description de tamanho ideal para Google (120 - 165 caracteres)
const descMatch = landing.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
assert(descMatch, 'landing.html deve conter meta description');
const descLen = descMatch[1].length;
assert(descLen >= 120 && descLen <= 165, `Meta description deve ter entre 120 e 165 chars (evita truncamento no Google). Atual: ${descLen}`);
console.log(`   ✓ Meta Description otimizada (${descLen} caracteres): "${descMatch[1]}"`);

// Canonical link
assert(landing.includes('<link rel="canonical" href="https://finobra.app.br/">'), 'landing.html deve ter canonical link para https://finobra.app.br/');

// OpenGraph e Twitter Cards 1200x630
assert(landing.includes('property="og:image" content="https://finobra.app.br/img/og-finobra-cover.jpg"'), 'og:image deve apontar para banner 1200x630');
assert(landing.includes('property="og:image:width" content="1200"'), 'og:image:width deve ser 1200');
assert(landing.includes('property="og:image:height" content="630"'), 'og:image:height deve ser 630');
assert(landing.includes('name="twitter:card" content="summary_large_image"'), 'twitter:card deve ser summary_large_image');
assert(landing.includes('name="twitter:image" content="https://finobra.app.br/img/og-finobra-cover.jpg"'), 'twitter:image deve apontar para banner 1200x630');

// Schema.org JSON-LD Graph
const jsonLdMatch = landing.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
assert(jsonLdMatch, 'landing.html deve conter bloco de dados estruturados JSON-LD');
const schema = JSON.parse(jsonLdMatch[1]);
assert(schema['@graph'], 'Schema.org deve estar no padrão @graph');

const types = schema['@graph'].map(node => node['@type']);
assert(types.includes('WebSite'), 'Schema deve conter a entidade WebSite (exigência do Google para Brand Entity)');
assert(types.includes('Organization'), 'Schema deve conter a entidade Organization');
assert(types.includes('SoftwareApplication'), 'Schema deve conter a entidade SoftwareApplication');
assert(types.includes('FAQPage'), 'Schema deve conter a entidade FAQPage');

const webSiteNode = schema['@graph'].find(n => n['@type'] === 'WebSite');
assert.strictEqual(webSiteNode.name, 'FinObra');
assert(webSiteNode.alternateName && webSiteNode.alternateName.length > 0);

const softNode = schema['@graph'].find(n => n['@type'] === 'SoftwareApplication');
assert(softNode.image, 'SoftwareApplication deve conter imagem de capa para Rich Snippets');
assert(softNode.aggregateRating, 'SoftwareApplication deve conter aggregateRating para estrelas na busca');
assert.strictEqual(softNode.aggregateRating.ratingValue, '4.9');

console.log('   ✓ Schema.org @graph (WebSite, Organization, SoftwareApplication, FAQPage) validado com sucesso.');

// ─────────────────────────────────────────────────────────────────────────────
// 4. Metatags e Canonicais nas Páginas Satélite
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n4. Validando páginas públicas secundárias (privacidade, termos, validar)...');

const pages = [
  { file: 'privacidade.html', canonical: 'https://finobra.app.br/privacidade' },
  { file: 'termos.html', canonical: 'https://finobra.app.br/termos' },
  { file: 'validar.html', canonical: 'https://finobra.app.br/validar' }
];

for (const p of pages) {
  const content = read(p.file);
  assert(content.includes(`<link rel="canonical" href="${p.canonical}">`), `${p.file} deve conter canonical link para ${p.canonical}`);
  assert(content.includes('<meta name="robots" content="index,follow">'), `${p.file} deve permitir indexação com robots index,follow`);
  assert(/<meta\s+name=["']description["']/i.test(content), `${p.file} deve possuir meta description`);
  assert(content.includes('property="og:image"'), `${p.file} deve possuir og:image configurado`);
  console.log(`   ✓ ${p.file}: Canonical, description, robots index e OpenGraph verificados.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Blindagem de Páginas Privadas (noindex, nofollow)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n5. Validando blindagem de páginas restritas (noindex, nofollow)...');

const appHtml = read('app.html');
assert(appHtml.includes('<meta name="robots" content="noindex, nofollow">'), 'app.html deve ter noindex, nofollow para não vazar no Google');

const masterHtml = read('master.html');
assert(masterHtml.includes('<meta name="robots" content="noindex, nofollow">'), 'master.html deve ter noindex, nofollow');

console.log('   ✓ app.html e master.html blindados contra indexação indevida.');

// ─────────────────────────────────────────────────────────────────────────────
// 6. Integridade do Banner Social (img/og-finobra-cover.jpg)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n6. Validando existência e integridade física do banner OpenGraph...');

assert(fs.existsSync(path.join(root, 'img/og-finobra-cover.jpg')), 'img/og-finobra-cover.jpg deve existir');
const bannerStat = fs.statSync(path.join(root, 'img/og-finobra-cover.jpg'));
assert(bannerStat.size > 50000, `Banner og-finobra-cover.jpg deve ter alta resolução (> 50KB). Tamanho atual: ${bannerStat.size} bytes`);

assert(fs.existsSync(path.join(root, 'dist/img/og-finobra-cover.jpg')), 'dist/img/og-finobra-cover.jpg deve existir na pasta de distribuição');

console.log(`   ✓ Banner OpenGraph verificado (${Math.round(bannerStat.size / 1024)} KB) em img/ e dist/img/.`);

console.log('\n======================================================');
console.log('🎉 TODOS OS TESTES DE SEO E INDEXABILIDADE PASSARAM COM SUCESSO!');
console.log('======================================================\n');
