// js/obra_detalhe.js — Central Executiva da Obra & Cliente (Hub 360°)
// Reúne Extrato Financeiro, Documentação (43 docs), Medições e Contratos/Recibos em um só lugar

const ObraDetalhe = {
  currentObraId: null,
  activeTab: 'lancamentos',
  _filtroTipo: '',
  _filtroBusca: '',

  abrir(obraId, tab = 'lancamentos') {
    this.currentObraId = obraId;
    this.activeTab = tab;
    if (typeof App !== 'undefined') {
      App.obraId = obraId;
      App.refreshObraSelector();
      App.navigate('obra-detalhe');
    }
  },

  setTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.od-tab-btn').forEach(b => {
      const isAct = b.dataset.tab === tab;
      b.classList.toggle('active', isAct);
      b.style.borderColor = isAct ? 'var(--accent)' : 'transparent';
      b.style.color = isAct ? 'var(--accent)' : 'var(--text2)';
      b.style.background = isAct ? 'rgba(18,217,160,0.08)' : 'transparent';
    });
    const container = document.getElementById('od-tab-content');
    if (container && this.currentObraId) {
      container.innerHTML = this._getTabContent(tab, this.currentObraId);
      this._bindTabEvents(tab, this.currentObraId);
      if (tab === 'documentos') {
        setTimeout(() => {
          if (typeof FasesDoc !== 'undefined' && typeof FasesDoc.expandAll === 'function') {
            FasesDoc.expandAll();
          }
        }, 30);
      }
    }
  },

  render(obraId) {
    const id = obraId && obraId !== 'todas' ? obraId : (this.currentObraId || DB.getAll('clientes')[0]?.id);
    if (!id) {
      return `
      <div class="empty-state">
        <div style="font-size:3rem;margin-bottom:12px;">🏗️</div>
        <h3>Nenhuma obra selecionada</h3>
        <p>Cadastre ou selecione uma obra para acessar o Dossiê 360°.</p>
        <button class="btn btn-primary" onclick="Clientes.showForm()">+ Nova Obra</button>
      </div>`;
    }

    this.currentObraId = id;
    const obra = DB.getById('clientes', id);
    if (!obra) {
      return `
      <div class="empty-state">
        <h3>Obra não encontrada</h3>
        <button class="btn btn-secondary" onclick="App.navigate('obras')">⬅️ Voltar para Obras</button>
      </div>`;
    }

    const r = DB.getResumo(id);
    const orc = DB.getAll('orcamentos').find(o => o.obra_id === id);
    let pctFisico = 0;
    if (orc) {
      const tv = orc.etapas.reduce((s,e) => s + e.valor_previsto, 0);
      const tr = orc.etapas.reduce((s,e) => s + e.valor_realizado, 0);
      pctFisico = tv > 0 ? Math.min(100, (tr/tv)*100) : 0;
    }

    const meds = DB.getAll('medicoes').filter(m => m.obra_id === id);
    const libVal = meds.filter(m => m.status === 'liberada').reduce((s,m) => s + (m.valor_liberado||0), 0);
    const isCaixa = !obra.modalidade_obra || obra.modalidade_obra === 'caixa';

    // Modalidade badge
    const modMap = {
      caixa: { label: '🏦 Caixa Econômica', cor: '#3b82f6', bg: 'rgba(59,130,246,.15)' },
      particular: { label: '💼 Recursos Próprios', cor: '#22c55e', bg: 'rgba(34,197,94,.15)' },
      administracao: { label: '📑 Administração', cor: '#a855f7', bg: 'rgba(168,85,247,.15)' },
      empreitada: { label: '🏗️ Empreitada Global', cor: '#f97316', bg: 'rgba(249,115,22,.15)' },
      reforma: { label: '🔨 Reforma / Comercial', cor: '#14b8a6', bg: 'rgba(20,184,166,.15)' },
      outros_bancos: { label: '🏛️ Financiamento Bancário', cor: '#6366f1', bg: 'rgba(99,102,241,.15)' }
    };
    const mod = modMap[obra.modalidade_obra || 'caixa'] || modMap.caixa;

    // Resumo documental
    const docResumo = typeof DB.getDocFasesResumo === 'function' ? DB.getDocFasesResumo(id) : null;
    const docPct = docResumo ? (docResumo.pct ?? 0) : 0;

    // Link do Google Drive se houver
    let driveLink = null;
    const docsFases = DB.getDocFases ? DB.getDocFases(id) : {};
    for (const flist of Object.values(docsFases)) {
      for (const d of flist) {
        if (d.arquivos && d.arquivos.length && typeof Documentos !== 'undefined') {
          for (const aid of d.arquivos) {
            const docObj = Documentos.getById(aid);
            if (docObj && docObj.url_externa && (docObj.tipo_servico === 'gdrive' || docObj.url_externa.includes('drive.google.com'))) {
              driveLink = docObj.url_externa;
              break;
            }
          }
        }
        if (driveLink) break;
      }
      if (driveLink) break;
    }

    return `
    <div style="max-width:1400px;margin:0 auto;">
      <!-- Barra Superior / Breadcrumb & Ações -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('obras')" style="padding:5px 12px;font-weight:700;">
            ⬅️ Voltar para Obras
          </button>
          <span style="color:var(--text3);font-size:.85rem;">/</span>
          <span style="font-size:.9rem;font-weight:700;color:var(--text);">${obra.nome}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${obra.telefone ? `
            <a href="https://wa.me/55${obra.telefone.replace(/\D/g,'')}" target="_blank" rel="noopener noreferrer"
               class="btn btn-sm" style="background:#25D366;color:#fff;font-weight:700;display:inline-flex;align-items:center;gap:5px;text-decoration:none;">
              💬 WhatsApp Cliente
            </a>` : ''}
          ${driveLink ? `
            <a href="${driveLink}" target="_blank" rel="noopener noreferrer"
               class="btn btn-sm" style="background:#4285F4;color:#fff;font-weight:700;display:inline-flex;align-items:center;gap:5px;text-decoration:none;" title="Abrir pasta de projetos no Google Drive">
              📁 Pasta no Google Drive
            </a>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="Clientes.showForm('${obra.id}')" title="Editar cadastro da obra">
            ✏️ Editar Obra
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.print()" title="Imprimir dossiê executivo da obra">
            🖨️ Imprimir Dossiê
          </button>
        </div>
      </div>

      <!-- Hero Executivo da Obra -->
      <div class="card" style="margin-bottom:20px;padding:22px;border:1px solid rgba(18,217,160,0.25);background:linear-gradient(180deg, var(--bg-card) 0%, rgba(18,217,160,0.03) 100%);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
              <h1 style="font-size:1.5rem;font-weight:900;color:var(--text);margin:0;letter-spacing:-0.02em;">
                ${obra.nome}
              </h1>
              <span class="badge" style="background:${mod.bg};color:${mod.cor};border:1px solid ${mod.cor}40;font-size:.75rem;padding:3px 8px;font-weight:700;">
                ${mod.label}
              </span>
              ${Utils.badge(obra.status || 'em_andamento')}
            </div>
            <div style="font-size:.82rem;color:var(--text2);display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;">
              <span><strong>CPF/CNPJ:</strong> ${obra.cpf_cnpj || '—'}</span>
              <span><strong>Local:</strong> 📍 ${obra.cidade||'—'}/${obra.estado||'—'}</span>
              <span><strong>Área:</strong> 📐 ${obra.area_construida || '—'} m²</span>
              <span><strong>Responsável Técnico:</strong> 👷 ${obra.engenheiro_responsavel || obra.responsavel || 'Angelim Construtora'}</span>
              <span><strong>${isCaixa ? 'Contrato Caixa' : 'Ref. Contrato'}:</strong> 📑 ${obra.num_contrato_caixa || 'Contrato Direto'}</span>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;">Período da Obra</div>
            <div style="font-size:.86rem;font-weight:700;color:var(--text);margin-top:2px;">
              ${Utils.fmt.date(obra.data_inicio)} &rarr; ${Utils.fmt.date(obra.data_previsao_termino)}
            </div>
          </div>
        </div>

        <!-- KPIs Financeiros e Físicos em Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;">
          <div style="background:var(--bg-secondary);padding:14px;border-radius:var(--r-md);border:1px solid var(--border);">
            <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;font-weight:700;letter-spacing:.05em;">${isCaixa ? 'Valor Financiado' : 'Valor Contratado'}</div>
            <div style="font-size:1.35rem;font-weight:900;color:var(--text);margin-top:4px;">${Utils.fmt.currency(obra.valor_financiado)}</div>
            <div style="font-size:.7rem;color:var(--text3);margin-top:2px;">Contrato Global</div>
          </div>

          <div style="background:var(--bg-secondary);padding:14px;border-radius:var(--r-md);border:1px solid var(--border);">
            <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;font-weight:700;letter-spacing:.05em;">Total Recebido</div>
            <div style="font-size:1.35rem;font-weight:900;color:var(--success);margin-top:4px;">${Utils.fmt.currency(r.totalReceitas)}</div>
            <div style="font-size:.7rem;color:var(--text3);margin-top:2px;">${isCaixa ? 'Liberado Caixa + Entradas' : 'Faturado / Aportes'}</div>
          </div>

          <div style="background:var(--bg-secondary);padding:14px;border-radius:var(--r-md);border:1px solid var(--border);">
            <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;font-weight:700;letter-spacing:.05em;">Total Gasto (Despesas)</div>
            <div style="font-size:1.35rem;font-weight:900;color:var(--danger);margin-top:4px;">${Utils.fmt.currency(r.totalDespesas)}</div>
            <div style="font-size:.7rem;color:var(--text3);margin-top:2px;">Materiais, mão de obra e taxas</div>
          </div>

          <div style="background:var(--bg-secondary);padding:14px;border-radius:var(--r-md);border:1px solid var(--border);">
            <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;font-weight:700;letter-spacing:.05em;">Saldo Atual da Obra</div>
            <div style="font-size:1.35rem;font-weight:900;color:${r.saldo>=0?'var(--accent)':'var(--danger)'};margin-top:4px;">${Utils.fmt.currency(r.saldo)}</div>
            <div style="font-size:.7rem;color:${r.saldo>=0?'var(--accent2)':'var(--danger)'};margin-top:2px;">${r.saldo>=0?'Superávit de caixa':'Déficit no projeto'}</div>
          </div>

          <div style="background:var(--bg-secondary);padding:14px;border-radius:var(--r-md);border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;font-weight:700;letter-spacing:.05em;">Avanço da Obra</div>
              <span style="font-size:.85rem;font-weight:900;color:var(--accent);">${pctFisico.toFixed(0)}%</span>
            </div>
            <div style="height:6px;background:var(--border);border-radius:3px;margin:8px 0 4px;overflow:hidden;">
              <div style="width:${pctFisico}%;height:100%;background:var(--accent);border-radius:3px;transition:width .5s;"></div>
            </div>
            <div style="font-size:.7rem;color:var(--text3);display:flex;justify-content:space-between;">
              <span>Documentos: <strong>${docPct}%</strong></span>
              <span>Medições: <strong>${meds.length}</strong></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Barra de Abas (Navegação Interna da Obra) -->
      <div style="display:flex;gap:8px;border-bottom:2px solid var(--border);margin-bottom:20px;overflow-x:auto;padding-bottom:2px;">
        <button class="btn od-tab-btn ${this.activeTab==='lancamentos'?'active':''}" data-tab="lancamentos" onclick="ObraDetalhe.setTab('lancamentos')"
                style="padding:10px 18px;font-size:.88rem;font-weight:800;border:none;border-bottom:3px solid ${this.activeTab==='lancamentos'?'var(--accent)':'transparent'};color:${this.activeTab==='lancamentos'?'var(--accent)':'var(--text2)'};border-radius:0;background:${this.activeTab==='lancamentos'?'rgba(18,217,160,0.08)':'transparent'};">
          💰 Extrato &amp; Lançamentos
        </button>
        <button class="btn od-tab-btn ${this.activeTab==='documentos'?'active':''}" data-tab="documentos" onclick="ObraDetalhe.setTab('documentos')"
                style="padding:10px 18px;font-size:.88rem;font-weight:800;border:none;border-bottom:3px solid ${this.activeTab==='documentos'?'var(--accent)':'transparent'};color:${this.activeTab==='documentos'?'var(--accent)':'var(--text2)'};border-radius:0;background:${this.activeTab==='documentos'?'rgba(18,217,160,0.08)':'transparent'};">
          📋 Documentação (43 Docs)
        </button>
        <button class="btn od-tab-btn ${this.activeTab==='medicoes'?'active':''}" data-tab="medicoes" onclick="ObraDetalhe.setTab('medicoes')"
                style="padding:10px 18px;font-size:.88rem;font-weight:800;border:none;border-bottom:3px solid ${this.activeTab==='medicoes'?'var(--accent)':'transparent'};color:${this.activeTab==='medicoes'?'var(--accent)':'var(--text2)'};border-radius:0;background:${this.activeTab==='medicoes'?'rgba(18,217,160,0.08)':'transparent'};">
          🔨 Medições &amp; Faturamento
        </button>
        <button class="btn od-tab-btn ${this.activeTab==='recibos'?'active':''}" data-tab="recibos" onclick="ObraDetalhe.setTab('recibos')"
                style="padding:10px 18px;font-size:.88rem;font-weight:800;border:none;border-bottom:3px solid ${this.activeTab==='recibos'?'var(--accent)':'transparent'};color:${this.activeTab==='recibos'?'var(--accent)':'var(--text2)'};border-radius:0;background:${this.activeTab==='recibos'?'rgba(18,217,160,0.08)':'transparent'};">
          🧾 Recibos &amp; Contratos
        </button>
      </div>

      <!-- Container do Conteúdo da Aba -->
      <div id="od-tab-content">
        ${this._getTabContent(this.activeTab, id)}
      </div>
    </div>`;
  },

  _getTabContent(tab, obraId) {
    if (tab === 'documentos') return this._renderTabDocumentos(obraId);
    if (tab === 'medicoes') return this._renderTabMedicoes(obraId);
    if (tab === 'recibos') return this._renderTabRecibos(obraId);
    return this._renderTabLancamentos(obraId);
  },

  _bindTabEvents(tab, obraId) {
    if (tab === 'lancamentos') {
      const inp = document.getElementById('od-srch-lan');
      if (inp) {
        inp.oninput = () => {
          this._filtroBusca = inp.value.toLowerCase();
          this._refreshLancamentosTable(obraId);
        };
      }
      const selTipo = document.getElementById('od-sel-tipo');
      if (selTipo) {
        selTipo.onchange = () => {
          this._filtroTipo = selTipo.value;
          this._refreshLancamentosTable(obraId);
        };
      }
    }
  },

  // ===== ABA 1: LANÇAMENTOS =====
  _renderTabLancamentos(obraId) {
    const lans = DB.getLancamentos(obraId);
    const r = DB.getResumo(obraId);

    return `
    <div>
      <!-- Barra de Ações Rápidas de Lançamento -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <input type="text" id="od-srch-lan" class="form-control form-control-sm" placeholder="Buscar lançamento, fornecedor, descrição..." style="min-width:240px;">
          <select id="od-sel-tipo" class="form-control form-control-sm" style="min-width:130px;">
            <option value="">Todos os tipos</option>
            <option value="receita">Receitas (+)</option>
            <option value="despesa">Despesas (-)</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="ImportarExcel.abrirModal('${obraId}')" style="border:1px solid var(--accent);color:var(--accent2);">
            📊 Importar Excel
          </button>
          <button class="btn btn-sm" onclick="OCR.abrirModal()" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;font-weight:700;">
            🤖 Ler com IA (OCR)
          </button>
          <button class="btn btn-success btn-sm" onclick="App.obraId='${obraId}';Lancamentos.showForm('receita')" style="font-weight:800;">
            + Nova Receita
          </button>
          <button class="btn btn-danger btn-sm" onclick="App.obraId='${obraId}';Lancamentos.showForm('despesa')" style="font-weight:800;">
            + Nova Despesa
          </button>
        </div>
      </div>

      <!-- Tabela de Lançamentos -->
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="table-wrap">
          <table class="table" style="margin:0;">
            <thead>
              <tr>
                <th style="width:100px;">Data</th>
                <th>Descrição / Fornecedor</th>
                <th>Categoria</th>
                <th>Conta / Destino</th>
                <th style="text-align:right;">Valor</th>
                <th style="width:100px;text-align:center;">Status</th>
                <th style="width:110px;text-align:center;">Anexos</th>
                <th style="width:90px;text-align:center;">Ações</th>
              </tr>
            </thead>
            <tbody id="od-lan-tbody">
              ${this._renderLancamentosRows(lans)}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  },

  _renderLancamentosRows(lans) {
    let filtrados = lans;
    if (this._filtroTipo) {
      filtrados = filtrados.filter(l => l.tipo === this._filtroTipo);
    }
    if (this._filtroBusca) {
      const q = this._filtroBusca;
      filtrados = filtrados.filter(l =>
        (l.descricao || '').toLowerCase().includes(q) ||
        (l.fornecedor || '').toLowerCase().includes(q) ||
        (l.categoria || '').toLowerCase().includes(q)
      );
    }

    if (!filtrados.length) {
      return `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3);">Nenhum lançamento encontrado para esta obra.</td></tr>`;
    }

    return filtrados.map(l => {
      const isRec = l.tipo === 'receita';
      const statusBadge = l.status === 'pago' || l.pago
        ? '<span class="badge" style="background:rgba(34,197,94,.15);color:var(--success);font-size:.7rem;">Pago</span>'
        : '<span class="badge" style="background:rgba(239,68,68,.15);color:var(--danger);font-size:.7rem;">Pendente</span>';

      const clipBadge = typeof Documentos !== 'undefined'
        ? Documentos.badgeClip('lancamento', l.id)
        : '';

      const conta = l.conta_id ? DB.getById('contas', l.conta_id)?.nome : (l.conta || 'Caixa');

      return `
      <tr>
        <td style="font-size:.8rem;color:var(--text2);white-space:nowrap;">
          ${Utils.fmt.date(l.data)}
        </td>
        <td>
          <div style="font-weight:700;font-size:.85rem;color:var(--text);">${l.descricao}</div>
          ${l.fornecedor ? `<div style="font-size:.72rem;color:var(--text3);">Fornecedor: ${l.fornecedor}</div>` : ''}
        </td>
        <td>
          <span style="font-size:.75rem;color:var(--text2);background:var(--bg-secondary);padding:2px 8px;border-radius:4px;border:1px solid var(--border);">
            ${l.categoria || 'Geral'}
          </span>
        </td>
        <td style="font-size:.8rem;color:var(--text3);">
          ${conta}
        </td>
        <td style="text-align:right;font-weight:900;font-size:.9rem;color:${isRec?'var(--success)':'var(--danger)'};white-space:nowrap;">
          ${isRec ? '+' : '-'} ${Utils.fmt.currency(l.valor)}
        </td>
        <td style="text-align:center;">
          ${statusBadge}
        </td>
        <td style="text-align:center;">
          ${clipBadge}
        </td>
        <td style="text-align:center;white-space:nowrap;">
          <button class="icon-btn btn-sm" onclick="Lancamentos.edit('${l.id}')" title="Editar">✏️</button>
          <button class="icon-btn btn-sm" style="color:var(--danger)" onclick="Lancamentos.del('${l.id}')" title="Excluir">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  },

  _refreshLancamentosTable(obraId) {
    const tbody = document.getElementById('od-lan-tbody');
    if (tbody) {
      const lans = DB.getLancamentos(obraId);
      tbody.innerHTML = this._renderLancamentosRows(lans);
    }
  },

  // ===== ABA 2: DOCUMENTAÇÃO (43 DOCS) =====
  _renderTabDocumentos(obraId) {
    if (typeof FasesDoc !== 'undefined') {
      const obra = DB.getById('clientes', obraId);
      if (!obra) return '<div class="empty-state"><h3>Obra não encontrada</h3></div>';

      const docHtml = typeof FasesDoc.renderObra === 'function'
        ? FasesDoc.renderObra(obra, true)
        : (typeof FasesDoc._renderObra === 'function' ? FasesDoc._renderObra(obra) : (typeof FasesDoc.render === 'function' ? FasesDoc.render(obraId) : ''));

      return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
          <div>
            <h3 style="font-size:1.1rem;font-weight:800;color:var(--text);margin:0;">Matriz Documental &amp; Percurso Legal</h3>
            <p style="font-size:.78rem;color:var(--text3);margin:2px 0 0;">43 documentos organizados por fase de obra com uploads locais e vínculos no Google Drive.</p>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="FasesDoc.expandAll()">Expandir Fases</button>
            <button class="btn btn-secondary btn-sm" onclick="FasesDoc.collapseAll()">Recolher</button>
          </div>
        </div>
        ${docHtml}
      </div>`;
    }
    return `<div class="empty-state">Módulo de Documentação não encontrado.</div>`;
  },

  // ===== ABA 3: MEDIÇÕES & CRONOGRAMA =====
  _renderTabMedicoes(obraId) {
    const meds = DB.getAll('medicoes').filter(m => m.obra_id === obraId);
    meds.sort((a,b) => (a.numero_medicao || 0) - (b.numero_medicao || 0));

    const totalLib = meds.filter(m => m.status === 'liberada').reduce((s,m) => s + (m.valor_liberado||0), 0);
    const totalSolic = meds.reduce((s,m) => s + (m.valor_solicitado||0), 0);

    return `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;gap:12px;align-items:center;">
          <div style="font-size:.85rem;color:var(--text2);">
            <strong>${meds.length}</strong> medição(ões) registrada(s) &middot; 
            Liberado: <strong style="color:var(--success);">${Utils.fmt.currency(totalLib)}</strong> de 
            <span style="color:var(--text3);">${Utils.fmt.currency(totalSolic)} solicitado</span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="App.obraId='${obraId}';Medicoes.showForm()" style="font-weight:800;">
          + Nova Medição
        </button>
      </div>

      ${!meds.length ? `
        <div class="card" style="text-align:center;padding:36px;color:var(--text3);">
          <div style="font-size:2.5rem;margin-bottom:8px;">🔨</div>
          <h3>Nenhuma medição registrada para esta obra</h3>
          <p style="font-size:.85rem;margin-bottom:14px;">Cadastre a primeira medição para acompanhar o avanço físico e faturamento.</p>
          <button class="btn btn-primary btn-sm" onclick="App.obraId='${obraId}';Medicoes.showForm()">+ Cadastrar 1ª Medição</button>
        </div>
      ` : `
        <div class="card" style="padding:0;overflow:hidden;">
          <div class="table-wrap">
            <table class="table" style="margin:0;">
              <thead>
                <tr>
                  <th style="width:70px;">Nº</th>
                  <th>Etapa Executada</th>
                  <th>Data Medição</th>
                  <th style="text-align:center;">% Avanço</th>
                  <th style="text-align:right;">Valor Solicitado</th>
                  <th style="text-align:right;">Valor Liberado</th>
                  <th style="text-align:center;">Status</th>
                  <th style="text-align:center;">Anexos</th>
                  <th style="width:90px;text-align:center;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${meds.map(m => {
                  const clip = typeof Documentos !== 'undefined' ? Documentos.badgeClip('medicao', m.id) : '';
                  return `
                  <tr>
                    <td style="font-weight:900;color:var(--accent);">${m.numero_medicao}ª</td>
                    <td>
                      <div style="font-weight:700;color:var(--text);font-size:.85rem;">${m.etapa_descricao || 'Etapa da Obra'}</div>
                      ${m.observacoes ? `<div style="font-size:.72rem;color:var(--text3);">${m.observacoes}</div>` : ''}
                    </td>
                    <td style="font-size:.8rem;color:var(--text2);">${Utils.fmt.date(m.data_medicao || m.data)}</td>
                    <td style="text-align:center;">
                      <span class="badge" style="background:rgba(18,217,160,.15);color:var(--accent);font-weight:800;">
                        ${m.percentual_fisico || 0}%
                      </span>
                    </td>
                    <td style="text-align:right;font-size:.85rem;color:var(--text2);">${Utils.fmt.currency(m.valor_solicitado)}</td>
                    <td style="text-align:right;font-weight:900;font-size:.9rem;color:var(--success);">
                      ${Utils.fmt.currency(m.valor_liberado || m.valor_solicitado)}
                    </td>
                    <td style="text-align:center;">
                      ${Utils.badge(m.status)}
                    </td>
                    <td style="text-align:center;">
                      ${clip}
                    </td>
                    <td style="text-align:center;">
                      <button class="icon-btn btn-sm" onclick="Medicoes.edit('${m.id}')" title="Editar">✏️</button>
                      <button class="icon-btn btn-sm" style="color:var(--danger)" onclick="Medicoes.del('${m.id}')" title="Excluir">🗑️</button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}
    </div>`;
  },

  // ===== ABA 4: RECIBOS & CONTRATOS =====
  _renderTabRecibos(obraId) {
    const obra = DB.getById('clientes', obraId);
    const todosRecibos = typeof Recibos !== 'undefined' ? Recibos.getAll() : [];
    const recibosDaObra = todosRecibos.filter(r =>
      r.obra_id === obraId ||
      (r.cliente_nome && obra && r.cliente_nome.toLowerCase().includes(obra.nome.toLowerCase()))
    );

    const todosContratos = typeof Contratos !== 'undefined' && Contratos.getAll ? Contratos.getAll() : [];
    const contratosDaObra = todosContratos.filter(c => c.obra_id === obraId);

    return `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div style="font-size:.85rem;color:var(--text2);">
          Documentos fiscais, recibos assinados e contratos formalizados com o cliente.
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" onclick="Recibos.abrirModalNovo('${obraId}')" style="font-weight:800;">
            + Emitir Novo Recibo
          </button>
          <button class="btn btn-secondary btn-sm" onclick="App.obraId='${obraId}';App.navigate('contratos')" style="font-weight:700;">
            📜 Gerar Contrato
          </button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px;">
        <!-- Card: Recibos Emitidos -->
        <div class="card" style="padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="font-size:.95rem;font-weight:800;color:var(--text);margin:0;">🧾 Recibos Emitidos (${recibosDaObra.length})</h4>
          </div>
          ${!recibosDaObra.length ? `
            <div style="text-align:center;padding:24px 0;color:var(--text3);font-size:.82rem;">
              Nenhum recibo emitido ainda para esta obra.
            </div>
          ` : `
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${recibosDaObra.map(r => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);">
                  <div>
                    <div style="font-weight:700;font-size:.82rem;color:var(--text);">Recibo #${r.numero || r.id}</div>
                    <div style="font-size:.72rem;color:var(--text3);">${Utils.fmt.date(r.data || r.criado_em)} &middot; ${r.descricao || 'Serviços de Construção'}</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-weight:900;font-size:.88rem;color:var(--success);">${Utils.fmt.currency(r.valor)}</div>
                    <button class="btn btn-sm btn-ghost" style="padding:2px 6px;font-size:.72rem;color:var(--accent);" onclick="Recibos.visualizar('${r.id}')">
                      👁️ Ver
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Card: Contratos Vinculados -->
        <div class="card" style="padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="font-size:.95rem;font-weight:800;color:var(--text);margin:0;">📜 Contratos da Obra (${contratosDaObra.length})</h4>
          </div>
          ${!contratosDaObra.length ? `
            <div style="text-align:center;padding:24px 0;color:var(--text3);font-size:.82rem;">
              Nenhum contrato formal gerado ainda.
              <div style="margin-top:8px;">
                <button class="btn btn-secondary btn-sm" onclick="App.obraId='${obraId}';App.navigate('contratos')">Gerar Modelo de Contrato</button>
              </div>
            </div>
          ` : `
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${contratosDaObra.map(c => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);">
                  <div>
                    <div style="font-weight:700;font-size:.82rem;color:var(--text);">${c.titulo || 'Contrato de Empreitada'}</div>
                    <div style="font-size:.72rem;color:var(--text3);">${Utils.fmt.date(c.criado_em)} &middot; ${c.tipo || 'Padrão'}</div>
                  </div>
                  <button class="btn btn-sm btn-secondary" onclick="Contratos.visualizar('${c.id}')">
                    Abrir
                  </button>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>`;
  }
};
