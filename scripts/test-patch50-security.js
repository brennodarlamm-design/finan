// scripts/test-patch50-security.js — Testes Estáticos de Segurança P50 (Itens 2 a 8)
import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== Suíte de Testes da Sequência de Segurança P50 ===\n');

// 1. Validação de RBAC Fail-Closed em _permissions.js
import { canAccessTable } from '../api/_permissions.js';

console.log('1. Testando RBAC Fail-Closed (canAccessTable)...');
const userAuth = { user: { perfil: 'admin' }, isSystem: false };
const systemAuth = { isSystem: true };

// Tabela não mapeada em TABLE_MODULES deve ser REJEITADA por padrão (Fail-Closed)
const unmappedResult = canAccessTable(userAuth, 'tabela_inventada_xpto', 'read');
assert.strictEqual(unmappedResult, false, 'Tabela não mapeada deve retornar false para usuário comum (Fail-Closed).');

// Chamadas do sistema devem ter acesso concedido
const systemUnmappedResult = canAccessTable(systemAuth, 'tabela_inventada_xpto', 'read');
assert.strictEqual(systemUnmappedResult, true, 'Chamadas com isSystem: true devem ter acesso liberado.');

// Tabelas mapeadas continuam funcionando normalmente
const mappedResult = canAccessTable(userAuth, 'obras', 'read');
assert.strictEqual(mappedResult, true, 'Tabela mapeada "obras" deve permitir leitura para admin.');
console.log('  ✓ RBAC Fail-Closed verificado com sucesso!\n');

// 2. Verificação de Ocultação de err.message em Respostas de API
console.log('2. Verificando ausência de vazamento de err.message em respostas HTTP...');
const dbContent = fs.readFileSync(path.resolve('api/db.js'), 'utf8');
assert(!dbContent.includes('error: err.message'), 'db.js não deve retornar error: err.message diretamente ao cliente.');
assert(!dbContent.includes('error:`Erro ao salvar orçamento SINAPI: ${dbErr.message}`'), 'db.js não deve expor dbErr.message.');

const authContent = fs.readFileSync(path.resolve('api/auth.js'), 'utf8');
assert(!authContent.includes('detail: err.message'), 'auth.js não deve expor detail: err.message.');

const adminContent = fs.readFileSync(path.resolve('api/admin.js'), 'utf8');
assert(!adminContent.includes("error: 'Erro interno no servidor Master: ' + err.message"), 'admin.js não deve concatenar err.message na resposta.');

const certContent = fs.readFileSync(path.resolve('api/_certificado.js'), 'utf8');
assert(!certContent.includes('detail: err.message'), '_certificado.js não deve expor detail: err.message.');
console.log('  ✓ Vazamento de erros de banco/runtime contido com sucesso!\n');

// 3. Separação de Segredos — PATCH 50: sem fallback para API_SECRET
console.log('3. Verificando separação estrita de secrets (sem fallback para API_SECRET)...');
import { getSessionSigningSecret, getInternalApiSecret } from '../api/_auth.js';

// Salvar estado anterior
const _prevSession = process.env.SESSION_SIGNING_SECRET;
const _prevInternal = process.env.INTERNAL_API_SECRET;
const _prevApi = process.env.API_SECRET;

// Com as vars dedicadas presentes, deve retornar os valores corretos
process.env.SESSION_SIGNING_SECRET = 'test_session_secret_123';
process.env.INTERNAL_API_SECRET = 'test_internal_secret_456';
process.env.API_SECRET = 'legacy_secret_should_be_ignored';
assert.strictEqual(getSessionSigningSecret(), 'test_session_secret_123', 'getSessionSigningSecret deve retornar a variável dedicada.');
assert.strictEqual(getInternalApiSecret(), 'test_internal_secret_456', 'getInternalApiSecret deve retornar a variável dedicada.');

