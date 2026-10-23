-- =====================================================================
-- Desapego Brasília — atualização 003: privacidade
-- 1. Limite de consultas de contato (WhatsApp/Pix) por conta, contra coleta em massa
-- 2. Nomes públicos só de quem tem venda publicada
-- Rode este arquivo inteiro no SQL Editor do Supabase (pode rodar mais de uma vez).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Limite: cada conta vê o contato de até 30 vendas diferentes por hora.
--    Rever o contato de uma venda já consultada nas últimas 24 h não conta.
-- ---------------------------------------------------------------------
create table if not exists public.contact_lookups (
  user_id  uuid not null references auth.users on delete cascade,
  sale_id  uuid not null references public.sales on delete cascade,
  at       timestamptz not null default now()
);
create index if not exists contact_lookups_user_at_idx on public.contact_lookups (user_id, at desc);
alter table public.contact_lookups enable row level security;
-- Sem políticas: só as funções abaixo (security definer) leem e gravam.
revoke all on public.contact_lookups from anon, authenticated;

create or replace function public.check_contact_limit(p_sale uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  recent int;
begin
  if auth.uid() is null then
    raise exception 'login necessário';
  end if;
  if exists (
    select 1 from public.contact_lookups
    where user_id = auth.uid() and sale_id = p_sale and at > now() - interval '24 hours'
  ) then
    return;
  end if;
  select count(distinct sale_id) into recent
  from public.contact_lookups
  where user_id = auth.uid() and at > now() - interval '1 hour';
  if recent >= 30 then
    raise exception 'Limite de contatos atingido. Tente de novo em uma hora.';
  end if;
  insert into public.contact_lookups (user_id, sale_id) values (auth.uid(), p_sale);
  -- Limpeza: registros com mais de 2 dias não servem mais.
  delete from public.contact_lookups where user_id = auth.uid() and at < now() - interval '2 days';
end $$;
revoke execute on function public.check_contact_limit(uuid) from anon, public, authenticated;

create or replace function public.get_sale_whatsapp(p_sale uuid)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  phone text;
begin
  select c.whatsapp into phone
  from public.sales s
  join public.contacts c on c.user_id = s.owner_id
  where s.id = p_sale and not s.hidden and auth.uid() is not null;
  if phone is null then
    return null;
  end if;
  perform public.check_contact_limit(p_sale);
  return phone;
end $$;

create or replace function public.get_sale_pix(p_sale uuid)
returns table (pix_key text, pix_name text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.sales s
    join public.contacts c on c.user_id = s.owner_id
    where s.id = p_sale and not s.hidden and auth.uid() is not null and c.pix_key is not null
  ) then
    return;
  end if;
  perform public.check_contact_limit(p_sale);
  return query
    select c.pix_key, c.pix_name
    from public.sales s
    join public.contacts c on c.user_id = s.owner_id
    where s.id = p_sale;
end $$;

-- ---------------------------------------------------------------------
-- 2. Perfis: o nome só é público para quem tem venda visível.
--    Cada usuário continua vendo o próprio perfil.
-- ---------------------------------------------------------------------
drop policy if exists "profiles leitura" on public.profiles;
create policy "profiles leitura" on public.profiles for select
  using (
    id = auth.uid()
    or exists (select 1 from public.sales s where s.owner_id = profiles.id and not s.hidden)
  );
