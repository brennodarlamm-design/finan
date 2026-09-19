import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { performance } from 'node:perf_hooks';

const ROOT = process.cwd();
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_TRIANGLES = 150000;
const MAX_PARSE_MS = Number(process.env.BIM_QA_MAX_PARSE_MS || 6000);
const MAX_COORDINATION_MS = Number(process.env.BIM_QA_MAX_COORDINATION_MS || 10000);

const fixtures = [
  {
    id:'ifc2x3-architecture',
    file:'tests/fixtures/bim-real/ifc2x3-building-architecture.ifc',
    expectedSchema:/^IFC2X3/i,
    source:'buildingSMART Certification-datasets / IFC2x3 Simple-Scene / Building-Architecture'
  },
  {
    id:'ifc4-opening-window',
    file:'tests/fixtures/bim-real/ifc4-wall-opening-window.ifc',
    expectedSchema:/^IFC4/i,
    source:'buildingSMART Certification-datasets / IFC4 ReferenceView / wall-with-opening-and-window'
  },
  {
    id:'ifc4-architecture',
    file:'tests/fixtures/bim-real/ifc4-building-architecture.ifc',
    expectedSchema:/^IFC4/i,
    source:'buildingSMART Certification-datasets / IFC4 Simple-Scene / Building-Architecture'
  },
  {
    id:'ifc4-hvac',
    file:'tests/fixtures/bim-real/ifc4-building-hvac.ifc',
    expectedSchema:/^IFC4/i,
    source:'buildingSMART Certification-datasets / IFC4 Simple-Scene / Building-Hvac'
  },
  {
    id:'ifc4-structural',
    file:'tests/fixtures/bim-real/ifc4-building-structural.ifc',
    expectedSchema:/^IFC4/i,
    source:'buildingSMART Certification-datasets / IFC4 Simple-Scene / Building-Structural'
  },
  {
    id:'ifc43-architecture',
    file:'tests/fixtures/bim-real/ifc43-building-architecture.ifc',
    expectedSchema:/^IFC4X3/i,
    source:'buildingSMART Certification-datasets / IFC4.3 Simple-Scene / Building-Architecture'
  }
];

const productType = /^IFC(WALL|WALLSTANDARDCASE|SLAB|BEAM|COLUMN|FOOTING|ROOF|COVERING|DOOR|WINDOW|STAIR|MEMBER|PLATE|CURTAINWALL|BUILDINGELEMENTPROXY|FLOWSEGMENT|PIPESEGMENT|DUCTSEGMENT|CABLESEGMENT)$/;

function loadRuntime(){
  const sandbox={
    console,
    TextEncoder,
    TextDecoder,
    DataView,
    Uint8Array,
    ArrayBuffer,
    atob:globalThis.atob,
    btoa:globalThis.btoa
  };
  vm.createContext(sandbox);
  const csg=fs.readFileSync(path.join(ROOT,'js/bim_csg.js'),'utf8');
  const ext=fs.readFileSync(path.join(ROOT,'js/bim_ifc_extended.js'),'utf8');
  const importer=fs.readFileSync(path.join(ROOT,'js/bim_geometry_importer.js'),'utf8');
  const clash=fs.readFileSync(path.join(ROOT,'js/bim_clash_engine.js'),'utf8');
  vm.runInContext(csg+'\n;globalThis.__CSG=BIMCSG;',sandbox);
  vm.runInContext(ext+'\n;globalThis.__EXT=BIMIFCExtendedImporter;',sandbox);
  vm.runInContext(importer+'\n;globalThis.__IMP=BIMGeometryImporter;',sandbox);
  vm.runInContext(clash+'\n;globalThis.__CLASH=BIMClashEngine;',sandbox);
  return {ext:sandbox.__EXT,importer:sandbox.__IMP,clash:sandbox.__CLASH};
}

function countMap(values){
  const out={};
  for(const value of values){
    const key=String(value??'unknown');
    out[key]=(out[key]||0)+1;
  }
  return Object.fromEntries(Object.entries(out).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])));
}

