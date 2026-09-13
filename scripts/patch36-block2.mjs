import fs from 'fs';

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Patch36 bloco2: trecho não encontrado (${label})`);
  return source.replace(needle, replacement);
}
function replaceBetween(source, start, end, replacement, label) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Patch36 bloco2: intervalo não encontrado (${label})`);
  return source.slice(0, a) + replacement + source.slice(b);
}

// ── Auth: plano vira camada anterior ao RBAC também no frontend ──────────────
let auth = fs.readFileSync('js/auth.js','utf8');
auth = replaceOnce(auth,
  "  IMPERSONATION_BACKUP_KEY: 'finobra_master_session_backup',\n\n  defaultUsers: [],\n",
  "  IMPERSONATION_BACKUP_KEY: 'finobra_master_session_backup',\n  _planAccess: null,\n\n  defaultUsers: [],\n",
  'Auth _planAccess');

const oldCanModule = `  canModule(module, action = 'read') {
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
  },`;
const newCanModule = `  getPlanAccess() { return this._planAccess; },

  async refreshPlanAccess() {
    const res = await fetch('/api/plano', { headers:this.getAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.plan) throw new Error(data.error || 'Não foi possível consultar o plano.');
    this._planAccess = data.plan;
    return data.plan;
  },

  isPlanModuleAllowed(module) {
    const role = String(this.getUser()?.perfil || '').toLowerCase();
    if (role === 'superadmin') return true;
    const modules = this._planAccess?.modules;
    if (!Array.isArray(modules) || !modules.length) return true;
    return modules.includes(String(module || ''));
  },

  isPlanRouteLocked(route) {
    const key = String(route || '').toLowerCase();
    const module = this.ROUTE_MODULES[key];
    return Boolean(module && !this.isPlanModuleAllowed(module));
  },

  canModule(module, action = 'read') {
    const u = this.getUser() || {};
    const role = String(u.perfil || 'visualizador').toLowerCase();
    if (role === 'superadmin') return true;
    if (!this.isPlanModuleAllowed(module)) return false;
    if (role === 'admin') return true;
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
  },`;
auth = replaceOnce(auth, oldCanModule, newCanModule, 'Auth plano + RBAC');

auth = replaceOnce(auth,
  "        empresaNome:data.user.empresaNome || current.empresaNome, permissions:data.user.permissions || {},\n        sessionId:data.user.sessionId || current.sessionId,\n",
  "        empresaNome:data.user.empresaNome || current.empresaNome, permissions:data.user.permissions || {},\n        tenantPlan:data.user.tenantPlan || current.tenantPlan, tenantStatus:data.user.tenantStatus || current.tenantStatus,\n        sessionId:data.user.sessionId || current.sessionId,\n",
  'persistir tenantPlan');
fs.writeFileSync('js/auth.js', auth, 'utf8');

// ── App: carrega regra de plano antes do shell e mostra módulos bloqueados ───
let app = fs.readFileSync('js/app.js','utf8');
app = replaceOnce(app,
  "      const firstCheck = await Auth.refreshSessionFromServer();\n      if (firstCheck?.expired) return;\n    }\n\n    this._installErrorMonitor();\n",
  "      const firstCheck = await Auth.refreshSessionFromServer();\n      if (firstCheck?.expired) return;\n    }\n    if (typeof Auth.refreshPlanAccess === 'function' && navigator.onLine !== false) {\n      try { await Auth.refreshPlanAccess(); } catch (e) { console.warn('[Plano] Interface usando acesso em cache até nova consulta:', e?.message || e); }\n    }\n\n    this._installErrorMonitor();\n",
  'App carrega plano antes do shell');

const navStart = "  _navItem(route, icon, label, badgeHtml = '') {";
const navEnd = "  _firstAllowedRoute() {";
const navBlock = `  _navItem(route, icon, label, badgeHtml = '') {
    const targetRoute = this._normalizeRoute(route);
    if (typeof Auth !== 'undefined' && Auth.canRoute && !Auth.canRoute(targetRoute, 'read')) {
      if (Auth.isPlanRouteLocked?.(targetRoute)) {
        return \`<div class="nav-item" style="opacity:.72;border:1px dashed rgba(201,162,39,.22);" data-fb-click="Cobranca.showLockedModule" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="\${encodeURIComponent(String(targetRoute))}" title="Disponível em outro plano">
          <span>\${icon}</span><span style="flex:1">\${label}</span><span style="font-size:.68rem;color:var(--accent2)">🔒</span>
        </div>\`;
      }
      return '';
    }
    const isAct = (this.route === targetRoute) || (this._normalizeRoute(this.route) === targetRoute);
    return \`<div class="nav-item\${isAct?' active':''}" data-route="\${targetRoute}" data-fb-click="Patch26Actions.navigateCloseSidebar" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="\${encodeURIComponent(String(targetRoute))}">
      <span>\${icon}</span><span>\${label}</span>\${badgeHtml}
    </div>\`;
  },

`;
app = replaceBetween(app, navStart, navEnd, navBlock, 'nav item bloqueado por plano');

