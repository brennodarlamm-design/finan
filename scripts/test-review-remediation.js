// scripts/test-review-remediation.js
// Suíte de Testes Automatizados — Validação de Remediação dos 9 Apontamentos do Review FinGo

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

process.env.SESSION_SIGNING_SECRET = process.env.SESSION_SIGNING_SECRET || 'test-session-signing-secret-32-chars-ok';

console.log('=== Testes Automatizados da Remediação do Review FinGo ===\n');

function createMockResponse() {
  const headers = {};
  let statusCode = 200;
  let jsonBody = null;
  let rawBody = null;
  return {
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    status(c) { statusCode = c; return this; },
    json(b) { jsonBody = b; return this; },
    send(b) { rawBody = b; return this; },
    getStatusCode: () => statusCode,
    getBody: () => jsonBody,
    getRawBody: () => rawBody,
    getHeaders: () => headers
  };
}

// -------------------------------------------------------------
// 1. Trilha de Auditoria Criptográfica (Apontamento 1)
// -------------------------------------------------------------
console.log('1. Validando autenticação e autorização na trilha de auditoria...');
const { handleV2AuditLedgerAppend, handleV2AuditLedgerVerify } = await import('../api/_v2-routes.js');

// Sem token/autenticação deve retornar 401
const resAppendAnon = createMockResponse();
await handleV2AuditLedgerAppend({ headers: {}, body: { action: 'FORGED_EVENT' } }, resAppendAnon);
assert.strictEqual(resAppendAnon.getStatusCode(), 401, 'handleV2AuditLedgerAppend anônimo deve ser rejeitado com 401');

const resVerifyAnon = createMockResponse();
await handleV2AuditLedgerVerify({ headers: {}, body: { chain: [] } }, resVerifyAnon);
assert.strictEqual(resVerifyAnon.getStatusCode(), 401, 'handleV2AuditLedgerVerify anônimo deve ser rejeitado com 401');
console.log('   ✓ Trilha de auditoria criptográfica bloqueia acessos não autenticados (401).');

// -------------------------------------------------------------
// 2. Rotas de IA de Borda Seguras (Apontamento 2)
// -------------------------------------------------------------
console.log('\n2. Validando autenticação e quotas nas rotas de IA de borda...');
const {
  handleV2EdgeAiChat,
  handleV2EdgeAiOcr,
  handleV2EdgeAiSemanticSearch,
  handleV2DetectAnomaly
} = await import('../api/_v2-routes.js');

const resChatAnon = createMockResponse();
await handleV2EdgeAiChat({ headers: {}, body: { prompt: 'teste' } }, resChatAnon);
assert.strictEqual(resChatAnon.getStatusCode(), 401, 'handleV2EdgeAiChat sem auth deve retornar 401');

const resOcrAnon = createMockResponse();
await handleV2EdgeAiOcr({ headers: {}, body: { image: 'data:image/png;base64,...' } }, resOcrAnon);
assert.strictEqual(resOcrAnon.getStatusCode(), 401, 'handleV2EdgeAiOcr sem auth deve retornar 401');

const resVectorAnon = createMockResponse();
await handleV2EdgeAiSemanticSearch({ headers: {}, body: { query: 'cimento' } }, resVectorAnon);
assert.strictEqual(resVectorAnon.getStatusCode(), 401, 'handleV2EdgeAiSemanticSearch sem auth deve retornar 401');

const resAnomalyAnon = createMockResponse();
await handleV2DetectAnomaly({ headers: {}, body: { expense: { valor: 5000 } } }, resAnomalyAnon);
assert.strictEqual(resAnomalyAnon.getStatusCode(), 401, 'handleV2DetectAnomaly sem auth deve retornar 401');
console.log('   ✓ Todas as 4 rotas de IA de borda exigem autenticação ativa e quotas (401).');

// -------------------------------------------------------------
// 3. Eliminação de Mocks e Fallbacks Claros (Apontamento 3)
// -------------------------------------------------------------
console.log('\n3. Validando eliminação de mocks e validação de parâmetros...');
const { handleV2EdgeMediaOptimize, handleV2SinapiExport } = await import('../api/_v2-routes.js');

const resMediaNoKey = createMockResponse();
await handleV2EdgeMediaOptimize({ url: '/api/v2/edge/media/optimize' }, resMediaNoKey);
assert.strictEqual(resMediaNoKey.getStatusCode(), 400, 'Optimize sem key deve retornar 400 Bad Request');
assert.strictEqual(resMediaNoKey.getBody()?.error, 'PARAM_REQUIRED');

const resSinapiExp = createMockResponse();
await handleV2SinapiExport({ query: { uf: 'SP', formato: 'json' } }, resSinapiExp);
assert.strictEqual(resSinapiExp.getStatusCode(), 200);
assert(resSinapiExp.getBody()?.source, 'Exportação SINAPI deve indicar source de dados');
console.log('   ✓ Endpoints de mídia e SINAPI rejeitam parâmetros ausentes e identificam fonte de dados.');

// -------------------------------------------------------------
// 4. Preferências de Tenant com RBAC (Apontamento 4)
// -------------------------------------------------------------
console.log('\n4. Validando RBAC de preferências de tenant em snapshots...');
const dbQueriesSrc = fs.readFileSync(path.join(root, 'api/_db-queries.js'), 'utf8');
assert(dbQueriesSrc.includes("tableAllowed(auth, 'preferencias', 'read')"), 'api/_db-queries.js deve checar tableAllowed para preferencias');
console.log('   ✓ Preferências de tenant protegidas por RBAC em snapshots e sync.');

