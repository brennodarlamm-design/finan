// js/cobranca.js — Módulo de Cobrança Financeira SaaS, Planos e Assinaturas das Construtoras

const Cobranca = {
  STORAGE_ASSINATURAS_KEY: 'finobra_assinaturas',
  STORAGE_FATURAS_KEY: 'finobra_faturas',

  PLANOS: {
    starter: { id:'starter', nome:'Plano Básico', limiteObras:3, limiteUsuarios:1, valorMensal:79.90, badge:'3 OBRAS • 1 USUÁRIO', destaque:false, ideal:'Operação enxuta e controle essencial', recursos:['3 obras ativas','1 usuário ativo','Obras, financeiro, fornecedores e produtos','Medições, OFX e relatórios','Suporte via sistema / WhatsApp'] },
    pro: { id:'pro', nome:'Plano Profissional', limiteObras:10, limiteUsuarios:2, valorMensal:119.90, badge:'10 OBRAS • 2 USUÁRIOS', destaque:true, ideal:'Construtoras em crescimento e automação', recursos:['10 obras ativas','2 usuários ativos','Tudo do Básico','Pré-Compras, contratos e documentos','NF-e / OCR com IA e assinatura eletrônica','Suporte prioritário'] },
    unlimited: { id:'unlimited', nome:'Construtora Ilimitado', limiteObras:null, limiteUsuarios:5, valorMensal:159.90, badge:'OBRAS ILIMITADAS • 5 USUÁRIOS', destaque:false, ideal:'Engenharia e operação em escala', recursos:['Obras ilimitadas','5 usuários ativos','Tudo do Profissional','SINAPI / Caixa','Curva S, EVM, ABC e BDI','Permissões avançadas e suporte VIP'] }
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
      .acc-shell{max-width:1180px;margin:0 auto;padding:6px 0 42px}.acc-head{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;flex-wrap:wrap;margin-bottom:20px}.acc-title{font-size:1.7rem;font-weight:900}.acc-sub{color:var(--text3);font-size:.86rem;margin-top:4px}.acc-hero{background:linear-gradient(135deg,#172810,#233919);border:1px solid rgba(201,162,39,.35);border-radius:18px;padding:20px;display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:16px}.acc-plan-name{font-size:1.2rem;font-weight:900;color:var(--accent2)}.acc-tabs{display:flex;gap:6px;overflow:auto;padding:5px;background:rgba(255,255,255,.025);border:1px solid var(--border);border-radius:12px;margin-bottom:18px}.acc-tab{white-space:nowrap;border:0;background:transparent;color:var(--text3);padding:9px 14px;border-radius:8px;font-weight:750;cursor:pointer}.acc-tab.active{background:rgba(201,162,39,.15);color:var(--accent2)}.acc-panel{display:none}.acc-panel.active{display:block}.acc-usage-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.acc-kpi{padding:16px;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.025)}.acc-kpi-l{font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}.acc-kpi-v{font-size:1.12rem;font-weight:900;margin-top:5px}.acc-plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.acc-plan-card{border:1px solid var(--border);border-radius:16px;padding:22px;display:flex;flex-direction:column;min-width:0;background:rgba(255,255,255,.02)}.acc-plan-card.featured{border-color:var(--accent);background:linear-gradient(145deg,#172810,#233919)}.acc-mod-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.acc-mod{padding:12px;border:1px solid var(--border);border-radius:10px;display:flex;gap:9px;align-items:center;font-size:.82rem}.acc-billing-table{width:100%;border-collapse:collapse}.acc-billing-table th,.acc-billing-table td{padding:11px 10px;border-bottom:1px solid var(--border);text-align:left;font-size:.8rem}.acc-billing-cards{display:none}.acc-mobile-hint{display:none}.plan-locked-copy{color:var(--text3);font-size:.82rem;line-height:1.55}
      @media(max-width:760px){.acc-shell{padding:0 2px 30px}.acc-head{align-items:flex-start}.acc-title{font-size:1.35rem}.acc-hero{padding:16px}.acc-tabs{margin-left:-2px;margin-right:-2px}.acc-usage-grid{grid-template-columns:1fr 1fr}.acc-plans{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:12px;padding:4px 4px 12px}.acc-plan-card{min-width:86vw;scroll-snap-align:center}.acc-mobile-hint{display:block;color:var(--text3);font-size:.72rem;margin-bottom:8px}.acc-mod-grid{grid-template-columns:1fr}.acc-billing-table{display:none}.acc-billing-cards{display:flex;flex-direction:column;gap:10px}.acc-kpi{padding:13px}.acc-tab{padding:9px 12px}.acc-hero-actions{width:100%}.acc-hero-actions .btn{width:100%;justify-content:center}}
      @media(max-width:420px){.acc-usage-grid{grid-template-columns:1fr}.acc-plan-card{min-width:91vw}}
    `; document.head.appendChild(s);
  },

  switchAccountTab(tab) {
    this._accountTab = tab || 'visao';
    document.querySelectorAll('.acc-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===this._accountTab));
    document.querySelectorAll('.acc-panel').forEach(x=>x.classList.toggle('active',x.dataset.panel===this._accountTab));
  },

  goToPlans() { if (typeof Utils!=='undefined') Utils.closeModal?.(); if (typeof App!=='undefined') App.navigate('planos'); setTimeout(()=>this.switchAccountTab('planos'),30); },

  showLockedModule(routeOrModule) {
    const module = Auth?.ROUTE_MODULES?.[String(routeOrModule||'')] || String(routeOrModule||'');
    const labels={precompras:'Pré-Compras',contratos:'Contratos',notas:'Notas / NF-e / OCR',orcamentos:'Orçamentos',documentos:'Documentos',assinatura:'Assinatura eletrônica'};
    const name=labels[module] || (App?.routeMeta?.[routeOrModule]?.label) || 'Este módulo';
    const p=Auth?.getPlanAccess?.() || {};
    Utils.showModal(`<div class="modal" style="max-width:520px"><div class="modal-header"><span class="modal-title">🔒 Recurso disponível em outro plano</span><button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button></div><div class="modal-body"><h3 style="margin:0 0 8px">${Utils.escapeHtml(name)}</h3><p class="plan-locked-copy">O <strong>${Utils.escapeHtml(p.label || 'seu plano atual')}</strong> continua ativo normalmente, mas este módulo não faz parte da contratação atual. Nenhum dado foi perdido e os demais módulos seguem disponíveis.</p><div style="margin-top:14px;padding:12px;border:1px solid rgba(201,162,39,.28);background:rgba(201,162,39,.07);border-radius:10px;font-size:.8rem;color:var(--text2)">Você pode conhecer os planos superiores sem alterar sua assinatura agora.</div></div><div class="modal-footer"><button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Continuar no sistema</button><button class="btn btn-primary" data-fb-click="Cobranca.goToPlans" data-fb-click-n="0">Conhecer planos</button></div></div>`);
  },

  renderTelaPlanos(containerId = 'route-content') {
    const el=document.getElementById(containerId); if(!el)return; this._ensureAccountStyles();
    const ass=this.getAssinaturaAtual(); const u=Auth?.getUser?.()||{}; const emp=DB?.getEmpresa?.()||{}; const canManage=['admin','superadmin'].includes(String(u.perfil||'').toLowerCase());
    const nome=Utils.escapeHtml(emp.nome_fantasia||emp.razao_social||u.empresaNome||'sua empresa'); const plano=this.PLANOS[ass.planoId]||this.PLANOS.pro;
    el.innerHTML=`<div class="acc-shell"><div class="acc-head"><div><div class="acc-title">Conta & Assinatura</div><div class="acc-sub">Plano, cobranças, módulos e limites da ${nome} em um único lugar.</div></div></div>
      <div class="acc-hero"><div><div style="font-size:.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em">Conta ativa</div><div class="acc-plan-name">${Utils.escapeHtml(plano.nome)}</div><div style="font-size:.8rem;color:#94a3b8;margin-top:4px" id="acc-plan-status">Consultando assinatura no servidor…</div></div><div class="acc-hero-actions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${canManage?'<button class="btn btn-primary" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="planos">Alterar plano</button>':''}<button class="btn btn-secondary" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="cobrancas">Ver cobranças</button></div></div>
      <div class="acc-tabs"><button class="acc-tab active" data-tab="visao" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="visao">Visão geral</button><button class="acc-tab" data-tab="cobrancas" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="cobrancas">Cobranças</button><button class="acc-tab" data-tab="modulos" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="modulos">Módulos</button><button class="acc-tab" data-tab="planos" data-fb-click="Cobranca.switchAccountTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="planos">Planos</button></div>
      <section class="acc-panel active" data-panel="visao"><div id="finobra-plan-usage" class="card">Consultando uso atual…</div></section>
      <section class="acc-panel" data-panel="cobrancas"><div id="finobra-billing-history" class="card">Consultando cobranças…</div></section>
      <section class="acc-panel" data-panel="modulos"><div id="finobra-module-list" class="card">Consultando módulos contratados…</div></section>
      <section class="acc-panel" data-panel="planos"><div class="acc-mobile-hint">Deslize para o lado para comparar os planos.</div><div class="acc-plans">${Object.values(this.PLANOS).map(p=>this._renderCardPlano(p,ass.planoId===p.id,canManage)).join('')}</div></section></div>`;
    this._carregarUsoPlano();
  },

  async _carregarUsoPlano() {
    const usageBox=document.getElementById('finobra-plan-usage');
    try {
      const headers=DB?._apiHeaders?.()||Auth.getAuthHeaders(); const u=Auth?.getUser?.()||{}; const canManage=['admin','superadmin'].includes(String(u.perfil||'').toLowerCase());
      const res=await fetch(canManage?'/api/plano?billing=1':'/api/plano',{headers}); const json=await res.json().catch(()=>({})); if(!res.ok||!json.success||!json.plan) throw new Error(json.error||'Falha ao consultar plano');
      const p=json.plan; this._accountData=json; if(Auth) Auth._planAccess=p;
      const obrasMax=p.maxActiveObras==null?'Ilimitadas':p.maxActiveObras; const usersMax=p.maxUsers==null?'Ilimitados':p.maxUsers;
      const statusEl=document.getElementById('acc-plan-status'); if(statusEl) statusEl.textContent=`${p.label||'Plano'} • ${p.status||'ativo'}${p.vencimento?' • próxima referência '+(Utils.formatDate?Utils.formatDate(p.vencimento):p.vencimento):''}`;
      if(usageBox) usageBox.innerHTML=`<div class="acc-usage-grid"><div class="acc-kpi"><div class="acc-kpi-l">Usuários</div><div class="acc-kpi-v">${Number(p.usage?.activeUsers||0)} / ${usersMax}</div><div style="font-size:.72rem;color:var(--text3);margin-top:4px">Pessoas ativas no plano</div></div><div class="acc-kpi"><div class="acc-kpi-l">Obras ativas</div><div class="acc-kpi-v">${Number(p.usage?.activeObras||0)} / ${obrasMax}</div><div style="font-size:.72rem;color:var(--text3);margin-top:4px">Obras em andamento</div></div><div class="acc-kpi"><div class="acc-kpi-l">Suporte</div><div class="acc-kpi-v">${Utils.escapeHtml(p.supportLevel||'Padrão')}</div><div style="font-size:.72rem;color:var(--text3);margin-top:4px">Suporte / Comercial</div></div><div class="acc-kpi"><div class="acc-kpi-l">Mensalidade</div><div class="acc-kpi-v">R$ ${(Number(p.monthlyPriceCents||0)/100).toFixed(2).replace('.',',')}</div><div style="font-size:.72rem;color:var(--text3);margin-top:4px">Sem fidelidade</div></div></div>`;
      this._renderBillingHistory(json.invoices||[]); this._renderModules(p);
    } catch(e) { if(usageBox) usageBox.textContent='Não foi possível consultar os dados da assinatura agora.'; }
  },

  _renderBillingHistory(invoices=[]) {
    const el=document.getElementById('finobra-billing-history'); if(!el)return; const status={pending:'Pendente',paid:'Pago',expired:'Expirado',canceled:'Cancelado'};
    if(!invoices.length){el.innerHTML='<div style="padding:16px;text-align:center;color:var(--text3)">Nenhuma cobrança registrada ainda.</div>';return;}
    const rows=invoices.map(i=>{const val='R$ '+(Number(i.amount_cents||0)/100).toFixed(2).replace('.',','); const venc=i.expires_at?new Date(i.expires_at).toLocaleDateString('pt-BR'):'—'; const pago=i.paid_at?new Date(i.paid_at).toLocaleDateString('pt-BR'):'—'; return {i,val,venc,pago,s:status[i.status]||i.status||'—'};});
    el.innerHTML=`<div style="font-weight:900;font-size:1rem;margin-bottom:12px">Histórico de cobranças</div><div style="overflow:auto"><table class="acc-billing-table"><thead><tr><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pagamento</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${Utils.escapeHtml(r.i.competencia||'—')}</td><td>${r.venc}</td><td><strong>${r.val}</strong></td><td>${Utils.escapeHtml(r.s)}</td><td>${r.pago}</td></tr>`).join('')}</tbody></table></div><div class="acc-billing-cards">${rows.map(r=>`<div class="acc-kpi"><div style="display:flex;justify-content:space-between;gap:10px"><strong>${Utils.escapeHtml(r.i.competencia||'Cobrança')}</strong><span>${Utils.escapeHtml(r.s)}</span></div><div style="font-size:1.05rem;font-weight:900;margin:8px 0">${r.val}</div><div style="font-size:.74rem;color:var(--text3)">Vencimento: ${r.venc} • Pagamento: ${r.pago}</div></div>`).join('')}</div>`;
  },

  _renderModules(p) {
    const el=document.getElementById('finobra-module-list'); if(!el)return; const catalog={dashboard:'Dashboard',obras:'Obras & Clientes',financeiro:'Financeiro',fornecedores:'Fornecedores',produtos:'Produtos / Insumos',precompras:'Pré-Compras',recibos:'Recibos',contratos:'Contratos',notas:'Notas / NF-e / OCR',orcamentos:'Orçamentos',medicoes:'Medições',documentos:'Documentos',relatorios:'Relatórios',contas:'Contas Bancárias',whatsapp:'WhatsApp',assinatura:'Assinatura eletrônica',planos:'Conta & Assinatura',configuracoes:'Configurações'}; const allowed=new Set(p.modules||[]);
    el.innerHTML=`<div style="font-weight:900;font-size:1rem;margin-bottom:6px">Módulos do seu plano</div><div style="font-size:.78rem;color:var(--text3);margin-bottom:14px">Os módulos bloqueados continuam visíveis no menu com um cadeado para você entender o que existe nos demais planos.</div><div class="acc-mod-grid">${Object.entries(catalog).map(([k,v])=>`<div class="acc-mod"><span style="color:${allowed.has(k)?'#22c55e':'#94a3b8'}">${allowed.has(k)?'✓':'🔒'}</span><span style="flex:1">${v}</span><span style="font-size:.68rem;color:var(--text3)">${allowed.has(k)?'Incluído':'Outro plano'}</span></div>`).join('')}</div>`;
  },

  _renderCardPlano(plano,isAtual,canManage=false) {
    const feat=plano.destaque; const obras=plano.limiteObras==null?'Ilimitadas':plano.limiteObras; return `<article class="acc-plan-card ${feat?'featured':''}"><div><div style="font-size:.68rem;color:var(--accent2);font-weight:900;text-transform:uppercase;letter-spacing:.05em">${Utils.escapeHtml(plano.badge)}</div><h3 style="font-size:1.2rem;margin:8px 0 3px">${Utils.escapeHtml(plano.nome)}</h3><div style="font-size:.76rem;color:var(--text3);min-height:34px">${Utils.escapeHtml(plano.ideal)}</div><div style="font-size:2rem;font-weight:900;margin:16px 0">R$ ${plano.valorMensal.toFixed(2).replace('.',',')}<span style="font-size:.75rem;color:var(--text3);font-weight:500">/mês</span></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><span class="badge badge-secondary">👥 ${plano.limiteUsuarios} usuário(s)</span><span class="badge badge-secondary">🏗️ ${obras} obras</span></div><ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px">${plano.recursos.map(r=>`<li style="font-size:.8rem;color:var(--text2)">✓ ${Utils.escapeHtml(r)}</li>`).join('')}</ul></div><div style="margin-top:20px">${isAtual?'<button class="btn btn-secondary" disabled style="width:100%">✓ Plano atual</button>':canManage?`<button class="btn btn-primary" style="width:100%" data-fb-click="Cobranca.selecionarPlano" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(plano.id)}">Escolher este plano</button>`:'<button class="btn btn-secondary" disabled style="width:100%">Administrador necessário</button>'}</div></article>`;
  },

  selecionarPlano(planoId) {
    const plano = this.PLANOS[planoId];
    if (!plano) return;
    this.abrirModalPagamentoPix(planoId);
  },

  // ── MODAL: PAGAMENTO VIA PIX DINÂMICO ──────────────────────────────────────
  async abrirModalPagamentoPix(planoId) {
    const plano = this.PLANOS[planoId] || this.PLANOS['pro'];
    const emp = (typeof DB !== 'undefined' && DB.getEmpresa()) || {};
    const u = (typeof Auth !== 'undefined' && Auth.getUser()) || {};

    let modal = document.getElementById('cobranca-pix-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'cobranca-pix-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(6px);padding:16px;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `<div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:540px;padding:34px;text-align:center;color:#f0ead6;"><div style="font-size:2rem;margin-bottom:10px;">⏳</div><div style="font-weight:800;">Gerando cobrança segura no servidor...</div></div>`;

    try {
      const headers = (typeof DB !== 'undefined' && DB._apiHeaders) ? DB._apiHeaders() : (typeof Auth !== 'undefined' ? Auth.getAuthHeaders() : { 'Content-Type':'application/json' });
      const resp = await fetch('/api/plano?action=create_invoice', {
        method:'POST', headers, body:JSON.stringify({ plan_id:plano.id })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success || !data.invoice) throw new Error(data.error || 'Não foi possível gerar a cobrança.');

      const inv = data.invoice;
      const amount = Number(inv.amount_cents || Math.round(plano.valorMensal * 100)) / 100;
      const pixPayload = String(inv.pix_payload || '');
      const txid = Utils.escapeHtml(String(inv.txid || ''));
      const whatsapp = String(data.billingWhatsapp || '').replace(/\D/g, '');
      const whatsappDisplay = whatsapp ? `+${whatsapp}` : 'Suporte FinObra';
      const companyName = emp.nome_fantasia || emp.razao_social || u.empresaNome || 'minha construtora';
      const waMessage = encodeURIComponent(`Olá! Realizei o pagamento PIX da assinatura FinObra (${plano.nome} - R$ ${amount.toFixed(2).replace('.', ',')}) para ${companyName}. TXID: ${inv.txid || ''}. Segue o comprovante:`);
      const waHref = whatsapp ? `https://wa.me/${whatsapp}?text=${waMessage}` : '#';
      const qrSrc = pixPayload ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixPayload)}` : '';

      modal.innerHTML = `
        <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:540px;box-shadow:0 24px 60px rgba(0,0,0,.85);overflow:hidden;color:#f0ead6;font-family:inherit;">
          <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;"><span style="font-size:1.3rem;">⚡</span><div><div style="font-weight:800;font-size:1rem;color:var(--accent2);">Cobrança PIX FinObra</div><div style="font-size:.75rem;color:#94a3b8;">${Utils.escapeHtml(plano.nome)} &bull; R$ ${amount.toFixed(2).replace('.', ',')}</div></div></div>
            <button data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="cobranca-pix-modal" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
          </div>
          <div style="padding:22px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;">
            <div style="font-size:.8rem;color:#94a3b8;">Cobrança registrada no servidor &bull; TXID <strong style="color:#fff;">${txid}</strong></div>
            ${qrSrc ? `<div style="background:#fff;padding:12px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.5);border:2px solid var(--accent);"><img src="${qrSrc}" alt="QR Code PIX" style="display:block;width:180px;height:180px;"></div>` : `<div style="padding:18px;border:1px solid #ef4444;border-radius:10px;color:#fecaca;background:rgba(239,68,68,.08);">PIX ainda não configurado no servidor. Entre em contato com o suporte.</div>`}
            ${pixPayload ? `<div style="width:100%;max-width:440px;"><div style="font-size:.72rem;color:#94a3b8;margin-bottom:6px;text-align:left;">PIX Copia e Cola</div><div style="display:flex;gap:8px;"><input type="text" id="pix-copia-cola-input" readonly style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 12px;color:#cbd5e1;font-size:.75rem;font-family:monospace;"><button id="pix-copy-btn" style="background:var(--accent);border:none;color:#0f1710;padding:8px 14px;border-radius:8px;font-size:.78rem;font-weight:800;cursor:pointer;white-space:nowrap;">Copiar 📋</button></div></div>` : ''}
            <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:10px 14px;font-size:.8rem;color:#22c55e;width:100%;max-width:440px;">✓ Após pagar, envie o comprovante ao suporte. A liberação será registrada pelo Master e renovará a assinatura.</div>
            ${whatsapp ? `<a href="${waHref}" target="_blank" rel="noopener noreferrer" style="width:100%;max-width:440px;background:#22c55e;color:#fff;padding:12px;border-radius:8px;font-weight:800;font-size:.85rem;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;">💬 Enviar comprovante pelo WhatsApp (${Utils.escapeHtml(whatsappDisplay)})</a>` : ''}
          </div>
        </div>`;

      const input = document.getElementById('pix-copia-cola-input');
      if (input) input.value = pixPayload;
      const copyBtn = document.getElementById('pix-copy-btn');
      if (copyBtn) copyBtn.onclick = async () => {
        try { await navigator.clipboard.writeText(pixPayload); copyBtn.textContent = 'Copiado ✓'; }
        catch { input?.select(); document.execCommand?.('copy'); copyBtn.textContent = 'Copiado ✓'; }
      };
    } catch (err) {
      modal.innerHTML = `<div style="background:#0f1710;border:1px solid rgba(239,68,68,.45);border-radius:14px;width:100%;max-width:520px;padding:28px;color:#f0ead6;text-align:center;"><div style="font-size:2rem;margin-bottom:10px;">⚠️</div><div style="font-weight:900;color:#fff;margin-bottom:8px;">Não foi possível gerar a cobrança</div><div id="billing-error-text" style="color:#fca5a5;font-size:.86rem;"></div><button data-fb-click="Patch26Actions.removeById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="cobranca-pix-modal" style="margin-top:18px;padding:9px 18px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;cursor:pointer;">Fechar</button></div>`;
      const msg = document.getElementById('billing-error-text');
      if (msg) msg.textContent = err?.message || 'Erro de comunicação com o servidor.';
    }
  }};
