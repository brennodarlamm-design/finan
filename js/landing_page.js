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

// Audit Fix 2.5: Scroll Reveal para seções e cards da landing
(function initScrollReveal() {
  const targets = document.querySelectorAll(
    '.section, .module-card, .plan, .cta-card, .faq details, .support-main, .support-side, .compare-shell'
  );
  if (!targets.length) return;
  targets.forEach(el => el.classList.add('reveal-on-scroll'));

  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('revealed'));
    return;
  }

  const scrollIo = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        scrollIo.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(el => scrollIo.observe(el));
})();

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
    starter: { price: 'R$ 119,90', sub: '/ mês', total: 'Cobrança mensal sem fidelidade', wa: 'Olá! Quero conhecer o Plano Básico Mensal do FinGo.' },
    pro: { price: 'R$ 279,90', sub: '/ mês', total: 'Cobrança mensal sem fidelidade', wa: 'Olá! Quero conhecer o Plano Profissional Mensal do FinGo.' },
    unlimited: { price: 'R$ 499,90', sub: '/ mês', total: 'Cobrança mensal sem fidelidade', wa: 'Olá! Quero conhecer o Plano Construtora Ilimitado Mensal do FinGo.' }
  },
  quarterly: {
    label: 'Trimestral',
    starter: { price: 'R$ 113,30', sub: '/ mês', total: 'R$ 339,90 a cada 3 meses • <strong>Economia de R$ 19,80</strong>', wa: 'Olá! Quero conhecer o Plano Básico Trimestral do FinGo.' },
    pro: { price: 'R$ 263,30', sub: '/ mês', total: 'R$ 789,90 a cada 3 meses • <strong>Economia de R$ 49,80</strong>', wa: 'Olá! Quero conhecer o Plano Profissional Trimestral do FinGo.' },
    unlimited: { price: 'R$ 466,63', sub: '/ mês', total: 'R$ 1.399,90 a cada 3 meses • <strong>Economia de R$ 99,80</strong>', wa: 'Olá! Quero conhecer o Plano Construtora Ilimitado Trimestral do FinGo.' }
  },
  semiannual: {
    label: 'Semestral',
    starter: { price: 'R$ 106,65', sub: '/ mês', total: 'R$ 639,90 a cada 6 meses • <strong>Economia de R$ 79,50</strong>', wa: 'Olá! Quero conhecer o Plano Básico Semestral do FinGo.' },
    pro: { price: 'R$ 246,65', sub: '/ mês', total: 'R$ 1.479,90 a cada 6 meses • <strong>Economia de R$ 199,50</strong>', wa: 'Olá! Quero conhecer o Plano Profissional Semestral do FinGo.' },
    unlimited: { price: 'R$ 441,65', sub: '/ mês', total: 'R$ 2.649,90 a cada 6 meses • <strong>Economia de R$ 349,50</strong>', wa: 'Olá! Quero conhecer o Plano Construtora Ilimitado Semestral do FinGo.' }
  },
  annual: {
    label: 'Anual',
    starter: { price: 'R$ 99,91', sub: '/ mês', total: 'R$ 1.199,00/ano • <strong>2 meses grátis (Economia de R$ 239,80)</strong>', wa: 'Olá! Quero conhecer o Plano Básico Anual do FinGo.' },
    pro: { price: 'R$ 233,25', sub: '/ mês', total: 'R$ 2.799,00/ano • <strong>2 meses grátis (Economia de R$ 559,80)</strong>', wa: 'Olá! Quero conhecer o Plano Profissional Anual do FinGo.' },
    unlimited: { price: 'R$ 416,58', sub: '/ mês', total: 'R$ 4.999,00/ano • <strong>2 meses grátis (Economia de R$ 999,80)</strong>', wa: 'Olá! Quero conhecer o Plano Construtora Ilimitado Anual do FinGo.' }
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

// ── CALCULADORA INTERATIVA DE ROI & DESPERDÍCIO DE CANTEIRO (Skill: frontend-design) ──
function initRoiCalculator() {
  const obrasInput = document.getElementById('roi-input-obras');
  const volumeInput = document.getElementById('roi-input-volume');
  if (!obrasInput || !volumeInput) return;

  const obrasDisplay = document.getElementById('roi-display-obras');
  const volumeDisplay = document.getElementById('roi-display-volume');
  const outHoras = document.getElementById('roi-out-horas');
  const outEconomia = document.getElementById('roi-out-economia');
  const outAnual = document.getElementById('roi-out-anual');
  const outRoi = document.getElementById('roi-out-roi');

  function fmtMoeda(v) {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }

  function recalculate() {
    const obras = Math.max(1, parseInt(obrasInput.value, 10) || 1);
    const volume = Math.max(50000, parseInt(volumeInput.value, 10) || 50000);

    if (obrasDisplay) obrasDisplay.textContent = `${obras} ${obras === 1 ? 'obra ativa' : 'obras ativas'}`;
    if (volumeDisplay) volumeDisplay.textContent = fmtMoeda(volume) + ' / mês';

    // Estimativas auditadas de engenharia civil:
    // 1. Cada obra gera ~14h de retrabalho administrativo/mês (planilhas, digitação de NF-e, cotações manuais).
    const horasSalvas = Math.round(obras * 14);
    // 2. Desvio de custos em compras sem conferência SINAPI/Cotação: ~3,2% do volume gasto.
    const vazamentoEstancado = Math.round(volume * 0.032);
    // 3. Economia anual consolidada (vazamento estancado x 12 + horas técnicas a R$ 80/h).
    const economiaAnual = (vazamentoEstancado * 12) + (horasSalvas * 12 * 80);
    // 4. Custo anual estimado do software (Plano Profissional ~R$ 2.799/ano).
    const custoAnualSoftware = 2799;
    const multiplicadorRoi = Math.max(1, Math.round(economiaAnual / custoAnualSoftware));

    if (outHoras) outHoras.textContent = `${horasSalvas}h`;
    if (outEconomia) outEconomia.textContent = fmtMoeda(vazamentoEstancado);
    if (outAnual) outAnual.textContent = fmtMoeda(economiaAnual);
    if (outRoi) outRoi.textContent = `${multiplicadorRoi}x ROI`;
  }

  obrasInput.addEventListener('input', recalculate);
  volumeInput.addEventListener('input', recalculate);
  recalculate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initRoiCalculator();
    initRemotionVideoPlayers();
  });
} else {
  initRoiCalculator();
  initRemotionVideoPlayers();
}

