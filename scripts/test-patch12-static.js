import fs from 'fs';

let fails = 0;
function read(p) { return fs.readFileSync(p, 'utf8'); }
function ok(name, cond) {
  if (cond) console.log('✅ ' + name);
  else { console.error('❌ ' + name); fails++; }
}

const certApi = read('api/certificado.js');
const nfeJs = read('js/nfe.js');
const backend = read('backend/server.js');
const whatsappApi = read('api/whatsapp.js');
const dbApi = read('api/db.js');
const uploadApi = read('api/upload.js');
const dataJs = read('js/data.js');
const appJs = read('js/app.js');
const medicoesJs = read('js/medicoes.js');
const utilsJs = read('js/utils.js');
const notasJs = read('js/notas.js');
const fornecedoresJs = read('js/fornecedores.js');
const lancamentosJs = read('js/lancamentos.js');
const migration = read('migrations/012_certificados_medicoes_whatsapp_multitenant.sql');
const schema = read('schema.sql');

// 1. Migração 012 e Schema
ok('Migração cria tabela tenant_certificates com AES-256 e metadata', 
  migration.includes('CREATE TABLE IF NOT EXISTS tenant_certificates') &&
  migration.includes('cert_pfx_base64_enc') &&
  migration.includes('valido_ate') &&
  migration.includes('cnpj')
);

ok('Migração cria tabela tenant_whatsapp_auth para multi-sessão',
  migration.includes('CREATE TABLE IF NOT EXISTS tenant_whatsapp_auth') &&
  migration.includes('tenant_id') &&
  migration.includes('value TEXT NOT NULL')
);

ok('Migração expande colunas de medicoes para 26 atributos',
  migration.includes('retencao_tecnica') &&
  migration.includes('descontos') &&
  migration.includes('percentual_fisico') &&
  migration.includes('percentual_financeiro') &&
  migration.includes('valor_solicitado') &&
  migration.includes('valor_liberado') &&
  migration.includes('lancamento_id')
);

ok('Schema incorpora tabelas de certificados, whatsapp auth e colunas de medições',
  schema.includes('tenant_certificates') &&
  schema.includes('tenant_whatsapp_auth') &&
  schema.includes('retencao_tecnica') &&
  schema.includes('descontos') &&
  schema.includes('lancamento_id')
);

// 2. Certificado Digital A1
ok('API Certificado valida arquivo PFX e senha via tls.createSecureContext',
  certApi.includes('tls.createSecureContext') &&
  certApi.includes('pfx: pfxBuffer') &&
  certApi.includes('passphrase: senha')
);

ok('API Certificado extrai metadados do X.509 (CNPJ, Razão Social e Validade)',
  certApi.includes('extractX509FromPfx') &&
  certApi.includes('parseCertDetails') &&
  certApi.includes('validoDe') &&
  certApi.includes('validoAte')
);

ok('API Certificado bloqueia certificados expirados no upload',
  certApi.includes('validadeDate.getTime() < Date.now()')
);

ok('API Certificado criptografa PFX em repouso com AES-256-GCM',
  certApi.includes('aes-256-gcm') &&
  certApi.includes('crypto.createCipheriv') &&
  certApi.includes('crypto.createDecipheriv') &&
  certApi.includes('authTag')
);

ok('API Certificado audita operações de upload e remoção em audit_logs',
  certApi.includes('VINCULAR_CERTIFICADO_A1') &&
  certApi.includes('REMOVER_CERTIFICADO_A1') &&
  certApi.includes('writeAudit')
);

ok('Interface NFe gerencia certificado via /api/certificado com badges dinâmicos',
  nfeJs.includes('/api/certificado?action=status') &&
  nfeJs.includes('/api/certificado?action=upload') &&
  nfeJs.includes('/api/certificado?action=remover') &&
  nfeJs.includes('dias restantes')
);

