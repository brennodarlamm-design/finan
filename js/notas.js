// js/notas.js — Notas Fiscais Module

const Notas = {
  render(obraId) {
    const nfs = this._getFiltered(obraId);
    const total = nfs.reduce((s,n)=>s+(Number(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total) || 0),0);
    const pendentes = nfs.filter(n=>n.status==='pendente' || n.status==='vencida');
    const pagas = nfs.filter(n=>n.status==='paga');
    const totalPagas = pagas.reduce((s,n)=>s+(Number(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total) || 0),0);
    const totalPendentes = pendentes.reduce((s,n)=>s+(Number(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total) || 0),0);
    return `
    <div class="page-header">
      <div><h1 class="page-title">🧾 Notas Fiscais</h1><p class="page-sub">${nfs.length} NFs cadastradas</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="Notas.triggerXmlImport()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Importar XML NF-e
        </button>
        <input type="file" id="xml-nfe-input" accept=".xml" multiple style="display:none" onchange="Notas.handleXmlFiles(event)">
        <button class="btn btn-primary" onclick="Notas.showForm()">+ Nova NF</button>
      </div>
    </div>

    <div class="g4" style="margin-bottom:16px;">
      <div class="kpi-card" style="padding:14px;"><div class="kpi-label">Total NFs</div><div class="kpi-value blue" style="font-size:1.2rem">${Utils.fmt.currency(total)}</div></div>
      <div class="kpi-card" style="padding:14px;"><div class="kpi-label">Pagas</div><div class="kpi-value green" style="font-size:1.2rem">${Utils.fmt.currency(totalPagas)}</div></div>
      <div class="kpi-card" style="padding:14px;"><div class="kpi-label">Pendentes</div><div class="kpi-value yellow" style="font-size:1.2rem">${pendentes.length}</div></div>
      <div class="kpi-card" style="padding:14px;"><div class="kpi-label">Valor Pendente</div><div class="kpi-value yellow" style="font-size:1.2rem">${Utils.fmt.currency(totalPendentes)}</div></div>
    </div>

    <div class="filters-bar">
      <div class="filter-group" style="flex:1">
        <label class="filter-label">Buscar</label>
        <div class="search-bar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input class="form-control" id="f-srch-nf" placeholder="Nº NF, emitente, chave..."></div>
      </div>
      <div class="filter-group">
        <label class="filter-label">Tipo</label>
        <select class="form-control" id="f-tipo-nf">
          <option value="">Todos</option><option value="entrada">Entrada</option><option value="saida">Saída</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Categoria</label>
        <select class="form-control" id="f-cat-nf" style="min-width:130px">
          <option value="">Todas</option>
          <option value="material">🧱 Material</option><option value="mao_de_obra">👷 Mão de Obra</option>
          <option value="servico">🔧 Serviço</option><option value="equipamento">🏗️ Equipamento</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="form-control" id="f-status-nf" style="min-width:120px">
          <option value="">Todos</option><option value="pendente">Pendente</option>
          <option value="paga">Paga</option><option value="vencida">Vencida</option><option value="cancelada">Cancelada</option>
        </select>
      </div>
    </div>

    <div class="card" style="padding:0;">
      <div class="tbl-wrap" style="border:none;border-radius:14px;">
        <table>
          <thead><tr>
            <th>Nº NF</th><th>Emissão</th><th>Vencimento</th><th>Data Pagamento</th>
            ${obraId==='todas'?'<th>Obra</th>':''}
            <th>Emitente</th><th>Categoria</th><th>Tipo</th>
            <th>Valor Bruto</th><th>Impostos</th><th>Valor Líquido</th>
            <th>Status</th>
            <th title="Anexos">📎</th>
            <th>Lançamento</th><th style="text-align:center;">Ações</th>
          </tr></thead>
          <tbody id="t-nfs">${this._rows(nfs,obraId==='todas')}</tbody>
          <tfoot><tr id="t-nf-foot">${this._foot(nfs,obraId==='todas')}</tr></tfoot>
        </table>
      </div>
    </div>`;
  },

  _getFiltered(obraId, filters={}) {
    let nfs = DB.getAll('notas');
    if (obraId && obraId!=='todas') nfs=nfs.filter(n=>n.obra_id===obraId);
    if (filters.tipo) nfs=nfs.filter(n=>n.tipo===filters.tipo);
    if (filters.categoria) nfs=nfs.filter(n=>n.categoria===filters.categoria);
    if (filters.status) nfs=nfs.filter(n=>n.status===filters.status);
    if (filters.search) { const s=filters.search.toLowerCase(); nfs=nfs.filter(n=>((n.numero_nf||'')+(n.emitente||'')+(n.chave_nfe||'')).toLowerCase().includes(s)); }
    return nfs.sort((a,b)=>(b.data_emissao||'').localeCompare(a.data_emissao||''));
  },

  _rows(nfs, showObra) {
    const colsCount = showObra ? 15 : 14;
    if (!nfs.length) return `<tr><td colspan="${colsCount}" style="text-align:center;color:var(--text3);padding:32px">Nenhuma NF encontrada</td></tr>`;
    return nfs.map(n => {
      const c = n.obra_id === 'escritorio' ? { nome: '🏢 Sede / Escritório' } : DB.getById('clientes',n.obra_id);
      const l = n.lancamento_id ? DB.getById('lancamentos',n.lancamento_id) : null;
      const isVencida = n.status==='pendente' && n.data_vencimento && n.data_vencimento < Utils.today();
      if (isVencida && n.status==='pendente') { DB.update('notas',n.id,{status:'vencida'}); n.status='vencida'; }
      const clipBadge = typeof Documentos !== 'undefined' ? Documentos.badgeClip('nota', n.id, { titulo: `NF ${n.numero_nf} — ${n.emitente}` }) : '📎';
      const isPaga = n.status === 'paga';
      const dtPagFmt = isPaga
        ? `<span style="color:var(--success);font-weight:700;font-size:.78rem;">✓ ${Utils.fmt.date(n.data_pagamento || n.data_emissao)}</span>`
        : `<span style="color:var(--text3);font-size:.75rem;">—</span>`;

      const vBruto = Number(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total) || 0;
      const vImpostos = Number(n.impostos) || 0;
      const vLiquido = Number(n.valor_liquido !== undefined ? n.valor_liquido : (vBruto - vImpostos)) || 0;
      const cat = n.categoria || 'material';
      const isSaida = n.tipo === 'saida';

      return `<tr>
        <td style="font-weight:800;color:var(--accent2)">${n.numero_nf || '—'}</td>
        <td style="white-space:nowrap;font-size:.8rem">${Utils.fmt.date(n.data_emissao)}</td>
        <td style="white-space:nowrap;font-size:.8rem;color:${n.status==='vencida'?'var(--danger)':'inherit'}">${Utils.fmt.date(n.data_vencimento)}</td>
        <td style="white-space:nowrap;">${dtPagFmt}</td>
        ${showObra?`<td style="font-size:.76rem;color:var(--text2)">${c?.nome||'—'}</td>`:''}
        <td style="font-size:.78rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${n.emitente || ''}">${n.emitente || '—'}</td>
        <td>${Utils.catLabel(cat)}</td>
        <td>${!isSaida?'<span class="badge badge-info">↓ Entrada</span>':'<span class="badge badge-accent">↑ Saída</span>'}</td>
        <td style="font-weight:700">${Utils.fmt.currency(vBruto)}</td>
        <td style="color:var(--danger);font-size:.8rem">${Utils.fmt.currency(vImpostos)}</td>
        <td style="font-weight:700;color:var(--success)">${Utils.fmt.currency(vLiquido)}</td>
        <td>${Utils.badge(n.status || 'pendente')}</td>
        <td style="text-align:center;">${clipBadge}</td>
        <td>${l?`<span style="font-size:.75rem;color:var(--text2)" title="${l.descricao}">✅ ${l.descricao.slice(0,20)}...</span>`:'<span style="font-size:.72rem;color:var(--text3)">Não vinculada</span>'}</td>
        <td style="text-align:center;"><div style="display:flex;gap:4px;justify-content:center;align-items:center;">
          ${!isPaga ? `
          <button class="btn btn-sm btn-success" onclick="Notas.marcarPaga('${n.id}')" title="Dar Baixa / Confirmar Pagamento da NF" style="font-size:.72rem;padding:3px 7px;">
            ✓ Pagar
          </button>` : ''}
          <button class="icon-btn btn-sm" onclick="Notas.showForm('${n.id}')" style="font-size:12px">✏️</button>
          <button class="icon-btn btn-sm" onclick="Notas.del('${n.id}')" style="font-size:12px;color:var(--danger)">🗑️</button>
        </div></td>
      </tr>`;
    }).join('');
  },

  _foot(nfs, showObra) {
    const tb = nfs.reduce((s,n)=>s+(Number(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total) || 0), 0);
    const ti = nfs.reduce((s,n)=>s+(Number(n.impostos) || 0), 0);
    const tl = nfs.reduce((s,n)=>s+(Number(n.valor_liquido !== undefined ? n.valor_liquido : ((Number(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total) || 0) - (Number(n.impostos) || 0))) || 0), 0);
    const cols = showObra ? 8 : 7;
    return `<td colspan="${cols}" style="font-weight:700;color:var(--text3);font-size:.75rem">TOTAL (${nfs.length} NFs)</td>
      <td style="font-weight:800">${Utils.fmt.currency(tb)}</td>
      <td style="font-weight:800;color:var(--danger)">${Utils.fmt.currency(ti)}</td>
      <td style="font-weight:800;color:var(--success)">${Utils.fmt.currency(tl)}</td>
      <td colspan="4"></td>`;
  },

  showForm(id=null) {
    const n = id ? DB.getById('notas',id)||{} : {};
    const lans = DB.getAll('lancamentos');
    const isPaga = n.status === 'paga';
    const hoje = Utils.today();

    Utils.showModal(`
      <div class="modal" style="max-width:640px">
        <div class="modal-header">
          <span class="modal-title">${id?'✏️ Editar Nota Fiscal':'🧾 Nova Nota Fiscal'}</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <form id="f-nf">
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Obra / Centro de Custo *</label><select class="form-control" name="obra_id" required>${Utils.clienteOptions(n.obra_id||(App.obraId!=='todas'?App.obraId:''), 'Selecione centro...', true)}</select></div>
              <div class="form-group"><label class="form-label">Número NF *</label><input class="form-control" name="numero_nf" value="${n.numero_nf||''}" required placeholder="001234"></div>
              <div class="form-group"><label class="form-label">Série</label><input class="form-control" name="serie" value="${n.serie||'001'}" placeholder="001"></div>
            </div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Emitente *</label><input class="form-control" name="emitente" value="${n.emitente||''}" required placeholder="Razão social do emitente"></div>
              <div class="form-group"><label class="form-label">CNPJ Emitente</label><input class="form-control" name="cnpj_emitente" value="${n.cnpj_emitente||''}" placeholder="00.000.000/0000-00"></div>
            </div>
            <div class="form-group" style="margin-bottom:14px;"><label class="form-label">Destinatário</label><input class="form-control" name="destinatario" value="${n.destinatario||''}" placeholder="Nome do destinatário"></div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Data Emissão *</label><input class="form-control" type="date" name="data_emissao" value="${n.data_emissao||Utils.today()}" required></div>
              <div class="form-group"><label class="form-label">Data Vencimento</label><input class="form-control" type="date" name="data_vencimento" value="${n.data_vencimento||''}"></div>
            </div>
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Valor Bruto *</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="valor_bruto" type="number" value="${n.valor_bruto||''}" step="0.01" min="0" required id="nf-vb" oninput="Notas.calcLiq()"></div></div>
              <div class="form-group"><label class="form-label">Impostos (R$)</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="impostos" type="number" value="${n.impostos||0}" step="0.01" min="0" id="nf-imp" oninput="Notas.calcLiq()"></div></div>
              <div class="form-group"><label class="form-label">Valor Líquido</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="valor_liquido" type="number" value="${n.valor_liquido||''}" step="0.01" id="nf-vl" readonly style="background:var(--bg-secondary)"></div></div>
            </div>
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Tipo *</label><select class="form-control" name="tipo" required><option value="entrada" ${(n.tipo||'entrada')==='entrada'?'selected':''}>↓ Entrada (Compra)</option><option value="saida" ${n.tipo==='saida'?'selected':''}>↑ Saída (Serviço)</option></select></div>
              <div class="form-group"><label class="form-label">Categoria *</label><select class="form-control" name="categoria" required>
                <option value="material" ${n.categoria==='material'?'selected':''}>🧱 Material</option>
                <option value="mao_de_obra" ${n.categoria==='mao_de_obra'?'selected':''}>👷 Mão de Obra</option>
                <option value="servico" ${(n.categoria||'servico')==='servico'?'selected':''}>🔧 Serviço</option>
                <option value="equipamento" ${n.categoria==='equipamento'?'selected':''}>🏗️ Equipamento</option>
                <option value="energia" ${n.categoria==='energia'?'selected':''}>💡 Energia Elétrica</option>
                <option value="imposto_simples" ${n.categoria==='imposto_simples'?'selected':''}>🏛️ DAS Simples Nacional</option>
                <option value="outro" ${n.categoria==='outro'?'selected':''}>📦 Outro</option>
              </select></div>
              <div class="form-group"><label class="form-label">Status</label><select class="form-control" name="status" id="nf-status-sel" onchange="Notas._onStatusChange(this.value)">
                <option value="pendente" ${(n.status||'pendente')==='pendente'?'selected':''}>⏳ Pendente</option>
                <option value="paga" ${n.status==='paga'?'selected':''}>✓ Paga</option>
                <option value="vencida" ${n.status==='vencida'?'selected':''}>⚠ Vencida</option>
                <option value="cancelada" ${n.status==='cancelada'?'selected':''}>✕ Cancelada</option>
              </select></div>
            </div>

            <!-- CAMPO DATA PAGAMENTO DA NOTA -->
            <div class="form-group" id="nf-data-pagamento-group" style="margin-bottom:14px;display:${isPaga?'block':'none'};background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.2);border-radius:8px;padding:10px 12px;">
              <label class="form-label" style="color:var(--success);font-weight:700;margin-bottom:4px;">✓ Data Efetiva do Pagamento da NF</label>
              <input class="form-control" type="date" name="data_pagamento" id="nf-data-pagamento" value="${n.data_pagamento || (isPaga ? n.data_emissao : hoje)}" style="border-color:var(--success);background:var(--bg-card);">
            </div>

            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Vincular Lançamento</label><select class="form-control" name="lancamento_id">
                <option value="">Nenhum</option>
                ${lans.map(l=>`<option value="${l.id}" ${n.lancamento_id===l.id?'selected':''}>${l.descricao.slice(0,35)} (${Utils.fmt.currency(l.valor)})</option>`).join('')}
              </select></div>
              <div class="form-group"><label class="form-label">Chave NF-e</label><input class="form-control" name="chave_nfe" value="${n.chave_nfe||''}" placeholder="44 dígitos" maxlength="44"></div>
            </div>
            <div class="form-group"><label class="form-label">Observações</label><textarea class="form-control" name="observacoes" rows="2">${n.observacoes||''}</textarea></div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="Notas.save('${id||''}')">${id?'✔ Salvar':'+ Adicionar NF'}</button>
        </div>
      </div>`);
    this.calcLiq();
  },

  _onStatusChange(st) {
    const grp = document.getElementById('nf-data-pagamento-group');
    const dt = document.getElementById('nf-data-pagamento');
    if (!grp) return;
    if (st === 'paga') {
      grp.style.display = 'block';
      if (dt && !dt.value) dt.value = Utils.today();
    } else {
      grp.style.display = 'none';
    }
  },

  calcLiq() {
    const vb=parseFloat(document.getElementById('nf-vb')?.value)||0;
    const imp=parseFloat(document.getElementById('nf-imp')?.value)||0;
    const el=document.getElementById('nf-vl');
    if(el) el.value=(vb-imp).toFixed(2);
  },

  save(id) {
    const f=document.getElementById('f-nf');
    if(!f.checkValidity()){f.reportValidity();return;}
    const d=Object.fromEntries(new FormData(f));
    d.valor_bruto=parseFloat(d.valor_bruto)||0;
    d.impostos=parseFloat(d.impostos)||0;
    d.valor_liquido=parseFloat(d.valor_liquido)||0;
    if (d.status === 'paga') {
      d.data_pagamento = d.data_pagamento || d.data_emissao || Utils.today();
    } else {
      d.data_pagamento = null;
    }
    if(!d.lancamento_id) delete d.lancamento_id;
    if(id){DB.update('notas',id,d);Utils.toast('NF atualizada!','success');}
    else{DB.add('notas',d);Utils.toast('NF cadastrada!','success');}
    Utils.closeModal();
    this._refresh();
  },

  marcarPaga(id) {
    const n = DB.getById('notas', id);
    if (!n) return;
    const contas = DB.getAll('contas');

    Utils.showModal(`
      <div class="modal" style="max-width:420px;width:95vw;">
        <div class="modal-header">
          <span class="modal-title">✓ Confirmar Pagamento da NF</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:16px 20px;">
          <div style="font-weight:700;color:var(--text);margin-bottom:4px;">NF ${n.numero_nf} &mdash; ${n.emitente}</div>
          <div style="font-size:1.2rem;font-weight:900;color:var(--success);margin-bottom:12px;">
            ${Utils.fmt.currency(n.valor_liquido || n.valor_bruto)}
          </div>
          
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Conta Bancária de Débito</label>
            <select id="nf-baixa-conta" class="form-control">
              ${contas.map(c => `<option value="${c.apelido||c.banco_nome}">${c.apelido||c.banco_nome}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Data Efetiva do Pagamento</label>
            <input type="date" id="nf-baixa-data" class="form-control" value="${Utils.today()}" required>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-success" onclick="Notas.confirmarPagamento('${n.id}')" style="font-weight:800;">
            ✓ Confirmar Pagamento
          </button>
        </div>
      </div>
    `);
  },

  confirmarPagamento(id) {
    const n = DB.getById('notas', id);
    if (!n) return;
    const conta = document.getElementById('nf-baixa-conta')?.value || 'BB — Movimento Principal';
    const dataPag = document.getElementById('nf-baixa-data')?.value || Utils.today();

    DB.update('notas', id, {
      status: 'paga',
      data_pagamento: dataPag
    });

    if (n.lancamento_id) {
      DB.update('lancamentos', n.lancamento_id, {
        status: 'pago',
        data_pagamento: dataPag,
        conta_bancaria: conta,
        conciliado: true
      });
    }

    Utils.closeModal();
    Utils.toast('Nota Fiscal marcada como Paga!', 'success');
    this._refresh();
  },

  del(id) {
    Utils.confirm('Excluir esta Nota Fiscal?',()=>{DB.remove('notas',id);this._refresh();Utils.toast('NF excluída!','info');});
  },

  _refresh() {
    const oid=App.obraId;
    const f={
      tipo:document.getElementById('f-tipo-nf')?.value||undefined,
      categoria:document.getElementById('f-cat-nf')?.value||undefined,
      status:document.getElementById('f-status-nf')?.value||undefined,
      search:document.getElementById('f-srch-nf')?.value||undefined,
    };
    Object.keys(f).forEach(k=>{if(!f[k])delete f[k];});
    const nfs=this._getFiltered(oid,f);
    const showObra=oid==='todas';
    const tb=document.getElementById('t-nfs');
    const tf=document.getElementById('t-nf-foot');
    if(tb) tb.innerHTML=this._rows(nfs,showObra);
    if(tf) tf.innerHTML=this._foot(nfs);
  },

  init() {
    ['f-srch-nf','f-tipo-nf','f-cat-nf','f-status-nf'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.addEventListener('change',()=>this._refresh());el.addEventListener('input',()=>this._refresh());}
    });
  },

  triggerXmlImport() {
    document.getElementById('xml-nfe-input')?.click();
  },

  handleXmlFiles(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    let imported = 0, errors = 0, duplicates = 0;
    const results = [];
    let processed = 0;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = this.parseXmlNFe(e.target.result);
          results.push({ file: file.name, data: parsed, ok: true });
        } catch(err) {
          results.push({ file: file.name, error: err.message, ok: false });
        }
        processed++;
        if (processed === files.length) {
          this.showXmlPreview(results);
          // Reset input so same file can be re-imported
          event.target.value = '';
        }
      };
      reader.readAsText(file, 'UTF-8');
    });
  },

  parseXmlNFe(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    // Verifica erros de parse
    if (doc.querySelector('parsererror')) throw new Error('XML inválido ou corrompido.');

    // Helper: pega texto de tag, ignorando namespace
    const get = (parent, tag) => {
      // Tenta com e sem namespace
      let el = parent.querySelector(tag);
      if (!el) {
        // Busca ignorando namespace (nfe:tag)
        const all = parent.getElementsByTagName(tag);
        el = all.length ? all[0] : null;
      }
      if (!el) {
        // Tenta variações com * namespace
        const all = parent.querySelectorAll('*');
        for (const node of all) {
          if (node.localName === tag) { el = node; break; }
        }
      }
      return el?.textContent?.trim() || '';
    };

    // Raiz: NFe > infNFe
    const infNFe = doc.querySelector('infNFe') ||
                   Array.from(doc.querySelectorAll('*')).find(el => el.localName === 'infNFe');
    if (!infNFe) throw new Error('Estrutura NF-e não encontrada no XML. Verifique se é um XML de NF-e válido.');

    // Chave de acesso (no atributo Id do infNFe)
    const chaveRaw = infNFe.getAttribute('Id') || '';
    const chave = chaveRaw.replace(/^NFe/, '').trim();

    // ide — identificação
    const ide = infNFe.querySelector('ide') ||
                Array.from(infNFe.querySelectorAll('*')).find(el => el.localName === 'ide');

    const nNF    = get(ide || infNFe, 'nNF');
    const serie  = get(ide || infNFe, 'serie');
    const dhEmi  = get(ide || infNFe, 'dhEmi') || get(ide || infNFe, 'dEmi');
    const tpNF   = get(ide || infNFe, 'tpNF'); // 0=entrada, 1=saída

    // Data emissão (ISO ou datetime)
    const dataEmissao = dhEmi ? dhEmi.substring(0, 10) : Utils.today();

    // emit — emitente
    const emit = infNFe.querySelector('emit') ||
                 Array.from(infNFe.querySelectorAll('*')).find(el => el.localName === 'emit');
    const emitenteNome = get(emit || infNFe, 'xNome') || get(emit || infNFe, 'xFant');
    const emitenteCNPJ = get(emit || infNFe, 'CNPJ');
    const cnpjFormatado = emitenteCNPJ.length === 14
      ? emitenteCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      : emitenteCNPJ;

    // dest — destinatário
    const dest = infNFe.querySelector('dest') ||
                 Array.from(infNFe.querySelectorAll('*')).find(el => el.localName === 'dest');
    const destinatario = get(dest || infNFe, 'xNome');

    // ICMSTot — totais
    const icmsTot = infNFe.querySelector('ICMSTot') ||
                    Array.from(infNFe.querySelectorAll('*')).find(el => el.localName === 'ICMSTot');
    const vNF   = parseFloat(get(icmsTot || infNFe, 'vNF'))   || 0; // valor total NF
    const vICMS = parseFloat(get(icmsTot || infNFe, 'vICMS')) || 0;
    const vIPI  = parseFloat(get(icmsTot || infNFe, 'vIPI'))  || 0;
    const vPIS  = parseFloat(get(icmsTot || infNFe, 'vPIS'))  || 0;
    const vCOFINS = parseFloat(get(icmsTot || infNFe, 'vCOFINS')) || 0;
    const vISS  = parseFloat(get(icmsTot || infNFe, 'vISS'))  || 0;
    const impostos = parseFloat((vICMS + vIPI + vPIS + vCOFINS + vISS).toFixed(2));
    const valorLiquido = parseFloat((vNF - impostos).toFixed(2));

    // Tipo: NF-e tpNF=0 entrada, 1=saída (do emitente)
    // Na perspectiva da construtora: entrada = ela comprou (recebeu mercadoria)
    const tipo = tpNF === '0' ? 'entrada' : 'saida';

    if (!nNF) throw new Error('Número da NF não encontrado no XML.');
    if (!emitenteNome) throw new Error('Emitente não encontrado no XML.');
    if (vNF === 0) throw new Error('Valor da NF é zero ou não encontrado.');

    return {
      numero_nf:      nNF,
      serie:          serie || '001',
      emitente:       emitenteNome,
      cnpj_emitente:  cnpjFormatado,
      destinatario:   destinatario,
      data_emissao:   dataEmissao,
      data_vencimento:'',
      valor_bruto:    vNF,
      impostos:       impostos,
      valor_liquido:  valorLiquido,
      tipo:           tipo,
      categoria:      'servico',
      status:         'pendente',
      chave_nfe:      chave,
      observacoes:    '',
    };
  },

  showXmlPreview(results) {
    const ok = results.filter(r => r.ok);
    const err = results.filter(r => !r.ok);

    // Verifica duplicatas (chave já cadastrada)
    const existingChaves = new Set(DB.getAll('notas').map(n => n.chave_nfe).filter(Boolean));
    ok.forEach(r => { r.duplicate = r.data.chave_nfe && existingChaves.has(r.data.chave_nfe); });

    const toImport = ok.filter(r => !r.duplicate);
    const dups = ok.filter(r => r.duplicate);

    Utils.showModal(`
      <div class="modal modal-xl">
        <div class="modal-header">
          <span class="modal-title">📥 Importar XML NF-e — Prévia</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          ${err.length ? `<div style="padding:12px 16px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;margin-bottom:14px;font-size:.82rem">
            ⚠️ <strong>${err.length} arquivo(s) com erro:</strong>
            ${err.map(r => `<div style="margin-top:4px;color:var(--danger)">${r.file}: ${r.error}</div>`).join('')}
          </div>` : ''}
          ${dups.length ? `<div style="padding:12px 16px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:8px;margin-bottom:14px;font-size:.82rem">
            ⏭️ <strong>${dups.length} NF(s) já cadastrada(s) serão ignoradas:</strong>
            ${dups.map(r => `<div style="color:var(--warning);margin-top:3px">${r.file} — NF ${r.data.numero_nf} (chave já existe)</div>`).join('')}
          </div>` : ''}
          ${toImport.length === 0 ? `<div style="text-align:center;padding:32px;color:var(--text3)">Nenhuma NF nova para importar.</div>` : `
          <div style="font-size:.82rem;color:var(--text2);margin-bottom:12px">✅ <strong>${toImport.length} NF(s)</strong> prontas para importar:</div>
          <div class="tbl-wrap" style="max-height:360px;overflow-y:auto">
            <table>
              <thead><tr>
                <th>Arquivo</th><th>Nº NF</th><th>Emissão</th><th>Emitente</th>
                <th>CNPJ</th><th>Tipo</th><th>Valor Bruto</th><th>Impostos</th><th>Valor Líquido</th><th>Obra</th>
              </tr></thead>
              <tbody>
                ${toImport.map((r, i) => `<tr>
                  <td style="font-size:.74rem;color:var(--text3);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.file}">${r.file}</td>
                  <td style="font-weight:800;color:var(--accent)">${r.data.numero_nf}</td>
                  <td style="font-size:.8rem">${Utils.fmt.date(r.data.data_emissao)}</td>
                  <td style="font-size:.78rem;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.data.emitente}">${r.data.emitente}</td>
                  <td style="font-size:.74rem;color:var(--text2)">${r.data.cnpj_emitente}</td>
                  <td>${r.data.tipo==='entrada'?'<span class="badge badge-info">↓ Entrada</span>':'<span class="badge badge-accent">↑ Saída</span>'}</td>
                  <td style="font-weight:700">${Utils.fmt.currency(r.data.valor_bruto)}</td>
                  <td style="color:var(--danger);font-size:.8rem">${Utils.fmt.currency(r.data.impostos)}</td>
                  <td style="font-weight:700;color:var(--success)">${Utils.fmt.currency(r.data.valor_liquido)}</td>
                  <td style="min-width:140px">
                    <select class="form-control" style="font-size:.78rem;padding:5px 8px" id="xml-obra-${i}">
                      ${Utils.clienteOptions(App.obraId !== 'todas' ? App.obraId : '')}
                    </select>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          ${toImport.length > 0 ? `<button class="btn btn-primary" onclick="Notas.confirmXmlImport(${JSON.stringify(toImport.map(r=>r.data)).replace(/"/g,'&quot;')})">✅ Importar ${toImport.length} NF(s)</button>` : ''}
        </div>
      </div>`);
  },

  confirmXmlImport(nfsData) {
    // Relê as obras selecionadas do DOM antes de fechar o modal
    const nfs = nfsData.map ? nfsData : JSON.parse(nfsData);
    const rows = document.querySelectorAll('[id^="xml-obra-"]');
    rows.forEach((sel, i) => { if (nfs[i]) nfs[i].obra_id = sel.value; });

    let count = 0;
    nfs.forEach(nf => {
      if (!nf.obra_id) { Utils.toast('Selecione uma obra para cada NF!', 'warning'); return; }
      DB.add('notas', nf);
      count++;
    });

    Utils.closeModal();
    this._refresh();
    Utils.toast(`${count} NF(s) importada(s) com sucesso!`, 'success');
  }
};
