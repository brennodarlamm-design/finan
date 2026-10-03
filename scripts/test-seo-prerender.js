// scripts/test-seo-prerender.js
// Pré-renderização das páginas de marketing (SEO/AEO/GEO): conteúdo no HTML para robôs
// que não executam JavaScript e uma página por artigo do blog com metadados próprios.
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

console.log('=== Pré-renderização SEO/GEO das páginas de marketing ===\n');

const { prerenderMarketing, createRenderer, dataIso } = await import('../scripts/prerender-marketing.mjs');
const { ARTIGOS_BLOG } = await import('../marketing/blog-data.js');

// Simula o destino do build com as páginas-fonte (mesmo <div id="root"></div> do build do Vite).
const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'fingo-prerender-'));
for (const f of ['landing.html', 'planos.html', 'sobre-nos.html', 'manuais.html', 'blog.html']) {
  fs.copyFileSync(path.join(root, f), path.join(dest, f));
}
fs.copyFileSync(path.join(root, 'landing.html'), path.join(dest, 'index.html'));

const render = await createRenderer({ root });
const files = await prerenderMarketing(dest, { root, render });

// 1. Páginas principais com conteúdo real no HTML.
{
  const expect = {
    'index.html': ['15 dias'],
    'planos.html': ['R$ 119,90', 'R$ 279,90', 'R$ 499,90'],
    'sobre-nos.html': ['FinGo'],
    'manuais.html': ['SINAPI'],
    'blog.html': ARTIGOS_BLOG.map(a => a.titulo)
  };
  for (const [file, needles] of Object.entries(expect)) {
    const html = fs.readFileSync(path.join(dest, file), 'utf8');
    assert(!html.includes('<div id="root"></div>'), `${file}: #root não pode ficar vazio`);
    const t = text(html);
    assert(t.split(' ').length > 250, `${file}: conteúdo insuficiente no HTML`);
    for (const n of needles) assert(t.replace(/ /g, ' ').includes(n), `${file}: deveria conter "${n}"`);
    assert(/<h1[\s>]/.test(html), `${file}: deve ter <h1>`);
  }
  const blog = fs.readFileSync(path.join(dest, 'blog.html'), 'utf8');
  for (const a of ARTIGOS_BLOG) assert(blog.includes(`href="/blog/${a.slug}"`), `blog.html: link rastreável para ${a.slug}`);
  console.log('  ✓ Home, Planos, Sobre, Manuais e Blog com conteúdo, <h1> e links rastreáveis no HTML');
}

// 2. Uma página por artigo, com metadados e JSON-LD próprios.
{
  for (const a of ARTIGOS_BLOG) {
    const file = path.join('blog', `${a.slug}.html`);
    assert(files.includes(file), `artigo gerado: ${file}`);
    const html = fs.readFileSync(path.join(dest, file), 'utf8');
    const url = `https://fingo.api.br/blog/${a.slug}`;
    assert(html.includes(`<link rel="canonical" href="${url}">`), `${a.slug}: canonical próprio`);
    assert(html.includes(`<title>${a.titulo.replace(/&/g, '&amp;')} | Blog FinGo</title>`), `${a.slug}: título próprio`);
    assert(html.includes(`property="og:url" content="${url}"`), `${a.slug}: og:url próprio`);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const post = ld['@graph'].find(x => x['@type'] === 'BlogPosting');
    assert(post && post.headline === a.titulo, `${a.slug}: BlogPosting com headline`);
    assert.strictEqual(post.datePublished, dataIso(a.data), `${a.slug}: data ISO`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(post.datePublished), `${a.slug}: data em formato ISO`);
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '';
    assert(text(h1).trim().includes(a.titulo.split(':')[0]), `${a.slug}: <h1> do artigo`);
    for (const p of a.conteudo.slice(0, 2)) assert(text(html).includes(p.slice(0, 40)), `${a.slug}: corpo do artigo no HTML`);
  }
  console.log(`  ✓ ${ARTIGOS_BLOG.length} artigos com URL própria, canonical, título, BlogPosting (data ISO) e corpo no HTML`);
}

// 3. Worker, sitemap e llms.txt apontam para as URLs dos artigos.
{
  const worker = read('cloudflare-worker.js');
  assert(worker.includes("/^\\/blog\\/[a-z0-9-]{3,120}$/.test(incoming.pathname)"), 'Worker serve /blog/<slug>');
  const sitemap = read('sitemap.xml');
  assert.strictEqual(sitemap, read('data/sitemap.xml'), 'sitemaps sincronizados');
  for (const a of ARTIGOS_BLOG) {
    assert(sitemap.includes(`<loc>https://fingo.api.br/blog/${a.slug}</loc>`), `sitemap: ${a.slug}`);
    assert(read('llms.txt').includes(`https://fingo.api.br/blog/${a.slug}`), `llms.txt: ${a.slug}`);
  }
  assert(read('scripts/build-marketing.js').includes('prerenderMarketing'), 'build chama a pré-renderização');
  assert.strictEqual(read('marketing/main.jsx'), read('marketing/src/main.jsx'), 'main.jsx espelhado');
  console.log('  ✓ Worker, sitemap, llms.txt e build integrados');
}

fs.rmSync(dest, { recursive: true, force: true });
console.log('\n✅ Pré-renderização SEO/GEO: tudo certo.');
