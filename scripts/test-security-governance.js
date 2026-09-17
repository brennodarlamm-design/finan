// scripts/test-security-governance.js — Suíte de Governança e Invariantes de Segurança (FinObra)
// Skill: finobra-security-orchestrator
import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🛡️  Iniciando Suíte de Governança e Invariantes de Segurança FinObra...\n');

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

// ── 1. VERIFICAÇÃO DO PACOTE DE SKILLS CYBERSECURITY (15 SKILLS) ────────────
console.log('1. Verificando presença e integridade das 15 Skills do FinObra Skill Pack...');
const expectedSkills = [
  'finobra-security-orchestrator',
  'threat-modeling',
  'secrets-exposure-audit',
  'secure-code-review',
  'api-security-review',
  'auth-iam-review',
  'postgres-rls-security',
  'dependency-supply-chain-audit',
  'web-app-security-review',
  'vercel-deployment-security',
  'render-deployment-security',
  'cloudflare-edge-security',
  'infrastructure-container-security',
  'agent-mcp-security-review',
  'authorized-web-pentest'
];

for (const skill of expectedSkills) {
  const skillFile = path.join(root, '.agents', 'skills', skill, 'SKILL.md');
  assert(fs.existsSync(skillFile), `Skill ${skill} deve conter SKILL.md em .agents/skills/${skill}/`);
  const content = fs.readFileSync(skillFile, 'utf8');
  assert(content.includes('---') && content.includes(`name: ${skill}`), `SKILL.md de ${skill} deve possuir frontmatter YAML válido.`);
}
console.log(`  ✓ Todas as ${expectedSkills.length} skills do pacote foram validadas com sucesso!\n`);

// ── 2. VERIFICAÇÃO DO LIMITE DE 12 SERVERLESS FUNCTIONS (VERCEL HOBBY) ───────
console.log('2. Verificando invariante do Limite de 12 Funções Vercel Hobby...');
const apiFiles = fs.readdirSync(path.join(root, 'api'))
  .filter(f => f.endsWith('.js') && !f.startsWith('_'));
assert(apiFiles.length <= 12, `Total de funções públicas em api/*.js (${apiFiles.length}) não pode ultrapassar 12.`);
console.log(`  ✓ Total de funções públicas em api/*.js: ${apiFiles.length}/12 (conforme).\n`);

// ── 3. FAIL-CLOSED RBAC (api/_permissions.js) ────────────────────────────────
console.log('3. Testando Fail-Closed RBAC em api/_permissions.js...');
import { canAccessTable, roleRule, normalizeRole } from '../api/_permissions.js';

const viewerAuth = { user: { perfil: 'visualizador' }, isSystem: false };
const adminAuth = { user: { perfil: 'admin' }, isSystem: false };
const systemAuth = { isSystem: true };

// Tabela não mapeada DEVE ser rejeitada por padrão
assert.strictEqual(canAccessTable(viewerAuth, 'tabela_inexistente_xyz', 'read'), false, 'Tabela não mapeada deve ser bloqueada para viewer.');
assert.strictEqual(canAccessTable(adminAuth, 'tabela_inexistente_xyz', 'read'), false, 'Tabela não mapeada deve ser bloqueada para admin.');
assert.strictEqual(canAccessTable(systemAuth, 'tabela_inexistente_xyz', 'read'), true, 'Chamadas com isSystem: true devem ter acesso liberado.');

// Visualizador não pode escrever ou deletar
assert.strictEqual(canAccessTable(viewerAuth, 'obras', 'write'), false, 'Visualizador não deve ter permissão de escrita.');
assert.strictEqual(canAccessTable(viewerAuth, 'obras', 'delete'), false, 'Visualizador não deve ter permissão de exclusão.');
console.log('  ✓ Regras de RBAC Fail-Closed validadas com sucesso!\n');

// ── 4. SEGREGAÇÃO ESTRITA DE SEGREDOS (api/_auth.js) ─────────────────────────
console.log('4. Verificando segregação de segredos (sem fallback para API_SECRET)...');
import { getSessionSigningSecret, getInternalApiSecret } from '../api/_auth.js';

// Salvar vars anteriores
const prevSession = process.env.SESSION_SIGNING_SECRET;
const prevInternal = process.env.INTERNAL_API_SECRET;
const prevApi = process.env.API_SECRET;

delete process.env.SESSION_SIGNING_SECRET;
delete process.env.INTERNAL_API_SECRET;
process.env.API_SECRET = 'compromised_global_secret';

// Não deve herdar de API_SECRET
assert.strictEqual(getSessionSigningSecret(), '', 'getSessionSigningSecret não deve usar API_SECRET como fallback.');
assert.strictEqual(getInternalApiSecret(), '', 'getInternalApiSecret não deve usar API_SECRET como fallback.');

// Confirmar ausência de resquícios de fallback legado nos módulos administrativos e de usuários
const adminRouteSrc = read('api/_admin-route.js');
assert(!adminRouteSrc.includes('process.env.API_SECRET || process.env.VERCEL_API_SECRET'), '_admin-route.js não deve fazer fallback para API_SECRET legado.');

const usersSrc = read('api/users.js');
assert(!usersSrc.includes('process.env.API_SECRET || process.env.VERCEL_API_SECRET'), 'users.js não deve fazer fallback para API_SECRET legado.');

// Restaurar
if (prevSession !== undefined) process.env.SESSION_SIGNING_SECRET = prevSession; else delete process.env.SESSION_SIGNING_SECRET;
if (prevInternal !== undefined) process.env.INTERNAL_API_SECRET = prevInternal; else delete process.env.INTERNAL_API_SECRET;
if (prevApi !== undefined) process.env.API_SECRET = prevApi; else delete process.env.API_SECRET;
console.log('  ✓ Segregação estrita de variáveis de autenticação confirmada!\n');

