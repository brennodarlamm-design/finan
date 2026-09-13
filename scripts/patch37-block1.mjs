import fs from 'fs';
import path from 'path';

const root = process.cwd();
const abs = (...parts) => path.join(root, ...parts);
const read = (file) => fs.readFileSync(abs(file), 'utf8');
const write = (file, content) => fs.writeFileSync(abs(file), content, 'utf8');

function replaceOnce(file, needle, replacement, label = file) {
  const src = read(file);
  if (!src.includes(needle)) throw new Error(`Patch37 bloco1: trecho ausente em ${label}`);
  write(file, src.replace(needle, replacement));
}

function replaceRegexOnce(file, regex, replacement, label = file) {
  const src = read(file);
  if (!regex.test(src)) throw new Error(`Patch37 bloco1: padrão ausente em ${label}`);
  regex.lastIndex = 0;
  write(file, src.replace(regex, replacement));
}

// 1) Higiene do repositório: dist é artefato de build e não fonte.
let gitignore = read('.gitignore');
if (!gitignore.includes('\ndist/')) {
  gitignore = `${gitignore.trimEnd()}\n\n# Artefatos gerados de frontend\ndist/\n`;
  write('.gitignore', gitignore);
}
fs.rmSync(abs('dist'), { recursive: true, force: true });
fs.rmSync(abs('monitor-nfe', 'evolution-api'), { recursive: true, force: true });

// 2) CSP: sincroniza em lote todas as ações data-fb-* usadas pelo frontend.
const eventNames = 'click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop';
const actionRegex = new RegExp(`data-fb-(?:${eventNames})=["']([^"']+)["']`, 'g');
const frontendFiles = [];
for (const name of fs.readdirSync(root)) if (name.endsWith('.html')) frontendFiles.push(abs(name));
for (const name of fs.readdirSync(abs('js'))) if (name.endsWith('.js') && name !== 'patch26-events.js') frontendFiles.push(abs('js', name));
const usedActions = new Set();
for (const file of frontendFiles) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(actionRegex)) usedActions.add(m[1]);
}
const bridgePath = 'js/patch26-events.js';
let bridge = read(bridgePath);
const allowMatch = bridge.match(/const ALLOWED = new Set\((\[[\s\S]*?\])\);/);
if (!allowMatch) throw new Error('Patch37 bloco1: allowlist CSP não encontrada.');
const currentAllowed = JSON.parse(allowMatch[1]);
const missingActions = [...usedActions].filter((a) => !currentAllowed.includes(a)).sort();
const mergedActions = [...new Set([...currentAllowed, ...usedActions])].sort();
bridge = bridge.replace(allowMatch[0], `const ALLOWED = new Set(${JSON.stringify(mergedActions)});`);
write(bridgePath, bridge);
console.log(`Patch37 CSP: ${missingActions.length} ação(ões) adicionada(s): ${missingActions.join(', ') || 'nenhuma'}`);

// 3) Teste permanente: qualquer data-fb-* fora da allowlist passa a quebrar a regressão.
let test26 = read('scripts/test-patch26-static.js');
if (!test26.includes('FINOBRA_PATCH37_ALLOWLIST_COVERAGE')) {
  test26 = test26.replace(
    "const dataAttr = /data-fb-(click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop)=\"/gi;\n",
    "const dataAttr = /data-fb-(click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop)=\"/gi;\n// FINOBRA_PATCH37_ALLOWLIST_COVERAGE\nconst actionAttr = /data-fb-(?:click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop)=[\"']([^\"']+)[\"']/gi;\n"
  );
  test26 = test26.replace("const offenders = [];\n", "const offenders = [];\nconst usedActions = new Set();\n");
  test26 = test26.replace(
    "  migrated += [...src.matchAll(dataAttr)].length;\n",
    "  migrated += [...src.matchAll(dataAttr)].length;\n  for (const match of src.matchAll(actionAttr)) usedActions.add(match[1]);\n"
  );
  test26 = test26.replace(
    "const actions = fs.existsSync(actionsPath) ? fs.readFileSync(actionsPath, 'utf8') : '';\n",
    "const actions = fs.existsSync(actionsPath) ? fs.readFileSync(actionsPath, 'utf8') : '';\nconst allowMatch = bridge.match(/const ALLOWED = new Set\\((\\[[\\s\\S]*?\\])\\);/);\nlet allowedActions = new Set();\ntry { if (allowMatch) allowedActions = new Set(JSON.parse(allowMatch[1])); } catch {}\nconst missingAllowedActions = [...usedActions].filter(a => !allowedActions.has(a)).sort();\n"
  );
  test26 = test26.replace(
    "ok('bridge usa allowlist exata de ações', bridge.includes('const ALLOWED = new Set(') && bridge.includes('ALLOWED.has(path)'));\n",
    "ok('bridge usa allowlist exata de ações', bridge.includes('const ALLOWED = new Set(') && bridge.includes('ALLOWED.has(path)'));\nok('toda ação data-fb-* usada pelo frontend está na allowlist CSP', !!allowMatch && missingAllowedActions.length === 0);\nif (missingAllowedActions.length) console.error('Ações fora da allowlist CSP:', missingAllowedActions.join(', '));\n"
  );
  write('scripts/test-patch26-static.js', test26);
}

