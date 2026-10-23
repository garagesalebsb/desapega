-- =====================================================================
-- Desapego Brasília — esquema do banco (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Configuração: exigir telefone verificado por SMS para anunciar.
-- Deixe "false" até configurar um provedor de SMS (Twilio etc.) em
-- Authentication > Providers > Phone. Depois troque para "true".
-- ---------------------------------------------------------------------
create or replace function public.require_phone_verification()
returns boolean language sql immutable as $$ select false $$;

-- ---------------------------------------------------------------------
-- Perfis (públicos) e contatos (privados)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text check (char_length(name) <= 80),
  created_at  timestamptz not null default now()
);

create table if not exists public.contacts (
  user_id         uuid primary key references auth.users on delete cascade,
  whatsapp        text check (whatsapp ~ '^[0-9]{12,13}$'),
  phone_verified  boolean not null default false
);

-- ---------------------------------------------------------------------
-- Vendas (o evento: um dia, um lugar)
-- ---------------------------------------------------------------------
create table if not exists public.sales (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 2000),
  type        text not null check (type in ('garagem', 'mudanca', 'bazar')),
  region      text not null,
  address     text check (char_length(address) <= 160),
  reference   text check (char_length(reference) <= 160),
  lat         double precision not null,
  lng         double precision not null,
  starts_on   date not null,
  ends_on     date not null,
  start_time  time not null,
  end_time    time not null,
  cover_url   text,
  hidden      boolean not null default false,   -- moderação: esconde após denúncia
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists sales_ends_on_idx on public.sales (ends_on);
create index if not exists sales_region_idx  on public.sales (region);
create index if not exists sales_owner_idx   on public.sales (owner_id);

-- ---------------------------------------------------------------------
-- Itens da venda
-- ---------------------------------------------------------------------
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales on delete cascade,
  owner_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 2 and 120),
  price       numeric(10,2) check (price >= 0),
  category    text not null default 'outros',
  photo_url   text,
  status      text not null default 'disponivel' check (status in ('disponivel', 'reservado', 'vendido')),
  created_at  timestamptz not null default now()
);
create index if not exists items_sale_idx on public.items (sale_id);

-- ---------------------------------------------------------------------
-- Favoritos e denúncias
-- ---------------------------------------------------------------------
create table if not exists public.favorites (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  sale_id    uuid not null references public.sales on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sale_id)
);

create table if not exists public.reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null default auth.uid() references auth.users on delete cascade,
  sale_id           uuid references public.sales on delete set null,
  reported_user_id  uuid references auth.users on delete set null,
  reason            text not null check (char_length(reason) <= 60),
  details           text check (char_length(details) <= 1000),
  status            text not null default 'aberta',
  created_at        timestamptz not null default now(),
  check (sale_id is not null or reported_user_id is not null)
);

-- ---------------------------------------------------------------------
-- Gatilhos: cria perfil no cadastro e sincroniza telefone verificado
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  insert into public.contacts (user_id) values (new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quando o usuário confirma o telefone por SMS, ele vira o WhatsApp verificado.
create or replace function public.handle_user_phone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.phone_confirmed_at is not null and coalesce(new.phone, '') <> '' then
    update public.contacts set whatsapp = new.phone where user_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_phone on auth.users;
create trigger on_auth_user_phone
  after update of phone, phone_confirmed_at on auth.users
  for each row execute function public.handle_user_phone();

-- "phone_verified" só é verdadeiro se o número bate com o telefone confirmado no Auth.
create or replace function public.contacts_check_verified()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.phone_verified := coalesce((
    select u.phone_confirmed_at is not null and u.phone = new.whatsapp
    from auth.users u where u.id = new.user_id
  ), false);
  return new;
end $$;

drop trigger if exists contacts_verified on public.contacts;
create trigger contacts_verified
  before insert or update on public.contacts
  for each row execute function public.contacts_check_verified();

-- ---------------------------------------------------------------------
-- Funções públicas
-- ---------------------------------------------------------------------
-- WhatsApp do vendedor: só para quem está logado.
create or replace function public.get_sale_whatsapp(p_sale uuid)
returns text language sql stable security definer set search_path = '' as $$
  select c.whatsapp
  from public.sales s
  join public.contacts c on c.user_id = s.owner_id
  where s.id = p_sale and not s.hidden and auth.uid() is not null
$$;

create or replace function public.can_publish()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contacts c
    where c.user_id = auth.uid()
      and c.whatsapp is not null
      and (c.phone_verified or not public.require_phone_verification())
  )
