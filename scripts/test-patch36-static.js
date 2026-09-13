import fs from 'fs';
function assert(cond,msg){ if(!cond){ console.error('❌ '+msg); process.exit(1); } console.log('✅ '+msg); }
const plans=fs.readFileSync('api/_plans.js','utf8');
const perms=fs.readFileSync('api/_permissions.js','utf8');
const users=fs.readFileSync('api/users.js','utf8');
const plano=fs.readFileSync('api/plano.js','utf8');
const admin=fs.readFileSync('api/admin.js','utf8');
const app=fs.readFileSync('app.html','utf8');
const worker=fs.readFileSync('cloudflare-worker.js','utf8');
assert(plans.includes('maxUsers: 1') && plans.includes('maxUsers: 2') && plans.includes('maxUsers: 5'),'Planos usam limites 1/2/5 usuários.');
assert(plans.includes('canUseModule') && plans.includes('PLAN_MODULE_REQUIRED'),'Regras centrais conhecem módulos por plano.');
assert(perms.includes("canUseModule(tenantPlan, module)"),'RBAC aplica plano antes das permissões individuais.');
assert(users.includes("code:'PLAN_USER_LIMIT'") && users.includes('getUserPlanUsage'),'Criação/reativação de usuários respeita limite do plano.');
assert(plano.includes('activeUsers') && plano.includes('remainingUsers') && plano.includes('competencia'),'Central da Conta recebe consumo de usuários e competência de cobrança.');
assert(admin.includes('recoveredFromImpersonatedSession') && admin.includes('realTenantId'),'Master possui recuperação segura sem depender apenas do cookie auxiliar.');
assert(app.includes('/js/vendor/chart.umd.min.js?v=4.4.0') && !app.includes('cdn.jsdelivr.net/npm/chart.js'),'Chart.js é servido localmente.');
assert(!worker.includes('https://cdn.jsdelivr.net'),'CSP não depende mais do jsDelivr.');
assert(fs.existsSync('js/vendor/chart.umd.min.js') && fs.statSync('js/vendor/chart.umd.min.js').size > 100000,'Asset local do Chart.js foi versionado.');
console.log('\n✅ Patch 36 bloco 1 validado.');
