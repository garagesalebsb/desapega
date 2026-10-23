import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { CONFIG } from './config.js';
import { REGIONS, DF_CENTER, regionByName, SALE_TYPES, CATEGORIES, REPORT_REASONS } from './data.js';
import { maybeSuggestInstall } from './install.js';
import { PIX_TYPES, guessPixType, normalizePixKey, formatPixKey, pixPayload, qrSvg } from './pix.js';

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

function fmtDay(s) {
  const d = parseDate(s);
  const t = today();
  if (s === t) return 'Hoje';
  if (s === isoDate(addDays(new Date(), 1))) return 'Amanhã';
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
}
const fmtTime = (t) => (t ? t.slice(0, 5).replace(':00', 'h').replace(':', 'h') : '');
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
function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), kind === 'error' ? 9000 : 3500);
}

const navigate = (path) => (location.hash = '#' + path);
const saleUrl = (id) => `${BASE_URL}v/${id}/`;

function openModal(html, className = '') {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal ${className}" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) close();
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
function makeMap(el, center, zoom, opts = {}) {
  const map = L.map(el, { scrollWheelZoom: false, ...opts }).setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);
  cleanup.push(() => map.remove());
  setTimeout(() => map.invalidateSize(), 50);
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
  if (user) {
    const [p, c, f] = await Promise.all([
      sb.from('profiles').select('id,name').eq('id', user.id).maybeSingle(),
      sb.from('contacts').select('whatsapp,phone_verified,pix_key,pix_name').eq('user_id', user.id).maybeSingle(),
      sb.from('favorites').select('sale_id').eq('user_id', user.id),
    ]);
    state.profile = p.data;
    state.contact = c.data;
    state.favorites = new Set((f.data || []).map((r) => r.sale_id));
  }
  updateHeader();
}

function updateHeader() {
  const link = document.getElementById('account-link');
  if (state.user) {
    link.textContent = state.profile?.name?.split(' ')[0] || 'Perfil';
    link.href = '#/perfil';
  } else {
    link.textContent = 'Entrar';
    link.href = '#/entrar';
  }
}

function requireLogin(next, msg = 'Entre para continuar.') {
  if (state.user) return true;
  sessionStorage.setItem('next', next);
  navigate('/entrar?msg=' + encodeURIComponent(msg));
  return false;
}

function canPublish() {
  return !!state.contact?.whatsapp && (state.contact.phone_verified || !state.requireVerification);
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
  [/^\/minhas$/, viewMine],
  [/^\/entrar$/, viewLogin],
  [/^\/perfil$/, viewProfile],
];

let renderId = 0;
async function render() {
  cleanup.forEach((fn) => fn());
  cleanup = [];
  const id = ++renderId;
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === path));
  const ctx = { params, path, alive: () => id === renderId };
  for (const [re, view] of routes) {
    const m = path.match(re);
    if (!m) continue;
    window.scrollTo(0, 0);
    try {
      await view(ctx, ...m.slice(1));
    } catch (e) {
      console.error(e);
      if (ctx.alive()) $view.innerHTML = `<div class="empty"><h2>Algo deu errado</h2><p>${esc(e.message)}</p><a class="btn" href="#/">Voltar ao início</a></div>`;
    }
    return;
  }
  $view.innerHTML = `<div class="empty"><h2>Página não encontrada</h2><a class="btn" href="#/">Voltar ao início</a></div>`;
}

