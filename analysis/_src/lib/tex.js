/* ===== 小さな TeX → HTML 変換器（外部ライブラリなし） =====
   tex("\\frac{\\partial f}{\\partial x}")       … インライン用 HTML
   tex("...", true)                              … ディスプレイ用 HTML
   対応：上付き/下付き, \frac, \sqrt, \left \right, \int/\iint (上下端), \lim/\max/\sum (下付き),
         pmatrix / vmatrix / cases / aligned, \text, \bm, \overline, \clr{c2}{..}, \hl{..} など */
const TEX=(()=>{
"use strict";
const GREEK={alpha:"α",beta:"β",gamma:"γ",delta:"δ",epsilon:"ε",varepsilon:"ε",zeta:"ζ",eta:"η",theta:"θ",vartheta:"ϑ",iota:"ι",kappa:"κ",lambda:"λ",mu:"μ",nu:"ν",xi:"ξ",pi:"π",rho:"ρ",sigma:"σ",tau:"τ",phi:"ϕ",varphi:"φ",chi:"χ",psi:"ψ",omega:"ω"};
const UGREEK={Gamma:"Γ",Delta:"Δ",Theta:"Θ",Lambda:"Λ",Xi:"Ξ",Pi:"Π",Sigma:"Σ",Phi:"Φ",Psi:"Ψ",Omega:"Ω"};
const ORD={partial:"∂",nabla:"∇",infty:"∞",ldots:"…",cdots:"⋯",dots:"…",vdots:"⋮",R:"ℝ",emptyset:"∅",varnothing:"∅",forall:"∀",exists:"∃",prime:"′",ell:"ℓ","|":"‖",lvert:"|",rvert:"|",therefore:"∴",because:"∵",square:"□",checkmark:"✓",star:"★"};
const BIN={pm:"±",mp:"∓",times:"×",cdot:"·",cap:"∩",cup:"∪",setminus:"∖",circ:"∘",div:"÷"};
const REL={Longleftrightarrow:"⟺",Longrightarrow:"⟹",mid:"|",le:"≤",leq:"≤",ge:"≥",geq:"≥",ne:"≠",neq:"≠",approx:"≈",to:"→",rightarrow:"→",leftarrow:"←",mapsto:"↦",in:"∈",notin:"∉",ni:"∋",subset:"⊂",subseteq:"⊆",supset:"⊃",Rightarrow:"⇒",implies:"⇒",Leftarrow:"⇐",iff:"⇔",Leftrightarrow:"⇔",equiv:"≡",sim:"∼",simeq:"≃",perp:"⊥",parallel:"∥",ll:"≪",gg:"≫",lt:"&lt;",gt:"&gt;",colon:":",nearrow:"↗",searrow:"↘",uparrow:"↑",downarrow:"↓",longrightarrow:"⟶"};
const FN=new Set(["sin","cos","tan","cot","sec","csc","log","ln","exp","arcsin","arccos","arctan","sinh","cosh","tanh","det","dim","rank","grad","sgn","deg","Im","Ker","Tan","Arctan","Arcsin","Arccos"]);
const UNDER=new Set(["lim","max","min","sup","inf","sum","prod","limsup","liminf"]);
const INTS={int:"∫",iint:"∬",iiint:"∭",oint:"∮"};
const BB={R:"ℝ",N:"ℕ",Z:"ℤ",Q:"ℚ",C:"ℂ"};
const NB=" ", NN=" ";
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

function tokenize(s){
  const t=[]; let i=0;
  const raw=()=>{ // { ... } を生のまま読む
    while(i<s.length&&/\s/.test(s[i])) i++;
    if(s[i]!=="{") return "";
    let d=0,j=i;
    for(;j<s.length;j++){ if(s[j]==="\\"){j++;continue;} if(s[j]==="{") d++; else if(s[j]==="}"){d--; if(d===0) break;} }
    const r=s.slice(i+1,j); i=j+1; return r;
  };
  while(i<s.length){
    const c=s[i];
    if(c==="\\"){
      let j=i+1;
      if(/[A-Za-z]/.test(s[j]||"")){
        while(j<s.length&&/[A-Za-z]/.test(s[j])) j++;
        const v=s.slice(i+1,j); i=j;
        if(v==="text"||v==="mbox"||v==="textrm") t.push({k:"text",v:raw()});
        else if(v==="mathrm"||v==="rm") t.push({k:"rm",v:raw()});
        else if(v==="begin"||v==="end") t.push({k:v,v:raw()});
        else if(v==="clr") t.push({k:"clr",v:raw()});
        else if(v==="mathbb") t.push({k:"ch",v:BB[raw()]||"?"});
        else if(v==="operatorname") t.push({k:"fnname",v:raw()});
        else t.push({k:"cmd",v});
      } else { t.push({k:"cmd",v:s[j]||""}); i=j+1; }
    } else if(/\s/.test(c)) i++;
    else if("{}^_&".includes(c)){ t.push({k:c}); i++; }
    else { t.push({k:"ch",v:c}); i++; }
  }
  return t;
}

function render(src,display){
  const T=tokenize(src); let p=0;
  const peek=()=>T[p], next=()=>T[p++];
  const isStop=(tok,stops)=>!tok||stops.some(f=>f(tok));
  function list(stops){
    const out=[];
    while(!isStop(peek(),stops)){ const a=atom(); if(a) out.push(a); }
    return out;
  }
  function group(){ // { ... } または1トークン
    const tok=peek();
    if(!tok) return "";
    if(tok.k==="{"){ next(); const a=list([t=>t.k==="}"]); next(); return join(a,false); }
    const a=atom(true); return a?a.h:"";
  }
  function scripts(a){
    let sup=null,sub=null,primes="";
    for(;;){
      const tok=peek(); if(!tok) break;
      if(tok.k==="^"){ next(); sup=group(); }
      else if(tok.k==="_"){ next(); sub=group(); }
      else if(tok.k==="ch"&&tok.v==="'"){ next(); primes+="′"; }
      else break;
    }
    if(primes) a.h+='<span class="pr">'+primes+"</span>";
    if(sup===null&&sub===null) return a;
    if(a.lim==="under"){
      a.h='<span class="ul'+(sup!==null?" hs":"")+'"><span class="ulo">'+a.h+(sup!==null?'<span class="ult">'+sup+"</span>":"")+"</span>"+(sub!==null?'<span class="ulu">'+sub+"</span>":"")+"</span>";
      return a;
    }
    if(a.lim==="int"){
      if(sup!==null&&sub!==null) a.h+='<span class="il"><span>'+sup+"</span><span>"+sub+"</span></span>";
      else if(sub!==null) a.h+='<sub class="is">'+sub+"</sub>";
      else a.h+="<sup>"+sup+"</sup>";
      return a;
    }
    if(sup!==null&&sub!==null) a.h+='<span class="ss"><span>'+sup+"</span><span>"+sub+"</span></span>";
    else if(sup!==null) a.h+="<sup>"+sup+"</sup>";
    else a.h+="<sub>"+sub+"</sub>";
    if(a.c==="fn"&&sup!==null) a.c="fn"; // \sin^2 x
    return a;
  }
  function delim(tok){
    if(!tok) return "n";
    if(tok.k==="ch") return {"(":"p",")":"p","[":"b","]":"b","|":"v",".":"n"}[tok.v]||"n";
    if(tok.k==="cmd") return {"{":"c","}":"c","|":"V",lvert:"v",rvert:"v",langle:"a",rangle:"a"}[tok.v]||"n";
    return "n";
  }
  function env(name){
    const rows=[[]]; let cell=[];
    for(;;){
      const tok=peek();
      if(!tok){break;}
      if(tok.k==="end"){ next(); break; }
      if(tok.k==="&"){ next(); rows[rows.length-1].push(join(cell,false)); cell=[]; continue; }
      if(tok.k==="cmd"&&tok.v==="\\"){ next(); rows[rows.length-1].push(join(cell,false)); cell=[]; rows.push([]); continue; }
      const a=atom(); if(a) cell.push(a);
    }
    rows[rows.length-1].push(join(cell,false));
    if(rows.length>1&&rows[rows.length-1].length===1&&rows[rows.length-1][0]==="") rows.pop();
    const nc=Math.max(...rows.map(r=>r.length));
    const cells=rows.map(r=>{while(r.length<nc) r.push(""); return r.map(c=>"<span>"+c+"</span>").join("");}).join("");
    if(name==="aligned"||name==="align"||name==="align*")
      return {h:'<span class="eqs" style="--c:'+nc+'">'+cells+"</span>",c:"ord"};
    if(name==="cases")
      return {h:'<span class="cases" style="--r:'+rows.length+';--cc:'+nc+'"><span class="cb">{</span><span class="g">'+cells+"</span></span>",c:"ord"};
    const cls=name==="vmatrix"?"mat det":name==="bmatrix"?"mat sq":name==="matrix"?"mat bare":"mat";
    return {h:'<span class="'+cls+'"><span class="g" style="--c:'+nc+'">'+cells+"</span></span>",c:"ord"};
  }
  function atom(single){
    const tok=next(); if(!tok) return null;
    let a=null;
    switch(tok.k){
      case "{":{ const l=list([t=>t.k==="}"]); next(); a={h:join(l,false),c:"ord"}; break; }
      case "}": return null;
      case "^": case "_": return null;
      case "&": return null;
      case "text": a={h:'<span class="tx">'+esc(tok.v).replace(/ /g,NB)+"</span>",c:"ord"}; break;
      case "rm": a={h:'<span class="rmn">'+esc(tok.v)+"</span>",c:"ord"}; break;
      case "fnname": a={h:'<span class="fn">'+esc(tok.v)+"</span>",c:"fn"}; break;
      case "begin": a=env(tok.v); break;
      case "end": return null;
      case "clr":{ const g=group(); a={h:'<span style="color:var(--'+esc(tok.v)+')">'+g+"</span>",c:"ord"}; break; }
      case "ch":{
        const c=tok.v;
        if(/[A-Za-z]/.test(c)) a={h:"<i>"+c+"</i>",c:"ord"};
        else if(/[0-9]/.test(c)){
          let s=c;
          if(!single) while(peek()&&peek().k==="ch"&&/[0-9.]/.test(peek().v)){ if(peek().v==="."&&!(T[p+1]&&T[p+1].k==="ch"&&/[0-9]/.test(T[p+1].v))) break; s+=next().v; }
          a={h:s,c:"ord"};
        }
        else if(c==="+") a={h:"+",c:"bin"};
        else if(c==="-") a={h:"−",c:"bin"};
        else if(c==="*") a={h:"∗",c:"bin"};
        else if(c==="=") a={h:"=",c:"rel"};
        else if(c==="<") a={h:"&lt;",c:"rel"};
        else if(c===">") a={h:"&gt;",c:"rel"};
        else if(c===":") a={h:":",c:"rel"};
        else if(c===","||c===";") a={h:c,c:"punct"};
        else if(c==="("||c==="[") a={h:c,c:"open"};
        else if(c===")"||c==="]") a={h:c,c:"close"};
        else if(c==="'") a={h:"′",c:"ord"};
        else if(c==="~") a={h:NB,c:"sp"};
        else a={h:esc(c),c:"ord"};
        break;
      }
      case "cmd":{
        const v=tok.v;
        if(GREEK[v]) a={h:"<i>"+GREEK[v]+"</i>",c:"ord"};
        else if(UGREEK[v]) a={h:UGREEK[v],c:"ord"};
        else if(ORD[v]!==undefined) a={h:ORD[v],c:"ord"};
        else if(BIN[v]) a={h:BIN[v],c:"bin",always:true};
        else if(REL[v]) a={h:REL[v],c:"rel"};
        else if(FN.has(v)) a={h:'<span class="fn">'+v+"</span>",c:"fn"};
        else if(UNDER.has(v)) a={h:v==="sum"?'<span class="bs">∑</span>':v==="prod"?'<span class="bs">∏</span>':'<span class="fn">'+v+"</span>",c:"op",lim:(v==="sum"||v==="prod")&&!display?"int":"under"};
        else if(INTS[v]) a={h:'<span class="int">'+INTS[v]+"</span>",c:"op",lim:"int"};
        else if(v==="frac"||v==="dfrac"||v==="tfrac"){ const n=group(), d=group(); a={h:'<span class="frac"><span>'+n+"</span><span>"+d+"</span></span>",c:"ord"}; }
        else if(v==="sqrt"){ const g=group(); a={h:'<span class="sqrt"><span class="rt">√</span><span class="rd">'+g+"</span></span>",c:"ord"}; }
        else if(v==="bm"||v==="mathbf"||v==="boldsymbol"){ const g=group(); a={h:'<b class="vec">'+g+"</b>",c:"ord"}; }
        else if(v==="overline"||v==="bar"){ const g=group(); a={h:'<span class="ovl">'+g+"</span>",c:"ord"}; }
        else if(v==="hat"){ const g=group(); a={h:g+"̂",c:"ord"}; }
        else if(v==="tilde"){ const g=group(); a={h:g+"̃",c:"ord"}; }
        else if(v==="hl"){ const g=group(); a={h:'<span class="hlm">'+g+"</span>",c:"ord"}; }
        else if(v==="boxed"){ const g=group(); a={h:'<span class="bxd">'+g+"</span>",c:"ord"}; }
        else if(v==="left"){
          const L=delim(next());
          const inner=list([t=>t.k==="cmd"&&t.v==="right"]); next();
          const R=delim(next());
          a={h:'<span class="lr l'+L+" r"+R+'"><span class="lri">'+join(inner,false)+"</span></span>",c:"ord"};
        }
        else if(v==="right") return null;
        else if(/^(big|Big|bigg|Bigg)(l|r|m)?$/.test(v)){
          const t=next(); const ch=t?(t.k==="ch"?t.v:t.k==="cmd"?({"{":"{","}":"}","|":"‖",langle:"⟨",rangle:"⟩"}[t.v]||""):""):"";
          const sz={big:1.2,Big:1.5,bigg:1.8,Bigg:2.1}[v.replace(/[lrm]$/,"")];
          a={h:'<span style="font-size:'+sz+'em;line-height:1;vertical-align:-.08em">'+esc(ch)+"</span>",c:/[(\[{⟨]/.test(ch)?"open":/[)\]}⟩]/.test(ch)?"close":"ord"};
        }
        else if(v==="not"){
          const t=next(); let h="";
          if(t&&t.k==="cmd"){ const m={Rightarrow:"⇏",to:"↛",rightarrow:"↛",in:"∉",subset:"⊄",equiv:"≢",iff:"⇎",Leftrightarrow:"⇎",parallel:"∦"}; h=m[t.v]||((REL[t.v]||"")+"\u0338"); }
          else if(t&&t.k==="ch") h=t.v==="="?"≠":esc(t.v)+"\u0338";
          a={h,c:"rel"};
        }
        else if(v==="xrightarrow"){ const g=group(); a={h:'<span class="xa"><span class="xal">'+g+'</span><span class="xar">⟶</span></span>',c:"rel"}; }
        else if(v==="{"||v==="langle") a={h:v==="{"?"{":"⟨",c:"open"};
        else if(v==="}"||v==="rangle") a={h:v==="}"?"}":"⟩",c:"close"};
        else if(v===",") a={h:'<span class="s1"></span>',c:"sp"};
        else if(v===";"||v===":") a={h:'<span class="s2"></span>',c:"sp"};
        else if(v==="!") a={h:'<span class="sn"></span>',c:"sp"};
        else if(v===" ") a={h:NB,c:"sp"};
        else if(v==="quad") a={h:'<span class="q1"></span>',c:"sp",brk:true};
        else if(v==="qquad") a={h:'<span class="q2"></span>',c:"sp",brk:true};
        else if(v==="displaystyle"||v==="limits"||v==="nolimits"||v==="textstyle") return null;
        else if(v==="\\") a={h:"<br>",c:"sp"};
        else if(v==="#"||v==="%"||v==="$"||v==="&"||v==="_") a={h:esc(v),c:"ord"};
        else a={h:'<span style="color:red">\\'+esc(v)+"</span>",c:"ord"};
        break;
      }
    }
    if(!a) return null;
    if(single) return a;
    return scripts(a);
  }
  function join(atoms,top){
    let out="", prev=null; const segs=[];
    const cut=()=>{ segs.push(out); out=""; };
    if(top) depth=0;
    for(let i=0;i<atoms.length;i++){
      const a=atoms[i]; let c=a.c;
      let un=false;
      if(c==="bin"&&!a.always&&(!prev||["bin","rel","open","punct","op","un"].includes(prev.c))){ c="ord"; un=true; }
      if(c==="bin") out+=NB+a.h+NB;
      else if(c==="rel"){ out+=NB+a.h; if(top) cut(); else out+=NB; }
      else if(c==="punct"){ out+=a.h; if(top&&depth===0) cut(); else out+=NN; }
      else{
        if(prev&&(prev.c==="fn"||prev.c==="op")&&c!=="open"&&c!=="sp"&&c!=="close"&&c!=="punct") out+='<span class="s1"></span>';
        else if(prev&&c==="fn"&&(prev.c==="ord"||prev.c==="close")) out+='<span class="s1"></span>';
        out+=a.h;
        if(a.brk&&top) cut();
        if(c==="open") depth++; else if(c==="close"&&depth>0) depth--;
      }
      prev={c:un?"un":c};
    }
    if(!top) return out;
    cut();
    return segs.filter(x=>x!=="").map(x=>'<span class="mn">'+x+"</span>").join(" ");
  }
  let depth=0;
  const h=join(list([]),!display);
  return h;
}
function tex(src,display){
  const h=render(src,!!display);
  return display?'<div class="dm">'+h+"</div>":'<span class="m">'+h+"</span>";
}
/* 本文中の $$...$$ と $...$ を変換（\$ はドル記号） */
function texify(html){
  return html.replace(/\$\$([\s\S]+?)\$\$|\\\$|\$([^$]+?)\$/g,(m,d,i)=>{
    if(m==="\\$") return "$";
    return d!==undefined?tex(d.trim(),true):tex(i,false);
  });
}
return {tex,texify};
})();
const tex=TEX.tex;
if(typeof module!=="undefined") module.exports=TEX;
