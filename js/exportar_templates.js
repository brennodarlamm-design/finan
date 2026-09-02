// js/exportar_templates.js — Gerador de Templates HTML Executivos A4 para Impressão e Relatórios
// Suporta: Lancamentos, Escritorio/Sede, Notas, Medicoes, Orcamentos, SINAPI, DRE e Fluxo 90d

const ExportarTemplates = {
  gerar(type, obraId) {
    const cs = obraId === 'todas' ? DB.getAll('clientes') : [DB.getById('clientes', obraId)].filter(Boolean);
    const clienteUnico = cs.length === 1 ? cs[0] : null;
    const emissao = new Date().toLocaleString('pt-BR');
    const emp = DB.getEmpresa();
    const empNome = emp.nome_fantasia || emp.razao_social || 'Angelim Construtora';
    const logoHtml = emp.logo_url 
      ? `<img src="${emp.logo_url}" alt="${empNome}" style="max-height:48px;max-width:120px;object-fit:contain;">` 
      : `<div style="width:44px;height:44px;border-radius:8px;background:#182713;border:1px solid #c9a227;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">🏢</div>`;

    // Cabeçalho Institucional Angelim
    const docId = `ANG-${Date.now().toString(36).toUpperCase()}`;
    let html = `
    <style>
      /* ===== RESPONSIVIDADE MOBILE DOS RELATÓRIOS ===== */
      @media print {
        .ang-doc-container { padding: 0 !important; box-shadow: none !important; }
      }

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
        ${logoHtml}
        <div>
          <div style="font-size:1.2rem;font-weight:900;letter-spacing:1px;color:#0d1811;line-height:1.1;">${empNome.toUpperCase()}</div>
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
    } else if (type === 'escritorio') {
      const todosLans = DB.getLancamentos(null);
      const lans = todosLans.filter(l => l.obra_id === 'escritorio' && l.tipo === 'despesa');
      lans.sort((a, b) => b.data.localeCompare(a.data));
      const hoje = Utils.today();

      const totDesp = lans.reduce((s, l) => s + l.valor, 0);
      const totPago = lans.filter(l => l.status === 'pago').reduce((s, l) => s + l.valor, 0);
      const totPendente = lans.filter(l => l.status === 'a_pagar').reduce((s, l) => s + l.valor, 0);
      const totAtrasado = lans.filter(l => l.status === 'a_pagar' && (l.data_vencimento || l.data) < hoje).reduce((s, l) => s + l.valor, 0);

      const porCat = {};
      lans.forEach(l => {
        const cat = Utils.catLabel(l.categoria) || l.categoria || 'Outros';
        porCat[cat] = (porCat[cat] || 0) + l.valor;
      });
      const catRows = Object.entries(porCat).sort((a, b) => b[1] - a[1]);

      html += `
      <div class="ang-section-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <h2 style="font-size:1.05rem;font-weight:900;color:#0f172a;margin:0;">&#x1F3E2; Despesas do Escritório / Sede (${lans.length} lançamentos)</h2>
        <div class="ang-totals-row" style="font-size:.82rem;display:flex;flex-wrap:wrap;gap:6px;">
          <span style="display:inline-block;background:#fee2e2;color:#b91c1c;padding:4px 10px;border-radius:4px;font-weight:800;">Total: ${Utils.fmt.currency(totDesp)}</span>
          <span style="display:inline-block;background:#dcfce7;color:#15803d;padding:4px 10px;border-radius:4px;font-weight:800;">Pago: ${Utils.fmt.currency(totPago)}</span>
          <span style="display:inline-block;background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:4px;font-weight:800;">Pendente: ${Utils.fmt.currency(totPendente)}</span>
          ${totAtrasado > 0 ? `<span style="display:inline-block;background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:4px;font-weight:800;border:1px solid #fca5a5;">&#x26A0; Atrasado: ${Utils.fmt.currency(totAtrasado)}</span>` : ''}
        </div>
      </div>

      ${catRows.length > 0 ? `
      <div style="margin-bottom:18px;">
        <div style="font-size:.72rem;font-weight:900;text-transform:uppercase;color:#b45309;margin-bottom:8px;letter-spacing:.5px;">Resumo por Categoria</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${catRows.map(([cat, val]) => `
            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 14px;min-width:140px;">
              <div style="font-size:.72rem;color:#475569;font-weight:700;">${cat}</div>
              <div style="font-size:.95rem;font-weight:900;color:#b91c1c;margin-top:2px;">${Utils.fmt.currency(val)}</div>
              <div style="font-size:.65rem;color:#94a3b8;margin-top:1px;">${((val/totDesp)*100).toFixed(1)}% do total</div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="ang-tbl-wrap"><table style="width:100%;border-collapse:collapse;font-size:.78rem;margin-bottom:24px;color:#0f172a;">
        <thead>
          <tr style="background:#7c3aed;color:#ffffff;text-align:left;">
            <th style="padding:9px 10px;border-top-left-radius:4px;color:#ffffff;">Emissão</th>
            <th style="padding:9px 10px;color:#ffffff;">Vencimento</th>
            <th style="padding:9px 10px;color:#ffffff;">Pago em</th>
            <th style="padding:9px 10px;color:#ffffff;">Categoria</th>
            <th style="padding:9px 10px;color:#ffffff;">Descrição</th>
            <th style="padding:9px 10px;color:#ffffff;">Beneficiário / Conta</th>
            <th style="padding:9px 10px;text-align:right;color:#ffffff;">Valor</th>
            <th style="padding:9px 10px;text-align:center;border-top-right-radius:4px;color:#ffffff;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${lans.map((l, i) => {
            const venc = l.data_vencimento || l.data;
            const isAtrasado = l.status === 'a_pagar' && venc < hoje;
            const isBaixado = l.status === 'pago';
            const statusBg = isAtrasado ? '#fee2e2' : (isBaixado ? '#dcfce7' : '#fef3c7');
            const statusColor = isAtrasado ? '#991b1b' : (isBaixado ? '#15803d' : '#92400e');
            const statusTxt = isAtrasado ? 'Atrasado' : l.status;
            const dtPagFmt = isBaixado ? Utils.fmt.date(l.data_pagamento || l.data) : '&mdash;';
            return `
            <tr style="background:${i%2===0?'#ffffff':'#faf5ff'};border-bottom:1px solid #cbd5e1;">
              <td style="padding:8px 10px;font-weight:700;color:#0f172a;white-space:nowrap;">${Utils.fmt.date(l.data)}</td>
              <td style="padding:8px 10px;font-weight:800;color:${isAtrasado?'#b91c1c':'#0284c7'};white-space:nowrap;">${Utils.fmt.date(venc)}</td>
              <td style="padding:8px 10px;font-weight:700;color:#15803d;white-space:nowrap;">${dtPagFmt}</td>
              <td style="padding:8px 10px;color:#334155;font-weight:700;">${Utils.catLabel(l.categoria)||l.categoria||'&mdash;'}</td>
              <td style="padding:8px 10px;font-weight:700;color:#0f172a;">${l.descricao}</td>
              <td style="padding:8px 10px;color:#334155;">
                <div style="font-weight:700;color:#0f172a;">${l.fornecedor_beneficiario||'&mdash;'}</div>
                ${l.conta_bancaria ? `<div style="font-size:.7rem;color:#475569;font-weight:600;">&#x1F3E6; ${l.conta_bancaria}</div>` : ''}
              </td>
              <td style="padding:8px 10px;text-align:right;font-weight:900;font-size:.85rem;color:#b91c1c;white-space:nowrap;">- ${Utils.fmt.currency(l.valor)}</td>
              <td style="padding:8px 10px;text-align:center;">
                <span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:.72rem;font-weight:800;background:${statusBg};color:${statusColor};border:1px solid rgba(0,0,0,0.06);">${statusTxt}</span>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#f3e8ff;border-top:2px solid #7c3aed;">
            <td colspan="6" style="padding:9px 10px;font-weight:900;color:#5b21b6;font-size:.8rem;">TOTAL GERAL — ${lans.length} despesas do escritório</td>
            <td style="padding:9px 10px;text-align:right;font-weight:900;color:#b91c1c;font-size:.92rem;">- ${Utils.fmt.currency(totDesp)}</td>
            <td></td>
          </tr>
        </tfoot>
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
    } else if (type === 'dre') {
      const todosLans = obraId === 'todas' ? DB.getAll('lancamentos') : DB.getLancamentos(obraId);
      const recs = todosLans.filter(l => l.tipo === 'receita').reduce((s,l) => s + l.valor, 0);
      const mat  = todosLans.filter(l => l.tipo === 'despesa' && l.categoria === 'material').reduce((s,l) => s + l.valor, 0);
      const mo   = todosLans.filter(l => l.tipo === 'despesa' && l.categoria === 'mao_de_obra').reduce((s,l) => s + l.valor, 0);
      const srv  = todosLans.filter(l => l.tipo === 'despesa' && l.categoria === 'servico').reduce((s,l) => s + l.valor, 0);
      const eqp  = todosLans.filter(l => l.tipo === 'despesa' && l.categoria === 'equipamento').reduce((s,l) => s + l.valor, 0);
      const adm  = todosLans.filter(l => l.tipo === 'despesa' && (l.categoria === 'administrativo' || l.obra_id === 'escritorio')).reduce((s,l) => s + l.valor, 0);
      const imp  = todosLans.filter(l => l.tipo === 'despesa' && l.categoria === 'impostos').reduce((s,l) => s + l.valor, 0);
      const out  = todosLans.filter(l => l.tipo === 'despesa' && !['material','mao_de_obra','servico','equipamento','administrativo','impostos'].includes(l.categoria) && l.obra_id !== 'escritorio').reduce((s,l) => s + l.valor, 0);

      const custosDiretos = mat + mo + srv + eqp;
      const margemBruta = recs - custosDiretos;
      const margemBrutaPct = recs > 0 ? ((margemBruta / recs) * 100).toFixed(1) : '0.0';
      const despesasTotais = custosDiretos + adm + imp + out;
      const lucroLiquido = recs - despesasTotais;
      const margemLiqPct = recs > 0 ? ((lucroLiquido / recs) * 100).toFixed(1) : '0.0';

      html += `
      <div style="margin-bottom:18px;">
        <h2 style="font-size:1.05rem;font-weight:900;color:#0f172a;margin:0;">📊 DRE Gerencial — Demonstrativo de Resultado</h2>
        <div style="font-size:.78rem;color:#475569;margin-top:2px;">Centro de custo: <strong>${clienteUnico ? clienteUnico.nome : 'Todas as Obras (Consolidado)'}</strong></div>
      </div>
      <div class="ang-tbl-wrap" style="margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
          <thead>
            <tr style="background:#0f172a;color:#fff;">
              <th style="padding:10px 14px;text-align:left;">Conta Contábil / Descrição</th>
              <th style="padding:10px 14px;text-align:right;width:150px;">Valor (R$)</th>
              <th style="padding:10px 14px;text-align:right;width:100px;">% Receita</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:#f0fdf4;border-bottom:2px solid #86efac;font-weight:900;">
              <td style="padding:10px 14px;color:#15803d;">(+) RECEITA OPERACIONAL BRUTA</td>
              <td style="padding:10px 14px;text-align:right;color:#15803d;font-size:.95rem;">${Utils.fmt.currency(recs)}</td>
              <td style="padding:10px 14px;text-align:right;color:#15803d;">100.0%</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 14px;padding-left:28px;color:#475569;">&bull; Medições de Obras Liberadas e Faturadas</td>
              <td style="padding:8px 14px;text-align:right;color:#334155;">${Utils.fmt.currency(recs)}</td>
              <td style="padding:8px 14px;text-align:right;color:#64748b;">100.0%</td>
            </tr>
            <tr style="background:#fef2f2;border-top:2px solid #fca5a5;font-weight:800;">
              <td style="padding:9px 14px;color:#b91c1c;">(−) CUSTOS DIRETOS DE PRODUÇÃO / OBRAS</td>
              <td style="padding:9px 14px;text-align:right;color:#b91c1c;">${Utils.fmt.currency(custosDiretos)}</td>
              <td style="padding:9px 14px;text-align:right;color:#b91c1c;">${recs>0?((custosDiretos/recs)*100).toFixed(1):'0.0'}%</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:7px 14px;padding-left:28px;color:#475569;">&bull; Materiais de Construção</td>
              <td style="padding:7px 14px;text-align:right;color:#334155;">${Utils.fmt.currency(mat)}</td>
              <td style="padding:7px 14px;text-align:right;color:#64748b;">${recs>0?((mat/recs)*100).toFixed(1):'0.0'}%</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:7px 14px;padding-left:28px;color:#475569;">&bull; Mão de Obra e Equipes Próprias</td>
              <td style="padding:7px 14px;text-align:right;color:#334155;">${Utils.fmt.currency(mo)}</td>
              <td style="padding:7px 14px;text-align:right;color:#64748b;">${recs>0?((mo/recs)*100).toFixed(1):'0.0'}%</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:7px 14px;padding-left:28px;color:#475569;">&bull; Serviços Terceirizados e Empreiteiros</td>
              <td style="padding:7px 14px;text-align:right;color:#334155;">${Utils.fmt.currency(srv)}</td>
              <td style="padding:7px 14px;text-align:right;color:#64748b;">${recs>0?((srv/recs)*100).toFixed(1):'0.0'}%</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:7px 14px;padding-left:28px;color:#475569;">&bull; Locação de Máquinas e Equipamentos</td>
              <td style="padding:7px 14px;text-align:right;color:#334155;">${Utils.fmt.currency(eqp)}</td>
              <td style="padding:7px 14px;text-align:right;color:#64748b;">${recs>0?((eqp/recs)*100).toFixed(1):'0.0'}%</td>
            </tr>
            <tr style="background:#f8fafc;border-top:2px solid #cbd5e1;border-bottom:2px solid #cbd5e1;font-weight:900;">
              <td style="padding:10px 14px;color:#0f172a;">(=) MARGEM BRUTA OPERACIONAL</td>
              <td style="padding:10px 14px;text-align:right;color:${margemBruta>=0?'#15803d':'#b91c1c'};font-size:.95rem;">${Utils.fmt.currency(margemBruta)}</td>
              <td style="padding:10px 14px;text-align:right;color:${margemBruta>=0?'#15803d':'#b91c1c'};">${margemBrutaPct}%</td>
            </tr>
            <tr style="background:#fef2f2;font-weight:800;">
              <td style="padding:8px 14px;color:#b91c1c;">(−) DESPESAS INDIRETAS E ADMINISTRATIVAS</td>
              <td style="padding:8px 14px;text-align:right;color:#b91c1c;">${Utils.fmt.currency(adm + imp + out)}</td>
              <td style="padding:8px 14px;text-align:right;color:#b91c1c;">${recs>0?(((adm+imp+out)/recs)*100).toFixed(1):'0.0'}%</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:7px 14px;padding-left:28px;color:#475569;">&bull; Administrativo / Sede / Escritório</td>
              <td style="padding:7px 14px;text-align:right;color:#334155;">${Utils.fmt.currency(adm)}</td>
              <td style="padding:7px 14px;text-align:right;color:#64748b;">${recs>0?((adm/recs)*100).toFixed(1):'0.0'}%</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:7px 14px;padding-left:28px;color:#475569;">&bull; Impostos e Tributos</td>
              <td style="padding:7px 14px;text-align:right;color:#334155;">${Utils.fmt.currency(imp)}</td>
              <td style="padding:7px 14px;text-align:right;color:#64748b;">${recs>0?((imp/recs)*100).toFixed(1):'0.0'}%</td>
            </tr>
            <tr style="background:${lucroLiquido>=0?'#f0fdf4':'#fef2f2'};border-top:3px solid ${lucroLiquido>=0?'#22c55e':'#ef4444'};border-bottom:3px solid ${lucroLiquido>=0?'#22c55e':'#ef4444'};font-weight:900;">
              <td style="padding:12px 14px;font-size:1rem;color:${lucroLiquido>=0?'#15803d':'#b91c1c'};">(=) RESULTADO LÍQUIDO DO EXERCÍCIO</td>
              <td style="padding:12px 14px;text-align:right;font-size:1.1rem;color:${lucroLiquido>=0?'#15803d':'#b91c1c'};">${Utils.fmt.currency(lucroLiquido)}</td>
              <td style="padding:12px 14px;text-align:right;font-size:1rem;color:${lucroLiquido>=0?'#15803d':'#b91c1c'};">${margemLiqPct}%</td>
            </tr>
          </tbody>
        </table>
      </div>`;
    } else if (type === 'fluxo') {
      const r = DB.getResumo(obraId === 'todas' ? null : obraId);
      let running = r.saldo || 0;
      const hoje = new Date();
      hoje.setHours(0,0,0,0);

      const semanas = [];
      for (let s = 0; s < 12; s++) {
        const dtIni = new Date(hoje);
        dtIni.setDate(hoje.getDate() + (s * 7));
        const dtFim = new Date(hoje);
        dtFim.setDate(hoje.getDate() + (s * 7) + 6);
        semanas.push({
          num: s + 1,
          iniStr: dtIni.toISOString().split('T')[0],
          fimStr: dtFim.toISOString().split('T')[0],
          label: `${dtIni.toLocaleDateString('pt-BR')} a ${dtFim.toLocaleDateString('pt-BR')}`,
          rec: 0, desp: 0, saldoFinal: 0
        });
      }

      const lans = DB.getLancamentos(obraId === 'todas' ? null : obraId);
      lans.forEach(l => {
        const venc = l.data_vencimento || l.data;
        if (!venc) return;
        semanas.forEach(sem => {
          if (venc >= sem.iniStr && venc <= sem.fimStr) {
            if (l.tipo === 'receita' && (l.status === 'a_receber' || l.status === 'pendente')) sem.rec += l.valor;
            if (l.tipo === 'despesa' && (l.status === 'a_pagar' || l.status === 'pendente')) sem.desp += l.valor;
          }
        });
      });

      semanas.forEach(s => {
        running += (s.rec - s.desp);
        s.saldoFinal = running;
      });

      html += `
      <div style="margin-bottom:18px;">
        <h2 style="font-size:1.05rem;font-weight:900;color:#0f172a;margin:0;">📈 Extrato de Projeção de Fluxo de Caixa (12 Semanas / 90 Dias)</h2>
        <div style="font-size:.78rem;color:#475569;margin-top:2px;">Saldo inicial disponível em caixa: <strong>${Utils.fmt.currency(r.saldo||0)}</strong></div>
      </div>
      <div class="ang-tbl-wrap" style="margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
          <thead>
            <tr style="background:#0f172a;color:#fff;">
              <th style="padding:8px 10px;text-align:center;width:45px;">Sem</th>
              <th style="padding:8px 10px;text-align:left;">Período Semanal</th>
              <th style="padding:8px 10px;text-align:right;color:#86efac;">(+) Entradas Previstas</th>
              <th style="padding:8px 10px;text-align:right;color:#fca5a5;">(−) Saídas Previstas</th>
              <th style="padding:8px 10px;text-align:right;">Resultado Semanal</th>
              <th style="padding:8px 10px;text-align:right;">Saldo Acumulado Projetado</th>
            </tr>
          </thead>
          <tbody>
            ${semanas.map(s => {
              const resSem = s.rec - s.desp;
              return `
              <tr style="border-bottom:1px solid #cbd5e1;background:${s.saldoFinal<0?'#fef2f2':'#ffffff'};">
                <td style="padding:8px 10px;text-align:center;font-weight:800;color:#0284c7;">${s.num}</td>
                <td style="padding:8px 10px;color:#1e293b;font-weight:600;">${s.label}</td>
                <td style="padding:8px 10px;text-align:right;color:#15803d;font-weight:700;">${Utils.fmt.currency(s.rec)}</td>
                <td style="padding:8px 10px;text-align:right;color:#b91c1c;font-weight:700;">${Utils.fmt.currency(s.desp)}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:800;color:${resSem>=0?'#15803d':'#b91c1c'};">${resSem>=0?'+':''}${Utils.fmt.currency(resSem)}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:900;color:${s.saldoFinal>=0?'#0f172a':'#b91c1c'};">${Utils.fmt.currency(s.saldoFinal)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
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
          <span style="color:#64748b;font-size:.72rem;">${emp.responsavel ? emp.responsavel : 'Responsável Técnico'} ${emp.crea_cau ? `(${emp.crea_cau})` : ''}</span>
        </div>
        <div>
          <div style="border-bottom:1px solid #94a3b8;margin-bottom:6px;height:30px;"></div>
          <strong style="color:#0f172a;">${emp.razao_social || empNome}</strong><br>
          <span style="color:#64748b;font-size:.72rem;">Gestão Financeira e Administrativa</span>
        </div>
      </div>
      <div style="font-size:.7rem;color:#94a3b8;text-align:center;border-top:1px dashed #e2e8f0;padding-top:10px;">
        ${empNome} &middot; Sistema de Gest&atilde;o de Obras &middot; Documento v&aacute;lido para fins de acompanhamento gerencial.
      </div>
    </div>`;

    return html;
  }
};
