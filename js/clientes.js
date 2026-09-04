// js/clientes.js — Clients / Projects Module

const Clientes = {
  render(obraId) {
    const cs = DB.getAll('clientes');
    return `
    <div class="page-header">
      <div><h1 class="page-title">👥 Clientes / Obras</h1><p class="page-sub">${cs.length} obra(s) cadastrada(s)</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="Clientes.showForm()">+ Nova Obra</button></div>
    </div>
    <div class="filters-bar">
      <div class="filter-group" style="flex:1">
        <label class="filter-label">Buscar</label>
        <div class="search-bar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" class="form-control" id="srch-cli" placeholder="Nome, CPF, contrato..."></div>
      </div>
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="form-control" id="f-status-cli" style="min-width:140px;">
          <option value="">Todos</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="documentacao">Documentação</option>
          <option value="aprovada">Aprovada</option>
          <option value="concluida">Concluída</option>
          <option value="pausada">Pausada</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Cidade</label>
        <select class="form-control" id="f-cidade-cli" style="min-width:120px;">
          <option value="">Todas</option>
          ${[...new Set(cs.map(c=>c.cidade))].map(c=>`<option>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="cli-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px;">
      ${this._cards(cs)}
    </div>`;
  },

  _cards(cs) {
    if (!cs.length) return `<div class="empty-state" style="grid-column:1/-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <h3>Nenhuma obra cadastrada</h3><p>Clique em "Nova Obra" para começar</p>
      <button class="btn btn-primary" onclick="Clientes.showForm()">+ Nova Obra</button></div>`;
    return cs.map(c => {
      const r = DB.getResumo(c.id);
      const orc = DB.getAll('orcamentos').find(o=>o.obra_id===c.id);
      let pct = 0;
      if (orc) { const tv=orc.etapas.reduce((s,e)=>s+e.valor_previsto,0); const tr=orc.etapas.reduce((s,e)=>s+e.valor_realizado,0); pct=tv>0?Math.min(100,(tr/tv)*100):0; }
      const cl = pct<30?'red':pct<70?'yellow':'green';
      const meds = DB.getAll('medicoes').filter(m=>m.obra_id===c.id);
      const libVal = meds.filter(m=>m.status==='liberada').reduce((s,m)=>s+(m.valor_liberado||0),0);
      return `<div class="card" style="position:relative;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
          <div>
            <div style="font-size:.98rem;font-weight:800;margin-bottom:3px">${c.nome}</div>
            <div style="font-size:.76rem;color:var(--text3)">CPF/CNPJ: ${c.cpf_cnpj}</div>
          </div>
          ${Utils.badge(c.status)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;font-size:.8rem;">
          <div><div style="color:var(--text3);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Contrato Caixa</div><div style="color:var(--accent2);font-weight:700">${c.num_contrato_caixa}</div></div>
          <div><div style="color:var(--text3);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Valor Financiado</div><div style="color:var(--success);font-weight:800">${Utils.fmt.currency(c.valor_financiado)}</div></div>
          <div><div style="color:var(--text3);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Localização</div><div>📍 ${c.cidade}/${c.estado}</div></div>
          <div><div style="color:var(--text3);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Área Construída</div><div>📐 ${c.area_construida||'—'} m²</div></div>
          <div><div style="color:var(--text3);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Início / Término</div><div>${Utils.fmt.date(c.data_inicio)} → ${Utils.fmt.date(c.data_previsao_termino)}</div></div>
          <div><div style="color:var(--text3);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Liberado Caixa</div><div style="color:var(--accent);font-weight:700">${Utils.fmt.currency(libVal)}</div></div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span style="font-size:.75rem;color:var(--text3)">Progresso da obra</span><span style="font-size:.75rem;font-weight:800">${pct.toFixed(0)}%</span></div>
          <div class="progress-bar"><div class="progress-fill ${cl}" style="width:${pct}%"></div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-bottom:14px;padding:12px;background:var(--bg-secondary);border-radius:var(--r-md);">
          <div style="text-align:center;"><div style="font-size:.63rem;text-transform:uppercase;color:var(--text3);margin-bottom:3px">Recebido</div><div style="font-size:.8rem;font-weight:800;color:var(--success)">${Utils.fmt.currency(r.totalReceitas)}</div></div>
          <div style="text-align:center;border-left:1px solid var(--border-s);border-right:1px solid var(--border-s);"><div style="font-size:.63rem;text-transform:uppercase;color:var(--text3);margin-bottom:3px">Gasto</div><div style="font-size:.8rem;font-weight:800;color:var(--danger)">${Utils.fmt.currency(r.totalDespesas)}</div></div>
          <div style="text-align:center;"><div style="font-size:.63rem;text-transform:uppercase;color:var(--text3);margin-bottom:3px">Saldo</div><div style="font-size:.8rem;font-weight:800;color:${r.saldo>=0?'var(--accent)':'var(--danger)'}">${Utils.fmt.currency(r.saldo)}</div></div>
        </div>
        <div style="display:flex;gap:7px;">
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="App.obraId='${c.id}';App.refreshObraSelector();App.navigate('lancamentos')">💰 Lançamentos</button>
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="App.obraId='${c.id}';App.refreshObraSelector();App.navigate('medicoes')">🔨 Medições</button>
          <button class="icon-btn btn-sm" onclick="Clientes.showForm('${c.id}')" title="Editar">✏️</button>
          <button class="icon-btn btn-sm" style="color:var(--danger)" onclick="Clientes.del('${c.id}')" title="Excluir">🗑️</button>
        </div>
      </div>`;
    }).join('');
  },

  showForm(id=null) {
    const c = id ? DB.getById('clientes',id)||{} : {};
    Utils.showModal(`
      <div class="modal modal-lg">
        <div class="modal-header"><span class="modal-title">${id?'✏️ Editar Obra':'🏗️ Nova Obra'}</span><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
        <div class="modal-body">
          <form id="f-cli">
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Nome Completo *</label><input class="form-control" name="nome" value="${c.nome||''}" required placeholder="Nome do proprietário"></div>
              <div class="form-group"><label class="form-label">CPF/CNPJ *</label><input class="form-control" name="cpf_cnpj" value="${c.cpf_cnpj||''}" required placeholder="000.000.000-00"></div>
            </div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Telefone</label><input class="form-control" name="telefone" value="${c.telefone||''}" placeholder="(00) 00000-0000"></div>
              <div class="form-group"><label class="form-label">E-mail</label><input class="form-control" type="email" name="email" value="${c.email||''}" placeholder="email@exemplo.com"></div>
            </div>
            <div class="form-group" style="margin-bottom:14px;"><label class="form-label">Endereço da Obra</label><input class="form-control" name="endereco" value="${c.endereco||''}" placeholder="Rua, número, bairro"></div>
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Cidade *</label><input class="form-control" name="cidade" value="${c.cidade||''}" required placeholder="Cidade"></div>
              <div class="form-group"><label class="form-label">Estado</label><select class="form-control" name="estado">${Utils.stateOptions(c.estado||'SP')}</select></div>
              <div class="form-group"><label class="form-label">CEP</label><input class="form-control" name="cep" value="${c.cep||''}" placeholder="00000-000"></div>
            </div>
            <div class="divider"></div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Nº Contrato Caixa *</label><input class="form-control" name="num_contrato_caixa" value="${c.num_contrato_caixa||''}" required placeholder="0000000-0/0000"></div>
              <div class="form-group"><label class="form-label">Agência Caixa</label><input class="form-control" name="agencia_caixa" value="${c.agencia_caixa||''}" placeholder="0000 — Nome Agência"></div>
            </div>
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Valor Financiado *</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="valor_financiado" type="number" value="${c.valor_financiado||''}" step="0.01" min="0" required placeholder="0,00"></div></div>
              <div class="form-group"><label class="form-label">Valor Próprio</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="valor_proprio" type="number" value="${c.valor_proprio||''}" step="0.01" min="0" placeholder="0,00"></div></div>
              <div class="form-group"><label class="form-label">Área Construída</label><div class="input-prefix"><span class="input-pfx-txt">m²</span><input name="area_construida" type="number" value="${c.area_construida||''}" min="0" placeholder="0"></div></div>
            </div>
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Data Início</label><input class="form-control" type="date" name="data_inicio" value="${c.data_inicio||''}"></div>
              <div class="form-group"><label class="form-label">Previsão Término</label><input class="form-control" type="date" name="data_previsao_termino" value="${c.data_previsao_termino||''}"></div>
              <div class="form-group"><label class="form-label">Status</label>
                <select class="form-control" name="status">
                  <option value="em_andamento" ${(c.status||'em_andamento')==='em_andamento'?'selected':''}>Em Andamento</option>
                  <option value="documentacao" ${c.status==='documentacao'?'selected':''}>Documentação</option>
                  <option value="aprovada" ${c.status==='aprovada'?'selected':''}>Aprovada</option>
                  <option value="concluida" ${c.status==='concluida'?'selected':''}>Concluída</option>
                  <option value="pausada" ${c.status==='pausada'?'selected':''}>Pausada</option>
                  <option value="cancelada" ${c.status==='cancelada'?'selected':''}>Cancelada</option>
                </select>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:14px;"><label class="form-label">Engenheiro Responsável</label><input class="form-control" name="engenheiro_responsavel" value="${c.engenheiro_responsavel||''}" placeholder="Nome e CREA"></div>
            <div class="form-group"><label class="form-label">Observações</label><textarea class="form-control" name="observacoes" rows="2">${c.observacoes||''}</textarea></div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="Clientes.save('${id||''}')">${id?'✔ Salvar Alterações':'+ Cadastrar Obra'}</button>
        </div>
      </div>`);
  },

  save(id) {
    const f = document.getElementById('f-cli');
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const d = Object.fromEntries(new FormData(f));
    d.valor_financiado=parseFloat(d.valor_financiado)||0;
    d.valor_proprio=parseFloat(d.valor_proprio)||0;
    d.area_construida=parseFloat(d.area_construida)||0;
    if (id) { DB.update('clientes',id,d); Utils.toast('Obra atualizada!','success'); }
    else { DB.add('clientes',d); Utils.toast('Obra cadastrada!','success'); }
    Utils.closeModal();
    App.refreshObraSelector();
    document.getElementById('cli-grid').innerHTML = this._cards(DB.getAll('clientes'));
  },

  del(id) {
    const c = DB.getById('clientes',id);
    Utils.confirm(`Excluir a obra de "<strong>${c?.nome}</strong>"? Todos os dados serão perdidos.`, () => {
      DB.remove('clientes',id);
      App.refreshObraSelector();
      document.getElementById('cli-grid').innerHTML = this._cards(DB.getAll('clientes'));
      Utils.toast('Obra excluída!','info');
    });
  },

  init() {
    const apply = () => {
      const s = (document.getElementById('srch-cli')?.value||'').toLowerCase();
      const st = document.getElementById('f-status-cli')?.value||'';
      const ci = document.getElementById('f-cidade-cli')?.value||'';
      let cs = DB.getAll('clientes');
      if (s) cs = cs.filter(c=>(c.nome+c.cpf_cnpj+c.num_contrato_caixa).toLowerCase().includes(s));
      if (st) cs = cs.filter(c=>c.status===st);
      if (ci) cs = cs.filter(c=>c.cidade===ci);
      document.getElementById('cli-grid').innerHTML = this._cards(cs);
    };
    ['srch-cli','f-status-cli','f-cidade-cli'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.addEventListener('input',apply);el.addEventListener('change',apply);}
    });
  }
};
