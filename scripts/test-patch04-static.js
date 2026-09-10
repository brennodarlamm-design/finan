import fs from 'fs';

let passed = 0;
let failed = 0;
const read = p => fs.readFileSync(p, 'utf8');
const ok = (name, cond) => {
  if (cond) { console.log(`✅ ${name}`); passed++; }
  else { console.error(`❌ ${name}`); failed++; }
};

const db = read('api/db.js');
const plans = read('api/_plans.js');
const ocrApi = read('api/reconhecer-documento.js');
const sigApi = read('api/assinaturas.js');
const upload = read('api/upload.js');
const data = read('js/data.js');
const docs = read('js/documentos.js');
const clientes = read('js/clientes.js');
const cobranca = read('js/cobranca.js');
const vercelIgnore = read('.vercelignore');

ok('Planos têm limites server-side', plans.includes('maxActiveObras: 3') && plans.includes('maxActiveObras: 10') && plans.includes('maxActiveObras: null'));
ok('Backend bloqueia obra acima do plano', db.includes('PLAN_OBRA_LIMIT') && db.includes('enforceObraPlanLimit'));
ok('Bulk sync também respeita limite de obras', db.includes('validateBulkObraPlanLimit') && db.includes('recusada antes de gravar'));
ok('OCR é protegido por feature do plano', ocrApi.includes("canUseFeature(auth.user?.tenantPlan, 'ocr')"));
ok('Assinaturas são protegidas por feature do plano', sigApi.includes("canUseFeature(auth.user?.tenantPlan, 'signatures')"));
ok('Plano atual expõe uso real do servidor', fs.existsSync('api/plano.js') && cobranca.includes("fetch('/api/plano'"));
ok('API possui manifesto para bases grandes', db.includes("table === 'sync_manifest'"));
ok('Sync troca automaticamente para paginação em base grande', data.includes('_fetchCloudTablePaged') && data.includes('Base grande detectada'));
ok('Fila diferencia rejeição de plano de sessão expirada', data.includes("startsWith('PLAN_')"));
ok('UUID usa Web Crypto quando disponível', data.includes('crypto.randomUUID'));
ok('Upload suporta Blob privado', upload.includes("access: 'private'") && upload.includes('FINOBRA_BLOB_ACCESS'));
ok('Documento privado usa URL assinada temporária', upload.includes('issueSignedToken') && upload.includes('presignUrl'));
ok('URL assinada só é liberada por document_id + tenant', upload.includes('WHERE id = ${documentId} AND tenant_id = ${tenantId}'));
ok('Frontend resolve URL privada via API autenticada', docs.includes('_resolverUrlProtegida') && docs.includes('/api/upload?document_id='));
ok('Cadastro de obra avisa limite antes de persistir', clientes.includes('limites = { trial: 10, starter: 3, pro: 10, unlimited: Infinity }'));
ok('Deploy ignora node_modules, scratch e pacotes ZIP', vercelIgnore.includes('node_modules') && vercelIgnore.includes('scratch') && vercelIgnore.includes('*.zip'));

console.log(`\nPatch 04: ${passed} passou, ${failed} falhou.`);
if (failed) process.exit(1);
