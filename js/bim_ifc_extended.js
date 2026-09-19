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
    const schema=src.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i)?.[1]||'IFC';
    const schemaSupportsAdvancedBrep=!/^IFC2X3/i.test(schema);

    const angularSegments=(sweep,min=4,max=96)=>{
      const ratio=Math.abs(sweep)/(Math.PI/24);
      return Math.max(min,Math.min(max,Math.ceil(ratio-1e-9)));
    };
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
    const rotateAroundAxis=(p,origin,axis,angle)=>{
      const v=sub(p,origin),k=norm(axis,{x:0,y:0,z:1}),cos=Math.cos(angle),sin=Math.sin(angle);
      const term1=mul(v,cos),term2=mul(cross(k,v),sin),term3=mul(k,(k.x*v.x+k.y*v.y+k.z*v.z)*(1-cos));
      return add(origin,add(term1,add(term2,term3)));
    };
    const axis1=id=>{
      const e=entities.get(id); if(!e||e.type!=='IFCAXIS1PLACEMENT') return {origin:{x:0,y:0,z:0},axis:{x:0,y:0,z:1}};
      return {origin:point(refOf(e.args[0])),axis:e.args[1]&&e.args[1]!=='$'?direction(refOf(e.args[1])):{x:0,y:0,z:1}};
    };
    const revolvedAreaSolid=(id,basis)=>{
      const e=entities.get(id); if(!e||e.type!=='IFCREVOLVEDAREASOLID') return [];
      const poly=profilePolygon(refOf(e.args[0])),position=axis3(refOf(e.args[1])),axis=axis1(refOf(e.args[2])),angle=Math.abs(num(e.args[3])*(planeAngleScaleToRadians()||1));
      if(!poly||poly.length<3||angle<=1e-9) return [];
      const sweep=Math.min(Math.PI*2,angle),segments=angularSegments(sweep,8,96);
      const rings=[];
      for(let s=0;s<=segments;s++){
        const a=sweep*(s/segments);
        rings.push(poly.map(p=>{
          const local=rotateAroundAxis({x:p.x,y:p.y,z:0},axis.origin,axis.axis,a);
          return applyBasis(basis,applyBasis(position,local));
        }));
      }
      const out=[];
      for(let s=0;s<segments;s++){
        const r0=rings[s],r1=rings[s+1];
        for(let i=0;i<poly.length;i++){
          const j=(i+1)%poly.length;
          out.push([r0[i],r0[j],r1[j]],[r0[i],r1[j],r1[i]]);
        }
      }
      if(sweep<Math.PI*2-1e-6){
        const caps=triangulate2D(poly);
        caps.forEach(([a,b,c])=>{
          out.push([rings[0][a],rings[0][c],rings[0][b]]);
          out.push([rings[segments][a],rings[segments][b],rings[segments][c]]);
        });
      }
      return out;
    };
    const localBoxTriangles=(w,d,h)=>{
      const v=[
        {x:0,y:0,z:0},{x:w,y:0,z:0},{x:w,y:d,z:0},{x:0,y:d,z:0},
        {x:0,y:0,z:h},{x:w,y:0,z:h},{x:w,y:d,z:h},{x:0,y:d,z:h}
      ];
      const f=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
      return f.map(t=>t.map(i=>v[i]));
    };
    const csgPrimitive=(id,basis)=>{
      const e=entities.get(id); if(!e) return [];
      const position=composeBasis(basis,axis3(refOf(e.args[0])));
      if(e.type==='IFCBLOCK'){
        const x=num(e.args[1]),y=num(e.args[2]),z=num(e.args[3]);
        if(x<=0||y<=0||z<=0) return [];
        return localBoxTriangles(x,y,z).map(tri=>tri.map(p=>applyBasis(position,p)));
      }
      if(e.type==='IFCRIGHTCIRCULARCYLINDER'||e.type==='IFCRIGHTCIRCULARCONE'){
        const height=num(e.args[1]),radius=num(e.args[2]);
        if(height<=0||radius<=0) return [];
        const topRadius=e.type==='IFCRIGHTCIRCULARCONE'?0:radius,sides=24,out=[],bottom=[],top=[];
        for(let i=0;i<sides;i++){
          const a=Math.PI*2*i/sides;
          bottom.push(applyBasis(position,{x:Math.cos(a)*radius,y:Math.sin(a)*radius,z:0}));
          top.push(applyBasis(position,{x:Math.cos(a)*topRadius,y:Math.sin(a)*topRadius,z:height}));
        }
        const cb=applyBasis(position,{x:0,y:0,z:0}),ct=applyBasis(position,{x:0,y:0,z:height});
        for(let i=0;i<sides;i++){
          const j=(i+1)%sides;
          out.push([cb,bottom[j],bottom[i]]);
          if(topRadius>1e-9){
            out.push([ct,top[i],top[j]],[bottom[i],bottom[j],top[j]],[bottom[i],top[j],top[i]]);
          }else{
            out.push([bottom[i],bottom[j],ct]);
          }
        }
        return out;
      }
      if(e.type==='IFCRECTANGULARPYRAMID'){
        const x=num(e.args[1]),y=num(e.args[2]),h=num(e.args[3]);
        if(x<=0||y<=0||h<=0) return [];
        const p=[
          applyBasis(position,{x:0,y:0,z:0}),applyBasis(position,{x:x,y:0,z:0}),
          applyBasis(position,{x:x,y:y,z:0}),applyBasis(position,{x:0,y:y,z:0}),
          applyBasis(position,{x:x/2,y:y/2,z:h})
        ];
        return [[p[0],p[2],p[1]],[p[0],p[3],p[2]],[p[0],p[1],p[4]],[p[1],p[2],p[4]],[p[2],p[3],p[4]],[p[3],p[0],p[4]]];
      }
      if(e.type==='IFCSPHERE'){
        const radius=num(e.args[1]); if(radius<=0) return [];
        const lat=12,lon=24,out=[];
        for(let i=0;i<lat;i++){
          const a0=-Math.PI/2+Math.PI*i/lat,a1=-Math.PI/2+Math.PI*(i+1)/lat;
          for(let j=0;j<lon;j++){
            const b0=Math.PI*2*j/lon,b1=Math.PI*2*(j+1)/lon;
            const p=(a,b)=>applyBasis(position,{x:Math.cos(a)*Math.cos(b)*radius,y:Math.cos(a)*Math.sin(b)*radius,z:Math.sin(a)*radius});
            const p00=p(a0,b0),p01=p(a0,b1),p10=p(a1,b0),p11=p(a1,b1);
            if(i>0) out.push([p00,p10,p11]);
            if(i<lat-1) out.push([p00,p11,p01]);
          }
        }
        return out;
      }
      return [];
    };
    const pointListAny=id=>{
      const e=entities.get(id); if(!e||!['IFCCARTESIANPOINTLIST3D','IFCCARTESIANPOINTLIST2D'].includes(e.type)) return [];
      return [...String(e.args[0]||'').matchAll(/\(([-+0-9Ee.,\s]+)\)/g)].map(m=>{
        const v=m[1].split(',').map(x=>Number(x.trim()));
        return {x:v[0]||0,y:v[1]||0,z:v[2]||0};
      }).filter(p=>[p.x,p.y,p.z].every(Number.isFinite));
    };
    const pointList3D=id=>entities.get(id)?.type==='IFCCARTESIANPOINTLIST3D'?pointListAny(id):[];
    const partialCurveIds=new Set();
    const exactCurveKinds=new Set();
    const appendPoints=(target,pts)=>{
      for(const p of pts||[]){
        const last=target[target.length-1];
        if(!last||Math.hypot(last.x-p.x,last.y-p.y,last.z-p.z)>1e-8) target.push(p);
      }
      return target;
    };
    const sampleArc3D=(p1,p2,p3)=>{
      const a=sub(p2,p1),b=sub(p3,p1),axb=cross(a,b),den=2*(axb.x*axb.x+axb.y*axb.y+axb.z*axb.z);
      if(Math.abs(den)<1e-12) return [p1,p3];
      const aa=a.x*a.x+a.y*a.y+a.z*a.z,bb=b.x*b.x+b.y*b.y+b.z*b.z;
      const center=add(p1,mul(add(mul(cross(b,axb),aa),mul(cross(axb,a),bb)),1/den));
      const normal=norm(axb,{x:0,y:0,z:1}),u=norm(sub(p1,center),{x:1,y:0,z:0}),v=norm(cross(normal,u),{x:0,y:1,z:0});
      const angle=p=>Math.atan2((p.x-center.x)*v.x+(p.y-center.y)*v.y+(p.z-center.z)*v.z,(p.x-center.x)*u.x+(p.y-center.y)*u.y+(p.z-center.z)*u.z);
      const normPos=x=>{let y=x%(Math.PI*2);if(y<0)y+=Math.PI*2;return y;};
      const midPos=normPos(angle(p2)),endPos=normPos(angle(p3));
      let sweep=(midPos>1e-8&&midPos<endPos-1e-8)?endPos:(endPos-Math.PI*2);
      if(Math.abs(sweep)<1e-8) sweep=Math.PI*2;
      const radius=Math.hypot(p1.x-center.x,p1.y-center.y,p1.z-center.z);
      const segments=Math.max(4,Math.min(48,Math.ceil(Math.abs(sweep)/(Math.PI/18))));
      const out=[];
      for(let i=0;i<=segments;i++){
        const ang=sweep*(i/segments);
        out.push(add(center,add(mul(u,Math.cos(ang)*radius),mul(v,Math.sin(ang)*radius))));
      }
      return out;
    };
    const curveBasis=id=>{
      const e=entities.get(id); if(!e) return identityBasis();
      if(e.type==='IFCAXIS2PLACEMENT3D') return axis3(id);
      if(e.type==='IFCAXIS2PLACEMENT2D'){
        const a=axis2(id);
        return {origin:{x:a.origin.x,y:a.origin.y,z:0},x:{x:a.x.x,y:a.x.y,z:0},y:{x:a.y.x,y:a.y.y,z:0},z:{x:0,y:0,z:1}};
      }
      return identityBasis();
    };
    const localInBasis=(b,p)=>{
      const q=sub(p,b.origin);
      return {x:q.x*b.x.x+q.y*b.x.y+q.z*b.x.z,y:q.x*b.y.x+q.y*b.y.y+q.z*b.y.z,z:q.x*b.z.x+q.y*b.z.y+q.z*b.z.z};
    };
    const sampleConic=(entity,start=0,sweep=Math.PI*2,close=false)=>{
      const pos=curveBasis(refOf(entity.args[0])),rx=num(entity.args[1]),ry=entity.type==='IFCELLIPSE'?num(entity.args[2]):rx;
      if(rx<=0||ry<=0) return [];
      const segments=angularSegments(sweep,8,96);
      const out=[];
      for(let i=0;i<=segments;i++){
        const t=start+sweep*(i/segments);
        out.push(applyBasis(pos,{x:Math.cos(t)*rx,y:Math.sin(t)*ry,z:0}));
      }
      if(close&&out.length&&Math.hypot(out[0].x-out[out.length-1].x,out[0].y-out[out.length-1].y,out[0].z-out[out.length-1].z)>1e-8) out.push({...out[0]});
      return out;
    };
    const trimAngle=(token,entity)=>{
      const pos=curveBasis(refOf(entity.args[0])),rx=num(entity.args[1]),ry=entity.type==='IFCELLIPSE'?num(entity.args[2]):rx;
      const pid=refsIn(token)[0];
      if(pid&&entities.get(pid)?.type==='IFCCARTESIANPOINT'){
        const p=localInBasis(pos,point(pid));
        return Math.atan2(p.y/(ry||1),p.x/(rx||1));
      }
      const m=String(token||'').match(/[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?/);
      if(!m) return null;
      return Number(m[0])*(planeAngleScaleToRadians()||1);
    };
    const indexedPolyCurvePoints=e=>{
      const pts=pointListAny(refOf(e.args[0])); if(!pts.length) return [];
      const segText=String(e.args[1]||'');
      if(!segText||segText==='$') return pts;
      const out=[]; let matched=0;
      const re=/IFC(LINE|ARC)INDEX\s*\(\s*\(([^)]*)\)\s*\)/gi; let m;
      while((m=re.exec(segText))){
        matched++;
        const idx=m[2].split(',').map(x=>Number(x.trim())-1).filter(Number.isInteger);
        if(m[1].toUpperCase()==='LINE') appendPoints(out,idx.map(i=>pts[i]).filter(Boolean));
        else if(idx.length===3&&idx.every(i=>pts[i])){appendPoints(out,sampleArc3D(pts[idx[0]],pts[idx[1]],pts[idx[2]]));exactCurveKinds.add('indexed-arc');}
        else partialCurveIds.add(e.id);
      }
      if(!matched){partialCurveIds.add(e.id);return pts;}
      exactCurveKinds.add('indexed-polycurve');
      return out;
    };
    const numberList=token=>[...String(token||'').matchAll(/[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?/g)].map(m=>Number(m[0])).filter(Number.isFinite);
    const bsplineCurvePoints=e=>{
      const degree=Math.trunc(num(e.args[0]));
      const controlIds=refsIn(e.args[1]||'');
      const controls=controlIds.map(point);
      if(degree<1||controls.length<degree+1){partialCurveIds.add(e.id);return [];}

      const withKnots=/BSPLINECURVEWITHKNOTS/.test(e.type);
      const rational=/RATIONALBSPLINECURVEWITHKNOTS/.test(e.type);
      let knotVector=[];
      if(withKnots){
        const multiplicities=numberList(e.args[5]);
        const knots=numberList(e.args[6]);
        if(!multiplicities.length||multiplicities.length!==knots.length){partialCurveIds.add(e.id);return [];}
        for(let i=0;i<knots.length;i++){
          const count=Math.max(0,Math.trunc(multiplicities[i]));
          for(let k=0;k<count;k++) knotVector.push(knots[i]);
        }
      }
      if(!knotVector.length){
        partialCurveIds.add(e.id);
        return [];
      }
      if(knotVector.length!==controls.length+degree+1){
        partialCurveIds.add(e.id);
        return [];
      }

      const weights=rational?numberList(e.args[8]):controls.map(()=>1);
      if(weights.length!==controls.length||weights.some(w=>!Number.isFinite(w)||w<=0)){partialCurveIds.add(e.id);return [];}

      const n=controls.length-1;
      const uMin=knotVector[degree],uMax=knotVector[n+1];
      if(!Number.isFinite(uMin)||!Number.isFinite(uMax)||uMax-uMin<=1e-12){partialCurveIds.add(e.id);return [];}

      const findSpan=u=>{
        if(u>=knotVector[n+1]-1e-12) return n;
        if(u<=knotVector[degree]+1e-12) return degree;
        let low=degree,high=n+1,mid=Math.floor((low+high)/2);
        while(u<knotVector[mid]||u>=knotVector[mid+1]){
          if(u<knotVector[mid]) high=mid; else low=mid;
          mid=Math.floor((low+high)/2);
        }
        return mid;
      };
      const basisFunctions=(span,u)=>{
        const N=new Array(degree+1).fill(0),left=new Array(degree+1),right=new Array(degree+1);
        N[0]=1;
        for(let j=1;j<=degree;j++){
          left[j]=u-knotVector[span+1-j];
          right[j]=knotVector[span+j]-u;
          let saved=0;
          for(let r=0;r<j;r++){
            const denom=right[r+1]+left[j-r];
            const temp=Math.abs(denom)<1e-14?0:N[r]/denom;
            N[r]=saved+right[r+1]*temp;
            saved=left[j-r]*temp;
          }
          N[j]=saved;
        }
        return N;
      };
      const evaluate=u=>{
        const span=findSpan(u),N=basisFunctions(span,u);
        let x=0,y=0,z=0,w=0;
        for(let j=0;j<=degree;j++){
          const idx=span-degree+j,weight=weights[idx],b=N[j]*weight,p=controls[idx];
          x+=p.x*b;y+=p.y*b;z+=p.z*b;w+=b;
        }
        return Math.abs(w)<1e-14?null:{x:x/w,y:y/w,z:z/w};
      };

      let nonZeroSpans=0;
      for(let i=degree;i<=n;i++) if(knotVector[i+1]-knotVector[i]>1e-12) nonZeroSpans++;
      const samples=Math.max(24,Math.min(128,nonZeroSpans*16));
      const out=[];
      for(let i=0;i<=samples;i++){
        const u=i===samples?uMax:uMin+(uMax-uMin)*(i/samples);
        const p=evaluate(u);
        if(p) appendPoints(out,[p]);
      }
      if(out.length<2){partialCurveIds.add(e.id);return [];}
      exactCurveKinds.add(rational?'nurbs-curve':'bspline-curve');
      return out;
    };

    const curvePoints=(id,depth=0)=>{
      if(!id||depth>20) return [];
      const e=entities.get(id); if(!e) return [];
      if(e.type==='IFCPOLYLINE') return refsIn(e.args[0]).map(point);
      if(e.type==='IFCINDEXEDPOLYCURVE') return indexedPolyCurvePoints(e);
      if(e.type==='IFCBSPLINECURVEWITHKNOTS'||e.type==='IFCRATIONALBSPLINECURVEWITHKNOTS') return bsplineCurvePoints(e);
      if(e.type==='IFCCIRCLE'||e.type==='IFCELLIPSE'){exactCurveKinds.add(e.type==='IFCCIRCLE'?'circle':'ellipse');return sampleConic(e,0,Math.PI*2,true);}
      if(e.type==='IFCTRIMMEDCURVE'){
        const baseEntity=entities.get(refOf(e.args[0]));
        if(!baseEntity||!['IFCCIRCLE','IFCELLIPSE'].includes(baseEntity.type)){partialCurveIds.add(e.id);return [];}
        const a0=trimAngle(e.args[1],baseEntity),a1=trimAngle(e.args[2],baseEntity);
        if(a0===null||a1===null){partialCurveIds.add(e.id);return [];}
        const sense=/\.T\./i.test(String(e.args[3]||'')); let sweep=a1-a0;
        if(sense&&sweep<=0)sweep+=Math.PI*2;if(!sense&&sweep>=0)sweep-=Math.PI*2;
        exactCurveKinds.add('trimmed-conic');return sampleConic(baseEntity,a0,sweep,false);
      }
      if(e.type==='IFCCOMPOSITECURVESEGMENT'){
        const parent=refOf(e.args[2]),sameSense=/\.T\./i.test(String(e.args[1]||'')); let pts=curvePoints(parent,depth+1);
        if(partialCurveIds.has(parent))partialCurveIds.add(e.id);if(!sameSense)pts=[...pts].reverse();return pts;
      }
      if(e.type==='IFCCOMPOSITECURVE'){
        const out=[],segments=refsIn(e.args[0]);
        for(const segId of segments){const pts=curvePoints(segId,depth+1);if(!pts.length||partialCurveIds.has(segId))partialCurveIds.add(e.id);appendPoints(out,pts);}
        if(out.length)exactCurveKinds.add('composite-curve');return out;
      }
      partialCurveIds.add(e.id);return [];
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
    const vertexPoint=id=>{
      const v=entities.get(id); if(!v||v.type!=='IFCVERTEXPOINT') return null;
      const p=entities.get(refOf(v.args[0])); return p?.type==='IFCCARTESIANPOINT'?point(p.id):null;
    };
    const edgeCurvePoints=edgeId=>{
      const edge=entities.get(edgeId); if(!edge||edge.type!=='IFCEDGECURVE') return [];
      const start=vertexPoint(refOf(edge.args[0])),end=vertexPoint(refOf(edge.args[1]));
      if(!start||!end) return [];
      const geomId=refOf(edge.args[2]),geom=entities.get(geomId);
      let pts=[];
      if(geom&&geom.type!=='IFCLINE') pts=curvePoints(geomId);
      if(pts.length<2) return [start,end];
      const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
      if(dist(pts[pts.length-1],start)<dist(pts[0],start)) pts=[...pts].reverse();
      return pts;
    };
    const loopPoints=id=>{
      const loop=entities.get(id); if(!loop) return [];
      if(loop.type==='IFCPOLYLOOP') return refsIn(loop.args[0]).map(point);
      if(loop.type!=='IFCEDGELOOP') return [];
      const out=[];
      refsIn(loop.args[0]).forEach(orientedId=>{
        const oriented=entities.get(orientedId); if(oriented?.type!=='IFCORIENTEDEDGE') return;
        const edgeId=refOf(oriented.args[2]);
        let pts=edgeCurvePoints(edgeId);
        const orientation=/\.T\./i.test(String(oriented.args[3]||''));
        if(!orientation) pts=[...pts].reverse();
        appendPoints(out,pts);
      });
      if(out.length>2){
        const a=out[0],b=out[out.length-1];
        if(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-8) out.pop();
      }
      return out;
    };
    const exactAdvancedBrepTopologyIds=new Set();
    const partialAdvancedBrepTopologyReasons=new Map();
    const orientedEdgeTopology=orientedId=>{
      const oriented=entities.get(orientedId);
      if(!oriented||oriented.type!=='IFCORIENTEDEDGE') return null;
      const edgeId=refOf(oriented.args[2]),edge=entities.get(edgeId);
      if(!edge||edge.type!=='IFCEDGECURVE') return null;
      const a=refOf(edge.args[0]),b=refOf(edge.args[1]);
      if(!a||!b||entities.get(a)?.type!=='IFCVERTEXPOINT'||entities.get(b)?.type!=='IFCVERTEXPOINT') return null;
      const forward=/\.T\./i.test(String(oriented.args[3]||''));
      const start=forward?a:b,end=forward?b:a;
      const pts=edgeCurvePoints(edgeId);
      let extent=0;
      for(let i=1;i<pts.length;i++) extent+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y,pts[i].z-pts[i-1].z);
      if(!(extent>1e-9)) return null;
      return {orientedId,edgeId,start,end,forward};
    };
    const edgeLoopTopology=loopId=>{
      const loop=entities.get(loopId);
      if(!loop||loop.type!=='IFCEDGELOOP') return {ok:false,reason:'advanced-brep-loop-not-edge-loop',edges:[]};
      const orientedIds=refsIn(loop.args[0]);
      if(!orientedIds.length||new Set(orientedIds).size!==orientedIds.length) return {ok:false,reason:'advanced-brep-loop-duplicate-oriented-edge',edges:[]};
      const edges=orientedIds.map(orientedEdgeTopology);
      if(edges.some(x=>!x)) return {ok:false,reason:'advanced-brep-loop-invalid-edge',edges:[]};
      for(let i=0;i<edges.length;i++){
        const cur=edges[i],next=edges[(i+1)%edges.length];
        if(cur.end!==next.start) return {ok:false,reason:'advanced-brep-loop-not-continuous',edges};
      }
      return {ok:true,reason:null,edges};
    };
    const advancedBrepTopology=id=>{
      const brep=entities.get(id);
      const shell=entities.get(refOf(brep?.args?.[0]));
      if(!brep||!['IFCADVANCEDBREP','IFCMANIFOLDSOLIDBREP'].includes(brep.type)||shell?.type!=='IFCCLOSEDSHELL'){
        return {ok:false,reason:'advanced-brep-shell-missing',faces:0,edges:0,vertices:0};
      }
      const faceIds=refsIn(shell.args[0]);
      if(!faceIds.length||new Set(faceIds).size!==faceIds.length) return {ok:false,reason:'advanced-brep-shell-duplicate-face',faces:faceIds.length,edges:0,vertices:0};
      const edgeUsage=new Map(),orientedSeen=new Set(),vertices=new Set(),adj=new Map(faceIds.map(x=>[x,new Set()]));
      for(const faceId of faceIds){
        const face=entities.get(faceId);
        if(!face||face.type!=='IFCADVANCEDFACE') return {ok:false,reason:'advanced-brep-shell-non-advanced-face',faces:faceIds.length,edges:edgeUsage.size,vertices:vertices.size};
        const bounds=refsIn(face.args[0]).map(x=>entities.get(x)).filter(Boolean);
        if(!bounds.length||bounds.filter(x=>x.type==='IFCFACEOUTERBOUND').length!==1) return {ok:false,reason:'advanced-brep-face-invalid-bounds',faces:faceIds.length,edges:edgeUsage.size,vertices:vertices.size};
        for(const bound of bounds){
          const loopId=refOf(bound.args[0]),loopCheck=edgeLoopTopology(loopId);
          if(!loopCheck.ok) return {ok:false,reason:loopCheck.reason,faces:faceIds.length,edges:edgeUsage.size,vertices:vertices.size};
          const boundOrientation=/\.T\./i.test(String(bound.args[1]||''));
          for(const info of loopCheck.edges){
            if(orientedSeen.has(info.orientedId)) return {ok:false,reason:'advanced-brep-shell-reused-oriented-edge',faces:faceIds.length,edges:edgeUsage.size,vertices:vertices.size};
            orientedSeen.add(info.orientedId);vertices.add(info.start);vertices.add(info.end);
            if(!edgeUsage.has(info.edgeId)) edgeUsage.set(info.edgeId,[]);
            edgeUsage.get(info.edgeId).push({faceId,forward:boundOrientation?info.forward:!info.forward});
          }
        }
      }
      for(const uses of edgeUsage.values()){
        if(uses.length!==2) return {ok:false,reason:'advanced-brep-shell-edge-use-count',faces:faceIds.length,edges:edgeUsage.size,vertices:vertices.size};
        if(uses[0].forward===uses[1].forward) return {ok:false,reason:'advanced-brep-shell-edge-orientation',faces:faceIds.length,edges:edgeUsage.size,vertices:vertices.size};
        if(uses[0].faceId!==uses[1].faceId){
          adj.get(uses[0].faceId)?.add(uses[1].faceId);
          adj.get(uses[1].faceId)?.add(uses[0].faceId);
        }
      }
      const visited=new Set(),stack=faceIds.length?[faceIds[0]]:[];
      while(stack.length){const x=stack.pop();if(visited.has(x))continue;visited.add(x);for(const y of adj.get(x)||[])if(!visited.has(y))stack.push(y);}
      if(faceIds.length>1&&visited.size!==faceIds.length) return {ok:false,reason:'advanced-brep-shell-disconnected',faces:faceIds.length,edges:edgeUsage.size,vertices:vertices.size};
      const chi=vertices.size-edgeUsage.size+faceIds.length,genus=(2-chi)/2;
      if(!Number.isFinite(genus)||genus<-1e-9||Math.abs(genus-Math.round(genus))>1e-9) return {ok:false,reason:'advanced-brep-shell-euler-invalid',faces:faceIds.length,edges:edgeUsage.size,vertices:vertices.size,euler:chi};
      return {ok:true,reason:null,faces:faceIds.length,edges:edgeUsage.size,vertices:vertices.size,euler:chi,genus:Math.round(genus)};
    };
    const advancedFaceLocalTriangles=new Map();
    const exactAdvancedBrepGeometryIds=new Set();
    const partialAdvancedBrepGeometryReasons=new Map();
    const advancedBrepGeometryInfo=new Map();
    const pointLineDistance3D=(p,o,d)=>{
      const k=norm(d,{x:1,y:0,z:0}),q=sub(p,o),proj=mul(k,q.x*k.x+q.y*k.y+q.z*k.z);
      const r=sub(q,proj);return Math.hypot(r.x,r.y,r.z);
    };
    const edgeGeometryConsistent=edgeId=>{
      const edge=entities.get(edgeId);
      if(!edge||edge.type!=='IFCEDGECURVE') return false;
      const start=vertexPoint(refOf(edge.args[0])),end=vertexPoint(refOf(edge.args[1])),geom=entities.get(refOf(edge.args[2]));
      if(!start||!end||!geom) return false;
      const scale=Math.max(1,Math.hypot(start.x-end.x,start.y-end.y,start.z-end.z));
      const tol=Math.max(1e-6,scale*1e-5);
      if(geom.type==='IFCLINE'){
        const origin=point(refOf(geom.args[0])),vec=entities.get(refOf(geom.args[1]));
        const dir=vec?.type==='IFCVECTOR'?direction(refOf(vec.args[0])):null;
        return !!dir&&pointLineDistance3D(start,origin,dir)<=tol&&pointLineDistance3D(end,origin,dir)<=tol;
      }
      const pts=curvePoints(geom.id);
      if(pts.length<2) return false;
      const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
      const direct=Math.max(d(start,pts[0]),d(end,pts[pts.length-1]));
      const reverse=Math.max(d(start,pts[pts.length-1]),d(end,pts[0]));
      if(start&&end&&d(start,end)<=tol&&d(pts[0],pts[pts.length-1])<=tol) return Math.min(d(start,pts[0]),d(start,pts[pts.length-1]))<=tol;
      return Math.min(direct,reverse)<=tol;
    };
    const advancedFaceGeometryConsistent=faceId=>{
      const face=entities.get(faceId);
      if(!face||face.type!=='IFCADVANCEDFACE') return {ok:false,reason:'advanced-brep-face-missing'};
      const bounds=refsIn(face.args[0]).map(x=>entities.get(x)).filter(Boolean);
      for(const bound of bounds){
        const check=edgeLoopTopology(refOf(bound.args[0]));
        if(!check.ok) return {ok:false,reason:check.reason};
        for(const info of check.edges) if(!edgeGeometryConsistent(info.edgeId)) return {ok:false,reason:'advanced-brep-edge-geometry-endpoints'};
      }
      const surface=entities.get(refOf(face.args[1]));
      if(surface?.type==='IFCPLANE'){
        const plane=axis3(refOf(surface.args[0])),points=[];
        for(const bound of bounds) points.push(...loopPoints(refOf(bound.args[0])));
        const all=[...points];
        if(!all.length) return {ok:false,reason:'advanced-brep-face-empty-boundary'};
        const xs=all.map(p=>p.x),ys=all.map(p=>p.y),zs=all.map(p=>p.z);
        const diag=Math.max(1,Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),Math.max(...zs)-Math.min(...zs)));
        const tol=Math.max(1e-6,diag*1e-5);
        for(const p of all){
          const q=sub(p,plane.origin),dist=Math.abs(q.x*plane.z.x+q.y*plane.z.y+q.z*plane.z.z);
          if(dist>tol) return {ok:false,reason:'advanced-brep-face-off-surface'};
        }
      }
      return {ok:true,reason:null};
    };
    const faceTopologyVertices=faceId=>{
      const face=entities.get(faceId),out=new Set();
      if(!face)return out;
      for(const boundId of refsIn(face.args[0])){
        const bound=entities.get(boundId),check=edgeLoopTopology(refOf(bound?.args?.[0]));
        if(!check.ok)continue;
        for(const edge of check.edges){out.add(edge.start);out.add(edge.end);}
      }
      return out;
    };
    const triBox=tri=>({
      min:{x:Math.min(...tri.map(p=>p.x)),y:Math.min(...tri.map(p=>p.y)),z:Math.min(...tri.map(p=>p.z))},
      max:{x:Math.max(...tri.map(p=>p.x)),y:Math.max(...tri.map(p=>p.y)),z:Math.max(...tri.map(p=>p.z))}
    });
    const boxesOverlap=(a,b,eps=1e-8)=>!(a.max.x<b.min.x-eps||b.max.x<a.min.x-eps||a.max.y<b.min.y-eps||b.max.y<a.min.y-eps||a.max.z<b.min.z-eps||b.max.z<a.min.z-eps);
    const segmentTriangleProper=(p0,p1,tri)=>{
      const eps=1e-8,a=tri[0],b=tri[1],c=tri[2],dir=sub(p1,p0),e1=sub(b,a),e2=sub(c,a),h=cross(dir,e2);
      const det=e1.x*h.x+e1.y*h.y+e1.z*h.z;
      if(Math.abs(det)<=eps)return false;
      const inv=1/det,s=sub(p0,a),u=(s.x*h.x+s.y*h.y+s.z*h.z)*inv;
      if(u<=eps||u>=1-eps)return false;
      const q=cross(s,e1),v=(dir.x*q.x+dir.y*q.y+dir.z*q.z)*inv;
      if(v<=eps||u+v>=1-eps)return false;
      const t=(e2.x*q.x+e2.y*q.y+e2.z*q.z)*inv;
      return t>eps&&t<1-eps;
    };
    const trianglesProperlyIntersect=(a,b)=>{
      if(!boxesOverlap(triBox(a),triBox(b)))return false;
      for(let i=0;i<3;i++)if(segmentTriangleProper(a[i],a[(i+1)%3],b))return true;
      for(let i=0;i<3;i++)if(segmentTriangleProper(b[i],b[(i+1)%3],a))return true;
      return false;
    };
    const triangleNormal=tri=>cross(sub(tri[1],tri[0]),sub(tri[2],tri[0]));
    const dominantProjection=normal=>{
      const a=[Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)];
      const drop=a[0]>=a[1]&&a[0]>=a[2]?'x':a[1]>=a[2]?'y':'z';
      return p=>drop==='x'?{x:p.y,y:p.z}:drop==='y'?{x:p.x,y:p.z}:{x:p.x,y:p.y};
    };
    const orient2=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const pointInTriangle2DStrict=(p,t,eps=1e-9)=>{
      const o1=orient2(t[0],t[1],p),o2=orient2(t[1],t[2],p),o3=orient2(t[2],t[0],p);
      const hasPos=o1>eps||o2>eps||o3>eps,hasNeg=o1<-eps||o2<-eps||o3<-eps;
      return !(hasPos&&hasNeg)&&Math.abs(o1)>eps&&Math.abs(o2)>eps&&Math.abs(o3)>eps;
    };
    const segmentIntersect2DProper=(a,b,c,d,eps=1e-9)=>{
      const o1=orient2(a,b,c),o2=orient2(a,b,d),o3=orient2(c,d,a),o4=orient2(c,d,b);
      return ((o1>eps&&o2<-eps)||(o1<-eps&&o2>eps))&&((o3>eps&&o4<-eps)||(o3<-eps&&o4>eps));
    };
    const coplanarTrianglesOverlapArea=(a,b)=>{
      if(!boxesOverlap(triBox(a),triBox(b)))return false;
      const na=triangleNormal(a),nb=triangleNormal(b);
      const la=Math.hypot(na.x,na.y,na.z),lb=Math.hypot(nb.x,nb.y,nb.z);
      if(!(la>1e-12&&lb>1e-12))return false;
      const dot=(na.x*nb.x+na.y*nb.y+na.z*nb.z)/(la*lb);
      if(Math.abs(dot)<1-1e-7)return false;
      const scale=Math.max(1,...a.concat(b).map(p=>Math.hypot(p.x,p.y,p.z)));
      const planeTol=Math.max(1e-8,scale*1e-7);
      const n={x:na.x/la,y:na.y/la,z:na.z/la};
      if(b.some(p=>Math.abs((p.x-a[0].x)*n.x+(p.y-a[0].y)*n.y+(p.z-a[0].z)*n.z)>planeTol))return false;
      const project=dominantProjection(na),aa=a.map(project),bb=b.map(project);
      const ca={x:(aa[0].x+aa[1].x+aa[2].x)/3,y:(aa[0].y+aa[1].y+aa[2].y)/3};
      const cb={x:(bb[0].x+bb[1].x+bb[2].x)/3,y:(bb[0].y+bb[1].y+bb[2].y)/3};
      if(pointInTriangle2DStrict(ca,bb)||pointInTriangle2DStrict(cb,aa))return true;
      for(const p of aa)if(pointInTriangle2DStrict(p,bb))return true;
      for(const p of bb)if(pointInTriangle2DStrict(p,aa))return true;
      for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(segmentIntersect2DProper(aa[i],aa[(i+1)%3],bb[j],bb[(j+1)%3]))return true;
      return false;
    };
    const signedTriangleVolume=tri=>{
      const [a,b,c]=tri,bc=cross(b,c);
      return (a.x*bc.x+a.y*bc.y+a.z*bc.z)/6;
    };
    const advancedBrepGeometryConsistency=id=>{
      const brep=entities.get(id),shell=entities.get(refOf(brep?.args?.[0]));
      const faceIds=refsIn(shell?.args?.[0]||'');
      for(const faceId of faceIds){
        const check=advancedFaceGeometryConsistent(faceId);
        if(!check.ok)return {ok:false,reason:check.reason};
      }
      const verticesByFace=new Map(faceIds.map(id=>[id,faceTopologyVertices(id)]));
      const boxesByFace=new Map();
      for(const faceId of faceIds){
        const tris=advancedFaceLocalTriangles.get(faceId)||[];
        if(!tris.length)return {ok:false,reason:'advanced-brep-face-no-triangles'};
        const pts=tris.flat(),box=triBox(pts.length>=3?[pts[0],pts[1],pts[2]]:[{x:0,y:0,z:0},{x:0,y:0,z:0},{x:0,y:0,z:0}]);
        box.min={x:Math.min(...pts.map(p=>p.x)),y:Math.min(...pts.map(p=>p.y)),z:Math.min(...pts.map(p=>p.z))};
        box.max={x:Math.max(...pts.map(p=>p.x)),y:Math.max(...pts.map(p=>p.y)),z:Math.max(...pts.map(p=>p.z))};
        boxesByFace.set(faceId,box);
      }
      let checks=0;
      const budget=200000;
      for(let i=0;i<faceIds.length;i++)for(let j=i+1;j<faceIds.length;j++){
        const aId=faceIds[i],bId=faceIds[j];
        if(!boxesOverlap(boxesByFace.get(aId),boxesByFace.get(bId))) continue;
        for(const ta of advancedFaceLocalTriangles.get(aId)||[])for(const tb of advancedFaceLocalTriangles.get(bId)||[]){
          if(++checks>budget)return {ok:false,reason:'advanced-brep-geometry-validation-budget'};
          if(coplanarTrianglesOverlapArea(ta,tb))return {ok:false,reason:'advanced-brep-shell-coplanar-overlap'};
          if(trianglesProperlyIntersect(ta,tb))return {ok:false,reason:'advanced-brep-shell-self-intersection'};
        }
      }
      const allTriangles=faceIds.flatMap(faceId=>advancedFaceLocalTriangles.get(faceId)||[]);
      const points=allTriangles.flat();
      const xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z);
      const diag=Math.max(1e-9,Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),Math.max(...zs)-Math.min(...zs)));
      const signedVolume=allTriangles.reduce((sum,tri)=>sum+signedTriangleVolume(tri),0);
      const volume=Math.abs(signedVolume),volumeTol=Math.max(1e-12,diag*diag*diag*1e-9);
      if(!(volume>volumeTol))return {ok:false,reason:'advanced-brep-shell-zero-volume',intersectionChecks:checks,signedVolume,volume};
      return {ok:true,reason:null,intersectionChecks:checks,signedVolume,volume,winding:signedVolume>0?'positive':'negative'};
    };
    const exactSurfaceKinds=new Set();
    const partialSurfaceIds=new Set();
    const refRows=token=>{
      let s=String(token||'').trim();
      if(s.startsWith('(')&&s.endsWith(')')) s=s.slice(1,-1);
      return splitTopLevel(s).map(row=>refsIn(row)).filter(row=>row.length);
    };
    const numberRows=token=>{
      let s=String(token||'').trim();
      if(s.startsWith('(')&&s.endsWith(')')) s=s.slice(1,-1);
      return splitTopLevel(s).map(row=>numberList(row)).filter(row=>row.length);
    };
    const repeatedKnots=(multiplicities,knots)=>{
      if(!multiplicities.length||multiplicities.length!==knots.length) return [];
      const out=[];
      for(let i=0;i<knots.length;i++){
        const count=Math.max(0,Math.trunc(multiplicities[i]));
        for(let k=0;k<count;k++) out.push(knots[i]);
      }
      return out;
    };
    const basisVector=(degree,knots,count,u)=>{
      const n=count-1;
      if(degree<1||count<degree+1||knots.length!==count+degree+1) return null;
      let span;
      if(u>=knots[n+1]-1e-12) span=n;
      else if(u<=knots[degree]+1e-12) span=degree;
      else{
        let low=degree,high=n+1,mid=Math.floor((low+high)/2),guard=0;
        while((u<knots[mid]||u>=knots[mid+1])&&guard++<100){
          if(u<knots[mid])high=mid;else low=mid;
          mid=Math.floor((low+high)/2);
        }
        span=mid;
      }
      const local=new Array(degree+1).fill(0),left=new Array(degree+1),right=new Array(degree+1);
      local[0]=1;
      for(let j=1;j<=degree;j++){
        left[j]=u-knots[span+1-j]; right[j]=knots[span+j]-u;
        let saved=0;
        for(let r=0;r<j;r++){
          const denom=right[r+1]+left[j-r],temp=Math.abs(denom)<1e-14?0:local[r]/denom;
          local[r]=saved+right[r+1]*temp; saved=left[j-r]*temp;
        }
        local[j]=saved;
      }
      const full=new Array(count).fill(0);
      for(let j=0;j<=degree;j++) full[span-degree+j]=local[j];
      return full;
    };
    const bsplineSurfacePatch=surfaceId=>{
      const e=entities.get(surfaceId); if(!e||!['IFCBSPLINESURFACEWITHKNOTS','IFCRATIONALBSPLINESURFACEWITHKNOTS'].includes(e.type)) return null;
      const uDegree=Math.trunc(num(e.args[0])),vDegree=Math.trunc(num(e.args[1]));
      const rows=refRows(e.args[2]);
      if(rows.length<uDegree+1||!rows.length){partialSurfaceIds.add(surfaceId);return null;}
      const vCount=rows[0].length;
      if(vCount<vDegree+1||rows.some(row=>row.length!==vCount)){partialSurfaceIds.add(surfaceId);return null;}
      const controls=rows.map(row=>row.map(point));
      const uKnots=repeatedKnots(numberList(e.args[7]),numberList(e.args[9]));
      const vKnots=repeatedKnots(numberList(e.args[8]),numberList(e.args[10]));
      if(uKnots.length!==rows.length+uDegree+1||vKnots.length!==vCount+vDegree+1){partialSurfaceIds.add(surfaceId);return null;}
      const rational=e.type==='IFCRATIONALBSPLINESURFACEWITHKNOTS';
      const weights=rational?numberRows(e.args[12]):rows.map(row=>row.map(()=>1));
      if(weights.length!==rows.length||weights.some((row,i)=>row.length!==rows[i].length||row.some(w=>!Number.isFinite(w)||w<=0))){partialSurfaceIds.add(surfaceId);return null;}
      const uMin=uKnots[uDegree],uMax=uKnots[rows.length],vMin=vKnots[vDegree],vMax=vKnots[vCount];
      if(!(uMax-uMin>1e-12)||!(vMax-vMin>1e-12)){partialSurfaceIds.add(surfaceId);return null;}
      const spans=(knots,degree,count)=>{
        let n=0;for(let i=degree;i<count;i++)if(knots[i+1]-knots[i]>1e-12)n++;return n;
      };
      const uSamples=Math.max(6,Math.min(32,spans(uKnots,uDegree,rows.length)*8));
      const vSamples=Math.max(6,Math.min(32,spans(vKnots,vDegree,vCount)*8));
      const evaluate=(u,v)=>{
        const Nu=basisVector(uDegree,uKnots,rows.length,u),Nv=basisVector(vDegree,vKnots,vCount,v);
        if(!Nu||!Nv)return null;
        let x=0,y=0,z=0,w=0;
        for(let i=0;i<rows.length;i++)for(let j=0;j<vCount;j++){
          const b=Nu[i]*Nv[j]*weights[i][j],p=controls[i][j];x+=p.x*b;y+=p.y*b;z+=p.z*b;w+=b;
        }
        return Math.abs(w)<1e-14?null:{x:x/w,y:y/w,z:z/w};
      };
      const grid=[];
      for(let i=0;i<=uSamples;i++){
        const u=i===uSamples?uMax:uMin+(uMax-uMin)*(i/uSamples),row=[];
        for(let j=0;j<=vSamples;j++){
          const v=j===vSamples?vMax:vMin+(vMax-vMin)*(j/vSamples),p=evaluate(u,v);
          if(!p){partialSurfaceIds.add(surfaceId);return null;}
          row.push(p);
        }
        grid.push(row);
      }
      const triangles=[];
      for(let i=0;i<uSamples;i++)for(let j=0;j<vSamples;j++){
        const a=grid[i][j],b=grid[i+1][j],d=grid[i][j+1],cc=grid[i+1][j+1];
        triangles.push([a,b,cc],[a,cc,d]);
      }
      const perimeter=[
        ...grid[0],
        ...grid.slice(1,-1).map(row=>row[row.length-1]),
        ...[...grid[grid.length-1]].reverse(),
        ...grid.slice(1,-1).reverse().map(row=>row[0])
      ];
      exactSurfaceKinds.add(rational?'nurbs-surface':'bspline-surface');
      return {triangles,perimeter,grid,rational};
    };
    const pointSegmentDistance=(p,a,b)=>{
      const ab=sub(b,a),ap=sub(p,a),den=ab.x*ab.x+ab.y*ab.y+ab.z*ab.z;
      const t=den<1e-16?0:Math.max(0,Math.min(1,(ap.x*ab.x+ap.y*ab.y+ap.z*ab.z)/den));
      const q={x:a.x+ab.x*t,y:a.y+ab.y*t,z:a.z+ab.z*t};
      return Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z);
    };
    const distanceToLoop=(p,loop)=>{
      if(!loop?.length)return Infinity;
      let best=Infinity;
      for(let i=0;i<loop.length;i++)best=Math.min(best,pointSegmentDistance(p,loop[i],loop[(i+1)%loop.length]));
      return best;
    };
    const fullSurfaceBoundaryMatches=(outer,patch,toleranceRatio=0.02)=>{
      const pts=patch?.perimeter||[]; if(outer.length<3||pts.length<4)return false;
      const all=[...outer,...pts],xs=all.map(p=>p.x),ys=all.map(p=>p.y),zs=all.map(p=>p.z);
      const diag=Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),Math.max(...zs)-Math.min(...zs));
      const tol=Math.max(1e-5,diag*toleranceRatio);
      return outer.every(p=>distanceToLoop(p,pts)<=tol)&&pts.every(p=>distanceToLoop(p,outer)<=tol);
    };
    const circularAngleDistance=(a,b)=>{
      const tau=Math.PI*2;
      let d=Math.abs(a-b)%tau;
      return Math.min(d,tau-d);
    };
    const cylindricalBoundaryBand=(loopId,surfaceBasis,radius)=>{
      const loop=entities.get(loopId);
      if(!loop||loop.type!=='IFCEDGELOOP') return null;
      const orientedEdges=refsIn(loop.args[0]).map(id=>entities.get(id)).filter(e=>e?.type==='IFCORIENTEDEDGE');
      if(orientedEdges.length!==4) return null;
      const circles=[],lines=[];
      const tol=Math.max(1e-5,radius*1e-4);
      const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
      for(const oriented of orientedEdges){
        const edge=entities.get(refOf(oriented.args[2]));
        if(!edge||edge.type!=='IFCEDGECURVE') return null;
        const geom=entities.get(refOf(edge.args[2]));
        const start=vertexPoint(refOf(edge.args[0])),end=vertexPoint(refOf(edge.args[1]));
        if(!geom||!start||!end) return null;
        if(geom.type==='IFCCIRCLE'){
          if(dist(start,end)>tol) return null;
          const r=num(geom.args[1]),circleBasis=curveBasis(refOf(geom.args[0]));
          const centerLocal=localInBasis(surfaceBasis,circleBasis.origin);
          const axisDot=Math.abs(circleBasis.z.x*surfaceBasis.z.x+circleBasis.z.y*surfaceBasis.z.y+circleBasis.z.z*surfaceBasis.z.z);
          if(Math.abs(r-radius)>tol||Math.hypot(centerLocal.x,centerLocal.y)>tol||axisDot<0.9999) return null;
          circles.push({z:centerLocal.z});
        }else if(geom.type==='IFCLINE'){
          const a=localInBasis(surfaceBasis,start),b=localInBasis(surfaceBasis,end);
          if(Math.abs(Math.hypot(a.x,a.y)-radius)>tol||Math.abs(Math.hypot(b.x,b.y)-radius)>tol) return null;
          const angleA=Math.atan2(a.y,a.x),angleB=Math.atan2(b.y,b.x);
          if(circularAngleDistance(angleA,angleB)>0.01||Math.abs(a.z-b.z)<=tol) return null;
          lines.push({a,b,angle:(angleA+angleB)/2});
        }else return null;
      }
      if(circles.length!==2||lines.length!==2) return null;
      circles.sort((a,b)=>a.z-b.z);
      if(circles[1].z-circles[0].z<=tol) return null;
      const zMin=circles[0].z,zMax=circles[1].z,zTol=Math.max(tol,(zMax-zMin)*1e-4);
      for(const line of lines){
        const zs=[line.a.z,line.b.z].sort((a,b)=>a-b);
        if(Math.abs(zs[0]-zMin)>zTol||Math.abs(zs[1]-zMax)>zTol) return null;
      }
      if(circularAngleDistance(lines[0].angle,lines[1].angle)>0.01) return null;
      return {zMin,zMax};
    };
    const cylindricalSurfacePatch=(surfaceId,loopId,outer,holes=[])=>{
      const e=entities.get(surfaceId);
      if(!e||e.type!=='IFCCYLINDRICALSURFACE') return null;
      if(holes.length){partialSurfaceIds.add(surfaceId);return null;}
      const radius=num(e.args[1]),position=axis3(refOf(e.args[0]));
      if(!(radius>1e-9)){partialSurfaceIds.add(surfaceId);return null;}
      const local=(outer||[]).map(p=>localInBasis(position,p));
      if(local.length<8){partialSurfaceIds.add(surfaceId);return null;}
      const radialTol=Math.max(1e-5,radius*1e-4);
      if(local.some(p=>Math.abs(Math.hypot(p.x,p.y)-radius)>radialTol)){
        partialSurfaceIds.add(surfaceId);return null;
      }
      const band=cylindricalBoundaryBand(loopId,position,radius);
      if(!band){partialSurfaceIds.add(surfaceId);return null;}
      const {zMin,zMax}=band,height=zMax-zMin;
      const segments=48,triangles=[];
      for(let i=0;i<segments;i++){
        const a0=Math.PI*2*i/segments,a1=Math.PI*2*(i+1)/segments;
        const p00=applyBasis(position,{x:Math.cos(a0)*radius,y:Math.sin(a0)*radius,z:zMin});
        const p01=applyBasis(position,{x:Math.cos(a1)*radius,y:Math.sin(a1)*radius,z:zMin});
        const p10=applyBasis(position,{x:Math.cos(a0)*radius,y:Math.sin(a0)*radius,z:zMax});
        const p11=applyBasis(position,{x:Math.cos(a1)*radius,y:Math.sin(a1)*radius,z:zMax});
        triangles.push([p00,p01,p11],[p00,p11,p10]);
      }
      exactSurfaceKinds.add('cylindrical-surface');
      return {triangles,radius,height};
    };
    const planeAngleScaleToRadians=()=>{
      const scaleForUnit=unitId=>{
        const unit=entities.get(unitId); if(!unit) return null;
        if(unit.type==='IFCSIUNIT'&&/\.PLANEANGLEUNIT\./i.test(unit.raw)&&/\.RADIAN\./i.test(unit.raw)) return 1;
        if(unit.type!=='IFCCONVERSIONBASEDUNIT'||!/\.PLANEANGLEUNIT\./i.test(unit.raw)) return null;
        const factorId=refsIn(unit.raw).find(id=>entities.get(id)?.type==='IFCMEASUREWITHUNIT');
        const factor=entities.get(factorId); if(!factor) return null;
        const scale=num(factor.args[0]);
        const baseUnitId=refsIn(factor.raw).find(id=>entities.get(id)?.type==='IFCSIUNIT');
        const baseUnit=entities.get(baseUnitId);
        return scale>0&&baseUnit&&/\.PLANEANGLEUNIT\./i.test(baseUnit.raw)&&/\.RADIAN\./i.test(baseUnit.raw)?scale:null;
      };
      for(const assignment of entities.values()){
        if(assignment.type!=='IFCUNITASSIGNMENT') continue;
        for(const unitId of refsIn(assignment.args[0]||assignment.raw)){
          const scale=scaleForUnit(unitId);
          if(scale) return scale;
        }
      }
      const conversionCandidates=[...entities.values()].filter(unit=>unit.type==='IFCCONVERSIONBASEDUNIT'&&/\.PLANEANGLEUNIT\./i.test(unit.raw));
      for(const unit of conversionCandidates){
        const scale=scaleForUnit(unit.id);
        if(scale) return scale;
      }
      const siCandidates=[...entities.values()].filter(unit=>unit.type==='IFCSIUNIT'&&/\.PLANEANGLEUNIT\./i.test(unit.raw)&&/\.RADIAN\./i.test(unit.raw));
      return siCandidates.length===1?1:null;
    };
    const sweptCurveProfileEvaluator=profileId=>{
      const p=entities.get(profileId);
      if(!p||!/\.CURVE\./i.test(String(p.args[0]||''))) return null;
      if(p.type==='IFCCIRCLEPROFILEDEF'){
        const radius=num(p.args[p.args.length-1]);
        if(!(radius>1e-9)) return null;
        const posRef=p.args.map(refOf).find(x=>entities.get(x)?.type==='IFCAXIS2PLACEMENT2D');
        const a=axis2(posRef);
        const center={x:a.origin.x,y:a.origin.y,z:0};
        return {
          kind:'circle-profile',
          radius,
          center,
          evaluate:t=>({
            x:a.origin.x+a.x.x*Math.cos(t)*radius+a.y.x*Math.sin(t)*radius,
            y:a.origin.y+a.x.y*Math.cos(t)*radius+a.y.y*Math.sin(t)*radius,
            z:0
          })
        };
      }
      return null;
    };
    const pointLineDistance=(p,origin,axis)=>{
      const k=norm(axis,{x:0,y:0,z:1}),q=sub(p,origin),proj=mul(k,q.x*k.x+q.y*k.y+q.z*k.z);
      const d=sub(q,proj);
      return Math.hypot(d.x,d.y,d.z);
    };
    const rectangularPatchGrid=(evaluate,u1,u2,v1,v2,uSegments,vSegments)=>{
      const grid=[];
      for(let i=0;i<=uSegments;i++){
        const u=u1+(u2-u1)*(i/uSegments),row=[];
        for(let j=0;j<=vSegments;j++) row.push(evaluate(u,v1+(v2-v1)*(j/vSegments)));
        grid.push(row);
      }
      if(grid.some(row=>row.some(p=>!p||![p.x,p.y,p.z].every(Number.isFinite)))) return null;
      const triangles=[];
      for(let i=0;i<uSegments;i++)for(let j=0;j<vSegments;j++){
        const a=grid[i][j],b=grid[i+1][j],d=grid[i][j+1],c=grid[i+1][j+1];
        triangles.push([a,b,c],[a,c,d]);
      }
      const perimeter=[
        ...grid[0],
        ...grid.slice(1,-1).map(row=>row[row.length-1]),
        ...[...grid[grid.length-1]].reverse(),
        ...grid.slice(1,-1).reverse().map(row=>row[0])
      ];
      return {triangles,perimeter,grid};
    };
    const rectangularTrimmedAnalyticPatch=(surfaceId,outer,holes=[])=>{
      const e=entities.get(surfaceId);
      if(!e||e.type!=='IFCRECTANGULARTRIMMEDSURFACE'||holes.length) return null;
      const basisSurfaceId=refOf(e.args[0]),base=entities.get(basisSurfaceId);
      const supported=new Set([
        'IFCCYLINDRICALSURFACE','IFCSPHERICALSURFACE','IFCTOROIDALSURFACE',
        'IFCSURFACEOFLINEAREXTRUSION','IFCSURFACEOFREVOLUTION'
      ]);
      if(!base||!supported.has(base.type)){partialSurfaceIds.add(surfaceId);return null;}

      const angleScale=planeAngleScaleToRadians();
      if(!(angleScale>0)){partialSurfaceIds.add(surfaceId);return null;}

      let uAngular=true,vAngular=false,profile=null;
      if(base.type==='IFCSPHERICALSURFACE'||base.type==='IFCTOROIDALSURFACE') vAngular=true;
      if(base.type==='IFCSURFACEOFLINEAREXTRUSION'){
        profile=sweptCurveProfileEvaluator(refOf(base.args[0]));
        if(!profile){partialSurfaceIds.add(surfaceId);return null;}
      }
      if(base.type==='IFCSURFACEOFREVOLUTION'){
        profile=sweptCurveProfileEvaluator(refOf(base.args[0]));
        if(!profile){partialSurfaceIds.add(surfaceId);return null;}
        vAngular=true;
      }

      const u1=num(e.args[1])*(uAngular?angleScale:1),u2Raw=num(e.args[3])*(uAngular?angleScale:1);
      const v1=num(e.args[2])*(vAngular?angleScale:1),v2=num(e.args[4])*(vAngular?angleScale:1);
      const uSense=/\.T\./i.test(String(e.args[5]||'')),vSense=/\.T\./i.test(String(e.args[6]||''));
      const rawDu=u2Raw-u1,dv=v2-v1;
      if(Math.abs(rawDu)<=1e-9||Math.abs(dv)<=1e-9){partialSurfaceIds.add(surfaceId);return null;}

      let du=rawDu;
      if(uAngular){
        if(uSense&&du<0)du+=Math.PI*2;
        if(!uSense&&du>0)du-=Math.PI*2;
        if(Math.abs(du)>Math.PI*2+1e-6){partialSurfaceIds.add(surfaceId);return null;}
      }else if(uSense!==(du>0)){partialSurfaceIds.add(surfaceId);return null;}
      if(Math.abs(du)<=1e-9||vSense!==(dv>0)){partialSurfaceIds.add(surfaceId);return null;}

      const resolvedU2=u1+du;
      let uSegments=uAngular?angularSegments(du,4,96):8,vSegments=1,evaluate=null,kind=null,baseKind=null,meta={};

      if(base.type==='IFCCYLINDRICALSURFACE'){
        const radius=num(base.args[1]),position=axis3(refOf(base.args[0]));
        if(!(radius>1e-9)){partialSurfaceIds.add(surfaceId);return null;}
        evaluate=(u,v)=>applyBasis(position,{x:Math.cos(u)*radius,y:Math.sin(u)*radius,z:v});
        kind='rectangular-trimmed-cylinder';baseKind='cylindrical-surface';meta={radius,height:Math.abs(dv),sweepU:du};
      }else if(base.type==='IFCSPHERICALSURFACE'){
        const radius=num(base.args[1]),position=axis3(refOf(base.args[0]));
        const vMin=Math.min(v1,v2),vMax=Math.max(v1,v2);
        if(!(radius>1e-9)||vMin<-Math.PI/2-1e-7||vMax>Math.PI/2+1e-7){partialSurfaceIds.add(surfaceId);return null;}
        vSegments=angularSegments(dv,2,48);
        evaluate=(u,v)=>applyBasis(position,{x:Math.cos(v)*Math.cos(u)*radius,y:Math.cos(v)*Math.sin(u)*radius,z:Math.sin(v)*radius});
        kind='rectangular-trimmed-sphere';baseKind='spherical-surface';meta={radius,sweepU:du,sweepV:dv};
      }else if(base.type==='IFCTOROIDALSURFACE'){
        const majorRadius=num(base.args[1]),minorRadius=num(base.args[2]),position=axis3(refOf(base.args[0]));
        if(!(majorRadius>minorRadius&&minorRadius>1e-9)||Math.abs(dv)>Math.PI*2+1e-6){partialSurfaceIds.add(surfaceId);return null;}
        vSegments=angularSegments(dv,4,96);
        evaluate=(u,v)=>{
          const radial=majorRadius+minorRadius*Math.cos(v);
          return applyBasis(position,{x:radial*Math.cos(u),y:radial*Math.sin(u),z:minorRadius*Math.sin(v)});
        };
        kind='rectangular-trimmed-torus';baseKind='toroidal-surface';meta={majorRadius,minorRadius,sweepU:du,sweepV:dv};
      }else if(base.type==='IFCSURFACEOFLINEAREXTRUSION'){
        const position=base.args[1]&&base.args[1]!=='$'?axis3(refOf(base.args[1])):identityBasis();
        const dir=direction(refOf(base.args[2])),depth=num(base.args[3]);
        if(!(depth>1e-9)||Math.abs(dir.z)<1e-7){partialSurfaceIds.add(surfaceId);return null;}
        evaluate=(u,v)=>applyBasis(position,add(profile.evaluate(u),mul(dir,depth*v)));
        kind='rectangular-trimmed-linear-extrusion';baseKind='surface-of-linear-extrusion';
        meta={profileKind:profile.kind,depth,sweepU:du,sweepV:dv};
      }else{
        const position=base.args[1]&&base.args[1]!=='$'?axis3(refOf(base.args[1])):identityBasis();
        const axis=axis1(refOf(base.args[2]));
        const clearance=pointLineDistance(profile.center,axis.origin,axis.axis);
        if(!(clearance>profile.radius+Math.max(1e-7,profile.radius*1e-6))){partialSurfaceIds.add(surfaceId);return null;}
        vSegments=angularSegments(dv,4,96);
        evaluate=(u,v)=>applyBasis(position,rotateAroundAxis(profile.evaluate(v),axis.origin,axis.axis,u));
        kind='rectangular-trimmed-surface-of-revolution';baseKind='surface-of-revolution';
        meta={profileKind:profile.kind,profileRadius:profile.radius,axisClearance:clearance,sweepU:du,sweepV:dv};
      }

      const patch=rectangularPatchGrid(evaluate,u1,resolvedU2,v1,v2,uSegments,vSegments);
      if(!patch||!fullSurfaceBoundaryMatches(outer,patch,0.002)){partialSurfaceIds.add(surfaceId);return null;}
      exactSurfaceKinds.add(kind);
      exactSurfaceKinds.add(baseKind);
      return {...patch,...meta};
    };
    const partialAdvancedFaceIds=new Set();
    const exactAdvancedFaceIds=new Set();
    const advancedFaceTriangles=(faceId,basis)=>{
      const face=entities.get(faceId); if(!face||face.type!=='IFCADVANCEDFACE') return [];
      const surfaceId=refOf(face.args[1]),surface=entities.get(surfaceId);
      if(!surface){partialAdvancedFaceIds.add(faceId);return [];}
      const bounds=refsIn(face.args[0]).map(id=>entities.get(id)).filter(Boolean);
      const outerBound=bounds.find(b=>b.type==='IFCFACEOUTERBOUND')||bounds[0];
      if(!outerBound){partialAdvancedFaceIds.add(faceId);return [];}
      const outer=loopPoints(refOf(outerBound.args[0]));
      const holes=bounds.filter(b=>b!==outerBound).map(b=>loopPoints(refOf(b.args[0]))).filter(h=>h.length>=3);
      if(outer.length<3){partialAdvancedFaceIds.add(faceId);return [];}
      let tris=[];
      if(surface.type==='IFCPLANE'){
        tris=polygon3DWithVoids(outer,holes);
      }else if(['IFCBSPLINESURFACEWITHKNOTS','IFCRATIONALBSPLINESURFACEWITHKNOTS'].includes(surface.type)){
        const patch=bsplineSurfacePatch(surfaceId);
        if(!patch||holes.length||!fullSurfaceBoundaryMatches(outer,patch)){
          partialSurfaceIds.add(surfaceId);
          partialAdvancedFaceIds.add(faceId);
          return [];
        }
        tris=patch.triangles;
      }else if(surface.type==='IFCCYLINDRICALSURFACE'){
        const patch=cylindricalSurfacePatch(surfaceId,refOf(outerBound.args[0]),outer,holes);
        if(!patch){
          partialSurfaceIds.add(surfaceId);
          partialAdvancedFaceIds.add(faceId);
          return [];
        }
        tris=patch.triangles;
      }else if(surface.type==='IFCRECTANGULARTRIMMEDSURFACE'){
        const patch=rectangularTrimmedAnalyticPatch(surfaceId,outer,holes);
        if(!patch){
          partialSurfaceIds.add(surfaceId);
          partialAdvancedFaceIds.add(faceId);
          return [];
        }
        tris=patch.triangles;
      }else{
        partialAdvancedFaceIds.add(faceId);
        return [];
      }
      if(!tris.length){partialAdvancedFaceIds.add(faceId);return [];}
      const nonDegenerate=tris.filter(t=>{
        const n=cross(sub(t[1],t[0]),sub(t[2],t[0]));
        return Math.hypot(n.x,n.y,n.z)>1e-10;
      });
      if(nonDegenerate.length!==tris.length||!nonDegenerate.length){partialAdvancedFaceIds.add(faceId);return [];}
      tris=nonDegenerate;
      const sameSense=/\.T\./i.test(String(face.args[2]||''));
      const boundOrientation=/\.T\./i.test(String(outerBound.args[1]||''));
      if(!sameSense||!boundOrientation) tris=tris.map(t=>[t[0],t[2],t[1]]);
      advancedFaceLocalTriangles.set(faceId,tris.map(t=>t.map(p=>({...p}))));
      exactAdvancedFaceIds.add(faceId);
      return tris.map(tri=>tri.map(p=>applyBasis(basis,p)));
    };
    const advancedBrep=(id,basis)=>{
      const brep=entities.get(id);
      if(!brep||!['IFCADVANCEDBREP','IFCMANIFOLDSOLIDBREP'].includes(brep.type)) return [];
      const shell=entities.get(refOf(brep.args[0])); if(shell?.type!=='IFCCLOSEDSHELL') return [];
      const topology=advancedBrepTopology(id);
      if(topology.ok) exactAdvancedBrepTopologyIds.add(id);
      else partialAdvancedBrepTopologyReasons.set(id,topology.reason||'advanced-brep-shell-topology-invalid');
      const out=[];
      refsIn(shell.args[0]).forEach(faceId=>{
        const face=entities.get(faceId);
        if(face?.type==='IFCADVANCEDFACE') out.push(...advancedFaceTriangles(faceId,basis));
        else if(face?.type==='IFCFACE'){
          const bounds=refsIn(face.args[0]),outer=bounds.map(x=>entities.get(x)).find(x=>x?.type==='IFCFACEOUTERBOUND')||entities.get(bounds[0]);
          const loop=entities.get(refOf(outer?.args[0]));
          if(loop?.type==='IFCPOLYLOOP') polygon3D(refsIn(loop.args[0]).map(point)).forEach(tri=>out.push(tri.map(p=>applyBasis(basis,p))));
          else partialAdvancedFaceIds.add(faceId);
        }
      });
      if(topology.ok){
        const geometry=advancedBrepGeometryConsistency(id);
        advancedBrepGeometryInfo.set(id,geometry);
        if(geometry.ok) exactAdvancedBrepGeometryIds.add(id);
        else partialAdvancedBrepGeometryReasons.set(id,geometry.reason||'advanced-brep-geometry-invalid');
      }
      return out;
    };
    const partialFaceVoidIds=new Set();
    const exactFaceVoidIds=new Set();
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
          const face=entities.get(faceId); if(!face||!['IFCINDEXEDPOLYGONALFACE','IFCINDEXEDPOLYGONALFACEWITHVOIDS'].includes(face.type)) return;
          const outerIdx=[...String(face.args[0]||'').matchAll(/\d+/g)].map(m=>Number(m[0])-1);
          const outer=outerIdx.map(i=>pts[i]).filter(Boolean);
          if(face.type==='IFCINDEXEDPOLYGONALFACE'){
            polygon3D(outer).forEach(tri=>out.push(tri.map(p=>applyBasis(basis,p))));
            return;
          }
          const holes=[...String(face.args[1]||'').matchAll(/\((\s*\d+(?:\s*,\s*\d+)+\s*)\)/g)]
            .map(m=>m[1].split(',').map(v=>pts[Number(v.trim())-1]).filter(Boolean))
            .filter(loop=>loop.length>=3);
          const tris=polygon3DWithVoids(outer,holes);
          if(!tris.length){partialFaceVoidIds.add(faceId);return;}
          exactFaceVoidIds.add(faceId);
          tris.forEach(tri=>out.push(tri.map(p=>applyBasis(basis,p))));
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
    const geometryTypes=new Set(['IFCPRODUCTDEFINITIONSHAPE','IFCSHAPEREPRESENTATION','IFCREPRESENTATIONMAP','IFCEXTRUDEDAREASOLID','IFCREVOLVEDAREASOLID','IFCSWEPTDISKSOLID','IFCFACETEDBREP','IFCADVANCEDBREP','IFCMANIFOLDSOLIDBREP','IFCTRIANGULATEDFACESET','IFCPOLYGONALFACESET','IFCMAPPEDITEM','IFCBOOLEANCLIPPINGRESULT','IFCBOOLEANRESULT','IFCCSGSOLID','IFCBLOCK','IFCRIGHTCIRCULARCYLINDER','IFCRIGHTCIRCULARCONE','IFCRECTANGULARPYRAMID','IFCSPHERE']);
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
      const pts=curvePoints(id).map(p=>({x:p.x,y:p.y}));
      if(pts.length>2&&Math.hypot(pts[0].x-pts[pts.length-1].x,pts[0].y-pts[pts.length-1].y)<1e-9) pts.pop();
      return pts;
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
      if(e.type==='IFCREVOLVEDAREASOLID') return revolvedAreaSolid(id,basis);
      if(e.type==='IFCSWEPTDISKSOLID') return sweptDiskSolid(id,basis);
      if(['IFCBLOCK','IFCRIGHTCIRCULARCYLINDER','IFCRIGHTCIRCULARCONE','IFCRECTANGULARPYRAMID','IFCSPHERE'].includes(e.type)) return csgPrimitive(id,basis);
      if(e.type==='IFCFACETEDBREP') return facetedBrep(id,basis);
      if(e.type==='IFCADVANCEDBREP'||e.type==='IFCMANIFOLDSOLIDBREP') return advancedBrep(id,basis);
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
      if(e.type==='IFCPRODUCTDEFINITIONSHAPE'){
        const reps=refsIn(e.args[2]||e.raw).map(x=>entities.get(x)).filter(x=>x?.type==='IFCSHAPEREPRESENTATION');
        const body=reps.filter(r=>/^body$/i.test(unquote(r.args[1]||'')));
        const selected=body.length?body:reps;
        const out=[]; for(const rep of selected) out.push(...representation(rep.id,basis,depth+1)); return out;
      }
      if(e.type==='IFCSHAPEREPRESENTATION'||e.type==='IFCREPRESENTATIONMAP'){
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
    const authoritativeRepresentationRoots=shapeId=>{
      const shape=entities.get(shapeId);
      if(shape?.type!=='IFCPRODUCTDEFINITIONSHAPE') return shapeId?[shapeId]:[];
      const reps=refsIn(shape.args[2]||shape.raw).filter(id=>entities.get(id)?.type==='IFCSHAPEREPRESENTATION');
      const body=reps.filter(id=>/^body$/i.test(unquote(entities.get(id)?.args?.[1]||'')));
      return body.length?body:reps;
    };
    const descendantsFromRoots=(roots,target,maxDepth=10)=>{
      const out=[],seen=new Set();
      for(const root of roots||[]) for(const id of descendants(root,target,maxDepth)){
        if(!seen.has(id)){seen.add(id);out.push(id);}
      }
      return out;
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
      const reprRoots=authoritativeRepresentationRoots(reprId);
      const desc=target=>descendantsFromRoots(reprRoots,target);
      let tris=representation(reprId,localPlacement(placementId)); if(!tris.length) continue;
      const mapped=desc(new Set(['IFCMAPPEDITEM'])).length>0;
      const brep=desc(new Set(['IFCFACETEDBREP'])).length>0;
      const advancedBrepIds=desc(new Set(['IFCADVANCEDBREP','IFCMANIFOLDSOLIDBREP']));
      const advancedFaceIds=desc(new Set(['IFCADVANCEDFACE']));
      const advancedBrepVersionMismatch=advancedBrepIds.some(id=>entities.get(id)?.type==='IFCADVANCEDBREP')&&!schemaSupportsAdvancedBrep;
      const advancedBrepFacePartial=advancedFaceIds.some(id=>partialAdvancedFaceIds.has(id));
      const advancedBrepGeometryExact=advancedBrepIds.length>0&&!advancedBrepVersionMismatch&&!advancedBrepFacePartial&&advancedFaceIds.every(id=>exactAdvancedFaceIds.has(id));
      const advancedBrepTopologyPartial=advancedBrepIds.some(id=>!exactAdvancedBrepTopologyIds.has(id));
      const advancedBrepTopologyReason=advancedBrepIds.map(id=>partialAdvancedBrepTopologyReasons.get(id)).find(Boolean)||null;
      const advancedBrepGeometryPartial=advancedBrepIds.some(id=>exactAdvancedBrepTopologyIds.has(id)&&!exactAdvancedBrepGeometryIds.has(id));
      const advancedBrepGeometryReason=advancedBrepIds.map(id=>partialAdvancedBrepGeometryReasons.get(id)).find(Boolean)||null;
      const advancedBrepInfo=advancedBrepIds.map(id=>advancedBrepGeometryInfo.get(id)).find(Boolean)||null;
      const advancedBrepPartial=advancedBrepVersionMismatch||advancedBrepFacePartial||advancedBrepTopologyPartial||advancedBrepGeometryPartial;
      const advancedBrepExact=advancedBrepGeometryExact&&!advancedBrepTopologyPartial&&!advancedBrepGeometryPartial;
      const nurbsSurfaceIds=desc(new Set(['IFCBSPLINESURFACEWITHKNOTS','IFCRATIONALBSPLINESURFACEWITHKNOTS']));
      const cylindricalSurfaceIds=desc(new Set(['IFCCYLINDRICALSURFACE']));
      const sphericalSurfaceIds=desc(new Set(['IFCSPHERICALSURFACE']));
      const toroidalSurfaceIds=desc(new Set(['IFCTOROIDALSURFACE']));
      const sweptSurfaceIds=desc(new Set(['IFCSURFACEOFLINEAREXTRUSION','IFCSURFACEOFREVOLUTION']));
      const rectangularTrimmedSurfaceIds=desc(new Set(['IFCRECTANGULARTRIMMEDSURFACE']));
      const advancedSurfaceIds=[...nurbsSurfaceIds,...cylindricalSurfaceIds,...sphericalSurfaceIds,...toroidalSurfaceIds,...sweptSurfaceIds,...rectangularTrimmedSurfaceIds];
      const advancedCurved=advancedBrepGeometryExact&&advancedSurfaceIds.length>0&&!advancedSurfaceIds.some(id=>partialSurfaceIds.has(id));
      const advancedNurbs=advancedCurved&&nurbsSurfaceIds.length>0;
      const advancedCylinder=advancedCurved&&cylindricalSurfaceIds.length>0;
      const advancedSphere=advancedCurved&&sphericalSurfaceIds.length>0;
      const advancedTorus=advancedCurved&&toroidalSurfaceIds.length>0;
      const advancedSweptSurface=advancedCurved&&sweptSurfaceIds.length>0;
      const tess=desc(new Set(['IFCTRIANGULATEDFACESET','IFCPOLYGONALFACESET'])).length>0;
      const swept=desc(new Set(['IFCEXTRUDEDAREASOLID'])).length>0;
      const revolved=desc(new Set(['IFCREVOLVEDAREASOLID'])).length>0;
      const sweptDisk=desc(new Set(['IFCSWEPTDISKSOLID'])).length>0;
      const primitive=desc(new Set(['IFCBLOCK','IFCRIGHTCIRCULARCYLINDER','IFCRIGHTCIRCULARCONE','IFCRECTANGULARPYRAMID','IFCSPHERE'])).length>0;
      const booleanIds=desc(new Set(['IFCBOOLEANCLIPPINGRESULT','IFCBOOLEANRESULT','IFCCSGSOLID']));
      const boundedHalfSpaces=desc(new Set(['IFCPOLYGONALBOUNDEDHALFSPACE']));
      const faceVoidIds=desc(new Set(['IFCINDEXEDPOLYGONALFACEWITHVOIDS']));
      const faceVoidsPartial=faceVoidIds.some(id=>partialFaceVoidIds.has(id));
      const faceVoidsExact=faceVoidIds.length>0&&!faceVoidsPartial&&faceVoidIds.every(id=>exactFaceVoidIds.has(id));
      const curveIds=desc(new Set(['IFCINDEXEDPOLYCURVE','IFCCOMPOSITECURVE','IFCCOMPOSITECURVESEGMENT','IFCTRIMMEDCURVE','IFCCIRCLE','IFCELLIPSE','IFCBSPLINECURVEWITHKNOTS','IFCRATIONALBSPLINECURVEWITHKNOTS']));
      const curvePartial=curveIds.some(id=>partialCurveIds.has(id));
      const curveExact=curveIds.length>0&&!curvePartial;
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

      const partial=advancedBrepPartial||booleanPartial||faceVoidsPartial||curvePartial||(openings.length>0&&!openingExact);
      if(partial) partialElements++;
      if(mapped)geometryKinds.add('mapped-item');if(brep)geometryKinds.add('faceted-brep');if(advancedBrepGeometryExact&&!advancedCurved)geometryKinds.add('advanced-brep-planar');if(advancedNurbs)geometryKinds.add('advanced-brep-nurbs');if(advancedCylinder)geometryKinds.add('advanced-brep-cylinder');if(advancedSphere)geometryKinds.add('advanced-brep-sphere');if(advancedTorus)geometryKinds.add('advanced-brep-torus');if(advancedSweptSurface)geometryKinds.add('advanced-brep-swept-surface');if(tess)geometryKinds.add('tessellated-face-set');if(swept)geometryKinds.add('swept-solid');if(revolved)geometryKinds.add('revolved-area-solid');if(sweptDisk)geometryKinds.add('swept-disk-solid');if(primitive)geometryKinds.add('csg-primitive');if(booleanExact)geometryKinds.add('csg-exact');if(openingSubtractions)geometryKinds.add('opening-subtraction');if(faceVoidsExact)geometryKinds.add('polygon-face-voids');if(curveExact)geometryKinds.add('advanced-curves');
      const globalId=unquote(e.args[0]||('#'+e.id)),name=unquote(e.args[2]||'')||(e.type+' #'+e.id),storey=storeyByProduct.get(e.id)||null;
      const advancedKinds=advancedBrepGeometryExact
        ? (advancedCurved
          ? [advancedNurbs?'AdvancedBrepNURBS':null,advancedCylinder?'AdvancedBrepCylinder':null,advancedSphere?'AdvancedBrepSphere':null,advancedTorus?'AdvancedBrepTorus':null,advancedSweptSurface?'AdvancedBrepSweptSurface':null].filter(Boolean)
          : ['AdvancedBrep'])
        : [];
      const kinds=[mapped?'MappedItem':null,brep?'FacetedBrep':null,...advancedKinds,tess?'TessellatedFaceSet':null,swept?'SweptSolid':null,revolved?'RevolvedAreaSolid':null,sweptDisk?'SweptDiskSolid':null,primitive?'CSGPrimitive':null,booleanExact?'CSG':null,openingSubtractions?'Openings':null,faceVoidsExact?'FaceVoids':null,curveExact?'Curves':null].filter(Boolean);
      elements.push({
        id:'ifc_'+(globalId||e.id),name,floor:storey?.key||'all',discipline:disciplineForClass(e.type),category:e.type,color:colorForClass(e.type),rawTriangles:tris,
        importedProperties:{
          format:'IFC',ifcClass:e.type,globalId,stepId:e.id,storeyId:storey?.id||null,storeyName:storey?.name||null,storeyElevation:storey?.elevation??null,
          psets:psets.get(e.id)||{},geometryKinds:kinds,geometryQuality:partial?'partial':(kinds.join('+')||'supported'),
          openingCount:openings.length,openingSubtractions,booleanExact,
          advancedBrepTopology:advancedBrepIds.length?(advancedBrepTopologyPartial?'invalid':'edge-manifold'):null,
          advancedBrepTopologyReason,
          advancedBrepGeometry:advancedBrepIds.length?(advancedBrepGeometryPartial?'invalid':(!advancedBrepTopologyPartial?'consistent':null)):null,
          advancedBrepGeometryReason,
          advancedBrepVolume:advancedBrepInfo?.volume??null,
          advancedBrepSignedVolume:advancedBrepInfo?.signedVolume??null,
          advancedBrepWinding:advancedBrepInfo?.winding??null,
          partialReason:advancedBrepVersionMismatch?'advanced-brep-not-supported-in-schema':advancedBrepFacePartial?'advanced-brep-curved-surface-not-supported':advancedBrepTopologyPartial?(advancedBrepTopologyReason||'advanced-brep-shell-topology-invalid'):advancedBrepGeometryPartial?(advancedBrepGeometryReason||'advanced-brep-geometry-invalid'):booleanPartial?(boundedHalfSpaces.length?'polygonal-bounded-halfspace-curve-not-supported':'boolean-or-csg-operand-not-supported'):faceVoidsPartial?'polygon-face-voids-triangulation-failed':curvePartial?'curve-segment-not-supported':(openings.length&&!openingExact)?'opening-subtraction-failed':null,
          clashEligible:!partial
        }
      });
    }
    if(!elements.length) throw new Error('IFC válido, mas sem geometria compatível com SweptSolid, RevolvedAreaSolid, SweptDiskSolid, CSG primitives, MappedItem, Faceted/AdvancedBrep ou TessellatedFaceSet.');
    const si=[...entities.values()].find(e=>e.type==='IFCSIUNIT'&&/LENGTHUNIT/.test(e.raw));
    const sourceLengthUnit=si?(String(si.raw).match(/\.(MILLI|CENTI|DECI|KILO)?\.,\.METRE\./i)?.[1]||'METRE').toLowerCase():'unknown';
    return {elements,metadata:{schema,geometryKinds:Array.from(geometryKinds),curveKinds:Array.from(exactCurveKinds),surfaceKinds:Array.from(exactSurfaceKinds),storeys:Array.from(storeys.values()),partialElements,clashEligible:partialElements===0,sourceElementCount:elements.length,sourceLengthUnit,geometryQuality:partialElements?'partial':'supported',csgEngine:typeof BIMCSG!=='undefined'?'bsp':'unavailable'}};
  }
  return {parse};
})();

if (typeof window !== 'undefined') window.BIMIFCExtendedImporter = BIMIFCExtendedImporter;
