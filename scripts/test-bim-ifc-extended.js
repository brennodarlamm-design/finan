import fs from 'fs';
import vm from 'vm';

const extendedSrc = fs.readFileSync('js/bim_ifc_extended.js','utf8');
const importerSrc = fs.readFileSync('js/bim_geometry_importer.js','utf8');
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
vm.runInContext(extendedSrc + '\n;globalThis.__EXT = BIMIFCExtendedImporter;', sandbox);
vm.runInContext(importerSrc + '\n;globalThis.__IMP = BIMGeometryImporter;', sandbox);
const ext = sandbox.__EXT;
const importer = sandbox.__IMP;

function assert(ok,msg){
  if(!ok){console.error('❌ '+msg);process.exitCode=1;}
  else console.log('✅ '+msg);
}

console.log('=== IFC Extended Tessellation ===');

const mappedIfc = `ISO-10303-21;
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
#9=IFCREPRESENTATIONMAP(#2,#8);
#10=IFCCARTESIANPOINT((10.,0.,0.));
#11=IFCCARTESIANTRANSFORMATIONOPERATOR3D($,$,#10,1.,$);
#12=IFCMAPPEDITEM(#9,#11);
#13=IFCSHAPEREPRESENTATION($,'Body','MappedRepresentation',(#12));
#14=IFCPRODUCTDEFINITIONSHAPE($,$,(#13));
#15=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOH',$,'Parede Mapeada',$,$,#3,#14,$);
#16=IFCBUILDINGSTOREY('3AAAA',$,'Térreo',$,$,#3,$,$,.ELEMENT.,0.);
#17=IFCRELCONTAINEDINSPATIALSTRUCTURE('rel',$,$,$,(#15),#16);
#18=IFCPROJECT('0YvctVUKr0kugbFTf53O9L',$,'Projeto',$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;`;

const mapped = importer.parseIFC(mappedIfc);
assert(mapped.elements.length===1,'MappedItem IFC gera um elemento renderizável');
assert(mapped.triangleCount===12,'MappedItem preserva a extrusão de 12 triângulos');
assert(mapped.elements[0].importedProperties.storeyName==='Térreo','pavimento IFC é associado ao elemento');
assert(mapped.elements[0].floor==='storey_16','chave de pavimento é preservada no viewer');
assert(mapped.elements[0].importedProperties.geometryKinds.includes('MappedItem'),'metadata registra MappedItem');
assert(mapped.clashEligible===true,'MappedItem sem booleanas permanece elegível para clash');

const tessIfc = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCCARTESIANPOINT((0.,0.,0.));
#2=IFCAXIS2PLACEMENT3D(#1,$,$);
#3=IFCLOCALPLACEMENT($,#2);
#20=IFCCARTESIANPOINTLIST3D(((0.,0.,0.),(2.,0.,0.),(0.,2.,0.)));
#21=IFCTRIANGULATEDFACESET(#20,$,.T.,((1,2,3)),$);
#22=IFCSHAPEREPRESENTATION($,'Body','Tessellation',(#21));
#23=IFCPRODUCTDEFINITIONSHAPE($,$,(#22));
#24=IFCSLAB('SLAB-GID',$,'Laje Tessellada',$,$,#3,#23,$);
#25=IFCPROJECT('P',$,'Projeto',$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;`;
const tess=ext.parse(tessIfc);
assert(tess.elements.length===1,'IfcTriangulatedFaceSet é aceito');
assert(tess.elements[0].rawTriangles.length===1,'face set produz triângulo real');
assert(tess.metadata.geometryKinds.includes('tessellated-face-set'),'metadata registra tessellated face set');

const brepIfc = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1=IFCCARTESIANPOINT((0.,0.,0.));
#2=IFCCARTESIANPOINT((2.,0.,0.));
#3=IFCCARTESIANPOINT((0.,2.,0.));
#4=IFCPOLYLOOP((#1,#2,#3));
#5=IFCFACEOUTERBOUND(#4,.T.);
#6=IFCFACE((#5));
#7=IFCCLOSEDSHELL((#6));
#8=IFCFACETEDBREP(#7);
#9=IFCAXIS2PLACEMENT3D(#1,$,$);
#10=IFCLOCALPLACEMENT($,#9);
#11=IFCSHAPEREPRESENTATION($,'Body','Brep',(#8));
#12=IFCPRODUCTDEFINITIONSHAPE($,$,(#11));
#13=IFCBUILDINGELEMENTPROXY('BREP-GID',$,'BRep Teste',$,$,#10,#12,$,$);
#14=IFCPROJECT('P',$,'Projeto',$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;`;
const brep=ext.parse(brepIfc);
assert(brep.elements[0].rawTriangles.length===1,'IfcFacetedBrep triangula face poligonal');
assert(brep.metadata.geometryKinds.includes('faceted-brep'),'metadata registra faceted BRep');

const openingIfc = mappedIfc.replace(
  "#18=IFCPROJECT",
  "#19=IFCOPENINGELEMENT('OPEN',$,'Abertura',$,$,#3,#14,$);\n#20=IFCRELVOIDSELEMENT('VOID',$,$,$,#15,#19);\n#18=IFCPROJECT"
);
const opening=ext.parse(openingIfc);
assert(opening.metadata.clashEligible===false,'host com IfcRelVoidsElement bloqueia clash autoritativo');
assert(opening.elements[0].importedProperties.partialReason==='opening-not-subtracted','abertura não subtraída é explicada no metadata');

const viewer=fs.readFileSync('js/bim_viewer.js','utf8');
assert(viewer.includes('id="bim-floor-panel"'),'viewer possui painel de pavimentos atualizável');
assert(viewer.includes("elem.importedProperties?.storeyName"),'inspetor mostra pavimento IFC');
assert(viewer.includes("option value=\"hidraulica\"")&&viewer.includes("option value=\"eletrica\""),'filtro inclui disciplinas MEP');

const app=fs.readFileSync('app.html','utf8');
assert(app.indexOf('/js/bim_ifc_extended.js') < app.indexOf('/js/bim_geometry_importer.js'),'tessellador IFC estendido carrega antes do importador');

if(process.exitCode) process.exit(process.exitCode);
console.log('✅ IFC estendido, pavimentos e guardrails validados.');
