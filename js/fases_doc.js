// js/fases_doc.js — Percurso Documental de Obras
// Módulo de gestão do ciclo documental completo para obras civis de qualquer tipo

const FasesDoc = {

  // ===== TEMPLATE: 43 DOCUMENTOS EM 3 FASES =====
  TEMPLATE: {
    pre_obra: [
      { id: 'projeto_arq',          nome: 'Projeto Arquitetônico',              icone: '📐', desc: 'Planta baixa, cortes e fachadas' },
      { id: 'projeto_estrutural',   nome: 'Projeto Estrutural',                 icone: '📐', desc: 'Fundações, lajes e pilares' },
      { id: 'projeto_eletrico',     nome: 'Projeto Elétrico',                   icone: '📐', desc: 'Instalações elétricas aprovadas' },
      { id: 'projeto_hidro',        nome: 'Projeto Hidrossanitário',            icone: '📐', desc: 'Água, esgoto e pluvial' },
      { id: 'memorial',             nome: 'Memorial Descritivo',                icone: '📄', desc: 'Especificação técnica completa' },
      { id: 'matricula',            nome: 'Matrícula / Registro do Imóvel',     icone: '📜', desc: 'Certidão atualizada do cartório' },
      { id: 'escritura',            nome: 'Escritura ou Contrato de Compra',    icone: '📜', desc: 'Titularidade do terreno' },
      { id: 'alvara',               nome: 'Alvará de Construção',               icone: '🏛️', desc: 'Licença emitida pela Prefeitura' },
      { id: 'licenca_ambiental',    nome: 'Licença Ambiental',                  icone: '🏛️', desc: 'Para obras de impacto ambiental (se aplicável)' },
      { id: 'anuencia_patrimonial', nome: 'Anuência de Órgão Patrimonial',      icone: '🏛️', desc: 'IPHAN, IBAMA ou tombamento' },
      { id: 'art_projeto',          nome: 'ART / RRT — Projeto',               icone: '🎓', desc: 'CREA ou CAU do projetista' },
      { id: 'art_execucao',         nome: 'ART / RRT — Execução',              icone: '🎓', desc: 'CREA ou CAU do responsável técnico' },
      { id: 'orcamento_doc',        nome: 'Planilha Orçamentária',             icone: '📋', desc: 'Orçamento detalhado com BDI' },
      { id: 'cronograma_doc',       nome: 'Cronograma Físico-Financeiro',       icone: '📋', desc: 'Cronograma de avanço da obra' },
      { id: 'contrato_fin',         nome: 'Contrato de Financiamento',         icone: '🏦', desc: 'CEF, banco, empreitada ou contrato direto' },
    ],
    durante_obra: [
      { id: 'rdo',                  nome: 'Diário de Obra (RDO)',               icone: '📓', desc: 'Registros diários de execução' },
      { id: 'fotos_fundacao',       nome: 'Fotos — Fundação',                  icone: '📸', desc: 'Evidências da fase de fundação' },
      { id: 'fotos_estrutura',      nome: 'Fotos — Estrutura',                 icone: '📸', desc: 'Armação e concretagem' },
      { id: 'fotos_vedacao',        nome: 'Fotos — Vedação e Cobertura',       icone: '📸', desc: 'Alvenaria e cobertura' },
      { id: 'fotos_acabamento',     nome: 'Fotos — Acabamento',                icone: '📸', desc: 'Revestimentos e instalações finais' },
      { id: 'laudo_vistoria',       nome: 'Laudo de Vistoria Técnica',         icone: '🔍', desc: 'Engenheiro, banco ou fiscal' },
      { id: 'laudo_sondagem',       nome: 'Laudo de Sondagem do Solo',         icone: '🔍', desc: 'SPT, ensaio de compactação' },
      { id: 'laudo_estrutural',     nome: 'Laudo / Memória de Cálculo',        icone: '🔍', desc: 'Cálculo e memória estrutural' },
      { id: 'cnd_fgts_exec',        nome: 'Certidão Negativa FGTS',            icone: '📜', desc: 'Validade 90 dias — atualizar conforme necessário' },
      { id: 'cnd_inss_exec',        nome: 'Certidão Negativa INSS / CND',      icone: '📜', desc: 'Quitação previdenciária' },
      { id: 'cnd_municipal',        nome: 'Certidão Negativa Municipal',        icone: '📜', desc: 'ISS, IPTU e tributos municipais' },
      { id: 'nf_materiais',         nome: 'Notas Fiscais de Materiais',        icone: '📋', desc: 'NF-e vinculadas à obra' },
      { id: 'nf_servicos',          nome: 'Notas Fiscais de Serviços',         icone: '📋', desc: 'Empreiteiros e subcontratados' },
      { id: 'contratos_empr',       nome: 'Contratos de Empreiteiros',         icone: '👷', desc: 'Subempreitadas por serviço' },
      { id: 'pcmat',                nome: 'PCMAT / PPRA / PCMSO',              icone: '🛡️', desc: 'Saúde e segurança do trabalho' },
      { id: 'placa_obra',           nome: 'Alvará / Placa de Obra (foto)',      icone: '🛡️', desc: 'Obrigação legal em campo' },
    ],
    pos_obra: [
      { id: 'habitese',             nome: 'Habite-se / Certificado de Conclusão', icone: '🏛️', desc: 'Vistoria final da Prefeitura' },
      { id: 'averbacao',            nome: 'Averbação da Construção',           icone: '📜', desc: 'Registro da obra no Cartório de Imóveis' },
      { id: 'cnd_inss_pos',         nome: 'CND INSS da Obra',                  icone: '📜', desc: 'Quitação das contribuições previdenciárias' },
      { id: 'cnd_fgts_pos',         nome: 'CND FGTS — Pós-Obra',              icone: '📜', desc: 'Quitação FGTS dos trabalhadores' },
      { id: 'as_built',             nome: 'As Built — Projeto Final',          icone: '📋', desc: 'Projeto como efetivamente construído' },
      { id: 'manual_prop',          nome: 'Manual do Proprietário',            icone: '📋', desc: 'Garantias e orientações de manutenção' },
      { id: 'termo_entrega',        nome: 'Termo de Entrega / Recebimento',    icone: '🤝', desc: 'Assinado pelo contratante' },
      { id: 'trco',                 nome: 'TRCO (quando aplicável)',           icone: '🤝', desc: 'Termo de Recebimento CEF / Caixa Econômica' },
      { id: 'art_conclusao',        nome: 'ART / RRT de Conclusão',           icone: '🎓', desc: 'Baixa da responsabilidade técnica' },
      { id: 'ligacao_energia',      nome: 'Habilitação / Ligação de Energia',  icone: '⚡', desc: 'Concessionária de energia elétrica' },
      { id: 'ligacao_agua',         nome: 'Habilitação / Ligação de Água',     icone: '💧', desc: 'Concessionária CAER / CAEMA / SABESP' },
      { id: 'relatorio_final',      nome: 'Relatório Final de Obra',           icone: '📋', desc: 'Resumo executivo completo da obra' },
    ]
  },

  STATUS: {
    nao_iniciado:  { label: 'Não iniciado', icone: '⬜', cor: 'var(--text3)',  bg: 'transparent' },
    em_andamento:  { label: 'Em andamento', icone: '🟡', cor: 'var(--warning)', bg: 'rgba(245,166,35,.07)' },
    ok:            { label: 'Concluído',    icone: '✅', cor: 'var(--success)', bg: 'rgba(18,217,160,.07)' },
    vencido:       { label: 'Vencido',      icone: '🔴', cor: 'var(--danger)',  bg: 'rgba(255,92,92,.07)' },
    nao_aplicavel: { label: 'N/A',          icone: '➖', cor: 'var(--text3)',   bg: 'transparent' },
  },

  FASES_META: {
    pre_obra:     { label: 'Pré-Obra — Projeto & Licenciamento',    icone: '📁', cor: '#60A5FA' },
    durante_obra: { label: 'Durante a Obra — Execução & Controle',  icone: '🏗️', cor: 'var(--warning)' },
    pos_obra:     { label: 'Pós-Obra — Entrega & Regularização',    icone: '✅', cor: 'var(--success)' },
  },

  _obraId: null,
  _collapsed: {},

  // ===== RENDER PRINCIPAL =====
  render(obraId) {
    this._obraId = obraId || 'todas';
    const obras = DB.getAll('clientes');
    const filtradas = (obraId && obraId !== 'todas') ? obras.filter(o => o.id === obraId) : obras;

    if (!filtradas.length) {
      return `<div class="page-header">
        <div><h1 class="page-title">📋 Documentação de Obras</h1>
        <p class="page-sub">Percurso documental completo de cada projeto civil</p></div>
      </div>
      <div class="empty-state">
        <h3>Nenhuma obra cadastrada</h3>
        <p>Cadastre obras para gerenciar o percurso documental.</p>
        <button class="btn btn-primary" onclick="App.navigate('obras')">🏗️ Ir para Obras</button>
      </div>`;
    }

    let totalGlobal = 0, okGlobal = 0;
    filtradas.forEach(o => {
      const r = DB.getDocFasesResumo(o.id);
      totalGlobal += r.total; okGlobal += r.ok;
    });
    const pctGlobal = totalGlobal > 0 ? Math.round((okGlobal / totalGlobal) * 100) : 0;

    return `
    <div class="page-header">
      <div>
        <h1 class="page-title">📋 Documentação de Obras</h1>
        <p class="page-sub">${filtradas.length} obra(s) &nbsp;·&nbsp; ${okGlobal}/${totalGlobal} documentos concluídos &nbsp;·&nbsp; ${pctGlobal}% completo</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="FasesDoc.expandAll()">Expandir Todas</button>
        <button class="btn btn-secondary btn-sm" onclick="FasesDoc.collapseAll()">Recolher Todas</button>
      </div>
    </div>
    <div id="fases-doc-list">
      ${filtradas.map(obra => this._renderObra(obra)).join('')}
    </div>`;
  },

  // ===== RENDER PÚBLICO POR OBRA =====
  renderObra(obraOrId, expanded = true) {
    const obra = typeof obraOrId === 'string' ? DB.getById('clientes', obraOrId) : obraOrId;
    if (!obra) return '<div class="empty-state"><h3>Obra não encontrada</h3></div>';
    if (expanded) this._collapsed[obra.id] = false;
    return this._renderObra(obra);
  },

  // ===== RENDER POR OBRA =====
  _renderObra(obra) {
    const fases = DB.getDocFases(obra.id);
    const prog = this._calcProgresso(fases);
    const pctTotal = prog.total.total > 0 ? Math.round((prog.total.ok / prog.total.total) * 100) : 0;
    const pctCor = pctTotal < 30 ? 'var(--danger)' : pctTotal < 70 ? 'var(--warning)' : 'var(--success)';
    const isExpanded = !this._collapsed[obra.id];
    const id = obra.id;

    const fasesSummary = ['pre_obra','durante_obra','pos_obra'].map(fk => {
      const p = prog[fk];
      const meta = this.FASES_META[fk];
      const pct = p.total > 0 ? Math.round((p.ok / p.total) * 100) : 0;
      const cor = pct < 30 ? 'var(--danger)' : pct < 70 ? 'var(--warning)' : 'var(--success)';
      return `
      <div style="flex:1;text-align:center;padding:0 10px;">
        <div style="font-size:1.3rem;margin-bottom:4px">${meta.icone}</div>
        <div style="font-size:.7rem;color:var(--text2);font-weight:600;margin-bottom:6px">${p.ok}/${p.total}</div>
        <div style="height:5px;background:var(--border-s);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cor};border-radius:3px;transition:width .6s ease"></div>
        </div>
        <div style="font-size:.7rem;color:${cor};font-weight:800;margin-top:4px">${pct}%</div>
      </div>`;
    }).join('<div style="width:1px;background:var(--border-s);margin:6px 0"></div>');

    return `
    <div class="card" style="margin-bottom:16px" id="obra-doc-${id}">
      <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;margin-bottom:14px"
           onclick="FasesDoc._toggleObra('${id}')">
        <div>
          <div style="font-size:.98rem;font-weight:800;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            📋 ${obra.nome}
            <span class="badge" style="background:rgba(255,255,255,.06);border:1px solid var(--border-d);font-size:.68rem;font-weight:600">${obra.modalidade_obra || 'caixa'}</span>
          </div>
          <div style="font-size:.75rem;color:var(--text3);margin-top:3px">
            📍 ${obra.cidade||'—'}/${obra.estado||'—'}&nbsp;&nbsp;·&nbsp;&nbsp;${prog.total.ok}/${prog.total.total} documentos concluídos
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px">
          <div style="text-align:right">
            <div style="font-size:1.6rem;font-weight:900;color:${pctCor};line-height:1">${pctTotal}%</div>
            <div style="font-size:.65rem;color:var(--text3)">completo</div>
          </div>
          <span id="togicon-${id}" style="font-size:1rem;color:var(--text3)">${isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>
      <div style="display:flex;align-items:stretch;padding:12px 8px;background:var(--bg-secondary);border-radius:var(--r-md);margin-bottom:${isExpanded?'16px':'0'}" id="phasebar-${id}">
        ${fasesSummary}
      </div>
      <div id="fases-body-${id}" style="display:${isExpanded?'block':'none'}">
        ${['pre_obra','durante_obra','pos_obra'].map(fk => this._renderFase(id, fk, fases[fk]||[])).join('')}
      </div>
    </div>`;
  },

  _calcProgresso(fases) {
    const r = {
      pre_obra: {ok:0,total:0}, durante_obra: {ok:0,total:0},
      pos_obra: {ok:0,total:0}, total: {ok:0,total:0}
    };
    ['pre_obra','durante_obra','pos_obra'].forEach(fk => {
      (fases[fk]||[]).forEach(d => {
        if (d.status === 'nao_aplicavel') return;
        r[fk].total++; r.total.total++;
        if (d.status === 'ok') { r[fk].ok++; r.total.ok++; }
      });
    });
    return r;
  },

  // ===== RENDER POR FASE =====
  _renderFase(obraId, fk, docs) {
    const meta = this.FASES_META[fk];
    const aplicavel = docs.filter(d => d.status !== 'nao_aplicavel');
    const ok = aplicavel.filter(d => d.status === 'ok').length;
    const vencidos = docs.filter(d => d.status === 'vencido').length;
    const pct = aplicavel.length > 0 ? Math.round((ok/aplicavel.length)*100) : 0;
    const cor = pct < 30 ? 'var(--danger)' : pct < 70 ? 'var(--warning)' : 'var(--success)';
    const collapsed = this._collapsed[`${obraId}_${fk}`];

    return `
    <div style="margin-bottom:10px;border:1px solid var(--border-s);border-radius:var(--r-md);overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 16px;background:var(--bg-secondary);cursor:pointer"
           onclick="FasesDoc._toggleFase('${obraId}','${fk}')">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:1.05rem">${meta.icone}</span>
          <span style="font-weight:700;font-size:.875rem">${meta.label}</span>
          ${vencidos > 0 ? `<span class="badge badge-danger" style="font-size:.65rem">⚠ ${vencidos} vencido(s)</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:.8rem;font-weight:800;color:${cor}">${ok}/${aplicavel.length}</span>
          <div style="width:70px;height:5px;background:var(--border-s);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${cor};transition:width .5s;border-radius:3px"></div>
          </div>
          <span id="farrow-${obraId}-${fk}" style="font-size:.85rem;color:var(--text3)">${collapsed?'▶':'▼'}</span>
        </div>
      </div>
      <div id="fase-${obraId}-${fk}" style="display:${collapsed?'none':'block'}">
        ${docs.map(doc => this._renderDocRow(obraId, doc)).join('')}
      </div>
    </div>`;
  },

  // ===== RENDER LINHA DE DOCUMENTO =====
  _renderDocRow(obraId, doc) {
    const st = this.STATUS[doc.status] || this.STATUS.nao_iniciado;
    const qtdArq = (doc.arquivos || []).length;
    const na = doc.status === 'nao_aplicavel';

    let metaInfo = '';
    if (doc.data_obtencao) metaInfo += `<span style="color:var(--text3)">&nbsp;·&nbsp; Obtido: ${Utils.fmt.date(doc.data_obtencao)}</span>`;
    if (doc.data_validade) {
      const vencido = doc.status === 'vencido';
      metaInfo += `&nbsp;·&nbsp; <span style="color:${vencido?'var(--danger)':'var(--warning)'}">Validade: ${Utils.fmt.date(doc.data_validade)}</span>`;
    }
    if (doc.responsavel) metaInfo += `<span style="color:var(--text3)">&nbsp;·&nbsp; ${doc.responsavel}</span>`;

    let linkExternoUrl = null;
    let linkExternoTipo = 'link';
    if (typeof Documentos !== 'undefined' && (doc.arquivos || []).length > 0) {
      for (const aid of doc.arquivos) {
        const d = Documentos.getById(aid);
        if (d && d.url_externa) {
          linkExternoUrl = d.url_externa;
          linkExternoTipo = d.tipo_servico || 'link';
          break;
        }
      }
    }

    return `
    <div style="display:flex;align-items:center;gap:12px;padding:9px 16px;border-bottom:1px solid var(--border-s);background:${st.bg};opacity:${na?'.4':'1'};transition:background .15s"
         id="docrow-${obraId}-${doc.id}">
      <span style="font-size:1rem;flex-shrink:0;width:22px;text-align:center">${doc.icone}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:.845rem;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${doc.nome}
          ${qtdArq > 0 ? `<span style="font-size:.68rem;background:rgba(18,217,160,.15);color:var(--accent);border:1px solid rgba(18,217,160,.25);border-radius:5px;padding:1px 7px;cursor:pointer;font-weight:700"
                               onclick="FasesDoc.showDocModal('${obraId}','${doc.id}')" title="${qtdArq} anexo(s)">📎 ${qtdArq}</span>` : ''}
          ${linkExternoUrl ? `<a href="${linkExternoUrl}" target="_blank" rel="noopener noreferrer"
                                 style="font-size:.68rem;background:rgba(66,133,244,.15);color:#4285F4;border:1px solid rgba(66,133,244,.3);border-radius:5px;padding:1px 7px;text-decoration:none;font-weight:700;display:inline-flex;align-items:center;gap:3px"
                                 title="Abrir pasta/arquivo no Google Drive ou Nuvem">📁 ${linkExternoTipo==='gdrive'?'Drive':linkExternoTipo==='onedrive'?'OneDrive':'Link'}</a>` : ''}
        </div>
        <div style="font-size:.72rem;color:var(--text3);margin-top:1px">
          ${doc.desc}${metaInfo}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <span style="font-size:.75rem;font-weight:700;padding:2px 10px;border-radius:6px;background:${st.bg};color:${st.cor};border:1px solid ${st.cor}30;white-space:nowrap">
          ${st.icone} ${st.label}
        </span>
        <button class="btn btn-sm btn-secondary" style="padding:4px 10px;font-size:.72rem"
                onclick="FasesDoc.showDocModal('${obraId}','${doc.id}')">✎ Editar</button>
      </div>
    </div>`;
  },

  // ===== TOGGLE COLLAPSE =====
  _toggleObra(obraId) {
    this._collapsed[obraId] = !this._collapsed[obraId];
    const body = document.getElementById(`fases-body-${obraId}`);
    const icon = document.getElementById(`togicon-${obraId}`);
    const bar = document.getElementById(`phasebar-${obraId}`);
    if (body) body.style.display = this._collapsed[obraId] ? 'none' : 'block';
    if (icon) icon.textContent = this._collapsed[obraId] ? '▼' : '▲';
    if (bar) bar.style.marginBottom = this._collapsed[obraId] ? '0' : '16px';
  },

  _toggleFase(obraId, fk) {
    const key = `${obraId}_${fk}`;
    this._collapsed[key] = !this._collapsed[key];
    const el = document.getElementById(`fase-${obraId}-${fk}`);
    const arrow = document.getElementById(`farrow-${obraId}-${fk}`);
    if (el) el.style.display = this._collapsed[key] ? 'none' : 'block';
    if (arrow) arrow.textContent = this._collapsed[key] ? '▶' : '▼';
  },

  expandAll() {
    this._collapsed = {};
    document.querySelectorAll('[id^="fases-body-"]').forEach(el => el.style.display = 'block');
    document.querySelectorAll('[id^="fase-"]').forEach(el => el.style.display = 'block');
    document.querySelectorAll('[id^="togicon-"]').forEach(el => el.textContent = '▲');
    document.querySelectorAll('[id^="farrow-"]').forEach(el => el.textContent = '▼');
    document.querySelectorAll('[id^="phasebar-"]').forEach(el => el.style.marginBottom = '16px');
  },

  collapseAll() {
    DB.getAll('clientes').forEach(o => { this._collapsed[o.id] = true; });
    document.querySelectorAll('[id^="fases-body-"]').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[id^="fase-"]').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[id^="togicon-"]').forEach(el => el.textContent = '▼');
    document.querySelectorAll('[id^="farrow-"]').forEach(el => el.textContent = '▶');
    document.querySelectorAll('[id^="phasebar-"]').forEach(el => el.style.marginBottom = '0');
  },

  // ===== MODAL DE DOCUMENTO =====
  showDocModal(obraId, docId) {
    const fases = DB.getDocFases(obraId);
    let doc = null, faseKey = null, tmpl = null;

    for (const [fk, docs] of Object.entries(fases)) {
      const f = docs.find(d => d.id === docId);
      if (f) { doc = f; faseKey = fk; break; }
    }
    for (const [fk, docs] of Object.entries(this.TEMPLATE)) {
      const f = docs.find(d => d.id === docId);
      if (f) { tmpl = f; break; }
    }
    if (!doc || !tmpl) return;

    const obra = DB.getById('clientes', obraId);
    const faseLabel = this.FASES_META[faseKey]?.label || '';
    const statusOpts = Object.entries(this.STATUS).map(([k, v]) =>
      `<option value="${k}" ${doc.status === k ? 'selected' : ''}>${v.icone} ${v.label}</option>`
    ).join('');
    const arquivosHtml = this._buildArquivosHtml(obraId, docId, doc.arquivos || []);

    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="modal-fases-doc" onclick="if(event.target===this)FasesDoc.closeModal()">
      <div class="modal" style="max-width:580px">
        <div class="modal-header">
          <div class="modal-title">${tmpl.icone} ${tmpl.nome}</div>
          <button class="modal-close" onclick="FasesDoc.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div style="font-size:.78rem;color:var(--text2);margin-bottom:18px">
            📋 ${obra?.nome||obraId} &nbsp;·&nbsp; ${faseLabel} &nbsp;·&nbsp; <span style="color:var(--text3)">${tmpl.desc}</span>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-control" id="fd-status">${statusOpts}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Responsável</label>
              <input class="form-control" id="fd-responsavel" value="${doc.responsavel||''}" placeholder="Eng., Prefeitura, Cartório...">
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label class="form-label">Data de Obtenção</label>
              <input type="date" class="form-control" id="fd-data-obtencao" value="${doc.data_obtencao||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Validade <span style="font-size:.7rem;color:var(--text3)">(certidões)</span></label>
              <input type="date" class="form-control" id="fd-data-validade" value="${doc.data_validade||''}">
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label class="form-label">Órgão / Emissor</label>
              <input class="form-control" id="fd-orgao" value="${doc.orgao_emissor||''}" placeholder="Prefeitura, CREA, CEF...">
            </div>
            <div class="form-group">
              <label class="form-label">Nº Protocolo / Registro</label>
              <input class="form-control" id="fd-protocolo" value="${doc.protocolo||''}" placeholder="Nº do documento oficial">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Observações</label>
            <textarea class="form-control" id="fd-obs" rows="2" placeholder="Pendências, informações adicionais...">${doc.observacoes||''}</textarea>
          </div>
          <div style="border-top:1px solid var(--border-s);padding-top:16px;margin-top:4px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div style="font-size:.8rem;font-weight:700;color:var(--text2)">📎 Anexos &amp; Links do Drive</div>
              <div style="display:flex;gap:4px">
                <button type="button" class="btn btn-sm" id="fd-tab-arq" style="padding:2px 10px;font-size:.72rem;background:var(--accent);color:#000;font-weight:700" onclick="FasesDoc._switchModalTab('arq')">📁 Upload</button>
                <button type="button" class="btn btn-sm btn-ghost" id="fd-tab-link" style="padding:2px 10px;font-size:.72rem;color:var(--text2)" onclick="FasesDoc._switchModalTab('link')">🔗 Link Drive</button>
              </div>
            </div>

            <div id="fd-arq-list">${arquivosHtml}</div>

            <!-- Aba Upload -->
            <div id="fd-panel-upload" style="margin-top:10px">
              <div class="drop-zone" style="padding:18px;text-align:center;cursor:pointer"
                   onclick="document.getElementById('fd-file-in-${docId}').click()"
                   ondragover="event.preventDefault();this.classList.add('drag-over')"
                   ondragleave="this.classList.remove('drag-over')"
                   ondrop="event.preventDefault();this.classList.remove('drag-over');FasesDoc._handleDrop(event,'${obraId}','${docId}')">
                <div style="font-size:1.4rem;margin-bottom:5px">📁</div>
                <div style="font-size:.82rem;color:var(--text2);font-weight:600">Clique ou arraste o arquivo</div>
                <div style="font-size:.71rem;color:var(--text3);margin-top:3px">PDF, PNG, JPG, DWG, XLSX, ZIP, RAR</div>
              </div>
              <input type="file" id="fd-file-in-${docId}" style="display:none" multiple
                     accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.odt,.zip,.rar,.7z,.tar,.gz"
                     onchange="FasesDoc._handleFileSelect(event,'${obraId}','${docId}')">
            </div>

            <!-- Aba Link Google Drive -->
            <div id="fd-panel-link" style="display:none;margin-top:10px;background:var(--bg-card);border:1px dashed var(--border);border-radius:var(--r-md);padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:1.2rem">📁</span>
                  <div style="font-size:.8rem;font-weight:700;color:var(--text)">Google Drive &amp; Nuvem</div>
                </div>
                <button type="button" class="btn btn-sm" onclick="FasesDoc._abrirGooglePicker('${obraId}','${docId}')"
                        style="background:#4285F4;color:#fff;border:none;font-weight:700;font-size:.75rem;padding:4px 10px;display:inline-flex;align-items:center;gap:5px;cursor:pointer">
                  🔍 Selecionar do Meu Drive
                </button>
              </div>
              <div style="font-size:.72rem;color:var(--text3);margin-bottom:10px">
                Escolha arquivos ou pastas diretamente pelo botão acima, ou cole o link de compartilhamento do Drive/OneDrive abaixo:
              </div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <input type="url" id="fd-link-url" class="form-control form-control-sm" placeholder="https://drive.google.com/drive/folders/... ou link do arquivo" style="font-size:.8rem">
                <div style="display:flex;gap:6px">
                  <input type="text" id="fd-link-titulo" class="form-control form-control-sm" placeholder="Descrição (ex: Pasta de Pranchas Executivas)" style="flex:1;font-size:.8rem">
                  <button type="button" class="btn btn-sm btn-primary" onclick="FasesDoc._adicionarLinkModal('${obraId}','${docId}')" style="white-space:nowrap;font-size:.78rem">
                    ➕ Vincular Link
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="FasesDoc.closeModal()">Cancelar</button>
          <button class="btn btn-primary" id="fd-btn-salvar" onclick="FasesDoc.salvarDoc('${obraId}','${docId}')">💾 Salvar</button>
        </div>
      </div>
    </div>`);
  },

  _buildArquivosHtml(obraId, docId, arquivoIds) {
    if (!arquivoIds.length) {
      return `<div id="fd-empty-arq" style="font-size:.78rem;color:var(--text3);padding:6px 0">Nenhum arquivo anexado ainda.</div>`;
    }
    return arquivoIds.map(aid => this._arqItemHtml(obraId, docId, aid)).join('');
  },

  _arqItemHtml(obraId, docId, aid) {
    const d = typeof Documentos !== 'undefined' ? Documentos.getById(aid) : null;
    if (d && d.url_externa) {
      const isGDrive = d.tipo_servico === 'gdrive' || d.url_externa.includes('drive.google.com') || d.url_externa.includes('docs.google.com');
      const isOneDrive = d.tipo_servico === 'onedrive' || d.url_externa.includes('onedrive.live.com') || d.url_externa.includes('sharepoint.com');
      const icone = isGDrive ? '📁' : isOneDrive ? '☁️' : '🔗';
      const badge = isGDrive ? 'Drive' : isOneDrive ? 'OneDrive' : 'Link';
      const badgeBg = isGDrive ? '#4285F4' : isOneDrive ? '#0078D4' : 'var(--accent)';
      return `<div class="rec-item" id="arq-row-${aid}" style="margin-bottom:6px">
        <span style="font-size:1.1rem">${icone}</span>
        <div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px;">
          <span style="font-size:.65rem;font-weight:800;background:${badgeBg};color:#fff;padding:1px 5px;border-radius:3px;">${badge}</span>
          <div style="flex:1;min-width:0;font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">${d.titulo || d.url_externa}</div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <a href="${d.url_externa}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost" style="padding:2px 8px;font-size:.72rem;color:var(--accent);text-decoration:none;" title="Abrir link externo">🔗 Abrir</a>
          <button class="btn btn-sm btn-ghost" style="padding:2px 8px;font-size:.72rem;color:var(--danger)"
                  onclick="FasesDoc._removerArqModal('${obraId}','${docId}','${aid}')" title="Remover link">🗑</button>
        </div>
      </div>`;
    }
    const nome = d?.titulo || d?.nome || aid;
    const icone = nome.match(/\.pdf$/i) ? '📄' : nome.match(/\.(png|jpg|jpeg|webp)$/i) ? '🖼️' : nome.match(/\.(dwg|dxf)$/i) ? '📐' : nome.match(/\.(zip|rar|7z|tar|gz)$/i) ? '📦' : '📎';
    return `<div class="rec-item" id="arq-row-${aid}" style="margin-bottom:6px">
      <span style="font-size:1rem">${icone}</span>
      <div style="flex:1;min-width:0;font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</div>
      <div style="display:flex;gap:5px;flex-shrink:0">
        <button class="btn btn-sm btn-ghost" style="padding:2px 8px;font-size:.72rem"
                onclick="typeof Documentos!=='undefined'&&Documentos.visualizar('${aid}')" title="Visualizar ou Baixar">👁 Ver</button>
        <button class="btn btn-sm btn-ghost" style="padding:2px 8px;font-size:.72rem"
                onclick="typeof Documentos!=='undefined'&&Documentos.baixar('${aid}')" title="Baixar arquivo">⬇️</button>
        <button class="btn btn-sm btn-ghost" style="padding:2px 8px;font-size:.72rem;color:var(--danger)"
                onclick="FasesDoc._removerArqModal('${obraId}','${docId}','${aid}')" title="Remover anexo">🗑</button>
      </div>
    </div>`;
  },

  _handleDrop(event, obraId, docId) {
    this._processFiles(Array.from(event.dataTransfer.files), obraId, docId);
  },

  _handleFileSelect(event, obraId, docId) {
    this._processFiles(Array.from(event.target.files), obraId, docId);
    event.target.value = '';
  },

  async _processFiles(files, obraId, docId) {
    if (typeof Documentos === 'undefined') return Utils.toast('Módulo Documentos não disponível', 'error');
    const btn = document.getElementById('fd-btn-salvar');
    if (btn) btn.disabled = true;

    for (const file of files) {
      try {
        if (file.size > 20 * 1024 * 1024) { Utils.toast(`${file.name} excede 20MB`, 'error'); continue; }
        Utils.toast(`Carregando ${file.name}...`, 'info');
        const base64 = await Documentos.lerArquivoBase64(file);
        const docObj = Documentos.adicionar({
          titulo: file.name,
          nome: file.name,
          tipo: file.type,
          tamanho: file.size,
          entidade_tipo: 'fases_doc',
          entidade_id: `${obraId}_${docId}`,
          data_base64: base64,
          criado_em: new Date().toISOString()
        });

        DB.attachArquivoDocFase(obraId, docId, docObj.id);

        const listEl = document.getElementById('fd-arq-list');
        if (listEl) {
          const empty = document.getElementById('fd-empty-arq');
          if (empty) empty.remove();
          listEl.insertAdjacentHTML('beforeend', this._arqItemHtml(obraId, docId, docObj.id));
        }
        Utils.toast(`${file.name} anexado!`, 'success');
      } catch (e) {
        console.error('[FasesDoc] Erro ao processar arquivo:', e);
        Utils.toast(`Erro ao processar ${file.name}`, 'error');
      }
    }
    if (btn) btn.disabled = false;
  },

  _removerArqModal(obraId, docId, aid) {
    if (!confirm('Remover este item?')) return;
    if (typeof Documentos !== 'undefined') Documentos.remover(aid);
    DB.removeArquivoDocFase(obraId, docId, aid);
    const row = document.getElementById(`arq-row-${aid}`);
    if (row) row.remove();
    Utils.toast('Item removido', 'success');
  },

  _switchModalTab(tab) {
    const pUp = document.getElementById('fd-panel-upload');
    const pLink = document.getElementById('fd-panel-link');
    const tArq = document.getElementById('fd-tab-arq');
    const tLink = document.getElementById('fd-tab-link');
    if (tab === 'link') {
      if (pUp) pUp.style.display = 'none';
      if (pLink) pLink.style.display = 'block';
      if (tArq) { tArq.style.background = 'transparent'; tArq.style.color = 'var(--text2)'; tArq.className = 'btn btn-sm btn-ghost'; }
      if (tLink) { tLink.style.background = 'var(--accent)'; tLink.style.color = '#000'; tLink.className = 'btn btn-sm btn-primary'; }
    } else {
      if (pUp) pUp.style.display = 'block';
      if (pLink) pLink.style.display = 'none';
      if (tArq) { tArq.style.background = 'var(--accent)'; tArq.style.color = '#000'; tArq.className = 'btn btn-sm btn-primary'; }
      if (tLink) { tLink.style.background = 'transparent'; tLink.style.color = 'var(--text2)'; tLink.className = 'btn btn-sm btn-ghost'; }
    }
  },

  _adicionarLinkModal(obraId, docId) {
    const urlInput = document.getElementById('fd-link-url');
    const titInput = document.getElementById('fd-link-titulo');
    const url = urlInput?.value.trim();
    if (!url) return Utils.toast('Por favor, informe a URL do Google Drive ou link externo.', 'warning');

    if (typeof Documentos === 'undefined') return Utils.toast('Módulo Documentos não disponível', 'error');

    const titulo = titInput?.value.trim() || '';
    const item = Documentos.adicionarLink({
      entidade_tipo: 'fases_doc',
      entidade_id: `${obraId}_${docId}`,
      titulo,
      url
    });

    if (item) {
      DB.attachArquivoDocFase(obraId, docId, item.id);
      Utils.toast('Link vinculado com sucesso!', 'success');
      urlInput.value = '';
      if (titInput) titInput.value = '';

      // Atualiza lista de arquivos no modal
      const fases = DB.getDocFases(obraId);
      let docAtual = null;
      for (const docs of Object.values(fases)) {
        const found = docs.find(d => d.id === docId);
        if (found) { docAtual = found; break; }
      }
      const listEl = document.getElementById('fd-arq-list');
      if (listEl) listEl.innerHTML = this._buildArquivosHtml(obraId, docId, docAtual?.arquivos || []);
    }
  },

  _abrirGooglePicker(obraId, docId) {
    if (typeof GDrive === 'undefined') return Utils.toast('Módulo Google Drive não carregado', 'error');
    GDrive.abrirSeletor((pickedDocs) => {
      let count = 0;
      for (const p of pickedDocs) {
        const url = p.url || `https://drive.google.com/file/d/${p.id}/view`;
        const nome = p.name || 'Arquivo no Google Drive';
        const item = Documentos.adicionarLink({
          entidade_tipo: 'fases_doc',
          entidade_id: `${obraId}_${docId}`,
          titulo: nome,
          url
        });
        if (item) {
          DB.attachArquivoDocFase(obraId, docId, item.id);
          count++;
        }
      }
      if (count > 0) {
        Utils.toast(`${count} item(ns) do Google Drive vinculado(s)!`, 'success');
        const fases = DB.getDocFases(obraId);
        let docAtual = null;
        for (const docs of Object.values(fases)) {
          const found = docs.find(d => d.id === docId);
          if (found) { docAtual = found; break; }
        }
        const listEl = document.getElementById('fd-arq-list');
        if (listEl) listEl.innerHTML = this._buildArquivosHtml(obraId, docId, docAtual?.arquivos || []);
      }
    });
  },

  // ===== SALVAR METADADOS =====
  salvarDoc(obraId, docId) {
    const dados = {
      status:         document.getElementById('fd-status')?.value || 'nao_iniciado',
      responsavel:    document.getElementById('fd-responsavel')?.value?.trim() || '',
      data_obtencao:  document.getElementById('fd-data-obtencao')?.value || null,
      data_validade:  document.getElementById('fd-data-validade')?.value || null,
      orgao_emissor:  document.getElementById('fd-orgao')?.value?.trim() || '',
      protocolo:      document.getElementById('fd-protocolo')?.value?.trim() || '',
      observacoes:    document.getElementById('fd-obs')?.value?.trim() || '',
    };
    DB.saveDocFase(obraId, docId, dados);
    this.closeModal();
    Utils.toast('Documento atualizado!', 'success');
    this._rerenderObra(obraId);
  },

  _rerenderObra(obraId) {
    const obra = DB.getById('clientes', obraId);
    if (!obra) return;
    const container = document.getElementById(`obra-doc-${obraId}`);
    if (!container) return;
    container.outerHTML = this._renderObra(obra);
  },

  closeModal() {
    const m = document.getElementById('modal-fases-doc');
    if (m) m.remove();
  },

  // ===== MINI WIDGET PARA CARD DE OBRA =====
  miniWidget(obraId) {
    const r = DB.getDocFasesResumo(obraId);
    if (r.total === 0) return '';
    const cor = r.pct < 30 ? 'var(--danger)' : r.pct < 70 ? 'var(--warning)' : 'var(--success)';
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-secondary);border-radius:var(--r-sm);cursor:pointer;margin-top:6px"
         onclick="App.navigate('documentacao')" title="Percurso documental">
      <span style="font-size:.9rem">📋</span>
      <div style="flex:1">
        <div style="font-size:.68rem;color:var(--text3);font-weight:600;margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em">Documentação</div>
        <div style="height:4px;background:var(--border-s);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${r.pct}%;background:${cor};border-radius:2px;transition:width .5s"></div>
        </div>
      </div>
      <div style="font-size:.78rem;font-weight:800;color:${cor};white-space:nowrap">${r.ok}/${r.total}</div>
    </div>`;
  },
};
