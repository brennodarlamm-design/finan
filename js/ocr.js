// js/ocr.js — Robô de Reconhecimento Automático de Documentos Fiscais
// Integra com Google Gemini Vision via /api/reconhecer-documento
// Suporta: Boletos, NF-e, NFC-e, NFS-e, Contas de Consumo, DAS, DARF, GPS e outros

const OCR = {

  // ── Ponto de entrada: abre o modal de upload ─────────────────────────────
  abrirModal() {
    Utils.showModal(`
      <div class="modal" id="ocr-modal" style="max-width:580px;width:95vw;">
        <div class="modal-header" style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);border-radius:var(--r-lg) var(--r-lg) 0 0;">
          <span class="modal-title" style="color:#e0e7ff;font-size:1.05rem;display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.5rem;">🤖</span>
            <div>
              <div>Reconhecimento Automático de Documento</div>
              <div style="font-size:.72rem;font-weight:400;color:#a5b4fc;margin-top:1px;">Gemini Vision IA · Boleto · NF-e · NFC-e · NFS-e · Contas</div>
            </div>
          </span>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="btn btn-ghost btn-sm" onclick="OCR.abrirHistorico()" style="color:#a5b4fc;font-size:.76rem;display:flex;align-items:center;gap:5px;border:1px solid rgba(165,180,252,.3);border-radius:8px;padding:3px 8px;" title="Ver documentos lidos anteriormente">
              📜 Histórico (${this.obterHistorico().length})
            </button>
            <button class="modal-close" onclick="Utils.closeModal()" style="color:#a5b4fc;">✕</button>
          </div>
        </div>
        <div class="modal-body" style="padding:24px;">

          <!-- Botões de ação principais -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">

            <!-- Tirar Foto com a Câmera -->
            <label for="ocr-camera-input" style="
              display:flex;flex-direction:column;align-items:center;justify-content:center;
              gap:8px;padding:20px 12px;border-radius:14px;cursor:pointer;
              background:linear-gradient(135deg,rgba(16,185,129,.12) 0%,rgba(5,150,105,.08) 100%);
              border:2px solid rgba(16,185,129,.4);transition:all .2s;text-align:center;">
              <span style="font-size:2.2rem;">📷</span>
              <span style="font-size:.88rem;font-weight:800;color:#10b981;">Tirar Foto</span>
              <span style="font-size:.7rem;color:var(--text3);">Câmera do celular</span>
              <input type="file" id="ocr-camera-input" accept="image/*" capture="environment"
                style="display:none;" onchange="OCR._onFileSelected(this)">
            </label>

            <!-- Escolher da Galeria / Arquivo -->
            <label for="ocr-file-input" style="
              display:flex;flex-direction:column;align-items:center;justify-content:center;
              gap:8px;padding:20px 12px;border-radius:14px;cursor:pointer;
              background:linear-gradient(135deg,rgba(79,70,229,.12) 0%,rgba(99,102,241,.08) 100%);
              border:2px solid rgba(79,70,229,.4);transition:all .2s;text-align:center;">
              <span style="font-size:2.2rem;">📁</span>
              <span style="font-size:.88rem;font-weight:800;color:#818cf8;">Galeria / Arquivo</span>
              <span style="font-size:.7rem;color:var(--text3);">PDF · PNG · JPG (5MB)</span>
              <input type="file" id="ocr-file-input" accept="image/*,application/pdf"
                style="display:none;" onchange="OCR._onFileSelected(this)">
            </label>
          </div>

          <!-- Dropzone drag-and-drop (desktop) -->
          <div id="ocr-dropzone"
            style="border:2px dashed rgba(79,70,229,.4);border-radius:12px;padding:16px;text-align:center;
                   background:rgba(79,70,229,.04);cursor:pointer;transition:all .2s;"
            onclick="document.getElementById('ocr-file-input').click()"
            ondragover="OCR._onDragOver(event)"
            ondragleave="OCR._onDragLeave(event)"
            ondrop="OCR._onDrop(event)">
            <div style="font-size:.78rem;color:var(--text3);">
              🖥️ Ou arraste um arquivo aqui (PDF, imagem)
            </div>
          </div>

          <!-- Tipos suportados -->
          <div style="margin-top:16px;">
            <div style="font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Documentos Reconhecidos</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
              ${[
                ['🏦','Boleto'],['📄','NF-e'],['🛒','NFC-e'],['🔧','NFS-e'],
                ['💡','Energia'],['💧','Água'],['🌐','Telefonia'],['🏛️','DAS / DARF'],
                ['📋','GPS/FGTS'],['🧾','Recibo'],['💰','Orçamento'],['📑','Qualquer Conta']
              ].map(([ic,lb])=>`
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:8px 6px;text-align:center;">
                  <div style="font-size:1.2rem;">${ic}</div>
                  <div style="font-size:.68rem;color:var(--text3);margin-top:2px;font-weight:600;">${lb}</div>
                </div>`).join('')}
            </div>
          </div>

        </div>
      </div>
    `);
  },

  // ── Drag & Drop handlers ──────────────────────────────────────────────────
  _onDragOver(e) {
    e.preventDefault();
    const dz = document.getElementById('ocr-dropzone');
    if (dz) {
      dz.style.borderColor = '#6366f1';
      dz.style.background  = 'linear-gradient(135deg,rgba(99,102,241,.15) 0%,rgba(139,92,246,.1) 100%)';
      dz.style.transform   = 'scale(1.01)';
    }
  },

  _onDragLeave(e) {
    const dz = document.getElementById('ocr-dropzone');
    if (dz) {
      dz.style.borderColor = '#4f46e5';
      dz.style.background  = 'linear-gradient(135deg,rgba(79,70,229,.06) 0%,rgba(99,102,241,.04) 100%)';
      dz.style.transform   = 'scale(1)';
    }
  },

  _onDrop(e) {
    e.preventDefault();
    this._onDragLeave(e);
    const file = e.dataTransfer?.files?.[0];
    if (file) this._processarArquivo(file);
  },

  _onFileSelected(input) {
    const file = input.files?.[0];
    if (file) this._processarArquivo(file);
  },

  // ── Processa o arquivo selecionado ───────────────────────────────────────
  async _processarArquivo(file) {
    // Validação
    const tiposPermitidos = ['image/png','image/jpeg','image/jpg','image/webp','image/gif','application/pdf'];
    if (!tiposPermitidos.includes(file.type)) {
      Utils.toast('Formato não suportado. Use PDF, PNG, JPG, JPEG ou WEBP.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      Utils.toast('Arquivo muito grande. O limite é 5 MB.', 'error');
      return;
    }

    // Mostrar loading
    this._mostrarLoading(file.name);

    try {
      const base64 = await this._lerBase64(file);

      // Chamar API
      const resp = await fetch('/api/reconhecer-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: file.type })
      });

      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        throw new Error(data.error || 'Erro desconhecido na API');
      }

      // Guardar arquivo para anexar depois
      this._arquivoAtual = file;
      this._base64Atual  = base64;

      // Salvar no histórico de leituras
      this._salvarNoHistorico(file.name, data.dados, base64);

      // Mostrar resultado
      this._mostrarResultado(data.dados);

    } catch (err) {
      console.error('[OCR]', err);
      this._mostrarErro(err.message);
    }
  },

  // ── Tela de Loading ───────────────────────────────────────────────────────
  _mostrarLoading(nomeArquivo) {
    const modal = document.querySelector('#ocr-modal .modal-body');
    if (!modal) return;
    modal.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:3rem;margin-bottom:16px;animation:spin 1s linear infinite;display:inline-block;">⚙️</div>
        <div style="font-size:1.05rem;font-weight:700;color:var(--text);margin-bottom:8px;">Analisando documento...</div>
        <div style="font-size:.82rem;color:var(--text3);margin-bottom:20px;">${nomeArquivo}</div>
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:left;font-size:.78rem;color:var(--text3);line-height:1.8;">
          <div>🔍 Lendo conteúdo do documento...</div>
          <div>🤖 Identificando tipo e campos...</div>
          <div>📊 Extraindo dados fiscais...</div>
          <div>✨ Preparando pré-cadastro...</div>
        </div>
      </div>
      <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
    `;
  },

  // ── Tela de Resultado ─────────────────────────────────────────────────────
  _mostrarResultado(d) {
    const modal = document.querySelector('#ocr-modal .modal-body');
    if (!modal) return;

    const confiancaPct = Math.round((d.confianca || 0) * 100);
    const corConfianca = confiancaPct >= 80 ? '#10b981' : confiancaPct >= 50 ? '#f59e0b' : '#ef4444';
    const iconeTipo    = this._iconeTipoDoc(d.tipo_documento);
    const catLabel     = Utils.catLabel(d.categoria_sugerida || 'outro');

    // Montar lista de itens se houver
    const itensHtml = d.itens && d.itens.length ? `
      <div style="margin-top:14px;">
        <div style="font-size:.75rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
          📦 Itens Detectados (${d.itens.length})
        </div>
        <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:.76rem;">
            <thead>
              <tr style="background:var(--bg-secondary);">
                <th style="padding:6px 10px;text-align:left;font-weight:700;color:var(--text3);">Produto / Serviço</th>
                <th style="padding:6px 10px;text-align:right;font-weight:700;color:var(--text3);">Qtd</th>
                <th style="padding:6px 10px;text-align:center;font-weight:700;color:var(--text3);">Un</th>
                <th style="padding:6px 10px;text-align:right;font-weight:700;color:var(--text3);">V. Unit.</th>
              </tr>
            </thead>
            <tbody>
              ${d.itens.map(it => `
                <tr style="border-top:1px solid var(--border);">
                  <td style="padding:6px 10px;color:var(--text);">${it.produto || '—'}</td>
                  <td style="padding:6px 10px;text-align:right;color:var(--text2);">${it.qtd || '—'}</td>
                  <td style="padding:6px 10px;text-align:center;color:var(--text3);">${it.unidade || '—'}</td>
                  <td style="padding:6px 10px;text-align:right;color:var(--text2);">${it.valor_unit ? Utils.fmt.currency(it.valor_unit) : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>` : '';

    modal.innerHTML = `
      <!-- Cabeçalho do resultado -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:12px 16px;
                  background:linear-gradient(135deg,rgba(16,185,129,.08) 0%,rgba(5,150,105,.05) 100%);
                  border:1px solid rgba(16,185,129,.25);border-radius:10px;">
        <span style="font-size:2rem;">${iconeTipo}</span>
        <div style="flex:1;">
          <div style="font-weight:800;color:var(--text);font-size:.95rem;">
            ✅ Documento Reconhecido
          </div>
          <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">
            ${this._labelTipoDoc(d.tipo_documento)} · Confiança:
            <span style="color:${corConfianca};font-weight:700;">${confiancaPct}%</span>
          </div>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="OCR.abrirModal()" style="font-size:.72rem;">
          🔄 Trocar
        </button>
      </div>

      <!-- Campos extraídos (editáveis) -->
      <div style="font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">
        📊 Dados Extraídos — Revise e confirme:
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-size:.72rem;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">Fornecedor / Emitente</label>
            <input id="ocr-fornecedor" class="form-control" value="${this._esc(d.fornecedor)}"
              placeholder="Nome do emitente" style="font-size:.85rem;">
          </div>
          <div>
            <label style="font-size:.72rem;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">CNPJ do Emitente</label>
            <input id="ocr-cnpj" class="form-control" value="${this._esc(d.cnpj_emitente)}"
              placeholder="xx.xxx.xxx/xxxx-xx" style="font-size:.85rem;font-family:monospace;">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
          <div>
            <label style="font-size:.72rem;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">Valor Total (R$)</label>
            <input id="ocr-valor" class="form-control" type="number" step="0.01" min="0"
              value="${d.valor ?? ''}" placeholder="0,00"
              style="font-size:.92rem;font-weight:800;color:var(--danger);">
          </div>
          <div>
            <label style="font-size:.72rem;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">Data Emissão</label>
            <input id="ocr-data-emissao" class="form-control" type="date"
              value="${this._esc(d.data_emissao)}" style="font-size:.85rem;">
          </div>
          <div>
            <label style="font-size:.72rem;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">Vencimento</label>
            <input id="ocr-vencimento" class="form-control" type="date"
              value="${this._esc(d.data_vencimento)}" style="font-size:.85rem;border-color:var(--accent);">
          </div>
        </div>

        <div>
          <label style="font-size:.72rem;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">Descrição do Lançamento</label>
          <input id="ocr-descricao" class="form-control" value="${this._esc(d.descricao_sugerida)}"
            placeholder="Descrição para o lançamento" style="font-size:.85rem;">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-size:.72rem;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">Categoria</label>
            <select id="ocr-categoria" class="form-control" style="font-size:.85rem;">
              ${this._catOptions(d.categoria_sugerida)}
            </select>
          </div>
          <div>
            <label style="font-size:.72rem;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">Número do Documento</label>
            <input id="ocr-num-doc" class="form-control" value="${this._esc(d.numero_documento)}"
              placeholder="NF, Boleto, etc." style="font-size:.85rem;font-family:monospace;">
          </div>
        </div>

        <div>
          <label style="font-size:.72rem;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">
            Linha Digitável / Código de Barras / Chave Pix
          </label>
          <input id="ocr-barcode" class="form-control" value="${this._esc(d.codigo_barras || d.chave_pix)}"
            placeholder="Linha digitável do boleto ou chave pix"
            style="font-size:.78rem;font-family:monospace;">
        </div>

        ${d.observacoes ? `
        <div>
          <label style="font-size:.72rem;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">Observações</label>
          <input id="ocr-obs" class="form-control" value="${this._esc(d.observacoes)}" style="font-size:.82rem;">
        </div>` : '<input type="hidden" id="ocr-obs" value="">'}

        ${d.chave_acesso ? `
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:8px 12px;">
          <div style="font-size:.7rem;color:var(--text3);font-weight:700;margin-bottom:3px;">🔑 Chave de Acesso NF-e</div>
          <div style="font-size:.72rem;font-family:monospace;color:var(--accent2);word-break:break-all;">${this._esc(d.chave_acesso)}</div>
        </div>` : ''}

      </div>

      ${itensHtml}

      <!-- Aviso de confiança baixa -->
      ${confiancaPct < 60 ? `
      <div style="margin-top:14px;padding:10px 14px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:8px;font-size:.78rem;color:#f59e0b;">
        ⚠️ <strong>Confiança ${confiancaPct}%</strong> — Alguns campos podem estar incorretos. Revise os dados antes de criar o lançamento.
      </div>` : ''}
    `;

    // Atualizar footer
    const footer = document.querySelector('#ocr-modal')?.closest('.modal')?.querySelector?.('.modal-footer')
                || document.querySelector('.modal-footer');
    if (footer) {
      footer.innerHTML = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="OCR._criarLancamento()" style="display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#4f46e5,#7c3aed);">
          ✓ Criar Lançamento
        </button>
      `;
    }

    // Guardar dados originais
    this._dadosOCR = d;
  },

  // ── Tela de Erro ──────────────────────────────────────────────────────────
  _mostrarErro(mensagem) {
    const modal = document.querySelector('#ocr-modal .modal-body');
    if (!modal) return;
    modal.innerHTML = `
      <div style="text-align:center;padding:32px 20px;">
        <div style="font-size:3rem;margin-bottom:14px;">❌</div>
        <div style="font-size:1rem;font-weight:700;color:var(--danger);margin-bottom:8px;">
          Falha no Reconhecimento
        </div>
        <div style="font-size:.82rem;color:var(--text3);margin-bottom:20px;max-width:360px;margin-left:auto;margin-right:auto;">
          ${mensagem || 'Não foi possível analisar o documento.'}
        </div>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button class="btn btn-secondary" onclick="OCR.abrirModal()">🔄 Tentar Novamente</button>
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Fechar</button>
        </div>
      </div>
    `;
  },

  // ── Cria o lançamento com os dados revisados ──────────────────────────────
  _criarLancamento() {
    const get = id => document.getElementById(id)?.value?.trim() || '';

    const fornecedor  = get('ocr-fornecedor');
    const valor       = parseFloat(get('ocr-valor'));
    const dataEmissao = get('ocr-data-emissao') || Utils.today();
    const vencimento  = get('ocr-vencimento')   || Utils.today();
    const descricao   = get('ocr-descricao')    || fornecedor || 'Lançamento via OCR';
    const categoria   = get('ocr-categoria')    || 'outro';
    const numDoc      = get('ocr-num-doc');
    const barcode     = get('ocr-barcode');
    const obs         = get('ocr-obs');

    if (!valor || isNaN(valor) || valor <= 0) {
      Utils.toast('Informe o valor do documento antes de criar o lançamento.', 'error');
      document.getElementById('ocr-valor')?.focus();
      return;
    }

    // Montar objeto de lançamento com dados do OCR
    const dadosLancamento = {
      tipo:                   this._dadosOCR?.tipo_lancamento === 'receita' ? 'receita' : 'despesa',
      fornecedor_beneficiario: fornecedor,
      valor,
      data:                   dataEmissao,
      data_vencimento:        vencimento,
      descricao,
      categoria,
      codigo_barras:          barcode || '',
      observacoes:            [obs, numDoc ? `Doc: ${numDoc}` : '', this._dadosOCR?.chave_acesso ? `Chave NF-e: ${this._dadosOCR.chave_acesso}` : ''].filter(Boolean).join(' | ') || '',
      status:                 'a_pagar',
      origem:                 'ocr',
      itens:                  this._dadosOCR?.itens || []
    };

    // Fechar modal e abrir formulário de lançamento pré-preenchido
    Utils.closeModal();

    setTimeout(() => {
      if (typeof Lancamentos !== 'undefined') {
        Lancamentos.showFormOCR(dadosLancamento, this._arquivoAtual, this._base64Atual);
      }
    }, 150);
  },

  // ── Helpers ───────────────────────────────────────────────────────────────
  _lerBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  _esc(v) {
    if (!v) return '';
    return String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },

  _iconeTipoDoc(tipo) {
    const m = {
      boleto:'🏦', nfe:'📄', nfce:'🛒', nfse:'🔧',
      conta_energia:'💡', conta_agua:'💧', conta_gas:'🔥',
      conta_telefone:'🌐', das:'🏛️', gps:'📋', darf:'🏛️',
      recibo:'🧾', orcamento:'💰', outro:'📑'
    };
    return m[tipo] || '📑';
  },

  _labelTipoDoc(tipo) {
    const m = {
      boleto:'Boleto Bancário', nfe:'Nota Fiscal NF-e', nfce:'Nota Fiscal NFC-e',
      nfse:'Nota Fiscal de Serviço', conta_energia:'Conta de Energia Elétrica',
      conta_agua:'Conta de Água/Esgoto', conta_gas:'Conta de Gás',
      conta_telefone:'Conta de Telefonia/Internet', das:'DAS Simples Nacional',
      gps:'GPS/FGTS', darf:'DARF', recibo:'Recibo', orcamento:'Orçamento', outro:'Outro Documento'
    };
    return m[tipo] || 'Documento Fiscal';
  },

  _catOptions(selecionada) {
    const cats = [
      ['material','🧱 Material de Obra'],
      ['mao_de_obra','👷 Mão de Obra'],
      ['servico','🔧 Serviço'],
      ['equipamento','🏗️ Equipamento'],
      ['taxa','📋 Taxa/Imposto'],
      ['energia','💡 Energia Elétrica'],
      ['agua','💧 Água e Esgoto'],
      ['internet_tel','🌐 Internet & Telefonia'],
      ['imposto_simples','🏛️ DAS Simples Nacional'],
      ['tributos_trabalhistas','📄 INSS / FGTS / Tributos'],
      ['salario','👥 Salários / Folha'],
      ['aluguel_sede','🏢 Aluguel / Sede'],
      ['contabilidade','⚖️ Contábil / Jurídico'],
      ['software_ti','💻 Softwares & TI'],
      ['material_escritorio','📦 Material Escritório'],
      ['outro','📦 Outros']
    ];
    return cats.map(([v,t]) => `<option value="${v}" ${v === selecionada ? 'selected' : ''}>${t}</option>`).join('');
  },

  // Guardar estado temporário
  _arquivoAtual: null,
  _base64Atual:  null,
  _dadosOCR:     null,

  // ── HISTÓRICO DE DOCUMENTOS LIDOS PELO OCR ────────────────────────────────
  obterHistorico() {
    try {
      return JSON.parse(localStorage.getItem('finobra_ocr_historico') || '[]');
    } catch {
      return [];
    }
  },

  _salvarNoHistorico(nomeArquivo, dados, base64) {
    try {
      const hist = this.obterHistorico();
      const novoItem = {
        id: 'ocr_' + Date.now().toString(36) + Math.random().toString(36).substr(2,4),
        data_hora: new Date().toISOString(),
        nome_arquivo: nomeArquivo,
        dados: dados,
        // Guarda preview leve (thumbnail de no máximo 200 chars ou nulo para economizar espaço)
        tipo_documento: dados.tipo_documento || 'outro',
        fornecedor: dados.fornecedor_beneficiario || 'Não informado',
        valor: dados.valor || 0,
        data_vencimento: dados.data_vencimento || dados.data || '',
        confianca: dados.confianca || 0
      };

      // Limitar aos últimos 30 itens no histórico
      hist.unshift(novoItem);
      if (hist.length > 30) hist.pop();

      localStorage.setItem('finobra_ocr_historico', JSON.stringify(hist));
    } catch (err) {
      console.warn('[OCR] Erro ao salvar no histórico local:', err);
    }
  },

  abrirHistorico() {
    const hist = this.obterHistorico();

    Utils.showModal(`
      <div class="modal" id="ocr-hist-modal" style="max-width:680px;width:95vw;">
        <div class="modal-header" style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);border-radius:var(--r-lg) var(--r-lg) 0 0;">
          <div class="modal-title" style="color:#e0e7ff;display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.3rem;">📜</span>
            <div>
              <div style="font-weight:800;font-size:1rem;">Histórico de Leituras da IA</div>
              <div style="font-size:.72rem;color:#a5b4fc;">${hist.length} leitura(s) armazenada(s) localmente</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            ${hist.length > 0 ? `<button class="btn btn-ghost btn-sm" onclick="OCR.limparHistorico()" style="color:#f87171;font-size:.72rem;" title="Limpar todo o histórico">🗑️ Limpar</button>` : ''}
            <button class="modal-close" onclick="Utils.closeModal()" style="color:#a5b4fc;">✕</button>
          </div>
        </div>

        <div class="modal-body" style="padding:16px;max-height:70vh;overflow-y:auto;">
          ${hist.length === 0 ? `
            <div style="text-align:center;padding:40px;color:var(--text3);">
              <div style="font-size:3rem;margin-bottom:10px;">📄</div>
              <div style="font-size:.95rem;font-weight:700;color:var(--text);">Nenhum documento lido ainda</div>
              <div style="font-size:.8rem;margin-top:4px;">As leituras de boletos e notas com a IA ficarão salvas aqui.</div>
            </div>
          ` : `
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${hist.map((item, idx) => {
                const confPct = Math.round((item.confianca || 0) * 100);
                const icone = this._iconeTipoDoc(item.tipo_documento);
                const dtFmt = new Date(item.data_hora).toLocaleString('pt-BR');

                return `
                  <div style="
                    padding:12px 14px;border-radius:10px;border:1px solid var(--border);
                    background:var(--bg-secondary);display:flex;align-items:center;gap:12px;
                    transition:all .15s;">
                    <div style="font-size:1.6rem;line-height:1;width:36px;text-align:center;">${icone}</div>
                    <div style="flex:1;min-width:0;">
                      <div style="display:flex;align-items:center;gap:8px;">
                        <strong style="font-size:.85rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                          ${item.fornecedor}
                        </strong>
                        <span style="font-size:.68rem;background:rgba(79,70,229,.15);color:#818cf8;padding:1px 6px;border-radius:4px;font-weight:700;">
                          ${this._labelTipoDoc(item.tipo_documento)}
                        </span>
                      </div>
                      <div style="font-size:.74rem;color:var(--text3);margin-top:2px;display:flex;gap:10px;flex-wrap:wrap;">
                        <span>📁 ${item.nome_arquivo}</span>
                        <span>🕒 ${dtFmt}</span>
                        ${item.data_vencimento ? `<span>📅 Venc: ${Utils.fmt.date(item.data_vencimento)}</span>` : ''}
                      </div>
                    </div>
                    <div style="text-align:right;flex-shrink:0;">
                      <div style="font-weight:900;font-size:.92rem;color:var(--accent2);">${Utils.fmt.currency(item.valor)}</div>
                      <div style="font-size:.68rem;color:${confPct>=80?'#10b981':confPct>=50?'#f59e0b':'#ef4444'};font-weight:700;margin-top:2px;">
                        ${confPct}% confiança
                      </div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="OCR.reutilizarHistorico('${item.id}')" style="font-size:.75rem;padding:4px 8px;font-weight:700;white-space:nowrap;" title="Abrir dados deste documento">
                      Abrir ➔
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <div class="modal-footer" style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;">
          <button class="btn btn-secondary btn-sm" onclick="OCR.abrirModal()">← Voltar ao Escaneador</button>
          <button class="btn btn-secondary btn-sm" onclick="Utils.closeModal()">Fechar</button>
        </div>
      </div>
    `);
  },

  reutilizarHistorico(id) {
    const hist = this.obterHistorico();
    const item = hist.find(x => x.id === id);
    if (!item || !item.dados) return;

    Utils.closeModal();
    this.abrirModal();
    setTimeout(() => {
      this._mostrarResultado(item.dados);
    }, 150);
  },

  limparHistorico() {
    if (!confirm('Deseja realmente limpar todo o histórico de leituras do OCR?')) return;
    localStorage.removeItem('finobra_ocr_historico');
    Utils.toast('Histórico de OCR limpo!', 'info');
    this.abrirHistorico();
  }
};
