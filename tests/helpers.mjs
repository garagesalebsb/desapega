import { readFileSync } from 'node:fs';

// Lê a URL e a chave pública direto do js/config.js, para os testes usarem o mesmo projeto do site.
const config = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
const pick = (key) => config.match(new RegExp(`${key}:\\s*'([^']+)'`))?.[1];

export const SUPABASE_URL = pick('SUPABASE_URL');
export const ANON_KEY = pick('SUPABASE_ANON_KEY');
export const headers = { apikey: ANON_KEY, 'Content-Type': 'application/json' };

export const rest = (path) => `${SUPABASE_URL}/rest/v1/${path}`;

// Uma venda real publicada (ou null), para testar a página pública da venda.
export async function firstSale(request) {
  const today = new Date().toISOString().slice(0, 10);
  const res = await request.get(rest(`sales?select=id,title,lat,lng&hidden=eq.false&ends_on=gte.${today}&limit=1`), { headers });
  const rows = await res.json();
  return rows[0] ?? null;
}