$$;

-- ---------------------------------------------------------------------
-- Segurança (RLS)
-- ---------------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.contacts  enable row level security;
alter table public.sales     enable row level security;
alter table public.items     enable row level security;
alter table public.favorites enable row level security;
alter table public.reports   enable row level security;

-- Perfis: todos leem; dono edita apenas o nome.
drop policy if exists "profiles leitura" on public.profiles;
create policy "profiles leitura" on public.profiles for select using (true);
drop policy if exists "profiles edita o proprio" on public.profiles;
create policy "profiles edita o proprio" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (name) on public.profiles to authenticated;

-- Contatos: só o próprio usuário vê e edita o WhatsApp.
drop policy if exists "contacts le o proprio" on public.contacts;
create policy "contacts le o proprio" on public.contacts for select to authenticated using (user_id = auth.uid());
drop policy if exists "contacts edita o proprio" on public.contacts;
create policy "contacts edita o proprio" on public.contacts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.contacts from anon;
revoke insert, update, delete on public.contacts from authenticated;
grant update (whatsapp) on public.contacts to authenticated;

-- Vendas: navegação sem login; anunciar exige WhatsApp (verificado, se configurado).
drop policy if exists "sales leitura" on public.sales;
create policy "sales leitura" on public.sales for select
  using (not hidden or owner_id = auth.uid());
drop policy if exists "sales cria" on public.sales;
create policy "sales cria" on public.sales for insert to authenticated
  with check (owner_id = auth.uid() and public.can_publish());
drop policy if exists "sales edita" on public.sales;
create policy "sales edita" on public.sales for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "sales apaga" on public.sales;
create policy "sales apaga" on public.sales for delete to authenticated using (owner_id = auth.uid());
revoke update on public.sales from anon, authenticated;
grant update (title, description, type, region, address, reference, lat, lng,
              starts_on, ends_on, start_time, end_time, cover_url)
  on public.sales to authenticated;

-- Itens: visíveis se a venda é visível; só o dono da venda cadastra.
drop policy if exists "items leitura" on public.items;
create policy "items leitura" on public.items for select
  using (exists (select 1 from public.sales s where s.id = sale_id and (not s.hidden or s.owner_id = auth.uid())));
drop policy if exists "items cria" on public.items;
create policy "items cria" on public.items for insert to authenticated
  with check (owner_id = auth.uid() and exists (select 1 from public.sales s where s.id = sale_id and s.owner_id = auth.uid()));
drop policy if exists "items edita" on public.items;
create policy "items edita" on public.items for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke update on public.items from anon, authenticated;
grant update (title, price, category, photo_url, status) on public.items to authenticated;
drop policy if exists "items apaga" on public.items;
create policy "items apaga" on public.items for delete to authenticated using (owner_id = auth.uid());

-- Favoritos: cada um vê e mexe nos seus.
drop policy if exists "favorites proprios" on public.favorites;
create policy "favorites proprios" on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Denúncias: qualquer logado envia; ninguém lê pelo app (moderação pelo painel).
drop policy if exists "reports cria" on public.reports;
create policy "reports cria" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------------
-- Fotos (Storage): bucket público, cada usuário grava na sua pasta.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "photos envia na propria pasta" on storage.objects;
create policy "photos envia na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos apaga da propria pasta" on storage.objects;
create policy "photos apaga da propria pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
