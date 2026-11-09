import{cpSync as v,mkdirSync as p,readFileSync as A,rmSync as w,writeFileSync as $}from"node:fs";const o="_site",E=["index.html","404.html","privacidade.html","termos.html","regras.html","manifest.webmanifest","sw.js","css","js","icons"];w(o,{recursive:!0,force:!0}),p(o);for(const e of E)v(e,`${o}/${e}`,{recursive:!0});$(`${o}/.nojekyll`,"");const P=A("js/config.js","utf8"),c=e=>P.match(new RegExp(`${e}:\\s*['"]([^'"]+)['"]`))?.[1],m=c("SUPABASE_URL"),g=c("SUPABASE_ANON_KEY"),h=c("APP_NAME")||"Desapega",u=(process.env.SITE_URL||"").replace(/\/?$/,"/");(!m||m.includes("SEU-PROJETO"))&&(console.log("Supabase ainda não configurado em js/config.js; pulando páginas de compartilhamento."),process.exit(0));const b={garagem:"Venda de garagem",mudanca:"Venda de mudança",bazar:"Bazar coletivo"},t=e=>String(e??"").replace(/[&<>"]/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[n]),l=e=>new Date(`${e}T12:00:00-03:00`).toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short",timeZone:"America/Sao_Paulo"}).replace(/\./g,""),_=e=>{const[n,a]=e.split(":");return`${Number(n)}h${a==="00"?"":a}`},U=new Date(Date.now()-7*864e5).toISOString().slice(0,10),j=`${m}/rest/v1/sales?select=id,title,description,type,region,starts_on,ends_on,start_time,end_time,cover_url,items(photo_url)&hidden=eq.false&draft=eq.false&ends_on=gte.${U}&order=starts_on&limit=2000`,s=await fetch(j,{headers:{apikey:g,Authorization:`Bearer ${g}`}});s.ok||(console.error("Falha ao ler vendas do Supabase:",s.status,await s.text()),process.exit(0));const S=await s.json();for(const e of S){const n=e.starts_on===e.ends_on?l(e.starts_on):`${l(e.starts_on)} a ${l(e.ends_on)}`,a=`${e.title} · ${b[e.type]}`,r=e.items.length,d=`${n}, ${_(e.start_time)}–${_(e.end_time)} · ${e.region}${r?` · ${r} ${r===1?"item":"itens"}`:""}. ${e.description||""}`.slice(0,200),f=e.cover_url||e.items.find(y=>y.photo_url)?.photo_url||`${u}icons/og.jpg`,i=`../../#/venda/${e.id}`;p(`${o}/v/${e.id}`,{recursive:!0}),$(`${o}/v/${e.id}/index.html`,`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>${t(a)} — ${t(h)}</title>
<meta name="description" content="${t(d)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${t(h)}">
<meta property="og:title" content="${t(a)}">
<meta property="og:description" content="${t(d)}">
<meta property="og:image" content="${t(f)}">
<meta property="og:url" content="${t(u)}v/${e.id}/">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${i}">
<script>location.replace(${JSON.stringify(i)});<\/script>
</head>
<body><a href="${i}">Abrir a venda</a></body>
</html>
`)}console.log(`Geradas ${S.length} páginas de compartilhamento.`);
