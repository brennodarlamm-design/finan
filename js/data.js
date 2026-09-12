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

  init() {
    this._bindNetworkListeners();
    this.expurgarDadosDemo();
    const pending = this.getSyncPendingCount ? this.getSyncPendingCount() : 0;
    const failed = this.getSyncFailedCount ? this.getSyncFailedCount() : 0;
    if (failed > 0) {
      this._emitSyncStatus('attention', { pending, failed });
    } else if (pending > 0) {
      this._emitSyncStatus('pending', { pending, failed: 0 });
    } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this._emitSyncStatus('offline');
    } else {
      this._emitSyncStatus('cached');
    }
  },

  _bindNetworkListeners() {
    if (this._networkListenersBound || typeof window === 'undefined') return;
    this._networkListenersBound = true;

    window.addEventListener('online', () => {
      console.info('[Sync] 🌐 Conexão de rede restabelecida! Drenando fila offline...');
      this._emitSyncStatus('syncing');
      this._flushCloudQueue().then(async () => {
        const remaining = this.getSyncPendingCount ? this.getSyncPendingCount() : 0;
        if (remaining === 0) {
          console.info('[Sync] Fila offline zerada. Atualizando dados com a nuvem...');
          const ok = await this.syncFromCloud();
          if (ok) {
            this._emitSyncStatus('synced');
            if (typeof window !== 'undefined' && window.App && typeof window.App.refreshCurrentRoute === 'function') {
              window.App.refreshCurrentRoute();
            }
          }
        } else {
          this._emitSyncStatus('pending', { pending: remaining });
        }
      }).catch(err => {
        console.warn('[Sync] Erro ao descarregar fila após reconexão:', err);
      });
    });

    window.addEventListener('offline', () => {
      console.warn('[Sync] 📴 Conexão perdida. Modo offline do canteiro de obras ativo.');
      this._emitSyncStatus('offline');
    });
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

  /**
   * Reconciliação consciente de fila offline (C-07 / Patch 17).
   * 1. Descarta do snapshot da nuvem qualquer item que esteja marcado para exclusão offline (tombstone).
   * 2. Preserva e prioriza a versão editada offline ('save' pendente) sobre o snapshot desatualizado.
   * 3. Mantém no cache local itens novos criados offline que ainda não subiram ao Neon.
   */
  _reconcileCollection(table, cloudItems = [], localItems = []) {
    const queue = (typeof this._getSyncQueue === 'function') ? this._getSyncQueue() : [];
    const tableAliases = [table];
    if (table === 'clientes') tableAliases.push('obras');
    if (table === 'obras') tableAliases.push('clientes');
    if (table === 'notas') tableAliases.push('notas_fiscais');
    if (table === 'contas') tableAliases.push('contas_bancarias');

    const relevantQueue = queue.filter(q => tableAliases.includes(q?.payload?.table));

    // 1. Identificar registros excluídos offline (tombstones)
    const pendingDeletes = new Set();
    for (const q of relevantQueue) {
      if (q?.payload?.action === 'delete') {
        const id = String(q.payload.id || q.payload.data?.id || q.payload.data?.cloud_id || '');
        if (id) pendingDeletes.add(id);
      }
    }

    // 2. Identificar edições/saves pendentes offline (versão mais recente da fila)
    const pendingSaves = new Map();
    for (const q of relevantQueue) {
      if (q?.payload?.action === 'save') {
        const item = q.payload.data;
        const id = String(q.payload.id || item?.id || item?.cloud_id || '');
        if (id && !pendingDeletes.has(id)) {
          pendingSaves.set(id, item);
        }
      }
    }

    // 3. Montar mapa inicial a partir do snapshot da nuvem (sem itens deletados offline)
    const resultMap = new Map();
    for (const cItem of (Array.isArray(cloudItems) ? cloudItems : [])) {
      const id = String(cItem?.id || cItem?.cloud_id || '');
      if (!id || pendingDeletes.has(id)) continue;

      if (pendingSaves.has(id)) {
        // Versão pendente offline prevalece
        const localPending = pendingSaves.get(id);
        resultMap.set(id, { ...cItem, ...localPending });
      } else {
        resultMap.set(id, cItem);
      }
    }

    // 4. Preservar itens criados offline que ainda não existem no snapshot da nuvem
    for (const lItem of (Array.isArray(localItems) ? localItems : [])) {
      const id = String(lItem?.id || lItem?.cloud_id || '');
      if (!id || pendingDeletes.has(id)) continue;

      if (pendingSaves.has(id)) {
        const pendingItem = pendingSaves.get(id);
        resultMap.set(id, { ...(resultMap.get(id) || lItem), ...pendingItem });
      } else if (!resultMap.has(id)) {
        // Item local criado sem internet ainda não presente na nuvem
        resultMap.set(id, lItem);
      }
    }

    return Array.from(resultMap.values());
  },

  async syncFromCloud() {
    this._emitSyncStatus('syncing');
    try {
      const d = await this._fetchCloudSnapshot();
      const coreBootstrapped = this.isCoreCloudBootstrapped ? this.isCoreCloudBootstrapped() : true;
      const mergeLegacy = (cloud, local) => (!coreBootstrapped && local.length ? this._reconcileCollection('legacy', cloud, local) : this._reconcileCollection('legacy', cloud, local));

      if (Array.isArray(d.clientes)) {
        const local = this.getAll('clientes') || [];
        const normalizedCloud = d.clientes.map(o => ({
          ...o,
          data_inicio: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(o.data_inicio) : (o.data_inicio ? String(o.data_inicio).split('T')[0] : o.data_inicio),
          data_previsao: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(o.data_previsao) : (o.data_previsao ? String(o.data_previsao).split('T')[0] : o.data_previsao)
        }));
        this.save('clientes', this._reconcileCollection('clientes', normalizedCloud, local));
      }

      if (Array.isArray(d.fornecedores)) {
        const local = this.getAll('fornecedores') || [];
        this.save('fornecedores', this._reconcileCollection('fornecedores', d.fornecedores, local));
      }

      if (Array.isArray(d.lancamentos)) {
        const local = this.getAll('lancamentos') || [];
        const normalizedCloud = d.lancamentos.map(l => ({
          ...l,
          data: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(l.data) || l.data : (l.data ? String(l.data).split('T')[0] : l.data),
          data_vencimento: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(l.data_vencimento) || Utils.cleanDate(l.data) || l.data : (l.data_vencimento ? String(l.data_vencimento).split('T')[0] : l.data),
          data_pagamento: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(l.data_pagamento) || null : (l.data_pagamento ? String(l.data_pagamento).split('T')[0] : null),
          valor: Number(l.valor) || 0
        }));
        this.save('lancamentos', this._reconcileCollection('lancamentos', normalizedCloud, local));
      }

      if (Array.isArray(d.notas)) {
        const local = this.getAll('notas') || [];
        const normalizedCloud = d.notas.map(n => {
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
        this.save('notas', this._reconcileCollection('notas', normalizedCloud, local));
      }

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
        this.save('orcamentos', this._reconcileCollection('orcamentos', mappedCloud, local));
      }

      if (Array.isArray(d.medicoes)) {
        const local = this.getAll('medicoes') || [];
        const mappedCloud = d.medicoes.map(m => ({
          ...m,
          data: (typeof Utils !== 'undefined' && Utils.cleanDate) ? Utils.cleanDate(m.data) || m.data : (m.data ? String(m.data).split('T')[0] : m.data),
          valor_medido: Number(m.valor_medido !== undefined ? m.valor_medido : m.valor_solicitado) || 0
        }));
        this.save('medicoes', this._reconcileCollection('medicoes', mappedCloud, local));
      }

      if (Array.isArray(d.contas)) {
        const local = this.getAll('contas') || [];
        this.save('contas', this._reconcileCollection('contas', d.contas, local));
      }

      if (Array.isArray(d.produtos)) {
        const local = this.getAll('produtos') || [];
        this.save('produtos', this._reconcileCollection('produtos', d.produtos, local));
      }

      if (Array.isArray(d.precompras)) {
        const local = this.getAll('precompras') || [];
        this.save('precompras', this._reconcileCollection('precompras', d.precompras, local));
      }

      if (Array.isArray(d.contratos)) {
        const local = this.getAll('contratos') || [];
        this.save('contratos', this._reconcileCollection('contratos', d.contratos, local));
      }

      if (Array.isArray(d.recibos)) {
        let local = [];
        try { local = JSON.parse(localStorage.getItem(this._ck('finobra_recibos')) || '[]'); } catch {}
        const next = this._reconcileCollection('recibos', d.recibos, local);
        try { localStorage.setItem(this._ck('finobra_recibos'), JSON.stringify(next)); } catch (e) { console.warn('[Sync] Falha ao salvar recibos em cache:', e); }
      }

      if (Array.isArray(d.orcamentos_sinapi)) {
        const local = this._localSinapiForCurrentTenant ? this._localSinapiForCurrentTenant() : [];
        const next = this._reconcileCollection('orcamentos_sinapi', d.orcamentos_sinapi, local);
        try { localStorage.setItem(this._ck('orcamentos_sinapi'), JSON.stringify(next)); } catch (e) { console.warn('[Sync] Falha ao salvar orçamentos SINAPI em cache:', e); }
      }

      const completenessBootstrapped = this.isCloudCompletenessBootstrapped ? this.isCloudCompletenessBootstrapped() : true;
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
        const reconciledDocs = this._reconcileCollection('documentos', merged, locais);
        Documentos.salvarLista(reconciledDocs);
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
    this._bindNetworkListeners();
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

  // ── CONTROLE ORÇADO × REALIZADO & CRONOGRAMA FÍSICO-FINANCEIRO ──
  getOrcamentoVsRealizado(obraId) {
    const isTodas = !obraId || obraId === 'todas';
    const cs = this.getAll('clientes') || [];
    const targetObras = isTodas ? cs : cs.filter(c => c.id === obraId);
    const targetIds = new Set(targetObras.map(c => c.id));

    // 1. Obter Orçamentos convencionais e SINAPI das obras alvo
    const orcsConv = (this.getAll('orcamentos') || []).filter(o => isTodas || targetIds.has(o.obra_id));
    const orcsSinapi = (this.getAll('orcamentos_sinapi') || []).filter(o => isTodas || targetIds.has(o.obra_id));

    // Catálogo padronizado de Macro-Etapas
    const MACRO_ETAPAS = [
      { id: 'preliminares',  nome: '01. Serviços Preliminares & Canteiro' },
      { id: 'fundacao',      nome: '02. Fundações & Estruturas' },
      { id: 'alvenaria',     nome: '03. Alvenarias & Fechamentos' },
      { id: 'cobertura',     nome: '04. Coberturas & Telhados' },
      { id: 'eletrica',      nome: '05. Instalações Elétricas' },
      { id: 'hidraulica',    nome: '06. Instalações Hidrossanitárias' },
      { id: 'revestimentos', nome: '07. Revestimentos & Pisos' },
      { id: 'esquadrias',    nome: '08. Esquadrias & Vidros' },
      { id: 'pintura',       nome: '09. Pinturas & Acabamentos' },
      { id: 'loucas',        nome: '10. Louças & Metais' },
      { id: 'externa',       nome: '11. Área Externa & Paisagismo' },
      { id: 'limpeza',       nome: '12. Limpeza Final & Entrega' },
      { id: 'outros',        nome: '13. Outros / Gerais' }
    ];

    const etapaMap = new Map();
    MACRO_ETAPAS.forEach(e => {
      etapaMap.set(e.id, { id: e.id, nome: e.nome, previsto: 0, realizado: 0, itensOrcados: 0 });
    });

    let totalOrcado = 0;

    // Consolidar Orçamentos Convencionais
    orcsConv.forEach(orc => {
      if (Array.isArray(orc.categorias) && orc.categorias.length > 0) {
        orc.categorias.forEach(cat => {
          const catId = String(cat.id || 'outros').toLowerCase();
          const target = etapaMap.get(catId) || etapaMap.get('outros');
          const val = Number(cat.total || cat.subtotal || 0);
          target.previsto += val;
          target.itensOrcados += (Array.isArray(cat.itens) ? cat.itens.length : 0);
          totalOrcado += val;
        });
      } else if (Array.isArray(orc.etapas) && orc.etapas.length > 0) {
        orc.etapas.forEach(et => {
          const etId = String(et.id || et.categoria || 'outros').toLowerCase();
          const target = etapaMap.get(etId) || etapaMap.get('outros');
          const val = Number(et.valor_previsto || et.total || 0);
          target.previsto += val;
          totalOrcado += val;
        });
      } else if (orc.valor_total || orc.valor_total_previsto) {
        const val = Number(orc.valor_total || orc.valor_total_previsto || 0);
        etapaMap.get('outros').previsto += val;
        totalOrcado += val;
      }
    });

    // Consolidar Orçamentos SINAPI
    orcsSinapi.forEach(orc => {
      const subtotal = (orc.itens || []).reduce((s, i) => s + Number(i.total || 0), 0);
      const bdi = Number(orc.bdi || 25);
      const val = subtotal * (1 + bdi / 100);
      etapaMap.get('outros').previsto += val;
      etapaMap.get('outros').itensOrcados += (orc.itens || []).length;
      totalOrcado += val;
    });

    // Fallback: se não tiver orçamento cadastrado, mas a obra tiver valor_financiado
    if (totalOrcado === 0 && targetObras.length > 0) {
      const somaContratos = targetObras.reduce((s, c) => s + Number(c.valor_financiado || 0), 0);
      if (somaContratos > 0) {
        totalOrcado = somaContratos;
        etapaMap.get('outros').previsto = somaContratos;
      }
    }

    // 2. Obter Gastos Reais (Lançamentos e Notas)
    const lans = (this.getAll('lancamentos') || []).filter(l => {
      if (l.tipo !== 'despesa' || l.status === 'cancelado') return false;
      if (isTodas) return l.obra_id !== 'escritorio' && l.obra_id !== 'sede';
      return l.obra_id === obraId;
    });

    const notas = (this.getAll('notas') || []).filter(n => {
      if (n.status === 'cancelada') return false;
      if (isTodas) return n.obra_id !== 'escritorio' && n.obra_id !== 'sede';
      return n.obra_id === obraId;
    });

    let totalRealizado = 0;

    // Helper para classificar despesa na etapa adequada
    const classificarEtapa = (cat = '', desc = '') => {
      const c = String(cat || '').toLowerCase();
      const d = String(desc || '').toLowerCase();
      if (c === 'preliminares' || d.includes('canteiro') || d.includes('locação') || d.includes('sondagem') || d.includes('topografia')) return 'preliminares';
      if (c === 'fundacao' || d.includes('concreto') || d.includes('ferro') || d.includes('aço') || d.includes('sapata') || d.includes('viga') || d.includes('pilar') || d.includes('laje')) return 'fundacao';
      if (c === 'alvenaria' || d.includes('tijolo') || d.includes('bloco') || d.includes('argamassa') || d.includes('reboco') || d.includes('chapisco')) return 'alvenaria';
      if (c === 'cobertura' || d.includes('telha') || d.includes('madeiramento') || d.includes('calha') || d.includes('rufo') || d.includes('impermeabiliz')) return 'cobertura';
      if (c === 'eletrica' || d.includes('fio') || d.includes('cabo') || d.includes('disjuntor') || d.includes('tomada') || d.includes('eletroduto') || d.includes('ilumina')) return 'eletrica';
      if (c === 'hidraulica' || d.includes('tubo') || d.includes('conexão') || d.includes('esgoto') || d.includes('água') || d.includes('caixa d') || d.includes('registro')) return 'hidraulica';
      if (c === 'revestimentos' || d.includes('piso') || d.includes('porcelanato') || d.includes('cerâmica') || d.includes('rejunte')) return 'revestimentos';
      if (c === 'esquadrias' || d.includes('porta') || d.includes('janela') || d.includes('vidro') || d.includes('alumínio') || d.includes('fechadura')) return 'esquadrias';
      if (c === 'pintura' || d.includes('tinta') || d.includes('massa corrida') || d.includes('selador') || d.includes('rolo') || d.includes('lixa')) return 'pintura';
      if (c === 'loucas' || d.includes('bacia') || d.includes('vaso') || d.includes('cuba') || d.includes('torneira') || d.includes('chuveiro')) return 'loucas';
      if (c === 'externa' || d.includes('grama') || d.includes('calçada') || d.includes('muro') || d.includes('portão')) return 'externa';
      if (c === 'limpeza' || d.includes('limpeza') || d.includes('entulho') || d.includes('caçamba')) return 'limpeza';
      return 'outros';
    };

    lans.forEach(l => {
      const val = Number(l.valor || 0);
      const etapaId = classificarEtapa(l.categoria, l.descricao);
      const target = etapaMap.get(etapaId) || etapaMap.get('outros');
      target.realizado += val;
      totalRealizado += val;
    });

    notas.forEach(n => {
      if (!n.lancamento_id) {
        const val = Number(n.valor_total || n.valor_bruto || 0);
        const etapaId = classificarEtapa(n.categoria, n.descricao || n.emitente);
        const target = etapaMap.get(etapaId) || etapaMap.get('outros');
        target.realizado += val;
        totalRealizado += val;
      }
    });

    // 3. Obter Avanço Físico das Medições
    const meds = (this.getAll('medicoes') || []).filter(m => {
      if (isTodas) return true;
      return m.obra_id === obraId;
    });

    let percentualFisico = 0;
    if (meds.length > 0) {
      const medsLiberadas = meds.filter(m => m.status === 'liberada' || m.status === 'aprovada');
      if (medsLiberadas.length > 0) {
        percentualFisico = Math.min(100, Math.max(...medsLiberadas.map(m => Number(m.percentual_fisico || 0))));
      } else {
        percentualFisico = Math.min(100, Math.max(...meds.map(m => Number(m.percentual_fisico || 0))));
      }
    }

    const saldoRestante = totalOrcado - totalRealizado;
    const percentualFinanceiro = totalOrcado > 0 ? Math.min(999, Math.round((totalRealizado / totalOrcado) * 1000) / 10) : 0;
    const desvio = Math.round((percentualFinanceiro - percentualFisico) * 10) / 10;

    let statusSaude = 'saudavel';
    let alertaDesc = 'Custos dentro do previsto para o avanço físico medido.';
    if (totalOrcado > 0 && totalRealizado > totalOrcado) {
      statusSaude = 'estouro';
      alertaDesc = `Atenção: O orçamento total foi superado em ${Utils.fmt.currency(Math.abs(saldoRestante))} (${(percentualFinanceiro - 100).toFixed(1)}% acima do teto).`;
    } else if (desvio > 10) {
      statusSaude = 'estouro';
      alertaDesc = `Risco de sobrecusto: O avanço financeiro (${percentualFinanceiro}%) está ${desvio}% acima do avanço físico medido (${percentualFisico}%).`;
    } else if (desvio > 5) {
      statusSaude = 'atencao';
      alertaDesc = `Atenção ao ritmo: Gastos ligeiramente adiantados (+${desvio}% em relação à medição física).`;
    }

    const etapasRelatorio = Array.from(etapaMap.values())
      .map(e => {
        const saldo = e.previsto - e.realizado;
        const pct = e.previsto > 0 ? Math.min(999, Math.round((e.realizado / e.previsto) * 1000) / 10) : (e.realizado > 0 ? 100 : 0);
        let status = 'ok';
        if (e.previsto > 0 && e.realizado > e.previsto) status = 'estouro';
        else if (pct >= 85) status = 'alerta';
        return { ...e, saldo, percentual: pct, status };
      })
      .filter(e => e.previsto > 0 || e.realizado > 0);

    return {
      obraId: obraId || 'todas',
      totalOrcado,
      totalRealizado,
      saldoRestante,
      percentualFinanceiro,
      percentualFisico,
      desvio,
      statusSaude,
      alertaDesc,
      etapas: etapasRelatorio,
      totalEtapas: etapasRelatorio.length,
      temOrcamento: totalOrcado > 0,
      totalMedicoes: meds.length
    };
  },

  // ── ENGENHARIA DE CUSTOS & CRONOGRAMA FÍSICO-FINANCEIRO (EVM / CURVA S) ──
  getCurvaS(obraId) {
    const isTodas = !obraId || obraId === 'todas';
    const cs = this.getAll('clientes') || [];
    const targetObras = isTodas ? cs : cs.filter(c => c.id === obraId);
    const targetIds = new Set(targetObras.map(c => c.id));
    const comp = this.getOrcamentoVsRealizado(obraId);

    // Determinar data de início e término
    let menorInicio = null;
    let maiorFim = null;

    targetObras.forEach(o => {
      const dtIni = o.data_inicio ? new Date(o.data_inicio) : null;
      const dtFim = (o.data_previsao_termino || o.data_fim) ? new Date(o.data_previsao_termino || o.data_fim) : null;
      if (dtIni && !isNaN(dtIni.getTime())) {
        if (!menorInicio || dtIni < menorInicio) menorInicio = dtIni;
      }
      if (dtFim && !isNaN(dtFim.getTime())) {
        if (!maiorFim || dtFim > maiorFim) maiorFim = dtFim;
      }
    });

    const hoje = new Date();
    if (!menorInicio) {
      menorInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
    }
    if (!maiorFim || maiorFim <= menorInicio) {
      maiorFim = new Date(menorInicio.getFullYear(), menorInicio.getMonth() + 11, 28);
    }

    // Montar meses do cronograma
    const meses = [];
    const labels = [];
    const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    let curr = new Date(menorInicio.getFullYear(), menorInicio.getMonth(), 1);
    const end = new Date(maiorFim.getFullYear(), maiorFim.getMonth(), 1);
    
    let count = 0;
    while (curr <= end && count < 36) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      meses.push(`${y}-${m}`);
      labels.push(`${nomeMeses[curr.getMonth()]}/${String(y).slice(2)}`);
      curr.setMonth(curr.getMonth() + 1);
      count++;
    }

    while (meses.length < 6) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      meses.push(`${y}-${m}`);
      labels.push(`${nomeMeses[curr.getMonth()]}/${String(y).slice(2)}`);
      curr.setMonth(curr.getMonth() + 1);
    }

    const totalMeses = meses.length;
    const bac = Math.max(1, comp.totalOrcado || comp.totalRealizado || 100000);

    // 1. Planned Value (PV) via sigmoide harmônica padrão
    const pvData = meses.map((_, idx) => {
      const t = idx + 1;
      const pct = (0.5 - 0.5 * Math.cos(Math.PI * (t / totalMeses)));
      return Math.round(bac * pct);
    });
    pvData[pvData.length - 1] = bac;

    // 2. Actual Cost (AC) acumulado mês a mês
    const lans = (this.getAll('lancamentos') || []).filter(l => {
      if (l.tipo !== 'despesa' || l.status === 'cancelado') return false;
      if (isTodas) return l.obra_id !== 'escritorio' && l.obra_id !== 'sede';
      return targetIds.has(l.obra_id);
    });
    const notas = (this.getAll('notas') || []).filter(n => {
      if (n.status === 'cancelada' || n.lancamento_id) return false;
      if (isTodas) return n.obra_id !== 'escritorio' && n.obra_id !== 'sede';
      return targetIds.has(n.obra_id);
    });

    const gastosPorMes = {};
    meses.forEach(m => gastosPorMes[m] = 0);

    lans.forEach(l => {
      const d = String(l.data || '').slice(0, 7);
      const val = Number(l.valor || 0);
      if (gastosPorMes[d] !== undefined) gastosPorMes[d] += val;
      else if (d < meses[0]) gastosPorMes[meses[0]] += val;
    });

    notas.forEach(n => {
      const d = String(n.data_emissao || n.data || '').slice(0, 7);
      const val = Number(n.valor_total || n.valor_bruto || 0);
      if (gastosPorMes[d] !== undefined) gastosPorMes[d] += val;
      else if (d < meses[0]) gastosPorMes[meses[0]] += val;
    });

    const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    let mesAtualIdx = meses.indexOf(mesAtualKey);
    if (mesAtualIdx === -1) {
      if (mesAtualKey < meses[0]) mesAtualIdx = 0;
      else mesAtualIdx = meses.length - 1;
    }

    const acData = [];
    let acumReal = 0;
    for (let i = 0; i < meses.length; i++) {
      if (i <= mesAtualIdx) {
        acumReal += (gastosPorMes[meses[i]] || 0);
        acData.push(acumReal);
      } else {
        acData.push(null);
      }
    }

    // 3. Earned Value (EV) acumulado via medições
    const meds = (this.getAll('medicoes') || []).filter(m => {
      if (m.status !== 'liberada' && m.status !== 'aprovada') return false;
      if (isTodas) return true;
      return targetIds.has(m.obra_id);
    });

    const evData = [];
    let maiorPctFisico = 0;
    for (let i = 0; i < meses.length; i++) {
      if (i <= mesAtualIdx) {
        const mesKey = meses[i];
        const medsAteMes = meds.filter(m => String(m.data || '').slice(0, 7) <= mesKey);
        if (medsAteMes.length > 0) {
          const maxMed = Math.max(...medsAteMes.map(m => Number(m.percentual_fisico || 0)));
          if (maxMed > maiorPctFisico) maiorPctFisico = maxMed;
        } else if (comp.percentualFisico > 0 && i === mesAtualIdx) {
          maiorPctFisico = comp.percentualFisico;
        }
        const evVal = Math.round(bac * (Math.min(100, maiorPctFisico) / 100));
        evData.push(evVal);
      } else {
        evData.push(null);
      }
    }

    // 4. Índices EVM e Forecast
    const acAtual = acData[mesAtualIdx] || comp.totalRealizado || 0;
    const evAtual = evData[mesAtualIdx] || Math.round(bac * (comp.percentualFisico / 100)) || 0;
    const pvAtual = pvData[mesAtualIdx] || 0;

    const cpi = acAtual > 0 ? Math.round((evAtual / acAtual) * 100) / 100 : 1.0;
    const spi = pvAtual > 0 ? Math.round((evAtual / pvAtual) * 100) / 100 : 1.0;

    const eac = cpi > 0 ? Math.round(bac / cpi) : bac;
    const vac = bac - eac;

    const forecastData = meses.map(() => null);
    if (mesAtualIdx >= 0) {
      forecastData[mesAtualIdx] = acAtual;
      const mesesRestantes = totalMeses - 1 - mesAtualIdx;
      if (mesesRestantes > 0) {
        const deltaCusto = eac - acAtual;
        for (let j = 1; j <= mesesRestantes; j++) {
          const idx = mesAtualIdx + j;
          const progress = j / mesesRestantes;
          forecastData[idx] = Math.round(acAtual + deltaCusto * progress);
        }
      }
    }

    let mesesAdicionais = 0;
    if (spi < 0.95 && spi > 0) {
      const mesesFaltantes = Math.max(1, totalMeses - 1 - mesAtualIdx);
      mesesAdicionais = Math.round((mesesFaltantes / spi) - mesesFaltantes);
    }
    const dataTerminoEstimada = new Date(maiorFim);
    if (mesesAdicionais > 0) {
      dataTerminoEstimada.setMonth(dataTerminoEstimada.getMonth() + mesesAdicionais);
    }

    let statusCusto = 'no_orcamento';
    if (cpi < 0.95) statusCusto = 'sobrecusto';
    else if (cpi > 1.05) statusCusto = 'economico';

    let statusPrazo = 'no_prazo';
    if (spi < 0.95) statusPrazo = 'atrasado';
    else if (spi > 1.05) statusPrazo = 'adiantado';

    let diagnosticoTexto = '';
    if (statusCusto === 'sobrecusto') {
      diagnosticoTexto = `Atenção: O Índice de Desempenho de Custos (CPI: ${cpi.toFixed(2)}) indica sobrecusto. Previsão de custo no término (EAC) em ${Utils.fmt.currency(eac)} (estouro projetado de ${Utils.fmt.currency(Math.abs(vac))}).`;
    } else if (statusCusto === 'economico') {
      diagnosticoTexto = `Excelente ritmo: O Índice de Desempenho de Custos (CPI: ${cpi.toFixed(2)}) indica economia em relação ao orçamento. Estimativa final (EAC) de ${Utils.fmt.currency(eac)} (saldo favorável projetado de ${Utils.fmt.currency(vac)}).`;
    } else {
      diagnosticoTexto = `Projeto dentro da meta: CPI de ${cpi.toFixed(2)} e SPI de ${spi.toFixed(2)}. Ritmo físico e desembolsos em equilíbrio com o planejado.`;
    }

    return {
      obraId: obraId || 'todas',
      dataInicio: menorInicio,
      dataFimPrevista: maiorFim,
      dataFimEstimada: dataTerminoEstimada,
      totalMeses,
      mesAtualIdx,
      mesesLabels: labels,
      mesesKeys: meses,
      bac,
      pvAtual,
      acAtual,
      evAtual,
      cpi,
      spi,
      eac,
      vac,
      statusCusto,
      statusPrazo,
      diagnosticoTexto,
      pvData,
      acData,
      evData,
      forecastData
    };
  },

  // ── CRONOGRAMA FÍSICO-FINANCEIRO ──
  getCronogramaFisicoFinanceiro(obraId) {
    const cs = this.getCurvaS(obraId);
    const comp = this.getOrcamentoVsRealizado(obraId);
    const totalMeses = cs.totalMeses;
    const mesesKeys = cs.mesesKeys;
    const mesesLabels = cs.mesesLabels;

    // Perfis típicos de distribuição por macro-etapa (pesos normalizados ao longo do ciclo de vida da obra)
    const perfisEtapas = {
      preliminares:  [0.60, 0.40, 0.00, 0.00, 0.00, 0.00],
      fundacao:      [0.30, 0.50, 0.20, 0.00, 0.00, 0.00],
      alvenaria:     [0.00, 0.25, 0.50, 0.25, 0.00, 0.00],
      cobertura:     [0.00, 0.00, 0.35, 0.45, 0.20, 0.00],
      eletrica:      [0.05, 0.15, 0.30, 0.30, 0.20, 0.00],
      hidraulica:    [0.10, 0.25, 0.35, 0.20, 0.10, 0.00],
      revestimentos: [0.00, 0.00, 0.15, 0.45, 0.30, 0.10],
      esquadrias:    [0.00, 0.00, 0.00, 0.30, 0.50, 0.20],
      pintura:       [0.00, 0.00, 0.00, 0.10, 0.50, 0.40],
      loucas:        [0.00, 0.00, 0.00, 0.00, 0.40, 0.60],
      externa:       [0.00, 0.00, 0.00, 0.10, 0.40, 0.50],
      limpeza:       [0.00, 0.00, 0.00, 0.00, 0.20, 0.80],
      outros:        [0.15, 0.20, 0.25, 0.20, 0.15, 0.05]
    };

    const etapasLinhas = comp.etapas.map(e => {
      const perfilBase = perfisEtapas[e.id] || perfisEtapas.outros;
      const mesesValores = [];

      // Interpolar perfil base na quantidade de meses total da obra
      for (let m = 0; m < totalMeses; m++) {
        const prog = totalMeses > 1 ? m / (totalMeses - 1) : 0;
        const baseIdx = Math.min(perfilBase.length - 1, Math.floor(prog * perfilBase.length));
        const peso = perfilBase[baseIdx] || 0.05;
        mesesValores.push(peso);
      }

      const somaPesos = mesesValores.reduce((s, p) => s + p, 0) || 1;
      const previstoTotal = e.previsto || (comp.totalOrcado / Math.max(1, comp.totalEtapas));

      const mesesPrevistos = mesesValores.map(p => {
        const pctMes = Math.round((p / somaPesos) * 1000) / 10;
        const valMes = Math.round(previstoTotal * (pctMes / 100));
        return { percentual: pctMes, valor: valMes };
      });

      // Ajustar último mês para fechar exatamente em 100%
      const somaPct = mesesPrevistos.reduce((s, mp) => s + mp.percentual, 0);
      const difPct = Math.round((100 - somaPct) * 10) / 10;
      if (mesesPrevistos.length > 0) {
        mesesPrevistos[mesesPrevistos.length - 1].percentual += difPct;
      }

      return {
        id: e.id,
        nome: e.nome,
        previstoTotal,
        realizadoTotal: e.realizado,
        saldo: e.saldo,
        status: e.status,
        meses: mesesPrevistos
      };
    });

    // Totais mensais
    const totaisMensais = mesesKeys.map((k, mIdx) => {
      let valorPrevisto = 0;
      etapasLinhas.forEach(l => {
        valorPrevisto += (l.meses[mIdx]?.valor || 0);
      });
      const pctPrevisto = cs.bac > 0 ? Math.round((valorPrevisto / cs.bac) * 1000) / 10 : 0;
      return {
        mesKey: k,
        label: mesesLabels[mIdx],
        valorPrevisto,
        percentualPrevisto: pctPrevisto
      };
    });

    // Totais acumulados
    let acumVal = 0;
    let acumPct = 0;
    const totaisAcumulados = totaisMensais.map(tm => {
      acumVal += tm.valorPrevisto;
      acumPct += tm.percentualPrevisto;
      return {
        valorAcumulado: acumVal,
        percentualAcumulado: Math.min(100, Math.round(acumPct * 10) / 10)
      };
    });

    return {
      obraId: obraId || 'todas',
      mesesKeys,
      mesesLabels,
      totalMeses,
      linhas: etapasLinhas,
      totaisMensais,
      totaisAcumulados,
      bac: cs.bac
    };
  },

  // ── CURVA ABC (PRINCÍPIO DE PARETO 80/20) ──
  getCurvaABC(obraId) {
    const isTodas = !obraId || obraId === 'todas';
    const cs = this.getAll('clientes') || [];
    const targetObras = isTodas ? cs : cs.filter(c => c.id === obraId);
    const targetIds = new Set(targetObras.map(c => c.id));

    // Coletar itens de orçamentos convencionais, SINAPI e lançamentos
    const orcsConv = (this.getAll('orcamentos') || []).filter(o => isTodas || targetIds.has(o.obra_id));
    const orcsSinapi = (this.getAll('orcamentos_sinapi') || []).filter(o => isTodas || targetIds.has(o.obra_id));
    const lans = (this.getAll('lancamentos') || []).filter(l => {
      if (l.tipo !== 'despesa' || l.status === 'cancelado') return false;
      if (isTodas) return l.obra_id !== 'escritorio' && l.obra_id !== 'sede';
      return targetIds.has(l.obra_id);
    });

    const itensMapeados = new Map();

    // 1. Itens orçados convencionais
    orcsConv.forEach(orc => {
      (orc.categorias || []).forEach(cat => {
        (cat.itens || []).forEach(i => {
          const desc = String(i.descricao || 'Item orçado').trim();
          const key = desc.toLowerCase();
          const val = Number(i.total || (Number(i.quantidade||1) * Number(i.preco_unitario||0)) || 0);
          if (val > 0) {
            const cur = itensMapeados.get(key) || { descricao: desc, categoria: cat.nome || 'Geral', valor: 0, quantidade: 0, unidade: i.unidade || 'un' };
            cur.valor += val;
            cur.quantidade += Number(i.quantidade || 1);
            itensMapeados.set(key, cur);
          }
        });
      });
    });

    // 2. Itens orçados SINAPI
    orcsSinapi.forEach(orc => {
      const bdi = Number(orc.bdi || 24.23);
      (orc.itens || []).forEach(i => {
        const desc = String(i.descricao || i.codigo || 'Composição SINAPI').trim();
        const key = desc.toLowerCase();
        const sub = Number(i.total || 0);
        const val = sub * (1 + bdi / 100);
        if (val > 0) {
          const cur = itensMapeados.get(key) || { descricao: desc, categoria: 'SINAPI', valor: 0, quantidade: 0, unidade: i.unidade || 'un' };
          cur.valor += val;
          cur.quantidade += Number(i.quantidade || 1);
          itensMapeados.set(key, cur);
        }
      });
    });

    // 3. Se não houver itens orçados detalhados, usar despesas reais
    if (itensMapeados.size === 0) {
      lans.forEach(l => {
        const desc = String(l.descricao || l.categoria || 'Despesa').trim();
        const key = desc.toLowerCase();
        const val = Number(l.valor || 0);
        if (val > 0) {
          const cur = itensMapeados.get(key) || { descricao: desc, categoria: l.categoria || 'Geral', valor: 0, quantidade: 1, unidade: 'un' };
          cur.valor += val;
          itensMapeados.set(key, cur);
        }
      });
    }

    // Se ainda vazio, montar fallback com macro-etapas
    if (itensMapeados.size === 0) {
      const comp = this.getOrcamentoVsRealizado(obraId);
      comp.etapas.forEach(e => {
        const val = e.previsto || e.realizado || 1000;
        itensMapeados.set(e.id, { descricao: e.nome, categoria: 'Macro-Etapa', valor: val, quantidade: 1, unidade: 'vb' });
      });
    }

    // Ordenar decrescente por valor total
    const listaOrdenada = Array.from(itensMapeados.values())
      .sort((a, b) => b.valor - a.valor);

    const valorTotalGeral = listaOrdenada.reduce((s, i) => s + i.valor, 0) || 1;

    let acum = 0;
    let totalClasseA = { valor: 0, qtd: 0, pct: 0 };
    let totalClasseB = { valor: 0, qtd: 0, pct: 0 };
    let totalClasseC = { valor: 0, qtd: 0, pct: 0 };

    const itensABC = listaOrdenada.map((item, idx) => {
      const pctIndividual = Math.round((item.valor / valorTotalGeral) * 10000) / 100;
      acum += item.valor;
      const pctAcumulado = Math.min(100, Math.round((acum / valorTotalGeral) * 10000) / 100);

      let classe = 'C';
      if (pctAcumulado <= 80 || idx === 0) {
        classe = 'A';
        totalClasseA.valor += item.valor;
        totalClasseA.qtd++;
      } else if (pctAcumulado <= 95) {
        classe = 'B';
        totalClasseB.valor += item.valor;
        totalClasseB.qtd++;
      } else {
        classe = 'C';
        totalClasseC.valor += item.valor;
        totalClasseC.qtd++;
      }

      return {
        ranking: idx + 1,
        descricao: item.descricao,
        categoria: item.categoria,
        unidade: item.unidade,
        quantidade: item.quantidade,
        valorTotal: item.valor,
        pctIndividual,
        pctAcumulado,
        classe
      };
    });

    totalClasseA.pct = Math.round((totalClasseA.valor / valorTotalGeral) * 1000) / 10;
    totalClasseB.pct = Math.round((totalClasseB.valor / valorTotalGeral) * 1000) / 10;
    totalClasseC.pct = Math.round((totalClasseC.valor / valorTotalGeral) * 1000) / 10;

    return {
      obraId: obraId || 'todas',
      valorTotalGeral,
      totalItens: itensABC.length,
      classeA: totalClasseA,
      classeB: totalClasseB,
      classeC: totalClasseC,
      itens: itensABC
    };
  },

  // ── LEIS SOCIAIS & ENCARGOS TRABALHISTAS (MÃO DE OBRA) ──
  getLeisSociais(desonerado = false) {
    // Tabela padrão oficial da construção civil (SINAPI / CEF / IBGE)
    const grupoA = [
      { codigo: 'A1', descricao: 'INSS Patronal', percentual: desonerado ? 0.00 : 20.00 },
      { codigo: 'A2', descricao: 'FGTS', percentual: 8.00 },
      { codigo: 'A3', descricao: 'Salário Educação', percentual: 2.50 },
      { codigo: 'A4', descricao: 'SESI', percentual: 1.50 },
      { codigo: 'A5', descricao: 'SENAI', percentual: 1.00 },
      { codigo: 'A6', descricao: 'SEBRAE', percentual: 0.60 },
      { codigo: 'A7', descricao: 'INCRA', percentual: 0.20 },
      { codigo: 'A8', descricao: 'Seguro Contra Acidentes de Trabalho (SAT/INSS)', percentual: 3.00 }
    ];
    const totalA = grupoA.reduce((s, i) => s + i.percentual, 0);

    const grupoB = [
      { codigo: 'B1', descricao: 'Repouso Semanal Remunerado (RSR)', percentual: 17.84 },
      { codigo: 'B2', descricao: 'Feriados Oficiais e Facultativos', percentual: 3.71 },
      { codigo: 'B3', descricao: 'Auxílio Enfermidade / Primeiros 15 dias', percentual: 0.85 },
      { codigo: 'B4', descricao: '13º Salário', percentual: 10.82 },
      { codigo: 'B5', descricao: 'Férias Anuais e 1/3 Constitucional', percentual: 10.98 },
      { codigo: 'B6', descricao: 'Faltas Justificadas e Legais', percentual: 0.56 }
    ];
    const totalB = grupoB.reduce((s, i) => s + i.percentual, 0);

    const grupoC = [
      { codigo: 'C1', descricao: 'Aviso Prévio Indenizado', percentual: 5.52 },
      { codigo: 'C2', descricao: 'Aviso Prévio Trabalhado', percentual: 0.13 },
      { codigo: 'C3', descricao: 'Multa Rescisória do FGTS (Rescisões Sem Justa Causa)', percentual: 3.87 },
      { codigo: 'C4', descricao: 'Indenização Adicional / Rescisória', percentual: 0.45 }
    ];
    const totalC = grupoC.reduce((s, i) => s + i.percentual, 0);

    // Grupo D: Reincidências de Grupo A sobre Grupo B
    const taxaD = desonerado ? 7.52 : 11.20;
    const grupoD = [
      { codigo: 'D1', descricao: 'Reincidência de Grupo A sobre Grupo B', percentual: taxaD }
    ];
    const totalD = taxaD;

    const totalGeral = Math.round((totalA + totalB + totalC + totalD) * 100) / 100;

    return {
      regime: desonerado ? 'Desonerado (com CPRB 4.5%)' : 'Não Desonerado (com INSS 20%)',
      desonerado,
      totalGeral,
      grupoA: { itens: grupoA, total: Math.round(totalA * 100) / 100 },
      grupoB: { itens: grupoB, total: Math.round(totalB * 100) / 100 },
      grupoC: { itens: grupoC, total: Math.round(totalC * 100) / 100 },
      grupoD: { itens: grupoD, total: Math.round(totalD * 100) / 100 },
      observacao: desonerado
        ? 'No regime desonerado a cota patronal de 20% do INSS é zerada, incidindo a CPRB de 4,5% sobre a receita bruta no BDI.'
        : 'No regime não desonerado incide a cota patronal integral do INSS de 20% sobre a folha de pagamento.'
    };
  },

  // ── MEMÓRIA DE CÁLCULO DE BDI OFICIAL (TCU ACÓRDÃO 2622/2013) ──
  getBDIConfig(obraId, customParams = {}) {
    const isDesonerado = customParams.desonerado !== undefined ? !!customParams.desonerado : false;

    // Parâmetros de referência (Valores médios recomendados pelo Acórdão 2622/2013 - TCU)
    const ac  = Number(customParams.ac  !== undefined ? customParams.ac  : 4.00);  // Administração Central (3.00% a 5.50%)
    const s   = Number(customParams.s   !== undefined ? customParams.s   : 0.80);  // Seguro (0.80% a 1.20%)
    const r   = Number(customParams.r   !== undefined ? customParams.r   : 1.20);  // Risco (0.97% a 1.27%)
    const g   = Number(customParams.g   !== undefined ? customParams.g   : 0.40);  // Garantia (0.40% a 0.74%)
    const df  = Number(customParams.df  !== undefined ? customParams.df  : 1.23);  // Despesas Financeiras (0.59% a 1.39%)
    const l   = Number(customParams.l   !== undefined ? customParams.l   : 7.40);  // Lucro Bruto Operacional (6.16% a 8.96%)

    // Tributos: PIS (0.65%), COFINS (3.00%), ISS (2.00% a 5.00%), CPRB (4.50% se desonerado)
    const pis    = 0.65;
    const cofins = 3.00;
    const iss    = Number(customParams.iss !== undefined ? customParams.iss : 3.00);
    const cprb   = isDesonerado ? 4.50 : 0.00;
    const i = pis + cofins + iss + cprb; // Total de tributos

    // Fórmula oficial do TCU:
    // BDI = [ ( (1 + (AC + S + R + G)/100) * (1 + DF/100) * (1 + L/100) ) / (1 - I/100) ] - 1
    const numerador = (1 + (ac + s + r + g) / 100) * (1 + df / 100) * (1 + l / 100);
    const denominador = 1 - (i / 100);
    const bdiCalculado = Math.round(((numerador / denominador) - 1) * 10000) / 100;

    return {
      formula: 'BDI = [ ( (1 + AC + S + R + G) * (1 + DF) * (1 + L) ) / (1 - I) ] - 1',
      bdiCalculado,
      desonerado: isDesonerado,
      parametros: {
        ac: { valor: ac, nome: 'Administração Central', faixaTCU: '3,00% — 5,50%' },
        s:  { valor: s,  nome: 'Seguro', faixaTCU: '0,80% — 1,20%' },
        r:  { valor: r,  nome: 'Risco', faixaTCU: '0,97% — 1,27%' },
        g:  { valor: g,  nome: 'Garantia', faixaTCU: '0,40% — 0,74%' },
        df: { valor: df, nome: 'Despesas Financeiras', faixaTCU: '0,59% — 1,39%' },
        l:  { valor: l,  nome: 'Lucro Bruto Operacional', faixaTCU: '6,16% — 8,96%' },
        tributos: {
          total: i,
          pis,
          cofins,
          iss,
          cprb,
          nome: 'Tributos Incidentes (PIS + COFINS + ISS + CPRB)'
        }
      },
      faixaReferenciaTCU: {
        primeiroQuartil: 20.34,
        mediana: 22.18,
        terceiroQuartil: 25.00
      }
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
