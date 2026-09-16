// js/minhas_demandas.js — Dashboard "Minhas Demandas" (Patch 52)
// Mostra ao usuário logado suas etapas pendentes, atrasadas e próximas do vencimento

const MinhasDemandas = {
  _modo: 'lista',

  getModoVisualizacao() {
    return this._modo || 'lista';
  },

  setModoVisualizacao(modo) {
    this._modo = modo;
    if (typeof App !== 'undefined' && App.route === 'minhas_demandas') {
      App.navigate('minhas_demandas');
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
      atrasadas:    demandas.filter(d => d.status_sla === 'atrasado'),
      proximas:     demandas.filter(d => d.status_sla !== 'atrasado' && d.data_fim_prevista <= dMais5 && d.status !== 'pendente'),
      andamento:    demandas.filter(d => d.status === 'em_andamento' && d.status_sla !== 'atrasado' && d.data_fim_prevista > dMais5),
      aguardando:   demandas.filter(d => d.status === 'pendente'),
    };

    const e = this._esc.bind(this);
    const nomeUsuario = e(u.nome || 'Usuário');
    const dataHoje = typeof Utils !== 'undefined' ? Utils.fmt.date(hoje) : hoje;
    const modo = this.getModoVisualizacao();

    const kpiCard = (icon, label, count, color) => `
      <div class="haptic-card" style="background:var(--bg-card);border:1px solid var(--border-s);border-radius:var(--r-lg);padding:18px 16px;text-align:center;box-shadow:var(--shadow-soft-sm);">
        <div style="font-size:1.6rem;margin-bottom:6px;">${icon}</div>
        <div class="tabular-nums" style="font-size:2.1rem;font-weight:900;color:${color};line-height:1.1;">${count}</div>
        <div style="font-size:.72rem;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-top:6px;">${label}</div>
      </div>`;

    const renderDemanda = (d) => {
      const isAtrasado = d.status_sla === 'atrasado';
      const isAtencao = d.status_sla === 'atencao';
      const badgeText = isAtrasado
        ? `🔴 Atrasado +${d.dias_atraso}d`
        : isAtencao ? '🟡 Em Atenção'
        : d.status === 'pendente' ? '⏳ Aguardando' : '🟢 No Prazo';

      return `
        <div class="haptic-card" style="background:var(--bg-card);border:1px solid ${isAtrasado ? 'rgba(244,63,94,.4)' : 'var(--border-s)'};border-radius:var(--r-md);padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:200px;">
            <div style="font-size:1.4rem;width:38px;height:38px;border-radius:10px;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;border:1px solid var(--border-s);flex-shrink:0;">${e(d.icone||'📋')}</div>
            <div style="min-width:0;flex:1;">
              <div style="font-size:.68rem;color:var(--accent2);font-weight:700;margin-bottom:2px;">${e(d.obra_nome)}</div>
              <div style="font-weight:800;color:var(--text);font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e(d.nome)}</div>
              <div class="tabular-nums" style="font-size:.73rem;color:var(--text3);margin-top:2px;">
                📅 Prazo: <strong>${typeof Utils !== 'undefined' ? Utils.fmt.date(d.data_fim_prevista) : d.data_fim_prevista}</strong>
                · ⏱️ SLA: ${d.dias_sla}d
                ${d.dias_executados ? `· Exec: ${d.dias_executados}d` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="kpi-badge-pill ${isAtrasado ? 'danger' : isAtencao ? 'warning' : 'success'}">${badgeText}</span>
            <button class="btn btn-secondary btn-sm haptic-press" style="font-size:.73rem;padding:5px 9px;" title="Notificar via WhatsApp"
              data-fb-click="WhatsApp.abrirModalNotificacaoEtapa" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(d.obra_id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(d.id)}">
              💬
            </button>
            <button class="btn btn-secondary btn-sm haptic-press" style="font-size:.73rem;padding:5px 12px;font-weight:700;"
              data-fb-click="CronogramaSLA.abrirModalApontamento" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(d.obra_id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(d.id)}">
              ✏️ Apontar
            </button>
          </div>
        </div>`;
    };

    const renderGrupo = (titulo, icone, items) => {
      if (!items.length) return '';
      return `
        <div style="margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-size:1.1rem;">${icone}</span>
            <h3 style="font-size:.92rem;font-weight:800;color:var(--text);margin:0;">${titulo}</h3>
            <span class="tabular-nums" style="font-size:.72rem;background:var(--bg-secondary);border:1px solid var(--border-s);border-radius:10px;padding:2px 8px;color:var(--text2);">${items.length}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${items.map(renderDemanda).join('')}
          </div>
        </div>`;
    };

    const renderKanbanCard = (d) => {
      const isAtrasado = d.status_sla === 'atrasado';
      const isAtencao = d.status_sla === 'atencao';
      const badgeText = isAtrasado ? `🔴 +${d.dias_atraso}d` : isAtencao ? '🟡 Atenção' : d.status === 'pendente' ? '⏳ Aguardando' : '🟢 No prazo';

      return `
        <div class="haptic-card" style="background:var(--bg-card);border:1px solid ${isAtrasado ? 'rgba(244,63,94,.4)' : 'var(--border-s)'};border-radius:var(--r-md);padding:14px;margin-bottom:10px;box-shadow:var(--shadow-soft-sm);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:4px;">
            <span style="font-size:.68rem;color:var(--accent2);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e(d.obra_nome)}</span>
            <span class="kpi-badge-pill ${isAtrasado ? 'danger' : isAtencao ? 'warning' : 'success'}">${badgeText}</span>
          </div>
          <div style="font-weight:800;color:var(--text);font-size:.88rem;line-height:1.3;margin-bottom:6px;">
            ${e(d.icone||'📋')} ${e(d.nome)}
          </div>
          <div class="tabular-nums" style="font-size:.72rem;color:var(--text3);margin-bottom:8px;">
            📅 Prazo: <strong>${typeof Utils !== 'undefined' ? Utils.fmt.date(d.data_fim_prevista) : d.data_fim_prevista}</strong> (SLA ${d.dias_sla}d)
          </div>
          <div style="display:flex;justify-content:flex-end;align-items:center;gap:6px;border-top:1px solid var(--border-s);padding-top:8px;">
            <button class="btn btn-secondary btn-sm haptic-press" style="font-size:.7rem;padding:4px 8px;" title="Notificar via WhatsApp"
              data-fb-click="WhatsApp.abrirModalNotificacaoEtapa" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(d.obra_id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(d.id)}">
              💬
            </button>
            <button class="btn btn-secondary btn-sm haptic-press" style="font-size:.7rem;padding:4px 10px;font-weight:700;"
              data-fb-click="CronogramaSLA.abrirModalApontamento" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(d.obra_id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(d.id)}">
              ✏️ Apontar
            </button>
          </div>
        </div>`;
    };
              ✏️ Apontar
            </button>
          </div>
        </div>`;
    };

    const renderKanban = () => {
      const colunas = [
        { titulo: '🔴 Vencidas', cor: 'var(--danger)', items: grupos.atrasadas },
        { titulo: '🟡 Próximas (≤ 5d)', cor: '#f59e0b', items: grupos.proximas },
        { titulo: '🔄 Em Andamento', cor: '#3b82f6', items: grupos.andamento },
        { titulo: '⏳ Aguardando', cor: 'var(--text3)', items: grupos.aguardando },
      ];

      return `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:14px;align-items:start;">
          ${colunas.map(col => `
            <div style="background:var(--bg-card);border:1px solid var(--border);border-top:3px solid ${col.cor};border-radius:var(--r-md);padding:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h4 style="font-size:.85rem;font-weight:800;color:var(--text);margin:0;">${col.titulo}</h4>
                <span style="font-size:.72rem;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:2px 8px;font-weight:700;color:var(--text3);">${col.items.length}</span>
              </div>
              <div>
                ${col.items.length ? col.items.map(renderKanbanCard).join('') : '<div style="font-size:.75rem;color:var(--text3);text-align:center;padding:20px 0;">Nenhuma etapa</div>'}
              </div>
            </div>
          `).join('')}
        </div>`;
    };

    const totalUrgente = grupos.atrasadas.length + grupos.proximas.length;

    return `
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
        <div>
          <h1 class="page-title">👤 Minhas Demandas</h1>
          <p class="page-sub">${nomeUsuario} · ${dataHoje} · ${demandas.length} etapa(s) atribuída(s)</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <!-- Seletor de Modo (Lista / Kanban) -->
          <div style="display:flex;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:3px;gap:3px;">
            <button class="btn btn-sm" style="font-size:.75rem;padding:4px 10px;border:none;border-radius:4px;background:${modo === 'lista' ? 'var(--accent)' : 'transparent'};color:${modo === 'lista' ? '#000' : 'var(--text2)'};font-weight:${modo === 'lista' ? '800' : '600'};"
              data-fb-click="MinhasDemandas.setModoVisualizacao" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="lista">
              📋 Lista
            </button>
            <button class="btn btn-sm" style="font-size:.75rem;padding:4px 10px;border:none;border-radius:4px;background:${modo === 'kanban' ? 'var(--accent)' : 'transparent'};color:${modo === 'kanban' ? '#000' : 'var(--text2)'};font-weight:${modo === 'kanban' ? '800' : '600'};"
              data-fb-click="MinhasDemandas.setModoVisualizacao" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="kanban">
              📊 Kanban
            </button>
          </div>

          ${totalUrgente > 0 ? `<div style="display:flex;align-items:center;gap:8px;padding:6px 14px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);border-radius:var(--r-md);">
            <span style="font-size:1.1rem;">🔔</span>
            <span style="font-weight:800;color:var(--danger);font-size:.82rem;">${totalUrgente} urgente(s)</span>
          </div>` : ''}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;">
        ${kpiCard('🔴', 'Vencidas', grupos.atrasadas.length, 'var(--danger)')}
        ${kpiCard('🟡', 'Próximas (5d)', grupos.proximas.length, '#f59e0b')}
        ${kpiCard('🔄', 'Em Andamento', grupos.andamento.length, '#3b82f6')}
        ${kpiCard('⏳', 'Aguardando', grupos.aguardando.length, 'var(--text3)')}
      </div>

      ${!demandas.length ? `
        <div class="empty-state">
          <div style="font-size:3rem;margin-bottom:12px;">✅</div>
          <h3>Nenhuma etapa atribuída a você</h3>
          <p>Configure os cargos em <strong>Configurações → Workflow → Cargos</strong> e atribua você a um cargo para ver suas demandas aqui.</p>
        </div>` : (modo === 'kanban' ? renderKanban() : `
        ${renderGrupo('Vencidas', '🔴', grupos.atrasadas)}
        ${renderGrupo('Próximas do Vencimento (≤ 5 dias)', '🟡', grupos.proximas)}
        ${renderGrupo('Em Andamento', '🔄', grupos.andamento)}
        ${renderGrupo('Aguardando Início', '⏳', grupos.aguardando)}
      `)}`;
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
