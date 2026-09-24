// js/agenda_eventos.js — Agenda Dev & Eventos de Capacitação (FinObra)
// Permite ao time de engenharia/dev anunciar programações, workshops e aulas de capacitação

const AgendaEventos = {
  _tabAtiva: 'proximos',

  _eventosPadrao: [],

  isDevUser() {
    try {
      const u = (typeof Auth !== 'undefined' && Auth.getUser && Auth.getUser()) || {};
      if (u.perfil === 'superadmin') return true;
      if (typeof window !== 'undefined' && window.location && (window.location.pathname.includes('/master') || window.location.pathname.includes('master.html'))) return true;
      if (typeof localStorage !== 'undefined' && localStorage.getItem('finobra_dev_mode') === 'true') return true;
    } catch {}
    return false;
  },

  getEventos() {
    try {
      const raw = localStorage.getItem('finobra_agenda_eventos');
      if (raw) {
        let parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Purga mocks estáticos legados
          parsed = parsed.filter(e => !/^evt_[1-4]$/.test(String(e.id || '')));
          return parsed;
        }
      }
    } catch {}
    return this._eventosPadrao;
  },

  saveEventos(lista) {
    try {
      localStorage.setItem('finobra_agenda_eventos', JSON.stringify(lista));
    } catch {}
  },

  getBadgeCount() {
    const hoje = typeof Utils !== 'undefined' ? Utils.today() : new Date().toISOString().slice(0, 10);
    return this.getEventos().filter(e => !e.gravado && e.data >= hoje).length;
  },

  renderHeaderBtn() {
    const count = this.getBadgeCount();
    return `
      <button type="button" class="icon-btn header-agenda-btn" aria-label="Agenda de Capacitação & Lives" data-fb-click="AgendaEventos.abrirModal" data-fb-click-n="0" title="Agenda Dev: Lives, Workshops e Treinamentos">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        ${count > 0 ? `<span class="agenda-badge">${count}</span>` : ''}
      </button>`;
  },

  abrirModal(tab = 'proximos') {
    const isDev = this.isDevUser();
    if (tab === 'novo' && !isDev) tab = 'proximos';
    this._tabAtiva = tab;
    const bodyHtml = this._renderConteudoTab(tab);

    Utils.showModal(`
      <div class="modal" id="agenda-modal" style="max-width:680px;width:95vw;">
        <div class="modal-header" style="background:linear-gradient(135deg,#06130b,#0f2918);border-radius:var(--r-lg) var(--r-lg) 0 0;padding:18px 20px;">
          <div class="modal-title" style="color:#fff;display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.4rem;">📅</span>
            <div>
              <div style="font-size:1.05rem;font-weight:900;letter-spacing:0.01em;">Agenda Dev &amp; Capacitação Técnica</div>
              <div style="font-size:.74rem;font-weight:400;color:#34d399;">Workshops ao vivo, aulas operacionais e comunicados do desenvolvedor</div>
            </div>
          </div>
          <button type="button" class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0" title="Fechar">✕</button>
        </div>

        <div class="modal-body" style="padding:18px 20px;">
          <div class="agenda-tabs">
            <button type="button" class="agenda-tab-btn ${this._tabAtiva === 'proximos' ? 'active' : ''}"
              data-fb-click="AgendaEventos.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="proximos">
              🔴 Próximas Lives &amp; Aulas
            </button>
            <button type="button" class="agenda-tab-btn ${this._tabAtiva === 'gravados' ? 'active' : ''}"
              data-fb-click="AgendaEventos.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="gravados">
              🎥 Aulas Gravadas
            </button>
            ${isDev ? `
              <button type="button" class="agenda-tab-btn ${this._tabAtiva === 'novo' ? 'active' : ''}"
                data-fb-click="AgendaEventos.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="novo">
                ➕ Agendar Evento
              </button>
            ` : ''}
          </div>

          <div id="agenda-tab-content">
            ${bodyHtml}
          </div>
        </div>

        <div class="modal-footer" style="padding:12px 20px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:.72rem;color:var(--text3);">💡 Aulas ao vivo com tira-dúvidas direto no Google Meet &amp; YouTube</span>
          <button type="button" class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Fechar</button>
        </div>
      </div>`);
  },

  setTab(tab) {
    if (tab === 'novo' && !this.isDevUser()) tab = 'proximos';
    this._tabAtiva = tab;
    const content = document.getElementById('agenda-tab-content');
    if (content) {
      content.innerHTML = this._renderConteudoTab(tab);
    }
    document.querySelectorAll('.agenda-tab-btn').forEach(btn => {
      const isAct = btn.getAttribute('data-fb-click-v0') === tab;
      btn.classList.toggle('active', isAct);
    });
  },

  _renderConteudoTab(tab) {
    const eventos = this.getEventos();
    const hoje = typeof Utils !== 'undefined' ? Utils.today() : new Date().toISOString().slice(0, 10);
    const esc = v => typeof Utils !== 'undefined' ? Utils.escapeHtml(String(v ?? '')) : String(v ?? '');

    if (tab === 'proximos') {
      const proximos = eventos.filter(e => !e.gravado && e.data >= hoje).sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));
      if (!proximos.length) {
        return `
          <div class="empty-state" style="padding:32px 16px;text-align:center;">
            <div style="font-size:2.5rem;margin-bottom:8px;">☕</div>
            <h4 style="font-size:.95rem;font-weight:700;margin-bottom:4px;">Nenhuma transmissão agendada para os próximos dias</h4>
            <p style="font-size:.78rem;color:var(--text3);margin:0;">Novas datas de capacitação técnica serão anunciadas em breve pelo time Dev.</p>
          </div>`;
      }
      return proximos.map(e => this._renderEventCard(e, false)).join('');
    }

    if (tab === 'gravados') {
      const gravados = eventos.filter(e => e.gravado || e.data < hoje).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
      if (!gravados.length) {
        return `
          <div class="empty-state" style="padding:32px 16px;text-align:center;">
            <div style="font-size:2.5rem;margin-bottom:8px;">🎬</div>
            <h4 style="font-size:.95rem;font-weight:700;margin-bottom:4px;">Nenhuma aula gravada cadastrada</h4>
            <p style="font-size:.78rem;color:var(--text3);margin:0;">As gravações de treinamentos anteriores aparecerão aqui.</p>
          </div>`;
      }
      return gravados.map(e => this._renderEventCard(e, true)).join('');
    }

    if (tab === 'novo') {
      return `
        <form id="agenda-novo-form" data-fb-submit="AgendaEventos.salvarNovoEventoSubmit" data-fb-submit-n="1" data-fb-submit-t0="event" style="display:flex;flex-direction:column;gap:12px;">
          <div style="background:rgba(198,255,0,.08);border:1px solid rgba(198,255,0,.25);border-radius:var(--r-md);padding:10px 14px;font-size:.78rem;color:var(--accent2);line-height:1.4;">
            📣 <strong>Painel Dev &amp; Instrutor:</strong> Cadastre uma nova live, aula de workflow ou workshop para os usuários da construtora.
          </div>
          <div>
            <label style="font-size:.75rem;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Título da Programação *</label>
            <input type="text" id="agenda-titulo" class="input" required placeholder="Ex: Masterclass: Gestão de Contratos de Empreitada e Retenções" style="width:100%;font-size:.82rem;">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div>
              <label style="font-size:.75rem;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Data *</label>
              <input type="date" id="agenda-data" class="input" required value="${hoje}" style="width:100%;font-size:.82rem;">
            </div>
            <div>
              <label style="font-size:.75rem;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Horário *</label>
              <input type="time" id="agenda-hora" class="input" required value="19:00" style="width:100%;font-size:.82rem;">
            </div>
            <div>
              <label style="font-size:.75rem;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Duração</label>
              <input type="text" id="agenda-duracao" class="input" value="60 min" style="width:100%;font-size:.82rem;">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label style="font-size:.75rem;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Tipo de Evento</label>
              <select id="agenda-tipo" class="input" style="width:100%;font-size:.82rem;">
                <option value="live">🔴 Live Ao Vivo</option>
                <option value="workshop">🛠️ Workshop Prático</option>
                <option value="update">🚀 Atualização de Versão</option>
              </select>
            </div>
            <div>
              <label style="font-size:.75rem;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Instrutor / Responsável</label>
              <input type="text" id="agenda-instrutor" class="input" value="Dev FinGo" style="width:100%;font-size:.82rem;">
            </div>
          </div>
          <div>
            <label style="font-size:.75rem;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Link da Transmissão (Google Meet, YouTube, Zoom) *</label>
            <input type="url" id="agenda-link" class="input" required placeholder="https://meet.google.com/..." style="width:100%;font-size:.82rem;">
          </div>
          <div>
            <label style="font-size:.75rem;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Resumo dos Tópicos / Ementa</label>
            <textarea id="agenda-desc" class="input" rows="3" placeholder="Descreva os temas que serão abordados nesta aula..." style="width:100%;font-size:.82rem;resize:vertical;"></textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">
            <button type="submit" class="btn btn-primary" style="font-weight:800;padding:8px 18px;">
              💾 Publicar na Agenda
            </button>
          </div>
        </form>`;
    }

    return '';
  },

  _renderEventCard(e, isGravado) {
    const esc = v => typeof Utils !== 'undefined' ? Utils.escapeHtml(String(v ?? '')) : String(v ?? '');
    const dataFmt = typeof Utils !== 'undefined' && Utils.fmt ? Utils.fmt.date(e.data) : e.data;
    const tagClass = e.tipo === 'live' ? 'live' : (e.tipo === 'workshop' ? 'workshop' : 'update');
    const tagLabel = e.tipo === 'live' ? '🔴 Ao Vivo' : (e.tipo === 'workshop' ? '🛠️ Workshop' : '🚀 Release Live');

    return `
      <div class="agenda-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="agenda-tag ${tagClass}">${tagLabel}</span>
            <span class="tabular-nums" style="font-size:.75rem;color:var(--accent);font-weight:700;">📅 ${dataFmt} às ${esc(e.hora)} (${esc(e.duracao)})</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            ${!isGravado ? `
              <button type="button" class="btn btn-secondary btn-sm" style="font-size:.7rem;padding:3px 8px;" title="Adicionar ao Google Calendar"
                data-fb-click="AgendaEventos.adicionarAoGoogleCalendar" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(e.id)}">
                📆 Google Agenda
              </button>
            ` : ''}
            ${this.isDevUser() ? `
              <button type="button" class="btn btn-secondary btn-sm" style="font-size:.7rem;padding:3px 8px;color:#fca5a5;border-color:rgba(239,68,68,.3);" title="Excluir Evento (Dev)"
                data-fb-click="AgendaEventos.excluirEvento" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(e.id)}">
                🗑️ Excluir
              </button>
            ` : ''}
          </div>
        </div>
        <h4 style="font-size:.92rem;font-weight:800;color:var(--text);margin:0 0 6px;">${esc(e.titulo)}</h4>
        <p style="font-size:.78rem;color:var(--text2);margin:0 0 12px;line-height:1.4;">${esc(e.descricao)}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border-s);padding-top:10px;flex-wrap:wrap;gap:8px;">
          <div style="font-size:.72rem;color:var(--text3);">
            👨‍🏫 Instrutor: <strong style="color:var(--text);">${esc(e.instrutor)}</strong>
          </div>
          <a href="${esc(e.link)}" target="_blank" rel="noopener noreferrer" class="btn ${isGravado ? 'btn-secondary' : 'btn-primary'} btn-sm" style="font-size:.75rem;padding:4px 12px;text-decoration:none;display:inline-flex;align-items:center;gap:5px;">
            <span>${isGravado ? '▶ Assistir Gravação' : '🚀 Entrar na Sala'}</span>
            <span>↗</span>
          </a>
        </div>
      </div>`;
  },

  excluirEvento(encodedId) {
    if (!this.isDevUser()) return;
    const id = decodeURIComponent(encodedId || '');
    if (!id) return;
    if (typeof confirm === 'function' && !confirm('Deseja realmente remover esta programação da agenda?')) return;
    const lista = this.getEventos().filter(e => e.id !== id);
    this.saveEventos(lista);
    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast('Programação removida com sucesso.', 'info');
    }
    this.setTab(this._tabAtiva);
  },

  salvarNovoEventoSubmit(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    const titulo = document.getElementById('agenda-titulo')?.value?.trim();
    const data = document.getElementById('agenda-data')?.value;
    const hora = document.getElementById('agenda-hora')?.value;
    const duracao = document.getElementById('agenda-duracao')?.value?.trim() || '60 min';
    const tipo = document.getElementById('agenda-tipo')?.value || 'live';
    const instrutor = document.getElementById('agenda-instrutor')?.value?.trim() || 'Dev FinGo';
    const link = document.getElementById('agenda-link')?.value?.trim();
    const descricao = document.getElementById('agenda-desc')?.value?.trim() || '';

    if (!titulo || !data || !hora || !link) {
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Preencha os campos obrigatórios.', 'warning');
      return false;
    }

    const novo = {
      id: 'evt_' + Date.now(),
      titulo,
      tipo,
      data,
      hora,
      duracao,
      instrutor,
      link,
      gravado: false,
      descricao
    };

    const lista = this.getEventos();
    lista.unshift(novo);
    this.saveEventos(lista);

    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast('Programação adicionada com sucesso à Agenda!', 'success');
    }
    this.setTab('proximos');
    return false;
  },

  adicionarAoGoogleCalendar(encodedId) {
    const id = decodeURIComponent(encodedId || '');
    const evento = this.getEventos().find(e => e.id === id);
    if (!evento) return;

    try {
      const dataStr = (evento.data || '').replace(/-/g, '');
      const horaStr = (evento.hora || '19:00').replace(':', '') + '00';
      const durMin = parseInt(evento.duracao, 10) || 60;
      const startDt = `${dataStr}T${horaStr}`;
      
      // Data fim estimada
      const dt = new Date(`${evento.data}T${evento.hora}:00`);
      dt.setMinutes(dt.getMinutes() + durMin);
      const endYear = dt.getFullYear();
      const endMonth = String(dt.getMonth() + 1).padStart(2, '0');
      const endDay = String(dt.getDate()).padStart(2, '0');
      const endHour = String(dt.getHours()).padStart(2, '0');
      const endMin = String(dt.getMinutes()).padStart(2, '0');
      const endDt = `${endYear}${endMonth}${endDay}T${endHour}${endMin}00`;

      const details = `${evento.descricao}\n\nInstrutor: ${evento.instrutor}\nLink da Sala: ${evento.link}`;
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(evento.titulo)}&dates=${startDt}/${endDt}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(evento.link)}`;

      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Não foi possível gerar link do calendário.', 'warning');
    }
  }
};

window.AgendaEventos = AgendaEventos;
