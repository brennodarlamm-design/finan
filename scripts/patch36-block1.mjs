import fs from 'fs';

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Patch36: trecho não encontrado (${label})`);
  return source.replace(needle, replacement);
}

// 1) Regras centrais de planos, usuários e módulos
const plans = `// api/_plans.js — Regras de planos, limites de usuários e módulos do SaaS FinObra

export const PLAN_MODULE_CATALOG = Object.freeze({
  dashboard: 'Dashboard',
  obras: 'Obras & Clientes',
  financeiro: 'Financeiro',
  fornecedores: 'Fornecedores',
  produtos: 'Produtos / Insumos',
  precompras: 'Pré-Compras',
  recibos: 'Recibos',
  contratos: 'Contratos',
  notas: 'Notas / NF-e / OCR',
  orcamentos: 'Orçamentos / SINAPI',
  medicoes: 'Medições',
  documentos: 'Documentos',
  relatorios: 'Relatórios',
  contas: 'Contas Bancárias',
  whatsapp: 'WhatsApp',
  assinatura: 'Assinatura eletrônica',
  planos: 'Planos / Cobrança',
  configuracoes: 'Configurações'
});

const ALL_MODULES = Object.freeze(Object.keys(PLAN_MODULE_CATALOG));
const STARTER_MODULES = Object.freeze([
  'dashboard','obras','financeiro','fornecedores','produtos','recibos','medicoes','relatorios','contas','whatsapp','planos','configuracoes'
]);
const PRO_MODULES = Object.freeze([
  'dashboard','obras','financeiro','fornecedores','produtos','precompras','recibos','contratos','notas','orcamentos','medicoes','documentos','relatorios','contas','whatsapp','assinatura','planos','configuracoes'
]);

export const PLAN_RULES = Object.freeze({
  trial: Object.freeze({
    id: 'trial',
    label: 'Teste gratuito',
    idealFor: 'Conhecer o FinObra com os principais recursos liberados',
    maxActiveObras: 10,
    maxUsers: 2,
    monthlyPriceCents: 0,
    supportLevel: 'Padrão',
    modules: ALL_MODULES,
    features: Object.freeze({ ocr:true, signatures:true, sinapi:true, engineering:true, advancedPermissions:true })
  }),
  starter: Object.freeze({
    id: 'starter',
    label: 'Plano Básico',
    idealFor: 'Profissionais e pequenas construtoras com operação enxuta',
    maxActiveObras: 3,
    maxUsers: 1,
    monthlyPriceCents: 7990,
    supportLevel: 'Padrão',
    modules: STARTER_MODULES,
    features: Object.freeze({ ocr:false, signatures:false, sinapi:false, engineering:false, advancedPermissions:false })
  }),
  pro: Object.freeze({
    id: 'pro',
    label: 'Plano Profissional',
    idealFor: 'Construtoras em crescimento que precisam automatizar documentos e compras',
    maxActiveObras: 10,
    maxUsers: 2,
    monthlyPriceCents: 11990,
    supportLevel: 'Prioritário',
    modules: PRO_MODULES,
    features: Object.freeze({ ocr:true, signatures:true, sinapi:false, engineering:false, advancedPermissions:false })
  }),
  unlimited: Object.freeze({
    id: 'unlimited',
    label: 'Construtora Ilimitado',
    idealFor: 'Operações completas com engenharia, equipe e obras em escala',
    maxActiveObras: null,
    maxUsers: 5,
    monthlyPriceCents: 15990,
    supportLevel: 'Prioritário / VIP',
    modules: ALL_MODULES,
    features: Object.freeze({ ocr:true, signatures:true, sinapi:true, engineering:true, advancedPermissions:true })
  })
});

export function normalizePlan(plan) {
  const key = String(plan || 'trial').trim().toLowerCase();
  return PLAN_RULES[key] ? key : 'trial';
}

export function getPlanRule(plan) {
  return PLAN_RULES[normalizePlan(plan)];
}

export function isActiveObraStatus(status) {
  const s = String(status || 'em_andamento').trim().toLowerCase();
  return !['concluida','concluída','concluido','concluído','cancelada','cancelado','sistema'].includes(s);
}

export function canUseFeature(plan, feature) {
  return Boolean(getPlanRule(plan).features?.[feature]);
}

export function canUseModule(plan, module) {
  const key = String(module || '').trim();
  if (!key) return true;
  return getPlanRule(plan).modules.includes(key);
}

