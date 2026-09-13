// js/portal_cliente.js — Portal de Transparência do Cliente da Obra
// Visão somente-leitura com avanço físico, fotos, medições, notas, prestação de contas e assinatura eletrônica

const PortalCliente = {
  _activeTab: 'andamento',
  _currentObraId: null,

  _injectStyles() {
    if (document.getElementById('portal-cliente-styles')) return;
    const s = document.createElement('style');
    s.id = 'portal-cliente-styles';
    s.textContent = `
      .portal-banner { background: linear-gradient(135deg, rgba(18,217,160,.12) 0%, rgba(59,130,246,.08) 100%); border: 1px solid rgba(18,217,160,.3); border-radius: var(--r-md); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; flex-wrap: wrap; gap: 12px; }
      .portal-tabs { display: flex; gap: 6px; border-bottom: 2px solid var(--border); margin-bottom: 22px; overflow-x: auto; scrollbar-width: none; }
      .portal-tabs::-webkit-scrollbar { display: none; }
      .portal-tab { padding: 10px 18px; border: none; background: transparent; color: var(--text3); font-weight: 700; font-size: .86rem; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: color .2s, border-color .2s; white-space: nowrap; }
      .portal-tab:hover { color: var(--text); }
      .portal-tab-active { color: var(--accent)!important; border-bottom-color: var(--accent)!important; background: rgba(18,217,160,.06); border-radius: 6px 6px 0 0; }
      .portal-doc-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 16px 20px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; transition: border-color .2s; }
      .portal-doc-card:hover { border-color: rgba(201,162,39,.4); }
    `;
    document.head.appendChild(s);
  },

  // ── GERADOR DE LINK SEGURO ──
  gerarToken(obraId) {
    if (!obraId) return '';
    try {
      return btoa(`finobra_portal_${obraId}`).replace(/=/g, '');
    } catch {
      return `pt_${obraId}`;
    }
  },

  getUrlPortal(obraId) {
    const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://finobra.app.br';
    const token = this.gerarToken(obraId);
    return `${origin}/app?portal_obra=${encodeURIComponent(obraId)}&token=${encodeURIComponent(token)}`;
  },

  // ── MODAL PARA A CONSTRUTORA COMPARTILHAR COM O CLIENTE ──
  abrirModalCompartilhar(obraId) {
    const obra = DB.getById('clientes', obraId);
    if (!obra) return Utils.toast('Obra não encontrada.', 'error');

    const url = this.getUrlPortal(obraId);
    const clienteNome = obra.cliente || obra.nome || 'Cliente';
    const obraNome = obra.nome || 'Sua Obra';
    const tel = (obra.telefone || obra.whatsapp || '').replace(/\D/g, '');

    const msgWhats = `Olá, ${clienteNome}! Segue o link exclusivo para acompanhar a sua obra (${obraNome}) em tempo real pelo nosso Portal de Transparência: ${url}\n\nLá você pode ver o cronograma de fases, fotos, medições aprovadas, comprovantes e assinar documentos pendentes diretamente pelo celular.`;
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
              <span style="font-size:.76rem;color:var(--text3);display:block;">Compartilhe o acesso somente-leitura com o proprietário da obra</span>
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
            <label class="form-label" style="font-size:.78rem;font-weight:700;">Link de Acesso Direto do Cliente</label>
            <div style="display:flex;gap:8px;">
              <input type="text" class="form-control" id="portal-url-copy" value="${e(url)}" readonly style="font-size:.8rem;background:var(--surface);cursor:pointer;">
              <button class="btn btn-secondary btn-sm" data-fb-click="PortalCliente.copiarLink" data-fb-click-n="0" style="white-space:nowrap;font-weight:700;">
                📋 Copiar
              </button>
            </div>
            <span style="font-size:.72rem;color:var(--text3);margin-top:4px;display:block;">
              🔒 O cliente tem visão segura e somente-leitura. Não pode alterar dados financeiros nem lançamentos.
            </span>
          </div>

          <!-- AÇÕES DIRETAS -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
            <a href="${whatsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background:#25D366;color:#fff;border:none;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;padding:10px;">
              📲 Enviar por WhatsApp
            </a>
            <button class="btn btn-primary btn-sm" data-fb-click="PortalCliente.abrirPortalInterno" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(obraId))}" style="font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px;">
              👁️ Visualizar Portal
            </button>
          </div>

          <!-- ITENS VISÍVEIS NO PORTAL -->
          <div style="border-top:1px solid var(--border);padding-top:14px;">
            <span style="font-size:.78rem;font-weight:800;color:var(--text);display:block;margin-bottom:8px;">
              Recursos de Transparência Liberados para o Cliente:
            </span>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.76rem;color:var(--text2);">
              <div>✅ Linha do Tempo &amp; Prazos (SLAs)</div>
              <div>✅ Diário de Obra &amp; Fotos Semanais</div>
              <div>✅ Medições Aprovadas Caixa/Obra</div>
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
      Utils.toast('Link do portal copiado para a área de transferência!', 'success');
    } catch {
      document.execCommand('copy');
      Utils.toast('Link copiado!', 'success');
    }
  },

  abrirPortalInterno(obraId) {
    Utils.closeModal();
    if (typeof App !== 'undefined' && App.navigate) {
      App.obraId = obraId;
      App.navigate('portal-cliente');
    }
  },

  // ── RENDERIZAÇÃO DA PÁGINA DO CLIENTE (PORTAL) ──
  render(obraId) {
    this._injectStyles();
    this._currentObraId = obraId || App.obraId || 'todas';

    const obras = DB.getAll('clientes') || [];
    if (!obras.length) {
      return `
      <div class="empty-state">
        <h3>Nenhuma obra encontrada</h3>
        <p>Cadastre uma obra para visualizar o portal de transparência.</p>
      </div>`;
    }

    let obra = obras.find(o => String(o.id) === String(this._currentObraId));
    if (!obra) {
      obra = obras[0];
      this._currentObraId = obra.id;
    }

    const empresa = DB.getEmpresa ? DB.getEmpresa() : {};
    const resumoSla = (typeof CronogramaSLA !== 'undefined') ? CronogramaSLA.getResumoObra(obra.id) : {};
    const e = Utils.escapeHtml.bind(Utils);

    // Contagem de medições e documentos para assinatura
    const medicoes = (DB.getAll('medicoes') || []).filter(m => String(m.obra_id) === String(obra.id));
    const contratos = (DB.getAll('contratos') || []).filter(c => String(c.obra_id) === String(obra.id));
    const contratosPendentes = contratos.filter(c => !c.assinado_por_cliente);

    // Orçamento para progresso físico
    const orc = (DB.getAll('orcamentos') || []).find(o => String(o.obra_id) === String(obra.id));
    let pctFisico = 0;
    if (orc && Array.isArray(orc.etapas)) {
      const tv = orc.etapas.reduce((s, it) => s + (Number(it.valor_previsto) || 0), 0);
      const tr = orc.etapas.reduce((s, it) => s + (Number(it.valor_realizado) || 0), 0);
      pctFisico = tv > 0 ? Math.min(100, Math.round((tr / tv) * 100)) : 0;
    }

    return `
    <div id="portal-cliente-container" style="max-width:1160px;margin:0 auto;padding-bottom:40px;">
      <!-- BANNER DE TRANSPARÊNCIA SOMENTE-LEITURA -->
      <div class="portal-banner">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:1.8rem;">🛡️</span>
          <div>
            <strong style="color:var(--text);font-size:.95rem;">Portal de Transparência da Obra</strong>
            <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">
              Acompanhamento oficial e seguro &middot; Visão exclusiva para <strong>${e(obra.cliente || obra.nome || 'Proprietário')}</strong>
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="badge" style="background:rgba(18,217,160,.15);color:var(--accent);border:1px solid rgba(18,217,160,.3);font-size:.75rem;padding:4px 10px;font-weight:800;">
            ✓ Somente Leitura
          </span>
          <button class="btn btn-secondary btn-sm" data-fb-click="PortalCliente.abrirModalCompartilhar" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(obra.id))}">
            🔗 Compartilhar Link
          </button>
        </div>
      </div>

      <!-- CABEÇALHO DA CONSTRUTORA & OBRA -->
      <div class="card" style="margin-bottom:20px;padding:24px;border:1px solid rgba(201,162,39,.3);background:linear-gradient(135deg, var(--bg-card) 0%, rgba(201,162,39,.04) 100%);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:18px;margin-bottom:20px;">
          <div>
            <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--accent);margin-bottom:4px;">
              ${e(empresa.razao_social || empresa.nome_fantasia || 'FinObra Engenharia')}
            </div>
            <h1 style="font-size:1.6rem;font-weight:900;color:var(--text);margin:0;">
              ${e(obra.nome)}
            </h1>
            <div style="font-size:.82rem;color:var(--text3);margin-top:6px;display:flex;gap:16px;flex-wrap:wrap;">
              <span>📍 <strong>Local:</strong> ${e(obra.cidade || '—')}/${e(obra.estado || '—')} ${obra.endereco ? `(${e(obra.endereco)})` : ''}</span>
              <span>📐 <strong>Área:</strong> ${e(obra.area_construida || '—')} m²</span>
              <span>👷 <strong>Resp. Técnico:</strong> ${e(empresa.responsavel || 'Equipe de Engenharia')}</span>
            </div>
          </div>
          <div style="text-align:right;">
            ${Utils.badge(obra.status || 'em_andamento')}
            <div style="font-size:.76rem;color:var(--text3);margin-top:6px;">
              Início: <strong>${Utils.fmt.date(obra.data_inicio) || '—'}</strong>
            </div>
          </div>
        </div>

        <!-- 4 CARDS DE KPIS DO CLIENTE -->
        <div class="g4" style="gap:12px;">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;text-align:center;">
            <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);font-weight:700">Avanço Físico Real</div>
            <div style="font-size:1.3rem;font-weight:900;color:var(--accent);margin-top:2px">${pctFisico}%</div>
            <div class="progress-bar" style="height:5px;margin-top:6px;">
              <div class="progress-fill green" style="width:${pctFisico}%"></div>
            </div>
          </div>

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;text-align:center;">
            <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);font-weight:700">Previsão de Entrega</div>
            <div style="font-size:1.2rem;font-weight:900;color:var(--accent2);margin-top:2px">
              ${Utils.fmt.date(resumoSla.dataEntregaEstimada || obra.data_previsao_termino) || 'A definir'}
            </div>
            <div style="font-size:.7rem;color:${resumoSla.statusGeral === 'atrasado' ? 'var(--danger)' : 'var(--success)'};margin-top:4px;">
              ${resumoSla.statusGeral === 'atrasado' ? `⚠️ Ajustado (+${resumoSla.diasAtrasoAcumulado}d)` : '✓ Cronograma no prazo'}
            </div>
          </div>

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;text-align:center;">
            <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);font-weight:700">Medições Aprovadas</div>
            <div style="font-size:1.2rem;font-weight:900;color:var(--success);margin-top:2px">${medicoes.length} vistoria(s)</div>
            <div style="font-size:.7rem;color:var(--text3);margin-top:4px;">Acompanhamento contínuo</div>
          </div>

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;text-align:center;">
            <div style="font-size:.68rem;text-transform:uppercase;color:var(--text3);font-weight:700">Documentos p/ Assinar</div>
            <div style="font-size:1.2rem;font-weight:900;color:${contratosPendentes.length ? '#f59e0b' : 'var(--success)'};margin-top:2px">
              ${contratosPendentes.length} pendente(s)
            </div>
            <div style="font-size:.7rem;color:${contratosPendentes.length ? '#f59e0b' : 'var(--text3)'};margin-top:4px;">
              ${contratosPendentes.length ? 'Requer sua assinatura' : '✓ Tudo em dia'}
            </div>
          </div>
        </div>
      </div>

      <!-- NAVEGAÇÃO POR ABAS DO PORTAL -->
      <div class="portal-tabs">
        <button class="portal-tab ${this._activeTab === 'andamento' ? 'portal-tab-active' : ''}" data-fb-click="PortalCliente.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="andamento">
          📈 Andamento &amp; Prazos (SLAs)
        </button>
        <button class="portal-tab ${this._activeTab === 'medicoes' ? 'portal-tab-active' : ''}" data-fb-click="PortalCliente.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="medicoes">
          📐 Medições da Obra (${medicoes.length})
        </button>
        <button class="portal-tab ${this._activeTab === 'prestacao' ? 'portal-tab-active' : ''}" data-fb-click="PortalCliente.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="prestacao">
          🧾 Prestação de Contas &amp; Notas
        </button>
        <button class="portal-tab ${this._activeTab === 'documentos' ? 'portal-tab-active' : ''}" data-fb-click="PortalCliente.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="documentos">
          📁 Projetos &amp; Anexos
        </button>
        <button class="portal-tab ${this._activeTab === 'assinaturas' ? 'portal-tab-active' : ''}" data-fb-click="PortalCliente.setTab" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="assinaturas">
          ✍️ Assinatura Eletrônica ${contratosPendentes.length ? `<span style="background:#f59e0b;color:#000;border-radius:10px;padding:1px 6px;font-size:.7rem;margin-left:4px;">${contratosPendentes.length}</span>` : ''}
        </button>
      </div>

      <!-- CONTEÚDO DA ABA SELECIONADA -->
      <div id="portal-tab-content">
        ${this._renderTabContent(this._activeTab, obra.id)}
      </div>
    </div>`;
  },

  setTab(tab) {
    this._activeTab = tab;
    document.querySelectorAll('.portal-tab').forEach(el => el.classList.remove('portal-tab-active'));
    const content = document.getElementById('portal-tab-content');
    if (content) {
      content.innerHTML = this._renderTabContent(tab, this._currentObraId);
    }
    const btns = document.querySelectorAll('.portal-tab');
    btns.forEach(b => {
      if (b.textContent.toLowerCase().includes(tab)) b.classList.add('portal-tab-active');
    });
  },

  _renderTabContent(tab, obraId) {
    switch (tab) {
      case 'andamento':
        return this._renderAndamentoTab(obraId);
      case 'medicoes':
        return this._renderMedicoesTab(obraId);
      case 'prestacao':
        return this._renderPrestacaoTab(obraId);
      case 'documentos':
        return this._renderDocumentosTab(obraId);
      case 'assinaturas':
        return this._renderAssinaturasTab(obraId);
      default:
        return this._renderAndamentoTab(obraId);
    }
  },

  // ── ABA 1: ANDAMENTO & PRAZOS (SLAs) ──
  _renderAndamentoTab(obraId) {
    if (typeof CronogramaSLA !== 'undefined') {
      return CronogramaSLA.renderLinhaTempo(obraId, { somenteLeitura: true });
    }
    return `<div class="empty-state"><h3>Módulo de Prazos Indisponível</h3></div>`;
  },

  // ── ABA 2: MEDIÇÕES APROVADAS ──
  _renderMedicoesTab(obraId) {
    const meds = (DB.getAll('medicoes') || []).filter(m => String(m.obra_id) === String(obraId));
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
            <th style="width:15%">Nº Medição</th>
            <th style="width:20%">Data Vistoria</th>
            <th style="width:30%">Etapa Medida</th>
            <th style="width:15%">% Executado</th>
            <th style="width:20%;text-align:right">Valor Liberado</th>
          </tr>
        </thead>
        <tbody>
          ${meds.map(m => `
            <tr>
              <td><strong>${m.numero_medicao || 1}ª Medição</strong></td>
              <td>${Utils.fmt.date(m.data_medicao || m.data)}</td>
              <td>${Utils.escapeHtml(m.etapa_descricao || 'Execução')}</td>
              <td><span class="badge" style="background:rgba(18,217,160,.15);color:var(--accent);">${m.percentual_fisico || 0}%</span></td>
              <td style="text-align:right;font-weight:800;color:var(--success);">${Utils.fmt.currency(m.valor_liberado || m.valor_solicitado)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  },

  // ── ABA 3: PRESTAÇÃO DE CONTAS & NOTAS FISCAIS ──
  _renderPrestacaoTab(obraId) {
    const lancs = (DB.getAll('lancamentos') || []).filter(l => String(l.obra_id) === String(obraId) && l.tipo === 'despesa');
    const notas = (DB.getAll('notas') || []).filter(n => String(n.obra_id) === String(obraId));

    const totalGasto = lancs.reduce((s, l) => s + (Number(l.valor) || 0), 0);

    return `
    <div style="margin-bottom:20px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <span style="font-size:.85rem;font-weight:700;color:var(--text3)">Total em Despesas &amp; Comprovantes da Obra:</span>
        <strong style="font-size:1.25rem;color:var(--text);">${Utils.fmt.currency(totalGasto)}</strong>
      </div>

      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:15%">Data</th>
              <th style="width:35%">Descrição / Serviço</th>
              <th style="width:20%">Categoria</th>
              <th style="width:15%">NF-e</th>
              <th style="width:15%;text-align:right">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${lancs.slice(0, 50).map(l => `
              <tr>
                <td>${Utils.fmt.date(l.data || l.created_at)}</td>
                <td><strong>${Utils.escapeHtml(l.descricao || 'Despesa de Obra')}</strong></td>
                <td><span style="font-size:.74rem;color:var(--text3)">${Utils.escapeHtml(l.categoria || 'Geral')}</span></td>
                <td>${l.numero_nf ? `NF nº ${Utils.escapeHtml(l.numero_nf)}` : '<span style="color:var(--text3)">—</span>'}</td>
                <td style="text-align:right;font-weight:700;color:var(--text);">${Utils.fmt.currency(l.valor)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  // ── ABA 4: PROJETOS & ANEXOS LIBERADOS ──
  _renderDocumentosTab(obraId) {
    const docs = (typeof Documentos !== 'undefined' && Documentos.listar)
      ? [...Documentos.listar('obra', obraId), ...Documentos.listar('orcamento', obraId)]
      : [];

    if (!docs.length) {
      return `
      <div class="empty-state">
        <div style="font-size:2.5rem;margin-bottom:8px">📁</div>
        <h3>Nenhum projeto ou documento anexado ainda</h3>
        <p style="color:var(--text3)">Os memoriais descritivos, plantas em PDF e arquivos compartilhados aparecerão aqui.</p>
      </div>`;
    }

    return `
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${docs.map(d => {
        const url = d.url_externa || d.url;
        return `
        <div class="portal-doc-card">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:1.6rem;">📄</span>
            <div>
              <strong style="color:var(--text);font-size:.9rem;">${Utils.escapeHtml(d.titulo || d.nome_arquivo || 'Documento')}</strong>
              <div style="font-size:.74rem;color:var(--text3);margin-top:2px;">
                ${d.tipo_mime || d.tipo_servico || 'Arquivo'} &middot; Data: ${Utils.fmt.date(d.criado_em)}
              </div>
            </div>
          </div>
          <div>
            ${url ? `
              <a href="${Utils.safeUrl ? Utils.safeUrl(url) : Utils.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:700;">
                🔗 Visualizar / Baixar
              </a>
            ` : '<span style="font-size:.75rem;color:var(--text3)">Disponível no acervo</span>'}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  // ── ABA 5: ASSINATURA ELETRÔNICA DE CONTRATOS & TERMOS ──
  _renderAssinaturasTab(obraId) {
    const contratos = (DB.getAll('contratos') || []).filter(c => String(c.obra_id) === String(obraId));
    if (!contratos.length) {
      return `
      <div class="empty-state">
        <div style="font-size:2.5rem;margin-bottom:8px">✍️</div>
        <h3>Nenhum documento aguardando assinatura</h3>
        <p style="color:var(--text3)">Quando a construtora disponibilizar contratos ou aditivos para você assinar, eles aparecerão aqui.</p>
      </div>`;
    }

    return `
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${contratos.map(c => {
        const isAssinado = !!c.assinado_por_cliente;
        return `
        <div class="portal-doc-card" style="border-left:4px solid ${isAssinado ? 'var(--success)' : '#f59e0b'};">
          <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:240px;">
            <span style="font-size:2rem;">📜</span>
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <strong style="color:var(--text);font-size:.95rem;">${Utils.escapeHtml(c.titulo || c.modelo_nome || 'Contrato de Construção')}</strong>
                <span class="badge" style="background:${isAssinado ? 'rgba(16,185,129,.15)' : 'rgba(245,158,11,.15)'};color:${isAssinado ? 'var(--success)' : '#f59e0b'};font-size:.72rem;">
                  ${isAssinado ? '✓ Assinado Eletronicamente' : '⏳ Aguardando Sua Assinatura'}
                </span>
              </div>
              <div style="font-size:.76rem;color:var(--text3);margin-top:4px;">
                Valor: <strong>${Utils.fmt.currency(c.valor_total || c.valor)}</strong> &middot; Data: ${Utils.fmt.date(c.data_emissao || c.created_at)}
                ${isAssinado ? `&middot; Assinado em: ${Utils.fmt.datetime(c.data_assinatura_cliente)}` : ''}
              </div>
            </div>
          </div>

          <div style="display:flex;gap:8px;align-items:center;">
            ${!isAssinado ? `
              <button class="btn btn-primary btn-sm" style="font-weight:800;display:inline-flex;align-items:center;gap:6px;" data-fb-click="PortalCliente.assinarDocumentoCliente" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(c.id))}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(obraId))}">
                ✍️ Assinar Documento
              </button>
            ` : `
              <button class="btn btn-secondary btn-sm" data-fb-click="Contratos.visualizarContrato" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(c.id))}">
                👁️ Ver Minuta Assinada
              </button>
            `}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  // ── AÇÃO DE ASSINATURA PELO CLIENTE ──
  assinarDocumentoCliente(contratoId, obraId) {
    const contrato = DB.getById('contratos', contratoId);
    if (!contrato) return Utils.toast('Documento não encontrado.', 'error');
    const obra = DB.getById('clientes', obraId);

    if (typeof Assinador === 'undefined') {
      return Utils.toast('Módulo Assinador indisponível.', 'error');
    }

    Assinador.abrirModal({
      titulo: `Assinar: ${contrato.titulo || 'Contrato da Obra'}`,
      subtitulo: 'Sua assinatura eletrônica será vinculada com carimbo de tempo e hash de autenticidade',
      papel: 'Cliente / Contratante',
      nomePredefinido: obra?.cliente || obra?.nome || '',
      docPredefinido: obra?.cpf_cnpj || '',
      dadosDocumento: {
        contratoId,
        obraId,
        tipo: 'contrato'
      },
      onSalvar: (res) => {
        DB.update('contratos', contratoId, {
          assinado_por_cliente: true,
          data_assinatura_cliente: res.data_hora || new Date().toISOString(),
          assinatura_cliente_hash: res.hash_integridade || null,
          assinatura_cliente_nome: res.signatario_nome || obra?.cliente,
          assinatura_cliente_img: res.data_url || null
        });

        Utils.toast('Documento assinado eletronicamente com sucesso!', 'success');
        this.setTab('assinaturas');
      }
    });
  }
};

window.PortalCliente = PortalCliente;
