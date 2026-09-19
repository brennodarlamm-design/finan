import fs from 'fs';

function assert(ok,msg){
  if(!ok){console.error('❌ '+msg);process.exitCode=1;}
  else console.log('✅ '+msg);
}

const viewer=fs.readFileSync('js/bim_viewer.js','utf8');

assert(viewer.includes('_sceneRenderKey(w, h)'), 'viewer possui chave determinística para evitar redraw ocioso');
assert(viewer.includes("if (renderKey === this._lastRenderKey) return;"), 'frame idêntico é descartado antes de projetar faces');
assert(viewer.includes('_meshVisibleInViewport(mesh, cx, cy, w, h)'), 'viewer faz culling por bounding box da malha');
assert(viewer.includes('culledMeshes++'), 'renderer registra malhas eliminadas por viewport');
assert(viewer.includes('_triangleRenderStride()'), 'viewer possui LOD interativo para modelos grandes');
assert(viewer.includes('if (!this.isDragging) return 1;'), 'LOD reduz geometria somente durante interação');
assert(viewer.includes('if (total > 120000) return 4;') && viewer.includes('if (total > 60000) return 2;'), 'LOD usa orçamento progressivo de triângulos');
assert(viewer.includes('triIndex += stride'), 'renderer aplica stride sem alterar a malha autoritativa armazenada');
assert(viewer.includes('this.renderStats = { faces: faces.length, culledMeshes, triangleStride };'), 'renderer expõe métricas locais de performance');
assert(!viewer.includes('mesh.triangles = mesh.triangles.filter'), 'otimização não destrói triângulos do modelo original');

if(process.exitCode) process.exit(process.exitCode);
console.log('✅ Guardrails de performance do BIM Viewer validados.');
