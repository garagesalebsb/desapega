import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { CONFIG } from './config.js';
import { REGIONS, DF_CENTER, regionByName, SALE_TYPES, CATEGORIES, REPORT_REASONS } from './data.js';
import { maybeSuggestInstall } from './install.js';
import { stripMetadata } from './metadata.js';
import { initMonitoring, reportError } from './monitoring.js';
import { saleStatus, distanceKm, formatDistance, googleCalendarUrl, icsFor } from './when.js';
import { PIX_TYPES, guessPixType, normalizePixKey, formatPixKey, pixPayload, qrSvg, qrImage } from './pix.js';
import { pushSupport, remindersActive, enableReminders, disableReminders, syncReminders } from './reminders.js';

const $view = document.getElementById('view');
const configured = !CONFIG.SUPABASE_URL.includes('SEU-PROJETO');
const sb = configured
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    })
  : null;

// Endereço base do site (funciona tanto em usuario.github.io quanto em usuario.github.io/repositorio/)
const BASE_URL = location.origin + location.pathname.replace(/index\.html$/, '');

const state = {
  user: null,
  profile: null,
  contact: null,
  favorites: new Set(),
  requireVerification: false,
  unread: 0,
  chatUnread: 0,
};

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const brl = (v) =>
  v == null ? 'A combinar' : Number(v) === 0 ? 'Grátis' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const isoDate = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const today = () => isoDate(new Date());

// Mesmas regras do banco (supabase/015): começa em até 60 dias e dura até 7.
const MAX_START_DAYS = 60;
const MAX_SALE_DAYS = 7;
const maxStart = () => isoDate(addDays(new Date(), MAX_START_DAYS));
function checkSaleDates(starts, ends) {
  if (ends < starts) return 'O último dia não pode ser antes do início.';
  if (starts > maxStart()) return `A venda precisa começar em até ${MAX_START_DAYS} dias.`;
  if ((parseDate(ends) - parseDate(starts)) / 864e5 >= MAX_SALE_DAYS) return `A venda pode durar no máximo ${MAX_SALE_DAYS} dias.`;
  return null;
}

function fmtDay(s) {
  const d = parseDate(s);
  const t = today();
  if (s === t) return 'Hoje';
  if (s === isoDate(addDays(new Date(), 1))) return 'Amanhã';
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
}
// Título dos carrosséis por dia: "Hoje", "Amanhã, domingo", "Sábado, 1 de novembro".
function fmtDayLong(s) {
  const d = parseDate(s);
  const week = d.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '');
  if (s === today()) return 'Hoje';
  if (s === isoDate(addDays(new Date(), 1))) return `Amanhã, ${week}`;
  const long = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return long.charAt(0).toUpperCase() + long.slice(1);
}
// "08:00" → "8h", "14:30" → "14h30"
const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${Number(h)}h${m === '00' ? '' : m}`;
};
function fmtWhen(s) {
  const days = s.starts_on === s.ends_on ? fmtDay(s.starts_on) : `${fmtDay(s.starts_on)} a ${fmtDay(s.ends_on)}`;
  return `${days} · ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`;
}

function nextSaturday() {
  const d = new Date();
  const diff = (6 - d.getDay() + 7) % 7;
  return addDays(d, diff);
}
function thisSunday() {
  const d = new Date();
  return addDays(d, (7 - d.getDay()) % 7);
}

function onlyDigits(s) {
  return String(s ?? '').replace(/\D/g, '');
}
function normalizePhone(s) {
  let d = onlyDigits(s);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return /^55\d{10,11}$/.test(d) ? d : null;
}
function fmtPhone(d) {
  if (!d) return '';
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d;
}
function parsePrice(s) {
  const t = String(s ?? '').trim();
  if (!t) return null;
  const n = Number(t.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

let toastTimer;
// Com "err", a falha também vai para o monitoramento (erros de digitação do usuário não passam err).
function toast(msg, kind = '', err = null) {
  if (err && !isNetworkError(err)) reportError(err, (location.hash.split('?')[0] || '#/').replace(/[0-9a-f-]{36}/g, ':id'));
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), kind === 'error' ? 9000 : 3500);
}
// Regra do banco (limite, data, denúncia repetida): só mostra a mensagem, não é falha do app.
const RULE_ERROR = 'DS400';
const unexpected = (err) => (err?.code === RULE_ERROR ? null : err);
const wrapError = (msg, error) => Object.assign(new Error(`${msg}: ${error.message}`), { code: error.code });

const navigate = (path) => (location.hash = '#' + path);
const saleUrl = (id) => `${BASE_URL}v/${id}/`;

// Com { keep: true }, um toque fora não fecha (para janelas com muito preenchimento, como o lote).
function openModal(html, className = '', { keep = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal ${className}" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => {
    if ((e.target === wrap && !keep) || e.target.closest('[data-close]')) close();
  });
  document.body.appendChild(wrap);
  return { el: wrap.querySelector('.modal'), close };
}

const icon = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.7-6-11a6 6 0 0 1 12 0c0 5.3-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4m0 0h11l-2 4 2 4H5"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M4 5.5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-3-7z"/><path d="m11 13 9-9"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  out: '<svg viewBox="0 0 24 24"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/></svg>',
  doc: '<svg viewBox="0 0 24 24"><path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg>',
  palette: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.9 1.4-2l-.4-1a1.5 1.5 0 0 1 1.4-2H17a4 4 0 0 0 4-4c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  pix: '<svg viewBox="0 0 24 24"><path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/><path d="M8 12h8"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24"><path d="M4 20l1.2-3.8A8 8 0 1 1 8 19z"/><path d="M9 9.5c.5 2.5 2.5 4.5 5 5l1.2-1.2 2 1-.4 1.6c-4.4.4-9-4.2-8.6-8.6L9.8 7l1 2z"/></svg>',
};

function mapsLinks(s) {
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`,
    waze: `https://waze.com/ul?ll=${s.lat},${s.lng}&navigate=yes`,
  };
}

// ---------------------------------------------------------------------
// Mapa (Leaflet + OpenStreetMap)
// ---------------------------------------------------------------------
let cleanup = [];
// O DF com folga: arrastando, o mapa não sai de Brasília.
const DF_BOUNDS = [[-16.4, -48.65], [-15.2, -47.05]];
// recenter: o que o botão de centralizar faz (padrão: volta para a vista inicial).
function makeMap(el, center, zoom, { recenter, ...opts } = {}) {
  const map = L.map(el, { scrollWheelZoom: false, maxBounds: DF_BOUNDS, maxBoundsViscosity: 0.9, minZoom: 9, ...opts }).setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);
  const Recenter = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const btn = L.DomUtil.create('button', 'map-recenter leaflet-bar');
      btn.type = 'button';
      btn.title = 'Centralizar o mapa';
      btn.setAttribute('aria-label', 'Centralizar o mapa');
      btn.innerHTML = icon.target;
      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        if (recenter) recenter(map);
        else map.setView(center, zoom);
      });
      return btn;
    },
  });
  map.addControl(new Recenter());
  // Ao trocar de tela: cancela o ajuste pendente e para animações antes de remover o mapa
  // (remover no meio de uma animação gera erro no Leaflet).
  const resize = setTimeout(() => map.invalidateSize({ animate: false }), 50);
  cleanup.push(() => {
    clearTimeout(resize);
    map.stop();
    map.remove();
  });
  return map;
}
const pinIcon = (type) =>
  L.divIcon({ className: `pin pin-${type}`, html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });

// ---------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------
async function setUser(user) {
  state.user = user;
  state.profile = null;
  state.contact = null;
  state.favorites = new Set();
  state.moderator = false;
  state.prefs = undefined; // undefined = não carregou; null = nunca respondeu o convite dos alertas
  if (user) {
    const [p, c, f, m, pr] = await Promise.all([
      sb.from('profiles').select('id,name,chat_enabled').eq('id', user.id).maybeSingle(),
      sb.from('contacts').select('whatsapp,phone_verified,pix_key,pix_name,show_whatsapp').eq('user_id', user.id).maybeSingle(),
      sb.from('favorites').select('sale_id').eq('user_id', user.id),
      sb.from('moderators').select('user_id').eq('user_id', user.id).maybeSingle(),
      sb.from('preferences').select('home_region,nearby,regions,interests,alerts,news_email').eq('user_id', user.id).maybeSingle(),
    ]);
    state.prefs = pr.error ? undefined : pr.data;
    state.profile = p.data;
    state.contact = c.data;
    state.favorites = new Set((f.data || []).map((r) => r.sale_id));
    state.moderator = !!m.data;
    syncReminders(sb).catch(() => {});
  }
  updateHeader();
  refreshUnread(true);
  listenChat();
}

// Número no sininho: atualiza ao trocar de tela (no máximo a cada 30 s), ao voltar para o app
// e quando chega uma notificação no celular.
let unreadCheckedAt = 0;
let unreadTurn = 0;
async function refreshUnread(force = false) {
  if (!state.user) {
    state.unread = 0;
    state.chatUnread = 0;
    return updateBadge();
  }
  if (!force && Date.now() - unreadCheckedAt < 30000) return;
  unreadCheckedAt = Date.now();
  const turn = ++unreadTurn;
  const [n, c] = await Promise.all([
    sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
    sb.rpc('chat_unread_count'),
  ]);
  // Uma contagem mais nova já foi pedida (por exemplo, depois de marcar a conversa aberta como lida):
  // esta resposta pode ser de antes e mostraria um número que já não vale.
  if (turn !== unreadTurn) return;
  // Falha de rede ou banco ainda sem a tabela: só não mostra o número.
  if (!n.error) state.unread = n.count || 0;
  if (!c.error) state.chatUnread = c.data || 0;
  updateBadge();
}

function updateBadge() {
  const badge = document.getElementById('notif-badge');
  badge.hidden = !state.unread;
  badge.textContent = state.unread > 9 ? '9+' : String(state.unread);
  document.getElementById('notif-link').setAttribute('aria-label', state.unread ? `Notificações: ${state.unread} nova(s)` : 'Notificações');
  const chat = document.getElementById('chat-badge');
  chat.hidden = !state.chatUnread;
  chat.textContent = state.chatUnread > 9 ? '9+' : String(state.chatUnread);
  document.getElementById('chat-tab').setAttribute('aria-label', state.chatUnread ? `Chat: ${state.chatUnread} conversa(s) com mensagem nova` : 'Chat');
}

// No celular a conexão em tempo real cai com o app em segundo plano: ao voltar, ou quando chega
// uma notificação, a tela do chat busca o que chegou nesse meio-tempo ('chat-resync').
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!openConversation) refreshUnread(); // com uma conversa aberta, quem atualiza é a própria conversa
  window.dispatchEvent(new Event('chat-resync'));
});
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.type !== 'push') return;
  // Mensagem da conversa que está aberta: ela já é marcada como lida, sem número no ícone do chat.
  const here = openConversation && e.data.url?.endsWith(`/chat/${openConversation}`) && document.visibilityState === 'visible';
  if (!here) refreshUnread(true);
  window.dispatchEvent(new Event('chat-resync'));
});

function updateHeader() {
  const link = document.getElementById('account-link');
  if (state.user) {
    link.textContent = state.profile?.name?.split(' ')[0] || 'Perfil';
    link.href = '#/perfil';
  } else {
    link.textContent = 'Entrar';
    link.href = '#/entrar';
  }
  document.getElementById('notif-link').hidden = !state.user;
}

function requireLogin(next, msg = 'Entre para continuar.') {
  if (state.user) return true;
  sessionStorage.setItem('next', next);
  navigate('/entrar?msg=' + encodeURIComponent(msg));
  return false;
}

// O contato é pelo chat do app; o telefone só é exigido se a verificação por SMS estiver ligada.
function canPublish() {
  return !state.requireVerification || !!state.contact?.phone_verified;
}

// ---------------------------------------------------------------------
// Roteador
// ---------------------------------------------------------------------
const routes = [
  [/^\/$/, viewHome],
  [/^\/buscar$/, viewSearch],
  [/^\/anunciar$/, viewSaleForm],
  [/^\/venda\/([\w-]+)$/, viewSale],
  [/^\/venda\/([\w-]+)\/editar$/, viewSaleForm],
  [/^\/venda\/([\w-]+)\/cartaz$/, viewPoster],
  [/^\/minhas$/, viewMine],
  [/^\/entrar$/, viewLogin],
  [/^\/perfil$/, viewProfile],
  [/^\/notificacoes$/, viewNotifications],
  [/^\/menu$/, viewMenu],
  [/^\/chat$/, viewChats],
  [/^\/chat\/([\w-]+)$/, viewConversation],
];

// Saindo da página, as buscas em andamento são interrompidas: isso não é erro do app.
let leaving = false;
addEventListener('pagehide', () => (leaving = true));
addEventListener('pageshow', () => (leaving = false));
const isNetworkError = (e) => /Failed to fetch|Load failed|NetworkError|network/i.test(`${e?.message} ${e?.details}`);

let renderId = 0;
async function render() {
  cleanup.forEach((fn) => fn());
  cleanup = [];
  const id = ++renderId;
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  // Conversa aberta acende "Chat"; minhas vendas, perfil e notificações ficam dentro do "Menu".
  const tab = path.startsWith('/chat') ? '/chat' : ['/menu', '/minhas', '/perfil', '/notificacoes'].includes(path) ? '/menu' : path;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === tab));
  const ctx = { params, path, alive: () => id === renderId };
  document.getElementById('notif-link').classList.toggle('active', path === '/notificacoes');
  if (path !== '/notificacoes') refreshUnread();
  for (const [re, view] of routes) {
    const m = path.match(re);
    if (!m) continue;
    window.scrollTo(0, 0);
    try {
      await view(ctx, ...m.slice(1));
    } catch (e) {
      if (leaving || !ctx.alive()) return;
      if (isNetworkError(e)) {
        $view.innerHTML = `
          <div class="empty">
            <h2>Sem conexão</h2>
            <p>Não conseguimos carregar agora. Confira sua internet e tente de novo.</p>
            <button class="btn primary" id="retry">Tentar de novo</button>
          </div>`;
        document.getElementById('retry').onclick = render;
        return;
      }
      console.error(e);
      reportError(e, `tela ${path.replace(/[0-9a-f-]{36}/g, ':id')}`);
      $view.innerHTML = `<div class="empty"><h2>Algo deu errado</h2><p>${esc(e.message)}</p><a class="btn" href="#/">Voltar ao início</a></div>`;
    }
    return;
  }
  $view.innerHTML = `<div class="empty"><h2>Página não encontrada</h2><a class="btn" href="#/">Voltar ao início</a></div>`;
}

// ---------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------
// Selo de tempo só quando ajuda a decidir agora: acontecendo ou começando hoje.
function statusBadge(s) {
  const st = saleStatus(s);
  return st.key === 'agora' || st.key === 'hoje' ? `<span class="badge status-${st.key}">${esc(st.label)}</span>` : '';
}

function saleCard(s) {
  const t = SALE_TYPES[s.type];
  const n = s.items?.[0]?.count ?? 0;
  const fav = state.favorites.has(s.id);
  const dist = myPosition() ? formatDistance(distanceKm(myPosition(), s)) : '';
  return `
    <a class="sale-card ${s.type === 'mudanca' ? 'highlight' : ''}" href="#/venda/${s.id}">
      <div class="thumb type-bg-${s.type}" ${s.cover_url ? `style="background-image:url('${esc(thumbUrl(s.cover_url))}')"` : ''}>
        ${s.cover_url ? '' : icon.tag}
        ${fav ? `<span class="fav-dot" title="Favorita">${icon.heart}</span>` : ''}
      </div>
      <div class="body">
        <div class="badges"><span class="badge type-${s.type}">${t.label}</span>${s.draft ? '<span class="badge draft">Rascunho</span>' : statusBadge(s)}</div>
        <h3>${esc(s.title)}</h3>
        <p class="meta">${icon.clock}${fmtWhen(s)}</p>
        <p class="meta">${icon.pin}${dist ? `<strong>${dist}</strong> · ` : ''}${esc(s.region)}${n ? ` · ${n} ${n === 1 ? 'item' : 'itens'}` : ''}</p>
      </div>
    </a>`;
}

// Esboço dos cartões enquanto carrega, no lugar de "Carregando…".
const skeletonCards = (n = 4) =>
  `<div class="cards" aria-busy="true" aria-label="Carregando">${'<div class="sale-card skeleton"><div class="thumb"></div><div class="body"><span></span><span></span><span></span></div></div>'.repeat(n)}</div>`;

// Distâncias do "Perto de mim" (km).
const NEAR_RADII = [2, 5, 10, 20];

