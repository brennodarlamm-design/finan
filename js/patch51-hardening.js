/* PATCH 51 — hardening de validação de formulário e UX do workflow. */
(() => {
  if (typeof Patch51 === 'undefined') return;

  // /api/users limita a listagem para usuários sem gestão de contas. O workflow,
  // porém, precisa da lista mínima de responsáveis ativos do tenant para atribuição.
  Patch51.loadUsers = async function() {
    try {
      const data = await this.api('users');
      this._users = Array.isArray(data.users) ? data.users : [];
    } catch (err) {
      console.warn('[Patch51] Responsáveis indisponíveis:', err?.message || err);
      this._users = this._users || [];
    }
    return this._users;
  };

  // Responsável técnico: interno = seleção obrigatória de usuário ativo;
  // externo = nome + CREA/CAU obrigatórios. O backend repete as validações.
  const originalEnhanceObraForm = Patch51.enhanceObraForm.bind(Patch51);
  Patch51.enhanceObraForm = async function(id) {
    await originalEnhanceObraForm(id);
    const form = document.getElementById('f-cli');
    if (!form) return;

    const typeEl = form.querySelector('[name="responsavel_tecnico_tipo"]');
    const internalEl = form.querySelector('[name="responsavel_tecnico_usuario_id"]');
    const externalName = form.querySelector('[name="responsavel_tecnico_nome"]');
    const externalReg = form.querySelector('[name="responsavel_tecnico_registro"]');

    const syncRequired = () => {
      const internal = typeEl?.value === 'interno';
      if (internalEl) internalEl.required = internal;
      if (externalName) externalName.required = !internal;
      if (externalReg) externalReg.required = !internal;
      if (internalEl) internalEl.setAttribute('aria-required', internal ? 'true' : 'false');
      if (externalName) externalName.setAttribute('aria-required', internal ? 'false' : 'true');
      if (externalReg) externalReg.setAttribute('aria-required', internal ? 'false' : 'true');
    };

    typeEl?.addEventListener('change', syncRequired);
    syncRequired();
  };

  // Evita exceção escapar do clique quando alguém tenta reduzir o SLA.
  if (typeof Configuracoes !== 'undefined') {
    Configuracoes.salvarSlasEmpresa = () => {
      try {
        const form = document.getElementById('form-slas-empresa');
        if (!form) return;
        const old = CronogramaSLA.getSlasEmpresa();
        const updated = old.map(s => {
          const input = form.querySelector(`[name="sla_dias_${CSS.escape(s.id)}"]`);
          const next = Number.parseInt(input?.value, 10) || Number(s.dias_sla) || 1;
          if (next < Number(s.dias_sla || 1)) throw new Error(`${s.nome}: o SLA só pode ser aumentado.`);
          const select = form.querySelector(`.p51-sla-user[data-stage="${CSS.escape(s.id)}"]`);
          const user = Patch51._users.find(u => String(u.id) === String(select?.value || ''));
          return {
            ...s,
            dias_sla:next,
            responsavel_user_id:user?.id || null,
            responsavel_nome:user?.nome || '',
            responsavel_perfil:user?.perfil || ''
          };
        });
        if (!CronogramaSLA.saveSlasEmpresa(updated)) throw new Error('Não foi possível salvar os SLAs.');
        Utils.toast('SLAs e responsáveis atualizados.', 'success');
      } catch (err) {
        Utils.toast(err?.message || 'Não foi possível salvar os SLAs.', 'warning');
      }
    };
  }

  const dateFmt = value => {
    if (!value) return '—';
    const d = new Date(value);
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

  const eventLabel = event => ({
    atribuida:'Etapa atribuída',
    concluida:'Etapa concluída',
    ajustada:'Etapa ajustada',
    aguardando_responsavel:'Aguardando responsável'
  })[event] || String(event || 'Atualização');

  const enhanceWorkflowView = obraId => {
    const host = document.getElementById('p51-workflow-host');
    const data = Patch51._workflow.get(String(obraId));
    if (!host || !data?.stages) return;

    const stages = data.stages || [];
    const history = data.history || [];
    const manager = Patch51.isManager();

    // Etapa sem responsável nunca oferece o botão "Pronto"; o gestor precisa atribuí-la primeiro.
    for (const stage of stages) {
      const key = CSS.escape(String(stage.etapa_id || ''));
      const button = host.querySelector(`.p51-stage-complete[data-stage="${key}"]`);
      if (stage.status === 'em_andamento' && !stage.responsavel_user_id) button?.remove();

      const anchor = host.querySelector(`.p51-stage-days[data-stage="${key}"]`) || host.querySelector(`.p51-stage-complete[data-stage="${key}"]`);
      const card = anchor?.closest('.card');
      if (!card || card.dataset.p51Enhanced === '1') continue;
      card.dataset.p51Enhanced = '1';
      card.dataset.stage = String(stage.etapa_id || '');

      const detail = card.querySelector('div[style*="font-size:.76rem"]');
      const deadline = deadlineFor(stage);
      if (detail) {
        const overdue = deadline && stage.status !== 'concluido' && deadline.getTime() < Date.now();
        detail.insertAdjacentHTML('beforeend', ` · 📅 Prazo: <span style="${overdue ? 'color:var(--danger);font-weight:800;' : ''}">${Patch51.esc(dateFmt(deadline))}</span>`);
      }

      const actions = card.querySelector('div[style*="justify-content:flex-end"]');
      if (actions) {
        const docs = document.createElement('button');
        docs.type = 'button';
        docs.className = 'btn btn-secondary btn-sm p51-stage-docs';
        docs.textContent = '📎 Documentos';
        docs.title = 'Abrir a documentação vinculada a esta obra';
        docs.addEventListener('click', () => {
          if (typeof ObraDetalhe !== 'undefined') ObraDetalhe.setTab('documentos');
        });
        actions.prepend(docs);
      }

      if (manager && stage.status !== 'concluido') {
        const body = card.querySelector('div[style*="flex:1;min-width"]');
        if (body) {
          const note = document.createElement('div');
          note.style.cssText = 'margin-top:9px;';
          note.innerHTML = `<label style="font-size:.7rem;color:var(--text3);font-weight:800;display:block;margin-bottom:4px;">ORIENTAÇÕES / OBSERVAÇÕES DA ETAPA</label><textarea class="form-control p51-stage-note" data-stage="${Patch51.esc(stage.etapa_id)}" rows="2" maxlength="4000" placeholder="Instruções específicas, pendências ou observações para o responsável...">${Patch51.esc(stage.observacoes || '')}</textarea>`;
          body.appendChild(note);
        }
      }
    }

    // Visão Kanban compacta do processo.
    if (!host.querySelector('#p51-workflow-board')) {
      const header = host.querySelector('.g4');
      const board = document.createElement('div');
      board.id = 'p51-workflow-board';
      board.className = 'card';
      board.style.cssText = 'padding:14px;margin-bottom:16px;';
      const columns = [
        ['pendente','Pendente'],
        ['em_andamento','Em andamento'],
        ['bloqueado','Bloqueada'],
        ['concluido','Concluída']
      ];
      board.innerHTML = `<div style="font-size:.78rem;font-weight:900;margin-bottom:10px;">Visão do Processo</div><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;overflow-x:auto;">${columns.map(([status,label]) => {
        const items = stages.filter(s => s.status === status);
        return `<div style="min-width:150px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:9px;"><div style="font-size:.68rem;color:var(--text3);font-weight:900;text-transform:uppercase;margin-bottom:7px;">${label} · ${items.length}</div>${items.map(s => `<div style="font-size:.72rem;background:var(--bg-card);border:1px solid var(--border-s);padding:7px;border-radius:6px;margin-bottom:5px;"><strong>${Patch51.esc(s.nome)}</strong><div style="color:var(--text3);margin-top:3px;">${Patch51.esc(s.responsavel_nome || 'Sem responsável')}</div></div>`).join('') || '<span style="font-size:.7rem;color:var(--text3);">Nenhuma</span>'}</div>`;
      }).join('')}</div>`;
      header?.insertAdjacentElement('afterend', board);
    }

    // Histórico/timeline: quem recebeu, quem concluiu e quando.
    if (!host.querySelector('#p51-workflow-history')) {
      const timeline = document.createElement('div');
      timeline.id = 'p51-workflow-history';
      timeline.className = 'card';
      timeline.style.cssText = 'padding:14px;margin-top:16px;';
      timeline.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;"><strong style="font-size:.82rem;">🕘 Histórico do Workflow</strong><span style="font-size:.7rem;color:var(--text3);">${history.length} evento(s)</span></div><div style="display:flex;flex-direction:column;gap:8px;">${history.slice(0,50).map(h => {
        const stage = stages.find(s => String(s.etapa_id) === String(h.etapa_id));
        return `<div style="display:flex;gap:10px;align-items:flex-start;border-left:2px solid var(--border);padding-left:10px;"><div style="flex:1;"><strong style="font-size:.76rem;">${Patch51.esc(eventLabel(h.evento))}</strong><div style="font-size:.72rem;color:var(--text2);margin-top:2px;">${Patch51.esc(stage?.nome || h.etapa_id || '')}${h.responsavel_user_id ? ` · responsável ${Patch51.esc(stage?.responsavel_nome || h.responsavel_user_id)}` : ''}</div></div><time style="font-size:.68rem;color:var(--text3);white-space:nowrap;">${Patch51.esc(dateFmt(h.created_at))}</time></div>`;
      }).join('') || '<div style="font-size:.74rem;color:var(--text3);">Ainda não há movimentações registradas.</div>'}</div>`;
      host.appendChild(timeline);
    }
  };

  const originalRenderWorkflowInto = Patch51.renderWorkflowInto.bind(Patch51);
  Patch51.renderWorkflowInto = function(obraId) {
    originalRenderWorkflowInto(obraId);
    enhanceWorkflowView(obraId);
  };

  // Salva responsável, SLA e observações da etapa em uma única ação.
  Patch51.saveStageConfig = async function(obraId, etapaId) {
    const host = document.getElementById('p51-workflow-host');
    const key = CSS.escape(String(etapaId || ''));
    const user = host?.querySelector(`.p51-stage-user[data-stage="${key}"]`)?.value || '';
    const days = Number(host?.querySelector(`.p51-stage-days[data-stage="${key}"]`)?.value || 0);
    const note = host?.querySelector(`.p51-stage-note[data-stage="${key}"]`)?.value || '';
    try {
      const data = await this.api('stage_update', { method:'POST', body:{ obraId, etapaId, responsavel_user_id:user || null, dias_sla:days, observacoes:note } });
      this.applyForecastLocal(obraId, data.data_previsao, data.total_dias);
      Utils.toast('Etapa atualizada.', 'success');
      await this.loadWorkflow(obraId, { initialize:false });
    } catch (err) {
      Utils.toast(err?.message || 'Não foi possível atualizar a etapa.', 'warning');
    }
  };
})();
