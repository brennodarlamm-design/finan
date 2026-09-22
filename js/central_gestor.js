// js/central_gestor.js — Central do Gestor (FinGo Brand System)
// Visão executiva cross-obras com KPIs de borda acentuada, SLA e alinhamento institucional

const CentralGestor = {

  _esc(v) {
    if (typeof Utils !== 'undefined' && Utils.escapeHtml) return Utils.escapeHtml(String(v ?? ''));
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },

  render() {
    const obras = typeof DB !== 'undefined'
      ? DB.getAll('clientes').filter(o => !['concluida', 'cancelada', 'sistema'].includes(o.status))
      : [];

    const e = this._esc.bind(this);
    const hoje = typeof Utils !== 'undefined' ? Utils.today() : new Date().toISOString().slice(0, 10);
    const dataHoje = typeof Utils !== 'undefined' ? Utils.fmt.date(hoje) : hoje;

    if (!obras.length) return `
      <div class="page-header" style="margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="font-size:1.6rem;font-weight:900;color:var(--text);margin:0 0 4px;">Central do Gestor</h1>
          <p class="page-sub" style="font-size:.8rem;color:var(--text3);margin:0;">Visão executiva e controle operacional consolidado</p>
        </div>
      </div>
      <div class="empty-state" style="padding:48px 24px;text-align:center;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--action-fg);margin-bottom:12px;"><path d="M3 21V8l9-5 9 5v13M8 21v-7h8v7M8 9h.01M16 9h.01"/></svg>
        <h3 style="font-size:1.1rem;font-weight:800;color:var(--text);margin-bottom:6px;">Nenhuma obra ativa encontrada</h3>
        <p style="font-size:.82rem;color:var(--text3);margin:0;">Cadastre suas obras para acompanhar o status e os prazos na Central do Gestor.</p>
      </div>`;

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

    // SVGs Lineares para os KPIs
    const iconGuindaste = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22h20M4 22V7l5-4 5 4v15M14 10h6l2 4v8M14 22v-6h4v6"/></svg>`;
    const iconRelogio   = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const iconAlerta    = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    const iconUsuario   = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

    const kpiBorderCard = (iconSvg, label, count, corBorda, corTextoCount) => `
      <div class="haptic-card" style="background:var(--bg-card);border:1px solid var(--border);border-left:5px solid ${corBorda};border-radius:6px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--shadow-sm, 0 4px 18px rgba(0,0,0,0.4));">
        <div>
          <div style="display:flex;align-items:center;gap:8px;color:${corBorda};margin-bottom:6px;">
            ${iconSvg}
            <span style="font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);">${label}</span>
          </div>
          <div class="tabular-nums" style="font-size:2.2rem;font-weight:900;color:${corTextoCount};line-height:1;font-family:inherit;">${count}</div>
        </div>
      </div>`;

    const pctColor = pct => pct >= 70 ? 'var(--action-fg)' : pct >= 30 ? 'var(--warning)' : 'var(--danger)';

    const renderLinha = (d) => {
      const { obra, total, concluidos, pct, etapaAtual, respResolvido, atrasados, diasAtrasoTotal } = d;
      const bordaCor = atrasados.length > 0 ? 'var(--danger)' : 'var(--border)';

      return `
        <tr style="border-left:3px solid ${bordaCor};cursor:pointer;background:var(--bg-card);" data-fb-click="Patch26Actions.openObra" data-fb-click-n="3" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(obra.id)}" data-fb-click-t1="string" data-fb-click-v1="" data-fb-click-t2="string" data-fb-click-v2="slas">
          <td style="padding:14px 16px;">
            <div style="font-weight:800;font-size:.9rem;color:var(--text);">${e(obra.nome)}</div>
            <div style="font-size:.72rem;color:var(--text3);margin-top:2px;">${e(obra.cidade || '')} ${obra.cidade && obra.modalidade_obra ? '·' : ''} ${e(obra.modalidade_obra || '')}</div>
          </td>
          <td style="padding:14px 16px;text-align:center;">
            <div style="display:flex;align-items:center;gap:8px;justify-content:center;">
              <div style="flex:1;max-width:90px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;height:7px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${pctColor(pct)};border-radius:4px;transition:width .4s;"></div>
              </div>
              <span style="font-size:.82rem;font-weight:800;color:${pctColor(pct)};">${pct}%</span>
            </div>
            <div style="font-size:.7rem;color:var(--text3);margin-top:2px;">${concluidos}/${total} etapas</div>
          </td>
          <td style="padding:14px 16px;max-width:220px;">
            ${etapaAtual ? `
              <div style="font-size:.8rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e(etapaAtual.nome)}</div>
              ${etapaAtual.data_fim_prevista ? `<div style="font-size:.7rem;color:var(--text3);margin-top:2px;">Prazo: <strong>${typeof Utils !== 'undefined' ? Utils.fmt.date(etapaAtual.data_fim_prevista) : etapaAtual.data_fim_prevista}</strong></div>` : ''}
            ` : '<span style="font-size:.75rem;color:var(--text3);">—</span>'}
          </td>
          <td style="padding:14px 16px;">
            ${respResolvido ? `
              <div style="font-size:.8rem;font-weight:700;color:var(--action-fg);">${e(respResolvido.nome)}</div>
              <div style="font-size:.7rem;color:var(--text3);margin-top:2px;">${e(respResolvido.cargo)}</div>
            ` : '<span style="display:inline-flex;align-items:center;gap:4px;font-size:.75rem;color:var(--danger);font-weight:700;"><span style="width:6px;height:6px;border-radius:50%;background:var(--danger);"></span>Sem responsável</span>'}
          </td>
          <td style="padding:14px 16px;text-align:center;">
            ${atrasados.length > 0
              ? `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:12px;background:rgba(220,38,38,.12);border:1px solid var(--danger);color:var(--danger);font-size:.74rem;font-weight:800;">
                  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--danger);"></span>
                  ${atrasados.length} atr. (+${diasAtrasoTotal}d)
                </span>`
              : `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:12px;background:var(--accent-dim, rgba(198,255,0,.1));border:1px solid var(--action-fg);color:var(--action-fg);font-size:.74rem;font-weight:800;">
                  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--action-fg);"></span>
                  No prazo
                </span>`
            }
          </td>
          <td style="padding:14px 16px;text-align:center;">
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;">
              ${etapaAtual ? `
                <button class="btn btn-secondary btn-sm" style="font-size:.74rem;padding:5px 10px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);display:inline-flex;align-items:center;gap:4px;" title="Cobrar / Notificar responsável via WhatsApp"
                  data-fb-click="CentralGestor.cobrarWhatsApp" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(obra.id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(etapaAtual.id)}">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  WhatsApp
                </button>
              ` : ''}
              <button class="btn btn-primary btn-sm" style="font-size:.74rem;padding:5px 12px;font-weight:800;background:var(--accent);color:var(--accent-contrast, #101814);border:none;"
                data-fb-click="Patch26Actions.openObra" data-fb-click-n="3" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(obra.id)}" data-fb-click-t1="string" data-fb-click-v1="" data-fb-click-t2="string" data-fb-click-v2="slas">
                SLAs
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
      <!-- Hero Banner Institucional FinGo -->
      <div style="background:linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%);border:1px solid var(--border);border-radius:6px;padding:24px 28px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:18px;">
        <div>
          <h1 class="page-title" style="font-size:1.75rem;font-weight:900;color:var(--text);margin:0 0 6px;letter-spacing:-.02em;">Central do Gestor</h1>
          <p class="page-sub" style="font-size:.82rem;color:var(--text3);margin:0;">Visão executiva consolidada · ${totalObras} obra(s) em monitoramento · ${dataHoje}</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:.68rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--action-fg);">
            PLANEJAMENTO CONTROLE RESULTADOS
          </div>
          <div style="font-size:.84rem;font-weight:900;color:var(--text);margin-top:4px;letter-spacing:.02em;">
            TECNOLOGIA QUE CONSTRÓI RESULTADOS.
          </div>
        </div>
      </div>

      <!-- 4 Cards de KPI Executivos com Borda Lateral Colorida -->
      <div class="kpi-grid-dashboard" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px;margin-bottom:24px;">
        ${kpiBorderCard(iconGuindaste, 'OBRAS ATIVAS', totalObras, 'var(--action-fg)', 'var(--action-fg)')}
        ${kpiBorderCard(iconRelogio, 'OBRAS COM ATRASO', obrasAtrasadas, 'var(--warning)', obrasAtrasadas > 0 ? 'var(--warning)' : 'var(--text)')}
        ${kpiBorderCard(iconAlerta, 'ETAPAS ATRASADAS', totalEtapasAtrasadas, 'var(--danger)', totalEtapasAtrasadas > 0 ? 'var(--danger)' : 'var(--text)')}
        ${kpiBorderCard(iconUsuario, 'SEM RESPONSÁVEL', totalSemResponsavel, 'var(--accent2, #7F49B8)', totalSemResponsavel > 0 ? 'var(--warning)' : 'var(--text)')}
      </div>

      <!-- Gargalos Operacionais Urgentes (se houver) -->
      ${gargalos.length > 0 ? `
        <div class="card" style="margin-bottom:24px;border:1px solid var(--danger);background:var(--bg-card);padding:0;">
          <div class="card-header" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:8px;height:8px;border-radius:50%;background:var(--danger);"></span>
              <div class="card-title" style="font-size:.9rem;font-weight:800;color:var(--text);letter-spacing:.04em;text-transform:uppercase;">Gargalos Operacionais Críticos (${gargalos.length})</div>
            </div>
            <span style="font-size:.72rem;color:var(--text3);">Atrasos que exigem intervenção imediata</span>
          </div>
          <div class="tbl-wrap" style="border:none;">
            <table>
              <thead>
                <tr>
                  <th>Obra</th>
                  <th>Etapa com Atraso</th>
                  <th>Responsável</th>
                  <th>Prazo Previsto</th>
                  <th>Dias de Atraso</th>
                  <th style="text-align:center;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${gargalos.map(g => {
                  const resp = typeof CronogramaSLA !== 'undefined' ? CronogramaSLA.getResponsavelEtapa(g) : null;
                  return `
                    <tr style="background:var(--bg-card);">
                      <td style="font-weight:800;color:var(--text);">${e(g.obra_nome)}</td>
                      <td style="color:var(--text);font-weight:700;">${e(g.nome)}</td>
                      <td>${resp ? `<span style="color:var(--action-fg);font-weight:700;">${e(resp.nome)}</span> (${e(resp.cargo)})` : '<span style="color:var(--danger);font-weight:700;">Sem responsável</span>'}</td>
                      <td style="color:var(--text3);">${typeof Utils !== 'undefined' ? Utils.fmt.date(g.data_fim_prevista) : g.data_fim_prevista}</td>
                      <td><span style="display:inline-flex;align-items:center;gap:4px;color:var(--danger);font-weight:800;"><span style="width:6px;height:6px;border-radius:50%;background:var(--danger);"></span>+${g.dias_atraso} dia(s)</span></td>
                      <td style="text-align:center;">
                        <button class="btn btn-secondary btn-sm" style="font-size:.72rem;padding:4px 10px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);"
                          data-fb-click="CentralGestor.cobrarWhatsApp" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(g.obra_id)}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(g.id)}">
                          Cobrar via WhatsApp
                        </button>
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}

      <!-- Tabela Executiva: Todas as Obras — Etapa Atual & SLA -->
      <div class="card" style="padding:0;background:var(--bg-card);border:1px solid var(--border);">
        <div class="card-header" style="padding:18px 20px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);">
          <div>
            <div class="card-title" style="font-size:.95rem;font-weight:900;color:var(--text);letter-spacing:.02em;">Todas as Obras — Etapa Atual &amp; SLA</div>
            <div style="font-size:.75rem;color:var(--text3);margin-top:2px;">Clique em qualquer linha para abrir a Central da Obra correspondente</div>
          </div>
        </div>
        <div class="tbl-wrap" style="border:none;">
          <table>
            <thead>
              <tr>
                <th>Obra</th>
                <th style="text-align:center;">Progresso</th>
                <th>Etapa Atual</th>
                <th>Responsável</th>
                <th style="text-align:center;">Status SLA</th>
                <th style="text-align:center;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${dadosObras.map(renderLinha).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  cobrarWhatsApp(obraId, etapaId) {
    const cleanObra = typeof obraId === 'string' && obraId.includes('%') ? decodeURIComponent(obraId) : obraId;
    const cleanEtapa = typeof etapaId === 'string' && etapaId.includes('%') ? decodeURIComponent(etapaId) : etapaId;
    if (typeof WhatsApp !== 'undefined' && typeof WhatsApp.abrirModalNotificacaoEtapa === 'function') {
      WhatsApp.abrirModalNotificacaoEtapa(cleanObra, cleanEtapa);
      return;
    }
    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast('Módulo WhatsApp não disponível nesta tela.', 'info');
    }
  }
};

window.CentralGestor = CentralGestor;