function sourceProducts(src){
  const out=[];
  const re=/#(\d+)\s*=\s*(IFC[A-Z0-9_]+)\s*\(/gi;
  let m;
  while((m=re.exec(src))){
    const type=m[2].toUpperCase();
    if(productType.test(type)) out.push({stepId:Number(m[1]),type});
  }
  return out;
}

function finitePoint(p){
  return p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}

function inspectScene(scene,src){
  const ids=new Set();
  let duplicateIds=0,invalidTriangles=0,eligible=0,partial=0;
  const classes=[],disciplines=[],partialReasons=[];
  for(const element of scene.elements||[]){
    if(ids.has(element.id)) duplicateIds++; else ids.add(element.id);
    const props=element.importedProperties||{};
    classes.push(props.ifcClass||element.category||'unknown');
    disciplines.push(element.discipline||'unknown');
    if(props.clashEligible===false){
      partial++;
      if(props.partialReason) partialReasons.push(props.partialReason);
    } else eligible++;
    for(const mesh of element.meshes||[]){
      if(mesh.type!=='triangles') continue;
      for(const tri of mesh.triangles||[]){
        if(!Array.isArray(tri)||tri.length!==3||!tri.every(finitePoint)) invalidTriangles++;
      }
    }
  }
  const candidates=sourceProducts(src);
  const importedSteps=new Set((scene.elements||[]).map(e=>Number(e.importedProperties?.stepId)).filter(Number.isFinite));
  const unsupported=candidates.filter(p=>!importedSteps.has(p.stepId));
  return {
    eligibleElements:eligible,
    partialElements:partial,
    partialRatio:(scene.elements?.length||0)?partial/(scene.elements.length):0,
    duplicateIds,
    invalidTriangles,
    candidateProducts:candidates.length,
    importCoverage:candidates.length?(scene.elements.length/candidates.length):1,
    unsupportedCandidateProducts:unsupported.length,
    unsupportedClasses:countMap(unsupported.map(x=>x.type)),
    ifcClasses:countMap(classes),
    disciplines:countMap(disciplines),
    partialReasons:countMap(partialReasons)
  };
}

function bboxForTriangles(triangles){
  const pts=(triangles||[]).flat();
  if(!pts.length) return {x:0,y:0,z:0,w:0,h:0,d:0};
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),zs=pts.map(p=>p.z);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  return {x:minX,y:minY,z:minZ,w:maxX-minX,h:maxY-minY,d:maxZ-minZ};
}

function toClashElement(element,prefix){
  const bb=bboxForTriangles(element.rawTriangles||[]);
  return {
    id:prefix+':'+element.id,
    name:element.name,
    discipline:element.discipline,
    importedProperties:element.importedProperties||{},
    meshes:[{type:'triangles',triangles:element.rawTriangles||[],...bb}]
  };
}

function pass(condition,message,errors){
  if(!condition) errors.push(message);
}

function parseArgs(){
  const out={json:null,markdown:null};
  for(const arg of process.argv.slice(2)){
    if(arg.startsWith('--json=')) out.json=arg.slice('--json='.length);
    if(arg.startsWith('--markdown=')) out.markdown=arg.slice('--markdown='.length);
  }
  return out;
}

function fmtPct(v){return (v*100).toFixed(1)+'%';}
function fmtMs(v){return Number(v).toFixed(1)+' ms';}

