const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');

const rootFiles = [
  'index.html',
  'app.html',
  'landing.html',
  'master.html',
  'privacidade.html',
  'termos.html',
  'validar.html',
  'version.json',
  'favicon.ico',
  'favicon.svg',
  'favicon-32x32.png',
  'favicon-192x192.png',
  'apple-touch-icon.png'
];

const directories = ['css', 'js', 'img', 'data'];

function copyRequired(src, dst) {
  if (!fs.existsSync(src)) throw new Error(`Arquivo obrigatório ausente: ${path.relative(root, src)}`);
  fs.cpSync(src, dst, { recursive: true });
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of rootFiles) copyRequired(path.join(root, file), path.join(out, file));
for (const dir of directories) copyRequired(path.join(root, dir), path.join(out, dir));

copyRequired(path.join(root, 'cloudflare', '_headers'), path.join(out, '_headers'));
copyRequired(path.join(root, 'cloudflare', '_redirects'), path.join(out, '_redirects'));

const forbidden = ['api', 'backend', 'bin', 'migrations', 'monitor-nfe', 'node_modules', '.git', '.vercel'];
for (const entry of forbidden) {
  if (fs.existsSync(path.join(out, entry))) throw new Error(`Conteúdo servidor/privado vazou para dist: ${entry}`);
}

const appHtml = fs.readFileSync(path.join(out, 'app.html'), 'utf8');
if (!appHtml.includes('/js/patch26-actions.js') || !appHtml.includes('/js/patch26-events.js')) {
  throw new Error('Build Cloudflare sem bridge Patch 26/CSP carregado em app.html.');
}

const bridge = fs.readFileSync(path.join(out, 'js', 'patch26-events.js'), 'utf8');
if (!bridge.includes('FINOBRA_PATCH26_LEXICAL_ROOTS_HOTFIX') ||
    !bridge.includes("typeof Clientes !== 'undefined' ? Clientes")) {
  throw new Error('Hotfix lexical dos botões não está materializado no bridge CSP.');
}
if (/\beval\s*\(|new\s+Function\s*\(/.test(bridge)) {
  throw new Error('Bridge Cloudflare contém eval/new Function proibido.');
}

console.log('✅ Cloudflare Workers dist preparado a partir da fonte imutável Patch 27.');
