import fs from 'fs';

const content = fs.readFileSync('js/bim_viewer.js', 'utf8');

// Extrair todo o objeto BIMViewer ou a função _generateParametricBuilding
const startMarker = '  _generateParametricBuilding(obra) {';
const endMarker = '  _startRenderLoop() {';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

const funcBody = content.substring(startIdx + startMarker.length, endIdx).trim();
// Remover a última chave de fechamento se houver
const cleanBody = funcBody.replace(/\}\s*,\s*$/, '');

const mockViewer = {
  elements: []
};

const func = new Function('obra', cleanBody);
func.call(mockViewer, {});

console.log('Total de macro-disciplinas / elementos:', mockViewer.elements.length);
let totalOrcado = 0;
let totalRealizado = 0;
let totalMeshes = 0;

mockViewer.elements.forEach(elem => {
  totalOrcado += elem.orcado;
  totalRealizado += elem.realizado;
  totalMeshes += elem.meshes.length;
  console.log(`- [${elem.discipline.toUpperCase()}] ${elem.name} | ${elem.meshes.length} peças | Orçado: R$ ${elem.orcado.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | SINAPI: ${elem.sinapiCode}`);
});

console.log('---');
console.log('TOTAL ORÇADO: R$', totalOrcado.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
console.log('TOTAL REALIZADO: R$', totalRealizado.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
console.log('TOTAL DE PEÇAS 3D (MESHES):', totalMeshes);
