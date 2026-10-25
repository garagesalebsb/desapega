-- =====================================================================
-- Desapega — venda começa como rascunho
-- Rode depois dos arquivos anteriores, no SQL Editor do Supabase.
--
-- Venda nova (ou duplicada) fica visível só para quem criou até ele tocar
-- em "Publicar". Antes de publicar, o app mostra todos os preços para
-- revisão, destacando os sugeridos pela IA (items.ai_price).
-- As vendas que já existem continuam publicadas.
-- =====================================================================

alter table public.sales add column if not exists draft boolean not null default false;
alter table public.sales alter column draft set default true;

-- Preço preenchido pela IA e ainda não revisado pelo vendedor.
alter table public.items add column if not exists ai_price boolean not null default false;
grant update (ai_price) on public.items to authenticated;

-- Rascunho só aparece para o dono.
drop policy if exists "sales leitura" on public.sales;
create policy "sales leitura" on public.sales for select
  using ((not hidden and not draft) or owner_id = auth.uid());

drop policy if exists "items leitura" on public.items;
create policy "items leitura" on public.items for select
  using (exists (select 1 from public.sales s where s.id = sale_id and ((not s.hidden and not s.draft) or s.owner_id = auth.uid())));

drop policy if exists "profiles leitura" on public.profiles;
create policy "profiles leitura" on public.profiles for select
  using (
    id = auth.uid()
    or exists (select 1 from public.sales s where s.owner_id = profiles.id and not s.hidden and not s.draft)
  );

-- Publicar é só ida: o dono confirma que revisou os preços e a venda vai ao ar.
create or replace function public.publish_sale(p_sale uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.sales set draft = false where id = p_sale and owner_id = auth.uid() and draft;
  if not found then
    raise exception 'Venda não encontrada ou já publicada.';
  end if;
  update public.items set ai_price = false where sale_id = p_sale and ai_price;
end $$;
revoke execute on function public.publish_sale(uuid) from public, anon;
grant execute on function public.publish_sale(uuid) to authenticated;

-- Publicar também atualiza as páginas do site (busca do Google e prévias de link).
drop trigger if exists sales_rebuild_site on public.sales;
create trigger sales_rebuild_site
  after insert or delete or update of title, description, type, region, starts_on, ends_on,
    start_time, end_time, cover_url, hidden, draft
  on public.sales
  for each statement execute function public.request_site_rebuild();
