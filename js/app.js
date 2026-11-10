import{createClient as Ft}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";import{CONFIG as R}from"./config.js";import{REGIONS as ne,DF_CENTER as st,regionByName as he,SALE_TYPES as G,CATEGORIES as z,REPORT_REASONS as Xt}from"./data.js";import{maybeSuggestInstall as rt,canInstall as Yt,installNow as Gt}from"./install.js";import{stripMetadata as Qt}from"./metadata.js";import{initMonitoring as Kt,reportError as Ce}from"./monitoring.js";import{saleStatus as ve,distanceKm as N,formatDistance as se,googleCalendarUrl as Zt,icsFor as Jt}from"./when.js";import{PIX_TYPES as it,guessPixType as ct,normalizePixKey as ea,formatPixKey as ta,pixPayload as aa,qrSvg as lt,qrImage as oa}from"./pix.js";import{pushSupport as Ie,remindersActive as na,enableReminders as sa,disableReminders as fe,syncReminders as ra}from"./reminders.js";function dt(e){return e&&e.closest&&e.closest(".pode-zoom, .leaflet-container")}["gesturestart","gesturechange","gestureend"].forEach(e=>{document.addEventListener(e,a=>{dt(a.target)||a.preventDefault()},{passive:!1})}),document.addEventListener("touchmove",e=>{e.touches.length>1&&!dt(e.target)&&e.preventDefault()},{passive:!1});const T=document.getElementById("view"),ut=!R.SUPABASE_URL.includes("SEU-PROJETO"),f=ut?Ft(R.SUPABASE_URL,R.SUPABASE_ANON_KEY,{auth:{flowType:"pkce",detectSessionInUrl:!0,persistSession:!0}}):null,ge=location.origin+location.pathname.replace(/index\.html$/,""),g={user:null,profile:null,contact:null,favorites:new Set,requireVerification:!1,unread:0,chatUnread:0},$=e=>String(e??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a]),Q=e=>e==null?"A combinar":Number(e)===0?"Grátis":Number(e).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),B=e=>new Date(e.getTime()-e.getTimezoneOffset()*6e4).toISOString().slice(0,10),X=e=>{const[a,t,n]=e.split("-").map(Number);return new Date(a,t-1,n)},Y=(e,a)=>new Date(e.getFullYear(),e.getMonth(),e.getDate()+a),D=()=>B(new Date),pt=60,mt=7,Pe=()=>B(Y(new Date,pt));function ht(e,a){return a<e?"O último dia não pode ser antes do início.":e>Pe()?`A venda precisa começar em até ${pt} dias.`:(X(a)-X(e))/864e5>=mt?`A venda pode durar no máximo ${mt} dias.`:null}function be(e){const a=X(e),t=D();return e===t?"Hoje":e===B(Y(new Date,1))?"Amanhã":a.toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"}).replace(/\./g,"")}function ia(e){const a=X(e),t=a.toLocaleDateString("pt-BR",{weekday:"long"}).replace("-feira","");if(e===D())return"Hoje";if(e===B(Y(new Date,1)))return`Amanhã, ${t}`;const n=a.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});return n.charAt(0).toUpperCase()+n.slice(1)}const $e=e=>{if(!e)return"";const[a,t]=e.split(":");return`${Number(a)}h${t==="00"?"":t}`};function ye(e){return`${e.starts_on===e.ends_on?be(e.starts_on):`${be(e.starts_on)} a ${be(e.ends_on)}`} · ${$e(e.start_time)}–${$e(e.end_time)}`}function ca(){const e=new Date,a=(6-e.getDay()+7)%7;return Y(e,a)}function la(){const e=new Date;return Y(e,(7-e.getDay())%7)}function da(e){return String(e??"").replace(/\D/g,"")}function ua(e){let a=da(e);return(a.length===10||a.length===11)&&(a="55"+a),/^55\d{10,11}$/.test(a)?a:null}function vt(e){if(!e)return"";const a=e.match(/^55(\d{2})(\d{4,5})(\d{4})$/);return a?`(${a[1]}) ${a[2]}-${a[3]}`:e}function re(e){const a=String(e??"").trim();if(!a)return null;const t=Number(a.replace(/[^\d,.-]/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",","."));return Number.isFinite(t)&&t>=0?Math.round(t*100)/100:null}let ft;function b(e,a="",t=null,n=null){t&&!yt(t)&&Ce(t,(location.hash.split("?")[0]||"#/").replace(/[0-9a-f-]{36}/g,":id"));const o=document.getElementById("toast");if(o.textContent=e,n){const s=document.createElement("button");s.type="button",s.className="toast-action",s.textContent=n.label,s.onclick=()=>{o.hidden=!0,n.run()},o.append(" ",s)}o.className=`toast ${a}`,o.hidden=!1,clearTimeout(ft),ft=setTimeout(()=>o.hidden=!0,a==="error"?9e3:n?6e3:3500)}const pa="DS400",we=e=>e?.code===pa?null:e,De=(e,a)=>Object.assign(new Error(`${e}: ${a.message}`),{code:a.code}),j=e=>location.hash="#"+e,_e=e=>`${ge}v/${e}/`;function H(e,a="",{keep:t=!1}={}){const n=document.createElement("div");n.className="modal-backdrop",n.innerHTML=`<div class="modal ${a}" role="dialog" aria-modal="true">${e}</div>`;const o=()=>n.remove();return n.addEventListener("click",s=>{(s.target===n&&!t||s.target.closest("[data-close]"))&&o()}),document.body.appendChild(n),{el:n.querySelector(".modal"),close:o}}const E={heart:'<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',share:'<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/></svg>',pin:'<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.7-6-11a6 6 0 0 1 12 0c0 5.3-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',camera:'<svg viewBox="0 0 24 24"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',flag:'<svg viewBox="0 0 24 24"><path d="M5 21V4m0 0h11l-2 4 2 4H5"/></svg>',tag:'<svg viewBox="0 0 24 24"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',calendar:'<svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',chat:'<svg viewBox="0 0 24 24"><path d="M4 5.5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',send:'<svg viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-3-7z"/><path d="m11 13 9-9"/></svg>',user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',out:'<svg viewBox="0 0 24 24"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/></svg>',doc:'<svg viewBox="0 0 24 24"><path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h6"/></svg>',chevron:'<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',download:'<svg viewBox="0 0 24 24"><path d="M12 4v11M8 11l4 4 4-4M5 20h14"/></svg>',moon:'<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',target:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg>',palette:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.9 1.4-2l-.4-1a1.5 1.5 0 0 1 1.4-2H17a4 4 0 0 0 4-4c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/></svg>',trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',bell:'<svg viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',pix:'<svg viewBox="0 0 24 24"><path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/><path d="M8 12h8"/></svg>',whatsapp:'<svg viewBox="0 0 24 24"><path d="M4 20l1.2-3.8A8 8 0 1 1 8 19z"/><path d="M9 9.5c.5 2.5 2.5 4.5 5 5l1.2-1.2 2 1-.4 1.6c-4.4.4-9-4.2-8.6-8.6L9.8 7l1 2z"/></svg>'};function ma(e){return{google:`https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}`,waze:`https://waze.com/ul?ll=${e.lat},${e.lng}&navigate=yes`}}let Z=[];const ha=[[-16.4,-48.65],[-15.2,-47.05]];function Be(e,a,t,{recenter:n,...o}={}){const s=L.map(e,{scrollWheelZoom:!1,maxBounds:ha,maxBoundsViscosity:.9,minZoom:9,...o}).setView(a,t);L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap"}).addTo(s);const l=L.Control.extend({options:{position:"topleft"},onAdd(){const i=L.DomUtil.create("button","map-recenter leaflet-bar");return i.type="button",i.title="Centralizar o mapa",i.setAttribute("aria-label","Centralizar o mapa"),i.innerHTML=E.target,L.DomEvent.disableClickPropagation(i),L.DomEvent.on(i,"click",d=>{L.DomEvent.preventDefault(d),n?n(s):s.setView(a,t)}),i}});s.addControl(new l);const r=setTimeout(()=>s.invalidateSize({animate:!1}),50);return Z.push(()=>{clearTimeout(r),s.stop(),s.remove()}),s}const Ee=e=>L.divIcon({className:`pin pin-${e}`,html:"<span></span>",iconSize:[30,30],iconAnchor:[15,30],popupAnchor:[0,-28]});async function Re(e){if(g.user=e,g.profile=null,g.contact=null,g.favorites=new Set,g.moderator=!1,g.prefs=void 0,e){const[a,t,n,o,s]=await Promise.all([f.from("profiles").select("id,name,chat_enabled").eq("id",e.id).maybeSingle(),f.from("contacts").select("whatsapp,phone_verified,pix_key,pix_name,show_whatsapp").eq("user_id",e.id).maybeSingle(),f.from("favorites").select("sale_id").eq("user_id",e.id),f.from("moderators").select("user_id").eq("user_id",e.id).maybeSingle(),f.from("preferences").select("home_region,nearby,regions,interests,alerts,news_email").eq("user_id",e.id).maybeSingle()]);g.prefs=s.error?void 0:s.data,g.profile=a.data,g.contact=t.data,g.favorites=new Set((n.data||[]).map(l=>l.sale_id)),g.moderator=!!o.data,ra(f).catch(()=>{})}va(),W(!0),Za()}let gt=0,bt=0;async function W(e=!1){if(!g.user)return g.unread=0,g.chatUnread=0,Ne();if(!e&&Date.now()-gt<3e4)return;gt=Date.now();const a=++bt,[t,n]=await Promise.all([f.from("notifications").select("id",{count:"exact",head:!0}).is("read_at",null),f.rpc("chat_unread_count")]);a===bt&&(t.error||(g.unread=t.count||0),n.error||(g.chatUnread=n.data||0),Ne())}function Ne(){const e=document.getElementById("notif-badge");e.hidden=!g.unread,e.textContent=g.unread>9?"9+":String(g.unread),document.getElementById("notif-link").setAttribute("aria-label",g.unread?`Notificações: ${g.unread} nova(s)`:"Notificações");const a=document.getElementById("chat-badge");a.hidden=!g.chatUnread,a.textContent=g.chatUnread>9?"9+":String(g.chatUnread),document.getElementById("chat-tab").setAttribute("aria-label",g.chatUnread?`Chat: ${g.chatUnread} conversa(s) com mensagem nova`:"Chat"),Ut("m-chat",g.chatUnread),Ut("m-notif",g.unread)}document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&(ee||W(),window.dispatchEvent(new Event("chat-resync")))}),navigator.serviceWorker?.addEventListener("message",e=>{if(e.data?.type!=="push")return;ee&&e.data.url?.endsWith(`/chat/${ee}`)&&document.visibilityState==="visible"||W(!0),window.dispatchEvent(new Event("chat-resync"))});function va(){const e=document.getElementById("account-link");g.user?(e.textContent=g.profile?.name?.split(" ")[0]||"Perfil",e.href="#/perfil"):(e.textContent="Entrar",e.href="#/entrar"),document.getElementById("notif-link").hidden=!g.user}function V(e,a="Entre para continuar."){return g.user?!0:(sessionStorage.setItem("next",e),j("/entrar?msg="+encodeURIComponent(a)),!1)}function $t(){return!g.requireVerification||!!g.contact?.phone_verified}const fa=[[/^\/$/,ya],[/^\/buscar$/,wa],[/^\/anunciar$/,Rt],[/^\/venda\/([\w-]+)$/,_a],[/^\/venda\/([\w-]+)\/editar$/,Rt],[/^\/venda\/([\w-]+)\/cartaz$/,ja],[/^\/minhas$/,Qa],[/^\/entrar$/,uo],[/^\/perfil$/,po],[/^\/notificacoes$/,lo],[/^\/menu$/,so],[/^\/chat$/,eo],[/^\/chat\/([\w-]+)$/,ao]];let je=!1;addEventListener("pagehide",()=>je=!0),addEventListener("pageshow",()=>je=!1);const yt=e=>/Failed to fetch|Load failed|NetworkError|network/i.test(`${e?.message} ${e?.details}`),wt=e=>{const a=(e.slice(1)||"/").split("?")[0];return/^\/(buscar|chat|menu|anunciar)?$/.test(a)?0:/^\/(venda\/[\w-]+|chat\/[\w-]+|minhas|perfil|notificacoes)$/.test(a)?1:/^\/venda\/[\w-]+\/editar$/.test(a)?2:null};let _t=location.hash;const ga=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;function ba(e,a){const t=wt(e),n=wt(a),o=t==null||n==null||t===n?"":n>t?"frente":"volta";if(!o||ga())return;const s=T,l=s.getBoundingClientRect(),r=getComputedStyle(s),i=s.cloneNode(!0);i.removeAttribute("id"),i.removeAttribute("aria-live"),i.querySelectorAll("[id]").forEach(h=>h.removeAttribute("id")),i.style.cssText=`position:absolute;top:${l.top}px;left:${l.left}px;width:${l.width}px;height:${l.height}px;margin:0;max-width:none;box-sizing:border-box;overflow:hidden;padding:${r.padding};display:${r.display};flex-direction:${r.flexDirection}`;const d=document.createElement("div");d.className=`${document.body.className} tela-sai ${o}`,d.setAttribute("aria-hidden","true"),d.inert=!0,d.append(i),document.body.append(d),i.scrollTop=s.scrollTop;const c=[...s.querySelectorAll("*")].map((h,_)=>[_,h.scrollTop]).filter(([,h])=>h>0);if(c.length){const h=i.querySelectorAll("*");c.forEach(([_,k])=>h[_]&&(h[_].scrollTop=k))}const m=()=>d.remove();d.addEventListener("animationend",h=>h.target===d&&m()),setTimeout(m,600);const u=()=>{s.classList.add("tela-entra",o);const h=k=>k.target===s&&_(),_=()=>{s.classList.remove("tela-entra","frente","volta"),s.removeEventListener("animationend",h)};s.addEventListener("animationend",h),setTimeout(_,600)},x=new MutationObserver(()=>(x.disconnect(),u()));x.observe(s,{childList:!0}),setTimeout(()=>x.disconnect(),1500)}let Et=0;async function O(){ba(_t,location.hash),_t=location.hash,Z.forEach(r=>r()),Z=[];const e=++Et,a=location.hash.slice(1)||"/",[t,n]=a.split("?"),o=new URLSearchParams(n||""),s=t.startsWith("/chat")?"/chat":["/menu","/minhas","/perfil","/notificacoes"].includes(t)?"/menu":t;document.querySelectorAll("[data-nav]").forEach(r=>r.classList.toggle("active",r.dataset.nav===s));const l={params:o,path:t,alive:()=>e===Et};document.getElementById("notif-link").classList.toggle("active",t==="/notificacoes"),t!=="/notificacoes"&&W();for(const[r,i]of fa){const d=t.match(r);if(d){T.scrollTo(0,0);try{await i(l,...d.slice(1))}catch(c){if(je||!l.alive())return;if(yt(c)){T.innerHTML=`
          <div class="empty">
            <h2>Sem conexão</h2>
            <p>Não conseguimos carregar agora. Confira sua internet e tente de novo.</p>
            <button class="btn primary" id="retry">Tentar de novo</button>
          </div>`,document.getElementById("retry").onclick=O;return}console.error(c),Ce(c,`tela ${t.replace(/[0-9a-f-]{36}/g,":id")}`),T.innerHTML=`<div class="empty"><h2>Algo deu errado</h2><p>${$(c.message)}</p><a class="btn" href="#/">Voltar ao início</a></div>`}return}}T.innerHTML='<div class="empty"><h2>Página não encontrada</h2><a class="btn" href="#/">Voltar ao início</a></div>'}function xt(e){const a=ve(e);return a.key==="agora"||a.key==="hoje"?`<span class="badge status-${a.key}">${$(a.label)}</span>`:""}function te(e){const a=G[e.type],t=e.items?.[0]?.count??0,n=g.favorites.has(e.id),o=ie()?se(N(ie(),e)):"";return`
    <a class="sale-card ${e.type==="mudanca"?"highlight":""}" href="#/venda/${e.id}">
      <div class="thumb type-bg-${e.type}">
        ${e.cover_url?`<img src="${$(Ue(e.cover_url))}" alt="" loading="lazy" decoding="async">`:E.tag}
        ${n?`<span class="fav-dot" title="Favorita">${E.heart}</span>`:""}
      </div>
      <div class="body">
        <div class="badges"><span class="badge type-${e.type}">${a.label}</span>${e.draft?'<span class="badge draft">Rascunho</span>':xt(e)}</div>
        <h3>${$(e.title)}</h3>
        <p class="meta">${E.clock}${ye(e)}</p>
        <p class="meta">${E.pin}${o?`<strong>${o}</strong> · `:""}${$(e.region)}${t?` · ${t} ${t===1?"item":"itens"}`:""}</p>
      </div>
    </a>`}const He=(e=4)=>`<div class="cards" aria-busy="true" aria-label="Carregando">${'<div class="sale-card skeleton"><div class="thumb"></div><div class="body"><span></span><span></span><span></span></div></div>'.repeat(e)}</div>`,Oe=[2,5,10,20];function ie(){try{return JSON.parse(sessionStorage.getItem("minha-posicao"))}catch{return null}}function $a(){return new Promise((e,a)=>{if(!navigator.geolocation)return a(new Error("Seu aparelho não informa a localização."));navigator.geolocation.getCurrentPosition(t=>{const n={lat:t.coords.latitude,lng:t.coords.longitude};sessionStorage.setItem("minha-posicao",JSON.stringify(n)),e(n)},()=>a(new Error("Não foi possível obter sua localização. Confira se o navegador tem permissão.")),{enableHighAccuracy:!1,timeout:1e4,maximumAge:3e5})})}const J=6,F=e=>e.photos?.length?e.photos:e.photo_url?[e.photo_url]:[],ce=e=>e.title||"Item sem título",xe=/\.f\.(webp|jpg)$/,Ue=e=>e&&e.includes("/object/public/photos/")&&xe.test(e)?e.replace(xe,".t.$1"):e;function Ve(e){const a=F(e);return a.length?`<img src="${$(Ue(a[0]))}" alt="" loading="lazy">${a.length>1?`<span class="photo-count">${E.camera}${a.length}</span>`:""}`:`<div class="noimg">${E.tag}</div>`}async function ze(e){const a="/object/public/photos/",t=[...new Set(e)].filter(r=>r&&r.includes(a)&&decodeURIComponent(r.split(a)[1]).startsWith(`${g.user.id}/`));if(!t.length)return;const[n,o]=await Promise.all([f.from("items").select("photo_url,photos").eq("owner_id",g.user.id),f.from("sales").select("cover_url").eq("owner_id",g.user.id)]);if(n.error||o.error)return;const s=new Set([...n.data.flatMap(r=>[r.photo_url,...r.photos||[]]),...o.data.map(r=>r.cover_url)]),l=t.filter(r=>!s.has(r)).flatMap(r=>{const i=decodeURIComponent(r.split(a)[1]);return xe.test(i)?[i,i.replace(xe,".t.$1")]:[i]});l.length&&await f.storage.from("photos").remove(l).catch(()=>{})}const K={disponivel:"Disponível",reservado:"Reservado",vendido:"Vendido"},Se="id,title,type,region,lat,lng,starts_on,ends_on,start_time,end_time,cover_url,draft,items(count)";async function ya(e){const a=e.params,t=a.get("quando")||"fds";let n=a.has("regiao")?a.get("regiao"):localStorage.getItem("regiao")||"";const o=a.get("tipo")||"",s=a.get("perto")==="1"&&!!ie(),l=Oe.includes(Number(a.get("raio")))?Number(a.get("raio")):5,r=p=>{const A=new URLSearchParams({quando:t,regiao:n,tipo:o,...s?{perto:"1",raio:l}:{},...p});return A.get("perto")!=="1"&&(A.delete("perto"),A.delete("raio")),"#/?"+A.toString()};T.innerHTML=`
    <section class="hero">
      <h1>Vendas de garagem, bazares e mudanças perto de você</h1>
      <p>Um dia, um lugar, vários itens a preço de desapego.</p>
    </section>
    <div class="filters">
      <div class="seg">
        <a href="${r({quando:"fds"})}" class="${t==="fds"?"on":""}">Até domingo</a>
        <a href="${r({quando:"todas"})}" class="${t==="todas"?"on":""}">Próximas</a>
      </div>
      <select id="f-region" aria-label="Região administrativa">
        <option value="">Todo o DF</option>
        ${ne.map(p=>`<option ${p.name===n?"selected":""}>${$(p.name)}</option>`).join("")}
      </select>
      <div class="chips">
        <button type="button" class="chip chip-near ${s?"on":""}" id="near" aria-pressed="${s}">${E.pin}Perto de mim</button>
        <a href="${r({tipo:""})}" class="chip ${o?"":"on"}">Todas</a>
        ${Object.entries(G).map(([p,A])=>`<a href="${r({tipo:p})}" class="chip chip-${p} ${o===p?"on":""}">${A.short}</a>`).join("")}
      </div>
      ${s?`
        <div class="near-radius" role="group" aria-label="Distância máxima">
          <span>Até</span>
          ${Oe.map(p=>`<a href="${r({raio:p})}" class="chip ${p===l?"on":""}">${p} km</a>`).join("")}
        </div>`:""}
    </div>
    <div class="home-grid">
      <div id="home-map" class="map"></div>
      <div id="home-list">${He()}</div>
    </div>`,document.getElementById("f-region").addEventListener("change",p=>{localStorage.setItem("regiao",p.target.value),location.hash=r({regiao:p.target.value})}),document.getElementById("near").addEventListener("click",async p=>{if(s)return location.hash=r({perto:"0"});const A=p.currentTarget;A.disabled=!0;try{await $a(),location.hash=r({perto:"1",regiao:""})}catch(M){b(M.message,"error"),A.disabled=!1}});let i=f.from("sales").select(Se).eq("hidden",!1).eq("draft",!1).gte("ends_on",D()).order("starts_on").order("start_time").limit(200);t==="fds"&&(i=i.lte("starts_on",B(la()))),n&&(i=i.eq("region",n)),o&&(i=i.eq("type",o));const{data:d,error:c}=await i;if(!e.alive())return;if(c)throw c;const m=d.filter(p=>ve(p).key!=="encerrada"),u=s?ie():null,x=u?m.filter(p=>N(u,p)<=l).sort((p,A)=>N(u,p)-N(u,A)):m,h=he(n);let _=null;const k=(p,A=!0)=>{if(_)return p.fitBounds(_.getBounds(),{padding:[10,10],animate:A});const M=x.map(P=>[P.lat,P.lng]);M.length>1?p.fitBounds(M,{padding:[30,30],maxZoom:15,animate:A}):M.length===1?p.setView(M[0],15,{animate:A}):p.setView(h?[h.lat,h.lng]:st,h?14:11,{animate:A})},y=Be("home-map",u?[u.lat,u.lng]:h?[h.lat,h.lng]:st,u?13:h?14:11,{recenter:k});u&&(_=L.circle([u.lat,u.lng],{radius:l*1e3,color:"#1c7ed6",weight:1.5,fillOpacity:.06,interactive:!1}).addTo(y),L.marker([u.lat,u.lng],{icon:L.divIcon({className:"me-dot",html:"<span></span>",iconSize:[22,22],iconAnchor:[11,11]}),zIndexOffset:1e3,title:"Você está aqui"}).addTo(y).bindTooltip("Você está aqui"));for(const p of u?m:x)L.marker([p.lat,p.lng],{icon:Ee(p.type),opacity:u&&!x.includes(p)?.45:1}).addTo(y).bindPopup(`<a href="#/venda/${p.id}"><strong>${$(p.title)}</strong></a><br>${ye(p)}${u?`<br>a ${se(N(u,p))} de você`:""}`);k(y,!1);const q=document.getElementById("home-list");if(u&&!x.length){const p=Oe.find(M=>M>l&&m.some(P=>N(u,P)<=M)),A=m.reduce((M,P)=>!M||N(u,P)<N(u,M)?P:M,null);q.innerHTML=`
      <div class="empty">
        <h2>Nenhuma venda a até ${l} km de você ${t==="fds"?"até domingo":""}</h2>
        ${A?`<p>A mais perto fica a ${se(N(u,A))}, em ${$(A.region)}.</p>`:"<p>Ainda não há vendas marcadas com esses filtros.</p>"}
        ${p?`<a class="btn primary" href="${r({raio:p})}">Ver até ${p} km</a>`:""}
        ${t==="fds"?`<a class="btn" href="${r({quando:"todas"})}">Ver próximas datas</a>`:""}
      </div>`;return}if(!x.length){q.innerHTML=`
      <div class="empty">
        <h2>Nenhuma venda ${t==="fds"?"até domingo":"marcada"}${n?` em ${$(n)}`:""}</h2>
        <p>Vai fazer um bazar ou vender as coisas da mudança? Anunciar é grátis.</p>
        <a class="btn primary" href="#/anunciar">Anunciar uma venda</a>
        ${t==="fds"?`<a class="btn" href="${r({quando:"todas"})}">Ver próximas datas</a>`:""}
      </div>`;return}const C=x.filter(p=>ve(p).key==="agora"),I=!o&&!u?x.filter(p=>p.type==="mudanca"&&!C.includes(p)):[],w=(p,A,M="")=>`<h2 class="section-title">${p}</h2>${M?`<p class="hint">${M}</p>`:""}<div class="cards strip">${A.map(te).join("")}</div>`;let v;if(t==="fds"&&!u){const p=new Map;for(const A of x.filter(M=>!C.includes(M))){const M=A.starts_on>D()?A.starts_on:D();p.has(M)||p.set(M,[]),p.get(M).push(A)}v=[...p].sort(([A],[M])=>A.localeCompare(M)).map(([A,M])=>w(ia(A),M)).join("")}else{const p=u?"Mais perto de você":C.length||I.length?"Todas as vendas":"";v=`${p?`<h2 class="section-title">${p}</h2>`:""}<div class="cards">${x.map(te).join("")}</div>`}const S=u&&x[0];q.innerHTML=`
    ${u?`<p class="near-summary">${x.length} venda${x.length===1?"":"s"} a até ${l} km de você · a mais perto fica a <strong>${se(N(u,S))}</strong>, em ${$(S.region)}.</p>`:""}
    ${C.length?`
      <h2 class="section-title"><span class="live-dot"></span>Acontecendo agora${u?" perto de você":""}</h2>
      <div class="cards strip">${C.map(te).join("")}</div>`:""}
    ${I.length?w("Em destaque: vendas de mudança",I,"Quem se muda vende quase tudo, e rápido."):""}
    ${v}`}async function wa(e){const a=(e.params.get("q")||"").trim(),t=e.params.get("cat")||"";T.innerHTML=`
    <form id="search-form" class="search-form">
      <input type="search" name="q" value="${$(a)}" placeholder="Ex.: sofá, bicicleta, berço" autocomplete="off" enterkeyhint="search">
      <select name="cat" aria-label="Categoria">
        <option value="">Todas as categorias</option>
        ${Object.entries(z).map(([c,m])=>`<option value="${c}" ${c===t?"selected":""}>${m}</option>`).join("")}
      </select>
      <button class="btn primary">Buscar</button>
    </form>
    <div id="results"></div>`;const n=document.getElementById("search-form");if(n.addEventListener("submit",c=>{c.preventDefault();const m=new FormData(n);j(`/buscar?${new URLSearchParams({q:m.get("q").trim(),cat:m.get("cat")})}`)}),a||n.q.focus(),!a&&!t){document.getElementById("results").innerHTML='<p class="hint center">Procure itens em todas as vendas que ainda vão acontecer.</p>';return}const o=a.replace(/[%,()*\\]/g," ").trim(),s=document.getElementById("results");s.innerHTML=He(3);let l=f.from("items").select("id,title,price,category,photo_url,photos,status,sales!inner(id,title,region,starts_on,ends_on,start_time,end_time,hidden,draft,photos_only)").gte("sales.ends_on",D()).eq("sales.hidden",!1).eq("sales.draft",!1).neq("status","vendido").order("created_at",{ascending:!1}).limit(60);o&&(l=l.or(`title.ilike.%${o}%,description.ilike.%${o}%`)),t&&(l=l.eq("category",t));const r=o?f.from("sales").select(Se).eq("hidden",!1).eq("draft",!1).gte("ends_on",D()).or(`title.ilike.%${o}%,description.ilike.%${o}%`).order("starts_on").limit(30):Promise.resolve({data:[]}),[i,d]=await Promise.all([l,r]);if(e.alive()){if(i.error)throw i.error;if(d.error)throw d.error;if(!i.data.length&&!d.data.length){s.innerHTML='<div class="empty"><h2>Nada encontrado</h2><p>Tente outra palavra ou outra categoria.</p></div>';return}s.innerHTML=`
    ${i.data.length?`
      <h2 class="section-title">Itens (${i.data.length})</h2>
      <div class="items-grid">
        ${i.data.map(c=>`
          <a class="item status-${c.status}" href="#/venda/${c.sales.id}">
            <div class="photo">${Ve(c)}${c.status!=="disponivel"?`<span class="status-tag">${K[c.status]}</span>`:""}</div>
            <div class="info">
              <strong>${c.sales.photos_only?"Pergunte o preço":Q(c.price)}</strong>
              <span class="title">${$(c.sales.photos_only?c.sales.title:ce(c))}</span>
              <small>${$(c.sales.region)} · ${be(c.sales.starts_on)}</small>
            </div>
          </a>`).join("")}
      </div>`:""}
    ${d.data.length?`<h2 class="section-title">Vendas</h2><div class="cards">${d.data.map(te).join("")}</div>`:""}`}}async function _a(e,a){T.innerHTML=`
    <div class="sale skeleton-page" aria-busy="true" aria-label="Carregando venda">
      <div class="sk sk-cover"></div><div class="sk sk-line w40"></div><div class="sk sk-title"></div>
      <div class="sk sk-line w70"></div><div class="sk sk-line w60"></div>
      <div class="sk-row"><div class="sk sk-btn"></div><div class="sk sk-btn"></div><div class="sk sk-btn"></div></div>
    </div>`;const{data:t,error:n}=await f.from("sales").select("*, owner:profiles!sales_owner_id_fkey(id,name,chat_enabled), items(*)").eq("id",a).maybeSingle();if(!e.alive())return;if(n)throw n;if(!t){T.innerHTML='<div class="empty"><h2>Venda não encontrada</h2><p>Ela pode ter sido removida pelo vendedor.</p><a class="btn" href="#/">Ver outras vendas</a></div>';return}const o=g.user?.id===t.owner_id,s=!!t.photos_only,r=ve(t).key==="encerrada",i=ie(),d={disponivel:0,reservado:1,vendido:2},c=()=>t.items.sort((v,S)=>d[v.status]-d[S.status]||S.created_at.localeCompare(v.created_at));c();const m=G[t.type],u=ma(t);document.title=`${t.title} — ${R.APP_NAME}`,T.innerHTML=`
    <article class="sale">
      ${t.cover_url?`<div class="cover" style="background-image:url('${$(t.cover_url)}')"></div>`:""}
      <div class="sale-head">
        <div class="badges">
          <span class="badge type-${t.type}">${m.label}</span>
          ${r?'<span class="badge muted">Encerrada</span>':xt(t)}
          ${t.hidden?'<span class="badge danger">Oculta pela moderação</span>':""}
          ${t.draft?'<span class="badge draft">Rascunho</span>':""}
        </div>
        <h1>${$(t.title)}</h1>
        <p class="meta big">${E.clock}${ye(t)}</p>
        <p class="meta big">${E.pin}${$(t.region)}${t.address?` · ${$(t.address)}`:""}${i?` · <strong>a ${se(N(i,t))} de você</strong>`:""}</p>
        ${t.reference?`<p class="reference">Referência: ${$(t.reference)}</p>`:""}
        <p class="meta">Por ${$(t.owner?.name||"vendedor")}</p>
      </div>

      <div class="actions">
        ${o?"":`<button class="btn whatsapp" data-act="contact" id="wa-btn" hidden>${E.whatsapp}Falar no WhatsApp</button>`}
        <a class="btn" href="${u.google}" target="_blank" rel="noopener">Rota no Google Maps</a>
        <a class="btn" href="${u.waze}" target="_blank" rel="noopener">Rota no Waze</a>
        <button class="btn" data-act="share">${E.share}Compartilhar</button>
        ${r?"":`<button class="btn" data-act="calendar">${E.calendar}Adicionar à agenda</button>`}
        ${o?"":`<button class="btn fav ${g.favorites.has(t.id)?"on":""}" data-act="fav">${E.heart}<span>${g.favorites.has(t.id)?"Salva":"Salvar"}</span></button>`}
      </div>
      ${!o&&t.owner?.chat_enabled===!1&&!r?`<p class="notice only-promo">${E.pin}<span>Este vendedor só está divulgando a venda e não recebe mensagens pelo app. Os itens estão à venda no local, no dia e horário acima.</span></p>`:""}

      ${o&&t.draft?`
        <div class="draft-bar">
          <strong>Rascunho: só você vê esta venda.</strong>
          <p>${s?"Adicione as fotos dos itens e publique.":"Cadastre os itens, confira os preços (principalmente os sugeridos pela IA) e publique."} O link e o cartaz só funcionam depois de publicar.</p>
          <button class="btn primary" data-act="publish">${s?"Publicar venda":"Revisar preços e publicar"}</button>
        </div>`:""}

      ${g.moderator&&!o?`
        <div class="mod-bar">
          <strong>Moderação</strong>
          <div id="mod-reports" class="hint">Carregando denúncias…</div>
          ${t.hidden?'<button class="btn small primary" data-act="mod-show">Reexibir venda</button><button class="btn small" data-act="mod-hide">Manter oculta</button>':'<button class="btn small danger" data-act="mod-hide">Ocultar venda</button>'}
        </div>`:""}

      ${o?`
        <div class="owner-bar">
          <strong>${r?"Esta venda já acabou. Vai fazer outra? Duplique e aproveite os itens que sobraram.":"Esta venda é sua."}</strong>
          ${r?`<p class="hint">${qa(t)}</p>`:""}
          ${g.profile?.chat_enabled===!1?'<p class="hint">Seu chat está desligado: compradores não mandam mensagens. Dá para religar em <a href="#/perfil">Perfil</a>.</p>':""}
          ${r?'<button class="btn small primary" data-act="duplicate">Duplicar para nova data</button>':""}
          <a class="btn small" href="#/venda/${t.id}/cartaz">Cartaz com QR Code</a>
          <a class="btn small" href="#/venda/${t.id}/editar">Editar venda</a>
          ${r?"":'<button class="btn small" data-act="duplicate">Duplicar</button>'}
          <button class="btn small danger" data-act="delete-sale">Excluir</button>
        </div>`:""}

      ${t.description?`<p class="description">${$(t.description).replace(/\n/g,"<br>")}</p>`:""}
      <div id="sale-map" class="map small"></div>

      ${o&&s?`
        <section class="quick-add">
          <h2>Adicionar fotos</h2>
          ${e.params.has("novo")?'<p class="hint">Venda criada como rascunho! Agora tire as fotos dos itens. Quando terminar, toque em "Publicar".</p>':""}
          ${e.params.has("duplicada")?'<p class="hint">Venda duplicada como rascunho! Remova as fotos do que não vai levar, adicione as novidades e publique.</p>':""}
          <label class="btn primary photo-only-add">${E.camera}<span>Adicionar fotos</span><input type="file" id="photo-only-input" accept="image/*" multiple hidden></label>
          <p class="hint">Cada foto vira um item, sem precisar escrever nada. Toque numa foto para marcar como reservada ou vendida, ou para remover.</p>
          <div id="photo-uploads" class="photo-grid"></div>
          <p class="hint">${Lt}</p>
        </section>`:""}

      ${o&&!s?`
        <section class="quick-add">
          <h2>Cadastrar itens</h2>
          ${e.params.has("novo")?'<p class="hint">Venda criada como rascunho! Agora fotografe e cadastre os itens. Quando terminar, revise os preços e toque em "Publicar".</p>':""}
          ${e.params.has("duplicada")?'<p class="hint">Venda duplicada como rascunho! Confira os itens, remova o que não vai levar, cadastre as novidades e publique.</p>':""}
          <form id="item-form">
            <label class="photo-pick">
              <input type="file" name="photo" accept="image/*" multiple hidden>
              <span class="ph">${E.camera}Fotos</span>
              <img alt="" hidden>
              <span class="photo-count" hidden></span>
            </label>
            <div class="fields">
              <input name="title" placeholder="O que é? Ex.: Sofá 3 lugares" required maxlength="120">
              <div class="row">
                <input name="price" inputmode="decimal" placeholder="Preço (R$)">
                <select name="category">
                  ${Object.entries(z).map(([v,S])=>`<option value="${v}">${S}</option>`).join("")}
                </select>
              </div>
              <textarea name="description" rows="2" maxlength="1000" placeholder="Descrição (opcional): estado, marca, medidas…"></textarea>
              <p class="hint ai-hint" hidden></p>
              <button class="btn primary">Salvar e adicionar outro</button>
            </div>
          </form>
          <button type="button" class="btn batch-open" data-act="batch">${E.camera}Vários itens de uma vez (fotos em lote)</button>
          <p class="hint">${Lt}</p>
        </section>`:""}

      <section>
        <h2 class="section-title" id="items-title"></h2>
        ${s&&!o?`<p class="hint">Preços: ${t.owner?.chat_enabled===!1?"veja no local":"pergunte no chat ou veja no local"}.</p>`:""}
        <div id="items" class="${s?"photo-grid":"items-grid"}"></div>
      </section>

      ${o?"":`
        <div class="report-links">
          <button class="link" data-act="report-sale">${E.flag}Denunciar anúncio</button>
          <button class="link" data-act="report-user">${E.flag}Denunciar vendedor</button>
        </div>`}
    </article>`;const x=Be("sale-map",[t.lat,t.lng],16);L.marker([t.lat,t.lng],{icon:Ee(t.type)}).addTo(x);let h=!1;const _=t.owner?.chat_enabled!==!1,k=v=>v.status==="disponivel"&&!r?`${_?`<button class="btn small primary" data-act="interest">${E.chat}Tenho interesse</button>`:""}
         ${h&&Number(v.price)>0?`<button class="btn small pix" data-act="pix">${E.pix}Pagar com Pix</button>`:""}`:"",y=()=>{const v=t.items.filter(p=>p.status==="disponivel").length,S=t.items.length;if(document.getElementById("items-title").textContent=S?s?`Itens (${S} foto${S===1?"":"s"}${v<S?`, ${v} disponíve${v===1?"l":"is"}`:""})`:`Itens (${v} disponíve${v===1?"l":"is"} de ${S})`:o?"Nenhum item cadastrado ainda":"O vendedor ainda não cadastrou itens",s){document.getElementById("items").innerHTML=t.items.map(p=>`
          <div class="item photo-tile status-${p.status}" data-id="${p.id}">
            <button class="photo" data-act="view-item" aria-label="Ver foto ${t.items.indexOf(p)+1}">${Ve(p)}${p.status!=="disponivel"?`<span class="status-tag">${K[p.status]}</span>`:""}</button>
          </div>`).join("");return}document.getElementById("items").innerHTML=t.items.map(p=>`
        <div class="item status-${p.status}" data-id="${p.id}">
          <button class="photo" data-act="view-item" aria-label="Ver fotos de ${$(ce(p))}">${Ve(p)}${p.status!=="disponivel"?`<span class="status-tag">${K[p.status]}</span>`:""}</button>
          <div class="info">
            <strong>${Q(p.price)}${o&&p.ai_price?' <span class="ai-price" title="Preço sugerido pela IA, ainda não revisado">IA</span>':""}</strong>
            <span class="title">${$(ce(p))}</span>
            <small>${z[p.category]||""}</small>
            ${o?`<div class="status-toggle">
                  ${Object.entries(K).map(([A,M])=>`<button data-act="status" data-status="${A}" class="${p.status===A?"on":""}">${M}</button>`).join("")}
                </div>
                <div class="item-links">
                  <button class="link" data-act="edit-item">Editar</button>
                  <button class="link danger" data-act="delete-item">Remover</button>
                </div>`:k(p)}
          </div>
        </div>`).join("")};y(),!o&&!r&&f.rpc("sale_has_pix",{p_sale:t.id}).then(({data:v})=>{v&&e.alive()&&(h=!0,y())}),o||f.rpc("sale_has_whatsapp",{p_sale:t.id}).then(({data:v})=>{v&&e.alive()&&(document.getElementById("wa-btn").hidden=!1)});const q=(v,S)=>Ka(t,v,S),C=async v=>{if(!V(`/venda/${t.id}`,"Entre para falar com o vendedor."))return;const{data:S,error:p}=await f.rpc("get_sale_whatsapp",{p_sale:t.id});if(p)return b(qt(p),"error",p);if(!S)return b("O vendedor não informou um WhatsApp.","error");window.open(`https://wa.me/${S}?text=${encodeURIComponent(v)}`,"_blank","noopener")},I=async(v,S)=>{const p=v.status;v.status=S,c(),y();const{error:A}=await f.from("items").update({status:S}).eq("id",v.id);A&&(v.status=p,c(),y(),b("Não foi possível atualizar o item.","error",A))},w=async(v,S)=>{if(v==="interest")q(S,"Olá! Tenho interesse. Ainda está disponível?");else if(v==="pix"){if(!V(`/venda/${t.id}`,"Entre para pagar com Pix."))return;Pa(t,S,p=>q(S,p))}else if(v==="edit-item")Ia(t,S,()=>{c(),y()});else if(v.startsWith("status:"))I(S,v.slice(7));else if(v==="delete-item"){if(!confirm(s?"Remover esta foto?":`Remover "${ce(S)}"?`))return;const{error:p}=await f.from("items").delete().eq("id",S.id);if(p)return b(p.message,"error",p);ze(F(S).filter(A=>A!==t.cover_url)),t.items=t.items.filter(A=>A!==S),y()}};T.onclick=async v=>{const S=v.target.closest("[data-act]");if(!S)return;const p=S.dataset.act,A=S.closest(".item"),M=A&&t.items.find(P=>P.id===A.dataset.id);if(p==="contact")C(`Olá! Vi sua venda "${t.title}" no ${R.APP_NAME}: ${_e(t.id)}`);else if(p==="interest")w(p,M);else if(p==="share")Wa(t);else if(p==="fav"){if(!V(`/venda/${t.id}`,"Entre para salvar vendas."))return;const P=await Oa(t.id);S.classList.toggle("on",P),S.querySelector("span").textContent=P?"Salva":"Salvar",P&&!za()&&!Mt()&&rt("favorite")}else if(p==="status")I(M,S.dataset.status);else if(p==="view-item")Ta(t,M,{isOwner:o,ended:r,hasPix:h,chatOn:_,photosOnly:s,onAction:P=>w(P,M)});else if(["edit-item","pix","delete-item"].includes(p))w(p,M);else if(p==="publish")Aa(t,()=>O());else if(p==="delete-sale"){if(!confirm("Excluir esta venda e todos os itens? Isso não pode ser desfeito."))return;const{error:P}=await f.from("sales").delete().eq("id",t.id);if(P)return b(P.message,"error",P);ze([t.cover_url,...t.items.flatMap(F)]),b("Venda excluída."),j("/minhas")}else if(p==="batch")Ma(t,()=>{c(),y()});else if(p==="duplicate")Na(t);else if(p==="calendar")Da(t);else if(p==="report-sale"||p==="report-user"){if(!V(`/venda/${t.id}`,"Entre para enviar uma denúncia."))return;Pt(p==="report-sale"?{sale_id:t.id}:{sale_id:t.id,reported_user_id:t.owner_id},p==="report-sale"?"anúncio":"vendedor")}else if(p==="mod-show"||p==="mod-hide"){const P=p==="mod-show";if(!P&&!t.hidden&&!confirm("Ocultar esta venda? O vendedor será avisado."))return;S.disabled=!0;const{error:Te}=await f.rpc("moderate_sale",{p_sale:t.id,p_show:P});if(Te)return S.disabled=!1,b(Te.message,"error",Te);b(P?"Venda de volta ao ar. O vendedor foi avisado.":"Venda oculta. As denúncias foram aceitas."),O()}},Z.push(()=>T.onclick=null),g.moderator&&!o&&Xa(t.id),o&&s?Ea(t,y,c):o?Sa(t,y,c):rt("view-sale")}function Ea(e,a,t){const n=document.getElementById("photo-only-input"),o=document.getElementById("photo-uploads");n.addEventListener("change",async()=>{const s=[...n.files].slice(0,le);if(n.files.length>le&&b(`Até ${le} fotos por vez. Envie estas e depois as outras.`),n.value="",!s.length)return;const l=s.map(()=>{const i=document.createElement("div");return i.className="photo-tile uploading",i.innerHTML="<span>Enviando…</span>",o.append(i),i});let r=0;await Le(s,3,async(i,d)=>{try{const c=await me(i),{data:m,error:u}=await f.from("items").insert({sale_id:e.id,title:null,category:"outros",photo_url:c,photos:[c]}).select().single();if(u)throw u;e.items.unshift(m),e.cover_url||(e.cover_url=c,await f.from("sales").update({cover_url:c}).eq("id",e.id)),l[d].remove(),t(),a(),xa(m,i)}catch(c){r++,l[d].classList.replace("uploading","failed"),l[d].innerHTML="<span>Não enviou</span>",console.warn(c)}}),r&&b(`${r} foto${r===1?"":"s"} não ${r===1?"foi enviada":"foram enviadas"}. Tente de novo.`,"error")})}async function xa(e,a){const t=await St(a).catch(()=>null),n=t?.title?.trim().slice(0,120);if(!n||n.length<2)return;const o={title:n,category:z[t.category]?t.category:e.category},{error:s}=await f.from("items").update(o).eq("id",e.id);s||Object.assign(e,o)}function Sa(e,a,t){const n=document.getElementById("item-form"),o=n.photo,s=n.querySelector(".photo-pick img"),l=n.querySelector(".photo-pick .ph"),r=n.querySelector(".photo-pick .photo-count"),i=n.querySelector(".ai-hint");let d=localStorage.getItem("ultima-categoria")||"outros";n.category.value=d,n.category.addEventListener("change",()=>n.category.dataset.touched="1");let c=[];o.addEventListener("change",async()=>{c=[...o.files].slice(0,J),o.files.length>J&&b(`Até ${J} fotos por item. Usei as primeiras ${J}.`),r.hidden=c.length<2,r.textContent=`+${c.length-1}`,c[0]&&Bt(c[0],s,l),c.slice(1).forEach(m=>ue(m)&&pe(m)),c[0]&&Fe(n,c[0],i,()=>c[0])}),n.addEventListener("submit",async m=>{m.preventDefault();const u=n.querySelector("button");u.disabled=!0,u.textContent=c.length>1?`Enviando ${c.length} fotos…`:"Salvando…";try{const x=await Promise.all(c.map(me)),h=x[0]||null,_={sale_id:e.id,title:n.title.value.trim(),price:re(n.price.value),ai_price:We(n),category:n.category.value,description:n.description.value.trim()||null,photo_url:h,photos:x},{data:k,error:y}=await f.from("items").insert(_).select().single();if(y)throw y;e.items.unshift(k),t(),a(),h&&!e.cover_url&&(e.cover_url=h,await f.from("sales").update({cover_url:h}).eq("id",e.id)),localStorage.setItem("ultima-categoria",_.category),n.reset(),delete n.price.dataset.ai,c=[],n.category.value=_.category,s.hidden=!0,r.hidden=!0,l.hidden=!1,i.hidden=!0,delete n.category.dataset.touched,n.title.focus(),b("Item salvo!")}catch(x){b(x.message||"Erro ao salvar o item.","error",x)}finally{u.disabled=!1,u.textContent="Salvar e adicionar outro"}})}let ae=null;const La=e=>new Promise((a,t)=>{const n=new FileReader;n.onload=()=>a(String(n.result).split(",")[1]),n.onerror=t,n.readAsDataURL(e)});async function St(e){if(ae===!1)return null;let a=await de(e,768,.75,"image/jpeg").catch(()=>null);if(!a&&ue(e)){const o=await pe(e);a=o&&await de(o,768,.75,"image/jpeg").catch(()=>null)}if(!a)return null;const{data:t,error:n}=await f.functions.invoke("descrever-item",{body:{image:await La(a),categories:z}});if(n){const o=n.context?.status;if(!o||o===404||o===503)return ae=!1,null;let s="";try{s=(await n.context.json()).error}catch{}throw new Error(s||"A IA não conseguiu analisar a foto.")}return ae=!0,t}function ka(e,a){a.title&&!e.title.value.trim()&&(e.title.value=a.title),a.description&&!e.description.value.trim()&&(e.description.value=a.description),a.category&&z[a.category]&&e.category.dataset.touched!=="1"&&(e.category.value=a.category),a.price!=null&&!e.price.value.trim()&&(e.price.value=String(a.price),e.price.dataset.ai=e.price.value)}const We=e=>!!e.price.dataset.ai&&e.price.value.trim()===e.price.dataset.ai;async function Fe(e,a,t,n){if(ae!==!1){t.hidden=!1,t.classList.add("working"),t.textContent="✨ Descrevendo a foto com IA…";try{const o=await St(a);if(n()!==a)return;if(t.classList.remove("working"),!o)return void(t.hidden=!0);ka(e,o),t.textContent="✨ Preenchido pela IA. Confira título, preço e categoria antes de salvar."}catch(o){if(n()!==a)return;t.classList.remove("working"),t.textContent=o.message}}}async function Le(e,a,t){const n=[];let o=0;const s=async()=>{for(;o<e.length;){const l=o++;n[l]=await t(e[l],l)}};return await Promise.all(Array.from({length:Math.min(a,e.length)},s)),n}const le=30,ke=30,Lt=`As fotos ficam guardadas até ${ke} dias depois do fim da venda e depois são apagadas automaticamente. A venda e os itens continuam no seu histórico; ao duplicar a venda, as fotos dos itens copiados ficam.`;function qa(e){const a=n=>Date.UTC(...n.split("-").map((o,s)=>Number(o)-(s===1?1:0)))/864e5,t=a(e.ends_on)+ke+1-a(D());return t<=0?`As fotos desta venda foram apagadas ${ke} dias depois do fim, como acontece com todas as vendas encerradas.`:`As fotos desta venda serão apagadas ${t===1?"amanhã cedo":`em ${t} dias`} (${ke} dias depois do fim). Duplique a venda para continuar usando as fotos dos itens que sobraram.`}function Aa(e,a){const t=e.photos_only?[]:e.items.filter(i=>i.status!=="vendido"),n=t.filter(i=>i.ai_price).length,o=e.items.length,{el:s,close:l}=H(`
    <h2>${e.photos_only?"Publicar venda":"Revisar preços e publicar"}</h2>
    ${e.photos_only?`<p class="hint">${o?`Venda só com fotos: <strong>${o} foto${o===1?"":"s"}</strong>. Confira se está tudo certo e publique.`:"Você ainda não adicionou fotos. Dá para publicar assim e adicionar depois, mas vendas com fotos atraem bem mais gente."}</p>`:t.length?`<p class="hint">${n?`<strong>${n} preço${n===1?"":"s"} sugerido${n===1?"":"s"} pela IA</strong> (marcados com IA). `:""}Confira cada valor: a IA erra, principalmente em itens usados ou de marca.</p>`:'<p class="hint">Você ainda não cadastrou itens. Dá para publicar assim e cadastrar depois, mas vendas com fotos e preços atraem bem mais gente.</p>'}
    <form id="publish-form">
      <div class="review-list">
        ${t.map(i=>`
          <label class="review-row ${i.ai_price?"ai":""}">
            <span class="review-thumb">${et(F(i)[0])}</span>
            <span class="review-title">${$(i.title)}${i.ai_price?' <span class="ai-price">IA</span>':""}</span>
            <input name="p-${i.id}" inputmode="decimal" value="${i.price==null?"":$(String(Number(i.price)).replace(".",","))}" placeholder="R$" aria-label="Preço de ${$(i.title)}">
          </label>`).join("")}
      </div>
      ${t.length?'<label class="check"><input type="checkbox" name="ok" required> Revisei todos os preços</label>':""}
      <div class="actions">
        <button type="button" class="btn" data-close>Voltar</button>
        <button class="btn primary">Publicar venda</button>
      </div>
    </form>`,"publish-modal",{keep:!0}),r=s.querySelector("form");r.addEventListener("submit",async i=>{i.preventDefault();const d=r.querySelector("button.primary");d.disabled=!0,d.textContent="Publicando…";try{const c=t.map(u=>({it:u,price:re(r[`p-${u.id}`].value)})).filter(({it:u,price:x})=>x!==(u.price==null?null:Number(u.price)));await Le(c,3,async({it:u,price:x})=>{const{error:h}=await f.from("items").update({price:x,ai_price:!1}).eq("id",u.id);if(h)throw new Error(`Erro ao salvar o preço de "${u.title}": ${h.message}`);u.price=x});const{error:m}=await f.rpc("publish_sale",{p_sale:e.id});if(m)throw De("Não foi possível publicar",m);e.draft=!1,e.items.forEach(u=>u.ai_price=!1),l(),b("Venda publicada! Agora é só compartilhar o link."),a()}catch(c){b(c.message,"error",we(c)),d.disabled=!1,d.textContent="Publicar venda"}})}function Ma(e,a){const t=[],n=localStorage.getItem("ultima-categoria")||"outros",{el:o,close:s}=H(`
    <h2>Cadastrar em lote</h2>
    <p class="hint">Escolha várias fotos de uma vez: <strong>cada foto vira um item</strong>. ${ae===!1?"":"A IA sugere título, descrição, categoria e preço, e você só confere."} Depois dá para juntar mais fotos num item, em "Editar".</p>
    <label class="btn batch-pick">${E.camera}<span>Escolher fotos</span><input type="file" accept="image/*" multiple hidden></label>
    <div class="batch-list"></div>
    <div class="actions batch-actions">
      <button class="btn primary" data-save disabled>Salvar itens</button>
      <button class="btn" data-close>Cancelar</button>
    </div>`,"batch",{keep:!0}),l=o.querySelector(".batch-list"),r=o.querySelector("[data-save]"),i=()=>t.filter(c=>!c.removed),d=()=>{const c=i().length;r.disabled=!c,r.textContent=c?`Salvar ${c} ${c===1?"item":"itens"}`:"Salvar itens",o.querySelector(".batch-pick span").textContent=c?"Adicionar mais fotos":"Escolher fotos"};o.querySelector(".batch-pick input").addEventListener("change",c=>{const m=le-i().length,u=[...c.target.files].slice(0,m);c.target.files.length>m&&b(`Até ${le} fotos por lote. Salve estas e faça outro lote.`),c.target.value="";const x=u.map(h=>{const _={file:h};_.el=document.createElement("div"),_.el.className="batch-row",_.el.innerHTML=`
        <img class="batch-thumb" alt="">
        <div class="batch-fields">
          <input name="title" placeholder="O que é?" maxlength="120" aria-label="Título">
          <div class="row">
            <input name="price" inputmode="decimal" placeholder="Preço (R$)" aria-label="Preço">
            <select name="category" aria-label="Categoria">${Object.entries(z).map(([y,q])=>`<option value="${y}" ${y===n?"selected":""}>${q}</option>`).join("")}</select>
          </div>
          <textarea name="description" rows="2" maxlength="1000" placeholder="Descrição (opcional)" aria-label="Descrição"></textarea>
          <small class="hint ai-hint" hidden></small>
        </div>
        <button type="button" class="rm" aria-label="Tirar esta foto do lote">&times;</button>`;const k=y=>_.el.querySelector(`[name=${y}]`);return _.f={title:k("title"),price:k("price"),category:k("category"),description:k("description")},_.f.category.addEventListener("change",()=>_.f.category.dataset.touched="1"),kt(_.el.querySelector("img"),h),_.el.querySelector(".rm").onclick=()=>{_.removed=!0,_.el.remove(),d()},l.append(_.el),t.push(_),_});d(),Le(x,3,h=>h.removed?null:Fe(h.f,h.file,h.el.querySelector(".ai-hint"),()=>h.file))}),r.onclick=async()=>{const c=i(),m=c.find(h=>!h.f.title.value.trim());if(m)return m.f.title.focus(),b("Dê um título para todos os itens (ou tire a foto do lote).","error");r.disabled=!0;let u=c.filter(h=>h.url).length;const x=()=>r.textContent=`Enviando fotos… ${u} de ${c.length}`;x();try{await Le(c,3,async k=>{k.url||(k.url=await me(k.file),u++,x())}),r.textContent="Salvando itens…";const{data:h,error:_}=await f.from("items").insert(c.map(k=>({sale_id:e.id,title:k.f.title.value.trim(),price:re(k.f.price.value),ai_price:We(k.f),category:k.f.category.value,description:k.f.description.value.trim()||null,photo_url:k.url,photos:[k.url]}))).select();if(_)throw new Error(`Erro ao salvar os itens: ${_.message}`);e.items.unshift(...h),!e.cover_url&&h[0]?.photo_url&&(e.cover_url=h[0].photo_url,await f.from("sales").update({cover_url:e.cover_url}).eq("id",e.id)),s(),a(),b(`${h.length} ${h.length===1?"item cadastrado":"itens cadastrados"}!`)}catch(h){b(h.message||"Erro ao salvar os itens.","error",h),d()}}}function Ta(e,a,{isOwner:t,ended:n,hasPix:o,chatOn:s=!0,photosOnly:l=!1,onAction:r}){const i=F(a),d=!t&&a.status==="disponivel"&&!n,{el:c,close:m}=H(`
    ${i.length?`
      <div class="gallery">${i.map((h,_)=>`<img src="${$(h)}" alt="" decoding="async"${_?' loading="lazy"':""}>`).join("")}</div>
      ${i.length>1?`<div class="dots">${i.map((h,_)=>`<span class="${_===0?"on":""}"></span>`).join("")}</div>`:""}`:""}
    ${l?`<p class="meta">${a.status!=="disponivel"?`<strong>${K[a.status]}</strong> · `:""}${s?"Pergunte o preço no chat ou veja no local.":"Veja o preço no local."}</p>`:`<div>
      <strong class="price">${Q(a.price)}</strong>
      <h2>${$(ce(a))}</h2>
      <p class="meta">${z[a.category]||""}${a.status!=="disponivel"?` · ${K[a.status]}`:""}</p>
      ${a.description?`<p class="item-desc">${$(a.description).replace(/\n/g,"<br>")}</p>`:""}
    </div>`}
    ${t&&l?`
      <div class="status-toggle" role="group" aria-label="Situação">
        ${Object.entries(K).map(([h,_])=>`<button data-a="status:${h}" class="${a.status===h?"on":""}">${_}</button>`).join("")}
      </div>`:""}
    <div class="actions">
      ${d&&s?`<button class="btn primary" data-a="interest">${E.chat}Tenho interesse: conversar</button>`:""}
      ${d&&o&&!l&&Number(a.price)>0?`<button class="btn pix" data-a="pix">${E.pix}Pagar com Pix</button>`:""}
      ${t&&!l?'<button class="btn" data-a="edit-item">Editar item</button>':""}
      ${t&&l?'<button class="btn danger" data-a="delete-item">Remover foto</button>':""}
      <button class="btn" data-close>Fechar</button>
    </div>`,"viewer"),u=c.querySelector(".gallery"),x=c.querySelectorAll(".dots span");u&&x.length&&u.addEventListener("scroll",()=>{const h=Math.round(u.scrollLeft/u.clientWidth);x.forEach((_,k)=>_.classList.toggle("on",h===k))}),u&&Ca(u),c.querySelectorAll("[data-a]").forEach(h=>h.onclick=()=>{m(),r(h.dataset.a)})}function Ca(e){e.classList.add("pode-zoom"),e.querySelectorAll("img").forEach(w=>w.draggable=!1);let n=null,o=1,s=0,l=0,r=null,i=null,d=null,c=null,m=0;const u=(w,v)=>{const S=e.getBoundingClientRect();return{x:w-(S.left+S.width/2),y:v-(S.top+S.height/2)}},x=()=>{const w=n.clientWidth*(o-1)/2,v=n.clientHeight*(o-1)/2;s=Math.min(w,Math.max(-w,s)),l=Math.min(v,Math.max(-v,l))},h=w=>{n.style.transition=w?"transform .2s ease":"",n.style.transform=o>1?`translate(${s}px, ${l}px) scale(${o})`:"",e.classList.toggle("zoomed",o>1)},_=w=>{n&&(o=1,s=0,l=0,h(w))},k=(w,v,S={s:o,x:s,y:l})=>{const p=(w.x-S.x)/S.s,A=(w.y-S.y)/S.s;o=Math.min(4,Math.max(1*.8,v)),s=w.x-o*p,l=w.y-o*A},y=w=>{const v=w&&w.closest&&w.closest("img");return v&&v!==n&&(_(!1),n=v),n},q=(w,v)=>{if(o>1)return _(!0);k(u(w,v),2),x(),h(!0)},C=(w,v)=>Math.hypot(w.clientX-v.clientX,w.clientY-v.clientY),I=(w,v)=>u((w.clientX+v.clientX)/2,(w.clientY+v.clientY)/2);["gesturestart","gesturechange"].forEach(w=>e.addEventListener(w,v=>v.preventDefault(),{passive:!1})),e.addEventListener("touchstart",w=>{if(y(w.target)){if(w.touches.length===2){const[v,S]=w.touches;r={d:C(v,S),m:I(v,S),s:o,x:s,y:l},i=null,d=null}else if(w.touches.length===1){const v=w.touches[0];d={x:v.clientX,y:v.clientY,at:Date.now()},i=o>1?{cx:v.clientX,cy:v.clientY,x:s,y:l}:null}}},{passive:!0}),e.addEventListener("touchmove",w=>{if(r&&w.touches.length===2){w.preventDefault();const[v,S]=w.touches,p=I(v,S);k(r.m,r.s*(C(v,S)/r.d),r),s+=p.x-r.m.x,l+=p.y-r.m.y,h(!1)}else if(i&&w.touches.length===1){w.preventDefault();const v=w.touches[0];s=i.x+v.clientX-i.cx,l=i.y+v.clientY-i.cy,x(),h(!1)}d&&w.touches.length===1&&Math.hypot(w.touches[0].clientX-d.x,w.touches[0].clientY-d.y)>10&&(d=null)},{passive:!1}),e.addEventListener("touchend",w=>{if(m=Date.now(),r&&w.touches.length<2){r=null,o<1.05?_(!0):(x(),h(!0));const v=w.touches[0];i=v&&o>1?{cx:v.clientX,cy:v.clientY,x:s,y:l}:null;return}w.touches.length||(i=null,d&&Date.now()-d.at<300&&(c&&Date.now()-c.at<300&&Math.hypot(d.x-c.x,d.y-c.y)<30?(c=null,q(d.x,d.y)):c={...d,at:Date.now()}),d=null)}),e.addEventListener("touchcancel",()=>{r=i=d=null}),e.addEventListener("dblclick",w=>{Date.now()-m<1e3||!y(w.target)||q(w.clientX,w.clientY)}),e.addEventListener("pointerdown",w=>{if(w.pointerType!=="mouse"||o<=1||!y(w.target))return;w.preventDefault();const v={cx:w.clientX,cy:w.clientY,x:s,y:l},S=A=>{s=v.x+A.clientX-v.cx,l=v.y+A.clientY-v.cy,x(),h(!1)},p=()=>{removeEventListener("pointermove",S),removeEventListener("pointerup",p)};addEventListener("pointermove",S),addEventListener("pointerup",p)})}function kt(e,a){e.onerror=async()=>{e.onerror=null;const t=ue(a)?await pe(a):null;t&&(e.src=URL.createObjectURL(t))},e.src=URL.createObjectURL(a)}function Ia(e,a,t){let n=[...F(a)];const{el:o,close:s}=H(`
    <h2>Editar item</h2>
    <form>
      <div class="photo-edit"></div>
      <p class="hint">Toque numa foto para torná-la a principal.</p>
      <label>Título<input name="title" required maxlength="120" value="${$(a.title)}"></label>
      <div class="row">
        <label>Preço (R$)<input name="price" inputmode="decimal" value="${a.price==null?"":String(a.price).replace(".",",")}" placeholder="A combinar"></label>
        <label>Categoria
          <select name="category">${Object.entries(z).map(([d,c])=>`<option value="${d}" ${d===a.category?"selected":""}>${c}</option>`).join("")}</select>
        </label>
      </div>
      <label>Descrição<textarea name="description" rows="3" maxlength="1000" placeholder="Estado, marca, medidas…">${$(a.description||"")}</textarea></label>
      ${ae===!1?"":'<button type="button" class="btn small" data-ai>✨ Descrever com IA (a partir da foto principal)</button><p class="hint ai-hint" hidden></p>'}
      <div class="actions">
        <button class="btn primary">Salvar</button>
        <button type="button" class="btn" data-close>Cancelar</button>
      </div>
    </form>`),l=o.querySelector(".photo-edit"),r=o.querySelector("form"),i=()=>{l.innerHTML=n.map((d,c)=>`
        <div class="thumb-edit" data-i="${c}">
          <img alt="">
          ${c===0?'<span class="main-tag">Principal</span>':""}
          <button type="button" class="rm" data-rm="${c}" aria-label="Remover foto">&times;</button>
        </div>`).join("")+(n.length<J?`<label class="add-photo">${E.camera}<span>Adicionar</span><input type="file" accept="image/*" multiple hidden></label>`:""),l.querySelectorAll(".thumb-edit img").forEach((d,c)=>{const m=n[c];typeof m=="string"?d.src=m:kt(d,m)}),l.querySelector("input[type=file]")?.addEventListener("change",d=>{const c=J-n.length;d.target.files.length>c&&b(`Até ${J} fotos por item.`),n.push(...[...d.target.files].slice(0,c)),i()})};i(),o.querySelector("[data-ai]")?.addEventListener("click",async d=>{const c=n[0];if(!c)return b("Adicione uma foto primeiro.","error");const m=d.currentTarget;m.disabled=!0;try{const u=typeof c=="string"?new File([await(await fetch(c)).blob()],"foto.jpg",{type:"image/jpeg"}):c;r.title.value="",r.description.value="",delete r.category.dataset.touched,await Fe(r,u,o.querySelector(".ai-hint"),()=>u),r.title.value||(r.title.value=a.title)}catch(u){b("Não foi possível ler a foto para a IA.","error",u),r.title.value||(r.title.value=a.title)}finally{m.disabled=!1}}),l.addEventListener("click",d=>{const c=d.target.closest("[data-rm]");if(c)return n.splice(Number(c.dataset.rm),1),i();const m=d.target.closest(".thumb-edit");m&&m.dataset.i!=="0"&&(n.unshift(...n.splice(Number(m.dataset.i),1)),i())}),r.addEventListener("submit",async d=>{d.preventDefault();const c=r.querySelector("button.primary");c.disabled=!0,c.textContent="Salvando…";try{const m=await Promise.all(n.map(h=>typeof h=="string"?h:me(h))),u={title:r.title.value.trim(),price:re(r.price.value),ai_price:We(r)||a.ai_price&&re(r.price.value)===Number(a.price),category:r.category.value,description:r.description.value.trim()||null,photos:m,photo_url:m[0]||null},{error:x}=await f.from("items").update(u).eq("id",a.id);if(x)throw new Error(`Erro ao salvar o item: ${x.message}`);ze(F(a).filter(h=>!m.includes(h)&&h!==e.cover_url)),Object.assign(a,u),m[0]&&!e.cover_url&&(e.cover_url=m[0],await f.from("sales").update({cover_url:m[0]}).eq("id",e.id)),s(),t(),b("Item atualizado.")}catch(m){b(m.message||"Erro ao salvar o item.","error",m),c.disabled=!1,c.textContent="Salvar"}})}const qt=e=>/limite/i.test(e.message)?e.message:"Não foi possível obter o contato do vendedor. Tente de novo.";async function Pa(e,a,t){const{data:n,error:o}=await f.rpc("get_sale_pix",{p_sale:e.id});if(o)return b(qt(o),"error",o);const s=n?.[0];if(!s)return b("O vendedor não informou uma chave Pix.","error");const l=s.pix_name||e.owner?.name||"",r=aa({key:s.pix_key,name:l,amount:Number(a.price)}),{el:i,close:d}=H(`
    <h2>Pagar com Pix</h2>
    <p class="meta big">${$(a.title)} · <strong>${Q(a.price)}</strong></p>
    <div class="notice"><p><strong>Combine com o vendedor antes de pagar</strong>, para garantir que o item ainda está disponível.</p></div>
    <div class="qr">Gerando QR Code…</div>
    <button class="btn primary" data-copy>Copiar código Pix (copia e cola)</button>
    <p class="hint">Recebedor: <strong>${$(l)}</strong>. Confira o nome no app do banco antes de confirmar.</p>
    <div class="actions">
      ${e.owner?.chat_enabled===!1?"":`<button class="btn primary" data-paid>${E.chat}Avisar o vendedor que paguei</button>`}
      <button class="btn" data-close>Fechar</button>
    </div>`,"pix-modal");lt(r).then(m=>i.querySelector(".qr").innerHTML=m).catch(m=>i.querySelector(".qr").textContent=m.message),i.querySelector("[data-copy]").onclick=async()=>{try{await navigator.clipboard.writeText(r),b("Código Pix copiado! Cole no app do seu banco, em Pix > Copia e cola.")}catch{prompt("Copie o código Pix:",r)}};const c=i.querySelector("[data-paid]");c&&(c.onclick=()=>{d(),t(`Olá! Fiz o Pix de ${Q(a.price)} por este item. Podemos combinar a retirada?`)})}function Da(e){const a=_e(e.id),{el:t,close:n}=H(`
    <h2>Adicionar à agenda</h2>
    <p class="hint">A agenda do seu celular avisa na véspera para você não perder a venda.</p>
    <div class="actions column">
      <a class="btn" href="${$(Zt(e,a))}" target="_blank" rel="noopener" data-close>${E.calendar}Google Agenda</a>
      <button class="btn" data-ics>${E.calendar}iPhone, Outlook ou outra agenda</button>
      <button class="btn" data-close>Cancelar</button>
    </div>`);t.querySelector("[data-ics]").onclick=()=>{const o=new Blob([Jt(e,a)],{type:"text/calendar;charset=utf-8"}),s=document.createElement("a");s.href=URL.createObjectURL(o),s.download=`venda-${e.starts_on}.ics`,s.click(),n(),b("Abra o arquivo baixado para salvar na agenda.")}}const Ba=(e,a)=>Math.round((X(a)-X(e))/864e5);function Ra(e){const a=e.ends_on>D()?e.ends_on:D();let t=X(e.starts_on);for(;B(t)<=a;)t=Y(t,7);return B(t)}function Na(e){const a=Ra(e),t=B(Y(X(a),Ba(e.starts_on,e.ends_on))),n=e.items.filter(i=>i.status!=="vendido"),o=n.filter(i=>i.status==="reservado").length,{el:s,close:l}=H(`
    <h2>Duplicar venda</h2>
    <p class="hint">Cria uma nova venda com o mesmo local, horário, descrição e foto de capa. A venda atual não muda.</p>
    <form>
      <div class="row">
        <label>Data de início<input type="date" name="starts_on" required value="${a}" min="${D()}" max="${Pe()}"></label>
        <label>Último dia<input type="date" name="ends_on" required value="${t}" min="${D()}"></label>
      </div>
      <label class="check">
        <input type="checkbox" name="copy" ${n.length?"checked":"disabled"}>
        ${n.length?`Levar os ${n.length} ${n.length===1?"item que não foi vendido":"itens que não foram vendidos"}`:"Nenhum item para levar (todos foram vendidos)"}
      </label>
      ${o?`<p class="hint">${o===1?"O item reservado volta":`Os ${o} itens reservados voltam`} como disponível.</p>`:""}
      <div class="actions">
        <button class="btn primary">Duplicar venda</button>
        <button type="button" class="btn" data-close>Cancelar</button>
      </div>
    </form>`),r=s.querySelector("form");r.starts_on.addEventListener("change",()=>{r.ends_on.value<r.starts_on.value&&(r.ends_on.value=r.starts_on.value)}),r.addEventListener("submit",async i=>{i.preventDefault();const d=ht(r.starts_on.value,r.ends_on.value);if(d)return b(d,"error");const c=r.querySelector("button.primary");c.disabled=!0,c.textContent="Duplicando…";try{const u=Object.fromEntries(["title","description","type","region","address","reference","lat","lng","start_time","end_time","cover_url","photos_only"].map(_=>[_,e[_]])),{data:x,error:h}=await f.from("sales").insert({...u,starts_on:r.starts_on.value,ends_on:r.ends_on.value}).select("id").single();if(h)throw De("Erro ao duplicar a venda",h);if(r.copy.checked&&n.length){const _=n.map(y=>({sale_id:x.id,title:y.title,price:y.price,category:y.category,photo_url:y.photo_url,photos:F(y)})),k=await f.from("items").insert(_);if(k.error)throw new Error(`A venda foi duplicada, mas os itens não: ${k.error.message}`)}l(),b("Venda duplicada!"),j(`/venda/${x.id}?duplicada=1`)}catch(m){b(m.message,"error",we(m)),c.disabled=!1,c.textContent="Duplicar venda"}})}function Xe(e){const a=X(e).toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});return a.charAt(0).toUpperCase()+a.slice(1)}function Ye(e){const a=`${$e(e.start_time)} às ${$e(e.end_time)}`;return e.starts_on===e.ends_on?`${Xe(e.starts_on)} · ${a}`:`${Xe(e.starts_on)} a ${Xe(e.ends_on).toLowerCase()} · ${a}`}async function ja(e,a){T.innerHTML='<div class="loading">Preparando o cartaz…</div>';const{data:t,error:n}=await f.from("sales").select("*, items(title,price,photo_url,photos,status)").eq("id",a).maybeSingle();if(!e.alive())return;if(n)throw n;if(!t){T.innerHTML='<div class="empty"><h2>Venda não encontrada</h2><a class="btn" href="#/">Voltar ao início</a></div>';return}document.body.classList.add("poster-mode"),Z.push(()=>document.body.classList.remove("poster-mode")),document.title=`Cartaz — ${t.title}`;const o=_e(t.id),s=ge.replace(/^https?:\/\//,"").replace(/\/$/,""),l=[t.address,t.region].filter(Boolean).join(" · "),r=t.items.filter(c=>c.status!=="vendido"&&F(c).length).slice(0,6),i=G[t.type];T.innerHTML=`
    <div class="poster-tools no-print">
      <a class="btn small" href="#/venda/${t.id}">← Voltar para a venda</a>
      ${r.length?'<label class="check"><input type="checkbox" id="show-photos" checked> Mostrar fotos dos itens</label>':""}
      <button class="btn primary" id="print">Imprimir ou salvar PDF</button>
      <button class="btn whatsapp" id="as-image">${E.whatsapp}Imagem para WhatsApp</button>
      <p class="hint">Cole o cartaz no elevador, na portaria ou no mural. Quem apontar a câmera do celular para o QR Code abre a venda com todos os itens.</p>
    </div>
    <article class="poster poster-${t.type} ${r.length?"":"poster-no-items"}" id="poster">
      <header class="poster-band">${$(i.label)}</header>
      <div class="poster-body">
        <h1>${$(t.title)}</h1>
        <p class="poster-when">${$(Ye(t))}</p>
        ${l?`<p class="poster-where">${$(l)}</p>`:""}
        ${t.reference?`<p class="poster-ref">${$(t.reference)}</p>`:""}
        ${r.length?`
          <div class="poster-items" id="poster-items">
            ${r.map(c=>`<figure><img src="${$(F(c)[0])}" alt="">${t.photos_only?"":`<figcaption>${Q(c.price)}</figcaption>`}</figure>`).join("")}
          </div>`:""}
        <div class="poster-qr">
          <div class="qr" id="poster-qr"></div>
          <div>
            <strong>${t.photos_only?"Veja as fotos de todos os itens":"Veja todos os itens e preços"}</strong>
            <p>Aponte a câmera do celular para o código</p>
            <p class="poster-url">${$(s)}</p>
          </div>
        </div>
      </div>
      <footer>${$(R.APP_NAME)} · vendas de garagem, bazares e mudanças em Brasília</footer>
    </article>`,lt(o).then(c=>document.getElementById("poster-qr").innerHTML=c).catch(c=>b(c.message,"error",c)),document.getElementById("show-photos")?.addEventListener("change",c=>{document.getElementById("poster-items").hidden=!c.target.checked,document.getElementById("poster").classList.toggle("poster-no-items",!c.target.checked)}),document.getElementById("print").onclick=()=>window.print();const d=Ha(t,o,l);d.catch(c=>Ce(c,"cartaz imagem")),document.getElementById("as-image").onclick=async()=>{let c;try{c=await d}catch{return b("Não foi possível gerar a imagem do cartaz.","error")}const m=`${G[t.type].label}: ${t.title}
${Ye(t)}${l?`
${l}`:""}
Veja os itens: ${o}`;if(navigator.canShare?.({files:[c]}))try{await navigator.share({files:[c],text:m});return}catch(x){if(x.name==="AbortError")return}const u=document.createElement("a");u.href=URL.createObjectURL(c),u.download=c.name,u.click(),b("Imagem salva. Envie no WhatsApp junto com o link da venda.")}}const At={garagem:"#3563ad",mudanca:"#b45309",bazar:"#6741d9"};function qe(e,a,t,n,o,s,l){const r=String(a).split(/\s+/);let i="",d=0;for(let c=0;c<r.length;c++){const m=i?`${i} ${r[c]}`:r[c];if(e.measureText(m).width>o&&i){if(++d===l)return e.fillText(`${i}…`,t,n),n+s;e.fillText(i,t,n),n+=s,i=r[c]}else i=m}return i&&e.fillText(i,t,n),n+s}async function Ha(e,a,t){const l=document.createElement("canvas");l.width=1080,l.height=1350;const r=l.getContext("2d"),i=(_,k)=>`${_} ${k}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;r.fillStyle="#ffffff",r.fillRect(0,0,1080,1350),r.fillStyle=At[e.type],r.fillRect(0,0,1080,150),r.fillStyle="#ffffff",r.font=i(800,56),r.textBaseline="middle",r.fillText(G[e.type].label.toUpperCase(),80,78),r.textBaseline="alphabetic",r.fillStyle="#1c2319",r.font=i(800,76);let d=qe(r,e.title,80,290,920,88,3);r.font=i(700,46),r.fillStyle=At[e.type],d=qe(r,Ye(e),80,d+30,920,58,2),r.fillStyle="#3d4643",r.font=i(500,40),t&&(d=qe(r,t,80,d+10,920,52,2)),e.reference&&(d=qe(r,e.reference,80,d,920,52,2));const c=await oa(a,10),m=420,u=(1080-m)/2,x=Math.max(d+40,1350-m-230);r.drawImage(c,u,x,m,m),r.fillStyle="#1c2319",r.font=i(700,40),r.textAlign="center",r.fillText(e.photos_only?"Veja as fotos de todos os itens":"Veja todos os itens e preços",1080/2,x+m+70),r.fillStyle="#626b5d",r.font=i(500,32),r.fillText(`${R.APP_NAME} · aponte a câmera ou toque no link`,1080/2,x+m+120);const h=await new Promise(_=>l.toBlob(_,"image/png"));return new File([h],"cartaz-venda.png",{type:"image/png"})}async function Oa(e){if(g.favorites.has(e))return await f.from("favorites").delete().eq("user_id",g.user.id).eq("sale_id",e),g.favorites.delete(e),!1;const{error:a}=await f.from("favorites").insert({sale_id:e});return a?(b("Não foi possível salvar.","error"),!1):(g.favorites.add(e),b("Venda salva nas suas favoritas."),!0)}const Ua="na véspera, às 19h, e no dia, às 7h",Ge=`as mensagens do chat na hora em que chegam, lembretes das vendas que você salvou (${Ua}) e, se ativar, alertas de vendas novas perto de você`;function Mt(e="favorito"){if(Ie()!=="ok"||Notification.permission!=="default")return!1;try{if(Date.now()-(Number(localStorage.getItem("lembrete-oferecido"))||0)<168*3600*1e3)return!1;localStorage.setItem("lembrete-oferecido",String(Date.now()))}catch{return!1}const{el:a,close:t}=H(`
    <h2>${e==="chat"?"Quer saber quando responderem?":"Quer um lembrete?"}</h2>
    <p class="hint">Você recebe no celular ${Ge}. Dá para desligar quando quiser em Menu &gt; Dados da conta.</p>
    <div class="actions column">
      <button class="btn primary" data-on>${E.bell}Ativar notificações</button>
      <button class="btn" data-close>Agora não</button>
    </div>`);return a.querySelector("[data-on]").onclick=async()=>{t(),await Qe()},!0}async function Qe(){try{const e=await sa(f,R.VAPID_PUBLIC_KEY);return e==="ativo"?b("Pronto! Você vai receber as mensagens e os lembretes no celular."):b(e==="negado"?"As notificações ficaram bloqueadas. Libere nas configurações do navegador para este site.":"Este navegador não recebe notificações.","error"),e==="ativo"}catch(e){return b("Não foi possível ativar as notificações.","error",e),!1}}const Tt=12,Va=e=>{const a=he(e);return a?ne.filter(t=>N(a,t)<=Tt).map(t=>t.name):[]};function Ct(e,{suggest:a=!1}={}){const t=e?.home_region||localStorage.getItem("regiao")||"",n=new Set(e?.interests||[]);return`
    <label class="check"><input type="checkbox" name="alerts" ${(e?e.alerts:a)?"checked":""}> Avisar quando publicarem uma venda perto de mim</label>
    <label>Região onde você mora
      <select name="home_region">
        <option value="">Escolha a região</option>
        ${ne.map(o=>`<option ${o.name===t?"selected":""}>${$(o.name)}</option>`).join("")}
      </select>
    </label>
    <label class="check"><input type="checkbox" name="nearby" ${e?.nearby===!1?"":"checked"}> Incluir as regiões vizinhas (até ${Tt} km)</label>
    <p class="hint">Só me avise de vendas com (deixe tudo desmarcado para receber todas):</p>
    <div class="interest-grid">
      ${Object.entries(z).filter(([o])=>o!=="outros").map(([o,s])=>`
        <label class="chip check-chip"><input type="checkbox" name="interest" value="${o}" ${n.has(o)?"checked":""}>${$(s)}</label>`).join("")}
    </div>
    <label class="check"><input type="checkbox" name="news_email" ${e?.news_email?"checked":""}> Quero receber novidades do ${$(R.APP_NAME)} por e-mail (no máximo 2 por mês)</label>`}function It(e){const a=e.home_region.value||null;return{alerts:e.alerts.checked&&!!a,home_region:a,nearby:e.nearby.checked,regions:a?e.nearby.checked?Va(a):[a]:[],interests:[...e.querySelectorAll("[name=interest]:checked")].map(t=>t.value),news_email:e.news_email.checked}}async function Ke(e){const{data:a,error:t}=await f.from("preferences").update(e).eq("user_id",g.user.id).select("user_id");if(t)throw t;if(!a.length){const{error:n}=await f.from("preferences").insert({...e,user_id:g.user.id});if(n)throw n}g.prefs=e}function za(){if(g.prefs!==null)return!1;const{el:e,close:a}=H(`
    <h2>Quer ser avisado de vendas perto de você?</h2>
    <p class="hint">Quando alguém publicar uma venda na sua região, você recebe um aviso (no máximo 3 por dia). Dá para mudar quando quiser em Menu &gt; Dados da conta.</p>
    <form class="form prefs-form">
      ${Ct(null,{suggest:!0})}
      <div class="actions column">
        <button class="btn primary">${E.bell}Salvar</button>
        <button type="button" class="btn" data-skip>Agora não</button>
      </div>
    </form>`,"",{keep:!0}),t=e.querySelector("form");return t.addEventListener("submit",async n=>{n.preventDefault();const o=It(t);if(t.alerts.checked&&!o.home_region)return b("Escolha a região onde você mora.","error");try{await Ke(o)}catch(s){return b("Não foi possível salvar suas preferências.","error",s)}a(),o.alerts&&Ie()==="ok"&&Notification.permission==="default"?await Qe():b(o.alerts?`Pronto! Avisaremos de vendas em ${o.home_region}${o.nearby?" e arredores":""}.`:"Preferências salvas.")}),e.querySelector("[data-skip]").onclick=async()=>{a(),await Ke({alerts:!1,home_region:null,nearby:!0,regions:[],interests:[],news_email:!1}).catch(()=>{})},!0}async function oe(e,{compact:a=!1}={}){const t=Ie(),n=await na().catch(()=>!1);if(!e.isConnected)return;const o=t==="ok"&&Notification.permission==="denied";if(a&&(n||o||t==="sem-suporte"))return void(e.innerHTML="");let s;t==="ios-instalar"?s='<p class="hint">No iPhone, as notificações chegam com o app na tela de início: toque em Compartilhar e depois em <strong>Adicionar à Tela de Início</strong>. Abra o app por lá e ative aqui.</p>':t==="sem-suporte"?s='<p class="hint">Este navegador não recebe notificações. As mensagens aparecem na aba Chat, e você pode usar "Adicionar à agenda" na página da venda.</p>':o?s='<p class="hint">As notificações estão bloqueadas para este site. Libere nas configurações do navegador e volte aqui.</p>':n?s=`<p class="hint"><span class="ok">Ativas neste aparelho ✓</span> Você recebe ${Ge}.</p>
      <button type="button" class="btn small" data-rem="off">Desativar notificações</button>`:s=`<p class="hint">Receba no celular ${Ge}.</p>
      <button type="button" class="btn ${a?"small":""} primary" data-rem="on">${E.bell}Ativar notificações</button>`,e.innerHTML=a?`<div class="reminder-box compact">${s}</div>`:`<fieldset class="reminder-box"><legend>${E.bell} Notificações no celular</legend>${s}</fieldset>`;const l=e.querySelector("[data-rem]");l&&(l.onclick=async()=>{if(l.disabled=!0,l.dataset.rem==="on")await Qe();else try{await fe(f),b("Notificações desativadas neste aparelho.")}catch(r){b("Não foi possível desativar as notificações.","error",r)}oe(e,{compact:a})})}async function Wa(e){const a=_e(e.id),t=`${G[e.type].label}: ${e.title} — ${ye(e)}, ${e.region}`;if(navigator.share){try{await navigator.share({title:e.title,text:t,url:a})}catch{}return}const{el:n,close:o}=H(`
    <h2>Compartilhar venda</h2>
    <input class="copy" value="${$(a)}" readonly>
    <div class="actions">
      <a class="btn whatsapp" href="https://wa.me/?text=${encodeURIComponent(t+`
`+a)}" target="_blank" rel="noopener">${E.whatsapp}Enviar no WhatsApp</a>
      <button class="btn" data-copy>Copiar link</button>
      <button class="btn" data-close>Fechar</button>
    </div>`);n.querySelector("[data-copy]").onclick=async()=>{await navigator.clipboard.writeText(a),b("Link copiado!"),o()}}const Fa={aberta:"em aberto",rejeitada:"descartada",procedente:"aceita"};async function Xa(e){const{data:a,error:t}=await f.from("reports").select("reason,details,status,created_at").eq("sale_id",e).order("created_at",{ascending:!1}),n=document.getElementById("mod-reports");if(n){if(t)return void(n.textContent="Não foi possível carregar as denúncias.");n.innerHTML=a.length?`<ul class="mod-list">${a.map(o=>`<li><strong>${$(o.reason)}</strong> · ${Fa[o.status]||$(o.status)} · ${ot(o.created_at)}${o.details?`<br>${$(o.details)}`:""}</li>`).join("")}</ul>`:"Nenhuma denúncia."}}function Pt(e,a){const{el:t,close:n}=H(`
    <h2>Denunciar ${a}</h2>
    <form id="report-form">
      <label>Motivo
        <select name="reason" required>${Xt.map(o=>`<option>${o}</option>`).join("")}</select>
      </label>
      <label>Detalhes (opcional)
        <textarea name="details" rows="3" maxlength="1000" placeholder="Conte o que aconteceu"></textarea>
      </label>
      <div class="actions">
        <button class="btn danger">Enviar denúncia</button>
        <button type="button" class="btn" data-close>Cancelar</button>
      </div>
    </form>`);t.querySelector("form").addEventListener("submit",async o=>{o.preventDefault();const s=o.target,{error:l}=await f.from("reports").insert({...e,reason:s.reason.value,details:s.details.value.trim()||null});if(l)return b(l.message,"error",we(l));n(),b("Denúncia enviada. Obrigado por ajudar a manter o site seguro.")})}function Ya(e){return new Promise((a,t)=>{const n=new Image;n.onload=()=>a(n),n.onerror=()=>t(new Error("Não foi possível ler a foto.")),n.src=URL.createObjectURL(e)})}async function de(e,a=1080,t=.8,n="image/webp"){const o=await Ya(e),s=Math.min(1,a/Math.max(o.naturalWidth,o.naturalHeight)),l=document.createElement("canvas");l.width=Math.round(o.naturalWidth*s),l.height=Math.round(o.naturalHeight*s),l.getContext("2d").drawImage(o,0,0,l.width,l.height),URL.revokeObjectURL(o.src);const r=d=>new Promise(c=>l.toBlob(c,d,t)),i=await r(n);return i&&i.type===n?i:r("image/jpeg")}const Dt={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"},ue=e=>/hei[cf]/i.test(e.type)||/\.hei[cf]$/i.test(e.name);async function Ga(e){const{default:a}=await import("https://cdn.jsdelivr.net/npm/heic2any@0.0.4/+esm"),t=await a({blob:e,toType:"image/jpeg",quality:.85});return new File([Array.isArray(t)?t[0]:t],"foto.jpg",{type:"image/jpeg"})}const Ze=new WeakMap;function pe(e){return Ze.has(e)||Ze.set(e,Ga(e).catch(()=>null)),Ze.get(e)}function Bt(e,a,t){a.hidden=!1,t.hidden=!0,a.onerror=async()=>{if(a.onerror=null,!ue(e))return;a.hidden=!0,t.hidden=!1;const n=t.lastChild,o=n.textContent;n.textContent="Preparando foto…";const s=await pe(e);if(n.textContent=o,!s)return b("Não foi possível abrir esta foto. Tente outra.","error");a.src=URL.createObjectURL(s),a.hidden=!1,t.hidden=!0},a.src=URL.createObjectURL(e)}async function me(e){let a=await de(e).catch(()=>null);if(!a&&ue(e)){const m=await pe(e);if(!m)throw new Error('Não foi possível converter a foto HEIC. No iPhone, vá em Ajustes > Câmera > Formatos e escolha "Mais Compatível".');a=await de(m).catch(()=>null)||m}if(!a){if(!Dt[e.type])throw new Error(`Formato de foto não suportado (${e.type||"desconhecido"}). Use JPG ou PNG.`);if(e.size>5*1024*1024)throw new Error("A foto é muito grande (máximo 5 MB).");a=await Qt(e)}const t=a.type||"image/jpeg",n=Dt[t]||"jpg",o=f.storage.from("photos"),s={contentType:t,cacheControl:"31536000"},l=`${g.user.id}/${crypto.randomUUID()}`,r=(n==="webp"||n==="jpg")&&await de(a,400,.7,t).catch(()=>null),d=r?.type===t&&!(await o.upload(`${l}.t.${n}`,r,s)).error?`${l}.f.${n}`:`${l}.${n}`,{error:c}=await o.upload(d,a,s);if(c)throw new Error(`Erro ao enviar a foto: ${c.message}`);return o.getPublicUrl(d).data.publicUrl}async function Rt(e,a){if(!V(e.path,"Entre para anunciar uma venda. É grátis."))return;if(!$t()){sessionStorage.setItem("next",e.path),j("/perfil?msg="+encodeURIComponent("Para anunciar, confirme seu telefone por SMS."));return}let t=null;if(a){const{data:u,error:x}=await f.from("sales").select("*").eq("id",a).maybeSingle();if(!e.alive())return;if(x)throw x;if(!u||u.owner_id!==g.user.id){T.innerHTML='<div class="empty"><h2>Você não pode editar esta venda</h2><a class="btn" href="#/">Voltar</a></div>';return}t=u}const n=B(ca()),o=t||{type:"garagem",region:localStorage.getItem("regiao")||"Plano Piloto",starts_on:n,ends_on:n,start_time:"08:00",end_time:"14:00"};T.innerHTML=`
    <form id="sale-form" class="form">
      <h1>${t?"Editar venda":"Anunciar uma venda"}</h1>
      ${t?"":'<p class="hint">Antes de começar, veja as <a href="regras.html">regras para anunciar</a> (datas, limites e denúncias).</p>'}

      <fieldset class="type-pick">
        <legend>Tipo</legend>
        ${Object.entries(G).map(([u,x])=>`
          <label class="type-opt type-${u}">
            <input type="radio" name="type" value="${u}" ${o.type===u?"checked":""}>
            <span><strong>${x.label}</strong><small>${{garagem:"Desapego da casa, num dia só",mudanca:"Vou me mudar e preciso vender quase tudo",bazar:"Vários vendedores: prédio, condomínio, igreja, escola"}[u]}</small></span>
          </label>`).join("")}
      </fieldset>

      <label>Título
        <input name="title" required minlength="3" maxlength="120" value="${$(o.title)}" placeholder="Ex.: Bazar de sábado no pilotis da SQS 308">
      </label>
      <label>Descrição
        <textarea name="description" rows="3" maxlength="2000" placeholder="O que vai ter, formas de pagamento (Pix, dinheiro), se precisa levar sacola…">${$(o.description)}</textarea>
      </label>

      <fieldset class="type-pick">
        <legend>Como mostrar os itens</legend>
        <label class="type-opt">
          <input type="radio" name="photos_only" value="0" ${o.photos_only?"":"checked"}>
          <span><strong>Com detalhes</strong><small>Título, preço e categoria de cada item (a IA ajuda a preencher)</small></span>
        </label>
        <label class="type-opt">
          <input type="radio" name="photos_only" value="1" ${o.photos_only?"checked":""}>
          <span><strong>Só fotos</strong><small>Você só tira as fotos; o comprador pergunta o preço no chat ou vê no local</small></span>
        </label>
      </fieldset>

      <div class="row">
        <label>Data de início<input type="date" name="starts_on" required value="${o.starts_on}" min="${t?"":D()}" max="${Pe()}"></label>
        <label>Último dia<input type="date" name="ends_on" required value="${o.ends_on}"></label>
      </div>
      <div class="row">
        <label>Abre às<input type="time" name="start_time" required value="${o.start_time.slice(0,5)}"></label>
        <label>Fecha às<input type="time" name="end_time" required value="${o.end_time.slice(0,5)}"></label>
      </div>

      <label>Região administrativa
        <select name="region" required>
          ${ne.map(u=>`<option ${u.name===o.region?"selected":""}>${$(u.name)}</option>`).join("")}
        </select>
      </label>
      <label>Endereço
        <input name="address" maxlength="160" value="${$(o.address)}" placeholder="Ex.: SQS 308 Bloco C">
      </label>
      <label>Referência
        <input name="reference" maxlength="160" value="${$(o.reference)}" placeholder="Ex.: pilotis do bloco C, portaria 2">
      </label>

      <div class="pin-field">
        <div class="pin-head">
          <span>Ajuste o pino no local exato da venda</span>
          <button type="button" class="btn small" id="use-location">Usar minha localização</button>
        </div>
        <div id="form-map" class="map"></div>
        <p class="hint">Endereços de Brasília nem sempre são reconhecidos pelo GPS. Arraste o pino ou toque no mapa.</p>
      </div>

      <label class="photo-pick wide">
        <input type="file" name="cover" accept="image/*" hidden>
        <span class="ph" ${o.cover_url?"hidden":""}>${E.camera}Foto de capa (opcional)</span>
        <img alt="" ${o.cover_url?`src="${$(o.cover_url)}"`:"hidden"}>
      </label>

      <button class="btn primary big">${t?"Salvar alterações":"Criar venda e cadastrar itens"}</button>
    </form>`;const s=document.getElementById("sale-form"),l=he(o.region)||ne[0];let r=t?[t.lat,t.lng]:[l.lat,l.lng],i=!!t;const d=Be("form-map",r,t?17:15,{scrollWheelZoom:!0,recenter:u=>u.setView(c.getLatLng(),Math.max(u.getZoom(),15))}),c=L.marker(r,{draggable:!0,icon:Ee(o.type)}).addTo(d);c.on("dragend",()=>{const u=c.getLatLng();r=[u.lat,u.lng],i=!0}),d.on("click",u=>{c.setLatLng(u.latlng),r=[u.latlng.lat,u.latlng.lng],i=!0}),s.region.addEventListener("change",()=>{if(i)return;const u=he(s.region.value);r=[u.lat,u.lng],c.setLatLng(r),d.setView(r,15)}),s.addEventListener("change",u=>{u.target.name==="type"&&c.setIcon(Ee(u.target.value)),u.target.name==="starts_on"&&s.ends_on.value<s.starts_on.value&&(s.ends_on.value=s.starts_on.value)}),document.getElementById("use-location").addEventListener("click",()=>{if(!navigator.geolocation)return b("Seu aparelho não informa a localização.","error");navigator.geolocation.getCurrentPosition(u=>{r=[u.coords.latitude,u.coords.longitude],i=!0,c.setLatLng(r),d.setView(r,17)},()=>b("Não foi possível obter sua localização.","error"),{enableHighAccuracy:!0,timeout:1e4})});const m=s.cover;m.addEventListener("change",()=>{const u=m.files[0];u&&Bt(u,s.querySelector(".photo-pick img"),s.querySelector(".photo-pick .ph"))}),s.addEventListener("submit",async u=>{u.preventDefault();const h=(!t||s.starts_on.value!==t.starts_on||s.ends_on.value!==t.ends_on)&&ht(s.starts_on.value,s.ends_on.value);if(h)return b(h,"error");if(s.starts_on.value===s.ends_on.value&&s.end_time.value<=s.start_time.value)return b("O horário de fechamento precisa ser depois da abertura.","error");const _=s.querySelector("button.big");_.disabled=!0,_.textContent="Salvando…";try{const k={type:s.type.value,title:s.title.value.trim(),description:s.description.value.trim()||null,starts_on:s.starts_on.value,ends_on:s.ends_on.value,start_time:s.start_time.value,end_time:s.end_time.value,region:s.region.value,address:s.address.value.trim()||null,reference:s.reference.value.trim()||null,lat:r[0],lng:r[1],photos_only:s.photos_only.value==="1"},y=t?await f.from("sales").update(k).eq("id",t.id).select("id").single():await f.from("sales").insert(k).select("id").single();if(y.error)throw De("Erro ao salvar a venda",y.error);localStorage.setItem("regiao",k.region);let q=null;if(m.files[0])try{const C=await me(m.files[0]),I=await f.from("sales").update({cover_url:C}).eq("id",y.data.id);if(I.error)throw I.error}catch(C){q=C}q?b(`Venda salva, mas a foto de capa falhou. ${q.message}`,"error",q):b(t?"Venda atualizada.":"Venda criada como rascunho. Agora cadastre os itens."),j(`/venda/${y.data.id}${t?"":"?novo=1"}`)}catch(k){b(k.message||"Erro ao salvar.","error",we(k)),_.disabled=!1,_.textContent=t?"Salvar alterações":"Criar venda e cadastrar itens"}})}async function Qa(e){if(!V("/minhas","Entre para ver suas vendas e favoritas."))return;const a=e.params.get("aba")||"vendas";T.innerHTML=`
    <div class="seg wide">
      <a href="#/minhas?aba=vendas" class="${a==="vendas"?"on":""}">Minhas vendas</a>
      <a href="#/minhas?aba=favoritas" class="${a==="favoritas"?"on":""}">Favoritas</a>
    </div>
    <div id="mine">${He(3)}</div>`;let t;if(a==="vendas"){const{data:i,error:d}=await f.from("sales").select(Se).eq("owner_id",g.user.id).order("starts_on",{ascending:!1});if(d)throw d;t=i}else{const{data:i,error:d}=await f.from("favorites").select(`sales(${Se})`).eq("user_id",g.user.id).order("created_at",{ascending:!1});if(d)throw d;t=i.map(c=>c.sales).filter(Boolean)}if(!e.alive())return;const n=D(),o=t.filter(i=>i.ends_on>=n),s=t.filter(i=>i.ends_on<n),l=document.getElementById("mine");if(!t.length){l.innerHTML=a==="vendas"?'<div class="empty"><h2>Você ainda não anunciou nenhuma venda</h2><a class="btn primary" href="#/anunciar">Anunciar uma venda</a></div>':'<div class="empty"><h2>Nenhuma venda salva</h2><p>Toque em "Salvar" numa venda para guardá-la aqui.</p><a class="btn" href="#/">Ver vendas</a></div>';return}l.innerHTML=`
    ${a==="favoritas"&&o.length?'<div id="reminders"></div>':""}
    ${o.length?`<h2 class="section-title">Próximas</h2><div class="cards">${o.map(te).join("")}</div>`:""}
    ${s.length?`<h2 class="section-title">Encerradas</h2><div class="cards past">${s.map(te).join("")}</div>`:""}`;const r=document.getElementById("reminders");r&&oe(r,{compact:!0})}async function Ka(e,a,t=""){if(!V(`/venda/${e.id}`,"Entre para conversar com o vendedor."))return;const{data:n,error:o}=await f.rpc("start_conversation",{p_item:a.id});if(o)return b(o.message,"error",/Limite|encontrado|é seu|não recebe/.test(o.message)?null:o);try{t&&sessionStorage.setItem(`chat-rascunho-${n}`,t)}catch{}j(`/chat/${n}`)}let Ae=null,ee=null,Nt=0;window.addEventListener("chat-resync",e=>!e.detail?.initial&&location.hash==="#/chat"&&O());async function Za(){const e=++Nt;if(Ae&&f.removeChannel(Ae),Ae=null,!g.user)return;const{data:a}=await f.auth.getSession();if(e!==Nt||!g.user)return;a.session&&f.realtime.setAuth(a.session.access_token);let t=!0;Ae=f.channel(`user:${g.user.id}`,{config:{private:!0}}).on("broadcast",{event:"message"},({payload:n})=>{window.dispatchEvent(new CustomEvent("chat-message",{detail:n})),!(n.sender_id===g.user?.id||n.conversation_id===ee)&&(W(!0),location.hash==="#/chat"?O():location.hash.startsWith("#/chat")||b("Nova mensagem no chat."))}).subscribe(n=>{n==="SUBSCRIBED"&&(window.dispatchEvent(new CustomEvent("chat-resync",{detail:{initial:t}})),t=!1)})}const Je={disponivel:"Disponível",reservado:"Reservado",vendido:"Vendido"},Ja=e=>new Date(e).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),et=e=>e?`<img src="${$(Ue(e))}" alt="" loading="lazy">`:`<span class="chat-noimg">${E.tag}</span>`;async function eo(e){if(!V("/chat","Entre para ver suas conversas."))return;T.innerHTML=`
    <div class="chat-page">
      <h1>Conversas</h1>
      <div id="reminders"></div>
      <div id="chat-list" class="chat-list" aria-busy="true">${'<div class="chat-row"><span class="chat-thumb sk"></span><span class="sk notif-sk"></span></div>'.repeat(4)}</div>
    </div>`,oe(document.getElementById("reminders"),{compact:!0});const{data:a,error:t}=await f.rpc("my_conversations");if(t)throw t;if(!e.alive())return;const n=document.getElementById("chat-list");if(n.removeAttribute("aria-busy"),!a.length){n.innerHTML=`
      <div class="empty">
        <h2>Nenhuma conversa ainda</h2>
        <p>Viu um item que gostou? Toque em <strong>Tenho interesse</strong> para conversar com o vendedor sobre ele.</p>
        <a class="btn" href="#/">Ver vendas</a>
      </div>`;return}n.innerHTML='<p class="hint chat-swipe-hint">Arraste uma conversa para a esquerda para apagar.</p>'+a.map(o=>`
    <div class="chat-swipe" data-id="${o.id}">
      <span class="chat-swipe-bg" aria-hidden="true">${E.trash}Apagar</span>
      <a class="chat-row ${o.unread?"unread":""}" href="#/chat/${o.id}" draggable="false">
        <span class="chat-thumb">${et(o.item_photo)}</span>
        <span class="chat-text">
          <strong>${$(o.item_title)}</strong>
          <small>${o.i_am_seller?"Você vende para":"Vendido por"} ${$(o.other_name)}</small>
          <span class="chat-last">${o.last_mine?"Você: ":""}${$(o.last_message||"")}</span>
        </span>
        <time datetime="${$(o.last_message_at)}">${ot(o.last_message_at)}</time>
      </a>
    </div>`).join(""),to(n,async o=>{const s=o.dataset.id,{error:l}=await f.rpc("hide_conversation",{p_conv:s});return l?(b("Não foi possível apagar a conversa.","error",l),!1):(W(!0),n.querySelector(".chat-swipe:not([hidden]):not(.removing)")||O(),b("Conversa apagada.","",null,{label:"Desfazer",run:async()=>{const{error:r}=await f.rpc("hide_conversation",{p_conv:s,p_hide:!1});if(r)return b("Não foi possível desfazer.","error",r);location.hash==="#/chat"&&O()}}),!0)})}function to(e,a){let t=null,n=0,o=0,s=0,l=!1;e.addEventListener("pointerdown",i=>{t=i.button===0?i.target.closest(".chat-row"):null,n=i.clientX,o=i.clientY,s=0,l=!1}),e.addEventListener("pointermove",i=>{if(!t)return;const d=i.clientX-n,c=i.clientY-o;if(!l){if(Math.abs(c)>10&&Math.abs(c)>Math.abs(d))return void(t=null);if(d>-10)return;l=!0,t.setPointerCapture(i.pointerId),t.classList.add("dragging")}s=Math.min(0,d),t.style.transform=`translateX(${s}px)`});const r=async()=>{if(!t)return;const i=t;if(t=null,i.classList.remove("dragging"),!l)return;if(setTimeout(()=>l=!1),-s<i.offsetWidth*.35)return void(i.style.transform="");const d=i.closest(".chat-swipe");i.style.transform="translateX(-100%)",d.classList.add("removing"),await a(d)?d.hidden=!0:(d.classList.remove("removing"),i.style.transform="")};e.addEventListener("pointerup",r),e.addEventListener("pointercancel",r),e.addEventListener("click",i=>l&&i.preventDefault(),!0)}async function ao(e,a){if(!V(`/chat/${a}`,"Entre para ver suas conversas."))return;T.innerHTML='<div class="chat-view"><div class="chat-head"><span class="chat-thumb sk"></span><span class="sk notif-sk"></span></div></div>';const[t,n]=await Promise.all([f.rpc("my_conversations",{p_conv:a}),f.from("messages").select("id,sender_id,body,created_at").eq("conversation_id",a).order("created_at").limit(500)]);if(t.error)throw t.error;if(n.error)throw n.error;if(!e.alive())return;const o=t.data?.[0];if(!o){T.innerHTML='<div class="empty"><h2>Conversa não encontrada</h2><a class="btn" href="#/chat">Ver conversas</a></div>';return}document.title=`${o.item_title} — Chat — ${R.APP_NAME}`;const s=n.data;let l="";try{l=sessionStorage.getItem(`chat-rascunho-${a}`)||"",sessionStorage.removeItem(`chat-rascunho-${a}`)}catch{}T.innerHTML=`
    <div class="chat-view">
      <div class="chat-head">
        <a href="#/chat" class="chat-back" aria-label="Voltar para as conversas">${E.chevron}</a>
        <a class="chat-item" href="${o.sale_id?`#/venda/${o.sale_id}`:"#/chat"}">
          <span class="chat-thumb">${et(o.item_photo)}</span>
          <span class="chat-text">
            <strong>${$(o.item_title)}</strong>
            <small>${o.item_price!=null?`${Q(o.item_price)} · `:""}${o.item_status?Je[o.item_status]:"Item removido"} · ${o.i_am_seller?"comprador":"vendedor"}: ${$(o.other_name)}</small>
          </span>
        </a>
        <button class="chat-report" data-report aria-label="Denunciar conversa" title="Denunciar conversa">${E.flag}</button>
      </div>
      ${o.i_am_seller&&o.item_id?`
        <div class="status-toggle chat-status" role="group" aria-label="Situação do item">
          ${Object.entries(K).map(([y,q])=>`<button data-status="${y}" class="${o.item_status===y?"on":""}">${q}</button>`).join("")}
        </div>`:""}
      <div class="chat-scroll" id="chat-scroll">
        <p class="hint chat-safety">Combine a retirada em lugar movimentado e só pague depois de ver o item. Nunca passe senhas ou códigos recebidos por SMS.</p>
        <div class="chat-msgs" id="chat-msgs" aria-live="polite"></div>
      </div>
      <form class="chat-input" id="chat-form">
        <textarea name="body" rows="1" maxlength="2000" placeholder="Escreva uma mensagem" aria-label="Mensagem" required>${$(l)}</textarea>
        <button class="btn primary" aria-label="Enviar">${E.send}</button>
      </form>
    </div>`,document.body.classList.add("chat-mode"),Z.push(()=>document.body.classList.remove("chat-mode"));const r=document.getElementById("chat-msgs"),i=document.getElementById("chat-scroll"),d=y=>{const q=B(new Date(y));return q===D()?"Hoje":q===B(Y(new Date,-1))?"Ontem":new Date(y).toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"}).replace(/\./g,"")},c=()=>{let y="";r.innerHTML=s.length?s.map(q=>{const C=d(q.created_at),I=C!==y?`<div class="chat-day">${C}</div>`:"";return y=C,`${I}<div class="msg ${q.sender_id===g.user.id?"mine":""} ${q.pending?"pending":""}">
            <p>${$(q.body).replace(/\n/g,"<br>")}</p><time>${q.pending?"enviando…":Ja(q.created_at)}</time></div>`}).join(""):`<p class="hint chat-empty">${o.i_am_seller?"Nenhuma mensagem ainda.":"Mande uma mensagem para o vendedor sobre este item."}</p>`,i.scrollTo(0,i.scrollHeight)};c(),f.rpc("mark_conversation_read",{p_conv:a}).then(()=>W(!0)),ee=a;const m=y=>{const q=y.detail;q.conversation_id!==a||s.some(C=>C.id===q.id)||(s.push(q),c(),q.sender_id!==g.user.id&&f.rpc("mark_conversation_read",{p_conv:a}).then(()=>W(!0)))};let u=!1;const x=async()=>{if(!u){u=!0;try{const y=s.filter(w=>!w.pending).at(-1)?.created_at;let q=f.from("messages").select("id,sender_id,body,created_at").eq("conversation_id",a).order("created_at").limit(200);y&&(q=q.gt("created_at",y));const{data:C}=await q,I=(C||[]).filter(w=>!s.some(v=>v.id===w.id));if(ee!==a)return;if(!I.length)return void W();s.push(...I),s.sort((w,v)=>!!w.pending-!!v.pending||w.created_at.localeCompare(v.created_at)),c(),I.some(w=>w.sender_id!==g.user.id)&&f.rpc("mark_conversation_read",{p_conv:a}).then(()=>W(!0))}finally{u=!1}}};window.addEventListener("chat-message",m),window.addEventListener("chat-resync",x),Z.push(()=>{window.removeEventListener("chat-message",m),window.removeEventListener("chat-resync",x),ee=null});const h=document.getElementById("chat-form"),_=h.body,k=()=>{const y=i.scrollHeight-i.scrollTop-i.clientHeight<40;_.style.height="auto",_.style.height=`${Math.min(_.scrollHeight,140)}px`,y&&i.scrollTo(0,i.scrollHeight)};_.addEventListener("input",k),k(),_.addEventListener("keydown",y=>{y.key==="Enter"&&!y.shiftKey&&matchMedia("(pointer: fine)").matches&&(y.preventDefault(),h.requestSubmit())}),h.addEventListener("submit",async y=>{y.preventDefault();const q=_.value.trim();if(!q)return;const C={id:`tmp-${Date.now()}`,sender_id:g.user.id,body:q,created_at:new Date().toISOString(),pending:!0};s.push(C),_.value="",k(),c();const{data:I,error:w}=await f.from("messages").insert({conversation_id:a,body:q}).select("id,sender_id,body,created_at").single(),v=s.indexOf(C);if(w){s.splice(v,1),_.value=q,k(),c();const S=/Muitas mensagens|desligou o chat/.test(w.message);return b(S?w.message:"Não foi possível enviar. Tente de novo.","error",S?null:w)}s.some(S=>S.id===I.id)?s.splice(v,1):s[v]=I,c(),Mt("chat")}),l&&_.focus(),T.querySelector(".chat-status")?.addEventListener("click",async y=>{const q=y.target.closest("[data-status]");if(!q)return;const{error:C}=await f.from("items").update({status:q.dataset.status}).eq("id",o.item_id);if(C)return b("Não foi possível atualizar o item.","error",C);o.item_status=q.dataset.status,T.querySelectorAll(".chat-status [data-status]").forEach(I=>I.classList.toggle("on",I===q)),T.querySelector(".chat-item small").innerHTML=`${o.item_price!=null?`${Q(o.item_price)} · `:""}${Je[o.item_status]} · comprador: ${$(o.other_name)}`,b(`Item marcado como ${Je[o.item_status].toLowerCase()}.`)}),T.querySelector("[data-report]").onclick=()=>Pt({sale_id:o.sale_id,reported_user_id:o.other_id},o.i_am_seller?"comprador":"vendedor")}const tt=[[window.appColor.DEFAULT,"Verde (padrão)"],["#3563ad","Azul"],["#6741d9","Roxo"],["#c2255c","Rosa"],["#e8590c","Laranja"],["#1c2319","Grafite"],["#ffffff","Branco"]],jt='<span class="chev" aria-hidden="true">›</span>',Ht=e=>e?`<span class="count">${Number(e)}</span>`:jt,Ot=(e,a)=>`<span id="${a}">${Ht(e)}</span>`;function Ut(e,a){const t=document.getElementById(e);t&&(t.innerHTML=Ht(a))}function U({href:e="",ico:a,label:t,right:n=jt,attrs:o=""}){const s=e?`a href="${$(e)}"`:'button type="button"',l=e?"a":"button";return`<${s} class="li" ${o}><span class="li-ico" aria-hidden="true">${a}</span><span class="grow">${$(t)}</span>${n}</${l}>`}function Vt(e,a){const t=a.filter(Boolean).join("");return t?`<div class="list-title">${$(e)}</div><nav class="list" aria-label="${$(e)}">${t}</nav>`:""}const zt={"":"Automático",light:"Claro",dark:"Escuro"};function at(){try{return localStorage.getItem("tema")||""}catch{return""}}function oo(){const e={"":"light",light:"dark",dark:""}[at()];try{e?localStorage.setItem("tema",e):localStorage.removeItem("tema")}catch{}e?document.documentElement.dataset.theme=e:delete document.documentElement.dataset.theme,Me()}function no(){const{el:e,close:a}=H(`
    <h2>Sair da conta?</h2>
    <p class="hint">Os lembretes deste aparelho serão desligados. Para voltar, é só entrar de novo.</p>
    <div class="actions column">
      <button class="btn danger" data-sair>${E.out}Sair da conta</button>
      <button class="btn" data-close>Cancelar</button>
    </div>`);e.querySelector("[data-sair]").onclick=async()=>{a(),await fe(f).catch(()=>{}),await f.auth.signOut(),j("/"),b("Você saiu da conta.")}}async function so(){const e=window.appColor.get(),a=g.user,t=g.profile?.name||"Seu perfil",n=(g.profile?.name||a?.email||"?").trim()[0].toUpperCase(),o=`
    <div class="li app-colors" role="group" aria-labelledby="app-colors-title">
      <div class="app-colors-head">
        <span class="li-ico" aria-hidden="true">${E.palette}</span>
        <span class="grow"><span id="app-colors-title">Cor do app</span><small class="hint">Muda a barra do navegador e os botões. Vale só neste aparelho.</small></span>
      </div>
      <div class="swatches">${tt.map(([l,r])=>`
        <button type="button" class="swatch${l===e?" on":""}" data-color="${l}" style="--swatch:${l}" aria-label="${r}" title="${r}" aria-pressed="${l===e}"></button>`).join("")}
        <label class="swatch custom${tt.some(([l])=>l===e)?"":" on"}" title="Outra cor">
          <input type="color" value="${e}" aria-label="Outra cor">
        </label>
      </div>
    </div>`;T.innerHTML=`
    <div class="menu-page">
      <header class="page-head"><h1>Menu</h1></header>
      ${a?`
        <section class="profile-card">
          <div class="profile-row profile-body">
            <span class="avatar">${$(n)}</span>
            <div class="grow"><h2>${$(t)}</h2><div class="profile-email">${$(a.email||"")}</div></div>
          </div>
          <a class="btn profile-edit" href="#/perfil">Editar perfil</a>
        </section>
        ${Vt("Minha conta",[U({href:"#/minhas",ico:E.tag,label:"Minhas vendas"}),U({href:"#/minhas?aba=favoritas",ico:E.heart,label:"Favoritas"}),U({href:"#/chat",ico:E.chat,label:"Conversas",right:Ot(g.chatUnread,"m-chat")}),U({href:"#/notificacoes",ico:E.bell,label:"Notificações",right:Ot(g.unread,"m-notif")}),U({href:"#/perfil",ico:E.user,label:"Dados da conta, WhatsApp e Pix"}),U({href:"#/anunciar",ico:E.camera,label:"Anunciar uma venda"})])}`:`
        <section class="profile-card"><div class="profile-body">
          <h2>Entre na sua conta</h2>
          <p class="profile-text">Para anunciar, salvar vendas e conversar com vendedores.</p>
          <a class="btn" href="#/entrar">Entrar</a>
        </div></section>`}
      ${Vt("App",[U({ico:E.download,label:"Instalar o app",attrs:`id="menu-install"${Yt()?"":" hidden"}`}),U({ico:E.moon,label:"Tema",attrs:'id="menu-theme"',right:`<span class="li-value" id="menu-theme-value">${zt[at()]}</span>`}),o,U({href:"regras.html",ico:E.flag,label:"Regras para anunciar"}),U({href:"privacidade.html",ico:E.doc,label:"Política de Privacidade"}),U({href:"termos.html",ico:E.doc,label:"Termos de Uso"}),a?U({ico:E.out,label:"Sair da conta",right:"",attrs:'id="menu-logout"'}):""])}
      <p class="menu-foot">Desapega</p>
    </div>`;const s=l=>{window.appColor.set(l);const r=tt.some(([i])=>i===l);T.querySelectorAll(".swatch").forEach(i=>{const d=i.dataset.color?i.dataset.color===l:!r;i.classList.toggle("on",d),i.dataset.color&&i.setAttribute("aria-pressed",String(d))})};T.querySelectorAll(".swatch[data-color]").forEach(l=>l.addEventListener("click",()=>s(l.dataset.color))),T.querySelector(".swatch.custom input").addEventListener("input",l=>s(l.target.value)),document.getElementById("menu-install").addEventListener("click",Gt),document.getElementById("menu-theme").addEventListener("click",oo),document.getElementById("menu-logout")?.addEventListener("click",no)}const ro={data:"a data",horário:"o horário",endereço:"o endereço"},io=e=>e.length>1?`${e.slice(0,-1).join(", ")} e ${e.at(-1)}`:e[0]||"";function co(e){const a=e.sale_title||"uma venda";switch(e.kind){case"lembrete_vespera":return{icon:E.bell,cls:"remind",title:`Amanhã: ${a}`,body:"Uma venda que você salvou começa amanhã. Veja os itens e a rota."};case"lembrete_hoje":return{icon:E.bell,cls:"remind",title:`Hoje: ${a}`,body:"Uma venda que você salvou começa hoje. Bom garimpo!"};case"venda_alterada":{const t=io((e.detail||"").split(",").map(n=>ro[n]).filter(Boolean))||"os dados";return{icon:E.calendar,cls:"change",title:`Mudou: ${a}`,body:`O vendedor alterou ${t}. Confira antes de ir.`}}case"venda_cancelada":return{icon:E.flag,cls:"cancel",title:`Cancelada: ${a}`,body:"O vendedor removeu esta venda."};case"venda_salva":return{icon:E.heart,cls:"saved",title:e.count>1?`${e.count} pessoas salvaram sua venda`:"Alguém salvou sua venda",body:`"${a}". Quem salva recebe lembrete na véspera e no dia.`};case"venda_oculta":return{icon:E.flag,cls:"cancel",title:"Sua venda saiu do ar",body:`"${a}" foi ocultada após denúncias e não aparece mais nas buscas.`};case"venda_perto":return{icon:E.pin,cls:"remind",title:`Venda nova perto de você: ${a}`,body:`${e.detail||"Na sua região"}. Veja os itens antes de todo mundo.`};case"venda_liberada":return{icon:E.flag,cls:"saved",title:"Sua venda voltou ao ar",body:`A moderação revisou "${a}" e ela aparece de novo nas buscas.`};case"denuncia_revisar":return{icon:E.flag,cls:"cancel",title:e.detail==="oculta"?`Oculta por denúncias: ${a}`:`Denúncia: ${a}`,body:`${e.count>1?`${e.count} pessoas denunciaram`:"Uma pessoa denunciou"} esta venda. Toque para revisar.`};default:return{icon:E.bell,cls:"",title:a,body:""}}}function ot(e){const a=Math.round((Date.now()-new Date(e))/6e4);if(a<1)return"agora";if(a<60)return`há ${a} min`;if(a<1440)return`há ${Math.round(a/60)} h`;const t=new Date(e);return B(t)===B(Y(new Date,-1))?"ontem":t.toLocaleDateString("pt-BR",{day:"numeric",month:"short"}).replace(/\./g,"")}async function lo(e){if(!V("/notificacoes","Entre para ver suas notificações."))return;T.innerHTML=`
    <div class="notif-page">
      <div class="notif-head"><h1>Notificações</h1><span id="notif-tools"></span></div>
      <div id="notif-list"><div class="notif-list" aria-busy="true" aria-label="Carregando">${'<div class="notif"><span class="notif-icon sk"></span><span class="sk notif-sk"></span></div>'.repeat(4)}</div></div>
    </div>`;const{data:a,error:t}=await f.from("notifications").select("id,kind,sale_id,sale_title,detail,count,read_at,created_at").order("created_at",{ascending:!1}).limit(100);if(t)throw t;if(!e.alive())return;const n=document.getElementById("notif-list");if(!a.length){n.innerHTML=`
      <div class="empty">
        <h2>Nenhuma notificação ainda</h2>
        <p>Salve vendas para receber aqui o lembrete na véspera e no dia, e saber se mudarem de data ou endereço.</p>
        <div id="reminders"></div>
        <a class="btn" href="#/">Ver vendas</a>
      </div>`,oe(document.getElementById("reminders"),{compact:!0});return}const o=i=>{const d=co(i),c=`
      <span class="notif-icon ${d.cls}">${d.icon}</span>
      <span class="notif-text"><strong>${$(d.title)}</strong><span>${$(d.body)}</span><time datetime="${$(i.created_at)}">${ot(i.created_at)}</time></span>`,m=`notif ${i.read_at?"":"unread"}`;return i.sale_id?`<a class="${m}" href="#/venda/${i.sale_id}">${c}</a>`:`<div class="${m}">${c}</div>`},s=a.filter(i=>!i.read_at),l=a.filter(i=>i.read_at);n.innerHTML=`
    ${s.length?`<h2 class="section-title">Novas</h2><div class="notif-list">${s.map(o).join("")}</div>`:""}
    ${l.length?`<h2 class="section-title">Anteriores</h2><div class="notif-list">${l.map(o).join("")}</div>`:""}
    <div id="reminders"></div>`,oe(document.getElementById("reminders"),{compact:!0});const r=document.getElementById("notif-tools");if(r.innerHTML='<button class="btn small" id="notif-clear">Limpar tudo</button>',document.getElementById("notif-clear").onclick=async()=>{const{error:i}=await f.from("notifications").delete().eq("user_id",g.user.id);if(i)return b("Não foi possível limpar as notificações.","error",i);b("Notificações apagadas."),O()},s.length){const{error:i}=await f.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",g.user.id).is("read_at",null);i||(g.unread=0,Ne())}}async function uo(e){if(g.user){const t=sessionStorage.getItem("next")||"/";return sessionStorage.removeItem("next"),j(t)}const a=e.params.get("msg");T.innerHTML=`
    <div class="auth">
      <h1>Entrar</h1>
      <p class="hint">${$(a||"Navegar é livre. O cadastro só é pedido para anunciar, salvar vendas ou falar com o vendedor.")}</p>
      <button class="btn google big" id="google">
        <svg viewBox="0 0 24 24" class="g"><path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4z"/></svg>
        Entrar com Google
      </button>
      <div class="or"><span>ou</span></div>
      <form id="email-form">
        <label>Seu e-mail<input type="email" name="email" required autocomplete="email" placeholder="voce@exemplo.com"></label>
        <button class="btn primary big">Receber link de acesso</button>
      </form>
      <p class="legal">Ao entrar, você concorda com os <a href="termos.html">Termos de Uso</a> e a <a href="privacidade.html">Política de Privacidade</a>.</p>
    </div>`,document.getElementById("google").onclick=async()=>{const{error:t}=await f.auth.signInWithOAuth({provider:"google",options:{redirectTo:ge}});t&&b(t.message,"error",t)},document.getElementById("email-form").addEventListener("submit",async t=>{t.preventDefault();const n=t.target.email.value.trim(),o=t.target.querySelector("button");o.disabled=!0;const{error:s}=await f.auth.signInWithOtp({email:n,options:{emailRedirectTo:ge}});if(o.disabled=!1,s)return b(s.message,"error",s);t.target.innerHTML=`<div class="notice"><strong>Confira seu e-mail.</strong><p>Enviamos um link de acesso para ${$(n)}. Abra-o neste mesmo aparelho e navegador.</p></div>`})}async function po(e){if(!V("/perfil"))return;const a=e.params.get("msg"),t=g.contact||{};T.innerHTML=`
    <form id="profile-form" class="form">
      <h1>Seu perfil</h1>
      ${a?`<div class="notice">${$(a)}</div>`:""}
      <p class="hint">${$(g.user.email||"")}</p>
      <label>Nome que aparece nas vendas
        <input name="name" required maxlength="80" value="${$(g.profile?.name)}">
      </label>
      <fieldset class="pix-box">
        <legend>${E.chat} Chat com compradores</legend>
        <label class="check"><input type="checkbox" name="chat_enabled" ${g.profile?.chat_enabled===!1?"":"checked"}> Receber mensagens dos compradores pelo chat</label>
        <p class="hint">Desligue se você só quer divulgar a venda: o botão "Tenho interesse" some das suas vendas e ninguém manda mensagem, nem nas conversas que já existem. Você continua vendo e respondendo as conversas antigas.</p>
      </fieldset>
      <fieldset class="pix-box">
        <legend>${E.whatsapp} WhatsApp (opcional)</legend>
        <p class="hint">Os compradores falam com você pelo <strong>chat do app</strong>, sem ver seu número. Se preferir, libere também o WhatsApp.</p>
        <label>WhatsApp com DDD
          <input name="whatsapp" type="tel" inputmode="tel" placeholder="(61) 99999-9999" value="${$(vt(t.whatsapp))}">
        </label>
        <label class="check"><input type="checkbox" name="show_whatsapp" ${t.show_whatsapp?"checked":""}> Mostrar o botão do WhatsApp nas minhas vendas</label>
        <p class="hint">Desmarcado, seu número fica guardado e ninguém vê. Marcado, aparece para compradores logados que tocarem em "Falar no WhatsApp".
          ${t.whatsapp?t.phone_verified?'<span class="ok">Telefone verificado ✓</span>':g.requireVerification?'<span class="warn">Telefone ainda não verificado</span>':"":""}</p>
      </fieldset>
      <div id="otp-box"></div>

      <fieldset class="pix-box">
        <legend>${E.pix} Receber por Pix (opcional)</legend>
        <p class="hint">Com a chave cadastrada, cada item mostra um QR Code com o valor já preenchido. O dinheiro vai direto para a sua conta, sem taxas. A chave só aparece para compradores logados.</p>
        <div class="row">
          <label>Tipo de chave
            <select name="pix_type">
              ${Object.entries(it).map(([l,r])=>`<option value="${l}" ${l===(t.pix_key?ct(t.pix_key):"aleatoria")?"selected":""}>${r}</option>`).join("")}
            </select>
          </label>
          <label>Chave Pix
            <input name="pix_key" value="${$(t.pix_key?ta(t.pix_key):"")}" autocomplete="off">
          </label>
        </div>
        <p class="hint">Recomendamos a <strong>chave aleatória</strong>: crie uma no app do seu banco, em Pix &gt; Minhas chaves.</p>
        <div class="notice warn-box" id="pix-cpf-warning" ${ct(t.pix_key)==="cpf"&&t.pix_key?"":"hidden"}>
          <p><strong>Atenção:</strong> com chave CPF ou CNPJ, quem for pagar vê o seu documento. Prefira a chave aleatória.</p>
        </div>
        <label>Nome do recebedor (como aparece no banco)
          <input name="pix_name" maxlength="25" value="${$(t.pix_name||"")}" placeholder="${$((g.profile?.name||"").slice(0,25))}">
        </label>
      </fieldset>

      <fieldset class="pix-box prefs-form">
        <legend>${E.bell} Alertas e novidades</legend>
        ${Ct(g.prefs)}
      </fieldset>

      <button class="btn primary big">Salvar</button>
    </form>
    <div class="form">
      <div id="reminders"></div>
      <button class="btn big" id="logout">Sair da conta</button>
      <details class="danger-zone">
        <summary>Excluir minha conta</summary>
        <p>Isso apaga para sempre sua conta, suas vendas, itens, fotos e favoritas. Não dá para desfazer.</p>
        <label>Para confirmar, digite <strong>EXCLUIR</strong>
          <input id="delete-confirm" autocomplete="off">
        </label>
        <button class="btn danger big" id="delete-account">Excluir minha conta para sempre</button>
      </details>
    </div>`;const n=document.getElementById("profile-form"),o=document.getElementById("otp-box");n.pix_type.addEventListener("change",()=>{document.getElementById("pix-cpf-warning").hidden=n.pix_type.value!=="cpf"});const s=async()=>{await Re(g.user);const l=sessionStorage.getItem("next");sessionStorage.removeItem("next"),l&&$t()?j(l):O()};n.addEventListener("submit",async l=>{l.preventDefault();const r=n.whatsapp.value.trim(),i=r?ua(r):null;if(r&&!i)return b("Informe um celular válido com DDD.","error");const d=n.show_whatsapp.checked;if(d&&!i)return b("Para mostrar o botão do WhatsApp, informe o número.","error");const c=n.pix_key.value.trim(),m=c?ea(n.pix_type.value,c):null;if(c&&!m)return b(`Chave Pix inválida para o tipo "${it[n.pix_type.value]}".`,"error");const u=m?n.pix_name.value.trim()||n.name.value.trim().slice(0,25):null,x=It(n);if(n.alerts.checked&&!x.home_region)return b("Para receber alertas, escolha a região onde você mora.","error");const h=await f.from("profiles").update({name:n.name.value.trim(),chat_enabled:n.chat_enabled.checked}).eq("id",g.user.id);if(h.error)return b(h.error.message,"error",h.error);try{await Ke(x)}catch(y){return b(`Erro ao salvar os alertas: ${y.message}`,"error",y)}if(d!==!!t.show_whatsapp){const y=await f.from("contacts").update({show_whatsapp:d}).eq("user_id",g.user.id);if(y.error)return b(`Erro ao salvar a opção do WhatsApp: ${y.error.message}`,"error",y.error)}if(m!==(t.pix_key||null)||u!==(t.pix_name||null)){const y=await f.from("contacts").update({pix_key:m,pix_name:u}).eq("user_id",g.user.id);if(y.error)return b(`Erro ao salvar o Pix: ${y.error.message}`,"error",y.error)}const _=i!==(t.whatsapp||null);if(g.requireVerification&&i&&!(_===!1&&t.phone_verified)){const{error:y}=await f.auth.updateUser({phone:"+"+i});if(y)return b(y.message,"error",y);o.innerHTML=`
        <div class="notice">
          <label>Digite o código enviado por SMS para ${vt(i)}
            <input name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8">
          </label>
          <button type="button" class="btn primary" id="verify">Confirmar código</button>
        </div>`,document.getElementById("verify").onclick=async()=>{const q=o.querySelector("input").value.trim(),{error:C}=await f.auth.verifyOtp({phone:"+"+i,token:q,type:"phone_change"});if(C)return b("Código inválido ou expirado.","error");b("Telefone verificado!"),s()};return}if(_){const y=await f.from("contacts").update({whatsapp:i}).eq("user_id",g.user.id);if(y.error)return b(y.error.message,"error",y.error)}b("Perfil salvo."),s()}),oe(document.getElementById("reminders")),document.getElementById("logout").onclick=async()=>{await fe(f).catch(()=>{}),await f.auth.signOut(),j("/")},document.getElementById("delete-account").onclick=async l=>{if(document.getElementById("delete-confirm").value.trim().toUpperCase()!=="EXCLUIR")return b("Digite EXCLUIR para confirmar.","error");const r=l.currentTarget;r.disabled=!0,r.textContent="Excluindo…";try{const i=f.storage.from("photos");for(let c=0;c<50;c++){const{data:m,error:u}=await i.list(g.user.id,{limit:100});if(u)throw u;if(!m.length)break;const{data:x,error:h}=await i.remove(m.map(_=>`${g.user.id}/${_.name}`));if(h)throw h;if(!x?.length)throw new Error("as fotos não puderam ser apagadas.")}await fe(f).catch(()=>{});const{error:d}=await f.rpc("delete_my_account");if(d)throw d;await f.auth.signOut({scope:"local"}),b("Sua conta foi excluída."),j("/")}catch(i){b(`Não foi possível excluir a conta: ${i.message}`,"error",i),r.disabled=!1,r.textContent="Excluir minha conta para sempre"}}}function mo(){const e=window.visualViewport;if(!e)return;const a=()=>{const t=e.scale<1.05&&window.innerHeight-e.height>120;document.documentElement.classList.toggle("teclado",t),t?document.documentElement.style.setProperty("--app-h",`${Math.round(e.height)}px`):document.documentElement.style.removeProperty("--app-h")};e.addEventListener("resize",a),a()}async function ho(){if(Kt(R.SENTRY_DSN),mo(),document.getElementById("app-name").textContent=R.APP_NAME,!ut){T.innerHTML=`
      <div class="empty">
        <h2>Falta configurar o Supabase</h2>
        <p>Edite <code>js/config.js</code> com a URL e a chave anon do seu projeto, e rode <code>supabase/schema.sql</code> no SQL Editor. Veja o README.</p>
      </div>`;return}const e=new URLSearchParams(location.search),a=/^#(access_token|error)=/.test(location.hash)?new URLSearchParams(location.hash.slice(1)):null,t=e.get("error_description")??a?.get("error_description"),{data:n}=await f.auth.getSession();(location.search||a)&&history.replaceState(null,"",location.pathname+(a?"#/":location.hash)),a?.get("error_code")==="otp_expired"?b("Esse link já foi usado ou venceu. Peça outro na tela de Entrar.","error"):t?b(t,"error"):e.has("code")&&!n.session&&b("Não deu para entrar com esse link. Abra-o no mesmo aparelho e navegador em que você pediu, ou peça outro.","error");const[,o]=await Promise.all([Re(n.session?.user??null),f.rpc("require_phone_verification")]);g.requireVerification=!!o.data,f.auth.onAuthStateChange((l,r)=>{["SIGNED_IN","SIGNED_OUT","USER_UPDATED"].includes(l)&&((r?.user?.id??null)===(g.user?.id??null)&&l!=="USER_UPDATED"||setTimeout(async()=>{await Re(r?.user??null),l==="SIGNED_OUT"&&O()},0))});const s=sessionStorage.getItem("next");n.session&&s&&(location.hash===""||location.hash==="#/"||location.hash.startsWith("#/entrar"))&&(sessionStorage.removeItem("next"),history.replaceState(null,"",location.pathname+"#"+s)),window.addEventListener("hashchange",O),O()}const vo='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',fo='<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',Wt=matchMedia("(prefers-color-scheme: dark)"),nt=()=>(document.documentElement.dataset.theme||(Wt.matches?"dark":"light"))==="dark";function Me(){const e=document.getElementById("theme-toggle"),a=nt()?"Mudar para modo claro":"Mudar para modo escuro";e.innerHTML=nt()?vo:fo,e.setAttribute("aria-label",a),e.title=a;const t=document.getElementById("menu-theme-value");t&&(t.textContent=zt[at()])}document.getElementById("theme-toggle").addEventListener("click",()=>{const e=nt()?"light":"dark";document.documentElement.dataset.theme=e;try{localStorage.setItem("tema",e)}catch{}Me()}),Wt.addEventListener("change",Me),Me(),"serviceWorker"in navigator&&navigator.serviceWorker.register("sw.js").catch(()=>{}),ho();
