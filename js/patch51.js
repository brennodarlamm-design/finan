/* PATCH 51 — Workflow, Central de Obras, SLA, Responsável Técnico e CUB
 * Mantido em módulo isolado para reduzir risco de regressão nos módulos legados.
 */
const Patch51 = {
  _users: [],
  _settings: null,
  _workflow: new Map(),
  _metaReady: false,
  _myTasks: [],
  _pollTimer: null,
  _installed: false,

  esc(value) {
    if (typeof Utils !== 'undefined' && Utils.escapeHtml) return Utils.escapeHtml(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },

  authHeaders() {
    if (typeof Auth !== 'undefined' && Auth.getAuthHeaders) return Auth.getAuthHeaders();
    return (typeof DB !== 'undefined' && DB._apiHeaders) ? DB._apiHeaders() : { 'Content-Type':'application/json' };
  },

  async api(action, { method='GET', body=null, params={} } = {}) {
    const query = new URLSearchParams({ action:`workflow_${action}`, ...params });
    const options = { method, headers:this.authHeaders() };
    if (body !== null) options.body = JSON.stringify({ action:`workflow_${action}`, ...body });
    const res = await fetch(`/api/audit?${query.toString()}`, { ...options, signal: AbortSignal.timeout(15000) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const err = new Error(json.error || `Falha no Patch 51 (HTTP ${res.status})`);
      err.code = json.code || `HTTP_${res.status}`;
      err.status = res.status;
      throw err;
    }
    return json;
  },

  currentUserId() {
    const u = typeof Auth !== 'undefined' && Auth.getUser ? Auth.getUser() : null;
    return String(u?.userId || u?.id || '');
  },

  isManager() {
    const role = String((typeof Auth !== 'undefined' && Auth.getUser ? Auth.getUser()?.perfil : '') || '').toLowerCase();
    return ['superadmin','admin','gestor'].includes(role);
  },

  _dateOnly(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  },

  async loadUsers() {
    try {
      const res = await fetch('/api/users', { headers:this.authHeaders(), signal: AbortSignal.timeout(15000) });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && Array.isArray(json.users)) {
        this._users = json.users.filter(u => u.ativo !== false);
      }
    } catch (err) {
      console.warn('[Patch51] Usuários indisponíveis:', err?.message || err);
    }
    return this._users;
  },

  async loadSettings() {
    try {
      const data = await this.api('settings');
      this._settings = data.settings || { cub_modo:'fixo', cub_valor:0, contract_clauses:[] };
    } catch (err) {
      if (err.code !== 'PATCH51_SCHEMA_NOT_READY') console.warn('[Patch51] Configurações indisponíveis:', err?.message || err);
      this._settings = this._settings || { cub_modo:'fixo', cub_valor:0, contract_clauses:[] };
    }
    return this._settings;
  },

  async loadObraMeta() {
    try {
      const data = await this.api('meta_list');
      const rows = Array.isArray(data.data) ? data.data : [];
      const obras = (typeof DB !== 'undefined' ? DB.getAll('clientes') : []) || [];
      let changed = false;
      for (const row of rows) {
        const idx = obras.findIndex(o => String(o.id) === String(row.obra_id));
        if (idx < 0) continue;
        const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
        obras[idx] = {
          ...obras[idx], ...payload,
          rg:row.rg || payload.rg || '',
          orgao_expedidor:row.orgao_expedidor || payload.orgao_expedidor || '',
          data_nascimento:this._dateOnly(row.data_nascimento) || payload.data_nascimento || '',
          responsavel_tecnico_tipo:row.responsavel_tecnico_tipo || payload.responsavel_tecnico_tipo || 'externo',
          responsavel_tecnico_usuario_id:row.responsavel_tecnico_usuario_id || payload.responsavel_tecnico_usuario_id || '',
          responsavel_tecnico_nome:row.responsavel_tecnico_nome || payload.responsavel_tecnico_nome || '',
          responsavel_tecnico_registro:row.responsavel_tecnico_registro || payload.responsavel_tecnico_registro || '',
          subtitulo_capa:row.subtitulo_capa || payload.subtitulo_capa || ''
        };
        if (row.responsavel_tecnico_nome) {
          obras[idx].engenheiro_responsavel = [row.responsavel_tecnico_nome, row.responsavel_tecnico_registro].filter(Boolean).join(' — ');
        }
        changed = true;
      }
      if (changed && typeof DB !== 'undefined') DB.save('clientes', obras);
      this._metaReady = true;
      return rows;
    } catch (err) {
      if (err.code !== 'PATCH51_SCHEMA_NOT_READY') console.warn('[Patch51] Cadastro geral complementar indisponível:', err?.message || err);
      return [];
    }
  },

  async saveObraMeta(obraId, values) {
    const meta = {
      rg:values.rg || '',
      orgao_expedidor:values.orgao_expedidor || '',
      data_nascimento:values.data_nascimento || '',
      responsavel_tecnico_tipo:values.responsavel_tecnico_tipo || 'externo',
      responsavel_tecnico_usuario_id:values.responsavel_tecnico_usuario_id || '',
      responsavel_tecnico_nome:values.responsavel_tecnico_nome || '',
      responsavel_tecnico_registro:values.responsavel_tecnico_registro || '',
      subtitulo_capa:values.subtitulo_capa || '',
      payload:values
    };
    const delays = [0, 550, 1200, 2200];
    let lastErr;
    for (const delay of delays) {
      if (delay) await new Promise(r => setTimeout(r, delay));
      try {
        const result = await this.api('meta_save', { method:'POST', body:{ obraId, meta } });
        const row = result.meta;
        const obra = DB.getById('clientes', obraId);
        if (obra && row) {
          const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
          const merged = {
            ...obra, ...payload,
            rg:row.rg || '', orgao_expedidor:row.orgao_expedidor || '',
            data_nascimento:this._dateOnly(row.data_nascimento),
            responsavel_tecnico_tipo:row.responsavel_tecnico_tipo || 'externo',
            responsavel_tecnico_usuario_id:row.responsavel_tecnico_usuario_id || '',
            responsavel_tecnico_nome:row.responsavel_tecnico_nome || '',
            responsavel_tecnico_registro:row.responsavel_tecnico_registro || '',
            subtitulo_capa:row.subtitulo_capa || ''
          };
          if (row.responsavel_tecnico_nome) merged.engenheiro_responsavel = [row.responsavel_tecnico_nome, row.responsavel_tecnico_registro].filter(Boolean).join(' — ');
          const all = DB.getAll('clientes');
          const idx = all.findIndex(o => String(o.id) === String(obraId));
          if (idx >= 0) { all[idx] = merged; DB.save('clientes', all); }
        }
        return result;
      } catch (err) {
        lastErr = err;
        if (err.code !== 'OBRA_NOT_FOUND') break;
      }
    }
    throw lastErr || new Error('Não foi possível salvar o Cadastro Geral.');
  },

  workflowTemplate(obraId) {
    const slas = (typeof CronogramaSLA !== 'undefined' ? CronogramaSLA.getSlasEmpresa() : []) || [];
    const obra = DB.getById('clientes', obraId) || {};
    const rtId = obra.responsavel_tecnico_tipo === 'interno' ? String(obra.responsavel_tecnico_usuario_id || '') : '';
    const rtUser = this._users.find(u => String(u.id) === rtId);
    return slas.map((s, index) => {
      let responsibleId = s.responsavel_user_id || '';
      let responsibleName = s.responsavel_nome || '';
      let responsibleProfile = s.responsavel_perfil || '';
      // Se o template ainda não foi configurado, o RT interno assume as etapas de projeto como fallback seguro.
      if (!responsibleId && rtUser && (index === 0 || s.tipo === 'projeto')) {
        responsibleId = rtUser.id;
        responsibleName = rtUser.nome;
        responsibleProfile = rtUser.perfil;
      }
      return {
        ...s,
        ordem:index,
        responsavel_user_id:responsibleId || null,
        responsavel_nome:responsibleName || null,
        responsavel_perfil:responsibleProfile || null
      };
    });
  },

  async initializeWorkflow(obraId, silent = false) {
    const delays = [0, 600, 1400, 2600];
    let lastErr;
    for (const delay of delays) {
      if (delay) await new Promise(r => setTimeout(r, delay));
      try {
        const data = await this.api('initialize', { method:'POST', body:{ obraId, stages:this.workflowTemplate(obraId) } });
        this._workflow.set(String(obraId), { stages:data.stages || [], history:[] });
        this.applyForecastLocal(obraId, data.data_previsao, data.total_dias);
        return data;
      } catch (err) {
        lastErr = err;
        if (err.code !== 'OBRA_NOT_FOUND') break;
      }
    }
    if (!silent && lastErr?.code !== 'PATCH51_SCHEMA_NOT_READY') Utils?.toast?.(lastErr?.message || 'Não foi possível iniciar o workflow.', 'warning');
    throw lastErr || new Error('Falha ao iniciar workflow.');
  },

  applyForecastLocal(obraId, dataPrevisao, totalDias) {
    const obra = DB.getById('clientes', obraId);
    if (!obra) return;
    const date = this._dateOnly(dataPrevisao);
    const all = DB.getAll('clientes');
    const idx = all.findIndex(o => String(o.id) === String(obraId));
    if (idx < 0) return;
    all[idx] = { ...all[idx], data_previsao:date || all[idx].data_previsao || '', data_previsao_termino:date || all[idx].data_previsao_termino || '', sla_total_dias:Number(totalDias || 0) };
    DB.save('clientes', all);
  },

  async loadWorkflow(obraId, { initialize=true } = {}) {
    try {
      let data = await this.api('list', { params:{ obraId } });
      if (initialize && (!data.stages || !data.stages.length)) {
        await this.initializeWorkflow(obraId, true);
        data = await this.api('list', { params:{ obraId } });
      }
      this._workflow.set(String(obraId), { stages:data.stages || [], history:data.history || [] });
      this.renderWorkflowInto(obraId);
      return data;
    } catch (err) {
      const host = document.getElementById('p51-workflow-host');
      if (host) host.innerHTML = `<div class="empty-state"><h3>Workflow indisponível</h3><p>${this.esc(err.message)}</p></div>`;
      return null;
    }
  },

  _statusLabel(status) {
    return ({ pendente:'Pendente', em_andamento:'Em andamento', concluido:'Concluída', bloqueado:'Bloqueada' })[status] || status || 'Pendente';
  },

  workflowShell(obraId) {
    setTimeout(() => this.loadWorkflow(obraId), 0);
    return `<div id="p51-workflow-host" data-obra-id="${this.esc(obraId)}"><div style="padding:34px;text-align:center;color:var(--text3);">Carregando workflow da obra…</div></div>`;
  },

  renderWorkflowInto(obraId) {
    const host = document.getElementById('p51-workflow-host');
    if (!host || String(host.dataset.obraId) !== String(obraId)) return;
    const data = this._workflow.get(String(obraId)) || { stages:[], history:[] };
    const stages = data.stages || [];
    const current = stages.find(s => s.status === 'em_andamento') || null;
    const done = stages.filter(s => s.status === 'concluido').length;
    const totalDays = stages.reduce((sum,s) => sum + (Number(s.dias_sla)||0), 0);
    const pct = stages.length ? Math.round(done / stages.length * 100) : 0;
    const uid = this.currentUserId();
    const users = this._users;
    const manager = this.isManager();

    host.innerHTML = `
      <div class="page-header" style="margin-bottom:16px;">
        <div><h2 style="margin:0;font-size:1.08rem;">🔁 Workflow da Obra</h2><p style="margin:4px 0 0;color:var(--text3);font-size:.8rem;">Cada responsável recebe sua etapa, executa a atividade e marca como pronta para transferir automaticamente à próxima pessoa.</p></div>
      </div>
      <div class="g4" style="margin-bottom:16px;">
        <div class="card" style="padding:14px;"><div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;">Etapa atual</div><strong style="display:block;margin-top:4px;">${this.esc(current?.nome || 'Fluxo finalizado')}</strong></div>
        <div class="card" style="padding:14px;"><div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;">Responsável</div><strong style="display:block;margin-top:4px;">${this.esc(current?.responsavel_nome || 'Não definido')}</strong></div>
        <div class="card" style="padding:14px;"><div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;">SLA total</div><strong style="display:block;margin-top:4px;">${totalDays} dias</strong></div>
        <div class="card" style="padding:14px;"><div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;">Progresso</div><strong style="display:block;margin-top:4px;">${done}/${stages.length} · ${pct}%</strong></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${stages.map((s,index) => {
          const active = s.status === 'em_andamento';
          const canComplete = active && (!s.responsavel_user_id || String(s.responsavel_user_id) === uid || manager);
          const canManage = manager && s.status !== 'concluido';
          return `<div class="card" style="padding:14px;border-left:4px solid ${s.status==='concluido'?'var(--accent)':active?'var(--warning)':'var(--border)'};">
            <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;">
              <div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);font-weight:900;">${index+1}</div>
              <div style="flex:1;min-width:240px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><strong>${this.esc(s.icone || '📋')} ${this.esc(s.nome)}</strong><span class="badge ${s.status==='concluido'?'badge-success':''}">${this.esc(this._statusLabel(s.status))}</span></div>
                <div style="font-size:.78rem;color:var(--text3);margin-top:5px;line-height:1.45;">${this.esc(s.descricao || 'Sem instruções adicionais.')}</div>
                <div style="font-size:.76rem;color:var(--text2);margin-top:7px;">👤 ${this.esc(s.responsavel_nome || 'Sem responsável definido')} · ⏱ ${Number(s.dias_sla)||0} dias</div>
              </div>
              <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                ${canManage ? `<select class="form-control p51-stage-user" data-stage="${this.esc(s.etapa_id)}" style="width:180px;padding:6px 8px;"><option value="">Sem responsável</option>${users.map(u=>`<option value="${this.esc(u.id)}" ${String(u.id)===String(s.responsavel_user_id||'')?'selected':''}>${this.esc(u.nome)}</option>`).join('')}</select><input type="number" min="${Number(s.dias_sla)||1}" max="365" value="${Number(s.dias_sla)||1}" class="form-control p51-stage-days" data-stage="${this.esc(s.etapa_id)}" style="width:82px;padding:6px 8px;"><button type="button" class="btn btn-secondary btn-sm p51-stage-save" data-stage="${this.esc(s.etapa_id)}">Salvar</button>`:''}
                ${canComplete ? `<button type="button" class="btn btn-primary btn-sm p51-stage-complete" data-stage="${this.esc(s.etapa_id)}">✓ Marcar como pronto</button>`:''}
              </div>
            </div>
          </div>`;
        }).join('') || '<div class="empty-state"><h3>Nenhuma etapa configurada</h3></div>'}
      </div>`;

    host.querySelectorAll('.p51-stage-complete').forEach(btn => btn.addEventListener('click', () => this.completeStage(obraId, btn.dataset.stage)));
    host.querySelectorAll('.p51-stage-save').forEach(btn => btn.addEventListener('click', () => this.saveStageConfig(obraId, btn.dataset.stage)));
  },

  async saveStageConfig(obraId, etapaId) {
    const host = document.getElementById('p51-workflow-host');
    const user = host?.querySelector(`.p51-stage-user[data-stage="${CSS.escape(etapaId)}"]`)?.value || '';
    const days = Number(host?.querySelector(`.p51-stage-days[data-stage="${CSS.escape(etapaId)}"]`)?.value || 0);
    try {
      const data = await this.api('stage_update', { method:'POST', body:{ obraId, etapaId, responsavel_user_id:user || null, dias_sla:days } });
      this.applyForecastLocal(obraId, data.data_previsao, data.total_dias);
      Utils.toast('Etapa atualizada.', 'success');
      await this.loadWorkflow(obraId, { initialize:false });
    } catch (err) {
      Utils.toast(err.message, 'warning');
    }
  },

  async completeStage(obraId, etapaId) {
    try {
      const data = await this.api('complete', { method:'POST', body:{ obraId, etapaId } });
      this.applyForecastLocal(obraId, data.data_previsao, data.total_dias);
      const next = data.result?.next_stage;
      Utils.toast(next ? `Etapa concluída. Próxima: ${next.nome || 'etapa seguinte'}.` : 'Workflow concluído!', 'success');
      await this.loadWorkflow(obraId, { initialize:false });
      await this.loadMyTasks(true);
    } catch (err) {
      Utils.toast(err.message, 'warning');
    }
  },

  async loadMyTasks(silent = false) {
    try {
      const data = await this.api('my');
      const next = Array.isArray(data.tasks) ? data.tasks : [];
      const previousIds = new Set(this._myTasks.map(t => `${t.obra_id}:${t.etapa_id}`));
      const newTasks = next.filter(t => !previousIds.has(`${t.obra_id}:${t.etapa_id}`));
      this._myTasks = next;
      this.updateTaskBadge();
      if (!silent && newTasks.length) {
        const first = newTasks[0];
        Utils.toast(`Nova etapa para você: ${first.nome} — ${first.obra_nome}`, 'info');
      }
      return next;
    } catch (err) {
      if (!silent && err.code !== 'PATCH51_SCHEMA_NOT_READY') console.warn('[Patch51] Minhas etapas:', err?.message || err);
      return [];
    }
  },

  updateTaskBadge() {
    const btn = document.getElementById('p51-my-tasks-nav');
    if (!btn) return;
    let badge = btn.querySelector('.p51-task-badge');
    if (this._myTasks.length) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-badge p51-task-badge';
        badge.style.cssText = 'background:#f59e0b;color:#182713;font-weight:900;';
        btn.appendChild(badge);
      }
      badge.textContent = String(this._myTasks.length);
    } else badge?.remove();
  },

  async openMyTasks() {
    const tasks = await this.loadMyTasks(true);
    Utils.showModal(`<div class="modal" style="max-width:780px;width:95vw;"><div class="modal-header"><span class="modal-title">📌 Minhas Etapas</span><button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button></div><div class="modal-body"><p style="font-size:.82rem;color:var(--text3);">Aqui aparecem somente as etapas que estão sob sua responsabilidade agora.</p><div style="display:flex;flex-direction:column;gap:10px;margin-top:14px;">${tasks.map(t=>`<div class="card" style="padding:14px;"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;"><div><strong>${this.esc(t.nome)}</strong><div style="font-size:.78rem;color:var(--text3);margin-top:4px;">${this.esc(t.obra_nome)} · SLA ${Number(t.dias_sla)||0} dias</div><div style="font-size:.76rem;color:var(--text2);margin-top:5px;">${this.esc(t.descricao || '')}</div></div><div style="display:flex;gap:6px;"><button class="btn btn-secondary btn-sm p51-open-work" data-obra="${this.esc(t.obra_id)}">Abrir Central</button><button class="btn btn-primary btn-sm p51-task-complete" data-obra="${this.esc(t.obra_id)}" data-stage="${this.esc(t.etapa_id)}">✓ Pronto</button></div></div></div>`).join('') || '<div class="empty-state"><h3>Nenhuma etapa pendente para você 🎉</h3></div>'}</div></div></div>`);
    document.querySelectorAll('.p51-open-work').forEach(btn => btn.addEventListener('click', () => {
      Utils.closeModal();
      App.obraId = btn.dataset.obra;
      App.navigate('obra-detalhe');
      setTimeout(() => { if (typeof ObraDetalhe !== 'undefined') ObraDetalhe.setTab('workflow'); }, 120);
    }));
    document.querySelectorAll('.p51-task-complete').forEach(btn => btn.addEventListener('click', async () => {
      await this.completeStage(btn.dataset.obra, btn.dataset.stage);
      Utils.closeModal();
      this.openMyTasks();
    }));
  },

  injectMyTasksNav() {
    if (document.getElementById('p51-my-tasks-nav')) { this.updateTaskBadge(); return; }
    const obrasBtn = document.querySelector('.sidebar-nav [data-route="obras"]');
    if (!obrasBtn) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-item';
    btn.id = 'p51-my-tasks-nav';
    btn.innerHTML = '<span>📌</span><span>Minhas Etapas</span>';
    btn.addEventListener('click', () => this.openMyTasks());
    obrasBtn.insertAdjacentElement('afterend', btn);
    this.updateTaskBadge();
  },

  cleanSidebar() {
    document.querySelectorAll('.sidebar-nav [data-route="documentacao"], .sidebar-nav [data-route="portal-cliente"]').forEach(el => el.remove());
    this.injectMyTasksNav();
  },

  removePortalFromObraCards() {
    if (App?.route !== 'obras' && App?.route !== 'clientes') return;
    document.querySelectorAll('#cli-grid [data-fb-click="PortalCliente.abrirModalCompartilhar"]').forEach(btn => btn.remove());
  },

  enhanceCentral() {
    if (App?.route !== 'obra-detalhe') return;
    const tabWrap = document.querySelector('.obra-tabs, [class*="obra-tabs"]') || document.querySelector('[data-tab="orcado-realizado"]')?.parentElement;
    const sla = document.querySelector('[data-tab="slas"]');
    const first = document.querySelector('[data-tab="orcado-realizado"]');
    if (sla && first && sla.parentElement === first.parentElement) first.parentElement.insertBefore(sla, first);

    if (tabWrap && !tabWrap.querySelector('[data-tab="workflow"]')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.tab = 'workflow';
      btn.className = first?.className || 'obra-tab';
      btn.innerHTML = '🔁 Workflow';
      btn.addEventListener('click', () => ObraDetalhe.setTab('workflow'));
      if (sla?.nextSibling) sla.parentElement.insertBefore(btn, sla.nextSibling); else tabWrap.appendChild(btn);
    }
    this.enhanceSlaSummary();
  },

  enhanceSlaSummary() {
    if (App?.route !== 'obra-detalhe' || ObraDetalhe?.activeTab !== 'slas') return;
    if (document.getElementById('p51-total-sla')) return;
    const obraId = App.obraId;
    const procs = typeof CronogramaSLA !== 'undefined' ? CronogramaSLA.getObraProcessos(obraId) : [];
    const total = procs.reduce((s,p) => s + (Number(p.dias_sla)||0), 0);
    const cards = document.querySelector('#obra-tab-content .g4, #obra-tab-content .g3, #obra-tab-content [class^="g"]');
    if (!cards) return;
    const card = document.createElement('div');
    card.id = 'p51-total-sla';
    card.className = 'card';
    card.style.padding = '14px 18px';
    card.innerHTML = `<div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;font-weight:800;">Soma dos SLAs</div><div style="font-size:1.35rem;font-weight:900;margin-top:4px;">${total} dias</div>`;
    cards.appendChild(card);
  },

  async enhanceObraForm(id) {
    const form = document.getElementById('f-cli');
    if (!form || form.dataset.patch51 === '1') return;
    form.dataset.patch51 = '1';
    const obra = id ? (DB.getById('clientes', id) || {}) : {};

    const prediction = form.querySelector('[name="data_previsao_termino"]');
    const dateRow = prediction?.closest('.form-row');
    prediction?.closest('.form-group')?.remove();
    if (dateRow) { dateRow.classList.remove('cols-3'); dateRow.classList.add('cols-2'); }

    if (!id) {
      const status = form.querySelector('[name="status"]');
      if (status) {
        [...status.options].forEach(opt => { if (!['em_andamento','documentacao'].includes(opt.value)) opt.remove(); });
        if (!['em_andamento','documentacao'].includes(status.value)) status.value = 'em_andamento';
      }
    }

    const rtOld = form.querySelector('[name="engenheiro_responsavel"]')?.closest('.form-group');
    const holder = document.createElement('div');
    holder.innerHTML = `
      <div id="p51-cadastro-geral" style="border-top:1px solid var(--border);padding-top:14px;margin-top:6px;">
        <div style="font-size:.78rem;font-weight:900;color:var(--accent);text-transform:uppercase;margin-bottom:10px;">Cadastro Geral</div>
        <div class="form-row cols-3" style="margin-bottom:12px;">
          <div class="form-group"><label class="form-label">RG</label><input class="form-control" name="rg" value="${this.esc(obra.rg || '')}" placeholder="Número do RG"></div>
          <div class="form-group"><label class="form-label">Órgão Expedidor</label><input class="form-control" name="orgao_expedidor" value="${this.esc(obra.orgao_expedidor || '')}" placeholder="Ex: SSP/RR"></div>
          <div class="form-group"><label class="form-label">Data de Nascimento</label><input class="form-control" type="date" name="data_nascimento" value="${this.esc(this._dateOnly(obra.data_nascimento))}"></div>
        </div>
        <div class="form-group" style="margin-bottom:12px;"><label class="form-label">Subtítulo da Capa do Contrato</label><input class="form-control" name="subtitulo_capa" value="${this.esc(obra.subtitulo_capa || '')}" placeholder="Ex: CONTRATO ANTERIOR À CAIXA — MCMV"></div>
        <div class="form-row cols-2" style="margin-bottom:12px;">
          <div class="form-group"><label class="form-label">Responsável Técnico</label><select class="form-control" name="responsavel_tecnico_tipo" id="p51-rt-tipo"><option value="interno" ${obra.responsavel_tecnico_tipo==='interno'?'selected':''}>Interno</option><option value="externo" ${obra.responsavel_tecnico_tipo!=='interno'?'selected':''}>Externo</option></select></div>
          <div class="form-group" id="p51-rt-interno"><label class="form-label">Profissional Interno</label><select class="form-control" name="responsavel_tecnico_usuario_id" id="p51-rt-user"><option value="">Carregando usuários…</option></select></div>
        </div>
        <div class="form-row cols-2" id="p51-rt-externo" style="margin-bottom:12px;">
          <div class="form-group"><label class="form-label">Nome do Responsável Externo</label><input class="form-control" name="responsavel_tecnico_nome" value="${this.esc(obra.responsavel_tecnico_nome || '')}" placeholder="Nome completo"></div>
          <div class="form-group"><label class="form-label">CREA / CAU</label><input class="form-control" name="responsavel_tecnico_registro" value="${this.esc(obra.responsavel_tecnico_registro || '')}" placeholder="Registro profissional"></div>
        </div>
        <input type="hidden" name="engenheiro_responsavel" id="p51-engenheiro-legacy" value="${this.esc(obra.engenheiro_responsavel || '')}">
      </div>`;
    const block = holder.firstElementChild;
    if (rtOld) rtOld.replaceWith(block); else form.appendChild(block);

    const refreshRt = () => {
      const type = form.querySelector('[name="responsavel_tecnico_tipo"]')?.value || 'externo';
      const internal = form.querySelector('#p51-rt-interno');
      const external = form.querySelector('#p51-rt-externo');
      if (internal) internal.style.display = type === 'interno' ? '' : 'none';
      if (external) external.style.display = type === 'externo' ? '' : 'none';
    };
    form.querySelector('[name="responsavel_tecnico_tipo"]')?.addEventListener('change', refreshRt);
    refreshRt();

    await this.loadUsers();
    const select = form.querySelector('#p51-rt-user');
    if (select) {
      select.innerHTML = `<option value="">Selecione o profissional…</option>${this._users.map(u=>`<option value="${this.esc(u.id)}">${this.esc(u.nome)} — ${this.esc(u.perfil || 'usuário')}</option>`).join('')}`;
      select.value = String(obra.responsavel_tecnico_usuario_id || '');
    }
  },

  prepareLegacyRtField(form) {
    const type = form.querySelector('[name="responsavel_tecnico_tipo"]')?.value || 'externo';
    let label = '';
    if (type === 'interno') {
      const sel = form.querySelector('[name="responsavel_tecnico_usuario_id"]');
      const user = this._users.find(u => String(u.id) === String(sel?.value || ''));
      label = user?.nome || sel?.selectedOptions?.[0]?.textContent?.split(' — ')[0] || '';
    } else {
      const name = form.querySelector('[name="responsavel_tecnico_nome"]')?.value || '';
      const reg = form.querySelector('[name="responsavel_tecnico_registro"]')?.value || '';
      label = [name,reg].filter(Boolean).join(' — ');
    }
    const hidden = form.querySelector('#p51-engenheiro-legacy');
    if (hidden) hidden.value = label;
  },

  enhanceSettings() {
    if (App?.route !== 'configuracoes' || Configuracoes?._activeTab !== 'empresa') return;
    const content = document.getElementById('cfg-content');
    if (!content || document.getElementById('p51-cub-card')) return;
    const s = this._settings || { cub_modo:'fixo', cub_valor:0 };
    const card = document.createElement('div');
    card.id = 'p51-cub-card';
    card.className = 'card';
    card.style.cssText = 'margin-top:18px;max-width:960px;';
    card.innerHTML = `<div class="card-header"><div><div class="card-title">📐 CUB para Contratos</div><p style="font-size:.78rem;color:var(--text3);margin:3px 0 0;">Defina se o CUB é fixo para a empresa ou volante por contrato.</p></div></div><div style="padding:16px;"><div class="form-row cols-4"><div class="form-group"><label class="form-label">Modo</label><select class="form-control" id="p51-cub-mode"><option value="fixo" ${s.cub_modo==='fixo'?'selected':''}>Fixo</option><option value="volante" ${s.cub_modo==='volante'?'selected':''}>Volante</option></select></div><div class="form-group"><label class="form-label">CUB (R$/m²)</label><input class="form-control" id="p51-cub-value" type="number" step="0.01" min="0" value="${Number(s.cub_valor || 0)}"></div><div class="form-group"><label class="form-label">Referência</label><input class="form-control" id="p51-cub-ref" type="date" value="${this.esc(this._dateOnly(s.cub_referencia))}"></div><div class="form-group"><label class="form-label">UF</label><input class="form-control" id="p51-cub-uf" maxlength="2" value="${this.esc(s.cub_uf || '')}" placeholder="RR"></div></div><div style="display:flex;justify-content:flex-end;"><button type="button" class="btn btn-primary" id="p51-save-cub">💾 Salvar CUB</button></div></div>`;
    content.appendChild(card);
    card.querySelector('#p51-save-cub')?.addEventListener('click', () => this.saveCubSettings());
  },

  async saveCubSettings() {
    try {
      const body = {
        cub_modo:document.getElementById('p51-cub-mode')?.value || 'fixo',
        cub_valor:Number(document.getElementById('p51-cub-value')?.value || 0),
        cub_referencia:document.getElementById('p51-cub-ref')?.value || '',
        cub_uf:String(document.getElementById('p51-cub-uf')?.value || '').toUpperCase()
      };
      const data = await this.api('settings_save', { method:'POST', body });
      this._settings = data.settings;
      Utils.toast('Configuração do CUB salva.', 'success');
    } catch (err) { Utils.toast(err.message, 'warning'); }
  },

  enhanceSlaSettings() {
    if (App?.route !== 'configuracoes' || Configuracoes?._activeTab !== 'slas') return;
    const table = document.querySelector('#form-slas-empresa table');
    if (!table || table.dataset.patch51 === '1') return;
    table.dataset.patch51 = '1';
    const head = table.querySelector('thead tr');
    if (head) {
      const th = document.createElement('th'); th.textContent = 'Responsável Padrão'; head.appendChild(th);
    }
    const slas = CronogramaSLA.getSlasEmpresa();
    [...table.querySelectorAll('tbody tr')].forEach((tr,index) => {
      const sla = slas[index];
      if (!sla) return;
      const td = document.createElement('td');
      td.innerHTML = `<select class="form-control p51-sla-user" data-stage="${this.esc(sla.id)}" style="min-width:160px;padding:5px 8px;"><option value="">Sem responsável</option>${this._users.map(u=>`<option value="${this.esc(u.id)}" ${String(u.id)===String(sla.responsavel_user_id||'')?'selected':''}>${this.esc(u.nome)}</option>`).join('')}</select>`;
      tr.appendChild(td);
      const days = tr.querySelector(`[name="sla_dias_${CSS.escape(sla.id)}"]`);
      if (days) days.min = String(Number(sla.dias_sla)||1);
    });
  },

  enhanceContractModal() {
    const form = document.getElementById('f-contrato');
    if (!form || form.dataset.patch51 === '1') return;
    form.dataset.patch51 = '1';
    const existingId = form.querySelector('[name="id"]')?.value || '';
    const existing = existingId && typeof Contratos !== 'undefined' ? Contratos.getById(existingId) : null;
    const settings = this._settings || { cub_modo:'fixo', cub_valor:0 };
    const total = form.querySelector('#ct-valor');
    const area = form.querySelector('#ct-area');
    const oldM2 = form.querySelector('#ct-valor-m2');
    const row = total?.closest('.form-row');
    if (row && total && area) {
      row.innerHTML = `
        <div class="form-group"><label class="form-label">CUB (R$/m²) *</label><input class="form-control" type="number" step="0.01" min="0" name="cub_valor" id="ct-cub" value="${this.esc(existing?.cub_valor ?? settings.cub_valor ?? 0)}" ${settings.cub_modo==='fixo'?'readonly':''}></div>
        <div class="form-group"><label class="form-label">Área Construída (m²) *</label><input class="form-control" type="number" step="0.01" min="0" name="area_m2" id="ct-area" value="${this.esc(existing?.area_m2 || area.value || '40')}" required></div>
        <div class="form-group"><label class="form-label">Valor Total Calculado (R$)</label><input class="form-control" type="number" step="0.01" name="valor" id="ct-valor" value="${this.esc(existing?.valor || total.value || '0')}" readonly style="background:var(--bg-card);font-weight:800;color:var(--accent);"></div>
        <input type="hidden" name="valor_m2" id="ct-valor-m2" value="${this.esc(existing?.valor_m2 || oldM2?.value || '')}">
        <input type="hidden" name="cub_modo" value="${this.esc(settings.cub_modo || 'fixo')}">
        <input type="hidden" name="cub_referencia" value="${this.esc(this._dateOnly(settings.cub_referencia))}">`;
      form.querySelector('#ct-cub')?.addEventListener('input', () => this.recalculateContract());
      form.querySelector('#ct-area')?.addEventListener('input', () => this.recalculateContract());
    }
    const subtitle = form.querySelector('#ct-subtitulo');
    if (subtitle) {
      subtitle.readOnly = true;
      subtitle.title = 'Vinculado ao Cadastro Geral da obra';
    }
    const clauseHeader = form.querySelector('#ct-clausulas-container')?.previousElementSibling;
    if (clauseHeader && !document.getElementById('p51-save-default-clauses')) {
      const btn = document.createElement('button');
      btn.type='button'; btn.id='p51-save-default-clauses'; btn.className='btn btn-sm btn-secondary';
      btn.textContent='💾 Salvar cláusulas como padrão da empresa';
      btn.addEventListener('click', () => this.saveDefaultClauses());
      clauseHeader.appendChild(btn);
    }
    this.recalculateContract();
    const obraId = form.querySelector('#ct-obra-select')?.value;
    if (obraId) this.applyContractObraData(obraId);
  },

  recalculateContract() {
    const cub = Number(document.getElementById('ct-cub')?.value || 0);
    const area = Number(document.getElementById('ct-area')?.value || 0);
    const total = document.getElementById('ct-valor');
    const m2 = document.getElementById('ct-valor-m2');
    if (total) total.value = (cub * area).toFixed(2);
    if (m2) m2.value = typeof Utils !== 'undefined' ? Utils.fmt.currency(cub) : String(cub);
  },

  applyContractObraData(obraId) {
    const obra = DB.getById('clientes', obraId);
    if (!obra) return;
    const rg = document.getElementById('ct-cli-rg');
    const birth = document.getElementById('ct-cli-nasc');
    const subtitle = document.getElementById('ct-subtitulo');
    if (rg) rg.value = [obra.rg, obra.orgao_expedidor].filter(Boolean).join(' ');
    if (birth) birth.value = obra.data_nascimento || '';
    if (subtitle) subtitle.value = obra.subtitulo_capa || `(CONTRATO ANTERIOR A CAIXA - ${(obra.nome || '').toUpperCase()}) MCMV`;
    const area = document.getElementById('ct-area');
    if (area && obra.area_construida) area.value = obra.area_construida;
    this.recalculateContract();
  },

  async saveDefaultClauses() {
    if (!this.isManager()) return Utils.toast('Somente administrador ou gestor pode alterar cláusulas gerais.', 'warning');
    try {
      const data = await this.api('settings_save', { method:'POST', body:{ contract_clauses:Contratos._clausulasTemporarias || [] } });
      this._settings = data.settings;
      Utils.toast('Cláusulas padrão salvas com nova versão.', 'success');
    } catch (err) { Utils.toast(err.message, 'warning'); }
  },

  async enhanceCurrentView() {
    this.cleanSidebar();
    this.removePortalFromObraCards();
    this.enhanceCentral();
    this.enhanceSettings();
    this.enhanceSlaSettings();
  },

  install() {
    if (this._installed) return;
    this._installed = true;

    // Banco/cache: após sincronizar as obras básicas, recompõe os campos do Cadastro Geral do Patch 51.
    if (typeof DB !== 'undefined' && DB.syncFromCloud) {
      const originalSync = DB.syncFromCloud.bind(DB);
      DB.syncFromCloud = async (...args) => {
        const ok = await originalSync(...args);
        if (ok) await this.loadObraMeta();
        return ok;
      };
    }

    // Nova Obra / edição.
    if (typeof Clientes !== 'undefined') {
      const originalShowForm = Clientes.showForm.bind(Clientes);
      Clientes.showForm = (id = null) => {
        const result = originalShowForm(id);
        this.enhanceObraForm(id);
        return result;
      };
      const originalSave = Clientes.save.bind(Clientes);
      Clientes.save = (id) => {
        const form = document.getElementById('f-cli');
        if (!form) return originalSave(id);
        this.prepareLegacyRtField(form);
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const values = Object.fromEntries(new FormData(form));
        const before = new Set((DB.getAll('clientes') || []).map(o => String(o.id)));
        const result = originalSave(id);
        const all = DB.getAll('clientes') || [];
        const target = id ? all.find(o => String(o.id) === String(id)) : all.find(o => !before.has(String(o.id)));
        if (target?.id) {
          this.saveObraMeta(target.id, values).catch(err => Utils.toast(`Cadastro salvo localmente; complemento aguardando nuvem: ${err.message}`, 'warning'));
          this.initializeWorkflow(target.id, true).then(() => this.loadMyTasks(true)).catch(() => {});
        }
        setTimeout(() => this.removePortalFromObraCards(), 0);
        return result;
      };
    }

    // Central de Obras: novo tab de workflow e SLA primeiro.
    if (typeof ObraDetalhe !== 'undefined') {
      const originalGetTabContent = ObraDetalhe._getTabContent.bind(ObraDetalhe);
      ObraDetalhe._getTabContent = (tab, obra) => tab === 'workflow' ? this.workflowShell(obra?.id || App.obraId) : originalGetTabContent(tab, obra);
      const originalSetTab = ObraDetalhe.setTab.bind(ObraDetalhe);
      ObraDetalhe.setTab = (tab) => {
        const result = originalSetTab(tab);
        setTimeout(() => this.enhanceCurrentView(), 0);
        return result;
      };
    }

    // SLA: nunca reduz prazo no template da empresa.
    if (typeof Configuracoes !== 'undefined') {
      const originalSwitch = Configuracoes._switch.bind(Configuracoes);
      Configuracoes._switch = (tab) => {
        const result = originalSwitch(tab);
        setTimeout(() => this.enhanceCurrentView(), 0);
        if (tab === 'slas') this.loadUsers().then(() => setTimeout(() => this.enhanceSlaSettings(), 0));
        return result;
      };
      Configuracoes.salvarSlasEmpresa = () => {
        const form = document.getElementById('form-slas-empresa');
        if (!form) return;
        const old = CronogramaSLA.getSlasEmpresa();
        const updated = old.map(s => {
          const input = form.querySelector(`[name="sla_dias_${CSS.escape(s.id)}"]`);
          const next = Number.parseInt(input?.value,10) || Number(s.dias_sla)||1;
          if (next < Number(s.dias_sla || 1)) throw new Error(`${s.nome}: o SLA só pode ser aumentado.`);
          const select = form.querySelector(`.p51-sla-user[data-stage="${CSS.escape(s.id)}"]`);
          const user = this._users.find(u => String(u.id) === String(select?.value || ''));
          return { ...s, dias_sla:next, responsavel_user_id:user?.id || null, responsavel_nome:user?.nome || '', responsavel_perfil:user?.perfil || '' };
        });
        try {
          if (!CronogramaSLA.saveSlasEmpresa(updated)) throw new Error('Não foi possível salvar os SLAs.');
          Utils.toast('SLAs e responsáveis atualizados.', 'success');
        } catch (err) { Utils.toast(err.message, 'warning'); }
      };
    }

    if (typeof CronogramaSLA !== 'undefined') {
      const originalApontamento = CronogramaSLA.salvarApontamento.bind(CronogramaSLA);
      CronogramaSLA.salvarApontamento = (obraId, processoId) => {
        const current = CronogramaSLA.getObraProcessos(obraId).find(p => p.id === processoId);
        const nextDays = Number.parseInt(document.getElementById('sla-ap-dias')?.value, 10);
        if (current && Number.isFinite(nextDays) && nextDays < Number(current.dias_sla || 1)) {
          Utils.toast('O SLA pode ser aumentado, mas não reduzido.', 'warning');
          return;
        }
        return originalApontamento(obraId, processoId);
      };
      const originalConfigSubmit = CronogramaSLA.salvarConfigObraSubmit.bind(CronogramaSLA);
      CronogramaSLA.salvarConfigObraSubmit = (obraId) => {
        const current = CronogramaSLA.getObraProcessos(obraId);
        for (const p of current) {
          const input = document.querySelector(`[name="sla_cfg_${CSS.escape(p.id)}"]`) || document.querySelector(`[name="sla_dias_${CSS.escape(p.id)}"]`);
          if (input && Number(input.value) < Number(p.dias_sla || 1)) {
            Utils.toast(`${p.nome}: o SLA só pode ser aumentado.`, 'warning');
            return;
          }
        }
        return originalConfigSubmit(obraId);
      };
    }

    // Contratos: CUB -> metragem -> total calculado; subtítulo/dados vêm do Cadastro Geral.
    if (typeof Contratos !== 'undefined') {
      const originalGetModelos = Contratos.getModelos.bind(Contratos);
      Contratos.getModelos = () => {
        const models = originalGetModelos();
        const clauses = this._settings?.contract_clauses;
        if (Array.isArray(clauses) && clauses.length && models.contrato_caixa_mcmv) {
          models.contrato_caixa_mcmv.clausulas = JSON.parse(JSON.stringify(clauses));
        }
        return models;
      };
      const originalOpen = Contratos._abrirFormularioModal.bind(Contratos);
      Contratos._abrirFormularioModal = (dados = {}) => {
        const result = originalOpen(dados);
        setTimeout(() => this.enhanceContractModal(), 0);
        return result;
      };
      const originalObraChange = Contratos._onObraChange.bind(Contratos);
      Contratos._onObraChange = (obraId) => {
        const result = originalObraChange(obraId);
        this.applyContractObraData(obraId);
        return result;
      };
      const originalRecalc = Contratos._recalcularValores.bind(Contratos);
      Contratos._recalcularValores = () => {
        if (document.getElementById('ct-cub')) return this.recalculateContract();
        return originalRecalc();
      };
    }

    // Shell/navegação: remove atalhos duplicados e mantém Central como ponto único.
    if (typeof App !== 'undefined') {
      const originalRenderShell = App.renderShell.bind(App);
      App.renderShell = (...args) => {
        const result = originalRenderShell(...args);
        setTimeout(() => this.cleanSidebar(), 0);
        return result;
      };
      const originalNavigate = App.navigate.bind(App);
      App.navigate = async (...args) => {
        const result = await originalNavigate(...args);
        setTimeout(() => this.enhanceCurrentView(), 0);
        return result;
      };
    }

    window.addEventListener('DOMContentLoaded', async () => {
      await Promise.all([this.loadUsers(), this.loadSettings()]);
      await this.loadObraMeta();
      await this.loadMyTasks(false);
      this.enhanceCurrentView();
      clearInterval(this._pollTimer);
      this._pollTimer = setInterval(() => this.loadMyTasks(false), 60000);
    });
  }
};

Patch51.install();
