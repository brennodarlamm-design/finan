// FinObra Patch 10 — script extraído para CSP
if (window.location.hash.startsWith('#validar') || window.location.search.includes('val=')) {
    window.location.href = '/validar' + window.location.search;
  }
  if (window.location.search.includes('expired=1')) {
    Auth.logoutSilently();
    window.addEventListener('DOMContentLoaded', () => {
      const eBox = document.getElementById('err-box');
      if (eBox) {
        eBox.textContent = 'Sua sessão foi redefinida por segurança após atualização do servidor. Por favor, faça login novamente.';
        eBox.style.display = 'block';
      }
    });
  } else if (Auth.isLoggedIn()) {
    window.location.replace('/app');
  }

  // FINOBRA_PATCH37_SIGNUP_ROUTE
  const finobraLoginParams = new URLSearchParams(window.location.search);
  const finobraSignupRoute = window.location.pathname === '/cadastro' || finobraLoginParams.get('cadastro') === '1';
  if (finobraSignupRoute) {
    window.addEventListener('DOMContentLoaded', () => openRegisterModal());
  }



  function openRegisterModal() {
    document.getElementById('register-modal').style.display = 'flex';
  }

  function closeRegisterModal() {
    document.getElementById('register-modal').style.display = 'none';
  }

  document.getElementById('register-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('reg-btn');
    btn.disabled = true;
    btn.textContent = 'Enviando solicitação...';
    document.getElementById('reg-err-box').style.display = 'none';
    const okBox = document.getElementById('reg-ok-box');
    if (okBox) okBox.style.display = 'none';

    const empNome = (document.getElementById('reg-empresa') || {}).value?.trim() || '';
    const nome = (document.getElementById('reg-nome') || {}).value?.trim() || '';
    const cnpj = (document.getElementById('reg-cnpj') || {}).value?.trim() || '';
    const whats = (document.getElementById('reg-whats') || {}).value?.trim() || '';
    const email = (document.getElementById('reg-email') || {}).value?.trim() || '';
    const msg = (document.getElementById('reg-msg') || {}).value?.trim() || '';

    try {
      const resp = await fetch('/api/auth?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ nome, email, telefone: whats, empresaNome: empNome, cnpj, mensagem: msg })
      });
      const data = await resp.json().catch(() => ({}));
      if (data.success && data.commercial_request) {
        if (okBox) {
          okBox.innerHTML = '<strong>✓ Solicitação recebida.</strong><br>Próximo passo: a equipe FinGo valida os dados da construtora e envia as credenciais/chave da empresa pelos canais informados. Para atendimento imediato, use o botão de WhatsApp abaixo.';
          okBox.style.display = 'block';
          okBox.setAttribute('role', 'status');
          okBox.setAttribute('aria-live', 'polite');
        }
        btn.textContent = '✓ Solicitação recebida';
        btn.disabled = true;
      } else {
        throw new Error(data.message || 'Erro ao enviar solicitação. Tente via WhatsApp.');
      }
    } catch (err) {
      const eBox = document.getElementById('reg-err-box');
      eBox.textContent = err.message;
      eBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = '📋 Enviar Solicitação Comercial';
    }
  });

  document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Verificando...';
    document.getElementById('err-box').style.display = 'none';

    try {
      const u = document.getElementById('username').value.trim();
      const p = document.getElementById('password').value;
      const r = document.getElementById('remember').checked;
      const ak = (document.getElementById('accessKey') || {}).value?.trim() || '';
      const result = await Auth.login(u, p, r, { access_key: ak });
      if (result.success) {
        btn.innerHTML = '✓ Bem-vindo! Redirecionando...';
        window.location.replace('/app');
      } else {
        const e2 = document.getElementById('err-box');
        e2.textContent = result.message || 'Usuário ou senha incorretos.';
        e2.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Entrar no Sistema';
      }
    } catch (err) {
      const e2 = document.getElementById('err-box');
      e2.textContent = 'Erro ao processar login: ' + err.message;
      e2.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Entrar no Sistema';
    }
  });

  function togglePwd() {
    const pwd = document.getElementById('password');
    const isHidden = pwd.type === 'password';
    pwd.type = isHidden ? 'text' : 'password';
    document.getElementById('eye-icon').innerHTML = isHidden
      ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
      : '<path d="M2 12c2.5-4 5.8-6 10-6s7.5 2 10 6c-2.5 4-5.8 6-10 6S4.5 16 2 12z"/><circle cx="12" cy="12" r="3"/>';
  }

  // ── GOOGLE SIGN-IN INTEGRATION ──────────────────────────────
  const OFFICIAL_GOOGLE_CLIENT_ID = '260462714670-568cfk38egdla84caeklv3bg2hi2fs0u.apps.googleusercontent.com';
  let googleClientId = localStorage.getItem('finobra_google_client_id') || OFFICIAL_GOOGLE_CLIENT_ID;

  async function onGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;
    const ak = (document.getElementById('accessKey') || {}).value?.trim() || '';
    if (!ak) {
      const eBox = document.getElementById('err-box');
      if (eBox) {
        eBox.textContent = 'Informe a Chave da Empresa (6 dígitos) para entrar com o Google.';
        eBox.style.display = 'block';
      }
      const akInput = document.getElementById('accessKey');
      if (akInput) akInput.focus();
      return;
    }

    const btn = document.getElementById('login-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner"></div> Autenticando com o Google...';
    }
    const result = await Auth.loginWithGoogle(response.credential, { access_key: ak });
    if (result.success) {
      window.location.replace('/app');
    } else {
      const eBox = document.getElementById('err-box');
      eBox.textContent = result.message || 'Erro ao autenticar com o Google.';
      eBox.style.display = 'block';
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Entrar no Sistema';
      }
      if (result.google_needs_company_key) {
        const akInput = document.getElementById('accessKey');
        if (akInput) akInput.focus();
      }
    }
  }

  function initGoogleIdentity() {
    if (window.google && google.accounts && google.accounts.id) {
      try {
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: onGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true
        });

        const container = document.getElementById('google-btn-container');
        const fallbackBtn = document.getElementById('btn-google-login');

        if (container) {
          google.accounts.id.renderButton(container, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 360,
            locale: 'pt-BR'
          });

          // Se o botão oficial foi inserido, esconde o fallback
          setTimeout(() => {
            if (container.children && container.children.length > 0 && fallbackBtn) {
              fallbackBtn.style.display = 'none';
            }
          }, 300);
        }
      } catch (e) {
        console.warn('Google Identity Notice:', e);
      }
    }
  }

  window.addEventListener('load', () => {
    setTimeout(initGoogleIdentity, 300);
    setupOtpInputs();
  });

  function iniciarLoginGoogle() {
    const errBox = document.getElementById('err-box');
    errBox.style.display = 'none';

    const ak = (document.getElementById('accessKey') || {}).value?.trim() || '';
    if (!ak) {
      errBox.textContent = 'Digite a Chave da Empresa (6 dígitos) antes de continuar com o Google.';
      errBox.style.display = 'block';
      const akInput = document.getElementById('accessKey');
      if (akInput) akInput.focus();
      return;
    }

    if (window.google && google.accounts && google.accounts.id) {
      try {
        const officialBtn = document.querySelector('#google-btn-container div[role=button]');
        if (officialBtn) {
          officialBtn.click();
          return;
        }
      } catch (e) {
        console.warn(e);
      }
    }
    errBox.textContent = 'O botão do Google ainda não carregou. Aguarde alguns segundos e tente novamente, ou entre com usuário e senha.';
    errBox.style.display = 'block';
  }

  // ── FLUXO DE RECUPERAÇÃO DE SENHA COM CÓDIGO OTP ─────────────
  let recoveryRequestId = null;
  let recoveryResetToken = null;
  let recoveryTimerInterval = null;
  let recoveryExpiresAt = null;

  function openRecoveryModal() {
    recoveryRequestId = null;
    recoveryResetToken = null;
    clearInterval(recoveryTimerInterval);

    // Reset steps
    document.getElementById('rec-step-1').className = 'recovery-step active';
    document.getElementById('rec-step-2').className = 'recovery-step';
    document.getElementById('rec-step-3').className = 'recovery-step';
    document.getElementById('rec-step-4').className = 'recovery-step';

    document.getElementById('rec-err-1').style.display = 'none';
    document.getElementById('rec-err-2').style.display = 'none';
    document.getElementById('rec-err-3').style.display = 'none';
    document.getElementById('rec-demo-hint').style.display = 'none';

    document.getElementById('rec-ident').value = document.getElementById('username').value.trim();
    const recKeyInput = document.getElementById('rec-company-key');
    if (recKeyInput) {
      recKeyInput.value = (document.getElementById('accessKey') || {}).value?.trim() || '';
    }
    for (let i = 1; i <= 6; i++) {
      const el = document.getElementById('otp-' + i);
      if (el) el.value = '';
    }

    document.getElementById('recovery-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('rec-ident').focus(), 100);
  }

  function closeRecoveryModal() {
    clearInterval(recoveryTimerInterval);
    document.getElementById('recovery-modal').style.display = 'none';
  }

  async function enviarCodigoRecuperacao(isResend = false) {
    const ident = document.getElementById('rec-ident').value.trim();
    const errBox = isResend ? document.getElementById('rec-err-2') : document.getElementById('rec-err-1');
    const btn = isResend ? document.getElementById('rec-resend-btn') : document.getElementById('rec-btn-step-1');

    errBox.style.display = 'none';
    if (!ident) {
      errBox.textContent = 'Por favor, digite seu usuário ou e-mail.';
      errBox.style.display = 'block';
      return;
    }

    const recKeyInput = document.getElementById('rec-company-key');
    const ak = (recKeyInput ? recKeyInput.value : (document.getElementById('accessKey') || {}).value || '').trim();

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Enviando código...';

    try {
      const res = await Auth.solicitarCodigoRecuperacao(ident, { access_key: ak });
      if (!res.success) {
        errBox.textContent = res.message;
        errBox.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = originalText;
        return;
      }

      recoveryRequestId = res.requestId;
      document.getElementById('rec-canal-label').textContent = res.canalInfo || 'canal cadastrado';

      // Exibe lembrete seguro do código na interface
      const hint = document.getElementById('rec-demo-hint');
      if (hint) {
        hint.innerHTML = `📲 Código de validação enviado para o canal cadastrado. Válido por 10 minutos.`;
        hint.style.display = 'block';
      }

      // Muda para Etapa 2
      document.getElementById('rec-step-1').className = 'recovery-step';
      document.getElementById('rec-step-2').className = 'recovery-step active';

      startRecoveryCountdown(10 * 60);
      setTimeout(() => {
        const o1 = document.getElementById('otp-1');
        if (o1) { o1.focus(); o1.select(); }
      }, 150);

    } catch (err) {
      errBox.textContent = 'Erro ao processar solicitação: ' + err.message;
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  function reenviarCodigoRecuperacao() {
    enviarCodigoRecuperacao(true);
  }

  function startRecoveryCountdown(seconds) {
    clearInterval(recoveryTimerInterval);
    const display = document.getElementById('rec-countdown');
    const resendBtn = document.getElementById('rec-resend-btn');
    resendBtn.disabled = true;
    resendBtn.style.opacity = '0.5';

    let remaining = seconds;
    function tick() {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      display.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      if (remaining <= 0) {
        clearInterval(recoveryTimerInterval);
        display.textContent = 'Expirado';
        resendBtn.disabled = false;
        resendBtn.style.opacity = '1';
      }
      remaining--;
    }
    tick();
    recoveryTimerInterval = setInterval(tick, 1000);
  }

  function setupOtpInputs() {
    for (let i = 1; i <= 6; i++) {
      const input = document.getElementById('otp-' + i);
      if (!input) continue;

      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val.slice(0, 1);
        if (val && i < 6) {
          const next = document.getElementById('otp-' + (i + 1));
          if (next) next.focus();
        }
        if (i === 6 && val) {
          verificarCodigoOtp();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && i > 1) {
          const prev = document.getElementById('otp-' + (i - 1));
          if (prev) {
            prev.focus();
            prev.value = '';
          }
        } else if (e.key === 'ArrowLeft' && i > 1) {
          document.getElementById('otp-' + (i - 1)).focus();
        } else if (e.key === 'ArrowRight' && i < 6) {
          document.getElementById('otp-' + (i + 1)).focus();
        } else if (e.key === 'Enter') {
          verificarCodigoOtp();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        if (pasteData) {
          for (let j = 0; j < 6; j++) {
            const el = document.getElementById('otp-' + (j + 1));
            if (el) el.value = pasteData[j] || '';
          }
          if (pasteData.length >= 6) {
            verificarCodigoOtp();
          } else {
            const nextIdx = Math.min(pasteData.length + 1, 6);
            const nextEl = document.getElementById('otp-' + nextIdx);
            if (nextEl) nextEl.focus();
          }
        }
      });
    }
  }

  async function verificarCodigoOtp() {
    const errBox = document.getElementById('rec-err-2');
    errBox.style.display = 'none';

    let code = '';
    for (let i = 1; i <= 6; i++) {
      const val = document.getElementById('otp-' + i).value.trim();
      code += val;
    }

    if (code.length < 6) {
      errBox.textContent = 'Por favor, preencha todos os 6 dígitos do código.';
      errBox.style.display = 'block';
      return;
    }

    const btn = document.getElementById('rec-btn-step-2');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Validando...';

    try {
      const result = await Auth.validarCodigoRecuperacao(recoveryRequestId, code);
      if (!result.success) {
        errBox.textContent = result.message;
        errBox.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<span>Validar Código</span>';
        return;
      }

      recoveryResetToken = result.resetToken;
      clearInterval(recoveryTimerInterval);

      // Avança para Etapa 3 (Nova Senha)
      document.getElementById('rec-step-2').className = 'recovery-step';
      document.getElementById('rec-step-3').className = 'recovery-step active';
      btn.disabled = false;
      btn.innerHTML = '<span>Validar Código</span>';

      setTimeout(() => document.getElementById('rec-new-pwd').focus(), 150);
    } catch (err) {
      errBox.textContent = 'Erro ao validar código: ' + err.message;
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<span>Validar Código</span>';
    }
  }

  async function salvarNovaSenha() {
    const errBox = document.getElementById('rec-err-3');
    errBox.style.display = 'none';

    const p1 = document.getElementById('rec-new-pwd').value;
    const p2 = document.getElementById('rec-conf-pwd').value;

    if (!p1 || p1.length < 8) {
      errBox.textContent = 'A nova senha deve ter no mínimo 8 caracteres.';
      errBox.style.display = 'block';
      return;
    }
    if (p1 !== p2) {
      errBox.textContent = 'As senhas digitadas não coincidem.';
      errBox.style.display = 'block';
      return;
    }

    const btn = document.getElementById('rec-btn-step-3');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Salvando nova senha...';

    try {
      const result = await Auth.redefinirSenha(recoveryRequestId, recoveryResetToken, p1);
      if (!result.success) {
        errBox.textContent = result.message;
        errBox.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<span>Salvar Nova Senha</span>';
        return;
      }

      // Avança para Etapa 4 (Sucesso)
      document.getElementById('rec-step-3').className = 'recovery-step';
      document.getElementById('rec-step-4').className = 'recovery-step active';
    } catch (err) {
      errBox.textContent = 'Erro ao salvar nova senha: ' + err.message;
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<span>Salvar Nova Senha</span>';
    }
  }

  function concluirRecuperacao() {
    closeRecoveryModal();
    const users = Auth.getUsers();
    const user = null;
    if (user) {
      document.getElementById('username').value = user.username;
    }
    document.getElementById('password').value = '';
    document.getElementById('password').focus();
  }
