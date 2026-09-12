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
    return (typeof Auth !== 'undefined' && Auth.getCurrentTenantId) ? Auth.getCurrentTenantId() : 'public';
  },

  _k(key) {
    const t = this._t();
    return `finobra_${t}_${key}`;
  },

  _ck(name) {
    const t = this._t();
    return `${name}_${t}`;
  },

  _migrateLegacyTenantCache() {
    // Patch 11: migração automática de chaves globais foi encerrada. A nuvem é a
    // fonte oficial e nenhum tenant é presumido como dono de caches sem escopo.
    return;
  },


  // Preferências do tenant: cache local isolado + persistência no Neon.
  _preferencesLocalSnapshot() {
    const readJson = (key) => {
      try { return JSON.parse(localStorage.getItem(this._ck(key)) || '[]'); } catch { return []; }
    };
    return {
      categorias_fornecedor: readJson('finobra_categorias_custom'),
      categorias_despesa: readJson('finobra_cats_despesa_custom'),
      whatsapp_telefone: String(localStorage.getItem(this._ck('finobra_whatsapp_telefone')) || ''),
      whatsapp_modo: String(localStorage.getItem(this._ck('finobra_whatsapp_modo')) || 'api')
    };
  },

  _applyTenantPreferences(preferences = {}) {
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return;
    const writeJson = (key, value) => {
      if (!Array.isArray(value)) return;
      try { localStorage.setItem(this._ck(key), JSON.stringify(value)); } catch {}
    };
    if ('categorias_fornecedor' in preferences) writeJson('finobra_categorias_custom', preferences.categorias_fornecedor);
    if ('categorias_despesa' in preferences) writeJson('finobra_cats_despesa_custom', preferences.categorias_despesa);
    if ('whatsapp_telefone' in preferences) {
      try { localStorage.setItem(this._ck('finobra_whatsapp_telefone'), String(preferences.whatsapp_telefone || '').replace(/\D/g, '')); } catch {}
    }
    if ('whatsapp_modo' in preferences) {
      const modo = ['api','web'].includes(String(preferences.whatsapp_modo)) ? String(preferences.whatsapp_modo) : 'api';
      try { localStorage.setItem(this._ck('finobra_whatsapp_modo'), modo); } catch {}
    }
  },

  saveTenantPreferences(patch = {}) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return false;
    this._applyTenantPreferences(patch);
    this.syncToCloud('save', 'preferencias', { preferences: patch });
    return true;
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

  _moduleForKey(key) {
    const map = {
      clientes:'obras', obras:'obras', lancamentos:'financeiro', fornecedores:'fornecedores', produtos:'produtos',
      precompras:'precompras', recibos:'recibos', contratos:'contratos', notas:'notas', notas_fiscais:'notas', ocr_historico:'notas',
      orcamentos:'orcamentos', orcamentos_sinapi:'orcamentos', medicoes:'medicoes', documentos:'documentos', documento_conteudo:'documentos',
      doc_fases:'documentos', contas:'contas', contas_bancarias:'contas', preferencias:'configuracoes'
    };
    return map[String(key || '').trim()] || null;
  },

  canWriteLocal(action = 'write', key = null) {
    const role = String((typeof Auth !== 'undefined' && Auth.getUser && Auth.getUser()?.perfil) || 'visualizador').toLowerCase();
    let base = false;
    if (['admin','superadmin','gestor'].includes(role)) base = true;
    else if (role === 'operador') base = action !== 'delete';
    if (!base) return false;
    const module = this._moduleForKey(key);
    if (module && typeof Auth !== 'undefined' && typeof Auth.canModule === 'function') return Auth.canModule(module, action);
    return true;
  },

  _denyLocal(action = 'write') {
    const msg = action === 'delete' ? 'Seu perfil não permite excluir registros.' : 'Seu perfil é somente leitura e não permite alterar dados.';
    if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(msg, 'warning');
    return null;
  },

  add(key, item) {
    if (!this.canWriteLocal('write', key)) return this._denyLocal('write');
    const data = this.getAll(key);
    item.id = item.id || this.uuid();
    item.created_at = item.created_at || new Date().toISOString();
    data.push(item);
    this.save(key, data);
    this.syncToCloud('save', key, item);
    return item;
  },
  update(key, id, updates) {
    if (!this.canWriteLocal('write', key)) return this._denyLocal('write');
    const data = this.getAll(key);
    const idx = data.findIndex(i => i.id === id);
    if (idx === -1) return null;
    data[idx] = { ...data[idx], ...updates, updated_at: new Date().toISOString() };
    this.save(key, data);
    this.syncToCloud('save', key, data[idx]);
    return data[idx];
  },
  remove(key, id) {
    if (!this.canWriteLocal('delete', key)) return this._denyLocal('delete');
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

  _syncDocFaseRecord(obraId, faseKey, doc) {
    if (!obraId || !faseKey || !doc?.id) return;
    this.syncToCloud('save', 'doc_fases', {
      ...doc,
      cloud_id: this._docPhaseCloudId(obraId, doc.id),
      obra_id: obraId,
      doc_id: doc.id,
      fase_key: faseKey
    });
  },

  saveDocFase(obraId, docId, dados) {
    if (!this.canWriteLocal('write', 'doc_fases')) return this._denyLocal('write');
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
    this._syncDocFaseRecord(obraId, faseKey, updated);
  },

  attachArquivoDocFase(obraId, docId, arquivoId) {
    if (!this.canWriteLocal('write', 'doc_fases')) return this._denyLocal('write');
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
    const current = (saved[faseKey] || []).find(d => d.id === docId);
    if (current) this._syncDocFaseRecord(obraId, faseKey, current);
  },

  removeArquivoDocFase(obraId, docId, arquivoId) {
    if (!this.canWriteLocal('write', 'doc_fases')) return this._denyLocal('write');
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this._fasesDocKey(obraId)) || '{}'); } catch {}
    for (const fk of Object.keys(saved)) {
      const idx = (saved[fk] || []).findIndex(d => d.id === docId);
      if (idx >= 0 && saved[fk][idx].arquivos) {
        saved[fk][idx].arquivos = saved[fk][idx].arquivos.filter(id => id !== arquivoId);
        saved[fk][idx].updated_at = new Date().toISOString();
        localStorage.setItem(this._fasesDocKey(obraId), JSON.stringify(saved));
        this._syncDocFaseRecord(obraId, fk, saved[fk][idx]);
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
    // Cookie HttpOnly é a única credencial do navegador. x-tenant-id é apenas
    // contexto; o backend nunca permite que um usuário comum troque de tenant.
    const tenantId = (typeof Auth !== 'undefined' && Auth.getCurrentTenantId) ? Auth.getCurrentTenantId() : 'public';
    const headers = { 'Content-Type': 'application/json' };
    if (tenantId && tenantId !== 'public') headers['x-tenant-id'] = tenantId;
    return headers;
  },


  _emitSyncStatus(status, detail = {}) {
    if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent('finobra:sync-status', {
        detail: { status, pending: this.getSyncPendingCount ? this.getSyncPendingCount() : 0, failed: this.getSyncFailedCount ? this.getSyncFailedCount() : 0, ...detail }
      }));
    } catch {}
  },

  async _fetchCloudPage(table, limit = 400, offset = 0) {
    const params = new URLSearchParams({ table, limit: String(limit), offset: String(offset) });
    const res = await fetch(`/api/db?${params.toString()}`, { headers: this._apiHeaders() });
    if (res.status === 401) {
      if (typeof Auth !== 'undefined' && Auth.handleSessionExpired) Auth.handleSessionExpired();
      throw new Error('SESSION_EXPIRED');
    }
    if (res.status === 403) {
      const errJson = await res.clone().json().catch(() => ({}));
      console.warn(`[Sync] Permissão de leitura negada para ${table}:`, errJson.error || errJson.message || '403 Forbidden');
      return { success: true, data: [], pagination: { hasMore: false }, forbidden: true };
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
          || Number(c.recibos || 0) > 800
          || Number(c.orcamentos_sinapi || 0) > 500
          || Number(c.doc_fases || 0) > 1000;
      }
    } catch (e) {
      console.warn('[Sync] Manifesto indisponível; usando sincronização compatível:', e?.message || e);
    }

    if (!usePaged) {
      const res = await fetch('/api/db?table=all', { headers: this._apiHeaders() });
      if (res.status === 401) {
        if (typeof Auth !== 'undefined' && Auth.handleSessionExpired) Auth.handleSessionExpired();
        throw new Error('SESSION_EXPIRED');
      }
      if (res.status === 403) {
        const errJson = await res.clone().json().catch(() => ({}));
        console.warn('[Sync] Permissão negada no snapshot total, tentando modo seguro:', errJson.error || '403 Forbidden');
        return { clientes: [], fornecedores: [], lancamentos: [], notas: [], orcamentos: [], medicoes: [], documentos: [], produtos: [], contas: [], precompras: [], contratos: [], recibos: [], orcamentos_sinapi: [], doc_fases: [], preferencias: {} };
      }
      if (!res.ok) throw new Error(`Falha no snapshot: HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success || !json.data) throw new Error('Snapshot da nuvem inválido');
      return json.data;
    }

    console.info('[Sync] Base grande detectada. Usando sincronização paginada.');
    const [clientes, fornecedores, lancamentos, notas, orcamentos, medicoes, documentos, produtos, contas, precompras, contratos, recibos, orcamentos_sinapi, doc_fases, prefResp] = await Promise.all([
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
      this._fetchCloudTablePaged('recibos'),
      this._fetchCloudTablePaged('orcamentos_sinapi'),
      this._fetchCloudTablePaged('doc_fases'),
      fetch('/api/db?table=preferencias', { headers:this._apiHeaders() }).then(async r => {
        if (!r.ok) throw new Error(`Falha ao sincronizar preferencias: HTTP ${r.status}`);
        return r.json();
      })
    ]);
    return {
      clientes, fornecedores, lancamentos, notas, orcamentos, medicoes, documentos, produtos, contas,
      precompras, contratos, recibos, orcamentos_sinapi, doc_fases,
      preferencias: prefResp?.data || {}
    };
  },

  _cloudCompletenessBootstrapKey() {
    return `finobra_${this._t()}_patch07_cloud_completeness_bootstrap`;
  },

  isCloudCompletenessBootstrapped() {
    try { return localStorage.getItem(this._cloudCompletenessBootstrapKey()) === '1'; } catch { return false; }
  },

  _docPhaseCloudId(obraId, docId) {
    const clean = (value, max) => String(value || '').replace(/[^A-Za-z0-9_.:@-]+/g, '_').slice(0, max);
    return `${clean(obraId, 90)}:${clean(docId, 80)}`.slice(0, 180);
  },

  _collectLocalDocPhases() {
    const out = [];
    for (const obra of (this.getAll('clientes') || [])) {
      if (!obra?.id) continue;
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(this._fasesDocKey(obra.id)) || '{}'); } catch {}
      for (const [faseKey, docs] of Object.entries(saved || {})) {
        for (const doc of (Array.isArray(docs) ? docs : [])) {
          if (!doc?.id) continue;
          out.push({
            ...doc,
            cloud_id: this._docPhaseCloudId(obra.id, doc.id),
            obra_id: obra.id,
            doc_id: doc.id,
            fase_key: faseKey
          });
        }
      }
    }
    return out;
  },

  _localSinapiForCurrentTenant() {
    const scopedKey = this._ck('orcamentos_sinapi');
    let scoped = [];
    try { scoped = JSON.parse(localStorage.getItem(scopedKey) || '[]'); } catch {}
    if (Array.isArray(scoped) && scoped.length) return scoped;

    // Antes do Patch 07 o módulo SINAPI usava uma chave global. Para outro tenant,
    // importa somente orçamentos cuja obra pertence claramente ao tenant atual.
    if (scopedKey !== 'orcamentos_sinapi') {
      let legacy = [];
      try { legacy = JSON.parse(localStorage.getItem('orcamentos_sinapi') || '[]'); } catch {}
      const obraIds = new Set((this.getAll('clientes') || []).map(o => String(o?.id || '')).filter(Boolean));
      const filtered = (Array.isArray(legacy) ? legacy : []).filter(o => obraIds.has(String(o?.obra_id || '')));
      if (filtered.length) {
        try { localStorage.setItem(scopedKey, JSON.stringify(filtered)); } catch {}
      }
      return filtered;
    }
    return Array.isArray(scoped) ? scoped : [];
  },

  async bootstrapCloudCompleteness() {
    if (this.isCloudCompletenessBootstrapped()) return true;
    if (!this.canWriteLocal('write')) return false;

    const payload = {
      orcamentos_sinapi: this._localSinapiForCurrentTenant(),
      doc_fases: this._collectLocalDocPhases(),
      preferencias: this._preferencesLocalSnapshot()
    };
    for (const key of Object.keys(payload)) {
      const module = this._moduleForKey(key);
      if (module && typeof Auth !== 'undefined' && !Auth.canModule(module,'write')) payload[key] = key === 'preferencias' ? {} : [];
    }
    const meaningfulPrefs = Object.values(payload.preferencias || {}).some(v => Array.isArray(v) ? v.length > 0 : Boolean(v && v !== 'api'));
    const total = payload.orcamentos_sinapi.length + payload.doc_fases.length + (meaningfulPrefs ? 1 : 0);
    if (!total) {
      try { localStorage.setItem(this._cloudCompletenessBootstrapKey(), '1'); } catch {}
      return true;
    }

    try {
      const body = JSON.stringify({ action:'sync_all', payload });
      if (body.length <= 1_500_000) {
        const res = await fetch('/api/db', { method:'POST', headers:this._apiHeaders(), body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      } else {
        const entries = [
          ...payload.orcamentos_sinapi.map(item => ({ table:'orcamentos_sinapi', item })),
          ...payload.doc_fases.map(item => ({ table:'doc_fases', item }))
        ];
        for (let i = 0; i < entries.length; i += 4) {
          await Promise.all(entries.slice(i, i + 4).map(async ({ table, item }) => {
            const res = await fetch('/api/db', { method:'POST', headers:this._apiHeaders(), body:JSON.stringify({ action:'save', table, data:item }) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) throw new Error(json.error || `${table}: HTTP ${res.status}`);
          }));
        }
        if (meaningfulPrefs) {
          const res = await fetch('/api/db', { method:'POST', headers:this._apiHeaders(), body:JSON.stringify({ action:'save', table:'preferencias', data:{ preferences:payload.preferencias } }) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json.success) throw new Error(json.error || `preferencias: HTTP ${res.status}`);
        }
      }
      try { localStorage.setItem(this._cloudCompletenessBootstrapKey(), '1'); } catch {}
      console.info(`[Patch 07] ${total} conjunto(s)/registro(s) locais migrados para a nuvem.`);
      return true;
    } catch (err) {
      console.warn('[Patch 07] Migração complementar para nuvem adiada:', err?.message || err);
      return false;
    }
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
    for (const key of Object.keys(payload)) {
      const module = this._moduleForKey(key);
      if (module && typeof Auth !== 'undefined' && !Auth.canModule(module,'write')) payload[key] = [];
    }
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
      const coreBootstrapped = this.isCoreCloudBootstrapped();
      const mergeLegacy = (cloud, local) => {
        const map = new Map();
        (Array.isArray(cloud) ? cloud : []).forEach(x => x?.id && map.set(String(x.id), x));
        // Preserva edições legadas/offline que ainda não subiram ao servidor
        (Array.isArray(local) ? local : []).forEach(x => x?.id && map.set(String(x.id), { ...(map.get(String(x.id)) || {}), ...x }));
        return Array.from(map.values());
      };

      if (Array.isArray(d.orcamentos)) {
        const local = this.getAll('orcamentos') || [];
        const mappedCloud = d.orcamentos.map(o => ({
          ...o,
          nome: o.nome || o.titulo || 'Orçamento',
          titulo: o.titulo || o.nome || 'Orçamento',
          status: o.status || 'ativo',
          descricao: o.descricao || '',
          data_criacao: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(o.data_criacao) || o.data_criacao : (o.data_criacao ? String(o.data_criacao).split('T')[0] : o.data_criacao),
          valor_total: Number(o.valor_total !== undefined ? o.valor_total : o.valor_total_previsto) || 0,
          valor_total_previsto: Number(o.valor_total_previsto !== undefined ? o.valor_total_previsto : o.valor_total) || 0,
          etapas: Array.isArray(o.etapas) ? o.etapas : (Array.isArray(o.itens) ? o.itens : []),
          itens: Array.isArray(o.itens) ? o.itens : (Array.isArray(o.etapas) ? o.etapas : []),
          categorias: Array.isArray(o.categorias) ? o.categorias : []
        }));
        const next = (!coreBootstrapped && local.length) ? mergeLegacy(mappedCloud, local) : mappedCloud;
        this.save('orcamentos', next);
      }
      if (Array.isArray(d.medicoes)) {
        const local = this.getAll('medicoes') || [];
        const mappedCloud = d.medicoes.map(m => ({
          ...m,
          data: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(m.data) || m.data : (m.data ? String(m.data).split('T')[0] : m.data),
          valor_medido: Number(m.valor_medido !== undefined ? m.valor_medido : m.valor_solicitado) || 0
        }));
        const next = (!coreBootstrapped && local.length) ? mergeLegacy(mappedCloud, local) : mappedCloud;
        this.save('medicoes', next);
      }
      if (Array.isArray(d.contas)) {
        this.save('contas', d.contas);
      }
      if (Array.isArray(d.produtos)) {
        this.save('produtos', d.produtos);
      }
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

      const completenessBootstrapped = this.isCloudCompletenessBootstrapped ? this.isCloudCompletenessBootstrapped() : true;
      if (Array.isArray(d.orcamentos_sinapi)) {
        const local = this._localSinapiForCurrentTenant ? this._localSinapiForCurrentTenant() : [];
        const next = !completenessBootstrapped && local.length ? mergeLegacy(d.orcamentos_sinapi, local) : d.orcamentos_sinapi;
        try { localStorage.setItem(this._ck('orcamentos_sinapi'), JSON.stringify(next)); } catch (e) { console.warn('[Sync] Falha ao salvar orçamentos SINAPI em cache:', e); }
      }

      if (Array.isArray(d.doc_fases)) {
        const cloudByObra = new Map();
        for (const row of d.doc_fases) {
          const obraId = String(row?.obra_id || '');
          const faseKey = String(row?.fase_key || '');
          const docId = String(row?.doc_id || row?.id || '');
          if (!obraId || !faseKey || !docId) continue;
          if (!cloudByObra.has(obraId)) cloudByObra.set(obraId, {});
          const grouped = cloudByObra.get(obraId);
          if (!Array.isArray(grouped[faseKey])) grouped[faseKey] = [];
          grouped[faseKey].push({ ...row, id:docId });
        }
        for (const obra of (this.getAll('clientes') || [])) {
          if (!obra?.id) continue;
          const key = this._fasesDocKey(obra.id);
          const cloud = cloudByObra.get(String(obra.id)) || {};
          let next = cloud;
          if (!completenessBootstrapped) {
            let local = {};
            try { local = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
            next = { ...cloud };
            for (const [faseKey, docs] of Object.entries(local || {})) {
              const map = new Map((Array.isArray(cloud[faseKey]) ? cloud[faseKey] : []).map(x => [String(x.id), x]));
              (Array.isArray(docs) ? docs : []).forEach(x => x?.id && map.set(String(x.id), x));
              next[faseKey] = Array.from(map.values());
            }
          }
          try { localStorage.setItem(key, JSON.stringify(next)); } catch (e) { console.warn('[Sync] Falha ao salvar fases documentais:', e); }
        }
      }

      if (d.preferencias && typeof d.preferencias === 'object' && !Array.isArray(d.preferencias)) {
        const localPrefs = this._preferencesLocalSnapshot ? this._preferencesLocalSnapshot() : {};
        const nextPrefs = completenessBootstrapped ? d.preferencias : { ...d.preferencias, ...localPrefs };
        this._applyTenantPreferences(nextPrefs);
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
          const syncKey = this._ck('finobra_cloud_uploaded_' + l.id);
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

  _syncFailedKey() {
    return `finobra_${this._t()}_sync_attention`;
  },

  _getSyncFailed() {
    try {
      const list = JSON.parse(localStorage.getItem(this._syncFailedKey()) || '[]');
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  },

  _saveSyncFailed(items) {
    try { localStorage.setItem(this._syncFailedKey(), JSON.stringify(Array.isArray(items) ? items.slice(-200) : [])); } catch {}
  },

  getSyncFailedCount() {
    return this._getSyncFailed().length;
  },

  getSyncFailedItems(limit = 50) {
    const max = Math.max(1, Math.min(200, Number(limit) || 50));
    return this._getSyncFailed().slice(-max).reverse().map(item => ({
      table: String(item?.payload?.table || 'registro'),
      action: String(item?.payload?.action || 'sync'),
      entityId: String(item?.payload?.id || item?.payload?.data?.cloud_id || item?.payload?.data?.id || ''),
      retries: Number(item?._retries || 0),
      lastError: String(item?.lastError || 'Falha de sincronização'),
      errorCode: String(item?.errorCode || ''),
      httpStatus: item?.httpStatus || null,
      attentionAt: item?.attentionAt || item?.updatedAt || item?.createdAt || ''
    }));
  },

  _updateQueuedItem(item, patch = {}) {
    const live = this._getSyncQueue();
    const idx = live.findIndex(q => q?.queueId === item?.queueId);
    if (idx < 0) return false;
    live[idx] = { ...live[idx], ...patch, updatedAt: live[idx].updatedAt || new Date().toISOString() };
    this._saveSyncQueue(live);
    Object.assign(item, live[idx]);
    return true;
  },

  _moveSyncItemToAttention(item, detail = {}) {
    const failed = this._getSyncFailed();
    const entityId = String(item?.payload?.id || item?.payload?.data?.cloud_id || item?.payload?.data?.id || '');
    const existing = failed.findIndex(x => x?.payload?.table === item?.payload?.table && x?.payload?.action === item?.payload?.action && String(x?.payload?.id || x?.payload?.data?.cloud_id || x?.payload?.data?.id || '') === entityId && entityId);
    const entry = {
      ...item,
      attentionAt: new Date().toISOString(),
      lastError: String(detail.error || item?.lastError || 'Falha de sincronização').slice(0, 500),
      errorCode: String(detail.code || item?.errorCode || '').slice(0, 100),
      httpStatus: Number(detail.status || item?.httpStatus || 0) || null
    };
    if (existing >= 0) failed[existing] = entry; else failed.push(entry);
    this._saveSyncFailed(failed);
    const pending = this._ackSyncQueueItem(item, { force:true });
    this._emitSyncStatus('attention', { pending, failed: failed.length });
    return failed.length;
  },

  retryFailedSyncItems() {
    const failed = this._getSyncFailed();
    if (!failed.length) return 0;
    const queue = this._getSyncQueue();
    for (const item of failed) {
      queue.push({
        ...item,
        queueId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
        _retries: 0,
        lastError: '', errorCode:'', httpStatus:null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }
    this._saveSyncFailed([]);
    this._saveSyncQueue(queue);
    this._emitSyncStatus('pending', { pending:queue.length, failed:0 });
    this._flushCloudQueue();
    return failed.length;
  },

  _scheduleSyncRetry(delay = 10000) {
    clearTimeout(this._syncRetryTimer);
    this._syncRetryTimer = setTimeout(() => this._flushCloudQueue(), delay);
    if (!this._syncOnlineBound && typeof window !== 'undefined') {
      this._syncOnlineBound = true;
      window.addEventListener('online', () => this._flushCloudQueue());
    }
  },

  _ackSyncQueueItem(item, { force = false } = {}) {
    const live = this._getSyncQueue();
    const idx = live.findIndex(q => q?.queueId === item?.queueId);
    if (idx < 0) return live.length;
    const expected = String(item?.updatedAt || item?.createdAt || '');
    const current = String(live[idx]?.updatedAt || live[idx]?.createdAt || '');
    // Se o registro foi editado novamente enquanto a requisição estava em voo,
    // mantém a versão nova na fila em vez de apagá-la junto com a confirmação antiga.
    if (!force && expected !== current) return live.length;
    live.splice(idx, 1);
    this._saveSyncQueue(live);
    return live.length;
  },

  async _flushCloudQueue() {
    if (this._syncFlushing) return;
    this._syncFlushing = true;
    try {
      while (true) {
        const queue = this._getSyncQueue();
        if (!queue.length) break;
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

        const responseJson = await res.clone().json().catch(() => ({}));
        const errorJson = responseJson || {};
        if (res.status === 401 || (res.status === 403 && !String(errorJson.code || '').startsWith('ROLE_') && !String(errorJson.code || '').startsWith('PLAN_'))) {
          if (typeof Auth !== 'undefined' && Auth.handleSessionExpired) Auth.handleSessionExpired();
          break;
        }

        // HTTP 2xx também pode representar sincronização parcial (207) ou payload
        // explicitamente marcado como partial/failed. Nunca confirmar silenciosamente.
        const partialFailure = !!errorJson.partial || (Array.isArray(errorJson.failed) && errorJson.failed.length > 0) || (res.ok && errorJson.success === false);
        if (!res.ok || partialFailure) {
          const code = String(errorJson.code || (partialFailure ? 'SYNC_PARTIAL' : `HTTP_${res.status}`));
          const message = String(errorJson.error || errorJson.message || (partialFailure ? 'Sincronização parcial; alguns registros não foram confirmados.' : `${item.payload?.action}/${item.payload?.table}`));

          // Erros de permissão/plano/validação não somem: ficam em "Requer atenção"
          // para auditoria e eventual retry após correção da causa.
          const permanent4xx = res.status >= 400 && res.status < 500 && ![408, 429].includes(res.status);
          if (partialFailure || permanent4xx || code.startsWith('ROLE_') || code.startsWith('PLAN_')) {
            if (code.startsWith('ROLE_')) console.warn(`[Sync] Operação rejeitada pelo perfil e movida para atenção: ${message}`);
            else if (code.startsWith('PLAN_')) console.warn(`[Sync] Operação rejeitada pelo plano e movida para atenção: ${message}`);
            else console.warn(`[Sync] Operação movida para atenção (${code}): ${message}`);
            this._moveSyncItemToAttention(item, { error:message, code, status:res.status });
            if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast(message, 'warning');
            continue;
          }

          const retries = Number(item._retries || 0) + 1;
          this._updateQueuedItem(item, { _retries:retries, lastError:message, errorCode:code, httpStatus:res.status, lastAttemptAt:new Date().toISOString() });
          if (retries >= 5) {
            console.error(`[Sync] Operação requer atenção após ${retries} falhas do servidor:`, message);
            this._moveSyncItemToAttention(item, { error:message, code:`${code}_MAX_RETRIES`, status:res.status });
            if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('Uma alteração não foi perdida, mas requer atenção para sincronizar.', 'warning');
            continue;
          }
          console.warn(`[Sync] Servidor recusou ${item.payload.action}/${item.payload.table}. Tentativa ${retries}/5.`);
          this._scheduleSyncRetry(res.status === 429 ? 30000 : 15000);
          break;
        }

        const pending = this._ackSyncQueueItem(item);
        this._emitSyncStatus(pending ? 'pending' : 'synced');
      }
    } finally {
      this._syncFlushing = false;
      if (this.getSyncPendingCount() > 0) this._scheduleSyncRetry(5000);
      else if (this.getSyncFailedCount() > 0) this._emitSyncStatus('attention', { failed:this.getSyncFailedCount() });
    }
  },

  syncToCloud(action, table, data, id) {
    const cloudTables = ['lancamentos', 'notas', 'notas_fiscais', 'obras', 'clientes', 'fornecedores', 'documentos', 'produtos', 'orcamentos', 'medicoes', 'ocr_historico', 'contas', 'contas_bancarias', 'precompras', 'contratos', 'recibos', 'orcamentos_sinapi', 'doc_fases', 'preferencias'];
    if (!cloudTables.includes(table)) return;
    const module = this._moduleForKey(table);
    if (module && typeof Auth !== 'undefined' && typeof Auth.canModule === 'function' && !Auth.canModule(module, action === 'delete' ? 'delete' : 'write')) return;
    const payload = { action, table, data, id };
    let queue = this._getSyncQueue();
    const entityId = String(id || data?.cloud_id || data?.id || (table === 'preferencias' ? '__tenant_preferences__' : '') || '');

    // Coalesce saves: enquanto offline, várias edições do mesmo registro viram apenas a versão mais recente.
    if (action === 'save' && entityId) {
      const idx = queue.findIndex(q => q?.payload?.action === 'save' && q?.payload?.table === table && String(q?.payload?.id || q?.payload?.data?.cloud_id || q?.payload?.data?.id || (table === 'preferencias' ? '__tenant_preferences__' : '')) === entityId);
      if (idx >= 0) {
        if (table === 'preferencias') {
          const prev = queue[idx].payload?.data?.preferences || {};
          payload.data = { preferences: { ...prev, ...(data?.preferences || {}) } };
        }
        queue[idx] = { ...queue[idx], updatedAt:new Date().toISOString(), payload };
      } else {
        queue.push({
          queueId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
          createdAt: new Date().toISOString(),
          payload
        });
      }
    } else {
      if (action === 'delete' && entityId) {
        queue = queue.filter(q => !(q?.payload?.table === table && String(q?.payload?.id || q?.payload?.data?.cloud_id || q?.payload?.data?.id || '') === entityId));
      }
      queue.push({
        queueId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
        createdAt: new Date().toISOString(),
        payload
      });
    }
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
        orcamentos: this.getAll('orcamentos'),
        medicoes: this.getAll('medicoes'),
        contas: this.getAll('contas'),
        precompras: this.getAll('precompras'),
        contratos: this.getAll('contratos'),
        recibos: (() => { try { return JSON.parse(localStorage.getItem(this._ck('finobra_recibos')) || '[]'); } catch { return []; } })(),
        orcamentos_sinapi: this._localSinapiForCurrentTenant ? this._localSinapiForCurrentTenant() : [],
        doc_fases: this._collectLocalDocPhases ? this._collectLocalDocPhases() : [],
        preferencias: this._preferencesLocalSnapshot ? this._preferencesLocalSnapshot() : {}
      };
      for (const key of Object.keys(payload)) {
        const module = this._moduleForKey(key);
        if (module && typeof Auth !== 'undefined' && !Auth.canModule(module,'write')) payload[key] = key === 'preferencias' ? {} : [];
      }
      const body = JSON.stringify({ action: 'sync_all', payload });
      if (body.length <= 1_500_000) {
        const res = await fetch('/api/db', { method:'POST', headers:this._apiHeaders(), body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false || json.partial || (Array.isArray(json.failed) && json.failed.length)) {
          return { success:false, partial:!!json.partial, synced:Number(json.synced||0), failed:json.failed || [], error:json.error || 'Sincronização parcial.' };
        }
        return json;
      }

      let synced = 0;
      const entries = [];
      for (const [table, items] of Object.entries(payload)) {
        if (table === 'preferencias') continue;
        for (const item of (Array.isArray(items) ? items : [])) entries.push({ table, item });
      }
      for (let i = 0; i < entries.length; i += 4) {
        const results = await Promise.all(entries.slice(i, i + 4).map(async ({ table, item }) => {
          const res = await fetch('/api/db', {
            method:'POST', headers:this._apiHeaders(),
            body:JSON.stringify({ action:'save', table, data:item })
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json.success) throw new Error(json.error || `${table}: HTTP ${res.status}`);
          return 1;
        }));
        synced += results.reduce((a,b) => a+b, 0);
      }
      if (payload.preferencias && typeof payload.preferencias === 'object') {
        const res = await fetch('/api/db', {
          method:'POST', headers:this._apiHeaders(),
          body:JSON.stringify({ action:'save', table:'preferencias', data:{ preferences:payload.preferencias } })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.error || `preferencias: HTTP ${res.status}`);
        synced++;
      }
      return { success:true, synced };
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
    this._migrateLegacyTenantCache();
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
      localStorage.removeItem('sinapi_base_desonerado');
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