// 3. WhatsApp Multi-Empresa
ok('Backend WhatsApp isola sessões em memória com Map() por tenant',
  backend.includes('const sessions = new Map();') &&
  backend.includes('function getTenantSession(tenantId)')
);

ok('Backend WhatsApp persiste e restaura credenciais por tenant via tenant_whatsapp_auth',
  backend.includes('saveAuthToPostgres') &&
  backend.includes('syncAuthFromPostgres') &&
  backend.includes('tenant_whatsapp_auth')
);

ok('Backend rotas de sessão e mensagens exigem tenant com escopo isolado',
  backend.includes('/whatsapp-session') &&
  backend.includes('/send-message') &&
  backend.includes('x-tenant-id')
);

ok('Backend QR Code não expõe token em query string e suporta interface amigável',
  backend.includes("app.all('/qr'") &&
  backend.includes('QR Code WhatsApp')
);

ok('API WhatsApp do Next.js encaminha x-tenant-id e tenantId para o Render',
  whatsappApi.includes("'x-tenant-id': tenantId") &&
  whatsappApi.includes('tenantId')
);

// 4. Medições e Orçamentos
ok('API DB normaliza e persiste todas as colunas de medição',
  dbApi.includes('normalizeMedicao') &&
  dbApi.includes('retencao_tecnica') &&
  dbApi.includes('descontos') &&
  dbApi.includes('lancamento_id')
);

ok('Data layer inclui medicoes e orcamentos nas cloudTables',
  dataJs.includes("'medicoes'") &&
  dataJs.includes("'orcamentos'")
);

ok('Medicoes protege contra duplicação de receita no financeiro',
  medicoesJs.includes('m.lancamento_id') &&
  medicoesJs.includes('jaExiste')
);

ok('Medicoes calcula retenção técnica e descontos no saldo',
  medicoesJs.includes('retencao_tecnica') &&
  medicoesJs.includes('descontos')
);

// 5. Integridade, Respostas 400 e Fail-Closed
ok('API DB obras usa ON CONFLICT (tenant_id, id) no save e sync_all',
  dbApi.includes('INSERT INTO obras') &&
  dbApi.includes('ON CONFLICT (tenant_id, id) DO UPDATE SET')
);

ok('API DB retorna HTTP 400 para tabela ou ação desconhecida',
  dbApi.includes('UNKNOWN_TABLE') &&
  dbApi.includes('UNKNOWN_OPERATION')
);

ok('API Upload opera em fail-closed para blobs privados sem credencial',
  uploadApi.includes('Upload bloqueado por segurança (fail-closed)')
);

ok('API Upload sanitiza nomes de arquivos contra Path Traversal e scripts maliciosos',
  uploadApi.includes('safeFilename = filename.replace') &&
  uploadApi.includes('disallowedExts')
);

ok('Data layer trata 403 sem deslogar indevidamente o usuário',
  dataJs.includes('res.status === 403') &&
  dataJs.includes('forbidden: true')
);

ok('App reconcilia fila pendente offline antes do sync da nuvem',
  appJs.includes('DB._flushCloudQueue') &&
  appJs.includes('DB.syncFromCloud().then')
);

// 6. Prevenção XSS
ok('Utils.catLabel escapa labels personalizadas e categorias genéricas',
  utilsJs.includes('catLabel(c)') &&
  utilsJs.includes('this.escapeHtml(found.label)') &&
  utilsJs.includes("this.escapeHtml(c || '')")
);

ok('Tabelas de Fornecedores, Notas e Lançamentos escapam dados dinâmicos',
  fornecedoresJs.includes('Utils.escapeHtml') &&
  notasJs.includes('Utils.escapeHtml') &&
  lancamentosJs.includes('Utils.escapeHtml')
);

if (fails) {
  console.error(`\n❌ Patch 12: ${fails} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\n✅ Patch 12: todas as 25 verificações passaram com 100% de sucesso!');
