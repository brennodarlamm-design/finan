// scripts/test-patch55-security.js
// Suíte de Testes de Segurança — PATCH 55
// Valida: PIX anti-tampering, UI/UX PIX, Criptografia MFA AES-256-GCM, HMAC Pepper de Chave de Empresa, e RLS Neon.

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

process.env.MFA_ENCRYPTION_KEY ||= 'test-only-mfa-encryption-key-0123456789abcdef';
process.env.TENANT_KEY_PEPPER ||= 'test-only-tenant-key-pepper-0123456789abcdef';

import {
  encryptMfaSecret,
  decryptMfaSecret,
  generateTotpSecret,
  verifyTotpCode
} from '../api/_totp.js';

import {
  hashTenantAccessKey,
  hashTenantAccessKeyLegacy,
  normalizeTenantAccessKey,
  timingSafeHashEqual,
  isTenantAccessKeyShapeValid
} from '../api/_tenant-access-key.js';

import { getPlanCyclePrice } from '../api/_plans.js';

console.log('=== Suíte de Testes da Sequência de Segurança Patch 55 ===\n');

// ── 1. PIX: Eliminação de Hardcoding e Prevenção de Tampering ────────────────
console.log('1. Testando regras antifraude no webhook PIX...');

const webhookCode = fs.readFileSync(path.join(root, 'api/_webhook_pix_core.js'), 'utf8');

// Não pode existir fallback direto com hardcoding de 27990
assert(!webhookCode.includes('27990'), 'Webhook PIX NÃO pode conter o valor hardcoded 27990.');
assert(!webhookCode.includes('else if (payload.tenantId)'), 'Webhook PIX NÃO pode liquidar faturas às cegas via else if (payload.tenantId).');

// Deve validar que a fatura existe
assert(webhookCode.includes('Fatura de cobrança não encontrada'), 'Webhook PIX deve rejeitar pagamentos sem fatura correspondente.');

// Deve verificar subpagamento
assert(webhookCode.includes('receivedCents < expectedCents'), 'Webhook PIX deve verificar subpagamento (receivedCents < expectedCents).');
assert(webhookCode.includes('Liquidação rejeitada por subpagamento'), 'Webhook PIX deve rejeitar subpagamentos.');

// Deve verificar isolamento de tenant na fatura
assert(webhookCode.includes('String(payload.tenantId).trim() !== String(invoice.tenant_id).trim()'), 'Webhook PIX deve validar que a fatura pertence ao tenant informado.');

// Deve importar validação canônica de planos
assert(webhookCode.includes('getPlanCyclePrice'), 'Webhook PIX deve importar e validar preços contra a tabela canônica de planos.');

console.log('  ✓ Regras antifraude e liquidação estrita do Webhook PIX validadas com sucesso!\n');

// ── 2. Endpoint de Polling de Fatura em api/plano.js ─────────────────────────
console.log('2. Testando endpoint de polling live de fatura (action=check_invoice)...');

const planoCode = fs.readFileSync(path.join(root, 'api/plano.js'), 'utf8');
assert(planoCode.includes("action === 'check_invoice'"), 'api/plano.js deve implementar action=check_invoice para polling seguro.');
assert(planoCode.includes('billing_invoices'), 'api/plano.js deve consultar billing_invoices com filtro estrito de tenantId.');
assert(planoCode.includes('SELECT id, tenant_id, plan_id, cycle, amount_cents, txid, status, paid_at'), 'check_invoice deve retornar campos de status de pagamento.');

console.log('  ✓ Endpoint de polling de fatura validado com sucesso!\n');

// ── 3. UI/UX do Modal PIX com Badges de Confiança e Polling ─────────────────
console.log('3. Testando melhorias visuais e de confiabilidade do Checkout PIX...');

const cobrancaCode = fs.readFileSync(path.join(root, 'js/cobranca.js'), 'utf8');

// Badges de segurança e conformidade
assert(cobrancaCode.includes('Transação 100% Protegida por Criptografia SSL 256-bit'), 'Modal PIX deve exibir selo de criptografia SSL 256-bit.');
assert(cobrancaCode.includes('Banco Central do Brasil'), 'Modal PIX deve referenciar homologação BACEN / SPI.');
assert(cobrancaCode.includes('Beneficiário Oficial:'), 'Modal PIX deve deixar explícito o beneficiário oficial.');
assert(cobrancaCode.includes('Identificador (TXID):'), 'Modal PIX deve exibir o TXID da transação.');

// Feedback de cópia e instruções passo a passo
assert(cobrancaCode.includes('✓ Código Copiado!'), 'Modal PIX deve fornecer feedback tátil e visual imediato na cópia.');
assert(cobrancaCode.includes('Como pagar com seu banco:'), 'Modal PIX deve conter instruções claras de 4 passos.');

// Polling live e canal de suporte
assert(cobrancaCode.includes('action=check_invoice'), 'Modal PIX deve efetuar polling ativo de liquidação.');
assert(cobrancaCode.includes('_pixPollTimer'), 'Modal PIX deve gerenciar e limpar o timer de polling no fechamento.');
assert(cobrancaCode.includes('api.whatsapp.com/send'), 'Modal PIX deve conter botão 1-clique de suporte com TXID.');

console.log('  ✓ Modal PIX com badges de confiança, feedback e polling validado com sucesso!\n');

// ── 4. Criptografia AES-256-GCM do Segredo MFA Master ───────────────────────
console.log('4. Testando criptografia em repouso AES-256-GCM para segredos MFA...');

