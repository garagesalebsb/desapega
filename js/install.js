let a=null;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault(),a=e});const s=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===!0,i=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1;function o(e,t){try{return JSON.parse(localStorage.getItem(e))??t}catch{return t}}function d(e){if(s())return;const t=o("install-dismissed",0);if(!(Date.now()-t<336*3600*1e3)){if(e==="view-sale"){const n=o("sale-views",0)+1;if(localStorage.setItem("sale-views",JSON.stringify(n)),n<2)return}!a&&!i()||document.querySelector(".install-banner")||setTimeout(r,1200)}}function r(){const e=document.createElement("div");e.className="install-banner",e.innerHTML=`
    <img src="icons/icon-192.png" alt="" width="40" height="40">
    <div><strong>Tenha o Desapega na tela inicial</strong><span>Abra as vendas do fim de semana com um toque.</span></div>
    <button class="btn primary small" data-install>Adicionar</button>
    <button class="close" aria-label="Agora não" data-dismiss>&times;</button>`,document.body.appendChild(e),e.querySelector("[data-dismiss]").onclick=()=>{localStorage.setItem("install-dismissed",JSON.stringify(Date.now())),e.remove()},e.querySelector("[data-install]").onclick=async()=>{if(e.remove(),a){a.prompt();const{outcome:t}=await a.userChoice;a=null,t!=="accepted"&&localStorage.setItem("install-dismissed",JSON.stringify(Date.now()))}else i()&&l()}}function l(){const e=document.createElement("div");e.className="modal-backdrop",e.innerHTML=`
    <div class="modal ios-tutorial">
      <h2>Adicionar à Tela de Início</h2>
      <ol>
        <li>Abra este site no <strong>Safari</strong>.</li>
        <li>Toque no botão <strong>Compartilhar</strong>
          <svg viewBox="0 0 24 24" class="inline"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>
          na barra de baixo.</li>
        <li>Role e toque em <strong>Adicionar à Tela de Início</strong>.</li>
        <li>Toque em <strong>Adicionar</strong>. Pronto!</li>
      </ol>
      <button class="btn primary" data-close>Entendi</button>
    </div>`,e.addEventListener("click",t=>{(t.target===e||t.target.closest("[data-close]"))&&e.remove()}),document.body.appendChild(e)}export{d as maybeSuggestInstall};
