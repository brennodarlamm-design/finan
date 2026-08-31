// js/escritorio.js — Módulo de Despesas Administrativas do Escritório / Sede (Custos Fixos, Contas, Tributos, Folha)

const Escritorio = {
  _activeGroup: 'todas',

  // Chave localStorage para categorias customizadas de despesas
  CATS_KEY: 'finobra_cats_despesa_custom',

  _getAllDespesaCats() {
    try { return JSON.parse(localStorage.getItem(this.CATS_KEY) || '[]'); } catch(e) { return []; }
  },
  _saveDespesaCats(list) {
    localStorage.setItem(this.CATS_KEY, JSON.stringify(list));
  },

  init(obraId) {
    this._bindFilters();
  },

  render(obraId) {
    const resumo = DB.getResumoEscritorio({ grupo: this._activeGroup === 'todas' ? '' : this._activeGroup });
    const despesas = DB.getDespesasEscritorio({ grupo: this._activeGroup === 'todas' ? '' : this._activeGroup });

    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">🏢 Despesas do Escritório</h1>
        <p class="page-sub">Gestão de custos fixos, contas de consumo (água, energia, internet), tributos (DAS Simples Nacional), folha e sede administrativa</p>
      </div>
      <div class="page-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="ImportarExcel.abrirModal('escritorio')" style="display:flex;align-items:center;gap:6px;">
          📊 Importar Excel
        </button>
        <button class="btn btn-secondary btn-sm" onclick="Escritorio.abrirModalLote()" style="display:flex;align-items:center;gap:6px;border:1px solid var(--accent);color:var(--accent2);">
          ⚡ Lançar Custos Fixos do Mês
        </button>
        <button class="btn btn-primary btn-sm" onclick="Escritorio.showForm()" style="display:flex;align-items:center;gap:6px;">
          + Nova Despesa
        </button>
      </div>
    </div>

    <!-- KPIs DE CUSTOS ADMINISTRATIVOS -->
    <div class="g5" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px;">
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">Total Despesas Sede</div>
        <div class="kpi-value red" style="font-size:1.2rem">${Utils.fmt.currency(resumo.totalGeral)}</div>
        <div class="kpi-change" style="font-size:.7rem;">${resumo.totalQtd} lançamentos registrados</div>
      </div>
      <div class="kpi-card" style="padding:14px;border:1px solid rgba(245,158,11,.3);">
        <div class="kpi-label">A Pagar (Vencimentos)</div>
        <div class="kpi-value yellow" style="font-size:1.2rem">${Utils.fmt.currency(resumo.totalAPagar)}</div>
        <div class="kpi-change" style="font-size:.7rem;">${resumo.aPagarQtd} conta(s) pendente(s)</div>
      </div>
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">💡 Contas de Consumo</div>
        <div class="kpi-value cyan" style="font-size:1.2rem">${Utils.fmt.currency(resumo.consumoValor)}</div>
        <div class="kpi-change" style="font-size:.7rem;">Energia, Água e Internet</div>
      </div>
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">🏛️ Impostos & Simples</div>
        <div class="kpi-value yellow" style="font-size:1.2rem">${Utils.fmt.currency(resumo.impostosValor)}</div>
        <div class="kpi-change" style="font-size:.7rem;">DAS Simples, INSS e Taxas</div>
      </div>
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">👥 Folha & Sócios</div>
        <div class="kpi-value green" style="font-size:1.2rem">${Utils.fmt.currency(resumo.folhaValor)}</div>
        <div class="kpi-change" style="font-size:.7rem;">Salários, Pró-Labore e VT/VR</div>
      </div>
    </div>

    <!-- ABAS RÁPIDAS POR GRUPO DE DESPESAS -->
    <div style="display:flex;gap:6px;border-bottom:1px solid var(--border);margin-bottom:16px;overflow-x:auto;padding-bottom:2px;">
      <button class="btn btn-sm ${this._activeGroup==='todas'?'btn-primary':'btn-secondary'}" onclick="Escritorio.switchGroup('todas')">
        📋 Todas as Despesas (${DB.getDespesasEscritorio().length})
      </button>
      <button class="btn btn-sm ${this._activeGroup==='consumo'?'btn-primary':'btn-secondary'}" onclick="Escritorio.switchGroup('consumo')">
        💡 Contas de Consumo (Luz / Água / Net)
      </button>
      <button class="btn btn-sm ${this._activeGroup==='impostos'?'btn-primary':'btn-secondary'}" onclick="Escritorio.switchGroup('impostos')">
        🏛️ Impostos & Simples Nacional
      </button>
      <button class="btn btn-sm ${this._activeGroup==='folha'?'btn-primary':'btn-secondary'}" onclick="Escritorio.switchGroup('folha')">
        👥 Folha de Pagamento & Sócios
      </button>
      <button class="btn btn-sm ${this._activeGroup==='estrutura'?'btn-primary':'btn-secondary'}" onclick="Escritorio.switchGroup('estrutura')">
        🏢 Aluguel & Instalações
      </button>
      <button class="btn btn-sm ${this._activeGroup==='servicos'?'btn-primary':'btn-secondary'}" onclick="Escritorio.switchGroup('servicos')">
        ⚖️ Contabilidade, TI & Softwares
      </button>
    </div>

    <!-- FILTROS -->
    <div class="filters-bar">
      <div class="filter-group" style="flex:1">
        <label class="filter-label">Buscar</label>
        <div class="search-bar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="form-control" id="adm-search" placeholder="Descrição, fornecedor, código de barras..." oninput="Escritorio.aplicarFiltros()">
        </div>
      </div>
      <div class="filter-group">
        <label class="filter-label">Categoria</label>
        <select class="form-control" id="adm-cat" style="min-width:140px" onchange="Escritorio.aplicarFiltros()">
          <option value="">Todas</option>
          <option value="energia">💡 Energia Elétrica</option>
          <option value="agua">💧 Água e Esgoto</option>
          <option value="internet_tel">🌐 Internet & Telefonia</option>
          <option value="imposto_simples">🏛️ DAS Simples Nacional</option>
          <option value="tributos_trabalhistas">📄 INSS / FGTS / Tributos</option>
          <option value="salario">👥 Salários / Folha</option>
          <option value="pro_labore">💼 Pró-Labore Sócios</option>
          <option value="beneficios">🎫 Benefícios (VT / VR)</option>
          <option value="aluguel_sede">🏢 Aluguel / Sede</option>
          <option value="contabilidade">⚖️ Contábil / Jurídico</option>
          <option value="software_ti">💻 Softwares & TI</option>
          <option value="material_escritorio">📦 Material & Copa</option>
          <option value="manutencao_sede">🔧 Manutenção</option>
          <option value="veiculos_sede">🚗 Veículos & Combustível</option>
          <option value="marketing">📣 Marketing</option>
          <option value="trafego_pago">🎯 Tráfego Pago</option>
          <option value="comercial">🤝 Comercial</option>
          ${this._getAllDespesaCats().map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="form-control" id="adm-status" style="min-width:110px" onchange="Escritorio.aplicarFiltros()">
          <option value="">Todos</option>
          <option value="a_pagar">⏳ A Pagar</option>
          <option value="pago">✓ Pago</option>
          <option value="em_atraso">⚠ Em Atraso</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Período Vencimento</label>
        <div style="display:flex;gap:5px">
          <input class="form-control" type="date" id="adm-di" style="width:125px" title="Data inicial" onchange="Escritorio.aplicarFiltros()">
          <input class="form-control" type="date" id="adm-df" style="width:125px" title="Data final" onchange="Escritorio.aplicarFiltros()">
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="Escritorio.limparFiltros()" style="align-self:flex-end">Limpar</button>
    </div>

    <!-- TABELA DE DESPESAS DO ESCRITÓRIO -->
    <div class="card" style="padding:0;">
      <div class="tbl-wrap" style="border:none;border-radius:14px;">
        <table>
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Emissão</th>
              <th>Data Pagamento</th>
              <th>Competência</th>
              <th>Descrição do Custo</th>
              <th>Categoria</th>
              <th>Fornecedor / Favorecido / Órgão</th>
              <th>Conta Bancária</th>
              <th style="text-align:right;">Valor</th>
              <th>Status</th>
              <th title="Anexos / Guia / Boleto" style="text-align:center;">📎 Guia/Docs</th>
              <th style="text-align:center;">Ações</th>
            </tr>
          </thead>
          <tbody id="t-escritorio-body">
            ${this._renderRows(despesas)}
          </tbody>
          <tfoot id="t-escritorio-foot">
            <tr>${this._renderFoot(despesas)}</tr>
          </tfoot>
        </table>
      </div>
    </div>`;
  },

  _renderRows(list) {
    if (!list.length) {
      return `<tr><td colspan="12" style="text-align:center;padding:36px;color:var(--text3);">Nenhuma despesa do escritório encontrada neste filtro.</td></tr>`;
    }

    const hoje = Utils.today();

    return list.map(l => {
      const venc = l.data_vencimento || l.data;
      const isAtrasado = l.status === 'a_pagar' && venc < hoje;
      const isPago = l.status === 'pago';
      const statusBadge = isAtrasado ? `<span class="badge badge-danger">⚠ Em Atraso</span>` : Utils.badge(l.status);
      const clipBadge = typeof Documentos !== 'undefined' ? Documentos.badgeClip('lancamento', l.id, { titulo: l.descricao }) : '📎';
      const dtPagFmt = isPago
        ? `<span style="color:var(--success);font-weight:700;font-size:.78rem;">✓ ${Utils.fmt.date(l.data_pagamento || l.data)}</span>`
        : `<span style="color:var(--text3);font-size:.75rem;">—</span>`;

      return `
      <tr>
        <td style="white-space:nowrap;font-size:.78rem;font-weight:800;color:${isAtrasado ? 'var(--danger)' : 'var(--accent2)'};">
          ${Utils.fmt.date(venc)}
        </td>
        <td style="white-space:nowrap;font-size:.78rem;color:var(--text3);">${Utils.fmt.date(l.data)}</td>
        <td style="white-space:nowrap;">${dtPagFmt}</td>
        <td style="white-space:nowrap;font-size:.78rem;font-weight:700;color:var(--text2);">${l.competencia || '—'}</td>
        <td>
          <div style="font-weight:700;color:var(--text);">${l.descricao}</div>
          ${l.codigo_barras ? `<div style="font-size:.7rem;font-family:monospace;color:var(--accent2);" title="Linha digitável do boleto/guia">🔢 ${l.codigo_barras}</div>` : ''}
          ${l.observacoes ? `<div style="font-size:.72rem;color:var(--text3);">${l.observacoes}</div>` : ''}
        </td>
        <td style="white-space:nowrap;font-size:.78rem;">${Utils.catLabel(l.categoria)}</td>
        <td style="font-size:.78rem;color:var(--text2);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${l.fornecedor_beneficiario||''}">
          ${l.fornecedor_beneficiario || '—'}
        </td>
        <td style="font-size:.74rem;color:var(--text3);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${l.conta_bancaria ? `🏦 ${l.conta_bancaria}` : '—'}
        </td>
        <td style="text-align:right;font-weight:900;color:var(--danger);white-space:nowrap;font-size:.9rem;">
          -${Utils.fmt.currency(l.valor)}
        </td>
        <td>${statusBadge}</td>
        <td style="text-align:center;">${clipBadge}</td>
        <td style="text-align:center;white-space:nowrap;">
          <div style="display:flex;gap:4px;justify-content:center;align-items:center;">
            ${l.status === 'a_pagar' ? `
            <button class="btn btn-sm btn-success" onclick="Escritorio.marcarPago('${l.id}')" title="Confirmar Pagamento Realizado" style="font-size:.72rem;padding:3px 8px;">
              ✓ Pagar
            </button>` : ''}
            <button class="icon-btn" onclick="Escritorio.emitirRecibo('${l.id}')" title="Emitir Recibo Oficial de Pagamento" style="font-size:13px;">
              🧾
            </button>
            <button class="icon-btn" onclick="Escritorio.showForm('${l.id}')" title="Editar Lançamento" style="font-size:13px;">
              ✏️
            </button>
            <button class="icon-btn" onclick="Escritorio.excluir('${l.id}')" title="Excluir Lançamento" style="font-size:13px;color:var(--danger);">
              🗑️
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  _renderFoot(list) {
    const total = list.reduce((s, l) => s + (l.valor || 0), 0);
    const pagas = list.filter(l => l.status === 'pago').reduce((s, l) => s + (l.valor || 0), 0);
    const aPagar = list.filter(l => l.status === 'a_pagar').reduce((s, l) => s + (l.valor || 0), 0);

    return `
    <td colspan="7" style="font-weight:700;color:var(--text3);font-size:.78rem;">
      TOTAL DO ESCRITÓRIO: ${list.length} itens (Pago: <span style="color:var(--success);font-weight:800;">${Utils.fmt.currency(pagas)}</span> | A Pagar: <span style="color:var(--warning);font-weight:800;">${Utils.fmt.currency(aPagar)}</span>)
    </td>
    <td colspan="4" style="text-align:right;font-weight:900;color:var(--danger);font-size:.95rem;white-space:nowrap;padding-right:16px;">
      -${Utils.fmt.currency(total)}
    </td>`;
  },

  switchGroup(group) {
    this._activeGroup = group;
    App.navigate('escritorio');
  },

  _bindFilters() {},

  aplicarFiltros() {
    const search = document.getElementById('adm-search')?.value || '';
    const categoria = document.getElementById('adm-cat')?.value || '';
    const status = document.getElementById('adm-status')?.value || '';
    const dataInicio = document.getElementById('adm-di')?.value || '';
    const dataFim = document.getElementById('adm-df')?.value || '';

    const list = DB.getDespesasEscritorio({
      grupo: this._activeGroup === 'todas' ? '' : this._activeGroup,
      search, categoria, status, dataInicio, dataFim
    });

    const tbody = document.getElementById('t-escritorio-body');
    const tfoot = document.getElementById('t-escritorio-foot');

    if (tbody) tbody.innerHTML = this._renderRows(list);
    if (tfoot) tfoot.innerHTML = `<tr>${this._renderFoot(list)}</tr>`;
  },

  limparFiltros() {
    if (document.getElementById('adm-search')) document.getElementById('adm-search').value = '';
    if (document.getElementById('adm-cat')) document.getElementById('adm-cat').value = '';
    if (document.getElementById('adm-status')) document.getElementById('adm-status').value = '';
    if (document.getElementById('adm-di')) document.getElementById('adm-di').value = '';
    if (document.getElementById('adm-df')) document.getElementById('adm-df').value = '';
    this.aplicarFiltros();
  },

  // ─────────────────────────────────────────────────────────────
  // MODAL DE CADASTRO / EDIÇÃO DE DESPESA DO ESCRITÓRIO
  // ─────────────────────────────────────────────────────────────
  showForm(id = null) {
    const l = id ? DB.getById('lancamentos', id) : null;
    const isEdit = !!l;
    const contas = DB.getAll('contas');
    const mesAtual = new Date().toISOString().slice(0, 7);

    Utils.showModal(`
      <div class="modal" style="max-width:700px;width:95vw;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">🏢</span>
            <div>
              <div class="modal-title">${isEdit ? 'Editar Despesa do Escritório' : 'Nova Despesa Administrativa / Sede'}</div>
              <div style="font-size:.75rem;color:var(--text3);">Centro de Custo: Sede Central da Construtora</div>
            </div>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>

        <form id="form-adm-despesa" onsubmit="Escritorio.salvar(event, '${id || ''}')" style="padding:20px;">
          
          <div class="g2" style="margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label">Categoria Administrativa *</label>
              <select class="form-control" name="categoria" id="adm-form-cat" required onchange="Escritorio._onCatChange(this.value)">
                <optgroup label="💡 Contas de Consumo">
                  <option value="energia" ${l?.categoria==='energia'?'selected':''}>💡 Energia Elétrica (Luz)</option>
                  <option value="agua" ${l?.categoria==='agua'?'selected':''}>💧 Água e Esgoto</option>
                  <option value="internet_tel" ${l?.categoria==='internet_tel'?'selected':''}>🌐 Internet Fibra & Telefonia</option>
                </optgroup>
                <optgroup label="🏛️ Tributos & Impostos">
                  <option value="imposto_simples" ${l?.categoria==='imposto_simples'?'selected':''}>🏛️ DAS Simples Nacional</option>
                  <option value="tributos_trabalhistas" ${l?.categoria==='tributos_trabalhistas'?'selected':''}>📄 INSS / FGTS / Tributos Trabalhistas</option>
                  <option value="taxa" ${l?.categoria==='taxa'?'selected':''}>📋 Taxas Municipais / Alvará</option>
                </optgroup>
                <optgroup label="👥 Folha de Pagamento & Pessoal">
                  <option value="salario" ${l?.categoria==='salario'?'selected':''}>👥 Salário Funcionários Sede</option>
                  <option value="pro_labore" ${l?.categoria==='pro_labore'?'selected':''}>💼 Pró-Labore dos Sócios</option>
                  <option value="beneficios" ${l?.categoria==='beneficios'?'selected':''}>🎫 Benefícios (VT / VR)</option>
                </optgroup>
                <optgroup label="📣 Marketing">
                  <option value="marketing" ${l?.categoria==='marketing'?'selected':''}>📣 Marketing (Geral)</option>
                  <option value="trafego_pago" ${l?.categoria==='trafego_pago'?'selected':''}>🎯 Tráfego Pago</option>
                  <option value="comercial" ${l?.categoria==='comercial'?'selected':''}>🤝 Comercial</option>
                </optgroup>
                <optgroup label="🏢 Estrutura & Instalações">
                  <option value="aluguel_sede" ${l?.categoria==='aluguel_sede'?'selected':''}>🏢 Aluguel do Escritório</option>
                  <option value="material_escritorio" ${l?.categoria==='material_escritorio'?'selected':''}>📦 Material de Escritório & Copa/Café</option>
                  <option value="manutencao_sede" ${l?.categoria==='manutencao_sede'?'selected':''}>🔧 Manutenção Predial / Ar-condicionado</option>
                </optgroup>
                <optgroup label="⚖️ Serviços Profissionais & TI">
                  <option value="contabilidade" ${l?.categoria==='contabilidade'?'selected':''}>⚖️ Honorários Contábeis / Jurídico</option>
                  <option value="software_ti" ${l?.categoria==='software_ti'?'selected':''}>💻 Softwares (AutoCAD, Sistemas, Domínio)</option>
                  <option value="veiculos_sede" ${l?.categoria==='veiculos_sede'?'selected':''}>🚗 Veículos da Sede & Combustível</option>
                  <option value="outro" ${l?.categoria==='outro'?'selected':''}>📦 Outras Despesas</option>
                </optgroup>
                ${(() => {
                  const custom = this._getAllDespesaCats();
                  if (!custom.length) return '';
                  return `<optgroup label="⭐ Categorias Personalizadas">${
                    custom.map(c => `<option value="${c.value}" ${l?.categoria===c.value?'selected':''}>${c.label}</option>`).join('')
                  }</optgroup>`;
                })()}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Descrição do Custo *</label>
              <input class="form-control" name="descricao" id="adm-form-desc" value="${l?.descricao || ''}" placeholder="Ex: Conta de Luz — Sede Central" required>
            </div>
          </div>

          <div class="g3" style="margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label">Fornecedor / Concessionária / Órgão</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <select class="form-control" id="adm-forn-sel" onchange="Escritorio._onFornecedorChange(this)" style="flex:1;">
                  ${typeof Fornecedores !== 'undefined' ? Fornecedores.fornecedorOptions(l?.fornecedor_beneficiario||'') : '<option value="">Sem fornecedores cadastrados</option>'}
                </select>
                <button type="button" class="btn btn-secondary btn-sm" onclick="Fornecedores.showForm()" title="Cadastrar novo fornecedor" style="white-space:nowrap;">
                  ➕ Novo
                </button>
              </div>
              <input class="form-control" name="fornecedor_beneficiario" id="adm-form-forn" value="${l?.fornecedor_beneficiario || ''}" placeholder="Ou digite o nome do fornecedor / órgão" style="margin-top:6px;display:${l?.fornecedor_beneficiario && (!Fornecedores?.getByNome(l.fornecedor_beneficiario)) ? 'block' : 'none'};">
              <div id="adm-forn-info" style="margin-top:5px;font-size:.74rem;color:var(--accent2);display:none;"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Mês Competência</label>
              <input class="form-control" type="month" name="competencia" value="${l?.competencia || mesAtual}">
            </div>
            <div class="form-group">
              <label class="form-label">Valor (R$) *</label>
              <input class="form-control" type="number" step="0.01" min="0" name="valor" value="${l?.valor || ''}" placeholder="0,00" required style="font-weight:800;font-size:1.05rem;color:var(--danger);">
            </div>
          </div>

          <div class="g3" style="margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label">Data de Emissão</label>
              <input class="form-control" type="date" name="data" value="${l?.data || Utils.today()}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Data de Vencimento *</label>
              <input class="form-control" type="date" name="data_vencimento" value="${l?.data_vencimento || l?.data || Utils.today()}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Status *</label>
              <select class="form-control" name="status" required>
                <option value="a_pagar" ${l?.status==='a_pagar'?'selected':''}>⏳ A Pagar</option>
                <option value="pago" ${l?.status==='pago'?'selected':''}>✓ Pago</option>
              </select>
            </div>
          </div>

          <div class="g2" style="margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label">Conta Bancária</label>
              <select class="form-control" name="conta_bancaria">
                <option value="">Selecione a conta bancária...</option>
                ${contas.map(c => `<option value="${c.apelido || c.banco_nome}" ${l?.conta_bancaria===(c.apelido||c.banco_nome)?'selected':''}>${c.apelido || c.banco_nome} (${c.agencia}/${c.numero})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Linha Digitável / Código de Barras / Pix</label>
              <input class="form-control" name="codigo_barras" value="${l?.codigo_barras || ''}" placeholder="Cole a linha digitável do boleto ou chave Pix" style="font-family:monospace;font-size:.8rem;">
            </div>
          </div>

          <!-- ANEXO DIRETO DE GUIA / FATURA -->
          <div style="background:rgba(201,162,39,.04);border:1px solid rgba(201,162,39,.2);border-radius:8px;padding:12px;margin-bottom:14px;">
            <label class="form-label" style="color:var(--accent2);margin-bottom:4px;">📎 Anexar Fatura, Boleto ou Guia DAS (PDF ou Imagem)</label>
            <input type="file" id="adm-form-file" class="form-control" style="font-size:.8rem;padding:6px 10px;" accept=".pdf,.png,.jpg,.jpeg,.html,.txt">
          </div>

          <div class="modal-footer" style="padding:14px 0 0;border-top:1px solid var(--border);justify-content:space-between;">
            <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="font-weight:800;padding:10px 24px;">
              ${isEdit ? 'Salvar Alterações' : 'Cadastrar Despesa'}
            </button>
          </div>
        </form>
      </div>
    `);
  },

  _onFornecedorChange(sel) {
    const manual = document.getElementById('adm-form-forn');
    const info   = document.getElementById('adm-forn-info');
    if (!manual) return;

    if (sel.value === '__manual__') {
      manual.style.display = 'block';
      manual.value = '';
      manual.focus();
      if (info) info.style.display = 'none';
    } else if (sel.value === '') {
      manual.style.display = 'none';
      manual.value = '';
      if (info) info.style.display = 'none';
    } else {
      manual.style.display = 'none';
      manual.value = sel.value;
      const opt = sel.options[sel.selectedIndex];
      const cnpj = opt?.dataset?.cnpj || '';
      const cpf  = opt?.dataset?.cpf || '';
      const contato = opt?.dataset?.contato || '';
      if (info) {
        const parts = [];
        if (cnpj) parts.push(`CNPJ: ${cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')}`);
        if (cpf)  parts.push(`CPF: ${cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4')}`);
        if (contato) parts.push(`Contato: ${contato}`);
        if (parts.length) {
          info.style.display = 'block';
          info.innerHTML = parts.join(' &nbsp;·&nbsp; ');
        } else {
          info.style.display = 'none';
        }
      }
    }
  },

  _onCatChange(cat) {
    const descEl = document.getElementById('adm-form-desc');
    const fornEl = document.getElementById('adm-form-forn');
    const fornSel = document.getElementById('adm-forn-sel');
    if (!descEl || descEl.value) return;

    const defaults = {
      energia: { desc: 'Conta de Energia Elétrica — Sede', forn: 'Equatorial / Roraima Energia' },
      agua: { desc: 'Conta de Água e Esgoto — Sede', forn: 'CAER Companhia de Águas' },
      internet_tel: { desc: 'Internet Fibra Empresarial + Telefonia', forn: 'Vivo / Telefônica Brasil' },
      imposto_simples: { desc: 'Guia DAS — Simples Nacional', forn: 'Receita Federal do Brasil' },
      tributos_trabalhistas: { desc: 'Guia GPS / FGTS Folha Sede', forn: 'Caixa Econômica / Receita' },
      salario: { desc: 'Folha de Pagamento Funcionários Sede', forn: 'Colaboradores Sede' },
      pro_labore: { desc: 'Pró-Labore Sócios Administradores', forn: 'Sócios Angelim' },
      aluguel_sede: { desc: 'Aluguel Comercial Sede Escritório', forn: 'Imobiliária' },
      contabilidade: { desc: 'Honorários Contábeis Mensais', forn: 'Meta Contabilidade' },
      software_ti: { desc: 'Licenças Softwares AutoCAD / Cloud', forn: 'Autodesk / Google' }
    };

    if (defaults[cat]) {
      descEl.value = defaults[cat].desc;
      if (fornEl && !fornEl.value) {
        if (fornSel) {
          const match = Array.from(fornSel.options).find(o => o.value === defaults[cat].forn);
          if (match) {
            fornSel.value = match.value;
            fornEl.value = match.value;
            fornEl.style.display = 'none';
          } else {
            fornSel.value = '__manual__';
            fornEl.value = defaults[cat].forn;
            fornEl.style.display = 'block';
          }
        } else {
          fornEl.value = defaults[cat].forn;
        }
      }
    }
  },

  async salvar(event, id = '') {
    event.preventDefault();
    const form = event.target;
    const fd = new FormData(form);

    const dados = {
      obra_id: 'escritorio',
      centro_custo: 'escritorio',
      tipo: 'despesa',
      categoria: fd.get('categoria'),
      descricao: fd.get('descricao'),
      fornecedor_beneficiario: fd.get('fornecedor_beneficiario') || 'Fornecedor Sede',
      competencia: fd.get('competencia') || '',
      valor: parseFloat(fd.get('valor')) || 0,
      data: fd.get('data') || Utils.today(),
      data_vencimento: fd.get('data_vencimento') || Utils.today(),
      status: fd.get('status') || 'a_pagar',
      conta_bancaria: fd.get('conta_bancaria') || '',
      codigo_barras: fd.get('codigo_barras') || '',
      origem: 'manual',
      conciliado: fd.get('status') === 'pago'
    };

    let lancamentoId = id;

    if (id) {
      DB.update('lancamentos', id, dados);
      Utils.toast('Despesa do escritório atualizada com sucesso!', 'success');
    } else {
      const novo = DB.add('lancamentos', dados);
      lancamentoId = novo.id;
      Utils.toast('Despesa cadastrada no centro de custo do escritório!', 'success');
    }

    // Se houver anexo de fatura
    const fileInput = document.getElementById('adm-form-file');
    if (fileInput && fileInput.files && fileInput.files[0] && typeof Documentos !== 'undefined') {
      try {
        const file = fileInput.files[0];
        const base64 = await Documentos.lerArquivoBase64(file);
        Documentos.adicionar({
          entidade_tipo: 'lancamento',
          entidade_id: lancamentoId,
          titulo: `Fatura / Guia: ${dados.descricao}`,
          nome_arquivo: file.name,
          tipo_mime: file.type || 'application/octet-stream',
          tamanho: file.size,
          data_base64: base64
        });
        Utils.toast('Documento / Fatura anexada!', 'info');
      } catch (err) {
        console.error('Erro ao anexar fatura:', err);
      }
    }

    Utils.closeModal();
    App.navigate('escritorio');
  },

  marcarPago(id) {
    const l = DB.getById('lancamentos', id);
    if (!l) return;
    const contas = DB.getAll('contas');

    Utils.showModal(`
      <div class="modal" style="max-width:420px;width:95vw;">
        <div class="modal-header">
          <span class="modal-title">✓ Confirmar Pagamento</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:16px 20px;">
          <div style="font-weight:700;color:var(--text);margin-bottom:4px;">${l.descricao}</div>
          <div style="font-size:1.2rem;font-weight:900;color:var(--danger);margin-bottom:12px;">-${Utils.fmt.currency(l.valor)}</div>
          
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Conta Bancária de Saída</label>
            <select id="pago-conta" class="form-control">
              ${contas.map(c => `<option value="${c.apelido||c.banco_nome}">${c.apelido||c.banco_nome}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Data do Pagamento</label>
            <input type="date" id="pago-data" class="form-control" value="${Utils.today()}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-success" onclick="Escritorio.confirmarPagamento('${l.id}')" style="font-weight:800;">
            ✓ Confirmar Baixa
          </button>
        </div>
      </div>
    `);
  },

  confirmarPagamento(id) {
    const conta = document.getElementById('pago-conta')?.value || '';
    const dataPago = document.getElementById('pago-data')?.value || Utils.today();

    DB.update('lancamentos', id, {
      status: 'pago',
      data_pagamento: dataPago,
      conta_bancaria: conta,
      conciliado: true
    });

    Utils.closeModal();
    Utils.toast('Despesa baixada como Paga!', 'success');
    App.navigate('escritorio');
  },

  emitirRecibo(id) {
    const l = DB.getById('lancamentos', id);
    if (!l) return;
    if (typeof Recibos !== 'undefined') {
      Recibos.novoReciboModal({
        lancamento_id: l.id,
        valor: l.valor,
        tipo: 'pagamento',
        obra_id: 'escritorio',
        obra_nome: 'Sede / Escritório Central Angelim',
        beneficiario_nome: l.fornecedor_beneficiario,
        fornecedor_beneficiario: l.fornecedor_beneficiario,
        descricao: l.descricao,
        referente: `${l.descricao} (Competência: ${l.competencia || 'Mensal'})`,
        data: l.data
      });
    }
  },

  excluir(id) {
    const l = DB.getById('lancamentos', id);
    if (!l) return;
    Utils.confirm(`Deseja realmente excluir a despesa <strong>${l.descricao}</strong> (${Utils.fmt.currency(l.valor)})?`, () => {
      DB.remove('lancamentos', id);
      Utils.toast('Despesa removida!', 'info');
      App.navigate('escritorio');
    });
  },

  // ─────────────────────────────────────────────────────────────
  // MODAL PARA LANÇAR EM LOTE OS CUSTOS FIXOS DO MÊS
  // ─────────────────────────────────────────────────────────────
  abrirModalLote() {
    const mesAtual = new Date().toISOString().slice(0, 7);

    const pacotePadrao = [
      { id: 'fx_1', cat: 'aluguel_sede', desc: 'Aluguel Comercial — Sede Escritório', forn: 'Imobiliária Nova Era Ltda', valor: 3500, diaVenc: 10 },
      { id: 'fx_2', cat: 'energia', desc: 'Conta de Energia Elétrica — Sede', forn: 'Equatorial / Roraima Energia', valor: 1280, diaVenc: 15 },
      { id: 'fx_3', cat: 'agua', desc: 'Conta de Água e Esgoto — Sede', forn: 'CAER Companhia de Águas', valor: 340, diaVenc: 15 },
      { id: 'fx_4', cat: 'internet_tel', desc: 'Internet Fibra 500MB + Telefonia', forn: 'Vivo / Telefônica Brasil', valor: 249.90, diaVenc: 20 },
      { id: 'fx_5', cat: 'contabilidade', desc: 'Honorários Contábeis & Fiscais', forn: 'Meta Contabilidade & Consultoria', valor: 1800, diaVenc: 20 },
      { id: 'fx_6', cat: 'imposto_simples', desc: 'Guia DAS — Simples Nacional', forn: 'Receita Federal do Brasil', valor: 4850, diaVenc: 20 },
      { id: 'fx_7', cat: 'salario', desc: 'Folha de Pagamento Funcionários Sede', forn: 'Colaboradores Angelim Construtora', valor: 14200, diaVenc: 5 },
      { id: 'fx_8', cat: 'pro_labore', desc: 'Pró-Labore Sócios Administradores', forn: 'Sócios Administradores', valor: 10000, diaVenc: 5 },
      { id: 'fx_9', cat: 'software_ti', desc: 'Licenças Softwares AutoCAD & Google Workspace', forn: 'Autodesk & Google Cloud', valor: 680, diaVenc: 15 },
      { id: 'fx_10', cat: 'material_escritorio', desc: 'Material de Escritório, Papelaria & Café/Copa', forn: 'Papelaria Central', valor: 420, diaVenc: 25 }
    ];

    Utils.showModal(`
      <div class="modal" style="max-width:780px;width:95vw;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">⚡</span>
            <div>
              <div class="modal-title">Lançar Custos Fixos Recorrentes do Mês</div>
              <div style="font-size:.75rem;color:var(--text3);">Gere em lote todas as contas fixas do escritório para a competência desejada</div>
            </div>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>

        <div class="modal-body" style="padding:20px;overflow-y:auto;flex:1;">
          
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <label class="form-label" style="margin:0;font-weight:700;">Mês de Competência:</label>
              <input type="month" id="lote-competencia" class="form-control" value="${mesAtual}" style="width:160px;font-weight:700;color:var(--accent2);">
            </div>
            <div style="font-size:.75rem;color:var(--text3);">
              Dica: Desmarque as contas que não deseja gerar agora.
            </div>
          </div>

          <div class="tbl-wrap" style="border:1px solid var(--border);border-radius:8px;max-height:300px;overflow-y:auto;">
            <table style="font-size:.82rem;">
              <thead>
                <tr style="background:var(--bg-card);">
                  <th style="width:36px;text-align:center;"><input type="checkbox" checked onchange="Escritorio._toggleAllLote(this.checked)"></th>
                  <th>Despesa / Descrição</th>
                  <th>Categoria</th>
                  <th>Favorecido / Fornecedor</th>
                  <th style="width:80px;text-align:center;">Dia Venc.</th>
                  <th style="width:110px;text-align:right;">Valor (R$)</th>
                </tr>
              </thead>
              <tbody id="lote-tbody">
                ${pacotePadrao.map((it, idx) => `
                  <tr>
                    <td style="text-align:center;">
                      <input type="checkbox" class="lote-chk" checked data-idx="${idx}">
                    </td>
                    <td>
                      <input type="text" class="form-control lote-desc" value="${it.desc}" style="font-size:.8rem;padding:4px 6px;">
                    </td>
                    <td style="font-size:.75rem;color:var(--text2);white-space:nowrap;">
                      ${Utils.catLabel(it.cat)}
                      <input type="hidden" class="lote-cat" value="${it.cat}">
                    </td>
                    <td>
                      <input type="text" class="form-control lote-forn" value="${it.forn}" style="font-size:.8rem;padding:4px 6px;">
                    </td>
                    <td>
                      <input type="number" min="1" max="31" class="form-control lote-dia" value="${it.diaVenc}" style="font-size:.8rem;padding:4px 4px;text-align:center;">
                    </td>
                    <td>
                      <input type="number" step="0.01" min="0" class="form-control lote-valor" value="${it.valor}" style="font-size:.8rem;padding:4px 6px;text-align:right;font-weight:800;color:var(--danger);" oninput="Escritorio._recalcLoteTotal()">
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:14px;padding-top:10px;border-top:1px solid var(--border);">
            <span style="font-size:.85rem;color:var(--text2);font-weight:700;">TOTAL DO PACOTE DE CUSTOS FIXOS:</span>
            <span id="lote-total-display" style="font-size:1.25rem;font-weight:900;color:var(--danger);font-family:monospace;">
              ${Utils.fmt.currency(pacotePadrao.reduce((s, it) => s + it.valor, 0))}
            </span>
          </div>

        </div>

        <div class="modal-footer" style="padding:14px 20px;border-top:1px solid var(--border);justify-content:space-between;">
          <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button type="button" class="btn btn-primary" onclick="Escritorio.gerarLote()" style="font-weight:800;padding:10px 24px;">
            ⚡ Gerar Contas Fixas do Mês
          </button>
        </div>
      </div>
    `);
  },

  _toggleAllLote(checked) {
    document.querySelectorAll('.lote-chk').forEach(c => c.checked = checked);
    this._recalcLoteTotal();
  },

  _recalcLoteTotal() {
    let total = 0;
    document.querySelectorAll('#lote-tbody tr').forEach(row => {
      const chk = row.querySelector('.lote-chk');
      const valInput = row.querySelector('.lote-valor');
      if (chk && chk.checked && valInput) {
        total += parseFloat(valInput.value) || 0;
      }
    });
    const totalEl = document.getElementById('lote-total-display');
    if (totalEl) totalEl.textContent = Utils.fmt.currency(total);
  },

  gerarLote() {
    const comp = document.getElementById('lote-competencia')?.value || new Date().toISOString().slice(0, 7);
    const rows = document.querySelectorAll('#lote-tbody tr');
    let criados = 0;

    rows.forEach(row => {
      const chk = row.querySelector('.lote-chk');
      if (chk && chk.checked) {
        const desc = row.querySelector('.lote-desc')?.value;
        const cat = row.querySelector('.lote-cat')?.value || 'outro';
        const forn = row.querySelector('.lote-forn')?.value;
        const dia = parseInt(row.querySelector('.lote-dia')?.value) || 10;
        const valor = parseFloat(row.querySelector('.lote-valor')?.value) || 0;

        const diaFmt = String(dia).padStart(2, '0');
        const dataVenc = `${comp}-${diaFmt}`;

        DB.add('lancamentos', {
          obra_id: 'escritorio',
          centro_custo: 'escritorio',
          tipo: 'despesa',
          categoria: cat,
          descricao: desc,
          fornecedor_beneficiario: forn,
          competencia: comp,
          valor: valor,
          data: Utils.today(),
          data_vencimento: dataVenc,
          status: 'a_pagar',
          conta_bancaria: 'BB — Movimento Principal',
          origem: 'manual',
          conciliado: false
        });
        criados++;
      }
    });

    Utils.closeModal();
    Utils.toast(`${criados} despesas fixas do escritório geradas com sucesso para a competência ${comp}!`, 'success');
    App.navigate('escritorio');
  }
};
