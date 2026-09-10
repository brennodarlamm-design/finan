import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf8');
let okCount = 0, failCount = 0;
function test(name, cond) {
  if (cond) { console.log('✅', name); okCount++; }
  else { console.error('❌', name); failCount++; }
}

const migration = read('migrations/006_cloud_completeness.sql');
const schema = read('schema.sql');
const dbApi = read('api/db.js');
const data = read('js/data.js');
const app = read('js/app.js');
const docs = read('js/documentos.js');
const ocr = read('js/ocr.js');
const sinapiOrc = read('js/orcamento_sinapi.js');
const fornecedores = read('js/fornecedores.js');
const escritorio = read('js/escritorio.js');
const whatsapp = read('js/whatsapp.js');
const utils = read('js/utils.js');
const suporte = read('js/suporte.js');
const adminApi = read('api/admin.js');

// Banco / API
test('Migração cria orçamentos SINAPI por tenant', migration.includes('CREATE TABLE IF NOT EXISTS orcamentos_sinapi') && migration.includes('PRIMARY KEY (tenant_id, id)'));
test('Migração cria fases documentais por tenant', migration.includes('CREATE TABLE IF NOT EXISTS obra_doc_fases') && migration.includes('PRIMARY KEY (tenant_id, id)'));
test('Migração cria preferências do tenant', migration.includes('CREATE TABLE IF NOT EXISTS tenant_preferences'));
test('Schema incorpora as tabelas do Patch 07', schema.includes('CREATE TABLE IF NOT EXISTS orcamentos_sinapi') && schema.includes('CREATE TABLE IF NOT EXISTS obra_doc_fases') && schema.includes('CREATE TABLE IF NOT EXISTS tenant_preferences'));
test('API inclui novas tabelas no snapshot e manifesto', dbApi.includes('orcamentos_sinapi') && dbApi.includes('doc_fases') && dbApi.includes('preferenciasRows'));
test('API permite leitura paginada de SINAPI e fases', dbApi.includes("table === 'orcamentos_sinapi'") && dbApi.includes("table === 'doc_fases'"));
test('API sanitiza preferências antes de persistir', dbApi.includes('sanitizeTenantPreferences') && dbApi.includes("whatsapp_modo"));
test('API valida obra do tenant em SINAPI/fases', dbApi.includes('validateObraTenant(sql, o.obra_id, tenantId)') && dbApi.includes('validateObraTenant(sql, d.obra_id, tenantId)'));

// Bootstrap / sync
test('App executa bootstrap complementar antes do sync', app.includes('bootstrapCloudCompleteness'));
test('Data layer migra SINAPI, fases e preferências', data.includes('bootstrapCloudCompleteness') && data.includes('orcamentos_sinapi') && data.includes('doc_fases') && data.includes('preferencias'));
test('Sync paginado inclui as novas tabelas', data.includes("_fetchCloudTablePaged('orcamentos_sinapi')") && data.includes("_fetchCloudTablePaged('doc_fases')"));
test('Fila de sync aceita novas tabelas', data.includes("'orcamentos_sinapi', 'doc_fases', 'preferencias'"));
test('Fila coalesce edições do mesmo registro', data.includes('Coalesce saves') && data.includes('_ackSyncQueueItem'));
test('Fila descarta 4xx permanentes sem loop infinito', data.includes('res.status >= 400 && res.status < 500') && data.includes('![408, 429].includes(res.status)'));

// Isolamento local
test('Documentos usam cache local por tenant', docs.includes('_storageKey()') && docs.includes("DB._ck(this._KEY)"));
test('Blobs locais/IndexedDB recebem namespace do tenant', docs.includes('_blobKey(id)') && docs.includes("`${tenant}:${id}`"));
test('Histórico OCR usa chave por tenant', ocr.includes('_historyKey()') && ocr.includes("DB._ck('finobra_ocr_historico')"));
test('Orçamentos SINAPI usam chave por tenant e sincronizam', sinapiOrc.includes('_storageKey()') && sinapiOrc.includes("DB.syncToCloud(action, 'orcamentos_sinapi'"));
test('Categorias de fornecedor são tenant-scoped e sincronizadas', fornecedores.includes('_catsStorageKey()') && fornecedores.includes('categorias_fornecedor'));
test('Categorias de escritório são tenant-scoped e sincronizadas', escritorio.includes('_catsStorageKey()') && escritorio.includes('categorias_despesa'));
test('Preferências WhatsApp são tenant-scoped', whatsapp.includes('_prefKey(name)') && whatsapp.includes('whatsapp_telefone') && whatsapp.includes('whatsapp_modo'));
test('Utils consulta categorias personalizadas no namespace do tenant', utils.includes("DB._ck(name)"));

// Hotfix do atendimento incluído no patch consolidado
test('Cliente vê atendente humano apenas como Suporte', suporte.includes("const title = isHuman ? 'Suporte' : 'FinBot'") && suporte.includes("isBot ? 'FinBot' : 'Suporte'"));
test('Backend grava novas respostas humanas como Suporte', adminApi.includes("${'Suporte'}") && adminApi.includes('Suporte entrou no atendimento.'));

console.log(`\nPatch 07: ${okCount} passou, ${failCount} falhou.`);
if (failCount) process.exit(1);
