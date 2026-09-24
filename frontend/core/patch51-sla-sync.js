/* PATCH 51 — projeção do estado oficial do Workflow na linha do tempo de SLA. */
(() => {
  if (typeof Patch51 === 'undefined' || typeof CronogramaSLA === 'undefined') return;

  const dateOnly = value => value ? String(value).slice(0, 10) : '';
  const statusMap = Object.freeze({
    pendente:'pendente',
    bloqueado:'pendente',
    em_andamento:'em_andamento',
    concluido:'concluido'
  });

  // O workflow no servidor é a fonte de verdade para responsável/status/SLA. A
  // timeline antiga continua sendo reaproveitada apenas como visualização/cálculo.
  const legacyGetObraProcessos = CronogramaSLA.getObraProcessos.bind(CronogramaSLA);
  CronogramaSLA.getObraProcessos = function(obraId) {
    const legacy = legacyGetObraProcessos(obraId) || [];
    const workflow = Patch51._workflow.get(String(obraId || ''));
    if (!workflow?.stages?.length) return legacy;

    const stages = new Map(workflow.stages.map(stage => [String(stage.etapa_id), stage]));
    const merged = legacy.map(processo => {
      const stage = stages.get(String(processo.id));
      if (!stage) return processo;
      return {
        ...processo,
        dias_sla:Number(stage.dias_sla) || Number(processo.dias_sla) || 1,
        status:statusMap[stage.status] || processo.status || 'pendente',
        observacoes:String(stage.observacoes || processo.observacoes || ''),
        data_inicio_real:dateOnly(stage.started_at) || processo.data_inicio_real || '',
        data_fim_real:dateOnly(stage.completed_at) || processo.data_fim_real || ''
      };
    });

    const obra = typeof DB !== 'undefined' ? DB.getById('clientes', obraId) : null;
    return this.calcularCascata(merged, obra?.data_inicio || null);
  };

  // Ao abrir Prazos & SLAs, busca o workflow atualizado antes de consolidar a
  // timeline. Assim uma conclusão feita por outro usuário aparece sem depender
  // de recarregar a página inteira.
  if (typeof ObraDetalhe !== 'undefined') {
    const currentSetTab = ObraDetalhe.setTab.bind(ObraDetalhe);
    ObraDetalhe.setTab = function(tab) {
      const result = currentSetTab(tab);
      if (tab !== 'slas') return result;

      const obraId = this.currentObraId || (typeof App !== 'undefined' ? App.obraId : null);
      if (!obraId) return result;

      Patch51.loadWorkflow(obraId, { initialize:true }).then(data => {
        if (!data?.stages || this.activeTab !== 'slas' || String(this.currentObraId || '') !== String(obraId)) return;
        // Usa o setter capturado (não este wrapper) para evitar recursão/fetch em loop.
        currentSetTab('slas');
      }).catch(() => {});
      return result;
    };
  }
})();
