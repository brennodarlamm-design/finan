// js/minhas_demandas.js — Dashboard "Minhas Demandas" (Patch 52)
// Mostra ao usuário logado suas etapas pendentes, atrasadas e próximas do vencimento

const MinhasDemandas = {

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

    const kpiCard = (icon, label, count, color) => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:16px;text-align:center;cursor:pointer;">
        <div style="font-size:1.5rem;margin-bottom:4px;">${icon}</div>
        <div style="font-size:2rem;font-weight:900;color:${color};">${count}</div>
        <div style="font-size:.72rem;color:var(--text3);font-weight:700;text-transform:uppercase;margin-top:2px;">${label}</div>
      </div>`;

    const renderDemanda = (d) => {
      const isAtrasado = d.status_sla === 'atrasado';
      const isAtencao = d.status_sla === 'atencao';
      const cor = isAtrasado ? 'var(--danger)' : isAtencao ? '#f59e0b' : 'var(--success)';
      const badgeText = isAtrasado
        ? `🔴 Atrasado +${d.dias_atraso}d`
        : isAtencao ? '🟡 Em Atenção'
        : d.status === 'pendente' ? '⏳ Aguardando' : '🟢 No Prazo';

      return `
        <div style="background:var(--surface);border:1px solid ${isAtrasado ? 'rgba(239,68,68,.4)' : 'var(--border)'};border-radius:var(--r-md);padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;cursor:pointer;transition:border-color .15s;"
          data-fb-click="CronogramaSLA.abrirModalApontamento" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(d.obra_id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(d.id)}">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:200px;">
            <div style="font-size:1.4rem;width:36px;height:36px;border-radius:50%;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;border:1px solid var(--border);flex-shrink:0;">${e(d.icone||'📋')}</div>
            <div style="min-width:0;flex:1;">
              <div style="font-size:.68rem;color:var(--accent2);font-weight:700;margin-bottom:2px;">${e(d.obra_nome)}</div>
              <div style="font-weight:800;color:var(--text);font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e(d.nome)}</div>
              <div style="font-size:.73rem;color:var(--text3);margin-top:2px;">
                📅 Prazo: <strong>${typeof Utils !== 'undefined' ? Utils.fmt.date(d.data_fim_prevista) : d.data_fim_prevista}</strong>
                · ⏱️ SLA: ${d.dias_sla}d
                ${d.dias_executados ? `· Exec: ${d.dias_executados}d` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:.72rem;font-weight:800;color:${cor};background:${cor}15;padding:4px 10px;border-radius:10px;">${badgeText}</span>
            <button class="btn btn-secondary btn-sm" style="font-size:.73rem;padding:4px 10px;"
              data-fb-click="CronogramaSLA.abrirModalApontamento" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(d.obra_id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(d.id)}">
              ✏️ Apontar
            </button>
          </div>
        </div>`;
    };

    const renderGrupo = (titulo, icone, items, emptyMsg) => {
      if (!items.length) return '';
      return `
        <div style="margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-size:1.1rem;">${icone}</span>
            <h3 style="font-size:.92rem;font-weight:800;color:var(--text);margin:0;">${titulo}</h3>
            <span style="font-size:.72rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:2px 8px;color:var(--text3);">${items.length}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${items.map(renderDemanda).join('')}
          </div>
        </div>`;
    };

    const totalUrgente = grupos.atrasadas.length + grupos.proximas.length;

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">👤 Minhas Demandas</h1>
          <p class="page-sub">${nomeUsuario} · ${dataHoje} · ${demandas.length} etapa(s) atribuída(s)</p>
        </div>
        ${totalUrgente > 0 ? `<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);border-radius:var(--r-md);">
          <span style="font-size:1.2rem;">🔔</span>
          <span style="font-weight:800;color:var(--danger);font-size:.85rem;">${totalUrgente} pendência(s) urgente(s)</span>
        </div>` : ''}
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
        </div>` : `
        ${renderGrupo('Vencidas', '🔴', grupos.atrasadas)}
        ${renderGrupo('Próximas do Vencimento (≤ 5 dias)', '🟡', grupos.proximas)}
        ${renderGrupo('Em Andamento', '🔄', grupos.andamento)}
        ${renderGrupo('Aguardando Início', '⏳', grupos.aguardando)}
      `}`;
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
