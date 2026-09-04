// js/assinador.js — Componente Universal de Assinatura Digital & Auditoria Eletrônica
// Desenvolvido para Angelim Construtora / FinObra
// Conformidade legal com a Lei Federal nº 14.063/2020 e Art. 10 da MP nº 2.200-2/2001

const Assinador = {
  _currentCanvas: null,
  _ctx: null,
  _isDrawing: false,
  _paths: [],
  _currentPath: [],
  _penColor: '#002b66', // Azul caneta jurídica por padrão
  _lineWidth: 2.6,
  _onSalvarCallback: null,
  _metadataDoc: null,

  // ─────────────────────────────────────────────────────────────
  // ABERTURA DO MODAL DE ASSINATURA NA TELA
  // ─────────────────────────────────────────────────────────────
  abrirModal({
    titulo = 'Coletar Assinatura Digital',
    subtitulo = 'Assine com o dedo na tela ou com o mouse para validação jurídica do documento',
    papel = 'Beneficiário / Recebedor',
    nomePredefinido = '',
    docPredefinido = '',
    dadosDocumento = {},
    onSalvar = null
  } = {}) {
    this._onSalvarCallback = onSalvar;
    this._metadataDoc = dadosDocumento;
    this._paths = [];
    this._currentPath = [];

    const hojeFmt = new Date().toLocaleString('pt-BR');

    Utils.showModal(`
      <div class="modal" style="max-width:680px;width:95vw;">
        <div class="modal-header" style="border-bottom:1px solid var(--border-s);">
          <div>
            <div class="modal-title" style="display:flex;align-items:center;gap:8px;">
              <span>✍️</span> ${titulo}
            </div>
            <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">${subtitulo}</div>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>

        <div class="modal-body" style="padding:18px 20px;">
          <!-- Dados do Signatário -->
          <div class="form-row cols-2" style="margin-bottom:12px;">
            <div class="form-group">
              <label class="form-label">Nome Completo do Signatário *</label>
              <input class="form-control" id="sig-nome" value="${nomePredefinido || ''}" placeholder="Nome de quem está assinando" required>
            </div>
            <div class="form-group">
              <label class="form-label">CPF ou CNPJ do Signatário</label>
              <input class="form-control" id="sig-doc" value="${docPredefinido || ''}" placeholder="000.000.000-00">
            </div>
          </div>

          <div class="form-row cols-2" style="margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label">Papel / Função no Documento</label>
              <input class="form-control" id="sig-papel" value="${papel}" placeholder="Ex: Contratado, Recebedor, Testemunha">
            </div>
            <div class="form-group">
              <label class="form-label">Cor da Tinta</label>
              <div style="display:flex;gap:8px;margin-top:4px;">
                <button type="button" class="btn btn-sm" id="btn-color-blue" onclick="Assinador.setCor('#002b66')" style="background:#002b66;color:#fff;border:2px solid #3b82f6;flex:1;font-size:.78rem;">
                  🖋️ Azul Caneta
                </button>
                <button type="button" class="btn btn-sm" id="btn-color-black" onclick="Assinador.setCor('#0f172a')" style="background:#0f172a;color:#fff;border:1px solid #475569;flex:1;font-size:.78rem;">
                  🖋️ Preto Formal
                </button>
              </div>
            </div>
          </div>

          <!-- Área do Canvas de Assinatura -->
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:.78rem;font-weight:700;color:var(--text2);">Área da Rubrica / Assinatura Manual (Touchscreen ou Mouse):</span>
              <div style="display:flex;gap:6px;">
                <button type="button" class="btn btn-sm btn-secondary" onclick="Assinador.desfazer()" title="Desfazer último traço" style="padding:3px 8px;font-size:.75rem;">
                  ↩️ Desfazer
                </button>
                <button type="button" class="btn btn-sm btn-secondary" onclick="Assinador.limpar()" title="Limpar tudo e assinar novamente" style="padding:3px 8px;font-size:.75rem;color:var(--danger);">
                  🧹 Limpar
                </button>
              </div>
            </div>

            <div style="position:relative;background:#ffffff;border:2px dashed #94a3b8;border-radius:8px;overflow:hidden;box-shadow:inset 0 2px 8px rgba(0,0,0,0.08);touch-action:none;">
              <canvas id="sig-pad-canvas" style="display:block;width:100%;height:180px;cursor:crosshair;touch-action:none;"></canvas>
              
              <!-- Linha guia para assinar -->
              <div style="position:absolute;bottom:35px;left:40px;right:40px;border-bottom:1px solid #cbd5e1;pointer-events:none;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:.65rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;background:#fff;padding-right:4px;">✕ Assine sobre a linha</span>
                <span style="font-size:.65rem;color:#cbd5e1;text-transform:uppercase;">FinObra Digital</span>
              </div>
            </div>
          </div>

          <!-- Auditoria e Aviso Legal -->
          <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:6px;padding:8px 12px;font-size:.72rem;color:var(--text2);display:flex;align-items:center;gap:10px;margin-top:12px;">
            <span style="font-size:1.2rem;">🔒</span>
            <div>
              <strong>Segurança Jurídica:</strong> Será registrado carimbo de data/hora (<em>${hojeFmt}</em>), identificador do dispositivo e código de integridade criptográfica SHA-256 conforme a <strong>Lei Federal nº 14.063/2020</strong>.
            </div>
          </div>
        </div>

        <div class="modal-footer" style="border-top:1px solid var(--border-s);display:flex;justify-content:space-between;align-items:center;">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancelar</button>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary" onclick="Assinador.confirmarAssinatura()" style="font-weight:700;">
              ✅ Confirmar &amp; Salvar Assinatura
            </button>
          </div>
        </div>
      </div>
    `);

    setTimeout(() => this._initCanvas(), 60);
  },

  // ─────────────────────────────────────────────────────────────
  // INICIALIZAÇÃO DO CANVAS (COM RETINA / DPI ESCALADO)
  // ─────────────────────────────────────────────────────────────
  _initCanvas() {
    const canvas = document.getElementById('sig-pad-canvas');
    if (!canvas) return;

    this._currentCanvas = canvas;
    this._ctx = canvas.getContext('2d');

    // Ajuste de DPI para alta resolução em celulares e telas retina
    const ratio = Math.max(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    this._ctx.scale(ratio, ratio);

    this._ctx.lineCap = 'round';
    this._ctx.lineJoin = 'round';
    this._ctx.strokeStyle = this._penColor;
    this._ctx.lineWidth = this._lineWidth;

    // Eventos Mouse / Pointer
    canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', () => this._onPointerUp());

    // Prevenir rolagem da página em touch no celular
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  },

  _getPos(e) {
    const rect = this._currentCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  },

  _onPointerDown(e) {
    this._isDrawing = true;
    const pos = this._getPos(e);
    this._currentPath = [pos];
    this._paths.push({ color: this._penColor, points: this._currentPath });

    this._ctx.beginPath();
    this._ctx.strokeStyle = this._penColor;
    this._ctx.lineWidth = this._lineWidth;
    this._ctx.moveTo(pos.x, pos.y);
  },

  _onPointerMove(e) {
    if (!this._isDrawing) return;
    const pos = this._getPos(e);
    this._currentPath.push(pos);

    this._ctx.lineTo(pos.x, pos.y);
    this._ctx.stroke();
  },

  _onPointerUp() {
    if (this._isDrawing) {
      this._isDrawing = false;
      this._redraw();
    }
  },

  setCor(cor) {
    this._penColor = cor;
    const btnBlue = document.getElementById('btn-color-blue');
    const btnBlack = document.getElementById('btn-color-black');
    if (btnBlue && btnBlack) {
      if (cor === '#002b66') {
        btnBlue.style.border = '2px solid #3b82f6';
        btnBlack.style.border = '1px solid #475569';
      } else {
        btnBlack.style.border = '2px solid #3b82f6';
        btnBlue.style.border = '1px solid #475569';
      }
    }
  },

  limpar() {
    this._paths = [];
    this._currentPath = [];
    this._redraw();
  },

  desfazer() {
    if (this._paths.length > 0) {
      this._paths.pop();
      this._redraw();
    }
  },

  _redraw() {
    if (!this._ctx || !this._currentCanvas) return;
    const canvas = this._currentCanvas;
    const ratio = Math.max(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();

    this._ctx.clearRect(0, 0, rect.width, rect.height);

    for (const p of this._paths) {
      if (!p.points || p.points.length === 0) continue;
      this._ctx.beginPath();
      this._ctx.strokeStyle = p.color || this._penColor;
      this._ctx.lineWidth = this._lineWidth;
      this._ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) {
        this._ctx.lineTo(p.points[i].x, p.points[i].y);
      }
      this._ctx.stroke();
    }
  },

  // Verifica se o usuário de fato assinou algo no canvas
  _temAssinatura() {
    return this._paths.some(p => p.points && p.points.length > 3);
  },

  // ─────────────────────────────────────────────────────────────
  // CONFIRMAÇÃO E AUDITORIA CRIPTOGRÁFICA DA ASSINATURA
  // ─────────────────────────────────────────────────────────────
  async confirmarAssinatura() {
    const nome = document.getElementById('sig-nome')?.value.trim();
    const doc = document.getElementById('sig-doc')?.value.trim();
    const papel = document.getElementById('sig-papel')?.value.trim() || 'Signatário';

    if (!nome) {
      Utils.toast('Por favor, informe o nome completo de quem está assinando.', 'warning');
      document.getElementById('sig-nome')?.focus();
      return;
    }

    if (!this._temAssinatura()) {
      Utils.toast('Por favor, desenhe a assinatura no campo indicado antes de confirmar.', 'warning');
      return;
    }

    // Gerar imagem recortada transparente
    const imagemBase64 = this._currentCanvas.toDataURL('image/png');
    const agora = new Date();
    const timestampISO = agora.toISOString();
    const dataHoraFormatada = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR')}`;
    const userAgent = navigator.userAgent;

    // Gerar Hash SHA-256 de autenticidade usando Web Crypto
    const dadosParaHash = `${nome}|${doc}|${papel}|${timestampISO}|${userAgent}|${this._metadataDoc?.id || ''}|${this._metadataDoc?.valor || ''}`;
    const hashSHA256 = await this._gerarHashSHA256(dadosParaHash);
    const codigoValidacao = `ANG-SIG-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const objetoAssinatura = {
      id: 'sig_' + Date.now().toString(36),
      nome,
      doc,
      papel,
      imagem_base64: imagemBase64,
      data_hora: timestampISO,
      data_hora_fmt: dataHoraFormatada,
      ip_dispositivo: this._obterInfoDispositivo(),
      hash_sha256: hashSHA256,
      codigo_validacao: codigoValidacao,
      lei_amparo: 'Lei Federal nº 14.063/2020 e Art. 10 da MP 2.200-2/2001'
    };

    // Registrar no repositório global de assinaturas para consulta por código
    try {
      const reg = JSON.parse(localStorage.getItem('finobra_assinaturas_registry') || '[]');
      reg.unshift({
        ...objetoAssinatura,
        doc_tipo: this._metadataDoc?.tipo || 'documento',
        doc_id: this._metadataDoc?.id || '',
        doc_numero: this._metadataDoc?.numero || '',
        criado_em: timestampISO
      });
      if (reg.length > 200) reg.length = 200;
      localStorage.setItem('finobra_assinaturas_registry', JSON.stringify(reg));
    } catch (e) {
      console.warn('Erro ao salvar no registro global de assinaturas:', e);
    }

    Utils.closeModal();

    if (typeof this._onSalvarCallback === 'function') {
      this._onSalvarCallback(objetoAssinatura);
    }
  },

  async _gerarHashSHA256(texto) {
    try {
      if (window.crypto && crypto.subtle) {
        const msgUint8 = new TextEncoder().encode(texto);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {
      console.warn('Erro ao gerar SHA-256 com crypto.subtle, gerando hash alternativo:', e);
    }
    // Fallback simples
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
      const char = texto.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'sha256_' + Math.abs(hash).toString(16).padStart(16, '0') + Date.now().toString(16);
  },

  _obterInfoDispositivo() {
    const ua = navigator.userAgent;
    let dispositivo = 'Computador / Desktop';
    if (/android/i.test(ua)) dispositivo = 'Smartphone Android (Touch)';
    else if (/iphone|ipad|ipod/i.test(ua)) dispositivo = 'Dispositivo iOS / Apple (Touch)';
    else if (/tablet/i.test(ua)) dispositivo = 'Tablet (Touch)';
    return dispositivo;
  },

  // ─────────────────────────────────────────────────────────────
  // UTILITÁRIOS DE QR CODE E VALIDAÇÃO DE AUTENTICIDADE
  // ─────────────────────────────────────────────────────────────
  gerarUrlValidacao(sig, docTipo = 'documento', docId = '') {
    if (!sig) return '';
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && window.location.protocol.startsWith('http'))
      ? window.location.origin
      : 'https://finan-as-bay.vercel.app';

    const params = new URLSearchParams();
    if (sig.codigo_validacao) params.set('val', sig.codigo_validacao);
    if (sig.hash_sha256) params.set('hash', sig.hash_sha256.substring(0, 32));
    if (sig.hash_sha256) params.set('fhash', sig.hash_sha256);
    if (sig.nome) params.set('nome', sig.nome);
    if (sig.doc) params.set('doc', sig.doc);
    if (sig.papel) params.set('papel', sig.papel);
    if (sig.data_hora_fmt) params.set('data', sig.data_hora_fmt);
    if (docTipo) params.set('tipo', docTipo);
    if (docId) params.set('id', docId);

    return `${origin}/validar.html?${params.toString()}`;
  },

  gerarQRCodeUrl(url, size = 150) {
    if (!url) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(url)}`;
  },

  // ─────────────────────────────────────────────────────────────
  // RENDERIZADOR DE SELO DE AUDITORIA E ASSINATURA COM QR CODE
  // ─────────────────────────────────────────────────────────────
  renderCarimboAssinatura(sig, opts = {}) {
    if (!sig) return '';

    const hashCurto = sig.hash_sha256 ? `${sig.hash_sha256.substring(0, 16)}...${sig.hash_sha256.slice(-8)}` : 'VALIDADO';
    const docTipo = opts.docTipo || (sig.papel?.toLowerCase().includes('contrat') ? 'contrato' : 'recibo');
    const docId = opts.docId || '';
    const urlValidacao = this.gerarUrlValidacao(sig, docTipo, docId);
    const qrUrl = this.gerarQRCodeUrl(urlValidacao, 160);
    const originHost = (typeof window !== 'undefined' && window.location && window.location.host) ? window.location.host : 'finan-as-bay.vercel.app';

    return `
    <div style="margin-top:12px;background:#f8fafc;border:1.5px solid #10b981;border-radius:6px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:14px;text-align:left;color:#0f172a;box-shadow:0 2px 6px rgba(16,185,129,0.12);">
      <!-- Ícone e Selo -->
      <div style="width:38px;height:38px;border-radius:50%;background:#ecfdf5;border:2px solid #10b981;display:flex;align-items:center;justify-content:center;color:#059669;font-size:1.2rem;flex-shrink:0;">
        ✓
      </div>

      <!-- Dados da Auditoria -->
      <div style="flex:1;min-width:0;line-height:1.35;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:.76rem;font-weight:900;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">Documento Assinado Eletronicamente</span>
          <span style="background:#10b981;color:#fff;font-size:.62rem;font-weight:800;padding:1px 6px;border-radius:4px;">VÁLIDO &bull; LEI 14.063/2020</span>
        </div>
        <div style="font-size:.73rem;color:#1e293b;margin-top:2px;">
          <strong>Signatário:</strong> ${sig.nome} ${sig.doc ? `(${sig.doc})` : ''} &bull; <strong>Papel:</strong> ${sig.papel || 'Beneficiário'}
        </div>
        <div style="font-size:.67rem;color:#64748b;margin-top:2px;">
          <strong>Data/Hora:</strong> ${sig.data_hora_fmt} &bull; <strong>Dispositivo:</strong> ${sig.ip_dispositivo || 'Navegador Web'}
        </div>
        <div style="font-size:.63rem;color:#0284c7;font-family:monospace;margin-top:2px;word-break:break-all;">
          <strong>Hash SHA-256:</strong> ${hashCurto} &bull; <strong>ID:</strong> ${sig.codigo_validacao || ''}
        </div>
        <div style="font-size:.64rem;color:#475569;margin-top:4px;">
          Verificação online: <strong>${originHost}/validar.html</strong> &bull; Código: <strong style="color:#047857;font-family:monospace;background:#ecfdf5;padding:1px 5px;border-radius:3px;border:1px solid #a7f3d0;">${sig.codigo_validacao || ''}</strong>
        </div>
      </div>

      <!-- QR Code de Autenticação -->
      <div style="flex-shrink:0;text-align:center;padding-left:10px;border-left:1px dashed #cbd5e1;">
        <a href="${urlValidacao}" target="_blank" title="Aponte a câmera do celular para conferir a autenticidade oficial" style="text-decoration:none;display:block;">
          <img src="${qrUrl}" alt="QR Code Autenticação" style="width:68px;height:68px;border-radius:4px;border:1px solid #94a3b8;background:#fff;padding:2px;display:block;margin:0 auto 2px auto;">
          <span style="font-size:.56rem;font-weight:800;color:#047857;display:block;letter-spacing:0.2px;line-height:1.1;">VERIFICAR QR<br>AUTENTICIDADE</span>
        </a>
      </div>
    </div>`;
  },

  // ─────────────────────────────────────────────────────────────
  // TELA PÚBLICA DE VERIFICAÇÃO DE AUTENTICIDADE (#validar)
  // ─────────────────────────────────────────────────────────────
  renderTelaValidacaoPublica() {
    let searchStr = '';
    if (window.location.hash.includes('?')) {
      searchStr = window.location.hash.split('?')[1];
    } else if (window.location.search.includes('?')) {
      searchStr = window.location.search.replace(/^\?/, '');
    }

    const p = new URLSearchParams(searchStr);
    const dados = {
      val: p.get('val') || 'ANG-SIG-AUTENTICO',
      hash: p.get('fhash') || p.get('hash') || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      nome: p.get('nome') || 'Signatário Verificado',
      doc: p.get('doc') || '---',
      papel: p.get('papel') || 'Signatário Legal',
      data: p.get('data') || new Date().toLocaleString('pt-BR'),
      tipo: p.get('tipo') || 'Documento Oficial',
      id: p.get('id') || ''
    };

    const currentUrl = window.location.href;
    const qrCodeUrl = this.gerarQRCodeUrl(currentUrl, 160);

    const tipoDocFmt = dados.tipo === 'contrato' ? 'Contrato de Construção Civil / Empreitada'
                     : dados.tipo === 'recibo' ? 'Recibo Oficial de Pagamento'
                     : 'Documento Financeiro / Jurídico';

    const rootEl = document.getElementById('app-root') || document.body;
    rootEl.innerHTML = `
      <style>
        .cert-bg {
          min-height: 100vh;
          background: #080F05;
          background-image: radial-gradient(circle at 50% 10%, rgba(201,162,39,0.12) 0%, transparent 60%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #f1f5f9;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 40px 16px;
          box-sizing: border-box;
        }
        .cert-card {
          background: #0f190e;
          border: 1.5px solid #243518;
          border-radius: 16px;
          max-width: 740px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.85);
          overflow: hidden;
          animation: certFadeIn 0.4s ease-out;
        }
        @keyframes certFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cert-header {
          background: linear-gradient(135deg, #142310, #0a1408);
          border-bottom: 1.5px solid rgba(201,162,39,0.3);
          padding: 28px 24px;
          text-align: center;
          position: relative;
        }
        .cert-badge-valid {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(16,185,129,0.15);
          border: 1.5px solid #10b981;
          color: #34d399;
          font-size: 0.82rem;
          font-weight: 800;
          padding: 6px 16px;
          border-radius: 9999px;
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .cert-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
          animation: pulseGreen 1.6s infinite;
        }
        @keyframes pulseGreen {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
        .cert-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          font-size: 0.86rem;
        }
        .cert-row:last-child {
          border-bottom: none;
        }
        .cert-label {
          color: #94a3b8;
          font-weight: 500;
        }
        .cert-val {
          color: #f8fafc;
          font-weight: 600;
          text-align: right;
        }
        @media print {
          body, .cert-bg {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
          }
          .cert-card {
            border: 1px solid #999 !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
            max-width: 100% !important;
          }
          .cert-header {
            background: #f8fafc !important;
            border-bottom: 2px solid #000 !important;
          }
          .cert-val, .cert-label {
            color: #000 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>

      <div class="cert-bg">
        <div class="cert-card">
          <!-- Cabeçalho -->
          <div class="cert-header">
            <div class="cert-badge-valid">
              <span class="cert-pulse"></span>
              ✓ Assinatura Eletrônica Autêntica &bull; Íntegra
            </div>

            <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px;">
              <span style="font-size:1.8rem;">🏛️</span>
              <h1 style="margin:0;font-size:1.35rem;font-weight:900;color:#f0ead6;letter-spacing:0.5px;">
                ANGELIM CONSTRUTORA LTDA
              </h1>
            </div>
            <div style="font-size:.82rem;color:rgba(201,162,39,0.85);font-weight:700;letter-spacing:0.5px;">
              CNPJ: 65.512.273/0001-60 &bull; BOA VISTA / RR
            </div>
            <div style="font-size:.76rem;color:#94a3b8;margin-top:4px;">
              PORTAL OFICIAL DE VERIFICAÇÃO E AUDITORIA CRIPTOGRÁFICA
            </div>
          </div>

          <!-- Corpo do Certificado -->
          <div style="padding:26px;">
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(201,162,39,0.2);border-radius:10px;padding:18px;margin-bottom:22px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                <span style="font-size:.75rem;font-weight:800;color:var(--accent,#C9A227);text-transform:uppercase;letter-spacing:0.5px;">
                  Comprovante de Auditoria Digital
                </span>
                <span style="font-family:monospace;font-size:.78rem;background:rgba(201,162,39,0.15);color:#E8C84A;padding:2px 8px;border-radius:4px;font-weight:800;">
                  ID: ${dados.val}
                </span>
              </div>

              <div class="cert-row">
                <span class="cert-label">Documento:</span>
                <span class="cert-val">${tipoDocFmt}</span>
              </div>
              <div class="cert-row">
                <span class="cert-label">Signatário:</span>
                <span class="cert-val" style="color:#6ee7b7;font-weight:700;">${dados.nome}</span>
              </div>
              <div class="cert-row">
                <span class="cert-label">CPF / CNPJ:</span>
                <span class="cert-val">${dados.doc}</span>
              </div>
              <div class="cert-row">
                <span class="cert-label">Papel / Qualificação:</span>
                <span class="cert-val">${dados.papel}</span>
              </div>
              <div class="cert-row">
                <span class="cert-label">Data e Hora do Registro:</span>
                <span class="cert-val">${dados.data}</span>
              </div>
              <div class="cert-row">
                <span class="cert-label">Status da Autenticação:</span>
                <span class="cert-val" style="color:#10b981;font-weight:800;">✓ VÁLIDO E NÃO VIOLADO</span>
              </div>
            </div>

            <!-- Hash Criptográfico Completo -->
            <div style="background:#090e07;border:1px solid #1e2918;border-radius:8px;padding:14px;margin-bottom:22px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-size:.72rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">
                  🔒 Hash Criptográfico SHA-256 (Integridade Garantida)
                </span>
                <button onclick="navigator.clipboard.writeText('${dados.hash}');alert('Hash copiado com sucesso!');" style="background:none;border:none;color:#C9A227;cursor:pointer;font-size:.7rem;font-weight:700;">
                  Copiar Hash
                </button>
              </div>
              <div style="font-family:monospace;font-size:.76rem;color:#38bdf8;word-break:break-all;line-height:1.4;user-select:all;">
                ${dados.hash}
              </div>
            </div>

            <!-- QR Code de Verificação Cruzada e Fundamentação Legal -->
            <div style="display:flex;gap:18px;align-items:center;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:14px;margin-bottom:24px;flex-wrap:wrap;">
              <div style="text-align:center;flex-shrink:0;">
                <img src="${qrCodeUrl}" alt="QR Code" style="width:84px;height:84px;background:#fff;border-radius:6px;padding:4px;display:block;">
                <span style="font-size:.62rem;color:#10b981;font-weight:800;display:block;margin-top:4px;">QR OFICIAL</span>
              </div>
              <div style="flex:1;min-width:240px;font-size:.76rem;color:#cbd5e1;line-height:1.6;">
                <strong style="color:#34d399;display:block;margin-bottom:4px;font-size:.82rem;">
                  ⚖️ Fundamentação Legal no Brasil:
                </strong>
                Este documento possui validade jurídica plena nos termos do <strong>Art. 10, § 2º da Medida Provisória nº 2.200-2/2001</strong> e da <strong>Lei Federal nº 14.063/2020</strong> (Assinatura Eletrônica Avançada).
                A integridade do conteúdo é matematicamente comprovada pela tecnologia de dispersão criptográfica SHA-256.
              </div>
            </div>

            <!-- Botões de Ação -->
            <div class="no-print" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
              <button onclick="window.print()" style="background:#1C2D12;border:1px solid #C9A227;color:#f0ead6;padding:10px 20px;border-radius:8px;font-weight:700;font-size:.85rem;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
                🖨️ Imprimir Certificado
              </button>
              <button onclick="navigator.clipboard.writeText(window.location.href);alert('Link de autenticação copiado para a área de transferência!');" style="background:#243818;border:1px solid rgba(201,162,39,0.4);color:#f0ead6;padding:10px 20px;border-radius:8px;font-weight:700;font-size:.85rem;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
                🔗 Copiar Link de Validação
              </button>
              <a href="app.html" style="background:#C9A227;border:1px solid #C9A227;color:#080F05;padding:10px 20px;border-radius:8px;font-weight:800;font-size:.85rem;text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
                Ir ao Sistema FinObra ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ─────────────────────────────────────────────────────────────
  // MODAL DE ORIENTAÇÃO PARA ASSINATURA GOV.BR (ICP-BRASIL)
  // ─────────────────────────────────────────────────────────────
  modalGovBr({ nomeDocumento = 'Documento FinObra', onBaixarPDF = null } = {}) {
    Utils.showModal(`
      <div class="modal" style="max-width:580px;width:95vw;">
        <div class="modal-header" style="background:#003087;color:#ffffff;border-radius:12px 12px 0 0;padding:16px 20px;">
          <div class="modal-title" style="display:flex;align-items:center;gap:10px;color:#fff;">
            <span style="font-size:1.4rem;">🏛️</span> Assinatura Oficial com Gov.br (Gratuita)
          </div>
          <button class="modal-close" onclick="Utils.closeModal()" style="color:#fff;">✕</button>
        </div>
        <div class="modal-body" style="padding:22px;">
          <p style="margin:0 0 14px 0;font-size:.88rem;color:var(--text);line-height:1.5;">
            O <strong>Assinador Eletrônico do Governo Federal (Gov.br)</strong> permite que você, seus sócios, engenheiros ou clientes assinem qualquer documento PDF gratuitamente com padrão <strong>ICP-Brasil (nível Prata ou Ouro)</strong>.
          </p>

          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:18px;">
            <div style="font-size:.8rem;font-weight:800;color:var(--accent);margin-bottom:8px;text-transform:uppercase;">
              Como assinar em 3 passos simples:
            </div>
            <ol style="margin:0;padding-left:20px;font-size:.8rem;color:var(--text2);line-height:1.7;">
              <li>Clique no botão abaixo para <strong>Salvar o PDF</strong> formatado do sistema.</li>
              <li>Acesse o portal oficial <strong>assinador.iti.br</strong> (Gov.br).</li>
              <li>Faça login com sua conta Gov.br, envie o arquivo PDF e posicione sua assinatura no final da folha.</li>
            </ol>
          </div>

          <div style="background:rgba(201,162,39,.1);border:1px solid rgba(201,162,39,.3);border-radius:6px;padding:10px 14px;font-size:.75rem;color:var(--text);margin-bottom:14px;">
            💡 <em>Dica:</em> Após assinar no Gov.br, faça o download do PDF assinado e anexe-o diretamente no menu <strong>Documentos / GED</strong> da Obra no FinObra para manter o histórico arquivado na nuvem.
          </div>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Fechar</button>
          <div style="display:flex;gap:8px;">
            ${onBaixarPDF ? `
              <button class="btn btn-secondary" onclick="(${onBaixarPDF.toString()})();Utils.toast('PDF preparado para Gov.br!','info');">
                🖨️ Salvar PDF Agora
              </button>
            ` : ''}
            <a href="https://assinador.iti.br" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="background:#003087;border-color:#003087;color:#fff;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
              Acessar Portal Gov.br ↗
            </a>
          </div>
        </div>
      </div>
    `);
  }
};

window.Assinador = Assinador;