// PATCH 50: com a var dedicada ausente, deve retornar '' — NÃO o API_SECRET legado.
delete process.env.SESSION_SIGNING_SECRET;
delete process.env.INTERNAL_API_SECRET;
assert.strictEqual(getSessionSigningSecret(), '', 'getSessionSigningSecret NÃO deve fazer fallback para API_SECRET (PATCH 50).');
assert.strictEqual(getInternalApiSecret(), '', 'getInternalApiSecret NÃO deve fazer fallback para API_SECRET (PATCH 50).');

// Restaurar
if (_prevSession !== undefined) process.env.SESSION_SIGNING_SECRET = _prevSession;
if (_prevInternal !== undefined) process.env.INTERNAL_API_SECRET = _prevInternal;
if (_prevApi !== undefined) process.env.API_SECRET = _prevApi; else delete process.env.API_SECRET;

console.log('  ✓ Separação estrita de secrets (sem fallback) validada com sucesso!\n');

// 4. Hardening de Upload & OCR
console.log('4. Verificando regras de segurança em Upload e OCR...');
const uploadContent = fs.readFileSync(path.resolve('api/upload.js'), 'utf8');
assert(uploadContent.includes('magicHex.startsWith'), 'upload.js deve verificar magic bytes.');
assert(uploadContent.includes('isExeOrScript'), 'upload.js deve rejeitar magic bytes executáveis/scripts.');
assert(!uploadContent.includes("'application/octet-stream'\n    ];"), 'upload.js não deve aceitar application/octet-stream incondicionalmente em ALLOWED_MIMES.');

const ocrContent = fs.readFileSync(path.resolve('api/reconhecer-documento.js'), 'utf8');
assert(ocrContent.includes('ocr:user:'), 'reconhecer-documento.js deve ter rate limit por usuário.');
assert(ocrContent.includes('ocr:tenant:'), 'reconhecer-documento.js deve ter rate limit por tenant.');
assert(ocrContent.includes('approxBytes > 10 * 1024 * 1024'), 'reconhecer-documento.js deve ter pré-checagem de tamanho max 10MB.');
assert(ocrContent.includes('isPdf && !isPng && !isJpg && !isWebp'), 'reconhecer-documento.js deve validar magic bytes para PDF/imagens.');
console.log('  ✓ Hardening de Upload e OCR verificado com sucesso!\n');

// 5. Auditoria de Eventos de Segurança
console.log('5. Verificando registro de eventos na auditoria...');
assert(authContent.includes("acao: 'login_bloqueado'"), 'auth.js deve emitir evento login_bloqueado.');
assert(authContent.includes("acao: 'mfa_invalido'"), 'auth.js deve emitir evento mfa_invalido.');
assert(adminContent.includes("acao: 'impersonate'") || adminContent.includes("acao:'impersonate'"), 'admin.js deve emitir evento de impersonação.');
assert(adminContent.includes("acao: 'suporte_encerrado'") || adminContent.includes("acao:'suporte_encerrado'"), 'admin.js deve emitir evento de encerramento de impersonação.');
console.log('  ✓ Eventos de auditoria verificados com sucesso!\n');

// 6. Hardening Render & Healthz
console.log('6. Verificando rota /healthz e supressão de logs no backend...');
const serverContent = fs.readFileSync(path.resolve('backend/server.js'), 'utf8');
assert(serverContent.includes("/healthz"), 'backend/server.js deve implementar a rota /healthz.');
assert(serverContent.includes("msg.includes('Closing session:')"), 'backend/server.js deve filtrar mensagens de reconexão do Baileys.');
assert(!serverContent.includes('process.env.API_SECRET || process.env.VERCEL_API_SECRET'), 'backend/server.js não deve ter fallback para API_SECRET legado.');
console.log('  ✓ Hardening do Render verificado com sucesso!\n');

// 7. Chave da Empresa de 6 Números (PATCH 50.2)
console.log('7. Verificando Chave da Empresa de 6 números...');
import {
  generateTenantAccessKey,
  isTenantAccessKeyShapeValid,
  normalizeTenantAccessKey,
  hashTenantAccessKey,
  tenantAccessKeyLast4
} from '../api/_tenant-access-key.js';