// Localização do comprador ("Perto de mim"): fica só nesta aba, nunca é enviada ao servidor.
function myPosition() {
  try {
    return JSON.parse(sessionStorage.getItem('minha-posicao'));
  } catch {
    return null;
  }
}
function askPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Seu aparelho não informa a localização.'));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        sessionStorage.setItem('minha-posicao', JSON.stringify(pos));
        resolve(pos);
      },
      () => reject(new Error('Não foi possível obter sua localização. Confira se o navegador tem permissão.')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

const MAX_PHOTOS = 6;
const itemPhotos = (it) => (it.photos?.length ? it.photos : it.photo_url ? [it.photo_url] : []);
// Item de venda "só fotos" pode não ter título (a IA grava um escondido quando consegue).
const itemTitle = (it) => it.title || 'Item sem título';

// Fotos enviadas a partir de agora têm uma miniatura ao lado (abc.f.webp → abc.t.webp), usada em
// listas, cards e chat. Fotos antigas e de fora do app continuam usando a própria foto.
const THUMB_OF = /\.f\.(webp|jpg)$/;
const thumbUrl = (u) => (u && u.includes('/object/public/photos/') && THUMB_OF.test(u) ? u.replace(THUMB_OF, '.t.$1') : u);

function itemPhoto(it) {
  const photos = itemPhotos(it);
  return photos.length
    ? `<img src="${esc(thumbUrl(photos[0]))}" alt="" loading="lazy">${photos.length > 1 ? `<span class="photo-count">${icon.camera}${photos.length}</span>` : ''}`
    : `<div class="noimg">${icon.tag}</div>`;
}

// Apaga do Storage fotos do próprio usuário que deixaram de ser usadas (melhor esforço).
// Uma venda duplicada reaproveita as fotos da original: só apaga a foto que ninguém mais usa.
// Deve ser chamada depois de a venda/item já ter sido alterado no banco.
async function removeStoredPhotos(urls) {
  const marker = '/object/public/photos/';
  const own = [...new Set(urls)].filter((u) => u && u.includes(marker) && decodeURIComponent(u.split(marker)[1]).startsWith(`${state.user.id}/`));
  if (!own.length) return;
  const [items, sales] = await Promise.all([
    sb.from('items').select('photo_url,photos').eq('owner_id', state.user.id),
    sb.from('sales').select('cover_url').eq('owner_id', state.user.id),
  ]);
  if (items.error || sales.error) return; // na dúvida, não apaga
  const inUse = new Set([...items.data.flatMap((i) => [i.photo_url, ...(i.photos || [])]), ...sales.data.map((s) => s.cover_url)]);
  const paths = own.filter((u) => !inUse.has(u)).flatMap((u) => {
    const path = decodeURIComponent(u.split(marker)[1]);
    return THUMB_OF.test(path) ? [path, path.replace(THUMB_OF, '.t.$1')] : [path];
  });
  if (paths.length) await sb.storage.from('photos').remove(paths).catch(() => {});
}

const STATUS_LABEL = { disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido' };

// ---------------------------------------------------------------------
// Início: vendas do fim de semana (mapa + lista)
// ---------------------------------------------------------------------
const SALE_LIST_FIELDS = 'id,title,type,region,lat,lng,starts_on,ends_on,start_time,end_time,cover_url,draft,items(count)';

async function viewHome(ctx) {
  const p = ctx.params;
  const when = p.get('quando') || 'fds';
  let region = p.has('regiao') ? p.get('regiao') : localStorage.getItem('regiao') || '';
  const type = p.get('tipo') || '';
  const near = p.get('perto') === '1' && !!myPosition();
  const radius = NEAR_RADII.includes(Number(p.get('raio'))) ? Number(p.get('raio')) : 5;

  const link = (changes) => {
    const q = new URLSearchParams({ quando: when, regiao: region, tipo: type, ...(near ? { perto: '1', raio: radius } : {}), ...changes });
    if (q.get('perto') !== '1') {
      q.delete('perto');
      q.delete('raio');
    }
    return '#/?' + q.toString();
  };

  $view.innerHTML = `
    <section class="hero">
      <h1>Vendas de garagem, bazares e mudanças perto de você</h1>
      <p>Um dia, um lugar, vários itens a preço de desapego.</p>
    </section>
    <div class="filters">
      <div class="seg">
        <a href="${link({ quando: 'fds' })}" class="${when === 'fds' ? 'on' : ''}">Até domingo</a>
        <a href="${link({ quando: 'todas' })}" class="${when === 'todas' ? 'on' : ''}">Próximas</a>
      </div>
      <select id="f-region" aria-label="Região administrativa">
        <option value="">Todo o DF</option>
        ${REGIONS.map((r) => `<option ${r.name === region ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
      </select>
      <div class="chips">
        <button type="button" class="chip chip-near ${near ? 'on' : ''}" id="near" aria-pressed="${near}">${icon.pin}Perto de mim</button>
        <a href="${link({ tipo: '' })}" class="chip ${!type ? 'on' : ''}">Todas</a>
        ${Object.entries(SALE_TYPES)
          .map(([k, t]) => `<a href="${link({ tipo: k })}" class="chip chip-${k} ${type === k ? 'on' : ''}">${t.short}</a>`)
          .join('')}
      </div>
      ${near ? `
        <div class="near-radius" role="group" aria-label="Distância máxima">
          <span>Até</span>
          ${NEAR_RADII.map((km) => `<a href="${link({ raio: km })}" class="chip ${km === radius ? 'on' : ''}">${km} km</a>`).join('')}
        </div>` : ''}
    </div>
    <div class="home-grid">
      <div id="home-map" class="map"></div>
      <div id="home-list">${skeletonCards()}</div>
    </div>`;

  document.getElementById('f-region').addEventListener('change', (e) => {
    localStorage.setItem('regiao', e.target.value);
    location.hash = link({ regiao: e.target.value });
  });
  document.getElementById('near').addEventListener('click', async (e) => {
    if (near) return (location.hash = link({ perto: '0' }));
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await askPosition();
      // Perto de mim vale para o DF inteiro: a região escolhida deixa de filtrar.
      location.hash = link({ perto: '1', regiao: '' });
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });

  let q = sb
    .from('sales')
    .select(SALE_LIST_FIELDS)
    .eq('hidden', false)
    .eq('draft', false)
    .gte('ends_on', today())
    .order('starts_on')
    .order('start_time')
    .limit(200);
  if (when === 'fds') q = q.lte('starts_on', isoDate(thisSunday()));
  if (region) q = q.eq('region', region);
  if (type) q = q.eq('type', type);
  const { data: rows, error } = await q;
  if (!ctx.alive()) return;
  if (error) throw error;
  // Tira as que já fecharam hoje; "perto de mim" fica só com as que estão dentro da distância
  // escolhida, da mais perto para a mais longe.
  const open = rows.filter((s) => saleStatus(s).key !== 'encerrada');
  const me = near ? myPosition() : null;
  const sales = me ? open.filter((s) => distanceKm(me, s) <= radius).sort((a, b) => distanceKm(me, a) - distanceKm(me, b)) : open;

  const r = regionByName(region);
  let area = null; // círculo da distância escolhida
  const fitHome = (m, animate = true) => {
    if (area) return m.fitBounds(area.getBounds(), { padding: [10, 10], animate });
    const pts = sales.map((s) => [s.lat, s.lng]);
    if (pts.length > 1) m.fitBounds(pts, { padding: [30, 30], maxZoom: 15, animate });
    else if (pts.length === 1) m.setView(pts[0], 15, { animate });
    else m.setView(r ? [r.lat, r.lng] : DF_CENTER, r ? 14 : 11, { animate });
  };
  const map = makeMap('home-map', me ? [me.lat, me.lng] : r ? [r.lat, r.lng] : DF_CENTER, me ? 13 : r ? 14 : 11, { recenter: fitHome });
  if (me) {
    area = L.circle([me.lat, me.lng], { radius: radius * 1000, color: '#1c7ed6', weight: 1.5, fillOpacity: 0.06, interactive: false }).addTo(map);
    L.marker([me.lat, me.lng], {
      icon: L.divIcon({ className: 'me-dot', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      zIndexOffset: 1000,
      title: 'Você está aqui',
    })
      .addTo(map)
      .bindTooltip('Você está aqui');
  }
  for (const s of me ? open : sales) {
    L.marker([s.lat, s.lng], { icon: pinIcon(s.type), opacity: me && !sales.includes(s) ? 0.45 : 1 })
      .addTo(map)
      .bindPopup(`<a href="#/venda/${s.id}"><strong>${esc(s.title)}</strong></a><br>${fmtWhen(s)}${me ? `<br>a ${formatDistance(distanceKm(me, s))} de você` : ''}`);
  }
  fitHome(map, false);

  const list = document.getElementById('home-list');
  if (me && !sales.length) {
    const wider = NEAR_RADII.find((km) => km > radius && open.some((s) => distanceKm(me, s) <= km));
    const closest = open.reduce((best, s) => (!best || distanceKm(me, s) < distanceKm(me, best) ? s : best), null);
    list.innerHTML = `
      <div class="empty">
        <h2>Nenhuma venda a até ${radius} km de você ${when === 'fds' ? 'até domingo' : ''}</h2>
        ${closest ? `<p>A mais perto fica a ${formatDistance(distanceKm(me, closest))}, em ${esc(closest.region)}.</p>` : '<p>Ainda não há vendas marcadas com esses filtros.</p>'}
        ${wider ? `<a class="btn primary" href="${link({ raio: wider })}">Ver até ${wider} km</a>` : ''}
        ${when === 'fds' ? `<a class="btn" href="${link({ quando: 'todas' })}">Ver próximas datas</a>` : ''}
      </div>`;
    return;
  }
  if (!sales.length) {
    list.innerHTML = `
      <div class="empty">
        <h2>Nenhuma venda ${when === 'fds' ? 'até domingo' : 'marcada'}${region ? ` em ${esc(region)}` : ''}</h2>
        <p>Vai fazer um bazar ou vender as coisas da mudança? Anunciar é grátis.</p>
        <a class="btn primary" href="#/anunciar">Anunciar uma venda</a>
        ${when === 'fds' ? `<a class="btn" href="${link({ quando: 'todas' })}">Ver próximas datas</a>` : ''}
      </div>`;
    return;
  }

  const now = sales.filter((s) => saleStatus(s).key === 'agora');
  // No "perto de mim" a distância manda: sem a faixa de destaque das mudanças.
  const mudancas = !type && !me ? sales.filter((s) => s.type === 'mudanca' && !now.includes(s)) : [];
  const strip = (title, list, hint = '') =>
    `<h2 class="section-title">${title}</h2>${hint ? `<p class="hint">${hint}</p>` : ''}<div class="cards strip">${list.map(saleCard).join('')}</div>`;

  // "Até domingo": um carrossel por dia (cada venda no primeiro dia que ainda vai acontecer).
  // As que estão acontecendo agora já aparecem no carrossel de cima.
  let rest;
  if (when === 'fds' && !me) {
    const days = new Map();
    for (const s of sales.filter((x) => !now.includes(x))) {
      const day = s.starts_on > today() ? s.starts_on : today();
      if (!days.has(day)) days.set(day, []);
      days.get(day).push(s);
    }
    rest = [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => strip(fmtDayLong(day), list)).join('');
  } else {
    // Título da lista completa: só aparece quando há destaques acima dela ou no "perto de mim".
    const listTitle = me ? 'Mais perto de você' : now.length || mudancas.length ? 'Todas as vendas' : '';
    rest = `${listTitle ? `<h2 class="section-title">${listTitle}</h2>` : ''}<div class="cards">${sales.map(saleCard).join('')}</div>`;
  }
  const closest = me && sales[0];
  list.innerHTML = `
    ${me ? `<p class="near-summary">${sales.length} venda${sales.length === 1 ? '' : 's'} a até ${radius} km de você · a mais perto fica a <strong>${formatDistance(distanceKm(me, closest))}</strong>, em ${esc(closest.region)}.</p>` : ''}
    ${now.length ? `
      <h2 class="section-title"><span class="live-dot"></span>Acontecendo agora${me ? ' perto de você' : ''}</h2>
      <div class="cards strip">${now.map(saleCard).join('')}</div>` : ''}
    ${mudancas.length ? strip('Em destaque: vendas de mudança', mudancas, 'Quem se muda vende quase tudo, e rápido.') : ''}
    ${rest}`;
}

// ---------------------------------------------------------------------
// Busca por texto e categoria
// ---------------------------------------------------------------------
async function viewSearch(ctx) {
  const qText = (ctx.params.get('q') || '').trim();
  const cat = ctx.params.get('cat') || '';

  $view.innerHTML = `
    <form id="search-form" class="search-form">
      <input type="search" name="q" value="${esc(qText)}" placeholder="Ex.: sofá, bicicleta, berço" autocomplete="off" enterkeyhint="search">
      <select name="cat" aria-label="Categoria">
        <option value="">Todas as categorias</option>
        ${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <button class="btn primary">Buscar</button>
    </form>
    <div id="results"></div>`;

  const form = document.getElementById('search-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    navigate(`/buscar?${new URLSearchParams({ q: fd.get('q').trim(), cat: fd.get('cat') })}`);
  });
  if (!qText) form.q.focus();
  if (!qText && !cat) {
    document.getElementById('results').innerHTML = `<p class="hint center">Procure itens em todas as vendas que ainda vão acontecer.</p>`;
    return;
  }

  const safe = qText.replace(/[%,()*\\]/g, ' ').trim();
  const out = document.getElementById('results');
  out.innerHTML = skeletonCards(3);

  let iq = sb
    .from('items')
    .select('id,title,price,category,photo_url,photos,status,sales!inner(id,title,region,starts_on,ends_on,start_time,end_time,hidden,draft,photos_only)')
    .gte('sales.ends_on', today())
    .eq('sales.hidden', false)
    .eq('sales.draft', false)
    .neq('status', 'vendido')
    .order('created_at', { ascending: false })
    .limit(60);
  if (safe) iq = iq.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  if (cat) iq = iq.eq('category', cat);

  const sq = safe
    ? sb
        .from('sales')
        .select(SALE_LIST_FIELDS)
        .eq('hidden', false)
        .eq('draft', false)
        .gte('ends_on', today())
        .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
        .order('starts_on')
        .limit(30)
    : Promise.resolve({ data: [] });

  const [items, sales] = await Promise.all([iq, sq]);
  if (!ctx.alive()) return;
  if (items.error) throw items.error;
  if (sales.error) throw sales.error;

  if (!items.data.length && !sales.data.length) {
    out.innerHTML = `<div class="empty"><h2>Nada encontrado</h2><p>Tente outra palavra ou outra categoria.</p></div>`;
    return;
  }
  out.innerHTML = `
    ${items.data.length ? `
      <h2 class="section-title">Itens (${items.data.length})</h2>
      <div class="items-grid">
        ${items.data.map((it) => `
          <a class="item status-${it.status}" href="#/venda/${it.sales.id}">
            <div class="photo">${itemPhoto(it)}${it.status !== 'disponivel' ? `<span class="status-tag">${STATUS_LABEL[it.status]}</span>` : ''}</div>
            <div class="info">
              <strong>${it.sales.photos_only ? 'Pergunte o preço' : brl(it.price)}</strong>
              <span class="title">${esc(it.sales.photos_only ? it.sales.title : itemTitle(it))}</span>
              <small>${esc(it.sales.region)} · ${fmtDay(it.sales.starts_on)}</small>
            </div>
          </a>`).join('')}
      </div>` : ''}
    ${sales.data.length ? `<h2 class="section-title">Vendas</h2><div class="cards">${sales.data.map(saleCard).join('')}</div>` : ''}`;
}

// ---------------------------------------------------------------------
// Página pública da venda
// ---------------------------------------------------------------------
async function viewSale(ctx, id) {
  $view.innerHTML = `
    <div class="sale skeleton-page" aria-busy="true" aria-label="Carregando venda">
      <div class="sk sk-cover"></div><div class="sk sk-line w40"></div><div class="sk sk-title"></div>
      <div class="sk sk-line w70"></div><div class="sk sk-line w60"></div>
      <div class="sk-row"><div class="sk sk-btn"></div><div class="sk sk-btn"></div><div class="sk sk-btn"></div></div>
    </div>`;
  const { data: sale, error } = await sb
    .from('sales')
    .select('*, owner:profiles!sales_owner_id_fkey(id,name,chat_enabled), items(*)')
    .eq('id', id)
    .maybeSingle();
  if (!ctx.alive()) return;
  if (error) throw error;
  if (!sale) {
    $view.innerHTML = `<div class="empty"><h2>Venda não encontrada</h2><p>Ela pode ter sido removida pelo vendedor.</p><a class="btn" href="#/">Ver outras vendas</a></div>`;
    return;
  }

  const isOwner = state.user?.id === sale.owner_id;
  const photosOnly = !!sale.photos_only; // venda "só fotos": itens sem título, preço nem descrição
  const status = saleStatus(sale);
  const ended = status.key === 'encerrada';
  const me = myPosition();
  const rank = { disponivel: 0, reservado: 1, vendido: 2 };
  const sortItems = () => sale.items.sort((a, b) => rank[a.status] - rank[b.status] || b.created_at.localeCompare(a.created_at));
  sortItems();
  const t = SALE_TYPES[sale.type];
  const links = mapsLinks(sale);
  document.title = `${sale.title} — ${CONFIG.APP_NAME}`;

  $view.innerHTML = `
    <article class="sale">
      ${sale.cover_url ? `<div class="cover" style="background-image:url('${esc(sale.cover_url)}')"></div>` : ''}
      <div class="sale-head">
        <div class="badges">
          <span class="badge type-${sale.type}">${t.label}</span>
          ${ended ? '<span class="badge muted">Encerrada</span>' : statusBadge(sale)}
          ${sale.hidden ? '<span class="badge danger">Oculta pela moderação</span>' : ''}
          ${sale.draft ? '<span class="badge draft">Rascunho</span>' : ''}
        </div>
        <h1>${esc(sale.title)}</h1>
        <p class="meta big">${icon.clock}${fmtWhen(sale)}</p>
        <p class="meta big">${icon.pin}${esc(sale.region)}${sale.address ? ` · ${esc(sale.address)}` : ''}${me ? ` · <strong>a ${formatDistance(distanceKm(me, sale))} de você</strong>` : ''}</p>
        ${sale.reference ? `<p class="reference">Referência: ${esc(sale.reference)}</p>` : ''}
        <p class="meta">Por ${esc(sale.owner?.name || 'vendedor')}</p>
      </div>

      <div class="actions">
        ${isOwner ? '' : `<button class="btn whatsapp" data-act="contact" id="wa-btn" hidden>${icon.whatsapp}Falar no WhatsApp</button>`}
        <a class="btn" href="${links.google}" target="_blank" rel="noopener">Rota no Google Maps</a>
        <a class="btn" href="${links.waze}" target="_blank" rel="noopener">Rota no Waze</a>
        <button class="btn" data-act="share">${icon.share}Compartilhar</button>
        ${ended ? '' : `<button class="btn" data-act="calendar">${icon.calendar}Adicionar à agenda</button>`}
        ${isOwner ? '' : `<button class="btn fav ${state.favorites.has(sale.id) ? 'on' : ''}" data-act="fav">${icon.heart}<span>${state.favorites.has(sale.id) ? 'Salva' : 'Salvar'}</span></button>`}
      </div>
      ${!isOwner && sale.owner?.chat_enabled === false && !ended ? `<p class="notice only-promo">${icon.pin}<span>Este vendedor só está divulgando a venda e não recebe mensagens pelo app. Os itens estão à venda no local, no dia e horário acima.</span></p>` : ''}

      ${isOwner && sale.draft ? `
        <div class="draft-bar">
          <strong>Rascunho: só você vê esta venda.</strong>
          <p>${photosOnly ? 'Adicione as fotos dos itens e publique.' : 'Cadastre os itens, confira os preços (principalmente os sugeridos pela IA) e publique.'} O link e o cartaz só funcionam depois de publicar.</p>
          <button class="btn primary" data-act="publish">${photosOnly ? 'Publicar venda' : 'Revisar preços e publicar'}</button>
        </div>` : ''}

      ${state.moderator && !isOwner ? `
        <div class="mod-bar">
          <strong>Moderação</strong>
          <div id="mod-reports" class="hint">Carregando denúncias…</div>
          ${sale.hidden
            ? '<button class="btn small primary" data-act="mod-show">Reexibir venda</button><button class="btn small" data-act="mod-hide">Manter oculta</button>'
            : '<button class="btn small danger" data-act="mod-hide">Ocultar venda</button>'}
        </div>` : ''}

      ${isOwner ? `
        <div class="owner-bar">
          <strong>${ended ? 'Esta venda já acabou. Vai fazer outra? Duplique e aproveite os itens que sobraram.' : 'Esta venda é sua.'}</strong>
          ${ended ? `<p class="hint">${photoRetention(sale)}</p>` : ''}
          ${state.profile?.chat_enabled === false ? '<p class="hint">Seu chat está desligado: compradores não mandam mensagens. Dá para religar em <a href="#/perfil">Perfil</a>.</p>' : ''}
          ${ended ? '<button class="btn small primary" data-act="duplicate">Duplicar para nova data</button>' : ''}
          <a class="btn small" href="#/venda/${sale.id}/cartaz">Cartaz com QR Code</a>
          <a class="btn small" href="#/venda/${sale.id}/editar">Editar venda</a>
          ${ended ? '' : '<button class="btn small" data-act="duplicate">Duplicar</button>'}
          <button class="btn small danger" data-act="delete-sale">Excluir</button>
        </div>` : ''}

      ${sale.description ? `<p class="description">${esc(sale.description).replace(/\n/g, '<br>')}</p>` : ''}
      <div id="sale-map" class="map small"></div>

      ${isOwner && photosOnly ? `
        <section class="quick-add">
          <h2>Adicionar fotos</h2>
          ${ctx.params.has('novo') ? '<p class="hint">Venda criada como rascunho! Agora tire as fotos dos itens. Quando terminar, toque em "Publicar".</p>' : ''}
          ${ctx.params.has('duplicada') ? '<p class="hint">Venda duplicada como rascunho! Remova as fotos do que não vai levar, adicione as novidades e publique.</p>' : ''}
          <label class="btn primary photo-only-add">${icon.camera}<span>Adicionar fotos</span><input type="file" id="photo-only-input" accept="image/*" multiple hidden></label>
          <p class="hint">Cada foto vira um item, sem precisar escrever nada. Toque numa foto para marcar como reservada ou vendida, ou para remover.</p>
          <div id="photo-uploads" class="photo-grid"></div>
          <p class="hint">${PHOTO_RETENTION_TEXT}</p>
        </section>` : ''}

      ${isOwner && !photosOnly ? `
        <section class="quick-add">
          <h2>Cadastrar itens</h2>
          ${ctx.params.has('novo') ? '<p class="hint">Venda criada como rascunho! Agora fotografe e cadastre os itens. Quando terminar, revise os preços e toque em "Publicar".</p>' : ''}
          ${ctx.params.has('duplicada') ? '<p class="hint">Venda duplicada como rascunho! Confira os itens, remova o que não vai levar, cadastre as novidades e publique.</p>' : ''}
          <form id="item-form">
            <label class="photo-pick">
              <input type="file" name="photo" accept="image/*" multiple hidden>
              <span class="ph">${icon.camera}Fotos</span>
              <img alt="" hidden>
              <span class="photo-count" hidden></span>
            </label>
            <div class="fields">
              <input name="title" placeholder="O que é? Ex.: Sofá 3 lugares" required maxlength="120">
              <div class="row">
                <input name="price" inputmode="decimal" placeholder="Preço (R$)">
                <select name="category">
                  ${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
                </select>
              </div>
              <textarea name="description" rows="2" maxlength="1000" placeholder="Descrição (opcional): estado, marca, medidas…"></textarea>
              <p class="hint ai-hint" hidden></p>
              <button class="btn primary">Salvar e adicionar outro</button>
            </div>
          </form>
          <button type="button" class="btn batch-open" data-act="batch">${icon.camera}Vários itens de uma vez (fotos em lote)</button>
          <p class="hint">${PHOTO_RETENTION_TEXT}</p>
        </section>` : ''}

      <section>
        <h2 class="section-title" id="items-title"></h2>
        ${photosOnly && !isOwner ? `<p class="hint">Preços: ${sale.owner?.chat_enabled === false ? 'veja no local' : 'pergunte no chat ou veja no local'}.</p>` : ''}
        <div id="items" class="${photosOnly ? 'photo-grid' : 'items-grid'}"></div>
      </section>

      ${isOwner ? '' : `
        <div class="report-links">
          <button class="link" data-act="report-sale">${icon.flag}Denunciar anúncio</button>
          <button class="link" data-act="report-user">${icon.flag}Denunciar vendedor</button>
        </div>`}
    </article>`;

  const map = makeMap('sale-map', [sale.lat, sale.lng], 16);
  L.marker([sale.lat, sale.lng], { icon: pinIcon(sale.type) }).addTo(map);

  let hasPix = false;
  const chatOn = sale.owner?.chat_enabled !== false; // vendedor que só divulga desliga o chat no perfil
  const buyerItemActions = (it) =>
    it.status === 'disponivel' && !ended
      ? `${chatOn ? `<button class="btn small primary" data-act="interest">${icon.chat}Tenho interesse</button>` : ''}
         ${hasPix && Number(it.price) > 0 ? `<button class="btn small pix" data-act="pix">${icon.pix}Pagar com Pix</button>` : ''}`
      : '';

  const renderItems = () => {
    const avail = sale.items.filter((i) => i.status === 'disponivel').length;
    const n = sale.items.length;
    document.getElementById('items-title').textContent = n
      ? photosOnly
        ? `Itens (${n} foto${n === 1 ? '' : 's'}${avail < n ? `, ${avail} disponíve${avail === 1 ? 'l' : 'is'}` : ''})`
        : `Itens (${avail} disponíve${avail === 1 ? 'l' : 'is'} de ${n})`
      : isOwner ? 'Nenhum item cadastrado ainda' : 'O vendedor ainda não cadastrou itens';
    if (photosOnly) {
      // Só fotos: grade de fotos; tocar abre a foto grande com as ações.
      document.getElementById('items').innerHTML = sale.items
        .map((it) => `
          <div class="item photo-tile status-${it.status}" data-id="${it.id}">
            <button class="photo" data-act="view-item" aria-label="Ver foto ${sale.items.indexOf(it) + 1}">${itemPhoto(it)}${it.status !== 'disponivel' ? `<span class="status-tag">${STATUS_LABEL[it.status]}</span>` : ''}</button>
          </div>`)
        .join('');
      return;
    }
    document.getElementById('items').innerHTML = sale.items
      .map(
        (it) => `
        <div class="item status-${it.status}" data-id="${it.id}">
          <button class="photo" data-act="view-item" aria-label="Ver fotos de ${esc(itemTitle(it))}">${itemPhoto(it)}${it.status !== 'disponivel' ? `<span class="status-tag">${STATUS_LABEL[it.status]}</span>` : ''}</button>
          <div class="info">
            <strong>${brl(it.price)}${isOwner && it.ai_price ? ' <span class="ai-price" title="Preço sugerido pela IA, ainda não revisado">IA</span>' : ''}</strong>
            <span class="title">${esc(itemTitle(it))}</span>
            <small>${CATEGORIES[it.category] || ''}</small>
            ${isOwner
              ? `<div class="status-toggle">
                  ${Object.entries(STATUS_LABEL).map(([k, v]) => `<button data-act="status" data-status="${k}" class="${it.status === k ? 'on' : ''}">${v}</button>`).join('')}
                </div>
                <div class="item-links">
                  <button class="link" data-act="edit-item">Editar</button>
                  <button class="link danger" data-act="delete-item">Remover</button>
                </div>`
              : buyerItemActions(it)}
          </div>
        </div>`,
      )
      .join('');
  };
  renderItems();
  if (!isOwner && !ended) {
    sb.rpc('sale_has_pix', { p_sale: sale.id }).then(({ data }) => {
      if (data && ctx.alive()) {
        hasPix = true;
        renderItems();
      }
    });
  }
  // O botão do WhatsApp só aparece se o vendedor liberou o número no perfil.
  if (!isOwner) {
    sb.rpc('sale_has_whatsapp', { p_sale: sale.id }).then(({ data }) => {
      if (data && ctx.alive()) document.getElementById('wa-btn').hidden = false;
    });
  }
  const chat = (item, text) => openChat(sale, item, text); // cada conversa é sobre um item

  const openWhatsApp = async (text) => {
    if (!requireLogin(`/venda/${sale.id}`, 'Entre para falar com o vendedor.')) return;
    const { data: phone, error } = await sb.rpc('get_sale_whatsapp', { p_sale: sale.id });
    if (error) return toast(contactError(error), 'error', error);
    if (!phone) return toast('O vendedor não informou um WhatsApp.', 'error');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const setStatus = async (item, status) => {
    const prev = item.status;
    item.status = status;
    sortItems();
    renderItems();
    const { error } = await sb.from('items').update({ status }).eq('id', item.id);
    if (error) {
      item.status = prev;
      sortItems();
      renderItems();
      toast('Não foi possível atualizar o item.', 'error', error);
    }
  };

  const handleItemAction = async (act, item) => {
    if (act === 'interest') {
      chat(item, 'Olá! Tenho interesse. Ainda está disponível?');
    } else if (act === 'pix') {
      if (!requireLogin(`/venda/${sale.id}`, 'Entre para pagar com Pix.')) return;
      openPix(sale, item, (text) => chat(item, text));
    } else if (act === 'edit-item') {
      openItemEditor(sale, item, () => {
        sortItems();
        renderItems();
      });
    } else if (act.startsWith('status:')) {
      setStatus(item, act.slice(7));
    } else if (act === 'delete-item') {
      if (!confirm(photosOnly ? 'Remover esta foto?' : `Remover "${itemTitle(item)}"?`)) return;
      const { error } = await sb.from('items').delete().eq('id', item.id);
      if (error) return toast(error.message, 'error', error);
      removeStoredPhotos(itemPhotos(item).filter((u) => u !== sale.cover_url));
      sale.items = sale.items.filter((i) => i !== item);
      renderItems();
    }
  };

  $view.onclick = async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const itemEl = btn.closest('.item');
    const item = itemEl && sale.items.find((i) => i.id === itemEl.dataset.id);

    if (act === 'contact') {
      openWhatsApp(`Olá! Vi sua venda "${sale.title}" no ${CONFIG.APP_NAME}: ${saleUrl(sale.id)}`);
    } else if (act === 'interest') {
      handleItemAction(act, item);
    } else if (act === 'share') {
      shareSale(sale);
    } else if (act === 'fav') {
      if (!requireLogin(`/venda/${sale.id}`, 'Entre para salvar vendas.')) return;
      const on = await toggleFavorite(sale.id);
      btn.classList.toggle('on', on);
      btn.querySelector('span').textContent = on ? 'Salva' : 'Salvar';
      if (on && !offerAlerts() && !offerReminders()) maybeSuggestInstall('favorite');
    } else if (act === 'status') {
      setStatus(item, btn.dataset.status);
    } else if (act === 'view-item') {
      openItemViewer(sale, item, { isOwner, ended, hasPix, chatOn, photosOnly, onAction: (a) => handleItemAction(a, item) });
    } else if (['edit-item', 'pix', 'delete-item'].includes(act)) {
      handleItemAction(act, item);
    } else if (act === 'publish') {
      openPublish(sale, () => render());
    } else if (act === 'delete-sale') {
      if (!confirm('Excluir esta venda e todos os itens? Isso não pode ser desfeito.')) return;
      const { error } = await sb.from('sales').delete().eq('id', sale.id);
      if (error) return toast(error.message, 'error', error);
      removeStoredPhotos([sale.cover_url, ...sale.items.flatMap(itemPhotos)]);
      toast('Venda excluída.');
      navigate('/minhas');
    } else if (act === 'batch') {
      openBatch(sale, () => {
        sortItems();
        renderItems();
      });
    } else if (act === 'duplicate') {
      openDuplicate(sale);
    } else if (act === 'calendar') {
      openCalendar(sale);
    } else if (act === 'report-sale' || act === 'report-user') {
      if (!requireLogin(`/venda/${sale.id}`, 'Entre para enviar uma denúncia.')) return;
      openReport(act === 'report-sale' ? { sale_id: sale.id } : { sale_id: sale.id, reported_user_id: sale.owner_id }, act === 'report-sale' ? 'anúncio' : 'vendedor');
    } else if (act === 'mod-show' || act === 'mod-hide') {
      const show = act === 'mod-show';
      if (!show && !sale.hidden && !confirm('Ocultar esta venda? O vendedor será avisado.')) return;
      btn.disabled = true;
      const { error } = await sb.rpc('moderate_sale', { p_sale: sale.id, p_show: show });
      if (error) {
        btn.disabled = false;
        return toast(error.message, 'error', error);
      }
      toast(show ? 'Venda de volta ao ar. O vendedor foi avisado.' : 'Venda oculta. As denúncias foram aceitas.');
      render();
    }
  };
  cleanup.push(() => ($view.onclick = null));

  if (state.moderator && !isOwner) loadModReports(sale.id);

  if (isOwner && photosOnly) setupPhotoOnly(sale, renderItems, sortItems);
  else if (isOwner) setupItemForm(sale, renderItems, sortItems);
  else maybeSuggestInstall('view-sale');
}

// Venda "só fotos": cada foto escolhida vira um item, sem nada para preencher.
function setupPhotoOnly(sale, renderItems, sortItems) {
  const input = document.getElementById('photo-only-input');
  const box = document.getElementById('photo-uploads');
  input.addEventListener('change', async () => {
    const files = [...input.files].slice(0, MAX_BATCH);
    if (input.files.length > MAX_BATCH) toast(`Até ${MAX_BATCH} fotos por vez. Envie estas e depois as outras.`);
    input.value = '';
    if (!files.length) return;
    const tiles = files.map(() => {
      const tile = document.createElement('div');
      tile.className = 'photo-tile uploading';
      tile.innerHTML = '<span>Enviando…</span>';
      box.append(tile);
      return tile;
    });
    let failed = 0;
    await mapLimit(files, 3, async (file, i) => {
      try {
        const url = await uploadPhoto(file);
        const { data, error } = await sb.from('items').insert({ sale_id: sale.id, title: null, category: 'outros', photo_url: url, photos: [url] }).select().single();
        if (error) throw error;
        sale.items.unshift(data);
        if (!sale.cover_url) {
          sale.cover_url = url;
          await sb.from('sales').update({ cover_url: url }).eq('id', sale.id);
        }
        tiles[i].remove();
        sortItems();
        renderItems();
        describeHidden(data, file);
      } catch (err) {
        failed++;
        tiles[i].classList.replace('uploading', 'failed');
        tiles[i].innerHTML = '<span>Não enviou</span>';
        console.warn(err);
      }
    });
    if (failed) toast(`${failed} foto${failed === 1 ? '' : 's'} não ${failed === 1 ? 'foi enviada' : 'foram enviadas'}. Tente de novo.`, 'error');
  });
}

// Título e categoria escondidos (só para a busca e o chat). Sem IA, o item fica só com a foto.
async function describeHidden(item, file) {
  const ai = await describePhoto(file).catch(() => null);
  const title = ai?.title?.trim().slice(0, 120);
  if (!title || title.length < 2) return;
  const changes = { title, category: CATEGORIES[ai.category] ? ai.category : item.category };
  const { error } = await sb.from('items').update(changes).eq('id', item.id);
  if (!error) Object.assign(item, changes);
}

function setupItemForm(sale, renderItems, sortItems) {
  const form = document.getElementById('item-form');
  const fileInput = form.photo;
  const preview = form.querySelector('.photo-pick img');
  const ph = form.querySelector('.photo-pick .ph');
  const count = form.querySelector('.photo-pick .photo-count');
  const aiHint = form.querySelector('.ai-hint');
  let lastCategory = localStorage.getItem('ultima-categoria') || 'outros';
  form.category.value = lastCategory;
  form.category.addEventListener('change', () => (form.category.dataset.touched = '1'));
  let files = [];

  fileInput.addEventListener('change', async () => {
    files = [...fileInput.files].slice(0, MAX_PHOTOS);
    if (fileInput.files.length > MAX_PHOTOS) toast(`Até ${MAX_PHOTOS} fotos por item. Usei as primeiras ${MAX_PHOTOS}.`);
    count.hidden = files.length < 2;
    count.textContent = `+${files.length - 1}`;
    if (files[0]) previewPhoto(files[0], preview, ph);
    files.slice(1).forEach((f) => isHeic(f) && convertHeic(f)); // adianta a conversão
    if (files[0]) fillWithAI(form, files[0], aiHint, () => files[0]);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = files.length > 1 ? `Enviando ${files.length} fotos…` : 'Salvando…';
    try {
      const photos = await Promise.all(files.map(uploadPhoto));
      const photo_url = photos[0] || null;
      const row = {
        sale_id: sale.id,
        title: form.title.value.trim(),
        price: parsePrice(form.price.value),
        ai_price: aiPriceKept(form),
        category: form.category.value,
        description: form.description.value.trim() || null,
        photo_url,
        photos,
      };
      const { data, error } = await sb.from('items').insert(row).select().single();
      if (error) throw error;
      sale.items.unshift(data);
      sortItems();
      renderItems();
      if (photo_url && !sale.cover_url) {
        sale.cover_url = photo_url;
        await sb.from('sales').update({ cover_url: photo_url }).eq('id', sale.id);
      }
      localStorage.setItem('ultima-categoria', row.category);
      form.reset();
      delete form.price.dataset.ai;
      files = [];
      form.category.value = row.category;
      preview.hidden = true;
      count.hidden = true;
      ph.hidden = false;
      aiHint.hidden = true;
      delete form.category.dataset.touched;
      form.title.focus();
      toast('Item salvo!');
    } catch (err) {
      toast(err.message || 'Erro ao salvar o item.', 'error', err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar e adicionar outro';
    }
  });
}

// ---------------------------------------------------------------------
// Descrição automática da foto (IA do Google, pela função supabase/functions/descrever-item)
// ---------------------------------------------------------------------
let aiAvailable = null; // null: ainda não sabemos; false: não configurada (some da tela nesta visita)

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

// Devolve { title, description, category, price } ou null se a IA não estiver disponível.
async function describePhoto(file) {
  if (aiAvailable === false) return null;
  let blob = await resizeImage(file, 768, 0.75, 'image/jpeg').catch(() => null);
  if (!blob && isHeic(file)) {
    const jpeg = await convertHeic(file);
    blob = jpeg && (await resizeImage(jpeg, 768, 0.75, 'image/jpeg').catch(() => null));
  }
  if (!blob) return null;
  const { data, error } = await sb.functions.invoke('descrever-item', {
    body: { image: await blobToBase64(blob), categories: CATEGORIES },
  });
  if (error) {
    const status = error.context?.status;
    if (!status || status === 404 || status === 503) {
      aiAvailable = false; // função não publicada ou sem a chave: segue sem IA
      return null;
    }
    let msg = '';
    try {
      msg = (await error.context.json()).error;
    } catch {}
    throw new Error(msg || 'A IA não conseguiu analisar a foto.');
  }
  aiAvailable = true;
  return data;
}

// Preenche só o que a pessoa ainda não digitou (a categoria, se ela não escolheu).
function applyAI(f, ai) {
  if (ai.title && !f.title.value.trim()) f.title.value = ai.title;
  if (ai.description && !f.description.value.trim()) f.description.value = ai.description;
  if (ai.category && CATEGORIES[ai.category] && f.category.dataset.touched !== '1') f.category.value = ai.category;
  if (ai.price != null && !f.price.value.trim()) {
    f.price.value = String(ai.price);
    f.price.dataset.ai = f.price.value; // marcado para revisão antes de publicar
  }
}

// O preço continua o que a IA sugeriu? (se a pessoa mexeu, já é um preço revisado)
const aiPriceKept = (f) => !!f.price.dataset.ai && f.price.value.trim() === f.price.dataset.ai;

async function fillWithAI(f, file, hint, current) {
  if (aiAvailable === false) return;
  hint.hidden = false;
  hint.classList.add('working');
  hint.textContent = '✨ Descrevendo a foto com IA…';
  try {
    const ai = await describePhoto(file);
    if (current() !== file) return; // a pessoa já trocou de foto
    hint.classList.remove('working');
    if (!ai) return void (hint.hidden = true);
    applyAI(f, ai);
    hint.textContent = '✨ Preenchido pela IA. Confira título, preço e categoria antes de salvar.';
  } catch (err) {
    if (current() !== file) return;
    hint.classList.remove('working');
    hint.textContent = err.message;
  }
}

// Executa fn em no máximo "limit" itens ao mesmo tempo (não trava o celular nem a rede).
async function mapLimit(list, limit, fn) {
  const out = [];
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
}

// ---------------------------------------------------------------------
// Cadastro em lote: cada foto vira um item; a IA preenche, a pessoa confere e salva tudo.
// ---------------------------------------------------------------------
const MAX_BATCH = 30;

// Fotos guardadas até 30 dias depois do fim da venda (limpeza diária: workflow limpeza-fotos.yml).
const PHOTO_DAYS = 30;
const PHOTO_RETENTION_TEXT = `As fotos ficam guardadas até ${PHOTO_DAYS} dias depois do fim da venda e depois são apagadas automaticamente. A venda e os itens continuam no seu histórico; ao duplicar a venda, as fotos dos itens copiados ficam.`;
function photoRetention(sale) {
  const day = (iso) => Date.UTC(...iso.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0))) / 864e5;
  // A limpeza das 6h apaga quando a venda passou de PHOTO_DAYS dias encerrada.
  const left = day(sale.ends_on) + PHOTO_DAYS + 1 - day(today());
  if (left <= 0) return `As fotos desta venda foram apagadas ${PHOTO_DAYS} dias depois do fim, como acontece com todas as vendas encerradas.`;
  return `As fotos desta venda serão apagadas ${left === 1 ? 'amanhã cedo' : `em ${left} dias`} (${PHOTO_DAYS} dias depois do fim). Duplique a venda para continuar usando as fotos dos itens que sobraram.`;
}

// Antes de publicar, o vendedor confere todos os preços; os sugeridos pela IA aparecem destacados.
function openPublish(sale, done) {
  // Venda "só fotos" não tem preços para revisar.
  const items = sale.photos_only ? [] : sale.items.filter((i) => i.status !== 'vendido');
  const aiCount = items.filter((i) => i.ai_price).length;
  const n = sale.items.length;
  const { el, close } = openModal(`
    <h2>${sale.photos_only ? 'Publicar venda' : 'Revisar preços e publicar'}</h2>
    ${sale.photos_only
      ? `<p class="hint">${n ? `Venda só com fotos: <strong>${n} foto${n === 1 ? '' : 's'}</strong>. Confira se está tudo certo e publique.` : 'Você ainda não adicionou fotos. Dá para publicar assim e adicionar depois, mas vendas com fotos atraem bem mais gente.'}</p>`
      : items.length
      ? `<p class="hint">${aiCount ? `<strong>${aiCount} preço${aiCount === 1 ? '' : 's'} sugerido${aiCount === 1 ? '' : 's'} pela IA</strong> (marcados com IA). ` : ''}Confira cada valor: a IA erra, principalmente em itens usados ou de marca.</p>`
      : '<p class="hint">Você ainda não cadastrou itens. Dá para publicar assim e cadastrar depois, mas vendas com fotos e preços atraem bem mais gente.</p>'}
    <form id="publish-form">
      <div class="review-list">
        ${items.map((it) => `
          <label class="review-row ${it.ai_price ? 'ai' : ''}">
            <span class="review-thumb">${thumb(itemPhotos(it)[0])}</span>
            <span class="review-title">${esc(it.title)}${it.ai_price ? ' <span class="ai-price">IA</span>' : ''}</span>
            <input name="p-${it.id}" inputmode="decimal" value="${it.price == null ? '' : esc(String(Number(it.price)).replace('.', ','))}" placeholder="R$" aria-label="Preço de ${esc(it.title)}">
          </label>`).join('')}
      </div>
      ${items.length ? '<label class="check"><input type="checkbox" name="ok" required> Revisei todos os preços</label>' : ''}
      <div class="actions">
        <button type="button" class="btn" data-close>Voltar</button>
        <button class="btn primary">Publicar venda</button>
      </div>
    </form>`, 'publish-modal', { keep: true });

  const form = el.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button.primary');
    btn.disabled = true;
    btn.textContent = 'Publicando…';
    try {
      const changed = items
        .map((it) => ({ it, price: parsePrice(form[`p-${it.id}`].value) }))
        .filter(({ it, price }) => price !== (it.price == null ? null : Number(it.price)));
      await mapLimit(changed, 3, async ({ it, price }) => {
        const { error } = await sb.from('items').update({ price, ai_price: false }).eq('id', it.id);
        if (error) throw new Error(`Erro ao salvar o preço de "${it.title}": ${error.message}`);
        it.price = price;
      });
      const { error } = await sb.rpc('publish_sale', { p_sale: sale.id });
      if (error) throw wrapError('Não foi possível publicar', error);
      sale.draft = false;
      sale.items.forEach((i) => (i.ai_price = false));
      close();
      toast('Venda publicada! Agora é só compartilhar o link.');
      done();
    } catch (err) {
      toast(err.message, 'error', unexpected(err));
      btn.disabled = false;
      btn.textContent = 'Publicar venda';
    }
  });
}

function openBatch(sale, done) {
  const rows = []; // { file, el, url, removed }
  const lastCategory = localStorage.getItem('ultima-categoria') || 'outros';
  const { el, close } = openModal(`
    <h2>Cadastrar em lote</h2>
    <p class="hint">Escolha várias fotos de uma vez: <strong>cada foto vira um item</strong>. ${aiAvailable === false ? '' : 'A IA sugere título, descrição, categoria e preço, e você só confere.'} Depois dá para juntar mais fotos num item, em "Editar".</p>
    <label class="btn batch-pick">${icon.camera}<span>Escolher fotos</span><input type="file" accept="image/*" multiple hidden></label>
    <div class="batch-list"></div>
    <div class="actions batch-actions">
      <button class="btn primary" data-save disabled>Salvar itens</button>
      <button class="btn" data-close>Cancelar</button>
    </div>`, 'batch', { keep: true });
  const list = el.querySelector('.batch-list');
  const save = el.querySelector('[data-save]');
  const live = () => rows.filter((r) => !r.removed);
  const updateSave = () => {
    const n = live().length;
    save.disabled = !n;
    save.textContent = n ? `Salvar ${n} ${n === 1 ? 'item' : 'itens'}` : 'Salvar itens';
    el.querySelector('.batch-pick span').textContent = n ? 'Adicionar mais fotos' : 'Escolher fotos';
  };

  el.querySelector('.batch-pick input').addEventListener('change', (e) => {
    const room = MAX_BATCH - live().length;
    const picked = [...e.target.files].slice(0, room);
    if (e.target.files.length > room) toast(`Até ${MAX_BATCH} fotos por lote. Salve estas e faça outro lote.`);
    e.target.value = '';
    const added = picked.map((file) => {
      const row = { file };
      row.el = document.createElement('div');
      row.el.className = 'batch-row';
      row.el.innerHTML = `
        <img class="batch-thumb" alt="">
        <div class="batch-fields">
          <input name="title" placeholder="O que é?" maxlength="120" aria-label="Título">
          <div class="row">
            <input name="price" inputmode="decimal" placeholder="Preço (R$)" aria-label="Preço">
            <select name="category" aria-label="Categoria">${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}" ${k === lastCategory ? 'selected' : ''}>${v}</option>`).join('')}</select>
          </div>
          <textarea name="description" rows="2" maxlength="1000" placeholder="Descrição (opcional)" aria-label="Descrição"></textarea>
          <small class="hint ai-hint" hidden></small>
        </div>
        <button type="button" class="rm" aria-label="Tirar esta foto do lote">&times;</button>`;
      const q = (n) => row.el.querySelector(`[name=${n}]`);
      row.f = { title: q('title'), price: q('price'), category: q('category'), description: q('description') };
      row.f.category.addEventListener('change', () => (row.f.category.dataset.touched = '1'));
      showFile(row.el.querySelector('img'), file);
      row.el.querySelector('.rm').onclick = () => {
        row.removed = true;
        row.el.remove();
        updateSave();
      };
      list.append(row.el);
      rows.push(row);
      return row;
    });
    updateSave();
    // A IA analisa 3 fotos por vez, enquanto a pessoa já pode ir conferindo as primeiras.
    mapLimit(added, 3, (row) => (row.removed ? null : fillWithAI(row.f, row.file, row.el.querySelector('.ai-hint'), () => row.file)));
  });

  save.onclick = async () => {
    const todo = live();
    const missing = todo.find((r) => !r.f.title.value.trim());
    if (missing) {
      missing.f.title.focus();
      return toast('Dê um título para todos os itens (ou tire a foto do lote).', 'error');
    }
    save.disabled = true;
    let sent = todo.filter((r) => r.url).length;
    const progress = () => (save.textContent = `Enviando fotos… ${sent} de ${todo.length}`);
    progress();
    try {
      await mapLimit(todo, 3, async (r) => {
        if (r.url) return; // já enviada numa tentativa anterior
        r.url = await uploadPhoto(r.file);
        sent++;
        progress();
      });
      save.textContent = 'Salvando itens…';
      const { data, error } = await sb.from('items').insert(todo.map((r) => ({
        sale_id: sale.id,
        title: r.f.title.value.trim(),
        price: parsePrice(r.f.price.value),
        ai_price: aiPriceKept(r.f),
        category: r.f.category.value,
        description: r.f.description.value.trim() || null,
        photo_url: r.url,
        photos: [r.url],
      }))).select();
      if (error) throw new Error(`Erro ao salvar os itens: ${error.message}`);
      sale.items.unshift(...data);
      if (!sale.cover_url && data[0]?.photo_url) {
        sale.cover_url = data[0].photo_url;
        await sb.from('sales').update({ cover_url: sale.cover_url }).eq('id', sale.id);
      }
      close();
      done();
      toast(`${data.length} ${data.length === 1 ? 'item cadastrado' : 'itens cadastrados'}!`);
    } catch (err) {
      toast(err.message || 'Erro ao salvar os itens.', 'error', err);
      updateSave();
    }
  };
}

// Fotos do item em tela cheia, com as ações de compra.
function openItemViewer(sale, item, { isOwner, ended, hasPix, chatOn = true, photosOnly = false, onAction }) {
  const photos = itemPhotos(item);
  const canBuy = !isOwner && item.status === 'disponivel' && !ended;
  const { el, close } = openModal(`
    ${photos.length ? `
      <div class="gallery">${photos.map((u) => `<img src="${esc(u)}" alt="">`).join('')}</div>
      ${photos.length > 1 ? `<div class="dots">${photos.map((_, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join('')}</div>` : ''}` : ''}
    ${photosOnly
      ? `<p class="meta">${item.status !== 'disponivel' ? `<strong>${STATUS_LABEL[item.status]}</strong> · ` : ''}${chatOn ? 'Pergunte o preço no chat ou veja no local.' : 'Veja o preço no local.'}</p>`
      : `<div>
      <strong class="price">${brl(item.price)}</strong>
      <h2>${esc(itemTitle(item))}</h2>
      <p class="meta">${CATEGORIES[item.category] || ''}${item.status !== 'disponivel' ? ` · ${STATUS_LABEL[item.status]}` : ''}</p>
      ${item.description ? `<p class="item-desc">${esc(item.description).replace(/\n/g, '<br>')}</p>` : ''}
    </div>`}
    ${isOwner && photosOnly ? `
      <div class="status-toggle" role="group" aria-label="Situação">
        ${Object.entries(STATUS_LABEL).map(([k, v]) => `<button data-a="status:${k}" class="${item.status === k ? 'on' : ''}">${v}</button>`).join('')}
      </div>` : ''}
    <div class="actions">
      ${canBuy && chatOn ? `<button class="btn primary" data-a="interest">${icon.chat}Tenho interesse: conversar</button>` : ''}
      ${canBuy && hasPix && !photosOnly && Number(item.price) > 0 ? `<button class="btn pix" data-a="pix">${icon.pix}Pagar com Pix</button>` : ''}
      ${isOwner && !photosOnly ? '<button class="btn" data-a="edit-item">Editar item</button>' : ''}
      ${isOwner && photosOnly ? '<button class="btn danger" data-a="delete-item">Remover foto</button>' : ''}
      <button class="btn" data-close>Fechar</button>
    </div>`, 'viewer');
  const gallery = el.querySelector('.gallery');
  const dots = el.querySelectorAll('.dots span');
  if (gallery && dots.length) {
    gallery.addEventListener('scroll', () => {
      const i = Math.round(gallery.scrollLeft / gallery.clientWidth);
      dots.forEach((d, j) => d.classList.toggle('on', i === j));
    });
  }
  el.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
    close();
    onAction(b.dataset.a);
  }));
}

// Mostra um arquivo escolhido numa <img>, convertendo HEIC se o navegador não abrir.
function showFile(img, file) {
  img.onerror = async () => {
    img.onerror = null;
    const jpeg = isHeic(file) ? await convertHeic(file) : null;
    if (jpeg) img.src = URL.createObjectURL(jpeg);
  };
  img.src = URL.createObjectURL(file);
}

function openItemEditor(sale, item, done) {
  let photos = [...itemPhotos(item)]; // URLs já enviadas ou arquivos novos (File)
  const { el, close } = openModal(`
    <h2>Editar item</h2>
    <form>
      <div class="photo-edit"></div>
      <p class="hint">Toque numa foto para torná-la a principal.</p>
      <label>Título<input name="title" required maxlength="120" value="${esc(item.title)}"></label>
      <div class="row">
        <label>Preço (R$)<input name="price" inputmode="decimal" value="${item.price == null ? '' : String(item.price).replace('.', ',')}" placeholder="A combinar"></label>
        <label>Categoria
          <select name="category">${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}" ${k === item.category ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </label>
      </div>
      <label>Descrição<textarea name="description" rows="3" maxlength="1000" placeholder="Estado, marca, medidas…">${esc(item.description || '')}</textarea></label>
      ${aiAvailable === false ? '' : '<button type="button" class="btn small" data-ai>✨ Descrever com IA (a partir da foto principal)</button><p class="hint ai-hint" hidden></p>'}
      <div class="actions">
        <button class="btn primary">Salvar</button>
        <button type="button" class="btn" data-close>Cancelar</button>
      </div>
    </form>`);
  const box = el.querySelector('.photo-edit');
  const form = el.querySelector('form');

  const renderPhotos = () => {
    box.innerHTML =
      photos.map((_, i) => `
        <div class="thumb-edit" data-i="${i}">
          <img alt="">
          ${i === 0 ? '<span class="main-tag">Principal</span>' : ''}
          <button type="button" class="rm" data-rm="${i}" aria-label="Remover foto">&times;</button>
        </div>`).join('') +
      (photos.length < MAX_PHOTOS
        ? `<label class="add-photo">${icon.camera}<span>Adicionar</span><input type="file" accept="image/*" multiple hidden></label>`
        : '');
    box.querySelectorAll('.thumb-edit img').forEach((img, i) => {
      const p = photos[i];
      if (typeof p === 'string') img.src = p;
      else showFile(img, p);
    });
    box.querySelector('input[type=file]')?.addEventListener('change', (e) => {
      const room = MAX_PHOTOS - photos.length;
      if (e.target.files.length > room) toast(`Até ${MAX_PHOTOS} fotos por item.`);
      photos.push(...[...e.target.files].slice(0, room));
      renderPhotos();
    });
  };
  renderPhotos();

  // Aqui a pessoa pediu: a IA reescreve título, descrição e categoria (o preço só se estiver vazio).
  el.querySelector('[data-ai]')?.addEventListener('click', async (e) => {
    const main = photos[0];
    if (!main) return toast('Adicione uma foto primeiro.', 'error');
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const file = typeof main === 'string' ? new File([await (await fetch(main)).blob()], 'foto.jpg', { type: 'image/jpeg' }) : main;
      form.title.value = '';
      form.description.value = '';
      delete form.category.dataset.touched;
      await fillWithAI(form, file, el.querySelector('.ai-hint'), () => file);
      if (!form.title.value) form.title.value = item.title; // IA indisponível: volta o título
    } catch (err) {
      toast('Não foi possível ler a foto para a IA.', 'error', err);
      if (!form.title.value) form.title.value = item.title;
    } finally {
      btn.disabled = false;
    }
  });

  box.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      photos.splice(Number(rm.dataset.rm), 1);
      return renderPhotos();
    }
    const thumb = e.target.closest('.thumb-edit');
    if (thumb && thumb.dataset.i !== '0') {
      photos.unshift(...photos.splice(Number(thumb.dataset.i), 1));
      renderPhotos();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button.primary');
    btn.disabled = true;
    btn.textContent = 'Salvando…';
    try {
      const urls = await Promise.all(photos.map((p) => (typeof p === 'string' ? p : uploadPhoto(p))));
      const changes = {
        title: form.title.value.trim(),
        price: parsePrice(form.price.value),
        ai_price: aiPriceKept(form) || (item.ai_price && parsePrice(form.price.value) === Number(item.price)),
        category: form.category.value,
        description: form.description.value.trim() || null,
        photos: urls,
        photo_url: urls[0] || null,
      };
      const { error } = await sb.from('items').update(changes).eq('id', item.id);
      if (error) throw new Error(`Erro ao salvar o item: ${error.message}`);
      removeStoredPhotos(itemPhotos(item).filter((u) => !urls.includes(u) && u !== sale.cover_url));
      Object.assign(item, changes);
      if (urls[0] && !sale.cover_url) {
        sale.cover_url = urls[0];
        await sb.from('sales').update({ cover_url: urls[0] }).eq('id', sale.id);
      }
      close();
      done();
      toast('Item atualizado.');
    } catch (err) {
      toast(err.message || 'Erro ao salvar o item.', 'error', err);
      btn.disabled = false;
      btn.textContent = 'Salvar';
    }
  });
}

// O banco limita quantos contatos cada conta pode ver por hora (contra coleta em massa).
const contactError = (error) =>
  /limite/i.test(error.message) ? error.message : 'Não foi possível obter o contato do vendedor. Tente de novo.';

async function openPix(sale, item, sendChat) {
  const { data, error } = await sb.rpc('get_sale_pix', { p_sale: sale.id });
  if (error) return toast(contactError(error), 'error', error);
  const pix = data?.[0];
  if (!pix) return toast('O vendedor não informou uma chave Pix.', 'error');
  const receiver = pix.pix_name || sale.owner?.name || '';
  const code = pixPayload({ key: pix.pix_key, name: receiver, amount: Number(item.price) });
  const { el, close } = openModal(`
    <h2>Pagar com Pix</h2>
    <p class="meta big">${esc(item.title)} · <strong>${brl(item.price)}</strong></p>
    <div class="notice"><p><strong>Combine com o vendedor antes de pagar</strong>, para garantir que o item ainda está disponível.</p></div>
    <div class="qr">Gerando QR Code…</div>
    <button class="btn primary" data-copy>Copiar código Pix (copia e cola)</button>
    <p class="hint">Recebedor: <strong>${esc(receiver)}</strong>. Confira o nome no app do banco antes de confirmar.</p>
    <div class="actions">
      ${sale.owner?.chat_enabled === false ? '' : `<button class="btn primary" data-paid>${icon.chat}Avisar o vendedor que paguei</button>`}
      <button class="btn" data-close>Fechar</button>
    </div>`, 'pix-modal');
  qrSvg(code)
    .then((svg) => (el.querySelector('.qr').innerHTML = svg))
    .catch((err) => (el.querySelector('.qr').textContent = err.message));
  el.querySelector('[data-copy]').onclick = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Código Pix copiado! Cole no app do seu banco, em Pix > Copia e cola.');
    } catch {
      prompt('Copie o código Pix:', code);
    }
  };
  const paid = el.querySelector('[data-paid]');
  if (paid) paid.onclick = () => {
    close();
    sendChat(`Olá! Fiz o Pix de ${brl(item.price)} por este item. Podemos combinar a retirada?`);
  };
}

// Adicionar à agenda: Google Agenda (link) ou arquivo .ics (iPhone, Outlook, Samsung), com lembrete na véspera.
function openCalendar(sale) {
  const url = saleUrl(sale.id);
  const { el, close } = openModal(`
    <h2>Adicionar à agenda</h2>
    <p class="hint">A agenda do seu celular avisa na véspera para você não perder a venda.</p>
    <div class="actions column">
      <a class="btn" href="${esc(googleCalendarUrl(sale, url))}" target="_blank" rel="noopener" data-close>${icon.calendar}Google Agenda</a>
      <button class="btn" data-ics>${icon.calendar}iPhone, Outlook ou outra agenda</button>
      <button class="btn" data-close>Cancelar</button>
    </div>`);
  el.querySelector('[data-ics]').onclick = () => {
    const blob = new Blob([icsFor(sale, url)], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `venda-${sale.starts_on}.ics`;
    a.click();
    close();
    toast('Abra o arquivo baixado para salvar na agenda.');
  };
}

// ---------------------------------------------------------------------
// Duplicar venda: mesma venda numa nova data, com os itens que sobraram
// ---------------------------------------------------------------------
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);

// Próxima data no mesmo dia da semana, depois de hoje e depois do fim da venda original.
function nextDateFor(sale) {
  const limit = sale.ends_on > today() ? sale.ends_on : today();
  let d = parseDate(sale.starts_on);
  while (isoDate(d) <= limit) d = addDays(d, 7);
  return isoDate(d);
}

function openDuplicate(sale) {
  const start = nextDateFor(sale);
  const end = isoDate(addDays(parseDate(start), daysBetween(sale.starts_on, sale.ends_on)));
  const leftovers = sale.items.filter((i) => i.status !== 'vendido');
  const reserved = leftovers.filter((i) => i.status === 'reservado').length;
  const { el, close } = openModal(`
    <h2>Duplicar venda</h2>
    <p class="hint">Cria uma nova venda com o mesmo local, horário, descrição e foto de capa. A venda atual não muda.</p>
    <form>
      <div class="row">
        <label>Data de início<input type="date" name="starts_on" required value="${start}" min="${today()}" max="${maxStart()}"></label>
        <label>Último dia<input type="date" name="ends_on" required value="${end}" min="${today()}"></label>
      </div>
      <label class="check">
        <input type="checkbox" name="copy" ${leftovers.length ? 'checked' : 'disabled'}>
        ${leftovers.length
          ? `Levar os ${leftovers.length} ${leftovers.length === 1 ? 'item que não foi vendido' : 'itens que não foram vendidos'}`
          : 'Nenhum item para levar (todos foram vendidos)'}
      </label>
      ${reserved ? `<p class="hint">${reserved === 1 ? 'O item reservado volta' : `Os ${reserved} itens reservados voltam`} como disponível.</p>` : ''}
      <div class="actions">
        <button class="btn primary">Duplicar venda</button>
        <button type="button" class="btn" data-close>Cancelar</button>
      </div>
    </form>`);
  const form = el.querySelector('form');
  form.starts_on.addEventListener('change', () => {
    if (form.ends_on.value < form.starts_on.value) form.ends_on.value = form.starts_on.value;
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = checkSaleDates(form.starts_on.value, form.ends_on.value);
    if (bad) return toast(bad, 'error');
    const btn = form.querySelector('button.primary');
    btn.disabled = true;
    btn.textContent = 'Duplicando…';
    try {
      const fields = ['title', 'description', 'type', 'region', 'address', 'reference', 'lat', 'lng', 'start_time', 'end_time', 'cover_url', 'photos_only'];
      const row = Object.fromEntries(fields.map((f) => [f, sale[f]]));
      const { data: copy, error } = await sb
        .from('sales')
        .insert({ ...row, starts_on: form.starts_on.value, ends_on: form.ends_on.value })
        .select('id')
        .single();
      if (error) throw wrapError('Erro ao duplicar a venda', error);
      if (form.copy.checked && leftovers.length) {
        const items = leftovers.map((i) => ({
          sale_id: copy.id,
          title: i.title,
          price: i.price,
          category: i.category,
          photo_url: i.photo_url,
          photos: itemPhotos(i),
        }));
        const res = await sb.from('items').insert(items);
        if (res.error) throw new Error(`A venda foi duplicada, mas os itens não: ${res.error.message}`);
      }
      close();
      toast('Venda duplicada!');
      navigate(`/venda/${copy.id}?duplicada=1`);
    } catch (err) {
      toast(err.message, 'error', unexpected(err));
      btn.disabled = false;
      btn.textContent = 'Duplicar venda';
    }
  });
}

// ---------------------------------------------------------------------
// Cartaz para imprimir (A4) e imagem para WhatsApp, com QR Code da venda
// ---------------------------------------------------------------------
function longDay(s) {
  const d = parseDate(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return d.charAt(0).toUpperCase() + d.slice(1);
}
function longWhen(s) {
  const hours = `${fmtTime(s.start_time)} às ${fmtTime(s.end_time)}`;
  return s.starts_on === s.ends_on ? `${longDay(s.starts_on)} · ${hours}` : `${longDay(s.starts_on)} a ${longDay(s.ends_on).toLowerCase()} · ${hours}`;
}

async function viewPoster(ctx, id) {
  $view.innerHTML = '<div class="loading">Preparando o cartaz…</div>';
  const { data: sale, error } = await sb.from('sales').select('*, items(title,price,photo_url,photos,status)').eq('id', id).maybeSingle();
  if (!ctx.alive()) return;
  if (error) throw error;
  if (!sale) {
    $view.innerHTML = `<div class="empty"><h2>Venda não encontrada</h2><a class="btn" href="#/">Voltar ao início</a></div>`;
    return;
  }
  document.body.classList.add('poster-mode');
  cleanup.push(() => document.body.classList.remove('poster-mode'));
  document.title = `Cartaz — ${sale.title}`;

  const url = saleUrl(sale.id);
  const site = BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const where = [sale.address, sale.region].filter(Boolean).join(' · ');
  const highlights = sale.items.filter((i) => i.status !== 'vendido' && itemPhotos(i).length).slice(0, 6);
  const t = SALE_TYPES[sale.type];

  $view.innerHTML = `
    <div class="poster-tools no-print">
      <a class="btn small" href="#/venda/${sale.id}">← Voltar para a venda</a>
      ${highlights.length ? '<label class="check"><input type="checkbox" id="show-photos" checked> Mostrar fotos dos itens</label>' : ''}
      <button class="btn primary" id="print">Imprimir ou salvar PDF</button>
      <button class="btn whatsapp" id="as-image">${icon.whatsapp}Imagem para WhatsApp</button>
      <p class="hint">Cole o cartaz no elevador, na portaria ou no mural. Quem apontar a câmera do celular para o QR Code abre a venda com todos os itens.</p>
    </div>
    <article class="poster poster-${sale.type} ${highlights.length ? '' : 'poster-no-items'}" id="poster">
      <header class="poster-band">${esc(t.label)}</header>
      <div class="poster-body">
        <h1>${esc(sale.title)}</h1>
        <p class="poster-when">${esc(longWhen(sale))}</p>
        ${where ? `<p class="poster-where">${esc(where)}</p>` : ''}
        ${sale.reference ? `<p class="poster-ref">${esc(sale.reference)}</p>` : ''}
        ${highlights.length ? `
          <div class="poster-items" id="poster-items">
            ${highlights.map((i) => `<figure><img src="${esc(itemPhotos(i)[0])}" alt="">${sale.photos_only ? '' : `<figcaption>${brl(i.price)}</figcaption>`}</figure>`).join('')}
          </div>` : ''}
        <div class="poster-qr">
          <div class="qr" id="poster-qr"></div>
          <div>
            <strong>${sale.photos_only ? 'Veja as fotos de todos os itens' : 'Veja todos os itens e preços'}</strong>
            <p>Aponte a câmera do celular para o código</p>
            <p class="poster-url">${esc(site)}</p>
          </div>
        </div>
      </div>
      <footer>${esc(CONFIG.APP_NAME)} · vendas de garagem, bazares e mudanças em Brasília</footer>
    </article>`;

  qrSvg(url)
    .then((svg) => (document.getElementById('poster-qr').innerHTML = svg))
    .catch((err) => toast(err.message, 'error', err));
  document.getElementById('show-photos')?.addEventListener('change', (e) => {
    document.getElementById('poster-items').hidden = !e.target.checked;
    document.getElementById('poster').classList.toggle('poster-no-items', !e.target.checked);
  });
  document.getElementById('print').onclick = () => window.print();

  // A imagem é preparada já ao abrir: o navegador só permite compartilhar logo após o toque.
  const image = buildPosterImage(sale, url, where);
  image.catch((err) => reportError(err, 'cartaz imagem'));
  document.getElementById('as-image').onclick = async () => {
    let file;
    try {
      file = await image;
    } catch {
      return toast('Não foi possível gerar a imagem do cartaz.', 'error');
    }
    const text = `${SALE_TYPES[sale.type].label}: ${sale.title}\n${longWhen(sale)}${where ? `\n${where}` : ''}\nVeja os itens: ${url}`;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // a pessoa fechou o compartilhamento
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    toast('Imagem salva. Envie no WhatsApp junto com o link da venda.');
  };
}

const TYPE_COLORS = { garagem: '#3563ad', mudanca: '#b45309', bazar: '#6741d9' };

function wrapText(g, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text).split(/\s+/);
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (g.measureText(test).width > maxWidth && line) {
      if (++lines === maxLines) {
        g.fillText(`${line}…`, x, y);
        return y + lineHeight;
      }
      g.fillText(line, x, y);
      y += lineHeight;
      line = words[i];
    } else line = test;
  }
  if (line) g.fillText(line, x, y);
  return y + lineHeight;
}

// Imagem 1080x1350 (formato de post/status), para mandar nos grupos de WhatsApp.
async function buildPosterImage(sale, url, where) {
  const W = 1080, H = 1350, P = 80;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const font = (w, s) => `${w} ${s}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = TYPE_COLORS[sale.type];
  g.fillRect(0, 0, W, 150);
  g.fillStyle = '#ffffff';
  g.font = font(800, 56);
  g.textBaseline = 'middle';
  g.fillText(SALE_TYPES[sale.type].label.toUpperCase(), P, 78);

  g.textBaseline = 'alphabetic';
  g.fillStyle = '#1c2319';
  g.font = font(800, 76);
  let y = wrapText(g, sale.title, P, 290, W - 2 * P, 88, 3);
  g.font = font(700, 46);
  g.fillStyle = TYPE_COLORS[sale.type];
  y = wrapText(g, longWhen(sale), P, y + 30, W - 2 * P, 58, 2);
  g.fillStyle = '#3d4643';
  g.font = font(500, 40);
  if (where) y = wrapText(g, where, P, y + 10, W - 2 * P, 52, 2);
  if (sale.reference) y = wrapText(g, sale.reference, P, y, W - 2 * P, 52, 2);

  const qr = await qrImage(url, 10);
  const size = 420;
  const qx = (W - size) / 2;
  const qy = Math.max(y + 40, H - size - 230);
  g.drawImage(qr, qx, qy, size, size);
  g.fillStyle = '#1c2319';
  g.font = font(700, 40);
  g.textAlign = 'center';
  g.fillText(sale.photos_only ? 'Veja as fotos de todos os itens' : 'Veja todos os itens e preços', W / 2, qy + size + 70);
  g.fillStyle = '#626b5d';
  g.font = font(500, 32);
  g.fillText(`${CONFIG.APP_NAME} · aponte a câmera ou toque no link`, W / 2, qy + size + 120);

  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return new File([blob], 'cartaz-venda.png', { type: 'image/png' });
}

async function toggleFavorite(saleId) {
  if (state.favorites.has(saleId)) {
    await sb.from('favorites').delete().eq('user_id', state.user.id).eq('sale_id', saleId);
    state.favorites.delete(saleId);
    return false;
  }
  const { error } = await sb.from('favorites').insert({ sale_id: saleId });
  if (error) {
    toast('Não foi possível salvar.', 'error');
    return false;
  }
  state.favorites.add(saleId);
  toast('Venda salva nas suas favoritas.');
  return true;
}

// ---------------------------------------------------------------------
// Notificações no celular: mensagens do chat e lembretes das vendas salvas (véspera às 19h, dia às 7h)
// ---------------------------------------------------------------------
const REMINDER_TIMES = 'na véspera, às 19h, e no dia, às 7h';
const PUSH_WHAT = `as mensagens do chat na hora em que chegam, lembretes das vendas que você salvou (${REMINDER_TIMES}) e, se ativar, alertas de vendas novas perto de você`;

// Convite para ativar: depois de salvar uma venda ou de mandar a primeira mensagem, uma vez por semana no máximo.
// Devolve true se mostrou o convite.
function offerReminders(reason = 'favorito') {
  if (pushSupport() !== 'ok' || Notification.permission !== 'default') return false;
  try {
    if (Date.now() - (Number(localStorage.getItem('lembrete-oferecido')) || 0) < 7 * 24 * 3600 * 1000) return false;
    localStorage.setItem('lembrete-oferecido', String(Date.now()));
  } catch {
    return false;
  }
  const { el, close } = openModal(`
    <h2>${reason === 'chat' ? 'Quer saber quando responderem?' : 'Quer um lembrete?'}</h2>
    <p class="hint">Você recebe no celular ${PUSH_WHAT}. Dá para desligar quando quiser em Menu &gt; Dados da conta.</p>
    <div class="actions column">
      <button class="btn primary" data-on>${icon.bell}Ativar notificações</button>
      <button class="btn" data-close>Agora não</button>
    </div>`);
  el.querySelector('[data-on]').onclick = async () => {
    close();
    await turnOnReminders();
  };
  return true;
}

async function turnOnReminders() {
  try {
    const result = await enableReminders(sb, CONFIG.VAPID_PUBLIC_KEY);
    if (result === 'ativo') toast('Pronto! Você vai receber as mensagens e os lembretes no celular.');
    else if (result === 'negado') toast('As notificações ficaram bloqueadas. Libere nas configurações do navegador para este site.', 'error');
    else toast('Este navegador não recebe notificações.', 'error');
    return result === 'ativo';
  } catch (err) {
    toast('Não foi possível ativar as notificações.', 'error', err);
    return false;
  }
}

// Caixa de notificações: no perfil (completa) e nas favoritas/conversas (só o convite, quando ainda não ativou).
// ---------------------------------------------------------------------
// Alertas de vendas perto de você e novidades por e-mail (supabase/017)
// ---------------------------------------------------------------------
const NEARBY_KM = 12;
const nearbyRegions = (name) => {
  const home = regionByName(name);
  return home ? REGIONS.filter((r) => distanceKm(home, r) <= NEARBY_KM).map((r) => r.name) : [];
};

// Campos usados no convite (alerta já marcado) e no perfil. As novidades começam sempre desmarcadas.
function prefsFields(p, { suggest = false } = {}) {
  const home = p?.home_region || localStorage.getItem('regiao') || '';
  const interests = new Set(p?.interests || []);
  return `
    <label class="check"><input type="checkbox" name="alerts" ${(p ? p.alerts : suggest) ? 'checked' : ''}> Avisar quando publicarem uma venda perto de mim</label>
    <label>Região onde você mora
      <select name="home_region">
        <option value="">Escolha a região</option>
        ${REGIONS.map((r) => `<option ${r.name === home ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
      </select>
    </label>
    <label class="check"><input type="checkbox" name="nearby" ${p?.nearby === false ? '' : 'checked'}> Incluir as regiões vizinhas (até ${NEARBY_KM} km)</label>
    <p class="hint">Só me avise de vendas com (deixe tudo desmarcado para receber todas):</p>
    <div class="interest-grid">
      ${Object.entries(CATEGORIES).filter(([k]) => k !== 'outros').map(([k, label]) => `
        <label class="chip check-chip"><input type="checkbox" name="interest" value="${k}" ${interests.has(k) ? 'checked' : ''}>${esc(label)}</label>`).join('')}
    </div>
    <label class="check"><input type="checkbox" name="news_email" ${p?.news_email ? 'checked' : ''}> Quero receber novidades do ${esc(CONFIG.APP_NAME)} por e-mail (no máximo 2 por mês)</label>`;
}

function readPrefs(form) {
  const home = form.home_region.value || null;
  return {
    alerts: form.alerts.checked && !!home,
    home_region: home,
    nearby: form.nearby.checked,
    regions: home ? (form.nearby.checked ? nearbyRegions(home) : [home]) : [],
    interests: [...form.querySelectorAll('[name=interest]:checked')].map((i) => i.value),
    news_email: form.news_email.checked,
  };
}

// Atualiza e, se ainda não houver linha, insere. Não usa upsert: o ON CONFLICT DO UPDATE
// tentaria regravar user_id, que o banco não deixa alterar (permission denied).
async function savePrefs(row) {
  const { data, error } = await sb.from('preferences').update(row).eq('user_id', state.user.id).select('user_id');
  if (error) throw error;
  if (!data.length) {
    const { error: insertError } = await sb.from('preferences').insert({ ...row, user_id: state.user.id });
    if (insertError) throw insertError;
  }
  state.prefs = row;
}

// Convite único, depois de salvar a primeira venda (quem já respondeu muda pelo perfil).
function offerAlerts() {
  if (state.prefs !== null) return false;
  const { el, close } = openModal(`
    <h2>Quer ser avisado de vendas perto de você?</h2>
    <p class="hint">Quando alguém publicar uma venda na sua região, você recebe um aviso (no máximo 3 por dia). Dá para mudar quando quiser em Menu &gt; Dados da conta.</p>
    <form class="form prefs-form">
      ${prefsFields(null, { suggest: true })}
      <div class="actions column">
        <button class="btn primary">${icon.bell}Salvar</button>
        <button type="button" class="btn" data-skip>Agora não</button>
      </div>
    </form>`, '', { keep: true });
  const form = el.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const row = readPrefs(form);
    if (form.alerts.checked && !row.home_region) return toast('Escolha a região onde você mora.', 'error');
    try {
      await savePrefs(row);
    } catch (err) {
      return toast('Não foi possível salvar suas preferências.', 'error', err);
    }
    close();
    // Com alerta ligado, o aviso no celular precisa das notificações ativas neste aparelho.
    if (row.alerts && pushSupport() === 'ok' && Notification.permission === 'default') await turnOnReminders();
    else toast(row.alerts ? `Pronto! Avisaremos de vendas em ${row.home_region}${row.nearby ? ' e arredores' : ''}.` : 'Preferências salvas.');
  });
  el.querySelector('[data-skip]').onclick = async () => {
    close();
    // Guarda a resposta para não perguntar de novo.
    await savePrefs({ alerts: false, home_region: null, nearby: true, regions: [], interests: [], news_email: false }).catch(() => {});
  };
  return true;
}

async function mountReminders(el, { compact = false } = {}) {
  const support = pushSupport();
  const active = await remindersActive().catch(() => false);
  if (!el.isConnected) return;
  const blocked = support === 'ok' && Notification.permission === 'denied';
  if (compact && (active || blocked || support === 'sem-suporte')) return void (el.innerHTML = '');

  let body;
  if (support === 'ios-instalar') {
    body = `<p class="hint">No iPhone, as notificações chegam com o app na tela de início: toque em Compartilhar e depois em <strong>Adicionar à Tela de Início</strong>. Abra o app por lá e ative aqui.</p>`;
  } else if (support === 'sem-suporte') {
    body = `<p class="hint">Este navegador não recebe notificações. As mensagens aparecem na aba Chat, e você pode usar "Adicionar à agenda" na página da venda.</p>`;
  } else if (blocked) {
    body = `<p class="hint">As notificações estão bloqueadas para este site. Libere nas configurações do navegador e volte aqui.</p>`;
  } else if (active) {
    body = `<p class="hint"><span class="ok">Ativas neste aparelho ✓</span> Você recebe ${PUSH_WHAT}.</p>
      <button type="button" class="btn small" data-rem="off">Desativar notificações</button>`;
  } else {
    body = `<p class="hint">Receba no celular ${PUSH_WHAT}.</p>
      <button type="button" class="btn ${compact ? 'small' : ''} primary" data-rem="on">${icon.bell}Ativar notificações</button>`;
  }
  el.innerHTML = compact ? `<div class="reminder-box compact">${body}</div>` : `<fieldset class="reminder-box"><legend>${icon.bell} Notificações no celular</legend>${body}</fieldset>`;

  const btn = el.querySelector('[data-rem]');
  if (!btn) return;
  btn.onclick = async () => {
    btn.disabled = true;
    if (btn.dataset.rem === 'on') {
      await turnOnReminders();
    } else {
      try {
        await disableReminders(sb);
        toast('Notificações desativadas neste aparelho.');
      } catch (err) {
        toast('Não foi possível desativar as notificações.', 'error', err);
      }
    }
    mountReminders(el, { compact });
  };
}

async function shareSale(sale) {
  const url = saleUrl(sale.id);
  const text = `${SALE_TYPES[sale.type].label}: ${sale.title} — ${fmtWhen(sale)}, ${sale.region}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: sale.title, text, url });
    } catch {}
    return;
  }
  const { el, close } = openModal(`
    <h2>Compartilhar venda</h2>
    <input class="copy" value="${esc(url)}" readonly>
    <div class="actions">
      <a class="btn whatsapp" href="https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}" target="_blank" rel="noopener">${icon.whatsapp}Enviar no WhatsApp</a>
      <button class="btn" data-copy>Copiar link</button>
      <button class="btn" data-close>Fechar</button>
    </div>`);
  el.querySelector('[data-copy]').onclick = async () => {
    await navigator.clipboard.writeText(url);
    toast('Link copiado!');
    close();
  };
}

// Moderador: denúncias da venda, das mais novas para as antigas.
const REPORT_STATUS = { aberta: 'em aberto', rejeitada: 'descartada', procedente: 'aceita' };
async function loadModReports(saleId) {
  const { data, error } = await sb.from('reports').select('reason,details,status,created_at').eq('sale_id', saleId).order('created_at', { ascending: false });
  const box = document.getElementById('mod-reports');
  if (!box) return;
  if (error) return void (box.textContent = 'Não foi possível carregar as denúncias.');
  box.innerHTML = data.length
    ? `<ul class="mod-list">${data.map((r) => `<li><strong>${esc(r.reason)}</strong> · ${REPORT_STATUS[r.status] || esc(r.status)} · ${timeAgo(r.created_at)}${r.details ? `<br>${esc(r.details)}` : ''}</li>`).join('')}</ul>`
    : 'Nenhuma denúncia.';
}

function openReport(target, what) {
  const { el, close } = openModal(`
    <h2>Denunciar ${what}</h2>
    <form id="report-form">
      <label>Motivo
        <select name="reason" required>${REPORT_REASONS.map((r) => `<option>${r}</option>`).join('')}</select>
      </label>
      <label>Detalhes (opcional)
        <textarea name="details" rows="3" maxlength="1000" placeholder="Conte o que aconteceu"></textarea>
      </label>
      <div class="actions">
        <button class="btn danger">Enviar denúncia</button>
        <button type="button" class="btn" data-close>Cancelar</button>
      </div>
    </form>`);
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const { error } = await sb.from('reports').insert({ ...target, reason: f.reason.value, details: f.details.value.trim() || null });
    if (error) return toast(error.message, 'error', unexpected(error));
    close();
    toast('Denúncia enviada. Obrigado por ajudar a manter o site seguro.');
  });
}

// ---------------------------------------------------------------------
// Fotos: reduz no celular antes de enviar
// ---------------------------------------------------------------------
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler a foto.'));
    img.src = URL.createObjectURL(file);
  });
}

