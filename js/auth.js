// js/auth.js — Authentication Module & Multi-Tenant Scoping (Server-Side)

const Auth = {
  USERS_KEY: 'finobra_users',
  SESSION_KEY: 'finobra_session',
  LEGACY_TOKEN_KEY: 'finobra_token',
  IMPERSONATION_BACKUP_KEY: 'finobra_master_session_backup',

  defaultUsers: [],

  MODULES: ['dashboard','obras','financeiro','fornecedores','produtos','precompras','recibos','contratos','notas','orcamentos','medicoes','documentos','relatorios','contas','whatsapp','assinatura','planos','configuracoes'],
  ROUTE_MODULES: {
    dashboard:'dashboard', obras:'obras', clientes:'obras', 'obra-detalhe':'obras',
    lancamentos:'financeiro', financeiro:'financeiro', escritorio:'financeiro', 'conciliacao-ofx':'financeiro', ofx:'financeiro',
    fornecedores:'fornecedores', produtos:'produtos', 'pre-compras':'precompras', precompras:'precompras', recibos:'recibos', contratos:'contratos',
    'notas-fiscais':'notas', notas:'notas', 'consulta-nfe':'notas', nfe:'notas',
    orcamentos:'orcamentos', medicoes:'medicoes', documentacao:'documentos', relatorios:'relatorios', exportar:'relatorios',
    'contas-bancarias':'contas', contas:'contas', planos:'planos', configuracoes:'configuracoes'
  },
  ROLE_CAPS: {
    superadmin:{read:true,write:true,delete:true}, admin:{read:true,write:true,delete:true}, gestor:{read:true,write:true,delete:true},
    operador:{read:true,write:true,delete:false}, visualizador:{read:true,write:false,delete:false}
  },

  getToken() {
    // Patch 11: o navegador não usa mais Bearer. Mantido apenas para evitar quebra
    // de código legado que eventualmente consulte este método.
    return '';
  },

  _purgeLegacyToken() {
    localStorage.removeItem(this.LEGACY_TOKEN_KEY);
    sessionStorage.removeItem(this.LEGACY_TOKEN_KEY);
  },

  getAuthHeaders(customHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...customHeaders };
    const tenantId = this.getCurrentTenantId();
    if (tenantId && tenantId !== 'public') {
      headers['x-tenant-id'] = tenantId;
    }
    return headers;
  },

  getUsers() {
    try {
      const raw = localStorage.getItem(this.USERS_KEY);
      const users = raw ? JSON.parse(raw) : [];
      return Array.isArray(users) ? users : [];
    } catch {
      return [];
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
      tenantId: user.tenantId || user.tenant_id || '',
      empresaNome: user.empresaNome || '',
      realTenantId: user.realTenantId || user.real_tenant_id || '',
      isImpersonated: !!user.isImpersonated,
      impersonatedBy: user.impersonatedBy || '',
      googleAuth: !!user.googleAuth,
      permissions: (user.permissions && typeof user.permissions === 'object') ? user.permissions : {},
      sessionId: user.sessionId || '',
      loginAt: new Date().toISOString(),
      remember: !!remember
    };

    // Patch 10: a credencial fica exclusivamente no cookie HttpOnly emitido pelo servidor.
    // O navegador guarda apenas metadados de UI da sessão.
    this._purgeLegacyToken();

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
      if (resp.ok && data.success && data.user) {
        const session = this.createSession(data.user, remember);
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
      if (resp.ok && data.success && data.user) {
        const session = this.createSession(data.user, true);
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
          requestId: data.requestId,
          canalInfo: 'canal cadastrado',
          expiresInSeconds: Number(data.expiresInSeconds || 600)
        };
      }
      return { success: false, message: data.message || 'Nenhuma conta localizada com este usuário ou e-mail.' };
    } catch (err) {
      return { success: false, message: 'Erro ao contatar o servidor: ' + err.message };
    }
  },

  async validarCodigoRecuperacao(requestId, codigoDigitado) {
    if (!requestId || !codigoDigitado) {
      return { success: false, message: 'Código de verificação obrigatório.' };
    }

    const cleanCode = codigoDigitado.toString().trim().replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      return { success: false, message: 'O código deve conter 6 dígitos numéricos.' };
    }

    // Salva o código temporariamente para ser submetido com a nova senha de forma atômica
    sessionStorage.setItem(`finobra_otp_${requestId}`, cleanCode);
    return { success: true, resetToken: cleanCode };
  },

  async redefinirSenha(requestId, resetToken, novaSenha) {
    if (!requestId || !novaSenha) {
      return { success: false, message: 'Dados incompletos para redefinição de senha.' };
    }

    if (novaSenha.length < 8) {
      return { success: false, message: 'A nova senha deve possuir pelo menos 8 caracteres.' };
    }

    const code = resetToken || sessionStorage.getItem(`finobra_otp_${requestId}`);
    if (!code) {
      return { success: false, message: 'Sessão expirada. Solicite um novo código.' };
    }

    try {
      const resp = await fetch('/api/auth?action=verify_reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, code, newPassword: novaSenha })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        sessionStorage.removeItem(`finobra_otp_${requestId}`);
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
    if (senha.length < 8) {
      return { success: false, message: 'A senha deve ter pelo menos 8 caracteres.' };
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

      // Cookie HttpOnly já foi emitido pelo servidor; persiste somente metadados locais.
      this.createSession(user, true);

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

      return { success: true, user };
    } catch (err) {
      return { success: false, message: 'Falha de comunicação com o servidor: ' + err.message };
    }
  },

  canModule(module, action = 'read') {
    const u = this.getUser() || {};
    const role = String(u.perfil || 'visualizador').toLowerCase();
    if (role === 'superadmin' || role === 'admin') return true;
    const caps = this.ROLE_CAPS[role] || this.ROLE_CAPS.visualizador;
    if (!caps[action]) return false;
    const raw = u.permissions?.[module];
    if (raw === undefined || raw === null) return true;
    if (typeof raw === 'boolean') return raw ? (action === 'read' ? true : !!caps[action]) : false;
    if (typeof raw !== 'object') return true;
    if (raw.read === false) return false;
    if (action === 'delete' && raw.write === false) return false;
    return typeof raw[action] === 'boolean' ? !!raw[action] : true;
  },

  canRoute(route, action = 'read') {
    const key = String(route || '').toLowerCase();
    const module = this.ROUTE_MODULES[key];
    return module ? this.canModule(module, action) : true;
  },

  async listSessions() {
    const res = await fetch('/api/auth?action=sessions', { headers:this.getAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível carregar as sessões.');
    return data;
  },

  async revokeSession(sessionId) {
    const res = await fetch('/api/auth?action=revoke_session', { method:'POST', headers:this.getAuthHeaders(), body:JSON.stringify({ sessionId }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível encerrar a sessão.');
    if (data.currentRevoked) this.handleSessionExpired();
    return data;
  },

  async revokeOtherSessions() {
    const res = await fetch('/api/auth?action=revoke_other_sessions', { method:'POST', headers:this.getAuthHeaders(), body:'{}' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível encerrar as outras sessões.');
    return data;
  },

  getCurrentTenantId() {
    const session = this.getSession();
    if (session?.tenantId) return session.tenantId;
    return 'public';
  },

  async refreshSessionFromServer() {
    const current = this.getSession();
    if (!current) return { success:false, changed:false };
    try {
      const res = await fetch('/api/auth?action=me', { headers:this.getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) { this.handleSessionExpired(); return { success:false, expired:true }; }
      if (!res.ok || !data.success || !data.user) return { success:false, changed:false };
      const next = {
        ...current,
        userId:data.user.id || data.user.userId || current.userId,
        username:data.user.username || current.username, nome:data.user.nome || current.nome, email:data.user.email || current.email,
        perfil:data.user.perfil || current.perfil, avatar:data.user.avatar || current.avatar,
        tenantId:data.user.tenantId || current.tenantId, realTenantId:data.user.realTenantId || current.realTenantId,
        empresaNome:data.user.empresaNome || current.empresaNome, permissions:data.user.permissions || {},
        sessionId:data.user.sessionId || current.sessionId,
        isImpersonated: current.isImpersonated || !!data.user.isImpersonated,
        impersonatedBy: current.impersonatedBy || (data.user.isImpersonated ? 'superadmin' : '')
      };
      const changed = JSON.stringify({perfil:current.perfil,permissions:current.permissions,tenantId:current.tenantId,empresaNome:current.empresaNome}) !== JSON.stringify({perfil:next.perfil,permissions:next.permissions,tenantId:next.tenantId,empresaNome:next.empresaNome});
      const storage = current.remember ? localStorage : sessionStorage;
      storage.setItem(this.SESSION_KEY, JSON.stringify(next));
      // Qualquer token legado usado para esta validação já foi promovido pelo servidor
      // para cookie HttpOnly. Remove a cópia acessível a JavaScript.
      this._purgeLegacyToken();
      return { success:true, changed, user:next, cookieAuth:true };
    } catch { return { success:false, changed:false }; }
  },

  logout() {
    const headers = this.getAuthHeaders();
    fetch('/api/auth?action=logout', { method:'POST', headers, body:'{}', keepalive:true }).catch(() => {});
    this.logoutSilently();
    window.location.replace('/login');
  },

  logoutSilently() {
    const session = this.getSession();
    const tenantId = session?.tenantId || session?.tenant_id;

    // H-16: Expurgo de dados financeiros e operacionais em cache local no logout
    if (typeof localStorage !== 'undefined') {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          // Preserva preferências agnósticas de UI (ex: tema claro/escuro)
          if (k === 'finobra_theme' || k === 'finobra_color_theme') continue;

          if (
            (tenantId && (k.includes(`_${tenantId}_`) || k.includes(`finobra_${tenantId}`))) ||
            k.startsWith('finobra_') ||
            k.startsWith('finobra_sync_') ||
            k.startsWith('finobra_data_') ||
            k.startsWith('finobra_docs_') ||
            k.startsWith('finobra_cache_') ||
            k.startsWith('sinapi_') ||
            k.startsWith('forn_cats_') ||
            k.startsWith('ocr_')
          ) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => {
          try { localStorage.removeItem(k); } catch {}
        });
      } catch (e) {
        console.warn('[Auth] Erro ao expurgar cache no logout:', e);
      }
    }

    localStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
    this._purgeLegacyToken();
    sessionStorage.removeItem(this.IMPERSONATION_BACKUP_KEY);
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
    // O cookie HttpOnly não é legível por JavaScript. A presença do snapshot local
    // indica apenas que há uma sessão candidata; App.init valida online antes de
    // carregar dados quando houver conectividade.
    return !!this.getSession();
  },

  getUser() { return this.getSession(); },

  isImpersonating() {
    return Boolean(this.getSession()?.impersonatedBy === 'superadmin');
  },

  backupSessionForImpersonation() {
    const backup = {
      localSession: localStorage.getItem(this.SESSION_KEY) || '',
      sessionSession: sessionStorage.getItem(this.SESSION_KEY) || ''
    };
    sessionStorage.setItem(this.IMPERSONATION_BACKUP_KEY, JSON.stringify(backup));
    return backup;
  },

  async stopImpersonation() {
    const current = this.getSession();
    if (!current?.impersonatedBy && !current?.isImpersonated) return window.location.replace('/master');

    let backup = null;
    try { backup = JSON.parse(sessionStorage.getItem(this.IMPERSONATION_BACKUP_KEY) || 'null'); } catch {}

    try {
      const res = await fetch('/api/admin?action=restore_master_session', {
        method:'POST',
        headers:this.getAuthHeaders(),
        body:JSON.stringify({ tenantId:current.tenantId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível restaurar a sessão Master.');
    } catch (err) {
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(err.message || 'Falha ao encerrar modo suporte.', 'error');
      return;
    }

    localStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
    this._purgeLegacyToken();
    if (backup?.localSession) localStorage.setItem(this.SESSION_KEY, backup.localSession);
    if (backup?.sessionSession) sessionStorage.setItem(this.SESSION_KEY, backup.sessionSession);

    sessionStorage.removeItem(this.IMPERSONATION_BACKUP_KEY);
    sessionStorage.removeItem('finobra_master_backup_token');
    sessionStorage.removeItem('finobra_master_backup_session');
    sessionStorage.setItem('finobra_master_logged', 'true');
    window.location.replace('/master');
  },

  requireAuth() {
    if (!this.isLoggedIn()) {
      this.handleSessionExpired();
      return false;
    }
    return true;
  }
};