function markdownReport(report){
  const lines=[
    '# FinGo BIM — Real IFC QA Report',
    '',
    'Generated: '+report.generatedAt,
    '',
    '## Acceptance',
    '',
    report.ok?'**PASS** — all mandatory real-model QA gates passed.':'**FAIL** — one or more mandatory real-model QA gates failed.',
    '',
    '| Fixture | Schema | Size | Elements | Triangles | Eligible | Partial | Coverage | Parse | Result |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
  ];
  for(const r of report.fixtures){
    lines.push(`| ${r.id} | ${r.schema} | ${(r.bytes/1024).toFixed(1)} KB | ${r.elements} | ${r.triangles} | ${r.eligibleElements} | ${r.partialElements} | ${fmtPct(r.importCoverage)} | ${fmtMs(r.parseMs)} | ${r.ok?'PASS':'FAIL'} |`);
  }
  lines.push(
    '',
    '## Coordination smoke',
    '',
    `Architecture + Structural + HVAC (raw IFC coordinates): **${report.coordination.ok?'PASS':'FAIL'}**`,
    '',
    `- Elements sampled: ${report.coordination.elements}`,
    `- Eligible elements seen by clash engine: ${report.coordination.eligibleElements}`,
    `- Triangle/BVH comparisons: ${report.coordination.comparisons}`,
    `- Confirmed clashes: ${report.coordination.clashes}`,
    `- Duration: ${fmtMs(report.coordination.durationMs)}`,
    '',
    '## Compatibility observations',
    ''
  );
  for(const r of report.fixtures){
    lines.push(`### ${r.id}`,`- Geometry kinds: ${(r.geometryKinds||[]).join(', ')||'none'}`,`- Partial reasons: ${Object.keys(r.partialReasons).length?JSON.stringify(r.partialReasons):'none'}`,`- Unsupported candidate classes: ${Object.keys(r.unsupportedClasses).length?JSON.stringify(r.unsupportedClasses):'none'}`,`- Errors: ${r.errors.length?r.errors.join('; '):'none'}`,'');
  }
  if(report.errors.length) lines.push('## Overall errors','',...report.errors.map(x=>'- '+x),'');
  lines.push('> This report validates FinGo viewer compatibility and deterministic geometry handling. It is not a buildingSMART normative conformance certificate.');
  return lines.join('\n');
}

const {ext,importer,clash}=loadRuntime();
const results=[];
const sourceById=new Map();
const rawById=new Map();
const overallErrors=[];

for(const fixture of fixtures){
  const file=path.join(ROOT,fixture.file);
  const src=fs.readFileSync(file,'utf8');
  sourceById.set(fixture.id,src);
  const bytes=Buffer.byteLength(src);
  const heapBefore=process.memoryUsage().heapUsed;
  const t0=performance.now();
  let scene,error=null;
  try{scene=importer.parseIFC(src);}catch(err){error=err;}
  const parseMs=performance.now()-t0;
  const heapDelta=Math.max(0,process.memoryUsage().heapUsed-heapBefore);
  const errors=[];
  let row={
    id:fixture.id,
    file:fixture.file,
    source:fixture.source,
    bytes,
    parseMs,
    heapDeltaBytes:heapDelta,
    schema:null,
    elements:0,
    triangles:0,
    eligibleElements:0,
    partialElements:0,
    partialRatio:0,
    candidateProducts:0,
    importCoverage:0,
    unsupportedCandidateProducts:0,
    unsupportedClasses:{},
    ifcClasses:{},
    disciplines:{},
    partialReasons:{},
    geometryKinds:[],
    storeys:0,
    errors
  };
  if(error){
    errors.push('parse failed: '+(error?.message||error));
  }else{
    const inspected=inspectScene(scene,src);
    Object.assign(row,inspected,{
      schema:scene.schema||'unknown',
      elements:scene.elements?.length||0,
      triangles:scene.triangleCount||0,
      geometryKinds:scene.geometryKinds||[],
      storeys:scene.storeys?.length||0
    });
    pass(fixture.expectedSchema.test(row.schema),'unexpected schema '+row.schema,errors);
    pass(row.elements>0,'no renderable elements',errors);
    pass(row.triangles>0,'no triangles',errors);
    pass(row.eligibleElements>0,'no clash-eligible element in fixture',errors);
    pass(row.triangles<=MAX_TRIANGLES,'triangle budget exceeded',errors);
    pass(inspected.invalidTriangles===0,'invalid/non-finite triangle coordinates',errors);
    pass(inspected.duplicateIds===0,'duplicate imported element ids',errors);
    pass(bytes<=MAX_UPLOAD_BYTES,'fixture exceeds current 15 MB upload limit',errors);
    pass(parseMs<=MAX_PARSE_MS,`parse exceeded ${MAX_PARSE_MS} ms`,errors);
  }
  row.ok=errors.length===0;
  results.push(row);
  if(!row.ok) overallErrors.push(...errors.map(e=>fixture.id+': '+e));
  console.log(`${row.ok?'✅':'❌'} ${fixture.id}: ${row.elements} elements, ${row.triangles} triangles, ${row.eligibleElements} eligible, ${fmtPct(row.partialRatio)} partial, ${fmtMs(row.parseMs)}`);
}

