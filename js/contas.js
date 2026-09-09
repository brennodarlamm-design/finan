// js/contas.js — Registro e Gestão de Contas Bancárias (Sincronizado Neon PostgreSQL)

const Contas = {
  _filtro: 'todas', // 'todas' ou 'obra'

  BANCOS: [
    { code:'748', name:'Sicredi', cor:'#00843d', bg:'rgba(0,132,61,.15)' },
    { code:'001', name:'Banco do Brasil', cor:'#f8d117', bg:'rgba(248,209,23,.15)' },
    { code:'104', name:'Caixa Econômica Federal', cor:'#0066b3', bg:'rgba(0,102,179,.15)' },
    { code:'208', name:'BTG Pactual', cor:'#38bdf8', bg:'rgba(56,189,248,.15)' },
    { code:'237', name:'Bradesco', cor:'#cc092f', bg:'rgba(204,9,47,.15)' },
    { code:'341', name:'Itaú', cor:'#ec7000', bg:'rgba(236,112,0,.15)' },
    { code:'033', name:'Santander', cor:'#ec0000', bg:'rgba(236,0,0,.15)' },
    { code:'260', name:'Nubank', cor:'#820ad1', bg:'rgba(130,10,209,.15)' },
    { code:'077', name:'Banco Inter', cor:'#ff7a00', bg:'rgba(255,122,0,.15)' },
    { code:'756', name:'Sicoob', cor:'#003641', bg:'rgba(0,54,65,.2)' },
    { code:'336', name:'C6 Bank', cor:'#e2e8f0', bg:'rgba(226,232,240,.15)' },
    { code:'999', name:'Outro', cor:'#94a3b8', bg:'rgba(148,163,184,.15)' }
  ],

  // Contas oficiais e consolidadas da Angelim Construtora
  DEFAULT_CONTAS: [
    {
      id: 'cta_sicredi_0812',
      banco_codigo: '748',
      banco_nome: 'Sicredi',
      agencia: '0812',
      numero: '60096-3',
      tipo: 'corrente',
      titular: 'ANGELIM CONSTRUTORA LTDA',
      apelido: 'Sicredi Ag:0812 Cc:60096-3',
      obra_id: null,
      obs: 'Conta corrente principal Sicredi vinculada às movimentações e conciliação OFX da construtora'
    },
    {
      id: 'cta_bb_principal',
      banco_codigo: '001',
      banco_nome: 'Banco do Brasil',
      agencia: '0001',
      numero: 'Principal',
      tipo: 'corrente',
      titular: 'ANGELIM CONSTRUTORA LTDA',
      apelido: 'BB — Movimento Principal',
      obra_id: null,
      obs: 'Conta corrente Banco do Brasil — Movimentação geral de despesas e receitas da sede e obras'
    },
    {
      id: 'cta_btg_invest',
      banco_codigo: '208',
      banco_nome: 'BTG Pactual',
      agencia: '0001',
      numero: 'Investimentos',
      tipo: 'investimento',
      titular: 'ANGELIM CONSTRUTORA LTDA',
      apelido: 'BTG Pactual',
      obra_id: null,
      obs: 'Conta investimentos e aplicações de liquidez BTG Pactual'
    },
    {
      id: 'cta_cef_obras',
      banco_codigo: '104',
      banco_nome: 'Caixa Econômica Federal',
      agencia: '0501',
      numero: '12345-6',
      tipo: 'obras',
      titular: 'ANGELIM CONSTRUTORA LTDA',
      apelido: 'Caixa — Conta Obras CEF',
      obra_id: null,
      obs: 'Conta vinculada a recursos de financiamentos habitacionais da Caixa Econômica Federal'
    }
  ],

  render(obraId) {
    this.ensureSeed();
    return this._html(obraId);
  },

  ensureSeed() {
    const contas = DB.getAll('contas');
    if (!contas || contas.length === 0) {
      console.log('[Contas] Restaurando contas bancárias no armazenamento local...');
      this.DEFAULT_CONTAS.forEach(c => DB.add('contas', c));
    }
  },

  _html(obraId) {
    const contas = DB.getAll('contas');
    const obraAtiva = (obraId && obraId !== 'todas') ? DB.getById('clientes', obraId) : null;

    // Filtra conforme a seleção de visualização
    let list = contas;
    if (this._filtro === 'obra' && obraId && obraId !== 'todas') {
      list = contas.filter(c => c.obra_id === obraId || !c.obra_id);
    }

    const todosLancamentos = DB.getAll('lancamentos') || [];
    const totalContas = contas.length;
    const contasGerais = contas.filter(c => !c.obra_id).length;
    const contasObras = contas.filter(c => !!c.obra_id).length;

    return `
    <div class="page-header" style="margin-bottom:20px;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;">
          <h1 class="page-title">&#x1F3E6; Contas Banc&aacute;rias</h1>
          <span style="display:inline-flex;align-items:center;gap:5px;background:rgba(16,185,129,.12);color:#34d399;font-size:.75rem;padding:3px 8px;border-radius:20px;border:1px solid rgba(16,185,129,.25);font-weight:600;">
            <span style="width:6px;height:6px;background:#10b981;border-radius:50%;display:inline-block;"></span> Nuvem Neon Ativa
          </span>
        </div>
        <p class="page-sub">Gerencie as contas bancárias da Angelim Construtora e das obras financiadas</p>
      </div>
      <div class="page-actions" style="display:flex;gap:10px;">
        <button class="btn btn-secondary" onclick="Contas.sincronizarComNuvem()" title="Sincronizar contas agora com o banco Neon">&#x21BB; Atualizar Nuvem</button>
        <button class="btn btn-primary" onclick="Contas.showForm()">+ Nova Conta</button>
      </div>
    </div>

    <!-- CARDS DE RESUMO KPI -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;margin-bottom:24px;">
      <div class="card" style="padding:16px;background:linear-gradient(135deg, rgba(15,23,42,.6), rgba(30,41,59,.6));border:1px solid rgba(255,255,255,.08);border-radius:12px;">
        <div style="font-size:.75rem;color:var(--text3);text-transform:uppercase;font-weight:700;letter-spacing:.05em;">Total de Contas</div>
        <div style="font-size:1.7rem;font-weight:800;color:#f8fafc;margin-top:4px;">${totalContas}</div>
        <div style="font-size:.75rem;color:#10b981;margin-top:4px;">🏦 Ativas e integradas</div>
      </div>
      <div class="card" style="padding:16px;background:linear-gradient(135deg, rgba(15,23,42,.6), rgba(30,41,59,.6));border:1px solid rgba(255,255,255,.08);border-radius:12px;">
        <div style="font-size:.75rem;color:var(--text3);text-transform:uppercase;font-weight:700;letter-spacing:.05em;">Contas Gerais / Sede</div>
        <div style="font-size:1.7rem;font-weight:800;color:#38bdf8;margin-top:4px;">${contasGerais}</div>
        <div style="font-size:.75rem;color:var(--text3);margin-top:4px;">Disponíveis para todas as obras</div>
      </div>
      <div class="card" style="padding:16px;background:linear-gradient(135deg, rgba(15,23,42,.6), rgba(30,41,59,.6));border:1px solid rgba(255,255,255,.08);border-radius:12px;">
        <div style="font-size:.75rem;color:var(--text3);text-transform:uppercase;font-weight:700;letter-spacing:.05em;">Vinculadas a Obras</div>
        <div style="font-size:1.7rem;font-weight:800;color:#fbbf24;margin-top:4px;">${contasObras}</div>
        <div style="font-size:.75rem;color:var(--text3);margin-top:4px;">Contas específicas de clientes / CEF</div>
      </div>
      <div class="card" style="padding:16px;background:linear-gradient(135deg, rgba(15,23,42,.6), rgba(30,41,59,.6));border:1px solid rgba(255,255,255,.08);border-radius:12px;">
        <div style="font-size:.75rem;color:var(--text3);text-transform:uppercase;font-weight:700;letter-spacing:.05em;">Lançamentos Vinculados</div>
        <div style="font-size:1.7rem;font-weight:800;color:#a78bfa;margin-top:4px;">${todosLancamentos.filter(l => !!l.conta_bancaria).length}</div>
        <div style="font-size:.75rem;color:var(--text3);margin-top:4px;">Conciliados ou em fluxo</div>
      </div>
    </div>

    <!-- ABAS / FILTROS DE VISUALIZAÇÃO -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
      <div style="display:flex;gap:8px;">
        <button class="btn btn-sm ${this._filtro==='todas'?'btn-primary':'btn-secondary'}" onclick="Contas.setFiltro('todas')">
          &#x1F3E6; Todas as Contas (${contas.length})
        </button>
        ${obraAtiva ? `
        <button class="btn btn-sm ${this._filtro==='obra'?'btn-primary':'btn-secondary'}" onclick="Contas.setFiltro('obra')">
          &#x1F3E0; Desta Obra &amp; Gerais (${contas.filter(c => c.obra_id === obraId || !c.obra_id).length})
        </button>` : ''}
      </div>
      ${obraAtiva ? `
      <div style="font-size:.82rem;color:var(--text3);display:flex;align-items:center;gap:6px;">
        <span>Obra selecionada no topo:</span>
        <strong style="color:var(--accent);">${obraAtiva.nome}</strong>
      </div>` : ''}
    </div>

    <div id="contas-list">
      ${list.length ? list.map(c => this._card(c)).join('') : `
      <div class="empty-state" style="padding:48px 24px;text-align:center;background:var(--card-bg);border-radius:12px;border:1px dashed var(--border);">
        <div style="font-size:2.8rem;margin-bottom:12px;">🏦</div>
        <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:6px;">Nenhuma conta encontrada com este filtro</h3>
        <p style="color:var(--text3);max-width:440px;margin:0 auto 16px;">
          ${this._filtro === 'obra' ? 'Não há contas vinculadas exclusivamente a esta obra. Clique em "Todas as Contas" para ver as contas gerais da construtora.' : 'Cadastre as contas bancárias para conciliação OFX e controle financeiro.'}
        </p>
        <div style="display:flex;gap:10px;justify-content:center;">
          ${this._filtro === 'obra' ? `<button class="btn btn-secondary" onclick="Contas.setFiltro('todas')">Ver Todas as Contas</button>` : ''}
          <button class="btn btn-primary" onclick="Contas.showForm()">+ Nova Conta</button>
        </div>
      </div>`}
    </div>`;
  },

  setFiltro(filtro) {
    this._filtro = filtro;
    this._refresh();
  },

  _card(conta) {
    const obra = conta.obra_id ? DB.getById('clientes', conta.obra_id) : null;
    const banco = this.BANCOS.find(b => b.code === conta.banco_codigo) || {
      name: conta.banco_nome || 'Banco',
      cor: '#94a3b8',
      bg: 'rgba(148,163,184,.15)'
    };
    const tipos = {
      corrente: 'Conta Corrente',
      poupanca: 'Poupança',
      obras: 'Conta Obras Caixa',
      investimento: 'Investimento'
    };

    // Conta quantos lançamentos reais utilizam esta conta
    const todosLancamentos = DB.getAll('lancamentos') || [];
    const apelidoStr = (conta.apelido || '').toLowerCase();
    const numeroStr = (conta.numero || '').toLowerCase();
    const agenciaStr = (conta.agencia || '').toLowerCase();
    const bancoNomeStr = (banco.name || '').toLowerCase();

    const qtdLancamentos = todosLancamentos.filter(l => {
      if (!l.conta_bancaria) return false;
      const cb = l.conta_bancaria.toLowerCase();
      if (apelidoStr && cb === apelidoStr) return true;
      if (numeroStr && cb.includes(numeroStr)) return true;
      if (agenciaStr && cb.includes(agenciaStr)) return true;
      if (bancoNomeStr && cb.includes(bancoNomeStr)) return true;
      return false;
    }).length;

    return `
    <div class="card" style="margin-bottom:14px;border:1px solid rgba(255,255,255,.08);transition:transform .15s, border-color .15s;padding:18px;">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <div style="width:52px;height:52px;background:${banco.bg};border:1px solid ${banco.cor}44;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;color:${banco.cor};font-weight:bold;">
          &#x1F3E6;
        </div>
        <div style="flex:1;min-width:240px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-weight:700;font-size:1.05rem;color:var(--text);">${conta.apelido || banco.name}</span>
            <span style="font-size:.72rem;background:${banco.bg};color:${banco.cor};padding:2px 8px;border-radius:12px;font-weight:700;border:1px solid ${banco.cor}33;">
              ${banco.name}
            </span>
            <span style="font-size:.72rem;background:rgba(255,255,255,.06);color:var(--text2);padding:2px 8px;border-radius:12px;">
              ${tipos[conta.tipo] || conta.tipo}
            </span>
          </div>
          <div style="color:var(--text2);font-size:.82rem;margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;">
            <span><strong>Agência:</strong> ${conta.agencia || '—'}</span>
            <span>&middot;</span>
            <span><strong>Conta:</strong> ${conta.numero || '—'}</span>
            ${conta.titular ? `<span>&middot;</span><span><strong>Titular:</strong> ${conta.titular}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap;font-size:.76rem;">
            <span style="color:${obra ? '#60a5fa' : '#34d399'};display:inline-flex;align-items:center;gap:4px;">
              ${obra ? `&#x1F3E0; Vinculada a: <strong>${obra.nome}</strong>` : '&#x1F3E2; Disponível para <strong>Todas as Obras / Geral</strong>'}
            </span>
            ${qtdLancamentos > 0 ? `
            <span style="background:rgba(167,139,250,.12);color:#c4b5fd;padding:2px 8px;border-radius:10px;font-weight:600;border:1px solid rgba(167,139,250,.25);">
              &#x1F4B3; ${qtdLancamentos} lançamentos vinculados
            </span>` : ''}
          </div>
          ${conta.obs ? `<div style="font-size:.75rem;color:var(--text3);margin-top:6px;font-style:italic;">"${conta.obs}"</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-secondary btn-sm" onclick="Contas.showForm('${conta.id}')" title="Editar conta">
            &#x270F;&#xFE0F; Editar
          </button>
          <button class="icon-btn" onclick="Contas.excluir('${conta.id}')" title="Excluir conta" style="color:var(--danger);width:34px;height:34px;">
            &#x1F5D1;
          </button>
        </div>
      </div>
    </div>`;
  },

  showForm(id) {
    const conta = id ? DB.getById('contas', id) : null;
    const clientes = DB.getAll('clientes');
    Utils.showModal(`
      <div class="modal" style="max-width:580px">
        <div class="modal-header">
          <span class="modal-title">&#x1F3E6; ${conta ? 'Editar' : 'Nova'} Conta Bancária</span>
          <button class="modal-close" onclick="Utils.closeModal()">&#x2715;</button>
        </div>
        <form class="modal-body" id="f-conta" onsubmit="Contas.save(event,'${id||''}')">
          <div class="g2">
            <div class="form-group">
              <label class="form-label">Banco *</label>
              <select class="form-control" name="banco_codigo" required onchange="Contas._onBancoChange(this)">
                <option value="">Selecione o banco...</option>
                ${this.BANCOS.map(b => `<option value="${b.code}" ${conta?.banco_codigo===b.code?'selected':''}>${b.code} &mdash; ${b.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de Conta *</label>
              <select class="form-control" name="tipo" required>
                <option value="corrente" ${conta?.tipo==='corrente'||!conta?'selected':''}>Conta Corrente</option>
                <option value="poupanca" ${conta?.tipo==='poupanca'?'selected':''}>Poupança</option>
                <option value="obras" ${conta?.tipo==='obras'?'selected':''}>Conta Obras Caixa</option>
                <option value="investimento" ${conta?.tipo==='investimento'?'selected':''}>Investimento</option>
              </select>
            </div>
          </div>
          <div class="g2">
            <div class="form-group">
              <label class="form-label">Agência *</label>
              <input class="form-control" name="agencia" placeholder="Ex: 0812" value="${conta?.agencia||''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Número da Conta *</label>
              <input class="form-control" name="numero" placeholder="Ex: 60096-3" value="${conta?.numero||''}" required>
            </div>
          </div>
          <div class="g2">
            <div class="form-group">
              <label class="form-label">Titular da Conta</label>
              <input class="form-control" name="titular" placeholder="Ex: ANGELIM CONSTRUTORA LTDA" value="${conta?.titular || 'ANGELIM CONSTRUTORA LTDA'}">
            </div>
            <div class="form-group">
              <label class="form-label">Apelido / Identificação no Sistema</label>
              <input class="form-control" name="apelido" id="f-conta-apelido" placeholder="Ex: Sicredi Ag:0812 Cc:60096-3" value="${conta?.apelido||''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Obra Vinculada (opcional)</label>
            <select class="form-control" name="obra_id">
              <option value="">Todas as obras / Geral da Construtora</option>
              ${clientes.map(c => `<option value="${c.id}" ${conta?.obra_id===c.id?'selected':''}>${c.nome} &mdash; ${c.cidade || ''}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Observações</label>
            <textarea class="form-control" name="obs" rows="2" placeholder="Informações adicionais para a conciliação bancária...">${conta?.obs||''}</textarea>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary">&#x1F4BE; Salvar Conta na Nuvem</button>
          </div>
        </form>
      </div>`);
  },

  _onBancoChange(sel) {
    const b = this.BANCOS.find(x => x.code === sel.value);
    const apelidoInput = document.getElementById('f-conta-apelido');
    if (b && apelidoInput && !apelidoInput.value.trim()) {
      apelidoInput.value = b.name;
    }
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
      apelido: (fd.get('apelido')||'').trim() || (banco ? `${banco.name} Ag:${fd.get('agencia')} Cc:${fd.get('numero')}` : 'Conta Bancária'),
      obra_id: fd.get('obra_id') || null,
      obs: (fd.get('obs')||'').trim(),
    };

    if (id) {
      DB.update('contas', id, data);
      Utils.toast('Conta atualizada e salva na nuvem!', 'success');
    } else {
      DB.add('contas', data);
      Utils.toast('Conta cadastrada e sincronizada com sucesso!', 'success');
    }
    Utils.closeModal();
    this._refresh();
  },

  excluir(id) {
    Utils.confirm('Excluir esta conta bancária?', () => {
      DB.remove('contas', id);
      Utils.toast('Conta excluída com sucesso.', 'info');
      this._refresh();
    });
  },

  async sincronizarComNuvem() {
    Utils.toast('Sincronizando contas com o Neon PostgreSQL...', 'info');
    try {
      const res = await fetch('/api/db?table=contas');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          DB.save('contas', json.data);
          Utils.toast(`✅ ${json.data.length} contas atualizadas da nuvem!`, 'success');
          this._refresh();
          return;
        }
      }
      // Se a nuvem não tiver, envia o local para a nuvem
      const contasLocais = DB.getAll('contas');
      for (const c of contasLocais) {
        DB.syncToCloud('save', 'contas', c);
      }
      Utils.toast('Contas sincronizadas com sucesso!', 'success');
    } catch (e) {
      console.warn('Erro ao sincronizar contas:', e);
      Utils.toast('Erro ao contatar a nuvem. Usando dados locais.', 'warning');
    }
  },

  _refresh() {
    const el = document.getElementById('contas-list');
    const container = document.getElementById('route-content');
    if (!el && !container) return;

    // Se estiver na tela de contas ou configurações, re-renderiza
    if (App.currentRoute === 'contas-bancarias' || App.currentRoute === 'contas') {
      if (container) container.innerHTML = this.render(App.obraId);
    } else if (el) {
      const contas = DB.getAll('contas');
      const obraId = App.obraId;
      let list = contas;
      if (this._filtro === 'obra' && obraId && obraId !== 'todas') {
        list = contas.filter(c => c.obra_id === obraId || !c.obra_id);
      }
      el.innerHTML = list.length ? list.map(c => this._card(c)).join('') : `
        <div class="empty-state">
          <h3>Nenhuma conta encontrada</h3>
          <button class="btn btn-primary" onclick="Contas.showForm()">+ Nova Conta</button>
        </div>`;
    }
  },

  // Retorna tags <option> para o select de OFX, lançamentos e pagamentos
  contaOptions(selectedVal) {
    this.ensureSeed();
    const contas = DB.getAll('contas');
    if (!contas.length) return `<option value="">Nenhuma conta &mdash; cadastre em Contas Bancárias</option>`;
    
    const getNome = c => {
      const b = this.BANCOS.find(b => b.code === c.banco_codigo);
      return b ? b.name : (c.banco_nome || 'Banco');
    };

    return `<option value="">Selecione uma conta cadastrada...</option>` +
      contas.map(c => {
        const nomeBanco = getNome(c);
        const label = c.apelido ? `${c.apelido} (${nomeBanco})` : `${nomeBanco} Ag:${c.agencia} / ${c.numero}`;
        const val = c.apelido || `${nomeBanco} Ag:${c.agencia} Cc:${c.numero}`;
        const isSel = selectedVal === val || selectedVal === c.apelido || (c.numero && selectedVal?.includes(c.numero));
        return `<option value="${val}" ${isSel ? 'selected' : ''}>${label}</option>`;
      }).join('') +
      `<option value="__manual__">&#x2712; Digitar manualmente...</option>`;
  },

  init() {
    this.ensureSeed();
  }
};
