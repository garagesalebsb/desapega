-- =====================================================================
-- Desapega — apagar conversa (só para quem apagou)
-- Rode depois dos arquivos anteriores, no SQL Editor do Supabase.
--
-- Arrastar a conversa para a esquerda na lista a apaga para quem arrastou:
-- ela some da lista e as mensagens até ali deixam de aparecer para essa
-- pessoa. A outra pessoa continua vendo tudo. Se chegar mensagem nova, a
-- conversa volta à lista só com as mensagens novas (como no WhatsApp).
-- Nada é apagado do banco: a moderação ainda analisa denúncias.
-- =====================================================================

alter table public.conversations
  add column if not exists buyer_hidden_at timestamptz,
  add column if not exists seller_hidden_at timestamptz;

-- Apaga (p_hide = true) ou desfaz (false) para quem chamou. Apagar também marca como lida.
create or replace function public.hide_conversation(p_conv uuid, p_hide boolean default true)
returns void language sql security definer set search_path = '' as $$
  update public.conversations
     set buyer_hidden_at  = case when buyer_id  = auth.uid() then case when p_hide then now() end else buyer_hidden_at end,
         seller_hidden_at = case when seller_id = auth.uid() then case when p_hide then now() end else seller_hidden_at end,
         buyer_read_at    = case when buyer_id  = auth.uid() and p_hide then now() else buyer_read_at end,
         seller_read_at   = case when seller_id = auth.uid() and p_hide then now() else seller_read_at end
   where id = p_conv and auth.uid() in (buyer_id, seller_id);
$$;
revoke execute on function public.hide_conversation(uuid, boolean) from anon, public;
grant execute on function public.hide_conversation(uuid, boolean) to authenticated;

-- Mensagens: cada pessoa só lê as que chegaram depois de ela apagar a conversa.
drop policy if exists "mensagens dos participantes" on public.messages;
create policy "mensagens dos participantes" on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and auth.uid() in (c.buyer_id, c.seller_id)
      and messages.created_at > coalesce(case when c.buyer_id = auth.uid() then c.buyer_hidden_at else c.seller_hidden_at end, '-infinity')
  ));

-- Lista de conversas: igual à do 007, sem as apagadas (até chegar mensagem nova).
-- Com p_conv continua devolvendo a conversa, para abrir pelo "Tenho interesse".
create or replace function public.my_conversations(p_conv uuid default null)
returns table (
  id uuid, item_id uuid, sale_id uuid, other_id uuid, item_title text, item_photo text, item_price numeric, item_status text,
  sale_title text, other_name text, i_am_seller boolean,
  last_message text, last_mine boolean, last_message_at timestamptz, unread boolean
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.item_id, c.sale_id, case when c.seller_id = auth.uid() then c.buyer_id else c.seller_id end, coalesce(i.title, c.item_title), coalesce(i.photo_url, c.item_photo), i.price, i.status,
         c.sale_title,
         coalesce(p.name, 'Usuário'),
         c.seller_id = auth.uid(),
         c.last_message,
         c.last_sender_id = auth.uid(),
         coalesce(c.last_message_at, c.created_at),
         c.last_message_at is not null and c.last_sender_id <> auth.uid() and
           c.last_message_at > coalesce(case when c.seller_id = auth.uid() then c.seller_read_at else c.buyer_read_at end, '-infinity')
  from public.conversations c
  left join public.items i on i.id = c.item_id
  left join public.profiles p on p.id = case when c.seller_id = auth.uid() then c.buyer_id else c.seller_id end
  where auth.uid() in (c.buyer_id, c.seller_id)
    and (c.id = p_conv or (
      p_conv is null and c.last_message_at is not null  -- conversa sem mensagem não entra na lista
      and c.last_message_at > coalesce(case when c.seller_id = auth.uid() then c.seller_hidden_at else c.buyer_hidden_at end, '-infinity')
    ))
  order by coalesce(c.last_message_at, c.created_at) desc
$$;