// 4) Build público: landing vira index do dist; login ganha shell próprio.
let build = read('scripts/build-cloudflare-pages.cjs');
build = build.replace("  'index.html',\n", '');
if (!build.includes("copyRequired(path.join(root, 'index.html'), path.join(out, 'login.html'));")) {
  build = build.replace(
    "for (const dir of directories) copyRequired(path.join(root, dir), path.join(out, dir));\n\n",
    "for (const dir of directories) copyRequired(path.join(root, dir), path.join(out, dir));\n\n// Patch 37: a raiz pública é comercial; o login possui shell dedicado.\ncopyRequired(path.join(root, 'landing.html'), path.join(out, 'index.html'));\ncopyRequired(path.join(root, 'index.html'), path.join(out, 'login.html'));\n\n"
  );
}
if (!build.includes("const explicitReleaseSha = String(process.env.FINOBRA_RELEASE_SHA")) {
  build = build.replace(
    "  const github = process.env.GITHUB_ACTIONS === 'true' || !!process.env.GITHUB_SHA;\n  const workersBuild = process.env.WORKERS_CI === '1' || !!process.env.WORKERS_CI_COMMIT_SHA;\n  const pagesBuild = !!process.env.CF_PAGES_COMMIT_SHA;\n\n",
    "  const explicitReleaseSha = String(process.env.FINOBRA_RELEASE_SHA || '').trim() || null;\n  const github = process.env.GITHUB_ACTIONS === 'true' || !!process.env.GITHUB_SHA;\n  const workersBuild = process.env.WORKERS_CI === '1' || !!process.env.WORKERS_CI_COMMIT_SHA;\n  const pagesBuild = !!process.env.CF_PAGES_COMMIT_SHA;\n  const vercelBuild = process.env.VERCEL === '1' || !!process.env.VERCEL_GIT_COMMIT_SHA || !!process.env.VERCEL_DEPLOYMENT_ID;\n\n  if (vercelBuild) {\n    const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || null;\n    return {\n      source: 'vercel',\n      commit: explicitReleaseSha || process.env.VERCEL_GIT_COMMIT_SHA || resolveGitCommit(),\n      run_id: deploymentId,\n      run_attempt: null,\n      branch: process.env.VERCEL_GIT_COMMIT_REF || null,\n      build: deploymentId ? `vercel-${deploymentId.slice(0, 12)}` : null\n    };\n  }\n\n"
  );
  build = build.replace("      commit: process.env.GITHUB_SHA || null,", "      commit: explicitReleaseSha || process.env.GITHUB_SHA || null,");
  build = build.replace("      commit: process.env.WORKERS_CI_COMMIT_SHA || null,", "      commit: explicitReleaseSha || process.env.WORKERS_CI_COMMIT_SHA || null,");
  build = build.replace("      commit: process.env.CF_PAGES_COMMIT_SHA || null,", "      commit: explicitReleaseSha || process.env.CF_PAGES_COMMIT_SHA || null,");
  build = build.replace("    commit: resolveGitCommit(),", "    commit: explicitReleaseSha || resolveGitCommit(),");
}
if (!build.includes('Patch 37: landing/login não foram materializados corretamente')) {
  build = build.replace(
    "const forbidden = ['api', 'backend', 'bin', 'migrations', 'monitor-nfe', 'node_modules', '.git', '.vercel'];\n",
    "const builtHome = fs.readFileSync(path.join(out, 'index.html'), 'utf8');\nconst builtLogin = fs.readFileSync(path.join(out, 'login.html'), 'utf8');\nif (!builtHome.includes('Obras, financeiro e engenharia.') || !builtLogin.includes('id=\"login-form\"')) {\n  throw new Error('Patch 37: landing/login não foram materializados corretamente no dist.');\n}\n\nconst forbidden = ['api', 'backend', 'bin', 'migrations', 'monitor-nfe', 'node_modules', '.git', '.vercel'];\n"
  );
}
write('scripts/build-cloudflare-pages.cjs', build);

