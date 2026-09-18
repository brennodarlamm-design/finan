// js/notificacoes.js — Central de Notificações In-App & Alertas Push
// Monitora boletos a vencer, contas atrasadas, pré-compras e medições

const Notificacoes = {

  // ── Obter lista dinâmica de alertas do sistema ────────────────────────────
  obterAlertas() {
    const hoje = Utils.today();
    const lans = DB.getAll('lancamentos') || [];
    const precompras = DB.getAll('precompras') || [];
    const medicoes = DB.getAll('medicoes') || [];
    const clientes = DB.getAll('clientes') || [];

    const alertas = [];

    // 1. Contas vencendo HOJE
    const vencendoHoje = lans.filter(l => {
      const v = l.data_vencimento || l.data;
      return l.tipo === 'despesa' && (l.status === 'a_pagar' || l.status === 'pendente') && v === hoje;
    });
    vencendoHoje.forEach(l => {
      alertas.push({
        id: 'venc_hoje_' + l.id,
        nivel: 'urgente',
        icone: '🚨',
        titulo: 'Vence HOJE: ' + (l.descricao || 'Despesa'),
        sub: `${Utils.fmt.currency(l.valor)} · ${l.fornecedor_beneficiario || 'Fornecedor não informado'}`,
        acaoTexto: 'Ver Lançamento',
        acao: () => { Utils.closeModal(); App.navigate('lancamentos'); }
      });
    });

    // 2. Contas ATRASADAS (vencimento anterior a hoje e não pagas)
    const atrasadas = lans.filter(l => {
      const v = l.data_vencimento || l.data;
      return l.tipo === 'despesa' && (l.status === 'a_pagar' || l.status === 'pendente') && v < hoje;
    });
    if (atrasadas.length > 0) {
      const totalAtrasado = atrasadas.reduce((s,l) => s + (l.valor||0), 0);
      alertas.push({
        id: 'atrasadas_todas',
        nivel: 'urgente',
        icone: '⚠️',
        titulo: `${atrasadas.length} conta(s) em atraso!`,
        sub: `Total acumulado em atraso: ${Utils.fmt.currency(totalAtrasado)}`,
        acaoTexto: 'Filtrar Lançamentos',
        acao: () => { Utils.closeModal(); App.navigate('lancamentos'); }
      });
    }

    // 3. Contas vencendo nos próximos 3 dias
    const baseHoje = new Date(`${hoje}T12:00:00`);
    baseHoje.setDate(baseHoje.getDate() + 3);
    const dMais3Str = `${baseHoje.getFullYear()}-${String(baseHoje.getMonth()+1).padStart(2,'0')}-${String(baseHoje.getDate()).padStart(2,'0')}`;

    const proximos = lans.filter(l => {
      const v = l.data_vencimento || l.data;
      return l.tipo === 'despesa' && (l.status === 'a_pagar' || l.status === 'pendente') && v > hoje && v <= dMais3Str;
    });
    if (proximos.length > 0) {
      const totalProx = proximos.reduce((s,l) => s + (l.valor||0), 0);
      alertas.push({
        id: 'proximas_venc',
        nivel: 'aviso',
        icone: '⏰',
        titulo: `${proximos.length} boleto(s) vencendo em até 3 dias`,
        sub: `Total: ${Utils.fmt.currency(totalProx)}`,
        acaoTexto: 'Ver no Dashboard',
        acao: () => { Utils.closeModal(); App.navigate('dashboard'); }
      });
    }

    // 4. Ordens de Pré-Compra aguardando autorização
    const prePendentes = precompras.filter(p => p.status === 'pendente_aprovacao');
    if (prePendentes.length > 0) {
      const valPre = prePendentes.reduce((s,p) => s + (p.valor_total||0), 0);
      alertas.push({
        id: 'pre_pendentes',
        nivel: 'info',
        icone: '🛒',
        titulo: `${prePendentes.length} pré-compra(s) aguardando aprovação`,
        sub: `Total solicitado: ${Utils.fmt.currency(valPre)}`,
        acaoTexto: 'Autorizar Pedidos',
        acao: () => { Utils.closeModal(); App.navigate('precompras'); }
      });
    }

    // 5. Medições de Obra em análise Caixa
    const medPendentes = medicoes.filter(m => ['em_analise','submetida'].includes(m.status));
    if (medPendentes.length > 0) {
      alertas.push({
        id: 'med_pendentes',
        nivel: 'info',
        icone: '🔨',
        titulo: `${medPendentes.length} medição(ões) Caixa pendente(s)`,
        sub: 'Aguardando liberação de recursos na agência',
        acaoTexto: 'Acompanhar Medições',
        acao: () => { Utils.closeModal(); App.navigate('medicoes'); }
      });
    }

    // 6. Workflow & Etapas de Obras (Patch 52)
    if (typeof CronogramaSLA !== 'undefined') {
      const u = typeof Auth !== 'undefined' ? Auth.getUser() : null;
      if (u && u.id) {
        const demandas = CronogramaSLA.getDemandas(u.id);
        const atrasadasWf = demandas.filter(d => d.status_sla === 'atrasado');
        if (atrasadasWf.length > 0) {
          alertas.push({
            id: 'wf_atrasadas',
            nivel: 'urgente',
            icone: '🔴',
            titulo: `${atrasadasWf.length} etapa(s) de obra em atraso!`,
            sub: `Atenção: ${atrasadasWf.slice(0, 2).map(d => d.nome).join(', ')}${atrasadasWf.length > 2 ? '...' : ''}`,
            acaoTexto: 'Minhas Demandas',
            acao: () => { Utils.closeModal(); App.navigate('minhas-demandas'); }
          });
        }

        const hojeWf = hoje;
        const vencendoHojeWf = demandas.filter(d => d.status_sla !== 'atrasado' && d.data_fim_prevista === hojeWf && d.status !== 'pendente');
        if (vencendoHojeWf.length > 0) {
          alertas.push({
            id: 'wf_hoje',
            nivel: 'urgente',
            icone: '⏰',
            titulo: `${vencendoHojeWf.length} etapa(s) vencendo HOJE`,
            sub: vencendoHojeWf.map(d => `${d.obra_nome}: ${d.nome}`).join(' · '),
            acaoTexto: 'Ver Demandas',
            acao: () => { Utils.closeModal(); App.navigate('minhas-demandas'); }
          });
        }

        const proximasWf = demandas.filter(d => d.status_sla !== 'atrasado' && d.data_fim_prevista > hojeWf && d.data_fim_prevista <= dMais3Str && d.status !== 'pendente');
        if (proximasWf.length > 0) {
          alertas.push({
            id: 'wf_proximas',
            nivel: 'aviso',
            icone: '📋',
            titulo: `${proximasWf.length} etapa(s) de obra vencendo em até 3 dias`,
            sub: proximasWf.map(d => `${d.nome} (${d.obra_nome})`).join(', '),
            acaoTexto: 'Minhas Demandas',
            acao: () => { Utils.closeModal(); App.navigate('minhas-demandas'); }
          });
        }
      }
    }

    return alertas;
  },

  // ── Contagem total de alertas não resolvidos ──────────────────────────────
  getBadgeCount() {
    return this.obterAlertas().length;
  },

  // ── Renderiza o botão do sino para o cabeçalho ────────────────────────────
  renderBellBtn() {
    const qtd = this.getBadgeCount();
    const temUrgente = this.obterAlertas().some(a => a.nivel === 'urgente');

    return `
      <button class="icon-btn notif-bell-btn" data-fb-click="Notificacoes.abrirPainel" data-fb-click-n="0" title="Central de Alertas e Notificações" style="position:relative;margin-right:2px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        ${qtd > 0 ? `
          <span style="
            position:absolute;top:2px;right:2px;
            background:${temUrgente ? '#ef4444' : '#f59e0b'};color:#fff;
            font-size:.65rem;font-weight:900;border-radius:10px;min-width:16px;height:16px;
            display:flex;align-items:center;justify-content:center;padding:0 3px;
            box-shadow:0 0 8px ${temUrgente ? 'rgba(239,68,68,.6)' : 'rgba(245,158,11,.6)'};
            animation:${temUrgente ? 'notifPulse 1.5s infinite' : 'none'};">
            ${qtd}
          </span>
        ` : ''}
      </button>
      <style>
        @keyframes notifPulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.2);} }
      </style>
    `;
  },

  _tabAtiva: 'alertas',

  _emailsPadrao: [
    { id: 'em_1', data: '2026-09-15 17:40', para: 'financeiro@engenhariabrasil.com.br', assunto: 'Recibo Oficial de Pagamento — Obra Residencial Bella Vista', tipo: 'recibo', status: 'entregue' },
    { id: 'em_2', data: '2026-09-15 14:15', para: 'diretoria@construtoraprimor.com.br', assunto: 'Boletim de Medição BM-04 submetido para validação', tipo: 'medicao', status: 'entregue' },
    { id: 'em_3', data: '2026-09-14 09:30', para: 'compras@fornecedorao.com.br', assunto: 'Ordem de Pré-Compra Aprovada #PC-1082 — Cimento e Aço CA-50', tipo: 'precompra', status: 'entregue' },
    { id: 'em_4', data: '2026-09-13 11:20', para: 'carlos.engenheiro@cliente.com', assunto: 'Convite de Acesso ao Portal de Transparência da Obra', tipo: 'portal', status: 'entregue' },
  ],

  _atualizacoesPadrao: [
    {
      versao: 'v2.38.0',
      data: '15/09/2026',
      badge: 'NOVO',
      titulo: 'Segmentação da Sidebar, Agenda Dev & Modo Kanban',
      novidades: [
        'Sidebar reorganizada em 7 segmentos colapsáveis com terminologia da Construção Civil.',
        'Agenda Dev no cabeçalho para acompanhamento de aulas, workshops e lives técnicas.',
        'Quadro Kanban operacional com 4 colunas em Minhas Demandas.',
        'Notificações de disparos de e-mail e canal de novidades da plataforma.'
      ]
    },
    {
      versao: 'v2.37.0',
      data: '08/09/2026',
      badge: 'ESTÁVEL',
      titulo: 'Base Oficial SINAPI da Caixa & Automação em Cascata',
      novidades: [
        'Consulta de composições e insumos SINAPI com cálculo automático de BDI.',
        'Sucessão automática de etapas operacionais no workflow de obras.'
      ]
    }
  ],

  getEmails() {
    try {
      const raw = localStorage.getItem('finobra_email_logs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return this._emailsPadrao;
  },

  registrarEnvioEmail(para, assunto, tipo = 'geral', status = 'entregue') {
    const emails = this.getEmails();
    const dataHora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const novo = {
      id: 'em_' + Date.now(),
      data: dataHora,
      para,
      assunto,
      tipo,
      status
    };
    emails.unshift(novo);
    try {
      localStorage.setItem('finobra_email_logs', JSON.stringify(emails.slice(0, 50)));
    } catch {}
    return novo;
  },

  getAtualizacoes() {
    return this._atualizacoesPadrao;
  },

  // ── Abrir painel / modal de notificações ──────────────────────────────────
  abrirPainel(tab = 'alertas') {
    this._tabAtiva = tab;
    const alertas = this.obterAlertas();
    this._alertasTemp = alertas;
    const emails = this.getEmails();
    const updates = this.getAtualizacoes();

    Utils.showModal(`
      <div class="modal" id="notif-modal" style="max-width:580px;width:95vw;">
        <div class="modal-header" style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:var(--r-lg) var(--r-lg) 0 0;padding:16px 20px;">
          <div class="modal-title" style="color:#fff;display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.3rem;">🔔</span>
            <div>
              <div style="font-size:1.02rem;font-weight:800;">Central de Alertas &amp; Notificações</div>
              <div style="font-size:.72rem;font-weight:400;color:#94a3b8;">Monitoramento operacional, disparos de e-mail e avisos do sistema</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button type="button" class="btn btn-ghost btn-sm" data-fb-click="Notificacoes.solicitarPush" data-fb-click-n="0" style="font-size:.72rem;color:#94a3b8;" title="Ativar Notificações do Navegador">
              📱 Ativar Push
            </button>
            <button type="button" class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0" style="color:#94a3b8;">✕</button>
          </div>
        </div>

        <div class="notif-tab-nav">
          <button type="button" class="notif-tab-btn ${this._tabAtiva === 'alertas' ? 'active' : ''}"
            data-fb-click="Notificacoes.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="alertas">
            🚨 Alertas Operacionais <span style="font-size:.7rem;padding:1px 6px;border-radius:10px;background:rgba(239,68,68,.2);color:#f87171;font-weight:800;">${alertas.length}</span>
          </button>
          <button type="button" class="notif-tab-btn ${this._tabAtiva === 'emails' ? 'active' : ''}"
            data-fb-click="Notificacoes.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="emails">
            ✉️ E-mails Enviados <span style="font-size:.7rem;padding:1px 6px;border-radius:10px;background:rgba(59,130,246,.2);color:#60a5fa;font-weight:800;">${emails.length}</span>
          </button>
          <button type="button" class="notif-tab-btn ${this._tabAtiva === 'atualizacoes' ? 'active' : ''}"
            data-fb-click="Notificacoes.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="atualizacoes">
            🚀 Novidades &amp; Dev
          </button>
        </div>

        <div class="modal-body" id="notif-body-content" style="padding:16px;max-height:65vh;overflow-y:auto;">
          ${this._renderTabContent(this._tabAtiva)}
        </div>

        <div class="modal-footer" style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:.72rem;color:var(--text3);">Disparos e alertas registrados em tempo real</span>
          <button type="button" class="btn btn-secondary btn-sm" data-fb-click="Utils.closeModal" data-fb-click-n="0">Fechar</button>
        </div>
      </div>
    `);
  },

  setTab(tab) {
    this._tabAtiva = tab;
    const body = document.getElementById('notif-body-content');
    if (body) {
      body.innerHTML = this._renderTabContent(tab);
    }
    document.querySelectorAll('.notif-tab-btn').forEach(btn => {
      const isAct = btn.getAttribute('data-fb-click-v0') === tab;
      btn.classList.toggle('active', isAct);
    });
  },

  _renderTabContent(tab) {
    const esc = v => typeof Utils !== 'undefined' ? Utils.escapeHtml(String(v ?? '')) : String(v ?? '');

    if (tab === 'alertas') {
      const alertas = this._alertasTemp || this.obterAlertas();
      if (alertas.length === 0) {
        return `
          <div style="text-align:center;padding:40px 20px;color:var(--text3);">
            <div style="font-size:3rem;margin-bottom:12px;">🎉</div>
            <div style="font-size:1rem;font-weight:800;color:var(--text);margin-bottom:4px;">Tudo em dia!</div>
            <div style="font-size:.82rem;">Nenhuma conta atrasada, pré-compra pendente ou etapa de obra vencida.</div>
          </div>`;
      }
      return `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${alertas.map((a, idx) => `
            <div style="
              padding:14px;border-radius:12px;display:flex;align-items:flex-start;gap:12px;
              background:${a.nivel === 'urgente' ? 'rgba(239,68,68,.08)' : (a.nivel === 'aviso' ? 'rgba(245,158,11,.08)' : 'rgba(59,130,246,.08)')};
              border:1px solid ${a.nivel === 'urgente' ? 'rgba(239,68,68,.3)' : (a.nivel === 'aviso' ? 'rgba(245,158,11,.3)' : 'rgba(59,130,246,.3)')};">
              <div style="font-size:1.4rem;line-height:1;margin-top:2px;">${a.icone}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:.88rem;font-weight:800;color:var(--text);">${esc(a.titulo)}</div>
                <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">${esc(a.sub)}</div>
              </div>
              <button type="button" class="btn btn-sm" data-fb-click="Patch26Actions.notificacaoAction" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(idx))}" style="
                font-size:.74rem;font-weight:700;white-space:nowrap;align-self:center;
                background:${a.nivel === 'urgente' ? '#ef4444' : (a.nivel === 'aviso' ? '#f59e0b' : '#3b82f6')};
                color:#fff;border:none;">
                ${esc(a.acaoTexto)} →
              </button>
            </div>
          `).join('')}
        </div>`;
    }

    if (tab === 'emails') {
      const emails = this.getEmails();
      if (!emails.length) {
        return `
          <div style="text-align:center;padding:36px 16px;color:var(--text3);">
            <div style="font-size:2.5rem;margin-bottom:8px;">📬</div>
            <h4 style="font-size:.92rem;font-weight:700;margin-bottom:4px;">Nenhum e-mail disparado recentemente</h4>
            <p style="font-size:.78rem;margin:0;">Disparos de faturas, recibos e avisos aos clientes serão registrados aqui.</p>
          </div>`;
      }
      return `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="font-size:.75rem;color:var(--text3);margin-bottom:4px;display:flex;justify-content:space-between;">
            <span>Últimos e-mails gerados pela plataforma</span>
            <span>Status</span>
          </div>
          ${emails.map(em => `
            <div class="notif-email-row" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);">
              <div style="min-width:0;flex:1;padding-right:12px;">
                <div style="font-size:.82rem;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(em.assunto)}</div>
                <div style="font-size:.72rem;color:var(--text3);margin-top:2px;">
                  Para: <strong style="color:var(--text2);">${esc(em.para)}</strong> · ${esc(em.data)}
                </div>
              </div>
              <span class="kpi-badge-pill success" style="font-size:.68rem;padding:2px 8px;">
                ✓ ${esc(em.status || 'Enviado')}
              </span>
            </div>
          `).join('')}
        </div>`;
    }

    if (tab === 'atualizacoes') {
      const updates = this.getAtualizacoes();
      return `
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${updates.map(up => `
            <div class="notif-update-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:.95rem;font-weight:900;color:var(--accent);">${esc(up.versao)}</span>
                  <span class="kpi-badge-pill info" style="font-size:.65rem;padding:1px 6px;">${esc(up.badge)}</span>
                </div>
                <span style="font-size:.72rem;color:var(--text3);">${esc(up.data)}</span>
              </div>
              <h5 style="font-size:.85rem;font-weight:800;color:var(--text);margin:0 0 8px;">${esc(up.titulo)}</h5>
              <ul style="margin:0;padding-left:18px;font-size:.78rem;color:var(--text2);line-height:1.5;">
                ${up.novidades.map(n => `<li>${esc(n)}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>`;
    }

    return '';
  },

  _alertasTemp: [],

  // ── Solicitar permissão para Notificações Web nativas ─────────────────────
  solicitarPush() {
    if (!('Notification' in window)) {
      Utils.toast('Seu navegador não suporta notificações web push.', 'warning');
      return;
    }

    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        Utils.toast('🔔 Notificações ativadas com sucesso!', 'success');
        this.enviarPushDesktop(
          `${(DB.getEmpresa()?.nome_fantasia || DB.getEmpresa()?.razao_social || 'FinObra')} — Sistema Financeiro`,
          'Notificações ativadas! Você será alertado quando houver boletos a vencer.'
        );
      } else {
        Utils.toast('Permissão de notificação não concedida.', 'info');
      }
    });
  },

  enviarPushDesktop(titulo, corpo) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(titulo, {
          body: corpo,
          icon: '/img/fingo/fingo-symbol.png',
          badge: '/img/fingo/fingo-symbol.png'
        });
      } catch (err) {
        console.warn('Erro ao disparar push desktop:', err);
      }
    }
  }
};