const generatedKey = generateTenantAccessKey();
assert(/^\d{6}$/.test(generatedKey), `Chave gerada deve conter exatamente 6 dígitos numéricos: ${generatedKey}`);
assert(isTenantAccessKeyShapeValid(generatedKey), 'Shape de chave de 6 dígitos deve ser válido.');
assert(isTenantAccessKeyShapeValid('123456'), 'Chave numérica 123456 deve ser válida.');
assert(isTenantAccessKeyShapeValid('123-456'), 'Chave formatada 123-456 deve ser válida.');
assert(!isTenantAccessKeyShapeValid('12345'), 'Chave de 5 dígitos deve ser rejeitada.');
assert(!isTenantAccessKeyShapeValid('1234567'), 'Chave de 7 dígitos deve ser rejeitada.');
assert(!isTenantAccessKeyShapeValid('ABCDEF'), 'Chave não numérica sem prefixo deve ser rejeitada.');

const normalized6 = normalizeTenantAccessKey(' 849-201 ');
assert.strictEqual(normalized6, '849201', 'Normalização deve remover espaços e traços.');
assert.strictEqual(tenantAccessKeyLast4('849201'), '9201', 'Last4 deve extrair os 4 dígitos finais.');
console.log('  ✓ Chave da Empresa de 6 dígitos validada com sucesso!\n');

// 8. Import de getInternalApiSecret em api/auth.js
console.log('8. Verificando importações e chamadas em api/auth.js...');
assert(authContent.includes('getInternalApiSecret'), 'api/auth.js deve importar getInternalApiSecret.');
assert(authContent.includes("import { hashPassword, verifyPassword, signToken, verifyToken, resolveAuthAndTenant, getSessionSigningSecret, getInternalApiSecret } from './_auth.js'"), 'api/auth.js deve ter getInternalApiSecret no import do topo.');
console.log('  ✓ Importação de getInternalApiSecret validada com sucesso!\n');

// 9. Google OAuth Fail-Closed antes de qualquer query SQL
console.log('9. Verificando Google OAuth Fail-Closed com Chave da Empresa...');
const googleKeyIndex = authContent.indexOf('rawGoogleCompanyKey');
const googleNeedsKeyIndex = authContent.indexOf('google_needs_company_key: true');
const googleSqlIndex = authContent.indexOf('SELECT u.*, t.razao_social, t.nome_fantasia, t.status as tenant_status');
assert(googleKeyIndex > -1, 'auth.js deve ler rawGoogleCompanyKey.');
assert(googleNeedsKeyIndex > -1, 'auth.js deve ter verificação de chave antes da query.');
assert(googleNeedsKeyIndex < googleSqlIndex, 'auth.js deve bloquear falta de chave ANTES de executar a query de usuários do Google (Fail-Closed).');
assert(authContent.includes('AND u.tenant_id = ${googleTenantId}'), 'auth.js deve restringir usuário do Google estritamente ao tenant_id resolvido.');
console.log('  ✓ Google OAuth Fail-Closed validado com sucesso!\n');

// 10. Frontend: Envio de access_key e compatibilidade
console.log('10. Verificando padronização de access_key no frontend...');
const loginPageContent = fs.readFileSync(path.resolve('js/login_page.js'), 'utf8');
assert(loginPageContent.includes('Auth.login(u, p, r, { access_key: ak })'), 'login_page.js deve enviar access_key: ak no login.');
assert(loginPageContent.includes('Auth.loginWithGoogle(response.credential, { access_key: ak })'), 'login_page.js deve enviar access_key no Google login.');
assert(loginPageContent.includes('Auth.solicitarCodigoRecuperacao(ident, { access_key: ak })'), 'login_page.js deve enviar access_key na recuperação de senha.');

const frontendAuthContent = fs.readFileSync(path.resolve('js/auth.js'), 'utf8');
assert(frontendAuthContent.includes('access_key: key'), 'js/auth.js deve empacotar access_key no payload.');
console.log('  ✓ Frontend padronizado com access_key validado com sucesso!\n');

console.log('===================================================');
console.log('🚀 TODOS OS TESTES DA SEQUÊNCIA P50 PASSARAM!');
console.log('===================================================');
