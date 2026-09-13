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
