// FinObra Patch 10 — script extraído para CSP
window.App = window.App || {
      navigate: function(route) {
        window.location.href = '/app/' + (route || 'dashboard');
      }
    };

    async function verificarSessaoMaster() {
      const flag = sessionStorage.getItem('finobra_master_logged') === 'true';
      let autorizado = false;
      if (flag && Auth.getSession()) {
        try {
          const r = await fetch('/api/auth?action=me', { headers: Auth.getAuthHeaders() });
          const data = await r.json().catch(() => ({}));
          autorizado = !!(r.ok && data.success && data.user?.perfil === 'superadmin');
        } catch {}
      }

      if (autorizado) {
        document.getElementById('master-auth-gate').style.display = 'none';
        document.getElementById('master-app').style.display = 'block';
        MasterAdmin.render('master-content-area');
      } else {
        sessionStorage.removeItem('finobra_master_logged');
        document.getElementById('master-auth-gate').style.display = 'flex';
        document.getElementById('master-app').style.display = 'none';
        setTimeout(() => { const inp = document.getElementById('master-user-input'); if (inp) inp.focus(); }, 100);
      }
    }

    async function executarLoginMaster(e) {
      if (e) e.preventDefault();
      const uInput = (document.getElementById('master-user-input').value || '').trim();
      const pInput = (document.getElementById('master-pass-input').value || '').trim();
      const errBox = document.getElementById('master-err-box');

      if (!uInput || !pInput) {
        errBox.style.display = 'block';
        errBox.textContent = 'Informe usuário e senha de acesso master.';
        return;
      }

      // Valida credenciais com o servidor de autenticação seguro (Neon / scrypt)
      const loginRes = await Auth.login(uInput, pInput, true);
      const user = loginRes.success ? (loginRes.user || Auth.getUser()) : null;
      const isMasterValido = loginRes.success && user?.perfil === 'superadmin';

      if (isMasterValido) {
        sessionStorage.setItem('finobra_master_logged', 'true');
        errBox.style.display = 'none';
        verificarSessaoMaster();
      } else {
        errBox.style.display = 'block';
        errBox.textContent = loginRes.success
          ? 'Acesso negado. Apenas o Super Administrador da plataforma FinObra pode acessar este portal.'
          : (loginRes.message || 'Usuário ou senha incorretos.');
      }
    }

    function alternarVisibilidadeSenha() {
      const inp = document.getElementById('master-pass-input');
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
    }

    function sairMaster() {
      sessionStorage.removeItem('finobra_master_logged');
      document.getElementById('master-pass-input').value = '';
      verificarSessaoMaster();
    }

    window.addEventListener('DOMContentLoaded', () => {
      verificarSessaoMaster();
    });
