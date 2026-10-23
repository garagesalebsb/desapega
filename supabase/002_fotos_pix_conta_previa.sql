-- =====================================================================
-- Desapego Brasília — atualização 002
-- Várias fotos por item, Pix no item, excluir conta e prévia do link na hora.
-- Rode este arquivo inteiro no SQL Editor do Supabase (pode rodar mais de uma vez).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Várias fotos por item (photo_url continua sendo a foto principal)
-- ---------------------------------------------------------------------
alter table public.items add column if not exists photos text[] not null default '{}';
update public.items set photos = array[photo_url]
  where photo_url is not null and cardinality(photos) = 0;
alter table public.items drop constraint if exists items_photos_max;
alter table public.items add constraint items_photos_max check (cardinality(photos) <= 6);
grant update (photos) on public.items to authenticated;

-- ---------------------------------------------------------------------
-- 2. Pix: chave do vendedor, mostrada só para quem está logado
-- ---------------------------------------------------------------------
alter table public.contacts add column if not exists pix_key text check (char_length(pix_key) <= 77);
alter table public.contacts add column if not exists pix_name text check (char_length(pix_name) <= 25);
grant update (pix_key, pix_name) on public.contacts to authenticated;

create or replace function public.get_sale_pix(p_sale uuid)
returns table (pix_key text, pix_name text)
language sql stable security definer set search_path = '' as $$
  select c.pix_key, c.pix_name
  from public.sales s
  join public.contacts c on c.user_id = s.owner_id
  where s.id = p_sale and not s.hidden and auth.uid() is not null and c.pix_key is not null
$$;

-- Público: só diz se o vendedor aceita Pix (para mostrar o botão), sem revelar a chave.
create or replace function public.sale_has_pix(p_sale uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sales s
    join public.contacts c on c.user_id = s.owner_id
    where s.id = p_sale and not s.hidden and c.pix_key is not null
  )
$$;

-- ---------------------------------------------------------------------
-- 3. Excluir conta (LGPD): apaga o usuário e, em cascata, perfil,
--    contatos, vendas, itens, favoritos e denúncias feitas por ele.
--    As fotos são apagadas antes pelo app (o Storage não permite apagar por SQL).
-- ---------------------------------------------------------------------
drop policy if exists "photos le a propria pasta" on storage.objects;
create policy "photos le a propria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from anon, public;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Prévia do link na hora: quando uma venda muda, o banco pede ao
--    GitHub para republicar o site (gera a página de prévia em ~1 min).
--    Requer o token do GitHub guardado no Vault com o nome
--    'github_deploy_token' (veja o README). Sem o token, não faz nada.
-- ---------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;

create or replace function public.request_site_rebuild()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  tok text;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'github_deploy_token' limit 1;
  if tok is null then
    return null;
  end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/garagesalebsb/desapego-brasilia/actions/workflows/deploy.yml/dispatches',
    body := '{"ref":"main"}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || tok,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'desapego-brasilia-supabase',
      'Content-Type', 'application/json'
    )
  );
  return null;
end $$;

drop trigger if exists sales_rebuild_site on public.sales;
create trigger sales_rebuild_site
  after insert or delete or update of title, description, type, region, starts_on, ends_on,
    start_time, end_time, cover_url, hidden
  on public.sales
  for each statement execute function public.request_site_rebuild();