// ---------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------
function saleCard(s) {
  const t = SALE_TYPES[s.type];
  const n = s.items?.[0]?.count ?? 0;
  const fav = state.favorites.has(s.id);
  return `
    <a class="sale-card ${s.type === 'mudanca' ? 'highlight' : ''}" href="#/venda/${s.id}">
      <div class="thumb type-bg-${s.type}" ${s.cover_url ? `style="background-image:url('${esc(s.cover_url)}')"` : ''}>
        ${s.cover_url ? '' : icon.tag}
        ${fav ? `<span class="fav-dot" title="Favorita">${icon.heart}</span>` : ''}
      </div>
      <div class="body">
        <span class="badge type-${s.type}">${t.label}</span>
        <h3>${esc(s.title)}</h3>
        <p class="meta">${icon.clock}${fmtWhen(s)}</p>
        <p class="meta">${icon.pin}${esc(s.region)}${n ? ` · ${n} ${n === 1 ? 'item' : 'itens'}` : ''}</p>
      </div>
    </a>`;
}

const MAX_PHOTOS = 6;
const itemPhotos = (it) => (it.photos?.length ? it.photos : it.photo_url ? [it.photo_url] : []);

function itemPhoto(it) {
  const photos = itemPhotos(it);
  return photos.length
    ? `<img src="${esc(photos[0])}" alt="" loading="lazy">${photos.length > 1 ? `<span class="photo-count">${icon.camera}${photos.length}</span>` : ''}`
    : `<div class="noimg">${icon.tag}</div>`;
}

// Apaga do Storage fotos do próprio usuário que deixaram de ser usadas (melhor esforço).
function removeStoredPhotos(urls) {
  const marker = '/object/public/photos/';
  const paths = urls
    .map((u) => (u && u.includes(marker) ? decodeURIComponent(u.split(marker)[1]) : null))
    .filter((p) => p && p.startsWith(`${state.user.id}/`));
  if (paths.length) sb.storage.from('photos').remove(paths).catch(() => {});
}

