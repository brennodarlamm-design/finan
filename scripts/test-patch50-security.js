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

// 3. Separação de Segredos
console.log('3. Verificando suporte aos novos segredos com fallback...');
import { getSessionSigningSecret, getInternalApiSecret } from '../api/_auth.js';

process.env.SESSION_SIGNING_SECRET = 'test_session_secret_123';
process.env.INTERNAL_API_SECRET = 'test_internal_secret_456';
assert.strictEqual(getSessionSigningSecret(), 'test_session_secret_123', 'getSessionSigningSecret deve retornar a variável dedicada.');
assert.strictEqual(getInternalApiSecret(), 'test_internal_secret_456', 'getInternalApiSecret deve retornar a variável dedicada.');

delete process.env.SESSION_SIGNING_SECRET;
delete process.env.INTERNAL_API_SECRET;
process.env.API_SECRET = 'legacy_secret_789';
assert.strictEqual(getSessionSigningSecret(), 'legacy_secret_789', 'getSessionSigningSecret deve fazer fallback para API_SECRET se a dedicada não existir.');
assert.strictEqual(getInternalApiSecret(), 'legacy_secret_789', 'getInternalApiSecret deve fazer fallback para API_SECRET se a dedicada não existir.');
console.log('  ✓ Separação de secrets e fallbacks validados com sucesso!\n');

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
console.log('  ✓ Hardening do Render verificado com sucesso!\n');

console.log('===================================================');
console.log('🚀 TODOS OS TESTES DA SEQUÊNCIA P50 PASSARAM!');
console.log('===================================================');
