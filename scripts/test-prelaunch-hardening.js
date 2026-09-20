import fs from 'fs';

function read(p){ return fs.readFileSync(p,'utf8'); }
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
ok('Backup lógico diário está versionado', backup.includes("cron: '20 7 * * *'") && backup.includes('pg_dump') && backup.includes('retention-days: 30'));
ok('Rollback Cloudflare está versionado', rollback.includes('wrangler rollback') && rollback.includes('/__finobra/health'));
const edgeBackup=read('api/_edge-backup.js');
const edgeAlerts=read('api/_edge-alerts.js');
const worker=read('cloudflare-worker.js');
ok('Worker mantém snapshot diário dos dados críticos no R2', edgeBackup.includes('neon-critical') && edgeBackup.includes('CRITICAL_TABLES') && worker.includes('createCriticalR2Backup'));
ok('Alertas Edge críticos fazem envio real com timeout', edgeAlerts.includes('/send-message') && edgeAlerts.includes('AbortSignal.timeout(8000)'));
ok('Falhas 5xx geram alerta operacional', worker.includes("type: 'EDGE_HTTP_5XX'"));
ok('Pagamento confirmado recupera UI quando refresh de sessão falha', cobranca.includes('sessionRefreshed') && cobranca.includes('window.location.reload()'));
ok('Falha de sincronização de rota é mostrada ao usuário', app.includes('Dados locais exibidos. A sincronização com a nuvem falhou'));

if(process.exitCode) process.exit(process.exitCode);
console.log('\n✅ Hardening pré-lançamento protegido por regressão estática.');
