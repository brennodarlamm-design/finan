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
            const { data_base64, base64_data, base64, conteudo_base64, ...rest } = d;
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
      const toDate = d => (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(d) : (d ? String(d).split('T')[0] : '');
      if (Array.isArray(lans) && lans.length > 0) {
        const cleaned = lans.map(l => ({
          ...l,
          data: toDate(l.data) || Utils.today(),
          data_vencimento: toDate(l.data_vencimento) || toDate(l.data) || Utils.today(),
          data_pagamento: toDate(l.data_pagamento) || null,
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
            data_emissao: toDate(n.data_emissao) || Utils.today(),
            data_vencimento: toDate(n.data_vencimento) || null,
            data_pagamento: toDate(n.data_pagamento) || null,
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
      if (Array.isArray(d.documentos) && d.documentos.length > 0 && typeof Documentos !== 'undefined') {
        const locais = Documentos.getAll() || [];
        const localMap = new Map(locais.map(x => [x.id, x]));
        const merged = d.documentos.map(cloudDoc => {
          const loc = localMap.get(cloudDoc.id);
          return {
            id: cloudDoc.id,
            entidade_tipo: cloudDoc.tipo,
            entidade_id: cloudDoc.referencia_id,
            titulo: cloudDoc.titulo,
            nome_arquivo: cloudDoc.nome_arquivo,
            tipo_mime: cloudDoc.tipo_arquivo,
            tamanho: cloudDoc.tamanho_bytes,
            criado_em: cloudDoc.created_at,
            data_base64: loc?.data_base64 || loc?.base64_data || cloudDoc.base64_data || null
          };
        });
        locais.forEach(l => {
          if (!merged.some(m => m.id === l.id)) merged.push(l);
        });
        Documentos.salvarLista(merged);
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
    if (typeof DBDemo !== 'undefined') DBDemo.refreshVencimentos();
  },

  seedDemoData(force = false) {
    if (typeof DBDemo !== 'undefined') {
      DBDemo.seed(this, force);
    }
  },

  seedSinapiDemo(force = false) {
    if (typeof DBDemo !== 'undefined') {
      DBDemo.seedSinapi(force);
    }
  }
};
