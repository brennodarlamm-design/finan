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

const emailTask=read('trigger/email.js');
ok('Resend transacional usa deadline explícito', emailTask.includes('RESEND_REQUEST_TIMEOUT_MS = 15000') && emailTask.includes('AbortSignal.timeout(RESEND_REQUEST_TIMEOUT_MS)'));

const whatsappClient=read('js/whatsapp.js');
ok('WhatsApp crítico usa timeout no navegador',
  whatsappClient.includes('async _fetchWithTimeout(') &&
  (whatsappClient.match(/this\._fetchWithTimeout\(/g)||[]).length >= 8 &&
  whatsappClient.includes('return await fetch(url, { ...options, signal: controller.signal });') &&
  !whatsappClient.includes('return await this._fetchWithTimeout(url, { ...options, signal: controller.signal });'));

const nfeClient=read('js/nfe.js');
ok('NF-e e certificado usam timeout no navegador',
  nfeClient.includes('async _fetchWithTimeout(') &&
  (nfeClient.match(/this\._fetchWithTimeout\(/g)||[]).length >= 10 &&
  nfeClient.includes('return await fetch(url, { ...options, signal: controller.signal });') &&
  !nfeClient.includes('return await this._fetchWithTimeout(url, { ...options, signal: controller.signal });'));

const ocrClient=read('js/ocr.js');
ok('OCR usa timeout no navegador',
  ocrClient.includes('async _fetchWithTimeout(') &&
  (ocrClient.match(/this\._fetchWithTimeout\(/g)||[]).length >= 2 &&
  ocrClient.includes("this._fetchWithTimeout('/api/db?table=ocr_historico', { headers }, 15000)") &&
  ocrClient.includes('return await fetch(url, { ...options, signal: controller.signal });') &&
  !ocrClient.includes('return await this._fetchWithTimeout(url, { ...options, signal: controller.signal });'));

const documentosClient=read('js/documentos.js');
ok('Documentos críticos usam timeout no navegador',
  documentosClient.includes('async function documentosFetchWithTimeout(') &&
  (documentosClient.match(/documentosFetchWithTimeout\(/g)||[]).length >= 5 &&
  documentosClient.includes('return await fetch(url, { ...options, signal: controller.signal });'));

const masterClient=read('js/master.js');
ok('Painel master usa timeout no navegador',
  masterClient.includes('async function masterFetchWithTimeout(') &&
  (masterClient.match(/masterFetchWithTimeout\(/g)||[]).length >= 18 &&
  masterClient.includes('return await fetch(url, { ...options, signal: controller.signal });'));

const configuracoesClient=read('js/configuracoes.js');
ok('Configurações usam timeout no navegador',
  configuracoesClient.includes('async function configuracoesFetchWithTimeout(') &&
  (configuracoesClient.match(/configuracoesFetchWithTimeout\(/g)||[]).length >= 9 &&
  configuracoesClient.includes('return await fetch(url, { ...options, signal: controller.signal });'));

const assinadorClient=read('js/assinador.js');
const suporteClient=read('js/suporte.js');
const suporteDevClient=read('js/suporte_dev.js');
const masterPageClient=read('js/master_page.js');
const contasClient=read('js/contas.js');
ok('Assinatura e suporte usam deadlines explícitos',
  assinadorClient.includes('AbortSignal.timeout(20000)') &&
  suporteClient.includes('AbortSignal.timeout(15000)') &&
  suporteDevClient.includes('AbortSignal.timeout(15000)') &&
  masterPageClient.includes('AbortSignal.timeout(10000)') &&
  contasClient.includes('AbortSignal.timeout(15000)'));

const fornecedoresClient=read('js/fornecedores.js');
const sinapiClient=read('js/sinapi.js');
const devTenantKeysClient=read('js/dev-tenant-keys.js');
const versionGuardClient=read('js/version_guard.js');
const validarPageClient=read('js/validar_page.js');
ok('Consultas auxiliares e guards usam deadlines explícitos',
  fornecedoresClient.includes('AbortSignal.timeout(10000)') &&
  sinapiClient.includes('AbortSignal.timeout(20000)') &&
  (devTenantKeysClient.match(/AbortSignal\.timeout\(/g)||[]).length >= 3 &&
  (versionGuardClient.match(/AbortSignal\.timeout\(5000\)/g)||[]).length >= 2 &&
  validarPageClient.includes('AbortSignal.timeout(10000)'));

const utilsClient=read('js/utils.js');
const appClient=read('js/app.js');
const patch51Client=read('js/patch51.js');
const loginPageClient=read('js/login_page.js');
const dashboardClient=read('js/dashboard.js');
const bimImporterClient=read('js/bim_geometry_importer.js');
ok('App principal e BIM usam deadlines explícitos',
  utilsClient.includes('AbortSignal.timeout(10000)') &&
  appClient.includes('AbortSignal.timeout(10000)') &&
  (patch51Client.match(/AbortSignal\.timeout\(15000\)/g)||[]).length >= 2 &&
  loginPageClient.includes('AbortSignal.timeout(15000)') &&
  dashboardClient.includes('AbortSignal.timeout(15000)') &&
  bimImporterClient.includes('AbortSignal.timeout(45000)'));

const maintenanceTask=read('trigger/maintenance.js');
const billingTask=read('trigger/billing.js');
ok('Trigger maintenance e billing usam deadlines explícitos',
  maintenanceTask.includes('AbortSignal.timeout(15000)') &&
  maintenanceTask.includes('AbortSignal.timeout(8000)') &&
  billingTask.includes('AbortSignal.timeout(15000)'));

const backendServer=read('backend/server.js');
const serviceWorker=read('sw.js');
const pagesProxy=read('functions/api/[[path]].js');
const renderDeploy=read('scripts/render-deploy.js');
const legacyCleanup=read('scripts/clean-old-deployments.js');
ok('Proxy, service worker e Render usam deadlines explícitos',
  backendServer.includes('AbortSignal.timeout(15000)') &&
  backendServer.includes('AbortSignal.timeout(8000)') &&
  serviceWorker.includes('AbortSignal.timeout(12000)') &&
  serviceWorker.includes('AbortSignal.timeout(15000)') &&
  pagesProxy.includes('FINOBRA_UPSTREAM_TIMEOUT_MS || 20000') &&
  pagesProxy.includes('timedOut ? 504 : 502') &&
  renderDeploy.includes('AbortSignal.timeout(15000)') &&
  (legacyCleanup.match(/AbortSignal\.timeout\(15000\)/g)||[]).length >= 2);

const landingClient=read('js/landing_page.js');
const documentosClient2=read('js/documentos.js');
ok('Fluxos auxiliares do navegador não podem ficar pendurados ou confirmar sucesso prematuro',
  (landingClient.match(/AbortSignal\.timeout\(8000\)/g)||[]).length >= 2 &&
  landingClient.includes('if (!subscribeRes.ok || subscribeData.success === false)') &&
  landingClient.includes('if (!unsubscribeRes.ok || unsubscribeData.success === false)') &&
  documentosClient2.includes('signal: AbortSignal.timeout(8000)') &&
  documentosClient2.includes("console.warn('[Documentos] Exclusão do blob legado falhou:") &&
  appClient.includes('signal: AbortSignal.timeout(5000)') &&
  authClient.includes("keepalive:true, signal:AbortSignal.timeout(5000)"));

const vercelConfig=JSON.parse(read('vercel.json'));
const newsletterMigration=read('migrations/033_newsletter_subscriptions.sql');
const edgeV2Source=read('api/_v2-routes.js');
const productionWorkflow=read('.github/workflows/production-cicd.yml');

ok('Vercel legado não cria novos deploys Git após migração para Cloudflare',
  vercelConfig?.git?.deploymentEnabled === false);

ok('Newsletter só confirma consentimento após persistência durável e protegida',
  newsletterMigration.includes('CREATE TABLE IF NOT EXISTS newsletter_subscribers') &&
  newsletterMigration.includes('UNIQUE (email)') &&
  edgeV2Source.includes('INSERT INTO newsletter_subscribers') &&
  edgeV2Source.includes('NEWSLETTER_STORAGE_UNAVAILABLE') &&
  edgeV2Source.includes('newsletter:ip:') &&
  productionWorkflow.includes('migrations/033_newsletter_subscriptions.sql'));

ok('OTP de recuperação não é persistido no navegador',
  !authClient.includes('finobra_otp_') &&
  authClient.includes('O OTP permanece somente em memória') &&
  loginPageClient.includes('recoveryResetToken = null') &&
  loginPageClient.includes('recoveryRequestId = null'));

if(process.exitCode) process.exit(process.exitCode);
console.log('\n✅ Hardening pré-lançamento protegido por regressão estática.');
