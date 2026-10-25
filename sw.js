// Service worker: deixa o app abrir rápido e funcionar com internet ruim.
// Arquivos do app: rede primeiro, cache como reserva. Dados do Supabase: sempre da rede.
const CACHE = 'desapego-v22';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/config.js',
  'js/data.js',
  'js/install.js',
  'js/pix.js',
  'js/metadata.js',
  'js/monitoring.js',
  'js/when.js',
  'js/reminders.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/favicon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const cdn = ['unpkg.com', 'cdn.jsdelivr.net'].includes(url.hostname);
  if (!sameOrigin && !cdn) return;
  // O ícone da tela de início do iPhone vem direto da rede (o Safari falha às vezes quando passa pelo service worker).
  if (url.pathname.endsWith('/apple-touch-icon.png')) return;

  if (cdn) {
    // Bibliotecas com versão fixa: cache primeiro.
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }

  // "no-cache" revalida com o servidor: uma versão nova publicada chega na hora.
  e.respondWith(
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./'))),
  );
});

// Lembretes das vendas salvas (enviados pelo GitHub Actions: scripts/send-reminders.mjs).
self.addEventListener('push', (e) => {
  let msg = {};
  try {
    msg = e.data ? e.data.json() : {};
  } catch {}
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((wins) => {
      // App aberto: atualiza os números do sininho e do chat.
      wins.forEach((w) => w.postMessage({ type: 'push' }));
      // A pessoa já está vendo esta conversa: não precisa de aviso.
      if (msg.url && wins.some((w) => w.focused && w.visibilityState === 'visible' && w.url === msg.url)) return;
      return self.registration.showNotification(msg.title || 'Desapega', {
        body: msg.body || 'Uma venda que você salvou está chegando.',
        // Sem imagem o Chrome do Android desenha uma bola com a letra do site; uma imagem transparente não mostra nada.
        icon: 'icons/vazio.png',
        badge: 'icons/badge-96.png',
        tag: msg.tag,
        renotify: !!msg.tag, // mensagem nova da mesma conversa toca de novo
        data: { url: msg.url || './#/minhas?aba=favoritas' },
      });
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => w.url.startsWith(self.registration.scope));
      if (win) return win.focus().then(() => win.navigate(url)).catch(() => self.clients.openWindow(url));
      return self.clients.openWindow(url);
    }),
  );
});
