// js/auth.js — Authentication Module & Multi-Tenant Scoping

const Auth = {
  USERS_KEY: 'finobra_users',
  SESSION_KEY: 'finobra_session',

  defaultUsers: [
    {
      id: 'u1',
      username: 'admin',
      nome: 'Administrador (Angelim)',
      email: 'admin@finobra.com',
      senha: 'admin123',
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
      senha: 'gestor123',
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
      senha: 'empresa123',
      perfil: 'admin',
      ativo: true,
      avatar: 'ME',
      tenantId: 'tenant_empresa_zerada',
      empresaNome: 'Minha Empresa Construtora'
    }
  ],

  getUsers() {
    const s = localStorage.getItem(this.USERS_KEY);
    if (!s) {
      localStorage.setItem(this.USERS_KEY, JSON.stringify(this.defaultUsers));
      return this.defaultUsers;
    }
    try {
      let users = JSON.parse(s);
      if (!Array.isArray(users)) users = [...this.defaultUsers];

      // Migração automática para garantir tenantId em todos os usuários
      let modified = false;
      users = users.map(u => {
        if (!u.tenantId) {
          modified = true;
          return { ...u, tenantId: u.username === 'empresa' ? 'tenant_empresa_zerada' : 'angelim' };
        }
        return u;
      });

      // Garante que o usuário de sistema zerado 'empresa' exista na lista
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

  login(username, password, remember = false) {
    const users = this.getUsers();
    const user = users.find(u => (u.username.toLowerCase() === username.toLowerCase() || (u.email && u.email.toLowerCase() === username.toLowerCase())) && u.senha === password && u.ativo);
    if (!user) return { success: false, message: 'Usuário ou senha incorretos. Verifique os dados e tente novamente.' };
    
    const session = {
      userId: user.id,
      username: user.username,
      nome: user.nome,
      perfil: user.perfil,
      avatar: user.avatar || user.nome.slice(0, 2).toUpperCase(),
      tenantId: user.tenantId || (user.username === 'empresa' ? 'tenant_empresa_zerada' : 'angelim'),
      empresaNome: user.empresaNome || '',
      loginAt: new Date().toISOString(),
      remember
    };

    if (remember) localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    else sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return { success: true, user: session };
  },

  register({ nome, username, email, senha, empresaNome, cnpj = '' }) {
    if (!nome || !username || !senha) {
      return { success: false, message: 'Preencha todos os campos obrigatórios (Nome, Usuário e Senha).' };
    }
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (cleanUsername.length < 3) {
      return { success: false, message: 'O nome de usuário deve ter pelo menos 3 caracteres alfanuméricos.' };
    }
    if (senha.length < 4) {
      return { success: false, message: 'A senha deve ter pelo menos 4 caracteres.' };
    }

    const users = this.getUsers();
    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
      return { success: false, message: 'Este nome de usuário já está em uso. Escolha outro.' };
    }

    const newTenantId = 'tenant_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newUser = {
      id: 'usr_' + Date.now().toString(36),
      username: cleanUsername,
      nome: nome.trim(),
      email: (email || '').trim(),
      senha: senha,
      perfil: 'admin',
      ativo: true,
      avatar: nome.trim().slice(0, 2).toUpperCase(),
      tenantId: newTenantId,
      empresaNome: (empresaNome || nome.trim() + ' Construtora').trim()
    };

    users.push(newUser);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));

    // Inicializa os dados da empresa para este novo tenant
    const empresaData = {
      id: newTenantId,
      razao_social: (empresaNome || nome.trim() + ' Construtora').trim(),
      nome_fantasia: (empresaNome || nome.trim() + ' Construtora').trim(),
      cnpj: cnpj ? cnpj.trim() : '',
      telefone: '',
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
    localStorage.setItem(`finobra_${newTenantId}_empresa`, JSON.stringify(empresaData));
    localStorage.setItem(`finobra_${newTenantId}_clean_mode`, 'true');

    return { success: true, user: newUser };
  },

  getCurrentTenantId() {
    const session = this.getSession();
    return session?.tenantId || 'angelim';
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.href = 'index.html';
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
    if (!this.isLoggedIn()) { window.location.href = 'index.html'; return false; }
    return true;
  }
};

