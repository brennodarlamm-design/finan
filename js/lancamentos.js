// js/lancamentos.js — Financial Entries Module (Receitas + Despesas)

const Lancamentos = {
  _limit: 30,

  render(obraId) {
    this._limit = 30;
    const r = DB.getResumo(obraId==='todas'?null:obraId);
    const lans = DB.getLancamentos(obraId==='todas'?null:obraId);
    const showObra = obraId==='todas';
    const visiveis = lans.slice(0, this._limit);
    return `
    <div class="page-header">
      <div><h1 class="page-title">&#x1F4B0; Lan&ccedil;amentos</h1><p class="page-sub">Controle de receitas e despesas com vencimentos e contas banc&aacute;rias</p></div>
      <div class="page-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="ImportarExcel.abrirModal('${obraId}')" style="display:flex;align-items:center;gap:6px;border:1px solid var(--accent);color:var(--accent2);">
          📊 Importar Planilha Excel
        </button>
        <button class="btn btn-secondary btn-sm" onclick="Lancamentos.abrirAnaliseProdutos()" style="display:flex;align-items:center;gap:6px;">
          🔍 Gastos por Produto
        </button>
        <button class="btn btn-sm" onclick="OCR.abrirModal()" style="display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;font-weight:700;box-shadow:0 2px 8px rgba(79,70,229,.35);" title="Reconhecer boleto, NF-e, NFC-e, NFS-e ou qualquer conta automaticamente com IA">
          🤖 Ler Documento
        </button>
        <button class="btn btn-secondary btn-sm" onclick="Lancamentos.showParcelamento()" style="display:flex;align-items:center;gap:6px;border:1px solid rgba(245,158,11,.4);color:#f59e0b;font-weight:700;" title="Lançar conta parcelada em múltiplas vezes">
          📅 Parcelar
        </button>
        <button class="btn btn-success btn-sm" onclick="Lancamentos.showForm('receita')">&uarr; Nova Receita</button>
        <button class="btn btn-danger btn-sm" onclick="Lancamentos.showForm('despesa')">&darr; Nova Despesa</button>
      </div>
    </div>

    <div class="g4" style="margin-bottom:16px;">
      <div class="kpi-card" style="padding:14px;"><div class="kpi-label">Total Receitas</div><div class="kpi-value green" style="font-size:1.2rem">${Utils.fmt.currency(r.totalReceitas)}</div></div>
      <div class="kpi-card" style="padding:14px;"><div class="kpi-label">Total Despesas</div><div class="kpi-value red" style="font-size:1.2rem">${Utils.fmt.currency(r.totalDespesas)}</div></div>
      <div class="kpi-card" style="padding:14px;"><div class="kpi-label">Saldo</div><div class="kpi-value ${r.saldo>=0?'blue':'red'}" style="font-size:1.2rem">${Utils.fmt.currency(r.saldo)}</div></div>
      <div class="kpi-card" style="padding:14px;"><div class="kpi-label">A Pagar</div><div class="kpi-value yellow" style="font-size:1.2rem">${Utils.fmt.currency(r.aPagarValor)}</div></div>
    </div>

    <div class="filters-bar">
      <div class="filter-group" style="flex:1">
        <label class="filter-label">Buscar</label>
        <div class="search-bar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input class="form-control" id="f-srch" placeholder="Descrição, fornecedor, conta..."></div>
      </div>
      <div class="filter-group">
        <label class="filter-label">Tipo</label>
        <select class="form-control" id="f-tipo" style="min-width:110px">
          <option value="">Todos</option><option value="receita">Receitas</option><option value="despesa">Despesas</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Categoria</label>
        <select class="form-control" id="f-cat" style="min-width:140px">
          <option value="">Todas</option>
          <optgroup label="💰 Receitas">
            <option value="parcela_caixa">&#x1F3E6; Parcela Caixa</option>
            <option value="entrada_propria">&#x1F4B5; Entrada Pr&oacute;pria</option>
            <option value="aporte_financeiro">💼 Aporte Financeiro</option>
            <option value="emprestimo">🤝 Empréstimo</option>
            <option value="financiamento">🏗️ Financiamento</option>
          </optgroup>
          <optgroup label="🏗️ Obras">
            <option value="material">&#x1F9F1; Material</option>
            <option value="mao_de_obra">&#x1F477; M&atilde;o de Obra</option>
            <option value="servico">&#x1F527; Servi&ccedil;o</option>
            <option value="equipamento">&#x1F3D7;&#xFE0F; Equipamento</option>
            <option value="taxa">&#x1F4CB; Taxa/Imposto</option>
          </optgroup>
          <optgroup label="🏢 Escritório / Sede">
            <option value="energia">💡 Energia Elétrica</option>
            <option value="agua">💧 Água e Esgoto</option>
            <option value="internet_tel">🌐 Internet &amp; Telefonia</option>
            <option value="imposto_simples">🏛️ DAS Simples Nacional</option>
            <option value="tributos_trabalhistas">📄 INSS / FGTS / Tributos</option>
            <option value="salario">👥 Salários / Folha</option>
            <option value="pro_labore">💼 Pró-Labore Sócios</option>
            <option value="aluguel_sede">🏢 Aluguel / Sede</option>
            <option value="contabilidade">⚖️ Contábil / Jurídico</option>
            <option value="software_ti">💻 Softwares &amp; TI</option>
            <option value="material_escritorio">📦 Material &amp; Copa</option>
          </optgroup>
          <option value="outro">&#x1F4E6; Outros</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="form-control" id="f-status" style="min-width:130px">
          <option value="">Todos</option><option value="pago">Pago</option><option value="recebido">Recebido</option>
          <option value="a_pagar">A Pagar</option><option value="a_receber">A Receber</option><option value="em_atraso">Em Atraso</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Per&iacute;odo</label>
        <div style="display:flex;gap:5px">
          <input class="form-control" type="date" id="f-di" style="width:130px" title="Data inicial">
          <input class="form-control" type="date" id="f-df" style="width:130px" title="Data final">
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="Lancamentos.clearFilters()" style="align-self:flex-end">Limpar</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <div class="tbl-wrap" style="border:none;border-radius:14px 14px 0 0;">
        <table>
          <thead><tr>
            <th>Data Emiss&atilde;o</th>
            <th>Vencimento</th>
            <th>Data Pagto / Rec.</th>
            ${showObra?'<th>Obra</th>':''}
            <th>Descri&ccedil;&atilde;o</th><th>Categoria</th><th>Fornecedor / Benefici&aacute;rio</th>
            <th>Conta Banc&aacute;ria</th>
            <th>NF</th><th>Tipo</th><th>Valor</th><th>Status</th>
            <th title="Anexos">📎</th>
            <th title="Conciliado">&#x2696;</th>
            <th style="text-align:center;">A&ccedil;&otilde;es</th>
          </tr></thead>
          <tbody id="t-lans">${this._rows(visiveis,showObra)}</tbody>
          <tfoot id="t-foot"><tr>${this._foot(lans,showObra,visiveis.length)}</tr></tfoot>
        </table>
      </div>
      <div id="lan-load-more-bar">
        ${this._loadMoreHtml(lans.length, visiveis.length)}
      </div>
    </div>`;
  },

  _rows(lans, showObra) {
    const cs = DB.getAll('clientes');
    const colsCount = showObra ? 15 : 14;
    if (!lans.length) return `<tr><td colspan="${colsCount}" style="text-align:center;color:var(--text3);padding:32px">Nenhum lan&ccedil;amento encontrado</td></tr>`;
    const hoje = Utils.today();

    return lans.map(l => {
      const c = l.obra_id === 'escritorio' ? { nome: '🏢 Sede / Escritório' } : cs.find(x=>x.id===l.obra_id);
      const nf = l.nota_fiscal_id ? DB.getById('notas',l.nota_fiscal_id) : null;
      const venc = l.data_vencimento || l.data;
      const isAtrasado = (l.status==='a_pagar'||l.status==='a_receber') && venc < hoje;
      const isBaixado = l.status === 'pago' || l.status === 'recebido';
      const statusBadge = isAtrasado ? `<span class="badge badge-danger">&#x26A0; Atrasado</span>` : Utils.badge(l.status);
      const clipBadge = typeof Documentos !== 'undefined' ? Documentos.badgeClip('lancamento', l.id, { titulo: l.descricao }) : '📎';
      const dataPagtoFmt = isBaixado
        ? `<span style="color:var(--success);font-weight:700;font-size:.78rem;">✓ ${Utils.fmt.date(l.data_pagamento || l.data)}</span>`
        : `<span style="color:var(--text3);font-size:.75rem;">—</span>`;

      return `<tr>
        <td style="white-space:nowrap;font-size:.78rem;font-weight:600">${Utils.fmt.date(l.data)}</td>
        <td style="white-space:nowrap;font-size:.78rem;font-weight:700;color:${isAtrasado?'var(--danger)':'var(--accent2)'}">${Utils.fmt.date(venc)}</td>
        <td style="white-space:nowrap;">${dataPagtoFmt}</td>
        ${showObra?`<td style="font-size:.76rem;color:var(--text2);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c?.nome||'&mdash;'}</td>`:''}
        <td>
          <div style="font-weight:600">${l.descricao}</div>
          ${l.itens && l.itens.length ? `<div style="font-size:.7rem;color:var(--accent2);margin-top:2px;cursor:pointer" onclick="Lancamentos.verItens('${l.id}')" title="Ver produtos deste lançamento">📦 ${l.itens.length} produto${l.itens.length>1?'s':''}</div>` : ''}
          ${l.codigo_barras ? `<div style="font-size:.7rem;font-family:monospace;color:var(--accent2);" title="Linha digitável do boleto">🔢 ${l.codigo_barras}</div>` : ''}
          ${l.observacoes?`<div style="font-size:.72rem;color:var(--text3)">${l.observacoes}</div>`:''}
        </td>
        <td style="white-space:nowrap">${Utils.catLabel(l.categoria)}</td>
        <td style="font-size:.78rem;color:var(--text2);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.fornecedor_beneficiario||'&mdash;'}</td>
        <td style="font-size:.76rem;color:var(--text3);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.conta_bancaria ? `&#x1F3E6; ${l.conta_bancaria}` : '&mdash;'}</td>
        <td>${nf?`<span style="color:var(--accent2);cursor:pointer;font-size:.78rem;font-weight:700" onclick="App.navigate('notas')" title="Ver NF">#${nf.numero_nf}</span>`:'&mdash;'}</td>
        <td>${l.tipo==='receita'?'<span class="badge badge-success">&uarr; Receita</span>':'<span class="badge badge-danger">&darr; Despesa</span>'}</td>
        <td style="font-weight:800;white-space:nowrap;color:${l.tipo==='receita'?'var(--success)':'var(--danger)'};">${l.tipo==='receita'?'+':'&minus;'} ${Utils.fmt.currency(l.valor)}</td>
        <td>${statusBadge}</td>
        <td style="text-align:center;">${clipBadge}</td>
        <td style="text-align:center;font-size:14px">${l.conciliado?'&#x2705;':'&#x23F3;'}</td>
        <td style="text-align:center;">
          <div style="display:flex;gap:4px;justify-content:center;align-items:center;">
            ${!isBaixado ? `
            <button class="btn btn-sm btn-success" onclick="Lancamentos.marcarBaixa('${l.id}')" title="Dar Baixa (Confirmar Pagamento/Recebimento)" style="font-size:.72rem;padding:3px 7px;">
              ✓ Baixar
            </button>` : ''}
            <button class="icon-btn" onclick="WhatsApp.enviarAlertaVencimento(DB.getById('lancamentos','${l.id}'))" title="Enviar Alerta no WhatsApp" style="font-size:13px;color:#25D366;">📲</button>
            <button class="icon-btn" onclick="Lancamentos.emitirRecibo('${l.id}')" title="Emitir Recibo Oficial" style="font-size:13px">&#x1F9FE;</button>
            <button class="icon-btn" onclick="Lancamentos.showForm('${l.tipo}','${l.id}')" title="Editar" style="font-size:13px">&#x270F;&#xFE0F;</button>
            <button class="icon-btn" onclick="Lancamentos.del('${l.id}')" title="Excluir" style="font-size:13px;color:var(--danger)">&#x1F5D1;&#xFE0F;</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  _foot(lans, showObra, visiveisCount = null) {
    const cols = showObra ? 15 : 14;
    const rec = lans.filter(l=>l.tipo==='receita').reduce((s,l)=>s+l.valor,0);
    const desp = lans.filter(l=>l.tipo==='despesa').reduce((s,l)=>s+l.valor,0);
    const total = lans.length;
    const vCount = visiveisCount !== null ? visiveisCount : Math.min(total, this._limit || 30);
    const labelTxt = total > vCount
      ? `TOTAL FILTRADO (${total} itens &bull; exibindo ${vCount})`
      : `TOTAL FILTRADO (${total} itens)`;

    return `<td colspan="${cols-7}" style="font-weight:700;color:var(--text3);font-size:.75rem">${labelTxt}</td>
      <td colspan="2" style="font-weight:800;color:var(--success);white-space:nowrap">+${Utils.fmt.currency(rec)}</td>
      <td colspan="5" style="font-weight:800;color:var(--danger);white-space:nowrap">&minus;${Utils.fmt.currency(desp)}</td>`;
  },

  emitirRecibo(lancamentoId) {
    const l = DB.getById('lancamentos', lancamentoId);
    if (!l) return;
    if (typeof Recibos !== 'undefined') {
      Recibos.novoReciboModal({
        lancamento_id: l.id,
        valor: l.valor,
        tipo: l.tipo,
        obra_id: l.obra_id,
        fornecedor_beneficiario: l.fornecedor_beneficiario,
        beneficiario_nome: l.fornecedor_beneficiario,
        descricao: l.descricao,
        referente: l.descricao,
        data: l.data_pagamento || l.data
      });
    }
  },

  showForm(tipo, id=null) {
    const l = id ? DB.getById('lancamentos',id)||{tipo} : {tipo};
    const isEdit = !!id;
    const notas = typeof DB !== 'undefined' ? (DB.getAll('notas') || []) : [];
    const catRec = [
      ['parcela_caixa','🏦 Parcela Caixa'],
      ['entrada_propria','💵 Entrada Própria'],
      ['aporte_financeiro','💼 Aporte Financeiro'],
      ['emprestimo','🤝 Empréstimo'],
      ['financiamento','🏗️ Financiamento'],
      ['outro','📦 Outros']
    ];
    const catDesp = [
      ['material','🧱 Material de Obra'],
      ['mao_de_obra','👷 Mão de Obra'],
      ['servico','🔧 Serviço'],
      ['equipamento','🏗️ Equipamento'],
      ['taxa','📋 Taxa/Imposto'],
      ['energia','💡 Energia Elétrica (Sede)'],
      ['agua','💧 Água e Esgoto (Sede)'],
      ['internet_tel','🌐 Internet & Telefonia'],
      ['imposto_simples','🏛️ DAS Simples Nacional'],
      ['tributos_trabalhistas','📄 INSS / FGTS / Tributos'],
      ['salario','👥 Salários / Folha'],
      ['pro_labore','💼 Pró-Labore Sócios'],
      ['aluguel_sede','🏢 Aluguel / Sede'],
      ['contabilidade','⚖️ Contábil / Jurídico'],
      ['software_ti','💻 Softwares & TI'],
      ['material_escritorio','📦 Material Escritório & Copa'],
      ['outro','📦 Outros']
    ];
    const cats = tipo==='receita' ? catRec : catDesp;
    const statOpts = tipo==='receita'
      ? [['recebido','✓ Recebido'],['a_receber','⏳ A Receber']]
      : [['pago','✓ Pago'],['a_pagar','⏳ A Pagar'],['em_atraso','⚠ Em Atraso']];
    
    const contaAtual = l.conta_bancaria || '';
    const hoje = Utils.today();
    const isPagoOuRec = l.status === 'pago' || l.status === 'recebido';

    Utils.showModal(`
      <div class="modal" style="max-width:620px">
        <div class="modal-header">
          <span class="modal-title" style="color:${tipo==='receita'?'var(--success)':'var(--danger)'}">${isEdit?'✏️ Editar Lançamento':tipo==='receita'?'↑ Nova Receita':'↓ Nova Despesa'}</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <form id="f-lan">
            <input type="hidden" name="tipo" value="${l.tipo||tipo}">
            
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Obra / Centro de Custo *</label><select class="form-control" name="obra_id" required>${Utils.clienteOptions(l.obra_id||(App.obraId!=='todas'?App.obraId:''), 'Selecione centro...', true)}</select></div>
              <div class="form-group"><label class="form-label">Valor (R$) *</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="valor" type="number" value="${l.valor||''}" step="0.01" min="0" required placeholder="0,00"></div></div>
            </div>

            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Data de Compet&ecirc;ncia / Emiss&atilde;o *</label>
                <input class="form-control" type="date" name="data" value="${l.data||hoje}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Data de Vencimento / Previs&atilde;o *</label>
                <input class="form-control" type="date" name="data_vencimento" value="${l.data_vencimento||l.data||hoje}" required>
              </div>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Descri&ccedil;&atilde;o *</label>
              <input class="form-control" name="descricao" value="${l.descricao||''}" required placeholder="Ex: Compra de cimento para fundação">
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Fornecedor / Beneficiário / Favorecido</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <select class="form-control" id="lan-forn-sel" onchange="Lancamentos._onFornecedorChange(this)" style="flex:1;">
                  ${typeof Fornecedores !== 'undefined' ? Fornecedores.fornecedorOptions(l.fornecedor_beneficiario||'') : '<option value="">Sem fornecedores cadastrados</option>'}
                </select>
                <button type="button" class="btn btn-secondary btn-sm" onclick="Fornecedores.showForm()" title="Cadastrar novo fornecedor" style="white-space:nowrap;">
                  &#x2795; Novo
                </button>
              </div>
              <input class="form-control" name="fornecedor_beneficiario" id="lan-forn-manual" value="${l.fornecedor_beneficiario||''}" placeholder="Ou digite o nome do fornecedor / beneficiário" style="margin-top:6px;display:${l.fornecedor_beneficiario && !Fornecedores?.getByNome(l.fornecedor_beneficiario) ? 'block' : 'none'};">
              <div id="lan-forn-info" style="margin-top:5px;font-size:.74rem;color:var(--accent2);display:none;"></div>
            </div>

            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Categoria *</label><select class="form-control" name="categoria" required>${cats.map(([v,t])=>`<option value="${v}" ${l.categoria===v?'selected':''}>${t}</option>`).join('')}</select></div>
              <div class="form-group"><label class="form-label">Status *</label><select class="form-control" name="status" id="lan-status-sel" onchange="Lancamentos._onStatusChange(this.value)" required>${statOpts.map(([v,t])=>`<option value="${v}" ${(l.status||statOpts[0][0])===v?'selected':''}>${t}</option>`).join('')}</select></div>
            </div>

            <!-- CAMPO: DATA DE PAGAMENTO / RECEBIMENTO -->
            <div class="form-group" id="lan-data-pagamento-group" style="margin-bottom:14px;display:${isPagoOuRec?'block':'none'};background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.2);border-radius:8px;padding:10px 12px;">
              <label class="form-label" style="color:var(--success);font-weight:700;margin-bottom:4px;">✓ Data Efetiva do Pagamento / Recebimento</label>
              <input class="form-control" type="date" name="data_pagamento" id="lan-data-pagamento" value="${l.data_pagamento || (isPagoOuRec ? l.data : hoje)}" style="border-color:var(--success);background:var(--bg-card);">
              <span style="font-size:.72rem;color:var(--text3);margin-top:3px;display:block;">Data exata em que o valor foi pago ou recebido na conta</span>
            </div>

            <!-- Seleção de Conta Bancária Vinculada -->
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Conta Banc&aacute;ria</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <select class="form-control" id="lan-conta-sel" onchange="Lancamentos._onContaChange(this)" style="flex:1;">
                  ${typeof Contas !== 'undefined' ? Contas.contaOptions(contaAtual) : `<option value="">Nenhuma conta</option>`}
                </select>
                <button type="button" class="btn btn-secondary btn-sm" onclick="App.navigate('contas')" title="Cadastrar nova conta" style="white-space:nowrap;">&#x2795; Nova Conta</button>
              </div>
              <input class="form-control" name="conta_bancaria_manual" id="lan-conta-manual" value="${contaAtual}" placeholder="Ou digite o nome/agência/conta" style="margin-top:6px;display:none;">
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Linha Digit&aacute;vel / C&oacute;digo de Barras do Boleto / Chave Pix</label>
              <input class="form-control" name="codigo_barras" value="${l.codigo_barras||''}" placeholder="Ex: 34191.79001 01043.510047 91020.150008 5 98760000012000" style="font-family:monospace;font-size:.82rem;">
            </div>

            ${tipo==='despesa'?`<div class="form-group" style="margin-bottom:14px;"><label class="form-label">Vincular Nota Fiscal</label><select class="form-control" name="nota_fiscal_id"><option value="">Nenhuma NF vinculada</option>${notas.filter(n=>n.tipo==='entrada').map(n=>`<option value="${n.id}" ${l.nota_fiscal_id===n.id?'selected':''}>NF ${n.numero_nf||'S/N'} &mdash; ${(n.emitente||'Sem emitente').slice(0,30)} (${Utils.fmt.currency(n.valor_bruto !== undefined ? n.valor_bruto : (n.valor_total || 0))})</option>`).join('')}</select></div>`:''}

            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Conciliado?</label><select class="form-control" name="conciliado"><option value="true" ${l.conciliado?'selected':''}>&#x2705; Sim</option><option value="false" ${!l.conciliado?'selected':''}>&#x23F3; N&atilde;o</option></select></div>
              <div class="form-group"><label class="form-label">Origem</label><select class="form-control" name="origem"><option value="manual" ${(l.origem||'manual')==='manual'?'selected':''}>&#x270D; Manual</option><option value="ocr" ${l.origem==='ocr'?'selected':''}>🤖 Reconhecimento OCR</option><option value="ofx" ${l.origem==='ofx'?'selected':''}>&#x1F504; Importado OFX</option><option value="importacao_excel" ${l.origem==='importacao_excel'?'selected':''}>📊 Planilha Excel</option><option value="medicao" ${l.origem==='medicao'?'selected':''}>&#x1F4CB; Medi&ccedil;&atilde;o Caixa</option></select></div>
            </div>

            <div class="form-group"><label class="form-label">Observa&ccedil;&otilde;es</label><textarea class="form-control" name="observacoes" rows="2" placeholder="Observações adicionais ou notas">${l.observacoes||''}</textarea></div>

            <!-- SEÇÃO DE ITENS / PRODUTOS -->
            ${tipo === 'despesa' ? `
            <div style="border:1px solid var(--border);border-radius:10px;margin-top:8px;overflow:hidden;">
              <div style="background:var(--bg-secondary);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="Lancamentos._toggleItens()">
                <div style="font-weight:700;font-size:.85rem;color:var(--text);">📦 Itens / Produtos deste Lançamento <span style="font-size:.75rem;font-weight:400;color:var(--text3);">(opcional — para rastrear gastos por produto)</span></div>
                <span id="itens-toggle-icon" style="font-size:.8rem;color:var(--accent2);">${l.itens?.length?'▲ Recolher':'▼ Expandir'}</span>
              </div>
              <div id="itens-section" style="display:${l.itens?.length?'block':'none'};padding:14px;">
                <div id="itens-lista">
                  ${(l.itens||[]).map(it => `
                    <div class="item-row" style="display:grid;grid-template-columns:2fr .7fr .8fr 1fr auto;gap:6px;margin-bottom:8px;align-items:center;">
                      <input class="form-control item-produto" placeholder="Produto (ex: Cimento CP-II)" value="${it.produto}" oninput="Lancamentos._recalcItem(this)" style="font-size:.82rem;">
                      <input class="form-control item-qtd" type="number" placeholder="Qtd" step="0.01" min="0" value="${it.qtd}" oninput="Lancamentos._recalcItem(this)" style="font-size:.82rem;text-align:right;">
                      <input class="form-control item-unidade" placeholder="Un (sc, m², kg)" value="${it.unidade}" style="font-size:.82rem;">
                      <input class="form-control item-vunit" type="number" placeholder="Valor unit. R$" step="0.01" min="0" value="${it.valor_unit}" oninput="Lancamentos._recalcItem(this)" style="font-size:.82rem;text-align:right;">
                      <button type="button" class="icon-btn" onclick="this.closest('.item-row').remove();Lancamentos._atualizarTotalItens()" title="Remover" style="color:var(--danger);font-size:15px;">🗑️</button>
                    </div>
                  `).join('')}
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="Lancamentos._addItem()" style="margin-top:8px;display:flex;align-items:center;gap:6px;">
                  ➕ Adicionar Produto
                </button>
                <div id="itens-total-display" style="margin-top:10px;font-size:.82rem;color:var(--text3);">${l.itens?.length?`Total dos itens: ${Utils.fmt.currency(l.valor)}`:''}</div>
              </div>
            </div>` : ''}

            ${isEdit ? `
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;margin-top:14px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <strong style="font-size:.82rem;color:var(--text);">📎 Documentos &amp; Comprovantes</strong>
                <div style="font-size:.72rem;color:var(--text3);">Anexe PDFs de boletos, comprovantes de PIX ou recibos assinados</div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="Documentos.abrirModal('lancamento', '${l.id}', 'Documentos do Lançamento')">
                Gerenciar Anexos (${typeof Documentos !== 'undefined' ? Documentos.listar('lancamento', l.id).length : 0})
              </button>
            </div>` : ''}
          </form>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            ${!isEdit ? `<button type="button" class="btn btn-secondary btn-sm" onclick="Lancamentos.showParcelamento('${tipo}')" style="display:flex;align-items:center;gap:5px;border:1px dashed #f59e0b;color:#f59e0b;" title="Dividir em múltiplas parcelas mensais">📅 Parcelar</button>` : ''}
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="Lancamentos.save('${id||''}')">${isEdit?'&#x2714; Salvar Altera&ccedil;&otilde;es':'+ Adicionar Lan&ccedil;amento'}</button>
          </div>
        </div>
      </div>`);
  },

  _onStatusChange(status) {
    const grp = document.getElementById('lan-data-pagamento-group');
    const dtInput = document.getElementById('lan-data-pagamento');
    if (!grp) return;
    if (status === 'pago' || status === 'recebido') {
      grp.style.display = 'block';
      if (dtInput && !dtInput.value) dtInput.value = Utils.today();
    } else {
      grp.style.display = 'none';
    }
  },

  _onFornecedorChange(sel) {
    const manual = document.getElementById('lan-forn-manual');
    const info   = document.getElementById('lan-forn-info');
    const fornInput = document.querySelector('#f-lan [name="fornecedor_beneficiario"]');
    if (!manual) return;

    if (sel.value === '__manual__') {
      manual.style.display = 'block';
      manual.focus();
      if (info) info.style.display = 'none';
      // Limpa o campo hidden para obrigar digitação
      if (fornInput) fornInput.value = '';
    } else if (sel.value === '') {
      manual.style.display = 'none';
      if (info) info.style.display = 'none';
      if (fornInput) fornInput.value = '';
    } else {
      // Fornecedor selecionado do cadastro
      manual.style.display = 'none';
      if (fornInput) fornInput.value = sel.value;
      // Mostra dados extras do fornecedor selecionado
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

  _onContaChange(sel) {
    const manual = document.getElementById('lan-conta-manual');
    if (!manual) return;
    if (sel.value === '__manual__') {
      manual.style.display = 'block';
      manual.focus();
    } else {
      manual.style.display = 'none';
    }
  },

  save(id) {
    const f = document.getElementById('f-lan');
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const d = Object.fromEntries(new FormData(f));
    d.valor = parseFloat(d.valor)||0;
    d.conciliado = d.conciliado==='true';
    d.data_vencimento = d.data_vencimento || d.data;

    // Tratar fornecedor selecionado do cadastro ou digitado manualmente
    const selForn = document.getElementById('lan-forn-sel')?.value;
    const manForn = document.getElementById('lan-forn-manual')?.value || '';
    if (selForn && selForn !== '__manual__' && selForn !== '') {
      d.fornecedor_beneficiario = selForn;
    } else if (selForn === '__manual__' && manForn) {
      d.fornecedor_beneficiario = manForn;
    }
    delete d.conta_bancaria_manual;

    // Cadastra/vincula fornecedor se digitado manualmente
    if (typeof Fornecedores !== 'undefined' && d.fornecedor_beneficiario) {
      Fornecedores.encontrarOuCriar({
        razao_social: d.fornecedor_beneficiario,
        nome_fantasia: d.fornecedor_beneficiario,
        categoria: d.categoria || 'material'
      });
    }

    // Salvar itens de produto e vincular ao módulo Produtos
    const itensRows = document.querySelectorAll('#itens-lista .item-row');
    const itens = [];
    itensRows.forEach(row => {
      const produto = row.querySelector('.item-produto')?.value?.trim();
      const qtd = parseFloat(row.querySelector('.item-qtd')?.value) || 0;
      const unidade = row.querySelector('.item-unidade')?.value?.trim() || 'un';
      const valorUnit = parseFloat(row.querySelector('.item-vunit')?.value) || 0;
      let produtoId = row.querySelector('.item-produto-id')?.value || null;

      if (produto && (qtd > 0 || valorUnit > 0)) {
        if (typeof Produtos !== 'undefined') {
          const prod = Produtos.encontrarOuCriar(produto, unidade, d.categoria || 'material');
          if (prod) {
            produtoId = prod.id;
            Produtos.atualizarValorMedio(prod.id);
          }
        }
        itens.push({
          produto,
          qtd,
          unidade,
          valor_unit: valorUnit,
          total: qtd * valorUnit,
          produto_id: produtoId
        });
      }
    });
    d.itens = itens;

    // Se tem itens e valor não foi editado manualmente ou está zerado, recalcular
    if (itens.length > 0) {
      const totalItens = itens.reduce((s, it) => s + it.total, 0);
      if (totalItens > 0 && d.valor === 0) d.valor = totalItens;
    }

    // Trata data_pagamento
    if (d.status === 'pago' || d.status === 'recebido') {
      d.data_pagamento = d.data_pagamento || d.data || Utils.today();
    } else {
      d.data_pagamento = null;
    }

    // Tratar conta bancária selecionada ou digitada
    const selConta = document.getElementById('lan-conta-sel')?.value;
    const manConta = document.getElementById('lan-conta-manual')?.value || '';
    if (selConta && selConta !== '__manual__') {
      d.conta_bancaria = selConta;
    } else {
      d.conta_bancaria = manConta;
    }

    if (!d.nota_fiscal_id) delete d.nota_fiscal_id;
    let savedRec = null;
    if (id) {
      savedRec = DB.update('lancamentos', id, d);
      Utils.toast('Lançamento atualizado!', 'success');
    } else {
      savedRec = DB.add('lancamentos', d);
      Utils.toast('Lançamento adicionado!', 'success');
    }

    // Se a criação foi originada da tela de conciliação OFX, vincula automaticamente
    if (typeof OFX !== 'undefined' && OFX._reconcileContext) {
      const { importId, trnId } = OFX._reconcileContext;
      OFX._reconcileContext = null;
      const targetId = id || savedRec?.id;
      if (targetId && importId && trnId) {
        OFX.conciliar(importId, trnId, targetId, false);
      }
    }

    Utils.closeModal();

    // Se o lançamento veio de OCR, anexar o documento automaticamente
    if (!id && this._ocrArquivoPendente && savedRec?.id && typeof Documentos !== 'undefined') {
      const { arquivo, base64 } = this._ocrArquivoPendente;
      this._ocrArquivoPendente = null;
      Documentos.adicionar({
        entidade_tipo: 'lancamento',
        entidade_id:   savedRec.id,
        titulo:        arquivo.name,
        nome_arquivo:  arquivo.name,
        tipo_mime:     arquivo.type || 'application/octet-stream',
        tamanho:       arquivo.size,
        data_base64:   base64,
        _origem:       'ocr'
      });
      Utils.toast('📎 Documento original anexado automaticamente!', 'info');
    }

    this._refresh();
  },

  marcarBaixa(id) {
    const l = DB.getById('lancamentos', id);
    if (!l) return;
    const contas = DB.getAll('contas');
    const isRec = l.tipo === 'receita';

    Utils.showModal(`
      <div class="modal" style="max-width:420px;width:95vw;">
        <div class="modal-header">
          <span class="modal-title">${isRec ? '✓ Confirmar Recebimento' : '✓ Confirmar Pagamento'}</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:16px 20px;">
          <div style="font-weight:700;color:var(--text);margin-bottom:4px;">${l.descricao}</div>
          <div style="font-size:1.2rem;font-weight:900;color:${isRec?'var(--success)':'var(--danger)'};margin-bottom:12px;">
            ${isRec?'+':'-'}${Utils.fmt.currency(l.valor)}
          </div>
          
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">${isRec ? 'Conta Bancária de Entrada' : 'Conta Bancária de Saída'}</label>
            <select id="baixa-conta" class="form-control">
              ${contas.map(c => `<option value="${c.apelido||c.banco_nome}" ${l.conta_bancaria===(c.apelido||c.banco_nome)?'selected':''}>${c.apelido||c.banco_nome}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Data Efetiva da Baixa</label>
            <input type="date" id="baixa-data" class="form-control" value="${Utils.today()}" required>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-success" onclick="Lancamentos.confirmarBaixa('${l.id}')" style="font-weight:800;">
            ✓ Confirmar Baixa
          </button>
        </div>
      </div>
    `);
  },

  confirmarBaixa(id) {
    const l = DB.getById('lancamentos', id);
    if (!l) return;
    const conta = document.getElementById('baixa-conta')?.value || l.conta_bancaria || 'BB — Movimento Principal';
    const dataBaixa = document.getElementById('baixa-data')?.value || Utils.today();
    const novoStatus = l.tipo === 'receita' ? 'recebido' : 'pago';

    DB.update('lancamentos', id, {
      status: novoStatus,
      data_pagamento: dataBaixa,
      conta_bancaria: conta,
      conciliado: true
    });

    Utils.closeModal();
    Utils.toast(l.tipo === 'receita' ? 'Receita marcada como Recebida!' : 'Despesa baixada como Paga!', 'success');
    this._refresh();
  },

  del(id) {
    Utils.confirm('Excluir este lançamento?', () => {
      DB.remove('lancamentos',id);
      this._refresh();
      Utils.toast('Lançamento excluído!','info');
    });
  },

  _getFiltered() {
    const oid = App.obraId;
    const f = {
      tipo: document.getElementById('f-tipo')?.value||undefined,
      status: document.getElementById('f-status')?.value||undefined,
      categoria: document.getElementById('f-cat')?.value||undefined,
      dataInicio: document.getElementById('f-di')?.value||undefined,
      dataFim: document.getElementById('f-df')?.value||undefined,
      search: document.getElementById('f-srch')?.value||undefined,
    };
    Object.keys(f).forEach(k=>{ if(!f[k]) delete f[k]; });
    return DB.getLancamentos(oid==='todas'?null:oid, f);
  },

  _loadMoreHtml(total, visiveis) {
    if (total === 0) return '';
    if (visiveis >= total) {
      return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:rgba(20,31,14,0.6);border-top:1px solid var(--border-s);flex-wrap:wrap;gap:8px;">
        <span style="font-size:.78rem;color:var(--text3);">
          ✓ Exibindo todos os <strong>${total}</strong> lançamentos
        </span>
      </div>`;
    }
    const restantes = total - visiveis;
    const prox = Math.min(30, restantes);
    return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:rgba(20,31,14,0.85);border-top:1px solid var(--border-s);flex-wrap:wrap;gap:12px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:.82rem;color:var(--text2);">
          Exibindo <strong>${visiveis}</strong> de <strong>${total}</strong> lançamentos
        </span>
        <span class="badge badge-warning" style="font-size:.72rem;padding:3px 8px;font-weight:700;">
          ${restantes} restantes
        </span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="Lancamentos.carregarMais(30)" style="font-weight:700;display:flex;align-items:center;gap:6px;border:1px solid var(--accent);color:var(--accent2);cursor:pointer;">
          <span>➕ Carregar mais ${prox}</span>
        </button>
        <button class="btn btn-primary btn-sm" onclick="Lancamentos.carregarTodos()" style="font-weight:700;display:flex;align-items:center;gap:6px;cursor:pointer;">
          <span>⚡ Carregar restante (${restantes})</span>
        </button>
      </div>
    </div>`;
  },

  carregarMais(qtd = 30) {
    this._limit += qtd;
    this._refresh(false);
  },

  carregarTodos() {
    this._limit = Infinity;
    this._refresh(false);
  },

  _refresh(resetLimit = false) {
    if (resetLimit) {
      this._limit = 30;
    }
    const showObra = App.obraId==='todas';
    const lans = this._getFiltered();
    const visiveis = lans.slice(0, this._limit);
    const tb = document.getElementById('t-lans');
    const tf = document.getElementById('t-foot');
    const lm = document.getElementById('lan-load-more-bar');
    if (tb) tb.innerHTML = this._rows(visiveis, showObra);
    if (tf) tf.innerHTML = `<tr>${this._foot(lans, showObra, visiveis.length)}</tr>`;
    if (lm) lm.innerHTML = this._loadMoreHtml(lans.length, visiveis.length);
  },

  clearFilters() {
    ['f-srch','f-tipo','f-cat','f-status','f-di','f-df'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    this._refresh(true);
  },

  _toggleItens() {
    const sec = document.getElementById('itens-section');
    const icon = document.getElementById('itens-toggle-icon');
    if (!sec) return;
    if (sec.style.display === 'none') {
      sec.style.display = 'block';
      if (icon) icon.textContent = '▲ Recolher';
      if (!document.querySelector('#itens-lista .item-row')) this._addItem();
    } else {
      sec.style.display = 'none';
      if (icon) icon.textContent = '▼ Expandir';
    }
  },

  _addItem(item = null) {
    const lista = document.getElementById('itens-lista');
    if (!lista) return;
    const prods = typeof DB !== 'undefined' ? DB.getAll('produtos') : [];
    const prodsDatalistId = 'prod-options-list';
    
    // Cria datalist se não existir
    if (!document.getElementById(prodsDatalistId)) {
      const dl = document.createElement('datalist');
      dl.id = prodsDatalistId;
      dl.innerHTML = prods.map(p => `<option value="${p.nome}" data-unidade="${p.unidade||'un'}" data-valor="${p.valor_medio||0}" data-id="${p.id}">${p.nome} (${p.unidade||'un'})</option>`).join('');
      document.body.appendChild(dl);
    }

    const row = document.createElement('div');
    row.className = 'item-row';
    row.style.cssText = 'display:grid;grid-template-columns:2fr .7fr .8fr 1fr auto;gap:6px;margin-bottom:8px;align-items:center;';
    row.innerHTML = `
      <input type="hidden" class="item-produto-id" value="${item?.produto_id || ''}">
      <input class="form-control item-produto" list="${prodsDatalistId}" placeholder="Produto (ex: Cimento CP-II)" value="${item?.produto||''}" oninput="Lancamentos._onProdutoInput(this)" style="font-size:.82rem;">
      <input class="form-control item-qtd" type="number" placeholder="Qtd" step="0.01" min="0" value="${item?.qtd||''}" oninput="Lancamentos._recalcItem(this)" style="font-size:.82rem;text-align:right;">
      <input class="form-control item-unidade" placeholder="Un (sc, m², kg)" value="${item?.unidade||'un'}" style="font-size:.82rem;">
      <input class="form-control item-vunit" type="number" placeholder="Valor unit. R$" step="0.01" min="0" value="${item?.valor_unit||''}" oninput="Lancamentos._recalcItem(this)" style="font-size:.82rem;text-align:right;">
      <button type="button" class="icon-btn" onclick="this.closest('.item-row').remove();Lancamentos._atualizarTotalItens()" title="Remover" style="color:var(--danger);font-size:15px;">🗑️</button>
    `;
    lista.appendChild(row);
    if (item?.produto) this._atualizarTotalItens();
  },

  _onProdutoInput(inp) {
    const val = inp.value.trim().toLowerCase();
    const row = inp.closest('.item-row');
    if (!row) return;
    const prods = typeof DB !== 'undefined' ? DB.getAll('produtos') : [];
    const match = prods.find(p => p.nome.toLowerCase() === val);
    if (match) {
      const idInp = row.querySelector('.item-produto-id');
      const unInp = row.querySelector('.item-unidade');
      const vuInp = row.querySelector('.item-vunit');
      if (idInp) idInp.value = match.id;
      if (unInp && match.unidade) unInp.value = match.unidade;
      if (vuInp && match.valor_medio && !vuInp.value) vuInp.value = match.valor_medio;
    }
    this._recalcItem(inp);
  },

  _recalcItem(el) {
    this._atualizarTotalItens();
    const valorInput = document.querySelector('#f-lan [name="valor"]');
    if (!valorInput) return;
    const total = this._somarItens();
    if (total > 0) valorInput.value = total.toFixed(2);
  },

  _somarItens() {
    let soma = 0;
    document.querySelectorAll('#itens-lista .item-row').forEach(row => {
      const qtd = parseFloat(row.querySelector('.item-qtd')?.value) || 0;
      const vu  = parseFloat(row.querySelector('.item-vunit')?.value) || 0;
      soma += qtd * vu;
    });
    return soma;
  },

  _atualizarTotalItens() {
    const display = document.getElementById('itens-total-display');
    if (!display) return;
    const total = this._somarItens();
    display.textContent = total > 0 ? `Total dos itens: ${Utils.fmt.currency(total)}` : '';
  },

  verItens(id) {
    const l = DB.getById('lancamentos', id);
    if (!l || !l.itens?.length) return;
    const rows = l.itens.map((it, i) => `
      <tr style="background:${i%2===0?'var(--bg-card)':'var(--bg-secondary)'}">
        <td style="padding:8px 12px;font-weight:700;color:var(--text);">${it.produto}</td>
        <td style="padding:8px 12px;text-align:right;color:var(--text2);">${it.qtd} ${it.unidade}</td>
        <td style="padding:8px 12px;text-align:right;color:var(--text2);">${Utils.fmt.currency(it.valor_unit)}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:800;color:var(--danger);">- ${Utils.fmt.currency(it.total || (it.qtd * it.valor_unit))}</td>
      </tr>`).join('');
    Utils.showModal(`
      <div class="modal" style="max-width:560px;">
        <div class="modal-header">
          <span class="modal-title">📦 Produtos — ${l.descricao}</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <table style="width:100%;border-collapse:collapse;font-size:.84rem;">
            <thead><tr style="background:var(--bg-secondary);color:var(--text3);font-size:.72rem;text-transform:uppercase;">
              <th style="padding:8px 12px;text-align:left;">Produto</th>
              <th style="padding:8px 12px;text-align:right;">Qtd</th>
              <th style="padding:8px 12px;text-align:right;">Valor Unit.</th>
              <th style="padding:8px 12px;text-align:right;">Total</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr style="border-top:2px solid var(--border);">
              <td colspan="3" style="padding:10px 12px;font-weight:800;color:var(--text);">TOTAL</td>
              <td style="padding:10px 12px;text-align:right;font-weight:900;color:var(--danger);font-size:1rem;">- ${Utils.fmt.currency(l.valor)}</td>
            </tr></tfoot>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Fechar</button>
          <button class="btn btn-primary" onclick="Utils.closeModal();Lancamentos.showForm('${l.tipo}','${l.id}')">✏️ Editar Lançamento</button>
        </div>
      </div>`);
  },

  abrirAnaliseProdutos() {
    if (typeof Produtos !== 'undefined' && Produtos.showAnalise) {
      Produtos.showAnalise();
    } else {
      App.navigate('produtos');
    }
  },

  // ── Abre formulário de lançamento pré-preenchido pelo robô OCR ─────────────
  showFormOCR(dadosOCR, arquivo, base64) {
    const tipo = dadosOCR.tipo || 'despesa';

    // Abrir formulário normal
    this.showForm(tipo);

    // Aguardar o modal renderizar e então preencher os campos
    setTimeout(() => {
      const form = document.getElementById('f-lan');
      if (!form) return;

      const set = (name, val) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (el && val !== undefined && val !== null && val !== '') el.value = val;
      };

      set('valor',                  dadosOCR.valor);
      set('data',                   dadosOCR.data         || Utils.today());
      set('data_vencimento',        dadosOCR.data_vencimento || dadosOCR.data || Utils.today());
      set('descricao',              dadosOCR.descricao);
      set('fornecedor_beneficiario', dadosOCR.fornecedor_beneficiario);
      set('categoria',              dadosOCR.categoria);
      set('codigo_barras',          dadosOCR.codigo_barras);
      set('observacoes',            dadosOCR.observacoes);
      set('origem',                 'ocr');

      // Preencher fornecedor manual (campo de texto visível)
      const fornManual = document.getElementById('lan-forn-manual');
      if (fornManual && dadosOCR.fornecedor_beneficiario) {
        fornManual.value   = dadosOCR.fornecedor_beneficiario;
        fornManual.style.display = 'block';
      }

      // Preencher itens se houver
      if (dadosOCR.itens && dadosOCR.itens.length > 0) {
        // Expandir seção de itens
        const itensSection = document.getElementById('itens-section');
        const itensToggle  = document.getElementById('itens-toggle-icon');
        if (itensSection) itensSection.style.display = 'block';
        if (itensToggle)  itensToggle.textContent = '▲ Recolher';

        const itensLista = document.getElementById('itens-lista');
        if (itensLista) {
          itensLista.innerHTML = dadosOCR.itens.map(it => `
            <div class="item-row" style="display:grid;grid-template-columns:2fr .7fr .8fr 1fr auto;gap:6px;margin-bottom:8px;align-items:center;">
              <input class="form-control item-produto" placeholder="Produto" value="${(it.produto||'').replace(/"/g,'&quot;')}" oninput="Lancamentos._recalcItem(this)" style="font-size:.82rem;">
              <input class="form-control item-qtd" type="number" placeholder="Qtd" step="0.01" min="0" value="${it.qtd||''}" oninput="Lancamentos._recalcItem(this)" style="font-size:.82rem;text-align:right;">
              <input class="form-control item-unidade" placeholder="Un" value="${it.unidade||'un'}" style="font-size:.82rem;">
              <input class="form-control item-vunit" type="number" placeholder="V. unit." step="0.01" min="0" value="${it.valor_unit||''}" oninput="Lancamentos._recalcItem(this)" style="font-size:.82rem;text-align:right;">
              <button type="button" class="icon-btn" onclick="this.closest('.item-row').remove();Lancamentos._atualizarTotalItens()" title="Remover" style="color:var(--danger);font-size:15px;">🗑️</button>
            </div>`).join('');
          this._atualizarTotalItens();
        }
      }

      // Toast informativo
      Utils.toast(`🤖 Formulário pré-preenchido pelo OCR! Revise e salve.`, 'info');

      // Se tiver arquivo, anexar automaticamente após salvar
      // Guardar referência para anexo pós-save
      if (arquivo && base64) {
        Lancamentos._ocrArquivoPendente = { arquivo, base64 };
      }
    }, 200);
  },

  // Referência ao arquivo OCR para anexar após salvar
  _ocrArquivoPendente: null,

  // ── LANÇAMENTO PARCELADO AUTOMÁTICO (DELEGADO A PARCELAMENTO) ───────────────
  showParcelamento(tipoPadrao = 'despesa') {
    if (typeof Parcelamento !== 'undefined') {
      Parcelamento.abrir(tipoPadrao, () => this._refresh(true));
    }
  },
  _gerarPreviewParcelas() {
    if (typeof Parcelamento !== 'undefined') Parcelamento._gerarPreview();
  },
  salvarParcelamento() {
    if (typeof Parcelamento !== 'undefined') Parcelamento.salvar();
  },

  init() {
    const ids = ['f-srch','f-tipo','f-cat','f-status','f-di','f-df'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this._refresh(true));
        el.addEventListener('input', () => this._refresh(true));
      }
    });
  }
};
