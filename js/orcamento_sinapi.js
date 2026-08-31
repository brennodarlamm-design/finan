// js/orcamento_sinapi.js — UI completa do módulo de Orçamentos SINAPI
// Suporta: criação, edição, busca SINAPI, cálculo com BDI, export PDF e Excel
// UF padrão: RR | BDI padrão TCU edificações: 24,23%

const OrcamentoSINAPI = {

  BDI_PADRAO: 24.23,
  _currentEditor: null, // id do orçamento aberto no editor

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
        <button class="btn btn-secondary btn-sm" onclick="OrcamentoSINAPI.showImportModal()" id="btn-importar-sinapi">
          📁 Importar Tabela SINAPI
        </button>
        <button class="btn btn-primary" onclick="OrcamentoSINAPI.showForm()">+ Novo Orçamento</button>
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
            <button class="btn btn-primary" onclick="OrcamentoSINAPI.showForm()">+ Novo Orçamento</button>
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
      <button class="btn btn-secondary btn-sm" onclick="OrcamentoSINAPI.showImportModal(${desonerado})" style="flex-shrink:0;font-size:.72rem;">
        ${importada ? '🔄 Atualizar' : '📁 Importar'}
      </button>
    </div>`;
  },

  _card(orc) {
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
          <div class="card-title">${orc.nome}</div>
          <div style="font-size:.78rem;color:var(--text3);margin-top:4px;display:flex;align-items:center;gap:12px;">
            <span>👤 ${cliente?.nome || '—'}</span>
            <span>📅 ${Utils.fmt.date(orc.data_criacao)}</span>
            <span>📍 ${refLabel}</span>
            <span>${serieLabel}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${Utils.badge(orc.status || 'ativo')}
          <button class="btn btn-secondary btn-sm" onclick="OrcamentoSINAPI.openEditor('${orc.id}')">🏗️ Abrir</button>
          <button class="icon-btn btn-sm" onclick="OrcamentoSINAPI.showForm('${orc.id}')" title="Editar dados">✏️</button>
          <button class="icon-btn btn-sm" style="color:var(--danger)" onclick="OrcamentoSINAPI.del('${orc.id}')" title="Excluir">🗑️</button>
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

    Utils.showModal(`
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <span class="modal-title">${id ? '✏️ Editar Orçamento' : '🏗️ Novo Orçamento SINAPI'}</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
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
                <input class="form-control" name="nome" value="${orc.nome || ''}" required placeholder="Ex: Orçamento Base — Casa 01">
              </div>
            </div>
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">UF (Estado)</label>
                <select class="form-control" name="uf">
                  ${Utils.stateOptions(orc.uf || 'RR')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Referência SINAPI</label>
                <input class="form-control" type="month" name="referencia_sinapi" value="${refDefault}">
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
              <textarea class="form-control" name="descricao" rows="2" placeholder="Descrição do orçamento...">${orc.descricao || ''}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Data de Criação</label>
              <input class="form-control" type="date" name="data_criacao" value="${orc.data_criacao || hoje}">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="OrcamentoSINAPI.save('${id || ''}')">
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
    const baseOk = SINAPI.hasBase(orc.desonerado);

    Utils.showModal(`
      <div class="modal modal-xl" id="sinapi-editor" style="max-width:1100px;width:95vw;max-height:90vh;display:flex;flex-direction:column;">
        <!-- Header -->
        <div class="modal-header" style="flex-shrink:0;">
          <div style="display:flex;flex-direction:column;gap:3px;">
            <span class="modal-title">🏗️ ${orc.nome}</span>
            <span style="font-size:.74rem;color:var(--text3);">
              👤 ${cliente?.nome || '—'} &nbsp;|&nbsp; 📍 ${refLabel} &nbsp;|&nbsp; ${serieLabel} &nbsp;|&nbsp; BDI: ${orc.bdi}%
            </span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-secondary btn-sm" onclick="OrcamentoSINAPI.exportExcel('${id}')" title="Exportar Excel">📊 Excel</button>
            <button class="btn btn-secondary btn-sm" onclick="OrcamentoSINAPI.exportPDF('${id}')" title="Exportar PDF">📄 PDF</button>
            <button class="modal-close" onclick="Utils.closeModal()">✕</button>
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
    return `
    <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:var(--r-md);padding:16px;display:flex;align-items:center;gap:14px;">
      <span style="font-size:1.8rem">⚠️</span>
      <div style="flex:1">
        <div style="font-weight:700;color:var(--warning);margin-bottom:4px;">Tabela SINAPI não importada</div>
        <div style="font-size:.8rem;color:var(--text2);">
          Este orçamento usa a série <strong>${serie}</strong>. Importe a tabela para buscar e adicionar serviços.
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="Utils.closeModal();OrcamentoSINAPI.showImportModal(${orc.desonerado})">📁 Importar Agora</button>
    </div>`;
  },

  _renderBusca(orc) {
    const meta = SINAPI.getMeta(orc.desonerado);
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
          style="flex:1"
          oninput="OrcamentoSINAPI._onSearch(this.value, ${orc.desonerado})"
          autocomplete="off"
        >
      </div>
      <div id="sinapi-search-results" style="margin-top:10px;max-height:200px;overflow-y:auto;"></div>
    </div>`;
  },

  _onSearch(termo, desonerado) {
    const el = document.getElementById('sinapi-search-results');
    if (!el) return;
    if (!termo || termo.trim().length < 2) { el.innerHTML = ''; return; }

    const resultados = SINAPI.buscar(termo, desonerado, 30);
    if (!resultados.length) {
      el.innerHTML = `<div style="padding:10px;color:var(--text3);font-size:.82rem;">Nenhum resultado para "${termo}"</div>`;
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
            <td style="padding:6px 10px;font-family:monospace;color:var(--accent2);font-size:.75rem;">${r.codigo}</td>
            <td style="padding:6px 10px;color:var(--text);max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.descricao}">${r.descricao}</td>
            <td style="padding:6px 10px;text-align:center;color:var(--text2);">${r.unidade}</td>
            <td style="padding:6px 10px;text-align:right;color:var(--success);font-weight:700;">${Utils.fmt.currency(r.preco_unitario)}</td>
            <td style="padding:6px 10px;text-align:center;">
              <button class="btn btn-primary btn-sm" style="font-size:.7rem;padding:3px 10px;"
                onclick="OrcamentoSINAPI.showAddItem('${this._currentEditor}', ${JSON.stringify(r).replace(/'/g, "\\'").replace(/"/g, '&quot;')})">
                + Add
              </button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  },

  showAddItem(orcId, item) {
    Utils.showModal(`
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <span class="modal-title">➕ Adicionar Item</span>
          <button class="modal-close" onclick="OrcamentoSINAPI._reopenEditor('${orcId}')">✕</button>
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
            <input class="form-control" type="number" id="add-item-qtd" value="1" min="0.001" step="0.001" autofocus
              oninput="OrcamentoSINAPI._calcPreview(${item.preco_unitario})">
          </div>
          <div style="background:rgba(201,162,39,.06);border:1px solid rgba(201,162,39,.15);border-radius:var(--r-sm);padding:12px;margin-top:12px;">
            <div style="font-size:.78rem;color:var(--text3);">Total do item:</div>
            <div id="add-item-preview" style="font-size:1.2rem;font-weight:900;color:var(--accent);">${Utils.fmt.currency(item.preco_unitario)}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="OrcamentoSINAPI._reopenEditor('${orcId}')">Cancelar</button>
          <button class="btn btn-primary" onclick="OrcamentoSINAPI.addItem('${orcId}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">
            ✔ Adicionar ao Orçamento
          </button>
        </div>
      </div>`);
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
          style="width:80px;text-align:right;background:transparent;border:1px solid transparent;border-radius:4px;color:var(--text);font-family:inherit;font-size:.82rem;padding:2px 6px;"
          onfocus="this.style.borderColor='var(--accent)';this.style.background='var(--bg-card)'"
          onblur="this.style.borderColor='transparent';this.style.background='transparent';OrcamentoSINAPI.updateQtd('${orcId}','${item.id}',this.value)">
      </td>
      <td style="text-align:right;color:var(--text2);font-size:.82rem;">${Utils.fmt.currency(item.preco_unitario)}</td>
      <td style="text-align:right;font-weight:700;color:var(--success);">${Utils.fmt.currency(item.total)}</td>
      <td style="text-align:center;">
        <button class="icon-btn btn-sm" style="color:var(--danger);font-size:12px;" title="Remover item"
          onclick="OrcamentoSINAPI.removeItem('${orcId}','${item.id}')">🗑️</button>
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

  showImportModal(desoneradoInicial = false) {
    const metaOn  = SINAPI.getMeta(false);
    const metaDes = SINAPI.getMeta(true);

    Utils.showModal(`
      <div class="modal" style="max-width:600px">
        <div class="modal-header">
          <span class="modal-title">📁 Importar Tabela SINAPI</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">

          <!-- Instrução -->
          <div style="background:rgba(201,162,39,.06);border:1px solid rgba(201,162,39,.15);border-radius:var(--r-md);padding:14px;margin-bottom:18px;font-size:.82rem;color:var(--text2);line-height:1.7;">
            <strong style="color:var(--accent);">Como obter a tabela:</strong><br>
            1. Acesse <a href="https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi" target="_blank" style="color:var(--accent2);">portal.caixa.gov.br/sinapi</a><br>
            2. Selecione o estado <strong>RR</strong> e o mês de referência<br>
            3. Baixe o arquivo ZIP e extraia o <strong>.xlsx de Composições Sintéticas</strong><br>
            4. Selecione a série (Com ou Sem Oneração) e importe abaixo
          </div>

          <!-- Série -->
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Série de Oneração</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" id="serie-selector">
              <label id="card-onerado" style="cursor:pointer;border:2px solid ${!desoneradoInicial?'var(--accent)':'var(--border)'};border-radius:var(--r-md);padding:12px;background:${!desoneradoInicial?'rgba(201,162,39,.08)':'transparent'};transition:all .2s;" onclick="OrcamentoSINAPI._selectSerie(false)">
                <input type="radio" name="imp-serie" value="false" ${!desoneradoInicial?'checked':''} style="display:none">
                <div style="font-weight:700;margin-bottom:4px;">🟢 Com Oneração</div>
                <div style="font-size:.74rem;color:var(--text3);">Padrão — Contribuição previdenciária normal</div>
                ${metaOn ? `<div style="font-size:.7rem;color:var(--success);margin-top:4px;">✓ Já importada: ${metaOn.uf} Ref.${metaOn.referencia} (${metaOn.total.toLocaleString('pt-BR')} itens)</div>` : ''}
              </label>
              <label id="card-desonerado" style="cursor:pointer;border:2px solid ${desoneradoInicial?'var(--accent)':'var(--border)'};border-radius:var(--r-md);padding:12px;background:${desoneradoInicial?'rgba(201,162,39,.08)':'transparent'};transition:all .2s;" onclick="OrcamentoSINAPI._selectSerie(true)">
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
              <select class="form-control" id="imp-uf">${Utils.stateOptions('RR')}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Mês de Referência</label>
              <input class="form-control" type="month" id="imp-ref" value="${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}">
            </div>
          </div>

          <!-- Upload -->
          <div class="form-group" style="margin-bottom:8px;">
            <label class="form-label">Arquivo XLSX (Composições Sintéticas)</label>
            <div id="imp-drop-area" style="border:2px dashed var(--border);border-radius:var(--r-md);padding:28px;text-align:center;cursor:pointer;transition:border-color .2s;"
              ondragover="event.preventDefault();this.style.borderColor='var(--accent)'"
              ondragleave="this.style.borderColor='var(--border)'"
              ondrop="OrcamentoSINAPI._onDrop(event)">
              <div style="font-size:2rem;margin-bottom:8px;">📂</div>
              <div style="font-size:.85rem;color:var(--text2);">Arraste o arquivo .xlsx aqui ou</div>
              <button class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="document.getElementById('imp-file-input').click()">Selecionar Arquivo</button>
              <input type="file" id="imp-file-input" accept=".xlsx,.xls" style="display:none" onchange="OrcamentoSINAPI._onFileChange(this.files[0])">
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
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Fechar</button>
          <button class="btn btn-primary" id="btn-imp-confirmar" onclick="OrcamentoSINAPI.executarImport()" disabled>📥 Importar</button>
        </div>
      </div>`);

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

  async executarImport() {
    if (!this._selectedFile) { Utils.toast('Selecione um arquivo .xlsx primeiro.', 'warning'); return; }

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
            <div style="font-size:.8rem;color:var(--text2);margin-top:3px;">${resultado.msg}</div>
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
            <div style="font-size:.8rem;color:var(--text2);margin-top:3px;">${resultado.msg}</div>
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
    doc.text('ANGELIM CONSTRUTORA', 15, 14);
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
      doc.text(`Angelim Construtora — Orçamento SINAPI — ${serieLabel} — Ref. ${refLabel}`, 15, H - 7);
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
      ['ANGELIM CONSTRUTORA', '', '', '', '', ''],
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

  _getAll(obraId) {
    try {
      const all = JSON.parse(localStorage.getItem(this._KEY) || '[]');
      if (!obraId || obraId === 'todas') return all;
      return all.filter(o => o.obra_id === obraId);
    } catch { return []; }
  },

  _getById(id) {
    try {
      const all = JSON.parse(localStorage.getItem(this._KEY) || '[]');
      return all.find(o => o.id === id) || null;
    } catch { return null; }
  },

  _add(orc) {
    try {
      const all = JSON.parse(localStorage.getItem(this._KEY) || '[]');
      all.push(orc);
      localStorage.setItem(this._KEY, JSON.stringify(all));
    } catch(e) { console.error('OrcamentoSINAPI._add', e); }
  },

  _save(orc) {
    try {
      const all = JSON.parse(localStorage.getItem(this._KEY) || '[]');
      const idx = all.findIndex(o => o.id === orc.id);
      if (idx !== -1) all[idx] = orc;
      else all.push(orc);
      localStorage.setItem(this._KEY, JSON.stringify(all));
    } catch(e) { console.error('OrcamentoSINAPI._save', e); }
  },

  _remove(id) {
    try {
      const all = JSON.parse(localStorage.getItem(this._KEY) || '[]').filter(o => o.id !== id);
      localStorage.setItem(this._KEY, JSON.stringify(all));
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
            `<div class="empty-state"><h3>Nenhum orçamento SINAPI</h3><button class="btn btn-primary" onclick="OrcamentoSINAPI.showForm()">+ Novo Orçamento</button></div>`;
        })();
      }
    }
  },

  init() {},
};
