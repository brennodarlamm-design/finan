const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Vercel build bypass: Vercel possui pipeline serverless próprio e não consome a pasta dist do Cloudflare Pages.
if (process.env.VERCEL === '1' || process.env.VERCEL || process.env.VERCEL_ENV) {
  console.log('✅ Ambiente Vercel detectado: pulando build de distribuição do Cloudflare Pages.');
  process.exit(0);
}

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');

const rootFiles = [
  'app.html',
  'bim.html',
  'landing.html',
  'master.html',
  'privacidade.html',
  'termos.html',
  'validar.html',
  'calculadora-bdi.html',
  'manuais.html',
  'blog.html',
  'planos.html',
  'sobre-nos.html',
  'version.json',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'llms-full.txt',
  'auth.md',
  'openapi.json',
  'favicon.ico',
  'favicon.svg',
  'favicon-32x32.png',
  'favicon-192x192.png',
  'apple-touch-icon.png',
  'site.webmanifest',
  'sw.js',
  'twa-manifest.json'
];

const directories = ['css', 'js', 'img', 'data', '.well-known'];

function resolveSourceFile(file) {
  const mktgPath = path.join(root, 'marketing', 'pages', file);
  if (fs.existsSync(mktgPath)) return mktgPath;
  return path.join(root, file);
}

function copyRequired(src, dst) {
  if (!fs.existsSync(src)) throw new Error(`Arquivo obrigatório ausente: ${path.relative(root, src)}`);
  fs.cpSync(src, dst, { recursive: true });
}

function resolveGitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

function resolveBuildContext() {
  const explicitReleaseSha = String(process.env.FINOBRA_RELEASE_SHA || '').trim() || null;
  const github = process.env.GITHUB_ACTIONS === 'true' || !!process.env.GITHUB_SHA;
  const workersBuild = process.env.WORKERS_CI === '1' || !!process.env.WORKERS_CI_COMMIT_SHA;
  const pagesBuild = !!process.env.CF_PAGES_COMMIT_SHA;
  const vercelBuild = process.env.VERCEL === '1' || !!process.env.VERCEL_GIT_COMMIT_SHA || !!process.env.VERCEL_DEPLOYMENT_ID;

  if (vercelBuild) {
    const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || null;
    return {
      source: 'vercel',
      commit: explicitReleaseSha || process.env.VERCEL_GIT_COMMIT_SHA || resolveGitCommit(),
      run_id: deploymentId,
      run_attempt: null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      build: deploymentId ? `vercel-${deploymentId.slice(0, 12)}` : null
    };
  }

  if (github) {
    return {
      source: 'github-actions',
      commit: explicitReleaseSha || process.env.GITHUB_SHA || null,
      run_id: process.env.GITHUB_RUN_ID || null,
      run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
      branch: process.env.GITHUB_REF_NAME || null,
      build: process.env.GITHUB_RUN_NUMBER ? `github-${process.env.GITHUB_RUN_NUMBER}` : null
    };
  }

  if (workersBuild) {
    const buildUuid = process.env.WORKERS_CI_BUILD_UUID || null;
    return {
      source: 'cloudflare-workers-builds',
      commit: explicitReleaseSha || process.env.WORKERS_CI_COMMIT_SHA || null,
      run_id: buildUuid,
      run_attempt: null,
      branch: process.env.WORKERS_CI_BRANCH || null,
      build: buildUuid ? `workers-${buildUuid.slice(0, 12)}` : null
    };
  }

  if (pagesBuild) {
    return {
      source: 'cloudflare-pages',
      commit: explicitReleaseSha || process.env.CF_PAGES_COMMIT_SHA || null,
      run_id: null,
      run_attempt: null,
      branch: process.env.CF_PAGES_BRANCH || null,
      build: process.env.CF_PAGES_COMMIT_SHA
        ? `pages-${process.env.CF_PAGES_COMMIT_SHA.slice(0, 12)}`
        : null
    };
  }

  return {
    source: 'local-build',
    commit: explicitReleaseSha || resolveGitCommit(),
    run_id: null,
    run_attempt: null,
    branch: null,
    build: null
  };
}

function writeDeploymentMetadata() {
  const sourcePath = path.join(root, 'version.json');
  const sourceVersion = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const context = resolveBuildContext();
  const commit = String(context.commit || resolveGitCommit() || 'unknown').trim();

  const metadata = {
    version: sourceVersion.version || 'unknown',
    build: context.build || sourceVersion.build || 'local',
    released_at: new Date().toISOString(),
    commit,
    source: context.source,
    run_id: context.run_id,
    run_attempt: context.run_attempt,
    branch: context.branch
  };

  fs.writeFileSync(path.join(out, 'version.json'), `${JSON.stringify(metadata)}\n`, 'utf8');
  return metadata;
}

// Build do bundle do Sentry Browser se esbuild estiver disponível
try {
  const sentryEntry = path.join(root, 'scripts', 'sentry-entry.js');
  const sentryOut = path.join(root, 'js', 'sentry.js');
  if (fs.existsSync(sentryEntry)) {
    const esbuild = require('esbuild');
    const commit = resolveGitCommit() || 'local';
    esbuild.buildSync({
      entryPoints: [sentryEntry],
      bundle: true,
      minify: true,
      sourcemap: true,
      format: 'iife',
      globalName: 'FinGoSentry',
      outfile: sentryOut,
      define: {
        '__SENTRY_RELEASE__': JSON.stringify(commit)
      }
    });
  }
} catch (err) {
  console.warn('[Build] Aviso ao empacotar Sentry:', err?.message);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of rootFiles) copyRequired(resolveSourceFile(file), path.join(out, file));
