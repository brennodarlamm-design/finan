/**
 * FinGo BIM CSG
 * Booleanas determinísticas sobre malhas triangulares fechadas usando BSP.
 * Objetivo: subtração de openings/IfcBooleanResult suportados sem dependência externa.
 */
const BIMCSG = (() => {
  const EPSILON = 1e-5;
  const MAX_INPUT_TRIANGLES = 12000;
  const MAX_OUTPUT_TRIANGLES = 50000;

  class Vertex {
    constructor(pos) { this.pos = { x:Number(pos.x)||0, y:Number(pos.y)||0, z:Number(pos.z)||0 }; }
    clone() { return new Vertex(this.pos); }
    interpolate(other, t) {
      return new Vertex({
        x:this.pos.x + (other.pos.x-this.pos.x)*t,
        y:this.pos.y + (other.pos.y-this.pos.y)*t,
        z:this.pos.z + (other.pos.z-this.pos.z)*t
      });
    }
  }

  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const length=v=>Math.hypot(v.x,v.y,v.z);
  const normalize=v=>{const l=length(v)||1;return{x:v.x/l,y:v.y/l,z:v.z/l};};

  class Plane {
    constructor(normal, w) { this.normal=normal; this.w=w; }
    clone(){ return new Plane({...this.normal},this.w); }
    flip(){ this.normal.x*=-1;this.normal.y*=-1;this.normal.z*=-1;this.w*=-1; }
    static fromPoints(a,b,c){
      const n=normalize(cross(sub(b,a),sub(c,a)));
      return new Plane(n,dot(n,a));
    }
    splitPolygon(polygon,coplanarFront,coplanarBack,front,back){
      const COPLANAR=0,FRONT=1,BACK=2,SPANNING=3;
      let polygonType=0;
      const types=polygon.vertices.map(v=>{
        const t=dot(this.normal,v.pos)-this.w;
        const type=t < -EPSILON ? BACK : t > EPSILON ? FRONT : COPLANAR;
        polygonType|=type;
        return type;
      });
      if(polygonType===COPLANAR){
        (dot(this.normal,polygon.plane.normal)>0 ? coplanarFront : coplanarBack).push(polygon);
      } else if(polygonType===FRONT) front.push(polygon);
      else if(polygonType===BACK) back.push(polygon);
      else {
        const f=[],b=[];
        for(let i=0;i<polygon.vertices.length;i++){
          const j=(i+1)%polygon.vertices.length,ti=types[i],tj=types[j];
          const vi=polygon.vertices[i],vj=polygon.vertices[j];
          if(ti!==BACK) f.push(vi);
          if(ti!==FRONT) b.push(ti!==BACK ? vi.clone() : vi);
          if((ti|tj)===SPANNING){
            const denom=dot(this.normal,sub(vj.pos,vi.pos));
            if(Math.abs(denom)<EPSILON) continue;
            const t=(this.w-dot(this.normal,vi.pos))/denom;
            const v=vi.interpolate(vj,t);
            f.push(v); b.push(v.clone());
          }
        }
        if(f.length>=3) front.push(new Polygon(f));
        if(b.length>=3) back.push(new Polygon(b));
      }
    }
  }

  class Polygon {
    constructor(vertices){
      this.vertices=vertices;
      this.plane=Plane.fromPoints(vertices[0].pos,vertices[1].pos,vertices[2].pos);
    }
    clone(){ return new Polygon(this.vertices.map(v=>v.clone())); }
    flip(){ this.vertices.reverse().forEach(()=>{}); this.plane.flip(); }
  }

  class Node {
    constructor(polygons=[]){
      this.plane=null;this.front=null;this.back=null;this.polygons=[];
      if(polygons.length) this.build(polygons);
    }
    clone(){
      const node=new Node();
      node.plane=this.plane&&this.plane.clone();
      node.front=this.front&&this.front.clone();
      node.back=this.back&&this.back.clone();
      node.polygons=this.polygons.map(p=>p.clone());
      return node;
    }
    invert(){
      for(const p of this.polygons) p.flip();
      if(this.plane) this.plane.flip();
      if(this.front) this.front.invert();
      if(this.back) this.back.invert();
      [this.front,this.back]=[this.back,this.front];
    }
    clipPolygons(polygons){
      if(!this.plane) return polygons.slice();
      let front=[],back=[];
      for(const p of polygons) this.plane.splitPolygon(p,front,back,front,back);
      if(this.front) front=this.front.clipPolygons(front);
      if(this.back) back=this.back.clipPolygons(back); else back=[];
      return front.concat(back);
    }
    clipTo(node){
      this.polygons=node.clipPolygons(this.polygons);
      if(this.front) this.front.clipTo(node);
      if(this.back) this.back.clipTo(node);
    }
    allPolygons(){
      let polygons=this.polygons.slice();
      if(this.front) polygons=polygons.concat(this.front.allPolygons());
      if(this.back) polygons=polygons.concat(this.back.allPolygons());
      return polygons;
    }
    build(polygons){
      if(!polygons.length) return;
      if(!this.plane) this.plane=polygons[0].plane.clone();
      const front=[],back=[];
      for(const p of polygons) this.plane.splitPolygon(p,this.polygons,this.polygons,front,back);
      if(front.length){if(!this.front)this.front=new Node();this.front.build(front);}
      if(back.length){if(!this.back)this.back=new Node();this.back.build(back);}
    }
  }

  function area2(tri){
    const a=tri[0],b=tri[1],c=tri[2];
    return length(cross(sub(b,a),sub(c,a)));
  }

  function toPolygons(triangles){
    return (triangles||[])
      .filter(t=>Array.isArray(t)&&t.length===3&&area2(t)>EPSILON)
      .map(t=>new Polygon(t.map(p=>new Vertex(p))));
  }

  function toTriangles(polygons){
    const out=[];
    for(const poly of polygons){
      const v=poly.vertices;
      for(let i=1;i<v.length-1;i++){
        const tri=[v[0].pos,v[i].pos,v[i+1].pos].map(p=>({x:p.x,y:p.y,z:p.z}));
        if(area2(tri)>EPSILON) out.push(tri);
        if(out.length>MAX_OUTPUT_TRIANGLES) throw new Error('Resultado CSG excede o limite de triângulos.');
      }
    }
    return out;
  }

  function validateInputs(a,b){
    if(!Array.isArray(a)||!Array.isArray(b)||!a.length||!b.length) throw new Error('CSG requer duas malhas triangulares não vazias.');
    if(a.length+b.length>MAX_INPUT_TRIANGLES) throw new Error('CSG excede o orçamento de triângulos de entrada.');
  }

  function subtract(aTriangles,bTriangles){
    validateInputs(aTriangles,bTriangles);
    const a=new Node(toPolygons(aTriangles)),b=new Node(toPolygons(bTriangles));
    a.invert();
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    a.invert();
    return toTriangles(a.allPolygons());
  }

  function union(aTriangles,bTriangles){
    validateInputs(aTriangles,bTriangles);
    const a=new Node(toPolygons(aTriangles)),b=new Node(toPolygons(bTriangles));
    a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert(); a.build(b.allPolygons());
    return toTriangles(a.allPolygons());
  }

  function intersect(aTriangles,bTriangles){
    validateInputs(aTriangles,bTriangles);
    const a=new Node(toPolygons(aTriangles)),b=new Node(toPolygons(bTriangles));
    a.invert(); b.clipTo(a); b.invert(); a.clipTo(b); b.clipTo(a); a.build(b.allPolygons()); a.invert();
    return toTriangles(a.allPolygons());
  }

  function booleanOperation(operator,a,b){
    const op=String(operator||'').replace(/\./g,'').toUpperCase();
    if(op==='DIFFERENCE') return subtract(a,b);
    if(op==='UNION') return union(a,b);
    if(op==='INTERSECTION') return intersect(a,b);
    throw new Error('Operador CSG IFC não suportado: '+operator);
  }

  return {subtract,union,intersect,booleanOperation,MAX_INPUT_TRIANGLES,MAX_OUTPUT_TRIANGLES};
})();

if(typeof window!=='undefined') window.BIMCSG=BIMCSG;
