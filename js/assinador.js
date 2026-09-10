// js/assinador.js — Componente Universal de Assinatura Digital & Auditoria Eletrônica
// Desenvolvido para uso multi-tenant no FinObra
// Registro eletrônico de assinatura e trilha de auditoria; a validade jurídica depende do contexto, da identificação das partes e dos requisitos aplicáveis.

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
    subtitulo = 'Assine com o dedo na tela ou com o mouse para registrar a assinatura eletrônica',
    papel = 'Beneficiário / Recebedor',
    nomePredefinido = '',
    docPredefinido = '',
    dadosDocumento = {},
    onSalvar = null
  } = {}) {
    const plano = String((typeof DB !== 'undefined' && DB.getEmpresa ? DB.getEmpresa()?.plano : '') || 'trial').toLowerCase();
    if (plano === 'starter') {
      Utils.toast('Assinatura eletrônica com validação está disponível nos planos Profissional e Ilimitado.', 'warning');
      if (typeof App !== 'undefined' && App.navigate) setTimeout(() => App.navigate('planos'), 300);
      return;
    }
    this._onSalvarCallback = onSalvar;
    this._metadataDoc = dadosDocumento;
    this._paths = [];
    this._currentPath = [];

    const hojeFmt = new Date().toLocaleString('pt-BR');
    const e = Utils.escapeHtml.bind(Utils);

    Utils.showModal(`
      <div class="modal" style="max-width:680px;width:95vw;">
        <div class="modal-header" style="border-bottom:1px solid var(--border-s);">
          <div>
            <div class="modal-title" style="display:flex;align-items:center;gap:8px;">
              <span>✍️</span> ${e(titulo)}
            </div>
            <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">${e(subtitulo)}</div>
          </div>
          <button class="modal-close" onclick="Utils.closeModal()">✕</button>
        </div>

        <div class="modal-body" style="padding:18px 20px;">
          <!-- Dados do Signatário -->
          <div class="form-row cols-2" style="margin-bottom:12px;">
            <div class="form-group">
              <label class="form-label">Nome Completo do Signatário *</label>
              <input class="form-control" id="sig-nome" value="${e(nomePredefinido || '')}" placeholder="Nome de quem está assinando" required>
            </div>
            <div class="form-group">
              <label class="form-label">CPF ou CNPJ do Signatário</label>
              <input class="form-control" id="sig-doc" value="${e(docPredefinido || '')}" placeholder="000.000.000-00">
            </div>
          </div>

          <div class="form-row cols-2" style="margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label">Papel / Função no Documento</label>
              <input class="form-control" id="sig-papel" value="${e(papel)}" placeholder="Ex: Contratado, Recebedor, Testemunha">
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
              <strong>Registro de Auditoria:</strong> serão registrados data/hora (<em>${e(hojeFmt)}</em>), identificador técnico do dispositivo e código SHA-256 do registro. A validade jurídica do documento depende do contexto, da identificação das partes e dos requisitos aplicáveis.
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
    const codigoValidacao = this._gerarCodigoValidacao();

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
      lei_amparo: 'Registro eletrônico no FinObra',
      doc_tipo: this._metadataDoc?.tipo || 'documento',
      doc_id: this._metadataDoc?.id || '',
      doc_numero: this._metadataDoc?.numero || ''
    };

    // Mantém cache local, mas a autenticidade pública depende exclusivamente do registro central no Neon.
    try {
      const reg = JSON.parse(localStorage.getItem('finobra_assinaturas_registry') || '[]');
      reg.unshift({
        ...objetoAssinatura,
        criado_em: timestampISO,
        tenant_id: (typeof Auth !== 'undefined' && Auth.getCurrentTenantId) ? Auth.getCurrentTenantId() : '',
        registro_central: false
      });
      if (reg.length > 200) reg.length = 200;
      localStorage.setItem('finobra_assinaturas_registry', JSON.stringify(reg));
    } catch (e) {
      console.warn('Erro ao salvar cache local da assinatura:', e);
    }

    const centralOk = await this._registrarAssinaturaCentral(objetoAssinatura);
    objetoAssinatura.registro_central = centralOk;
    try {
      const reg = JSON.parse(localStorage.getItem('finobra_assinaturas_registry') || '[]');
      const idx = reg.findIndex(x => x.codigo_validacao === objetoAssinatura.codigo_validacao);
      if (idx >= 0) {
        reg[idx].registro_central = centralOk;
        localStorage.setItem('finobra_assinaturas_registry', JSON.stringify(reg));
      }
    } catch {}
    Utils.closeModal();

    if (!centralOk) {
      Utils.toast('Assinatura salva, mas a validação pública ainda não foi registrada na nuvem. Verifique sua conexão.', 'warning');
    }

    if (typeof this._onSalvarCallback === 'function') {
      this._onSalvarCallback(objetoAssinatura);
    }
  },

  _gerarCodigoValidacao() {
    const bytes = new Uint8Array(8);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      return `FIN-SIG-${hex.slice(0, 8)}-${hex.slice(8, 16)}`;
    }
    return `FIN-SIG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,10).toUpperCase()}`;
  },

  async _registrarAssinaturaCentral(sig) {
    try {
      const headers = (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' };
      const res = await fetch('/api/assinaturas', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          codigo_validacao: sig.codigo_validacao,
          hash_sha256: sig.hash_sha256,
          nome: sig.nome,
          doc: sig.doc,
          papel: sig.papel,
          data_hora: sig.data_hora,
          data_hora_fmt: sig.data_hora_fmt,
          ip_dispositivo: sig.ip_dispositivo,
          doc_tipo: sig.doc_tipo || this._metadataDoc?.tipo || 'documento',
          doc_id: sig.doc_id || this._metadataDoc?.id || '',
          doc_numero: sig.doc_numero || this._metadataDoc?.numero || ''
        })
      });
      const data = await res.json().catch(() => ({}));
      return !!(res.ok && data.success);
    } catch (err) {
      console.warn('[Assinatura] Registro central indisponível:', err);
      return false;
    }
  },

  async sincronizarAssinaturasPendentes() {
    if (typeof Auth === 'undefined' || !Auth.getCurrentTenantId) return 0;
    const tenantId = Auth.getCurrentTenantId();
    let reg = [];
    try { reg = JSON.parse(localStorage.getItem('finobra_assinaturas_registry') || '[]'); } catch { return 0; }
    let synced = 0;
    for (const item of reg.filter(x => x.tenant_id === tenantId && x.registro_central !== true).slice(0, 20)) {
      const ok = await this._registrarAssinaturaCentral(item);
      if (ok) {
        item.registro_central = true;
        synced++;
      }
    }
    if (synced) {
      try { localStorage.setItem('finobra_assinaturas_registry', JSON.stringify(reg)); } catch {}
    }
    return synced;
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
    if (!sig?.codigo_validacao) return '';
    const origin = (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null' && window.location.protocol.startsWith('http'))
      ? window.location.origin
      : 'https://finobra.app.br';
    const params = new URLSearchParams();
    params.set('val', sig.codigo_validacao);
    if (sig.hash_sha256) params.set('hash', sig.hash_sha256.substring(0, 16));
    return `${origin}/validar?${params.toString()}`;
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

    const hashCurto = sig.hash_sha256 ? `${sig.hash_sha256.substring(0, 16)}...${sig.hash_sha256.slice(-8)}` : 'N/D';
    const centralRegistered = sig.registro_central === true;
    const registroLabel = centralRegistered ? 'REGISTRADO NO FINOBRA' : 'REGISTRO NA NUVEM PENDENTE';
    const registroBg = centralRegistered ? '#10b981' : '#f59e0b';
    const docTipo = opts.docTipo || (sig.papel?.toLowerCase().includes('contrat') ? 'contrato' : 'recibo');
    const docId = opts.docId || '';
    const urlValidacao = this.gerarUrlValidacao(sig, docTipo, docId);
    const qrUrl = this.gerarQRCodeUrl(urlValidacao, 160);
    const originHost = (typeof window !== 'undefined' && window.location && window.location.host) ? window.location.host : 'finobra.app.br';

    return `
    <div style="margin-top:12px;background:#f8fafc;border:1.5px solid #10b981;border-radius:6px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:14px;text-align:left;color:#0f172a;box-shadow:0 2px 6px rgba(16,185,129,0.12);">
      <!-- Ícone e Selo -->
      <div style="width:38px;height:38px;border-radius:50%;background:#ecfdf5;border:2px solid #10b981;display:flex;align-items:center;justify-content:center;color:#059669;font-size:1.2rem;flex-shrink:0;">
        ✓
      </div>

      <!-- Dados da Auditoria -->
      <div style="flex:1;min-width:0;line-height:1.35;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:.76rem;font-weight:900;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">Registro de Assinatura Eletrônica</span>
          <span style="background:${registroBg};color:#fff;font-size:.62rem;font-weight:800;padding:1px 6px;border-radius:4px;">${registroLabel}</span>
        </div>
        <div style="font-size:.73rem;color:#1e293b;margin-top:2px;">
          <strong>Signatário:</strong> ${Utils.escapeHtml(sig.nome)} ${sig.doc ? `(${Utils.escapeHtml(sig.doc)})` : ''} &bull; <strong>Papel:</strong> ${Utils.escapeHtml(sig.papel || 'Beneficiário')}
        </div>
        <div style="font-size:.67rem;color:#64748b;margin-top:2px;">
          <strong>Data/Hora:</strong> ${Utils.escapeHtml(sig.data_hora_fmt)} &bull; <strong>Dispositivo:</strong> ${Utils.escapeHtml(sig.ip_dispositivo || 'Navegador Web')}
        </div>
        <div style="font-size:.63rem;color:#0284c7;font-family:monospace;margin-top:2px;word-break:break-all;">
          <strong>Hash SHA-256:</strong> ${hashCurto} &bull; <strong>ID:</strong> ${Utils.escapeHtml(sig.codigo_validacao || '')}
        </div>
        <div style="font-size:.64rem;color:#475569;margin-top:4px;">
          Validação do registro: <strong>${originHost}/validar</strong> &bull; Código: <strong style="color:#047857;font-family:monospace;background:#ecfdf5;padding:1px 5px;border-radius:3px;border:1px solid #a7f3d0;">${Utils.escapeHtml(sig.codigo_validacao || '')}</strong>
        </div>
      </div>

      <!-- QR Code de Autenticação -->
      <div style="flex-shrink:0;text-align:center;padding-left:10px;border-left:1px dashed #cbd5e1;">
        <a href="${urlValidacao}" target="_blank" title="Aponte a câmera do celular para consultar o registro no FinObra" style="text-decoration:none;display:block;">
          <img src="${qrUrl}" alt="QR Code de consulta do registro" style="width:68px;height:68px;border-radius:4px;border:1px solid #94a3b8;background:#fff;padding:2px;display:block;margin:0 auto 2px auto;">
          <span style="font-size:.56rem;font-weight:800;color:#047857;display:block;letter-spacing:0.2px;line-height:1.1;">CONSULTAR QR<br>REGISTRO</span>
        </a>
      </div>
    </div>`;
  },

  // ─────────────────────────────────────────────────────────────
  // TELA PÚBLICA DE VERIFICAÇÃO DE AUTENTICIDADE (#validar)
  // ─────────────────────────────────────────────────────────────
  renderTelaValidacaoPublica() {
    // A validação pública oficial vive em validar.html e consulta o Neon.
    // Não confia em nome/documento/hash fornecidos pela URL.
    const params = window.location.search || (window.location.hash.includes('?') ? '?' + window.location.hash.split('?')[1] : '');
    if (!window.location.pathname.endsWith('/validar.html')) {
      window.location.replace('/validar.html' + params);
      return '';
    }
    return '';
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
