-- =====================================================================
-- Desapega — venda "só fotos"
-- Rode depois dos arquivos anteriores, no SQL Editor do Supabase.
--
-- O vendedor escolhe, em cada venda, mostrar os itens só com fotos:
-- cada foto vira um item sem título, preço nem descrição visíveis.
-- A IA pode gravar um título escondido (items.title), usado só na busca
-- e no chat; sem IA, o título fica vazio.
-- =====================================================================

alter table public.sales add column if not exists photos_only boolean not null default false;
grant update (photos_only) on public.sales to authenticated;

alter table public.items alter column title drop not null;

-- Conversa sobre uma foto sem título: "Foto · <nome da venda>".
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
  values (it.id, s.id, coalesce(it.title, left('Foto · ' || s.title, 120)), it.photo_url, s.title, me, s.owner_id)
  returning id into conv;
  return conv;
end $$;
revoke execute on function public.start_conversation(uuid) from anon, public;
grant execute on function public.start_conversation(uuid) to authenticated;
