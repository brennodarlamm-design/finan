/* PATCH 51 — ajustes funcionais finais sem alterar módulos legados. */
(() => {
  if (typeof Patch51 === 'undefined') return;

  const dateFmt = value => {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { timeZone:'America/Boa_Vista' });
  };

  const deadlineFor = stage => {
    const base = stage?.started_at || stage?.created_at;
    if (!base) return null;
    const d = new Date(base);
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + (Number(stage.dias_sla) || 0));
    return d;
  };

  // O container real da Central é #od-tab-content. Corrige a soma dos SLAs
  // sem depender do seletor legado #obra-tab-content.
  Patch51.enhanceSlaSummary = function() {
    if (typeof App === 'undefined' || App.route !== 'obra-detalhe' || typeof ObraDetalhe === 'undefined' || ObraDetalhe.activeTab !== 'slas') return;
    if (document.getElementById('p51-total-sla')) return;

    const obraId = App.obraId || ObraDetalhe.currentObraId;
    const workflow = Patch51._workflow.get(String(obraId || ''));
    const processos = workflow?.stages?.length
      ? workflow.stages
      : (typeof CronogramaSLA !== 'undefined' ? (CronogramaSLA.getObraProcessos(obraId) || []) : []);
    const total = processos.reduce((sum, item) => sum + (Number(item?.dias_sla) || 0), 0);

    const root = document.getElementById('od-tab-content');
    const cards = root?.querySelector('.g4, .g3, [class^="g"]');
    if (!cards) return;

    const card = document.createElement('div');
    card.id = 'p51-total-sla';
    card.className = 'card';
    card.style.padding = '14px 18px';
    card.innerHTML = `<div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;font-weight:800;">Soma dos SLAs</div><div style="font-size:1.35rem;font-weight:900;margin-top:4px;">${total} dias</div>`;
    cards.appendChild(card);
  };

  // Mantém o editor legado de Prazos & SLAs e o workflow persistido no servidor
  // usando a mesma quantidade de dias. Só envia aumentos; reduções continuam bloqueadas.
  const syncWorkflowSla = async (obraId, processos) => {
    if (!obraId || !Patch51.isManager() || !Array.isArray(processos) || !processos.length) return;
    try {
      const listed = await Patch51.api('list', { params:{ obraId } });
      const stages = Array.isArray(listed.stages) ? listed.stages : [];
      if (!stages.length) return;
      let changed = false;
      let lastResult = null;
      for (const processo of processos) {
        const stage = stages.find(item => String(item.etapa_id) === String(processo.id || processo.etapa_id));
        if (!stage) continue;
        const nextDays = Number(processo.dias_sla || 0);
        const currentDays = Number(stage.dias_sla || 0);
        if (!Number.isFinite(nextDays) || nextDays <= currentDays) continue;
        lastResult = await Patch51.api('stage_update', {
          method:'POST',
          body:{ obraId, etapaId:stage.etapa_id, dias_sla:nextDays }
        });
        changed = true;
      }
      if (lastResult) Patch51.applyForecastLocal(obraId, lastResult.data_previsao, lastResult.total_dias);
      if (changed) {
        await Patch51.loadWorkflow(obraId, { initialize:false });
        if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('SLAs sincronizados com o workflow e a nova previsão.', 'success');
      }
    } catch (err) {
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(err?.message || 'Não foi possível sincronizar os SLAs com o workflow.', 'warning');
    }
  };

  if (typeof CronogramaSLA !== 'undefined') {
    const currentConfigSubmit = CronogramaSLA.salvarConfigObraSubmit.bind(CronogramaSLA);
    CronogramaSLA.salvarConfigObraSubmit = function(obraId) {
      const result = currentConfigSubmit(obraId);
      const processos = CronogramaSLA.getObraProcessos(obraId) || [];
      Promise.resolve().then(() => syncWorkflowSla(obraId, processos));
      return result;
    };

    const currentApontamento = CronogramaSLA.salvarApontamento.bind(CronogramaSLA);
    CronogramaSLA.salvarApontamento = function(obraId, processoId) {
      const result = currentApontamento(obraId, processoId);
      const processo = (CronogramaSLA.getObraProcessos(obraId) || []).find(item => String(item.id) === String(processoId));
      if (processo) Promise.resolve().then(() => syncWorkflowSla(obraId, [processo]));
      return result;
    };
  }

  // Quando a obra é criada sem responsável na primeira etapa, não deixa o erro
  // silencioso: orienta o usuário a configurar o responsável antes do fluxo iniciar.
  const originalInitializeWorkflow = Patch51.initializeWorkflow.bind(Patch51);
  Patch51.initializeWorkflow = async function(obraId, silent = false) {
    try {
      return await originalInitializeWorkflow(obraId, silent);
    } catch (err) {
      if (silent && ['WORKFLOW_FIRST_STAGE_UNASSIGNED','WORKFLOW_EMPTY'].includes(err?.code)) {
        if (typeof Utils !== 'undefined' && Utils.toast) {
          Utils.toast(
            err.code === 'WORKFLOW_FIRST_STAGE_UNASSIGNED'
              ? 'Obra salva, mas o workflow ainda não iniciou. Defina o responsável da primeira etapa em Configurações > SLAs ou selecione um responsável interno.'
              : 'Obra salva, mas o workflow não possui etapas configuradas.',
            'warning'
          );
        }
      }
      throw err;
    }
  };

  // Exibe prazo e orientação também em "Minhas Etapas", que é a fila operacional do usuário.
  const originalOpenMyTasks = Patch51.openMyTasks.bind(Patch51);
  Patch51.openMyTasks = async function() {
    const result = await originalOpenMyTasks();
    document.querySelectorAll('.p51-task-complete').forEach(button => {
      const task = this._myTasks.find(item => String(item.obra_id) === String(button.dataset.obra) && String(item.etapa_id) === String(button.dataset.stage));
      if (!task) return;
      const card = button.closest('.card');
      if (!card || card.dataset.p51Deadline === '1') return;
      card.dataset.p51Deadline = '1';
      const deadline = deadlineFor(task);
      const overdue = deadline && deadline.getTime() < Date.now();
      const details = card.querySelector('div > div');
      if (!details) return;
      const info = document.createElement('div');
      info.style.cssText = `font-size:.74rem;margin-top:6px;${overdue ? 'color:var(--danger);font-weight:800;' : 'color:var(--text2);'}`;
      info.textContent = deadline ? `📅 Prazo estimado: ${dateFmt(deadline)}${overdue ? ' — VENCIDA' : ''}` : '📅 Prazo estimado: não disponível';
      details.appendChild(info);
      const guidance = String(task.observacoes || '').trim();
      if (guidance) {
        const note = document.createElement('div');
        note.style.cssText = 'font-size:.74rem;margin-top:6px;padding:7px 9px;border:1px solid var(--border);border-radius:7px;background:var(--bg-secondary);color:var(--text2);line-height:1.4;';
        note.textContent = `📝 Orientação: ${guidance}`;
        details.appendChild(note);
      }
    });
    return result;
  };

  // A nova demanda entra também na Central de Alertas e, quando o navegador já
  // possui permissão, dispara uma notificação nativa sem solicitar permissão sozinho.
  const originalLoadMyTasks = Patch51.loadMyTasks.bind(Patch51);
  Patch51.loadMyTasks = async function(silent = false) {
    const previous = new Set((this._myTasks || []).map(item => `${item.obra_id}:${item.etapa_id}`));
    const tasks = await originalLoadMyTasks(silent);
    const added = (tasks || []).filter(item => !previous.has(`${item.obra_id}:${item.etapa_id}`));
    if (added.length && typeof Notificacoes !== 'undefined' && typeof Notificacoes.enviarPushDesktop === 'function') {
      const first = added[0];
      const suffix = added.length > 1 ? ` (+${added.length - 1} nova(s))` : '';
      Notificacoes.enviarPushDesktop('FinObra — Nova etapa atribuída', `${first.nome} · ${first.obra_nome}${suffix}`);
    }
    return tasks;
  };

  if (typeof Notificacoes !== 'undefined') {
    const originalObterAlertas = Notificacoes.obterAlertas.bind(Notificacoes);
    Notificacoes.obterAlertas = function() {
      const base = originalObterAlertas();
      const tasks = Array.isArray(Patch51._myTasks) ? Patch51._myTasks : [];
      const workflowAlerts = tasks.map(task => {
        const deadline = deadlineFor(task);
        const overdue = deadline && deadline.getTime() < Date.now();
        const instruction = String(task.observacoes || task.descricao || 'Abra a etapa para visualizar as orientações.').trim();
        return {
          id:`workflow_${task.obra_id}_${task.etapa_id}`,
          nivel:overdue ? 'urgente' : 'info',
          icone:overdue ? '🚨' : '📌',
          titulo:`${task.nome} — ${task.obra_nome}`,
          sub:`${deadline ? `Prazo ${dateFmt(deadline)}` : `SLA ${Number(task.dias_sla) || 0} dias`} · ${instruction.slice(0,140)}`,
          acaoTexto:'Abrir Etapa',
          acao:() => {
            if (typeof Utils !== 'undefined') Utils.closeModal();
            if (typeof App !== 'undefined') {
              App.obraId = task.obra_id;
              App.navigate('obra-detalhe');
              setTimeout(() => {
                if (typeof ObraDetalhe !== 'undefined') ObraDetalhe.setTab('workflow');
              }, 120);
            }
          }
        };
      });
      return [...workflowAlerts, ...base];
    };

    const originalAbrirPainel = Notificacoes.abrirPainel.bind(Notificacoes);
    Notificacoes.abrirPainel = function() {
      const result = originalAbrirPainel();
      const title = document.querySelector('#notif-modal .modal-title > div > div:first-child');
      const subtitle = document.querySelector('#notif-modal .modal-title > div > div:nth-child(2)');
      if (title) title.textContent = 'Central de Alertas e Demandas';
      if (subtitle) subtitle.textContent = `${this._alertasTemp?.length || 0} aviso(s) ativo(s) no sistema`;
      return result;
    };
  }

  // O total do contrato é derivado de CUB × metragem. Impede geração de contrato
  // com CUB/área zerados, inclusive quando o CUB fixo está readonly.
  if (typeof Contratos !== 'undefined') {
    const originalSubmit = Contratos.salvarContratoSubmit.bind(Contratos);
    Contratos.salvarContratoSubmit = function() {
      const cubEl = document.getElementById('ct-cub');
      const areaEl = document.getElementById('ct-area');
      if (cubEl) {
        const cub = Number(cubEl.value || 0);
        const area = Number(areaEl?.value || 0);
        if (!(cub > 0)) {
          if (typeof Utils !== 'undefined') Utils.toast('Informe um CUB maior que zero antes de gerar o contrato.', 'warning');
          cubEl.focus();
          return;
        }
        if (!(area > 0)) {
          if (typeof Utils !== 'undefined') Utils.toast('Informe uma metragem maior que zero antes de gerar o contrato.', 'warning');
          areaEl?.focus();
          return;
        }
        Patch51.recalculateContract();
      }
      return originalSubmit();
    };
  }
})();