// 5) Worker: URLs públicas canônicas e shells separados.
let worker = read('cloudflare-worker.js');
if (!worker.includes('function isLoginShellPath')) {
  worker = worker.replace(
    "function isAppShellPath(pathname) {\n  return pathname === '/app' || pathname === '/app.html' || pathname.startsWith('/app/');\n}\n",
    "function isAppShellPath(pathname) {\n  return pathname === '/app' || pathname === '/app.html' || pathname.startsWith('/app/');\n}\n\nfunction isLoginShellPath(pathname) {\n  return pathname === '/login' || pathname === '/login.html' || pathname === '/cadastro';\n}\n"
  );
}
const canonicalFn = `function canonicalRedirect(request, env) {
  const method = String(request.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) return null;

  try {
    const incoming = new URL(request.url);
    const canonical = new URL(canonicalOrigin(env));
    const wwwHost = \`www.\${canonical.hostname}\`;
    if (isApiPath(incoming.pathname)) return null;

    const forceCanonicalHost = incoming.hostname === wwwHost;
    const target = new URL(incoming.pathname + incoming.search, forceCanonicalHost ? canonical : incoming.origin);
    let changed = forceCanonicalHost;

    if (['/landing', '/landing.html', '/index.html'].includes(target.pathname)) {
      target.pathname = '/';
      changed = true;
    } else if (target.pathname === '/login.html') {
      target.pathname = '/login';
      changed = true;
    }

    const cadastro = target.searchParams.get('cadastro') === '1';
    const expired = target.searchParams.get('expired') === '1';
    if ((target.pathname === '/' || target.pathname === '/login') && cadastro) {
      target.pathname = '/cadastro';
      target.searchParams.delete('cadastro');
      changed = true;
    } else if (target.pathname === '/' && expired) {
      target.pathname = '/login';
      changed = true;
    }

    if (!changed) return null;
    return new Response(null, {
      status: 308,
      headers: {
        Location: target.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (err) {
    console.warn('[FinObra Cloudflare] não foi possível aplicar redirect canônico:', err?.message || err);
    return null;
  }
}`;
worker = worker.replace(/function canonicalRedirect\(request, env\) \{[\s\S]*?\n\}\n\nfunction buildContentSecurityPolicy/, `${canonicalFn}\n\nfunction buildContentSecurityPolicy`);
const frontendFn = `async function fetchFrontendResponse(request, env) {
  const method = String(request.method || 'GET').toUpperCase();
  const incoming = new URL(request.url);
  const shellMethod = ['GET', 'HEAD'].includes(method);
  const appShell = shellMethod && isAppShellPath(incoming.pathname);
  const loginShell = shellMethod && isLoginShellPath(incoming.pathname);
  const landingShell = shellMethod && incoming.pathname === '/';

  let assetRequest = request;
  let routeName = landingShell ? 'landing-shell' : null;
  if (appShell) {
    const appUrl = new URL('/app', incoming);
    assetRequest = new Request(appUrl.toString(), { method, headers: request.headers, redirect: 'manual' });
    routeName = 'app-shell';
  } else if (loginShell) {
    const loginUrl = new URL('/login', incoming);
    assetRequest = new Request(loginUrl.toString(), { method, headers: request.headers, redirect: 'manual' });
    routeName = incoming.pathname === '/cadastro' ? 'signup-shell' : 'login-shell';
  }

  const assetResponse = await env.ASSETS.fetch(assetRequest);
  const securedResponse = secureHtmlResponse(assetResponse);
  if (!routeName) return securedResponse;

  const headers = new Headers(securedResponse.headers);
  headers.set('X-FinObra-Route', routeName);
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');

  return new Response(securedResponse.body, {
    status: securedResponse.status,
    statusText: securedResponse.statusText,
    headers
  });
}`;
worker = worker.replace(/async function fetchFrontendResponse\(request, env\) \{[\s\S]*?\n\}\n\nfunction isAuthAction/, `${frontendFn}\n\nfunction isAuthAction`);
write('cloudflare-worker.js', worker);

