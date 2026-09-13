import fs from 'fs';

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Patch36 bloco4: trecho não encontrado (${label})`);
  return source.replace(needle, replacement);
}

// ── Backend: SINAPI precisa de feature do plano, não apenas módulo Orçamentos ──
let db = fs.readFileSync('api/db.js','utf8');
db = replaceOnce(db,
  "import { getPlanRule, isActiveObraStatus } from './_plans.js';",
  "import { getPlanRule, isActiveObraStatus, canUseFeature, planError } from './_plans.js';",
  'import features plans');

db = replaceOnce(db,
`function tableAllowed(auth, table, action = 'read') {
  return canAccessTable(auth, table, action);
}
`,
`function planFeatureErrorForTable(auth, table) {
  const feature = String(table || '') === 'orcamentos_sinapi' ? 'sinapi' : null;
  if (!feature || auth?.isSystem || auth?.user?.perfil === 'superadmin') return null;
  return canUseFeature(auth?.user?.tenantPlan, feature) ? null : planError(feature, auth?.user?.tenantPlan);
}

function tableAllowed(auth, table, action = 'read') {
  if (planFeatureErrorForTable(auth, table)) return false;
  return canAccessTable(auth, table, action);
}
`,
  'feature tableAllowed');

db = replaceOnce(db,
`    if (req.method === 'GET') {
      const { table, obra_id, id } = req.query || {};
      const pagination = parsePagination(req.query || {});
      const requestedTable = String(table || '').trim();
      if (requestedTable && !['all','sync_manifest'].includes(requestedTable) && !tableAllowed(auth, requestedTable, 'read')) {
        return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN', requestedTable));
      }
`,
`    if (req.method === 'GET') {
      const { table, obra_id, id } = req.query || {};
      const pagination = parsePagination(req.query || {});
      const requestedTable = String(table || '').trim();
      const requestedPlanError = requestedTable ? planFeatureErrorForTable(auth, requestedTable) : null;
      if (requestedPlanError) return res.status(403).json(requestedPlanError);
      if (requestedTable && !['all','sync_manifest'].includes(requestedTable) && !tableAllowed(auth, requestedTable, 'read')) {
        return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN', requestedTable));
      }
`,
  'GET explicit plan feature error');

db = replaceOnce(db,
`    if (req.method === 'POST') {
      const { action, table, data, id, payload } = req.body || {};

      if ((action === 'sync_all' || action === 'save') && !canWriteData(auth)) {
`,
`    if (req.method === 'POST') {
      const { action, table, data, id, payload } = req.body || {};
      const directPlanError = table ? planFeatureErrorForTable(auth, table) : null;
      if (directPlanError) return res.status(403).json(directPlanError);

      if ((action === 'sync_all' || action === 'save') && !canWriteData(auth)) {
`,
  'POST direct plan feature error');

db = replaceOnce(db,
`function deniedSyncCollection(auth, payload) {
  for (const [key, table] of Object.entries(SYNC_COLLECTION_TABLE)) {
    const value = payload?.[key];
    const hasData = Array.isArray(value) ? value.length > 0 : (value && typeof value === 'object' && Object.keys(value).length > 0);
    if (hasData && !tableAllowed(auth, table, 'write')) return { key, table };
  }
  return null;
}
`,
`function deniedSyncCollection(auth, payload) {
  for (const [key, table] of Object.entries(SYNC_COLLECTION_TABLE)) {
    const value = payload?.[key];
    const hasData = Array.isArray(value) ? value.length > 0 : (value && typeof value === 'object' && Object.keys(value).length > 0);
    if (!hasData) continue;
    const planDenied = planFeatureErrorForTable(auth, table);
    if (planDenied) return { key, table, planError: planDenied };
    if (!tableAllowed(auth, table, 'write')) return { key, table };
  }
  return null;
}
`,
  'sync plan feature');

db = replaceOnce(db,
`        const denied = deniedSyncCollection(auth, payload);
        if (denied) return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN', denied.table));
`,
`        const denied = deniedSyncCollection(auth, payload);
        if (denied) return res.status(403).json(denied.planError || permissionError('MODULE_WRITE_FORBIDDEN', denied.table));
`,
  'sync friendly plan error');
fs.writeFileSync('api/db.js', db, 'utf8');

// ── Reusable UX para feature bloqueada ────────────────────────────────────────
let cob = fs.readFileSync('js/cobranca.js','utf8');
const featureUi = `
  isFeatureAllowed(feature) {
    const role=String(Auth?.getUser?.()?.perfil||'').toLowerCase();
    if(role==='superadmin') return true;
    const features=Auth?.getPlanAccess?.()?.features;
    return !features || features[feature] !== false;
  },

  renderLockedFeature(title, description='Este recurso está disponível em outro plano.') {
    return \`<div class="card" style="max-width:760px;margin:24px auto;padding:28px;text-align:center;border:1px solid rgba(201,162,39,.35);background:linear-gradient(145deg,rgba(201,162,39,.08),rgba(255,255,255,.02));"><div style="font-size:2rem;margin-bottom:8px">🔒</div><h2 style="font-size:1.25rem;margin:0 0 8px">\${Utils.escapeHtml(title)}</h2><p style="color:var(--text3);font-size:.86rem;line-height:1.6;max-width:560px;margin:0 auto 18px">\${Utils.escapeHtml(description)}</p><button class="btn btn-primary" data-fb-click="Cobranca.goToPlans" data-fb-click-n="0">Conhecer planos</button></div>\`;
  },

  showLockedFeature(feature, title, description='Este recurso não faz parte do plano atual.') {
    if(this.isFeatureAllowed(feature)) return true;
    const p=Auth?.getPlanAccess?.()||{};
    Utils.showModal(\`<div class="modal" style="max-width:520px"><div class="modal-header"><span class="modal-title">🔒 Recurso disponível em outro plano</span><button class="modal-close" data-fb-click="Utils.closeModal" data-fb-click-n="0">✕</button></div><div class="modal-body"><h3 style="margin:0 0 8px">\${Utils.escapeHtml(title)}</h3><p class="plan-locked-copy">\${Utils.escapeHtml(description)} O <strong>\${Utils.escapeHtml(p.label||'seu plano')}</strong> continua ativo normalmente e nenhum dado foi perdido.</p></div><div class="modal-footer"><button class="btn btn-secondary" data-fb-click="Utils.closeModal" data-fb-click-n="0">Continuar</button><button class="btn btn-primary" data-fb-click="Cobranca.goToPlans" data-fb-click-n="0">Conhecer planos</button></div></div>\`);
    return false;
  },

`;
cob = replaceOnce(cob,
  "  renderTelaPlanos(containerId = 'route-content') {",
  featureUi + "  renderTelaPlanos(containerId = 'route-content') {",
  'feature lock helpers');
fs.writeFileSync('js/cobranca.js', cob, 'utf8');

// ── SINAPI frontend: tela + ações protegidas ─────────────────────────────────
let sinapi = fs.readFileSync('js/orcamento_sinapi.js','utf8');
sinapi = replaceOnce(sinapi,
`  _lastSearchResults: [],

  _defaultUF(obraId='') {`,
`  _lastSearchResults: [],

  _hasPlanAccess() {
    return typeof Cobranca === 'undefined' || Cobranca.isFeatureAllowed('sinapi');
  },

  _ensurePlanAccess() {
    if (this._hasPlanAccess()) return true;
    if (typeof Cobranca !== 'undefined') Cobranca.showLockedFeature('sinapi','SINAPI / Caixa','Importação de bases SINAPI, composições oficiais da Caixa e orçamentos referenciais estão disponíveis no plano Construtora Ilimitado.');
    return false;
  },

  _defaultUF(obraId='') {`,
  'sinapi plan helpers');

sinapi = replaceOnce(sinapi,
`  render(obraId) {
    const orcs = this._getAll(obraId);`,
`  render(obraId) {
    if (!this._hasPlanAccess()) return Cobranca.renderLockedFeature('SINAPI / Caixa','Importação de bases SINAPI, composições oficiais da Caixa e orçamentos referenciais estão disponíveis no plano Construtora Ilimitado.');
    const orcs = this._getAll(obraId);`,
  'sinapi render lock');

for (const [needle,replacement,label] of [
  ["  showForm(id = null) {\n    const orc", "  showForm(id = null) {\n    if (!this._ensurePlanAccess()) return;\n    const orc", 'showForm'],
  ["  save(id) {\n    const f", "  save(id) {\n    if (!this._ensurePlanAccess()) return;\n    const f", 'save'],
  ["  del(id) {\n    Utils.confirm", "  del(id) {\n    if (!this._ensurePlanAccess()) return;\n    Utils.confirm", 'del'],
  ["  openEditor(id) {\n    this._currentEditor", "  openEditor(id) {\n    if (!this._ensurePlanAccess()) return;\n    this._currentEditor", 'openEditor'],
  ["  async puxarDiretoNoEditor(orcId) {\n    const orc", "  async puxarDiretoNoEditor(orcId) {\n    if (!this._ensurePlanAccess()) return;\n    const orc", 'puxarDireto'],
  ["  showImportModal(desoneradoInicial = false, ufInicial = '', refInicial = '') {\n    const metaOn", "  showImportModal(desoneradoInicial = false, ufInicial = '', refInicial = '') {\n    if (!this._ensurePlanAccess()) return;\n    const metaOn", 'showImportModal'],
  ["  updateQtd(orcId, itemId, novaQtd) {\n    const orc", "  updateQtd(orcId, itemId, novaQtd) {\n    if (!this._ensurePlanAccess()) return;\n    const orc", 'updateQtd'],
  ["  removeItem(orcId, itemId) {\n    const orc", "  removeItem(orcId, itemId) {\n    if (!this._ensurePlanAccess()) return;\n    const orc", 'removeItem']
]) sinapi = replaceOnce(sinapi,needle,replacement,`SINAPI ${label}`);
fs.writeFileSync('js/orcamento_sinapi.js', sinapi, 'utf8');

// ── Engenharia avançada: Curva S/EVM, ABC e BDI bloqueados fora do Ilimitado ──
let obra = fs.readFileSync('js/obra_detalhe.js','utf8');
obra = replaceOnce(obra,
`  _filtroBusca: '',

  _safeHtmlRecord(record) {`,
`  _filtroBusca: '',

  _hasEngineeringFeature() {
    return typeof Cobranca === 'undefined' || Cobranca.isFeatureAllowed('engineering');
  },

  _ensureEngineeringFeature() {
    if (this._hasEngineeringFeature()) return true;
    if (typeof Cobranca !== 'undefined') Cobranca.showLockedFeature('engineering','Engenharia avançada','Curva S, EVM, Curva ABC e BDI avançado estão disponíveis no plano Construtora Ilimitado. O cronograma físico-financeiro continua disponível conforme o seu plano.');
    return false;
  },

  _renderEngineeringFeatureLock() {
    return typeof Cobranca !== 'undefined'
      ? Cobranca.renderLockedFeature('Engenharia avançada','Curva S, EVM, Curva ABC e BDI avançado estão disponíveis no plano Construtora Ilimitado. O cronograma físico-financeiro continua disponível.')
      : '';
  },

  _safeHtmlRecord(record) {`,
  'engineering helpers');

obra = replaceOnce(obra,
`  setSubTabOrcado(subTab) {
    this.subTabOrcado = subTab;`,
`  setSubTabOrcado(subTab) {
    if (['curva-s','curva-abc','leis-sociais'].includes(subTab) && !this._ensureEngineeringFeature()) return;
    this.subTabOrcado = subTab;`,
  'advanced subtab guard');

obra = replaceOnce(obra,
`    const currentSubTab = this.subTabOrcado || 'curva-s';`,
`    const currentSubTab = this._hasEngineeringFeature() ? (this.subTabOrcado || 'curva-s') : 'cronograma';`,
  'default pro subtab cronograma');

obra = replaceOnce(obra,
`  _renderSubTabOrcadoContent(subTab, obraId) {
    if (subTab === 'cronograma') return this._renderSubTabCronograma(obraId);
    if (subTab === 'curva-abc') return this._renderSubTabCurvaABC(obraId);
    if (subTab === 'leis-sociais') return this._renderSubTabLeisSociaisBDI(obraId);
    return this._renderSubTabCurvaS(obraId);
  },`,
`  _renderSubTabOrcadoContent(subTab, obraId) {
    if (subTab === 'cronograma') return this._renderSubTabCronograma(obraId);
    if (['curva-s','curva-abc','leis-sociais'].includes(subTab) && !this._hasEngineeringFeature()) return this._renderEngineeringFeatureLock();
    if (subTab === 'curva-abc') return this._renderSubTabCurvaABC(obraId);
    if (subTab === 'leis-sociais') return this._renderSubTabLeisSociaisBDI(obraId);
    return this._renderSubTabCurvaS(obraId);
  },`,
  'advanced content guard');

// Marca visualmente as três abas premium.
obra = obra.replace('📈 Curva S &amp; Previsão EVM', "${this._hasEngineeringFeature()?'📈':'🔒'} Curva S &amp; Previsão EVM");
obra = obra.replace('📊 Curva ABC (Pareto)', "${this._hasEngineeringFeature()?'📊':'🔒'} Curva ABC (Pareto)");
obra = obra.replace('⚖️ Leis Sociais &amp; BDI', "${this._hasEngineeringFeature()?'⚖️':'🔒'} Leis Sociais &amp; BDI");

for (const [needle,replacement,label] of [
  ["  salvarBDI(obraId) {\n    const ac", "  salvarBDI(obraId) {\n    if (!this._ensureEngineeringFeature()) return;\n    const ac", 'salvarBDI'],
  ["  salvarBDIPadrao(obraId) {\n    const ac", "  salvarBDIPadrao(obraId) {\n    if (!this._ensureEngineeringFeature()) return;\n    const ac", 'salvarBDIPadrao'],
  ["  restaurarBDITCU(obraId) {\n    const isDeson", "  restaurarBDITCU(obraId) {\n    if (!this._ensureEngineeringFeature()) return;\n    const isDeson", 'restaurarBDITCU']
]) obra = replaceOnce(obra,needle,replacement,`Engenharia ${label}`);
fs.writeFileSync('js/obra_detalhe.js', obra, 'utf8');

// ── Testes permanentes ────────────────────────────────────────────────────────
let test = fs.readFileSync('scripts/test-patch36-static.js','utf8');
test = test.replace("console.log('\\n✅ Patch 36 blocos 1–3 validados.');", `
const db=fs.readFileSync('api/db.js','utf8');
const sinapi=fs.readFileSync('js/orcamento_sinapi.js','utf8');
const obra=fs.readFileSync('js/obra_detalhe.js','utf8');
assert(db.includes('planFeatureErrorForTable') && db.includes("table || '') === 'orcamentos_sinapi'") && db.includes("planError(feature"),'Backend diferencia SINAPI por feature e devolve erro de plano.');
assert(db.includes('denied.planError || permissionError'),'Sync_all preserva bloqueio SINAPI server-side.');
assert(sinapi.includes('_ensurePlanAccess') && sinapi.includes("showLockedFeature('sinapi'") && sinapi.includes("renderLockedFeature('SINAPI / Caixa'"),'SINAPI mostra bloqueio amigável e protege ações diretas.');
assert(obra.includes('_hasEngineeringFeature') && obra.includes("['curva-s','curva-abc','leis-sociais']") && obra.includes("? (this.subTabOrcado || 'curva-s') : 'cronograma'"),'Engenharia avançada é separada do cronograma nos planos.');
assert(obra.includes("showLockedFeature('engineering'") && obra.includes('if (!this._ensureEngineeringFeature()) return;'),'Ações de BDI também respeitam o plano.');
console.log('\\n✅ Patch 36 blocos 1–4 validados.');`);
fs.writeFileSync('scripts/test-patch36-static.js', test, 'utf8');
console.log('Patch36 bloco 4 aplicado localmente; aguardando validação.');