app = replaceOnce(app,
  "    if (typeof Auth !== 'undefined' && Auth.canRoute && !Auth.canRoute(targetRoute,'read')) {\n      const fallback = this._firstAllowedRoute();\n      if (targetRoute !== fallback && typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Seu usuário não possui acesso a este módulo.', 'warning');\n      targetRoute = fallback;\n    }\n",
  "    if (typeof Auth !== 'undefined' && Auth.canRoute && !Auth.canRoute(targetRoute,'read')) {\n      if (Auth.isPlanRouteLocked?.(targetRoute) && typeof Cobranca !== 'undefined' && Cobranca.showLockedModule) {\n        Cobranca.showLockedModule(targetRoute);\n        return;\n      }\n      const fallback = this._firstAllowedRoute();\n      if (targetRoute !== fallback && typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Seu usuário não possui acesso a este módulo.', 'warning');\n      targetRoute = fallback;\n    }\n",
  'navigate plano amigável');
fs.writeFileSync('js/app.js', app, 'utf8');

// ── Configurações: consumo de usuários e limite amigável ─────────────────────
let cfg = fs.readFileSync('js/configuracoes.js','utf8');
cfg = replaceOnce(cfg,
  "  _usersCache: null,\n  _auditCache: [],\n",
  "  _usersCache: null,\n  _planUsage: null,\n  _auditCache: [],\n",
  'Config planUsage state');

const loadUsersStart = "  async loadUsers() {";
const loadUsersEnd = "  async loadEmpresaCloud() {";
const loadUsersBlock = `  async loadUsers() {
    try {
      const res = await fetch('/api/users', { headers: Auth.getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !Array.isArray(data.users)) throw new Error(data.error || 'Falha ao carregar usuários.');
      this._usersCache = data.users;
      this._planUsage = data.planUsage || null;
      localStorage.setItem(Auth.USERS_KEY, JSON.stringify(data.users));
      this._refreshUsers();
      return data.users;
    } catch (err) {
      console.warn('[Usuários] Não foi possível atualizar a lista:', err);
      return this._usersCache || Auth.getUsers();
    }
  },

`;
cfg = replaceBetween(cfg, loadUsersStart, loadUsersEnd, loadUsersBlock, 'loadUsers com plano');

const usersRenderStart = "  _renderUsuarios() {";
const userCardStart = "  _userCard(u, session) {";
const usersRenderBlock = `  _renderUsuarios() {
    const users = this._usersCache || Auth.getUsers();
    const session = Auth.getUser();
    const usage = this._planUsage;
    const atLimit = usage?.maxUsers != null && Number(usage.activeUsers || 0) >= Number(usage.maxUsers || 0);
    return \`
    <div class="page-header">
      <div><h1 class="page-title">&#x1F465; Usu&aacute;rios do Sistema</h1><p class="page-sub">Cada pessoa da equipe ocupa 1 acesso do plano. Celular, notebook e outros dispositivos da mesma pessoa n&atilde;o contam como novos usu&aacute;rios.</p></div>
      <div class="page-actions">
        \${['admin','superadmin'].includes(session?.perfil) ? (atLimit
          ? '<button class="btn btn-secondary" data-fb-click="Configuracoes.showUserLimitModal" data-fb-click-n="0">Limite do plano atingido</button>'
          : '<button class="btn btn-primary" data-fb-click="Configuracoes.showUserForm" data-fb-click-n="0">+ Novo Usu&aacute;rio</button>') : ''}
      </div>
    </div>
    \${this._renderUserPlanUsage()}
    <div id="users-list-cards">
      \${users.map(u => this._userCard(u, session)).join('')}
    </div>\`;
  },

  _renderUserPlanUsage() {
    const p = this._planUsage;
    if (!p) return '<div class="card" style="margin-bottom:16px;color:var(--text3);font-size:.82rem;">Consultando limite de usuários do plano…</div>';
    const max = p.maxUsers == null ? 'Ilimitado' : Number(p.maxUsers || 0);
    const active = Number(p.activeUsers || 0);
    const pct = p.maxUsers == null ? 30 : Math.min(100, Math.round((active / Math.max(1, Number(p.maxUsers))) * 100));
    const full = p.maxUsers != null && active >= p.maxUsers;
    return \`<div class="card" style="margin-bottom:18px;border-color:\${full?'rgba(245,158,11,.45)':'var(--border)'};">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
        <div><div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;">\${this._esc(p.planLabel || 'Seu plano')}</div><div style="font-weight:850;font-size:1rem;margin-top:3px;">\${active} de \${max} usuário(s) ativo(s)</div><div style="font-size:.75rem;color:var(--text3);margin-top:4px;">Dispositivos e sess&otilde;es n&atilde;o consomem acessos adicionais.</div></div>
        \${full ? '<button class="btn btn-warning btn-sm" data-fb-click="Cobranca.goToPlans" data-fb-click-n="0">Ver planos com mais acessos</button>' : '<span class="badge badge-success">Acessos disponíveis</span>'}
      </div>
      <div style="height:6px;background:rgba(255,255,255,.06);border-radius:999px;margin-top:12px;overflow:hidden;"><div style="height:100%;width:\${pct}%;background:\${full?'#f59e0b':'var(--accent)'};border-radius:999px;"></div></div>
    </div>\`;
  },

`;
cfg = replaceBetween(cfg, usersRenderStart, userCardStart, usersRenderBlock, 'render usuários e consumo');

