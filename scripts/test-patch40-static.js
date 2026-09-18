import fs from 'fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Patch 40: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

const adminJs = fs.readFileSync('api/admin.js', 'utf8');
const masterJs = fs.readFileSync('js/master.js', 'utf8');
const patch26Js = fs.readFileSync('js/patch26-events.js', 'utf8');
const emailTpl = fs.readFileSync('templates/email-cobranca-assinatura.html', 'utf8');
const workerJs = fs.readFileSync('cloudflare-worker.js', 'utf8');
const redirects = fs.readFileSync('cloudflare/_redirects', 'utf8');
const masterHtml = fs.readFileSync('master.html', 'utf8');
const vercelJson = fs.readFileSync('vercel.json', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = JSON.parse(fs.readFileSync('version.json', 'utf8'));

console.log('=== Patch 40 — Cobrança e Notificação de Assinaturas SaaS (Painel Master) ===\n');

// 1. Endpoint Serverless Seguro em api/admin.js
assert(adminJs.includes("action === 'send_billing_notice'"), 'api/admin.js implementa action send_billing_notice.');
assert(adminJs.includes('isSuperAdmin'), 'api/admin.js exige perfil superadmin para disparo de cobrança.');
assert(adminJs.includes('cobranca_notificacao_enviada'), 'api/admin.js grava evento de auditoria no Neon.');

// 2. Templates Dinâmicos no Backend
assert(adminJs.includes("templateType === 'reminder'"), 'api/admin.js implementa template de lembrete prévio de vencimento.');
assert(adminJs.includes("templateType === 'due_today'"), 'api/admin.js implementa template de vencimento hoje.');
assert(adminJs.includes("templateType === 'overdue'"), 'api/admin.js implementa template de aviso em atraso / suspensão.');
assert(adminJs.includes("templateType === 'trial_ending'"), 'api/admin.js implementa template de fim de período de testes.');

// 3. Canais Multicanal: WhatsApp Direto + E-mail Resend + Fallback Web
assert(adminJs.includes('api.resend.com/emails'), 'api/admin.js integra disparo de e-mail via Resend.');
assert(adminJs.includes('/send-message') && adminJs.includes('RENDER_WHATSAPP_URL'), 'api/admin.js integra disparo direto via robô de WhatsApp no Render.');
assert(adminJs.includes('renderBillingEmailHtml'), 'api/admin.js implementa renderizador de e-mail HTML institucional.');

// 4. Template de E-mail Responsivo
assert(emailTpl.includes('{{{EMPRESA}}}') && emailTpl.includes('{{{PLANO}}}'), 'Template de e-mail possui tags para empresa e plano.');
assert(emailTpl.includes('{{{VALOR}}}') && emailTpl.includes('{{{PIX_CHAVE}}}'), 'Template de e-mail inclui valor e chave PIX para pagamento.');
assert(emailTpl.includes('FinGo'), 'Template de e-mail possui identidade institucional FinGo.');

// 5. Interface Interativa do Painel Master
assert(masterJs.includes('MasterAdmin.abrirModalCobranca'), 'MasterAdmin possui método abrirModalCobranca.');
assert(masterJs.includes('MasterAdmin.mudarTemplateCobranca'), 'MasterAdmin possui seletor dinâmico de templates de mensagem.');
assert(masterJs.includes('MasterAdmin.enviarNotificacaoCobranca'), 'MasterAdmin possui disparador multicanal com feedback visual.');
assert(masterJs.includes('MasterAdmin.abrirWaWebDireto'), 'MasterAdmin possui fallback para WhatsApp Web.');
assert(masterJs.includes('data-fb-click="MasterAdmin.abrirModalCobranca"'), 'Tabela de empresas conecta botão Cobrar ao modal interativo.');

// 6. Allowlist CSP e Event Bridge
assert(
  patch26Js.includes('"MasterAdmin.abrirModalCobranca"') &&
  patch26Js.includes('"MasterAdmin.mudarTemplateCobranca"') &&
  patch26Js.includes('"MasterAdmin.enviarNotificacaoCobranca"'),
  'Allowlist CSP (Patch 26) autoriza as ações do modal de cobrança.'
);

// 7. Roteamento Edge e Canonical de /master
assert(workerJs.includes('function isMasterShellPath(pathname)'), 'Edge reconhece /master e /master.html como rotas do portal master.');
assert(workerJs.includes("assetPath = '/master.html'"), 'Edge resolve /master através do arquivo master.html explícito.');
assert(workerJs.includes("routeName = 'master-shell'"), 'Edge identifica a rota como master-shell.');
assert(workerJs.includes("target.pathname === '/master.html'"), 'Edge canonicaliza /master.html para /master.');
assert(redirects.includes('/master /master.html 200'), 'Assets Cloudflare possuem fallback explícito de /master para master.html.');
assert(vercelJson.includes('"source": "/master"') && vercelJson.includes('"destination": "/master.html"'), 'Vercel possui rewrite explícito de /master para master.html.');
assert(masterHtml.includes('rel="canonical" href="https://fingo.api.br/master"'), 'master.html possui canonical apontando para /master.');
assert(masterHtml.includes('name="robots" content="noindex, nofollow"'), 'master.html bloqueia indexação de motores de busca.');

// 8. Versionamento e Pacote
assert(pkg.scripts?.['test:patch40'] === 'node scripts/test-patch40-static.js', 'package.json expõe comando test:patch40.');
assert(pkg.version >= '2.29.0', 'package.json está na versão >= 2.29.0.');
assert(version.version >= '2.29.0', 'version.json está na versão >= 2.29.0.');
assert(/-p(40|[4-9]\d|\d{3,})\b/.test(version.build || ''), 'version.json registra build com sufixo >= -p40.');

console.log('\n🎉 Patch 40: todas as 28 verificações passaram com 100% de sucesso!');
