// Service worker: deixa o app abrir rápido e funcionar com internet ruim.
// Arquivos do app: rede primeiro, cache como reserva. Dados do Supabase: sempre da rede.
const CACHE = 'desapego-v7';
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
  'manifest.webmanifest',
  'icons/icon.svg',
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
