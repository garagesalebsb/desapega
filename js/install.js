// Convite para "Adicionar à tela inicial" na hora certa:
// depois de salvar uma venda ou de abrir a segunda venda. No iPhone, mostra um tutorial.

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function maybeSuggestInstall(reason) {
  if (isStandalone()) return;
  const dismissed = read('install-dismissed', 0);
  if (Date.now() - dismissed < 14 * 24 * 3600 * 1000) return;
  if (reason === 'view-sale') {
    const views = read('sale-views', 0) + 1;
    localStorage.setItem('sale-views', JSON.stringify(views));
    if (views < 2) return;
  }
  if (!deferredPrompt && !isIOS()) return;
  if (document.querySelector('.install-banner')) return;
  setTimeout(showBanner, 1200);
}

function showBanner() {
  const el = document.createElement('div');
  el.className = 'install-banner';
  el.innerHTML = `
    <img src="icons/icon-192.png" alt="" width="40" height="40">
    <div><strong>Tenha o Desapega na tela inicial</strong><span>Abra as vendas do fim de semana com um toque.</span></div>
    <button class="btn primary small" data-install>Adicionar</button>
    <button class="close" aria-label="Agora não" data-dismiss>&times;</button>`;
  document.body.appendChild(el);

  el.querySelector('[data-dismiss]').onclick = () => {
    localStorage.setItem('install-dismissed', JSON.stringify(Date.now()));
    el.remove();
  };
  el.querySelector('[data-install]').onclick = async () => {
    el.remove();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome !== 'accepted') localStorage.setItem('install-dismissed', JSON.stringify(Date.now()));
    } else if (isIOS()) {
      showIOSTutorial();
    }
  };
}

function showIOSTutorial() {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
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
    </div>`;
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) wrap.remove();
  });
  document.body.appendChild(wrap);
}
