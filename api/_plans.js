// api/_plans.js — Regras de planos e limites do SaaS FinObra

export const PLAN_RULES = Object.freeze({
  trial: Object.freeze({
    id: 'trial',
    label: 'Teste gratuito',
    maxActiveObras: 10,
    monthlyPriceCents: 0,
    features: Object.freeze({ ocr: true, signatures: true })
  }),
  starter: Object.freeze({
    id: 'starter',
    label: 'Plano Básico',
    maxActiveObras: 3,
    monthlyPriceCents: 7990,
    features: Object.freeze({ ocr: false, signatures: false })
  }),
  pro: Object.freeze({
    id: 'pro',
    label: 'Plano Profissional',
    maxActiveObras: 10,
    monthlyPriceCents: 11990,
    features: Object.freeze({ ocr: true, signatures: true })
  }),
  unlimited: Object.freeze({
    id: 'unlimited',
    label: 'Construtora Ilimitado',
    maxActiveObras: null,
    monthlyPriceCents: 15990,
    features: Object.freeze({ ocr: true, signatures: true })
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
  return !['concluida', 'concluída', 'concluido', 'concluído', 'cancelada', 'cancelado', 'sistema'].includes(s);
}

export function canUseFeature(plan, feature) {
  const rule = getPlanRule(plan);
  return Boolean(rule.features?.[feature]);
}

export function planError(feature, plan) {
  const rule = getPlanRule(plan);
  const names = {
    ocr: 'Leitura OCR com IA',
    signatures: 'Assinatura eletrônica com validação'
  };
  return {
    success: false,
    code: 'PLAN_FEATURE_REQUIRED',
    feature,
    plan: rule.id,
    error: `${names[feature] || 'Este recurso'} não está incluído no ${rule.label}. Faça upgrade do plano para utilizar este recurso.`
  };
}
