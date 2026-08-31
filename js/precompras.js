// js/precompras.js — Módulo de Ordens de Pré-Compra & Controle de Pedidos com Aprovação do Administrador

const PreCompras = {
  _itensTemp: [],

  init(obraId) {
    this._bindFilters();
  },

  render(obraId) {
    const resumo = DB.getPreComprasResumo(obraId);
    const precompras = DB.getPreCompras(obraId);
    const user = Auth.getUser();
    const isAdmin = user?.perfil === 'admin';
    const showObra = obraId === 'todas';

    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">🛒 Ordens de Pré-Compra</h1>
        <p class="page-sub">Controle de requisições de compras, materiais e serviços com autorização da diretoria/administrador</p>
      </div>
      <div class="page-actions" style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="PreCompras.showForm()">
          + Nova Pré-Compra
        </button>
      </div>
    </div>

    ${isAdmin && resumo.pendentesQtd > 0 ? `
    <div class="card" style="background:linear-gradient(135deg,rgba(245,158,11,.15),rgba(201,162,39,.12));border:1px solid rgba(245,158,11,.4);margin-bottom:16px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="font-size:1.8rem;background:rgba(245,158,11,.2);width:46px;height:46px;border-radius:10px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(245,158,11,.4);">
          ⏳
        </div>
        <div>
          <strong style="color:var(--accent2);font-size:.95rem;">Atenção Administrador:</strong>
          <div style="font-size:.84rem;color:var(--text);margin-top:2px;">
            Existem <strong>${resumo.pendentesQtd} ordens de pré-compra</strong> aguardando sua autorização (${Utils.fmt.currency(resumo.pendentesValor)}).
          </div>
        </div>
      </div>
      <button class="btn btn-warning btn-sm" onclick="PreCompras.filtrarPendentes()" style="font-weight:700;">
        ⚡ Ver Pedidos Pendentes (${resumo.pendentesQtd})
      </button>
    </div>` : ''}

    <div class="g4" style="margin-bottom:16px;">
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">Total de Pedidos</div>
        <div class="kpi-value cyan" style="font-size:1.25rem">${resumo.totalQtd} <span style="font-size:.78rem;font-weight:500;color:var(--text3);">(${Utils.fmt.currency(resumo.totalValor)})</span></div>
      </div>
      <div class="kpi-card" style="padding:14px;border:1px solid rgba(245,158,11,.3);">
        <div class="kpi-label">Aguardando Aprovação</div>
        <div class="kpi-value yellow" style="font-size:1.25rem">${resumo.pendentesQtd} <span style="font-size:.78rem;font-weight:500;color:var(--text3);">(${Utils.fmt.currency(resumo.pendentesValor)})</span></div>
      </div>
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">Aprovadas / Ativas</div>
        <div class="kpi-value green" style="font-size:1.25rem">${resumo.aprovadasQtd} <span style="font-size:.78rem;font-weight:500;color:var(--text3);">(${Utils.fmt.currency(resumo.aprovadasValor)})</span></div>
      </div>
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">Despesas Geradas</div>
        <div class="kpi-value blue" style="font-size:1.25rem">${resumo.convertidasQtd} <span style="font-size:.78rem;font-weight:500;color:var(--text3);">(${Utils.fmt.currency(resumo.convertidasValor)})</span></div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="filters-bar">
      <div class="filter-group" style="flex:1">
        <label class="filter-label">Buscar Pedido</label>
        <div class="search-bar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="form-control" id="pc-search" placeholder="Nº pedido, descrição, fornecedor, item..." oninput="PreCompras.aplicarFiltros()">
        </div>
      </div>
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="form-control" id="pc-status" style="min-width:140px" onchange="PreCompras.aplicarFiltros()">
          <option value="">Todos</option>
          <option value="pendente_aprovacao">⏳ Aguardando Aprovação</option>
          <option value="aprovada">✓ Aprovada</option>
          <option value="convertida">💰 Despesa Gerada</option>
          <option value="rejeitada">✕ Rejeitada</option>
          <option value="cancelada">🚫 Cancelada</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Prioridade</label>
        <select class="form-control" id="pc-prioridade" style="min-width:120px" onchange="PreCompras.aplicarFiltros()">
          <option value="">Todas</option>
          <option value="urgente">🔴 Urgente</option>
          <option value="alta">🟠 Alta</option>
          <option value="normal">🔵 Normal</option>
          <option value="baixa">🟢 Baixa</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Categoria</label>
        <select class="form-control" id="pc-cat" style="min-width:130px" onchange="PreCompras.aplicarFiltros()">
          <option value="">Todas</option>
          <option value="material">🧱 Material</option>
          <option value="mao_de_obra">👷 Mão de Obra</option>
          <option value="servico">🔧 Serviço</option>
          <option value="equipamento">🏗️ Equipamento</option>
          <option value="taxa">📋 Taxa/Imposto</option>
          <option value="outro">📦 Outros</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Período</label>
        <div style="display:flex;gap:5px">
          <input class="form-control" type="date" id="pc-di" style="width:125px" title="Data inicial" onchange="PreCompras.aplicarFiltros()">
          <input class="form-control" type="date" id="pc-df" style="width:125px" title="Data final" onchange="PreCompras.aplicarFiltros()">
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="PreCompras.limparFiltros()" style="align-self:flex-end">Limpar</button>
    </div>

    <!-- Tabela de Pedidos -->
    <div class="card" style="padding:0;">
      <div class="tbl-wrap" style="border:none;border-radius:14px;">
        <table>
          <thead>
            <tr>
              <th>Nº Ordem</th>
              <th>Data</th>
              <th>Necessidade</th>
              ${showObra ? '<th>Obra / Cliente</th>' : ''}
              <th>Descrição do Pedido</th>
              <th>Categoria</th>
              <th>Fornecedor Sugerido</th>
              <th>Solicitante</th>
              <th style="text-align:center;">Itens</th>
              <th style="text-align:right;">Valor Total</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th title="Anexos / Nota Fiscal" style="text-align:center;">📎 NF/Docs</th>
              <th style="text-align:center;">Ações</th>
            </tr>
          </thead>
          <tbody id="t-precompras-body">
            ${this._renderRows(precompras, showObra)}
          </tbody>
          <tfoot id="t-precompras-foot">
            <tr>${this._renderFoot(precompras, showObra)}</tr>
          </tfoot>
        </table>
      </div>
    </div>`;
  },

  _renderRows(list, showObra) {
    const colsCount = showObra ? 14 : 13;
    if (!list.length) {
      return `<tr><td colspan="${colsCount}" style="text-align:center;padding:40px;color:var(--text3);">Nenhuma ordem de pré-compra encontrada com os filtros selecionados.</td></tr>`;
    }

    const cs = DB.getAll('clientes');
    const user = Auth.getUser();
    const isAdmin = user?.perfil === 'admin';

    return list.map(p => {
      const c = cs.find(x => x.id === p.obra_id);
      const clipBadge = typeof Documentos !== 'undefined' ? Documentos.badgeClip('precompra', p.id, { titulo: `Ordem ${p.numero_ordem} — ${p.descricao}` }) : '📎';
      const itensCount = p.itens ? p.itens.length : 0;
      const isPendente = p.status === 'pendente_aprovacao';
      const isAprovada = p.status === 'aprovada';

      return `
      <tr>
        <td style="font-weight:800;color:var(--accent2);font-family:monospace;white-space:nowrap;">
          <a href="javascript:void(0)" onclick="PreCompras.visualizarOrdem('${p.id}')" title="Visualizar Ordem de Compra Completa" style="color:var(--accent2);text-decoration:underline;">
            ${p.numero_ordem}
          </a>
        </td>
        <td style="white-space:nowrap;font-size:.78rem;font-weight:600;">${Utils.fmt.date(p.data_solicitacao)}</td>
        <td style="white-space:nowrap;font-size:.78rem;color:var(--text2);">${p.data_necessidade ? Utils.fmt.date(p.data_necessidade) : '—'}</td>
        ${showObra ? `<td style="font-size:.76rem;color:var(--text2);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c?.nome||''}">${c?.nome||'—'}</td>` : ''}
        <td>
          <div style="font-weight:700;color:var(--text);">${p.descricao}</div>
          ${p.justificativa ? `<div style="font-size:.72rem;color:var(--text3);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.justificativa}">🎯 ${p.justificativa}</div>` : ''}
          ${p.motivo_recusa ? `<div style="font-size:.72rem;color:var(--danger);font-weight:600;">❌ Motivo recusa: ${p.motivo_recusa}</div>` : ''}
          ${p.parecer_admin ? `<div style="font-size:.72rem;color:var(--success);font-weight:600;">💬 Admin: ${p.parecer_admin}</div>` : ''}
        </td>
        <td style="white-space:nowrap;font-size:.78rem;">${Utils.catLabel(p.categoria)}</td>
        <td style="font-size:.78rem;color:var(--text2);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          <strong>${p.fornecedor_nome || '—'}</strong>
          ${p.fornecedor_contato ? `<div style="font-size:.7rem;color:var(--text3);">${p.fornecedor_contato}</div>` : ''}
        </td>
        <td style="font-size:.78rem;color:var(--text3);white-space:nowrap;">${p.solicitante_nome || 'Gestor'}</td>
        <td style="text-align:center;font-weight:700;font-size:.82rem;">${itensCount}</td>
        <td style="text-align:right;font-weight:900;white-space:nowrap;color:var(--accent2);font-size:.9rem;">
          ${Utils.fmt.currency(p.valor_total)}
        </td>
        <td>${Utils.prioridadeBadge(p.prioridade)}</td>
        <td>${Utils.badge(p.status)}</td>
        <td style="text-align:center;">${clipBadge}</td>
        <td style="text-align:center;white-space:nowrap;">
          <div style="display:flex;gap:4px;justify-content:center;align-items:center;">
            <button class="icon-btn" onclick="PreCompras.visualizarOrdem('${p.id}')" title="Visualizar & Imprimir Folha de Ordem de Compra" style="font-size:14px;color:var(--accent2);">
              📄
            </button>
            <button class="icon-btn" onclick="PreCompras.abrirAnexosNotaFiscal('${p.id}')" title="Anexar ou Visualizar Nota Fiscal / Documentos" style="font-size:14px;">
              📎
            </button>
            ${isAdmin && isPendente ? `
            <button class="btn btn-sm btn-success" onclick="PreCompras.abrirModalAprovacao('${p.id}')" title="Aprovar esta pré-compra" style="font-size:.72rem;padding:3px 8px;">
              ✓ Aprovar
            </button>
            <button class="btn btn-sm btn-danger" onclick="PreCompras.abrirModalRejeicao('${p.id}')" title="Recusar pré-compra com justificativa" style="font-size:.72rem;padding:3px 8px;">
              ✕ Recusar
            </button>` : ''}
            ${isAprovada ? `
            <button class="btn btn-sm btn-primary" onclick="PreCompras.converterEmLancamentoModal('${p.id}')" title="Gerar Lançamento Financeiro / Despesa na Obra" style="font-size:.72rem;padding:3px 8px;background:linear-gradient(135deg,#0284c7,#0369a1);border:none;">
              💰 Gerar Despesa
            </button>` : ''}
            ${isPendente ? `
            <button class="icon-btn" onclick="PreCompras.showForm('${p.id}')" title="Editar Pedido" style="font-size:13px;">
              ✏️
            </button>` : ''}
            ${isAdmin || isPendente ? `
            <button class="icon-btn" onclick="PreCompras.excluir('${p.id}')" title="Excluir Ordem" style="font-size:13px;color:var(--danger);">
              🗑️
            </button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  _renderFoot(list, showObra) {
    const cols = showObra ? 14 : 13;
    const total = list.reduce((s, p) => s + (p.valor_total || 0), 0);
    return `
    <td colspan="${cols - 5}" style="font-weight:700;color:var(--text3);font-size:.78rem;">
      TOTAL FILTRADO (${list.length} ordens de pré-compra)
    </td>
    <td colspan="5" style="text-align:right;font-weight:900;color:var(--accent2);font-size:.95rem;white-space:nowrap;padding-right:20px;">
      ${Utils.fmt.currency(total)}
    </td>`;
  },

  _bindFilters() {
    // Already bound via oninput/onchange in template
  },

  aplicarFiltros() {
    const search = document.getElementById('pc-search')?.value || '';
    const status = document.getElementById('pc-status')?.value || '';
    const prioridade = document.getElementById('pc-prioridade')?.value || '';
    const categoria = document.getElementById('pc-cat')?.value || '';
    const dataInicio = document.getElementById('pc-di')?.value || '';
    const dataFim = document.getElementById('pc-df')?.value || '';

    const list = DB.getPreCompras(App.obraId, {
      search, status, prioridade, categoria, dataInicio, dataFim
    });

    const tbody = document.getElementById('t-precompras-body');
    const tfoot = document.getElementById('t-precompras-foot');
    const showObra = App.obraId === 'todas';

    if (tbody) tbody.innerHTML = this._renderRows(list, showObra);
    if (tfoot) tfoot.innerHTML = `<tr>${this._renderFoot(list, showObra)}</tr>`;
  },

  limparFiltros() {
    if (document.getElementById('pc-search')) document.getElementById('pc-search').value = '';
    if (document.getElementById('pc-status')) document.getElementById('pc-status').value = '';
    if (document.getElementById('pc-prioridade')) document.getElementById('pc-prioridade').value = '';
    if (document.getElementById('pc-cat')) document.getElementById('pc-cat').value = '';
    if (document.getElementById('pc-di')) document.getElementById('pc-di').value = '';
    if (document.getElementById('pc-df')) document.getElementById('pc-df').value = '';
    this.aplicarFiltros();
  },

  filtrarPendentes() {
    const statusEl = document.getElementById('pc-status');
    if (statusEl) {
      statusEl.value = 'pendente_aprovacao';
      this.aplicarFiltros();
    }
  },

  _proximoNumeroOrdem() {
    const all = DB.getAll('precompras');
    const ano = new Date().getFullYear();
    const seq = String(all.length + 1).padStart(4, '0');
    return `PC-${ano}-${seq}`;
  },

  // ─────────────────────────────────────────────────────────────
  // FORMULÁRIO DE CRIAÇÃO E EDIÇÃO DE PRÉ-COMPRA
  // ─────────────────────────────────────────────────────────────
  showForm(id = null) {
    const item = id ? DB.getById('precompras', id) : null;
    const isEdit = !!item;
    const user = Auth.getUser();
    const obraIdPadrao = App.obraId !== 'todas' ? App.obraId : (item?.obra_id || '');

    this._itensTemp = item?.itens ? JSON.parse(JSON.stringify(item.itens)) : [
      { id: 'it_' + Date.now(), descricao: '', unidade: 'un', quantidade: 1, valor_unitario: 0, subtotal: 0 }
    ];

    Utils.showModal(`
      <div class="modal" style="max-width:850px;width:95vw;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">🛒</span>
            <div>
              <div class="modal-title">${isEdit ? 'Editar Ordem de Pré-Compra' : 'Nova Ordem de Pré-Compra / Pedido'}</div>
              <div style="font-size:.75rem;color:var(--text3);">Ordem gerada para análise e autorização pelo Administrador</div>
            </div>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>

        <form id="form-precompra" onsubmit="PreCompras.salvar(event, '${id || ''}')" style="display:flex;flex-direction:column;flex:1;overflow:hidden;">
          <div class="modal-body" style="padding:20px;overflow-y:auto;flex:1;">
            
            <!-- Linha 1: Número, Obra, Solicitante -->
            <div class="g3" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Nº da Ordem</label>
                <input class="form-control" name="numero_ordem" value="${item?.numero_ordem || this._proximoNumeroOrdem()}" readonly style="background:rgba(0,0,0,0.3);font-family:monospace;font-weight:800;color:var(--accent2);">
              </div>
              <div class="form-group">
                <label class="form-label">Obra / Cliente *</label>
                <select class="form-control" name="obra_id" required>
                  ${Utils.clienteOptions(obraIdPadrao, 'Selecione a obra de destino...')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Solicitante</label>
                <input class="form-control" name="solicitante_nome" value="${item?.solicitante_nome || user?.nome || 'Gestor'}" required>
              </div>
            </div>

            <!-- Linha 2: Descrição Geral, Categoria, Prioridade -->
            <div class="g3" style="margin-bottom:14px;">
              <div class="form-group" style="grid-column: span 1;">
                <label class="form-label">Título / Descrição Resumida *</label>
                <input class="form-control" name="descricao" value="${item?.descricao || ''}" placeholder="Ex: Compra de Aço para Vigamento" required>
              </div>
              <div class="form-group">
                <label class="form-label">Categoria *</label>
                <select class="form-control" name="categoria" required>
                  <option value="material" ${item?.categoria==='material'?'selected':''}>🧱 Material</option>
                  <option value="mao_de_obra" ${item?.categoria==='mao_de_obra'?'selected':''}>👷 Mão de Obra</option>
                  <option value="servico" ${item?.categoria==='servico'?'selected':''}>🔧 Serviço</option>
                  <option value="equipamento" ${item?.categoria==='equipamento'?'selected':''}>🏗️ Equipamento</option>
                  <option value="taxa" ${item?.categoria==='taxa'?'selected':''}>📋 Taxa / Imposto</option>
                  <option value="outro" ${item?.categoria==='outro'?'selected':''}>📦 Outros</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Prioridade *</label>
                <select class="form-control" name="prioridade" required>
                  <option value="normal" ${item?.prioridade==='normal'?'selected':''}>🔵 Normal</option>
                  <option value="urgente" ${item?.prioridade==='urgente'?'selected':''}>🔴 Urgente</option>
                  <option value="alta" ${item?.prioridade==='alta'?'selected':''}>🟠 Alta</option>
                  <option value="baixa" ${item?.prioridade==='baixa'?'selected':''}>🟢 Baixa</option>
                </select>
              </div>
            </div>

            <!-- Linha 3: Fornecedor, CNPJ, Datas -->
            <div class="g4" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Fornecedor Sugerido</label>
                <div style="display:flex;gap:6px;align-items:center;">
                  <select class="form-control" id="pc-forn-sel" onchange="PreCompras._onFornecedorChange(this)" style="flex:1;">
                    ${typeof Fornecedores !== 'undefined' ? Fornecedores.fornecedorOptions(item?.fornecedor_nome||'') : '<option value="">Nenhum fornecedor</option>'}
                  </select>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="Fornecedores.showForm()" title="Cadastrar novo" style="white-space:nowrap;font-size:.74rem;padding:6px 10px;">+ Novo</button>
                </div>
                <input class="form-control" name="fornecedor_nome" id="pc-forn-manual" value="${item?.fornecedor_nome||''}" placeholder="Ou digite o nome do fornecedor" style="margin-top:6px;display:${item?.fornecedor_nome && !(typeof Fornecedores !== 'undefined' && Fornecedores.getByNome(item?.fornecedor_nome)) ? 'block' : 'none'};">
              </div>
              <div class="form-group">
                <label class="form-label">CNPJ / CPF Fornecedor</label>
                <input class="form-control" name="fornecedor_cnpj" id="pc-forn-cnpj" value="${item?.fornecedor_cnpj || ''}" placeholder="00.000.000/0000-00">
              </div>
              <div class="form-group">
                <label class="form-label">Data Solicitação</label>
                <input class="form-control" type="date" name="data_solicitacao" value="${item?.data_solicitacao || Utils.today()}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Necessidade / Entrega</label>
                <input class="form-control" type="date" name="data_necessidade" value="${item?.data_necessidade || ''}">
              </div>
            </div>

            <!-- Linha 4: Forma de Pagamento e Justificativa -->
            <div class="g2" style="margin-bottom:18px;">
              <div class="form-group">
                <label class="form-label">Condição / Forma de Pagamento Prevista</label>
                <input class="form-control" name="forma_pagamento" value="${item?.forma_pagamento || ''}" placeholder="Ex: Boleto 28 DDL, Pix à Vista, 3x no Cartão">
              </div>
              <div class="form-group">
                <label class="form-label">Justificativa / Aplicação na Obra</label>
                <input class="form-control" name="justificativa" value="${item?.justificativa || ''}" placeholder="Ex: Execução da etapa 2 de fundação e pilares">
              </div>
            </div>

            <!-- TABELA DINÂMICA DE ITENS DO PEDIDO -->
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:18px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <strong style="font-size:.9rem;color:var(--text);">📋 Itens e Insumos do Pedido</strong>
                  <span style="font-size:.72rem;color:var(--text3);">(Quantidades e valores unitários estimados)</span>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="PreCompras.adicionarLinhaItem()" style="font-size:.76rem;">
                  + Adicionar Item
                </button>
              </div>

              <div class="tbl-wrap" style="border:none;max-height:220px;overflow-y:auto;">
                <table style="font-size:.82rem;">
                  <thead>
                    <tr style="background:var(--bg-card);">
                      <th style="width:40%;">Descrição do Item / Insumo *</th>
                      <th style="width:15%;">Unidade</th>
                      <th style="width:15%;">Quantidade *</th>
                      <th style="width:15%;">Valor Unit. (R$) *</th>
                      <th style="width:15%;text-align:right;">Subtotal</th>
                      <th style="width:30px;"></th>
                    </tr>
                  </thead>
                  <tbody id="pc-itens-tbody">
                    ${this._renderItensTbody()}
                  </tbody>
                </table>
              </div>

              <div style="display:flex;justify-content:flex-end;align-items:center;gap:14px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
                <span style="font-size:.85rem;color:var(--text2);font-weight:700;">VALOR TOTAL DA PRÉ-COMPRA:</span>
                <span id="pc-total-display" style="font-size:1.3rem;font-weight:900;color:var(--accent2);font-family:monospace;">
                  ${Utils.fmt.currency(this._calcularTotalTemp())}
                </span>
              </div>
            </div>

            <!-- SEÇÃO DE ANEXO DE NOTA FISCAL / COTAÇÕES -->
            <div style="background:rgba(201,162,39,.04);border:1px solid rgba(201,162,39,.2);border-radius:10px;padding:14px 16px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:1.1rem;">📎</span>
                <strong style="font-size:.88rem;color:var(--accent2);">Anexar Nota Fiscal, Proposta Comercial ou Cotação</strong>
              </div>
              <p style="font-size:.76rem;color:var(--text3);margin-bottom:10px;">
                Selecione o arquivo da Nota Fiscal (PDF, XML, Imagem) ou proposta comercial recebida do fornecedor para que o administrador possa avaliar:
              </p>
              <div style="display:flex;gap:10px;align-items:center;">
                <input type="file" id="pc-file-upload" class="form-control" style="font-size:.8rem;padding:6px 12px;flex:1;" accept=".pdf,.png,.jpg,.jpeg,.xml,.html,.txt">
                <input type="text" id="pc-file-title" class="form-control" placeholder="Título do anexo (ex: Nota Fiscal 1234)" style="width:260px;font-size:.8rem;">
              </div>
            </div>

          </div>

          <div class="modal-footer" style="padding:14px 20px;border-top:1px solid var(--border);justify-content:space-between;">
            <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="font-weight:800;padding:10px 24px;">
              ${isEdit ? 'Salvar Alterações' : 'Criar Ordem de Pré-Compra'}
            </button>
          </div>
        </form>
      </div>
    `);
  },

  _renderItensTbody() {
    if (!this._itensTemp.length) {
      this._itensTemp = [{ id: 'it_' + Date.now(), descricao: '', unidade: 'un', quantidade: 1, valor_unitario: 0, subtotal: 0 }];
    }

    const unidades = ['un', 'm', 'm²', 'm³', 'kg', 'sc', 'cx', 'barra', 'dz', 'dia', 'vb', 'h', 'l'];

    return this._itensTemp.map((it, idx) => `
      <tr data-idx="${idx}">
        <td>
          <input type="text" class="form-control" value="${it.descricao || ''}" placeholder="Ex: Cimento CP-II 50kg" oninput="PreCompras._atualizarItem(${idx}, 'descricao', this.value)" required style="padding:6px 8px;font-size:.8rem;">
        </td>
        <td>
          <select class="form-control" onchange="PreCompras._atualizarItem(${idx}, 'unidade', this.value)" style="padding:6px 4px;font-size:.8rem;">
            ${unidades.map(u => `<option value="${u}" ${it.unidade === u ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </td>
        <td>
          <input type="number" step="any" min="0" class="form-control" value="${it.quantidade || 1}" oninput="PreCompras._atualizarItem(${idx}, 'quantidade', parseFloat(this.value)||0)" required style="padding:6px 8px;font-size:.8rem;text-align:right;">
        </td>
        <td>
          <input type="number" step="any" min="0" class="form-control" value="${it.valor_unitario || 0}" oninput="PreCompras._atualizarItem(${idx}, 'valor_unitario', parseFloat(this.value)||0)" required style="padding:6px 8px;font-size:.8rem;text-align:right;">
        </td>
        <td style="text-align:right;font-weight:800;color:var(--text);font-family:monospace;white-space:nowrap;padding-right:8px;">
          ${Utils.fmt.currency(it.subtotal || (it.quantidade * it.valor_unitario))}
        </td>
        <td style="text-align:center;">
          <button type="button" class="icon-btn" onclick="PreCompras.removerLinhaItem(${idx})" title="Remover item" style="color:var(--danger);font-size:12px;padding:2px 4px;">
            ✕
          </button>
        </td>
      </tr>
    `).join('');
  },

  adicionarLinhaItem() {
    this._itensTemp.push({
      id: 'it_' + Date.now() + Math.random().toString(36).substr(2, 3),
      descricao: '',
      unidade: 'un',
      quantidade: 1,
      valor_unitario: 0,
      subtotal: 0
    });
    this._refreshItensTable();
  },

  removerLinhaItem(idx) {
    if (this._itensTemp.length <= 1) {
      Utils.toast('A ordem precisa ter pelo menos um item.', 'warning');
      return;
    }
    this._itensTemp.splice(idx, 1);
    this._refreshItensTable();
  },

  _atualizarItem(idx, campo, valor) {
    if (!this._itensTemp[idx]) return;
    this._itensTemp[idx][campo] = valor;
    this._itensTemp[idx].subtotal = (this._itensTemp[idx].quantidade || 0) * (this._itensTemp[idx].valor_unitario || 0);

    // Atualiza apenas os subtotais e o total geral sem recriar os inputs para não perder o foco
    const tbody = document.getElementById('pc-itens-tbody');
    if (tbody) {
      const row = tbody.querySelector(`tr[data-idx="${idx}"]`);
      if (row) {
        const subtotalCell = row.children[4];
        if (subtotalCell) subtotalCell.textContent = Utils.fmt.currency(this._itensTemp[idx].subtotal);
      }
    }

    const totalEl = document.getElementById('pc-total-display');
    if (totalEl) totalEl.textContent = Utils.fmt.currency(this._calcularTotalTemp());
  },

  _refreshItensTable() {
    const tbody = document.getElementById('pc-itens-tbody');
    if (tbody) tbody.innerHTML = this._renderItensTbody();
    const totalEl = document.getElementById('pc-total-display');
    if (totalEl) totalEl.textContent = Utils.fmt.currency(this._calcularTotalTemp());
  },

  _calcularTotalTemp() {
    return this._itensTemp.reduce((s, it) => s + ((it.quantidade || 0) * (it.valor_unitario || 0)), 0);
  },

  _onFornecedorChange(sel) {
    const manual  = document.getElementById('pc-forn-manual');
    const cnpjEl  = document.getElementById('pc-forn-cnpj');
    if (!manual) return;

    if (sel.value === '__manual__') {
      manual.style.display = 'block';
      manual.focus();
    } else if (sel.value === '') {
      manual.style.display = 'none';
      if (cnpjEl) cnpjEl.value = '';
    } else {
      manual.style.display = 'none';
      // Preenche CNPJ automaticamente pelo data-cnpj da option
      const opt = sel.options[sel.selectedIndex];
      const cnpj = opt?.dataset?.cnpj || '';
      if (cnpjEl && cnpj) {
        const d = cnpj.replace(/\D/g,'');
        cnpjEl.value = d.length === 14
          ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')
          : cnpj;
      }
    }
  },

  async salvar(event, id = '') {
    event.preventDefault();
    const form = event.target;
    const fd = new FormData(form);
    const user = Auth.getUser();

    const itensValidos = this._itensTemp.filter(it => it.descricao && it.descricao.trim());
    if (!itensValidos.length) {
      Utils.toast('Preencha a descrição de pelo menos um item.', 'warning');
      return;
    }

    const valorTotal = itensValidos.reduce((s, it) => s + ((it.quantidade || 0) * (it.valor_unitario || 0)), 0);

    const dados = {
      numero_ordem: fd.get('numero_ordem'),
      obra_id: fd.get('obra_id'),
      solicitante_nome: fd.get('solicitante_nome') || user?.nome || 'Gestor',
      solicitante_id: user?.userId || 'u2',
      descricao: fd.get('descricao'),
      categoria: fd.get('categoria'),
      prioridade: fd.get('prioridade'),
      fornecedor_nome: (() => {
        const sel = document.getElementById('pc-forn-sel');
        const selVal = sel?.value || '';
        if (selVal && selVal !== '__manual__' && selVal !== '') return selVal;
        return fd.get('fornecedor_nome') || '';
      })(),
      fornecedor_cnpj: fd.get('fornecedor_cnpj') || '',
      data_solicitacao: fd.get('data_solicitacao') || Utils.today(),
      data_necessidade: fd.get('data_necessidade') || '',
      forma_pagamento: fd.get('forma_pagamento') || '',
      justificativa: fd.get('justificativa') || '',
      itens: itensValidos,
      valor_total: valorTotal
    };

    let precompraId = id;

    if (id) {
      DB.update('precompras', id, dados);
      Utils.toast('Ordem de pré-compra atualizada com sucesso!', 'success');
    } else {
      dados.status = 'pendente_aprovacao';
      const novo = DB.add('precompras', dados);
      precompraId = novo.id;
      Utils.toast('Ordem de pré-compra criada e enviada para autorização!', 'success');
    }

    // Processamento do arquivo de anexo / Nota Fiscal se enviado
    const fileInput = document.getElementById('pc-file-upload');
    const fileTitleInput = document.getElementById('pc-file-title');
    if (fileInput && fileInput.files && fileInput.files[0] && typeof Documentos !== 'undefined') {
      const file = fileInput.files[0];
      try {
        const base64 = await Documentos.lerArquivoBase64(file);
        Documentos.adicionar({
          entidade_tipo: 'precompra',
          entidade_id: precompraId,
          titulo: fileTitleInput?.value?.trim() || file.name,
          nome_arquivo: file.name,
          tipo_mime: file.type || 'application/octet-stream',
          tamanho: file.size,
          data_base64: base64
        });
        Utils.toast('Nota Fiscal / Anexo anexado com sucesso!', 'info');
      } catch (err) {
        console.error('Erro ao anexar arquivo:', err);
      }
    }

    Utils.closeModal();
    App.navigate('precompras');
  },

  excluir(id) {
    const item = DB.getById('precompras', id);
    if (!item) return;
    Utils.confirm(`Deseja realmente excluir a ordem de pré-compra <strong>${item.numero_ordem}</strong>?`, () => {
      DB.remove('precompras', id);
      Utils.toast('Ordem de pré-compra excluída!', 'info');
      App.navigate('precompras');
    });
  },

  // ─────────────────────────────────────────────────────────────
  // FLUXO DE AUTORIZAÇÃO / APROVAÇÃO (EXCLUSIVO ADMINISTRADOR)
  // ─────────────────────────────────────────────────────────────
  abrirModalAprovacao(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;
    const c = DB.getById('clientes', p.obra_id);
    const contas = DB.getAll('contas');

    Utils.showModal(`
      <div class="modal" style="max-width:600px;width:95vw;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.3rem;">✅</span>
            <span class="modal-title">Autorizar Ordem de Pré-Compra</span>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="font-family:monospace;font-weight:800;color:var(--accent2);">${p.numero_ordem}</span>
              <span style="font-weight:900;color:var(--success);font-size:1.1rem;">${Utils.fmt.currency(p.valor_total)}</span>
            </div>
            <div style="font-weight:700;color:var(--text);">${p.descricao}</div>
            <div style="font-size:.78rem;color:var(--text3);margin-top:4px;">Obra: <strong>${c?.nome || '—'}</strong> | Solicitante: <strong>${p.solicitante_nome}</strong></div>
            <div style="font-size:.78rem;color:var(--text3);margin-top:2px;">Fornecedor: <strong>${p.fornecedor_nome || '—'}</strong> (${p.itens?.length || 0} itens)</div>
          </div>

          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">Parecer / Instruções do Administrador</label>
            <textarea id="aprov-parecer" class="form-control" rows="2" placeholder="Ex: Aprovado conforme cotação. Faturar com boleto 28 DDL."></textarea>
          </div>

          <div style="background:rgba(2,132,199,.08);border:1px solid rgba(2,132,199,.25);border-radius:8px;padding:14px;margin-bottom:16px;">
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
              <input type="checkbox" id="aprov-gerar-despesa" checked style="margin-top:3px;transform:scale(1.15);" onchange="PreCompras._toggleContaBancariaSelect(this.checked)">
              <div>
                <strong style="color:var(--text);font-size:.85rem;">Gerar Despesa Financeira em "Lançamentos" Imediatamente</strong>
                <p style="font-size:.74rem;color:var(--text3);margin-top:2px;">
                  Cria automaticamente a conta a pagar na obra com os dados desta ordem de compra aprovada.
                </p>
              </div>
            </label>

            <div id="aprov-conta-group" style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
              <div style="flex:1;min-width:180px;">
                <label class="form-label" style="font-size:.72rem;">Conta Bancária Prevista</label>
                <select id="aprov-conta" class="form-control" style="font-size:.8rem;">
                  <option value="">Selecione a conta...</option>
                  ${contas.map(ct => `<option value="${ct.apelido || ct.banco_nome}">${ct.apelido || ct.banco_nome} (${ct.agencia}/${ct.numero})</option>`).join('')}
                </select>
              </div>
              <div style="width:140px;">
                <label class="form-label" style="font-size:.72rem;">Vencimento</label>
                <input type="date" id="aprov-vencimento" class="form-control" style="font-size:.8rem;" value="${p.data_necessidade || Utils.today()}">
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="padding:12px 20px;border-top:1px solid var(--border);justify-content:flex-end;gap:10px;">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-success" onclick="PreCompras.confirmarAprovacao('${p.id}')" style="font-weight:800;padding:10px 20px;">
            ✓ Confirmar Aprovação
          </button>
        </div>
      </div>
    `);
  },

  _toggleContaBancariaSelect(checked) {
    const grp = document.getElementById('aprov-conta-group');
    if (grp) grp.style.display = checked ? 'flex' : 'none';
  },

  confirmarAprovacao(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;

    const parecer = document.getElementById('aprov-parecer')?.value?.trim() || 'Aprovado pelo Administrador';
    const gerarDespesa = document.getElementById('aprov-gerar-despesa')?.checked;
    const contaBancaria = document.getElementById('aprov-conta')?.value || '';
    const vencimento = document.getElementById('aprov-vencimento')?.value || p.data_necessidade || Utils.today();
    const user = Auth.getUser();

    const updates = {
      status: 'aprovada',
      aprovado_por: user?.nome || 'Administrador',
      aprovado_em: new Date().toISOString(),
      parecer_admin: parecer
    };

    if (gerarDespesa) {
      // Cria lançamento no módulo de finanças
      const lancamento = {
        obra_id: p.obra_id,
        tipo: 'despesa',
        data: p.data_solicitacao || Utils.today(),
        data_vencimento: vencimento,
        descricao: `[Ordem ${p.numero_ordem}] ${p.descricao}`,
        categoria: p.categoria || 'material',
        valor: p.valor_total,
        status: 'a_pagar',
        fornecedor_beneficiario: p.fornecedor_nome || 'Fornecedor',
        conta_bancaria: contaBancaria,
        observacoes: `Gerado automaticamente a partir da Ordem de Pré-Compra ${p.numero_ordem}. Parecer: ${parecer}`,
        origem: 'precompra',
        precompra_id: p.id,
        conciliado: false
      };

      const novoLanc = DB.add('lancamentos', lancamento);
      updates.status = 'convertida';
      updates.lancamento_id = novoLanc.id;
      Utils.toast(`Ordem aprovada e Despesa de ${Utils.fmt.currency(p.valor_total)} gerada em Lançamentos!`, 'success');
    } else {
      Utils.toast(`Ordem de pré-compra ${p.numero_ordem} aprovada com sucesso!`, 'success');
    }

    DB.update('precompras', id, updates);
    Utils.closeModal();
    App.navigate('precompras');
  },

  // ─────────────────────────────────────────────────────────────
  // FLUXO DE REJEIÇÃO / RECUSA (EXCLUSIVO ADMINISTRADOR)
  // ─────────────────────────────────────────────────────────────
  abrirModalRejeicao(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;

    Utils.showModal(`
      <div class="modal" style="max-width:480px;width:95vw;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.3rem;">❌</span>
            <span class="modal-title">Recusar Ordem de Pré-Compra</span>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <p style="font-size:.85rem;color:var(--text2);margin-bottom:14px;">
            Informe a justificativa ou motivo da recusa da ordem <strong>${p.numero_ordem}</strong> (${Utils.fmt.currency(p.valor_total)}). O solicitante poderá visualizar a justificativa.
          </p>
          <div class="form-group">
            <label class="form-label">Motivo da Recusa / Justificativa *</label>
            <textarea id="recusa-motivo" class="form-control" rows="3" placeholder="Ex: Valor acima do orçamento da etapa. Solicitar cotação com mais 2 fornecedores locais." required></textarea>
          </div>
        </div>
        <div class="modal-footer" style="padding:12px 20px;border-top:1px solid var(--border);justify-content:flex-end;gap:10px;">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-danger" onclick="PreCompras.confirmarRejeicao('${p.id}')" style="font-weight:800;">
            ✕ Confirmar Recusa
          </button>
        </div>
      </div>
    `);
  },

  confirmarRejeicao(id) {
    const motivo = document.getElementById('recusa-motivo')?.value?.trim();
    if (!motivo) {
      Utils.toast('Por favor, informe o motivo da recusa.', 'warning');
      return;
    }

    const user = Auth.getUser();
    DB.update('precompras', id, {
      status: 'rejeitada',
      rejeitado_por: user?.nome || 'Administrador',
      rejeitado_em: new Date().toISOString(),
      motivo_recusa: motivo
    });

    Utils.toast('Ordem de pré-compra recusada.', 'info');
    Utils.closeModal();
    App.navigate('precompras');
  },

  // ─────────────────────────────────────────────────────────────
  // CONVERTER ORDEM APROVADA EM LANÇAMENTO FINANCEIRO
  // ─────────────────────────────────────────────────────────────
  converterEmLancamentoModal(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;
    const c = DB.getById('clientes', p.obra_id);
    const contas = DB.getAll('contas');

    Utils.showModal(`
      <div class="modal" style="max-width:520px;width:95vw;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.3rem;">💰</span>
            <span class="modal-title">Gerar Despesa Financeira</span>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;">
            <div style="font-weight:800;color:var(--accent2);">${p.numero_ordem} — ${p.descricao}</div>
            <div style="font-size:.8rem;color:var(--text3);margin-top:4px;">Obra: <strong>${c?.nome||'—'}</strong> | Fornecedor: <strong>${p.fornecedor_nome||'—'}</strong></div>
            <div style="font-size:1.2rem;font-weight:900;color:var(--success);margin-top:6px;">${Utils.fmt.currency(p.valor_total)}</div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Conta Bancária de Pagamento</label>
            <select id="conv-conta" class="form-control">
              <option value="">Selecione a conta...</option>
              ${contas.map(ct => `<option value="${ct.apelido || ct.banco_nome}">${ct.apelido || ct.banco_nome} (${ct.agencia}/${ct.numero})</option>`).join('')}
            </select>
          </div>

          <div class="g2">
            <div class="form-group">
              <label class="form-label">Data de Vencimento</label>
              <input type="date" id="conv-vencimento" class="form-control" value="${p.data_necessidade || Utils.today()}">
            </div>
            <div class="form-group">
              <label class="form-label">Status Inicial</label>
              <select id="conv-status" class="form-control">
                <option value="a_pagar">⏳ A Pagar</option>
                <option value="pago">✓ Pago</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer" style="padding:12px 20px;border-top:1px solid var(--border);justify-content:flex-end;gap:10px;">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="PreCompras.executarConversaoLancamento('${p.id}')" style="font-weight:800;">
            ✓ Confirmar e Lançar
          </button>
        </div>
      </div>
    `);
  },

  executarConversaoLancamento(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;

    const conta = document.getElementById('conv-conta')?.value || '';
    const vencimento = document.getElementById('conv-vencimento')?.value || Utils.today();
    const statusLanc = document.getElementById('conv-status')?.value || 'a_pagar';

    const lancamento = {
      obra_id: p.obra_id,
      tipo: 'despesa',
      data: p.data_solicitacao || Utils.today(),
      data_vencimento: vencimento,
      descricao: `[Ordem ${p.numero_ordem}] ${p.descricao}`,
      categoria: p.categoria || 'material',
      valor: p.valor_total,
      status: statusLanc,
      fornecedor_beneficiario: p.fornecedor_nome || 'Fornecedor',
      conta_bancaria: conta,
      observacoes: `Gerado a partir da Ordem de Pré-Compra ${p.numero_ordem}. ${p.justificativa ? 'Aplicação: ' + p.justificativa : ''}`,
      origem: 'precompra',
      precompra_id: p.id,
      conciliado: false
    };

    const novoLanc = DB.add('lancamentos', lancamento);
    DB.update('precompras', id, {
      status: 'convertida',
      lancamento_id: novoLanc.id
    });

    Utils.closeModal();
    Utils.toast(`Despesa gerada em Lançamentos Financeiros com sucesso!`, 'success');
    App.navigate('precompras');
  },

  // ─────────────────────────────────────────────────────────────
  // ANEXOS E NOTAS FISCAIS
  // ─────────────────────────────────────────────────────────────
  abrirAnexosNotaFiscal(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;
    if (typeof Documentos !== 'undefined') {
      Documentos.showModalAnexos('precompra', p.id, {
        titulo: `Anexos da Ordem ${p.numero_ordem} — ${p.descricao}`,
        descricao: 'Anexe Notas Fiscais (NF-e/DANFE), propostas comerciais e orçamentos em PDF ou imagem.'
      });
    } else {
      Utils.toast('Módulo de documentos não carregado.', 'error');
    }
  },

  // ─────────────────────────────────────────────────────────────
  // VISUALIZAÇÃO E IMPRESSÃO DA ORDEM DE COMPRA OFICIAL TIMBRADA
  // ─────────────────────────────────────────────────────────────
  visualizarOrdem(id) {
    const p = DB.getById('precompras', id);
    if (!p) return;
    const c = DB.getById('clientes', p.obra_id);
    const docs = typeof Documentos !== 'undefined' ? Documentos.listar('precompra', p.id) : [];

    let seloStatus = '';
    if (p.status === 'aprovada' || p.status === 'convertida') {
      seloStatus = `
        <div style="border:3px solid #16a34a;color:#16a34a;padding:8px 16px;border-radius:8px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-align:center;font-size:1rem;transform:rotate(-4deg);box-shadow:0 2px 8px rgba(22,163,74,0.15);">
          ✓ AUTORIZADO
          <div style="font-size:.65rem;font-weight:700;color:#15803d;margin-top:2px;">${p.aprovado_por || 'ADMINISTRAÇÃO'} &middot; ${Utils.fmt.date(p.aprovado_em?.split('T')[0])}</div>
        </div>`;
    } else if (p.status === 'rejeitada') {
      seloStatus = `
        <div style="border:3px solid #dc2626;color:#dc2626;padding:8px 16px;border-radius:8px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-align:center;font-size:1rem;transform:rotate(-4deg);">
          ✕ NÃO AUTORIZADO
          <div style="font-size:.65rem;font-weight:700;color:#b91c1c;margin-top:2px;">${p.rejeitado_por || 'ADMINISTRAÇÃO'}</div>
        </div>`;
    } else {
      seloStatus = `
        <div style="border:3px dashed #d97706;color:#d97706;padding:8px 16px;border-radius:8px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-align:center;font-size:.9rem;">
          ⏳ EM ANÁLISE / PENDENTE
        </div>`;
    }

    Utils.showModal(`
      <div class="modal" style="max-width:850px;width:95vw;max-height:92vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:14px 20px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.2rem;">📄</span>
            <span class="modal-title">Ordem de Compra Oficial — ${p.numero_ordem}</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-primary btn-sm" onclick="PreCompras.imprimirOrdem('${p.id}')">
              🖨️ Imprimir / Salvar PDF
            </button>
            <button class="modal-close" onclick="Utils.closeModal()">✕</button>
          </div>
        </div>

        <div class="modal-body" style="padding:20px;overflow-y:auto;flex:1;background:#fff;color:#0f172a;border-radius:0 0 10px 10px;" id="folha-ordem-compra">
          
          <!-- CABEÇALHO TIMBRADO ANGELIM -->
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1C2D12;padding-bottom:16px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:14px;">
              <img src="img/logo.png" alt="Angelim Construtora" style="width:70px;height:70px;border-radius:8px;object-fit:contain;border:1px solid #cbd5e1;">
              <div>
                <h1 style="margin:0;font-size:1.4rem;font-weight:900;color:#1C2D12;letter-spacing:0.5px;">ANGELIM CONSTRUTORA</h1>
                <p style="margin:2px 0 0;font-size:.78rem;color:#475569;font-weight:600;">SISTEMA DE GESTÃO FINANCEIRA E CONTROLE DE OBRAS</p>
                <p style="margin:2px 0 0;font-size:.72rem;color:#64748b;">CNPJ: 12.345.678/0001-90 &middot; Roraima / São Paulo &middot; Contratos Caixa Econômica Federal</p>
              </div>
            </div>
            <div>
              ${seloStatus}
            </div>
          </div>

          <!-- TÍTULO DO DOCUMENTO -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
              <div style="font-size:.75rem;font-weight:800;color:#64748b;text-transform:uppercase;">Documento</div>
              <div style="font-size:1.15rem;font-weight:900;color:#0f172a;">ORDEM DE COMPRA / SOLICITAÇÃO DE SUPRIMENTOS</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:.75rem;font-weight:800;color:#64748b;">NÚMERO DO PEDIDO</div>
              <div style="font-size:1.2rem;font-weight:900;color:#C9A227;font-family:monospace;">${p.numero_ordem}</div>
            </div>
          </div>

          <!-- QUADRO: DADOS DA OBRA E DO FORNECEDOR -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;font-size:.8rem;">
            
            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:12px;">
              <div style="font-weight:800;color:#1C2D12;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:6px;text-transform:uppercase;font-size:.74rem;">
                📍 Obra / Destino dos Materiais
              </div>
              <div style="line-height:1.5;color:#1e293b;">
                <strong>Obra / Cliente:</strong> ${c?.nome || '—'}<br>
                <strong>Cidade / UF:</strong> ${c?.cidade || '—'} / ${c?.estado || '—'}<br>
                <strong>Endereço:</strong> ${c?.endereco || '—'}<br>
                ${c?.num_contrato_caixa ? `<strong>Contrato Caixa:</strong> ${c.num_contrato_caixa}<br>` : ''}
                <strong>Solicitante:</strong> ${p.solicitante_nome}
              </div>
            </div>

            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:12px;">
              <div style="font-weight:800;color:#1C2D12;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:6px;text-transform:uppercase;font-size:.74rem;">
                🏢 Fornecedor / Empresa Sugerida
              </div>
              <div style="line-height:1.5;color:#1e293b;">
                <strong>Fornecedor:</strong> ${p.fornecedor_nome || '—'}<br>
                <strong>CNPJ / CPF:</strong> ${p.fornecedor_cnpj || 'Não informado'}<br>
                <strong>Contato / Vendedor:</strong> ${p.fornecedor_contato || 'Não informado'}<br>
                <strong>Forma de Pagamento:</strong> ${p.forma_pagamento || 'A combinar'}<br>
                <strong>Previsão de Entrega:</strong> ${p.data_necessidade ? Utils.fmt.date(p.data_necessidade) : 'Imediata'}
              </div>
            </div>

          </div>

          <!-- DETALHES GERAIS DA ORDEM -->
          <div style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:.8rem;color:#1e293b;">
            <div style="margin-bottom:4px;"><strong>Finalidade / Objeto:</strong> ${p.descricao}</div>
            ${p.justificativa ? `<div style="color:#475569;"><strong>Justificativa da Aplicação:</strong> ${p.justificativa}</div>` : ''}
            ${p.parecer_admin ? `<div style="margin-top:4px;color:#15803d;font-weight:600;"><strong>Parecer da Diretoria:</strong> ${p.parecer_admin}</div>` : ''}
          </div>

          <!-- TABELA DE ITENS DISCRIMINADOS -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:.82rem;">
            <thead>
              <tr style="background:#1C2D12;color:#F0EAD6;">
                <th style="padding:8px 10px;text-align:center;width:40px;border:1px solid #1C2D12;">Item</th>
                <th style="padding:8px 10px;text-align:left;border:1px solid #1C2D12;">Descrição do Insumo / Serviço</th>
                <th style="padding:8px 10px;text-align:center;width:70px;border:1px solid #1C2D12;">Unid.</th>
                <th style="padding:8px 10px;text-align:right;width:80px;border:1px solid #1C2D12;">Qtd.</th>
                <th style="padding:8px 10px;text-align:right;width:110px;border:1px solid #1C2D12;">Valor Unit.</th>
                <th style="padding:8px 10px;text-align:right;width:120px;border:1px solid #1C2D12;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${(p.itens || []).map((it, idx) => `
                <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                  <td style="padding:7px 10px;text-align:center;border:1px solid #cbd5e1;font-weight:700;color:#64748b;">${idx + 1}</td>
                  <td style="padding:7px 10px;border:1px solid #cbd5e1;font-weight:600;color:#0f172a;">${it.descricao}</td>
                  <td style="padding:7px 10px;text-align:center;border:1px solid #cbd5e1;color:#475569;">${it.unidade}</td>
                  <td style="padding:7px 10px;text-align:right;border:1px solid #cbd5e1;font-weight:700;">${it.quantidade}</td>
                  <td style="padding:7px 10px;text-align:right;border:1px solid #cbd5e1;">${Utils.fmt.currency(it.valor_unitario)}</td>
                  <td style="padding:7px 10px;text-align:right;border:1px solid #cbd5e1;font-weight:800;color:#0f172a;">${Utils.fmt.currency(it.subtotal || (it.quantidade * it.valor_unitario))}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f1f5f9;font-weight:900;">
                <td colspan="4" style="padding:10px;border:1px solid #cbd5e1;font-size:.85rem;color:#1e293b;">
                  TOTAL GERAL DA ORDEM DE COMPRA:
                </td>
                <td colspan="2" style="padding:10px;border:1px solid #cbd5e1;text-align:right;font-size:1.15rem;color:#15803d;">
                  ${Utils.fmt.currency(p.valor_total)}
                </td>
              </tr>
              <tr>
                <td colspan="6" style="padding:8px 10px;border:1px solid #cbd5e1;background:#fff;font-size:.75rem;color:#64748b;">
                  <strong>Valor por extenso:</strong> ${Utils.extenso(p.valor_total).toUpperCase()}
                </td>
              </tr>
            </tfoot>
          </table>

          ${docs.length > 0 ? `
          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;margin-bottom:16px;font-size:.75rem;color:#475569;">
            <strong>📎 Documentos / Notas Fiscais Anexadas (${docs.length}):</strong>
            <ul style="margin:4px 0 0 16px;padding:0;">
              ${docs.map(d => `<li>${d.titulo} (${d.nome_arquivo})</li>`).join('')}
            </ul>
          </div>` : ''}

          <!-- CAMPO DE ASSINATURAS -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:36px;padding-top:20px;font-size:.75rem;text-align:center;color:#334155;">
            <div>
              <div style="border-top:1px solid #64748b;padding-top:4px;margin-bottom:2px;">
                <strong>${p.solicitante_nome}</strong>
              </div>
              <div>Solicitante / Gestor da Obra</div>
            </div>
            <div>
              <div style="border-top:1px solid #64748b;padding-top:4px;margin-bottom:2px;">
                <strong>${p.aprovado_por || 'Administração Geral'}</strong>
              </div>
              <div>Diretoria / Administrador</div>
            </div>
            <div>
              <div style="border-top:1px solid #64748b;padding-top:4px;margin-bottom:2px;">
                <strong>${p.fornecedor_nome || 'Fornecedor'}</strong>
              </div>
              <div>Aceite / Entrega do Fornecedor</div>
            </div>
          </div>

          <div style="margin-top:24px;text-align:center;font-size:.65rem;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:8px;">
            Emitido via Angelim Construtora Sistema Financeiro &middot; Data de Emissão: ${new Date().toLocaleString('pt-BR')} &middot; Documento Interno de Controle
          </div>

        </div>

        <div class="modal-footer" style="padding:10px 20px;border-top:1px solid var(--border);justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Fechar</button>
        </div>
      </div>
    `);
  },

  imprimirOrdem(id) {
    const conteudo = document.getElementById('folha-ordem-compra')?.innerHTML;
    if (!conteudo) return;

    const printWin = window.open('', '_blank', 'width=900,height=750');
    if (!printWin) {
      Utils.toast('Permita popups para abrir a impressão.', 'warning');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Ordem de Compra — Angelim Construtora</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #fff; color: #0f172a; padding: 20px; }
          @media print {
            body { padding: 0; }
            @page { margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        <div>${conteudo}</div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }
};
