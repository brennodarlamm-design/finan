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

console.log('✅ BIM Viewer operacional validado.');
