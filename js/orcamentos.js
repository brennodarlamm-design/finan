// js/orcamentos.js — Módulo de Orçamentos Premium (Previsto × Realizado por Categorias & SINAPI)

const Orcamentos = {
  _activeTab: 'etapas',
  _filterObraId: null,
  _filterSearch: '',
  _filterStatus: 'todos',

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
    { id: 'cat-imprevistos', nome: '13. Administração e Imprevistos', icone: '🛡️', cor: '#ef4444' }
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
      orcs = orcs.filter(o => (o.status || 'ativo') === this._filterStatus);
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
      <div style="min-width:140px;">
        <select class="form-control" data-fb-change="Orcamentos._filterByStatus" data-fb-change-n="1" data-fb-change-t0="value">
          <option value="todos" ${this._filterStatus === 'todos' ? 'selected' : ''}>Todos os status</option>
          <option value="ativo" ${this._filterStatus === 'ativo' ? 'selected' : ''}>✓ Ativos</option>
          <option value="revisao" ${this._filterStatus === 'revisao' ? 'selected' : ''}>🔄 Em Revisão</option>
          <option value="concluido" ${this._filterStatus === 'concluido' ? 'selected' : ''}>🏆 Concluídos</option>
          <option value="cancelado" ${this._filterStatus === 'cancelado' ? 'selected' : ''}>✕ Cancelados</option>
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

    return `
    <div class="orc-budget-card" id="card-orc-${orc.id}">
      <div class="orc-card-top">
        <div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <h2 style="font-size:1.25rem;font-weight:800;color:var(--text);margin:0">${Utils.escapeHtml(orc.nome || orc.titulo || 'Orçamento')}</h2>
            ${Utils.badge(orc.status || 'ativo')}
          </div>
          <div style="font-size:.82rem;color:var(--text3);margin-top:6px;display:flex;gap:14px;flex-wrap:wrap;">
            <span>🏢 <strong>Obra:</strong> ${Utils.escapeHtml(cliente?.nome || cliente?.cliente || 'Geral / Não vinculada')}</span>
            <span>📅 <strong>Data:</strong> ${Utils.fmt.date(orc.data_criacao || orc.created_at)}</span>
            <span>📑 <strong>Itens:</strong> ${itens.length} etapa(s) em ${Object.keys(grouped).length} categoria(s)</span>
          </div>
          ${orc.descricao ? `<div style="font-size:.82rem;color:var(--text2);margin-top:6px;font-style:italic;">📝 ${Utils.escapeHtml(orc.descricao)}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
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
      map[id] = { id, nome: c.nome, icone: c.icone || '📁', cor: c.cor || 'var(--accent)', itens: [] };
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
          itens: []
        };
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
        <div class="orc-cat-hdr-left">
          <span style="font-size:1.1rem">${cat.icone}</span>
          <span style="color:var(--text)">${Utils.escapeHtml(cat.nome)}</span>
          <span style="font-size:.72rem;background:var(--surface);padding:2px 8px;border-radius:10px;border:1px solid var(--border);color:var(--text3)">
            ${cat.itens.length} item(ns)
          </span>
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
                <th style="width:32%">Item / Serviço</th>
                <th style="width:10%">Unid.</th>
                <th style="width:12%">Qtd × Unit.</th>
                <th style="width:14%">Previsto</th>
                <th style="width:14%">Realizado</th>
                <th style="width:12%">Avanço</th>
                <th style="width:6%"></th>
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
        this.CATEGORIAS_PADRAO[7]  // Revestimentos
      ];
    } else if (itens.length && !categorias.length) {
      // Reconstitui categorias a partir dos itens legados
      const seen = new Set();
      itens.forEach(it => {
        const cNome = it.categoria_nome || 'Etapas Gerais';
        if (!seen.has(cNome)) {
          seen.add(cNome);
          categorias.push({ id: it.categoria_id || DB.uuid(), nome: cNome, icone: '📋', cor: '#3b82f6' });
        }
      });
    }

    Utils.showModal(`
      <div class="modal modal-xl" style="max-width:980px;">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:1.4rem">📋</span>
            <div>
              <span class="modal-title" style="display:block">${id ? 'Editar Orçamento' : 'Novo Orçamento de Obra'}</span>
              <span style="font-size:.78rem;color:var(--text3)">Configure as macro-etapas, quantitativos e custos previstos</span>
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
                    <option value="ativo" ${(orc.status || 'ativo') === 'ativo' ? 'selected' : ''}>✓ Ativo / Em Execução</option>
                    <option value="revisao" ${orc.status === 'revisao' ? 'selected' : ''}>🔄 Em Revisão / Estudo</option>
                    <option value="concluido" ${orc.status === 'concluido' ? 'selected' : ''}>🏆 Concluído</option>
                    <option value="cancelado" ${orc.status === 'cancelado' ? 'selected' : ''}>✕ Cancelado</option>
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

    return `
    <div class="orc-cat-block" id="cb-${catId}" data-cat-id="${catId}" data-cat-nome="${Utils.escapeHtml(catNome)}" data-cat-icone="${catIcone}" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:16px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px;">
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

      <!-- ITENS DA CATEGORIA -->
      <div class="orc-cat-items-container" id="items-${catId}">
        ${itens.length
          ? itens.map(item => this._renderItemFormRow(catId, item)).join('')
          : this._renderItemFormRow(catId, { id: DB.uuid(), nome: '', quantidade: 1, valor_unitario: 0, valor_previsto: 0, valor_realizado: 0, percentual_execucao: 0, unidade: 'm²' })
        }
      </div>
    </div>`;
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
      <div class="form-row cols-3" style="margin-top:8px;padding-top:6px;border-top:1px dashed rgba(255,255,255,.06);gap:8px;">
        <div class="form-group" style="margin:0">
          <input class="form-control item-obs" value="${Utils.escapeHtml(item.observacoes || '')}" placeholder="Observações (especificação, fornecedor, etc.)" style="font-size:.76rem;height:30px">
        </div>
        <div class="form-group" style="margin:0;display:flex;gap:6px">
          <input type="date" class="form-control item-di" value="${Utils.escapeHtml(item.data_inicio || '')}" title="Início Previsto" style="font-size:.74rem;height:30px">
          <input type="date" class="form-control item-df" value="${Utils.escapeHtml(item.data_fim || '')}" title="Término Previsto" style="font-size:.74rem;height:30px">
        </div>
        <div class="form-group" style="margin:0;display:flex;align-items:center;gap:8px;">
          <span style="font-size:.72rem;color:var(--text3);white-space:nowrap">% Exec.:</span>
          <input type="range" class="item-pct-range" min="0" max="100" value="${pct}" style="flex:1;accent-color:var(--accent)" data-fb-input="Patch26Actions.orcamentosSyncNext" data-fb-input-n="1" data-fb-input-t0="self">
          <input type="number" min="0" max="100" class="form-control item-pct" value="${pct}" style="width:55px;height:30px;font-size:.74rem;padding:2px 4px;text-align:center" data-fb-input="Patch26Actions.orcamentosSyncPrev" data-fb-input-n="1" data-fb-input-t0="self">
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
    const status = statusSelect?.value || 'ativo';
    const dataCriacao = dataInput?.value || Utils.today();
    const descricao = descInput?.value.trim() || '';

    // Varre categorias e itens com garantia de DOM
    const catBlocks = document.querySelectorAll('.orc-cat-block');
    const categorias = [];
    const etapas = [];

    catBlocks.forEach(catEl => {
      const catId = catEl.dataset.catId || DB.uuid();
      const catNome = catEl.querySelector('.orc-cat-title-input')?.value.trim() || catEl.dataset.catNome || 'Categoria';
      const catIcone = catEl.dataset.catIcone || '📁';
      categorias.push({ id: catId, nome: catNome, icone: catIcone });

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
          observacoes: obs
        });
      });
    });

    if (!etapas.length) {
      Utils.toast('Adicione pelo menos um item com nome e valor ao orçamento.', 'warning');
      return;
    }

    const valorTotalPrevisto = etapas.reduce((s, e) => s + (Number(e.valor_previsto) || 0), 0);

    const orcPayload = {
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
      itens: etapas
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
          <div class="cat-title">${Utils.escapeHtml(cat.nome)}</div>
          <table>
            <thead>
              <tr>
                <th>Item / Descrição</th>
                <th style="width:60px">Unid.</th>
                <th class="num" style="width:70px">Qtd.</th>
                <th class="num" style="width:110px">Unitário</th>
                <th class="num" style="width:120px">Previsto (R$)</th>
                <th class="num" style="width:120px">Realizado (R$)</th>
                <th class="num" style="width:70px">% Exec.</th>
              </tr>
            </thead>
            <tbody>
              ${cat.itens.map(e => `
                <tr>
                  <td><strong>${Utils.escapeHtml(e.nome)}</strong> ${e.observacoes ? `<br><small style="color:#64748b">${Utils.escapeHtml(e.observacoes)}</small>` : ''}</td>
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
