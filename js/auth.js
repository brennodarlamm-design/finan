// js/auth.js — Authentication Module

const Auth = {
  USERS_KEY: 'finobra_users',
  SESSION_KEY: 'finobra_session',

  defaultUsers: [
    { id: 'u1', username: 'admin', nome: 'Administrador', email: 'admin@finobra.com', senha: 'admin123', perfil: 'admin', ativo: true, avatar: 'AD' },
    { id: 'u2', username: 'gestor', nome: 'Gestor Obras', email: 'gestor@finobra.com', senha: 'gestor123', perfil: 'gestor', ativo: true, avatar: 'GO' }
  ],

  getUsers() {
    const s = localStorage.getItem(this.USERS_KEY);
    if (!s) { localStorage.setItem(this.USERS_KEY, JSON.stringify(this.defaultUsers)); return this.defaultUsers; }
    return JSON.parse(s);
  },

  login(username, password, remember = false) {
    const users = this.getUsers();
    const user = users.find(u => (u.username === username || u.email === username) && u.senha === password && u.ativo);
    if (!user) return { success: false, message: 'Usuário ou senha incorretos. Verifique os dados e tente novamente.' };
    const session = { userId: user.id, username: user.username, nome: user.nome, perfil: user.perfil, avatar: user.avatar, loginAt: new Date().toISOString(), remember };
    if (remember) localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    else sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return { success: true, user: session };
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.href = 'index.html';
  },

  getSession() {
    const l = localStorage.getItem(this.SESSION_KEY);
    const s = sessionStorage.getItem(this.SESSION_KEY);
    if (l) return JSON.parse(l);
    if (s) return JSON.parse(s);
    return null;
  },

  isLoggedIn() { return !!this.getSession(); },
  getUser() { return this.getSession(); },
  requireAuth() {
    if (!this.isLoggedIn()) { window.location.href = 'index.html'; return false; }
    return true;
  }
};
