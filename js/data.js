// js/data.js — Data Layer with LocalStorage + Multi-Tenant Scoping & Demo Data

const DB = {
  K: {
    clientes: 'finobra_clientes', lancamentos: 'finobra_lancamentos',
    notas: 'finobra_notas', orcamentos: 'finobra_orcamentos',
    medicoes: 'finobra_medicoes', ofximports: 'finobra_ofximports',
    contas: 'finobra_contas', precompras: 'finobra_precompras',
    fornecedores: 'finobra_fornecedores', contratos: 'finobra_contratos'
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

    const session = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const nomeEmp = session?.empresaNome || 'Minha Empresa';
    return {
      id: t,
      razao_social: nomeEmp,
      nome_fantasia: nomeEmp,
      cnpj: '', telefone: '', whatsapp: '', email: '', cidade: '', uf: '', endereco: '',
      responsavel: session?.nome || '', crea_cau: '', logo_url: '', configurada: false
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
    try {
      localStorage.setItem(`finobra_${t}_empresa`, JSON.stringify(updated));
    } catch (e) {
      console.warn(`[Storage] Erro ao salvar dados da empresa ${t}:`, e);
      if (this.purgeStorage) this.purgeStorage();
      try {
        localStorage.setItem(`finobra_${t}_empresa`, JSON.stringify(updated));
      } catch (e2) {
        console.error(`[Storage] Falha crítica ao persistir dados da empresa:`, e2);
      }
    }
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

  canWriteLocal(action = 'write') {
    const role = String((typeof Auth !== 'undefined' && Auth.getUser && Auth.getUser()?.perfil) || 'visualizador').toLowerCase();
    if (['admin','superadmin','gestor'].includes(role)) return true;
    if (role === 'operador') return action !== 'delete';
    return false;
  },

  _denyLocal(action = 'write') {
    const msg = action === 'delete' ? 'Seu perfil não permite excluir registros.' : 'Seu perfil é somente leitura e não permite alterar dados.';
    if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(msg, 'warning');
    return null;
  },

  add(key, item) {
    if (!this.canWriteLocal('write')) return this._denyLocal('write');
    const data = this.getAll(key);
    item.id = item.id || this.uuid();
    item.created_at = item.created_at || new Date().toISOString();
    data.push(item);
    this.save(key, data);
    this.syncToCloud('save', key, item);
    return item;
  },
  update(key, id, updates) {
    if (!this.canWriteLocal('write')) return this._denyLocal('write');
    const data = this.getAll(key);
    const idx = data.findIndex(i => i.id === id);
    if (idx === -1) return null;
    data[idx] = { ...data[idx], ...updates, updated_at: new Date().toISOString() };
    this.save(key, data);
    this.syncToCloud('save', key, data[idx]);
    return data[idx];
  },
  remove(key, id) {
    if (!this.canWriteLocal('delete')) return this._denyLocal('delete');
    this.save(key, this.getAll(key).filter(i => i.id !== id));
    this.syncToCloud('delete', key, null, id);
    return true;
  },
  uuid() { return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substr(2, 9)); },

  // ── FASES DE DOCUMENTAÇÃO DAS OBRAS ──
  _fasesDocKey(obraId) {
    return `${this._ck('finobra_fases_doc')}_${obraId}`;
  },

  getDocFases(obraId) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this._fasesDocKey(obraId)) || '{}'); } catch {}
    const template = (typeof FasesDoc !== 'undefined') ? FasesDoc.TEMPLATE : { pre_obra: [], durante_obra: [], pos_obra: [] };
    const result = {};
    for (const [fk, docs] of Object.entries(template)) {
      result[fk] = docs.map(tmpl => {
        const ex = (saved[fk] || []).find(d => d.id === tmpl.id) || {};
        return {
          id: tmpl.id, icone: tmpl.icone, nome: tmpl.nome, desc: tmpl.desc,
          status: ex.status || 'nao_iniciado',
          responsavel: ex.responsavel || '',
          data_obtencao: ex.data_obtencao || null,
          data_validade: ex.data_validade || null,
          orgao_emissor: ex.orgao_emissor || '',
          protocolo: ex.protocolo || '',
          observacoes: ex.observacoes || '',
          arquivos: ex.arquivos || [],
          updated_at: ex.updated_at || null,
        };
      });
    }
    return result;
  },

  saveDocFase(obraId, docId, dados) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this._fasesDocKey(obraId)) || '{}'); } catch {}
    const template = (typeof FasesDoc !== 'undefined') ? FasesDoc.TEMPLATE : {};
    let faseKey = null;
    for (const [fk, docs] of Object.entries(template)) {
      if (docs.find(d => d.id === docId)) { faseKey = fk; break; }
    }
    if (!faseKey) return;
    if (!saved[faseKey]) saved[faseKey] = [];
    const idx = saved[faseKey].findIndex(d => d.id === docId);
    const existing = idx >= 0 ? saved[faseKey][idx] : {};
    const updated = { ...existing, id: docId, ...dados, updated_at: new Date().toISOString() };
    if (idx >= 0) saved[faseKey][idx] = updated;
    else saved[faseKey].push(updated);
    localStorage.setItem(this._fasesDocKey(obraId), JSON.stringify(saved));
  },

  attachArquivoDocFase(obraId, docId, arquivoId) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this._fasesDocKey(obraId)) || '{}'); } catch {}
    const template = (typeof FasesDoc !== 'undefined') ? FasesDoc.TEMPLATE : {};
    let faseKey = null;
    for (const [fk, docs] of Object.entries(template)) {
      if (docs.find(d => d.id === docId)) { faseKey = fk; break; }
    }
    if (!faseKey) return;
    if (!saved[faseKey]) saved[faseKey] = [];
    const idx = saved[faseKey].findIndex(d => d.id === docId);
    if (idx >= 0) {
      if (!saved[faseKey][idx].arquivos) saved[faseKey][idx].arquivos = [];
      if (!saved[faseKey][idx].arquivos.includes(arquivoId)) saved[faseKey][idx].arquivos.push(arquivoId);
    } else {
      saved[faseKey].push({ id: docId, status: 'nao_iniciado', arquivos: [arquivoId] });
    }
    localStorage.setItem(this._fasesDocKey(obraId), JSON.stringify(saved));
  },

  removeArquivoDocFase(obraId, docId, arquivoId) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this._fasesDocKey(obraId)) || '{}'); } catch {}
    for (const fk of Object.keys(saved)) {
      const idx = (saved[fk] || []).findIndex(d => d.id === docId);
      if (idx >= 0 && saved[fk][idx].arquivos) {
        saved[fk][idx].arquivos = saved[fk][idx].arquivos.filter(id => id !== arquivoId);
        localStorage.setItem(this._fasesDocKey(obraId), JSON.stringify(saved));
        return;
      }
    }
  },

  getDocFasesResumo(obraId) {
    const fases = this.getDocFases(obraId);
    let total = 0, ok = 0, pendentes = 0, vencidos = 0;
    Object.values(fases).forEach(fase => {
      fase.forEach(d => {
        if (d.status === 'nao_aplicavel') return;
        total++;
        if (d.status === 'ok') ok++;
        else if (d.status === 'vencido') vencidos++;
        else if (d.status === 'em_andamento') pendentes++;
      });
    });
    return { total, ok, pendentes, vencidos, pct: total > 0 ? Math.round((ok/total)*100) : 0 };
  },


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
  _apiHeaders() {
    let token = '';
    if (typeof Auth !== 'undefined' && Auth.getToken) {
      token = Auth.getToken();
    }
    if (!token && typeof localStorage !== 'undefined') {
      token = localStorage.getItem('finobra_token') || sessionStorage.getItem('finobra_token');
    }
    if (token && typeof token === 'string' && token.includes('.')) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload.exp && Date.now() > payload.exp) {
            token = '';
          }
        }
      } catch (e) {}
    }
    const tenantId = (typeof Auth !== 'undefined' && Auth.getCurrentTenantId) ? Auth.getCurrentTenantId() : 'angelim';
    const headers = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },


  _emitSyncStatus(status, detail = {}) {
    if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent('finobra:sync-status', {
        detail: { status, pending: this.getSyncPendingCount ? this.getSyncPendingCount() : 0, ...detail }
      }));
    } catch {}
  },

  async _fetchCloudPage(table, limit = 400, offset = 0) {
    const params = new URLSearchParams({ table, limit: String(limit), offset: String(offset) });
    const res = await fetch(`/api/db?${params.toString()}`, { headers: this._apiHeaders() });
    if (res.status === 401 || res.status === 403) {
      if (typeof Auth !== 'undefined' && Auth.handleSessionExpired) Auth.handleSessionExpired();
      throw new Error('SESSION_EXPIRED');
    }
    if (!res.ok) throw new Error(`Falha ao sincronizar ${table}: HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) throw new Error(`Resposta inválida ao sincronizar ${table}`);
    return json;
  },

  async _fetchCloudTablePaged(table, limit = 400) {
    const items = [];
    let offset = 0;
    for (let page = 0; page < 250; page++) {
      const json = await this._fetchCloudPage(table, limit, offset);
      items.push(...json.data);
      const meta = json.pagination;
      if (!meta || !meta.hasMore || json.data.length === 0) break;
      offset = Number(meta.nextOffset ?? (offset + json.data.length));
    }
    return items;
  },

  async _fetchCloudSnapshot() {
    let usePaged = false;
    try {
      const manifestRes = await fetch('/api/db?table=sync_manifest', { headers: this._apiHeaders() });
      if (manifestRes.ok) {
        const manifest = await manifestRes.json();
        const c = manifest.counts || {};
        usePaged = Number(manifest.total || 0) > 2500
          || Number(c.lancamentos || 0) > 1200
          || Number(c.notas || 0) > 800
          || Number(c.documentos || 0) > 800
          || Number(c.orcamentos || 0) > 800
          || Number(c.medicoes || 0) > 800
          || Number(c.precompras || 0) > 800
          || Number(c.contratos || 0) > 500
          || Number(c.recibos || 0) > 800;
      }
    } catch (e) {
      console.warn('[Sync] Manifesto indisponível; usando sincronização compatível:', e?.message || e);
    }

    if (!usePaged) {
      const res = await fetch('/api/db?table=all', { headers: this._apiHeaders() });
      if (res.status === 401 || res.status === 403) {
        if (typeof Auth !== 'undefined' && Auth.handleSessionExpired) Auth.handleSessionExpired();
        throw new Error('SESSION_EXPIRED');
      }
      if (!res.ok) throw new Error(`Falha no snapshot: HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success || !json.data) throw new Error('Snapshot da nuvem inválido');
      return json.data;
    }

    console.info('[Sync] Base grande detectada. Usando sincronização paginada.');
    const [clientes, fornecedores, lancamentos, notas, orcamentos, medicoes, documentos, produtos, contas, precompras, contratos, recibos] = await Promise.all([
      this._fetchCloudTablePaged('clientes'),
      this._fetchCloudTablePaged('fornecedores'),
      this._fetchCloudTablePaged('lancamentos'),
      this._fetchCloudTablePaged('notas'),
      this._fetchCloudTablePaged('orcamentos'),
      this._fetchCloudTablePaged('medicoes'),
      this._fetchCloudTablePaged('documentos'),
      this._fetchCloudTablePaged('produtos'),
      this._fetchCloudTablePaged('contas'),
      this._fetchCloudTablePaged('precompras'),
      this._fetchCloudTablePaged('contratos'),
      this._fetchCloudTablePaged('recibos')
    ]);
    return { clientes, fornecedores, lancamentos, notas, orcamentos, medicoes, documentos, produtos, contas, precompras, contratos, recibos };
  },

  _coreCloudBootstrapKey() {
    return `finobra_${this._t()}_patch05_core_cloud_bootstrap`;
  },

  isCoreCloudBootstrapped() {
    try { return localStorage.getItem(this._coreCloudBootstrapKey()) === '1'; } catch { return false; }
  },

  async bootstrapCoreCloud() {
    if (this.isCoreCloudBootstrapped()) return true;
    if (!this.canWriteLocal('write')) return false;
    const payload = {
      precompras: this.getAll('precompras'),
      contratos: this.getAll('contratos'),
      recibos: (() => { try { return JSON.parse(localStorage.getItem(this._ck('finobra_recibos')) || '[]'); } catch { return []; } })()
    };
    const total = Object.values(payload).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
    if (!total) {
      try { localStorage.setItem(this._coreCloudBootstrapKey(), '1'); } catch {}
      return true;
    }
    try {
      const bulkBody = JSON.stringify({ action: 'sync_all', payload });
      // Vercel limita o corpo das funções. Assinaturas desenhadas podem deixar contratos grandes;
      // acima de ~1,5 MB migra registro a registro para evitar falha por tamanho do payload.
      if (bulkBody.length <= 1_500_000) {
        const res = await fetch('/api/db', { method: 'POST', headers: this._apiHeaders(), body: bulkBody });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      } else {
        const entries = [];
        for (const [table, items] of Object.entries(payload)) {
          for (const item of (Array.isArray(items) ? items : [])) entries.push({ table, item });
        }
        const concurrency = 4;
        for (let i = 0; i < entries.length; i += concurrency) {
          const batch = entries.slice(i, i + concurrency);
          await Promise.all(batch.map(async ({ table, item }) => {
            const res = await fetch('/api/db', {
              method: 'POST', headers: this._apiHeaders(),
              body: JSON.stringify({ action: 'save', table, data: item })
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) throw new Error(json.error || `${table}: HTTP ${res.status}`);
          }));
        }
      }
      try { localStorage.setItem(this._coreCloudBootstrapKey(), '1'); } catch {}
      console.info(`[Patch 05] ${total} registro(s) locais migrados para a nuvem.`);
      return true;
    } catch (err) {
      console.warn('[Patch 05] Migração inicial para nuvem adiada:', err?.message || err);
      return false;
    }
  },

  async syncFromCloud() {
    this._emitSyncStatus('syncing');
    try {
      const d = await this._fetchCloudSnapshot();
      if (Array.isArray(d.clientes)) {
        this.save('clientes', d.clientes.map(o => ({
          ...o,
          data_inicio: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(o.data_inicio) : (o.data_inicio ? String(o.data_inicio).split('T')[0] : o.data_inicio),
          data_previsao: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(o.data_previsao) : (o.data_previsao ? String(o.data_previsao).split('T')[0] : o.data_previsao)
        })));
      }
      if (Array.isArray(d.fornecedores)) {
        this.save('fornecedores', d.fornecedores);
      }
      if (Array.isArray(d.lancamentos)) {
        this.save('lancamentos', d.lancamentos.map(l => ({
          ...l,
          data: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(l.data) || l.data : (l.data ? String(l.data).split('T')[0] : l.data),
          data_vencimento: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(l.data_vencimento) || Utils.cleanDate(l.data) || l.data : (l.data_vencimento ? String(l.data_vencimento).split('T')[0] : l.data),
          data_pagamento: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(l.data_pagamento) || null : (l.data_pagamento ? String(l.data_pagamento).split('T')[0] : null),
          valor: Number(l.valor) || 0
        })));
      }
      if (Array.isArray(d.notas)) {
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
      if (Array.isArray(d.orcamentos)) {
        this.save('orcamentos', d.orcamentos);
      }
      if (Array.isArray(d.medicoes)) {
        this.save('medicoes', d.medicoes.map(m => ({
          ...m,
          data: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(m.data) || m.data : (m.data ? String(m.data).split('T')[0] : m.data),
          valor_medido: Number(m.valor_medido) || 0
        })));
      }
      if (Array.isArray(d.contas)) {
        this.save('contas', d.contas);
      }
      if (Array.isArray(d.produtos)) {
        this.save('produtos', d.produtos);
      }
      const coreBootstrapped = this.isCoreCloudBootstrapped();
      const mergeLegacy = (cloud, local) => {
        const map = new Map();
        (Array.isArray(cloud) ? cloud : []).forEach(x => x?.id && map.set(String(x.id), x));
        // Enquanto a migração inicial não terminou, o registro local vence no mesmo ID.
        // Isso preserva edições legadas que ainda não chegaram ao servidor.
        (Array.isArray(local) ? local : []).forEach(x => x?.id && map.set(String(x.id), x));
        return Array.from(map.values());
      };
      if (Array.isArray(d.precompras)) {
        const local = this.getAll('precompras');
        this.save('precompras', !coreBootstrapped && local.length ? mergeLegacy(d.precompras, local) : d.precompras);
      }
      if (Array.isArray(d.contratos)) {
        const local = this.getAll('contratos');
        this.save('contratos', !coreBootstrapped && local.length ? mergeLegacy(d.contratos, local) : d.contratos);
      }
      if (Array.isArray(d.recibos)) {
        let local = [];
        try { local = JSON.parse(localStorage.getItem(this._ck('finobra_recibos')) || '[]'); } catch {}
        const next = !coreBootstrapped && local.length ? mergeLegacy(d.recibos, local) : d.recibos;
        try { localStorage.setItem(this._ck('finobra_recibos'), JSON.stringify(next)); } catch (e) { console.warn('[Sync] Falha ao salvar recibos em cache:', e); }
      }
      if (Array.isArray(d.documentos) && typeof Documentos !== 'undefined') {
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
            url: cloudDoc.url || loc?.url || null,
            data_base64: loc?.data_base64 || loc?.base64_data || cloudDoc.base64_data || null
          };
        });
        locais.forEach(l => {
          const syncKey = 'finobra_cloud_uploaded_' + l.id;
          const pendenteUpload = typeof localStorage !== 'undefined' && !localStorage.getItem(syncKey);
          if (pendenteUpload && !merged.some(m => m.id === l.id)) {
            merged.push(l);
          }
        });
        Documentos.salvarLista(merged);
      }

      if (Array.isArray(d.produtos) && d.produtos.length > 0) {
        const locais = this.getAll('produtos') || [];
        const localMap = new Map(locais.map(p => [p.id, p]));
        d.produtos.forEach(cp => {
          localMap.set(cp.id, { ...(localMap.get(cp.id) || {}), ...cp });
        });
        this.save('produtos', Array.from(localMap.values()));
      }

      if (Array.isArray(d.contas) && d.contas.length > 0) {
        this.save('contas', d.contas);
      }

      // Mantém dados cadastrais da empresa sincronizados com o tenant real do servidor.
      try {
        const tenantRes = await fetch('/api/tenant', { headers: this._apiHeaders() });
        const tenantJson = await tenantRes.json().catch(() => ({}));
        if (tenantRes.ok && tenantJson.success && tenantJson.tenant) {
          this.saveEmpresa({
            ...tenantJson.tenant,
            whatsapp: (tenantJson.tenant.telefone || '').replace(/\D/g, ''),
            configurada: true
          });
        }
      } catch (tenantErr) {
        console.warn('[Tenant] Não foi possível atualizar os dados cadastrais:', tenantErr);
      }

      console.log('✅ Dados sincronizados com Neon PostgreSQL!');
      this._emitSyncStatus('synced');
      return true;
    } catch (e) {
      console.warn('Neon Cloud Sync offline, usando cache local:', e);
      this._emitSyncStatus('offline', { error: e?.message || 'offline' });
      return false;
    }
  },

  _syncQueueKey() {
    return `finobra_${this._t()}_sync_queue`;
  },

  _getSyncQueue() {
    try { return JSON.parse(localStorage.getItem(this._syncQueueKey()) || '[]'); } catch { return []; }
  },

  _saveSyncQueue(queue) {
    try { localStorage.setItem(this._syncQueueKey(), JSON.stringify(queue)); } catch (e) { console.warn('[Sync] Falha ao persistir fila:', e); }
  },

  getSyncPendingCount() {
    return this._getSyncQueue().length;
  },

  _scheduleSyncRetry(delay = 10000) {
    clearTimeout(this._syncRetryTimer);
    this._syncRetryTimer = setTimeout(() => this._flushCloudQueue(), delay);
    if (!this._syncOnlineBound && typeof window !== 'undefined') {
      this._syncOnlineBound = true;
      window.addEventListener('online', () => this._flushCloudQueue());
    }
  },

  async _flushCloudQueue() {
    if (this._syncFlushing) return;
    this._syncFlushing = true;
    try {
      let queue = this._getSyncQueue();
      while (queue.length) {
        const item = queue[0];
        let res;
        try {
          res = await fetch('/api/db', {
            method: 'POST',
            headers: this._apiHeaders(),
            body: JSON.stringify(item.payload)
          });
        } catch {
          this._scheduleSyncRetry(10000);
          break;
        }

        const errorJson = !res.ok ? await res.clone().json().catch(() => ({})) : {};
        if (res.status === 401 || (res.status === 403 && !String(errorJson.code || '').startsWith('ROLE_') && !String(errorJson.code || '').startsWith('PLAN_'))) {
          if (typeof Auth !== 'undefined' && Auth.handleSessionExpired) Auth.handleSessionExpired();
          break;
        }
        if (!res.ok) {
          if (String(errorJson.code || '').startsWith('ROLE_')) {
            console.warn(`[Sync] Operação rejeitada pelo perfil: ${errorJson.error || errorJson.code}`);
            queue.shift();
            this._saveSyncQueue(queue);
            this._emitSyncStatus(queue.length ? 'pending' : 'synced', { rejected: true, code: errorJson.code });
            if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(errorJson.error || 'Seu perfil não permite esta operação.', 'warning');
            continue;
          }
          if (String(errorJson.code || '').startsWith('PLAN_')) {
            console.warn(`[Sync] Operação rejeitada pelo plano: ${errorJson.error || errorJson.code}`);
            queue.shift();
            this._saveSyncQueue(queue);
            this._emitSyncStatus(queue.length ? 'pending' : 'synced', { rejected: true, code: errorJson.code });
            if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(errorJson.error || 'Operação não permitida pelo plano atual.', 'warning');
            continue;
          }
          console.warn(`[Sync] Servidor recusou ${item.payload.action}/${item.payload.table}. Tentará novamente.`);
          this._scheduleSyncRetry(15000);
          break;
        }

        queue.shift();
        this._saveSyncQueue(queue);
        this._emitSyncStatus(queue.length ? 'pending' : 'synced');
      }
    } finally {
      this._syncFlushing = false;
    }
  },

  syncToCloud(action, table, data, id) {
    const cloudTables = ['lancamentos', 'notas', 'notas_fiscais', 'obras', 'clientes', 'fornecedores', 'documentos', 'produtos', 'ocr_historico', 'contas', 'contas_bancarias', 'precompras', 'contratos', 'recibos'];
    if (!cloudTables.includes(table)) return;
    const payload = { action, table, data, id };
    const queue = this._getSyncQueue();
    queue.push({
      queueId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
      createdAt: new Date().toISOString(),
      payload
    });
    this._saveSyncQueue(queue);
    this._emitSyncStatus('pending');
    this._flushCloudQueue();
  },

  async syncAllToCloud() {
    try {
      const payload = {
        clientes: this.getAll('clientes'),
        fornecedores: this.getAll('fornecedores'),
        lancamentos: this.getAll('lancamentos'),
        notas: this.getAll('notas'),
        contas: this.getAll('contas'),
        precompras: this.getAll('precompras'),
        contratos: this.getAll('contratos'),
        recibos: (() => { try { return JSON.parse(localStorage.getItem(this._ck('finobra_recibos')) || '[]'); } catch { return []; } })()
      };
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: this._apiHeaders(),
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
    this.expurgarDadosDemo();
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
    const ctKey = this._ck('finobra_contratos');
    if (localStorage.getItem(ctKey) === null) {
      localStorage.setItem(ctKey, '[]');
    }
    const sinapiKey = this._ck('orcamentos_sinapi');
    if (localStorage.getItem(sinapiKey) === null) {
      localStorage.setItem(sinapiKey, '[]');
    }
  },

  // ── Expurgar permanentemente dados fictícios de demonstração ──────────────
  expurgarDadosDemo() {
    try {
      // 1. Remove flags de demo do localStorage
      localStorage.removeItem(this._ck('finobra_demo_v2'));
      localStorage.removeItem(this._ck('finobra_demo'));
      localStorage.removeItem('sinapi_base_onerado');
      localStorage.setItem(this._ck('finobra_clean_mode'), 'true');

      // 2. Limpa lançamentos demo
      const demoLansIds = new Set(['l001','l002','l003','l004','l010','l011','l012','l013','l014','l015','l016','l017','l018','l021','l022','l023','l024','l025','l026','l027']);
      const demoObrasIds = new Set(['cli_001', 'cli_002', 'cli_003']);

      const lans = this.getAll('lancamentos') || [];
      const lansFiltrados = lans.filter(l => {
        if (l._demo) return false;
        if (demoLansIds.has(l.id)) return false;
        if (typeof l.id === 'string' && (l.id.startsWith('l_adm') || l.id.startsWith('l0'))) return false;
        if (demoObrasIds.has(l.obra_id)) return false;
        return true;
      });
      if (lansFiltrados.length !== lans.length) {
        this.save('lancamentos', lansFiltrados);
      }

      // 3. Limpa obras demo
      const obras = this.getAll('clientes') || [];
      const obrasFiltradas = obras.filter(o => {
        if (o._demo) return false;
        if (demoObrasIds.has(o.id)) return false;
        if (['João Carlos Ferreira', 'Maria Aparecida Santos', 'Roberto Silva Lima'].includes(o.nome)) return false;
        return true;
      });
      if (obrasFiltradas.length !== obras.length) {
        this.save('clientes', obrasFiltradas);
      }

      // 4. Limpa notas fiscais demo
      const notas = this.getAll('notas') || [];
      const notasFiltradas = notas.filter(n => {
        if (n._demo) return false;
        if (typeof n.id === 'string' && n.id.startsWith('nf_0')) return false;
        if (demoObrasIds.has(n.obra_id)) return false;
        return true;
      });
      if (notasFiltradas.length !== notas.length) {
        this.save('notas', notasFiltradas);
      }

      // 5. Limpa documentos demo
      const docsKey = this._ck('finobra_documentos');
      let docs = [];
      try { docs = JSON.parse(localStorage.getItem(docsKey) || '[]'); } catch {}
      const docsFiltrados = docs.filter(d => {
        if (d._demo) return false;
        if (typeof d.id === 'string' && d.id.startsWith('doc_demo_')) return false;
        if (typeof d.referencia_id === 'string' && (d.referencia_id.startsWith('l0') || d.referencia_id.startsWith('l_adm'))) return false;
        return true;
      });
      if (docsFiltrados.length !== docs.length) {
        localStorage.setItem(docsKey, JSON.stringify(docsFiltrados));
      }

      // 6. Limpa medições demo
      const med = this.getAll('medicoes') || [];
      const medFiltradas = med.filter(m => !m._demo && !['med_001','med_002','med_003'].includes(m.id) && !demoObrasIds.has(m.obra_id));
      if (medFiltradas.length !== med.length) {
        this.save('medicoes', medFiltradas);
      }

      // 7. Limpa fornecedores demo
      const forn = this.getAll('fornecedores') || [];
      const fornFiltrados = forn.filter(f => !f._demo && !(typeof f.id === 'string' && f.id.startsWith('forn_0')));
      if (fornFiltrados.length !== forn.length) {
        this.save('fornecedores', fornFiltrados);
      }
    } catch (err) {
      console.warn('[DB] Erro ao expurgar dados demo:', err);
    }
  },

  isDemoLoaded() {
    return false;
  },

  clearAllData() {
    Object.keys(this.K).forEach(k => {
      this.save(k, []);
    });
    localStorage.setItem(this._ck('finobra_documentos'), '[]');
    localStorage.setItem(this._ck('finobra_recibos'), '[]');
    localStorage.setItem(this._ck('finobra_contratos'), '[]');
    localStorage.setItem(this._ck('orcamentos_sinapi'), '[]');
    localStorage.setItem(this._k('fornecedores'), '[]');
    localStorage.removeItem(this._ck('finobra_demo_v2'));
    localStorage.setItem(this._ck('finobra_clean_mode'), 'true');
    console.log('[FinObra] 🧹 Todos os dados foram limpos com sucesso. Pronto para novos cadastros!');
  },

  clearDemo() {
    this.expurgarDadosDemo();
  },

  _fmtDateAdd(days = 0) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  },

  refreshDemoVencimentos() {},
  seedDemoData() {},
  seedSinapiDemo() {}
};
