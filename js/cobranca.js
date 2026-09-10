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
            <button onclick="Cobranca.abrirModalPagamentoPix('${assAtual.planoId}')" class="btn-primary" style="padding:10px 18px;border-radius:8px;font-weight:800;display:inline-flex;align-items:center;gap:6px;font-size:.85rem;">
              <span>⚡ Pagar Mensalidade via PIX</span>
            </button>
          </div>
        </div>

        <div id="finobra-plan-usage" style="margin:-12px 0 26px;padding:12px 16px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.025);font-size:.82rem;color:#94a3b8;">
          Consultando uso atual do plano…
        </div>

        <!-- Grid de Planos -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:24px;align-items:stretch;">
          ${Object.values(this.PLANOS).map(p => this._renderCardPlano(p, assAtual.planoId === p.id)).join('')}
        </div>

      </div>
    `;
    this._carregarUsoPlano();
  },

  async _carregarUsoPlano() {
    const box = document.getElementById('finobra-plan-usage');
    if (!box) return;
    try {
      const headers = (typeof DB !== 'undefined' && DB._apiHeaders) ? DB._apiHeaders() : {};
      const res = await fetch('/api/plano', { headers });
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
    } catch (e) {
      box.textContent = 'Não foi possível consultar o uso do plano agora.';
    }
  },

  _renderCardPlano(plano, isAtual) {
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
          ` : `
            <button onclick="Cobranca.selecionarPlano('${plano.id}')" style="width:100%;padding:12px;border-radius:8px;background:${isPro ? 'var(--accent)' : 'rgba(255,255,255,.06)'};border:1px solid ${isPro ? 'var(--accent)' : 'rgba(255,255,255,.2)'};color:${isPro ? '#0f1710' : '#fff'};font-weight:900;font-size:.85rem;cursor:pointer;transition:all .2s;">
              Fazer Upgrade Agora ↗
            </button>
          `}
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
  abrirModalPagamentoPix(planoId) {
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

    const chavePix = '95991363678';
    const codigoCopiaCola = `00020126360014BR.GOV.BCB.PIX0111${chavePix}520400005303986540${plano.valorMensal.toFixed(2)}5802BR5915FINOBRA SISTEMA6008BOAVISTA62070503***6304`;

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:540px;box-shadow:0 24px 60px rgba(0,0,0,.85);overflow:hidden;color:#f0ead6;font-family:inherit;">
        
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">⚡</span>
            <div>
              <div style="font-weight:800;font-size:1rem;color:var(--accent2);">Pagamento via PIX Instantâneo</div>
              <div style="font-size:.75rem;color:#94a3b8;">${plano.nome} &bull; R$ ${plano.valorMensal.toFixed(2).replace('.', ',')}</div>
            </div>
          </div>
          <button onclick="document.getElementById('cobranca-pix-modal').remove()" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <div style="padding:22px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;">
          
          <div style="font-size:.85rem;color:#cbd5e1;max-width:440px;">
            Abra o app do seu banco e escaneie o QR Code abaixo para pagar a assinatura do <strong>FinObra</strong>:
          </div>

          <!-- QR Code Simulado / Gerado com API de QR Code -->
          <div style="background:#fff;padding:12px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.5);border:2px solid var(--accent);">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(codigoCopiaCola)}" alt="QR Code PIX" style="display:block;width:180px;height:180px;">
          </div>

          <div>
            <div style="font-size:.75rem;color:#94a3b8;margin-bottom:4px;">Chave PIX (Celular / WhatsApp):</div>
            <div style="font-weight:900;font-size:1.1rem;color:var(--accent2);letter-spacing:.05em;">
              (95) 99136-3678
            </div>
          </div>

          <!-- Campo Copia e Cola -->
          <div style="width:100%;max-width:440px;">
            <div style="display:flex;gap:8px;">
              <input type="text" id="pix-copia-cola-input" value="${codigoCopiaCola}" readonly style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 12px;color:#cbd5e1;font-size:.75rem;font-family:monospace;">
              <button onclick="navigator.clipboard.writeText(document.getElementById('pix-copia-cola-input').value);alert('Código PIX Copia e Cola copiado com sucesso!');" style="background:var(--accent);border:none;color:#0f1710;padding:8px 14px;border-radius:8px;font-size:.78rem;font-weight:800;cursor:pointer;white-space:nowrap;">
                Copiar Código 📋
              </button>
            </div>
          </div>

          <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:10px 14px;font-size:.8rem;color:#22c55e;width:100%;max-width:440px;">
            ✓ Após o pagamento, envie o comprovante pelo WhatsApp <strong>(95) 99136-3678</strong> para liberação imediata.
          </div>

          <div style="display:flex;gap:10px;width:100%;max-width:440px;">
            <a href="https://wa.me/5595991363678?text=${encodeURIComponent(`Olá! Acabei de realizar o pagamento PIX da assinatura do FinObra (${plano.nome} - R$ ${plano.valorMensal.toFixed(2)}) para a empresa ${emp.nome_fantasia || u.empresaNome || 'minha construtora'}. Segue o comprovante:`)}" target="_blank" style="flex:1;background:#22c55e;color:#fff;padding:12px;border-radius:8px;font-weight:800;font-size:.85rem;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;">
              <span>💬 Enviar Comprovante no WhatsApp</span>
            </a>
          </div>

        </div>

      </div>
    `;
  }
};
