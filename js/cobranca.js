// js/cobranca.js — Módulo de Cobrança Financeira SaaS, Planos e Assinaturas das Construtoras

const Cobranca = {
  STORAGE_ASSINATURAS_KEY: 'finobra_assinaturas',
  STORAGE_FATURAS_KEY: 'finobra_faturas',

  PLANOS: {
    'starter': {
      id: 'starter',
      nome: 'Plano Básico',
      limiteObras: 3,
      valorMensal: 79.90,
      valorTexto: 'R$ 79,90 / mês',
      badge: '3 OBRAS',
      destaque: false,
      recursos: [
        'Até 3 Obras Ativas simultâneas',
        'Controle Financeiro de Receitas e Despesas',
        'Medições & Cronograma de Engenharia',
        'Conciliação Bancária OFX',
        'Exportação de Relatórios Excel/PDF',
        'Suporte Técnico via WhatsApp e Sistema'
      ]
    },
    'pro': {
      id: 'pro',
      nome: 'Plano Profissional',
      limiteObras: 10,
      valorMensal: 119.90,
      valorTexto: 'R$ 119,90 / mês',
      badge: '10 OBRAS • MAIS POPULAR',
      destaque: true,
      recursos: [
        'Até 10 Obras Ativas simultâneas',
        'Tudo do Plano Básico',
        'Leitura OCR de Notas Fiscais com IA',
        'Assinatura Eletrônica SHA-256 com QR Code',
        'Portal Público de Validação de Documentos',
        'Gestão de Fornecedores & Ordens de Compra',
        'Suporte Prioritário'
      ]
    },
    'unlimited': {
      id: 'unlimited',
      nome: 'Construtora Ilimitado',
      limiteObras: 9999,
      valorMensal: 159.90,
      valorTexto: 'R$ 159,90 / mês',
      badge: 'OBRAS ILIMITADAS • MASTER',
      destaque: false,
      recursos: [
        'Obras e Clientes ILIMITADOS',
        'Tudo do Plano Profissional',
        'Multi-usuários com controle de permissões',
        'Importação direta de Planilhas SINAPI / Caixa',
        'Onboarding VIP com engenheiro especialista',
        'WhatsApp de Plantão Direto (95) 99136-3678'
      ]
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

  // ── RENDERIZAÇÃO DA TELA DE PLANOS E ASSINATURA (/app/planos) ────────────────
  renderTelaPlanos(containerId = 'route-content') {
    const el = document.getElementById(containerId);
    if (!el) return;

    const assAtual = this.getAssinaturaAtual();
    const u = (typeof Auth !== 'undefined' && Auth.getUser()) || {};
    const emp = (typeof DB !== 'undefined' && DB.getEmpresa()) || {};
    const canManageBilling = ['admin','superadmin'].includes(String(u.perfil || '').toLowerCase());
    const empresaNomeSeguro = Utils.escapeHtml(emp.nome_fantasia || emp.razao_social || u.empresaNome || 'sua construtora');

    el.innerHTML = `
      <div style="max-width:1100px;margin:0 auto;padding:10px 0 40px;">
        
        <!-- Header -->
        <div style="text-align:center;margin-bottom:34px;">
          <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(201,162,39,.12);border:1px solid rgba(201,162,39,.35);padding:6px 16px;border-radius:20px;color:var(--accent2);font-size:.8rem;font-weight:700;margin-bottom:12px;">
            <span>💎</span><span>Planos &amp; Mensalidades FinObra</span>
          </div>
          <h2 style="font-size:1.8rem;font-weight:900;color:#fff;margin-bottom:8px;">
            Potencialize a gestão das suas obras
          </h2>
          <p style="color:#94a3b8;font-size:.9rem;max-width:620px;margin:0 auto;">
            Escolha o plano ideal para a <strong>${empresaNomeSeguro}</strong> e tenha controle total de obras, medições, notas fiscais e conciliação bancária.
          </p>
        </div>

        <!-- Status da Assinatura Atual -->
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);border:1px solid rgba(201,162,39,.4);border-radius:12px;padding:16px 24px;margin-bottom:30px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <div style="width:48px;height:48px;border-radius:12px;background:rgba(201,162,39,.2);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">
              💳
            </div>
            <div>
              <div style="font-size:.78rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">Seu Plano Atual</div>
              <div style="font-size:1.15rem;font-weight:900;color:var(--accent2);">
                ${this.PLANOS[assAtual.planoId]?.nome || 'Plano Profissional'} &bull; <span style="font-size:.85rem;color:${assAtual.status === 'ativo' ? '#22c55e' : (assAtual.status === 'trial' ? '#f59e0b' : '#ef4444')};">${Utils.escapeHtml(assAtual.status || 'trial')}</span>
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
            <div style="text-align:right;">
              <div style="font-size:.72rem;color:#94a3b8;">Próximo Vencimento:</div>
              <div style="font-weight:800;font-size:.92rem;color:#fff;">${assAtual.vencimento ? (Utils.formatDate ? Utils.formatDate(assAtual.vencimento) : assAtual.vencimento) : 'Definido pela assinatura'}</div>
            </div>
            ${canManageBilling ? `<button data-fb-click="Cobranca.abrirModalPagamentoPix" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(assAtual.planoId))}" class="btn-primary" style="padding:10px 18px;border-radius:8px;font-weight:800;display:inline-flex;align-items:center;gap:6px;font-size:.85rem;"><span>⚡ Pagar Mensalidade via PIX</span></button>` : `<span style="font-size:.78rem;color:#94a3b8;">Somente o administrador pode gerar cobranças.</span>`}
          </div>
        </div>

        <div id="finobra-plan-usage" style="margin:-12px 0 26px;padding:12px 16px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.025);font-size:.82rem;color:#94a3b8;">
          Consultando uso atual do plano…
        </div>

        <!-- Grid de Planos -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:24px;align-items:stretch;">
          ${Object.values(this.PLANOS).map(p => this._renderCardPlano(p, assAtual.planoId === p.id, canManageBilling)).join('')}
        </div>
        <div id="finobra-billing-history" style="margin-top:24px;"></div>

      </div>
    `;
    this._carregarUsoPlano();
  },

  async _carregarUsoPlano() {
    const box = document.getElementById('finobra-plan-usage');
    if (!box) return;
    try {
      const headers = (typeof DB !== 'undefined' && DB._apiHeaders) ? DB._apiHeaders() : {};
      const u = (typeof Auth !== 'undefined' && Auth.getUser()) || {};
      const canManageBilling = ['admin','superadmin'].includes(String(u.perfil || '').toLowerCase());
      const res = canManageBilling ? await fetch('/api/plano?billing=1', { headers }) : await fetch('/api/plano', { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.plan) throw new Error(json.error || 'Falha ao consultar o plano');
      const p = json.plan;
      const limite = p.maxActiveObras == null ? 'Ilimitado' : `${p.maxActiveObras}`;
      const restante = p.maxActiveObras == null ? 'sem limite' : `${p.usage.remainingActiveObras} restante(s)`;
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap;">
          <span><strong style="color:#fff;">Uso real no servidor:</strong> ${Number(p.usage.activeObras)||0} obra(s) ativa(s) de ${limite}.</span>
          <span style="color:${p.maxActiveObras != null && p.usage.remainingActiveObras === 0 ? '#f59e0b' : '#22c55e'};font-weight:800;">${restante}</span>
        </div>`;
      const hist = document.getElementById('finobra-billing-history');
      if (hist && Array.isArray(json.invoices)) {
        const statusMap = { pending:'🟡 Pendente', paid:'🟢 Pago', expired:'⚪ Expirado', canceled:'🔴 Cancelado' };
        hist.innerHTML = `<div style="font-weight:900;color:#fff;margin-bottom:10px;">Últimas cobranças</div>${json.invoices.length ? `<div style="display:flex;flex-direction:column;gap:8px;">${json.invoices.slice(0,6).map(i => `<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.02);font-size:.78rem;"><span>${Utils.escapeHtml(statusMap[i.status] || i.status || '—')} &bull; ${Utils.escapeHtml(String(i.plan_id || ''))}</span><span style="font-weight:800;color:#fff;">R$ ${(Number(i.amount_cents||0)/100).toFixed(2).replace('.', ',')}</span><span style="color:#94a3b8;font-family:monospace;">${Utils.escapeHtml(String(i.txid || ''))}</span></div>`).join('')}</div>` : `<div style="font-size:.8rem;color:#64748b;">Nenhuma cobrança registrada ainda.</div>`}`;
      }
    } catch (e) {
      box.textContent = 'Não foi possível consultar o uso do plano agora.';
    }
  },

  _renderCardPlano(plano, isAtual, canManageBilling = false) {
    const isPro = plano.destaque;
    return `
      <div style="
        background:${isPro ? 'linear-gradient(145deg, #1C2D12, #2A3F1B)' : 'rgba(255,255,255,.02)'};
        border:1px solid ${isPro ? 'var(--accent)' : 'rgba(255,255,255,.08)'};
        border-radius:16px;padding:28px 24px;display:flex;flex-direction:column;justify-content:space-between;
        position:relative;box-shadow:${isPro ? '0 12px 36px rgba(201,162,39,.15)' : 'none'};">
        
        ${plano.badge ? `
          <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:${isPro ? 'var(--accent)' : 'rgba(201,162,39,.2)'};color:${isPro ? '#0f1710' : 'var(--accent2)'};border:1px solid var(--accent);padding:3px 14px;border-radius:20px;font-size:.68rem;font-weight:900;letter-spacing:.06em;">
            ${plano.badge}
          </div>
        ` : ''}

        <div>
          <h3 style="font-size:1.25rem;font-weight:900;color:${isPro ? 'var(--accent2)' : '#fff'};margin-bottom:6px;">
            ${plano.nome}
          </h3>
          <div style="display:flex;align-items:baseline;gap:4px;margin:16px 0 20px;">
            <span style="font-size:2.2rem;font-weight:900;color:#fff;">R$ ${plano.valorMensal.toFixed(2).replace('.', ',')}</span>
            <span style="font-size:.85rem;color:#94a3b8;">/mês</span>
          </div>

          <div style="height:1px;background:rgba(255,255,255,.08);margin-bottom:20px;"></div>

          <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px;">
            ${plano.recursos.map(r => `
              <li style="display:flex;align-items:flex-start;gap:10px;font-size:.84rem;color:#e2e8f0;line-height:1.4;">
                <span style="color:#22c55e;font-size:.9rem;flex-shrink:0;">✓</span>
                <span>${r}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <div style="margin-top:28px;">
          ${isAtual ? `
            <button disabled style="width:100%;padding:12px;border-radius:8px;background:rgba(201,162,39,.15);border:1px solid var(--accent);color:var(--accent2);font-weight:800;font-size:.85rem;cursor:default;">
              ✓ Seu Plano Atual
            </button>
          ` : canManageBilling ? `
            <button data-fb-click="Cobranca.selecionarPlano" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(plano.id))}" style="width:100%;padding:12px;border-radius:8px;background:${isPro ? 'var(--accent)' : 'rgba(255,255,255,.06)'};border:1px solid ${isPro ? 'var(--accent)' : 'rgba(255,255,255,.2)'};color:${isPro ? '#0f1710' : '#fff'};font-weight:900;font-size:.85rem;cursor:pointer;transition:all .2s;">
              Fazer Upgrade Agora ↗
            </button>
          ` : `<button disabled style="width:100%;padding:12px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);color:#64748b;font-weight:800;font-size:.82rem;">Administrador necessário</button>`}
        </div>

      </div>
    `;
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