// Reduz a foto. WebP fica uns 30% menor que JPG; o navegador que não grava WebP (Safari antigo)
// devolve PNG, e aí a foto sai em JPG.
async function resizeImage(file, max = 1080, quality = 0.8, type = 'image/webp') {
  const img = await loadImage(file);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  const encode = (t) => new Promise((resolve) => canvas.toBlob(resolve, t, quality));
  const blob = await encode(type);
  return blob && blob.type === type ? blob : encode('image/jpeg');
}

const UPLOAD_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const isHeic = (file) => /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

// Fotos HEIC/HEIF (iPhone, Samsung) que o navegador não abre: converte para JPG no aparelho.
async function heicToJpeg(file) {
  const { default: heic2any } = await import('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/+esm');
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  return new File([Array.isArray(out) ? out[0] : out], 'foto.jpg', { type: 'image/jpeg' });
}

// Conversões já feitas na pré-visualização, reaproveitadas no envio.
const converted = new WeakMap();
function convertHeic(file) {
  if (!converted.has(file)) converted.set(file, heicToJpeg(file).catch(() => null));
  return converted.get(file);
}

// Mostra a foto escolhida no campo; se o navegador não abrir (HEIC), converte e mostra.
function previewPhoto(file, img, ph) {
  img.hidden = false;
  ph.hidden = true;
  img.onerror = async () => {
    img.onerror = null;
    if (!isHeic(file)) return;
    img.hidden = true;
    ph.hidden = false;
    const label = ph.lastChild;
    const original = label.textContent;
    label.textContent = 'Preparando foto…';
    const jpeg = await convertHeic(file);
    label.textContent = original;
    if (!jpeg) return toast('Não foi possível abrir esta foto. Tente outra.', 'error');
    img.src = URL.createObjectURL(jpeg);
    img.hidden = false;
    ph.hidden = true;
  };
  img.src = URL.createObjectURL(file);
}

