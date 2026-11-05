// 使い方: node analysis/_src/build.js
// pages/*.html（本文の $...$ は TeX 風の数式）から analysis/NN-*.html と index.html を生成します。
const fs=require("fs"), path=require("path");
const SRC=__dirname, OUT=path.join(__dirname,"..");
const TEX=require("./lib/tex.js");
const css=fs.readFileSync(path.join(SRC,"common.css"),"utf8");
const libs=["tex.js","expr.js","plot.js"].map(f=>fs.readFileSync(path.join(SRC,"lib",f),"utf8").replace(/^if\(typeof module[^\n]*\n?/m,"")).join("\n");
const COURSE="解析学II";

const files=fs.readdirSync(path.join(SRC,"pages")).filter(f=>/^\d\d-.*\.html$/.test(f)).sort();
const pages=files.map(f=>{
  const raw=fs.readFileSync(path.join(SRC,"pages",f),"utf8");
  const m=raw.match(/^<!--([\s\S]*?)-->/); const meta={};
  if(m) m[1].split("\n").forEach(l=>{ const k=l.match(/^\s*(\w+)\s*:\s*(.*)$/); if(k) meta[k[1]]=k[2].trim(); });
  const rest=m?raw.slice(m[0].length):raw;
  const si=rest.indexOf("<script>");
  const body=si<0?rest:rest.slice(0,si), script=si<0?"":rest.slice(si);
  return {file:f,no:parseInt(f,10),meta,body,script};
});

const nav=(p,i)=>{
  const prev=pages[i-1], next=pages[i+1];
  return `<footer class="pn">${prev?`<a href="${prev.file}">← 第${prev.no}回 ${prev.meta.title}</a>`:`<a href="index.html">← 目次</a>`}${next?`<a href="${next.file}">第${next.no}回 ${next.meta.title} →</a>`:`<a href="index.html">目次 →</a>`}</footer>`;
};
const head=(title,desc)=>`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${desc?`<meta name="description" content="${desc.replace(/"/g,"&quot;")}">\n`:""}<style>
${css}</style>
</head>
<body>
<div class="wrap">
`;

pages.forEach((p,i)=>{
  let body=TEX.texify(p.body);
  // SVG の属性に書いた var(--x) を style に移す（どのブラウザでも効くように）
  body=body.replace(/<svg[\s\S]*?<\/svg>/g,svg=>svg.replace(/<([a-zA-Z]+)([^>]*)>/g,(m,tag,attrs)=>{
    const st=[]; attrs=attrs.replace(/\s(fill|stroke|font-family)="(var\(--[\w-]+\))"/g,(mm,k,v)=>{ st.push(k+":"+v); return ""; });
    if(!st.length) return m;
    if(/\sstyle="/.test(attrs)) attrs=attrs.replace(/\sstyle="([^"]*)"/,(mm,v)=>' style="'+v.replace(/;?$/,";")+st.join(";")+'"');
    else attrs+=' style="'+st.join(";")+'"';
    return "<"+tag+attrs+">";
  }));
  // 目次：h2 と data-toc
  const toc=[];
  body.replace(/<section id="([\w-]+)">\s*<h2>([\s\S]*?)<\/h2>|<[^>]*\bid="([\w-]+)"[^>]*\bdata-toc="([^"]*)"/g,(m,id,h,id2,lab)=>{
    if(id) toc.push(`<a href="#${id}">${h.replace(/<[^>]+>/g,"")}</a>`);
    else toc.push(`<a class="demo-link" href="#${id2}">${lab}</a>`);
    return m;
  });
  const lead=TEX.texify(p.meta.lead||"");
  const html=head(`第${p.no}回 ${p.meta.title}｜${COURSE}`,(p.meta.lead||"").replace(/\$[^$]*\$/g,""))+
`<header class="top">
<div class="crumb"><a href="index.html">${COURSE}</a> ・ 第${p.no}回</div>
<h1>${p.meta.title}</h1>
<p class="lead">${lead}</p>
<nav class="toc" aria-label="目次">${toc.join("")}</nav>
</header>
<main class="doc">
${body.trim()}
</main>
${nav(p,i)}
</div>
<script>
"use strict";
${libs}
</script>
${p.script.trim()}
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT,p.file),html);
});

// 目次ページ
const rows=pages.map(p=>`<li><a href="${p.file}"><span class="no">第${p.no}回</span><span class="ti">${p.meta.title}</span></a><span class="ds">${TEX.texify(p.meta.desc||"")}</span></li>`).join("\n");
fs.writeFileSync(path.join(OUT,"index.html"),head(`${COURSE} 目次`,"解析学II（多変数の微分積分）の学習用ページの目次")+
`<header class="top">
<div class="crumb">大学1年 数学</div>
<h1>${COURSE}（多変数の微分積分）</h1>
<p class="lead">2変数関数の偏微分から、極値問題、2重積分・変数変換・広義積分まで。各回に「直感 → 定義 → 具体例 → 動かしてみよう → よくある間違い → 練習問題」の順でまとめています。</p>
</header>
<style>
.idx{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.idx li{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
.idx a{text-decoration:none;color:var(--fg);display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.idx a:hover .ti{color:var(--accent)}
.idx .no{font-size:.85rem;color:var(--accent);font-weight:700;min-width:3.6em}
.idx .ti{font-weight:700;font-size:1.05rem}
.idx .ds{display:block;font-size:.88rem;color:var(--muted);margin-top:2px}
.part{font-size:.95rem;color:var(--muted);margin:22px 0 8px;font-weight:700}
</style>
<main>
<p class="part">前半：多変数関数の微分</p>
<ol class="idx">
${rows.split("\n").slice(0,9).join("\n")}
</ol>
<p class="part">後半：2重積分</p>
<ol class="idx">
${rows.split("\n").slice(9).join("\n")}
</ol>
</main>
</div>
</body>
</html>
`);
console.log("built",pages.length,"pages");
