// Monta a pasta _site para o GitHub Pages e gera uma página leve por venda em v/<id>/
// com as tags Open Graph, para o link aparecer bonito no WhatsApp.
// Uso: SITE_URL=https://usuario.github.io/repositorio/ node scripts/build-site.mjs
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const OUT = '_site';
const STATIC = ['index.html', '404.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const p of STATIC) cpSync(p, `${OUT}/${p}`, { recursive: true });
writeFileSync(`${OUT}/.nojekyll`, '');

const config = readFileSync('js/config.js', 'utf8');
const pick = (key) => config.match(new RegExp(`${key}:\\s*'([^']+)'`))?.[1];
const SUPABASE_URL = pick('SUPABASE_URL');
const SUPABASE_ANON_KEY = pick('SUPABASE_ANON_KEY');
const APP_NAME = pick('APP_NAME') || 'Desapego Brasília';
const SITE_URL = (process.env.SITE_URL || '').replace(/\/?$/, '/');

if (!SUPABASE_URL || SUPABASE_URL.includes('SEU-PROJETO')) {
  console.log('Supabase ainda não configurado em js/config.js; pulando páginas de compartilhamento.');
  process.exit(0);
}

const TYPES = { garagem: 'Venda de garagem', mudanca: 'Venda de mudança', bazar: 'Bazar coletivo' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const day = (s) =>
  new Date(`${s}T12:00:00-03:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' }).replace(/\./g, '');
const time = (t) => t.slice(0, 5).replace(':00', 'h').replace(':', 'h');

// Vendas que terminaram há até 7 dias continuam com página (links antigos não quebram de imediato).
const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
const url =
  `${SUPABASE_URL}/rest/v1/sales?select=id,title,description,type,region,starts_on,ends_on,start_time,end_time,cover_url,items(photo_url)` +
  `&hidden=eq.false&ends_on=gte.${since}&order=starts_on&limit=2000`;
const res = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
if (!res.ok) {
  console.error('Falha ao ler vendas do Supabase:', res.status, await res.text());
  process.exit(0); // publica o site mesmo assim
}
const sales = await res.json();

for (const s of sales) {
  const when = s.starts_on === s.ends_on ? day(s.starts_on) : `${day(s.starts_on)} a ${day(s.ends_on)}`;
  const title = `${s.title} · ${TYPES[s.type]}`;
  const n = s.items.length;
  const desc = `${when}, ${time(s.start_time)}–${time(s.end_time)} · ${s.region}${n ? ` · ${n} ${n === 1 ? 'item' : 'itens'}` : ''}. ${s.description || ''}`.slice(0, 200);
  const image = s.cover_url || s.items.find((i) => i.photo_url)?.photo_url || `${SITE_URL}icons/og.png`;
  const target = `../../#/venda/${s.id}`;
  mkdirSync(`${OUT}/v/${s.id}`, { recursive: true });
  writeFileSync(
    `${OUT}/v/${s.id}/index.html`,
    `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${esc(APP_NAME)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(APP_NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(SITE_URL)}v/${s.id}/">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${target}">
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body><a href="${target}">Abrir a venda</a></body>
</html>
`,
  );
}
console.log(`Geradas ${sales.length} páginas de compartilhamento.`);
