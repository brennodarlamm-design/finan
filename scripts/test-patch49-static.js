// scripts/test-patch49-static.js — Validação Estática e Unitária do Patch 49 (MFA Google Authenticator)

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🔒 [TEST-PATCH-49] Iniciando suíte de testes de MFA / Google Authenticator...');

// 1. Testar motor TOTP RFC 6238 (_totp.js)
console.log('👉 [1/6] Testando motor criptográfico TOTP, Base32 e QR Code SVG...');
const totpModule = await import('../api/_totp.js');
const {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  generateTotpToken,
  verifyTotpCode,
  generateTotpUri,
  generateBackupCodes,
  verifyBackupCode,
  generateQrSvg
} = totpModule;

// Base32 encode / decode
const testBuf = Buffer.from('FinObra Master Test 2026', 'utf8');
const encB32 = base32Encode(testBuf);
assert.ok(/^[A-Z2-7]+$/.test(encB32), 'Base32 deve conter apenas caracteres A-Z e 2-7');
const decBuf = base32Decode(encB32);
assert.strictEqual(decBuf.toString('utf8'), 'FinObra Master Test 2026', 'Base32 round-trip deve preservar o buffer original');

// Geração de segredo
const secret = generateTotpSecret(20);
assert.strictEqual(secret.length, 32, 'Segredo de 20 bytes deve ter 32 caracteres Base32');
assert.ok(/^[A-Z2-7]+$/.test(secret), 'Segredo deve ser Base32 válido');

// Geração e validação de token TOTP
const nowSec = Math.floor(Date.now() / 1000);
const code = generateTotpToken(secret, nowSec);
assert.strictEqual(code.length, 6, 'Código TOTP deve ter exatamente 6 dígitos');
assert.ok(/^\d{6}$/.test(code), 'Código TOTP deve ser numérico');

// Verificação imediata
const verifyOk = verifyTotpCode(secret, code, { timeStepSec: 30, window: 1, lastUsedStep: 0 });
assert.strictEqual(verifyOk.valid, true, 'Código gerado agora deve ser válido');
assert.ok(verifyOk.step > 0, 'Step retornado deve ser maior que 0');

// Proteção contra Replay Attack
const replayCheck = verifyTotpCode(secret, code, { timeStepSec: 30, window: 1, lastUsedStep: verifyOk.step });
assert.strictEqual(replayCheck.valid, false, 'Código não pode ser reutilizado no mesmo step (Anti-Replay Attack)');

// Tolerância de janela de tempo (-1 e +1)
const codePast = generateTotpToken(secret, nowSec - 25);
const verifyPast = verifyTotpCode(secret, codePast, { timeStepSec: 30, window: 1, lastUsedStep: 0 });
assert.strictEqual(verifyPast.valid, true, 'Janela de tolerância anterior (-1) deve ser aceita');

// Código inválido
const verifyInvalid = verifyTotpCode(secret, '000000', { timeStepSec: 30, window: 1, lastUsedStep: 0 });
// Se coincidentemente o código não for 000000:
if (code !== '000000') {
  assert.strictEqual(verifyInvalid.valid, false, 'Código incorreto deve ser rejeitado');
}

// Códigos de Backup (Emergência)
const { codes: backupList, hashedCodes: backupHashed } = generateBackupCodes(8);
assert.strictEqual(backupList.length, 8, 'Devem ser gerados 8 códigos de backup');
assert.strictEqual(backupHashed.length, 8, 'Devem ser gerados 8 hashes de backup');
assert.ok(/^[0-9A-F]{4}-[0-9A-F]{4}$/.test(backupList[0]), 'Formato do código deve ser XXXX-XXXX');

// Validação de código de backup
const firstBackup = backupList[0];
const backupRes = verifyBackupCode(firstBackup, backupHashed);
assert.strictEqual(backupRes.valid, true, 'Código de backup válido deve ser aceito');
assert.strictEqual(backupRes.remainingHashedCodes.length, 7, 'Código de backup usado deve ser consumido');

// Tentativa de reutilizar o código consumido
const backupReuse = verifyBackupCode(firstBackup, backupRes.remainingHashedCodes);
assert.strictEqual(backupReuse.valid, false, 'Código de backup consumido não pode ser reutilizado');

// URI otpauth
const uri = generateTotpUri(secret, 'admin', 'FinObra SaaS');
assert.ok(uri.startsWith('otpauth://totp/FinObra%20SaaS:admin?'), 'URI otpauth deve ter prefixo e parâmetros corretos');
assert.ok(uri.includes(`secret=${secret}`), 'URI deve conter o segredo');

// Renderizador QR Code SVG em JS puro
const svg = generateQrSvg(uri, 180);
assert.ok(svg.includes('<svg'), 'QR Code deve gerar tag <svg');
assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'), 'SVG deve conter namespace XML');
assert.ok(svg.includes('<path d="'), 'SVG deve conter caminho vetorial dos módulos QR');
console.log('✅ [1/6] Motor TOTP, Base32 e QR Code SVG aprovados com 100% de sucesso.');

// 2. Testar Esquema do Banco de Dados e Migração
console.log('👉 [2/6] Verificando arquivos de migração e schema.sql...');
const migrationPath = path.join(rootDir, 'migrations', '022_master_mfa_totp.sql');
assert.ok(fs.existsSync(migrationPath), 'Arquivo migrations/022_master_mfa_totp.sql deve existir');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
assert.ok(migrationSql.includes('mfa_secret'), 'Migração deve conter mfa_secret');
assert.ok(migrationSql.includes('mfa_enabled'), 'Migração deve conter mfa_enabled');
assert.ok(migrationSql.includes('mfa_backup_codes'), 'Migração deve conter mfa_backup_codes');
assert.ok(migrationSql.includes('mfa_last_used_step'), 'Migração deve conter mfa_last_used_step');

