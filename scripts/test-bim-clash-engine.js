import fs from 'fs';
import vm from 'vm';

const src = fs.readFileSync('js/bim_clash_engine.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(src + '\n;globalThis.__BIMClashEngine = BIMClashEngine;', sandbox);
const engine = sandbox.__BIMClashEngine;

function assert(ok, msg) {
  if (!ok) {
    console.error('❌ ' + msg);
    process.exitCode = 1;
  } else {
    console.log('✅ ' + msg);
  }
}

const triA = [
  {x:-1,y:0,z:-1},
  {x:1,y:0,z:-1},
  {x:0,y:0,z:1}
];
const triB = [
  {x:0,y:-1,z:0},
  {x:0.7,y:1,z:0},
  {x:-0.7,y:1,z:0}
];
const triFar = triB.map(p => ({...p, x:p.x + 10}));

assert(Boolean(engine.triangleIntersection(triA, triB)), 'interseção 3D interna é detectada');
assert(!engine.triangleIntersection(triA, triFar), 'triângulos separados não geram falso clash');

const elem = (id, discipline, triangle) => ({
  id,
  name:id,
  discipline,
  importedProperties:{clashEligible:true},
  meshes:[{
    type:'triangles',
    triangles:[triangle],
    x:-2,y:-2,z:-2,w:4,h:4,d:4
  }]
});

const result = engine.detect([
  elem('estrutura','estrutural',triA),
  elem('tubulacao','hidraulica',triB)
], {maxClashes:10,maxComparisons:1000,interDisciplineOnly:true});

assert(result.clashes.length === 1, 'BVH confirma clash entre disciplinas distintas');
assert(result.clashes[0].method === 'triangle-bvh', 'resultado informa método geométrico');
assert(result.comparisons > 0, 'motor reporta comparações realizadas');

const sameDiscipline = engine.detect([
  elem('a','arquitetura',triA),
  elem('b','arquitetura',triB)
], {interDisciplineOnly:true});
assert(sameDiscipline.clashes.length === 0, 'modo inter-disciplinar ignora elementos da mesma disciplina');

const partial = elem('partial','hidraulica',triB);
partial.importedProperties.clashEligible = false;
const blocked = engine.detect([elem('a','estrutural',triA), partial]);
assert(blocked.clashes.length === 0 && blocked.eligibleElements === 1, 'geometria parcial fica fora da análise autoritativa');

const viewer = fs.readFileSync('js/bim_viewer.js', 'utf8');
assert(viewer.includes('BIMClashEngine.detect'), 'BIM Viewer usa o motor geométrico real');
assert(viewer.includes('Clash bloqueado: a geometria IFC desta versão é parcial.'), 'viewer bloqueia clash em IFC parcial');
assert(viewer.includes("origem:'clash_detection'"), 'clash pode virar pendência de coordenação');
assert(viewer.includes('interseção triângulo-triângulo'), 'painel explica o método de confirmação');

const app = fs.readFileSync('app.html','utf8');
assert(app.indexOf('/js/bim_clash_engine.js') < app.indexOf('/js/bim_viewer.js'), 'motor de clash carrega antes do viewer');

if (process.exitCode) process.exit(process.exitCode);
console.log('✅ Clash detection geométrico validado.');
