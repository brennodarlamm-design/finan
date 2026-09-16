// FinObra — Landing empresarial. Mantém preços e ciclos alinhados ao catálogo do projeto.
(() => {
  'use strict';

  // Mantém o comportamento canônico do Patch 38 mesmo que a landing seja servida
  // por um alias/preview: clicar no logo sempre volta para a raiz pública.
  const brandHomeLink = document.querySelector('a.brand');
  if (brandHomeLink) brandHomeLink.setAttribute('href', '/');

  // Structured data do FAQ é gerado a partir das mesmas perguntas exibidas na página.
  // O JSON-LD anterior de SoftwareApplication/Organization permanece no HTML.
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      ['Posso testar antes de contratar?', 'Sim. O período de teste do projeto é de 15 dias para conhecer o fluxo do sistema antes de escolher um plano.'],
      ['Quantas pessoas podem acessar?', 'O Plano Básico permite 1 usuário, o Profissional 2 usuários e o Construtora Ilimitado 5 usuários ativos.'],
      ['Quantas obras posso gerenciar?', 'O Plano Básico permite até 3 obras ativas, o Profissional até 10 e o Construtora Ilimitado não possui limite de obras ativas.'],
      ['O FinObra funciona no celular?', 'Sim. A interface web é responsiva e pode ser acessada pelo navegador em computador, tablet e celular.'],
      ['Como funciona o suporte?', 'O FinObra possui central de chat, FinBot para dúvidas rápidas e canal de Suporte / Comercial para atendimento da equipe.'],
      ['Onde encontro Privacidade e Termos?', 'Os documentos oficiais continuam disponíveis nas páginas de Política de Privacidade e Termos de Serviço, acessíveis também no rodapé.']
    ].map(([name, text]) => ({
      '@type': 'Question',
      name,
      acceptedAnswer: { '@type': 'Answer', text }
    }))
  };
  const faqSchemaScript = document.createElement('script');
  faqSchemaScript.type = 'application/ld+json';
  faqSchemaScript.textContent = JSON.stringify(faqSchema);
  document.head.appendChild(faqSchemaScript);

  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('visible'));
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', event => {
      const selector = anchor.getAttribute('href');
      if (!selector || selector === '#') return;
      const target = document.querySelector(selector);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const mobileMenu = anchor.closest('details.mobile-menu');
      if (mobileMenu) mobileMenu.removeAttribute('open');
    });
  });

  document.querySelectorAll('.faq details').forEach(details => {
    details.addEventListener('toggle', () => {
      if (!details.open || !window.matchMedia('(max-width: 700px)').matches) return;
      window.setTimeout(() => details.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
    });
  });

  // Fonte espelhada de api/_plans.js. Um teste estático garante que os valores não divirjam.
  const PLAN_DATA = Object.freeze({
    monthly: Object.freeze({
      starter: Object.freeze({ price: 'R$ 119,90', sub: '/ mês', total: 'Cobrança mensal sem fidelidade', wa: 'Olá! Quero conhecer o Plano Básico Mensal do FinObra.' }),
      pro: Object.freeze({ price: 'R$ 279,90', sub: '/ mês', total: 'Cobrança mensal sem fidelidade', wa: 'Olá! Quero conhecer o Plano Profissional Mensal do FinObra.' }),
      unlimited: Object.freeze({ price: 'R$ 499,90', sub: '/ mês', total: 'Cobrança mensal sem fidelidade', wa: 'Olá! Quero conhecer o Plano Construtora Ilimitado Mensal do FinObra.' })
    }),
    quarterly: Object.freeze({
      starter: Object.freeze({ price: 'R$ 113,30', sub: '/ mês', total: 'R$ 339,90 a cada 3 meses • <strong>Economia de R$ 19,80</strong>', wa: 'Olá! Quero conhecer o Plano Básico Trimestral do FinObra.' }),
      pro: Object.freeze({ price: 'R$ 263,30', sub: '/ mês', total: 'R$ 789,90 a cada 3 meses • <strong>Economia de R$ 49,80</strong>', wa: 'Olá! Quero conhecer o Plano Profissional Trimestral do FinObra.' }),
      unlimited: Object.freeze({ price: 'R$ 466,63', sub: '/ mês', total: 'R$ 1.399,90 a cada 3 meses • <strong>Economia de R$ 99,80</strong>', wa: 'Olá! Quero conhecer o Plano Construtora Ilimitado Trimestral do FinObra.' })
    }),
    semiannual: Object.freeze({
      starter: Object.freeze({ price: 'R$ 106,65', sub: '/ mês', total: 'R$ 639,90 a cada 6 meses • <strong>Economia de R$ 79,50</strong>', wa: 'Olá! Quero conhecer o Plano Básico Semestral do FinObra.' }),
      pro: Object.freeze({ price: 'R$ 246,65', sub: '/ mês', total: 'R$ 1.479,90 a cada 6 meses • <strong>Economia de R$ 199,50</strong>', wa: 'Olá! Quero conhecer o Plano Profissional Semestral do FinObra.' }),
      unlimited: Object.freeze({ price: 'R$ 441,65', sub: '/ mês', total: 'R$ 2.649,90 a cada 6 meses • <strong>Economia de R$ 349,50</strong>', wa: 'Olá! Quero conhecer o Plano Construtora Ilimitado Semestral do FinObra.' })
    }),
    annual: Object.freeze({
      starter: Object.freeze({ price: 'R$ 99,91', sub: '/ mês', total: 'R$ 1.199,00/ano • <strong>2 meses grátis (Economia de R$ 239,80)</strong>', wa: 'Olá! Quero conhecer o Plano Básico Anual do FinObra.' }),
      pro: Object.freeze({ price: 'R$ 233,25', sub: '/ mês', total: 'R$ 2.799,00/ano • <strong>2 meses grátis (Economia de R$ 559,80)</strong>', wa: 'Olá! Quero conhecer o Plano Profissional Anual do FinObra.' }),
      unlimited: Object.freeze({ price: 'R$ 416,58', sub: '/ mês', total: 'R$ 4.999,00/ano • <strong>2 meses grátis (Economia de R$ 999,80)</strong>', wa: 'Olá! Quero conhecer o Plano Construtora Ilimitado Anual do FinObra.' })
    })
  });

  const cycleBtns = document.querySelectorAll('.cycle-btn');
  cycleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const cycle = btn.dataset.cycle || 'monthly';
      const data = PLAN_DATA[cycle] || PLAN_DATA.monthly;
      cycleBtns.forEach(candidate => {
        const active = candidate === btn;
        candidate.classList.toggle('active', active);
        candidate.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      ['starter', 'pro', 'unlimited'].forEach(planKey => {
        const plan = data[planKey];
        if (!plan) return;
        const price = document.getElementById(`landing-price-${planKey}`);
        const total = document.getElementById(`landing-total-${planKey}`);
        const cta = document.getElementById(`landing-btn-${planKey}`);
        if (price) price.innerHTML = `${plan.price} <small>${plan.sub}</small>`;
        if (total) total.innerHTML = plan.total;
        if (cta?.href?.includes('wa.me')) cta.href = `https://wa.me/5595991363678?text=${encodeURIComponent(plan.wa)}`;
      });
    });
  });

  const contactForm = document.getElementById('landing-contact-form');
  contactForm?.addEventListener('submit', event => {
    event.preventDefault();
    if (!contactForm.checkValidity()) {
      contactForm.reportValidity();
      return;
    }

    const data = new FormData(contactForm);
    const clean = value => String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 500);
    const name = clean(data.get('name'));
    const email = clean(data.get('email'));
    const company = clean(data.get('company'));
    const phone = clean(data.get('phone'));
    const topic = clean(data.get('topic'));
    const message = clean(data.get('message'));

    const lines = [
      'Olá! Vim pela landing do FinObra e gostaria de falar com a equipe.',
      '',
      `Nome: ${name}`,
      `E-mail: ${email}`,
      company ? `Empresa: ${company}` : null,
      phone ? `Telefone: ${phone}` : null,
      `Assunto: ${topic}`,
      `Mensagem: ${message}`
    ].filter(Boolean);

    window.open(`https://wa.me/5595991363678?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
  });
})();
