let n=null,s=!1;window.addEventListener("beforeinstallprompt",t=>{t.preventDefault(),n=t,i()}),window.addEventListener("appinstalled",()=>{n=null,s=!0,i()});const l=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===!0,a=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1,m=()=>/android/i.test(navigator.userAgent),g=()=>!s&&!l()&&(!!n||a()||m());function i(){const t=document.getElementById("menu-install");t&&(t.hidden=!g())}async function v(){if(!n)return a()?c():f();const t=n;n=null,t.prompt();const{outcome:e}=await t.userChoice;e==="accepted"&&(s=!0),i()}function d(t,e){try{return JSON.parse(localStorage.getItem(t))??e}catch{return e}}function h(t){if(l())return;const e=d("install-dismissed",0);if(!(Date.now()-e<336*3600*1e3)){if(t==="view-sale"){const o=d("sale-views",0)+1;if(localStorage.setItem("sale-views",JSON.stringify(o)),o<2)return}!n&&!a()||document.querySelector(".install-banner")||setTimeout(p,1200)}}function p(){const t=document.createElement("div");t.className="install-banner",t.innerHTML=`
    <img src="icons/icon-192.png" alt="" width="40" height="40">
    <div><strong>Tenha o Desapega na tela inicial</strong><span>Abra as vendas do fim de semana com um toque.</span></div>
    <button class="btn primary small" data-install>Adicionar</button>
    <button class="close" aria-label="Agora não" data-dismiss>&times;</button>`,document.body.appendChild(t),t.querySelector("[data-dismiss]").onclick=()=>{localStorage.setItem("install-dismissed",JSON.stringify(Date.now())),t.remove()},t.querySelector("[data-install]").onclick=async()=>{if(t.remove(),n){n.prompt();const{outcome:e}=await n.userChoice;n=null,i(),e!=="accepted"&&localStorage.setItem("install-dismissed",JSON.stringify(Date.now()))}else a()&&c()}}function c(){u("Adicionar à Tela de Início",`
    <li>Abra este site no <strong>Safari</strong>.</li>
    <li>Toque no botão <strong>Compartilhar</strong>
      <svg viewBox="0 0 24 24" class="inline"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>
      na barra de baixo.</li>
    <li>Role e toque em <strong>Adicionar à Tela de Início</strong>.</li>
    <li>Toque em <strong>Adicionar</strong>. Pronto!</li>`)}function f(){u("Instalar o app",`
    <li>Toque no menu do navegador (os <strong>três pontinhos</strong>, no alto, ou as <strong>três linhas</strong>, embaixo).</li>
    <li>Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
    <li>Confirme em <strong>Instalar</strong> ou <strong>Adicionar</strong>. Pronto!</li>`)}function u(t,e){const o=document.createElement("div");o.className="modal-backdrop",o.innerHTML=`
    <div class="modal ios-tutorial">
      <h2>${t}</h2>
      <ol>${e}</ol>
      <button class="btn primary" data-close>Entendi</button>
    </div>`,o.addEventListener("click",r=>{(r.target===o||r.target.closest("[data-close]"))&&o.remove()}),document.body.appendChild(o)}export{g as canInstall,v as installNow,h as maybeSuggestInstall};
