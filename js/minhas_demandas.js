// js/minhas_demandas.js — Dashboard "Minhas Demandas" (FinGo Brand System)
// Visual Brutalist Tech Neon-Industrial com Paleta Oficial de Status FinGo

const MinhasDemandas = {
  _modo: 'lista',

  getModoVisualizacao() {
    return this._modo || 'lista';
  },

  setModoVisualizacao(modo) {
    this._modo = modo;
    const container = document.getElementById('route-content');
    if (container) {
      container.innerHTML = this.render();
      return;
    }
    if (typeof App !== 'undefined' && typeof App.navigate === 'function') {
      App.navigate('minhas-demandas', false);
    }
  },

  _esc(v) {
    if (typeof Utils !== 'undefined' && Utils.escapeHtml) return Utils.escapeHtml(String(v ?? ''));
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },

  render() {
    const u = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    if (!u) return '<div class="empty-state"><h3>Usuário não autenticado</h3></div>';

    const demandas = typeof CronogramaSLA !== 'undefined'
      ? CronogramaSLA.getDemandas(u.id)
      : [];

    const hoje = typeof Utils !== 'undefined' ? Utils.today() : new Date().toISOString().slice(0, 10);
    const d5 = new Date(hoje + 'T12:00:00'); d5.setDate(d5.getDate() + 5);
    const dMais5 = d5.toISOString().slice(0, 10);

    const grupos = {
      atrasadas:  demandas.filter(d => d.status_sla === 'atrasado'),
      proximas:   demandas.filter(d => d.status_sla !== 'atrasado' && d.data_fim_prevista <= dMais5 && d.status !== 'pendente'),
      andamento:  demandas.filter(d => d.status === 'em_andamento' && d.status_sla !== 'atrasado' && d.data_fim_prevista > dMais5),
      aguardando: demandas.filter(d => d.status === 'pendente'),
    };

    const e = this._esc.bind(this);
    const nomeUsuario = e(u.nome || 'Usuário');
    const dataHoje = typeof Utils !== 'undefined' ? Utils.fmt.date(hoje) : hoje;
    const modo = this.getModoVisualizacao();

    // Ícones vetoriais lineares para os selos circulares
    const iconRelogioAlerta = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const iconCalendario    = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const iconSync          = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    const iconAmpulheta     = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>`;

    const kpiStatusCard = (badgeIcon, bgBadge, label, count) => `
      <div class="haptic-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--shadow-sm, 0 4px 18px rgba(0,0,0,0.4));">
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="width:40px;height:40px;border-radius:50%;background:${bgBadge};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
            ${badgeIcon}
          </div>
          <div style="font-size:.75rem;color:var(--text3);font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">${label}</div>
        </div>
        <div class="tabular-nums" style="font-size:2.4rem;font-weight:900;color:var(--text);line-height:1;font-family:inherit;">${count}</div>
      </div>`;

    const renderDemanda = (d) => {
      const isAtrasado = d.status_sla === 'atrasado';
      const isAtencao = d.status_sla === 'atencao';
      const badgeDotColor = isAtrasado ? '#8F3D4A' : isAtencao ? '#C7A96B' : d.status === 'pendente' ? '#8E8C9A' : '#7F49B8';
      const badgeLabel = isAtrasado
        ? `Atrasado +${d.dias_atraso}d`
        : isAtencao ? 'Em Atenção'
        : d.status === 'pendente' ? 'Aguardando' : 'No Prazo';

      return `
        <div style="background:var(--bg-card);border:1px solid ${isAtrasado ? 'var(--danger)' : 'var(--border)'};border-radius:6px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:220px;">
            <div style="width:36px;height:36px;border-radius:6px;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;border:1px solid var(--border);color:var(--text2);flex-shrink:0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div style="min-width:0;flex:1;">
              <div style="font-size:.7rem;color:var(--action-fg);font-weight:800;letter-spacing:.04em;text-transform:uppercase;">${e(d.obra_nome)}</div>
              <div style="font-weight:800;color:var(--text);font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e(d.nome)}</div>
              <div style="font-size:.74rem;color:var(--text3);margin-top:2px;">
                Prazo: <strong>${typeof Utils !== 'undefined' ? Utils.fmt.date(d.data_fim_prevista) : d.data_fim_prevista}</strong>
                · SLA: ${d.dias_sla}d
                ${d.dias_executados ? `· Exec: ${d.dias_executados}d` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:12px;background:var(--bg-elevated);border:1px solid var(--border);font-size:.74rem;font-weight:700;color:var(--text);">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${badgeDotColor};"></span>
              ${badgeLabel}
            </span>
            <button class="btn btn-secondary btn-sm" style="font-size:.75rem;padding:6px 12px;border:1px solid var(--border);background:var(--bg-input);color:var(--text);display:flex;align-items:center;gap:6px;" title="Notificar via WhatsApp"
              data-fb-click="WhatsApp.abrirModalNotificacaoEtapa" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(d.obra_id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(d.id)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              WhatsApp
            </button>
            <button class="btn btn-primary btn-sm" style="font-size:.75rem;padding:6px 14px;font-weight:800;background:var(--accent);color:var(--accent-contrast, #101814);border:none;"
              data-fb-click="CronogramaSLA.abrirModalApontamento" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(d.obra_id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(d.id)}">
              Apontar
            </button>
          </div>
        </div>`;
    };

    const renderGrupo = (titulo, corDot, items) => {
      if (!items.length) return '';
      return `
        <div style="margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="width:10px;height:10px;border-radius:50%;background:${corDot};display:inline-block;"></span>
            <h3 style="font-size:.9rem;font-weight:800;color:var(--text);margin:0;letter-spacing:.04em;text-transform:uppercase;">${titulo}</h3>
            <span style="font-size:.72rem;background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;padding:2px 8px;color:var(--text2);font-weight:700;">${items.length}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${items.map(renderDemanda).join('')}
          </div>
        </div>`;
    };

    const renderKanbanCard = (d) => {
      const isAtrasado = d.status_sla === 'atrasado';
      const isAtencao = d.status_sla === 'atencao';
      const dotColor = isAtrasado ? '#8F3D4A' : isAtencao ? '#C7A96B' : d.status === 'pendente' ? '#8E8C9A' : '#7F49B8';
      const badgeText = isAtrasado ? `+${d.dias_atraso}d atraso` : isAtencao ? 'Atenção' : d.status === 'pendente' ? 'Aguardando' : 'No prazo';

      return `
        <div style="background:var(--bg-card);border:1px solid ${isAtrasado ? 'var(--danger)' : 'var(--border)'};border-radius:6px;padding:12px;margin-bottom:10px;box-shadow:var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.3));">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:6px;">
            <span style="font-size:.68rem;color:var(--action-fg);font-weight:800;letter-spacing:.03em;text-transform:uppercase;">${e(d.obra_nome)}</span>
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:.68rem;font-weight:700;color:var(--text3);">
              <span style="width:6px;height:6px;border-radius:50%;background:${dotColor};"></span>
              ${badgeText}
            </span>
          </div>
          <div style="font-weight:800;color:var(--text);font-size:.86rem;line-height:1.3;margin-bottom:8px;">
            ${e(d.nome)}
          </div>
          <div style="font-size:.72rem;color:var(--text3);margin-bottom:10px;">
            Prazo: <strong>${typeof Utils !== 'undefined' ? Utils.fmt.date(d.data_fim_prevista) : d.data_fim_prevista}</strong> (SLA ${d.dias_sla}d)
          </div>
          <div style="display:flex;justify-content:flex-end;align-items:center;gap:6px;border-top:1px solid var(--border);padding-top:8px;">
            <button class="btn btn-secondary btn-sm" style="font-size:.7rem;padding:4px 8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text);" title="Notificar via WhatsApp"
              data-fb-click="WhatsApp.abrirModalNotificacaoEtapa" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(d.obra_id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(d.id)}">
              WhatsApp
            </button>
            <button class="btn btn-primary btn-sm" style="font-size:.7rem;padding:4px 10px;font-weight:800;background:var(--accent);color:var(--accent-contrast, #101814);border:none;"
              data-fb-click="CronogramaSLA.abrirModalApontamento" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(d.obra_id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(d.id)}">
              Apontar
            </button>
          </div>
        </div>`;
    };

    const renderKanban = () => {
      const colunas = [
        { titulo: 'VENCIDAS', cor: '#8F3D4A', items: grupos.atrasadas },
        { titulo: 'PRÓXIMAS (5D)', cor: '#C7A96B', items: grupos.proximas },
        { titulo: 'EM ANDAMENTO', cor: '#7F49B8', items: grupos.andamento },
        { titulo: 'AGUARDANDO', cor: '#8E8C9A', items: grupos.aguardando },
      ];

      return `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:14px;align-items:start;margin-bottom:28px;">
          ${colunas.map(col => `
            <div style="background:var(--bg-card);border:1px solid var(--border);border-top:3px solid ${col.cor};border-radius:6px;padding:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h4 style="font-size:.78rem;font-weight:800;color:var(--text);margin:0;letter-spacing:.05em;">${col.titulo}</h4>
                <span style="font-size:.72rem;background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;padding:2px 8px;font-weight:700;color:var(--text2);">${col.items.length}</span>
              </div>
              <div style="min-height:80px;">
                ${col.items.length ? col.items.map(renderKanbanCard).join('') : '<div style="font-size:.75rem;color:var(--text3);opacity:.8;text-align:center;padding:22px 8px;border:1px dashed var(--border);border-radius:4px;margin-top:4px;">Nenhuma etapa nesta coluna</div>'}
              </div>
            </div>
          `).join('')}
        </div>`;
    };

    const totalUrgente = grupos.atrasadas.length + grupos.proximas.length;

    return `
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:22px;">
        <div>
          <h1 class="page-title" style="font-size:1.6rem;font-weight:900;letter-spacing:-.02em;margin:0 0 4px;color:var(--text);">Minhas Demandas</h1>
          <p class="page-sub" style="font-size:.8rem;color:var(--text3);margin:0;">${nomeUsuario} · ${dataHoje} · ${demandas.length} etapa(s) atribuída(s)</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <!-- Alternador de visualização -->
          <div style="display:flex;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:3px;gap:3px;">
            <button class="btn btn-sm" style="font-size:.75rem;padding:5px 14px;border:none;border-radius:4px;background:${modo === 'lista' ? 'var(--accent)' : 'transparent'};color:${modo === 'lista' ? 'var(--accent-contrast, #101814)' : 'var(--text3)'};font-weight:${modo === 'lista' ? '800' : '600'};cursor:pointer;"
              data-fb-click="MinhasDemandas.setModoVisualizacao" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="lista">
              Lista
            </button>
            <button class="btn btn-sm" style="font-size:.75rem;padding:5px 14px;border:none;border-radius:4px;background:${modo === 'kanban' ? 'var(--accent)' : 'transparent'};color:${modo === 'kanban' ? 'var(--accent-contrast, #101814)' : 'var(--text3)'};font-weight:${modo === 'kanban' ? '800' : '600'};cursor:pointer;"
              data-fb-click="MinhasDemandas.setModoVisualizacao" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="kanban">
              Kanban
            </button>
          </div>

          ${totalUrgente > 0 ? `
            <div style="display:flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(143,61,74,0.18);border:1px solid #8F3D4A;border-radius:6px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#8F3D4A;"></span>
              <span style="font-weight:800;color:var(--danger);font-size:.8rem;">${totalUrgente} urgente(s)</span>
            </div>` : ''}
        </div>
      </div>

      <!-- 4 Cards de KPI com Selos Circulares Oficiais -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px;margin-bottom:28px;">
        ${kpiStatusCard(iconRelogioAlerta, '#8F3D4A', 'VENCIDAS', grupos.atrasadas.length)}
        ${kpiStatusCard(iconCalendario, '#C7A96B', 'PRÓXIMAS (5D)', grupos.proximas.length)}
        ${kpiStatusCard(iconSync, '#7F49B8', 'EM ANDAMENTO', grupos.andamento.length)}
        ${kpiStatusCard(iconAmpulheta, '#8E8C9A', 'AGUARDANDO', grupos.aguardando.length)}
      </div>

      ${modo === 'kanban' ? renderKanban() : (!demandas.length ? `
        <div class="empty-state" style="padding:48px 24px;text-align:center;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;margin-bottom:28px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--action-fg);margin-bottom:12px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <h3 style="font-size:1.1rem;font-weight:800;color:var(--text);margin-bottom:6px;">Nenhuma etapa atribuída a você</h3>
          <p style="font-size:.82rem;color:var(--text3);margin:0;">Configure os cargos em <strong>Configurações → Workflow → Cargos</strong> e atribua você a um cargo para acompanhar suas demandas operacionais.</p>
        </div>` : `
        <div style="margin-bottom:28px;">
          ${renderGrupo('Vencidas', '#8F3D4A', grupos.atrasadas)}
          ${renderGrupo('Próximas do Vencimento (≤ 5 dias)', '#C7A96B', grupos.proximas)}
          ${renderGrupo('Em Andamento', '#7F49B8', grupos.andamento)}
          ${renderGrupo('Aguardando Início', '#8E8C9A', grupos.aguardando)}
        </div>
      `)}
    `;
  },

  // Badge count para o menu (vencidas + próximas)
  getBadgeCount() {
    const u = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    if (!u) return 0;
    const demandas = typeof CronogramaSLA !== 'undefined' ? CronogramaSLA.getDemandas(u.id) : [];
    const hoje = typeof Utils !== 'undefined' ? Utils.today() : new Date().toISOString().slice(0, 10);
    const d5 = new Date(hoje + 'T12:00:00'); d5.setDate(d5.getDate() + 5);
    const dMais5 = d5.toISOString().slice(0, 10);
    return demandas.filter(d => d.status_sla === 'atrasado' || (d.data_fim_prevista <= dMais5 && d.status !== 'pendente')).length;
  },
};

window.MinhasDemandas = MinhasDemandas;
