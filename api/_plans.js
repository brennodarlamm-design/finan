// api/_plans.js — Regras de planos, limites de usuários e módulos do SaaS FinObra

export const PLAN_MODULE_CATALOG = Object.freeze({
  dashboard: 'Dashboard',
  obras: 'Obras & Clientes',
  financeiro: 'Financeiro',
  fornecedores: 'Fornecedores',
  produtos: 'Produtos / Insumos',
  precompras: 'Pré-Compras',
  recibos: 'Recibos',
  contratos: 'Contratos',
  notas: 'Notas / NF-e',
  orcamentos: 'Orçamentos',
  medicoes: 'Medições',
  documentos: 'Documentos',
  relatorios: 'Relatórios',
  contas: 'Contas Bancárias',
  whatsapp: 'WhatsApp',
  assinatura: 'Assinatura eletrônica',
  planos: 'Planos / Cobrança',
  configuracoes: 'Configurações'
});

const ALL_MODULES = Object.freeze(Object.keys(PLAN_MODULE_CATALOG));
const STARTER_MODULES = Object.freeze([
  'dashboard','obras','financeiro','fornecedores','produtos','recibos','medicoes','relatorios','contas','whatsapp','planos','configuracoes'
]);
const PRO_MODULES = Object.freeze([
  'dashboard','obras','financeiro','fornecedores','produtos','precompras','recibos','contratos','notas','orcamentos','medicoes','documentos','relatorios','contas','whatsapp','assinatura','planos','configuracoes'
]);

export const PLAN_RULES = Object.freeze({
  trial: Object.freeze({
    id: 'trial',
    label: 'Teste gratuito',
    idealFor: 'Conhecer o FinObra com os principais recursos liberados',
    maxActiveObras: 10,
    maxUsers: 2,
    monthlyPriceCents: 0,
    supportLevel: 'Padrão',
    modules: ALL_MODULES,
    features: Object.freeze({ ocr:true, signatures:true, sinapi:true, engineering:true, advancedPermissions:true })
  }),
  starter: Object.freeze({
    id: 'starter',
    label: 'Plano Básico',
    idealFor: 'Profissionais e pequenas construtoras com operação enxuta',
    maxActiveObras: 3,
    maxUsers: 1,
    monthlyPriceCents: 11990,
    supportLevel: 'Padrão',
    modules: STARTER_MODULES,
    features: Object.freeze({ ocr:false, signatures:false, sinapi:false, engineering:false, advancedPermissions:false })
  }),
  pro: Object.freeze({
    id: 'pro',
    label: 'Plano Profissional',
    idealFor: 'Construtoras em crescimento que precisam automatizar documentos e compras',
    maxActiveObras: 10,
    maxUsers: 2,
    monthlyPriceCents: 27990,
    supportLevel: 'Prioritário',
    modules: PRO_MODULES,
    features: Object.freeze({ ocr:true, signatures:true, sinapi:false, engineering:false, advancedPermissions:false })
  }),
  unlimited: Object.freeze({
    id: 'unlimited',
    label: 'Construtora Ilimitado',
    idealFor: 'Operações completas com engenharia, equipe e obras em escala',
    maxActiveObras: null,
    maxUsers: 5,
    monthlyPriceCents: 49990,
    supportLevel: 'Prioritário / VIP',
    modules: ALL_MODULES,
    features: Object.freeze({ ocr:true, signatures:true, sinapi:true, engineering:true, advancedPermissions:true })
  })
});

export const PLAN_BILLING_CYCLES = Object.freeze({
  monthly: Object.freeze({ id: 'monthly', label: 'Mensal', months: 1, days: 30, discountLabel: 'Sem fidelidade' }),
  quarterly: Object.freeze({ id: 'quarterly', label: 'Trimestral', months: 3, days: 90, discountLabel: 'Economia trimestral (~5,5% OFF)' }),
  semiannual: Object.freeze({ id: 'semiannual', label: 'Semestral', months: 6, days: 180, discountLabel: 'Economia semestral (~11% OFF)' }),
  annual: Object.freeze({ id: 'annual', label: 'Anual', months: 12, days: 365, discountLabel: '2 meses grátis (Pague 10, Leve 12)' })
});

export const PLAN_CYCLE_PRICING = Object.freeze({
  starter: Object.freeze({
    monthly: Object.freeze({ totalCents: 11990, monthlyEquivalentCents: 11990, savingsCents: 0, months: 1, days: 30 }),
    quarterly: Object.freeze({ totalCents: 33990, monthlyEquivalentCents: 11330, savingsCents: 1980, months: 3, days: 90 }),
    semiannual: Object.freeze({ totalCents: 63990, monthlyEquivalentCents: 10665, savingsCents: 7950, months: 6, days: 180 }),
    annual: Object.freeze({ totalCents: 119900, monthlyEquivalentCents: 9991, savingsCents: 23980, months: 12, days: 365 })
  }),
  pro: Object.freeze({
    monthly: Object.freeze({ totalCents: 27990, monthlyEquivalentCents: 27990, savingsCents: 0, months: 1, days: 30 }),
    quarterly: Object.freeze({ totalCents: 78990, monthlyEquivalentCents: 26330, savingsCents: 4980, months: 3, days: 90 }),
    semiannual: Object.freeze({ totalCents: 147990, monthlyEquivalentCents: 24665, savingsCents: 19950, months: 6, days: 180 }),
    annual: Object.freeze({ totalCents: 279900, monthlyEquivalentCents: 23325, savingsCents: 55980, months: 12, days: 365 })
  }),
  unlimited: Object.freeze({
    monthly: Object.freeze({ totalCents: 49990, monthlyEquivalentCents: 49990, savingsCents: 0, months: 1, days: 30 }),
    quarterly: Object.freeze({ totalCents: 139990, monthlyEquivalentCents: 46663, savingsCents: 9980, months: 3, days: 90 }),
    semiannual: Object.freeze({ totalCents: 264990, monthlyEquivalentCents: 44165, savingsCents: 34950, months: 6, days: 180 }),
    annual: Object.freeze({ totalCents: 499900, monthlyEquivalentCents: 41658, savingsCents: 99980, months: 12, days: 365 })
  })
});

