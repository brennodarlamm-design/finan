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
const vercelConfig=read('vercel.json');
const cloudflareBuild=read('scripts/build-cloudflare-pages.cjs');
const billingIdempotencyMigration=read('migrations/034_billing_pending_invoice_idempotency.sql');

ok('Wrangler declara binding ATTACHMENTS_R2 persistente', wrangler.includes('"binding": "ATTACHMENTS_R2"') && wrangler.includes('"bucket_name": "fingo-attachments"'));
ok('R2 falha fechado fora de testes quando binding está ausente', r2.includes('Binding ATTACHMENTS_R2 indisponível') && r2.includes('FINOBRA_ALLOW_MEMORY_STORAGE'));
ok('R2 exige tenant explícito na geração da chave', r2.includes('tenantId válido é obrigatório para gerar chave no R2.'));
ok('R2 não mascara falhas remotas de upload, leitura, exclusão ou listagem', r2.includes('Falha ao gravar o arquivo no armazenamento Cloudflare R2.') && r2.includes('Falha ao consultar o armazenamento Cloudflare R2.') && r2.includes('Falha ao excluir o arquivo no armazenamento Cloudflare R2.') && r2.includes('Falha ao listar arquivos no armazenamento Cloudflare R2.'));
ok('Rotas R2 exigem autenticação e isolamento de tenant', routes.includes('resolveAuthAndTenant(req)') && routes.includes("canAccessModule(auth, 'documentos'") && routes.includes('expectedPrefix'));
ok('Upload principal grava em R2 quando binding existe', upload.includes('r2Ready') && upload.includes("storage: 'cloudflare_r2'") && upload.includes('r2://'));
ok('Novos uploads não caem silenciosamente no Vercel Blob', upload.includes('FINOBRA_ALLOW_LEGACY_BLOB_UPLOAD') && upload.includes("code: 'R2_STORAGE_REQUIRED'") && upload.includes('!r2Ready && !allowLegacyBlobUpload'));
ok('Vercel Blob ficou apenas como compatibilidade legada controlada', upload.includes("storage: 'vercel_blob_legacy'") && upload.includes('allowLegacyBlobUpload'));
ok('Checkout concorrente não duplica cobrança pendente', billingIdempotencyMigration.includes('uq_billing_pending_tenant_plan_cycle') && billingIdempotencyMigration.includes('PARTITION BY tenant_id, plan_id, cycle') && plano.includes("ON CONFLICT (tenant_id, plan_id, cycle) WHERE status = 'pending'") && plano.includes('DO NOTHING') && plano.includes('invoice:concurrent[0]') && plano.includes('reused:true'));
const adminRoute=read('api/_admin-route.js');
const renderServer=read('backend/server.js');
ok('Cobrança PIX falha fechado sem chave configurada', plano.includes("code:'BILLING_PIX_NOT_CONFIGURED'") && plano.includes("process.env.FINOBRA_PIX_KEY || ''") && !plano.includes("FINOBRA_PIX_KEY || '+55") && adminRoute.includes("code:'BILLING_PIX_NOT_CONFIGURED'") && !adminRoute.includes('FINOBRA_PIX_KEY || process.env.FINOBRA_SUPPORT_WHATSAPP') && renderServer.includes("reason:'pix_key_not_configured'") && !renderServer.includes('FINOBRA_PIX_KEY || process.env.FINOBRA_SUPPORT_WHATSAPP'));
ok('Cancelamento self-service existe no backend', plano.includes("action === 'cancel_subscription'") && plano.includes("status='cancelamento_agendado'"));
ok('Cancelamento de assinatura é atômico entre faturas e tenant', plano.includes('WITH canceled_invoices AS') && plano.includes('tenant_upd AS') && plano.includes('canceledInvoices:Number('));
ok('Cancelamento encerra acesso ao fim do período', auth.includes("tenant_status === 'cancelamento_agendado'") && authApi.includes("tenant_status === 'cancelamento_agendado'"));
ok('Cancelamento vencido é materializado como cancelado', auth.includes("SET status='cancelado'") && auth.includes('vencimento < CURRENT_DATE') && authApi.includes("SET status='cancelado'") && authApi.includes('vencimento < CURRENT_DATE'));
const pixCore=read('api/_webhook_pix_core.js');
ok('PIX concorrente preserva crédito e distingue reativação posterior', pixCore.includes('WITH candidate AS') && pixCore.includes('FOR UPDATE') && pixCore.includes("status IN ('pending', 'expired', 'canceled')") && pixCore.includes('candidate.prior_status') && pixCore.includes("t.status = 'cancelamento_agendado' AND paid.prior_status = 'canceled'"));
ok('Conta expõe ação de cancelamento', cobranca.includes('cancelarAssinatura()') && cobranca.includes('Cancelar renovação'));
ok('Conta oferece caminho de reativação após cancelamento', cobranca.includes("needsReactivation=['cancelamento_agendado','cancelado']") && cobranca.includes('Reativar / contratar plano') && cobranca.includes('Reativar este plano') && cobranca.includes("this._renderCardPlano(plan,p.id===plan.id,canManage,p.status)"));
ok('Recuperação de senha usa timeout em canais externos', (authApi.match(/AbortSignal\.timeout\(10000\)/g)||[]).length >= 2);
ok('Telemetria não envia query string/hash', app.includes('window.location.origin') && app.includes('window.location.pathname') && !app.includes('url: window.location.href'));
ok('Landing não promete provisionamento instantâneo', !read('marketing/faq-data.js').includes('Você cria sua conta em menos de 1 minuto'));
ok('Landing possui foco visível por teclado', read('marketing/styles.css').includes('focus-visible:outline'));
ok('Landing mantém layout responsivo', read('marketing/main.jsx').includes('md:flex') && read('marketing/styles.css').includes('w-full'));
ok('Menu mobile preserva login e solicitação de teste', read('marketing/main.jsx').includes('href="/login"') && read('marketing/main.jsx').includes('href="/cadastro"'));
ok('Hero reserva espaço e proporção', read('marketing/main.jsx').includes('object-cover') && read('marketing/feature-tour.jsx').includes('aspect-video'));
ok('Controles principais têm espaçamento de toque', read('marketing/styles.css').includes('py-4'));
ok('Backup lógico diário está versionado e cifrado antes do artifact', backup.includes("cron: '20 7 * * *'") && backup.includes('pg_dump') && backup.includes('BACKUP_ENCRYPTION_PASSPHRASE') && backup.includes('openssl enc -aes-256-cbc') && backup.includes("backup/*.enc") && backup.includes('retention-days: 30'));
ok('Backup recusa role sem bypass de RLS e valida tabelas críticas', backup.includes('Verify backup role can bypass RLS') && backup.includes('rolbypassrls::text') && backup.includes("Refusing to create a potentially incomplete production backup") && backup.includes('for critical_table in tenants usuarios obras lancamentos billing_invoices') && backup.includes('TABLE DATA .* ${critical_table}( |$)'));
ok('Rollback Cloudflare está versionado', rollback.includes('wrangler rollback') && rollback.includes('/__finobra/health'));
ok('Vercel Git auto-deploy permanece desativado após migração Cloudflare', vercelConfig.includes('"deploymentEnabled": false'));
ok('Build público bloqueia segredos de servidor', cloudflareBuild.includes('assertNoServerSecretsInPublicBundle') && cloudflareBuild.includes('DATABASE_OWNER_URL') && cloudflareBuild.includes('SESSION_SIGNING_SECRET') && cloudflareBuild.includes('PIX_WEBHOOK_SECRET') && cloudflareBuild.includes('RESEND_API_KEY') && cloudflareBuild.includes('Segredo de servidor detectado no bundle público'));
const edgeBackup=read('api/_edge-backup.js');
const edgeAlerts=read('api/_edge-alerts.js');
const worker=read('cloudflare-worker.js');
ok('Worker mantém snapshot diário dos dados críticos no R2', edgeBackup.includes('neon-critical') && edgeBackup.includes('CRITICAL_TABLES') && worker.includes('createCriticalR2Backup'));
ok('Migração de documentos legados só troca URL após validar R2', edgeBackup.includes('migrateLegacyDocumentsToR2') && edgeBackup.includes('getR2Object') && edgeBackup.includes("migratedFrom: 'vercel_blob'") && worker.includes('migrateLegacyDocumentsToR2'));
ok('Alertas Edge críticos fazem envio real com timeout', edgeAlerts.includes('/send-message') && edgeAlerts.includes('AbortSignal.timeout(8000)'));
ok('Falhas 5xx geram alerta operacional', worker.includes("type: 'EDGE_HTTP_5XX'"));
ok('Pagamento confirmado recupera UI quando refresh de sessão falha', cobranca.includes('sessionRefreshed') && cobranca.includes('window.location.reload()'));
ok('Falha de sincronização de rota é mostrada ao usuário', app.includes('Dados locais exibidos. A sincronização com a nuvem falhou'));