export function planError(feature, plan) {
  const rule = getPlanRule(plan);
  const names = {
    ocr: 'Leitura OCR com IA',
    signatures: 'Assinatura eletrônica com validação',
    sinapi: 'SINAPI / Caixa',
    engineering: 'Controles avançados de engenharia',
    advancedPermissions: 'Permissões avançadas por módulo'
  };
  return {
    success:false,
    code:'PLAN_FEATURE_REQUIRED',
    feature,
    plan:rule.id,
    error:\`${'${names[feature] || \'Este recurso\'}'} não está incluído no ${'${rule.label}'}. Conheça os planos disponíveis para liberar este recurso.\`
  };
}

export function planModuleError(module, plan) {
  const rule = getPlanRule(plan);
  const name = PLAN_MODULE_CATALOG[module] || 'Este módulo';
  return {
    success:false,
    code:'PLAN_MODULE_REQUIRED',
    module,
    plan:rule.id,
    error:\`${'${name}'} não está incluído no ${'${rule.label}'}. Você pode continuar usando os demais módulos do seu plano ou consultar uma opção superior.\`
  };
}
`;
fs.writeFileSync('api/_plans.js', plans, 'utf8');

// 2) RBAC + plano: plano limita empresa; perfil limita pessoa.
let permissions = fs.readFileSync('api/_permissions.js','utf8');
if (!permissions.includes("from './_plans.js'")) {
  permissions = replaceOnce(permissions,
    "// Perfis suportados: superadmin, admin, gestor, operador, visualizador.\n",
    "// Perfis suportados: superadmin, admin, gestor, operador, visualizador.\nimport { canUseModule } from './_plans.js';\n",
    'import canUseModule');
}
const oldCanAccess = `export function canAccessModule(auth, module, action = 'read') {
  if (auth?.isSystem) return true;
  const role = normalizeRole(auth?.user?.perfil);
  if (role === 'superadmin' || role === 'admin') return true;
  const base = Boolean(roleRule(role)?.[action]);
  if (!base) return false;
  if (!MODULES.includes(module)) return base;

  // Hierarquia de segurança: sem leitura não existe escrita/exclusão;
  // sem escrita não existe exclusão. A permissão customizada nunca eleva o perfil.
  const readCustom = customPermission(auth, module, 'read');
  if (readCustom === false) return false;
  if (action === 'delete') {
    const writeCustom = customPermission(auth, module, 'write');
    if (writeCustom === false) return false;
  }
  const custom = customPermission(auth, module, action);
  return custom === null ? base : Boolean(custom) && base;
}`;
const newCanAccess = `export function canAccessModule(auth, module, action = 'read') {
  if (auth?.isSystem) return true;
  const role = normalizeRole(auth?.user?.perfil);

  // Superadmin da plataforma precisa conseguir diagnosticar todos os módulos no modo suporte.
  if (role !== 'superadmin') {
    const tenantPlan = auth?.user?.tenantPlan || auth?.user?.plano || 'trial';
    if (MODULES.includes(module) && !canUseModule(tenantPlan, module)) return false;
  }

  if (role === 'superadmin' || role === 'admin') return true;
  const base = Boolean(roleRule(role)?.[action]);
  if (!base) return false;
  if (!MODULES.includes(module)) return base;

  // Hierarquia de segurança: sem leitura não existe escrita/exclusão;
  // sem escrita não existe exclusão. A permissão customizada nunca eleva o perfil.
  const readCustom = customPermission(auth, module, 'read');
  if (readCustom === false) return false;
  if (action === 'delete') {
    const writeCustom = customPermission(auth, module, 'write');
    if (writeCustom === false) return false;
  }
  const custom = customPermission(auth, module, action);
  return custom === null ? base : Boolean(custom) && base;
}`;
permissions = replaceOnce(permissions, oldCanAccess, newCanAccess, 'canAccessModule por plano');
fs.writeFileSync('api/_permissions.js', permissions, 'utf8');

// 3) Limite real de usuários no backend.
let users = fs.readFileSync('api/users.js','utf8');
users = replaceOnce(users,
  "import { canManageUsers, canManageTenant, permissionError, sanitizePermissions } from './_permissions.js';\n",
  "import { canManageUsers, canManageTenant, permissionError, sanitizePermissions } from './_permissions.js';\nimport { getPlanRule } from './_plans.js';\n",
  'import getPlanRule users');

const safeUserNeedle = `const safeUser = u => ({
  id: u.id, username: u.username, email: u.email || '', nome: u.nome,
  perfil: u.perfil, avatar: u.avatar || (u.nome || 'US').slice(0,2).toUpperCase(),
  ativo: !!u.ativo, tenantId: u.tenant_id, googleAuth: !!u.google_auth,
  permissions: (u.permissoes && typeof u.permissoes === 'object') ? u.permissoes : {},
  created_at: u.created_at
});
`;
const usageHelpers = `${safeUserNeedle}
async function getUserPlanUsage(sql, tenantId) {
  const tenantRows = await sql\`SELECT plano FROM tenants WHERE id=\${tenantId} LIMIT 1;\`;
  const rule = getPlanRule(tenantRows[0]?.plano || 'trial');
  const countRows = await sql\`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE ativo=TRUE)::int AS active
    FROM usuarios WHERE tenant_id=\${tenantId};
  \`;
  const activeUsers = Number(countRows[0]?.active || 0);
  const totalUsers = Number(countRows[0]?.total || 0);
  return {
    planId: rule.id,
    planLabel: rule.label,
    maxUsers: rule.maxUsers,
    activeUsers,
    totalUsers,
    remainingUsers: rule.maxUsers == null ? null : Math.max(0, rule.maxUsers - activeUsers)
  };
}

function planUserLimitError(usage) {
  return {
    success:false,
    code:'PLAN_USER_LIMIT',
    plan:usage.planId,
    limit:usage.maxUsers,
    current:usage.activeUsers,
    error:\`Seu time chegou ao limite do \${usage.planLabel}. Este plano inclui \${usage.maxUsers} usuário(s) ativo(s). Para adicionar outra pessoa, gerencie os usuários atuais ou consulte um plano com mais acessos.\`
  };
}
`;
users = replaceOnce(users, safeUserNeedle, usageHelpers, 'helpers limite usuarios');

users = replaceOnce(users,
  "      return res.status(200).json({ success:true, users:rows.map(safeUser), limited:!actorIsAdmin });\n",
  "      const planUsage = await getUserPlanUsage(sql, auth.tenantId);\n      return res.status(200).json({ success:true, users:rows.map(safeUser), limited:!actorIsAdmin, planUsage });\n",
  'GET users planUsage');

users = replaceOnce(users,
  "      if (!allowedProfiles.includes(perfil)) return res.status(400).json({ success:false, error:'Perfil inválido.' });\n      const exists = await sql`SELECT id FROM usuarios WHERE LOWER(username)=${un} OR LOWER(email)=${em} LIMIT 1;`;\n",
  "      if (!allowedProfiles.includes(perfil)) return res.status(400).json({ success:false, error:'Perfil inválido.' });\n      const planUsage = await getUserPlanUsage(sql, auth.tenantId);\n      if (planUsage.maxUsers != null && planUsage.activeUsers >= planUsage.maxUsers) {\n        return res.status(409).json(planUserLimitError(planUsage));\n      }\n      const exists = await sql`SELECT id FROM usuarios WHERE LOWER(username)=${un} OR LOWER(email)=${em} LIMIT 1;`;\n",
  'POST limite usuarios');

users = replaceOnce(users,
  "      const dup = await sql`SELECT id FROM usuarios WHERE id<>${targetId} AND (LOWER(username)=${newUsername} OR LOWER(email)=${newEmail}) LIMIT 1;`;\n",
  "      if (!cur.ativo && newAtivo) {\n        const planUsage = await getUserPlanUsage(sql, auth.tenantId);\n        if (planUsage.maxUsers != null && planUsage.activeUsers >= planUsage.maxUsers) {\n          return res.status(409).json(planUserLimitError(planUsage));\n        }\n      }\n\n      const dup = await sql`SELECT id FROM usuarios WHERE id<>${targetId} AND (LOWER(username)=${newUsername} OR LOWER(email)=${newEmail}) LIMIT 1;`;\n",
  'PATCH limite ao reativar');
fs.writeFileSync('api/users.js', users, 'utf8');

// 4) /api/plano passa a ser a fonte única da Central da Conta.
let plano = fs.readFileSync('api/plano.js','utf8');
plano = replaceOnce(plano,
  "    const active = Number(counts[0]?.obras_ativas || 0);\n    const total = Number(counts[0]?.obras_total || 0);\n    const max = rule.maxActiveObras;\n",
  "    const active = Number(counts[0]?.obras_ativas || 0);\n    const total = Number(counts[0]?.obras_total || 0);\n    const max = rule.maxActiveObras;\n    const userCounts = await sql`\n      SELECT COUNT(*) FILTER (WHERE ativo=TRUE)::int AS usuarios_ativos, COUNT(*)::int AS usuarios_total\n      FROM usuarios WHERE tenant_id=${auth.tenantId};\n    `;\n    const activeUsers = Number(userCounts[0]?.usuarios_ativos || 0);\n    const totalUsers = Number(userCounts[0]?.usuarios_total || 0);\n",
  'uso usuarios plano');

plano = replaceOnce(plano,
  "        SELECT id, plan_id, amount_cents, status, txid, paid_at, expires_at, created_at\n",
  "        SELECT id, plan_id, amount_cents, status, txid, paid_at, expires_at, created_at,\n               TO_CHAR(created_at AT TIME ZONE 'America/Boa_Vista', 'MM/YYYY') AS competencia\n",
  'competencia cobrancas');

plano = replaceOnce(plano,
  "        maxActiveObras: max,\n        features: rule.features,\n        usage: { activeObras: active, totalObras: total, remainingActiveObras: max == null ? null : Math.max(0, max - active) }\n",
  "        maxActiveObras: max,\n        maxUsers: rule.maxUsers,\n        idealFor: rule.idealFor,\n        supportLevel: rule.supportLevel,\n        modules: rule.modules,\n        features: rule.features,\n        usage: {\n          activeObras: active,\n          totalObras: total,\n          remainingActiveObras: max == null ? null : Math.max(0, max - active),\n          activeUsers,\n          totalUsers,\n          remainingUsers: rule.maxUsers == null ? null : Math.max(0, rule.maxUsers - activeUsers)\n        }\n",
  'payload central conta');
fs.writeFileSync('api/plano.js', plano, 'utf8');

// 5) Master: fallback seguro quando o cookie auxiliar de retorno não estiver disponível.
let admin = fs.readFileSync('api/admin.js','utf8');
const oldRestore = `    if (req.method === 'POST' && action === 'restore_master_session') {
      const restoreToken = readCookie(req, MASTER_RESTORE_COOKIE);
      const secret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();
      const payload = restoreToken ? verifyToken(restoreToken, secret) : null;
      if (!payload || payload.userId !== auth.user.id) {
        return res.status(401).json({ success:false, error:'Sessão Master de retorno ausente ou expirada.' });
      }
      const rows = await sql\`SELECT perfil, ativo FROM usuarios WHERE id=\${payload.userId} LIMIT 1;\`;
      if (!rows.length || !rows[0].ativo || rows[0].perfil !== 'superadmin') {
        return res.status(403).json({ success:false, error:'A conta Master não está autorizada.' });
      }
      const remaining = Math.max(60, Math.floor((Number(payload.exp || Date.now()) - Date.now()) / 1000));
      setCookies(res, [
        cookieLine(req, SESSION_COOKIE, restoreToken, remaining),
        cookieLine(req, MASTER_RESTORE_COOKIE, '', 0)
      ]);
      await writeAudit(sql, req, { ...auth, tenantId:auth.tenantId }, {
        acao:'suporte_encerrado', entidade:'suporte_master', entidadeId:String(req.body?.tenantId || auth.tenantId || ''),
        depois:{ restored:true, superadmin:auth.user?.username || auth.user?.email || 'superadmin' }
      });
      return res.status(200).json({ success:true, restored:true });
    }`;
const newRestore = `    if (req.method === 'POST' && action === 'restore_master_session') {
      const secret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();
      let restoreToken = readCookie(req, MASTER_RESTORE_COOKIE);
      let payload = restoreToken ? verifyToken(restoreToken, secret) : null;
      let recoveredFromImpersonatedSession = false;

      // O cookie auxiliar pode ser descartado pelo navegador/proxy. A sessão impersonada
      // continua sendo um JWT assinado de um superadmin real e uma sessão revogável já
      // validada por resolveAuthAndTenant. Nesse caso recriamos uma sessão Master curta,
      // sem depender de dados enviados pelo cliente.
      if (!payload || payload.userId !== auth.user.id) {
        const isImpersonatedMaster = auth.user?.perfil === 'superadmin' && Boolean(auth.user?.isImpersonated || auth.user?.impersonated || auth.user?.impersonatedBy);
        const realTenantId = String(auth.user?.realTenantId || auth.user?.originalTenantId || '').trim();
        if (!isImpersonatedMaster || !realTenantId) {
          return res.status(401).json({ success:false, error:'Não foi possível restaurar automaticamente a sessão Master. Entre novamente no painel Master.' });
        }
        const fallbackExp = Math.min(Number(auth.user?.exp || (Date.now() + 4 * 60 * 60 * 1000)), Date.now() + 4 * 60 * 60 * 1000);
        restoreToken = signToken({
          userId:auth.user.id,
          username:auth.user.username,
          nome:auth.user.nome,
          email:auth.user.email,
          perfil:'superadmin',
          tenantId:realTenantId,
          sessionId:auth.user.sessionId || '',
          exp:fallbackExp
        }, secret);
        payload = verifyToken(restoreToken, secret);
        recoveredFromImpersonatedSession = true;
      }

      const rows = await sql\`SELECT perfil, ativo FROM usuarios WHERE id=\${payload.userId} LIMIT 1;\`;
      if (!rows.length || !rows[0].ativo || rows[0].perfil !== 'superadmin') {
        return res.status(403).json({ success:false, error:'A conta Master não está autorizada.' });
      }
      const remaining = Math.max(60, Math.floor((Number(payload.exp || Date.now()) - Date.now()) / 1000));
      setCookies(res, [
        cookieLine(req, SESSION_COOKIE, restoreToken, remaining),
        cookieLine(req, MASTER_RESTORE_COOKIE, '', 0)
      ]);
      await writeAudit(sql, req, { ...auth, tenantId:auth.tenantId }, {
        acao:'suporte_encerrado', entidade:'suporte_master', entidadeId:String(req.body?.tenantId || auth.tenantId || ''),
        depois:{ restored:true, recoveredFromImpersonatedSession, superadmin:auth.user?.username || auth.user?.email || 'superadmin' }
      });
      return res.status(200).json({ success:true, restored:true, recoveredFromImpersonatedSession });
    }`;
admin = replaceOnce(admin, oldRestore, newRestore, 'restore master resiliente');
fs.writeFileSync('api/admin.js', admin, 'utf8');

// 6) Chart.js local e CSP mais restrita.
let appHtml = fs.readFileSync('app.html','utf8');
appHtml = replaceOnce(appHtml,
  '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>',
  '<script src="/js/vendor/chart.umd.min.js?v=4.4.0"></script>',
  'chart local');
fs.writeFileSync('app.html', appHtml, 'utf8');

let worker = fs.readFileSync('cloudflare-worker.js','utf8');
worker = worker.replace(' https://cdn.jsdelivr.net', '');
fs.writeFileSync('cloudflare-worker.js', worker, 'utf8');

// 7) Teste permanente do bloco.
const test = `import fs from 'fs';
function assert(cond,msg){ if(!cond){ console.error('❌ '+msg); process.exit(1); } console.log('✅ '+msg); }
const plans=fs.readFileSync('api/_plans.js','utf8');
const perms=fs.readFileSync('api/_permissions.js','utf8');
const users=fs.readFileSync('api/users.js','utf8');
const plano=fs.readFileSync('api/plano.js','utf8');
const admin=fs.readFileSync('api/admin.js','utf8');
const app=fs.readFileSync('app.html','utf8');
const worker=fs.readFileSync('cloudflare-worker.js','utf8');
assert(plans.includes('maxUsers: 1') && plans.includes('maxUsers: 2') && plans.includes('maxUsers: 5'),'Planos usam limites 1/2/5 usuários.');
assert(plans.includes('canUseModule') && plans.includes('PLAN_MODULE_REQUIRED'),'Regras centrais conhecem módulos por plano.');
assert(perms.includes("canUseModule(tenantPlan, module)"),'RBAC aplica plano antes das permissões individuais.');
assert(users.includes("code:'PLAN_USER_LIMIT'") && users.includes('getUserPlanUsage'),'Criação/reativação de usuários respeita limite do plano.');
assert(plano.includes('activeUsers') && plano.includes('remainingUsers') && plano.includes('competencia'),'Central da Conta recebe consumo de usuários e competência de cobrança.');
assert(admin.includes('recoveredFromImpersonatedSession') && admin.includes('realTenantId'),'Master possui recuperação segura sem depender apenas do cookie auxiliar.');
assert(app.includes('/js/vendor/chart.umd.min.js?v=4.4.0') && !app.includes('cdn.jsdelivr.net/npm/chart.js'),'Chart.js é servido localmente.');
assert(!worker.includes('https://cdn.jsdelivr.net'),'CSP não depende mais do jsDelivr.');
assert(fs.existsSync('js/vendor/chart.umd.min.js') && fs.statSync('js/vendor/chart.umd.min.js').size > 100000,'Asset local do Chart.js foi versionado.');
console.log('\\n✅ Patch 36 bloco 1 validado.');
`;
fs.writeFileSync('scripts/test-patch36-static.js', test, 'utf8');

let all = fs.readFileSync('scripts/test-static-all.js','utf8');
if (!all.includes('scripts/test-patch36-static.js')) {
  all = replaceOnce(all,
    "  'scripts/test-patch35-static.js'\n",
    "  'scripts/test-patch35-static.js',\n  'scripts/test-patch36-static.js'\n",
    'registrar test patch36');
  fs.writeFileSync('scripts/test-static-all.js', all, 'utf8');
}

console.log('Patch36 bloco 1 aplicado localmente; aguardando validações.');
