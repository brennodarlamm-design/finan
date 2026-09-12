// FinObra — tratamento de conta inexistente no fluxo de recuperação
(() => {
  const NOT_FOUND_MARKER = 'Não encontramos uma conta cadastrada';

  function recoveryIdentifier() {
    return String(document.getElementById('rec-ident')?.value || '').trim();
  }

  function notFoundMessage(identifier) {
    const isEmail = identifier.includes('@');
    return isEmail
      ? 'Não encontramos uma conta cadastrada com este e-mail.'
      : 'Não encontramos uma conta cadastrada com este usuário ou e-mail.';
  }

  function openRegistrationFromRecovery() {
    const identifier = recoveryIdentifier();

    if (typeof closeRecoveryModal === 'function') closeRecoveryModal();
    if (typeof openRegisterModal === 'function') openRegisterModal();

    if (identifier.includes('@')) {
      const email = document.getElementById('reg-email');
      if (email) email.value = identifier;
    }

    const target = identifier.includes('@')
      ? document.getElementById('reg-nome') || document.getElementById('reg-email')
      : document.getElementById('reg-username');
    setTimeout(() => target?.focus(), 100);
  }

  function decorateRecoveryError() {
    const box = document.getElementById('rec-err-1');
    if (!box || !box.textContent.includes(NOT_FOUND_MARKER)) return;
    if (box.querySelector('[data-finobra-register-cta]')) return;

    const prompt = document.createElement('div');
    prompt.setAttribute('data-finobra-register-cta', 'true');
    prompt.style.marginTop = '10px';

    const question = document.createElement('div');
    question.textContent = 'Quer criar sua conta no FinObra agora?';
    question.style.marginBottom = '10px';
    question.style.color = 'var(--text)';
    question.style.fontWeight = '600';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-primary';
    button.textContent = 'Criar minha conta';
    button.style.marginTop = '0';
    button.addEventListener('click', openRegistrationFromRecovery);

    prompt.append(question, button);
    box.appendChild(prompt);
  }

  if (typeof Auth !== 'undefined' && typeof Auth.solicitarCodigoRecuperacao === 'function') {
    const original = Auth.solicitarCodigoRecuperacao.bind(Auth);
    Auth.solicitarCodigoRecuperacao = async function(identifier) {
      const result = await original(identifier);
      const hasRecoveryId = Boolean(result?.requestId || result?.userId);

      if (result?.success && !hasRecoveryId) {
        return {
          success: false,
          notFound: true,
          message: notFoundMessage(String(identifier || '').trim())
        };
      }

      return result;
    };
  }

  const installObserver = () => {
    const box = document.getElementById('rec-err-1');
    if (!box) return;
    new MutationObserver(decorateRecoveryError).observe(box, {
      childList: true,
      subtree: true,
      characterData: true
    });
    decorateRecoveryError();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installObserver, { once: true });
  } else {
    installObserver();
  }
})();
