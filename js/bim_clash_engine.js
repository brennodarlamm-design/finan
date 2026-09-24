/**
 * FinGo BIM Clash Engine
 * Interferência geométrica confirmada por interseção triângulo-triângulo.
 * Usa BVH AABB para broad phase; contatos coplanares/por borda não são tratados como clash.
 */
const BIMClashEngine = (() => {
  const EPS = 1e-6;
  const CONTACT_EPS = 1e-4;

  function triBounds(tri) {
    const xs=tri.map(p=>p.x), ys=tri.map(p=>p.y), zs=tri.map(p=>p.z);
    return {
      minX:Math.min(...xs),maxX:Math.max(...xs),
      minY:Math.min(...ys),maxY:Math.max(...ys),
      minZ:Math.min(...zs),maxZ:Math.max(...zs)
    };
  }

  function mergeBounds(items) {
    const b={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
    for(const x of items){
      b.minX=Math.min(b.minX,x.minX); b.maxX=Math.max(b.maxX,x.maxX);
      b.minY=Math.min(b.minY,x.minY); b.maxY=Math.max(b.maxY,x.maxY);
      b.minZ=Math.min(b.minZ,x.minZ); b.maxZ=Math.max(b.maxZ,x.maxZ);
    }
    if(!Number.isFinite(b.minX)) return {minX:0,maxX:0,minY:0,maxY:0,minZ:0,maxZ:0};
    return b;
  }

  function overlaps(a,b,tol=0) {
    return a.maxX > b.minX + tol && b.maxX > a.minX + tol &&
      a.maxY > b.minY + tol && b.maxY > a.minY + tol &&
      a.maxZ > b.minZ + tol && b.maxZ > a.minZ + tol;
  }

  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
  const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});

  function segmentTriangle(p0,p1,tri) {
    const dir=sub(p1,p0), edge1=sub(tri[1],tri[0]), edge2=sub(tri[2],tri[0]);
    const h=cross(dir,edge2), det=dot(edge1,h);
    if(Math.abs(det)<EPS) return null;
    const inv=1/det, s=sub(p0,tri[0]), u=inv*dot(s,h);
    if(u<=CONTACT_EPS || u>=1-CONTACT_EPS) return null;
    const q=cross(s,edge1), v=inv*dot(dir,q);
    if(v<=CONTACT_EPS || u+v>=1-CONTACT_EPS) return null;
    const t=inv*dot(edge2,q);
    if(t<=CONTACT_EPS || t>=1-CONTACT_EPS) return null;
    return add(p0,mul(dir,t));
  }

  function triangleIntersection(a,b) {
    if(!overlaps(triBounds(a),triBounds(b),0)) return null;
    const edges=[[0,1],[1,2],[2,0]];
    for(const [i,j] of edges){
      const hit=segmentTriangle(a[i],a[j],b);
      if(hit) return hit;
    }
    for(const [i,j] of edges){
      const hit=segmentTriangle(b[i],b[j],a);
      if(hit) return hit;
    }
    return null;
  }

  function triangleRecords(element) {
    const records=[];
    for(const mesh of element.meshes||[]){
      if(mesh.type!=='triangles'||!Array.isArray(mesh.triangles)) continue;
      for(const tri of mesh.triangles){
        if(Array.isArray(tri)&&tri.length===3 && tri.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))) {
          records.push({tri,bounds:triBounds(tri)});
        }
      }
    }
    return records;
  }

  function centroid(rec,axis) {
    const keyMin='min'+axis, keyMax='max'+axis;
    return (rec.bounds[keyMin]+rec.bounds[keyMax])/2;
  }

  function buildBVH(records,depth=0) {
    const bounds=mergeBounds(records.map(r=>r.bounds));
    if(records.length<=12 || depth>=24) return {bounds,records,left:null,right:null};
    const spans={X:bounds.maxX-bounds.minX,Y:bounds.maxY-bounds.minY,Z:bounds.maxZ-bounds.minZ};
    const axis=Object.entries(spans).sort((a,b)=>b[1]-a[1])[0][0];
    const sorted=[...records].sort((a,b)=>centroid(a,axis)-centroid(b,axis));
    const mid=Math.floor(sorted.length/2);
    if(mid<=0||mid>=sorted.length) return {bounds,records,left:null,right:null};
    return {bounds,records:null,left:buildBVH(sorted.slice(0,mid),depth+1),right:buildBVH(sorted.slice(mid),depth+1)};
  }

  function firstIntersection(a,b,state) {
    if(!a||!b||!overlaps(a.bounds,b.bounds,0)) return null;
    if(state.comparisons>=state.maxComparisons){state.truncated=true;return null;}
    if(a.records&&b.records){
      for(const ta of a.records){
        for(const tb of b.records){
          if(state.comparisons++>=state.maxComparisons){state.truncated=true;return null;}
          if(!overlaps(ta.bounds,tb.bounds,0)) continue;
          const point=triangleIntersection(ta.tri,tb.tri);
          if(point) return point;
        }
      }
      return null;
    }
    const pairs=[];
    if(a.records) {
      if (b.left) pairs.push([a,b.left]);
      if (b.right) pairs.push([a,b.right]);
    } else if(b.records) {
      if (a.left) pairs.push([a.left,b]);
      if (a.right) pairs.push([a.right,b]);
    } else {
      if (a.left && b.left) pairs.push([a.left,b.left]);
      if (a.left && b.right) pairs.push([a.left,b.right]);
      if (a.right && b.left) pairs.push([a.right,b.left]);
      if (a.right && b.right) pairs.push([a.right,b.right]);
    }
    pairs.sort((p,q)=>{
      const volume=x=>Math.max(0,x.maxX-x.minX)*Math.max(0,x.maxY-x.minY)*Math.max(0,x.maxZ-x.minZ);
      const ix=(x,y)=>({
        minX:Math.max(x.minX,y.minX),maxX:Math.min(x.maxX,y.maxX),
        minY:Math.max(x.minY,y.minY),maxY:Math.min(x.maxY,y.maxY),
        minZ:Math.max(x.minZ,y.minZ),maxZ:Math.max(x.maxZ,y.maxZ)
      });
      return volume(ix(q[0].bounds,q[1].bounds))-volume(ix(p[0].bounds,p[1].bounds));
    });
    for(const [x,y] of pairs){
      if(!x||!y) continue;
      const hit=firstIntersection(x,y,state);
      if(hit) return hit;
      if(state.truncated) return null;
    }
    return null;
  }

  function elementBounds(element) {
    const list=[];
    for(const mesh of element.meshes||[]){
      if(mesh.type==='triangles'&&Array.isArray(mesh.triangles)) list.push(...mesh.triangles.map(triBounds));
    }
    return mergeBounds(list);
  }

  function eligible(element) {
    const props=element?.importedProperties;
    return Boolean(props && props.clashEligible!==false && (element.meshes||[]).some(m=>m.type==='triangles'&&m.triangles?.length));
  }

  function detect(elements,{maxClashes=50,maxComparisons=300000,interDisciplineOnly=true}={}) {
    const eligibleElements=(elements||[]).filter(eligible);
    const prepared=eligibleElements.map(element=>{
      const records=triangleRecords(element);
      return {element,bounds:elementBounds(element),bvh:buildBVH(records),triangles:records.length};
    });
    const state={comparisons:0,maxComparisons,truncated:false};
    const clashes=[];
    for(let i=0;i<prepared.length;i++){
      for(let j=i+1;j<prepared.length;j++){
        if(clashes.length>=maxClashes||state.truncated) break;
        const a=prepared[i],b=prepared[j];
        if(interDisciplineOnly && String(a.element.discipline||'')===String(b.element.discipline||'')) continue;
        if(!overlaps(a.bounds,b.bounds,0.05)) continue;
        const point=firstIntersection(a.bvh,b.bvh,state);
        if(point){
          clashes.push({
            id:'clash_'+(clashes.length+1),
            elementAId:a.element.id,
            elementBId:b.element.id,
            elementAName:a.element.name,
            elementBName:b.element.name,
            disciplineA:a.element.discipline||'geral',
            disciplineB:b.element.discipline||'geral',
            point,
            method:'triangle-bvh',
            confirmed:true
          });
        }
      }
      if(clashes.length>=maxClashes||state.truncated) break;
    }
    return {
      clashes,
      comparisons:state.comparisons,
      truncated:state.truncated,
      eligibleElements:eligibleElements.length,
      method:'triangle-bvh'
    };
  }

  return {detect,triangleIntersection,MAX_DEFAULT_COMPARISONS:300000};
})();

if(typeof window!=='undefined') window.BIMClashEngine=BIMClashEngine;
