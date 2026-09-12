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
copyRequired(path.join(root, 'cloudflare', '_routes.json'), path.join(out, '_routes.json'));

const indexPath = path.join(out, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
const recoveryUxScript = '<script src="/js/recovery-account-ux.js"></script>';
if (!indexHtml.includes(recoveryUxScript)) {
  if (!indexHtml.includes('</body>')) throw new Error('index.html sem fechamento </body> para injetar UX de recuperação.');
  indexHtml = indexHtml.replace('</body>', `  ${recoveryUxScript}\n</body>`);
  fs.writeFileSync(indexPath, indexHtml, 'utf8');
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

const recoveryUx = fs.readFileSync(path.join(out, 'js', 'recovery-account-ux.js'), 'utf8');
if (!fs.readFileSync(indexPath, 'utf8').includes('/js/recovery-account-ux.js') ||
    !recoveryUx.includes('Criar minha conta') ||
    !recoveryUx.includes('hasRecoveryId')) {
  throw new Error('Build Cloudflare sem tratamento de conta inexistente na recuperação.');
}

console.log('✅ Cloudflare Pages dist preparado com frontend-only, CSP, hotfix 2.26.1 e UX de recuperação.');
