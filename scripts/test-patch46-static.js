// scripts/test-patch46-static.js — Validação Estática do PATCH 46: Telemetria de Erros no Cliente e Dashboard de Observabilidade
import fs from 'fs';
import path from 'path';

let totalTests = 0;
let passedTests = 0;

function test(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ ${name}`);
  } else {
    console.error(`  ❌ ${name}`);
    if (details) console.error(`     Detalhes: ${details}`);
    process.exitCode = 1;
  }
}

console.log('🧪 Executando Testes Estáticos — PATCH 46: Telemetria de Erros e Observabilidade...\n');

const migrationPath = path.resolve('migrations/021_client_observability_metadata.sql');
const schemaPath = path.resolve('schema.sql');
const auditPath = path.resolve('api/audit.js');
const adminPath = path.resolve('api/admin.js');
const appJsPath = path.resolve('js/app.js');
const masterJsPath = path.resolve('js/master.js');
const patch26EventsPath = path.resolve('js/patch26-events.js');

test('migrations/021_client_observability_metadata.sql existe', fs.existsSync(migrationPath));
test('schema.sql existe', fs.existsSync(schemaPath));
test('api/audit.js existe', fs.existsSync(auditPath));
test('api/admin.js existe', fs.existsSync(adminPath));
test('js/app.js existe', fs.existsSync(appJsPath));
test('js/master.js existe', fs.existsSync(masterJsPath));
test('js/patch26-events.js existe', fs.existsSync(patch26EventsPath));

const migrationCode = fs.readFileSync(migrationPath, 'utf8');
const schemaCode = fs.readFileSync(schemaPath, 'utf8');
const auditCode = fs.readFileSync(auditPath, 'utf8');
const adminCode = fs.readFileSync(adminPath, 'utf8');
const appJs = fs.readFileSync(appJsPath, 'utf8');
const masterJs = fs.readFileSync(masterJsPath, 'utf8');
const patch26Events = fs.readFileSync(patch26EventsPath, 'utf8');

// 1. Validação da Migração 021 e Schema
test('Migração 021 adiciona coluna metadata JSONB', migrationCode.includes('ADD COLUMN IF NOT EXISTS metadata JSONB'));
test('Migração 021 adiciona coluna status VARCHAR', migrationCode.includes('ADD COLUMN IF NOT EXISTS status VARCHAR'));
test('Migração 021 cria índice por status e created_at', migrationCode.includes('idx_client_error_logs_status_created'));
test('Migração 021 registra versão em schema_migrations', migrationCode.includes('021_client_observability_metadata.sql'));
test('schema.sql possui metadata JSONB em client_error_logs', schemaCode.includes('metadata JSONB DEFAULT'));
test('schema.sql possui status VARCHAR em client_error_logs', schemaCode.includes('status VARCHAR(20) DEFAULT'));

// 2. Validação da Ingestão de Telemetria em api/audit.js
test('api/audit.js aceita report de erro sem exigir autenticação prévia', auditCode.includes("action === 'client_error'") && auditCode.includes('auth.authenticated ? auth.tenantId : null'));
test('api/audit.js aplica rate-limit por IP para requisições anônimas', auditCode.includes('client-error:anon:'));
test('api/audit.js estrutura e sanitiza breadcrumbs', auditCode.includes('breadcrumbs') && auditCode.includes('slice(-10)'));
test('api/audit.js persiste metadata JSONB em client_error_logs', auditCode.includes('${JSON.stringify(metadata)}::jsonb'));

// 3. Validação do Dashboard Master em api/admin.js
test('api/admin.js seleciona metadata e status em client_errors', adminCode.includes('e.metadata, e.status'));
test('api/admin.js calcula métricas de resumo incluindo anonymous_24h', adminCode.includes('anonymous_24h'));
test('api/admin.js agrupa top_routes com mais incidentes', adminCode.includes('topRoutes') && adminCode.includes('GROUP BY route'));
test('api/admin.js gera clusters de erro agrupados por assinatura', adminCode.includes('cluster_id') && adminCode.includes('affected_tenants'));
test('api/admin.js implementa ação de limpeza clear_old_client_errors', adminCode.includes("action === 'clear_old_client_errors'"));

// 4. Validação da Coleta no Cliente em js/app.js
test('js/app.js possui anel de breadcrumbs inicializado', appJs.includes('_breadcrumbs: []'));
test('js/app.js implementa método addBreadcrumb', appJs.includes('addBreadcrumb(type, target, details)'));
test('js/app.js captura cliques do usuário como breadcrumbs', appJs.includes("this.addBreadcrumb('click'"));
test('js/app.js registra navegação de rotas nos breadcrumbs', appJs.includes("this.addBreadcrumb('navigation'"));
test('js/app.js envia viewport e breadcrumbs na telemetria', appJs.includes('breadcrumbs:') && appJs.includes('viewport:'));

// 5. Validação da Interface e Replay em js/master.js
test('js/master.js armazena top_routes e clusters em carregarErrosSaaS', masterJs.includes('top_routes: Array.isArray(data.top_routes)') && masterJs.includes('clusters: Array.isArray(data.clusters)'));
test('js/master.js renderiza 4 cartões de telemetria no painel de observabilidade', masterJs.includes('Erros (24h)') && masterJs.includes('Volume (7 dias)') && masterJs.includes('Pré-Auth / Anônimos'));
test('js/master.js renderiza tabela de clusters e assinaturas de erro', masterJs.includes('Assinaturas Agrupadas de Erros') && masterJs.includes('clusterRows'));
test('js/master.js implementa método abrirDetalhesErro para replay de breadcrumbs', masterJs.includes('abrirDetalhesErro(errorId)') && masterJs.includes('Passos Anteriores à Falha (Replay)'));
test('js/master.js implementa método fecharDetalhesErro', masterJs.includes('fecharDetalhesErro()'));
test('js/master.js implementa método limparErrosAntigos', masterJs.includes('async limparErrosAntigos()'));

// 6. Validação de Segurança e CSP em js/patch26-events.js
test('js/patch26-events.js inclui MasterAdmin.abrirDetalhesErro na allowlist', patch26Events.includes('"MasterAdmin.abrirDetalhesErro"'));
test('js/patch26-events.js inclui MasterAdmin.fecharDetalhesErro na allowlist', patch26Events.includes('"MasterAdmin.fecharDetalhesErro"'));
test('js/patch26-events.js inclui MasterAdmin.limparErrosAntigos na allowlist', patch26Events.includes('"MasterAdmin.limparErrosAntigos"'));

// 7. Conformidade Vercel Hobby Limit (<= 12 serverless functions)
const apiFiles = fs.readdirSync(path.resolve('api')).filter(f => f.endsWith('.js') && !f.startsWith('_'));
test(`Total de Serverless Functions em api/*.js <= 12 (Atual: ${apiFiles.length})`, apiFiles.length <= 12, `Arquivos: ${apiFiles.join(', ')}`);

console.log(`\n📊 Resultado dos Testes do PATCH 46: ${passedTests}/${totalTests} passaram.`);
if (passedTests === totalTests) {
  console.log('✨ Todos os testes estáticos do PATCH 46 foram aprovados com sucesso!\n');
} else {
  console.error(`❌ ${totalTests - passedTests} teste(s) falharam.\n`);
  process.exit(1);
}
