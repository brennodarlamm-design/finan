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
    const dMais3 = new Date();
    dMais3.setDate(dMais3.getDate() + 3);
    const dMais3Str = dMais3.toISOString().split('T')[0];

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
      <button class="icon-btn notif-bell-btn" onclick="Notificacoes.abrirPainel()" title="Central de Alertas e Notificações" style="position:relative;margin-right:2px;">
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

  // ── Abrir painel / modal de notificações ──────────────────────────────────
  abrirPainel() {
    const alertas = this.obterAlertas();

    Utils.showModal(`
      <div class="modal" id="notif-modal" style="max-width:540px;width:95vw;">
        <div class="modal-header" style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:var(--r-lg) var(--r-lg) 0 0;">
          <div class="modal-title" style="color:#fff;display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.3rem;">🔔</span>
            <div>
              <div style="font-size:1rem;font-weight:800;">Central de Alertas Financeiros</div>
              <div style="font-size:.72rem;font-weight:400;color:#94a3b8;">${alertas.length} aviso(s) ativo(s) no sistema</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="Notificacoes.solicitarPush()" style="font-size:.72rem;color:#94a3b8;" title="Ativar Notificações do Navegador">
              📱 Ativar Push
            </button>
            <button class="modal-close" onclick="Utils.closeModal()" style="color:#94a3b8;">✕</button>
          </div>
        </div>

        <div class="modal-body" style="padding:16px;max-height:70vh;overflow-y:auto;">
          ${alertas.length === 0 ? `
            <div style="text-align:center;padding:40px 20px;color:var(--text3);">
              <div style="font-size:3rem;margin-bottom:12px;">🎉</div>
              <div style="font-size:1rem;font-weight:800;color:var(--text);margin-bottom:4px;">Tudo em dia!</div>
              <div style="font-size:.82rem;">Nenhuma conta atrasada ou pré-compra pendente de aprovação.</div>
            </div>
          ` : `
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${alertas.map((a, idx) => `
                <div style="
                  padding:14px;border-radius:12px;display:flex;align-items:flex-start;gap:12px;
                  background:${a.nivel === 'urgente' ? 'rgba(239,68,68,.08)' : (a.nivel === 'aviso' ? 'rgba(245,158,11,.08)' : 'rgba(59,130,246,.08)')};
                  border:1px solid ${a.nivel === 'urgente' ? 'rgba(239,68,68,.3)' : (a.nivel === 'aviso' ? 'rgba(245,158,11,.3)' : 'rgba(59,130,246,.3)')};">
                  <div style="font-size:1.4rem;line-height:1;margin-top:2px;">${a.icone}</div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:.88rem;font-weight:800;color:var(--text);">${a.titulo}</div>
                    <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">${a.sub}</div>
                  </div>
                  <button class="btn btn-sm" onclick="Notificacoes._alertasTemp[${idx}].acao()" style="
                    font-size:.74rem;font-weight:700;white-space:nowrap;align-self:center;
                    background:${a.nivel === 'urgente' ? '#ef4444' : (a.nivel === 'aviso' ? '#f59e0b' : '#3b82f6')};
                    color:#fff;border:none;">
                    ${a.acaoTexto} →
                  </button>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="modal-footer" style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:.72rem;color:var(--text3);">Alertas atualizados em tempo real</span>
          <button class="btn btn-secondary btn-sm" onclick="Utils.closeModal()">Fechar</button>
        </div>
      </div>
    `);

    this._alertasTemp = alertas;
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
          'Angelim Construtora — Sistema Financeiro',
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
          icon: 'img/logo.png',
          badge: 'img/logo.png'
        });
      } catch (err) {
        console.warn('Erro ao disparar push desktop:', err);
      }
    }
  }
};