const STATUS_LABEL = { disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido' };

// ---------------------------------------------------------------------
// Início: vendas do fim de semana (mapa + lista)
// ---------------------------------------------------------------------
const SALE_LIST_FIELDS = 'id,title,type,region,lat,lng,starts_on,ends_on,start_time,end_time,cover_url,items(count)';

async function viewHome(ctx) {
  const p = ctx.params;
  const when = p.get('quando') || 'fds';
  let region = p.has('regiao') ? p.get('regiao') : localStorage.getItem('regiao') || '';
  const type = p.get('tipo') || '';

  const link = (changes) => {
    const q = new URLSearchParams({ quando: when, regiao: region, tipo: type, ...changes });
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
        <a href="${link({ tipo: '' })}" class="chip ${!type ? 'on' : ''}">Todas</a>
        ${Object.entries(SALE_TYPES)
          .map(([k, t]) => `<a href="${link({ tipo: k })}" class="chip chip-${k} ${type === k ? 'on' : ''}">${t.short}</a>`)
          .join('')}
      </div>
    </div>
    <div class="home-grid">
      <div id="home-map" class="map"></div>
      <div id="home-list"><div class="loading">Carregando vendas…</div></div>
    </div>`;

  document.getElementById('f-region').addEventListener('change', (e) => {
    localStorage.setItem('regiao', e.target.value);
    location.hash = link({ regiao: e.target.value });
  });

  let q = sb
    .from('sales')
    .select(SALE_LIST_FIELDS)
    .eq('hidden', false)
    .gte('ends_on', today())
    .order('starts_on')
    .order('start_time')
    .limit(200);
  if (when === 'fds') q = q.lte('starts_on', isoDate(thisSunday()));
  if (region) q = q.eq('region', region);
  if (type) q = q.eq('type', type);
  const { data: sales, error } = await q;
  if (!ctx.alive()) return;
  if (error) throw error;

  const r = regionByName(region);
  const map = makeMap('home-map', r ? [r.lat, r.lng] : DF_CENTER, r ? 14 : 11);
  const bounds = [];
  for (const s of sales) {
    L.marker([s.lat, s.lng], { icon: pinIcon(s.type) })
      .addTo(map)
      .bindPopup(`<a href="#/venda/${s.id}"><strong>${esc(s.title)}</strong></a><br>${fmtWhen(s)}`);
    bounds.push([s.lat, s.lng]);
  }
  if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  else if (bounds.length === 1) map.setView(bounds[0], 15);

  const list = document.getElementById('home-list');
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

  const mudancas = !type ? sales.filter((s) => s.type === 'mudanca') : [];
  list.innerHTML = `
    ${mudancas.length ? `
      <h2 class="section-title">Em destaque: vendas de mudança</h2>
      <p class="hint">Quem se muda vende quase tudo, e rápido.</p>
      <div class="cards strip">${mudancas.map(saleCard).join('')}</div>
      <h2 class="section-title">Todas as vendas</h2>` : ''}
    <div class="cards">${sales.map(saleCard).join('')}</div>`;
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
  out.innerHTML = '<div class="loading">Buscando…</div>';

  let iq = sb
    .from('items')
    .select('id,title,price,category,photo_url,photos,status,sales!inner(id,title,region,starts_on,ends_on,start_time,end_time,hidden)')
    .gte('sales.ends_on', today())
    .eq('sales.hidden', false)
    .neq('status', 'vendido')
    .order('created_at', { ascending: false })
    .limit(60);
  if (safe) iq = iq.ilike('title', `%${safe}%`);
  if (cat) iq = iq.eq('category', cat);

  const sq = safe
    ? sb
        .from('sales')
        .select(SALE_LIST_FIELDS)
        .eq('hidden', false)
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
              <strong>${brl(it.price)}</strong>
              <span class="title">${esc(it.title)}</span>
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
  $view.innerHTML = '<div class="loading">Carregando venda…</div>';
  const { data: sale, error } = await sb
    .from('sales')
    .select('*, owner:profiles!sales_owner_id_fkey(id,name), items(*)')
    .eq('id', id)
    .maybeSingle();
  if (!ctx.alive()) return;
  if (error) throw error;
  if (!sale) {
    $view.innerHTML = `<div class="empty"><h2>Venda não encontrada</h2><p>Ela pode ter sido removida pelo vendedor.</p><a class="btn" href="#/">Ver outras vendas</a></div>`;
    return;
  }

  const isOwner = state.user?.id === sale.owner_id;
  const ended = sale.ends_on < today();
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
        <span class="badge type-${sale.type}">${t.label}</span>
        ${ended ? '<span class="badge muted">Encerrada</span>' : ''}
        ${sale.hidden ? '<span class="badge danger">Oculta pela moderação</span>' : ''}
        <h1>${esc(sale.title)}</h1>
        <p class="meta big">${icon.clock}${fmtWhen(sale)}</p>
        <p class="meta big">${icon.pin}${esc(sale.region)}${sale.address ? ` · ${esc(sale.address)}` : ''}</p>
        ${sale.reference ? `<p class="reference">Referência: ${esc(sale.reference)}</p>` : ''}
        <p class="meta">Por ${esc(sale.owner?.name || 'vendedor')}</p>
      </div>

      <div class="actions">
        ${isOwner ? '' : `<button class="btn whatsapp" data-act="contact">${icon.whatsapp}Falar no WhatsApp</button>`}
        <a class="btn" href="${links.google}" target="_blank" rel="noopener">Rota no Google Maps</a>
        <a class="btn" href="${links.waze}" target="_blank" rel="noopener">Rota no Waze</a>
        <button class="btn" data-act="share">${icon.share}Compartilhar</button>
        ${isOwner ? '' : `<button class="btn fav ${state.favorites.has(sale.id) ? 'on' : ''}" data-act="fav">${icon.heart}<span>${state.favorites.has(sale.id) ? 'Salva' : 'Salvar'}</span></button>`}
      </div>

      ${isOwner ? `
        <div class="owner-bar">
          <strong>Esta venda é sua.</strong>
          <a class="btn small" href="#/venda/${sale.id}/editar">Editar venda</a>
          <button class="btn small danger" data-act="delete-sale">Excluir</button>
        </div>` : ''}

      ${sale.description ? `<p class="description">${esc(sale.description).replace(/\n/g, '<br>')}</p>` : ''}
      <div id="sale-map" class="map small"></div>

      ${isOwner ? `
        <section class="quick-add">
          <h2>Cadastrar itens</h2>
          ${ctx.params.has('novo') ? '<p class="hint">Venda criada! Agora fotografe e cadastre os itens. Depois é só compartilhar o link.</p>' : ''}
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
              <button class="btn primary">Salvar e adicionar outro</button>
            </div>
          </form>
        </section>` : ''}

      <section>
        <h2 class="section-title" id="items-title"></h2>
        <div id="items" class="items-grid"></div>
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
  const buyerItemActions = (it) =>
    it.status === 'disponivel' && !ended
      ? `<button class="btn small whatsapp" data-act="interest">${icon.whatsapp}Tenho interesse</button>
         ${hasPix && Number(it.price) > 0 ? `<button class="btn small pix" data-act="pix">${icon.pix}Pagar com Pix</button>` : ''}`
      : '';

  const renderItems = () => {
    const avail = sale.items.filter((i) => i.status === 'disponivel').length;
    document.getElementById('items-title').textContent = sale.items.length
      ? `Itens (${avail} disponíve${avail === 1 ? 'l' : 'is'} de ${sale.items.length})`
      : isOwner ? 'Nenhum item cadastrado ainda' : 'O vendedor ainda não cadastrou itens';
    document.getElementById('items').innerHTML = sale.items
      .map(
        (it) => `
        <div class="item status-${it.status}" data-id="${it.id}">
          <button class="photo" data-act="view-item" aria-label="Ver fotos de ${esc(it.title)}">${itemPhoto(it)}${it.status !== 'disponivel' ? `<span class="status-tag">${STATUS_LABEL[it.status]}</span>` : ''}</button>
          <div class="info">
            <strong>${brl(it.price)}</strong>
            <span class="title">${esc(it.title)}</span>
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

  const openWhatsApp = async (text) => {
    if (!requireLogin(`/venda/${sale.id}`, 'Entre para falar com o vendedor.')) return;
    const { data: phone, error } = await sb.rpc('get_sale_whatsapp', { p_sale: sale.id });
    if (error || !phone) return toast('Não foi possível obter o contato do vendedor.', 'error');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const handleItemAction = async (act, item) => {
    if (act === 'interest') {
      openWhatsApp(`Olá! Tenho interesse no item "${item.title}" (${brl(item.price)}) da sua venda "${sale.title}". Ainda está disponível?`);
    } else if (act === 'pix') {
      if (!requireLogin(`/venda/${sale.id}`, 'Entre para pagar com Pix.')) return;
      openPix(sale, item, openWhatsApp);
    } else if (act === 'edit-item') {
      openItemEditor(sale, item, () => {
        sortItems();
        renderItems();
      });
    } else if (act === 'delete-item') {
      if (!confirm(`Remover "${item.title}"?`)) return;
      const { error } = await sb.from('items').delete().eq('id', item.id);
      if (error) return toast(error.message, 'error');
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
      if (on) maybeSuggestInstall('favorite');
    } else if (act === 'status') {
      const prev = item.status;
      item.status = btn.dataset.status;
      sortItems();
      renderItems();
      const { error } = await sb.from('items').update({ status: item.status }).eq('id', item.id);
      if (error) {
        item.status = prev;
        sortItems();
        renderItems();
        toast('Não foi possível atualizar o item.', 'error');
      }
    } else if (act === 'view-item') {
      openItemViewer(sale, item, { isOwner, ended, hasPix, onAction: (a) => handleItemAction(a, item) });
    } else if (['edit-item', 'pix', 'delete-item'].includes(act)) {
      handleItemAction(act, item);
    } else if (act === 'delete-sale') {
      if (!confirm('Excluir esta venda e todos os itens? Isso não pode ser desfeito.')) return;
      const { error } = await sb.from('sales').delete().eq('id', sale.id);
      if (error) return toast(error.message, 'error');
      removeStoredPhotos([sale.cover_url, ...sale.items.flatMap(itemPhotos)]);
      toast('Venda excluída.');
      navigate('/minhas');
    } else if (act === 'report-sale' || act === 'report-user') {
      if (!requireLogin(`/venda/${sale.id}`, 'Entre para enviar uma denúncia.')) return;
      openReport(act === 'report-sale' ? { sale_id: sale.id } : { sale_id: sale.id, reported_user_id: sale.owner_id }, act === 'report-sale' ? 'anúncio' : 'vendedor');
    }
  };
  cleanup.push(() => ($view.onclick = null));

  if (isOwner) setupItemForm(sale, renderItems, sortItems);
  else maybeSuggestInstall('view-sale');
}

function setupItemForm(sale, renderItems, sortItems) {
  const form = document.getElementById('item-form');
  const fileInput = form.photo;
  const preview = form.querySelector('.photo-pick img');
  const ph = form.querySelector('.photo-pick .ph');
  const count = form.querySelector('.photo-pick .photo-count');
  let lastCategory = localStorage.getItem('ultima-categoria') || 'outros';
  form.category.value = lastCategory;
  let files = [];

  fileInput.addEventListener('change', () => {
    files = [...fileInput.files].slice(0, MAX_PHOTOS);
    if (fileInput.files.length > MAX_PHOTOS) toast(`Até ${MAX_PHOTOS} fotos por item. Usei as primeiras ${MAX_PHOTOS}.`);
    count.hidden = files.length < 2;
    count.textContent = `+${files.length - 1}`;
    if (files[0]) previewPhoto(files[0], preview, ph);
    files.slice(1).forEach((f) => isHeic(f) && convertHeic(f)); // adianta a conversão
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
        category: form.category.value,
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
      files = [];
      form.category.value = row.category;
      preview.hidden = true;
      count.hidden = true;
      ph.hidden = false;
      form.title.focus();
      toast('Item salvo!');
    } catch (err) {
      toast(err.message || 'Erro ao salvar o item.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar e adicionar outro';
    }
  });
}

// Fotos do item em tela cheia, com as ações de compra.
function openItemViewer(sale, item, { isOwner, ended, hasPix, onAction }) {
  const photos = itemPhotos(item);
  const canBuy = !isOwner && item.status === 'disponivel' && !ended;
  const { el, close } = openModal(`
    ${photos.length ? `
      <div class="gallery">${photos.map((u) => `<img src="${esc(u)}" alt="">`).join('')}</div>
      ${photos.length > 1 ? `<div class="dots">${photos.map((_, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join('')}</div>` : ''}` : ''}
    <div>
      <strong class="price">${brl(item.price)}</strong>
      <h2>${esc(item.title)}</h2>
      <p class="meta">${CATEGORIES[item.category] || ''}${item.status !== 'disponivel' ? ` · ${STATUS_LABEL[item.status]}` : ''}</p>
    </div>
    <div class="actions">
      ${canBuy ? `<button class="btn whatsapp" data-a="interest">${icon.whatsapp}Tenho interesse</button>` : ''}
      ${canBuy && hasPix && Number(item.price) > 0 ? `<button class="btn pix" data-a="pix">${icon.pix}Pagar com Pix</button>` : ''}
      ${isOwner ? '<button class="btn" data-a="edit-item">Editar item</button>' : ''}
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
        category: form.category.value,
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
      toast(err.message || 'Erro ao salvar o item.', 'error');
      btn.disabled = false;
      btn.textContent = 'Salvar';
    }
  });
}

async function openPix(sale, item, openWhatsApp) {
  const { data, error } = await sb.rpc('get_sale_pix', { p_sale: sale.id });
  const pix = data?.[0];
  if (error || !pix) return toast('O vendedor não informou uma chave Pix.', 'error');
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
      <button class="btn whatsapp" data-paid>${icon.whatsapp}Avisar o vendedor que paguei</button>
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
  el.querySelector('[data-paid]').onclick = () => {
    close();
    openWhatsApp(`Olá! Fiz o Pix de ${brl(item.price)} pelo item "${item.title}" da sua venda "${sale.title}". Podemos combinar a retirada?`);
  };
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
    if (error) return toast(error.message, 'error');
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

async function resizeImage(file, max = 1280, quality = 0.8) {
  const img = await loadImage(file);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
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
    blob = file;
  }
  const type = blob.type || 'image/jpeg';
  const path = `${state.user.id}/${crypto.randomUUID()}.${UPLOAD_TYPES[type] || 'jpg'}`;
  const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: type, cacheControl: '31536000' });
  if (error) throw new Error(`Erro ao enviar a foto: ${error.message}`);
  return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------------
// Criar / editar venda
// ---------------------------------------------------------------------
async function viewSaleForm(ctx, id) {
  if (!requireLogin(ctx.path, 'Entre para anunciar uma venda. É grátis.')) return;
  if (!canPublish()) {
    sessionStorage.setItem('next', ctx.path);
    navigate('/perfil?msg=' + encodeURIComponent(
      state.requireVerification
        ? 'Para anunciar, confirme seu telefone por SMS. Ele será o WhatsApp de contato.'
        : 'Para anunciar, informe o WhatsApp onde os compradores vão falar com você.',
    ));
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

      <div class="row">
        <label>Data de início<input type="date" name="starts_on" required value="${v.starts_on}" min="${sale ? '' : today()}"></label>
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

      <button class="btn primary big">${sale ? 'Salvar alterações' : 'Publicar e cadastrar itens'}</button>
    </form>`;

  const form = document.getElementById('sale-form');
  const startRegion = regionByName(v.region) || REGIONS[0];
  let pos = sale ? [sale.lat, sale.lng] : [startRegion.lat, startRegion.lng];
  let pinMoved = !!sale;

  const map = makeMap('form-map', pos, sale ? 17 : 15, { scrollWheelZoom: true });
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
    if (form.ends_on.value < form.starts_on.value) return toast('O último dia não pode ser antes do início.', 'error');
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
      };
      const res = sale
        ? await sb.from('sales').update(row).eq('id', sale.id).select('id').single()
        : await sb.from('sales').insert(row).select('id').single();
      if (res.error) throw new Error(`Erro ao salvar a venda: ${res.error.message}`);
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
      if (coverError) toast(`Venda salva, mas a foto de capa falhou. ${coverError.message}`, 'error');
      else toast(sale ? 'Venda atualizada.' : 'Venda publicada!');
      navigate(`/venda/${res.data.id}${sale ? '' : '?novo=1'}`);
    } catch (err) {
      toast(err.message || 'Erro ao salvar.', 'error');
      btn.disabled = false;
      btn.textContent = sale ? 'Salvar alterações' : 'Publicar e cadastrar itens';
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
    <div id="mine"><div class="loading">Carregando…</div></div>`;

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
    ${upcoming.length ? `<h2 class="section-title">Próximas</h2><div class="cards">${upcoming.map(saleCard).join('')}</div>` : ''}
    ${past.length ? `<h2 class="section-title">Encerradas</h2><div class="cards past">${past.map(saleCard).join('')}</div>` : ''}`;
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
    if (error) toast(error.message, 'error');
  };
  document.getElementById('email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: BASE_URL } });
    btn.disabled = false;
    if (error) return toast(error.message, 'error');
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
      <label>WhatsApp com DDD
        <input name="whatsapp" type="tel" inputmode="tel" placeholder="(61) 99999-9999" value="${esc(fmtPhone(c.whatsapp))}">
      </label>
      <p class="hint">Só aparece para compradores logados, quando tocam em "Falar no WhatsApp".
        ${c.whatsapp ? (c.phone_verified ? '<span class="ok">Telefone verificado ✓</span>' : state.requireVerification ? '<span class="warn">Telefone ainda não verificado</span>' : '') : ''}</p>
      <div id="otp-box"></div>

      <fieldset class="pix-box">
        <legend>${icon.pix} Receber por Pix (opcional)</legend>
        <p class="hint">Com a chave cadastrada, cada item mostra um QR Code com o valor já preenchido. O dinheiro vai direto para a sua conta, sem taxas. A chave só aparece para compradores logados.</p>
        <div class="row">
          <label>Tipo de chave
            <select name="pix_type">
              ${Object.entries(PIX_TYPES).map(([k, v]) => `<option value="${k}" ${k === guessPixType(c.pix_key) ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </label>
          <label>Chave Pix
            <input name="pix_key" value="${esc(c.pix_key ? formatPixKey(c.pix_key) : '')}" autocomplete="off">
          </label>
        </div>
        <label>Nome do recebedor (como aparece no banco)
          <input name="pix_name" maxlength="25" value="${esc(c.pix_name || '')}" placeholder="${esc((state.profile?.name || '').slice(0, 25))}">
        </label>
      </fieldset>

      <button class="btn primary big">Salvar</button>
    </form>
    <div class="form">
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

    const pixRaw = form.pix_key.value.trim();
    const pix_key = pixRaw ? normalizePixKey(form.pix_type.value, pixRaw) : null;
    if (pixRaw && !pix_key) return toast(`Chave Pix inválida para o tipo "${PIX_TYPES[form.pix_type.value]}".`, 'error');
    const pix_name = pix_key ? form.pix_name.value.trim() || (form.name.value.trim().slice(0, 25)) : null;

    const p1 = await sb.from('profiles').update({ name: form.name.value.trim() }).eq('id', state.user.id);
    if (p1.error) return toast(p1.error.message, 'error');
    if (pix_key !== (c.pix_key || null) || pix_name !== (c.pix_name || null)) {
      const px = await sb.from('contacts').update({ pix_key, pix_name }).eq('user_id', state.user.id);
      if (px.error) return toast(`Erro ao salvar o Pix: ${px.error.message}`, 'error');
    }

    const changed = phone !== (c.whatsapp || null);
    const needsSms = state.requireVerification && phone && !(changed === false && c.phone_verified);
    if (needsSms) {
      const { error } = await sb.auth.updateUser({ phone: '+' + phone });
      if (error) return toast(error.message, 'error');
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
      if (p2.error) return toast(p2.error.message, 'error');
    }
    toast('Perfil salvo.');
    finish();
  });

  document.getElementById('logout').onclick = async () => {
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
      const { error } = await sb.rpc('delete_my_account');
      if (error) throw error;
      await sb.auth.signOut({ scope: 'local' });
      toast('Sua conta foi excluída.');
      navigate('/');
    } catch (err) {
      toast(`Não foi possível excluir a conta: ${err.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Excluir minha conta para sempre';
    }
  };
}

// ---------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------
async function boot() {
  document.getElementById('app-name').textContent = CONFIG.APP_NAME;
  if (!configured) {
    $view.innerHTML = `
      <div class="empty">
        <h2>Falta configurar o Supabase</h2>
        <p>Edite <code>js/config.js</code> com a URL e a chave anon do seu projeto, e rode <code>supabase/schema.sql</code> no SQL Editor. Veja o README.</p>
      </div>`;
    return;
  }

  const authError = new URLSearchParams(location.search).get('error_description');
  const { data } = await sb.auth.getSession();
  if (location.search) history.replaceState(null, '', location.pathname + location.hash);
  if (authError) toast(authError, 'error');

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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