async function uploadPhoto(file) {
  let blob = await resizeImage(file).catch(() => null);
  if (!blob && isHeic(file)) {
    const jpeg = await convertHeic(file);
    if (!jpeg) throw new Error('Não foi possível converter a foto HEIC. No iPhone, vá em Ajustes > Câmera > Formatos e escolha "Mais Compatível".');
    blob = (await resizeImage(jpeg).catch(() => null)) || jpeg;
  }
  if (!blob) {
    // O navegador não conseguiu ler/reduzir a foto: envia o original se o formato for aceito.
    if (!UPLOAD_TYPES[file.type]) throw new Error(`Formato de foto não suportado (${file.type || 'desconhecido'}). Use JPG ou PNG.`);
    if (file.size > 5 * 1024 * 1024) throw new Error('A foto é muito grande (máximo 5 MB).');
    // Sem a redução, a foto manteria os metadados da câmera (inclusive o GPS): remove antes de enviar.
    blob = await stripMetadata(file);
  }
  const type = blob.type || 'image/jpeg';
  const ext = UPLOAD_TYPES[type] || 'jpg';
  const bucket = sb.storage.from('photos');
  const opts = { contentType: type, cacheControl: '31536000' };
  const base = `${state.user.id}/${crypto.randomUUID()}`;
  // Miniatura para listas e cards (~30 KB). Sem ela a foto vai sem o ".f" e as listas usam a própria foto.
  const small = (ext === 'webp' || ext === 'jpg') && (await resizeImage(blob, 400, 0.7, type).catch(() => null));
  const withThumb = small?.type === type && !(await bucket.upload(`${base}.t.${ext}`, small, opts)).error;
  const path = withThumb ? `${base}.f.${ext}` : `${base}.${ext}`;
  const { error } = await bucket.upload(path, blob, opts);
  if (error) throw new Error(`Erro ao enviar a foto: ${error.message}`);
  return bucket.getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------------
// Criar / editar venda
// ---------------------------------------------------------------------
async function viewSaleForm(ctx, id) {
  if (!requireLogin(ctx.path, 'Entre para anunciar uma venda. É grátis.')) return;
  if (!canPublish()) {
    sessionStorage.setItem('next', ctx.path);
    navigate('/perfil?msg=' + encodeURIComponent('Para anunciar, confirme seu telefone por SMS.'));
    return;
  }

  let sale = null;
  if (id) {
    const { data, error } = await sb.from('sales').select('*').eq('id', id).maybeSingle();
    if (!ctx.alive()) return;
    if (error) throw error;
    if (!data || data.owner_id !== state.user.id) {
      $view.innerHTML = `<div class="empty"><h2>Você não pode editar esta venda</h2><a class="btn" href="#/">Voltar</a></div>`;
      return;
    }
    sale = data;
  }

  const sat = isoDate(nextSaturday());
  const v = sale || {
    type: 'garagem',
    region: localStorage.getItem('regiao') || 'Plano Piloto',
    starts_on: sat,
    ends_on: sat,
    start_time: '08:00',
    end_time: '14:00',
  };

  $view.innerHTML = `
    <form id="sale-form" class="form">
      <h1>${sale ? 'Editar venda' : 'Anunciar uma venda'}</h1>
      ${sale ? '' : '<p class="hint">Antes de começar, veja as <a href="regras.html">regras para anunciar</a> (datas, limites e denúncias).</p>'}

      <fieldset class="type-pick">
        <legend>Tipo</legend>
        ${Object.entries(SALE_TYPES).map(([k, t]) => `
          <label class="type-opt type-${k}">
            <input type="radio" name="type" value="${k}" ${v.type === k ? 'checked' : ''}>
            <span><strong>${t.label}</strong><small>${
              { garagem: 'Desapego da casa, num dia só', mudanca: 'Vou me mudar e preciso vender quase tudo', bazar: 'Vários vendedores: prédio, condomínio, igreja, escola' }[k]
            }</small></span>
          </label>`).join('')}
      </fieldset>

      <label>Título
        <input name="title" required minlength="3" maxlength="120" value="${esc(v.title)}" placeholder="Ex.: Bazar de sábado no pilotis da SQS 308">
      </label>
      <label>Descrição
        <textarea name="description" rows="3" maxlength="2000" placeholder="O que vai ter, formas de pagamento (Pix, dinheiro), se precisa levar sacola…">${esc(v.description)}</textarea>
      </label>

      <fieldset class="type-pick">
        <legend>Como mostrar os itens</legend>
        <label class="type-opt">
          <input type="radio" name="photos_only" value="0" ${v.photos_only ? '' : 'checked'}>
          <span><strong>Com detalhes</strong><small>Título, preço e categoria de cada item (a IA ajuda a preencher)</small></span>
        </label>
        <label class="type-opt">
          <input type="radio" name="photos_only" value="1" ${v.photos_only ? 'checked' : ''}>
          <span><strong>Só fotos</strong><small>Você só tira as fotos; o comprador pergunta o preço no chat ou vê no local</small></span>
        </label>
      </fieldset>

      <div class="row">
        <label>Data de início<input type="date" name="starts_on" required value="${v.starts_on}" min="${sale ? '' : today()}" max="${maxStart()}"></label>
        <label>Último dia<input type="date" name="ends_on" required value="${v.ends_on}"></label>
      </div>
      <div class="row">
        <label>Abre às<input type="time" name="start_time" required value="${v.start_time.slice(0, 5)}"></label>
        <label>Fecha às<input type="time" name="end_time" required value="${v.end_time.slice(0, 5)}"></label>
      </div>

      <label>Região administrativa
        <select name="region" required>
          ${REGIONS.map((r) => `<option ${r.name === v.region ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
        </select>
      </label>
      <label>Endereço
        <input name="address" maxlength="160" value="${esc(v.address)}" placeholder="Ex.: SQS 308 Bloco C">
      </label>
      <label>Referência
        <input name="reference" maxlength="160" value="${esc(v.reference)}" placeholder="Ex.: pilotis do bloco C, portaria 2">
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
        <span class="ph" ${v.cover_url ? 'hidden' : ''}>${icon.camera}Foto de capa (opcional)</span>
        <img alt="" ${v.cover_url ? `src="${esc(v.cover_url)}"` : 'hidden'}>
      </label>

      <button class="btn primary big">${sale ? 'Salvar alterações' : 'Criar venda e cadastrar itens'}</button>
    </form>`;

  const form = document.getElementById('sale-form');
  const startRegion = regionByName(v.region) || REGIONS[0];
  let pos = sale ? [sale.lat, sale.lng] : [startRegion.lat, startRegion.lng];
  let pinMoved = !!sale;

  const map = makeMap('form-map', pos, sale ? 17 : 15, { scrollWheelZoom: true, recenter: (m) => m.setView(marker.getLatLng(), Math.max(m.getZoom(), 15)) });
  const marker = L.marker(pos, { draggable: true, icon: pinIcon(v.type) }).addTo(map);
  marker.on('dragend', () => {
    const ll = marker.getLatLng();
    pos = [ll.lat, ll.lng];
    pinMoved = true;
  });
  map.on('click', (e) => {
    marker.setLatLng(e.latlng);
    pos = [e.latlng.lat, e.latlng.lng];
    pinMoved = true;
  });

  form.region.addEventListener('change', () => {
    if (pinMoved) return;
    const r = regionByName(form.region.value);
    pos = [r.lat, r.lng];
    marker.setLatLng(pos);
    map.setView(pos, 15);
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'type') marker.setIcon(pinIcon(e.target.value));
    if (e.target.name === 'starts_on' && form.ends_on.value < form.starts_on.value) form.ends_on.value = form.starts_on.value;
  });

  document.getElementById('use-location').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Seu aparelho não informa a localização.', 'error');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        pos = [p.coords.latitude, p.coords.longitude];
        pinMoved = true;
        marker.setLatLng(pos);
        map.setView(pos, 17);
      },
      () => toast('Não foi possível obter sua localização.', 'error'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });

  const coverInput = form.cover;
  coverInput.addEventListener('change', () => {
    const f = coverInput.files[0];
    if (f) previewPhoto(f, form.querySelector('.photo-pick img'), form.querySelector('.photo-pick .ph'));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Venda antiga editada sem mexer nas datas não passa pelas regras novas (igual ao banco).
    const datesChanged = !sale || form.starts_on.value !== sale.starts_on || form.ends_on.value !== sale.ends_on;
    const bad = datesChanged && checkSaleDates(form.starts_on.value, form.ends_on.value);
    if (bad) return toast(bad, 'error');
    if (form.starts_on.value === form.ends_on.value && form.end_time.value <= form.start_time.value)
      return toast('O horário de fechamento precisa ser depois da abertura.', 'error');
    const btn = form.querySelector('button.big');
    btn.disabled = true;
    btn.textContent = 'Salvando…';
    try {
      const row = {
        type: form.type.value,
        title: form.title.value.trim(),
        description: form.description.value.trim() || null,
        starts_on: form.starts_on.value,
        ends_on: form.ends_on.value,
        start_time: form.start_time.value,
        end_time: form.end_time.value,
        region: form.region.value,
        address: form.address.value.trim() || null,
        reference: form.reference.value.trim() || null,
        lat: pos[0],
        lng: pos[1],
        photos_only: form.photos_only.value === '1',
      };
      const res = sale
        ? await sb.from('sales').update(row).eq('id', sale.id).select('id').single()
        : await sb.from('sales').insert(row).select('id').single();
      if (res.error) throw wrapError('Erro ao salvar a venda', res.error);
      localStorage.setItem('regiao', row.region);
      // A capa vai depois da venda salva: se a foto falhar, a venda não se perde.
      let coverError = null;
      if (coverInput.files[0]) {
        try {
          const cover_url = await uploadPhoto(coverInput.files[0]);
          const up = await sb.from('sales').update({ cover_url }).eq('id', res.data.id);
          if (up.error) throw up.error;
        } catch (err) {
          coverError = err;
        }
      }
      if (coverError) toast(`Venda salva, mas a foto de capa falhou. ${coverError.message}`, 'error', coverError);
      else toast(sale ? 'Venda atualizada.' : 'Venda criada como rascunho. Agora cadastre os itens.');
      navigate(`/venda/${res.data.id}${sale ? '' : '?novo=1'}`);
    } catch (err) {
      toast(err.message || 'Erro ao salvar.', 'error', unexpected(err));
      btn.disabled = false;
      btn.textContent = sale ? 'Salvar alterações' : 'Criar venda e cadastrar itens';
    }
  });
}

// ---------------------------------------------------------------------
// Minhas vendas e favoritas
// ---------------------------------------------------------------------
async function viewMine(ctx) {
  if (!requireLogin('/minhas', 'Entre para ver suas vendas e favoritas.')) return;
  const tab = ctx.params.get('aba') || 'vendas';
  $view.innerHTML = `
    <div class="seg wide">
      <a href="#/minhas?aba=vendas" class="${tab === 'vendas' ? 'on' : ''}">Minhas vendas</a>
      <a href="#/minhas?aba=favoritas" class="${tab === 'favoritas' ? 'on' : ''}">Favoritas</a>
    </div>
    <div id="mine">${skeletonCards(3)}</div>`;

  let sales;
  if (tab === 'vendas') {
    const { data, error } = await sb.from('sales').select(SALE_LIST_FIELDS).eq('owner_id', state.user.id).order('starts_on', { ascending: false });
    if (error) throw error;
    sales = data;
  } else {
    const { data, error } = await sb.from('favorites').select(`sales(${SALE_LIST_FIELDS})`).eq('user_id', state.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    sales = data.map((r) => r.sales).filter(Boolean);
  }
  if (!ctx.alive()) return;

  const t = today();
  const upcoming = sales.filter((s) => s.ends_on >= t);
  const past = sales.filter((s) => s.ends_on < t);
  const el = document.getElementById('mine');
  if (!sales.length) {
    el.innerHTML =
      tab === 'vendas'
        ? `<div class="empty"><h2>Você ainda não anunciou nenhuma venda</h2><a class="btn primary" href="#/anunciar">Anunciar uma venda</a></div>`
        : `<div class="empty"><h2>Nenhuma venda salva</h2><p>Toque em "Salvar" numa venda para guardá-la aqui.</p><a class="btn" href="#/">Ver vendas</a></div>`;
    return;
  }
  el.innerHTML = `
    ${tab === 'favoritas' && upcoming.length ? '<div id="reminders"></div>' : ''}
    ${upcoming.length ? `<h2 class="section-title">Próximas</h2><div class="cards">${upcoming.map(saleCard).join('')}</div>` : ''}
    ${past.length ? `<h2 class="section-title">Encerradas</h2><div class="cards past">${past.map(saleCard).join('')}</div>` : ''}`;
  const reminders = document.getElementById('reminders');
  if (reminders) mountReminders(reminders, { compact: true });
}

// ---------------------------------------------------------------------
// Chat: cada conversa é sobre um item, entre um comprador e o vendedor (supabase/007)
// ---------------------------------------------------------------------
async function openChat(sale, item, text = '') {
  if (!requireLogin(`/venda/${sale.id}`, 'Entre para conversar com o vendedor.')) return;
  const { data: id, error } = await sb.rpc('start_conversation', { p_item: item.id });
  if (error) return toast(error.message, 'error', /Limite|encontrado|é seu|não recebe/.test(error.message) ? null : error);
  try {
    if (text) sessionStorage.setItem(`chat-rascunho-${id}`, text);
  } catch {}
  navigate(`/chat/${id}`);
}

// Mensagens chegam na hora (Supabase Realtime): o banco publica cada mensagem no canal
// particular de quem está na conversa, e só a própria pessoa entra no seu canal.
let chatChannel = null;
let openConversation = null; // id da conversa aberta na tela, se houver
let chatListen = 0;
// A lista de conversas também se atualiza ao voltar para o app.
window.addEventListener('chat-resync', (e) => !e.detail?.initial && location.hash === '#/chat' && render());
async function listenChat() {
  const turn = ++chatListen;
  if (chatChannel) sb.removeChannel(chatChannel);
  chatChannel = null;
  if (!state.user) return;
  // O canal é particular: o Realtime precisa do token da sessão antes de entrar.
  const { data } = await sb.auth.getSession();
  if (turn !== chatListen || !state.user) return;
  if (data.session) sb.realtime.setAuth(data.session.access_token);
  let initial = true;
  chatChannel = sb
    .channel(`user:${state.user.id}`, { config: { private: true } })
    .on('broadcast', { event: 'message' }, ({ payload: m }) => {
      window.dispatchEvent(new CustomEvent('chat-message', { detail: m }));
      if (m.sender_id === state.user?.id || m.conversation_id === openConversation) return;
      refreshUnread(true);
      if (location.hash === '#/chat') render();
      else if (!location.hash.startsWith('#/chat')) toast('Nova mensagem no chat.');
    })
    .subscribe((status) => {
      // (Re)conectou, por exemplo depois de a rede cair: busca o que pode ter passado.
      if (status !== 'SUBSCRIBED') return;
      window.dispatchEvent(new CustomEvent('chat-resync', { detail: { initial } }));
      initial = false;
    });
}

const STATUS_SHORT = { disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido' };
const clock = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const thumb = (url) => (url ? `<img src="${esc(thumbUrl(url))}" alt="" loading="lazy">` :`<span class="chat-noimg">${icon.tag}</span>`);

async function viewChats(ctx) {
  if (!requireLogin('/chat', 'Entre para ver suas conversas.')) return;
  $view.innerHTML = `
    <div class="chat-page">
      <h1>Conversas</h1>
      <div id="reminders"></div>
      <div id="chat-list" class="chat-list" aria-busy="true">${'<div class="chat-row"><span class="chat-thumb sk"></span><span class="sk notif-sk"></span></div>'.repeat(4)}</div>
    </div>`;
  mountReminders(document.getElementById('reminders'), { compact: true });
  const { data, error } = await sb.rpc('my_conversations');
  if (error) throw error;
  if (!ctx.alive()) return;
  const list = document.getElementById('chat-list');
  list.removeAttribute('aria-busy');
  if (!data.length) {
    list.innerHTML = `
      <div class="empty">
        <h2>Nenhuma conversa ainda</h2>
        <p>Viu um item que gostou? Toque em <strong>Tenho interesse</strong> para conversar com o vendedor sobre ele.</p>
        <a class="btn" href="#/">Ver vendas</a>
      </div>`;
    return;
  }
  list.innerHTML = data.map((c) => `
    <a class="chat-row ${c.unread ? 'unread' : ''}" href="#/chat/${c.id}">
      <span class="chat-thumb">${thumb(c.item_photo)}</span>
      <span class="chat-text">
        <strong>${esc(c.item_title)}</strong>
        <small>${c.i_am_seller ? 'Você vende para' : 'Vendido por'} ${esc(c.other_name)}</small>
        <span class="chat-last">${c.last_mine ? 'Você: ' : ''}${esc(c.last_message || '')}</span>
      </span>
      <time datetime="${esc(c.last_message_at)}">${timeAgo(c.last_message_at)}</time>
    </a>`).join('');
}

async function viewConversation(ctx, id) {
  if (!requireLogin(`/chat/${id}`, 'Entre para ver suas conversas.')) return;
  $view.innerHTML = `<div class="chat-view"><div class="chat-head"><span class="chat-thumb sk"></span><span class="sk notif-sk"></span></div></div>`;
  const [info, msgs] = await Promise.all([
    sb.rpc('my_conversations', { p_conv: id }),
    sb.from('messages').select('id,sender_id,body,created_at').eq('conversation_id', id).order('created_at').limit(500),
  ]);
  if (info.error) throw info.error;
  if (msgs.error) throw msgs.error;
  if (!ctx.alive()) return;
  const c = info.data?.[0];
  if (!c) {
    $view.innerHTML = `<div class="empty"><h2>Conversa não encontrada</h2><a class="btn" href="#/chat">Ver conversas</a></div>`;
    return;
  }
  document.title = `${c.item_title} — Chat — ${CONFIG.APP_NAME}`;
  const messages = msgs.data;
  let draft = '';
  try {
    draft = sessionStorage.getItem(`chat-rascunho-${id}`) || '';
    sessionStorage.removeItem(`chat-rascunho-${id}`);
  } catch {}

  $view.innerHTML = `
    <div class="chat-view">
      <div class="chat-head">
        <a href="#/chat" class="chat-back" aria-label="Voltar para as conversas">${icon.chevron}</a>
        <a class="chat-item" href="${c.sale_id ? `#/venda/${c.sale_id}` : '#/chat'}">
          <span class="chat-thumb">${thumb(c.item_photo)}</span>
          <span class="chat-text">
            <strong>${esc(c.item_title)}</strong>
            <small>${c.item_price != null ? `${brl(c.item_price)} · ` : ''}${c.item_status ? STATUS_SHORT[c.item_status] : 'Item removido'} · ${c.i_am_seller ? 'comprador' : 'vendedor'}: ${esc(c.other_name)}</small>
          </span>
        </a>
        <button class="chat-report" data-report aria-label="Denunciar conversa" title="Denunciar conversa">${icon.flag}</button>
      </div>
      ${c.i_am_seller && c.item_id ? `
        <div class="status-toggle chat-status" role="group" aria-label="Situação do item">
          ${Object.entries(STATUS_LABEL).map(([k, v]) => `<button data-status="${k}" class="${c.item_status === k ? 'on' : ''}">${v}</button>`).join('')}
        </div>` : ''}
      <p class="hint chat-safety">Combine a retirada em lugar movimentado e só pague depois de ver o item. Nunca passe senhas ou códigos recebidos por SMS.</p>
      <div class="chat-msgs" id="chat-msgs" aria-live="polite"></div>
      <form class="chat-input" id="chat-form">
        <textarea name="body" rows="1" maxlength="2000" placeholder="Escreva uma mensagem" aria-label="Mensagem" required>${esc(draft)}</textarea>
        <button class="btn primary" aria-label="Enviar">${icon.send}</button>
      </form>
    </div>`;

  const box = document.getElementById('chat-msgs');
  const dayLabel = (iso) => {
    const d = isoDate(new Date(iso));
    if (d === today()) return 'Hoje';
    if (d === isoDate(addDays(new Date(), -1))) return 'Ontem';
    return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  };
  const paint = () => {
    let lastDay = '';
    box.innerHTML = messages.length
      ? messages.map((m) => {
          const day = dayLabel(m.created_at);
          const sep = day !== lastDay ? `<div class="chat-day">${day}</div>` : '';
          lastDay = day;
          return `${sep}<div class="msg ${m.sender_id === state.user.id ? 'mine' : ''} ${m.pending ? 'pending' : ''}">
            <p>${esc(m.body).replace(/\n/g, '<br>')}</p><time>${m.pending ? 'enviando…' : clock(m.created_at)}</time></div>`;
        }).join('')
      : `<p class="hint chat-empty">${c.i_am_seller ? 'Nenhuma mensagem ainda.' : 'Mande uma mensagem para o vendedor sobre este item.'}</p>`;
    window.scrollTo(0, document.body.scrollHeight);
  };
  paint();
  sb.rpc('mark_conversation_read', { p_conv: id }).then(() => refreshUnread(true));

  // Mensagens novas desta conversa (da outra pessoa ou de outro aparelho meu).
  openConversation = id;
  const onMessage = (e) => {
    const m = e.detail;
    if (m.conversation_id !== id || messages.some((x) => x.id === m.id)) return;
    messages.push(m);
    paint();
    if (m.sender_id !== state.user.id) sb.rpc('mark_conversation_read', { p_conv: id }).then(() => refreshUnread(true));
  };
  // Mensagens que chegaram sem o tempo real (app em segundo plano, conexão caída).
  let syncing = false;
  const onResync = async () => {
    if (syncing) return;
    syncing = true;
    try {
      const last = messages.filter((m) => !m.pending).at(-1)?.created_at;
      let q = sb.from('messages').select('id,sender_id,body,created_at').eq('conversation_id', id).order('created_at').limit(200);
      if (last) q = q.gt('created_at', last);
      const { data } = await q;
      const fresh = (data || []).filter((m) => !messages.some((x) => x.id === m.id));
      if (openConversation !== id) return;
      if (!fresh.length) return void refreshUnread();
      messages.push(...fresh);
      messages.sort((a, b) => !!a.pending - !!b.pending || a.created_at.localeCompare(b.created_at));
      paint();
      if (fresh.some((m) => m.sender_id !== state.user.id)) sb.rpc('mark_conversation_read', { p_conv: id }).then(() => refreshUnread(true));
    } finally {
      syncing = false;
    }
  };
  window.addEventListener('chat-message', onMessage);
  window.addEventListener('chat-resync', onResync);
  cleanup.push(() => {
    window.removeEventListener('chat-message', onMessage);
    window.removeEventListener('chat-resync', onResync);
    openConversation = null;
  });

  const form = document.getElementById('chat-form');
  const input = form.body;
  const grow = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  };
  input.addEventListener('input', grow);
  grow();
  // Enter envia no computador; no celular o Enter quebra a linha e envia pelo botão.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) return;
    const temp = { id: `tmp-${Date.now()}`, sender_id: state.user.id, body, created_at: new Date().toISOString(), pending: true };
    messages.push(temp);
    input.value = '';
    grow();
    paint();
    const { data, error } = await sb.from('messages').insert({ conversation_id: id, body }).select('id,sender_id,body,created_at').single();
    const i = messages.indexOf(temp);
    if (error) {
      messages.splice(i, 1);
      input.value = body;
      grow();
      paint();
      const known = /Muitas mensagens|desligou o chat/.test(error.message);
      return toast(known ? error.message : 'Não foi possível enviar. Tente de novo.', 'error', known ? null : error);
    }
    if (messages.some((x) => x.id === data.id)) messages.splice(i, 1); // o tempo real chegou antes
    else messages[i] = data;
    paint(); // o aviso no celular da outra pessoa sai do próprio banco
    offerReminders('chat');
  });
  if (draft) input.focus();

  // Vendedor muda a situação do item direto da conversa.
  $view.querySelector('.chat-status')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    const { error } = await sb.from('items').update({ status: btn.dataset.status }).eq('id', c.item_id);
    if (error) return toast('Não foi possível atualizar o item.', 'error', error);
    c.item_status = btn.dataset.status;
    $view.querySelectorAll('.chat-status [data-status]').forEach((b) => b.classList.toggle('on', b === btn));
    $view.querySelector('.chat-item small').innerHTML =
      `${c.item_price != null ? `${brl(c.item_price)} · ` : ''}${STATUS_SHORT[c.item_status]} · comprador: ${esc(c.other_name)}`;
    toast(`Item marcado como ${STATUS_SHORT[c.item_status].toLowerCase()}.`);
  });

  $view.querySelector('[data-report]').onclick = () =>
    openReport({ sale_id: c.sale_id, reported_user_id: c.other_id }, c.i_am_seller ? 'comprador' : 'vendedor');
}

// ---------------------------------------------------------------------
// Menu: dados da conta, minhas vendas e favoritas, notificações, páginas legais
// ---------------------------------------------------------------------
// Cor da barra do navegador (meta theme-color). Fica só neste aparelho; o index.html a aplica ao abrir.
const BAR_DEFAULT = '#4a8420';
const BAR_COLORS = [
  [BAR_DEFAULT, 'Verde (padrão)'], ['#3563ad', 'Azul'], ['#6741d9', 'Roxo'], ['#c2255c', 'Rosa'],
  ['#e8590c', 'Laranja'], ['#1c2319', 'Grafite'], ['#ffffff', 'Branco'],
];
const barColor = () => {
  try {
    const c = localStorage.getItem('cor-barra');
    return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : BAR_DEFAULT;
  } catch {
    return BAR_DEFAULT;
  }
};
function setBarColor(color) {
  document.querySelector('meta[name="theme-color"]').content = color;
  try {
    if (color === BAR_DEFAULT) localStorage.removeItem('cor-barra');
    else localStorage.setItem('cor-barra', color);
  } catch {}
}

async function viewMenu() {
  const current = barColor();
  const row =(href, ic, label, extra = '') =>
    `<a class="menu-row" href="${href}"><span class="menu-icon">${ic}</span><span>${label}</span>${extra}<span class="menu-go">${icon.chevron}</span></a>`;
  const u = state.user;
  $view.innerHTML = `
    <div class="menu-page">
      ${u ? `
        <a class="menu-user" href="#/perfil">
          <span class="menu-avatar">${esc((state.profile?.name || u.email || '?').trim()[0].toUpperCase())}</span>
          <span><strong>${esc(state.profile?.name || 'Seu perfil')}</strong><small>${esc(u.email || '')}</small></span>
          <span class="menu-go">${icon.chevron}</span>
        </a>` : `
        <div class="menu-user guest">
          <span><strong>Entre na sua conta</strong><small>Para anunciar, salvar vendas e conversar com vendedores.</small></span>
          <a class="btn primary" href="#/entrar">Entrar</a>
        </div>`}
      <nav class="menu-list" aria-label="Menu">
        ${row('#/minhas', icon.tag, 'Minhas vendas')}
        ${row('#/minhas?aba=favoritas', icon.heart, 'Favoritas')}
        ${row('#/chat', icon.chat, 'Conversas', state.chatUnread ? `<span class="menu-count">${state.chatUnread}</span>` : '')}
        ${row('#/notificacoes', icon.bell, 'Notificações', state.unread ? `<span class="menu-count">${state.unread}</span>` : '')}
        ${row('#/perfil', icon.user, 'Dados da conta, WhatsApp e Pix')}
        ${row('#/anunciar', icon.camera, 'Anunciar uma venda')}
      </nav>
      <nav class="menu-list" aria-label="Informações">
        ${row('regras.html', icon.flag, 'Regras para anunciar')}
        ${row('privacidade.html', icon.doc, 'Política de Privacidade')}
        ${row('termos.html', icon.doc, 'Termos de Uso')}
      </nav>
      <section class="menu-list bar-colors" aria-labelledby="bar-colors-title">
        <div class="menu-row">
          <span class="menu-icon">${icon.palette}</span>
          <span><span id="bar-colors-title">Cor da barra do navegador</span><small class="hint">Vale só neste aparelho.</small></span>
        </div>
        <div class="swatches">${BAR_COLORS.map(([c, name]) => `
          <button type="button" class="swatch${c === current ? ' on' : ''}" data-color="${c}" style="--swatch:${c}" aria-label="${name}" title="${name}" aria-pressed="${c === current}"></button>`).join('')}
          <label class="swatch custom${BAR_COLORS.some(([c]) => c === current) ? '' : ' on'}" title="Outra cor">
            <input type="color" value="${current}" aria-label="Outra cor">
          </label>
        </div>
      </section>
      ${u ? `<button class="btn big menu-logout" id="menu-logout">${icon.out}Sair da conta</button>` : ''}
    </div>`;
  const pick = (color) => {
    setBarColor(color);
    const preset = BAR_COLORS.some(([c]) => c === color);
    $view.querySelectorAll('.swatch').forEach((el) => {
      const on = el.dataset.color ? el.dataset.color === color : !preset;
      el.classList.toggle('on', on);
      if (el.dataset.color) el.setAttribute('aria-pressed', String(on));
    });
  };
  $view.querySelectorAll('.swatch[data-color]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.color)));
  $view.querySelector('.swatch.custom input').addEventListener('input', (e) => pick(e.target.value));
  document.getElementById('menu-logout')?.addEventListener('click', async () => {
    await disableReminders(sb).catch(() => {});
    await sb.auth.signOut();
    navigate('/');
  });
}

// ---------------------------------------------------------------------
// Central de notificações (os avisos são criados pelo banco: supabase/005)
// ---------------------------------------------------------------------
const CHANGES = { data: 'a data', 'horário': 'o horário', 'endereço': 'o endereço' };
const joinPt = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} e ${list.at(-1)}` : list[0] || '');

function notificationText(n) {
  const t = n.sale_title || 'uma venda';
  switch (n.kind) {
    case 'lembrete_vespera':
      return { icon: icon.bell, cls: 'remind', title: `Amanhã: ${t}`, body: 'Uma venda que você salvou começa amanhã. Veja os itens e a rota.' };
    case 'lembrete_hoje':
      return { icon: icon.bell, cls: 'remind', title: `Hoje: ${t}`, body: 'Uma venda que você salvou começa hoje. Bom garimpo!' };
    case 'venda_alterada': {
      const what = joinPt((n.detail || '').split(',').map((k) => CHANGES[k]).filter(Boolean)) || 'os dados';
      return { icon: icon.calendar, cls: 'change', title: `Mudou: ${t}`, body: `O vendedor alterou ${what}. Confira antes de ir.` };
    }
    case 'venda_cancelada':
      return { icon: icon.flag, cls: 'cancel', title: `Cancelada: ${t}`, body: 'O vendedor removeu esta venda.' };
    case 'venda_salva':
      return {
        icon: icon.heart, cls: 'saved',
        title: n.count > 1 ? `${n.count} pessoas salvaram sua venda` : 'Alguém salvou sua venda',
        body: `"${t}". Quem salva recebe lembrete na véspera e no dia.`,
      };
    case 'venda_oculta':
      return { icon: icon.flag, cls: 'cancel', title: 'Sua venda saiu do ar', body: `"${t}" foi ocultada após denúncias e não aparece mais nas buscas.` };
    case 'venda_perto':
      return { icon: icon.pin, cls: 'remind', title: `Venda nova perto de você: ${t}`, body: `${n.detail || 'Na sua região'}. Veja os itens antes de todo mundo.` };
    case 'venda_liberada':
      return { icon: icon.flag, cls: 'saved', title: 'Sua venda voltou ao ar', body: `A moderação revisou "${t}" e ela aparece de novo nas buscas.` };
    case 'denuncia_revisar':
      return {
        icon: icon.flag, cls: 'cancel',
        title: n.detail === 'oculta' ? `Oculta por denúncias: ${t}` : `Denúncia: ${t}`,
        body: `${n.count > 1 ? `${n.count} pessoas denunciaram` : 'Uma pessoa denunciou'} esta venda. Toque para revisar.`,
      };
    default:
      return { icon: icon.bell, cls: '', title: t, body: '' };
  }
}

function timeAgo(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.round(min / 60)} h`;
  const d = new Date(iso);
  if (isoDate(d) === isoDate(addDays(new Date(), -1))) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace(/\./g, '');
}

async function viewNotifications(ctx) {
  if (!requireLogin('/notificacoes', 'Entre para ver suas notificações.')) return;
  $view.innerHTML = `
    <div class="notif-page">
      <div class="notif-head"><h1>Notificações</h1><span id="notif-tools"></span></div>
      <div id="notif-list"><div class="notif-list" aria-busy="true" aria-label="Carregando">${'<div class="notif"><span class="notif-icon sk"></span><span class="sk notif-sk"></span></div>'.repeat(4)}</div></div>
    </div>`;

  const { data, error } = await sb.from('notifications')
    .select('id,kind,sale_id,sale_title,detail,count,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  if (!ctx.alive()) return;

  const list = document.getElementById('notif-list');
  if (!data.length) {
    list.innerHTML = `
      <div class="empty">
        <h2>Nenhuma notificação ainda</h2>
        <p>Salve vendas para receber aqui o lembrete na véspera e no dia, e saber se mudarem de data ou endereço.</p>
        <div id="reminders"></div>
        <a class="btn" href="#/">Ver vendas</a>
      </div>`;
    mountReminders(document.getElementById('reminders'), { compact: true });
    return;
  }

  const item = (n) => {
    const t = notificationText(n);
    const inner = `
      <span class="notif-icon ${t.cls}">${t.icon}</span>
      <span class="notif-text"><strong>${esc(t.title)}</strong><span>${esc(t.body)}</span><time datetime="${esc(n.created_at)}">${timeAgo(n.created_at)}</time></span>`;
    const cls = `notif ${n.read_at ? '' : 'unread'}`;
    return n.sale_id ? `<a class="${cls}" href="#/venda/${n.sale_id}">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
  };
  const fresh = data.filter((n) => !n.read_at);
  const old = data.filter((n) => n.read_at);
  list.innerHTML = `
    ${fresh.length ? `<h2 class="section-title">Novas</h2><div class="notif-list">${fresh.map(item).join('')}</div>` : ''}
    ${old.length ? `<h2 class="section-title">Anteriores</h2><div class="notif-list">${old.map(item).join('')}</div>` : ''}
    <div id="reminders"></div>`;
  mountReminders(document.getElementById('reminders'), { compact: true });

  const tools = document.getElementById('notif-tools');
  tools.innerHTML = '<button class="btn small" id="notif-clear">Limpar tudo</button>';
  document.getElementById('notif-clear').onclick = async () => {
    const { error } = await sb.from('notifications').delete().eq('user_id', state.user.id);
    if (error) return toast('Não foi possível limpar as notificações.', 'error', error);
    toast('Notificações apagadas.');
    render();
  };

  // Abriu a central: tudo vira lido (o destaque das novas continua até sair da tela).
  if (fresh.length) {
    const { error: readError } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', state.user.id).is('read_at', null);
    if (!readError) {
      state.unread = 0;
      updateBadge();
    }
  }
}

