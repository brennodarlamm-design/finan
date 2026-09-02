// js/ofx.js — OFX Bank Statement Import & Multi-Project Conciliation (Geral / Todas as Obras e Sede)

const OFX = {
  _importData: null,
  _reconcileContext: null,
  _activeFilterTab: 'todas',
  _activeSearchTerm: '',

  render(obraId) {
    const imports = DB.getAll('ofximports') || [];
    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">🔄 Importação & Conciliação OFX</h1>
        <p class="page-sub">Conciliação bancária geral — importe extratos bancários (.ofx / .qfx) e cruze com os lançamentos de todas as obras e da sede</p>
      </div>
    </div>

    <div class="g2" style="margin-bottom:16px;">
      <!-- Card: Upload / Import -->
      <div class="card">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
          <div class="card-title">📂 Importar Extrato OFX / QFX</div>
          <span class="badge badge-info" style="font-size:.72rem;">🌐 Extrato Geral</span>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label">Conta Bancária de Origem</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <select class="form-control" id="ofx-conta-sel" onchange="OFX._onContaSel(this)" style="flex:1">
              ${Contas.contaOptions('')}
            </select>
            <button type="button" class="btn btn-secondary btn-sm" onclick="App.navigate('configuracoes');Configuracoes._switch('contas')" title="Gerenciar contas bancárias" style="white-space:nowrap">➕ Nova Conta</button>
          </div>
          <input class="form-control" id="ofx-conta" placeholder="Ex: Banco do Brasil Ag: 0501 Cc: 12345-6" style="margin-top:6px;display:none">
        </div>

        <div class="drop-zone" id="ofx-drop" onclick="document.getElementById('ofx-file').click()" style="padding:32px 20px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;margin:0 auto 10px;display:block;color:var(--accent)"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p style="font-size:.92rem;font-weight:700;margin-bottom:4px">Arraste seu extrato bancário OFX aqui</p>
          <p style="font-size:.78rem;color:var(--text3)">Compatível com Caixa, BB, Bradesco, Itaú, Santander, Sicredi, Sicoob, Inter, Nubank (.ofx, .qfx)</p>
          <input type="file" id="ofx-file" accept=".ofx,.qfx,.OFX,.QFX" style="display:none">
        </div>

        <div id="ofx-parse-result" style="margin-top:14px;display:none"></div>

        <div style="margin-top:16px;display:flex;gap:8px;align-items:center;justify-content:space-between;">
          <button class="btn btn-secondary" onclick="OFX.demoOFX()">📋 Carregar OFX Demo</button>
          <button class="btn btn-primary" id="ofx-import-btn" onclick="OFX.processImport()" style="display:none;font-weight:700;">✔ Importar e Conciliar Geral</button>
        </div>
      </div>

      <!-- Card: Histórico de Importações -->
      <div class="card">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
          <div class="card-title">📊 Histórico de Extratos Importados</div>
          <span class="badge badge-secondary" style="font-size:.72rem;">${imports.length} extrato(s)</span>
        </div>
        ${imports.length ? `<div class="tbl-wrap" style="border:none;max-height:420px;overflow-y:auto;"><table>
          <thead><tr>
            <th>Data Importação</th>
            <th>Conta Bancária</th>
            <th>Período Extrato</th>
            <th>Conciliação</th>
            <th style="text-align:right">Ações</th>
          </tr></thead>
          <tbody>${imports.slice().reverse().map(i => {
            const trns = Array.isArray(i.transacoes) ? i.transacoes : [];
            const conciliadas = trns.filter(t => t.status === 'conciliada').length;
            const total = trns.length;
            const pct = total > 0 ? Math.round((conciliadas / total) * 100) : 0;
            const contaNome = i.conta_bancaria || (i.banco_id ? `Banco ${i.banco_id} - ${i.conta_id || ''}` : 'Conta Geral');
            return `<tr>
              <td style="font-size:.78rem;white-space:nowrap">${Utils.fmt.datetime(i.data_importacao)}</td>
              <td style="font-size:.82rem;font-weight:600;color:var(--text)">🏦 ${contaNome}</td>
              <td style="font-size:.78rem;color:var(--text2);white-space:nowrap">${Utils.fmt.date(i.periodo_inicio)} → ${Utils.fmt.date(i.periodo_fim)}</td>
              <td>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span class="badge ${pct===100?'badge-success':pct>0?'badge-warning':'badge-secondary'}" style="font-size:.72rem">${conciliadas}/${total} (${pct}%)</span>
                </div>
              </td>
              <td style="text-align:right;white-space:nowrap">
                <button class="btn btn-secondary btn-sm" onclick="OFX.viewImport('${i.id}')" title="Abrir Conciliação" style="padding:4px 8px;font-size:.75rem;">⚖ Conciliar</button>
                <button class="icon-btn btn-sm" onclick="OFX.deleteImport('${i.id}')" title="Excluir este extrato" style="color:var(--danger);font-size:.8rem;margin-left:4px;">🗑️</button>
              </td>
            </tr>`;
          }).join('')}
          </tbody></table></div>`
        : `<div class="empty-state" style="padding:40px 16px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;margin:0 auto 10px;display:block;opacity:.4;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <p style="font-size:.88rem;color:var(--text2);font-weight:600;">Nenhum extrato OFX importado ainda</p>
            <p style="font-size:.76rem;color:var(--text3);margin-top:4px;">Faça o upload de um arquivo .ofx para cruzar as movimentações do banco com suas receitas e despesas.</p>
          </div>`}
      </div>
    </div>`;
  },

  demoOFX() {
    const demo = `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n<OFX><SIGNONMSGSRSV1><SONRS><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS><DTSERVER>20260814120000[-3:BRT]</DTSERVER><LANGUAGE>POR</LANGUAGE><FI><ORG>CAIXA ECONOMICA FEDERAL</ORG><FID>104</FID></FI></SONRS></SIGNONMSGSRSV1><BANKMSGSRSV1><STMTTRNRS><TRNUID>1</TRNUID><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS><STMTRS><CURDEF>BRL</CURDEF><BANKACCTFROM><BANKID>104</BANKID><ACCTID>0501-123456-7</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM><BANKTRANLIST><DTSTART>20260101120000[-3:BRT]</DTSTART><DTEND>20260814120000[-3:BRT]</DTEND><STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260115120000[-3:BRT]</DTPOSTED><TRNAMT>57000.00</TRNAMT><FITID>20260115001</FITID><MEMO>TED CAIXA ECONOMICA FEDERAL LIBERACAO PARCELA 1</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260120120000[-3:BRT]</DTPOSTED><TRNAMT>-3200.00</TRNAMT><FITID>20260120001</FITID><MEMO>DEBITO MATERIAIS PARA CONSTRUCAO XYZ LTDA</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260120120000[-3:BRT]</DTPOSTED><TRNAMT>-2800.00</TRNAMT><FITID>20260120002</FITID><MEMO>DEBITO AREEIRO SAO BENTO</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260125120000[-3:BRT]</DTPOSTED><TRNAMT>-15000.00</TRNAMT><FITID>20260125001</FITID><MEMO>PIX EMPREITEIRA LIMA FILHOS ME</MEMO></STMTTRN><STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260205120000[-3:BRT]</DTPOSTED><TRNAMT>35000.00</TRNAMT><FITID>20260205001</FITID><MEMO>TED ENTRADA PROPRIA JOAO C FERREIRA</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260210120000[-3:BRT]</DTPOSTED><TRNAMT>-4200.00</TRNAMT><FITID>20260210001</FITID><MEMO>DEBITO SIDERURGICA PAULO CIA</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260215120000[-3:BRT]</DTPOSTED><TRNAMT>-3800.00</TRNAMT><FITID>20260215001</FITID><MEMO>DEBITO CERAMICA VALE VERDE</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260301120000[-3:BRT]</DTPOSTED><TRNAMT>-18000.00</TRNAMT><FITID>20260301001</FITID><MEMO>PIX EMPREITEIRA LIMA FILHOS ME SERVICOS</MEMO></STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>41000.00</BALAMT><DTASOF>20260814120000[-3:BRT]</DTASOF></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const result = this._parseOFX(demo);
    this._importData = result;
    this._showParseResult(result);
    const btn = document.getElementById('ofx-import-btn');
    if (btn) btn.style.display = 'inline-flex';
    Utils.toast(`${result.transacoes.length} transações encontradas no OFX demo`, 'info');
  },

  _parseOFX(content) {
    const transacoes = [];
    let dtStart = '', dtEnd = '';
    
    // Extract dates
    const dtStartM = content.match(/<DTSTART>(\d{8})/i);
    if (dtStartM) dtStart = `${dtStartM[1].slice(0,4)}-${dtStartM[1].slice(4,6)}-${dtStartM[1].slice(6,8)}`;
    
    const dtEndM = content.match(/<DTEND>(\d{8})/i);
    if (dtEndM) dtEnd = `${dtEndM[1].slice(0,4)}-${dtEndM[1].slice(4,6)}-${dtEndM[1].slice(6,8)}`;

    // Extract bank & account metadata if present
    const bankIdM = content.match(/<BANKID>([^<\r\n]+)/i);
    const acctIdM = content.match(/<ACCTID>([^<\r\n]+)/i);
    const orgM = content.match(/<ORG>([^<\r\n]+)/i);
    const bankId = bankIdM ? bankIdM[1].trim() : '';
    const acctId = acctIdM ? acctIdM[1].trim() : '';
    const org = orgM ? orgM[1].trim() : '';

    const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let m;
    while ((m = trnRegex.exec(content)) !== null) {
      const block = m[1];
      const get = (tag, b) => {
        const r = b.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
        return r ? r[1].trim() : '';
      };
      const trnType = get('TRNTYPE', block).toUpperCase();
      const dtRaw = get('DTPOSTED', block).slice(0, 8);
      const dt = dtRaw.length === 8 ? `${dtRaw.slice(0,4)}-${dtRaw.slice(4,6)}-${dtRaw.slice(6,8)}` : '';
      const amtRaw = parseFloat(get('TRNAMT', block).replace(',', '.')) || 0;
      const fitId = get('FITID', block);
      const memo = get('MEMO', block) || get('NAME', block) || get('CHECKNUM', block) || 'Transação Bancária';
      
      const isCredit = amtRaw > 0 || trnType === 'CREDIT' || trnType === 'DEP' || trnType === 'DIRECTDEP';
      transacoes.push({
        id: fitId || DB.uuid(),
        data: dt,
        memo: memo.replace(/\s+/g, ' ').trim(),
        valor: Math.abs(amtRaw),
        tipo: isCredit ? 'credito' : 'debito',
        status: 'pendente',
        lancamento_id: null
      });
    }

    if (!dtStart && transacoes.length > 0) {
      const datas = transacoes.map(t => t.data).filter(Boolean).sort();
      if (datas.length > 0) {
        dtStart = datas[0];
        dtEnd = datas[datas.length - 1];
      }
    }

    return { transacoes, periodo_inicio: dtStart, periodo_fim: dtEnd, bankId, acctId, org };
  },

  _showParseResult(data) {
    const el = document.getElementById('ofx-parse-result');
    if (!el) return;
    const creds = data.transacoes.filter(t => t.tipo === 'credito').reduce((s, t) => s + t.valor, 0);
    const debs = data.transacoes.filter(t => t.tipo === 'debito').reduce((s, t) => s + t.valor, 0);
    
    // Suggest or select bank account if detected
    if (data.bankId || data.acctId || data.org) {
      const sel = document.getElementById('ofx-conta-sel');
      if (sel) {
        const bankName = data.org || (data.bankId === '104' ? 'Caixa Econômica' : data.bankId === '001' ? 'Banco do Brasil' : data.bankId === '237' ? 'Bradesco' : data.bankId === '341' ? 'Itaú' : data.bankId === '033' ? 'Santander' : `Banco ${data.bankId}`);
        const found = Array.from(sel.options).find(opt => opt.text.includes(data.acctId) || (data.bankId && opt.text.includes(data.bankId)));
        if (found) {
          sel.value = found.value;
        } else if (data.acctId || bankName) {
          const manual = document.getElementById('ofx-conta');
          if (manual) manual.value = `${bankName} ${data.acctId ? 'Ag/Cc: ' + data.acctId : ''}`.trim();
        }
      }
    }

    el.style.display = 'block';
    el.innerHTML = `
    <div style="padding:14px;background:var(--bg-secondary);border-radius:var(--r-md);border:1px solid var(--border-d)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-weight:700;color:var(--success);font-size:.9rem;">✅ OFX Analisado com Sucesso!</div>
        ${data.org || data.acctId ? `<span class="badge badge-secondary" style="font-size:.72rem">🏦 ${data.org || ''} ${data.acctId ? '· ' + data.acctId : ''}</span>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:.8rem">
        <div><div style="color:var(--text3);margin-bottom:2px">Transações</div><div style="font-weight:800;color:var(--accent);font-size:1.05rem;">${data.transacoes.length}</div></div>
        <div><div style="color:var(--text3);margin-bottom:2px">Entradas (+)</div><div style="font-weight:800;color:var(--success);font-size:.95rem;">${Utils.fmt.currency(creds)}</div></div>
        <div><div style="color:var(--text3);margin-bottom:2px">Saídas (−)</div><div style="font-weight:800;color:var(--danger);font-size:.95rem;">${Utils.fmt.currency(debs)}</div></div>
        <div><div style="color:var(--text3);margin-bottom:2px">Período</div><div style="font-weight:600;font-size:.72rem;color:var(--text2);">${Utils.fmt.date(data.periodo_inicio)}<br>a ${Utils.fmt.date(data.periodo_fim)}</div></div>
      </div>
    </div>`;
  },

  processImport() {
    if (!this._importData || !this._importData.transacoes.length) {
      Utils.toast('Nenhum dado de extrato carregado para importar.', 'warning');
      return;
    }

    const conta_sel = document.getElementById('ofx-conta-sel')?.value;
    const conta_manual = document.getElementById('ofx-conta')?.value || '';
    const conta = (conta_sel && conta_sel !== '__manual__') ? conta_sel : conta_manual;

    // Fetch ALL non-deleted transactions across all obras and headquarters
    const allLans = DB.getLancamentos(null);

    // Smart Auto-Matching algorithm across all projects & sede
    let autoMatchedCount = 0;
    const trns = this._importData.transacoes.map(t => {
      // Find candidate launch: matches value, type, and close date (±4 days)
      const matched = allLans.find(l => {
        if (l.conciliado) return false;
        const valMatch = Math.abs(Number(l.valor) - Number(t.valor)) < 0.05 || Math.abs(Number(l.valor) - Number(t.valor)) < 1.00;
        const tipoMatch = (t.tipo === 'credito' && l.tipo === 'receita') || (t.tipo === 'debito' && l.tipo === 'despesa');
        const dLan = l.data_pagamento || l.data_vencimento || l.data;
        const dateMatch = !dLan || !t.data || l.data === t.data || Math.abs(new Date(dLan) - new Date(t.data)) <= (4 * 86400000);
        return valMatch && tipoMatch && dateMatch;
      });

      if (matched) {
        autoMatchedCount++;
        DB.update('lancamentos', matched.id, { conciliado: true });
        return { ...t, status: 'conciliada', lancamento_id: matched.id };
      }
      return { ...t, status: 'pendente', lancamento_id: null };
    });

    const importRec = {
      id: DB.uuid(),
      conta_bancaria: conta || (this._importData.org ? `${this._importData.org} ${this._importData.acctId || ''}`.trim() : 'Conta Geral'),
      banco_id: this._importData.bankId || '',
      conta_id: this._importData.acctId || '',
      data_importacao: new Date().toISOString(),
      periodo_inicio: this._importData.periodo_inicio,
      periodo_fim: this._importData.periodo_fim,
      transacoes: trns
    };

    DB.add('ofximports', importRec);
    const newId = importRec.id;

    this._importData = null;
    const parseRes = document.getElementById('ofx-parse-result');
    if (parseRes) parseRes.style.display = 'none';
    const btnImp = document.getElementById('ofx-import-btn');
    if (btnImp) btnImp.style.display = 'none';

    Utils.toast(`Extrato importado com sucesso! ${autoMatchedCount}/${trns.length} transações conciliadas automaticamente.`, 'success');

    // Refresh OFX screen
    const el = document.getElementById('route-content');
    if (el) {
      el.innerHTML = OFX.render(App.obraId);
      OFX.init(App.obraId);
    }

    // Immediately open conciliation modal
    setTimeout(() => {
      OFX.viewImport(newId);
    }, 200);
  },

  viewImport(importId, tab = 'todas', search = '') {
    const imp = DB.getById('ofximports', importId);
    if (!imp) {
      Utils.toast('Extrato não encontrado.', 'warning');
      return;
    }

    this._activeFilterTab = tab;
    this._activeSearchTerm = search;

    // Load ALL launches across all obras and headquarters
    const allLans = DB.getLancamentos(null);
    const clientesMap = Object.fromEntries((DB.getAll('clientes') || []).map(c => [c.id, c]));

    const trns = Array.isArray(imp.transacoes) ? imp.transacoes : [];
    const conciliadas = trns.filter(t => t.status === 'conciliada').length;
    const pendentes = trns.filter(t => t.status === 'pendente').length;
    const ignoradas = trns.filter(t => t.status === 'ignorada').length;

    // Filter transactions by tab and search
    let filteredTrns = trns;
    if (tab === 'pendentes') filteredTrns = trns.filter(t => t.status === 'pendente');
    else if (tab === 'conciliadas') filteredTrns = trns.filter(t => t.status === 'conciliada');
    else if (tab === 'ignoradas') filteredTrns = trns.filter(t => t.status === 'ignorada');

    if (search) {
      const q = search.toLowerCase();
      filteredTrns = filteredTrns.filter(t => {
        const memoMatch = (t.memo || '').toLowerCase().includes(q);
        const valorMatch = String(t.valor).includes(q) || Utils.fmt.currency(t.valor).toLowerCase().includes(q);
        let matchedLanDesc = '';
        if (t.lancamento_id) {
          const ml = allLans.find(l => l.id === t.lancamento_id);
          if (ml) {
            const obName = ml.obra_id === 'escritorio' ? 'sede escritorio' : (clientesMap[ml.obra_id]?.nome || '');
            matchedLanDesc = `${ml.descricao} ${obName}`.toLowerCase();
          }
        }
        return memoMatch || valorMatch || matchedLanDesc.includes(q);
      });
    }

    Utils.showModal(`
      <div class="modal" style="max-width:920px;width:95vw;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="border-bottom:1px solid var(--border-s);padding:14px 20px;">
          <div>
            <div class="modal-title" style="display:flex;align-items:center;gap:8px;">
              <span>⚖ Conciliação Bancária</span>
              <span class="badge badge-secondary" style="font-size:.75rem;">🏦 ${imp.conta_bancaria || 'Extrato Geral'}</span>
            </div>
            <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">
              Período: <strong>${Utils.fmt.date(imp.periodo_inicio)} a ${Utils.fmt.date(imp.periodo_fim)}</strong> · Importado em ${Utils.fmt.datetime(imp.data_importacao)}
            </div>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>

        <div class="modal-body" style="padding:16px 20px;overflow-y:auto;flex:1;">
          <!-- Controls & Filter Tabs -->
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm ${tab==='todas'?'btn-primary':'btn-secondary'}" onclick="OFX.viewImport('${importId}','todas',document.getElementById('rec-search')?.value||'')">
                Todas (${trns.length})
              </button>
              <button class="btn btn-sm ${tab==='pendentes'?'btn-warning':'btn-secondary'}" onclick="OFX.viewImport('${importId}','pendentes',document.getElementById('rec-search')?.value||'')">
                ⏳ Pendentes (${pendentes})
              </button>
              <button class="btn btn-sm ${tab==='conciliadas'?'btn-success':'btn-secondary'}" onclick="OFX.viewImport('${importId}','conciliadas',document.getElementById('rec-search')?.value||'')">
                ✅ Conciliadas (${conciliadas})
              </button>
              <button class="btn btn-sm ${tab==='ignoradas'?'btn-primary':'btn-secondary'}" onclick="OFX.viewImport('${importId}','ignoradas',document.getElementById('rec-search')?.value||'')">
                ✕ Ignoradas (${ignoradas})
              </button>
            </div>

            <div style="min-width:220px;flex:1;max-width:320px;">
              <input type="text" id="rec-search" class="form-control" placeholder="Buscar no extrato ou obra..." value="${search}" oninput="OFX.viewImport('${importId}','${tab}',this.value)" style="padding:5px 10px;font-size:.8rem;">
            </div>
          </div>

          <!-- Transaction List -->
          <div id="rec-list" style="display:flex;flex-direction:column;gap:8px;">
            ${filteredTrns.length ? filteredTrns.map(t => this._recItem(t, allLans, clientesMap, importId)).join('')
            : `<div style="text-align:center;padding:40px 10px;color:var(--text3);">
                <p style="font-size:.88rem;color:var(--text2);">Nenhuma transação encontrada neste filtro.</p>
              </div>`}
          </div>
        </div>

        <div class="modal-footer" style="padding:12px 20px;border-top:1px solid var(--border-s);display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:.78rem;color:var(--text3);">
            Progresso: <strong>${conciliadas} de ${trns.length} transações conciliadas</strong> (${trns.length > 0 ? Math.round((conciliadas/trns.length)*100) : 0}%)
          </div>
          <button class="btn btn-secondary btn-sm" onclick="Utils.closeModal()">Fechar</button>
        </div>
      </div>`);
  },

  _recItem(t, allLans, clientesMap, importId) {
    const isCredit = t.tipo === 'credito';
    const matched = t.lancamento_id ? allLans.find(l => l.id === t.lancamento_id) : null;
    const cls = t.status === 'conciliada' ? 'matched' : t.status === 'ignorada' ? 'ignored' : '';

    // If pending, find candidate matches across ALL obras + sede
    let candidateOptionsHtml = '';
    if (t.status === 'pendente') {
      const neededType = isCredit ? 'receita' : 'despesa';
      // Candidates with close value (within R$ 100) and matching type
      const candidates = allLans.filter(l => {
        if (l.conciliado) return false;
        if (l.tipo !== neededType) return false;
        return Math.abs(Number(l.valor) - Number(t.valor)) <= 100;
      }).sort((a, b) => {
        // Exact value first
        const diffA = Math.abs(Number(a.valor) - Number(t.valor));
        const diffB = Math.abs(Number(b.valor) - Number(t.valor));
        return diffA - diffB;
      });

      // Also add other recent unconciliated launches of same type if candidates are few
      let extraLans = [];
      if (candidates.length < 5) {
        extraLans = allLans.filter(l => !l.conciliado && l.tipo === neededType && !candidates.some(c => c.id === l.id)).slice(0, 10);
      }

      candidateOptionsHtml = `
        <select style="background:var(--bg-input);border:1px solid var(--border-d);color:var(--text);border-radius:6px;padding:6px;font-size:.75rem;width:100%;max-width:280px;" onchange="OFX.conciliar('${importId}','${t.id}',this.value)">
          <option value="">➕ Vincular a lançamento existente...</option>
          ${candidates.length > 0 ? `<optgroup label="✨ Sugestões por Valor">${candidates.map(l => {
            const obNome = l.obra_id === 'escritorio' ? '🏢 Sede' : (clientesMap[l.obra_id]?.nome || 'Obra');
            return `<option value="${l.id}">[${obNome}] ${l.descricao.slice(0, 26)} (${Utils.fmt.currency(l.valor)} - ${Utils.fmt.date(l.data)})</option>`;
          }).join('')}</optgroup>` : ''}
          ${extraLans.length > 0 ? `<optgroup label="📋 Outros Lançamentos">${extraLans.map(l => {
            const obNome = l.obra_id === 'escritorio' ? '🏢 Sede' : (clientesMap[l.obra_id]?.nome || 'Obra');
            return `<option value="${l.id}">[${obNome}] ${l.descricao.slice(0, 26)} (${Utils.fmt.currency(l.valor)} - ${Utils.fmt.date(l.data)})</option>`;
          }).join('')}</optgroup>` : ''}
        </select>
      `;
    }

    let matchedHtml = '';
    if (t.status === 'conciliada' && matched) {
      const obNome = matched.obra_id === 'escritorio' ? '🏢 Sede / Escritório' : (clientesMap[matched.obra_id]?.nome || 'Obra');
      matchedHtml = `
        <div style="font-size:.76rem;color:var(--success);display:flex;flex-direction:column;">
          <span style="font-weight:700;">✅ [${obNome}]</span>
          <span style="color:var(--text);">${matched.descricao.slice(0, 32)} · ${Utils.fmt.currency(matched.valor)}</span>
        </div>
      `;
    } else if (t.status === 'ignorada') {
      matchedHtml = `<span style="font-size:.75rem;color:var(--text3);font-style:italic;">Ignorada na conciliação</span>`;
    } else {
      matchedHtml = candidateOptionsHtml || `<span style="font-size:.75rem;color:var(--text3)">Sem correspondência direta</span>`;
    }

    return `
    <div class="rec-item ${cls}" id="rec-${t.id}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-secondary);border:1px solid ${t.status==='conciliada'?'rgba(16,185,129,.35)':'var(--border-s)'};border-radius:var(--r-md);">
      <div style="font-size:1.3rem;flex-shrink:0;">${isCredit ? '📈' : '📉'}</div>
      
      <div style="flex:1;min-width:0;">
        <div style="font-size:.84rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${t.memo}">${t.memo}</div>
        <div style="font-size:.74rem;color:var(--text3);display:flex;gap:8px;margin-top:2px;">
          <span>📅 ${Utils.fmt.date(t.data)}</span>
          <span>·</span>
          <span style="color:${isCredit?'var(--success)':'var(--danger)'};font-weight:600;">${isCredit ? 'Entrada / Crédito' : 'Saída / Débito'}</span>
          ${t.id ? `<span style="color:var(--text3);font-size:.68rem;">(ID: ${String(t.id).slice(-8)})</span>` : ''}
        </div>
      </div>

      <div style="font-weight:900;font-size:.92rem;white-space:nowrap;color:${isCredit?'var(--success)':'var(--danger)'};text-align:right;min-width:90px;">
        ${isCredit ? '+' : '−'}${Utils.fmt.currency(t.valor)}
      </div>

      <div style="min-width:220px;flex-shrink:0;">
        ${matchedHtml}
      </div>

      <div style="display:flex;gap:4px;flex-shrink:0;">
        ${t.status === 'pendente' ? `
          <button class="btn btn-primary btn-sm" onclick="OFX.criarLancamento('${importId}','${t.id}')" title="Criar novo lançamento para esta transação" style="padding:4px 8px;font-size:.75rem;font-weight:700;">+ Criar</button>
          <button class="icon-btn btn-sm" onclick="OFX.ignorar('${importId}','${t.id}')" title="Ignorar transação" style="font-size:12px;color:var(--text3);">✕</button>
        ` : ''}

        ${t.status === 'conciliada' ? `
          <button class="btn btn-secondary btn-sm" onclick="OFX.desconciliar('${importId}','${t.id}')" title="Desfazer conciliação" style="padding:4px 8px;font-size:.72rem;">↩ Desconciliar</button>
        ` : ''}

        ${t.status === 'ignorada' ? `
          <button class="btn btn-secondary btn-sm" onclick="OFX.reativar('${importId}','${t.id}')" title="Reativar para pendente" style="padding:4px 8px;font-size:.72rem;">↩ Reativar</button>
        ` : ''}
      </div>
    </div>`;
  },

  conciliar(importId, trnId, lanId, showToast = true) {
    if (!lanId) return;
    const imp = DB.getById('ofximports', importId);
    if (!imp || !Array.isArray(imp.transacoes)) return;
    const idx = imp.transacoes.findIndex(t => t.id === trnId);
    if (idx === -1) return;

    imp.transacoes[idx].status = 'conciliada';
    imp.transacoes[idx].lancamento_id = lanId;
    DB.update('ofximports', importId, { transacoes: imp.transacoes });
    DB.update('lancamentos', lanId, { conciliado: true });

    if (showToast) Utils.toast('Transação bancária conciliada!', 'success');
    this.viewImport(importId, this._activeFilterTab, this._activeSearchTerm);
  },

  desconciliar(importId, trnId) {
    const imp = DB.getById('ofximports', importId);
    if (!imp || !Array.isArray(imp.transacoes)) return;
    const idx = imp.transacoes.findIndex(t => t.id === trnId);
    if (idx === -1) return;

    const lanId = imp.transacoes[idx].lancamento_id;
    imp.transacoes[idx].status = 'pendente';
    imp.transacoes[idx].lancamento_id = null;
    DB.update('ofximports', importId, { transacoes: imp.transacoes });
    if (lanId) DB.update('lancamentos', lanId, { conciliado: false });

    Utils.toast('Conciliação desfeita.', 'info');
    this.viewImport(importId, this._activeFilterTab, this._activeSearchTerm);
  },

  ignorar(importId, trnId) {
    const imp = DB.getById('ofximports', importId);
    if (!imp || !Array.isArray(imp.transacoes)) return;
    const idx = imp.transacoes.findIndex(t => t.id === trnId);
    if (idx === -1) return;

    imp.transacoes[idx].status = 'ignorada';
    DB.update('ofximports', importId, { transacoes: imp.transacoes });
    Utils.toast('Transação marcada como ignorada.', 'info');
    this.viewImport(importId, this._activeFilterTab, this._activeSearchTerm);
  },

  reativar(importId, trnId) {
    const imp = DB.getById('ofximports', importId);
    if (!imp || !Array.isArray(imp.transacoes)) return;
    const idx = imp.transacoes.findIndex(t => t.id === trnId);
    if (idx === -1) return;

    imp.transacoes[idx].status = 'pendente';
    DB.update('ofximports', importId, { transacoes: imp.transacoes });
    Utils.toast('Transação reativada para pendente.', 'info');
    this.viewImport(importId, this._activeFilterTab, this._activeSearchTerm);
  },

  deleteImport(importId) {
    if (!confirm('Deseja realmente excluir este histórico de extrato OFX?')) return;
    const imp = DB.getById('ofximports', importId);
    if (imp && Array.isArray(imp.transacoes)) {
      imp.transacoes.forEach(t => {
        if (t.lancamento_id) {
          DB.update('lancamentos', t.lancamento_id, { conciliado: false });
        }
      });
    }
    DB.remove('ofximports', importId);
    Utils.toast('Extrato excluído com sucesso.', 'success');
    const el = document.getElementById('route-content');
    if (el) {
      el.innerHTML = OFX.render(App.obraId);
      OFX.init(App.obraId);
    }
  },

  criarLancamento(importId, trnId) {
    const imp = DB.getById('ofximports', importId);
    const trn = imp?.transacoes?.find(t => t.id === trnId);
    if (!trn) return;

    // Set context so Lancamentos.save knows to link this transaction back to OFX
    this._reconcileContext = { importId, trnId };

    const tipo = trn.tipo === 'credito' ? 'receita' : 'despesa';
    Lancamentos.showForm(tipo);

    setTimeout(() => {
      const f = document.getElementById('f-lan');
      if (f) {
        const v = f.querySelector('[name="valor"]'); if (v) v.value = trn.valor;
        const dt = f.querySelector('[name="data"]'); if (dt) dt.value = trn.data;
        const dtv = f.querySelector('[name="data_vencimento"]'); if (dtv) dtv.value = trn.data;
        const dtp = f.querySelector('[name="data_pagamento"]'); if (dtp) dtp.value = trn.data;
        const st = f.querySelector('[name="status"]'); if (st) st.value = trn.tipo === 'credito' ? 'recebido' : 'pago';
        const desc = f.querySelector('[name="descricao"]'); if (desc) desc.value = trn.memo;
        const ori = f.querySelector('[name="origem"]'); if (ori) ori.value = 'ofx';
        const cta = f.querySelector('[name="conta_bancaria"]'); if (cta && imp.conta_bancaria) cta.value = imp.conta_bancaria;
        const conc = f.querySelector('[name="conciliado"]'); if (conc) conc.value = 'true';
      }
    }, 100);
  },

  _onContaSel(sel) {
    const manual = document.getElementById('ofx-conta');
    if (!manual) return;
    if (sel.value === '__manual__') {
      manual.style.display = 'block';
      manual.focus();
    } else {
      manual.style.display = 'none';
    }
  },

  init(obraId) {
    const drop = document.getElementById('ofx-drop');
    const file = document.getElementById('ofx-file');
    if (!drop || !file) return;

    file.addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const result = this._parseOFX(ev.target.result);
          if (!result.transacoes || result.transacoes.length === 0) {
            Utils.toast('Nenhuma transação encontrada no arquivo OFX.', 'warning');
            return;
          }
          this._importData = result;
          this._showParseResult(result);
          const btn = document.getElementById('ofx-import-btn');
          if (btn) btn.style.display = 'inline-flex';
          Utils.toast(`${result.transacoes.length} transações lidas do arquivo`, 'info');
        } catch (err) {
          console.error(err);
          Utils.toast('Erro ao processar arquivo OFX: ' + err.message, 'error');
        }
      };
      reader.readAsText(f, 'latin1');
    });

    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) {
        const inp = document.getElementById('ofx-file');
        const dt = new DataTransfer();
        dt.items.add(f);
        inp.files = dt.files;
        inp.dispatchEvent(new Event('change'));
      }
    });
  }
};