cfg = replaceOnce(cfg,
  "    if (fullAdmin) return '<div style=\"padding:12px;border:1px solid var(--border);border-radius:8px;color:var(--text3);font-size:.8rem;\">Administrador possui acesso integral. Para evitar bloqueio administrativo, restri&ccedil;&otilde;es por m&oacute;dulo s&atilde;o aplicadas aos perfis Gestor, Operador e Visualizador.</div>';\n",
  "    if (fullAdmin) return '<div style=\"padding:12px;border:1px solid var(--border);border-radius:8px;color:var(--text3);font-size:.8rem;\">Administrador possui acesso integral <strong>dentro dos módulos contratados no plano</strong>. O plano da empresa continua sendo aplicado pelo servidor.</div>';\n",
  'mensagem admin dentro do plano');

cfg = replaceOnce(cfg,
  "    const u = id ? (this._usersCache || []).find(u => u.id === id) : null;\n    Utils.showModal(`\n",
  "    const u = id ? (this._usersCache || []).find(u => u.id === id) : null;\n    if (!id && this._planUsage?.maxUsers != null && Number(this._planUsage.activeUsers || 0) >= Number(this._planUsage.maxUsers || 0)) { this.showUserLimitModal(); return; }\n    Utils.showModal(`\n",
  'bloquear abertura de novo usuário no limite');

const saveUserStart = "  async saveUser(e, id) {";
const saveUserEnd = "  async toggleAtivo(id, ativo) {";
const saveUserBlock = `  showUserLimitModal(data = this._planUsage || {}) {
    const max = Number(data.limit ?? data.maxUsers ?? 0) || 'o limite contratado';
    const current = Number(data.current ?? data.activeUsers ?? 0);
    const label = this._esc(data.planLabel || data.plan || 'seu plano');
    Utils.showModal(\`<div class="modal" style="max-width:520px"><div class="modal-header"><span class="modal-title">👥 Seu time chegou ao limite do plano</span><button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button></div><div class="modal-body"><div style="padding:16px;border-radius:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);line-height:1.55;"><strong style="display:block;margin-bottom:6px;">\${label}</strong>Você possui <strong>\${current}</strong> usuário(s) ativo(s) e este plano inclui <strong>\${max}</strong>. Celulares, computadores e outros dispositivos da mesma pessoa não consomem usuários extras.</div><p style="color:var(--text3);font-size:.84rem;margin:16px 0 0;">Para adicionar outra pessoa, você pode desativar um acesso que não é mais utilizado ou conhecer um plano com mais usuários.</p></div><div class="modal-footer"><button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Gerenciar usuários</button><button class="btn btn-primary" data-fb-click="Cobranca.goToPlans" data-fb-click-n="0">Ver planos</button></div></div>\`);
  },

  async saveUser(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { nome:fd.get('nome').trim(), username:fd.get('username').trim(), email:fd.get('email').trim(), perfil:fd.get('perfil'), avatar:fd.get('avatar').trim(), senha:fd.get('senha') || undefined, permissions:this._collectPermissionMatrix(e.target) };
    if (!id && (!body.senha || body.senha.length < 8)) { Utils.toast('Senha deve ter pelo menos 8 caracteres!', 'warning'); return; }
    if (id) body.id = id;
    try {
      const res = await fetch('/api/users', { method:id?'PATCH':'POST', headers:Auth.getAuthHeaders(), body:JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (data.code === 'PLAN_USER_LIMIT') { Utils.closeModal(); this.showUserLimitModal(data); return; }
        throw new Error(data.error || 'Falha ao salvar usuário.');
      }
      Utils.toast(id ? 'Usuário atualizado no servidor!' : 'Usuário criado no servidor!', 'success');
      Utils.closeModal(); await this.loadUsers();
    } catch (err) { Utils.toast(err.message || 'Não foi possível salvar o usuário.', 'error'); }
  },

`;
cfg = replaceBetween(cfg, saveUserStart, saveUserEnd, saveUserBlock, 'saveUser amigável');

