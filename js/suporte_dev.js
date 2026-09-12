// js/suporte_dev.js — Central de Atendimento exclusiva do DEV / Super Admin
// Conversas persistidas no Neon. Não compartilha a interface de chat do cliente.

const SuporteDev = {
  _active: [],
  _list: [],
  _summary: { waiting:0, assigned:0, bot:0, resolved_today:0 },
  _filter: 'active',
  _currentId: null,
  _current: null,
  _messages: [],
  _poll: null,
  _chatPoll: null,
  _notifiedWaiting: new Set(),
  _started: false,
  _loading: false,

  _esc(value) {
    if (typeof Utils !== 'undefined' && Utils.escapeHtml) return Utils.escapeHtml(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },

  _headers() {
    return (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : { 'Content-Type':'application/json' };
  },

  async _api(action, method='GET', body=null, params={}) {
    const q = new URLSearchParams({ action, ...params });
    const opts = { method, headers:this._headers() };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(`/api/admin?${q.toString()}`, opts);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.success) throw new Error(data.error || 'Falha na Central de Atendimento.');
    return data;
  },

  _isAuthorized() {
    const u = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    return !!u && u.perfil === 'superadmin' && !u.isImpersonated && !u.impersonatedBy;
  },

  async initNotifications() {
    if (this._started || !this._isAuthorized()) return;
    this._started = true;
    await this.refreshNotifications(true);
    this._poll = setInterval(() => this.refreshNotifications(true), 12000);
  },

  stopNotifications() {
    if (this._poll) clearInterval(this._poll);
    if (this._chatPoll) clearInterval(this._chatPoll);
    this._poll = null;
    this._chatPoll = null;
    this._started = false;
  },

  async refreshNotifications(silent=true) {
    if (!this._isAuthorized()) return;
    try {
      const data = await this._api('support_list', 'GET', null, { status:'active' });
      const previousWaiting = new Set((this._active || []).filter(c => c.status === 'waiting').map(c => c.id));
      this._active = Array.isArray(data.conversations) ? data.conversations : [];
      this._summary = { ...this._summary, ...(data.summary || {}) };
      this._updateSummaryDom();

      for (const conv of this._active.filter(c => c.status === 'waiting')) {
        if (!previousWaiting.has(conv.id) && !this._notifiedWaiting.has(conv.id)) {
          this._notifiedWaiting.add(conv.id);
          this._showPopup(conv);
        }
      }

      if (this._filter === 'active' && document.getElementById('suporte-dev-modal')) {
        this._list = this._active;
        this._renderList();
      }
    } catch (err) {
      if (!silent) alert(err?.message || 'Não foi possível atualizar os atendimentos.');
    }
  },

  _updateSummaryDom() {
    const set = (id, value) => { const el=document.getElementById(id); if(el) el.textContent=String(value ?? 0); };
    set('master-support-waiting-count', this._summary.waiting || 0);
    set('master-support-assigned-count', this._summary.assigned || 0);
    set('master-support-bot-count', this._summary.bot || 0);
    set('master-support-resolved-count', this._summary.resolved_today || 0);
    const badge = document.getElementById('master-support-top-badge');
    if (badge) {
      const n = Number(this._summary.waiting || 0);
      badge.textContent = n ? String(n) : '';
      badge.style.display = n ? 'inline-flex' : 'none';
    }
  },

  _showPopup(conv) {
    let wrap = document.getElementById('suporte-dev-popup-stack');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'suporte-dev-popup-stack';
      wrap.style.cssText = 'position:fixed;right:18px;top:82px;z-index:100000;display:flex;flex-direction:column;gap:10px;width:min(380px,calc(100vw - 36px));pointer-events:none;';
      document.body.appendChild(wrap);
    }
    const card = document.createElement('div');
    card.style.cssText = 'pointer-events:auto;background:#101a0e;border:1px solid rgba(245,158,11,.55);box-shadow:0 16px 44px rgba(0,0,0,.6);border-radius:12px;padding:14px;color:#fff;animation:fadeIn .2s ease-out;';
    const tenant = this._esc(conv.tenant_nome || 'Cliente');
    const user = this._esc(conv.usuario_nome || 'Usuário');
    const msg = this._esc(conv.ultima_mensagem || 'Solicitou atendimento humano.');
    card.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;"><div><div style="font-size:.68rem;color:#fbbf24;font-weight:900;text-transform:uppercase;letter-spacing:.07em;">🔔 Cliente aguardando atendimento</div><div style="font-weight:900;margin-top:4px;">${tenant}</div><div style="font-size:.75rem;color:#94a3b8;">${user}</div></div><button type="button" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1rem;align-self:flex-start;">✕</button></div><div style="font-size:.78rem;color:#dbeafe;margin:10px 0;line-height:1.4;">${msg}</div><button type="button" style="width:100%;background:#f59e0b;border:none;color:#111827;border-radius:8px;padding:8px 10px;font-weight:900;cursor:pointer;">Abrir atendimento</button>`;
    const [closeBtn, openBtn] = card.querySelectorAll('button');
    closeBtn.onclick = () => card.remove();
    openBtn.onclick = async () => { card.remove(); await this.abrirCentral(); await this.abrirConversa(conv.id); };
    wrap.appendChild(card);
    setTimeout(() => card.remove(), 25000);
  },

  renderResumoCard() {
    return `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div><h3 style="font-size:1.05rem;font-weight:900;color:#fff;margin:0;">💬 Central de Atendimento DEV <span id="master-support-top-badge" style="display:none;margin-left:5px;background:#ef4444;color:#fff;border-radius:999px;min-width:20px;height:20px;align-items:center;justify-content:center;font-size:.68rem;"></span></h3><div style="font-size:.75rem;color:#94a3b8;margin-top:3px;">Fila real de clientes, FinBot e atendimento humano — sem entrar na tela do cliente.</div></div>
        <button onclick="SuporteDev.abrirCentral()" style="background:rgba(56,189,248,.14);border:1px solid rgba(56,189,248,.35);color:#7dd3fc;border-radius:8px;padding:8px 13px;font-size:.76rem;font-weight:900;cursor:pointer;">Abrir Central de Atendimento ↗</button>
      </div>
      <div style="padding:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;">
        ${this._metric('⏳','Aguardando','master-support-waiting-count','#f59e0b')}
        ${this._metric('👨‍💻','Em atendimento','master-support-assigned-count','#22c55e')}
        ${this._metric('🤖','No FinBot','master-support-bot-count','#38bdf8')}
        ${this._metric('✓','Resolvidos hoje','master-support-resolved-count','#a3e635')}
      </div>
    </div>`;
  },

  _metric(icon, label, id, color) {
    return `<div style="background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:12px;"><div style="font-size:.72rem;color:#94a3b8;">${icon} ${label}</div><div id="${id}" style="font-size:1.45rem;font-weight:950;color:${color};margin-top:3px;">0</div></div>`;
  },

  async abrirCentral() {
    if (!this._isAuthorized()) return alert('A Central DEV é exclusiva do Super Administrador.');
    let modal = document.getElementById('suporte-dev-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'suporte-dev-modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:99999;display:flex;padding:14px;backdrop-filter:blur(4px);';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `<div style="width:100%;max-width:1240px;height:min(860px,96vh);margin:auto;background:#0c140b;border:1px solid rgba(201,162,39,.3);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;color:#f0ead6;box-shadow:0 28px 80px rgba(0,0,0,.8);">
      <div style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08);background:linear-gradient(135deg,#182811,#203516);display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div><div style="font-weight:950;color:var(--accent2);">💬 Central de Atendimento DEV</div><div style="font-size:.7rem;color:#94a3b8;">Você atende os clientes daqui. Esta não é a tela de chat do cliente.</div></div>
        <button onclick="SuporteDev.fecharCentral()" style="background:none;border:1px solid rgba(255,255,255,.14);color:#cbd5e1;border-radius:7px;padding:6px 10px;cursor:pointer;">Fechar ✕</button>
      </div>
      <div style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;gap:6px;overflow-x:auto;">
        ${this._filterButton('active','Ativos')}${this._filterButton('waiting','⏳ Aguardando')}${this._filterButton('assigned','👨‍💻 Em atendimento')}${this._filterButton('bot','🤖 FinBot')}${this._filterButton('resolved','✓ Resolvidos')}
      </div>
      <div style="display:grid;grid-template-columns:minmax(280px,360px) 1fr;min-height:0;flex:1;">
        <div style="border-right:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;min-height:0;"><div id="suporte-dev-list" style="overflow:auto;flex:1;"></div></div>
        <div id="suporte-dev-chat" style="min-width:0;display:flex;flex-direction:column;min-height:0;"><div style="margin:auto;text-align:center;color:#64748b;padding:30px;"><div style="font-size:2.4rem;">🎧</div><div style="font-weight:800;color:#94a3b8;margin-top:8px;">Selecione um atendimento</div><div style="font-size:.75rem;margin-top:4px;">As conversas dos clientes aparecem na coluna ao lado.</div></div></div>
      </div>
    </div>`;
    await this.carregarLista(this._filter, false);
    this._startChatPolling();
  },

  _filterButton(value, label) {
    const active = this._filter === value;
    return `<button onclick="SuporteDev.setFilter('${value}')" style="background:${active?'rgba(201,162,39,.16)':'rgba(255,255,255,.025)'};border:1px solid ${active?'rgba(201,162,39,.45)':'rgba(255,255,255,.08)'};color:${active?'var(--accent2)':'#94a3b8'};border-radius:7px;padding:6px 10px;font-size:.7rem;font-weight:800;cursor:pointer;white-space:nowrap;">${label}</button>`;
  },

  async setFilter(filter) {
    this._filter = filter;
    this._currentId = null;
    this._current = null;
    this._messages = [];
    await this.abrirCentral();
  },

  async carregarLista(filter=this._filter, silent=true) {
    if (this._loading) return;
    this._loading = true;
    try {
      const data = await this._api('support_list','GET',null,{ status:filter });
      this._list = Array.isArray(data.conversations) ? data.conversations : [];
      this._summary = { ...this._summary, ...(data.summary || {}) };
      this._updateSummaryDom();
      this._renderList();
    } catch (err) {
      if (!silent) alert(err?.message || 'Falha ao carregar atendimentos.');
    } finally { this._loading=false; }
  },

  _statusBadge(status) {
    const map = { waiting:['Aguardando','#f59e0b'], assigned:['Em atendimento','#22c55e'], bot:['FinBot','#38bdf8'], resolved:['Resolvido','#a3e635'], closed:['Encerrado','#94a3b8'] };
    const [label,color] = map[status] || [status || '—','#94a3b8'];
    return `<span style="font-size:.6rem;font-weight:900;color:${color};border:1px solid ${color}55;background:${color}12;border-radius:999px;padding:2px 7px;">${this._esc(label)}</span>`;
  },

  _renderList() {
    const el = document.getElementById('suporte-dev-list');
    if (!el) return;
    if (!this._list.length) {
      el.innerHTML = `<div style="padding:36px 20px;text-align:center;color:#64748b;"><div style="font-size:1.8rem;">🎧</div><div style="font-size:.78rem;margin-top:7px;">Nenhum atendimento nesta fila.</div></div>`;
      return;
    }
    el.innerHTML = this._list.map(c => {
      const selected = c.id === this._currentId;
      const time = c.ultima_mensagem_em || c.last_message_at || c.updated_at;
      return `<button data-id="${this._esc(c.id)}" onclick="SuporteDev.abrirConversa(this.dataset.id)" style="width:100%;display:block;text-align:left;background:${selected?'rgba(201,162,39,.08)':'transparent'};border:none;border-bottom:1px solid rgba(255,255,255,.055);border-left:3px solid ${selected?'var(--accent)':'transparent'};padding:12px 13px;color:#fff;cursor:pointer;font-family:inherit;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;"><div style="font-weight:900;font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._esc(c.tenant_nome || c.tenant_id)}</div>${this._statusBadge(c.status)}</div>
        <div style="font-size:.68rem;color:#94a3b8;margin-top:3px;">${this._esc(c.usuario_nome || 'Usuário')} · ${this._esc(this._fmtDate(time))}</div>
        <div style="font-size:.72rem;color:#cbd5e1;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._esc(c.ultima_mensagem || 'Sem mensagem')}</div>
      </button>`;
    }).join('');
  },

  _fmtDate(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }
    catch { return '—'; }
  },

  async abrirConversa(id) {
    if (!id) return;
    try {
      const data = await this._api('support_messages','GET',null,{ conversationId:id });
      this._currentId = id;
      this._current = data.conversation || null;
      this._messages = Array.isArray(data.messages) ? data.messages : [];
      this._renderList();
      this._renderConversation();
    } catch (err) { alert(err?.message || 'Falha ao abrir conversa.'); }
  },

  _renderConversation() {
    const el = document.getElementById('suporte-dev-chat');
    if (!el || !this._current) return;
    const c = this._current;
    const resolved = c.status === 'resolved' || c.status === 'closed';
    el.innerHTML = `<div style="padding:12px 15px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
      <div><div style="font-weight:950;color:#fff;">${this._esc(c.tenant_nome || c.tenant_id)}</div><div style="font-size:.7rem;color:#94a3b8;">${this._esc(c.usuario_nome || 'Usuário')} ${c.usuario_email?`· ${this._esc(c.usuario_email)}`:''} · ${this._statusBadge(c.status)}</div></div>
      <div style="display:flex;gap:6px;">${!resolved && c.status !== 'assigned' ? `<button onclick="SuporteDev.assumir()" style="background:#22c55e;border:none;color:#fff;border-radius:7px;padding:7px 10px;font-size:.7rem;font-weight:900;cursor:pointer;">👨‍💻 Assumir</button>`:''}${!resolved?`<button onclick="SuporteDev.resolver()" style="background:rgba(163,230,53,.1);border:1px solid rgba(163,230,53,.35);color:#bef264;border-radius:7px;padding:7px 10px;font-size:.7rem;font-weight:900;cursor:pointer;">✓ Resolver</button>`:''}</div>
    </div>
    <div id="suporte-dev-msgs" style="flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px;min-height:0;">${this._messages.map(m=>this._renderMessage(m)).join('')}</div>
    ${!resolved?`<div style="border-top:1px solid rgba(255,255,255,.07);padding:11px 13px;display:flex;gap:8px;"><textarea id="suporte-dev-input" rows="2" maxlength="4000" placeholder="Responder como atendente..." style="flex:1;resize:none;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.13);border-radius:8px;color:#fff;padding:9px 11px;font-family:inherit;font-size:.78rem;outline:none;"></textarea><button onclick="SuporteDev.enviar()" style="background:var(--accent);border:none;border-radius:8px;padding:8px 14px;font-weight:950;color:#111827;cursor:pointer;">Enviar ➤</button></div>`:''}`;
    setTimeout(()=>{ const m=document.getElementById('suporte-dev-msgs'); if(m)m.scrollTop=m.scrollHeight; },20);
  },

  _renderMessage(m) {
    const t = String(m.sender_type || 'system');
    if (t === 'system') return `<div style="align-self:center;max-width:90%;padding:5px 10px;border-radius:12px;background:rgba(255,255,255,.045);color:#94a3b8;font-size:.65rem;text-align:center;">${this._esc(m.body || '')}</div>`;
    const isClient = t === 'client';
    const isBot = t === 'bot';
    const body = this._esc(m.body || '').replace(/\n/g,'<br>');
    const name = this._esc(m.sender_name || (isClient?'Cliente':isBot?'FinBot':'Atendente'));
    return `<div style="max-width:82%;${isClient?'align-self:flex-start;':'align-self:flex-end;'}"><div style="font-size:.62rem;color:${isClient?'#7dd3fc':isBot?'#a78bfa':'#4ade80'};font-weight:900;margin:0 5px 3px;">${name}</div><div style="background:${isClient?'rgba(56,189,248,.09)':isBot?'rgba(167,139,250,.08)':'rgba(34,197,94,.09)'};border:1px solid rgba(255,255,255,.09);border-radius:${isClient?'3px 11px 11px 11px':'11px 3px 11px 11px'};padding:9px 11px;font-size:.78rem;line-height:1.45;color:#e2e8f0;">${body}<div style="font-size:.58rem;color:#64748b;margin-top:4px;text-align:right;">${this._esc(this._fmtDate(m.created_at))}</div></div></div>`;
  },

  async assumir() {
    if (!this._currentId) return;
    try { await this._api('support_assign','POST',{ conversationId:this._currentId }); await this.abrirConversa(this._currentId); await this.refreshNotifications(true); }
    catch (err) { alert(err?.message || 'Falha ao assumir atendimento.'); }
  },

  async enviar() {
    const input=document.getElementById('suporte-dev-input');
    const text=String(input?.value || '').trim();
    if (!text || !this._currentId) return;
    if (input) input.value='';
    try { await this._api('support_reply','POST',{ conversationId:this._currentId, text }); await this.abrirConversa(this._currentId); await this.refreshNotifications(true); }
    catch (err) { if(input) input.value=text; alert(err?.message || 'Falha ao enviar resposta.'); }
  },

  async resolver() {
    if (!this._currentId || !confirm('Marcar este atendimento como resolvido?')) return;
    try { await this._api('support_resolve','POST',{ conversationId:this._currentId }); await this.refreshNotifications(true); await this.carregarLista(this._filter,false); this._current.status='resolved'; this._renderConversation(); }
    catch (err) { alert(err?.message || 'Falha ao resolver atendimento.'); }
  },

  _startChatPolling() {
    if (this._chatPoll) clearInterval(this._chatPoll);
    this._chatPoll = setInterval(async () => {
      if (!document.getElementById('suporte-dev-modal')) return;
      await this.carregarLista(this._filter,true);
      if (this._currentId) {
        try {
          const data=await this._api('support_messages','GET',null,{conversationId:this._currentId});
          const sigOld=JSON.stringify([this._current?.status,this._messages.at(-1)?.id,this._messages.length]);
          const sigNew=JSON.stringify([data.conversation?.status,data.messages?.at(-1)?.id,data.messages?.length]);
          if(sigOld!==sigNew){this._current=data.conversation;this._messages=data.messages||[];this._renderConversation();}
        } catch {}
      }
    }, 5000);
  },

  fecharCentral() {
    const modal=document.getElementById('suporte-dev-modal');
    if(modal)modal.remove();
    if(this._chatPoll)clearInterval(this._chatPoll);
    this._chatPoll=null;
    this._currentId=null;
    this._current=null;
    this._messages=[];
  }
};

if (typeof window !== 'undefined') {
  window.SuporteDev = SuporteDev;
  window.addEventListener('DOMContentLoaded', () => setTimeout(() => SuporteDev.initNotifications(), 600));
}
