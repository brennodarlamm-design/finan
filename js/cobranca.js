// js/cobranca.js — Módulo de Cobrança Financeira SaaS, Planos e Assinaturas das Construtoras

const Cobranca = {
  STORAGE_ASSINATURAS_KEY: 'finobra_assinaturas',
  STORAGE_FATURAS_KEY: 'finobra_faturas',

  MODULE_MIN_PLAN: Object.freeze({ precompras:'pro', contratos:'pro', notas:'pro', orcamentos:'pro', documentos:'pro', assinatura:'pro' }),
  FEATURE_MIN_PLAN: Object.freeze({ ocr:'pro', signatures:'pro', sinapi:'unlimited', engineering:'unlimited', advancedPermissions:'unlimited' }),

  PLANOS: {
    starter: { id:'starter', nome:'Plano Básico', limiteObras:3, limiteUsuarios:1, valorMensal:119.90, valorTexto:'R$ 119,90 / mês', badge:'3 OBRAS • 1 USUÁRIO', destaque:false, ideal:'Operação enxuta e controle essencial', recursos:['3 obras ativas','1 usuário ativo','Obras, financeiro, fornecedores e produtos','Medições, OFX e relatórios','Suporte via sistema / WhatsApp'] },
    pro: { id:'pro', nome:'Plano Profissional', limiteObras:10, limiteUsuarios:2, valorMensal:279.90, valorTexto:'R$ 279,90 / mês', badge:'10 OBRAS • 2 USUÁRIOS', destaque:true, ideal:'Construtoras em crescimento e automação', recursos:['10 obras ativas','2 usuários ativos','Tudo do Básico','Pré-Compras, contratos e documentos','NF-e / OCR com IA e assinatura eletrônica','Suporte prioritário'] },
    unlimited: { id:'unlimited', nome:'Construtora Ilimitado', limiteObras:null, limiteUsuarios:5, valorMensal:499.90, valorTexto:'R$ 499,90 / mês', badge:'OBRAS ILIMITADAS • 5 USUÁRIOS', destaque:false, ideal:'Engenharia e operação em escala', recursos:['Obras ilimitadas','5 usuários ativos','Tudo do Profissional','SINAPI / Caixa','Curva S, EVM, ABC e BDI','Permissões avançadas e suporte VIP'] }
  },

  CYCLE_PRICING: {
    starter: {
      monthly: { priceCents: 11990, totalCents: 11990, months: 1, label: 'Mensal', discountPct: 0, saveCents: 0 },
      quarterly: { priceCents: 11330, totalCents: 33990, months: 3, label: 'Trimestral', discountPct: 5, saveCents: 1980 },
      semiannual: { priceCents: 10665, totalCents: 63990, months: 6, label: 'Semestral', discountPct: 11, saveCents: 7950 },
      annual: { priceCents: 9991, totalCents: 119900, months: 12, label: 'Anual', discountPct: 17, saveCents: 23980, tag: '2 meses grátis' }
    },
    pro: {
      monthly: { priceCents: 27990, totalCents: 27990, months: 1, label: 'Mensal', discountPct: 0, saveCents: 0 },
      quarterly: { priceCents: 26330, totalCents: 78990, months: 3, label: 'Trimestral', discountPct: 6, saveCents: 4980 },
      semiannual: { priceCents: 24665, totalCents: 147990, months: 6, label: 'Semestral', discountPct: 12, saveCents: 19950 },
      annual: { priceCents: 23325, totalCents: 279900, months: 12, label: 'Anual', discountPct: 17, saveCents: 55980, tag: '2 meses grátis' }
    },
    unlimited: {
      monthly: { priceCents: 49990, totalCents: 49990, months: 1, label: 'Mensal', discountPct: 0, saveCents: 0 },
      quarterly: { priceCents: 46663, totalCents: 139990, months: 3, label: 'Trimestral', discountPct: 7, saveCents: 9980 },
      semiannual: { priceCents: 44165, totalCents: 264990, months: 6, label: 'Semestral', discountPct: 12, saveCents: 34950 },
      annual: { priceCents: 41658, totalCents: 499900, months: 12, label: 'Anual', discountPct: 17, saveCents: 99980, tag: '2 meses grátis' }
    }
  },
  _selectedCycle: 'monthly',

  async _fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    if (typeof Auth !== 'undefined' && typeof Auth._fetchWithTimeout === 'function') {
      return Auth._fetchWithTimeout(url, options, timeoutMs);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let externalAbortHandler = null;
    try {
      if (options.signal) {
        if (options.signal.aborted) controller.abort();
        else {
          externalAbortHandler = () => controller.abort();
          options.signal.addEventListener('abort', externalAbortHandler, { once:true });
        }
      }
      return await fetch(url, { ...options, signal:controller.signal });
    } finally {
      clearTimeout(timer);
      if (externalAbortHandler && options.signal) options.signal.removeEventListener('abort', externalAbortHandler);
    }
  },

  setBillingCycle(cycle) {
    const valid = ['monthly', 'quarterly', 'semiannual', 'annual'];
    this._selectedCycle = valid.includes(cycle) ? cycle : 'monthly';
    const ass = this.getAssinaturaAtual();
    const u = (typeof Auth !== 'undefined' && Auth.getUser()) || {};
    const canManage = ['admin','superadmin'].includes(String(u.perfil||'').toLowerCase());

    document.querySelectorAll('.cobranca-cycle-btn').forEach(btn => {
      const active = btn.dataset.cycle === this._selectedCycle;
      btn.classList.toggle('active', active);
      btn.style.background = active ? 'var(--accent)' : 'transparent';
      btn.style.color = active ? '#0f1710' : '#cbd5e1';
      btn.style.fontWeight = active ? '900' : '700';
    });

    const container = document.getElementById('acc-plans-container');
    if (container) {
      container.innerHTML = Object.values(this.PLANOS).map(p => this._renderCardPlano(p, ass.planoId === p.id, canManage)).join('');
    }
  },

  getAssinaturas() {
    // Compatibilidade com versões antigas: não cria mais planos fictícios no navegador.
    try { return JSON.parse(localStorage.getItem(this.STORAGE_ASSINATURAS_KEY) || '{}'); } catch { return {}; }
  },

  salvarAssinaturas(a) {
    try { localStorage.setItem(this.STORAGE_ASSINATURAS_KEY, JSON.stringify(a || {})); } catch {}
  },

  getAssinaturaAtual() {
    const emp = (typeof DB !== 'undefined' && DB.getEmpresa) ? DB.getEmpresa() : {};
    const tenantId = (typeof Auth !== 'undefined' && Auth.getCurrentTenantId()) || emp.id || 'tenant';
    const planoId = ['starter','pro','unlimited'].includes(emp.plano) ? emp.plano : 'pro';
    const status = emp.status || 'trial';
    let vencimento = '';
    if (status === 'trial' && emp.created_at) {
      const dt = new Date(emp.created_at);
      if (!Number.isNaN(dt.getTime())) {
        dt.setDate(dt.getDate() + 15);
        vencimento = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      }
    }
    return {
      tenantId,
      planoId,
      status,
      vencimento,
      valorMensal: this.PLANOS[planoId]?.valorMensal || 0,
      criadoEm: emp.created_at || ''
    };
  },

  // ── CENTRAL DA CONTA / ASSINATURA ───────────────────────────────────────────
  _accountData: null,
  _accountTab: 'visao',

  _ensureAccountStyles() {
    if (document.getElementById('finobra-account-styles')) return;
    const s=document.createElement('style'); s.id='finobra-account-styles'; s.textContent=`
      .acc-shell{max-width:1180px;margin:0 auto;padding:6px 0 42px}.acc-head{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;flex-wrap:wrap;margin-bottom:20px}.acc-title{font-size:1.7rem;font-weight:900}.acc-sub{color:var(--text3);font-size:.86rem;margin-top:4px}.acc-hero{background:linear-gradient(135deg,#172810,#233919);border:1px solid rgba(201,162,39,.35);border-radius:18px;padding:20px;display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:16px}.acc-plan-name{font-size:1.2rem;font-weight:900;color:var(--accent2)}.acc-tabs{display:flex;gap:6px;overflow:auto;padding:5px;background:rgba(255,255,255,.025);border:1px solid var(--border);border-radius:12px;margin-bottom:18px;scroll-snap-type:x proximity;scrollbar-width:none;-webkit-overflow-scrolling:touch}.acc-tabs::-webkit-scrollbar{display:none}.acc-tab{white-space:nowrap;border:0;background:transparent;color:var(--text3);padding:9px 14px;border-radius:8px;font-weight:750;cursor:pointer;scroll-snap-align:start;min-height:42px}.acc-tab.active{background:rgba(201,162,39,.15);color:var(--accent2)}.acc-panel{display:none}.acc-panel.active{display:block}.acc-usage-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.acc-kpi{padding:16px;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.025)}.acc-kpi-l{font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}.acc-kpi-v{font-size:1.12rem;font-weight:900;margin-top:5px}.acc-plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.acc-plan-card{border:1px solid var(--border);border-radius:16px;padding:22px;display:flex;flex-direction:column;min-width:0;background:rgba(255,255,255,.02)}.acc-plan-card.featured{border-color:var(--accent);background:linear-gradient(145deg,#172810,#233919)}.acc-mod-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.acc-mod{padding:12px;border:1px solid var(--border);border-radius:10px;display:flex;gap:9px;align-items:center;font-size:.82rem}.acc-billing-table{width:100%;border-collapse:collapse}.acc-billing-table th,.acc-billing-table td{padding:11px 10px;border-bottom:1px solid var(--border);text-align:left;font-size:.8rem}.acc-billing-cards{display:none}.acc-mobile-hint{display:none}.plan-locked-copy{color:var(--text3);font-size:.82rem;line-height:1.55}
      .cobranca-cycle-wrap{display:flex;justify-content:center;margin-bottom:20px}.cobranca-cycle-switcher{display:inline-flex;background:rgba(255,255,255,.04);border:1px solid rgba(201,162,39,.25);border-radius:100px;padding:4px;gap:4px;flex-wrap:wrap;justify-content:center}.cobranca-cycle-btn{border:none;border-radius:100px;padding:7px 15px;font-size:.78rem;font-weight:700;cursor:pointer;background:transparent;color:#cbd5e1;transition:all .2s;font-family:inherit}.cobranca-cycle-btn.active{background:var(--accent);color:#0f1710;font-weight:900}.cobranca-cycle-pill{font-size:.68rem;padding:2px 6px;border-radius:10px;font-weight:800;margin-left:4px}.cobranca-cycle-pill-green{background:#22c55e;color:#0f1710}.cobranca-cycle-pill-dark{background:rgba(0,0,0,.25);color:inherit}
      /* FINOBRA_PATCH37_ACCOUNT_MOBILE */@media(max-width:760px){.acc-shell{padding:0 2px 30px}.acc-head{align-items:flex-start}.acc-title{font-size:1.35rem}.acc-hero{padding:16px}.acc-tabs{margin-left:-2px;margin-right:-2px}.acc-usage-grid{grid-template-columns:1fr 1fr}.acc-plans{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:12px;padding:4px 4px 12px}.acc-plan-card{min-width:86vw;scroll-snap-align:center}.acc-mobile-hint{display:block;color:var(--text3);font-size:.72rem;margin-bottom:8px}.acc-mod-grid{grid-template-columns:1fr}.acc-billing-table{display:none}.acc-billing-cards{display:flex;flex-direction:column;gap:10px}.acc-kpi{padding:13px}.acc-tab{padding:9px 12px}.acc-hero-actions{width:100%;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch!important}.acc-hero-actions .btn{width:100%;justify-content:center}.acc-panel[data-panel="equipe"] .btn,.acc-panel[data-panel="suporte"] .btn{min-height:44px}.acc-panel[data-panel="equipe"] [style*="display:flex"]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:430px){.acc-hero-actions{grid-template-columns:1fr}.acc-panel[data-panel="equipe"] [style*="display:flex"]{grid-template-columns:1fr}.acc-tabs{margin-left:-2px;margin-right:-2px}.acc-tab{padding:9px 11px}.acc-billing-cards .acc-kpi{padding:12px}}
      @media(max-width:420px){.acc-usage-grid{grid-template-columns:1fr}.acc-plan-card{min-width:91vw}}
    `; document.head.appendChild(s);
  },

  switchAccountTab(tab) {
    this._accountTab = tab || 'visao';
    document.querySelectorAll('.acc-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===this._accountTab));
    document.querySelectorAll('.acc-panel').forEach(x=>x.classList.toggle('active',x.dataset.panel===this._accountTab));
  },

  goToPlans() { if (typeof Utils!=='undefined') Utils.closeModal?.(); if (typeof App!=='undefined') App.navigate('planos'); setTimeout(()=>this.switchAccountTab('planos'),30); },

  _planLabel(id) { return this.PLANOS?.[id]?.nome || (id==='trial'?'Teste gratuito':'outro plano'); },

  openSettingsTab(tab) {
    if (typeof Utils!=='undefined') Utils.closeModal?.();
    if (typeof App!=='undefined') App.navigate('configuracoes');
    setTimeout(()=>{ if(typeof Configuracoes!=='undefined') Configuracoes._switch?.(tab); },80);
  },

  openSupport() {
    if (typeof Utils!=='undefined') Utils.closeModal?.();
    if (typeof Suporte!=='undefined' && typeof Suporte.toggleDropdown==='function') Suporte.toggleDropdown();
  },

  showPlanAccessError(payload={}) {
    const code=String(payload.code||'');
    if(code==='PLAN_USER_LIMIT') { if(typeof Configuracoes!=='undefined') Configuracoes.showUserLimitModal?.(payload); return true; }
    if(!code.startsWith('PLAN_')) return false;
    const required=payload.requiredPlanLabel || this._planLabel(payload.requiredPlan);
    const title=payload.module ? 'Módulo disponível em outro plano' : 'Recurso disponível em outro plano';
    const message=payload.userMessage || payload.error || (required ? `Disponível a partir do ${required}.` : 'Fale com o Suporte / Comercial para conhecer as opções.');
    Utils.showModal(`<div class="modal" style="max-width:520px"><div class="modal-header"><span class="modal-title">🔒 ${Utils.escapeHtml(title)}</span><button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button></div><div class="modal-body"><p class="plan-locked-copy">${Utils.escapeHtml(message)}</p>${required?`<div style="margin-top:14px;padding:12px;border:1px solid rgba(201,162,39,.28);background:rgba(201,162,39,.07);border-radius:10px"><strong>Plano indicado:</strong> ${Utils.escapeHtml(required)}</div>`:''}</div><div class="modal-footer"><button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Continuar no sistema</button><button class="btn btn-primary" data-fb-click="Cobranca.goToPlans" data-fb-click-n="0">Conhecer planos</button></div></div>`);
    return true;
  },

  showLockedModule(routeOrModule) {
    const module = Auth?.ROUTE_MODULES?.[String(routeOrModule||'')] || String(routeOrModule||'');
    const labels={precompras:'Pré-Compras',contratos:'Contratos',notas:'Notas / NF-e',orcamentos:'Orçamentos',documentos:'Documentos',assinatura:'Assinatura eletrônica'};
    const name=labels[module] || (App?.routeMeta?.[routeOrModule]?.label) || 'Este módulo';
    const p=Auth?.getPlanAccess?.() || {};
    const requiredId=this.MODULE_MIN_PLAN[module] || null;
    const required=this._planLabel(requiredId);
    const current=p.label || 'seu plano atual';
    Utils.showModal(`<div class="modal" style="max-width:520px"><div class="modal-header"><span class="modal-title">🔒 Módulo disponível em outro plano</span><button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button></div><div class="modal-body"><h3 style="margin:0 0 8px">${Utils.escapeHtml(name)}</h3><p class="plan-locked-copy">O <strong>${Utils.escapeHtml(current)}</strong> continua ativo normalmente. ${requiredId?`Este módulo está disponível a partir do <strong>${Utils.escapeHtml(required)}</strong>.`:'Consulte o Suporte / Comercial para liberar este módulo.'} Nenhum dado foi perdido.</p></div><div class="modal-footer"><button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Continuar no sistema</button><button class="btn btn-primary" data-fb-click="Cobranca.goToPlans" data-fb-click-n="0">Conhecer planos</button></div></div>`);
  },

  isFeatureAllowed(feature) {
    const role=String(Auth?.getUser?.()?.perfil||'').toLowerCase();
    if(role==='superadmin') return true;
    const features=Auth?.getPlanAccess?.()?.features;
    return !features || features[feature] !== false;
  },

  renderLockedFeature(title, description='Este recurso está disponível em outro plano.') {
    return `<div class="card" style="max-width:760px;margin:24px auto;padding:28px;text-align:center;border:1px solid rgba(201,162,39,.35);background:linear-gradient(145deg,rgba(201,162,39,.08),rgba(255,255,255,.02));"><div style="font-size:2rem;margin-bottom:8px">🔒</div><h2 style="font-size:1.25rem;margin:0 0 8px">${Utils.escapeHtml(title)}</h2><p style="color:var(--text3);font-size:.86rem;line-height:1.6;max-width:560px;margin:0 auto 18px">${Utils.escapeHtml(description)}</p><button class="btn btn-primary" data-fb-click="Cobranca.goToPlans" data-fb-click-n="0">Conhecer planos</button></div>`;
  },

  showLockedFeature(feature, title, description='Este recurso não faz parte do plano atual.') {
    if(this.isFeatureAllowed(feature)) return true;
    const p=Auth?.getPlanAccess?.()||{};
    const requiredId=this.FEATURE_MIN_PLAN[feature] || null;
    const required=this._planLabel(requiredId);
    const extra=requiredId ? ` Disponível a partir do ${required}.` : ' Consulte o Suporte / Comercial.';
    Utils.showModal(`<div class="modal" style="max-width:520px"><div class="modal-header"><span class="modal-title">🔒 Recurso disponível em outro plano</span><button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button></div><div class="modal-body"><h3 style="margin:0 0 8px">${Utils.escapeHtml(title)}</h3><p class="plan-locked-copy">${Utils.escapeHtml(description + extra)} O <strong>${Utils.escapeHtml(p.label||'seu plano')}</strong> continua ativo normalmente e nenhum dado foi perdido.</p></div><div class="modal-footer"><button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Continuar</button><button class="btn btn-primary" data-fb-click="Cobranca.goToPlans" data-fb-click-n="0">Conhecer planos</button></div></div>`);
    return false;
  },

  renderTelaPlanos(containerId = 'route-content') {
    const el=document.getElementById(containerId); if(!el)return; this._ensureAccountStyles();
    const ass=this.getAssinaturaAtual(); const u=Auth?.getUser?.()||{}; const emp=DB?.getEmpresa?.()||{}; const canManage=['admin','superadmin'].includes(String(u.perfil||'').toLowerCase());
    const nome=Utils.escapeHtml(emp.nome_fantasia||emp.razao_social||u.empresaNome||'sua empresa'); const plano=this.PLANOS[ass.planoId]||this.PLANOS.pro;
    el.innerHTML=`<div class="acc-shell"><div class="acc-head"><div><div class="acc-title">Conta & Assinatura</div><div class="acc-sub">Plano, cobranças, módulos e limites da ${nome} em um único lugar.</div></div></div>
      <div class="acc-hero"><div><div style="font-size:.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em">Conta ativa</div><div class="acc-plan-name">${Utils.escapeHtml(plano.nome)}</div><div style="font-size:.8rem;color:#94a3b8;margin-top:4px" id="acc-plan-status">Consultando assinatura no servidor…</div></div><div class="acc-hero-actions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${canManage?'<button class="btn btn-primary" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="planos">Alterar plano</button>':''}<button class="btn btn-secondary" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="cobrancas">Ver cobranças</button>${canManage?'<button class="btn btn-secondary" data-fb-click="Cobranca.cancelarAssinatura" data-fb-click-n="0" style="border-color:rgba(239,68,68,.45);color:#fca5a5">Cancelar renovação</button>':''}</div></div>
      <div class="acc-tabs"><button class="acc-tab active" data-tab="visao" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="visao">Visão geral</button><button class="acc-tab" data-tab="cobrancas" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="cobrancas">Cobranças</button><button class="acc-tab" data-tab="modulos" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="modulos">Meu Plano</button><button class="acc-tab" data-tab="equipe" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="equipe">Equipe & Sessões</button><button class="acc-tab" data-tab="suporte" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="suporte">Suporte</button><button class="acc-tab" data-tab="planos" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="planos">Comparar Planos</button></div>
      <section class="acc-panel active" data-panel="visao"><div id="finobra-plan-usage" class="card">Consultando uso atual…</div></section>
      <section class="acc-panel" data-panel="cobrancas"><div id="finobra-billing-history" class="card">Consultando cobranças…</div></section>
      <section class="acc-panel" data-panel="modulos"><div id="finobra-module-list" class="card">Consultando módulos contratados…</div></section>
      <section class="acc-panel" data-panel="equipe"><div id="finobra-account-team" class="card">Consultando equipe…</div></section>
      <section class="acc-panel" data-panel="suporte"><div id="finobra-account-support" class="card">Consultando suporte…</div></section>
      <section class="acc-panel" data-panel="planos">
        <div class="cobranca-cycle-wrap">
          <div class="cobranca-cycle-switcher" role="tablist" aria-label="Periodicidade de cobrança">
            <button type="button" class="cobranca-cycle-btn ${this._selectedCycle==='monthly'?'active':''}" data-cycle="monthly" data-fb-click="Cobranca.setBillingCycle" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="monthly">Mensal</button>
            <button type="button" class="cobranca-cycle-btn ${this._selectedCycle==='quarterly'?'active':''}" data-cycle="quarterly" data-fb-click="Cobranca.setBillingCycle" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="quarterly">Trimestral <span class="cobranca-cycle-pill cobranca-cycle-pill-dark">-6%</span></button>
            <button type="button" class="cobranca-cycle-btn ${this._selectedCycle==='semiannual'?'active':''}" data-cycle="semiannual" data-fb-click="Cobranca.setBillingCycle" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="semiannual">Semestral <span class="cobranca-cycle-pill cobranca-cycle-pill-dark">-12%</span></button>
            <button type="button" class="cobranca-cycle-btn ${this._selectedCycle==='annual'?'active':''}" data-cycle="annual" data-fb-click="Cobranca.setBillingCycle" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="annual">Anual <span class="cobranca-cycle-pill cobranca-cycle-pill-green">2 MESES GRÁTIS</span></button>
          </div>
        </div>
        <div class="acc-mobile-hint">Deslize para o lado para comparar os planos.</div>
        <div class="acc-plans" id="acc-plans-container">${Object.values(this.PLANOS).map(p=>this._renderCardPlano(p,ass.planoId===p.id,canManage)).join('')}</div>
      </section></div>`;
    this._carregarUsoPlano();
  },

  async _carregarUsoPlano() {
    const usageBox=document.getElementById('finobra-plan-usage');
    try {
      const headers=DB?._apiHeaders?.()||Auth.getAuthHeaders(); const u=Auth?.getUser?.()||{}; const canManage=['admin','superadmin'].includes(String(u.perfil||'').toLowerCase());
      const res=await this._fetchWithTimeout(canManage?'/api/plano?billing=1':'/api/plano',{headers}); const json=await res.json().catch(()=>({})); if(!res.ok||!json.success||!json.plan) throw new Error(json.error||'Falha ao consultar plano');
      const p=json.plan; this._accountData=json; if(Auth) Auth._planAccess=p;
      const obrasMax=p.maxActiveObras==null?'Ilimitadas':p.maxActiveObras; const usersMax=p.maxUsers==null?'Ilimitados':p.maxUsers;
      const statusEl=document.getElementById('acc-plan-status'); if(statusEl) statusEl.textContent=`${p.label||'Plano'} • ${p.status||'ativo'}${p.vencimento?' • próxima referência '+(Utils.formatDate?Utils.formatDate(p.vencimento):p.vencimento):''}`;
      if(usageBox) usageBox.innerHTML=`<div class="acc-usage-grid"><div class="acc-kpi"><div class="acc-kpi-l">Usuários</div><div class="acc-kpi-v">${Number(p.usage?.activeUsers||0)} / ${usersMax}</div><div style="font-size:.72rem;color:var(--text3);margin-top:4px">Pessoas ativas no plano</div></div><div class="acc-kpi"><div class="acc-kpi-l">Obras ativas</div><div class="acc-kpi-v">${Number(p.usage?.activeObras||0)} / ${obrasMax}</div><div style="font-size:.72rem;color:var(--text3);margin-top:4px">Obras em andamento</div></div><div class="acc-kpi"><div class="acc-kpi-l">Suporte</div><div class="acc-kpi-v">${Utils.escapeHtml(p.supportLevel||'Padrão')}</div><div style="font-size:.72rem;color:var(--text3);margin-top:4px">Suporte / Comercial</div></div><div class="acc-kpi"><div class="acc-kpi-l">Mensalidade</div><div class="acc-kpi-v">R$ ${(Number(p.monthlyPriceCents||0)/100).toFixed(2).replace('.',',')}</div><div style="font-size:.72rem;color:var(--text3);margin-top:4px">Sem fidelidade</div></div></div>`;
      this._renderBillingHistory(json.invoices||[]); this._renderModules(p); this._renderAccountTeam(p); this._renderAccountSupport(p);
    } catch(e) { if(usageBox) usageBox.textContent='Não foi possível consultar os dados da assinatura agora.'; }
  },

  async cancelarAssinatura() {
    const p=this._accountData?.plan||null;
    const until=p?.vencimento ? (Utils.formatDate?Utils.formatDate(p.vencimento):p.vencimento) : 'o fim do período atual';
    if (!confirm(`Cancelar a renovação da assinatura?\n\nO acesso continuará disponível até ${until}. Cobranças PIX pendentes serão canceladas. Esta ação pode ser revertida fazendo um novo pagamento de plano.`)) return;
    try {
      const headers=DB?._apiHeaders?.()||Auth.getAuthHeaders();
      const res=await this._fetchWithTimeout('/api/plano?action=cancel_subscription',{method:'POST',headers,body:JSON.stringify({action:'cancel_subscription'})});
      const json=await res.json().catch(()=>({}));
      if(!res.ok||!json.success) throw new Error(json.error||'Não foi possível cancelar a renovação.');
      if(typeof Utils!=='undefined'&&Utils.toast) Utils.toast(json.message||'Renovação cancelada com sucesso.','success');
      await this._carregarUsoPlano();
      if(typeof Auth!=='undefined'&&Auth.refreshSessionFromServer) await Auth.refreshSessionFromServer();
    } catch(err) {
      if(typeof Utils!=='undefined'&&Utils.toast) Utils.toast(err.message||'Falha ao cancelar a assinatura.','error');
    }
  },

  _renderAccountTeam(p) {
    const el=document.getElementById('finobra-account-team'); if(!el)return;
    const active=Number(p?.usage?.activeUsers||0); const max=p?.maxUsers==null?'Ilimitados':Number(p.maxUsers||0);
    const role=String(Auth?.getUser?.()?.perfil||'').toLowerCase(); const admin=['admin','superadmin'].includes(role);
    el.innerHTML=`<div style="font-weight:900;font-size:1rem;margin-bottom:8px">Equipe & Sessões</div><p style="font-size:.8rem;color:var(--text3);line-height:1.55;margin:0 0 16px"><strong style="color:var(--text2)">Usuário é pessoa; sessão é dispositivo.</strong> Notebook, celular e navegadores da mesma pessoa aparecem como sessões de segurança e não aumentam o consumo do plano.</p><div class="acc-usage-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:16px"><div class="acc-kpi"><div class="acc-kpi-l">Usuários ativos</div><div class="acc-kpi-v">${active} / ${max}</div></div><div class="acc-kpi"><div class="acc-kpi-l">Permissões avançadas</div><div class="acc-kpi-v">${p?.features?.advancedPermissions?'Incluídas':'Por perfil'}</div></div></div><div style="display:flex;gap:8px;flex-wrap:wrap">${admin?'<button class="btn btn-primary" data-fb-click="Cobranca.openSettingsTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="usuarios">Gerenciar usuários</button>':''}<button class="btn btn-secondary" data-fb-click="Cobranca.openSettingsTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="sessoes">Ver sessões e dispositivos</button></div>`;
  },

  _renderAccountSupport(p) {
    const el=document.getElementById('finobra-account-support'); if(!el)return;
    const level=Utils.escapeHtml(p?.supportLevel||'Padrão');
    el.innerHTML=`<div style="font-weight:900;font-size:1rem;margin-bottom:8px">Suporte / Comercial</div><p style="font-size:.82rem;color:var(--text3);line-height:1.55">Seu plano possui atendimento <strong style="color:var(--text2)">${level}</strong>. Para dúvidas de uso, problemas técnicos ou informações comerciais, use a central do FinGo. Diagnósticos internos ficam restritos à equipe DEV.</p><button class="btn btn-primary" data-fb-click="Cobranca.openSupport" data-fb-click-n="0">Abrir atendimento</button>`;
  },

  _renderBillingHistory(invoices=[]) {
    const el=document.getElementById('finobra-billing-history'); if(!el)return; const status={pending:'Pendente',paid:'Pago',expired:'Expirado',canceled:'Cancelado'};
    const cycleNames = { monthly:'Mensal', quarterly:'Trimestral', semiannual:'Semestral', annual:'Anual' };
    if(!invoices.length){el.innerHTML='<div style="padding:16px;text-align:center;color:var(--text3)">Nenhuma cobrança registrada ainda.</div>';return;}
    const rows=invoices.map(i=>{const val='R$ '+(Number(i.amount_cents||0)/100).toFixed(2).replace('.',','); const venc=i.expires_at?new Date(i.expires_at).toLocaleDateString('pt-BR'):'—'; const pago=i.paid_at?new Date(i.paid_at).toLocaleDateString('pt-BR'):'—'; const cName = cycleNames[i.cycle] || (i.cycle && i.cycle !== 'monthly' ? i.cycle : ''); return {i,val,venc,pago,cName,s:status[i.status]||i.status||'—'};});
    el.innerHTML=`<div style="font-weight:900;font-size:1rem;margin-bottom:12px">Histórico de cobranças</div><div style="overflow:auto"><table class="acc-billing-table"><thead><tr><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pagamento</th><th style="text-align:right">Ação</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${Utils.escapeHtml(r.i.competencia||'—')}${r.cName?` <span style="font-size:.7rem;color:var(--accent2)">(${Utils.escapeHtml(r.cName)})</span>`:''}</td><td>${r.venc}</td><td><strong>${r.val}</strong></td><td>${Utils.escapeHtml(r.s)}</td><td>${r.pago}</td><td style="text-align:right">${r.i.status==='pending'?`<button class="btn btn-sm btn-primary" data-fb-click="Cobranca.reabrirModalPix" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(r.i.id))}" style="min-height:36px;font-weight:800;white-space:nowrap;">⚡ Pagar com PIX</button>`:'—'}</td></tr>`).join('')}</tbody></table></div><div class="acc-billing-cards">${rows.map(r=>`<div class="acc-kpi"><div style="display:flex;justify-content:space-between;gap:10px"><strong>${Utils.escapeHtml(r.i.competencia||'Cobrança')}${r.cName?` (${Utils.escapeHtml(r.cName)})`:''}</strong><span>${Utils.escapeHtml(r.s)}</span></div><div style="font-size:1.05rem;font-weight:900;margin:8px 0">${r.val}</div><div style="font-size:.74rem;color:var(--text3)">Vencimento: ${r.venc} • Pagamento: ${r.pago}</div>${r.i.status==='pending'?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)"><button class="btn btn-primary btn-block" data-fb-click="Cobranca.reabrirModalPix" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(r.i.id))}" style="min-height:44px;font-weight:800;width:100%;justify-content:center;">⚡ Pagar com PIX (${r.val})</button></div>`:''}</div>`).join('')}</div>`;
  },

  _renderModules(p) {
    const el=document.getElementById('finobra-module-list'); if(!el)return;
    const catalog={dashboard:'Dashboard',obras:'Obras & Clientes',financeiro:'Financeiro',fornecedores:'Fornecedores',produtos:'Produtos / Insumos',precompras:'Pré-Compras',recibos:'Recibos',contratos:'Contratos',notas:'Notas / NF-e / OCR',orcamentos:'Orçamentos',medicoes:'Medições',documentos:'Documentos',relatorios:'Relatórios',contas:'Contas Bancárias',whatsapp:'WhatsApp',assinatura:'Assinatura eletrônica',planos:'Conta & Assinatura',configuracoes:'Configurações'};
    const allowed=new Set(p.modules||[]); const f=p.features||{};
    const advanced=[['ocr','OCR com IA'],['signatures','Assinatura eletrônica + QR'],['sinapi','SINAPI / Caixa'],['engineering','Curva S, EVM, ABC e BDI'],['advancedPermissions','Permissões avançadas por módulo']];
    el.innerHTML=`<div style="font-weight:900;font-size:1rem;margin-bottom:6px">Módulos do seu plano</div><div style="font-size:.78rem;color:var(--text3);margin-bottom:14px">Módulo contratado e recurso avançado são coisas diferentes. Por exemplo, Orçamentos pode estar incluído sem liberar SINAPI.</div><div class="acc-mod-grid">${Object.entries(catalog).map(([k,v])=>`<div class="acc-mod"><span style="color:${allowed.has(k)?'#22c55e':'#94a3b8'}">${allowed.has(k)?'✓':'🔒'}</span><span style="flex:1">${v}</span><span style="font-size:.68rem;color:var(--text3)">${allowed.has(k)?'Incluído':'Outro plano'}</span></div>`).join('')}</div><div style="font-weight:900;font-size:1rem;margin:22px 0 10px">Recursos avançados</div><div class="acc-mod-grid">${advanced.map(([k,v])=>`<div class="acc-mod"><span style="color:${f[k]?'#22c55e':'#94a3b8'}">${f[k]?'✓':'🔒'}</span><span style="flex:1">${v}</span><span style="font-size:.68rem;color:var(--text3)">${f[k]?'Incluído':'Outro plano'}</span></div>`).join('')}</div>`;
  },

  _renderCardPlano(plano, isAtual, canManage = false) {
    const feat = plano.destaque;
    const obras = plano.limiteObras == null ? 'Ilimitadas' : plano.limiteObras;
    const cycle = this._selectedCycle || 'monthly';
    const cycleData = this.CYCLE_PRICING?.[plano.id]?.[cycle] || {
      priceCents: Math.round(plano.valorMensal * 100),
      totalCents: Math.round(plano.valorMensal * 100),
      months: 1,
      label: 'Mensal'
    };
    const precoEquiv = (cycleData.priceCents / 100).toFixed(2).replace('.', ',');
    const totalCobrado = (cycleData.totalCents / 100).toFixed(2).replace('.', ',');
    const cycleNote = cycleData.months > 1
      ? `<div style="font-size:.75rem;color:var(--accent2);margin:-8px 0 14px;font-weight:700">R$ ${totalCobrado} a cada ${cycleData.months} meses${cycleData.tag ? ` • <span style="background:#22c55e;color:#0f1710;padding:1px 6px;border-radius:6px;font-weight:900">${cycleData.tag}</span>` : ''}</div>`
      : `<div style="font-size:.75rem;color:var(--text3);margin:-8px 0 14px">Cobrança mensal sem fidelidade</div>`;

    return `<article class="acc-plan-card ${feat ? 'featured' : ''}"><div><div style="font-size:.68rem;color:var(--accent2);font-weight:900;text-transform:uppercase;letter-spacing:.05em">${Utils.escapeHtml(plano.badge)}</div><h3 style="font-size:1.2rem;margin:8px 0 3px">${Utils.escapeHtml(plano.nome)}</h3><div style="font-size:.76rem;color:var(--text3);min-height:34px">${Utils.escapeHtml(plano.ideal)}</div><div style="font-size:2rem;font-weight:900;margin:16px 0 4px">R$ ${precoEquiv}<span style="font-size:.75rem;color:var(--text3);font-weight:500">/mês</span></div>${cycleNote}<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><span class="badge badge-secondary">👥 ${plano.limiteUsuarios} usuário(s)</span><span class="badge badge-secondary">🏗️ ${obras} obras</span></div><ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px">${plano.recursos.map(r => `<li style="font-size:.8rem;color:var(--text2)">✓ ${Utils.escapeHtml(r)}</li>`).join('')}</ul></div><div style="margin-top:20px">${isAtual ? '<button class="btn btn-secondary" disabled style="width:100%">✓ Plano atual</button>' : canManage ? `<button class="btn btn-primary" style="width:100%" data-fb-click="Cobranca.selecionarPlano" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(plano.id)}">Escolher este plano</button>` : '<button class="btn btn-secondary" disabled style="width:100%">Administrador necessário</button>'}</div></article>`;
  },

  selecionarPlano(planoId) {
    const plano = this.PLANOS[planoId];
    if (!plano) return;
    this.abrirModalPagamentoPix(planoId, this._selectedCycle || 'monthly');
  },

  fecharModalPix() {
    if (this._pixPollTimer) {
      clearInterval(this._pixPollTimer);
      this._pixPollTimer = null;
    }
    if (this._pixAbortController) {
      try { this._pixAbortController.abort(); } catch {}
      this._pixAbortController = null;
    }
    if (this._pixKeyHandler) {
      window.removeEventListener('keydown', this._pixKeyHandler);
      this._pixKeyHandler = null;
    }
    const m = document.getElementById('cobranca-pix-modal');
    if (m) m.remove();
  },

  // ── MODAL: PAGAMENTO VIA PIX DINÂMICO ──────────────────────────────────────
  async abrirModalPagamentoPix(planoId, cycle = this._selectedCycle || 'monthly') {
    this.fecharModalPix();

    const plano = this.PLANOS[planoId] || this.PLANOS['pro'];
    const cycleData = this.CYCLE_PRICING?.[plano.id]?.[cycle] || { priceCents: Math.round(plano.valorMensal * 100), totalCents: Math.round(plano.valorMensal * 100), months: 1, label: 'Mensal' };
    const cycleLabel = cycleData.label || 'Mensal';

    let modal = document.getElementById('cobranca-pix-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'cobranca-pix-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(6px);padding:16px;';
      document.body.appendChild(modal);
    }

    this._pixKeyHandler = (e) => {
      if (e.key === 'Escape') this.fecharModalPix();
    };
    window.addEventListener('keydown', this._pixKeyHandler);

    modal.onclick = (e) => {
      if (e.target === modal) this.fecharModalPix();
    };

    modal.innerHTML = `<div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:540px;padding:34px;text-align:center;color:#f0ead6;"><div style="font-size:2rem;margin-bottom:10px;">⏳</div><div style="font-weight:800;">Gerando cobrança segura no servidor...</div></div>`;

    try {
      const headers = (typeof DB !== 'undefined' && DB._apiHeaders) ? DB._apiHeaders() : (typeof Auth !== 'undefined' ? Auth.getAuthHeaders() : { 'Content-Type':'application/json' });
      const resp = await this._fetchWithTimeout('/api/plano?action=create_invoice', {
        method:'POST', headers, body:JSON.stringify({ plan_id:plano.id, cycle })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success || !data.invoice) throw new Error(data.error || 'Não foi possível gerar a cobrança.');

      const inv = data.invoice;
      const amount = Number(inv.amount_cents || cycleData.totalCents || Math.round(plano.valorMensal * 100)) / 100;
      const amountFmt = amount.toFixed(2).replace('.', ',');

      this._montarModalPix(inv, plano, cycleLabel, amountFmt, data.billingWhatsapp);
    } catch (err) {
      modal.innerHTML = `<div style="background:#0f1710;border:1px solid rgba(239,68,68,.45);border-radius:14px;width:100%;max-width:520px;padding:28px;color:#f0ead6;text-align:center;"><div style="font-size:2rem;margin-bottom:10px;">⚠️</div><div style="font-weight:900;color:#fff;margin-bottom:8px;">Não foi possível gerar a cobrança</div><div id="billing-error-text" style="color:#fca5a5;font-size:.86rem;"></div><button id="pix-error-close-btn" data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="cobranca-pix-modal" style="margin-top:18px;padding:9px 18px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;cursor:pointer;">Fechar</button></div>`;
      const msg = document.getElementById('billing-error-text');
      if (msg) msg.textContent = err?.message || 'Erro de comunicação com o servidor.';
      document.getElementById('pix-error-close-btn')?.addEventListener('click', () => this.fecharModalPix());
    }
  },

  async reabrirModalPix(invoiceId) {
    let inv = (this._accountData?.invoices || []).find(i => String(i.id) === String(invoiceId));
    if (!inv) {
      try {
        const headers = (typeof DB !== 'undefined' && DB._apiHeaders) ? DB._apiHeaders() : (typeof Auth !== 'undefined' ? Auth.getAuthHeaders() : {});
        const res = await this._fetchWithTimeout('/api/plano?billing=1', { headers });
        const json = await res.json().catch(() => ({}));
        if (json.invoices) {
          this._accountData = json;
          inv = json.invoices.find(i => String(i.id) === String(invoiceId));
        }
      } catch (e) {
        console.warn('[Cobranca] Erro ao buscar fatura:', e);
      }
    }

    if (!inv) {
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('Fatura não encontrada ou expirada.', 'warning');
      }
      return;
    }

    const plano = this.PLANOS[inv.plan_id] || this.PLANOS['pro'];
    const cycleNames = { monthly:'Mensal', quarterly:'Trimestral', semiannual:'Semestral', annual:'Anual' };
    const cycleLabel = cycleNames[inv.cycle] || 'Mensal';
    const amount = Number(inv.amount_cents || 0) / 100;
    const amountFmt = amount.toFixed(2).replace('.', ',');

    this._montarModalPix(inv, plano, cycleLabel, amountFmt);
  },

  _montarModalPix(inv, plano, cycleLabel, amountFmt, billingWhatsapp = '') {
    this.fecharModalPix();

    const emp = (typeof DB !== 'undefined' && DB.getEmpresa()) || {};
    const u = (typeof Auth !== 'undefined' && Auth.getUser()) || {};
    const pixPayload = String(inv.pix_payload || '');
    const txid = Utils.escapeHtml(String(inv.txid || ''));
    const whatsapp = String(billingWhatsapp || this._accountData?.billingWhatsapp || '').replace(/\D/g, '');
    const whatsappDisplay = whatsapp ? `+${whatsapp}` : 'Suporte FinGo';
    const companyName = emp.nome_fantasia || emp.razao_social || u.empresaNome || 'Minha Construtora';
    const waMessage = encodeURIComponent(`Olá! Realizei o pagamento PIX da assinatura FinGo (${plano.nome} [Ciclo ${cycleLabel}] - R$ ${amountFmt}) para ${companyName}. TXID: ${inv.txid || ''}. Segue o comprovante para conferência:`);
    const waHref = whatsapp ? `https://api.whatsapp.com/send?phone=${whatsapp}&text=${waMessage}` : '#';
    const qrSrc = pixPayload ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(pixPayload)}` : '';

    let modal = document.getElementById('cobranca-pix-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'cobranca-pix-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(6px);padding:16px;';
      document.body.appendChild(modal);
    }

    this._pixKeyHandler = (e) => {
      if (e.key === 'Escape') this.fecharModalPix();
    };
    window.addEventListener('keydown', this._pixKeyHandler);

    modal.onclick = (e) => {
      if (e.target === modal) this.fecharModalPix();
    };

    modal.innerHTML = `
      <div style="background:#090d0a;border:1px solid rgba(201,162,39,.35);border-radius:18px;width:100%;max-width:540px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 28px 70px rgba(0,0,0,.92);overflow:hidden;color:#f0ead6;font-family:inherit;">
        
        <!-- Header com Valor em Destaque e Fechar -->
        <div style="background:linear-gradient(135deg,#12210c,#1b2f13);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.25);display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;border-radius:10px;background:rgba(201,162,39,.15);border:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">⚡</div>
            <div>
              <div style="font-weight:900;font-size:1.05rem;color:var(--accent2);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                Pagamento Seguro via PIX
                <span style="background:rgba(34,197,94,.18);border:1px solid rgba(34,197,94,.4);color:#4ade80;font-size:.65rem;font-weight:800;padding:2px 7px;border-radius:100px;text-transform:uppercase;">100% Protegido</span>
              </div>
              <div style="font-size:.78rem;color:#94a3b8;margin-top:2px;">
                ${Utils.escapeHtml(plano.nome)} &bull; Ciclo ${Utils.escapeHtml(cycleLabel)} &bull; <strong style="color:#22c55e;font-size:.95rem;">R$ ${amountFmt}</strong>
              </div>
            </div>
          </div>
          <button id="pix-modal-close-btn" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#94a3b8;min-width:44px;min-height:44px;border-radius:10px;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;" title="Fechar modal">✕</button>
        </div>

        <!-- Corpo Rolável Mobile-First -->
        <div style="padding:18px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:14px;text-align:center;">

          <!-- BLOCO PRIMÁRIO (ZERO SCROLL): Botão Copiar Código PIX de 52px -->
          ${pixPayload ? `
            <div style="background:linear-gradient(135deg,rgba(18,217,160,.12),rgba(16,185,129,.05));border:1.5px solid var(--accent);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;">
              <button id="pix-copy-btn" style="background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;color:#060e09;min-height:52px;border-radius:10px;font-size:1rem;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 4px 18px rgba(18,217,160,.35);transition:all .2s;width:100%;">
                📋 COPIAR CÓDIGO PIX (1 Clique)
              </button>
              <div style="display:flex;gap:6px;align-items:center;">
                <input type="text" id="pix-copia-cola-input" readonly value="${Utils.escapeHtml(pixPayload)}" style="flex:1;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:6px 10px;color:#cbd5e1;font-size:.72rem;font-family:monospace;outline:none;" title="Código PIX Copia e Cola">
                <span style="font-size:.68rem;color:#94a3b8;white-space:nowrap;">Expira em 24h</span>
              </div>
            </div>
          ` : ''}

          <!-- Radar de Status em Tempo Real -->
          <div id="pix-status-box" style="background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.22);border-radius:10px;padding:10px 14px;font-size:.78rem;color:#86efac;display:flex;align-items:center;justify-content:center;gap:8px;">
            <span class="spinner" style="width:14px;height:14px;border:2px solid rgba(134,239,172,.3);border-top-color:#22c55e;border-radius:50%;animation:spin 1s linear infinite;display:inline-block;"></span>
            <span>Aguardando compensação bancária em tempo real...</span>
          </div>

          <!-- Accordion Retrátil para QR Code (Mobile amigável) -->
          ${qrSrc ? `
            <div style="border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.02);">
              <button type="button" id="pix-toggle-qr-btn" style="width:100%;min-height:44px;background:none;border:none;color:#94a3b8;font-size:.78rem;font-weight:700;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;">
                <span>📱 Prefere escanear com outro aparelho? [Ver QR Code]</span>
                <span id="pix-qr-chevron">▼</span>
              </button>
              <div id="pix-qr-container" style="display:none;padding:14px;flex-direction:column;align-items:center;gap:10px;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.2);">
                <div style="background:#ffffff;padding:10px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.5);display:inline-block;">
                  <img src="${qrSrc}" alt="QR Code PIX" style="display:block;width:170px;height:170px;border-radius:4px;">
                </div>
                <div style="font-size:.72rem;color:#94a3b8;">Aponte a câmera do aplicativo do seu banco para escanear</div>
              </div>
            </div>
          ` : ''}

          <!-- Resumo e Identificador TXID -->
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;font-size:.72rem;text-align:left;">
            <div><span style="color:#94a3b8;">Beneficiário Oficial:</span> <strong style="color:#fff;">FinGo Soluções Tecnológicas</strong></div>
            <div><span style="color:#94a3b8;">Identificador (TXID):</span> <code style="color:var(--accent2);font-family:monospace;background:rgba(0,0,0,.3);padding:2px 6px;border-radius:4px;">${txid}</code></div>
          </div>

          <!-- Guia de Instruções Passo a Passo -->
          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px;text-align:left;">
            <div style="font-weight:800;font-size:.8rem;color:#f0ead6;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
              <span>📖</span> Como pagar com seu banco:
            </div>
            <ol style="margin:0;padding-left:18px;font-size:.74rem;color:#94a3b8;line-height:1.5;display:flex;flex-direction:column;gap:3px;">
              <li>Abra o app do seu banco e acesse a área <strong>PIX</strong>.</li>
              <li>Escolha <strong>PIX Copia e Cola</strong> ou <strong>Pagar com QR Code</strong>.</li>
              <li>Confira o valor de <strong>R$ ${amountFmt}</strong> e confirme.</li>
              <li>Pronto! A liquidação é reconhecida automaticamente aqui em segundos.</li>
            </ol>
          </div>

          <!-- Ações e WhatsApp -->
          <div style="display:flex;flex-direction:column;gap:8px;width:100%;">
            ${whatsapp ? `
              <a href="${waHref}" target="_blank" rel="noopener noreferrer" style="background:#22c55e;color:#0b1d0f;min-height:44px;padding:10px 16px;border-radius:10px;font-weight:900;font-size:.82rem;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 14px rgba(34,197,94,.25);">
                💬 Enviar Comprovante no WhatsApp (${Utils.escapeHtml(whatsappDisplay)})
              </a>
            ` : ''}
            <button id="pix-cancel-btn" style="background:transparent;border:none;color:#64748b;font-size:.74rem;cursor:pointer;padding:8px;min-height:44px;text-decoration:underline;">
              Voltar sem concluir agora
            </button>
          </div>

          <!-- Selos de Segurança -->
          <div style="display:flex;align-items:center;justify-content:center;gap:14px;font-size:.68rem;color:#94a3b8;padding-top:4px;border-top:1px solid rgba(255,255,255,.05);flex-wrap:wrap;">
            <span>🔒 Transação 100% Protegida por Criptografia SSL 256-bit</span>
            <span>🏛️ Homologado Banco Central do Brasil</span>
            <span>⚡ Liberação Automática 24/7</span>
          </div>

        </div>
      </div>`;

    // Eventos dos botões de fechar
    document.getElementById('pix-modal-close-btn')?.addEventListener('click', () => this.fecharModalPix());
    document.getElementById('pix-cancel-btn')?.addEventListener('click', () => this.fecharModalPix());

    // Toggle QR Code
    const qrToggleBtn = document.getElementById('pix-toggle-qr-btn');
    const qrContainer = document.getElementById('pix-qr-container');
    const qrChevron = document.getElementById('pix-qr-chevron');
    if (qrToggleBtn && qrContainer) {
      qrToggleBtn.onclick = () => {
        const isHidden = qrContainer.style.display === 'none';
        qrContainer.style.display = isHidden ? 'flex' : 'none';
        if (qrChevron) qrChevron.textContent = isHidden ? '▲' : '▼';
      };
    }

    // Copiar código PIX com feedback háptico e visual
    const input = document.getElementById('pix-copia-cola-input');
    const copyBtn = document.getElementById('pix-copy-btn');
    if (copyBtn) copyBtn.onclick = async () => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(pixPayload);
        } else {
          input?.select();
          document.execCommand?.('copy');
        }
        if (navigator.vibrate) {
          try { navigator.vibrate([40, 60, 40]); } catch {}
        }
        copyBtn.textContent = '✓ Código Copiado!';
        copyBtn.style.background = '#22c55e';
        copyBtn.style.color = '#060e09';
        if (typeof Utils !== 'undefined' && Utils.toast) {
          Utils.toast('Código PIX copiado! Abra o app do banco para pagar.', 'success');
        }
      } catch {
        input?.select();
        document.execCommand?.('copy');
      }
      setTimeout(() => {
        if (copyBtn) {
          copyBtn.textContent = '📋 COPIAR CÓDIGO PIX (1 Clique)';
          copyBtn.style.background = 'linear-gradient(135deg,var(--accent),var(--accent2))';
          copyBtn.style.color = '#060e09';
        }
      }, 3500);
    };

    // ── MONITORAMENTO DE LIQUIDAÇÃO EM TEMPO REAL (POLLING) ──────────────────
    let pollCycles = 0;
    let pollFailures = 0;
    let pollWarningShown = false;
    const MAX_POLL_CYCLES = 225; // Limite de 15 minutos (225 ciclos x 4s)
    this._pixAbortController = new AbortController();

    this._pixPollTimer = setInterval(async () => {
      pollCycles++;
      if (pollCycles > MAX_POLL_CYCLES) {
        this.fecharModalPix();
        if (typeof Utils !== 'undefined' && Utils.toast) {
          Utils.toast('Tempo limite de verificação do PIX atingido. Se realizou o pagamento, confirme via WhatsApp.', 'warning');
        }
        return;
      }

      try {
        const authH = (typeof Auth !== 'undefined' && Auth.getAuthHeaders) ? Auth.getAuthHeaders() : { 'Content-Type': 'application/json' };
        const chkRes = await this._fetchWithTimeout(`/api/plano?action=check_invoice&invoiceId=${encodeURIComponent(inv.id)}`, {
          headers: authH,
          signal: this._pixAbortController?.signal
        });
        const chkData = await chkRes.json().catch(() => ({}));
        if (!chkRes.ok) throw new Error(`Verificação PIX respondeu HTTP ${chkRes.status}`);
        if (chkData?.success !== true) throw new Error(chkData?.error || 'Resposta inválida na verificação do PIX.');

        pollFailures = 0;
        if (pollWarningShown) {
          pollWarningShown = false;
          const recoveredBox = document.getElementById('pix-status-box');
          if (recoveredBox) {
            recoveredBox.style.background = 'rgba(34,197,94,.06)';
            recoveredBox.style.borderColor = 'rgba(34,197,94,.22)';
            recoveredBox.style.color = '#86efac';
            recoveredBox.innerHTML = '<span class="spinner" style="width:14px;height:14px;border:2px solid rgba(134,239,172,.3);border-top-color:#22c55e;border-radius:50%;animation:spin 1s linear infinite;display:inline-block;"></span><span>Conexão restabelecida. Aguardando compensação bancária...</span>';
          }
        }
        
        if (chkData?.paid) {
          this.fecharModalPix();

          const stBox = document.getElementById('pix-status-box');
          if (stBox) {
            stBox.style.background = 'rgba(34,197,94,.2)';
            stBox.style.borderColor = '#22c55e';
            stBox.style.color = '#4ade80';
            stBox.style.fontSize = '.9rem';
            stBox.style.fontWeight = '900';
            stBox.innerHTML = `🎉 Pagamento Confirmado com Sucesso! Atualizando seu plano...`;
          }

          if (typeof Utils !== 'undefined' && Utils.toast) {
            Utils.toast('🎉 Pagamento confirmado! Sua assinatura foi atualizada com sucesso.', 'success');
          }

          let sessionRefreshed = true;
          if (typeof Auth !== 'undefined' && Auth.refreshSessionFromServer) {
            try {
              const refreshed = await Auth.refreshSessionFromServer();
              sessionRefreshed = refreshed?.success !== false;
            } catch (refreshErr) {
              sessionRefreshed = false;
              console.warn('[Cobrança] Pagamento confirmado, mas a sessão ainda não refletiu o novo plano:', refreshErr?.message || refreshErr);
            }
          }

          if (!sessionRefreshed) {
            if (typeof Utils !== 'undefined' && Utils.toast) {
              Utils.toast('Pagamento confirmado. Atualizando o acesso para refletir o novo plano…', 'info');
            }
            setTimeout(() => window.location.reload(), 1200);
            return;
          }

          setTimeout(() => {
            if (typeof Cobranca !== 'undefined' && Cobranca.init) {
              Cobranca.init();
            }
            if (typeof App !== 'undefined' && App.renderShell) {
              App.renderShell();
            }
          }, 1200);
        }
      } catch (pollErr) {
        if (this._pixAbortController?.signal?.aborted) return;
        pollFailures++;
        console.warn('[Cobrança] Falha transitória ao verificar PIX:', pollErr?.message || pollErr);
        if (pollFailures >= 3 && !pollWarningShown) {
          pollWarningShown = true;
          const stBox = document.getElementById('pix-status-box');
          if (stBox) {
            stBox.style.background = 'rgba(245,158,11,.10)';
            stBox.style.borderColor = 'rgba(245,158,11,.35)';
            stBox.style.color = '#fbbf24';
            stBox.innerHTML = '<span>⚠️ Não conseguimos confirmar o pagamento agora. Sua cobrança continua válida e a verificação automática seguirá tentando.</span>';
          }
          if (typeof Utils !== 'undefined' && Utils.toast) {
            Utils.toast('A confirmação do PIX está temporariamente indisponível. Continuaremos verificando automaticamente.', 'warning');
          }
        }
      }
    }, 4000);
  }
};
