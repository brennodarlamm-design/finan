// js/ofx.js — OFX Bank Statement Import & Reconciliation

const OFX = {
  _importData: null,

  render(obraId) {
    const imports = DB.getAll('ofximports');
    return `
    <div class="page-header">
      <div><h1 class="page-title">🔄 Importar OFX</h1><p class="page-sub">Conciliação bancária — compare extratos com lançamentos</p></div>
    </div>

    <div class="g2" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-header"><div class="card-title">📂 Importar Extrato OFX</div></div>
        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label">Obra vinculada *</label>
          <select class="form-control" id="ofx-obra">${Utils.clienteOptions(obraId!=='todas'?obraId:'')}</select>
        </div>
        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label">Conta bancária</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <select class="form-control" id="ofx-conta-sel" onchange="OFX._onContaSel(this)" style="flex:1">
              ${Contas.contaOptions('')}
            </select>
            <button type="button" class="btn btn-secondary btn-sm" onclick="App.navigate('configuracoes');Configuracoes._switch('contas')" title="Gerenciar contas" style="white-space:nowrap">➕ Conta</button>
          </div>
          <input class="form-control" id="ofx-conta" placeholder="Ex: Caixa Ag:0501 Cc:123456-7" style="margin-top:6px;display:none">
        </div>
        <div class="drop-zone" id="ofx-drop" onclick="document.getElementById('ofx-file').click()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:44px;height:44px;margin:0 auto 12px;display:block;color:var(--text3)"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p style="font-size:.9rem;font-weight:600;margin-bottom:6px">Arraste o arquivo OFX aqui</p>
          <p style="font-size:.78rem;color:var(--text3)">ou clique para selecionar (.ofx, .qfx)</p>
          <input type="file" id="ofx-file" accept=".ofx,.qfx,.OFX" style="display:none">
        </div>
        <div id="ofx-parse-result" style="margin-top:14px;display:none"></div>
        <div style="margin-top:14px;display:flex;gap:8px;">
          <button class="btn btn-secondary" onclick="OFX.demoOFX()">📋 Usar OFX Demo</button>
          <button class="btn btn-primary" id="ofx-import-btn" onclick="OFX.processImport()" style="display:none">✔ Importar e Conciliar</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">📊 Histórico de Importações</div></div>
        ${imports.length ? `<div class="tbl-wrap" style="border:none"><table>
          <thead><tr><th>Data</th><th>Obra</th><th>Conta</th><th>Período</th><th>Transações</th><th></th></tr></thead>
          <tbody>${imports.map(i=>{
            const c=DB.getById('clientes',i.obra_id);
            const conciliadas=i.transacoes.filter(t=>t.status==='conciliada').length;
            return `<tr>
              <td style="font-size:.78rem">${Utils.fmt.datetime(i.data_importacao)}</td>
              <td style="font-size:.78rem">${c?.nome||'—'}</td>
              <td style="font-size:.78rem">${i.conta_bancaria||'—'}</td>
              <td style="font-size:.78rem">${Utils.fmt.date(i.periodo_inicio)} → ${Utils.fmt.date(i.periodo_fim)}</td>
              <td><span class="badge badge-success">${conciliadas}/${i.transacoes.length}</span></td>
              <td><button class="icon-btn btn-sm" onclick="OFX.viewImport('${i.id}')">👁</button></td>
            </tr>`;}).join('')}
          </tbody></table></div>`
        : '<p style="color:var(--text3);text-align:center;padding:30px;">Nenhum extrato importado ainda</p>'}
      </div>
    </div>

    <div id="ofx-reconcile-panel"></div>`;
  },

  demoOFX() {
    const demo = `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n<OFX><SIGNONMSGSRSV1><SONRS><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS><DTSERVER>20260814120000[-3:BRT]</DTSERVER><LANGUAGE>POR</LANGUAGE></SONRS></SIGNONMSGSRSV1><BANKMSGSRSV1><STMTTRNRS><TRNUID>1</TRNUID><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS><STMTRS><CURDEF>BRL</CURDEF><BANKACCTFROM><BANKID>104</BANKID><ACCTID>123456-7</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM><BANKTRANLIST><DTSTART>20260101120000[-3:BRT]</DTSTART><DTEND>20260814120000[-3:BRT]</DTEND><STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260115120000[-3:BRT]</DTPOSTED><TRNAMT>57000.00</TRNAMT><FITID>20260115001</FITID><MEMO>TED CAIXA ECONOMICA FEDERAL LIBERACAO PARCELA 1</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260120120000[-3:BRT]</DTPOSTED><TRNAMT>-3200.00</TRNAMT><FITID>20260120001</FITID><MEMO>DEBITO MATERIAIS PARA CONSTRUCAO XYZ LTDA</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260120120000[-3:BRT]</DTPOSTED><TRNAMT>-2800.00</TRNAMT><FITID>20260120002</FITID><MEMO>DEBITO AREEIRO SAO BENTO</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260125120000[-3:BRT]</DTPOSTED><TRNAMT>-15000.00</TRNAMT><FITID>20260125001</FITID><MEMO>PIX EMPREITEIRA LIMA FILHOS ME</MEMO></STMTTRN><STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260205120000[-3:BRT]</DTPOSTED><TRNAMT>35000.00</TRNAMT><FITID>20260205001</FITID><MEMO>TED ENTRADA PROPRIA JOAO C FERREIRA</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260210120000[-3:BRT]</DTPOSTED><TRNAMT>-4200.00</TRNAMT><FITID>20260210001</FITID><MEMO>DEBITO SIDERURGICA PAULO CIA</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260215120000[-3:BRT]</DTPOSTED><TRNAMT>-3800.00</TRNAMT><FITID>20260215001</FITID><MEMO>DEBITO CERAMICA VALE VERDE</MEMO></STMTTRN><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260301120000[-3:BRT]</DTPOSTED><TRNAMT>-18000.00</TRNAMT><FITID>20260301001</FITID><MEMO>PIX EMPREITEIRA LIMA FILHOS ME SERVICOS</MEMO></STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>41000.00</BALAMT><DTASOF>20260814120000[-3:BRT]</DTASOF></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const result = this._parseOFX(demo);
    this._importData = result;
    this._showParseResult(result);
    document.getElementById('ofx-import-btn').style.display='flex';
    Utils.toast(`${result.transacoes.length} transações encontradas no OFX demo`,'info');
  },

  _parseOFX(content) {
    const transacoes = [];
    let dtStart='', dtEnd='';
    const dtStartM = content.match(/<DTSTART>(\d{8})/); if(dtStartM) dtStart=`${dtStartM[1].slice(0,4)}-${dtStartM[1].slice(4,6)}-${dtStartM[1].slice(6,8)}`;
    const dtEndM = content.match(/<DTEND>(\d{8})/); if(dtEndM) dtEnd=`${dtEndM[1].slice(0,4)}-${dtEndM[1].slice(4,6)}-${dtEndM[1].slice(6,8)}`;
    const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    let m;
    while ((m=trnRegex.exec(content))!==null) {
      const block=m[1];
      const get=(tag,b)=>{ const r=b.match(new RegExp(`<${tag}>([^<]+)`)); return r?r[1].trim():''; };
      const trnType=get('TRNTYPE',block);
      const dtRaw=get('DTPOSTED',block).slice(0,8);
      const dt=dtRaw.length===8?`${dtRaw.slice(0,4)}-${dtRaw.slice(4,6)}-${dtRaw.slice(6,8)}`:'';
      const amt=parseFloat(get('TRNAMT',block))||0;
      const fitId=get('FITID',block);
      const memo=get('MEMO',block);
      transacoes.push({ id:fitId||DB.uuid(), data:dt, memo, valor:Math.abs(amt), tipo:amt>=0?'credito':'debito', status:'pendente', lancamento_id:null });
    }
    return { transacoes, periodo_inicio:dtStart, periodo_fim:dtEnd };
  },

  _showParseResult(data) {
    const el = document.getElementById('ofx-parse-result');
    const creds = data.transacoes.filter(t=>t.tipo==='credito').reduce((s,t)=>s+t.valor,0);
    const debs = data.transacoes.filter(t=>t.tipo==='debito').reduce((s,t)=>s+t.valor,0);
    el.style.display='block';
    el.innerHTML=`<div style="padding:14px;background:var(--bg-secondary);border-radius:var(--r-md);border:1px solid var(--border-d)">
      <div style="font-weight:700;margin-bottom:10px;color:var(--success)">✅ OFX analisado com sucesso!</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:.8rem">
        <div><div style="color:var(--text3);margin-bottom:3px">Transações</div><div style="font-weight:800;color:var(--accent)">${data.transacoes.length}</div></div>
        <div><div style="color:var(--text3);margin-bottom:3px">Créditos</div><div style="font-weight:800;color:var(--success)">${Utils.fmt.currency(creds)}</div></div>
        <div><div style="color:var(--text3);margin-bottom:3px">Débitos</div><div style="font-weight:800;color:var(--danger)">${Utils.fmt.currency(debs)}</div></div>
        <div><div style="color:var(--text3);margin-bottom:3px">Período</div><div style="font-weight:600;font-size:.72rem">${Utils.fmt.date(data.periodo_inicio)}<br>a ${Utils.fmt.date(data.periodo_fim)}</div></div>
      </div>
    </div>`;
  },

  processImport() {
    if (!this._importData) return;
    const conta_sel = document.getElementById('ofx-conta-sel')?.value;
    const conta_manual = document.getElementById('ofx-conta')?.value||'';
    const conta = (conta_sel && conta_sel !== '__manual__') ? conta_sel : conta_manual;
    const obraId = document.getElementById('ofx-obra')?.value;
    const obraId2 = obraId;
    if (!obraId2) { Utils.toast('Selecione a obra!','warning'); return; }
    const lans = DB.getLancamentos(obraId2);
    // Auto-match by value proximity and date
    const trns = this._importData.transacoes.map(t => {
      const matched = lans.find(l => {
        const valMatch = Math.abs(l.valor - t.valor) < 1;
        const dateMatch = l.data === t.data || Math.abs(new Date(l.data)-new Date(t.data)) < 3*86400000;
        const tipoMatch = (t.tipo==='credito'&&l.tipo==='receita') || (t.tipo==='debito'&&l.tipo==='despesa');
        return valMatch && dateMatch && tipoMatch;
      });
      return { ...t, status: matched?'conciliada':'pendente', lancamento_id: matched?.id||null };
    });
    const importRec = {
      obra_id: obraId2, conta_bancaria: conta,
      data_importacao: new Date().toISOString(),
      periodo_inicio: this._importData.periodo_inicio,
      periodo_fim: this._importData.periodo_fim,
      transacoes: trns
    };
    DB.add('ofximports', importRec);
    this._importData = null;
    document.getElementById('ofx-import-btn').style.display='none';
    document.getElementById('ofx-parse-result').style.display='none';
    const conc = trns.filter(t=>t.status==='conciliada').length;
    Utils.toast(`Importado! ${conc}/${trns.length} transações conciliadas automaticamente.`, 'success');
    OFX.init(App.obraId);
    document.getElementById('route-content').innerHTML = OFX.render(App.obraId);
    OFX.init(App.obraId);
  },

  viewImport(importId) {
    const imp = DB.getById('ofximports', importId);
    if (!imp) return;
    const c = DB.getById('clientes', imp.obra_id);
    const lans = DB.getLancamentos(imp.obra_id);
    const conciliadas = imp.transacoes.filter(t=>t.status==='conciliada').length;
    const pendentes = imp.transacoes.filter(t=>t.status==='pendente').length;
    Utils.showModal(`
      <div class="modal" style="max-width:860px;width:95vw">
        <div class="modal-header">
          <span class="modal-title">⚖ Conciliação — ${c?.nome||''} | ${Utils.fmt.date(imp.periodo_inicio)} a ${Utils.fmt.date(imp.periodo_fim)}</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div style="display:flex;gap:8px;margin-bottom:16px;">
            <span class="badge badge-success">${conciliadas} conciliadas</span>
            <span class="badge badge-warning">${pendentes} pendentes</span>
            <span class="badge badge-secondary">${imp.transacoes.filter(t=>t.status==='ignorada').length} ignoradas</span>
            ${imp.conta_bancaria ? `<span class="badge badge-secondary">🏦 ${imp.conta_bancaria}</span>` : ''}
          </div>
          <div id="rec-list" style="max-height:60vh;overflow-y:auto;">${imp.transacoes.map(t => this._recItem(t, lans, importId)).join('')}</div>
        </div>
      </div>`);
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

  _recItem(t, lans, importId) {
    const matched = t.lancamento_id ? lans.find(l=>l.id===t.lancamento_id) : null;
    const cls = t.status==='conciliada'?'matched':t.status==='ignorada'?'ignored':'';
    const pendLans = lans.filter(l=> Math.abs(l.valor-t.valor)<10 && l.tipo===(t.tipo==='credito'?'receita':'despesa'));
    return `<div class="rec-item ${cls}" id="rec-${t.id}">
      <div style="font-size:20px">${t.tipo==='credito'?'📈':'📉'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.84rem;font-weight:600">${t.memo}</div>
        <div style="font-size:.75rem;color:var(--text3)">${Utils.fmt.date(t.data)} · ${t.tipo==='credito'?'Crédito':'Débito'}</div>
      </div>
      <div style="font-weight:800;white-space:nowrap;color:${t.tipo==='credito'?'var(--success)':'var(--danger)'}">
        ${t.tipo==='credito'?'+':'−'}${Utils.fmt.currency(t.valor)}
      </div>
      <div style="min-width:160px">
        ${t.status==='conciliada'&&matched?`<span style="font-size:.75rem;color:var(--success)">✅ ${matched.descricao.slice(0,25)}...</span>`
        : t.status==='ignorada'?`<span style="font-size:.75rem;color:var(--text3)">Ignorada</span>`
        : pendLans.length?`<select style="background:var(--bg-input);border:1px solid var(--border-d);color:var(--text);border-radius:6px;padding:4px;font-size:.75rem;width:100%" onchange="OFX.conciliar('${importId}','${t.id}',this.value)">
            <option value="">Vincular lançamento...</option>
            ${pendLans.map(l=>`<option value="${l.id}">${l.descricao.slice(0,25)} (${Utils.fmt.currency(l.valor)})</option>`).join('')}
          </select>`
        :`<span style="font-size:.75rem;color:var(--text3)">Sem correspondência</span>`}
      </div>
      <div style="display:flex;gap:4px">
        ${t.status!=='conciliada'&&t.status!=='ignorada'?`<button class="icon-btn btn-sm" onclick="OFX.ignorar('${importId}','${t.id}')" title="Ignorar" style="font-size:11px">✕</button>`:''}
        ${t.status==='conciliada'?`<button class="icon-btn btn-sm" onclick="OFX.desconciliar('${importId}','${t.id}')" title="Desconciliar" style="font-size:11px">↩</button>`:''}
        ${t.status==='pendente'?`<button class="icon-btn btn-sm" onclick="OFX.criarLancamento('${importId}','${t.id}')" title="Criar lançamento" style="font-size:11px;color:var(--accent)">+</button>`:''}
      </div>
    </div>`;
  },

  conciliar(importId, trnId, lanId) {
    if (!lanId) return;
    const imp = DB.getById('ofximports', importId);
    const idx = imp.transacoes.findIndex(t=>t.id===trnId);
    if (idx===-1) return;
    imp.transacoes[idx].status='conciliada';
    imp.transacoes[idx].lancamento_id=lanId;
    DB.update('ofximports', importId, { transacoes: imp.transacoes });
    DB.update('lancamentos', lanId, { conciliado: true });
    this.viewImport(importId);
    Utils.toast('Transação conciliada!','success');
  },

  ignorar(importId, trnId) {
    const imp = DB.getById('ofximports', importId);
    const idx = imp.transacoes.findIndex(t=>t.id===trnId);
    if (idx===-1) return;
    imp.transacoes[idx].status='ignorada';
    DB.update('ofximports', importId, { transacoes: imp.transacoes });
    this.viewImport(importId);
  },

  desconciliar(importId, trnId) {
    const imp = DB.getById('ofximports', importId);
    const idx = imp.transacoes.findIndex(t=>t.id===trnId);
    if (idx===-1) return;
    const lanId = imp.transacoes[idx].lancamento_id;
    imp.transacoes[idx].status='pendente';
    imp.transacoes[idx].lancamento_id=null;
    DB.update('ofximports', importId, { transacoes: imp.transacoes });
    if (lanId) DB.update('lancamentos', lanId, { conciliado: false });
    this.viewImport(importId);
  },

  criarLancamento(importId, trnId) {
    const imp = DB.getById('ofximports', importId);
    const trn = imp?.transacoes.find(t=>t.id===trnId);
    if (!trn) return;
    Lancamentos.showForm(trn.tipo==='credito'?'receita':'despesa');
    setTimeout(()=>{
      const f = document.getElementById('f-lan');
      if(f){
        const v=f.querySelector('[name="valor"]'); if(v) v.value=trn.valor;
        const dt=f.querySelector('[name="data"]'); if(dt) dt.value=trn.data;
        const desc=f.querySelector('[name="descricao"]'); if(desc) desc.value=trn.memo;
        const ob=f.querySelector('[name="obra_id"]'); if(ob) ob.value=imp.obra_id;
        const ori=f.querySelector('[name="origem"]'); if(ori) ori.value='ofx';
      }
    },100);
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
        const result = this._parseOFX(ev.target.result);
        this._importData = result;
        this._showParseResult(result);
        document.getElementById('ofx-import-btn').style.display='flex';
        Utils.toast(`${result.transacoes.length} transações lidas do arquivo`,'info');
      };
      reader.readAsText(f,'latin1');
    });
    drop.addEventListener('dragover',e=>{ e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave',()=>drop.classList.remove('drag-over'));
    drop.addEventListener('drop',e=>{ e.preventDefault(); drop.classList.remove('drag-over'); const f=e.dataTransfer.files[0]; if(f){const inp=document.getElementById('ofx-file');const dt=new DataTransfer();dt.items.add(f);inp.files=dt.files;inp.dispatchEvent(new Event('change'));} });
  }
};