const toggleStart = "  async toggleAtivo(id, ativo) {";
const toggleEnd = "  showMeuPerfil() {";
const toggleBlock = `  async toggleAtivo(id, ativo) {
    try {
      const res = await fetch('/api/users', { method:'PATCH', headers:Auth.getAuthHeaders(), body:JSON.stringify({ id, ativo:!ativo }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (data.code === 'PLAN_USER_LIMIT') { this.showUserLimitModal(data); return; }
        throw new Error(data.error || 'Falha ao alterar usuário.');
      }
      Utils.toast(ativo ? 'Usuário desativado.' : 'Usuário ativado!', 'info'); await this.loadUsers();
    } catch (err) { Utils.toast(err.message || 'Não foi possível alterar o usuário.', 'error'); }
  },

`;
cfg = replaceBetween(cfg, toggleStart, toggleEnd, toggleBlock, 'toggle usuário amigável');

cfg = replaceOnce(cfg,
  "    const el = document.getElementById('users-list');\n    if (!el) return;\n    const users = this._usersCache || Auth.getUsers();\n    const session = Auth.getUser();\n    el.innerHTML = users.map(u => this._userCard(u, session)).join('');\n",
  "    const el = document.getElementById('users-list-cards');\n    if (!el) return;\n    const users = this._usersCache || Auth.getUsers();\n    const session = Auth.getUser();\n    el.innerHTML = users.map(u => this._userCard(u, session)).join('');\n",
  'refresh users cards');
fs.writeFileSync('js/configuracoes.js', cfg, 'utf8');

// ── Cobranca: Central da Conta responsiva ────────────────────────────────────
let cob = fs.readFileSync('js/cobranca.js','utf8');
const planosStart = "  PLANOS: {";
const planosEnd = "\n\n  getAssinaturas() {";
const planosBlock = `  PLANOS: {
    starter: { id:'starter', nome:'Plano Básico', limiteObras:3, limiteUsuarios:1, valorMensal:79.90, badge:'3 OBRAS • 1 USUÁRIO', destaque:false, ideal:'Operação enxuta e controle essencial', recursos:['3 obras ativas','1 usuário ativo','Obras, financeiro, fornecedores e produtos','Medições, OFX e relatórios','Suporte via sistema / WhatsApp'] },
    pro: { id:'pro', nome:'Plano Profissional', limiteObras:10, limiteUsuarios:2, valorMensal:119.90, badge:'10 OBRAS • 2 USUÁRIOS', destaque:true, ideal:'Construtoras em crescimento e automação', recursos:['10 obras ativas','2 usuários ativos','Tudo do Básico','Pré-Compras, contratos e documentos','NF-e / OCR com IA e assinatura eletrônica','Suporte prioritário'] },
    unlimited: { id:'unlimited', nome:'Construtora Ilimitado', limiteObras:null, limiteUsuarios:5, valorMensal:159.90, badge:'OBRAS ILIMITADAS • 5 USUÁRIOS', destaque:false, ideal:'Engenharia e operação em escala', recursos:['Obras ilimitadas','5 usuários ativos','Tudo do Profissional','SINAPI / Caixa','Curva S, EVM, ABC e BDI','Permissões avançadas e suporte VIP'] }
  },`;
cob = replaceBetween(cob, planosStart, planosEnd, planosBlock, 'config planos frontend');

