import fs from 'fs';

const src = fs.readFileSync('js/bim_viewer.js', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
  console.log('✅ ' + message);
}

console.log('=== BIM Viewer Work PR — operational integration ===');

assert(src.includes('_getOperationalSnapshot(obraId)'), 'BIM monta snapshot operacional por obra');
assert(src.includes('DB.getOrcamentoVsRealizado'), 'BIM consome Orçado × Realizado canônico do DB');
assert(src.includes('DB.getResumo'), 'BIM consome resumo financeiro real da obra');
assert(src.includes('DB.getLancamentos'), 'BIM consome lançamentos reais da obra');
assert(src.includes('_applyOperationalData(snapshot)'), 'dados reais são aplicados após gerar a geometria');
assert(src.includes('Receita recebida') && src.includes('A receber'), 'resumo mostra receitas recebidas e a receber');
assert(src.includes('Avanço físico medido'), 'avanço físico usa medições quando disponíveis');
assert(src.includes('_recentLancamentosForElement'), 'painel BIM mostra lançamentos relacionados à etapa');
assert(src.includes("App.navigate('lancamentos')"), 'atalho abre os lançamentos filtrados pela obra');
assert(src.includes('data-action="toggleExpanded"') && src.includes('_toggleExpanded()'), 'visualizador possui modo expandido');
assert(src.includes("event.key === 'Escape'"), 'modo expandido pode ser fechado com Escape');
assert(src.includes('_renderFloorButtonsHtml(obra)'), 'seletor de pavimentos é renderizado com contexto da obra');
assert(src.includes('_getElementProperties(elem)'), 'inspetor expõe propriedades e quantitativos BIM');
assert(src.includes('IFCFOOTING / IFCBEAM') && src.includes('IFCROOF'), 'classes IFC de referência estão mapeadas por disciplina');
assert(src.includes('_meshPassesSection(mesh)') && src.includes("sectionMode: 'none'"), 'cortes X/Z filtram a geometria do viewer');
assert(src.includes('_inspectModelFile(file)') && src.includes("['ifc','obj','gltf','glb']"), 'importador valida IFC, OBJ, GLTF e GLB');
assert(src.includes("subtipo: 'bim_model'") && src.includes('_renderModelVersionsHtml'), 'modelos importados geram histórico de versões por obra');

const upload = fs.readFileSync('api/upload.js', 'utf8');
assert(upload.includes("'ifc', 'obj', 'gltf', 'glb'"), 'upload seguro permite formatos BIM/3D');
assert(upload.includes("exts: ['glb']") && upload.includes("magic: ['676C5446']"), 'GLB é validado pela assinatura glTF');
assert(upload.includes("lowerExt === 'ifc'") && upload.includes('ISO-10303-21'), 'IFC recebe validação estrutural antes do armazenamento');
assert(upload.includes("lowerExt === 'obj'") && upload.includes("Arquivo OBJ inválido"), 'OBJ exige vértices e faces');
assert(upload.includes("lowerExt === 'gltf'") && upload.includes('asset?.version'), 'GLTF exige JSON e asset.version');

console.log('✅ BIM Viewer operacional e importação BIM validados.');
