// scripts/test-patch17-static.js — Validação da Fase 1: Fila Offline & Sincronização Segura no Canteiro
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

console.log('=== Iniciando Testes Estáticos Patch 17 (Fila Offline & Canteiro) ===\n');

const dataJs = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

// ── [1] Data Layer: Inicialização e Conexão de Rede ──
console.log('[1] Data Layer & Conexão de Rede (js/data.js)');

test('DB define método init() com registro de listeners e checagem inicial', () => {
  if (!dataJs.includes('init() {')) throw new Error('DB deve ter método init');
  if (!dataJs.includes('this._bindNetworkListeners();')) throw new Error('init() deve chamar _bindNetworkListeners');
});

test('DB define _bindNetworkListeners com suporte a online e offline', () => {
  if (!dataJs.includes('_bindNetworkListeners() {')) throw new Error('DB deve definir _bindNetworkListeners');
  if (!dataJs.includes("window.addEventListener('online'")) throw new Error('Deve escutar evento online');
  if (!dataJs.includes("window.addEventListener('offline'")) throw new Error('Deve escutar evento offline');
});

test('Reconexão online tenta flush da fila e atualiza da nuvem se zerada', () => {
  if (!dataJs.includes("this._flushCloudQueue().then")) throw new Error('Evento online deve acionar flush da fila');
  if (!dataJs.includes("this.syncFromCloud()")) throw new Error('Deve puxar dados da nuvem quando a fila zerar');
});

// ── [2] Data Layer: Reconciliação Consciente de Fila (_reconcileCollection) ──
console.log('\n[2] Reconciliação Consciente de Fila (js/data.js)');

test('DB implementa método central _reconcileCollection', () => {
  if (!dataJs.includes('_reconcileCollection(table, cloudItems = [], localItems = [])')) throw new Error('Deve definir _reconcileCollection');
});

test('_reconcileCollection implementa expurgo de tombstones (deletes pendentes)', () => {
  if (!dataJs.includes("q?.payload?.action === 'delete'")) throw new Error('Deve checar ações de delete');
  if (!dataJs.includes('pendingDeletes.add(id)')) throw new Error('Deve coletar IDs deletados');
  if (!dataJs.includes('pendingDeletes.has(id)')) throw new Error('Deve descartar registros deletados do snapshot da nuvem');
});

test('_reconcileCollection prioriza saves pendentes offline sobre snapshot antigo', () => {
  if (!dataJs.includes("q?.payload?.action === 'save'")) throw new Error('Deve checar ações de save');
  if (!dataJs.includes('pendingSaves.set(id, item)')) throw new Error('Deve coletar saves pendentes');
  if (!dataJs.includes('{ ...cItem, ...localPending }')) throw new Error('Deve mesclar priorizando versão local pendente');
});

test('_reconcileCollection preserva registros locais criados offline', () => {
  if (!dataJs.includes('!resultMap.has(id)')) throw new Error('Deve verificar se registro local não existe na nuvem');
  if (!dataJs.includes('resultMap.set(id, lItem)')) throw new Error('Deve manter registro local criado offline');
});

// ── [3] Sincronização Cloud com Reconciliação Unificada ──
console.log('\n[3] Sincronização Cloud com Reconciliação Unificada');

test('syncFromCloud reconcilia clientes (obras)', () => {
  if (!dataJs.includes("this._reconcileCollection('clientes'")) throw new Error('clientes deve usar _reconcileCollection');
});

test('syncFromCloud reconcilia fornecedores', () => {
  if (!dataJs.includes("this._reconcileCollection('fornecedores'")) throw new Error('fornecedores deve usar _reconcileCollection');
});

test('syncFromCloud reconcilia lancamentos', () => {
  if (!dataJs.includes("this._reconcileCollection('lancamentos'")) throw new Error('lancamentos deve usar _reconcileCollection');
});

test('syncFromCloud reconcilia notas', () => {
  if (!dataJs.includes("this._reconcileCollection('notas'")) throw new Error('notas deve usar _reconcileCollection');
});

test('syncFromCloud reconcilia orcamentos e medicoes', () => {
  if (!dataJs.includes("this._reconcileCollection('orcamentos'")) throw new Error('orcamentos deve usar _reconcileCollection');
  if (!dataJs.includes("this._reconcileCollection('medicoes'")) throw new Error('medicoes deve usar _reconcileCollection');
});

test('syncFromCloud reconcilia contas, produtos e precompras', () => {
  if (!dataJs.includes("this._reconcileCollection('contas'")) throw new Error('contas deve usar _reconcileCollection');
  if (!dataJs.includes("this._reconcileCollection('produtos'")) throw new Error('produtos deve usar _reconcileCollection');
  if (!dataJs.includes("this._reconcileCollection('precompras'")) throw new Error('precompras deve usar _reconcileCollection');
});

test('syncFromCloud reconcilia contratos, recibos e orcamentos_sinapi', () => {
  if (!dataJs.includes("this._reconcileCollection('contratos'")) throw new Error('contratos deve usar _reconcileCollection');
  if (!dataJs.includes("this._reconcileCollection('recibos'")) throw new Error('recibos deve usar _reconcileCollection');
  if (!dataJs.includes("this._reconcileCollection('orcamentos_sinapi'")) throw new Error('orcamentos_sinapi deve usar _reconcileCollection');
});

test('syncFromCloud reconcilia documentos expurgando deletes pendentes', () => {
  if (!dataJs.includes("this._reconcileCollection('documentos'")) throw new Error('documentos deve usar _reconcileCollection');
});

// ── [4] Interface e Feedback Visual (js/app.js) ──
console.log('\n[4] Interface e Feedback Visual (js/app.js)');

test('App define refreshCurrentRoute preservando modais abertos', () => {
  if (!appJs.includes('refreshCurrentRoute() {')) throw new Error('App deve ter refreshCurrentRoute');
  if (!appJs.includes('modal-overlay')) throw new Error('Deve verificar se modal está aberto');
});

test('_setSyncStatus inclui estados ricos de offline, pendente, syncing e synced', () => {
  if (!appJs.includes('Offline — canteiro')) throw new Error('Deve ter estado descritivo para offline no canteiro');
  if (!appJs.includes('Sincronizando…')) throw new Error('Deve ter estado syncing');
  if (!appJs.includes('Sincronizado')) throw new Error('Deve ter estado synced');
  if (!appJs.includes('requer(em) atenção')) throw new Error('Deve ter estado attention');
});

console.log('\n========================================');
console.log(`Testes Patch 17: ${passed} passaram, ${total - passed} falharam.`);
console.log('========================================\n');

if (passed === total) {
  console.log('✅ Todas as verificações da Fase 1 (Patch 17) passaram com 100% de sucesso!');
} else {
  process.exit(1);
}
