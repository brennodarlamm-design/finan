// js/app.js — Router & App Shell

const App = {
  route: 'dashboard',
  obraId: 'todas',
  _charts: [],
  _errorMonitorInstalled: false,
  _errorFingerprints: new Map(),
  _breadcrumbs: [],
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
    'portal-cliente': ['portal-cliente', 'portal', 'portal-obra', 'cliente-portal'],
    'dashboard': ['dashboard', 'inicio', 'home'],
    // Patch 52 — Gestão Operacional
    'minhas-demandas': ['minhas-demandas', 'demandas', 'meu-trabalho'],
    'central-gestor': ['central-gestor', 'gestor', 'painel-gestor'],
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
    'consulta-nfe': typeof NFe !== 'undefined' ? NFe : null,
    'nfe': typeof NFe !== 'undefined' ? NFe : null,
    get 'conciliacao-ofx'() { return typeof OFX !== 'undefined' ? OFX : {}; },
    get 'ofx'() { return typeof OFX !== 'undefined' ? OFX : {}; },
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
    'portal-cliente': typeof PortalCliente !== 'undefined' ? PortalCliente : Clientes,
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
    },
    // Patch 52 — Gestão Operacional
    'minhas-demandas': typeof MinhasDemandas !== 'undefined' ? MinhasDemandas : null,
    'central-gestor':  typeof CentralGestor  !== 'undefined' ? CentralGestor  : null,
  },

  routeMeta: {
    'dashboard':         { icon:'📊', label:'Dashboard', title:'Dashboard Financeiro de Obras | FinGo' },
    'obras':             { icon:'🏗️', label:'Obras & Clientes', title:'Gestão de Obras & Clientes | FinGo' },
    'clientes':          { icon:'🏗️', label:'Obras & Clientes', title:'Gestão de Obras & Clientes | FinGo' },
    'obra-detalhe':      { icon:'🏢', label:'Central da Obra', title:'Dossiê Central da Obra | FinGo' },
    'lancamentos':       { icon:'💰', label:'Lançamentos Financeiros', title:'Controle Financeiro de Obras | FinGo' },
    'financeiro':        { icon:'💰', label:'Lançamentos Financeiros', title:'Controle Financeiro de Obras | FinGo' },
    'escritorio':        { icon:'🏢', label:'Despesas Escritório', title:'Custos Indiretos & Escritório | FinGo' },
    'pre-compras':       { icon:'🛒', label:'Ordens de Pré-Compra', title:'Ordens de Compra & Cotações | FinGo' },
    'precompras':        { icon:'🛒', label:'Ordens de Pré-Compra', title:'Ordens de Compra & Cotações | FinGo' },
    'recibos':           { icon:'🧾', label:'Recibos Oficiais', title:'Emissão de Recibos de Construção | FinGo' },
    'contratos':         { icon:'📜', label:'Contratos de Obra', title:'Gerador de Contratos de Empreitada | FinGo' },
    'notas-fiscais':     { icon:'📄', label:'Notas Fiscais', title:'Notas Fiscais & XML Danfe | FinGo' },
    'notas':             { icon:'📄', label:'Notas Fiscais', title:'Notas Fiscais & XML Danfe | FinGo' },
    'consulta-nfe':      { icon:'🔎', label:'Busca NF-e', title:'Consulta Automática NF-e SEFAZ | FinGo' },
    'nfe':               { icon:'🔎', label:'Busca NF-e', title:'Consulta Automática NF-e SEFAZ | FinGo' },
    'conciliacao-ofx':   { icon:'🔄', label:'Conciliação OFX', title:'Conciliação Bancária OFX | FinGo' },
    'ofx':               { icon:'🔄', label:'Conciliação OFX', title:'Conciliação Bancária OFX | FinGo' },
    'orcamentos':        { icon:'📋', label:'Orçamentos & SINAPI', title:'Orçamento de Obras & Base SINAPI | FinGo' },
    'medicoes':          { icon:'🔨', label:'Medições & Faturamento', title:'Boletim de Medição de Obras | FinGo' },
    'documentacao':      { icon:'📋', label:'Documentação de Obras', title:'Documentos & Alvarás de Obra | FinGo' },
    'relatorios':        { icon:'📥', label:'Relatórios & Exportação', title:'Relatórios Financeiros & Exportação | FinGo' },
    'exportar':          { icon:'📥', label:'Relatórios & Exportação', title:'Relatórios Financeiros & Exportação | FinGo' },
    'contas-bancarias':  { icon:'🏦', label:'Contas Bancárias', title:'Contas Correntes & Caixa | FinGo' },
    'contas':            { icon:'🏦', label:'Contas Bancárias', title:'Contas Correntes & Caixa | FinGo' },
    'fornecedores':      { icon:'🚛', label:'Fornecedores', title:'Cadastro de Fornecedores & Empreiteiros | FinGo' },
    'produtos':          { icon:'📦', label:'Produtos / Insumos', title:'Catálogo de Insumos & Materiais | FinGo' },
    'configuracoes':     { icon:'⚙️', label:'Configurações', title:'Configurações da Empresa | FinGo' },
    'portal-cliente':    { icon:'🌐', label:'Portal do Cliente', title:'Portal da Transparência do Cliente | FinGo' },
    'master':            { icon:'🛡️', label:'Painel Dev Master', title:'Painel Master Administrativo | FinGo' },
    'planos':            { icon:'💎', label:'Planos & Mensalidades', title:'Planos & Assinatura | FinGo' },
    // Patch 52
    'minhas-demandas':   { icon:'👤', label:'Minhas Demandas', title:'Minhas Demandas & Etapas | FinGo' },
    'central-gestor':    { icon:'🏢', label:'Central do Gestor', title:'Central do Gestor de Obras | FinGo' },
  },

  _getRouteFromUrl() {
    // 0. Query parameter direto (?portal_obra=xyz)
    try {
      const search = new URLSearchParams(window.location.search || '');
      const pObra = search.get('portal_obra');
      if (pObra) {
        this.obraId = pObra;
        return 'portal-cliente';
      }
    } catch {}

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
    this.applyAccessibilitySettings();
    window.FinObraStartup?.mark('app-init');
    const rawPath = window.location.pathname || '';
    const rawHash = window.location.hash || '';
    const rawSearch = window.location.search || '';

    // Rota pública de validação de autenticidade (não exige login!)
    if (rawPath.startsWith('/validar') || rawHash.startsWith('#validar') || rawSearch.includes('val=') || rawHash.includes('val=')) {
      if (typeof Assinador !== 'undefined' && typeof Assinador.renderTelaValidacaoPublica === 'function') {
        Assinador.renderTelaValidacaoPublica();
        window.FinObraStartup?.ready();
        return;
      }
    }

    // Rota pública do Portal de Transparência do Cliente (não exige login, sem menus laterais, 100% isolado!)
    const searchParams = new URLSearchParams(rawSearch || (rawHash.includes('?') ? '?' + rawHash.split('?')[1] : ''));
    const isPortalUrl = rawPath.startsWith('/portal') || rawHash.startsWith('#portal') || searchParams.has('portal_obra') || searchParams.has('pdata');
    if (isPortalUrl) {
      if (typeof PortalCliente !== 'undefined' && typeof PortalCliente.renderTelaPublica === 'function') {
        PortalCliente.renderTelaPublica(searchParams);
        window.FinObraStartup?.ready();
        return;
      }
    }

    if (!Auth.requireAuth()) return;

    // Patch 10: a credencial real vive em cookie HttpOnly. Antes de abrir dados locais
    // em uma sessão online, confirma no servidor se a sessão continua válida/revogável.
    if (typeof Auth.refreshSessionFromServer === 'function' && navigator.onLine !== false) {
      const firstCheck = await Auth.refreshSessionFromServer();
      if (firstCheck?.expired) return;
      if (!firstCheck?.success) {
        window.FinObraStartup?.fail('Não foi possível validar sua sessão. Verifique sua conexão e tente novamente.');
        return;
      }
      // Compatibilidade durante rollout: APIs antigas ainda não devolvem o plano em /me.
      if (!firstCheck.plan && typeof Auth.refreshPlanAccess === 'function') {
        try { await Auth.refreshPlanAccess(); }
        catch {
          window.FinObraStartup?.fail('Não foi possível verificar os acessos da empresa. Tente novamente.');
          return;
        }
      }
      window.FinObraStartup?.mark('session-end');
      window.FinObraStartup?.measure('session-access', 'session-start', 'session-end');
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
    window.FinObraStartup?.ready();
    this._bindSyncStatus();

    // Sincronização multi-aba em tempo real: reflete alterações de outras abas sem reload
    window.addEventListener('finobra:cross-tab-mutation', (e) => {
      const table = e.detail?.table;
      console.info(`[App] 🔄 Alteração detectada em outra aba (${table}). Atualizando tela atual...`);
      const modalAberto = document.getElementById('modal-overlay');
      const isModalActive = modalAberto && modalAberto.classList.contains('active');
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (!isModalActive && !isTyping) {
        this.refreshCurrentRoute();
      }
    });

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
    this.navigate(initialRoute, true).then(() => {
      window.FinObraStartup?.mark('initial-route');
      window.FinObraStartup?.measure('navigation-to-route', null, 'initial-route');
    });

    // Atualiza em segundo plano. Reconcilia alterações offline antes de sincronizar da nuvem (C-07).
    Promise.resolve(DB.bootstrapCoreCloud ? DB.bootstrapCoreCloud() : true)
      .then(() => DB.bootstrapCloudCompleteness ? DB.bootstrapCloudCompleteness() : true)
      .then(async () => {
        if (DB._flushCloudQueue) {
          try { await DB._flushCloudQueue(); } catch (e) { console.warn('[App] Flush de fila pendente offline:', e); }
        }
      })
      .then(async () => {
        if (typeof DB.syncRoute === 'function') {
          try { await DB.syncRoute(initialRoute); } catch (e) { console.warn('[App] syncRoute inicial:', e); }
        }
        // Executa sync delta incremental ou fallback DB.syncFromCloud().then
        const syncPromise = (typeof DB.syncDelta === 'function') ? DB.syncDelta() : DB.syncFromCloud();
        return syncPromise.then(async (ok) => {
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
      syncing:   ['↻', 'Sincronizando…', '#38bdf8', 'rgba(56,189,248,.3)', 'rgba(56,189,248,.08)'],
      synced:    ['●', 'Sincronizado', '#10b981', 'rgba(16,185,129,.3)', 'rgba(16,185,129,.06)'],
      pending:   ['●', `${pending || 1} pendente(s)`, '#f59e0b', 'rgba(245,158,11,.35)', 'rgba(245,158,11,.08)'],
      offline:   ['○', 'Offline — canteiro', '#94a3b8', 'rgba(148,163,184,.35)', 'rgba(148,163,184,.06)'],
      attention: ['⚠', `${failed || 1} requer(em) atenção`, '#ef4444', 'rgba(239,68,68,.4)', 'rgba(239,68,68,.08)'],
      cached:    ['●', 'Cache local', 'var(--text3)', 'var(--border)', 'transparent']
    };
    const [d, t, cor, borda, bg] = states[status] || states.cached;
    dot.textContent = d;
    dot.style.color = cor;
    text.textContent = t;
    text.style.color = cor;
    box.style.borderColor = borda;
    box.style.background = bg;
    box.dataset.status = status || 'cached';
  },

  refreshCurrentRoute() {
    const modalAberto = document.getElementById('modal-overlay');
    if (modalAberto && modalAberto.classList.contains('active')) {
      console.info('[App] Modal de edição aberto, mantendo tela atual.');
      return;
    }
    const current = this.route || this._getRouteFromUrl();
    if (current) {
      this.navigate(current, false);
      this.refreshObraSelector();
    }
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
        <td style="text-align:center;">${i.errorCode === 'SYNC_CONFLICT' ? `<button class="btn btn-secondary" data-sync-review="${esc(i.queueId)}">Revisar conflito</button>` : esc(i.httpStatus || '—')}</td>
      </tr>`).join('');
    Utils.showModal(`
      <div class="modal" style="max-width:900px;width:96vw;">
        <div class="modal-header">
          <span class="modal-title">⚠ Sincronizações que requerem atenção</span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:.82rem;color:var(--text2);margin:0 0 14px;">Nenhuma alteração abaixo foi apagada. Você pode tentar reenviar quando a conexão ou o servidor estiver normalizado.</p>
          <div class="table-wrap"><table class="table"><thead><tr><th>Dados</th><th>Ação</th><th>ID</th><th>Motivo</th><th>HTTP</th></tr></thead><tbody>${rows}</tbody></table></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Fechar</button>
          <button class="btn btn-primary" data-fb-click="App.retrySyncIssues" data-fb-click-n="0">↻ Tentar novamente</button>
        </div>
      </div>`);
    document.querySelectorAll('[data-sync-review]').forEach(button => {
      button.addEventListener('click', () => this.reviewSyncConflict(button.dataset.syncReview));
    });
  },

  async reviewSyncConflict(queueId) {
    const tenant = DB._t();
    const issue = DB._getSyncFailed().find(item => item.queueId === queueId);
    if (!issue) return;
    const table = issue.payload?.table || 'lancamentos';
    try {
      const records = await DB._fetchCloudTablePaged(table, 400, true);
      if (DB._t() !== tenant) return;
      const local = issue.payload.data || {};
      const remote = (records || []).find(record => record.id === local.id) || null;
      const esc = value => Utils.escapeHtml(String(value ?? '—'));

      const fieldLabels = {
        lancamentos: [['descricao','Descrição'], ['valor','Valor'], ['tipo','Tipo'], ['status','Status'], ['data','Data'], ['data_vencimento','Vencimento'], ['data_pagamento','Pagamento'], ['categoria','Categoria'], ['fornecedor_beneficiario','Favorecido'], ['conta_bancaria','Conta'], ['obra_id','Obra'], ['nota_fiscal_id','Nota fiscal'], ['codigo_barras','Código de barras'], ['chave_nfe','Chave NF-e'], ['observacoes','Observações'], ['conciliado','Conciliado'], ['itens','Itens']],
        obras: [['nome','Nome da Obra'], ['cliente','Cliente'], ['status','Status'], ['orcamento_total','Orçamento Total'], ['data_inicio','Início'], ['previsao_termino','Previsão de Término'], ['endereco','Endereço'], ['bdi_padrao','BDI Padrão'], ['responsavel','Responsável']],
        clientes: [['nome','Nome da Obra/Cliente'], ['status','Status'], ['orcamento_total','Orçamento Total'], ['data_inicio','Início'], ['previsao_termino','Previsão de Término'], ['endereco','Endereço']],
        notas: [['numero','Número'], ['fornecedor_nome','Fornecedor'], ['valor_total','Valor Total'], ['data_emissao','Emissão'], ['status','Status'], ['chave_nfe','Chave NF-e'], ['obra_id','Obra']],
        fornecedores: [['nome','Nome/Razão Social'], ['documento','CPF/CNPJ'], ['telefone','Telefone'], ['email','E-mail'], ['categoria','Categoria']],
        orcamentos: [['nome','Nome'], ['tipo','Tipo'], ['valor_total','Valor Total'], ['bdi','BDI'], ['status','Status']],
        medicoes: [['numero','Número'], ['periodo_inicio','Início'], ['periodo_fim','Fim'], ['valor_medido','Valor Medido'], ['status','Status']],
        contas: [['nome','Nome da Conta'], ['banco','Banco'], ['saldo_inicial','Saldo Inicial'], ['tipo','Tipo']]
      };

      const ignoredKeys = new Set(['id', 'sync_version', 'created_at', 'updated_at', 'tenant_id', 'client_mutation_id']);
      let fields = fieldLabels[table];
      if (!fields) {
        const allKeys = new Set([...Object.keys(local), ...(remote ? Object.keys(remote) : [])]);
        fields = Array.from(allKeys).filter(k => !ignoredKeys.has(k)).map(k => [k, k.replace(/_/g, ' ').toUpperCase()]);
      }

      const display = value => value && typeof value === 'object' ? JSON.stringify(value) : value;
      const rows = fields.filter(([key]) => JSON.stringify(local[key]) !== JSON.stringify(remote?.[key])).map(([key, label]) => `<tr><td>${esc(label)}</td><td>${esc(display(local[key]))}</td><td>${esc(display(remote?.[key]))}</td></tr>`).join('');
      const entityName = table === 'lancamentos' ? 'lançamento' : (table === 'obras' || table === 'clientes' ? 'obra' : (table === 'notas' ? 'nota fiscal' : 'registro'));

      Utils.showModal(`<div class="modal" style="max-width:900px;width:96vw;">
        <div class="modal-header"><span class="modal-title">Revisar ${entityName}</span><button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button></div>
        <div class="modal-body"><p>${remote ? 'Compare as diferenças antes de escolher qual versão manter.' : `Este ${entityName} foi excluído na nuvem. Sua alteração permanece guardada até concluir a revisão.`}</p><div class="table-wrap"><table class="table"><thead><tr><th>Campo</th><th>Minha alteração</th><th>Versão salva</th></tr></thead><tbody>${rows || '<tr><td colspan="3" style="text-align:center;">Nenhuma divergência de campos encontrada.</td></tr>'}</tbody></table></div></div>
        <div class="modal-footer"><button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Voltar depois</button><button class="btn btn-secondary" id="sync-keep-remote">${remote ? 'Manter versão salva' : 'Aceitar exclusão'}</button>${remote ? '<button class="btn btn-primary" id="sync-keep-local">Aplicar minha alteração</button>' : ''}</div>
      </div>`);
      const resolve = keepLocal => {
        if (DB._t() !== tenant) return;
        try {
          DB.resolveSyncConflict(queueId, remote, keepLocal, local);
          Utils.closeModal();
          this.refreshCurrentRoute();
          Utils.toast(keepLocal ? 'Alteração enviada para sincronização.' : 'Revisão concluída.', 'success');
        } catch (error) { Utils.toast(error.message, 'warning'); }
      };
      document.getElementById('sync-keep-remote')?.addEventListener('click', () => resolve(false));
      document.getElementById('sync-keep-local')?.addEventListener('click', () => resolve(true));
    } catch (error) { Utils.toast(error.message || 'Não foi possível consultar o registro.', 'warning'); }
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
      : `<div class="workspace-brand"><span class="workspace-brand-mark"><img src="/img/fingo/fingo-symbol.png" alt="FinGo" style="width:24px;height:24px;object-fit:contain;display:block;"></span><div style="min-width:0"><div class="workspace-brand-name" style="display:flex;align-items:center;"><img src="/img/fingo/fingo-wordmark.png" alt="FinGo" style="height:16px;width:auto;object-fit:contain;display:block;"></div><div class="workspace-brand-company" title="${brandName}">${brandName}</div></div></div>`;

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
            <button type="button" class="impersonation-btn" data-fb-click="App.sairModoSuporte" data-fb-click-n="0" title="Encerrar suporte e retornar ao painel administrativo Master">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Voltar ao Painel Master</span>
            </button>
          </aside>
        ` : ''}
        <!-- Overlay Escuro para Mobile -->
        <div class="sidebar-overlay" id="sidebar-overlay" data-fb-click="App.closeSidebar" data-fb-click-n="0"></div>

        <aside class="sidebar" id="sidebar">
          <div class="sidebar-logo" style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-s);min-height:70px;">
            ${logoHtml}
            <button class="icon-btn mobile-close-btn" data-fb-click="App.closeSidebar" data-fb-click-n="0" title="Fechar Menu" style="font-size:1.1rem;padding:4px 8px;">✕</button>
          </div>
          <nav class="sidebar-nav">
            ${this._renderSidebarNav(badgePre)}
          </nav>
          <div class="sidebar-foot">
            <button type="button" class="user-card" aria-label="Abrir minha conta" data-fb-click="App.showUserMenu" data-fb-click-n="0">
              <div class="user-av">${Utils.escapeHtml(u?.avatar || 'AD')}</div>
              <div class="user-info">
                <div class="user-name">${Utils.escapeHtml(u?.nome || 'Administrador')}</div>
                <div class="user-role">${brandName}</div>
              </div>
            </button>
          </div>
        </aside>

        <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
          <header class="main-header" id="main-header">
            <button class="icon-btn" id="mob-menu" aria-label="Menu de navegação" aria-controls="sidebar" aria-expanded="false" data-fb-click="App.toggleSidebar" data-fb-click-n="0" title="Recolher / Expandir Menu Lateral (Ctrl+B)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div style="min-width:0;flex-shrink:1;">
              <div class="header-title" id="h-title">📊 Dashboard</div>
              <div class="header-sub">${brandName} — Gestão Financeira</div>
            </div>
            <div class="hspacer"></div>
            <!-- Dropdown Suporte Técnico & Atendimento -->
            ${isImpersonating ? '' : (typeof Suporte !== 'undefined' ? Suporte.renderHeaderDropdown() : '')}
            <!-- Agenda Dev & Capacitação Técnica -->
            ${typeof AgendaEventos !== 'undefined' ? AgendaEventos.renderHeaderBtn() : ''}
            <!-- Botão Busca Global -->
            <button type="button" class="header-search-btn header-global-search" aria-label="Buscar no sistema" data-fb-click="Patch26Actions.globalSearchOpen" data-fb-click-n="0" title="Busca Global em todo o sistema (Ctrl+K)" style="cursor:pointer;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:8px;padding:5px 10px;transition:all .2s;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <span style="font-size:.78rem;color:var(--text2);font-weight:600;">Buscar...</span>
              <kbd style="font-size:.65rem;color:var(--text3);background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:3px;padding:1px 4px;">Ctrl+K</kbd>
            </button>
            <!-- Botão Acessibilidade -->
            <button type="button" class="header-access-btn" aria-label="Acessibilidade e temas" data-fb-click="App.showAccessibilityModal" data-fb-click-n="0" title="Acessibilidade: Tela Clara/Escura &amp; Daltonismo" style="cursor:pointer;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:8px;padding:5px 9px;transition:all .2s;color:var(--text2);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="m4.93 10.93 4.24-4.24a2 2 0 0 1 2.83 0l4.24 4.24M12 8v13M8 17l4 4 4-4"/></svg>
              <span style="font-size:.75rem;font-weight:600;">Acessibilidade</span>
            </button>
            <!-- Central de Alertas Notificações -->
            <div id="header-notif-container">
              ${typeof Notificacoes !== 'undefined' ? Notificacoes.renderBellBtn() : ''}
            </div>
          </header>
          <main class="main-content" id="main-content">
            <div class="workspace-context"><span class="workspace-context-label">Filtrar por obra</span>
            <button type="button" class="obra-sel-btn" data-fb-click="App.abrirBuscaObras" data-fb-click-n="0" title="Filtrar ou pesquisar obra">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span class="obra-sel-label" id="obra-sel-current-name">Todas as Obras</span>
              <span style="font-size:.68rem;color:var(--text3);background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:4px;">🔍</span>
            </button>
            <button type="button" id="sync-status-indicator" title="Status da sincronização com a nuvem. Clique para tentar novamente itens que exigem atenção." data-fb-click="App.showSyncIssues" data-fb-click-n="0" style="display:flex;align-items:center;gap:5px;font-size:.7rem;color:var(--text3);padding:4px 8px;border:1px solid var(--border);border-radius:999px;white-space:nowrap;">
              <span id="sync-status-dot">●</span><span id="sync-status-text">Cache local</span>
            </button>
            </div>
            <div id="route-content"></div>
          </main>
        </div>
      ${this._mobileNavigation()}
      </div>`;

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.inert = window.innerWidth <= 768;
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

  _navSections: [
    {
      id: 'gestao',
      label: 'Visão Geral & Gestão',
      get icone() { return FinObraUI.icon('sec-gestao'); },
      rotas: ['dashboard', 'minhas-demandas', 'central-gestor']
    },
    {
      id: 'obras',
      label: 'Obras & Canteiro',
      get icone() { return FinObraUI.icon('sec-obras'); },
      rotas: ['obras', 'medicoes', 'documentacao', 'portal-cliente']
    },
    {
      id: 'financeiro',
      label: 'Financeiro & Caixa',
      get icone() { return FinObraUI.icon('sec-financeiro'); },
      rotas: ['lancamentos', 'escritorio', 'contas-bancarias', 'conciliacao-ofx', 'recibos']
    },
    {
      id: 'suprimentos',
      label: 'Suprimentos & Compras',
      get icone() { return FinObraUI.icon('sec-suprimentos'); },
      rotas: ['pre-compras', 'contratos', 'fornecedores', 'produtos']
    },
    {
      id: 'fiscal',
      label: 'Fiscal & SEFAZ',
      get icone() { return FinObraUI.icon('sec-fiscal'); },
      rotas: ['notas-fiscais', 'consulta-nfe']
    },
    {
      id: 'planejamento',
      label: 'Engenharia & SINAPI',
      get icone() { return FinObraUI.icon('sec-planejamento'); },
      rotas: ['orcamentos', 'relatorios']
    },
    {
      id: 'sistema',
      label: 'Sistema & Configurações',
      get icone() { return FinObraUI.icon('sec-sistema'); },
      rotas: ['planos', 'configuracoes', 'validar']
    }
  ],

  _getExpandedSections() {
    try {
      const raw = localStorage.getItem('finobra_expanded_nav_sections');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { gestao: true, obras: true, financeiro: true, suprimentos: true, fiscal: true, planejamento: true, sistema: true };
  },

  isSectionExpanded(sectionId) {
    const states = this._getExpandedSections();
    if (typeof states[sectionId] === 'boolean') {
      return states[sectionId];
    }
    return true;
  },

  toggleNavSection(encodedSectionId) {
    const sectionId = decodeURIComponent(encodedSectionId || '');
    const header = document.querySelector(`[data-section-header="${sectionId}"]`);
    const body = document.getElementById(`nav-sec-body-${sectionId}`);
    
    // Determina o estado atual olhando a classe 'expanded' do elemento no DOM
    const isCurrentlyExp = body 
      ? body.classList.contains('expanded') 
      : this.isSectionExpanded(sectionId);

    const willBeOpen = !isCurrentlyExp;
    const states = this._getExpandedSections();
    states[sectionId] = willBeOpen;
    try {
      localStorage.setItem('finobra_expanded_nav_sections', JSON.stringify(states));
    } catch {}

    if (header && body) {
      header.setAttribute('aria-expanded', String(willBeOpen));
      body.classList.toggle('expanded', willBeOpen);
      body.classList.toggle('collapsed', !willBeOpen);
    }
  },

  _navItemsCatalog: {
    'dashboard': { icon: '📊', label: 'Dashboard' },
    'minhas-demandas': { icon: '👤', label: 'Minhas Demandas' },
    'central-gestor': { icon: '🏢', label: 'Central do Gestor' },
    'obras': { icon: '🏗️', label: 'Obras & Clientes' },
    'medicoes': { icon: '🔨', label: 'Medições & Faturamento' },
    'documentacao': { icon: '📁', label: 'Documentação de Obras' },
    'portal-cliente': { icon: '🌐', label: 'Portal do Cliente' },
    'lancamentos': { icon: '💰', label: 'Lançamentos' },
    'escritorio': { icon: '🏢', label: 'Despesas Escritório' },
    'contas-bancarias': { icon: '🏦', label: 'Contas Bancárias' },
    'conciliacao-ofx': { icon: '🔄', label: 'Conciliação OFX' },
    'recibos': { icon: '🧾', label: 'Recibos Oficiais' },
    'pre-compras': { icon: '🛒', label: 'Pré-Compras' },
    'contratos': { icon: '📜', label: 'Contratos de Obra' },
    'fornecedores': { icon: '🚛', label: 'Fornecedores' },
    'produtos': { icon: '📦', label: 'Produtos / Insumos' },
    'notas-fiscais': { icon: '📄', label: 'Notas Fiscais' },
    'consulta-nfe': { icon: '🔎', label: 'Busca NF-e' },
    'orcamentos': { icon: '📋', label: 'Orçamentos' },
    'relatorios': { icon: '📥', label: 'Exportar Relatórios' },
    'planos': { icon: '💎', label: 'Planos & Mensalidades' },
    'configuracoes': { icon: '⚙️', label: 'Configurações' }
  },

  getFavoriteRoutes() {
    try {
      const tenant = (typeof Auth !== 'undefined' && Auth.getTenantId) ? Auth.getTenantId() : (Auth?.getUser?.()?.tenant_id || 'default');
      const raw = localStorage.getItem(`finobra_fav_routes_${tenant}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(r => this._normalizeRoute(r));
      }
    } catch {}
    return [];
  },

  isRouteFavorite(route) {
    const norm = this._normalizeRoute(route);
    return this.getFavoriteRoutes().includes(norm);
  },

  toggleFavorite(encodedRoute, ev) {
    if (ev) {
      if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
      if (typeof ev.preventDefault === 'function') ev.preventDefault();
    }
    const route = decodeURIComponent(encodedRoute || '');
    const norm = this._normalizeRoute(route);
    const tenant = (typeof Auth !== 'undefined' && Auth.getTenantId) ? Auth.getTenantId() : (Auth?.getUser?.()?.tenant_id || 'default');
    let favs = this.getFavoriteRoutes();
    const isAlreadyFav = favs.includes(norm);

    if (isAlreadyFav) {
      favs = favs.filter(r => r !== norm);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        const itemInfo = this._navItemsCatalog[norm];
        Utils.toast(`${itemInfo?.label || 'Módulo'} desafixado dos favoritos.`, 'info');
      }
    } else {
      favs.push(norm);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        const itemInfo = this._navItemsCatalog[norm];
        Utils.toast(`📌 ${itemInfo?.label || 'Módulo'} fixado no topo dos fixados!`, 'success');
      }
    }

    try {
      localStorage.setItem(`finobra_fav_routes_${tenant}`, JSON.stringify(favs));
    } catch {}

    this.refreshSidebarNav();
  },

  refreshSidebarNav() {
    const navEl = document.querySelector('.sidebar-nav');
    if (!navEl) return;
    const resumoPre = typeof DB !== 'undefined' && DB.getPreComprasResumo ? DB.getPreComprasResumo('todas') : { pendentesQtd: 0 };
    const badgePre = resumoPre.pendentesQtd > 0 ? `<span class="nav-badge" style="background:#f59e0b;color:#182713;font-weight:900;" title="${resumoPre.pendentesQtd} pedido(s) pendente(s)">${resumoPre.pendentesQtd}</span>` : '';
    navEl.innerHTML = this._renderSidebarNav(badgePre);
  },

  _renderSidebarNav(badgePre) {
    const badgeDemandas = (() => {
      const cnt = typeof MinhasDemandas !== 'undefined' ? MinhasDemandas.getBadgeCount() : 0;
      return cnt > 0 ? `<span class="nav-badge" style="background:var(--danger);color:#fff;font-weight:900;">${cnt}</span>` : '';
    })();

    const activeRoute = this._normalizeRoute(this.route || this._getRouteFromUrl());
    const favRoutes = this.getFavoriteRoutes();

    // Seção de Fixados / Favoritos no topo da navegação
    let pinnedSectionHtml = '';
    if (favRoutes && favRoutes.length > 0) {
      const validFavs = favRoutes.filter(r => {
        if (!this._navItemsCatalog[r]) return false;
        if (typeof Auth !== 'undefined' && Auth.canRoute && !Auth.canRoute(r, 'read')) return false;
        return true;
      });

      if (validFavs.length > 0) {
        const pinnedItemsHtml = validFavs.map(r => {
          const info = this._navItemsCatalog[r];
          const badge = r === 'minhas-demandas' ? badgeDemandas : (r === 'pre-compras' ? badgePre : '');
          return this._navItem(r, info.icon, info.label, badge, true);
        }).join('');

        pinnedSectionHtml = `
          <div class="nav-pinned-section" style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);">
            <div class="nav-pinned-header" style="display:flex;align-items:center;justify-content:space-between;padding:4px 14px 6px;font-size:0.68rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;">
              <span style="display:flex;align-items:center;gap:6px;"><span>${FinObraUI.icon('pin')}</span> <span>Fixados</span></span>
              <span style="font-size:0.65rem;background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:999px;font-weight:600;">${validFavs.length}</span>
            </div>
            <div class="nav-pinned-items">
              ${pinnedItemsHtml}
            </div>
          </div>
        `;
      }
    }

    const sectionsHtml = this._navSections.map(sec => {
      const isExpanded = this.isSectionExpanded(sec.id);
      const isCurrentInSec = sec.rotas.includes(activeRoute);

      let itemsHtml = '';
      if (sec.id === 'gestao') {
        itemsHtml = `
          ${this._navItem('dashboard','📊','Dashboard')}
          ${this._navItem('minhas-demandas','👤','Minhas Demandas',badgeDemandas)}
          ${this._navItem('central-gestor','🏢','Central do Gestor')}
        `;
      } else if (sec.id === 'obras') {
        itemsHtml = `
          ${this._navItem('obras','🏗️','Obras & Clientes')}
          ${this._navItem('medicoes','🔨','Medições & Faturamento')}
          ${this._navItem('documentacao','📁','Documentação de Obras')}
          ${this._navItem('portal-cliente','🌐','Portal do Cliente')}
        `;
      } else if (sec.id === 'financeiro') {
        itemsHtml = `
          ${this._navItem('lancamentos','💰','Lançamentos')}
          ${this._navItem('escritorio','🏢','Despesas Escritório')}
          ${this._navItem('contas-bancarias','🏦','Contas Bancárias')}
          ${this._navItem('conciliacao-ofx','🔄','Conciliação OFX')}
          ${this._navItem('recibos','🧾','Recibos Oficiais')}
        `;
      } else if (sec.id === 'suprimentos') {
        itemsHtml = `
          ${this._navItem('pre-compras','🛒','Pré-Compras',badgePre)}
          ${this._navItem('contratos','📜','Contratos de Obra')}
          ${this._navItem('fornecedores','🚛','Fornecedores')}
          ${this._navItem('produtos','📦','Produtos / Insumos')}
        `;
      } else if (sec.id === 'fiscal') {
        itemsHtml = `
          ${this._navItem('notas-fiscais','📄','Notas Fiscais')}
          ${this._navItem('consulta-nfe','🔎','Busca NF-e')}
        `;
      } else if (sec.id === 'planejamento') {
        itemsHtml = `
          ${this._navItem('orcamentos','📋','Orçamentos')}
          ${this._navItem('relatorios','📥','Exportar Relatórios')}
        `;
      } else if (sec.id === 'sistema') {
        itemsHtml = `
          ${this._navItem('planos','💎','Planos & Mensalidades')}
          ${this._navItem('configuracoes','⚙️','Configurações')}
          <a href="/validar" target="_blank" class="nav-item" style="text-decoration:none;color:var(--accent2);margin-top:2px;border:1px dashed rgba(201,162,39,0.3);border-radius:6px;" title="Portal público para consultar autenticidade de documentos por código">
            <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span style="flex:1;text-align:left;">Validar Autenticidade ↗</span>
          </a>
        `;
      }

      return `
        <div class="nav-accordion-group" data-section="${sec.id}">
          <button type="button" class="nav-accordion-header ${isCurrentInSec ? 'active-segment' : ''}"
            data-section-header="${sec.id}"
            aria-expanded="${isExpanded ? 'true' : 'false'}"
            aria-controls="nav-sec-body-${sec.id}"
            data-fb-click="App.toggleNavSection" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(sec.id)}">
            <span class="nav-accordion-title">
              <span>${sec.icone}</span>
              <span>${sec.label}</span>
            </span>
            <span class="nav-accordion-chevron">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
          </button>
          <div class="nav-accordion-body ${isExpanded ? 'expanded' : 'collapsed'}" id="nav-sec-body-${sec.id}">
            ${itemsHtml}
          </div>
        </div>
      `;
    }).join('');

    return pinnedSectionHtml + sectionsHtml;
  },

  _mobileNavigation() {
    const items = [['dashboard','Início'],['lancamentos','Financeiro'],['obras','Obras']];
    return `<nav class="mobile-workspace-nav" aria-label="Navegação principal">${items.filter(([route]) => !Auth.canRoute || Auth.canRoute(route,'read')).map(([route,label]) => `<button type="button" class="mobile-nav-item${this.route===route?' active':''}" data-route="${route}" data-fb-click="Patch26Actions.navigateCloseSidebar" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${route}">${FinObraUI.icon(route)}<span>${label}</span></button>`).join('')}<button type="button" class="mobile-nav-item" aria-label="Abrir menu completo" data-fb-click="App.toggleSidebar" data-fb-click-n="0">${FinObraUI.icon('menu')}<span>Menu</span></button></nav>`;
  },

  _navItem(route, icon, label, badgeHtml = '', isPinnedItem = false) {
    icon = FinObraUI.icon(route);
    const targetRoute = this._normalizeRoute(route);
    if (typeof Auth !== 'undefined' && Auth.canRoute && !Auth.canRoute(targetRoute, 'read')) {
      if (Auth.isPlanRouteLocked?.(targetRoute)) {
        return `<button type="button" class="nav-item" style="opacity:.72;border:1px dashed var(--border);" data-fb-click="Cobranca.showLockedModule" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(targetRoute))}" title="Disponível em outro plano">
          <span>${icon}</span><span style="flex:1;text-align:left;">${label}</span><span style="font-size:.68rem;color:var(--accent2)">🔒</span>
        </button>`;
      }
      return '';
    }
    const isAct = (this.route === targetRoute) || (this._normalizeRoute(this.route) === targetRoute);
    const isFav = this.isRouteFavorite(targetRoute);
    const favTitle = isFav ? 'Desafixar dos fixados' : 'Fixar no topo dos fixados';

    return `<button type="button" class="nav-item${isAct?' active':''}${isPinnedItem ? ' nav-item-pinned' : ''}" data-route="${targetRoute}" data-fb-click="Patch26Actions.navigateCloseSidebar" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(targetRoute))}">
      <span>${icon}</span><span class="nav-label" style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${label}</span>${badgeHtml}
      <span class="nav-fav-btn ${isFav ? 'is-fav' : ''}" data-fb-click="App.toggleFavorite" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(targetRoute))}" data-fb-click-t1="event" title="${favTitle}" aria-label="${favTitle}" role="button" tabindex="0" style="display:inline-flex;align-items:center;justify-content:center;padding:4px;cursor:pointer;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? 'var(--accent)' : 'none'}" stroke="${isFav ? 'var(--accent)' : 'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="transition:transform .15s,color .15s;${isFav ? 'transform:rotate(-30deg);' : 'opacity:.45;'}"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-2l-2-2V6h1V4H6v2h1v7l-2 2z"></path></svg>
      </span>
    </button>`;
  },

  _firstAllowedRoute() {
    const preferred = ['dashboard','obras','lancamentos','fornecedores','produtos','pre-compras','recibos','contratos','notas-fiscais','orcamentos','medicoes','documentacao','relatorios','planos','contas-bancarias','configuracoes'];
    return preferred.find(r => !Auth?.canRoute || Auth.canRoute(r,'read')) || 'dashboard';
  },

  addBreadcrumb(type, target, details) {
    if (!this._breadcrumbs) this._breadcrumbs = [];
    this._breadcrumbs.push({
      t: Date.now(),
      type: String(type || 'action').slice(0, 30),
      target: String(target || '').slice(0, 120),
      details: String(details || '').slice(0, 160)
    });
    if (this._breadcrumbs.length > 10) this._breadcrumbs.shift();
  },

  _installErrorMonitor() {
    if (this._errorMonitorInstalled) return;
    this._errorMonitorInstalled = true;

    // Rastreia cliques relevantes do usuário como breadcrumbs
    try {
      document.addEventListener('click', (ev) => {
        try {
          const target = ev.target;
          const el = target?.closest ? target.closest('button, a, [data-fb-click], input[type="submit"], input[type="button"]') : null;
          if (el) {
            const label = (el.innerText || el.getAttribute('title') || el.getAttribute('aria-label') || el.getAttribute('data-fb-click') || el.tagName).trim().slice(0, 50);
            this.addBreadcrumb('click', el.tagName.toLowerCase(), label);
          }
        } catch {}
      }, { passive: true, capture: true });
    } catch {}

    const report = (payload = {}) => {
      try {
        const message = String(payload.message || 'Erro JavaScript').slice(0, 1500);
        const source = String(payload.source || '').slice(0, 500);
        const fp = `${message}|${source}|${payload.line || ''}|${this.route || ''}`;
        const now = Date.now();
        const previous = this._errorFingerprints.get(fp) || 0;
        if (now - previous < 30000) return;
        this._errorFingerprints.set(fp, now);
        if (this._errorFingerprints.size > 100) {
          for (const [key, ts] of this._errorFingerprints) if (now - ts > 10 * 60 * 1000) this._errorFingerprints.delete(key);
        }

        const hasAuth = Boolean(typeof Auth !== 'undefined' && Auth.getSession && Auth.getSession());
        const headers = hasAuth ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' };
        const bodyObj = {
          ...payload,
          message,
          source,
          route: this.route || (this._getRouteFromUrl ? this._getRouteFromUrl() : 'unknown'),
          breadcrumbs: (this._breadcrumbs || []).slice(-10),
          viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
          // Nunca envia query string/hash para telemetria: podem conter códigos, tokens ou dados operacionais.
          url: `${window.location.origin}${window.location.pathname}`,
          connection: navigator.connection?.effectiveType || '',
          online: navigator.onLine !== false
        };

        const bodyStr = JSON.stringify(bodyObj);
        fetch('/api/audit?action=client_error', {
          method: 'POST',
          headers,
          keepalive: true,
          signal: AbortSignal.timeout(5000),
          body: bodyStr
        }).catch(() => {});
      } catch {}
    };

    window.addEventListener('error', e => report({ message: e.message || e.error?.message, source: e.filename, line: e.lineno, col: e.colno, stack: e.error?.stack || '' }));
    window.addEventListener('unhandledrejection', e => {
      const reason = e.reason;
      report({ message: reason?.message || String(reason || 'Promise rejeitada'), source: 'unhandledrejection', stack: reason?.stack || '' });
    });
    window.addEventListener('securitypolicyviolation', e => {
      if (e.disposition === 'report' && (e.violatedDirective === 'script-src-attr' || e.effectiveDirective === 'script-src-attr')) {
        return;
      }
      report({
        message: `CSP ${e.disposition === 'report' ? 'mediu' : 'bloqueou'} ${e.violatedDirective || 'diretiva'}: ${e.blockedURI || 'inline'}`,
        source: e.disposition === 'report' ? 'csp-report' : 'csp',
        line: e.lineNumber || 0, col: e.columnNumber || 0,
        stack: `effective=${e.effectiveDirective || ''}; disposition=${e.disposition || ''}`
      });
    });
  },

  async navigate(route, updateHistory = true) {
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
      if (Auth.isPlanRouteLocked?.(targetRoute) && typeof Cobranca !== 'undefined' && Cobranca.showLockedModule) {
        Cobranca.showLockedModule(targetRoute);
        return;
      }
      const fallback = this._firstAllowedRoute();
      if (targetRoute !== fallback && typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Seu usuário não possui acesso a este módulo.', 'warning');
      targetRoute = fallback;
    }
    this.route = targetRoute;
    this.addBreadcrumb('navigation', targetRoute, cleanRoute);
    const navigation = this._navigationId = (this._navigationId || 0) + 1;
    this._charts.forEach(c => { try { c.destroy(); } catch{} });
    this._charts = [];
    if (typeof Cobranca !== 'undefined' && typeof Cobranca.fecharModalPix === 'function') {
      try { Cobranca.fecharModalPix(); } catch {}
    }

    // Atualiza itens ativos no menu lateral
    document.querySelectorAll('.nav-item,.mobile-nav-item').forEach(el => {
      const itemRoute = el.dataset.route;
      const isActive = !!itemRoute && ((itemRoute === targetRoute) || (this._normalizeRoute(itemRoute) === targetRoute));
      el.classList.toggle('active', isActive);
      if (isActive) el.setAttribute('aria-current','page');
      else el.removeAttribute('aria-current');
    });

    // Auto-expande o accordion da sidebar que contém o item ativo
    const activeNavEl = document.querySelector(`.nav-item.active[data-route="${targetRoute}"]`);
    const parentNavSec = activeNavEl?.closest('.nav-accordion-body');
    if (parentNavSec && parentNavSec.classList.contains('collapsed')) {
      parentNavSec.classList.remove('collapsed');
      parentNavSec.classList.add('expanded');
      const secKey = parentNavSec.id?.replace('nav-sec-body-', '');
      if (secKey) {
        const secHdr = document.querySelector(`[data-section-header="${secKey}"]`);
        if (secHdr) {
          secHdr.setAttribute('aria-expanded', 'true');
          secHdr.classList.add('active-segment');
        }
        try {
          const states = this._getExpandedSections();
          states[secKey] = true;
          localStorage.setItem('finobra_expanded_nav_sections', JSON.stringify(states));
        } catch {}
      }
    }

    // Atualiza cabeçalho e título da página na aba do navegador
    const meta = this.routeMeta[targetRoute] || { icon: '📊', label: 'FinGo' };
    const hTitle = document.getElementById('h-title');
    if (hTitle) hTitle.textContent = meta.label;
    document.title = meta.title || `FinGo — ${meta.label}`;

    // A URL acompanha a intenção de navegação mesmo enquanto o módulo é baixado.
    if (updateHistory) {
      const cleanUrl = `/app/${targetRoute}`;
      if (window.location.pathname !== cleanUrl || window.location.hash) {
        history.pushState({ route: targetRoute }, '', cleanUrl);
      }
    }

    // Renderiza a view correspondente
    const el = document.getElementById('route-content');
    if (el) {
      try {
        const resource = { dashboard:'charts', 'obra-detalhe':'charts', 'conciliacao-ofx':'ofx', orcamentos:'sinapi', relatorios:'reports' }[targetRoute];
        if (resource && !FinObraAssets.ready(resource)) {
          const skeletonType = ['lancamentos', 'notas', 'medicoes', 'clientes', 'fornecedores', 'orcamentos', 'contas'].includes(targetRoute) ? 'table' : 'dashboard';
          el.innerHTML = (typeof Utils !== 'undefined' && Utils.renderPageSkeleton)
            ? Utils.renderPageSkeleton(skeletonType)
            : '<div role="status" aria-label="Carregando" class="skeleton" style="height:240px;border-radius:12px;margin:20px 0;"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">Carregando módulo…</span></div>';
          await FinObraAssets.load(resource);
          if (navigation !== this._navigationId || el !== document.getElementById('route-content')) return;
        }
        el.innerHTML = this.routes[targetRoute].render(this.obraId);
        if (typeof this.routes[targetRoute].init === 'function') {
          this.routes[targetRoute].init(this.obraId);
        }

        if (typeof DB !== 'undefined' && typeof DB.syncRoute === 'function') {
          DB.syncRoute(targetRoute).then(updated => {
            if (updated && this.route === targetRoute && navigation === this._navigationId) {
              const contentEl = document.getElementById('route-content');
              if (contentEl && this.routes[targetRoute]) {
                contentEl.innerHTML = this.routes[targetRoute].render(this.obraId);
                if (typeof this.routes[targetRoute].init === 'function') {
                  this.routes[targetRoute].init(this.obraId);
                }
              }
            }
          }).catch((syncErr) => {
            console.warn('[App] Falha ao sincronizar rota; mantendo dados locais:', syncErr?.message || syncErr);
            if (this.route === targetRoute && navigation === this._navigationId && typeof Utils !== 'undefined' && Utils.toast) {
              Utils.toast('Dados locais exibidos. A sincronização com a nuvem falhou e será tentada novamente.', 'warning');
            }
          });
        }
      } catch(err) {
        if (navigation !== this._navigationId) return;
        console.error(err);
        el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">
          <h3 style="color:var(--accent);margin-bottom:8px">Erro ao carregar</h3>
          <p style="font-size:.85rem">${Utils.escapeHtml(err?.message || 'Falha inesperada.')}</p>
          <button class="btn btn-secondary" id="route-retry">Tentar novamente</button>
        </div>`;
        document.getElementById('route-retry')?.addEventListener('click', () => this.navigate(targetRoute, false));
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
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body" style="padding:16px 20px;overflow-y:auto;flex:1;">
          
          <!-- Campo de Busca Instantânea -->
          <div style="position:relative;margin-bottom:16px;">
            <input type="text" id="input-busca-obras" class="form-control" placeholder="Buscar por cliente, cidade, contrato Caixa, CPF ou status..." autofocus style="padding-left:38px;font-size:.92rem;background:var(--bg-secondary);border-color:var(--accent);" data-fb-input="App._onSearchObraInput" data-fb-input-n="1" data-fb-input-t0="value">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:1rem;color:var(--text3);pointer-events:none;">🔍</span>
          </div>

          <div id="lista-busca-obras-container">
            ${this._renderListaBuscaObras('')}
          </div>
        </div>
        <div class="modal-footer" style="padding:10px 20px;justify-content:space-between;border-top:1px solid var(--border);">
          <span style="font-size:.75rem;color:var(--text3);">Dica: Pressione <code>Ctrl + K</code> ou <code>/</code> a qualquer momento para buscar</span>
          <button class="btn btn-secondary btn-sm" data-fb-click="Utils.closeModal" data-fb-click-n="0">Fechar</button>
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
      <div class="obra-search-item ${isTodas ? 'selected' : ''}" data-fb-click="App.selecionarObra" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="todas" style="margin-bottom:8px;border-left:4px solid ${isTodas ? 'var(--accent)' : 'var(--border)'};">
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
      <div class="obra-search-item ${isEscritorio ? 'selected' : ''}" data-fb-click="App.selecionarObra" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="escritorio" style="margin-bottom:10px;border-left:4px solid ${isEscritorio ? 'var(--accent)' : 'var(--border)'};">
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
      <div class="obra-search-item ${isSel ? 'selected' : ''}" data-fb-click="App.selecionarObra" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(c.id))}" style="margin-bottom:8px;border-left:4px solid ${isSel ? 'var(--accent)' : 'var(--border)'};">
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
        <div class="modal-header"><span class="modal-title">👤 Minha Conta</span><button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button></div>
        <div class="modal-body" style="text-align:center;">
          <div class="user-av" style="width:60px;height:60px;font-size:1.4rem;margin:0 auto 12px;">${e(u?.avatar || 'US')}</div>
          <div style="font-weight:800;font-size:1.05rem;">${e(u?.nome || 'Usuário')}</div>
          <div style="color:var(--accent2);font-size:.84rem;margin-top:2px;font-weight:600;">${e(emp.nome_fantasia || emp.razao_social || 'Minha Empresa')}</div>
          <div style="color:var(--text3);font-size:.75rem;margin-top:4px;margin-bottom:16px;">${e(roleLabel)} &middot; Logado: ${Utils.fmt.datetime(u?.loginAt)}</div>
          
          <div style="display:flex;flex-direction:column;gap:8px;text-align:left;">
            ${canAdmin ? `<button class="btn btn-secondary btn-block" data-fb-click="Patch26Actions.closeModalOnboarding" data-fb-click-n="0">
              🏢 Dados &amp; Logotipo da Empresa
            </button>` : ''}
            <button class="btn btn-secondary btn-block" data-fb-click="Patch26Actions.closeModalProfile" data-fb-click-n="0">
              👤 Meu Perfil / Alterar Senha
            </button>
            <button class="btn btn-secondary btn-block" data-fb-click="Patch26Actions.closeModalConfig" data-fb-click-n="0">
              ⚙️ Gerenciar Usuários e Sistema
            </button>
          </div>
        </div>
        <div class="modal-footer" style="justify-content:center;">
          <button class="btn btn-danger btn-block" data-fb-click="Patch26Actions.closeModalLogout" data-fb-click-n="0">Sair do Sistema</button>
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
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <form class="modal-body" id="f-onboarding-empresa" data-fb-submit="App.saveOnboardingEmpresa" data-fb-submit-n="1" data-fb-submit-t0="event">
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
                <button type="button" class="btn btn-secondary btn-sm" data-fb-click="App.consultarCnpjOnboarding" data-fb-click-n="0" title="Buscar CNPJ na Receita">🔍</button>
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
              <input type="file" id="ob-logo-file" accept="image/*" style="display:none;" data-fb-change="App.handleLogoUploadOnboarding" data-fb-change-n="1" data-fb-change-t0="self">
              <button type="button" class="btn btn-secondary btn-sm" data-fb-click="Patch26Actions.clickById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="ob-logo-file">📁 Escolher Logotipo</button>
              ${emp.logo_url ? `<button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" data-fb-click="App.removerLogoOnboarding" data-fb-click-n="0">🗑️ Remover Logo</button>` : ''}
              <span id="ob-logo-preview-txt" style="font-size:.78rem;color:var(--text3);">${emp.logo_url ? 'Logotipo atual salvo' : 'Nenhuma imagem selecionada'}</span>
            </div>
            <div style="font-size:.72rem;color:var(--text3);margin-top:6px;line-height:1.4;">
              💡 <strong>Recomendado:</strong> Formato horizontal retangular (~3:1 ou 4:1, ex: 300x100px) com fundo transparente em <strong>.PNG</strong> para perfeito encaixe no menu e relatórios.
            </div>
            <input type="hidden" name="logo_url" id="ob-logo-url" value="${emp.logo_url || ''}">
          </div>

          <div class="modal-footer" style="padding-bottom:0;">
            <button type="button" class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
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
      const res = await fetch(`/api/cnpj?cnpj=${raw}`, { signal: AbortSignal.timeout(10000) });
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
        sb.inert = !sb.classList.contains('open');
        document.getElementById('mob-menu')?.setAttribute('aria-expanded', String(!sb.inert));
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
      if (sb) { sb.classList.remove('open'); sb.inert = true; }
      document.getElementById('mob-menu')?.setAttribute('aria-expanded','false');
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

  // ── Acessibilidade & Temas ────────────────────────────────────────────────
  applyAccessibilitySettings() {
    try {
      const theme = localStorage.getItem('finobra_theme') || 'dark';
      const colorblind = localStorage.getItem('finobra_colorblind') || 'none';
      if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      if (colorblind && colorblind !== 'none') {
        document.documentElement.setAttribute('data-colorblind', colorblind);
      } else {
        document.documentElement.removeAttribute('data-colorblind');
      }
    } catch(e) {}
  },

  showAccessibilityModal() {
    const currentTheme = localStorage.getItem('finobra_theme') || 'dark';
    const currentColorblind = localStorage.getItem('finobra_colorblind') || 'none';
    
    Utils.showModal(`
      <div class="modal" style="max-width:520px;width:94vw;">
        <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;">
          <span class="modal-title" style="display:flex;align-items:center;gap:8px;">
            ${typeof FinObraUI !== 'undefined' ? FinObraUI.icon('acessibilidade') : '♿'}
            <span>Acessibilidade &amp; Tema Visual</span>
          </span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <div style="margin-bottom:20px;">
            <label style="display:block;font-size:.78rem;font-weight:700;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Aparência da Tela</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <button type="button" class="btn ${currentTheme !== 'light' ? 'btn-primary' : 'btn-secondary'}" data-fb-click="App.setTheme" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="dark" style="justify-content:center;gap:8px;font-size:.84rem;">
                Modo Escuro (Padrão)
              </button>
              <button type="button" class="btn ${currentTheme === 'light' ? 'btn-primary' : 'btn-secondary'}" data-fb-click="App.setTheme" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="light" style="justify-content:center;gap:8px;font-size:.84rem;">
                Tela Branca / Clara
              </button>
            </div>
          </div>

          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:.78rem;font-weight:700;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Modo para Daltonismo &amp; Contraste</label>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;cursor:pointer;">
                <input type="radio" name="cb-mode" value="none" ${currentColorblind === 'none' ? 'checked' : ''} data-fb-change="App.setColorblind" data-fb-change-n="1" data-fb-change-t0="string" data-fb-change-v0="none">
                <div>
                  <strong style="display:block;font-size:.84rem;">Padrão (Visão Tricromática Completa)</strong>
                  <span style="font-size:.72rem;color:var(--text3);">Cores originais da identidade FinGo.</span>
                </div>
              </label>
              <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;cursor:pointer;">
                <input type="radio" name="cb-mode" value="deuteranopia" ${currentColorblind === 'deuteranopia' ? 'checked' : ''} data-fb-change="App.setColorblind" data-fb-change-n="1" data-fb-change-t0="string" data-fb-change-v0="deuteranopia">
                <div>
                  <strong style="display:block;font-size:.84rem;">Deuteranopia / Protanopia (Verde / Vermelho)</strong>
                  <span style="font-size:.72rem;color:var(--text3);">Substitui verde e vermelho por Azul Céu e Âmbar seguros.</span>
                </div>
              </label>
              <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;cursor:pointer;">
                <input type="radio" name="cb-mode" value="tritanopia" ${currentColorblind === 'tritanopia' ? 'checked' : ''} data-fb-change="App.setColorblind" data-fb-change-n="1" data-fb-change-t0="string" data-fb-change-v0="tritanopia">
                <div>
                  <strong style="display:block;font-size:.84rem;">Tritanopia (Azul / Amarelo)</strong>
                  <span style="font-size:.72rem;color:var(--text3);">Ajuste seguro com Verde Esmeralda e Rosa Magenta.</span>
                </div>
              </label>
              <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;cursor:pointer;">
                <input type="radio" name="cb-mode" value="high-contrast" ${currentColorblind === 'high-contrast' ? 'checked' : ''} data-fb-change="App.setColorblind" data-fb-change-n="1" data-fb-change-t0="string" data-fb-change-v0="high-contrast">
                <div>
                  <strong style="display:block;font-size:.84rem;">Alto Contraste</strong>
                  <span style="font-size:.72rem;color:var(--text3);">Bordas brancas nítidas e contraste de 125%.</span>
                </div>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:flex-end;">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Fechar</button>
        </div>
      </div>
    `);
  },

  setTheme(theme) {
    try {
      localStorage.setItem('finobra_theme', theme);
    } catch(e) {}
    this.applyAccessibilitySettings();
    Utils.closeModal?.();
    this.showAccessibilityModal();
  },

  setColorblind(mode) {
    try {
      localStorage.setItem('finobra_colorblind', mode);
    } catch(e) {}
    this.applyAccessibilitySettings();
    Utils.closeModal?.();
    this.showAccessibilityModal();
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

window.addEventListener('DOMContentLoaded', () => App.init().catch(error => {
  console.error('[App] Falha na inicialização:', error);
  window.FinObraStartup?.fail();
}));
