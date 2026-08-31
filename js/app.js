// js/app.js — Router & App Shell

const App = {
  route: 'dashboard',
  obraId: 'todas',
  _charts: [],

  routes: {
    dashboard: Dashboard, clientes: Clientes, lancamentos: Lancamentos,
    escritorio: Escritorio,
    precompras: PreCompras,
    recibos: Recibos,
    ofx: OFX, notas: Notas, nfe: NFe, orcamentos: Orcamentos,
    medicoes: Medicoes, exportar: Exportar,
    contas: Contas, configuracoes: Configuracoes,
    fornecedores: Fornecedores
  },

  routeMeta: {
    dashboard: { icon:'📊', label:'Dashboard' },
    clientes:  { icon:'👥', label:'Clientes / Obras' },
    lancamentos:{ icon:'💰', label:'Lançamentos' },
    escritorio:{ icon:'🏢', label:'Despesas do Escritório' },
    precompras:{ icon:'🛒', label:'Ordens de Pré-Compra' },
    recibos:   { icon:'🧾', label:'Emissão de Recibos' },
    notas:     { icon:'📄', label:'Notas Fiscais' },
    nfe:       { icon:'🔎', label:'Busca NF-e' },
    ofx:       { icon:'🔄', label:'Importar OFX' },
    orcamentos:{ icon:'📋', label:'Orçamentos' },
    medicoes:  { icon:'🔨', label:'Medições Caixa' },
    exportar:  { icon:'📥', label:'Exportar' },
    contas:    { icon:'🏦', label:'Contas Bancárias' },
    configuracoes: { icon:'⚙️', label:'Configurações' },
    fornecedores: { icon:'🏗️', label:'Fornecedores' },
  },

  async init() {
    if (!Auth.requireAuth()) return;
    DB.init();
    await DB.syncFromCloud();
    if (DB.isDemoLoaded()) {
      DB.seedDemoData();
      DB.seedSinapiDemo();
      if (typeof Documentos !== 'undefined' && Documentos.seedDemoDocs) {
        Documentos.seedDemoDocs();
      }
    }
    this.renderShell();
    window.addEventListener('hashchange', () => this.navigate(location.hash.replace('#','')||'dashboard'));
    this.navigate(location.hash.replace('#','')||'dashboard');
  },

  renderShell() {
    const u = Auth.getUser();
    const resumoPre = DB.getPreComprasResumo('todas');
    const badgePre = resumoPre.pendentesQtd > 0 ? `<span class="nav-badge" style="background:#f59e0b;color:#182713;font-weight:900;" title="${resumoPre.pendentesQtd} pedido(s) pendente(s)">${resumoPre.pendentesQtd}</span>` : '';

    document.getElementById('app-root').innerHTML = `
      <div class="app">
        <!-- Overlay Escuro para Mobile -->
        <div class="sidebar-overlay" id="sidebar-overlay" onclick="App.closeSidebar()"></div>

        <aside class="sidebar" id="sidebar">
          <div class="sidebar-logo" style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-s);">
            <img src="img/logo.png" alt="Angelim Construtora" style="width:100%;max-width:130px;height:auto;border-radius:8px;border:1px solid rgba(201,162,39,.35);box-shadow:0 4px 16px rgba(0,0,0,.5);object-fit:contain;">
            <button class="icon-btn mobile-close-btn" onclick="App.closeSidebar()" title="Fechar Menu" style="font-size:1.1rem;padding:4px 8px;">✕</button>
          </div>
          <nav class="sidebar-nav">
            <div class="nav-section">Gestão Financeira</div>
            ${this._navItem('dashboard','📊','Dashboard')}
            ${this._navItem('clientes','👥','Clientes / Obras')}
            ${this._navItem('fornecedores','🏗️','Fornecedores')}
            ${this._navItem('lancamentos','💰','Lançamentos')}
            ${this._navItem('escritorio','🏢','Despesas Escritório')}
            ${this._navItem('precompras','🛒','Pré-Compras',badgePre)}
            ${this._navItem('recibos','🧾','Recibos Oficiais')}
            ${this._navItem('notas','📄','Notas Fiscais')}
            ${this._navItem('nfe','🔎','Busca NF-e')}
            ${this._navItem('ofx','🔄','Importar OFX')}
            <div class="nav-section">Planejamento</div>
            ${this._navItem('orcamentos','📋','Orçamentos')}
            ${this._navItem('medicoes','🔨','Medições Caixa')}
            <div class="nav-section">Relatórios</div>
            ${this._navItem('exportar','📥','Exportar Dados')}
            <div class="nav-section">Sistema</div>
            ${this._navItem('contas','🏦','Contas Bancárias')}
            ${this._navItem('configuracoes','⚙️','Configurações')}
          </nav>
          <div class="sidebar-foot">
            <div class="user-card" onclick="App.showUserMenu()">
              <div class="user-av">${u?.avatar||'AD'}</div>
              <div class="user-info">
                <div class="user-name">${u?.nome||'Administrador'}</div>
                <div class="user-role">${u?.perfil==='admin'?'Administrador':'Gestor'}</div>
              </div>
            </div>
          </div>
        </aside>

        <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
          <header class="main-header" id="main-header">
            <button class="icon-btn" id="mob-menu" onclick="App.toggleSidebar()" title="Abrir Menu de Navegação">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div style="min-width:0;flex-shrink:1;">
              <div class="header-title" id="h-title">📊 Dashboard</div>
              <div class="header-sub">Angelim Construtora — Gestão Financeira</div>
            </div>
            <div class="hspacer"></div>
            <div id="demo-badge" class="demo-badge" style="${DB.isDemoLoaded()?'':'display:none'}">
              ⚠ Dados Demo
              <button style="background:none;border:none;color:inherit;cursor:pointer;font-size:.68rem;text-decoration:underline;margin-left:4px;padding:0" onclick="App.clearDemo()">Limpar</button>
            </div>
            <div class="obra-sel-btn" onclick="App.abrirBuscaObras()" title="Filtrar ou pesquisar obra (Atalho: Ctrl+K ou /)">
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
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'SELECT')) {
        e.preventDefault();
        this.abrirBuscaObras();
      }
    };
    document.addEventListener('keydown', this._onKeydownHandler);
  },

  _navItem(route, icon, label, badgeHtml = '') {
    return `<div class="nav-item${this.route===route?' active':''}" data-route="${route}" onclick="App.navigate('${route}');App.closeSidebar();">
      <span>${icon}</span><span>${label}</span>${badgeHtml}
    </div>`;
  },

  navigate(route) {
    if (!this.routes[route]) route = 'dashboard';
    this.route = route;
    this._charts.forEach(c => { try { c.destroy(); } catch{} });
    this._charts = [];
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.route === route));
    const meta = this.routeMeta[route];
    if (meta) document.getElementById('h-title').textContent = `${meta.icon} ${meta.label}`;
    const el = document.getElementById('route-content');
    try {
      el.innerHTML = this.routes[route].render(this.obraId);
      if (typeof this.routes[route].init === 'function') {
        this.routes[route].init(this.obraId);
      }
    } catch(err) {
      console.error(err);
      el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">
        <h3 style="color:var(--accent);margin-bottom:8px">Erro ao carregar</h3>
        <p style="font-size:.85rem">${err.message}</p>
      </div>`;
    }
    history.pushState(null,null,`#${route}`);
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
        Nenhuma obra encontrada com o termo "<strong>${termo}</strong>".
      </div>`;
      return html;
    }

    html += `<div style="font-size:.74rem;font-weight:800;color:var(--text3);text-transform:uppercase;margin:12px 0 8px 4px;">Obras Cadastradas (${filtrados.length})</div>`;

    html += filtrados.map(c => {
      const isSel = this.obraId === c.id;
      const statusClass = c.status === 'em_andamento' ? 'badge-info' : 'badge-success';
      const statusTxt = c.status === 'em_andamento' ? '🔨 Em Andamento' : '✓ Concluída';

      return `
      <div class="obra-search-item ${isSel ? 'selected' : ''}" onclick="App.selecionarObra('${c.id}')" style="margin-bottom:8px;border-left:4px solid ${isSel ? 'var(--accent)' : 'var(--border)'};">
        <div style="flex:1;min-width:0;margin-right:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <strong style="font-size:.92rem;color:var(--text);">${c.nome}</strong>
            <span class="badge ${statusClass}" style="font-size:.68rem;padding:2px 6px;">${statusTxt}</span>
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
    Utils.showModal(`
      <div class="modal" style="max-width:340px">
        <div class="modal-header"><span class="modal-title">👤 Usuário</span><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
        <div class="modal-body" style="text-align:center;">
          <div class="user-av" style="width:60px;height:60px;font-size:1.4rem;margin:0 auto 12px;">${u?.avatar}</div>
          <div style="font-weight:800;font-size:1.05rem;">${u?.nome}</div>
          <div style="color:var(--text3);font-size:.8rem;margin-top:4px;">${u?.perfil==='admin'?'Administrador':'Gestor'}</div>
          <div style="color:var(--text3);font-size:.75rem;margin-top:4px;margin-bottom:16px;">Logado: ${Utils.fmt.datetime(u?.loginAt)}</div>
          
          <div style="display:flex;flex-direction:column;gap:8px;text-align:left;">
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
    this.clearAllData();
  },

  loadDemoData() {
    DB.seedDemoData(true);
    DB.seedSinapiDemo(true);
    if (typeof Documentos !== 'undefined' && Documentos.seedDemoDocs) {
      Documentos.seedDemoDocs(true);
    }
    const badge = document.getElementById('demo-badge');
    if (badge) badge.style.display = '';
    this.refreshObraSelector();
    this.navigate(this.route);
    Utils.toast('Dados de demonstração carregados!', 'info');
  },

  toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    sb.classList.toggle('open');
    if (ov) ov.classList.toggle('active', sb.classList.contains('open'));
  },

  closeSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('active');
  },

  registerChart(c) { this._charts.push(c); }
};

window.addEventListener('DOMContentLoaded', () => App.init());
