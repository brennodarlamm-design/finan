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

  // Etapa sem responsável nunca oferece o botão "Pronto"; o gestor precisa atribuí-la primeiro.
  const originalRenderWorkflowInto = Patch51.renderWorkflowInto.bind(Patch51);
  Patch51.renderWorkflowInto = function(obraId) {
    originalRenderWorkflowInto(obraId);
    const host = document.getElementById('p51-workflow-host');
    const data = Patch51._workflow.get(String(obraId));
    if (!host || !data?.stages) return;
    for (const stage of data.stages) {
      if (stage.status !== 'em_andamento' || stage.responsavel_user_id) continue;
      const button = host.querySelector(`.p51-stage-complete[data-stage="${CSS.escape(String(stage.etapa_id || ''))}"]`);
      button?.remove();
    }
  };
})();
