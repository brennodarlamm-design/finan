import assert from 'node:assert/strict';
import fs from 'fs';

function read(p){ return fs.readFileSync(p,'utf8'); }
const triggerClient = fs.readFileSync(new URL('../api/_trigger-client.js', import.meta.url), 'utf8');
assert(triggerClient.includes('withDeadline(tasks.trigger'), 'Trigger.dev SDK deve ter deadline explícito.');
const workerSource = fs.readFileSync(new URL('../cloudflare-worker.js', import.meta.url), 'utf8');
assert(workerSource.includes("Telemetria operacional fica restrita a superadmin autenticado"), 'Painel de métricas Edge deve exigir superadmin.');
assert(workerSource.includes("identity.role !== 'superadmin'"), 'Métricas Edge devem validar role superadmin.');
assert(workerSource.includes('FINOBRA_UPSTREAM_TIMEOUT_MS || 20000'), 'Proxy Edge deve limitar espera da API upstream.');
assert(workerSource.includes('AbortSignal.timeout(5000)'), 'Keep-alive Render deve ter timeout explícito.');


assert(triggerClient.includes('AbortSignal.timeout(Number(options.timeoutMs || 8000))'), 'Fallback REST do Trigger.dev deve ter timeout explícito.');

const databaseBoundary = read('api/_database.js');
const tenantSqlBoundary = read('api/_tenant-sql.js');
const authDbBoundary = read('api/_auth.js');
const adminDbBoundary = read('api/_admin-route.js');
const webhookDbBoundary = read('api/_webhook_pix.js');
assert(databaseBoundary.includes("DATABASE_URL não pode usar role owner/BYPASSRLS"), 'Runtime deve rejeitar DATABASE_URL com role owner.');
assert(databaseBoundary.includes("DATABASE_OWNER_URL não configurada"), 'Acesso privilegiado deve exigir DATABASE_OWNER_URL dedicado.');
assert(!tenantSqlBoundary.includes("set_config('app.is_system'"), 'Wrapper RLS tenant não pode manter bypass app.is_system.');
assert(!authDbBoundary.includes('DATABASE_OWNER_URL || process.env.DATABASE_URL'), 'Auth privilegiado não pode cair para DATABASE_URL.');
assert(!adminDbBoundary.includes('DATABASE_OWNER_URL || process.env.DATABASE_URL'), 'Admin privilegiado não pode cair para DATABASE_URL.');
assert(!webhookDbBoundary.includes('DATABASE_OWNER_URL || process.env.DATABASE_URL'), 'Webhook de pagamento não pode cair para DATABASE_URL.');

function ok(name, condition){
  if(!condition){ console.error('❌ '+name); process.exitCode=1; }
  else console.log('✅ '+name);
}

const wrangler=read('wrangler.jsonc');
const r2=read('api/_edge-r2.js');
const routes=read('api/_v2-routes.js');
const upload=read('api/upload.js');
const plano=read('api/plano.js');
const auth=read('api/_auth.js');
const authApi=read('api/auth.js');
const cobranca=read('js/cobranca.js');
const app=read('js/app.js');
const landing=read('landing.html');
const backup=read('.github/workflows/database-backup.yml');
const rollback=read('.github/workflows/cloudflare-rollback.yml');

