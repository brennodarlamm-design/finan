// js/app.js — Router & App Shell

const App = {
  route: 'dashboard',
  obraId: 'todas',
  _charts: [],
  _errorMonitorInstalled: false,
  _errorFingerprints: new Map(),
  _sessionRefreshTimer: null,

  get currentRoute() { return this.route; },
  set currentRoute(v) { this.route = v; },
  get currentObraId() { return this.obraId; },
  set currentObraId(v) { this.obraId = v; },

  routeAliases: {
    'obras': ['clientes', 'obras'],
    'lancamentos': ['lancamentos', 'financeiro'],
    'escritorio': ['escritorio', 'sede'],
    'pre-compras': ['pre-compras', 'precompras', 'compras'],
    'recibos': ['recibos'],
    'contratos': ['contratos'],
    'notas-fiscais': ['notas-fiscais', 'notas', 'nfs'],
    'consulta-nfe': ['consulta-nfe', 'nfe'],
    'conciliacao-ofx': ['conciliacao-ofx', 'ofx'],
    'orcamentos': ['orcamentos'],
    'medicoes': ['medicoes'],
    'documentacao': ['documentacao', 'docs', 'fases-doc', 'documentos-obra'],
    'relatorios': ['relatorios', 'exportar'],
    'contas-bancarias': ['contas-bancarias', 'contas'],
    'fornecedores': ['fornecedores'],
    'produtos': ['produtos', 'materiais'],
    'configuracoes': ['configuracoes', 'ajustes'],
    'obra-detalhe': ['obra-detalhe', 'obra', 'central-obra', 'dossie', 'cliente-detalhe'],
    'master': ['master', 'dev', 'admin-master', 'tenants', 'empresas'],
    'planos': ['planos', 'cobranca', 'assinaturas', 'mensalidades'],
    'dashboard': ['dashboard', 'inicio', 'home']
  },

  _normalizeRoute(r) {
    if (!r) return 'dashboard';
    const clean = String(r).toLowerCase().trim().replace(/^#\/?/, '').replace(/\/$/, '');
    for (const [canonical, aliases] of Object.entries(this.routeAliases)) {
      if (canonical === clean || aliases.includes(clean)) {
        return canonical;
      }
    }
    return clean;
  },

  routes: {
    'dashboard': Dashboard,
    'obras': Clientes,
    'clientes': Clientes,
    'obra-detalhe': typeof ObraDetalhe !== 'undefined' ? ObraDetalhe : Clientes,
    'lancamentos': Lancamentos,
    'financeiro': Lancamentos,
    'escritorio': Escritorio,
    'pre-compras': PreCompras,
    'precompras': PreCompras,
    'recibos': Recibos,
    'contratos': Contratos,
    'notas-fiscais': Notas,
    'notas': Notas,
    'consulta-nfe': NFe,
    'nfe': NFe,
    'conciliacao-ofx': OFX,
    'ofx': OFX,
    'orcamentos': Orcamentos,
    'medicoes': Medicoes,
    'documentacao': FasesDoc,
    'relatorios': Exportar,
    'exportar': Exportar,
    'contas-bancarias': Contas,
    'contas': Contas,
    'configuracoes': Configuracoes,
    'fornecedores': Fornecedores,
    'produtos': Produtos,
    'master': {
      render() {
        window.location.replace('/master');
        return '<div style="padding:40px;text-align:center;color:var(--text3)"><span style="font-size:1.5rem;display:block;margin-bottom:8px;">🛡️</span>Redirecionando para o Portal Master...</div>';
      }
    },
    'planos': {
      render() {
        setTimeout(() => typeof Cobranca !== 'undefined' && Cobranca.renderTelaPlanos('route-content'), 0);
        return '<div style="padding:40px;text-align:center;color:var(--text3)"><span style="font-size:1.5rem;display:block;margin-bottom:8px;">💎</span>Carregando Planos &amp; Mensalidades...</div>';
      }
    }
  },

  routeMeta: {
    'dashboard':         { icon:'📊', label:'Dashboard' },
    'obras':             { icon:'🏗️', label:'Obras & Clientes' },
    'clientes':          { icon:'🏗️', label:'Obras & Clientes' },
    'obra-detalhe':      { icon:'🏢', label:'Central da Obra' },
    'lancamentos':       { icon:'💰', label:'Lançamentos Financeiros' },
    'financeiro':        { icon:'💰', label:'Lançamentos Financeiros' },
    'escritorio':        { icon:'🏢', label:'Despesas Escritório' },
    'pre-compras':       { icon:'🛒', label:'Ordens de Pré-Compra' },
    'precompras':        { icon:'🛒', label:'Ordens de Pré-Compra' },
    'recibos':           { icon:'🧾', label:'Recibos Oficiais' },
    'contratos':         { icon:'📜', label:'Contratos de Obra' },
    'notas-fiscais':     { icon:'📄', label:'Notas Fiscais' },
    'notas':             { icon:'📄', label:'Notas Fiscais' },
    'consulta-nfe':      { icon:'🔎', label:'Busca NF-e' },
    'nfe':               { icon:'🔎', label:'Busca NF-e' },
    'conciliacao-ofx':   { icon:'🔄', label:'Conciliação OFX' },
    'ofx':               { icon:'🔄', label:'Conciliação OFX' },
    'orcamentos':        { icon:'📋', label:'Orçamentos & SINAPI' },
    'medicoes':          { icon:'🔨', label:'Medições & Faturamento' },
    'documentacao':      { icon:'📋', label:'Documentação de Obras' },
    'relatorios':        { icon:'📥', label:'Relatórios & Exportação' },
    'exportar':          { icon:'📥', label:'Relatórios & Exportação' },
    'contas-bancarias':  { icon:'🏦', label:'Contas Bancárias' },
    'contas':            { icon:'🏦', label:'Contas Bancárias' },
    'fornecedores':      { icon:'🚛', label:'Fornecedores' },
    'produtos':          { icon:'📦', label:'Produtos / Insumos' },
    'configuracoes':     { icon:'⚙️', label:'Configurações' },
    'master':            { icon:'🛡️', label:'Painel Dev Master' },
    'planos':            { icon:'💎', label:'Planos & Mensalidades' },
  },

  _getRouteFromUrl() {
    // 1. Pathname (/app/obras, /app/notas-fiscais, etc.)
    const path = window.location.pathname.replace(/\/$/, '');
    if (path.startsWith('/app/')) {
      const sub = path.substring(5).split('/')[0].split('?')[0];
      if (sub) return this._normalizeRoute(sub);
    } else if (path && path !== '/app' && path !== '/login' && path !== '/validar') {
      const seg = path.replace(/^\//, '').split('/')[0].split('?')[0];
      if (seg && (this.routes[seg] || this._normalizeRoute(seg) !== seg)) {
        return this._normalizeRoute(seg);
      }
    }

    // 2. Hash (#obras, #notas-fiscais, etc.)
    const rawHash = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0];
    if (rawHash) {
      const cleanHash = rawHash.startsWith('app/') ? rawHash.substring(4) : rawHash;
      if (cleanHash) return this._normalizeRoute(cleanHash);
    }

    return 'dashboard';
  },

  async init() {
    const rawPath = window.location.pathname || '';
    const rawHash = window.location.hash || '';
    const rawSearch = window.location.search || '';

    // Rota pública de validação de autenticidade (não exige login!)
    if (rawPath.startsWith('/validar') || rawHash.startsWith('#validar') || rawSearch.includes('val=') || rawHash.includes('val=')) {
      if (typeof Assinador !== 'undefined' && typeof Assinador.renderTelaValidacaoPublica === 'function') {
        Assinador.renderTelaValidacaoPublica();
        return;
      }
    }

    if (!Auth.requireAuth()) return;

    // Patch 10: a credencial real vive em cookie HttpOnly. Antes de abrir dados locais
    // em uma sessão online, confirma no servidor se a sessão continua válida/revogável.
    if (typeof Auth.refreshSessionFromServer === 'function' && navigator.onLine !== false) {
      const firstCheck = await Auth.refreshSessionFromServer();
      if (firstCheck?.expired) return;
    }

    this._installErrorMonitor();
    if (typeof Auth.refreshSessionFromServer === 'function') {
      if (!this._sessionRefreshTimer) this._sessionRefreshTimer = setInterval(() => {
        Auth.refreshSessionFromServer().then(r => {
          if (r?.changed) { this.renderShell(); this._bindSyncStatus(); this.navigate(this.route || 'dashboard', false); }
        }).catch(() => {});
      }, 120000);
    }

    // Inicialização otimista: usa o cache local imediatamente e sincroniza a nuvem em seguida.
    // Isso reduz o tempo de tela bloqueada sem abrir mão da atualização dos dados.
    DB.init();
    this.renderShell();
    this._bindSyncStatus();

    // Histórico e navegação limpa (popstate + hashchange)
    window.addEventListener('popstate', (e) => {
      const target = e.state?.route || this._getRouteFromUrl();
      this.navigate(target, false);
    });

    window.addEventListener('hashchange', () => {
      const target = this._getRouteFromUrl();
      this.navigate(target, true);
    });

    const initialRoute = this._getRouteFromUrl();
    this.navigate(initialRoute, true);

    // Atualiza em segundo plano. Após concluir, redesenha a tela atual com dados frescos.
    Promise.resolve(DB.bootstrapCoreCloud ? DB.bootstrapCoreCloud() : true)
      .then(() => DB.bootstrapCloudCompleteness ? DB.bootstrapCloudCompleteness() : true)
      .then(() => {
      DB.syncFromCloud().then(async (ok) => {
        if (ok) {
          const current = this.route || initialRoute;
          this.renderShell();
          this._bindSyncStatus();
          this.navigate(current, false);
          this.refreshObraSelector();
        }
        if (typeof Assinador !== 'undefined' && Assinador.sincronizarAssinaturasPendentes) {
          Assinador.sincronizarAssinaturasPendentes().catch(() => {});
        }
        // Só decide onboarding depois de tentar carregar o tenant real do servidor.
        const empAtual = DB.getEmpresa();
        const isImpersonating = (typeof Auth !== 'undefined' && Auth.getUser) ? (Auth.getUser()?.impersonatedBy === 'superadmin' || Auth.getUser()?.isImpersonated) : false;
        if (!empAtual.configurada && !isImpersonating) setTimeout(() => this.showOnboardingEmpresa(), 350);
      });
    });

    if (typeof BuscaGlobal !== 'undefined') BuscaGlobal.init();

    // Atalho de teclado global Ctrl+B para recolher/expandir sidebar
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        this.toggleSidebar();
      }
    });
  },

  _bindSyncStatus() {
    if (this._syncStatusBound || typeof window === 'undefined') return;
    this._syncStatusBound = true;
    window.addEventListener('finobra:sync-status', (ev) => {
      const d = ev?.detail || {};
      this._setSyncStatus(d.status, d.pending || 0, d.failed || 0);
    });
    const failed = DB.getSyncFailedCount?.() || 0;
    this._setSyncStatus(failed ? 'attention' : (DB.getSyncPendingCount?.() ? 'pending' : 'cached'), DB.getSyncPendingCount?.() || 0, failed);
  },

  _setSyncStatus(status, pending = 0, failed = 0) {
    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');
    const box = document.getElementById('sync-status-indicator');
    if (!dot || !text || !box) return;
    const states = {
      syncing: ['↻', 'Sincronizando…'],
      synced: ['●', 'Sincronizado'],
      pending: ['●', `${pending || 1} pendente(s)`],
      offline: ['●', 'Offline — cache local'],
      attention: ['⚠', `${failed || 1} requer(em) atenção`],
      cached: ['●', 'Cache local']
    };
    const [d, t] = states[status] || states.cached;
    dot.textContent = d;
    text.textContent = t;
    box.dataset.status = status || 'cached';
  },

  retrySyncIssues() {
    const count = DB.getSyncFailedCount?.() || 0;
    if (!count) {
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Não há sincronizações com erro.', 'info');
      return;
    }
    const retried = DB.retryFailedSyncItems?.() || 0;
    if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(`${retried} alteração(ões) reenviadas para sincronização.`, 'info');
    Utils.closeModal?.();
  },

  showSyncIssues() {
    const items = DB.getSyncFailedItems?.(50) || [];
    if (!items.length) {
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Sincronização sem pendências críticas.', 'info');
      return;
    }
    const esc = (v) => Utils.escapeHtml(String(v ?? ''));
    const rows = items.map(i => `
      <tr>
        <td style="font-weight:700;">${esc(i.table)}</td>
        <td>${esc(i.action)}</td>
        <td style="font-family:monospace;font-size:.72rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(i.entityId)}">${esc(i.entityId || '—')}</td>
        <td style="color:var(--danger);max-width:320px;white-space:normal;">${esc(i.lastError)}</td>
        <td style="text-align:center;">${esc(i.httpStatus || '—')}</td>
      </tr>`).join('');
    Utils.showModal(`
      <div class="modal" style="max-width:900px;width:96vw;">
        <div class="modal-header">
          <span class="modal-title">⚠ Sincronizações que requerem atenção</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:.82rem;color:var(--text2);margin:0 0 14px;">Nenhuma alteração abaixo foi apagada. Você pode tentar reenviar quando a conexão ou o servidor estiver normalizado.</p>
          <div class="table-wrap"><table class="table"><thead><tr><th>Dados</th><th>Ação</th><th>ID</th><th>Motivo</th><th>HTTP</th></tr></thead><tbody>${rows}</tbody></table></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Fechar</button>
          <button class="btn btn-primary" onclick="App.retrySyncIssues()">↻ Tentar novamente</button>
        </div>
      </div>`);
  },

  renderShell() {
    const u = Auth.getUser();
    const emp = DB.getEmpresa();
    const resumoPre = DB.getPreComprasResumo('todas');
    const badgePre = resumoPre.pendentesQtd > 0 ? `<span class="nav-badge" style="background:#f59e0b;color:#182713;font-weight:900;" title="${resumoPre.pendentesQtd} pedido(s) pendente(s)">${resumoPre.pendentesQtd}</span>` : '';

    const brandNameRaw = emp.nome_fantasia || emp.razao_social || 'Minha Empresa';
    const brandName = Utils.escapeHtml(brandNameRaw);
    const safeLogoUrl = Utils.safeUrl(emp.logo_url);
    const logoHtml = safeLogoUrl
      ? `<div style="display:flex;align-items:center;min-width:0;max-width:calc(100% - 28px);overflow:hidden;">
          <div style="display:inline-flex;align-items:center;justify-content:center;padding:2px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(201,162,39,0.25);box-shadow:0 4px 12px rgba(0,0,0,0.35);flex-shrink:0;">
            <img src="${safeLogoUrl}" alt="${brandName}" style="max-height:48px;max-width:185px;width:auto;height:auto;object-fit:contain;border-radius:6px;display:block;">
          </div>
        </div>`
      : `<div style="display:flex;align-items:center;gap:10px;overflow:hidden;width:100%;">
          <div style="width:38px;height:38px;border-radius:8px;background:linear-gradient(135deg,#1C2D12,#243818);border:1px solid rgba(201,162,39,.5);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;box-shadow:0 4px 12px rgba(201,162,39,.3);">🏢</div>
          <div style="min-width:0;overflow:hidden;flex:1;">
            <div style="font-weight:900;font-size:.9rem;background:linear-gradient(135deg,var(--accent2),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;" title="${brandName}">${brandName}</div>
            <div style="font-size:.65rem;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;">Gestão de Obras</div>
          </div>
        </div>`;

    const isCollapsed = window.innerWidth > 768 && localStorage.getItem('finobra_sidebar_collapsed') === 'true';
    const isImpersonating = Boolean((u?.impersonatedBy === 'superadmin' || u?.isImpersonated) || (typeof Auth !== 'undefined' && Auth.isImpersonating && Auth.isImpersonating()));

    document.getElementById('app-root').innerHTML = `
      <div class="app ${isCollapsed ? 'sidebar-collapsed' : ''} ${isImpersonating ? 'has-impersonation' : ''}" id="app-container">
        ${isImpersonating ? `
          <aside class="impersonation-bar" id="impersonation-bar" role="alert" aria-label="Modo Suporte Master">
            <div class="impersonation-info">
              <span class="impersonation-badge">🛡️ MODO SUPORTE MASTER</span>
              <span class="impersonation-text">Visualizando conta de: <strong>${brandName}</strong></span>
              <span class="impersonation-pill">🔒 Dados 100% isolados</span>
            </div>
            <button type="button" class="impersonation-btn" onclick="App.sairModoSuporte()" title="Encerrar suporte e retornar ao painel administrativo Master">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Voltar ao Painel Master</span>
            </button>
          </aside>
        ` : ''}
        <!-- Overlay Escuro para Mobile -->
        <div class="sidebar-overlay" id="sidebar-overlay" onclick="App.closeSidebar()"></div>

        <aside class="sidebar" id="sidebar">
          <div class="sidebar-logo" style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-s);min-height:70px;">
            ${logoHtml}
            <button class="icon-btn mobile-close-btn" onclick="App.closeSidebar()" title="Fechar Menu" style="font-size:1.1rem;padding:4px 8px;">✕</button>
          </div>
          <nav class="sidebar-nav">
            <div class="nav-section">Operacional & Financeiro</div>
            ${this._navItem('dashboard','📊','Dashboard')}
            ${this._navItem('obras','🏗️','Obras & Clientes')}
            ${this._navItem('lancamentos','💰','Lançamentos')}
            ${this._navItem('fornecedores','🚛','Fornecedores')}
            ${this._navItem('produtos','📦','Produtos / Insumos')}
            ${this._navItem('escritorio','🏢','Despesas Escritório')}
            ${this._navItem('pre-compras','🛒','Pré-Compras',badgePre)}
            ${this._navItem('recibos','🧾','Recibos Oficiais')}
            ${this._navItem('contratos','📜','Contratos de Obra')}
            ${this._navItem('notas-fiscais','📄','Notas Fiscais')}
            ${this._navItem('consulta-nfe','🔎','Busca NF-e')}
            ${this._navItem('conciliacao-ofx','🔄','Conciliação OFX')}
            <div class="nav-section">Planejamento</div>
            ${this._navItem('orcamentos','📋','Orçamentos')}
            ${this._navItem('medicoes','🔨','Medições & Faturamento')}
            ${this._navItem('documentacao','📋','Documentação de Obras')}
            <div class="nav-section">Relatórios</div>
            ${this._navItem('relatorios','📥','Exportar Relatórios')}
            <div class="nav-section">Assinatura &amp; Sistema</div>
            ${this._navItem('planos','💎','Planos &amp; Mensalidades')}
            ${this._navItem('contas-bancarias','🏦','Contas Bancárias')}
            ${this._navItem('configuracoes','⚙️','Configurações')}
            <a href="/validar" target="_blank" class="nav-item" style="text-decoration:none;color:var(--accent2);margin-top:4px;border:1px dashed rgba(201,162,39,0.3);border-radius:6px;" title="Portal público para consultar autenticidade de documentos por código">
              <span>🛡️</span><span>Validar Autenticidade ↗</span>
            </a>
          </nav>
          <div class="sidebar-foot">
            <div class="user-card" onclick="App.showUserMenu()">
              <div class="user-av">${Utils.escapeHtml(u?.avatar || 'AD')}</div>
              <div class="user-info">
                <div class="user-name">${Utils.escapeHtml(u?.nome || 'Administrador')}</div>
                <div class="user-role">${brandName}</div>
              </div>
            </div>
          </div>
        </aside>

        <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
          <header class="main-header" id="main-header">
            <button class="icon-btn" id="mob-menu" onclick="App.toggleSidebar()" title="Recolher / Expandir Menu Lateral (Ctrl+B)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div style="min-width:0;flex-shrink:1;">
              <div class="header-title" id="h-title">📊 Dashboard</div>
              <div class="header-sub">${brandName} — Gestão Financeira</div>
            </div>
            <div class="hspacer"></div>
            <div id="sync-status-indicator" title="Status da sincronização com a nuvem. Clique para tentar novamente itens que exigem atenção." onclick="App.showSyncIssues()" style="display:flex;align-items:center;gap:5px;font-size:.7rem;color:var(--text3);padding:4px 8px;border:1px solid var(--border);border-radius:999px;white-space:nowrap;">
              <span id="sync-status-dot">●</span><span id="sync-status-text">Cache local</span>
            </div>
            <!-- Botão Validador de Autenticidade -->
            <a href="/validar" target="_blank" class="header-search-btn" title="Consultar autenticidade de documentos por código ou QR Code" style="text-decoration:none;cursor:pointer;display:flex;align-items:center;gap:6px;background:rgba(201,162,39,.12);border:1px solid rgba(201,162,39,.4);border-radius:8px;padding:5px 11px;color:var(--accent2);transition:all .2s;">
              <span style="font-size:.9rem;">🛡️</span>
              <span style="font-size:.78rem;font-weight:700;">Validar Documento</span>
            </a>
            <!-- Dropdown Suporte Técnico & Atendimento -->
            ${isImpersonating ? '' : (typeof Suporte !== 'undefined' ? Suporte.renderHeaderDropdown() : '')}
            <!-- Botão Busca Global -->
            <div class="header-search-btn" onclick="typeof BuscaGlobal !== 'undefined' && BuscaGlobal.abrir()" title="Busca Global em todo o sistema (Ctrl+K)" style="cursor:pointer;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:8px;padding:5px 10px;transition:all .2s;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <span style="font-size:.78rem;color:var(--text2);font-weight:600;">Buscar...</span>
              <kbd style="font-size:.65rem;color:var(--text3);background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:3px;padding:1px 4px;">Ctrl+K</kbd>
            </div>
            <!-- Central de Alertas Notificações -->
            <div id="header-notif-container">
              ${typeof Notificacoes !== 'undefined' ? Notificacoes.renderBellBtn() : ''}
            </div>
            <div class="obra-sel-btn" onclick="App.abrirBuscaObras()" title="Filtrar ou pesquisar obra">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span class="obra-sel-label" id="obra-sel-current-name">Todas as Obras</span>
              <span style="font-size:.68rem;color:var(--text3);background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:4px;">🔍</span>
            </div>
            <button class="icon-btn" onclick="Auth.logout()" title="Sair" style="color:var(--danger)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </header>
          <main class="main-content" id="main-content">
            <div id="route-content"></div>
          </main>
        </div>
      </div>`;

    this.refreshObraSelector();
    this._bindKeyboardShortcuts();
  },

  _bindKeyboardShortcuts() {
    document.removeEventListener('keydown', this._onKeydownHandler);
    this._onKeydownHandler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (typeof BuscaGlobal !== 'undefined') BuscaGlobal.abrir();
      } else if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        this.abrirBuscaObras();
      }
    };
    document.addEventListener('keydown', this._onKeydownHandler);
  },

  _navItem(route, icon, label, badgeHtml = '') {
    const targetRoute = this._normalizeRoute(route);
    if (typeof Auth !== 'undefined' && Auth.canRoute && !Auth.canRoute(targetRoute, 'read')) return '';
    const isAct = (this.route === targetRoute) || (this._normalizeRoute(this.route) === targetRoute);
    return `<div class="nav-item${isAct?' active':''}" data-route="${targetRoute}" onclick="App.navigate('${targetRoute}');App.closeSidebar();">
      <span>${icon}</span><span>${label}</span>${badgeHtml}
    </div>`;
  },

  _firstAllowedRoute() {
    const preferred = ['dashboard','obras','lancamentos','fornecedores','produtos','pre-compras','recibos','contratos','notas-fiscais','orcamentos','medicoes','documentacao','relatorios','planos','contas-bancarias','configuracoes'];
    return preferred.find(r => !Auth?.canRoute || Auth.canRoute(r,'read')) || 'dashboard';
  },

  _installErrorMonitor() {
    if (this._errorMonitorInstalled) return;
    this._errorMonitorInstalled = true;
    const report = (payload = {}) => {
      try {
        if (!Auth?.getSession?.()) return;
        const message = String(payload.message || 'Erro JavaScript').slice(0,1500);
        const source = String(payload.source || '').slice(0,500);
        const fp = `${message}|${source}|${payload.line || ''}|${this.route || ''}`;
        const now = Date.now();
        const previous = this._errorFingerprints.get(fp) || 0;
        if (now - previous < 30000) return;
        this._errorFingerprints.set(fp, now);
        if (this._errorFingerprints.size > 100) {
          for (const [key, ts] of this._errorFingerprints) if (now - ts > 10 * 60 * 1000) this._errorFingerprints.delete(key);
        }
        fetch('/api/audit?action=client_error', {
          method:'POST', headers:Auth.getAuthHeaders(), keepalive:true,
          body:JSON.stringify({ ...payload, message, source, route:this.route || this._getRouteFromUrl() })
        }).catch(() => {});
      } catch {}
    };
    window.addEventListener('error', e => report({ message:e.message || e.error?.message, source:e.filename, line:e.lineno, col:e.colno, stack:e.error?.stack || '' }));
    window.addEventListener('unhandledrejection', e => {
      const reason = e.reason;
      report({ message:reason?.message || String(reason || 'Promise rejeitada'), source:'unhandledrejection', stack:reason?.stack || '' });
    });
    window.addEventListener('securitypolicyviolation', e => report({
      message:`CSP bloqueou ${e.violatedDirective || 'diretiva'}: ${e.blockedURI || 'inline'}`,
      source:'csp', line:e.lineNumber || 0, col:e.columnNumber || 0,
      stack:`effective=${e.effectiveDirective || ''}; disposition=${e.disposition || ''}`
    }));
  },

  navigate(route, updateHistory = true) {
    if (route && (route.startsWith('validar') || route.includes('val='))) {
      if (typeof Assinador !== 'undefined' && typeof Assinador.renderTelaValidacaoPublica === 'function') {
        Assinador.renderTelaValidacaoPublica();
        return;
      }
    }
    const cleanRoute = (route || '').split('?')[0].replace(/^#\/?/, '');
    const normalized = this._normalizeRoute(cleanRoute);
    let targetRoute = this.routes[normalized] ? normalized : 'dashboard';
    if (typeof Auth !== 'undefined' && Auth.canRoute && !Auth.canRoute(targetRoute,'read')) {
      const fallback = this._firstAllowedRoute();
      if (targetRoute !== fallback && typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Seu usuário não possui acesso a este módulo.', 'warning');
      targetRoute = fallback;
    }
    this.route = targetRoute;
    this._charts.forEach(c => { try { c.destroy(); } catch{} });
    this._charts = [];

    // Atualiza itens ativos no menu lateral
    document.querySelectorAll('.nav-item').forEach(el => {
      const itemRoute = el.dataset.route;
      const isActive = (itemRoute === targetRoute) || (this._normalizeRoute(itemRoute) === targetRoute);
      el.classList.toggle('active', isActive);
    });

    // Atualiza cabeçalho e título da página na aba do navegador
    const meta = this.routeMeta[targetRoute] || { icon: '📊', label: 'FinObra' };
    const hTitle = document.getElementById('h-title');
    if (hTitle) hTitle.textContent = `${meta.icon} ${meta.label}`;
    document.title = `FinObra — ${meta.label}`;

    // Renderiza a view correspondente
    const el = document.getElementById('route-content');
    if (el) {
      try {
        el.innerHTML = this.routes[targetRoute].render(this.obraId);
        if (typeof this.routes[targetRoute].init === 'function') {
          this.routes[targetRoute].init(this.obraId);
        }
      } catch(err) {
        console.error(err);
        el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">
          <h3 style="color:var(--accent);margin-bottom:8px">Erro ao carregar</h3>
          <p style="font-size:.85rem">${Utils.escapeHtml(err?.message || 'Falha inesperada.')}</p>
        </div>`;
      }
    }

    // Atualiza a URL na barra de endereços com History API de forma limpa e premium
    if (updateHistory) {
      const cleanUrl = `/app/${targetRoute}`;
      if (window.location.pathname !== cleanUrl || window.location.hash) {
        history.pushState({ route: targetRoute }, '', cleanUrl);
      }
    }
  },

  refreshObraSelector() {
    const lbl = document.getElementById('obra-sel-current-name');
    if (!lbl) return;
    if (this.obraId === 'todas') {
      lbl.textContent = 'Todas as Obras';
      lbl.style.color = 'var(--text)';
    } else if (this.obraId === 'escritorio') {
      lbl.textContent = '🏢 Sede / Escritório Central';
      lbl.style.color = 'var(--accent)';
    } else {
      const c = DB.getById('clientes', this.obraId);
      lbl.textContent = c ? `${c.nome} (${c.cidade})` : 'Todas as Obras';
      lbl.style.color = 'var(--accent)';
    }
  },

  abrirBuscaObras() {
    const cs = DB.getAll('clientes');
    Utils.showModal(`
      <div class="modal" style="max-width:620px;width:95vw;max-height:85vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.2rem;">🔍</span>
            <span class="modal-title">Selecionar &amp; Pesquisar Obra</span>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:16px 20px;overflow-y:auto;flex:1;">
          
          <!-- Campo de Busca Instantânea -->
          <div style="position:relative;margin-bottom:16px;">
            <input type="text" id="input-busca-obras" class="form-control" placeholder="Buscar por cliente, cidade, contrato Caixa, CPF ou status..." autofocus style="padding-left:38px;font-size:.92rem;background:var(--bg-secondary);border-color:var(--accent);" oninput="App._onSearchObraInput(this.value)">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:1rem;color:var(--text3);pointer-events:none;">🔍</span>
          </div>

          <div id="lista-busca-obras-container">
            ${this._renderListaBuscaObras('')}
          </div>
        </div>
        <div class="modal-footer" style="padding:10px 20px;justify-content:space-between;border-top:1px solid var(--border);">
          <span style="font-size:.75rem;color:var(--text3);">Dica: Pressione <code>Ctrl + K</code> ou <code>/</code> a qualquer momento para buscar</span>
          <button class="btn btn-secondary btn-sm" onclick="Utils.closeModal()">Fechar</button>
        </div>
      </div>
    `);

    setTimeout(() => {
      const inp = document.getElementById('input-busca-obras');
      if (inp) inp.focus();
    }, 100);
  },

  _onSearchObraInput(val) {
    const cont = document.getElementById('lista-busca-obras-container');
    if (cont) cont.innerHTML = this._renderListaBuscaObras(val.trim());
  },

  _renderListaBuscaObras(termo = '') {
    const cs = DB.getAll('clientes');
    const t = termo.toLowerCase();
    const filtrados = cs.filter(c => {
      if (!t) return true;
      const str = `${c.nome} ${c.cidade} ${c.estado} ${c.cpf_cnpj||''} ${c.num_contrato_caixa||''} ${c.engenheiro_responsavel||''} ${c.status}`.toLowerCase();
      return str.includes(t);
    });

    const isTodas = this.obraId === 'todas';
    const isEscritorio = this.obraId === 'escritorio';

    let html = '';

    // Opção "Todas as Obras"
    if (!termo || 'todas as obras visão geral consolidado'.includes(t)) {
      html += `
      <div class="obra-search-item ${isTodas ? 'selected' : ''}" onclick="App.selecionarObra('todas')" style="margin-bottom:8px;border-left:4px solid ${isTodas ? 'var(--accent)' : 'var(--border)'};">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:38px;height:38px;background:rgba(201,162,39,.12);border:1px solid var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">
            🏢
          </div>
          <div>
            <div style="font-weight:800;font-size:.9rem;color:var(--text);">Todas as Obras (Visão Consolidada)</div>
            <div style="font-size:.74rem;color:var(--text3);">Exibe o consolidado financeiro de todas as ${cs.length} obras cadastradas</div>
          </div>
        </div>
        ${isTodas ? '<span style="color:var(--accent);font-weight:900;font-size:1.1rem;">✓</span>' : '<span style="font-size:.76rem;color:var(--text3);">Selecionar</span>'}
      </div>`;
    }

    // Opção "Sede / Escritório Central"
    if (!termo || 'sede escritorio administrativo central sede despesas fixas'.includes(t)) {
      html += `
      <div class="obra-search-item ${isEscritorio ? 'selected' : ''}" onclick="App.selecionarObra('escritorio')" style="margin-bottom:10px;border-left:4px solid ${isEscritorio ? 'var(--accent)' : 'var(--border)'};">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:38px;height:38px;background:rgba(2,132,199,.12);border:1px solid #0284c7;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">
            💼
          </div>
          <div>
            <div style="font-weight:800;font-size:.9rem;color:var(--text);">Sede / Escritório Central (Custos Administrativos)</div>
            <div style="font-size:.74rem;color:var(--text3);">Centro de custo sede: aluguel, luz, água, DAS simples nacional, folha</div>
          </div>
        </div>
        ${isEscritorio ? '<span style="color:var(--accent);font-weight:900;font-size:1.1rem;">✓</span>' : '<span style="font-size:.76rem;color:var(--text3);">Selecionar</span>'}
      </div>`;
    }

    if (!filtrados.length) {
      html += `
      <div style="text-align:center;padding:30px;color:var(--text3);font-size:.85rem;">
        Nenhuma obra encontrada com o termo "<strong>${Utils.escapeHtml(termo)}</strong>".
      </div>`;
      return html;
    }

    html += `<div style="font-size:.74rem;font-weight:800;color:var(--text3);text-transform:uppercase;margin:12px 0 8px 4px;">Obras Cadastradas (${filtrados.length})</div>`;

    html += filtrados.map(c => {
      const isSel = this.obraId === c.id;

      return `
      <div class="obra-search-item ${isSel ? 'selected' : ''}" onclick="App.selecionarObra('${c.id}')" style="margin-bottom:8px;border-left:4px solid ${isSel ? 'var(--accent)' : 'var(--border)'};">
        <div style="flex:1;min-width:0;margin-right:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <strong style="font-size:.92rem;color:var(--text);">${c.nome}</strong>
            ${Utils.badge(c.status || 'em_andamento')}
          </div>
          <div style="display:flex;gap:12px;font-size:.74rem;color:var(--text3);flex-wrap:wrap;">
            <span>📍 ${c.cidade}/${c.estado}</span>
            ${c.num_contrato_caixa ? `<span style="color:var(--accent2);font-weight:600;">🏦 Contrato: ${c.num_contrato_caixa}</span>` : ''}
            <span>💰 Financiado: ${Utils.fmt.currency(c.valor_financiado)}</span>
          </div>
        </div>
        <div>
          ${isSel ? '<span style="color:var(--accent);font-weight:900;font-size:1.1rem;">✓</span>' : '<button class="btn btn-secondary btn-sm" style="font-size:.75rem;padding:4px 10px;">Selecionar</button>'}
        </div>
      </div>`;
    }).join('');

    return html;
  },

  selecionarObra(id) {
    this.obraId = id;
    Utils.closeModal();
    this.refreshObraSelector();
    this.navigate(this.route);
    const c = id === 'todas' ? null : DB.getById('clientes', id);
    Utils.toast(c ? `Obra selecionada: ${c.nome}` : 'Exibindo todas as obras', 'info');
  },

  showUserMenu() {
    const u = Auth.getUser();
    const emp = DB.getEmpresa();
    const e = v => Utils.escapeHtml(String(v ?? ''));
    const roleLabel = ({superadmin:'Superadministrador',admin:'Administrador',gestor:'Gestor',operador:'Operador',visualizador:'Visualizador'})[String(u?.perfil || '').toLowerCase()] || 'Usuário';
    const canAdmin = ['admin','superadmin'].includes(String(u?.perfil || '').toLowerCase());
    Utils.showModal(`
      <div class="modal" style="max-width:360px">
        <div class="modal-header"><span class="modal-title">👤 Minha Conta</span><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
        <div class="modal-body" style="text-align:center;">
          <div class="user-av" style="width:60px;height:60px;font-size:1.4rem;margin:0 auto 12px;">${e(u?.avatar || 'US')}</div>
          <div style="font-weight:800;font-size:1.05rem;">${e(u?.nome || 'Usuário')}</div>
          <div style="color:var(--accent2);font-size:.84rem;margin-top:2px;font-weight:600;">${e(emp.nome_fantasia || emp.razao_social || 'Minha Empresa')}</div>
          <div style="color:var(--text3);font-size:.75rem;margin-top:4px;margin-bottom:16px;">${e(roleLabel)} &middot; Logado: ${Utils.fmt.datetime(u?.loginAt)}</div>
          
          <div style="display:flex;flex-direction:column;gap:8px;text-align:left;">
            ${canAdmin ? `<button class="btn btn-secondary btn-block" onclick="Utils.closeModal();App.showOnboardingEmpresa()">
              🏢 Dados &amp; Logotipo da Empresa
            </button>` : ''}
            <button class="btn btn-secondary btn-block" onclick="Utils.closeModal();Configuracoes.showMeuPerfil()">
              👤 Meu Perfil / Alterar Senha
            </button>
            <button class="btn btn-secondary btn-block" onclick="Utils.closeModal();App.navigate('configuracoes')">
              ⚙️ Gerenciar Usuários e Sistema
            </button>
          </div>
        </div>
        <div class="modal-footer" style="justify-content:center;">
          <button class="btn btn-danger btn-block" onclick="Utils.closeModal();Auth.logout()">Sair do Sistema</button>
        </div>
      </div>`);
  },

  showOnboardingEmpresa() {
    const emp = DB.getEmpresa();
    const u = Auth.getUser();
    Utils.showModal(`
      <div class="modal" style="max-width:560px;">
        <div class="modal-header">
          <span class="modal-title">🏢 Cadastro da Minha Empresa</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <form class="modal-body" id="f-onboarding-empresa" onsubmit="App.saveOnboardingEmpresa(event)">
          <div style="background:rgba(201,162,39,.08);border:1px solid rgba(201,162,39,.25);border-radius:12px;padding:12px 16px;margin-bottom:16px;display:flex;gap:12px;align-items:center;">
            <span style="font-size:1.8rem;">🚀</span>
            <div style="font-size:.82rem;line-height:1.4;color:var(--text);">
              <strong>Personalize seu Sistema de Gestão!</strong><br>
              <span style="color:var(--text2);">Estes dados e logotipo serão usados automaticamente na interface, relatórios, recibos e ordens de compra.</span>
            </div>
          </div>

          <div class="g2">
            <div class="form-group">
              <label class="form-label">Nome Fantasia da Empresa *</label>
              <input class="form-control" name="nome_fantasia" id="ob-nome-fantasia" value="${emp.nome_fantasia || ''}" required placeholder="Ex: Silva & Souza Engenharia">
            </div>
            <div class="form-group">
              <label class="form-label">Razão Social</label>
              <input class="form-control" name="razao_social" id="ob-razao-social" value="${emp.razao_social || emp.nome_fantasia || ''}" placeholder="Ex: Silva & Souza Construtora LTDA">
            </div>
          </div>

          <div class="g2">
            <div class="form-group">
              <label class="form-label">CNPJ ou CPF</label>
              <div style="display:flex;gap:6px;">
                <input class="form-control" name="cnpj" id="ob-cnpj" value="${emp.cnpj || ''}" placeholder="00.000.000/0001-00">
                <button type="button" class="btn btn-secondary btn-sm" onclick="App.consultarCnpjOnboarding()" title="Buscar CNPJ na Receita">🔍</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">WhatsApp / Telefone de Contato</label>
              <input class="form-control" name="telefone" id="ob-tel" value="${emp.telefone || ''}" placeholder="(00) 90000-0000">
            </div>
          </div>

          <div class="g2">
            <div class="form-group">
              <label class="form-label">Cidade / UF</label>
              <div style="display:flex;gap:6px;">
                <input class="form-control" name="cidade" id="ob-cidade" value="${emp.cidade || ''}" placeholder="Cidade" style="flex:2;">
                <input class="form-control" name="uf" id="ob-uf" value="${emp.uf || ''}" placeholder="UF" maxlength="2" style="flex:1;text-transform:uppercase;">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Responsável Técnico / Engenheiro</label>
              <input class="form-control" name="responsavel" id="ob-responsavel" value="${emp.responsavel || u?.nome || ''}" placeholder="Nome do engenheiro/responsável">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Logotipo da Empresa</label>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <input type="file" id="ob-logo-file" accept="image/*" style="display:none;" onchange="App.handleLogoUploadOnboarding(this)">
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('ob-logo-file').click()">📁 Escolher Logotipo</button>
              ${emp.logo_url ? `<button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="App.removerLogoOnboarding()">🗑️ Remover Logo</button>` : ''}
              <span id="ob-logo-preview-txt" style="font-size:.78rem;color:var(--text3);">${emp.logo_url ? 'Logotipo atual salvo' : 'Nenhuma imagem selecionada'}</span>
            </div>
            <div style="font-size:.72rem;color:var(--text3);margin-top:6px;line-height:1.4;">
              💡 <strong>Recomendado:</strong> Formato horizontal retangular (~3:1 ou 4:1, ex: 300x100px) com fundo transparente em <strong>.PNG</strong> para perfeito encaixe no menu e relatórios.
            </div>
            <input type="hidden" name="logo_url" id="ob-logo-url" value="${emp.logo_url || ''}">
          </div>

          <div class="modal-footer" style="padding-bottom:0;">
            <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary">💾 Salvar Dados da Empresa</button>
          </div>
        </form>
      </div>
    `);
  },

  async handleLogoUploadOnboarding(input) {
    const file = input?.files?.[0];
    if (!file) return;
    try {
      Utils.toast('Processando e otimizando logotipo...', 'info');
      const res = await Utils.compressImage(file, 600, 240, 0.9);
      const urlInput = document.getElementById('ob-logo-url');
      if (urlInput) urlInput.value = res.dataUrl;
      const previewTxt = document.getElementById('ob-logo-preview-txt');
      if (previewTxt) previewTxt.textContent = `✓ ${res.name} (${Math.round(res.sizeBytes / 1024)} KB)`;
      Utils.toast('Logotipo carregado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro no upload de logo onboarding:', err);
      Utils.toast(err.message || 'Falha ao carregar logotipo.', 'error');
    }
  },

  removerLogoOnboarding() {
    const urlInput = document.getElementById('ob-logo-url');
    if (urlInput) urlInput.value = '';
    const previewTxt = document.getElementById('ob-logo-preview-txt');
    if (previewTxt) previewTxt.textContent = 'Logotipo removido';
    Utils.toast('Logotipo removido.', 'info');
  },

  async consultarCnpjOnboarding() {
    const raw = (document.getElementById('ob-cnpj')?.value || '').replace(/\D/g, '');
    if (raw.length !== 14) {
      Utils.toast('Informe um CNPJ válido com 14 dígitos para consultar!', 'warning');
      return;
    }
    Utils.toast('Consultando CNPJ na Receita Federal...', 'info');
    try {
      const res = await fetch(`/api/cnpj?cnpj=${raw}`);
      if (!res.ok) throw new Error('Falha na consulta');
      const data = await res.json();
      if (data.razao_social || data.nome_fantasia) {
        if (data.nome_fantasia && document.getElementById('ob-nome-fantasia')) document.getElementById('ob-nome-fantasia').value = data.nome_fantasia;
        if (data.razao_social && document.getElementById('ob-razao-social')) document.getElementById('ob-razao-social').value = data.razao_social;
        if (data.municipio && document.getElementById('ob-cidade')) document.getElementById('ob-cidade').value = data.municipio;
        if (data.uf && document.getElementById('ob-uf')) document.getElementById('ob-uf').value = data.uf;
        if (data.ddd_telefone_1 && document.getElementById('ob-tel')) document.getElementById('ob-tel').value = data.ddd_telefone_1;
        Utils.toast('Dados do CNPJ preenchidos automaticamente!', 'success');
      } else {
        Utils.toast('CNPJ consultado mas sem dados adicionais.', 'info');
      }
    } catch {
      Utils.toast('Não foi possível consultar o CNPJ online.', 'warning');
    }
  },

  saveOnboardingEmpresa(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const empresaData = {
      nome_fantasia: fd.get('nome_fantasia').trim(),
      razao_social: (fd.get('razao_social') || fd.get('nome_fantasia')).trim(),
      cnpj: fd.get('cnpj').trim(),
      telefone: fd.get('telefone').trim(),
      whatsapp: fd.get('telefone').trim().replace(/\D/g, ''),
      cidade: fd.get('cidade').trim(),
      uf: fd.get('uf').trim().toUpperCase(),
      responsavel: fd.get('responsavel').trim(),
      logo_url: fd.get('logo_url') || '',
      configurada: true
    };
    DB.saveEmpresa(empresaData);
    Utils.closeModal();
    Utils.toast('Empresa salva com sucesso!', 'success');
    this.renderShell();
    this.navigate(this.route);
  },

  clearAllData() {
    Utils.confirm('⚠️ Tem certeza que deseja LIMPAR TODOS OS DADOS (clientes, lançamentos, despesas, ordens de compra, recibos, orçamentos e documentos)? O sistema será totalmente zerado e preparado para novos cadastros reais.', () => {
      DB.clearAllData();
      const badge = document.getElementById('demo-badge');
      if (badge) badge.style.display = 'none';
      this.obraId = 'todas';
      this.refreshObraSelector();
      this.navigate(this.route);
      Utils.toast('Sistema zerado e 100% limpo para novos cadastros!', 'success');
    });
  },

  clearDemo() {
    DB.expurgarDadosDemo();
    this.refreshObraSelector();
    this.navigate(this.route);
    Utils.toast('✅ Dados demo expurgados com sucesso!', 'success');
  },

  toggleSidebar() {
    const isMobile = window.innerWidth <= 768;
    const app = document.getElementById('app-container') || document.querySelector('.app');
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');

    if (isMobile) {
      if (sb) {
        sb.classList.toggle('open');
        if (ov) ov.classList.toggle('active', sb.classList.contains('open'));
      }
    } else {
      if (app) {
        const collapsed = app.classList.toggle('sidebar-collapsed');
        localStorage.setItem('finobra_sidebar_collapsed', collapsed ? 'true' : 'false');
        
        // Reajusta gráficos após animação da barra
        setTimeout(() => {
          if (this._charts) {
            this._charts.forEach(c => { try { c.resize(); } catch(e){} });
          }
        }, 320);
      }
    }
  },

  closeSidebar() {
    const isMobile = window.innerWidth <= 768;
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    if (isMobile) {
      if (sb) sb.classList.remove('open');
      if (ov) ov.classList.remove('active');
    }
  },

  registerChart(c) { this._charts.push(c); },

  sairModoSuporte() {
    if (typeof Auth !== 'undefined' && Auth.stopImpersonation) {
      return Auth.stopImpersonation();
    }
    window.location.href = '/master.html';
  },

  // ── Loader de Sincronização ────────────────────────────────────────────────
  _showSyncLoader() {
    if (document.getElementById('sync-loader')) return;
    const emp = DB.getEmpresa();
    const brand = emp?.nome_fantasia || emp?.razao_social || 'Sistema';
    const el = document.createElement('div');
    el.id = 'sync-loader';
    el.innerHTML = `
      <div style="
        position:fixed;inset:0;z-index:99999;
        background:linear-gradient(135deg,#0a0f1a 0%,#0d1525 50%,#0a1020 100%);
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        font-family:'Inter',sans-serif;transition:opacity .4s ease;">
        <div style="text-align:center;padding:40px;">
          <div style="font-size:3rem;margin-bottom:16px;animation:syncPulse 1.5s ease-in-out infinite;">🏗️</div>
          <div style="font-size:1.4rem;font-weight:900;color:#fff;margin-bottom:6px;">${brand}</div>
          <div style="font-size:.85rem;color:#94a3b8;margin-bottom:28px;">Carregando dados do sistema...</div>
          <div style="display:flex;gap:6px;justify-content:center;margin-bottom:20px;">
            ${[0,1,2].map(i=>`<div style="width:8px;height:8px;border-radius:50%;background:#4f46e5;animation:syncDot 1.2s ease-in-out ${i*0.2}s infinite;"></div>`).join('')}
          </div>
          <div id="sync-loader-msg" style="font-size:.75rem;color:#475569;">Conectando ao banco de dados...</div>
        </div>
      </div>
      <style>
        @keyframes syncPulse { 0%,100%{transform:scale(1);opacity:.9} 50%{transform:scale(1.12);opacity:1} }
        @keyframes syncDot { 0%,80%,100%{transform:scale(.6);opacity:.4} 40%{transform:scale(1);opacity:1} }
      </style>`;
    document.body.appendChild(el);

    // Atualizar mensagem progressivamente
    const msgs = ['Conectando ao banco de dados...','Sincronizando lançamentos...','Carregando obras e fornecedores...','Quase pronto...'];
    let idx = 0;
    this._loaderTimer = setInterval(() => {
      const msgEl = document.getElementById('sync-loader-msg');
      if (msgEl && idx < msgs.length) { msgEl.textContent = msgs[idx++]; }
    }, 600);
  },

  _hideSyncLoader() {
    clearInterval(this._loaderTimer);
    const el = document.getElementById('sync-loader');
    if (!el) return;
    el.querySelector('div').style.opacity = '0';
    setTimeout(() => el.remove(), 420);
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());
