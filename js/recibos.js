// js/recibos.js — Módulo Gerador e Emissor de Recibos Profissionais Angelim Construtora

const Recibos = {
  _KEY: 'finobra_recibos',

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this._KEY) || '[]');
    } catch { return []; }
  },

  salvarLista(recibos) {
    localStorage.setItem(this._KEY, JSON.stringify(recibos));
  },

  getById(id) {
    return this.getAll().find(r => r.id === id) || null;
  },

  adicionar(recibo) {
    const recibos = this.getAll();
    const item = {
      id: 'rec_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      numero: this._proximoNumero(),
      criado_em: new Date().toISOString(),
      ...recibo
    };
    recibos.unshift(item);
    this.salvarLista(recibos);
    return item;
  },

  remover(id) {
    const recibos = this.getAll().filter(r => r.id !== id);
    this.salvarLista(recibos);
  },

  _proximoNumero() {
    const recibos = this.getAll();
    if (!recibos.length) return '0001/2026';
    const num = recibos.length + 1;
    const ano = new Date().getFullYear();
    return `${String(num).padStart(4, '0')}/${ano}`;
  },

  init(obraId) {
    // Inicialização da página de recibos se necessário
  },

  // ─────────────────────────────────────────────────────────────
  // RENDERIZAÇÃO DA PÁGINA DE RECIBOS (#recibos)
  // ─────────────────────────────────────────────────────────────
  render(obraId) {
    const recibos = this.getAll();
    const cs = DB.getAll('clientes');
    const filtrados = obraId && obraId !== 'todas' ? recibos.filter(r => r.obra_id === obraId) : recibos;

    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">🧾 Emissão de Recibos</h1>
        <p class="page-sub">Gere recibos de pagamento de mão de obra, fornecedores e clientes com valor por extenso automático</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="Recibos.novoReciboModal()">
          + Novo Recibo Avulso
        </button>
      </div>
    </div>

    <!-- Tabela de Histórico de Recibos Emitidos -->
    <div class="card" style="padding:0;">
      <div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--border);">
        <div class="card-title">📜 Recibos Emitidos (${filtrados.length})</div>
      </div>
      <div class="tbl-wrap" style="border:none;border-radius:0 0 14px 14px;">
        <table>
          <thead>
            <tr>
              <th>Nº Recibo</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Obra / Cliente</th>
              <th>Beneficiário / Recebedor</th>
              <th>Referente a</th>
              <th style="text-align:right;">Valor</th>
              <th style="text-align:center;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filtrados.length ? filtrados.map(r => this._renderReciboRow(r)).join('') : `
            <tr>
              <td colspan="8" style="text-align:center;padding:36px;color:var(--text3);">
                Nenhum recibo emitido ainda. Clique em "+ Novo Recibo" ou emita diretamente na tela de Lançamentos.
              </td>
            </tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  _renderReciboRow(r) {
    const c = DB.getById('clientes', r.obra_id);
    const tipoLabel = r.tipo === 'pagamento' ? '<span class="badge badge-danger">Pagamento</span>' : '<span class="badge badge-success">Recebimento</span>';

    return `
    <tr>
      <td style="font-weight:800;color:var(--accent);font-family:monospace;white-space:nowrap;">${r.numero}</td>
      <td style="white-space:nowrap;font-weight:600;">${Utils.fmt.date(r.data)}</td>
      <td>${tipoLabel}</td>
      <td style="color:var(--text2);font-weight:600;">${c?.nome || r.obra_nome || '&mdash;'}</td>
      <td><strong style="color:var(--text);">${r.beneficiario_nome}</strong>${r.beneficiario_doc ? `<div style="font-size:.72rem;color:var(--text3);">${r.beneficiario_doc}</div>` : ''}</td>
      <td style="max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${r.referente}">${r.referente}</td>
      <td style="text-align:right;font-weight:900;color:var(--text);white-space:nowrap;">${Utils.fmt.currency(r.valor)}</td>
      <td style="text-align:center;">
        <div style="display:flex;gap:6px;justify-content:center;">
          <button class="btn btn-sm btn-primary" onclick="Recibos.visualizarRecibo('${r.id}')" title="Visualizar e Imprimir Recibo">
            👁️ Ver / Imprimir
          </button>
          <button class="icon-btn btn-sm" onclick="Recibos._confirmDel('${r.id}')" style="color:var(--danger);" title="Excluir recibo">
            🗑️
          </button>
        </div>
      </td>
    </tr>`;
  },

  // ─────────────────────────────────────────────────────────────
  // MODAL PARA EMITIR NOVO RECIBO (AVULSO OU VIA LANÇAMENTO)
  // ─────────────────────────────────────────────────────────────
  novoReciboModal(dadosPreenchidos = {}) {
    const cs = DB.getAll('clientes');
    const hoje = Utils.today();
    const valorPadrao = dadosPreenchidos.valor || '';
    const extensoPadrao = valorPadrao ? Utils.extenso(valorPadrao) : '';

    Utils.showModal(`
      <div class="modal" style="max-width:680px;">
        <div class="modal-header">
          <span class="modal-title">🧾 Emitir Recibo Oficial</span>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <form id="f-recibo">
            <input type="hidden" name="lancamento_id" value="${dadosPreenchidos.lancamento_id || ''}">

            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Tipo de Recibo *</label>
                <select class="form-control" name="tipo" id="rec-tipo" onchange="Recibos._onTipoChange(this.value)">
                  <option value="pagamento" ${dadosPreenchidos.tipo==='despesa'||dadosPreenchidos.tipo==='pagamento'?'selected':''}>Pagamento Efetuado (A Construtora pagou ao prestador/fornecedor)</option>
                  <option value="recebimento" ${dadosPreenchidos.tipo==='receita'||dadosPreenchidos.tipo==='recebimento'?'selected':''}>Recebimento (A Construtora recebeu do cliente)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Obra Vinculada</label>
                <select class="form-control" name="obra_id">
                  <option value="">Geral / Sem obra específica</option>
                  ${cs.map(c => `<option value="${c.id}" ${c.id===(dadosPreenchidos.obra_id||App.obraId)?'selected':''}>${c.nome} &mdash; ${c.cidade}/${c.estado}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label" id="lbl-rec-pagador">Pagador (Quem paga) *</label>
                <input class="form-control" name="pagador_nome" id="rec-pagador-nome" value="${dadosPreenchidos.pagador_nome || 'Angelim Construtora LTDA'}" required>
              </div>
              <div class="form-group">
                <label class="form-label">CPF / CNPJ do Pagador</label>
                <input class="form-control" name="pagador_doc" id="rec-pagador-doc" value="${dadosPreenchidos.pagador_doc || '12.345.678/0001-90'}" placeholder="00.000.000/0001-00">
              </div>
            </div>

            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label" id="lbl-rec-beneficiario">Beneficiário (Quem recebe) *</label>
                <input class="form-control" name="beneficiario_nome" id="rec-beneficiario-nome" value="${dadosPreenchidos.fornecedor_beneficiario || dadosPreenchidos.beneficiario_nome || ''}" required placeholder="Nome do profissional, pedreiro ou empresa">
              </div>
              <div class="form-group">
                <label class="form-label">CPF / CNPJ do Beneficiário</label>
                <input class="form-control" name="beneficiario_doc" value="${dadosPreenchidos.beneficiario_doc || ''}" placeholder="000.000.000-00">
              </div>
            </div>

            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Valor (R$) *</label>
                <div class="input-prefix">
                  <span class="input-pfx-txt">R$</span>
                  <input class="form-control" type="number" step="0.01" min="0.01" name="valor" id="rec-valor" value="${valorPadrao}" required placeholder="0,00" oninput="Recibos._onValorInput(this.value)">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Data da Emissão *</label>
                <input class="form-control" type="date" name="data" value="${dadosPreenchidos.data || hoje}" required>
              </div>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Valor por Extenso (Gerado Automaticamente)</label>
              <input class="form-control" name="valor_extenso" id="rec-extenso" value="${extensoPadrao}" readonly style="background:var(--bg-secondary);color:var(--accent);font-weight:700;">
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Referente a (Descrição detalhada) *</label>
              <textarea class="form-control" name="referente" rows="2" required placeholder="Ex: Serviços de alvenaria e reboco executados na etapa 02 da residência">${dadosPreenchidos.descricao || dadosPreenchidos.referente || ''}</textarea>
            </div>

            <div class="form-row cols-2" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Cidade e Estado de Emissão *</label>
                <input class="form-control" name="cidade_uf" value="${dadosPreenchidos.cidade_uf || 'Boa Vista - RR'}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Forma de Pagamento</label>
                <select class="form-control" name="forma_pagamento">
                  <option value="PIX">Transferência Instantânea (PIX)</option>
                  <option value="TED/DOC">Transferência Bancária (TED/DOC)</option>
                  <option value="Dinheiro">Dinheiro em Espécie</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Boleto">Boleto Bancário</option>
                </select>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="Recibos.gerarReciboSubmit()">
            📄 Gerar &amp; Visualizar Recibo
          </button>
        </div>
      </div>
    `);
  },

  _onValorInput(val) {
    const ext = document.getElementById('rec-extenso');
    if (ext) {
      ext.value = val ? Utils.extenso(val) : '';
    }
  },

  _onTipoChange(tipo) {
    const pagadorNome = document.getElementById('rec-pagador-nome');
    const pagadorDoc = document.getElementById('rec-pagador-doc');
    if (tipo === 'pagamento') {
      if (pagadorNome) pagadorNome.value = 'Angelim Construtora LTDA';
      if (pagadorDoc) pagadorDoc.value = '12.345.678/0001-90';
    } else {
      if (pagadorNome) pagadorNome.value = '';
      if (pagadorDoc) pagadorDoc.value = '';
    }
  },

  gerarReciboSubmit() {
    const f = document.getElementById('f-recibo');
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const fd = new FormData(f);
    const d = Object.fromEntries(fd);
    d.valor = parseFloat(d.valor) || 0;
    d.valor_extenso = d.valor_extenso || Utils.extenso(d.valor);

    const novoRecibo = this.adicionar(d);
    Utils.toast('Recibo emitido com sucesso!', 'success');
    Utils.closeModal();

    // Se vinculado a um lançamento, salvar automaticamente como anexo
    if (d.lancamento_id && typeof Documentos !== 'undefined') {
      const htmlRecibo = this.gerarHTMLRecibo(novoRecibo);
      Documentos.adicionar({
        entidade_tipo: 'lancamento',
        entidade_id: d.lancamento_id,
        titulo: `Recibo Oficial ${novoRecibo.numero}`,
        nome_arquivo: `Recibo_${novoRecibo.numero.replace('/','-')}.html`,
        tipo_mime: 'text/html',
        tamanho: htmlRecibo.length,
        data_base64: 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlRecibo)
      });
    }

    setTimeout(() => this.visualizarRecibo(novoRecibo.id), 200);
  },

  _confirmDel(id) {
    Utils.confirm('Excluir este recibo do histórico?', () => {
      this.remover(id);
      Utils.toast('Recibo excluído!', 'info');
      App.navigate('recibos');
    });
  },

  // ─────────────────────────────────────────────────────────────
  // VISUALIZAÇÃO E IMPRESSÃO DO RECIBO
  // ─────────────────────────────────────────────────────────────
  visualizarRecibo(id) {
    const r = this.getById(id);
    if (!r) return;
    const htmlRecibo = this.gerarHTMLRecibo(r);

    Utils.showModal(`
      <div class="modal" style="max-width:820px;width:95vw;">
        <div class="modal-header">
          <span class="modal-title">🧾 Recibo Oficial Nº ${r.numero}</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-sm btn-primary" onclick="Recibos.imprimirRecibo('${r.id}')">
              🖨️ Imprimir / Salvar PDF
            </button>
            <button class="modal-close" onclick="Utils.closeModal()">✕</button>
          </div>
        </div>
        <div class="modal-body" style="background:#334155;padding:24px;display:flex;justify-content:center;overflow-x:auto;">
          <div style="background:#ffffff;color:#0f172a;width:100%;max-width:720px;padding:36px;border-radius:4px;box-shadow:0 10px 30px rgba(0,0,0,0.3);font-family:'Segoe UI',Roboto,sans-serif;">
            ${htmlRecibo}
          </div>
        </div>
      </div>
    `);
  },

  // Gera o HTML do recibo formatado em padrão A4 institucional
  gerarHTMLRecibo(r) {
    const c = DB.getById('clientes', r.obra_id);
    const obraNome = c ? `${c.nome} (${c.cidade}/${c.estado})` : (r.obra_nome || 'Geral');
    const valorFmt = Utils.fmt.currency(r.valor);
    const dataFmt = Utils.fmt.date(r.data);
    const [y, m, d] = (r.data || Utils.today()).split('-');
    const meses = ['','janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const dataPorExtenso = `${parseInt(d)} de ${meses[parseInt(m)]} de ${y}`;

    return `
    <div style="border:2px solid #0f172a;padding:28px;border-radius:8px;position:relative;background:#ffffff;color:#0f172a;">
      
      <!-- Cabeçalho -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #c9a227;padding-bottom:16px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="img/logo.png" alt="Angelim Construtora" style="width:52px;height:52px;border-radius:8px;border:1px solid #c9a227;object-fit:cover;">
          <div>
            <div style="font-size:1.15rem;font-weight:900;color:#0f172a;line-height:1.1;letter-spacing:0.5px;">ANGELIM CONSTRUTORA</div>
            <div style="font-size:.72rem;font-weight:800;color:#b45309;text-transform:uppercase;">Engenharia Civil &amp; Gestão de Obras</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.3rem;font-weight:900;color:#0f172a;letter-spacing:1px;">RECIBO</div>
          <div style="font-size:.85rem;font-weight:800;color:#0284c7;font-family:monospace;">Nº ${r.numero}</div>
        </div>
      </div>

      <!-- Destaque do Valor -->
      <div style="background:#f8fafc;border:2px dashed #0f172a;border-radius:6px;padding:12px 18px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:.9rem;font-weight:800;color:#475569;text-transform:uppercase;">VALOR TOTAL:</span>
        <span style="font-size:1.4rem;font-weight:900;color:#0f172a;letter-spacing:0.5px;">${valorFmt}</span>
      </div>

      <!-- Corpo do Recibo -->
      <div style="font-size:.92rem;line-height:1.8;color:#0f172a;margin-bottom:28px;text-align:justify;">
        <p style="margin:0 0 16px 0;">
          Recebi(emos) de <strong style="color:#0f172a;border-bottom:1px solid #cbd5e1;padding:0 4px;">${r.pagador_nome}</strong>${r.pagador_doc ? `, inscrito(a) no CPF/CNPJ sob o nº <strong style="color:#0f172a;">${r.pagador_doc}</strong>` : ''}, a quantia de <strong style="color:#0f172a;background:#fef3c7;padding:2px 6px;border-radius:4px;">${valorFmt} (${r.valor_extenso})</strong>, referente a:
        </p>
        <div style="background:#f1f5f9;border-left:4px solid #0f172a;padding:12px 16px;border-radius:4px;font-style:italic;color:#1e293b;font-weight:600;margin-bottom:16px;">
          "${r.referente}"
        </div>
        <p style="margin:0 0 10px 0;font-size:.84rem;color:#334155;">
          <strong>Obra / Empreendimento:</strong> ${obraNome}<br>
          <strong>Forma de Quitação:</strong> ${r.forma_pagamento || 'PIX'}
        </p>
        <p style="margin:0;font-size:.82rem;color:#475569;">
          E, para firmeza e como prova de haver recebido a quantia supra, firmo(amos) o presente recibo em plena e geral quitação para nada mais exigir.
        </p>
      </div>

      <!-- Local e Data -->
      <div style="text-align:right;font-size:.88rem;color:#0f172a;font-weight:700;margin-bottom:40px;">
        ${r.cidade_uf || 'Boa Vista - RR'}, ${dataPorExtenso}.
      </div>

      <!-- Área de Assinatura -->
      <div style="display:grid;grid-template-columns:1fr;max-width:380px;margin:0 auto;text-align:center;font-size:.82rem;">
        <div style="border-top:1.5px solid #0f172a;padding-top:8px;">
          <strong style="font-size:.9rem;color:#0f172a;display:block;">${r.beneficiario_nome}</strong>
          ${r.beneficiario_doc ? `<span style="color:#475569;font-size:.76rem;display:block;">CPF/CNPJ: ${r.beneficiario_doc}</span>` : ''}
          <span style="color:#64748b;font-size:.72rem;text-transform:uppercase;">Assinatura do Recebedor</span>
        </div>
      </div>

      <!-- Rodapé -->
      <div style="margin-top:28px;border-top:1px dashed #cbd5e1;padding-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:.68rem;color:#94a3b8;">
        <span>Documento emitido eletronicamente via Sistema FinObra</span>
        <span>Autenticação: ANG-REC-${r.id.toUpperCase()}</span>
      </div>
    </div>`;
  },

  imprimirRecibo(id) {
    const r = this.getById(id);
    if (!r) return;
    const htmlRecibo = this.gerarHTMLRecibo(r);

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
          <title>Recibo Nº ${r.numero} — Angelim Construtora</title>
          <meta charset="utf-8">
          <style>
            @page { size: A4 portrait; margin: 20mm 15mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
        </head>
        <body>
          <div style="max-width:720px;margin:0 auto;padding-top:20px;">
            ${htmlRecibo}
          </div>
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
