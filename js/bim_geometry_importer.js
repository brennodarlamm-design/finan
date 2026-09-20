/**
 * FinGo BIM Geometry Importer
 * Parser determinístico, sem dependência externa em runtime, para geometria web.
 * Suporta OBJ, GLTF/GLB e um subconjunto seguro de IFC SweptSolid/ExtrudedAreaSolid.
 * IFC com booleanas/openings é marcado como geometria parcial e nunca habilita clash autoritativo.
 */
const BIMGeometryImporter = (() => {
  const MAX_TRIANGLES = 150000;
  const TARGET_SPAN = 260;

  const extOf = name => String(name || '').split('.').pop().toLowerCase();
  const unquote = value => {
    const s = String(value || '').trim();
    return /^'.*'$/.test(s) ? s.slice(1, -1).replace(/''/g, "'") : s;
  };

  function splitTopLevel(input) {
    const out = [];
    let current = '';
    let depth = 0;
    let quoted = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === "'") {
        if (quoted && input[i + 1] === "'") {
          current += "''";
          i++;
          continue;
        }
        quoted = !quoted;
        current += ch;
        continue;
      }
      if (!quoted) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) {
          out.push(current.trim());
          current = '';
          continue;
        }
      }
      current += ch;
    }
    if (current.trim() || input.endsWith(',')) out.push(current.trim());
    return out;
  }

  function colorForClass(type) {
    const t = String(type || '').toUpperCase();
    if (/FOOTING|PILE|BEAM|COLUMN|MEMBER|REINFORC/.test(t)) return '#64748B';
    if (/SLAB/.test(t)) return '#94A3B8';
    if (/ROOF|COVERING/.test(t)) return '#B45309';
    if (/WINDOW|CURTAINWALL/.test(t)) return 'rgba(56,189,248,.72)';
    if (/DOOR/.test(t)) return '#78350F';
    if (/FLOW|PIPE|DUCT|CABLE/.test(t)) return '#7F49B8';
    return '#C2410C';
  }

  function disciplineForClass(type) {
    const t = String(type || '').toUpperCase();
    if (/FOOTING|PILE|BEAM|COLUMN|MEMBER|REINFORC|SLAB/.test(t)) return 'estrutural';
    if (/PIPE|SANITARY|PLUMB|FLOWTERMINAL/.test(t)) return 'hidraulica';
    if (/CABLE|ELECTRIC|LIGHT|OUTLET|SWITCH/.test(t)) return 'eletrica';
    if (/DUCT|AIRTERMINAL/.test(t)) return 'mecanica';
    return 'arquitetura';
  }

  function cross(a, b) {
    return { x: a.y*b.z-a.z*b.y, y: a.z*b.x-a.x*b.z, z: a.x*b.y-a.y*b.x };
  }
  function norm(v, fallback={x:0,y:0,z:1}) {
    const len = Math.hypot(v.x, v.y, v.z);
    return len > 1e-12 ? {x:v.x/len,y:v.y/len,z:v.z/len} : {...fallback};
  }
  function add(a,b){ return {x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}; }
  function mul(v,s){ return {x:v.x*s,y:v.y*s,z:v.z*s}; }

  const identityBasis = () => ({
    origin:{x:0,y:0,z:0},
    x:{x:1,y:0,z:0},
    y:{x:0,y:1,z:0},
    z:{x:0,y:0,z:1}
  });
  function applyBasis(b,p){
    return add(b.origin, add(mul(b.x,p.x), add(mul(b.y,p.y), mul(b.z,p.z))));
  }
  function composeBasis(parent, child){
    return {
      origin: applyBasis(parent, child.origin),
      x: norm({
        x: parent.x.x*child.x.x + parent.y.x*child.x.y + parent.z.x*child.x.z,
        y: parent.x.y*child.x.x + parent.y.y*child.x.y + parent.z.y*child.x.z,
        z: parent.x.z*child.x.x + parent.y.z*child.x.y + parent.z.z*child.x.z
      }, {x:1,y:0,z:0}),
      y: norm({
        x: parent.x.x*child.y.x + parent.y.x*child.y.y + parent.z.x*child.y.z,
        y: parent.x.y*child.y.x + parent.y.y*child.y.y + parent.z.y*child.y.z,
        z: parent.x.z*child.y.x + parent.y.z*child.y.y + parent.z.z*child.y.z
      }, {x:0,y:1,z:0}),
      z: norm({
        x: parent.x.x*child.z.x + parent.y.x*child.z.y + parent.z.x*child.z.z,
        y: parent.x.y*child.z.x + parent.y.y*child.z.y + parent.z.y*child.z.z,
        z: parent.x.z*child.z.x + parent.y.z*child.z.y + parent.z.z*child.z.z
      }, {x:0,y:0,z:1})
    };
  }

  function boundsFromTriangles(triangles) {
    const b={minX:Infinity,minY:Infinity,minZ:Infinity,maxX:-Infinity,maxY:-Infinity,maxZ:-Infinity};
    for(const tri of triangles){
      for(const p of tri){
        b.minX=Math.min(b.minX,p.x); b.maxX=Math.max(b.maxX,p.x);
        b.minY=Math.min(b.minY,p.y); b.maxY=Math.max(b.maxY,p.y);
        b.minZ=Math.min(b.minZ,p.z); b.maxZ=Math.max(b.maxZ,p.z);
      }
    }
    if(!Number.isFinite(b.minX)) return {minX:0,minY:0,minZ:0,maxX:0,maxY:0,maxZ:0};
    return b;
  }

  function normalizeElements(elements, sourceAxis='y-up') {
    const all = elements.flatMap(e => e.rawTriangles || []);
    if(!all.length) throw new Error('O arquivo não contém geometria triangulável suportada.');

    const axisPoint = p => sourceAxis === 'z-up'
      ? {x:p.x, y:p.z, z:-p.y}
      : {x:p.x, y:p.y, z:p.z};

    const axisTriangles = all.map(tri => tri.map(axisPoint));
    const rawBounds = boundsFromTriangles(axisTriangles);
    const dx=rawBounds.maxX-rawBounds.minX, dy=rawBounds.maxY-rawBounds.minY, dz=rawBounds.maxZ-rawBounds.minZ;
    const maxSpan=Math.max(dx,dy,dz,1e-9);
    const scale=TARGET_SPAN/maxSpan;
    const centerX=(rawBounds.minX+rawBounds.maxX)/2;
    const centerZ=(rawBounds.minZ+rawBounds.maxZ)/2;
    const baseY=rawBounds.minY;

    let triangleCount=0;
    const normalized = elements.map((elem, elemIndex) => {
      const triangles=(elem.rawTriangles||[]).map(tri=>tri.map(p=>{
        const q=axisPoint(p);
        return {x:(q.x-centerX)*scale,y:(q.y-baseY)*scale-40,z:(q.z-centerZ)*scale};
      }));
      triangleCount += triangles.length;
      if(triangleCount>MAX_TRIANGLES) throw new Error(`Modelo excede o limite de ${MAX_TRIANGLES.toLocaleString('pt-BR')} triângulos.`);
      const bb=boundsFromTriangles(triangles);
      return {
        id: elem.id || `imported_${elemIndex+1}`,
        name: elem.name || `Elemento importado ${elemIndex+1}`,
        floor: elem.floor || 'all',
        discipline: elem.discipline || 'arquitetura',
        category: elem.category || 'Modelo importado',
        color: elem.color || '#94A3B8',
        orcado: 0,
        realizado: 0,
        executadoPct: 0,
        dataSource: 'Geometria importada do arquivo BIM/3D',
        importedProperties: elem.importedProperties || {},
        meshes:[{
          type:'triangles',
          triangles,
          color:elem.color || '#94A3B8',
          name:elem.name || 'Geometria importada',
          x:bb.minX,y:bb.minY,z:bb.minZ,
          w:bb.maxX-bb.minX,h:bb.maxY-bb.minY,d:bb.maxZ-bb.minZ
        }]
      };
    });

    const viewerBounds=boundsFromTriangles(normalized.flatMap(e=>e.meshes[0].triangles));
    return {elements:normalized,triangleCount,sourceBounds:rawBounds,viewerBounds,viewerScale:scale};
  }

  function parseOBJ(text) {
    const vertices=[];
    const groups=[];
    let current={name:'OBJ — Modelo',faces:[]};
    groups.push(current);
    const lines=String(text||'').split(/\r?\n/);
    for(const raw of lines){
      const line=raw.trim();
      if(!line || line.startsWith('#')) continue;
      if(line.startsWith('v ')){
        const p=line.split(/\s+/).slice(1,4).map(Number);
        if(p.length===3 && p.every(Number.isFinite)) vertices.push({x:p[0],y:p[1],z:p[2]});
      } else if(line.startsWith('o ') || line.startsWith('g ')){
        const name=line.slice(2).trim();
        if(current.faces.length===0 && groups.length===1) current.name=name||current.name;
        else { current={name:name||`Grupo ${groups.length+1}`,faces:[]}; groups.push(current); }
      } else if(line.startsWith('f ')){
        const refs=line.split(/\s+/).slice(1).map(tok=>parseInt(tok.split('/')[0],10)).filter(Number.isFinite);
        if(refs.length<3) continue;
        const idx=refs.map(i=>i<0?vertices.length+i:i-1);
        for(let i=1;i<idx.length-1;i++) current.faces.push([idx[0],idx[i],idx[i+1]]);
      }
    }
    if(!vertices.length) throw new Error('OBJ inválido: nenhum vértice encontrado.');
    const elements=groups.filter(g=>g.faces.length).map((g,i)=>({
      id:`obj_${i+1}`,
      name:g.name,
      discipline:'arquitetura',
      category:'OBJ',
      color:'#94A3B8',
      rawTriangles:g.faces.map(f=>f.map(idx=>vertices[idx])).filter(t=>t.every(Boolean)),
      importedProperties:{format:'OBJ',vertices:vertices.length,faces:g.faces.length,geometryQuality:'full',clashEligible:true}
    }));
    return {...normalizeElements(elements,'y-up'), format:'obj', authoritativeBim:false, geometryQuality:'full', clashEligible:true};
  }

  function parseStepEntities(text) {
    const map=new Map();
    const re=/#(\d+)\s*=\s*(IFC[A-Z0-9_]+)\s*\(([\s\S]*?)\)\s*;/gi;
    let m;
    while((m=re.exec(text))){
      map.set(Number(m[1]),{id:Number(m[1]),type:m[2].toUpperCase(),raw:m[3],args:splitTopLevel(m[3])});
    }
    return map;
  }
  const refOf = token => {
    const m=String(token||'').match(/^#(\d+)$/);
    return m?Number(m[1]):null;
  };
  const refsIn = token => [...String(token||'').matchAll(/#(\d+)/g)].map(m=>Number(m[1]));
  const num = value => {
    const m=String(value||'').match(/[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?/);
    return m?Number(m[0]):0;
  };

  function parseIfcValue(token) {
    const s=String(token||'').trim();
    if(s==='$' || s==='*') return null;
    if(/^'.*'$/.test(s)) return unquote(s);
    if(/^\.T\.$/i.test(s)) return true;
    if(/^\.F\.$/i.test(s)) return false;
    const wrapped=s.match(/^IFC[A-Z0-9_]+\((.*)\)$/i);
    if(wrapped) return parseIfcValue(wrapped[1]);
    const n=Number(s);
    return Number.isFinite(n)?n:s;
  }

  function parseIFC(text) {
    const src=String(text||'');
    if(!/ISO-10303-21/i.test(src)||!/IFCPROJECT/i.test(src)) throw new Error('IFC inválido ou incompleto.');
    if (typeof BIMIFCExtendedImporter !== 'undefined' && typeof BIMIFCExtendedImporter.parse === 'function') {
      const extended = BIMIFCExtendedImporter.parse(src);
      const normalized = normalizeElements(extended.elements || [], 'z-up');
      return {
        ...normalized,
        format:'ifc',
        authoritativeBim:true,
        ...(extended.metadata || {})
      };
    }
    const entities=parseStepEntities(src);
    if(!entities.size) throw new Error('IFC sem entidades STEP legíveis.');

    const point=id=>{
      const e=entities.get(id); if(!e||e.type!=='IFCCARTESIANPOINT') return {x:0,y:0,z:0};
      const vals=splitTopLevel(String(e.args[0]||'').replace(/^\(/,'').replace(/\)$/,'')).map(num);
      return {x:vals[0]||0,y:vals[1]||0,z:vals[2]||0};
    };
    const direction=id=>{
      const e=entities.get(id); if(!e||e.type!=='IFCDIRECTION') return {x:0,y:0,z:1};
      const vals=splitTopLevel(String(e.args[0]||'').replace(/^\(/,'').replace(/\)$/,'')).map(num);
      return norm({x:vals[0]||0,y:vals[1]||0,z:vals[2]??0},{x:0,y:0,z:1});
    };
    const axis3=id=>{
      const e=entities.get(id); if(!e||e.type!=='IFCAXIS2PLACEMENT3D') return identityBasis();
      const origin=point(refOf(e.args[0]));
      const z=e.args[1]&&e.args[1]!=='$'?direction(refOf(e.args[1])):{x:0,y:0,z:1};
      let x=e.args[2]&&e.args[2]!=='$'?direction(refOf(e.args[2])):{x:1,y:0,z:0};
      let y=norm(cross(z,x),{x:0,y:1,z:0});
      x=norm(cross(y,z),{x:1,y:0,z:0});
      return {origin,x,y,z};
    };
    const placementCache=new Map();
    const localPlacement=(id,depth=0)=>{
      if(!id||depth>24) return identityBasis();
      if(placementCache.has(id)) return placementCache.get(id);
      const e=entities.get(id); if(!e||e.type!=='IFCLOCALPLACEMENT') return identityBasis();
      const parentId=refOf(e.args[0]);
      const relId=refOf(e.args[1]);
      const basis=composeBasis(parentId?localPlacement(parentId,depth+1):identityBasis(),axis3(relId));
      placementCache.set(id,basis); return basis;
    };

    const axis2=id=>{
      const e=entities.get(id); if(!e||e.type!=='IFCAXIS2PLACEMENT2D') return {origin:{x:0,y:0},x:{x:1,y:0},y:{x:0,y:1}};
      const p=point(refOf(e.args[0]));
      const d=e.args[1]&&e.args[1]!=='$'?direction(refOf(e.args[1])):{x:1,y:0,z:0};
      const x={x:d.x,y:d.y}, y={x:-d.y,y:d.x};
      return {origin:{x:p.x,y:p.y},x,y};
    };

    function profilePolygon(profileId){
      const p=entities.get(profileId); if(!p) return null;
      if(p.type==='IFCRECTANGLEPROFILEDEF'){
        const xdim=num(p.args[p.args.length-2]), ydim=num(p.args[p.args.length-1]);
        if(xdim<=0||ydim<=0) return null;
        const posRef=p.args.map(refOf).find(id=>entities.get(id)?.type==='IFCAXIS2PLACEMENT2D');
        const a=axis2(posRef);
        const base=[[-xdim/2,-ydim/2],[xdim/2,-ydim/2],[xdim/2,ydim/2],[-xdim/2,ydim/2]];
        return base.map(([x,y])=>({x:a.origin.x+a.x.x*x+a.y.x*y,y:a.origin.y+a.x.y*x+a.y.y*y}));
      }
      if(p.type==='IFCARBITRARYCLOSEDPROFILEDEF'){
        const curveId=refsIn(p.raw).find(id=>entities.get(id)?.type==='IFCPOLYLINE');
        const curve=entities.get(curveId); if(!curve) return null;
        const pts=refsIn(curve.args[0]).map(point).map(q=>({x:q.x,y:q.y}));
        if(pts.length>2 && pts[0].x===pts.at(-1).x && pts[0].y===pts.at(-1).y) pts.pop();
        return pts.length>=3?pts:null;
      }
      return null;
    }

    function polygonArea(poly){
      let a=0; for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];a+=p.x*q.y-q.x*p.y;} return a/2;
    }
    function pointInTri(p,a,b,c){
      const sign=(p1,p2,p3)=>(p1.x-p3.x)*(p2.y-p3.y)-(p2.x-p3.x)*(p1.y-p3.y);
      const d1=sign(p,a,b),d2=sign(p,b,c),d3=sign(p,c,a);
      const neg=d1<0||d2<0||d3<0,pos=d1>0||d2>0||d3>0;
      return !(neg&&pos);
    }
    function triangulate2D(poly){
      const idx=poly.map((_,i)=>i);
      if(polygonArea(poly)<0) idx.reverse();
      const tris=[]; let guard=0;
      while(idx.length>3 && guard++<10000){
        let clipped=false;
        for(let j=0;j<idx.length;j++){
          const ia=idx[(j-1+idx.length)%idx.length],ib=idx[j],ic=idx[(j+1)%idx.length];
          const a=poly[ia],b=poly[ib],c=poly[ic];
          const crossZ=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
          if(crossZ<=1e-12) continue;
          if(idx.some(k=>k!==ia&&k!==ib&&k!==ic&&pointInTri(poly[k],a,b,c))) continue;
          tris.push([ia,ib,ic]); idx.splice(j,1); clipped=true; break;
        }
        if(!clipped) break;
      }
      if(idx.length===3) tris.push([idx[0],idx[1],idx[2]]);
      return tris;
    }

    function extrusionTriangles(extrudeId, productBasis){
      const e=entities.get(extrudeId); if(!e||e.type!=='IFCEXTRUDEDAREASOLID') return [];
      const profileId=refOf(e.args[0]), solidPosId=refOf(e.args[1]), dirId=refOf(e.args[2]), depth=num(e.args[3]);
      const poly=profilePolygon(profileId); if(!poly||depth<=0) return [];
      const solidBasis=axis3(solidPosId);
      const dir=direction(dirId);
      const bottom=poly.map(p=>applyBasis(productBasis,applyBasis(solidBasis,{x:p.x,y:p.y,z:0})));
      const top=poly.map(p=>applyBasis(productBasis,applyBasis(solidBasis,{x:p.x+dir.x*depth,y:p.y+dir.y*depth,z:dir.z*depth})));
      const faces=triangulate2D(poly);
      const tris=[];
      faces.forEach(([a,b,c])=>{tris.push([bottom[a],bottom[c],bottom[b]]);tris.push([top[a],top[b],top[c]]);});
      for(let i=0;i<poly.length;i++){
        const j=(i+1)%poly.length;
        tris.push([bottom[i],bottom[j],top[j]],[bottom[i],top[j],top[i]]);
      }
      return tris;
    }

    const childrenOf=id=>refsIn(entities.get(id)?.raw||'');
    function descendants(id,target,maxDepth=8){
      const found=[]; const seen=new Set();
      const walk=(node,depth)=>{
        if(!node||depth>maxDepth||seen.has(node)) return;
        seen.add(node); const e=entities.get(node); if(!e) return;
        if(target.has(e.type)) found.push(node);
        childrenOf(node).forEach(child=>walk(child,depth+1));
      }; walk(id,0); return found;
    }

    const psetsByProduct=new Map();
    for(const e of entities.values()){
      if(e.type!=='IFCRELDEFINESBYPROPERTIES') continue;
      const refs=refsIn(e.raw); if(refs.length<2) continue;
      const psetId=refs.find(id=>entities.get(id)?.type==='IFCPROPERTYSET');
      if(!psetId) continue;
      const related=refs.filter(id=>id!==psetId && entities.get(id) && !/^IFC(OWNERHISTORY|PROPERTYSET)$/.test(entities.get(id).type));
      const pset=entities.get(psetId);
      const psetName=unquote(pset.args[2]||'PropertySet');
      const props={};
      refsIn(pset.args.at(-1)||'').forEach(propId=>{
        const prop=entities.get(propId);
        if(prop?.type==='IFCPROPERTYSINGLEVALUE') props[unquote(prop.args[0]||`#${propId}`)]=parseIfcValue(prop.args[2]);
      });
      related.forEach(id=>{
        if(!psetsByProduct.has(id)) psetsByProduct.set(id,{});
        psetsByProduct.get(id)[psetName]=props;
      });
    }

    const productType=/^IFC(WALL|WALLSTANDARDCASE|SLAB|BEAM|COLUMN|FOOTING|ROOF|COVERING|DOOR|WINDOW|STAIR|MEMBER|PLATE|CURTAINWALL|BUILDINGELEMENTPROXY|FLOWSEGMENT|PIPESEGMENT|DUCTSEGMENT|CABLESEGMENT)/;
    const elements=[];
    let partialCount=0;
    for(const e of entities.values()){
      if(!productType.test(e.type)) continue;
      const placementId=refsIn(e.raw).find(id=>entities.get(id)?.type==='IFCLOCALPLACEMENT');
      const reprId=refsIn(e.raw).find(id=>entities.get(id)?.type==='IFCPRODUCTDEFINITIONSHAPE');
      if(!reprId) continue;
      const extrudes=descendants(reprId,new Set(['IFCEXTRUDEDAREASOLID']));
      if(!extrudes.length) continue;
      const partial=descendants(reprId,new Set(['IFCBOOLEANCLIPPINGRESULT','IFCBOOLEANRESULT','IFCHALFSPACESOLID'])).length>0;
      if(partial) partialCount++;
      const basis=localPlacement(placementId);
      const tris=extrudes.flatMap(id=>extrusionTriangles(id,basis));
      if(!tris.length) continue;
      const globalId=unquote(e.args[0]||`#${e.id}`);
      const name=unquote(e.args[2]||'')||`${e.type} #${e.id}`;
      elements.push({
        id:`ifc_${globalId || e.id}`,
        name,
        discipline:disciplineForClass(e.type),
        category:e.type,
        color:colorForClass(e.type),
        rawTriangles:tris,
        importedProperties:{
          format:'IFC',
          ifcClass:e.type,
          globalId,
          stepId:e.id,
          psets:psetsByProduct.get(e.id)||{},
          geometryQuality:partial?'partial':'swept-solid',
          clashEligible:!partial
        }
      });
    }

    if(!elements.length) throw new Error('IFC válido, mas sem SweptSolid/ExtrudedAreaSolid suportado pelo tessellador atual.');
    const schema=src.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i)?.[1]||'IFC';
    const normalized=normalizeElements(elements,'z-up');
    return {
      ...normalized,
      format:'ifc',
      schema,
      authoritativeBim:true,
      geometryQuality:partialCount?'partial':'swept-solid',
      partialElements:partialCount,
      clashEligible:partialCount===0,
      sourceElementCount:elements.length
    };
  }

  function decodeDataUri(uri){
    const m=String(uri||'').match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if(!m) return null;
    if(m[2]){
      const bin=atob(m[3]); const out=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
      return out.buffer;
    }
    return new TextEncoder().encode(decodeURIComponent(m[3])).buffer;
  }

  function matIdentity(){return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}
  function matMul(a,b){
    const o=new Array(16).fill(0);
    for(let c=0;c<4;c++) for(let r=0;r<4;r++) for(let k=0;k<4;k++) o[c*4+r]+=a[k*4+r]*b[c*4+k];
    return o;
  }
  function matFromTRS(node){
    if(Array.isArray(node.matrix)&&node.matrix.length===16) return node.matrix.map(Number);
    const t=node.translation||[0,0,0], s=node.scale||[1,1,1], q=node.rotation||[0,0,0,1];
    const [x,y,z,w]=q; const x2=x+x,y2=y+y,z2=z+z;
    const xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
    return [
      (1-(yy+zz))*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,
      (xy-wz)*s[1],(1-(xx+zz))*s[1],(yz+wx)*s[1],0,
      (xz+wy)*s[2],(yz-wx)*s[2],(1-(xx+yy))*s[2],0,
      t[0],t[1],t[2],1
    ];
  }
  function transformPoint(m,p){
    return {x:m[0]*p.x+m[4]*p.y+m[8]*p.z+m[12],y:m[1]*p.x+m[5]*p.y+m[9]*p.z+m[13],z:m[2]*p.x+m[6]*p.y+m[10]*p.z+m[14]};
  }

  function parseGLTFObject(json,binaryChunk=null){
    const buffers=(json.buffers||[]).map((b,i)=>{
      if(i===0&&binaryChunk) return binaryChunk;
      const data=decodeDataUri(b.uri);
      if(!data) throw new Error('GLTF com buffer externo não é suportado no importador de arquivo único. Use GLB ou GLTF embarcado.');
      return data;
    });
    const componentInfo={
      5120:[1,'getInt8'],5121:[1,'getUint8'],5122:[2,'getInt16'],5123:[2,'getUint16'],5125:[4,'getUint32'],5126:[4,'getFloat32']
    };
    const typeSize={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
    const accessorData=idx=>{
      const a=json.accessors?.[idx], bv=json.bufferViews?.[a?.bufferView];
      if(!a||!bv) throw new Error('Accessor GLTF inválido.');
      const info=componentInfo[a.componentType], n=typeSize[a.type];
      if(!info||!n) throw new Error('Accessor GLTF com tipo não suportado.');
      const [bytes,getter]=info, stride=bv.byteStride||bytes*n;
      const view=new DataView(buffers[bv.buffer],(bv.byteOffset||0),(bv.byteLength||0));
      const start=a.byteOffset||0, out=[];
      for(let i=0;i<a.count;i++){
        const row=[]; for(let k=0;k<n;k++) row.push(view[getter](start+i*stride+k*bytes,true));
        out.push(n===1?row[0]:row);
      }
      return out;
    };

    const elements=[];
    const scenes=json.scenes||[{nodes:(json.nodes||[]).map((_,i)=>i)}];
    const scene=scenes[json.scene||0]||scenes[0];
    const walk=(nodeIndex,parent)=>{
      const node=json.nodes?.[nodeIndex]||{};
      const world=matMul(parent,matFromTRS(node));
      if(Number.isInteger(node.mesh)){
        const mesh=json.meshes?.[node.mesh];
        (mesh?.primitives||[]).forEach((prim,pidx)=>{
          if(prim.mode!==undefined&&prim.mode!==4) return;
          const pos=accessorData(prim.attributes?.POSITION);
          const indices=Number.isInteger(prim.indices)?accessorData(prim.indices):pos.map((_,i)=>i);
          const tris=[];
          for(let i=0;i+2<indices.length;i+=3){
            const ids=[indices[i],indices[i+1],indices[i+2]];
            if(ids.some(id=>!pos[id])) continue;
            tris.push(ids.map(id=>transformPoint(world,{x:pos[id][0],y:pos[id][1],z:pos[id][2]})));
          }
          if(!tris.length) return;
          const material=json.materials?.[prim.material];
          const rgba=material?.pbrMetallicRoughness?.baseColorFactor;
          const color=rgba?`rgba(${Math.round(rgba[0]*255)},${Math.round(rgba[1]*255)},${Math.round(rgba[2]*255)},${rgba[3]??1})`:'#94A3B8';
          elements.push({
            id:`gltf_${nodeIndex}_${pidx}`,
            name:node.name||mesh?.name||`GLTF Mesh ${node.mesh}`,
            discipline:'arquitetura',
            category:'GLTF',
            color,
            rawTriangles:tris,
            importedProperties:{format:'GLTF',node:nodeIndex,mesh:node.mesh,primitive:pidx,geometryQuality:'full',clashEligible:true}
          });
        });
      }
      (node.children||[]).forEach(child=>walk(child,world));
    };
    (scene?.nodes||[]).forEach(n=>walk(n,matIdentity()));
    if(!elements.length) throw new Error('GLTF/GLB sem primitivas TRIANGLES renderizáveis.');
    return {...normalizeElements(elements,'y-up'),format:'gltf',authoritativeBim:false,geometryQuality:'full',clashEligible:true};
  }

  function parseGLTF(text){
    let json; try{json=JSON.parse(text);}catch{throw new Error('GLTF inválido: JSON malformado.');}
    if(!json?.asset?.version) throw new Error('GLTF inválido: asset.version ausente.');
    return parseGLTFObject(json,null);
  }

  function parseGLB(buffer){
    const view=new DataView(buffer);
    if(view.byteLength<20||view.getUint32(0,true)!==0x46546C67) throw new Error('GLB inválido: magic glTF ausente.');
    if(view.getUint32(4,true)!==2) throw new Error('Apenas GLB versão 2 é suportado.');
    let offset=12,json=null,bin=null;
    while(offset+8<=view.byteLength){
      const len=view.getUint32(offset,true),type=view.getUint32(offset+4,true); offset+=8;
      const chunk=buffer.slice(offset,offset+len); offset+=len;
      if(type===0x4E4F534A) json=JSON.parse(new TextDecoder().decode(chunk).replace(/\0+$/,'').trim());
      else if(type===0x004E4942) bin=chunk;
    }
    if(!json) throw new Error('GLB inválido: chunk JSON ausente.');
    return {...parseGLTFObject(json,bin),format:'glb'};
  }

  async function importFile(file){
    if(!file) throw new Error('Arquivo ausente.');
    const ext=extOf(file.name);
    if(!['obj','ifc','gltf','glb'].includes(ext)) throw new Error('Formato não suportado. Use IFC, OBJ, GLTF ou GLB.');
    if(Number(file.size||0)>15*1024*1024) throw new Error('Modelo excede o limite de 15 MB.');
    if(ext==='glb') return parseGLB(await file.arrayBuffer());
    const text=await file.text();
    if(ext==='obj') return parseOBJ(text);
    if(ext==='ifc') return parseIFC(text);
    return parseGLTF(text);
  }

  async function contentToFile(content, filename, mime='application/octet-stream'){
    if(content instanceof Blob) return new File([content],filename,{type:mime});
    if(content instanceof ArrayBuffer) return new File([content],filename,{type:mime});
    const str=String(content||'');
    if(/^https?:\/\//i.test(str)){
      const res=await fetch(str,{credentials:'omit',signal:AbortSignal.timeout(45000)});
      if(!res.ok) throw new Error('Não foi possível carregar o arquivo BIM versionado.');
      return new File([await res.blob()],filename,{type:res.headers.get('content-type')||mime});
    }
    if(/^data:/i.test(str)){
      const [head,data]=str.split(',',2);
      const is64=/;base64/i.test(head);
      let bytes;
      if(is64){
        const bin=atob(data); bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
      } else bytes=new TextEncoder().encode(decodeURIComponent(data));
      return new File([bytes],filename,{type:(head.match(/^data:([^;,]+)/i)?.[1]||mime)});
    }
    return new File([str],filename,{type:mime});
  }

  async function importContent(content,filename,mime){
    return importFile(await contentToFile(content,filename,mime));
  }

  return {MAX_TRIANGLES,importFile,importContent,parseOBJ,parseIFC,parseGLTF,parseGLB};
})();

if (typeof window !== 'undefined') window.BIMGeometryImporter = BIMGeometryImporter;
