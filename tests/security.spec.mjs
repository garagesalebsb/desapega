// Regras de segurança do banco, testadas como um visitante sem login (só leitura e tentativas bloqueadas).
// Se alguém afrouxar uma regra do Supabase por engano, a publicação para aqui.
import { test, expect } from '@playwright/test';
import { SUPABASE_URL, ANON_KEY, headers, rest, firstSale } from './helpers.mjs';

const UUID = '00000000-0000-0000-0000-000000000000';
const rpc = (request, fn, data = {}) => request.post(rest(`rpc/${fn}`), { headers, data });

test.describe('Banco: visitante sem login', () => {
  test('não lê contatos (WhatsApp e Pix)', async ({ request }) => {
    const res = await request.get(rest('contacts?select=*'), { headers });
    expect(res.ok()).toBe(false);
  });

  test('não vê favoritos, denúncias nem o registro de consultas', async ({ request }) => {
    for (const table of ['favorites', 'reports']) {
      expect(await (await request.get(rest(`${table}?select=*`), { headers })).json(), table).toEqual([]);
    }
    expect((await request.get(rest('contact_lookups?select=*'), { headers })).ok()).toBe(false);
  });

  test('não vê os aparelhos inscritos nem os lembretes, e não dispara envios sem a senha', async ({ request }) => {
    for (const table of ['push_subscriptions', 'reminders_sent']) {
      const res = await request.get(rest(`${table}?select=*`), { headers });
      if (res.ok()) expect(await res.json(), table).toEqual([]);
    }
    expect((await rpc(request, 'claim_reminders', { p_secret: 'errada', p_kind: 'vespera' })).ok()).toBe(false);
    expect((await rpc(request, 'forget_push_subscription', { p_secret: 'errada', p_endpoint: 'https://x' })).ok()).toBe(false);
    expect((await rpc(request, 'save_push_subscription', { p_endpoint: 'https://x', p_p256dh: 'a', p_auth: 'b' })).ok()).toBe(false);
    expect((await rpc(request, 'reminders_check_secret', { p_secret: 'errada' })).ok()).toBe(false);
  });

  test('não usa a IA nem vê o consumo dela', async ({ request }) => {
    expect((await rpc(request, 'ai_take_quota')).ok()).toBe(false);
    const usage = await request.get(rest('ai_usage?select=*'), { headers });
    if (usage.ok()) expect(await usage.json()).toEqual([]);
    const ai = await request.post(`${SUPABASE_URL}/functions/v1/descrever-item`, { headers, data: { image: 'AAAA', categories: { outros: 'Outros' } } });
    expect(ai.ok()).toBe(false);
  });

  test('não lê conversas nem mensagens, e não abre conversa sem login', async ({ request }) => {
    for (const table of ['conversations', 'messages']) {
      const res = await request.get(rest(`${table}?select=*`), { headers });
      if (res.ok()) expect(await res.json(), table).toEqual([]);
    }
    expect((await request.post(rest('messages'), { headers, data: { conversation_id: UUID, body: 'oi' } })).ok()).toBe(false);
    expect((await rpc(request, 'start_conversation', { p_item: UUID })).ok()).toBe(false);
    expect((await rpc(request, 'my_conversations')).ok()).toBe(false);
    expect((await rpc(request, 'chat_unread_count')).ok()).toBe(false);
  });

  test('não dispara notificação do chat nem lê aparelhos sem a senha', async ({ request }) => {
    expect((await rpc(request, 'message_push_targets', { p_secret: 'errada', p_message: UUID, p_sender: UUID })).ok()).toBe(false);
    expect((await rpc(request, 'push_targets_for_user', { p_secret: 'errada', p_user: UUID })).ok()).toBe(false);
    const push = await request.post(`${SUPABASE_URL}/functions/v1/enviar-push`, { headers, data: { message_id: UUID } });
    expect(push.ok()).toBe(false);
    const test = await request.post(`${SUPABASE_URL}/functions/v1/enviar-push`, { headers: { ...headers, 'x-push-secret': 'errada' }, data: { test_user: UUID } });
    expect(test.ok()).toBe(false);
  });

  test('não lê nem cria notificações', async ({ request }) => {
    const res = await request.get(rest('notifications?select=*'), { headers });
    if (res.ok()) expect(await res.json()).toEqual([]);
    const created = await request.post(rest('notifications'), { headers, data: { user_id: UUID, kind: 'venda_salva', sale_title: 'teste' } });
    expect(created.ok()).toBe(false);
  });

  test('não publica venda nem item', async ({ request }) => {
    const sale = await request.post(rest('sales'), {
      headers,
      data: { title: 'teste', type: 'garagem', region: 'SIA', lat: -15.8, lng: -47.9, starts_on: '2030-01-05', ends_on: '2030-01-05', start_time: '08:00', end_time: '12:00' },
    });
    expect(sale.ok()).toBe(false);
    const item = await request.post(rest('items'), { headers, data: { sale_id: UUID, title: 'teste' } });
    expect(item.ok()).toBe(false);
  });

  test('não recebe WhatsApp nem chave Pix do vendedor', async ({ request }) => {
    const sale = (await firstSale(request))?.id ?? UUID;
    expect(await (await rpc(request, 'get_sale_whatsapp', { p_sale: sale })).json()).toBeNull();
    expect(await (await rpc(request, 'get_sale_pix', { p_sale: sale })).json()).toEqual([]);
  });

  test('não chama funções internas nem exclui contas', async ({ request }) => {
    expect((await rpc(request, 'delete_my_account')).ok()).toBe(false);
    expect((await rpc(request, 'check_contact_limit', { p_sale: UUID })).ok()).toBe(false);
  });

  test('não envia fotos', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/storage/v1/object/photos/teste/t.jpg`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'image/jpeg' },
      data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    expect(res.ok()).toBe(false);
  });

  test('só vê o nome de quem tem venda publicada', async ({ request }) => {
    const profiles = await (await request.get(rest('profiles?select=id'), { headers })).json();
    const sellers = new Set((await (await request.get(rest('sales?select=owner_id'), { headers })).json()).map((s) => s.owner_id));
    for (const p of profiles) expect(sellers.has(p.id), `perfil ${p.id} sem venda está público`).toBe(true);
  });
});
