// scripts/prerender-marketing.mjs — Pré-renderização das páginas de marketing (SEO/AEO/GEO)
//
// Robôs de IA (GPTBot, ClaudeBot, PerplexityBot) e parte do Bing não executam JavaScript;
// sem isto, Home, Planos, Sobre, Blog e Manuais chegavam com <div id="root"></div> vazio.
// Este script, chamado por scripts/build-marketing.js depois do build do Vite:
//   1. compila marketing/main.jsx para SSR;
//   2. renderiza cada rota com react-dom/server e injeta o HTML no #root das páginas;
//   3. gera uma página por artigo do blog (blog/<slug>.html) com título, descrição,
//      canonical, Open Graph e JSON-LD BlogPosting próprios.
// No navegador o React substitui o HTML pré-renderizado pelo mesmo conteúdo.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SITE = 'https://fingo.api.br';
const MESES = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12
};

export const PAGE_ROUTES = [
  { route: '/', files: ['index.html', 'landing.html'] },
  { route: '/planos', files: ['planos.html'] },
  { route: '/sobre-nos', files: ['sobre-nos.html'] },
  { route: '/manuais', files: ['manuais.html'] },
  { route: '/blog', files: ['blog.html'] }
];

/** "21 Setembro 2026" -> "2026-09-21" */
export function dataIso(texto) {
  const m = String(texto || '').trim().toLowerCase().match(/^(\d{1,2})\s+([a-zçã]+)\s+(\d{4})$/);
  if (!m || !MESES[m[2]]) return null;
  return `${m[3]}-${String(MESES[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const jsonLd = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

export function injectRoot(html, rendered) {
  if (!html.includes('<div id="root"></div>')) throw new Error('Página sem <div id="root"></div> para pré-renderizar.');
  // Função na substituição: "$" no conteúdo (ex.: "R$ 119,90") não vira padrão de String.replace.
  return html.replace('<div id="root"></div>', () => `<div id="root">${rendered}</div>`);
}

/** Monta o HTML de um artigo a partir do template original do /blog (#root ainda vazio). */
export function buildArticleHtml(blogTemplate, artigo, renderedArticle) {
  const url = `${SITE}/blog/${artigo.slug}`;
  const title = `${artigo.titulo} | Blog FinGo`;
  const desc = String(artigo.resumo || '').slice(0, 300);
  const iso = dataIso(artigo.data);
  let html = blogTemplate;

  const setMeta = (re, value) => {
    if (!re.test(html)) throw new Error(`Template do blog sem ${re}`);
    html = html.replace(re, (tag) => tag.replace(/content="[^"]*"/, `content="${esc(value)}"`));
  };
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`);
  setMeta(/<meta name="description" content="[^"]*">/, desc);
  setMeta(/<meta property="og:title" content="[^"]*">/, title);
  setMeta(/<meta property="og:description" content="[^"]*">/, desc);
  setMeta(/<meta property="og:url" content="[^"]*">/, url);
  if (/<meta property="og:type" content="[^"]*">/.test(html)) setMeta(/<meta property="og:type" content="[^"]*">/, 'article');
  if (/<meta name="twitter:title" content="[^"]*">/.test(html)) setMeta(/<meta name="twitter:title" content="[^"]*">/, title);
  if (/<meta name="twitter:description" content="[^"]*">/.test(html)) setMeta(/<meta name="twitter:description" content="[^"]*">/, desc);
  html = html.replace(/<link rel="canonical" href="[^"]*">/, () => `<link rel="canonical" href="${url}">`);

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        headline: artigo.titulo,
        description: desc,
        url,
        mainEntityOfPage: url,
        inLanguage: 'pt-BR',
        articleSection: artigo.categoria,
        ...(iso ? { datePublished: iso, dateModified: iso } : {}),
        image: `${SITE}/img/og-finobra-cover.jpg`,
        author: { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'FinGo' },
        publisher: { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'FinGo', logo: { '@type': 'ImageObject', url: `${SITE}/img/finobra_logo.jpg` } },
        isPartOf: { '@type': 'Blog', '@id': `${SITE}/blog#blog`, name: 'Blog FinGo' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
          { '@type': 'ListItem', position: 3, name: artigo.titulo, item: url }
        ]
      }
    ]
  };
  // Troca o JSON-LD da listagem (Blog) pelo do artigo.
  const ldBlock = `<script type="application/ld+json">\n${jsonLd(ld)}\n</script>`;
  if (/<script type="application\/ld\+json">[\s\S]*?<\/script>/.test(html)) {
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => ldBlock);
  } else {
    html = html.replace('</head>', () => `${ldBlock}\n</head>`);
  }
  return injectRoot(html, renderedArticle);
}

/** Compila main.jsx para SSR e devolve uma função route -> HTML. */
export async function createRenderer({ root = process.cwd(), ssrOutDir } = {}) {
  const { build } = await import('vite');
  const outDir = ssrOutDir || path.join(root, '.marketing-ssr');
  await build({
    root,
    configFile: path.join(root, 'vite.config.js'),
    logLevel: 'warn',
    build: {
      ssr: path.join(root, 'marketing', 'main.jsx'),
      outDir,
      emptyOutDir: true,
      copyPublicDir: false,
      rollupOptions: { input: path.join(root, 'marketing', 'main.jsx'), output: { format: 'esm', entryFileNames: 'main.mjs' } }
    }
  });
  const entry = pathToFileURL(path.join(outDir, 'main.mjs')).href;
  const React = await import('react');
  const { renderToString } = await import('react-dom/server');
  return async (route) => {
    globalThis.__FINGO_SSR_ROUTE__ = route;
    try {
      // Query distinta = nova instância do módulo (a rota é lida no carregamento do módulo).
      const mod = await import(`${entry}?route=${encodeURIComponent(route)}`);
      return renderToString(React.createElement(mod.App));
    } finally {
      delete globalThis.__FINGO_SSR_ROUTE__;
    }
  };
}

export async function prerenderMarketing(destination, { root = process.cwd(), render } = {}) {
  const renderRoute = render || await createRenderer({ root });
  const { ARTIGOS_BLOG } = await import(pathToFileURL(path.join(root, 'marketing', 'blog-data.js')).href);
  const done = [];
  const blogTemplatePath = path.join(destination, 'blog.html');
  // Template dos artigos: o blog.html antes da injeção da listagem.
  const blogTemplate = fs.existsSync(blogTemplatePath) ? fs.readFileSync(blogTemplatePath, 'utf8') : null;

  for (const page of PAGE_ROUTES) {
    const rendered = await renderRoute(page.route);
    for (const file of page.files) {
      const target = path.join(destination, file);
      if (!fs.existsSync(target)) continue;
      fs.writeFileSync(target, injectRoot(fs.readFileSync(target, 'utf8'), rendered), 'utf8');
      done.push(file);
    }
  }

  if (blogTemplate) {
    fs.mkdirSync(path.join(destination, 'blog'), { recursive: true });
    for (const artigo of ARTIGOS_BLOG) {
      const rendered = await renderRoute(`/blog/${artigo.slug}`);
      const file = path.join('blog', `${artigo.slug}.html`);
      fs.writeFileSync(path.join(destination, file), buildArticleHtml(blogTemplate, artigo, rendered), 'utf8');
      done.push(file);
    }
  }
  return done;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const destination = process.argv[2] || 'dist';
  const files = await prerenderMarketing(path.resolve(destination));
  console.log(`✅ Pré-renderização SEO/GEO: ${files.length} páginas (${files.join(', ')})`);
}
