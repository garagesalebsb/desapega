-- =====================================================================
-- Desapega — o vendedor pode desligar o chat
-- Rode depois dos arquivos anteriores, no SQL Editor do Supabase.
--
-- Para quem só quer divulgar a venda: com o chat desligado, compradores
-- não abrem conversas novas nem mandam mensagens nas que já existiam.
-- O vendedor continua vendo e respondendo as conversas antigas.
-- =====================================================================

alter table public.profiles add column if not exists chat_enabled boolean not null default true;
grant update (chat_enabled) on public.profiles to authenticated;

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
  select * into s from public.sales where id = it.sale_id and not hidden and not draft;
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
  if not coalesce((select p.chat_enabled from public.profiles p where p.id = s.owner_id), true) then
    raise exception 'Este vendedor não recebe mensagens pelo chat.';
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

-- Mensagem nova: o comprador não escreve para quem desligou o chat.
create or replace function public.check_chat_enabled()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if new.sender_id = c.buyer_id
     and not coalesce((select p.chat_enabled from public.profiles p where p.id = c.seller_id), true) then
    raise exception 'Este vendedor desligou o chat e não recebe mais mensagens.';
  end if;
  return new;
end $$;
revoke execute on function public.check_chat_enabled() from public, anon, authenticated;

drop trigger if exists messages_check_chat on public.messages;
create trigger messages_check_chat before insert on public.messages
  for each row execute function public.check_chat_enabled();
