// js/dashboard.js — Dashboard with KPIs & Charts

const Dashboard = {
  render(obraId) {
    const isEscritorio = obraId === 'escritorio';
    const r = DB.getResumo(obraId === 'todas' ? null : obraId);
    const resumoPre = DB.getPreComprasResumo(obraId);
    const cs = DB.getAll('clientes');
    const ativos = cs.filter(c => c.status === 'em_andamento').length;
    const medPend = DB.getAll('medicoes').filter(m => (!obraId||obraId==='todas'||m.obra_id===obraId) && ['em_analise','submetida'].includes(m.status)).length;
    const lbl = obraId === 'todas'
      ? 'Visão geral consolidada de todas as obras'
      : (isEscritorio
        ? '🏢 Sede / Escritório Central (Custos Administrativos e Fixos)'
        : `Obra: ${DB.getById('clientes',obraId)?.nome||''}`);

    return `
    <div class="page-header">
      <div><h1 class="page-title">📊 Dashboard</h1><p class="page-sub">${lbl}</p></div>
      <div class="page-actions" style="display:flex;gap:8px;">
        <button class="btn btn-primary btn-sm" onclick="Dashboard.abrirModalImpressao()" style="display:flex;align-items:center;gap:6px;">
          🖨️ Imprimir / Exportar
        </button>
      </div>
    </div>

    ${resumoPre.pendentesQtd > 0 ? `
    <div class="card" style="background:linear-gradient(135deg,rgba(245,158,11,.14),rgba(201,162,39,.1));border:1px solid rgba(245,158,11,.4);margin-bottom:16px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:1.6rem;">🛒</span>
        <div>
          <strong style="color:var(--accent2);font-size:.92rem;">Autorização de Compras:</strong>
          <span style="color:var(--text);font-size:.85rem;margin-left:4px;">Existem <strong>${resumoPre.pendentesQtd} ordens de pré-compra</strong> aguardando autorização do Administrador (${Utils.fmt.currency(resumoPre.pendentesValor)}).</span>
        </div>
      </div>
      <button class="btn btn-warning btn-sm" onclick="App.navigate('precompras');" style="font-weight:700;">
        ⚡ Analisar Pedidos (${resumoPre.pendentesQtd}) →
      </button>
    </div>` : ''}

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon green"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="kpi-label">Total Recebido</div>
        <div class="kpi-value green">${Utils.fmt.currency(r.totalReceitas)}</div>
        <div class="kpi-change">💰 Receitas confirmadas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon red"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="kpi-label">Total Gasto</div>
        <div class="kpi-value red">${Utils.fmt.currency(r.totalDespesas)}</div>
        <div class="kpi-change">💸 Despesas pagas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon ${r.saldo>=0?'blue':'red'}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
        <div class="kpi-label">Saldo Disponível</div>
        <div class="kpi-value ${r.saldo>=0?'blue':'red'}">${Utils.fmt.currency(r.saldo)}</div>
        <div class="kpi-change">${r.saldo>=0?'✅ Positivo':'⚠ Atenção ao saldo'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon yellow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div class="kpi-label">NFs Pendentes</div>
        <div class="kpi-value yellow">${r.nfPendentes}</div>
        <div class="kpi-change">${Utils.fmt.currency(r.nfPendentesValor)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon cyan"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
        <div class="kpi-label">A Pagar</div>
        <div class="kpi-value cyan">${r.aPagar}</div>
        <div class="kpi-change">${Utils.fmt.currency(r.aPagarValor)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon green"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
        <div class="kpi-label">${isEscritorio ? 'Centro de Custo' : 'Obras Ativas'}</div>
        <div class="kpi-value green" style="${isEscritorio?'font-size:1.15rem;':''}">${isEscritorio ? '🏢 Sede Central' : ativos}</div>
        <div class="kpi-change">${isEscritorio ? `${DB.getDespesasEscritorio().length} despesas registradas` : `de ${cs.length} obras | ${medPend} medições em análise`}</div>
      </div>
    </div>

    <div class="g2" style="margin-bottom:14px;">
      <div class="card">
        <div class="card-header"><div class="card-title">💹 Receitas × Despesas por Mês</div></div>
        <div class="chart-container" style="position:relative;height:240px;"><canvas id="ch-bar"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">🥧 Distribuição de Despesas</div></div>
        <div class="chart-container" style="position:relative;height:240px;"><canvas id="ch-donut"></canvas></div>
      </div>
    </div>

    <div class="g2" style="margin-bottom:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">${isEscritorio ? '🏢 Custos Administrativos da Sede' : '🏗️ Progresso das Obras'}</div>
          <button class="btn btn-ghost btn-sm" onclick="${isEscritorio ? "App.navigate('escritorio')" : "App.navigate('orcamentos')"}">
            ${isEscritorio ? 'Ver Despesas Sede →' : 'Ver detalhes →'}
          </button>
        </div>
        <div id="prog-obras">${this._progressoObras(obraId)}</div>
      </div>
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <div class="card-title">⏰ Pr&oacute;ximos Vencimentos (60 dias)</div>
            <span style="font-size:.72rem;color:var(--text3);font-weight:700;">Boletos &amp; Contas a Pagar</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="btn btn-sm" onclick="WhatsApp.enviarResumoDiario('${obraId}')" style="background:#25D366;color:#fff;font-weight:700;display:flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:20px;border:none;cursor:pointer;" title="Enviar resumo de boletos para o WhatsApp">
              📲 Resumo WhatsApp
            </button>
            <button class="btn btn-ghost btn-sm" onclick="WhatsApp.abrirModalConfig()" title="Configurar Telefone do WhatsApp" style="padding:2px 6px;">⚙️</button>
          </div>
        </div>
        <div id="vencimentos" class="custom-scroll" style="max-height:245px;overflow-y:auto;padding-right:6px;">
          ${this._vencimentos(obraId)}
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <div class="card-header">
        <div class="card-title">📊 DRE Gerencial — Resultado por Centro de Custo</div>
        <span style="font-size:.76rem;color:var(--text3);">Demonstrativo de Resultado de Obra</span>
      </div>
      <div class="card-body" style="padding:16px 20px;">
        ${this._dreGerencial(obraId)}
      </div>
    </div>

    <div class="card" style="padding:0;">
      <div class="card-header" style="padding:18px 20px 0;">
        <div class="card-title">📝 &Uacute;ltimos Lan&ccedil;amentos</div>
        <button class="btn btn-secondary btn-sm" onclick="${isEscritorio ? "App.navigate('escritorio')" : "App.navigate('lancamentos')"}">Ver todos</button>
      </div>
      <div class="tbl-wrap" style="border:none;border-radius:0 0 14px 14px;">
        <table>
          <thead><tr>
            <th>Data</th>${obraId==='todas'?'<th>Obra</th>':''}
            <th>Descri&ccedil;&atilde;o</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th>Status</th>
          </tr></thead>
          <tbody>${this._recentRows(obraId)}</tbody>
        </table>
      </div>
    </div>`;
  },

  _dreGerencial(obraId) {
    const isTodas = !obraId || obraId === 'todas';
    const cs = DB.getAll('clientes') || [];
    const lans = DB.getAll('lancamentos') || [];

    const calcularDREPara = (filtroObraId) => {
      const lFiltrados = filtroObraId
        ? (filtroObraId === 'escritorio' ? lans.filter(l => l.obra_id === 'escritorio') : lans.filter(l => l.obra_id === filtroObraId))
        : lans;

      const recs = lFiltrados.filter(l => l.tipo === 'receita').reduce((s, l) => s + (l.valor || 0), 0);
      const mat  = lFiltrados.filter(l => l.tipo === 'despesa' && l.categoria === 'material').reduce((s, l) => s + (l.valor || 0), 0);
      const mo   = lFiltrados.filter(l => l.tipo === 'despesa' && l.categoria === 'mao_de_obra').reduce((s, l) => s + (l.valor || 0), 0);
      const srv  = lFiltrados.filter(l => l.tipo === 'despesa' && l.categoria === 'servico').reduce((s, l) => s + (l.valor || 0), 0);
      const eqp  = lFiltrados.filter(l => l.tipo === 'despesa' && l.categoria === 'equipamento').reduce((s, l) => s + (l.valor || 0), 0);
      const adm  = lFiltrados.filter(l => l.tipo === 'despesa' && (l.categoria === 'administrativo' || !['material','mao_de_obra','servico','equipamento'].includes(l.categoria))).reduce((s, l) => s + (l.valor || 0), 0);

      const custosDiretos = mat + mo + srv + eqp;
      const margemBruta   = recs - custosDiretos;
      const margemBrutaPct = recs > 0 ? ((margemBruta / recs) * 100) : (custosDiretos > 0 ? -100 : 0);
      const lucroLiquido  = margemBruta - adm;
      const margemLiqPct  = recs > 0 ? ((lucroLiquido / recs) * 100) : (adm + custosDiretos > 0 ? -100 : 0);

      return { recs, mat, mo, srv, eqp, custosDiretos, margemBruta, margemBrutaPct, adm, lucroLiquido, margemLiqPct };
    };

    const dGeral = calcularDREPara(isTodas ? null : obraId);

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:18px;">
        <div style="background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.25);border-radius:var(--r-md);padding:12px 14px;">
          <div style="font-size:.72rem;color:var(--text3);font-weight:700;text-transform:uppercase;">(+) Receita Operacional</div>
          <div style="font-size:1.25rem;font-weight:800;color:var(--success);margin-top:2px;">${Utils.fmt.currency(dGeral.recs)}</div>
          <div style="font-size:.72rem;color:var(--text3);margin-top:2px;">Medições & Entradas</div>
        </div>

        <div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.25);border-radius:var(--r-md);padding:12px 14px;">
          <div style="font-size:.72rem;color:var(--text3);font-weight:700;text-transform:uppercase;">(-) Custos Diretos</div>
          <div style="font-size:1.25rem;font-weight:800;color:var(--danger);margin-top:2px;">${Utils.fmt.currency(dGeral.custosDiretos)}</div>
          <div style="font-size:.72rem;color:var(--text3);margin-top:2px;">Mat + Mão de Obra + Serv + Eqp</div>
        </div>

        <div style="background:rgba(59,130,246,.07);border:1px solid rgba(59,130,246,.25);border-radius:var(--r-md);padding:12px 14px;">
          <div style="font-size:.72rem;color:var(--text3);font-weight:700;text-transform:uppercase;">(=) Margem Bruta</div>
          <div style="font-size:1.25rem;font-weight:800;color:${dGeral.margemBruta>=0?'#3b82f6':'var(--danger)'};margin-top:2px;">
            ${Utils.fmt.currency(dGeral.margemBruta)}
            <span style="font-size:.75rem;font-weight:700;color:var(--text2);margin-left:4px;">(${dGeral.margemBrutaPct.toFixed(1)}%)</span>
          </div>
          <div style="font-size:.72rem;color:var(--text3);margin-top:2px;">Margem da Construção</div>
        </div>

        <div style="background:${dGeral.lucroLiquido>=0?'rgba(201,162,39,.08)':'rgba(239,68,68,.07)'};border:1px solid ${dGeral.lucroLiquido>=0?'rgba(201,162,39,.3)':'rgba(239,68,68,.3)'};border-radius:var(--r-md);padding:12px 14px;">
          <div style="font-size:.72rem;color:var(--text3);font-weight:700;text-transform:uppercase;">(=) Resultado Líquido</div>
          <div style="font-size:1.25rem;font-weight:800;color:${dGeral.lucroLiquido>=0?'var(--accent2)':'var(--danger)'};margin-top:2px;">
            ${Utils.fmt.currency(dGeral.lucroLiquido)}
            <span style="font-size:.75rem;font-weight:700;color:var(--text2);margin-left:4px;">(${dGeral.margemLiqPct.toFixed(1)}%)</span>
          </div>
          <div style="font-size:.72rem;color:var(--text3);margin-top:2px;">Lucro Real Pós-Indiretos</div>
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table class="data-table" style="font-size:.82rem;">
          <thead>
            <tr>
              <th>Centro de Custo / Obra</th>
              <th style="text-align:right;">Receita</th>
              <th style="text-align:right;">🧱 Materiais</th>
              <th style="text-align:right;">👷 Mão de Obra</th>
              <th style="text-align:right;">🔧 Serviços/Eqp</th>
              <th style="text-align:right;">📋 Indiretos</th>
              <th style="text-align:right;">Lucro Líquido</th>
              <th style="text-align:right;">Margem %</th>
            </tr>
          </thead>
          <tbody>
            ${(isTodas ? cs : cs.filter(c => c.id === obraId)).map(c => {
              const d = calcularDREPara(c.id);
              return `
              <tr>
                <td style="font-weight:700;color:var(--text);">🏗️ ${c.nome}</td>
                <td style="text-align:right;color:var(--success);font-weight:700;">${Utils.fmt.currency(d.recs)}</td>
                <td style="text-align:right;color:var(--text2);">${Utils.fmt.currency(d.mat)}</td>
                <td style="text-align:right;color:var(--text2);">${Utils.fmt.currency(d.mo)}</td>
                <td style="text-align:right;color:var(--text2);">${Utils.fmt.currency(d.srv + d.eqp)}</td>
                <td style="text-align:right;color:var(--text3);">${Utils.fmt.currency(d.adm)}</td>
                <td style="text-align:right;font-weight:800;color:${d.lucroLiquido>=0?'var(--success)':'var(--danger)'};">${Utils.fmt.currency(d.lucroLiquido)}</td>
                <td style="text-align:right;font-weight:700;color:${d.margemLiqPct>=0?'var(--accent2)':'var(--danger)'};">${d.margemLiqPct.toFixed(1)}%</td>
              </tr>`;
            }).join('')}
            ${isTodas ? `
            <tr style="background:rgba(255,255,255,.02);font-style:italic;">
              <td style="font-weight:700;color:var(--text);">🏢 Sede / Escritório Central</td>
              <td style="text-align:right;color:var(--text3);">${Utils.fmt.currency(calcularDREPara('escritorio').recs)}</td>
              <td style="text-align:right;color:var(--text3);">${Utils.fmt.currency(calcularDREPara('escritorio').mat)}</td>
              <td style="text-align:right;color:var(--text3);">${Utils.fmt.currency(calcularDREPara('escritorio').mo)}</td>
              <td style="text-align:right;color:var(--text3);">${Utils.fmt.currency(calcularDREPara('escritorio').srv + calcularDREPara('escritorio').eqp)}</td>
              <td style="text-align:right;color:var(--danger);">${Utils.fmt.currency(calcularDREPara('escritorio').adm)}</td>
              <td style="text-align:right;font-weight:800;color:var(--danger);">${Utils.fmt.currency(calcularDREPara('escritorio').lucroLiquido)}</td>
              <td style="text-align:right;color:var(--text3);">—</td>
            </tr>` : ''}
          </tbody>
        </table>
      </div>`;
  },

  _progressoObras(obraId) {
    if (obraId === 'escritorio') {
      const res = DB.getResumoEscritorio();
      const total = res.totalGeral || 1;
      const grupos = [
        { label: '💡 Contas de Consumo (Luz / Água / Net)', val: res.consumoValor, color: 'cyan' },
        { label: '🏛️ Impostos & Simples Nacional', val: res.impostosValor, color: 'yellow' },
        { label: '👥 Folha de Pagamento & Sócios', val: res.folhaValor, color: 'green' },
        { label: '🏢 Estrutura & Aluguel', val: res.estruturaValor, color: 'blue' },
        { label: '⚖️ Contabilidade, TI & Softwares', val: res.servicosValor, color: 'purple' }
      ];

      return grupos.map(g => {
        const pct = Math.min(100, Math.round((g.val / total) * 100)) || 0;
        return `
        <div style="margin-bottom:14px;padding:0 2px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:.82rem;font-weight:700;color:var(--text);">${g.label}</span>
            <span style="font-size:.78rem;font-weight:800;color:var(--accent2);">${Utils.fmt.currency(g.val)} (${pct}%)</span>
          </div>
          <div class="progress-bar" style="margin-bottom:4px;">
            <div class="progress-fill ${g.color}" style="width:${pct}%;"></div>
          </div>
        </div>`;
      }).join('');
    }

    let cs = DB.getAll('clientes');
    if (obraId && obraId !== 'todas') cs = cs.filter(c => c.id === obraId);
    if (!cs.length) return '<p style="color:var(--text3);padding:20px;text-align:center">Nenhuma obra cadastrada</p>';
    return cs.map(c => {
      const orc = DB.getAll('orcamentos').find(o => o.obra_id === c.id);
      let pct = 0;
      if (orc && orc.etapas.length) {
        const tv = orc.etapas.reduce((s,e)=>s+e.valor_previsto,0);
        const tr = orc.etapas.reduce((s,e)=>s+e.valor_realizado,0);
        pct = tv>0 ? Math.min(100,(tr/tv)*100) : 0;
      }
      const cl = pct<30?'red':pct<70?'yellow':'green';
      const med = DB.getAll('medicoes').filter(m=>m.obra_id===c.id);
      const libPct = med.length ? Math.round((med.filter(m=>m.status==='liberada').length/med.length)*100) : 0;
      return `<div style="margin-bottom:18px;padding:0 2px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span style="font-size:.84rem;font-weight:700">${c.nome}</span>
          <span style="font-size:.78rem;color:var(--text3)">${pct.toFixed(0)}% realizado</span>
        </div>
        <div class="progress-bar" style="margin-bottom:6px;"><div class="progress-fill ${cl}" style="width:${pct}%"></div></div>
        <div style="display:flex;align-items:center;gap:8px;">${Utils.badge(c.status)}<span style="font-size:.72rem;color:var(--text3)">${med.length} medições · ${libPct}% liberadas · ${Utils.fmt.currency(c.valor_financiado)}</span></div>
      </div>`;
    }).join('');
  },

  _vencimentos(obraId) {
    const today = Utils.today();
    const future = new Date(); 
    future.setDate(future.getDate() + 60);
    const fStr = future.toISOString().split('T')[0];

    const lans = DB.getLancamentos(obraId==='todas'?null:obraId).filter(l => {
      const venc = l.data_vencimento || l.data;
      return l.tipo === 'despesa' && (l.status === 'a_pagar' || l.status === 'pendente') && venc >= today && venc <= fStr;
    });

    const nfItems = DB.getAll('notas').filter(n => {
      const venc = n.data_vencimento || n.data_emissao;
      return (!obraId || obraId === 'todas' || n.obra_id === obraId) && n.status === 'pendente' && venc >= today && venc <= fStr;
    });

    const items = [
      ...lans.map(l => ({
        id: l.id,
        tipo_entidade: 'lancamento',
        data: l.data_vencimento || l.data,
        desc: l.descricao,
        val: l.valor,
        codigo_barras: l.codigo_barras,
        tp: l.codigo_barras ? '📄' : '💸',
        fornecedor: l.fornecedor_beneficiario,
        obra_id: l.obra_id
      })),
      ...nfItems.map(n => ({
        id: n.id,
        tipo_entidade: 'nota',
        data: n.data_vencimento,
        desc: `NF ${n.numero_nf} — ${n.emitente.slice(0,25)}`,
        val: n.valor_bruto,
        codigo_barras: null,
        tp: '🧾',
        fornecedor: n.emitente,
        obra_id: n.obra_id
      }))
    ].sort((a,b) => a.data.localeCompare(b.data)).slice(0, 30);

    if (!items.length) {
      return '<div style="color:var(--text3);padding:24px;text-align:center;font-size:.85rem;">🎉 Nenhum vencimento para os próximos 60 dias</div>';
    }

    const tDate = new Date(today);
    window._tempVencItems = items;

    return items.map((it, idx) => {
      const vDate = new Date(it.data);
      const diffTime = vDate - tDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let diasBadge = '';
      if (diffDays === 0) diasBadge = '<span style="color:#ef4444;font-weight:800;font-size:.68rem;background:rgba(239,68,68,.15);padding:2px 6px;border-radius:4px;">Hoje</span>';
      else if (diffDays === 1) diasBadge = '<span style="color:#f59e0b;font-weight:800;font-size:.68rem;background:rgba(245,158,11,.15);padding:2px 6px;border-radius:4px;">Amanhã</span>';
      else if (diffDays <= 7) diasBadge = `<span style="color:#f59e0b;font-weight:800;font-size:.68rem;background:rgba(245,158,11,.15);padding:2px 6px;border-radius:4px;">Em ${diffDays} dias</span>`;
      else diasBadge = `<span style="color:var(--text3);font-size:.68rem;">Em ${diffDays} dias</span>`;

      const c = DB.getById('clientes', it.obra_id);

      return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 4px;border-bottom:1px solid var(--border-s);gap:10px;">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
          <div style="background:var(--warning-bg);color:var(--warning);padding:5px 8px;border-radius:6px;font-size:.72rem;font-weight:800;white-space:nowrap;text-align:center;min-width:70px;">
            ${Utils.fmt.date(it.data)}
          </div>
          <span style="font-size:1.1rem;flex-shrink:0;">${it.tp}</span>
          <div style="min-width:0;flex:1;">
            <div style="font-size:.82rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${it.desc}
            </div>
            <div style="display:flex;gap:8px;align-items:center;font-size:.7rem;color:var(--text3);flex-wrap:wrap;margin-top:2px;">
              <span>👤 ${c?.nome || 'Geral'}</span>
              <span>&bull;</span>
              ${diasBadge}
              ${it.codigo_barras ? `<span>&bull;</span> <span style="font-family:monospace;color:var(--accent2);cursor:pointer;" onclick="Dashboard.copiarLinhaDigitavel('${it.codigo_barras}')" title="Clique para copiar código de barras">🔢 Boleto [Copiar]</span>` : ''}
            </div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <div style="font-size:.88rem;font-weight:900;color:var(--danger);">${Utils.fmt.currency(it.val)}</div>
          <div style="display:flex;gap:5px;align-items:center;">
            <button onclick="WhatsApp.enviarAlertaVencimento(window._tempVencItems[${idx}])"
              style="background:rgba(37,211,102,.12);color:#25D366;border:1px solid rgba(37,211,102,.3);padding:2px 7px;border-radius:12px;font-size:.68rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:3px;"
              title="Enviar alerta deste boleto no WhatsApp">
              📲 WhatsApp
            </button>
            ${typeof Documentos !== 'undefined' ? Documentos.badgeClip(it.tipo_entidade, it.id) : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  },

  copiarLinhaDigitavel(codigo) {
    if (!codigo) return;
    navigator.clipboard.writeText(codigo).then(() => {
      Utils.toast('Linha digitável do boleto copiada!', 'success');
    }).catch(() => {
      Utils.toast('Código: ' + codigo, 'info');
    });
  },

  _recentRows(obraId) {
    const lans = DB.getLancamentos(obraId==='todas'?null:obraId).slice(0,10);
    const cs = DB.getAll('clientes');
    if (!lans.length) return `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:30px">Nenhum lançamento encontrado neste centro de custo.</td></tr>`;
    return lans.map(l=>{
      const c = l.obra_id === 'escritorio' ? { nome: '🏢 Sede / Escritório' } : cs.find(x=>x.id===l.obra_id);
      return `<tr>
        <td style="white-space:nowrap">${Utils.fmt.date(l.data)}</td>
        ${obraId==='todas'?`<td style="font-size:.78rem;color:var(--text2)">${c?.nome||'—'}</td>`:''}
        <td>${l.descricao}</td>
        <td>${Utils.catLabel(l.categoria)}</td>
        <td>${l.tipo==='receita'?'<span class="badge badge-success">↑ Receita</span>':'<span class="badge badge-danger">↓ Despesa</span>'}</td>
        <td style="font-weight:800;white-space:nowrap;color:${l.tipo==='receita'?'var(--success)':'var(--danger)'};">${l.tipo==='receita'?'+':'−'} ${Utils.fmt.currency(l.valor)}</td>
        <td>${Utils.badge(l.status)}</td>
      </tr>`;
    }).join('');
  },

  init(obraId) {
    setTimeout(() => {
      this._barChart(obraId);
      this._donutChart(obraId);
    }, 60);
  },

  _barChart(obraId) {
    const canvas = document.getElementById('ch-bar');
    if (!canvas) return;
    const lans = DB.getLancamentos(obraId==='todas'?null:obraId);
    const months = {};
    lans.forEach(l => {
      const k = (l.data || '').slice(0,7);
      if (!k) return;
      if (!months[k]) months[k]={rec:0,desp:0};
      if (l.tipo==='receita') months[k].rec+=l.valor;
      if (l.tipo==='despesa') months[k].desp+=l.valor;
    });
    const keys = Object.keys(months).sort();
    if (!keys.length) {
      const cur = new Date().toISOString().slice(0,7);
      months[cur] = { rec: 0, desp: 0 };
      keys.push(cur);
    }
    const labels = keys.map(k=>{ const [y,m]=k.split('-'); return `${m}/${y}`; });
    const ch = new Chart(canvas,{
      type:'bar',
      data:{ labels, datasets:[
        { label:'Receitas', data:keys.map(k=>months[k].rec), backgroundColor:'rgba(16,185,129,.75)', borderColor:'#10b981', borderWidth:1, borderRadius:4 },
        { label:'Despesas', data:keys.map(k=>months[k].desp), backgroundColor:'rgba(239,68,68,.75)', borderColor:'#ef4444', borderWidth:1, borderRadius:4 }
      ]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{labels:{color:'#94a3b8',font:{size:11}}}, tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${Utils.fmt.currency(c.raw)}`}} }, scales:{ x:{ticks:{color:'#4a5568'},grid:{color:'rgba(255,255,255,.03)'}}, y:{ticks:{color:'#4a5568',callback:v=>'R$'+(v/1000).toFixed(0)+'k'},grid:{color:'rgba(255,255,255,.05)'}} } }
    });
    App.registerChart(ch);
  },

  _donutChart(obraId) {
    const canvas = document.getElementById('ch-donut');
    if (!canvas) return;
    const lans = DB.getLancamentos(obraId==='todas'?null:obraId);
    const desp = lans.filter(l => l.tipo === 'despesa');
    const cats = {};
    desp.forEach(d => {
      cats[d.categoria] = (cats[d.categoria] || 0) + (d.valor || 0);
    });
    const labels = Object.keys(cats).map(Utils.catLabel.bind(Utils));
    const values = Object.values(cats);

    if (!values.length || values.every(v => v === 0)) {
      const container = canvas.parentElement;
      if (container) {
        container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text3);font-size:.85rem;text-align:center;">
          <span style="font-size:2.2rem;margin-bottom:8px;opacity:.5;">🥧</span>
          <span>Nenhuma despesa registrada para exibir o gráfico neste centro.</span>
        </div>`;
      }
      return;
    }

    const total = values.reduce((a,b)=>a+b,0);
    const palette = ['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#e879f9', '#2dd4bf', '#818cf8', '#f43f5e', '#a3e635', '#22d3ee', '#c084fc', '#facc15', '#60a5fa'];

    const ch = new Chart(canvas,{
      type:'doughnut',
      data:{
        labels,
        datasets:[{
          data: values,
          backgroundColor: palette.slice(0, values.length),
          borderColor: 'transparent',
          hoverOffset: 8
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        cutout:'65%',
        plugins:{
          legend:{
            position:'right',
            labels:{ color:'#94a3b8', font:{size:10}, boxWidth:10, padding:8 }
          },
          tooltip:{
            callbacks:{
              label: c => ` ${c.label}: ${Utils.fmt.currency(c.raw)} (${((c.raw/total)*100).toFixed(1)}%)`
            }
          }
        }
      }
    });
    App.registerChart(ch);
  },

  // ─────────────────────────────────────────────────────────────
  // MODAL E ROTINAS DE IMPRESSÃO DO DASHBOARD
  // ─────────────────────────────────────────────────────────────
  abrirModalImpressao() {
    const obraId = App.obraId;
    const cs = DB.getAll('clientes');
    const obraNome = obraId === 'todas' ? 'Todas as Obras' : (cs.find(c=>c.id===obraId)?.nome || 'Obra Selecionada');

    Utils.showModal(`
      <div class="modal" style="max-width:560px;">
        <div class="modal-header">
          <span class="modal-title">🖨️ Opções de Impressão do Dashboard</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:.84rem;color:var(--text2);margin-bottom:16px;">
            Selecione o formato desejado para a geração do documento de <strong>${obraNome}</strong>:
          </p>

          <div style="display:grid;grid-template-columns:1fr;gap:12px;">
            <!-- Opção 1: Painel Visual do Dashboard -->
            <div style="border:1px solid var(--border);border-radius:var(--r-md);padding:16px;background:var(--bg-secondary);cursor:pointer;transition:all var(--t);display:flex;align-items:center;gap:14px;" 
                 onmouseover="this.style.borderColor='var(--accent)'" 
                 onmouseout="this.style.borderColor='var(--border)'"
                 onclick="Dashboard.imprimirPainelDashboard()">
              <div style="width:44px;height:44px;background:rgba(201,162,39,.15);border:1px solid var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">
                📊
              </div>
              <div style="flex:1;">
                <div style="font-weight:800;font-size:.92rem;color:var(--text);">Imprimir Painel do Dashboard (KPIs &amp; Visão Gráfica)</div>
                <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">Imprime os cartões de indicadores, receitas, despesas, saldo e resumo das obras em layout executivo.</div>
              </div>
              <span style="font-weight:900;color:var(--accent);">➔</span>
            </div>

            <!-- Opção 2: Dados em Lista / Tabela -->
            <div style="border:1px solid var(--border);border-radius:var(--r-md);padding:16px;background:var(--bg-secondary);cursor:pointer;transition:all var(--t);display:flex;align-items:center;gap:14px;" 
                 onmouseover="this.style.borderColor='var(--accent)'" 
                 onmouseout="this.style.borderColor='var(--border)'"
                 onclick="Dashboard.imprimirDadosEmLista()">
              <div style="width:44px;height:44px;background:rgba(16,185,129,.15);border:1px solid var(--success);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">
                📋
              </div>
              <div style="flex:1;">
                <div style="font-weight:800;font-size:.92rem;color:var(--text);">Imprimir Dados em Lista (Relatório Tabular)</div>
                <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">Imprime a listagem detalhada de lançamentos, faturamento, contratos Caixa e extrato contábil.</div>
              </div>
              <span style="font-weight:900;color:var(--success);">➔</span>
            </div>

            <!-- Opção 3: Central Completa de Exportação -->
            <div style="border:1px dashed var(--border);border-radius:var(--r-md);padding:12px 16px;background:var(--bg-card);cursor:pointer;display:flex;align-items:center;justify-content:space-between;" 
                 onclick="Utils.closeModal();App.navigate('exportar');">
              <span style="font-size:.82rem;color:var(--text2);">📥 Deseja baixar planilhas Excel ou outros modelos?</span>
              <span style="font-size:.82rem;color:var(--accent);font-weight:700;">Ir para Central &rarr;</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Fechar</button>
        </div>
      </div>
    `);
  },

  // Imprime o Painel Gráfico do Dashboard em folha A4 oficial
  imprimirPainelDashboard() {
    Utils.closeModal();
    const obraId = App.obraId;
    const resumo = DB.getResumo(obraId === 'todas' ? null : obraId);
    const cs = DB.getAll('clientes');
    const obraAtual = obraId !== 'todas' ? cs.find(c=>c.id===obraId) : null;
    const emissao = new Date().toLocaleString('pt-BR');
    const emp = DB.getEmpresa();
    const empNome = (emp.nome_fantasia || emp.razao_social || 'Minha Construtora').toUpperCase();
    const logoHtml = emp.logo_url
      ? `<img src="${emp.logo_url}" alt="${empNome}" style="max-width:54px;max-height:54px;border-radius:8px;border:1px solid #c9a227;object-fit:contain;">`
      : `<div style="width:46px;height:46px;border-radius:8px;background:#182713;border:1px solid #c9a227;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">🏢</div>`;

    const html = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#ffffff;padding:24px;max-width:820px;margin:0 auto;">
      
      <!-- Cabeçalho Oficial -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #c9a227;padding-bottom:14px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:14px;">
          ${logoHtml}
          <div>
            <div style="font-size:1.25rem;font-weight:900;letter-spacing:0.5px;color:#0f172a;line-height:1.1;">${empNome}</div>
            <div style="font-size:.76rem;font-weight:800;color:#b45309;text-transform:uppercase;">Painel Financeiro Executivo &middot; Dashboard</div>
          </div>
        </div>
        <div style="text-align:right;font-size:.74rem;color:#334155;">
          <div><strong>Emiss&atilde;o:</strong> ${emissao}</div>
          <div><strong>Escopo:</strong> ${obraAtual ? obraAtual.nome : 'Consolidado Geral'}</div>
        </div>
      </div>

      <!-- Grade de KPIs -->
          <div style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase;">NFs Pendentes</div>
          <div style="font-size:1.15rem;font-weight:900;color:#0369a1;margin-top:2px;">${r.nfPendentes} (${Utils.fmt.currency(r.nfPendentesValor)})</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:12px;text-align:center;">
          <div style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase;">Obras Ativas</div>
          <div style="font-size:1.15rem;font-weight:900;color:#0f172a;margin-top:2px;">${cs.length} Obras</div>
        </div>
      </div>

      <!-- Resumo das Obras -->
      <div style="margin-bottom:20px;">
        <h3 style="font-size:.9rem;font-weight:900;color:#0f172a;margin:0 0 10px 0;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">
          Progresso F&iacute;sico-Financeiro das Obras
        </h3>
        <table style="width:100%;border-collapse:collapse;font-size:.78rem;color:#0f172a;">
          <thead>
            <tr style="background:#0f172a;color:#ffffff;text-align:left;">
              <th style="padding:8px 10px;">Obra / Cliente</th>
              <th style="padding:8px 10px;">Cidade / UF</th>
              <th style="padding:8px 10px;">Contrato Caixa</th>
              <th style="padding:8px 10px;text-align:right;">Financiado</th>
              <th style="padding:8px 10px;text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${cs.map((c, i) => `
            <tr style="background:${i%2===0?'#ffffff':'#f8fafc'};border-bottom:1px solid #cbd5e1;">
              <td style="padding:7px 10px;font-weight:800;color:#0f172a;">${c.nome}</td>
              <td style="padding:7px 10px;color:#334155;">${c.cidade}/${c.estado}</td>
              <td style="padding:7px 10px;color:#0284c7;font-weight:700;">${c.num_contrato_caixa||'&mdash;'}</td>
              <td style="padding:7px 10px;text-align:right;font-weight:800;color:#15803d;">${Utils.fmt.currency(c.valor_financiado)}</td>
              <td style="padding:7px 10px;text-align:center;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:.7rem;font-weight:800;background:#dcfce7;color:#15803d;">${c.status}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- Últimas Movimentações -->
      <div>
        <h3 style="font-size:.9rem;font-weight:900;color:#0f172a;margin:0 0 10px 0;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">
          &Uacute;ltimas Movimenta&ccedil;&otilde;es Cont&aacute;beis
        </h3>
        <table style="width:100%;border-collapse:collapse;font-size:.76rem;color:#0f172a;">
          <thead>
            <tr style="background:#1e293b;color:#ffffff;text-align:left;">
              <th style="padding:7px 10px;">Data</th>
              <th style="padding:7px 10px;">Descri&ccedil;&atilde;o</th>
              <th style="padding:7px 10px;">Categoria</th>
              <th style="padding:7px 10px;text-align:right;">Valor</th>
              <th style="padding:7px 10px;text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${lans.map((l, i) => `
            <tr style="background:${i%2===0?'#ffffff':'#f8fafc'};border-bottom:1px solid #cbd5e1;">
              <td style="padding:6px 10px;font-weight:700;white-space:nowrap;">${Utils.fmt.date(l.data)}</td>
              <td style="padding:6px 10px;font-weight:700;color:#0f172a;">${l.descricao}</td>
              <td style="padding:6px 10px;color:#334155;">${l.categoria}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:800;color:${l.tipo==='receita'?'#15803d':'#b91c1c'};">${l.tipo==='receita'?'+':'-'} ${Utils.fmt.currency(l.valor)}</td>
              <td style="padding:6px 10px;text-align:center;"><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:.68rem;font-weight:800;background:#f1f5f9;color:#0f172a;">${l.status}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top:24px;border-top:1px dashed #cbd5e1;padding-top:8px;display:flex;justify-content:space-between;font-size:.7rem;color:#94a3b8;">
        <span>Documento oficial gerado via Sistema FinObra</span>
        <span>Autentica&ccedil;&atilde;o: DASH-${Date.now().toString(36).toUpperCase()}</span>
      </div>
    </div>`;

    this._dispararImpressaoFrame(html, `Dashboard — ${emp.nome_fantasia || 'Financeiro'}`);
  },

  // Imprime os Dados em Lista (Relatório Tabular)
  imprimirDadosEmLista() {
    Utils.closeModal();
    if (typeof Exportar !== 'undefined') {
      Exportar.imprimirRelatorio();
    }
  },

  _dispararImpressaoFrame(htmlConteudo, tituloDoc) {
    let printFrame = document.getElementById('angelim-print-frame');
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'angelim-print-frame';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
    }

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${tituloDoc}</title>
          <meta charset="utf-8">
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
        </head>
        <body>
          ${htmlConteudo}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    }, 400);
  }
};
