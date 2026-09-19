import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { performance } from 'node:perf_hooks';

const MAX_UPLOAD_BYTES=15*1024*1024;
const MAX_PARSE_MS=Number(process.env.BIM_QA_LARGE_MAX_PARSE_MS||15000);

function runtime(){
  const sandbox={console,TextEncoder,TextDecoder,DataView,Uint8Array,ArrayBuffer,atob:globalThis.atob,btoa:globalThis.btoa};
  vm.createContext(sandbox);
  const loads=[
    ['js/bim_csg.js','__CSG','BIMCSG'],
    ['js/bim_ifc_extended.js','__EXT','BIMIFCExtendedImporter'],
    ['js/bim_geometry_importer.js','__IMP','BIMGeometryImporter']
  ];
  for(const item of loads){
    const file=item[0],globalName=item[1],expr=item[2];
    vm.runInContext(fs.readFileSync(file,'utf8')+'\n;globalThis.'+globalName+'='+expr+';',sandbox);
  }
  return sandbox.__IMP;
}

function parseArgs(){
  const files=[];let json=null,markdown=null;
  for(const arg of process.argv.slice(2)){
    if(arg.startsWith('--json='))json=arg.slice(7);
    else if(arg.startsWith('--markdown='))markdown=arg.slice(11);
    else files.push(arg);
  }
  return {files,json,markdown};
}

function markdownReport(report){
  const lines=['# FinGo BIM — Large real-model stress QA','','Generated: '+report.generatedAt,'',
    '| File | Size | Schema | Elements | Triangles | Parse | Heap Δ | Result |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |'];
  for(const r of report.files){
    lines.push('| '+r.name+' | '+(r.bytes/1024/1024).toFixed(2)+' MB | '+(r.schema||'n/a')+' | '+r.elements+' | '+r.triangles+' | '+r.parseMs.toFixed(1)+' ms | '+(r.heapDeltaBytes/1024/1024).toFixed(1)+' MB | '+(r.ok?'PASS':'FAIL')+' |');
    if(r.error) lines.push('', '- **'+r.name+'**: '+r.error);
  }
  lines.push('','> Stress QA validates FinGo runtime budgets; it is not normative IFC certification.');
  return lines.join('\n');
}

const parsed=parseArgs();
if(!parsed.files.length){
  console.error('Usage: node scripts/run-bim-large-qa.js <file.ifc> [...] [--json=...] [--markdown=...]');
  process.exit(2);
}
const importer=runtime();
const rows=[];
for(const file of parsed.files){
  const src=fs.readFileSync(file,'utf8');
  const bytes=Buffer.byteLength(src);
  const before=process.memoryUsage().heapUsed;
  const t0=performance.now();
  let scene=null,error=null;
  try{scene=importer.parseIFC(src);}catch(err){error=String(err?.message||err);}
  const parseMs=performance.now()-t0;
  const heapDeltaBytes=Math.max(0,process.memoryUsage().heapUsed-before);
  const row={
    name:path.basename(file),file,bytes,parseMs,heapDeltaBytes,
    schema:scene?.schema||null,elements:scene?.elements?.length||0,triangles:scene?.triangleCount||0,
    partialElements:scene?.partialElements??null,clashEligible:scene?.clashEligible??false,error
  };
  const errors=[];
  if(error)errors.push(error);
  if(bytes>MAX_UPLOAD_BYTES)errors.push('exceeds current 15 MB upload limit');
  if(scene&&scene.elements.length===0)errors.push('no renderable elements');
  if(scene&&scene.triangleCount===0)errors.push('no triangles');
  if(parseMs>MAX_PARSE_MS)errors.push('parse exceeded '+MAX_PARSE_MS+' ms');
  row.ok=errors.length===0;
  row.error=errors.join('; ')||null;
  rows.push(row);
  console.log((row.ok?'✅':'❌')+' '+row.name+': '+(bytes/1024/1024).toFixed(2)+' MB, '+row.elements+' elements, '+row.triangles+' triangles, '+parseMs.toFixed(1)+' ms');
}
const report={generatedAt:new Date().toISOString(),maxUploadBytes:MAX_UPLOAD_BYTES,maxParseMs:MAX_PARSE_MS,files:rows,ok:rows.every(x=>x.ok)};
if(parsed.json){fs.mkdirSync(path.dirname(parsed.json),{recursive:true});fs.writeFileSync(parsed.json,JSON.stringify(report,null,2)+'\n');}
if(parsed.markdown){fs.mkdirSync(path.dirname(parsed.markdown),{recursive:true});fs.writeFileSync(parsed.markdown,markdownReport(report)+'\n');}
if(!report.ok)process.exit(1);