// ── REMOTION VIDEO ENGINE PLAYERS (Hero & Feature Demo) ──
function initRemotionVideoPlayers() {
  // 1. Hero Video Controller
  const heroVideo = document.getElementById('fingo-hero-video');
  const heroToggle = document.getElementById('hero-video-toggle');
  const heroIcon = document.getElementById('hero-video-icon');
  const heroText = document.getElementById('hero-video-text');

  if (heroVideo && heroToggle) {
    heroToggle.addEventListener('click', () => {
      if (heroVideo.paused) {
        heroVideo.play();
        if (heroIcon) heroIcon.textContent = '⏸';
        if (heroText) heroText.textContent = 'PAUSAR';
      } else {
        heroVideo.pause();
        if (heroIcon) heroIcon.textContent = '▶';
        if (heroText) heroText.textContent = 'REPRODUZIR';
      }
    });
  }

  // 2. Feature Demo Video Interactive Tour
  const featureVideo = document.getElementById('fingo-feature-video');
  const featureOverlay = document.getElementById('feature-video-play-overlay');
  const chapterBtns = document.querySelectorAll('.video-ch-btn');

  if (featureVideo) {
    if (featureOverlay) {
      featureOverlay.addEventListener('click', () => {
        if (featureVideo.paused) {
          featureVideo.play();
          featureOverlay.style.opacity = '0';
          featureOverlay.style.pointerEvents = 'none';
        } else {
          featureVideo.pause();
          featureOverlay.style.opacity = '1';
          featureOverlay.style.pointerEvents = 'auto';
        }
      });

      featureVideo.addEventListener('pause', () => {
        featureOverlay.style.opacity = '1';
        featureOverlay.style.pointerEvents = 'auto';
      });

      featureVideo.addEventListener('play', () => {
        featureOverlay.style.opacity = '0';
        featureOverlay.style.pointerEvents = 'none';
      });
    }

    chapterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const time = parseFloat(btn.dataset.time || '0');
        featureVideo.currentTime = time;
        featureVideo.play();
        chapterBtns.forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    featureVideo.addEventListener('timeupdate', () => {
      const t = featureVideo.currentTime;
      chapterBtns.forEach(btn => {
        const time = parseFloat(btn.dataset.time || '0');
        const isActive = t >= time && t < time + 4;
        btn.classList.toggle('active', isActive);
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Radar FinGo — Newsletter & Gestão de Inscrição / Cancelamento
// ─────────────────────────────────────────────────────────────────────────────
(function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  const input = document.getElementById('newsletter-email');
  const feedback = document.getElementById('newsletter-feedback');
  const optoutToggle = document.getElementById('newsletter-optout-toggle');

  if (!form || !input || !feedback) return;

  async function newsletterRequest(action, email) {
    const res = await fetch(`/api/v2/public/newsletter/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(10000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success !== true) {
      throw new Error(data.message || 'Não foi possível atualizar sua inscrição agora.');
    }
    return data;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = (input.value || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      feedback.style.display = 'block';
      feedback.style.color = '#ef4444';
      feedback.textContent = 'Por favor, informe um endereço de e-mail válido.';
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Confirmando...';
    }

    feedback.style.display = 'block';
    feedback.style.color = '#94a3b8';
    feedback.textContent = 'Confirmando sua inscrição no Radar FinGo...';

    try {
      await newsletterRequest('subscribe', email);

      localStorage.setItem('fingo_newsletter_email', email);
      localStorage.setItem('fingo_newsletter_subscribed', 'true');
      localStorage.setItem('fingo_newsletter_date', new Date().toISOString());

      feedback.style.color = '#C6FF00';
      feedback.textContent = '✓ Inscrição confirmada com sucesso! Você receberá o Radar FinGo com as novidades.';
      input.value = '';
    } catch (err) {
      feedback.style.color = '#ef4444';
      feedback.textContent = err?.name === 'TimeoutError' || err?.name === 'AbortError'
        ? 'Não foi possível confirmar a inscrição agora. Tente novamente em instantes.'
        : (err?.message || 'Não foi possível confirmar a inscrição agora.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  if (optoutToggle) {
    optoutToggle.addEventListener('click', async e => {
      e.preventDefault();
      const current = localStorage.getItem('fingo_newsletter_email') || '';
      const promptEmail = (prompt('Digite seu e-mail para cancelar o recebimento da newsletter:', current) || '').trim().toLowerCase();
      if (!promptEmail || !promptEmail.includes('@')) return;

      feedback.style.display = 'block';
      feedback.style.color = '#94a3b8';
      feedback.textContent = 'Confirmando o cancelamento da inscrição...';

      try {
        await newsletterRequest('unsubscribe', promptEmail);
        localStorage.setItem('fingo_newsletter_email', promptEmail);
        localStorage.setItem('fingo_newsletter_subscribed', 'false');
        feedback.style.color = '#94a3b8';
        feedback.textContent = `Inscrição cancelada para o e-mail: ${promptEmail}. Você não receberá mais os comunicados promocionais.`;
      } catch (err) {
        feedback.style.color = '#ef4444';
        feedback.textContent = err?.name === 'TimeoutError' || err?.name === 'AbortError'
          ? 'Não foi possível confirmar o cancelamento agora. Tente novamente em instantes.'
          : (err?.message || 'Não foi possível confirmar o cancelamento agora.');
      }
    });
  }
})();


