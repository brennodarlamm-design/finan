import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { getPlanRule } from '../api/_plans.js';

const read = file => fs.readFileSync(file, 'utf8');
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

// Exercita o endpoint real sem rede: o plano deve pertencer ao tenant efetivo.
const queries = [];
let authorized = true;
const sql = async (strings) => {
  const query = strings.join('?');
  queries.push(query);
  if (query.includes('FROM usuarios u')) return [{ id:'u1', username:'master', nome:'Master', perfil:'superadmin', tenant_id:'original', plano:'trial', tenant_status:'trial', permissoes:{} }];
  if (query.includes('FROM tenants')) return [{ id:'effective', plano:'starter', status:'ativo', nome_fantasia:'Empresa de teste' }];
  throw new Error(`Consulta inesperada: ${query}`);
};
const apiContext = vm.createContext({
  console, process:{ env:{ DATABASE_URL:'postgres://finobra_app:test@localhost/db', DATABASE_OWNER_URL:'postgres://neondb_owner:test@localhost/db' } }, Buffer,
  OAuth2Client:class {}, neon:() => sql, createOwnerSql:() => sql, getPlanRule,
  getSessionSigningSecret:() => 'test-only',
  resolveAuthAndTenant:async () => authorized
    ? { authenticated:true, tenantId:'effective', user:{ userId:'u1', sessionId:'session1' } }
    : { authenticated:false, status:401, error:'Sessão expirada' }
});
const apiSource = read('api/auth.js').replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '').replace('export default async function handler', 'async function handler');
const handler = vm.runInContext(apiSource + '\nhandler;', apiContext);
let body, status;
const res = { setHeader() {}, status(value) { status=value; return this; }, json(value) { body=value; return this; } };
await handler({ method:'GET', headers:{}, query:{ action:'me' } }, res);
assert.equal(status, 200);
assert.equal(body.user.tenantId, 'effective');
assert.equal(body.plan.id, 'starter');
assert.deepEqual(body.plan.modules, getPlanRule('starter').modules);
assert.equal(body.plan.status, 'ativo');
assert.equal(queries.length, 2, 'Não consulta contagens de obras, usuários ou faturas na abertura');
authorized = false;
await handler({ method:'GET', headers:{}, query:{ action:'me' } }, res);
assert.equal(status, 401);
assert.equal(body.plan, undefined);
assert.equal(queries.length, 2);
console.log('✅ Sessão retorna plano do tenant efetivo sem carregar cobrança; sessão inválida não recebe dados.');

// Cliente real: consulta antecipada é reaproveitada, plano aplicado e timeout abortado.
const local = new Map(), session = new Map();
session.set('finobra_session', JSON.stringify({ userId:'u1', tenantId:'effective', remember:false, expiresAt:Date.now()+60000 }));
const storage = map => ({ getItem:key => map.get(key) ?? null, setItem:(key,value) => map.set(key,value), removeItem:key => map.delete(key) });
const timers = new Set();
let requests = 0, release;
const authContext = vm.createContext({
  console, AbortController, navigator:{ onLine:true },
  window:{ location:{ pathname:'/app' } },
  localStorage:storage(local), sessionStorage:storage(session),
  setTimeout:fn => { timers.add(fn); return fn; }, clearTimeout:fn => timers.delete(fn),
  fetch:async () => { requests++; return new Promise(resolve => { release=resolve; }); }
});
const auth = vm.runInContext(read('js/auth.js') + '\nAuth;', authContext);
assert.equal(requests, 1, 'Validação começa antes de App.init');
const validation = auth.refreshSessionFromServer();
assert.equal(requests, 1, 'Inicialização reutiliza a requisição em andamento');
release({ ok:true, status:200, json:async () => ({ success:true, user:{ id:'u1', tenantId:'effective', permissions:{ dashboard:{ read:true } } }, plan:getPlanRule('trial') }) });
assert.equal((await validation).success, true);
assert.equal(auth.getPlanAccess().id, getPlanRule('trial').id);
assert.equal(timers.size, 0);
authContext.fetch = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Timeout'))));
const timeout = auth.refreshSessionFromServer();
for (const timer of [...timers]) timer();
assert.equal((await timeout).success, false);
assert.equal(timers.size, 0);
let expired = false;
auth.handleSessionExpired = () => { expired=true; };
authContext.fetch = async () => ({ status:401, ok:false, json:async () => ({ success:false }) });
assert.equal((await auth.refreshSessionFromServer()).expired, true);
assert.equal(expired, true);
let publicRequests = 0;
for (const location of [{ pathname:'/portal', search:'' }, { pathname:'/app', search:'?portal_obra=test' }, { pathname:'/app', hash:'#validar' }]) {
  const publicContext = vm.createContext({
    console, navigator:{ onLine:true }, window:{ location },
    localStorage:storage(local), sessionStorage:storage(session),
    fetch:() => { publicRequests++; throw new Error('Não deve validar sessão privada em rota pública'); }
  });
  vm.runInContext(read('js/auth.js'), publicContext);
}
assert.equal(publicRequests, 0, 'Preflight não interfere nas rotas públicas');
console.log('✅ Cliente reaproveita validação, aplica plano, aborta timeout e respeita revogação.');

