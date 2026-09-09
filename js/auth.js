// js/auth.js — Authentication Module & Multi-Tenant Scoping (Server-Side & Local Fallback)

const Auth = {
  USERS_KEY: 'finobra_users',
  SESSION_KEY: 'finobra_session',
  TOKEN_KEY: 'finobra_token',

  defaultUsers: [
    {
      id: 'u1',
      username: 'admin',
      nome: 'Administrador (Angelim)',
      email: 'admin@finobra.com',
      perfil: 'admin',
      ativo: true,
      avatar: 'AD',
      tenantId: 'angelim',
      empresaNome: 'Angelim Construtora'
    },
    {
      id: 'u2',
      username: 'gestor',
      nome: 'Gestor Obras',
      email: 'gestor@finobra.com',
      perfil: 'gestor',
      ativo: true,
      avatar: 'GO',
      tenantId: 'angelim',
      empresaNome: 'Angelim Construtora'
    },
    {
      id: 'u_empresa',
      username: 'empresa',
      nome: 'Diretor / Construtor',
      email: 'contato@minhaempresa.com',
      perfil: 'admin',
      ativo: true,
      avatar: 'ME',
      tenantId: 'tenant_empresa_zerada',
      empresaNome: 'Minha Empresa Construtora'
    }
  ],

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY) || '';
  },

  getAuthHeaders(customHeaders = {}) {
    const token = this.getToken();
    const headers = { 'Content-Type': 'application/json', ...customHeaders };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  getUsers() {
    const s = localStorage.getItem(this.USERS_KEY);
    if (!s) {
      localStorage.setItem(this.USERS_KEY, JSON.stringify(this.defaultUsers));
      return this.defaultUsers;
    }
    try {
      let users = JSON.parse(s);
      if (!Array.isArray(users)) users = [...this.defaultUsers];

      let modified = false;
      users = users.map(u => {
        if (!u.tenantId) {
          modified = true;
          return { ...u, tenantId: u.username === 'empresa' ? 'tenant_empresa_zerada' : 'angelim' };
        }
        return u;
      });

      if (!users.some(u => u.username === 'empresa')) {
        users.push(this.defaultUsers.find(u => u.username === 'empresa'));
        modified = true;
      }

      if (modified) {
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
      }
      return users;
    } catch {
      localStorage.setItem(this.USERS_KEY, JSON.stringify(this.defaultUsers));
      return this.defaultUsers;
    }
  },

  createSession(user, remember = false, token = '') {
    const session = {
      userId: user.id || user.userId,
      username: user.username,
      nome: user.nome,
      email: user.email || '',
      perfil: user.perfil || 'admin',
      avatar: user.avatar || (user.nome ? user.nome.slice(0, 2).toUpperCase() : 'US'),
      tenantId: user.tenantId || (user.username === 'empresa' ? 'tenant_empresa_zerada' : 'angelim'),
      empresaNome: user.empresaNome || '',
      googleAuth: !!user.googleAuth,
      loginAt: new Date().toISOString(),
      remember: !!remember
    };

    if (token) {
      if (remember) {
        localStorage.setItem(this.TOKEN_KEY, token);
      } else {
        sessionStorage.setItem(this.TOKEN_KEY, token);
      }
    }

    if (remember) {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    } else {
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    }
    return session;
  },

  // ── AUTENTICAÇÃO COM SERVIDOR NEON (SEM FALLBACKS LOCAIS INSEGUROS) ───────
  async login(username, password, remember = false) {
    if (!username || !password) {
      return { success: false, message: 'Usuário e senha são obrigatórios.' };
    }

    try {
      const resp = await fetch('/api/auth?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success && data.token) {
        const session = this.createSession(data.user, remember, data.token);
        return { success: true, user: session };
      }
      return {
        success: false,
        message: data.message || data.error || 'Usuário ou senha incorretos.'
      };
    } catch (err) {
      console.error('Falha de conexão com o servidor de autenticação:', err);
      return {
        success: false,
        message: 'Não foi possível conectar ao servidor de autenticação. Verifique sua conexão com a internet.'
      };
    }
  },

  async loginWithGoogle(credentialJwt) {
    if (!credentialJwt) {
      return { success: false, message: 'Token de credencial Google não fornecido.' };
    }

    try {
      const resp = await fetch('/api/auth?action=google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialJwt })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success && data.token) {
        const session = this.createSession(data.user, true, data.token);
        return { success: true, user: session, isNew: !!data.isNew };
      }
      return {
        success: false,
        message: data.message || data.error || 'Falha ao autenticar com Google no servidor.'
      };
    } catch (err) {
      console.error('Falha de conexão com o servidor de autenticação Google:', err);
      return {
        success: false,
        message: 'Não foi possível validar o login Google no servidor. Tente novamente em instantes.'
      };
    }
  },

  // ── RECUPERAÇÃO DE SENHA (SERVER-SIDE OTP NO NEON) ─────────────────────────
  async solicitarCodigoRecuperacao(identificador) {
    if (!identificador || !identificador.trim()) {
      return { success: false, message: 'Informe seu usuário ou e-mail cadastrado.' };
    }

    try {
      const resp = await fetch('/api/auth?action=request_reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: identificador.trim() })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        return {
          success: true,
          userId: data.userId,
          userName: data.userName,
          canalInfo: data.canalInfo,
          whatsappNotified: !!data.whatsappSent
        };
      }
      return { success: false, message: data.message || 'Nenhuma conta localizada com este usuário ou e-mail.' };
    } catch (err) {
      return { success: false, message: 'Erro ao contatar o servidor: ' + err.message };
    }
  },

  async validarCodigoRecuperacao(userId, codigoDigitado) {
    if (!userId || !codigoDigitado) {
      return { success: false, message: 'Código de verificação obrigatório.' };
    }

    const cleanCode = codigoDigitado.toString().trim().replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      return { success: false, message: 'O código deve conter 6 dígitos numéricos.' };
    }

    // Salva o código temporariamente para ser submetido com a nova senha de forma atômica
    sessionStorage.setItem(`finobra_otp_${userId}`, cleanCode);
    return { success: true, resetToken: cleanCode };
  },

  async redefinirSenha(userId, resetToken, novaSenha) {
    if (!userId || !novaSenha) {
      return { success: false, message: 'Dados incompletos para redefinição de senha.' };
    }

    if (novaSenha.length < 6) {
      return { success: false, message: 'A nova senha deve possuir pelo menos 6 caracteres.' };
    }

    const code = resetToken || sessionStorage.getItem(`finobra_otp_${userId}`);
    if (!code) {
      return { success: false, message: 'Sessão expirada. Solicite um novo código.' };
    }

    try {
      const resp = await fetch('/api/auth?action=verify_reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code, newPassword: novaSenha })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        sessionStorage.removeItem(`finobra_otp_${userId}`);
        return { success: true, message: data.message || 'Senha redefinida com sucesso!' };
      }
      return { success: false, message: data.message || 'Código incorreto ou expirado.' };
    } catch (err) {
      return { success: false, message: 'Erro ao salvar nova senha no servidor: ' + err.message };
    }
  },

  async register({ nome, username, email, senha, empresaNome, cnpj = '', telefone = '' }) {
    if (!nome || !username || !senha) {
      return { success: false, message: 'Preencha todos os campos obrigatórios (Nome, Usuário e Senha).' };
    }
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (cleanUsername.length < 3) {
      return { success: false, message: 'O nome de usuário deve ter pelo menos 3 caracteres alfanuméricos.' };
    }
    if (senha.length < 6) {
      return { success: false, message: 'A senha deve ter pelo menos 6 caracteres.' };
    }

    try {
      const res = await fetch('/api/auth?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          username: cleanUsername,
          email: (email || '').trim(),
          senha,
          empresaNome: (empresaNome || nome.trim() + ' Construtora').trim(),
          cnpj: (cnpj || '').trim(),
          telefone: (telefone || '').trim()
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, message: data.message || data.error || 'Erro ao registrar conta no servidor.' };
      }

      const user = data.user;
      const token = data.token;

      // Cria sessão autenticada com token JWT recebido
      if (token) {
        this.createSession(user, true, token);
      }

      // Inicializa metadados locais da empresa
      const empresaData = {
        id: user.tenantId,
        razao_social: user.empresaNome || (empresaNome || nome.trim() + ' Construtora').trim(),
        nome_fantasia: user.empresaNome || (empresaNome || nome.trim() + ' Construtora').trim(),
        cnpj: cnpj ? cnpj.trim() : '',
        telefone: telefone ? telefone.trim() : '',
        email: (email || '').trim(),
        cidade: '',
        uf: '',
        endereco: '',
        responsavel: nome.trim(),
        crea_cau: '',
        logo_url: '',
        configurada: true,
        created_at: new Date().toISOString()
      };
      localStorage.setItem(`finobra_${user.tenantId}_empresa`, JSON.stringify(empresaData));
      localStorage.setItem(`finobra_${user.tenantId}_clean_mode`, 'true');

      // Salva usuário no cache local de usuários
      const users = this.getUsers();
      if (!users.some(u => u.username.toLowerCase() === cleanUsername)) {
        users.push(user);
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
      }

      return { success: true, user, token };
    } catch (err) {
      return { success: false, message: 'Falha de comunicação com o servidor: ' + err.message };
    }
  },

  getCurrentTenantId() {
    const session = this.getSession();
    return session?.tenantId || 'angelim';
  },

  logout() {
    this.logoutSilently();
    window.location.replace('/login');
  },

  logoutSilently() {
    localStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
  },

  handleSessionExpired() {
    this.logoutSilently();
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      const isLogin = p === '/' || p === '/login' || p.endsWith('index.html');
      if (!isLogin) {
        window.location.replace('/login?expired=1');
      }
    }
  },

  getSession() {
    const l = localStorage.getItem(this.SESSION_KEY);
    const s = sessionStorage.getItem(this.SESSION_KEY);
    if (l) { try { return JSON.parse(l); } catch {} }
    if (s) { try { return JSON.parse(s); } catch {} }
    return null;
  },

  isLoggedIn() {
    const session = this.getSession();
    const token = this.getToken();
    if (!session || !token) return false;
    if (token.includes('.')) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload.exp && Date.now() > payload.exp) {
            this.logoutSilently();
            return false;
          }
        }
      } catch {
        this.logoutSilently();
        return false;
      }
    }
    return true;
  },

  getUser() { return this.getSession(); },
  requireAuth() {
    if (!this.isLoggedIn()) {
      this.handleSessionExpired();
      return false;
    }
    return true;
  }
};
