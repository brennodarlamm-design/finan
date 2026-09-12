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

// Corrige o fluxo de recuperação diretamente no JS entregue pelo Cloudflare.
// A API antiga responde success:true genericamente para conta inexistente, mas sem userId/requestId.
// Nessa situação, não avançamos para OTP e oferecemos o cadastro da conta.
const loginPagePath = path.join(out, 'js', 'login_page.js');
let loginPage = fs.readFileSync(loginPagePath, 'utf8');
const recoveryNeedle = `      const res = await Auth.solicitarCodigoRecuperacao(ident);\n      if (!res.success) {\n        errBox.textContent = res.message;\n        errBox.style.display = 'block';\n        btn.disabled = false;\n        btn.innerHTML = originalText;\n        return;\n      }\n\n      recoveryUserId = res.userId;`;
const recoveryReplacement = `      const res = await Auth.solicitarCodigoRecuperacao(ident);\n      const recoveryId = res?.requestId || res?.userId || null;\n      const staleCta = document.getElementById('rec-create-account-cta');\n      if (staleCta) staleCta.remove();\n\n      if (!res.success || !recoveryId) {\n        const accountMissing = !!res.success && !recoveryId;\n        errBox.textContent = accountMissing\n          ? (ident.includes('@')\n              ? 'Não encontramos uma conta cadastrada com este e-mail.'\n              : 'Não encontramos uma conta cadastrada com este usuário ou e-mail.')\n          : (res.message || 'Não foi possível iniciar a recuperação.');\n        errBox.style.display = 'block';\n\n        if (accountMissing) {\n          const cta = document.createElement('button');\n          cta.type = 'button';\n          cta.id = 'rec-create-account-cta';\n          cta.className = 'btn-primary';\n          cta.textContent = 'Criar minha conta';\n          cta.style.marginTop = '10px';\n          cta.addEventListener('click', () => {\n            if (typeof closeRecoveryModal === 'function') closeRecoveryModal();\n            if (typeof openRegisterModal === 'function') openRegisterModal();\n            if (ident.includes('@')) {\n              const email = document.getElementById('reg-email');\n              if (email) email.value = ident;\n            } else {\n              const username = document.getElementById('reg-username');\n              if (username) username.value = ident;\n            }\n          });\n          errBox.insertAdjacentElement('afterend', cta);\n        }\n\n        btn.disabled = false;\n        btn.innerHTML = originalText;\n        return;\n      }\n\n      recoveryUserId = recoveryId;`;

if (loginPage.includes(recoveryNeedle)) {
  loginPage = loginPage.replace(recoveryNeedle, recoveryReplacement);
} else if (!loginPage.includes("const recoveryId = res?.requestId || res?.userId || null;")) {
  throw new Error('Não foi possível aplicar o tratamento de conta inexistente em login_page.js.');
}
fs.writeFileSync(loginPagePath, loginPage, 'utf8');

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

const builtLoginPage = fs.readFileSync(loginPagePath, 'utf8');
if (!builtLoginPage.includes("const recoveryId = res?.requestId || res?.userId || null;") ||
    !builtLoginPage.includes('Não encontramos uma conta cadastrada com este e-mail.') ||
    !builtLoginPage.includes("cta.textContent = 'Criar minha conta'")) {
  throw new Error('Build Cloudflare sem bloqueio real de OTP para conta inexistente.');
}

console.log('✅ Cloudflare Workers dist preparado a partir da fonte imutável Patch 27 com recuperação tratada.');
