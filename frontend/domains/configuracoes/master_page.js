// FinObra Patch 49 — Autenticação Master com MFA / Google Authenticator
window.App = window.App || {
  navigate: function(route) {
    window.location.href = '/app/' + (route || 'dashboard');
  }
};

let currentMfaToken = '';
let currentSetupToken = '';
let isBackupMode = false;

function showMasterError(msg) {
  const errBox = document.getElementById('master-err-box');
  if (!errBox) return;
  if (msg) {
    errBox.style.display = 'block';
    errBox.textContent = msg;
  } else {
    errBox.style.display = 'none';
    errBox.textContent = '';
  }
}

function ensureDevTenantKeysModule() {
  if (globalThis.__finobraDevTenantKeysLoaded) return;
  if (document.querySelector('script[data-finobra-dev-tenant-keys="1"]')) return;

  const script = document.createElement('script');
  script.src = '/js/dev-tenant-keys.js?v=20260915_2';
  script.dataset.finobraDevTenantKeys = '1';
  script.async = true;
  script.onerror = () => console.error('[Master] Falha ao carregar módulo seguro de Chaves das Empresas.');
  document.head.appendChild(script);
}

async function verificarSessaoMaster() {
  const flag = sessionStorage.getItem('finobra_master_logged') === 'true';
  let autorizado = false;
  if (flag && Auth.getSession()) {
    try {
      const r = await Auth._fetchWithTimeout('/api/auth?action=me', { headers: Auth.getAuthHeaders() }, 15000);
      const data = await r.json().catch(() => ({}));
      autorizado = !!(r.ok && data.success && data.user?.perfil === 'superadmin');
    } catch {}
  }

  if (autorizado) {
    document.getElementById('master-auth-gate').style.display = 'none';
    document.getElementById('master-app').style.display = 'block';
    MasterAdmin.render('master-content-area');
    ensureDevTenantKeysModule();
  } else {
    sessionStorage.removeItem('finobra_master_logged');
    document.getElementById('master-auth-gate').style.display = 'flex';
    document.getElementById('master-app').style.display = 'none';
    voltarEtapaLoginMaster();
    setTimeout(() => { const inp = document.getElementById('master-user-input'); if (inp) inp.focus(); }, 100);
  }
}

async function executarLoginMaster(e) {
  if (e) e.preventDefault();
  const uInput = (document.getElementById('master-user-input').value || '').trim();
  const pInput = (document.getElementById('master-pass-input').value || '').trim();

  if (!uInput || !pInput) {
    showMasterError('Informe usuário e senha de acesso master.');
    return;
  }

  showMasterError('');

  // Valida credenciais com o servidor de autenticação seguro (Neon / scrypt / TOTP)
  const loginRes = await Auth.login(uInput, pInput, true, { portal: 'master' });

  // Caso 1: MFA obrigatório mas ainda não configurado (primeiro acesso superadmin)
  if (loginRes.mfa_setup_required && loginRes.mfa_token) {
    currentSetupToken = loginRes.mfa_token;
    await iniciarEtapaSetupMfa(currentSetupToken);
    return;
  }

  // Caso 2: 2FA ativo — solicitar código de 6 dígitos
  if (loginRes.mfa_required && loginRes.mfa_token) {
    currentMfaToken = loginRes.mfa_token;
    iniciarEtapaVerificacaoMfa();
    return;
  }

  // Caso 3: Login concluído diretamente (se autenticado com sucesso e validado)
  const user = loginRes.success ? (loginRes.user || Auth.getUser()) : null;
  const isMasterValido = loginRes.success && user?.perfil === 'superadmin';

  if (isMasterValido) {
    sessionStorage.setItem('finobra_master_logged', 'true');
    showMasterError('');
    verificarSessaoMaster();
  } else {
    let msg = loginRes.message || 'Usuário ou senha incorretos.';
    if (!loginRes.success && (msg.includes('Chave da Empresa') || msg.includes('chave da empresa'))) {
      msg = 'Acesso negado. Este portal é restrito exclusivamente ao Superadministrador da plataforma FinGo.';
    }
    showMasterError(loginRes.success
      ? 'Acesso negado. Apenas o Super Administrador da plataforma FinGo pode acessar este portal.'
      : msg);
  }
}

function iniciarEtapaVerificacaoMfa() {
  document.getElementById('master-step-credentials').style.display = 'none';
  document.getElementById('master-step-setup').style.display = 'none';
  document.getElementById('master-step-mfa').style.display = 'block';
  isBackupMode = false;
  document.getElementById('master-totp-container').style.display = 'block';
  document.getElementById('master-backup-container').style.display = 'none';
  const switchBtn = document.getElementById('master-mfa-switch-btn-text');
  if (switchBtn) switchBtn.textContent = 'Usar código de emergência';
  const totpInp = document.getElementById('master-totp-input');
  if (totpInp) {
    totpInp.value = '';
    totpInp.focus();
  }
}