// Cross-version architectural sanity: the official IFC4 and IFC4.3 Simple-Scene variants should remain in the same order of magnitude.
const a4=results.find(x=>x.id==='ifc4-architecture');
const a43=results.find(x=>x.id==='ifc43-architecture');
if(a4?.ok&&a43?.ok){
  const elementRatio=a43.elements/Math.max(1,a4.elements);
  const triangleRatio=a43.triangles/Math.max(1,a4.triangles);
  if(elementRatio<0.5||elementRatio>2) overallErrors.push(`IFC4→IFC4.3 architecture element ratio suspicious: ${elementRatio.toFixed(3)}`);
  if(triangleRatio<0.5||triangleRatio>2) overallErrors.push(`IFC4→IFC4.3 architecture triangle ratio suspicious: ${triangleRatio.toFixed(3)}`);
}

// Real coordination smoke keeps raw IFC coordinates so aligned discipline models remain comparable.
for(const id of ['ifc4-architecture','ifc4-structural','ifc4-hvac']){
  const src=sourceById.get(id);
  try{rawById.set(id,ext.parse(src));}
  catch(err){overallErrors.push(`${id}: raw coordination parse failed: ${err?.message||err}`);}
}
let coordination={ok:false,elements:0,eligibleElements:0,comparisons:0,clashes:0,durationMs:0,errors:[]};
if(rawById.size===3){
  const combined=[];
  for(const id of ['ifc4-architecture','ifc4-structural','ifc4-hvac']){
    const raw=rawById.get(id);
    const eligible=(raw.elements||[]).filter(e=>e.importedProperties?.clashEligible!==false).slice(0,80);
    combined.push(...eligible.map(e=>toClashElement(e,id)));
  }
  const t0=performance.now();
  try{
    const detected=clash.detect(combined,{maxClashes:100,maxComparisons:150000,interDisciplineOnly:true});
    coordination={
      ok:true,
      elements:combined.length,
      eligibleElements:detected.eligibleElements??combined.length,
      comparisons:detected.comparisons||0,
      clashes:detected.clashes?.length||0,
      durationMs:performance.now()-t0,
      errors:[]
    };
    if(coordination.elements<2) coordination.errors.push('not enough eligible real elements for coordination smoke');
    if(coordination.durationMs>MAX_COORDINATION_MS) coordination.errors.push(`coordination exceeded ${MAX_COORDINATION_MS} ms`);
    if((detected.clashes||[]).some(c=>c.method!=='triangle-bvh')) coordination.errors.push('clash result used unexpected method');
    coordination.ok=coordination.errors.length===0;
  }catch(err){
    coordination={ok:false,elements:combined.length,eligibleElements:0,comparisons:0,clashes:0,durationMs:performance.now()-t0,errors:[String(err?.message||err)]};
  }
}
if(!coordination.ok) overallErrors.push(...coordination.errors.map(e=>'coordination: '+e));

const report={
  generatedAt:new Date().toISOString(),
  policy:{
    maxUploadBytes:MAX_UPLOAD_BYTES,
    maxTriangles:MAX_TRIANGLES,
    maxParseMs:MAX_PARSE_MS,
    maxCoordinationMs:MAX_COORDINATION_MS,
    normativeConformance:false
  },
  fixtures:results,
  coordination,
  errors:overallErrors,
  ok:overallErrors.length===0
};

const args=parseArgs();
if(args.json){
  fs.mkdirSync(path.dirname(args.json),{recursive:true});
  fs.writeFileSync(args.json,JSON.stringify(report,null,2)+'\n');
}
if(args.markdown){
  fs.mkdirSync(path.dirname(args.markdown),{recursive:true});
  fs.writeFileSync(args.markdown,markdownReport(report)+'\n');
}

console.log('');
console.log(`Real IFC QA: ${report.ok?'PASS':'FAIL'} | fixtures=${results.length} | coordination clashes=${coordination.clashes} | comparisons=${coordination.comparisons}`);
if(!report.ok){
  for(const error of overallErrors) console.error('❌ '+error);
  process.exit(1);
}