// ── 5. INTEGRIDADE DO WEBHOOK PIX & TIMING SAFETY (api/_webhook_pix_core.js & _webhook_pix.js) ─
console.log('5. Verificando integridade e proteção contra timing attacks no Webhook Pix...');
const pixCore = read('api/_webhook_pix_core.js');
assert(pixCore.includes('crypto.timingSafeEqual'), '_webhook_pix_core.js deve utilizar timingSafeEqual para comparar assinaturas.');
assert(pixCore.includes("req.headers?.['x-webhook-secret']"), 'Webhook Pix deve validar cabeçalho x-webhook-secret.');
assert(!pixCore.includes('req.query.secret'), 'Webhook Pix NÃO deve aceitar segredo na URL (query string).');
assert(!pixCore.includes('req.query.apiKey'), 'Webhook Pix NÃO deve aceitar apiKey na URL (query string).');
assert(pixCore.includes("invoice.status === 'paid'"), 'Liquidação Pix deve verificar idempotência para faturas já pagas.');

const pixEndpoint = read('api/_webhook_pix.js');
assert(pixEndpoint.includes('isWebhookAuthorized(req)'), '_webhook_pix.js deve validar autenticação primária via isWebhookAuthorized.');
assert(pixEndpoint.includes('superadmin'), '_webhook_pix.js deve permitir simulação restrita a perfil superadmin.');
console.log('  ✓ Webhook Pix validado com proteção timing-safe e autenticação autorizada!\n');

// ── 6. HARDENING DE UPLOADS E OCR (api/upload.js & api/reconhecer-documento.js)
console.log('6. Verificando validação binária de magic bytes e limites de upload/OCR...');
const uploadSrc = read('api/upload.js');
assert(uploadSrc.includes('magicHex.startsWith'), 'upload.js deve verificar magic bytes.');
assert(uploadSrc.includes('isExeOrScript'), 'upload.js deve bloquear executáveis e scripts.');

const ocrSrc = read('api/reconhecer-documento.js');
assert(ocrSrc.includes('10 * 1024 * 1024'), 'reconhecer-documento.js deve impor limite de tamanho (10MB).');
assert(ocrSrc.includes('ocr:tenant:'), 'reconhecer-documento.js deve ter rate limit por tenant.');
console.log('  ✓ Proteção de Upload e OCR validada com sucesso!\n');

// ── 7. PROTEÇÃO CONTRA VAZAMENTO DE ERROS INTERNOS (INFO LEAK) ───────────────
console.log('7. Verificando supressão de mensagens brutas de erro de banco e runtime...');
const dbSrc = read('api/db.js');
assert(!dbSrc.includes('error: err.message'), 'api/db.js não deve retornar err.message bruto ao cliente.');
assert(!dbSrc.includes('error: err.stack'), 'api/db.js não deve retornar err.stack ao cliente.');

const authSrc = read('api/auth.js');
assert(!authSrc.includes('detail: err.message'), 'api/auth.js não deve retornar detail: err.message ao cliente.');
console.log('  ✓ Supressão de mensagens de erro internas confirmada!\n');

// ── 8. CABEÇALHOS DE SEGURANÇA E CACHE PRIVADO (api/_http.js & vercel.json) ──
console.log('8. Verificando cabeçalhos de segurança e políticas de cache...');
const httpSrc = read('api/_http.js');
assert(httpSrc.includes('setPrivateNoCache'), '_http.js deve exportar setPrivateNoCache.');
assert(httpSrc.includes('private, no-cache, no-store, must-revalidate'), 'setPrivateNoCache deve emitir no-store e must-revalidate.');

const vercelJson = JSON.parse(read('vercel.json'));
const globalHeaders = vercelJson.headers?.find(h => h.source === '/(.*)')?.headers || [];
const cspHeader = globalHeaders.find(h => h.key === 'Content-Security-Policy');
const hstsHeader = globalHeaders.find(h => h.key === 'Strict-Transport-Security');
const xctoHeader = globalHeaders.find(h => h.key === 'X-Content-Type-Options');
const xfoHeader = globalHeaders.find(h => h.key === 'X-Frame-Options');

assert(cspHeader && cspHeader.value.includes("default-src 'self'"), 'CSP global deve definir default-src self.');
assert(hstsHeader && hstsHeader.value.includes('max-age='), 'HSTS deve estar configurado.');
assert(xctoHeader && xctoHeader.value === 'nosniff', 'X-Content-Type-Options deve ser nosniff.');
assert(xfoHeader && xfoHeader.value === 'SAMEORIGIN', 'X-Frame-Options deve ser SAMEORIGIN.');
console.log('  ✓ Cabeçalhos de segurança HTTP rigorosamente configurados!\n');

// ── 9. SEGURANÇA NO WORKER DE BACKGROUND (backend/server.js) ─────────────────
console.log('9. Verificando servidor Render e supressão de dados sensíveis...');
const serverSrc = read('backend/server.js');
assert(serverSrc.includes('/healthz'), 'backend/server.js deve implementar rota /healthz.');
assert(serverSrc.includes("msg.includes('Bad MAC')"), 'backend/server.js deve suprimir erros de socket/decifração de mensagens.');
console.log('  ✓ Hardening do serviço de background validado com sucesso!\n');

console.log('🎉 TODAS AS 9 DIMENSÕES DE GOVERNANÇA E SEGURANÇA PASSARAM COM SUCESSO!\n');
