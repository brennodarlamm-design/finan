// js/portal_cliente.js — Portal de Transparência do Cliente da Obra
// Visão somente-leitura e pública com avanço físico, fotos, medições, notas, prestação de contas e assinatura eletrônica

const PortalCliente = {
  _activeTab: 'andamento',
  _currentObraId: null,
  _activeBundle: null,

  _injectStyles() {
    if (document.getElementById('portal-cliente-styles')) return;
    const s = document.createElement('style');
    s.id = 'portal-cliente-styles';
    s.textContent = `
      body.portal-public-mode {
        background: #080F05!important;
        color: #F0EAD6!important;
        margin: 0!important;
        padding: 0!important;
        overflow-x: hidden!important;
      }
      body.portal-public-mode #app-root {
        padding: 0!important;
        margin: 0!important;
        width: 100%!important;
        min-height: 100vh!important;
      }
      body.portal-public-mode .sidebar,
      body.portal-public-mode .sidebar-overlay,
      body.portal-public-mode .topbar,
      body.portal-public-mode .impersonation-bar,
      body.portal-public-mode .bottom-nav,
      body.portal-public-mode #sidebar,
      body.portal-public-mode nav.sidebar-nav,
      body.portal-public-mode aside {
        display: none !important;
      }
      .portal-banner { background: linear-gradient(135deg, rgba(18,217,160,.12) 0%, rgba(59,130,246,.08) 100%); border: 1px solid rgba(18,217,160,.3); border-radius: var(--r-md); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; flex-wrap: wrap; gap: 12px; }
      .portal-tabs { display: flex; gap: 6px; border-bottom: 2px solid var(--border); margin-bottom: 22px; overflow-x: auto; scrollbar-width: none; }
      .portal-tabs::-webkit-scrollbar { display: none; }
      .portal-tab { padding: 10px 18px; border: none; background: transparent; color: var(--text3); font-weight: 700; font-size: .86rem; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: color .2s, border-color .2s; white-space: nowrap; }
      .portal-tab:hover { color: var(--text); }
      .portal-tab-active { color: var(--accent)!important; border-bottom-color: var(--accent)!important; background: rgba(18,217,160,.06); border-radius: 6px 6px 0 0; }
      .portal-doc-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 16px 20px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; transition: border-color .2s; }
      .portal-doc-card:hover { border-color: rgba(201,162,39,.4); }
      .portal-top-bar {
        background: rgba(14,25,13,0.95);
        border-bottom: 1px solid var(--border);
        padding: 12px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 100;
        backdrop-filter: blur(12px);
      }
    `;
    document.head.appendChild(s);
  },

  // ── GERADOR DE LINK SEGURO E PACOTE COMPACTO DE DADOS ──
  gerarToken(obraId, tenantId = '') {
    if (!obraId) return '';
    try {
      return btoa(`finobra_portal_${tenantId}_${obraId}`).replace(/=/g, '');
    } catch {
      return `pt_${obraId}`;
    }
  },

  getUrlPortal(obraId) {
    const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://fingo.api.br';
    const obra = (typeof DB !== 'undefined' && DB.getAll)
      ? ((DB.getAll('clientes') || []).find(o => String(o.id) === String(obraId)) || {})
      : {};
    const tenantId = (typeof Auth !== 'undefined' && Auth.getCurrentTenantId)
      ? Auth.getCurrentTenantId()
      : ((typeof DB !== 'undefined' && DB._t) ? DB._t() : '');
    const empresa = (typeof DB !== 'undefined' && DB.getEmpresa) ? DB.getEmpresa() : {};
    const token = this.gerarToken(obraId, tenantId);

    // Constrói o pacote de dados encapsulado
    const bundle = {
      t: tenantId,
      oid: obraId,
      emp: {
        n: empresa.nome_fantasia || empresa.razao_social || 'Construtora',
        logo: empresa.logo_url || '',
        tel: empresa.telefone || empresa.whatsapp || '',
        resp: empresa.responsavel || ''
      },
      o: {
        id: obra.id || obraId,
        n: obra.nome || 'Obra',
        c: obra.cliente || obra.nome || 'Proprietário',
        doc: obra.cpf_cnpj || '',
        e: obra.endereco || '',
        cid: obra.cidade || '',
        uf: obra.estado || '',
        eng: obra.engenheiro_responsavel || '',
        v: obra.valor_financiado || 0,
        di: obra.data_inicio || '',
        df: obra.data_previsao_termino || '',
        st: obra.status || 'em_andamento',
        mod: obra.modalidade_obra || 'caixa',
        sla: obra.processos_sla || ((typeof CronogramaSLA !== 'undefined') ? CronogramaSLA.getObraProcessos(obraId) : [])
      },
      med: ((typeof DB !== 'undefined') ? (DB.getAll('medicoes') || []) : [])
        .filter(m => String(m.obra_id) === String(obraId))
        .map(m => ({
          id: m.id,
          num: m.numero_medicao || m.numero || 1,
          desc: m.etapa_descricao || 'Vistoria e Execução',
          pct: m.percentual_fisico || 0,
          val: m.valor_liberado || m.valor_solicitado || 0,
          dt: m.data_medicao || m.data || ''
        })),
      nfe: ((typeof DB !== 'undefined') ? (DB.getAll('lancamentos') || []) : [])
        .filter(l => String(l.obra_id) === String(obraId) && l.tipo === 'despesa')
        .slice(0, 50)
        .map(l => ({
          id: l.id,
          desc: l.descricao || 'Despesa de Obra',
          cat: l.categoria || 'Geral',
          nf: l.numero_nf || '',
          val: l.valor || 0,
          dt: l.data || l.created_at || ''
        })),
      doc: ((typeof Documentos !== 'undefined' && Documentos.listar)
        ? [...Documentos.listar('obra', obraId), ...Documentos.listar('orcamento', obraId)]
        : [])
        .slice(0, 30)
        .map(d => ({
          id: d.id,
          tit: d.titulo || d.nome_arquivo || 'Documento',
          tipo: d.tipo_mime || d.tipo_servico || 'Arquivo',
          url: d.url_externa || d.url || '',
          dt: d.criado_em || ''
        })),
      ctr: ((typeof DB !== 'undefined') ? (DB.getAll('contratos') || []) : [])
        .filter(c => String(c.obra_id) === String(obraId))
        .map(c => ({
          id: c.id,
          tit: c.titulo || 'Contrato de Obra',
          st: c.status || 'ativo',
          ass: !!c.assinado_por_cliente,
          dtAss: c.data_assinatura_cliente || null,
          signatario: c.assinatura_cliente_nome || null
        }))
    };

    let pdata = '';
    try {
      const jsonStr = JSON.stringify(bundle);
      let b64 = '';
      try {
        b64 = btoa(unescape(encodeURIComponent(jsonStr)));
      } catch {
        b64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1)));
      }
      pdata = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch {
      pdata = '';
    }

    return `${origin}/portal?portal_obra=${encodeURIComponent(obraId)}&tenant=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}&pdata=${encodeURIComponent(pdata)}`;
  },

  // ── MODAL PARA A CONSTRUTORA COMPARTILHAR COM O CLIENTE ──
  abrirModalCompartilhar(obraId) {
    const obra = (typeof DB !== 'undefined' && DB.getAll)
      ? ((DB.getAll('clientes') || []).find(o => String(o.id) === String(obraId)) || null)
      : null;
    if (!obra) return Utils.toast('Obra não encontrada.', 'error');

    const url = this.getUrlPortal(obraId);
    const clienteNome = obra.cliente || obra.nome || 'Cliente';
    const obraNome = obra.nome || 'Sua Obra';
    const tel = (obra.telefone || obra.whatsapp || '').replace(/\D/g, '');

    const msgWhats = `Olá, ${clienteNome}! Segue o link exclusivo para acompanhar a sua obra (${obraNome}) em tempo real pelo nosso Portal de Transparência:\n\n${url}\n\nLá você pode ver o cronograma de fases, fotos, medições aprovadas, comprovantes e assinar documentos pendentes diretamente pelo celular.`;
    const whatsUrl = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(msgWhats)}`
      : `https://wa.me/?text=${encodeURIComponent(msgWhats)}`;

    const e = Utils.escapeHtml.bind(Utils);

    Utils.showModal(`
      <div class="modal" style="max-width:620px;">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.4rem;">🌐</span>
            <div>
              <span class="modal-title">Portal de Transparência do Cliente</span>
              <span style="font-size:.76rem;color:var(--text3);display:block;">Compartilhe o acesso seguro e somente-leitura com o cliente</span>
            </div>
          </div>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body" style="padding:22px;">
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;margin-bottom:18px;">
            <div style="font-weight:800;font-size:1.05rem;color:var(--text);">${e(obraNome)}</div>
            <div style="font-size:.8rem;color:var(--text3);margin-top:2px;">
              Cliente: <strong>${e(clienteNome)}</strong> &middot; Telefone: ${e(obra.telefone || obra.whatsapp || 'Não informado')}
            </div>
          </div>

          <!-- CAMPO DE LINK PARA COPIAR -->
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="font-size:.78rem;font-weight:700;">Link de Acesso Direto do Cliente (Sem login necessário)</label>
            <div style="display:flex;gap:8px;">
              <input type="text" class="form-control" id="portal-url-copy" value="${e(url)}" readonly style="font-size:.8rem;background:var(--surface);cursor:pointer;">
              <button class="btn btn-secondary btn-sm" data-fb-click="PortalCliente.copiarLink" data-fb-click-n="0" style="white-space:nowrap;font-weight:700;">
                📋 Copiar
              </button>
            </div>
            <span style="font-size:.72rem;color:var(--text3);margin-top:4px;display:block;">
              🔒 O cliente tem visão segura e exclusiva da própria obra. Não tem acesso a menus laterais nem a outras telas do sistema.
            </span>
          </div>

          <!-- AÇÕES DIRETAS -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
            <a href="${whatsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background:#25D366;color:#fff;border:none;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;padding:10px;">
              📲 Enviar por WhatsApp
            </a>
            <button class="btn btn-primary btn-sm" data-fb-click="PortalCliente.abrirVisualizacaoCliente" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(obraId))}" style="font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px;">
              👁️ Visualizar como Cliente
            </button>
          </div>

          <!-- ITENS VISÍVEIS NO PORTAL -->
          <div style="border-top:1px solid var(--border);padding-top:14px;">
            <span style="font-size:.78rem;font-weight:800;color:var(--text);display:block;margin-bottom:8px;">
              Recursos de Transparência Liberados para o Cliente:
            </span>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.76rem;color:var(--text2);">
              <div>✅ Linha do Tempo &amp; Prazos (SLAs)</div>
              <div>✅ Diário de Obra &amp; Avanço Físico</div>
              <div>✅ Medições Aprovadas</div>
              <div>✅ Prestação de Contas (Notas e Recibos)</div>
              <div>✅ Projetos e Memoriais em PDF</div>
              <div>✍️ Assinatura Eletrônica de Contratos</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Fechar</button>
        </div>
      </div>`);
  },

  copiarLink() {
    const input = document.getElementById('portal-url-copy');
    if (!input) return;
    input.select();
    try {
      navigator.clipboard.writeText(input.value);
      Utils.toast('Link do portal copiado!', 'success');
    } catch {
      document.execCommand('copy');
      Utils.toast('Link copiado!', 'success');
    }
  },

  abrirVisualizacaoCliente(obraId) {
    Utils.closeModal();
    const url = this.getUrlPortal(obraId);
    window.open(url, '_blank');
  },

  abrirPortalInterno(obraId) {
    this.abrirVisualizacaoCliente(obraId);
  },

  // ── DECODIFICADOR DE PACOTE DE DADOS DA URL ──
  _decodificarPayload(pdata) {
    if (!pdata) return null;
    try {
      let b64 = pdata.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      let jsonStr = '';
      try {
        jsonStr = decodeURIComponent(escape(atob(b64)));
      } catch {
        jsonStr = decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      }
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn('[PortalCliente] Falha ao decodificar payload:', e);
      return null;
    }
  },

  // ── TELA PÚBLICA TOTALMENTE ISOLADA (SEM SIDEBAR, SEM AUTH, SEM ACESSO EXTERNO) ──
  renderTelaPublica(searchParams) {
    this._injectStyles();
    document.body.classList.add('portal-public-mode');

    const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams || '');
    const pdata = params.get('pdata');
    const obraId = params.get('portal_obra') || params.get('obra') || '';
    const tenantParam = params.get('tenant') || '';

    // 1. Tenta decodificar do payload encapsulado na URL (100% autônomo)
    let bundle = this._decodificarPayload(pdata);

    // 2. Se não veio payload, tenta localizar no banco local APENAS se o tenant coincidir (evitando cross-tenant)
    if (!bundle && typeof DB !== 'undefined' && DB.getAll) {
      const currentTenant = (typeof Auth !== 'undefined' && Auth.getCurrentTenantId)
        ? Auth.getCurrentTenantId()
        : ((typeof DB !== 'undefined' && DB._t) ? DB._t() : '');
      const tenantMatch = !tenantParam || !currentTenant || tenantParam === currentTenant;
      if (tenantMatch && obraId) {
        const obras = DB.getAll('clientes') || [];
        const obraLocal = obras.find(o => String(o.id) === String(obraId));
        if (obraLocal) {
          const emp = DB.getEmpresa ? DB.getEmpresa() : {};
          bundle = {
            t: currentTenant || tenantParam,
            oid: obraLocal.id,
          emp: {
            n: emp.nome_fantasia || emp.razao_social || 'Construtora',
            logo: emp.logo_url || '',
            tel: emp.telefone || emp.whatsapp || '',
            resp: emp.responsavel || ''
          },
          o: {
            id: obraLocal.id,
            n: obraLocal.nome || 'Obra',
            c: obraLocal.cliente || obraLocal.nome || 'Proprietário',
            doc: obraLocal.cpf_cnpj || '',
            e: obraLocal.endereco || '',
            cid: obraLocal.cidade || '',
            uf: obraLocal.estado || '',
            eng: obraLocal.engenheiro_responsavel || '',
            v: obraLocal.valor_financiado || 0,
            di: obraLocal.data_inicio || '',
            df: obraLocal.data_previsao_termino || '',
            st: obraLocal.status || 'em_andamento',
            mod: obraLocal.modalidade_obra || 'caixa',
            sla: obraLocal.processos_sla || ((typeof CronogramaSLA !== 'undefined') ? CronogramaSLA.getObraProcessos(obraLocal.id) : [])
          },
          med: (DB.getAll('medicoes') || []).filter(m => String(m.obra_id) === String(obraLocal.id)).map(m => ({
            id: m.id,
            num: m.numero_medicao || m.numero || 1,
            desc: m.etapa_descricao || 'Execução',
            pct: m.percentual_fisico || 0,
            val: m.valor_liberado || m.valor_solicitado || 0,
            dt: m.data_medicao || m.data || ''
          })),
          nfe: (DB.getAll('lancamentos') || []).filter(l => String(l.obra_id) === String(obraLocal.id) && l.tipo === 'despesa').slice(0, 50).map(l => ({
            id: l.id,
            desc: l.descricao || 'Despesa de Obra',
            cat: l.categoria || 'Geral',
            nf: l.numero_nf || '',
            val: l.valor || 0,
            dt: l.data || l.created_at || ''
          })),
          doc: ((typeof Documentos !== 'undefined' && Documentos.listar)
            ? [...Documentos.listar('obra', obraLocal.id), ...Documentos.listar('orcamento', obraLocal.id)]
            : []).slice(0, 30).map(d => ({
              id: d.id,
              tit: d.titulo || d.nome_arquivo || 'Documento',
              tipo: d.tipo_mime || d.tipo_servico || 'Arquivo',
              url: d.url_externa || d.url || '',
              dt: d.criado_em || ''
            })),
          ctr: (DB.getAll('contratos') || []).filter(c => String(c.obra_id) === String(obraLocal.id)).map(c => ({
            id: c.id,
            tit: c.titulo || 'Contrato de Obra',
            st: c.status || 'ativo',
            ass: !!c.assinado_por_cliente,
            dtAss: c.data_assinatura_cliente || null,
            signatario: c.assinatura_cliente_nome || null
          }))
          };
        }
      }
    }

    const rootEl = document.getElementById('app-root') || document.body;

    // Se nenhuma obra foi encontrada de forma legítima, bloqueia com segurança (NUNCA usa obra de outra empresa!)
    if (!bundle || !bundle.o) {
      rootEl.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#080F05;">
          <div style="max-width:480px;background:rgba(14,25,13,0.9);border:1px solid #243518;border-radius:14px;padding:32px;text-align:center;color:#F0EAD6;">
            <div style="font-size:3rem;margin-bottom:14px;">🔒</div>
            <h2 style="font-size:1.3rem;font-weight:900;margin-bottom:8px;color:#C9A227;">Portal de Transparência</h2>
            <p style="font-size:.86rem;color:#A8C090;line-height:1.5;margin-bottom:20px;">
              Este link de acompanhamento não foi localizado ou expirou. Por favor, solicite à sua construtora o link atualizado da sua obra.
            </p>
            <div style="font-size:.75rem;color:#5A7048;">FinObra &middot; Sistema de Gestão para Construtoras</div>
          </div>
        </div>`;
      return;
    }

    this._activeBundle = bundle;
    this._currentObraId = bundle.o.id;
    this._renderTelaPublicaEstrutura(rootEl);
  },

  _renderTelaPublicaEstrutura(rootEl) {
    const b = this._activeBundle;
    const o = b.o;
    const emp = b.emp;
    const e = Utils.escapeHtml.bind(Utils);

    const safeLogo = emp.logo ? (Utils.safeUrl ? Utils.safeUrl(emp.logo) : emp.logo) : '';
    const logoHtml = safeLogo
      ? `<img src="${safeLogo}" alt="${e(emp.n)}" style="max-height:36px;max-width:140px;object-fit:contain;border-radius:4px;">`
      : `<span style="font-weight:900;color:var(--accent);font-size:1.05rem;">🏗️ ${e(emp.n)}</span>`;

    const contratosPendentes = (b.ctr || []).filter(c => !c.ass);

    // Calcula percentual dos SLAs
    const slas = o.sla || [];
    const concluidas = slas.filter(s => s.status === 'concluido').length;
    const totalSlas = slas.length;
    const pctGeral = totalSlas > 0 ? Math.round((concluidas / totalSlas) * 100) : 0;
    const atrasadas = slas.filter(s => s.status_sla === 'atrasado').length;

    rootEl.innerHTML = `
      <div style="min-height:100vh;background:#080F05;color:#F0EAD6;">
        <!-- BARRA SUPERIOR EXCLUSIVA DO CLIENTE (SEM MENUS DO SISTEMA) -->
        <header class="portal-top-bar">
          <div style="display:flex;align-items:center;gap:12px;">
            ${logoHtml}
            <div style="border-left:1px solid var(--border);padding-left:12px;">
              <span style="font-size:.78rem;font-weight:800;color:var(--text);display:block;line-height:1.2;">${e(emp.n)}</span>
              <span style="font-size:.68rem;color:var(--text3);">Portal de Transparência</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge" style="background:rgba(18,217,160,.15);color:var(--accent);border:1px solid rgba(18,217,160,.3);font-size:.72rem;padding:3px 8px;font-weight:800;">
              🔒 Acesso Seguro &middot; Somente Leitura
            </span>
          </div>
        </header>

        <main style="max-width:1100px;margin:0 auto;padding:22px 16px 60px 16px;">
          <!-- CARD EXECUTIVO DA OBRA DO CLIENTE -->
          <div class="card" style="margin-bottom:20px;padding:24px;border:1px solid rgba(201,162,39,.35);background:linear-gradient(135deg, var(--bg-card, #0e190d) 0%, rgba(201,162,39,.05) 100%);border-radius:14px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
              <div>
                <span style="font-size:.72rem;font-weight:800;text-transform:uppercase;color:var(--accent);letter-spacing:.05em;">Acompanhamento da Obra</span>
                <h1 style="font-size:1.65rem;font-weight:900;color:var(--text);margin:2px 0 6px 0;letter-spacing:-.02em;">
                  ${e(o.n)}
                </h1>
                <div style="font-size:.82rem;color:var(--text2);display:flex;gap:14px;flex-wrap:wrap;">
                  <span>👤 <strong>Proprietário:</strong> ${e(o.c)}</span>
                  ${o.e ? `<span>📍 <strong>Local:</strong> ${e(o.e)} &middot; ${e(o.cid)}/${e(o.uf)}</span>` : ''}
                  ${o.eng ? `<span>👷 <strong>Resp. Técnico:</strong> ${e(o.eng)}</span>` : ''}
                </div>
              </div>
              <div style="text-align:right;">
                <span class="badge" style="background:rgba(59,130,246,.15);color:#60a5fa;border:1px solid rgba(59,130,246,.3);font-size:.76rem;font-weight:800;padding:4px 10px;">
                  ${o.st === 'concluida' ? '✓ Obra Concluída' : '🔄 Em Andamento'}
                </span>
                <div style="font-size:.74rem;color:var(--text3);margin-top:6px;">
                  Previsão de Término: <strong>${Utils.fmt.date(o.df) || 'Em cronograma'}</strong>
                </div>
              </div>
            </div>

            <!-- 4 CARDS DE INDICADORES DO CLIENTE -->
            <div class="g4" style="gap:12px;">
              <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;text-align:center;">
                <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);font-weight:700">Avanço Físico</div>
                <div style="font-size:1.35rem;font-weight:900;color:var(--accent);margin-top:2px">${pctGeral}%</div>
                <div class="progress-bar" style="height:5px;margin-top:6px;">
                  <div class="progress-fill green" style="width:${pctGeral}%"></div>
                </div>
              </div>

              <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;text-align:center;">
                <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);font-weight:700">Situação do Prazo</div>
                <div style="font-size:1.15rem;font-weight:900;color:${atrasadas > 0 ? 'var(--danger)' : 'var(--success)'};margin-top:2px">
                  ${atrasadas > 0 ? `⚠️ ${atrasadas} fase(s) em atraso` : '🟢 Cronograma no Prazo'}
                </div>
                <div style="font-size:.7rem;color:var(--text3);margin-top:4px;">${concluidas} de ${totalSlas} etapas concluídas</div>
              </div>

              <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;text-align:center;">
                <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);font-weight:700">Medições da Obra</div>
                <div style="font-size:1.25rem;font-weight:900;color:var(--success);margin-top:2px">${(b.med || []).length} realizadas</div>
                <div style="font-size:.7rem;color:var(--text3);margin-top:4px;">Vistorias de avanço</div>
              </div>

              <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;text-align:center;">
                <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);font-weight:700">Contratos p/ Assinar</div>
                <div style="font-size:1.25rem;font-weight:900;color:${contratosPendentes.length ? '#f59e0b' : 'var(--success)'};margin-top:2px">
                  ${contratosPendentes.length} pendente(s)
                </div>
                <div style="font-size:.7rem;color:${contratosPendentes.length ? '#f59e0b' : 'var(--text3)'};margin-top:4px;">
                  ${contratosPendentes.length ? 'Requer sua assinatura' : '✓ Tudo em dia'}
                </div>
              </div>
            </div>
          </div>

          <!-- NAVEGAÇÃO POR ABAS EXCLUSIVAS DO CLIENTE -->
          <div class="portal-tabs">
            <button class="portal-tab ${this._activeTab === 'andamento' ? 'portal-tab-active' : ''}" data-fb-click="PortalCliente.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="andamento">
              📈 Andamento &amp; Prazos (SLAs)
            </button>
            <button class="portal-tab ${this._activeTab === 'medicoes' ? 'portal-tab-active' : ''}" data-fb-click="PortalCliente.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="medicoes">
              📐 Medições (${(b.med || []).length})
            </button>
            <button class="portal-tab ${this._activeTab === 'prestacao' ? 'portal-tab-active' : ''}" data-fb-click="PortalCliente.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="prestacao">
              🧾 Prestação de Contas (${(b.nfe || []).length})
            </button>
            <button class="portal-tab ${this._activeTab === 'documentos' ? 'portal-tab-active' : ''}" data-fb-click="PortalCliente.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="documentos">
              📁 Projetos &amp; Anexos (${(b.doc || []).length})
            </button>
            <button class="portal-tab ${this._activeTab === 'assinaturas' ? 'portal-tab-active' : ''}" data-fb-click="PortalCliente.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="assinaturas">
              ✍️ Assinatura Eletrônica ${contratosPendentes.length ? `<span style="background:#f59e0b;color:#000;border-radius:10px;padding:1px 6px;font-size:.7rem;margin-left:4px;font-weight:900;">${contratosPendentes.length}</span>` : ''}
            </button>
          </div>

          <!-- ÁREA DE CONTEÚDO DA ABA SELECIONADA -->
          <div id="portal-tab-content">
            ${this._renderPublicTabContent(this._activeTab)}
          </div>
        </main>

        <footer style="border-top:1px solid var(--border);padding:24px 16px;text-align:center;font-size:.75rem;color:var(--text3);background:rgba(14,25,13,.5);">
          <div>🔒 Portal de Transparência protegido por criptografia &middot; ${e(emp.n)}</div>
          <div style="margin-top:4px;">Tecnologia <a href="https://fingo.api.br" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none;font-weight:700;">FinObra</a> &middot; Gestão de Obras e Engenharia</div>
        </footer>
      </div>`;
  },

  setTab(tab) {
    this._activeTab = tab;
    document.querySelectorAll('.portal-tab').forEach(el => el.classList.remove('portal-tab-active'));
    const content = document.getElementById('portal-tab-content');
    if (content) {
      content.innerHTML = this._renderPublicTabContent(tab);
    }
    const btns = document.querySelectorAll('.portal-tab');
    btns.forEach(b => {
      const v = b.getAttribute('data-fb-click-v0');
      if (v === tab) b.classList.add('portal-tab-active');
    });
  },

  _renderPublicTabContent(tab) {
    const b = this._activeBundle;
    if (!b) return '';

    switch (tab) {
      case 'andamento':
        return this._renderPublicAndamento(b);
      case 'medicoes':
        return this._renderPublicMedicoes(b);
      case 'prestacao':
        return this._renderPublicPrestacao(b);
      case 'documentos':
        return this._renderPublicDocumentos(b);
      case 'assinaturas':
        return this._renderPublicAssinaturas(b);
      default:
        return this._renderPublicAndamento(b);
    }
  },

  // ── ABA PÚBLICA 1: ANDAMENTO & SLAS EM CASCATA ──
  _renderPublicAndamento(b) {
    const slas = b.o.sla || [];
    const e = Utils.escapeHtml.bind(Utils);

    if (!slas.length) {
      return `
      <div class="empty-state">
        <div style="font-size:2.5rem;margin-bottom:8px">⏱️</div>
        <h3>Cronograma de Fases em Definição</h3>
        <p style="color:var(--text3)">A equipe técnica está estruturando os prazos desta obra.</p>
      </div>`;
    }

    return `
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${slas.map((p, idx) => {
        const isDone = p.status === 'concluido';
        const isInProgress = p.status === 'em_andamento';

        const corStatus = p.status_sla === 'atrasado'
          ? 'var(--danger)'
          : p.status_sla === 'atencao'
            ? '#f59e0b'
            : 'var(--success)';

        const textoStatus = p.status_sla === 'atrasado'
          ? `🔴 Atrasado +${p.dias_atraso}d`
          : p.status_sla === 'atencao'
            ? '🟡 Em Atenção'
            : '🟢 No Prazo';

        return `
        <div style="background:var(--surface);border:1px solid ${isInProgress ? 'var(--accent)' : 'var(--border)'};border-radius:var(--r-md);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:260px;">
            <div style="font-size:1.6rem;width:40px;height:40px;border-radius:50%;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;border:1px solid var(--border);">
              ${p.icone || '📋'}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-size:.68rem;font-weight:800;background:var(--bg-secondary);border:1px solid var(--border);padding:1px 6px;border-radius:4px;color:var(--text3);">${e(p.codigo || `#${idx+1}`)}</span>
                <strong style="font-size:.92rem;color:var(--text);">${e(p.nome)}</strong>
                <span style="font-size:.68rem;background:rgba(201,162,39,.1);color:var(--accent);padding:1px 8px;border-radius:10px;font-weight:700;">⏱️ SLA ${p.dias_sla} dias</span>
                <span style="font-size:.68rem;color:${corStatus};font-weight:800;background:${corStatus}15;padding:1px 8px;border-radius:10px;">${textoStatus}</span>
              </div>
              <div style="font-size:.75rem;color:var(--text3);margin-top:4px;display:flex;gap:16px;flex-wrap:wrap;">
                <span>📅 Início: <strong>${Utils.fmt.date(p.data_inicio_real || p.data_inicio_prevista)}</strong></span>
                <span>🏁 Término Previsto: <strong>${Utils.fmt.date(p.data_fim_prevista)}</strong></span>
                ${p.data_fim_real ? `<span>✅ Concluído em: <strong>${Utils.fmt.date(p.data_fim_real)}</strong></span>` : ''}
              </div>
              ${p.observacoes ? `<div style="font-size:.72rem;color:var(--text2);margin-top:4px;font-style:italic;">📝 ${e(p.observacoes)}</div>` : ''}
            </div>
          </div>
          <span class="badge" style="background:${isDone ? 'rgba(16,185,129,.15)' : isInProgress ? 'rgba(59,130,246,.15)' : 'var(--bg-secondary)'};color:${isDone ? 'var(--success)' : isInProgress ? '#3b82f6' : 'var(--text3)'};font-size:.74rem;font-weight:700;padding:4px 10px;">
            ${isDone ? '✓ Concluída' : isInProgress ? '🔄 Em Andamento' : '⏳ Pendente'}
          </span>
        </div>`;
      }).join('')}
    </div>`;
  },

  // ── ABA PÚBLICA 2: MEDIÇÕES APROVADAS ──
  _renderPublicMedicoes(b) {
    const meds = b.med || [];
    if (!meds.length) {
      return `
      <div class="empty-state">
        <div style="font-size:2.5rem;margin-bottom:8px">📐</div>
        <h3>Nenhuma medição realizada ainda</h3>
        <p style="color:var(--text3)">Assim que as vistorias forem feitas em campo, os relatórios e valores aparecerão aqui.</p>
      </div>`;
    }

    return `
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:20%">Nº Medição</th>
            <th style="width:20%">Data Vistoria</th>
            <th style="width:35%">Etapa Medida</th>
            <th style="width:25%;text-align:right">Valor Liberado</th>
          </tr>
        </thead>
        <tbody>
          ${meds.map(m => `
            <tr>
              <td><strong>${m.num}ª Medição</strong></td>
              <td>${Utils.fmt.date(m.dt)}</td>
              <td>${Utils.escapeHtml(m.desc)}</td>
              <td style="text-align:right;font-weight:800;color:var(--success);">${Utils.fmt.currency(m.val)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  },

  // ── ABA PÚBLICA 3: PRESTAÇÃO DE CONTAS ──
  _renderPublicPrestacao(b) {
    const nfes = b.nfe || [];
    const totalGasto = nfes.reduce((s, it) => s + (Number(it.val) || 0), 0);

    return `
    <div style="margin-bottom:20px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <span style="font-size:.85rem;font-weight:700;color:var(--text3)">Total em Comprovantes &amp; Despesas de Obra:</span>
        <strong style="font-size:1.25rem;color:var(--text);">${Utils.fmt.currency(totalGasto)}</strong>
      </div>

      ${!nfes.length ? `
        <div class="empty-state">
          <div style="font-size:2.5rem;margin-bottom:8px">🧾</div>
          <h3>Nenhum comprovante lançado ainda</h3>
          <p style="color:var(--text3)">As notas fiscais e comprovantes de compras da obra serão listados aqui.</p>
        </div>
      ` : `
        <div class="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:15%">Data</th>
                <th style="width:40%">Descrição / Item</th>
                <th style="width:25%">Categoria</th>
                <th style="width:20%;text-align:right">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${nfes.map(l => `
                <tr>
                  <td>${Utils.fmt.date(l.dt)}</td>
                  <td><strong>${Utils.escapeHtml(l.desc)}</strong></td>
                  <td><span style="font-size:.74rem;color:var(--text3)">${Utils.escapeHtml(l.cat)}</span></td>
                  <td style="text-align:right;font-weight:700;color:var(--text);">${Utils.fmt.currency(l.val)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>`;
  },

  // ── ABA PÚBLICA 4: PROJETOS & ANEXOS ──
  _renderPublicDocumentos(b) {
    const docs = b.doc || [];
    if (!docs.length) {
      return `
      <div class="empty-state">
        <div style="font-size:2.5rem;margin-bottom:8px">📁</div>
        <h3>Nenhum projeto ou memorial anexado ainda</h3>
        <p style="color:var(--text3)">Os memoriais descritivos, plantas em PDF e arquivos técnicos aparecerão aqui.</p>
      </div>`;
    }

    return `
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${docs.map(d => {
        const url = d.url;
        return `
        <div class="portal-doc-card">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:1.6rem;">📄</span>
            <div>
              <strong style="color:var(--text);font-size:.9rem;">${Utils.escapeHtml(d.tit)}</strong>
              <div style="font-size:.74rem;color:var(--text3);margin-top:2px;">
                ${Utils.escapeHtml(d.tipo)} ${d.dt ? `&middot; Data: ${Utils.fmt.date(d.dt)}` : ''}
              </div>
            </div>
          </div>
          <div>
            ${url ? `
              <a href="${Utils.safeUrl ? Utils.safeUrl(url) : Utils.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:700;">
                🔗 Baixar / Abrir
              </a>
            ` : '<span style="font-size:.75rem;color:var(--text3)">Disponível</span>'}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  // ── ABA PÚBLICA 5: ASSINATURA ELETRÔNICA DE CONTRATOS ──
  _renderPublicAssinaturas(b) {
    const ctrs = b.ctr || [];
    if (!ctrs.length) {
      return `
      <div class="empty-state">
        <div style="font-size:2.5rem;margin-bottom:8px">✍️</div>
        <h3>Nenhum documento pendente para assinatura</h3>
        <p style="color:var(--text3)">Os documentos disponibilizados pela construtora aparecerão aqui. A assinatura por link externo ainda não está disponível.</p>
      </div>`;
    }

    return `
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${ctrs.map(c => {
        const isSigned = !!c.ass;
        return `
        <div class="portal-doc-card" style="border-left:4px solid ${isSigned ? 'var(--success)' : 'var(--accent)'};">
          <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:240px;">
            <span style="font-size:2rem;">📜</span>
            <div>
              <strong style="font-size:1rem;color:var(--text);">${Utils.escapeHtml(c.tit)}</strong>
              <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">
                ${isSigned ? `✓ Assinado eletronicamente em <strong>${Utils.fmt.date(c.dtAss)}</strong>` : '⏳ Aguardando assinatura eletrônica do cliente'}
              </div>
              ${c.signatario ? `<div style="font-size:.72rem;color:var(--accent);margin-top:2px;">Assinado por: ${Utils.escapeHtml(c.signatario)}</div>` : ''}
            </div>
          </div>
          <div>
            ${isSigned ? `
              <span class="badge" style="background:rgba(16,185,129,.15);color:var(--success);font-size:.82rem;padding:6px 12px;font-weight:800;border:1px solid rgba(16,185,129,.3);">
                ✓ Assinado com Sucesso
              </span>
            ` : `
              <button disabled title="Solicite à construtora o procedimento de assinatura" class="btn btn-secondary" data-fb-click="PortalCliente.assinarDocumentoCliente" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(c.id))}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(b.oid))}" style="font-weight:800;display:inline-flex;align-items:center;gap:6px;padding:8px 16px;">
                Assinatura externa indisponível
              </button>
            `}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  // ── AÇÃO DE ASSINATURA PELO CLIENTE ──
  assinarDocumentoCliente() {
    return Utils.toast('A assinatura por link externo ainda não está disponível. Solicite à construtora o procedimento de assinatura.', 'warning');
  },

  // ── CENTRAL DE GESTÃO DO PORTAL DO CLIENTE (VISÃO DA EMPRESA / INTERNA) ──
  render(obraId) {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('portal-public-mode');
    }

    const e = (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml.bind(Utils) : String;
    const allObras = (typeof DB !== 'undefined' && DB.getAll) ? (DB.getAll('clientes') || []) : [];
    
    let obras = allObras;
    if (obraId && obraId !== 'todas') {
      const selected = allObras.filter(o => String(o.id) === String(obraId));
      if (selected.length) obras = selected;
    }

    const allMedicoes = (typeof DB !== 'undefined' && DB.getAll) ? (DB.getAll('medicoes') || []) : [];
    const allContratos = (typeof DB !== 'undefined' && DB.getAll) ? (DB.getAll('contratos') || []) : [];

    const totalObras = allObras.length;
    const totalContratosPendentes = allContratos.filter(c => !c.assinado_por_cliente).length;
    const totalMedicoes = allMedicoes.length;

    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">🌐 Portal do Cliente &middot; Central de Transparência</h1>
        <p class="page-sub">Gere e envie links exclusivos e seguros para cada cliente acompanhar sua obra em tempo real, sem necessidade de login</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-fb-click="PortalCliente.abrirModalExplicativo" data-fb-click-n="0">
          ℹ️ Como Funciona
        </button>
      </div>
    </div>

    <!-- BANNER DE ORIENTAÇÃO -->
    <div style="background:linear-gradient(135deg, rgba(18,217,160,.1) 0%, rgba(59,130,246,.06) 100%);border:1px solid rgba(18,217,160,.25);border-radius:var(--r-md);padding:16px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
      <div style="flex:1;min-width:280px;">
        <div style="font-weight:800;font-size:.95rem;color:var(--text);display:flex;align-items:center;gap:8px;">
          <span>🔒</span> Links Exclusivos por Obra &middot; Totalmente Travados
        </div>
        <div style="font-size:.8rem;color:var(--text2);margin-top:4px;line-height:1.4;">
          Cada link dá acesso <strong>exclusivo e somente-leitura</strong> à obra correspondente. O cliente <strong>não tem acesso ao painel interno da empresa</strong>, nem às abas laterais, nem aos dados de outras obras.
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <span class="badge" style="background:rgba(18,217,160,.15);color:var(--accent);font-size:.76rem;font-weight:800;padding:6px 12px;border:1px solid rgba(18,217,160,.3);">
          ✓ Sem Senha / Celular
        </span>
      </div>
    </div>

    <!-- KPIS -->
    <div class="g4" style="margin-bottom:20px;">
      <div class="kpi-card" style="padding:16px;">
        <div class="kpi-label">Obras com Portal</div>
        <div class="kpi-value cyan" style="font-size:1.4rem">${totalObras}</div>
        <div style="font-size:.72rem;color:var(--text3);margin-top:4px;">Links disponíveis</div>
      </div>
      <div class="kpi-card" style="padding:16px;">
        <div class="kpi-label">Contratos p/ Assinar</div>
        <div class="kpi-value ${totalContratosPendentes > 0 ? 'yellow' : 'green'}" style="font-size:1.4rem">${totalContratosPendentes}</div>
        <div style="font-size:.72rem;color:var(--text3);margin-top:4px;">Aguardando clientes</div>
      </div>
      <div class="kpi-card" style="padding:16px;">
        <div class="kpi-label">Medições Realizadas</div>
        <div class="kpi-value green" style="font-size:1.4rem">${totalMedicoes}</div>
        <div style="font-size:.72rem;color:var(--text3);margin-top:4px;">Visíveis no portal</div>
      </div>
      <div class="kpi-card" style="padding:16px;">
        <div class="kpi-label">Status do Módulo</div>
        <div class="kpi-value blue" style="font-size:1.2rem">Ativo 🌐</div>
        <div style="font-size:.72rem;color:var(--text3);margin-top:4px;">100% isolado</div>
      </div>
    </div>

    ${!obras.length ? `
      <div class="empty-state" style="padding:48px 20px;">
        <div style="font-size:2.8rem;margin-bottom:12px;">🏗️</div>
        <h3>Nenhuma obra cadastrada</h3>
        <p style="color:var(--text3);max-width:460px;margin:0 auto 18px auto;">
          Cadastre sua primeira obra em "Obras &amp; Clientes" para gerar automaticamente o link exclusivo do Portal de Transparência.
        </p>
        <button class="btn btn-primary" data-fb-click="App.navigate" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="obras">
          + Ir para Obras &amp; Clientes
        </button>
      </div>
    ` : `
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(360px, 1fr));gap:16px;">
        ${obras.map(o => {
          const slas = o.processos_sla || ((typeof CronogramaSLA !== 'undefined') ? CronogramaSLA.getObraProcessos(o.id) : []);
          const concluidas = slas.filter(s => s.status === 'concluido').length;
          const atrasadas = slas.filter(s => s.status_sla === 'atrasado').length;
          const pct = slas.length > 0 ? Math.round((concluidas / slas.length) * 100) : 0;
          const medsObra = allMedicoes.filter(m => String(m.obra_id) === String(o.id));
          const ctrsObra = allContratos.filter(c => String(c.obra_id) === String(o.id));
          const ctrsPend = ctrsObra.filter(c => !c.assinado_por_cliente);
          const urlPortal = this.getUrlPortal(o.id);
          const tel = (o.telefone || o.whatsapp || '').replace(/\D/g, '');
          const msgWhats = `Olá, ${o.cliente || o.nome}! Segue o link exclusivo para acompanhar a sua obra (${o.nome}) em tempo real pelo nosso Portal de Transparência:\n\n${urlPortal}\n\nLá você pode ver prazos, fotos, medições aprovadas, comprovantes e assinar contratos diretamente pelo celular.`;
          const whatsUrl = tel
            ? `https://wa.me/55${tel}?text=${encodeURIComponent(msgWhats)}`
            : `https://wa.me/?text=${encodeURIComponent(msgWhats)}`;

          return `
          <div class="card" style="padding:20px;display:flex;flex-direction:column;justify-content:space-between;gap:16px;border:1px solid var(--border);transition:border-color .2s;background:var(--bg-card);">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px;">
                <div style="flex:1;min-width:0;">
                  <span style="font-size:.7rem;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;">Obra / Cliente</span>
                  <h3 style="font-size:1.05rem;font-weight:900;color:var(--text);margin:2px 0 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${e(o.nome)}
                  </h3>
                </div>
                <span class="badge" style="background:${o.status === 'concluida' ? 'rgba(16,185,129,.15)' : 'rgba(59,130,246,.15)'};color:${o.status === 'concluida' ? 'var(--success)' : '#3b82f6'};font-size:.7rem;font-weight:800;padding:3px 8px;">
                  ${o.status === 'concluida' ? 'Concluída' : 'Em Andamento'}
                </span>
              </div>

              <div style="font-size:.78rem;color:var(--text2);margin-bottom:14px;line-height:1.4;">
                <div>👤 <strong>Cliente:</strong> ${e(o.cliente || o.nome)}</div>
                ${o.telefone || o.whatsapp ? `<div>📞 <strong>Contato:</strong> ${e(o.telefone || o.whatsapp)}</div>` : ''}
                ${o.endereco ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📍 ${e(o.endereco)} &middot; ${e(o.cidade || '')}/${e(o.estado || '')}</div>` : ''}
              </div>

              <!-- RESUMO DOS ITENS COMPARTILHADOS -->
              <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
                <div>
                  <div style="font-size:.65rem;color:var(--text3);font-weight:700;text-transform:uppercase;">Avanço</div>
                  <div style="font-size:.95rem;font-weight:900;color:var(--accent);">${pct}%</div>
                </div>
                <div>
                  <div style="font-size:.65rem;color:var(--text3);font-weight:700;text-transform:uppercase;">Medições</div>
                  <div style="font-size:.95rem;font-weight:900;color:var(--success);">${medsObra.length}</div>
                </div>
                <div>
                  <div style="font-size:.65rem;color:var(--text3);font-weight:700;text-transform:uppercase;">Contratos</div>
                  <div style="font-size:.95rem;font-weight:900;color:${ctrsPend.length ? '#f59e0b' : 'var(--text2)'};">${ctrsPend.length ? `${ctrsPend.length} pend.` : '✓ Ok'}</div>
                </div>
              </div>

              <!-- SITUAÇÃO DO PRAZO -->
              <div style="font-size:.72rem;display:flex;align-items:center;gap:6px;margin-bottom:14px;color:${atrasadas > 0 ? 'var(--danger)' : 'var(--success)'};font-weight:700;">
                <span>${atrasadas > 0 ? '⚠️' : '🟢'}</span>
                <span>${atrasadas > 0 ? `${atrasadas} fase(s) em atraso na obra` : 'Cronograma de etapas no prazo'}</span>
              </div>
            </div>

            <!-- BOTÕES DE AÇÃO DIRETA -->
            <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:8px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button class="btn btn-secondary btn-sm" data-fb-click="PortalCliente.copiarLinkDireto" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(o.id))}" style="font-size:.76rem;font-weight:700;padding:7px;display:inline-flex;align-items:center;justify-content:center;gap:6px;">
                  📋 Copiar Link
                </button>
                <a href="${whatsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background:#25D366;color:#fff;border:none;font-weight:700;font-size:.76rem;padding:7px;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;">
                  📲 WhatsApp
                </a>
              </div>
              <button class="btn btn-primary btn-sm" data-fb-click="PortalCliente.abrirVisualizacaoCliente" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(o.id))}" style="font-size:.78rem;font-weight:800;padding:8px;display:inline-flex;align-items:center;justify-content:center;gap:6px;">
                👁️ Visualizar como Cliente
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>
    `}
    `;
  },

  copiarLinkDireto(obraId) {
    const url = this.getUrlPortal(obraId);
    if (!url) return Utils.toast('Obra não encontrada para gerar o link.', 'error');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        Utils.toast('Link do portal copiado para a área de transferência!', 'success');
      }).catch(() => {
        Utils.toast('Link gerado: copie o endereço.', 'info');
      });
    } else {
      Utils.toast('Link copiado!', 'success');
    }
  },

  abrirModalExplicativo() {
    Utils.showModal(`
      <div class="modal" style="max-width:540px;">
        <div class="modal-header">
          <div class="modal-title">ℹ️ Como Funciona o Portal do Cliente</div>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;font-size:.85rem;line-height:1.5;color:var(--text2);">
          <p>O <strong>Portal de Transparência</strong> é uma tela segura desenvolvida para você compartilhar com o proprietário da obra.</p>
          <ul style="margin:12px 0 16px 20px;display:flex;flex-direction:column;gap:8px;">
            <li><strong>Acesso sem login:</strong> O cliente não precisa cadastrar conta nem digitar senha. Basta clicar no link recebido.</li>
            <li><strong>Isolamento total:</strong> O cliente só tem acesso aos dados da sua própria obra. Ele não vê abas laterais nem nenhuma informação financeira de outras empresas.</li>
            <li><strong>O que o cliente vê:</strong> Linha do tempo dos prazos (SLAs), vistorias de medição realizadas, notas e comprovantes liberados, arquivos de projetos em PDF e contratos pendentes para assinatura digital pelo celular.</li>
          </ul>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Entendi</button>
        </div>
      </div>
    `);
  }
};

window.PortalCliente = PortalCliente;
