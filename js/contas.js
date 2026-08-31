// js/contas.js — Bank Account Registry

const Contas = {
  BANCOS: [
    { code:'104', name:'Caixa Econômica Federal' },
    { code:'001', name:'Banco do Brasil' },
    { code:'033', name:'Santander' },
    { code:'237', name:'Bradesco' },
    { code:'341', name:'Itaú' },
    { code:'260', name:'Nubank' },
    { code:'077', name:'Banco Inter' },
    { code:'748', name:'Sicredi' },
    { code:'756', name:'Sicoob' },
    { code:'999', name:'Outro' },
  ],

  render(obraId) {
    return this._html(obraId);
  },

  _html(obraId) {
    const contas = DB.getAll('contas');
    const list = obraId && obraId !== 'todas'
      ? contas.filter(c => c.obra_id === obraId || !c.obra_id)
      : contas;
    return `
    <div class="page-header">
      <div><h1 class="page-title">&#x1F3E6; Contas Banc&aacute;rias</h1><p class="page-sub">Gerencie as contas vinculadas &agrave;s obras</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="Contas.showForm()">+ Nova Conta</button></div>
    </div>
    <div id="contas-list">
      ${list.length ? list.map(c => this._card(c)).join('') : `
      <div class="empty-state">
        <h3>Nenhuma conta cadastrada</h3>
        <p>Cadastre as contas banc&aacute;rias para facilitar a concilia&ccedil;&atilde;o OFX</p>
        <button class="btn btn-primary" onclick="Contas.showForm()">+ Nova Conta</button>
      </div>`}
    </div>`;
  },

  _card(conta) {
    const obra = conta.obra_id ? DB.getById('clientes', conta.obra_id) : null;
    const banco = this.BANCOS.find(b => b.code === conta.banco_codigo) || { name: conta.banco_nome || 'Banco' };
    const tipos = { corrente:'Conta Corrente', poupanca:'Poupan&ccedil;a', obras:'Conta Obras Caixa', investimento:'Investimento' };
    return `
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <div style="width:48px;height:48px;background:var(--accent-dim);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">&#x1F3E6;</div>
        <div style="flex:1;min-width:200px;">
          <div style="font-weight:700;font-size:.95rem;">${conta.apelido || banco.name}</div>
          <div style="color:var(--text3);font-size:.78rem;margin-top:2px;">${banco.name} &middot; Ag ${conta.agencia} &middot; Conta ${conta.numero}</div>
          <div style="font-size:.75rem;color:var(--accent);margin-top:4px;">${tipos[conta.tipo] || conta.tipo}${obra ? ` &middot; &#x1F3E0; ${obra.nome}` : ' &middot; Todas as obras'}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="icon-btn" onclick="Contas.showForm('${conta.id}')" title="Editar">&#x270F;&#xFE0F;</button>
          <button class="icon-btn" onclick="Contas.excluir('${conta.id}')" title="Excluir" style="color:var(--danger);">&#x1F5D1;</button>
        </div>
      </div>
    </div>`;
  },

  showForm(id) {
    const conta = id ? DB.getById('contas', id) : null;
    const clientes = DB.getAll('clientes');
    Utils.showModal(`
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <span class="modal-title">&#x1F3E6; ${conta ? 'Editar' : 'Nova'} Conta Banc&aacute;ria</span>
          <button class="modal-close" onclick="Utils.closeModal()">&#x2715;</button>
        </div>
        <form class="modal-body" id="f-conta" onsubmit="Contas.save(event,'${id||''}')">
          <div class="g2">
            <div class="form-group">
              <label class="form-label">Banco *</label>
              <select class="form-control" name="banco_codigo" required>
                <option value="">Selecione o banco...</option>
                ${this.BANCOS.map(b => `<option value="${b.code}" ${conta?.banco_codigo===b.code?'selected':''}>${b.code} &mdash; ${b.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de Conta *</label>
              <select class="form-control" name="tipo" required>
                <option value="corrente" ${conta?.tipo==='corrente'||!conta?'selected':''}>Conta Corrente</option>
                <option value="poupanca" ${conta?.tipo==='poupanca'?'selected':''}>Poupan&ccedil;a</option>
                <option value="obras" ${conta?.tipo==='obras'?'selected':''}>Conta Obras Caixa</option>
                <option value="investimento" ${conta?.tipo==='investimento'?'selected':''}>Investimento</option>
              </select>
            </div>
          </div>
          <div class="g2">
            <div class="form-group">
              <label class="form-label">Ag&ecirc;ncia *</label>
              <input class="form-control" name="agencia" placeholder="Ex: 0501" value="${conta?.agencia||''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">N&uacute;mero da Conta *</label>
              <input class="form-control" name="numero" placeholder="Ex: 123456-7" value="${conta?.numero||''}" required>
            </div>
          </div>
          <div class="g2">
            <div class="form-group">
              <label class="form-label">Titular</label>
              <input class="form-control" name="titular" placeholder="Nome do titular" value="${conta?.titular||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Apelido / Identifica&ccedil;&atilde;o</label>
              <input class="form-control" name="apelido" placeholder="Ex: CC Obras Caixa" value="${conta?.apelido||''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Obra Vinculada (opcional)</label>
            <select class="form-control" name="obra_id">
              <option value="">Todas as obras / Geral</option>
              ${clientes.map(c => `<option value="${c.id}" ${conta?.obra_id===c.id?'selected':''}>${c.nome} &mdash; ${c.cidade}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Observa&ccedil;&otilde;es</label>
            <textarea class="form-control" name="obs" rows="2" placeholder="Informa&ccedil;&otilde;es adicionais...">${conta?.obs||''}</textarea>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary">&#x1F4BE; Salvar Conta</button>
          </div>
        </form>
      </div>`);
  },

  save(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const banco = this.BANCOS.find(b => b.code === fd.get('banco_codigo'));
    const data = {
      banco_codigo: fd.get('banco_codigo'),
      banco_nome: banco?.name || '',
      agencia: (fd.get('agencia')||'').trim(),
      numero: (fd.get('numero')||'').trim(),
      tipo: fd.get('tipo'),
      titular: (fd.get('titular')||'').trim(),
      apelido: (fd.get('apelido')||'').trim(),
      obra_id: fd.get('obra_id') || null,
      obs: (fd.get('obs')||'').trim(),
    };
    if (id) {
      DB.update('contas', id, data);
      Utils.toast('Conta atualizada!', 'success');
    } else {
      DB.add('contas', data);
      Utils.toast('Conta cadastrada!', 'success');
    }
    Utils.closeModal();
    this._refresh();
  },

  excluir(id) {
    Utils.confirm('Excluir esta conta banc&aacute;ria?', () => {
      DB.remove('contas', id);
      Utils.toast('Conta exclu&iacute;da.', 'info');
      this._refresh();
    });
  },

  _refresh() {
    const el = document.getElementById('contas-list');
    if (!el) return;
    const contas = DB.getAll('contas');
    const obraId = App.obraId;
    const list = obraId && obraId !== 'todas'
      ? contas.filter(c => c.obra_id === obraId || !c.obra_id)
      : contas;
    el.innerHTML = list.length ? list.map(c => this._card(c)).join('') : `
      <div class="empty-state">
        <h3>Nenhuma conta cadastrada</h3>
        <button class="btn btn-primary" onclick="Contas.showForm()">+ Nova Conta</button>
      </div>`;
  },

  // Returns <option> tags for use in OFX select
  contaOptions(selectedVal) {
    const contas = DB.getAll('contas');
    if (!contas.length) return `<option value="">Nenhuma conta &mdash; cadastre em Configura&ccedil;&otilde;es</option>`;
    const getNome = c => {
      const b = this.BANCOS.find(b => b.code === c.banco_codigo);
      return b ? b.name : (c.banco_nome || 'Banco');
    };
    return `<option value="">Selecione uma conta cadastrada...</option>` +
      contas.map(c => {
        const label = c.apelido || `${getNome(c)} Ag:${c.agencia} / ${c.numero}`;
        const val = `${getNome(c)} Ag:${c.agencia} Cc:${c.numero}`;
        return `<option value="${val}" ${selectedVal===val?'selected':''}>${label}</option>`;
      }).join('') +
      `<option value="__manual__">&#x2712; Digitar manualmente...</option>`;
  },

  init() {}
};
