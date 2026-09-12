// js/obra_detalhe.js — Central Executiva da Obra & Cliente (Hub 360°)
// Reúne Extrato Financeiro, Documentação (43 docs), Medições e Contratos/Recibos em um só lugar

const ObraDetalhe = {
  currentObraId: null,
  activeTab: 'lancamentos',
  subTabOrcado: 'curva-s',
  desoneradoLeisSociais: false,
  _filtroTipo: '',
  _filtroBusca: '',

  _safeHtmlRecord(record) {
    if (!record || typeof record !== 'object') return record || {};
    return Object.fromEntries(Object.entries(record).map(([key, value]) => [
      key,
      typeof value === 'string' ? Utils.escapeHtml(value) : value
    ]));
  },

  _safeSpreadsheetCell(value) {
    if (typeof value !== 'string') return value;
    if (/^[\t\r ]*[=+\-@]/.test(value)) return `\'${value}`;
    return value;
  },

  init(obraId) {
    const id = obraId && obraId !== 'todas' ? obraId : (this.currentObraId || DB.getAll('clientes')[0]?.id);
    if (id) {
      this.currentObraId = id;
      this._bindTabEvents(this.activeTab, id);
    }
  },

  abrir(obraId, tab = 'lancamentos') {
    this.currentObraId = obraId;
    this.activeTab = tab;
    if (typeof App !== 'undefined') {
      App.obraId = obraId;
      App.refreshObraSelector();
      App.navigate('obra-detalhe');
    }
  },

  setSubTabOrcado(subTab) {
    this.subTabOrcado = subTab;
    document.querySelectorAll('.od-subtab-btn').forEach(b => {
      const isAct = b.dataset.subtab === subTab;
      b.classList.toggle('active', isAct);
      b.style.borderColor = isAct ? 'var(--accent)' : 'var(--border)';
      b.style.color = isAct ? 'var(--accent)' : 'var(--text2)';
      b.style.background = isAct ? 'rgba(18,217,160,0.12)' : 'var(--bg-secondary)';
    });
    const container = document.getElementById('od-subtab-orcado-content');
    if (container && this.currentObraId) {
      container.innerHTML = this._renderSubTabOrcadoContent(subTab, this.currentObraId);
      this._bindSubTabOrcadoEvents(subTab, this.currentObraId);
    }
  },

  setRegimeLeisSociais(desonerado) {
    this.desoneradoLeisSociais = !!desonerado;
    const container = document.getElementById('od-subtab-orcado-content');
    if (container && this.currentObraId) {
      container.innerHTML = this._renderSubTabOrcadoContent('leis-sociais', this.currentObraId);
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
        <button class="btn btn-primary" data-od-click="Clientes.showForm()">+ Nova Obra</button>
      </div>`;
    }

    this.currentObraId = id;
    const obraRaw = DB.getById('clientes', id);
    const obra = this._safeHtmlRecord(obraRaw);
    if (!obraRaw) {
      return `
      <div class="empty-state">
        <h3>Obra não encontrada</h3>
        <button class="btn btn-secondary" data-od-click="App.navigate('obras')">⬅️ Voltar para Obras</button>
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
    const empresaHtml = this._safeHtmlRecord((typeof DB.getEmpresa === 'function' ? DB.getEmpresa() : {}) || {});

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
              driveLink = Utils.safeUrl ? Utils.safeUrl(docObj.url_externa) : '';
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
          <button class="btn btn-secondary btn-sm" data-od-click="App.navigate('obras')" style="padding:5px 12px;font-weight:700;">
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
          <button class="btn btn-secondary btn-sm" data-od-click="Clientes.showForm('${obra.id}')" title="Editar cadastro da obra">
            ✏️ Editar Obra
          </button>
          <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.imprimirDossie('${obra.id}')" title="Imprimir dossiê executivo da obra">
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
              <span><strong>Responsável Técnico:</strong> 👷 ${obra.engenheiro_responsavel || obra.responsavel || empresaHtml.responsavel || 'Não informado'}</span>
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
        <button class="btn od-tab-btn ${this.activeTab==='orcado-realizado'?'active':''}" data-tab="orcado-realizado" data-od-click="ObraDetalhe.setTab('orcado-realizado')"
                style="padding:10px 18px;font-size:.88rem;font-weight:800;border:none;border-bottom:3px solid ${this.activeTab==='orcado-realizado'?'var(--accent)':'transparent'};color:${this.activeTab==='orcado-realizado'?'var(--accent)':'var(--text2)'};border-radius:0;background:${this.activeTab==='orcado-realizado'?'rgba(18,217,160,0.08)':'transparent'};">
          🏗️ Orçado × Realizado
        </button>
        <button class="btn od-tab-btn ${this.activeTab==='lancamentos'?'active':''}" data-tab="lancamentos" data-od-click="ObraDetalhe.setTab('lancamentos')"
                style="padding:10px 18px;font-size:.88rem;font-weight:800;border:none;border-bottom:3px solid ${this.activeTab==='lancamentos'?'var(--accent)':'transparent'};color:${this.activeTab==='lancamentos'?'var(--accent)':'var(--text2)'};border-radius:0;background:${this.activeTab==='lancamentos'?'rgba(18,217,160,0.08)':'transparent'};">
          💰 Extrato &amp; Lançamentos
        </button>
        <button class="btn od-tab-btn ${this.activeTab==='documentos'?'active':''}" data-tab="documentos" data-od-click="ObraDetalhe.setTab('documentos')"
                style="padding:10px 18px;font-size:.88rem;font-weight:800;border:none;border-bottom:3px solid ${this.activeTab==='documentos'?'var(--accent)':'transparent'};color:${this.activeTab==='documentos'?'var(--accent)':'var(--text2)'};border-radius:0;background:${this.activeTab==='documentos'?'rgba(18,217,160,0.08)':'transparent'};">
          📋 Documentação (43 Docs)
        </button>
        <button class="btn od-tab-btn ${this.activeTab==='medicoes'?'active':''}" data-tab="medicoes" data-od-click="ObraDetalhe.setTab('medicoes')"
                style="padding:10px 18px;font-size:.88rem;font-weight:800;border:none;border-bottom:3px solid ${this.activeTab==='medicoes'?'var(--accent)':'transparent'};color:${this.activeTab==='medicoes'?'var(--accent)':'var(--text2)'};border-radius:0;background:${this.activeTab==='medicoes'?'rgba(18,217,160,0.08)':'transparent'};">
          🔨 Medições &amp; Faturamento
        </button>
        <button class="btn od-tab-btn ${this.activeTab==='recibos'?'active':''}" data-tab="recibos" data-od-click="ObraDetalhe.setTab('recibos')"
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
    if (tab === 'orcado-realizado') return this._renderTabOrcadoRealizado(obraId);
    if (tab === 'documentos') return this._renderTabDocumentos(obraId);
    if (tab === 'medicoes') return this._renderTabMedicoes(obraId);
    if (tab === 'recibos') return this._renderTabRecibos(obraId);
    return this._renderTabLancamentos(obraId);
  },

  _bindTabEvents(tab, obraId) {
    if (tab === 'orcado-realizado') {
      this._bindSubTabOrcadoEvents(this.subTabOrcado || 'curva-s', obraId);
    } else if (tab === 'lancamentos') {
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

  _bindSubTabOrcadoEvents(subTab, obraId) {
    if (subTab === 'curva-s') {
      setTimeout(() => this._renderCurvaSChart(obraId), 60);
    } else if (subTab === 'curva-abc') {
      setTimeout(() => this._renderCurvaABCChart(obraId), 60);
    }
  },

  _renderCurvaSChart(obraId) {
    const canvas = document.getElementById('ch-curva-s');
    if (!canvas || typeof Chart === 'undefined') return;
    const cs = DB.getCurvaS ? DB.getCurvaS(obraId) : null;
    if (!cs) return;

    const prev = Chart.getChart(canvas);
    if (prev) { try { prev.destroy(); } catch{} }

    const ch = new Chart(canvas, {
      type: 'line',
      data: {
        labels: cs.mesesLabels,
        datasets: [
          {
            label: 'Planejado Acumulado (PV)',
            data: cs.pvData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6
          },
          {
            label: 'Valor Agregado Físico (EV)',
            data: cs.evData,
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Custo Real Acumulado (AC)',
            data: cs.acData,
            borderColor: '#ef4444',
            backgroundColor: 'transparent',
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Projeção no Término (EAC)',
            data: cs.forecastData,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderDash: [6, 4],
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#94a3b8', font: { size: 11, weight: '700' }, boxWidth: 14 }
          },
          tooltip: {
            callbacks: {
              label: c => ` ${c.dataset.label}: ${Utils.fmt.currency(c.raw || 0)}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#64748b', font: { size: 11 } },
            grid: { color: 'rgba(255, 255, 255, 0.04)' }
          },
          y: {
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              callback: v => 'R$ ' + (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : (v / 1000).toFixed(0) + 'k')
            },
            grid: { color: 'rgba(255, 255, 255, 0.06)' }
          }
        }
      }
    });
    if (typeof App !== 'undefined' && App.registerChart) App.registerChart(ch);
  },

  _renderCurvaABCChart(obraId) {
    const canvas = document.getElementById('ch-curva-abc');
    if (!canvas || typeof Chart === 'undefined') return;
    const abc = DB.getCurvaABC ? DB.getCurvaABC(obraId) : null;
    if (!abc || !abc.itens.length) return;

    const prev = Chart.getChart(canvas);
    if (prev) { try { prev.destroy(); } catch{} }

    const topItens = abc.itens.slice(0, 15);
    const labels = topItens.map(i => i.descricao.length > 20 ? i.descricao.slice(0, 18) + '...' : i.descricao);
    const valores = topItens.map(i => i.valorTotal);
    const pctsAcumulados = topItens.map(i => i.pctAcumulado);
    const coresBarras = topItens.map(i => i.classe === 'A' ? '#ef4444' : i.classe === 'B' ? '#f59e0b' : '#3b82f6');

    const ch = new Chart(canvas, {
      data: {
        labels,
        datasets: [
          {
            type: 'line',
            label: '% Acumulado (Pareto)',
            data: pctsAcumulados,
            borderColor: '#10b981',
            borderWidth: 2.5,
            yAxisID: 'y1',
            pointRadius: 4,
            tension: 0.3
          },
          {
            type: 'bar',
            label: 'Valor Total (R$)',
            data: valores,
            backgroundColor: coresBarras,
            borderRadius: 4,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#94a3b8', font: { size: 11, weight: '700' } }
          },
          tooltip: {
            callbacks: {
              label: c => {
                if (c.dataset.type === 'line') return ` % Acumulado: ${c.raw}%`;
                return ` Valor: ${Utils.fmt.currency(c.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#64748b', font: { size: 10 } },
            grid: { display: false }
          },
          y: {
            type: 'linear',
            position: 'left',
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              callback: v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
            },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 100,
            ticks: {
              color: '#10b981',
              font: { size: 10 },
              callback: v => v + '%'
            },
            grid: { display: false }
          }
        }
      }
    });
    if (typeof App !== 'undefined' && App.registerChart) App.registerChart(ch);
  },

  // ===== ABA 0: ENGENHARIA DE CUSTOS, PLANEJAMENTO & ORÇADO × REALIZADO =====
  _renderTabOrcadoRealizado(obraId) {
    const comp = (typeof DB !== 'undefined' && DB.getOrcamentoVsRealizado)
      ? DB.getOrcamentoVsRealizado(obraId)
      : { totalOrcado: 0, totalRealizado: 0, saldoRestante: 0, percentualFinanceiro: 0, percentualFisico: 0, desvio: 0, statusSaude: 'saudavel', alertaDesc: '', etapas: [], temOrcamento: false, totalMedicoes: 0 };

    const currentSubTab = this.subTabOrcado || 'curva-s';

    return `
    <div>
      <!-- Banner quando a obra não possui orçamento cadastrado -->
      ${!comp.temOrcamento ? `
      <div class="card" style="margin-bottom:20px;padding:16px 20px;border-left:4px solid var(--accent);background:linear-gradient(90deg, rgba(18,217,160,0.08) 0%, var(--bg-card) 100%);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
        <div style="flex:1;min-width:280px;">
          <div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:1rem;color:var(--text);">
            <span>📋</span>
            <span>Nenhum Orçamento Detalhado Vinculado a Esta Obra</span>
          </div>
          <div style="font-size:.84rem;color:var(--text2);margin-top:4px;line-height:1.4;">
            Os valores exibidos abaixo são baseados nos lançamentos e notas já realizados. Crie uma planilha orçamentária por etapas ou importe do SINAPI para ter o teto de gastos por macro-etapa.
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" data-od-click="App.navigate('orcamentos')" style="font-weight:700;">
            + Criar Orçamento Convencional
          </button>
          <button class="btn btn-secondary btn-sm" data-od-click="App.navigate('sinapi')" style="font-weight:700;">
            🏦 Consultar Banco SINAPI
          </button>
        </div>
      </div>
      ` : ''}

      <!-- Barra de Sub-Navegação de Engenharia de Custos -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;background:var(--bg-secondary);padding:4px;border-radius:var(--r-md);border:1px solid var(--border);">
          <button class="btn btn-sm od-subtab-btn ${currentSubTab==='curva-s'?'active':''}" data-subtab="curva-s" data-od-click="ObraDetalhe.setSubTabOrcado('curva-s')"
                  style="border-radius:6px;font-size:.82rem;font-weight:700;border:1px solid ${currentSubTab==='curva-s'?'var(--accent)':'transparent'};color:${currentSubTab==='curva-s'?'var(--accent)':'var(--text2)'};background:${currentSubTab==='curva-s'?'rgba(18,217,160,0.12)':'transparent'};">
            📈 Curva S &amp; Previsão EVM
          </button>
          <button class="btn btn-sm od-subtab-btn ${currentSubTab==='cronograma'?'active':''}" data-subtab="cronograma" data-od-click="ObraDetalhe.setSubTabOrcado('cronograma')"
                  style="border-radius:6px;font-size:.82rem;font-weight:700;border:1px solid ${currentSubTab==='cronograma'?'var(--accent)':'transparent'};color:${currentSubTab==='cronograma'?'var(--accent)':'var(--text2)'};background:${currentSubTab==='cronograma'?'rgba(18,217,160,0.12)':'transparent'};">
            📅 Cronograma Físico-Financeiro
          </button>
          <button class="btn btn-sm od-subtab-btn ${currentSubTab==='curva-abc'?'active':''}" data-subtab="curva-abc" data-od-click="ObraDetalhe.setSubTabOrcado('curva-abc')"
                  style="border-radius:6px;font-size:.82rem;font-weight:700;border:1px solid ${currentSubTab==='curva-abc'?'var(--accent)':'transparent'};color:${currentSubTab==='curva-abc'?'var(--accent)':'var(--text2)'};background:${currentSubTab==='curva-abc'?'rgba(18,217,160,0.12)':'transparent'};">
            📊 Curva ABC (Pareto)
          </button>
          <button class="btn btn-sm od-subtab-btn ${currentSubTab==='leis-sociais'?'active':''}" data-subtab="leis-sociais" data-od-click="ObraDetalhe.setSubTabOrcado('leis-sociais')"
                  style="border-radius:6px;font-size:.82rem;font-weight:700;border:1px solid ${currentSubTab==='leis-sociais'?'var(--accent)':'transparent'};color:${currentSubTab==='leis-sociais'?'var(--accent)':'var(--text2)'};background:${currentSubTab==='leis-sociais'?'rgba(18,217,160,0.12)':'transparent'};">
            ⚖️ Leis Sociais &amp; BDI
          </button>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.exportarExcelEngenharia('${obraId}')" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;border:1px solid var(--accent);color:var(--accent2);" title="Exportar Dossiê Completo em Excel (.xlsx) com 4 abas">
            📊 Exportar Excel (.xlsx)
          </button>
          <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.exportarPDFEngenharia('${obraId}')" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;border:1px solid rgba(239,68,68,0.5);color:#ef4444;background:rgba(239,68,68,0.06);" title="Exportar Dossiê Completo em PDF Oficial A4">
            📄 Exportar PDF (.pdf)
          </button>
          <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.abrirMenuExportar('excel', '${obraId}')" style="font-weight:700;" title="Escolha se deseja exportar tudo junto ou arquivos separados">
            📑 Opções (.xlsx / PDF) ▾
          </button>
          <button class="btn btn-secondary btn-sm" data-od-click="App.navigate('orcamentos')" style="display:inline-flex;align-items:center;gap:6px;">
            📋 Orçamentos
          </button>
          <button class="btn btn-secondary btn-sm" data-od-click="App.navigate('sinapi')" style="display:inline-flex;align-items:center;gap:6px;">
            🏦 SINAPI
          </button>
          <button class="btn btn-danger btn-sm" data-od-click="App.obraId='${obraId}';Lancamentos.showForm('despesa')" style="font-weight:700;display:inline-flex;align-items:center;gap:6px;">
            + Lançar Custo
          </button>
        </div>
      </div>

      <!-- Container Dinâmico da Sub-Aba Selecionada -->
      <div id="od-subtab-orcado-content">
        ${this._renderSubTabOrcadoContent(currentSubTab, obraId)}
      </div>
    </div>
    `;
  },

  _renderSubTabOrcadoContent(subTab, obraId) {
    if (subTab === 'cronograma') return this._renderSubTabCronograma(obraId);
    if (subTab === 'curva-abc') return this._renderSubTabCurvaABC(obraId);
    if (subTab === 'leis-sociais') return this._renderSubTabLeisSociaisBDI(obraId);
    return this._renderSubTabCurvaS(obraId);
  },

  // ── SUB-ABA 1: CURVA S & PREVISÃO EVM ──
  _renderSubTabCurvaS(obraId) {
    const comp = DB.getOrcamentoVsRealizado(obraId);
    const cs = DB.getCurvaS(obraId);

    const cpiColor = cs.cpi >= 1.05 ? 'var(--success)' : cs.cpi < 0.95 ? 'var(--danger)' : '#f59e0b';
    const spiColor = cs.spi >= 1.0 ? 'var(--success)' : 'var(--danger)';

    return `
    <div>
      <!-- 4 KPIs de Performance EVM -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px;margin-bottom:20px;">
        <div class="card" style="margin:0;padding:16px;border:1px solid var(--border);">
          <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;color:var(--text3);letter-spacing:.05em;">Eficiência de Custo (CPI / IDC)</div>
          <div style="font-size:1.6rem;font-weight:900;color:${cpiColor};margin-top:4px;">
            ${cs.cpi.toFixed(2)}
          </div>
          <div style="font-size:.75rem;color:var(--text3);margin-top:2px;">
            ${cs.statusCusto === 'economico' ? '✅ Gastos abaixo do orçado' : cs.statusCusto === 'sobrecusto' ? '🚨 Sobrecusto detectado' : 'Equilíbrio financeiro'}
          </div>
        </div>

        <div class="card" style="margin:0;padding:16px;border:1px solid var(--border);">
          <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;color:var(--text3);letter-spacing:.05em;">Eficiência de Prazo (SPI / IDP)</div>
          <div style="font-size:1.6rem;font-weight:900;color:${spiColor};margin-top:4px;">
            ${cs.spi.toFixed(2)}
          </div>
          <div style="font-size:.75rem;color:var(--text3);margin-top:2px;">
            ${cs.statusPrazo === 'adiantado' ? '🚀 Avanço adiantado' : cs.statusPrazo === 'atrasado' ? '⚠️ Ritmo abaixo do cronograma' : 'Em conformidade com o prazo'}
          </div>
        </div>

        <div class="card" style="margin:0;padding:16px;border:1px solid var(--border);">
          <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;color:var(--text3);letter-spacing:.05em;">Total Orçado (Teto)</div>
          <div style="font-size:1.5rem;font-weight:900;color:var(--text);margin-top:4px;">
            ${Utils.fmt.currency(comp.totalOrcado)}
          </div>
          <div style="font-size:.75rem;color:var(--text3);margin-top:2px;">
            Previsto em contrato / planilhas
          </div>
        </div>

        <div class="card" style="margin:0;padding:16px;border:1px solid var(--border);">
          <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;color:var(--text3);letter-spacing:.05em;">Total Realizado (Gasto)</div>
          <div style="font-size:1.5rem;font-weight:900;color:var(--danger);margin-top:4px;">
            ${Utils.fmt.currency(comp.totalRealizado)}
          </div>
          <div style="font-size:.75rem;color:var(--text3);margin-top:2px;">
            Custo Real Acumulado (AC)
          </div>
        </div>

        <div class="card" style="margin:0;padding:16px;border:1px solid var(--border);">
          <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;color:var(--text3);letter-spacing:.05em;">Custo Final Previsto (EAC)</div>
          <div style="font-size:1.5rem;font-weight:900;color:var(--text);margin-top:4px;">
            ${Utils.fmt.currency(cs.eac)}
          </div>
          <div style="font-size:.75rem;color:${cs.vac >= 0 ? 'var(--success)' : 'var(--danger)'};margin-top:2px;">
            ${cs.vac >= 0 ? `Economia prevista: ${Utils.fmt.currency(cs.vac)}` : `Estouro projetado: ${Utils.fmt.currency(Math.abs(cs.vac))}`}
          </div>
        </div>

        <div class="card" style="margin:0;padding:16px;border:1px solid var(--border);">
          <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;color:var(--text3);letter-spacing:.05em;">Previsão de Conclusão</div>
          <div style="font-size:1.3rem;font-weight:900;color:var(--text);margin-top:6px;">
            ${Utils.fmt.date(cs.dataFimEstimada)}
          </div>
          <div style="font-size:.75rem;color:var(--text3);margin-top:2px;">
            Contratual: ${Utils.fmt.date(cs.dataFimPrevista)}
          </div>
        </div>
      </div>

      <!-- Gráfico da Curva S Interativa -->
      <div class="card" style="margin-bottom:20px;padding:20px;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
          <div>
            <h3 style="font-size:1rem;font-weight:800;color:var(--text);margin:0;display:flex;align-items:center;gap:8px;">
              <span>📈</span>
              <span>Curva S Dinâmica: Planejado (PV) × Físico Medido (EV) × Realizado (AC) × Previsão (EAC)</span>
            </h3>
            <div style="font-size:.78rem;color:var(--text3);margin-top:2px;">
              Análise de Valor Agregado (EVM) ao longo dos ${cs.totalMeses} meses do empreendimento
            </div>
          </div>
          <div style="display:flex;gap:8px;font-size:.75rem;font-weight:700;">
            <span style="color:#3b82f6;">■ Planejado</span>
            <span style="color:#10b981;">■ Valor Agregado</span>
            <span style="color:#ef4444;">■ Custo Real</span>
            <span style="color:#f59e0b;">┅ Projeção</span>
          </div>
        </div>

        <div style="position:relative;height:320px;width:100%;">
          <canvas id="ch-curva-s"></canvas>
        </div>

        <!-- Diagnóstico Executivo -->
        <div style="margin-top:16px;background:var(--bg-secondary);border:1px solid var(--border);padding:12px 16px;border-radius:var(--r-md);display:flex;align-items:center;gap:12px;">
          <div style="font-size:1.3rem;">${cs.statusCusto === 'sobrecusto' ? '🚨' : cs.statusCusto === 'economico' ? '🎯' : '📊'}</div>
          <div style="font-size:.84rem;color:var(--text);line-height:1.4;">
            <strong>Diagnóstico Executivo:</strong> ${Utils.escapeHtml(cs.diagnosticoTexto)}
          </div>
        </div>
      </div>

      <!-- Planilha de Acompanhamento por Macro-Etapas -->
      <div class="card" style="padding:0;overflow:hidden;border:1px solid var(--border);">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <h3 style="font-size:1rem;font-weight:800;color:var(--text);margin:0;">
            Planilha de Acompanhamento por Macro-Etapas
          </h3>
          <span style="font-size:.82rem;font-weight:700;color:var(--text2);">${comp.etapas.length} macro-etapas ativas</span>
        </div>

        <div class="table-wrap">
          <table class="table" style="margin:0;">
            <thead>
              <tr>
                <th style="min-width:230px;">Macro-Etapa</th>
                <th style="text-align:right;width:125px;">Orçado (R$)</th>
                <th style="text-align:right;width:125px;">Realizado (R$)</th>
                <th style="text-align:right;width:125px;">Saldo (R$)</th>
                <th style="width:150px;text-align:center;">% Consumido</th>
                <th style="width:130px;text-align:center;">Situação</th>
                <th style="width:100px;text-align:center;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${comp.etapas.map(e => {
                const statusBadge = e.status === 'estouro'
                  ? `<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);font-size:.72rem;">🚨 Estouro</span>`
                  : e.status === 'alerta'
                  ? `<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-size:.72rem;">⚠️ Atenção</span>`
                  : `<span class="badge" style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);font-size:.72rem;">✅ Sob Controle</span>`;

                const barraCor = e.status === 'estouro' ? 'var(--danger)' : e.status === 'alerta' ? '#f59e0b' : 'var(--success)';

                return `
                <tr>
                  <td style="font-weight:700;color:var(--text);font-size:.88rem;">${Utils.escapeHtml(e.nome)}</td>
                  <td style="text-align:right;font-weight:700;">${Utils.fmt.currency(e.previsto)}</td>
                  <td style="text-align:right;font-weight:800;color:var(--danger);">${Utils.fmt.currency(e.realizado)}</td>
                  <td style="text-align:right;font-weight:800;color:${e.saldo>=0?'var(--success)':'var(--danger)'};">
                    ${e.saldo<0?'-':''}${Utils.fmt.currency(Math.abs(e.saldo))}
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="display:flex;justify-content:space-between;font-size:.72rem;font-weight:700;margin-bottom:3px;">
                      <span>${e.percentual}%</span>
                    </div>
                    <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
                      <div style="width:${Math.min(100, e.percentual)}%;height:100%;background:${barraCor};border-radius:3px;"></div>
                    </div>
                  </td>
                  <td style="text-align:center;">${statusBadge}</td>
                  <td style="text-align:center;">
                    <button class="btn btn-secondary btn-sm" data-od-click="App.obraId='${obraId}';Lancamentos.showForm('despesa')" style="font-size:.72rem;padding:3px 7px;">+ Custo</button>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    `;
  },

  // ── SUB-ABA 2: CRONOGRAMA FÍSICO-FINANCEIRO ──
  _renderSubTabCronograma(obraId) {
    const crono = DB.getCronogramaFisicoFinanceiro(obraId);

    const badgeFonte = crono.origem === 'orcamento_base'
      ? `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);font-size:.74rem;padding:3px 8px;font-weight:700;">🟢 Fonte: Planilha Orçamentária Base da Obra</span>`
      : crono.origem === 'configuracao_usuario'
      ? `<span class="badge" style="background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);font-size:.74rem;padding:3px 8px;font-weight:700;">⭐ Fonte: Cronograma Customizado Salvo</span>`
      : `<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-size:.74rem;padding:3px 8px;font-weight:700;">ℹ️ Fonte: Estimativa Proporcional Contratual (Pesos SINAPI)</span>`;

    return `
    <div class="card" style="padding:0;overflow:hidden;border:1px solid var(--border);">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <h3 style="font-size:1rem;font-weight:800;color:var(--text);margin:0;display:flex;align-items:center;gap:6px;">
              <span>📅</span> Cronograma Físico-Financeiro Mensal da Obra
            </h3>
            ${badgeFonte}
          </div>
          <div style="font-size:.78rem;color:var(--text3);margin-top:4px;">
            Distribuição temporal do orçamento e desembolsos previstos ao longo dos ${crono.totalMeses} meses &bull; Orçamento Base: <strong>${Utils.fmt.currency(crono.bac)}</strong>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <button class="btn btn-primary btn-sm" data-od-click="ObraDetalhe.abrirModalConfigCronograma('${obraId}')" style="font-size:.78rem;font-weight:700;">
            ✏️ Configurar / Editar Cronograma
          </button>
          <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.exportarExcelEngenharia('${obraId}')" style="font-size:.78rem;font-weight:700;border:1px solid var(--accent);color:var(--accent2);" title="Baixar planilha Excel (.xlsx)">
            📊 Baixar Excel (.xlsx)
          </button>
          <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.exportarPDFEngenharia('${obraId}')" style="font-size:.78rem;font-weight:700;" title="Imprimir / PDF A4">
            📄 Imprimir / PDF A4
          </button>
          <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.exportarExcel('cronograma', '${obraId}')" style="font-size:.78rem;font-weight:700;" title="Baixar exclusivamente o cronograma">
            📅 Só Cronograma (.xlsx)
          </button>
        </div>
      </div>

      <div class="table-wrap" style="overflow-x:auto;">
        <table class="table" style="margin:0;font-size:.82rem;">
          <thead>
            <tr style="background:var(--bg-secondary);">
              <th style="min-width:240px;position:sticky;left:0;background:var(--bg-card);z-index:2;">Macro-Etapa de Obra</th>
              <th style="text-align:right;width:125px;">Total Previsto</th>
              ${crono.mesesLabels.map(lbl => `
                <th style="text-align:center;min-width:110px;">${lbl}</th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${crono.linhas.map(l => `
              <tr>
                <td style="font-weight:700;color:var(--text);position:sticky;left:0;background:var(--bg-card);z-index:1;">
                  ${Utils.escapeHtml(l.nome)}
                </td>
                <td style="text-align:right;font-weight:800;color:var(--text);">
                  ${Utils.fmt.currency(l.previstoTotal)}
                </td>
                ${l.meses.map(m => `
                  <td style="text-align:center;">
                    <div style="font-weight:700;color:${m.valor>0?'var(--text)':'var(--text3)'};">
                      ${m.percentual > 0 ? `${m.percentual}%` : '—'}
                    </div>
                    <div style="font-size:.72rem;color:var(--text3);">
                      ${m.valor > 0 ? Utils.fmt.currency(m.valor) : ''}
                    </div>
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <!-- Linha de Desembolso Mensal -->
            <tr style="background:var(--bg-secondary);font-weight:800;border-top:2px solid var(--border);">
              <td style="position:sticky;left:0;background:var(--bg-secondary);z-index:2;">DESEMBOLSO MENSAL (R$)</td>
              <td style="text-align:right;color:var(--accent);">${Utils.fmt.currency(crono.bac)}</td>
              ${crono.totaisMensais.map(tm => `
                <td style="text-align:center;color:var(--accent);">
                  <div>${Utils.fmt.currency(tm.valorPrevisto || tm.previsto || 0)}</div>
                  <div style="font-size:.72rem;color:var(--text3);">${tm.percentualPrevisto || 0}%</div>
                </td>
              `).join('')}
            </tr>
            <!-- Linha de % Acumulado (Curva S) -->
            <tr style="background:var(--bg-secondary);font-weight:900;border-top:1px solid var(--border);">
              <td style="position:sticky;left:0;background:var(--bg-secondary);z-index:2;">AVANÇO ACUMULADO (%)</td>
              <td style="text-align:right;color:#10b981;">100.0%</td>
              ${crono.totaisAcumulados.map(ta => `
                <td style="text-align:center;color:#10b981;font-size:.85rem;">
                  ${ta.percentualAcumulado}%
                </td>
              `).join('')}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    `;
  },

  // ── SUB-ABA 3: CURVA ABC (PARETO 80/20) ──
  _renderSubTabCurvaABC(obraId) {
    const abc = DB.getCurvaABC(obraId);

    return `
    <div>
      <!-- 3 Cards de Classes ABC -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:14px;margin-bottom:20px;">
        <div class="card" style="margin:0;padding:18px;border:1px solid rgba(239,68,68,0.3);background:linear-gradient(180deg, var(--bg-card) 0%, rgba(239,68,68,0.04) 100%);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="badge" style="background:#ef4444;color:#fff;font-weight:900;padding:4px 10px;border-radius:6px;">CLASSE A</span>
            <span style="font-size:.8rem;font-weight:700;color:var(--danger);">${abc.classeA.pct}% do Custo Global</span>
          </div>
          <div style="font-size:1.55rem;font-weight:900;color:var(--text);margin-top:10px;">
            ${Utils.fmt.currency(abc.classeA.valor)}
          </div>
          <div style="font-size:.78rem;color:var(--text3);margin-top:4px;">
            ${abc.classeA.qtd} ${abc.classeA.qtd===1?'item crítico':'itens críticos'} (aprox. 80% do investimento da obra)
          </div>
        </div>

        <div class="card" style="margin:0;padding:18px;border:1px solid rgba(245,158,11,0.3);background:linear-gradient(180deg, var(--bg-card) 0%, rgba(245,158,11,0.04) 100%);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="badge" style="background:#f59e0b;color:#fff;font-weight:900;padding:4px 10px;border-radius:6px;">CLASSE B</span>
            <span style="font-size:.8rem;font-weight:700;color:#f59e0b;">${abc.classeB.pct}% do Custo Global</span>
          </div>
          <div style="font-size:1.55rem;font-weight:900;color:var(--text);margin-top:10px;">
            ${Utils.fmt.currency(abc.classeB.valor)}
          </div>
          <div style="font-size:.78rem;color:var(--text3);margin-top:4px;">
            ${abc.classeB.qtd} itens intermediários (aprox. 15% do custo)
          </div>
        </div>

        <div class="card" style="margin:0;padding:18px;border:1px solid rgba(59,130,246,0.3);background:linear-gradient(180deg, var(--bg-card) 0%, rgba(59,130,246,0.04) 100%);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="badge" style="background:#3b82f6;color:#fff;font-weight:900;padding:4px 10px;border-radius:6px;">CLASSE C</span>
            <span style="font-size:.8rem;font-weight:700;color:#3b82f6;">${abc.classeC.pct}% do Custo Global</span>
          </div>
          <div style="font-size:1.55rem;font-weight:900;color:var(--text);margin-top:10px;">
            ${Utils.fmt.currency(abc.classeC.valor)}
          </div>
          <div style="font-size:.78rem;color:var(--text3);margin-top:4px;">
            ${abc.classeC.qtd} itens secundários e pulverizados (~5% restante)
          </div>
        </div>
      </div>

      <!-- Gráfico de Pareto (Curva ABC) -->
      <div class="card" style="margin-bottom:20px;padding:20px;border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div>
            <h3 style="font-size:1rem;font-weight:800;color:var(--text);margin:0;display:flex;align-items:center;gap:8px;">
              <span>📊</span> Gráfico de Pareto: Maiores Custos e Concentração Acumulada
            </h3>
            <div style="font-size:.78rem;color:var(--text3);margin-top:2px;">
              Foque o poder de barganha e compras nos itens Classe A para máxima economia na obra
            </div>
          </div>
        </div>

        <div style="position:relative;height:280px;width:100%;">
          <canvas id="ch-curva-abc"></canvas>
        </div>
      </div>

      <!-- Tabela de Pareto Completa -->
      <div class="card" style="padding:0;overflow:hidden;border:1px solid var(--border);">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <h3 style="font-size:1rem;font-weight:800;color:var(--text);margin:0;">
              Classificação Analítica de Insumos &amp; Serviços (Pareto 80/20)
            </h3>
            <div style="font-size:.78rem;color:var(--text3);margin-top:2px;">${abc.totalItens} itens classificados por ordem decrescente de impacto orçamentário</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.exportarExcel('curva-abc', '${obraId}')" style="font-size:.78rem;font-weight:700;border:1px solid var(--accent);color:var(--accent2);" title="Baixar exclusivamente a Curva ABC em Excel">
              📊 Baixar Só Curva ABC (.xlsx)
            </button>
            <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.imprimir('curva-abc', '${obraId}')" style="font-size:.78rem;font-weight:700;" title="Imprimir exclusivamente a Curva ABC em PDF">
              📄 Imprimir Só Curva ABC (PDF)
            </button>
            <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.exportarExcel('completo', '${obraId}')" style="font-size:.78rem;font-weight:700;" title="Dossiê Completo">
              📚 Dossiê Completo
            </button>
          </div>
        </div>

        <div class="table-wrap">
          <table class="table" style="margin:0;">
            <thead>
              <tr>
                <th style="width:60px;text-align:center;">#</th>
                <th>Insumo / Composição / Serviço</th>
                <th style="width:130px;">Categoria</th>
                <th style="width:80px;text-align:center;">Unid.</th>
                <th style="text-align:right;width:130px;">Valor Total (R$)</th>
                <th style="text-align:right;width:100px;">% do Total</th>
                <th style="text-align:right;width:110px;">% Acumulado</th>
                <th style="width:90px;text-align:center;">Classe</th>
              </tr>
            </thead>
            <tbody>
              ${abc.itens.map(i => {
                const classeBadge = i.classe === 'A'
                  ? `<span class="badge" style="background:#ef4444;color:#fff;font-weight:800;padding:3px 8px;border-radius:4px;">A (Crítico)</span>`
                  : i.classe === 'B'
                  ? `<span class="badge" style="background:#f59e0b;color:#fff;font-weight:800;padding:3px 8px;border-radius:4px;">B (Médio)</span>`
                  : `<span class="badge" style="background:#3b82f6;color:#fff;font-weight:800;padding:3px 8px;border-radius:4px;">C (Baixo)</span>`;

                return `
                <tr>
                  <td style="text-align:center;font-weight:700;color:var(--text3);">${i.ranking}</td>
                  <td style="font-weight:700;color:var(--text);">${Utils.escapeHtml(i.descricao)}</td>
                  <td style="color:var(--text2);font-size:.8rem;">${Utils.escapeHtml(i.categoria)}</td>
                  <td style="text-align:center;color:var(--text3);">${Utils.escapeHtml(i.unidade)}</td>
                  <td style="text-align:right;font-weight:800;color:${i.classe==='A'?'var(--danger)':'var(--text)'};">
                    ${Utils.fmt.currency(i.valorTotal)}
                  </td>
                  <td style="text-align:right;font-weight:700;">${i.pctIndividual}%</td>
                  <td style="text-align:right;font-weight:800;color:#10b981;">${i.pctAcumulado}%</td>
                  <td style="text-align:center;">${classeBadge}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    `;
  },

  // ── SUB-ABA 4: LEIS SOCIAIS & BDI OFICIAL ──
  _renderSubTabLeisSociaisBDI(obraId) {
    const isDesonerado = !!this.desoneradoLeisSociais;
    const leis = DB.getLeisSociais(isDesonerado);
    const bdi = DB.getBDIConfig(obraId, { desonerado: isDesonerado });

    const acVal = (bdi.parametros.ac && bdi.parametros.ac.valor !== undefined) ? bdi.parametros.ac.valor : 4.0;
    const sgVal = ((bdi.parametros.s ? bdi.parametros.s.valor : 0.8) + (bdi.parametros.g ? bdi.parametros.g.valor : 0.4));
    const rVal = (bdi.parametros.r && bdi.parametros.r.valor !== undefined) ? bdi.parametros.r.valor : 1.2;
    const dfVal = (bdi.parametros.df && bdi.parametros.df.valor !== undefined) ? bdi.parametros.df.valor : 1.23;
    const lVal = (bdi.parametros.l && bdi.parametros.l.valor !== undefined) ? bdi.parametros.l.valor : 7.4;
    const tVal = (bdi.parametros.tributos && bdi.parametros.tributos.total !== undefined) ? bdi.parametros.tributos.total : (isDesonerado ? 11.15 : 6.65);

    return `
    <div>
      <!-- Seletor de Regime Tributário / Desoneração e Exportação da Aba -->
      <div class="card" style="margin-bottom:20px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;border-left:4px solid var(--accent);">
        <div>
          <div style="font-weight:800;font-size:1rem;color:var(--text);display:flex;align-items:center;gap:8px;">
            <span>⚖️</span> Regime Tributário e Encargos Sociais da Mão de Obra
          </div>
          <div style="font-size:.84rem;color:var(--text2);margin-top:2px;">
            ${leis.observacao}
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <div style="display:flex;gap:6px;background:var(--bg-secondary);padding:4px;border-radius:var(--r-md);border:1px solid var(--border);">
            <button class="btn btn-sm ${!isDesonerado?'btn-primary':'btn-secondary'}" data-od-click="ObraDetalhe.setRegimeLeisSociais(false)" style="font-weight:700;">
              Com Oneração (INSS 20%)
            </button>
            <button class="btn btn-sm ${isDesonerado?'btn-primary':'btn-secondary'}" data-od-click="ObraDetalhe.setRegimeLeisSociais(true)" style="font-weight:700;">
              Sem Oneração (Desonerado)
            </button>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.exportarExcel('bdi', '${obraId}')" style="font-size:.78rem;font-weight:700;border:1px solid var(--accent);color:var(--accent2);" title="Baixar exclusivamente a memória de cálculo de BDI e Leis Sociais em Excel">
              📊 Baixar BDI (.xlsx)
            </button>
            <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.imprimir('bdi', '${obraId}')" style="font-size:.78rem;font-weight:700;" title="Imprimir memória oficial de BDI em PDF">
              📄 Imprimir BDI (PDF)
            </button>
            <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.exportarExcel('completo', '${obraId}')" style="font-size:.78rem;font-weight:700;" title="Dossiê Completo">
              📚 Dossiê Completo
            </button>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <!-- Card 1: Memória das Leis Sociais (Grupos A, B, C e D) -->
        <div class="card" style="padding:0;overflow:hidden;border:1px solid var(--border);">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h3 style="font-size:1rem;font-weight:800;color:var(--text);margin:0;">
                Encargos Sociais (Mão de Obra)
              </h3>
              <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">Padrão Oficial SINAPI / Caixa / IBGE</div>
            </div>
            <div style="font-size:1.3rem;font-weight:900;color:var(--accent);">
              ${leis.totalGeral.toFixed(2)}%
            </div>
          </div>

          <div style="padding:16px 20px;">
            <!-- Grupo A -->
            <div style="margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;font-weight:800;font-size:.84rem;color:var(--text);margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:4px;">
                <span>GRUPO A — Obrigações Básicas</span>
                <span style="color:var(--accent);">${leis.grupoA.total}%</span>
              </div>
              <div style="font-size:.78rem;color:var(--text2);display:grid;gap:4px;">
                ${leis.grupoA.itens.map(i => `
                  <div style="display:flex;justify-content:space-between;">
                    <span>${i.codigo} - ${i.descricao}</span>
                    <span style="font-weight:700;">${i.percentual.toFixed(2)}%</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Grupo B -->
            <div style="margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;font-weight:800;font-size:.84rem;color:var(--text);margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:4px;">
                <span>GRUPO B — Dias Não Trabalhados (Férias, RSR, Feriados)</span>
                <span style="color:var(--accent);">${leis.grupoB.total}%</span>
              </div>
              <div style="font-size:.78rem;color:var(--text2);display:grid;gap:4px;">
                ${leis.grupoB.itens.map(i => `
                  <div style="display:flex;justify-content:space-between;">
                    <span>${i.codigo} - ${i.descricao}</span>
                    <span style="font-weight:700;">${i.percentual.toFixed(2)}%</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Grupo C -->
            <div style="margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;font-weight:800;font-size:.84rem;color:var(--text);margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:4px;">
                <span>GRUPO C — Indenizações Rescisórias</span>
                <span style="color:var(--accent);">${leis.grupoC.total}%</span>
              </div>
              <div style="font-size:.78rem;color:var(--text2);display:grid;gap:4px;">
                ${leis.grupoC.itens.map(i => `
                  <div style="display:flex;justify-content:space-between;">
                    <span>${i.codigo} - ${i.descricao}</span>
                    <span style="font-weight:700;">${i.percentual.toFixed(2)}%</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Grupo D -->
            <div>
              <div style="display:flex;justify-content:space-between;font-weight:800;font-size:.84rem;color:var(--text);margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:4px;">
                <span>GRUPO D — Reincidências (A sobre B)</span>
                <span style="color:var(--accent);">${leis.grupoD.total}%</span>
              </div>
              <div style="font-size:.78rem;color:var(--text2);display:flex;justify-content:space-between;">
                <span>Reincidência de encargos do Grupo A sobre o Grupo B</span>
                <span style="font-weight:700;">${leis.grupoD.total.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: Memória de Cálculo de BDI Oficial INTERATIVA & EDITÁVEL (TCU Acórdão 2622/2013) -->
        <div class="card" style="padding:0;overflow:hidden;border:1px solid var(--border);">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div>
              <h3 style="font-size:1rem;font-weight:800;color:var(--text);margin:0;display:flex;align-items:center;gap:6px;">
                <span>🎯</span> BDI Oficial (Benefícios e Despesas Indiretas)
              </h3>
              <div style="font-size:.76rem;color:var(--text3);margin-top:2px;">Fórmula Oficial do TCU — Acórdão 2622/2013 (Editável)</div>
            </div>
            <div id="od-bdi-val-display" style="font-size:1.6rem;font-weight:900;color:var(--success);text-shadow:0 2px 10px rgba(16,185,129,0.3);">
              ${bdi.bdiCalculado.toFixed(2)}%
            </div>
          </div>

          <div style="padding:16px 20px;">
            <div style="background:var(--bg-secondary);border:1px solid var(--border);padding:8px 12px;border-radius:var(--r-md);font-family:monospace;font-size:.75rem;color:var(--text);margin-bottom:14px;text-align:center;">
              ${bdi.formula}
            </div>

            <!-- Campos Editáveis com recálculo instantâneo -->
            <div style="display:grid;gap:10px;font-size:.82rem;">
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
                <div>
                  <div style="font-weight:700;color:var(--text);">Administração Central (AC)</div>
                  <div style="font-size:.72rem;color:var(--text3);">Faixa TCU: 3,00% a 5,50%</div>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <input type="number" step="0.01" min="0" max="30" id="od-bdi-ac" class="form-control form-control-sm"
                         value="${acVal.toFixed(2)}" style="width:85px;text-align:right;font-weight:800;" data-od-input="ObraDetalhe.recalcularBDIInput('${obraId}')">
                  <span style="font-weight:700;color:var(--text2);">%</span>
                </div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
                <div>
                  <div style="font-weight:700;color:var(--text);">Seguro &amp; Garantia (S + G)</div>
                  <div style="font-size:.72rem;color:var(--text3);">Faixa TCU: 0,80% a 1,20%</div>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <input type="number" step="0.01" min="0" max="20" id="od-bdi-sg" class="form-control form-control-sm"
                         value="${sgVal.toFixed(2)}" style="width:85px;text-align:right;font-weight:800;" data-od-input="ObraDetalhe.recalcularBDIInput('${obraId}')">
                  <span style="font-weight:700;color:var(--text2);">%</span>
                </div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
                <div>
                  <div style="font-weight:700;color:var(--text);">Risco do Empreendimento (R)</div>
                  <div style="font-size:.72rem;color:var(--text3);">Faixa TCU: 0,97% a 1,27%</div>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <input type="number" step="0.01" min="0" max="20" id="od-bdi-r" class="form-control form-control-sm"
                         value="${rVal.toFixed(2)}" style="width:85px;text-align:right;font-weight:800;" data-od-input="ObraDetalhe.recalcularBDIInput('${obraId}')">
                  <span style="font-weight:700;color:var(--text2);">%</span>
                </div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
                <div>
                  <div style="font-weight:700;color:var(--text);">Despesas Financeiras (DF)</div>
                  <div style="font-size:.72rem;color:var(--text3);">Faixa TCU: 0,59% a 1,39%</div>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <input type="number" step="0.01" min="0" max="20" id="od-bdi-df" class="form-control form-control-sm"
                         value="${dfVal.toFixed(2)}" style="width:85px;text-align:right;font-weight:800;" data-od-input="ObraDetalhe.recalcularBDIInput('${obraId}')">
                  <span style="font-weight:700;color:var(--text2);">%</span>
                </div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
                <div>
                  <div style="font-weight:700;color:var(--text);">Lucro Operacional Bruto (L)</div>
                  <div style="font-size:.72rem;color:var(--text3);">Faixa TCU: 6,16% a 8,96%</div>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <input type="number" step="0.01" min="0" max="30" id="od-bdi-l" class="form-control form-control-sm"
                         value="${lVal.toFixed(2)}" style="width:85px;text-align:right;font-weight:800;" data-od-input="ObraDetalhe.recalcularBDIInput('${obraId}')">
                  <span style="font-weight:700;color:var(--text2);">%</span>
                </div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
                <div>
                  <div style="font-weight:700;color:var(--text);">Tributos Incidentes (PIS + COFINS + ISS ${isDesonerado?'+ CPRB':''})</div>
                  <div style="font-size:.72rem;color:var(--text3);">Geralmente de 4,65% a 8,65% (até 13% em desoneração)</div>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <input type="number" step="0.01" min="0" max="35" id="od-bdi-t" class="form-control form-control-sm"
                         value="${tVal.toFixed(2)}" style="width:85px;text-align:right;font-weight:800;color:var(--danger);" data-od-input="ObraDetalhe.recalcularBDIInput('${obraId}')">
                  <span style="font-weight:700;color:var(--danger);">%</span>
                </div>
              </div>
            </div>

            <!-- Faixa de Aceitabilidade TCU Dinâmica -->
            <div id="od-bdi-status-badge" style="margin-top:14px;padding:10px 12px;background:rgba(18,217,160,0.06);border:1px solid rgba(18,217,160,0.2);border-radius:var(--r-md);font-size:.76rem;color:var(--text);">
              <strong>Faixa TCU Edifícios (Acórdão 2622/2013):</strong> 1º Quartil: <strong>20,34%</strong> &bull; Mediana: <strong>22,18%</strong> &bull; 3º Quartil: <strong>25,00%</strong>.
            </div>

            <!-- Botões de Persistência e Ação -->
            <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm" data-od-click="ObraDetalhe.salvarBDI('${obraId}')" style="font-weight:800;display:inline-flex;align-items:center;gap:6px;">
                💾 Salvar BDI Desta Obra
              </button>
              <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.salvarBDIPadrao('${obraId}')" style="display:inline-flex;align-items:center;gap:6px;" title="Salva os parâmetros como padrão para novas obras">
                🏢 Salvar Padrão Construtora
              </button>
              <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.restaurarBDITCU('${obraId}')" style="display:inline-flex;align-items:center;gap:6px;" title="Restaura os parâmetros para as medianas do TCU">
                🔄 Restaurar Padrão TCU
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    `;
  },

  // ── MÉTODOS DE CONTROLE & PERSISTÊNCIA DO BDI ──
  recalcularBDIInput(obraId) {
    const ac = parseFloat(document.getElementById('od-bdi-ac')?.value) || 0;
    const sg = parseFloat(document.getElementById('od-bdi-sg')?.value) || 0;
    const r = parseFloat(document.getElementById('od-bdi-r')?.value) || 0;
    const df = parseFloat(document.getElementById('od-bdi-df')?.value) || 0;
    const l = parseFloat(document.getElementById('od-bdi-l')?.value) || 0;
    const t = parseFloat(document.getElementById('od-bdi-t')?.value) || 0;

    const tFrac = t / 100;
    const divisor = Math.max(0.01, 1 - tFrac);
    const numerador = (1 + (ac + sg + r) / 100) * (1 + df / 100) * (1 + l / 100);
    const bdiCalculado = Math.max(0, ((numerador / divisor) - 1) * 100);

    const valEl = document.getElementById('od-bdi-val-display');
    if (valEl) {
      valEl.textContent = `${bdiCalculado.toFixed(2)}%`;
    }

    const badgeEl = document.getElementById('od-bdi-status-badge');
    if (badgeEl) {
      if (bdiCalculado < 20.34) {
        badgeEl.innerHTML = `<strong>Faixa TCU:</strong> <span style="color:#f59e0b;font-weight:700;">🟡 Abaixo do 1º Quartil (20,34%)</span> &bull; Mediana: 22,18% &bull; 3º Quartil: 25,00%. Margem conservadora / competitiva.`;
      } else if (bdiCalculado > 25.00) {
        badgeEl.innerHTML = `<strong>Faixa TCU:</strong> <span style="color:#ef4444;font-weight:700;">🟠 Acima do 3º Quartil (25,00%)</span> &bull; Mediana: 22,18%. Em licitações públicas exige justificativa formal.`;
      } else {
        badgeEl.innerHTML = `<strong>Faixa TCU:</strong> <span style="color:#10b981;font-weight:700;">🟢 Dentro da Faixa Ideal de Aceitabilidade (Mediana: 22,18%)</span> &bull; 1º Q: 20,34% &bull; 3º Q: 25,00%.`;
      }
    }
  },

  salvarBDI(obraId) {
    const ac = parseFloat(document.getElementById('od-bdi-ac')?.value) || 0;
    const sg = parseFloat(document.getElementById('od-bdi-sg')?.value) || 0;
    const r = parseFloat(document.getElementById('od-bdi-r')?.value) || 0;
    const df = parseFloat(document.getElementById('od-bdi-df')?.value) || 0;
    const l = parseFloat(document.getElementById('od-bdi-l')?.value) || 0;
    const t = parseFloat(document.getElementById('od-bdi-t')?.value) || 0;

    const cfg = {
      ac,
      sg,
      s: sg * 0.65,
      g: sg * 0.35,
      r,
      df,
      l,
      t,
      desonerado: !!this.desoneradoLeisSociais
    };

    DB.saveBDIConfig(obraId, cfg);
    Utils.toast('✅ Parâmetros de BDI da obra salvos com sucesso!', 'success');
  },

  salvarBDIPadrao(obraId) {
    const ac = parseFloat(document.getElementById('od-bdi-ac')?.value) || 0;
    const sg = parseFloat(document.getElementById('od-bdi-sg')?.value) || 0;
    const r = parseFloat(document.getElementById('od-bdi-r')?.value) || 0;
    const df = parseFloat(document.getElementById('od-bdi-df')?.value) || 0;
    const l = parseFloat(document.getElementById('od-bdi-l')?.value) || 0;
    const t = parseFloat(document.getElementById('od-bdi-t')?.value) || 0;

    const cfg = {
      ac,
      sg,
      s: sg * 0.65,
      g: sg * 0.35,
      r,
      df,
      l,
      t,
      desonerado: !!this.desoneradoLeisSociais
    };

    DB.saveBDIEmpresaPadrao(cfg);
    DB.saveBDIConfig(obraId, cfg);
    Utils.toast('🏢 BDI padrão da construtora atualizado e aplicado a esta obra!', 'success');
  },

  restaurarBDITCU(obraId) {
    const isDeson = !!this.desoneradoLeisSociais;
    const defaultCfg = {
      ac: 4.00,
      sg: 1.20,
      r: 1.20,
      df: 1.23,
      l: 7.40,
      t: isDeson ? 11.15 : 6.65,
      desonerado: isDeson
    };
    DB.saveBDIConfig(obraId, defaultCfg);
    const container = document.getElementById('od-subtab-orcado-content');
    if (container && this.currentObraId) {
      container.innerHTML = this._renderSubTabOrcadoContent('leis-sociais', this.currentObraId);
    }
    Utils.toast('🔄 Parâmetros de BDI restaurados para os valores padrão do TCU Acórdão 2622/2013!', 'info');
  },

  // ── CONFIGURAÇÃO E EDIÇÃO DO CRONOGRAMA ──
  abrirModalConfigCronograma(obraId) {
    const crono = DB.getCronogramaFisicoFinanceiro(obraId);
    const config = DB.getCronogramaConfig(obraId) || {};
    const totalMeses = crono.totalMeses || 12;
    const mesInicio = config.mesInicio || new Date().toISOString().slice(0, 7);
    const modeloCurva = config.modeloCurva || 'gaussiana';

    const modalHtml = `
      <div class="modal" style="max-width:800px;width:95%;">
        <div class="modal-header">
          <span class="modal-title">✏️ Configurar Cronograma Físico-Financeiro</span>
          <button class="modal-close" data-od-click="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="max-height:75vh;overflow-y:auto;padding:20px;">
          <div style="font-size:.84rem;color:var(--text2);margin-bottom:16px;line-height:1.4;">
            Personalize a duração da obra em meses, o mês de início e o valor previsto de cada macro-etapa.
            A distribuição mensal e a Curva S serão recalculadas com precisão de engenharia civil.
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px;margin-bottom:18px;background:var(--bg-secondary);padding:14px;border-radius:var(--r-md);border:1px solid var(--border);">
            <div>
              <label style="font-size:.76rem;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Duração da Obra (Meses)</label>
              <input type="number" id="od-cfg-meses" class="form-control" min="3" max="36" value="${totalMeses}">
            </div>
            <div>
              <label style="font-size:.76rem;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Mês Inicial de Obra</label>
              <input type="month" id="od-cfg-inicio" class="form-control" value="${mesInicio}">
            </div>
            <div>
              <label style="font-size:.76rem;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Distribuição dos Desembolsos</label>
              <select id="od-cfg-modelo" class="form-control">
                <option value="gaussiana" ${modeloCurva==='gaussiana'?'selected':''}>Curva S Gaussiana (Padrão Engenharia)</option>
                <option value="linear" ${modeloCurva==='linear'?'selected':''}>Distribuição Linear Equilibrada</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom:8px;font-weight:800;font-size:.9rem;color:var(--text);display:flex;justify-content:space-between;align-items:center;">
            <span>Macro-Etapas e Valores Previstos</span>
            <span id="od-cfg-total-previsto" style="color:var(--accent);font-size:.95rem;">
              Total Previsto: ${Utils.fmt.currency(crono.bac)}
            </span>
          </div>

          <div style="border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;">
            <table class="table" style="margin:0;font-size:.82rem;">
              <thead>
                <tr style="background:var(--bg-secondary);">
                  <th style="width:55px;text-align:center;">Ativo</th>
                  <th>Macro-Etapa de Obra</th>
                  <th style="text-align:right;width:200px;">Valor Previsto Total (R$)</th>
                </tr>
              </thead>
              <tbody>
                ${crono.linhas.map((l, idx) => `
                  <tr>
                    <td style="text-align:center;">
                      <input type="checkbox" id="od-cfg-chk-${idx}" data-idx="${idx}" data-codigo="${l.codigo}" ${l.ativa !== false ? 'checked' : ''} style="cursor:pointer;" data-od-change="ObraDetalhe._atualizarSomaModalCronograma()">
                    </td>
                    <td style="font-weight:700;color:var(--text);">
                      ${Utils.escapeHtml(l.nome)}
                    </td>
                    <td style="text-align:right;">
                      <input type="number" step="0.01" min="0" id="od-cfg-val-${idx}" data-idx="${idx}" data-codigo="${l.codigo}" class="form-control form-control-sm od-cfg-step-val"
                             value="${l.previstoTotal || 0}" style="text-align:right;font-weight:800;" data-od-input="ObraDetalhe._atualizarSomaModalCronograma()">
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <button class="btn btn-secondary btn-sm" data-od-click="ObraDetalhe.restaurarConfigCronograma('${obraId}')">
            🔄 Restaurar Distribuição Padrão
          </button>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary" data-od-click="Utils.closeModal()">Cancelar</button>
            <button class="btn btn-primary" data-od-click="ObraDetalhe.salvarConfigCronograma('${obraId}')" style="font-weight:800;">
              💾 Salvar Cronograma Personalizado
            </button>
          </div>
        </div>
      </div>
    `;

    Utils.showModal(modalHtml);
  },

  _atualizarSomaModalCronograma() {
    let soma = 0;
    const inputs = document.querySelectorAll('.od-cfg-step-val');
    inputs.forEach(inp => {
      const idx = inp.dataset.idx;
      const chk = document.getElementById(`od-cfg-chk-${idx}`);
      if (!chk || chk.checked) {
        soma += parseFloat(inp.value) || 0;
      }
    });
    const el = document.getElementById('od-cfg-total-previsto');
    if (el) el.textContent = `Total Previsto: ${Utils.fmt.currency(soma)}`;
  },

  salvarConfigCronograma(obraId) {
    const totalMeses = parseInt(document.getElementById('od-cfg-meses')?.value, 10) || 12;
    const mesInicio = document.getElementById('od-cfg-inicio')?.value || new Date().toISOString().slice(0, 7);
    const modeloCurva = document.getElementById('od-cfg-modelo')?.value || 'gaussiana';

    const etapas = [];
    const inputs = document.querySelectorAll('.od-cfg-step-val');
    inputs.forEach(inp => {
      const idx = inp.dataset.idx;
      const codigo = inp.dataset.codigo;
      const chk = document.getElementById(`od-cfg-chk-${idx}`);
      const ativa = chk ? chk.checked : true;
      const valor = parseFloat(inp.value) || 0;
      etapas.push({
        codigo,
        ativa,
        valorPrevisto: valor
      });
    });

    const config = {
      totalMeses: Math.max(3, Math.min(36, totalMeses)),
      mesInicio,
      modeloCurva,
      etapas
    };

    DB.saveCronogramaConfig(obraId, config);
    Utils.closeModal();
    this.setSubTabOrcado('cronograma');
    Utils.toast('✅ Cronograma físico-financeiro personalizado salvo com sucesso!', 'success');
  },

  restaurarConfigCronograma(obraId) {
    Utils.confirm('Deseja realmente restaurar o cronograma para os valores proporcionais técnicos padrão?', () => {
      DB.saveCronogramaConfig(obraId, null);
      Utils.closeModal();
      this.setSubTabOrcado('cronograma');
      Utils.toast('🔄 Cronograma restaurado para o padrão proporcional técnico.', 'info');
    });
  },

  // ── MENU MODAL DE SELEÇÃO: EXPORTAR JUNTO OU SEPARADO ──
  abrirMenuExportar(tipo, obraId) {
    const id = obraId || this.currentObraId;
    const isExcel = tipo === 'excel';
    const titulo = isExcel ? '📊 Exportar Planilha Excel (.xlsx)' : '🖨️ Imprimir / Gerar PDF Oficial (A4)';
    const desc = isExcel
      ? 'Selecione se deseja baixar o Dossiê Completo com todas as abas consolidadas ou apenas uma planilha específica.'
      : 'Selecione se deseja imprimir o Dossiê Executivo Completo ou emitir apenas uma prancha/relatório específico.';

    const opcoes = [
      {
        modo: 'completo',
        icone: isExcel ? '📚' : '📄',
        titulo: 'Dossiê Completo de Engenharia (Tudo Junto)',
        desc: isExcel
          ? 'Gera arquivo .xlsx único contendo 4 abas: Cronograma Físico-Financeiro, Curva ABC, Orçado vs Realizado e BDI/Leis Sociais.'
          : 'Emite o Dossiê Executivo Integrado A4 Paisagem com todas as 4 seções, gráficos e termo de autenticidade.'
      },
      {
        modo: 'cronograma',
        icone: '📅',
        titulo: 'Apenas Cronograma Físico-Financeiro Mensal',
        desc: isExcel
          ? 'Planilha .xlsx dedicada com as 13 macro-etapas, desembolsos mensais previstos e Curva S.'
          : 'Prancha técnica de Cronograma Físico-Financeiro em formato A4 Paisagem pronta para impressão.'
      },
      {
        modo: 'curva-abc',
        icone: '📊',
        titulo: 'Apenas Curva ABC de Insumos & Serviços (Pareto 80/20)',
        desc: isExcel
          ? 'Planilha .xlsx dedicada com todos os insumos classificados por criticidade (Classes A, B e C).'
          : 'Relatório A4 com resumo de Pareto, insumos críticos e concentrações de custo.'
      },
      {
        modo: 'orcado-realizado',
        icone: '📈',
        titulo: 'Apenas Orçado × Realizado & Análise de Valor Agregado (EVM)',
        desc: isExcel
          ? 'Planilha .xlsx com macro-etapas, saldo financeiro, desvios e indicadores BAC, PV, EV, AC, CPI, SPI.'
          : 'Relatório executivo A4 de comparativo orçamentário e índices de prazo e custo.'
      },
      {
        modo: 'bdi',
        icone: '⚖️',
        titulo: 'Apenas Memória de BDI Oficial & Encargos Sociais',
        desc: isExcel
          ? 'Planilha .xlsx analítica com a fórmula do TCU Acórdão 2622/2013 e encargos Grupos A, B, C e D.'
          : 'Relatório técnico oficial A4 detalhando as alíquotas de BDI e leis sociais para auditoria e órgãos financiadores.'
      }
    ];

    const html = `
      <div class="modal" style="max-width:620px;width:95%;">
        <div class="modal-header">
          <span class="modal-title">${titulo}</span>
          <button class="modal-close" data-od-click="Utils.closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:18px;">
          <p style="font-size:.84rem;color:var(--text2);margin-bottom:16px;line-height:1.4;">${desc}</p>
          <div style="display:grid;gap:10px;">
            ${opcoes.map(op => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);gap:12px;transition:border-color .2s;" data-od-mouseenter="this.style.borderColor='var(--accent)'" data-od-mouseleave="this.style.borderColor='var(--border)'">
                <div style="flex:1;">
                  <div style="font-weight:800;font-size:.88rem;color:var(--text);display:flex;align-items:center;gap:6px;">
                    <span>${op.icone}</span> ${op.titulo}
                  </div>
                  <div style="font-size:.76rem;color:var(--text3);margin-top:2px;line-height:1.3;">
                    ${op.desc}
                  </div>
                </div>
                <div>
                  <button class="btn btn-sm ${op.modo==='completo'?'btn-primary':'btn-secondary'}"
                          data-od-click="Utils.closeModal(); ${isExcel ? `ObraDetalhe.exportarExcel('${op.modo}', '${id}')` : `ObraDetalhe.imprimir('${op.modo}', '${id}')`}"
                          style="font-weight:700;white-space:nowrap;">
                    ${isExcel ? 'Baixar .xlsx' : 'Imprimir / PDF'}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-od-click="Utils.closeModal()">Fechar</button>
        </div>
      </div>
    `;

    Utils.showModal(html);
  },

  // ── MOTOR MODULAR DE EXPORTAÇÃO EXCEL (.XLSX) ──
  exportarExcel(modo = 'completo', obraId = null) {
    const id = obraId || this.currentObraId;
    if (!id) {
      Utils.toast('Selecione uma obra para exportar.', 'warning');
      return;
    }

    if (typeof XLSX === 'undefined') {
      Utils.toast('Biblioteca XLSX não disponível no navegador.', 'danger');
      return;
    }

    const comp = (typeof DB !== 'undefined' && DB.getOrcamentoVsRealizado)
      ? DB.getOrcamentoVsRealizado(id)
      : null;
    const cs = DB.getCurvaS ? DB.getCurvaS(id) : null;
    const crono = DB.getCronogramaFisicoFinanceiro ? DB.getCronogramaFisicoFinanceiro(id) : null;
    const abc = DB.getCurvaABC ? DB.getCurvaABC(id) : null;
    const isDeson = !!this.desoneradoLeisSociais;
    const leis = DB.getLeisSociais ? DB.getLeisSociais(isDeson) : null;
    const bdi = DB.getBDIConfig ? DB.getBDIConfig(id, { desonerado: isDeson }) : null;
    const obra = DB.getById('clientes', id) || { nome: 'Todas as Obras / Geral' };
    const emp = DB.getEmpresa() || {};
    const empNome = emp.razao_social || emp.nome_fantasia || 'FINOBRA CONSTRUTORA';

    const wb = XLSX.utils.book_new();

    const addSheet = (data, name) => {
      if (!data || !data.length) return;
      const safeData = data.map(row => Array.isArray(row) ? row.map(cell => this._safeSpreadsheetCell(cell)) : row);
      const ws = XLSX.utils.aoa_to_sheet(safeData);
      let maxCols = 0;
      for (let r = 0; r < data.length; r++) {
        if (Array.isArray(data[r]) && data[r].length > maxCols) {
          maxCols = data[r].length;
        }
      }
      const wcol = [];
      for (let colIdx = 0; colIdx < maxCols; colIdx++) {
        let maxLen = 10;
        for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
          const row = data[rowIdx];
          if (row && row[colIdx] !== null && row[colIdx] !== undefined) {
            const strLen = String(row[colIdx]).length;
            if (strLen > maxLen) maxLen = strLen;
          }
        }
        wcol.push({ wch: Math.min(60, Math.max(12, maxLen + 2)) });
      }
      ws['!cols'] = wcol;
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    };

    // 1. Cronograma
    if ((modo === 'completo' || modo === 'cronograma') && crono && crono.linhas) {
      const rowsCrono = [
        [`CRONOGRAMA FÍSICO-FINANCEIRO MENSAL — ${empNome.toUpperCase()}`],
        [`Obra: ${obra.nome} | Contrato: ${obra.num_contrato_caixa || 'N/A'} | Duração: ${crono.totalMeses} meses | Emissão: ${new Date().toLocaleDateString('pt-BR')}`],
        [''],
        ['Macro-Etapa de Obra', 'Total Previsto (R$)', ...crono.mesesLabels]
      ];

      crono.linhas.forEach(l => {
        rowsCrono.push([
          l.nome,
          l.previstoTotal,
          ...l.meses.map(m => m.valor)
        ]);
        rowsCrono.push([
          `  └ % Etapa no Mês`,
          '100.0%',
          ...l.meses.map(m => (m.percentual > 0 ? `${m.percentual}%` : '0%'))
        ]);
      });

      rowsCrono.push(['']);
      rowsCrono.push([
        'DESEMBOLSO MENSAL PREVISTO (R$)',
        crono.bac || (comp ? comp.totalOrcado : 0),
        ...crono.totaisMensais.map(t => t.valorPrevisto || t.previsto || 0)
      ]);
      rowsCrono.push([
        'AVANÇO FÍSICO MENSAL (%)',
        '100.0%',
        ...crono.totaisMensais.map(t => `${t.percentualPrevisto || 0}%`)
      ]);
      rowsCrono.push([
        'AVANÇO FÍSICO ACUMULADO (CURVA S %)',
        '100.0%',
        ...crono.totaisAcumulados.map(t => `${t.percentualAcumulado || 0}%`)
      ]);

      addSheet(rowsCrono, 'Cronograma Físico-Financ');
    }

    // 2. Curva ABC
    if ((modo === 'completo' || modo === 'curva-abc') && abc && abc.itens) {
      const rowsABC = [
        [`CURVA ABC DE INSUMOS E SERVIÇOS (PARETO 80/20) — ${empNome.toUpperCase()}`],
        [`Obra: ${obra.nome} | Itens Analisados: ${abc.totalItens} | Custo Global: ${Utils.fmt.currency(abc.totalValor)}`],
        ['Resumo de Pareto:', `Classe A: ${abc.classeA.pct}% (${Utils.fmt.currency(abc.classeA.valor)})`, `Classe B: ${abc.classeB.pct}% (${Utils.fmt.currency(abc.classeB.valor)})`, `Classe C: ${abc.classeC.pct}% (${Utils.fmt.currency(abc.classeC.valor)})`],
        [''],
        ['Ranking', 'Insumo / Composição / Serviço', 'Categoria', 'Unid.', 'Qtd.', 'Custo Unitário (R$)', 'Valor Total (R$)', '% Individual', '% Acumulado', 'Classe ABC']
      ];

      abc.itens.forEach(it => {
        rowsABC.push([
          it.ranking,
          it.descricao,
          it.categoria,
          it.unidade || 'UN',
          it.quantidade || 1,
          it.custoUnitario || it.valorTotal,
          it.valorTotal,
          `${it.pctIndividual}%`,
          `${it.pctAcumulado}%`,
          it.classe
        ]);
      });

      addSheet(rowsABC, 'Curva ABC');
    }

    // 3. Orçado vs Realizado
    if ((modo === 'completo' || modo === 'orcado-realizado') && comp && comp.etapas) {
      const rowsComp = [
        [`ORÇADO VS REALIZADO & INDICADORES DE VALOR AGREGADO (EVM) — ${empNome.toUpperCase()}`],
        [`Obra: ${obra.nome} | Emissão: ${new Date().toLocaleDateString('pt-BR')}`],
        [''],
        ['Macro-Etapa de Obra', 'Orçado Previsto (R$)', 'Realizado Executado (R$)', 'Saldo / Desvio (R$)', '% Executado', 'Status Executivo']
      ];

      comp.etapas.forEach(e => {
        rowsComp.push([
          e.nome,
          e.orcado || e.previsto || 0,
          e.realizado || 0,
          e.saldo || 0,
          `${e.percentual || 0}%`,
          (e.status || 'normal').toUpperCase()
        ]);
      });

      rowsComp.push([
        'TOTAL GERAL DA OBRA',
        comp.totalOrcado,
        comp.totalRealizado,
        comp.saldoRestante || comp.saldoGeral || 0,
        `${comp.percentualFinanceiro || comp.percentualGeral || 0}%`,
        (comp.statusSaude || 'saudavel').toUpperCase()
      ]);

      if (cs) {
        rowsComp.push(['']);
        rowsComp.push(['GESTÃO DE VALOR AGREGADO (EVM)', 'Valor', 'Classificação / Unidade']);
        rowsComp.push(['Custo Orçado no Término (BAC)', cs.bac, 'R$']);
        rowsComp.push(['Valor Planejado Atual (PV)', cs.pv, 'R$']);
        rowsComp.push(['Valor Agregado Físico (EV)', cs.ev, 'R$']);
        rowsComp.push(['Custo Real Incorrido (AC)', cs.ac, 'R$']);
        rowsComp.push(['Índice de Desempenho de Custo (CPI)', cs.cpi, cs.cpi >= 1 ? 'Econômico / Sob Controle' : 'Estouro de Custo']);
        rowsComp.push(['Índice de Desempenho de Prazo (SPI)', cs.spi, cs.spi >= 1 ? 'No Prazo / Adiantado' : 'Atrasado']);
        rowsComp.push(['Estimativa de Custo no Término (EAC)', cs.eac, 'R$ Projetado ao Final']);
        rowsComp.push(['Variação Projetada no Término (VAC)', cs.vac, cs.vac >= 0 ? 'Economia Projetada (R$)' : 'Estouro Projetado (R$)']);
      }

      addSheet(rowsComp, 'Orçado vs Realizado');
    }

    // 4. BDI e Leis Sociais
    if ((modo === 'completo' || modo === 'bdi') && bdi && leis) {
      const rowsBDI = [
        [`COMPOSIÇÃO ANALÍTICA DO BDI & ENCARGOS SOCIAIS — ${empNome.toUpperCase()}`],
        [`Obra: ${obra.nome} | Metodologia TCU Acórdão 2622/2013 | Regime CPRB: ${isDeson ? 'Desonerado' : 'Não Desonerado'}`],
        [''],
        ['PARÂMETROS DE CÁLCULO DO BDI', 'Taxa Aplicada (%)', 'Faixa de Referência TCU Acórdão 2622/2013'],
        ['Administração Central (AC)', `${bdi.ac}%`, '3,00% a 5,50%'],
        ['Seguro e Garantia (SG)', `${bdi.sg}%`, '0,80% a 1,20%'],
        ['Risco e Imprevistos (R)', `${bdi.r}%`, '0,97% a 1,27%'],
        ['Despesas Financeiras (DF)', `${bdi.df}%`, '0,59% a 1,39%'],
        ['Lucro Operacional Bruto (L)', `${bdi.l}%`, '6,16% a 8,96%'],
        ['Tributos e Impostos (T: PIS + COFINS + ISS)', `${bdi.t}%`, '4,65% a 8,65%'],
        ['TAXA FINAL CALCULADA DE BDI', `${bdi.bdiCalculado}%`, 'Fórmula TCU Acórdão 2622/2013'],
        [''],
        ['ENCARGOS SOCIAIS DA CONSTRUÇÃO CIVIL (LEIS SOCIAIS)', 'Não Desonerado', 'Desonerado (CPRB)'],
        ['Grupo A (Encargos Básicos / Previdenciários)', '36,80%', '16,80%'],
        ['Grupo B (Descanso Remunerado, Férias, Feriados)', '44,76%', '44,76%'],
        ['Grupo C (Aviso Prévio, Indenizações)', '9,97%', '9,97%'],
        ['Grupo D (Reincidências do Grupo A sobre Grupo B)', '11,20%', '5,12%'],
        ['TOTAL DE ENCARGOS SOCIAIS (%)', `${leis.totalGeral}%`, isDeson ? 'Desonerado' : 'Onerado']
      ];

      addSheet(rowsBDI, 'BDI e Leis Sociais');
    }

    const safeNome = (obra.nome || 'Obra')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 25);
    const dataIso = (typeof Utils !== 'undefined' && Utils.today) ? Utils.today() : new Date().toISOString().slice(0, 10);

    const prefixo = modo === 'cronograma' ? 'Cronograma_Fisico_Financeiro'
      : modo === 'curva-abc' ? 'Curva_ABC_Pareto'
      : modo === 'orcado-realizado' ? 'Orcado_vs_Realizado'
      : modo === 'bdi' ? 'BDI_e_Leis_Sociais'
      : 'Dossie_Engenharia';

    const nomeArq = modo === 'completo'
      ? `Dossie_Engenharia_${safeNome}_${dataIso}.xlsx`
      : `${prefixo}_${safeNome}_${dataIso}.xlsx`;

    try {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArq;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      Utils.toast(`✅ Planilha "${nomeArq}" baixada com sucesso!`, 'success');
    } catch(err) {
      console.warn('Fallback XLSX.writeFile:', err);
      try {
        XLSX.writeFile(wb, nomeArq);
        Utils.toast(`✅ Planilha "${nomeArq}" baixada via XLSX.writeFile!`, 'success');
      } catch(err2) {
        console.error('Erro na exportação Excel:', err2);
        Utils.toast('Erro ao gerar arquivo Excel. Verifique permissões do navegador.', 'danger');
      }
    }
  },

  exportarExcelEngenharia(obraId) {
    this.exportarExcel('completo', obraId);
  },

  exportarPDFEngenharia(obraId) {
    this.imprimir('completo', obraId);
  },

  imprimirOrcadoVsRealizado(obraId) {
    this.imprimir('completo', obraId);
  },

  // ── MOTOR MODULAR DE IMPRESSÃO / PDF A4 (JUNTO OU SEPARADO) ──
  imprimir(modo = 'completo', obraId = null) {
    const id = obraId || this.currentObraId;
    if (!id) {
      Utils.toast('Selecione uma obra para imprimir.', 'warning');
      return;
    }

    const comp = (typeof DB !== 'undefined' && DB.getOrcamentoVsRealizado)
      ? DB.getOrcamentoVsRealizado(id)
      : null;
    if (!comp) {
      Utils.toast('Não foi possível carregar os dados comparativos para emissão.', 'danger');
      return;
    }

    const cs = DB.getCurvaS ? DB.getCurvaS(id) : null;
    const abc = DB.getCurvaABC ? DB.getCurvaABC(id) : null;
    const crono = DB.getCronogramaFisicoFinanceiro ? DB.getCronogramaFisicoFinanceiro(id) : null;
    const leis = DB.getLeisSociais ? DB.getLeisSociais(this.desoneradoLeisSociais || false) : null;
    const bdi = DB.getBDIConfig ? DB.getBDIConfig(id) : null;

    const obraRaw = DB.getById('clientes', id) || { nome: 'Todas as Obras / Geral' };
    const obra = this._safeHtmlRecord(obraRaw);
    const empRaw = DB.getEmpresa() || {};
    const emp = this._safeHtmlRecord(empRaw);
    const empNome = emp.razao_social || emp.nome_fantasia || 'FINOBRA CONSTRUTORA';
    const safeLogoUrl = Utils.safeUrl ? Utils.safeUrl(empRaw.logo_url) : '';

    const tituloRelatorio = modo === 'cronograma' ? 'CRONOGRAMA FÍSICO-FINANCEIRO MENSAL OFICIAL'
      : modo === 'curva-abc' ? 'CURVA ABC DE INSUMOS & SERVIÇOS (PARETO 80/20)'
      : modo === 'orcado-realizado' ? 'RELATÓRIO ORÇADO × REALIZADO & ANÁLISE DE VALOR AGREGADO'
      : modo === 'bdi' ? 'MEMÓRIA DE CÁLCULO OFICIAL DE BDI & ENCARGOS SOCIAIS'
      : 'DOSSIÊ EXECUTIVO DE ENGENHARIA DE CUSTOS & RELATÓRIO ORÇADO × REALIZADO';

    const win = window.open('', '_blank');
    if (!win) {
      Utils.toast('Permita popups no navegador para imprimir o relatório.', 'warning');
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data: https:; script-src 'none'; script-src-attr 'none';">
        <title>${tituloRelatorio} - ${Utils.escapeHtml(obra.nome)}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5px; color: #0f172a; margin: 0; padding: 10px; background: #fff; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0 !important; }
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .action-bar { background: #0f172a; color: #fff; padding: 8px 14px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
          .title { font-size: 13px; font-weight: 900; color: #0f172a; }
          .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-bottom: 12px; }
          .kpi-card { border: 1px solid #cbd5e1; background: #f8fafc; padding: 6px 8px; border-radius: 4px; }
          .kpi-title { font-size: 7px; text-transform: uppercase; font-weight: 700; color: #64748b; }
          .kpi-val { font-size: 11.5px; font-weight: 900; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 7.8px; }
          th { background: #0f172a; color: #fff; font-weight: 700; padding: 4px 6px; text-align: left; }
          td { padding: 3.5px 6px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) td { background: #f8fafc; }
          .tfoot td { background: #e2e8f0; font-weight: 900; border-top: 2px solid #0f172a; }
          .section-title { font-size: 9.5px; font-weight: 900; color: #0f172a; margin-top: 10px; margin-bottom: 2px; display: flex; align-items: center; gap: 4px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px; padding-top: 14px; border-top: 1px dashed #cbd5e1; }
          .sig-line { border-bottom: 1px solid #64748b; height: 26px; margin-bottom: 4px; }
          .footer { margin-top: 14px; border-top: 1px solid #cbd5e1; padding-top: 5px; display: flex; justify-content: space-between; font-size: 7px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="no-print action-bar">
          <div style="font-weight:700;font-size:11px;display:flex;align-items:center;gap:8px;">
            <span>📄 ${tituloRelatorio} (Visualização de Impressão A4)</span>
          </div>
          <div style="display:flex;gap:8px;">
            <button id="od-print-window-btn" style="background:#10b981;color:#fff;border:none;padding:5px 12px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10px;">
              🖨️ Salvar como PDF / Imprimir
            </button>
            <button id="od-close-window-btn" style="background:#475569;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:10px;">
              ✖️ Fechar
            </button>
          </div>
        </div>

        <div class="header">
          <div style="display:flex;align-items:center;gap:10px;">
            ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="${empNome}" style="max-height:38px;max-width:90px;object-fit:contain;">` : ''}
            <div>
              <div style="font-size:12px;font-weight:900;color:#0f172a;">${Utils.escapeHtml(empNome)}</div>
              <div style="color:#64748b;font-size:8px;">Planejamento Físico-Financeiro &amp; Engenharia de Custos</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div class="title">${tituloRelatorio}</div>
            <div style="font-size:8px;color:#64748b;">
              Obra: <strong>${Utils.escapeHtml(obra.nome)}</strong> &bull;
              Contrato Caixa: <strong>${obra.num_contrato_caixa || 'N/A'}</strong> &bull;
              Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
            </div>
          </div>
        </div>

        <!-- KPIs Resumo Executivo -->
        <div class="kpis">
          <div class="kpi-card">
            <div class="kpi-title">Orçamento Previsto (BAC)</div>
            <div class="kpi-val">${Utils.fmt.currency(crono ? crono.bac : comp.totalOrcado)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Custo Real Incorrido (AC)</div>
            <div class="kpi-val" style="color:#991b1b;">${Utils.fmt.currency(comp.totalRealizado)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Índice Custo (CPI/IDC)</div>
            <div class="kpi-val" style="color:${cs && cs.cpi>=1?'#166534':'#991b1b'};">${cs ? cs.cpi.toFixed(2) : '1.00'}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Índice Prazo (SPI/IDP)</div>
            <div class="kpi-val" style="color:${cs && cs.spi>=1?'#166534':'#991b1b'};">${cs ? cs.spi.toFixed(2) : '1.00'}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">BDI Aplicado</div>
            <div class="kpi-val" style="color:#0284c7;">${bdi ? bdi.bdiCalculado : 24.23}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Encargos Sociais</div>
            <div class="kpi-val">${leis ? leis.totalGeral : 84.04}%</div>
          </div>
        </div>

        <!-- SEÇÃO: CRONOGRAMA FÍSICO-FINANCEIRO (Se modo === 'cronograma' ou 'completo') -->
        ${(modo === 'cronograma' || modo === 'completo') && crono ? `
          <div class="section-title">📅 Cronograma Físico-Financeiro Mensal (${crono.totalMeses} Meses)</div>
          <table>
            <thead>
              <tr>
                <th style="min-width:180px;">Macro-Etapa</th>
                <th style="text-align:right;width:95px;">Previsto Total</th>
                ${crono.mesesLabels.slice(0, 12).map(l => `<th style="text-align:center;">${l}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${crono.linhas.map(l => `
                <tr>
                  <td style="font-weight:600;">${Utils.escapeHtml(l.nome)}</td>
                  <td style="text-align:right;font-weight:700;">${Utils.fmt.currency(l.previstoTotal)}</td>
                  ${l.meses.slice(0, 12).map(m => `
                    <td style="text-align:center;">
                      ${m.percentual > 0 ? `<strong>${m.percentual}%</strong><br><span style="color:#64748b;font-size:7px;">${Utils.fmt.currency(m.valor)}</span>` : '—'}
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="tfoot">
                <td>DESEMBOLSO PREVISTO NO MÊS</td>
                <td style="text-align:right;">${Utils.fmt.currency(crono.bac || comp.totalOrcado)}</td>
                ${crono.totaisMensais.slice(0, 12).map(tm => `
                  <td style="text-align:center;">${Utils.fmt.currency(tm.valorPrevisto || tm.previsto || 0)}</td>
                `).join('')}
              </tr>
              <tr class="tfoot">
                <td>AVANÇO ACUMULADO (CURVA S)</td>
                <td style="text-align:right;">100.0%</td>
                ${crono.totaisAcumulados.slice(0, 12).map(ta => `
                  <td style="text-align:center;color:#166534;"><strong>${ta.percentualAcumulado}%</strong></td>
                `).join('')}
              </tr>
            </tfoot>
          </table>
        ` : ''}

        <!-- SEÇÃO: CURVA ABC (Se modo === 'curva-abc' ou 'completo') -->
        ${(modo === 'curva-abc' || modo === 'completo') && abc ? `
          <div class="section-title" style="margin-top:12px;">📊 Curva ABC de Insumos &amp; Serviços (Pareto 80/20)</div>
          <div style="display:flex;gap:10px;margin-bottom:6px;font-size:7.5px;">
            <div style="border:1px solid #cbd5e1;padding:4px 8px;border-radius:4px;background:#f8fafc;">
              <strong>Classe A (Críticos):</strong> ${abc.classeA.pct}% do custo (${Utils.fmt.currency(abc.classeA.valor)}) &bull; ${abc.classeA.qtd} itens
            </div>
            <div style="border:1px solid #cbd5e1;padding:4px 8px;border-radius:4px;background:#f8fafc;">
              <strong>Classe B (Médios):</strong> ${abc.classeB.pct}% do custo (${Utils.fmt.currency(abc.classeB.valor)}) &bull; ${abc.classeB.qtd} itens
            </div>
            <div style="border:1px solid #cbd5e1;padding:4px 8px;border-radius:4px;background:#f8fafc;">
              <strong>Classe C (Secundários):</strong> ${abc.classeC.pct}% do custo (${Utils.fmt.currency(abc.classeC.valor)}) &bull; ${abc.classeC.qtd} itens
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:30px;text-align:center;">#</th>
                <th>Insumo / Composição</th>
                <th style="width:90px;">Categoria</th>
                <th style="text-align:right;width:80px;">Valor Total</th>
                <th style="text-align:right;width:60px;">% Total</th>
                <th style="text-align:right;width:60px;">% Acum.</th>
                <th style="text-align:center;width:45px;">Classe</th>
              </tr>
            </thead>
            <tbody>
              ${abc.itens.slice(0, modo === 'curva-abc' ? 25 : 10).map(i => `
                <tr>
                  <td style="text-align:center;font-weight:700;">${i.ranking}</td>
                  <td style="font-weight:600;">${Utils.escapeHtml(i.descricao)}</td>
                  <td>${Utils.escapeHtml(i.categoria)}</td>
                  <td style="text-align:right;font-weight:700;">${Utils.fmt.currency(i.valorTotal)}</td>
                  <td style="text-align:right;">${i.pctIndividual}%</td>
                  <td style="text-align:right;font-weight:700;color:#166534;">${i.pctAcumulado}%</td>
                  <td style="text-align:center;font-weight:800;color:${i.classe==='A'?'#991b1b':'#0f172a'};">${i.classe}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <!-- SEÇÃO: ORÇADO VS REALIZADO & EVM (Se modo === 'orcado-realizado' ou 'completo') -->
        ${(modo === 'orcado-realizado' || modo === 'completo') && comp && comp.etapas ? `
          <div class="section-title" style="margin-top:12px;">📈 Planilha de Acompanhamento Orçado × Realizado &amp; Desvios</div>
          <table>
            <thead>
              <tr>
                <th>Macro-Etapa</th>
                <th style="text-align:right;width:110px;">Orçado (R$)</th>
                <th style="text-align:right;width:110px;">Realizado (R$)</th>
                <th style="text-align:right;width:110px;">Saldo (R$)</th>
                <th style="text-align:right;width:80px;">% Consumido</th>
                <th style="text-align:center;width:90px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${comp.etapas.map(e => `
                <tr>
                  <td style="font-weight:600;">${Utils.escapeHtml(e.nome)}</td>
                  <td style="text-align:right;">${Utils.fmt.currency(e.orcado || e.previsto || 0)}</td>
                  <td style="text-align:right;color:#991b1b;font-weight:700;">${Utils.fmt.currency(e.realizado || 0)}</td>
                  <td style="text-align:right;font-weight:700;color:${(e.saldo||0)>=0?'#166534':'#991b1b'};">
                    ${(e.saldo||0)<0?'-':''}${Utils.fmt.currency(Math.abs(e.saldo || 0))}
                  </td>
                  <td style="text-align:right;">${e.percentual || 0}%</td>
                  <td style="text-align:center;font-weight:700;">${(e.status||'normal').toUpperCase()}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="tfoot">
                <td>TOTAL GERAL DA OBRA</td>
                <td style="text-align:right;">${Utils.fmt.currency(comp.totalOrcado)}</td>
                <td style="text-align:right;color:#991b1b;">${Utils.fmt.currency(comp.totalRealizado)}</td>
                <td style="text-align:right;color:${comp.saldoGeral>=0?'#166534':'#991b1b'};">${Utils.fmt.currency(comp.saldoGeral || comp.saldoRestante)}</td>
                <td style="text-align:right;">${comp.percentualFinanceiro || comp.percentualGeral}%</td>
                <td style="text-align:center;">${(comp.statusSaude || comp.statusGeral || 'saudavel').toUpperCase()}</td>
              </tr>
            </tfoot>
          </table>
        ` : ''}

        <!-- SEÇÃO: BDI E ENCARGOS SOCIAIS (Se modo === 'bdi' ou 'completo') -->
        ${(modo === 'bdi' || modo === 'completo') && bdi ? `
          <div class="section-title" style="margin-top:12px;">⚖️ Parâmetros de BDI Oficial (TCU Acórdão 2622/2013) &amp; Encargos Sociais</div>
          <div style="border:1px solid #cbd5e1;border-radius:4px;padding:8px;background:#f8fafc;font-size:7.8px;">
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;margin-bottom:8px;">
              <div>Administração Central (AC): <strong>${bdi.ac}%</strong></div>
              <div>Seguro e Garantia (SG): <strong>${bdi.sg}%</strong></div>
              <div>Risco do Empreendimento (R): <strong>${bdi.r}%</strong></div>
              <div>Despesas Financeiras (DF): <strong>${bdi.df}%</strong></div>
              <div>Lucro Operacional Bruto (L): <strong>${bdi.l}%</strong></div>
              <div>Tributos Incidentes (T): <strong>${bdi.t}%</strong></div>
            </div>
            <div style="border-top:1px solid #cbd5e1;padding-top:6px;display:flex;justify-content:space-between;font-size:8.5px;font-weight:900;">
              <span>BDI Final Homologado: <span style="color:#0284c7;">${bdi.bdiCalculado}%</span></span>
              <span>Encargos Sociais Mão de Obra (${this.desoneradoLeisSociais?'Desonerado':'Com Oneração'}): <span style="color:#166534;">${leis ? leis.totalGeral : 84.04}%</span></span>
              <span>Referência TCU Edifícios: Mediana 22,18% (Faixa 20,34% a 25,00%)</span>
            </div>
          </div>
        ` : ''}

        <div class="signatures">
          <div style="text-align:center;">
            <div class="sig-line"></div>
            <strong>${obra.engenheiro_responsavel || 'Engenheiro Responsável Técnico'}</strong><br>
            <span style="color:#64748b;font-size:7px;">CREA / CAU: ${emp.crea_cau || 'Registro Profissional Homologado'}</span>
          </div>
          <div style="text-align:center;">
            <div class="sig-line"></div>
            <strong>${emp.razao_social || empNome}</strong><br>
            <span style="color:#64748b;font-size:7px;">Gestão de Planejamento &amp; Engenharia de Custos</span>
          </div>
        </div>

        <div class="footer">
          <span>FinObra &bull; Relatório Executivo de Engenharia de Custos &bull; Em conformidade com TCU Acórdão 2622/2013 e Lei 14.133/2021</span>
          <span>Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</span>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    const printButton = win.document.getElementById('od-print-window-btn');
    const closeButton = win.document.getElementById('od-close-window-btn');
    if (printButton) printButton.addEventListener('click', () => win.print());
    if (closeButton) closeButton.addEventListener('click', () => win.close());
    win.focus();
    setTimeout(() => { win.print(); }, 400);
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
          <button class="btn btn-secondary btn-sm" data-od-click="ImportarExcel.abrirModal('${obraId}')" style="border:1px solid var(--accent);color:var(--accent2);">
            📊 Importar Excel
          </button>
          <button class="btn btn-sm" data-od-click="OCR.abrirModal()" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;font-weight:700;">
            🤖 Ler com IA (OCR)
          </button>
          <button class="btn btn-success btn-sm" data-od-click="App.obraId='${obraId}';Lancamentos.showForm('receita')" style="font-weight:800;">
            + Nova Receita
          </button>
          <button class="btn btn-danger btn-sm" data-od-click="App.obraId='${obraId}';Lancamentos.showForm('despesa')" style="font-weight:800;">
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
          <div style="font-weight:700;font-size:.85rem;color:var(--text);">${Utils.escapeHtml(l.descricao)}</div>
          ${l.fornecedor ? `<div style="font-size:.72rem;color:var(--text3);">Fornecedor: ${Utils.escapeHtml(l.fornecedor)}</div>` : ''}
        </td>
        <td>
          <span style="font-size:.75rem;color:var(--text2);background:var(--bg-secondary);padding:2px 8px;border-radius:4px;border:1px solid var(--border);">
            ${Utils.escapeHtml(l.categoria || 'Geral')}
          </span>
        </td>
        <td style="font-size:.8rem;color:var(--text3);">
          ${Utils.escapeHtml(conta)}
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
          <button class="icon-btn btn-sm" data-od-click="Lancamentos.showForm ? Lancamentos.showForm('${l.tipo}','${l.id}') : Lancamentos.edit('${l.id}')" title="Editar">✏️</button>
          <button class="icon-btn btn-sm" style="color:var(--danger)" data-od-click="Lancamentos.del('${l.id}')" title="Excluir">🗑️</button>
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
            <button class="btn btn-secondary btn-sm" data-od-click="FasesDoc.expandAll()">Expandir Fases</button>
            <button class="btn btn-secondary btn-sm" data-od-click="FasesDoc.collapseAll()">Recolher</button>
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
        <button class="btn btn-primary btn-sm" data-od-click="App.obraId='${obraId}';Medicoes.showForm()" style="font-weight:800;">
          + Nova Medição
        </button>
      </div>

      ${!meds.length ? `
        <div class="card" style="text-align:center;padding:36px;color:var(--text3);">
          <div style="font-size:2.5rem;margin-bottom:8px;">🔨</div>
          <h3>Nenhuma medição registrada para esta obra</h3>
          <p style="font-size:.85rem;margin-bottom:14px;">Cadastre a primeira medição para acompanhar o avanço físico e faturamento.</p>
          <button class="btn btn-primary btn-sm" data-od-click="App.obraId='${obraId}';Medicoes.showForm()">+ Cadastrar 1ª Medição</button>
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
                      <div style="font-weight:700;color:var(--text);font-size:.85rem;">${Utils.escapeHtml(m.etapa_descricao || 'Etapa da Obra')}</div>
                      ${m.observacoes ? `<div style="font-size:.72rem;color:var(--text3);">${Utils.escapeHtml(m.observacoes)}</div>` : ''}
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
                      <button class="icon-btn btn-sm" data-od-click="Medicoes.showForm('${m.id}')" title="Editar">✏️</button>
                      <button class="icon-btn btn-sm" style="color:var(--danger)" data-od-click="Medicoes.del('${m.id}')" title="Excluir">🗑️</button>
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
          <button class="btn btn-primary btn-sm" data-od-click="Recibos.novoReciboModal({ obra_id: '${obraId}' })" style="font-weight:800;">
            + Emitir Novo Recibo
          </button>
          <button class="btn btn-secondary btn-sm" data-od-click="App.obraId='${obraId}';App.navigate('contratos')" style="font-weight:700;">
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
                    <button class="btn btn-sm btn-ghost" style="padding:2px 6px;font-size:.72rem;color:var(--accent);" data-od-click="Recibos.visualizarRecibo('${r.id}')">
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
                <button class="btn btn-secondary btn-sm" data-od-click="App.obraId='${obraId}';App.navigate('contratos')">Gerar Modelo de Contrato</button>
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
                  <button class="btn btn-sm btn-secondary" data-od-click="Contratos.visualizarContrato('${c.id}')">
                    Abrir
                  </button>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>`;
  },

  // ===== IMPRESSÃO DO DOSSIÊ EXECUTIVO =====
  imprimirDossie(obraId) {
    const id = obraId || this.currentObraId;
    if (!id) {
      Utils.toast('Selecione uma obra para imprimir o dossiê.', 'warning');
      return;
    }
    const obra = DB.getById('clientes', id);
    if (!obra) {
      Utils.toast('Obra não encontrada.', 'error');
      return;
    }

    const htmlDossie = this.gerarHTMLDossie(id);

    let printFrame = document.getElementById('finobra-print-frame');
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'finobra-print-frame';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
    }

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <title>Dossiê Executivo — ${obra.nome} — FinObra</title>
          <meta charset="utf-8">
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 10mm 12mm 10mm;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background: #ffffff;
              color: #0f172a;
              font-size: 10px;
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              padding: 0;
            }
            .page-break { page-break-before: always; }
            .avoid-break { page-break-inside: avoid; }
            table { width: 100%; border-collapse: collapse; page-break-inside: auto; margin-bottom: 10px; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            th, td { padding: 5px 7px; text-align: left; font-size: 9.5px; }
            th { background: #0f172a; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.4px; }
            tbody tr:nth-child(even) { background: #f8fafc; }
            tbody tr { border-bottom: 1px solid #e2e8f0; }
            .section-header {
              font-size: 11px;
              font-weight: 800;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 3px;
              margin-top: 14px;
              margin-bottom: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .grid-kpis {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 8px;
              margin-bottom: 10px;
            }
            .kpi-card {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 5px;
              padding: 7px 8px;
              text-align: center;
            }
            .kpi-title {
              font-size: 8px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              margin-bottom: 2px;
            }
            .kpi-value {
              font-size: 13px;
              font-weight: 900;
              color: #0f172a;
            }
            .badge-status {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 8.5px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .badge-concluido { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
            .badge-andamento { background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }
            .badge-pendente { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
            .badge-dispensado { background: #e0f2fe; color: #075985; border: 1px solid #bae6fd; }
          </style>
        </head>
        <body>
          ${htmlDossie}
        </body>
      </html>
    `);
    doc.close();

    if (typeof Utils !== 'undefined' && Utils.toast) {
      Utils.toast('Gerando dossiê da obra para impressão...', 'info');
    }

    setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    }, 450);
  },

  gerarHTMLDossie(obraId) {
    const obraRaw = DB.getById('clientes', obraId);
    if (!obraRaw) return '<p>Obra não encontrada</p>';
    const obra = this._safeHtmlRecord(obraRaw);

    const empRaw = (typeof DB !== 'undefined' && DB.getEmpresa) ? (DB.getEmpresa() || {}) : {};
    const emp = this._safeHtmlRecord(empRaw);
    const r = DB.getResumo(obraId);
    const orc = DB.getAll('orcamentos').find(o => o.obra_id === obraId);
    
    let pctFisico = 0;
    let valorOrcado = obra.valor_total || obra.valor_contrato || 0;
    if (orc && orc.etapas && orc.etapas.length) {
      const tv = orc.etapas.reduce((s,e) => s + (e.valor_previsto||0), 0);
      const tr = orc.etapas.reduce((s,e) => s + (e.valor_realizado||0), 0);
      pctFisico = tv > 0 ? Math.min(100, (tr/tv)*100) : 0;
      if (!valorOrcado) valorOrcado = tv;
    }

    const pctFinanceiro = valorOrcado > 0 ? Math.min(100, (r.totalDespesas / valorOrcado) * 100) : 0;
    const meds = DB.getAll('medicoes').filter(m => m.obra_id === obraId).sort((a,b) => (a.numero_medicao||0) - (b.numero_medicao||0));
    const fases = (typeof DB.getDocFases === 'function') ? DB.getDocFases(obraId) : { pre_obra: [], durante_obra: [], pos_obra: [] };
    const docResumo = (typeof DB.getDocFasesResumo === 'function') ? DB.getDocFasesResumo(obraId) : null;
    const lans = DB.getLancamentos(obraId);

    const modMap = {
      caixa: 'Caixa Econômica Federal',
      particular: 'Recursos Próprios',
      administracao: 'Administração',
      empreitada: 'Empreitada Global',
      reforma: 'Reforma / Comercial',
      outros_bancos: 'Financiamento Bancário'
    };
    const modLabel = modMap[obra.modalidade_obra || 'caixa'] || 'Caixa Econômica Federal';

    // Header Logo
    const empNome = emp.nome_fantasia || emp.razao_social || 'Minha Empresa';
    const safeLogoUrl = Utils.safeUrl ? Utils.safeUrl(empRaw.logo_url) : '';
    const logoHtml = safeLogoUrl
      ? `<img src="${safeLogoUrl}" alt="${empNome}" style="max-height:48px;max-width:130px;object-fit:contain;">`
      : `<div style="font-weight:900;font-size:16px;color:#0f172a;letter-spacing:-0.5px;">🏢 ${empNome.toUpperCase()}</div>`;

    // Resumo fases docs
    const preDocs = fases.pre_obra || [];
    const durDocs = fases.durante_obra || [];
    const posDocs = fases.pos_obra || [];

    const countStatus = (list, st) => list.filter(d => d.status === st).length;
    const preConc = countStatus(preDocs, 'concluido');
    const durConc = countStatus(durDocs, 'concluido');
    const posConc = countStatus(posDocs, 'concluido');

    const totalDocs = preDocs.length + durDocs.length + posDocs.length;
    const totalConc = preConc + durConc + posConc;
    const totalPct = totalDocs > 0 ? Math.round((totalConc / totalDocs) * 100) : 0;

    return `
      <!-- CABEÇALHO CORPORATIVO -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${logoHtml}
          <div>
            <div style="font-size:13px;font-weight:800;color:#0f172a;line-height:1.2;">${empNome}</div>
            <div style="font-size:9px;color:#475569;margin-top:2px;">
              ${emp.cnpj ? `CNPJ: ${emp.cnpj} &bull; ` : ''}
              ${emp.telefone ? `Tel: ${emp.telefone} &bull; ` : ''}
              ${emp.email || ''}
            </div>
            <div style="font-size:8.5px;color:#64748b;">
              ${emp.cidade ? `${emp.cidade}/${emp.estado || ''}` : 'Gestão de Engenharia & Construção'}
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:14px;font-weight:900;color:#0f172a;letter-spacing:-0.2px;">DOSSIÊ EXECUTIVO DA OBRA</div>
          <div style="display:inline-block;margin-top:3px;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:800;background:${obra.status==='concluida'?'#dcfce7':'#e0f2fe'};color:${obra.status==='concluida'?'#166534':'#075985'};border:1px solid ${obra.status==='concluida'?'#bbf7d0':'#bae6fd'};">
            ${(obra.status || 'EM ANDAMENTO').toUpperCase().replace('_',' ')}
          </div>
          <div style="font-size:8.5px;color:#64748b;margin-top:4px;">
            Emissão: <strong>${new Date().toLocaleDateString('pt-BR')}</strong> às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style="font-size:8px;color:#94a3b8;">Cód. Referência: #${obra.id.substring(0,8)}</div>
        </div>
      </div>

      <!-- SEÇÃO 1: DADOS CADASTRAIS & TÉCNICOS -->
      <div class="avoid-break">
        <div class="section-header">
          <span>1. Identificação do Empreendimento & Contratante</span>
          <span style="font-size:9px;font-weight:600;color:#64748b;">DADOS TÉCNICOS & CONTRATUAIS</span>
        </div>
        <table style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:5px;margin-bottom:12px;">
          <tbody>
            <tr>
              <td style="width:18%;font-weight:700;color:#475569;">Empreendimento:</td>
              <td style="width:32%;font-weight:800;color:#0f172a;">${obra.nome}</td>
              <td style="width:18%;font-weight:700;color:#475569;">Modalidade:</td>
              <td style="width:32%;font-weight:800;color:#0f172a;">${modLabel}</td>
            </tr>
            <tr>
              <td style="font-weight:700;color:#475569;">Cliente / Titular:</td>
              <td style="color:#0f172a;">${obra.nome}</td>
              <td style="font-weight:700;color:#475569;">CPF / CNPJ:</td>
              <td style="color:#0f172a;">${obra.cpf_cnpj || 'Não informado'}</td>
            </tr>
            <tr>
              <td style="font-weight:700;color:#475569;">Telefone / WhatsApp:</td>
              <td style="color:#0f172a;">${obra.telefone || '—'}</td>
              <td style="font-weight:700;color:#475569;">E-mail:</td>
              <td style="color:#0f172a;">${obra.email || '—'}</td>
            </tr>
            <tr>
              <td style="font-weight:700;color:#475569;">Local da Obra:</td>
              <td style="color:#0f172a;" colspan="3">
                ${obra.endereco ? obra.endereco + ', ' : ''}${obra.bairro ? obra.bairro + ' — ' : ''}${obra.cidade || '—'}/${obra.estado || '—'} ${obra.cep ? '&bull; CEP: ' + obra.cep : ''}
              </td>
            </tr>
            <tr>
              <td style="font-weight:700;color:#475569;">Responsável Técnico:</td>
              <td style="color:#0f172a;">${obra.engenheiro_responsavel || obra.responsavel || empNome}</td>
              <td style="font-weight:700;color:#475569;">Registro CREA / CAU:</td>
              <td style="color:#0f172a;">${obra.crea_cau || '—'} ${obra.art_rrt ? ` &bull; ART: ${obra.art_rrt}` : ''}</td>
            </tr>
            <tr>
              <td style="font-weight:700;color:#475569;">Área Construída:</td>
              <td style="color:#0f172a;">${obra.area_construida ? obra.area_construida + ' m²' : '—'} &bull; ${obra.padrao_obra || obra.tipo || 'Padrão Residencial'}</td>
              <td style="font-weight:700;color:#475569;">Contrato Bancário:</td>
              <td style="color:#0f172a;">${obra.numero_contrato_caixa || obra.contrato_banco || 'Recursos Próprios / Direto'}${obra.agencia_caixa ? ` (Ag: ${obra.agencia_caixa})` : ''}</td>
            </tr>
            <tr>
              <td style="font-weight:700;color:#475569;">Data de Início:</td>
              <td style="color:#0f172a;">${Utils.fmt.date(obra.data_inicio) || '—'}</td>
              <td style="font-weight:700;color:#475569;">Previsão de Término:</td>
              <td style="color:#0f172a;">${Utils.fmt.date(obra.data_previsao_fim || obra.data_fim) || '—'} ${obra.prazo_meses ? `(${obra.prazo_meses} meses)` : ''}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- SEÇÃO 2: QUADRO RESUMO FINANCEIRO & FÍSICO -->
      <div class="avoid-break">
        <div class="section-header">
          <span>2. Balanço Financeiro & Desempenho Operacional</span>
          <span style="font-size:9px;font-weight:600;color:#64748b;">VALORES EM REAIS (R$)</span>
        </div>
        <div class="grid-kpis">
          <div class="kpi-card">
            <div class="kpi-title">Valor Contratado</div>
            <div class="kpi-value">${Utils.fmt.currency(valorOrcado)}</div>
            <div style="font-size:7.5px;color:#64748b;margin-top:2px;">Previsão Total</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Recebido</div>
            <div class="kpi-value" style="color:#166534;">${Utils.fmt.currency(r.totalReceitas)}</div>
            <div style="font-size:7.5px;color:#166534;margin-top:2px;">Faturado / Liberado</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Despesas Realizadas</div>
            <div class="kpi-value" style="color:#991b1b;">${Utils.fmt.currency(r.totalDespesas)}</div>
            <div style="font-size:7.5px;color:#991b1b;margin-top:2px;">Custo Total Pago</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Saldo da Obra</div>
            <div class="kpi-value" style="color:${r.saldo>=0?'#166534':'#991b1b'};">${Utils.fmt.currency(r.saldo)}</div>
            <div style="font-size:7.5px;color:#64748b;margin-top:2px;">Receitas &minus; Despesas</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Avanço Físico</div>
            <div class="kpi-value" style="color:#0f766e;">${pctFisico.toFixed(1)}%</div>
            <div style="font-size:7.5px;color:#0f766e;margin-top:2px;">Financeiro: ${pctFinanceiro.toFixed(1)}%</div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;background:#f1f5f9;border:1px solid #cbd5e1;padding:6px 10px;border-radius:4px;font-size:8.5px;margin-bottom:12px;">
          <span>Contas a Pagar: <strong>${Utils.fmt.currency(r.aPagarValor)}</strong> (${r.aPagar} títulos)</span>
          <span>Contas a Receber: <strong>${Utils.fmt.currency(r.aReceberValor)}</strong> (${r.aReceber} títulos)</span>
          <span>Notas Fiscais Pendentes: <strong>${Utils.fmt.currency(r.nfPendentesValor)}</strong></span>
        </div>
      </div>

      <!-- SEÇÃO 3: CRONOGRAMA DE MEDIÇÕES & FATURAMENTO FÍSICO -->
      <div class="avoid-break">
        <div class="section-header">
          <span>3. Cronograma de Medições & Faturamento Físico (${meds.length})</span>
          <span style="font-size:9px;font-weight:600;color:#64748b;">LIBERAÇÕES E VISTORIAS</span>
        </div>
        ${!meds.length ? `
          <div style="padding:10px;border:1px dashed #cbd5e1;text-align:center;color:#64748b;font-size:9px;margin-bottom:12px;border-radius:4px;">
            Nenhuma medição física formal cadastrada para esta obra até o momento.
          </div>
        ` : `
          <table style="border:1px solid #cbd5e1;margin-bottom:12px;">
            <thead>
              <tr>
                <th style="width:40px;text-align:center;">Nº</th>
                <th>Etapa Executada</th>
                <th style="width:75px;text-align:center;">Data Medição</th>
                <th style="width:65px;text-align:center;">% Avanço</th>
                <th style="width:90px;text-align:right;">Valor Solicitado</th>
                <th style="width:90px;text-align:right;">Valor Liberado</th>
                <th style="width:75px;text-align:center;">Data Liberação</th>
                <th style="width:75px;text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${meds.map(m => `
                <tr>
                  <td style="text-align:center;font-weight:800;color:#0f172a;">${m.numero_medicao}ª</td>
                  <td>
                    <div style="font-weight:700;color:#0f172a;">${Utils.escapeHtml(m.etapa_descricao || 'Etapa da Obra')}</div>
                    ${m.observacoes ? `<div style="font-size:8px;color:#64748b;">${Utils.escapeHtml(m.observacoes)}</div>` : ''}
                  </td>
                  <td style="text-align:center;color:#475569;">${Utils.fmt.date(m.data_medicao || m.data)}</td>
                  <td style="text-align:center;font-weight:700;color:#0f766e;">${m.percentual_fisico || 0}%</td>
                  <td style="text-align:right;color:#475569;">${Utils.fmt.currency(m.valor_solicitado)}</td>
                  <td style="text-align:right;font-weight:800;color:#166534;">${Utils.fmt.currency(m.valor_liberado || m.valor_solicitado)}</td>
                  <td style="text-align:center;color:#475569;">${m.data_liberacao ? Utils.fmt.date(m.data_liberacao) : '—'}</td>
                  <td style="text-align:center;">
                    <span class="badge-status ${m.status==='liberada'?'badge-concluido':m.status==='em_analise'||m.status==='submetida'?'badge-andamento':'badge-pendente'}">
                      ${m.status === 'liberada' ? 'Liberada' : (m.status === 'em_analise' ? 'Em Análise' : (m.status || 'Pendente'))}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f1f5f9;font-weight:800;">
                <td colspan="4" style="text-align:right;padding:6px 8px;">TOTAIS DAS MEDIÇÕES:</td>
                <td style="text-align:right;padding:6px 8px;">${Utils.fmt.currency(meds.reduce((s,m)=>s+(m.valor_solicitado||0),0))}</td>
                <td style="text-align:right;padding:6px 8px;color:#166534;">${Utils.fmt.currency(meds.filter(m=>m.status==='liberada').reduce((s,m)=>s+(m.valor_liberado||0),0))}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        `}
      </div>

      <!-- SEÇÃO 4: MATRIZ DO PERCURSO DOCUMENTAL & REGULATÓRIO (43 ITENS) -->
      <div class="avoid-break">
        <div class="section-header">
          <span>4. Matriz de Conformidade Documental & Licenciamento (${totalConc}/${totalDocs} &bull; ${totalPct}%)</span>
          <span style="font-size:9px;font-weight:600;color:#64748b;">43 OBRIGAÇÕES REGULATÓRIAS</span>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:10px;">
          <div style="background:#f8fafc;border:1px solid #cbd5e1;padding:6px 8px;border-radius:4px;">
            <div style="font-weight:800;font-size:9px;color:#0f172a;">Fase 1 &bull; Pré-Obra</div>
            <div style="font-size:8.5px;color:#475569;">${preConc} de ${preDocs.length} concluídos (${preDocs.length ? Math.round(preConc/preDocs.length*100) : 0}%)</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #cbd5e1;padding:6px 8px;border-radius:4px;">
            <div style="font-weight:800;font-size:9px;color:#0f172a;">Fase 2 &bull; Durante Obra</div>
            <div style="font-size:8.5px;color:#475569;">${durConc} de ${durDocs.length} concluídos (${durDocs.length ? Math.round(durConc/durDocs.length*100) : 0}%)</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #cbd5e1;padding:6px 8px;border-radius:4px;">
            <div style="font-weight:800;font-size:9px;color:#0f172a;">Fase 3 &bull; Pós-Obra</div>
            <div style="font-size:8.5px;color:#475569;">${posConc} de ${posDocs.length} concluídos (${posDocs.length ? Math.round(posConc/posDocs.length*100) : 0}%)</div>
          </div>
        </div>

        <table style="border:1px solid #cbd5e1;margin-bottom:12px;">
          <thead>
            <tr>
              <th style="width:110px;">Fase</th>
              <th style="width:210px;">Documento / Licença</th>
              <th>Descrição Técnica / Finalidade</th>
              <th style="width:80px;text-align:center;">Status</th>
              <th style="width:130px;">Dados / Protocolo</th>
            </tr>
          </thead>
          <tbody>
            ${[
              ...preDocs.map(d => ({ ...d, faseNome: '1. Pré-Obra' })),
              ...durDocs.map(d => ({ ...d, faseNome: '2. Durante Obra' })),
              ...posDocs.map(d => ({ ...d, faseNome: '3. Pós-Obra' }))
            ].map(d => {
              const stClass = d.status === 'concluido' ? 'badge-concluido' : (d.status === 'em_andamento' ? 'badge-andamento' : (d.status === 'dispensado' ? 'badge-dispensado' : 'badge-pendente'));
              const stText = d.status === 'concluido' ? 'Concluído' : (d.status === 'em_andamento' ? 'Em Andamento' : (d.status === 'dispensado' ? 'Dispensado' : 'Não Iniciado'));
              const info = [
                d.protocolo ? `Prot: ${d.protocolo}` : '',
                d.orgao_emissor ? `Órgão: ${d.orgao_emissor}` : '',
                d.data_validade ? `Val: ${Utils.fmt.date(d.data_validade)}` : ''
              ].filter(Boolean).join(' &bull; ');

              return `
                <tr>
                  <td style="font-weight:700;color:#475569;font-size:8.5px;">${d.faseNome}</td>
                  <td style="font-weight:700;color:#0f172a;">${d.icone || '📄'} ${d.nome}</td>
                  <td style="color:#475569;font-size:8.5px;">${d.desc || '—'}</td>
                  <td style="text-align:center;">
                    <span class="badge-status ${stClass}">${stText}</span>
                  </td>
                  <td style="font-size:8px;color:#64748b;">${info || '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- SEÇÃO 5: EXTRATO DAS MOVIMENTAÇÕES FINANCEIRAS -->
      <div class="avoid-break">
        <div class="section-header">
          <span>5. Extrato Resumido dos Lançamentos Financeiros (Recentes)</span>
          <span style="font-size:9px;font-weight:600;color:#64748b;">CONTROLE DE CAIXA</span>
        </div>
        ${!lans.length ? `
          <div style="padding:10px;border:1px dashed #cbd5e1;text-align:center;color:#64748b;font-size:9px;margin-bottom:12px;border-radius:4px;">
            Nenhum lançamento financeiro registrado nesta obra.
          </div>
        ` : `
          <table style="border:1px solid #cbd5e1;margin-bottom:12px;">
            <thead>
              <tr>
                <th style="width:75px;">Data</th>
                <th>Descrição / Favorecido</th>
                <th style="width:120px;">Categoria</th>
                <th style="width:70px;text-align:center;">Tipo</th>
                <th style="width:90px;text-align:right;">Valor (R$)</th>
                <th style="width:75px;text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${lans.slice(0, 20).map(l => `
                <tr>
                  <td style="color:#475569;">${Utils.fmt.date(l.data)}</td>
                  <td style="font-weight:600;color:#0f172a;">${Utils.escapeHtml(l.descricao)}</td>
                  <td style="color:#64748b;font-size:8.5px;">${Utils.escapeHtml(l.categoria || 'Geral')}</td>
                  <td style="text-align:center;font-weight:700;color:${l.tipo==='receita'?'#166534':'#991b1b'};">
                    ${l.tipo === 'receita' ? '+ Receita' : '- Despesa'}
                  </td>
                  <td style="text-align:right;font-weight:800;color:${l.tipo==='receita'?'#166534':'#0f172a'};">
                    ${Utils.fmt.currency(l.valor)}
                  </td>
                  <td style="text-align:center;">
                    <span class="badge-status ${l.status==='recebido'||l.status==='pago'?'badge-concluido':l.status==='cancelado'?'badge-dispensado':'badge-andamento'}">
                      ${l.status === 'pago' ? 'Pago' : (l.status === 'recebido' ? 'Recebido' : (l.status === 'a_pagar' ? 'A Pagar' : (l.status || 'Pendente')))}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${lans.length > 20 ? `<div style="font-size:8px;color:#64748b;text-align:right;margin-top:-6px;margin-bottom:10px;">Exibindo os 20 lançamentos mais recentes de um total de ${lans.length}.</div>` : ''}
        `}
      </div>

      <!-- SEÇÃO 6: TERMO DE AUTENTICIDADE & ASSINATURAS -->
      <div class="avoid-break" style="margin-top:16px;border-top:1px solid #cbd5e1;padding-top:12px;">
        <div style="font-size:8.5px;color:#475569;text-align:justify;line-height:1.4;margin-bottom:30px;">
          <strong>Declaração de Conformidade:</strong> Certificamos para todos os fins de direito que este 
          <strong>Dossiê Executivo da Obra</strong> consolida fielmente a escrituração físico-financeira, as medições de engenharia 
          e o percurso documental do empreendimento identificado acima até a presente data, servindo para prestação de contas, 
          auditoria, acompanhamento bancário e controle de engenharia.
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:20px;">
          <!-- Assinatura Contratante -->
          <div style="text-align:center;">
            <div style="border-top:1px solid #0f172a;margin-bottom:6px;width:85%;margin-left:auto;margin-right:auto;"></div>
            <div style="font-weight:800;font-size:10px;color:#0f172a;">${obra.nome}</div>
            <div style="font-size:8.5px;color:#64748b;">Contratante / Proprietário(a)</div>
            <div style="font-size:8px;color:#94a3b8;">${obra.cpf_cnpj ? `CPF/CNPJ: ${obra.cpf_cnpj}` : ''}</div>
          </div>

          <!-- Assinatura Responsável Técnico -->
          <div style="text-align:center;">
            <div style="border-top:1px solid #0f172a;margin-bottom:6px;width:85%;margin-left:auto;margin-right:auto;"></div>
            <div style="font-weight:800;font-size:10px;color:#0f172a;">${obra.engenheiro_responsavel || obra.responsavel || empNome}</div>
            <div style="font-size:8.5px;color:#64748b;">Responsável Técnico / Engenharia</div>
            <div style="font-size:8px;color:#94a3b8;">
              ${obra.crea_cau ? `CREA/CAU: ${obra.crea_cau}` : (emp.cnpj ? `CNPJ: ${emp.cnpj}` : '')}
            </div>
          </div>
        </div>

        <!-- Rodapé Final -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e2e8f0;padding-top:6px;font-size:7.5px;color:#94a3b8;">
          <span>FinObra &bull; Sistema de Gestão Financeira & Percurso Documental</span>
          <span>Impresso em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')} &bull; Documento Oficial</span>
        </div>
      </div>
    `;
  }
};

window.ObraDetalhe = ObraDetalhe;


/* FINOBRA_PATCH25_EVENT_BRIDGE */
(() => {
  if (globalThis.__finobraObraDetalheEventBridge) return;
  globalThis.__finobraObraDetalheEventBridge = true;

  const allowed = {
    'Clientes.showForm': (...a) => Clientes.showForm(...a),
    'App.navigate': (...a) => App.navigate(...a),
    'ObraDetalhe.imprimirDossie': (...a) => ObraDetalhe.imprimirDossie(...a),
    'ObraDetalhe.setTab': (...a) => ObraDetalhe.setTab(...a),
    'ObraDetalhe.setSubTabOrcado': (...a) => ObraDetalhe.setSubTabOrcado(...a),
    'ObraDetalhe.exportarExcelEngenharia': (...a) => ObraDetalhe.exportarExcelEngenharia(...a),
    'ObraDetalhe.exportarPDFEngenharia': (...a) => ObraDetalhe.exportarPDFEngenharia(...a),
    'ObraDetalhe.abrirMenuExportar': (...a) => ObraDetalhe.abrirMenuExportar(...a),
    'ObraDetalhe.abrirModalConfigCronograma': (...a) => ObraDetalhe.abrirModalConfigCronograma(...a),
    'ObraDetalhe.exportarExcel': (...a) => ObraDetalhe.exportarExcel(...a),
    'ObraDetalhe.imprimir': (...a) => ObraDetalhe.imprimir(...a),
    'ObraDetalhe.setRegimeLeisSociais': (...a) => ObraDetalhe.setRegimeLeisSociais(...a),
    'ObraDetalhe.salvarBDI': (...a) => ObraDetalhe.salvarBDI(...a),
    'ObraDetalhe.salvarBDIPadrao': (...a) => ObraDetalhe.salvarBDIPadrao(...a),
    'ObraDetalhe.restaurarBDITCU': (...a) => ObraDetalhe.restaurarBDITCU(...a),
    'ObraDetalhe.restaurarConfigCronograma': (...a) => ObraDetalhe.restaurarConfigCronograma(...a),
    'ObraDetalhe.salvarConfigCronograma': (...a) => ObraDetalhe.salvarConfigCronograma(...a),
    'ObraDetalhe._atualizarSomaModalCronograma': (...a) => ObraDetalhe._atualizarSomaModalCronograma(...a),
    'ObraDetalhe.recalcularBDIInput': (...a) => ObraDetalhe.recalcularBDIInput(...a),
    'Utils.closeModal': (...a) => Utils.closeModal(...a),
    'ImportarExcel.abrirModal': (...a) => ImportarExcel.abrirModal(...a),
    'OCR.abrirModal': (...a) => OCR.abrirModal(...a),
    'Lancamentos.showForm': (...a) => Lancamentos.showForm(...a),
    'Lancamentos.edit': (...a) => Lancamentos.edit(...a),
    'Lancamentos.del': (...a) => Lancamentos.del(...a),
    'FasesDoc.expandAll': (...a) => FasesDoc.expandAll(...a),
    'FasesDoc.collapseAll': (...a) => FasesDoc.collapseAll(...a),
    'Medicoes.showForm': (...a) => Medicoes.showForm(...a),
    'Medicoes.del': (...a) => Medicoes.del(...a),
    'Recibos.novoReciboModal': (...a) => Recibos.novoReciboModal(...a),
    'Recibos.visualizarRecibo': (...a) => Recibos.visualizarRecibo(...a),
    'Contratos.visualizarContrato': (...a) => Contratos.visualizarContrato(...a)
  };

  function splitStatements(input) {
    const out = []; let cur = ''; let quote = null; let esc = false; let depth = 0;
    for (const ch of String(input || '')) {
      if (esc) { cur += ch; esc = false; continue; }
      if (ch === '\\') { cur += ch; esc = true; continue; }
      if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
      if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      if (ch === ')' || ch === '}' || ch === ']') depth--;
      if (ch === ';' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function parseArgs(raw) {
    const s = String(raw || '').trim();
    if (!s) return [];
    const parts = []; let cur = ''; let quote = null; let esc = false; let depth = 0;
    for (const ch of s) {
      if (esc) { cur += ch; esc = false; continue; }
      if (ch === '\\') { cur += ch; esc = true; continue; }
      if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
      if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
      if (ch === '{' || ch === '[' || ch === '(') depth++;
      if (ch === '}' || ch === ']' || ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts.map(v => {
      if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
        return v.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
      }
      if (v === 'true') return true;
      if (v === 'false') return false;
      if (v === 'null') return null;
      if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
      throw new Error('Argumento CSP não permitido');
    });
  }

  function runStatement(stmt, el) {
    const hover = stmt.match(/^this\.style\.borderColor='(var\(--(?:accent|border)\))'$/);
    if (hover) { el.style.borderColor = hover[1]; return; }

    const assignObra = stmt.match(/^App\.obraId='([^']*)'$/);
    if (assignObra) { App.obraId = assignObra[1]; return; }

    const ternary = stmt.match(/^Lancamentos\.showForm \? Lancamentos\.showForm\('([^']*)','([^']*)'\) : Lancamentos\.edit\('([^']*)'\)$/);
    if (ternary) {
      if (typeof Lancamentos.showForm === 'function') Lancamentos.showForm(ternary[1], ternary[2]);
      else Lancamentos.edit(ternary[3]);
      return;
    }

    const receipt = stmt.match(/^Recibos\.novoReciboModal\(\{ obra_id: '([^']*)' \}\)$/);
    if (receipt) { Recibos.novoReciboModal({ obra_id: receipt[1] }); return; }

    const call = stmt.match(/^([A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*)\((.*)\)$/s);
    if (!call || !allowed[call[1]]) throw new Error('Ação CSP não permitida');
    allowed[call[1]](...parseArgs(call[2]));
  }

  function execute(el, command) {
    try {
      for (const stmt of splitStatements(command)) runStatement(stmt, el);
    } catch (err) {
      console.error('[Patch25 CSP] ação bloqueada:', err?.message || err);
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Ação bloqueada por política de segurança.', 'warning');
    }
  }

  const bind = (domEvent, attr, opts = {}) => document.addEventListener(domEvent, (ev) => {
    const el = ev.target && ev.target.closest ? ev.target.closest('[' + attr + ']') : null;
    if (!el) return;
    if (opts.boundary && ev.relatedTarget && el.contains(ev.relatedTarget)) return;
    execute(el, el.getAttribute(attr));
  }, true);

  bind('click', 'data-od-click');
  bind('change', 'data-od-change');
  bind('input', 'data-od-input');
  bind('mouseover', 'data-od-mouseenter', { boundary: true });
  bind('mouseout', 'data-od-mouseleave', { boundary: true });
})();
