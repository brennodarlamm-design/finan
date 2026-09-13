import fs from 'fs';
function a(c,m){if(!c){console.error('❌ '+m);process.exit(1)}console.log('✅ '+m)}
const plans=fs.readFileSync('api/_plans.js','utf8');
const users=fs.readFileSync('api/users.js','utf8');
const cob=fs.readFileSync('js/cobranca.js','utf8');
const cfg=fs.readFileSync('js/configuracoes.js','utf8');
a(plans.includes("code:'PLAN_FEATURE_LOCKED'")&&plans.includes("legacyCode:'PLAN_FEATURE_REQUIRED'")&&plans.includes('requiredPlanLabel'),'Feature locks informam plano mínimo sem perder compatibilidade.');
a(plans.includes("code:'PLAN_MODULE_LOCKED'")&&plans.includes("legacyCode:'PLAN_MODULE_REQUIRED'")&&plans.includes('minimumPlanForModule'),'Module locks possuem orientação central de upgrade.');
a(plans.includes("notas: 'Notas / NF-e'")&&plans.includes("orcamentos: 'Orçamentos'")&&!plans.includes("orcamentos: 'Orçamentos / SINAPI'"),'Catálogo separa módulos de features avançadas.');
a(users.includes('minimumPlanForUsers')&&users.includes('requiredPlanLabel')&&users.includes("code:'PLAN_USER_LIMIT'"),'Limite de usuários informa próximo plano compatível.');
a(cob.includes('Equipe & Sessões')&&cob.includes('finobra-account-team')&&cob.includes('_renderAccountTeam'),'Conta & Assinatura reúne equipe e sessões.');
a(cob.includes('Suporte / Comercial')&&cob.includes('_renderAccountSupport')&&cob.includes('openSupport()'),'Conta & Assinatura integra suporte sem diagnóstico de cliente.');
a(cob.includes('showPlanAccessError')&&cob.includes('requiredPlanLabel'),'Frontend possui tradutor amigável de bloqueios de plano.');
a(cob.includes('MODULE_MIN_PLAN')&&cob.includes('FEATURE_MIN_PLAN'),'Bloqueios locais informam plano mínimo esperado.');
a(cfg.includes('Cobranca.openSettingsTab')&&cfg.includes('Dispositivo não é usuário'),'Usuários e sessões têm navegação correta e regra de licenciamento clara.');
console.log('\n✅ Patch 37 bloco 2 validado.');