const loginRecoveryClient=read('js/login_page.js');
const loginShell=read('index.html');
ok('Recuperação OTP não cria falsa confirmação nem dead-end', loginRecoveryClient.includes('O código só é confirmado pelo servidor junto com a troca atômica da senha.') && loginRecoveryClient.includes('Continuar com este código') && loginRecoveryClient.includes('otpRejected') && loginRecoveryClient.includes("document.getElementById('rec-step-2').className = 'recovery-step active'") && loginRecoveryClient.includes('sessionStorage.removeItem'));
ok('Recuperação de senha comunica validação atômica e mínimo correto', loginShell.includes('Agora defina sua nova senha. O código será confirmado com segurança ao salvar a alteração.') && loginShell.includes('placeholder="Mínimo 8 caracteres"') && !loginShell.includes('Código verificado com sucesso!'));

const authClient=read('js/auth.js');
ok('Auth crítico usa timeout no navegador', authClient.includes('async _fetchWithTimeout(') && authClient.includes("this._fetchWithTimeout('/api/auth?action=login'") && authClient.includes("this._fetchWithTimeout('/api/auth?action=mfa_verify'") && authClient.includes("this._fetchWithTimeout('/api/auth?action=request_reset'") && authClient.includes("this._fetchWithTimeout('/api/auth?action=verify_reset'") && authClient.includes("this._fetchWithTimeout('/api/auth?action=register'") && authClient.includes("this._fetchWithTimeout('/api/auth?action=sessions'") && authClient.includes("this._fetchWithTimeout('/api/auth?action=revoke_session'") && authClient.includes("this._fetchWithTimeout('/api/admin?action=restore_master_session'"));

