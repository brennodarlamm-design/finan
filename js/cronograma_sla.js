// js/cronograma_sla.js — Gestão de Prazos & SLAs de Processos com Recálculo em Cascata
// Suporta processos de Projetos, Aprovações/Legal, Execução de Obras e Pós-Obra

const CronogramaSLA = {
  _KEY_SLAS_PADRAO: 'finobra_slas_padrao',

  // ── CATÁLOGO PADRÃO DE PROCESSOS E ETAPAS COM DEPENDÊNCIAS ──
  PADRAO_PROCESSOS: [
    {
      id: 'proc_estudo_preliminar',
      codigo: 'PROJ-01',
      nome: 'Estudo Preliminar & Levantamento',
      tipo: 'projeto',
      tipoLabel: 'Projetos',
      icone: '📐',
      dias_sla: 30,
      predecessor_id: null,
      descricao: 'Levantamento topográfico, sondagem e estudo de necessidades do cliente'
    },
    {
      id: 'proc_anteprojeto',
      codigo: 'PROJ-02',
      nome: 'Anteprojeto Arquitetônico',
      tipo: 'projeto',
      tipoLabel: 'Projetos',
      icone: '✏️',
      dias_sla: 20,
      predecessor_id: 'proc_estudo_preliminar',
      descricao: 'Plantas preliminares, cortes e modelagem 3D para aprovação do cliente'
    },
    {
      id: 'proc_projeto_executivo',
      codigo: 'PROJ-03',
      nome: 'Projeto Arquitetônico Executivo',
      tipo: 'projeto',
      tipoLabel: 'Projetos',
      icone: '🏛️',
      dias_sla: 25,
      predecessor_id: 'proc_anteprojeto',
      descricao: 'Detalhamento completo de arquitetura, paginações e esquadrias'
    },
    {
      id: 'proc_projetos_comp',
      codigo: 'PROJ-04',
      nome: 'Projetos Complementares (Estrutural, Elétrico, Hidrossanitário)',
      tipo: 'projeto',
      tipoLabel: 'Projetos',
      icone: '⚡',
      dias_sla: 30,
      predecessor_id: 'proc_projeto_executivo',
      descricao: 'Cálculo estrutural, instalações elétricas, hidrossanitárias e lógica'
    },
    {
      id: 'proc_aprovacao_pref',
      codigo: 'APROV-01',
      nome: 'Aprovação na Prefeitura & Viabilidade',
      tipo: 'aprovacao',
      tipoLabel: 'Aprovações & Legal',
      icone: '📜',
      dias_sla: 45,
      predecessor_id: 'proc_projeto_executivo',
      descricao: 'Protocolo e tramitação do processo de aprovação do projeto legal'
    },
    {
      id: 'proc_alvara_art',
      codigo: 'APROV-02',
      nome: 'Alvará de Construção & ART/RRT',
      tipo: 'aprovacao',
      tipoLabel: 'Aprovações & Legal',
      icone: '🎓',
      dias_sla: 15,
      predecessor_id: 'proc_aprovacao_pref',
      descricao: 'Emissão formal do alvará de obras e anotações de responsabilidade técnica'
    },
    {
      id: 'proc_fundacoes',
      codigo: 'OBRA-01',
      nome: 'Canteiro, Terraplenagem & Fundações',
      tipo: 'obra',
      tipoLabel: 'Execução de Obra',
      icone: '🏗️',
      dias_sla: 35,
      predecessor_id: 'proc_alvara_art',
      descricao: 'Instalação de canteiro, terraplenagem, estacas e blocos de fundação'
    },
    {
      id: 'proc_estrutura',
      codigo: 'OBRA-02',
      nome: 'Estrutura & Alvenaria',
      tipo: 'obra',
      tipoLabel: 'Execução de Obra',
      icone: '🧱',
      dias_sla: 60,
      predecessor_id: 'proc_fundacoes',
      descricao: 'Pilares, vigas, lajes e elevação de paredes de alvenaria'
    },
    {
      id: 'proc_instalacoes',
      codigo: 'OBRA-03',
      nome: 'Instalações, Cobertura & Vedações',
      tipo: 'obra',
      tipoLabel: 'Execução de Obra',
      icone: '💧',
      dias_sla: 45,
      predecessor_id: 'proc_estrutura',
      descricao: 'Tubulações hidrossanitárias, fiação elétrica e telhado'
    },
    {
      id: 'proc_acabamento',
      codigo: 'OBRA-04',
      nome: 'Revestimentos, Esquadrias & Pintura',
      tipo: 'obra',
      tipoLabel: 'Execução de Obra',
      icone: '🎨',
      dias_sla: 45,
      predecessor_id: 'proc_instalacoes',
      descricao: 'Pisos, azulejos, colocação de portas, janelas e pintura interna/externa'
    },
    {
      id: 'proc_habitese',
      codigo: 'POS-01',
      nome: 'Vistoria Prefeitura, Habite-se & Limpeza',
      tipo: 'pos_obra',
      tipoLabel: 'Pós-Obra & Entrega',
      icone: '🧹',
      dias_sla: 30,
      predecessor_id: 'proc_acabamento',
      descricao: 'Vistoria final do fiscal, emissão do Habite-se e faxina de entrega'
    },
    {
      id: 'proc_entrega',
      codigo: 'POS-02',
      nome: 'Entrega das Chaves & Manual do Proprietário',
      tipo: 'pos_obra',
      tipoLabel: 'Pós-Obra & Entrega',
      icone: '🔑',
      dias_sla: 15,
      predecessor_id: 'proc_habitese',
      descricao: 'Vistoria com o cliente, assinatura do termo de entrega e entrega das chaves'
    }
  ],

  // ── PREFERÊNCIAS DE SLA DA EMPRESA ──
  getSlasEmpresa() {
    try {
      const storageKey = (typeof DB !== 'undefined' && DB._ck) ? DB._ck(this._KEY_SLAS_PADRAO) : this._KEY_SLAS_PADRAO;
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {
      console.warn('[CronogramaSLA] Erro ao carregar SLAs:', e);
    }
    return JSON.parse(JSON.stringify(this.PADRAO_PROCESSOS));
  },

  saveSlasEmpresa(novosSlas) {
    if (!Array.isArray(novosSlas)) return false;
    try {
      const storageKey = (typeof DB !== 'undefined' && DB._ck) ? DB._ck(this._KEY_SLAS_PADRAO) : this._KEY_SLAS_PADRAO;
      localStorage.setItem(storageKey, JSON.stringify(novosSlas));
      if (typeof DB !== 'undefined' && DB.syncToCloud) {
        DB.syncToCloud('save', 'preferencias', { slas_padrao: novosSlas });
      }
      return true;
    } catch (e) {
      console.error('[CronogramaSLA] Erro ao salvar SLAs:', e);
      return false;
    }
  },

  restaurarSlasPadrao() {
    this.saveSlasEmpresa(this.PADRAO_PROCESSOS);
  },

  // ── GESTÃO DE PROCESSOS DA OBRA ──
  getObraProcessos(obraId) {
    if (!obraId) return [];
    const obra = DB.getById('clientes', obraId);
    if (!obra) return [];

    // Se a obra já tem processos customizados salvos, retorna
    if (Array.isArray(obra.processos_sla) && obra.processos_sla.length) {
      return this.calcularCascata(obra.processos_sla, obra.data_inicio);
    }

    // Caso contrário, herda do template padrão da empresa
    const padrao = this.getSlasEmpresa();
    const processos = padrao.map((p, idx) => ({
      id: p.id,
      codigo: p.codigo || `ETP-${idx + 1}`,
      nome: p.nome,
      tipo: p.tipo || 'obra',
      tipoLabel: p.tipoLabel || 'Fase',
      icone: p.icone || '📋',
      dias_sla: parseInt(p.dias_sla, 10) || 30,
      predecessor_id: p.predecessor_id || null,
      descricao: p.descricao || '',
      status: 'pendente', // 'pendente' | 'em_andamento' | 'concluido'
      data_inicio_real: '',
      data_fim_real: '',
      percentual: 0,
      observacoes: ''
    }));

    return this.calcularCascata(processos, obra.data_inicio);
  },

  salvarProcessosObra(obraId, processos) {
    if (!obraId || !Array.isArray(processos)) return false;
    const recalculados = this.calcularCascata(processos, DB.getById('clientes', obraId)?.data_inicio);
    
    // Atualiza a obra com os processos e a nova data prevista de término
    const ultimaEtapa = recalculados[recalculados.length - 1];
    const updates = {
      processos_sla: recalculados
    };
    if (ultimaEtapa && ultimaEtapa.data_fim_prevista) {
      updates.data_previsao_termino = ultimaEtapa.data_fim_prevista;
    }

    DB.update('clientes', obraId, updates);
    return true;
  },

  // ── MOTOR DE RECÁLCULO EM CASCATA ──
  calcularCascata(processosRaw, dataInicioObra = null) {
    if (!Array.isArray(processosRaw) || !processosRaw.length) return [];
    const processos = JSON.parse(JSON.stringify(processosRaw));

    // Data base inicial
    const baseDate = dataInicioObra && !isNaN(new Date(dataInicioObra).getTime())
      ? dataInicioObra
      : Utils.today();

    const procMap = new Map();
    processos.forEach(p => procMap.set(p.id, p));

    const hoje = Utils.today();
    let atrasoAcumuladoTotal = 0;

    for (let i = 0; i < processos.length; i++) {
      const p = processos[i];
      const diasSla = Math.max(1, parseInt(p.dias_sla, 10) || 15);
      p.dias_sla = diasSla;

      // Determina a data de início prevista
      let inicioPrevisto = baseDate;
      if (p.predecessor_id && procMap.has(p.predecessor_id)) {
        const pred = procMap.get(p.predecessor_id);
        // Se o predecessor foi concluído com data real, a próxima etapa começa a partir do término real
        if (pred.status === 'concluido' && pred.data_fim_real) {
          inicioPrevisto = this._somarDias(pred.data_fim_real, 1);
        } else {
          // Senão, projeta a partir do término previsto ajustado do predecessor
          inicioPrevisto = this._somarDias(pred.data_fim_prevista || baseDate, 1);
        }
      } else if (i > 0 && !p.predecessor_id) {
        // Se não tem predecessor explícito, encadeia na etapa anterior
        const prev = processos[i - 1];
        inicioPrevisto = prev.status === 'concluido' && prev.data_fim_real
          ? this._somarDias(prev.data_fim_real, 1)
          : this._somarDias(prev.data_fim_prevista || baseDate, 1);
      }

      // Se a etapa tem data_inicio_real, usa para orientar
      if (p.data_inicio_real) {
        p.data_inicio_efetiva = p.data_inicio_real;
      } else {
        p.data_inicio_efetiva = inicioPrevisto;
      }

      p.data_inicio_prevista = inicioPrevisto;
      p.data_fim_prevista = this._somarDias(p.data_inicio_efetiva, diasSla);

      // Verificação de Atraso e Semáforo (SLA)
      let diasAtraso = 0;
      let statusSla = 'no_prazo'; // 'no_prazo' | 'atencao' | 'atrasado'

      if (p.status === 'concluido') {
        if (p.data_fim_real) {
          const diff = this._diffDias(p.data_fim_real, p.data_fim_prevista);
          if (diff > 0) {
            diasAtraso = diff;
            statusSla = 'atrasado';
          } else {
            statusSla = 'no_prazo';
          }
        }
      } else if (p.status === 'em_andamento') {
        const diffHoje = this._diffDias(hoje, p.data_fim_prevista);
        if (diffHoje > 0) {
          diasAtraso = diffHoje;
          statusSla = 'atrasado';
        } else {
          const diasRestantes = Math.abs(diffHoje);
          if (diasRestantes <= 3) {
            statusSla = 'atencao';
          } else {
            statusSla = 'no_prazo';
          }
        }
      } else {
        // pendente
        if (hoje > p.data_inicio_prevista && p.status === 'pendente') {
          const diffAtrasoInicio = this._diffDias(hoje, p.data_inicio_prevista);
          if (diffAtrasoInicio > 0) {
            diasAtraso = diffAtrasoInicio;
            statusSla = 'atrasado';
          }
        }
      }

      p.dias_atraso = diasAtraso;
      p.status_sla = statusSla;
      if (diasAtraso > 0) {
        atrasoAcumuladoTotal += diasAtraso;
      }

      procMap.set(p.id, p);
    }

    return processos;
  },

  // ── RESUMO EXECUTIVO DO CRONOGRAMA ──
  getResumoObra(obraId) {
    const processos = this.getObraProcessos(obraId);
    if (!processos.length) {
      return {
        totalProcessos: 0,
        concluidos: 0,
        emAndamento: 0,
        pendentes: 0,
        atrasados: 0,
        pctGeral: 0,
        diasAtrasoAcumulado: 0,
        statusGeral: 'no_prazo',
        dataEntregaEstimada: null,
        etapaAtual: null
      };
    }

    const total = processos.length;
    const concluidos = processos.filter(p => p.status === 'concluido').length;
    const emAndamento = processos.filter(p => p.status === 'em_andamento').length;
    const pendentes = total - concluidos - emAndamento;
    const atrasados = processos.filter(p => p.status_sla === 'atrasado').length;
    const emAtencao = processos.filter(p => p.status_sla === 'atencao').length;
    const diasAtrasoTotal = processos.reduce((s, p) => s + (p.dias_atraso || 0), 0);

    const pctGeral = total > 0 ? Math.round((concluidos / total) * 100) : 0;
    const ultima = processos[processos.length - 1];
    const etapaAtual = processos.find(p => p.status === 'em_andamento') || processos.find(p => p.status === 'pendente') || ultima;

    let statusGeral = 'no_prazo';
    if (atrasados > 0) statusGeral = 'atrasado';
    else if (emAtencao > 0) statusGeral = 'atencao';

    return {
      totalProcessos: total,
      concluidos,
      emAndamento,
      pendentes,
      atrasados,
      pctGeral,
      diasAtrasoAcumulado: diasAtrasoTotal,
      statusGeral,
      dataEntregaEstimada: ultima?.data_fim_prevista || null,
      etapaAtual
    };
  },

  // ── MINI-WIDGET PARA O CARD DA OBRA ──
  miniWidget(obraId) {
    const resumo = this.getResumoObra(obraId);
    if (!resumo.totalProcessos) return '';

    const corStatus = resumo.statusGeral === 'atrasado'
      ? 'var(--danger)'
      : resumo.statusGeral === 'atencao'
        ? '#f59e0b'
        : 'var(--success)';

    const labelStatus = resumo.statusGeral === 'atrasado'
      ? `🔴 Atrasado (+${resumo.diasAtrasoAcumulado}d)`
      : resumo.statusGeral === 'atencao'
        ? '🟡 Em Atenção'
        : '🟢 No Prazo';

    const etapaNome = resumo.etapaAtual ? resumo.etapaAtual.nome : 'Sem fase ativa';

    return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.75rem;">
      <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
        <span>⏱️</span>
        <div style="min-width:0;flex:1;">
          <div style="font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${Utils.escapeHtml(etapaNome)}
          </div>
          <div style="font-size:.68rem;color:var(--text3);">
            ${resumo.concluidos}/${resumo.totalProcessos} fases (${resumo.pctGeral}%)
          </div>
        </div>
      </div>
      <span style="font-weight:800;color:${corStatus};white-space:nowrap;font-size:.72rem;">
        ${labelStatus}
      </span>
    </div>`;
  },

  // ── RENDERIZAÇÃO DA LINHA DO TEMPO COMPLETA COM CASCATA ──
  renderLinhaTempo(obraId, { somenteLeitura = false } = {}) {
    const obra = DB.getById('clientes', obraId) || {};
    const processos = this.getObraProcessos(obraId);
    const resumo = this.getResumoObra(obraId);
    const e = Utils.escapeHtml.bind(Utils);

    const corStatus = resumo.statusGeral === 'atrasado'
      ? 'var(--danger)'
      : resumo.statusGeral === 'atencao'
        ? '#f59e0b'
        : 'var(--success)';

    return `
    <div class="sla-timeline-wrapper" style="margin-bottom:24px;">
      <!-- KPI HEADER DE PRAZOS & CASCATA -->
      <div style="background:linear-gradient(135deg, var(--bg-card) 0%, rgba(201,162,39,0.06) 100%);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:16px;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;">
              <h2 style="font-size:1.2rem;font-weight:900;color:var(--text);margin:0">
                ⏱️ Gestão de Prazos &amp; SLAs em Cascata
              </h2>
              <span style="font-size:.75rem;font-weight:800;padding:2px 10px;border-radius:12px;border:1px solid ${corStatus};color:${corStatus};background:${corStatus}15;">
                ${resumo.statusGeral === 'atrasado' ? `🔴 Atraso Acumulado (+${resumo.diasAtrasoAcumulado} dias)` : resumo.statusGeral === 'atencao' ? '🟡 Em Atenção' : '🟢 Cronograma no Prazo'}
              </span>
            </div>
            <p style="font-size:.78rem;color:var(--text3);margin:4px 0 0;">
              Atrasos em fases de projetos ou licenças recalculam automaticamente a data final de entrega da obra.
            </p>
          </div>
          ${!somenteLeitura ? `
            <div style="display:flex;gap:8px;align-items:center;">
              <button class="btn btn-secondary btn-sm" data-fb-click="CronogramaSLA.abrirModalConfigObra" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(obraId))}">
                ⚙️ Ajustar Prazos da Obra
              </button>
            </div>
          ` : ''}
        </div>

        <!-- 4 CARDS DE INDICADORES -->
        <div class="g4" style="gap:12px;">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;text-align:center;">
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--text3)">Início da Obra</div>
            <div style="font-size:1.05rem;font-weight:900;color:var(--text);margin-top:2px">${Utils.fmt.date(obra.data_inicio) || 'Não definido'}</div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;text-align:center;">
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--text3)">Previsão de Entrega</div>
            <div style="font-size:1.05rem;font-weight:900;color:var(--accent);margin-top:2px">${Utils.fmt.date(resumo.dataEntregaEstimada) || '—'}</div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;text-align:center;">
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--text3)">Fases Concluídas</div>
            <div style="font-size:1.05rem;font-weight:900;color:var(--success);margin-top:2px">${resumo.concluidos} de ${resumo.totalProcessos} (${resumo.pctGeral}%)</div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;text-align:center;">
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--text3)">Variação de Prazo</div>
            <div style="font-size:1.05rem;font-weight:900;color:${corStatus};margin-top:2px">
              ${resumo.diasAtrasoAcumulado > 0 ? `+${resumo.diasAtrasoAcumulado} dias` : '0 dias (no prazo)'}
            </div>
          </div>
        </div>

        <div class="progress-bar" style="height:6px;margin-top:14px;">
          <div class="progress-fill ${resumo.pctGeral < 35 ? 'blue' : resumo.pctGeral < 80 ? 'yellow' : 'green'}" style="width:${resumo.pctGeral}%"></div>
        </div>
      </div>

      <!-- LISTA DE ETAPAS / FLUXO EM CASCATA -->
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${processos.map((p, idx) => {
          const isDone = p.status === 'concluido';
          const isInProgress = p.status === 'em_andamento';
          const isPending = p.status === 'pendente';

          const badgeSlaColor = p.status_sla === 'atrasado'
            ? 'var(--danger)'
            : p.status_sla === 'atencao'
              ? '#f59e0b'
              : 'var(--success)';

          const badgeSlaText = p.status_sla === 'atrasado'
            ? `🔴 Atrasado +${p.dias_atraso}d`
            : p.status_sla === 'atencao'
              ? '🟡 Em Atenção'
              : '🟢 No Prazo';

          return `
          <div style="background:var(--surface);border:1px solid ${isInProgress ? 'var(--accent)' : 'var(--border)'};border-radius:var(--r-md);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;transition:border-color .2s;">
            <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:260px;">
              <div style="font-size:1.6rem;width:40px;height:40px;border-radius:50%;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;border:1px solid var(--border);">
                ${p.icone || '📋'}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span style="font-size:.68rem;font-weight:800;background:var(--bg-secondary);border:1px solid var(--border);padding:1px 6px;border-radius:4px;color:var(--text3);">${e(p.codigo || `#${idx+1}`)}</span>
                  <strong style="font-size:.92rem;color:var(--text);">${e(p.nome)}</strong>
                  <span style="font-size:.68rem;background:rgba(201,162,39,.1);color:var(--accent);padding:1px 8px;border-radius:10px;font-weight:700;">⏱️ SLA ${p.dias_sla} dias</span>
                  <span style="font-size:.68rem;color:${badgeSlaColor};font-weight:800;background:${badgeSlaColor}15;padding:1px 8px;border-radius:10px;">${badgeSlaText}</span>
                </div>
                <div style="font-size:.75rem;color:var(--text3);margin-top:4px;display:flex;gap:16px;flex-wrap:wrap;">
                  <span>📅 Início: <strong>${Utils.fmt.date(p.data_inicio_real || p.data_inicio_prevista)}</strong></span>
                  <span>🏁 Término Previsto: <strong>${Utils.fmt.date(p.data_fim_prevista)}</strong></span>
                  ${p.data_fim_real ? `<span>✅ Concluído em: <strong>${Utils.fmt.date(p.data_fim_real)}</strong></span>` : ''}
                </div>
                ${p.observacoes ? `<div style="font-size:.72rem;color:var(--text2);margin-top:4px;font-style:italic;">📝 ${e(p.observacoes)}</div>` : ''}
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:10px;">
              <span class="badge" style="background:${isDone ? 'rgba(16,185,129,.15)' : isInProgress ? 'rgba(59,130,246,.15)' : 'var(--bg-secondary)'};color:${isDone ? 'var(--success)' : isInProgress ? '#3b82f6' : 'var(--text3)'};font-size:.74rem;font-weight:700;padding:4px 10px;">
                ${isDone ? '✓ Concluído' : isInProgress ? '🔄 Em Andamento' : '⏳ Pendente'}
              </span>

              ${!somenteLeitura ? `
                <button class="btn btn-secondary btn-sm" style="font-size:.75rem;padding:4px 10px;" data-fb-click="CronogramaSLA.abrirModalApontamento" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(obraId))}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(p.id))}">
                  ✏️ Apontar
                </button>
              ` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  // ── MODAL DE APONTAMENTO DE STATUS DA ETAPA ──
  abrirModalApontamento(obraId, processoId) {
    const processos = this.getObraProcessos(obraId);
    const p = processos.find(item => item.id === processoId);
    if (!p) return;
    const e = Utils.escapeHtml.bind(Utils);

    Utils.showModal(`
      <div class="modal" style="max-width:540px;">
        <div class="modal-header">
          <span class="modal-title">✏️ Apontamento de Fase: ${e(p.nome)}</span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body">
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 14px;margin-bottom:16px;font-size:.82rem;">
            <div><strong>Código:</strong> ${e(p.codigo)} &middot; <strong>SLA Configurado:</strong> ${p.dias_sla} dias</div>
            <div style="color:var(--text3);margin-top:2px;">Previsão Calculada: ${Utils.fmt.date(p.data_inicio_prevista)} até ${Utils.fmt.date(p.data_fim_prevista)}</div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Status da Fase *</label>
            <select class="form-control" id="sla-status-sel">
              <option value="pendente" ${p.status === 'pendente' ? 'selected' : ''}>⏳ Pendente / Não iniciada</option>
              <option value="em_andamento" ${p.status === 'em_andamento' ? 'selected' : ''}>🔄 Em Andamento</option>
              <option value="concluido" ${p.status === 'concluido' ? 'selected' : ''}>✅ Concluída</option>
            </select>
          </div>

          <div class="form-row cols-2" style="margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label">Data Início Real</label>
              <input type="date" class="form-control" id="sla-data-ini" value="${e(p.data_inicio_real || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">Data Término Real</label>
              <input type="date" class="form-control" id="sla-data-fim" value="${e(p.data_fim_real || '')}">
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Ajuste de SLA desta Etapa (dias)</label>
            <input type="number" min="1" max="365" class="form-control" id="sla-dias-val" value="${p.dias_sla}">
            <span style="font-size:.72rem;color:var(--text3);margin-top:2px;display:block">
              Ao alterar os dias ou registrar atraso, o sistema recalcula em cascata todo o cronograma.
            </span>
          </div>

          <div class="form-group">
            <label class="form-label">Observações de Campo / Justificativa</label>
            <textarea class="form-control" id="sla-obs-val" rows="2" placeholder="Ex: Atraso na análise pela prefeitura">${e(p.observacoes || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button class="btn btn-primary" data-fb-click="CronogramaSLA.salvarApontamento" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(obraId))}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(processoId))}">
            ✔ Salvar &amp; Recalcular Cascata
          </button>
        </div>
      </div>`);
  },

  salvarApontamento(obraId, processoId) {
    const processos = this.getObraProcessos(obraId);
    const p = processos.find(item => item.id === processoId);
    if (!p) return;

    const statusSel = document.getElementById('sla-status-sel');
    const dataIniInput = document.getElementById('sla-data-ini');
    const dataFimInput = document.getElementById('sla-data-fim');
    const diasInput = document.getElementById('sla-dias-val');
    const obsInput = document.getElementById('sla-obs-val');

    p.status = statusSel ? statusSel.value : p.status;
    p.data_inicio_real = dataIniInput ? dataIniInput.value : p.data_inicio_real;
    p.data_fim_real = dataFimInput ? dataFimInput.value : p.data_fim_real;
    p.dias_sla = diasInput ? (parseInt(diasInput.value, 10) || p.dias_sla) : p.dias_sla;
    p.observacoes = obsInput ? obsInput.value.trim() : p.observacoes;

    if (p.status === 'concluido' && !p.data_fim_real) {
      p.data_fim_real = Utils.today();
    }

    this.salvarProcessosObra(obraId, processos);
    Utils.closeModal();
    Utils.toast('Cronograma recalculado em cascata!', 'success');

    // Atualiza a visualização se estiver na Central da Obra ou no App
    if (typeof ObraDetalhe !== 'undefined' && ObraDetalhe.activeTab === 'slas') {
      ObraDetalhe.setTab('slas');
    }
    if (typeof Clientes !== 'undefined' && App.route === 'obras') {
      App.navigate('obras');
    }
  },

  // ── MODAL DE CONFIGURAÇÃO DE SLAS DA OBRA ──
  abrirModalConfigObra(obraId) {
    const processos = this.getObraProcessos(obraId);
    const e = Utils.escapeHtml.bind(Utils);

    Utils.showModal(`
      <div class="modal modal-lg" style="max-width:760px;">
        <div class="modal-header">
          <span class="modal-title">⚙️ Configurar SLAs da Obra</span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button>
        </div>
        <div class="modal-body" style="max-height:calc(80vh - 120px);overflow-y:auto;">
          <p style="font-size:.8rem;color:var(--text3);margin-bottom:14px;">
            Ajuste os dias de SLA previstos para cada etapa desta obra. A cascata calculará as datas finais automaticamente.
          </p>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width:15%">Código</th>
                  <th style="width:50%">Processo / Etapa</th>
                  <th style="width:20%">Tipo</th>
                  <th style="width:15%;text-align:right">SLA (Dias)</th>
                </tr>
              </thead>
              <tbody>
                ${processos.map((p, i) => `
                  <tr>
                    <td><strong>${e(p.codigo)}</strong></td>
                    <td>${e(p.nome)}</td>
                    <td><span style="font-size:.72rem;color:var(--text3)">${e(p.tipoLabel || p.tipo)}</span></td>
                    <td style="text-align:right">
                      <input type="number" min="1" max="365" class="form-control form-control-sm cfg-sla-input" data-proc-id="${e(p.id)}" value="${p.dias_sla}" style="width:80px;display:inline-block;text-align:center;">
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button class="btn btn-primary" data-fb-click="CronogramaSLA.salvarConfigObraSubmit" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(obraId))}">
            ✔ Salvar e Recalcular
          </button>
        </div>
      </div>`);
  },

  salvarConfigObraSubmit(obraId) {
    const inputs = document.querySelectorAll('.cfg-sla-input');
    const processos = this.getObraProcessos(obraId);

    inputs.forEach(inp => {
      const pId = inp.dataset.procId;
      const val = parseInt(inp.value, 10);
      const target = processos.find(p => p.id === pId);
      if (target && val > 0) {
        target.dias_sla = val;
      }
    });

    this.salvarProcessosObra(obraId, processos);
    Utils.closeModal();
    Utils.toast('Prazos de SLA atualizados e recalculados!', 'success');

    if (typeof ObraDetalhe !== 'undefined' && ObraDetalhe.activeTab === 'slas') {
      ObraDetalhe.setTab('slas');
    }
  },

  // ── HELPERS DE DATA ──
  _somarDias(dataStr, dias) {
    if (!dataStr) return Utils.today();
    const d = new Date(dataStr + 'T12:00:00');
    if (isNaN(d.getTime())) return Utils.today();
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  },

  _diffDias(dataFimStr, dataIniStr) {
    if (!dataFimStr || !dataIniStr) return 0;
    const dFim = new Date(dataFimStr + 'T12:00:00');
    const dIni = new Date(dataIniStr + 'T12:00:00');
    if (isNaN(dFim.getTime()) || isNaN(dIni.getTime())) return 0;
    return Math.round((dFim - dIni) / (1000 * 60 * 60 * 24));
  }
};

window.CronogramaSLA = CronogramaSLA;
