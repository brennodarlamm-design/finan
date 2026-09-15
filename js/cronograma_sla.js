// js/cronograma_sla.js — Gestão de Prazos & SLAs · Patch 52: Templates, Cargos, Checklist, Motivo de Atraso
// Suporta: Obra Particular · Casa Caixa · Reforma · Projeto Arquitetônico + tipos customizados

const CronogramaSLA = {
  _KEY_SLAS_PADRAO:   'finobra_slas_padrao',
  _KEY_CARGOS:        'finobra_workflow_cargos',
  _KEY_TEMPLATES:     'finobra_workflow_templates',

  // ── TEMPLATES DE WORKFLOW PADRÃO (Patch 52) ──────────────────────────────
  // Cada template mapeia a uma modalidade de obra. cargo_responsavel é a chave
  // do cargo (não o nome do usuário), resolvida em tempo de execução via getCargos().
  TEMPLATES_PADRAO: {
    obra_particular: {
      nome: 'Obra Particular / Recursos Próprios',
      icone: '💼',
      builtin: true,
      processos: [
        { id:'proc_estudo_preliminar',  codigo:'PROJ-01', nome:'Estudo Preliminar & Levantamento', tipo:'projeto', tipoLabel:'Projetos', icone:'📐', dias_sla:30, predecessor_id:null, cargo_responsavel:'arquiteto', checklist:['Briefing assinado pelo cliente','Levantamento topográfico realizado'], descricao:'Levantamento topográfico, sondagem e estudo de necessidades do cliente' },
        { id:'proc_anteprojeto',        codigo:'PROJ-02', nome:'Anteprojeto Arquitetônico',         tipo:'projeto', tipoLabel:'Projetos', icone:'✏️', dias_sla:20, predecessor_id:'proc_estudo_preliminar', cargo_responsavel:'arquiteto', checklist:['Plantas preliminares aprovadas pelo cliente'], descricao:'Plantas preliminares, cortes e modelagem 3D para aprovação do cliente' },
        { id:'proc_projeto_executivo',  codigo:'PROJ-03', nome:'Projeto Arquitetônico Executivo',   tipo:'projeto', tipoLabel:'Projetos', icone:'🏛️', dias_sla:25, predecessor_id:'proc_anteprojeto',        cargo_responsavel:'arquiteto', checklist:['Memorial descritivo elaborado','Plantas cotadas finalizadas'], descricao:'Detalhamento completo de arquitetura, paginações e esquadrias' },
        { id:'proc_projetos_comp',      codigo:'PROJ-04', nome:'Projetos Complementares',           tipo:'projeto', tipoLabel:'Projetos', icone:'⚡', dias_sla:30, predecessor_id:'proc_projeto_executivo', cargo_responsavel:'engenheiro_civil', checklist:['Estrutural calculado','Elétrico e hidro aprovados'], descricao:'Cálculo estrutural, instalações elétricas, hidrossanitárias e lógica' },
        { id:'proc_aprovacao_pref',     codigo:'APROV-01', nome:'Aprovação na Prefeitura & Viabilidade', tipo:'aprovacao', tipoLabel:'Aprovações & Legal', icone:'📜', dias_sla:45, predecessor_id:'proc_projeto_executivo', cargo_responsavel:'arquiteto', checklist:[], descricao:'Protocolo e tramitação do processo de aprovação do projeto legal' },
        { id:'proc_alvara_art',         codigo:'APROV-02', nome:'Alvará de Construção & ART/RRT',   tipo:'aprovacao', tipoLabel:'Aprovações & Legal', icone:'🎓', dias_sla:15, predecessor_id:'proc_aprovacao_pref',    cargo_responsavel:'engenheiro_civil', checklist:['ART/RRT emitida e paga'], descricao:'Emissão formal do alvará de obras e anotações de responsabilidade técnica' },
        { id:'proc_fundacoes',          codigo:'OBRA-01', nome:'Canteiro, Terraplenagem & Fundações', tipo:'obra', tipoLabel:'Execução de Obra', icone:'🏗️', dias_sla:35, predecessor_id:'proc_alvara_art', cargo_responsavel:'engenheiro_civil', checklist:['Canteiro implantado','Sondagem confirmada'], descricao:'Instalação de canteiro, terraplenagem, estacas e blocos de fundação' },
        { id:'proc_estrutura',          codigo:'OBRA-02', nome:'Estrutura & Alvenaria',              tipo:'obra', tipoLabel:'Execução de Obra', icone:'🧱', dias_sla:60, predecessor_id:'proc_fundacoes',         cargo_responsavel:'engenheiro_civil', checklist:[], descricao:'Pilares, vigas, lajes e elevação de paredes de alvenaria' },
        { id:'proc_instalacoes',        codigo:'OBRA-03', nome:'Instalações, Cobertura & Vedações',  tipo:'obra', tipoLabel:'Execução de Obra', icone:'💧', dias_sla:45, predecessor_id:'proc_estrutura',          cargo_responsavel:'tecnico_obra', checklist:[], descricao:'Tubulações hidrossanitárias, fiação elétrica e telhado' },
        { id:'proc_acabamento',         codigo:'OBRA-04', nome:'Revestimentos, Esquadrias & Pintura', tipo:'obra', tipoLabel:'Execução de Obra', icone:'🎨', dias_sla:45, predecessor_id:'proc_instalacoes',         cargo_responsavel:'tecnico_obra', checklist:[], descricao:'Pisos, azulejos, colocação de portas, janelas e pintura interna/externa' },
        { id:'proc_habitese',           codigo:'POS-01', nome:'Vistoria Prefeitura, Habite-se & Limpeza', tipo:'pos_obra', tipoLabel:'Pós-Obra & Entrega', icone:'🧹', dias_sla:30, predecessor_id:'proc_acabamento', cargo_responsavel:'arquiteto', checklist:['Habite-se emitido','Limpeza final realizada'], descricao:'Vistoria final do fiscal, emissão do Habite-se e faxina de entrega' },
        { id:'proc_entrega',            codigo:'POS-02', nome:'Entrega das Chaves & Manual do Proprietário', tipo:'pos_obra', tipoLabel:'Pós-Obra & Entrega', icone:'🔑', dias_sla:15, predecessor_id:'proc_habitese',    cargo_responsavel:'gestor_obras', checklist:['Manual do proprietário entregue','Termo de entrega assinado'], descricao:'Vistoria com o cliente, assinatura do termo de entrega e entrega das chaves' },
      ]
    },
    casa_caixa: {
      nome: 'Casa Caixa (MCMV / SBPE)',
      icone: '🏦',
      builtin: true,
      processos: [
        { id:'cc_documentacao',         codigo:'CEF-01', nome:'Documentação & Habilitação CEF',     tipo:'aprovacao', tipoLabel:'Aprovações & Legal', icone:'📋', dias_sla:20, predecessor_id:null, cargo_responsavel:'administrativo', checklist:['RG/CPF do mutuário','Comprovante de renda','Proposta aprovada pelo banco'], descricao:'Coleta e protocolo de documentação para aprovação do crédito imobiliário' },
        { id:'cc_engenharia_cef',       codigo:'CEF-02', nome:'Engenharia & Laudo CEF',             tipo:'aprovacao', tipoLabel:'Aprovações & Legal', icone:'🏗️', dias_sla:30, predecessor_id:'cc_documentacao',   cargo_responsavel:'engenheiro_civil', checklist:['Memorial descritivo CEF aprovado','Cronograma físico-financeiro entregue'], descricao:'Laudo de avaliação, memorial e projeto protocolado na CEF' },
        { id:'cc_alvara',               codigo:'CEF-03', nome:'Alvará & ART',                       tipo:'aprovacao', tipoLabel:'Aprovações & Legal', icone:'🎓', dias_sla:20, predecessor_id:'cc_engenharia_cef', cargo_responsavel:'engenheiro_civil', checklist:['Alvará de construção emitido','ART/RRT registrada'], descricao:'Alvará de construção e ART/RRT registradas para início da obra' },
        { id:'cc_fundacoes',            codigo:'CEF-04', nome:'Fundações & Infraestrutura',          tipo:'obra', tipoLabel:'Execução de Obra', icone:'⛏️', dias_sla:25, predecessor_id:'cc_alvara',          cargo_responsavel:'engenheiro_civil', checklist:[], descricao:'Movimento de terra e fundações dentro das especificações da CEF' },
        { id:'cc_estrutura',            codigo:'CEF-05', nome:'Estrutura & Alvenaria',               tipo:'obra', tipoLabel:'Execução de Obra', icone:'🧱', dias_sla:40, predecessor_id:'cc_fundacoes',        cargo_responsavel:'engenheiro_civil', checklist:[], descricao:'Concretagem, alvenaria e cobertura aprovadas em vistoria CEF' },
        { id:'cc_instalacoes',          codigo:'CEF-06', nome:'Instalações & Acabamento',            tipo:'obra', tipoLabel:'Execução de Obra', icone:'💡', dias_sla:35, predecessor_id:'cc_estrutura',         cargo_responsavel:'tecnico_obra', checklist:[], descricao:'Instalações prediais, revestimentos e pintura final' },
        { id:'cc_vistoria_cef',         codigo:'CEF-07', nome:'Vistoria Final CEF & Liberação',     tipo:'pos_obra', tipoLabel:'Pós-Obra & Entrega', icone:'🔍', dias_sla:15, predecessor_id:'cc_instalacoes',     cargo_responsavel:'engenheiro_civil', checklist:['Habite-se emitido','Vistoria CEF aprovada'], descricao:'Vistoria do engenheiro CEF e liberação do FGTS/financiamento' },
        { id:'cc_entrega_chaves',       codigo:'CEF-08', nome:'Entrega de Chaves',                   tipo:'pos_obra', tipoLabel:'Pós-Obra & Entrega', icone:'🔑', dias_sla:10, predecessor_id:'cc_vistoria_cef',   cargo_responsavel:'gestor_obras', checklist:['Registro de imóvel atualizado','Termo de entrega assinado'], descricao:'Entrega formal das chaves ao mutuário, registro e quitação' },
      ]
    },
    reforma: {
      nome: 'Reforma / Retrofit',
      icone: '🔨',
      builtin: true,
      processos: [
        { id:'ref_levantamento',        codigo:'REF-01', nome:'Levantamento & Diagnóstico',          tipo:'projeto', tipoLabel:'Projetos', icone:'📐', dias_sla:7,  predecessor_id:null, cargo_responsavel:'arquiteto', checklist:['Visita técnica realizada','Registro fotográfico feito'], descricao:'Levantamento dimensional e diagnóstico das patologias existentes' },
        { id:'ref_projeto',             codigo:'REF-02', nome:'Projeto de Reforma',                  tipo:'projeto', tipoLabel:'Projetos', icone:'✏️', dias_sla:10, predecessor_id:'ref_levantamento',   cargo_responsavel:'arquiteto', checklist:['Projeto aprovado pelo cliente'], descricao:'Plantas, perspectivas e especificações técnicas da reforma' },
        { id:'ref_orcamento',           codigo:'REF-03', nome:'Orçamento & Contrato',                tipo:'projeto', tipoLabel:'Projetos', icone:'💰', dias_sla:5,  predecessor_id:'ref_projeto',         cargo_responsavel:'orcamentista', checklist:['Orçamento aprovado','Contrato assinado'], descricao:'Planilha de custos detalhada e assinatura do contrato' },
        { id:'ref_execucao',            codigo:'REF-04', nome:'Execução da Reforma',                 tipo:'obra', tipoLabel:'Execução de Obra', icone:'🏗️', dias_sla:30, predecessor_id:'ref_orcamento',       cargo_responsavel:'tecnico_obra', checklist:[], descricao:'Execução de demolições, alvenaria, instalações e revestimentos' },
        { id:'ref_entrega',             codigo:'REF-05', nome:'Limpeza & Entrega Final',             tipo:'pos_obra', tipoLabel:'Pós-Obra & Entrega', icone:'✅', dias_sla:5, predecessor_id:'ref_execucao',     cargo_responsavel:'gestor_obras', checklist:['Vistoria final feita','Termo de entrega assinado'], descricao:'Limpeza especializada e vistoria final com o cliente' },
      ]
    },
    projeto_arq: {
      nome: 'Projeto Arquitetônico',
      icone: '📐',
      builtin: true,
      processos: [
        { id:'pa_estudo',               codigo:'PA-01', nome:'Estudo Preliminar',                    tipo:'projeto', tipoLabel:'Projetos', icone:'📐', dias_sla:15, predecessor_id:null, cargo_responsavel:'arquiteto', checklist:['Briefing formalizado','Programa de necessidades definido'], descricao:'Conceito, partido arquitetônico e croquis iniciais' },
        { id:'pa_anteprojeto',          codigo:'PA-02', nome:'Anteprojeto',                          tipo:'projeto', tipoLabel:'Projetos', icone:'✏️', dias_sla:20, predecessor_id:'pa_estudo',            cargo_responsavel:'arquiteto', checklist:['Aprovação do cliente no anteprojeto'], descricao:'Plantas, cortes, fachadas e modelo 3D' },
        { id:'pa_executivo',            codigo:'PA-03', nome:'Projeto Executivo Completo',           tipo:'projeto', tipoLabel:'Projetos', icone:'🏛️', dias_sla:25, predecessor_id:'pa_anteprojeto',       cargo_responsavel:'projetista', checklist:['Detalhamento completo finalizado'], descricao:'Projeto legal e executivo com todos os detalhamentos' },
        { id:'pa_complementares',       codigo:'PA-04', nome:'Projetos Complementares',              tipo:'projeto', tipoLabel:'Projetos', icone:'⚡', dias_sla:20, predecessor_id:'pa_executivo',         cargo_responsavel:'engenheiro_civil', checklist:['Estrutural entregue','Instalações entregues'], descricao:'Elétrico, hidrossanitário, estrutural e demais especialidades' },
        { id:'pa_aprovacao',            codigo:'PA-05', nome:'Aprovação Legal',                      tipo:'aprovacao', tipoLabel:'Aprovações & Legal', icone:'📜', dias_sla:30, predecessor_id:'pa_complementares', cargo_responsavel:'arquiteto', checklist:['Processo protocolado na Prefeitura'], descricao:'Protocolo e aprovação do projeto junto à Prefeitura' },
        { id:'pa_entrega',              codigo:'PA-06', nome:'Entrega Final do Projeto',             tipo:'pos_obra', tipoLabel:'Pós-Obra & Entrega', icone:'📦', dias_sla:5, predecessor_id:'pa_aprovacao',    cargo_responsavel:'arquiteto', checklist:['Arquivos DWG e PDF entregues','ART/RRT assinada'], descricao:'Entrega do projeto completo em formato digital e impresso' },
      ]
    },
  },

  // ── CATÁLOGO PADRÃO (compatibilidade Patch 51) ───────────────────────────
  // Aponta para os processos do template obra_particular por retrocompatibilidade.
  get PADRAO_PROCESSOS() { return this.TEMPLATES_PADRAO.obra_particular.processos; },


  // ── CARGOS / FUNÇÕES DA EMPRESA (Patch 52) ──────────────────────────────
  // Cargos padrão — substituem referências a nomes de usuários hardcoded.
  CARGOS_PADRAO: [
    { id:'arquiteto',       nome:'Arquiteto',              icone:'🏙️', cor:'#6366f1', usuario_id:null, usuario_nome:'' },
    { id:'engenheiro_civil',nome:'Engenheiro Civil',        icone:'🏗️', cor:'#f59e0b', usuario_id:null, usuario_nome:'' },
    { id:'projetista',      nome:'Projetista',              icone:'✏️',     cor:'#8b5cf6', usuario_id:null, usuario_nome:'' },
    { id:'orcamentista',    nome:'Orçamentista',           icone:'💰',     cor:'#10b981', usuario_id:null, usuario_nome:'' },
    { id:'tecnico_obra',    nome:'Técnico de Obra',        icone:'⛏️',     cor:'#f97316', usuario_id:null, usuario_nome:'' },
    { id:'financeiro',      nome:'Financeiro',              icone:'📊',     cor:'#22c55e', usuario_id:null, usuario_nome:'' },
    { id:'administrativo',  nome:'Administrativo',          icone:'🗂️',     cor:'#64748b', usuario_id:null, usuario_nome:'' },
    { id:'gestor_obras',    nome:'Gestor de Obras',         icone:'🏢',     cor:'#c9a227', usuario_id:null, usuario_nome:'' },
  ],

  getCargos() {
    try {
      const k = (typeof DB !== 'undefined' && DB._ck) ? DB._ck(this._KEY_CARGOS) : this._KEY_CARGOS;
      const raw = localStorage.getItem(k);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; }
    } catch (e) { console.warn('[CronogramaSLA] getCargos:', e); }
    return JSON.parse(JSON.stringify(this.CARGOS_PADRAO));
  },

  saveCargos(cargos) {
    if (!Array.isArray(cargos)) return false;
    try {
      const k = (typeof DB !== 'undefined' && DB._ck) ? DB._ck(this._KEY_CARGOS) : this._KEY_CARGOS;
      localStorage.setItem(k, JSON.stringify(cargos));
      if (typeof DB !== 'undefined' && DB.syncToCloud) DB.syncToCloud('save', 'preferencias', { preferences: { workflow_cargos: cargos } });
      return true;
    } catch (e) { console.error('[CronogramaSLA] saveCargos:', e); return false; }
  },

  // Resolve cargo_responsavel da etapa -> { id, nome, cargo, icone } ou null
  getResponsavelEtapa(processo) {
    if (!processo) return null;
    // Override explícito de usuário (substituição temporária)
    if (processo.responsavel_usuario_id) {
      const users = (typeof Auth !== 'undefined' && Auth.getUsers) ? Auth.getUsers() : [];
      const u = users.find(x => x.id === processo.responsavel_usuario_id);
      if (u) return { id: u.id, nome: u.nome, cargo: processo.cargo_responsavel || '', icone: '👤' };
    }
    // Resolve pelo cargo
    if (processo.cargo_responsavel) {
      const cargos = this.getCargos();
      const cargo = cargos.find(c => c.id === processo.cargo_responsavel);
      if (cargo && cargo.usuario_id) {
        const users = (typeof Auth !== 'undefined' && Auth.getUsers) ? Auth.getUsers() : [];
        const u = users.find(x => x.id === cargo.usuario_id);
        return { id: cargo.usuario_id, nome: u?.nome || cargo.usuario_nome || cargo.nome, cargo: cargo.nome, icone: cargo.icone || '👤' };
      }
      if (cargo) return { id: null, nome: cargo.nome, cargo: cargo.nome, icone: cargo.icone || '👤' };
    }
    return null;
  },

  // Retorna todas as demandas ativas de um usuário em todas as obras
  getDemandas(usuarioId) {
    if (!usuarioId || typeof DB === 'undefined') return [];
    const obras = DB.getAll('clientes').filter(o => !['concluida', 'concluido', 'concluída', 'cancelada', 'cancelado', 'sistema'].includes(String(o.status || '').toLowerCase()));
    const demandas = [];

    for (const obra of obras) {
      const processos = this.getObraProcessos(obra.id);
      for (const proc of processos) {
        if (proc.status === 'concluido') continue;
        const resp = this.getResponsavelEtapa(proc);
        if (resp && resp.id === usuarioId) {
          demandas.push({
            ...proc,
            obra_id: obra.id,
            obra_nome: obra.nome || 'Obra sem nome',
            responsavel_resolvido: resp
          });
        }
      }
    }
    return demandas;
  },

  // ── TEMPLATES CUSTOMIZADOS (persistência) ──────────────────────────
  getTemplates() {
    try {
      const k = (typeof DB !== 'undefined' && DB._ck) ? DB._ck(this._KEY_TEMPLATES) : this._KEY_TEMPLATES;
      const raw = localStorage.getItem(k);
      if (raw) { const p = JSON.parse(raw); if (p && typeof p === 'object') return { ...this.TEMPLATES_PADRAO, ...p }; }
    } catch (e) { console.warn('[CronogramaSLA] getTemplates:', e); }
    return { ...this.TEMPLATES_PADRAO };
  },

  saveTemplates(templates) {
    if (!templates || typeof templates !== 'object') return false;
    try {
      const k = (typeof DB !== 'undefined' && DB._ck) ? DB._ck(this._KEY_TEMPLATES) : this._KEY_TEMPLATES;
      // Só persiste os templates customizados (não os builtin)
      const custom = Object.fromEntries(Object.entries(templates).filter(([,v]) => !v.builtin));
      localStorage.setItem(k, JSON.stringify(custom));
      if (typeof DB !== 'undefined' && DB.syncToCloud) DB.syncToCloud('save', 'preferencias', { preferences: { workflow_templates: custom } });
      return true;
    } catch (e) { console.error('[CronogramaSLA] saveTemplates:', e); return false; }
  },

  // Retorna a chave de template adequada para uma obra
  _templateKeyForObra(obra) {
    if (!obra) return 'obra_particular';
    if (obra.tipo_workflow) return obra.tipo_workflow;
    const modalMap = { caixa:'casa_caixa', reforma:'reforma', outros_bancos:'obra_particular', particular:'obra_particular', administracao:'obra_particular', empreitada:'obra_particular' };
    return modalMap[obra.modalidade_obra] || 'obra_particular';
  },

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
        DB.syncToCloud('save', 'preferencias', { preferences: { slas_padrao: novosSlas } });
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
    const salvos = obra.cronograma_config?.processos_sla || obra.processos_sla;
    if (Array.isArray(salvos) && salvos.length) {
      return this.calcularCascata(salvos, obra.data_inicio);
    }

    // Patch 52: resolve template pelo tipo/modalidade da obra
    const tmplKey = this._templateKeyForObra(obra);
    const templates = this.getTemplates();
    const tmpl = templates[tmplKey] || templates.obra_particular;
    const padrao = tmpl ? tmpl.processos : this.getSlasEmpresa();

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
      // Patch 52 — campos de workflow
      cargo_responsavel: p.cargo_responsavel || null,
      checklist: Array.isArray(p.checklist) ? [...p.checklist] : [],
      checklist_status: {},
      responsavel_usuario_id: null,
      motivo_atraso: null,
      motivo_atraso_detalhe: '',
      status: 'pendente',
      data_inicio_real: '',
      data_fim_real: '',
      percentual: 0,
      observacoes: '',
    }));

    return this.calcularCascata(processos, obra.data_inicio);
  },

  salvarProcessosObra(obraId, processos) {
    if (!obraId || !Array.isArray(processos)) return false;
    const recalculados = this.calcularCascata(processos, DB.getById('clientes', obraId)?.data_inicio);
    
    // Atualiza a obra com os processos e a nova data prevista de término
    const ultimaEtapa = recalculados[recalculados.length - 1];
    const updates = {
      processos_sla: recalculados,
      cronograma_config: { ...(DB.getById('clientes', obraId)?.cronograma_config || {}), processos_sla: recalculados }
    };
    if (ultimaEtapa && ultimaEtapa.data_fim_prevista) {
      updates.data_previsao_termino = ultimaEtapa.data_fim_prevista;
      updates.data_previsao = ultimaEtapa.data_fim_prevista;
    }

    return !!DB.update('clientes', obraId, updates);
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

      // ── SLA EVOLUTIVO (Patch 52) ──
      // Dias já executados (desde data de início até hoje ou até conclusão)
      if (p.status === 'concluido' && p.data_inicio_real && p.data_fim_real) {
        p.dias_executados = Math.max(0, this._diffDias(p.data_fim_real, p.data_inicio_real));
        p.dias_restantes = 0;
      } else if (p.status === 'em_andamento') {
        const inicioEfetivo = p.data_inicio_real || p.data_inicio_prevista;
        p.dias_executados = Math.max(0, this._diffDias(hoje, inicioEfetivo));
        p.dias_restantes = Math.max(0, this._diffDias(p.data_fim_prevista, hoje));
      } else {
        p.dias_executados = 0;
        p.dias_restantes = diasSla;
      }

      // Resolve responsável para exibição
      p.responsavel_resolvido = this.getResponsavelEtapa(p);

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

  // ── MODAL DE APONTAMENTO DE STATUS DA ETAPA (Patch 52) ──
  abrirModalApontamento(obraId, processoId) {
    const processos = this.getObraProcessos(obraId);
    const p = processos.find(item => item.id === processoId);
    if (!p) return;
    const e = Utils.escapeHtml.bind(Utils);
    const cargos = this.getCargos();
    const respResolvido = this.getResponsavelEtapa(p);

    // Checklist HTML
    const checklistHtml = Array.isArray(p.checklist) && p.checklist.length > 0
      ? `<div id="sla-checklist-wrap" style="background:rgba(201,162,39,.06);border:1px solid rgba(201,162,39,.25);border-radius:var(--r-md);padding:12px;margin-bottom:14px;">
          <div style="font-weight:700;font-size:.8rem;color:var(--accent2);margin-bottom:8px;">✅ Checklist de Conclusão</div>
          <div style="font-size:.78rem;color:var(--text3);margin-bottom:8px;">Todos os itens devem ser marcados para concluir esta etapa.</div>
          ${p.checklist.map(item => {
            const done = p.checklist_status?.[item] === true;
            return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 0;">
              <input type="checkbox" class="sla-checklist-item" data-item="${e(item)}" ${done ? 'checked' : ''} style="transform:scale(1.15);">
              <span style="${done ? 'text-decoration:line-through;color:var(--text3);' : ''} font-size:.82rem;">${e(item)}</span>
            </label>`;
          }).join('')}
        </div>`
      : '';

    // Motivo de atraso HTML (só aparece se já está atrasado)
    const isAtrasado = p.status_sla === 'atrasado';
    const motivoHtml = `<div id="sla-motivo-wrap" style="${isAtrasado ? '' : 'display:none;'}">
      <div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.3);border-radius:var(--r-md);padding:12px;margin-bottom:14px;">
        <div style="font-weight:700;font-size:.8rem;color:var(--danger);margin-bottom:8px;">🔴 Motivo do Atraso (Obrigatório)</div>
        <select class="form-control" id="sla-motivo-sel" style="margin-bottom:8px;">
          <option value="">Selecione o motivo...</option>
          <option value="cliente" ${p.motivo_atraso==='cliente' ? 'selected' : ''}>👤 Aguardando cliente</option>
          <option value="orgao_publico" ${p.motivo_atraso==='orgao_publico' ? 'selected' : ''}>🏛️ Órgão público / Prefeitura</option>
          <option value="fornecedor" ${p.motivo_atraso==='fornecedor' ? 'selected' : ''}>🚛 Fornecedor / Material</option>
          <option value="interno" ${p.motivo_atraso==='interno' ? 'selected' : ''}>👥 Capacidade interna da equipe</option>
          <option value="documentacao" ${p.motivo_atraso==='documentacao' ? 'selected' : ''}>📄 Documentação pendente</option>
          <option value="outro" ${p.motivo_atraso==='outro' ? 'selected' : ''}>💬 Outro</option>
        </select>
        <input type="text" class="form-control" id="sla-motivo-detalhe" placeholder="Detalhe o motivo..." value="${e(p.motivo_atraso_detalhe || '')}" style="font-size:.8rem;">
      </div>
    </div>`;

    // Resp. por cargo
    const cargoOptions = cargos.map(c => `<option value="${e(c.id)}" ${p.cargo_responsavel===c.id?'selected':''}>${e(c.icone)} ${e(c.nome)}${c.usuario_nome ? ' (→ ' + e(c.usuario_nome) + ')' : ''}</option>`).join('');

    // SLA evolutivo info bar
    const slaInfoBar = (p.status === 'em_andamento' || p.status === 'concluido') ? `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:.65rem;color:var(--text3);text-transform:uppercase;font-weight:700;">Executado</div>
          <div style="font-size:1rem;font-weight:900;color:var(--text);">${p.dias_executados ?? 0}d</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:.65rem;color:var(--text3);text-transform:uppercase;font-weight:700;">Restante</div>
          <div style="font-size:1rem;font-weight:900;color:${isAtrasado ? 'var(--danger)' : 'var(--success)'}">${isAtrasado ? '+' + (p.dias_atraso || 0) + 'd atraso' : (p.dias_restantes ?? p.dias_sla) + 'd'}</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:.65rem;color:var(--text3);text-transform:uppercase;font-weight:700;">Situação</div>
          <div style="font-size:.85rem;font-weight:800;">${isAtrasado ? '🔴 Atrasado' : p.status_sla === 'atencao' ? '🟡 Atenção' : '🟢 No prazo'}</div>
        </div>
      </div>` : '';

    Utils.showModal(`
      <div class="modal" style="max-width:560px;">
        <div class="modal-header">
          <span class="modal-title">${e(p.icone || '📋')} ${e(p.nome)}</span>
          <button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">&#x2715;</button>
        </div>
        <div class="modal-body" style="max-height:calc(80vh - 130px);overflow-y:auto;">
          <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 14px;margin-bottom:14px;font-size:.82rem;">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
              <span><strong>${e(p.codigo)}</strong> &middot; SLA: ${p.dias_sla} dias</span>
              ${respResolvido ? `<span style="color:var(--accent2);font-weight:700;">${e(respResolvido.icone)} ${e(respResolvido.nome)} <span style="color:var(--text3);font-weight:400;">(${e(respResolvido.cargo)})</span></span>` : ''}
            </div>
            <div style="color:var(--text3);margin-top:2px;">Início: <strong>${Utils.fmt.date(p.data_inicio_prevista)}</strong> &rarr; Prazo: <strong>${Utils.fmt.date(p.data_fim_prevista)}</strong></div>
          </div>

          ${slaInfoBar}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label">Status da Fase *</label>
              <select class="form-control" id="sla-status-sel">
                <option value="pendente" ${p.status==='pendente'?'selected':''}>&#x23F3; Pendente</option>
                <option value="em_andamento" ${p.status==='em_andamento'?'selected':''}>&#x1F504; Em Andamento</option>
                <option value="concluido" ${p.status==='concluido'?'selected':''}>&#x2705; Concluída</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Cargo Responsável</label>
              <select class="form-control" id="sla-cargo-sel">
                <option value="">-- Nenhum --</option>
                ${cargoOptions}
              </select>
            </div>
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
            <label class="form-label">SLA desta Etapa (dias)</label>
            <input type="number" min="1" max="365" class="form-control" id="sla-dias-val" value="${p.dias_sla}">
            <span style="font-size:.72rem;color:var(--text3);margin-top:2px;display:block">Alterar recalcula todo o cronograma em cascata.</span>
          </div>

          ${checklistHtml}
          ${motivoHtml}

          <div class="form-group">
            <label class="form-label">Observações de Campo / Justificativa</label>
            <textarea class="form-control" id="sla-obs-val" rows="2" placeholder="Ex: Atraso na análise pela prefeitura">${e(p.observacoes || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Cancelar</button>
          <button class="btn btn-primary" id="sla-salvar-btn" data-fb-click="CronogramaSLA.salvarApontamento" data-fb-click-n="2" data-fb-click-t0="string" data-fb-click-v0="${encodeURIComponent(String(obraId))}" data-fb-click-t1="string" data-fb-click-v1="${encodeURIComponent(String(processoId))}">
            &#x2714; Salvar &amp; Recalcular Cascata
          </button>
        </div>
      `);

    // Bind status change and checklist toggle
    const statusEl = document.getElementById('sla-status-sel');
    if (statusEl) {
      statusEl.addEventListener('change', () => CronogramaSLA._onStatusChange(statusEl));
      this._onStatusChange(statusEl);
    }
    document.querySelectorAll('.sla-checklist-item').forEach(cb => {
      cb.addEventListener('change', () => CronogramaSLA._updateChecklistBtn());
    });
    this._updateChecklistBtn();
  },

  // Mostra/oculta motivo de atraso quando status muda
  _onStatusChange(sel) {
    if (!sel) return;
    const motivoWrap = document.getElementById('sla-motivo-wrap');
    if (motivoWrap) motivoWrap.style.display = sel.value !== 'pendente' ? 'block' : 'none';
  },

  // Desabilita botão se checklist não concluído
  _updateChecklistBtn() {
    const btn = document.getElementById('sla-salvar-btn');
    const statusSel = document.getElementById('sla-status-sel');
    if (!btn || !statusSel) return;
    if (statusSel.value !== 'concluido') { btn.disabled = false; btn.title = ''; return; }
    const items = document.querySelectorAll('.sla-checklist-item');
    const allChecked = items.length === 0 || [...items].every(cb => cb.checked);
    btn.disabled = !allChecked;
    btn.title = allChecked ? '' : 'Marque todos os itens do checklist para concluir';
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
    const cargoSel = document.getElementById('sla-cargo-sel');
    const motivoSel = document.getElementById('sla-motivo-sel');
    const motivoDetalhe = document.getElementById('sla-motivo-detalhe');

    const newStatus = statusSel ? statusSel.value : p.status;

    // Valida motivo de atraso quando está atrasado
    if (newStatus === 'em_andamento' && p.status_sla === 'atrasado') {
      if (motivoSel && !motivoSel.value) {
        Utils.toast('Informe o motivo do atraso para salvar.', 'warning');
        motivoSel.focus(); return;
      }
    }

    // Valida checklist
    const checkItems = document.querySelectorAll('.sla-checklist-item');
    if (newStatus === 'concluido' && checkItems.length > 0) {
      const allChecked = [...checkItems].every(cb => cb.checked);
      if (!allChecked) { Utils.toast('Marque todos os itens do checklist para concluir.', 'warning'); return; }
    }

    // Salva estado do checklist
    const newChecklistStatus = {};
    checkItems.forEach(cb => { newChecklistStatus[cb.dataset.item] = cb.checked; });

    p.status = newStatus;
    p.data_inicio_real = dataIniInput ? dataIniInput.value : p.data_inicio_real;
    p.data_fim_real = dataFimInput ? dataFimInput.value : p.data_fim_real;
    p.dias_sla = diasInput ? (parseInt(diasInput.value, 10) || p.dias_sla) : p.dias_sla;
    p.observacoes = obsInput ? obsInput.value.trim() : p.observacoes;
    p.cargo_responsavel = cargoSel ? (cargoSel.value || p.cargo_responsavel) : p.cargo_responsavel;
    p.motivo_atraso = motivoSel ? (motivoSel.value || p.motivo_atraso) : p.motivo_atraso;
    p.motivo_atraso_detalhe = motivoDetalhe ? motivoDetalhe.value.trim() : p.motivo_atraso_detalhe;
    if (Object.keys(newChecklistStatus).length) p.checklist_status = newChecklistStatus;

    if (p.status === 'concluido' && !p.data_fim_real) {
      p.data_fim_real = Utils.today();
    }

    if (!this.salvarProcessosObra(obraId, processos)) return Utils.toast('Não foi possível salvar os SLAs desta obra.', 'error');
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

    if (!this.salvarProcessosObra(obraId, processos)) return Utils.toast('Não foi possível salvar os SLAs desta obra.', 'error');
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
