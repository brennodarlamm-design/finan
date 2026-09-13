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
  notas: 'Notas / NF-e / OCR',
  orcamentos: 'Orçamentos / SINAPI',
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
    monthlyPriceCents: 7990,
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
    monthlyPriceCents: 11990,
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
    monthlyPriceCents: 15990,
    supportLevel: 'Prioritário / VIP',
    modules: ALL_MODULES,
    features: Object.freeze({ ocr:true, signatures:true, sinapi:true, engineering:true, advancedPermissions:true })
  })
});

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
  return {
    success:false,
    code:'PLAN_FEATURE_REQUIRED',
    feature,
    plan:rule.id,
    error:`${names[feature] || 'Este recurso'} não está incluído no ${rule.label}. Conheça os planos disponíveis para liberar este recurso.`
  };
}

export function planModuleError(module, plan) {
  const rule = getPlanRule(plan);
  const name = PLAN_MODULE_CATALOG[module] || 'Este módulo';
  return {
    success:false,
    code:'PLAN_MODULE_REQUIRED',
    module,
    plan:rule.id,
    error:`${name} não está incluído no ${rule.label}. Você pode continuar usando os demais módulos do seu plano ou consultar uma opção superior.`
  };
}
