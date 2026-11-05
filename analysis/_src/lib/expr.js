/* ===== 数式の構文解析・数値計算・記号微分 =====
   const e=EX.parse("x^2*y+sin(x y)")  … 構文木（エラー時は例外）
   EX.fn(e,["x","y"])                  … 数値関数 (x,y)=>…
   EX.d(e,"x")                         … 偏導関数（簡約済み）
   EX.tex(e)                           … 表示用 TeX 文字列（tex() で HTML に） */
const EX=(()=>{
"use strict";
const FNS={sin:1,cos:1,tan:1,exp:1,log:1,ln:1,sqrt:1,abs:1,arctan:1,atan:1,arcsin:1,asin:1,arccos:1,acos:1,sinh:1,cosh:1,tanh:1};
const ALIAS={ln:"log",atan:"arctan",asin:"arcsin",acos:"arccos"};
const N=v=>({t:"n",v}), V=n=>({t:"v",n});
const add=(...a)=>({t:"+",a}), mul=(...a)=>({t:"*",a}), pw=(b,e)=>({t:"^",b,e}), F=(f,x)=>({t:"f",f,x});
const neg=a=>mul(N(-1),a);

/* ---------- 字句解析・構文解析 ---------- */
function lex(s){
  s=s.replace(/[−ー－–]/g,"-").replace(/[×·・∗]/g,"*").replace(/÷|／/g,"/").replace(/＾/g,"^")
     .replace(/²/g,"^2").replace(/³/g,"^3").replace(/π/g,"pi").replace(/（/g,"(").replace(/）/g,")").replace(/\*\*/g,"^");
  const t=[]; let i=0;
  while(i<s.length){
    const c=s[i];
    if(/\s/.test(c)){i++;continue;}
    if(/[0-9.]/.test(c)){ let j=i; while(j<s.length&&/[0-9.]/.test(s[j])) j++; const v=parseFloat(s.slice(i,j)); if(isNaN(v)) throw new Error("数の書き方が正しくありません"); t.push({k:"n",v}); i=j; continue; }
    if(/[A-Za-z]/.test(c)){ let j=i; while(j<s.length&&/[A-Za-z]/.test(s[j])) j++; t.push({k:"id",v:s.slice(i,j)}); i=j; continue; }
    if("+-*/^(),|".includes(c)){ t.push({k:c}); i++; continue; }
    throw new Error("使えない文字があります：「"+c+"」");
  }
  // 識別子を 関数名 / pi / 1文字変数 に分解
  const out=[];
  for(const tok of t){
    if(tok.k!=="id"){out.push(tok);continue;}
    let w=tok.v;
    while(w.length){
      let hit=null;
      for(const f of Object.keys(FNS).sort((a,b)=>b.length-a.length)) if(w.startsWith(f)){hit=f;break;}
      if(hit){ out.push({k:"fn",v:ALIAS[hit]||hit}); w=w.slice(hit.length); continue; }
      if(w.startsWith("pi")){ out.push({k:"n",v:Math.PI,pi:true}); w=w.slice(2); continue; }
      out.push({k:"var",v:w[0]}); w=w.slice(1);
    }
  }
  return out;
}
function parse(src){
  const T=lex(String(src)); let p=0;
  if(!T.length) throw new Error("式が空です");
  const peek=()=>T[p], next=()=>T[p++];
  const expect=k=>{ if(!peek()||peek().k!==k) throw new Error("「"+k+"」が足りません"); next(); };
  function expr(){
    let a=term(); const terms=[a];
    while(peek()&&(peek().k==="+"||peek().k==="-")){ const op=next().k; const b=term(); terms.push(op==="-"?neg(b):b); }
    return terms.length===1?a:add(...terms);
  }
  const startsPrimary=tok=>tok&&(tok.k==="n"||tok.k==="var"||tok.k==="fn"||tok.k==="(");
  function term(){
    const fs=[unary()];
    for(;;){
      const tok=peek();
      if(tok&&tok.k==="*"){ next(); fs.push(unary()); }
      else if(tok&&tok.k==="/"){ next(); fs.push(pw(unary(),N(-1))); }
      else if(startsPrimary(tok)) fs.push(power());
      else break;
    }
    return fs.length===1?fs[0]:mul(...fs);
  }
  function unary(){
    const tok=peek();
    if(tok&&tok.k==="-"){ next(); return neg(unary()); }
    if(tok&&tok.k==="+"){ next(); return unary(); }
    return power();
  }
  function power(){
    const b=primary();
    if(peek()&&peek().k==="^"){ next(); const e=unary(); return pw(b,e); }
    return b;
  }
  function primary(){
    const tok=next();
    if(!tok) throw new Error("式が途中で終わっています");
    if(tok.k==="n") return tok.pi?{t:"n",v:Math.PI,pi:true}:N(tok.v);
    if(tok.k==="var"){
      if(tok.v==="e") return {t:"n",v:Math.E,e:true};
      return V(tok.v);
    }
    if(tok.k==="("){ const e=expr(); expect(")"); return e; }
    if(tok.k==="|"){ const e=expr(); expect("|"); return F("abs",e); }
    if(tok.k==="fn"){
      let ex=null;
      if(peek()&&peek().k==="^"){ next(); ex=unary(); }   // sin^2 x
      let arg;
      if(peek()&&peek().k==="("){ next(); arg=expr(); expect(")"); }
      else arg=power();
      let r=tok.v==="sqrt"?pw(arg,N(0.5)):F(tok.v,arg);
      return ex?pw(r,ex):r;
    }
    throw new Error("式の書き方が正しくありません");
  }
  const e=expr();
  if(p<T.length) throw new Error("式の書き方が正しくありません（"+(T[p].k==="fn"||T[p].k==="var"?T[p].v:T[p].k)+" の付近）");
  return fixE(e);
}
// e^u → exp(u)
function fixE(e){
  if(e.t==="^"&&e.b.t==="n"&&e.b.e) return F("exp",fixE(e.e));
  if(e.t==="^") return pw(fixE(e.b),fixE(e.e));
  if(e.t==="+"||e.t==="*") return {t:e.t,a:e.a.map(fixE)};
  if(e.t==="f") return F(e.f,fixE(e.x));
  return e;
}

/* ---------- 有理数近似 ---------- */
function frac(x){
  if(!isFinite(x)) return null;
  if(Number.isInteger(x)) return [x,1];
  for(let d=2;d<=720;d++){ const n=Math.round(x*d); if(Math.abs(n/d-x)<1e-10*Math.max(1,Math.abs(x))) return [n,d]; }
  return null;
}
const isN=(e,v)=>e.t==="n"&&(v===undefined||Math.abs(e.v-v)<1e-12);
const nice=x=>frac(x)!==null;

/* ---------- 文字列キー（同類項の判定用） ---------- */
function key(e){
  switch(e.t){
    case "n": return "#"+(+e.v.toPrecision(12));
    case "v": return e.n;
    case "+": return "("+e.a.map(key).join("+")+")";
    case "*": return "("+e.a.map(key).join("*")+")";
    case "^": return "("+key(e.b)+"^"+key(e.e)+")";
    case "f": return e.f+"("+key(e.x)+")";
  }
}
const dep=(e,v)=>e.t==="v"?e.n===v:e.t==="n"?false:e.t==="^"?dep(e.b,v)||dep(e.e,v):e.t==="f"?dep(e.x,v):e.a.some(x=>dep(x,v));

/* ---------- 簡約 ---------- */
function rank(e){ // 積の中の並び順
  if(e.t==="n") return 0;
  if(e.t==="v") return 1;
  if(e.t==="^"&&e.b.t==="v") return 1;
  if(e.t==="+"||(e.t==="^"&&e.b.t==="+")) return 2;
  if(e.t==="f"&&e.f==="exp") return 4;
  return 3;
}
const baseName=e=>e.t==="v"?e.n:e.t==="^"&&e.b.t==="v"?e.b.n:"~"+key(e);
function S(e){
  switch(e.t){
    case "n": case "v": return e;
    case "f":{
      const x=S(e.x);
      if(x.t==="n"){
        if(isN(x,0)&&["sin","tan","arctan","arcsin","sinh","tanh","abs"].includes(e.f)) return N(0);
        if(isN(x,0)&&(e.f==="cos"||e.f==="cosh"||e.f==="exp")) return N(1);
        if(isN(x,1)&&e.f==="log") return N(0);
        if(e.f==="abs") return N(Math.abs(x.v));
        if(e.f==="log"&&x.e) return N(1);
      }
      if(e.f==="log"&&x.t==="f"&&x.f==="exp") return x.x;
      if(e.f==="exp"&&x.t==="f"&&x.f==="log") return x.x;
      return F(e.f,x);
    }
    case "^":{
      const b=S(e.b), ex=S(e.e);
      if(isN(ex,0)) return N(1);
      if(isN(ex,1)) return b;
      if(b.t==="n"&&ex.t==="n"){ const r=Math.pow(b.v,ex.v); if(nice(r)&&!b.pi&&!b.e) return N(r); }
      if(isN(b,1)) return N(1);
      if(isN(b,0)&&ex.t==="n"&&ex.v>0) return N(0);
      if(b.t==="^"&&ex.t==="n"&&Number.isInteger(ex.v)) return S(pw(b.b,mul(b.e,ex)));
      if(b.t==="*"&&ex.t==="n"&&Number.isInteger(ex.v)) return S(mul(...b.a.map(f=>pw(f,ex))));
      if(b.t==="f"&&b.f==="exp") return S(F("exp",mul(b.x,ex)));
      if(b.t==="+"&&ex.t==="n"&&Number.isInteger(ex.v)){ // (y^2/x^2+1)^n → (y^2+x^2)^n x^{-2n}
        const tg=together(b);
        if(tg&&tg.numer.t!=="n") return S(mul(pw(tg.numer,ex),...tg.den.map(d=>pw(d,N(-ex.v)))));
      }
      return pw(b,ex);
    }
    case "*":{
      let c=1; const fs=[];
      const push=f=>{ if(f.t==="*") f.a.forEach(push); else if(f.t==="n"&&!f.pi&&!f.e) c*=f.v; else fs.push(f); };
      e.a.map(S).forEach(push);
      if(c===0) return N(0);
      // 同じ底をまとめる（指数を足す）
      const groups=new Map(); let expArg=[];
      for(const f of fs){
        if(f.t==="f"&&f.f==="exp"){ expArg.push(f.x); continue; }
        const b=f.t==="^"?f.b:f, ex=f.t==="^"?f.e:N(1), k=key(b);
        if(groups.has(k)) groups.get(k).e.push(ex); else groups.set(k,{b,e:[ex]});
      }
      let out=[];
      for(const {b,e:ex} of groups.values()){
        const ee=S(add(...ex)); const r=S(pw(b,ee));
        if(r.t==="n"&&!r.pi&&!r.e) c*=r.v; else if(r.t==="*"){ r.a.forEach(x=>{ if(x.t==="n"&&!x.pi&&!x.e) c*=x.v; else out.push(x); }); } else out.push(r);
      }
      if(expArg.length){ const ea=S(add(...expArg)); if(!isN(ea,0)) out.push(F("exp",ea)); }
      if(c===0) return N(0);
      const fk=f=>f.t==="f"?key(f.x)+"|"+f.f:f.t==="^"&&f.b.t==="f"?key(f.b.x)+"|"+f.b.f:"";
      out.sort((p,q)=>rank(p)-rank(q)||(rank(p)===1?baseName(p).localeCompare(baseName(q)):rank(p)===3?fk(p).localeCompare(fk(q)):0));
      if(!out.length) return N(c);
      if(c===1&&out.length===1) return out[0];
      return c===1?mul(...out):mul(N(c),...out);
    }
    case "+":{
      const terms=[];
      const push=t=>{ if(t.t==="+") t.a.forEach(push); else terms.push(t); };
      e.a.map(S).forEach(push);
      const m=new Map(); let c=0;
      for(const t of terms){
        if(t.t==="n"&&!t.pi&&!t.e){ c+=t.v; continue; }
        let co=1, rest=t;
        if(t.t==="*"&&t.a[0].t==="n"&&!t.a[0].pi&&!t.a[0].e){ co=t.a[0].v; rest=t.a.length===2?t.a[1]:mul(...t.a.slice(1)); }
        const k=key(rest);
        if(m.has(k)) m.get(k).co+=co; else m.set(k,{co,rest});
      }
      const out=[];
      for(const {co,rest} of m.values()){
        if(Math.abs(co)<1e-13) continue;
        out.push(co===1?rest:S(mul(N(co),rest)));
      }
      if(Math.abs(c)>1e-13) out.push(N(c));
      if(!out.length) return N(0);
      return out.length===1?out[0]:add(...out);
    }
  }
}

/* ---------- 微分 ---------- */
function D(e,v){
  if(!dep(e,v)) return N(0);
  switch(e.t){
    case "v": return N(1);
    case "+": return add(...e.a.map(x=>D(x,v)));
    case "*": return add(...e.a.map((x,i)=>mul(D(x,v),...e.a.filter((_,j)=>j!==i))));
    case "^":{
      const {b,e:ex}=e;
      if(!dep(ex,v)) return mul(ex,pw(b,add(ex,N(-1))),D(b,v));
      if(!dep(b,v)) return mul(e,F("log",b),D(ex,v));
      return mul(e,add(mul(D(ex,v),F("log",b)),mul(ex,D(b,v),pw(b,N(-1)))));
    }
    case "f":{
      const u=e.x, du=D(u,v); let g;
      switch(e.f){
        case "sin": g=F("cos",u); break;
        case "cos": g=neg(F("sin",u)); break;
        case "tan": g=pw(F("cos",u),N(-2)); break;
        case "exp": g=F("exp",u); break;
        case "log": g=pw(u,N(-1)); break;
        case "abs": g=mul(u,pw(F("abs",u),N(-1))); break;
        case "arctan": g=pw(add(N(1),pw(u,N(2))),N(-1)); break;
        case "arcsin": g=pw(add(N(1),neg(pw(u,N(2)))),N(-0.5)); break;
        case "arccos": g=neg(pw(add(N(1),neg(pw(u,N(2)))),N(-0.5))); break;
        case "sinh": g=F("cosh",u); break;
        case "cosh": g=F("sinh",u); break;
        case "tanh": g=pw(F("cosh",u),N(-2)); break;
      }
      return mul(g,du);
    }
  }
  return N(0);
}
const d=(e,v)=>S(D(e,v));

/* ---------- 展開・通分（表示用） ---------- */
function expand(e){
  if(e.t==="+") return S(add(...e.a.map(expand)));
  if(e.t==="^"&&e.b.t==="+"&&e.e.t==="n"&&Number.isInteger(e.e.v)&&e.e.v>1&&e.e.v<=6) return expand(mul(...Array(e.e.v).fill(e.b)));
  if(e.t==="*"){
    let terms=[N(1)];
    for(const f0 of e.a){ const f=expand(f0); const fs=f.t==="+"?f.a:[f]; const nt=[]; for(const t of terms) for(const g of fs) nt.push(S(mul(t,g))); terms=nt; if(terms.length>200) return e; }
    return S(add(...terms));
  }
  return e;
}
function together(e){
  if(e.t!=="+") return null;
  const parts=e.a.map(t=>{ const fs=t.t==="*"?t.a:[t], num=[], den=[];
    fs.forEach(f=>{ if(f.t==="^"&&f.e.t==="n"&&f.e.v<0) den.push({b:f.b,e:-f.e.v}); else num.push(f); }); return {num,den}; });
  if(!parts.some(p=>p.den.length)) return null;
  const L=new Map();
  parts.forEach(p=>p.den.forEach(d=>{ const k=key(d.b); if(!L.has(k)||L.get(k).e<d.e) L.set(k,{b:d.b,e:d.e}); }));
  const terms=[];
  for(const p of parts){
    const own=new Map(p.den.map(d=>[key(d.b),d.e])), extra=[];
    for(const [k,{b,e:ex}] of L){ const df=ex-(own.get(k)||0); if(Math.abs(df-Math.round(df))>1e-9) return null; if(df>0) extra.push(pw(b,N(Math.round(df)))); }
    terms.push(mul(...p.num,...extra));
  }
  let numer=expand(S(add(...terms)));
  if(isN(numer,0)) return N(0);
  const den=[...L.values()].map(({b,e:ex})=>S(pw(b,N(ex))));
  return {numer,den};
}
/* ---------- 数値関数へ ---------- */
const JSF={sin:"Math.sin",cos:"Math.cos",tan:"Math.tan",exp:"Math.exp",log:"Math.log",abs:"Math.abs",arctan:"Math.atan",arcsin:"Math.asin",arccos:"Math.acos",sinh:"Math.sinh",cosh:"Math.cosh",tanh:"Math.tanh"};
function js(e,ps){
  switch(e.t){
    case "n": return "("+e.v+")";
    case "v": if(!ps.includes(e.n)) throw new Error("変数 "+e.n+" は使えません（使える変数："+ps.join(", ")+"）"); return e.n;
    case "+": return "("+e.a.map(x=>js(x,ps)).join("+")+")";
    case "*": return "("+e.a.map(x=>js(x,ps)).join("*")+")";
    case "^":
      if(isN(e.e,2)){ const b=js(e.b,ps); return "(("+b+")*("+b+"))"; }
      if(isN(e.e,0.5)) return "Math.sqrt("+js(e.b,ps)+")";
      if(e.e.t==="n"&&Number.isInteger(e.e.v)) return "Math.pow("+js(e.b,ps)+","+e.e.v+")";
      if(e.e.t==="n"){ const fr=frac(e.e.v); if(fr&&fr[1]%2===1) return "__oddroot("+js(e.b,ps)+","+fr[0]+","+fr[1]+")"; }
      return "Math.pow("+js(e.b,ps)+","+js(e.e,ps)+")";
    case "f": return JSF[e.f]+"("+js(e.x,ps)+")";
  }
}
function fn(e,ps=["x","y"]){
  const body=js(e,ps);
  const f=new Function("__oddroot",...ps,"return "+body+";");
  const oddroot=(b,p,q)=>Math.sign(b)**p*Math.pow(Math.abs(b),p/q);
  return (...a)=>f(oddroot,...a);
}
const vars=e=>{ const s=new Set(); (function w(x){ if(x.t==="v") s.add(x.n); else if(x.t==="^"){w(x.b);w(x.e);} else if(x.t==="f") w(x.x); else if(x.a) x.a.forEach(w); })(e); return [...s].sort(); };

/* ---------- TeX 文字列へ ---------- */
function numTeX(v,inExp){
  if(Math.abs(v-Math.PI)<1e-12) return "\\pi";
  const fr=frac(v);
  if(fr){ const [n,dd]=fr; if(dd===1) return String(n); return (n<0?"-":"")+(inExp?Math.abs(n)+"/"+dd:"\\frac{"+Math.abs(n)+"}{"+dd+"}"); }
  return String(+v.toPrecision(5));
}
const coefOf=e=>e.t==="n"&&!e.pi&&!e.e?e.v:(e.t==="*"&&e.a[0].t==="n"&&!e.a[0].pi?e.a[0].v:1);
function negate(e){ // 先頭係数の符号を反転
  if(e.t==="n") return N(-e.v);
  if(e.t==="*"&&e.a[0].t==="n"){ const c=-e.a[0].v; const r=e.a.slice(1); return c===1?(r.length===1?r[0]:mul(...r)):mul(N(c),...r); }
  return neg(e);
}
function T(e,ctx){
  ctx=ctx||{};
  switch(e.t){
    case "n": return e.e?"e":numTeX(e.v,ctx.exp);
    case "v": return e.n;
    case "+":{
      // 分数の項があれば通分して1つの分数に
      if(!ctx.notog){
        const tg=together(e);
        if(tg&&tg.numer.t!=="n"||tg&&tg.numer.t==="n"){
          if(tg.numer.t==="n"&&tg.numer.v===0) return "0";
          let nu=tg.numer, g=1, sign=1;
          let ts=nu.t==="+"?nu.a.slice():[nu];
          const cs=ts.map(coefOf);
          if(cs.every(c=>Number.isInteger(c))){ g=cs.reduce((a,c)=>{a=Math.abs(a);c=Math.abs(c);while(c){[a,c]=[c,a%c];}return a;},0)||1; }
          if(cs.every(c=>c<0)) sign=-1;
          if(g!==1||sign<0) ts=ts.map(t=>S(mul(N(sign/g),t)));
          const fp=ts.findIndex(t=>coefOf(t)>0); if(fp>0) ts.unshift(ts.splice(fp,1)[0]);
          nu=ts.length===1?ts[0]:add(...ts);
          const nt=T(nu,{notog:true}), dt=T(mul(...tg.den),{notog:true});
          const numTxt=g>1?(nu.t==="+"?g+"("+nt+")":nt==="1"?String(g):g+nt):nt;
          return (sign<0?"-":"")+"\\frac{"+numTxt+"}{"+dt+"}";
        }
      }
      // 指数関数などの共通因数をくくり出して表示： 2xe^u + x^2e^u → (2x + x^2)e^u
      if(!ctx.nofac){
        const facs=t=>t.t==="*"?t.a:[t];
        const ok=f=>!(f.t==="n"||f.t==="v"||(f.t==="^"&&f.b.t==="v"&&f.e.t==="n"));
        let common=facs(e.a[0]).filter(ok);
        for(const t of e.a.slice(1)){ const ks=facs(t).map(key); common=common.filter(c=>ks.includes(key(c))); }
        if(common.length){
          const ck=common.map(key);
          const rest=e.a.map(t=>{ const left=[...ck]; const r=facs(t).filter(f=>{ const i=left.indexOf(key(f)); if(i>=0){left.splice(i,1); return false;} return true; }); return r.length?(r.length===1?r[0]:mul(...r)):N(1); });
          const rs=S(add(...rest));
          if(rs.t==="+") return T(mul(rs,...common),Object.assign({},ctx,{nofac:false}));
        }
      }
      let s="", terms=e.a.slice();
      const fp=terms.findIndex(t=>coefOf(t)>0); if(fp>0) terms.unshift(terms.splice(fp,1)[0]);
      terms.forEach((t,i)=>{
        if(i===0){ s+=T(t,ctx); return; }
        if(coefOf(t)<0) s+=" - "+T(negate(t),ctx); else s+=" + "+T(t,ctx);
      });
      return s;
    }
    case "*":{
      let c=1; const num=[], den=[];
      e.a.forEach(f=>{
        if(f.t==="n"&&!f.pi&&!f.e){ c*=f.v; return; }
        if(f.t==="^"&&f.e.t==="n"&&f.e.v<0) den.push(S(pw(f.b,N(-f.e.v))));
        else num.push(f);
      });
      let sign="";
      if(c<0){ sign="-"; c=-c; }
      const fr=frac(c);
      let cn=c, cd=1; if(fr){cn=fr[0];cd=fr[1];}
      const multi=num.length+(cn!==1?1:0)>1;
      const fac=(f)=>{
        const s=T(f,ctx);
        if(f.t==="+") return /\\frac/.test(s)?"\\left("+s+"\\right)":"("+s+")";
        return s;
      };
      const joinF=(arr,lead)=>{
        let s=lead; let prevNum=lead!=="";
        arr.forEach(f=>{ const t=fac(f); if(prevNum&&/^[0-9]/.test(t)) s+=" \\cdot "; s+=t; prevNum=/[0-9]$/.test(t)||(f.t==="^"); });
        return s;
      };
      if(den.length||cd!==1){
        const solo=(arr,c)=>arr.length===1&&c===1&&arr[0].t==="+"?T(arr[0],ctx):null;
        const nTop=solo(num,cn)??joinF(num,cn!==1||!num.length?numTeX(cn):"");
        const dBot=solo(den,cd)??joinF(den,cd!==1?String(cd):"");
        return sign+"\\frac{"+nTop+"}{"+dBot+"}";
      }
      void multi;
      return sign+joinF(num,cn!==1?numTeX(cn):"");
    }
    case "^":{
      const {b,e:ex}=e;
      if(isN(ex,0.5)) return "\\sqrt{"+T(b)+"}";
      if(ex.t==="n"&&ex.v<0){ return "\\frac{1}{"+T(S(pw(b,N(-ex.v))))+"}"; }
      const es=T(ex,{exp:true});
      if(b.t==="f"&&b.f!=="exp"&&b.f!=="abs"&&ex.t==="n"&&ex.v>0&&Number.isInteger(ex.v)){
        const a=T(b.x);
        return "\\"+b.f+"^{"+es+"}"+(argSimple(b.x)?" "+a:"("+a+")");
      }
      let bs=T(b);
      if(b.t==="+"||b.t==="*"||b.t==="^"||(b.t==="n"&&b.v<0)||(b.t==="f"&&b.f!=="abs"&&b.f!=="exp")) bs=/\\frac/.test(bs)?"\\left("+bs+"\\right)":"("+bs+")";
      else if(b.t==="n"&&!Number.isInteger(b.v)&&!b.pi) bs="\\left("+bs+"\\right)";
      return bs+"^{"+es+"}";
    }
    case "f":{
      const a=T(e.x);
      if(e.f==="exp") return "e^{"+T(e.x,{exp:true})+"}";
      if(e.f==="abs") return "\\left|"+a+"\\right|";
      return "\\"+e.f+(argSimple(e.x)?" "+a:(/\\frac/.test(a)?"\\left("+a+"\\right)":"("+a+")"));
    }
  }
}
const argSimple=x=>x.t==="v"||(x.t==="n"&&x.v>=0);
const tex=e=>T(e);

function tryParse(s){ try{ return {ok:true,e:S(parse(s))}; }catch(err){ return {ok:false,err:err.message}; } }
return {parse:s=>S(parse(s)),tryParse,d,D,S,fn,tex,vars,frac,key,N,V};
})();
if(typeof module!=="undefined") module.exports=EX;
