-- =====================================================================
-- Desapega — chat entre comprador e vendedor, e WhatsApp opcional
-- Rode depois dos arquivos anteriores, no SQL Editor do Supabase.
--
-- - O contato padrão passa a ser o chat do app. O WhatsApp só aparece
--   se o vendedor liberar no perfil (contacts.show_whatsapp).
-- - Para anunciar não é mais preciso informar o WhatsApp (só se a
--   verificação por SMS estiver ligada).
-- - Cada conversa é sobre UM item: um comprador com o vendedor, só os
--   dois leem Limites contra spam: 30 conversas novas por hora e
--   120 mensagens por hora por conta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. WhatsApp opcional
-- ---------------------------------------------------------------------
alter table public.contacts add column if not exists show_whatsapp boolean not null default false;
grant update (show_whatsapp) on public.contacts to authenticated;

create or replace function public.sale_has_whatsapp(p_sale uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sales s
    join public.contacts c on c.user_id = s.owner_id
    where s.id = p_sale and not s.hidden and c.show_whatsapp and c.whatsapp is not null
  )
$$;
grant execute on function public.sale_has_whatsapp(uuid) to anon, authenticated;

create or replace function public.get_sale_whatsapp(p_sale uuid)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  phone text;
begin
  select c.whatsapp into phone
  from public.sales s
  join public.contacts c on c.user_id = s.owner_id
  where s.id = p_sale and not s.hidden and c.show_whatsapp and auth.uid() is not null;
  if phone is null then
    return null;
  end if;
  perform public.check_contact_limit(p_sale);
  return phone;
end $$;

-- Anunciar: basta estar logado (ou ter o telefone verificado, se a verificação por SMS estiver ligada).
create or replace function public.can_publish()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    not public.require_phone_verification()
    or exists (select 1 from public.contacts c where c.user_id = auth.uid() and c.phone_verified)
  )
$$;

-- ---------------------------------------------------------------------
-- 2. Conversas e mensagens
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid references public.items on delete set null,
  sale_id         uuid references public.sales on delete set null,
  item_title      text not null,     -- continuam aparecendo se o item ou a venda forem apagados
  item_photo      text,
  sale_title      text not null,
  buyer_id        uuid not null references auth.users on delete cascade,
  seller_id       uuid not null references auth.users on delete cascade,
  created_at      timestamptz not null default now(),
  last_message    text,
  last_sender_id  uuid,
  last_message_at timestamptz,
  buyer_read_at   timestamptz,
  seller_read_at  timestamptz,
  unique (item_id, buyer_id),
  check (buyer_id <> seller_id)
);
create index if not exists conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index if not exists conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations on delete cascade,
  sender_id        uuid not null default auth.uid() references auth.users on delete cascade,
  body             text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at       timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.messages from anon;
revoke insert, update, delete on public.conversations from authenticated;
revoke update, delete on public.messages from authenticated;

drop policy if exists "conversas dos participantes" on public.conversations;
create policy "conversas dos participantes" on public.conversations for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));

drop policy if exists "mensagens dos participantes" on public.messages;
create policy "mensagens dos participantes" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));
drop policy if exists "envia nas proprias conversas" on public.messages;
create policy "envia nas proprias conversas" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
  );

-- Abre (ou reaproveita) a conversa do comprador logado sobre um item.
create or replace function public.start_conversation(p_item uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  it public.items;
  s public.sales;
  conv uuid;
begin
  if me is null then
    raise exception 'Entre na sua conta para conversar.';
  end if;
  select * into it from public.items where id = p_item;
  select * into s from public.sales where id = it.sale_id and not hidden;
  if it.id is null or s.id is null then
    raise exception 'Item não encontrado.';
  end if;
  if s.owner_id = me then
    raise exception 'Este item é seu.';
  end if;
  select id into conv from public.conversations where item_id = p_item and buyer_id = me;
  if conv is not null then
    return conv;
  end if;
  if (select count(*) from public.conversations where buyer_id = me and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Limite de conversas novas atingido. Tente de novo em uma hora.';
  end if;
  insert into public.conversations (item_id, sale_id, item_title, item_photo, sale_title, buyer_id, seller_id)
  values (it.id, s.id, it.title, it.photo_url, s.title, me, s.owner_id)
  returning id into conv;
  return conv;
end $$;
revoke execute on function public.start_conversation(uuid) from anon, public;
grant execute on function public.start_conversation(uuid) to authenticated;

-- Nova mensagem: limite por hora e atualização do resumo da conversa.
create or replace function public.on_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 hour') > 120 then
    raise exception 'Muitas mensagens em pouco tempo. Aguarde um pouco.';
  end if;
  update public.conversations c
     set last_message = left(new.body, 140),
         last_sender_id = new.sender_id,
         last_message_at = new.created_at,
         buyer_read_at = case when new.sender_id = c.buyer_id then new.created_at else c.buyer_read_at end,
         seller_read_at = case when new.sender_id = c.seller_id then new.created_at else c.seller_read_at end
   where c.id = new.conversation_id;
  return new;
end $$;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_new_message();

-- Marca a conversa como lida por quem está abrindo.
create or replace function public.mark_conversation_read(p_conv uuid)
returns void language sql security definer set search_path = '' as $$
  update public.conversations
     set buyer_read_at = case when buyer_id = auth.uid() then now() else buyer_read_at end,
         seller_read_at = case when seller_id = auth.uid() then now() else seller_read_at end
   where id = p_conv and auth.uid() in (buyer_id, seller_id);
$$;
revoke execute on function public.mark_conversation_read(uuid) from anon, public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Lista de conversas: item (título, foto, preço, situação), venda e nome da outra pessoa.
-- Com p_conv, devolve só aquela conversa (mesmo sem mensagens), para o cabeçalho do chat.
drop function if exists public.my_conversations();
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
    and (c.id = p_conv or (p_conv is null and c.last_message_at is not null))  -- conversa sem mensagem não entra na lista
  order by coalesce(c.last_message_at, c.created_at) desc
$$;
revoke execute on function public.my_conversations(uuid) from anon, public;
grant execute on function public.my_conversations(uuid) to authenticated;

create or replace function public.chat_unread_count()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.conversations c
  where auth.uid() in (c.buyer_id, c.seller_id)
    and c.last_message_at is not null and c.last_sender_id <> auth.uid()
    and c.last_message_at > coalesce(case when c.seller_id = auth.uid() then c.seller_read_at else c.buyer_read_at end, '-infinity')
$$;
revoke execute on function public.chat_unread_count() from anon, public;
grant execute on function public.chat_unread_count() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Mensagens chegam na hora (Supabase Realtime, respeitando as regras acima)
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
