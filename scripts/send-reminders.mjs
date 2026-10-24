// Envia os lembretes das vendas salvas: na véspera (kind=vespera) ou no dia (kind=hoje).
// Roda no GitHub Actions (.github/workflows/lembretes.yml). Precisa de:
//   VAPID_PRIVATE_KEY e REMINDERS_SECRET (segredos do GitHub), SITE_URL e KIND.
import { readFileSync } from 'node:fs';
import webpush from 'web-push';

const config = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
const pick = (key) => config.match(new RegExp(`${key}:\\s*'([^']+)'`))?.[1];
const SUPABASE_URL = pick('SUPABASE_URL');
const ANON_KEY = pick('SUPABASE_ANON_KEY');
const VAPID_PUBLIC_KEY = pick('VAPID_PUBLIC_KEY');

const { VAPID_PRIVATE_KEY, REMINDERS_SECRET, KIND } = process.env;
const SITE_URL = (process.env.SITE_URL || 'https://garagesalebsb.github.io/desapego-brasilia').replace(/\/$/, '');
if (!VAPID_PRIVATE_KEY || !REMINDERS_SECRET) throw new Error('Faltam os segredos VAPID_PRIVATE_KEY e REMINDERS_SECRET.');
if (!['vespera', 'hoje'].includes(KIND)) throw new Error(`KIND inválido: ${KIND}`);

webpush.setVapidDetails(SITE_URL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function rpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: REMINDERS_SECRET, ...body }),
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const hour = (t) => {
  const [h, m] = t.split(':');
  return `${Number(h)}h${m === '00' ? '' : m}`;
};

// Uma notificação por aparelho: com várias vendas no mesmo dia, junta tudo num aviso só.
function message(sales) {
  const when = KIND === 'vespera' ? 'Amanhã' : 'Hoje';
  if (sales.length === 1) {
    const s = sales[0];
    return {
      title: `${when}: ${s.title}`,
      body: `${s.region}, das ${hour(s.start_time)} às ${hour(s.end_time)}. Toque para ver os itens e a rota.`,
      url: `${SITE_URL}/#/venda/${s.sale_id}`,
      tag: `venda-${s.sale_id}`,
    };
  }
  const first = [...sales].sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  return {
    title: `${when}: ${sales.length} vendas que você salvou`,
    body: `${sales.map((s) => s.region).filter((r, i, all) => all.indexOf(r) === i).join(', ')}. A primeira abre às ${hour(first.start_time)}.`,
    url: `${SITE_URL}/#/minhas?aba=favoritas`,
    tag: `lembrete-${KIND}`,
  };
}

const rows = await rpc('claim_reminders', { p_kind: KIND });
const byDevice = new Map();
for (const r of rows) {
  if (!byDevice.has(r.endpoint)) byDevice.set(r.endpoint, { sub: { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, sales: [] });
  byDevice.get(r.endpoint).sales.push(r);
}

let sent = 0;
let gone = 0;
let failed = 0;
for (const { sub, sales } of byDevice.values()) {
  try {
    await webpush.sendNotification(sub, JSON.stringify(message(sales)), { TTL: 6 * 3600, urgency: 'normal' });
    sent++;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await rpc('forget_push_subscription', { p_endpoint: sub.endpoint });
      gone++;
    } else {
      failed++;
      console.error(`Falha ao enviar (${err.statusCode ?? 'sem status'}): ${err.body || err.message}`);
    }
  }
}
// Só números: nada de endereço de aparelho ou nome de venda no registro público do GitHub.
console.log(`Lembretes "${KIND}": ${rows.length} venda(s), ${sent} aparelho(s) avisado(s), ${gone} inscrição(ões) vencida(s), ${failed} falha(s).`);
if (failed && !sent) process.exit(1);
