// js/fornecedores.js — Módulo Integrado de Fornecedores

const Fornecedores = {

  // Categorias fixas do sistema (não podem ser excluídas)
  CATEGORIAS: [
    { value: 'material',      label: '🧱 Material de Construção' },
    { value: 'mao_de_obra',   label: '👷 Mão de Obra / Serviços' },
    { value: 'servico',       label: '🔧 Serviço / Prestador' },
    { value: 'equipamento',   label: '🏗️ Equipamento / Locação' },
    { value: 'contabilidade', label: '⚖️ Contábil / Jurídico' },
    { value: 'software_ti',   label: '💻 Software & TI' },
    { value: 'transporte',    label: '🚚 Transporte / Logística' },
    { value: 'marketing',     label: '📣 Marketing' },
    { value: 'trafego_pago',  label: '🎯 Tráfego Pago' },
    { value: 'comercial',     label: '🤝 Comercial' },
    { value: 'outros',        label: '📦 Outros' },
  ],

  // Chave do localStorage para categorias customizadas
  CATS_KEY: 'finobra_categorias_custom',

  // Retorna todas as categorias: fixas + customizadas
  _getAllCategorias() {
    const custom = JSON.parse(localStorage.getItem(this.CATS_KEY) || '[]');
    return [...this.CATEGORIAS, ...custom];
  },

  // Retorna apenas as categorias customizadas
  _getCustomCategorias() {
    return JSON.parse(localStorage.getItem(this.CATS_KEY) || '[]');
  },

  // Salva as categorias customizadas
  _saveCustomCategorias(list) {
    localStorage.setItem(this.CATS_KEY, JSON.stringify(list));
  },

  // ─────────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ─────────────────────────────────────────────────────────────
  render(obraId) {
    const fornecedores = DB.getAll('fornecedores');
    const ativos = fornecedores.filter(f => f.ativo !== false);
    const inativos = fornecedores.filter(f => f.ativo === false);

    // KPIs por categoria
    const kpiCats = {};
    this._getAllCategorias().forEach(c => {
      kpiCats[c.value] = fornecedores.filter(f => f.categoria === c.value).length;
    });
    const topCats = Object.entries(kpiCats).sort((a,b)=>b[1]-a[1]).slice(0,3).filter(([,v])=>v>0);

    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">🏭 Fornecedores</h1>
        <p class="page-sub">Cadastro integrado com consulta automática à Receita Federal via CNPJ</p>
      </div>
      <div class="page-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="Fornecedores.limparDuplicados()" title="Verificar e unificar registros com mesmo CNPJ ou nome">🧹 Unificar Duplicados</button>
        <button class="btn btn-primary" onclick="Fornecedores.showForm()">+ Novo Fornecedor</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="g4" style="margin-bottom:16px;">
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">Total Cadastrados</div>
        <div class="kpi-value blue" style="font-size:1.4rem;">${fornecedores.length}</div>
      </div>
      <div class="kpi-card" style="padding:14px;border:1px solid rgba(16,185,129,.25);">
        <div class="kpi-label">Ativos</div>
        <div class="kpi-value green" style="font-size:1.4rem;">${ativos.length}</div>
      </div>
      <div class="kpi-card" style="padding:14px;border:1px solid rgba(239,68,68,.2);">
        <div class="kpi-label">Inativos</div>
        <div class="kpi-value red" style="font-size:1.4rem;">${inativos.length}</div>
      </div>
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">Top Categorias</div>
        <div style="font-size:.78rem;margin-top:4px;display:flex;flex-direction:column;gap:2px;">
          ${topCats.length ? topCats.map(([v,n]) => {
            const cat = this._getAllCategorias().find(c=>c.value===v);
            return `<span style="color:var(--accent2);">${cat?.label||v}: <strong>${n}</strong></span>`;
          }).join('') : '<span style="color:var(--text3);">Nenhum cadastrado</span>'}
        </div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="filters-bar">
      <div class="filter-group" style="flex:1">
        <label class="filter-label">Buscar</label>
        <div class="search-bar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="form-control" id="forn-search" placeholder="Razão social, fantasia, CNPJ, cidade..." oninput="Fornecedores.aplicarFiltros()">
        </div>
      </div>
      <div class="filter-group">
        <label class="filter-label">Categoria</label>
        <select class="form-control" id="forn-cat" style="min-width:170px" onchange="Fornecedores.aplicarFiltros()">
          <option value="">Todas</option>
          ${this._getAllCategorias().map(c=>`<option value="${c.value}">${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">UF</label>
        <select class="form-control" id="forn-uf" style="min-width:80px" onchange="Fornecedores.aplicarFiltros()">
          <option value="">Todas</option>
          ${[...new Set(fornecedores.map(f=>f.uf).filter(Boolean))].sort().map(uf=>`<option value="${uf}">${uf}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="form-control" id="forn-status" style="min-width:110px" onchange="Fornecedores.aplicarFiltros()">
          <option value="">Todos</option>
          <option value="ativo">✅ Ativo</option>
          <option value="inativo">⛔ Inativo</option>
        </select>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="Fornecedores.limparFiltros()" style="align-self:flex-end">Limpar</button>
    </div>

    <!-- Tabela -->
    <div class="card" style="padding:0;">
      <div class="tbl-wrap" style="border:none;border-radius:14px;">
        <table>
          <thead><tr>
            <th>CPF / CNPJ</th>
            <th>Razão Social / Fantasia</th>
            <th>Categoria</th>
            <th>Município / UF</th>
            <th>Telefone</th>
            <th>Email</th>
            <th>Prazo Pag.</th>
            <th>Status</th>
            <th style="text-align:center;">Ações</th>
          </tr></thead>
          <tbody id="forn-tbody">${this._renderRows(fornecedores)}</tbody>
        </table>
      </div>
    </div>`;
  },

  _renderRows(list) {
    if (!list.length) {
      return `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:36px;">
        <div style="font-size:2rem;margin-bottom:8px;">🏭</div>
        <div style="font-weight:600;margin-bottom:4px;">Nenhum fornecedor cadastrado</div>
        <div style="font-size:.82rem;">Clique em "+ Novo Fornecedor" para começar</div>
      </td></tr>`;
    }
    return list.map(f => {
      const cat = this._getAllCategorias().find(c=>c.value===f.categoria);
      const isAtivo = f.ativo !== false;
      const cnpjVal = f.cnpj || f.cnpj_cpf || '';
      const docFmt = f.tipo_pessoa === 'pf'
        ? this._fmtCpf(f.cpf || cnpjVal)
        : this._fmtCnpj(cnpjVal);
      const docBadge = f.tipo_pessoa === 'pf'
        ? `<span style="font-size:.62rem;background:rgba(99,102,241,.15);color:#818cf8;border-radius:4px;padding:1px 5px;margin-right:4px;">PF</span>`
        : `<span style="font-size:.62rem;background:rgba(201,162,39,.13);color:var(--accent2);border-radius:4px;padding:1px 5px;margin-right:4px;">PJ</span>`;
      const razao = f.razao_social || f.nome || '—';
      const fant = (f.nome_fantasia && f.nome_fantasia !== razao) ? f.nome_fantasia : (f.nome && f.nome !== razao ? f.nome : '');
      return `<tr>
        <td style="font-family:monospace;font-size:.78rem;color:var(--accent2);white-space:nowrap;">${docBadge}${docFmt || '—'}</td>
        <td>
          <div style="font-weight:700;font-size:.88rem;">${razao}</div>
          ${fant ? `<div style="font-size:.72rem;color:var(--text3);">${fant}</div>` : ''}
        </td>
        <td style="white-space:nowrap;font-size:.8rem;">${cat?.label || f.categoria || '—'}</td>
        <td style="font-size:.78rem;color:var(--text2);">${[f.municipio, f.uf].filter(Boolean).join(' / ') || 'Boa Vista / RR'}</td>
        <td style="font-size:.78rem;white-space:nowrap;">${f.telefone || '—'}</td>
        <td style="font-size:.75rem;color:var(--text3);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.email || '—'}</td>
        <td style="font-size:.78rem;text-align:center;">${f.prazo_pagamento ? `${f.prazo_pagamento}d` : '—'}</td>
        <td style="text-align:center;">
          ${isAtivo
            ? `<span class="badge badge-success">✅ Ativo</span>`
            : `<span class="badge badge-danger">⛔ Inativo</span>`}
        </td>
        <td style="text-align:center;">
          <div style="display:flex;gap:4px;justify-content:center;">
            <button class="icon-btn" onclick="Fornecedores.showForm('${f.id}')" title="Editar">✏️</button>
            <button class="icon-btn" onclick="Fornecedores.toggleAtivo('${f.id}')" title="${isAtivo?'Desativar':'Ativar'}" style="color:${isAtivo?'var(--warning)':'var(--success)'};">${isAtivo?'⛔':'✅'}</button>
            <button class="icon-btn" onclick="Fornecedores.excluir('${f.id}')" title="Excluir" style="color:var(--danger);">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  aplicarFiltros() {
    const search = (document.getElementById('forn-search')?.value || '').toLowerCase();
    const cat    = document.getElementById('forn-cat')?.value || '';
    const uf     = document.getElementById('forn-uf')?.value || '';
    const status = document.getElementById('forn-status')?.value || '';

    let list = DB.getAll('fornecedores');
    if (cat)    list = list.filter(f => f.categoria === cat);
    if (uf)     list = list.filter(f => f.uf === uf);
    if (status === 'ativo')   list = list.filter(f => f.ativo !== false);
    if (status === 'inativo') list = list.filter(f => f.ativo === false);
    if (search) list = list.filter(f =>
      (f.razao_social||'').toLowerCase().includes(search) ||
      (f.nome_fantasia||'').toLowerCase().includes(search) ||
      (f.cnpj||'').includes(search.replace(/\D/g,'')) ||
      (f.cpf||'').includes(search.replace(/\D/g,'')) ||
      (f.municipio||'').toLowerCase().includes(search) ||
      (f.email||'').toLowerCase().includes(search)
    );

    const tbody = document.getElementById('forn-tbody');
    if (tbody) tbody.innerHTML = this._renderRows(list);
  },

  limparFiltros() {
    ['forn-search','forn-cat','forn-uf','forn-status'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    this.aplicarFiltros();
  },

  // ─────────────────────────────────────────────────────────────
  // FORMULÁRIO DE CADASTRO / EDIÇÃO
  // ─────────────────────────────────────────────────────────────
  showForm(id = null) {
    const f = id ? DB.getById('fornecedores', id) : null;
    const isEdit = !!f;
    const isPF   = f?.tipo_pessoa === 'pf';

    Utils.showModal(`
      <div class="modal" style="max-width:780px;width:95vw;max-height:92vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">🏭</span>
            <div>
              <div class="modal-title">${isEdit ? 'Editar Fornecedor / Prestador' : 'Novo Fornecedor / Prestador'}</div>
              <div style="font-size:.74rem;color:var(--text3);">Pessoa Jurídica ou Pessoa Física</div>
            </div>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>

        <div class="modal-body" style="padding:20px;overflow-y:auto;flex:1;">
          <form id="form-fornecedor">

            <!-- Toggle PJ / PF -->
            <div style="display:flex;gap:0;margin-bottom:18px;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
              <button type="button" id="btn-tipo-pj"
                onclick="Fornecedores._onTipoChange('pj')"
                style="flex:1;padding:10px;font-size:.85rem;font-weight:700;border:none;cursor:pointer;
                  background:${isPF ? 'transparent' : 'var(--accent2)'};
                  color:${isPF ? 'var(--text2)' : '#0f172a'};
                  transition:all .2s;">
                🏢 Pessoa Jurídica (PJ)
              </button>
              <button type="button" id="btn-tipo-pf"
                onclick="Fornecedores._onTipoChange('pf')"
                style="flex:1;padding:10px;font-size:.85rem;font-weight:700;border:none;cursor:pointer;
                  background:${isPF ? 'var(--accent2)' : 'transparent'};
                  color:${isPF ? '#0f172a' : 'var(--text2)'};
                  transition:all .2s;">
                👤 Pessoa Física (PF)
              </button>
            </div>
            <input type="hidden" id="forn-tipo-pessoa" name="tipo_pessoa" value="${isPF ? 'pf' : 'pj'}">

            <!-- BLOCO PJ: CNPJ com Consulta -->
            <div id="bloco-pj" style="${isPF ? 'display:none;' : ''}background:linear-gradient(135deg,rgba(201,162,39,.08),rgba(201,162,39,.04));border:1px solid rgba(201,162,39,.25);border-radius:10px;padding:16px;margin-bottom:18px;">
              <div style="font-size:.78rem;font-weight:700;color:var(--accent2);margin-bottom:10px;letter-spacing:.04em;">🔍 CONSULTA RECEITA FEDERAL — CNPJ</div>
              <div style="display:flex;gap:10px;align-items:flex-end;">
                <div class="form-group" style="flex:1;margin-bottom:0;">
                  <label class="form-label">CNPJ</label>
                  <input class="form-control" id="forn-cnpj-input" name="cnpj"
                    value="${f?.cnpj ? this._fmtCnpj(f.cnpj) : ''}"
                    placeholder="00.000.000/0000-00"
                    style="font-family:monospace;font-size:1rem;letter-spacing:.05em;"
                    oninput="Fornecedores._onCnpjInput(this)"
                    maxlength="18">
                </div>
                <button type="button" class="btn btn-primary" id="btn-consultar-cnpj"
                  onclick="Fornecedores.consultarCnpj()"
                  style="white-space:nowrap;padding:10px 18px;">
                  🔍 Consultar RF
                </button>
              </div>
              <div id="cnpj-status" style="margin-top:8px;font-size:.78rem;display:none;"></div>
            </div>

            <!-- BLOCO PF: CPF -->
            <div id="bloco-pf" style="${isPF ? '' : 'display:none;'}background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(99,102,241,.04));border:1px solid rgba(99,102,241,.25);border-radius:10px;padding:16px;margin-bottom:18px;">
              <div style="font-size:.78rem;font-weight:700;color:#818cf8;margin-bottom:10px;letter-spacing:.04em;">👤 DADOS DA PESSOA FÍSICA</div>
              <div class="form-group" style="margin-bottom:0;max-width:260px;">
                <label class="form-label">CPF</label>
                <input class="form-control" id="forn-cpf-input" name="cpf"
                  value="${f?.cpf ? this._fmtCpf(f.cpf) : ''}"
                  placeholder="000.000.000-00"
                  style="font-family:monospace;font-size:1rem;letter-spacing:.05em;"
                  oninput="Fornecedores._onCpfInput(this)"
                  maxlength="14">
              </div>
            </div>

            <!-- Razão Social / Nome e Fantasia -->
            <div class="g2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label" id="label-razao">${isPF ? 'Nome Completo *' : 'Razão Social *'}</label>
                <input class="form-control" id="forn-razao" name="razao_social"
                  value="${f?.razao_social||''}" required placeholder="${isPF ? 'Nome completo da pessoa' : 'Nome jurídico completo'}">
              </div>
              <div class="form-group" id="grupo-fantasia" style="${isPF ? 'display:none;' : ''}">
                <label class="form-label">Nome Fantasia</label>
                <input class="form-control" id="forn-fantasia" name="nome_fantasia"
                  value="${f?.nome_fantasia||''}" placeholder="Nome comercial / como é conhecido">
              </div>
            </div>

            <!-- Categoria, Telefone, Email -->
            <div class="g3" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Categoria *</label>
                <select class="form-control" name="categoria" required>
                  <option value="">Selecione...</option>
                  ${this._getAllCategorias().map(c=>`<option value="${c.value}" ${f?.categoria===c.value?'selected':''}>${c.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Telefone</label>
                <input class="form-control" id="forn-tel" name="telefone"
                  value="${f?.telefone||''}" placeholder="(xx) 9 xxxx-xxxx">
              </div>
              <div class="form-group">
                <label class="form-label">E-mail</label>
                <input class="form-control" id="forn-email" name="email" type="email"
                  value="${f?.email||''}" placeholder="contato@empresa.com.br">
              </div>
            </div>

            <!-- Endereço -->
            <div style="background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;">
              <div style="font-size:.76rem;font-weight:700;color:var(--text3);margin-bottom:10px;letter-spacing:.04em;">📍 ENDEREÇO</div>
              <div class="g3" style="margin-bottom:10px;">
                <div class="form-group" style="grid-column:span 2;">
                  <label class="form-label">Logradouro</label>
                  <input class="form-control" id="forn-end" name="endereco"
                    value="${f?.endereco||''}" placeholder="Rua, Av., Rodovia...">
                </div>
                <div class="form-group">
                  <label class="form-label">Nº / Complemento</label>
                  <input class="form-control" id="forn-numero" name="numero"
                    value="${f?.numero||''}" placeholder="Nº, Sala, Galpão...">
                </div>
              </div>
              <div class="g4">
                <div class="form-group">
                  <label class="form-label">Bairro</label>
                  <input class="form-control" id="forn-bairro" name="bairro"
                    value="${f?.bairro||''}" placeholder="Bairro">
                </div>
                <div class="form-group">
                  <label class="form-label">Município</label>
                  <input class="form-control" id="forn-municipio" name="municipio"
                    value="${f?.municipio||''}" placeholder="Cidade">
                </div>
                <div class="form-group">
                  <label class="form-label">UF</label>
                  <input class="form-control" id="forn-uf-inp" name="uf"
                    value="${f?.uf||''}" placeholder="Ex: PA" maxlength="2" style="text-transform:uppercase;">
                </div>
                <div class="form-group">
                  <label class="form-label">CEP</label>
                  <input class="form-control" id="forn-cep" name="cep"
                    value="${f?.cep||''}" placeholder="00000-000">
                </div>
              </div>
            </div>

            <!-- Contato e Financeiro -->
            <div class="g3" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Nome do Contato</label>
                <input class="form-control" name="contato_nome"
                  value="${f?.contato_nome||''}" placeholder="Responsável comercial">
              </div>
              <div class="form-group">
                <label class="form-label">Cargo / Função</label>
                <input class="form-control" name="contato_cargo"
                  value="${f?.contato_cargo||''}" placeholder="Vendedor, Gerente...">
              </div>
              <div class="form-group">
                <label class="form-label">Prazo de Pagamento (dias)</label>
                <input class="form-control" name="prazo_pagamento" type="number" min="0" max="999"
                  value="${f?.prazo_pagamento||''}" placeholder="Ex: 28">
              </div>
            </div>

            <!-- Status e Observações -->
            <div class="g2" style="margin-bottom:4px;">
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-control" name="ativo">
                  <option value="true" ${f?.ativo !== false ? 'selected':''}>✅ Ativo</option>
                  <option value="false" ${f?.ativo === false ? 'selected':''}>⛔ Inativo</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Observações</label>
                <input class="form-control" name="observacoes"
                  value="${f?.observacoes||''}" placeholder="Notas internas sobre o fornecedor">
              </div>
            </div>

          </form>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="Fornecedores.salvar('${id||''}')">
            ${isEdit ? '✔ Salvar Alterações' : '+ Cadastrar Fornecedor'}
          </button>
        </div>
      </div>`);
  },

  // ─────────────────────────────────────────────────────────────
  // TOGGLE PJ / PF
  // ─────────────────────────────────────────────────────────────
  _onTipoChange(tipo) {
    const isPF = tipo === 'pf';
    const hiddenEl = document.getElementById('forn-tipo-pessoa');
    if (hiddenEl) hiddenEl.value = tipo;

    const btnPJ = document.getElementById('btn-tipo-pj');
    const btnPF = document.getElementById('btn-tipo-pf');
    if (btnPJ) { btnPJ.style.background = isPF ? 'transparent' : 'var(--accent2)'; btnPJ.style.color = isPF ? 'var(--text2)' : '#0f172a'; }
    if (btnPF) { btnPF.style.background = isPF ? 'var(--accent2)' : 'transparent'; btnPF.style.color = isPF ? '#0f172a' : 'var(--text2)'; }

    const blPJ = document.getElementById('bloco-pj');
    const blPF = document.getElementById('bloco-pf');
    if (blPJ) blPJ.style.display = isPF ? 'none' : '';
    if (blPF) blPF.style.display = isPF ? '' : 'none';

    const labelRazao = document.getElementById('label-razao');
    const inputRazao = document.getElementById('forn-razao');
    const grupoFantasia = document.getElementById('grupo-fantasia');
    if (labelRazao) labelRazao.textContent = isPF ? 'Nome Completo *' : 'Razão Social *';
    if (inputRazao) inputRazao.placeholder = isPF ? 'Nome completo da pessoa' : 'Nome jurídico completo';
    if (grupoFantasia) grupoFantasia.style.display = isPF ? 'none' : '';
  },

  // ─────────────────────────────────────────────────────────────
  // CONSULTA CNPJ — BrasilAPI
  // ─────────────────────────────────────────────────────────────
  _onCnpjInput(el) {
    // Aplica máscara automática ao digitar
    let v = el.value.replace(/\D/g,'').slice(0,14);
    if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
    else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})/,'$1.$2.$3/$4');
    else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{3})/,'$1.$2.$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{3})/,'$1.$2');
    el.value = v;
    // Auto-consultar quando 14 dígitos digitados
    if (v.replace(/\D/g,'').length === 14) {
      setTimeout(() => Fornecedores.consultarCnpj(), 200);
    }
  },

  _onCpfInput(el) {
    // Aplica máscara CPF: 000.000.000-00
    let v = el.value.replace(/\D/g,'').slice(0,11);
    if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/^(\d{3})(\d{1,3})$/, '$1.$2');
    el.value = v;
  },

  _setStatus(msg, type) {
    const el = document.getElementById('cnpj-status');
    if (!el) return;
    const colors = { loading:'var(--accent2)', success:'var(--success)', error:'var(--danger)', warn:'var(--warning)' };
    el.style.display = 'block';
    el.style.color = colors[type] || 'var(--text2)';
    el.innerHTML = msg;
  },

  async consultarCnpj() {
    const inputEl = document.getElementById('forn-cnpj-input');
    const btnEl   = document.getElementById('btn-consultar-cnpj');
    if (!inputEl) return;

    const cnpj = (inputEl.value || '').replace(/\D/g,'');
    if (cnpj.length !== 14) {
      this._setStatus('❌ CNPJ deve ter 14 dígitos.', 'error');
      return;
    }

    // Spinner no botão
    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<span style="display:inline-block;animation:spin .7s linear infinite;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;width:14px;height:14px;"></span> Consultando...'; }
    this._setStatus('⏳ Consultando Receita Federal via BrasilAPI...', 'loading');

    try {
      const res = await fetch(`/api/cnpj?cnpj=${cnpj}`);
      if (!res.ok) {
        const errData = await res.json().catch(()=>({}));
        throw new Error(errData.message || `CNPJ não encontrado (status ${res.status})`);
      }
      const d = await res.json();
      this._preencherCampos(d, cnpj);
      this._setStatus(`✅ Dados carregados com sucesso! <strong>${d.razao_social}</strong>`, 'success');
    } catch(err) {
      this._setStatus(`❌ Erro: ${err.message}`, 'error');
    } finally {
      if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '🔍 Consultar RF'; }
    }
  },

  _preencherCampos(d, cnpjRaw) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    };
    // Formata CNPJ com máscara
    const cnpjFmt = this._fmtCnpj(cnpjRaw);
    set('forn-cnpj-input', cnpjFmt);
    set('forn-razao',      d.razao_social || '');
    set('forn-fantasia',   d.nome_fantasia || d.razao_social || '');
    // Telefone: BrasilAPI retorna ddd_telefone_1 como "61 99999-9999" ou "(61) 99999-9999"
    const tel = d.ddd_telefone_1 || '';
    set('forn-tel', tel);
    set('forn-email',      d.email || '');
    set('forn-end',        d.logradouro || '');
    set('forn-numero',     d.numero || '');
    set('forn-bairro',     d.bairro || '');
    set('forn-municipio',  d.municipio || '');
    set('forn-uf-inp',     d.uf || '');
    set('forn-cep',        (d.cep||'').replace(/^(\d{5})(\d{3})$/, '$1-$2'));
  },

  // ─────────────────────────────────────────────────────────────
  // SALVAR
  // ─────────────────────────────────────────────────────────────
  salvar(id) {
    const form = document.getElementById('form-fornecedor');
    if (!form || !form.checkValidity()) { form?.reportValidity(); return; }
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);

    const isPF = data.tipo_pessoa === 'pf';

    // Normaliza documentos (só dígitos no banco)
    data.cnpj = isPF ? '' : (data.cnpj || '').replace(/\D/g,'');
    data.cpf  = isPF ? (data.cpf  || '').replace(/\D/g,'') : '';
    data.ativo = data.ativo !== 'false';
    data.prazo_pagamento = data.prazo_pagamento ? parseInt(data.prazo_pagamento) : null;

    const nomeNorm = (data.nome_fantasia || data.razao_social || '').trim().toLowerCase();
    const razaoNorm = (data.razao_social || '').trim().toLowerCase();

    if (id) {
      // Checa duplicidade em outros registros
      const outros = DB.getAll('fornecedores').filter(f => f.id !== id);
      if (!isPF && data.cnpj && outros.some(f => f.cnpj === data.cnpj)) {
        Utils.toast(`⚠ Outro fornecedor já possui este CNPJ`, 'warning');
        return;
      }
      if (isPF && data.cpf && outros.some(f => f.cpf === data.cpf)) {
        Utils.toast(`⚠ Outro fornecedor já possui este CPF`, 'warning');
        return;
      }
      DB.update('fornecedores', id, data);
      Utils.toast('Cadastro atualizado com sucesso!', 'success');
    } else {
      // 1. Verifica duplicação por CNPJ ou CPF
      if (!isPF && data.cnpj) {
        const exist = DB.getAll('fornecedores').find(f => f.cnpj === data.cnpj);
        if (exist) {
          Utils.toast(`⚠ CNPJ já cadastrado: ${exist.razao_social || exist.nome_fantasia}`, 'warning');
          return;
        }
      }
      if (isPF && data.cpf) {
        const exist = DB.getAll('fornecedores').find(f => f.cpf === data.cpf);
        if (exist) {
          Utils.toast(`⚠ CPF já cadastrado: ${exist.razao_social || exist.nome_fantasia}`, 'warning');
          return;
        }
      }
      // 2. Verifica duplicação por Nome / Razão Social
      if (razaoNorm) {
        const existNome = DB.getAll('fornecedores').find(f => {
          const fRazao = (f.razao_social || '').trim().toLowerCase();
          const fFantasia = (f.nome_fantasia || '').trim().toLowerCase();
          return (fRazao && fRazao === razaoNorm) || (fFantasia && fFantasia === nomeNorm);
        });
        if (existNome) {
          Utils.toast(`⚠ Fornecedor já cadastrado com este nome: ${existNome.razao_social || existNome.nome_fantasia}`, 'warning');
          return;
        }
      }

      DB.add('fornecedores', data);
      Utils.toast('Cadastro realizado com sucesso!', 'success');
    }
    Utils.closeModal();
    this._refresh();
  },

  toggleAtivo(id) {
    const f = DB.getById('fornecedores', id);
    if (!f) return;
    const novoStatus = f.ativo !== false ? false : true;
    DB.update('fornecedores', id, { ativo: novoStatus });
    Utils.toast(novoStatus ? 'Fornecedor ativado!' : 'Fornecedor desativado.', 'info');
    this._refresh();
  },

  excluir(id) {
    Utils.confirm('Excluir este fornecedor permanentemente?', () => {
      DB.remove('fornecedores', id);
      Utils.toast('Fornecedor excluído.', 'info');
      this._refresh();
    });
  },

  _refresh() {
    const tbody = document.getElementById('forn-tbody');
    if (!tbody) return;
    this.aplicarFiltros();
  },

  // ─────────────────────────────────────────────────────────────
  // HELPERS PARA INTEGRAÇÃO EM OUTROS MÓDULOS
  // ─────────────────────────────────────────────────────────────

  /**
   * Retorna <option> tags para uso em selects de outros módulos.
   * selectedVal = string que identifica o fornecedor selecionado (nome fantasia ou razão social)
   * includeManual = se deve adicionar opção "Digitar manualmente..."
   */
  fornecedorOptions(selectedVal, includeManual = true) {
    const lista = DB.getAll('fornecedores').filter(f => f.ativo !== false);
    let html = `<option value="">Selecione um fornecedor cadastrado...</option>`;
    if (lista.length === 0) {
      html += `<option value="" disabled>— Nenhum fornecedor ativo cadastrado —</option>`;
    } else {
      // Agrupar por categoria
      const catMap = {};
      lista.forEach(f => {
        const k = f.categoria || 'outros';
        if (!catMap[k]) catMap[k] = [];
        catMap[k].push(f);
      });
      this._getAllCategorias().forEach(cat => {
        const grupo = catMap[cat.value];
        if (!grupo || !grupo.length) return;
        html += `<optgroup label="${cat.label}">`;
        grupo.forEach(f => {
          const doc = f.tipo_pessoa === 'pf'
            ? (f.cpf ? this._fmtCpf(f.cpf) : '')
            : (f.cnpj ? this._fmtCnpj(f.cnpj) : '');
          const label = f.nome_fantasia || f.razao_social || doc || '—';
          const val   = f.nome_fantasia || f.razao_social;
          const sel   = selectedVal === val ? 'selected' : '';
          const docFmt = doc ? ` — ${doc}` : '';
          html += `<option value="${val}" data-id="${f.id}" data-tipo="${f.tipo_pessoa||'pj'}" data-cnpj="${f.cnpj||''}" data-cpf="${f.cpf||''}" data-contato="${f.contato_nome||''}" ${sel}>${label}${docFmt}</option>`;
        });
        html += `</optgroup>`;
      });
    }
    if (includeManual) {
      html += `<option value="__manual__">✎ Digitar manualmente...</option>`;
    }
    return html;
  },

  /**
   * Retorna o objeto fornecedor pelo nome (fantasia ou razão social).
   */
  getByNome(nome) {
    if (!nome) return null;
    const n = nome.trim().toLowerCase();
    const lista = DB.getAll('fornecedores');
    return lista.find(f => (f.nome_fantasia && f.nome_fantasia.trim().toLowerCase() === n) || (f.razao_social && f.razao_social.trim().toLowerCase() === n)) || null;
  },

  /**
   * Encontra fornecedor existente por CNPJ/CPF ou nome, ou cadastra automaticamente se não existir.
   */
  encontrarOuCriar(dados) {
    if (!dados) return null;
    const nome = (dados.nome_fantasia || dados.razao_social || '').trim();
    const cnpj = (dados.cnpj || '').replace(/\D/g, '');
    const cpf  = (dados.cpf || '').replace(/\D/g, '');
    const lista = DB.getAll('fornecedores');

    // 1. Busca por CNPJ
    if (cnpj) {
      const achado = lista.find(f => (f.cnpj || '').replace(/\D/g, '') === cnpj);
      if (achado) return achado;
    }
    // 2. Busca por CPF
    if (cpf) {
      const achado = lista.find(f => (f.cpf || '').replace(/\D/g, '') === cpf);
      if (achado) return achado;
    }
    // 3. Busca por Nome
    if (nome) {
      const achado = this.getByNome(nome);
      if (achado) return achado;
    }

    // Não existe: cadastra novo
    const novo = {
      tipo_pessoa: dados.tipo_pessoa || (cpf ? 'pf' : 'pj'),
      razao_social: dados.razao_social || nome,
      nome_fantasia: dados.nome_fantasia || nome,
      cnpj: cnpj,
      cpf: cpf,
      categoria: dados.categoria || 'material',
      telefone: dados.telefone || '',
      email: dados.email || '',
      ativo: true
    };
    return DB.add('fornecedores', novo);
  },

  /**
   * Remove registros duplicados existentes no banco de dados, unificando por CNPJ ou nome.
   */
  limparDuplicados() {
    const lista = DB.getAll('fornecedores');
    const vistos = new Set();
    const unicos = [];
    let removidos = 0;

    lista.forEach(f => {
      const doc = (f.cnpj || f.cpf || '').replace(/\D/g, '');
      const nome = (f.razao_social || f.nome_fantasia || '').trim().toLowerCase();
      const chave = doc ? `doc_${doc}` : `nome_${nome}`;

      if (chave && vistos.has(chave)) {
        removidos++;
      } else {
        if (chave) vistos.add(chave);
        unicos.push(f);
      }
    });

    if (removidos > 0) {
      DB.save('fornecedores', unicos);
      Utils.toast(`Foram unificados/removidos ${removidos} fornecedor(es) duplicado(s).`, 'success');
      this._refresh();
    } else {
      Utils.toast('Nenhum fornecedor duplicado encontrado.', 'info');
    }
  },

  // ─────────────────────────────────────────────────────────────
  // UTILIDADES
  // ─────────────────────────────────────────────────────────────
  _fmtCnpj(v) {
    const d = (v||'').replace(/\D/g,'');
    if (d.length !== 14) return v;
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  },

  _fmtCpf(v) {
    const d = (v||'').replace(/\D/g,'');
    if (d.length !== 11) return v;
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  },

  init() {},
};