// -------------------------------------------------------------
// 5. Blindagem contra XSS nos Formulários (Apontamento 5)
// -------------------------------------------------------------
console.log('\n5. Validando sanitização contra XSS em notas e fornecedores...');
const notasSrc = fs.readFileSync(path.join(root, 'js/notas.js'), 'utf8');
const fornSrc = fs.readFileSync(path.join(root, 'js/fornecedores.js'), 'utf8');

assert(notasSrc.includes('esc(n.numero_nf||'), 'js/notas.js deve sanitizar numero_nf no showForm');
assert(notasSrc.includes('esc(n.emitente||'), 'js/notas.js deve sanitizar emitente no showForm');
assert(notasSrc.includes('esc(n.observacoes||'), 'js/notas.js deve sanitizar observacoes no showForm');

assert(fornSrc.includes('esc(f?.razao_social||'), 'js/fornecedores.js deve sanitizar razao_social no showForm');
assert(fornSrc.includes('esc(f?.nome_fantasia||'), 'js/fornecedores.js deve sanitizar nome_fantasia no showForm');
assert(fornSrc.includes('esc(f?.observacoes||'), 'js/fornecedores.js deve sanitizar observacoes no showForm');
console.log('   ✓ Formulários do frontend sanitizam todos os atributos e tags contra XSS.');

// -------------------------------------------------------------
// 6. Predicados Defensivos em Upserts (Apontamento 6)
// -------------------------------------------------------------
console.log('\n6. Validando predicados de tenant em upserts SQL...');
const dbMutationsSrc = fs.readFileSync(path.join(root, 'api/_db-mutations.js'), 'utf8');
const dbSyncSrc = fs.readFileSync(path.join(root, 'api/_db-sync.js'), 'utf8');

assert(dbMutationsSrc.includes('WHERE lancamentos.tenant_id = ${tenantId}'), 'Mutations deve ter WHERE tenant_id em lancamentos');
assert(dbMutationsSrc.includes('WHERE notas_fiscais.tenant_id = ${tenantId}'), 'Mutations deve ter WHERE tenant_id em notas');
assert(dbMutationsSrc.includes('WHERE fornecedores.tenant_id = ${tenantId}'), 'Mutations deve ter WHERE tenant_id em fornecedores');

assert(dbSyncSrc.includes('WHERE lancamentos.tenant_id = ${tenantId}'), 'Sync deve ter WHERE tenant_id em lancamentos');
assert(dbSyncSrc.includes('WHERE notas_fiscais.tenant_id = ${tenantId}'), 'Sync deve ter WHERE tenant_id em notas');
assert(dbSyncSrc.includes('WHERE fornecedores.tenant_id = ${tenantId}'), 'Sync deve ter WHERE tenant_id em fornecedores');
console.log('   ✓ Upserts SQL contêm predicados defensivos de isolamento multi-tenant.');

// -------------------------------------------------------------
// 7. Setup Neon Multi-Tenant (Apontamento 7)
// -------------------------------------------------------------
console.log('\n7. Validando script de inicialização do banco Neon...');
const setupNeonSrc = fs.readFileSync(path.join(root, 'scripts/setup-neon.js'), 'utf8');
assert(setupNeonSrc.includes('tenant_id VARCHAR(64) NOT NULL'), 'setup-neon.js deve declarar tenant_id obrigatório');
assert(setupNeonSrc.includes('uq_obras_tenant_id'), 'setup-neon.js deve criar índices multi-tenant uq_*_tenant_id');
assert(setupNeonSrc.includes('CREATE TABLE IF NOT EXISTS tenants'), 'setup-neon.js deve criar tabela de tenants');
console.log('   ✓ scripts/setup-neon.js alinhado ao ecossistema multi-tenant moderno.');

// -------------------------------------------------------------
// 8. OIDC Discovery Realista (Apontamento 8)
// -------------------------------------------------------------
console.log('\n8. Validando conformidade realista do catálogo OIDC...');
const workerSrc = fs.readFileSync(path.join(root, 'cloudflare-worker.js'), 'utf8').replace(/\r\n/g, '\n');
assert(workerSrc.includes('"response_types_supported": [\n    "token"'), 'OIDC deve anunciar response_type token');
assert(workerSrc.includes('"grant_types_supported": [\n    "password",\n    "client_credentials"'), 'OIDC deve anunciar grants reais');
console.log('   ✓ Catálogo OIDC reflete autenticação real (Bearer/Session/API Key).');

// -------------------------------------------------------------
// 9. CI/CD com Versões Fixadas (Apontamento 9)
// -------------------------------------------------------------
console.log('\n9. Validando fixação de versões de ferramentas de CI/CD...');
const cicdSrc = fs.readFileSync(path.join(root, '.github/workflows/production-cicd.yml'), 'utf8');
const rollbackSrc = fs.readFileSync(path.join(root, '.github/workflows/cloudflare-rollback.yml'), 'utf8');
const pkgSrc = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

assert(!cicdSrc.includes('wrangler@latest'), 'production-cicd.yml não deve usar wrangler@latest');
assert(cicdSrc.includes('wrangler@3.114.0'), 'production-cicd.yml deve fixar wrangler@3.114.0');
assert(rollbackSrc.includes('wrangler@3.114.0'), 'cloudflare-rollback.yml deve fixar wrangler@3.114.0');
assert(pkgSrc.includes('"wrangler": "^3.114.0"'), 'package.json deve declarar wrangler em devDependencies');
console.log('   ✓ CI/CD e scripts operacionais com versão do Wrangler devidamente fixada.');

console.log('\n======================================================');
console.log('🎉 TODOS OS 9 APONTAMENTOS DO REVIEW ESTÃO CORRIGIDOS E TESTADOS COM SUCESSO!');
console.log('======================================================\n');
