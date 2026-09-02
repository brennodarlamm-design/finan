// js/produtos.js — Módulo de Cadastro e Rastreamento de Produtos

const Produtos = {

  CATEGORIAS: [
    { value: 'material',    label: '🧱 Material de Construção' },
    { value: 'mao_de_obra', label: '👷 Mão de Obra' },
    { value: 'servico',     label: '🔧 Serviço' },
    { value: 'equipamento', label: '🏗️ Equipamento' },
    { value: 'outro',       label: '📦 Outro' },
  ],

  // ────────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ────────────────────────────────────────────────────────────
  render(obraId) {
    this.sincronizarComLancamentos();
    const produtos = DB.getAll('produtos');
    const analise  = this.getAnaliseGastos(obraId === 'todas' ? null : obraId);
    const totalGasto = analise.reduce((s, p) => s + p.total, 0);

    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">📦 Produtos / Insumos</h1>
        <p class="page-sub">Cadastro e rastreamento de consumo de materiais por obra</p>
      </div>
      <div class="page-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="Produtos.showAnalise()" style="display:flex;align-items:center;gap:6px;">
          📊 Análise de Consumo
        </button>
        <button class="btn btn-primary" onclick="Produtos.showForm()">+ Novo Produto</button>
      </div>
    </div>

    <div class="g4" style="margin-bottom:16px;">
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">Produtos Cadastrados</div>
        <div class="kpi-value blue" style="font-size:1.4rem;">${produtos.length}</div>
      </div>
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">Total Gasto (rastreado)</div>
        <div class="kpi-value red" style="font-size:1.2rem;">${Utils.fmt.currency(totalGasto)}</div>
      </div>
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">Itens com Consumo</div>
        <div class="kpi-value yellow" style="font-size:1.4rem;">${analise.length}</div>
      </div>
      <div class="kpi-card" style="padding:14px;">
        <div class="kpi-label">Sem Consumo</div>
        <div class="kpi-value" style="font-size:1.4rem;color:var(--text3);">${Math.max(0, produtos.length - analise.length)}</div>
      </div>
    </div>

    <div class="filters-bar" style="margin-bottom:12px;">
      <div class="filter-group" style="flex:1">
        <label class="filter-label">Buscar</label>
        <div class="search-bar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input class="form-control" id="prod-srch" placeholder="Nome ou código..." oninput="Produtos._refresh()"></div>
      </div>
      <div class="filter-group">
        <label class="filter-label">Categoria</label>
        <select class="form-control" id="prod-cat" style="min-width:160px" onchange="Produtos._refresh()">
          <option value="">Todas</option>
          ${this.CATEGORIAS.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <div class="tbl-wrap" style="border:none;border-radius:14px 14px 0 0;">
        <table>
          <thead><tr>
            <th>Código</th><th>Produto / Insumo</th><th>Categoria</th><th>Unidade</th>
            <th>Valor Médio</th><th>Qtd Total Consumida</th><th>Total Gasto</th>
            <th style="text-align:center;">Ações</th>
          </tr></thead>
          <tbody id="prod-tbody">${this._rows(produtos, analise)}</tbody>
        </table>
      </div>
    </div>`;
  },

  _rows(produtos, analise) {
    if (!analise) analise = this.getAnaliseGastos();
    const analiseMap = {};
    analise.forEach(a => { analiseMap[a.id] = a; });

    const srch = document.getElementById('prod-srch')?.value?.toLowerCase() || '';
    const cat  = document.getElementById('prod-cat')?.value || '';

    let lista = produtos;
    if (srch) lista = lista.filter(p => (p.nome + ' ' + (p.codigo || '')).toLowerCase().includes(srch));
    if (cat)  lista = lista.filter(p => p.categoria === cat);

    if (!lista.length) return `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:32px">
      ${produtos.length === 0 ? 'Nenhum produto cadastrado. Importe uma NF-e com itens ou cadastre manualmente.' : 'Nenhum produto encontrado.'}
    </td></tr>`;

    return lista.map((p, i) => {
      const a = analiseMap[p.id] || { total: 0, qtd_total: 0, compras: 0 };
      const catLabel = this.CATEGORIAS.find(c => c.value === p.categoria)?.label || p.categoria || '—';
      return `<tr style="background:${i%2===0?'var(--bg-card)':'var(--bg-secondary)'}">
        <td style="font-family:monospace;font-size:.78rem;color:var(--text3);">${p.codigo || '—'}</td>
        <td>
          <div style="font-weight:700;color:var(--text);">${p.nome}</div>
          ${p.observacoes ? `<div style="font-size:.72rem;color:var(--text3);">${p.observacoes}</div>` : ''}
        </td>
        <td style="font-size:.82rem;">${catLabel}</td>
        <td style="font-size:.82rem;color:var(--text2);">${p.unidade || 'un'}</td>
        <td style="font-weight:600;color:var(--accent2);">${Utils.fmt.currency(p.valor_medio || 0)}</td>
        <td style="text-align:right;font-weight:700;color:var(--text);">${(a.qtd_total || 0).toLocaleString('pt-BR', {maximumFractionDigits:2})} ${p.unidade || 'un'}</td>
        <td style="text-align:right;font-weight:800;color:${a.total > 0 ? 'var(--danger)' : 'var(--text3)'};">${a.total > 0 ? Utils.fmt.currency(a.total) : '—'}</td>
        <td style="text-align:center;">
          <div style="display:flex;gap:4px;justify-content:center;">
            ${a.compras > 0 ? `<button class="btn btn-sm btn-secondary" onclick="Produtos.verHistorico('${p.id}')" title="Ver histórico" style="font-size:.72rem;padding:3px 7px;">📋 ${a.compras}</button>` : ''}
            <button class="icon-btn" onclick="Produtos.showForm('${p.id}')" title="Editar" style="font-size:13px;">✏️</button>
            <button class="icon-btn" onclick="Produtos.del('${p.id}')" title="Excluir" style="font-size:13px;color:var(--danger);">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  // ────────────────────────────────────────────────────────────
  // FORMULÁRIO CRUD
  // ────────────────────────────────────────────────────────────
  showForm(id = null) {
    const p = id ? DB.getById('produtos', id) || {} : {};
    const isEdit = !!id;
    Utils.showModal(`
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <span class="modal-title">${isEdit ? '✏️ Editar Produto' : '📦 Novo Produto'}</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <form id="f-prod">
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Nome / Descrição *</label>
                <input class="form-control" name="nome" value="${p.nome || ''}" required placeholder="Ex: Cimento Portland CP-II 50kg">
              </div>
              <div class="form-group">
                <label class="form-label">Código Interno</label>
                <input class="form-control" name="codigo" value="${p.codigo || ''}" placeholder="Ex: CIM001">
              </div>
            </div>
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Categoria *</label>
                <select class="form-control" name="categoria" required>
                  ${this.CATEGORIAS.map(c => `<option value="${c.value}" ${p.categoria === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Unidade *</label>
                <input class="form-control" name="unidade" value="${p.unidade || 'un'}" required placeholder="sc, m², kg, un">
              </div>
              <div class="form-group">
                <label class="form-label">Valor Médio (R$)</label>
                <div class="input-prefix"><span class="input-pfx-txt">R$</span>
                <input class="form-control" name="valor_medio" type="number" step="0.01" min="0" value="${p.valor_medio || ''}" placeholder="0,00"></div>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Fornecedor Principal</label>
              <input class="form-control" name="fornecedor_principal" value="${p.fornecedor_principal || ''}" placeholder="Fornecedor habitual">
            </div>
            <div class="form-group">
              <label class="form-label">Observações / Especificações</label>
              <textarea class="form-control" name="observacoes" rows="2" placeholder="Marca, especificações técnicas...">${p.observacoes || ''}</textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="Produtos.save('${id || ''}')">${isEdit ? '✔ Salvar' : '+ Cadastrar'}</button>
        </div>
      </div>`);
  },

  save(id) {
    const f = document.getElementById('f-prod');
    if (!f || !f.checkValidity()) { f?.reportValidity(); return; }
    const d = Object.fromEntries(new FormData(f));
    d.valor_medio = parseFloat(d.valor_medio) || 0;

    if (id) {
      DB.update('produtos', id, d);
      Utils.toast('Produto atualizado!', 'success');
    } else {
      const exist = DB.getAll('produtos').find(p => p.nome.toLowerCase().trim() === d.nome.toLowerCase().trim());
      if (exist) { Utils.toast(`⚠ Produto já cadastrado: ${exist.nome}`, 'warning'); return; }
      DB.add('produtos', d);
      Utils.toast('Produto cadastrado!', 'success');
    }
    Utils.closeModal();
    this._refresh();
  },

  del(id) {
    Utils.confirm('Excluir este produto? O histórico em lançamentos e NFs não será apagado.', () => {
      DB.remove('produtos', id);
      Utils.toast('Produto excluído.', 'info');
      this._refresh();
    });
  },

  _refresh() {
    const tbody = document.getElementById('prod-tbody');
    if (!tbody) return;
    const produtos = DB.getAll('produtos');
    const analise  = this.getAnaliseGastos();
    tbody.innerHTML = this._rows(produtos, analise);
  },

  // ────────────────────────────────────────────────────────────
  // ANÁLISE DE CONSUMO AGREGADA
  // ────────────────────────────────────────────────────────────
  getAnaliseGastos(obraId = null) {
    const todos = DB.getAll('produtos');
    const mapa = {};
    todos.forEach(p => {
      mapa[p.id] = { id: p.id, nome: p.nome, unidade: p.unidade || 'un', total: 0, qtd_total: 0, compras: 0, obras: new Set(), historico: [] };
    });

    // Lançamentos com itens vinculados a produto_id
    DB.getAll('lancamentos').filter(l => l.itens && l.itens.length && l.tipo === 'despesa').forEach(l => {
      if (obraId && l.obra_id !== obraId) return;
      const obraObj = l.obra_id === 'escritorio' ? { nome: '🏢 Escritório' } : DB.getById('clientes', l.obra_id);
      const obraNome = obraObj?.nome || '—';
      l.itens.forEach(it => {
        if (!it.produto_id || !mapa[it.produto_id]) return;
        const tot = it.total || (it.qtd * it.valor_unit) || 0;
        mapa[it.produto_id].total += tot;
        mapa[it.produto_id].qtd_total += (it.qtd || 0);
        mapa[it.produto_id].compras++;
        mapa[it.produto_id].obras.add(obraNome);
        mapa[it.produto_id].historico.push({ data: l.data, desc: l.descricao, valor: tot, qtd: it.qtd || 0, obra: obraNome, fonte: 'Lançamento' });
      });
    });

    // Notas com itens vinculados a produto_id
    DB.getAll('notas').filter(n => n.itens && n.itens.length).forEach(n => {
      if (obraId && n.obra_id !== obraId) return;
      const obraObj = n.obra_id === 'escritorio' ? { nome: '🏢 Escritório' } : DB.getById('clientes', n.obra_id);
      const obraNome = obraObj?.nome || '—';
      n.itens.forEach(it => {
        if (!it.produto_id || !mapa[it.produto_id]) return;
        const tot = it.total || (it.qtd * it.valor_unit) || 0;
        mapa[it.produto_id].total += tot;
        mapa[it.produto_id].qtd_total += (it.qtd || 0);
        mapa[it.produto_id].compras++;
        mapa[it.produto_id].obras.add(obraNome);
        mapa[it.produto_id].historico.push({ data: n.data_emissao, desc: `NF ${n.numero_nf} — ${n.emitente}`, valor: tot, qtd: it.qtd || 0, obra: obraNome, fonte: 'Nota Fiscal' });
      });
    });

    return Object.values(mapa).filter(p => p.total > 0 || p.compras > 0).sort((a, b) => b.total - a.total);
  },

  showAnalise() {
    const obraId = App.obraId === 'todas' ? null : App.obraId;
    const analise = this.getAnaliseGastos(obraId);
    const totalGeral = analise.reduce((s, p) => s + p.total, 0);

    if (!analise.length) {
      Utils.toast('Nenhum consumo registrado ainda. Importe NF-e com itens ou adicione produtos nos lançamentos.', 'info');
      return;
    }

    const linhas = analise.map((p, i) => {
      const pct = totalGeral > 0 ? ((p.total / totalGeral) * 100).toFixed(1) : '0.0';
      const obras = [...p.obras].join(', ');
      const det = p.historico.sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 5)
        .map(h => `<li style="font-size:.72rem;color:var(--text3);">${Utils.fmt.date(h.data)} — ${h.desc} (${h.qtd} ${p.unidade} = ${Utils.fmt.currency(h.valor)}) <em>${h.fonte}</em></li>`).join('');
      return `
        <tr style="background:${i%2===0?'var(--bg-card)':'var(--bg-secondary)'};cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'table-row':'none'">
          <td style="padding:10px 12px;"><div style="font-weight:700;color:var(--text);">${p.nome}</div><div style="font-size:.72rem;color:var(--text3);">${obras}</div></td>
          <td style="padding:10px 12px;text-align:right;color:var(--text2);font-size:.82rem;">${p.qtd_total.toLocaleString('pt-BR',{maximumFractionDigits:2})} ${p.unidade}</td>
          <td style="padding:10px 12px;text-align:right;">
            <div style="font-weight:800;color:var(--danger);">${Utils.fmt.currency(p.total)}</div>
            <div style="height:4px;background:var(--border);border-radius:2px;margin-top:4px;"><div style="height:4px;background:var(--danger);border-radius:2px;width:${pct}%;"></div></div>
          </td>
          <td style="padding:10px 12px;text-align:center;font-size:.78rem;color:var(--text3);">${pct}%</td>
          <td style="padding:10px 12px;text-align:center;font-size:.78rem;color:var(--text3);">${p.compras}</td>
        </tr>
        <tr style="display:none;background:var(--bg-secondary);"><td colspan="5" style="padding:4px 20px 12px;"><ul style="margin:0;padding-left:16px;">${det}</ul></td></tr>`;
    }).join('');

    Utils.showModal(`
      <div class="modal" style="max-width:740px;">
        <div class="modal-header">
          <span class="modal-title">📊 Análise de Consumo por Produto</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:0;">
          <div style="padding:14px 18px;background:var(--bg-secondary);border-bottom:1px solid var(--border);display:flex;gap:12px;flex-wrap:wrap;">
            <div style="flex:1;min-width:130px;"><div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:700;">Total Gasto</div><div style="font-size:1.3rem;font-weight:900;color:var(--danger);">${Utils.fmt.currency(totalGeral)}</div></div>
            <div style="flex:1;min-width:130px;"><div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:700;">Produtos Distintos</div><div style="font-size:1.3rem;font-weight:900;color:var(--accent2);">${analise.length}</div></div>
            <div style="flex:1;min-width:130px;"><div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:700;">Total de Compras</div><div style="font-size:1.3rem;font-weight:900;color:var(--text);">${analise.reduce((s,p)=>s+p.compras,0)}</div></div>
          </div>
          <div style="padding:10px 18px;border-bottom:1px solid var(--border);">
            <input class="form-control" placeholder="🔍 Filtrar produto..." oninput="Produtos._filtrarAnalise(this.value)" style="max-width:280px;font-size:.84rem;">
          </div>
          <div style="overflow-y:auto;max-height:400px;">
            <table style="width:100%;border-collapse:collapse;font-size:.84rem;">
              <thead style="position:sticky;top:0;z-index:1;">
                <tr style="background:var(--bg-secondary);color:var(--text3);font-size:.72rem;text-transform:uppercase;">
                  <th style="padding:8px 12px;text-align:left;">Produto</th>
                  <th style="padding:8px 12px;text-align:right;">Qtd Total</th>
                  <th style="padding:8px 12px;text-align:right;">Total Gasto</th>
                  <th style="padding:8px 12px;text-align:center;">%</th>
                  <th style="padding:8px 12px;text-align:center;">Compras</th>
                </tr>
              </thead>
              <tbody id="analise-tbody">${linhas}</tbody>
            </table>
          </div>
          <div style="padding:8px 18px;font-size:.72rem;color:var(--text3);border-top:1px solid var(--border);">💡 Clique em um produto para ver o histórico detalhado.</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Fechar</button>
          <button class="btn btn-primary" onclick="Utils.closeModal();App.navigate('produtos')">Gerenciar Produtos</button>
        </div>
      </div>`);
  },

  _filtrarAnalise(q) {
    const tbody = document.getElementById('analise-tbody');
    if (!tbody) return;
    let skip = false;
    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      if (tr.querySelector('td[colspan]')) { skip = false; return; }
      if (skip) { skip = false; return; }
      const vis = !q || tr.textContent.toLowerCase().includes(q.toLowerCase());
      tr.style.display = vis ? '' : 'none';
      if (!vis) skip = true;
    });
  },

  verHistorico(produtoId) {
    const p = DB.getById('produtos', produtoId);
    if (!p) return;
    const analise = this.getAnaliseGastos();
    const dados = analise.find(a => a.id === produtoId);
    if (!dados) { Utils.toast('Sem histórico para este produto.', 'info'); return; }

    const linhas = dados.historico.sort((a, b) => (b.data || '').localeCompare(a.data || '')).map((h, i) => `
      <tr style="background:${i%2===0?'var(--bg-card)':'var(--bg-secondary)'}">
        <td style="padding:8px 12px;font-size:.78rem;">${Utils.fmt.date(h.data)}</td>
        <td style="padding:8px 12px;font-size:.78rem;color:var(--text2);">${h.desc}</td>
        <td style="padding:8px 12px;font-size:.78rem;color:var(--text2);">${h.obra}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;">${(h.qtd||0).toLocaleString('pt-BR',{maximumFractionDigits:2})} ${p.unidade}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:800;color:var(--danger);">${Utils.fmt.currency(h.valor)}</td>
        <td style="padding:8px 12px;"><span class="badge ${h.fonte==='Nota Fiscal'?'badge-info':'badge-accent'}" style="font-size:.68rem;">${h.fonte}</span></td>
      </tr>`).join('');

    Utils.showModal(`
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <span class="modal-title">📋 Histórico — ${p.nome}</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:0;">
          <div style="padding:12px 18px;background:var(--bg-secondary);border-bottom:1px solid var(--border);display:flex;gap:20px;flex-wrap:wrap;">
            <div><div style="font-size:.72rem;color:var(--text3);">TOTAL GASTO</div><div style="font-size:1.2rem;font-weight:900;color:var(--danger);">${Utils.fmt.currency(dados.total)}</div></div>
            <div><div style="font-size:.72rem;color:var(--text3);">QTD TOTAL</div><div style="font-size:1.2rem;font-weight:900;color:var(--accent2);">${dados.qtd_total.toLocaleString('pt-BR',{maximumFractionDigits:2})} ${p.unidade}</div></div>
            <div><div style="font-size:.72rem;color:var(--text3);">Nº COMPRAS</div><div style="font-size:1.2rem;font-weight:900;color:var(--text);">${dados.compras}</div></div>
            <div><div style="font-size:.72rem;color:var(--text3);">VALOR MÉDIO UNIT.</div><div style="font-size:1.2rem;font-weight:900;color:var(--text);">${dados.qtd_total > 0 ? Utils.fmt.currency(dados.total / dados.qtd_total) : '—'}</div></div>
          </div>
          <div style="overflow-y:auto;max-height:380px;">
            <table style="width:100%;border-collapse:collapse;font-size:.84rem;">
              <thead><tr style="background:var(--bg-secondary);color:var(--text3);font-size:.72rem;text-transform:uppercase;">
                <th style="padding:8px 12px;">Data</th><th style="padding:8px 12px;">Descrição</th><th style="padding:8px 12px;">Obra</th>
                <th style="padding:8px 12px;text-align:right;">Qtd</th><th style="padding:8px 12px;text-align:right;">Total</th><th style="padding:8px 12px;">Fonte</th>
              </tr></thead>
              <tbody>${linhas}</tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" onclick="Utils.closeModal()">Fechar</button></div>
      </div>`);
  },

  // ────────────────────────────────────────────────────────────
  // HELPERS PARA INTEGRAÇÃO
  // ────────────────────────────────────────────────────────────

  /**
   * Encontra produto pelo nome (case-insensitive) ou cria um novo.
   */
  encontrarOuCriar(nome, unidade = 'un', categoria = 'material') {
    if (!nome || !nome.trim()) return null;
    const nomeLower = nome.trim().toLowerCase();
    const exist = DB.getAll('produtos').find(p => p.nome.toLowerCase().trim() === nomeLower);
    if (exist) return exist;
    return DB.add('produtos', { nome: nome.trim(), unidade, categoria, valor_medio: 0 });
  },

  /**
   * Atualiza valor médio do produto com base no histórico agregado.
   */
  atualizarValorMedio(produtoId) {
    const analise = this.getAnaliseGastos();
    const dados = analise.find(a => a.id === produtoId);
    if (dados && dados.qtd_total > 0) {
      DB.update('produtos', produtoId, { valor_medio: parseFloat((dados.total / dados.qtd_total).toFixed(4)) });
    }
  },

  /**
   * Retorna <option> tags para selects de produto em outros módulos.
   */
  produtoOptions(selectedId = '') {
    const lista = DB.getAll('produtos');
    let html = `<option value="">— Selecione ou cadastre novo —</option>`;
    if (!lista.length) return html + `<option value="" disabled>Nenhum produto cadastrado</option>`;
    const cats = {};
    lista.forEach(p => {
      const k = p.categoria || 'outro';
      if (!cats[k]) cats[k] = [];
      cats[k].push(p);
    });
    this.CATEGORIAS.forEach(cat => {
      const grupo = cats[cat.value];
      if (!grupo || !grupo.length) return;
      html += `<optgroup label="${cat.label}">`;
      grupo.forEach(p => {
        html += `<option value="${p.id}" data-unidade="${p.unidade || 'un'}" data-valor="${p.valor_medio || 0}" ${selectedId === p.id ? 'selected' : ''}>${p.nome} (${p.unidade || 'un'})</option>`;
      });
      html += `</optgroup>`;
    });
    return html;
  },

  sincronizarComLancamentos() {
    try {
      const lancs = (typeof DB !== 'undefined' ? DB.getAll('lancamentos') : []) || [];
      let updatedAny = false;

      lancs.forEach(l => {
        if (l.tipo !== 'despesa') return;

        // 1. Se tem itens no lançamento, garante que todos estão em produtos
        if (Array.isArray(l.itens) && l.itens.length > 0) {
          l.itens.forEach(it => {
            if (it.produto && it.produto.trim()) {
              const prod = this.encontrarOuCriar(it.produto, it.unidade || 'un', l.categoria || 'material');
              if (prod && !it.produto_id) {
                it.produto_id = prod.id;
                updatedAny = true;
              }
              if (prod) this.atualizarValorMedio(prod.id);
            }
          });
        }
        // 2. Se não tem itens, mas tem descrição de compra/material (ex: OCR de NFC-e/NF-e)
        else if (l.valor > 0 && l.descricao && l.descricao.trim()) {
          const desc = l.descricao.trim();
          const cleanNome = desc.replace(/^(compra\s+de\s+|aquisição\s+de\s+|aquisicao\s+de\s+|pgto\s+de\s+|pagamento\s+de\s+|fornecimento\s+de\s+|nfce\s+-\s+|nfe\s+-\s+)/i, '').trim();
          if (cleanNome.length >= 3 && (l.categoria === 'material' || l.origem === 'ocr' || /^(compra|aquisi|trilho|cimento|tinta|piso|bloco|areia|brita|tubo|cabo|ferro|aco|madeira)/i.test(desc))) {
            const prod = this.encontrarOuCriar(cleanNome, 'un', l.categoria || 'material');
            if (prod) {
              l.itens = [{
                produto: cleanNome,
                produto_id: prod.id,
                qtd: 1,
                unidade: 'un',
                valor_unit: l.valor,
                total: l.valor
              }];
              this.atualizarValorMedio(prod.id);
              updatedAny = true;
            }
          }
        }
      });

      if (updatedAny && typeof DB !== 'undefined') {
        DB.save('lancamentos', lancs);
      }
    } catch (e) {
      console.warn('[Produtos] Erro ao sincronizar com lançamentos:', e);
    }
  },

  init() {
    this.sincronizarComLancamentos();
  }
};

if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (typeof Produtos !== 'undefined' && Produtos.sincronizarComLancamentos) {
      Produtos.sincronizarComLancamentos();
    }
  }, 150);
}
