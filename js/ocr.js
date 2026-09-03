// js/ocr.js — Robô de Reconhecimento Automático de Documentos Fiscais
// Integra com Google Gemini Vision via /api/reconhecer-documento
// Suporta: Boletos, NF-e, NFC-e, NFS-e, Contas de Consumo, DAS, DARF, GPS e outros

const OCR = {

  // ── Ponto de entrada: abre o modal de upload ─────────────────────────────
  abrirModal() {
    Utils.showModal(`
      <div class="modal" id="ocr-modal" style="max-width:680px;width:95vw;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;">
        <div class="modal-header" style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);border-radius:var(--r-lg) var(--r-lg) 0 0;flex-shrink:0;">
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
        <div class="modal-body" id="ocr-modal-body" style="padding:20px 24px;overflow-y:auto;flex:1;">

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
              <span style="font-size:.7rem;color:var(--text3);">PDF (até 20MB) · Imagens</span>
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
        <div class="modal-footer" id="ocr-modal-footer" style="padding:12px 24px;border-top:1px solid var(--border);display:none;background:var(--bg-card);flex-shrink:0;justify-content:space-between;align-items:center;">
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
    const isPdf = file.type === 'application/pdf';

    // Limite de PDF: até 20MB (renderizado via Canvas no navegador pelo PDF.js para ~400KB, evitando limite de 4,5MB da nuvem)
    if (isPdf && file.size > 20 * 1024 * 1024) {
      Utils.toast('Arquivo PDF muito grande. O limite máximo é de 20 MB.', 'error');
      return;
    }

    // Limite de imagem: até 25MB (automaticamente redimensionada/comprimida via Canvas no navegador)
    if (!isPdf && file.size > 25 * 1024 * 1024) {
      Utils.toast('Imagem muito grande. O limite máximo é 25 MB.', 'error');
      return;
    }

    // Mostrar loading
    this._mostrarLoading(file.name);

    try {
      // Prepara e comprime o documento (PDFs e fotos são convertidos no navegador para imagens de ~300KB a 500KB)
      const { base64, mimeType } = await this._prepararArquivoEBase64(file);

      // Chamar API
      const resp = await fetch('/api/reconhecer-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType })
      });

      const responseText = await resp.text();
      let data = null;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        if (resp.status === 413) {
          throw new Error('O arquivo enviado ultrapassou o limite do servidor (4,5 MB). Tente reduzir o documento.');
        }
        if (resp.status === 504 || resp.status === 500) {
          throw new Error('O servidor de IA demorou para responder ou está sobrecarregado momentaneamente. Por favor, tente novamente.');
        }
        if (resp.status === 502) {
          throw new Error('Serviço de IA temporariamente indisponível. Tente novamente em alguns segundos.');
        }
        throw new Error(`Resposta do servidor (${resp.status}): ${responseText.slice(0, 100)}`);
      }

      if (!resp.ok || !data || !data.ok) {
        throw new Error(data?.error || data?.detalhe || `Erro na API (${resp.status})`);
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

  // ── Redimensiona e comprime documentos via Canvas no navegador ────────────
  async _prepararArquivoEBase64(file) {
    if (file.type === 'application/pdf') {
      try {
        // Converte as páginas do PDF para imagem JPEG nítida via PDF.js + Canvas
        // Isso permite boletos e notas em PDF de 5MB, 10MB, 20MB sem estourar o limite de 4,5MB da Vercel
        return await this._converterPdfParaImagem(file);
      } catch (errPdf) {
        console.warn('[OCR] Conversão de PDF via Canvas falhou, tentando leitura direta:', errPdf);
        if (file.size <= 3.2 * 1024 * 1024) {
          const base64 = await this._lerBase64(file);
          return { base64, mimeType: 'application/pdf' };
        }
        throw new Error('Não foi possível ler as páginas do PDF: ' + (errPdf.message || 'Arquivo corrompido ou protegido.'));
      }
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = async () => {
        const fallback = await this._lerBase64(file);
        resolve({ base64: fallback, mimeType: file.type });
      };
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => {
          resolve({ base64: e.target.result, mimeType: file.type });
        };
        img.onload = () => {
          try {
            const maxDim = 1800; // Resolução ideal para OCR do Gemini Vision (nítida e compacta)
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // Fundo branco sólido (evita problemas com transparência)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            resolve({
              base64: compressedBase64,
              mimeType: 'image/jpeg'
            });
          } catch (err) {
            console.warn('[OCR] Falha ao comprimir imagem via Canvas:', err);
            resolve({ base64: e.target.result, mimeType: file.type });
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  // ── Renderiza páginas de PDF para imagem de alta resolução via PDF.js ──────
  async _converterPdfParaImagem(file) {
    if (typeof window !== 'undefined' && !window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve();
          } else {
            reject(new Error('PDF.js não disponível'));
          }
        };
        s.onerror = () => reject(new Error('Falha ao carregar biblioteca PDF.js'));
        document.head.appendChild(s);
      });
    } else if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

    // Renderiza até 2 páginas (boletos e NFs normalmente têm 1 ou 2 páginas)
    const numPages = Math.min(pdfDoc.numPages, 2);
    const renderedPages = [];
    let totalHeight = 0;
    let maxWidth = 0;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const vpDefault = page.getViewport({ scale: 1.0 });
      // Escala visando ~1600px de largura para perfeita nitidez do código de barras e texto
      const targetWidth = 1600;
      const scale = Math.min(2.5, Math.max(1.0, targetWidth / vpDefault.width));
      const viewport = page.getViewport({ scale });

      renderedPages.push({ page, viewport });
      totalHeight += viewport.height;
      if (viewport.width > maxWidth) maxWidth = viewport.width;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(maxWidth);
    canvas.height = Math.round(totalHeight);
    const ctx = canvas.getContext('2d');

    // Fundo branco sólido
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let currentY = 0;
    for (const { page, viewport } of renderedPages) {
      ctx.save();
      ctx.translate(0, currentY);
      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;
      ctx.restore();
      currentY += viewport.height;
    }

    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
    return {
      base64: compressedBase64,
      mimeType: 'image/jpeg'
    };
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
    const modal = document.querySelector('#ocr-modal .modal-body') || document.getElementById('ocr-modal-body');
    if (!modal) return;

    const confiancaPct = Math.round((d.confianca || 0) * 100);
    const corConfianca = confiancaPct >= 80 ? '#10b981' : confiancaPct >= 50 ? '#f59e0b' : '#ef4444';
    const iconeTipo    = this._iconeTipoDoc(d.tipo_documento);
    const catLabel     = Utils.catLabel(d.categoria_sugerida || 'outro');

    const obras = (typeof DB !== 'undefined' ? DB.getAll('clientes') : []) || [];
    const contas = (typeof DB !== 'undefined' ? DB.getAll('contas') : []) || [];
    const defaultObraId = (typeof App !== 'undefined' && App.currentObraId && App.currentObraId !== 'todas') ? App.currentObraId : 'escritorio';

    // Garantir que itens existam; se não vieram produtos explícitos na NFC-e/NF-e, sintetizar da descrição
    let itens = Array.isArray(d.itens) && d.itens.length ? [...d.itens] : [];
    if (!itens.length && d.valor && d.descricao_sugerida) {
      const cleanNome = d.descricao_sugerida
        .replace(/^(compra\s+de\s+|aquisição\s+de\s+|aquisicao\s+de\s+|pgto\s+de\s+|pagamento\s+de\s+|fornecimento\s+de\s+|nfce\s+-\s+|nfe\s+-\s+)/i, '')
        .trim();
      if (cleanNome) {
        itens.push({
          produto: cleanNome,
          qtd: 1,
          unidade: 'un',
          valor_unit: d.valor,
          total: d.valor
        });
      }
    }
    d.itens = itens;

    // Montar lista de itens
    const itensHtml = d.itens && d.itens.length ? `
      <div style="margin-top:14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:.76rem;font-weight:800;color:var(--text);text-transform:uppercase;letter-spacing:.05em;">
            📦 Produtos / Insumos Detectados (${d.itens.length})
          </div>
          <span style="font-size:.72rem;color:var(--success);font-weight:700;">
            ✓ Cadastro automático em Produtos
          </span>
        </div>
        <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg-card);">
          <table style="width:100%;border-collapse:collapse;font-size:.76rem;">
            <thead>
              <tr style="background:var(--bg-secondary);border-bottom:1px solid var(--border);">
                <th style="padding:6px 10px;text-align:left;font-weight:700;color:var(--text3);">Produto / Insumo</th>
                <th style="padding:6px 10px;text-align:right;font-weight:700;color:var(--text3);width:60px;">Qtd</th>
                <th style="padding:6px 10px;text-align:center;font-weight:700;color:var(--text3);width:50px;">Un</th>
                <th style="padding:6px 10px;text-align:right;font-weight:700;color:var(--text3);width:90px;">V. Unit.</th>
              </tr>
            </thead>
            <tbody>
              ${d.itens.map(it => `
                <tr style="border-top:1px solid var(--border);">
                  <td style="padding:7px 10px;color:var(--text);font-weight:600;">${it.produto || '—'}</td>
                  <td style="padding:7px 10px;text-align:right;color:var(--text2);">${it.qtd || 1}</td>
                  <td style="padding:7px 10px;text-align:center;color:var(--text3);">${it.unidade || 'un'}</td>
                  <td style="padding:7px 10px;text-align:right;color:var(--text);font-weight:700;">${it.valor_unit ? Utils.fmt.currency(it.valor_unit) : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>` : '';

    modal.innerHTML = `
      <!-- Cabeçalho do resultado -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding:12px 16px;
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

      <!-- Centro de Custo (Sede ou Obra) e Conta Bancária -->
      <div style="background:rgba(201,162,39,.1);border:1px solid rgba(201,162,39,.4);border-radius:10px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:.74rem;font-weight:800;color:var(--accent2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
          📍 Centro de Custo (Sede ou Obra) & Pagamento *
        </div>
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:10px;">
          <div>
            <label style="font-size:.76rem;color:var(--text);font-weight:800;display:block;margin-bottom:4px;">
              Centro de Custo *
            </label>
            <select id="ocr-obra" class="form-control" style="font-size:.85rem;font-weight:700;border:2px solid var(--accent);background:var(--bg-card);" required>
              <option value="escritorio" ${defaultObraId==='escritorio'?'selected':''}>🏢 Sede / Escritório Central</option>
              <optgroup label="🏗️ Obras em Andamento">
                ${obras.map(o => `<option value="${o.id}" ${defaultObraId===o.id?'selected':''}>${o.nome}</option>`).join('')}
              </optgroup>
            </select>
          </div>
          <div>
            <label style="font-size:.76rem;color:var(--text);font-weight:800;display:block;margin-bottom:4px;">
              Conta Bancária
            </label>
            <select id="ocr-conta" class="form-control" style="font-size:.85rem;background:var(--bg-card);">
              <option value="">Selecione a conta...</option>
              ${contas.map(c => `<option value="${c.apelido || c.banco_nome}">${c.apelido || c.banco_nome} (${c.agencia||''}/${c.numero||''})</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
          <div>
            <label style="font-size:.74rem;color:var(--text3);font-weight:700;display:block;margin-bottom:4px;">
              Status do Lançamento
            </label>
            <select id="ocr-status" class="form-control" style="font-size:.85rem;" onchange="OCR._onStatusChange(this.value)">
              <option value="a_pagar" selected>⏳ A Pagar (Previsão)</option>
              <option value="pago">✓ Já Pago (Efetivado)</option>
            </select>
          </div>
          <div id="ocr-dt-pagto-wrap" style="display:none;">
            <label style="font-size:.74rem;color:var(--success);font-weight:700;display:block;margin-bottom:4px;">
              Data do Pagamento Efetivo
            </label>
            <input id="ocr-data-pagto" class="form-control" type="date" value="${Utils.today()}" style="font-size:.85rem;border-color:var(--success);">
          </div>
        </div>
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

      <!-- Botão de Ação Destacado no Final do Formulário -->
      <div style="margin-top:20px;padding:14px 16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()" style="font-weight:700;padding:10px 18px;">✕ Cancelar</button>
        <button type="button" class="btn btn-success" onclick="OCR.confirmarESalvarLancamento()" style="display:flex;align-items:center;gap:8px;font-size:1rem;font-weight:900;padding:12px 26px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 4px 14px rgba(22,163,74,.4);border:none;border-radius:8px;cursor:pointer;">
          ✓ Confirmar e Salvar Lançamento
        </button>
      </div>
    `;

    // Atualizar footer fixo do modal
    const footer = document.getElementById('ocr-modal-footer')
                || document.querySelector('#ocr-modal .modal-footer')
                || document.querySelector('.modal-footer');
    if (footer) {
      footer.style.display = 'flex';
      footer.style.justifyContent = 'space-between';
      footer.style.alignItems = 'center';
      footer.style.width = '100%';
      footer.innerHTML = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">✕ Cancelar</button>
        <button class="btn btn-success" onclick="OCR.confirmarESalvarLancamento()" style="display:flex;align-items:center;gap:8px;font-size:.95rem;font-weight:900;padding:10px 22px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 3px 10px rgba(22,163,74,.35);border:none;border-radius:6px;cursor:pointer;">
          ✓ Confirmar e Salvar Lançamento
        </button>
      `;
    }

    // Guardar dados originais
    this._dadosOCR = d;
  },

  _onStatusChange(val) {
    const wrap = document.getElementById('ocr-dt-pagto-wrap');
    if (wrap) wrap.style.display = val === 'pago' ? 'block' : 'none';
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

  // ── Cria e salva o lançamento diretamente com centro de custo e anexo ─────────────
  confirmarESalvarLancamento() {
    const get = id => document.getElementById(id)?.value?.trim() || '';

    const obraId      = get('ocr-obra');
    const conta       = get('ocr-conta');
    const status      = get('ocr-status') || 'a_pagar';
    const dataPagto   = status === 'pago' ? (get('ocr-data-pagto') || Utils.today()) : null;
    const fornecedor  = get('ocr-fornecedor');
    const cnpj        = get('ocr-cnpj');
    const valor       = parseFloat(get('ocr-valor'));
    const dataEmissao = get('ocr-data-emissao') || Utils.today();
    const vencimento  = get('ocr-vencimento')   || Utils.today();
    const descricao   = get('ocr-descricao')    || fornecedor || 'Lançamento via OCR';
    const categoria   = get('ocr-categoria')    || 'material';
    const numDoc      = get('ocr-num-doc');
    const barcode     = get('ocr-barcode');
    const obs         = get('ocr-obs');

    if (!obraId) {
      Utils.toast('Selecione se o lançamento é da Sede / Escritório ou de uma Obra.', 'warning');
      document.getElementById('ocr-obra')?.focus();
      return;
    }

    if (!valor || isNaN(valor) || valor <= 0) {
      Utils.toast('Informe um valor válido para o lançamento.', 'warning');
      document.getElementById('ocr-valor')?.focus();
      return;
    }

    // 1. Cadastra fornecedor se não existir
    let fornecedorId = null;
    if (fornecedor) {
      const fornecedores = DB.getAll('fornecedores') || [];
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      let forn = fornecedores.find(f => {
        const fCnpj = (f.cnpj || f.cpf || '').replace(/\D/g, '');
        return (cnpjLimpo && fCnpj === cnpjLimpo) || (f.nome && f.nome.toLowerCase() === fornecedor.toLowerCase());
      });
      if (!forn) {
        forn = DB.add('fornecedores', {
          nome: fornecedor,
          razao_social: fornecedor,
          cnpj_cpf: cnpj || '',
          categoria: categoria
        });
      }
      fornecedorId = forn?.id || null;
    }

    // 2. Prepara e cadastra os produtos/itens em Produtos
    let itensParaSalvar = (this._dadosOCR?.itens && this._dadosOCR.itens.length)
      ? [...this._dadosOCR.itens]
      : [];

    if (!itensParaSalvar.length && valor > 0 && descricao) {
      const cleanNome = descricao
        .replace(/^(compra\s+de\s+|aquisição\s+de\s+|aquisicao\s+de\s+|pgto\s+de\s+|pagamento\s+de\s+|fornecimento\s+de\s+|nfce\s+-\s+|nfe\s+-\s+)/i, '')
        .trim();
      if (cleanNome) {
        itensParaSalvar.push({
          produto: cleanNome,
          qtd: 1,
          unidade: 'un',
          valor_unit: valor,
          total: valor
        });
      }
    }

    let prodsCadastrados = [];
    if (typeof Produtos !== 'undefined' && Produtos.encontrarOuCriar) {
      itensParaSalvar.forEach(it => {
        if (it.produto && it.produto.trim()) {
          const prod = Produtos.encontrarOuCriar(it.produto, it.unidade || 'un', categoria);
          if (prod) {
            it.produto_id = prod.id;
            prodsCadastrados.push(prod.nome);
            if (Produtos.atualizarValorMedio) {
              Produtos.atualizarValorMedio(prod.id);
            }
          }
        }
      });
    }

    const tipo = this._dadosOCR?.tipo_lancamento === 'receita' ? 'receita' : 'despesa';
    const lanc = DB.add('lancamentos', {
      tipo,
      obra_id: obraId,
      conta_bancaria: conta,
      categoria,
      descricao,
      valor,
      data: dataEmissao,
      data_vencimento: vencimento,
      data_pagamento: dataPagto,
      status,
      fornecedor_beneficiario: fornecedor,
      fornecedor_id: fornecedorId,
      codigo_barras: barcode || '',
      origem: 'ocr',
      observacoes: [obs, numDoc ? `Doc: ${numDoc}` : '', this._dadosOCR?.chave_acesso ? `Chave NF-e: ${this._dadosOCR.chave_acesso}` : ''].filter(Boolean).join(' | ') || '',
      itens: itensParaSalvar,
      conciliado: false
    });

    // 3. Cria nota fiscal se for documento fiscal
    if (numDoc || this._dadosOCR?.chave_acesso || ['nfe','nfce','nfse'].includes(this._dadosOCR?.tipo_documento)) {
      try {
        DB.add('notas', {
          numero_nf: numDoc || 'S/N',
          serie: '1',
          emitente: fornecedor || 'Fornecedor',
          cnpj_emitente: cnpj || '',
          data_emissao: dataEmissao,
          data_vencimento: vencimento,
          data_pagamento: dataPagto,
          valor_total: valor,
          tipo: tipo === 'despesa' ? 'entrada' : 'saida',
          categoria,
          status: status === 'pago' ? 'paga' : 'pendente',
          obra_id: obraId,
          lancamento_id: lanc.id,
          chave_acesso: this._dadosOCR?.chave_acesso || '',
          itens: itensParaSalvar,
          observacoes: `Reconhecido via OCR em ${new Date().toLocaleString('pt-BR')}`
        });
      } catch (errNota) {
        console.warn('Erro ao criar nota fiscal vinculada:', errNota);
      }
    }

    // 4. Anexa o arquivo/comprovante se disponível
    if (this._base64Atual && typeof Documentos !== 'undefined') {
      try {
        const ext = (this._arquivoAtual?.name || '').split('.').pop() || 'pdf';
        Documentos.adicionar({
          entidade_tipo: 'lancamento',
          entidade_id: lanc.id,
          titulo: `Comprovante / ${descricao.slice(0, 30)}`,
          nome_arquivo: this._arquivoAtual?.name || `documento_ocr_${lanc.id}.${ext}`,
          tipo_mime: this._arquivoAtual?.type || 'application/pdf',
          tamanho: this._arquivoAtual?.size || Math.round(this._base64Atual.length * 0.75),
          data_base64: this._base64Atual
        });
      } catch (errDoc) {
        console.warn('Erro ao anexar arquivo ao lançamento:', errDoc);
      }
    }

    Utils.closeModal();
    Utils.toast(`✅ Lançamento de ${Utils.fmt.currency(valor)} registrado com sucesso!`, 'success');

    // Atualiza telas abertas
    if (typeof Lancamentos !== 'undefined' && Lancamentos.render) {
      const appContent = document.getElementById('app-content');
      if (appContent && typeof App !== 'undefined' && App.currentRoute === 'lancamentos') {
        appContent.innerHTML = Lancamentos.render(App.currentObraId);
        if (Lancamentos.init) Lancamentos.init(App.currentObraId);
      }
    }
    if (typeof Dashboard !== 'undefined' && typeof App !== 'undefined' && App.currentRoute === 'dashboard') {
      const appContent = document.getElementById('app-content');
      if (appContent) appContent.innerHTML = Dashboard.render(App.currentObraId);
    }
  },

  // Alias para manter compatibilidade
  _criarLancamento() {
    this.confirmarESalvarLancamento();
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
      ['parcela_caixa','🏦 Parcela Caixa'],
      ['entrada_propria','💵 Entrada Própria'],
      ['aporte_financeiro','💼 Aporte Financeiro'],
      ['emprestimo','🤝 Empréstimo'],
      ['financiamento','🏗️ Financiamento'],
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

      // Sincroniza o histórico com a nuvem (Neon) para aparecer no PC e celular
      if (typeof DB !== 'undefined' && DB.syncToCloud) {
        DB.syncToCloud('save', 'ocr_historico', novoItem);
      }
    } catch (err) {
      console.warn('[OCR] Erro ao salvar no histórico:', err);
    }
  },

  async sincronizarHistoricoNuvem() {
    try {
      const res = await fetch('/api/db?table=ocr_historico');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          const locais = this.obterHistorico();
          const mapa = new Map(locais.map(x => [x.id, x]));
          json.data.forEach(ch => {
            mapa.set(ch.id, { ...(mapa.get(ch.id) || {}), ...ch });
          });
          const mesclados = Array.from(mapa.values())
            .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora))
            .slice(0, 40);
          localStorage.setItem('finobra_ocr_historico', JSON.stringify(mesclados));
          return mesclados;
        }
      }
    } catch (e) {
      console.warn('[OCR] Falha ao sincronizar histórico da nuvem:', e);
    }
    return this.obterHistorico();
  },

  abrirHistorico() {
    let hist = this.obterHistorico();

    const renderList = (items) => {
      if (items.length === 0) {
        return `
          <div style="text-align:center;padding:40px;color:var(--text3);">
            <div style="font-size:3rem;margin-bottom:10px;">📄</div>
            <div style="font-size:.95rem;font-weight:700;color:var(--text);">Nenhum documento lido ainda</div>
            <div style="font-size:.8rem;margin-top:4px;">As leituras de boletos e notas com a IA sincronizam entre seu celular e computador.</div>
          </div>
        `;
      }
      return `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${items.map((item) => {
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
      `;
    };

    Utils.showModal(`
      <div class="modal" id="ocr-hist-modal" style="max-width:680px;width:95vw;">
        <div class="modal-header" style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);border-radius:var(--r-lg) var(--r-lg) 0 0;">
          <div class="modal-title" style="color:#e0e7ff;display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.3rem;">📜</span>
            <div>
              <div style="font-weight:800;font-size:1rem;">Histórico de Leituras da IA</div>
              <div id="ocr-hist-sub" style="font-size:.72rem;color:#a5b4fc;">Sincronizado entre celular e computador</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="OCR.limparHistorico()" style="color:#f87171;font-size:.72rem;" title="Limpar todo o histórico">🗑️ Limpar</button>
            <button class="modal-close" onclick="Utils.closeModal()" style="color:#a5b4fc;">✕</button>
          </div>
        </div>

        <div class="modal-body" id="ocr-hist-body" style="padding:16px;max-height:70vh;overflow-y:auto;">
          ${renderList(hist)}
        </div>

        <div class="modal-footer" style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;">
          <button class="btn btn-secondary btn-sm" onclick="OCR.abrirModal()">← Voltar ao Escaneador</button>
          <button class="btn btn-secondary btn-sm" onclick="Utils.closeModal()">Fechar</button>
        </div>
      </div>
    `);

    // Busca da nuvem para garantir sincronização entre celular e PC
    this.sincronizarHistoricoNuvem().then(items => {
      const body = document.getElementById('ocr-hist-body');
      if (body) {
        body.innerHTML = renderList(items);
      }
    });
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
    if (typeof DB !== 'undefined' && DB.syncToCloud) {
      DB.syncToCloud('delete', 'ocr_historico', null, 'all');
    }
    Utils.toast('Histórico de OCR limpo!', 'info');
    this.abrirHistorico();
  }
};
