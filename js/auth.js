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

  // ── AUTENTICAÇÃO COM SERVIDOR NEON & FALLBACK OFFLINE ─────────────────────
  async login(username, password, remember = false) {
    if (!username || !password) {
      return { success: false, message: 'Usuário e senha são obrigatórios.' };
    }

    // 1. Tenta autenticação server-side segura via /api/auth
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
      if (resp.status === 401 || resp.status === 403) {
        return { success: false, message: data.message || 'Usuário ou senha incorretos.' };
      }
    } catch (err) {
      console.warn('Servidor de autenticação inacessível, utilizando fallback local:', err.message);
    }

    // 2. Fallback offline local
    return this._localLogin(username, password, remember);
  },

  _localLogin(username, password, remember = false) {
    const clean = (username || '').trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(u => (u.username.toLowerCase() === clean || (u.email && u.email.toLowerCase() === clean)) && u.ativo);
    
    // Validação compatível com senhas padrão caso offline
    const isKnown = (clean === 'admin' && password === 'admin123') ||
                    (clean === 'gestor' && password === 'gestor123') ||
                    (clean === 'empresa' && password === 'empresa123') ||
                    (user && user.senha && user.senha === password);

    if (!user || !isKnown) {
      return { success: false, message: 'Usuário ou senha incorretos. Verifique os dados e tente novamente.' };
    }

    const session = this.createSession(user, remember);
    return { success: true, user: session };
  },

  decodeJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  },

  async loginWithGoogle(credentialJwt, manualProfile = null) {
    // 1. Tenta autenticação server-side segura no Neon
    try {
      const resp = await fetch('/api/auth?action=google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialJwt, manualProfile })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success && data.token) {
        const session = this.createSession(data.user, true, data.token);
        return { success: true, user: session, isNew: !!data.isNew };
      }
    } catch (err) {
      console.warn('Falha no login Google no servidor, utilizando fallback local:', err);
    }

    // 2. Fallback offline local
    return this._localGoogleLogin(credentialJwt, manualProfile);
  },

  _localGoogleLogin(credentialJwt, manualProfile = null) {
    let payload = null;
    if (credentialJwt) {
      payload = this.decodeJwt(credentialJwt);
    } else if (manualProfile) {
      payload = manualProfile;
    }

    if (!payload || !payload.email) {
      return { success: false, message: 'Falha ao processar credenciais da conta Google.' };
    }

    const email = payload.email.trim().toLowerCase();
    const nome = payload.name || payload.given_name || email.split('@')[0];
    const picture = payload.picture || '';

    const users = this.getUsers();
    let user = users.find(u => (u.email && u.email.toLowerCase() === email) || (u.googleSub && u.googleSub === payload.sub));

    if (user) {
      if (picture && (!user.avatar || user.avatar.length <= 2)) {
        user.avatar = picture;
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
      }
      const session = this.createSession(user, true);
      return { success: true, user: session, isNew: false };
    }

    const newTenantId = 'tenant_google_' + Date.now().toString(36);
    const cleanUsername = email.split('@')[0].replace(/[^a-z0-9._-]/g, '') + '_' + Math.random().toString(36).substr(2, 3);
    const newUser = {
      id: 'usr_g_' + Date.now().toString(36),
      username: cleanUsername,
      nome: nome,
      email: email,
      perfil: 'admin',
      ativo: true,
      avatar: picture || nome.slice(0, 2).toUpperCase(),
      tenantId: newTenantId,
      empresaNome: nome + ' Construtora',
      googleAuth: true,
      googleSub: payload.sub || ''
    };

    users.push(newUser);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));

    const session = this.createSession(newUser, true);
    return { success: true, user: session, isNew: true };
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
    localStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
    window.location.replace('/login');
  },

  getSession() {
    const l = localStorage.getItem(this.SESSION_KEY);
    const s = sessionStorage.getItem(this.SESSION_KEY);
    if (l) { try { return JSON.parse(l); } catch {} }
    if (s) { try { return JSON.parse(s); } catch {} }
    return null;
  },

  isLoggedIn() { return !!this.getSession(); },
  getUser() { return this.getSession(); },
  requireAuth() {
    if (!this.isLoggedIn()) { window.location.replace('/login'); return false; }
    return true;
  }
};
