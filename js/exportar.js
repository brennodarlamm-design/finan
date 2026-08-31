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
            <option value="lancamentos">&#x1F4B0; Extrato de Lan&ccedil;amentos</option>
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
    const obraId = this.getObraId();
    const cs = obraId === 'todas' ? DB.getAll('clientes') : [DB.getById('clientes', obraId)].filter(Boolean);
    const clienteUnico = cs.length === 1 ? cs[0] : null;
    const emissao = new Date().toLocaleString('pt-BR');

    // Cabeçalho Institucional Angelim
    const docId = `ANG-${Date.now().toString(36).toUpperCase()}`;
    let html = `
    <style>
      /* ===== RESPONSIVIDADE MOBILE DOS RELATÓRIOS ===== */

      /* Scroll horizontal em todas as tabelas */
      .ang-tbl-wrap {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        border-radius: 4px;
      }
      .ang-tbl-wrap table {
        min-width: 600px;
      }
      /* SINAPI tem mais colunas — largura mínima maior */
      .ang-tbl-sinapi {
        min-width: 750px;
      }

      @media(max-width:600px) {
        .ang-header { flex-direction:column !important; gap:10px !important; }
        .ang-header-right { text-align:left !important; }
        .ang-client-grid { grid-template-columns:repeat(2,1fr) !important; }
        .ang-kpi-grid { grid-template-columns:repeat(2,1fr) !important; }
        .ang-title-row { flex-direction:column !important; align-items:flex-start !important; }
        .ang-sig-grid { grid-template-columns:1fr !important; gap:20px !important; }

        /* Cabeçalho de seção empilhado */
        .ang-section-header { flex-direction:column !important; align-items:flex-start !important; gap:6px !important; }

        /* Badges de totais em coluna */
        .ang-totals-row { display:flex; flex-wrap:wrap; gap:6px; }

        /* Fontes menores nas tabelas para caber mais */
        .ang-tbl-wrap td,
        .ang-tbl-wrap th { font-size:.7rem !important; padding:6px 7px !important; }

        /* SINAPI header card */
        .ang-sinapi-header { flex-direction:column !important; align-items:flex-start !important; gap:8px !important; }
      }
    </style>
    <div class="ang-header" style="border-bottom:2px solid #c9a227;padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <img src="img/logo.png" alt="Angelim Construtora" style="width:54px;height:54px;border-radius:8px;border:1px solid #c9a227;object-fit:cover;flex-shrink:0;">
        <div>
          <div style="font-size:1.2rem;font-weight:900;letter-spacing:1px;color:#0d1811;line-height:1.1;">ANGELIM CONSTRUTORA</div>
          <div style="font-size:.78rem;font-weight:700;color:#c9a227;text-transform:uppercase;letter-spacing:0.5px;">Gest&atilde;o Financeira &amp; Engenharia Civil</div>
        </div>
      </div>
      <div class="ang-header-right" style="text-align:right;font-size:.75rem;color:#334155;">
        <div><strong>Emiss&atilde;o:</strong> ${emissao}</div>
        <div><strong>Doc ID:</strong> ${docId}</div>
        <div style="color:#0f766e;font-weight:700;margin-top:2px;">&#x2714; Documento Oficial do Sistema</div>
      </div>
    </div>`;

    // Box de Dados do Cliente / Obra
    if (clienteUnico) {
      const c = clienteUnico;
      html += `
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #0f172a;border-radius:6px;padding:14px 18px;margin-bottom:20px;">
        <div style="font-size:.72rem;font-weight:900;text-transform:uppercase;color:#b45309;margin-bottom:8px;letter-spacing:0.5px;">Identifica&ccedil;&atilde;o da Obra e Contrato Caixa</div>
        <div class="ang-client-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-size:.82rem;">
          <div><span style="color:#475569;font-weight:700;font-size:.75rem;">Cliente / Obra:</span><br><strong style="color:#0f172a;font-size:.92rem;">${c.nome}</strong></div>
          <div><span style="color:#475569;font-weight:700;font-size:.75rem;">CPF / CNPJ:</span><br><strong style="color:#0f172a;">${c.cpf_cnpj || '&mdash;'}</strong></div>
          <div><span style="color:#475569;font-weight:700;font-size:.75rem;">Localiza&ccedil;&atilde;o:</span><br><strong style="color:#0f172a;">${c.cidade}/${c.estado}</strong></div>
          <div><span style="color:#475569;font-weight:700;font-size:.75rem;">Contrato Caixa:</span><br><strong style="color:#0284c7;font-size:.9rem;">${c.num_contrato_caixa || '&mdash;'}</strong></div>
          <div><span style="color:#475569;font-weight:700;font-size:.75rem;">Ag&ecirc;ncia Caixa:</span><br><strong style="color:#0f172a;">${c.agencia_caixa || '&mdash;'}</strong></div>
          <div><span style="color:#475569;font-weight:700;font-size:.75rem;">Valor Financiado:</span><br><strong style="color:#15803d;font-size:.92rem;">${Utils.fmt.currency(c.valor_financiado)}</strong></div>
          <div><span style="color:#475569;font-weight:700;font-size:.75rem;">Recursos Pr&oacute;prios:</span><br><strong style="color:#0f172a;">${Utils.fmt.currency(c.valor_proprio || 0)}</strong></div>
          <div><span style="color:#475569;font-weight:700;font-size:.75rem;">Engenheiro Resp.:</span><br><strong style="color:#0f172a;">${c.engenheiro_responsavel || '&mdash;'}</strong></div>
          <div><span style="color:#475569;font-weight:700;font-size:.75rem;">Status Atual:</span><br><span style="display:inline-block;padding:3px 8px;background:#e0f2fe;color:#0369a1;border-radius:6px;font-size:.75rem;font-weight:800;">${c.status}</span></div>
        </div>
      </div>`;
    } else {
      html += `
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #0f172a;border-radius:6px;padding:12px 18px;margin-bottom:20px;">
        <div style="font-size:.72rem;font-weight:900;text-transform:uppercase;color:#b45309;margin-bottom:4px;">Escopo do Relat&oacute;rio</div>
        <div style="font-size:.95rem;font-weight:800;color:#0f172a;">Consolidado Geral &mdash; Todas as Obras Cadastradas (${cs.length} obras)</div>
      </div>`;
    }

    // Conteúdo Específico por Tipo
    if (type === 'lancamentos') {
      const lans = DB.getLancamentos(obraId === 'todas' ? null : obraId);
      const totRec = lans.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
      const totDesp = lans.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
      const hoje = Utils.today();

      html += `
      <div class="ang-section-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <h2 style="font-size:1.05rem;font-weight:900;color:#0f172a;margin:0;">Extrato Financeiro de Lan&ccedil;amentos (${lans.length} registros)</h2>
        <div class="ang-totals-row" style="font-size:.82rem;">
          <span style="display:inline-block;background:#dcfce7;color:#15803d;padding:4px 10px;border-radius:4px;font-weight:800;margin-right:8px;">+ Receitas: ${Utils.fmt.currency(totRec)}</span>
          <span style="display:inline-block;background:#fee2e2;color:#b91c1c;padding:4px 10px;border-radius:4px;font-weight:800;">- Despesas: ${Utils.fmt.currency(totDesp)}</span>
        </div>
      </div>
      <div class="ang-tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:.78rem;margin-bottom:24px;color:#0f172a;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;text-align:left;">
            <th style="padding:9px 10px;border-top-left-radius:4px;color:#ffffff;">Emiss&atilde;o</th>
            <th style="padding:9px 10px;color:#ffffff;">Vencimento</th>
            <th style="padding:9px 10px;color:#ffffff;">Data Pagto/Rec.</th>
            <th style="padding:9px 10px;color:#ffffff;">Obra</th>
            <th style="padding:9px 10px;text-align:center;color:#ffffff;">Tipo</th>
            <th style="padding:9px 10px;color:#ffffff;">Categoria</th>
            <th style="padding:9px 10px;color:#ffffff;">Descri&ccedil;&atilde;o</th>
            <th style="padding:9px 10px;color:#ffffff;">Benefici&aacute;rio / Conta</th>
            <th style="padding:9px 10px;text-align:right;color:#ffffff;">Valor</th>
            <th style="padding:9px 10px;text-align:center;border-top-right-radius:4px;color:#ffffff;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${lans.map((l, i) => {
            const c = l.obra_id === 'escritorio' ? { nome: '🏢 Sede / Escritório' } : DB.getById('clientes', l.obra_id);
            const isRec = l.tipo === 'receita';
            const venc = l.data_vencimento || l.data;
            const isAtrasado = (l.status==='a_pagar'||l.status==='a_receber') && venc < hoje;
            const isBaixado = l.status === 'pago' || l.status === 'recebido';
            const statusBg = isAtrasado ? '#fee2e2' : (isBaixado ? '#dcfce7' : '#fef3c7');
            const statusColor = isAtrasado ? '#991b1b' : (isBaixado ? '#15803d' : '#92400e');
            const statusTxt = isAtrasado ? 'Atrasado' : l.status;
            const dtPagFmt = isBaixado ? Utils.fmt.date(l.data_pagamento || l.data) : '&mdash;';

            return `
            <tr style="background:${i%2===0?'#ffffff':'#f8fafc'};border-bottom:1px solid #cbd5e1;">
              <td style="padding:8px 10px;font-weight:700;color:#0f172a;white-space:nowrap;">${Utils.fmt.date(l.data)}</td>
              <td style="padding:8px 10px;font-weight:800;color:${isAtrasado?'#b91c1c':'#0284c7'};white-space:nowrap;">${Utils.fmt.date(venc)}</td>
              <td style="padding:8px 10px;font-weight:700;color:#15803d;white-space:nowrap;">${dtPagFmt}</td>
              <td style="padding:8px 10px;color:#1e293b;font-weight:700;">${c?.nome||'&mdash;'}</td>
              <td style="padding:8px 10px;text-align:center;">
                <span style="display:inline-block;padding:3px 8px;border-radius:4px;font-weight:800;font-size:.7rem;background:${isRec?'#dcfce7':'#fee2e2'};color:${isRec?'#15803d':'#b91c1c'};">${isRec?'RECEITA':'DESPESA'}</span>
              </td>
              <td style="padding:8px 10px;color:#334155;font-weight:700;">${Utils.catLabel(l.categoria)||l.categoria||'&mdash;'}</td>
              <td style="padding:8px 10px;font-weight:700;color:#0f172a;">${l.descricao}</td>
              <td style="padding:8px 10px;color:#334155;">
                <div style="font-weight:700;color:#0f172a;">${l.fornecedor_beneficiario||'&mdash;'}</div>
                ${l.conta_bancaria ? `<div style="font-size:.7rem;color:#475569;font-weight:600;">&#x1F3E6; ${l.conta_bancaria}</div>` : ''}
              </td>
              <td style="padding:8px 10px;text-align:right;font-weight:900;font-size:.85rem;color:${isRec?'#15803d':'#b91c1c'};white-space:nowrap;">
                ${isRec?'+':'-'} ${Utils.fmt.currency(l.valor)}
              </td>
              <td style="padding:8px 10px;text-align:center;">
                <span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:.72rem;font-weight:800;background:${statusBg};color:${statusColor};border:1px solid rgba(0,0,0,0.06);">${statusTxt}</span>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;
    } else if (type === 'notas') {
      const nfs = obraId === 'todas' ? DB.getAll('notas') : DB.getAll('notas').filter(n => n.obra_id === obraId);
      const totBruto = nfs.reduce((s, n) => s + (n.valor_bruto || 0), 0);
      const totLiq = nfs.reduce((s, n) => s + (n.valor_liquido || 0), 0);

      html += `
      <div class="ang-section-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <h2 style="font-size:1.05rem;font-weight:900;color:#0f172a;margin:0;">Relat&oacute;rio de Notas Fiscais Emitidas / Recebidas (${nfs.length} NFs)</h2>
        <div style="font-size:.82rem;">
          <span style="display:inline-block;background:#f1f5f9;color:#0f172a;padding:4px 10px;border-radius:4px;font-weight:800;margin-right:8px;border:1px solid #cbd5e1;">Total Bruto: ${Utils.fmt.currency(totBruto)}</span>
          <span style="display:inline-block;background:#dcfce7;color:#15803d;padding:4px 10px;border-radius:4px;font-weight:800;">Total L&iacute;quido: ${Utils.fmt.currency(totLiq)}</span>
        </div>
      </div>
      <div class="ang-tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:.78rem;margin-bottom:24px;color:#0f172a;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;text-align:left;">
            <th style="padding:9px 10px;border-top-left-radius:4px;color:#ffffff;">N&ordm; NF / S&eacute;rie</th>
            <th style="padding:9px 10px;color:#ffffff;">Emiss&atilde;o</th>
            <th style="padding:9px 10px;color:#ffffff;">Vencimento</th>
            <th style="padding:9px 10px;color:#ffffff;">Data Pagamento</th>
            <th style="padding:9px 10px;color:#ffffff;">Obra</th>
            <th style="padding:9px 10px;color:#ffffff;">Emitente / Fornecedor</th>
            <th style="padding:9px 10px;color:#ffffff;">Categoria</th>
            <th style="padding:9px 10px;text-align:right;color:#ffffff;">Valor Bruto</th>
            <th style="padding:9px 10px;text-align:right;color:#ffffff;">Valor L&iacute;quido</th>
            <th style="padding:9px 10px;text-align:center;border-top-right-radius:4px;color:#ffffff;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${nfs.map((n, i) => {
            const c = n.obra_id === 'escritorio' ? { nome: '🏢 Sede / Escritório' } : DB.getById('clientes', n.obra_id);
            const isPaga = n.status === 'paga';
            const dtPagFmt = isPaga ? Utils.fmt.date(n.data_pagamento || n.data_emissao) : '&mdash;';
            return `
            <tr style="background:${i%2===0?'#ffffff':'#f8fafc'};border-bottom:1px solid #cbd5e1;">
              <td style="padding:8px 10px;font-weight:800;color:#0284c7;">#${n.numero_nf} <span style="font-size:.7rem;color:#475569;">(${n.serie||'001'})</span></td>
              <td style="padding:8px 10px;font-weight:700;color:#0f172a;">${Utils.fmt.date(n.data_emissao)}</td>
              <td style="padding:8px 10px;font-weight:700;color:#0f172a;">${Utils.fmt.date(n.data_vencimento)}</td>
              <td style="padding:8px 10px;font-weight:700;color:#15803d;white-space:nowrap;">${dtPagFmt}</td>
              <td style="padding:8px 10px;color:#1e293b;font-weight:700;">${c?.nome||'&mdash;'}</td>
              <td style="padding:8px 10px;color:#0f172a;font-weight:700;">${n.emitente}</td>
              <td style="padding:8px 10px;color:#334155;font-weight:700;">${Utils.catLabel(n.categoria)||n.categoria||'&mdash;'}</td>
              <td style="padding:8px 10px;text-align:right;font-weight:800;color:#0f172a;">${Utils.fmt.currency(n.valor_bruto)}</td>
              <td style="padding:8px 10px;text-align:right;font-weight:900;color:#15803d;">${Utils.fmt.currency(n.valor_liquido)}</td>
              <td style="padding:8px 10px;text-align:center;">
                <span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:.72rem;font-weight:800;background:${isPaga?'#dcfce7':'#fef3c7'};color:${isPaga?'#15803d':'#92400e'};">${n.status}</span>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;
    } else if (type === 'medicoes') {
      const meds = obraId === 'todas' ? DB.getAll('medicoes') : DB.getAll('medicoes').filter(m => m.obra_id === obraId);
      const totSol = meds.reduce((s, m) => s + (m.valor_solicitado || 0), 0);
      const totLib = meds.reduce((s, m) => s + (m.valor_liberado || 0), 0);

      html += `
      <div class="ang-section-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <h2 style="font-size:1.05rem;font-weight:900;color:#0f172a;margin:0;">Cronograma de Medi&ccedil;&otilde;es e Libera&ccedil;&otilde;es Caixa (${meds.length} medi&ccedil;&otilde;es)</h2>
        <div class="ang-totals-row" style="font-size:.82rem;">
          <span style="display:inline-block;background:#f1f5f9;color:#0f172a;padding:4px 10px;border-radius:4px;font-weight:800;margin-right:8px;border:1px solid #cbd5e1;">Solicitado: ${Utils.fmt.currency(totSol)}</span>
          <span style="display:inline-block;background:#dcfce7;color:#15803d;padding:4px 10px;border-radius:4px;font-weight:800;">Liberado: ${Utils.fmt.currency(totLib)}</span>
        </div>
      </div>
      <div class="ang-tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:.78rem;margin-bottom:24px;color:#0f172a;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;text-align:left;">
            <th style="padding:9px 10px;border-top-left-radius:4px;color:#ffffff;">N&ordm; Med.</th>
            <th style="padding:9px 10px;color:#ffffff;">Obra</th>
            <th style="padding:9px 10px;color:#ffffff;">Etapa Conclu&iacute;da</th>
            <th style="padding:9px 10px;text-align:center;color:#ffffff;">% F&iacute;sico</th>
            <th style="padding:9px 10px;text-align:right;color:#ffffff;">Solicitado</th>
            <th style="padding:9px 10px;text-align:right;color:#ffffff;">Liberado</th>
            <th style="padding:9px 10px;text-align:center;color:#ffffff;">Status Caixa</th>
            <th style="padding:9px 10px;border-top-right-radius:4px;color:#ffffff;">Data Libera&ccedil;&atilde;o</th>
          </tr>
        </thead>
        <tbody>
          ${meds.map((m, i) => {
            const c = DB.getById('clientes', m.obra_id);
            const isLib = m.status === 'liberada';
            return `
            <tr style="background:${i%2===0?'#ffffff':'#f8fafc'};border-bottom:1px solid #cbd5e1;">
              <td style="padding:8px 10px;font-weight:900;color:#0f172a;">${m.numero_medicao}&ordf; Med.</td>
              <td style="padding:8px 10px;color:#1e293b;font-weight:700;">${c?.nome||'&mdash;'}</td>
              <td style="padding:8px 10px;font-weight:700;color:#0f172a;">${m.etapa_descricao}</td>
              <td style="padding:8px 10px;text-align:center;font-weight:900;color:#0284c7;">${m.percentual_fisico}%</td>
              <td style="padding:8px 10px;text-align:right;font-weight:800;color:#0f172a;">${Utils.fmt.currency(m.valor_solicitado)}</td>
              <td style="padding:8px 10px;text-align:right;font-weight:900;color:#15803d;">${m.valor_liberado ? Utils.fmt.currency(m.valor_liberado) : '&mdash;'}</td>
              <td style="padding:8px 10px;text-align:center;"><span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:.72rem;font-weight:800;background:${isLib?'#dcfce7':'#fef3c7'};color:${isLib?'#15803d':'#92400e'};">${m.status}</span></td>
              <td style="padding:8px 10px;color:#0f172a;font-weight:700;">${m.data_liberacao ? Utils.fmt.date(m.data_liberacao) : '&mdash;'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;
    } else if (type === 'orcamentos') {
      const orcs = obraId === 'todas' ? DB.getAll('orcamentos') : DB.getAll('orcamentos').filter(o => o.obra_id === obraId);
      const totOrc = orcs.reduce((s, o) => s + (o.valor_orcado || 0), 0);
      const totExec = orcs.reduce((s, o) => s + (o.valor_executado || 0), 0);
      const saldoGeral = totOrc - totExec;

      html += `
      <div class="ang-section-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <h2 style="font-size:1.05rem;font-weight:900;color:#0f172a;margin:0;">Controle Or&ccedil;ament&aacute;rio Previsto &times; Realizado (${orcs.length} etapas)</h2>
        <div class="ang-totals-row" style="font-size:.82rem;">
          <span style="display:inline-block;background:#f1f5f9;color:#0f172a;padding:4px 10px;border-radius:4px;font-weight:800;margin-right:8px;border:1px solid #cbd5e1;">Or&ccedil;ado: ${Utils.fmt.currency(totOrc)}</span>
          <span style="display:inline-block;background:#fee2e2;color:#b91c1c;padding:4px 10px;border-radius:4px;font-weight:800;margin-right:8px;">Executado: ${Utils.fmt.currency(totExec)}</span>
          <span style="display:inline-block;background:#dcfce7;color:#15803d;padding:4px 10px;border-radius:4px;font-weight:800;">Saldo: ${Utils.fmt.currency(saldoGeral)}</span>
        </div>
      </div>
      <div class="ang-tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:.78rem;margin-bottom:24px;color:#0f172a;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;text-align:left;">
            <th style="padding:9px 10px;border-top-left-radius:4px;color:#ffffff;">Obra</th>
            <th style="padding:9px 10px;color:#ffffff;">Etapa Construtiva</th>
            <th style="padding:9px 10px;text-align:right;color:#ffffff;">Valor Or&ccedil;ado</th>
            <th style="padding:9px 10px;text-align:right;color:#ffffff;">Valor Executado</th>
            <th style="padding:9px 10px;text-align:right;color:#ffffff;">Saldo / Desvio</th>
            <th style="padding:9px 10px;text-align:center;color:#ffffff;">% Execu&ccedil;&atilde;o</th>
            <th style="padding:9px 10px;text-align:center;border-top-right-radius:4px;color:#ffffff;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${orcs.map((o, i) => {
            const c = DB.getById('clientes', o.obra_id);
            const saldo = (o.valor_orcado || 0) - (o.valor_executado || 0);
            const pct = o.valor_orcado > 0 ? Math.round((o.valor_executado / o.valor_orcado) * 100) : 0;
            return `
            <tr style="background:${i%2===0?'#ffffff':'#f8fafc'};border-bottom:1px solid #cbd5e1;">
              <td style="padding:8px 10px;color:#1e293b;font-weight:700;">${c?.nome||'&mdash;'}</td>
              <td style="padding:8px 10px;font-weight:800;color:#0f172a;">${o.etapa}</td>
              <td style="padding:8px 10px;text-align:right;font-weight:800;color:#0f172a;">${Utils.fmt.currency(o.valor_orcado)}</td>
              <td style="padding:8px 10px;text-align:right;font-weight:800;color:#b91c1c;">${Utils.fmt.currency(o.valor_executado)}</td>
              <td style="padding:8px 10px;text-align:right;font-weight:900;color:${saldo>=0?'#15803d':'#b91c1c'};">${Utils.fmt.currency(saldo)}</td>
              <td style="padding:8px 10px;text-align:center;font-weight:900;color:#0284c7;">${pct}%</td>
              <td style="padding:8px 10px;text-align:center;">
                <span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:.72rem;font-weight:800;background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;">${o.status||'em_andamento'}</span>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;
    } else if (type === 'sinapi') {
      const sinapiOrcs = typeof OrcamentoSINAPI !== 'undefined' ? OrcamentoSINAPI._getAll(obraId) : [];
      html += `
      <div style="margin-bottom:14px;"><h2 style="font-size:1.05rem;font-weight:900;color:#0f172a;margin:0;">Planilhas Or&ccedil;ament&aacute;rias Referenciais SINAPI (${sinapiOrcs.length} planilhas)</h2></div>
      ${sinapiOrcs.map(o => {
        const bdiFator = 1 + ((parseFloat(o.bdi_percentual || o.bdi) || 0) / 100);
        const totSem = (o.itens || []).reduce((s, it) => s + ((parseFloat(it.quantidade)||0) * (parseFloat(it.custo_unitario || it.preco_unitario)||0)), 0);
        const totCom = totSem * bdiFator;
        const c = DB.getById('clientes', o.obra_id);

        return `
        <div style="margin-bottom:24px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div class="ang-sinapi-header" style="background:#0f172a;color:#ffffff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div style="flex:1;min-width:0;">
              <strong style="color:#ffffff;font-size:1rem;font-weight:800;">${o.nome}</strong>
              <div style="color:#94a3b8;font-size:.78rem;margin-top:2px;flex-wrap:wrap;">
                <span>👤 ${c?.nome || 'Obra Geral'}</span> &middot;
                <span>Ref: ${o.referencia_sinapi||'&mdash;'} (${o.uf||'RR'})</span> &middot;
                <span>BDI: ${o.bdi_percentual || o.bdi}%</span> &middot;
                <span>${o.desonerado ? '🟡 Sem Oneração' : '🟢 Com Oneração'}</span>
              </div>
            </div>
            <div style="background:#22c55e;color:#052e16;padding:6px 14px;border-radius:6px;font-size:.92rem;font-weight:900;white-space:nowrap;">
              Total: ${Utils.fmt.currency(totCom)}
            </div>
          </div>
          <div class="ang-tbl-wrap"><table class="ang-tbl-sinapi" style="width:100%;border-collapse:collapse;font-size:.76rem;color:#0f172a;">
            <thead>
              <tr style="background:#1e293b;color:#ffffff;text-align:left;">
                <th style="padding:8px 10px;color:#ffffff;width:80px;">C&oacute;digo</th>
                <th style="padding:8px 10px;color:#ffffff;">Descri&ccedil;&atilde;o do Servi&ccedil;o</th>
                <th style="padding:8px 10px;text-align:center;color:#ffffff;width:55px;">Unid.</th>
                <th style="padding:8px 10px;text-align:right;color:#ffffff;width:65px;">Qtd.</th>
                <th style="padding:8px 10px;text-align:right;color:#ffffff;width:95px;">Custo Unit.</th>
                <th style="padding:8px 10px;text-align:right;color:#ffffff;width:110px;">Total Sem BDI</th>
                <th style="padding:8px 10px;text-align:right;color:#ffffff;width:115px;">Total Com BDI</th>
              </tr>
            </thead>
            <tbody>
              ${(o.itens||[]).map((it, idx) => {
                const pu = parseFloat(it.custo_unitario || it.preco_unitario) || 0;
                const qtd = parseFloat(it.quantidade) || 0;
                const subSem = qtd * pu;
                const subCom = subSem * bdiFator;
                return `
                <tr style="background:${idx%2===0?'#ffffff':'#f8fafc'};border-bottom:1px solid #cbd5e1;">
                  <td style="padding:7px 10px;font-weight:800;color:#0284c7;white-space:nowrap;">${it.codigo_sinapi || it.codigo}</td>
                  <td style="padding:7px 10px;font-weight:700;color:#0f172a;line-height:1.3;">${it.descricao}</td>
                  <td style="padding:7px 10px;text-align:center;color:#334155;font-weight:700;">${it.unidade}</td>
                  <td style="padding:7px 10px;text-align:right;font-weight:800;color:#0f172a;">${it.quantidade}</td>
                  <td style="padding:7px 10px;text-align:right;font-weight:700;color:#0f172a;">${Utils.fmt.currency(pu)}</td>
                  <td style="padding:7px 10px;text-align:right;font-weight:700;color:#334155;">${Utils.fmt.currency(subSem)}</td>
                  <td style="padding:7px 10px;text-align:right;font-weight:900;color:#0f172a;font-size:.82rem;">${Utils.fmt.currency(subCom)}</td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f1f5f9;border-top:2px solid #cbd5e1;">
                <td colspan="5" style="padding:8px 10px;text-align:right;font-weight:800;color:#334155;">Subtotal Direto:</td>
                <td style="padding:8px 10px;text-align:right;font-weight:800;color:#334155;">${Utils.fmt.currency(totSem)}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:900;color:#0f172a;">${Utils.fmt.currency(totCom)}</td>
              </tr>
            </tfoot>
          </table></div>
        </div>`;
      }).join('')}`;
    } else {
      // Relatório Executivo Completo
      html += `
      <div style="margin-bottom:14px;"><h2 style="font-size:1.05rem;font-weight:900;color:#0f172a;margin:0;">Demonstrativo Financeiro Consolidado</h2></div>
      ${cs.map(c => {
        const r = DB.getResumo(c.id);
        const lans = DB.getLancamentos(c.id);
        const meds = DB.getAll('medicoes').filter(m => m.obra_id === c.id);
        return `
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:18px;margin-bottom:22px;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div class="ang-title-row" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:2px solid #f1f5f9;padding-bottom:10px;flex-wrap:wrap;gap:6px;">
            <div style="font-weight:900;font-size:1rem;color:#0f172a;">${c.nome} &mdash; ${c.cidade}/${c.estado}</div>
            <div style="font-size:.8rem;color:#334155;font-weight:700;">Contrato Caixa: <strong style="color:#0284c7;">${c.num_contrato_caixa||'&mdash;'}</strong></div>
          </div>
          <div class="ang-kpi-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
            <div style="background:#f8fafc;padding:12px;border:1px solid #cbd5e1;border-radius:6px;text-align:center;">
              <div style="font-size:.7rem;color:#475569;font-weight:800;text-transform:uppercase;">Receitas Totais</div>
              <div style="font-size:1.15rem;font-weight:900;color:#15803d;margin-top:2px;">${Utils.fmt.currency(r.totalReceitas)}</div>
            </div>
            <div style="background:#f8fafc;padding:12px;border:1px solid #cbd5e1;border-radius:6px;text-align:center;">
              <div style="font-size:.7rem;color:#475569;font-weight:800;text-transform:uppercase;">Despesas Totais</div>
              <div style="font-size:1.15rem;font-weight:900;color:#b91c1c;margin-top:2px;">${Utils.fmt.currency(r.totalDespesas)}</div>
            </div>
            <div style="background:#f8fafc;padding:12px;border:1px solid #cbd5e1;border-radius:6px;text-align:center;">
              <div style="font-size:.7rem;color:#475569;font-weight:800;text-transform:uppercase;">Saldo Atual</div>
              <div style="font-size:1.15rem;font-weight:900;color:${r.saldo>=0?'#15803d':'#b91c1c'};margin-top:2px;">${Utils.fmt.currency(r.saldo)}</div>
            </div>
            <div style="background:#f8fafc;padding:12px;border:1px solid #cbd5e1;border-radius:6px;text-align:center;">
              <div style="font-size:.7rem;color:#475569;font-weight:800;text-transform:uppercase;">A Pagar Pendente</div>
              <div style="font-size:1.15rem;font-weight:900;color:#b45309;margin-top:2px;">${Utils.fmt.currency(r.aPagarValor)}</div>
            </div>
          </div>
          <div style="font-size:.8rem;color:#334155;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:8px;">
            <span><strong style="color:#0f172a;">${lans.length}</strong> lan&ccedil;amentos cont&aacute;beis computados</span>
            <span><strong style="color:#0f172a;">${meds.length}</strong> medi&ccedil;&otilde;es Caixa vinculadas</span>
          </div>
        </div>`;
      }).join('')}`;
    }

    // Assinaturas e Rodapé Institucional
    html += `
    <div style="margin-top:40px;border-top:1px solid #cbd5e1;padding-top:24px;">
      <div class="ang-sig-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:20px;text-align:center;font-size:.8rem;">
        <div>
          <div style="border-bottom:1px solid #94a3b8;margin-bottom:6px;height:30px;"></div>
          <strong style="color:#0f172a;">${clienteUnico?.engenheiro_responsavel || 'Engenheiro Responsável Técnico'}</strong><br>
          <span style="color:#64748b;font-size:.72rem;">CREA / Responsabilidade Técnica</span>
        </div>
        <div>
          <div style="border-bottom:1px solid #94a3b8;margin-bottom:6px;height:30px;"></div>
          <strong style="color:#0f172a;">Angelim Construtora LTDA</strong><br>
          <span style="color:#64748b;font-size:.72rem;">Gestão Financeira e Administrativa</span>
        </div>
      </div>
      <div style="font-size:.7rem;color:#94a3b8;text-align:center;border-top:1px dashed #e2e8f0;padding-top:10px;">
        Angelim Construtora &middot; Sistema de Gest&atilde;o de Obras Financiadas Caixa &middot; Documento v&aacute;lido para fins de acompanhamento gerencial.
      </div>
    </div>`;

    return html;
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
          <title>Relatório Angelim Construtora</title>
          <meta charset="utf-8">
          <style>
            @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
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
            .sheet { background: #fff; max-width: 900px; width: 100%; padding: 40px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; padding: 0; max-width: 100%; } }
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
