import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { sanitizeSlaProcesses } from '../api/_sla.js';

const read = file => fs.readFileSync(file, 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function runtime() {
  const storage = new Map(), events = {}, nodes = new Map();
  const context = vm.createContext({
    console, URLSearchParams, sanitizeSlaProcesses,
    Auth:{ getCurrentTenantId:() => 'audit-tenant' },
    Utils:{ today:() => '2026-09-14', toast() {}, escapeHtml:value => String(value ?? '') },
    localStorage:{ getItem:key => storage.get(key) ?? null, setItem:(key,value) => storage.set(key,String(value)), removeItem:key => storage.delete(key) },
    document:{ getElementById:id => nodes.get(id), addEventListener:(event,fn) => { events[event] = fn; } },
    window:{}
  });
  const load = (file,name) => vm.runInContext(`${read(file)}\n${name};`,context);
  const db = load('js/data.js','DB');
  db.canWriteLocal = () => true;
  const sent = [];
  db.syncToCloud = (...args) => sent.push(plain(args));
  const sla = load('js/cronograma_sla.js','CronogramaSLA');
  return {context,load,db,sla,sent,events,nodes};
}

const r = runtime();
assert.equal(r.sla.saveSlasEmpresa([{ ...r.sla.PADRAO_PROCESSOS[0], dias_sla:37 }]),true);
assert.equal(r.sent.at(-1)[2].preferences.slas_padrao[0].dias_sla,37);
const api = read('api/db.js');
vm.runInContext(api.slice(api.indexOf('function sanitizeTenantPreferences('),api.indexOf('function finitePercent(')),r.context);
vm.runInContext(api.slice(api.indexOf('function sanitizeCronogramaConfig('),api.indexOf('function todayBoaVista(')),r.context);
r.context.preferenceInput = r.sent.at(-1)[2].preferences;
const prefs = vm.runInContext('sanitizeTenantPreferences(preferenceInput)',r.context);
const second = runtime();
second.db._applyTenantPreferences(plain(prefs));
assert.equal(second.sla.getSlasEmpresa()[0].dias_sla,37,'Preferências retornadas pela API restauram os SLAs em outra sessão');

r.db.save('clientes',[{id:'obra-a',data_inicio:'2026-09-01',cronograma_config:{totalMeses:18}}]);
const processes = plain(r.sla.getObraProcessos('obra-a'));
processes[0].status = 'concluido'; processes[0].data_fim_real = '2026-09-10'; processes[0].observacoes = 'Vistoria concluída';
assert.equal(r.sla.salvarProcessosObra('obra-a',processes),true);
const saved = r.db.getById('clientes','obra-a');
assert.equal(saved.cronograma_config.totalMeses,18);
assert.equal(saved.data_previsao,saved.data_previsao_termino);
r.context.scheduleInput = saved.cronograma_config;
const schedule = plain(vm.runInContext('sanitizeCronogramaConfig(scheduleInput)',r.context));
const sql = new PGlite();
try {
  await sql.exec('CREATE TABLE audit_sla (id TEXT PRIMARY KEY, cronograma_config JSONB, data_previsao DATE)');
  await sql.query('INSERT INTO audit_sla VALUES ($1,$2::jsonb,$3)',[saved.id,JSON.stringify(schedule),saved.data_previsao]);
  const result = await sql.query('SELECT * FROM audit_sla');
  second.db.save('clientes',result.rows);
  const restored = second.sla.getObraProcessos('obra-a')[0];
  assert.equal(restored.status,'concluido');
  assert.equal(restored.observacoes,'Vistoria concluída');
  second.db.saveCronogramaConfig('obra-a',{totalMeses:24});
  assert.equal(second.db.getById('clientes','obra-a').cronograma_config.processos_sla[0].status,'concluido','Editar o cronograma financeiro preserva os SLAs');
} finally { await sql.close(); }
assert.equal(sanitizeSlaProcesses([{id:'a',dias_sla:9999},{id:'a'},{id:''}]).length,1);
assert.equal(sanitizeSlaProcesses([{id:'a',dias_sla:9999}])[0].dias_sla,365);
console.log('✅ SLAs: contrato de preferências, sanitização, persistência JSONB e recuperação em outra sessão.');

vm.runInContext('const PreCompras = { showForm() { globalThis.preCompraClicked = true; } };',r.context);
r.load('js/patch26-events.js','true');
const attrs = {'data-fb-click':'PreCompras.showForm','data-fb-click-n':'0'};
r.events.click({target:{closest:() => ({getAttribute:key => attrs[key] ?? null})},preventDefault(){}});
assert.equal(r.context.preCompraClicked,true,'Bridge encontra o módulo lexical de Pré-Compras');

const sinapi = r.load('js/sinapi.js','SINAPI');
const budgets = r.load('js/orcamento_sinapi.js','OrcamentoSINAPI');
const batchSource = {bdi:10,itens:[{descricao:'Concreto',quantidade:2,preco_unitario:100},{descricao:'Tapume',quantidade:4,preco_unitario:20}]};
const batch = budgets._previewQuantityAdjustment(batchSource,'concreto',50);
assert.equal(batch.changed,1);
assert.equal(batch.orc.itens[0].quantidade,3);
assert.equal(batch.orc.itens[0].total,330);
assert.equal(batch.orc.itens[1].quantidade,4);
assert.equal(batchSource.itens[0].quantidade,2,'A prévia não modifica o orçamento original');
assert.equal(budgets._previewQuantityAdjustment(batchSource,'',-100).orc.itens[0].quantidade,0);
assert.equal(budgets._previewQuantityAdjustment(batchSource,'',0).changed,0);
assert.throws(()=>budgets._previewQuantityAdjustment(batchSource,'',NaN));
assert.equal(budgets._matchesGridFilter({descricao:'Execução de fundação',etapa_nome:'Estrutura'}, 'FUNDAcao'),true);
assert.equal(budgets._matchesGridFilter({codigo_sinapi:'98458'}, '98458'),true);
assert.equal(budgets._matchesGridFilter({descricao:'Concreto'}, 'zzznomatch'),false);
assert.equal(budgets._matchesGridFilter({descricao:'Concreto'}, ''),true);
budgets._add({id:'orc-a',obra_id:'obra-a',uf:'AM',referencia_sinapi:'2026-07',desonerado:false,itens:[],bdi:0});
sinapi._saveBase({composicoes:[{codigo:'98458',descricao:'Tapume',unidade:'M2',preco_unitario:999}]},false,'AM','2026-07');
r.nodes.set('sinapi-quick-dropdown',{style:{},innerHTML:''});
budgets._onQuickSearchInput('orc-a','98458');
assert.equal(budgets._lastSearchResults[0].preco_unitario,999);
budgets._onQuickSearchInput('orc-a','sem-resultados');
budgets._onQuickSearchKeyDown({key:'Enter',preventDefault(){}},'orc-a');
assert.equal(budgets._getById('orc-a').itens.length,0);
const budget = budgets._getById('orc-a');
budget.bancos_config = {bancos:[{id:'sinapi',checked:false}]}; budgets._save(budget);
budgets._onQuickSearchInput('orc-a','98458');
assert.equal(budgets._lastSearchResults.length,0,'Banco desmarcado não participa da pesquisa');
budget.bancos_config.bancos[0].checked = true; budget.uf = 'SP'; budgets._save(budget);
budgets._onQuickSearchInput('orc-a','98458');
assert.equal(budgets._lastSearchResults.length,0,'A pesquisa não usa preços de outra UF');
assert.equal(typeof budgets.showImportModal,'function');
assert.equal(typeof budgets.executarImport,'function');
// Salvar e editar devem preservar zero e chamar o callback correto do diálogo.
r.context.FormData = class {
  *[Symbol.iterator]() { yield* Object.entries({obra_id:'obra-a',nome:'Orçamento',uf:'AM',referencia_sinapi:'2026-07',bdi:'0',desonerado:'false',status:'ativo'}); }
};
r.nodes.set('f-sinapi-orc',{checkValidity:() => true});
r.context.Utils.closeModal = () => {};
budgets._refresh = () => {};
budgets.openEditor = () => {};
budgets.save('orc-a');
assert.equal(budgets._getById('orc-a').bdi,0);
r.context.Utils.prompt = (_title,callback) => { assert.equal(typeof callback,'function'); callback('Estrutura'); };
budgets.incluirEtapa('orc-a');
assert.ok(budgets._getById('orc-a').etapas.includes('Estrutura'));
r.context.Utils.prompt = (_title,callback) => { assert.equal(typeof callback,'function'); callback('10'); };
budgets.editarParametro('orc-a','bdi');
assert.equal(budgets._getById('orc-a').bdi,10);

const banks = r.load('js/orcamento_bancos.js','OrcamentoBancos');
const updatedBudget = budgets._getById('orc-a');
updatedBudget.itens = [{codigo:'98458',banco:'SINAPI',quantidade:0,preco_unitario:85.4}];
const repriced = banks._recalcularItensDoOrcamento(updatedBudget);
assert.equal(repriced.updated,1);
assert.equal(updatedBudget.itens[0].preco_unitario,999);
assert.equal(updatedBudget.itens[0].total,0);
assert.deepEqual(plain(budgets.calcularTotais({bdi:10,itens:[{quantidade:1,preco_unitario:999,total:1098.9}]})),{subtotal:999,bdi:10,valorBDI:99.9,totalGeral:1098.9},'BDI é aplicado uma vez, sem usar o total já majorado');
assert.equal(budgets.calcularTotais({bdi:0,itens:[{quantidade:2,preco_unitario:12.5}]}).totalGeral,25);
assert.equal(budgets.calcularTotais({bdi:10,itens:[{quantidade:3,preco_unitario:0.05}]}).totalGeral,0.18,'O total acompanha o arredondamento do preço com BDI exibido nas linhas');

const portal = r.load('js/portal_cliente.js','PortalCliente');
let signatureCalls = 0;
r.context.Assinador = {abrirModal() { signatureCalls++; }};
portal._activeBundle = {ctr:[{id:'contract',ass:false}]};
portal.assinarDocumentoCliente('contract','obra-a');
assert.equal(signatureCalls,0,'Portal não coleta assinatura sem persistência externa implementada');
assert.equal(portal._activeBundle.ctr[0].ass,false);
console.log('✅ Botões e SINAPI: raiz de Pré-Compras, importação disponível, preço da base correta e busca sem resultado antigo.');

const routes = [];
const backendContext = vm.createContext({
  console, process:{env:{}},
  Router:() => ({get:(path,...handlers) => routes.push({path,handlers}),post:(path,...handlers) => routes.push({path,handlers})})
});
const robotSource = read('backend/sinapi_robot.js').replace(/^import .*;\r?$/gm,'').replace(/export /g,'');
const backend = vm.runInContext(`${robotSource}\n({createSinapiRouter,runBulkSinapiIngest,RobotState});`,backendContext);
backend.createSinapiRouter();
const run = routes.find(route => route.path === '/robot/run');
let status;
run.handlers[0]({}, {status:value => { status=value; return {json(){}}; }});
assert.equal(status,401);
assert.equal((await backend.runBulkSinapiIngest('invalid')).code,'INVALID_REFERENCE');
assert.equal((await backend.runBulkSinapiIngest('2026-07')).code,'IMPORT_NOT_IMPLEMENTED');
assert.equal(backend.RobotState.totalItemsIngested,0);
assert.match(read('backend/server.js'),/createSinapiRouter\(\{ authorizeRobot: requireAuth \}\)/);
console.log('✅ Robô: acesso fechado por padrão e nenhum sucesso fictício de ingestão.');