ok('Wrangler declara binding ATTACHMENTS_R2 persistente', wrangler.includes('"binding": "ATTACHMENTS_R2"') && wrangler.includes('"bucket_name": "fingo-attachments"'));
ok('R2 falha fechado fora de testes quando binding está ausente', r2.includes('Binding ATTACHMENTS_R2 indisponível') && r2.includes('FINOBRA_ALLOW_MEMORY_STORAGE'));
ok('Rotas R2 exigem autenticação e isolamento de tenant', routes.includes('resolveAuthAndTenant(req)') && routes.includes("canAccessModule(auth, 'documentos'") && routes.includes('expectedPrefix'));
ok('Upload principal grava em R2 quando binding existe', upload.includes('r2Ready') && upload.includes("storage: 'cloudflare_r2'") && upload.includes('r2://'));
ok('Vercel Blob ficou apenas como compatibilidade legada', upload.includes("storage: 'vercel_blob_legacy'"));
ok('Cancelamento self-service existe no backend', plano.includes("action === 'cancel_subscription'") && plano.includes("status='cancelamento_agendado'"));
ok('Cancelamento encerra acesso ao fim do período', auth.includes("tenant_status === 'cancelamento_agendado'") && authApi.includes("tenant_status === 'cancelamento_agendado'"));
ok('Conta expõe ação de cancelamento', cobranca.includes('cancelarAssinatura()') && cobranca.includes('Cancelar renovação'));
ok('Recuperação de senha usa timeout em canais externos', (authApi.match(/AbortSignal\.timeout\(10000\)/g)||[]).length >= 2);
ok('Telemetria não envia query string/hash', app.includes('window.location.origin') && app.includes('window.location.pathname') && !app.includes('url: window.location.href'));
ok('Landing não promete mais provisionamento instantâneo', landing.includes('A solicitação leva menos de 1 minuto') && !landing.includes('Você cria sua conta em menos de 1 minuto'));
ok('Landing possui foco visível por teclado', landing.includes(':focus-visible') && landing.includes('outline: 3px solid var(--accent-mint-bright)'));
ok('Landing evita overflow do cabeçalho e calculadora em telas estreitas', landing.includes('.header-cta-group > .btn { display: none; }') && landing.includes('.calc-controls,') && landing.includes('min-width: 0;') && landing.includes('width: calc(100% - 20px)'));
ok('Menu mobile preserva login e solicitação de teste', landing.includes('<a href="/login">Entrar no Sistema</a>') && landing.includes('<a href="/cadastro">Solicitar Teste de 15 Dias</a>'));
ok('Imagens principais da landing têm dimensões explícitas', (landing.match(/<img\b[^>]*\bwidth="\d+"[^>]*\bheight="\d+"/g)||[]).length >= 4);
ok('Controles mobile principais têm alvo mínimo de 44px', landing.includes('min-height: 44px') && landing.includes('.mobile-menu-summary'));
ok('Backup lógico diário está versionado e cifrado antes do artifact', backup.includes("cron: '20 7 * * *'") && backup.includes('pg_dump') && backup.includes('BACKUP_ENCRYPTION_PASSPHRASE') && backup.includes('openssl enc -aes-256-cbc') && backup.includes("backup/*.enc") && backup.includes('retention-days: 30'));
ok('Rollback Cloudflare está versionado', rollback.includes('wrangler rollback') && rollback.includes('/__finobra/health'));
const edgeBackup=read('api/_edge-backup.js');
const edgeAlerts=read('api/_edge-alerts.js');
const worker=read('cloudflare-worker.js');
ok('Worker mantém snapshot diário dos dados críticos no R2', edgeBackup.includes('neon-critical') && edgeBackup.includes('CRITICAL_TABLES') && worker.includes('createCriticalR2Backup'));
ok('Migração de documentos legados só troca URL após validar R2', edgeBackup.includes('migrateLegacyDocumentsToR2') && edgeBackup.includes('getR2Object') && edgeBackup.includes("migratedFrom: 'vercel_blob'") && worker.includes('migrateLegacyDocumentsToR2'));
ok('Alertas Edge críticos fazem envio real com timeout', edgeAlerts.includes('/send-message') && edgeAlerts.includes('AbortSignal.timeout(8000)'));
ok('Falhas 5xx geram alerta operacional', worker.includes("type: 'EDGE_HTTP_5XX'"));
ok('Pagamento confirmado recupera UI quando refresh de sessão falha', cobranca.includes('sessionRefreshed') && cobranca.includes('window.location.reload()'));
ok('Falha de sincronização de rota é mostrada ao usuário', app.includes('Dados locais exibidos. A sincronização com a nuvem falhou'));

const authClient=read('js/auth.js');
ok('Auth crítico usa timeout no navegador', authClient.includes('async _fetchWithTimeout(') && authClient.includes("this._fetchWithTimeout('/api/auth?action=login'") && authClient.includes("this._fetchWithTimeout('/api/auth?action=mfa_verify'") && authClient.includes("this._fetchWithTimeout('/api/auth?action=request_reset'") && authClient.includes("this._fetchWithTimeout('/api/auth?action=verify_reset'") && authClient.includes("this._fetchWithTimeout('/api/auth?action=register'") && authClient.includes("this._fetchWithTimeout('/api/auth?action=sessions'") && authClient.includes("this._fetchWithTimeout('/api/auth?action=revoke_session'") && authClient.includes("this._fetchWithTimeout('/api/admin?action=restore_master_session'"));

const billingClient=read('js/cobranca.js');
ok('Cobrança crítica usa timeout no navegador', billingClient.includes('async _fetchWithTimeout(') && billingClient.includes("this._fetchWithTimeout('/api/plano?action=cancel_subscription'") && billingClient.includes("this._fetchWithTimeout('/api/plano?action=create_invoice'") && billingClient.includes('check_invoice&invoiceId'));

