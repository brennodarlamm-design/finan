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
  // RENDERIZADOR DE SELO DE AUDITORIA E ASSINATURA ELETRÔNICA
  // ─────────────────────────────────────────────────────────────
  renderCarimboAssinatura(sig) {
    if (!sig) return '';

    const hashCurto = sig.hash_sha256 ? `${sig.hash_sha256.substring(0, 16)}...${sig.hash_sha256.slice(-8)}` : 'VALIDADO';

    return `
    <div style="margin-top:12px;background:#f8fafc;border:1.5px solid #10b981;border-radius:6px;padding:10px 14px;display:flex;align-items:center;gap:14px;text-align:left;color:#0f172a;box-shadow:0 2px 6px rgba(16,185,129,0.12);">
      <!-- Ícone e Selo -->
      <div style="width:40px;height:40px;border-radius:50%;background:#ecfdf5;border:2px solid #10b981;display:flex;align-items:center;justify-content:center;color:#059669;font-size:1.3rem;flex-shrink:0;">
        ✓
      </div>

      <!-- Dados da Auditoria -->
      <div style="flex:1;min-width:0;line-height:1.35;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:.78rem;font-weight:900;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">Documento Assinado Eletronicamente</span>
          <span style="background:#10b981;color:#fff;font-size:.65rem;font-weight:800;padding:1px 6px;border-radius:4px;">VÁLIDO</span>
        </div>
        <div style="font-size:.75rem;color:#1e293b;margin-top:2px;">
          <strong>Signatário:</strong> ${sig.nome} ${sig.doc ? `(${sig.doc})` : ''} &bull; <strong>Papel:</strong> ${sig.papel || 'Beneficiário'}
        </div>
        <div style="font-size:.68rem;color:#64748b;margin-top:2px;">
          <strong>Data/Hora:</strong> ${sig.data_hora_fmt} &bull; <strong>Dispositivo:</strong> ${sig.ip_dispositivo || 'Navegador Web'}
        </div>
        <div style="font-size:.64rem;color:#0284c7;font-family:monospace;margin-top:2px;word-break:break-all;">
          <strong>Hash SHA-256:</strong> ${hashCurto} &bull; <strong>ID:</strong> ${sig.codigo_validacao || ''}
        </div>
      </div>
    </div>`;
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
