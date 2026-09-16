// js/central_gestor.js — Central do Gestor (Patch 52)
// Visão cross-obras: etapa atual, responsável, SLA, atraso e gargalos por obra

const CentralGestor = {

  _esc(v) {
    if (typeof Utils !== 'undefined' && Utils.escapeHtml) return Utils.escapeHtml(String(v ?? ''));
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },

  render() {
    const obras = typeof DB !== 'undefined'
      ? DB.getAll('clientes').filter(o => !['concluida', 'cancelada', 'sistema'].includes(o.status))
      : [];

    if (!obras.length) return `
      <div class="page-header"><div><h1 class="page-title">🏢 Central do Gestor</h1></div></div>
      <div class="empty-state"><h3>Nenhuma obra ativa</h3><p>Cadastre obras para ver o painel do gestor.</p></div>`;

    const e = this._esc.bind(this);
    const hoje = typeof Utils !== 'undefined' ? Utils.today() : new Date().toISOString().slice(0, 10);

    // Monta dados por obra
    const dadosObras = obras.map(obra => {
      const processos = typeof CronogramaSLA !== 'undefined' ? CronogramaSLA.getObraProcessos(obra.id) : [];
      const total = processos.length;
      const concluidos = processos.filter(p => p.status === 'concluido').length;
      const emAndamento = processos.filter(p => p.status === 'em_andamento');
      const atrasados = processos.filter(p => p.status_sla === 'atrasado');
      const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
      const etapaAtual = emAndamento[0] || processos.find(p => p.status === 'pendente');
      const respResolvido = etapaAtual && typeof CronogramaSLA !== 'undefined'
        ? CronogramaSLA.getResponsavelEtapa(etapaAtual)
        : null;
      const diasAtrasoTotal = atrasados.reduce((s, p) => s + (p.dias_atraso || 0), 0);
      return { obra, processos, total, concluidos, emAndamento, atrasados, pct, etapaAtual, respResolvido, diasAtrasoTotal };
    }).sort((a, b) => b.atrasados.length - a.atrasados.length);

    // KPIs globais
    const totalObras = dadosObras.length;
    const obrasAtrasadas = dadosObras.filter(d => d.atrasados.length > 0).length;
    const totalEtapasAtrasadas = dadosObras.reduce((s, d) => s + d.atrasados.length, 0);
    const totalSemResponsavel = dadosObras.filter(d => d.etapaAtual && !d.respResolvido).length;

    const kpiCard = (icon, label, count, cor) => `
      <div class="haptic-card" style="background:var(--bg-card);border:1px solid var(--border-s);border-radius:var(--r-lg);padding:18px 16px;text-align:center;box-shadow:var(--shadow-soft-sm);">
        <div style="font-size:1.6rem;margin-bottom:6px;">${icon}</div>
        <div class="tabular-nums" style="font-size:2rem;font-weight:900;color:${cor};line-height:1.1;">${count}</div>
        <div style="font-size:.7rem;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-top:6px;">${label}</div>
      </div>`;

    const pctColor = pct => pct >= 70 ? 'var(--success)' : pct >= 30 ? '#f59e0b' : 'var(--danger)';
    const slaColor = s => s === 'atrasado' ? 'var(--danger)' : s === 'atencao' ? '#f59e0b' : 'var(--success)';

    const renderLinha = (d) => {
      const { obra, total, concluidos, pct, etapaAtual, respResolvido, atrasados, diasAtrasoTotal } = d;
      const statusGeral = atrasados.length > 0 ? 'atrasado' : 'no_prazo';
      const bordaCor = atrasados.length > 0 ? 'rgba(244,63,94,.5)' : 'var(--border-s)';

      return `
        <tr style="border-left:3px solid ${bordaCor};cursor:pointer;" data-fb-click="Patch26Actions.openObra" data-fb-click-n="3" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(obra.id)}" data-fb-click-t1="string" data-fb-click-v1="" data-fb-click-t2="string" data-fb-click-v2="slas">
          <td>
            <div style="font-weight:800;font-size:.88rem;color:var(--text);">${e(obra.nome)}</div>
            <div style="font-size:.7rem;color:var(--text3);">${e(obra.cidade || '')} ${e(obra.modalidade_obra || '')}</div>
          </td>
          <td style="text-align:center;">
            <div style="display:flex;align-items:center;gap:6px;justify-content:center;">
              <div style="flex:1;max-width:80px;background:var(--bg-secondary);border-radius:4px;height:6px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${pctColor(pct)};border-radius:4px;transition:width .4s;"></div>
              </div>
              <span class="tabular-nums" style="font-size:.8rem;font-weight:800;color:${pctColor(pct)};">${pct}%</span>
            </div>
            <div class="tabular-nums" style="font-size:.68rem;color:var(--text3);margin-top:2px;">${concluidos}/${total} etapas</div>
          </td>
          <td style="max-width:200px;">
            ${etapaAtual ? `
              <div style="font-size:.78rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e(etapaAtual.icone||'📋')} ${e(etapaAtual.nome)}</div>
              ${etapaAtual.data_fim_prevista ? `<div class="tabular-nums" style="font-size:.68rem;color:var(--text3);">📅 Prazo: ${typeof Utils !== 'undefined' ? Utils.fmt.date(etapaAtual.data_fim_prevista) : etapaAtual.data_fim_prevista}</div>` : ''}
            ` : '<span style="font-size:.75rem;color:var(--text3);">—</span>'}
          </td>
          <td>
            ${respResolvido ? `
              <div style="font-size:.78rem;font-weight:700;color:var(--accent2);">${e(respResolvido.icone||'👤')} ${e(respResolvido.nome)}</div>
              <div style="font-size:.68rem;color:var(--text3);">${e(respResolvido.cargo)}</div>
            ` : '<span style="font-size:.75rem;color:var(--danger);font-weight:700;">⚠ Sem responsável</span>'}
          </td>
          <td style="text-align:center;">
            ${atrasados.length > 0
              ? `<span class="kpi-badge-pill danger tabular-nums">🔴 ${atrasados.length} atr. (+${diasAtrasoTotal}d)</span>`
              : `<span class="kpi-badge-pill success">🟢 No prazo</span>`
            }
          </td>
          <td style="text-align:center;">
            <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
              ${etapaAtual ? `
                <button class="btn btn-secondary btn-sm haptic-press" style="font-size:.72rem;padding:4px 8px;" title="Cobrar / Notificar responsável via WhatsApp"
                  data-fb-click="CentralGestor.cobrarWhatsApp" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(obra.id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(etapaAtual.id)}">
                  💬
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm haptic-press" style="font-size:.72rem;padding:4px 10px;font-weight:700;"
                data-fb-click="Patch26Actions.openObra" data-fb-click-n="3" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(obra.id)}" data-fb-click-t1="string" data-fb-click-v1="" data-fb-click-t2="string" data-fb-click-v2="slas">
                📊 SLAs
              </button>
            </div>
          </td>
        </tr>`;
    };

    // Gargalos: etapas atrasadas de todas as obras
    const gargalos = dadosObras.flatMap(d =>
      d.atrasados.map(p => ({ ...p, obra_nome: d.obra.nome, obra_id: d.obra.id }))
    ).sort((a, b) => (b.dias_atraso || 0) - (a.dias_atraso || 0)).slice(0, 8);

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">🏢 Central do Gestor</h1>
          <p class="page-sub">Visão executiva · ${totalObras} obra(s) ativa(s) · ${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      <div class="kpi-grid-dashboard">
        ${kpiCard('🏗️', 'Obras Ativas', totalObras, 'var(--accent2)')}
        ${kpiCard('🔴', 'Obras com Atraso', obrasAtrasadas, obrasAtrasadas > 0 ? 'var(--danger)' : 'var(--success)')}
        ${kpiCard('⚠', 'Etapas Atrasadas', totalEtapasAtrasadas, totalEtapasAtrasadas > 0 ? 'var(--danger)' : 'var(--success)')}
        ${kpiCard('❓', 'Sem Responsável', totalSemResponsavel, totalSemResponsavel > 0 ? '#f59e0b' : 'var(--success)')}
      </div>

      ${gargalos.length > 0 ? `
        <div class="card" style="margin-bottom:24px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.04);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-size:1.2rem;">🔴</span>
            <h3 style="font-size:.92rem;font-weight:800;color:var(--danger);margin:0;">Gargalos Críticos — Etapas mais Atrasadas</h3>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${gargalos.map(p => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(239,68,68,.06);border-radius:6px;font-size:.8rem;gap:8px;">
                <div>
                  <span style="font-weight:700;color:var(--text);">${e(p.icone||'📋')} ${e(p.nome)}</span>
                  <span style="color:var(--text3);margin-left:6px;">· ${e(p.obra_nome)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="color:var(--danger);font-weight:800;">+${p.dias_atraso || 0}d atrasado</span>
                  <button class="btn btn-secondary btn-sm" style="font-size:.7rem;padding:2px 8px;" title="Cobrar responsável via WhatsApp"
                    data-fb-click="CentralGestor.cobrarWhatsApp" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(p.obra_id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(p.id)}">
                    💬 Cobrar
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <h3 style="font-size:.92rem;font-weight:800;color:var(--text);margin:0;">📋 Todas as Obras — Etapa Atual & SLA</h3>
          <span style="font-size:.72rem;color:var(--text3);">Clique em uma linha para abrir o cronograma da obra</span>
        </div>
        <div class="table-wrap" style="overflow-x:auto;">
          <table class="table" style="width:100%;min-width:720px;">
            <thead>
              <tr>
                <th style="font-size:.72rem;">Obra</th>
                <th style="font-size:.72rem;text-align:center;">Progresso</th>
                <th style="font-size:.72rem;">Etapa Atual</th>
                <th style="font-size:.72rem;">Responsável</th>
                <th style="font-size:.72rem;text-align:center;">Status SLA</th>
                <th style="font-size:.72rem;text-align:center;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${dadosObras.map(renderLinha).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  cobrarWhatsApp(obraId, etapaId) {
    if (typeof WhatsApp !== 'undefined' && WhatsApp.abrirModalNotificacaoEtapa) {
      WhatsApp.abrirModalNotificacaoEtapa(obraId, etapaId);
    } else {
      Utils.toast('Módulo WhatsApp não disponível.', 'warning');
    }
  },
};

window.CentralGestor = CentralGestor;
