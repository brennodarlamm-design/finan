// js/suporte.js — Central de Suporte Técnico, Chat Interno, Fila de Espera, Manuais e Tutoriais

const Suporte = {
  WHATSAPP_NUMERO: '5595991363678',
  WHATSAPP_FORMATADO: '(95) 99136-3678',
  // Estado do chat persistido no Neon. Nada sensível fica no localStorage.
  sessao: {
    status: 'fechado',
    conversationId: null,
    conversation: null,
    messages: [],
    pollTimer: null,
    loading: false
  },

  // ── 1. RENDERIZAR BOTÃO E DROPDOWN NO HEADER ────────────────────────────────
  renderHeaderDropdown() {
    return `
      <div class="suporte-dropdown-wrapper" id="suporte-dropdown-wrapper" style="position:relative;display:inline-block;">
        <button class="header-suporte-btn" data-fb-click="Suporte.toggleDropdown" data-fb-click-n="1" data-fb-click-t0="event" title="Suporte Técnico e Treinamentos" style="
          display:flex;align-items:center;gap:6px;background:rgba(201,162,39,.1);border:1px solid rgba(201,162,39,.4);
          color:var(--accent2);border-radius:8px;padding:6px 12px;font-size:.8rem;font-weight:700;cursor:pointer;
          transition:all .2s;font-family:inherit;">
          <span style="font-size:.95rem;">🎧</span>
          <span>Suporte Técnico</span>
          <span style="font-size:.65rem;opacity:.7;margin-left:2px;">▼</span>
        </button>

        <div class="suporte-dropdown-menu" id="suporte-dropdown-menu" style="
          display:none;position:absolute;top:calc(100% + 8px);right:0;width:260px;
          background:#121E0D;border:1px solid rgba(201,162,39,.35);border-radius:12px;
          box-shadow:0 12px 36px rgba(0,0,0,.7);z-index:9999;overflow:hidden;backdrop-filter:blur(10px);">
          
          <div style="padding:12px 14px;background:rgba(201,162,39,.12);border-bottom:1px solid rgba(201,162,39,.2);display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.1rem;color:#f59e0b;">🎧</span>
            <span style="font-weight:800;font-size:.85rem;color:var(--accent2);letter-spacing:.02em;">Suporte Técnico</span>
          </div>

          <div style="padding:6px 0;">
            <a href="#" data-fb-click="Patch26Actions.suporteMenu" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="atendimento" class="suporte-menu-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;color:#f0ead6;text-decoration:none;font-size:.85rem;transition:background .2s;">
              <span style="font-size:1.05rem;color:#38bdf8;">💬</span>
              <span>Chat com FinBot / Atendente</span>
            </a>

            <a href="#" data-fb-click="Patch26Actions.suporteMenu" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="manual" class="suporte-menu-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;color:#f0ead6;text-decoration:none;font-size:.85rem;transition:background .2s;">
              <span style="font-size:1.05rem;color:#a3e635;">📖</span>
              <span>Manual do Sistema</span>
            </a>

            <a href="#" data-fb-click="Patch26Actions.suporteMenu" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="tutoriais" class="suporte-menu-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;color:#f0ead6;text-decoration:none;font-size:.85rem;transition:background .2s;">
              <span style="font-size:1.05rem;color:#f43f5e;">🖥️</span>
              <span>Tutoriais do Sistema</span>
            </a>

            <a href="#" data-fb-click="Patch26Actions.suporteMenu" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="agendamento" class="suporte-menu-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;color:#f0ead6;text-decoration:none;font-size:.85rem;transition:background .2s;">
              <span style="font-size:1.05rem;color:#fbbf24;">📅</span>
              <span>Agenda Treinamentos</span>
            </a>

            <a href="#" data-fb-click="Patch26Actions.suporteMenu" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="contatos" class="suporte-menu-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;color:#f0ead6;text-decoration:none;font-size:.85rem;transition:background .2s;">
              <span style="font-size:1.05rem;color:#34d399;">📞</span>
              <span>Contatos Suporte</span>
            </a>

            <a href="#" data-fb-click="Patch26Actions.suporteMenu" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="treinamentos" class="suporte-menu-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;color:#f0ead6;text-decoration:none;font-size:.85rem;transition:background .2s;">
              <span style="font-size:1.05rem;color:#c084fc;">▶️</span>
              <span>Treinamentos</span>
            </a>
          </div>
        </div>
      </div>
    `;
  },

  toggleDropdown(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('suporte-dropdown-menu');
    if (!menu) return;
    const isVis = menu.style.display === 'block';
    this.fecharDropdown();
    if (!isVis) {
      menu.style.display = 'block';
      setTimeout(() => {
        document.addEventListener('click', Suporte._outsideClickListener);
      }, 50);
    }
  },

  fecharDropdown() {
    const menu = document.getElementById('suporte-dropdown-menu');
    if (menu) menu.style.display = 'none';
    document.removeEventListener('click', Suporte._outsideClickListener);
  },

  _outsideClickListener(e) {
    const wrap = document.getElementById('suporte-dropdown-wrapper');
    if (wrap && !wrap.contains(e.target)) {
      Suporte.fecharDropdown();
    }
  },

  // ── 2. CHAT REAL: FINBOT + ESCALONAMENTO PARA ATENDENTE ────────────────
  _esc(value) {
    if (typeof Utils !== 'undefined' && Utils.escapeHtml) return Utils.escapeHtml(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },

  _fmtTime(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }); }
    catch { return ''; }
  },

  _statusInfo(status) {
    const map = {
      bot: { label:'FinBot online', color:'#38bdf8', icon:'🤖' },
      waiting: { label:'Aguardando atendente', color:'#f59e0b', icon:'⏳' },
      assigned: { label:'Atendente conectado', color:'#22c55e', icon:'👨‍💻' },
      resolved: { label:'Atendimento resolvido', color:'#94a3b8', icon:'✓' },
      closed: { label:'Conversa encerrada', color:'#94a3b8', icon:'✓' }
    };
    return map[status] || map.bot;
  },

  async _apiSupport(action, method='GET', body=null, params={}) {
    const qs = new URLSearchParams({ action: action || 'current', ...params });
    const url = `/api/support?${qs.toString()}`;
    const opts = { method, headers:(typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : {} };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(url, opts);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.success) throw new Error(data.error || 'Não foi possível acessar o suporte agora.');
    return data;
  },

  _ensureChatModal() {
    let modal = document.getElementById('suporte-atendimento-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'suporte-atendimento-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);padding:16px;';
      document.body.appendChild(modal);
    }
    return modal;
  },

  async abrirTelaAtendimento() {
    this.fecharDropdown();
    const u = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    if (u?.isImpersonated || u?.impersonatedBy) {
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('No modo suporte Master, use a Central de Atendimento DEV.', 'info');
      return;
    }
    const modal = this._ensureChatModal();
    modal.innerHTML = `<div style="background:#0f1710;border:1px solid rgba(201,162,39,.35);border-radius:14px;width:min(620px,100%);padding:34px;text-align:center;color:#f0ead6;"><div style="font-size:2rem;margin-bottom:10px;">🤖</div><div style="font-weight:800;color:var(--accent2);">Abrindo atendimento FinObra...</div><div style="font-size:.8rem;color:#94a3b8;margin-top:6px;">Carregando sua conversa com segurança.</div></div>`;
    try {
      this.sessao.loading = true;
      const data = await this._apiSupport('start', 'POST', { action:'start' });
      this._applySupportData(data);
      this.sessao.status = data.conversation?.status || 'bot';
      this.renderTelaChat();
      this._startPolling();
    } catch (err) {
      modal.innerHTML = `<div style="background:#0f1710;border:1px solid rgba(239,68,68,.35);border-radius:14px;width:min(560px,100%);padding:28px;color:#f0ead6;text-align:center;"><div style="font-size:1.7rem;">⚠️</div><div style="font-weight:800;margin:8px 0;">Não foi possível abrir o chat</div><div style="font-size:.82rem;color:#94a3b8;">${this._esc(err?.message || 'Tente novamente em instantes.')}</div><div style="display:flex;justify-content:center;gap:8px;margin-top:18px;"><button data-fb-click="Suporte.abrirTelaAtendimento" data-fb-click-n="0" style="background:var(--accent);border:none;border-radius:8px;padding:9px 14px;font-weight:800;cursor:pointer;">Tentar novamente</button><button data-fb-click="Suporte.desistirAtendimento" data-fb-click-n="0" style="background:transparent;border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:8px;padding:9px 14px;cursor:pointer;">Fechar</button></div></div>`;
    } finally { this.sessao.loading = false; }
  },

  _applySupportData(data) {
    if (!data) return;
    if (data.conversation) {
      this.sessao.conversation = data.conversation;
      this.sessao.conversationId = data.conversation.id;
      this.sessao.status = data.conversation.status || this.sessao.status;
    }
    if (Array.isArray(data.messages)) this.sessao.messages = data.messages;
  },

  renderTelaChat() {
    const modal = this._ensureChatModal();
    const conv = this.sessao.conversation || {};
    const status = conv.status || this.sessao.status || 'bot';
    const st = this._statusInfo(status);
    const u = (typeof Auth !== 'undefined' && Auth.getUser && Auth.getUser()) || {};
    const isHuman = status === 'assigned';
    const waiting = status === 'waiting';
    const closed = status === 'closed' || status === 'resolved';
    const title = isHuman ? 'Suporte' : 'FinBot';
    const safeCompany = this._esc(u.empresaNome || 'sua empresa');

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:680px;height:650px;max-height:92vh;box-shadow:0 24px 60px rgba(0,0,0,.85);display:flex;flex-direction:column;overflow:hidden;font-family:inherit;color:#f0ead6;">
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:14px 18px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:11px;min-width:0;">
            <div style="width:40px;height:40px;border-radius:12px;background:${isHuman ? 'rgba(34,197,94,.18)' : 'rgba(56,189,248,.16)'};display:flex;align-items:center;justify-content:center;font-size:1.25rem;">${isHuman ? '👨‍💻' : '🤖'}</div>
            <div style="min-width:0;"><div style="font-weight:900;color:var(--accent2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._esc(title)}</div><div style="font-size:.72rem;color:${st.color};font-weight:700;">${st.icon} ${st.label} · ${safeCompany}</div></div>
          </div>
          <div style="display:flex;gap:7px;align-items:center;">
            ${!closed ? `<button data-fb-click="Suporte.encerrarChat" data-fb-click-n="0" style="background:none;border:1px solid rgba(255,255,255,.15);color:#94a3b8;padding:5px 9px;border-radius:6px;font-size:.7rem;cursor:pointer;">Encerrar</button>` : ''}
            <button data-fb-click="Suporte.desistirAtendimento" data-fb-click-n="0" style="background:none;border:none;color:#94a3b8;font-size:1.15rem;cursor:pointer;padding:3px 6px;" title="Fechar janela">✕</button>
          </div>
        </div>

        ${waiting ? `<div style="padding:9px 14px;background:rgba(245,158,11,.1);border-bottom:1px solid rgba(245,158,11,.2);color:#fbbf24;font-size:.76rem;text-align:center;">⏳ Seu pedido chegou ao atendimento. Você pode continuar escrevendo enquanto aguarda.</div>` : ''}
        ${isHuman ? `<div style="padding:9px 14px;background:rgba(34,197,94,.08);border-bottom:1px solid rgba(34,197,94,.2);color:#4ade80;font-size:.76rem;text-align:center;">✓ Um atendente humano assumiu esta conversa.</div>` : ''}

        <div id="suporte-chat-msgs" style="flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:11px;background:radial-gradient(ellipse at top,rgba(28,45,18,.3),transparent 70%);">
          ${this.sessao.messages.map(m => this.renderBolhaMensagem(m)).join('')}
        </div>

        ${!closed ? `<div style="padding:10px 14px;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.3);">
          ${status === 'bot' ? `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:9px;">
            <button data-fb-click="Suporte.enviarMensagemRapida" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="Como%20cadastrar%20uma%20obra%3F" style="white-space:nowrap;background:rgba(56,189,248,.09);border:1px solid rgba(56,189,248,.22);color:#bae6fd;border-radius:18px;padding:5px 10px;font-size:.68rem;cursor:pointer;">Obras</button>
            <button data-fb-click="Suporte.enviarMensagemRapida" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="Como%20usar%20NF-e%20e%20OCR%3F" style="white-space:nowrap;background:rgba(56,189,248,.09);border:1px solid rgba(56,189,248,.22);color:#bae6fd;border-radius:18px;padding:5px 10px;font-size:.68rem;cursor:pointer;">NF-e / OCR</button>
            <button data-fb-click="Suporte.enviarMensagemRapida" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="Tenho%20uma%20d%C3%BAvida%20no%20Financeiro" style="white-space:nowrap;background:rgba(56,189,248,.09);border:1px solid rgba(56,189,248,.22);color:#bae6fd;border-radius:18px;padding:5px 10px;font-size:.68rem;cursor:pointer;">Financeiro</button>
            <button data-fb-click="Suporte.chamarAtendente" data-fb-click-n="0" style="white-space:nowrap;background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.35);color:#fbbf24;border-radius:18px;padding:5px 11px;font-size:.68rem;font-weight:800;cursor:pointer;">👨‍💻 Chamar atendente</button>
          </div>` : ''}
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="text" id="suporte-chat-input" maxlength="4000" placeholder="Digite sua dúvida..." style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:10px 13px;color:#fff;font-size:.84rem;outline:none;" data-fb-keydown="Patch26Actions.suporteSendOnEnter" data-fb-keydown-n="1" data-fb-keydown-t0="event">
            <button id="suporte-chat-send" data-fb-click="Suporte.enviarMensagem" data-fb-click-n="0" style="background:var(--accent);border:none;color:#0f1710;font-weight:900;padding:10px 14px;border-radius:8px;cursor:pointer;">Enviar ➤</button>
          </div>
        </div>` : `<div style="padding:14px;text-align:center;border-top:1px solid rgba(255,255,255,.08);"><button data-fb-click="Suporte.novaConversa" data-fb-click-n="0" style="background:var(--accent);border:none;border-radius:8px;padding:9px 16px;font-weight:900;cursor:pointer;">Iniciar novo atendimento</button></div>`}
      </div>`;

    setTimeout(() => { this.scrollChatToBottom(); const input=document.getElementById('suporte-chat-input'); if(input) input.focus(); }, 30);
  },

  renderBolhaMensagem(m) {
    const sender = String(m?.sender_type || '').toLowerCase();
    const isMe = sender === 'client';
    const isSystem = sender === 'system';
    if (isSystem) return `<div style="align-self:center;max-width:90%;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:6px 11px;font-size:.68rem;color:#94a3b8;text-align:center;">${this._esc(m.body || '')}</div>`;
    const isBot = sender === 'bot';
    const initials = isMe ? 'VC' : (isBot ? '🤖' : 'AT');
    const name = isMe ? '' : (isBot ? 'FinBot' : 'Suporte');
    const text = this._esc(m.body || '').replace(/\n/g, '<br>');
    return `<div style="display:flex;gap:9px;align-items:flex-start;max-width:86%;${isMe?'align-self:flex-end;flex-direction:row-reverse;':''}">
      <div style="width:30px;height:30px;border-radius:50%;background:${isMe?'#243818':(isBot?'rgba(56,189,248,.16)':'rgba(34,197,94,.16)')};border:1px solid rgba(201,162,39,.25);display:flex;align-items:center;justify-content:center;font-size:${isBot?'1rem':'.65rem'};font-weight:900;flex-shrink:0;">${initials}</div>
      <div><div style="background:${isMe?'linear-gradient(135deg,#1C2D12,#243818)':'rgba(255,255,255,.06)'};border:1px solid ${isMe?'rgba(201,162,39,.3)':'rgba(255,255,255,.1)'};padding:9px 12px;border-radius:${isMe?'12px 0 12px 12px':'0 12px 12px 12px'};font-size:.83rem;line-height:1.45;color:#f8fafc;">${name?`<div style="font-size:.65rem;font-weight:800;color:${isBot?'#7dd3fc':'#4ade80'};margin-bottom:3px;">${name}</div>`:''}${text}<div style="font-size:.62rem;color:#64748b;margin-top:5px;text-align:right;">${this._esc(this._fmtTime(m.created_at))}</div></div></div>
    </div>`;
  },

  async enviarMensagemRapida(text) {
    const inp = document.getElementById('suporte-chat-input');
    if (inp) inp.value = text;
    return this.enviarMensagem();
  },

  async enviarMensagem() {
    const inp = document.getElementById('suporte-chat-input');
    const btn = document.getElementById('suporte-chat-send');
    const text = String(inp?.value || '').trim();
    if (!text || !this.sessao.conversationId || this.sessao.loading) return;
    if (inp) inp.value = '';
    if (btn) btn.disabled = true;
    this.sessao.loading = true;
    try {
      const data = await this._apiSupport('message', 'POST', { action:'message', conversationId:this.sessao.conversationId, text });
      this._applySupportData(data);
      this.renderTelaChat();
    } catch (err) {
      if (inp) inp.value = text;
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(err?.message || 'Falha ao enviar mensagem.', 'error');
    } finally { this.sessao.loading = false; if(btn) btn.disabled=false; }
  },

  async chamarAtendente() {
    if (!this.sessao.conversationId || this.sessao.loading) return;
    this.sessao.loading = true;
    try {
      const data = await this._apiSupport('escalate', 'POST', { action:'escalate', conversationId:this.sessao.conversationId });
      this._applySupportData(data);
      this.renderTelaChat();
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Atendente solicitado. O DEV foi notificado.', 'success');
    } catch (err) {
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(err?.message || 'Não foi possível chamar o atendente.', 'error');
    } finally { this.sessao.loading = false; }
  },

  async atualizarConversa(silent=true) {
    if (!this.sessao.conversationId || !document.getElementById('suporte-atendimento-modal')) return;
    try {
      const data = await this._apiSupport('current', 'GET', null, { conversationId:this.sessao.conversationId });
      const oldSig = JSON.stringify([this.sessao.conversation?.status, this.sessao.messages.at(-1)?.id, this.sessao.messages.length]);
      this._applySupportData(data);
      const newSig = JSON.stringify([this.sessao.conversation?.status, this.sessao.messages.at(-1)?.id, this.sessao.messages.length]);
      if (oldSig !== newSig) this.renderTelaChat();
    } catch (err) {
      if (!silent && typeof Utils !== 'undefined' && Utils.toast) Utils.toast(err?.message || 'Falha ao atualizar atendimento.', 'error');
    }
  },

  _startPolling() {
    this._stopPolling();
    this.sessao.pollTimer = setInterval(() => this.atualizarConversa(true), 5000);
  },

  _stopPolling() {
    if (this.sessao.pollTimer) clearInterval(this.sessao.pollTimer);
    this.sessao.pollTimer = null;
  },

  scrollChatToBottom() {
    const container = document.getElementById('suporte-chat-msgs');
    if (container) container.scrollTop = container.scrollHeight;
  },

  getHistoricoChat() {
    // Compatibilidade: histórico atual em memória, cuja fonte é o Neon.
    return (this.sessao.messages || []).map(m => ({ id:m.id, origem:m.sender_type === 'client' ? 'cliente' : 'suporte', texto:m.body, data:m.created_at, hora:this._fmtTime(m.created_at) }));
  },

  async encerrarChat() {
    if (!this.sessao.conversationId) return this.desistirAtendimento();
    if (!confirm('Deseja encerrar esta conversa? Você poderá iniciar um novo atendimento depois.')) return;
    try { await this._apiSupport('close', 'POST', { action:'close', conversationId:this.sessao.conversationId }); }
    catch (err) { if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(err?.message || 'Falha ao encerrar.', 'error'); return; }
    this._stopPolling();
    this.sessao.status='closed';
    this.sessao.conversation = { ...(this.sessao.conversation || {}), status:'closed' };
    this.renderTelaChat();
  },

  async novaConversa() {
    this.sessao.conversationId=null;
    this.sessao.conversation=null;
    this.sessao.messages=[];
    return this.abrirTelaAtendimento();
  },

  desistirAtendimento() {
    this._stopPolling();
    const modal = document.getElementById('suporte-atendimento-modal');
    if (modal) modal.remove();
  },

  getLinkWhatsApp(msg) {
    const texto = encodeURIComponent(msg || 'Olá! Preciso de suporte no FinObra.');
    return `https://wa.me/${this.WHATSAPP_NUMERO}?text=${texto}`;
  },

  // ── 4. MODAL: MANUAL DO SISTEMA ───────────────────────────────────────────
  abrirManual() {
    this.fecharDropdown();
    let modal = document.getElementById('suporte-manual-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'suporte-manual-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);padding:16px;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:760px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.8);overflow:hidden;color:#f0ead6;font-family:inherit;">
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">📖</span>
            <div>
              <div style="font-weight:800;font-size:1rem;color:var(--accent2);">Manual do Usuário — FinObra</div>
              <div style="font-size:.75rem;color:#94a3b8;">Guia rápido de operações e funcionalidades</div>
            </div>
          </div>
          <button data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="suporte-manual-modal" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <div style="flex:1;overflow-y:auto;padding:22px;display:flex;flex-direction:column;gap:16px;">
          
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
            <h4 style="color:var(--accent2);margin-bottom:6px;display:flex;align-items:center;gap:6px;">🏗️ 1. Obras & Clientes</h4>
            <p style="font-size:.85rem;color:#cbd5e1;line-height:1.5;">
              Cadastre suas obras (Caixa ou Particulares), definindo o cliente, tipo de contrato, valor global orçado e cronograma. Ao selecionar uma obra no topo do sistema, todos os lançamentos e relatórios são filtrados automaticamente.
            </p>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
            <h4 style="color:var(--accent2);margin-bottom:6px;display:flex;align-items:center;gap:6px;">📄 2. Notas Fiscais & Leitura OCR</h4>
            <p style="font-size:.85rem;color:#cbd5e1;line-height:1.5;">
              Envie fotos ou PDFs de Notas Fiscais (NF-e/NFS-e). O sistema lê automaticamente a chave de acesso, fornecedor, valores e insumos discriminados, cadastrando as despesas da obra sem digitação manual.
            </p>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
            <h4 style="color:var(--accent2);margin-bottom:6px;display:flex;align-items:center;gap:6px;">🔨 3. Medições & Faturamento</h4>
            <p style="font-size:.85rem;color:#cbd5e1;line-height:1.5;">
              Lance medições de campo com percentuais acumulados das etapas executadas. Emita boletins de medição prontos para envio ao engenheiro fiscal da Caixa Econômica ou proprietário.
            </p>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
            <h4 style="color:var(--accent2);margin-bottom:6px;display:flex;align-items:center;gap:6px;">🔄 4. Conciliação Bancária OFX</h4>
            <p style="font-size:.85rem;color:#cbd5e1;line-height:1.5;">
              Importe o extrato em formato OFX da conta da construtora para conciliar e bater cada PIX, débito ou transferência com os lançamentos das obras.
            </p>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
            <h4 style="color:var(--accent2);margin-bottom:6px;display:flex;align-items:center;gap:6px;">🛡️ 5. Assinatura Eletrônica & Validação Pública</h4>
            <p style="font-size:.85rem;color:#cbd5e1;line-height:1.5;">
              Recibos e contratos gerados pelo FinObra recebem hash criptográfico SHA-256 e QR Code. Qualquer cliente ou fiscal pode validar a autenticidade online pelo portal público <strong style="color:var(--accent2);">finobra.app.br/validar</strong>.
            </p>
          </div>

        </div>

        <div style="padding:14px 20px;background:rgba(0,0,0,.3);border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:flex-end;">
          <button data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="suporte-manual-modal" style="background:var(--accent);border:none;color:#0f1710;padding:8px 20px;border-radius:8px;font-weight:800;cursor:pointer;">Entendido</button>
        </div>
      </div>
    `;
  },

  // ── 5. MODAL: TUTORIAIS DO SISTEMA ────────────────────────────────────────
  abrirTutoriais() {
    this.fecharDropdown();
    let modal = document.getElementById('suporte-tutoriais-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'suporte-tutoriais-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);padding:16px;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:700px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.8);overflow:hidden;color:#f0ead6;font-family:inherit;">
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;color:#f43f5e;">🖥️</span>
            <div>
              <div style="font-weight:800;font-size:1rem;color:var(--accent2);">Tutoriais em Vídeo & Guias</div>
              <div style="font-size:.75rem;color:#94a3b8;">Vídeos passo a passo para dominar a gestão de obras</div>
            </div>
          </div>
          <button data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="suporte-tutoriais-modal" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <div style="flex:1;overflow-y:auto;padding:22px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-size:.75rem;color:#38bdf8;font-weight:700;">VÍDEO 1 • 4 MIN</div>
              <div style="font-weight:800;font-size:.9rem;color:#fff;margin:4px 0;">Como Iniciar uma Obra e Cadastrar Etapas</div>
              <div style="font-size:.78rem;color:#94a3b8;">Aprenda a estruturar o contrato e prever os custos.</div>
            </div>
            <button data-fb-click="Patch26Actions.tutorialAlert" data-fb-click-n="0" style="margin-top:12px;background:rgba(201,162,39,.15);border:1px solid var(--accent);color:var(--accent2);padding:6px 12px;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer;">
              Assistir Aula ▶
            </button>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-size:.75rem;color:#38bdf8;font-weight:700;">VÍDEO 2 • 3 MIN</div>
              <div style="font-weight:800;font-size:.9rem;color:#fff;margin:4px 0;">Importação Automática de NF-e e OCR</div>
              <div style="font-size:.78rem;color:#94a3b8;">Como escanear notas fiscais de materiais sem erro.</div>
            </div>
            <button data-fb-click="Patch26Actions.tutorialAlert" data-fb-click-n="0" style="margin-top:12px;background:rgba(201,162,39,.15);border:1px solid var(--accent);color:var(--accent2);padding:6px 12px;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer;">
              Assistir Aula ▶
            </button>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-size:.75rem;color:#38bdf8;font-weight:700;">VÍDEO 3 • 5 MIN</div>
              <div style="font-weight:800;font-size:.9rem;color:#fff;margin:4px 0;">Boletim de Medição Caixa Econômica</div>
              <div style="font-size:.78rem;color:#94a3b8;">Passo a passo para gerar o espelho de medição de engenharia.</div>
            </div>
            <button data-fb-click="Patch26Actions.tutorialAlert" data-fb-click-n="0" style="margin-top:12px;background:rgba(201,162,39,.15);border:1px solid var(--accent);color:var(--accent2);padding:6px 12px;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer;">
              Assistir Aula ▶
            </button>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-size:.75rem;color:#38bdf8;font-weight:700;">VÍDEO 4 • 4 MIN</div>
              <div style="font-weight:800;font-size:.9rem;color:#fff;margin:4px 0;">Conciliação OFX e Fechamento Mensal</div>
              <div style="font-size:.78rem;color:#94a3b8;">DRE, fluxo de caixa e batimento com a conta bancária.</div>
            </div>
            <button data-fb-click="Patch26Actions.tutorialAlert" data-fb-click-n="0" style="margin-top:12px;background:rgba(201,162,39,.15);border:1px solid var(--accent);color:var(--accent2);padding:6px 12px;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer;">
              Assistir Aula ▶
            </button>
          </div>

        </div>

        <div style="padding:14px 20px;background:rgba(0,0,0,.3);border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:.8rem;color:#94a3b8;">Canal Oficial FinObra no YouTube</span>
          <button data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="suporte-tutoriais-modal" style="background:var(--accent);border:none;color:#0f1710;padding:8px 20px;border-radius:8px;font-weight:800;cursor:pointer;">Fechar</button>
        </div>
      </div>
    `;
  },

  // ── 6. MODAL: AGENDA DE TREINAMENTOS ──────────────────────────────────────
  abrirAgendamento() {
    this.fecharDropdown();
    let modal = document.getElementById('suporte-agendamento-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'suporte-agendamento-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);padding:16px;';
      document.body.appendChild(modal);
    }

    const u = (typeof Auth !== 'undefined' && Auth.getUser()) || {};

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:540px;box-shadow:0 24px 60px rgba(0,0,0,.8);overflow:hidden;color:#f0ead6;font-family:inherit;">
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;color:#fbbf24;">📅</span>
            <div>
              <div style="font-weight:800;font-size:1rem;color:var(--accent2);">Agendar Treinamento com Especialista</div>
              <div style="font-size:.75rem;color:#94a3b8;">Sessão ao vivo de implantação para sua equipe</div>
            </div>
          </div>
          <button data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="suporte-agendamento-modal" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <div style="padding:22px;display:flex;flex-direction:column;gap:16px;">
          <p style="font-size:.85rem;color:#cbd5e1;line-height:1.5;">
            Treine sua equipe de engenharia, compras e financeiro para extrair o máximo do FinObra. O treinamento inclui configuração inicial de obras, medições Caixa e fluxo de caixa.
          </p>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
            <div style="font-size:.8rem;color:#94a3b8;margin-bottom:6px;">Duração da sessão:</div>
            <div style="font-weight:800;font-size:1rem;color:#fff;">45 a 60 minutos (Google Meet / Ao Vivo)</div>
          </div>

          <a href="${this.getLinkWhatsApp(`Olá! Gostaria de agendar um treinamento do FinObra para a equipe da minha empresa (${u.empresaNome || u.nome || 'minha construtora'}).`)}" target="_blank" style="background:#22c55e;border:none;color:#fff;padding:14px;border-radius:10px;font-weight:800;font-size:.9rem;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(34,197,94,.3);">
            <span>📅 Agendar pelo WhatsApp: (95) 99136-3678</span>
          </a>
        </div>
      </div>
    `;
  },

  // ── 7. MODAL: CONTATOS OFICIAIS DO SUPORTE ────────────────────────────────
  abrirContatos() {
    this.fecharDropdown();
    let modal = document.getElementById('suporte-contatos-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'suporte-contatos-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);padding:16px;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:520px;box-shadow:0 24px 60px rgba(0,0,0,.8);overflow:hidden;color:#f0ead6;font-family:inherit;">
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;color:#34d399;">📞</span>
            <div>
              <div style="font-weight:800;font-size:1rem;color:var(--accent2);">Canais de Suporte & Atendimento</div>
              <div style="font-size:.75rem;color:#94a3b8;">Estamos prontos para atender sua construtora</div>
            </div>
          </div>
          <button data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="suporte-contatos-modal" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <div style="padding:22px;display:flex;flex-direction:column;gap:14px;">
          
          <div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.03);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,.08);">
            <span style="font-size:1.5rem;color:#22c55e;">💬</span>
            <div style="flex:1;">
              <div style="font-size:.75rem;color:#94a3b8;">WhatsApp Suporte Técnico</div>
              <div style="font-weight:800;font-size:.95rem;color:#fff;">(95) 99136-3678</div>
            </div>
            <a href="${this.getLinkWhatsApp()}" target="_blank" style="background:#22c55e;color:#fff;padding:6px 12px;border-radius:6px;font-size:.75rem;font-weight:700;text-decoration:none;">Chamar ↗</a>
          </div>

          <div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.03);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,.08);">
            <span style="font-size:1.5rem;color:#38bdf8;">✉️</span>
            <div style="flex:1;">
              <div style="font-size:.75rem;color:#94a3b8;">E-mail do Suporte</div>
              <div style="font-weight:800;font-size:.95rem;color:#fff;">suporte@finobra.app.br</div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.03);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,.08);">
            <span style="font-size:1.5rem;color:#fbbf24;">🕒</span>
            <div style="flex:1;">
              <div style="font-size:.75rem;color:#94a3b8;">Horário de Atendimento</div>
              <div style="font-weight:800;font-size:.95rem;color:#fff;">Segunda a Sexta: 08:00 às 18:00 (Plantão aos Sábados)</div>
            </div>
          </div>

        </div>
      </div>
    `;
  },

  // ── 8. MODAL: TRILHA DE TREINAMENTOS ──────────────────────────────────────
  abrirTreinamentos() {
    this.abrirTutoriais();
  }
};
