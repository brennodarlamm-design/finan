// js/orcamentos.js — Módulo de Orçamentos Premium (Previsto × Realizado por Categorias & SINAPI)

const Orcamentos = {
  _activeTab: 'etapas',
  _filterObraId: null,
  _filterSearch: '',
  _filterStatus: 'todos',
  _stagedAnexos: [],

  // ── CATÁLOGO OFICIAL DE CATEGORIAS DA CONSTRUÇÃO CIVIL ──
  CATEGORIAS_PADRAO: [
    { id: 'cat-preliminares', nome: '1. Serviços Preliminares', icone: '📐', cor: '#3b82f6' },
    { id: 'cat-fundacoes', nome: '2. Fundações e Terraplenagem', icone: '🏗️', cor: '#f59e0b' },
    { id: 'cat-estrutura', nome: '3. Estrutura e Concreto', icone: '🏢', cor: '#10b981' },
    { id: 'cat-alvenaria', nome: '4. Alvenaria e Fechamentos', icone: '🧱', cor: '#8b5cf6' },
    { id: 'cat-cobertura', nome: '5. Cobertura e Telhado', icone: '🏠', cor: '#ec4899' },
    { id: 'cat-hidraulica', nome: '6. Instalações Hidrossanitárias', icone: '💧', cor: '#06b6d4' },
    { id: 'cat-eletrica', nome: '7. Instalações Elétricas e Dados', icone: '⚡', cor: '#eab308' },
    { id: 'cat-revestimentos', nome: '8. Revestimentos e Pisos', icone: '✨', cor: '#14b8a6' },
    { id: 'cat-esquadrias', nome: '9. Esquadrias e Vidraçaria', icone: '🚪', cor: '#6366f1' },
    { id: 'cat-pintura', nome: '10. Pintura e Texturas', icone: '🎨', cor: '#f97316' },
    { id: 'cat-loucas', nome: '11. Louças, Metais e Acessórios', icone: '🚰', cor: '#84cc16' },
    { id: 'cat-limpeza', nome: '12. Limpeza Final e Entrega', icone: '🧹', cor: '#64748b' },
    { id: 'cat-imprevistos', nome: '13. Administração e Imprevistos', icone: '🛡️', cor: '#ef4444' },
    { id: 'cat-governanca', nome: '14. Governança, Fiscalização & Gestão Técnica', icone: '⚖️', cor: '#c9a227' }
  ],

  UNIDADES_PADRAO: ['m²', 'm³', 'm', 'un', 'kg', 'vb', 'h', 'cj', 'sc', 'pt', 'gl', 'ton'],

  _injectStyles() {
    if (document.getElementById('orc-premium-styles')) return;
    const s = document.createElement('style');
    s.id = 'orc-premium-styles';
    s.textContent = `
      .orc-tab { padding: 12px 26px; border: none; background: transparent; color: var(--text3); font-family: inherit; font-size: .875rem; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color .2s, border-color .2s; }
      .orc-tab:hover { color: var(--text); }
      .orc-tab-active { color: var(--accent)!important; border-bottom-color: var(--accent)!important; }

      .orc-kpi-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 16px; display: flex; flex-direction: column; gap: 4px; box-shadow: var(--shadow-sm); transition: transform .2s, box-shadow .2s; }
      .orc-kpi-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
      .orc-kpi-title { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--text3); }
      .orc-kpi-val { font-size: 1.35rem; font-weight: 800; }

      .orc-budget-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); margin-bottom: 24px; box-shadow: var(--shadow-sm); overflow: hidden; transition: border-color .2s, box-shadow .2s; }
      .orc-budget-card:hover { border-color: rgba(201,162,39,.35); box-shadow: var(--shadow-md); }
      .orc-card-top { padding: 20px 24px; background: linear-gradient(180deg, rgba(255,255,255,.02) 0%, transparent 100%); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }

      .orc-cat-accordion { border: 1px solid var(--border); border-radius: var(--r-md); margin-bottom: 12px; background: var(--bg-secondary); overflow: hidden; transition: border-color .2s; }
      .orc-cat-accordion:hover { border-color: rgba(201,162,39,.3); }
      .orc-cat-hdr { padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; gap: 12px; }
      .orc-cat-hdr-left { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: .92rem; }
      .orc-cat-hdr-right { display: flex; align-items: center; gap: 14px; }
      .orc-cat-body { padding: 0 16px 16px; display: none; }
      .orc-cat-open .orc-cat-body { display: block; }
      .orc-cat-open .orc-cat-chevron { transform: rotate(180deg); }
      .orc-cat-chevron { transition: transform .25s ease; font-size: 12px; color: var(--text3); }

      .orc-item-row { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 12px; margin-bottom: 8px; position: relative; transition: border-color .2s; }
      .orc-item-row:hover { border-color: var(--accent); }

      .orc-modal-summary { background: linear-gradient(135deg, rgba(201,162,39,.1) 0%, rgba(201,162,39,.03) 100%); border: 1px solid rgba(201,162,39,.25); border-radius: var(--r-md); padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px; font-size: .85rem; flex-wrap: wrap; gap: 12px; }
      .orc-badge-pct { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 12px; font-size: .75rem; font-weight: 800; }
      .orc-badge-pct.green { background: rgba(16,185,129,.15); color: var(--success); }
      .orc-badge-pct.yellow { background: rgba(245,158,11,.15); color: #f59e0b; }
      .orc-badge-pct.blue { background: rgba(59,130,246,.15); color: #3b82f6; }
      .orc-badge-pct.red { background: rgba(239,68,68,.15); color: var(--danger); }
    `;
    document.head.appendChild(s);
  },

  render(obraId) {
    this._injectStyles();
    this._filterObraId = obraId || App.obraId || 'todas';
    return `
    <div>
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:24px;">
        <button id="tab-etapas" class="orc-tab${this._activeTab==='etapas'?' orc-tab-active':''}" data-fb-click="Orcamentos._switchTab" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="etapas" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(Utils.escapeHtml(this._filterObraId)))}">
          📊 Previsto × Realizado por Categorias
        </button>
        <button id="tab-sinapi" class="orc-tab${this._activeTab==='sinapi'?' orc-tab-active':''}" data-fb-click="Orcamentos._switchTab" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="sinapi" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(Utils.escapeHtml(this._filterObraId)))}">
          🏗️ Orçamentos SINAPI
        </button>
      </div>
      <div id="orc-tab-content">
        ${this._renderTab(this._activeTab, this._filterObraId)}
      </div>
    </div>`;
  },

  _switchTab(tab, obraId) {
    this._activeTab = tab;
    document.querySelectorAll('.orc-tab').forEach(el => el.classList.remove('orc-tab-active'));
    const tabEl = document.getElementById('tab-' + tab);
    if (tabEl) tabEl.classList.add('orc-tab-active');
    const content = document.getElementById('orc-tab-content');
    if (content) content.innerHTML = this._renderTab(tab, obraId);
  },

  _renderTab(tab, obraId) {
    if (tab === 'sinapi') {
      if (typeof OrcamentoSINAPI !== 'undefined' && OrcamentoSINAPI.render) {
        return OrcamentoSINAPI.render(obraId);
      }
      return `<div class="empty-state"><h3>Módulo SINAPI indisponível</h3></div>`;
    }
    return this._renderEtapas(obraId);
  },

  _renderEtapas(obraId) {
    const rawOrcs = DB.getAll('orcamentos') || [];
    const activeObra = this._filterObraId || obraId || App.obraId || 'todas';

    let orcs = activeObra === 'todas'
      ? rawOrcs
      : rawOrcs.filter(o => String(o.obra_id) === String(activeObra));

    // Filtros de busca e status
    if (this._filterSearch) {
      const q = this._filterSearch.toLowerCase();
      orcs = orcs.filter(o => (o.nome || o.titulo || '').toLowerCase().includes(q) || (o.descricao || '').toLowerCase().includes(q));
    }
    if (this._filterStatus && this._filterStatus !== 'todos') {
      orcs = orcs.filter(o => {
        const s = o.status || 'a_revisar';
        if (this._filterStatus === 'a_revisar') return s === 'a_revisar' || s === 'revisao';
        return s === this._filterStatus;
      });
    }

    // Totais globais
    const kpis = this._calcGlobalKpis(orcs);

    return `
    <div class="page-header" style="margin-bottom:20px;">
      <div>
        <h1 class="page-title">📊 Previsão Orçamentária & Etapas</h1>
        <p class="page-sub">Controle estruturado por macro-etapas, quantitativos e comparação Previsto × Realizado</p>
      </div>
      <div class="page-actions" style="display:flex;gap:10px;align-items:center;">
        <button class="btn btn-primary" data-fb-click="Orcamentos.showForm" data-fb-click-n="0">
          <span style="font-size:1.1rem;line-height:1">+</span> Novo Orçamento
        </button>
      </div>
    </div>

    <!-- CARDS DE KPIs GLOBAIS -->
    <div class="g4" style="margin-bottom:24px;">
      <div class="orc-kpi-card">
        <div class="orc-kpi-title">💰 Total Orçado Previsto</div>
        <div class="orc-kpi-val" style="color:var(--accent)">${Utils.fmt.currency(kpis.totalPrev)}</div>
        <div style="font-size:.74rem;color:var(--text3)">${orcs.length} orçamento(s) na seleção</div>
      </div>
      <div class="orc-kpi-card">
        <div class="orc-kpi-title">🔨 Total Realizado (Executado)</div>
        <div class="orc-kpi-val" style="color:${kpis.totalReal <= kpis.totalPrev ? 'var(--success)' : 'var(--danger)'}">
          ${Utils.fmt.currency(kpis.totalReal)}
        </div>
        <div style="font-size:.74rem;color:var(--text3)">Medido e lançado em campo</div>
      </div>
      <div class="orc-kpi-card">
        <div class="orc-kpi-title">⚖️ Saldo Restante / Variação</div>
        <div class="orc-kpi-val" style="color:${kpis.saldo >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${kpis.saldo < 0 ? '-' : ''}${Utils.fmt.currency(Math.abs(kpis.saldo))}
        </div>
        <div style="font-size:.74rem;color:${kpis.saldo >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${kpis.saldo >= 0 ? '✓ Dentro do previsto' : '⚠️ Excedeu o orçamento'}
        </div>
      </div>
      <div class="orc-kpi-card">
        <div class="orc-kpi-title">📈 Execução Financeira Média</div>
        <div class="orc-kpi-val" style="color:var(--accent2)">${kpis.pctGeral.toFixed(1)}%</div>
        <div class="progress-bar" style="height:6px;margin-top:4px;">
          <div class="progress-fill ${kpis.pctGeral < 40 ? 'blue' : kpis.pctGeral <= 90 ? 'yellow' : 'green'}" style="width:${Math.min(100, kpis.pctGeral)}%"></div>
        </div>
      </div>
    </div>

    <!-- BARRA DE FILTROS RÁPIDOS -->
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap;background:var(--surface);padding:14px 18px;border-radius:var(--r-md);border:1px solid var(--border)">
      <div style="flex:1;min-width:200px;">
        <input type="text" class="form-control" placeholder="🔍 Buscar por nome do orçamento ou etapa..." value="${Utils.escapeHtml(this._filterSearch)}" data-fb-input="Orcamentos._onSearch" data-fb-input-n="1" data-fb-input-t0="value">
      </div>
      <div style="min-width:180px;">
        <select class="form-control" data-fb-change="Orcamentos._filterByObra" data-fb-change-n="1" data-fb-change-t0="value">
          <option value="todas" ${activeObra === 'todas' ? 'selected' : ''}>🏢 Todas as Obras</option>
          ${(DB.getAll('clientes') || []).map(o => `<option value="${Utils.escapeHtml(o.id)}" ${String(activeObra) === String(o.id) ? 'selected' : ''}>${Utils.escapeHtml(o.nome || o.cliente || 'Sem nome')}</option>`).join('')}
        </select>
      </div>
      <div style="min-width:160px;">
        <select class="form-control" data-fb-change="Orcamentos._filterByStatus" data-fb-change-n="1" data-fb-change-t0="value">
          <option value="todos" ${this._filterStatus === 'todos' ? 'selected' : ''}>Todos os status</option>
          <option value="a_revisar" ${this._filterStatus === 'a_revisar' ? 'selected' : ''}>🟡 A Revisar</option>
          <option value="aprovado" ${this._filterStatus === 'aprovado' ? 'selected' : ''}>🟢 Aprovados</option>
          <option value="ativo" ${this._filterStatus === 'ativo' ? 'selected' : ''}>🔵 Em Execução / Ativos</option>
          <option value="concluido" ${this._filterStatus === 'concluido' ? 'selected' : ''}>🏆 Concluídos</option>
          <option value="cancelado" ${this._filterStatus === 'cancelado' ? 'selected' : ''}>🔴 Cancelados</option>
        </select>
      </div>
    </div>

    <!-- LISTAGEM DOS ORÇAMENTOS -->
    <div id="orc-list">
      ${orcs.length
        ? orcs.map(o => this._card(o)).join('')
        : `<div class="empty-state">
            <div style="font-size:3rem;margin-bottom:12px">📋</div>
            <h3>Nenhum orçamento encontrado</h3>
            <p style="max-width:440px;margin:0 auto 18px;color:var(--text3)">
              Crie um orçamento estruturado com macro-etapas (Fundações, Estrutura, Instalações, etc.) para acompanhar quantitativos e custos da obra.
            </p>
            <button class="btn btn-primary" data-fb-click="Orcamentos.showForm" data-fb-click-n="0">+ Criar Novo Orçamento</button>
          </div>`
      }
    </div>`;
  },

  _calcGlobalKpis(orcs) {
    let totalPrev = 0;
    let totalReal = 0;
    for (const o of orcs) {
      const itens = Array.isArray(o.etapas) ? o.etapas : (Array.isArray(o.itens) ? o.itens : []);
      totalPrev += itens.reduce((s, e) => s + (Number(e.valor_previsto) || 0), 0);
      totalReal += itens.reduce((s, e) => s + (Number(e.valor_realizado) || 0), 0);
    }
    const saldo = totalPrev - totalReal;
    const pctGeral = totalPrev > 0 ? (totalReal / totalPrev) * 100 : 0;
    return { totalPrev, totalReal, saldo, pctGeral };
  },

  _onSearch(query) {
    this._filterSearch = query;
    this._refresh();
  },

  _filterByObra(obraId) {
    this._filterObraId = obraId;
    if (obraId !== 'todas' && App.setObra) {
      App.setObra(obraId);
    }
    this._refresh();
  },

  _filterByStatus(status) {
    this._filterStatus = status;
    this._refresh();
  },

  // ── CARD DO ORÇAMENTO NO FEED ──
  _card(orc) {
    const cliente = DB.getById('clientes', orc.obra_id);
    const itens = Array.isArray(orc.etapas) ? orc.etapas : (Array.isArray(orc.itens) ? orc.itens : []);
    const totalPrev = itens.reduce((s, e) => s + (Number(e.valor_previsto) || 0), 0);
    const totalReal = itens.reduce((s, e) => s + (Number(e.valor_realizado) || 0), 0);
    const saldo = totalPrev - totalReal;
    const pctGeral = totalPrev > 0 ? Math.min(100, (totalReal / totalPrev) * 100) : 0;

    // Agrupamento por Categorias
    const grouped = this._groupItensByCategoria(orc, itens);

    // Contagem de documentos e anexos
    const docs = (typeof Documentos !== 'undefined' && Documentos.listar) ? Documentos.listar('orcamento', orc.id) : [];
    const anexosCount = Math.max(docs.length, (Array.isArray(orc.anexos) ? orc.anexos.length : 0));

    return `
    <div class="orc-budget-card" id="card-orc-${orc.id}">
      <div class="orc-card-top">
        <div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <h2 style="font-size:1.25rem;font-weight:800;color:var(--text);margin:0">${Utils.escapeHtml(orc.nome || orc.titulo || 'Orçamento')}</h2>
            ${Utils.badge(orc.status || 'a_revisar')}
            ${orc.despesas_geradas ? '<span class="badge" style="background:rgba(201,162,39,.18);color:var(--accent2);border:1px solid rgba(201,162,39,.4);font-weight:700;">💰 Despesas Geradas</span>' : ''}
          </div>
          <div style="font-size:.82rem;color:var(--text3);margin-top:6px;display:flex;gap:14px;flex-wrap:wrap;">
            <span>🏢 <strong>Obra:</strong> ${Utils.escapeHtml(cliente?.nome || cliente?.cliente || 'Geral / Não vinculada')}</span>
            <span>📅 <strong>Data:</strong> ${Utils.fmt.date(orc.data_criacao || orc.created_at)}</span>
            <span>📑 <strong>Itens:</strong> ${itens.length} etapa(s) em ${Object.keys(grouped).length} categoria(s)</span>
            <span>📎 <strong>Anexos:</strong> ${anexosCount} arquivo(s)</span>
          </div>
          ${orc.descricao ? `<div style="font-size:.82rem;color:var(--text2);margin-top:6px;font-style:italic;">📝 ${Utils.escapeHtml(orc.descricao)}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <!-- WORKFLOW DE STATUS & AÇÕES RÁPIDAS -->
          ${((orc.status || 'a_revisar') === 'a_revisar' || orc.status === 'revisao') ? `
            <button class="btn btn-success btn-sm" data-fb-click="Orcamentos.aprovar" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" title="Aprovar e autorizar este orçamento" style="font-weight:800;">
              ✓ Aprovar
            </button>
            <button class="btn btn-danger btn-sm" data-fb-click="Orcamentos.cancelar" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" title="Cancelar orçamento">
              ✕ Cancelar
            </button>
          ` : orc.status === 'aprovado' ? `
            <button class="btn btn-primary btn-sm" data-fb-click="Orcamentos.abrirModalGerarDespesa" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" title="Gerar lançamentos de despesa financeira na obra" style="font-weight:800;background:linear-gradient(135deg,#c9a227,#eab308);border:none;color:#000;">
              💰 Gerar Despesas
            </button>
            <button class="btn btn-secondary btn-sm" data-fb-click="Orcamentos.colocarEmRevisao" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" title="Colocar de volta em revisão">
              🔄 A Revisar
            </button>
            <button class="btn btn-danger btn-sm" data-fb-click="Orcamentos.cancelar" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" title="Cancelar orçamento">
              ✕ Cancelar
            </button>
          ` : orc.status === 'cancelado' ? `
            <button class="btn btn-secondary btn-sm" data-fb-click="Orcamentos.colocarEmRevisao" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" title="Reabrir orçamento para revisão">
              🔄 Reabrir p/ Revisão
            </button>
          ` : `
            <button class="btn btn-primary btn-sm" data-fb-click="Orcamentos.abrirModalGerarDespesa" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" title="Gerar despesas financeiras">
              💰 Gerar Despesas
            </button>
            <button class="btn btn-secondary btn-sm" data-fb-click="Orcamentos.colocarEmRevisao" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}">
              🔄 A Revisar
            </button>
          `}

          <span style="display:inline-block;width:1px;height:24px;background:var(--border);margin:0 2px;"></span>

          <button class="btn btn-secondary btn-sm" data-fb-click="Documentos.abrirModal" data-fb-click-n="3" data-fb-click-t0="string" data-fb-click-v0="orcamento" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(orc.id))}" data-fb-click-t2="string" data-fb-click-v2="${encodeURIComponent(String('Anexos — ' + (orc.nome || 'Orçamento')))}" title="Gerenciar Documentos e Anexos">
            📎 ${anexosCount > 0 ? `${anexosCount} anexo(s)` : 'Anexar'}
          </button>
          <button class="btn btn-secondary btn-sm" data-fb-click="Orcamentos.printOrcamento" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" title="Visualizar para Impressão">
            🖨️ Imprimir
          </button>
          <button class="btn btn-secondary btn-sm" data-fb-click="Orcamentos.showForm" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" title="Editar Orçamento">
            ✏️ Editar
          </button>
          <button class="icon-btn btn-sm" data-fb-click="Orcamentos.del" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" style="color:var(--danger)" title="Excluir Orçamento">
            🗑️
          </button>
        </div>
      </div>

      <!-- MINI-KPIS DO ORÇAMENTO -->
      <div style="padding:16px 24px;border-bottom:1px solid var(--border);background:var(--bg-secondary);">
        <div class="g4">
          <div style="text-align:center">
            <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);font-weight:700">Total Previsto</div>
            <div style="font-size:1.15rem;font-weight:900;color:var(--accent);margin-top:2px">${Utils.fmt.currency(totalPrev)}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);font-weight:700">Total Realizado</div>
            <div style="font-size:1.15rem;font-weight:900;color:${totalReal <= totalPrev ? 'var(--success)' : 'var(--danger)'};margin-top:2px">${Utils.fmt.currency(totalReal)}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);font-weight:700">Saldo Orçamentário</div>
            <div style="font-size:1.15rem;font-weight:900;color:${saldo >= 0 ? 'var(--success)' : 'var(--danger)'};margin-top:2px">
              ${saldo < 0 ? '-' : ''}${Utils.fmt.currency(Math.abs(saldo))}
            </div>
          </div>
          <div style="text-align:center">
            <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);font-weight:700">Avanço Físico / Custo</div>
            <div style="font-size:1.15rem;font-weight:900;color:var(--accent2);margin-top:2px">${pctGeral.toFixed(1)}%</div>
          </div>
        </div>
        <div class="progress-bar" style="height:6px;margin-top:12px;">
          <div class="progress-fill ${pctGeral < 40 ? 'blue' : pctGeral <= 90 ? 'yellow' : 'green'}" style="width:${pctGeral}%"></div>
        </div>
      </div>

      <!-- ACCORDION DE CATEGORIAS -->
      <div style="padding:20px 24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="font-size:.8rem;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">
            Categorias & Macro-Etapas
          </span>
          <button class="btn btn-link btn-sm" data-fb-click="Orcamentos._toggleAllCategories" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" style="font-size:.75rem;padding:0;">
            Expandir / Recolher Todas
          </button>
        </div>

        <div id="cats-container-${orc.id}">
          ${Object.values(grouped).map((cat, catIdx) => this._renderCategoryAccordion(orc, cat, catIdx === 0)).join('')}
        </div>
      </div>
    </div>`;
  },

  _groupItensByCategoria(orc, itens) {
    const map = {};
    const categoriasSalvas = Array.isArray(orc.categorias) ? orc.categorias : [];

    // Preenche categorias já registradas
    categoriasSalvas.forEach(c => {
      const id = c.id || c.nome;
      map[id] = {
        id,
        nome: c.nome,
        icone: c.icone || '📁',
        cor: c.cor || 'var(--accent)',
        fornecedor_id: c.fornecedor_id || '',
        fornecedor_nome: c.fornecedor_nome || '',
        itens: []
      };
    });

    // Agrupa itens
    itens.forEach(item => {
      const catKey = item.categoria_id || item.categoria_nome || 'outros';
      if (!map[catKey]) {
        const matchingPadrao = this.CATEGORIAS_PADRAO.find(cp => cp.id === catKey || cp.nome.toLowerCase() === String(item.categoria_nome || '').toLowerCase());
        map[catKey] = {
          id: catKey,
          nome: item.categoria_nome || matchingPadrao?.nome || (catKey === 'outros' ? 'Etapas Gerais' : catKey),
          icone: matchingPadrao?.icone || '📋',
          cor: matchingPadrao?.cor || 'var(--accent)',
          fornecedor_id: item.fornecedor_id || '',
          fornecedor_nome: item.fornecedor_nome || '',
          itens: []
        };
      }
      if (!map[catKey].fornecedor_nome && item.fornecedor_nome) {
        map[catKey].fornecedor_nome = item.fornecedor_nome;
        map[catKey].fornecedor_id = item.fornecedor_id || '';
      }
      map[catKey].itens.push(item);
    });

    return map;
  },

  _renderCategoryAccordion(orc, cat, openByDefault = false) {
    const subPrev = cat.itens.reduce((s, e) => s + (Number(e.valor_previsto) || 0), 0);
    const subReal = cat.itens.reduce((s, e) => s + (Number(e.valor_realizado) || 0), 0);
    const subVar = subReal - subPrev;
    const subPct = subPrev > 0 ? Math.min(100, Math.round((subReal / subPrev) * 100)) : 0;

    return `
    <div class="orc-cat-accordion ${openByDefault ? 'orc-cat-open' : ''}" id="cat-acc-${orc.id}-${cat.id}">
      <div class="orc-cat-hdr" data-fb-click="Orcamentos._toggleCategory" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(cat.id))}">
        <div class="orc-cat-hdr-left" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-size:1.1rem">${cat.icone}</span>
          <span style="color:var(--text);font-weight:700">${Utils.escapeHtml(cat.nome)}</span>
          <span style="font-size:.72rem;background:var(--surface);padding:2px 8px;border-radius:10px;border:1px solid var(--border);color:var(--text3)">
            ${cat.itens.length} item(ns)
          </span>
          ${cat.fornecedor_nome ? `
            <span style="font-size:.72rem;background:rgba(201,162,39,.12);color:var(--accent2);border:1px solid rgba(201,162,39,.3);padding:2px 8px;border-radius:12px;font-weight:700;">
              🏢 ${Utils.escapeHtml(cat.fornecedor_nome)}
            </span>
          ` : `
            <span style="font-size:.7rem;color:var(--text3);font-style:italic;">(Sem fornecedor definido)</span>
          `}
        </div>
        <div class="orc-cat-hdr-right">
          <div style="font-size:.8rem;font-weight:700">
            <span style="color:var(--accent)">${Utils.fmt.currency(subPrev)}</span>
            <span style="color:var(--text3);margin:0 4px">|</span>
            <span style="color:${subReal <= subPrev ? 'var(--success)' : 'var(--danger)'}">${Utils.fmt.currency(subReal)}</span>
          </div>
          <span class="orc-badge-pct ${subPct < 50 ? 'blue' : subPct <= 100 ? 'green' : 'red'}">${subPct}%</span>
          <span class="orc-cat-chevron">▼</span>
        </div>
      </div>

      <div class="orc-cat-body">
        <div class="tbl-wrap" style="border:none;margin-top:8px;">
          <table>
            <thead>
              <tr>
                <th style="width:26%">Item / Serviço</th>
                <th style="width:16%">Fornecedor</th>
                <th style="width:8%">Unid.</th>
                <th style="width:12%">Qtd × Unit.</th>
                <th style="width:13%">Previsto</th>
                <th style="width:13%">Realizado</th>
                <th style="width:8%">Avanço</th>
                <th style="width:4%"></th>
              </tr>
            </thead>
            <tbody>
              ${cat.itens.map(e => {
                const qtd = Number(e.quantidade) || 1;
                const unit = Number(e.valor_unitario) || 0;
                const prev = Number(e.valor_previsto) || 0;
                const real = Number(e.valor_realizado) || 0;
                const pct = Number(e.percentual_execucao) || (prev > 0 ? Math.min(100, Math.round((real / prev) * 100)) : 0);
                const cl = pct >= 100 ? 'green' : pct > 50 ? 'yellow' : 'blue';

                return `
                <tr>
                  <td>
                    <div style="font-weight:700;color:var(--text)">${Utils.escapeHtml(e.nome || 'Sem descrição')}</div>
                    ${e.observacoes ? `<div style="font-size:.72rem;color:var(--text3);margin-top:2px;">${Utils.escapeHtml(e.observacoes)}</div>` : ''}
                  </td>
                  <td>
                    <span style="font-size:.76rem;color:var(--text2);font-weight:600;">
                      ${Utils.escapeHtml(e.fornecedor_nome || cat.fornecedor_nome || '—')}
                    </span>
                  </td>
                  <td><span style="background:var(--bg-secondary);padding:2px 6px;border-radius:4px;font-size:.72rem;font-weight:700">${Utils.escapeHtml(e.unidade || 'un')}</span></td>
                  <td style="font-size:.8rem;color:var(--text2)">
                    ${qtd} × ${Utils.fmt.currency(unit)}
                  </td>
                  <td style="font-weight:700;color:var(--accent)">${Utils.fmt.currency(prev)}</td>
                  <td style="font-weight:700;color:${real <= prev ? 'var(--success)' : 'var(--danger)'}">
                    ${Utils.fmt.currency(real)}
                  </td>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px">
                      <div class="progress-bar" style="flex:1;height:5px;">
                        <div class="progress-fill ${cl}" style="width:${Math.min(100, pct)}%"></div>
                      </div>
                      <span style="font-size:.72rem;font-weight:800;min-width:30px;text-align:right">${pct}%</span>
                    </div>
                  </td>
                  <td>
                    <button class="icon-btn btn-sm" data-fb-click="Orcamentos.editEtapa" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(e.id))}" title="Ajustar Realizado / %">✏️</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  _toggleCategory(orcId, catId) {
    const el = document.getElementById(`cat-acc-${orcId}-${catId}`);
    if (el) el.classList.toggle('orc-cat-open');
  },

  _toggleAllCategories(orcId) {
    const container = document.getElementById(`cats-container-${orcId}`);
    if (!container) return;
    const accs = container.querySelectorAll('.orc-cat-accordion');
    const anyClosed = Array.from(accs).some(el => !el.classList.contains('orc-cat-open'));
    accs.forEach(el => {
      if (anyClosed) el.classList.add('orc-cat-open');
      else el.classList.remove('orc-cat-open');
    });
  },

  // ── FORMULÁRIO MODAL INTUITIVO (NOVO / EDITAR) ──
  showForm(id = null) {
    const orc = id ? (DB.getById('orcamentos', id) || {}) : {};
    const clientes = DB.getAll('clientes') || [];

    // Pre-seleção robusta da Obra
    let selectedObraId = orc.obra_id || '';
    if (!selectedObraId && this._filterObraId && this._filterObraId !== 'todas') {
      selectedObraId = this._filterObraId;
    }
    if (!selectedObraId && App.obraId && App.obraId !== 'todas') {
      selectedObraId = App.obraId;
    }

    // Categorias e Itens Existentes
    let categorias = Array.isArray(orc.categorias) && orc.categorias.length ? orc.categorias : [];
    let itens = Array.isArray(orc.etapas) ? orc.etapas : (Array.isArray(orc.itens) ? orc.itens : []);

    // Se for novo orçamento e sem categorias, inicia com categorias essenciais padrão
    if (!id && !categorias.length && !itens.length) {
      categorias = [
        this.CATEGORIAS_PADRAO[0], // Preliminares
        this.CATEGORIAS_PADRAO[1], // Fundações
        this.CATEGORIAS_PADRAO[2], // Estrutura
        this.CATEGORIAS_PADRAO[3], // Alvenaria
        this.CATEGORIAS_PADRAO[7], // Revestimentos
        this.CATEGORIAS_PADRAO[13] // Governança, Fiscalização & Gestão Técnica
      ];
    } else if (itens.length && !categorias.length) {
      // Reconstitui categorias a partir dos itens legados
      const seen = new Set();
      itens.forEach(it => {
        const cNome = it.categoria_nome || 'Etapas Gerais';
        if (!seen.has(cNome)) {
          seen.add(cNome);
          categorias.push({ id: it.categoria_id || DB.uuid(), nome: cNome, icone: '📋', cor: '#3b82f6', fornecedor_id: it.fornecedor_id || '', fornecedor_nome: it.fornecedor_nome || '' });
        }
      });
    }

    // Anexos vinculados / staged
    const existingDocs = id && typeof Documentos !== 'undefined' ? Documentos.listar('orcamento', id) : [];
    const savedAnexos = Array.isArray(orc.anexos) ? orc.anexos : [];
    const seenAnexos = new Set();
    this._stagedAnexos = [];

    existingDocs.forEach(d => {
      seenAnexos.add(d.id);
      this._stagedAnexos.push({
        id: d.id,
        nome: d.titulo || d.nome_arquivo || 'Documento',
        url: d.url || d.url_externa || '',
        url_externa: d.url_externa || '',
        tipo: d.tipo_mime || d.tipo_servico || 'arquivo',
        tamanho: d.tamanho || 0,
        isSaved: true
      });
    });

    savedAnexos.forEach(a => {
      if (!seenAnexos.has(a.id)) {
        seenAnexos.add(a.id);
        this._stagedAnexos.push({
          id: a.id || DB.uuid(),
          nome: a.nome || 'Anexo',
          url: a.url || '',
          url_externa: a.url_externa || (a.url && a.url.startsWith('http') ? a.url : ''),
          tipo: a.tipo || 'arquivo',
          tamanho: a.tamanho || 0,
          isSaved: true
        });
      }
    });

    Utils.showModal(`
      <div class="modal modal-xl" style="max-width:980px;">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:1.4rem">📋</span>
            <div>
              <span class="modal-title" style="display:block">${id ? 'Editar Orçamento' : 'Novo Orçamento de Obra'}</span>
              <span style="font-size:.78rem;color:var(--text3)">Configure as macro-etapas, fornecedores de cada etapa, quantitativos e custos</span>
            </div>
          </div>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>

        <div class="modal-body" style="max-height:calc(85vh - 120px);overflow-y:auto;padding:24px;">
          <form id="f-orc" data-fb-submit="Patch26Actions.prevent" data-fb-submit-n="1" data-fb-submit-t0="event">
            <!-- SEÇÃO 1: CABEÇALHO DO ORÇAMENTO -->
            <div style="background:var(--bg-secondary);padding:18px;border-radius:var(--r-md);border:1px solid var(--border);margin-bottom:20px;">
              <div class="form-row cols-3" style="margin-bottom:12px;">
                <div class="form-group">
                  <label class="form-label">Obra Vinculada *</label>
                  <select class="form-control" name="obra_id" id="orc-form-obra" required>
                    <option value="">Selecione uma obra...</option>
                    ${clientes.map(c => `
                      <option value="${Utils.escapeHtml(c.id)}" ${String(c.id) === String(selectedObraId) ? 'selected' : ''}>
                        🏢 ${Utils.escapeHtml(c.nome || c.cliente || 'Sem nome')}
                      </option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Título / Nome do Orçamento *</label>
                  <input class="form-control" name="nome" id="orc-form-nome" value="${Utils.escapeHtml(orc.nome || orc.titulo || '')}" required placeholder="Ex: Orçamento Inicial Completo">
                </div>
                <div class="form-group">
                  <label class="form-label">Status do Orçamento</label>
                  <select class="form-control" name="status" id="orc-form-status">
                    <option value="a_revisar" ${(orc.status || 'a_revisar') === 'a_revisar' || orc.status === 'revisao' ? 'selected' : ''}>🟡 A Revisar / Em Estudo</option>
                    <option value="aprovado" ${orc.status === 'aprovado' ? 'selected' : ''}>🟢 Aprovado / Autorizado</option>
                    <option value="ativo" ${orc.status === 'ativo' ? 'selected' : ''}>🔵 Em Execução / Ativo</option>
                    <option value="concluido" ${orc.status === 'concluido' ? 'selected' : ''}>🏆 Concluído</option>
                    <option value="cancelado" ${orc.status === 'cancelado' ? 'selected' : ''}>🔴 Cancelado</option>
                  </select>
                </div>
              </div>

              <div class="form-row cols-2">
                <div class="form-group">
                  <label class="form-label">Data de Referência / Criação</label>
                  <input class="form-control" type="date" name="data_criacao" id="orc-form-data" value="${Utils.escapeHtml(orc.data_criacao || Utils.today())}">
                </div>
                <div class="form-group">
                  <label class="form-label">Descrição / Observações Gerais</label>
                  <input class="form-control" name="descricao" id="orc-form-desc" value="${Utils.escapeHtml(orc.descricao || '')}" placeholder="Ex: Baseado no projeto executivo R02 e memorial descritivo">
                </div>
              </div>
            </div>

            <!-- SEÇÃO 1.5: ANEXOS & DOCUMENTOS DE APOIO -->
            <div style="background:var(--bg-secondary);padding:18px;border-radius:var(--r-md);border:1px solid var(--border);margin-bottom:20px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px;">
                <div>
                  <span style="font-size:1rem;font-weight:800;color:var(--text);display:inline-flex;align-items:center;gap:8px;">
                    📎 Anexos e Documentos de Apoio
                    <span id="orc-anexos-count" style="font-size:.72rem;background:var(--surface);padding:2px 8px;border-radius:10px;border:1px solid var(--border);color:var(--accent);font-weight:700;">
                      ${this._stagedAnexos.length} anexo(s)
                    </span>
                  </span>
                  <span style="font-size:.76rem;color:var(--text3);display:block">
                    Anexe memorial descritivo, projetos em PDF/DWG, planilhas orçamentárias ou links do Google Drive
                  </span>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                  <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin:0;font-size:.76rem;padding:6px 12px;display:inline-flex;align-items:center;gap:6px;">
                    📁 Anexar Arquivo
                    <input type="file" id="orc-file-input" multiple accept="image/*,application/pdf,.zip,.rar,.7z,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.csv,.txt" style="display:none;" data-fb-change="Orcamentos._onFileSelect" data-fb-change-n="1" data-fb-change-t0="self">
                  </label>
                  <button type="button" class="btn btn-secondary btn-sm" data-fb-click="Orcamentos._addLinkAttachment" data-fb-click-n="0" style="font-size:.76rem;padding:6px 12px;display:inline-flex;align-items:center;gap:6px;">
                    🔗 Link Google Drive / Nuvem
                  </button>
                </div>
              </div>

              <div id="orc-anexos-container">
                ${this._renderAnexosListHtml()}
              </div>
            </div>

            <!-- SEÇÃO 2: BARRA DE CATEGORIAS -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
              <div>
                <span style="font-size:1rem;font-weight:800;color:var(--text)">📑 Estrutura de Macro-Etapas & Categorias</span>
                <span style="font-size:.76rem;color:var(--text3);display:block">Adicione categorias pré-definidas da construção civil ou crie suas próprias categorias</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <!-- Seletor Rápido de Categorias Padrão -->
                <div style="position:relative;">
                  <select class="form-control btn-sm" id="sel-add-cat-padrao" data-fb-change="Orcamentos._onSelectAddPadrao" data-fb-change-n="1" data-fb-change-t0="self" style="cursor:pointer;font-weight:600">
                    <option value="">+ Adicionar Categoria Padrão...</option>
                    ${this.CATEGORIAS_PADRAO.map(cp => `<option value="${cp.id}">${cp.icone} ${cp.nome}</option>`).join('')}
                  </select>
                </div>
                <!-- Botão Categoria Customizada -->
                <button type="button" class="btn btn-secondary btn-sm" data-fb-click="Orcamentos._promptCustomCategory" data-fb-click-n="0">
                  ✨ Nova Categoria Personalizada
                </button>
              </div>
            </div>

            <!-- CONTAINER DINÂMICO DE CATEGORIAS -->
            <div id="orc-categories-container">
              ${categorias.map(cat => this._renderCategoryFormBlock(cat, itens.filter(it => it.categoria_id === cat.id || it.categoria_nome === cat.nome))).join('')}
            </div>

            <!-- BARRA FLUTUANTE DE RESUMO EM TEMPO REAL -->
            <div class="orc-modal-summary" id="orc-modal-summary-bar">
              <div>
                <span style="color:var(--text3);font-size:.75rem;text-transform:uppercase;font-weight:700">Total Previsto:</span>
                <strong id="m-tot-prev" style="font-size:1.15rem;color:var(--accent);margin-left:6px">R$ 0,00</strong>
              </div>
              <div>
                <span style="color:var(--text3);font-size:.75rem;text-transform:uppercase;font-weight:700">Total Realizado:</span>
                <strong id="m-tot-real" style="font-size:1.15rem;color:var(--success);margin-left:6px">R$ 0,00</strong>
              </div>
              <div>
                <span style="color:var(--text3);font-size:.75rem;text-transform:uppercase;font-weight:700">Saldo:</span>
                <strong id="m-tot-saldo" style="font-size:1.15rem;margin-left:6px">R$ 0,00</strong>
              </div>
              <div>
                <span style="color:var(--text3);font-size:.75rem;text-transform:uppercase;font-weight:700">Execução:</span>
                <span id="m-tot-pct" class="orc-badge-pct blue" style="margin-left:6px">0%</span>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer" style="padding:16px 24px;">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button class="btn btn-primary" data-fb-click="Orcamentos.save" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(id || ''))}">
            ${id ? '✔ Salvar Alterações' : '+ Criar Orçamento'}
          </button>
        </div>
      </div>`);

    // Atualiza cálculos do modal
    this._recalcModalTotals();
  },

  // Bloco de uma Categoria dentro do formulário
  _renderCategoryFormBlock(cat, itens = []) {
    const catId = cat.id || DB.uuid();
    const catNome = cat.nome || 'Nova Categoria';
    const catIcone = cat.icone || '📁';
    const fornecedores = DB.getAll('fornecedores') || [];
    const defaultFornId = cat.fornecedor_id || '';
    const defaultFornNome = cat.fornecedor_nome || '';

    return `
    <div class="orc-cat-block" id="cb-${catId}" data-cat-id="${catId}" data-cat-nome="${Utils.escapeHtml(catNome)}" data-cat-icone="${catIcone}" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:16px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:10px;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:1.2rem">${catIcone}</span>
          <input class="form-control orc-cat-title-input" value="${Utils.escapeHtml(catNome)}" style="font-weight:700;font-size:.92rem;border:none;background:transparent;padding:2px 6px;width:auto;min-width:240px" title="Clique para renomear">
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="cat-subtotal-badge" id="csb-${catId}" style="font-size:.8rem;font-weight:700;color:var(--accent)">
            R$ 0,00
          </span>
          <button type="button" class="btn btn-secondary btn-sm" data-fb-click="Orcamentos._addItemToCategory" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(catId))}" style="font-size:.76rem;padding:4px 10px;">
            + Adicionar Item
          </button>
          <button type="button" class="icon-btn btn-sm" data-fb-click="Orcamentos._removeCategory" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(catId))}" style="color:var(--danger)" title="Remover Categoria">
            🗑️
          </button>
        </div>
      </div>

      <!-- SELEÇÃO DE FORNECEDOR DA ETAPA -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;background:var(--surface);padding:8px 12px;border-radius:var(--r-sm);border:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:280px;">
          <span style="font-size:.78rem;font-weight:700;color:var(--text);white-space:nowrap;">🏢 Fornecedor / Empreiteiro:</span>
          <select class="form-control orc-cat-forn" data-cat-id="${catId}" data-fb-change="Orcamentos._onCatFornecedorChange" data-fb-change-n="1" data-fb-change-t0="self" style="font-size:.78rem;padding:4px 8px;height:32px;flex:1;">
            <option value="">Selecione o fornecedor padrão desta etapa...</option>
            ${fornecedores.map(f => {
              const fn = f.nome || f.razao_social || 'Sem nome';
              const isSel = (defaultFornId && String(defaultFornId) === String(f.id)) || (defaultFornNome && defaultFornNome === fn);
              return `<option value="${Utils.escapeHtml(f.id)}" data-nome="${Utils.escapeHtml(fn)}" ${isSel ? 'selected' : ''}>${Utils.escapeHtml(fn)}</option>`;
            }).join('')}
            <option value="__manual__" ${(!defaultFornId && defaultFornNome && !fornecedores.some(f => (f.nome||f.razao_social) === defaultFornNome)) ? 'selected' : ''}>✏️ Outro (digitar manualmente)...</option>
          </select>
          <input type="text" class="form-control orc-cat-forn-manual" data-cat-id="${catId}" value="${Utils.escapeHtml(defaultFornNome || '')}" placeholder="Digite o nome do fornecedor..." style="font-size:.78rem;padding:4px 8px;height:32px;max-width:220px;display:${(!defaultFornId && defaultFornNome && !fornecedores.some(f => (f.nome||f.razao_social) === defaultFornNome)) ? 'block' : 'none'};">
        </div>
        <div style="font-size:.72rem;color:var(--text3);font-style:italic;">
          (Vincula as despesas desta etapa ao fornecedor)
        </div>
      </div>

      <!-- ITENS DA CATEGORIA -->
      <div class="orc-cat-items-container" id="items-${catId}">
        ${itens.length
          ? itens.map(item => this._renderItemFormRow(catId, item)).join('')
          : this._renderItemFormRow(catId, { id: DB.uuid(), nome: '', quantidade: 1, valor_unitario: 0, valor_previsto: 0, valor_realizado: 0, percentual_execucao: 0, unidade: 'm²' })
        }
      </div>
    </div>`;
  },

  _onCatFornecedorChange(sel) {
    if (!sel) return;
    const catId = sel.dataset.catId;
    const block = document.getElementById(`cb-${catId}`);
    if (!block) return;
    const manualInput = block.querySelector('.orc-cat-forn-manual');
    if (manualInput) {
      if (sel.value === '__manual__') {
        manualInput.style.display = 'block';
        manualInput.focus();
      } else {
        manualInput.style.display = 'none';
      }
    }
  },

  // Linha de um Item/Etapa dentro do formulário
  _renderItemFormRow(catId, item = {}) {
    const itemId = item.id || DB.uuid();
    const qtd = item.quantidade !== undefined ? item.quantidade : 1;
    const unit = item.valor_unitario !== undefined ? item.valor_unitario : 0;
    const prev = item.valor_previsto !== undefined ? item.valor_previsto : (qtd * unit);
    const real = item.valor_realizado !== undefined ? item.valor_realizado : 0;
    const pct = item.percentual_execucao !== undefined ? item.percentual_execucao : 0;
    const und = item.unidade || 'm²';

    return `
    <div class="orc-item-row" id="row-${itemId}" data-item-id="${itemId}" data-cat-id="${catId}">
      <div class="form-row" style="grid-template-columns: 3fr 1fr 1fr 1.3fr 1.3fr 1fr 40px; gap:8px; align-items:flex-end;">
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:.7rem">Descrição do Item / Etapa *</label>
          <input class="form-control item-nome" value="${Utils.escapeHtml(item.nome || '')}" placeholder="Ex: Porcelanato 80x80cm retificado" required data-fb-input="Orcamentos._recalcModalTotals" data-fb-input-n="0">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:.7rem">Unidade</label>
          <select class="form-control item-unidade">
            ${this.UNIDADES_PADRAO.map(u => `<option value="${u}" ${u === und ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:.7rem">Qtd.</label>
          <input type="number" step="0.01" min="0" class="form-control item-qtd" value="${qtd}" data-fb-input="Orcamentos._calcItemRow" data-fb-input-n="1" data-fb-input-t0="string" data-fb-input-v0="${encodeURIComponent(String(itemId))}">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:.7rem">Unitário (R$)</label>
          <div class="input-prefix">
            <span class="input-pfx-txt">R$</span>
            <input type="number" step="0.01" min="0" class="form-control item-unit" value="${unit}" data-fb-input="Orcamentos._calcItemRow" data-fb-input-n="1" data-fb-input-t0="string" data-fb-input-v0="${encodeURIComponent(String(itemId))}">
          </div>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:.7rem">Total Previsto (R$)</label>
          <div class="input-prefix">
            <span class="input-pfx-txt">R$</span>
            <input type="number" step="0.01" min="0" class="form-control item-prev" value="${prev}" data-fb-input="Orcamentos._recalcModalTotals" data-fb-input-n="0">
          </div>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:.7rem">Realizado (R$)</label>
          <div class="input-prefix">
            <span class="input-pfx-txt">R$</span>
            <input type="number" step="0.01" min="0" class="form-control item-real" value="${real}" data-fb-input="Orcamentos._onRealizadoChange" data-fb-input-n="1" data-fb-input-t0="string" data-fb-input-v0="${encodeURIComponent(String(itemId))}">
          </div>
        </div>
        <div style="margin-bottom:4px">
          <button type="button" class="icon-btn btn-sm" style="color:var(--danger);font-size:16px" data-fb-click="Orcamentos._removeItemRow" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(itemId))}" title="Excluir item">✕</button>
        </div>
      </div>

      <!-- Detalhes complementares expansíveis (opcional) -->
      <div class="form-row" style="grid-template-columns: 2fr 1.5fr 1.5fr 1.2fr; margin-top:8px;padding-top:6px;border-top:1px dashed rgba(255,255,255,.06);gap:8px;align-items:center;">
        <div class="form-group" style="margin:0">
          <input class="form-control item-obs" value="${Utils.escapeHtml(item.observacoes || '')}" placeholder="Observações e especificações técnicas..." style="font-size:.76rem;height:30px">
        </div>
        <div class="form-group" style="margin:0">
          <input class="form-control item-forn-custom" value="${Utils.escapeHtml(item.fornecedor_nome || '')}" placeholder="Fornecedor do item (ou da etapa)" style="font-size:.76rem;height:30px" title="Fornecedor específico deste item (opcional)">
        </div>
        <div class="form-group" style="margin:0;display:flex;gap:4px">
          <input type="date" class="form-control item-di" value="${Utils.escapeHtml(item.data_inicio || '')}" title="Início Previsto" style="font-size:.72rem;height:30px">
          <input type="date" class="form-control item-df" value="${Utils.escapeHtml(item.data_fim || '')}" title="Término Previsto" style="font-size:.72rem;height:30px">
        </div>
        <div class="form-group" style="margin:0;display:flex;align-items:center;gap:6px;">
          <span style="font-size:.72rem;color:var(--text3);white-space:nowrap">%:</span>
          <input type="range" class="item-pct-range" min="0" max="100" value="${pct}" style="flex:1;accent-color:var(--accent)" data-fb-input="Patch26Actions.orcamentosSyncNext" data-fb-input-n="1" data-fb-input-t0="self">
          <input type="number" min="0" max="100" class="form-control item-pct" value="${pct}" style="width:48px;height:30px;font-size:.74rem;padding:2px 4px;text-align:center" data-fb-input="Patch26Actions.orcamentosSyncPrev" data-fb-input-n="1" data-fb-input-t0="self">
          <span style="font-size:.72rem;color:var(--text3)">%</span>
        </div>
      </div>
    </div>`;
  },

  // ── AÇÕES DE MANIPULAÇÃO DO FORMULÁRIO ──
  _onSelectAddPadrao(selectEl) {
    const catId = selectEl.value;
    if (!catId) return;
    const cat = this.CATEGORIAS_PADRAO.find(c => c.id === catId);
    if (cat) {
      this._addCategoryBlock({ ...cat, id: DB.uuid() });
    }
    selectEl.value = '';
  },

  _promptCustomCategory() {
    const onAdd = (nome) => {
      if (!nome || !nome.trim()) return;
      this._addCategoryBlock({
        id: DB.uuid(),
        nome: nome.trim(),
        icone: '✨',
        cor: 'var(--accent)'
      });
    };
    if (typeof Utils !== 'undefined' && typeof Utils.prompt === 'function') {
      Utils.prompt('Nome da Nova Categoria Personalizada:', onAdd, '', 'Ex: Esquadrias Especiais ou Paisagismo');
    } else {
      const nome = window.prompt('Nome da Nova Categoria Personalizada:');
      onAdd(nome);
    }
  },

  _addCategoryBlock(cat) {
    const cont = document.getElementById('orc-categories-container');
    if (!cont) return;
    cont.insertAdjacentHTML('beforeend', this._renderCategoryFormBlock(cat, []));
    this._recalcModalTotals();
  },

  _removeCategory(catId) {
    const el = document.getElementById(`cb-${catId}`);
    if (!el) return;
    const items = el.querySelectorAll('.orc-item-row');
    if (items.length > 1 || (items.length === 1 && el.querySelector('.item-nome')?.value.trim())) {
      Utils.confirm('Remover esta categoria e todos os seus itens?', () => {
        el.remove();
        this._recalcModalTotals();
      });
    } else {
      el.remove();
      this._recalcModalTotals();
    }
  },

  _addItemToCategory(catId) {
    const cont = document.getElementById(`items-${catId}`);
    if (!cont) return;
    const dummy = { id: DB.uuid(), nome: '', quantidade: 1, valor_unitario: 0, valor_previsto: 0, valor_realizado: 0, percentual_execucao: 0, unidade: 'm²' };
    cont.insertAdjacentHTML('beforeend', this._renderItemFormRow(catId, dummy));
    this._recalcModalTotals();
  },

  _removeItemRow(itemId) {
    const row = document.getElementById(`row-${itemId}`);
    if (row) {
      row.remove();
      this._recalcModalTotals();
    }
  },

  _calcItemRow(itemId) {
    const row = document.getElementById(`row-${itemId}`);
    if (!row) return;
    const qtd = parseFloat(row.querySelector('.item-qtd')?.value) || 0;
    const unit = parseFloat(row.querySelector('.item-unit')?.value) || 0;
    const prevInput = row.querySelector('.item-prev');
    if (prevInput) {
      prevInput.value = (qtd * unit).toFixed(2);
    }
    this._recalcModalTotals();
  },

  _onRealizadoChange(itemId) {
    const row = document.getElementById(`row-${itemId}`);
    if (!row) return;
    const prev = parseFloat(row.querySelector('.item-prev')?.value) || 0;
    const real = parseFloat(row.querySelector('.item-real')?.value) || 0;
    if (prev > 0) {
      const autoPct = Math.min(100, Math.round((real / prev) * 100));
      const range = row.querySelector('.item-pct-range');
      const num = row.querySelector('.item-pct');
      if (range) range.value = autoPct;
      if (num) num.value = autoPct;
    }
    this._recalcModalTotals();
  },

  _recalcModalTotals() {
    const rows = document.querySelectorAll('.orc-item-row');
    let totalPrev = 0;
    let totalReal = 0;

    // Subtotais por categoria
    const catBlocks = document.querySelectorAll('.orc-cat-block');
    catBlocks.forEach(catEl => {
      const catId = catEl.dataset.catId;
      let catPrev = 0;
      let catReal = 0;
      catEl.querySelectorAll('.orc-item-row').forEach(r => {
        const p = parseFloat(r.querySelector('.item-prev')?.value) || 0;
        const re = parseFloat(r.querySelector('.item-real')?.value) || 0;
        catPrev += p;
        catReal += re;
      });
      const badge = document.getElementById(`csb-${catId}`);
      if (badge) badge.textContent = Utils.fmt.currency(catPrev);
      totalPrev += catPrev;
      totalReal += catReal;
    });

    const saldo = totalPrev - totalReal;
    const pct = totalPrev > 0 ? (totalReal / totalPrev) * 100 : 0;

    const elPrev = document.getElementById('m-tot-prev');
    const elReal = document.getElementById('m-tot-real');
    const elSaldo = document.getElementById('m-tot-saldo');
    const elPct = document.getElementById('m-tot-pct');

    if (elPrev) elPrev.textContent = Utils.fmt.currency(totalPrev);
    if (elReal) elReal.textContent = Utils.fmt.currency(totalReal);
    if (elSaldo) {
      elSaldo.textContent = (saldo < 0 ? '-' : '') + Utils.fmt.currency(Math.abs(saldo));
      elSaldo.style.color = saldo >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    if (elPct) {
      elPct.textContent = pct.toFixed(1) + '%';
      elPct.className = `orc-badge-pct ${pct < 40 ? 'blue' : pct <= 90 ? 'yellow' : 'green'}`;
    }
  },

  // ── GERENCIAMENTO DE ANEXOS DO FORMULÁRIO ──
  _renderAnexosListHtml() {
    if (!this._stagedAnexos || !this._stagedAnexos.length) {
      return `
      <div style="text-align:center;padding:16px;border:1px dashed var(--border);border-radius:var(--r-md);background:var(--surface);color:var(--text3);font-size:.78rem;">
        Nenhum documento ou link anexado ainda ao orçamento. Você pode anexar arquivos locais ou links do Google Drive/OneDrive.
      </div>`;
    }

    return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:10px;">
      ${this._stagedAnexos.map((att, idx) => {
        const nome = String(att.nome || 'Documento').toLowerCase();
        const isPDF = att.tipo === 'application/pdf' || nome.endsWith('.pdf');
        const isZip = nome.match(/\.(zip|rar|7z|tar|gz)$/i);
        const isCAD = nome.match(/\.(dwg|dxf)$/i);
        const isImg = (att.tipo && att.tipo.startsWith('image/')) || nome.match(/\.(png|jpg|jpeg|webp|svg)$/i);
        const isLink = att.tipo === 'link' || att.tipo === 'gdrive' || !!att.url_externa;
        const icon = isLink ? '🔗' : isPDF ? '📕' : isZip ? '📦' : isCAD ? '📐' : isImg ? '🖼️' : '📎';

        let tamFmt = '';
        if (att.tamanho) {
          tamFmt = att.tamanho > 1024 * 1024
            ? `${(att.tamanho / (1024 * 1024)).toFixed(1)} MB`
            : `${(att.tamanho / 1024).toFixed(0)} KB`;
        } else if (isLink) {
          tamFmt = 'Nuvem / Link';
        }

        const safeUrl = att.url_externa || att.url;

        return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
            <span style="font-size:1.2rem;">${icon}</span>
            <div style="min-width:0;flex:1;">
              <div style="font-size:.82rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${Utils.escapeHtml(att.nome)}">
                ${Utils.escapeHtml(att.nome)}
              </div>
              <div style="font-size:.68rem;color:var(--text3);">
                ${tamFmt ? Utils.escapeHtml(tamFmt) : (att.isSaved ? 'Salvo' : 'Pronto p/ salvar')}
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            ${safeUrl ? `
              <a href="${Utils.safeUrl ? Utils.safeUrl(safeUrl) : Utils.escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:.7rem;text-decoration:none;" title="Abrir em nova aba">
                ↗
              </a>
            ` : ''}
            <button type="button" class="icon-btn btn-sm" style="color:var(--danger);font-size:13px;padding:2px 6px;" data-fb-click="Orcamentos._removeAttachment" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${idx}" title="Remover anexo">
              ✕
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  async _onFileSelect(inputEl) {
    if (!inputEl || !inputEl.files || !inputEl.files.length) return;
    const files = Array.from(inputEl.files);

    for (const file of files) {
      if (file.size > 30 * 1024 * 1024) {
        Utils.toast(`Arquivo "${file.name}" excede o limite de 30MB.`, 'warning');
        continue;
      }
      try {
        const base64 = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.onerror = err => rej(err);
          reader.readAsDataURL(file);
        });

        this._stagedAnexos.push({
          id: DB.uuid(),
          nome: file.name,
          tipo: file.type || 'application/octet-stream',
          tamanho: file.size,
          base64: base64,
          data: new Date().toISOString(),
          isSaved: false
        });
      } catch (err) {
        console.warn('[Orcamentos] Erro ao ler arquivo:', err);
      }
    }

    inputEl.value = '';
    this._refreshAnexosContainer();
  },

  _addLinkAttachment() {
    const onUrlProvided = (url) => {
      if (!url || !url.trim()) return;
      let trimmed = url.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        trimmed = 'https://' + trimmed;
      }
      const isDrive = trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com');
      const defTitle = isDrive ? 'Pasta/Arquivo no Google Drive' : 'Link Externo';

      const onTitleProvided = (tit) => {
        const finalTitle = tit && tit.trim() ? tit.trim() : defTitle;
        this._stagedAnexos.push({
          id: DB.uuid(),
          nome: finalTitle,
          url_externa: trimmed,
          url: trimmed,
          tipo: isDrive ? 'gdrive' : 'link',
          tamanho: 0,
          data: new Date().toISOString(),
          isSaved: false
        });
        this._refreshAnexosContainer();
        Utils.toast('Link vinculado!', 'success');
      };

      if (typeof Utils !== 'undefined' && typeof Utils.prompt === 'function') {
        Utils.prompt('Descrição ou título do link (opcional):', onTitleProvided, defTitle);
      } else {
        const tit = window.prompt('Descrição ou título do link (opcional):', defTitle);
        onTitleProvided(tit);
      }
    };

    if (typeof Utils !== 'undefined' && typeof Utils.prompt === 'function') {
      Utils.prompt('Cole o link do Google Drive, OneDrive ou Nuvem:', onUrlProvided, '', 'https://drive.google.com/drive/folders/...');
    } else {
      const url = window.prompt('Cole o link do Google Drive, OneDrive ou Nuvem:');
      onUrlProvided(url);
    }
  },

  _removeAttachment(idxStr) {
    const idx = parseInt(idxStr, 10);
    if (isNaN(idx) || idx < 0 || idx >= this._stagedAnexos.length) return;

    const target = this._stagedAnexos[idx];
    if (target.isSaved && target.id && typeof Documentos !== 'undefined') {
      Utils.confirm(`Deseja desvincular o anexo "${target.nome}"?`, () => {
        Documentos.remover(target.id);
        this._stagedAnexos.splice(idx, 1);
        this._refreshAnexosContainer();
        Utils.toast('Anexo removido!', 'info');
      });
    } else {
      this._stagedAnexos.splice(idx, 1);
      this._refreshAnexosContainer();
    }
  },

  _refreshAnexosContainer() {
    const cont = document.getElementById('orc-anexos-container');
    const badge = document.getElementById('orc-anexos-count');
    if (cont) cont.innerHTML = this._renderAnexosListHtml();
    if (badge) badge.textContent = `${this._stagedAnexos.length} anexo(s)`;
  },

  // ── SALVAMENTO RESILIENTE (NUNCA MAIS PERDE DADOS) ──
  save(id) {
    const obraSelect = document.getElementById('orc-form-obra');
    const nomeInput = document.getElementById('orc-form-nome');
    const statusSelect = document.getElementById('orc-form-status');
    const dataInput = document.getElementById('orc-form-data');
    const descInput = document.getElementById('orc-form-desc');

    if (!obraSelect || !obraSelect.value) {
      Utils.toast('Selecione a obra vinculada ao orçamento.', 'warning');
      obraSelect?.focus();
      return;
    }
    if (!nomeInput || !nomeInput.value.trim()) {
      Utils.toast('Informe o nome do orçamento.', 'warning');
      nomeInput?.focus();
      return;
    }

    const obraId = obraSelect.value;
    const nome = nomeInput.value.trim();
    const status = statusSelect?.value || (id ? 'ativo' : 'a_revisar');
    const dataCriacao = dataInput?.value || Utils.today();
    const descricao = descInput?.value.trim() || '';

    // Varre categorias e itens com garantia de DOM
    const catBlocks = document.querySelectorAll('.orc-cat-block');
    const categorias = [];
    const etapas = [];
    const fornecedores = DB.getAll('fornecedores') || [];

    catBlocks.forEach(catEl => {
      const catId = catEl.dataset.catId || DB.uuid();
      const catNome = catEl.querySelector('.orc-cat-title-input')?.value.trim() || catEl.dataset.catNome || 'Categoria';
      const catIcone = catEl.dataset.catIcone || '📁';

      const fornSel = catEl.querySelector('.orc-cat-forn');
      const fornManual = catEl.querySelector('.orc-cat-forn-manual');
      let catFornId = fornSel?.value || '';
      let catFornNome = '';
      if (catFornId === '__manual__') {
        catFornId = '';
        catFornNome = fornManual?.value.trim() || '';
      } else if (catFornId) {
        const found = fornecedores.find(f => String(f.id) === String(catFornId));
        catFornNome = found ? (found.nome || found.razao_social) : (fornSel.options[fornSel.selectedIndex]?.text || '');
      }

      categorias.push({
        id: catId,
        nome: catNome,
        icone: catIcone,
        fornecedor_id: catFornId,
        fornecedor_nome: catFornNome
      });

      const itemRows = catEl.querySelectorAll('.orc-item-row');
      itemRows.forEach(row => {
        const itemNome = row.querySelector('.item-nome')?.value.trim();
        if (!itemNome) return; // ignora linha vazia sem nome

        const itemId = row.dataset.itemId || DB.uuid();
        const und = row.querySelector('.item-unidade')?.value || 'm²';
        const qtd = parseFloat(row.querySelector('.item-qtd')?.value) || 1;
        const unit = parseFloat(row.querySelector('.item-unit')?.value) || 0;
        const prev = parseFloat(row.querySelector('.item-prev')?.value) || (qtd * unit);
        const real = parseFloat(row.querySelector('.item-real')?.value) || 0;
        const pct = parseFloat(row.querySelector('.item-pct')?.value) || (prev > 0 ? Math.min(100, Math.round((real / prev) * 100)) : 0);
        const di = row.querySelector('.item-di')?.value || '';
        const df = row.querySelector('.item-df')?.value || '';
        const obs = row.querySelector('.item-obs')?.value.trim() || '';
        const itemFornCustom = row.querySelector('.item-forn-custom')?.value.trim() || '';

        const itemFornNome = itemFornCustom || catFornNome;
        const itemFornId = itemFornCustom ? '' : catFornId;

        etapas.push({
          id: itemId,
          categoria_id: catId,
          categoria_nome: catNome,
          nome: itemNome,
          unidade: und,
          quantidade: qtd,
          valor_unitario: unit,
          valor_previsto: prev,
          valor_realizado: real,
          percentual_execucao: pct,
          data_inicio: di,
          data_fim: df,
          observacoes: obs,
          fornecedor_id: itemFornId,
          fornecedor_nome: itemFornNome
        });
      });
    });

    if (!etapas.length) {
      Utils.toast('Adicione pelo menos um item com nome e valor ao orçamento.', 'warning');
      return;
    }

    const valorTotalPrevisto = etapas.reduce((s, e) => s + (Number(e.valor_previsto) || 0), 0);
    const orcId = id || DB.uuid();

    // Salva anexos novos no módulo de Documentos
    if (Array.isArray(this._stagedAnexos) && typeof Documentos !== 'undefined') {
      for (const att of this._stagedAnexos) {
        if (!att.isSaved) {
          if (att.url_externa) {
            Documentos.adicionarLink({
              entidade_tipo: 'orcamento',
              entidade_id: orcId,
              titulo: att.nome,
              url: att.url_externa
            });
            att.isSaved = true;
          } else if (att.base64) {
            Documentos.adicionar({
              id: att.id,
              entidade_tipo: 'orcamento',
              entidade_id: orcId,
              titulo: att.nome,
              nome_arquivo: att.nome,
              tipo_mime: att.tipo,
              tamanho: att.tamanho,
              base64: att.base64
            });
            att.isSaved = true;
          }
        }
      }
    }

    const anexosSummary = (this._stagedAnexos || []).map(a => ({
      id: a.id,
      nome: a.nome,
      tipo: a.tipo,
      tamanho: a.tamanho,
      url: a.url_externa || a.url || null
    }));

    const orcPayload = {
      id: orcId,
      obra_id: obraId,
      nome: nome,
      titulo: nome,
      status: status,
      descricao: descricao,
      data_criacao: dataCriacao,
      valor_total: valorTotalPrevisto,
      valor_total_previsto: valorTotalPrevisto,
      categorias: categorias,
      etapas: etapas,
      itens: etapas,
      anexos: anexosSummary
    };

    if (id) {
      DB.update('orcamentos', id, orcPayload);
      Utils.toast('Orçamento atualizado com sucesso!', 'success');
    } else {
      const created = DB.add('orcamentos', orcPayload);
      Utils.toast('Orçamento criado com sucesso!', 'success');
    }

    Utils.closeModal();

    // GARANTE QUE O ORÇAMENTO APAREÇA NA TELA:
    // Se o usuário estiver filtrando por outra obra, ajusta o filtro para a obra do orçamento
    if (this._filterObraId !== 'todas' && String(this._filterObraId) !== String(obraId)) {
      this._filterObraId = obraId;
      if (App.setObra) App.setObra(obraId);
    }

    this._refresh();
  },

  // Edição rápida de item (Realizado & %)
  editEtapa(orcId, etapaId) {
    const orc = DB.getById('orcamentos', orcId);
    const itens = Array.isArray(orc?.etapas) ? orc.etapas : (Array.isArray(orc?.itens) ? orc.itens : []);
    const e = itens.find(it => String(it.id) === String(etapaId));
    if (!e) return;

    Utils.showModal(`
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <span class="modal-title">✏️ Atualizar Medição / Execução</span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body">
          <div style="font-weight:800;font-size:1.05rem;color:var(--text);margin-bottom:4px;">${Utils.escapeHtml(e.nome)}</div>
          <div style="font-size:.78rem;color:var(--text3);margin-bottom:16px;">
            ${e.categoria_nome ? `Categoria: ${Utils.escapeHtml(e.categoria_nome)} | ` : ''}
            Previsto Original: <strong>${Utils.fmt.currency(e.valor_previsto)}</strong>
          </div>

          <div class="form-row cols-2" style="margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label">Valor Previsto (R$)</label>
              <div class="input-prefix">
                <span class="input-pfx-txt">R$</span>
                <input id="ee-prev" type="number" step="0.01" min="0" class="form-control" value="${Utils.escapeHtml(e.valor_previsto)}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Valor Realizado (R$)</label>
              <div class="input-prefix">
                <span class="input-pfx-txt">R$</span>
                <input id="ee-real" type="number" step="0.01" min="0" class="form-control" value="${Utils.escapeHtml(e.valor_realizado)}" data-fb-input="Patch26Actions.orcamentosRealizadoInput" data-fb-input-n="1" data-fb-input-t0="self">
              </div>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">% de Execução Física</label>
            <div style="display:flex;align-items:center;gap:12px">
              <input type="range" id="ee-pct-range" min="0" max="100" value="${Utils.escapeHtml(e.percentual_execucao || 0)}" style="flex:1;accent-color:var(--accent)" data-fb-input="Patch26Actions.setValueByIdFromSelf" data-fb-input-n="2" data-fb-input-t0="string" data-fb-input-v0="ee-pct" data-fb-input-t1="self">
              <div class="input-prefix" style="width:85px">
                <input id="ee-pct" type="number" class="form-control" value="${Utils.escapeHtml(e.percentual_execucao || 0)}" min="0" max="100" data-fb-input="Patch26Actions.setValueByIdFromSelf" data-fb-input-n="2" data-fb-input-t0="string" data-fb-input-v0="ee-pct-range" data-fb-input-t1="self">
                <span class="input-pfx-txt">%</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Observações de Campo</label>
            <textarea class="form-control" id="ee-obs" rows="2" placeholder="Registro de medição ou desvio">${Utils.escapeHtml(e.observacoes || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button class="btn btn-primary" data-fb-click="Orcamentos.saveEtapa" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orcId))}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(etapaId))}">✔ Salvar Medição</button>
        </div>
      </div>`);
  },

  saveEtapa(orcId, etapaId) {
    const orc = DB.getById('orcamentos', orcId);
    if (!orc) return;
    const itens = Array.isArray(orc.etapas) ? orc.etapas : (Array.isArray(orc.itens) ? orc.itens : []);
    const idx = itens.findIndex(e => String(e.id) === String(etapaId));
    if (idx === -1) return;

    const prev = parseFloat(document.getElementById('ee-prev')?.value) || 0;
    const real = parseFloat(document.getElementById('ee-real')?.value) || 0;
    const pct = parseInt(document.getElementById('ee-pct')?.value) || 0;
    const obs = document.getElementById('ee-obs')?.value.trim() || '';

    itens[idx].valor_previsto = prev;
    itens[idx].valor_realizado = real;
    itens[idx].percentual_execucao = pct;
    itens[idx].observacoes = obs;

    const valorTotalPrevisto = itens.reduce((s, it) => s + (Number(it.valor_previsto) || 0), 0);

    DB.update('orcamentos', orcId, {
      etapas: itens,
      itens: itens,
      valor_total: valorTotalPrevisto,
      valor_total_previsto: valorTotalPrevisto
    });

    Utils.closeModal();
    this._refresh();
    Utils.toast('Item atualizado!', 'success');
  },

  // ── WORKFLOW DE STATUS (A REVISAR, APROVAR, CANCELAR) ──
  aprovar(id) {
    const orc = DB.getById('orcamentos', id);
    if (!orc) return;
    DB.update('orcamentos', id, {
      status: 'aprovado',
      data_aprovacao: Utils.today()
    });
    Utils.toast('Orçamento aprovado com sucesso! Agora você pode gerar as despesas financeiras.', 'success');
    this._refresh();
  },

  cancelar(id) {
    const orc = DB.getById('orcamentos', id);
    if (!orc) return;
    Utils.confirm(`Tem certeza que deseja cancelar o orçamento <strong>${Utils.escapeHtml(orc.nome || orc.titulo || '')}</strong>?`, () => {
      DB.update('orcamentos', id, {
        status: 'cancelado',
        data_cancelamento: Utils.today()
      });
      Utils.toast('Orçamento cancelado.', 'info');
      this._refresh();
    });
  },

  colocarEmRevisao(id) {
    const orc = DB.getById('orcamentos', id);
    if (!orc) return;
    DB.update('orcamentos', id, {
      status: 'a_revisar'
    });
    Utils.toast('Orçamento colocado em revisão.', 'info');
    this._refresh();
  },

  // ── GERAÇÃO DE DESPESAS FINANCEIRAS POR ETAPA / FORNECEDOR ──
  abrirModalGerarDespesa(id) {
    const orc = DB.getById('orcamentos', id);
    if (!orc) return;
    const cliente = DB.getById('clientes', orc.obra_id);
    const contas = DB.getAll('contas') || [];
    const fornecedores = DB.getAll('fornecedores') || [];
    const itens = Array.isArray(orc.etapas) ? orc.etapas : (Array.isArray(orc.itens) ? orc.itens : []);
    const grouped = this._groupItensByCategoria(orc, itens);
    const catList = Object.values(grouped);
    const safeId = encodeURIComponent(String(orc.id));

    Utils.showModal(`
      <div class="modal modal-lg" style="max-width:840px;width:95vw;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.4rem;">💰</span>
            <div>
              <span class="modal-title" style="display:block">Gerar Despesas Financeiras do Orçamento</span>
              <span style="font-size:.76rem;color:var(--text3)">Crie os lançamentos a pagar/pagos por etapa com seus respectivos fornecedores</span>
            </div>
          </div>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>

        <div class="modal-body" style="padding:20px;max-height:calc(85vh - 120px);overflow-y:auto;">
          <!-- RESUMO DO ORÇAMENTO -->
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:16px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
              <div>
                <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:var(--text);">${Utils.escapeHtml(orc.nome || orc.titulo || 'Orçamento')}</h3>
                <div style="font-size:.8rem;color:var(--text3);margin-top:4px;">
                  🏢 <strong>Obra:</strong> ${Utils.escapeHtml(cliente?.nome || cliente?.cliente || 'Obra Geral')} | 
                  📅 <strong>Data:</strong> ${Utils.fmt.date(orc.data_criacao || Utils.today())}
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:.7rem;text-transform:uppercase;color:var(--text3);font-weight:700">Total Previsto</div>
                <div style="font-size:1.3rem;font-weight:900;color:var(--accent)">${Utils.fmt.currency(orc.valor_total_previsto || orc.valor_total || 0)}</div>
              </div>
            </div>
          </div>

          <!-- PARÂMETROS GERAIS -->
          <div class="form-row cols-3" style="margin-bottom:18px;">
            <div class="form-group">
              <label class="form-label">Conta Bancária de Saída *</label>
              <select id="gen-desp-conta" class="form-control" required>
                <option value="">Selecione a conta bancária...</option>
                ${contas.map(ct => `<option value="${Utils.escapeHtml(ct.apelido || ct.banco_nome || 'Conta')}">${Utils.escapeHtml(ct.apelido || ct.banco_nome)} (${Utils.escapeHtml(ct.agencia || '—')}/${Utils.escapeHtml(ct.numero || '—')})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Data de Vencimento Inicial</label>
              <input type="date" id="gen-desp-vencimento" class="form-control" value="${Utils.today()}">
            </div>
            <div class="form-group">
              <label class="form-label">Status Inicial dos Lançamentos</label>
              <select id="gen-desp-status" class="form-control">
                <option value="a_pagar">⏳ A Pagar (Contas a Pagar)</option>
                <option value="pago">✓ Pago (Já Liquidado)</option>
              </select>
            </div>
          </div>

          <!-- SELEÇÃO DAS ETAPAS -->
          <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:.82rem;font-weight:800;color:var(--text);text-transform:uppercase;letter-spacing:.5px;">
              Macro-Etapas a Lançar (${catList.length})
            </span>
            <label style="font-size:.76rem;color:var(--accent);cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;margin:0;">
              <input type="checkbox" id="gen-desp-check-all" checked data-fb-change="Orcamentos._toggleSelectAllDespesas" data-fb-change-n="1" data-fb-change-t0="self">
              Selecionar Todas
            </label>
          </div>

          <div class="tbl-wrap" style="border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;">
            <table style="width:100%;margin:0;">
              <thead>
                <tr style="background:var(--bg-secondary);">
                  <th style="width:40px;text-align:center;">#</th>
                  <th style="width:28%">Macro-Etapa</th>
                  <th style="width:34%">Fornecedor da Despesa</th>
                  <th style="width:22%;text-align:right;">Valor da Despesa (R$)</th>
                </tr>
              </thead>
              <tbody id="gen-desp-tbody">
                ${catList.map((cat, idx) => {
                  const subPrev = cat.itens.reduce((s, e) => s + (Number(e.valor_previsto) || 0), 0);
                  const defaultFornId = cat.fornecedor_id || '';
                  const defaultFornNome = cat.fornecedor_nome || (cat.itens.find(i => i.fornecedor_nome)?.fornecedor_nome || '');

                  return `
                  <tr class="gen-desp-row" data-cat-id="${cat.id}">
                    <td style="text-align:center;">
                      <input type="checkbox" class="gen-desp-chk" checked data-idx="${idx}">
                    </td>
                    <td>
                      <div style="font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;">
                        <span>${cat.icone || '📋'}</span>
                        <span>${Utils.escapeHtml(cat.nome)}</span>
                      </div>
                      <div style="font-size:.72rem;color:var(--text3);">${cat.itens.length} item(ns) orçado(s)</div>
                    </td>
                    <td>
                      <select class="form-control gen-desp-forn" style="font-size:.78rem;padding:4px 8px;height:32px;">
                        <option value="">Selecione o fornecedor...</option>
                        ${fornecedores.map(f => {
                          const fn = f.nome || f.razao_social || 'Sem nome';
                          const isSel = (defaultFornId && String(defaultFornId) === String(f.id)) || (defaultFornNome && defaultFornNome === fn);
                          return `<option value="${Utils.escapeHtml(f.id)}" data-nome="${Utils.escapeHtml(fn)}" ${isSel ? 'selected' : ''}>${Utils.escapeHtml(fn)}</option>`;
                        }).join('')}
                        ${defaultFornNome && !fornecedores.some(f => (f.nome||f.razao_social) === defaultFornNome) ? `
                          <option value="__custom__" data-nome="${Utils.escapeHtml(defaultFornNome)}" selected>${Utils.escapeHtml(defaultFornNome)}</option>
                        ` : ''}
                      </select>
                    </td>
                    <td style="text-align:right;">
                      <div class="input-prefix" style="max-width:140px;margin-left:auto;">
                        <span class="input-pfx-txt" style="font-size:.75rem;">R$</span>
                        <input type="number" step="0.01" min="0" class="form-control gen-desp-val" value="${subPrev.toFixed(2)}" style="font-size:.8rem;height:32px;text-align:right;font-weight:700;">
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer" style="padding:14px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button class="btn btn-primary" data-fb-click="Orcamentos.confirmarGerarDespesaSubmit" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${safeId}" style="font-weight:800;background:linear-gradient(135deg,#c9a227,#eab308);border:none;color:#000;">
            ✓ Confirmar e Lançar Despesas
          </button>
        </div>
      </div>
    `);
  },

  _toggleSelectAllDespesas(chk) {
    const isChecked = !!chk?.checked;
    document.querySelectorAll('.gen-desp-chk').forEach(c => c.checked = isChecked);
  },

  confirmarGerarDespesaSubmit(id) {
    const orc = DB.getById('orcamentos', id);
    if (!orc) return;

    const contaBancaria = document.getElementById('gen-desp-conta')?.value || '';
    const vencimento = document.getElementById('gen-desp-vencimento')?.value || Utils.today();
    const statusLanc = document.getElementById('gen-desp-status')?.value || 'a_pagar';

    const fornecedores = DB.getAll('fornecedores') || [];
    const rows = document.querySelectorAll('.gen-desp-row');
    const lancamentosCriados = [];

    rows.forEach(row => {
      const chk = row.querySelector('.gen-desp-chk');
      if (!chk || !chk.checked) return;

      const catId = row.dataset.catId;
      const cat = (orc.categorias || []).find(c => c.id === catId) || {};
      const catNome = cat.nome || 'Etapa do Orçamento';

      const fornSel = row.querySelector('.gen-desp-forn');
      let fornId = fornSel?.value || '';
      let fornNome = '';

      if (fornId && fornId !== '__custom__') {
        const found = fornecedores.find(f => String(f.id) === String(fornId));
        fornNome = found ? (found.nome || found.razao_social) : (fornSel.options[fornSel.selectedIndex]?.text || '');
      } else if (fornSel && fornSel.selectedIndex >= 0) {
        fornNome = fornSel.options[fornSel.selectedIndex]?.dataset?.nome || fornSel.options[fornSel.selectedIndex]?.text || '';
        fornId = '';
      }

      const val = parseFloat(row.querySelector('.gen-desp-val')?.value) || 0;
      if (val <= 0) return;

      const novoLanc = DB.add('lancamentos', {
        obra_id: orc.obra_id,
        tipo: 'despesa',
        data: Utils.today(),
        data_vencimento: vencimento,
        descricao: `[Orçamento: ${orc.nome || orc.titulo || 'Obra'}] ${catNome}`,
        categoria: 'servico',
        categoria_obra: catNome,
        valor: val,
        status: statusLanc,
        fornecedor_beneficiario: fornNome || 'Fornecedor da Etapa',
        fornecedor_id: fornId || '',
        conta_bancaria: contaBancaria,
        observacoes: `Gerado a partir do Orçamento "${orc.nome || orc.titulo}" aprovado. Etapa: ${catNome}`,
        origem: 'orcamento',
        orcamento_id: orc.id,
        conciliado: false
      });

      lancamentosCriados.push(novoLanc.id);
    });

    if (!lancamentosCriados.length) {
      Utils.toast('Selecione pelo menos uma etapa com valor para gerar despesa.', 'warning');
      return;
    }

    DB.update('orcamentos', id, {
      despesas_geradas: true,
      despesas_geradas_em: new Date().toISOString(),
      despesas_lancamentos_ids: lancamentosCriados
    });

    Utils.closeModal();
    Utils.toast(`Sucesso! ${lancamentosCriados.length} lançamento(s) de despesa gerado(s) no Financeiro.`, 'success');
    this._refresh();
  },

  del(id) {
    Utils.confirm('Tem certeza que deseja excluir este orçamento permanentemente?', () => {
      DB.remove('orcamentos', id);
      this._refresh();
      Utils.toast('Orçamento excluído!', 'info');
    });
  },

  // ── VISUALIZAÇÃO PARA IMPRESSÃO / EXPORTAÇÃO ──
  printOrcamento(id) {
    const orc = DB.getById('orcamentos', id);
    if (!orc) return;
    const cliente = DB.getById('clientes', orc.obra_id);
    const itens = Array.isArray(orc.etapas) ? orc.etapas : (Array.isArray(orc.itens) ? orc.itens : []);
    const totalPrev = itens.reduce((s, e) => s + (Number(e.valor_previsto) || 0), 0);
    const totalReal = itens.reduce((s, e) => s + (Number(e.valor_realizado) || 0), 0);
    const saldo = totalPrev - totalReal;
    const grouped = this._groupItensByCategoria(orc, itens);
    const empresa = DB.getEmpresa ? DB.getEmpresa() : {};

    const win = window.open('', '_blank');
    if (!win) {
      Utils.toast('Permita pop-ups para imprimir o orçamento.', 'warning');
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Orçamento — ${Utils.escapeHtml(orc.nome || orc.titulo)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #1e293b; background: #fff; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 4px; }
          .sub { font-size: 13px; color: #64748b; }
          .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .kpi-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
          .kpi-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
          .kpi-val { font-size: 18px; font-weight: 800; margin-top: 4px; }
          .cat-title { font-size: 14px; font-weight: 800; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; margin: 16px 0 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
          th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
          th { font-weight: 700; color: #475569; background: #f8fafc; }
          .num { text-align: right; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 30px; font-size: 12px; }
          @media print { body { padding: 0; } button { display: none; } }
        </style>
      </head>
      <body>
        <div style="text-align:right;margin-bottom:12px;">
          <button data-fb-click="Patch26Actions.print" data-fb-click-n="0" style="padding:8px 16px;background:#0f172a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700">Imprimir / Salvar PDF</button>
        </div>
        <div class="header">
          <div>
            <h1 class="title">${Utils.escapeHtml(empresa.razao_social || empresa.nome_fantasia || 'FinObra Engenharia & Construções')}</h1>
            <div class="sub">CNPJ: ${Utils.escapeHtml(empresa.cnpj || '—')} | Resp.: ${Utils.escapeHtml(empresa.responsavel || '—')}</div>
          </div>
          <div style="text-align:right">
            <h2 class="title" style="color:#c9a227">${Utils.escapeHtml(orc.nome || orc.titulo)}</h2>
            <div class="sub">Obra: <strong>${Utils.escapeHtml(cliente?.nome || cliente?.cliente || 'Geral')}</strong> | Data: ${Utils.fmt.date(orc.data_criacao || orc.created_at)}</div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi-box"><div class="kpi-title">Previsto Total</div><div class="kpi-val" style="color:#0f172a">${Utils.fmt.currency(totalPrev)}</div></div>
          <div class="kpi-box"><div class="kpi-title">Realizado</div><div class="kpi-val" style="color:#10b981">${Utils.fmt.currency(totalReal)}</div></div>
          <div class="kpi-box"><div class="kpi-title">Saldo</div><div class="kpi-val" style="color:${saldo >= 0 ? '#10b981' : '#ef4444'}">${Utils.fmt.currency(saldo)}</div></div>
          <div class="kpi-box"><div class="kpi-title">Execução</div><div class="kpi-val" style="color:#3b82f6">${totalPrev > 0 ? ((totalReal / totalPrev) * 100).toFixed(1) : 0}%</div></div>
        </div>

        ${Object.values(grouped).map(cat => `
          <div class="cat-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>${Utils.escapeHtml(cat.nome)}</span>
            ${cat.fornecedor_nome ? `<span style="font-size:12px;font-weight:600;color:#64748b">Fornecedor: ${Utils.escapeHtml(cat.fornecedor_nome)}</span>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Item / Descrição</th>
                <th style="width:130px">Fornecedor</th>
                <th style="width:50px">Unid.</th>
                <th class="num" style="width:60px">Qtd.</th>
                <th class="num" style="width:90px">Unitário</th>
                <th class="num" style="width:110px">Previsto (R$)</th>
                <th class="num" style="width:110px">Realizado (R$)</th>
                <th class="num" style="width:60px">% Exec.</th>
              </tr>
            </thead>
            <tbody>
              ${cat.itens.map(e => `
                <tr>
                  <td><strong>${Utils.escapeHtml(e.nome)}</strong> ${e.observacoes ? `<br><small style="color:#64748b">${Utils.escapeHtml(e.observacoes)}</small>` : ''}</td>
                  <td>${Utils.escapeHtml(e.fornecedor_nome || cat.fornecedor_nome || '—')}</td>
                  <td>${Utils.escapeHtml(e.unidade || 'un')}</td>
                  <td class="num">${e.quantidade || 1}</td>
                  <td class="num">${Utils.fmt.currency(e.valor_unitario)}</td>
                  <td class="num" style="font-weight:700">${Utils.fmt.currency(e.valor_previsto)}</td>
                  <td class="num" style="font-weight:700;color:${Number(e.valor_realizado) <= Number(e.valor_previsto) ? '#10b981' : '#ef4444'}">${Utils.fmt.currency(e.valor_realizado)}</td>
                  <td class="num">${e.percentual_execucao || 0}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `).join('')}

        ${(() => {
          const docs = (typeof Documentos !== 'undefined' && Documentos.listar) ? Documentos.listar('orcamento', id) : [];
          const printAnexos = docs.length ? docs : (Array.isArray(orc.anexos) ? orc.anexos : []);
          if (!printAnexos.length) return '';
          return `
          <div class="cat-title" style="margin-top:24px;">📎 Documentos & Anexos Vinculados (${printAnexos.length})</div>
          <table>
            <thead>
              <tr>
                <th style="width:45%">Nome / Descrição</th>
                <th style="width:25%">Tipo / Formato</th>
                <th style="width:30%">Referência / Link</th>
              </tr>
            </thead>
            <tbody>
              ${printAnexos.map(a => `
                <tr>
                  <td><strong>${Utils.escapeHtml(a.titulo || a.nome_arquivo || a.nome || 'Documento')}</strong></td>
                  <td>${Utils.escapeHtml(a.tipo_servico || a.tipo_mime || a.tipo || 'Arquivo')}</td>
                  <td style="font-size:11px;color:#64748b">${Utils.escapeHtml(a.url_externa || a.url || a.nome_arquivo || 'Anexo interno')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>`;
        })()}

        <div class="footer">
          <div>Assinatura do Responsável Técnico</div>
          <div>Assinatura do Cliente / Proprietário</div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  },

  _refresh() {
    if (this._activeTab === 'sinapi') {
      if (typeof OrcamentoSINAPI !== 'undefined' && OrcamentoSINAPI._refresh) {
        OrcamentoSINAPI._refresh();
      }
      return;
    }
    const container = document.getElementById('orc-tab-content');
    if (container) {
      container.innerHTML = this._renderEtapas(this._filterObraId);
    }
  },

  init() {
    this._injectStyles();
  }
};
