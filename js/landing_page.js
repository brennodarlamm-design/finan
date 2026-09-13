// FinObra Patch 10 — script extraído para CSP
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
revealEls.forEach(el => io.observe(el));

// Patch 38: mantém a home canônica em / e evita salto desnecessário via /landing.
const brandHomeLink = document.querySelector('a.brand[href="/landing"]');
if (brandHomeLink) brandHomeLink.setAttribute('href', '/');

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const mobileMenu = a.closest('details.mobile-menu');
      if (mobileMenu) mobileMenu.removeAttribute('open');
    }
  });
});

// Patch 38: em telas pequenas, mantém o conteúdo aberto do FAQ visível.
document.querySelectorAll('.faq details').forEach(details => {
  details.addEventListener('toggle', () => {
    if (!details.open || !window.matchMedia('(max-width: 700px)').matches) return;
    window.setTimeout(() => {
      details.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  });
});

// Seletor de periodicidade dos planos (Opção C)
const PLAN_DATA = {
  monthly: {
    label: 'Mensal',
    starter: { price: 'R$ 119,90', sub: '/ mês', total: 'Cobrança mensal sem fidelidade', wa: 'Olá! Quero conhecer o Plano Básico Mensal do FinObra.' },
    pro: { price: 'R$ 279,90', sub: '/ mês', total: 'Cobrança mensal sem fidelidade', wa: 'Olá! Quero conhecer o Plano Profissional Mensal do FinObra.' },
    unlimited: { price: 'R$ 499,90', sub: '/ mês', total: 'Cobrança mensal sem fidelidade', wa: 'Olá! Quero conhecer o Plano Construtora Ilimitado Mensal do FinObra.' }
  },
  quarterly: {
    label: 'Trimestral',
    starter: { price: 'R$ 113,30', sub: '/ mês', total: 'R$ 339,90 a cada 3 meses • <strong>Economia de R$ 19,80</strong>', wa: 'Olá! Quero conhecer o Plano Básico Trimestral do FinObra.' },
    pro: { price: 'R$ 263,30', sub: '/ mês', total: 'R$ 789,90 a cada 3 meses • <strong>Economia de R$ 49,80</strong>', wa: 'Olá! Quero conhecer o Plano Profissional Trimestral do FinObra.' },
    unlimited: { price: 'R$ 466,63', sub: '/ mês', total: 'R$ 1.399,90 a cada 3 meses • <strong>Economia de R$ 99,80</strong>', wa: 'Olá! Quero conhecer o Plano Construtora Ilimitado Trimestral do FinObra.' }
  },
  semiannual: {
    label: 'Semestral',
    starter: { price: 'R$ 106,65', sub: '/ mês', total: 'R$ 639,90 a cada 6 meses • <strong>Economia de R$ 79,50</strong>', wa: 'Olá! Quero conhecer o Plano Básico Semestral do FinObra.' },
    pro: { price: 'R$ 246,65', sub: '/ mês', total: 'R$ 1.479,90 a cada 6 meses • <strong>Economia de R$ 199,50</strong>', wa: 'Olá! Quero conhecer o Plano Profissional Semestral do FinObra.' },
    unlimited: { price: 'R$ 441,65', sub: '/ mês', total: 'R$ 2.649,90 a cada 6 meses • <strong>Economia de R$ 349,50</strong>', wa: 'Olá! Quero conhecer o Plano Construtora Ilimitado Semestral do FinObra.' }
  },
  annual: {
    label: 'Anual',
    starter: { price: 'R$ 99,91', sub: '/ mês', total: 'R$ 1.199,00/ano • <strong>2 meses grátis (Economia de R$ 239,80)</strong>', wa: 'Olá! Quero conhecer o Plano Básico Anual do FinObra.' },
    pro: { price: 'R$ 233,25', sub: '/ mês', total: 'R$ 2.799,00/ano • <strong>2 meses grátis (Economia de R$ 559,80)</strong>', wa: 'Olá! Quero conhecer o Plano Profissional Anual do FinObra.' },
    unlimited: { price: 'R$ 416,58', sub: '/ mês', total: 'R$ 4.999,00/ano • <strong>2 meses grátis (Economia de R$ 999,80)</strong>', wa: 'Olá! Quero conhecer o Plano Construtora Ilimitado Anual do FinObra.' }
  }
};

const cycleBtns = document.querySelectorAll('.cycle-btn');
cycleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const cycle = btn.dataset.cycle || 'monthly';
    const data = PLAN_DATA[cycle] || PLAN_DATA.monthly;
    cycleBtns.forEach(b => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    ['starter', 'pro', 'unlimited'].forEach(planKey => {
      const pData = data[planKey];
      if (!pData) return;
      const priceEl = document.getElementById(`landing-price-${planKey}`);
      if (priceEl) priceEl.innerHTML = `${pData.price} <small>${pData.sub}</small>`;
      const totalEl = document.getElementById(`landing-total-${planKey}`);
      if (totalEl) totalEl.innerHTML = pData.total;
      const btnEl = document.getElementById(`landing-btn-${planKey}`);
      if (btnEl && btnEl.href && btnEl.href.includes('wa.me')) {
        btnEl.href = `https://wa.me/5595991363678?text=${encodeURIComponent(pData.wa)}`;
      }
    });
  });
});