for (const dir of directories) copyRequired(path.join(root, dir), path.join(out, dir));

// Patch 37: a raiz pública é comercial; o login possui shell dedicado.
copyRequired(path.join(root, 'landing.html'), path.join(out, 'index.html'));
copyRequired(path.join(root, 'index.html'), path.join(out, 'login.html'));

const cfDir = path.join(root, 'cloudflare');
if (fs.existsSync(cfDir)) {
  for (const cfFile of ['_headers', '_redirects', '_routes.json']) {
    const cfSrc = path.join(cfDir, cfFile);
    if (fs.existsSync(cfSrc)) {
      copyRequired(cfSrc, path.join(out, cfFile));
    }
  }
}

const deploymentMetadata = writeDeploymentMetadata();

function assertNoServerSecretsInPublicBundle() {
  const publicExtensions = new Set(['.html', '.js', '.json', '.txt', '.xml', '.webmanifest', '.md']);
  const forbiddenPatterns = [
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['postgres-connection', /postgres(?:ql)?:\/\/[^\s"'<>]+/i],
    ['openai-secret', /\bsk-[A-Za-z0-9_-]{20,}\b/],
    ['github-token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
    ['resend-secret', /\bre_[A-Za-z0-9_-]{20,}\b/],
    ['server-secret-assignment', /(?:DATABASE_URL|DATABASE_OWNER_URL|SESSION_SIGNING_SECRET|INTERNAL_API_SECRET|PIX_WEBHOOK_SECRET|ASAAS_WEBHOOK_TOKEN|RESEND_API_KEY|MFA_ENCRYPTION_KEY|TENANT_KEY_PEPPER)\s*[:=]\s*["'][^"']{8,}["']/i]
  ];

  const walkPublic = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkPublic(full);
        continue;
      }
      if (!publicExtensions.has(path.extname(entry.name).toLowerCase()) && entry.name !== 'site.webmanifest') continue;
      const source = fs.readFileSync(full, 'utf8');
      for (const [label, regex] of forbiddenPatterns) {
        if (regex.test(source)) {
          throw new Error(`Segredo de servidor detectado no bundle público (${label}): ${path.relative(out, full)}`);
        }
      }
    }
  };

  walkPublic(out);
}

assertNoServerSecretsInPublicBundle();

const loginPagePath = path.join(out, 'js', 'login_page.js');
let loginPage = fs.readFileSync(loginPagePath, 'utf8').replace(/\r\n/g, '\n');

function validateRecoveryFlow(source) {
  const hasScopedRequest = source.includes("Auth.solicitarCodigoRecuperacao(ident, { access_key: ak })");
  const keepsOpaqueRequestId = source.includes('recoveryRequestId = res.requestId;');
  const leaksExistenceCopy = source.includes('Não encontramos uma conta cadastrada com este e-mail.') ||
    source.includes('Não encontramos uma conta cadastrada com este usuário ou e-mail.');

  if (!hasScopedRequest || !keepsOpaqueRequestId || leaksExistenceCopy) {
    throw new Error('Fluxo de recuperação multi-tenant não está no formato seguro esperado em login_page.js.');
  }
  return source;
}

loginPage = validateRecoveryFlow(loginPage);
fs.writeFileSync(loginPagePath, loginPage, 'utf8');

const builtHome = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const builtLogin = fs.readFileSync(path.join(out, 'login.html'), 'utf8');
if (!builtHome.includes('id="root"') || !builtHome.includes('/marketing/main.jsx') || !builtLogin.includes('id="login-form"')) {
  throw new Error('Patch 37: landing/login não foram materializados corretamente no dist.');
}

const forbidden = ['api', 'backend', 'bin', 'migrations', 'monitor-nfe', 'node_modules', '.git', '.vercel'];
for (const entry of forbidden) {
  if (fs.existsSync(path.join(out, entry))) throw new Error(`Conteúdo servidor/privado vazou para dist: ${entry}`);
}

const appHtml = fs.readFileSync(path.join(out, 'app.html'), 'utf8');
if (!appHtml.includes('/js/patch26-actions.js')) {
  throw new Error('Build Cloudflare sem Patch 26/CSP carregado em app.html.');
}

const bridge = fs.readFileSync(path.join(out, 'js', 'patch26-events.js'), 'utf8');
if (!bridge.includes('FINOBRA_PATCH26_LEXICAL_ROOTS_HOTFIX') ||
    !bridge.includes("typeof Clientes !== 'undefined' ? Clientes")) {
  throw new Error('Hotfix 2.26.1 dos botões não foi aplicado no bridge CSP antes do build Cloudflare.');
}

const builtLoginPage = fs.readFileSync(loginPagePath, 'utf8');
if (!builtLoginPage.includes("Auth.solicitarCodigoRecuperacao(ident, { access_key: ak })") ||
    !builtLoginPage.includes('recoveryRequestId = res.requestId;') ||
    builtLoginPage.includes('Não encontramos uma conta cadastrada com este e-mail.')) {
  throw new Error('Build Cloudflare sem recuperação multi-tenant opaca por Chave da Empresa.');
}

if ((!deploymentMetadata.commit || deploymentMetadata.commit === 'unknown') && !process.env.VERCEL) {
  throw new Error('Build Cloudflare sem identificação do commit de origem.');
}

console.log(`✅ Cloudflare dist preparado com commit ${deploymentMetadata.commit.slice(0, 12)} via ${deploymentMetadata.source}, frontend-only, sem segredos de servidor, CSP e recuperação multi-tenant validada.`);

execFileSync(process.execPath, [path.join(root, 'scripts/build-marketing.js'), out], { cwd: root, stdio: 'inherit' });

assertNoServerSecretsInPublicBundle();
