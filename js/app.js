import{createClient as Bt}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";import{CONFIG as R}from"./config.js";import{REGIONS as oe,DF_CENTER as ot,regionByName as me,SALE_TYPES as Y,CATEGORIES as V,REPORT_REASONS as Rt}from"./data.js";import{maybeSuggestInstall as nt}from"./install.js";import{stripMetadata as jt}from"./metadata.js";import{initMonitoring as Nt,reportError as Me}from"./monitoring.js";import{saleStatus as he,distanceKm as j,formatDistance as ne,googleCalendarUrl as Ht,icsFor as Ot}from"./when.js";import{PIX_TYPES as st,guessPixType as rt,normalizePixKey as Ut,formatPixKey as Vt,pixPayload as zt,qrSvg as it,qrImage as Wt}from"./pix.js";import{pushSupport as Te,remindersActive as Ft,enableReminders as Xt,disableReminders as ve,syncReminders as Yt}from"./reminders.js";function ct(e){return e&&e.closest&&e.closest(".pode-zoom, .leaflet-container")}["gesturestart","gesturechange","gestureend"].forEach(e=>{document.addEventListener(e,a=>{ct(a.target)||a.preventDefault()},{passive:!1})}),document.addEventListener("touchmove",e=>{e.touches.length>1&&!ct(e.target)&&e.preventDefault()},{passive:!1});const T=document.getElementById("view"),lt=!R.SUPABASE_URL.includes("SEU-PROJETO"),v=lt?Bt(R.SUPABASE_URL,R.SUPABASE_ANON_KEY,{auth:{flowType:"pkce",detectSessionInUrl:!0,persistSession:!0}}):null,fe=location.origin+location.pathname.replace(/index\.html$/,""),f={user:null,profile:null,contact:null,favorites:new Set,requireVerification:!1,unread:0,chatUnread:0},w=e=>String(e??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a]),Q=e=>e==null?"A combinar":Number(e)===0?"Grátis":Number(e).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),B=e=>new Date(e.getTime()-e.getTimezoneOffset()*6e4).toISOString().slice(0,10),F=e=>{const[a,t,n]=e.split("-").map(Number);return new Date(a,t-1,n)},X=(e,a)=>new Date(e.getFullYear(),e.getMonth(),e.getDate()+a),D=()=>B(new Date),dt=60,ut=7,Pe=()=>B(X(new Date,dt));function pt(e,a){return a<e?"O último dia não pode ser antes do início.":e>Pe()?`A venda precisa começar em até ${dt} dias.`:(F(a)-F(e))/864e5>=ut?`A venda pode durar no máximo ${ut} dias.`:null}function ge(e){const a=F(e),t=D();return e===t?"Hoje":e===B(X(new Date,1))?"Amanhã":a.toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"}).replace(/\./g,"")}function Qt(e){const a=F(e),t=a.toLocaleDateString("pt-BR",{weekday:"long"}).replace("-feira","");if(e===D())return"Hoje";if(e===B(X(new Date,1)))return`Amanhã, ${t}`;const n=a.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});return n.charAt(0).toUpperCase()+n.slice(1)}const be=e=>{if(!e)return"";const[a,t]=e.split(":");return`${Number(a)}h${t==="00"?"":t}`};function $e(e){return`${e.starts_on===e.ends_on?ge(e.starts_on):`${ge(e.starts_on)} a ${ge(e.ends_on)}`} · ${be(e.start_time)}–${be(e.end_time)}`}function Gt(){const e=new Date,a=(6-e.getDay()+7)%7;return X(e,a)}function Kt(){const e=new Date;return X(e,(7-e.getDay())%7)}function Zt(e){return String(e??"").replace(/\D/g,"")}function Jt(e){let a=Zt(e);return(a.length===10||a.length===11)&&(a="55"+a),/^55\d{10,11}$/.test(a)?a:null}function mt(e){if(!e)return"";const a=e.match(/^55(\d{2})(\d{4,5})(\d{4})$/);return a?`(${a[1]}) ${a[2]}-${a[3]}`:e}function se(e){const a=String(e??"").trim();if(!a)return null;const t=Number(a.replace(/[^\d,.-]/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",","."));return Number.isFinite(t)&&t>=0?Math.round(t*100)/100:null}let ht;function g(e,a="",t=null,n=null){t&&!bt(t)&&Me(t,(location.hash.split("?")[0]||"#/").replace(/[0-9a-f-]{36}/g,":id"));const o=document.getElementById("toast");if(o.textContent=e,n){const s=document.createElement("button");s.type="button",s.className="toast-action",s.textContent=n.label,s.onclick=()=>{o.hidden=!0,n.run()},o.append(" ",s)}o.className=`toast ${a}`,o.hidden=!1,clearTimeout(ht),ht=setTimeout(()=>o.hidden=!0,a==="error"?9e3:n?6e3:3500)}const ea="DS400",ye=e=>e?.code===ea?null:e,Ce=(e,a)=>Object.assign(new Error(`${e}: ${a.message}`),{code:a.code}),N=e=>location.hash="#"+e,we=e=>`${fe}v/${e}/`;function O(e,a="",{keep:t=!1}={}){const n=document.createElement("div");n.className="modal-backdrop",n.innerHTML=`<div class="modal ${a}" role="dialog" aria-modal="true">${e}</div>`;const o=()=>n.remove();return n.addEventListener("click",s=>{(s.target===n&&!t||s.target.closest("[data-close]"))&&o()}),document.body.appendChild(n),{el:n.querySelector(".modal"),close:o}}const E={heart:'<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',share:'<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/></svg>',pin:'<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.7-6-11a6 6 0 0 1 12 0c0 5.3-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',camera:'<svg viewBox="0 0 24 24"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',flag:'<svg viewBox="0 0 24 24"><path d="M5 21V4m0 0h11l-2 4 2 4H5"/></svg>',tag:'<svg viewBox="0 0 24 24"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',calendar:'<svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',chat:'<svg viewBox="0 0 24 24"><path d="M4 5.5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',send:'<svg viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-3-7z"/><path d="m11 13 9-9"/></svg>',user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',out:'<svg viewBox="0 0 24 24"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/></svg>',doc:'<svg viewBox="0 0 24 24"><path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h6"/></svg>',chevron:'<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',target:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg>',palette:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.9 1.4-2l-.4-1a1.5 1.5 0 0 1 1.4-2H17a4 4 0 0 0 4-4c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/></svg>',trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',bell:'<svg viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',pix:'<svg viewBox="0 0 24 24"><path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/><path d="M8 12h8"/></svg>',whatsapp:'<svg viewBox="0 0 24 24"><path d="M4 20l1.2-3.8A8 8 0 1 1 8 19z"/><path d="M9 9.5c.5 2.5 2.5 4.5 5 5l1.2-1.2 2 1-.4 1.6c-4.4.4-9-4.2-8.6-8.6L9.8 7l1 2z"/></svg>'};function ta(e){return{google:`https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}`,waze:`https://waze.com/ul?ll=${e.lat},${e.lng}&navigate=yes`}}let K=[];const aa=[[-16.4,-48.65],[-15.2,-47.05]];function Ie(e,a,t,{recenter:n,...o}={}){const s=L.map(e,{scrollWheelZoom:!1,maxBounds:aa,maxBoundsViscosity:.9,minZoom:9,...o}).setView(a,t);L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap"}).addTo(s);const l=L.Control.extend({options:{position:"topleft"},onAdd(){const i=L.DomUtil.create("button","map-recenter leaflet-bar");return i.type="button",i.title="Centralizar o mapa",i.setAttribute("aria-label","Centralizar o mapa"),i.innerHTML=E.target,L.DomEvent.disableClickPropagation(i),L.DomEvent.on(i,"click",u=>{L.DomEvent.preventDefault(u),n?n(s):s.setView(a,t)}),i}});s.addControl(new l);const r=setTimeout(()=>s.invalidateSize({animate:!1}),50);return K.push(()=>{clearTimeout(r),s.stop(),s.remove()}),s}const _e=e=>L.divIcon({className:`pin pin-${e}`,html:"<span></span>",iconSize:[30,30],iconAnchor:[15,30],popupAnchor:[0,-28]});async function De(e){if(f.user=e,f.profile=null,f.contact=null,f.favorites=new Set,f.moderator=!1,f.prefs=void 0,e){const[a,t,n,o,s]=await Promise.all([v.from("profiles").select("id,name,chat_enabled").eq("id",e.id).maybeSingle(),v.from("contacts").select("whatsapp,phone_verified,pix_key,pix_name,show_whatsapp").eq("user_id",e.id).maybeSingle(),v.from("favorites").select("sale_id").eq("user_id",e.id),v.from("moderators").select("user_id").eq("user_id",e.id).maybeSingle(),v.from("preferences").select("home_region,nearby,regions,interests,alerts,news_email").eq("user_id",e.id).maybeSingle()]);f.prefs=s.error?void 0:s.data,f.profile=a.data,f.contact=t.data,f.favorites=new Set((n.data||[]).map(l=>l.sale_id)),f.moderator=!!o.data,Yt(v).catch(()=>{})}oa(),z(!0),ja()}let vt=0,ft=0;async function z(e=!1){if(!f.user)return f.unread=0,f.chatUnread=0,Be();if(!e&&Date.now()-vt<3e4)return;vt=Date.now();const a=++ft,[t,n]=await Promise.all([v.from("notifications").select("id",{count:"exact",head:!0}).is("read_at",null),v.rpc("chat_unread_count")]);a===ft&&(t.error||(f.unread=t.count||0),n.error||(f.chatUnread=n.data||0),Be())}function Be(){const e=document.getElementById("notif-badge");e.hidden=!f.unread,e.textContent=f.unread>9?"9+":String(f.unread),document.getElementById("notif-link").setAttribute("aria-label",f.unread?`Notificações: ${f.unread} nova(s)`:"Notificações");const a=document.getElementById("chat-badge");a.hidden=!f.chatUnread,a.textContent=f.chatUnread>9?"9+":String(f.chatUnread),document.getElementById("chat-tab").setAttribute("aria-label",f.chatUnread?`Chat: ${f.chatUnread} conversa(s) com mensagem nova`:"Chat")}document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&(J||z(),window.dispatchEvent(new Event("chat-resync")))}),navigator.serviceWorker?.addEventListener("message",e=>{if(e.data?.type!=="push")return;J&&e.data.url?.endsWith(`/chat/${J}`)&&document.visibilityState==="visible"||z(!0),window.dispatchEvent(new Event("chat-resync"))});function oa(){const e=document.getElementById("account-link");f.user?(e.textContent=f.profile?.name?.split(" ")[0]||"Perfil",e.href="#/perfil"):(e.textContent="Entrar",e.href="#/entrar"),document.getElementById("notif-link").hidden=!f.user}function U(e,a="Entre para continuar."){return f.user?!0:(sessionStorage.setItem("next",e),N("/entrar?msg="+encodeURIComponent(a)),!1)}function gt(){return!f.requireVerification||!!f.contact?.phone_verified}const na=[[/^\/$/,ra],[/^\/buscar$/,ia],[/^\/anunciar$/,Ct],[/^\/venda\/([\w-]+)$/,ca],[/^\/venda\/([\w-]+)\/editar$/,Ct],[/^\/venda\/([\w-]+)\/cartaz$/,Sa],[/^\/minhas$/,Ba],[/^\/entrar$/,Ya],[/^\/perfil$/,Qa],[/^\/notificacoes$/,Xa],[/^\/menu$/,Va],[/^\/chat$/,Ha],[/^\/chat\/([\w-]+)$/,Ua]];let Re=!1;addEventListener("pagehide",()=>Re=!0),addEventListener("pageshow",()=>Re=!1);const bt=e=>/Failed to fetch|Load failed|NetworkError|network/i.test(`${e?.message} ${e?.details}`);let $t=0;async function H(){K.forEach(r=>r()),K=[];const e=++$t,a=location.hash.slice(1)||"/",[t,n]=a.split("?"),o=new URLSearchParams(n||""),s=t.startsWith("/chat")?"/chat":["/menu","/minhas","/perfil","/notificacoes"].includes(t)?"/menu":t;document.querySelectorAll("[data-nav]").forEach(r=>r.classList.toggle("active",r.dataset.nav===s));const l={params:o,path:t,alive:()=>e===$t};document.getElementById("notif-link").classList.toggle("active",t==="/notificacoes"),t!=="/notificacoes"&&z();for(const[r,i]of na){const u=t.match(r);if(u){T.scrollTo(0,0);try{await i(l,...u.slice(1))}catch(c){if(Re||!l.alive())return;if(bt(c)){T.innerHTML=`
          <div class="empty">
            <h2>Sem conexão</h2>
            <p>Não conseguimos carregar agora. Confira sua internet e tente de novo.</p>
            <button class="btn primary" id="retry">Tentar de novo</button>
          </div>`,document.getElementById("retry").onclick=H;return}console.error(c),Me(c,`tela ${t.replace(/[0-9a-f-]{36}/g,":id")}`),T.innerHTML=`<div class="empty"><h2>Algo deu errado</h2><p>${w(c.message)}</p><a class="btn" href="#/">Voltar ao início</a></div>`}return}}T.innerHTML='<div class="empty"><h2>Página não encontrada</h2><a class="btn" href="#/">Voltar ao início</a></div>'}function yt(e){const a=he(e);return a.key==="agora"||a.key==="hoje"?`<span class="badge status-${a.key}">${w(a.label)}</span>`:""}function ee(e){const a=Y[e.type],t=e.items?.[0]?.count??0,n=f.favorites.has(e.id),o=re()?ne(j(re(),e)):"";return`
    <a class="sale-card ${e.type==="mudanca"?"highlight":""}" href="#/venda/${e.id}">
      <div class="thumb type-bg-${e.type}">
        ${e.cover_url?`<img src="${w(He(e.cover_url))}" alt="" loading="lazy" decoding="async">`:E.tag}
        ${n?`<span class="fav-dot" title="Favorita">${E.heart}</span>`:""}
      </div>
      <div class="body">
        <div class="badges"><span class="badge type-${e.type}">${a.label}</span>${e.draft?'<span class="badge draft">Rascunho</span>':yt(e)}</div>
        <h3>${w(e.title)}</h3>
        <p class="meta">${E.clock}${$e(e)}</p>
        <p class="meta">${E.pin}${o?`<strong>${o}</strong> · `:""}${w(e.region)}${t?` · ${t} ${t===1?"item":"itens"}`:""}</p>
      </div>
    </a>`}const je=(e=4)=>`<div class="cards" aria-busy="true" aria-label="Carregando">${'<div class="sale-card skeleton"><div class="thumb"></div><div class="body"><span></span><span></span><span></span></div></div>'.repeat(e)}</div>`,Ne=[2,5,10,20];function re(){try{return JSON.parse(sessionStorage.getItem("minha-posicao"))}catch{return null}}function sa(){return new Promise((e,a)=>{if(!navigator.geolocation)return a(new Error("Seu aparelho não informa a localização."));navigator.geolocation.getCurrentPosition(t=>{const n={lat:t.coords.latitude,lng:t.coords.longitude};sessionStorage.setItem("minha-posicao",JSON.stringify(n)),e(n)},()=>a(new Error("Não foi possível obter sua localização. Confira se o navegador tem permissão.")),{enableHighAccuracy:!1,timeout:1e4,maximumAge:3e5})})}const Z=6,W=e=>e.photos?.length?e.photos:e.photo_url?[e.photo_url]:[],ie=e=>e.title||"Item sem título",Ee=/\.f\.(webp|jpg)$/,He=e=>e&&e.includes("/object/public/photos/")&&Ee.test(e)?e.replace(Ee,".t.$1"):e;function Oe(e){const a=W(e);return a.length?`<img src="${w(He(a[0]))}" alt="" loading="lazy">${a.length>1?`<span class="photo-count">${E.camera}${a.length}</span>`:""}`:`<div class="noimg">${E.tag}</div>`}async function Ue(e){const a="/object/public/photos/",t=[...new Set(e)].filter(r=>r&&r.includes(a)&&decodeURIComponent(r.split(a)[1]).startsWith(`${f.user.id}/`));if(!t.length)return;const[n,o]=await Promise.all([v.from("items").select("photo_url,photos").eq("owner_id",f.user.id),v.from("sales").select("cover_url").eq("owner_id",f.user.id)]);if(n.error||o.error)return;const s=new Set([...n.data.flatMap(r=>[r.photo_url,...r.photos||[]]),...o.data.map(r=>r.cover_url)]),l=t.filter(r=>!s.has(r)).flatMap(r=>{const i=decodeURIComponent(r.split(a)[1]);return Ee.test(i)?[i,i.replace(Ee,".t.$1")]:[i]});l.length&&await v.storage.from("photos").remove(l).catch(()=>{})}const G={disponivel:"Disponível",reservado:"Reservado",vendido:"Vendido"},xe="id,title,type,region,lat,lng,starts_on,ends_on,start_time,end_time,cover_url,draft,items(count)";async function ra(e){const a=e.params,t=a.get("quando")||"fds";let n=a.has("regiao")?a.get("regiao"):localStorage.getItem("regiao")||"";const o=a.get("tipo")||"",s=a.get("perto")==="1"&&!!re(),l=Ne.includes(Number(a.get("raio")))?Number(a.get("raio")):5,r=p=>{const q=new URLSearchParams({quando:t,regiao:n,tipo:o,...s?{perto:"1",raio:l}:{},...p});return q.get("perto")!=="1"&&(q.delete("perto"),q.delete("raio")),"#/?"+q.toString()};T.innerHTML=`
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
        ${oe.map(p=>`<option ${p.name===n?"selected":""}>${w(p.name)}</option>`).join("")}
      </select>
      <div class="chips">
        <button type="button" class="chip chip-near ${s?"on":""}" id="near" aria-pressed="${s}">${E.pin}Perto de mim</button>
        <a href="${r({tipo:""})}" class="chip ${o?"":"on"}">Todas</a>
        ${Object.entries(Y).map(([p,q])=>`<a href="${r({tipo:p})}" class="chip chip-${p} ${o===p?"on":""}">${q.short}</a>`).join("")}
      </div>
      ${s?`
        <div class="near-radius" role="group" aria-label="Distância máxima">
          <span>Até</span>
          ${Ne.map(p=>`<a href="${r({raio:p})}" class="chip ${p===l?"on":""}">${p} km</a>`).join("")}
        </div>`:""}
    </div>
    <div class="home-grid">
      <div id="home-map" class="map"></div>
      <div id="home-list">${je()}</div>
    </div>`,document.getElementById("f-region").addEventListener("change",p=>{localStorage.setItem("regiao",p.target.value),location.hash=r({regiao:p.target.value})}),document.getElementById("near").addEventListener("click",async p=>{if(s)return location.hash=r({perto:"0"});const q=p.currentTarget;q.disabled=!0;try{await sa(),location.hash=r({perto:"1",regiao:""})}catch(M){g(M.message,"error"),q.disabled=!1}});let i=v.from("sales").select(xe).eq("hidden",!1).eq("draft",!1).gte("ends_on",D()).order("starts_on").order("start_time").limit(200);t==="fds"&&(i=i.lte("starts_on",B(Kt()))),n&&(i=i.eq("region",n)),o&&(i=i.eq("type",o));const{data:u,error:c}=await i;if(!e.alive())return;if(c)throw c;const m=u.filter(p=>he(p).key!=="encerrada"),d=s?re():null,x=d?m.filter(p=>j(d,p)<=l).sort((p,q)=>j(d,p)-j(d,q)):m,b=me(n);let _=null;const A=(p,q=!0)=>{if(_)return p.fitBounds(_.getBounds(),{padding:[10,10],animate:q});const M=x.map(I=>[I.lat,I.lng]);M.length>1?p.fitBounds(M,{padding:[30,30],maxZoom:15,animate:q}):M.length===1?p.setView(M[0],15,{animate:q}):p.setView(b?[b.lat,b.lng]:ot,b?14:11,{animate:q})},$=Ie("home-map",d?[d.lat,d.lng]:b?[b.lat,b.lng]:ot,d?13:b?14:11,{recenter:A});d&&(_=L.circle([d.lat,d.lng],{radius:l*1e3,color:"#1c7ed6",weight:1.5,fillOpacity:.06,interactive:!1}).addTo($),L.marker([d.lat,d.lng],{icon:L.divIcon({className:"me-dot",html:"<span></span>",iconSize:[22,22],iconAnchor:[11,11]}),zIndexOffset:1e3,title:"Você está aqui"}).addTo($).bindTooltip("Você está aqui"));for(const p of d?m:x)L.marker([p.lat,p.lng],{icon:_e(p.type),opacity:d&&!x.includes(p)?.45:1}).addTo($).bindPopup(`<a href="#/venda/${p.id}"><strong>${w(p.title)}</strong></a><br>${$e(p)}${d?`<br>a ${ne(j(d,p))} de você`:""}`);A($,!1);const k=document.getElementById("home-list");if(d&&!x.length){const p=Ne.find(M=>M>l&&m.some(I=>j(d,I)<=M)),q=m.reduce((M,I)=>!M||j(d,I)<j(d,M)?I:M,null);k.innerHTML=`
      <div class="empty">
        <h2>Nenhuma venda a até ${l} km de você ${t==="fds"?"até domingo":""}</h2>
        ${q?`<p>A mais perto fica a ${ne(j(d,q))}, em ${w(q.region)}.</p>`:"<p>Ainda não há vendas marcadas com esses filtros.</p>"}
        ${p?`<a class="btn primary" href="${r({raio:p})}">Ver até ${p} km</a>`:""}
        ${t==="fds"?`<a class="btn" href="${r({quando:"todas"})}">Ver próximas datas</a>`:""}
      </div>`;return}if(!x.length){k.innerHTML=`
      <div class="empty">
        <h2>Nenhuma venda ${t==="fds"?"até domingo":"marcada"}${n?` em ${w(n)}`:""}</h2>
        <p>Vai fazer um bazar ou vender as coisas da mudança? Anunciar é grátis.</p>
        <a class="btn primary" href="#/anunciar">Anunciar uma venda</a>
        ${t==="fds"?`<a class="btn" href="${r({quando:"todas"})}">Ver próximas datas</a>`:""}
      </div>`;return}const P=x.filter(p=>he(p).key==="agora"),C=!o&&!d?x.filter(p=>p.type==="mudanca"&&!P.includes(p)):[],y=(p,q,M="")=>`<h2 class="section-title">${p}</h2>${M?`<p class="hint">${M}</p>`:""}<div class="cards strip">${q.map(ee).join("")}</div>`;let h;if(t==="fds"&&!d){const p=new Map;for(const q of x.filter(M=>!P.includes(M))){const M=q.starts_on>D()?q.starts_on:D();p.has(M)||p.set(M,[]),p.get(M).push(q)}h=[...p].sort(([q],[M])=>q.localeCompare(M)).map(([q,M])=>y(Qt(q),M)).join("")}else{const p=d?"Mais perto de você":P.length||C.length?"Todas as vendas":"";h=`${p?`<h2 class="section-title">${p}</h2>`:""}<div class="cards">${x.map(ee).join("")}</div>`}const S=d&&x[0];k.innerHTML=`
    ${d?`<p class="near-summary">${x.length} venda${x.length===1?"":"s"} a até ${l} km de você · a mais perto fica a <strong>${ne(j(d,S))}</strong>, em ${w(S.region)}.</p>`:""}
    ${P.length?`
      <h2 class="section-title"><span class="live-dot"></span>Acontecendo agora${d?" perto de você":""}</h2>
      <div class="cards strip">${P.map(ee).join("")}</div>`:""}
    ${C.length?y("Em destaque: vendas de mudança",C,"Quem se muda vende quase tudo, e rápido."):""}
    ${h}`}async function ia(e){const a=(e.params.get("q")||"").trim(),t=e.params.get("cat")||"";T.innerHTML=`
    <form id="search-form" class="search-form">
      <input type="search" name="q" value="${w(a)}" placeholder="Ex.: sofá, bicicleta, berço" autocomplete="off" enterkeyhint="search">
      <select name="cat" aria-label="Categoria">
        <option value="">Todas as categorias</option>
        ${Object.entries(V).map(([c,m])=>`<option value="${c}" ${c===t?"selected":""}>${m}</option>`).join("")}
      </select>
      <button class="btn primary">Buscar</button>
    </form>
    <div id="results"></div>`;const n=document.getElementById("search-form");if(n.addEventListener("submit",c=>{c.preventDefault();const m=new FormData(n);N(`/buscar?${new URLSearchParams({q:m.get("q").trim(),cat:m.get("cat")})}`)}),a||n.q.focus(),!a&&!t){document.getElementById("results").innerHTML='<p class="hint center">Procure itens em todas as vendas que ainda vão acontecer.</p>';return}const o=a.replace(/[%,()*\\]/g," ").trim(),s=document.getElementById("results");s.innerHTML=je(3);let l=v.from("items").select("id,title,price,category,photo_url,photos,status,sales!inner(id,title,region,starts_on,ends_on,start_time,end_time,hidden,draft,photos_only)").gte("sales.ends_on",D()).eq("sales.hidden",!1).eq("sales.draft",!1).neq("status","vendido").order("created_at",{ascending:!1}).limit(60);o&&(l=l.or(`title.ilike.%${o}%,description.ilike.%${o}%`)),t&&(l=l.eq("category",t));const r=o?v.from("sales").select(xe).eq("hidden",!1).eq("draft",!1).gte("ends_on",D()).or(`title.ilike.%${o}%,description.ilike.%${o}%`).order("starts_on").limit(30):Promise.resolve({data:[]}),[i,u]=await Promise.all([l,r]);if(e.alive()){if(i.error)throw i.error;if(u.error)throw u.error;if(!i.data.length&&!u.data.length){s.innerHTML='<div class="empty"><h2>Nada encontrado</h2><p>Tente outra palavra ou outra categoria.</p></div>';return}s.innerHTML=`
    ${i.data.length?`
      <h2 class="section-title">Itens (${i.data.length})</h2>
      <div class="items-grid">
        ${i.data.map(c=>`
          <a class="item status-${c.status}" href="#/venda/${c.sales.id}">
            <div class="photo">${Oe(c)}${c.status!=="disponivel"?`<span class="status-tag">${G[c.status]}</span>`:""}</div>
            <div class="info">
              <strong>${c.sales.photos_only?"Pergunte o preço":Q(c.price)}</strong>
              <span class="title">${w(c.sales.photos_only?c.sales.title:ie(c))}</span>
              <small>${w(c.sales.region)} · ${ge(c.sales.starts_on)}</small>
            </div>
          </a>`).join("")}
      </div>`:""}
    ${u.data.length?`<h2 class="section-title">Vendas</h2><div class="cards">${u.data.map(ee).join("")}</div>`:""}`}}async function ca(e,a){T.innerHTML=`
    <div class="sale skeleton-page" aria-busy="true" aria-label="Carregando venda">
      <div class="sk sk-cover"></div><div class="sk sk-line w40"></div><div class="sk sk-title"></div>
      <div class="sk sk-line w70"></div><div class="sk sk-line w60"></div>
      <div class="sk-row"><div class="sk sk-btn"></div><div class="sk sk-btn"></div><div class="sk sk-btn"></div></div>
    </div>`;const{data:t,error:n}=await v.from("sales").select("*, owner:profiles!sales_owner_id_fkey(id,name,chat_enabled), items(*)").eq("id",a).maybeSingle();if(!e.alive())return;if(n)throw n;if(!t){T.innerHTML='<div class="empty"><h2>Venda não encontrada</h2><p>Ela pode ter sido removida pelo vendedor.</p><a class="btn" href="#/">Ver outras vendas</a></div>';return}const o=f.user?.id===t.owner_id,s=!!t.photos_only,r=he(t).key==="encerrada",i=re(),u={disponivel:0,reservado:1,vendido:2},c=()=>t.items.sort((h,S)=>u[h.status]-u[S.status]||S.created_at.localeCompare(h.created_at));c();const m=Y[t.type],d=ta(t);document.title=`${t.title} — ${R.APP_NAME}`,T.innerHTML=`
    <article class="sale">
      ${t.cover_url?`<div class="cover" style="background-image:url('${w(t.cover_url)}')"></div>`:""}
      <div class="sale-head">
        <div class="badges">
          <span class="badge type-${t.type}">${m.label}</span>
          ${r?'<span class="badge muted">Encerrada</span>':yt(t)}
          ${t.hidden?'<span class="badge danger">Oculta pela moderação</span>':""}
          ${t.draft?'<span class="badge draft">Rascunho</span>':""}
        </div>
        <h1>${w(t.title)}</h1>
        <p class="meta big">${E.clock}${$e(t)}</p>
        <p class="meta big">${E.pin}${w(t.region)}${t.address?` · ${w(t.address)}`:""}${i?` · <strong>a ${ne(j(i,t))} de você</strong>`:""}</p>
        ${t.reference?`<p class="reference">Referência: ${w(t.reference)}</p>`:""}
        <p class="meta">Por ${w(t.owner?.name||"vendedor")}</p>
      </div>

      <div class="actions">
        ${o?"":`<button class="btn whatsapp" data-act="contact" id="wa-btn" hidden>${E.whatsapp}Falar no WhatsApp</button>`}
        <a class="btn" href="${d.google}" target="_blank" rel="noopener">Rota no Google Maps</a>
        <a class="btn" href="${d.waze}" target="_blank" rel="noopener">Rota no Waze</a>
        <button class="btn" data-act="share">${E.share}Compartilhar</button>
        ${r?"":`<button class="btn" data-act="calendar">${E.calendar}Adicionar à agenda</button>`}
        ${o?"":`<button class="btn fav ${f.favorites.has(t.id)?"on":""}" data-act="fav">${E.heart}<span>${f.favorites.has(t.id)?"Salva":"Salvar"}</span></button>`}
      </div>
      ${!o&&t.owner?.chat_enabled===!1&&!r?`<p class="notice only-promo">${E.pin}<span>Este vendedor só está divulgando a venda e não recebe mensagens pelo app. Os itens estão à venda no local, no dia e horário acima.</span></p>`:""}

      ${o&&t.draft?`
        <div class="draft-bar">
          <strong>Rascunho: só você vê esta venda.</strong>
          <p>${s?"Adicione as fotos dos itens e publique.":"Cadastre os itens, confira os preços (principalmente os sugeridos pela IA) e publique."} O link e o cartaz só funcionam depois de publicar.</p>
          <button class="btn primary" data-act="publish">${s?"Publicar venda":"Revisar preços e publicar"}</button>
        </div>`:""}

      ${f.moderator&&!o?`
        <div class="mod-bar">
          <strong>Moderação</strong>
          <div id="mod-reports" class="hint">Carregando denúncias…</div>
          ${t.hidden?'<button class="btn small primary" data-act="mod-show">Reexibir venda</button><button class="btn small" data-act="mod-hide">Manter oculta</button>':'<button class="btn small danger" data-act="mod-hide">Ocultar venda</button>'}
        </div>`:""}

      ${o?`
        <div class="owner-bar">
          <strong>${r?"Esta venda já acabou. Vai fazer outra? Duplique e aproveite os itens que sobraram.":"Esta venda é sua."}</strong>
          ${r?`<p class="hint">${ha(t)}</p>`:""}
          ${f.profile?.chat_enabled===!1?'<p class="hint">Seu chat está desligado: compradores não mandam mensagens. Dá para religar em <a href="#/perfil">Perfil</a>.</p>':""}
          ${r?'<button class="btn small primary" data-act="duplicate">Duplicar para nova data</button>':""}
          <a class="btn small" href="#/venda/${t.id}/cartaz">Cartaz com QR Code</a>
          <a class="btn small" href="#/venda/${t.id}/editar">Editar venda</a>
          ${r?"":'<button class="btn small" data-act="duplicate">Duplicar</button>'}
          <button class="btn small danger" data-act="delete-sale">Excluir</button>
        </div>`:""}

      ${t.description?`<p class="description">${w(t.description).replace(/\n/g,"<br>")}</p>`:""}
      <div id="sale-map" class="map small"></div>

      ${o&&s?`
        <section class="quick-add">
          <h2>Adicionar fotos</h2>
          ${e.params.has("novo")?'<p class="hint">Venda criada como rascunho! Agora tire as fotos dos itens. Quando terminar, toque em "Publicar".</p>':""}
          ${e.params.has("duplicada")?'<p class="hint">Venda duplicada como rascunho! Remova as fotos do que não vai levar, adicione as novidades e publique.</p>':""}
          <label class="btn primary photo-only-add">${E.camera}<span>Adicionar fotos</span><input type="file" id="photo-only-input" accept="image/*" multiple hidden></label>
          <p class="hint">Cada foto vira um item, sem precisar escrever nada. Toque numa foto para marcar como reservada ou vendida, ou para remover.</p>
          <div id="photo-uploads" class="photo-grid"></div>
          <p class="hint">${_t}</p>
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
                  ${Object.entries(V).map(([h,S])=>`<option value="${h}">${S}</option>`).join("")}
                </select>
              </div>
              <textarea name="description" rows="2" maxlength="1000" placeholder="Descrição (opcional): estado, marca, medidas…"></textarea>
              <p class="hint ai-hint" hidden></p>
              <button class="btn primary">Salvar e adicionar outro</button>
            </div>
          </form>
          <button type="button" class="btn batch-open" data-act="batch">${E.camera}Vários itens de uma vez (fotos em lote)</button>
          <p class="hint">${_t}</p>
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
    </article>`;const x=Ie("sale-map",[t.lat,t.lng],16);L.marker([t.lat,t.lng],{icon:_e(t.type)}).addTo(x);let b=!1;const _=t.owner?.chat_enabled!==!1,A=h=>h.status==="disponivel"&&!r?`${_?`<button class="btn small primary" data-act="interest">${E.chat}Tenho interesse</button>`:""}
         ${b&&Number(h.price)>0?`<button class="btn small pix" data-act="pix">${E.pix}Pagar com Pix</button>`:""}`:"",$=()=>{const h=t.items.filter(p=>p.status==="disponivel").length,S=t.items.length;if(document.getElementById("items-title").textContent=S?s?`Itens (${S} foto${S===1?"":"s"}${h<S?`, ${h} disponíve${h===1?"l":"is"}`:""})`:`Itens (${h} disponíve${h===1?"l":"is"} de ${S})`:o?"Nenhum item cadastrado ainda":"O vendedor ainda não cadastrou itens",s){document.getElementById("items").innerHTML=t.items.map(p=>`
          <div class="item photo-tile status-${p.status}" data-id="${p.id}">
            <button class="photo" data-act="view-item" aria-label="Ver foto ${t.items.indexOf(p)+1}">${Oe(p)}${p.status!=="disponivel"?`<span class="status-tag">${G[p.status]}</span>`:""}</button>
          </div>`).join("");return}document.getElementById("items").innerHTML=t.items.map(p=>`
        <div class="item status-${p.status}" data-id="${p.id}">
          <button class="photo" data-act="view-item" aria-label="Ver fotos de ${w(ie(p))}">${Oe(p)}${p.status!=="disponivel"?`<span class="status-tag">${G[p.status]}</span>`:""}</button>
          <div class="info">
            <strong>${Q(p.price)}${o&&p.ai_price?' <span class="ai-price" title="Preço sugerido pela IA, ainda não revisado">IA</span>':""}</strong>
            <span class="title">${w(ie(p))}</span>
            <small>${V[p.category]||""}</small>
            ${o?`<div class="status-toggle">
                  ${Object.entries(G).map(([q,M])=>`<button data-act="status" data-status="${q}" class="${p.status===q?"on":""}">${M}</button>`).join("")}
                </div>
                <div class="item-links">
                  <button class="link" data-act="edit-item">Editar</button>
                  <button class="link danger" data-act="delete-item">Remover</button>
                </div>`:A(p)}
          </div>
        </div>`).join("")};$(),!o&&!r&&v.rpc("sale_has_pix",{p_sale:t.id}).then(({data:h})=>{h&&e.alive()&&(b=!0,$())}),o||v.rpc("sale_has_whatsapp",{p_sale:t.id}).then(({data:h})=>{h&&e.alive()&&(document.getElementById("wa-btn").hidden=!1)});const k=(h,S)=>Ra(t,h,S),P=async h=>{if(!U(`/venda/${t.id}`,"Entre para falar com o vendedor."))return;const{data:S,error:p}=await v.rpc("get_sale_whatsapp",{p_sale:t.id});if(p)return g(xt(p),"error",p);if(!S)return g("O vendedor não informou um WhatsApp.","error");window.open(`https://wa.me/${S}?text=${encodeURIComponent(h)}`,"_blank","noopener")},C=async(h,S)=>{const p=h.status;h.status=S,c(),$();const{error:q}=await v.from("items").update({status:S}).eq("id",h.id);q&&(h.status=p,c(),$(),g("Não foi possível atualizar o item.","error",q))},y=async(h,S)=>{if(h==="interest")k(S,"Olá! Tenho interesse. Ainda está disponível?");else if(h==="pix"){if(!U(`/venda/${t.id}`,"Entre para pagar com Pix."))return;ya(t,S,p=>k(S,p))}else if(h==="edit-item")$a(t,S,()=>{c(),$()});else if(h.startsWith("status:"))C(S,h.slice(7));else if(h==="delete-item"){if(!confirm(s?"Remover esta foto?":`Remover "${ie(S)}"?`))return;const{error:p}=await v.from("items").delete().eq("id",S.id);if(p)return g(p.message,"error",p);Ue(W(S).filter(q=>q!==t.cover_url)),t.items=t.items.filter(q=>q!==S),$()}};T.onclick=async h=>{const S=h.target.closest("[data-act]");if(!S)return;const p=S.dataset.act,q=S.closest(".item"),M=q&&t.items.find(I=>I.id===q.dataset.id);if(p==="contact")P(`Olá! Vi sua venda "${t.title}" no ${R.APP_NAME}: ${we(t.id)}`);else if(p==="interest")y(p,M);else if(p==="share")Ta(t);else if(p==="fav"){if(!U(`/venda/${t.id}`,"Entre para salvar vendas."))return;const I=await ka(t.id);S.classList.toggle("on",I),S.querySelector("span").textContent=I?"Salva":"Salvar",I&&!Ma()&&!Lt()&&nt("favorite")}else if(p==="status")C(M,S.dataset.status);else if(p==="view-item")ga(t,M,{isOwner:o,ended:r,hasPix:b,chatOn:_,photosOnly:s,onAction:I=>y(I,M)});else if(["edit-item","pix","delete-item"].includes(p))y(p,M);else if(p==="publish")va(t,()=>H());else if(p==="delete-sale"){if(!confirm("Excluir esta venda e todos os itens? Isso não pode ser desfeito."))return;const{error:I}=await v.from("sales").delete().eq("id",t.id);if(I)return g(I.message,"error",I);Ue([t.cover_url,...t.items.flatMap(W)]),g("Venda excluída."),N("/minhas")}else if(p==="batch")fa(t,()=>{c(),$()});else if(p==="duplicate")xa(t);else if(p==="calendar")wa(t);else if(p==="report-sale"||p==="report-user"){if(!U(`/venda/${t.id}`,"Entre para enviar uma denúncia."))return;Mt(p==="report-sale"?{sale_id:t.id}:{sale_id:t.id,reported_user_id:t.owner_id},p==="report-sale"?"anúncio":"vendedor")}else if(p==="mod-show"||p==="mod-hide"){const I=p==="mod-show";if(!I&&!t.hidden&&!confirm("Ocultar esta venda? O vendedor será avisado."))return;S.disabled=!0;const{error:Ae}=await v.rpc("moderate_sale",{p_sale:t.id,p_show:I});if(Ae)return S.disabled=!1,g(Ae.message,"error",Ae);g(I?"Venda de volta ao ar. O vendedor foi avisado.":"Venda oculta. As denúncias foram aceitas."),H()}},K.push(()=>T.onclick=null),f.moderator&&!o&&Ca(t.id),o&&s?la(t,$,c):o?ua(t,$,c):nt("view-sale")}function la(e,a,t){const n=document.getElementById("photo-only-input"),o=document.getElementById("photo-uploads");n.addEventListener("change",async()=>{const s=[...n.files].slice(0,ce);if(n.files.length>ce&&g(`Até ${ce} fotos por vez. Envie estas e depois as outras.`),n.value="",!s.length)return;const l=s.map(()=>{const i=document.createElement("div");return i.className="photo-tile uploading",i.innerHTML="<span>Enviando…</span>",o.append(i),i});let r=0;await Se(s,3,async(i,u)=>{try{const c=await pe(i),{data:m,error:d}=await v.from("items").insert({sale_id:e.id,title:null,category:"outros",photo_url:c,photos:[c]}).select().single();if(d)throw d;e.items.unshift(m),e.cover_url||(e.cover_url=c,await v.from("sales").update({cover_url:c}).eq("id",e.id)),l[u].remove(),t(),a(),da(m,i)}catch(c){r++,l[u].classList.replace("uploading","failed"),l[u].innerHTML="<span>Não enviou</span>",console.warn(c)}}),r&&g(`${r} foto${r===1?"":"s"} não ${r===1?"foi enviada":"foram enviadas"}. Tente de novo.`,"error")})}async function da(e,a){const t=await wt(a).catch(()=>null),n=t?.title?.trim().slice(0,120);if(!n||n.length<2)return;const o={title:n,category:V[t.category]?t.category:e.category},{error:s}=await v.from("items").update(o).eq("id",e.id);s||Object.assign(e,o)}function ua(e,a,t){const n=document.getElementById("item-form"),o=n.photo,s=n.querySelector(".photo-pick img"),l=n.querySelector(".photo-pick .ph"),r=n.querySelector(".photo-pick .photo-count"),i=n.querySelector(".ai-hint");let u=localStorage.getItem("ultima-categoria")||"outros";n.category.value=u,n.category.addEventListener("change",()=>n.category.dataset.touched="1");let c=[];o.addEventListener("change",async()=>{c=[...o.files].slice(0,Z),o.files.length>Z&&g(`Até ${Z} fotos por item. Usei as primeiras ${Z}.`),r.hidden=c.length<2,r.textContent=`+${c.length-1}`,c[0]&&Pt(c[0],s,l),c.slice(1).forEach(m=>de(m)&&ue(m)),c[0]&&ze(n,c[0],i,()=>c[0])}),n.addEventListener("submit",async m=>{m.preventDefault();const d=n.querySelector("button");d.disabled=!0,d.textContent=c.length>1?`Enviando ${c.length} fotos…`:"Salvando…";try{const x=await Promise.all(c.map(pe)),b=x[0]||null,_={sale_id:e.id,title:n.title.value.trim(),price:se(n.price.value),ai_price:Ve(n),category:n.category.value,description:n.description.value.trim()||null,photo_url:b,photos:x},{data:A,error:$}=await v.from("items").insert(_).select().single();if($)throw $;e.items.unshift(A),t(),a(),b&&!e.cover_url&&(e.cover_url=b,await v.from("sales").update({cover_url:b}).eq("id",e.id)),localStorage.setItem("ultima-categoria",_.category),n.reset(),delete n.price.dataset.ai,c=[],n.category.value=_.category,s.hidden=!0,r.hidden=!0,l.hidden=!1,i.hidden=!0,delete n.category.dataset.touched,n.title.focus(),g("Item salvo!")}catch(x){g(x.message||"Erro ao salvar o item.","error",x)}finally{d.disabled=!1,d.textContent="Salvar e adicionar outro"}})}let te=null;const pa=e=>new Promise((a,t)=>{const n=new FileReader;n.onload=()=>a(String(n.result).split(",")[1]),n.onerror=t,n.readAsDataURL(e)});async function wt(e){if(te===!1)return null;let a=await le(e,768,.75,"image/jpeg").catch(()=>null);if(!a&&de(e)){const o=await ue(e);a=o&&await le(o,768,.75,"image/jpeg").catch(()=>null)}if(!a)return null;const{data:t,error:n}=await v.functions.invoke("descrever-item",{body:{image:await pa(a),categories:V}});if(n){const o=n.context?.status;if(!o||o===404||o===503)return te=!1,null;let s="";try{s=(await n.context.json()).error}catch{}throw new Error(s||"A IA não conseguiu analisar a foto.")}return te=!0,t}function ma(e,a){a.title&&!e.title.value.trim()&&(e.title.value=a.title),a.description&&!e.description.value.trim()&&(e.description.value=a.description),a.category&&V[a.category]&&e.category.dataset.touched!=="1"&&(e.category.value=a.category),a.price!=null&&!e.price.value.trim()&&(e.price.value=String(a.price),e.price.dataset.ai=e.price.value)}const Ve=e=>!!e.price.dataset.ai&&e.price.value.trim()===e.price.dataset.ai;async function ze(e,a,t,n){if(te!==!1){t.hidden=!1,t.classList.add("working"),t.textContent="✨ Descrevendo a foto com IA…";try{const o=await wt(a);if(n()!==a)return;if(t.classList.remove("working"),!o)return void(t.hidden=!0);ma(e,o),t.textContent="✨ Preenchido pela IA. Confira título, preço e categoria antes de salvar."}catch(o){if(n()!==a)return;t.classList.remove("working"),t.textContent=o.message}}}async function Se(e,a,t){const n=[];let o=0;const s=async()=>{for(;o<e.length;){const l=o++;n[l]=await t(e[l],l)}};return await Promise.all(Array.from({length:Math.min(a,e.length)},s)),n}const ce=30,Le=30,_t=`As fotos ficam guardadas até ${Le} dias depois do fim da venda e depois são apagadas automaticamente. A venda e os itens continuam no seu histórico; ao duplicar a venda, as fotos dos itens copiados ficam.`;function ha(e){const a=n=>Date.UTC(...n.split("-").map((o,s)=>Number(o)-(s===1?1:0)))/864e5,t=a(e.ends_on)+Le+1-a(D());return t<=0?`As fotos desta venda foram apagadas ${Le} dias depois do fim, como acontece com todas as vendas encerradas.`:`As fotos desta venda serão apagadas ${t===1?"amanhã cedo":`em ${t} dias`} (${Le} dias depois do fim). Duplique a venda para continuar usando as fotos dos itens que sobraram.`}function va(e,a){const t=e.photos_only?[]:e.items.filter(i=>i.status!=="vendido"),n=t.filter(i=>i.ai_price).length,o=e.items.length,{el:s,close:l}=O(`
    <h2>${e.photos_only?"Publicar venda":"Revisar preços e publicar"}</h2>
    ${e.photos_only?`<p class="hint">${o?`Venda só com fotos: <strong>${o} foto${o===1?"":"s"}</strong>. Confira se está tudo certo e publique.`:"Você ainda não adicionou fotos. Dá para publicar assim e adicionar depois, mas vendas com fotos atraem bem mais gente."}</p>`:t.length?`<p class="hint">${n?`<strong>${n} preço${n===1?"":"s"} sugerido${n===1?"":"s"} pela IA</strong> (marcados com IA). `:""}Confira cada valor: a IA erra, principalmente em itens usados ou de marca.</p>`:'<p class="hint">Você ainda não cadastrou itens. Dá para publicar assim e cadastrar depois, mas vendas com fotos e preços atraem bem mais gente.</p>'}
    <form id="publish-form">
      <div class="review-list">
        ${t.map(i=>`
          <label class="review-row ${i.ai_price?"ai":""}">
            <span class="review-thumb">${Ze(W(i)[0])}</span>
            <span class="review-title">${w(i.title)}${i.ai_price?' <span class="ai-price">IA</span>':""}</span>
            <input name="p-${i.id}" inputmode="decimal" value="${i.price==null?"":w(String(Number(i.price)).replace(".",","))}" placeholder="R$" aria-label="Preço de ${w(i.title)}">
          </label>`).join("")}
      </div>
      ${t.length?'<label class="check"><input type="checkbox" name="ok" required> Revisei todos os preços</label>':""}
      <div class="actions">
        <button type="button" class="btn" data-close>Voltar</button>
        <button class="btn primary">Publicar venda</button>
      </div>
    </form>`,"publish-modal",{keep:!0}),r=s.querySelector("form");r.addEventListener("submit",async i=>{i.preventDefault();const u=r.querySelector("button.primary");u.disabled=!0,u.textContent="Publicando…";try{const c=t.map(d=>({it:d,price:se(r[`p-${d.id}`].value)})).filter(({it:d,price:x})=>x!==(d.price==null?null:Number(d.price)));await Se(c,3,async({it:d,price:x})=>{const{error:b}=await v.from("items").update({price:x,ai_price:!1}).eq("id",d.id);if(b)throw new Error(`Erro ao salvar o preço de "${d.title}": ${b.message}`);d.price=x});const{error:m}=await v.rpc("publish_sale",{p_sale:e.id});if(m)throw Ce("Não foi possível publicar",m);e.draft=!1,e.items.forEach(d=>d.ai_price=!1),l(),g("Venda publicada! Agora é só compartilhar o link."),a()}catch(c){g(c.message,"error",ye(c)),u.disabled=!1,u.textContent="Publicar venda"}})}function fa(e,a){const t=[],n=localStorage.getItem("ultima-categoria")||"outros",{el:o,close:s}=O(`
    <h2>Cadastrar em lote</h2>
    <p class="hint">Escolha várias fotos de uma vez: <strong>cada foto vira um item</strong>. ${te===!1?"":"A IA sugere título, descrição, categoria e preço, e você só confere."} Depois dá para juntar mais fotos num item, em "Editar".</p>
    <label class="btn batch-pick">${E.camera}<span>Escolher fotos</span><input type="file" accept="image/*" multiple hidden></label>
    <div class="batch-list"></div>
    <div class="actions batch-actions">
      <button class="btn primary" data-save disabled>Salvar itens</button>
      <button class="btn" data-close>Cancelar</button>
    </div>`,"batch",{keep:!0}),l=o.querySelector(".batch-list"),r=o.querySelector("[data-save]"),i=()=>t.filter(c=>!c.removed),u=()=>{const c=i().length;r.disabled=!c,r.textContent=c?`Salvar ${c} ${c===1?"item":"itens"}`:"Salvar itens",o.querySelector(".batch-pick span").textContent=c?"Adicionar mais fotos":"Escolher fotos"};o.querySelector(".batch-pick input").addEventListener("change",c=>{const m=ce-i().length,d=[...c.target.files].slice(0,m);c.target.files.length>m&&g(`Até ${ce} fotos por lote. Salve estas e faça outro lote.`),c.target.value="";const x=d.map(b=>{const _={file:b};_.el=document.createElement("div"),_.el.className="batch-row",_.el.innerHTML=`
        <img class="batch-thumb" alt="">
        <div class="batch-fields">
          <input name="title" placeholder="O que é?" maxlength="120" aria-label="Título">
          <div class="row">
            <input name="price" inputmode="decimal" placeholder="Preço (R$)" aria-label="Preço">
            <select name="category" aria-label="Categoria">${Object.entries(V).map(([$,k])=>`<option value="${$}" ${$===n?"selected":""}>${k}</option>`).join("")}</select>
          </div>
          <textarea name="description" rows="2" maxlength="1000" placeholder="Descrição (opcional)" aria-label="Descrição"></textarea>
          <small class="hint ai-hint" hidden></small>
        </div>
        <button type="button" class="rm" aria-label="Tirar esta foto do lote">&times;</button>`;const A=$=>_.el.querySelector(`[name=${$}]`);return _.f={title:A("title"),price:A("price"),category:A("category"),description:A("description")},_.f.category.addEventListener("change",()=>_.f.category.dataset.touched="1"),Et(_.el.querySelector("img"),b),_.el.querySelector(".rm").onclick=()=>{_.removed=!0,_.el.remove(),u()},l.append(_.el),t.push(_),_});u(),Se(x,3,b=>b.removed?null:ze(b.f,b.file,b.el.querySelector(".ai-hint"),()=>b.file))}),r.onclick=async()=>{const c=i(),m=c.find(b=>!b.f.title.value.trim());if(m)return m.f.title.focus(),g("Dê um título para todos os itens (ou tire a foto do lote).","error");r.disabled=!0;let d=c.filter(b=>b.url).length;const x=()=>r.textContent=`Enviando fotos… ${d} de ${c.length}`;x();try{await Se(c,3,async A=>{A.url||(A.url=await pe(A.file),d++,x())}),r.textContent="Salvando itens…";const{data:b,error:_}=await v.from("items").insert(c.map(A=>({sale_id:e.id,title:A.f.title.value.trim(),price:se(A.f.price.value),ai_price:Ve(A.f),category:A.f.category.value,description:A.f.description.value.trim()||null,photo_url:A.url,photos:[A.url]}))).select();if(_)throw new Error(`Erro ao salvar os itens: ${_.message}`);e.items.unshift(...b),!e.cover_url&&b[0]?.photo_url&&(e.cover_url=b[0].photo_url,await v.from("sales").update({cover_url:e.cover_url}).eq("id",e.id)),s(),a(),g(`${b.length} ${b.length===1?"item cadastrado":"itens cadastrados"}!`)}catch(b){g(b.message||"Erro ao salvar os itens.","error",b),u()}}}function ga(e,a,{isOwner:t,ended:n,hasPix:o,chatOn:s=!0,photosOnly:l=!1,onAction:r}){const i=W(a),u=!t&&a.status==="disponivel"&&!n,{el:c,close:m}=O(`
    ${i.length?`
      <div class="gallery">${i.map((b,_)=>`<img src="${w(b)}" alt="" decoding="async"${_?' loading="lazy"':""}>`).join("")}</div>
      ${i.length>1?`<div class="dots">${i.map((b,_)=>`<span class="${_===0?"on":""}"></span>`).join("")}</div>`:""}`:""}
    ${l?`<p class="meta">${a.status!=="disponivel"?`<strong>${G[a.status]}</strong> · `:""}${s?"Pergunte o preço no chat ou veja no local.":"Veja o preço no local."}</p>`:`<div>
      <strong class="price">${Q(a.price)}</strong>
      <h2>${w(ie(a))}</h2>
      <p class="meta">${V[a.category]||""}${a.status!=="disponivel"?` · ${G[a.status]}`:""}</p>
      ${a.description?`<p class="item-desc">${w(a.description).replace(/\n/g,"<br>")}</p>`:""}
    </div>`}
    ${t&&l?`
      <div class="status-toggle" role="group" aria-label="Situação">
        ${Object.entries(G).map(([b,_])=>`<button data-a="status:${b}" class="${a.status===b?"on":""}">${_}</button>`).join("")}
      </div>`:""}
    <div class="actions">
      ${u&&s?`<button class="btn primary" data-a="interest">${E.chat}Tenho interesse: conversar</button>`:""}
      ${u&&o&&!l&&Number(a.price)>0?`<button class="btn pix" data-a="pix">${E.pix}Pagar com Pix</button>`:""}
      ${t&&!l?'<button class="btn" data-a="edit-item">Editar item</button>':""}
      ${t&&l?'<button class="btn danger" data-a="delete-item">Remover foto</button>':""}
      <button class="btn" data-close>Fechar</button>
    </div>`,"viewer"),d=c.querySelector(".gallery"),x=c.querySelectorAll(".dots span");d&&x.length&&d.addEventListener("scroll",()=>{const b=Math.round(d.scrollLeft/d.clientWidth);x.forEach((_,A)=>_.classList.toggle("on",b===A))}),d&&ba(d),c.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{m(),r(b.dataset.a)})}function ba(e){e.classList.add("pode-zoom"),e.querySelectorAll("img").forEach(y=>y.draggable=!1);let n=null,o=1,s=0,l=0,r=null,i=null,u=null,c=null,m=0;const d=(y,h)=>{const S=e.getBoundingClientRect();return{x:y-(S.left+S.width/2),y:h-(S.top+S.height/2)}},x=()=>{const y=n.clientWidth*(o-1)/2,h=n.clientHeight*(o-1)/2;s=Math.min(y,Math.max(-y,s)),l=Math.min(h,Math.max(-h,l))},b=y=>{n.style.transition=y?"transform .2s ease":"",n.style.transform=o>1?`translate(${s}px, ${l}px) scale(${o})`:"",e.classList.toggle("zoomed",o>1)},_=y=>{n&&(o=1,s=0,l=0,b(y))},A=(y,h,S={s:o,x:s,y:l})=>{const p=(y.x-S.x)/S.s,q=(y.y-S.y)/S.s;o=Math.min(4,Math.max(1*.8,h)),s=y.x-o*p,l=y.y-o*q},$=y=>{const h=y&&y.closest&&y.closest("img");return h&&h!==n&&(_(!1),n=h),n},k=(y,h)=>{if(o>1)return _(!0);A(d(y,h),2),x(),b(!0)},P=(y,h)=>Math.hypot(y.clientX-h.clientX,y.clientY-h.clientY),C=(y,h)=>d((y.clientX+h.clientX)/2,(y.clientY+h.clientY)/2);["gesturestart","gesturechange"].forEach(y=>e.addEventListener(y,h=>h.preventDefault(),{passive:!1})),e.addEventListener("touchstart",y=>{if($(y.target)){if(y.touches.length===2){const[h,S]=y.touches;r={d:P(h,S),m:C(h,S),s:o,x:s,y:l},i=null,u=null}else if(y.touches.length===1){const h=y.touches[0];u={x:h.clientX,y:h.clientY,at:Date.now()},i=o>1?{cx:h.clientX,cy:h.clientY,x:s,y:l}:null}}},{passive:!0}),e.addEventListener("touchmove",y=>{if(r&&y.touches.length===2){y.preventDefault();const[h,S]=y.touches,p=C(h,S);A(r.m,r.s*(P(h,S)/r.d),r),s+=p.x-r.m.x,l+=p.y-r.m.y,b(!1)}else if(i&&y.touches.length===1){y.preventDefault();const h=y.touches[0];s=i.x+h.clientX-i.cx,l=i.y+h.clientY-i.cy,x(),b(!1)}u&&y.touches.length===1&&Math.hypot(y.touches[0].clientX-u.x,y.touches[0].clientY-u.y)>10&&(u=null)},{passive:!1}),e.addEventListener("touchend",y=>{if(m=Date.now(),r&&y.touches.length<2){r=null,o<1.05?_(!0):(x(),b(!0));const h=y.touches[0];i=h&&o>1?{cx:h.clientX,cy:h.clientY,x:s,y:l}:null;return}y.touches.length||(i=null,u&&Date.now()-u.at<300&&(c&&Date.now()-c.at<300&&Math.hypot(u.x-c.x,u.y-c.y)<30?(c=null,k(u.x,u.y)):c={...u,at:Date.now()}),u=null)}),e.addEventListener("touchcancel",()=>{r=i=u=null}),e.addEventListener("dblclick",y=>{Date.now()-m<1e3||!$(y.target)||k(y.clientX,y.clientY)}),e.addEventListener("pointerdown",y=>{if(y.pointerType!=="mouse"||o<=1||!$(y.target))return;y.preventDefault();const h={cx:y.clientX,cy:y.clientY,x:s,y:l},S=q=>{s=h.x+q.clientX-h.cx,l=h.y+q.clientY-h.cy,x(),b(!1)},p=()=>{removeEventListener("pointermove",S),removeEventListener("pointerup",p)};addEventListener("pointermove",S),addEventListener("pointerup",p)})}function Et(e,a){e.onerror=async()=>{e.onerror=null;const t=de(a)?await ue(a):null;t&&(e.src=URL.createObjectURL(t))},e.src=URL.createObjectURL(a)}function $a(e,a,t){let n=[...W(a)];const{el:o,close:s}=O(`
    <h2>Editar item</h2>
    <form>
      <div class="photo-edit"></div>
      <p class="hint">Toque numa foto para torná-la a principal.</p>
      <label>Título<input name="title" required maxlength="120" value="${w(a.title)}"></label>
      <div class="row">
        <label>Preço (R$)<input name="price" inputmode="decimal" value="${a.price==null?"":String(a.price).replace(".",",")}" placeholder="A combinar"></label>
        <label>Categoria
          <select name="category">${Object.entries(V).map(([u,c])=>`<option value="${u}" ${u===a.category?"selected":""}>${c}</option>`).join("")}</select>
        </label>
      </div>
      <label>Descrição<textarea name="description" rows="3" maxlength="1000" placeholder="Estado, marca, medidas…">${w(a.description||"")}</textarea></label>
      ${te===!1?"":'<button type="button" class="btn small" data-ai>✨ Descrever com IA (a partir da foto principal)</button><p class="hint ai-hint" hidden></p>'}
      <div class="actions">
        <button class="btn primary">Salvar</button>
        <button type="button" class="btn" data-close>Cancelar</button>
      </div>
    </form>`),l=o.querySelector(".photo-edit"),r=o.querySelector("form"),i=()=>{l.innerHTML=n.map((u,c)=>`
        <div class="thumb-edit" data-i="${c}">
          <img alt="">
          ${c===0?'<span class="main-tag">Principal</span>':""}
          <button type="button" class="rm" data-rm="${c}" aria-label="Remover foto">&times;</button>
        </div>`).join("")+(n.length<Z?`<label class="add-photo">${E.camera}<span>Adicionar</span><input type="file" accept="image/*" multiple hidden></label>`:""),l.querySelectorAll(".thumb-edit img").forEach((u,c)=>{const m=n[c];typeof m=="string"?u.src=m:Et(u,m)}),l.querySelector("input[type=file]")?.addEventListener("change",u=>{const c=Z-n.length;u.target.files.length>c&&g(`Até ${Z} fotos por item.`),n.push(...[...u.target.files].slice(0,c)),i()})};i(),o.querySelector("[data-ai]")?.addEventListener("click",async u=>{const c=n[0];if(!c)return g("Adicione uma foto primeiro.","error");const m=u.currentTarget;m.disabled=!0;try{const d=typeof c=="string"?new File([await(await fetch(c)).blob()],"foto.jpg",{type:"image/jpeg"}):c;r.title.value="",r.description.value="",delete r.category.dataset.touched,await ze(r,d,o.querySelector(".ai-hint"),()=>d),r.title.value||(r.title.value=a.title)}catch(d){g("Não foi possível ler a foto para a IA.","error",d),r.title.value||(r.title.value=a.title)}finally{m.disabled=!1}}),l.addEventListener("click",u=>{const c=u.target.closest("[data-rm]");if(c)return n.splice(Number(c.dataset.rm),1),i();const m=u.target.closest(".thumb-edit");m&&m.dataset.i!=="0"&&(n.unshift(...n.splice(Number(m.dataset.i),1)),i())}),r.addEventListener("submit",async u=>{u.preventDefault();const c=r.querySelector("button.primary");c.disabled=!0,c.textContent="Salvando…";try{const m=await Promise.all(n.map(b=>typeof b=="string"?b:pe(b))),d={title:r.title.value.trim(),price:se(r.price.value),ai_price:Ve(r)||a.ai_price&&se(r.price.value)===Number(a.price),category:r.category.value,description:r.description.value.trim()||null,photos:m,photo_url:m[0]||null},{error:x}=await v.from("items").update(d).eq("id",a.id);if(x)throw new Error(`Erro ao salvar o item: ${x.message}`);Ue(W(a).filter(b=>!m.includes(b)&&b!==e.cover_url)),Object.assign(a,d),m[0]&&!e.cover_url&&(e.cover_url=m[0],await v.from("sales").update({cover_url:m[0]}).eq("id",e.id)),s(),t(),g("Item atualizado.")}catch(m){g(m.message||"Erro ao salvar o item.","error",m),c.disabled=!1,c.textContent="Salvar"}})}const xt=e=>/limite/i.test(e.message)?e.message:"Não foi possível obter o contato do vendedor. Tente de novo.";async function ya(e,a,t){const{data:n,error:o}=await v.rpc("get_sale_pix",{p_sale:e.id});if(o)return g(xt(o),"error",o);const s=n?.[0];if(!s)return g("O vendedor não informou uma chave Pix.","error");const l=s.pix_name||e.owner?.name||"",r=zt({key:s.pix_key,name:l,amount:Number(a.price)}),{el:i,close:u}=O(`
    <h2>Pagar com Pix</h2>
    <p class="meta big">${w(a.title)} · <strong>${Q(a.price)}</strong></p>
    <div class="notice"><p><strong>Combine com o vendedor antes de pagar</strong>, para garantir que o item ainda está disponível.</p></div>
    <div class="qr">Gerando QR Code…</div>
    <button class="btn primary" data-copy>Copiar código Pix (copia e cola)</button>
    <p class="hint">Recebedor: <strong>${w(l)}</strong>. Confira o nome no app do banco antes de confirmar.</p>
    <div class="actions">
      ${e.owner?.chat_enabled===!1?"":`<button class="btn primary" data-paid>${E.chat}Avisar o vendedor que paguei</button>`}
      <button class="btn" data-close>Fechar</button>
    </div>`,"pix-modal");it(r).then(m=>i.querySelector(".qr").innerHTML=m).catch(m=>i.querySelector(".qr").textContent=m.message),i.querySelector("[data-copy]").onclick=async()=>{try{await navigator.clipboard.writeText(r),g("Código Pix copiado! Cole no app do seu banco, em Pix > Copia e cola.")}catch{prompt("Copie o código Pix:",r)}};const c=i.querySelector("[data-paid]");c&&(c.onclick=()=>{u(),t(`Olá! Fiz o Pix de ${Q(a.price)} por este item. Podemos combinar a retirada?`)})}function wa(e){const a=we(e.id),{el:t,close:n}=O(`
    <h2>Adicionar à agenda</h2>
    <p class="hint">A agenda do seu celular avisa na véspera para você não perder a venda.</p>
    <div class="actions column">
      <a class="btn" href="${w(Ht(e,a))}" target="_blank" rel="noopener" data-close>${E.calendar}Google Agenda</a>
      <button class="btn" data-ics>${E.calendar}iPhone, Outlook ou outra agenda</button>
      <button class="btn" data-close>Cancelar</button>
    </div>`);t.querySelector("[data-ics]").onclick=()=>{const o=new Blob([Ot(e,a)],{type:"text/calendar;charset=utf-8"}),s=document.createElement("a");s.href=URL.createObjectURL(o),s.download=`venda-${e.starts_on}.ics`,s.click(),n(),g("Abra o arquivo baixado para salvar na agenda.")}}const _a=(e,a)=>Math.round((F(a)-F(e))/864e5);function Ea(e){const a=e.ends_on>D()?e.ends_on:D();let t=F(e.starts_on);for(;B(t)<=a;)t=X(t,7);return B(t)}function xa(e){const a=Ea(e),t=B(X(F(a),_a(e.starts_on,e.ends_on))),n=e.items.filter(i=>i.status!=="vendido"),o=n.filter(i=>i.status==="reservado").length,{el:s,close:l}=O(`
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
    </form>`),r=s.querySelector("form");r.starts_on.addEventListener("change",()=>{r.ends_on.value<r.starts_on.value&&(r.ends_on.value=r.starts_on.value)}),r.addEventListener("submit",async i=>{i.preventDefault();const u=pt(r.starts_on.value,r.ends_on.value);if(u)return g(u,"error");const c=r.querySelector("button.primary");c.disabled=!0,c.textContent="Duplicando…";try{const d=Object.fromEntries(["title","description","type","region","address","reference","lat","lng","start_time","end_time","cover_url","photos_only"].map(_=>[_,e[_]])),{data:x,error:b}=await v.from("sales").insert({...d,starts_on:r.starts_on.value,ends_on:r.ends_on.value}).select("id").single();if(b)throw Ce("Erro ao duplicar a venda",b);if(r.copy.checked&&n.length){const _=n.map($=>({sale_id:x.id,title:$.title,price:$.price,category:$.category,photo_url:$.photo_url,photos:W($)})),A=await v.from("items").insert(_);if(A.error)throw new Error(`A venda foi duplicada, mas os itens não: ${A.error.message}`)}l(),g("Venda duplicada!"),N(`/venda/${x.id}?duplicada=1`)}catch(m){g(m.message,"error",ye(m)),c.disabled=!1,c.textContent="Duplicar venda"}})}function We(e){const a=F(e).toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});return a.charAt(0).toUpperCase()+a.slice(1)}function Fe(e){const a=`${be(e.start_time)} às ${be(e.end_time)}`;return e.starts_on===e.ends_on?`${We(e.starts_on)} · ${a}`:`${We(e.starts_on)} a ${We(e.ends_on).toLowerCase()} · ${a}`}async function Sa(e,a){T.innerHTML='<div class="loading">Preparando o cartaz…</div>';const{data:t,error:n}=await v.from("sales").select("*, items(title,price,photo_url,photos,status)").eq("id",a).maybeSingle();if(!e.alive())return;if(n)throw n;if(!t){T.innerHTML='<div class="empty"><h2>Venda não encontrada</h2><a class="btn" href="#/">Voltar ao início</a></div>';return}document.body.classList.add("poster-mode"),K.push(()=>document.body.classList.remove("poster-mode")),document.title=`Cartaz — ${t.title}`;const o=we(t.id),s=fe.replace(/^https?:\/\//,"").replace(/\/$/,""),l=[t.address,t.region].filter(Boolean).join(" · "),r=t.items.filter(c=>c.status!=="vendido"&&W(c).length).slice(0,6),i=Y[t.type];T.innerHTML=`
    <div class="poster-tools no-print">
      <a class="btn small" href="#/venda/${t.id}">← Voltar para a venda</a>
      ${r.length?'<label class="check"><input type="checkbox" id="show-photos" checked> Mostrar fotos dos itens</label>':""}
      <button class="btn primary" id="print">Imprimir ou salvar PDF</button>
      <button class="btn whatsapp" id="as-image">${E.whatsapp}Imagem para WhatsApp</button>
      <p class="hint">Cole o cartaz no elevador, na portaria ou no mural. Quem apontar a câmera do celular para o QR Code abre a venda com todos os itens.</p>
    </div>
    <article class="poster poster-${t.type} ${r.length?"":"poster-no-items"}" id="poster">
      <header class="poster-band">${w(i.label)}</header>
      <div class="poster-body">
        <h1>${w(t.title)}</h1>
        <p class="poster-when">${w(Fe(t))}</p>
        ${l?`<p class="poster-where">${w(l)}</p>`:""}
        ${t.reference?`<p class="poster-ref">${w(t.reference)}</p>`:""}
        ${r.length?`
          <div class="poster-items" id="poster-items">
            ${r.map(c=>`<figure><img src="${w(W(c)[0])}" alt="">${t.photos_only?"":`<figcaption>${Q(c.price)}</figcaption>`}</figure>`).join("")}
          </div>`:""}
        <div class="poster-qr">
          <div class="qr" id="poster-qr"></div>
          <div>
            <strong>${t.photos_only?"Veja as fotos de todos os itens":"Veja todos os itens e preços"}</strong>
            <p>Aponte a câmera do celular para o código</p>
            <p class="poster-url">${w(s)}</p>
          </div>
        </div>
      </div>
      <footer>${w(R.APP_NAME)} · vendas de garagem, bazares e mudanças em Brasília</footer>
    </article>`,it(o).then(c=>document.getElementById("poster-qr").innerHTML=c).catch(c=>g(c.message,"error",c)),document.getElementById("show-photos")?.addEventListener("change",c=>{document.getElementById("poster-items").hidden=!c.target.checked,document.getElementById("poster").classList.toggle("poster-no-items",!c.target.checked)}),document.getElementById("print").onclick=()=>window.print();const u=La(t,o,l);u.catch(c=>Me(c,"cartaz imagem")),document.getElementById("as-image").onclick=async()=>{let c;try{c=await u}catch{return g("Não foi possível gerar a imagem do cartaz.","error")}const m=`${Y[t.type].label}: ${t.title}
${Fe(t)}${l?`
${l}`:""}
Veja os itens: ${o}`;if(navigator.canShare?.({files:[c]}))try{await navigator.share({files:[c],text:m});return}catch(x){if(x.name==="AbortError")return}const d=document.createElement("a");d.href=URL.createObjectURL(c),d.download=c.name,d.click(),g("Imagem salva. Envie no WhatsApp junto com o link da venda.")}}const St={garagem:"#3563ad",mudanca:"#b45309",bazar:"#6741d9"};function ke(e,a,t,n,o,s,l){const r=String(a).split(/\s+/);let i="",u=0;for(let c=0;c<r.length;c++){const m=i?`${i} ${r[c]}`:r[c];if(e.measureText(m).width>o&&i){if(++u===l)return e.fillText(`${i}…`,t,n),n+s;e.fillText(i,t,n),n+=s,i=r[c]}else i=m}return i&&e.fillText(i,t,n),n+s}async function La(e,a,t){const l=document.createElement("canvas");l.width=1080,l.height=1350;const r=l.getContext("2d"),i=(_,A)=>`${_} ${A}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;r.fillStyle="#ffffff",r.fillRect(0,0,1080,1350),r.fillStyle=St[e.type],r.fillRect(0,0,1080,150),r.fillStyle="#ffffff",r.font=i(800,56),r.textBaseline="middle",r.fillText(Y[e.type].label.toUpperCase(),80,78),r.textBaseline="alphabetic",r.fillStyle="#1c2319",r.font=i(800,76);let u=ke(r,e.title,80,290,920,88,3);r.font=i(700,46),r.fillStyle=St[e.type],u=ke(r,Fe(e),80,u+30,920,58,2),r.fillStyle="#3d4643",r.font=i(500,40),t&&(u=ke(r,t,80,u+10,920,52,2)),e.reference&&(u=ke(r,e.reference,80,u,920,52,2));const c=await Wt(a,10),m=420,d=(1080-m)/2,x=Math.max(u+40,1350-m-230);r.drawImage(c,d,x,m,m),r.fillStyle="#1c2319",r.font=i(700,40),r.textAlign="center",r.fillText(e.photos_only?"Veja as fotos de todos os itens":"Veja todos os itens e preços",1080/2,x+m+70),r.fillStyle="#626b5d",r.font=i(500,32),r.fillText(`${R.APP_NAME} · aponte a câmera ou toque no link`,1080/2,x+m+120);const b=await new Promise(_=>l.toBlob(_,"image/png"));return new File([b],"cartaz-venda.png",{type:"image/png"})}async function ka(e){if(f.favorites.has(e))return await v.from("favorites").delete().eq("user_id",f.user.id).eq("sale_id",e),f.favorites.delete(e),!1;const{error:a}=await v.from("favorites").insert({sale_id:e});return a?(g("Não foi possível salvar.","error"),!1):(f.favorites.add(e),g("Venda salva nas suas favoritas."),!0)}const qa="na véspera, às 19h, e no dia, às 7h",Xe=`as mensagens do chat na hora em que chegam, lembretes das vendas que você salvou (${qa}) e, se ativar, alertas de vendas novas perto de você`;function Lt(e="favorito"){if(Te()!=="ok"||Notification.permission!=="default")return!1;try{if(Date.now()-(Number(localStorage.getItem("lembrete-oferecido"))||0)<168*3600*1e3)return!1;localStorage.setItem("lembrete-oferecido",String(Date.now()))}catch{return!1}const{el:a,close:t}=O(`
    <h2>${e==="chat"?"Quer saber quando responderem?":"Quer um lembrete?"}</h2>
    <p class="hint">Você recebe no celular ${Xe}. Dá para desligar quando quiser em Menu &gt; Dados da conta.</p>
    <div class="actions column">
      <button class="btn primary" data-on>${E.bell}Ativar notificações</button>
      <button class="btn" data-close>Agora não</button>
    </div>`);return a.querySelector("[data-on]").onclick=async()=>{t(),await Ye()},!0}async function Ye(){try{const e=await Xt(v,R.VAPID_PUBLIC_KEY);return e==="ativo"?g("Pronto! Você vai receber as mensagens e os lembretes no celular."):g(e==="negado"?"As notificações ficaram bloqueadas. Libere nas configurações do navegador para este site.":"Este navegador não recebe notificações.","error"),e==="ativo"}catch(e){return g("Não foi possível ativar as notificações.","error",e),!1}}const kt=12,Aa=e=>{const a=me(e);return a?oe.filter(t=>j(a,t)<=kt).map(t=>t.name):[]};function qt(e,{suggest:a=!1}={}){const t=e?.home_region||localStorage.getItem("regiao")||"",n=new Set(e?.interests||[]);return`
    <label class="check"><input type="checkbox" name="alerts" ${(e?e.alerts:a)?"checked":""}> Avisar quando publicarem uma venda perto de mim</label>
    <label>Região onde você mora
      <select name="home_region">
        <option value="">Escolha a região</option>
        ${oe.map(o=>`<option ${o.name===t?"selected":""}>${w(o.name)}</option>`).join("")}
      </select>
    </label>
    <label class="check"><input type="checkbox" name="nearby" ${e?.nearby===!1?"":"checked"}> Incluir as regiões vizinhas (até ${kt} km)</label>
    <p class="hint">Só me avise de vendas com (deixe tudo desmarcado para receber todas):</p>
    <div class="interest-grid">
      ${Object.entries(V).filter(([o])=>o!=="outros").map(([o,s])=>`
        <label class="chip check-chip"><input type="checkbox" name="interest" value="${o}" ${n.has(o)?"checked":""}>${w(s)}</label>`).join("")}
    </div>
    <label class="check"><input type="checkbox" name="news_email" ${e?.news_email?"checked":""}> Quero receber novidades do ${w(R.APP_NAME)} por e-mail (no máximo 2 por mês)</label>`}function At(e){const a=e.home_region.value||null;return{alerts:e.alerts.checked&&!!a,home_region:a,nearby:e.nearby.checked,regions:a?e.nearby.checked?Aa(a):[a]:[],interests:[...e.querySelectorAll("[name=interest]:checked")].map(t=>t.value),news_email:e.news_email.checked}}async function Qe(e){const{data:a,error:t}=await v.from("preferences").update(e).eq("user_id",f.user.id).select("user_id");if(t)throw t;if(!a.length){const{error:n}=await v.from("preferences").insert({...e,user_id:f.user.id});if(n)throw n}f.prefs=e}function Ma(){if(f.prefs!==null)return!1;const{el:e,close:a}=O(`
    <h2>Quer ser avisado de vendas perto de você?</h2>
    <p class="hint">Quando alguém publicar uma venda na sua região, você recebe um aviso (no máximo 3 por dia). Dá para mudar quando quiser em Menu &gt; Dados da conta.</p>
    <form class="form prefs-form">
      ${qt(null,{suggest:!0})}
      <div class="actions column">
        <button class="btn primary">${E.bell}Salvar</button>
        <button type="button" class="btn" data-skip>Agora não</button>
      </div>
    </form>`,"",{keep:!0}),t=e.querySelector("form");return t.addEventListener("submit",async n=>{n.preventDefault();const o=At(t);if(t.alerts.checked&&!o.home_region)return g("Escolha a região onde você mora.","error");try{await Qe(o)}catch(s){return g("Não foi possível salvar suas preferências.","error",s)}a(),o.alerts&&Te()==="ok"&&Notification.permission==="default"?await Ye():g(o.alerts?`Pronto! Avisaremos de vendas em ${o.home_region}${o.nearby?" e arredores":""}.`:"Preferências salvas.")}),e.querySelector("[data-skip]").onclick=async()=>{a(),await Qe({alerts:!1,home_region:null,nearby:!0,regions:[],interests:[],news_email:!1}).catch(()=>{})},!0}async function ae(e,{compact:a=!1}={}){const t=Te(),n=await Ft().catch(()=>!1);if(!e.isConnected)return;const o=t==="ok"&&Notification.permission==="denied";if(a&&(n||o||t==="sem-suporte"))return void(e.innerHTML="");let s;t==="ios-instalar"?s='<p class="hint">No iPhone, as notificações chegam com o app na tela de início: toque em Compartilhar e depois em <strong>Adicionar à Tela de Início</strong>. Abra o app por lá e ative aqui.</p>':t==="sem-suporte"?s='<p class="hint">Este navegador não recebe notificações. As mensagens aparecem na aba Chat, e você pode usar "Adicionar à agenda" na página da venda.</p>':o?s='<p class="hint">As notificações estão bloqueadas para este site. Libere nas configurações do navegador e volte aqui.</p>':n?s=`<p class="hint"><span class="ok">Ativas neste aparelho ✓</span> Você recebe ${Xe}.</p>
      <button type="button" class="btn small" data-rem="off">Desativar notificações</button>`:s=`<p class="hint">Receba no celular ${Xe}.</p>
      <button type="button" class="btn ${a?"small":""} primary" data-rem="on">${E.bell}Ativar notificações</button>`,e.innerHTML=a?`<div class="reminder-box compact">${s}</div>`:`<fieldset class="reminder-box"><legend>${E.bell} Notificações no celular</legend>${s}</fieldset>`;const l=e.querySelector("[data-rem]");l&&(l.onclick=async()=>{if(l.disabled=!0,l.dataset.rem==="on")await Ye();else try{await ve(v),g("Notificações desativadas neste aparelho.")}catch(r){g("Não foi possível desativar as notificações.","error",r)}ae(e,{compact:a})})}async function Ta(e){const a=we(e.id),t=`${Y[e.type].label}: ${e.title} — ${$e(e)}, ${e.region}`;if(navigator.share){try{await navigator.share({title:e.title,text:t,url:a})}catch{}return}const{el:n,close:o}=O(`
    <h2>Compartilhar venda</h2>
    <input class="copy" value="${w(a)}" readonly>
    <div class="actions">
      <a class="btn whatsapp" href="https://wa.me/?text=${encodeURIComponent(t+`
`+a)}" target="_blank" rel="noopener">${E.whatsapp}Enviar no WhatsApp</a>
      <button class="btn" data-copy>Copiar link</button>
      <button class="btn" data-close>Fechar</button>
    </div>`);n.querySelector("[data-copy]").onclick=async()=>{await navigator.clipboard.writeText(a),g("Link copiado!"),o()}}const Pa={aberta:"em aberto",rejeitada:"descartada",procedente:"aceita"};async function Ca(e){const{data:a,error:t}=await v.from("reports").select("reason,details,status,created_at").eq("sale_id",e).order("created_at",{ascending:!1}),n=document.getElementById("mod-reports");if(n){if(t)return void(n.textContent="Não foi possível carregar as denúncias.");n.innerHTML=a.length?`<ul class="mod-list">${a.map(o=>`<li><strong>${w(o.reason)}</strong> · ${Pa[o.status]||w(o.status)} · ${et(o.created_at)}${o.details?`<br>${w(o.details)}`:""}</li>`).join("")}</ul>`:"Nenhuma denúncia."}}function Mt(e,a){const{el:t,close:n}=O(`
    <h2>Denunciar ${a}</h2>
    <form id="report-form">
      <label>Motivo
        <select name="reason" required>${Rt.map(o=>`<option>${o}</option>`).join("")}</select>
      </label>
      <label>Detalhes (opcional)
        <textarea name="details" rows="3" maxlength="1000" placeholder="Conte o que aconteceu"></textarea>
      </label>
      <div class="actions">
        <button class="btn danger">Enviar denúncia</button>
        <button type="button" class="btn" data-close>Cancelar</button>
      </div>
    </form>`);t.querySelector("form").addEventListener("submit",async o=>{o.preventDefault();const s=o.target,{error:l}=await v.from("reports").insert({...e,reason:s.reason.value,details:s.details.value.trim()||null});if(l)return g(l.message,"error",ye(l));n(),g("Denúncia enviada. Obrigado por ajudar a manter o site seguro.")})}function Ia(e){return new Promise((a,t)=>{const n=new Image;n.onload=()=>a(n),n.onerror=()=>t(new Error("Não foi possível ler a foto.")),n.src=URL.createObjectURL(e)})}async function le(e,a=1080,t=.8,n="image/webp"){const o=await Ia(e),s=Math.min(1,a/Math.max(o.naturalWidth,o.naturalHeight)),l=document.createElement("canvas");l.width=Math.round(o.naturalWidth*s),l.height=Math.round(o.naturalHeight*s),l.getContext("2d").drawImage(o,0,0,l.width,l.height),URL.revokeObjectURL(o.src);const r=u=>new Promise(c=>l.toBlob(c,u,t)),i=await r(n);return i&&i.type===n?i:r("image/jpeg")}const Tt={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"},de=e=>/hei[cf]/i.test(e.type)||/\.hei[cf]$/i.test(e.name);async function Da(e){const{default:a}=await import("https://cdn.jsdelivr.net/npm/heic2any@0.0.4/+esm"),t=await a({blob:e,toType:"image/jpeg",quality:.85});return new File([Array.isArray(t)?t[0]:t],"foto.jpg",{type:"image/jpeg"})}const Ge=new WeakMap;function ue(e){return Ge.has(e)||Ge.set(e,Da(e).catch(()=>null)),Ge.get(e)}function Pt(e,a,t){a.hidden=!1,t.hidden=!0,a.onerror=async()=>{if(a.onerror=null,!de(e))return;a.hidden=!0,t.hidden=!1;const n=t.lastChild,o=n.textContent;n.textContent="Preparando foto…";const s=await ue(e);if(n.textContent=o,!s)return g("Não foi possível abrir esta foto. Tente outra.","error");a.src=URL.createObjectURL(s),a.hidden=!1,t.hidden=!0},a.src=URL.createObjectURL(e)}async function pe(e){let a=await le(e).catch(()=>null);if(!a&&de(e)){const m=await ue(e);if(!m)throw new Error('Não foi possível converter a foto HEIC. No iPhone, vá em Ajustes > Câmera > Formatos e escolha "Mais Compatível".');a=await le(m).catch(()=>null)||m}if(!a){if(!Tt[e.type])throw new Error(`Formato de foto não suportado (${e.type||"desconhecido"}). Use JPG ou PNG.`);if(e.size>5*1024*1024)throw new Error("A foto é muito grande (máximo 5 MB).");a=await jt(e)}const t=a.type||"image/jpeg",n=Tt[t]||"jpg",o=v.storage.from("photos"),s={contentType:t,cacheControl:"31536000"},l=`${f.user.id}/${crypto.randomUUID()}`,r=(n==="webp"||n==="jpg")&&await le(a,400,.7,t).catch(()=>null),u=r?.type===t&&!(await o.upload(`${l}.t.${n}`,r,s)).error?`${l}.f.${n}`:`${l}.${n}`,{error:c}=await o.upload(u,a,s);if(c)throw new Error(`Erro ao enviar a foto: ${c.message}`);return o.getPublicUrl(u).data.publicUrl}async function Ct(e,a){if(!U(e.path,"Entre para anunciar uma venda. É grátis."))return;if(!gt()){sessionStorage.setItem("next",e.path),N("/perfil?msg="+encodeURIComponent("Para anunciar, confirme seu telefone por SMS."));return}let t=null;if(a){const{data:d,error:x}=await v.from("sales").select("*").eq("id",a).maybeSingle();if(!e.alive())return;if(x)throw x;if(!d||d.owner_id!==f.user.id){T.innerHTML='<div class="empty"><h2>Você não pode editar esta venda</h2><a class="btn" href="#/">Voltar</a></div>';return}t=d}const n=B(Gt()),o=t||{type:"garagem",region:localStorage.getItem("regiao")||"Plano Piloto",starts_on:n,ends_on:n,start_time:"08:00",end_time:"14:00"};T.innerHTML=`
    <form id="sale-form" class="form">
      <h1>${t?"Editar venda":"Anunciar uma venda"}</h1>
      ${t?"":'<p class="hint">Antes de começar, veja as <a href="regras.html">regras para anunciar</a> (datas, limites e denúncias).</p>'}

      <fieldset class="type-pick">
        <legend>Tipo</legend>
        ${Object.entries(Y).map(([d,x])=>`
          <label class="type-opt type-${d}">
            <input type="radio" name="type" value="${d}" ${o.type===d?"checked":""}>
            <span><strong>${x.label}</strong><small>${{garagem:"Desapego da casa, num dia só",mudanca:"Vou me mudar e preciso vender quase tudo",bazar:"Vários vendedores: prédio, condomínio, igreja, escola"}[d]}</small></span>
          </label>`).join("")}
      </fieldset>

      <label>Título
        <input name="title" required minlength="3" maxlength="120" value="${w(o.title)}" placeholder="Ex.: Bazar de sábado no pilotis da SQS 308">
      </label>
      <label>Descrição
        <textarea name="description" rows="3" maxlength="2000" placeholder="O que vai ter, formas de pagamento (Pix, dinheiro), se precisa levar sacola…">${w(o.description)}</textarea>
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
          ${oe.map(d=>`<option ${d.name===o.region?"selected":""}>${w(d.name)}</option>`).join("")}
        </select>
      </label>
      <label>Endereço
        <input name="address" maxlength="160" value="${w(o.address)}" placeholder="Ex.: SQS 308 Bloco C">
      </label>
      <label>Referência
        <input name="reference" maxlength="160" value="${w(o.reference)}" placeholder="Ex.: pilotis do bloco C, portaria 2">
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
        <img alt="" ${o.cover_url?`src="${w(o.cover_url)}"`:"hidden"}>
      </label>

      <button class="btn primary big">${t?"Salvar alterações":"Criar venda e cadastrar itens"}</button>
    </form>`;const s=document.getElementById("sale-form"),l=me(o.region)||oe[0];let r=t?[t.lat,t.lng]:[l.lat,l.lng],i=!!t;const u=Ie("form-map",r,t?17:15,{scrollWheelZoom:!0,recenter:d=>d.setView(c.getLatLng(),Math.max(d.getZoom(),15))}),c=L.marker(r,{draggable:!0,icon:_e(o.type)}).addTo(u);c.on("dragend",()=>{const d=c.getLatLng();r=[d.lat,d.lng],i=!0}),u.on("click",d=>{c.setLatLng(d.latlng),r=[d.latlng.lat,d.latlng.lng],i=!0}),s.region.addEventListener("change",()=>{if(i)return;const d=me(s.region.value);r=[d.lat,d.lng],c.setLatLng(r),u.setView(r,15)}),s.addEventListener("change",d=>{d.target.name==="type"&&c.setIcon(_e(d.target.value)),d.target.name==="starts_on"&&s.ends_on.value<s.starts_on.value&&(s.ends_on.value=s.starts_on.value)}),document.getElementById("use-location").addEventListener("click",()=>{if(!navigator.geolocation)return g("Seu aparelho não informa a localização.","error");navigator.geolocation.getCurrentPosition(d=>{r=[d.coords.latitude,d.coords.longitude],i=!0,c.setLatLng(r),u.setView(r,17)},()=>g("Não foi possível obter sua localização.","error"),{enableHighAccuracy:!0,timeout:1e4})});const m=s.cover;m.addEventListener("change",()=>{const d=m.files[0];d&&Pt(d,s.querySelector(".photo-pick img"),s.querySelector(".photo-pick .ph"))}),s.addEventListener("submit",async d=>{d.preventDefault();const b=(!t||s.starts_on.value!==t.starts_on||s.ends_on.value!==t.ends_on)&&pt(s.starts_on.value,s.ends_on.value);if(b)return g(b,"error");if(s.starts_on.value===s.ends_on.value&&s.end_time.value<=s.start_time.value)return g("O horário de fechamento precisa ser depois da abertura.","error");const _=s.querySelector("button.big");_.disabled=!0,_.textContent="Salvando…";try{const A={type:s.type.value,title:s.title.value.trim(),description:s.description.value.trim()||null,starts_on:s.starts_on.value,ends_on:s.ends_on.value,start_time:s.start_time.value,end_time:s.end_time.value,region:s.region.value,address:s.address.value.trim()||null,reference:s.reference.value.trim()||null,lat:r[0],lng:r[1],photos_only:s.photos_only.value==="1"},$=t?await v.from("sales").update(A).eq("id",t.id).select("id").single():await v.from("sales").insert(A).select("id").single();if($.error)throw Ce("Erro ao salvar a venda",$.error);localStorage.setItem("regiao",A.region);let k=null;if(m.files[0])try{const P=await pe(m.files[0]),C=await v.from("sales").update({cover_url:P}).eq("id",$.data.id);if(C.error)throw C.error}catch(P){k=P}k?g(`Venda salva, mas a foto de capa falhou. ${k.message}`,"error",k):g(t?"Venda atualizada.":"Venda criada como rascunho. Agora cadastre os itens."),N(`/venda/${$.data.id}${t?"":"?novo=1"}`)}catch(A){g(A.message||"Erro ao salvar.","error",ye(A)),_.disabled=!1,_.textContent=t?"Salvar alterações":"Criar venda e cadastrar itens"}})}async function Ba(e){if(!U("/minhas","Entre para ver suas vendas e favoritas."))return;const a=e.params.get("aba")||"vendas";T.innerHTML=`
    <div class="seg wide">
      <a href="#/minhas?aba=vendas" class="${a==="vendas"?"on":""}">Minhas vendas</a>
      <a href="#/minhas?aba=favoritas" class="${a==="favoritas"?"on":""}">Favoritas</a>
    </div>
    <div id="mine">${je(3)}</div>`;let t;if(a==="vendas"){const{data:i,error:u}=await v.from("sales").select(xe).eq("owner_id",f.user.id).order("starts_on",{ascending:!1});if(u)throw u;t=i}else{const{data:i,error:u}=await v.from("favorites").select(`sales(${xe})`).eq("user_id",f.user.id).order("created_at",{ascending:!1});if(u)throw u;t=i.map(c=>c.sales).filter(Boolean)}if(!e.alive())return;const n=D(),o=t.filter(i=>i.ends_on>=n),s=t.filter(i=>i.ends_on<n),l=document.getElementById("mine");if(!t.length){l.innerHTML=a==="vendas"?'<div class="empty"><h2>Você ainda não anunciou nenhuma venda</h2><a class="btn primary" href="#/anunciar">Anunciar uma venda</a></div>':'<div class="empty"><h2>Nenhuma venda salva</h2><p>Toque em "Salvar" numa venda para guardá-la aqui.</p><a class="btn" href="#/">Ver vendas</a></div>';return}l.innerHTML=`
    ${a==="favoritas"&&o.length?'<div id="reminders"></div>':""}
    ${o.length?`<h2 class="section-title">Próximas</h2><div class="cards">${o.map(ee).join("")}</div>`:""}
    ${s.length?`<h2 class="section-title">Encerradas</h2><div class="cards past">${s.map(ee).join("")}</div>`:""}`;const r=document.getElementById("reminders");r&&ae(r,{compact:!0})}async function Ra(e,a,t=""){if(!U(`/venda/${e.id}`,"Entre para conversar com o vendedor."))return;const{data:n,error:o}=await v.rpc("start_conversation",{p_item:a.id});if(o)return g(o.message,"error",/Limite|encontrado|é seu|não recebe/.test(o.message)?null:o);try{t&&sessionStorage.setItem(`chat-rascunho-${n}`,t)}catch{}N(`/chat/${n}`)}let qe=null,J=null,It=0;window.addEventListener("chat-resync",e=>!e.detail?.initial&&location.hash==="#/chat"&&H());async function ja(){const e=++It;if(qe&&v.removeChannel(qe),qe=null,!f.user)return;const{data:a}=await v.auth.getSession();if(e!==It||!f.user)return;a.session&&v.realtime.setAuth(a.session.access_token);let t=!0;qe=v.channel(`user:${f.user.id}`,{config:{private:!0}}).on("broadcast",{event:"message"},({payload:n})=>{window.dispatchEvent(new CustomEvent("chat-message",{detail:n})),!(n.sender_id===f.user?.id||n.conversation_id===J)&&(z(!0),location.hash==="#/chat"?H():location.hash.startsWith("#/chat")||g("Nova mensagem no chat."))}).subscribe(n=>{n==="SUBSCRIBED"&&(window.dispatchEvent(new CustomEvent("chat-resync",{detail:{initial:t}})),t=!1)})}const Ke={disponivel:"Disponível",reservado:"Reservado",vendido:"Vendido"},Na=e=>new Date(e).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),Ze=e=>e?`<img src="${w(He(e))}" alt="" loading="lazy">`:`<span class="chat-noimg">${E.tag}</span>`;async function Ha(e){if(!U("/chat","Entre para ver suas conversas."))return;T.innerHTML=`
    <div class="chat-page">
      <h1>Conversas</h1>
      <div id="reminders"></div>
      <div id="chat-list" class="chat-list" aria-busy="true">${'<div class="chat-row"><span class="chat-thumb sk"></span><span class="sk notif-sk"></span></div>'.repeat(4)}</div>
    </div>`,ae(document.getElementById("reminders"),{compact:!0});const{data:a,error:t}=await v.rpc("my_conversations");if(t)throw t;if(!e.alive())return;const n=document.getElementById("chat-list");if(n.removeAttribute("aria-busy"),!a.length){n.innerHTML=`
      <div class="empty">
        <h2>Nenhuma conversa ainda</h2>
        <p>Viu um item que gostou? Toque em <strong>Tenho interesse</strong> para conversar com o vendedor sobre ele.</p>
        <a class="btn" href="#/">Ver vendas</a>
      </div>`;return}n.innerHTML='<p class="hint chat-swipe-hint">Arraste uma conversa para a esquerda para apagar.</p>'+a.map(o=>`
    <div class="chat-swipe" data-id="${o.id}">
      <span class="chat-swipe-bg" aria-hidden="true">${E.trash}Apagar</span>
      <a class="chat-row ${o.unread?"unread":""}" href="#/chat/${o.id}" draggable="false">
        <span class="chat-thumb">${Ze(o.item_photo)}</span>
        <span class="chat-text">
          <strong>${w(o.item_title)}</strong>
          <small>${o.i_am_seller?"Você vende para":"Vendido por"} ${w(o.other_name)}</small>
          <span class="chat-last">${o.last_mine?"Você: ":""}${w(o.last_message||"")}</span>
        </span>
        <time datetime="${w(o.last_message_at)}">${et(o.last_message_at)}</time>
      </a>
    </div>`).join(""),Oa(n,async o=>{const s=o.dataset.id,{error:l}=await v.rpc("hide_conversation",{p_conv:s});return l?(g("Não foi possível apagar a conversa.","error",l),!1):(z(!0),n.querySelector(".chat-swipe:not([hidden]):not(.removing)")||H(),g("Conversa apagada.","",null,{label:"Desfazer",run:async()=>{const{error:r}=await v.rpc("hide_conversation",{p_conv:s,p_hide:!1});if(r)return g("Não foi possível desfazer.","error",r);location.hash==="#/chat"&&H()}}),!0)})}function Oa(e,a){let t=null,n=0,o=0,s=0,l=!1;e.addEventListener("pointerdown",i=>{t=i.button===0?i.target.closest(".chat-row"):null,n=i.clientX,o=i.clientY,s=0,l=!1}),e.addEventListener("pointermove",i=>{if(!t)return;const u=i.clientX-n,c=i.clientY-o;if(!l){if(Math.abs(c)>10&&Math.abs(c)>Math.abs(u))return void(t=null);if(u>-10)return;l=!0,t.setPointerCapture(i.pointerId),t.classList.add("dragging")}s=Math.min(0,u),t.style.transform=`translateX(${s}px)`});const r=async()=>{if(!t)return;const i=t;if(t=null,i.classList.remove("dragging"),!l)return;if(setTimeout(()=>l=!1),-s<i.offsetWidth*.35)return void(i.style.transform="");const u=i.closest(".chat-swipe");i.style.transform="translateX(-100%)",u.classList.add("removing"),await a(u)?u.hidden=!0:(u.classList.remove("removing"),i.style.transform="")};e.addEventListener("pointerup",r),e.addEventListener("pointercancel",r),e.addEventListener("click",i=>l&&i.preventDefault(),!0)}async function Ua(e,a){if(!U(`/chat/${a}`,"Entre para ver suas conversas."))return;T.innerHTML='<div class="chat-view"><div class="chat-head"><span class="chat-thumb sk"></span><span class="sk notif-sk"></span></div></div>';const[t,n]=await Promise.all([v.rpc("my_conversations",{p_conv:a}),v.from("messages").select("id,sender_id,body,created_at").eq("conversation_id",a).order("created_at").limit(500)]);if(t.error)throw t.error;if(n.error)throw n.error;if(!e.alive())return;const o=t.data?.[0];if(!o){T.innerHTML='<div class="empty"><h2>Conversa não encontrada</h2><a class="btn" href="#/chat">Ver conversas</a></div>';return}document.title=`${o.item_title} — Chat — ${R.APP_NAME}`;const s=n.data;let l="";try{l=sessionStorage.getItem(`chat-rascunho-${a}`)||"",sessionStorage.removeItem(`chat-rascunho-${a}`)}catch{}T.innerHTML=`
    <div class="chat-view">
      <div class="chat-head">
        <a href="#/chat" class="chat-back" aria-label="Voltar para as conversas">${E.chevron}</a>
        <a class="chat-item" href="${o.sale_id?`#/venda/${o.sale_id}`:"#/chat"}">
          <span class="chat-thumb">${Ze(o.item_photo)}</span>
          <span class="chat-text">
            <strong>${w(o.item_title)}</strong>
            <small>${o.item_price!=null?`${Q(o.item_price)} · `:""}${o.item_status?Ke[o.item_status]:"Item removido"} · ${o.i_am_seller?"comprador":"vendedor"}: ${w(o.other_name)}</small>
          </span>
        </a>
        <button class="chat-report" data-report aria-label="Denunciar conversa" title="Denunciar conversa">${E.flag}</button>
      </div>
      ${o.i_am_seller&&o.item_id?`
        <div class="status-toggle chat-status" role="group" aria-label="Situação do item">
          ${Object.entries(G).map(([$,k])=>`<button data-status="${$}" class="${o.item_status===$?"on":""}">${k}</button>`).join("")}
        </div>`:""}
      <div class="chat-scroll" id="chat-scroll">
        <p class="hint chat-safety">Combine a retirada em lugar movimentado e só pague depois de ver o item. Nunca passe senhas ou códigos recebidos por SMS.</p>
        <div class="chat-msgs" id="chat-msgs" aria-live="polite"></div>
      </div>
      <form class="chat-input" id="chat-form">
        <textarea name="body" rows="1" maxlength="2000" placeholder="Escreva uma mensagem" aria-label="Mensagem" required>${w(l)}</textarea>
        <button class="btn primary" aria-label="Enviar">${E.send}</button>
      </form>
    </div>`,document.body.classList.add("chat-mode"),K.push(()=>document.body.classList.remove("chat-mode"));const r=document.getElementById("chat-msgs"),i=document.getElementById("chat-scroll"),u=$=>{const k=B(new Date($));return k===D()?"Hoje":k===B(X(new Date,-1))?"Ontem":new Date($).toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"}).replace(/\./g,"")},c=()=>{let $="";r.innerHTML=s.length?s.map(k=>{const P=u(k.created_at),C=P!==$?`<div class="chat-day">${P}</div>`:"";return $=P,`${C}<div class="msg ${k.sender_id===f.user.id?"mine":""} ${k.pending?"pending":""}">
            <p>${w(k.body).replace(/\n/g,"<br>")}</p><time>${k.pending?"enviando…":Na(k.created_at)}</time></div>`}).join(""):`<p class="hint chat-empty">${o.i_am_seller?"Nenhuma mensagem ainda.":"Mande uma mensagem para o vendedor sobre este item."}</p>`,i.scrollTo(0,i.scrollHeight)};c(),v.rpc("mark_conversation_read",{p_conv:a}).then(()=>z(!0)),J=a;const m=$=>{const k=$.detail;k.conversation_id!==a||s.some(P=>P.id===k.id)||(s.push(k),c(),k.sender_id!==f.user.id&&v.rpc("mark_conversation_read",{p_conv:a}).then(()=>z(!0)))};let d=!1;const x=async()=>{if(!d){d=!0;try{const $=s.filter(y=>!y.pending).at(-1)?.created_at;let k=v.from("messages").select("id,sender_id,body,created_at").eq("conversation_id",a).order("created_at").limit(200);$&&(k=k.gt("created_at",$));const{data:P}=await k,C=(P||[]).filter(y=>!s.some(h=>h.id===y.id));if(J!==a)return;if(!C.length)return void z();s.push(...C),s.sort((y,h)=>!!y.pending-!!h.pending||y.created_at.localeCompare(h.created_at)),c(),C.some(y=>y.sender_id!==f.user.id)&&v.rpc("mark_conversation_read",{p_conv:a}).then(()=>z(!0))}finally{d=!1}}};window.addEventListener("chat-message",m),window.addEventListener("chat-resync",x),K.push(()=>{window.removeEventListener("chat-message",m),window.removeEventListener("chat-resync",x),J=null});const b=document.getElementById("chat-form"),_=b.body,A=()=>{const $=i.scrollHeight-i.scrollTop-i.clientHeight<40;_.style.height="auto",_.style.height=`${Math.min(_.scrollHeight,140)}px`,$&&i.scrollTo(0,i.scrollHeight)};_.addEventListener("input",A),A(),_.addEventListener("keydown",$=>{$.key==="Enter"&&!$.shiftKey&&matchMedia("(pointer: fine)").matches&&($.preventDefault(),b.requestSubmit())}),b.addEventListener("submit",async $=>{$.preventDefault();const k=_.value.trim();if(!k)return;const P={id:`tmp-${Date.now()}`,sender_id:f.user.id,body:k,created_at:new Date().toISOString(),pending:!0};s.push(P),_.value="",A(),c();const{data:C,error:y}=await v.from("messages").insert({conversation_id:a,body:k}).select("id,sender_id,body,created_at").single(),h=s.indexOf(P);if(y){s.splice(h,1),_.value=k,A(),c();const S=/Muitas mensagens|desligou o chat/.test(y.message);return g(S?y.message:"Não foi possível enviar. Tente de novo.","error",S?null:y)}s.some(S=>S.id===C.id)?s.splice(h,1):s[h]=C,c(),Lt("chat")}),l&&_.focus(),T.querySelector(".chat-status")?.addEventListener("click",async $=>{const k=$.target.closest("[data-status]");if(!k)return;const{error:P}=await v.from("items").update({status:k.dataset.status}).eq("id",o.item_id);if(P)return g("Não foi possível atualizar o item.","error",P);o.item_status=k.dataset.status,T.querySelectorAll(".chat-status [data-status]").forEach(C=>C.classList.toggle("on",C===k)),T.querySelector(".chat-item small").innerHTML=`${o.item_price!=null?`${Q(o.item_price)} · `:""}${Ke[o.item_status]} · comprador: ${w(o.other_name)}`,g(`Item marcado como ${Ke[o.item_status].toLowerCase()}.`)}),T.querySelector("[data-report]").onclick=()=>Mt({sale_id:o.sale_id,reported_user_id:o.other_id},o.i_am_seller?"comprador":"vendedor")}const Je=[[window.appColor.DEFAULT,"Verde (padrão)"],["#3563ad","Azul"],["#6741d9","Roxo"],["#c2255c","Rosa"],["#e8590c","Laranja"],["#1c2319","Grafite"],["#ffffff","Branco"]];async function Va(){const e=window.appColor.get(),a=(o,s,l,r="")=>`<a class="menu-row" href="${o}"><span class="menu-icon">${s}</span><span>${l}</span>${r}<span class="menu-go">${E.chevron}</span></a>`,t=f.user;T.innerHTML=`
    <div class="menu-page">
      ${t?`
        <a class="menu-user" href="#/perfil">
          <span class="menu-avatar">${w((f.profile?.name||t.email||"?").trim()[0].toUpperCase())}</span>
          <span><strong>${w(f.profile?.name||"Seu perfil")}</strong><small>${w(t.email||"")}</small></span>
          <span class="menu-go">${E.chevron}</span>
        </a>`:`
        <div class="menu-user guest">
          <span><strong>Entre na sua conta</strong><small>Para anunciar, salvar vendas e conversar com vendedores.</small></span>
          <a class="btn primary" href="#/entrar">Entrar</a>
        </div>`}
      <nav class="menu-list" aria-label="Menu">
        ${a("#/minhas",E.tag,"Minhas vendas")}
        ${a("#/minhas?aba=favoritas",E.heart,"Favoritas")}
        ${a("#/chat",E.chat,"Conversas",f.chatUnread?`<span class="menu-count">${f.chatUnread}</span>`:"")}
        ${a("#/notificacoes",E.bell,"Notificações",f.unread?`<span class="menu-count">${f.unread}</span>`:"")}
        ${a("#/perfil",E.user,"Dados da conta, WhatsApp e Pix")}
        ${a("#/anunciar",E.camera,"Anunciar uma venda")}
      </nav>
      <nav class="menu-list" aria-label="Informações">
        ${a("regras.html",E.flag,"Regras para anunciar")}
        ${a("privacidade.html",E.doc,"Política de Privacidade")}
        ${a("termos.html",E.doc,"Termos de Uso")}
      </nav>
      <section class="menu-list app-colors" aria-labelledby="app-colors-title">
        <div class="menu-row">
          <span class="menu-icon">${E.palette}</span>
          <span><span id="app-colors-title">Cor do app</span><small class="hint">Muda a barra do navegador e os botões. Vale só neste aparelho.</small></span>
        </div>
        <div class="swatches">${Je.map(([o,s])=>`
          <button type="button" class="swatch${o===e?" on":""}" data-color="${o}" style="--swatch:${o}" aria-label="${s}" title="${s}" aria-pressed="${o===e}"></button>`).join("")}
          <label class="swatch custom${Je.some(([o])=>o===e)?"":" on"}" title="Outra cor">
            <input type="color" value="${e}" aria-label="Outra cor">
          </label>
        </div>
      </section>
      ${t?`<button class="btn big menu-logout" id="menu-logout">${E.out}Sair da conta</button>`:""}
    </div>`;const n=o=>{window.appColor.set(o);const s=Je.some(([l])=>l===o);T.querySelectorAll(".swatch").forEach(l=>{const r=l.dataset.color?l.dataset.color===o:!s;l.classList.toggle("on",r),l.dataset.color&&l.setAttribute("aria-pressed",String(r))})};T.querySelectorAll(".swatch[data-color]").forEach(o=>o.addEventListener("click",()=>n(o.dataset.color))),T.querySelector(".swatch.custom input").addEventListener("input",o=>n(o.target.value)),document.getElementById("menu-logout")?.addEventListener("click",async()=>{await ve(v).catch(()=>{}),await v.auth.signOut(),N("/")})}const za={data:"a data",horário:"o horário",endereço:"o endereço"},Wa=e=>e.length>1?`${e.slice(0,-1).join(", ")} e ${e.at(-1)}`:e[0]||"";function Fa(e){const a=e.sale_title||"uma venda";switch(e.kind){case"lembrete_vespera":return{icon:E.bell,cls:"remind",title:`Amanhã: ${a}`,body:"Uma venda que você salvou começa amanhã. Veja os itens e a rota."};case"lembrete_hoje":return{icon:E.bell,cls:"remind",title:`Hoje: ${a}`,body:"Uma venda que você salvou começa hoje. Bom garimpo!"};case"venda_alterada":{const t=Wa((e.detail||"").split(",").map(n=>za[n]).filter(Boolean))||"os dados";return{icon:E.calendar,cls:"change",title:`Mudou: ${a}`,body:`O vendedor alterou ${t}. Confira antes de ir.`}}case"venda_cancelada":return{icon:E.flag,cls:"cancel",title:`Cancelada: ${a}`,body:"O vendedor removeu esta venda."};case"venda_salva":return{icon:E.heart,cls:"saved",title:e.count>1?`${e.count} pessoas salvaram sua venda`:"Alguém salvou sua venda",body:`"${a}". Quem salva recebe lembrete na véspera e no dia.`};case"venda_oculta":return{icon:E.flag,cls:"cancel",title:"Sua venda saiu do ar",body:`"${a}" foi ocultada após denúncias e não aparece mais nas buscas.`};case"venda_perto":return{icon:E.pin,cls:"remind",title:`Venda nova perto de você: ${a}`,body:`${e.detail||"Na sua região"}. Veja os itens antes de todo mundo.`};case"venda_liberada":return{icon:E.flag,cls:"saved",title:"Sua venda voltou ao ar",body:`A moderação revisou "${a}" e ela aparece de novo nas buscas.`};case"denuncia_revisar":return{icon:E.flag,cls:"cancel",title:e.detail==="oculta"?`Oculta por denúncias: ${a}`:`Denúncia: ${a}`,body:`${e.count>1?`${e.count} pessoas denunciaram`:"Uma pessoa denunciou"} esta venda. Toque para revisar.`};default:return{icon:E.bell,cls:"",title:a,body:""}}}function et(e){const a=Math.round((Date.now()-new Date(e))/6e4);if(a<1)return"agora";if(a<60)return`há ${a} min`;if(a<1440)return`há ${Math.round(a/60)} h`;const t=new Date(e);return B(t)===B(X(new Date,-1))?"ontem":t.toLocaleDateString("pt-BR",{day:"numeric",month:"short"}).replace(/\./g,"")}async function Xa(e){if(!U("/notificacoes","Entre para ver suas notificações."))return;T.innerHTML=`
    <div class="notif-page">
      <div class="notif-head"><h1>Notificações</h1><span id="notif-tools"></span></div>
      <div id="notif-list"><div class="notif-list" aria-busy="true" aria-label="Carregando">${'<div class="notif"><span class="notif-icon sk"></span><span class="sk notif-sk"></span></div>'.repeat(4)}</div></div>
    </div>`;const{data:a,error:t}=await v.from("notifications").select("id,kind,sale_id,sale_title,detail,count,read_at,created_at").order("created_at",{ascending:!1}).limit(100);if(t)throw t;if(!e.alive())return;const n=document.getElementById("notif-list");if(!a.length){n.innerHTML=`
      <div class="empty">
        <h2>Nenhuma notificação ainda</h2>
        <p>Salve vendas para receber aqui o lembrete na véspera e no dia, e saber se mudarem de data ou endereço.</p>
        <div id="reminders"></div>
        <a class="btn" href="#/">Ver vendas</a>
      </div>`,ae(document.getElementById("reminders"),{compact:!0});return}const o=i=>{const u=Fa(i),c=`
      <span class="notif-icon ${u.cls}">${u.icon}</span>
      <span class="notif-text"><strong>${w(u.title)}</strong><span>${w(u.body)}</span><time datetime="${w(i.created_at)}">${et(i.created_at)}</time></span>`,m=`notif ${i.read_at?"":"unread"}`;return i.sale_id?`<a class="${m}" href="#/venda/${i.sale_id}">${c}</a>`:`<div class="${m}">${c}</div>`},s=a.filter(i=>!i.read_at),l=a.filter(i=>i.read_at);n.innerHTML=`
    ${s.length?`<h2 class="section-title">Novas</h2><div class="notif-list">${s.map(o).join("")}</div>`:""}
    ${l.length?`<h2 class="section-title">Anteriores</h2><div class="notif-list">${l.map(o).join("")}</div>`:""}
    <div id="reminders"></div>`,ae(document.getElementById("reminders"),{compact:!0});const r=document.getElementById("notif-tools");if(r.innerHTML='<button class="btn small" id="notif-clear">Limpar tudo</button>',document.getElementById("notif-clear").onclick=async()=>{const{error:i}=await v.from("notifications").delete().eq("user_id",f.user.id);if(i)return g("Não foi possível limpar as notificações.","error",i);g("Notificações apagadas."),H()},s.length){const{error:i}=await v.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",f.user.id).is("read_at",null);i||(f.unread=0,Be())}}async function Ya(e){if(f.user){const t=sessionStorage.getItem("next")||"/";return sessionStorage.removeItem("next"),N(t)}const a=e.params.get("msg");T.innerHTML=`
    <div class="auth">
      <h1>Entrar</h1>
      <p class="hint">${w(a||"Navegar é livre. O cadastro só é pedido para anunciar, salvar vendas ou falar com o vendedor.")}</p>
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
    </div>`,document.getElementById("google").onclick=async()=>{const{error:t}=await v.auth.signInWithOAuth({provider:"google",options:{redirectTo:fe}});t&&g(t.message,"error",t)},document.getElementById("email-form").addEventListener("submit",async t=>{t.preventDefault();const n=t.target.email.value.trim(),o=t.target.querySelector("button");o.disabled=!0;const{error:s}=await v.auth.signInWithOtp({email:n,options:{emailRedirectTo:fe}});if(o.disabled=!1,s)return g(s.message,"error",s);t.target.innerHTML=`<div class="notice"><strong>Confira seu e-mail.</strong><p>Enviamos um link de acesso para ${w(n)}. Abra-o neste mesmo aparelho e navegador.</p></div>`})}async function Qa(e){if(!U("/perfil"))return;const a=e.params.get("msg"),t=f.contact||{};T.innerHTML=`
    <form id="profile-form" class="form">
      <h1>Seu perfil</h1>
      ${a?`<div class="notice">${w(a)}</div>`:""}
      <p class="hint">${w(f.user.email||"")}</p>
      <label>Nome que aparece nas vendas
        <input name="name" required maxlength="80" value="${w(f.profile?.name)}">
      </label>
      <fieldset class="pix-box">
        <legend>${E.chat} Chat com compradores</legend>
        <label class="check"><input type="checkbox" name="chat_enabled" ${f.profile?.chat_enabled===!1?"":"checked"}> Receber mensagens dos compradores pelo chat</label>
        <p class="hint">Desligue se você só quer divulgar a venda: o botão "Tenho interesse" some das suas vendas e ninguém manda mensagem, nem nas conversas que já existem. Você continua vendo e respondendo as conversas antigas.</p>
      </fieldset>
      <fieldset class="pix-box">
        <legend>${E.whatsapp} WhatsApp (opcional)</legend>
        <p class="hint">Os compradores falam com você pelo <strong>chat do app</strong>, sem ver seu número. Se preferir, libere também o WhatsApp.</p>
        <label>WhatsApp com DDD
          <input name="whatsapp" type="tel" inputmode="tel" placeholder="(61) 99999-9999" value="${w(mt(t.whatsapp))}">
        </label>
        <label class="check"><input type="checkbox" name="show_whatsapp" ${t.show_whatsapp?"checked":""}> Mostrar o botão do WhatsApp nas minhas vendas</label>
        <p class="hint">Desmarcado, seu número fica guardado e ninguém vê. Marcado, aparece para compradores logados que tocarem em "Falar no WhatsApp".
          ${t.whatsapp?t.phone_verified?'<span class="ok">Telefone verificado ✓</span>':f.requireVerification?'<span class="warn">Telefone ainda não verificado</span>':"":""}</p>
      </fieldset>
      <div id="otp-box"></div>

      <fieldset class="pix-box">
        <legend>${E.pix} Receber por Pix (opcional)</legend>
        <p class="hint">Com a chave cadastrada, cada item mostra um QR Code com o valor já preenchido. O dinheiro vai direto para a sua conta, sem taxas. A chave só aparece para compradores logados.</p>
        <div class="row">
          <label>Tipo de chave
            <select name="pix_type">
              ${Object.entries(st).map(([l,r])=>`<option value="${l}" ${l===(t.pix_key?rt(t.pix_key):"aleatoria")?"selected":""}>${r}</option>`).join("")}
            </select>
          </label>
          <label>Chave Pix
            <input name="pix_key" value="${w(t.pix_key?Vt(t.pix_key):"")}" autocomplete="off">
          </label>
        </div>
        <p class="hint">Recomendamos a <strong>chave aleatória</strong>: crie uma no app do seu banco, em Pix &gt; Minhas chaves.</p>
        <div class="notice warn-box" id="pix-cpf-warning" ${rt(t.pix_key)==="cpf"&&t.pix_key?"":"hidden"}>
          <p><strong>Atenção:</strong> com chave CPF ou CNPJ, quem for pagar vê o seu documento. Prefira a chave aleatória.</p>
        </div>
        <label>Nome do recebedor (como aparece no banco)
          <input name="pix_name" maxlength="25" value="${w(t.pix_name||"")}" placeholder="${w((f.profile?.name||"").slice(0,25))}">
        </label>
      </fieldset>

      <fieldset class="pix-box prefs-form">
        <legend>${E.bell} Alertas e novidades</legend>
        ${qt(f.prefs)}
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
    </div>`;const n=document.getElementById("profile-form"),o=document.getElementById("otp-box");n.pix_type.addEventListener("change",()=>{document.getElementById("pix-cpf-warning").hidden=n.pix_type.value!=="cpf"});const s=async()=>{await De(f.user);const l=sessionStorage.getItem("next");sessionStorage.removeItem("next"),l&&gt()?N(l):H()};n.addEventListener("submit",async l=>{l.preventDefault();const r=n.whatsapp.value.trim(),i=r?Jt(r):null;if(r&&!i)return g("Informe um celular válido com DDD.","error");const u=n.show_whatsapp.checked;if(u&&!i)return g("Para mostrar o botão do WhatsApp, informe o número.","error");const c=n.pix_key.value.trim(),m=c?Ut(n.pix_type.value,c):null;if(c&&!m)return g(`Chave Pix inválida para o tipo "${st[n.pix_type.value]}".`,"error");const d=m?n.pix_name.value.trim()||n.name.value.trim().slice(0,25):null,x=At(n);if(n.alerts.checked&&!x.home_region)return g("Para receber alertas, escolha a região onde você mora.","error");const b=await v.from("profiles").update({name:n.name.value.trim(),chat_enabled:n.chat_enabled.checked}).eq("id",f.user.id);if(b.error)return g(b.error.message,"error",b.error);try{await Qe(x)}catch($){return g(`Erro ao salvar os alertas: ${$.message}`,"error",$)}if(u!==!!t.show_whatsapp){const $=await v.from("contacts").update({show_whatsapp:u}).eq("user_id",f.user.id);if($.error)return g(`Erro ao salvar a opção do WhatsApp: ${$.error.message}`,"error",$.error)}if(m!==(t.pix_key||null)||d!==(t.pix_name||null)){const $=await v.from("contacts").update({pix_key:m,pix_name:d}).eq("user_id",f.user.id);if($.error)return g(`Erro ao salvar o Pix: ${$.error.message}`,"error",$.error)}const _=i!==(t.whatsapp||null);if(f.requireVerification&&i&&!(_===!1&&t.phone_verified)){const{error:$}=await v.auth.updateUser({phone:"+"+i});if($)return g($.message,"error",$);o.innerHTML=`
        <div class="notice">
          <label>Digite o código enviado por SMS para ${mt(i)}
            <input name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8">
          </label>
          <button type="button" class="btn primary" id="verify">Confirmar código</button>
        </div>`,document.getElementById("verify").onclick=async()=>{const k=o.querySelector("input").value.trim(),{error:P}=await v.auth.verifyOtp({phone:"+"+i,token:k,type:"phone_change"});if(P)return g("Código inválido ou expirado.","error");g("Telefone verificado!"),s()};return}if(_){const $=await v.from("contacts").update({whatsapp:i}).eq("user_id",f.user.id);if($.error)return g($.error.message,"error",$.error)}g("Perfil salvo."),s()}),ae(document.getElementById("reminders")),document.getElementById("logout").onclick=async()=>{await ve(v).catch(()=>{}),await v.auth.signOut(),N("/")},document.getElementById("delete-account").onclick=async l=>{if(document.getElementById("delete-confirm").value.trim().toUpperCase()!=="EXCLUIR")return g("Digite EXCLUIR para confirmar.","error");const r=l.currentTarget;r.disabled=!0,r.textContent="Excluindo…";try{const i=v.storage.from("photos");for(let c=0;c<50;c++){const{data:m,error:d}=await i.list(f.user.id,{limit:100});if(d)throw d;if(!m.length)break;const{data:x,error:b}=await i.remove(m.map(_=>`${f.user.id}/${_.name}`));if(b)throw b;if(!x?.length)throw new Error("as fotos não puderam ser apagadas.")}await ve(v).catch(()=>{});const{error:u}=await v.rpc("delete_my_account");if(u)throw u;await v.auth.signOut({scope:"local"}),g("Sua conta foi excluída."),N("/")}catch(i){g(`Não foi possível excluir a conta: ${i.message}`,"error",i),r.disabled=!1,r.textContent="Excluir minha conta para sempre"}}}function Ga(){const e=window.visualViewport;if(!e)return;const a=()=>{const t=e.scale<1.05&&window.innerHeight-e.height>120;document.documentElement.classList.toggle("teclado",t),t?document.documentElement.style.setProperty("--app-h",`${Math.round(e.height)}px`):document.documentElement.style.removeProperty("--app-h")};e.addEventListener("resize",a),a()}async function Ka(){if(Nt(R.SENTRY_DSN),Ga(),document.getElementById("app-name").textContent=R.APP_NAME,!lt){T.innerHTML=`
      <div class="empty">
        <h2>Falta configurar o Supabase</h2>
        <p>Edite <code>js/config.js</code> com a URL e a chave anon do seu projeto, e rode <code>supabase/schema.sql</code> no SQL Editor. Veja o README.</p>
      </div>`;return}const e=new URLSearchParams(location.search),a=/^#(access_token|error)=/.test(location.hash)?new URLSearchParams(location.hash.slice(1)):null,t=e.get("error_description")??a?.get("error_description"),{data:n}=await v.auth.getSession();(location.search||a)&&history.replaceState(null,"",location.pathname+(a?"#/":location.hash)),a?.get("error_code")==="otp_expired"?g("Esse link já foi usado ou venceu. Peça outro na tela de Entrar.","error"):t?g(t,"error"):e.has("code")&&!n.session&&g("Não deu para entrar com esse link. Abra-o no mesmo aparelho e navegador em que você pediu, ou peça outro.","error");const[,o]=await Promise.all([De(n.session?.user??null),v.rpc("require_phone_verification")]);f.requireVerification=!!o.data,v.auth.onAuthStateChange((l,r)=>{["SIGNED_IN","SIGNED_OUT","USER_UPDATED"].includes(l)&&((r?.user?.id??null)===(f.user?.id??null)&&l!=="USER_UPDATED"||setTimeout(async()=>{await De(r?.user??null),l==="SIGNED_OUT"&&H()},0))});const s=sessionStorage.getItem("next");n.session&&s&&(location.hash===""||location.hash==="#/"||location.hash.startsWith("#/entrar"))&&(sessionStorage.removeItem("next"),history.replaceState(null,"",location.pathname+"#"+s)),window.addEventListener("hashchange",H),H()}const Za='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',Ja='<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',Dt=matchMedia("(prefers-color-scheme: dark)"),tt=()=>(document.documentElement.dataset.theme||(Dt.matches?"dark":"light"))==="dark";function at(){const e=document.getElementById("theme-toggle"),a=tt()?"Mudar para modo claro":"Mudar para modo escuro";e.innerHTML=tt()?Za:Ja,e.setAttribute("aria-label",a),e.title=a}document.getElementById("theme-toggle").addEventListener("click",()=>{const e=tt()?"light":"dark";document.documentElement.dataset.theme=e;try{localStorage.setItem("tema",e)}catch{}at()}),Dt.addEventListener("change",at),at(),"serviceWorker"in navigator&&navigator.serviceWorker.register("sw.js").catch(()=>{}),Ka();
