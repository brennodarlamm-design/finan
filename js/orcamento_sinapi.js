// js/orcamento_sinapi.js — Módulo de Orçamentos SINAPI Nível Máximo
// Suporta: Catálogo e Editor de Alta Precisão (OrçaFascio/Volare), Busca Unificada COMP + INSUMO,
// Integração de 24 Bancos ("Períodos Utilizados"), Gerador de Propostas e Modelos Prontos.

const OrcamentoSINAPI = {

  BDI_PADRAO: 24.23,
  _currentEditor: null,
  _activeEtapaId: null,
  _filterSearch: '',
  _filterStatus: 'todas',
  _filterComProposta: false,
  _filterArquivados: false,
  _selectedOrcs: new Set(),
  _mostrarBdiItem: false,
  _filtroInsumos: true,
  _filtroComposicoes: true,

  _hasPlanAccess() {
    return typeof Cobranca === 'undefined' || Cobranca.isFeatureAllowed('sinapi');
  },

  calcularTotais(orc) {
    const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
    const bdi = Number(orc.bdi ?? this.BDI_PADRAO);
    let subtotal = 0, totalGeral = 0;
    for (const item of orc.itens || []) {
      const quantidade = Number(item.quantidade || 0), preco = Number(item.preco_unitario || 0);
      subtotal += round(quantidade * preco);
      totalGeral += round(quantidade * round(preco * (1 + bdi / 100)));
    }
    subtotal = round(subtotal); totalGeral = round(totalGeral);
    return { subtotal, bdi, valorBDI:round(totalGeral-subtotal), totalGeral };
  },

  _showInfo(message) {
    Utils.showModal(`<div class="modal" style="max-width:560px"><div class="modal-header"><span class="modal-title">Orçamento SINAPI</span><button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0" aria-label="Fechar">✕</button></div><div class="modal-body" style="white-space:pre-line">${Utils.escapeHtml(message)}</div></div>`);
  },

  showImportModal(desonerado = false, uf = '', referencia = '') {
    if (!this._ensurePlanAccess()) return;
    this._importEditor = this._currentEditor;
    const e = Utils.escapeHtml.bind(Utils);
    Utils.showModal(`<div class="modal" style="max-width:620px">
      <div class="modal-header"><span class="modal-title">Importar base SINAPI</span><button class="modal-close" aria-label="Fechar" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button></div>
      <div class="modal-body"><p>Selecione a planilha oficial de composições sintéticas ou analíticas, em XLSX ou ZIP. Informe a UF, a competência e a série do arquivo. A base ficará disponível neste navegador.</p>
        <form id="sinapi-import-form"><div class="form-row cols-2">
          <label class="form-group">UF<select id="imp-uf" class="form-control" required>${Utils.stateOptions(uf)}</select></label>
          <label class="form-group">Competência<input id="imp-ref" class="form-control" type="month" value="${e(referencia)}" required></label>
        </div><label class="form-group">Série<select id="imp-serie" class="form-control"><option value="false" ${!desonerado?'selected':''}>Onerado</option><option value="true" ${desonerado?'selected':''}>Desonerado</option></select></label>
        <label class="form-group">Arquivo oficial<input id="imp-file" class="form-control" type="file" accept=".xlsx,.xls,.zip" required></label></form>
        <p id="imp-progress-msg" role="status" aria-live="polite"></p>
      </div><div class="modal-footer"><button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button><button id="imp-run" class="btn btn-primary" data-fb-click="OrcamentoSINAPI.executarImport" data-fb-click-n="0">Importar base</button></div></div>`);
  },

  async executarImport() {
    if (!this._ensurePlanAccess() || this._importRunning) return;
    const form = document.getElementById('sinapi-import-form');
    if (!form?.reportValidity()) return;
    const file = document.getElementById('imp-file').files[0];
    if (!file) return;
    const uf = document.getElementById('imp-uf').value;
    const referencia = document.getElementById('imp-ref').value;
    const desonerado = document.getElementById('imp-serie').value === 'true';
    const button = document.getElementById('imp-run');
    const progress = document.getElementById('imp-progress-msg');
    this._importRunning = true;
    button.disabled = true;
    try {
      const result = await SINAPI.importar(file, desonerado, uf, referencia, message => { progress.textContent = message; });
      progress.textContent = result.msg;
      if (!result.ok) { Utils.toast(result.msg, 'error'); return; }
      Utils.toast(result.msg, 'success');
      const editor = this._getById(this._importEditor);
      if (editor) {
        editor.uf = uf; editor.referencia_sinapi = referencia; editor.desonerado = desonerado;
        if (editor.bancos_config) {
          editor.bancos_config.desonerado = desonerado;
          const bank = editor.bancos_config.bancos?.find(b => b.id === 'sinapi');
          if (bank) { bank.uf = uf; bank.ref = `${Number(referencia.slice(5))}/${referencia.slice(0,4)}`; bank.checked = true; }
        }
        this._save(editor);
        if (typeof OrcamentoBancos !== 'undefined') OrcamentoBancos._recalcularItensDoOrcamento(editor);
      }
      // Não substitui outro diálogo que o usuário tenha aberto durante o processamento.
      if (form.isConnected) { Utils.closeModal(); if (editor) this.openEditor(editor.id); }
    } catch (error) {
      progress.textContent = error.message || 'Não foi possível importar a base.';
      Utils.toast(progress.textContent, 'error');
    } finally { this._importRunning = false; button.disabled = false; }
  },

  _ensurePlanAccess() {
    if (this._hasPlanAccess()) return true;
    if (typeof Cobranca !== 'undefined') Cobranca.showLockedFeature('sinapi','SINAPI / Caixa','Importação de bases SINAPI, composições oficiais da Caixa e orçamentos referenciais estão disponíveis no plano Construtora Ilimitado.');
    return false;
  },

  _defaultUF(obraId='') {
    const id = obraId && obraId !== 'todas' ? obraId : ((typeof App !== 'undefined' && App.obraId !== 'todas') ? App.obraId : '');
    const obra = id ? DB.getById('clientes', id) : null;
    const emp = DB.getEmpresa ? DB.getEmpresa() : {};
    return String(obra?.estado || obra?.uf || emp?.uf || 'SP').trim().toUpperCase();
  },

  // ─────────────────────────────────────────────────
  // Render: Lista Principal de Orçamentos (Screenshot 5)
  // ─────────────────────────────────────────────────

  render(obraId) {
    if (!this._hasPlanAccess()) return Cobranca.renderLockedFeature('SINAPI / Caixa','Importação de bases SINAPI, composições oficiais da Caixa e orçamentos referenciais estão disponíveis no plano Construtora Ilimitado.');
    let orcs = this._getAll(obraId);
    const e = Utils.escapeHtml.bind(Utils);

    // Filtros de busca e status
    if (this._filterSearch) {
      const q = this._filterSearch.toLowerCase();
      orcs = orcs.filter(o => (o.nome || '').toLowerCase().includes(q) || (o.descricao || '').toLowerCase().includes(q));
    }
    if (this._filterStatus && this._filterStatus !== 'todas') {
      orcs = orcs.filter(o => o.status === this._filterStatus);
    }
    if (this._filterComProposta) {
      orcs = orcs.filter(o => !!o.proposta);
    }



    return `
    <div class="page-container" style="padding:0;">
      
      <!-- Topo: Título e Filtros Globais Modernos -->
      <div style="background:#181f14;color:#eef0ea;padding:16px 20px;border-radius:var(--r-md) var(--r-md) 0 0;border:1px solid #2d3824;border-bottom:none;">
        
        <!-- Linha 1: Título e Busca -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.4rem;">📊</span>
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <h2 style="font-weight:800;font-size:1.25rem;color:#f8fafc;margin:0;letter-spacing:-.02em;">Orçamentos</h2>
                <span style="background:rgba(18,217,160,0.15);color:#12D9A0;border:1px solid rgba(18,217,160,0.3);font-size:.72rem;font-weight:800;padding:2px 8px;border-radius:12px;">${orcs.length} cadastrado${orcs.length===1?'':'s'}</span>
              </div>
              <p style="font-size:.78rem;color:#94a3b8;margin:2px 0 0 0;">Gestão de orçamentos, composições unitárias e propostas comerciais</p>
            </div>
          </div>

          <!-- Barra de Busca com alto contraste -->
          <div style="display:flex;align-items:center;background:#0d120a;border:1.5px solid #313e27;border-radius:8px;overflow:hidden;min-width:280px;height:38px;box-shadow:inset 0 1px 2px rgba(0,0,0,0.4);">
            <span style="color:#12D9A0;font-size:.85rem;padding:0 12px;display:flex;align-items:center;gap:6px;font-weight:700;">
              🔍
            </span>
            <input
              type="text"
              style="background:transparent;border:none;color:#ffffff;padding:6px 12px 6px 0;font-size:.85rem;outline:none;width:100%;font-weight:500;"
              placeholder="Buscar por orçamento, cliente ou obra..."
              value="${e(this._filterSearch)}"
              data-fb-input="OrcamentoSINAPI._onSearchLista"
              data-fb-input-n="1"
              data-fb-input-t0="value"
            >
          </div>
        </div>

        <!-- Linha 2: Barra de Filtros In-Line Bem Identificados -->
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:10px;border-top:1px solid #252e1e;">
          
          <!-- Filtro de Obra -->
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <label style="font-size:.76rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Obra:</label>
            <select
              style="display:inline-block;width:auto;min-width:170px;max-width:240px;height:34px;padding:0 10px;font-size:.82rem;font-weight:600;background:#0d120a;color:#f1f5f9;border:1.5px solid #313e27;border-radius:6px;outline:none;cursor:pointer;"
              data-fb-change="OrcamentoSINAPI._onFilterObra"
              data-fb-change-n="1"
              data-fb-change-t0="value"
            >
              <option value="todas">🏢 Todas as Obras</option>
              ${(DB.getAll('clientes')||[]).map(c => `<option value="${c.id}">${e(c.nome||c.cliente)}</option>`).join('')}
            </select>
          </div>

          <!-- Filtro de Status -->
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <label style="font-size:.76rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Status:</label>
            <select
              style="display:inline-block;width:auto;min-width:160px;height:34px;padding:0 10px;font-size:.82rem;font-weight:600;background:#0d120a;color:#f1f5f9;border:1.5px solid #313e27;border-radius:6px;outline:none;cursor:pointer;"
              data-fb-change="OrcamentoSINAPI._onFilterStatus"
              data-fb-change-n="1"
              data-fb-change-t0="value"
            >
              <option value="todas">📊 Todos os Status</option>
              <option value="ativo" ${this._filterStatus==='ativo'?'selected':''}>🟢 Ativos</option>
              <option value="revisao" ${this._filterStatus==='revisao'?'selected':''}>🟡 Em Revisão</option>
              <option value="cancelado" ${this._filterStatus==='cancelado'?'selected':''}>🔴 Cancelados</option>
            </select>
          </div>

          <!-- Filtro de Etiqueta -->
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <label style="font-size:.76rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Tipo:</label>
            <select
              style="display:inline-block;width:auto;min-width:160px;height:34px;padding:0 10px;font-size:.82rem;font-weight:600;background:#0d120a;color:#f1f5f9;border:1.5px solid #313e27;border-radius:6px;outline:none;cursor:pointer;"
            >
              <option value="">🏷️ Todos os Tipos</option>
              <option value="residencial">🏠 Residencial</option>
              <option value="comercial">🏢 Comercial</option>
              <option value="industrial">🏭 Industrial</option>
              <option value="infra">🛣️ Infraestrutura</option>
            </select>
          </div>

          <!-- Filtro 'Com proposta' -->
          <button
            type="button"
            class="btn btn-sm"
            style="background:${this._filterComProposta?'#12D9A0':'#0d120a'};color:${this._filterComProposta?'#090C07':'#e2e8f0'};border:1.5px solid ${this._filterComProposta?'#12D9A0':'#313e27'};font-size:.8rem;font-weight:700;height:34px;padding:0 12px;display:inline-flex;align-items:center;gap:6px;border-radius:6px;cursor:pointer;"
            data-fb-click="OrcamentoSINAPI._toggleComProposta"
            data-fb-click-n="0"
          >
            📄 Com proposta
          </button>

          <!-- Filtro 'Arquivados' -->
          <button
            type="button"
            class="btn btn-sm"
            style="background:${this._filterArquivados?'#f59e0b':'#0d120a'};color:${this._filterArquivados?'#090C07':'#e2e8f0'};border:1.5px solid ${this._filterArquivados?'#f59e0b':'#313e27'};font-size:.8rem;font-weight:700;height:34px;padding:0 12px;display:inline-flex;align-items:center;gap:6px;border-radius:6px;cursor:pointer;"
            data-fb-click="OrcamentoSINAPI._toggleArquivados"
            data-fb-click-n="0"
          >
            📦 Arquivados
          </button>
        </div>
      </div>

      <!-- Barra de Ações: + NOVO, COPIAR, MODELOS PRONTOS, etc. -->
      <div style="background:#ffffff;border:1.5px solid #cbd5e1;border-top:none;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          
          <button
            type="button"
            class="btn btn-sm"
            style="font-weight:800;font-size:.82rem;background:#0284c7;color:#ffffff;border:1.5px solid #0284c7;padding:6px 14px;border-radius:6px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;"
            data-fb-click="OrcamentoSINAPI.showForm"
            data-fb-click-n="0"
          >
            <span style="font-size:1rem;line-height:1;">+</span> NOVO ORÇAMENTO
          </button>

          <button
            type="button"
            class="btn btn-sm"
            style="font-weight:700;font-size:.82rem;background:#f8fafc;color:#0f172a;border:1.5px solid #94a3b8;padding:6px 12px;border-radius:6px;cursor:pointer;"
            data-fb-click="OrcamentoSINAPI.copiarSelecionado"
            data-fb-click-n="0"
          >
            📑 COPIAR
          </button>

          <button
            type="button"
            class="btn btn-sm"
            style="font-weight:700;font-size:.82rem;background:#f8fafc;color:#0f172a;border:1.5px solid #94a3b8;padding:6px 12px;border-radius:6px;cursor:pointer;"
            data-fb-click="OrcamentoSINAPI.copiarParaModeloSelecionado"
            data-fb-click-n="0"
          >
            📋 COPIAR PARA MODELO
          </button>

          <!-- Botão de Modelos Prontos: Alto Destaque com contraste excelente -->
          <button
            type="button"
            class="btn btn-sm"
            style="font-weight:800;font-size:.82rem;background:#fffbeb;color:#92400e;border:1.5px solid #f59e0b;padding:6px 14px;border-radius:6px;box-shadow:0 1px 3px rgba(245,158,11,0.25);display:inline-flex;align-items:center;gap:6px;cursor:pointer;"
            data-fb-click="OrcamentoTemplates.abrirModalCatalogo"
            data-fb-click-n="0"
            title="Abrir biblioteca de modelos prontos (Casa 100m², MCMV, FNDE, etc.)"
          >
            ⭐ MODELOS PRONTOS (TEMPLATES)
          </button>

          <button
            type="button"
            class="btn btn-sm"
            style="font-weight:700;font-size:.82rem;background:#f8fafc;color:#334155;border:1.5px solid #94a3b8;padding:6px 12px;border-radius:6px;cursor:pointer;"
            data-fb-click="OrcamentoSINAPI.arquivarSelecionados"
            data-fb-click-n="0"
          >
            📦 ARQUIVAR
          </button>

          <button
            type="button"
            class="btn btn-sm"
            style="font-weight:700;font-size:.82rem;background:#fef2f2;color:#b91c1c;border:1.5px solid #f87171;padding:6px 12px;border-radius:6px;cursor:pointer;"
            data-fb-click="OrcamentoSINAPI.removerSelecionados"
            data-fb-click-n="0"
          >
            🗑️ REMOVER
          </button>
        </div>

        <button
          type="button"
          class="btn btn-sm"
          style="border-radius:50%;width:32px;height:32px;padding:0;display:flex;align-items:center;justify-content:center;font-weight:800;background:#f1f5f9;color:#0f172a;border:1.5px solid #94a3b8;cursor:pointer;"
          title="Ajuda sobre o módulo de orçamentos"
          data-fb-click="OrcamentoSINAPI.infoAjuda"
          data-fb-click-n="0"
        >
          ?
        </button>
      </div>

      <!-- Tabela Principal de Orçamentos com Alto Contraste -->
      <div style="background:#ffffff;border:1.5px solid #cbd5e1;border-top:none;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:.84rem;">
          <thead>
            <tr style="background:#0f172a;color:#ffffff;font-size:.76rem;text-transform:uppercase;letter-spacing:.6px;font-weight:800;border-bottom:2px solid #334155;">
              <th style="padding:12px 14px;width:34px;text-align:center;">
                <input type="checkbox" style="cursor:pointer;" data-fb-change="OrcamentoSINAPI._toggleSelectAll" data-fb-change-n="1" data-fb-change-t0="checked">
              </th>
              <th style="padding:12px 14px;text-align:left;">ORÇAMENTO</th>
              <th style="padding:12px 14px;text-align:center;width:90px;">USA IA</th>
              <th style="padding:12px 14px;text-align:left;width:170px;">PROPOSTA</th>
              <th style="padding:12px 14px;text-align:left;width:110px;">ETIQUETA</th>
              <th style="padding:12px 14px;text-align:left;">CLIENTE</th>
              <th style="padding:12px 14px;text-align:left;">NOME DO ORÇAMENTO</th>
              <th style="padding:12px 14px;text-align:left;">DESCRIÇÃO DA OBRA</th>
              <th style="padding:12px 14px;text-align:center;width:140px;">ALTERAÇÃO</th>
              <th style="padding:12px 14px;text-align:center;width:70px;">ITENS</th>
              <th style="padding:12px 14px;text-align:center;width:130px;">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            ${orcs.map((o, idx) => {
              const cliente = DB.getById('clientes', o.obra_id);
              const numOrc = o.numero || String(idx + 1).padStart(4, '0');
              const isChecked = this._selectedOrcs.has(o.id);
              return `
              <tr style="border-bottom:1px solid #e2e8f0;background:${isChecked?'#f0fdf4':(idx%2===0?'#ffffff':'#f8fafc')};transition:background .15s;">
                <td style="padding:12px 14px;text-align:center;">
                  <input type="checkbox" style="cursor:pointer;" ${isChecked?'checked':''} data-fb-change="OrcamentoSINAPI._toggleSelectRow" data-fb-change-n="2" data-fb-change-t0="string" data-fb-change-v0="${encodeURIComponent(o.id)}" data-fb-change-t1="checked">
                </td>
                <td style="padding:12px 14px;cursor:pointer;" data-fb-click="OrcamentoSINAPI.openEditor" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(o.id)}">
                  <span style="font-weight:800;color:#1d4ed8;font-size:.85rem;background:#eff6ff;padding:3px 8px;border-radius:5px;border:1px solid #bfdbfe;display:inline-block;">ORÇAMENTO ${numOrc}</span>
                </td>
                <td style="padding:12px 14px;text-align:center;">
                  <span style="background:${o.usa_ia?'#f0fdf4':'#f1f5f9'};color:${o.usa_ia?'#15803d':'#334155'};border:1px solid ${o.usa_ia?'#bbf7d0':'#cbd5e1'};font-weight:700;font-size:.75rem;padding:2px 8px;border-radius:4px;">${o.usa_ia ? 'Sim' : 'Não'}</span>
                </td>
                <td style="padding:12px 14px;">
                  ${o.proposta ? `
                    <button type="button" class="btn btn-link btn-sm" style="display:inline-flex;flex-direction:column;gap:1px;text-decoration:none;padding:2px 6px;text-align:left;cursor:pointer;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:5px;" data-fb-click="OrcamentoProposta.abrirModal" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(o.id)}">
                      <span style="font-weight:800;color:#065f46;font-size:.76rem;">📄 ${e(o.proposta.numero)}</span>
                      <span style="font-size:.72rem;color:#047857;font-weight:700;">${Utils.fmt.currency(o.proposta.valor || 0)}</span>
                      <span style="font-size:.68rem;color:#065f46;font-weight:600;">${e(o.proposta.data || '')}</span>
                    </button>
                  ` : `<span style="color:#64748b;font-weight:700;font-size:.8rem;background:#f1f5f9;padding:2px 8px;border-radius:4px;border:1px solid #e2e8f0;">—</span>`}
                </td>
                <td style="padding:12px 14px;color:#0f172a;font-weight:700;font-size:.82rem;">
                  ${e(o.etiqueta || '—')}
                </td>
                <td style="padding:12px 14px;color:#0f172a;font-weight:700;font-size:.85rem;">
                  ${e(cliente?.nome || cliente?.cliente || 'Cliente Padrão')}
                </td>
                <td style="padding:12px 14px;color:#0f172a;font-weight:800;font-size:.85rem;cursor:pointer;" data-fb-click="OrcamentoSINAPI.openEditor" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(o.id)}">
                  ${e(o.nome)}
                </td>
                <td style="padding:12px 14px;color:#1e293b;font-weight:600;font-size:.82rem;">
                  ${e(o.descricao || o.nome)}
                </td>
                <td style="padding:12px 14px;text-align:center;color:#1e293b;font-weight:700;font-size:.8rem;">
                  ${e(o.data_alteracao || Utils.fmt.date(o.data_criacao))}
                </td>
                <td style="padding:12px 14px;text-align:center;">
                  <span style="color:#0f172a;font-weight:800;font-size:.86rem;background:#f1f5f9;padding:2px 8px;border-radius:6px;border:1px solid #cbd5e1;">${(o.itens || []).length}</span>
                </td>
                <td style="padding:12px 14px;text-align:center;">
                  <div style="display:flex;gap:4px;justify-content:center;">
                    <button class="btn btn-sm" style="background:#eff6ff;color:#1d4ed8;border:1.5px solid #93c5fd;padding:3px 9px;font-size:.76rem;font-weight:800;border-radius:5px;cursor:pointer;" data-fb-click="OrcamentoSINAPI.openEditor" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(o.id)}">Abrir</button>
                    <button class="btn btn-sm" style="background:#f8fafc;color:#0f172a;border:1.5px solid #cbd5e1;font-size:12px;padding:3px 6px;border-radius:5px;cursor:pointer;" data-fb-click="OrcamentoSINAPI.showForm" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(o.id)}" title="Editar dados">✏️</button>
                    <button class="btn btn-sm" style="background:#fef2f2;color:#b91c1c;border:1.5px solid #fca5a5;font-size:12px;padding:3px 6px;border-radius:5px;cursor:pointer;" data-fb-click="OrcamentoSINAPI.del" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(o.id)}" title="Excluir">🗑️</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}

            ${!orcs.length ? `
              <tr>
                <td colspan="11" style="text-align:center;padding:48px 20px;color:#1e293b;">
                  <div style="font-size:2.5rem;margin-bottom:8px;">📋</div>
                  <h3 style="color:#0f172a;font-weight:800;margin-bottom:6px;">Nenhum orçamento encontrado</h3>
                  <p style="font-size:.85rem;color:#334155;max-width:400px;margin:0 auto 16px;font-weight:500;">
                    Crie um novo orçamento ou utilize nossos templates pré-prontos do SINAPI.
                  </p>
                  <button class="btn btn-primary" data-fb-click="OrcamentoSINAPI.showForm" data-fb-click-n="0">+ Novo Orçamento</button>
                  <button class="btn btn-secondary" style="margin-left:8px;" data-fb-click="OrcamentoTemplates.abrirModalCatalogo" data-fb-click-n="0">⭐ Modelos Prontos</button>
                </td>
              </tr>
            ` : ''}
          </tbody>
        </table>

        <!-- Paginação Inferior com Alto Contraste -->
        <div style="padding:12px 20px;display:flex;align-items:center;justify-content:space-between;background:#f1f5f9;border-top:1.5px solid #cbd5e1;font-size:.82rem;color:#0f172a;font-weight:700;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="color:#334155;font-weight:700;">Mostrar</span>
            <select style="display:inline-block;width:65px;height:32px;padding:2px 8px;font-size:.82rem;font-weight:800;color:#0f172a;background:#ffffff;border:1.5px solid #94a3b8;border-radius:6px;">
              <option value="25" selected>25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span style="color:#334155;font-weight:700;">registros</span>
          </div>

          <div style="display:flex;align-items:center;gap:14px;">
            <span style="color:#0f172a;font-weight:800;">1 até ${orcs.length} de ${orcs.length} itens</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm" style="background:#ffffff;color:#475569;border:1.5px solid #cbd5e1;font-size:.76rem;font-weight:700;padding:3px 12px;border-radius:5px;" disabled>Anterior</button>
              <button class="btn btn-sm" style="background:#ffffff;color:#475569;border:1.5px solid #cbd5e1;font-size:.76rem;font-weight:700;padding:3px 12px;border-radius:5px;" disabled>Próximo</button>
            </div>
          </div>
        </div>

      </div>

    </div>`;
  },

  _onSearchLista(q) {
    this._filterSearch = q;
    this._refresh();
  },

  _onFilterObra(obraId) {
    App.obraId = obraId;
    this._refresh();
  },

  _onFilterStatus(status) {
    this._filterStatus = status;
    this._refresh();
  },

  _toggleComProposta() {
    this._filterComProposta = !this._filterComProposta;
    this._refresh();
  },

  _toggleArquivados() {
    this._filterArquivados = !this._filterArquivados;
    this._refresh();
  },

  _toggleSelectRow(id, chk) {
    if (chk) this._selectedOrcs.add(id);
    else this._selectedOrcs.delete(id);
    this._refresh();
  },

  _toggleSelectAll(chk) {
    const orcs = this._getAll();
    if (chk) {
      orcs.forEach(o => this._selectedOrcs.add(o.id));
    } else {
      this._selectedOrcs.clear();
    }
    this._refresh();
  },

  copiarSelecionado() {
    if (this._selectedOrcs.size === 0) {
      Utils.toast('Selecione um orçamento para copiar.', 'warning');
      return;
    }
    const id = Array.from(this._selectedOrcs)[0];
    const orc = this._getById(id);
    if (!orc) return;

    const novoId = DB.uuid();
    const todos = this._getAll();
    const proximoNum = String(todos.length + 1).padStart(4, '0');

    const copia = {
      ...JSON.parse(JSON.stringify(orc)),
      id: novoId,
      numero: proximoNum,
      nome: `${orc.nome} (Cópia)`,
      data_criacao: Utils.today(),
      data_alteracao: new Date().toLocaleString('pt-BR'),
      proposta: null
    };

    this._add(copia);
    this._selectedOrcs.clear();
    this._selectedOrcs.add(novoId);
    this._refresh();
    Utils.toast(`Orçamento copiado com sucesso como ORÇAMENTO ${proximoNum}!`, 'success');
  },

  copiarParaModeloSelecionado() {
    if (this._selectedOrcs.size === 0) {
      Utils.toast('Selecione um orçamento para transformar em modelo.', 'warning');
      return;
    }
    const id = Array.from(this._selectedOrcs)[0];
    OrcamentoTemplates.copiarOrcamentoParaModelo(id);
  },

  removerSelecionados() {
    if (this._selectedOrcs.size === 0) {
      Utils.toast('Selecione ao menos um orçamento para remover.', 'warning');
      return;
    }
    Utils.confirm(`Deseja excluir ${this._selectedOrcs.size} orçamento(s) selecionado(s)?`, () => {
      this._selectedOrcs.forEach(id => this._remove(id));
      this._selectedOrcs.clear();
      this._refresh();
      Utils.toast('Orçamento(s) excluído(s).', 'info');
    });
  },

  arquivarSelecionados() {
    if (this._selectedOrcs.size === 0) {
      Utils.toast('Selecione orçamentos para arquivar.', 'warning');
      return;
    }
    this._selectedOrcs.forEach(id => {
      const orc = this._getById(id);
      if (orc) {
        orc.status = 'cancelado';
        this._save(orc);
      }
    });
    this._selectedOrcs.clear();
    this._refresh();
    Utils.toast('Orçamentos arquivados!', 'success');
  },

  // ─────────────────────────────────────────────────
  // Editor de Orçamento de Alta Precisão (Screenshot 3 & 4)
  // ─────────────────────────────────────────────────

  openEditor(id) {
    if (!this._ensurePlanAccess()) return;
    this._currentEditor = id;
    const orc = this._getById(id);
    if (!orc) return;

    const cliente = DB.getById('clientes', orc.obra_id) || {};
    const e = Utils.escapeHtml.bind(Utils);
    const numOrc = orc.numero || '0001';

    Utils.showModal(`
      <div class="modal modal-xl" id="sinapi-editor" style="max-width:1200px;width:98vw;max-height:94vh;display:flex;flex-direction:column;padding:0;overflow:hidden;border-radius:var(--r-lg);">
        
        <!-- BARRA 1: Título e Ações Superiores (Screenshot 3) -->
        <div style="background:#23272d;color:#fff;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #333840;gap:12px;flex-wrap:wrap;">
          
          <!-- Título Editável -->
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:800;font-size:1.1rem;color:#f8fafc;letter-spacing:.2px;">
              ${numOrc} - ${e(orc.nome)}
            </span>
            <button
              class="icon-btn btn-sm"
              style="color:#cbd5e1;font-size:12px;"
              title="Renomear orçamento"
              data-fb-click="OrcamentoSINAPI.renomearRapido"
              data-fb-click-n="1"
              data-fb-click-t0="string"
              data-fb-click-v0="${encodeURIComponent(orc.id)}"
            >
              ✏️
            </button>
          </div>

          <!-- Ações: Ferramentas, Exibir, Relatório XLS, Proposta PDF, Importar Planilha -->
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            
            <button class="btn btn-secondary btn-sm" style="font-size:.78rem;background:#333842;color:#fff;border-color:#454d59;" data-fb-click="OrcamentoSINAPI.menuFerramentas" data-fb-click-n="0">
              🛠️ Ferramentas ▾
            </button>

            <button class="btn btn-secondary btn-sm" style="font-size:.78rem;background:#333842;color:#fff;border-color:#454d59;" disabled aria-disabled="true" title="Recurso ainda não disponível" data-fb-click="OrcamentoSINAPI.toggleAnalitico" data-fb-click-n="0">
              👁️ Exibir ▾
            </button>

            <button class="btn btn-secondary btn-sm" style="font-size:.78rem;background:#333842;color:#fff;border-color:#454d59;" data-fb-click="OrcamentoSINAPI.exportExcel" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(orc.id)}" title="Gerar relatório Excel formatado">
              📊 Gerar relatório (XLS)
            </button>

            <button class="btn btn-secondary btn-sm" style="font-size:.78rem;background:#333842;color:#fff;border-color:#454d59;" data-fb-click="OrcamentoProposta.abrirModal" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(orc.id)}" title="Gerar proposta comercial para o cliente">
              📄 Gerar proposta (PDF)
            </button>

            <button class="btn btn-secondary btn-sm" style="font-size:.78rem;background:#333842;color:#fff;border-color:#454d59;" data-fb-click="OrcamentoSINAPI.showImportModal" data-fb-click-n="3" data-fb-click-t0="bool" data-fb-click-v0="${!!orc.desonerado}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(orc.uf||'')}" data-fb-click-t2="string" data-fb-click-v2="${encodeURIComponent(orc.referencia_sinapi||'')}" title="Importar planilha Caixa">
              📥 Importar Planilha
            </button>

            <button class="modal-close" style="color:#aaa;background:transparent;border:none;font-size:1.3rem;cursor:pointer;margin-left:6px;" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
          </div>

        </div>

        <!-- BARRA 2: Indicadores Paramétricos (BDI, Desconto, Encargos, Período) (Screenshot 3) -->
        <div style="background:#f1f5f9;border-bottom:1px solid #e2e8f0;padding:10px 20px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;font-size:.82rem;">
          
          <!-- BDI ✏️ -->
          <div style="display:flex;align-items:center;gap:6px;cursor:pointer;" data-fb-click="OrcamentoSINAPI.editarParametro" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(orc.id)}" data-fb-click-t1="string" data-fb-click-v1="bdi">
            <span style="font-weight:700;color:#64748b;">BDI</span>
            <span style="font-size:12px;">✏️</span>
            <span style="font-weight:800;color:#0f172a;">${Number(orc.bdi || 0).toFixed(3)}%</span>
          </div>

          <!-- DESCONTO / ACRÉSCIMO ✏️ -->
          <div style="display:flex;align-items:center;gap:6px;cursor:pointer;" data-fb-click="OrcamentoSINAPI.editarParametro" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(orc.id)}" data-fb-click-t1="string" data-fb-click-v1="desconto">
            <span style="font-weight:700;color:#64748b;">DESCONTO / ACRÉSCIMO</span>
            <span style="font-size:12px;">✏️</span>
            <span style="font-weight:800;color:#0f172a;">${Number(orc.desconto || 0).toFixed(2)}%</span>
          </div>

          <!-- ENCARGOS SOCIAIS ✏️ -->
          <div style="display:flex;align-items:center;gap:6px;cursor:pointer;" data-fb-click="OrcamentoSINAPI.editarParametro" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(orc.id)}" data-fb-click-t1="string" data-fb-click-v1="encargos">
            <span style="font-weight:700;color:#64748b;">ENCARGOS SOCIAIS</span>
            <span style="font-size:12px;">✏️</span>
            <span style="font-weight:800;color:#0f172a;">${e(orc.encargos_sociais || '-')}</span>
          </div>

          <!-- PERÍODO ✏️ (Abre Períodos Utilizados) -->
          <div
            style="display:flex;align-items:center;gap:6px;cursor:pointer;background:#fff;padding:4px 10px;border-radius:4px;border:1px solid #cbd5e1;margin-left:auto;"
            data-fb-click="OrcamentoBancos.abrirModal"
            data-fb-click-n="1"
            data-fb-click-t0="string"
            data-fb-click-v0="${encodeURIComponent(orc.id)}"
            title="Clique para gerenciar bancos, estados e competências ativas"
          >
            <span style="font-weight:700;color:#64748b;">PERÍODO</span>
            <span style="font-size:12px;">✏️</span>
            <span style="font-weight:800;color:#2563eb;font-size:.78rem;">
              ${OrcamentoBancos.getResumoAtivo(orc)}
            </span>
          </div>

        </div>

        <!-- BARRA 3: Ações de Etapa (+ Incluir etapa, + Incluir item, Ajustar itens, Filtrar, Remover) -->
        <div style="background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          
          <button
            type="button"
            class="btn btn-primary btn-sm"
            style="font-weight:700;font-size:.8rem;background:#0284c7;border-color:#0284c7;"
            data-fb-click="OrcamentoSINAPI.incluirEtapa"
            data-fb-click-n="1"
            data-fb-click-t0="string"
            data-fb-click-v0="${encodeURIComponent(orc.id)}"
          >
            📁 Incluir etapa
          </button>

          <button
            type="button"
            class="btn btn-primary btn-sm"
            style="font-weight:700;font-size:.8rem;background:#0284c7;border-color:#0284c7;"
            data-fb-click="OrcamentoSINAPI.focarBusca"
            data-fb-click-n="0"
          >
            + Incluir item
          </button>

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            style="font-weight:600;font-size:.8rem;"
            title="Ajustar as quantidades dos itens visíveis por percentual" data-fb-click="OrcamentoSINAPI.ajustarItens"
            data-fb-click-n="1"
            data-fb-click-t0="string"
            data-fb-click-v0="${encodeURIComponent(orc.id)}"
          >
            ⚙️ Ajustar quantidades
          </button>

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            style="font-weight:600;font-size:.8rem;"
            title="Filtrar itens por código, descrição, banco ou etapa" data-fb-click="OrcamentoSINAPI.filtroGrid"
            data-fb-click-n="0"
          >
            🔍 Filtrar
          </button>

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            style="font-weight:600;font-size:.8rem;color:#ef4444;"
            data-fb-click="OrcamentoSINAPI.removerItensVazios"
            data-fb-click-n="1"
            data-fb-click-t0="string"
            data-fb-click-v0="${encodeURIComponent(orc.id)}"
          >
            🗑️ Remover
          </button>

        </div>

        <!-- BARRA 4: Quick-Add Inline com Autocomplete Flutuante (Screenshot 3 e 4) -->
        <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:12px 20px;position:relative;">
          
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
            
            <!-- Ícone de Engrenagem -->
            <button
              class="icon-btn"
              style="color:#64748b;font-size:1.1rem;padding:4px;"
              title="Configurações de busca rápida"
              data-fb-click="OrcamentoBancos.abrirModal"
              data-fb-click-n="1"
              data-fb-click-t0="string"
              data-fb-click-v0="${encodeURIComponent(orc.id)}"
            >
              ⚙️
            </button>

            <!-- Campo Input com Autocomplete -->
            <div style="position:relative;flex:1;min-width:320px;">
              <input
                type="text"
                id="sinapi-quick-add-input"
                class="form-control"
                style="height:38px;padding-left:36px;border-radius:6px;font-size:.875rem;border:1.5px solid #cbd5e1;background:#fff;"
                placeholder="+ Código ou descrição — Enter adiciona no orçamento"
                autocomplete="off"
                data-fb-input="OrcamentoSINAPI._onQuickSearchInput"
                data-fb-input-n="2"
                data-fb-input-t0="string"
                data-fb-input-v0="${encodeURIComponent(orc.id)}"
                data-fb-input-t1="value"
                data-fb-keydown="OrcamentoSINAPI._onQuickSearchKeyDown"
                data-fb-keydown-n="2"
                data-fb-keydown-t0="event"
                data-fb-keydown-t1="string"
                data-fb-keydown-v1="${encodeURIComponent(orc.id)}"
              >
              <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#0284c7;font-weight:800;font-size:1.1rem;">+</span>
            </div>

            <!-- Checkboxes Insumos e Composições -->
            <div style="display:flex;align-items:center;gap:14px;">
              <label style="display:flex;align-items:center;gap:6px;font-size:.85rem;font-weight:700;color:#1e293b;cursor:pointer;">
                <input
                  type="checkbox"
                  id="chk-filtro-insumos"
                  style="accent-color:#2563eb;width:16px;height:16px;cursor:pointer;"
                  ${this._filtroInsumos ? 'checked' : ''}
                  data-fb-change="OrcamentoSINAPI._toggleFiltroInsumos"
                  data-fb-change-n="2"
                  data-fb-change-t0="checked"
                  data-fb-change-t1="string"
                  data-fb-change-v1="${encodeURIComponent(orc.id)}"
                >
                Insumos
              </label>

              <label style="display:flex;align-items:center;gap:6px;font-size:.85rem;font-weight:700;color:#1e293b;cursor:pointer;">
                <input
                  type="checkbox"
                  id="chk-filtro-composicoes"
                  style="accent-color:#2563eb;width:16px;height:16px;cursor:pointer;"
                  ${this._filtroComposicoes ? 'checked' : ''}
                  data-fb-change="OrcamentoSINAPI._toggleFiltroComposicoes"
                  data-fb-change-n="2"
                  data-fb-change-t0="checked"
                  data-fb-change-t1="string"
                  data-fb-change-v1="${encodeURIComponent(orc.id)}"
                >
                Composições
              </label>
            </div>

            <!-- Switch 'Mostrar o BDI de cada item' -->
            <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
              <label class="switch" style="position:relative;display:inline-block;width:38px;height:20px;">
                <input
                  type="checkbox"
                  ${this._mostrarBdiItem ? 'checked' : ''}
                  data-fb-change="OrcamentoSINAPI._toggleMostrarBdi"
                  data-fb-change-n="2"
                  data-fb-change-t0="checked"
                  data-fb-change-t1="string"
                  data-fb-change-v1="${encodeURIComponent(orc.id)}"
                  style="opacity:0;width:0;height:0;"
                >
                <span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:${this._mostrarBdiItem?'#2563eb':'#cbd5e1'};transition:.2s;border-radius:20px;">
                  <span style="position:absolute;content:'';height:14px;width:14px;left:${this._mostrarBdiItem?'20px':'3px'};bottom:3px;background-color:white;transition:.2s;border-radius:50%;display:inline-block;"></span>
                </span>
              </label>
              <span style="font-size:.8rem;color:#475569;font-weight:600;">Mostrar o BDI de cada item</span>
            </div>

          </div>

          <!-- Dropdown Flutuante de Resultados Rápidos (Screenshot 4) -->
          <div
            id="sinapi-quick-dropdown"
            style="display:none;position:absolute;left:20px;right:20px;top:54px;z-index:9999;background:#fff;border:1px solid #cbd5e1;border-radius:6px;box-shadow:0 10px 25px rgba(0,0,0,.15);max-height:340px;overflow-y:auto;"
          >
          </div>

        </div>

        <!-- GRID DE ITENS HIERÁRQUICO (Screenshot 3) -->
        <div class="modal-body" style="padding:0;overflow-y:auto;flex:1;background:#fff;">
          ${(orc.itens || []).some(item => item.preco_pendente) ? '<div role="status" style="padding:14px;background:#fff3cd;color:#664d03">Há itens sem preço na base selecionada. Os valores anteriores foram preservados. Importe a base correta e revise os preços antes de emitir a proposta.</div>' : ''}
          ${this._renderGridItens(orc)}
        </div>

        <!-- RODAPÉ DO EDITOR COM TOTALIZADORES E BOTÃO RECALCULAR (Screenshot 3) -->
        <div style="background:#fff;border-top:1px solid #e2e8f0;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          
          <div style="display:flex;align-items:center;gap:6px;font-size:.82rem;color:#64748b;cursor:pointer;" data-fb-click="OrcamentoSINAPI.legendaBdi" data-fb-click-n="0">
            <span style="font-weight:800;color:#2563eb;">?</span>
            <span style="text-decoration:underline;">Legenda das cores e símbolos</span>
          </div>

          <!-- Indicadores de Totais -->
          <div class="sinapi-editor-totals" style="display:flex;align-items:center;gap:24px;font-size:.85rem;flex-wrap:wrap;min-width:0;">
            ${(() => {
              const itens = orc.itens || [];
              const { subtotal, bdi, valorBDI:valorBdi, totalGeral } = this.calcularTotais(orc);
              const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

              return `
                <div>
                  <span style="font-size:.74rem;color:#64748b;text-transform:uppercase;font-weight:700;">TOTAL SEM BDI</span>
                  <span style="font-weight:900;color:#0f172a;margin-left:6px;">${Utils.fmt.currency(subtotal)}</span>
                </div>

                <div>
                  <span style="font-size:.74rem;color:#64748b;text-transform:uppercase;font-weight:700;">BDI (${bdi.toFixed(3)}%)</span>
                  <span style="font-weight:900;color:#d97706;margin-left:6px;">${Utils.fmt.currency(valorBdi)}</span>
                </div>

                <div style="font-size:1.1rem;font-weight:900;">
                  <span style="font-size:.78rem;color:#64748b;font-weight:700;">TOTAL · Calculado às ${agora}</span>
                  <span style="color:#0f172a;margin-left:8px;">${Utils.fmt.currency(totalGeral)}</span>
                </div>
              `;
            })()}

            <!-- Botão Recalcular -->
            <button
              type="button"
              class="btn btn-primary"
              style="font-weight:800;background:#0284c7;border-color:#0284c7;padding:8px 18px;"
              data-fb-click="OrcamentoSINAPI.recalcularOrcamento"
              data-fb-click-n="1"
              data-fb-click-t0="string"
              data-fb-click-v0="${encodeURIComponent(orc.id)}"
            >
              Recalcular
            </button>
          </div>

        </div>

      </div>
    `);
  },

  _renderGridItens(orc) {
    const filtro = this._gridFilters?.[orc.id] || '';
    const itens = (orc.itens || []).filter(it => this._matchesGridFilter(it, filtro));
    const e = Utils.escapeHtml.bind(Utils);

    // Se não houver itens, mostra empty state com mensagem de etapa
    if (!filtro && !itens.length && !(orc.etapas || []).length) {
      return `
        <div style="padding:60px 20px;text-align:center;color:#64748b;">
          <div style="font-size:1.05rem;font-weight:600;margin-bottom:14px;color:#334155;">
            Comece criando a 1ª etapa (ex.: 1 - Serviços preliminares) e depois inclua os itens dentro dela.
          </div>
          <button
            type="button"
            class="btn btn-primary"
            style="font-weight:700;padding:10px 20px;background:#0284c7;border-color:#0284c7;"
            data-fb-click="OrcamentoSINAPI.incluirEtapa"
            data-fb-click-n="1"
            data-fb-click-t0="string"
            data-fb-click-v0="${encodeURIComponent(orc.id)}"
          >
            + Criar 1ª Etapa
          </button>
        </div>
      `;
    }

    // Agrupa itens por Etapa
    const etapasMap = Object.create(null);
    if (!filtro) (orc.etapas || []).forEach(nome => { etapasMap[nome] = []; });
    itens.forEach(it => {
      const etNome = it.etapa_nome || '1 - SERVIÇOS GERAIS';
      if (!etapasMap[etNome]) etapasMap[etNome] = [];
      etapasMap[etNome].push(it);
    });

    return `
      ${filtro ? `<div role="status" style="padding:12px;white-space:normal;overflow-wrap:anywhere;">Filtro: <strong>${e(filtro)}</strong> · ${itens.length} de ${(orc.itens || []).length} itens. Os totais gerais incluem todos os itens. Use Filtrar e deixe vazio para limpar.</div>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
        <thead>
          <tr style="background:#3a3f47;color:#fff;font-size:.74rem;text-transform:uppercase;letter-spacing:.5px;">
            <th style="padding:10px 12px;width:60px;text-align:center;">ITEM</th>
            <th style="padding:10px 10px;width:70px;text-align:center;">TIPO</th>
            <th style="padding:10px 10px;width:90px;text-align:left;">BANCO</th>
            <th style="padding:10px 10px;width:90px;text-align:left;">CÓDIGO</th>
            <th style="padding:10px 10px;width:60px;text-align:center;">AÇÃO</th>
            <th style="padding:10px 14px;text-align:left;">DESCRIÇÃO</th>
            <th style="padding:10px 10px;width:70px;text-align:center;">UNIDADE</th>
            <th style="padding:10px 10px;width:90px;text-align:right;">QTD</th>
            <th style="padding:10px 12px;width:110px;text-align:right;">PREÇO UNIT</th>
            ${this._mostrarBdiItem ? '<th style="padding:10px 12px;width:120px;text-align:right;">PREÇO C/ BDI</th>' : ''}
            <th style="padding:10px 14px;width:130px;text-align:right;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${Object.keys(etapasMap).map((etNome, etIdx) => {
            const etItens = etapasMap[etNome];
            const etSubtotal = this.calcularTotais({ ...orc, itens:etItens }).totalGeral;
            return `
              <!-- Linha Cabeçalho da Etapa -->
              <tr style="background:#f1f5f9;border-top:1.5px solid #cbd5e1;border-bottom:1.5px solid #cbd5e1;">
                <td style="padding:8px 12px;text-align:center;font-weight:900;color:#1e293b;">${etIdx + 1}</td>
                <td colspan="5" style="padding:8px 14px;font-weight:900;color:#0f172a;font-size:.88rem;">
                  📁 ${e(etNome)}
                </td>
                <td colspan="${this._mostrarBdiItem ? 4 : 3}" style="padding:8px 14px;text-align:right;font-weight:800;color:#64748b;font-size:.8rem;">
                  ${filtro ? 'Subtotal visível:' : 'Subtotal Etapa:'}
                </td>
                <td style="padding:8px 14px;text-align:right;font-weight:900;color:#0f172a;font-size:.92rem;">
                  ${Utils.fmt.currency(etSubtotal)}
                </td>
              </tr>

              <!-- Linhas dos Itens da Etapa -->
              ${etItens.map((it, itemIdx) => {
                const pUnit = Number(it.preco_unitario) || 0;
                const bdi = Number(orc.bdi || 0);
                const pBdi = Math.round(pUnit * (1 + bdi / 100) * 100) / 100;
                const totalItem = this.calcularTotais({ ...orc, itens:[it] }).totalGeral;

                return `
                  <tr style="border-bottom:1px solid #f1f5f9;background:#fff;">
                    <td style="padding:8px 12px;text-align:center;color:#64748b;font-weight:600;">
                      ${etIdx + 1}.${itemIdx + 1}
                    </td>
                    <td style="padding:8px 10px;text-align:center;">
                      <span style="background:${it.tipo==='COMP'?'#ede9fe':'#fef3c7'};color:${it.tipo==='COMP'?'#6d28d9':'#b45309'};font-weight:800;font-size:.68rem;padding:2px 6px;border-radius:4px;">
                        ${e(it.tipo || 'COMP')}
                      </span>
                    </td>
                    <td style="padding:8px 10px;font-size:.75rem;font-weight:700;color:#64748b;">
                      ${e(it.banco || 'SINAPI')}
                    </td>
                    <td style="padding:8px 10px;font-family:monospace;font-weight:700;color:#2563eb;">
                      ${e(it.codigo || it.codigo_sinapi)}
                    </td>
                    <td style="padding:8px 10px;text-align:center;">
                      <button class="icon-btn btn-sm" style="color:#ef4444;font-size:11px;" title="Remover item" data-fb-click="OrcamentoSINAPI.removerItemDoEditor" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(orc.id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(it.id)}">
                        🗑️
                      </button>
                    </td>
                    <td style="padding:8px 14px;color:#1e293b;font-weight:500;">
                      ${e(it.descricao)}
                    </td>
                    <td style="padding:8px 10px;text-align:center;color:#64748b;">
                      ${e(it.unidade)}
                    </td>
                    <td style="padding:8px 10px;text-align:right;">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        style="width:75px;text-align:right;padding:3px 6px;border:1px solid #cbd5e1;border-radius:4px;font-size:.82rem;font-weight:700;"
                        value="${it.quantidade}"
                        data-fb-change="OrcamentoSINAPI.alterarQuantidadeItem"
                        data-fb-change-n="3"
                        data-fb-change-t0="string"
                        data-fb-change-v0="${encodeURIComponent(orc.id)}"
                        data-fb-change-t1="string"
                        data-fb-change-v1="${encodeURIComponent(it.id)}"
                        data-fb-change-t2="value"
                      >
                    </td>
                    <td style="padding:8px 12px;text-align:right;font-weight:600;color:#0f172a;">
                      ${Utils.fmt.currency(pUnit)}
                    </td>
                    ${this._mostrarBdiItem ? `
                      <td style="padding:8px 12px;text-align:right;font-weight:600;color:#d97706;">
                        ${Utils.fmt.currency(pBdi)}
                      </td>
                    ` : ''}
                    <td style="padding:8px 14px;text-align:right;font-weight:900;color:#059669;">
                      ${Utils.fmt.currency(totalItem)}
                    </td>
                  </tr>
                `;
              }).join('')}
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  // ─────────────────────────────────────────────────
  // Autocomplete e Quick-Add (Screenshot 4)
  // ─────────────────────────────────────────────────

  _onQuickSearchInput(orcId, termo) {
    const dropdown = document.getElementById('sinapi-quick-dropdown');
    if (!dropdown) return;

    this._lastSearchResults = [];
    this._lastQuickResults = [];
    const q = (termo || '').trim().toLowerCase();
    if (q.length < 2) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    const orc = this._getById(orcId);
    const selected = orc?.bancos_config?.bancos?.find(b => b.id === 'sinapi');
    const enabled = !selected || selected.checked;
    const resultados = (enabled && (this._filtroComposicoes || this._filtroInsumos) && orc && typeof SINAPI !== 'undefined')
      ? SINAPI.buscar(termo, orc.desonerado, 30, orc.uf, orc.referencia_sinapi)
          .filter(item => {
            const tipo = item.tipo || 'COMP';
            if (tipo === 'INSUMO' && !this._filtroInsumos) return false;
            if (tipo === 'COMP' && !this._filtroComposicoes) return false;
            return true;
          })
          .map(item => ({ ...item, tipo: item.tipo || 'COMP', banco: item.banco || 'SINAPI', preco_unitario: Number(item.preco_unitario) || 0 }))
      : [];

    if (!resultados.length) {
      dropdown.style.display = 'block';
      dropdown.innerHTML = `<div style="padding:12px;color:#94a3b8;font-size:.82rem;">Nenhum item encontrado para "${Utils.escapeHtml(termo)}"</div>`;
      return;
    }

    const e = Utils.escapeHtml.bind(Utils);

    dropdown.style.display = 'block';
    dropdown.innerHTML = `
      <div style="padding:4px 0;">
        ${resultados.slice(0, 15).map((r, i) => `
          <div
            class="sinapi-quick-opt"
            style="padding:10px 16px;border-bottom:1px solid #f1f5f9;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;transition:background .15s;"
            data-fb-click="OrcamentoSINAPI.inserirItemRapido"
            data-fb-click-n="2"
            data-fb-click-t0="string"
            data-fb-click-v0="${encodeURIComponent(orcId)}"
            data-fb-click-t1="number"
            data-fb-click-v1="${i}"
          >
            <!-- Lado Esquerdo: Descrição e Tags -->
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:.875rem;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${Utils.escapeHtml(r.descricao)}">
                ${Utils.escapeHtml(r.descricao)}
              </div>
              
              <div style="display:flex;align-items:center;gap:8px;margin-top:4px;font-size:.75rem;">
                <span style="background:${r.tipo==='COMP'?'#ede9fe':'#fef3c7'};color:${r.tipo==='COMP'?'#6d28d9':'#b45309'};font-weight:800;padding:1px 6px;border-radius:4px;">
                  ${r.tipo}
                </span>
                <span style="font-family:monospace;font-weight:800;color:#2563eb;">${e(r.codigo)}</span>
                <span style="color:#64748b;">· ${e(r.unidade)}</span>
                <span style="color:#64748b;font-weight:600;">· ${e(r.banco)}</span>
              </div>
            </div>

            <!-- Lado Direito: Preço em 4 decimais -->
            <div style="font-weight:800;font-size:.95rem;color:#0f172a;white-space:nowrap;">
              R$${r.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Armazena no buffer de resultados seguro para clique
    this._lastSearchResults = resultados.slice(0, 15);
    this._lastQuickResults = this._lastSearchResults; // _lastSearchResults[${i}]
  },

  _onQuickSearchKeyDown(e, orcId) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this._lastSearchResults && this._lastSearchResults.length > 0) {
        this.inserirItemRapido(orcId, 0);
      }
    }
  },

  inserirItemRapido(orcId, resultIdx) {
    const item = (this._lastSearchResults || this._lastQuickResults)?.[resultIdx];
    if (!item) return;

    const orc = this._getById(orcId);
    if (!orc) return;

    // Se não houver etapas criadas, define etapa padrão
    let etapaAlvo = orc.etapa_ativa || '1 - SERVIÇOS PRELIMINARES';
    if (!orc.etapa_ativa && orc.itens && orc.itens.length > 0) {
      etapaAlvo = orc.itens[orc.itens.length - 1].etapa_nome || etapaAlvo;
    }

    const bdi = Number(orc.bdi || 0);
    const precoUnit = Number(item.preco_unitario) || 0;
    const precoBdi = precoUnit * (1 + bdi / 100);

    const novoItem = {
      id: DB.uuid(),
      etapa_nome: etapaAlvo,
      tipo: item.tipo,
      banco: item.banco,
      codigo: item.codigo,
      codigo_sinapi: item.codigo,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: 1.00,
      preco_unitario: precoUnit,
      preco_com_bdi: Math.round(precoBdi * 100) / 100,
      total: Math.round(precoBdi * 100) / 100
    };

    orc.itens = [...(orc.itens || []), novoItem];
    this._save(orc);

    this._lastSearchResults = [];
    this._lastQuickResults = [];
    // Fecha dropdown e limpa input
    const dropdown = document.getElementById('sinapi-quick-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    const input = document.getElementById('sinapi-quick-add-input');
    if (input) {
      input.value = '';
      input.focus();
    }

    Utils.toast(`"${item.descricao.substring(0, 30)}..." adicionado!`, 'success');
    this.openEditor(orcId);
  },

  _toggleFiltroInsumos(chk, orcId) {
    this._filtroInsumos = chk;
    const input = document.getElementById('sinapi-quick-add-input');
    if (input) this._onQuickSearchInput(orcId, input.value);
  },

  _toggleFiltroComposicoes(chk, orcId) {
    this._filtroComposicoes = chk;
    const input = document.getElementById('sinapi-quick-add-input');
    if (input) this._onQuickSearchInput(orcId, input.value);
  },

  _toggleMostrarBdi(chk, orcId) {
    this._mostrarBdiItem = chk;
    this.openEditor(orcId);
  },

  incluirEtapa(orcId) {
    const orc = this._getById(orcId);
    if (!orc) return;

    Utils.prompt('Nome da Nova Etapa:', (nomeEtapa) => {
      if (!nomeEtapa) return;
      
      nomeEtapa = nomeEtapa.trim();
      if (!nomeEtapa) return;
      orc.etapas = [...new Set([...(orc.etapas || []), nomeEtapa])];
      orc.etapa_ativa = nomeEtapa;
      this._save(orc);
      this.openEditor(orcId);
      // Abre o quick search com foco
      const input = document.getElementById('sinapi-quick-add-input');
      if (input) {
        input.placeholder = `Adicionando itens em "${nomeEtapa}"... Digite o código ou nome`;
        input.focus();
      }
      
      Utils.toast(`Etapa "${nomeEtapa}" selecionada! Adicione os itens na barra de busca.`, 'info');
    }, '1 - Serviços Preliminares');
  },

  alterarQuantidadeItem(orcId, itemId, novaQtd) {
    const orc = this._getById(orcId);
    if (!orc) return;

    const it = (orc.itens || []).find(x => x.id === itemId);
    if (!it) return;

    const qtd = Math.max(0, parseFloat(novaQtd) || 0);
    const bdi = Number(orc.bdi || 0);
    const pBdi = it.preco_com_bdi || (it.preco_unitario * (1 + bdi / 100));

    it.quantidade = qtd;
    it.total = Math.round((qtd * pBdi) * 100) / 100;

    this._save(orc);
    this.openEditor(orcId);
  },

  menuFerramentas() {
    this.infoAjuda();
  },

  toggleAnalitico() {
    Utils.toast('A base importada contém preços sintéticos. A composição analítica ainda não está disponível.', 'warning');
  },

  filtroGrid() {
    const id = this._currentEditor;
    if (!this._getById(id)) return;
    Utils.prompt('Filtrar itens por código, descrição, banco ou etapa. Deixe vazio para mostrar todos.', valor => {
      this._gridFilters ||= Object.create(null);
      this._gridFilters[id] = String(valor ?? '').trim().slice(0, 200);
      this.openEditor(id);
    }, this._gridFilters?.[id] || '');
  },

  _matchesGridFilter(item, filtro) {
    const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return normalize([item.codigo, item.codigo_sinapi, item.descricao, item.banco, item.etapa_nome].join(' ')).includes(normalize(filtro));
  },

  focarBusca() {
    document.getElementById('sinapi-quick-add-input')?.focus();
  },

  legendaBdi() {
    this._showInfo('Legenda:\n[COMP] Composição de Serviço\n[INSUMO] Insumo de Material / Equipamento / Mão de Obra\nCálculo de Preço C/ BDI = Preço Unitário × (1 + BDI%)');
  },

  infoAjuda() {
    this._showInfo('Sistema de Orçamentos SINAPI & Multi-Bancos:\n- Use MODELOS PRONTOS para clonar orçamentos pré-configurados.\n- No editor, acesse PERÍODO para trocar estado, mês e desoneração.\n- Gere relatórios Excel ou Propostas em PDF com 1 clique.');
  },

  removerItemDoEditor(orcId, itemId) {
    const orc = this._getById(orcId);
    if (!orc) return;

    orc.itens = (orc.itens || []).filter(i => i.id !== itemId);
    this._save(orc);
    this.openEditor(orcId);
    Utils.toast('Item removido.', 'info');
  },

  renomearRapido(orcId) {
    const orc = this._getById(orcId);
    if (!orc) return;

    Utils.prompt('Nome do Orçamento:', (novoNome) => {
      if (!novoNome) return;
      orc.nome = novoNome;
      this._save(orc);
      this.openEditor(orcId);
      Utils.toast('Nome atualizado!', 'success');
    }, orc.nome);
  },

  editarParametro(orcId, param) {
    const orc = this._getById(orcId);
    if (!orc) return;

    if (param === 'bdi') {
      Utils.prompt('Taxa de BDI (%) do Orçamento:', (val) => {
        if (val === null) return;
        const percent = Number(String(val).replace(',', '.'));
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) return Utils.toast('Informe um BDI entre 0 e 100%.', 'warning');
        orc.bdi = percent;
        this._save(orc);
        this.recalcularOrcamento(orcId);
      }, String(orc.bdi ?? this.BDI_PADRAO));
    } else if (param === 'desconto') {
      Utils.toast('Desconto global ainda não está disponível. Nenhum valor foi alterado.', 'warning');
    } else if (param === 'encargos') {
      Utils.prompt('Encargos Sociais:', (val) => {
        if (val === null) return;
        orc.encargos_sociais = val;
        this._save(orc);
        this.openEditor(orcId);
      }, orc.encargos_sociais || '');
    }
  },

  recalcularOrcamento(orcId) {
    const orc = this._getById(orcId);
    if (!orc) return;

    const bdi = Number(orc.bdi || 0);
    (orc.itens || []).forEach(it => {
      const pUnit = Number(it.preco_unitario) || 0;
      it.preco_com_bdi = Math.round((pUnit * (1 + bdi / 100)) * 100) / 100;
      it.total = Math.round(((Number(it.quantidade) || 0) * it.preco_com_bdi) * 100) / 100;
    });

    orc.data_alteracao = new Date().toLocaleString('pt-BR');
    this._save(orc);
    this.openEditor(orcId);
    Utils.toast('Orçamento recalculado com sucesso!', 'success');
  },

  ajustarItens(orcId) {
    const original = this._getById(orcId);
    if (!original) return;
    const filtro = this._gridFilters?.[orcId] || '';
    const quantidade = (original.itens || []).filter(item => this._matchesGridFilter(item, filtro)).length;
    if (!quantidade) return Utils.toast('Não há itens visíveis para ajustar. Limpe ou altere o filtro.', 'warning');
    Utils.prompt(`Ajustar quantidades de ${quantidade} itens ${filtro ? 'filtrados' : 'do orçamento'}. Informe o percentual: 10 aumenta 10%; -10 reduz 10%. Preços unitários não serão alterados.`, valor => {
      const texto = String(valor ?? '').trim().replace(',', '.');
      const percentual = Number(texto);
      if (!texto || !Number.isFinite(percentual) || percentual < -100 || percentual > 1000) {
        this.openEditor(orcId);
        return Utils.toast('Informe um percentual entre -100 e 1000.', 'warning');
      }
      const preview = this._previewQuantityAdjustment(original, filtro, percentual);
      if (!preview.changed) {
        this.openEditor(orcId);
        return Utils.toast('Nenhuma quantidade será alterada.', 'info');
      }
      Utils.confirm(`Alterar ${preview.changed} itens em ${percentual}%? Quantidades arredondadas a 3 casas decimais. Total do orçamento: ${Utils.fmt.currency(this.calcularTotais(original).totalGeral)} → ${Utils.fmt.currency(this.calcularTotais(preview.orc).totalGeral)}.`, () => {
        const atual = this._getById(orcId);
        if (JSON.stringify(atual) !== JSON.stringify(original)) {
          if (atual) this.openEditor(orcId);
          return Utils.toast('O orçamento mudou durante a prévia. Revise e tente novamente.', 'warning');
        }
        this._save(preview.orc);
        this.openEditor(orcId);
        Utils.toast(`${preview.changed} quantidades ajustadas.`, 'success');
      });
    }, '0');
  },

  _previewQuantityAdjustment(orc, filtro, percentual) {
    if (!Number.isFinite(percentual) || percentual < -100 || percentual > 1000) throw new Error('Percentual inválido');
    let changed = 0;
    const itens = (orc.itens || []).map(item => {
      if (!this._matchesGridFilter(item, filtro)) return { ...item };
      const anterior = Number(item.quantidade) || 0;
      const quantidade = Math.round(anterior * (1 + percentual / 100) * 1000) / 1000;
      if (!Number.isFinite(quantidade)) throw new Error('Quantidade inválida');
      if (quantidade === anterior) return { ...item };
      changed++;
      const updated = { ...item, quantidade };
      updated.total = this.calcularTotais({ ...orc, itens:[updated] }).totalGeral;
      return updated;
    });
    return { orc:{ ...orc, itens }, changed };
  },

  removerItensVazios(orcId) {
    const orc = this._getById(orcId);
    if (!orc) return;
    orc.itens = (orc.itens || []).filter(i => (Number(i.quantidade) || 0) > 0);
    this._save(orc);
    this.openEditor(orcId);
    Utils.toast('Itens com quantidade zerada foram removidos.', 'info');
  },

  // ─────────────────────────────────────────────────
  // Modal de Criação / Edição de Metadados
  // ─────────────────────────────────────────────────

  showForm(id = null) {
    if (!this._ensurePlanAccess()) return;
    const orc = id ? (this._getById(id) || {}) : {};
    const hoje = Utils.today();
    const e = Utils.escapeHtml.bind(Utils);
    const defaultUf = orc.uf || this._defaultUF(orc.obra_id);

    Utils.showModal(`
      <div class="modal" style="max-width:560px;padding:0;overflow:hidden;border-radius:var(--r-lg);">
        <div style="background:#23272d;color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-weight:800;font-size:1.1rem;">${id ? '✏️ Editar Orçamento' : '🏗️ Novo Orçamento'}</span>
          <button class="modal-close" style="color:#aaa;background:transparent;border:none;font-size:1.3rem;cursor:pointer;" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <form id="f-sinapi-orc">
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Obra / Cliente *</label>
                <select class="form-control" name="obra_id" required>${Utils.clienteOptions(orc.obra_id || (App.obraId !== 'todas' ? App.obraId : ''))}</select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Nome do Orçamento *</label>
                <input class="form-control" name="nome" value="${e(orc.nome || '')}" required placeholder="Ex: Construção Casa 01">
              </div>
            </div>
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">UF (Estado)</label>
                <select class="form-control" name="uf">
                  ${Utils.stateOptions(defaultUf)}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Referência</label>
                <input class="form-control" type="month" name="referencia_sinapi" value="${e(orc.referencia_sinapi || '2026-07')}">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">BDI (%)</label>
                <input class="form-control" type="number" name="bdi" value="${orc.bdi ?? this.BDI_PADRAO}" step="0.001" min="0" max="100">
              </div>
            </div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Série de Oneração</label>
                <select class="form-control" name="desonerado">
                  <option value="false" ${!orc.desonerado ? 'selected' : ''}>🟢 Com Oneração (padrão)</option>
                  <option value="true"  ${orc.desonerado  ? 'selected' : ''}>🟡 Sem Oneração (Desonerado)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Status</label>
                <select class="form-control" name="status">
                  <option value="ativo"    ${(orc.status||'ativo')==='ativo'   ?'selected':''}>✓ Ativo</option>
                  <option value="revisao"  ${orc.status==='revisao'            ?'selected':''}>🔄 Em Revisão</option>
                  <option value="cancelado"${orc.status==='cancelado'          ?'selected':''}>✕ Cancelado</option>
                </select>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:700;">Descrição da Obra</label>
              <textarea class="form-control" name="descricao" rows="2" placeholder="Descrição do projeto...">${e(orc.descricao || '')}</textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer" style="background:#f8fafc;padding:14px 20px;display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button class="btn btn-primary" style="font-weight:700;" data-fb-click="OrcamentoSINAPI.save" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(id || '')}">
            ${id ? '✔ Salvar Alterações' : '+ Criar e Abrir'}
          </button>
        </div>
      </div>`);
  },

  save(id) {
    if (!this._ensurePlanAccess()) return;
    const f = document.getElementById('f-sinapi-orc');
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const fd = new FormData(f);
    const d = Object.fromEntries(fd);

    const payload = {
      obra_id: d.obra_id,
      nome: d.nome,
      uf: d.uf,
      referencia_sinapi: d.referencia_sinapi,
      bdi: Number.isFinite(parseFloat(d.bdi)) ? parseFloat(d.bdi) : this.BDI_PADRAO,
      desonerado: d.desonerado === 'true',
      status: d.status,
      descricao: d.descricao || '',
      data_alteracao: new Date().toLocaleString('pt-BR')
    };

    let saved;
    if (id) {
      const existing = this._getById(id);
      saved = { ...existing, ...payload };
      saved.itens = (saved.itens || []).map(item => {
        const preco = Math.round(Number(item.preco_unitario || 0) * (1 + saved.bdi / 100) * 100) / 100;
        return { ...item, preco_com_bdi:preco, total:Math.round(Number(item.quantidade || 0) * preco * 100) / 100 };
      });
      this._save(saved);
      Utils.toast('Orçamento atualizado!', 'success');
    } else {
      const todos = this._getAll();
      const proximoNum = String(todos.length + 1).padStart(4, '0');
      saved = {
        id: DB.uuid(),
        numero: proximoNum,
        itens: [],
        data_criacao: Utils.today(),
        ...payload
      };
      this._add(saved);
      Utils.toast(`Orçamento ${proximoNum} criado!`, 'success');
    }

    Utils.closeModal();
    this._refresh();

    if (!id) setTimeout(() => this.openEditor(saved.id), 150);
  },

  del(id) {
    if (!this._ensurePlanAccess()) return;
    Utils.confirm('Excluir este orçamento? Esta ação não pode ser desfeita.', () => {
      this._remove(id);
      this._refresh();
      Utils.toast('Orçamento excluído!', 'info');
    });
  },

  // ─────────────────────────────────────────────────
  // Exportação Excel
  // ─────────────────────────────────────────────────

  async exportExcel(id) {
    const orc = this._getById(id);
    if (!orc) return;
    if (!await FinObraAssets.require('excel')) return;
    if (typeof XLSX === 'undefined') { Utils.toast('SheetJS não carregado.', 'warning'); return; }

    const cliente = DB.getById('clientes', orc.obra_id);
    const itens = orc.itens || [];
    const { subtotal, bdi, valorBDI, totalGeral:total } = this.calcularTotais(orc);

    const wsData = [
      [(DB.getEmpresa()?.nome_fantasia || DB.getEmpresa()?.razao_social || 'FINGO ENGENHARIA').toUpperCase(), '', '', '', '', '', ''],
      ['PLANILHA ORÇAMENTÁRIA DETALHADA', '', '', '', '', '', ''],
      [`Orçamento: ${orc.nome}`, '', '', '', `Ref.: ${orc.uf} ${orc.referencia_sinapi}`, '', ''],
      [`Obra: ${cliente?.nome || '—'}`, '', '', '', `BDI: ${bdi}%`, '', ''],
      [],
      ['Item', 'Tipo', 'Banco', 'Código', 'Descrição do Serviço', 'Unidade', 'Quantidade', 'Preço Unitário (R$)', 'Total (R$)']
    ];

    itens.forEach((it, idx) => {
      wsData.push([
        idx + 1,
        it.tipo || 'COMP',
        it.banco || 'SINAPI',
        it.codigo || it.codigo_sinapi,
        it.descricao,
        it.unidade,
        it.quantidade,
        it.preco_unitario,
        Number(it.quantidade || 0) * Number(it.preco_unitario || 0)
      ]);
    });

    wsData.push([]);
    wsData.push(['', '', '', '', '', '', '', 'Subtotal (R$):', subtotal]);
    wsData.push(['', '', '', '', '', '', '', `BDI (${bdi}%):`, valorBDI]);
    wsData.push(['', '', '', '', '', '', '', 'TOTAL GERAL (R$):', total]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orçamento');
    XLSX.writeFile(wb, `Orcamento_${(orc.nome||'FinGo').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
    Utils.toast('Planilha Excel exportada!', 'success');
  },

  // ─────────────────────────────────────────────────
  // Snapshots Oficiais & Compatibilidade 1-Clique
  // ─────────────────────────────────────────────────

  async puxarDiretoNoEditor(orcId) {
    const orc = this._getById(orcId);
    if (!orc) return;
    const btn = document.getElementById('btn-puxar-editor');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Carregando...';
    }
    Utils.toast(`Carregando snapshot SINAPI ${orc.uf} ${orc.referencia_sinapi}...`, 'info');
    const res = (typeof SINAPI !== 'undefined' && SINAPI.puxarOficial)
      ? await SINAPI.puxarOficial(orc.desonerado, orc.uf, orc.referencia_sinapi, (msg) => {
          if (btn) btn.textContent = `⏳ ${msg}`;
        })
      : { ok: false, msg: 'SINAPI indisponível' };
    if (res.ok) {
      Utils.toast(res.msg, 'success');
      this.openEditor(orcId);
    } else {
      Utils.toast(res.msg, 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Tentar novamente';
      }
    }
  },

  _updateOfficialSnapshotAvailability() {
    const desonerado = document.querySelector('input[name="imp-serie"]:checked')?.value === 'true';
    const uf = String(document.getElementById('imp-uf')?.value || '').toUpperCase();
    const ref = String(document.getElementById('imp-ref')?.value || '');
    const btn = document.getElementById('btn-puxar-oficial');
    if (!btn) return;
    const snap = (typeof SINAPI !== 'undefined' && SINAPI.snapshotFor) ? SINAPI.snapshotFor(uf, ref, desonerado) : null;
    if (snap) {
      btn.disabled = false;
      btn.className = 'btn btn-primary';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.innerHTML = `<span>⚡</span> Carregar Base Oficial Caixa ${snap.uf} ${snap.referencia} (${desonerado ? 'sem oneração' : 'com oneração'}) — 1-Clique`;
    } else {
      btn.disabled = false;
      btn.className = 'btn btn-secondary';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.innerHTML = `<span>⚡</span> Sem snapshot 1-clique para ${uf || 'UF'} ${ref || 'competência'} — Clique para usar RR 12/2024`;
    }
  },

  async puxarOficialAutomatico() {
    let desonerado = document.querySelector('input[name="imp-serie"]:checked')?.value === 'true';
    let uf = String(document.getElementById('imp-uf')?.value || '').toUpperCase();
    let ref = String(document.getElementById('imp-ref')?.value || '');

    let snap = (typeof SINAPI !== 'undefined' && SINAPI.snapshotFor) ? SINAPI.snapshotFor(uf, ref, desonerado) : null;
    if (!snap) {
      uf = 'RR';
      ref = '2024-12';
      const ufEl = document.getElementById('imp-uf');
      const refEl = document.getElementById('imp-ref');
      if (ufEl) ufEl.value = uf;
      if (refEl) refEl.value = ref;
      this._updateOfficialSnapshotAvailability();
    }

    const progMsg = document.getElementById('imp-progress-msg');
    const resEl = document.getElementById('imp-result');

    const resultado = (typeof SINAPI !== 'undefined' && SINAPI.puxarOficial)
      ? await SINAPI.puxarOficial(desonerado, uf, ref, (msg) => { if (progMsg) progMsg.textContent = msg; })
      : { ok: false, msg: 'SINAPI indisponível' };

    if (resEl && resultado.ok) {
      resEl.innerHTML = `<div style="font-size:.8rem;color:var(--text2);margin-top:3px;">${Utils.escapeHtml(resultado.msg || '')}</div>`;
    }
    Utils.toast(resultado.msg, resultado.ok ? 'success' : 'error');
  },

  // ─────────────────────────────────────────────────
  // Persistência
  // ─────────────────────────────────────────────────

  _KEY: 'orcamentos_sinapi',

  _storageKey() {
    return (typeof DB !== 'undefined' && DB._ck) ? DB._ck(this._KEY) : this._KEY;
  },

  _syncCloud(action, data=null, id=null) {
    if (typeof DB !== 'undefined' && DB.syncToCloud) DB.syncToCloud(action, 'orcamentos_sinapi', data, id);
  },

  _getAll(obraId) {
    try {
      const all = JSON.parse(localStorage.getItem(this._storageKey()) || '[]');
      if (!obraId || obraId === 'todas') return all;
      return all.filter(o => o.obra_id === obraId);
    } catch { return []; }
  },

  _getById(id) {
    try {
      const all = JSON.parse(localStorage.getItem(this._storageKey()) || '[]');
      return all.find(o => o.id === id) || null;
    } catch { return null; }
  },

  _add(orc) {
    if (typeof DB !== 'undefined' && DB.canWriteLocal && !DB.canWriteLocal('write')) return DB._denyLocal('write');
    try {
      const all = JSON.parse(localStorage.getItem(this._storageKey()) || '[]');
      all.unshift(orc);
      localStorage.setItem(this._storageKey(), JSON.stringify(all));
      this._syncCloud('save', orc);
    } catch(e) { console.error('OrcamentoSINAPI._add', e); }
  },

  _save(orc) {
    if (typeof DB !== 'undefined' && DB.canWriteLocal && !DB.canWriteLocal('write')) return DB._denyLocal('write');
    try {
      const all = JSON.parse(localStorage.getItem(this._storageKey()) || '[]');
      const idx = all.findIndex(o => o.id === orc.id);
      if (idx !== -1) all[idx] = orc;
      else all.push(orc);
      localStorage.setItem(this._storageKey(), JSON.stringify(all));
      this._syncCloud('save', orc);
    } catch(e) { console.error('OrcamentoSINAPI._save', e); }
  },

  _remove(id) {
    if (typeof DB !== 'undefined' && DB.canWriteLocal && !DB.canWriteLocal('delete')) return DB._denyLocal('delete');
    try {
      const all = JSON.parse(localStorage.getItem(this._storageKey()) || '[]').filter(o => o.id !== id);
      localStorage.setItem(this._storageKey(), JSON.stringify(all));
      this._syncCloud('delete', null, id);
    } catch(e) { console.error('OrcamentoSINAPI._remove', e); }
  },

  _refresh() {
    const el = document.getElementById('route-content');
    if (el && App.route === 'orcamentos') {
      const content = document.getElementById('orc-tab-content');
      if (content) {
        content.innerHTML = Orcamentos._renderTab(Orcamentos._activeTab, App.obraId);
      } else {
        el.innerHTML = Orcamentos.render(App.obraId);
      }
    }
  },

  init() {}

};
