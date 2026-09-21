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
const assets=fs.readFileSync('js/assets.js','utf8');
assert(assets.includes('/js/vendor/chart.umd.min.js?v=4.4.0') && !app.includes('cdn.jsdelivr.net/npm/chart.js') && !assets.includes('cdn.jsdelivr.net/npm/chart.js'),'Chart.js é servido localmente sob demanda.');
assert(!worker.includes('https://cdn.jsdelivr.net'),'CSP não depende mais do jsDelivr.');
assert(fs.existsSync('js/vendor/chart.umd.min.js') && fs.statSync('js/vendor/chart.umd.min.js').size > 100000,'Asset local do Chart.js foi versionado.');

const auth=fs.readFileSync('js/auth.js','utf8');
const appJs=fs.readFileSync('js/app.js','utf8');
const cfg=fs.readFileSync('js/configuracoes.js','utf8');
const cob=fs.readFileSync('js/cobranca.js','utf8');
assert(auth.includes('refreshPlanAccess') && auth.includes('isPlanRouteLocked'),'Frontend consulta plano real antes de decidir módulos.');
assert(appJs.includes('Cobranca.showLockedModule') && appJs.includes('Disponível em outro plano'),'Menu explica módulos de outro plano em vez de sumir silenciosamente.');
assert(cfg.includes('Seu time chegou ao limite do plano') && cfg.includes('Dispositivos e sess&otilde;es n&atilde;o consomem'),'Limite de usuários tem tratamento amigável.');
assert(cob.includes('Conta & Assinatura') && cob.includes('Histórico de cobranças') && cob.includes('acc-billing-cards'),'Central da Conta possui plano, cobranças e mobile cards.');
assert(cob.includes('acc-plans{display:flex;overflow-x:auto;scroll-snap-type:x mandatory'),'Planos internos usam carrossel horizontal no celular em vez de pilha longa.');

const landing=fs.readFileSync('marketing/main.jsx','utf8');
assert(landing.includes('15 dias'), 'Planos informam período de avaliação.');
assert(landing.includes('PLAN_RULES') && landing.includes('p.maxUsers') && landing.includes('p.maxActiveObras'), 'Planos React usam limites da fonte autoritativa.');
assert(landing.includes('overflow-x-auto') && landing.includes('<table'), 'Comparação permite rolagem no celular.');
assert(landing.includes('wa.me/5595991363678'), 'Contato comercial preservado.');


const db=fs.readFileSync('api/db.js','utf8');
const sinapi=fs.readFileSync('js/orcamento_sinapi.js','utf8');
const obra=fs.readFileSync('js/obra_detalhe.js','utf8');
assert(db.includes('planFeatureErrorForTable') && db.includes("table || '') === 'orcamentos_sinapi'") && db.includes("planError(feature"),'Backend diferencia SINAPI por feature e devolve erro de plano.');
assert(db.includes('denied.planError || permissionError'),'Sync_all preserva bloqueio SINAPI server-side.');
assert(sinapi.includes('_ensurePlanAccess') && sinapi.includes("showLockedFeature('sinapi'") && sinapi.includes("renderLockedFeature('SINAPI / Caixa'"),'SINAPI mostra bloqueio amigável e protege ações diretas.');
assert(obra.includes('_hasEngineeringFeature') && obra.includes("['curva-s','curva-abc','leis-sociais']") && obra.includes("? (this.subTabOrcado || 'curva-s') : 'cronograma'"),'Engenharia avançada é separada do cronograma nos planos.');
assert(obra.includes("showLockedFeature('engineering'") && obra.includes('if (!this._ensureEngineeringFeature()) return;'),'Ações de BDI também respeitam o plano.');

const apiPerms=fs.readFileSync('api/_permissions.js','utf8');
const apiUsers=fs.readFileSync('api/users.js','utf8');
const apiNfe=fs.readFileSync('api/nfe.js','utf8');
const apiUpload=fs.readFileSync('api/upload.js','utf8');
const apiWhatsapp=fs.readFileSync('api/whatsapp.js','utf8');
const apiOcr=fs.readFileSync('api/reconhecer-documento.js','utf8');
const apiSign=fs.readFileSync('api/assinaturas.js','utf8');
assert(apiPerms.includes("canUseFeature(tenantPlan, 'advancedPermissions')"),'Permissão granular só é aplicada quando o plano inclui a feature.');
assert(apiUsers.includes('advancedPermissions: Boolean(rule.features?.advancedPermissions)') && apiUsers.includes('!planUsage.advancedPermissions') && apiUsers.includes('!permissionPlanUsage.advancedPermissions'),'API de usuários ignora matriz granular fora do Ilimitado.');
assert(cfg.includes('Dispositivo não é usuário') && cfg.includes('não consomem acessos adicionais do plano'),'Tela de Sessões diferencia dispositivos de usuários do plano.');
assert(cob.includes('Recursos avançados') && cob.includes("['sinapi','SINAPI / Caixa']") && cob.includes("['engineering','Curva S, EVM, ABC e BDI']"),'Central da Conta separa módulos de recursos avançados.');
for (const [name,src,module] of [['NF-e',apiNfe,'notas'],['Upload',apiUpload,'documentos'],['WhatsApp',apiWhatsapp,'whatsapp']]) assert(src.includes('canAccessModule') && src.includes("'"+module+"'"), name+' usa a camada central de módulos.');
assert(apiOcr.includes("canUseFeature(auth.user?.tenantPlan, 'ocr')") && apiSign.includes("canUseFeature(auth.user?.tenantPlan, 'signatures')"),'OCR e assinatura mantêm gates de feature no servidor.');
assert(apiUsers.includes('Sessões você vê os dispositivos') && apiUsers.includes('Básico inclui 1 usuário ativo'),'FinBot conhece limites e separação entre usuário e dispositivo.');
console.log('\n✅ Patch 36 blocos 1–5 validados.');
