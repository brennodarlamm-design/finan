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

  createSession(user, remember = false) {
    const session = {
      userId: user.id,
      username: user.username,
      nome: user.nome,
      email: user.email || '',
      perfil: user.perfil || 'admin',
      avatar: user.avatar || user.nome.slice(0, 2).toUpperCase(),
      tenantId: user.tenantId || (user.username === 'empresa' ? 'tenant_empresa_zerada' : 'angelim'),
      empresaNome: user.empresaNome || '',
      googleAuth: !!user.googleAuth,
      loginAt: new Date().toISOString(),
      remember
    };

    if (remember) localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    else sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return session;
  },

  login(username, password, remember = false) {
    const users = this.getUsers();
    const user = users.find(u => (u.username.toLowerCase() === username.toLowerCase() || (u.email && u.email.toLowerCase() === username.toLowerCase())) && u.senha === password && u.ativo);
    if (!user) return { success: false, message: 'Usuário ou senha incorretos. Verifique os dados e tente novamente.' };
    
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

  loginWithGoogle(credentialJwt, manualProfile = null) {
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
      // Usuário existente: atualiza foto de perfil se aplicável
      if (picture && (!user.avatar || user.avatar.length <= 2)) {
        user.avatar = picture;
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
      }
      const session = this.createSession(user, true);
      return { success: true, user: session, isNew: false };
    }

    // Novo usuário via Google: cria automaticamente novo tenant individual
    const newTenantId = 'tenant_google_' + Date.now().toString(36);
    const cleanUsername = email.split('@')[0].replace(/[^a-z0-9._-]/g, '') + '_' + Math.random().toString(36).substr(2, 3);
    const newUser = {
      id: 'usr_g_' + Date.now().toString(36),
      username: cleanUsername,
      nome: nome,
      email: email,
      senha: 'google_oauth_' + Math.random().toString(36),
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

    const empresaData = {
      id: newTenantId,
      razao_social: nome + ' Construtora LTDA',
      nome_fantasia: nome + ' Construtora',
      cnpj: '',
      telefone: '',
      email: email,
      cidade: '',
      uf: '',
      endereco: '',
      responsavel: nome,
      crea_cau: '',
      logo_url: picture,
      configurada: true,
      created_at: new Date().toISOString()
    };
    localStorage.setItem(`finobra_${newTenantId}_empresa`, JSON.stringify(empresaData));
    localStorage.setItem(`finobra_${newTenantId}_clean_mode`, 'true');

    const session = this.createSession(newUser, true);
    return { success: true, user: session, isNew: true };
  },

  // ── RECUPERAÇÃO DE SENHA (FORGOT PASSWORD) ─────────────────────
  async solicitarCodigoRecuperacao(identificador) {
    if (!identificador || !identificador.trim()) {
      return { success: false, message: 'Informe seu usuário ou e-mail cadastrado.' };
    }

    const clean = identificador.trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(u => u.username.toLowerCase() === clean || (u.email && u.email.toLowerCase() === clean));

    if (!user) {
      return { success: false, message: 'Nenhuma conta localizada com este usuário ou e-mail.' };
    }

    // Gera código seguro de 6 dígitos numéricos
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const recoveryData = {
      userId: user.id,
      email: user.email || '',
      code: otpCode,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutos de validade
      tentativas: 0,
      maxTentativas: 4
    };

    sessionStorage.setItem(`finobra_recup_${user.id}`, JSON.stringify(recoveryData));

    // Obtém telefone cadastrado da empresa ou whatsapp
    let destPhone = '';
    try {
      if (typeof DB !== 'undefined' && DB.getEmpresa) {
        const emp = DB.getEmpresa();
        destPhone = (emp?.whatsapp || emp?.telefone || '').replace(/\D/g, '');
      }
    } catch (_) {}
    if (!destPhone) {
      destPhone = (localStorage.getItem('finobra_whatsapp_telefone') || '').replace(/\D/g, '');
    }

    // Tenta envio silencioso via WhatsApp
    let whatsappNotified = false;
    try {
      const resp = await fetch('/api/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: destPhone,
          email: user.email,
          code: otpCode,
          userName: user.nome,
          tenantName: user.empresaNome
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.whatsappSent) {
        whatsappNotified = true;
      }
    } catch (_) {}

    // Formata exibição amigável do destino para o usuário
    let canalInfo = '';
    if (destPhone && destPhone.length >= 8) {
      const ddd = destPhone.slice(-11, -9) || destPhone.slice(0, 2);
      const final = destPhone.slice(-4);
      canalInfo = `WhatsApp (**${ddd}) *****-${final}`;
    } else if (user.email) {
      const parts = user.email.split('@');
      const ini = parts[0].slice(0, 2);
      canalInfo = `E-mail (${ini}***@${parts[1]})`;
    } else {
      canalInfo = 'WhatsApp cadastrado';
    }

    return {
      success: true,
      userId: user.id,
      userName: user.nome,
      canalInfo: canalInfo,
      whatsappNotified,
      code: otpCode // Disponível para agilidade e validação
    };
  },

  validarCodigoRecuperacao(userId, codigoDigitado) {
    if (!userId || !codigoDigitado) {
      return { success: false, message: 'Código de verificação obrigatório.' };
    }

    const raw = sessionStorage.getItem(`finobra_recup_${userId}`);
    if (!raw) {
      return { success: false, message: 'Nenhuma solicitação ativa. Peça um novo código.' };
    }

    try {
      const recovery = JSON.parse(raw);
      if (Date.now() > recovery.expiresAt) {
        sessionStorage.removeItem(`finobra_recup_${userId}`);
        return { success: false, message: 'Este código expirou (validade de 10 min). Solicite outro.' };
      }

      if (recovery.tentativas >= recovery.maxTentativas) {
        sessionStorage.removeItem(`finobra_recup_${userId}`);
        return { success: false, message: 'Limite de tentativas excedido por segurança. Solicite um novo código.' };
      }

      const inputCode = codigoDigitado.toString().trim().replace(/\D/g, '');
      if (inputCode !== recovery.code) {
        recovery.tentativas += 1;
        sessionStorage.setItem(`finobra_recup_${userId}`, JSON.stringify(recovery));
        const restam = recovery.maxTentativas - recovery.tentativas;
        return { success: false, message: `Código incorreto. Você ainda tem ${restam} tentativa(s).` };
      }

      // Código verificado com sucesso: gera token de autorização de troca de senha
      const resetToken = 'rst_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
      recovery.token = resetToken;
      recovery.validado = true;
      sessionStorage.setItem(`finobra_recup_${userId}`, JSON.stringify(recovery));

      return { success: true, resetToken };
    } catch {
      return { success: false, message: 'Erro ao validar código. Tente novamente.' };
    }
  },

  redefinirSenha(userId, resetToken, novaSenha) {
    if (!userId || !resetToken || !novaSenha) {
      return { success: false, message: 'Dados incompletos para redefinição de senha.' };
    }

    if (novaSenha.length < 4) {
      return { success: false, message: 'A nova senha deve possuir pelo menos 4 caracteres.' };
    }

    const raw = sessionStorage.getItem(`finobra_recup_${userId}`);
    if (!raw) {
      return { success: false, message: 'Sessão de redefinição expirada. Inicie o processo novamente.' };
    }

    try {
      const recovery = JSON.parse(raw);
      if (!recovery.validado || recovery.token !== resetToken) {
        return { success: false, message: 'Token de redefinição inválido ou não autorizado.' };
      }

      const users = this.getUsers();
      const user = users.find(u => u.id === userId);
      if (!user) {
        return { success: false, message: 'Usuário não localizado no sistema.' };
      }

      user.senha = novaSenha;
      localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
      sessionStorage.removeItem(`finobra_recup_${userId}`);

      return { success: true, username: user.username, message: 'Senha redefinida com sucesso!' };
    } catch {
      return { success: false, message: 'Erro ao salvar a nova senha.' };
    }
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

