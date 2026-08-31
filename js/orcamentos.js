// js/orcamentos.js — Budget Forecast Module (Previsão por Etapas + SINAPI)

// sub-aba ativa: 'etapas' | 'sinapi'
const Orcamentos = {
  _activeTab: 'etapas',

  render(obraId) {
    if (!document.getElementById('orc-tab-styles')) {
      const s = document.createElement('style');
      s.id = 'orc-tab-styles';
      s.textContent = '.orc-tab{padding:10px 24px;border:none;background:transparent;color:var(--text3);font-family:inherit;font-size:.875rem;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .2s,border-color .2s;}.orc-tab:hover{color:var(--text);}.orc-tab-active{color:var(--accent)!important;border-bottom-color:var(--accent)!important;}';
      document.head.appendChild(s);
    }
    return `
    <div>
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:24px;">
        <button id="tab-etapas" class="orc-tab${this._activeTab==='etapas'?' orc-tab-active':''}" onclick="Orcamentos._switchTab('etapas','${obraId}')">
          &#x1F4CA; Previsto &times; Realizado
        </button>
        <button id="tab-sinapi" class="orc-tab${this._activeTab==='sinapi'?' orc-tab-active':''}" onclick="Orcamentos._switchTab('sinapi','${obraId}')">
          &#x1F3D7; Or&ccedil;amentos SINAPI
        </button>
      </div>
      <div id="orc-tab-content">
        ${this._renderTab(this._activeTab, obraId)}
      </div>
    </div>`;
  },

  _switchTab(tab, obraId) {
    this._activeTab = tab;
    document.querySelectorAll('.orc-tab').forEach(el => el.classList.remove('orc-tab-active'));
    const tabEl = document.getElementById('tab-' + tab);
    if (tabEl) tabEl.classList.add('orc-tab-active');
    const content = document.getElementById('orc-tab-content');
    if (content) content.innerHTML = this._renderTab(tab, obraId);
  },

  _renderTab(tab, obraId) {
    if (tab === 'sinapi') return OrcamentoSINAPI.render(obraId);
    return this._renderEtapas(obraId);
  },

  _renderEtapas(obraId) {
    const orcs = obraId==='todas' ? DB.getAll('orcamentos') : DB.getAll('orcamentos').filter(o=>o.obra_id===obraId);
    return `
    <div class="page-header">
      <div><h1 class="page-title">&#x1F4CB; Previsto &times; Realizado</h1><p class="page-sub">Controle previsto &times; realizado por etapa de obra</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="Orcamentos.showForm()">+ Novo Or&ccedil;amento</button></div>
    </div>
    <div id="orc-list">
      ${orcs.length ? orcs.map(o=>this._card(o)).join('') : `<div class="empty-state"><h3>Nenhum or&ccedil;amento cadastrado</h3><p>Crie um or&ccedil;amento para controlar as etapas da obra</p><button class="btn btn-primary" onclick="Orcamentos.showForm()">+ Novo Or&ccedil;amento</button></div>`}
    </div>`;
  },


  _card(orc) {
    const cliente = DB.getById('clientes',orc.obra_id);
    const totalPrev = orc.etapas.reduce((s,e)=>s+e.valor_previsto,0);
    const totalReal = orc.etapas.reduce((s,e)=>s+e.valor_realizado,0);
    const variacaoVal = totalReal - totalPrev;
    const pctGeral = totalPrev>0?Math.min(100,(totalReal/totalPrev)*100):0;
    return `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <div>
          <div class="card-title">${orc.nome}</div>
          <div style="font-size:.78rem;color:var(--text3);margin-top:3px">👤 ${cliente?.nome||'—'} &nbsp;|&nbsp; 📅 Criado em ${Utils.fmt.date(orc.data_criacao)}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${Utils.badge(orc.status)}
          <button class="icon-btn btn-sm" onclick="Orcamentos.showForm('${orc.id}')" title="Editar">✏️</button>
          <button class="icon-btn btn-sm" onclick="Orcamentos.del('${orc.id}')" style="color:var(--danger)" title="Excluir">🗑️</button>
        </div>
      </div>

      <div class="g4" style="margin-bottom:18px;">
        <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--r-md);text-align:center">
          <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);margin-bottom:4px">Valor Total Previsto</div>
          <div style="font-size:1.1rem;font-weight:900;color:var(--accent)">${Utils.fmt.currency(totalPrev)}</div>
        </div>
        <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--r-md);text-align:center">
          <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);margin-bottom:4px">Total Realizado</div>
          <div style="font-size:1.1rem;font-weight:900;color:${totalReal<=totalPrev?'var(--success)':'var(--danger)'}">${Utils.fmt.currency(totalReal)}</div>
        </div>
        <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--r-md);text-align:center">
          <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);margin-bottom:4px">Variação</div>
          <div style="font-size:1.1rem;font-weight:900;color:${variacaoVal<=0?'var(--success)':'var(--danger)'}">${variacaoVal>=0?'+':''}${Utils.fmt.currency(variacaoVal)}</div>
        </div>
        <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--r-md);text-align:center">
          <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);margin-bottom:4px">Progresso Geral</div>
          <div style="font-size:1.1rem;font-weight:900;color:var(--accent2)">${pctGeral.toFixed(1)}%</div>
        </div>
      </div>

      <div class="progress-bar" style="height:10px;margin-bottom:20px;">
        <div class="progress-fill ${pctGeral<30?'red':pctGeral<70?'yellow':'green'}" style="width:${pctGeral}%"></div>
      </div>

      <div class="tbl-wrap" style="border:none;">
        <table>
          <thead><tr><th>Etapa</th><th>Previsto</th><th>Realizado</th><th>Variação</th><th style="width:200px">Execução</th><th>Período</th><th></th></tr></thead>
          <tbody>
            ${orc.etapas.map(e=>{
              const v=e.valor_realizado-e.valor_previsto;
              const cl=e.percentual_execucao===100?'green':e.percentual_execucao>50?'yellow':'blue';
              return `<tr>
                <td style="font-weight:700">${e.nome}</td>
                <td>${Utils.fmt.currency(e.valor_previsto)}</td>
                <td style="color:${e.valor_realizado<=e.valor_previsto?'var(--success)':'var(--danger)'};font-weight:700">${Utils.fmt.currency(e.valor_realizado)}</td>
                <td style="color:${v<=0?'var(--success)':'var(--danger)'};font-weight:600">${v>=0?'+':''}${Utils.fmt.currency(v)}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div class="progress-bar" style="flex:1"><div class="progress-fill ${cl}" style="width:${Math.min(100,e.percentual_execucao)}%"></div></div>
                    <span style="font-size:.75rem;font-weight:800;white-space:nowrap;min-width:35px">${e.percentual_execucao}%</span>
                  </div>
                </td>
                <td style="font-size:.76rem;color:var(--text2)">${Utils.fmt.date(e.data_inicio)} → ${Utils.fmt.date(e.data_fim)}</td>
                <td><button class="icon-btn btn-sm" onclick="Orcamentos.editEtapa('${orc.id}','${e.id}')" style="font-size:11px">✏️</button></td>
              </tr>`;
            }).join('')}
            <tfoot><tr>
              <td style="font-weight:800;color:var(--text2);font-size:.78rem">TOTAL</td>
              <td style="font-weight:800">${Utils.fmt.currency(totalPrev)}</td>
              <td style="font-weight:800;color:${totalReal<=totalPrev?'var(--success)':'var(--danger)'}">${Utils.fmt.currency(totalReal)}</td>
              <td style="font-weight:800;color:${variacaoVal<=0?'var(--success)':'var(--danger)'}">${variacaoVal>=0?'+':''}${Utils.fmt.currency(variacaoVal)}</td>
              <td colspan="3"></td>
            </tr></tfoot>
          </tbody>
        </table>
      </div>
      ${orc.descricao?`<div style="margin-top:12px;font-size:.8rem;color:var(--text3);padding:10px;background:var(--bg-secondary);border-radius:var(--r-sm)">📝 ${orc.descricao}</div>`:''}
    </div>`;
  },

  showForm(id=null) {
    const orc = id?DB.getById('orcamentos',id)||{}:{};
    const etapasDefault=[
      {id:DB.uuid(),nome:'Fundação',valor_previsto:0,valor_realizado:0,percentual_execucao:0,data_inicio:'',data_fim:'',observacoes:'',_cor:'blue'},
      {id:DB.uuid(),nome:'Estrutura',valor_previsto:0,valor_realizado:0,percentual_execucao:0,data_inicio:'',data_fim:'',observacoes:'',_cor:'green'},
      {id:DB.uuid(),nome:'Alvenaria',valor_previsto:0,valor_realizado:0,percentual_execucao:0,data_inicio:'',data_fim:'',observacoes:'',_cor:'yellow'},
      {id:DB.uuid(),nome:'Cobertura',valor_previsto:0,valor_realizado:0,percentual_execucao:0,data_inicio:'',data_fim:'',observacoes:'',_cor:'blue'},
      {id:DB.uuid(),nome:'Instalações',valor_previsto:0,valor_realizado:0,percentual_execucao:0,data_inicio:'',data_fim:'',observacoes:'',_cor:'yellow'},
      {id:DB.uuid(),nome:'Acabamento',valor_previsto:0,valor_realizado:0,percentual_execucao:0,data_inicio:'',data_fim:'',observacoes:'',_cor:'green'},
      {id:DB.uuid(),nome:'Imprevistos',valor_previsto:0,valor_realizado:0,percentual_execucao:0,data_inicio:'',data_fim:'',observacoes:'',_cor:'blue'},
    ];
    const etapas = orc.etapas||etapasDefault;
    Utils.showModal(`
      <div class="modal modal-xl">
        <div class="modal-header"><span class="modal-title">${id?'✏️ Editar Orçamento':'📋 Novo Orçamento'}</span><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
        <div class="modal-body">
          <form id="f-orc">
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Obra *</label><select class="form-control" name="obra_id" required>${Utils.clienteOptions(orc.obra_id||App.obraId!=='todas'?App.obraId:'')}</select></div>
              <div class="form-group"><label class="form-label">Nome do Orçamento *</label><input class="form-control" name="nome" value="${orc.nome||''}" required placeholder="Orçamento Base"></div>
              <div class="form-group"><label class="form-label">Status</label><select class="form-control" name="status">
                <option value="ativo" ${(orc.status||'ativo')==='ativo'?'selected':''}>✓ Ativo</option>
                <option value="revisao" ${orc.status==='revisao'?'selected':''}>🔄 Em Revisão</option>
                <option value="cancelado" ${orc.status==='cancelado'?'selected':''}>✕ Cancelado</option>
              </select></div>
            </div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Descrição</label><input class="form-control" name="descricao" value="${orc.descricao||''}" placeholder="Descrição do orçamento"></div>
              <div class="form-group"><label class="form-label">Data de Criação</label><input class="form-control" type="date" name="data_criacao" value="${orc.data_criacao||Utils.today()}"></div>
            </div>
            <div class="divider"></div>
            <div style="font-weight:800;margin-bottom:14px;font-size:.95rem">📊 Etapas da Obra</div>
            <div id="etapas-container">
              ${etapas.map((e,i)=>this._etapaForm(e,i)).join('')}
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Orcamentos.addEtapaForm()">+ Adicionar Etapa</button>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="Orcamentos.save('${id||''}')">${id?'✔ Salvar':'+ Criar Orçamento'}</button>
        </div>
      </div>`);
  },

  _etapaForm(e,i) {
    return `<div class="etapa-form-row" id="ef-${e.id}" style="background:var(--bg-secondary);border-radius:var(--r-md);padding:12px;margin-bottom:10px;position:relative;">
      <input type="hidden" name="etapa_id_${i}" value="${e.id}">
      <div class="form-row cols-4" style="margin-bottom:8px;">
        <div class="form-group"><label class="form-label">Nome</label><input class="form-control" name="etapa_nome_${i}" value="${e.nome}" placeholder="Nome da etapa"></div>
        <div class="form-group"><label class="form-label">Valor Previsto (R$)</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="etapa_prev_${i}" type="number" value="${e.valor_previsto}" step="0.01" min="0" placeholder="0,00"></div></div>
        <div class="form-group"><label class="form-label">Valor Realizado (R$)</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="etapa_real_${i}" type="number" value="${e.valor_realizado}" step="0.01" min="0" placeholder="0,00"></div></div>
        <div class="form-group"><label class="form-label">% Execução</label><div class="input-prefix"><span class="input-pfx-txt">%</span><input name="etapa_pct_${i}" type="number" value="${e.percentual_execucao}" min="0" max="100"></div></div>
      </div>
      <div class="form-row cols-3">
        <div class="form-group"><label class="form-label">Data Início</label><input class="form-control" type="date" name="etapa_di_${i}" value="${e.data_inicio||''}"></div>
        <div class="form-group"><label class="form-label">Data Fim</label><input class="form-control" type="date" name="etapa_df_${i}" value="${e.data_fim||''}"></div>
        <div class="form-group"><label class="form-label">Observações</label><input class="form-control" name="etapa_obs_${i}" value="${e.observacoes||''}" placeholder="Obs."></div>
      </div>
      <button type="button" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:var(--danger);font-size:16px" onclick="this.parentElement.remove()">✕</button>
    </div>`;
  },

  addEtapaForm() {
    const cont = document.getElementById('etapas-container');
    const idx = cont.querySelectorAll('.etapa-form-row').length;
    const e = {id:DB.uuid(),nome:'',valor_previsto:0,valor_realizado:0,percentual_execucao:0,data_inicio:'',data_fim:'',observacoes:''};
    cont.insertAdjacentHTML('beforeend',this._etapaForm(e,idx));
  },

  save(id) {
    const f = document.getElementById('f-orc');
    if(!f.checkValidity()){f.reportValidity();return;}
    const fd = new FormData(f);
    const d = Object.fromEntries(fd);
    const rows = document.querySelectorAll('.etapa-form-row');
    const etapas = Array.from(rows).map((r,i)=>({
      id:fd.get(`etapa_id_${i}`)||DB.uuid(),
      nome:fd.get(`etapa_nome_${i}`)||'',
      valor_previsto:parseFloat(fd.get(`etapa_prev_${i}`))||0,
      valor_realizado:parseFloat(fd.get(`etapa_real_${i}`))||0,
      percentual_execucao:parseInt(fd.get(`etapa_pct_${i}`))||0,
      data_inicio:fd.get(`etapa_di_${i}`)||'',
      data_fim:fd.get(`etapa_df_${i}`)||'',
      observacoes:fd.get(`etapa_obs_${i}`)||'',
      _cor:'blue'
    }));
    const orc = { obra_id:d.obra_id, nome:d.nome, descricao:d.descricao||'', data_criacao:d.data_criacao, status:d.status, valor_total_previsto:etapas.reduce((s,e)=>s+e.valor_previsto,0), etapas };
    if(id){DB.update('orcamentos',id,orc);Utils.toast('Orçamento atualizado!','success');}
    else{DB.add('orcamentos',orc);Utils.toast('Orçamento criado!','success');}
    Utils.closeModal();
    this._refresh();
  },

  editEtapa(orcId, etapaId) {
    const orc = DB.getById('orcamentos',orcId);
    const e = orc?.etapas.find(et=>et.id===etapaId);
    if(!e) return;
    Utils.showModal(`
      <div class="modal" style="max-width:500px">
        <div class="modal-header"><span class="modal-title">✏️ Editar Etapa: ${e.nome}</span><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
        <div class="modal-body">
          <div class="form-row cols-2" style="margin-bottom:14px;">
            <div class="form-group"><label class="form-label">Valor Previsto</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input id="ee-prev" type="number" value="${e.valor_previsto}" step="0.01" min="0"></div></div>
            <div class="form-group"><label class="form-label">Valor Realizado</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input id="ee-real" type="number" value="${e.valor_realizado}" step="0.01" min="0"></div></div>
          </div>
          <div class="form-group"><label class="form-label">% de Execução</label>
            <div style="display:flex;align-items:center;gap:12px">
              <input type="range" id="ee-pct-range" min="0" max="100" value="${e.percentual_execucao}" style="flex:1;accent-color:var(--accent)" oninput="document.getElementById('ee-pct').value=this.value">
              <div class="input-prefix" style="width:80px"><span class="input-pfx-txt">%</span><input id="ee-pct" type="number" value="${e.percentual_execucao}" min="0" max="100" oninput="document.getElementById('ee-pct-range').value=this.value"></div>
            </div>
          </div>
          <div class="form-group"><label class="form-label">Observações</label><textarea class="form-control" id="ee-obs" rows="2">${e.observacoes||''}</textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="Orcamentos.saveEtapa('${orcId}','${etapaId}')">✔ Salvar</button>
        </div>
      </div>`);
  },

  saveEtapa(orcId, etapaId) {
    const orc=DB.getById('orcamentos',orcId);
    if(!orc) return;
    const idx=orc.etapas.findIndex(e=>e.id===etapaId);
    if(idx===-1) return;
    orc.etapas[idx].valor_previsto=parseFloat(document.getElementById('ee-prev').value)||0;
    orc.etapas[idx].valor_realizado=parseFloat(document.getElementById('ee-real').value)||0;
    orc.etapas[idx].percentual_execucao=parseInt(document.getElementById('ee-pct').value)||0;
    orc.etapas[idx].observacoes=document.getElementById('ee-obs').value;
    DB.update('orcamentos',orcId,{etapas:orc.etapas});
    Utils.closeModal();
    this._refresh();
    Utils.toast('Etapa atualizada!','success');
  },

  del(id) {
    Utils.confirm('Excluir este orçamento?',()=>{DB.remove('orcamentos',id);this._refresh();Utils.toast('Orçamento excluído!','info');});
  },

  _refresh() {
    const oid = App.obraId;
    if (this._activeTab === 'sinapi') { OrcamentoSINAPI._refresh(); return; }
    const orcs = oid==='todas' ? DB.getAll('orcamentos') : DB.getAll('orcamentos').filter(o=>o.obra_id===oid);
    const el = document.getElementById('orc-list');
    if (el) el.innerHTML = orcs.length ? orcs.map(o=>this._card(o)).join('') : `<div class="empty-state"><h3>Nenhum or&ccedil;amento</h3><button class="btn btn-primary" onclick="Orcamentos.showForm()">+ Novo Or&ccedil;amento</button></div>`;
  },

  init() {}
};
