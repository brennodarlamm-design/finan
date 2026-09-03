// js/ofx.js — OFX Bank Statement Import & Smart Multi-Project Conciliation (Robô Inteligente com Filtro por Aproximação de Valor)

const OFX = {
  _importData: null,
  _reconcileContext: null,
  _activeFilterTab: 'todas',
  _activeSearchTerm: '',
  
  // Configurações padrão do Robô Inteligente
  _toleranciaValor: 10,       // R$ 10 padrão (ou string 'pct:2')
  _toleranciaDias: 7,         // ± 7 dias padrão
  _toleranciaScoreMin: 50,

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

        <!-- Painel de Configuração do Robô Inteligente para a Importação -->
        <div style="background:rgba(201,162,39,0.05);border:1px solid rgba(201,162,39,0.25);border-radius:var(--r-md);padding:12px 14px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-size:1.1rem;">🤖</span>
            <span style="font-weight:700;font-size:.85rem;color:var(--accent);">Robô Inteligente de Conciliação</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label style="font-size:.72rem;color:var(--text2);display:block;margin-bottom:3px;font-weight:600;">Filtro por Aproximação de Valor</label>
              <select class="form-control" id="ofx-tol-valor" style="font-size:.78rem;padding:5px 8px;" onchange="OFX._toleranciaValor = this.value">
                <option value="0">🎯 Exato (R$ 0,00)</option>
                <option value="1">🤏 ± R$ 1,00 (Centavos)</option>
                <option value="5">💵 ± R$ 5,00 (Pequenas tarifas)</option>
                <option value="10" selected>💵 ± R$ 10,00 (Padrão)</option>
                <option value="25">💰 ± R$ 25,00</option>
                <option value="50">💰 ± R$ 50,00</option>
                <option value="100">💼 ± R$ 100,00</option>
                <option value="200">💼 ± R$ 200,00</option>
                <option value="pct:1">📊 ± 1% do valor</option>
                <option value="pct:2">📊 ± 2% do valor</option>
                <option value="pct:5">📊 ± 5% do valor</option>
              </select>
            </div>
            <div>
              <label style="font-size:.72rem;color:var(--text2);display:block;margin-bottom:3px;font-weight:600;">Margem de Datas</label>
              <select class="form-control" id="ofx-tol-dias" style="font-size:.78rem;padding:5px 8px;" onchange="OFX._toleranciaDias = parseInt(this.value)">
                <option value="0">📅 Mesmo dia (0 dias)</option>
                <option value="3">📅 ± 3 dias</option>
                <option value="7" selected>📅 ± 7 dias (Padrão)</option>
                <option value="15">📅 ± 15 dias</option>
                <option value="30">📅 ± 30 dias (Mesmo mês)</option>
                <option value="999">📅 Sem restrição de data</option>
              </select>
            </div>
          </div>
        </div>

        <div class="drop-zone" id="ofx-drop" onclick="document.getElementById('ofx-file').click()" style="padding:28px 20px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:38px;height:38px;margin:0 auto 10px;display:block;color:var(--accent)"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p style="font-size:.92rem;font-weight:700;margin-bottom:4px">Arraste seu extrato bancário OFX aqui</p>
          <p style="font-size:.78rem;color:var(--text3)">Compatível com Caixa, BB, Bradesco, Itaú, Santander, Sicredi, Sicoob, Inter, Nubank (.ofx, .qfx)</p>
          <input type="file" id="ofx-file" accept=".ofx,.qfx,.OFX,.QFX" style="display:none">
        </div>

        <div id="ofx-parse-result" style="margin-top:14px;display:none"></div>

        <div style="margin-top:16px;display:flex;gap:8px;align-items:center;justify-content:space-between;">
          <button class="btn btn-secondary" onclick="OFX.demoOFX()">📋 Carregar OFX Demo</button>
          <button class="btn btn-primary" id="ofx-import-btn" onclick="OFX.processImport()" style="display:none;font-weight:700;">✔ Importar e Conciliar com Robô</button>
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

  // Retorna a tolerância máxima em R$ a partir do valor base e da regra configurada
  _calcularDiferencaMax(valorExtrato, tol) {
    if (typeof tol === 'string' && tol.startsWith('pct:')) {
      const pct = parseFloat(tol.split(':')[1]) || 0;
      return (Number(valorExtrato) * pct) / 100;
    }
    return parseFloat(tol) || 0;
  },

  // Algoritmo do Robô Inteligente para avaliar match entre transação e lançamento
  _avaliarMatch(trn, lan, tolValor, tolDias) {
    const isCredit = trn.tipo === 'credito';
    const isReceita = lan.tipo === 'receita';
    if ((isCredit && !isReceita) || (!isCredit && isReceita)) return null;

    const vTrn = Number(trn.valor);
    const vLan = Number(lan.valor);
    const diffValor = Math.abs(vLan - vTrn);
    const maxDiffValor = this._calcularDiferencaMax(vTrn, tolValor);

    // Se ultrapassar a tolerância de valor, não combina
    if (diffValor > maxDiffValor) return null;

    const dLanStr = lan.data_pagamento || lan.data_vencimento || lan.data;
    let diffDias = 0;
    if (dLanStr && trn.data) {
      diffDias = Math.abs(new Date(dLanStr) - new Date(trn.data)) / (86400000);
    }

    // Se ultrapassar a tolerância de dias, não combina
    if (diffDias > tolDias) return null;

    // Cálculo do Score de Confiança do Robô (0 a 100%)
    let scoreValor = maxDiffValor > 0 ? (1 - (diffValor / (maxDiffValor || 1))) * 45 : 45;
    if (diffValor < 0.05) scoreValor = 50; // valor exato ganha bônus

    let scoreData = tolDias > 0 ? (1 - (diffDias / (tolDias || 1))) * 30 : 30;
    if (diffDias === 0) scoreData = 35; // mesmo dia ganha bônus

    // Similaridade de texto / palavras-chave no Memo e Descrição
    let scoreTexto = 0;
    const memoWords = (trn.memo || '').toLowerCase().split(/[\s,.-]+/).filter(w => w.length > 2);
    const descText = `${lan.descricao || ''} ${lan.fornecedor_beneficiario || ''}`.toLowerCase();
    let wordsMatched = 0;
    memoWords.forEach(w => { if (descText.includes(w)) wordsMatched++; });
    if (memoWords.length > 0) {
      scoreTexto = Math.min(15, (wordsMatched / memoWords.length) * 15);
    }

    const scoreTotal = Math.min(100, Math.round(scoreValor + scoreData + scoreTexto));

    return {
      lancamento: lan,
      transacao: trn,
      diffValor,
      diffDias: Math.round(diffDias),
      score: scoreTotal,
      isExato: diffValor < 0.05
    };
  },

  processImport() {
    if (!this._importData || !this._importData.transacoes.length) {
      Utils.toast('Nenhum dado de extrato carregado para importar.', 'warning');
      return;
    }

    const conta_sel = document.getElementById('ofx-conta-sel')?.value;
    const conta_manual = document.getElementById('ofx-conta')?.value || '';
    const conta = (conta_sel && conta_sel !== '__manual__') ? conta_sel : conta_manual;

    const tolValor = document.getElementById('ofx-tol-valor')?.value || this._toleranciaValor;
    const tolDias = parseInt(document.getElementById('ofx-tol-dias')?.value) || this._toleranciaDias;

    // Fetch ALL non-deleted transactions across all obras and headquarters
    const allLans = DB.getLancamentos(null);
    const unconciliatedLans = allLans.filter(l => !l.conciliado);

    let autoMatchedCount = 0;
    const matchedLanIds = new Set();

    const trns = this._importData.transacoes.map(t => {
      // Busca melhor match disponível pelo Robô Inteligente
      let bestMatch = null;
      for (const lan of unconciliatedLans) {
        if (matchedLanIds.has(lan.id)) continue;
        const res = OFX._avaliarMatch(t, lan, tolValor, tolDias);
        if (res && res.score >= OFX._toleranciaScoreMin) {
          if (!bestMatch || res.score > bestMatch.score) {
            bestMatch = res;
          }
        }
      }

      if (bestMatch) {
        autoMatchedCount++;
        matchedLanIds.add(bestMatch.lancamento.id);
        DB.update('lancamentos', bestMatch.lancamento.id, { conciliado: true });
        return {
          ...t,
          status: 'conciliada',
          lancamento_id: bestMatch.lancamento.id,
          match_score: bestMatch.score,
          match_diff_valor: bestMatch.diffValor
        };
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

    Utils.toast(`Extrato importado! Robô conciliou ${autoMatchedCount}/${trns.length} transações com base no filtro de aproximação.`, 'success');

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
      <div class="modal" style="max-width:960px;width:95vw;max-height:92vh;display:flex;flex-direction:column;">
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
          
          <!-- Barra do Robô Inteligente de Conciliação com Filtro por Aproximação -->
          <div style="background:linear-gradient(135deg,rgba(201,162,39,0.08),rgba(201,162,39,0.02));border:1px solid rgba(201,162,39,0.3);border-radius:var(--r-md);padding:12px 16px;margin-bottom:16px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:1.4rem;">🤖</span>
              <div>
                <div style="font-weight:800;font-size:.88rem;color:var(--accent);display:flex;align-items:center;gap:6px;">
                  Robô Inteligente de Auto-Conciliação
                  <span class="badge badge-info" style="font-size:.65rem;">Filtro por Aproximação</span>
                </div>
                <div style="font-size:.74rem;color:var(--text2);margin-top:2px;">
                  Cruza as transações bancárias com lançamentos de todas as obras considerando margem de valor e datas.
                </div>
              </div>
            </div>

            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <label style="font-size:.72rem;color:var(--text3);font-weight:600;white-space:nowrap;">Aproximação Valor:</label>
                <select id="modal-tol-valor" class="form-control" style="font-size:.75rem;padding:4px 8px;width:auto;" onchange="OFX._onMudarToleranciaModal('${importId}', this.value, null)">
                  <option value="0" ${OFX._toleranciaValor==='0'||OFX._toleranciaValor===0?'selected':''}>🎯 Exato (R$ 0)</option>
                  <option value="1" ${OFX._toleranciaValor==='1'||OFX._toleranciaValor===1?'selected':''}>🤏 ± R$ 1,00</option>
                  <option value="5" ${OFX._toleranciaValor==='5'||OFX._toleranciaValor===5?'selected':''}>💵 ± R$ 5,00</option>
                  <option value="10" ${OFX._toleranciaValor==='10'||OFX._toleranciaValor===10?'selected':''}>💵 ± R$ 10,00</option>
                  <option value="25" ${OFX._toleranciaValor==='25'||OFX._toleranciaValor===25?'selected':''}>💰 ± R$ 25,00</option>
                  <option value="50" ${OFX._toleranciaValor==='50'||OFX._toleranciaValor===50?'selected':''}>💰 ± R$ 50,00</option>
                  <option value="100" ${OFX._toleranciaValor==='100'||OFX._toleranciaValor===100?'selected':''}>💼 ± R$ 100,00</option>
                  <option value="200" ${OFX._toleranciaValor==='200'||OFX._toleranciaValor===200?'selected':''}>💼 ± R$ 200,00</option>
                  <option value="pct:1" ${OFX._toleranciaValor==='pct:1'?'selected':''}>📊 ± 1%</option>
                  <option value="pct:2" ${OFX._toleranciaValor==='pct:2'?'selected':''}>📊 ± 2%</option>
                  <option value="pct:5" ${OFX._toleranciaValor==='pct:5'?'selected':''}>📊 ± 5%</option>
                </select>
              </div>

              <div style="display:flex;align-items:center;gap:6px;">
                <label style="font-size:.72rem;color:var(--text3);font-weight:600;white-space:nowrap;">Datas:</label>
                <select id="modal-tol-dias" class="form-control" style="font-size:.75rem;padding:4px 8px;width:auto;" onchange="OFX._onMudarToleranciaModal('${importId}', null, this.value)">
                  <option value="0" ${OFX._toleranciaDias===0?'selected':''}>📅 Mesmo dia</option>
                  <option value="3" ${OFX._toleranciaDias===3?'selected':''}>📅 ± 3 dias</option>
                  <option value="7" ${OFX._toleranciaDias===7?'selected':''}>📅 ± 7 dias</option>
                  <option value="15" ${OFX._toleranciaDias===15?'selected':''}>📅 ± 15 dias</option>
                  <option value="30" ${OFX._toleranciaDias===30?'selected':''}>📅 ± 30 dias</option>
                  <option value="999" ${OFX._toleranciaDias===999?'selected':''}>📅 Sem limite</option>
                </select>
              </div>

              <button class="btn btn-primary btn-sm" onclick="OFX._abrirModalRobo('${importId}')" style="font-weight:700;padding:6px 12px;display:flex;align-items:center;gap:4px;box-shadow:var(--shadow-accent);">
                <span>⚡ Executar Robô</span>
              </button>
            </div>
          </div>

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

  _onMudarToleranciaModal(importId, tolValor, tolDias) {
    if (tolValor !== null) this._toleranciaValor = tolValor;
    if (tolDias !== null) this._toleranciaDias = parseInt(tolDias);
    this.viewImport(importId, this._activeFilterTab, this._activeSearchTerm);
  },

  // Modal com o relatório de sugestões do Robô Inteligente
  _abrirModalRobo(importId) {
    const imp = DB.getById('ofximports', importId);
    if (!imp) return;

    const allLans = DB.getLancamentos(null);
    const clientesMap = Object.fromEntries((DB.getAll('clientes') || []).map(c => [c.id, c]));
    const pendentes = (imp.transacoes || []).filter(t => t.status === 'pendente');
    const unconciliatedLans = allLans.filter(l => !l.conciliado);

    const matchesEncontrados = [];
    const matchedLanIds = new Set();

    pendentes.forEach(trn => {
      let best = null;
      unconciliatedLans.forEach(lan => {
        if (matchedLanIds.has(lan.id)) return;
        const res = OFX._avaliarMatch(trn, lan, OFX._toleranciaValor, OFX._toleranciaDias);
        if (res && res.score >= OFX._toleranciaScoreMin) {
          if (!best || res.score > best.score) {
            best = res;
          }
        }
      });

      if (best) {
        matchedLanIds.add(best.lancamento.id);
        matchesEncontrados.push(best);
      }
    });

    const tolLabel = typeof OFX._toleranciaValor === 'string' && OFX._toleranciaValor.startsWith('pct:')
      ? `± ${OFX._toleranciaValor.split(':')[1]}%`
      : `± R$ ${OFX._toleranciaValor},00`;

    Utils.showModal(`
      <div class="modal" style="max-width:880px;width:95vw;max-height:85vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="border-bottom:1px solid var(--border-s);padding:14px 20px;">
          <div>
            <div class="modal-title" style="display:flex;align-items:center;gap:8px;">
              <span>🤖 Sugestões do Robô Inteligente</span>
              <span class="badge badge-warning" style="font-size:.72rem;">Filtro: ${tolLabel} · ± ${OFX._toleranciaDias} dias</span>
            </div>
            <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">
              O robô analisou as ${pendentes.length} transações pendentes e encontrou ${matchesEncontrados.length} correspondência(s).
            </div>
          </div>
          <button class="modal-close" onclick="OFX.viewImport('${importId}')">✕</button>
        </div>

        <div class="modal-body" style="padding:16px 20px;overflow-y:auto;flex:1;">
          ${matchesEncontrados.length > 0 ? `
            <div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:.82rem;color:var(--text2);">Revise as sugestões calculadas pelo robô:</span>
              <button class="btn btn-primary btn-sm" onclick="OFX._confirmarTodosMatchesRobo('${importId}')" style="font-weight:700;">
                ⚡ Conciliar Todas (${matchesEncontrados.length})
              </button>
            </div>

            <div class="tbl-wrap" style="border:none;">
              <table>
                <thead>
                  <tr>
                    <th>Transação Extrato OFX</th>
                    <th>Valor Extrato</th>
                    <th style="text-align:center">Confiança</th>
                    <th>Lançamento do Sistema</th>
                    <th>Obra / Centro</th>
                    <th>Diferença</th>
                    <th style="text-align:right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  ${matchesEncontrados.map(m => {
                    const trn = m.transacao;
                    const lan = m.lancamento;
                    const obNome = lan.obra_id === 'escritorio' ? '🏢 Sede' : (clientesMap[lan.obra_id]?.nome || 'Obra');
                    const isCredit = trn.tipo === 'credito';
                    const diffFmt = m.diffValor === 0 ? '<span style="color:var(--success);font-weight:700;">Exato (R$ 0)</span>' : `<span style="color:var(--warning);font-weight:700;">± ${Utils.fmt.currency(m.diffValor)}</span>`;
                    const scoreBadgeCls = m.score >= 90 ? 'badge-success' : m.score >= 70 ? 'badge-warning' : 'badge-secondary';

                    return `<tr>
                      <td style="font-size:.78rem;font-weight:600;">
                        ${isCredit?'📈':'📉'} ${trn.memo.slice(0,28)}<br>
                        <span style="font-size:.7rem;color:var(--text3);">📅 ${Utils.fmt.date(trn.data)}</span>
                      </td>
                      <td style="font-size:.82rem;font-weight:800;color:${isCredit?'var(--success)':'var(--danger)'};white-space:nowrap;">
                        ${Utils.fmt.currency(trn.valor)}
                      </td>
                      <td style="text-align:center;">
                        <span class="badge ${scoreBadgeCls}" style="font-size:.72rem;">${m.score}%</span>
                      </td>
                      <td style="font-size:.78rem;">
                        <strong>${lan.descricao.slice(0,30)}</strong><br>
                        <span style="font-size:.7rem;color:var(--text3);">${Utils.fmt.date(lan.data)} · ${Utils.fmt.currency(lan.valor)}</span>
                      </td>
                      <td style="font-size:.76rem;color:var(--accent);">
                        ${obNome}
                      </td>
                      <td style="font-size:.75rem;white-space:nowrap;">
                        ${diffFmt}
                      </td>
                      <td style="text-align:right;white-space:nowrap;">
                        <button class="btn btn-secondary btn-sm" onclick="OFX.conciliar('${importId}','${trn.id}','${lan.id}');OFX._abrirModalRobo('${importId}');" style="padding:3px 8px;font-size:.72rem;">✔ Conciliar</button>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty-state" style="padding:40px 10px;">
              <span style="font-size:2.5rem;display:block;margin-bottom:10px;">🔍</span>
              <p style="font-size:.92rem;font-weight:700;color:var(--text);">Nenhuma correspondência adicional encontrada</p>
              <p style="font-size:.78rem;color:var(--text3);margin-top:4px;">Tente aumentar o filtro de aproximação de valor (ex: ± R$ 50 ou ± 5%) ou a margem de datas.</p>
            </div>
          `}
        </div>

        <div class="modal-footer" style="padding:12px 20px;border-top:1px solid var(--border-s);justify-content:flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="OFX.viewImport('${importId}')">Voltar à Conciliação</button>
        </div>
      </div>
    `);
  },

  _confirmarTodosMatchesRobo(importId) {
    const imp = DB.getById('ofximports', importId);
    if (!imp) return;

    const allLans = DB.getLancamentos(null);
    const pendentes = (imp.transacoes || []).filter(t => t.status === 'pendente');
    const unconciliatedLans = allLans.filter(l => !l.conciliado);

    const matchedLanIds = new Set();
    let count = 0;

    pendentes.forEach(trn => {
      let best = null;
      unconciliatedLans.forEach(lan => {
        if (matchedLanIds.has(lan.id)) return;
        const res = OFX._avaliarMatch(trn, lan, OFX._toleranciaValor, OFX._toleranciaDias);
        if (res && res.score >= OFX._toleranciaScoreMin) {
          if (!best || res.score > best.score) {
            best = res;
          }
        }
      });

      if (best) {
        matchedLanIds.add(best.lancamento.id);
        const idx = imp.transacoes.findIndex(t => t.id === trn.id);
        if (idx !== -1) {
          imp.transacoes[idx].status = 'conciliada';
          imp.transacoes[idx].lancamento_id = best.lancamento.id;
          imp.transacoes[idx].match_score = best.score;
          DB.update('lancamentos', best.lancamento.id, { conciliado: true });
          count++;
        }
      }
    });

    DB.update('ofximports', importId, { transacoes: imp.transacoes });
    Utils.toast(`Robô conciliou ${count} transações em lote com sucesso!`, 'success');
    this.viewImport(importId);
  },

  _recItem(t, allLans, clientesMap, importId) {
    const isCredit = t.tipo === 'credito';
    const matched = t.lancamento_id ? allLans.find(l => l.id === t.lancamento_id) : null;
    const cls = t.status === 'conciliada' ? 'matched' : t.status === 'ignorada' ? 'ignored' : '';

    // If pending, find candidate matches across ALL obras + sede considering the proximity filter
    let candidateOptionsHtml = '';
    if (t.status === 'pendente') {
      const neededType = isCredit ? 'receita' : 'despesa';
      const maxDiff = this._calcularDiferencaMax(t.valor, this._toleranciaValor);

      // Avalia cada lançamento com o algoritmo do robô
      const scoredCandidates = allLans
        .filter(l => !l.conciliado && l.tipo === neededType)
        .map(l => OFX._avaliarMatch(t, l, OFX._toleranciaValor, OFX._toleranciaDias))
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

      // Também inclui outros lançamentos próximos se a lista for pequena
      let extraLans = [];
      if (scoredCandidates.length < 4) {
        extraLans = allLans.filter(l => !l.conciliado && l.tipo === neededType && !scoredCandidates.some(c => c.lancamento.id === l.id)).slice(0, 10);
      }

      candidateOptionsHtml = `
        <select style="background:var(--bg-input);border:1px solid var(--border-d);color:var(--text);border-radius:6px;padding:6px;font-size:.75rem;width:100%;max-width:280px;" onchange="OFX.conciliar('${importId}','${t.id}',this.value)">
          <option value="">➕ Vincular lançamento...</option>
          ${scoredCandidates.length > 0 ? `<optgroup label="🤖 Sugestões do Robô (${scoredCandidates.length})">${scoredCandidates.map(c => {
            const l = c.lancamento;
            const obNome = l.obra_id === 'escritorio' ? '🏢 Sede' : (clientesMap[l.obra_id]?.nome || 'Obra');
            const diffTxt = c.diffValor === 0 ? 'Exato' : `±${Utils.fmt.currency(c.diffValor)}`;
            return `<option value="${l.id}">[${obNome}] ${l.descricao.slice(0, 24)} (${Utils.fmt.currency(l.valor)} · ${diffTxt} · ${c.score}%)</option>`;
          }).join('')}</optgroup>` : ''}
          ${extraLans.length > 0 ? `<optgroup label="📋 Outros Lançamentos">${extraLans.map(l => {
            const obNome = l.obra_id === 'escritorio' ? '🏢 Sede' : (clientesMap[l.obra_id]?.nome || 'Obra');
            return `<option value="${l.id}">[${obNome}] ${l.descricao.slice(0, 24)} (${Utils.fmt.currency(l.valor)} - ${Utils.fmt.date(l.data)})</option>`;
          }).join('')}</optgroup>` : ''}
        </select>
      `;
    }

    let matchedHtml = '';
    if (t.status === 'conciliada' && matched) {
      const obNome = matched.obra_id === 'escritorio' ? '🏢 Sede / Escritório' : (clientesMap[matched.obra_id]?.nome || 'Obra');
      const diffVal = Math.abs(Number(matched.valor) - Number(t.valor));
      const diffLabel = diffVal > 0.05 ? `<span style="font-size:.68rem;color:var(--warning);font-weight:600;">(Dif: ±${Utils.fmt.currency(diffVal)})</span>` : '';
      matchedHtml = `
        <div style="font-size:.76rem;color:var(--success);display:flex;flex-direction:column;">
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-weight:700;">✅ [${obNome}]</span>
            ${diffLabel}
          </div>
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

      <div style="min-width:230px;flex-shrink:0;">
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