const billingClient=read('js/cobranca.js');
ok('Cobrança crítica usa timeout no navegador', billingClient.includes('async _fetchWithTimeout(') && billingClient.includes("this._fetchWithTimeout('/api/plano?action=cancel_subscription'") && billingClient.includes("this._fetchWithTimeout('/api/plano?action=create_invoice'") && billingClient.includes('check_invoice&invoiceId'));
ok('PIX mostra falhas repetidas e continua verificando', billingClient.includes('pollFailures >= 3') && billingClient.includes('Não conseguimos confirmar o pagamento agora') && billingClient.includes('Verificação PIX respondeu HTTP') && billingClient.includes('Conexão restabelecida. Aguardando compensação bancária'));

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
ok('Cofre DEV auto-oculta segredos revelados', devKeysClient.includes('scheduleAutoHide(tenantId)') && devKeysClient.includes('60_000') && devKeysClient.includes("document.addEventListener('visibilitychange'") && devKeysClient.includes("window.addEventListener('pagehide'"));

const configuracoesClient=read('js/configuracoes.js');
ok('Configurações usam timeout no navegador', configuracoesClient.includes('timeoutMs = 20000') && (configuracoesClient.match(/this\._fetchWithTimeout\(/g)||[]).length >= 8 && !/await fetch\(['"`]\/api/.test(configuracoesClient));

const masterClient=read('js/master.js');
ok('Painel Master usa timeout no navegador', masterClient.includes('timeoutMs = 20000') && (masterClient.match(/this\._fetchWithTimeout\(/g)||[]).length >= 17 && !/await fetch\(['"`]\/api/.test(masterClient));


const documentosClient=read('js/documentos.js');
ok('Documentos têm deadlines no navegador', (documentosClient.match(/AbortSignal\.timeout\(90000\)/g)||[]).length >= 2 && (documentosClient.match(/AbortSignal\.timeout\(20000\)/g)||[]).length >= 3);

const assinadorClient=read('js/assinador.js');
ok('Registro de assinatura tem deadline no navegador', assinadorClient.includes('AbortSignal.timeout(30000)'));

const dashboardClient=read('js/dashboard.js');
ok('Dashboard tem deadline e fallback visível no navegador', dashboardClient.includes("fetch('/api/dashboard' + q") && dashboardClient.includes('AbortSignal.timeout(20000)') && dashboardClient.includes('Dashboard respondeu HTTP') && dashboardClient.includes('Resumo em tempo real indisponível. Exibindo os dados locais'));

const utilsClient=read('js/utils.js');
const fornecedoresClient=read('js/fornecedores.js');
ok('Consultas CEP/CNPJ têm deadline no navegador', utilsClient.includes('AbortSignal.timeout(10000)') && fornecedoresClient.includes('AbortSignal.timeout(10000)'));

const appClient=read('js/app.js');
ok('Onboarding e telemetria têm deadlines no navegador', appClient.includes('AbortSignal.timeout(5000)') && appClient.includes('AbortSignal.timeout(10000)'));

const validarClient=read('js/validar_page.js');
const workflowClient=read('js/patch51.js');
const suporteClient=read('js/suporte_dev.js');
const suporteCustomerClient=read('js/suporte.js');
const landingPageClient=read('marketing/brand-sections.jsx');
const triggerEmail=read('trigger/email.js');
const v2Routes=read('api/_v2-routes.js');
const newsletterMigration=read('migrations/033_newsletter_subscriptions.sql');
const migrationRunner=read('scripts/run-migration.js');
const securityPreflight=read('scripts/security-preflight.js');
const mfaMigration=read('scripts/migrate-legacy-mfa-secrets.js');
ok('Validação pública, workflow e suporte têm deadlines', validarClient.includes('AbortSignal.timeout(15000)') && (workflowClient.match(/AbortSignal\.timeout\(20000\)/g)||[]).length >= 2 && suporteClient.includes('AbortSignal.timeout(20000)'));
ok('Atendimento do cliente tem deadline e erro amigável', suporteCustomerClient.includes('AbortSignal.timeout(20000)') && suporteCustomerClient.includes('O atendimento demorou além do esperado. Tente novamente.'));
ok('E-mail transacional central tem deadline', triggerEmail.includes('AbortSignal.timeout(12000)') && triggerEmail.includes('maxAttempts: 4'));
ok('Newsletter aguarda resposta persistida e usa deadline', landingPageClient.includes('await fetch(') && landingPageClient.includes('!response.ok') && landingPageClient.includes('!data.success') && landingPageClient.includes('AbortSignal.timeout(15000)'));
ok('Newsletter persiste consentimento no banco', v2Routes.includes('newsletter_subscriptions') && v2Routes.includes('createOwnerSql()') && v2Routes.includes('NEWSLETTER_PERSISTENCE_UNAVAILABLE') && newsletterMigration.includes('CREATE TABLE IF NOT EXISTS newsletter_subscriptions'));
ok('Runner de migração exige role owner dedicada', migrationRunner.includes('process.env.DATABASE_OWNER_URL') && !migrationRunner.includes("process.env.DATABASE_URL ||") && migrationRunner.includes('Migrações exigem conexão privilegiada dedicada.'));
ok('Preflight de segurança separa runtime e owner', securityPreflight.includes('runtimeConn') && securityPreflight.includes('ownerConn') && securityPreflight.includes('runtimeSql') && securityPreflight.includes('ownerSql') && securityPreflight.includes('DATABASE_OWNER_URL privilegiada não configurada.'));
ok('Migração MFA exige conexão owner dedicada', mfaMigration.includes('process.env.DATABASE_OWNER_URL') && !mfaMigration.includes('process.env.DATABASE_URL ||') && mfaMigration.includes('DATABASE_OWNER_URL privilegiada não configurada.'));

const loginPageClient=read('js/login_page.js');
const masterPageClient=read('js/master_page.js');
const contasClient=read('js/contas.js');
ok('Solicitação comercial, gate Master e contas têm deadlines', loginPageClient.includes("Auth._fetchWithTimeout('/api/auth?action=register'") && masterPageClient.includes("Auth._fetchWithTimeout('/api/auth?action=me'") && contasClient.includes('AbortSignal.timeout(20000)'));


ok('UI de documentos identifica R2 sem anunciar Vercel como storage principal', documentosClient.includes('☁️ Cloudflare R2') && documentosClient.includes('☁️ Armazenamento legado') && !documentosClient.includes('Documento salvo no Vercel Blob!'));
ok('Master exibe R2 como armazenamento central', masterClient.includes('Neon PostgreSQL + Cloudflare R2') && !masterClient.includes('Neon PostgreSQL + Vercel Blob'));


const billingTrigger=read('trigger/billing.js');
const maintenanceTrigger=read('trigger/maintenance.js');
ok('Jobs cross-tenant exigem DATABASE_OWNER_URL dedicado', billingTrigger.includes('process.env.DATABASE_OWNER_URL') && maintenanceTrigger.includes('process.env.DATABASE_OWNER_URL') && !billingTrigger.includes('process.env.DATABASE_URL ||') && !maintenanceTrigger.includes('process.env.DATABASE_URL ||'));
ok('Tarefas agendadas limitam chamadas externas', billingTrigger.includes('AbortSignal.timeout(12000)') && maintenanceTrigger.includes('AbortSignal.timeout(12000)') && maintenanceTrigger.includes('AbortSignal.timeout(5000)'));
ok('Tarefas agendadas não tratam 429/5xx como sucesso', billingTrigger.includes('if (!emailRes.ok)') && billingTrigger.includes('summary.notifiedEmails++') && maintenanceTrigger.includes('if (!res.ok)') && maintenanceTrigger.includes('return { ok: false, status: res.status'));
ok('Branding visível usa FinGo', !billingTrigger.includes('FinObra') && billingTrigger.includes('FinGo') && !configuracoesClient.includes('Aplicações no FinObra') && configuracoesClient.includes('Aplicações no FinGo') && maintenanceTrigger.includes('⚠️ FinGo — Alerta de Processos com SLA Expirado') && maintenanceTrigger.includes('FinGo-KeepAlive/1.0'));

if(process.exitCode) process.exit(process.exitCode);
console.log('\n✅ Hardening pré-lançamento protegido por regressão estática.');