export function getPlanCyclePrice(planId, cycle = 'monthly') {
  const normPlan = normalizePlan(planId);
  const normCycle = String(cycle || 'monthly').trim().toLowerCase();
  const pricing = PLAN_CYCLE_PRICING[normPlan]?.[normCycle] || PLAN_CYCLE_PRICING[normPlan]?.monthly;
  if (!pricing) return null;
  return {
    planId: normPlan,
    cycle: (normCycle in (PLAN_CYCLE_PRICING[normPlan] || {})) ? normCycle : 'monthly',
    ...pricing,
    cycleLabel: PLAN_BILLING_CYCLES[normCycle]?.label || 'Mensal',
    discountLabel: PLAN_BILLING_CYCLES[normCycle]?.discountLabel || ''
  };
}

export const PAID_PLAN_ORDER = Object.freeze(['starter','pro','unlimited']);

export function minimumPlanForModule(module) {
  const key=String(module||'').trim();
  return PAID_PLAN_ORDER.find(plan => PLAN_RULES[plan].modules.includes(key)) || null;
}

export function minimumPlanForFeature(feature) {
  const key=String(feature||'').trim();
  return PAID_PLAN_ORDER.find(plan => Boolean(PLAN_RULES[plan].features?.[key])) || null;
}

export function minimumPlanForUsers(userCount) {
  const needed=Math.max(1, Number(userCount||1));
  return PAID_PLAN_ORDER.find(plan => PLAN_RULES[plan].maxUsers == null || PLAN_RULES[plan].maxUsers >= needed) || null;
}

export function upgradeDescriptor(requiredPlan) {
  const rule=requiredPlan ? PLAN_RULES[requiredPlan] : null;
  return {
    requiredPlan: rule?.id || null,
    requiredPlanLabel: rule?.label || 'Plano sob consulta',
    upgradePath: '/app/planos'
  };
}

export function normalizePlan(plan) {
  const key = String(plan || 'trial').trim().toLowerCase();
  return PLAN_RULES[key] ? key : 'trial';
}

export function getPlanRule(plan) {
  return PLAN_RULES[normalizePlan(plan)];
}

export function isActiveObraStatus(status) {
  const s = String(status || 'em_andamento').trim().toLowerCase();
  return !['concluida','concluída','concluido','concluído','cancelada','cancelado','sistema'].includes(s);
}

export function canUseFeature(plan, feature) {
  return Boolean(getPlanRule(plan).features?.[feature]);
}

export function canUseModule(plan, module) {
  const key = String(module || '').trim();
  if (!key) return true;
  return getPlanRule(plan).modules.includes(key);
}

export function planError(feature, plan) {
  const rule = getPlanRule(plan);
  const names = {
    ocr: 'Leitura OCR com IA',
    signatures: 'Assinatura eletrônica com validação',
    sinapi: 'SINAPI / Caixa',
    engineering: 'Controles avançados de engenharia',
    advancedPermissions: 'Permissões avançadas por módulo'
  };
  const requiredPlan=minimumPlanForFeature(feature);
  const upgrade=upgradeDescriptor(requiredPlan);
  const resource=names[feature] || 'Este recurso';
  const message=requiredPlan
    ? `${resource} está disponível a partir do ${upgrade.requiredPlanLabel}. Seu ${rule.label} continua ativo normalmente.`
    : `${resource} não está disponível na contratação atual. Fale com o Suporte / Comercial.`;
  return {
    success:false,
    code:'PLAN_FEATURE_LOCKED',
    legacyCode:'PLAN_FEATURE_REQUIRED',
    feature,
    plan:rule.id,
    currentPlan:rule.id,
    ...upgrade,
    userMessage:message,
    error:message
  };
}

export function planModuleError(module, plan) {
  const rule = getPlanRule(plan);
  const name = PLAN_MODULE_CATALOG[module] || 'Este módulo';
  const requiredPlan=minimumPlanForModule(module);
  const upgrade=upgradeDescriptor(requiredPlan);
  const message=requiredPlan
    ? `${name} está disponível a partir do ${upgrade.requiredPlanLabel}. Você pode continuar usando os demais módulos do ${rule.label}.`
    : `${name} não está disponível na contratação atual. Fale com o Suporte / Comercial.`;
  return {
    success:false,
    code:'PLAN_MODULE_LOCKED',
    legacyCode:'PLAN_MODULE_REQUIRED',
    module,
    plan:rule.id,
    currentPlan:rule.id,
    ...upgrade,
    userMessage:message,
    error:message
  };
}
