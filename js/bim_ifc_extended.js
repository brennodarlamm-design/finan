/**
 * FinGo IFC Extended Importer
 * Tesselação determinística adicional: MappedItem, FacetedBrep, TessellatedFaceSet e pavimentos.
 * Booleanas/aberturas ainda não subtraídas ficam explicitamente parciais e bloqueadas para clash autoritativo.
 */
const BIMIFCExtendedImporter = (function() {
  const unquote = value => {
    const s=String(value||'').trim();
    return /^'.*'$/.test(s)?s.slice(1,-1).replace(/''/g,"'"):s;
  };
  function splitTopLevel(input){
    const out=[]; let current='',depth=0,quoted=false;
    for(let i=0;i<input.length;i++){
      const ch=input[i];
      if(ch==="'"){
        if(quoted&&input[i+1]==="'"){current+="''";i++;continue;}
        quoted=!quoted; current+=ch; continue;
      }
      if(!quoted){
        if(ch==='(') depth++;
        else if(ch===')') depth--;
        else if(ch===','&&depth===0){out.push(current.trim());current='';continue;}
      }
      current+=ch;
    }
    if(current.trim()||input.endsWith(',')) out.push(current.trim());
    return out;
  }
  function parseEntities(text){
    const map=new Map();
    const re=/#(\d+)\s*=\s*(IFC[A-Z0-9_]+)\s*\(([\s\S]*?)\)\s*;/gi;
    let m;
    while((m=re.exec(text))) map.set(Number(m[1]),{id:Number(m[1]),type:m[2].toUpperCase(),raw:m[3],args:splitTopLevel(m[3])});
    return map;
  }
  const refOf=token=>{const m=String(token||'').match(/^#(\d+)$/);return m?Number(m[1]):null;};
  const refsIn=token=>[...String(token||'').matchAll(/#(\d+)/g)].map(m=>Number(m[1]));
  const num=value=>{const m=String(value||'').match(/[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?/);return m?Number(m[0]):0;};
  const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const norm=(v,fallback={x:0,y:0,z:1})=>{const l=Math.hypot(v.x,v.y,v.z);return l>1e-12?{x:v.x/l,y:v.y/l,z:v.z/l}:{...fallback};};
  const identityBasis=()=>({origin:{x:0,y:0,z:0},x:{x:1,y:0,z:0},y:{x:0,y:1,z:0},z:{x:0,y:0,z:1}});
  const applyBasis=(b,p)=>add(b.origin,add(mul(b.x,p.x),add(mul(b.y,p.y),mul(b.z,p.z))));
  function composeBasis(parent,child){
    const axis=v=>({
      x:parent.x.x*v.x+parent.y.x*v.y+parent.z.x*v.z,
      y:parent.x.y*v.x+parent.y.y*v.y+parent.z.y*v.z,
      z:parent.x.z*v.x+parent.y.z*v.y+parent.z.z*v.z
    });
    return {origin:applyBasis(parent,child.origin),x:norm(axis(child.x),{x:1,y:0,z:0}),y:norm(axis(child.y),{x:0,y:1,z:0}),z:norm(axis(child.z),{x:0,y:0,z:1})};
  }
  function disciplineForClass(type){
    const t=String(type||'').toUpperCase();
    if(/FOOTING|PILE|BEAM|COLUMN|MEMBER|REINFORC|SLAB/.test(t)) return 'estrutural';
    if(/PIPE|SANITARY|PLUMB|FLOWTERMINAL/.test(t)) return 'hidraulica';
    if(/CABLE|ELECTRIC|LIGHT|OUTLET|SWITCH/.test(t)) return 'eletrica';
    if(/DUCT|AIRTERMINAL/.test(t)) return 'mecanica';
    return 'arquitetura';
  }
  function colorForClass(type){
    const t=String(type||'').toUpperCase();
    if(/FOOTING|PILE|BEAM|COLUMN|MEMBER|REINFORC/.test(t)) return '#64748B';
    if(/SLAB/.test(t)) return '#94A3B8';
    if(/ROOF|COVERING/.test(t)) return '#B45309';
    if(/WINDOW|CURTAINWALL/.test(t)) return 'rgba(56,189,248,.72)';
    if(/DOOR/.test(t)) return '#78350F';
    if(/FLOW|PIPE|DUCT|CABLE/.test(t)) return '#7F49B8';
    return '#C2410C';
  }
  function polygonArea(poly){let a=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];a+=p.x*q.y-q.x*p.y;}return a/2;}
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
    while(idx.length>3&&guard++<10000){
      let clipped=false;
      for(let j=0;j<idx.length;j++){
        const ia=idx[(j-1+idx.length)%idx.length],ib=idx[j],ic=idx[(j+1)%idx.length];
        const a=poly[ia],b=poly[ib],c=poly[ic];
        const z=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
        if(z<=1e-12) continue;
        if(idx.some(k=>k!==ia&&k!==ib&&k!==ic&&pointInTri(poly[k],a,b,c))) continue;
        tris.push([ia,ib,ic]);idx.splice(j,1);clipped=true;break;
      }
      if(!clipped) break;
    }
    if(idx.length===3) tris.push([idx[0],idx[1],idx[2]]);
    return tris;
  }
  function polygon3D(points){
    const clean=[...(points||[])];
    if(clean.length>3){
      const a=clean[0],b=clean[clean.length-1];
      if(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-9) clean.pop();
    }
    if(clean.length<3) return [];
    let n={x:0,y:0,z:0};
    for(let i=1;i<clean.length-1;i++){n=cross(sub(clean[i],clean[0]),sub(clean[i+1],clean[0]));if(Math.hypot(n.x,n.y,n.z)>1e-9) break;}
    const ax=Math.abs(n.x),ay=Math.abs(n.y),az=Math.abs(n.z);
    const projected=clean.map(p=>ax>=ay&&ax>=az?{x:p.y,y:p.z}:ay>=az?{x:p.x,y:p.z}:{x:p.x,y:p.y});
    return triangulate2D(projected).map(([a,b,c])=>[clean[a],clean[b],clean[c]]);
  }
  function polygon3DWithVoids(outer, holes=[]){
    const cleanLoop=loop=>{
      const pts=[...(loop||[])];
      if(pts.length>2){
        const a=pts[0],b=pts[pts.length-1];
        if(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-9) pts.pop();
      }
      return pts;
    };
    const o=cleanLoop(outer), hs=(holes||[]).map(cleanLoop).filter(h=>h.length>=3);
    if(o.length<3) return [];

    let n={x:0,y:0,z:0};
    for(let i=1;i<o.length-1;i++){
      n=cross(sub(o[i],o[0]),sub(o[i+1],o[0]));
      if(Math.hypot(n.x,n.y,n.z)>1e-9) break;
    }
    const nl=Math.hypot(n.x,n.y,n.z);
    if(nl<1e-9) return [];
    n={x:n.x/nl,y:n.y/nl,z:n.z/nl};
    const origin=o[0],ax=Math.abs(n.x),ay=Math.abs(n.y),az=Math.abs(n.z);
    let project,unproject;
    if(ax>=ay&&ax>=az){
      project=p=>({x:p.y,y:p.z});
      unproject=q=>({x:origin.x-(n.y*(q.x-origin.y)+n.z*(q.y-origin.z))/n.x,y:q.x,z:q.y});
    }else if(ay>=az){
      project=p=>({x:p.x,y:p.z});
      unproject=q=>({x:q.x,y:origin.y-(n.x*(q.x-origin.x)+n.z*(q.y-origin.z))/n.y,z:q.y});
    }else{
      project=p=>({x:p.x,y:p.y});
      unproject=q=>({x:q.x,y:q.y,z:origin.z-(n.x*(q.x-origin.x)+n.y*(q.y-origin.y))/n.z});
    }

    const loops=[o,...hs].map(loop=>loop.map(project));
    const xs=[...new Set(loops.flat().map(p=>Math.round(p.x*1e9)/1e9))].sort((a,b)=>a-b);
    const edges=[];
    loops.forEach(loop=>{
      for(let i=0;i<loop.length;i++){
        const a=loop[i],b=loop[(i+1)%loop.length];
        if(Math.abs(a.x-b.x)<1e-12) continue;
        edges.push({a,b,minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x)});
      }
    });
    const evalY=(edge,x)=>edge.a.y+(edge.b.y-edge.a.y)*((x-edge.a.x)/(edge.b.x-edge.a.x));
    const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
    const out=[];

    for(let s=0;s<xs.length-1;s++){
      const x0=xs[s],x1=xs[s+1];
      if(x1-x0<1e-10) continue;
      const xm=(x0+x1)/2;
      const hits=edges
        .filter(e=>xm>e.minX&&xm<e.maxX)
        .map(e=>({edge:e,y:evalY(e,xm)}))
        .sort((a,b)=>a.y-b.y);
      if(hits.length%2!==0) return [];
      for(let i=0;i<hits.length;i+=2){
        const low=hits[i],high=hits[i+1];
        if(!high||high.y-low.y<1e-10) continue;
        const quad=[
          unproject({x:x0,y:evalY(low.edge,x0)}),
          unproject({x:x1,y:evalY(low.edge,x1)}),
          unproject({x:x1,y:evalY(high.edge,x1)}),
          unproject({x:x0,y:evalY(high.edge,x0)})
        ];
        const candidates=[[quad[0],quad[1],quad[2]],[quad[0],quad[2],quad[3]]];
        for(let tri of candidates){
          const tn=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0]));
          if(Math.hypot(tn.x,tn.y,tn.z)<1e-10) continue;
          if(dot(tn,n)<0) tri=[tri[0],tri[2],tri[1]];
          out.push(tri);
        }
      }
    }
    return out;
  }

  function parseIfcValue(token){
    const s=String(token||'').trim();
    if(s==='$'||s==='*') return null;
    if(/^'.*'$/.test(s)) return unquote(s);
    if(/^\.T\.$/i.test(s)) return true;
    if(/^\.F\.$/i.test(s)) return false;
    const wrapped=s.match(/^IFC[A-Z0-9_]+\((.*)\)$/i);
    if(wrapped) return parseIfcValue(wrapped[1]);
    const n=Number(s); return Number.isFinite(n)?n:s;
  }
  function parse(text){
    const src=String(text||'');
    if(!/ISO-10303-21/i.test(src)||!/IFCPROJECT/i.test(src)) throw new Error('IFC inválido ou incompleto.');
    const entities=parseEntities(src);
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
      let y=norm(cross(z,x),{x:0,y:1,z:0}); x=norm(cross(y,z),{x:1,y:0,z:0});
      return {origin,x,y,z};
    };
    const axis2=id=>{
      const e=entities.get(id); if(!e||e.type!=='IFCAXIS2PLACEMENT2D') return {origin:{x:0,y:0},x:{x:1,y:0},y:{x:0,y:1}};
      const p=point(refOf(e.args[0]));
      const d=e.args[1]&&e.args[1]!=='$'?direction(refOf(e.args[1])):{x:1,y:0,z:0};
      return {origin:{x:p.x,y:p.y},x:{x:d.x,y:d.y},y:{x:-d.y,y:d.x}};
    };
    const placementCache=new Map();
    const localPlacement=(id,depth=0)=>{
      if(!id||depth>24) return identityBasis();
      if(placementCache.has(id)) return placementCache.get(id);
      const e=entities.get(id); if(!e||e.type!=='IFCLOCALPLACEMENT') return identityBasis();
      const parent=refOf(e.args[0]), rel=refOf(e.args[1]);
      const b=composeBasis(parent?localPlacement(parent,depth+1):identityBasis(),axis3(rel));
      placementCache.set(id,b); return b;
    };
    const profilePolygon=id=>{
      const p=entities.get(id); if(!p) return null;
      if(p.type==='IFCRECTANGLEPROFILEDEF'){
        const xdim=num(p.args[p.args.length-2]),ydim=num(p.args[p.args.length-1]);
        if(xdim<=0||ydim<=0) return null;
        const posRef=p.args.map(refOf).find(x=>entities.get(x)?.type==='IFCAXIS2PLACEMENT2D');
        const a=axis2(posRef),base=[[-xdim/2,-ydim/2],[xdim/2,-ydim/2],[xdim/2,ydim/2],[-xdim/2,ydim/2]];
        return base.map(([x,y])=>({x:a.origin.x+a.x.x*x+a.y.x*y,y:a.origin.y+a.x.y*x+a.y.y*y}));
      }
      if(p.type==='IFCCIRCLEPROFILEDEF'){
        const radius=num(p.args[p.args.length-1]);
        if(radius<=0) return null;
        const posRef=p.args.map(refOf).find(x=>entities.get(x)?.type==='IFCAXIS2PLACEMENT2D');
        const a=axis2(posRef),segments=20,poly=[];
        for(let i=0;i<segments;i++){
          const ang=(Math.PI*2*i)/segments,x=Math.cos(ang)*radius,y=Math.sin(ang)*radius;
          poly.push({x:a.origin.x+a.x.x*x+a.y.x*y,y:a.origin.y+a.x.y*x+a.y.y*y});
        }
        return poly;
      }
      if(p.type==='IFCISHAPEPROFILEDEF'){
        const width=num(p.args[3]),depth=num(p.args[4]),web=num(p.args[5]),flange=num(p.args[6]);
        if(width<=0||depth<=0||web<=0||flange<=0||web>=width||flange*2>=depth) return null;
        const posRef=p.args.map(refOf).find(x=>entities.get(x)?.type==='IFCAXIS2PLACEMENT2D');
        const a=axis2(posRef),hw=width/2,hd=depth/2,ww=web/2;
        const base=[
          [-hw,-hd],[hw,-hd],[hw,-hd+flange],[ww,-hd+flange],
          [ww,hd-flange],[hw,hd-flange],[hw,hd],[-hw,hd],
          [-hw,hd-flange],[-ww,hd-flange],[-ww,-hd+flange],[-hw,-hd+flange]
        ];
        return base.map(([x,y])=>({x:a.origin.x+a.x.x*x+a.y.x*y,y:a.origin.y+a.x.y*x+a.y.y*y}));
      }
      if(p.type==='IFCARBITRARYCLOSEDPROFILEDEF'){
        const curveId=refsIn(p.raw).find(x=>entities.get(x)?.type==='IFCPOLYLINE');
        const curve=entities.get(curveId); if(!curve) return null;
        const pts=refsIn(curve.args[0]).map(point).map(q=>({x:q.x,y:q.y}));
        if(pts.length>2&&pts[0].x===pts[pts.length-1].x&&pts[0].y===pts[pts.length-1].y) pts.pop();
        return pts.length>=3?pts:null;
      }
      return null;
    };
    const extrusion=(id,basis)=>{
      const e=entities.get(id); if(!e||e.type!=='IFCEXTRUDEDAREASOLID') return [];
      const poly=profilePolygon(refOf(e.args[0])),solid=axis3(refOf(e.args[1])),dir=direction(refOf(e.args[2])),depth=num(e.args[3]);
      if(!poly||depth<=0) return [];
      const bottom=poly.map(p=>applyBasis(basis,applyBasis(solid,{x:p.x,y:p.y,z:0})));
      const top=poly.map(p=>applyBasis(basis,applyBasis(solid,{x:p.x+dir.x*depth,y:p.y+dir.y*depth,z:dir.z*depth})));
      const out=[];
      triangulate2D(poly).forEach(([a,b,c])=>{out.push([bottom[a],bottom[c],bottom[b]],[top[a],top[b],top[c]]);});
      for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length;out.push([bottom[i],bottom[j],top[j]],[bottom[i],top[j],top[i]]);}
      return out;
    };
    const pointList3D=id=>{
      const e=entities.get(id); if(!e||e.type!=='IFCCARTESIANPOINTLIST3D') return [];
      return [...String(e.args[0]||'').matchAll(/\(([-+0-9Ee.,\s]+)\)/g)].map(m=>{
        const v=m[1].split(',').map(x=>Number(x.trim()));return {x:v[0]||0,y:v[1]||0,z:v[2]||0};
      }).filter(p=>[p.x,p.y,p.z].every(Number.isFinite));
    };
    const curvePoints=id=>{
      const e=entities.get(id); if(!e) return [];
      if(e.type==='IFCPOLYLINE') return refsIn(e.args[0]).map(point);
      if(e.type==='IFCINDEXEDPOLYCURVE') return pointList3D(refOf(e.args[0]));
      return [];
    };
    const sweptDiskSolid=(id,basis)=>{
      const e=entities.get(id); if(!e||e.type!=='IFCSWEPTDISKSOLID') return [];
      const path=curvePoints(refOf(e.args[0])),radius=num(e.args[1]);
      if(path.length<2||radius<=0) return [];
      const sides=12,out=[];
      for(let s=0;s<path.length-1;s++){
        const a=path[s],b=path[s+1],dir=norm(sub(b,a),{x:0,y:0,z:1});
        const helper=Math.abs(dir.z)<.9?{x:0,y:0,z:1}:{x:0,y:1,z:0};
        const u=norm(cross(dir,helper),{x:1,y:0,z:0});
        const v=norm(cross(dir,u),{x:0,y:1,z:0});
        const ringA=[],ringB=[];
        for(let i=0;i<sides;i++){
          const ang=(Math.PI*2*i)/sides,offset=add(mul(u,Math.cos(ang)*radius),mul(v,Math.sin(ang)*radius));
          ringA.push(applyBasis(basis,add(a,offset)));
          ringB.push(applyBasis(basis,add(b,offset)));
        }
        for(let i=0;i<sides;i++){
          const j=(i+1)%sides;
          out.push([ringA[i],ringA[j],ringB[j]],[ringA[i],ringB[j],ringB[i]]);
        }
        if(s===0){
          const center=applyBasis(basis,a);
          for(let i=0;i<sides;i++){const j=(i+1)%sides;out.push([center,ringA[j],ringA[i]]);}
        }
        if(s===path.length-2){
          const center=applyBasis(basis,b);
          for(let i=0;i<sides;i++){const j=(i+1)%sides;out.push([center,ringB[i],ringB[j]]);}
        }
      }
      return out;
    };
    const facetedBrep=(id,basis)=>{
      const brep=entities.get(id),shell=entities.get(refOf(brep?.args[0])); if(!brep||brep.type!=='IFCFACETEDBREP'||shell?.type!=='IFCCLOSEDSHELL') return [];
      const out=[];
      refsIn(shell.args[0]).forEach(faceId=>{
        const face=entities.get(faceId); if(face?.type!=='IFCFACE') return;
        const bounds=refsIn(face.args[0]),outer=bounds.map(x=>entities.get(x)).find(x=>x?.type==='IFCFACEOUTERBOUND')||entities.get(bounds[0]);
        const loop=entities.get(refOf(outer?.args[0])); if(loop?.type!=='IFCPOLYLOOP') return;
        polygon3D(refsIn(loop.args[0]).map(point)).forEach(tri=>out.push(tri.map(p=>applyBasis(basis,p))));
      });
      return out;
    };
    const indexedFaces=(id,basis)=>{
      const e=entities.get(id); if(!e) return [];
      if(e.type==='IFCTRIANGULATEDFACESET'){
        const pts=pointList3D(refOf(e.args[0])); if(!pts.length) return [];
        return [...String(e.args[3]||'').matchAll(/\((\s*\d+\s*,\s*\d+\s*,\s*\d+\s*)\)/g)]
          .map(m=>m[1].split(',').map(v=>pts[Number(v.trim())-1])).filter(t=>t.every(Boolean)).map(t=>t.map(p=>applyBasis(basis,p)));
      }
      if(e.type==='IFCPOLYGONALFACESET'){
        const pts=pointList3D(refOf(e.args[0])); if(!pts.length) return [];
        const out=[];
        refsIn(e.args[2]||'').forEach(faceId=>{
          const face=entities.get(faceId); if(face?.type!=='IFCINDEXEDPOLYGONALFACE') return;
          const poly=[...String(face.args[0]||'').matchAll(/\d+/g)].map(m=>pts[Number(m[0])-1]).filter(Boolean);
          polygon3D(poly).forEach(tri=>out.push(tri.map(p=>applyBasis(basis,p))));
        });
        return out;
      }
      return [];
    };
    const basisToLocal=(b,p)=>{const q=sub(p,b.origin);return{x:q.x*b.x.x+q.y*b.x.y+q.z*b.x.z,y:q.x*b.y.x+q.y*b.y.y+q.z*b.y.z,z:q.x*b.z.x+q.y*b.z.y+q.z*b.z.z};};
    const cartTransform=id=>{
      const e=entities.get(id); if(!e||!/IFCCARTESIANTRANSFORMATIONOPERATOR(3D)?/.test(e.type)) return identityBasis();
      const x=e.args[0]&&e.args[0]!=='$'?direction(refOf(e.args[0])):{x:1,y:0,z:0};
      const y=e.args[1]&&e.args[1]!=='$'?direction(refOf(e.args[1])):{x:0,y:1,z:0};
      const origin=point(refOf(e.args[2])),st=String(e.args[3]||'').trim(),scale=/[-+]?\d/.test(st)?num(st):1;
      const z=e.args[4]&&e.args[4]!=='$'?direction(refOf(e.args[4])):norm(cross(x,y),{x:0,y:0,z:1});
      return {origin,x:mul(norm(x,{x:1,y:0,z:0}),scale||1),y:mul(norm(y,{x:0,y:1,z:0}),scale||1),z:mul(norm(z,{x:0,y:0,z:1}),scale||1)};
    };
    const geometryTypes=new Set(['IFCPRODUCTDEFINITIONSHAPE','IFCSHAPEREPRESENTATION','IFCREPRESENTATIONMAP','IFCEXTRUDEDAREASOLID','IFCSWEPTDISKSOLID','IFCFACETEDBREP','IFCTRIANGULATEDFACESET','IFCPOLYGONALFACESET','IFCMAPPEDITEM','IFCBOOLEANCLIPPINGRESULT','IFCBOOLEANRESULT','IFCCSGSOLID']);
    const clipTrianglesByPlane=(triangles,planeBasis,keepPositive)=>{
      const eps=1e-7,normal=planeBasis.z,origin=planeBasis.origin,segments=[],out=[];
      const signed=p=>(p.x-origin.x)*normal.x+(p.y-origin.y)*normal.y+(p.z-origin.z)*normal.z;
      const inside=d=>keepPositive?d>=-eps:d<=eps;
      const intersect=(a,b,da,db)=>{
        const denom=da-db;
        const t=Math.abs(denom)<eps?.5:da/denom;
        return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
      };
      for(const tri of triangles){
        let poly=tri.map(p=>({p,d:signed(p)})),clipped=[],cuts=[];
        for(let i=0;i<poly.length;i++){
          const cur=poly[i],next=poly[(i+1)%poly.length],ci=inside(cur.d),ni=inside(next.d);
          if(ci&&ni) clipped.push(next);
          else if(ci&&!ni){const p=intersect(cur.p,next.p,cur.d,next.d);clipped.push({p,d:0});cuts.push(p);}
          else if(!ci&&ni){const p=intersect(cur.p,next.p,cur.d,next.d);clipped.push({p,d:0},next);cuts.push(p);}
        }
        if(clipped.length>=3){
          const pts=clipped.map(x=>x.p);
          for(let i=1;i<pts.length-1;i++) out.push([pts[0],pts[i],pts[i+1]]);
        }
        const unique=[];
        for(const p of cuts){
          if(!unique.some(q=>Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)<1e-6)) unique.push(p);
        }
        if(unique.length===2) segments.push(unique);
      }

      const key=p=>[p.x,p.y,p.z].map(v=>Math.round(v*1e6)).join(':');
      const points=new Map(),adj=new Map();
      const connect=(a,b)=>{
        const ka=key(a),kb=key(b);points.set(ka,a);points.set(kb,b);
        if(!adj.has(ka))adj.set(ka,new Set());if(!adj.has(kb))adj.set(kb,new Set());
        adj.get(ka).add(kb);adj.get(kb).add(ka);
      };
      segments.forEach(([a,b])=>connect(a,b));
      const visitedEdges=new Set(),loops=[];
      for(const start of adj.keys()){
        for(const first of adj.get(start)){
          const edgeKey=[start,first].sort().join('|'); if(visitedEdges.has(edgeKey)) continue;
          const loop=[start]; let prev=start,cur=first,guard=0;
          visitedEdges.add(edgeKey);
          while(guard++<10000){
            loop.push(cur);
            if(cur===start) break;
            const nexts=[...(adj.get(cur)||[])].filter(n=>n!==prev);
            if(!nexts.length) break;
            const next=nexts.find(n=>!visitedEdges.has([cur,n].sort().join('|')))||nexts[0];
            visitedEdges.add([cur,next].sort().join('|'));
            prev=cur;cur=next;
          }
          if(loop.length>=4&&loop[loop.length-1]===start) loops.push(loop.slice(0,-1).map(k=>points.get(k)));
        }
      }

      const desiredNormal=keepPositive?mul(normal,-1):normal;
      for(const loop of loops){
        const projected=loop.map(p=>({x:dot3(sub(p,origin),planeBasis.x),y:dot3(sub(p,origin),planeBasis.y)}));
        const faces=triangulate2D(projected);
        for(const [ia,ib,ic] of faces){
          let tri=[loop[ia],loop[ib],loop[ic]];
          const n=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0]));
          if(dot3(n,desiredNormal)<0) tri=[tri[0],tri[2],tri[1]];
          out.push(tri);
        }
      }
      return out;
    };
    const dot3=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
    const halfSpaceDifference=(triangles,halfSpaceId,basis)=>{
      const hs=entities.get(halfSpaceId);
      if(!hs||!['IFCHALFSPACESOLID','IFCBOXEDHALFSPACE'].includes(hs.type)) return null;
      const surface=entities.get(refOf(hs.args[0]));
      if(!surface||surface.type!=='IFCPLANE') return null;
      const planeBasis=composeBasis(basis,axis3(refOf(surface.args[0])));
      const agreement=/\.T\./i.test(String(hs.args[1]||''));
      // If agreement is TRUE, the half-space material is opposite the plane normal.
      // Difference therefore keeps the positive side. FALSE keeps the negative side.
      return clipTrianglesByPlane(triangles,planeBasis,agreement);
    };
    const pointList2D=id=>{
      const e=entities.get(id); if(!e||e.type!=='IFCCARTESIANPOINTLIST2D') return [];
      return [...String(e.args[0]||'').matchAll(/\(([-+0-9Ee.,\s]+)\)/g)].map(m=>{
        const v=m[1].split(',').map(x=>Number(x.trim()));
        return {x:v[0]||0,y:v[1]||0};
      }).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
    };
    const boundedCurve2D=id=>{
      const e=entities.get(id); if(!e) return [];
      if(e.type==='IFCPOLYLINE'){
        const pts=refsIn(e.args[0]).map(point).map(p=>({x:p.x,y:p.y}));
        if(pts.length>2&&Math.hypot(pts[0].x-pts[pts.length-1].x,pts[0].y-pts[pts.length-1].y)<1e-9) pts.pop();
        return pts;
      }
      if(e.type==='IFCINDEXEDPOLYCURVE'){
        const pts=pointList2D(refOf(e.args[0]));
        if(pts.length>2&&Math.hypot(pts[0].x-pts[pts.length-1].x,pts[0].y-pts[pts.length-1].y)<1e-9) pts.pop();
        return pts;
      }
      return [];
    };
    const prismFromBoundary=(poly,positionBasis,subjectTriangles)=>{
      if(poly.length<3) return [];
      let maxZ=0;
      for(const tri of subjectTriangles) for(const p of tri) maxZ=Math.max(maxZ,basisToLocal(positionBasis,p).z);
      const depth=Math.max(1,maxZ+Math.max(1,Math.abs(maxZ)*0.25));
      const bottom=poly.map(p=>applyBasis(positionBasis,{x:p.x,y:p.y,z:0}));
      const top=poly.map(p=>applyBasis(positionBasis,{x:p.x,y:p.y,z:depth}));
      const out=[];
      triangulate2D(poly).forEach(([a,b,c])=>{out.push([bottom[a],bottom[c],bottom[b]],[top[a],top[b],top[c]]);});
      for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length;out.push([bottom[i],bottom[j],top[j]],[bottom[i],top[j],top[i]]);}
      return out;
    };
    const polygonalHalfSpaceDifference=(triangles,halfSpaceId,basis)=>{
      const hs=entities.get(halfSpaceId);
      if(!hs||hs.type!=='IFCPOLYGONALBOUNDEDHALFSPACE'||typeof BIMCSG==='undefined') return null;
      const surface=entities.get(refOf(hs.args[0])); if(!surface||surface.type!=='IFCPLANE') return null;
      const positionBasis=composeBasis(basis,axis3(refOf(hs.args[2])));
      const poly=boundedCurve2D(refOf(hs.args[3])); if(poly.length<3) return null;
      let cutter=prismFromBoundary(poly,positionBasis,triangles); if(!cutter.length) return null;
      const planeBasis=composeBasis(basis,axis3(refOf(surface.args[0])));
      const agreement=/\.T\./i.test(String(hs.args[1]||''));
      // Material half-space: TRUE => lado negativo; FALSE => lado positivo.
      cutter=clipTrianglesByPlane(cutter,planeBasis,!agreement);
      if(!cutter.length) return triangles;
      return BIMCSG.subtract(triangles,cutter);
    };
    const exactBooleanIds=new Set();
    const partialBooleanIds=new Set();
    const representation=(id,basis,depth=0)=>{
      if(!id||depth>20) return [];
      const e=entities.get(id); if(!e) return [];
      if(e.type==='IFCEXTRUDEDAREASOLID') return extrusion(id,basis);
      if(e.type==='IFCSWEPTDISKSOLID') return sweptDiskSolid(id,basis);
      if(e.type==='IFCFACETEDBREP') return facetedBrep(id,basis);
      if(e.type==='IFCTRIANGULATEDFACESET'||e.type==='IFCPOLYGONALFACESET') return indexedFaces(id,basis);
      if(e.type==='IFCMAPPEDITEM'){
        const map=entities.get(refOf(e.args[0])); if(map?.type!=='IFCREPRESENTATIONMAP') return [];
        const origin=axis3(refOf(map.args[0])),target=cartTransform(refOf(e.args[1]));
        return representation(refOf(map.args[1]),identityBasis(),depth+1).map(tri=>tri.map(p=>applyBasis(basis,applyBasis(target,basisToLocal(origin,p)))));
      }
      if(e.type==='IFCBOOLEANCLIPPINGRESULT'||e.type==='IFCBOOLEANRESULT'){
        const operator=String(e.args[0]||'.DIFFERENCE.').toUpperCase();
        const firstId=refOf(e.args[1]),secondId=refOf(e.args[2]);
        const first=representation(firstId,basis,depth+1);
        const secondEntity=entities.get(secondId);
        if(first.length&&operator.includes('DIFFERENCE')&&['IFCHALFSPACESOLID','IFCBOXEDHALFSPACE','IFCPOLYGONALBOUNDEDHALFSPACE'].includes(secondEntity?.type)){
          try{
            const clipped=secondEntity.type==='IFCPOLYGONALBOUNDEDHALFSPACE'
              ? polygonalHalfSpaceDifference(first,secondId,basis)
              : halfSpaceDifference(first,secondId,basis);
            if(clipped&&clipped.length){
              exactBooleanIds.add(e.id);
              return clipped;
            }
          }catch(err){
            console.warn('[FinGo BIM] half-space IFC caiu para geometria parcial:',err?.message||err);
          }
          partialBooleanIds.add(e.id);
          return first;
        }
        const second=representation(secondId,basis,depth+1);
        if(first.length&&second.length&&typeof BIMCSG!=='undefined'){
          try{
            const result=BIMCSG.booleanOperation(operator,first,second);
            if(result.length){
              exactBooleanIds.add(e.id);
              return result;
            }
          }catch(err){
            console.warn('[FinGo BIM] CSG IFC caiu para geometria parcial:',err?.message||err);
          }
        }
        partialBooleanIds.add(e.id);
        return first;
      }
      if(e.type==='IFCCSGSOLID'){
        const root=refsIn(e.raw)[0];
        const result=representation(root,basis,depth+1);
        if(result.length&&!partialBooleanIds.has(root)) exactBooleanIds.add(e.id);
        else partialBooleanIds.add(e.id);
        return result;
      }
      if(e.type==='IFCPRODUCTDEFINITIONSHAPE'||e.type==='IFCSHAPEREPRESENTATION'||e.type==='IFCREPRESENTATIONMAP'){
        const out=[]; for(const child of refsIn(e.raw)){const ce=entities.get(child);if(ce&&geometryTypes.has(ce.type)) out.push(...representation(child,basis,depth+1));} return out;
      }
      return [];
    };
    const childrenOf=id=>refsIn(entities.get(id)?.raw||'');
    const descendants=(id,target,maxDepth=10)=>{
      const found=[],seen=new Set();
      const walk=(x,d)=>{if(!x||d>maxDepth||seen.has(x))return;seen.add(x);const e=entities.get(x);if(!e)return;if(target.has(e.type))found.push(x);childrenOf(x).forEach(c=>walk(c,d+1));};
      walk(id,0);return found;
    };
    const productType=type=>/^IFC(WALL|WALLSTANDARDCASE|SLAB|BEAM|COLUMN|FOOTING|ROOF|COVERING|DOOR|WINDOW|STAIR|MEMBER|PLATE|CURTAINWALL|BUILDINGELEMENTPROXY|FLOWSEGMENT|PIPESEGMENT|DUCTSEGMENT|CABLESEGMENT)/.test(String(type||''));

    const storeys=new Map();
    for(const e of entities.values()){
      if(e.type!=='IFCBUILDINGSTOREY') continue;
      const name=unquote(e.args[2]||'')||('Pavimento #'+e.id),token=String(e.args[e.args.length-1]||'').trim();
      const elevation=/^[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?$/.test(token)?Number(token):0;
      storeys.set(e.id,{id:e.id,key:'storey_'+e.id,name,elevation});
    }
    const storeyByProduct=new Map();
    for(const e of entities.values()){
      if(e.type!=='IFCRELCONTAINEDINSPATIALSTRUCTURE') continue;
      const refs=refsIn(e.raw),sid=refs.find(x=>entities.get(x)?.type==='IFCBUILDINGSTOREY'); if(!sid) continue;
      refs.filter(x=>x!==sid&&productType(entities.get(x)?.type)).forEach(x=>storeyByProduct.set(x,storeys.get(sid)));
    }
    const openingsByHost=new Map();
    for(const e of entities.values()){
      if(e.type!=='IFCRELVOIDSELEMENT') continue;
      const refs=refsIn(e.raw);
      const host=refs.find(x=>productType(entities.get(x)?.type));
      const opening=refs.find(x=>entities.get(x)?.type==='IFCOPENINGELEMENT');
      if(!host||!opening) continue;
      if(!openingsByHost.has(host)) openingsByHost.set(host,[]);
      openingsByHost.get(host).push(opening);
    }
    const openingTriangles=openingId=>{
      const opening=entities.get(openingId); if(!opening||opening.type!=='IFCOPENINGELEMENT') return [];
      const placementId=refsIn(opening.raw).find(x=>entities.get(x)?.type==='IFCLOCALPLACEMENT');
      const reprId=refsIn(opening.raw).find(x=>entities.get(x)?.type==='IFCPRODUCTDEFINITIONSHAPE');
      if(!reprId) return [];
      return representation(reprId,localPlacement(placementId));
    };
    const psets=new Map();
    for(const e of entities.values()){
      if(e.type!=='IFCRELDEFINESBYPROPERTIES') continue;
      const refs=refsIn(e.raw),pid=refs.find(x=>entities.get(x)?.type==='IFCPROPERTYSET'); if(!pid) continue;
      const ps=entities.get(pid),name=unquote(ps.args[2]||'PropertySet'),values={};
      refsIn(ps.args[ps.args.length-1]||'').forEach(propId=>{const p=entities.get(propId);if(p?.type==='IFCPROPERTYSINGLEVALUE') values[unquote(p.args[0]||('#'+propId))]=parseIfcValue(p.args[2]);});
      refs.filter(x=>x!==pid&&productType(entities.get(x)?.type)).forEach(x=>{if(!psets.has(x))psets.set(x,{});psets.get(x)[name]=values;});
    }

    const elements=[],geometryKinds=new Set(); let partialElements=0;
    for(const e of entities.values()){
      if(!productType(e.type)) continue;
      const placementId=refsIn(e.raw).find(x=>entities.get(x)?.type==='IFCLOCALPLACEMENT');
      const reprId=refsIn(e.raw).find(x=>entities.get(x)?.type==='IFCPRODUCTDEFINITIONSHAPE'); if(!reprId) continue;
      let tris=representation(reprId,localPlacement(placementId)); if(!tris.length) continue;
      const mapped=descendants(reprId,new Set(['IFCMAPPEDITEM'])).length>0;
      const brep=descendants(reprId,new Set(['IFCFACETEDBREP'])).length>0;
      const tess=descendants(reprId,new Set(['IFCTRIANGULATEDFACESET','IFCPOLYGONALFACESET'])).length>0;
      const swept=descendants(reprId,new Set(['IFCEXTRUDEDAREASOLID'])).length>0;
      const sweptDisk=descendants(reprId,new Set(['IFCSWEPTDISKSOLID'])).length>0;
      const booleanIds=descendants(reprId,new Set(['IFCBOOLEANCLIPPINGRESULT','IFCBOOLEANRESULT','IFCCSGSOLID']));
      const boundedHalfSpaces=descendants(reprId,new Set(['IFCPOLYGONALBOUNDEDHALFSPACE']));
      const faceVoids=descendants(reprId,new Set(['IFCINDEXEDPOLYGONALFACEWITHVOIDS'])).length>0;
      const booleanPartial=booleanIds.some(id=>partialBooleanIds.has(id));
      const booleanExact=booleanIds.length>0&&!booleanPartial&&booleanIds.every(id=>exactBooleanIds.has(id));

      let openingExact=true,openingSubtractions=0;
      const openings=openingsByHost.get(e.id)||[];
      for(const openingId of openings){
        const cutter=openingTriangles(openingId);
        if(!cutter.length||typeof BIMCSG==='undefined'){openingExact=false;continue;}
        try{
          const cut=BIMCSG.subtract(tris,cutter);
          if(!cut.length){openingExact=false;continue;}
          tris=cut;
          openingSubtractions++;
        }catch(err){
          console.warn('[FinGo BIM] abertura IFC caiu para geometria parcial:',err?.message||err);
          openingExact=false;
        }
      }

      const partial=booleanPartial||faceVoids||(openings.length>0&&!openingExact);
      if(partial) partialElements++;
      if(mapped)geometryKinds.add('mapped-item');if(brep)geometryKinds.add('faceted-brep');if(tess)geometryKinds.add('tessellated-face-set');if(swept)geometryKinds.add('swept-solid');if(sweptDisk)geometryKinds.add('swept-disk-solid');if(booleanExact)geometryKinds.add('csg-exact');if(openingSubtractions)geometryKinds.add('opening-subtraction');
      const globalId=unquote(e.args[0]||('#'+e.id)),name=unquote(e.args[2]||'')||(e.type+' #'+e.id),storey=storeyByProduct.get(e.id)||null;
      const kinds=[mapped?'MappedItem':null,brep?'FacetedBrep':null,tess?'TessellatedFaceSet':null,swept?'SweptSolid':null,sweptDisk?'SweptDiskSolid':null,booleanExact?'CSG':null,openingSubtractions?'Openings':null].filter(Boolean);
      elements.push({
        id:'ifc_'+(globalId||e.id),name,floor:storey?.key||'all',discipline:disciplineForClass(e.type),category:e.type,color:colorForClass(e.type),rawTriangles:tris,
        importedProperties:{
          format:'IFC',ifcClass:e.type,globalId,stepId:e.id,storeyId:storey?.id||null,storeyName:storey?.name||null,storeyElevation:storey?.elevation??null,
          psets:psets.get(e.id)||{},geometryKinds:kinds,geometryQuality:partial?'partial':(kinds.join('+')||'supported'),
          openingCount:openings.length,openingSubtractions,booleanExact,
          partialReason:booleanPartial?(boundedHalfSpaces.length?'polygonal-bounded-halfspace-curve-not-supported':'boolean-or-csg-operand-not-supported'):faceVoids?'polygon-face-voids-not-supported':(openings.length&&!openingExact)?'opening-subtraction-failed':null,
          clashEligible:!partial
        }
      });
    }
    if(!elements.length) throw new Error('IFC válido, mas sem geometria compatível com SweptSolid, SweptDiskSolid, MappedItem, FacetedBrep ou TessellatedFaceSet.');
    const schema=src.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i)?.[1]||'IFC';
    const si=[...entities.values()].find(e=>e.type==='IFCSIUNIT'&&/LENGTHUNIT/.test(e.raw));
    const sourceLengthUnit=si?(String(si.raw).match(/\.(MILLI|CENTI|DECI|KILO)?\.,\.METRE\./i)?.[1]||'METRE').toLowerCase():'unknown';
    return {elements,metadata:{schema,geometryKinds:Array.from(geometryKinds),storeys:Array.from(storeys.values()),partialElements,clashEligible:partialElements===0,sourceElementCount:elements.length,sourceLengthUnit,geometryQuality:partialElements?'partial':'supported',csgEngine:typeof BIMCSG!=='undefined'?'bsp':'unavailable'}};
  }
  return {parse};
})();

if (typeof window !== 'undefined') window.BIMIFCExtendedImporter = BIMIFCExtendedImporter;