// 6) Wrangler conhece o cadastro e o alias de login.
let wrangler = read('wrangler.jsonc');
if (!wrangler.includes('"/cadastro"')) wrangler = wrangler.replace('      "/login",\n', '      "/login",\n      "/login.html",\n      "/cadastro",\n');
write('wrangler.jsonc', wrangler);

// 7) SEO / navegação comercial.
let landing = read('landing.html');
if (!landing.includes('rel="canonical" href="https://finobra.app.br/"')) {
  landing = landing.replace(
    '<meta name="description" content="FinObra reúne gestão de obras, financeiro, compras, documentos e engenharia em um só sistema. Teste grátis por 15 dias.">',
    '<meta name="description" content="FinObra reúne gestão de obras, financeiro, compras, documentos e engenharia em um só sistema. Teste grátis por 15 dias.">\n  <link rel="canonical" href="https://finobra.app.br/">'
  );
}
landing = landing.replaceAll('href="/login?cadastro=1"', 'href="/cadastro"');
write('landing.html', landing);

let loginHtml = read('index.html');
if (!loginHtml.includes('rel="canonical" href="https://finobra.app.br/login"')) {
  loginHtml = loginHtml.replace(
    '<title>FinObra — Sistema de Gestão de Obras</title>',
    '<title>Entrar | FinObra</title>\n  <meta name="robots" content="noindex,follow">\n  <link rel="canonical" href="https://finobra.app.br/login">'
  );
}
write('index.html', loginHtml);

// 8) Cadastro passa a ter rota própria; sessão expirada vai sempre para /login.
let loginPage = read('js/login_page.js');
if (!loginPage.includes('FINOBRA_PATCH37_SIGNUP_ROUTE')) {
  const authBlock = "  } else if (Auth.isLoggedIn()) {\n    window.location.replace('/app');\n  }\n";
  if (!loginPage.includes(authBlock)) throw new Error('Patch37 bloco1: bloco inicial de login não encontrado.');
  loginPage = loginPage.replace(
    authBlock,
    `${authBlock}\n  // FINOBRA_PATCH37_SIGNUP_ROUTE\n  const finobraLoginParams = new URLSearchParams(window.location.search);\n  const finobraSignupRoute = window.location.pathname === '/cadastro' || finobraLoginParams.get('cadastro') === '1';\n  if (finobraSignupRoute) {\n    window.addEventListener('DOMContentLoaded', () => openRegisterModal());\n  }\n`
  );
}
write('js/login_page.js', loginPage);

let auth = read('js/auth.js');
auth = auth.replace(
  "      const isLogin = p === '/' || p === '/login' || p.endsWith('index.html');",
  "      const isLogin = p === '/login' || p === '/login.html' || p === '/cadastro' || p.endsWith('index.html');"
);
write('js/auth.js', auth);

