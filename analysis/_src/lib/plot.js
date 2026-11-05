/* ===== 描画（canvas）：平面図 Plot2D と 曲面 Surface3D ===== */
const $=s=>document.querySelector(s);
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue("--"+n).trim()||"#888";
const REDRAW=new Set();
try{ matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>REDRAW.forEach(f=>f())); }catch(e){}
function hex2rgb(h){
  h=h.replace("#",""); if(h.length===3) h=h.split("").map(c=>c+c).join("");
  const n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255];
}
const rgba=(c,a)=>{ const [r,g,b]=hex2rgb(c); return `rgba(${r},${g},${b},${a})`; };
function cmap(t){ // 0..1 → [r,g,b]（テーマの s0→s3）
  const cs=[cssv("s0"),cssv("s1"),cssv("s2"),cssv("s3")].map(hex2rgb);
  t=Math.max(0,Math.min(1,isFinite(t)?t:0))*3; const i=Math.min(2,Math.floor(t)), u=t-i;
  return [0,1,2].map(k=>cs[i][k]+(cs[i+1][k]-cs[i][k])*u);
}
function niceStep(range,target){
  const raw=range/target, p=Math.pow(10,Math.floor(Math.log10(raw))), m=raw/p;
  return (m<1.5?1:m<3.5?2:m<7.5?5:10)*p;
}
function fnum(x,dg=3){ // 表示用の数
  if(!isFinite(x)) return x>0?"∞":x<0?"−∞":"—";
  if(Math.abs(x)<1e-12) x=0;
  let s=Number.isInteger(x)?String(x):(+x.toFixed(dg)).toString();
  if(s==="-0") s="0";
  return s.replace("-","−");
}
function fitCanvas(cv){
  const dpr=Math.min(2.5,window.devicePixelRatio||1), w=cv.clientWidth||400, h=cv.clientHeight||400;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){ cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); }
  const ctx=cv.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); return {ctx,w,h,dpr};
}
const MATHFONT='"Times New Roman","STIX Two Text",Times,serif';