// ---------------------------------------------------------------------
// Entrar: Google ou link por e-mail
// ---------------------------------------------------------------------
async function viewLogin(ctx) {
  if (state.user) {
    const next = sessionStorage.getItem('next') || '/';
    sessionStorage.removeItem('next');
    return navigate(next);
  }
  const msg = ctx.params.get('msg');
  $view.innerHTML = `
    <div class="auth">
      <h1>Entrar</h1>
      <p class="hint">${esc(msg || 'Navegar é livre. O cadastro só é pedido para anunciar, salvar vendas ou falar com o vendedor.')}</p>
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
    </div>`;

  document.getElementById('google').onclick = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: BASE_URL } });
    if (error) toast(error.message, 'error', error);
  };
  document.getElementById('email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: BASE_URL } });
    btn.disabled = false;
    if (error) return toast(error.message, 'error', error);
    e.target.innerHTML = `<div class="notice"><strong>Confira seu e-mail.</strong><p>Enviamos um link de acesso para ${esc(email)}. Abra-o neste mesmo aparelho e navegador.</p></div>`;
  });
}

// ---------------------------------------------------------------------
// Perfil: nome, WhatsApp e verificação por SMS
// ---------------------------------------------------------------------
async function viewProfile(ctx) {
  if (!requireLogin('/perfil')) return;
  const msg = ctx.params.get('msg');
  const c = state.contact || {};
  $view.innerHTML = `
    <form id="profile-form" class="form">
      <h1>Seu perfil</h1>
      ${msg ? `<div class="notice">${esc(msg)}</div>` : ''}
      <p class="hint">${esc(state.user.email || '')}</p>
      <label>Nome que aparece nas vendas
        <input name="name" required maxlength="80" value="${esc(state.profile?.name)}">
      </label>
      <fieldset class="pix-box">
        <legend>${icon.chat} Chat com compradores</legend>
        <label class="check"><input type="checkbox" name="chat_enabled" ${state.profile?.chat_enabled === false ? '' : 'checked'}> Receber mensagens dos compradores pelo chat</label>
        <p class="hint">Desligue se você só quer divulgar a venda: o botão "Tenho interesse" some das suas vendas e ninguém manda mensagem, nem nas conversas que já existem. Você continua vendo e respondendo as conversas antigas.</p>
      </fieldset>
      <fieldset class="pix-box">
        <legend>${icon.whatsapp} WhatsApp (opcional)</legend>
        <p class="hint">Os compradores falam com você pelo <strong>chat do app</strong>, sem ver seu número. Se preferir, libere também o WhatsApp.</p>
        <label>WhatsApp com DDD
          <input name="whatsapp" type="tel" inputmode="tel" placeholder="(61) 99999-9999" value="${esc(fmtPhone(c.whatsapp))}">
        </label>
        <label class="check"><input type="checkbox" name="show_whatsapp" ${c.show_whatsapp ? 'checked' : ''}> Mostrar o botão do WhatsApp nas minhas vendas</label>
        <p class="hint">Desmarcado, seu número fica guardado e ninguém vê. Marcado, aparece para compradores logados que tocarem em "Falar no WhatsApp".
          ${c.whatsapp ? (c.phone_verified ? '<span class="ok">Telefone verificado ✓</span>' : state.requireVerification ? '<span class="warn">Telefone ainda não verificado</span>' : '') : ''}</p>
      </fieldset>
      <div id="otp-box"></div>

      <fieldset class="pix-box">
        <legend>${icon.pix} Receber por Pix (opcional)</legend>
        <p class="hint">Com a chave cadastrada, cada item mostra um QR Code com o valor já preenchido. O dinheiro vai direto para a sua conta, sem taxas. A chave só aparece para compradores logados.</p>
        <div class="row">
          <label>Tipo de chave
            <select name="pix_type">
              ${Object.entries(PIX_TYPES).map(([k, v]) => `<option value="${k}" ${k === (c.pix_key ? guessPixType(c.pix_key) : 'aleatoria') ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </label>
          <label>Chave Pix
            <input name="pix_key" value="${esc(c.pix_key ? formatPixKey(c.pix_key) : '')}" autocomplete="off">
          </label>
        </div>
        <p class="hint">Recomendamos a <strong>chave aleatória</strong>: crie uma no app do seu banco, em Pix &gt; Minhas chaves.</p>
        <div class="notice warn-box" id="pix-cpf-warning" ${guessPixType(c.pix_key) === 'cpf' && c.pix_key ? '' : 'hidden'}>
          <p><strong>Atenção:</strong> com chave CPF ou CNPJ, quem for pagar vê o seu documento. Prefira a chave aleatória.</p>
        </div>
        <label>Nome do recebedor (como aparece no banco)
          <input name="pix_name" maxlength="25" value="${esc(c.pix_name || '')}" placeholder="${esc((state.profile?.name || '').slice(0, 25))}">
        </label>
      </fieldset>

      <fieldset class="pix-box prefs-form">
        <legend>${icon.bell} Alertas e novidades</legend>
        ${prefsFields(state.prefs)}
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
    </div>`;

  const form = document.getElementById('profile-form');
  const otpBox = document.getElementById('otp-box');
  form.pix_type.addEventListener('change', () => {
    document.getElementById('pix-cpf-warning').hidden = form.pix_type.value !== 'cpf';
  });

  const finish = async () => {
    await setUser(state.user);
    const next = sessionStorage.getItem('next');
    sessionStorage.removeItem('next');
    if (next && canPublish()) navigate(next);
    else render();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = form.whatsapp.value.trim();
    const phone = raw ? normalizePhone(raw) : null;
    if (raw && !phone) return toast('Informe um celular válido com DDD.', 'error');
    const showWhatsapp = form.show_whatsapp.checked;
    if (showWhatsapp && !phone) return toast('Para mostrar o botão do WhatsApp, informe o número.', 'error');

    const pixRaw = form.pix_key.value.trim();
    const pix_key = pixRaw ? normalizePixKey(form.pix_type.value, pixRaw) : null;
    if (pixRaw && !pix_key) return toast(`Chave Pix inválida para o tipo "${PIX_TYPES[form.pix_type.value]}".`, 'error');
    const pix_name = pix_key ? form.pix_name.value.trim() || (form.name.value.trim().slice(0, 25)) : null;

    const prefs = readPrefs(form);
    if (form.alerts.checked && !prefs.home_region) return toast('Para receber alertas, escolha a região onde você mora.', 'error');

    const p1 = await sb.from('profiles').update({ name: form.name.value.trim(), chat_enabled: form.chat_enabled.checked }).eq('id', state.user.id);
    if (p1.error) return toast(p1.error.message, 'error', p1.error);
    try {
      await savePrefs(prefs);
    } catch (err) {
      return toast(`Erro ao salvar os alertas: ${err.message}`, 'error', err);
    }
    if (showWhatsapp !== !!c.show_whatsapp) {
      const sw = await sb.from('contacts').update({ show_whatsapp: showWhatsapp }).eq('user_id', state.user.id);
      if (sw.error) return toast(`Erro ao salvar a opção do WhatsApp: ${sw.error.message}`, 'error', sw.error);
    }
    if (pix_key !== (c.pix_key || null) || pix_name !== (c.pix_name || null)) {
      const px = await sb.from('contacts').update({ pix_key, pix_name }).eq('user_id', state.user.id);
      if (px.error) return toast(`Erro ao salvar o Pix: ${px.error.message}`, 'error', px.error);
    }

    const changed = phone !== (c.whatsapp || null);
    const needsSms = state.requireVerification && phone && !(changed === false && c.phone_verified);
    if (needsSms) {
      const { error } = await sb.auth.updateUser({ phone: '+' + phone });
      if (error) return toast(error.message, 'error', error);
      otpBox.innerHTML = `
        <div class="notice">
          <label>Digite o código enviado por SMS para ${fmtPhone(phone)}
            <input name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8">
          </label>
          <button type="button" class="btn primary" id="verify">Confirmar código</button>
        </div>`;
      document.getElementById('verify').onclick = async () => {
        const token = otpBox.querySelector('input').value.trim();
        const { error } = await sb.auth.verifyOtp({ phone: '+' + phone, token, type: 'phone_change' });
        if (error) return toast('Código inválido ou expirado.', 'error');
        toast('Telefone verificado!');
        finish();
      };
      return;
    }
    if (changed) {
      const p2 = await sb.from('contacts').update({ whatsapp: phone }).eq('user_id', state.user.id);
      if (p2.error) return toast(p2.error.message, 'error', p2.error);
    }
    toast('Perfil salvo.');
    finish();
  });

  mountReminders(document.getElementById('reminders'));

  document.getElementById('logout').onclick = async () => {
    await disableReminders(sb).catch(() => {}); // os avisos desta conta não ficam chegando no aparelho
    await sb.auth.signOut();
    navigate('/');
  };

  document.getElementById('delete-account').onclick = async (e) => {
    if (document.getElementById('delete-confirm').value.trim().toUpperCase() !== 'EXCLUIR') {
      return toast('Digite EXCLUIR para confirmar.', 'error');
    }
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Excluindo…';
    try {
      // Fotos primeiro (o Storage não deixa apagar pelo banco), depois a conta e tudo ligado a ela.
      const bucket = sb.storage.from('photos');
      for (let round = 0; round < 50; round++) {
        const { data: files, error } = await bucket.list(state.user.id, { limit: 100 });
        if (error) throw error;
        if (!files.length) break;
        const { data: removed, error: rmError } = await bucket.remove(files.map((f) => `${state.user.id}/${f.name}`));
        if (rmError) throw rmError;
        if (!removed?.length) throw new Error('as fotos não puderam ser apagadas.');
      }
      await disableReminders(sb).catch(() => {});
      const { error } = await sb.rpc('delete_my_account');
      if (error) throw error;
      await sb.auth.signOut({ scope: 'local' });
      toast('Sua conta foi excluída.');
      navigate('/');
    } catch (err) {
      toast(`Não foi possível excluir a conta: ${err.message}`, 'error', err);
      btn.disabled = false;
      btn.textContent = 'Excluir minha conta para sempre';
    }
  };
}

// ---------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------
async function boot() {
  initMonitoring(CONFIG.SENTRY_DSN);
  document.getElementById('app-name').textContent = CONFIG.APP_NAME;
  if (!configured) {
    $view.innerHTML = `
      <div class="empty">
        <h2>Falta configurar o Supabase</h2>
        <p>Edite <code>js/config.js</code> com a URL e a chave anon do seu projeto, e rode <code>supabase/schema.sql</code> no SQL Editor. Veja o README.</p>
      </div>`;
    return;
  }

  // O retorno do login pode vir na busca (?code=, ?error=) ou, em links antigos e vencidos, no hash
  // (#access_token=, #error=), que o roteador confundiria com uma página.
  const search = new URLSearchParams(location.search);
  const authHash = /^#(access_token|error)=/.test(location.hash) ? new URLSearchParams(location.hash.slice(1)) : null;
  const authError = search.get('error_description') ?? authHash?.get('error_description');
  const { data } = await sb.auth.getSession();
  if (location.search || authHash) history.replaceState(null, '', location.pathname + (authHash ? '#/' : location.hash));
  if (authHash?.get('error_code') === 'otp_expired') toast('Esse link já foi usado ou venceu. Peça outro na tela de Entrar.', 'error');
  else if (authError) toast(authError, 'error');
  else if (search.has('code') && !data.session) toast('Não deu para entrar com esse link. Abra-o no mesmo aparelho e navegador em que você pediu, ou peça outro.', 'error');

  const [, rv] = await Promise.all([setUser(data.session?.user ?? null), sb.rpc('require_phone_verification')]);
  state.requireVerification = !!rv.data;

  sb.auth.onAuthStateChange((event, session) => {
    if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return;
    if ((session?.user?.id ?? null) === (state.user?.id ?? null) && event !== 'USER_UPDATED') return;
    // Evita chamar o Supabase dentro do callback de autenticação.
    setTimeout(async () => {
      await setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') render();
    }, 0);
  });

  const next = sessionStorage.getItem('next');
  if (data.session && next && (location.hash === '' || location.hash === '#/' || location.hash.startsWith('#/entrar'))) {
    sessionStorage.removeItem('next');
    history.replaceState(null, '', location.pathname + '#' + next);
  }

  window.addEventListener('hashchange', render);
  render();
}

// Botão sol/lua do cabeçalho: alterna entre modo claro e escuro e lembra a escolha.
const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme || (darkQuery.matches ? 'dark' : 'light')) === 'dark';

function updateThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  const label = isDark() ? 'Mudar para modo claro' : 'Mudar para modo escuro';
  btn.innerHTML = isDark() ? SUN : MOON;
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const theme = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('tema', theme); } catch {}
  updateThemeToggle();
});
darkQuery.addEventListener('change', updateThemeToggle);
updateThemeToggle();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
