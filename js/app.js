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

    // Onboarding automático para novo usuário cuja empresa ainda não foi configurada
    const emp = DB.getEmpresa();
    if (!emp.configurada && Auth.getCurrentTenantId() !== 'angelim') {
      setTimeout(() => this.showOnboardingEmpresa(), 350);
    }
  },

  renderShell() {
    const u = Auth.getUser();
    const emp = DB.getEmpresa();
    const resumoPre = DB.getPreComprasResumo('todas');
    const badgePre = resumoPre.pendentesQtd > 0 ? `<span class="nav-badge" style="background:#f59e0b;color:#182713;font-weight:900;" title="${resumoPre.pendentesQtd} pedido(s) pendente(s)">${resumoPre.pendentesQtd}</span>` : '';

    const brandName = emp.nome_fantasia || emp.razao_social || 'Minha Empresa';
    const logoHtml = emp.logo_url
      ? `<img src="${emp.logo_url}" alt="${brandName}" style="width:100%;max-width:130px;max-height:50px;border-radius:8px;border:1px solid rgba(201,162,39,.35);box-shadow:0 4px 16px rgba(0,0,0,.5);object-fit:contain;">`
      : `<div style="display:flex;align-items:center;gap:10px;overflow:hidden;width:100%;">
          <div style="width:38px;height:38px;border-radius:8px;background:linear-gradient(135deg,#1C2D12,#243818);border:1px solid rgba(201,162,39,.5);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;box-shadow:0 4px 12px rgba(201,162,39,.3);">🏢</div>
          <div style="min-width:0;overflow:hidden;flex:1;">
            <div style="font-weight:900;font-size:.9rem;background:linear-gradient(135deg,var(--accent2),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;" title="${brandName}">${brandName}</div>
            <div style="font-size:.65rem;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;">Gestão de Obras</div>
          </div>
        </div>`;

    document.getElementById('app-root').innerHTML = `
      <div class="app">
        <!-- Overlay Escuro para Mobile -->
        <div class="sidebar-overlay" id="sidebar-overlay" onclick="App.closeSidebar()"></div>

        <aside class="sidebar" id="sidebar">
          <div class="sidebar-logo" style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-s);min-height:70px;">
            ${logoHtml}
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
                <div class="user-role">${brandName}</div>
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
              <div class="header-sub">${brandName} — Gestão Financeira</div>
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
    const emp = DB.getEmpresa();
    Utils.showModal(`
      <div class="modal" style="max-width:360px">
        <div class="modal-header"><span class="modal-title">👤 Minha Conta</span><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
        <div class="modal-body" style="text-align:center;">
          <div class="user-av" style="width:60px;height:60px;font-size:1.4rem;margin:0 auto 12px;">${u?.avatar}</div>
          <div style="font-weight:800;font-size:1.05rem;">${u?.nome}</div>
          <div style="color:var(--accent2);font-size:.84rem;margin-top:2px;font-weight:600;">${emp.nome_fantasia || emp.razao_social || 'Minha Empresa'}</div>
          <div style="color:var(--text3);font-size:.75rem;margin-top:4px;margin-bottom:16px;">${u?.perfil==='admin'?'Administrador':'Gestor'} &middot; Logado: ${Utils.fmt.datetime(u?.loginAt)}</div>
          
          <div style="display:flex;flex-direction:column;gap:8px;text-align:left;">
            <button class="btn btn-secondary btn-block" onclick="Utils.closeModal();App.showOnboardingEmpresa()">
              🏢 Dados &amp; Logotipo da Empresa
            </button>
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

  handleLogoUploadOnboarding(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      Utils.toast('A imagem deve ter no máximo 2MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('ob-logo-url').value = e.target.result;
      document.getElementById('ob-logo-preview-txt').textContent = `✓ ${file.name} carregado`;
      Utils.toast('Logotipo carregado com sucesso!', 'success');
    };
    reader.readAsDataURL(file);
  },

  removerLogoOnboarding() {
    document.getElementById('ob-logo-url').value = '';
    document.getElementById('ob-logo-preview-txt').textContent = 'Logotipo removido';
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
