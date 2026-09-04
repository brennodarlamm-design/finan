// js/recibos.js — Módulo Gerador e Emissor de Recibos Profissionais Angelim Construtora
// Com suporte a Assinatura Digital Eletrônica na tela, WhatsApp e Gov.br

const Recibos = {
  _getKey() {
    return (typeof DB !== 'undefined' && DB._ck) ? DB._ck('finobra_recibos') : 'finobra_recibos';
  },

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this._getKey()) || '[]');
    } catch { return []; }
  },

  salvarLista(recibos) {
    localStorage.setItem(this._getKey(), JSON.stringify(recibos));
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
      assinatura: null,
      ...recibo
    };
    recibos.unshift(item);
    this.salvarLista(recibos);
    return item;
  },

  atualizar(id, dados) {
    const recibos = this.getAll();
    const idx = recibos.findIndex(r => r.id === id);
    if (idx !== -1) {
      recibos[idx] = { ...recibos[idx], ...dados, atualizado_em: new Date().toISOString() };
      this.salvarLista(recibos);
      return recibos[idx];
    }
    return null;
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

    const totalValor = filtrados.reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0);
    const assinadosQtd = filtrados.filter(r => !!r.assinatura).length;

    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">🧾 Emissão de Recibos</h1>
        <p class="page-sub">Gere recibos de quitação com valor por extenso automático, assinatura digital na tela e validade jurídica</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="Recibos.novoReciboModal()">
          + Novo Recibo Avulso
        </button>
      </div>
    </div>

    <!-- Cards de Resumo Rápido -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
      <div class="card" style="padding:14px 18px;">
        <div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:800;letter-spacing:0.5px;">Recibos Emitidos</div>
        <div style="font-size:1.45rem;font-weight:900;color:var(--text);margin-top:2px;">${filtrados.length}</div>
      </div>
      <div class="card" style="padding:14px 18px;">
        <div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:800;letter-spacing:0.5px;">Assinados Digitalmente</div>
        <div style="font-size:1.45rem;font-weight:900;color:#10b981;margin-top:2px;">${assinadosQtd} <span style="font-size:.8rem;color:var(--text3);font-weight:600;">(${filtrados.length ? Math.round((assinadosQtd/filtrados.length)*100) : 0}%)</span></div>
      </div>
      <div class="card" style="padding:14px 18px;">
        <div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;font-weight:800;letter-spacing:0.5px;">Total Transacionado</div>
        <div style="font-size:1.45rem;font-weight:900;color:var(--accent);margin-top:2px;">${Utils.fmt.currency(totalValor)}</div>
      </div>
    </div>

    <!-- Tabela de Histórico de Recibos Emitidos -->
    <div class="card" style="padding:0;">
      <div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div class="card-title">📜 Histórico de Recibos (${filtrados.length})</div>
      </div>
      <div class="tbl-wrap" style="border:none;border-radius:0 0 14px 14px;">
        <table>
          <thead>
            <tr>
              <th>Nº Recibo</th>
              <th>Data</th>
              <th>Status</th>
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
              <td colspan="9" style="text-align:center;padding:36px;color:var(--text3);">
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
    const statusAssinatura = r.assinatura 
      ? `<span class="badge badge-success" title="Assinado eletronicamente em ${r.assinatura.data_hora_fmt}">✓ Assinado</span>` 
      : `<span class="badge" style="background:rgba(148,163,184,.15);color:var(--text3);">Pendente</span>`;

    return `
    <tr>
      <td style="font-weight:800;color:var(--accent);font-family:monospace;white-space:nowrap;">${r.numero}</td>
      <td style="white-space:nowrap;font-weight:600;">${Utils.fmt.date(r.data)}</td>
      <td>${statusAssinatura}</td>
      <td>${tipoLabel}</td>
      <td style="color:var(--text2);font-weight:600;">${c?.nome || r.obra_nome || '&mdash;'}</td>
      <td><strong style="color:var(--text);">${r.beneficiario_nome}</strong>${r.beneficiario_doc ? `<div style="font-size:.72rem;color:var(--text3);">${r.beneficiario_doc}</div>` : ''}</td>
      <td style="max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${r.referente}">${r.referente}</td>
      <td style="text-align:right;font-weight:900;color:var(--text);white-space:nowrap;">${Utils.fmt.currency(r.valor)}</td>
      <td style="text-align:center;">
        <div style="display:flex;gap:6px;justify-content:center;align-items:center;">
          ${!r.assinatura ? `
            <button class="btn btn-sm btn-primary" onclick="Recibos.assinarRecibo('${r.id}')" title="Coletar assinatura digital com o dedo ou mouse" style="padding:4px 8px;font-size:.75rem;background:#10b981;border-color:#10b981;color:#fff;">
              ✍️ Assinar
            </button>
          ` : ''}
          <button class="btn btn-sm btn-secondary" onclick="Recibos.visualizarRecibo('${r.id}')" title="Visualizar e Imprimir Recibo" style="padding:4px 8px;font-size:.75rem;">
            👁️ Ver
          </button>
          <button class="icon-btn btn-sm" onclick="Recibos.enviarWhatsApp('${r.id}')" title="Enviar comprovante via WhatsApp" style="color:#25d366;">
            📲
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
    const emp = DB.getEmpresa();

    Utils.showModal(`
      <div class="modal" style="max-width:680px;width:95vw;">
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
                <input class="form-control" name="pagador_nome" id="rec-pagador-nome" value="${dadosPreenchidos.pagador_nome || emp.razao_social || emp.nome_fantasia || 'Minha Construtora'}" required>
              </div>
              <div class="form-group">
                <label class="form-label">CPF / CNPJ do Pagador</label>
                <input class="form-control" name="pagador_doc" id="rec-pagador-doc" value="${dadosPreenchidos.pagador_doc || emp.cnpj || ''}" placeholder="00.000.000/0001-00">
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
    const emp = DB.getEmpresa();
    if (tipo === 'pagamento') {
      if (pagadorNome) pagadorNome.value = emp.razao_social || emp.nome_fantasia || '';
      if (pagadorDoc) pagadorDoc.value = emp.cnpj || '';
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
    this._sincronizarComDocumentos(novoRecibo);

    setTimeout(() => this.visualizarRecibo(novoRecibo.id), 200);
  },

  _sincronizarComDocumentos(r) {
    if (r.lancamento_id && typeof Documentos !== 'undefined') {
      const htmlRecibo = this.gerarHTMLRecibo(r);
      Documentos.adicionar({
        entidade_tipo: 'lancamento',
        entidade_id: r.lancamento_id,
        titulo: `Recibo Oficial ${r.numero} ${r.assinatura ? '(Assinado)' : ''}`,
        nome_arquivo: `Recibo_${r.numero.replace('/','-')}.html`,
        tipo_mime: 'text/html',
        tamanho: htmlRecibo.length,
        data_base64: 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlRecibo)
      });
    }
  },

  _confirmDel(id) {
    Utils.confirm('Excluir este recibo do histórico?', () => {
      this.remover(id);
      Utils.toast('Recibo excluído!', 'info');
      App.navigate('recibos');
    });
  },

  // ─────────────────────────────────────────────────────────────
  // COLETAR ASSINATURA DIGITAL NA TELA (TOUCH / MOUSE)
  // ─────────────────────────────────────────────────────────────
  assinarRecibo(id) {
    const r = this.getById(id);
    if (!r) return;

    if (typeof Assinador === 'undefined') {
      Utils.toast('Módulo Assinador não carregado.', 'error');
      return;
    }

    Assinador.abrirModal({
      titulo: `Assinar Recibo Nº ${r.numero}`,
      subtitulo: `Coleta de assinatura eletrônica do recebedor/beneficiário`,
      papel: 'Beneficiário / Recebedor',
      nomePredefinido: r.beneficiario_nome || '',
      docPredefinido: r.beneficiario_doc || '',
      dadosDocumento: {
        id: r.id,
        numero: r.numero,
        valor: r.valor,
        tipo: 'recibo'
      },
      onSalvar: (objetoAssinatura) => {
        this.atualizar(id, { assinatura: objetoAssinatura });
        this._sincronizarComDocumentos(this.getById(id));
        Utils.toast('✅ Recibo assinado com sucesso e validado eletronicamente!', 'success');
        
        // Se a rota for recibos, atualizar a tabela de fundo
        if (App.route === 'recibos') {
          App.navigate('recibos');
        }
        
        // Abrir a visualização com a assinatura estampada
        setTimeout(() => this.visualizarRecibo(id), 150);
      }
    });
  },

  // ─────────────────────────────────────────────────────────────
  // COMPARTILHAR COMPROVANTE VIA WHATSAPP
  // ─────────────────────────────────────────────────────────────
  enviarWhatsApp(id) {
    const r = this.getById(id);
    if (!r) return;

    const c = DB.getById('clientes', r.obra_id);
    const obraNome = c ? `${c.nome} (${c.cidade}/${c.estado})` : (r.obra_nome || 'Geral');
    const valorFmt = Utils.fmt.currency(r.valor);
    const dataFmt = Utils.fmt.date(r.data);
    const statusTxt = r.assinatura ? '✅ ASSINADO DIGITALMENTE' : '⏳ PENDENTE DE ASSINATURA';
    const validacaoTxt = r.assinatura ? `\n*Código de Validação:* ${r.assinatura.codigo_validacao}\n*Data/Hora Assinatura:* ${r.assinatura.data_hora_fmt}` : '';

    const emp = DB.getEmpresa();
    const brandName = emp.nome_fantasia || emp.razao_social || 'Angelim Construtora';

    const texto = `🧾 *COMPROVANTE DE RECIBO OFICIAL*\n*${brandName.toUpperCase()}*\n\n` +
      `*Nº do Recibo:* ${r.numero}\n` +
      `*Data:* ${dataFmt}\n` +
      `*Status:* ${statusTxt}\n` +
      `*Beneficiário:* ${r.beneficiario_nome}${r.beneficiario_doc ? ` (${r.beneficiario_doc})` : ''}\n` +
      `*Valor:* ${valorFmt} (${r.valor_extenso})\n` +
      `*Obra:* ${obraNome}\n` +
      `*Referente a:* ${r.referente}\n` +
      `*Forma de Pagamento:* ${r.forma_pagamento || 'PIX'}\n` +
      validacaoTxt +
      `\n_Documento emitido eletronicamente via Sistema FinObra._`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  },

  // ─────────────────────────────────────────────────────────────
  // VISUALIZAÇÃO E IMPRESSÃO DO RECIBO
  // ─────────────────────────────────────────────────────────────
  visualizarRecibo(id) {
    const r = this.getById(id);
    if (!r) return;
    const htmlRecibo = this.gerarHTMLRecibo(r);

    Utils.showModal(`
      <div class="modal" style="max-width:840px;width:96vw;">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <span class="modal-title">🧾 Recibo Oficial Nº ${r.numero}</span>
            ${r.assinatura ? `<span class="badge badge-success" style="margin-left:8px;">✓ Assinado Eletronicamente</span>` : `<span class="badge" style="background:rgba(148,163,184,.2);color:var(--text3);margin-left:8px;">Pendente de Assinatura</span>`}
          </div>
          
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            ${!r.assinatura ? `
              <button class="btn btn-sm btn-primary" onclick="Recibos.assinarRecibo('${r.id}')" style="background:#10b981;border-color:#10b981;color:#fff;">
                ✍️ Assinar com Dedo/Mouse
              </button>
            ` : `
              <button class="btn btn-sm btn-secondary" onclick="Recibos.assinarRecibo('${r.id}')" title="Substituir ou assinar novamente">
                🔄 Reassinar
              </button>
            `}

            <button class="btn btn-sm btn-secondary" onclick="Recibos.enviarWhatsApp('${r.id}')" style="color:#25d366;" title="Enviar texto e dados do recibo para WhatsApp">
              📲 WhatsApp
            </button>

            <button class="btn btn-sm btn-secondary" onclick="Assinador.modalGovBr({ nomeDocumento:'Recibo_${r.numero.replace('/','-')}', onBaixarPDF: () => Recibos.imprimirRecibo('${r.id}') })" style="color:#0284c7;" title="Como assinar oficialmente com o Gov.br ICP-Brasil">
              🏛️ Gov.br
            </button>

            <button class="btn btn-sm btn-primary" onclick="Recibos.imprimirRecibo('${r.id}')">
              🖨️ Imprimir / PDF
            </button>
            
            <button class="modal-close" onclick="Utils.closeModal()">✕</button>
          </div>
        </div>

        <div class="modal-body" style="background:#334155;padding:20px;display:flex;justify-content:center;overflow-x:auto;">
          <div style="background:#ffffff;color:#0f172a;width:100%;max-width:720px;padding:34px;border-radius:4px;box-shadow:0 10px 30px rgba(0,0,0,0.3);font-family:'Segoe UI',Roboto,sans-serif;">
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
    const [y, m, d] = (Utils.cleanDate(r.data) || Utils.today()).split('-');
    const meses = ['','janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const dataPorExtenso = `${parseInt(d, 10)} de ${meses[parseInt(m, 10)]} de ${y}`;

    const emp = DB.getEmpresa();
    const brandName = (emp.nome_fantasia || emp.razao_social || 'Angelim Construtora').toUpperCase();
    const logoHtml = emp.logo_url 
      ? `<img src="${emp.logo_url}" alt="${brandName}" style="max-width:60px;max-height:60px;border-radius:8px;border:1px solid #c9a227;object-fit:contain;">`
      : `<div style="width:48px;height:48px;border-radius:8px;background:#182713;border:1px solid #c9a227;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🏢</div>`;

    // Renderização da Assinatura Digital sobre a Linha
    let assinaturaVisual = '';
    if (r.assinatura && r.assinatura.imagem_base64) {
      assinaturaVisual = `
        <div style="margin-bottom:-10px;">
          <img src="${r.assinatura.imagem_base64}" alt="Assinatura Digital" style="max-height:65px;max-width:240px;display:block;margin:0 auto;object-fit:contain;">
        </div>`;
    }

    return `
    <div style="border:2px solid #0f172a;padding:28px;border-radius:8px;position:relative;background:#ffffff;color:#0f172a;">
      
      <!-- Cabeçalho -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #c9a227;padding-bottom:16px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${logoHtml}
          <div>
            <div style="font-size:1.15rem;font-weight:900;color:#0f172a;line-height:1.1;letter-spacing:0.5px;">${brandName}</div>
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
      <div style="text-align:right;font-size:.88rem;color:#0f172a;font-weight:700;margin-bottom:30px;">
        ${r.cidade_uf || 'Boa Vista - RR'}, ${dataPorExtenso}.
      </div>

      <!-- Área de Assinatura -->
      <div style="display:grid;grid-template-columns:1fr;max-width:380px;margin:0 auto;text-align:center;font-size:.82rem;">
        <div style="border-top:1.5px solid #0f172a;padding-top:8px;position:relative;">
          ${assinaturaVisual}
          <strong style="font-size:.9rem;color:#0f172a;display:block;">${r.beneficiario_nome}</strong>
          ${r.beneficiario_doc ? `<span style="color:#475569;font-size:.76rem;display:block;">CPF/CNPJ: ${r.beneficiario_doc}</span>` : ''}
          <span style="color:#64748b;font-size:.72rem;text-transform:uppercase;">Assinatura do Recebedor</span>
        </div>
      </div>

      <!-- Selo de Assinatura Eletrônica e Integridade Jurídica com QR Code -->
      ${r.assinatura ? Assinador.renderCarimboAssinatura(r.assinatura, { docTipo: 'recibo', docId: r.id }) : ''}

      <!-- Rodapé com Link de Validação e Código -->
      <div style="margin-top:28px;border-top:1px dashed #cbd5e1;padding-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:.68rem;color:#64748b;flex-wrap:wrap;gap:8px;">
        <span>Documento emitido eletronicamente via Sistema FinObra</span>
        <span>Validar em: <a href="validar.html${r.assinatura ? `?val=${r.assinatura.codigo_validacao}` : ''}" target="_blank" style="color:#0284c7;text-decoration:none;font-weight:700;">finan-as-bay.vercel.app/validar.html</a> &bull; Código: <strong style="font-family:monospace;color:#0f172a;background:#f1f5f9;padding:1px 5px;border-radius:3px;">${r.assinatura ? r.assinatura.codigo_validacao : `ANG-REC-${r.id.toUpperCase()}`}</strong></span>
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
            @page { size: A4 portrait; margin: 15mm 15mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
        </head>
        <body>
          <div style="max-width:720px;margin:0 auto;padding-top:10px;">
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

window.Recibos = Recibos;
