// js/data.js — Data Layer with LocalStorage + Multi-Tenant Scoping & Demo Data

const DB = {
  K: {
    clientes: 'finobra_clientes', lancamentos: 'finobra_lancamentos',
    notas: 'finobra_notas', orcamentos: 'finobra_orcamentos',
    medicoes: 'finobra_medicoes', ofximports: 'finobra_ofximports',
    contas: 'finobra_contas', precompras: 'finobra_precompras',
    fornecedores: 'finobra_fornecedores'
  },

  _t() {
    return (typeof Auth !== 'undefined' && Auth.getCurrentTenantId) ? Auth.getCurrentTenantId() : 'angelim';
  },

  _k(key) {
    const t = this._t();
    if (t === 'angelim') {
      return this.K[key] || `finobra_${key}`;
    }
    return `finobra_${t}_${key}`;
  },

  _ck(name) {
    const t = this._t();
    if (t === 'angelim') return name;
    return `${name}_${t}`;
  },

  // ── GESTÃO DA EMPRESA / CONSTRUTORA ──
  getEmpresa() {
    const t = this._t();
    const raw = localStorage.getItem(`finobra_${t}_empresa`);
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') return obj;
      } catch {}
    }

    if (t === 'angelim') {
      return {
        id: 'angelim',
        razao_social: 'Angelim Construtora LTDA',
        nome_fantasia: 'Angelim Construtora',
        cnpj: '12.345.678/0001-90',
        telefone: '(95) 99123-4567',
        whatsapp: '95991234567',
        email: 'contato@angelim.com.br',
        cidade: 'Boa Vista',
        uf: 'RR',
        endereco: 'Av. Principal, 1000 - Centro',
        responsavel: 'Eng. Ricardo Almeida',
        crea_cau: 'CREA-RR 12345/D',
        logo_url: 'img/logo.png',
        configurada: true
      };
    }

    const session = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const nomeEmp = session?.empresaNome || (session?.nome ? session.nome + ' Construtora' : '');
    return {
      id: t,
      razao_social: nomeEmp || '',
      nome_fantasia: nomeEmp || '',
      cnpj: '',
      telefone: '',
      whatsapp: '',
      email: session?.email || '',
      cidade: '',
      uf: '',
      endereco: '',
      responsavel: session?.nome || '',
      crea_cau: '',
      logo_url: '',
      configurada: !!(session?.empresaNome)
    };
  },

  saveEmpresa(empresaData) {
    const t = this._t();
    const current = this.getEmpresa();
    const updated = {
      ...current,
      ...empresaData,
      id: t,
      configurada: true,
      updated_at: new Date().toISOString()
    };
    localStorage.setItem(`finobra_${t}_empresa`, JSON.stringify(updated));
    return updated;
  },

  getAll(key) {
    try {
      return JSON.parse(localStorage.getItem(this._k(key)) || '[]');
    } catch {
      return [];
    }
  },

  save(key, data) {
    const storageKey = this._k(key);
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn(`[Storage] Quota excedida ao salvar ${key}. Liberando espaço no LocalStorage...`);
      this.purgeStorage();
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (e2) {
        console.error(`[Storage] Falha ao persistir ${key} no cache local:`, e2);
      }
    }
  },

  purgeStorage() {
    try {
      // 1. Remove snapshots grandes e caches temporários não essenciais
      const heavyKeys = [
        this._ck('finobra_snapshot_seguranca'),
        this._ck('finobra_backup_temp'),
        'sinapi_itens_cache',
        this._ck('finobra_ofximports_cache')
      ];
      heavyKeys.forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });

      // 2. Remove base64 pesado de documentos no LocalStorage
      const docsKey = this._ck('finobra_documentos');
      const docsRaw = localStorage.getItem(docsKey);
      if (docsRaw) {
        const docs = JSON.parse(docsRaw);
        if (Array.isArray(docs)) {
          const lightDocs = docs.map(d => {
            const { base64_data, base64, ...rest } = d;
            return rest;
          });
          localStorage.setItem(docsKey, JSON.stringify(lightDocs));
        }
      }
    } catch (err) {
      console.warn('[Storage] Erro ao limpar cache pesado:', err);
    }
  },
  getById(key, id) { return this.getAll(key).find(i => i.id === id) || null; },
  add(key, item) {
    const data = this.getAll(key);
    item.id = item.id || this.uuid();
    item.created_at = item.created_at || new Date().toISOString();
    data.push(item);
    this.save(key, data);
    this.syncToCloud('save', key, item);
    return item;
  },
  update(key, id, updates) {
    const data = this.getAll(key);
    const idx = data.findIndex(i => i.id === id);
    if (idx === -1) return null;
    data[idx] = { ...data[idx], ...updates, updated_at: new Date().toISOString() };
    this.save(key, data);
    this.syncToCloud('save', key, data[idx]);
    return data[idx];
  },
  remove(key, id) {
    this.save(key, this.getAll(key).filter(i => i.id !== id));
    this.syncToCloud('delete', key, null, id);
  },
  uuid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 9); },

  cleanAllDatesInStorage() {
    try {
      const lans = this.getAll('lancamentos');
      if (Array.isArray(lans) && lans.length > 0) {
        const cleaned = lans.map(l => ({
          ...l,
          data: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(l.data) || l.data : (l.data ? String(l.data).split('T')[0] : l.data),
          data_vencimento: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(l.data_vencimento) || Utils.cleanDate(l.data) || l.data : (l.data_vencimento ? String(l.data_vencimento).split('T')[0] : l.data),
          data_pagamento: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(l.data_pagamento) || null : (l.data_pagamento ? String(l.data_pagamento).split('T')[0] : null),
          valor: Number(l.valor) || 0
        }));
        this.save('lancamentos', cleaned);
      }

      const notas = this.getAll('notas');
      if (Array.isArray(notas) && notas.length > 0) {
        const cleaned = notas.map(n => {
          const vBruto = Number(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total) || 0;
          const vImp = Number(n.impostos) || 0;
          const vLiq = Number(n.valor_liquido !== undefined ? n.valor_liquido : (vBruto - vImp)) || 0;
          const vTot = Number(n.valor_total !== undefined ? n.valor_total : vBruto) || 0;
          return {
            ...n,
            data_emissao: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(n.data_emissao) || n.data_emissao : (n.data_emissao ? String(n.data_emissao).split('T')[0] : n.data_emissao),
            data_vencimento: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(n.data_vencimento) || null : (n.data_vencimento ? String(n.data_vencimento).split('T')[0] : null),
            data_pagamento: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(n.data_pagamento) || null : (n.data_pagamento ? String(n.data_pagamento).split('T')[0] : null),
            valor_bruto: vBruto,
            impostos: vImp,
            valor_liquido: vLiq,
            valor_total: vTot,
            categoria: n.categoria || 'material',
            tipo: n.tipo || 'entrada',
            chave_nfe: n.chave_nfe || n.chave_acesso || ''
          };
        });
        this.save('notas', cleaned);
      }
    } catch(e) {
      console.warn('Erro ao limpar datas no storage:', e);
    }
  },

  // ── NEON CLOUD SYNC ──
  // Header de autenticação para todas as chamadas da API
  _apiHeaders() {
    const secret = (typeof window !== 'undefined' && window.__API_SECRET) ? window.__API_SECRET : '';
    return secret
      ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }
      : { 'Content-Type': 'application/json' };
  },

  async syncFromCloud() {
    // Apenas o tenant padrão 'angelim' sincroniza com o banco Neon central da Angelim
    if (this._t() !== 'angelim') {
      return true;
    }

    try {
      const res = await fetch('/api/db?table=all', { headers: this._apiHeaders() });
      if (!res.ok) return false;
      const json = await res.json();
      if (!json.success || !json.data) return false;

      const d = json.data;
      if (Array.isArray(d.clientes) && d.clientes.length > 0) {
        this.save('clientes', d.clientes.map(o => ({
          ...o,
          data_inicio: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(o.data_inicio) : (o.data_inicio ? String(o.data_inicio).split('T')[0] : o.data_inicio),
          data_previsao: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(o.data_previsao) : (o.data_previsao ? String(o.data_previsao).split('T')[0] : o.data_previsao)
        })));
      }
      if (Array.isArray(d.fornecedores) && d.fornecedores.length > 0) this.save('fornecedores', d.fornecedores);
      if (Array.isArray(d.lancamentos) && d.lancamentos.length > 0) {
        this.save('lancamentos', d.lancamentos.map(l => ({
          ...l,
          data: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(l.data) || l.data : (l.data ? String(l.data).split('T')[0] : l.data),
          data_vencimento: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(l.data_vencimento) || Utils.cleanDate(l.data) || l.data : (l.data_vencimento ? String(l.data_vencimento).split('T')[0] : l.data),
          data_pagamento: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(l.data_pagamento) || null : (l.data_pagamento ? String(l.data_pagamento).split('T')[0] : null),
          valor: Number(l.valor) || 0
        })));
      }
      if (Array.isArray(d.notas) && d.notas.length > 0) {
        this.save('notas', d.notas.map(n => {
          const vBruto = Number(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total) || 0;
          const vImp = Number(n.impostos) || 0;
          const vLiq = Number(n.valor_liquido !== undefined ? n.valor_liquido : (vBruto - vImp)) || 0;
          const vTot = Number(n.valor_total !== undefined ? n.valor_total : vBruto) || 0;
          return {
            ...n,
            data_emissao: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(n.data_emissao) || n.data_emissao : (n.data_emissao ? String(n.data_emissao).split('T')[0] : n.data_emissao),
            data_vencimento: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(n.data_vencimento) || null : (n.data_vencimento ? String(n.data_vencimento).split('T')[0] : null),
            data_pagamento: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(n.data_pagamento) || null : (n.data_pagamento ? String(n.data_pagamento).split('T')[0] : null),
            valor_bruto: vBruto,
            impostos: vImp,
            valor_liquido: vLiq,
            valor_total: vTot,
            categoria: n.categoria || 'material',
            tipo: n.tipo || 'entrada',
            chave_nfe: n.chave_nfe || n.chave_acesso || ''
          };
        }));
      }
      if (Array.isArray(d.orcamentos) && d.orcamentos.length > 0) this.save('orcamentos', d.orcamentos);
      if (Array.isArray(d.medicoes) && d.medicoes.length > 0) {
        this.save('medicoes', d.medicoes.map(m => ({
          ...m,
          data: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(m.data) || m.data : (m.data ? String(m.data).split('T')[0] : m.data),
          valor_medido: Number(m.valor_medido) || 0
        })));
      }

      console.log('✅ Dados sincronizados com Neon PostgreSQL!');
      return true;
    } catch (e) {
      console.warn('Neon Cloud Sync offline, usando cache local:', e);
      return false;
    }
  },

  syncToCloud(action, table, data, id) {
    // Sincroniza com Neon apenas se for o tenant central da Angelim
    if (this._t() !== 'angelim') return;
    try {
      fetch('/api/db', {
        method: 'POST',
        headers: this._apiHeaders(),
        body: JSON.stringify({ action, table, data, id })
      }).catch(() => {});
    } catch {}
  },

  async syncAllToCloud() {
    if (this._t() !== 'angelim') return { success: true, message: 'Tenant local em operação isolada.' };
    try {
      const payload = {
        clientes: this.getAll('clientes'),
        fornecedores: this.getAll('fornecedores'),
        lancamentos: this.getAll('lancamentos'),
        notas: this.getAll('notas')
      };
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_all', payload })
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Erro ao sincronizar tudo para o Neon:', e);
      return { success: false, error: e.message };
    }
  },

  // ── QUERIES ──
  getLancamentos(obraId, filters = {}) {
    let items = this.getAll('lancamentos').map(l => ({
      ...l,
      data_vencimento: l.data_vencimento || l.data
    }));
    if (obraId && obraId !== 'todas') items = items.filter(l => l.obra_id === obraId);
    if (filters.tipo) items = items.filter(l => l.tipo === filters.tipo);
    if (filters.status) items = items.filter(l => l.status === filters.status);
    if (filters.categoria) items = items.filter(l => l.categoria === filters.categoria);
    if (filters.dataInicio) items = items.filter(l => (l.data_vencimento || l.data) >= filters.dataInicio);
    if (filters.dataFim) items = items.filter(l => (l.data_vencimento || l.data) <= filters.dataFim);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      items = items.filter(l => 
        (l.descricao||'').toLowerCase().includes(s) || 
        (l.fornecedor_beneficiario||'').toLowerCase().includes(s) ||
        (l.conta_bancaria||'').toLowerCase().includes(s)
      );
    }
    return items.sort((a, b) => b.data.localeCompare(a.data));
  },

  getResumo(obraId) {
    const lans = this.getLancamentos(obraId === 'todas' ? null : obraId);
    const rec = lans.filter(l => l.tipo === 'receita' && l.status === 'recebido').reduce((s,l)=>s+l.valor,0);
    const desp = lans.filter(l => l.tipo === 'despesa' && l.status === 'pago').reduce((s,l)=>s+l.valor,0);
    const nfItems = this.getAll('notas').filter(n => (!obraId || obraId === 'todas' || n.obra_id === obraId) && n.status === 'pendente');
    const aPagar = lans.filter(l => l.tipo === 'despesa' && l.status === 'a_pagar');
    const aReceber = lans.filter(l => l.tipo === 'receita' && l.status === 'a_receber');
    return {
      totalReceitas: rec, totalDespesas: desp, saldo: rec - desp,
      nfPendentes: nfItems.length, nfPendentesValor: nfItems.reduce((s,n)=>s+(n.valor_total||n.valor_bruto||0),0),
      aPagar: aPagar.length, aPagarValor: aPagar.reduce((s,l)=>s+l.valor,0),
      aReceber: aReceber.length, aReceberValor: aReceber.reduce((s,l)=>s+l.valor,0)
    };
  },

  // ── PRÉ-COMPRAS QUERIES ──
  getPreCompras(obraId, filters = {}) {
    let items = this.getAll('precompras');
    if (obraId && obraId !== 'todas') items = items.filter(p => p.obra_id === obraId);
    if (filters.status) items = items.filter(p => p.status === filters.status);
    if (filters.prioridade) items = items.filter(p => p.prioridade === filters.prioridade);
    if (filters.categoria) items = items.filter(p => p.categoria === filters.categoria);
    if (filters.dataInicio) items = items.filter(p => p.data_solicitacao >= filters.dataInicio);
    if (filters.dataFim) items = items.filter(p => p.data_solicitacao <= filters.dataFim);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      items = items.filter(p => 
        (p.numero_ordem || '').toLowerCase().includes(s) ||
        (p.descricao || '').toLowerCase().includes(s) ||
        (p.fornecedor_nome || '').toLowerCase().includes(s) ||
        (p.solicitante_nome || '').toLowerCase().includes(s) ||
        (p.itens || []).some(i => (i.descricao || '').toLowerCase().includes(s))
      );
    }
    return items.sort((a, b) => (b.data_solicitacao || b.created_at || '').localeCompare(a.data_solicitacao || a.created_at || ''));
  },

  getPreComprasResumo(obraId) {
    const list = this.getPreCompras(obraId === 'todas' ? null : obraId);
    const pendentes = list.filter(p => p.status === 'pendente_aprovacao');
    const aprovadas = list.filter(p => p.status === 'aprovada');
    const convertidas = list.filter(p => p.status === 'convertida');
    const rejeitadas = list.filter(p => p.status === 'rejeitada');

    return {
      totalQtd: list.length,
      totalValor: list.reduce((s, p) => s + (p.valor_total || 0), 0),
      pendentesQtd: pendentes.length,
      pendentesValor: pendentes.reduce((s, p) => s + (p.valor_total || 0), 0),
      aprovadasQtd: aprovadas.length,
      aprovadasValor: aprovadas.reduce((s, p) => s + (p.valor_total || 0), 0),
      convertidasQtd: convertidas.length,
      convertidasValor: convertidas.reduce((s, p) => s + (p.valor_total || 0), 0),
      rejeitadasQtd: rejeitadas.length,
      rejeitadasValor: rejeitadas.reduce((s, p) => s + (p.valor_total || 0), 0)
    };
  },

  // ── DESPESAS DO ESCRITÓRIO / SEDE QUERIES ──
  getDespesasEscritorio(filters = {}) {
    let items = this.getAll('lancamentos').filter(l => l.obra_id === 'escritorio' || l.obra_id === 'sede' || l.centro_custo === 'escritorio');
    if (filters.grupo) {
      if (filters.grupo === 'consumo') items = items.filter(l => ['energia','agua','internet_tel'].includes(l.categoria));
      else if (filters.grupo === 'impostos') items = items.filter(l => ['imposto_simples','tributos_trabalhistas','taxa'].includes(l.categoria));
      else if (filters.grupo === 'folha') items = items.filter(l => ['salario','pro_labore','beneficios','mao_de_obra'].includes(l.categoria));
      else if (filters.grupo === 'estrutura') items = items.filter(l => ['aluguel_sede','material_escritorio','manutencao_sede'].includes(l.categoria));
      else if (filters.grupo === 'servicos') items = items.filter(l => ['contabilidade','software_ti','veiculos_sede','servico'].includes(l.categoria));
    }
    if (filters.categoria) items = items.filter(l => l.categoria === filters.categoria);
    if (filters.status) items = items.filter(l => l.status === filters.status);
    if (filters.competencia) items = items.filter(l => l.competencia === filters.competencia || (l.data && l.data.startsWith(filters.competencia)));
    if (filters.dataInicio) items = items.filter(l => (l.data_vencimento || l.data) >= filters.dataInicio);
    if (filters.dataFim) items = items.filter(l => (l.data_vencimento || l.data) <= filters.dataFim);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      items = items.filter(l =>
        (l.descricao || '').toLowerCase().includes(s) ||
        (l.fornecedor_beneficiario || '').toLowerCase().includes(s) ||
        (l.conta_bancaria || '').toLowerCase().includes(s)
      );
    }
    return items.sort((a, b) => (b.data_vencimento || b.data || '').localeCompare(a.data_vencimento || a.data || ''));
  },

  getResumoEscritorio(filters = {}) {
    const list = this.getDespesasEscritorio(filters);
    const pagas = list.filter(l => l.status === 'pago');
    const aPagar = list.filter(l => l.status === 'a_pagar');
    const consumo = list.filter(l => ['energia','agua','internet_tel'].includes(l.categoria));
    const impostos = list.filter(l => ['imposto_simples','tributos_trabalhistas','taxa'].includes(l.categoria));
    const folha = list.filter(l => ['salario','pro_labore','beneficios'].includes(l.categoria));
    const estrutura = list.filter(l => ['aluguel_sede','material_escritorio','manutencao_sede'].includes(l.categoria));
    const servicos = list.filter(l => ['contabilidade','software_ti','veiculos_sede'].includes(l.categoria));

    return {
      totalGeral: list.reduce((s, l) => s + (l.valor || 0), 0),
      totalQtd: list.length,
      totalPago: pagas.reduce((s, l) => s + (l.valor || 0), 0),
      totalAPagar: aPagar.reduce((s, l) => s + (l.valor || 0), 0),
      aPagarQtd: aPagar.length,
      consumoValor: consumo.reduce((s, l) => s + (l.valor || 0), 0),
      impostosValor: impostos.reduce((s, l) => s + (l.valor || 0), 0),
      folhaValor: folha.reduce((s, l) => s + (l.valor || 0), 0),
      estruturaValor: estrutura.reduce((s, l) => s + (l.valor || 0), 0),
      servicosValor: servicos.reduce((s, l) => s + (l.valor || 0), 0)
    };
  },

  init() {
    this.purgeStorage();
    // Garante que todas as coleções existam no LocalStorage como array vazio se inexistentes
    Object.keys(this.K).forEach(k => {
      const sk = this._k(k);
      if (localStorage.getItem(sk) === null) {
        localStorage.setItem(sk, '[]');
      }
    });
    const docsKey = this._ck('finobra_documentos');
    if (localStorage.getItem(docsKey) === null) {
      localStorage.setItem(docsKey, '[]');
    }
    const recKey = this._ck('finobra_recibos');
    if (localStorage.getItem(recKey) === null) {
      localStorage.setItem(recKey, '[]');
    }
    const sinapiKey = this._ck('orcamentos_sinapi');
    if (localStorage.getItem(sinapiKey) === null) {
      localStorage.setItem(sinapiKey, '[]');
    }
  },

  isDemoLoaded() {
    return localStorage.getItem(this._ck('finobra_demo_v2')) === 'true';
  },

  clearAllData() {
    Object.keys(this.K).forEach(k => {
      this.save(k, []);
    });
    localStorage.setItem(this._ck('finobra_documentos'), '[]');
    localStorage.setItem(this._ck('finobra_recibos'), '[]');
    localStorage.setItem(this._ck('orcamentos_sinapi'), '[]');
    localStorage.setItem(this._k('fornecedores'), '[]');
    localStorage.removeItem(this._ck('finobra_demo_v2'));
    localStorage.setItem(this._ck('finobra_clean_mode'), 'true');
    console.log('[FinObra] 🧹 Todos os dados foram limpos com sucesso. Pronto para novos cadastros!');
  },

  clearDemo() {
    this.clearAllData();
  },

  _fmtDateAdd(days = 0) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  },

  refreshDemoVencimentos() {
    if (!this.isDemoLoaded()) return;
    let lans = this.getAll('lancamentos');
    let mudou = false;

    // Se já existem os boletos demo l021 a l027, garante que as datas estejam no futuro dinâmico
    const prazos = { l021: 6, l026: 9, l022: 15, l027: 21, l023: 28, l024: 38, l025: 52 };
    
    // Insere ou atualiza boletos adicionais
    const listaNovos = [
      { id:'l021', obra_id:'cli_001', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(6), descricao:'Boleto Madeireira Central — Esquadrias e Vigas', categoria:'material', valor:14500, status:'a_pagar', fornecedor_beneficiario:'Madeireira Central Ltda', conta_bancaria:'CC 0501-123456-7', codigo_barras:'34191.79001 01043.510047 91020.150008 5 98760001450000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l026', obra_id:'cli_001', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(9), descricao:'Boleto Votorantim Cimentos — CP-II e Argamassa', categoria:'material', valor:3850, status:'a_pagar', fornecedor_beneficiario:'Votorantim Cimentos S.A.', conta_bancaria:'CC 0501-123456-7', codigo_barras:'23793.38128 60000.778899 12000.456789 4 98850000385000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l022', obra_id:'cli_001', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(15), descricao:'Boleto Cerâmica Vale Verde — Tijolos e Pisos', categoria:'material', valor:8200, status:'a_pagar', fornecedor_beneficiario:'Cerâmica Vale Verde', conta_bancaria:'CC 0501-123456-7', codigo_barras:'03399.81234 12345.678901 23456.789012 1 98800000820000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l027', obra_id:'cli_002', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(21), descricao:'Boleto Tubos Tigre — Tubulações e Conexões', categoria:'material', valor:2940, status:'a_pagar', fornecedor_beneficiario:'Tigre Materiais Hidráulicos', conta_bancaria:'CC 0843-987654-3', codigo_barras:'34191.79001 01043.998877 66020.150008 2 98890000294000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l023', obra_id:'cli_001', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(28), descricao:'Boleto Siderúrgica Paulo — Ferragens CA-50', categoria:'material', valor:6800, status:'a_pagar', fornecedor_beneficiario:'Siderúrgica Paulo & Cia', conta_bancaria:'CC 0501-123456-7', codigo_barras:'23793.38128 60000.123456 78000.654321 3 98900000680000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l024', obra_id:'cli_002', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(38), descricao:'Boleto Elétrica Silva — Fiação e Disjuntores', categoria:'material', valor:5400, status:'a_pagar', fornecedor_beneficiario:'Elétrica Silva ME', conta_bancaria:'CC 0843-987654-3', codigo_barras:'10491.82345 98765.432109 87654.321098 7 99000000540000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l025', obra_id:'cli_002', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(52), descricao:'Boleto Tintas Coral — Textura e Pintura', categoria:'material', valor:4300, status:'a_pagar', fornecedor_beneficiario:'Casa das Tintas RR', conta_bancaria:'CC 0843-987654-3', codigo_barras:'00190.00009 01234.567890 12345.678901 9 99200000430000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true }
    ];

    listaNovos.forEach(b => {
      if (!lans.some(l => l.id === b.id)) {
        lans.push(b);
        mudou = true;
      }
    });

    lans = lans.map(l => {
      if (prazos[l.id] !== undefined) {
        mudou = true;
        return {
          ...l,
          data_vencimento: this._fmtDateAdd(prazos[l.id])
        };
      }
      return l;
    });

    if (mudou) {
      this.save('lancamentos', lans);
    }
  },

  // ── SEED DEMO DATA ──
  seedDemoData(force = false) {
    if (!force) {
      // Se não for forçado, não carrega demo automaticamente em modo limpo
      if (localStorage.getItem(this._ck('finobra_clean_mode')) === 'true' || !this.isDemoLoaded()) {
        return;
      }
    }
    localStorage.removeItem(this._ck('finobra_clean_mode'));
    localStorage.setItem(this._ck('finobra_demo_v2'), 'true');

    let ld = this.getAll('lancamentos');
    const hasEscritorio = ld.some(l => l.obra_id === 'escritorio');

    // Migração automática para garantir data_pagamento em itens pagos/recebidos existentes
    let changedLans = false;
    ld.forEach(l => {
      if ((l.status === 'pago' || l.status === 'recebido') && !l.data_pagamento) {
        l.data_pagamento = l.data;
        changedLans = true;
      }
    });

    let nd = this.getAll('notas');
    let changedNotas = false;
    nd.forEach(n => {
      if (n.status === 'paga' && !n.data_pagamento) {
        n.data_pagamento = n.data_emissao;
        changedNotas = true;
      }
    });
    if (changedNotas) this.save('notas', nd);

    if (this.isDemoLoaded() && !force) {
      if (!hasEscritorio) {
        const demoAdm = [
          { id:'l_adm_001', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(5), descricao:'Conta de Energia Elétrica — Sede Escritório Central', categoria:'energia', valor:1280, status:'a_pagar', fornecedor_beneficiario:'Equatorial / Roraima Energia', conta_bancaria:'BB — Movimento Principal', codigo_barras:'83640.00001 28000.123456 78901.234567 1 99200000128000', competencia:'2026-08', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_002', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-10), data_vencimento:this._fmtDateAdd(-5), data_pagamento:this._fmtDateAdd(-5), descricao:'Conta de Água e Esgoto — Sede', categoria:'agua', valor:340, status:'pago', fornecedor_beneficiario:'CAER Companhia de Águas', conta_bancaria:'BB — Movimento Principal', codigo_barras:'83620.00000 34000.987654 32100.123456 8 98800000034000', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_003', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(3), descricao:'Guia DAS — Simples Nacional (Comp. 07/2026)', categoria:'imposto_simples', valor:4850, status:'a_pagar', fornecedor_beneficiario:'Receita Federal do Brasil / Simples Nacional', conta_bancaria:'BB — Movimento Principal', codigo_barras:'85820.00004 85000.104050 12345.678901 3 99200000485000', competencia:'2026-07', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_004', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-12), data_vencimento:this._fmtDateAdd(-8), data_pagamento:this._fmtDateAdd(-8), descricao:'Aluguel da Sede Comercial — Angelim Construtora', categoria:'aluguel_sede', valor:3500, status:'pago', fornecedor_beneficiario:'Imobiliária Nova Era Ltda', conta_bancaria:'BB — Movimento Principal', codigo_barras:'00190.00009 01234.567890 12345.678901 9 99200000350000', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_005', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-15), data_vencimento:this._fmtDateAdd(-10), data_pagamento:this._fmtDateAdd(-10), descricao:'Internet Fibra Óptica Empresarial 500MB + Telefonia', categoria:'internet_tel', valor:249.90, status:'pago', fornecedor_beneficiario:'Vivo / Telefônica Brasil', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_006', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(8), descricao:'Honorários Contábeis e Assessoria Fiscal Mensal', categoria:'contabilidade', valor:1800, status:'a_pagar', fornecedor_beneficiario:'Meta Contabilidade & Consultoria', conta_bancaria:'BB — Movimento Principal', codigo_barras:'23793.38128 60000.123456 78000.654321 3 98900000180000', competencia:'2026-08', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_007', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-10), data_vencimento:this._fmtDateAdd(-5), data_pagamento:this._fmtDateAdd(-5), descricao:'Folha de Pagamento Funcionários — Equipe Sede', categoria:'salario', valor:14200, status:'pago', fornecedor_beneficiario:'Colaboradores Angelim Construtora', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', observacoes:'Engenheiro Civil, Projetista CAD, Assistente Financeiro e Recepcionista', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_008', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-10), data_vencimento:this._fmtDateAdd(-5), data_pagamento:this._fmtDateAdd(-5), descricao:'Pró-Labore Sócios Administradores', categoria:'pro_labore', valor:10000, status:'pago', fornecedor_beneficiario:'Sócios Administradores Angelim', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_009', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-18), data_vencimento:this._fmtDateAdd(-15), data_pagamento:this._fmtDateAdd(-15), descricao:'Licenças Softwares AutoCAD & Google Workspace Business', categoria:'software_ti', valor:680, status:'pago', fornecedor_beneficiario:'Autodesk & Google Cloud', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
          { id:'l_adm_010', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-5), data_vencimento:this._fmtDateAdd(-2), data_pagamento:this._fmtDateAdd(-2), descricao:'Material de Escritório, Papel A4, Toner e Café/Copa', categoria:'material_escritorio', valor:420, status:'pago', fornecedor_beneficiario:'Papelaria Central & Distribuidora', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true }
        ];
        demoAdm.forEach(item => ld.push(item));
        changedLans = true;
      }
      if (changedLans) {
        this.save('lancamentos', ld);
      }
      this.refreshDemoVencimentos();
      return;
    }

    const clientes = [
      { id:'cli_001', nome:'João Carlos Ferreira', cpf_cnpj:'123.456.789-00', telefone:'(15) 99812-3456', email:'joao.ferreira@email.com', endereco:'Rua das Acácias, 120, Jd. Paraíso', cidade:'Sorocaba', estado:'SP', cep:'18040-000', num_contrato_caixa:'0012345-6/0501', agencia_caixa:'0501 — Sorocaba Centro', valor_financiado:285000, valor_proprio:35000, area_construida:120, data_inicio:'2026-01-10', data_previsao_termino:'2026-12-10', status:'em_andamento', engenheiro_responsavel:'Eng. Ricardo Almeida — CREA-SP 123456', observacoes:'Casa térrea 3 quartos, 2 banheiros, garagem', created_at:'2026-01-05T10:00:00Z', _demo:true },
      { id:'cli_002', nome:'Maria Aparecida Santos', cpf_cnpj:'987.654.321-00', telefone:'(19) 99723-8765', email:'maria.santos@email.com', endereco:'Av. Brasil, 450, Vila São Bento', cidade:'Campinas', estado:'SP', cep:'13010-000', num_contrato_caixa:'0098765-4/0843', agencia_caixa:'0843 — Campinas Taquaral', valor_financiado:195000, valor_proprio:20000, area_construida:90, data_inicio:'2026-02-15', data_previsao_termino:'2026-11-15', status:'em_andamento', engenheiro_responsavel:'Eng. Fernanda Costa — CREA-SP 789012', observacoes:'Casa geminada 2 quartos, 1 banheiro', created_at:'2026-02-10T10:00:00Z', _demo:true },
      { id:'cli_003', nome:'Roberto Silva Lima', cpf_cnpj:'456.789.123-00', telefone:'(11) 98765-4321', email:'roberto.lima@email.com', endereco:'Rua das Flores, 78, Jd. Bonfiglioli', cidade:'Jundiaí', estado:'SP', cep:'13200-000', num_contrato_caixa:'0045678-9/0621', agencia_caixa:'0621 — Jundiaí Centro', valor_financiado:350000, valor_proprio:50000, area_construida:160, data_inicio:'2025-06-01', data_previsao_termino:'2026-06-30', status:'concluida', engenheiro_responsavel:'Eng. Marcos Pereira — CREA-SP 345678', observacoes:'Sobrado 4 quartos, suíte, garagem dupla', created_at:'2025-05-25T10:00:00Z', _demo:true }
    ];
    clientes.forEach(c => { const d = this.getAll('clientes'); d.push(c); this.save('clientes', d); });

    const lans = [
      // CLI_001 — Receitas
      { id:'l001', obra_id:'cli_001', tipo:'receita', data:'2026-01-05', descricao:'Entrada Própria — Início da Obra', categoria:'entrada_propria', valor:35000, status:'recebido', fornecedor_beneficiario:'João Carlos Ferreira', conta_bancaria:'CC 0501-123456-7', observacoes:'Recursos próprios do cliente', origem:'manual', conciliado:true, created_at:'2026-01-05T10:00:00Z', _demo:true },
      { id:'l002', obra_id:'cli_001', tipo:'receita', data:'2026-02-08', descricao:'1ª Parcela Caixa — Medição 01 (25%)', categoria:'parcela_caixa', valor:57000, status:'recebido', fornecedor_beneficiario:'Caixa Econômica Federal', conta_bancaria:'CC 0501-123456-7', observacoes:'Fundação concluída', origem:'medicao', conciliado:true, medicao_id:'med_001', created_at:'2026-02-08T10:00:00Z', _demo:true },
      { id:'l003', obra_id:'cli_001', tipo:'receita', data:'2026-04-10', descricao:'2ª Parcela Caixa — Medição 02 (50%)', categoria:'parcela_caixa', valor:57000, status:'recebido', fornecedor_beneficiario:'Caixa Econômica Federal', conta_bancaria:'CC 0501-123456-7', observacoes:'Estrutura concluída', origem:'medicao', conciliado:true, medicao_id:'med_002', created_at:'2026-04-10T10:00:00Z', _demo:true },
      { id:'l004', obra_id:'cli_001', tipo:'receita', data:'2026-07-15', descricao:'3ª Parcela Caixa — Medição 03 (75%)', categoria:'parcela_caixa', valor:57000, status:'a_receber', fornecedor_beneficiario:'Caixa Econômica Federal', conta_bancaria:'CC 0501-123456-7', observacoes:'Aguardando aprovação da medição', origem:'medicao', conciliado:false, medicao_id:'med_003', created_at:'2026-07-01T10:00:00Z', _demo:true },
      // CLI_001 — Despesas
      { id:'l010', obra_id:'cli_001', tipo:'despesa', data:'2026-01-20', descricao:'Cimento Portland CP-II (100 sacos)', categoria:'material', valor:3200, status:'pago', fornecedor_beneficiario:'Materiais Para Construção XYZ Ltda', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_001', origem:'manual', conciliado:true, created_at:'2026-01-20T10:00:00Z', _demo:true },
      { id:'l011', obra_id:'cli_001', tipo:'despesa', data:'2026-01-20', descricao:'Areia grossa e brita (10m³)', categoria:'material', valor:2800, status:'pago', fornecedor_beneficiario:'Areeiro São Bento', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_002', origem:'manual', conciliado:true, created_at:'2026-01-20T10:00:00Z', _demo:true },
      { id:'l012', obra_id:'cli_001', tipo:'despesa', data:'2026-01-25', descricao:'Serviço — Fundação e Locação da Obra', categoria:'mao_de_obra', valor:15000, status:'pago', fornecedor_beneficiario:'Empreiteira Lima & Filhos ME', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_003', origem:'manual', conciliado:true, created_at:'2026-01-25T10:00:00Z', _demo:true },
      { id:'l013', obra_id:'cli_001', tipo:'despesa', data:'2026-02-10', descricao:'Aço CA-50 (500 kg)', categoria:'material', valor:4200, status:'pago', fornecedor_beneficiario:'Siderúrgica Paulo & Cia', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_004', origem:'manual', conciliado:true, created_at:'2026-02-10T10:00:00Z', _demo:true },
      { id:'l014', obra_id:'cli_001', tipo:'despesa', data:'2026-02-15', descricao:'Tijolos cerâmicos 9 furos (5.000 un)', categoria:'material', valor:3800, status:'pago', fornecedor_beneficiario:'Cerâmica Vale Verde', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_005', origem:'manual', conciliado:true, created_at:'2026-02-15T10:00:00Z', _demo:true },
      { id:'l015', obra_id:'cli_001', tipo:'despesa', data:'2026-03-01', descricao:'Mão de Obra — Pedreiros (Fev/2026)', categoria:'mao_de_obra', valor:18000, status:'pago', fornecedor_beneficiario:'Empreiteira Lima & Filhos ME', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_006', origem:'manual', conciliado:true, created_at:'2026-03-01T10:00:00Z', _demo:true },
      { id:'l016', obra_id:'cli_001', tipo:'despesa', data:'2026-03-20', descricao:'Caixilhos, janelas e portas internas', categoria:'material', valor:12000, status:'pago', fornecedor_beneficiario:'Madeireira Central Ltda', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_007', origem:'manual', conciliado:true, created_at:'2026-03-20T10:00:00Z', _demo:true },
      { id:'l017', obra_id:'cli_001', tipo:'despesa', data:'2026-04-05', descricao:'Instalação Elétrica Completa', categoria:'servico', valor:8500, status:'pago', fornecedor_beneficiario:'Elétrica Silva ME', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_008', origem:'manual', conciliado:true, created_at:'2026-04-05T10:00:00Z', _demo:true },
      { id:'l018', obra_id:'cli_001', tipo:'despesa', data:'2026-04-15', descricao:'Instalação Hidráulica Completa', categoria:'servico', valor:7200, status:'pago', fornecedor_beneficiario:'Hidráulica Santos ME', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_009', origem:'manual', conciliado:true, created_at:'2026-04-15T10:00:00Z', _demo:true },
      { id:'l019', obra_id:'cli_001', tipo:'despesa', data:'2026-05-01', data_vencimento:'2026-05-01', descricao:'Cerâmica e Porcelanato (90 m²)', categoria:'material', valor:15000, status:'pago', fornecedor_beneficiario:'Casa do Revestimento Ltda', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_010', origem:'manual', conciliado:true, created_at:'2026-05-01T10:00:00Z', _demo:true },
      { id:'l020', obra_id:'cli_001', tipo:'despesa', data:'2026-05-20', data_vencimento:'2026-05-20', descricao:'Mão de Obra — Acabamento Geral', categoria:'mao_de_obra', valor:12000, status:'pago', fornecedor_beneficiario:'Empreiteira Lima & Filhos ME', conta_bancaria:'CC 0501-123456-7', nota_fiscal_id:'nf_011', origem:'manual', conciliado:false, created_at:'2026-05-20T10:00:00Z', _demo:true },
      
      // Boletos e Contas a Vencer nos Próximos 60 Dias (Dinâmicos)
      { id:'l021', obra_id:'cli_001', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(6), descricao:'Boleto Madeireira Central — Esquadrias e Vigas', categoria:'material', valor:14500, status:'a_pagar', fornecedor_beneficiario:'Madeireira Central Ltda', conta_bancaria:'CC 0501-123456-7', codigo_barras:'34191.79001 01043.510047 91020.150008 5 98760001450000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l022', obra_id:'cli_001', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(15), descricao:'Boleto Cerâmica Vale Verde — Tijolos e Pisos', categoria:'material', valor:8200, status:'a_pagar', fornecedor_beneficiario:'Cerâmica Vale Verde', conta_bancaria:'CC 0501-123456-7', codigo_barras:'03399.81234 12345.678901 23456.789012 1 98800000820000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l023', obra_id:'cli_001', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(28), descricao:'Boleto Siderúrgica Paulo — Ferragens CA-50', categoria:'material', valor:6800, status:'a_pagar', fornecedor_beneficiario:'Siderúrgica Paulo & Cia', conta_bancaria:'CC 0501-123456-7', codigo_barras:'23793.38128 60000.123456 78000.654321 3 98900000680000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l024', obra_id:'cli_002', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(38), descricao:'Boleto Elétrica Silva — Fiação e Disjuntores', categoria:'material', valor:5400, status:'a_pagar', fornecedor_beneficiario:'Elétrica Silva ME', conta_bancaria:'CC 0843-987654-3', codigo_barras:'10491.82345 98765.432109 87654.321098 7 99000000540000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l025', obra_id:'cli_002', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(52), descricao:'Boleto Tintas Coral — Textura e Pintura', categoria:'material', valor:4300, status:'a_pagar', fornecedor_beneficiario:'Casa das Tintas RR', conta_bancaria:'CC 0843-987654-3', codigo_barras:'00190.00009 01234.567890 12345.678901 9 99200000430000', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },

      // CLI_002 — Receitas
      { id:'l030', obra_id:'cli_002', tipo:'receita', data:'2026-02-15', data_vencimento:'2026-02-15', descricao:'Entrada Própria — Início da Obra', categoria:'entrada_propria', valor:20000, status:'recebido', fornecedor_beneficiario:'Maria Aparecida Santos', conta_bancaria:'CC 0843-987654-3', origem:'manual', conciliado:true, created_at:'2026-02-15T10:00:00Z', _demo:true },
      { id:'l031', obra_id:'cli_002', tipo:'receita', data:'2026-03-20', data_vencimento:'2026-03-20', descricao:'1ª Parcela Caixa — Medição 01 (25%)', categoria:'parcela_caixa', valor:39000, status:'recebido', fornecedor_beneficiario:'Caixa Econômica Federal', conta_bancaria:'CC 0843-987654-3', origem:'medicao', conciliado:true, medicao_id:'med_005', created_at:'2026-03-20T10:00:00Z', _demo:true },
      { id:'l032', obra_id:'cli_002', tipo:'receita', data:'2026-06-05', data_vencimento:'2026-06-05', descricao:'2ª Parcela Caixa — Medição 02 (50%)', categoria:'parcela_caixa', valor:39000, status:'recebido', fornecedor_beneficiario:'Caixa Econômica Federal', conta_bancaria:'CC 0843-987654-3', origem:'medicao', conciliado:true, medicao_id:'med_006', created_at:'2026-06-05T10:00:00Z', _demo:true },
      // CLI_002 — Despesas
      { id:'l040', obra_id:'cli_002', tipo:'despesa', data:'2026-02-25', data_vencimento:'2026-02-25', descricao:'Material para Fundação', categoria:'material', valor:9500, status:'pago', fornecedor_beneficiario:'Materiais XYZ Ltda', conta_bancaria:'CC 0843-987654-3', nota_fiscal_id:'nf_020', origem:'manual', conciliado:true, created_at:'2026-02-25T10:00:00Z', _demo:true },
      { id:'l041', obra_id:'cli_002', tipo:'despesa', data:'2026-03-12', data_vencimento:'2026-03-12', descricao:'Estrutura de Concreto Armado', categoria:'mao_de_obra', valor:16000, status:'pago', fornecedor_beneficiario:'Construtora CR Ltda', conta_bancaria:'CC 0843-987654-3', nota_fiscal_id:'nf_021', origem:'manual', conciliado:true, created_at:'2026-03-12T10:00:00Z', _demo:true },
      { id:'l042', obra_id:'cli_002', tipo:'despesa', data:'2026-04-08', data_vencimento:'2026-04-08', descricao:'Alvenaria Completa', categoria:'mao_de_obra', valor:14000, status:'pago', fornecedor_beneficiario:'Construtora CR Ltda', conta_bancaria:'CC 0843-987654-3', nota_fiscal_id:'nf_022', origem:'manual', conciliado:true, created_at:'2026-04-08T10:00:00Z', _demo:true },
      { id:'l043', obra_id:'cli_002', tipo:'despesa', data:'2026-05-20', data_vencimento:'2026-05-20', descricao:'Instalações Elétricas e Hidráulicas', categoria:'servico', valor:14500, status:'pago', fornecedor_beneficiario:'Total Instalações ME', conta_bancaria:'CC 0843-987654-3', nota_fiscal_id:'nf_023', origem:'manual', conciliado:true, created_at:'2026-05-20T10:00:00Z', _demo:true },
      { id:'l044', obra_id:'cli_002', tipo:'despesa', data:'2026-07-20', data_vencimento:'2026-07-20', descricao:'Cobertura e Telhado', categoria:'material', valor:18000, status:'pago', fornecedor_beneficiario:'Madeireira Norte Ltda', conta_bancaria:'CC 0843-987654-3', origem:'manual', conciliado:true, created_at:'2026-07-01T10:00:00Z', _demo:true },
      // CLI_003 — Obra Concluída
      { id:'l050', obra_id:'cli_003', tipo:'receita', data:'2025-06-01', data_vencimento:'2025-06-01', descricao:'Entrada Própria', categoria:'entrada_propria', valor:50000, status:'recebido', fornecedor_beneficiario:'Roberto Silva Lima', conta_bancaria:'CC 0621-456789-1', origem:'manual', conciliado:true, created_at:'2025-06-01T10:00:00Z', _demo:true },
      { id:'l051', obra_id:'cli_003', tipo:'receita', data:'2025-07-15', data_vencimento:'2025-07-15', descricao:'1ª Parcela Caixa', categoria:'parcela_caixa', valor:70000, status:'recebido', fornecedor_beneficiario:'Caixa Econômica Federal', conta_bancaria:'CC 0621-456789-1', origem:'medicao', conciliado:true, created_at:'2025-07-15T10:00:00Z', _demo:true },
      { id:'l052', obra_id:'cli_003', tipo:'receita', data:'2025-10-08', data_vencimento:'2025-10-08', descricao:'2ª Parcela Caixa', categoria:'parcela_caixa', valor:70000, status:'recebido', fornecedor_beneficiario:'Caixa Econômica Federal', conta_bancaria:'CC 0621-456789-1', origem:'medicao', conciliado:true, created_at:'2025-10-08T10:00:00Z', _demo:true },
      { id:'l053', obra_id:'cli_003', tipo:'receita', data:'2026-01-12', data_vencimento:'2026-01-12', descricao:'3ª Parcela Caixa', categoria:'parcela_caixa', valor:70000, status:'recebido', fornecedor_beneficiario:'Caixa Econômica Federal', conta_bancaria:'CC 0621-456789-1', origem:'medicao', conciliado:true, created_at:'2026-01-12T10:00:00Z', _demo:true },
      { id:'l054', obra_id:'cli_003', tipo:'receita', data:'2026-04-05', data_vencimento:'2026-04-05', descricao:'4ª Parcela Caixa (Final)', categoria:'parcela_caixa', valor:70000, status:'recebido', fornecedor_beneficiario:'Caixa Econômica Federal', conta_bancaria:'CC 0621-456789-1', origem:'medicao', conciliado:true, created_at:'2026-04-05T10:00:00Z', _demo:true },
      { id:'l060', obra_id:'cli_003', tipo:'despesa', data:'2025-06-20', data_vencimento:'2025-06-20', descricao:'Material Fase 1 — Fundação e Estrutura', categoria:'material', valor:48000, status:'pago', fornecedor_beneficiario:'Materiais XYZ Ltda', conta_bancaria:'CC 0621-456789-1', origem:'manual', conciliado:true, created_at:'2025-06-20T10:00:00Z', _demo:true },
      { id:'l061', obra_id:'cli_003', tipo:'despesa', data:'2025-09-15', data_vencimento:'2025-09-15', descricao:'Mão de Obra — Estrutura e Alvenaria', categoria:'mao_de_obra', valor:65000, status:'pago', fornecedor_beneficiario:'Construtora RS Ltda', conta_bancaria:'CC 0621-456789-1', origem:'manual', conciliado:true, created_at:'2025-09-15T10:00:00Z', _demo:true },
      { id:'l062', obra_id:'cli_003', tipo:'despesa', data:'2025-12-10', data_vencimento:'2025-12-10', descricao:'Instalações e Cobertura', categoria:'servico', valor:52000, status:'pago', fornecedor_beneficiario:'Total Serviços Ltda', conta_bancaria:'CC 0621-456789-1', origem:'manual', conciliado:true, created_at:'2025-12-10T10:00:00Z', _demo:true },
      { id:'l063', obra_id:'cli_003', tipo:'despesa', data:'2026-04-10', data_vencimento:'2026-04-10', descricao:'Acabamento Final e Paisagismo', categoria:'servico', valor:42000, status:'pago', fornecedor_beneficiario:'Acabamentos Premium Ltda', conta_bancaria:'CC 0621-456789-1', origem:'manual', conciliado:true, created_at:'2026-04-10T10:00:00Z', _demo:true },

      // ── DESPESAS ADMINISTRATIVAS DO ESCRITÓRIO / SEDE ──
      { id:'l_adm_001', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(5), descricao:'Conta de Energia Elétrica — Sede Escritório Central', categoria:'energia', valor:1280, status:'a_pagar', fornecedor_beneficiario:'Equatorial / Roraima Energia', conta_bancaria:'BB — Movimento Principal', codigo_barras:'83640.00001 28000.123456 78901.234567 1 99200000128000', competencia:'2026-08', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l_adm_002', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-10), data_vencimento:this._fmtDateAdd(-5), descricao:'Conta de Água e Esgoto — Sede', categoria:'agua', valor:340, status:'pago', fornecedor_beneficiario:'CAER Companhia de Águas', conta_bancaria:'BB — Movimento Principal', codigo_barras:'83620.00000 34000.987654 32100.123456 8 98800000034000', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
      { id:'l_adm_003', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(3), descricao:'Guia DAS — Simples Nacional (Comp. 07/2026)', categoria:'imposto_simples', valor:4850, status:'a_pagar', fornecedor_beneficiario:'Receita Federal do Brasil / Simples Nacional', conta_bancaria:'BB — Movimento Principal', codigo_barras:'85820.00004 85000.104050 12345.678901 3 99200000485000', competencia:'2026-07', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l_adm_004', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-12), data_vencimento:this._fmtDateAdd(-8), descricao:'Aluguel da Sede Comercial — Angelim Construtora', categoria:'aluguel_sede', valor:3500, status:'pago', fornecedor_beneficiario:'Imobiliária Nova Era Ltda', conta_bancaria:'BB — Movimento Principal', codigo_barras:'00190.00009 01234.567890 12345.678901 9 99200000350000', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
      { id:'l_adm_005', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-15), data_vencimento:this._fmtDateAdd(-10), descricao:'Internet Fibra Óptica Empresarial 500MB + Telefonia', categoria:'internet_tel', valor:249.90, status:'pago', fornecedor_beneficiario:'Vivo / Telefônica Brasil', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
      { id:'l_adm_006', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(0), data_vencimento:this._fmtDateAdd(8), descricao:'Honorários Contábeis e Assessoria Fiscal Mensal', categoria:'contabilidade', valor:1800, status:'a_pagar', fornecedor_beneficiario:'Meta Contabilidade & Consultoria', conta_bancaria:'BB — Movimento Principal', codigo_barras:'23793.38128 60000.123456 78000.654321 3 98900000180000', competencia:'2026-08', origem:'manual', conciliado:false, created_at:new Date().toISOString(), _demo:true },
      { id:'l_adm_007', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-10), data_vencimento:this._fmtDateAdd(-5), descricao:'Folha de Pagamento Funcionários — Equipe Sede', categoria:'salario', valor:14200, status:'pago', fornecedor_beneficiario:'Colaboradores Angelim Construtora', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', observacoes:'Engenheiro Civil, Projetista CAD, Assistente Financeiro e Recepcionista', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
      { id:'l_adm_008', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-10), data_vencimento:this._fmtDateAdd(-5), descricao:'Pró-Labore Sócios Administradores', categoria:'pro_labore', valor:10000, status:'pago', fornecedor_beneficiario:'Sócios Administradores Angelim', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
      { id:'l_adm_009', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-18), data_vencimento:this._fmtDateAdd(-15), descricao:'Licenças Softwares AutoCAD & Google Workspace Business', categoria:'software_ti', valor:680, status:'pago', fornecedor_beneficiario:'Autodesk & Google Cloud', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true },
      { id:'l_adm_010', obra_id:'escritorio', tipo:'despesa', data:this._fmtDateAdd(-5), data_vencimento:this._fmtDateAdd(-2), descricao:'Material de Escritório, Papel A4, Toner e Café/Copa', categoria:'material_escritorio', valor:420, status:'pago', fornecedor_beneficiario:'Papelaria Central & Distribuidora', conta_bancaria:'BB — Movimento Principal', competencia:'2026-08', origem:'manual', conciliado:true, created_at:new Date().toISOString(), _demo:true }
    ];
    lans.forEach(l => ld.push(l));
    this.save('lancamentos', ld);

    const notas = [
      { id:'nf_001', obra_id:'cli_001', numero_nf:'001234', serie:'001', tipo:'entrada', emitente:'Materiais Para Construção XYZ Ltda', cnpj_emitente:'12.345.678/0001-90', destinatario:'João Carlos Ferreira', data_emissao:'2026-01-19', data_vencimento:'2026-01-20', valor_bruto:3200, impostos:192, valor_liquido:3008, categoria:'material', status:'paga', lancamento_id:'l010', chave_nfe:'35260112345678000190550010001234001234567891', observacoes:'', created_at:'2026-01-19T10:00:00Z', _demo:true },
      { id:'nf_002', obra_id:'cli_001', numero_nf:'002567', serie:'001', tipo:'entrada', emitente:'Areeiro São Bento', cnpj_emitente:'23.456.789/0001-01', destinatario:'João Carlos Ferreira', data_emissao:'2026-01-19', data_vencimento:'2026-01-20', valor_bruto:2800, impostos:140, valor_liquido:2660, categoria:'material', status:'paga', lancamento_id:'l011', chave_nfe:'', observacoes:'Areia e brita', created_at:'2026-01-19T10:00:00Z', _demo:true },
      { id:'nf_003', obra_id:'cli_001', numero_nf:'000089', serie:'001', tipo:'entrada', emitente:'Empreiteira Lima & Filhos ME', cnpj_emitente:'34.567.890/0001-12', destinatario:'João Carlos Ferreira', data_emissao:'2026-01-24', data_vencimento:'2026-01-25', valor_bruto:15000, impostos:750, valor_liquido:14250, categoria:'mao_de_obra', status:'paga', lancamento_id:'l012', chave_nfe:'', observacoes:'Fundação e locação', created_at:'2026-01-24T10:00:00Z', _demo:true },
      { id:'nf_004', obra_id:'cli_001', numero_nf:'008901', serie:'001', tipo:'entrada', emitente:'Siderúrgica Paulo & Cia', cnpj_emitente:'45.678.901/0001-23', destinatario:'João Carlos Ferreira', data_emissao:'2026-02-09', data_vencimento:'2026-02-10', valor_bruto:4200, impostos:210, valor_liquido:3990, categoria:'material', status:'paga', lancamento_id:'l013', chave_nfe:'', observacoes:'Aço CA-50', created_at:'2026-02-09T10:00:00Z', _demo:true },
      { id:'nf_005', obra_id:'cli_001', numero_nf:'003412', serie:'001', tipo:'entrada', emitente:'Cerâmica Vale Verde', cnpj_emitente:'56.789.012/0001-34', destinatario:'João Carlos Ferreira', data_emissao:'2026-02-14', data_vencimento:'2026-02-15', valor_bruto:3800, impostos:190, valor_liquido:3610, categoria:'material', status:'paga', lancamento_id:'l014', chave_nfe:'', observacoes:'5.000 tijolos 9 furos', created_at:'2026-02-14T10:00:00Z', _demo:true },
      { id:'nf_006', obra_id:'cli_001', numero_nf:'000112', serie:'001', tipo:'entrada', emitente:'Empreiteira Lima & Filhos ME', cnpj_emitente:'34.567.890/0001-12', destinatario:'João Carlos Ferreira', data_emissao:'2026-02-28', data_vencimento:'2026-03-01', valor_bruto:18000, impostos:900, valor_liquido:17100, categoria:'mao_de_obra', status:'paga', lancamento_id:'l015', chave_nfe:'', observacoes:'Pedreiros fevereiro', created_at:'2026-02-28T10:00:00Z', _demo:true },
      { id:'nf_007', obra_id:'cli_001', numero_nf:'001567', serie:'001', tipo:'entrada', emitente:'Madeireira Central Ltda', cnpj_emitente:'67.890.123/0001-45', destinatario:'João Carlos Ferreira', data_emissao:'2026-03-19', data_vencimento:'2026-03-20', valor_bruto:12000, impostos:600, valor_liquido:11400, categoria:'material', status:'paga', lancamento_id:'l016', chave_nfe:'', observacoes:'Caixilhos e portas', created_at:'2026-03-19T10:00:00Z', _demo:true },
      { id:'nf_008', obra_id:'cli_001', numero_nf:'000234', serie:'001', tipo:'entrada', emitente:'Elétrica Silva ME', cnpj_emitente:'78.901.234/0001-56', destinatario:'João Carlos Ferreira', data_emissao:'2026-04-04', data_vencimento:'2026-04-05', valor_bruto:8500, impostos:425, valor_liquido:8075, categoria:'servico', status:'paga', lancamento_id:'l017', chave_nfe:'', observacoes:'Instalação elétrica completa', created_at:'2026-04-04T10:00:00Z', _demo:true },
      { id:'nf_009', obra_id:'cli_001', numero_nf:'000456', serie:'001', tipo:'entrada', emitente:'Hidráulica Santos ME', cnpj_emitente:'89.012.345/0001-67', destinatario:'João Carlos Ferreira', data_emissao:'2026-04-14', data_vencimento:'2026-04-15', valor_bruto:7200, impostos:360, valor_liquido:6840, categoria:'servico', status:'paga', lancamento_id:'l018', chave_nfe:'', observacoes:'Instalação hidráulica', created_at:'2026-04-14T10:00:00Z', _demo:true },
      { id:'nf_010', obra_id:'cli_001', numero_nf:'005678', serie:'001', tipo:'entrada', emitente:'Casa do Revestimento Ltda', cnpj_emitente:'90.123.456/0001-78', destinatario:'João Carlos Ferreira', data_emissao:'2026-04-30', data_vencimento:'2026-05-01', valor_bruto:15000, impostos:750, valor_liquido:14250, categoria:'material', status:'paga', lancamento_id:'l019', chave_nfe:'', observacoes:'Cerâmica e porcelanato 90m²', created_at:'2026-04-30T10:00:00Z', _demo:true },
      { id:'nf_011', obra_id:'cli_001', numero_nf:'000145', serie:'001', tipo:'entrada', emitente:'Empreiteira Lima & Filhos ME', cnpj_emitente:'34.567.890/0001-12', destinatario:'João Carlos Ferreira', data_emissao:'2026-05-19', data_vencimento:'2026-05-20', valor_bruto:12000, impostos:600, valor_liquido:11400, categoria:'mao_de_obra', status:'pendente', lancamento_id:'l020', chave_nfe:'', observacoes:'Acabamento geral', created_at:'2026-05-19T10:00:00Z', _demo:true },
      { id:'nf_020', obra_id:'cli_002', numero_nf:'004567', serie:'001', tipo:'entrada', emitente:'Materiais XYZ Ltda', cnpj_emitente:'12.345.678/0001-90', destinatario:'Maria Aparecida Santos', data_emissao:'2026-02-24', data_vencimento:'2026-02-25', valor_bruto:9500, impostos:475, valor_liquido:9025, categoria:'material', status:'paga', lancamento_id:'l040', chave_nfe:'', observacoes:'Material para fundação', created_at:'2026-02-24T10:00:00Z', _demo:true },
      { id:'nf_021', obra_id:'cli_002', numero_nf:'000078', serie:'001', tipo:'entrada', emitente:'Construtora CR Ltda', cnpj_emitente:'11.223.344/0001-55', destinatario:'Maria Aparecida Santos', data_emissao:'2026-03-11', data_vencimento:'2026-03-12', valor_bruto:16000, impostos:800, valor_liquido:15200, categoria:'mao_de_obra', status:'paga', lancamento_id:'l041', chave_nfe:'', observacoes:'Estrutura de concreto', created_at:'2026-03-11T10:00:00Z', _demo:true },
      { id:'nf_022', obra_id:'cli_002', numero_nf:'000099', serie:'001', tipo:'entrada', emitente:'Construtora CR Ltda', cnpj_emitente:'11.223.344/0001-55', destinatario:'Maria Aparecida Santos', data_emissao:'2026-04-07', data_vencimento:'2026-04-08', valor_bruto:14000, impostos:700, valor_liquido:13300, categoria:'mao_de_obra', status:'paga', lancamento_id:'l042', chave_nfe:'', observacoes:'Alvenaria completa', created_at:'2026-04-07T10:00:00Z', _demo:true },
      { id:'nf_023', obra_id:'cli_002', numero_nf:'000156', serie:'001', tipo:'entrada', emitente:'Total Instalações ME', cnpj_emitente:'22.334.455/0001-66', destinatario:'Maria Aparecida Santos', data_emissao:'2026-05-19', data_vencimento:'2026-05-20', valor_bruto:14500, impostos:725, valor_liquido:13775, categoria:'servico', status:'pendente', lancamento_id:'l043', chave_nfe:'', observacoes:'Elétrica e hidráulica', created_at:'2026-05-19T10:00:00Z', _demo:true },
    ];
    notas.forEach(n => nd.push(n));
    this.save('notas', nd);

    const orcamentos = [
      {
        id:'orc_001', obra_id:'cli_001', nome:'Orçamento Base — João Ferreira', descricao:'Orçamento inicial aprovado pela Caixa', data_criacao:'2026-01-05', status:'ativo',
        valor_total_previsto:285000,
        etapas:[
          { id:'et_001', nome:'Fundação', valor_previsto:28000, valor_realizado:24000, percentual_execucao:100, data_inicio:'2026-01-10', data_fim:'2026-02-10', observacoes:'Sapata isolada', _cor:'green' },
          { id:'et_002', nome:'Estrutura', valor_previsto:52000, valor_realizado:52000, percentual_execucao:100, data_inicio:'2026-02-01', data_fim:'2026-03-20', observacoes:'Pilares e vigas', _cor:'green' },
          { id:'et_003', nome:'Alvenaria', valor_previsto:38000, valor_realizado:37200, percentual_execucao:100, data_inicio:'2026-03-01', data_fim:'2026-04-30', observacoes:'Tijolo cerâmico 9 furos', _cor:'green' },
          { id:'et_004', nome:'Cobertura', valor_previsto:35000, valor_realizado:22000, percentual_execucao:65, data_inicio:'2026-04-15', data_fim:'2026-07-15', observacoes:'Telhado colonial francês', _cor:'yellow' },
          { id:'et_005', nome:'Instalações', valor_previsto:32000, valor_realizado:15700, percentual_execucao:50, data_inicio:'2026-04-01', data_fim:'2026-08-01', observacoes:'Elétrica, hidráulica, gás', _cor:'yellow' },
          { id:'et_006', nome:'Acabamento', valor_previsto:58000, valor_realizado:27000, percentual_execucao:47, data_inicio:'2026-05-01', data_fim:'2026-11-01', observacoes:'Revestimentos e pintura', _cor:'yellow' },
          { id:'et_007', nome:'Paisagismo', valor_previsto:12000, valor_realizado:0, percentual_execucao:0, data_inicio:'2026-10-01', data_fim:'2026-12-01', observacoes:'', _cor:'blue' },
          { id:'et_008', nome:'Imprevistos', valor_previsto:30000, valor_realizado:8500, percentual_execucao:28, data_inicio:'2026-01-10', data_fim:'2026-12-10', observacoes:'Reserva técnica 10%', _cor:'blue' },
        ],
        created_at:'2026-01-05T10:00:00Z', _demo:true
      },
      {
        id:'orc_002', obra_id:'cli_002', nome:'Orçamento Base — Maria Santos', descricao:'Orçamento aprovado — Casa geminada', data_criacao:'2026-02-10', status:'ativo',
        valor_total_previsto:195000,
        etapas:[
          { id:'et_010', nome:'Fundação', valor_previsto:18000, valor_realizado:18000, percentual_execucao:100, data_inicio:'2026-02-15', data_fim:'2026-03-15', observacoes:'', _cor:'green' },
          { id:'et_011', nome:'Estrutura', valor_previsto:35000, valor_realizado:35000, percentual_execucao:100, data_inicio:'2026-03-01', data_fim:'2026-04-20', observacoes:'', _cor:'green' },
          { id:'et_012', nome:'Alvenaria', valor_previsto:28000, valor_realizado:14000, percentual_execucao:50, data_inicio:'2026-04-01', data_fim:'2026-06-01', observacoes:'', _cor:'yellow' },
          { id:'et_013', nome:'Cobertura', valor_previsto:25000, valor_realizado:0, percentual_execucao:0, data_inicio:'2026-05-15', data_fim:'2026-08-15', observacoes:'', _cor:'blue' },
          { id:'et_014', nome:'Instalações', valor_previsto:22000, valor_realizado:14500, percentual_execucao:66, data_inicio:'2026-05-01', data_fim:'2026-09-01', observacoes:'', _cor:'yellow' },
          { id:'et_015', nome:'Acabamento', valor_previsto:47000, valor_realizado:0, percentual_execucao:0, data_inicio:'2026-07-01', data_fim:'2026-11-01', observacoes:'', _cor:'blue' },
          { id:'et_016', nome:'Imprevistos', valor_previsto:20000, valor_realizado:0, percentual_execucao:0, data_inicio:'2026-02-15', data_fim:'2026-11-15', observacoes:'', _cor:'blue' },
        ],
        created_at:'2026-02-10T10:00:00Z', _demo:true
      }
    ];
    const od = this.getAll('orcamentos');
    orcamentos.forEach(o => od.push(o));
    this.save('orcamentos', od);

    const medicoes = [
      { id:'med_001', obra_id:'cli_001', numero_medicao:1, data_medicao:'2026-01-28', data_submissao:'2026-01-28', data_aprovacao:'2026-02-05', data_liberacao:'2026-02-08', data_previsao:'2026-01-30', percentual_fisico:25, percentual_financeiro:20, valor_solicitado:57000, valor_aprovado:57000, valor_liberado:57000, etapa_descricao:'Fundação completa — sapata isolada e contrapiso executado', status:'liberada', engenheiro_responsavel:'Eng. Ricardo Almeida', observacoes:'Aprovado sem ressalvas', lancamento_id:'l002', documentos_ok:true, created_at:'2026-01-28T10:00:00Z', _demo:true },
      { id:'med_002', obra_id:'cli_001', numero_medicao:2, data_medicao:'2026-03-28', data_submissao:'2026-03-28', data_aprovacao:'2026-04-07', data_liberacao:'2026-04-10', data_previsao:'2026-03-30', percentual_fisico:50, percentual_financeiro:40, valor_solicitado:57000, valor_aprovado:57000, valor_liberado:57000, etapa_descricao:'Estrutura concluída — pilares, vigas e laje', status:'liberada', engenheiro_responsavel:'Eng. Ricardo Almeida', observacoes:'Aprovado com ressalva leve corrigida', lancamento_id:'l003', documentos_ok:true, created_at:'2026-03-28T10:00:00Z', _demo:true },
      { id:'med_003', obra_id:'cli_001', numero_medicao:3, data_medicao:'2026-06-20', data_submissao:'2026-06-20', data_aprovacao:null, data_liberacao:null, data_previsao:'2026-07-15', percentual_fisico:72, percentual_financeiro:60, valor_solicitado:57000, valor_aprovado:null, valor_liberado:null, etapa_descricao:'Alvenaria completa, cobertura parcial 70%', status:'em_analise', engenheiro_responsavel:'Eng. Ricardo Almeida', observacoes:'Aguardando vistoria técnica do Engenheiro Caixa', lancamento_id:null, documentos_ok:true, created_at:'2026-06-20T10:00:00Z', _demo:true },
      { id:'med_004', obra_id:'cli_001', numero_medicao:4, data_medicao:null, data_submissao:null, data_aprovacao:null, data_liberacao:null, data_previsao:'2026-10-01', percentual_fisico:90, percentual_financeiro:80, valor_solicitado:57000, valor_aprovado:null, valor_liberado:null, etapa_descricao:'Instalações completas e acabamentos parciais', status:'preparando', engenheiro_responsavel:'Eng. Ricardo Almeida', observacoes:'Preparar documentação', lancamento_id:null, documentos_ok:false, created_at:'2026-07-01T10:00:00Z', _demo:true },
      { id:'med_005', obra_id:'cli_002', numero_medicao:1, data_medicao:'2026-03-10', data_submissao:'2026-03-10', data_aprovacao:'2026-03-18', data_liberacao:'2026-03-20', data_previsao:'2026-03-12', percentual_fisico:25, percentual_financeiro:20, valor_solicitado:39000, valor_aprovado:39000, valor_liberado:39000, etapa_descricao:'Fundação concluída', status:'liberada', engenheiro_responsavel:'Eng. Fernanda Costa', observacoes:'', lancamento_id:'l031', documentos_ok:true, created_at:'2026-03-10T10:00:00Z', _demo:true },
      { id:'med_006', obra_id:'cli_002', numero_medicao:2, data_medicao:'2026-05-25', data_submissao:'2026-05-25', data_aprovacao:'2026-06-02', data_liberacao:'2026-06-05', data_previsao:'2026-05-27', percentual_fisico:50, percentual_financeiro:40, valor_solicitado:39000, valor_aprovado:39000, valor_liberado:39000, etapa_descricao:'Estrutura e alvenaria parcial', status:'liberada', engenheiro_responsavel:'Eng. Fernanda Costa', observacoes:'', lancamento_id:'l032', documentos_ok:true, created_at:'2026-05-25T10:00:00Z', _demo:true },
      { id:'med_007', obra_id:'cli_002', numero_medicao:3, data_medicao:null, data_submissao:null, data_aprovacao:null, data_liberacao:null, data_previsao:'2026-09-15', percentual_fisico:75, percentual_financeiro:60, valor_solicitado:39000, valor_aprovado:null, valor_liberado:null, etapa_descricao:'Alvenaria completa e cobertura', status:'preparando', engenheiro_responsavel:'Eng. Fernanda Costa', observacoes:'', lancamento_id:null, documentos_ok:false, created_at:'2026-07-01T10:00:00Z', _demo:true },
    ];
    const md = this.getAll('medicoes');
    medicoes.forEach(m => md.push(m));
    this.save('medicoes', md);

    const contas = [
      { id:'cta_001', banco_codigo:'104', banco_nome:'Caixa Econômica Federal', agencia:'0501', numero:'123456-7', tipo:'obras', titular:'Angelim Construtora LTDA', apelido:'Caixa — Conta Obras Sorocaba', obra_id:'cli_001', obs:'Conta corrente vinculada ao contrato Caixa 0012345-6/0501', created_at:'2026-01-05T10:00:00Z', _demo:true },
      { id:'cta_002', banco_codigo:'001', banco_nome:'Banco do Brasil', agencia:'1234', numero:'98765-4', tipo:'corrente', titular:'Angelim Construtora LTDA', apelido:'BB — Movimento Principal', obra_id:null, obs:'Conta principal da empresa', created_at:'2026-01-05T10:00:00Z', _demo:true }
    ];
    const cd = this.getAll('contas');
    if (!cd.length) {
      contas.forEach(c => cd.push(c));
      this.save('contas', cd);
    }

    const precompras = [
      {
        id: 'pc_001',
        numero_ordem: 'PC-2026-0001',
        obra_id: 'cli_001',
        descricao: 'Aço CA-50 e Malhas Soldadas para Estrutura e Laje',
        categoria: 'material',
        prioridade: 'alta',
        status: 'pendente_aprovacao',
        solicitante_nome: 'Eng. Ricardo Almeida',
        solicitante_id: 'u2',
        data_solicitacao: '2026-08-15',
        data_necessidade: '2026-08-22',
        fornecedor_nome: 'Siderúrgica Paulo & Cia Ltda',
        fornecedor_cnpj: '12.345.678/0001-99',
        fornecedor_contato: 'Carlos — (15) 99123-4455',
        forma_pagamento: 'Boleto Bancário 28 DDL',
        justificativa: 'Armação das vigas e pilares do pavimento térreo conforme cronograma da 2ª etapa Caixa.',
        valor_total: 13800,
        itens: [
          { id: 'it_1', descricao: 'Barra de Aço CA-50 10.0mm (3/8") 12m', unidade: 'barra', quantidade: 120, valor_unitario: 65.00, subtotal: 7800.00 },
          { id: 'it_2', descricao: 'Barra de Aço CA-50 8.0mm (5/16") 12m', unidade: 'barra', quantidade: 80, valor_unitario: 45.00, subtotal: 3600.00 },
          { id: 'it_3', descricao: 'Malha de Aço Soldada Q-138 (2,45 x 6,00m)', unidade: 'un', quantidade: 12, valor_unitario: 200.00, subtotal: 2400.00 }
        ],
        created_at: '2026-08-15T14:20:00Z',
        _demo: true
      },
      {
        id: 'pc_002',
        numero_ordem: 'PC-2026-0002',
        obra_id: 'cli_001',
        descricao: 'Madeiramento Estrutural e Caibros para Cobertura',
        categoria: 'material',
        prioridade: 'normal',
        status: 'aprovada',
        solicitante_nome: 'Eng. Ricardo Almeida',
        solicitante_id: 'u2',
        data_solicitacao: '2026-08-10',
        data_necessidade: '2026-08-18',
        fornecedor_nome: 'Madeireira Central Ltda',
        fornecedor_cnpj: '67.890.123/0001-45',
        fornecedor_contato: 'Roberto — (15) 99888-7766',
        forma_pagamento: 'Boleto Bancário 30 DDL',
        justificativa: 'Montagem do vigamento do telhado antes do período de chuvas.',
        aprovado_por: 'Administrador',
        aprovado_em: '2026-08-11T14:30:00Z',
        parecer_admin: 'Aprovado conforme cotação vencedora. Verificar conferência na entrega no canteiro.',
        valor_total: 9450,
        itens: [
          { id: 'it_1', descricao: 'Viga de Madeira Cambará 6x12cm 5m', unidade: 'un', quantidade: 25, valor_unitario: 180.00, subtotal: 4500.00 },
          { id: 'it_2', descricao: 'Caibro Cambará 5x5cm 4m', unidade: 'un', quantidade: 60, valor_unitario: 45.00, subtotal: 2700.00 },
          { id: 'it_3', descricao: 'Ripas de Madeira 2x5cm 3m', unidade: 'dz', quantidade: 15, valor_unitario: 150.00, subtotal: 2250.00 }
        ],
        created_at: '2026-08-10T09:15:00Z',
        _demo: true
      },
      {
        id: 'pc_003',
        numero_ordem: 'PC-2026-0003',
        obra_id: 'cli_002',
        descricao: 'Locação de Retroescavadeira com Operador',
        categoria: 'equipamento',
        prioridade: 'urgente',
        status: 'rejeitada',
        solicitante_nome: 'Eng. Fernanda Costa',
        solicitante_id: 'u2',
        data_solicitacao: '2026-08-12',
        data_necessidade: '2026-08-14',
        fornecedor_nome: 'Terraplan Terraplanagem ME',
        fornecedor_cnpj: '34.567.890/0001-12',
        fornecedor_contato: 'Marcos — (19) 99345-6789',
        forma_pagamento: 'Pix à Vista',
        justificativa: 'Abertura urgente de valas para rede de esgoto e águas pluviais.',
        rejeitado_por: 'Administrador',
        rejeitado_em: '2026-08-13T09:15:00Z',
        motivo_recusa: 'Valor da hora da máquina 35% acima da tabela SINAPI. Apresentar pelo menos mais 2 orçamentos de empresas locais da região de Campinas antes de reavaliar.',
        valor_total: 4800,
        itens: [
          { id: 'it_1', descricao: 'Diária Retroescavadeira com Operador e Combustível (8h)', unidade: 'dia', quantidade: 3, valor_unitario: 1600.00, subtotal: 4800.00 }
        ],
        created_at: '2026-08-12T16:00:00Z',
        _demo: true
      },
      {
        id: 'pc_004',
        numero_ordem: 'PC-2026-0004',
        obra_id: 'cli_001',
        descricao: 'Cimento Portland CP-II e Argamassa AC-III',
        categoria: 'material',
        prioridade: 'alta',
        status: 'convertida',
        solicitante_nome: 'Eng. Ricardo Almeida',
        solicitante_id: 'u2',
        data_solicitacao: '2026-08-01',
        data_necessidade: '2026-08-05',
        fornecedor_nome: 'Votorantim Cimentos S.A.',
        fornecedor_cnpj: '01.234.567/0001-88',
        fornecedor_contato: 'Juliana — (15) 3211-9000',
        forma_pagamento: 'Boleto Bancário 15 DDL',
        justificativa: 'Concretagem das vigas baldrame e contrapiso inicial.',
        aprovado_por: 'Administrador',
        aprovado_em: '2026-08-02T11:00:00Z',
        parecer_admin: 'Aprovado com desconto à vista via boleto bancário.',
        lancamento_id: 'l026',
        valor_total: 3850,
        itens: [
          { id: 'it_1', descricao: 'Cimento Portland CP-II-E-32 Saco 50kg', unidade: 'sc', quantidade: 70, valor_unitario: 38.00, subtotal: 2660.00 },
          { id: 'it_2', descricao: 'Argamassa Colante AC-III Saco 20kg', unidade: 'sc', quantidade: 34, valor_unitario: 35.00, subtotal: 1190.00 }
        ],
        created_at: '2026-08-01T10:30:00Z',
        _demo: true
      }
    ];
    const pcd = this.getAll('precompras');
    if (!pcd.length) {
      precompras.forEach(p => pcd.push(p));
      this.save('precompras', pcd);
    }

    // ── SEED FORNECEDORES DEMO ──
    const fornDemoData = [
      { id:'forn_001', cnpj:'12345678000190', razao_social:'Materiais Para Construção XYZ Ltda', nome_fantasia:'XYZ Materiais', categoria:'material', email:'vendas@xyzmateriais.com.br', telefone:'(15) 3222-1234', endereco:'Av. Industrial, 1500', numero:'1500', bairro:'Distrito Industrial', municipio:'Sorocaba', uf:'SP', cep:'18087-000', contato_nome:'Ricardo Santos', contato_cargo:'Vendedor', prazo_pagamento:28, observacoes:'Fornecedor principal de materiais em Sorocaba', ativo:true, created_at:new Date().toISOString(), _demo:true },
      { id:'forn_002', cnpj:'34567890000112', razao_social:'Empreiteira Lima & Filhos ME', nome_fantasia:'Lima Empreiteira', categoria:'mao_de_obra', email:'contato@limaempreiteira.com.br', telefone:'(15) 99812-5678', endereco:'Rua Trabalhadores, 230', numero:'230', bairro:'Jd. Operário', municipio:'Sorocaba', uf:'SP', cep:'18040-200', contato_nome:'João Lima', contato_cargo:'Sócio / Responsável', prazo_pagamento:15, observacoes:'Equipe de pedreiros e serventes de confiança', ativo:true, created_at:new Date().toISOString(), _demo:true },
      { id:'forn_003', cnpj:'78901234000156', razao_social:'Elétrica Silva ME', nome_fantasia:'Silva Elétrica', categoria:'servico', email:'eletricasilva@email.com', telefone:'(15) 99934-8765', endereco:'Rua Volta Redonda, 45', numero:'45', bairro:'Centro', municipio:'Sorocaba', uf:'SP', cep:'18010-050', contato_nome:'Carlos Silva', contato_cargo:'Eletricista Responsável', prazo_pagamento:30, observacoes:'Instalações elétricas residenciais e comerciais', ativo:true, created_at:new Date().toISOString(), _demo:true },
      { id:'forn_004', cnpj:'67890123000145', razao_social:'Madeireira Central Ltda', nome_fantasia:'Madeireira Central', categoria:'material', email:'pedidos@madeireiracentral.com.br', telefone:'(15) 3211-9900', endereco:'Rod. Raposo Tavares, Km 105', numero:'Km 105', bairro:'Zona Rural', municipio:'Sorocaba', uf:'SP', cep:'18052-000', contato_nome:'Marcos Oliveira', contato_cargo:'Gerente Comercial', prazo_pagamento:21, observacoes:'Madeiras, esquadrias e compensados', ativo:true, created_at:new Date().toISOString(), _demo:true },
      { id:'forn_005', cnpj:'99887766000155', razao_social:'Meta Contabilidade & Consultoria S/S', nome_fantasia:'Meta Contabilidade', categoria:'contabilidade', email:'meta@metacontabil.com.br', telefone:'(15) 3215-4400', endereco:'Rua XV de Novembro, 890', numero:'890', bairro:'Centro', municipio:'Sorocaba', uf:'SP', cep:'18015-100', contato_nome:'Dra. Ana Paula Ramos', contato_cargo:'Sócia Administradora', prazo_pagamento:30, observacoes:'Contabilidade fiscal e trabalhista da empresa', ativo:true, created_at:new Date().toISOString(), _demo:true }
    ];
    const fd = this.getAll('fornecedores');
    if (!fd.length) {
      fornDemoData.forEach(f => fd.push(f));
      this.save('fornecedores', fd);
    }

    localStorage.setItem(this._ck('finobra_demo_v2'), 'true');
    this.seedSinapiDemo();
    console.log('[FinObra] ✅ Dados de demonstração carregados!');
  },

  // ── SEED BASES & ORÇAMENTOS SINAPI ──
  seedSinapiDemo(force = false) {
    const composicoesDemo = [
      { codigo:'98458', descricao:'ALVENARIA DE VEDAÇÃO DE BLOCOS CERÂMICOS FURADOS NA HORIZONTAL DE 9X19X19 CM (ESPESSURA DA PAREDE 9 CM) E ARGAMASSA DE ASSENTAMENTO COM PREPARO EM BETONEIRA. AF_12/2021', unidade:'M2', custo_total:68.50, desonerado:false },
      { codigo:'93358', descricao:'REVESTIMENTO CERÂMICO PARA PISO COM PLACAS TIPO ESMALTADA EXTRA DE DIMENSÕES 45X45 CM APLICADA EM AMBIENTES DE ÁREA MAIOR QUE 10 M2. AF_06/2014', unidade:'M2', custo_total:54.20, desonerado:false },
      { codigo:'94962', descricao:'CONCRETO FCK = 25MPA, TRAÇO 1:2,3:2,7 (EM MASSA SECA DE CIMENTO/ AREIA MÉDIA/ BRITA 1) - PREPARO MECÂNICO COM BETONEIRA 400 L. AF_05/2021', unidade:'M3', custo_total:485.00, desonerado:false },
      { codigo:'96536', descricao:'REGISTRO DE PRESSÃO BRUTO, LATÃO, ROSCÁVEL, 3/4", INSTALADO EM RESERVAÇÃO DE ÁGUA DE EDIFICAÇÃO. AF_08/2021', unidade:'UN', custo_total:62.30, desonerado:false },
      { codigo:'92817', descricao:'CORTE E DOBRA DE AÇO CA-50, D = 10,0 MM, UTILIZADO EM ESTRUTURAS DIVERSAS. AF_12/2015', unidade:'KG', custo_total:14.80, desonerado:false },
      { codigo:'94441', descricao:'TELHAMENTO COM TELHA CERÂMICA TIPO PORTUGUESA, COM ATÉ 2 ÁGUAS, INCLUSO TRANSPORTE VERTICAL. AF_07/2019', unidade:'M2', custo_total:88.40, desonerado:false },
      { codigo:'88489', descricao:'PINTURA COM TINTA LÁTEX ACRÍLICA EM PAREDES, DUAS DEMÃOS, APLICAÇÃO MANUAL. AF_06/2014', unidade:'M2', custo_total:22.60, desonerado:false },
      { codigo:'91953', descricao:'INTERRUPTOR SIMPLES (1 MÓDULO), 10A/250V, INCLUINDO SUPORTE E PLACA. AF_12/2015', unidade:'UN', custo_total:28.90, desonerado:false },
      { codigo:'97914', descricao:'TUBO PVC, SÉRIE NORMAL, ESGOTO PREDIAL, DN 100 MM, FORNECIDO E INSTALADO EM RAMAL DE DESCARGA. AF_12/2014', unidade:'M', custo_total:38.50, desonerado:false },
      { codigo:'98504', descricao:'PLANTIO DE GRAMA ESMERALDA EM PLACAS. AF_05/2018', unidade:'M2', custo_total:18.20, desonerado:false },
      { codigo:'101567', descricao:'PORTA DE MADEIRA PARA PINTURA, SEMI-OCA (LEVE OU MÉDIA), 80X210CM, ESPESSURA DE 3,5CM, INCLUSO DOBRADIÇAS E FECHADURA. AF_12/2019', unidade:'UN', custo_total:420.00, desonerado:false },
      { codigo:'95241', descricao:'LASTRO DE CONCRETO MAGRO, APLICADO EM PISOS OU RADIERS, ESPESSURA DE 5 CM. AF_07/2016', unidade:'M2', custo_total:36.70, desonerado:false },
      { codigo:'93208', descricao:'EXECUÇÃO DE PISO EM CONCRETO NÃO ARMADO, ESPESSURA 7CM, ACABAMENTO LISO. AF_09/2020', unidade:'M2', custo_total:58.90, desonerado:false },
      { codigo:'89985', descricao:'JANELA DE ALUMÍNIO DE CORRER 2 FOLHAS COM VIDRO, 120X120CM, INCLUSO CONTRAMARCO E ALIZARES. AF_07/2016', unidade:'UN', custo_total:510.00, desonerado:false }
    ];

    if (force || !localStorage.getItem('sinapi_base_onerado')) {
      localStorage.setItem('sinapi_base_onerado', JSON.stringify({
        uf: 'RR',
        referencia: '2026-07',
        desonerado: false,
        importada_em: new Date().toISOString(),
        composicoes: composicoesDemo
      }));
    }

    if (force || !localStorage.getItem('sinapi_base_desonerado')) {
      const composicoesDesoneradas = composicoesDemo.map(c => ({
        ...c,
        custo_total: parseFloat((c.custo_total * 0.93).toFixed(2)),
        desonerado: true
      }));
      localStorage.setItem('sinapi_base_desonerado', JSON.stringify({
        uf: 'RR',
        referencia: '2026-07',
        desonerado: true,
        importada_em: new Date().toISOString(),
        composicoes: composicoesDesoneradas
      }));
    }

    const orcamentosSinapiDemo = [
      {
        id: 'sinapi_orc_001',
        obra_id: 'cli_001',
        nome: 'Orçamento SINAPI Base — Residência Térrea 120m² (João Ferreira)',
        uf: 'RR',
        referencia_sinapi: '2026-07',
        bdi: 24.23,
        bdi_percentual: 24.23,
        desonerado: false,
        status: 'aprovado',
        descricao: 'Orçamento referencial SINAPI detalhado para financiamento Caixa Econômica Federal — Casa Térrea 120m² com 3 quartos e garagem.',
        data_criacao: '2026-01-10',
        itens: [
          { id:'it_101', codigo:'95241', codigo_sinapi:'95241', descricao:'LASTRO DE CONCRETO MAGRO, ESPESSURA DE 5 CM. AF_07/2016', unidade:'M2', quantidade:135, custo_unitario:36.70, preco_unitario:36.70, total:4954.50 },
          { id:'it_102', codigo:'94962', codigo_sinapi:'94962', descricao:'CONCRETO FCK = 25MPA COM BETONEIRA 400 L. AF_05/2021', unidade:'M3', quantidade:26, custo_unitario:485.00, preco_unitario:485.00, total:12610.00 },
          { id:'it_103', codigo:'92817', codigo_sinapi:'92817', descricao:'CORTE E DOBRA DE AÇO CA-50, D = 10,0 MM. AF_12/2015', unidade:'KG', quantidade:920, custo_unitario:14.80, preco_unitario:14.80, total:13616.00 },
          { id:'it_104', codigo:'98458', codigo_sinapi:'98458', descricao:'ALVENARIA DE VEDAÇÃO BLOCOS CERÂMICOS 9X19X19 CM. AF_12/2021', unidade:'M2', quantidade:260, custo_unitario:68.50, preco_unitario:68.50, total:17810.00 },
          { id:'it_105', codigo:'94441', codigo_sinapi:'94441', descricao:'TELHAMENTO COM TELHA CERÂMICA TIPO PORTUGUESA. AF_07/2019', unidade:'M2', quantidade:150, custo_unitario:88.40, preco_unitario:88.40, total:13260.00 },
          { id:'it_106', codigo:'93358', codigo_sinapi:'93358', descricao:'REVESTIMENTO CERÂMICO PARA PISO 45X45 CM. AF_06/2014', unidade:'M2', quantidade:115, custo_unitario:54.20, preco_unitario:54.20, total:6233.00 },
          { id:'it_107', codigo:'88489', codigo_sinapi:'88489', descricao:'PINTURA COM TINTA LÁTEX ACRÍLICA EM PAREDES 2 DEMÃOS. AF_06/2014', unidade:'M2', quantidade:520, custo_unitario:22.60, preco_unitario:22.60, total:11752.00 },
          { id:'it_108', codigo:'89985', codigo_sinapi:'89985', descricao:'JANELA DE ALUMÍNIO DE CORRER 2 FOLHAS COM VIDRO 120X120CM. AF_07/2016', unidade:'UN', quantidade:6, custo_unitario:510.00, preco_unitario:510.00, total:3060.00 },
          { id:'it_109', codigo:'101567', codigo_sinapi:'101567', descricao:'PORTA DE MADEIRA PARA PINTURA, SEMI-OCA 80X210CM COMPLETA. AF_12/2019', unidade:'UN', quantidade:7, custo_unitario:420.00, preco_unitario:420.00, total:2940.00 },
          { id:'it_110', codigo:'97914', codigo_sinapi:'97914', descricao:'TUBO PVC ESGOTO PREDIAL DN 100 MM. AF_12/2014', unidade:'M', quantidade:40, custo_unitario:38.50, preco_unitario:38.50, total:1540.00 }
        ],
        created_at: '2026-01-10T10:00:00Z',
        _demo: true
      },
      {
        id: 'sinapi_orc_002',
        obra_id: 'cli_002',
        nome: 'Orçamento SINAPI Caixa — Casa Geminada 90m² (Maria Santos)',
        uf: 'RR',
        referencia_sinapi: '2026-07',
        bdi: 24.23,
        bdi_percentual: 24.23,
        desonerado: true,
        status: 'em_andamento',
        descricao: 'Planilha SINAPI desonerada (Sem Oneração) para construção residencial padrão popular Caixa 90m².',
        data_criacao: '2026-02-15',
        itens: [
          { id:'it_201', codigo:'95241', codigo_sinapi:'95241', descricao:'LASTRO DE CONCRETO MAGRO, ESPESSURA DE 5 CM. AF_07/2016', unidade:'M2', quantidade:98, custo_unitario:34.13, preco_unitario:34.13, total:3344.74 },
          { id:'it_202', codigo:'94962', codigo_sinapi:'94962', descricao:'CONCRETO FCK = 25MPA COM BETONEIRA 400 L. AF_05/2021', unidade:'M3', quantidade:18, custo_unitario:451.05, preco_unitario:451.05, total:8118.90 },
          { id:'it_203', codigo:'92817', codigo_sinapi:'92817', descricao:'CORTE E DOBRA DE AÇO CA-50, D = 10,0 MM. AF_12/2015', unidade:'KG', quantidade:620, custo_unitario:13.76, preco_unitario:13.76, total:8531.20 },
          { id:'it_204', codigo:'98458', codigo_sinapi:'98458', descricao:'ALVENARIA DE VEDAÇÃO BLOCOS CERÂMICOS 9X19X19 CM. AF_12/2021', unidade:'M2', quantidade:190, custo_unitario:63.70, preco_unitario:63.70, total:12103.00 },
          { id:'it_205', codigo:'94441', codigo_sinapi:'94441', descricao:'TELHAMENTO COM TELHA CERÂMICA TIPO PORTUGUESA. AF_07/2019', unidade:'M2', quantidade:110, custo_unitario:82.21, preco_unitario:82.21, total:9043.10 },
          { id:'it_206', codigo:'93358', codigo_sinapi:'93358', descricao:'REVESTIMENTO CERÂMICO PARA PISO 45X45 CM. AF_06/2014', unidade:'M2', quantidade:85, custo_unitario:50.41, preco_unitario:50.41, total:4284.85 },
          { id:'it_207', codigo:'88489', codigo_sinapi:'88489', descricao:'PINTURA COM TINTA LÁTEX ACRÍLICA EM PAREDES 2 DEMÃOS. AF_06/2014', unidade:'M2', quantidade:380, custo_unitario:21.02, preco_unitario:21.02, total:7987.60 },
          { id:'it_208', codigo:'89985', codigo_sinapi:'89985', descricao:'JANELA DE ALUMÍNIO DE CORRER 2 FOLHAS COM VIDRO 120X120CM. AF_07/2016', unidade:'UN', quantidade:4, custo_unitario:474.30, preco_unitario:474.30, total:1897.20 }
        ],
        created_at: '2026-02-15T10:00:00Z',
        _demo: true
      },
      {
        id: 'sinapi_orc_003',
        obra_id: 'cli_003',
        nome: 'Orçamento SINAPI Executivo — Sobrado Alto Padrão 160m² (Roberto Lima)',
        uf: 'RR',
        referencia_sinapi: '2026-07',
        bdi: 24.23,
        bdi_percentual: 24.23,
        desonerado: false,
        status: 'aprovado',
        descricao: 'Orçamento SINAPI completo com oneração para sobrado residencial de 2 pavimentos 160m², incluindo estrutura armada e acabamentos.',
        data_criacao: '2025-06-01',
        itens: [
          { id:'it_301', codigo:'95241', codigo_sinapi:'95241', descricao:'LASTRO DE CONCRETO MAGRO, ESPESSURA DE 5 CM. AF_07/2016', unidade:'M2', quantidade:180, custo_unitario:36.70, preco_unitario:36.70, total:6606.00 },
          { id:'it_302', codigo:'94962', codigo_sinapi:'94962', descricao:'CONCRETO FCK = 25MPA COM BETONEIRA 400 L. AF_05/2021', unidade:'M3', quantidade:45, custo_unitario:485.00, preco_unitario:485.00, total:21825.00 },
          { id:'it_303', codigo:'92817', codigo_sinapi:'92817', descricao:'CORTE E DOBRA DE AÇO CA-50, D = 10,0 MM. AF_12/2015', unidade:'KG', quantidade:1850, custo_unitario:14.80, preco_unitario:14.80, total:27380.00 },
          { id:'it_304', codigo:'98458', codigo_sinapi:'98458', descricao:'ALVENARIA DE VEDAÇÃO BLOCOS CERÂMICOS 9X19X19 CM. AF_12/2021', unidade:'M2', quantidade:390, custo_unitario:68.50, preco_unitario:68.50, total:26715.00 },
          { id:'it_305', codigo:'94441', codigo_sinapi:'94441', descricao:'TELHAMENTO COM TELHA CERÂMICA TIPO PORTUGUESA. AF_07/2019', unidade:'M2', quantidade:195, custo_unitario:88.40, preco_unitario:88.40, total:17238.00 },
          { id:'it_306', codigo:'93358', codigo_sinapi:'93358', descricao:'REVESTIMENTO CERÂMICO PARA PISO 45X45 CM. AF_06/2014', unidade:'M2', quantidade:160, custo_unitario:54.20, preco_unitario:54.20, total:8672.00 },
          { id:'it_307', codigo:'88489', codigo_sinapi:'88489', descricao:'PINTURA COM TINTA LÁTEX ACRÍLICA EM PAREDES 2 DEMÃOS. AF_06/2014', unidade:'M2', quantidade:720, custo_unitario:22.60, preco_unitario:22.60, total:16272.00 },
          { id:'it_308', codigo:'89985', codigo_sinapi:'89985', descricao:'JANELA DE ALUMÍNIO DE CORRER 2 FOLHAS COM VIDRO 120X120CM. AF_07/2016', unidade:'UN', quantidade:10, custo_unitario:510.00, preco_unitario:510.00, total:5100.00 },
          { id:'it_309', codigo:'101567', codigo_sinapi:'101567', descricao:'PORTA DE MADEIRA PARA PINTURA, SEMI-OCA 80X210CM COMPLETA. AF_12/2019', unidade:'UN', quantidade:11, custo_unitario:420.00, preco_unitario:420.00, total:4620.00 },
          { id:'it_310', codigo:'98504', codigo_sinapi:'98504', descricao:'PLANTIO DE GRAMA ESMERALDA EM PLACAS. AF_05/2018', unidade:'M2', quantidade:120, custo_unitario:18.20, preco_unitario:18.20, total:2184.00 }
        ],
        created_at: '2025-06-01T10:00:00Z',
        _demo: true
      }
    ];

    if (force || this.isDemoLoaded()) {
      const currentSinapiOrcs = JSON.parse(localStorage.getItem('orcamentos_sinapi') || '[]');
      if (force || !currentSinapiOrcs.length) {
        localStorage.setItem('orcamentos_sinapi', JSON.stringify(orcamentosSinapiDemo));
      }
    }
  }
};