async function iniciarEtapaSetupMfa(setupToken) {
  document.getElementById('master-step-credentials').style.display = 'none';
  document.getElementById('master-step-mfa').style.display = 'none';
  document.getElementById('master-step-setup').style.display = 'block';

  const qrContainer = document.getElementById('master-qrcode-container');
  if (qrContainer) qrContainer.innerHTML = '<span style="color:#94a3b8;font-size:.8rem;">Gerando chave segura...</span>';

  const setupData = await Auth.setupMfa(setupToken);
  if (!setupData || !setupData.success) {
    showMasterError(setupData?.error || 'Erro ao inicializar configuração do 2FA.');
    return;
  }

  // Atualiza o token para o de confirmação retornado pelo servidor
  const confirmToken = setupData.setup_token || setupData.mfa_token;
  if (confirmToken) currentSetupToken = confirmToken;

  if (qrContainer && setupData.qr_svg) {
    qrContainer.innerHTML = setupData.qr_svg;
  }

  const secretDisplay = document.getElementById('master-secret-key-display');
  if (secretDisplay) {
    secretDisplay.textContent = setupData.secret_formatted || setupData.secret || '...';
    secretDisplay.setAttribute('data-secret-raw', setupData.secret || '');
  }

  const backupCodesGrid = document.getElementById('master-setup-backup-codes');
  if (backupCodesGrid && Array.isArray(setupData.backup_codes)) {
    backupCodesGrid.innerHTML = setupData.backup_codes.map(code =>
      `<div style="padding:3px 4px;background:rgba(255,255,255,.05);border-radius:4px;">${code}</div>`
    ).join('');
  }

  const setupInp = document.getElementById('master-setup-totp-input');
  if (setupInp) {
    setupInp.value = '';
    setupInp.focus();
  }
}

async function executarVerificacaoMfa(e) {
  if (e) e.preventDefault();
  showMasterError('');

  if (isBackupMode) {
    const backupCode = (document.getElementById('master-backup-input').value || '').trim();
    if (!backupCode) {
      showMasterError('Informe o código de emergência para autenticação.');
      return;
    }
    const res = await Auth.verifyMfa(currentMfaToken, '', backupCode);
    processarResultadoMfa(res);
  } else {
    const totpCode = (document.getElementById('master-totp-input').value || '').trim().replace(/\s+/g, '');
    if (!totpCode || totpCode.length !== 6) {
      showMasterError('Digite o código de 6 dígitos gerado pelo Google Authenticator.');
      return;
    }
    const res = await Auth.verifyMfa(currentMfaToken, totpCode, '');
    processarResultadoMfa(res);
  }
}

async function executarAtivacaoMfa(e) {
  if (e) e.preventDefault();
  showMasterError('');

  const totpCode = (document.getElementById('master-setup-totp-input').value || '').trim().replace(/\s+/g, '');
  if (!totpCode || totpCode.length !== 6) {
    showMasterError('Digite o código de 6 dígitos exibido no Google Authenticator.');
    return;
  }

  const res = await Auth.activateMfa(currentSetupToken, totpCode);
  processarResultadoMfa(res);
}

function processarResultadoMfa(res) {
  const user = res.success ? (res.user || Auth.getUser()) : null;
  const isMasterValido = res.success && user?.perfil === 'superadmin';

  if (isMasterValido) {
    sessionStorage.setItem('finobra_master_logged', 'true');
    showMasterError('');
    verificarSessaoMaster();
  } else {
    showMasterError(res.message || res.error || 'Código incorreto ou expirado. Tente novamente.');
  }
}

function alternarModoBackupMfa() {
  isBackupMode = !isBackupMode;
  const totpBox = document.getElementById('master-totp-container');
  const backupBox = document.getElementById('master-backup-container');
  const switchBtn = document.getElementById('master-mfa-switch-btn-text');

  if (isBackupMode) {
    totpBox.style.display = 'none';
    backupBox.style.display = 'block';
    if (switchBtn) switchBtn.textContent = '← Voltar para código de 6 dígitos';
    const bInp = document.getElementById('master-backup-input');
    if (bInp) bInp.focus();
  } else {
    totpBox.style.display = 'block';
    backupBox.style.display = 'none';
    if (switchBtn) switchBtn.textContent = 'Usar código de emergência';
    const tInp = document.getElementById('master-totp-input');
    if (tInp) tInp.focus();
  }
}

function voltarEtapaLoginMaster() {
  currentMfaToken = '';
  currentSetupToken = '';
  isBackupMode = false;
  showMasterError('');
  const creds = document.getElementById('master-step-credentials');
  const mfa = document.getElementById('master-step-mfa');
  const setup = document.getElementById('master-step-setup');
  if (creds) creds.style.display = 'block';
  if (mfa) mfa.style.display = 'none';
  if (setup) setup.style.display = 'none';
}

function alternarVisibilidadeSenha() {
  const inp = document.getElementById('master-pass-input');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function sairMaster() {
  sessionStorage.removeItem('finobra_master_logged');
  const pass = document.getElementById('master-pass-input');
  if (pass) pass.value = '';
  verificarSessaoMaster();
}

window.addEventListener('DOMContentLoaded', () => {
  verificarSessaoMaster();

  // Auto-submit inteligente quando o usuário digita o 6º dígito
  const totpInp = document.getElementById('master-totp-input');
  if (totpInp) {
    totpInp.addEventListener('input', () => {
      const clean = totpInp.value.replace(/\D/g, '').slice(0, 6);
      totpInp.value = clean;
      if (clean.length === 6) {
        executarVerificacaoMfa();
      }
    });
  }

  const setupTotpInp = document.getElementById('master-setup-totp-input');
  if (setupTotpInp) {
    setupTotpInp.addEventListener('input', () => {
      const clean = setupTotpInp.value.replace(/\D/g, '').slice(0, 6);
      setupTotpInp.value = clean;
      if (clean.length === 6) {
        executarAtivacaoMfa();
      }
    });
  }
});
