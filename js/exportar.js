const Exportar = {
  _currentPreview: 'completo',

  exportarRelatorioPDF() {
    this.imprimirRelatorio();
  },

  render(obraId) {
    const cs = DB.getAll('clientes');
    return `
    <div class="page-header">
      <div><h1 class="page-title">&#x1F4E5; Exportar &amp; Relat&oacute;rios</h1><p class="page-sub">Gere relat&oacute;rios executivos formatados e planilhas Excel</p></div>
    </div>

    <div class="g2" style="margin-bottom:20px;">
      <!-- Card Excel -->
      <div class="card">
        <div class="card-header"><div class="card-title">&#x1F4CA; Planilhas Excel (.xlsx)</div></div>
        <p style="color:var(--text2);font-size:.84rem;margin-bottom:14px">Exporta&ccedil;&atilde;o direta com nome personalizado e organiza&ccedil;&atilde;o em abas.</p>
        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label">Selecionar Obra</label>
          <select class="form-control" id="exp-obra" onchange="Exportar.onObraChange()">
            <option value="todas">Todas as Obras (Vis&atilde;o Geral)</option>
            ${cs.map(c=>`<option value="${c.id}" ${c.id===obraId?'selected':''}>${c.nome} &mdash; ${c.cidade}/${c.estado}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-success btn-lg btn-block" onclick="Exportar.exportarExcel('completo')" style="display:flex;align-items:center;justify-content:center;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            &#x1F4CA; Baixar Relat&oacute;rio Completo (.xlsx)
          </button>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="Exportar.exportarExcel('lancamentos')">&#x1F4B0; Lan&ccedil;amentos</button>
            <button class="btn btn-secondary btn-sm" onclick="Exportar.exportarExcel('notas')">&#x1F9FE; Notas Fiscais</button>
            <button class="btn btn-secondary btn-sm" onclick="Exportar.exportarExcel('medicoes')">&#x1F528; Medi&ccedil;&otilde;es Caixa</button>
            <button class="btn btn-secondary btn-sm" onclick="Exportar.exportarExcel('orcamentos')">&#x1F4CB; Previsto &times; Real.</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="Exportar.exportarExcel('dre')">📊 DRE Gerencial (.xlsx)</button>
            <button class="btn btn-secondary btn-sm" onclick="Exportar.exportarExcel('fluxo')">📈 Fluxo 90d (.xlsx)</button>
          </div>
          <button class="btn btn-secondary btn-sm btn-block" onclick="Exportar.exportarExcel('escritorio')">&#x1F3E2; Despesas Escrit&oacute;rio (.xlsx)</button>
          <button class="btn btn-secondary btn-sm btn-block" onclick="Exportar.exportarExcel('sinapi')">&#x1F3D7;&#xFE0F; Or&ccedil;amentos SINAPI (.xlsx)</button>
        </div>
      </div>

      <!-- Card Impressão / PDF -->
      <div class="card">
        <div class="card-header"><div class="card-title">&#x1F5A8;&#xFE0F; Relat&oacute;rio Formatado (PDF / Impress&atilde;o)</div></div>
        <p style="color:var(--text2);font-size:.84rem;margin-bottom:14px">Documento executivo com cabe&ccedil;alho institucional Angelim e dados da obra.</p>
        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label">Modelo do Relat&oacute;rio</label>
          <select class="form-control" id="exp-preview-type" onchange="Exportar.preview(this.value)">
            <option value="completo">&#x1F4CA; Relat&oacute;rio Financeiro Executivo</option>
            <option value="dre">📊 DRE Gerencial (Resultado &amp; Margens)</option>
            <option value="fluxo">📈 Projeção de Fluxo de Caixa (90 Dias)</option>
            <option value="lancamentos">&#x1F4B0; Extrato de Lan&ccedil;amentos</option>
            <option value="escritorio">&#x1F3E2; Despesas do Escrit&oacute;rio / Sede</option>
            <option value="notas">&#x1F9FE; Relat&oacute;rio de Notas Fiscais</option>
            <option value="medicoes">&#x1F528; Hist&oacute;rico de Medi&ccedil;&otilde;es Caixa</option>
            <option value="orcamentos">&#x1F4CB; Controle Previsto &times; Realizado</option>
            <option value="sinapi">&#x1F3D7;&#xFE0F; Planilha Or&ccedil;ament&aacute;ria SINAPI</option>
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-primary btn-lg btn-block" onclick="Exportar.imprimirRelatorio()" style="display:flex;align-items:center;justify-content:center;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            &#x1F5A8;&#xFE0F; Imprimir / Salvar em PDF (A4)
          </button>
          <button class="btn btn-secondary btn-sm btn-block" onclick="Exportar.abrirEmNovaAba()">&#x1F517; Abrir Documento em Nova Guia</button>
        </div>
      </div>
    </div>

    <!-- Painel de Pré-visualização com Visual de Folha A4 -->
    <div class="card" id="preview-panel" style="padding:20px;">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:20px;">
        <div>
          <div class="card-title" id="preview-title">&#x1F441;&#xFE0F; Pr&eacute;-visualiza&ccedil;&atilde;o da Folha de Impress&atilde;o</div>
          <div style="font-size:.78rem;color:var(--text3);margin-top:2px;">Exatamente como ser&aacute; emitido em PDF / Impress&atilde;o</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm btn-secondary" onclick="Exportar.preview(Exportar._currentPreview)">&#x1F504; Atualizar</button>
          <button class="btn btn-sm btn-primary" onclick="Exportar.imprimirRelatorio()">&#x1F5A8;&#xFE0F; Imprimir Agora</button>
        </div>
      </div>

      <!-- Container simulando folha A4 branca -->
      <div id="print-sheet-wrapper" style="background:#262b32;padding:16px;border-radius:12px;overflow-x:auto;display:flex;justify-content:center;">
        <div id="print-sheet" style="background:#ffffff;color:#1e293b;width:100%;max-width:900px;min-height:700px;padding:clamp(16px,4vw,36px);border-radius:4px;box-shadow:0 10px 30px rgba(0,0,0,0.35);font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;overflow-x:auto;">
          ${this.gerarHTMLDocumento(this._currentPreview)}
        </div>
      </div>
    </div>`;
  },

  getObraId() {
    return document.getElementById('exp-obra')?.value || App.obraId;
  },

  onObraChange() {
    this.preview(this._currentPreview);
  },

  preview(type) {
    this._currentPreview = type;
    const sheet = document.getElementById('print-sheet');
    const typeSel = document.getElementById('exp-preview-type');
    if (typeSel) typeSel.value = type;
    if (sheet) sheet.innerHTML = this.gerarHTMLDocumento(type);
  },

  // ─────────────────────────────────────────────────────────────
  // GERAÇÃO DO DOCUMENTO EXECUTIVO PREMIUM (HTML PURO PARA A4)
  // ─────────────────────────────────────────────────────────────
  gerarHTMLDocumento(type) {
    if (typeof ExportarTemplates !== 'undefined') {
      return ExportarTemplates.gerar(type, this.getObraId());
    }
    return '';
  },

  // ─────────────────────────────────────────────────────────────
  // MOTOR DE IMPRESSÃO (SEM ELEMENTOS DE TELA DO SISTEMA)
  // ─────────────────────────────────────────────────────────────
  imprimirRelatorio() {
    const htmlDoc = this.gerarHTMLDocumento(this._currentPreview);
    
    // Injetar frame invisível ou janela limpa
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
          <title>Relatório ${DB.getEmpresa().nome_fantasia || 'Financeiro'}</title>
          <meta charset="utf-8">
          <style>
            @page { size: A4 landscape; margin: 10mm 8mm 10mm 8mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            table { page-break-inside: auto; width: 100% !important; table-layout: fixed; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            td, th { overflow: hidden; text-overflow: ellipsis; word-break: break-word; }
            .ang-tbl-wrap { overflow: visible !important; }
            .ang-tbl-wrap table { min-width: unset !important; font-size: 0.65rem !important; }
            .ang-tbl-wrap td, .ang-tbl-wrap th { padding: 5px 5px !important; font-size: 0.65rem !important; white-space: normal !important; }
          </style>
        </head>
        <body>
          ${htmlDoc}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    }, 400);
  },

  abrirEmNovaAba() {
    const htmlDoc = this.gerarHTMLDocumento(this._currentPreview);
    const w = window.open('', '_blank');
    if (!w) { Utils.toast('Permita popups para abrir em nova guia', 'warning'); return; }
    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório Angelim Construtora</title>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', sans-serif; background: #f1f5f9; padding: 30px; margin: 0; display: flex; justify-content: center; }
            .sheet { background: #fff; max-width: 100%; width: 100%; padding: 40px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            @media print {
              @page { size: A4 landscape; margin: 10mm 8mm 10mm 8mm; }
              body { background: #fff; padding: 0; display: block; }
              .sheet { box-shadow: none; padding: 0; max-width: 100%; }
              table { width: 100% !important; table-layout: fixed; }
              td, th { overflow: hidden; text-overflow: ellipsis; word-break: break-word; }
              .ang-tbl-wrap { overflow: visible !important; }
              .ang-tbl-wrap table { min-width: unset !important; font-size: 0.65rem !important; }
              .ang-tbl-wrap td, .ang-tbl-wrap th { padding: 5px 5px !important; font-size: 0.65rem !important; white-space: normal !important; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">${htmlDoc}</div>
        </body>
      </html>
    `);
    w.document.close();
  },

  // ─────────────────────────────────────────────────────────────
  // EXPORTAÇÃO EXCEL (.XLSX COM NOME LIMPO)
  // ─────────────────────────────────────────────────────────────
  exportarExcel(tipo) {
    if (typeof XLSX === 'undefined') { Utils.toast('Biblioteca XLSX n&atilde;o carregada','error'); return; }
    const obraId = this.getObraId();
    const wb = XLSX.utils.book_new();
    const clienteObj = DB.getById('clientes', obraId);
    const nome = clienteObj?.nome || 'Todas_as_Obras';
    const safeNome = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 25);

    const addSheet = (data, name) => {
      if (!data.length) return;
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wcol = data[0].map((_, i) => ({ wch: Math.min(50, Math.max(12, ...data.map(r => (r[i] !== null && r[i] !== undefined ? r[i].toString().length : 0)), name.length)) }));
      ws['!cols'] = wcol;
      XLSX.utils.book_append_sheet(wb, ws, name);
    };

    if (tipo === 'completo' || tipo === 'clientes') {
      const cs = obraId==='todas' ? DB.getAll('clientes') : [DB.getById('clientes',obraId)].filter(Boolean);
      const rows = [['Nome','CPF/CNPJ','Telefone','Email','Cidade','Estado','Contrato Caixa','Agência','Valor Financiado','Valor Próprio','Área m²','Data Início','Data Término','Status','Engenheiro']];
      cs.forEach(c=>rows.push([c.nome,c.cpf_cnpj,c.telefone,c.email,c.cidade,c.estado,c.num_contrato_caixa,c.agencia_caixa,c.valor_financiado,c.valor_proprio,c.area_construida,c.data_inicio,c.data_previsao_termino,c.status,c.engenheiro_responsavel]));
      addSheet(rows,'Obras');
    }

    if (tipo === 'completo' || tipo === 'lancamentos') {
      const lans = DB.getLancamentos(obraId==='todas'?null:obraId);
      const cs = DB.getAll('clientes');
      const rows = [['Data Emissão','Data Vencimento','Data Pagamento / Recebimento','Obra / Centro de Custo','Tipo','Categoria','Descrição','Fornecedor/Beneficiário','Valor','Status','Conciliado','Conta Bancária','Código de Barras','Origem']];
      lans.forEach(l=>{
        const c = l.obra_id === 'escritorio' ? { nome: 'Sede / Escritório' } : cs.find(x=>x.id===l.obra_id);
        const dtPag = (l.status === 'pago' || l.status === 'recebido') ? (l.data_pagamento || l.data) : '';
        rows.push([l.data, l.data_vencimento||l.data, dtPag, c?.nome||'', l.tipo, Utils.catLabel(l.categoria)||l.categoria, l.descricao, l.fornecedor_beneficiario||'', l.valor, l.status, l.conciliado?'Sim':'Não', l.conta_bancaria||'', l.codigo_barras||'', l.origem||'manual']);
      });
      addSheet(rows,'Lançamentos');
    }

    if (tipo === 'completo' || tipo === 'notas') {
      const nfs = obraId==='todas' ? DB.getAll('notas') : DB.getAll('notas').filter(n=>n.obra_id===obraId);
      const cs = DB.getAll('clientes');
      const rows = [['Nº NF','Série','Emissão','Vencimento','Data Pagamento','Obra / Centro de Custo','Emitente','CNPJ Emitente','Destinatário','Tipo','Categoria','Valor Bruto','Impostos','Valor Líquido','Status','Chave NF-e']];
      nfs.forEach(n=>{
        const c = n.obra_id === 'escritorio' ? { nome: 'Sede / Escritório' } : cs.find(x=>x.id===n.obra_id);
        const dtPag = n.status === 'paga' ? (n.data_pagamento || n.data_emissao) : '';
        rows.push([n.numero_nf, n.serie, n.data_emissao, n.data_vencimento, dtPag, c?.nome||'', n.emitente, n.cnpj_emitente, n.destinatario, n.tipo, Utils.catLabel(n.categoria)||n.categoria, n.valor_bruto, n.impostos, n.valor_liquido, n.status, n.chave_nfe]);
      });
      addSheet(rows,'Notas Fiscais');
    }

    if (tipo === 'completo' || tipo === 'medicoes') {
      const meds = obraId==='todas' ? DB.getAll('medicoes') : DB.getAll('medicoes').filter(m=>m.obra_id===obraId);
      const cs = DB.getAll('clientes');
      const rows = [['Nº','Obra','Status','% Físico','% Financeiro','Valor Solicitado','Valor Aprovado','Valor Liberado','Data Medição','Data Submissão','Data Aprovação','Data Liberação','Engenheiro','Descrição']];
      meds.forEach(m=>{
        const c=cs.find(x=>x.id===m.obra_id);
        rows.push([m.numero_medicao,c?.nome||'',m.status,m.percentual_fisico,m.percentual_financeiro,m.valor_solicitado,m.valor_aprovado||'',m.valor_liberado||'',m.data_medicao||'',m.data_submissao||'',m.data_aprovacao||'',m.data_liberacao||'',m.engenheiro_responsavel,m.etapa_descricao]);
      });
      addSheet(rows,'Medições');
    }

    if (tipo === 'completo' || tipo === 'orcamentos') {
      const orcs = obraId==='todas' ? DB.getAll('orcamentos') : DB.getAll('orcamentos').filter(o=>o.obra_id===obraId);
      const cs = DB.getAll('clientes');
      const rows = [['Orçamento','Obra','Etapa','Valor Previsto','Valor Realizado','Variação','% Execução','Data Início','Data Fim']];
      orcs.forEach(o=>{
        const c=cs.find(x=>x.id===o.obra_id);
        (o.etapas||[]).forEach(e=>{
          const v=(e.valor_realizado||0)-(e.valor_previsto||0);
          rows.push([o.nome,c?.nome||'',e.nome,e.valor_previsto,e.valor_realizado,v,e.percentual_execucao,e.data_inicio,e.data_fim]);
        });
      });
      addSheet(rows,'Orçamentos');
    }

    if (tipo === 'completo' || tipo === 'sinapi') {
      const sinapiOrcs = typeof OrcamentoSINAPI !== 'undefined' ? OrcamentoSINAPI._getAll(obraId) : [];
      const cs = DB.getAll('clientes');
      const rows = [['Orçamento','Obra','UF','Referência','Desonerado','BDI (%)','Item','Código SINAPI','Descrição','Unidade','Quantidade','Custo Unitário (R$)','Total Sem BDI (R$)','Total Com BDI (R$)']];
      sinapiOrcs.forEach(o => {
        const c = cs.find(x => x.id === o.obra_id);
        const bdiFator = 1 + ((parseFloat(o.bdi_percentual) || 0) / 100);
        (o.itens || []).forEach((it, idx) => {
          const totSem = (parseFloat(it.quantidade) || 0) * (parseFloat(it.custo_unitario) || 0);
          const totCom = totSem * bdiFator;
          rows.push([
            o.nome,
            c?.nome || '',
            o.uf || 'RR',
            o.referencia_sinapi || '',
            o.desonerado ? 'Sim' : 'Não',
            o.bdi_percentual || 0,
            idx + 1,
            it.codigo || '',
            it.descricao || '',
            it.unidade || '',
            it.quantidade || 0,
            it.custo_unitario || 0,
            totSem,
            totCom
          ]);
        });
      });
      addSheet(rows,'Orçamentos SINAPI');
    }
    if (tipo === 'escritorio') {
      const todosLans = DB.getLancamentos(null);
      const lans = todosLans.filter(l => l.obra_id === 'escritorio' && l.tipo === 'despesa');
      lans.sort((a, b) => a.data.localeCompare(b.data));
      const rows = [['Data Emissão','Data Vencimento','Data Pagamento','Categoria','Descrição','Fornecedor / Beneficiário','Conta Bancária','Valor (R$)','Status']];
      lans.forEach(l => {
        const dtPag = l.status === 'pago' ? (l.data_pagamento || l.data) : '';
        rows.push([l.data, l.data_vencimento||l.data, dtPag, Utils.catLabel(l.categoria)||l.categoria||'', l.descricao, l.fornecedor_beneficiario||'', l.conta_bancaria||'', l.valor, l.status]);
      });
      addSheet(rows, 'Despesas Escritório');
    }
    if (tipo === 'dre') {
      const todosLans = obraId === 'todas' ? DB.getAll('lancamentos') : DB.getLancamentos(obraId);
      const recs = todosLans.filter(l => l.tipo === 'receita').reduce((s,l) => s + l.valor, 0);
      const mat  = todosLans.filter(l => l.tipo === 'despesa' && l.categoria === 'material').reduce((s,l) => s + l.valor, 0);
      const mo   = todosLans.filter(l => l.tipo === 'despesa' && l.categoria === 'mao_de_obra').reduce((s,l) => s + l.valor, 0);
      const srv  = todosLans.filter(l => l.tipo === 'despesa' && l.categoria === 'servico').reduce((s,l) => s + l.valor, 0);
      const eqp  = todosLans.filter(l => l.tipo === 'despesa' && l.categoria === 'equipamento').reduce((s,l) => s + l.valor, 0);
      const adm  = todosLans.filter(l => l.tipo === 'despesa' && (l.categoria === 'administrativo' || l.obra_id === 'escritorio')).reduce((s,l) => s + l.valor, 0);
      const imp  = todosLans.filter(l => l.tipo === 'despesa' && l.categoria === 'impostos').reduce((s,l) => s + l.valor, 0);

      const rows = [
        ['DRE GERENCIAL — ANGELIM CONSTRUTORA','',''],
        ['Obra / Centro de Custo:', safeNome, ''],
        ['Data de Emissão:', new Date().toLocaleDateString('pt-BR'), ''],
        ['','',''],
        ['Conta Contábil / Linha DRE', 'Valor (R$)', '% Receita'],
        ['(+) RECEITA OPERACIONAL BRUTA', recs, '100.0%'],
        ['(−) Materiais de Construção', mat, recs > 0 ? ((mat/recs)*100).toFixed(1)+'%' : '0%'],
        ['(−) Mão de Obra e Equipes', mo, recs > 0 ? ((mo/recs)*100).toFixed(1)+'%' : '0%'],
        ['(−) Serviços Terceirizados', srv, recs > 0 ? ((srv/recs)*100).toFixed(1)+'%' : '0%'],
        ['(−) Locação de Equipamentos', eqp, recs > 0 ? ((eqp/recs)*100).toFixed(1)+'%' : '0%'],
        ['(=) MARGEM BRUTA OPERACIONAL', recs - (mat+mo+srv+eqp), recs > 0 ? (((recs - (mat+mo+srv+eqp))/recs)*100).toFixed(1)+'%' : '0%'],
        ['(−) Administrativo / Sede', adm, recs > 0 ? ((adm/recs)*100).toFixed(1)+'%' : '0%'],
        ['(−) Impostos e Tributos', imp, recs > 0 ? ((imp/recs)*100).toFixed(1)+'%' : '0%'],
        ['(=) RESULTADO LÍQUIDO', recs - (mat+mo+srv+eqp+adm+imp), recs > 0 ? (((recs - (mat+mo+srv+eqp+adm+imp))/recs)*100).toFixed(1)+'%' : '0%']
      ];
      addSheet(rows, 'DRE Gerencial');
    }
    if (tipo === 'fluxo') {
      const r = DB.getResumo(obraId === 'todas' ? null : obraId);
      let running = r.saldo || 0;
      const hoje = new Date();
      hoje.setHours(0,0,0,0);

      const rows = [
        ['EXTRATO DE FLUXO DE CAIXA PROJETADO (12 SEMANAS / 90 DIAS)','','','',''],
        ['Saldo Inicial Disponível:', running, '','',''],
        ['','','','',''],
        ['Semana', 'Período', 'Entradas Previstas (R$)', 'Saídas Previstas (R$)', 'Resultado Semanal (R$)', 'Saldo Acumulado (R$)']
      ];

      const lans = DB.getLancamentos(obraId === 'todas' ? null : obraId);
      for (let s = 0; s < 12; s++) {
        const dtIni = new Date(hoje); dtIni.setDate(hoje.getDate() + (s * 7));
        const dtFim = new Date(hoje); dtFim.setDate(hoje.getDate() + (s * 7) + 6);
        const iniStr = dtIni.toISOString().split('T')[0];
        const fimStr = dtFim.toISOString().split('T')[0];
        let rec = 0, desp = 0;
        lans.forEach(l => {
          const venc = l.data_vencimento || l.data;
          if (venc >= iniStr && venc <= fimStr) {
            if (l.tipo === 'receita' && (l.status === 'a_receber' || l.status === 'pendente')) rec += l.valor;
            if (l.tipo === 'despesa' && (l.status === 'a_pagar' || l.status === 'pendente')) desp += l.valor;
          }
        });
        const resSem = rec - desp;
        running += resSem;
        rows.push([`Sem ${s+1}`, `${dtIni.toLocaleDateString('pt-BR')} a ${dtFim.toLocaleDateString('pt-BR')}`, rec, desp, resSem, running]);
      }
      addSheet(rows, 'Fluxo de Caixa 90d');
    }

    const dataIso = new Date().toISOString().slice(0, 10);
    const tipoLabel = tipo === 'completo' ? 'Completo' : tipo.charAt(0).toUpperCase() + tipo.slice(1);
    const nomeArq = `Angelim_${safeNome}_${tipoLabel}_${dataIso}.xlsx`;

    // Download direto via Blob com nome garantido
    try {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArq;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      Utils.toast(`✅ Planilha "${nomeArq}" baixada com sucesso!`,'success');
    } catch(err) {
      console.warn('Fallback para XLSX.writeFile', err);
      XLSX.writeFile(wb, nomeArq);
    }
  },

  init() {}
};