// 9) Version guard passa a usar release real e também observa release da API.
write('js/version_guard.js', `// FinObra Patch 37 — release guard por commit real de Edge/API.\n(() => {\n  const edgeKey = 'finobra_edge_release_commit';\n  const reloadKey = 'finobra_release_reload_once';\n\n  const loadEdge = async () => {\n    const res = await fetch(\`/version.json?t=\${Date.now()}\`, { cache:'no-store', credentials:'same-origin' });\n    if (!res.ok) return null;\n    const data = await res.json().catch(() => null);\n    if (!data || !data.commit || data.commit === 'unknown') return null;\n    return data;\n  };\n\n  const loadApi = async () => {\n    const res = await fetch(\`/api/health?t=\${Date.now()}\`, { cache:'no-store', credentials:'same-origin' });\n    if (!res.ok) return null;\n    return res.json().catch(() => null);\n  };\n\n  const check = async () => {\n    try {\n      const edge = await loadEdge();\n      if (!edge) return;\n      window.FINOBRA_RELEASE = edge;\n\n      const previous = sessionStorage.getItem(edgeKey);\n      sessionStorage.setItem(edgeKey, edge.commit);\n      if (previous && previous !== edge.commit && sessionStorage.getItem(reloadKey) !== edge.commit) {\n        sessionStorage.setItem(reloadKey, edge.commit);\n        location.reload();\n        return;\n      }\n\n      const api = await loadApi();\n      if (api) window.FINOBRA_API_RELEASE = api.release || null;\n      const apiCommit = api?.release?.commit || null;\n      const aligned = !!apiCommit && apiCommit !== 'unknown' && apiCommit === edge.commit;\n      window.FINOBRA_RELEASE_ALIGNED = aligned;\n      document.dispatchEvent(new CustomEvent('finobra:release-status', { detail:{ edge, api, aligned } }));\n      if (apiCommit && apiCommit !== 'unknown' && !aligned) {\n        console.warn('[FinObra Release] Frontend e API estão em versões diferentes.', { edge:edge.commit, api:apiCommit });\n      }\n    } catch {}\n  };\n\n  setTimeout(check, 1200);\n  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });\n})();\n`);

// 10) Health público da API para o gate atômico de releases.
write('api/health.js', `export default function handler(req, res) {\n  if (req.method !== 'GET' && req.method !== 'HEAD') {\n    res.setHeader('Allow', 'GET, HEAD');\n    return res.status(405).json({ ok:false, error:'Método não permitido.' });\n  }\n\n  const commit = String(\n    process.env.FINOBRA_RELEASE_SHA ||\n    process.env.VERCEL_GIT_COMMIT_SHA ||\n    process.env.GITHUB_SHA ||\n    'unknown'\n  ).trim();\n  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || null;\n  const releaseReady = !!commit && commit !== 'unknown';\n\n  res.setHeader('Cache-Control', 'no-store');\n  res.setHeader('X-Content-Type-Options', 'nosniff');\n  if (req.method === 'HEAD') return res.status(200).end();\n  return res.status(200).json({\n    ok:true,\n    service:'finobra-api',\n    releaseReady,\n    release:{\n      commit,\n      deploymentId,\n      source: process.env.VERCEL === '1' ? 'vercel' : 'serverless',\n      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'\n    }\n  });\n}\n`);

// 11) Vercel também não referencia CDN removida e reconhece /cadastro em previews.
let vercel = read('vercel.json');
vercel = vercel.replaceAll(' https://cdn.jsdelivr.net', '');
if (!vercel.includes('"source": "/cadastro"')) {
  vercel = vercel.replace(
    '    {\n      "source": "/login",\n      "destination": "/"\n    },',
    '    {\n      "source": "/login",\n      "destination": "/"\n    },\n    {\n      "source": "/cadastro",\n      "destination": "/"\n    },'
  );
}
write('vercel.json', vercel);

