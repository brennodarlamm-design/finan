// js/patch22.js — Compatibilidade e persistência de Engenharia (Patch 22)
// Carregado após data.js e obra_detalhe.js para corrigir, sem duplicar, os contratos
// de Cronograma/BDI introduzidos no Patch 21.
(function applyPatch22() {
  if (typeof DB === 'undefined') return;

  const clampPercent = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
  };

  const normalizeEtapas = (etapas) => {
    const out = {};
    if (Array.isArray(etapas)) {
      etapas.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        const id = String(item.id || item.codigo || item.code || `etapa_${idx}`).trim();
        if (!id) return;
        out[id] = {
          ativo: item.ativo !== undefined ? !!item.ativo : (item.ativa !== undefined ? !!item.ativa : true),
          previstoTotal: Number(item.previstoTotal ?? item.valorPrevisto ?? item.valor_previsto ?? 0) || 0,
          meses: Array.isArray(item.meses) ? item.meses.map(v => Math.max(0, Number(v) || 0)) : undefined
        };
      });
      return out;
    }
    if (etapas && typeof etapas === 'object') {
      Object.entries(etapas).forEach(([key, item]) => {
        if (!item || typeof item !== 'object') return;
        const id = String(item.id || item.codigo || key).trim();
        if (!id) return;
        out[id] = {
          ...item,
          ativo: item.ativo !== undefined ? !!item.ativo : (item.ativa !== undefined ? !!item.ativa : true),
          previstoTotal: Number(item.previstoTotal ?? item.valorPrevisto ?? item.valor_previsto ?? 0) || 0,
          meses: Array.isArray(item.meses) ? item.meses.map(v => Math.max(0, Number(v) || 0)) : item.meses
        };
      });
    }
    return out;
  };

  const normalizeCronograma = (config) => {
    if (!config || typeof config !== 'object') return null;
    return {
      totalMeses: Math.max(3, Math.min(36, Number(config.totalMeses || 12) || 12)),
      mesInicio: config.mesInicio || null,
      modoDistribuicao: config.modoDistribuicao || config.modeloCurva || 'gaussiana',
      modeloCurva: config.modeloCurva || config.modoDistribuicao || 'gaussiana',
      etapas: normalizeEtapas(config.etapas),
      updated_at: config.updated_at || new Date().toISOString()
    };
  };

  const originalSaveCronograma = DB.saveCronogramaConfig?.bind(DB);
  DB.saveCronogramaConfig = function saveCronogramaConfigPatch22(obraId, config) {
    if (!obraId || obraId === 'todas') return false;
    const obra = this.getById('clientes', obraId);
    if (!obra) return false;
    if (config == null) {
      this.update('clientes', obraId, { cronograma_config: null });
      return true;
    }
    const normalized = normalizeCronograma(config);
    if (!normalized) return originalSaveCronograma ? originalSaveCronograma(obraId, config) : false;
    this.update('clientes', obraId, { cronograma_config: normalized });
    return true;
  };

  const originalGetCronograma = DB.getCronogramaFisicoFinanceiro?.bind(DB);
  if (originalGetCronograma) {
    DB.getCronogramaFisicoFinanceiro = function getCronogramaPatch22(obraId) {
      const obra = obraId && obraId !== 'todas' ? this.getById('clientes', obraId) : null;
      if (obra?.cronograma_config) obra.cronograma_config = normalizeCronograma(obra.cronograma_config);
      const result = originalGetCronograma(obraId);
      if (result && Array.isArray(result.linhas)) {
        result.linhas = result.linhas.map(l => ({ ...l, codigo: l.codigo || l.id, id: l.id || l.codigo }));
      }
      return result;
    };
  }

  const normalizeBdi = (config = {}) => {
    const desonerado = !!config.desonerado;
    const sg = clampPercent(config.sg, Number(config.s || 0) + Number(config.g || 0));
    const s = config.s !== undefined ? clampPercent(config.s) : sg * 0.65;
    const g = config.g !== undefined ? clampPercent(config.g) : sg * 0.35;
    const baseTributos = 0.65 + 3.00 + (desonerado ? 4.50 : 0);
    const t = config.t !== undefined ? clampPercent(config.t) : clampPercent(Number(config.i || baseTributos + Number(config.iss || 3)));
    const iss = config.iss !== undefined ? clampPercent(config.iss, 3) : Math.max(0, Math.min(5, t - baseTributos));
    return {
      ac: clampPercent(config.ac, 4), s, g, sg: s + g,
      r: clampPercent(config.r, 1.2), df: clampPercent(config.df, 1.23),
      l: clampPercent(config.l, 7.4), iss, t: baseTributos + iss,
      desonerado, updated_at: config.updated_at || new Date().toISOString()
    };
  };

  const originalGetBDI = DB.getBDIConfig?.bind(DB);
  if (originalGetBDI) {
    DB.getBDIConfig = function getBDIConfigPatch22(obraId, customParams = {}) {
      const mapped = { ...customParams };
      if (mapped.sg !== undefined && mapped.s === undefined && mapped.g === undefined) {
        mapped.s = Number(mapped.sg || 0) * 0.65;
        mapped.g = Number(mapped.sg || 0) * 0.35;
      }
      if (mapped.t !== undefined && mapped.iss === undefined) {
        const base = 3.65 + (mapped.desonerado ? 4.5 : 0);
        mapped.iss = Math.max(0, Math.min(5, Number(mapped.t || 0) - base));
      }
      const result = originalGetBDI(obraId, mapped);
      if (!result) return result;
      return { ...result, sg: Number(result.s || 0) + Number(result.g || 0), t: Number(result.i || 0) };
    };
  }

  DB.saveBDIConfig = function saveBDIConfigPatch22(obraId, config = {}) {
    if (!obraId || obraId === 'todas') return this.saveBDIEmpresaPadrao(config);
    const obra = this.getById('clientes', obraId);
    if (!obra) return false;
    const normalized = normalizeBdi(config);
    this.update('clientes', obraId, { bdi_config: normalized });
    return true;
  };

  DB.saveBDIEmpresaPadrao = function saveBDIEmpresaPadraoPatch22(config = {}) {
    const normalized = normalizeBdi(config);
    const emp = this.getEmpresa ? this.getEmpresa() : {};
    if (this.saveEmpresa) this.saveEmpresa({ ...emp, bdi_padrao: normalized });
    if (typeof this.saveTenantPreferences === 'function') {
      this.saveTenantPreferences({ bdi_padrao: normalized });
    }
    return true;
  };

  const originalSnapshot = DB._preferencesLocalSnapshot?.bind(DB);
  if (originalSnapshot) {
    DB._preferencesLocalSnapshot = function preferencesSnapshotPatch22() {
      const base = originalSnapshot() || {};
      return { ...base, bdi_padrao: this.getEmpresa?.()?.bdi_padrao || null };
    };
  }

  const originalApplyPrefs = DB._applyTenantPreferences?.bind(DB);
  if (originalApplyPrefs) {
    DB._applyTenantPreferences = function applyTenantPreferencesPatch22(preferences = {}) {
      originalApplyPrefs(preferences);
      if (preferences && typeof preferences.bdi_padrao === 'object' && preferences.bdi_padrao) {
        const emp = this.getEmpresa ? this.getEmpresa() : {};
        if (this.saveEmpresa) this.saveEmpresa({ ...emp, bdi_padrao: normalizeBdi(preferences.bdi_padrao) });
      }
    };
  }
})();
