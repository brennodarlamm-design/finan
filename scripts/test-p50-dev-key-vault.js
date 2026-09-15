// scripts/test-p50-dev-key-vault.js
import fs from 'fs';
import path from 'path';
import assert from 'assert';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const master = read('js/master.js');
const devKeys = read('js/dev-tenant-keys.js');
const api = read('api/dev-tenant-keys.js');
const app = read('app.html');
const build = read('scripts/build-cloudflare-pages.cjs');
const migration = read('migrations/027_dev_tenant_key_vault.sql');

assert(!master.includes('_PROVISIONED_DEV_KEYS'), 'master.js não pode conter dicionário de chaves em plaintext.');
assert(!master.includes('finobra_dev_tenant_keys'), 'master.js não pode persistir chaves DEV em localStorage.');
assert(!devKeys.includes('localStorage.setItem'), 'dev-tenant-keys.js não deve persistir chaves completas em localStorage.');
assert(devKeys.includes('/api/dev-tenant-keys?action=list'), 'Tabela DEV deve puxar metadados das chaves pelo backend.');
assert(devKeys.includes('/api/dev-tenant-keys?action=reveal'), 'Revelação deve ocorrer por chamada individual autenticada.');
assert(devKeys.includes("/api/dev-tenant-keys?action=rotate"), 'Rotação deve ocorrer pelo cofre server-side.');

assert(api.includes("crypto.createCipheriv('aes-256-gcm'"), 'Cofre deve cifrar chaves com AES-256-GCM.');
assert(api.includes("auth.user?.perfil !== 'superadmin'"), 'Cofre deve exigir perfil superadmin.');
assert(api.includes('!auth.user?.mfa_enabled || !auth.user?.mfa_verified'), 'Cofre deve exigir MFA fail-closed.');
assert(api.includes("acao: 'tenant_access_key_revealed'"), 'Revelação de chave deve ser auditada.');
assert(api.includes("acao: 'tenant_access_key_rotated'"), 'Rotação de chave deve ser auditada.');
assert(!api.includes('SELECT * FROM dev_tenant_keys'), 'Endpoint não deve fazer SELECT irrestrito do cofre.');

assert(app.includes('/js/dev-tenant-keys.js'), 'app.html deve carregar o módulo seguro de chaves DEV.');
assert(migration.includes('CREATE TABLE IF NOT EXISTS dev_tenant_keys'), 'Migration 027 deve criar o cofre DEV.');
assert(migration.includes('REVOKE ALL ON TABLE dev_tenant_keys FROM PUBLIC'), 'Tabela do cofre deve revogar privilégios PUBLIC.');

assert(build.includes("Auth.solicitarCodigoRecuperacao(ident, { access_key: ak })"), 'Build deve validar o novo fluxo de recuperação multi-tenant.');
assert(!build.includes("cta.textContent = 'Criar minha conta'"), 'Build não deve reinjetar CTA antigo que conflita com onboarding monitorado.');

console.log('✅ P50 DEV tenant key vault: verificações estáticas passaram.');
