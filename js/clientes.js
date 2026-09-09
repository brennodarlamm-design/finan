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
        <input type="text" class="form-control" id="srch-cli" placeholder="Nome, CPF, contrato, modalidade..."></div>
      </div>
      <div class="filter-group">
        <label class="filter-label">Modalidade</label>
        <select class="form-control" id="f-mod-cli" style="min-width:150px;">
          <option value="">Todas as Modalidades</option>
          <option value="caixa">🏦 Caixa Econômica</option>
          <option value="particular">💼 Recursos Próprios</option>
          <option value="administracao">📑 Administração</option>
          <option value="empreitada">🏗️ Empreitada Global</option>
          <option value="reforma">🔨 Reforma / Comercial</option>
          <option value="outros_bancos">🏛️ Outros Bancos</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="form-control" id="f-status-cli" style="min-width:140px;">
          <option value="">Todos os Status</option>
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
          ${[...new Set(cs.map(c=>c.cidade).filter(Boolean))].map(c=>`<option>${c}</option>`).join('')}
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
      const isCaixa = !c.modalidade_obra || c.modalidade_obra === 'caixa';
      const modBadges = {
        caixa: '<span class="badge" style="background:rgba(59,130,246,.15);color:#60a5fa;border:1px solid rgba(59,130,246,.3);font-size:.68rem;">🏦 Caixa Econômica</span>',
        particular: '<span class="badge" style="background:rgba(34,197,94,.15);color:#4ade80;border:1px solid rgba(34,197,94,.3);font-size:.68rem;">💼 Recursos Próprios</span>',
        administracao: '<span class="badge" style="background:rgba(168,85,247,.15);color:#c084fc;border:1px solid rgba(168,85,247,.3);font-size:.68rem;">📑 Administração</span>',
        empreitada: '<span class="badge" style="background:rgba(249,115,22,.15);color:#fb923c;border:1px solid rgba(249,115,22,.3);font-size:.68rem;">🏗️ Empreitada Global</span>',
        reforma: '<span class="badge" style="background:rgba(20,184,166,.15);color:#2dd4bf;border:1px solid rgba(20,184,166,.3);font-size:.68rem;">🔨 Reforma / Comercial</span>',
        outros_bancos: '<span class="badge" style="background:rgba(99,102,241,.15);color:#818cf8;border:1px solid rgba(99,102,241,.3);font-size:.68rem;">🏛️ Financiamento Bancário</span>'
      };
      const badgeMod = modBadges[c.modalidade_obra || 'caixa'] || modBadges.caixa;

      return `<div class="card" style="position:relative;transition:transform .15s, border-color .15s;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;cursor:pointer;"
             onclick="typeof ObraDetalhe!=='undefined'?ObraDetalhe.abrir('${c.id}'):null" title="Abrir Central da Obra">
          <div>
            <div style="font-size:1.02rem;font-weight:900;margin-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="color:var(--text);">${c.nome}</span>
              ${badgeMod}
            </div>
            <div style="font-size:.76rem;color:var(--text3)">CPF/CNPJ: ${c.cpf_cnpj || '—'}</div>
          </div>
          ${Utils.badge(c.status)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;font-size:.8rem;">
          <div>
            <div style="color:var(--text3);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">
              ${isCaixa ? 'Contrato Caixa' : 'Ref. Contrato'}
            </div>
            <div style="color:var(--accent2);font-weight:700">
              ${c.num_contrato_caixa || (isCaixa ? '—' : 'Contrato Direto')}
            </div>
          </div>
          <div>
            <div style="color:var(--text3);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">
              ${isCaixa ? 'Valor Financiado' : 'Valor Contratado'}
            </div>
            <div style="color:var(--success);font-weight:800">
              ${Utils.fmt.currency(c.valor_financiado)}
            </div>
          </div>
          <div><div style="color:var(--text3);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Localização</div><div>📍 ${c.cidade}/${c.estado}</div></div>
          <div><div style="color:var(--text3);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Área Construída</div><div>📐 ${c.area_construida||'—'} m²</div></div>
          <div><div style="color:var(--text3);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Início / Término</div><div>${Utils.fmt.date(c.data_inicio)} → ${Utils.fmt.date(c.data_previsao_termino)}</div></div>
          <div>
            <div style="color:var(--text3);font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">
              ${isCaixa ? 'Liberado Caixa' : 'Total Faturado'}
            </div>
            <div style="color:var(--accent);font-weight:700">${Utils.fmt.currency(libVal)}</div>
          </div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span style="font-size:.75rem;color:var(--text3)">Progresso da obra</span><span style="font-size:.75rem;font-weight:800">${pct.toFixed(0)}%</span></div>
          <div class="progress-bar"><div class="progress-fill ${cl}" style="width:${pct}%"></div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-bottom:10px;padding:12px;background:var(--bg-secondary);border-radius:var(--r-md);">
          <div style="text-align:center;"><div style="font-size:.63rem;text-transform:uppercase;color:var(--text3);margin-bottom:3px">Recebido</div><div style="font-size:.8rem;font-weight:800;color:var(--success)">${Utils.fmt.currency(r.totalReceitas)}</div></div>
          <div style="text-align:center;border-left:1px solid var(--border-s);border-right:1px solid var(--border-s);"><div style="font-size:.63rem;text-transform:uppercase;color:var(--text3);margin-bottom:3px">Gasto</div><div style="font-size:.8rem;font-weight:800;color:var(--danger)">${Utils.fmt.currency(r.totalDespesas)}</div></div>
          <div style="text-align:center;"><div style="font-size:.63rem;text-transform:uppercase;color:var(--text3);margin-bottom:3px">Saldo</div><div style="font-size:.8rem;font-weight:800;color:${r.saldo>=0?'var(--accent)':'var(--danger)'}">${Utils.fmt.currency(r.saldo)}</div></div>
        </div>
        ${typeof FasesDoc !== 'undefined' ? FasesDoc.miniWidget(c.id) : ''}
        <div style="display:flex;gap:7px;margin-top:12px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" style="flex:2;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:6px;"
                  onclick="typeof ObraDetalhe!=='undefined'?ObraDetalhe.abrir('${c.id}'):null" title="Abrir Central da Obra">
            🏢 Central da Obra
          </button>
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="typeof ObraDetalhe!=='undefined'?ObraDetalhe.abrir('${c.id}','lancamentos'):null" title="Ver lançamentos financeiros">💰 Extrato</button>
          <button class="btn btn-secondary btn-sm" onclick="typeof ObraDetalhe!=='undefined'?ObraDetalhe.abrir('${c.id}','documentos'):null" title="Percurso Documental (43 docs)" style="padding:4px 10px">📋</button>
          <button class="icon-btn btn-sm" onclick="Clientes.showForm('${c.id}')" title="Editar">✏️</button>
          <button class="icon-btn btn-sm" style="color:var(--danger)" onclick="Clientes.del('${c.id}')" title="Excluir">🗑️</button>
        </div>
      </div>`;
    }).join('');
  },

  onModalidadeChange(modalidade) {
    const isCaixa = modalidade === 'caixa';
    const lblContrato = document.getElementById('lbl-contrato');
    const inpContrato = document.getElementById('inp-contrato');
    const lblAgencia = document.getElementById('lbl-agencia');
    const lblValFin = document.getElementById('lbl-val-fin');
    const lblValProp = document.getElementById('lbl-val-prop');

    if (lblContrato && inpContrato) {
      if (isCaixa) {
        lblContrato.textContent = 'Nº Contrato Caixa *';
        inpContrato.setAttribute('required', 'required');
        inpContrato.placeholder = '0000000-0/0000';
      } else {
        lblContrato.textContent = 'Nº do Contrato / Referência';
        inpContrato.removeAttribute('required');
        inpContrato.placeholder = 'Ex: CTR-2026/01 ou Direto';
      }
    }
    if (lblAgencia) {
      lblAgencia.textContent = isCaixa ? 'Agência Caixa' : 'Banco / Agência ou Local';
    }
    if (lblValFin) {
      lblValFin.textContent = isCaixa ? 'Valor Financiado *' : 'Valor Contratado / Total *';
    }
    if (lblValProp) {
      lblValProp.textContent = isCaixa ? 'Valor Próprio (Entrada)' : 'Aporte Inicial / Entrada';
    }
  },

  showForm(id=null) {
    const c = id ? DB.getById('clientes',id)||{} : {};
    const isCaixa = !c.modalidade_obra || c.modalidade_obra === 'caixa';

    Utils.showModal(`
      <div class="modal modal-lg">
        <div class="modal-header"><span class="modal-title">${id?'✏️ Editar Obra':'🏗️ Nova Obra'}</span><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
        <div class="modal-body">
          <form id="f-cli">
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:700;color:var(--accent);">Modalidade da Obra *</label>
              <select class="form-control" name="modalidade_obra" id="cli-modalidade" onchange="Clientes.onModalidadeChange(this.value)">
                <option value="caixa" ${isCaixa?'selected':''}>🏦 Financiamento Caixa Econômica (PCI / SBPE / MCMV)</option>
                <option value="particular" ${c.modalidade_obra==='particular'?'selected':''}>💼 Obra Particular / Recursos Próprios</option>
                <option value="administracao" ${c.modalidade_obra==='administracao'?'selected':''}>📑 Administração de Obra (Custo + Taxa)</option>
                <option value="empreitada" ${c.modalidade_obra==='empreitada'?'selected':''}>🏗️ Empreitada Global / Preço Fechado</option>
                <option value="reforma" ${c.modalidade_obra==='reforma'?'selected':''}>🔨 Reforma Comercial / Residencial</option>
                <option value="outros_bancos" ${c.modalidade_obra==='outros_bancos'?'selected':''}>🏛️ Financiamento Outros Bancos</option>
              </select>
            </div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Nome Completo / Proprietário *</label><input class="form-control" name="nome" value="${c.nome||''}" required placeholder="Nome do proprietário ou cliente"></div>
              <div class="form-group"><label class="form-label">CPF/CNPJ *</label><input class="form-control" name="cpf_cnpj" value="${c.cpf_cnpj||''}" required placeholder="000.000.000-00"></div>
            </div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Telefone</label><input class="form-control" name="telefone" value="${c.telefone||''}" placeholder="(00) 00000-0000"></div>
              <div class="form-group"><label class="form-label">E-mail</label><input class="form-control" type="email" name="email" value="${c.email||''}" placeholder="email@exemplo.com"></div>
            </div>
            <div class="form-group" style="margin-bottom:14px;"><label class="form-label">Endereço da Obra</label><input class="form-control" name="endereco" value="${c.endereco||''}" placeholder="Rua, número, bairro"></div>
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Cidade *</label><input class="form-control" name="cidade" value="${c.cidade||''}" required placeholder="Cidade"></div>
              <div class="form-group"><label class="form-label">Estado</label><select class="form-control" name="estado">${Utils.stateOptions(c.estado||'RR')}</select></div>
              <div class="form-group"><label class="form-label">CEP</label><input class="form-control" name="cep" value="${c.cep||''}" placeholder="00000-000"></div>
            </div>
            <div class="divider"></div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label" id="lbl-contrato">${isCaixa ? 'Nº Contrato Caixa *' : 'Nº do Contrato / Referência'}</label>
                <input class="form-control" name="num_contrato_caixa" id="inp-contrato" value="${c.num_contrato_caixa||''}" ${isCaixa ? 'required' : ''} placeholder="${isCaixa ? '0000000-0/0000' : 'Ex: CTR-2026/01 ou Direto'}">
              </div>
              <div class="form-group">
                <label class="form-label" id="lbl-agencia">${isCaixa ? 'Agência Caixa' : 'Banco / Agência ou Local'}</label>
                <input class="form-control" name="agencia_caixa" value="${c.agencia_caixa||''}" placeholder="${isCaixa ? '0000 — Nome Agência' : 'Ex: 0000 — Itaú / Direto'}">
              </div>
            </div>
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label" id="lbl-val-fin">${isCaixa ? 'Valor Financiado *' : 'Valor Contratado / Total *'}</label>
                <div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="valor_financiado" type="number" value="${c.valor_financiado||''}" step="0.01" min="0" required placeholder="0,00"></div>
              </div>
              <div class="form-group">
                <label class="form-label" id="lbl-val-prop">${isCaixa ? 'Valor Próprio (Entrada)' : 'Aporte Inicial / Entrada'}</label>
                <div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="valor_proprio" type="number" value="${c.valor_proprio||''}" step="0.01" min="0" placeholder="0,00"></div>
              </div>
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
            <div class="form-group" style="margin-bottom:14px;"><label class="form-label">Engenheiro / Responsável Técnico</label><input class="form-control" name="engenheiro_responsavel" value="${c.engenheiro_responsavel||''}" placeholder="Nome e CREA/CAU"></div>
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
    d.modalidade_obra = d.modalidade_obra || 'caixa';
    d.valor_financiado = parseFloat(d.valor_financiado)||0;
    d.valor_proprio = parseFloat(d.valor_proprio)||0;
    d.area_construida = parseFloat(d.area_construida)||0;
    if (id) { DB.update('clientes',id,d); Utils.toast('Obra atualizada!','success'); }
    else { DB.add('clientes',d); Utils.toast('Obra cadastrada com sucesso!','success'); }
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
      const mod = document.getElementById('f-mod-cli')?.value||'';
      const st = document.getElementById('f-status-cli')?.value||'';
      const ci = document.getElementById('f-cidade-cli')?.value||'';
      let cs = DB.getAll('clientes');
      if (s) cs = cs.filter(c=>((c.nome||'') + (c.cpf_cnpj||'') + (c.num_contrato_caixa||'') + (c.modalidade_obra||'')).toLowerCase().includes(s));
      if (mod) cs = cs.filter(c=>(c.modalidade_obra||'caixa')===mod);
      if (st) cs = cs.filter(c=>c.status===st);
      if (ci) cs = cs.filter(c=>c.cidade===ci);
      document.getElementById('cli-grid').innerHTML = this._cards(cs);
    };
    ['srch-cli','f-mod-cli','f-status-cli','f-cidade-cli'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.addEventListener('input',apply);el.addEventListener('change',apply);}
    });
  }
};

