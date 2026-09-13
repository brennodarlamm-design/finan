import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = [];
const context = vm.createContext({
  console, Utils:{ toast() {} },
  document:{ createElement:() => ({ remove() {} }), head:{ appendChild:script => scripts.push(script) } }
});
context.window = context;
const assets = vm.runInContext(fs.readFileSync('js/assets.js', 'utf8') + '\nFinObraAssets;', context);
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
assert.equal(scripts.length, 0, 'Nenhum recurso opcional é solicitado na inicialização');
assert.equal(assets.ready('__proto__'), false);
await assert.rejects(assets.load('https://example.com/script.js'), /não permitido/);
await assert.rejects(assets.load('__proto__'), /não permitido/);
const first = assets.load('excel');
assert.equal(assets.load('excel'), first, 'Chamadas simultâneas compartilham download');
await tick();
assert.equal(scripts.length, 1);
context.XLSX = {};
scripts[0].onload();
await first;
await assets.load('excel');
assert.equal(scripts.length, 1, 'Recurso pronto não é baixado novamente');
const failed = assets.load('zip');
await tick();
scripts.at(-1).onerror();
await assert.rejects(failed, /conexão/);
const retry = assets.load('zip');
await tick();
context.JSZip = {};
scripts.at(-1).onload();
await retry;
const reports = assets.load('reports');
await tick();
assert.equal(scripts.at(-1).src, '/js/sinapi.js');
vm.runInContext('const SINAPI = {};', context);
scripts.at(-1).onload();
await tick();
assert.equal(scripts.at(-1).src, '/js/orcamento_sinapi.js');
vm.runInContext('const OrcamentoSINAPI = {};', context);
scripts.at(-1).onload();
await tick();
assert.equal(scripts.at(-1).src, '/js/exportar_templates.js');
vm.runInContext('const ExportarTemplates = {};', context);
scripts.at(-1).onload();
await reports;
assert.equal(assets.ready('reports'), true);
console.log('✅ Assets: demanda, deduplicação, retry, allowlist e ordem das dependências.');

// O bridge precisa encontrar const declaradas depois que seus listeners foram criados.
const listeners = {};
const bridge = vm.createContext({ console, document:{ addEventListener:(event, fn) => listeners[event] = fn } });
vm.runInContext(fs.readFileSync('js/patch26-events.js', 'utf8'), bridge);
vm.runInContext('const OrcamentoSINAPI = { showForm() { globalThis.clicked = true; } };', bridge);
listeners.click({ target:{ closest:() => ({ getAttribute:name => name === 'data-fb-click' ? 'OrcamentoSINAPI.showForm' : '0' }) } });
assert.equal(bridge.clicked, true);

let finish;
const content = { innerHTML:'' };
const history = [];
const appContext = vm.createContext({
  console, Auth:{ canRoute:() => true }, Utils:{ escapeHtml:value => String(value) },
  FinObraAssets:{ ready:() => false, load:() => new Promise(resolve => { finish = resolve; }) },
  window:{ location:{ pathname:'/app/dashboard', hash:'' }, addEventListener() {} },
  history:{ pushState:(_state, _title, path) => history.push(path) },
  document:{ querySelectorAll:() => [], getElementById:id => id === 'route-content' ? content : null }
});
for (const name of ['Dashboard','Clientes','Lancamentos','Escritorio','PreCompras','Recibos','Contratos','Notas','NFe','OFX','Orcamentos','Medicoes','FasesDoc','Exportar','Contas','Configuracoes','Fornecedores','Produtos']) {
  appContext[name] = { render:() => name };
}
const app = vm.runInContext(fs.readFileSync('js/app.js', 'utf8') + '\nApp;', appContext);
const loading = app.navigate('relatorios');
assert.match(content.innerHTML, /Carregando/);
await app.navigate('dashboard');
finish();
await loading;
assert.equal(content.innerHTML, 'Dashboard', 'Download antigo não sobrescreve navegação mais recente');
const reportNav = app.navigate('relatorios');
finish();
await reportNav;
assert.equal(content.innerHTML, 'Exportar');
assert.equal(history.at(-1), '/app/relatorios');
console.log('✅ Navegação: módulo tardio funciona no bridge e não substitui a rota mais recente.');

const html = fs.readFileSync('app.html', 'utf8');
const tags = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)];
assert.ok(tags.every(([tag]) => /\bdefer\b/.test(tag)), 'Scripts iniciais preservam ordem sem bloquear o parser');
for (const optional of ['xlsx.full.min.js','jszip.min.js','jspdf.umd.min.js','pdfjs_bootstrap.js','sinapi.js','orcamento_sinapi.js','exportar_templates.js','master.js']) {
  assert.ok(tags.every(([, src]) => src.split('?')[0].split('/').at(-1) !== optional), optional + ' não deve estar na abertura');
}
assert.match(fs.readFileSync('master.html','utf8'), /src="\/js\/master.js"/, 'Portal Master mantém seu módulo');
console.log(`✅ Abertura: ${tags.length} scripts com defer; bibliotecas opcionais fora do caminho inicial.`);
