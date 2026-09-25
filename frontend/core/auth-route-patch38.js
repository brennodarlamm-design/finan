// FinGo Patch 38 — comportamento específico das rotas públicas de autenticação.
(() => {
  const route = window.location.pathname;
  const isSignup = route === '/cadastro';
  const isLogin = route === '/login' || route === '/login.html';

  if (isSignup) document.title = 'Criar conta | FinGo';
  if (isLogin) document.title = 'Entrar | FinGo';

  window.addEventListener('DOMContentLoaded', () => {
    const registerModal = document.getElementById('register-modal');
    const recoveryModal = document.getElementById('recovery-modal');

    for (const modal of [registerModal, recoveryModal]) {
      if (!modal) continue;
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
    }

    if (registerModal) registerModal.setAttribute('aria-label', 'Cadastrar nova empresa no FinGo');
    if (recoveryModal) recoveryModal.setAttribute('aria-label', 'Recuperar acesso ao FinGo');

    if (isSignup) {
      const title = document.getElementById('welcome-title');
      const subtitle = document.getElementById('welcome-subtitle');
      if (title) title.textContent = 'Crie sua conta no FinGo';
      if (subtitle) subtitle.textContent = 'Comece seu período de teste e configure sua construtora.';
      window.setTimeout(() => document.getElementById('reg-empresa')?.focus(), 180);

      const close = registerModal?.querySelector('[data-fb-click="closeRegisterModal"]');
      close?.addEventListener('click', event => {
        event.preventDefault();
        window.location.assign('/login');
      }, { capture: true });
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const registerModal = document.getElementById('register-modal');
    const recoveryModal = document.getElementById('recovery-modal');
    if (registerModal?.style.display === 'flex') {
      if (isSignup) window.location.assign('/login');
      else if (typeof window.closeRegisterModal === 'function') window.closeRegisterModal();
      return;
    }
    if (recoveryModal?.style.display === 'flex' && typeof window.closeRecoveryModal === 'function') {
      window.closeRecoveryModal();
    }
  });
})();
