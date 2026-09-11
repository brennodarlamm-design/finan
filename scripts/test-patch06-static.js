import fs from 'fs';

const read = p => fs.readFileSync(p, 'utf8');
let okCount = 0, failCount = 0;
function test(name, cond) {
  if (cond) { console.log('✅', name); okCount++; }
  else { console.error('❌', name); failCount++; }
}

const migration = read('migrations/005_billing_support_center.sql');
const schema = read('schema.sql');
const plans = read('api/_plans.js');
const planApi = read('api/plano.js');
const adminApi = read('api/admin.js');
const authApi = read('api/_auth.js');
const auditApi = read('api/audit.js');
const usersApi = read('api/users.js');
const cobranca = read('js/cobranca.js');
const master = read('js/master.js');
const auth = read('js/auth.js');
const app = read('js/app.js');
const suporte = read('js/suporte.js');
const suporteDev = read('js/suporte_dev.js');
const masterHtml = read('master.html');
const vercel = read('vercel.json');

// Migração / schema
test('Migração cria coluna vencimento do tenant', migration.includes('ADD COLUMN IF NOT EXISTS vencimento DATE'));
test('Migração cria billing_invoices', migration.includes('CREATE TABLE IF NOT EXISTS billing_invoices'));
test('Migração cria conversas de suporte', migration.includes('CREATE TABLE IF NOT EXISTS support_conversations'));
test('Migração cria mensagens de suporte', migration.includes('CREATE TABLE IF NOT EXISTS support_messages'));
test('Schema inclui cobrança e suporte', schema.includes('CREATE TABLE IF NOT EXISTS billing_invoices') && schema.includes('CREATE TABLE IF NOT EXISTS support_conversations') && schema.includes('CREATE TABLE IF NOT EXISTS support_messages'));

// Cobrança
test('Preços dos planos ficam no backend', plans.includes('monthlyPriceCents: 7990') && plans.includes('monthlyPriceCents: 11990') && plans.includes('monthlyPriceCents: 15990'));
test('API cria cobrança usando preço do backend', planApi.includes('rule.monthlyPriceCents') && !planApi.includes('req.body?.amount'));
test('PIX possui CRC16 e BR.GOV.BCB.PIX', planApi.includes('crc16Ccitt') && planApi.includes('BR.GOV.BCB.PIX'));
test('Master confirma pagamento e renova vencimento', adminApi.includes("action === 'confirm_payment'") && adminApi.includes('+ 30)::date'));
test('Tela de planos usa cobrança registrada no backend', cobranca.includes("/api/plano?action=create_invoice") && cobranca.includes('data.invoice'));

// Impersonação / isolamento de tenant
test('Token de impersonação é emitido pelo backend', adminApi.includes("action === 'impersonate'") && adminApi.includes('impersonated: true'));
test('Master usa endpoint de impersonação em vez de trocar tenant localmente', master.includes("/api/admin?action=impersonate") && master.includes('data.session') && (master.includes('data.token') || master.includes('cookie HttpOnly')));
test('Auth preserva e restaura sessão Master', auth.includes('backupSessionForImpersonation') && auth.includes('stopImpersonation'));
test('App exibe modo suporte e oculta chat de cliente', app.includes('MODO SUPORTE MASTER') && app.includes("u?.impersonatedBy === 'superadmin'"));
test('API de auth resolve tenant alvo do token de suporte', authApi.includes('effectiveTenantId') && authApi.includes('targetTenantInfo'));

// Chat do cliente
test('Cliente usa API real de suporte no Neon', suporte.includes("/api/support?") && usersApi.includes("target === 'support'"));
test('Rewrite /api/support reutiliza users.js e não cria função Vercel extra', vercel.includes('"source": "/api/support"') && vercel.includes('"destination": "/api/users?target=support"'));
test('FinBot responde dúvidas comuns', usersApi.includes('function supportBotReply') && suporte.includes('FinBot'));
test('Cliente possui botão Chamar atendente', suporte.includes('Chamar atendente') && suporte.includes("_apiSupport('escalate'"));
test('Polling do cliente consulta a conversa pelo ID para receber resolução do DEV', suporte.includes("conversationId:this.sessao.conversationId") && suporte.includes("_apiSupport('current', 'GET', null"));
test('Cliente não acessa chat normal durante impersonação Master', usersApi.includes('No modo suporte Master, use a Central de Atendimento DEV') && suporte.includes('Central de Atendimento DEV'));

// Central DEV
test('Central DEV possui interface separada do cliente', suporteDev.includes('Central de Atendimento DEV') && masterHtml.includes('/js/suporte_dev.js'));
test('Master possui fila global de suporte', adminApi.includes("action === 'support_list'") && adminApi.includes('FROM support_conversations'));
test('DEV pode assumir, responder e resolver atendimento', adminApi.includes("action === 'support_assign'") && adminApi.includes("action === 'support_reply'") && adminApi.includes("action === 'support_resolve'"));
test('Central DEV possui popup de cliente aguardando', suporteDev.includes('Cliente aguardando atendimento') && suporteDev.includes('_showPopup'));
test('Central DEV faz polling sem abrir tela do cliente', suporteDev.includes('_startChatPolling') && !suporteDev.includes('Suporte.abrirTelaAtendimento'));

// Notificações externas
test('Atendimento humano pode notificar WhatsApp configurado', usersApi.includes('FINOBRA_SUPPORT_WHATSAPP') && usersApi.includes('/send-message'));
test('Atendimento humano pode notificar e-mail via Resend', usersApi.includes('RESEND_API_KEY') && usersApi.includes('FINOBRA_SUPPORT_EMAIL'));
test('E-mail padrão solicitado está configurado como fallback', usersApi.includes('brennodarlam@gmail.com'));
test('WhatsApp solicitado está configurado como fallback', usersApi.includes('5595991363678'));

// Auditoria
test('Modo suporte e atendimentos humanos são auditados', adminApi.includes('suporte_iniciado') && adminApi.includes('suporte_encerrado') && adminApi.includes('suporte_assumido') && adminApi.includes('suporte_resolvido'));
test('Auditoria identifica superadmin cross-tenant', auditApi.includes('LEFT JOIN usuarios u ON u.id = a.user_id'));

console.log(`\nPatch 06 Revisado: ${okCount} passou, ${failCount} falhou.`);
if (failCount) process.exit(1);
