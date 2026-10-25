// Notificação no celular quando chega mensagem no chat.
// O banco chama esta função quando uma mensagem é gravada (gatilho messages_push) e ela avisa
// os aparelhos da outra pessoa da conversa. Usa os mesmos segredos dos lembretes
// (VAPID_PRIVATE_KEY e REMINDERS_SECRET), gravados aqui pelo workflow funcoes.yml.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGINS = ['https://garagesalebsb.github.io', 'http://localhost:8000', 'http://localhost:4173'];
const SITE_URL = 'https://garagesalebsb.github.io/desapego-brasilia';
const VAPID_PUBLIC_KEY = 'BPCCGwRTzsUQVKTms2XJiZQ5UxAe3Mhd3SUiBhRJ2VoSW8rQAbrbZ9VSN8MrWPgKsvrTeol4KrfrxXXApCvbjwk';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cors = (req: Request) => ({
  'Access-Control-Allow-Origin': ORIGINS.includes(req.headers.get('Origin') ?? '') ? req.headers.get('Origin')! : ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-push-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

type Target = { endpoint: string; p256dh: string; auth: string; conversation_id?: string; item_title?: string; sender_name?: string; body?: string };

Deno.serve(async (req) => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });

  const secret = Deno.env.get('REMINDERS_SECRET');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!secret || !privateKey) return reply(503, { error: 'Notificações não configuradas.' });
  webpush.setVapidDetails(SITE_URL, VAPID_PUBLIC_KEY, privateKey);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey') ?? '';
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: secret, ...args }),
    });
    if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
    return res.json();
  };

  let body: { message_id?: string; hook_message_id?: string; test_user?: string };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Pedido inválido.' });
  }

  const chatPayload = (t: Target) => ({
    title: `${t.sender_name} · ${t.item_title}`,
    body: t.body ?? '',
    url: `${SITE_URL}/#/chat/${t.conversation_id}`,
    tag: `chat-${t.conversation_id}`, // várias mensagens da mesma conversa viram um aviso só
  });

  let targets: Target[];
  let payload: (t: Target) => Record<string, string>;
  if (req.headers.get('x-push-secret') === secret && UUID.test(body.test_user ?? '')) {
    // Teste do administrador (com a senha): avisa todos os aparelhos de uma conta.
    targets = await rpc('push_targets_for_user', { p_user: body.test_user });
    payload = () => ({ title: 'Teste do chat', body: 'As notificações de mensagens estão funcionando.', url: `${SITE_URL}/#/chat`, tag: 'teste-chat' });
  } else if (UUID.test(body.hook_message_id ?? '')) {
    // Chamada do próprio banco (gatilho em messages, supabase/010_chat_escala.sql). Sem login:
    // só avisa mensagens com menos de 5 minutos e ainda não avisadas, então repetir não gera aviso extra.
    targets = await rpc('message_push_targets', { p_message: body.hook_message_id });
    payload = chatPayload;
  } else {
    // Versões antigas do app ainda chamam daqui depois de enviar.
    if (!UUID.test(body.message_id ?? '')) return reply(400, { error: 'Mensagem inválida.' });
    const sb = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return reply(401, { error: 'Entre na sua conta.' });
    targets = await rpc('message_push_targets', { p_message: body.message_id, p_sender: user.id });
    payload = chatPayload;
  }

  let sent = 0;
  let gone = 0;
  let failed = 0;
  await Promise.all(targets.map(async (t) => {
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, JSON.stringify(payload(t)), { TTL: 24 * 3600, urgency: 'high' });
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await rpc('forget_push_subscription', { p_endpoint: t.endpoint }).catch(() => {});
        gone++;
      } else {
        failed++;
        console.error('push', status, (err as Error).message);
      }
    }
  }));
  return reply(200, { sent, gone, failed });
});