const accountStart = "  // ── RENDERIZAÇÃO DA TELA DE PLANOS E ASSINATURA (/app/planos) ────────────────";
const selectStart = "  selecionarPlano(planoId) {";
const accountBlock = `  // ── CENTRAL DA CONTA / ASSINATURA ───────────────────────────────────────────
  _accountData: null,
  _accountTab: 'visao',

  _ensureAccountStyles() {
    if (document.getElementById('finobra-account-styles')) return;
    const s=document.createElement('style'); s.id='finobra-account-styles'; s.textContent=\`
      .acc-shell{max-width:1180px;margin:0 auto;padding:6px 0 42px}.acc-head{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;flex-wrap:wrap;margin-bottom:20px}.acc-title{font-size:1.7rem;font-weight:900}.acc-sub{color:var(--text3);font-size:.86rem;margin-top:4px}.acc-hero{background:linear-gradient(135deg,#172810,#233919);border:1px solid rgba(201,162,39,.35);border-radius:18px;padding:20px;display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:16px}.acc-plan-name{font-size:1.2rem;font-weight:900;color:var(--accent2)}.acc-tabs{display:flex;gap:6px;overflow:auto;padding:5px;background:rgba(255,255,255,.025);border:1px solid var(--border);border-radius:12px;margin-bottom:18px}.acc-tab{white-space:nowrap;border:0;background:transparent;color:var(--text3);padding:9px 14px;border-radius:8px;font-weight:750;cursor:pointer}.acc-tab.active{background:rgba(201,162,39,.15);color:var(--accent2)}.acc-panel{display:none}.acc-panel.active{display:block}.acc-usage-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.acc-kpi{padding:16px;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.025)}.acc-kpi-l{font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}.acc-kpi-v{font-size:1.12rem;font-weight:900;margin-top:5px}.acc-plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.acc-plan-card{border:1px solid var(--border);border-radius:16px;padding:22px;display:flex;flex-direction:column;min-width:0;background:rgba(255,255,255,.02)}.acc-plan-card.featured{border-color:var(--accent);background:linear-gradient(145deg,#172810,#233919)}.acc-mod-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.acc-mod{padding:12px;border:1px solid var(--border);border-radius:10px;display:flex;gap:9px;align-items:center;font-size:.82rem}.acc-billing-table{width:100%;border-collapse:collapse}.acc-billing-table th,.acc-billing-table td{padding:11px 10px;border-bottom:1px solid var(--border);text-align:left;font-size:.8rem}.acc-billing-cards{display:none}.acc-mobile-hint{display:none}.plan-locked-copy{color:var(--text3);font-size:.82rem;line-height:1.55}
      @media(max-width:760px){.acc-shell{padding:0 2px 30px}.acc-head{align-items:flex-start}.acc-title{font-size:1.35rem}.acc-hero{padding:16px}.acc-tabs{margin-left:-2px;margin-right:-2px}.acc-usage-grid{grid-template-columns:1fr 1fr}.acc-plans{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:12px;padding:4px 4px 12px}.acc-plan-card{min-width:86vw;scroll-snap-align:center}.acc-mobile-hint{display:block;color:var(--text3);font-size:.72rem;margin-bottom:8px}.acc-mod-grid{grid-template-columns:1fr}.acc-billing-table{display:none}.acc-billing-cards{display:flex;flex-direction:column;gap:10px}.acc-kpi{padding:13px}.acc-tab{padding:9px 12px}.acc-hero-actions{width:100%}.acc-hero-actions .btn{width:100%;justify-content:center}}
      @media(max-width:420px){.acc-usage-grid{grid-template-columns:1fr}.acc-plan-card{min-width:91vw}}
    \`; document.head.appendChild(s);
  },

  switchAccountTab(tab) {
    this._accountTab = tab || 'visao';
    document.querySelectorAll('.acc-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===this._accountTab));
    document.querySelectorAll('.acc-panel').forEach(x=>x.classList.toggle('active',x.dataset.panel===this._accountTab));
  },

  goToPlans() { if (typeof Utils!=='undefined') Utils.closeModal?.(); if (typeof App!=='undefined') App.navigate('planos'); setTimeout(()=>this.switchAccountTab('planos'),30); },

  showLockedModule(routeOrModule) {
    const module = Auth?.ROUTE_MODULES?.[String(routeOrModule||'')] || String(routeOrModule||'');
    const labels={precompras:'Pré-Compras',contratos:'Contratos',notas:'Notas / NF-e / OCR',orcamentos:'Orçamentos',documentos:'Documentos',assinatura:'Assinatura eletrônica'};
    const name=labels[module] || (App?.routeMeta?.[routeOrModule]?.label) || 'Este módulo';
    const p=Auth?.getPlanAccess?.() || {};
    Utils.showModal(\`<div class="modal" style="max-width:520px"><div class="modal-header"><span class="modal-title">🔒 Recurso disponível em outro plano</span><button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button></div><div class="modal-body"><h3 style="margin:0 0 8px">\${Utils.escapeHtml(name)}</h3><p class="plan-locked-copy">O <strong>\${Utils.escapeHtml(p.label || 'seu plano atual')}</strong> continua ativo normalmente, mas este módulo não faz parte da contratação atual. Nenhum dado foi perdido e os demais módulos seguem disponíveis.</p><div style="margin-top:14px;padding:12px;border:1px solid rgba(201,162,39,.28);background:rgba(201,162,39,.07);border-radius:10px;font-size:.8rem;color:var(--text2)">Você pode conhecer os planos superiores sem alterar sua assinatura agora.</div></div><div class="modal-footer"><button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Continuar no sistema</button><button class="btn btn-primary" data-fb-click="Cobranca.goToPlans" data-fb-click-n="0">Conhecer planos</button></div></div>\`);
  },

  renderTelaPlanos(containerId = 'route-content') {
    const el=document.getElementById(containerId); if(!el)return; this._ensureAccountStyles();
    const ass=this.getAssinaturaAtual(); const u=Auth?.getUser?.()||{}; const emp=DB?.getEmpresa?.()||{}; const canManage=['admin','superadmin'].includes(String(u.perfil||'').toLowerCase());
    const nome=Utils.escapeHtml(emp.nome_fantasia||emp.razao_social||u.empresaNome||'sua empresa'); const plano=this.PLANOS[ass.planoId]||this.PLANOS.pro;
    el.innerHTML=\`<div class="acc-shell"><div class="acc-head"><div><div class="acc-title">Conta & Assinatura</div><div class="acc-sub">Plano, cobranças, módulos e limites da \${nome} em um único lugar.</div></div></div>
      <div class="acc-hero"><div><div style="font-size:.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em">Conta ativa</div><div class="acc-plan-name">\${Utils.escapeHtml(plano.nome)}</div><div style="font-size:.8rem;color:#94a3b8;margin-top:4px" id="acc-plan-status">Consultando assinatura no servidor…</div></div><div class="acc-hero-actions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">\${canManage?'<button class="btn btn-primary" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="planos">Alterar plano</button>':''}<button class="btn btn-secondary" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="cobrancas">Ver cobranças</button></div></div>
      <div class="acc-tabs"><button class="acc-tab active" data-tab="visao" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="visao">Visão geral</button><button class="acc-tab" data-tab="cobrancas" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="cobrancas">Cobranças</button><button class="acc-tab" data-tab="modulos" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="modulos">Módulos</button><button class="acc-tab" data-tab="planos" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="planos">Planos</button></div>
      <section class="acc-panel active" data-panel="visao"><div id="finobra-plan-usage" class="card">Consultando uso atual…</div></section>
      <section class="acc-panel" data-panel="cobrancas"><div id="finobra-billing-history" class="card">Consultando cobranças…</div></section>
      <section class="acc-panel" data-panel="modulos"><div id="finobra-module-list" class="card">Consultando módulos contratados…</div></section>
      <section class="acc-panel" data-panel="planos"><div class="acc-mobile-hint">Deslize para o lado para comparar os planos.</div><div class="acc-plans">\${Object.values(this.PLANOS).map(p=>this._renderCardPlano(p,ass.planoId===p.id,canManage)).join('')}</div></section></div>\`;
    this._carregarUsoPlano();
  },

  async _carregarUsoPlano() {
    const usageBox=document.getElementById('finobra-plan-usage');
    try {
      const headers=DB?._apiHeaders?.()||Auth.getAuthHeaders(); const u=Auth?.getUser?.()||{}; const canManage=['admin','superadmin'].includes(String(u.perfil||'').toLowerCase());
      const res=await fetch(canManage?'/api/plano?billing=1':'/api/plano',{headers}); const json=await res.json().catch(()=>({})); if(!res.ok||!json.success||!json.plan) throw new Error(json.error||'Falha ao consultar plano');
      const p=json.plan; this._accountData=json; if(Auth) Auth._planAccess=p;
      const obrasMax=p.maxActiveObras==null?'Ilimitadas':p.maxActiveObras; const usersMax=p.maxUsers==null?'Ilimitados':p.maxUsers;
      const statusEl=document.getElementById('acc-plan-status'); if(statusEl) statusEl.textContent=\`${p.label||'Plano'} • \${p.status||'ativo'}\${p.vencimento?' • próxima referência '+(Utils.formatDate?Utils.formatDate(p.vencimento):p.vencimento):''}\`;
      if(usageBox) usageBox.innerHTML=\`<div class="acc-usage-grid"><div class="acc-kpi"><div class="acc-kpi-l">Usuários</div><div class="acc-kpi-v">\${Number(p.usage?.activeUsers||0)} / \${usersMax}</div><div style="font-size:.72rem;color:var(--text3);margin-top:4px">Pessoas ativas no plano</div></div><div class="acc-kpi"><div class="acc-kpi-l">Obras ativas</div><div class="acc-kpi-v">\${Number(p.usage?.activeObras||0)} / \${obrasMax}</div><div style="font-size:.72rem;color:var(--text3);margin-top:4px">Obras em andamento</div></div><div class="acc-kpi"><div class="acc-kpi-l">Suporte</div><div class="acc-kpi-v">\${Utils.escapeHtml(p.supportLevel||'Padrão')}</div><div style="font-size:.72rem;color:var(--text3);margin-top:4px">Suporte / Comercial</div></div><div class="acc-kpi"><div class="acc-kpi-l">Mensalidade</div><div class="acc-kpi-v">R$ \${(Number(p.monthlyPriceCents||0)/100).toFixed(2).replace('.',',')}</div><div style="font-size:.72rem;color:var(--text3);margin-top:4px">Sem fidelidade</div></div></div>\`;
      this._renderBillingHistory(json.invoices||[]); this._renderModules(p);
    } catch(e) { if(usageBox) usageBox.textContent='Não foi possível consultar os dados da assinatura agora.'; }
  },

  _renderBillingHistory(invoices=[]) {
    const el=document.getElementById('finobra-billing-history'); if(!el)return; const status={pending:'Pendente',paid:'Pago',expired:'Expirado',canceled:'Cancelado'};
    if(!invoices.length){el.innerHTML='<div style="padding:16px;text-align:center;color:var(--text3)">Nenhuma cobrança registrada ainda.</div>';return;}
    const rows=invoices.map(i=>{const val='R$ '+(Number(i.amount_cents||0)/100).toFixed(2).replace('.',','); const venc=i.expires_at?new Date(i.expires_at).toLocaleDateString('pt-BR'):'—'; const pago=i.paid_at?new Date(i.paid_at).toLocaleDateString('pt-BR'):'—'; return {i,val,venc,pago,s:status[i.status]||i.status||'—'};});
    el.innerHTML=\`<div style="font-weight:900;font-size:1rem;margin-bottom:12px">Histórico de cobranças</div><div style="overflow:auto"><table class="acc-billing-table"><thead><tr><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pagamento</th></tr></thead><tbody>\${rows.map(r=>\`<tr><td>\${Utils.escapeHtml(r.i.competencia||'—')}</td><td>\${r.venc}</td><td><strong>\${r.val}</strong></td><td>\${Utils.escapeHtml(r.s)}</td><td>\${r.pago}</td></tr>\`).join('')}</tbody></table></div><div class="acc-billing-cards">\${rows.map(r=>\`<div class="acc-kpi"><div style="display:flex;justify-content:space-between;gap:10px"><strong>\${Utils.escapeHtml(r.i.competencia||'Cobrança')}</strong><span>\${Utils.escapeHtml(r.s)}</span></div><div style="font-size:1.05rem;font-weight:900;margin:8px 0">\${r.val}</div><div style="font-size:.74rem;color:var(--text3)">Vencimento: \${r.venc} • Pagamento: \${r.pago}</div></div>\`).join('')}</div>\`;
  },

  _renderModules(p) {
    const el=document.getElementById('finobra-module-list'); if(!el)return; const catalog={dashboard:'Dashboard',obras:'Obras & Clientes',financeiro:'Financeiro',fornecedores:'Fornecedores',produtos:'Produtos / Insumos',precompras:'Pré-Compras',recibos:'Recibos',contratos:'Contratos',notas:'Notas / NF-e / OCR',orcamentos:'Orçamentos',medicoes:'Medições',documentos:'Documentos',relatorios:'Relatórios',contas:'Contas Bancárias',whatsapp:'WhatsApp',assinatura:'Assinatura eletrônica',planos:'Conta & Assinatura',configuracoes:'Configurações'}; const allowed=new Set(p.modules||[]);
    el.innerHTML=\`<div style="font-weight:900;font-size:1rem;margin-bottom:6px">Módulos do seu plano</div><div style="font-size:.78rem;color:var(--text3);margin-bottom:14px">Os módulos bloqueados continuam visíveis no menu com um cadeado para você entender o que existe nos demais planos.</div><div class="acc-mod-grid">\${Object.entries(catalog).map(([k,v])=>\`<div class="acc-mod"><span style="color:\${allowed.has(k)?'#22c55e':'#94a3b8'}">\${allowed.has(k)?'✓':'🔒'}</span><span style="flex:1">\${v}</span><span style="font-size:.68rem;color:var(--text3)">\${allowed.has(k)?'Incluído':'Outro plano'}</span></div>\`).join('')}</div>\`;
  },

  _renderCardPlano(plano,isAtual,canManage=false) {
    const feat=plano.destaque; const obras=plano.limiteObras==null?'Ilimitadas':plano.limiteObras; return \`<article class="acc-plan-card \${feat?'featured':''}"><div><div style="font-size:.68rem;color:var(--accent2);font-weight:900;text-transform:uppercase;letter-spacing:.05em">\${Utils.escapeHtml(plano.badge)}</div><h3 style="font-size:1.2rem;margin:8px 0 3px">\${Utils.escapeHtml(plano.nome)}</h3><div style="font-size:.76rem;color:var(--text3);min-height:34px">\${Utils.escapeHtml(plano.ideal)}</div><div style="font-size:2rem;font-weight:900;margin:16px 0">R$ \${plano.valorMensal.toFixed(2).replace('.',',')}<span style="font-size:.75rem;color:var(--text3);font-weight:500">/mês</span></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><span class="badge badge-secondary">👥 \${plano.limiteUsuarios} usuário(s)</span><span class="badge badge-secondary">🏗️ \${obras} obras</span></div><ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px">\${plano.recursos.map(r=>\`<li style="font-size:.8rem;color:var(--text2)">✓ \${Utils.escapeHtml(r)}</li>\`).join('')}</ul></div><div style="margin-top:20px">\${isAtual?'<button class="btn btn-secondary" disabled style="width:100%">✓ Plano atual</button>':canManage?\`<button class="btn btn-primary" style="width:100%" data-fb-click="Cobranca.selecionarPlano" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="\${encodeURIComponent(plano.id)}">Escolher este plano</button>\`:'<button class="btn btn-secondary" disabled style="width:100%">Administrador necessário</button>'}</div></article>\`;
  },

`;
cob = replaceBetween(cob, accountStart, selectStart, accountBlock, 'Central da Conta');
fs.writeFileSync('js/cobranca.js', cob, 'utf8');