async function startApp(result, { legacyFailure=false, offline=false } = {}) {
  const calls = [];
  const context = vm.createContext({
    console, URLSearchParams, navigator:{ onLine:!offline }, setInterval:() => 1,
    window:{ location:{ pathname:'/app', hash:'', search:'' }, addEventListener() {}, FinObraStartup:{ mark() {}, measure() {}, ready:() => calls.push('ready'), fail:() => calls.push('fail') } },
    Auth:{ requireAuth:() => true, refreshSessionFromServer:async () => { calls.push('session'); return result; }, refreshPlanAccess:async () => { calls.push('plan'); if (legacyFailure) throw new Error('Falha'); } },
    DB:{ init:() => calls.push('data'), syncFromCloud:async () => false, getEmpresa:() => ({ configurada:true }) }
  });
  for (const name of ['Dashboard','Clientes','Lancamentos','Escritorio','PreCompras','Recibos','Contratos','Notas','Orcamentos','Medicoes','FasesDoc','Exportar','Contas','Configuracoes','Fornecedores','Produtos']) context[name]={};
  const app = vm.runInContext(read('js/app.js') + '\nApp;', context);
  app._installErrorMonitor = app._bindSyncStatus = () => {};
  app.renderShell = () => calls.push('shell');
  app.navigate = async () => calls.push('route');
  await app.init();
  await tick();
  return calls;
}
for (const result of [{ success:false }, { expired:true }, null]) {
  const calls = await startApp(result);
  assert.ok(!calls.includes('shell') && !calls.includes('data'), 'Falha online nunca revela o cache privado');
}
const success = await startApp({ success:true, plan:{ id:'trial' } });
assert.ok(success.indexOf('session') < success.indexOf('shell'));
assert.ok(success.includes('route'));
assert.ok(!success.includes('plan'), 'Resposta consolidada dispensa segunda chamada');
const legacy = await startApp({ success:true });
assert.ok(legacy.indexOf('plan') < legacy.indexOf('shell'), 'Compatibilidade com API antiga');
const legacyFailure = await startApp({ success:true }, { legacyFailure:true });
assert.ok(!legacyFailure.includes('shell'));
const offline = await startApp(null, { offline:true });
assert.ok(offline.includes('shell') && !offline.includes('session'), 'Preserva fluxo offline existente');
console.log('✅ Entrada protege cache privado, mantém compatibilidade e preserva modo offline.');

const nodes = new Map(['app-startup','startup-title','startup-message','startup-actions'].map(id => [id,{ hidden:true, setAttribute(key,value) { this[key]=value; } }]));
const startupTimers = new Set(), measures = [];
const startupContext = vm.createContext({
  document:{ getElementById:id => nodes.get(id) },
  performance:{ mark() {}, measure:name => measures.push(name) },
  setTimeout:fn => { startupTimers.add(fn); return fn; }, clearTimeout:fn => startupTimers.delete(fn),
  window:{ addEventListener() {} }
});
vm.runInContext(read('js/startup.js'), startupContext);
for (const timer of [...startupTimers]) timer();
assert.equal(nodes.get('startup-actions').hidden, false);
assert.equal(nodes.get('app-startup')['aria-busy'], 'false');
startupContext.window.FinObraStartup.ready();
assert.equal(startupTimers.size, 0);
assert.ok(measures.includes('finobra:navigation-to-shell'));
console.log('✅ Tela inicial oferece recuperação e registra métricas locais sem dados pessoais.');
