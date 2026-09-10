import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf8');
let okCount = 0, failCount = 0;
function test(name, cond) {
  if (cond) { console.log('✅', name); okCount++; }
  else { console.error('❌', name); failCount++; }
}

const perms = read('api/_permissions.js');
const db = read('api/db.js');
const data = read('js/data.js');
const cfg = read('js/configuracoes.js');
const dashApi = read('api/dashboard.js');
const dashJs = read('js/dashboard.js');
const auditApi = read('api/audit.js');
const migration = read('migrations/004_core_records_cloud.sql');
const recibos = read('js/recibos.js');
const contratos = read('js/contratos.js');
const app = read('js/app.js');

const waApi = read('api/whatsapp.js');
const ocrApi = read('api/reconhecer-documento.js');
const usersApi = read('api/users.js');
const packager = read('scripts/criar-pacote-limpo.ps1');
const configJs = read('js/configuracoes.js');
const precomprasJs = read('js/precompras.js');

test('RBAC central define visualizador somente leitura', perms.includes("visualizador: Object.freeze({ read: true, write: false, delete: false"));
test('Operador não pode excluir no RBAC', perms.includes("operador: Object.freeze({ read: true, write: true, delete: false"));
test('API DB aplica permissão de escrita e exclusão', db.includes("canWriteData(auth)") && db.includes("canDeleteData(auth)"));
test('Fila não transforma ROLE_ em sessão expirada', data.includes("startsWith('ROLE_')") && data.includes('Operação rejeitada pelo perfil'));
test('Auditoria tem endpoint autenticado por tenant', auditApi.includes('FROM audit_logs') && auditApi.includes('a.tenant_id = ${auth.tenantId}') && auditApi.includes('canViewAudit(auth)'));
test('Configurações mostra auditoria somente para admin', cfg.includes("cfg-tab-auditoria") && cfg.includes("['admin','superadmin']"));
test('Dashboard possui snapshot server-side leve', dashApi.includes('FROM lancamentos') && dashApi.includes('LIMIT 10') && dashJs.includes("fetch('/api/dashboard'"));
test('Dashboard escapa descrição dos lançamentos', dashJs.includes("Utils.escapeHtml(l.descricao || '')"));
test('Migração cria Pré-Compras no Neon', migration.includes('CREATE TABLE IF NOT EXISTS precompras'));
test('Migração cria Contratos no Neon', migration.includes('CREATE TABLE IF NOT EXISTS contratos'));
test('Migração cria Recibos no Neon', migration.includes('CREATE TABLE IF NOT EXISTS recibos'));
test('API DB sincroniza as três coleções', db.includes("table === 'precompras'") && db.includes("table === 'contratos'") && db.includes("table === 'recibos'"));
test('Data layer pagina as três coleções', data.includes("_fetchCloudTablePaged('precompras')") && data.includes("_fetchCloudTablePaged('contratos')") && data.includes("_fetchCloudTablePaged('recibos')"));
test('Bootstrap local->nuvem ocorre antes da sincronização', data.includes('bootstrapCoreCloud()') && app.includes('DB.bootstrapCoreCloud ? DB.bootstrapCoreCloud()'));
test('Recibos salvam/excluem na nuvem', recibos.includes("DB.syncToCloud('save', 'recibos'") && recibos.includes("DB.syncToCloud('delete', 'recibos'"));
test('Contratos salvam/excluem na nuvem', contratos.includes("DB.syncToCloud('save', 'contratos'") && contratos.includes("DB.syncToCloud('delete', 'contratos'"));
test('Assinaturas respeitam perfil de escrita', read('api/assinaturas.js').includes('canWriteData(auth)'));
test('Upload respeita escrita/exclusão do perfil', read('api/upload.js').includes('canWriteData(auth)') && read('api/upload.js').includes('canDeleteData(auth)'));

test('OCR respeita perfil somente leitura', ocrApi.includes('canWriteData(auth)') && ocrApi.includes("permissionError('ROLE_READ_ONLY')"));
test('WhatsApp restringe envio e gestão da sessão por perfil', waApi.includes("action === 'send'") && waApi.includes('canWriteData(auth)') && waApi.includes('canManageTenant(auth)'));
test('Tenant não pode ficar sem administrador ativo', usersApi.includes("code:'LAST_ADMIN'") && usersApi.includes("perfil='admin' AND ativo=TRUE"));
test('Categorias personalizadas são escapadas antes do innerHTML', configJs.includes('this._esc(c.label') && configJs.includes('encodeURIComponent(safeValue)'));
test('Gerador de pacote limpo remove segredos também em subpastas', packager.includes("'config.json'") && packager.includes("'.git'") && packager.includes("'node_modules'") && packager.includes("'.pfx'"));

test('Migração legada protege cache se upload inicial falhar', data.includes('mergeLegacy') && data.includes('!coreBootstrapped && local.length'));
test('Migração legada evita payload gigante no bootstrap', data.includes('bulkBody.length <= 1_500_000') && data.includes('const concurrency = 4'));
test('Dashboard hidrata últimos lançamentos com snapshot do servidor', dashJs.includes('dashboard-recent-body') && dashJs.includes('Array.isArray(d.recent)'));
test('Pré-Compras escapa conteúdo persistente e respeita ações do perfil', precomprasJs.includes('const esc = v => Utils.escapeHtml') && precomprasJs.includes('canDelete') && precomprasJs.includes('decodeURIComponent'));

console.log(`\nPatch 05: ${okCount} passou, ${failCount} falhou.`);
if (failCount) process.exit(1);