// ── Testes do bloco 2 ────────────────────────────────────────────────────────
let test=fs.readFileSync('scripts/test-patch36-static.js','utf8');
test = test.replace("console.log('\\n✅ Patch 36 bloco 1 validado.');", `
const auth=fs.readFileSync('js/auth.js','utf8');
const app=fs.readFileSync('js/app.js','utf8');
const cfg=fs.readFileSync('js/configuracoes.js','utf8');
const cob=fs.readFileSync('js/cobranca.js','utf8');
assert(auth.includes('refreshPlanAccess') && auth.includes('isPlanRouteLocked'),'Frontend consulta plano real antes de decidir módulos.');
assert(app.includes('Cobranca.showLockedModule') && app.includes('Disponível em outro plano'),'Menu explica módulos de outro plano em vez de sumir silenciosamente.');
assert(cfg.includes('Seu time chegou ao limite do plano') && cfg.includes('Dispositivos e sess&otilde;es n&atilde;o consomem'),'Limite de usuários tem tratamento amigável.');
assert(cob.includes('Conta & Assinatura') && cob.includes('Histórico de cobranças') && cob.includes('acc-billing-cards'),'Central da Conta possui plano, cobranças e mobile cards.');
assert(cob.includes('acc-plans{display:flex;overflow-x:auto;scroll-snap-type:x mandatory'),'Planos usam carrossel horizontal no celular em vez de pilha longa.');
console.log('\\n✅ Patch 36 blocos 1–2 validados.');`);
fs.writeFileSync('scripts/test-patch36-static.js',test,'utf8');

console.log('Patch36 bloco 2 aplicado localmente; aguardando regressão.');