// 12) Teste permanente do Patch 37, bloco 1.
write('scripts/test-patch37-static.js', `import fs from 'fs';\nfunction assert(cond,msg){ if(!cond){ console.error('❌ '+msg); process.exit(1); } console.log('✅ '+msg); }\nconst worker=fs.readFileSync('cloudflare-worker.js','utf8');\nconst build=fs.readFileSync('scripts/build-cloudflare-pages.cjs','utf8');\nconst landing=fs.readFileSync('landing.html','utf8');\nconst login=fs.readFileSync('index.html','utf8');\nconst loginJs=fs.readFileSync('js/login_page.js','utf8');\nconst auth=fs.readFileSync('js/auth.js','utf8');\nconst guard=fs.readFileSync('js/version_guard.js','utf8');\nconst health=fs.readFileSync('api/health.js','utf8');\nconst bridge=fs.readFileSync('js/patch26-events.js','utf8');\nconst gitignore=fs.readFileSync('.gitignore','utf8');\nconst wrangler=fs.readFileSync('wrangler.jsonc','utf8');\nconst vercel=fs.readFileSync('vercel.json','utf8');\nassert(build.includes("landing.html'), path.join(out, 'index.html") && build.includes("index.html'), path.join(out, 'login.html"),'Build separa landing na raiz e login em /login.');\nassert(worker.includes("'landing-shell'") && worker.includes("'login-shell'") && worker.includes("'signup-shell'"),'Worker distingue landing, login e cadastro.');\nassert(worker.includes("['/landing', '/landing.html', '/index.html']") && worker.includes("target.pathname = '/cadastro'"),'Worker canonicaliza URLs públicas antigas.');\nassert(wrangler.includes('"/cadastro"') && wrangler.includes('"/login.html"'),'Wrangler executa worker nas novas rotas públicas.');\nassert(landing.includes('rel="canonical" href="https://finobra.app.br/"') && landing.includes('href="/cadastro"') && !landing.includes('/login?cadastro=1'),'Landing usa raiz canônica e rota limpa de cadastro.');\nassert(login.includes('noindex,follow') && login.includes('https://finobra.app.br/login'),'Login tem canonical próprio e não concorre com SEO da landing.');\nassert(loginJs.includes('FINOBRA_PATCH37_SIGNUP_ROUTE') && loginJs.includes("window.location.pathname === '/cadastro'"),'Cadastro abre automaticamente o formulário de criação de conta.');\nassert(auth.includes("p === '/cadastro'") && auth.includes("window.location.replace('/login?expired=1')"),'Sessão expirada usa /login e cadastro é reconhecido como shell de autenticação.');\nassert(guard.includes('/api/health') && guard.includes('FINOBRA_RELEASE_ALIGNED') && !guard.includes("CURRENT = '2026"),'Version guard compara releases reais de Edge/API.');\nassert(health.includes("service:'finobra-api'") && health.includes('FINOBRA_RELEASE_SHA') && health.includes('VERCEL_GIT_COMMIT_SHA'),'API possui health público com commit de release.');\nassert(build.includes("source: 'vercel'") && build.includes('FINOBRA_RELEASE_SHA'),'Build reconhece contexto Vercel e SHA explícito.');\nassert(!vercel.includes('cdn.jsdelivr.net'),'Vercel CSP também não depende mais de jsDelivr.');\nassert(gitignore.includes('dist/'),'dist é artefato ignorado, não fonte versionada.');\nconst actionRegex=/data-fb-(?:click|change|input|submit|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|focus|blur|dblclick|contextmenu|pointerdown|pointerup|mousedown|mouseup|touchstart|touchend|dragstart|drop)=["']([^"']+)["']/g;\nconst used=new Set();\nfor(const f of [...fs.readdirSync('.').filter(x=>x.endsWith('.html')), ...fs.readdirSync('js').filter(x=>x.endsWith('.js')).map(x=>'js/'+x)]){ if(f==='js/patch26-events.js')continue; const src=fs.readFileSync(f,'utf8'); for(const m of src.matchAll(actionRegex)) used.add(m[1]); }\nconst m=bridge.match(/const ALLOWED = new Set\\((\\[[\\s\\S]*?\\])\\);/);\nconst allowed=m?new Set(JSON.parse(m[1])):new Set();\nconst missing=[...used].filter(x=>!allowed.has(x));\nassert(missing.length===0,'Nenhuma ação data-fb-* fica fora da allowlist CSP: '+missing.join(', '));\nconsole.log('\\n✅ Patch 37 bloco 1 validado.');\n`);

let allTests = read('scripts/test-static-all.js');
if (!allTests.includes("'scripts/test-patch37-static.js'")) {
  allTests = allTests.replace("  'scripts/test-patch36-static.js',\n", "  'scripts/test-patch36-static.js',\n  'scripts/test-patch37-static.js',\n");
  write('scripts/test-static-all.js', allTests);
}

console.log('✅ Patch 37 bloco 1 aplicado: routing comercial, CSP global, release metadata e limpeza de artefatos.');