const dataClient=read('js/data.js');
ok('Sincronização DB usa timeout no navegador', dataClient.includes('async _fetchWithTimeout(') && dataClient.includes('timeoutMs = 25000') && (dataClient.match(/this\._fetchWithTimeout\(/g)||[]).length >= 16);


const whatsappClient=read('js/whatsapp.js');
ok('WhatsApp crítico usa timeout no navegador', whatsappClient.includes('async _fetchWithTimeout(') && whatsappClient.includes('timeoutMs = 18000') && (whatsappClient.match(/this\._fetchWithTimeout\(/g)||[]).length >= 8);

const nfeClient=read('js/nfe.js');
ok('NF-e e certificado usam timeout no navegador', nfeClient.includes('async _fetchWithTimeout(') && nfeClient.includes('timeoutMs = 25000') && nfeClient.includes("this._fetchWithTimeout('/api/certificado?action=status'") && nfeClient.includes("this._fetchWithTimeout('/api/certificado?action=upload'") && nfeClient.includes("this._fetchWithTimeout('/api/certificado?action=remover'") && (nfeClient.match(/this\._fetchWithTimeout\(/g)||[]).length >= 10);

const ocrClient=read('js/ocr.js');
ok('OCR usa timeout no navegador', ocrClient.includes('async _fetchWithTimeout(') && ocrClient.includes('timeoutMs = 65000') && ocrClient.includes("this._fetchWithTimeout('/api/reconhecer-documento'") && ocrClient.includes("this._fetchWithTimeout('/api/db?table=ocr_historico'"));


const versionGuardClient=read('js/version_guard.js');
ok('Release guard usa timeout no navegador', versionGuardClient.includes('timeoutMs = 8000') && (versionGuardClient.match(/await fetchWithTimeout\(/g)||[]).length >= 2 && !/await fetch\(['"`]\/api/.test(versionGuardClient));

const devKeysClient=read('js/dev-tenant-keys.js');
ok('Cofre DEV usa timeout no navegador', devKeysClient.includes('timeoutMs = 15000') && (devKeysClient.match(/await fetchWithTimeout\(/g)||[]).length >= 3 && !/await fetch\(['"`]\/api/.test(devKeysClient));

const configuracoesClient=read('js/configuracoes.js');
ok('Configurações usam timeout no navegador', configuracoesClient.includes('timeoutMs = 20000') && (configuracoesClient.match(/this\._fetchWithTimeout\(/g)||[]).length >= 8 && !/await fetch\(['"`]\/api/.test(configuracoesClient));

const masterClient=read('js/master.js');
ok('Painel Master usa timeout no navegador', masterClient.includes('timeoutMs = 20000') && (masterClient.match(/this\._fetchWithTimeout\(/g)||[]).length >= 17 && !/await fetch\(['"`]\/api/.test(masterClient));


const documentosClient=read('js/documentos.js');
ok('Documentos têm deadlines no navegador', (documentosClient.match(/AbortSignal\.timeout\(90000\)/g)||[]).length >= 2 && (documentosClient.match(/AbortSignal\.timeout\(20000\)/g)||[]).length >= 3);

const assinadorClient=read('js/assinador.js');
ok('Registro de assinatura tem deadline no navegador', assinadorClient.includes('AbortSignal.timeout(30000)'));

const dashboardClient=read('js/dashboard.js');
ok('Dashboard tem deadline no navegador', dashboardClient.includes("fetch('/api/dashboard' + q") && dashboardClient.includes('AbortSignal.timeout(20000)'));

const utilsClient=read('js/utils.js');
const fornecedoresClient=read('js/fornecedores.js');
ok('Consultas CEP/CNPJ têm deadline no navegador', utilsClient.includes('AbortSignal.timeout(10000)') && fornecedoresClient.includes('AbortSignal.timeout(10000)'));

const appClient=read('js/app.js');
ok('Onboarding e telemetria têm deadlines no navegador', appClient.includes('AbortSignal.timeout(5000)') && appClient.includes('AbortSignal.timeout(10000)'));

const validarClient=read('js/validar_page.js');
const workflowClient=read('js/patch51.js');
const suporteClient=read('js/suporte_dev.js');
ok('Validação pública, workflow e suporte têm deadlines', validarClient.includes('AbortSignal.timeout(15000)') && (workflowClient.match(/AbortSignal\.timeout\(20000\)/g)||[]).length >= 2 && suporteClient.includes('AbortSignal.timeout(20000)'));

const loginPageClient=read('js/login_page.js');
const masterPageClient=read('js/master_page.js');
const contasClient=read('js/contas.js');
ok('Solicitação comercial, gate Master e contas têm deadlines', loginPageClient.includes("Auth._fetchWithTimeout('/api/auth?action=register'") && masterPageClient.includes("Auth._fetchWithTimeout('/api/auth?action=me'") && contasClient.includes('AbortSignal.timeout(20000)'));

if(process.exitCode) process.exit(process.exitCode);
console.log('\n✅ Hardening pré-lançamento protegido por regressão estática.');
