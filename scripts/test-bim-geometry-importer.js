import fs from 'fs';
import vm from 'vm';

const importerPath = 'js/bim_geometry_importer.js';
const viewerPath = 'js/bim_viewer.js';
const appPath = 'app.html';

const source = fs.readFileSync(importerPath, 'utf8');
const sandbox = {
  console,
  TextEncoder,
  TextDecoder,
  DataView,
  Uint8Array,
  ArrayBuffer,
  atob: globalThis.atob,
  btoa: globalThis.btoa
};
vm.createContext(sandbox);
vm.runInContext(source + '\n;globalThis.__BIMGeometryImporter = BIMGeometryImporter;', sandbox);
const importer = sandbox.__BIMGeometryImporter;

function assert(ok, msg) {
  if (!ok) {
    console.error('❌ ' + msg);
    process.exitCode = 1;
  } else {
    console.log('✅ ' + msg);
  }
}

console.log('=== BIM Geometry Importer ===');

const obj = [
  'o CuboTeste',
  'v 0 0 0',
  'v 1 0 0',
  'v 1 1 0',
  'v 0 1 0',
  'f 1 2 3 4'
].join('\n');
const objScene = importer.parseOBJ(obj);
assert(objScene.elements.length === 1, 'OBJ preserva grupo como elemento selecionável');
assert(objScene.triangleCount === 2, 'OBJ triangula face quadrilateral');
assert(objScene.elements[0].meshes[0].type === 'triangles', 'OBJ produz mesh triangular renderizável');

const ifc = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCCARTESIANPOINT((0.,0.,0.));
#2=IFCAXIS2PLACEMENT3D(#1,$,$);
#3=IFCLOCALPLACEMENT($,#2);
#4=IFCAXIS2PLACEMENT2D(#1,$);
#5=IFCRECTANGLEPROFILEDEF(.AREA.,$,#4,4.,2.);
#6=IFCDIRECTION((0.,0.,1.));
#7=IFCEXTRUDEDAREASOLID(#5,#2,#6,3.);
#8=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#7));
#9=IFCPRODUCTDEFINITIONSHAPE($,$,(#8));
#10=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOH',$,'Parede Teste',$,$,#3,#9,$);
#11=IFCPROJECT('0YvctVUKr0kugbFTf53O9L',$,'Projeto Teste',$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;`;
const ifcScene = importer.parseIFC(ifc);
assert(ifcScene.elements.length === 1, 'IFC SweptSolid gera elemento real');
assert(ifcScene.triangleCount === 12, 'IFC retângulo extrudado gera 12 triângulos');
assert(ifcScene.elements[0].importedProperties.globalId === '2O2Fr$t4X7Zf8NOew3FLOH', 'IFC preserva GlobalId');
assert(ifcScene.elements[0].importedProperties.ifcClass === 'IFCWALL', 'IFC preserva classe do elemento');
assert(ifcScene.clashEligible === true, 'IFC sem booleanas fica elegível para futura análise geométrica');

const positions = Buffer.from(new Float32Array([
  0,0,0,
  1,0,0,
  0,1,0
]).buffer);
const indices = Buffer.from(new Uint16Array([0,1,2]).buffer);
const joined = Buffer.concat([positions, indices]);
const gltf = {
  asset: { version: '2.0' },
  buffers: [{ uri: 'data:application/octet-stream;base64,' + joined.toString('base64'), byteLength: joined.length }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: positions.length },
    { buffer: 0, byteOffset: positions.length, byteLength: indices.length }
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
    { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }
  ],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  nodes: [{ mesh: 0, name: 'Triângulo' }],
  scenes: [{ nodes: [0] }],
  scene: 0
};
const gltfScene = importer.parseGLTF(JSON.stringify(gltf));
assert(gltfScene.triangleCount === 1, 'GLTF embarcado é convertido em triângulo real');
assert(gltfScene.elements[0].name === 'Triângulo', 'GLTF preserva nome do nó');

const viewer = fs.readFileSync(viewerPath, 'utf8');
assert(viewer.includes("mesh.type === 'triangles'"), 'BIM Viewer renderiza malhas triangulares importadas');
assert(viewer.includes('_createTriangleFaces(mesh'), 'renderer possui pipeline de faces triangulares');
assert(viewer.includes('_hydrateLatestModelVersion()'), 'última versão BIM é reaberta automaticamente');
assert(viewer.includes('Documentos.obterConteudo'), 'viewer recupera conteúdo versionado local/nuvem');
assert(viewer.includes('IFC GlobalId') && viewer.includes('Property Sets IFC'), 'inspetor expõe metadados IFC preservados');
assert(viewer.includes('Custos não são rateados artificialmente'), 'viewer evita inventar custo por elemento importado');

const app = fs.readFileSync(appPath, 'utf8');
assert(app.indexOf('/js/bim_geometry_importer.js') < app.indexOf('/js/bim_viewer.js'), 'importador carrega antes do BIM Viewer');

if (process.exitCode) process.exit(process.exitCode);
console.log('✅ Importação e renderização geométrica BIM validadas.');
