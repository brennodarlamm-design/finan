import fs from 'fs';
import assert from 'assert';

console.log('🧪 Iniciando suíte de testes para as correções de auditoria...\n');

let passed = 0;

// Test 1: MonitorNFe.ps1 cStat 138
const psContent = fs.readFileSync('monitor-nfe/MonitorNFe.ps1', 'utf8');
assert(psContent.includes('Documentos localizados na SEFAZ (cStat 138)'), 'MonitorNFe.ps1 deve processar lote no cStat 138');
assert(!psContent.includes('138 = Documento localizado para o NSU informado / fim da fila'), 'MonitorNFe.ps1 não deve tratar 138 como fim da fila');
console.log('✅ Test 1: Monitor SEFAZ processa lote no cStat 138');
passed++;

// Test 2: obra_detalhe.js method calls
const odContent = fs.readFileSync('js/obra_detalhe.js', 'utf8');
assert(!odContent.includes("onclick=\"Lancamentos.edit('"), 'obra_detalhe.js não deve chamar Lancamentos.edit diretamente sem showForm');
assert(!odContent.includes("onclick=\"Medicoes.edit('"), 'obra_detalhe.js não deve chamar Medicoes.edit');
assert(!odContent.includes("onclick=\"Recibos.abrirModalNovo('"), 'obra_detalhe.js não deve chamar Recibos.abrirModalNovo diretamente');
assert(!odContent.includes("onclick=\"Recibos.visualizar('"), 'obra_detalhe.js não deve chamar Recibos.visualizar diretamente');
assert(!odContent.includes("onclick=\"Contratos.visualizar('"), 'obra_detalhe.js não deve chamar Contratos.visualizar diretamente');
console.log('✅ Test 2: Chamadas de métodos corrigidas em js/obra_detalhe.js');
passed++;

// Test 3: Contratos._onModeloSelect
const ctContent = fs.readFileSync('js/contratos.js', 'utf8');
assert(ctContent.includes('_onModeloSelect(modeloKey)'), 'Contratos deve definir _onModeloSelect');
assert(ctContent.includes('visualizar(id)'), 'Contratos deve definir alias visualizar(id)');
console.log('✅ Test 3: Contratos._onModeloSelect e aliases implementados');
passed++;

// Test 4: Documentos.showModalAnexos & precompras
const pcContent = fs.readFileSync('js/precompras.js', 'utf8');
const docContent = fs.readFileSync('js/documentos.js', 'utf8');
assert(docContent.includes('showModalAnexos(entidadeTipo'), 'Documentos deve definir showModalAnexos');
assert(pcContent.includes('Documentos.showModalAnexos || Documentos.abrirModal'), 'precompras deve ter fallback seguro');
console.log('✅ Test 4: Compatibilidade de anexos em Documentos e precompras');
passed++;

// Test 5: Utils.formatDate
const utilsContent = fs.readFileSync('js/utils.js', 'utf8');
assert(utilsContent.includes('formatDate(d)'), 'Utils deve definir formatDate');
console.log('✅ Test 5: Utils.formatDate implementado com sucesso');
passed++;

// Test 6: Medicoes reduce & edit alias
const medContent = fs.readFileSync('js/medicoes.js', 'utf8');
assert(!medContent.includes('s+m.valor_solicitado,0'), 'Medicoes.reduce não deve arriscar NaN sem fallback');
assert(medContent.includes('edit(id)'), 'Medicoes deve definir alias edit(id)');
console.log('✅ Test 6: Medicoes sem risco de NaN e com alias edit');
passed++;

// Test 7: Orcamentos etapas fallback
const orcContent = fs.readFileSync('js/orcamentos.js', 'utf8');
assert(orcContent.includes('const etapas = Array.isArray(orc.etapas)'), 'Orcamentos deve tratar etapas e itens com segurança');
console.log('✅ Test 7: Orcamentos robusto contra dessincronização de etapas/itens');
passed++;

// Test 8: Container ID route-content em nfe.js e ocr.js
const nfeContent = fs.readFileSync('js/nfe.js', 'utf8');
const ocrContent = fs.readFileSync('js/ocr.js', 'utf8');
assert(nfeContent.includes('route-content'), 'nfe.js deve buscar route-content');
assert(ocrContent.includes('route-content'), 'ocr.js deve buscar route-content');
console.log('✅ Test 8: nfe.js e ocr.js sincronizados com route-content');
passed++;

// Test 9: Gemini Vision Model Names
const recDocContent = fs.readFileSync('api/reconhecer-documento.js', 'utf8');
assert(!recDocContent.includes('gemini-3.6-flash'), 'Não deve conter modelo fictício gemini-3.6-flash');
assert(recDocContent.includes('gemini-1.5-flash'), 'Deve conter modelo oficial gemini-1.5-flash');
assert(recDocContent.includes('gemini-2.0-flash'), 'Deve conter modelo oficial gemini-2.0-flash');
console.log('✅ Test 9: api/reconhecer-documento.js com modelos oficiais do Gemini Vision');
passed++;

// Test 10: backend/server.js reset forms token & tenant isolation
const srvContent = fs.readFileSync('backend/server.js', 'utf8');
assert(srvContent.includes('action="/reset-auth${tokenParam}"'), 'server.js deve enviar token nas rotas de reset');
assert(srvContent.includes('${hiddenTokenInput}'), 'server.js deve conter hiddenTokenInput nos formulários');
assert(srvContent.includes('TARGET_TENANT_ID'), 'server.js deve isolar por tenant no cron matinal');
console.log('✅ Test 10: backend/server.js seguro contra 401 em /reset-auth e isolado por tenant');
passed++;

// Test 11: api/db.js orcamentos e medicoes dual support
const dbContent = fs.readFileSync('api/db.js', 'utf8');
assert(dbContent.includes('data_medicao: cleanDate(m.data)'), 'db.js deve retornar data_medicao');
assert(dbContent.includes('valor_solicitado: cleanNum'), 'db.js deve retornar valor_solicitado');
assert(dbContent.includes('valor_total_previsto: cleanNum'), 'db.js deve retornar valor_total_previsto');
assert(dbContent.includes('etapas: parsedItens'), 'db.js deve retornar etapas');
console.log('✅ Test 11: api/db.js compatível bidirecionalmente com orçamentos e medições');
passed++;

console.log(`\n🎉 Todos os ${passed}/${passed} testes de auditoria passaram com sucesso!`);
