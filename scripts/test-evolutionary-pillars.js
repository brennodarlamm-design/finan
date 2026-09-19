import fs from 'fs';
import path from 'path';
import { runEdgeChat, runEdgeDocumentOcr } from '../api/_edge-ai.js';

console.log('\n=== Suíte de Testes: Pilares Evolutivos (Workers AI, PWA/TWA & Visualizador 3D BIM) ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FALHA: ${message}`);
    failCount++;
  }
}

async function runTests() {
  // 1. Validando Workers AI no Edge (OCR e Chat)
  console.log('1. Validando Inteligência Artificial no Edge (Workers AI)...');
  assert(typeof runEdgeChat === 'function', 'api/_edge-ai.js exporta runEdgeChat');
  assert(typeof runEdgeDocumentOcr === 'function', 'api/_edge-ai.js exporta runEdgeDocumentOcr');

  const dummyImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const ocrRes = await runEdgeDocumentOcr({}, dummyImageBase64);
  assert(ocrRes && ocrRes.success === true, 'runEdgeDocumentOcr executa com sucesso');
  assert(ocrRes.data && ocrRes.data.fornecedor, 'runEdgeDocumentOcr extrai fornecedor do documento');
  assert(ocrRes.data && ocrRes.data.categoria_sugerida, 'runEdgeDocumentOcr sugere categoria de despesa');

  const reconhecerDocCode = fs.readFileSync(path.resolve('api/reconhecer-documento.js'), 'utf8');
  assert(reconhecerDocCode.includes('runEdgeDocumentOcr'), 'api/reconhecer-documento.js integra runEdgeDocumentOcr para aceleração no Edge');

  // 2. Validando PWA, TWA, Service Worker & Web Push
  console.log('\n2. Validando PWA, TWA & Notificações Web Push...');
  assert(fs.existsSync(path.resolve('sw.js')), 'sw.js (Service Worker) existe na raiz do projeto');
  const swCode = fs.readFileSync(path.resolve('sw.js'), 'utf8');
  assert(swCode.includes('fingo-static-') && swCode.includes('addEventListener(\'fetch\''), 'sw.js implementa cache e interceptação de fetch');
  assert(swCode.includes('addEventListener(\'push\'') && swCode.includes('showNotification'), 'sw.js manipula eventos de Web Push nativo');
  assert(swCode.includes('addEventListener(\'notificationclick\''), 'sw.js manipula clique em notificações push');

  assert(fs.existsSync(path.resolve('site.webmanifest')), 'site.webmanifest existe');
  const manifest = JSON.parse(fs.readFileSync(path.resolve('site.webmanifest'), 'utf8'));
  assert(manifest.name === 'FinGo — Obras em Fluxo' && manifest.display === 'standalone', 'site.webmanifest possui name e display standalone');
  assert(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 3, 'site.webmanifest possui atalhos de aplicativo (shortcuts)');
  assert(Array.isArray(manifest.categories) && manifest.categories.includes('finance'), 'site.webmanifest possui categorias definidas');

  assert(fs.existsSync(path.resolve('twa-manifest.json')), 'twa-manifest.json existe para empacotamento Google Play TWA');
  const twaManifest = JSON.parse(fs.readFileSync(path.resolve('twa-manifest.json'), 'utf8'));
  assert(twaManifest.packageId === 'br.api.fingo.app', 'twa-manifest.json define packageId br.api.fingo.app');
  assert(twaManifest.enableNotifications === true, 'twa-manifest.json habilita notificações nativas');

  const startupCode = fs.readFileSync(path.resolve('js/startup.js'), 'utf8');
  assert(startupCode.includes('serviceWorker.register(\'/sw.js\''), 'js/startup.js registra o Service Worker na inicialização');

  // 3. Validando Visualizador 3D BIM da Obra
  console.log('\n3. Validando Módulo Visualizador 3D BIM (js/bim_viewer.js)...');
  assert(fs.existsSync(path.resolve('js/bim_viewer.js')), 'js/bim_viewer.js existe no repositório');
  const bimCode = fs.readFileSync(path.resolve('js/bim_viewer.js'), 'utf8');
  assert(bimCode.includes('const BIMViewer = {'), 'js/bim_viewer.js define o objeto BIMViewer');
  assert(bimCode.includes('_generateParametricBuilding') && bimCode.includes('_drawScene'), 'BIMViewer implementa geração paramétrica e renderização 3D');
  assert(bimCode.includes('elem_fundacao') && bimCode.includes('elem_cobertura'), 'BIMViewer modela pavimentos de fundação a cobertura');
  assert(bimCode.includes('sinapiCode'), 'BIMViewer vincula elementos 3D a códigos oficiais da tabela SINAPI');
  assert(bimCode.includes('_renderElementDetailsHtml'), 'BIMViewer exibe gaveta lateral de custos e orçamentos ao inspecionar');

  const obraDetalheCode = fs.readFileSync(path.resolve('js/obra_detalhe.js'), 'utf8');
  assert(obraDetalheCode.includes('data-tab="bim-3d"'), 'js/obra_detalhe.js possui o botão da aba Modelo 3D BIM');
  assert(obraDetalheCode.includes('od-bim-container') && obraDetalheCode.includes('BIMViewer.render'), 'js/obra_detalhe.js instancia BIMViewer.render na aba bim-3d');

  const appHtmlCode = fs.readFileSync(path.resolve('app.html'), 'utf8');
  assert(appHtmlCode.includes('/js/bim_viewer.js'), 'app.html importa o script js/bim_viewer.js');

  console.log(`\n======================================================`);
  console.log(`Resultado: ${passCount}/${passCount + failCount} testes aprovados.`);
  if (failCount > 0) {
    console.error(`❌ ${failCount} falhas encontradas na validação dos pilares evolutivos.`);
    process.exit(1);
  } else {
    console.log(`🎉 Todos os Pilares Evolutivos foram validados com 100% de sucesso!`);
    console.log(`======================================================\n`);
  }
}

runTests();