const rawSecret = generateTotpSecret(20);
assert(/^[A-Z2-7]+$/.test(rawSecret), 'Segredo Base32 gerado deve ser válido.');

const encryptedSecret = await encryptMfaSecret(rawSecret);
assert(encryptedSecret.startsWith('v1$'), 'Segredo criptografado deve iniciar com versão v1$.');

const parts = encryptedSecret.split('$');
assert.strictEqual(parts.length, 4, 'Envelope criptografado deve conter 4 partes: v1, iv, tag, ciphertext.');

// Descriptografia normal
const decRes = await decryptMfaSecret(encryptedSecret);
assert.strictEqual(decRes.isLegacy, false, 'Segredo v1 não deve ser marcado como legado.');
assert.strictEqual(decRes.secret, rawSecret, 'Descriptografia deve recuperar o segredo Base32 original idêntico.');

// Compatibilidade transparente com formato legado (texto puro)
const legacyRes = await decryptMfaSecret('JBSWY3DPEHPK3PXP');
assert.strictEqual(legacyRes.isLegacy, true, 'Segredo sem prefixo v1 deve ser identificado como legado.');
assert.strictEqual(legacyRes.secret, 'JBSWY3DPEHPK3PXP', 'Segredo legado deve ser retornado intacto.');

// Detecção de adulteração de ciphertext ou tag (GCM Authentication Tag)
const tamperedEncrypted = encryptedSecret.slice(0, -4) + 'AAAA';
await assert.rejects(async () => {
  await decryptMfaSecret(tamperedEncrypted);
}, /Unsupported state or unable to authenticate data|Formato inválido|operation failed/i, 'Adulteração do envelope criptografado deve falhar na autenticação GCM.');

// Verificação em api/auth.js
const authCode = fs.readFileSync(path.join(root, 'api/auth.js'), 'utf8');
assert(authCode.includes('decryptMfaSecret'), 'api/auth.js deve chamar decryptMfaSecret.');
assert(authCode.includes('encryptMfaSecret'), 'api/auth.js deve chamar encryptMfaSecret.');
assert(authCode.includes('isLegacy && decryptedSecret'), 'api/auth.js deve auto-migrar segredos legados no login com sucesso.');

console.log('  ✓ Criptografia AES-256-GCM de MFA e auto-migração validadas com sucesso!\n');

// ── 5. Chave da Empresa com Peppered HMAC-SHA256 ───────────────────────────
console.log('5. Testando Chave da Empresa com HMAC-SHA256 e Pepper de Servidor...');

const testKey = '582910';
const pepperedHash = hashTenantAccessKey(testKey);
const legacyHash = hashTenantAccessKeyLegacy(testKey);

assert.notStrictEqual(pepperedHash, legacyHash, 'Hash peppered deve ser criptograficamente diferente do SHA-256 simples.');
assert.strictEqual(pepperedHash.length, 64, 'Hash HMAC-SHA256 deve possuir 64 caracteres hexadecimais.');

// Determinismo com a mesma chave
assert.strictEqual(hashTenantAccessKey(testKey), pepperedHash, 'Hash peppered deve ser determinístico para a mesma chave.');

// Timing-safe equal
assert(timingSafeHashEqual(pepperedHash, pepperedHash), 'timingSafeHashEqual deve aceitar hashes idênticos.');
assert(!timingSafeHashEqual(pepperedHash, legacyHash), 'timingSafeHashEqual deve rejeitar hashes diferentes.');
assert(!timingSafeHashEqual(pepperedHash, ''), 'timingSafeHashEqual deve rejeitar strings vazias com segurança.');

const tenantKeyHelperCode = fs.readFileSync(path.join(root, 'api/_tenant-access-key.js'), 'utf8');
assert(tenantKeyHelperCode.includes('hashTenantAccessKeyLegacy'), '_tenant-access-key.js deve exportar hashTenantAccessKeyLegacy.');
assert(tenantKeyHelperCode.includes('Fallback transparente: hash legado sem pepper'), '_tenant-access-key.js deve incluir fallback para auto-migração.');

console.log('  ✓ Chave da Empresa com HMAC peppered e auto-migração validadas com sucesso!\n');

// ── 6. Migração 029 de RLS e Revogação da Neon Data API ─────────────────────
console.log('6. Testando integridade do script de migração 029...');

const migrationFile = path.join(root, 'migrations/029_enable_rls_production.sql');
assert(fs.existsSync(migrationFile), 'Arquivo migrations/029_enable_rls_production.sql deve existir.');

const migrationSql = fs.readFileSync(migrationFile, 'utf8');
assert(migrationSql.includes('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated, anonymous'), 'Migração 029 deve revogar privilégios de authenticated e anonymous.');
assert(migrationSql.includes('ENABLE ROW LEVEL SECURITY'), 'Migração 029 deve habilitar RLS nas tabelas.');
assert(migrationSql.includes('app.current_tenant_id'), 'Migração 029 deve criar políticas baseadas em app.current_tenant_id.');
assert(migrationSql.includes('VARCHAR(255)'), 'Migração 029 deve expandir mfa_secret para VARCHAR(255).');

console.log('  ✓ Migração 029 validada com sucesso!\n');

console.log('===================================================');
console.log('🚀 TODOS OS TESTES DE SEGURANÇA DO PATCH 55 PASSARAM!');
console.log('===================================================');
