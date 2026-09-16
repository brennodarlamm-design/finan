import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { PLAN_RULES, PLAN_CYCLE_PRICING } from '../api/_plans.js';

const landing = fs.readFileSync('landing.html', 'utf8');
const js = fs.readFileSync('js/landing_page.js', 'utf8');
const terms = fs.readFileSync('termos.html', 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
};

const brl = cents => `R$ ${(Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const syntax = spawnSync(process.execPath, ['--check', 'js/landing_page.js'], { encoding: 'utf8' });
assert(syntax.status === 0, `landing_page.js possui sintaxe válida${syntax.stderr ? `: ${syntax.stderr.trim()}` : ''}`);

assert(landing.includes('class="ui-marketing"'), 'landing continua sendo a home comercial esperada pelo build Cloudflare');
assert(landing.includes('Mais controle.') && landing.includes('Menos retrabalho.') && landing.includes('Mais confiança.'), 'hero comunica controle, redução de retrabalho e confiança');
assert(landing.includes('100% em nuvem') && landing.includes('Segurança & Auditoria'), 'landing destaca nuvem e segurança sem depender de números de clientes');
assert(landing.includes('Suporte humanizado') && landing.includes('Treinamentos & onboarding'), 'suporte humano e treinamentos estão destacados');
assert(landing.includes('id="landing-contact-form"') && js.includes("getElementById('landing-contact-form')"), 'formulário comercial está implementado sem nova API serverless');
assert(js.includes('wa.me/5595991363678'), 'formulário entrega o lead no canal oficial já usado pelo projeto');

assert(landing.includes('href="/privacidade"'), 'rodapé aponta para Política de Privacidade oficial');
assert(landing.includes('href="/termos"'), 'rodapé aponta para Termos de Serviço oficiais');
assert(landing.includes('Código de Conduta e Ética'), 'landing apresenta acesso ao Código de Conduta e Ética usando as regras oficiais de uso');
assert(terms.includes('Uso Aceitável da Plataforma'), 'Termos oficiais contêm as regras de uso aceitável referenciadas pela landing');

assert(!/CNPJ\s*:/i.test(landing), 'CNPJ não é exibido na landing');
assert(!/llms\.txt/i.test(landing), 'llms.txt não é exibido nem vinculado na landing');
assert(!/\+\s*\d+[\d\.]*\s*(empresas|obras|profissionais)/i.test(landing), 'landing não usa contadores comerciais de empresas, obras ou profissionais');

const monthly = {
  starter: PLAN_RULES.starter.monthlyPriceCents,
  pro: PLAN_RULES.pro.monthlyPriceCents,
  unlimited: PLAN_RULES.unlimited.monthlyPriceCents
};
for (const [planId, cents] of Object.entries(monthly)) {
  assert(landing.includes(brl(cents)), `${PLAN_RULES[planId].label} usa o preço mensal canônico ${brl(cents)}`);
}

for (const [planId, cycles] of Object.entries(PLAN_CYCLE_PRICING)) {
  for (const [cycle, price] of Object.entries(cycles)) {
    const monthlyEquivalent = brl(price.monthlyEquivalentCents);
    assert(js.includes(monthlyEquivalent), `${PLAN_RULES[planId].label}/${cycle} mantém equivalente mensal ${monthlyEquivalent}`);
    if (cycle !== 'monthly') assert(js.includes(brl(price.totalCents)), `${PLAN_RULES[planId].label}/${cycle} mantém total ${brl(price.totalCents)}`);
  }
}

assert(landing.includes('1 usuário') && landing.includes('3 obras'), 'Plano Básico mantém limites canônicos');
assert(landing.includes('2 usuários') && landing.includes('10 obras'), 'Plano Profissional mantém limites canônicos');
assert(landing.includes('5 usuários') && landing.includes('Ilimitadas'), 'Construtora Ilimitado mantém limites canônicos');
assert(landing.includes('href="/cadastro"') && landing.includes('href="/login"'), 'CTAs preservam os fluxos existentes de cadastro e login');

console.log('\n✅ Patch 52 landing: conteúdo, preços e vínculos oficiais validados.');