const schemaPath = path.join(rootDir, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
assert.ok(schemaSql.includes('mfa_secret'), 'schema.sql deve conter mfa_secret');
assert.ok(schemaSql.includes('mfa_enabled'), 'schema.sql deve conter mfa_enabled');
console.log('✅ [2/6] Estrutura do Neon PostgreSQL validada.');

// 3. Testar Endpoints Serverless (api/auth.js e api/admin.js)
console.log('👉 [3/6] Verificando integração de 2FA em api/auth.js e api/admin.js...');
const authApiCode = fs.readFileSync(path.join(rootDir, 'api', 'auth.js'), 'utf8');
assert.ok(authApiCode.includes('action === \'mfa_verify\''), 'api/auth.js deve conter rota mfa_verify');
assert.ok(authApiCode.includes('action === \'mfa_setup\''), 'api/auth.js deve conter rota mfa_setup');
assert.ok(authApiCode.includes('action === \'mfa_activate\''), 'api/auth.js deve conter rota mfa_activate');
assert.ok(authApiCode.includes('mfa_setup_required'), 'api/auth.js deve sinalizar mfa_setup_required');
assert.ok(authApiCode.includes('mfa_required'), 'api/auth.js deve sinalizar mfa_required');

const adminApiCode = fs.readFileSync(path.join(rootDir, 'api', 'admin.js'), 'utf8');
assert.ok(adminApiCode.includes('!auth.user.mfa_enabled || !auth.user.mfa_verified') || adminApiCode.includes('auth.user.mfa_enabled && !auth.user.mfa_verified'), 'api/admin.js deve bloquear superadmin sem mfa_verified');
assert.ok(adminApiCode.includes('action === \'mfa_status\''), 'api/admin.js deve suportar mfa_status');
assert.ok(adminApiCode.includes('action === \'mfa_regenerate_backup_codes\''), 'api/admin.js deve suportar mfa_regenerate_backup_codes');
console.log('✅ [3/6] Endpoints serverless validados.');

// 4. Testar Limite Serverless do Vercel Hobby (<= 12 funções)
console.log('👉 [4/6] Verificando contagem de funções serverless em api/ (limite Vercel Hobby <= 12)...');
const apiFiles = fs.readdirSync(path.join(rootDir, 'api')).filter(f => f.endsWith('.js') && !f.startsWith('_'));
assert.ok(apiFiles.length <= 12, `Vercel Hobby suporta no máximo 12 endpoints. Atualmente temos ${apiFiles.length}.`);
console.log(`✅ [4/6] Contagem de endpoints serverless em conformidade: ${apiFiles.length}/12 funções.`);

// 5. Testar Interface master.html e CSP Bridge
console.log('👉 [5/6] Verificando master.html, master_page.js e CSP allowlist em patch26-events.js...');
const masterHtml = fs.readFileSync(path.join(rootDir, 'master.html'), 'utf8');
assert.ok(masterHtml.includes('id="master-step-credentials"'), 'master.html deve ter step de credenciais');
assert.ok(masterHtml.includes('id="master-step-mfa"'), 'master.html deve ter step de MFA 2FA');
assert.ok(masterHtml.includes('id="master-step-setup"'), 'master.html deve ter step de ativação com QR code');
assert.ok(masterHtml.includes('id="master-totp-input"'), 'master.html deve ter input totp');
assert.ok(masterHtml.includes('id="master-backup-input"'), 'master.html deve ter input de backup');
assert.ok(masterHtml.includes('id="master-mfa-modal"'), 'master.html deve ter modal de gerenciamento 2FA');

const eventsJs = fs.readFileSync(path.join(rootDir, 'js', 'patch26-events.js'), 'utf8');
const requiredActions = [
  'executarVerificacaoMfa',
  'executarAtivacaoMfa',
  'alternarModoBackupMfa',
  'voltarEtapaLoginMaster',
  'MasterAdmin.abrirModalMfa',
  'MasterAdmin.fecharModalMfa',
  'MasterAdmin.copiarChaveMfa',
  'MasterAdmin.regenerarBackupCodes',
  'MasterAdmin.copiarNovosBackupCodes'
];
for (const act of requiredActions) {
  assert.ok(eventsJs.includes(`"${act}"`), `patch26-events.js deve incluir a ação "${act}" na allowlist CSP`);
}
console.log('✅ [5/6] Interface e compliance com CSP validados.');

// 6. Testar Integração com Auth no Frontend
console.log('👉 [6/6] Verificando métodos MFA no Auth (js/auth.js)...');
const authJs = fs.readFileSync(path.join(rootDir, 'js', 'auth.js'), 'utf8');
assert.ok(authJs.includes('verifyMfa('), 'js/auth.js deve exportar verifyMfa');
assert.ok(authJs.includes('setupMfa('), 'js/auth.js deve exportar setupMfa');
assert.ok(authJs.includes('activateMfa('), 'js/auth.js deve exportar activateMfa');
console.log('✅ [6/6] Métodos frontend validados.');

console.log('\n🎉 [PATCH-49] TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!\n');
