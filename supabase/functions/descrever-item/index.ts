// Descreve a foto de um item com o Gemini: título, descrição, categoria e preço sugerido.
// Publicada pelo workflow .github/workflows/funcoes.yml. A chave GEMINI_API_KEY fica só nos
// segredos desta função; o site nunca a vê. Só atende quem está logado, com limite por conta
// (função ai_take_quota, em supabase/006_descricao_e_ia.sql).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGINS = ['https://garagesalebsb.github.io', 'http://localhost:8000', 'http://localhost:4173'];
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
const MAX_IMAGE = 1_500_000; // base64 de uma foto já reduzida no celular (~1 MB)

const cors = (req: Request) => ({
  'Access-Control-Allow-Origin': ORIGINS.includes(req.headers.get('Origin') ?? '') ? req.headers.get('Origin')! : ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const PROMPT = (categories: Record<string, string>) => `Você ajuda pessoas a anunciar itens usados numa venda de garagem em Brasília.
Olhe a foto e responda em português do Brasil:
- titulo: curto, como num anúncio (até 60 caracteres). Ex.: "Sofá 3 lugares cinza", "Bicicleta aro 26 Caloi".
- descricao: 1 ou 2 frases objetivas com o que dá para ver: o que é, cor, material, marca visível e estado aparente.
  Não invente medidas, defeitos, voltagem ou detalhes que não aparecem na foto.
- categoria: a chave que melhor se encaixa, entre: ${Object.entries(categories).map(([k, v]) => `${k} (${v})`).join(', ')}.
- preco_sugerido: preço justo em reais para vender usado numa venda de garagem, ou null se não der para estimar.
Se houver vários objetos, descreva o principal (ou o conjunto, se for um lote, como "Lote de livros infantis").`;

Deno.serve(async (req) => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });

  // Quem está chamando: a sessão do usuário no site.
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return reply(401, { error: 'Entre na sua conta para usar a descrição automática.' });

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return reply(503, { error: 'A descrição automática não está configurada.' });

  let body: { image?: string; categories?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Pedido inválido.' });
  }
  const image = String(body.image ?? '');
  const categories = body.categories ?? {};
  const keys = Object.keys(categories);
  if (!image || image.length > MAX_IMAGE || !/^[A-Za-z0-9+/=]+$/.test(image)) return reply(400, { error: 'Foto inválida ou grande demais.' });
  if (!keys.length || keys.length > 30 || keys.some((k) => !/^[a-z_]{2,30}$/.test(k) || String(categories[k]).length > 40)) {
    return reply(400, { error: 'Categorias inválidas.' });
  }

  const quota = await sb.rpc('ai_take_quota');
  if (quota.error) return reply(429, { error: quota.error.message });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: image } }, { text: PROMPT(categories) }] }],
      generation_config: {
        temperature: 0.3,
        response_mime_type: 'application/json',
        response_schema: {
          type: 'OBJECT',
          properties: {
            titulo: { type: 'STRING' },
            descricao: { type: 'STRING' },
            categoria: { type: 'STRING', enum: keys },
            preco_sugerido: { type: 'NUMBER', nullable: true },
          },
          required: ['titulo', 'descricao', 'categoria'],
        },
      },
    }),
  });
  if (!res.ok) {
    console.error('Gemini', res.status, (await res.text()).slice(0, 500));
    return reply(502, { error: res.status === 429 ? 'A IA está ocupada agora. Tente de novo em instantes.' : 'A IA não conseguiu analisar a foto.' });
  }

  try {
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
    const out = JSON.parse(text);
    const price = Number(out.preco_sugerido);
    return reply(200, {
      title: String(out.titulo ?? '').trim().slice(0, 120),
      description: String(out.descricao ?? '').trim().slice(0, 1000),
      category: keys.includes(out.categoria) ? out.categoria : keys.includes('outros') ? 'outros' : keys[0],
      price: Number.isFinite(price) && price >= 0 ? Math.round(price) : null,
    });
  } catch (err) {
    console.error('Resposta da IA', err);
    return reply(502, { error: 'A IA não conseguiu analisar a foto.' });
  }
});
