// js/medicoes.js — Caixa & General Works Measurements Module (Cronograma Físico-Financeiro)

const Medicoes = {
  render(obraId) {
    let meds = DB.getAll('medicoes');
    if (obraId && obraId !== 'todas') meds = meds.filter(m => m.obra_id === obraId);
    meds.sort((a,b) => a.obra_id.localeCompare(b.obra_id) || a.numero_medicao - b.numero_medicao);

    const liberadas = meds.filter(m=>m.status==='liberada');
    const emAnalise = meds.filter(m=>['em_analise','submetida'].includes(m.status));
    const totalLib = liberadas.reduce((s,m)=>s+(Number(m.valor_liberado)||0),0);
    const totalSolic = meds.reduce((s,m)=>s+(Number(m.valor_solicitado || m.valor_medido)||0),0);
    const totalRetencoes = meds.reduce((s,m)=>s+(Number(m.retencao_tecnica)||0),0);

    return `
    <div class="page-header">
      <div><h1 class="page-title">🔨 Medições &amp; Faturamento</h1><p class="page-sub">Cronograma físico-financeiro de medições, retenções técnicas e liberação de parcelas</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="Medicoes.showForm()">+ Nova Medição</button></div>
    </div>

    <div class="g4" style="margin-bottom:16px;">
      <div class="kpi-card" style="padding:14px;"><div class="kpi-label">Total Medições</div><div class="kpi-value blue" style="font-size:1.2rem">${meds.length}</div></div>
      <div class="kpi-card" style="padding:14px;"><div class="kpi-label">Valor Liberado / Faturado</div><div class="kpi-value green" style="font-size:1.2rem">${Utils.fmt.currency(totalLib)}</div></div>
      <div class="kpi-card" style="padding:14px;"><div class="kpi-label">Retenções Técnicas</div><div class="kpi-value yellow" style="font-size:1.2rem">${Utils.fmt.currency(totalRetencoes)}</div></div>
      <div class="kpi-card" style="padding:14px;"><div class="kpi-label">Total Solicitado</div><div class="kpi-value cyan" style="font-size:1.2rem">${Utils.fmt.currency(totalSolic)}</div></div>
    </div>

    <div class="filters-bar">
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="form-control" id="f-status-med">
          <option value="">Todos</option>
          <option value="preparando">Preparando</option><option value="submetida">Submetida</option>
          <option value="em_analise">Em Análise</option><option value="aprovada">Aprovada</option>
          <option value="liberada">Liberada</option><option value="rejeitada">Rejeitada</option>
        </select>
      </div>
    </div>

    <div id="med-list">
      ${this._medCards(meds, obraId)}
    </div>`;
  },

  _medCards(meds, obraId) {
    if (!meds.length) return `<div class="empty-state"><h3>Nenhuma medição cadastrada</h3><p>Cadastre as medições do cronograma físico-financeiro das obras</p><button class="btn btn-primary" onclick="Medicoes.showForm()">+ Nova Medição</button></div>`;
    const esc = (v) => (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml(String(v ?? '')) : String(v ?? '');
    // Group by obra
    const byObra = {};
    meds.forEach(m => { if(!byObra[m.obra_id]) byObra[m.obra_id]=[]; byObra[m.obra_id].push(m); });
    return Object.entries(byObra).map(([oId, obMeds]) => {
      const c = DB.getById('clientes', oId);
      const isCaixa = !c?.modalidade_obra || c?.modalidade_obra === 'caixa';
      const totalLib = obMeds.filter(m=>m.status==='liberada').reduce((s,m)=>s+(Number(m.valor_liberado)||0),0);
      const totalSol = obMeds.reduce((s,m)=>s+(Number(m.valor_solicitado || m.valor_medido)||0),0);
      const totalRet = obMeds.reduce((s,m)=>s+(Number(m.retencao_tecnica)||0),0);
      const financiado = Number(c?.valor_financiado) || 0;
      const saldoAFaturar = Math.max(0, financiado - totalLib);
      const pctLib = financiado>0 ? Math.min(100,(totalLib/financiado)*100) : 0;

      const modInfo = isCaixa
        ? `Contrato: ${esc(c?.num_contrato_caixa||'—')} &nbsp;|&nbsp; Financiado Caixa: ${Utils.fmt.currency(financiado)} &nbsp;|&nbsp; Agência: ${esc(c?.agencia_caixa||'—')}`
        : `Modalidade: ${c?.modalidade_obra==='particular'?'Recursos Próprios':c?.modalidade_obra==='administracao'?'Administração Custo+Taxa':c?.modalidade_obra==='empreitada'?'Empreitada Global':c?.modalidade_obra==='reforma'?'Reforma Comercial':'Financiamento'} &nbsp;|&nbsp; Ref: ${esc(c?.num_contrato_caixa||'Direto')} &nbsp;|&nbsp; Contratado: ${Utils.fmt.currency(financiado)}`;

      return `<div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div>
            <div class="card-title">👤 ${esc(c?.nome||'—')}</div>
            <div style="font-size:.76rem;color:var(--text3);margin-top:3px">${modInfo}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:.72rem;color:var(--text3)">${isCaixa ? 'Liberado / Solicitado' : 'Faturado / Previsto'}</div>
            <div style="font-weight:900;font-size:1rem;color:var(--success)">${Utils.fmt.currency(totalLib)} <span style="color:var(--text3);font-weight:400">/ ${Utils.fmt.currency(totalSol)}</span></div>
            ${saldoAFaturar > 0 ? `<div style="font-size:.7rem;color:var(--accent);margin-top:2px;">Saldo a faturar: <strong>${Utils.fmt.currency(saldoAFaturar)}</strong></div>` : ''}
          </div>
        </div>

        <div style="margin-bottom:18px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
            <span style="font-size:.76rem;color:var(--text3)">${isCaixa ? 'Progresso de liberações vs. valor financiado' : 'Progresso de faturamento vs. valor contratado'}</span>
            <span style="font-size:.76rem;font-weight:800">${pctLib.toFixed(1)}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill green" style="width:${pctLib}%"></div></div>
        </div>

        <div style="display:flex;gap:0;margin-bottom:20px;overflow-x:auto">
          ${obMeds.map((m)=>{
            const stepClass = m.status==='liberada'?'done':['em_analise','submetida','aprovada'].includes(m.status)?'current':'';
            const icons = {preparando:'📋',submetida:'📤',em_analise:'🔍',aprovada:'✅',liberada:'💰',rejeitada:'❌'};
            return `<div class="med-step ${stepClass}" style="min-width:80px">
              <div class="med-dot">${icons[m.status]||'●'}</div>
              <div class="med-label">${m.numero_medicao}ª Med.</div>
              <div style="font-size:.6rem;color:inherit;margin-top:2px">${m.percentual_fisico || 0}% físico</div>
            </div>`;
          }).join('')}
        </div>

        ${obMeds.map(m=>this._medRow(m)).join('')}
      </div>`;
    }).join('');
  },

  _medRow(m) {
    const esc = (v) => (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml(String(v ?? '')) : String(v ?? '');
    const statusColor = { preparando:'var(--text3)', submetida:'var(--info)', em_analise:'var(--warning)', aprovada:'var(--success)', liberada:'var(--success)', rejeitada:'var(--danger)' };
    const docsClip = typeof Documentos !== 'undefined' 
      ? Documentos.badgeClip('medicao', m.id, { titulo: `${m.numero_medicao}ª Medição`, showLabel: true })
      : (m.documentos_ok ? '<span class="badge badge-success">📎 Docs OK</span>' : '<span class="badge badge-warning">📎 Docs Pendentes</span>');

    const retencao = Number(m.retencao_tecnica) || 0;
    const descontos = Number(m.descontos) || 0;

    return `<div class="card" style="margin-bottom:10px;padding:16px;border-left:4px solid ${statusColor[m.status]||'var(--border-d)'};">
      <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
            <div style="font-size:1.1rem;font-weight:900;color:var(--accent)">${m.numero_medicao}ª Medição</div>
            ${Utils.badge(m.status)}
            ${docsClip}
          </div>
          <div style="font-size:.82rem;color:var(--text2);margin-bottom:10px">${esc(m.etapa_descricao||'—')}</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:.78rem">
            <div><span style="color:var(--text3)">Físico executado:</span> <strong>${m.percentual_fisico || 0}%</strong></div>
            <div><span style="color:var(--text3)">Financeiro:</span> <strong>${m.percentual_financeiro || 0}%</strong></div>
            <div><span style="color:var(--text3)">Engenheiro / Técnico:</span> ${esc(m.engenheiro_responsavel||'—')}</div>
            <div><span style="color:var(--text3)">Previsão:</span> ${Utils.fmt.date(m.data_previsao)}</div>
          </div>
          ${m.observacoes?`<div style="margin-top:8px;font-size:.75rem;color:var(--text3);padding:7px;background:var(--bg-secondary);border-radius:6px">💬 ${esc(m.observacoes)}</div>`:''}
        </div>

        <div style="min-width:220px">
          <div style="display:grid;gap:6px;font-size:.8rem">
            <div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--bg-secondary);border-radius:6px">
              <span style="color:var(--text3)">📤 Solicitado / Previsto:</span>
              <strong style="color:var(--accent)">${Utils.fmt.currency(m.valor_solicitado || m.valor_medido)}</strong>
            </div>
            ${retencao > 0 ? `
              <div style="display:flex;justify-content:space-between;padding:4px 10px;background:rgba(245,158,11,.08);border-radius:6px;font-size:.74rem;">
                <span style="color:var(--warning)">🔒 Retenção Técnica:</span>
                <strong style="color:var(--warning)">- ${Utils.fmt.currency(retencao)}</strong>
              </div>
            ` : ''}
            ${descontos > 0 ? `
              <div style="display:flex;justify-content:space-between;padding:4px 10px;background:rgba(239,68,68,.08);border-radius:6px;font-size:.74rem;">
                <span style="color:var(--danger)">🔻 Descontos / Glosas:</span>
                <strong style="color:var(--danger)">- ${Utils.fmt.currency(descontos)}</strong>
              </div>
            ` : ''}
            <div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--bg-secondary);border-radius:6px">
              <span style="color:var(--text3)">✅ Aprovado:</span>
              <strong style="color:${m.valor_aprovado?'var(--success)':'var(--text3)'}">${m.valor_aprovado?Utils.fmt.currency(m.valor_aprovado):'Aguardando'}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--bg-secondary);border-radius:6px">
              <span style="color:var(--text3)">💰 Liberado / Faturado:</span>
              <strong style="color:${m.valor_liberado?'var(--success)':'var(--text3)'}">${m.valor_liberado?Utils.fmt.currency(m.valor_liberado):'Aguardando'}</strong>
            </div>
          </div>
        </div>

        <div style="min-width:180px;font-size:.76rem">
          <div style="font-weight:700;color:var(--text2);margin-bottom:8px">📅 Datas</div>
          <div style="display:grid;gap:5px">
            <div><span style="color:var(--text3)">Medição:</span> ${Utils.fmt.date(m.data_medicao)||'Não realizada'}</div>
            <div><span style="color:var(--text3)">Submissão:</span> ${Utils.fmt.date(m.data_submissao)||'Não submetida'}</div>
            <div><span style="color:var(--text3)">Aprovação:</span> ${Utils.fmt.date(m.data_aprovacao)||'Pendente'}</div>
            <div><span style="color:var(--text3)">Liberação:</span> <strong style="color:${m.data_liberacao?'var(--success)':'var(--text3)'}">${Utils.fmt.date(m.data_liberacao)||'Pendente'}</strong></div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="Medicoes.showForm('${m.id}')">✏️ Editar</button>
          <button class="btn btn-secondary btn-sm" onclick="Documentos.abrirModal('medicao', '${m.id}', 'Documentos da ${m.numero_medicao}ª Medição')">📎 Anexos (${typeof Documentos !== 'undefined' ? Documentos.listar('medicao', m.id).length : 0})</button>
          ${m.status==='preparando'?`<button class="btn btn-warning btn-sm" onclick="Medicoes.avancarStatus('${m.id}','submetida')">📤 Submeter</button>`:''}
          ${m.status==='submetida'?`<button class="btn btn-secondary btn-sm" onclick="Medicoes.avancarStatus('${m.id}','em_analise')">🔍 Em Análise</button>`:''}
          ${m.status==='em_analise'?`<button class="btn btn-success btn-sm" onclick="Medicoes.avancarStatus('${m.id}','aprovada')">✅ Aprovar</button>`:''}
          ${m.status==='aprovada'?`<button class="btn btn-success btn-sm" onclick="Medicoes.liberarValor('${m.id}')">💰 Liberar</button>`:''}
          <button class="icon-btn btn-sm" onclick="Medicoes.del('${m.id}')" style="color:var(--danger)">🗑️</button>
        </div>
      </div>
    </div>`;
  },

  avancarStatus(id, novoStatus) {
    DB.update('medicoes',id,{status:novoStatus,[novoStatus==='submetida'?'data_submissao':novoStatus==='em_analise'?'data_submissao':'data_aprovacao']:Utils.today()});
    this._refresh();
    Utils.toast(`Status atualizado para: ${novoStatus}`,'success');
  },

  liberarValor(id) {
    const m = DB.getById('medicoes',id);
    const sugerido = m.valor_aprovado || m.valor_solicitado || m.valor_medido || 0;
    Utils.showModal(`
      <div class="modal" style="max-width:420px">
        <div class="modal-header"><span class="modal-title">💰 Liberar Parcela / Faturamento</span><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Valor Bruto Aprovado (R$)</label>
            <div class="input-prefix"><span class="input-pfx-txt">R$</span><input id="lib-val" type="number" value="${sugerido}" step="0.01" min="0"></div>
          </div>
          <div class="form-row cols-2" style="margin-bottom:12px;">
            <div class="form-group"><label class="form-label">Retenção Técnica</label>
              <div class="input-prefix"><span class="input-pfx-txt">R$</span><input id="lib-retencao" type="number" value="${m.retencao_tecnica||0}" step="0.01" min="0"></div>
            </div>
            <div class="form-group"><label class="form-label">Descontos / Glosas</label>
              <div class="input-prefix"><span class="input-pfx-txt">R$</span><input id="lib-descontos" type="number" value="${m.descontos||0}" step="0.01" min="0"></div>
            </div>
          </div>
          <div class="form-group"><label class="form-label">Data de Liberação</label><input class="form-control" type="date" id="lib-dt" value="${Utils.today()}"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-success" onclick="Medicoes._confirmLiberar('${id}')">💰 Confirmar Liberação</button>
        </div>
      </div>`);
  },

  _confirmLiberar(id) {
    const m = DB.getById('medicoes',id);
    if (!m) return;
    const val = parseFloat(document.getElementById('lib-val')?.value)||0;
    const ret = parseFloat(document.getElementById('lib-retencao')?.value)||0;
    const descValor = parseFloat(document.getElementById('lib-descontos')?.value)||0;
    const dt = document.getElementById('lib-dt')?.value || Utils.today();
    const liquido = Math.max(0, val - ret - descValor);

    DB.update('medicoes', id, {
      status: 'liberada',
      valor_liberado: val,
      retencao_tecnica: ret,
      descontos: descValor,
      data_liberacao: dt
    });

    // Proteção contra duplicação de receita no financeiro
    const lancamentos = DB.getAll('lancamentos') || [];
    const jaExiste = m.lancamento_id
      ? lancamentos.some(l => l.id === m.lancamento_id)
      : lancamentos.some(l => l.medicao_id === id);

    if (jaExiste) {
      if (m.lancamento_id) {
        DB.update('lancamentos', m.lancamento_id, { valor: liquido, data: dt });
      }
      Utils.closeModal();
      this._refresh();
      Utils.toast('Medição liberada e lançamento financeiro sincronizado!', 'success');
      return;
    }

    const c = DB.getById('clientes', m.obra_id);
    const isCaixa = !c?.modalidade_obra || c?.modalidade_obra === 'caixa';
    const categoria = isCaixa ? 'parcela_caixa' : (c?.modalidade_obra === 'administracao' ? 'taxa_adm' : 'medicao_obra');
    const beneficiario = isCaixa ? 'Caixa Econômica Federal' : (c?.nome || 'Cliente da Obra');
    const desc = isCaixa
      ? `${m.numero_medicao}ª Parcela Caixa — Medição ${m.numero_medicao} (${m.percentual_fisico || 0}%)`
      : `${m.numero_medicao}ª Medição / Faturamento — ${c?.nome || 'Obra'} (${m.percentual_fisico || 0}%)`;

    const lan = DB.add('lancamentos', {
      obra_id: m.obra_id,
      tipo: 'receita',
      data: dt,
      descricao: desc,
      categoria: categoria,
      valor: liquido,
      status: 'recebido',
      fornecedor_beneficiario: beneficiario,
      origem: 'medicao',
      conciliado: false,
      medicao_id: id
    });

    DB.update('medicoes', id, { lancamento_id: lan?.id || null });
    Utils.closeModal();
    this._refresh();
    Utils.toast('Medição liberada e receita registrada no financeiro!', 'success');
  },

  edit(id) {
    this.showForm(id);
  },

  showForm(id=null) {
    const m = id?DB.getById('medicoes',id)||{}:{};
    Utils.showModal(`
      <div class="modal modal-lg">
        <div class="modal-header"><span class="modal-title">${id?'✏️ Editar Medição':'🔨 Nova Medição'}</span><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
        <div class="modal-body">
          <form id="f-med">
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Obra *</label><select class="form-control" name="obra_id" required>${Utils.clienteOptions(m.obra_id||App.obraId!=='todas'?App.obraId:'')}</select></div>
              <div class="form-group"><label class="form-label">Nº da Medição *</label><input class="form-control" type="number" name="numero_medicao" value="${m.numero_medicao||1}" min="1" required></div>
              <div class="form-group"><label class="form-label">Status</label><select class="form-control" name="status">
                <option value="preparando" ${(m.status||'preparando')==='preparando'?'selected':''}>📋 Preparando</option>
                <option value="submetida" ${m.status==='submetida'?'selected':''}>📤 Submetida</option>
                <option value="em_analise" ${m.status==='em_analise'?'selected':''}>🔍 Em Análise</option>
                <option value="aprovada" ${m.status==='aprovada'?'selected':''}>✅ Aprovada</option>
                <option value="liberada" ${m.status==='liberada'?'selected':''}>💰 Liberada</option>
                <option value="rejeitada" ${m.status==='rejeitada'?'selected':''}>❌ Rejeitada</option>
              </select></div>
            </div>
            <div class="form-group" style="margin-bottom:14px;"><label class="form-label">Descrição da Etapa Executada *</label><textarea class="form-control" name="etapa_descricao" rows="2" required placeholder="Descreva as etapas executadas nesta medição...">${m.etapa_descricao||''}</textarea></div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">% Físico Executado</label><div class="input-prefix"><span class="input-pfx-txt">%</span><input name="percentual_fisico" type="number" value="${m.percentual_fisico||0}" min="0" max="100"></div></div>
              <div class="form-group"><label class="form-label">% Financeiro</label><div class="input-prefix"><span class="input-pfx-txt">%</span><input name="percentual_financeiro" type="number" value="${m.percentual_financeiro||0}" min="0" max="100"></div></div>
            </div>
            <div class="form-row cols-3" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Valor Solicitado *</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="valor_solicitado" type="number" value="${m.valor_solicitado||m.valor_medido||''}" step="0.01" min="0" required></div></div>
              <div class="form-group"><label class="form-label">Valor Aprovado</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="valor_aprovado" type="number" value="${m.valor_aprovado||''}" step="0.01" min="0"></div></div>
              <div class="form-group"><label class="form-label">Valor Liberado</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="valor_liberado" type="number" value="${m.valor_liberado||''}" step="0.01" min="0"></div></div>
            </div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Retenção Técnica (R$)</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="retencao_tecnica" type="number" value="${m.retencao_tecnica||''}" step="0.01" min="0" placeholder="0.00"></div></div>
              <div class="form-group"><label class="form-label">Descontos / Glosas (R$)</label><div class="input-prefix"><span class="input-pfx-txt">R$</span><input name="descontos" type="number" value="${m.descontos||''}" step="0.01" min="0" placeholder="0.00"></div></div>
            </div>
            <div class="form-row cols-4" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Data Previsão</label><input class="form-control" type="date" name="data_previsao" value="${m.data_previsao||''}"></div>
              <div class="form-group"><label class="form-label">Data Medição</label><input class="form-control" type="date" name="data_medicao" value="${m.data_medicao||''}"></div>
              <div class="form-group"><label class="form-label">Data Aprovação</label><input class="form-control" type="date" name="data_aprovacao" value="${m.data_aprovacao||''}"></div>
              <div class="form-group"><label class="form-label">Data Liberação</label><input class="form-control" type="date" name="data_liberacao" value="${m.data_liberacao||''}"></div>
            </div>
            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group"><label class="form-label">Engenheiro / Responsável Técnico</label><input class="form-control" name="engenheiro_responsavel" value="${m.engenheiro_responsavel||''}" placeholder="Nome e CREA/CAU"></div>
              <div class="form-group"><label class="form-label">Documentação</label><select class="form-control" name="documentos_ok">
                <option value="true" ${m.documentos_ok?'selected':''}>✅ Completa</option>
                <option value="false" ${!m.documentos_ok?'selected':''}>⏳ Pendente</option>
              </select></div>
            </div>
            <div class="form-group"><label class="form-label">Observações</label><textarea class="form-control" name="observacoes" rows="2">${m.observacoes||''}</textarea></div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="Medicoes.save('${id||''}')">${id?'✔ Salvar':'+ Cadastrar Medição'}</button>
        </div>
      </div>`);
  },

  save(id) {
    const f=document.getElementById('f-med');
    if(!f.checkValidity()){f.reportValidity();return;}
    const d=Object.fromEntries(new FormData(f));
    d.numero_medicao=parseInt(d.numero_medicao)||1;
    d.percentual_fisico=parseFloat(d.percentual_fisico)||0;
    d.percentual_financeiro=parseFloat(d.percentual_financeiro)||0;
    d.valor_solicitado=parseFloat(d.valor_solicitado)||0;
    d.valor_medido=d.valor_solicitado;
    d.valor_aprovado=parseFloat(d.valor_aprovado)||null;
    d.valor_liberado=parseFloat(d.valor_liberado)||null;
    d.retencao_tecnica=parseFloat(d.retencao_tecnica)||0;
    d.descontos=parseFloat(d.descontos)||0;
    d.documentos_ok=d.documentos_ok==='true';
    if(!d.data_previsao) d.data_previsao=null;
    if(!d.data_medicao) d.data_medicao=null;
    if(!d.data_submissao) d.data_submissao=null;
    if(!d.data_aprovacao) d.data_aprovacao=null;
    if(!d.data_liberacao) d.data_liberacao=null;
    if(id){DB.update('medicoes',id,d);Utils.toast('Medição atualizada!','success');}
    else{DB.add('medicoes',d);Utils.toast('Medição cadastrada!','success');}
    Utils.closeModal();
    this._refresh();
  },

  del(id) {
    Utils.confirm('Excluir esta medição?',()=>{DB.remove('medicoes',id);this._refresh();Utils.toast('Medição excluída!','info');});
  },

  _refresh() {
    const list = document.getElementById('med-list');
    if (!list) return;
    const oid=App.obraId;
    const st=document.getElementById('f-status-med')?.value||'';
    let meds=DB.getAll('medicoes');
    if(oid&&oid!=='todas') meds=meds.filter(m=>m.obra_id===oid);
    if(st) meds=meds.filter(m=>m.status===st);
    meds.sort((a,b)=>a.obra_id.localeCompare(b.obra_id)||a.numero_medicao-b.numero_medicao);
    list.innerHTML=this._medCards(meds,oid);
  },

  init() {
    const el=document.getElementById('f-status-med');
    if(el) el.addEventListener('change',()=>this._refresh());
  }
};
