// js/orcamento_sinapi.js — UI completa do módulo de Orçamentos SINAPI
// Suporta: criação, edição, busca SINAPI, cálculo com BDI, export PDF e Excel
// UF vem da obra/empresa | BDI padrão de referência: 24,23%

const OrcamentoSINAPI = {

  BDI_PADRAO: 24.23,
  _currentEditor: null, // id do orçamento aberto no editor
  _lastSearchResults: [],

  _defaultUF(obraId='') {
    const id = obraId && obraId !== 'todas' ? obraId : ((typeof App !== 'undefined' && App.obraId !== 'todas') ? App.obraId : '');
    const obra = id ? DB.getById('clientes', id) : null;
    const emp = DB.getEmpresa ? DB.getEmpresa() : {};
    return String(obra?.estado || obra?.uf || emp?.uf || '').trim().toUpperCase();
  },

  // ─────────────────────────────────────────────────
  // Render: lista de orçamentos
  // ─────────────────────────────────────────────────

  render(obraId) {
    const orcs = this._getAll(obraId);
    const statusOnerado   = SINAPI.hasBase(false);
    const statusDesonerado = SINAPI.hasBase(true);

    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">🏗️ Orçamentos SINAPI</h1>
        <p class="page-sub">Orçamentos de obra civil com tabela referencial da Caixa</p>
      </div>
      <div class="page-actions" style="gap:10px;">
        <button class="btn btn-secondary btn-sm" data-fb-click="OrcamentoSINAPI.showImportModal" data-fb-click-n="0" id="btn-importar-sinapi">
          📁 Importar Tabela SINAPI
        </button>
        <button class="btn btn-primary" data-fb-click="OrcamentoSINAPI.showForm" data-fb-click-n="0">+ Novo Orçamento</button>
      </div>
    </div>

    <!-- Status das bases SINAPI -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      ${this._baseStatusCard(false, statusOnerado)}
      ${this._baseStatusCard(true, statusDesonerado)}
    </div>

    <!-- Lista de orçamentos -->
    <div id="sinapi-orc-list">
      ${orcs.length
        ? orcs.map(o => this._card(o)).join('')
        : `<div class="empty-state">
            <h3>Nenhum orçamento SINAPI</h3>
            <p>Importe a tabela SINAPI e crie seu primeiro orçamento</p>
            <button class="btn btn-primary" data-fb-click="OrcamentoSINAPI.showForm" data-fb-click-n="0">+ Novo Orçamento</button>
           </div>`}
    </div>`;
  },

  _baseStatusCard(desonerado, importada) {
    const label = desonerado ? 'Sem Oneração (Desonerado)' : 'Com Oneração';
    const icon  = desonerado ? '🟡' : '🟢';
    const meta  = SINAPI.getMeta(desonerado);
    const [y, m] = (meta?.referencia || '').split('-');
    const meses = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const refLabel = meta ? `${meta.uf} — ${meses[parseInt(m)]||m}/${y} — ${(meta.total||0).toLocaleString('pt-BR')} itens` : 'Não importada';
    const cor = importada ? 'var(--success)' : 'var(--text3)';

    return `
    <div style="background:var(--bg-card);border:1px solid ${importada?'rgba(16,185,129,.3)':'var(--border)'};border-radius:var(--r-md);padding:14px 18px;display:flex;align-items:center;gap:14px;">
      <div style="font-size:1.6rem">${importada ? icon : '⬜'}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:.85rem;color:${cor};margin-bottom:3px;">${label}</div>
        <div style="font-size:.75rem;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${refLabel}</div>
      </div>
      <button class="btn btn-secondary btn-sm" data-fb-click="OrcamentoSINAPI.showImportModal" data-fb-click-n="1" data-fb-click-t0="auto" data-fb-click-v0="${encodeURIComponent(String(desonerado))}" style="flex-shrink:0;font-size:.72rem;">
        ${importada ? '🔄 Atualizar' : '📁 Importar'}
      </button>
    </div>`;
  },

  _card(orc) {
    const e = Utils.escapeHtml.bind(Utils);
    const cliente = DB.getById('clientes', orc.obra_id);
    const subtotal = (orc.itens || []).reduce((s, i) => s + (i.total || 0), 0);
    const bdi = orc.bdi || this.BDI_PADRAO;
    const total = subtotal * (1 + bdi / 100);
    const serieLabel = orc.desonerado ? '🟡 Sem Oneração' : '🟢 Com Oneração';
    const [y, m] = (orc.referencia_sinapi || '').split('-');
    const meses = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const refLabel = orc.referencia_sinapi ? `${orc.uf} — ${meses[parseInt(m)]||m}/${y}` : '—';

    return `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <div>
          <div class="card-title">${e(orc.nome)}</div>
          <div style="font-size:.78rem;color:var(--text3);margin-top:4px;display:flex;align-items:center;gap:12px;">
            <span>👤 ${e(cliente?.nome || '—')}</span>
            <span>📅 ${Utils.fmt.date(orc.data_criacao)}</span>
            <span>📍 ${e(refLabel)}</span>
            <span>${serieLabel}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${Utils.badge(orc.status || 'ativo')}
          <button class="btn btn-secondary btn-sm" data-fb-click="OrcamentoSINAPI.openEditor" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}">🏗️ Abrir</button>
          <button class="icon-btn btn-sm" data-fb-click="OrcamentoSINAPI.showForm" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" title="Editar dados">✏️</button>
          <button class="icon-btn btn-sm" style="color:var(--danger)" data-fb-click="OrcamentoSINAPI.del" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orc.id))}" title="Excluir">🗑️</button>
        </div>
      </div>
      <div class="g4" style="margin-top:14px;">
        <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--r-md);text-align:center">
          <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);margin-bottom:4px">Nº de Itens</div>
          <div style="font-size:1.1rem;font-weight:900;color:var(--accent)">${(orc.itens||[]).length}</div>
        </div>
        <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--r-md);text-align:center">
          <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);margin-bottom:4px">Subtotal SINAPI</div>
          <div style="font-size:1.1rem;font-weight:900;color:var(--text)">${Utils.fmt.currency(subtotal)}</div>
        </div>
        <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--r-md);text-align:center">
          <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);margin-bottom:4px">BDI (${bdi}%)</div>
          <div style="font-size:1.1rem;font-weight:900;color:var(--warning)">${Utils.fmt.currency(subtotal * bdi / 100)}</div>
        </div>
        <div style="padding:12px;background:rgba(201,162,39,.08);border:1px solid rgba(201,162,39,.2);border-radius:var(--r-md);text-align:center">
          <div style="font-size:.68rem;text-transform:uppercase;color:var(--accent);margin-bottom:4px">Total Geral</div>
          <div style="font-size:1.1rem;font-weight:900;color:var(--accent)">${Utils.fmt.currency(total)}</div>
        </div>
      </div>
    </div>`;
  },

  // ─────────────────────────────────────────────────
  // Modal: Criar / Editar metadados do orçamento
  // ─────────────────────────────────────────────────

  showForm(id = null) {
    const orc = id ? (this._getById(id) || {}) : {};
    const hoje = Utils.today();
    const anoAtual = new Date().getFullYear();
    const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
    const refDefault = orc.referencia_sinapi || `${anoAtual}-${mesAtual}`;
    const e = Utils.escapeHtml.bind(Utils);
    const defaultUf = orc.uf || this._defaultUF(orc.obra_id);

    Utils.showModal(`
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <span class="modal-title">${id ? '✏️ Editar Orçamento' : '🏗️ Novo Orçamento SINAPI'}</span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body">
          <form id="f-sinapi-orc">
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Obra / Cliente *</label>
                <select class="form-control" name="obra_id" required>${Utils.clienteOptions(orc.obra_id || (App.obraId !== 'todas' ? App.obraId : ''))}</select>
              </div>
              <div class="form-group">
                <label class="form-label">Nome do Orçamento *</label>
                <input class="form-control" name="nome" value="${e(orc.nome || '')}" required placeholder="Ex: Orçamento Base — Casa 01">
              </div>
            </div>
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">UF (Estado)</label>
                <select class="form-control" name="uf">
                  ${Utils.stateOptions(defaultUf)}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Referência SINAPI</label>
                <input class="form-control" type="month" name="referencia_sinapi" value="${e(refDefault)}">
              </div>
              <div class="form-group">
                <label class="form-label">BDI (%)</label>
                <input class="form-control" type="number" name="bdi" value="${orc.bdi || this.BDI_PADRAO}" step="0.01" min="0" max="100">
              </div>
            </div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Série de Oneração *</label>
                <select class="form-control" name="desonerado" id="fs-desonera">
                  <option value="false" ${!orc.desonerado ? 'selected' : ''}>🟢 Com Oneração (padrão)</option>
                  <option value="true"  ${orc.desonerado  ? 'selected' : ''}>🟡 Sem Oneração (Desonerado)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-control" name="status">
                  <option value="ativo"    ${(orc.status||'ativo')==='ativo'   ?'selected':''}>✓ Ativo</option>
                  <option value="revisao"  ${orc.status==='revisao'            ?'selected':''}>🔄 Em Revisão</option>
                  <option value="cancelado"${orc.status==='cancelado'          ?'selected':''}>✕ Cancelado</option>
                </select>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Descrição / Observações</label>
              <textarea class="form-control" name="descricao" rows="2" placeholder="Descrição do orçamento...">${e(orc.descricao || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Data de Criação</label>
              <input class="form-control" type="date" name="data_criacao" value="${e(orc.data_criacao || hoje)}">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button class="btn btn-primary" data-fb-click="OrcamentoSINAPI.save" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(id || ''))}">
            ${id ? '✔ Salvar Alterações' : '+ Criar Orçamento'}
          </button>
        </div>
      </div>`);
  },

  save(id) {
    const f = document.getElementById('f-sinapi-orc');
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const fd = new FormData(f);
    const d = Object.fromEntries(fd);

    const payload = {
      obra_id: d.obra_id,
      nome: d.nome,
      uf: d.uf,
      referencia_sinapi: d.referencia_sinapi,
      bdi: parseFloat(d.bdi) || this.BDI_PADRAO,
      desonerado: d.desonerado === 'true',
      status: d.status,
      descricao: d.descricao || '',
      data_criacao: d.data_criacao,
    };

    let saved;
    if (id) {
      const existing = this._getById(id);
      saved = { ...existing, ...payload };
      this._save(saved);
      Utils.toast('Orçamento atualizado!', 'success');
    } else {
      saved = { id: DB.uuid(), itens: [], ...payload };
      this._add(saved);
      Utils.toast('Orçamento criado!', 'success');
    }

    Utils.closeModal();
    this._refresh();

    // Se criou novo, abrir o editor
    if (!id) setTimeout(() => this.openEditor(saved.id), 200);
  },

  del(id) {
    Utils.confirm('Excluir este orçamento SINAPI? Esta ação não pode ser desfeita.', () => {
      this._remove(id);
      this._refresh();
      Utils.toast('Orçamento excluído!', 'info');
    });
  },

  // ─────────────────────────────────────────────────
  // Editor de Orçamento — tela completa em modal XL
  // ─────────────────────────────────────────────────

  openEditor(id) {
    this._currentEditor = id;
    const orc = this._getById(id);
    if (!orc) return;
    const cliente = DB.getById('clientes', orc.obra_id);
    const [y, m] = (orc.referencia_sinapi || '').split('-');
    const meses = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const refLabel = `${orc.uf} — ${meses[parseInt(m)]||m}/${y}`;
    const serieLabel = orc.desonerado ? '🟡 Sem Oneração' : '🟢 Com Oneração';
    const baseOk = SINAPI.hasBase(orc.desonerado, orc.uf, orc.referencia_sinapi);

    Utils.showModal(`
      <div class="modal modal-xl" id="sinapi-editor" style="max-width:1100px;width:95vw;max-height:90vh;display:flex;flex-direction:column;">
        <!-- Header -->
        <div class="modal-header" style="flex-shrink:0;">
          <div style="display:flex;flex-direction:column;gap:3px;">
            <span class="modal-title">🏗️ ${Utils.escapeHtml(orc.nome || 'Orçamento SINAPI')}</span>
            <span style="font-size:.74rem;color:var(--text3);">
              👤 ${Utils.escapeHtml(cliente?.nome || '—')} &nbsp;|&nbsp; 📍 ${Utils.escapeHtml(refLabel)} &nbsp;|&nbsp; ${serieLabel} &nbsp;|&nbsp; BDI: ${Number(orc.bdi || 0).toFixed(2)}%
            </span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-secondary btn-sm" data-fb-click="OrcamentoSINAPI.exportExcel" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(id))}" title="Exportar Excel">📊 Excel</button>
            <button class="btn btn-secondary btn-sm" data-fb-click="OrcamentoSINAPI.exportPDF" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(id))}" title="Exportar PDF">📄 PDF</button>
            <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
          </div>
        </div>

        <div class="modal-body" style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:16px;">

          <!-- Busca SINAPI -->
          ${baseOk ? this._renderBusca(orc) : this._renderSemBase(orc)}

          <!-- Planilha do orçamento -->
          <div id="sinapi-planilha-wrap">
            ${this._renderPlanilha(orc)}
          </div>

        </div>
      </div>`);
  },

  _renderSemBase(orc) {
    const serie = orc.desonerado ? 'Sem Oneração (Desonerado)' : 'Com Oneração';
    const uf = String(orc.uf || '').toUpperCase();
    const ref = String(orc.referencia_sinapi || '');
    const snap = SINAPI.snapshotFor(uf, ref, orc.desonerado);
    const exact = Utils.escapeHtml(`${uf || 'UF não definida'} ${ref || 'sem referência'}`);
    return `
    <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:var(--r-md);padding:16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
      <span style="font-size:1.8rem">⚠️</span>
      <div style="flex:1;min-width:240px;">
        <div style="font-weight:700;color:var(--warning);margin-bottom:4px;">Base SINAPI ${exact} não carregada</div>
        <div style="font-size:.8rem;color:var(--text2);">
          Este orçamento usa <strong>${serie}</strong>. ${snap
            ? 'Há um snapshot Caixa empacotado que corresponde exatamente à UF e competência deste orçamento.'
            : 'Esta versão não possui snapshot 1-clique para esta UF/competência. Importe o XLSX/ZIP oficial da Caixa para evitar usar preços de outro estado ou mês.'}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        ${snap ? `<button class="btn btn-primary btn-sm" id="btn-puxar-direto-${Utils.escapeHtml(orc.id)}" data-fb-click="OrcamentoSINAPI.puxarDiretoNoEditor" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(Utils.escapeHtml(orc.id)))}">⚡ Carregar snapshot ${snap.uf} ${snap.referencia}</button>` : ''}
        <button class="btn btn-secondary btn-sm" data-fb-click="Patch26Actions.sinapiReopenImport" data-fb-click-n="3" data-fb-click-t0="auto" data-fb-click-v0="${encodeURIComponent(String(orc.desonerado))}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(Utils.escapeHtml(uf)))}" data-fb-click-t2="string" data-fb-click-v2="${encodeURIComponent(String(Utils.escapeHtml(ref)))}">📁 Importar tabela oficial</button>
      </div>
    </div>`;
  },

  async puxarDiretoNoEditor(orcId) {
    const orc = this._getById(orcId);
    if (!orc) return;
    const btn = document.getElementById(`btn-puxar-direto-${orcId}`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = `⏳ Carregando ${orc.uf} ${orc.referencia_sinapi}...`;
    }
    Utils.toast(`Carregando snapshot SINAPI ${orc.uf} ${orc.referencia_sinapi}...`, 'info');
    const res = await SINAPI.puxarOficial(orc.desonerado, orc.uf, orc.referencia_sinapi, (msg) => {
      if (btn) btn.textContent = `⏳ ${msg}`;
    });
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

  _renderBusca(orc) {
    const meta = SINAPI.getMeta(orc.desonerado, orc.uf, orc.referencia_sinapi);
    return `
    <div style="background:var(--bg-secondary);border-radius:var(--r-md);padding:14px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="font-weight:700;font-size:.85rem;">🔍 Buscar Composição SINAPI</div>
        <div style="font-size:.72rem;color:var(--text3);margin-left:auto;">
          ${(meta?.total || 0).toLocaleString('pt-BR')} itens disponíveis
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <input
          id="sinapi-search-input"
          class="form-control"
          placeholder="Digite o código SINAPI ou palavras da descrição... (ex: 97642, alvenaria, piso)"
          style="flex:1" data-fb-input="OrcamentoSINAPI._onSearch" data-fb-input-n="2" data-fb-input-t0="value" data-fb-input-t1="string" data-fb-input-v1="${encodeURIComponent(String(Utils.escapeHtml(orc.id)))}"
          autocomplete="off"
        >
      </div>
      <div id="sinapi-search-results" style="margin-top:10px;max-height:200px;overflow-y:auto;"></div>
    </div>`;
  },

  _onSearch(termo, orcId) {
    const orc = this._getById(orcId);
    if (!orc) return;
    const el = document.getElementById('sinapi-search-results');
    if (!el) return;
    if (!termo || termo.trim().length < 2) { el.innerHTML = ''; return; }

    const resultados = SINAPI.buscar(termo, orc.desonerado, 30, orc.uf, orc.referencia_sinapi);
    this._lastSearchResults = resultados;
    if (!resultados.length) {
      el.innerHTML = `<div style="padding:10px;color:var(--text3);font-size:.82rem;">Nenhum resultado para "${Utils.escapeHtml(termo)}"</div>`;
      return;
    }

    el.innerHTML = `
    <div style="border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:.78rem;">
        <thead>
          <tr style="background:var(--bg-card);">
            <th style="padding:6px 10px;text-align:left;color:var(--text3);font-weight:600;white-space:nowrap">Código</th>
            <th style="padding:6px 10px;text-align:left;color:var(--text3);font-weight:600;">Descrição</th>
            <th style="padding:6px 10px;text-align:center;color:var(--text3);font-weight:600;white-space:nowrap">Un.</th>
            <th style="padding:6px 10px;text-align:right;color:var(--text3);font-weight:600;white-space:nowrap">Preço Unit.</th>
            <th style="padding:6px 10px;"></th>
          </tr>
        </thead>
        <tbody>
          ${resultados.map((r, i) => `
          <tr style="border-top:1px solid var(--border);${i%2===0?'background:rgba(0,0,0,.1)':''}">
            <td style="padding:6px 10px;font-family:monospace;color:var(--accent2);font-size:.75rem;">${Utils.escapeHtml(r.codigo)}</td>
            <td style="padding:6px 10px;color:var(--text);max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${Utils.escapeHtml(r.descricao)}">${Utils.escapeHtml(r.descricao)}</td>
            <td style="padding:6px 10px;text-align:center;color:var(--text2);">${Utils.escapeHtml(r.unidade)}</td>
            <td style="padding:6px 10px;text-align:right;color:var(--success);font-weight:700;">${Utils.fmt.currency(r.preco_unitario)}</td>
            <td style="padding:6px 10px;text-align:center;">
              <button class="btn btn-primary btn-sm" style="font-size:.7rem;padding:3px 10px;" data-fb-click="Patch26Actions.sinapiAddLastResult" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(i))}">
                + Add
              </button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  },

  showAddItem(orcId, item) {
    this._pendingAddItem = item;
    Utils.showModal(`
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <span class="modal-title">➕ Adicionar Item</span>
          <button class="modal-close" data-fb-click="OrcamentoSINAPI._reopenEditor" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orcId))}">✕</button>
        </div>
        <div class="modal-body">
          <div style="background:var(--bg-secondary);border-radius:var(--r-sm);padding:12px;margin-bottom:16px;">
            <div style="font-family:monospace;font-size:.8rem;color:var(--accent2);margin-bottom:4px;">${item.codigo}</div>
            <div style="font-size:.85rem;color:var(--text);margin-bottom:6px;">${item.descricao}</div>
            <div style="display:flex;gap:16px;font-size:.78rem;color:var(--text2);">
              <span>Unidade: <strong>${item.unidade}</strong></span>
              <span>Preço Unit.: <strong style="color:var(--success)">${Utils.fmt.currency(item.preco_unitario)}</strong></span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Quantidade (${item.unidade})</label>
            <input class="form-control" type="number" id="add-item-qtd" value="1" min="0.001" step="0.001" autofocus data-fb-input="OrcamentoSINAPI._calcPreview" data-fb-input-n="1" data-fb-input-t0="auto" data-fb-input-v0="${encodeURIComponent(String(item.preco_unitario))}">
          </div>
          <div style="background:rgba(201,162,39,.06);border:1px solid rgba(201,162,39,.15);border-radius:var(--r-sm);padding:12px;margin-top:12px;">
            <div style="font-size:.78rem;color:var(--text3);">Total do item:</div>
            <div id="add-item-preview" style="font-size:1.2rem;font-weight:900;color:var(--accent);">${Utils.fmt.currency(item.preco_unitario)}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-fb-click="OrcamentoSINAPI._reopenEditor" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orcId))}">Cancelar</button>
          <button class="btn btn-primary" data-fb-click="OrcamentoSINAPI.addPendingItem" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orcId))}">
            ✔ Adicionar ao Orçamento
          </button>
        </div>
      </div>`);
  },

  addPendingItem(orcId) {
    if (this._pendingAddItem) this.addItem(orcId, this._pendingAddItem);
  },

  _calcPreview(precoUnit) {
    const qtd = parseFloat(document.getElementById('add-item-qtd')?.value) || 0;
    const el = document.getElementById('add-item-preview');
    if (el) el.textContent = Utils.fmt.currency(qtd * precoUnit);
  },

  addItem(orcId, item) {
    const qtd = parseFloat(document.getElementById('add-item-qtd')?.value) || 1;
    const orc = this._getById(orcId);
    if (!orc) return;

    const novoItem = {
      id: DB.uuid(),
      codigo_sinapi: item.codigo,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: Math.round(qtd * 1000) / 1000,
      preco_unitario: item.preco_unitario,
      total: Math.round(qtd * item.preco_unitario * 100) / 100,
    };

    orc.itens = [...(orc.itens || []), novoItem];
    this._save(orc);
    Utils.toast(`"${item.descricao.substring(0, 40)}..." adicionado!`, 'success');
    this._reopenEditor(orcId);
  },

  _renderPlanilha(orc) {
    const itens = orc.itens || [];
    const subtotal = itens.reduce((s, i) => s + (i.total || 0), 0);
    const bdi = orc.bdi || this.BDI_PADRAO;
    const valorBDI = subtotal * bdi / 100;
    const total = subtotal + valorBDI;

    return `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-weight:800;font-size:.9rem;">📋 Planilha Orçamentária</div>
        <div style="font-size:.75rem;color:var(--text3);">${itens.length} item(ns)</div>
      </div>

      <div class="tbl-wrap" style="border:1px solid var(--border);border-radius:var(--r-md);">
        <table>
          <thead>
            <tr>
              <th style="width:90px">Código</th>
              <th>Descrição do Serviço</th>
              <th style="width:55px;text-align:center">Un.</th>
              <th style="width:90px;text-align:right">Quantidade</th>
              <th style="width:110px;text-align:right">Preço Unit.</th>
              <th style="width:120px;text-align:right">Total</th>
              <th style="width:40px"></th>
            </tr>
          </thead>
          <tbody>
            ${itens.length ? itens.map((item, idx) => this._itemRow(orc.id, item, idx)).join('') : `
            <tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3);">
              Nenhum item adicionado. Use a busca acima para encontrar e adicionar serviços SINAPI.
            </td></tr>`}
          </tbody>
          <tfoot>
            <tr style="background:var(--bg-secondary);">
              <td colspan="5" style="text-align:right;font-size:.78rem;color:var(--text3);padding:8px 12px;">Subtotal SINAPI</td>
              <td style="text-align:right;font-weight:800;padding:8px 12px;">${Utils.fmt.currency(subtotal)}</td>
              <td></td>
            </tr>
            <tr style="background:var(--bg-secondary);">
              <td colspan="5" style="text-align:right;font-size:.78rem;color:var(--warning);padding:6px 12px;">BDI (${bdi}%)</td>
              <td style="text-align:right;font-weight:700;color:var(--warning);padding:6px 12px;">+ ${Utils.fmt.currency(valorBDI)}</td>
              <td></td>
            </tr>
            <tr style="background:rgba(201,162,39,.06);">
              <td colspan="5" style="text-align:right;font-size:.85rem;font-weight:900;color:var(--accent);padding:10px 12px;">TOTAL GERAL</td>
              <td style="text-align:right;font-size:1rem;font-weight:900;color:var(--accent);padding:10px 12px;">${Utils.fmt.currency(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`;
  },

  _itemRow(orcId, item, idx) {
    return `
    <tr>
      <td style="font-family:monospace;font-size:.74rem;color:var(--accent2);">${item.codigo_sinapi}</td>
      <td style="max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${item.descricao}">${item.descricao}</td>
      <td style="text-align:center;color:var(--text2);font-size:.8rem;">${item.unidade}</td>
      <td style="text-align:right;">
        <input type="number" value="${item.quantidade}" min="0" step="0.001"
          style="width:80px;text-align:right;background:transparent;border:1px solid transparent;border-radius:4px;color:var(--text);font-family:inherit;font-size:.82rem;padding:2px 6px;" data-fb-focus="Patch26Actions.sinapiFocus" data-fb-focus-n="1" data-fb-focus-t0="self" data-fb-blur="Patch26Actions.sinapiBlur" data-fb-blur-n="3" data-fb-blur-t0="self" data-fb-blur-t1="string" data-fb-blur-v1="${encodeURIComponent(String(orcId))}" data-fb-blur-t2="string" data-fb-blur-v2="${encodeURIComponent(String(item.id))}">
      </td>
      <td style="text-align:right;color:var(--text2);font-size:.82rem;">${Utils.fmt.currency(item.preco_unitario)}</td>
      <td style="text-align:right;font-weight:700;color:var(--success);">${Utils.fmt.currency(item.total)}</td>
      <td style="text-align:center;">
        <button class="icon-btn btn-sm" style="color:var(--danger);font-size:12px;" title="Remover item" data-fb-click="OrcamentoSINAPI.removeItem" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(orcId))}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(item.id))}">🗑️</button>
      </td>
    </tr>`;
  },

  updateQtd(orcId, itemId, novaQtd) {
    const orc = this._getById(orcId);
    if (!orc) return;
    const item = orc.itens.find(i => i.id === itemId);
    if (!item) return;
    const qtd = Math.max(0, parseFloat(novaQtd) || 0);
    item.quantidade = Math.round(qtd * 1000) / 1000;
    item.total = Math.round(qtd * item.preco_unitario * 100) / 100;
    this._save(orc);
    // Atualiza apenas a planilha
    const planWrap = document.getElementById('sinapi-planilha-wrap');
    if (planWrap) planWrap.innerHTML = this._renderPlanilha(orc);
  },

  removeItem(orcId, itemId) {
    const orc = this._getById(orcId);
    if (!orc) return;
    orc.itens = orc.itens.filter(i => i.id !== itemId);
    this._save(orc);
    const planWrap = document.getElementById('sinapi-planilha-wrap');
    if (planWrap) planWrap.innerHTML = this._renderPlanilha(orc);
    Utils.toast('Item removido!', 'info');
  },

  _reopenEditor(id) {
    Utils.closeModal();
    setTimeout(() => this.openEditor(id), 50);
  },

  // ─────────────────────────────────────────────────
  // Modal: Importar Tabela SINAPI
  // ─────────────────────────────────────────────────

  showImportModal(desoneradoInicial = false, ufInicial = '', refInicial = '') {
    const metaOn  = SINAPI.getMeta(false);
    const metaDes = SINAPI.getMeta(true);
    // Disponibiliza o snapshot oficial pré-empacotado no FinObra (RR 2024-12) como padrão inteligente
    const defaultUf = String(ufInicial || this._defaultUF() || 'RR').toUpperCase();
    const defaultRef = refInicial || '2024-12';

    Utils.showModal(`
      <div class="modal" style="max-width:600px">
        <div class="modal-header">
          <span class="modal-title">📁 Importar Tabela SINAPI</span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body">

          <!-- Card Automático 1-Clique Oficial -->
          <div style="background:linear-gradient(135deg, rgba(201,162,39,.12), rgba(16,185,129,.08));border:1.5px solid var(--accent);border-radius:var(--r-md);padding:16px;margin-bottom:18px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <div style="font-weight:700;font-size:.95rem;color:var(--accent);display:flex;align-items:center;gap:6px;">
                <span>⚡</span> Base Oficial SINAPI / Caixa (1-Clique)
              </div>
              <span style="background:var(--accent);color:#000;font-weight:700;font-size:.65rem;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:.5px;">Recomendado</span>
            </div>
            <div style="font-size:.82rem;color:var(--text2);margin-bottom:12px;line-height:1.5;">
              Carregue instantaneamente a base de preços e composições sintéticas oficial da Caixa pré-integrada no FinObra.
            </div>

            <!-- Botão Principal de Ação 1-Clique -->
            <button type="button" class="btn btn-primary" id="btn-puxar-oficial" style="width:100%;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;font-size:.92rem;cursor:pointer;" data-fb-click="OrcamentoSINAPI.puxarOficialAutomatico" data-fb-click-n="0">
              <span>⚡</span> Carregar Base Oficial Caixa RR 12/2024 (1-Clique)
            </button>

            <!-- Chips Rápidos das Bases Inclusas -->
            <div style="margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:.72rem;color:var(--text3);font-weight:600">Bases empacotadas prontas:</span>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size:.72rem;padding:3px 8px;" data-fb-click="OrcamentoSINAPI._useOfficialPreset" data-fb-click-n="3" data-fb-click-t0="string" data-fb-click-v0="RR" data-fb-click-t1="string" data-fb-click-v1="2024-12" data-fb-click-t2="bool" data-fb-click-v2="false">
                🟢 RR 12/2024 (Onerado)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size:.72rem;padding:3px 8px;" data-fb-click="OrcamentoSINAPI._useOfficialPreset" data-fb-click-n="3" data-fb-click-t0="string" data-fb-click-v0="RR" data-fb-click-t1="string" data-fb-click-v1="2024-12" data-fb-click-t2="bool" data-fb-click-v2="true">
                🟡 RR 12/2024 (Desonerado)
              </button>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:12px;margin:16px 0;">
            <div style="flex:1;height:1px;background:var(--border);"></div>
            <span style="font-size:.72rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:600;">ou selecione/importe arquivo manual</span>
            <div style="flex:1;height:1px;background:var(--border);"></div>
          </div>

          <!-- Série -->
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Série de Oneração</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" id="serie-selector">
              <label id="card-onerado" style="cursor:pointer;border:2px solid ${!desoneradoInicial?'var(--accent)':'var(--border)'};border-radius:var(--r-md);padding:12px;background:${!desoneradoInicial?'rgba(201,162,39,.08)':'transparent'};transition:all .2s;" data-fb-click="OrcamentoSINAPI._selectSerie" data-fb-click-n="1" data-fb-click-t0="bool" data-fb-click-v0="false">
                <input type="radio" name="imp-serie" value="false" ${!desoneradoInicial?'checked':''} style="display:none">
                <div style="font-weight:700;margin-bottom:4px;">🟢 Com Oneração</div>
                <div style="font-size:.74rem;color:var(--text3);">Padrão — Contribuição previdenciária normal</div>
                ${metaOn ? `<div style="font-size:.7rem;color:var(--success);margin-top:4px;">✓ Já importada: ${metaOn.uf} Ref.${metaOn.referencia} (${metaOn.total.toLocaleString('pt-BR')} itens)</div>` : ''}
              </label>
              <label id="card-desonerado" style="cursor:pointer;border:2px solid ${desoneradoInicial?'var(--accent)':'var(--border)'};border-radius:var(--r-md);padding:12px;background:${desoneradoInicial?'rgba(201,162,39,.08)':'transparent'};transition:all .2s;" data-fb-click="OrcamentoSINAPI._selectSerie" data-fb-click-n="1" data-fb-click-t0="bool" data-fb-click-v0="true">
                <input type="radio" name="imp-serie" value="true" ${desoneradoInicial?'checked':''} style="display:none">
                <div style="font-weight:700;margin-bottom:4px;">🟡 Sem Oneração</div>
                <div style="font-size:.74rem;color:var(--text3);">Desonerado — Lei 12.546/2011</div>
                ${metaDes ? `<div style="font-size:.7rem;color:var(--success);margin-top:4px;">✓ Já importada: ${metaDes.uf} Ref.${metaDes.referencia} (${metaDes.total.toLocaleString('pt-BR')} itens)</div>` : ''}
              </label>
            </div>
          </div>

          <!-- UF e Referência -->
          <div class="form-row cols-2" style="margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label">Estado (UF)</label>
              <select class="form-control" id="imp-uf" data-fb-change="OrcamentoSINAPI._updateOfficialSnapshotAvailability" data-fb-change-n="0">${Utils.stateOptions(defaultUf)}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Mês de Referência</label>
              <input class="form-control" type="month" id="imp-ref" value="${Utils.escapeHtml(defaultRef)}" data-fb-change="OrcamentoSINAPI._updateOfficialSnapshotAvailability" data-fb-change-n="0">
            </div>
          </div>

          <!-- Upload -->
          <div class="form-group" style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <label class="form-label" style="margin:0">Arquivo XLSX ou ZIP da Caixa (Composições Sintéticas)</label>
              <a href="https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/paginas/default.aspx" target="_blank" rel="noopener noreferrer" style="font-size:.74rem;color:var(--accent);text-decoration:none;font-weight:600;display:flex;align-items:center;gap:4px;">
                <span>🔗</span> Baixar no Portal da Caixa ↗
              </a>
            </div>
            <div id="imp-drop-area" style="border:2px dashed var(--border);border-radius:var(--r-md);padding:24px;text-align:center;cursor:pointer;transition:border-color .2s;" data-fb-click="Patch26Actions.clickById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="imp-file-input"
              ondragover="event.preventDefault();this.style.borderColor='var(--accent)'"
              ondragleave="this.style.borderColor='var(--border)'" data-fb-drop="OrcamentoSINAPI._onDrop" data-fb-drop-n="1" data-fb-drop-t0="event">
              <div style="font-size:2rem;margin-bottom:8px;">📂</div>
              <div style="font-size:.85rem;color:var(--text2);">Arraste a planilha <strong>.xlsx</strong> ou o arquivo <strong>.zip</strong> da Caixa aqui</div>
              <div style="font-size:.74rem;color:var(--text3);margin-top:4px;">Extração automática de composições sintéticas integrada</div>
              <button type="button" class="btn btn-secondary btn-sm" style="margin-top:10px;" data-fb-click="Patch26Actions.clickByIdStop" data-fb-click-n="2" data-fb-click-t0="event" data-fb-click-t1="string" data-fb-click-v1="imp-file-input">Selecionar Arquivo (.xlsx ou .zip)</button>
              <input type="file" id="imp-file-input" accept=".xlsx,.xls,.zip" style="display:none" data-fb-change="Patch26Actions.sinapiFile" data-fb-change-n="1" data-fb-change-t0="self">
            </div>
            <div id="imp-file-name" style="margin-top:8px;font-size:.78rem;color:var(--text3);"></div>
          </div>

          <!-- Progress -->
          <div id="imp-progress" style="display:none;margin-top:12px;">
            <div class="progress-bar" style="height:8px;margin-bottom:8px;"><div id="imp-prog-fill" class="progress-fill blue" style="width:60%;animation:pulse-bar 1s ease-in-out infinite;"></div></div>
            <div id="imp-progress-msg" style="font-size:.78rem;color:var(--text2);text-align:center;"></div>
          </div>
          <div id="imp-result" style="display:none;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Fechar</button>
          <button class="btn btn-primary" id="btn-imp-confirmar" data-fb-click="OrcamentoSINAPI.executarImport" data-fb-click-n="0" disabled>📥 Importar</button>
        </div>
      </div>`);

    setTimeout(() => this._updateOfficialSnapshotAvailability(), 0);

    // Adicionar keyframe de animação se não existir
    if (!document.getElementById('pulse-bar-style')) {
      const s = document.createElement('style');
      s.id = 'pulse-bar-style';
      s.textContent = '@keyframes pulse-bar{0%,100%{opacity:1}50%{opacity:.4}}';
      document.head.appendChild(s);
    }
  },

  _selectSerie(desonerado) {
    const cards = ['card-onerado', 'card-desonerado'];
    cards.forEach((id, idx) => {
      const sel = (idx === 1) === desonerado;
      const el = document.getElementById(id);
      if (!el) return;
      el.style.borderColor = sel ? 'var(--accent)' : 'var(--border)';
      el.style.background  = sel ? 'rgba(201,162,39,.08)' : 'transparent';
      el.querySelector('input').checked = sel;
    });
    this._updateOfficialSnapshotAvailability();
  },

  _updateOfficialSnapshotAvailability() {
    const desonerado = document.querySelector('input[name="imp-serie"]:checked')?.value === 'true';
    const uf = String(document.getElementById('imp-uf')?.value || '').toUpperCase();
    const ref = String(document.getElementById('imp-ref')?.value || '');
    const btn = document.getElementById('btn-puxar-oficial');
    if (!btn) return;
    const snap = SINAPI.snapshotFor(uf, ref, desonerado);
    if (snap) {
      btn.disabled = false;
      btn.className = 'btn btn-primary';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.innerHTML = `<span>⚡</span> Carregar Base Oficial Caixa ${snap.uf} ${snap.referencia} (${desonerado ? 'sem oneração' : 'com oneração'}) — 1-Clique`;
    } else {
      btn.disabled = false;
      btn.className = 'btn btn-primary';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.innerHTML = `<span>⚡</span> Sem snapshot 1-clique para ${uf || 'UF'} ${ref || 'competência'} — Clique para usar RR 12/2024`;
    }
  },

  _useOfficialPreset(uf, ref, desonerado) {
    this._selectSerie(desonerado);
    const ufEl = document.getElementById('imp-uf');
    const refEl = document.getElementById('imp-ref');
    if (ufEl) ufEl.value = uf;
    if (refEl) refEl.value = ref;
    this._updateOfficialSnapshotAvailability();
    this.puxarOficialAutomatico();
  },

  _onDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) this._onFileChange(file);
    document.getElementById('imp-drop-area').style.borderColor = 'var(--border)';
  },

  _onFileChange(file) {
    if (!file) return;
    document.getElementById('imp-file-name').textContent = `📄 ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
    document.getElementById('btn-imp-confirmar').disabled = false;
    this._selectedFile = file;
  },

  _selectedFile: null,

  async puxarOficialAutomatico() {
    let desonerado = document.querySelector('input[name="imp-serie"]:checked')?.value === 'true';
    let uf = String(document.getElementById('imp-uf')?.value || '').toUpperCase();
    let ref = String(document.getElementById('imp-ref')?.value || '');

    let snap = SINAPI.snapshotFor(uf, ref, desonerado);
    if (!snap) {
      // Ajusta para a base oficial Caixa disponível no FinObra
      uf = 'RR';
      ref = '2024-12';
      const ufEl = document.getElementById('imp-uf');
      const refEl = document.getElementById('imp-ref');
      if (ufEl) ufEl.value = uf;
      if (refEl) refEl.value = ref;
      this._updateOfficialSnapshotAvailability();
      snap = SINAPI.snapshotFor(uf, ref, desonerado);
    }

    const btnPuxar = document.getElementById('btn-puxar-oficial');
    const btnConf  = document.getElementById('btn-imp-confirmar');
    const progEl   = document.getElementById('imp-progress');
    const progMsg  = document.getElementById('imp-progress-msg');
    const resEl    = document.getElementById('imp-result');

    if (btnPuxar) {
      btnPuxar.disabled = true;
      btnPuxar.innerHTML = '<span>⏳</span> Baixando Base Oficial da Caixa...';
    }
    if (btnConf) btnConf.disabled = true;
    if (progEl) progEl.style.display = 'block';
    if (resEl) resEl.style.display = 'none';

    const resultado = await SINAPI.puxarOficial(
      desonerado, uf, ref,
      (msg) => {
        if (progMsg) progMsg.textContent = msg;
      }
    );

    if (progEl) progEl.style.display = 'none';
    if (btnPuxar) {
      btnPuxar.disabled = false;
      btnPuxar.innerHTML = '<span>⚡</span> Carregar Base Oficial da Caixa';
    }

    if (resultado.ok) {
      if (resEl) {
        resEl.style.display = 'block';
        resEl.innerHTML = `
          <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.3);border-radius:var(--r-md);padding:14px;display:flex;align-items:center;gap:12px;">
            <span style="font-size:1.5rem">✅</span>
            <div>
              <div style="font-weight:700;color:var(--success);">Tabela Oficial Carregada!</div>
              <div style="font-size:.8rem;color:var(--text2);margin-top:3px;">${Utils.escapeHtml(resultado.msg || '')}</div>
            </div>
          </div>`;
      }
      Utils.toast(resultado.msg, 'success');

      setTimeout(() => {
        Utils.closeModal();
        if (this._currentEditor) {
          this.openEditor(this._currentEditor);
        } else {
          const listEl = document.getElementById('sinapi-orc-list');
          if (listEl) {
            const statusHtml = document.querySelector('#sinapi-editor') ? '' : this.render(App.obraId);
            if (statusHtml) document.getElementById('route-content').innerHTML = statusHtml;
          }
        }
      }, 1200);
    } else {
      if (resEl) {
        resEl.style.display = 'block';
        resEl.innerHTML = `
          <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:var(--r-md);padding:14px;display:flex;align-items:center;gap:12px;">
            <span style="font-size:1.5rem">❌</span>
            <div>
              <div style="font-weight:700;color:var(--danger);">Erro ao carregar tabela oficial</div>
              <div style="font-size:.8rem;color:var(--text2);margin-top:3px;">${Utils.escapeHtml(resultado.msg || '')}</div>
            </div>
          </div>`;
      }
      Utils.toast(resultado.msg || 'Falha ao carregar tabela oficial.', 'error');
    }
  },

  async executarImport() {
    if (!this._selectedFile) { Utils.toast('Selecione um arquivo .xlsx ou .zip primeiro.', 'warning'); return; }

    const desonerado = document.querySelector('input[name="imp-serie"]:checked')?.value === 'true';
    const uf  = document.getElementById('imp-uf').value;
    const ref = document.getElementById('imp-ref').value;

    document.getElementById('btn-imp-confirmar').disabled = true;
    document.getElementById('imp-progress').style.display = 'block';
    document.getElementById('imp-result').style.display = 'none';

    const resultado = await SINAPI.importar(
      this._selectedFile, desonerado, uf, ref,
      (msg) => {
        const el = document.getElementById('imp-progress-msg');
        if (el) el.textContent = msg;
      }
    );

    document.getElementById('imp-progress').style.display = 'none';

    const resEl = document.getElementById('imp-result');
    resEl.style.display = 'block';
    if (resultado.ok) {
      resEl.innerHTML = `
        <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.3);border-radius:var(--r-md);padding:14px;display:flex;align-items:center;gap:12px;">
          <span style="font-size:1.5rem">✅</span>
          <div>
            <div style="font-weight:700;color:var(--success);">Importação concluída!</div>
            <div style="font-size:.8rem;color:var(--text2);margin-top:3px;">${Utils.escapeHtml(resultado.msg || '')}</div>
          </div>
        </div>`;
      Utils.toast(resultado.msg, 'success');
      this._selectedFile = null;
      document.getElementById('btn-imp-confirmar').disabled = true;
      // Atualiza lista
      const listEl = document.getElementById('sinapi-orc-list');
      if (listEl) {
        // Rerender status cards
        const statusHtml = document.querySelector('#sinapi-editor') ? '' : this.render(App.obraId);
        if (statusHtml) document.getElementById('route-content').innerHTML = statusHtml;
      }
    } else {
      resEl.innerHTML = `
        <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:var(--r-md);padding:14px;display:flex;align-items:center;gap:12px;">
          <span style="font-size:1.5rem">❌</span>
          <div>
            <div style="font-weight:700;color:var(--danger);">Erro na importação</div>
            <div style="font-size:.8rem;color:var(--text2);margin-top:3px;">${Utils.escapeHtml(resultado.msg || '')}</div>
          </div>
        </div>`;
      document.getElementById('btn-imp-confirmar').disabled = false;
      Utils.toast('Falha na importação. Verifique o arquivo.', 'error');
    }
  },

  // ─────────────────────────────────────────────────
  // Exportação — PDF
  // ─────────────────────────────────────────────────

  exportPDF(id) {
    const orc = this._getById(id);
    if (!orc) return;
    if (!window.jspdf) { Utils.toast('Biblioteca PDF não carregada. Aguarde e tente novamente.', 'warning'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const cliente = DB.getById('clientes', orc.obra_id);
    const [y, m] = (orc.referencia_sinapi || '').split('-');
    const meses = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const refLabel = `${orc.uf} — ${meses[parseInt(m)]||m}/${y}`;
    const serieLabel = orc.desonerado ? 'Sem Oneração (Desonerado)' : 'Com Oneração';

    const itens = orc.itens || [];
    const subtotal = itens.reduce((s, i) => s + (i.total || 0), 0);
    const bdi = orc.bdi || this.BDI_PADRAO;
    const valorBDI = subtotal * bdi / 100;
    const total = subtotal + valorBDI;

    const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v);
    const fmtN = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits:3, maximumFractionDigits:3 }).format(v);
    const W = 297; const H = 210;
    let y_pos = 15;

    // ── Cabeçalho
    doc.setFillColor(24, 39, 19);
    doc.rect(0, 0, W, 38, 'F');
    doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.setTextColor(232, 200, 74);
    const empNomePdf = (DB.getEmpresa()?.nome_fantasia || DB.getEmpresa()?.razao_social || 'MINHA EMPRESA').toUpperCase();
    doc.text(empNomePdf, 15, 14);
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(200, 200, 200);
    doc.text('Sistema de Orçamentos SINAPI', 15, 21);

    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
    doc.text(orc.nome, 15, 31);
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(168, 192, 144);
    doc.text(`Obra: ${cliente?.nome || '—'} | SINAPI: ${refLabel} | Série: ${serieLabel} | BDI: ${bdi}%`, 15, 37);

    // Data no canto
    doc.setFontSize(7); doc.setTextColor(120, 150, 100);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, W - 15, 37, { align:'right' });

    y_pos = 46;

    // ── Tabela de itens
    const colX  = [15, 45, 175, 198, 220, 248, 275];
    const colW  = [27, 127,  20,  20,  26,  25,   0];
    const heads = ['Código', 'Descrição', 'Un.', 'Qtd.', 'Preço Unit.', 'Total', ''];

    // Cabeçalho da tabela
    doc.setFillColor(36, 53, 24);
    doc.rect(10, y_pos - 4, W - 20, 8, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(232, 200, 74);
    heads.forEach((h, i) => { if(i<6) doc.text(h, colX[i], y_pos, { align: i>=3?'right':'left' }); });
    y_pos += 6;

    // Linhas
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
    itens.forEach((item, idx) => {
      if (y_pos > H - 30) {
        doc.addPage();
        y_pos = 15;
      }
      if (idx % 2 === 0) { doc.setFillColor(18, 30, 12); doc.rect(10, y_pos - 3.5, W - 20, 7, 'F'); }
      doc.setTextColor(180, 220, 160);
      doc.text(item.codigo_sinapi || '', colX[0], y_pos);
      doc.setTextColor(240, 234, 214);
      const desc = item.descricao.length > 80 ? item.descricao.substring(0, 78) + '…' : item.descricao;
      doc.text(desc, colX[1], y_pos);
      doc.setTextColor(160, 192, 144);
      doc.text(item.unidade || '', colX[2], y_pos, { align:'right' });
      doc.setTextColor(240, 234, 214);
      doc.text(fmtN(item.quantidade), colX[3], y_pos, { align:'right' });
      doc.text(fmtR(item.preco_unitario), colX[4], y_pos, { align:'right' });
      doc.setTextColor(16, 185, 129); doc.setFont('helvetica','bold');
      doc.text(fmtR(item.total), colX[5], y_pos, { align:'right' });
      doc.setFont('helvetica','normal');
      y_pos += 7;
    });

    // Linha divisória
    y_pos += 3;
    doc.setDrawColor(36, 53, 24); doc.setLineWidth(0.5);
    doc.line(10, y_pos, W - 10, y_pos);
    y_pos += 6;

    // Totais
    const totRows = [
      ['Subtotal SINAPI', fmtR(subtotal), [200,200,200]],
      [`BDI (${bdi}%)`, `+ ${fmtR(valorBDI)}`, [245, 158, 11]],
      ['TOTAL GERAL', fmtR(total), [232, 200, 74]],
    ];
    totRows.forEach(([label, val, cor]) => {
      doc.setFontSize(label === 'TOTAL GERAL' ? 9 : 8);
      doc.setFont('helvetica', label === 'TOTAL GERAL' ? 'bold' : 'normal');
      doc.setTextColor(...cor);
      doc.text(label, W - 80, y_pos, { align:'right' });
      doc.text(val, W - 12, y_pos, { align:'right' });
      y_pos += 7;
    });

    // Rodapé
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(90,110,80);
      doc.text(`${empNomePdf} — Orçamento SINAPI — ${serieLabel} — Ref. ${refLabel}`, 15, H - 7);
      doc.text(`Pág. ${p}/${pages}`, W - 15, H - 7, { align:'right' });
    }

    doc.save(`Orcamento_SINAPI_${orc.nome.replace(/[^a-zA-Z0-9]/g,'_')}_${orc.uf}_${orc.referencia_sinapi}.pdf`);
    Utils.toast('PDF exportado com sucesso!', 'success');
  },

  // ─────────────────────────────────────────────────
  // Exportação — Excel (SheetJS)
  // ─────────────────────────────────────────────────

  exportExcel(id) {
    const orc = this._getById(id);
    if (!orc) return;
    if (typeof XLSX === 'undefined') { Utils.toast('SheetJS não carregado.', 'warning'); return; }

    const cliente = DB.getById('clientes', orc.obra_id);
    const [y, m] = (orc.referencia_sinapi || '').split('-');
    const meses = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const refLabel = `${orc.uf} - ${meses[parseInt(m)]||m}/${y}`;
    const serieLabel = orc.desonerado ? 'Sem Oneração (Desonerado)' : 'Com Oneração';
    const itens = orc.itens || [];
    const subtotal = itens.reduce((s, i) => s + (i.total || 0), 0);
    const bdi = orc.bdi || this.BDI_PADRAO;
    const valorBDI = subtotal * bdi / 100;
    const total = subtotal + valorBDI;

    // Montar dados da planilha
    const wsData = [
      // Cabeçalho do documento
      [(DB.getEmpresa()?.nome_fantasia || DB.getEmpresa()?.razao_social || 'MINHA EMPRESA').toUpperCase(), '', '', '', '', ''],
      ['Orçamento SINAPI', '', '', '', '', ''],
      [`Nome: ${orc.nome}`, '', '', '', '', ''],
      [`Obra: ${cliente?.nome || '—'}`, '', '', '', `Ref. SINAPI: ${refLabel}`, ''],
      [`Série: ${serieLabel}`, '', '', '', `BDI: ${bdi}%`, ''],
      [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, '', '', '', `Status: ${orc.status || 'ativo'}`, ''],
      [], // linha em branco
      // Cabeçalho da tabela
      ['Código SINAPI', 'Descrição do Serviço', 'Unidade', 'Quantidade', 'Preço Unitário (R$)', 'Total (R$)'],
    ];

    // Itens
    itens.forEach(item => {
      wsData.push([
        item.codigo_sinapi,
        item.descricao,
        item.unidade,
        item.quantidade,
        item.preco_unitario,
        item.total,
      ]);
    });

    // Totalizadores
    wsData.push([]);
    wsData.push(['', '', '', '', 'Subtotal SINAPI (R$)', subtotal]);
    wsData.push(['', '', '', '', `BDI (${bdi}%)`, valorBDI]);
    wsData.push(['', '', '', '', 'TOTAL GERAL (R$)', total]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Larguras das colunas
    ws['!cols'] = [
      { wch: 16 }, { wch: 70 }, { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orçamento SINAPI');

    // Aba auxiliar com metadados
    const wsMeta = XLSX.utils.aoa_to_sheet([
      ['Campo', 'Valor'],
      ['Nome', orc.nome],
      ['Obra', cliente?.nome || '—'],
      ['UF', orc.uf],
      ['Referência SINAPI', orc.referencia_sinapi],
      ['Série', serieLabel],
      ['BDI (%)', orc.bdi],
      ['Status', orc.status],
      ['Data Criação', orc.data_criacao],
      ['Subtotal', subtotal],
      ['Valor BDI', valorBDI],
      ['Total Geral', total],
    ]);
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadados');

    XLSX.writeFile(wb, `Orcamento_SINAPI_${orc.nome.replace(/[^a-zA-Z0-9]/g,'_')}_${orc.uf}_${orc.referencia_sinapi}.xlsx`);
    Utils.toast('Excel exportado com sucesso!', 'success');
  },

  // ─────────────────────────────────────────────────
  // Persistência (chave dedicada no localStorage)
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
      all.push(orc);
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

  // ─────────────────────────────────────────────────
  // Hooks de ciclo de vida (compatível com app.js)
  // ─────────────────────────────────────────────────

  _refresh() {
    const el = document.getElementById('route-content');
    if (el && App.route === 'orcamentos') {
      // Verificar se estamos na sub-aba SINAPI
      const tabSinapi = document.getElementById('tab-sinapi');
      if (tabSinapi?.classList.contains('active')) {
        document.getElementById('sinapi-orc-list').innerHTML = (() => {
          const orcs = this._getAll(App.obraId);
          return orcs.length ? orcs.map(o => this._card(o)).join('') :
            `<div class="empty-state"><h3>Nenhum orçamento SINAPI</h3><button class="btn btn-primary" data-fb-click="OrcamentoSINAPI.showForm" data-fb-click-n="0">+ Novo Orçamento</button></div>`;
        })();
      }
    }
  },

  init() {},
};