/* ---------- 平面 ---------- */
class Plot2D{
  constructor(cv,o={}){
    this.cv=cv; this.o=Object.assign({xmin:-3,xmax:3,ymin:-3,ymax:3,equal:true,grid:true,axes:true,xl:"x",yl:"y",ticks:true},o);
    this.handles=[]; this.onDraw=null; this.drag=null;
    const ro=new ResizeObserver(()=>this.draw()); ro.observe(cv);
    REDRAW.add(()=>this.draw());
    cv.addEventListener("pointerdown",e=>{
      const [px,py]=this.mouse(e); let best=null,bd=24;
      for(const h of this.handles){ const p=h.get(); const d=Math.hypot(this.X(p[0])-px,this.Y(p[1])-py); if(d<bd){bd=d;best=h;} }
      if(!best&&this.onClick){ this.onClick(this.toWorld(px,py)); return; }
      if(!best) return;
      this.drag=best; cv.setPointerCapture(e.pointerId); e.preventDefault(); this.move(e);
    });
    cv.addEventListener("pointermove",e=>{ if(this.drag) this.move(e); });
    const end=()=>{ if(this.drag&&this.drag.end) this.drag.end(); this.drag=null; };
    cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",end);
  }
  mouse(e){ const r=this.cv.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; }
  move(e){
    const [px,py]=this.mouse(e); let [x,y]=this.toWorld(px,py); const h=this.drag, s=h.snap||0;
    const o=this.v; x=Math.max(o.xmin,Math.min(o.xmax,x)); y=Math.max(o.ymin,Math.min(o.ymax,y));
    if(s){ x=Math.round(x/s)*s; y=Math.round(y/s)*s; x=+x.toFixed(6); y=+y.toFixed(6); }
    if(h.constrain) [x,y]=h.constrain([x,y]);
    h.set([x,y]); this.draw();
  }
  setView(o){ Object.assign(this.o,o); this.draw(); }
  view(){
    const {ctx,w,h}=fitCanvas(this.cv); this.ctx=ctx; this.w=w; this.h=h;
    let {xmin,xmax,ymin,ymax}=this.o;
    if(this.o.equal){
      const sx=w/(xmax-xmin), sy=h/(ymax-ymin);
      if(sx>sy){ const c=(xmin+xmax)/2, half=w/sy/2; xmin=c-half; xmax=c+half; }
      else { const c=(ymin+ymax)/2, half=h/sx/2; ymin=c-half; ymax=c+half; }
    }
    this.v={xmin,xmax,ymin,ymax}; this.sx=w/(xmax-xmin); this.sy=h/(ymax-ymin);
  }
  X(x){return (x-this.v.xmin)*this.sx;} Y(y){return this.h-(y-this.v.ymin)*this.sy;}
  toWorld(px,py){return [this.v.xmin+px/this.sx,this.v.ymin+(this.h-py)/this.sy];}
  addHandle(h){ this.handles.push(h); return h; }
  draw(){
    if(!this.cv.isConnected) return;
    this.view(); const c=this.ctx; c.clearRect(0,0,this.w,this.h);
    c.fillStyle=cssv("card"); c.fillRect(0,0,this.w,this.h);
    if(this.onBack) this.onBack(this);
    if(this.o.grid) this.drawGrid();
    if(this.onDraw) this.onDraw(this);
    for(const h of this.handles){ if(h.hidden&&h.hidden()) continue; const p=h.get(); this.dot(p,h.color||cssv("c5"),{r:7,ring:true}); if(h.label) this.text(p,h.label,h.color||cssv("c5"),{dx:9,dy:-9,bold:true}); }
  }
  drawGrid(){
    const c=this.ctx, v=this.v, st=this.o.step||niceStep(Math.max(v.xmax-v.xmin,v.ymax-v.ymin),8);
    c.lineWidth=1; c.strokeStyle=cssv("grid"); c.beginPath();
    for(let x=Math.ceil(v.xmin/st)*st;x<=v.xmax;x+=st){ c.moveTo(this.X(x),0); c.lineTo(this.X(x),this.h); }
    for(let y=Math.ceil(v.ymin/st)*st;y<=v.ymax;y+=st){ c.moveTo(0,this.Y(y)); c.lineTo(this.w,this.Y(y)); }
    c.stroke();
    if(!this.o.axes) return;
    c.strokeStyle=cssv("axis"); c.lineWidth=1.4; c.beginPath();
    if(v.ymin<=0&&v.ymax>=0){ c.moveTo(0,this.Y(0)); c.lineTo(this.w,this.Y(0)); }
    if(v.xmin<=0&&v.xmax>=0){ c.moveTo(this.X(0),0); c.lineTo(this.X(0),this.h); }
    c.stroke();
    const ax=cssv("axis");
    const y0=Math.max(v.ymin,Math.min(v.ymax,0)), x0=Math.max(v.xmin,Math.min(v.xmax,0));
    this.text([v.xmax,y0],this.o.xl,ax,{dx:-12,dy:-6,size:15});
    this.text([x0,v.ymax],this.o.yl,ax,{dx:6,dy:16,size:15});
    if(this.o.ticks){
      const big=niceStep(Math.max(v.xmax-v.xmin,v.ymax-v.ymin),4);
      for(let x=Math.ceil(v.xmin/big)*big;x<v.xmax-big*0.3;x+=big){ if(Math.abs(x)<1e-9||this.X(x)<14) continue; this.text([x,y0],fnum(x),ax,{dy:14,size:11,italic:false,align:"center"}); }
      for(let y=Math.ceil(v.ymin/big)*big;y<v.ymax-big*0.3;y+=big){ if(Math.abs(y)<1e-9||this.Y(y)>this.h-8) continue; this.text([x0,y],fnum(y),ax,{dx:-4,dy:4,size:11,italic:false,align:"right"}); }
    }
  }
  /* 色の塗り分け（ヒートマップ）：f の値を [lo,hi] で色に */
  heat(f,lo,hi,o={}){
    const c=this.ctx, step=o.step||4, nx=Math.ceil(this.w/step), ny=Math.ceil(this.h/step);
    const off=document.createElement("canvas"); off.width=nx; off.height=ny;
    const oc=off.getContext("2d"), img=oc.createImageData(nx,ny), a=o.alpha==null?0.55:o.alpha;
    const bg=hex2rgb(cssv("card"));
    for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){
      const [x,y]=this.toWorld((i+0.5)*step,(j+0.5)*step); const z=f(x,y), k=(j*nx+i)*4;
      if(!isFinite(z)){ img.data[k+3]=0; continue; }
      const col=cmap((z-lo)/(hi-lo));
      for(let q=0;q<3;q++) img.data[k+q]=bg[q]*(1-a)+col[q]*a;
      img.data[k+3]=255;
    }
    oc.putImageData(img,0,0); c.imageSmoothingEnabled=true; c.drawImage(off,0,0,nx*step,ny*step);
  }
  /* 領域の塗りつぶし（pred(x,y) が真のところ） */
  region(pred,color,alpha=0.25,step=3){
    const c=this.ctx, nx=Math.ceil(this.w/step), ny=Math.ceil(this.h/step);
    const off=document.createElement("canvas"); off.width=nx; off.height=ny;
    const oc=off.getContext("2d"), img=oc.createImageData(nx,ny), col=hex2rgb(color);
    for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){
      const [x,y]=this.toWorld((i+0.5)*step,(j+0.5)*step);
      if(pred(x,y)){ const k=(j*nx+i)*4; img.data[k]=col[0]; img.data[k+1]=col[1]; img.data[k+2]=col[2]; img.data[k+3]=255*alpha; }
    }
    oc.putImageData(img,0,0); c.imageSmoothingEnabled=false; c.drawImage(off,0,0,nx*step,ny*step); c.imageSmoothingEnabled=true;
  }
  /* 等高線（marching squares） */
  contour(f,levels,color,o={}){
    const c=this.ctx, n=o.n||90, v=this.v, nx=n, ny=Math.round(n*this.h/this.w)||n;
    const dx=(v.xmax-v.xmin)/nx, dy=(v.ymax-v.ymin)/ny, Z=[];
    for(let j=0;j<=ny;j++){ const r=[]; for(let i=0;i<=nx;i++) r.push(f(v.xmin+i*dx,v.ymin+j*dy)); Z.push(r); }
    c.lineWidth=o.width||1.4; c.setLineDash(o.dash||[]);
    levels.forEach((L,li)=>{
      c.strokeStyle=typeof color==="function"?color(L,li):color; c.beginPath();
      for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){
        const z=[Z[j][i],Z[j][i+1],Z[j+1][i+1],Z[j+1][i]];
        if(z.some(t=>!isFinite(t))) continue;
        if(o.maxJump&&Math.max(...z)-Math.min(...z)>o.maxJump) continue;
        const px=[v.xmin+i*dx,v.xmin+(i+1)*dx,v.xmin+(i+1)*dx,v.xmin+i*dx], py=[v.ymin+j*dy,v.ymin+j*dy,v.ymin+(j+1)*dy,v.ymin+(j+1)*dy];
        const pts=[];
        for(let e=0;e<4;e++){ const a=e, b=(e+1)%4; const za=z[a]-L, zb=z[b]-L;
          if((za<0)!==(zb<0)){ const t=za/(za-zb); pts.push([px[a]+(px[b]-px[a])*t,py[a]+(py[b]-py[a])*t]); } }
        if(pts.length>=2){ c.moveTo(this.X(pts[0][0]),this.Y(pts[0][1])); c.lineTo(this.X(pts[1][0]),this.Y(pts[1][1])); }
        if(pts.length===4){ c.moveTo(this.X(pts[2][0]),this.Y(pts[2][1])); c.lineTo(this.X(pts[3][0]),this.Y(pts[3][1])); }
      }
      c.stroke();
    });
    c.setLineDash([]);
  }
  curve(fn,t0,t1,color,o={}){
    const c=this.ctx, n=o.n||300; c.strokeStyle=color; c.lineWidth=o.width||2.2; c.setLineDash(o.dash||[]); c.beginPath();
    let pen=false;
    for(let i=0;i<=n;i++){ const p=fn(t0+(t1-t0)*i/n);
      if(!p||!isFinite(p[0])||!isFinite(p[1])||Math.abs(p[1])>1e6){pen=false;continue;}
      const X=this.X(p[0]),Y=this.Y(p[1]); if(pen) c.lineTo(X,Y); else c.moveTo(X,Y); pen=true; }
    c.stroke(); c.setLineDash([]);
  }
  line(p,q,color,o={}){ const c=this.ctx; c.strokeStyle=color; c.lineWidth=o.width||2; c.setLineDash(o.dash||[]); c.globalAlpha=o.alpha==null?1:o.alpha; c.beginPath(); c.moveTo(this.X(p[0]),this.Y(p[1])); c.lineTo(this.X(q[0]),this.Y(q[1])); c.stroke(); c.setLineDash([]); c.globalAlpha=1; }
  infLine(p,d,color,o={}){ const L=Math.hypot(d[0],d[1]); if(L<1e-12) return; const t=4*Math.max(this.v.xmax-this.v.xmin,this.v.ymax-this.v.ymin)/L; this.line([p[0]-t*d[0],p[1]-t*d[1]],[p[0]+t*d[0],p[1]+t*d[1]],color,o); }
  arrow(p,q,color,o={}){
    const c=this.ctx, x1=this.X(p[0]),y1=this.Y(p[1]),x2=this.X(q[0]),y2=this.Y(q[1]), L=Math.hypot(x2-x1,y2-y1);
    c.strokeStyle=color; c.fillStyle=color; c.lineWidth=o.width||2.6; c.globalAlpha=o.alpha==null?1:o.alpha;
    if(L>1){
      const ux=(x2-x1)/L,uy=(y2-y1)/L,h=Math.min(o.head||12,L*0.6),w=h*0.45;
      c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2-ux*h*0.8,y2-uy*h*0.8); c.stroke();
      c.beginPath(); c.moveTo(x2,y2); c.lineTo(x2-ux*h-uy*w,y2-uy*h+ux*w); c.lineTo(x2-ux*h+uy*w,y2-uy*h-ux*w); c.closePath(); c.fill();
    }
    c.globalAlpha=1;
    if(o.label) this.text(q,o.label,color,{dx:o.ldx==null?6:o.ldx,dy:o.ldy==null?-6:o.ldy,bold:true});
  }
  dot(p,color,o={}){
    const c=this.ctx; c.beginPath(); c.arc(this.X(p[0]),this.Y(p[1]),o.r||4.5,0,7);
    if(o.ring){ c.fillStyle=cssv("card"); c.fill(); c.lineWidth=2.6; c.strokeStyle=color; c.stroke(); }
    else { c.fillStyle=color; c.fill(); }
    if(o.label) this.text(p,o.label,color,{dx:o.dx==null?7:o.dx,dy:o.dy==null?-7:o.dy,bold:o.bold});
  }
  poly(pts,color,o={}){
    const c=this.ctx; c.beginPath(); pts.forEach((p,i)=>i?c.lineTo(this.X(p[0]),this.Y(p[1])):c.moveTo(this.X(p[0]),this.Y(p[1]))); c.closePath();
    if(o.fill!==false){ c.fillStyle=rgba(color,o.alpha==null?0.2:o.alpha); c.fill(); }
    if(o.stroke){ c.strokeStyle=o.stroke; c.lineWidth=o.width||1.5; c.setLineDash(o.dash||[]); c.stroke(); c.setLineDash([]); }
  }
  text(p,s,color,o={}){
    const jp=/[\u3000-\u9fff\uff00-\uffef]/.test(s);
    const c=this.ctx; c.font=(o.italic===false||jp?"":"italic ")+(o.bold?"700 ":"")+(jp?(o.size||15)-2:(o.size||15))+"px "+(jp?cssv("textfont"):(o.font||MATHFONT));
    c.textAlign=o.align||"left"; c.textBaseline="alphabetic";
    const x=this.X(p[0])+(o.dx||0), y=this.Y(p[1])+(o.dy||0);
    c.lineJoin="round"; c.lineWidth=4; c.strokeStyle=cssv("card"); c.strokeText(s,x,y); c.fillStyle=color; c.fillText(s,x,y);
  }
}

/* ---------- 曲面 z = f(x, y) ---------- */
class Surface3D{
  constructor(cv,o={}){
    this.cv=cv; this.o=Object.assign({xr:[-2,2],yr:[-2,2],zr:null,n:34,az:-0.75,el:0.42,zs:0.8,clip:true,mesh:true,alpha:1,labels:["x","y","z"]},o);
    this.f=o.f||((x,y)=>0); this.extra=null; this.cache=null;
    const ro=new ResizeObserver(()=>this.draw()); ro.observe(cv);
    REDRAW.add(()=>this.draw());
    let last=null;
    cv.addEventListener("pointerdown",e=>{ last=[e.clientX,e.clientY]; cv.setPointerCapture(e.pointerId); e.preventDefault(); });
    cv.addEventListener("pointermove",e=>{ if(!last) return;
      const dx=e.clientX-last[0], dy=e.clientY-last[1]; last=[e.clientX,e.clientY];
      this.o.az-=dx*0.011; this.o.el=Math.max(-0.2,Math.min(1.55,this.o.el+dy*0.011)); this.draw(); });
    const end=()=>{last=null;}; cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",end);
  }
  set(o){ if(o.f) this.f=o.f; Object.assign(this.o,o); this.cache=null; this.draw(); }
  grid(){
    if(this.cache) return this.cache;
    const {xr,yr,n}=this.o, Z=[]; let lo=Infinity,hi=-Infinity;
    for(let j=0;j<=n;j++){ const r=[]; for(let i=0;i<=n;i++){ const x=xr[0]+(xr[1]-xr[0])*i/n, y=yr[0]+(yr[1]-yr[0])*j/n; let z=this.f(x,y); if(!isFinite(z)) z=NaN; r.push(z); if(isFinite(z)){lo=Math.min(lo,z);hi=Math.max(hi,z);} } Z.push(r); }
    if(!isFinite(lo)){lo=-1;hi=1;} if(hi-lo<1e-9){lo-=1;hi+=1;}
    const zr=this.o.zr||[lo,hi];
    return this.cache={Z,zr};
  }
  // 世界座標 → 画面座標と奥行き
  P(x,y,z){
    const {xr,yr,az,el,zs}=this.o, zr=this.zr;
    const X=(2*(x-xr[0])/(xr[1]-xr[0])-1), Y=(2*(y-yr[0])/(yr[1]-yr[0])-1), Z=(2*(z-zr[0])/(zr[1]-zr[0])-1)*zs;
    const ca=Math.cos(az), sa=Math.sin(az), x1=X*ca-Y*sa, y1=X*sa+Y*ca;
    const ce=Math.cos(el), se=Math.sin(el);
    const u=x1, v=Z*ce+y1*se, d=y1*ce-Z*se;
    return [this.cx+u*this.S, this.cy-v*this.S, d];
  }
  draw(){
    if(!this.cv.isConnected) return;
    const {ctx,w,h}=fitCanvas(this.cv); this.ctx=ctx; this.w=w; this.h=h;
    this.S=Math.min(w,h)*0.34; this.cx=w/2; this.cy=h/2+this.S*0.05;
    const {Z,zr}=this.grid(); this.zr=zr;
    const {xr,yr,n}=this.o; const prims=[];
    ctx.fillStyle=cssv("card"); ctx.fillRect(0,0,w,h);
    // 床と枠
    const fl=zr[0], axc=cssv("axis"), gc=cssv("grid");
    const corners=[[xr[0],yr[0]],[xr[1],yr[0]],[xr[1],yr[1]],[xr[0],yr[1]]];
    ctx.lineWidth=1;
    const st=niceStep(Math.max(xr[1]-xr[0],yr[1]-yr[0]),6);
    ctx.strokeStyle=gc; ctx.beginPath();
    for(let x=Math.ceil(xr[0]/st)*st;x<=xr[1]+1e-9;x+=st){ const a=this.P(x,yr[0],fl),b=this.P(x,yr[1],fl); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); }
    for(let y=Math.ceil(yr[0]/st)*st;y<=yr[1]+1e-9;y+=st){ const a=this.P(xr[0],y,fl),b=this.P(xr[1],y,fl); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); }
    ctx.stroke();
    ctx.strokeStyle=axc; ctx.beginPath(); corners.forEach((c,i)=>{ const p=this.P(c[0],c[1],fl); i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]); }); ctx.closePath(); ctx.stroke();
    if(this.o.floor) this.o.floor(this);
    // 縦の軸（最も奥の角）
    let far=0,fd=-Infinity; corners.forEach((c,i)=>{ const d=this.P(c[0],c[1],fl)[2]; if(d>fd){fd=d;far=i;} });
    const fc=corners[far], a=this.P(fc[0],fc[1],zr[0]), b=this.P(fc[0],fc[1],zr[1]);
    ctx.strokeStyle=axc; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
    // 曲面
    const L=[-0.35,-0.5,0.8], Ln=Math.hypot(...L);
    const dx=(xr[1]-xr[0])/n, dy=(yr[1]-yr[0])/n, zspan=zr[1]-zr[0];
    const sc=(this.o.zs*2/zspan);
    if(this.o.surface!==false) for(let j=0;j<n;j++) for(let i=0;i<n;i++){
      const z4=[Z[j][i],Z[j][i+1],Z[j+1][i+1],Z[j+1][i]];
      if(z4.some(z=>!isFinite(z))) continue;
      if(this.o.clip&&z4.some(z=>z<zr[0]-1e-9||z>zr[1]+1e-9)) continue;
      const x0=xr[0]+i*dx, y0=yr[0]+j*dy;
      const pts=[this.P(x0,y0,z4[0]),this.P(x0+dx,y0,z4[1]),this.P(x0+dx,y0+dy,z4[2]),this.P(x0,y0+dy,z4[3])];
      const zx=((z4[1]-z4[0])+(z4[2]-z4[3]))/2*sc/(2*dx/(xr[1]-xr[0])), zy=((z4[3]-z4[0])+(z4[2]-z4[1]))/2*sc/(2*dy/(yr[1]-yr[0]));
      const nl=Math.hypot(zx,zy,1), sh=Math.abs((-zx*L[0]-zy*L[1]+L[2])/(nl*Ln));
      const zm=(z4[0]+z4[1]+z4[2]+z4[3])/4, col=cmap((zm-zr[0])/zspan), k=0.55+0.45*sh;
      prims.push({d:(pts[0][2]+pts[1][2]+pts[2][2]+pts[3][2])/4,pts,fill:`rgba(${col[0]*k|0},${col[1]*k|0},${col[2]*k|0},${this.o.alpha})`,stroke:this.o.mesh?"rgba(0,0,0,0.13)":null});
    }
    const api={
      line:(p,q,color,o={})=>{ const A=this.P(...p),B=this.P(...q); prims.push({d:(A[2]+B[2])/2-(o.bias==null?0.04:o.bias),line:[A,B],color,width:o.width||2.5,dash:o.dash}); },
      path:(pts,color,o={})=>{ for(let i=0;i+1<pts.length;i++){ if(pts[i].some(t=>!isFinite(t))||pts[i+1].some(t=>!isFinite(t))) continue; api.line(pts[i],pts[i+1],color,o);} },
      dot:(p,color,o={})=>{ const A=this.P(...p); prims.push({d:A[2]-(o.bias==null?0.08:o.bias),dot:A,color,r:o.r||5,label:o.label}); },
      quad:(ps,color,alpha,o={})=>{ const pts=ps.map(p=>this.P(...p)); prims.push({d:pts.reduce((s,p)=>s+p[2],0)/pts.length-(o.bias||0),pts,fill:rgba(color,alpha),stroke:o.stroke||null}); },
      P:(x,y,z)=>this.P(x,y,z),
      // 4隅 c0..c3 の四角形を m×m に分割して置く（前後関係を正しくするため）
      sheet:(c,color,alpha,m=6,o={})=>{ const L=(p,q,t)=>p.map((v,i)=>v+(q[i]-v)*t);
        for(let i=0;i<m;i++) for(let j=0;j<m;j++){ const P=(u,v)=>L(L(c[0],c[1],u),L(c[3],c[2],u),v);
          api.quad([P(i/m,j/m),P((i+1)/m,j/m),P((i+1)/m,(j+1)/m),P(i/m,(j+1)/m)],color,alpha,o); } }
    };
    if(this.extra) this.extra(api,this);
    prims.sort((p,q)=>q.d-p.d);
    for(const p of prims){
      if(p.pts){ ctx.beginPath(); p.pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.closePath(); ctx.fillStyle=p.fill; ctx.fill(); if(p.stroke){ctx.strokeStyle=p.stroke; ctx.lineWidth=0.6; ctx.stroke();} else { ctx.strokeStyle=p.fill; ctx.lineWidth=0.5; ctx.stroke(); } }
      else if(p.line){ ctx.strokeStyle=p.color; ctx.lineWidth=p.width; ctx.setLineDash(p.dash||[]); ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(p.line[0][0],p.line[0][1]); ctx.lineTo(p.line[1][0],p.line[1][1]); ctx.stroke(); ctx.setLineDash([]); }
      else if(p.dot){ ctx.beginPath(); ctx.arc(p.dot[0],p.dot[1],p.r,0,7); ctx.fillStyle=p.color; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle=cssv("card"); ctx.stroke();
        if(p.label){ ctx.font="italic 700 14px "+MATHFONT; ctx.lineWidth=4; ctx.strokeText(p.label,p.dot[0]+8,p.dot[1]-8); ctx.fillStyle=p.color; ctx.fillText(p.label,p.dot[0]+8,p.dot[1]-8);} }
    }
    // 軸ラベル
    ctx.font="italic 15px "+MATHFONT; ctx.fillStyle=axc; ctx.textAlign="center";
    const lx=this.P((xr[0]+xr[1])/2,yr[0]-(yr[1]-yr[0])*0.12,fl), ly=this.P(xr[0]-(xr[1]-xr[0])*0.12,(yr[0]+yr[1])/2,fl), lz=this.P(fc[0],fc[1],zr[1]);
    ctx.fillText(this.o.labels[0],lx[0],lx[1]+5); ctx.fillText(this.o.labels[1],ly[0],ly[1]+5); ctx.fillText(this.o.labels[2],lz[0],lz[1]-8);
    ctx.font="11px "+MATHFONT; ctx.textAlign="left";
    for(const zv of [zr[0],zr[1]]){ const q=this.P(fc[0],fc[1],zv); ctx.fillText(fnum(zv,2),q[0]+6,q[1]+4); }
  }
}
/* 数値微分など */
const NUM={
  dx:(f,x,y,h=1e-5)=>(f(x+h,y)-f(x-h,y))/(2*h),
  dy:(f,x,y,h=1e-5)=>(f(x,y+h)-f(x,y-h))/(2*h),
  simpson(g,a,b,n=200){ if(n%2) n++; const h=(b-a)/n; let s=g(a)+g(b); for(let i=1;i<n;i++) s+=(i%2?4:2)*g(a+i*h); return s*h/3; },
  dbl(f,a,b,lo,hi,n=120){ // ∫_a^b ∫_{lo(x)}^{hi(x)} f dy dx
    return NUM.simpson(x=>{ const c=lo(x),d=hi(x); return d>c?NUM.simpson(y=>{const v=f(x,y); return isFinite(v)?v:0;},c,d,n):0; },a,b,n);
  }
};
/* 数式入力欄のヘルパー：入力 → {e, f} または null */
function exprField(inp,ps,onok){
  const msg=document.createElement("div"); msg.className="hint"; inp.insertAdjacentElement("afterend",msg);
  const run=()=>{
    const r=EX.tryParse(inp.value);
    if(r.ok){ const bad=EX.vars(r.e).filter(v=>!ps.includes(v)); if(bad.length){ r.ok=false; r.err="変数 "+bad.join(", ")+" は使えません（"+ps.join(", ")+" を使ってください）"; } }
    inp.classList.toggle("bad",!r.ok); msg.textContent=r.ok?"":r.err; msg.style.color=r.ok?"":"var(--bad)";
    if(r.ok) onok(r.e,EX.fn(r.e,ps));
  };
  inp.addEventListener("input",run); return run;
}
/* 等高線の線分（f = L となる所）を返す */
function isoSegs(f,xr,yr,n,L){
  const dx=(xr[1]-xr[0])/n, dy=(yr[1]-yr[0])/n, Z=[], segs=[];
  for(let j=0;j<=n;j++){ const r=[]; for(let i=0;i<=n;i++) r.push(f(xr[0]+i*dx,yr[0]+j*dy)); Z.push(r); }
  for(let j=0;j<n;j++) for(let i=0;i<n;i++){
    const z=[Z[j][i],Z[j][i+1],Z[j+1][i+1],Z[j+1][i]]; if(z.some(t=>!isFinite(t))) continue;
    const px=[xr[0]+i*dx,xr[0]+(i+1)*dx,xr[0]+(i+1)*dx,xr[0]+i*dx], py=[yr[0]+j*dy,yr[0]+j*dy,yr[0]+(j+1)*dy,yr[0]+(j+1)*dy], pts=[];
    for(let e=0;e<4;e++){ const a=e,b=(e+1)%4, za=z[a]-L, zb=z[b]-L; if((za<0)!==(zb<0)){ const t=za/(za-zb); pts.push([px[a]+(px[b]-px[a])*t,py[a]+(py[b]-py[a])*t]); } }
    if(pts.length>=2) segs.push([pts[0],pts[1]]); if(pts.length===4) segs.push([pts[2],pts[3]]);
  }
  return segs;
}
/* プリセット選択肢を select に入れる */
function fillSelect(sel,items){ sel.innerHTML=""; items.forEach((it,i)=>{ const o=document.createElement("option"); o.value=i; o.textContent=it; sel.appendChild(o); }); }
/* 係数つきの項の TeX：cx(2,"x")="2x", cx(-1,"x")="-x", cx(0.5,"x")="0.5x" */
function cx(c,v){ const s=fnum(c,3).replace("−","-"); return c===0?"0":c===1?v:c===-1?"-"+v:s+v; }
/* 一次式などの TeX を組み立てる
   sh("x",1)="x-1", sh("x",-2)="x+2", sh("x",0)="x"
   lc([[5,""],[2,"(x-1)"],[-4,"(y-2)"]])="5+2(x-1)-4(y-2)" */
const nstr=(v,dg=3)=>fnum(Math.abs(v),dg);
function sh(v,a,dg=3){ return Math.abs(a)<1e-12?v:a>0?v+"-"+nstr(a,dg):v+"+"+nstr(a,dg); }
function lc(terms,dg=3){
  let s="";
  for(const [c,t] of terms){
    if(Math.abs(c)<1e-12) continue;
    const mag=(t&&Math.abs(Math.abs(c)-1)<1e-12)?"":nstr(c,dg);
    const body=mag+(t||"");
    s+=s===""?(c<0?"-":"")+body:(c<0?"-":"+")+body;
  }
  return s===""?"0":s;
}
