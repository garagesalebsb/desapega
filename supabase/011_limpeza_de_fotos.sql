-- =====================================================================
-- Desapega — limpeza automática das fotos
-- Rode depois dos arquivos anteriores, no SQL Editor do Supabase.
--
-- Todo dia o GitHub Actions (workflow limpeza-fotos.yml) chama a função
-- "limpar-fotos", que usa esta consulta para saber o que apagar do Storage:
--   1. fotos das vendas que terminaram há mais de 30 dias;
--   2. arquivos que nada mais usa há mais de 2 dias (envios abandonados).
-- A venda e os itens continuam no histórico do vendedor, só sem as fotos.
-- Uma foto reaproveitada por uma venda duplicada mais nova não é apagada.
-- =====================================================================

create or replace function public.claim_photo_cleanup(p_secret text, p_days int default 30, p_dry_run boolean default false)
returns table (name text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  limite date := (now() at time zone 'America/Sao_Paulo')::date - p_days;
  marker constant text := '/object/public/photos/';
begin
  perform public.reminders_check_secret(p_secret);
  if p_days < 7 then
    raise exception 'prazo curto demais';
  end if;

  if not p_dry_run then
    update public.items i set photo_url = null, photos = '{}'
      from public.sales s
     where s.id = i.sale_id and s.ends_on < limite and (i.photo_url is not null or cardinality(i.photos) > 0);
    update public.sales s set cover_url = null where s.ends_on < limite and s.cover_url is not null;
    update public.conversations c set item_photo = null
      from public.sales s
     where s.id = c.sale_id and s.ends_on < limite and c.item_photo is not null;
    update public.conversations c set item_photo = null where c.sale_id is null and c.item_photo is not null;
  end if;

  -- Arquivos ainda em uso: os das vendas que não passaram do prazo.
  -- A miniatura (abc.t.webp) acompanha a foto (abc.f.webp).
  return query
  with em_uso as (
    select split_part(u, marker, 2) as n
    from (
      select unnest(i.photos || i.photo_url) as u
        from public.items i join public.sales s on s.id = i.sale_id where s.ends_on >= limite
      union all
      select s.cover_url from public.sales s where s.ends_on >= limite
      union all
      select c.item_photo
        from public.conversations c join public.sales s on s.id = c.sale_id where s.ends_on >= limite
    ) x
    where u like '%' || marker || '%'
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'photos'
    and o.created_at < now() - interval '2 days'
    and not exists (
      select 1 from em_uso e where e.n = regexp_replace(o.name, '\.t\.(webp|jpg)$', '.f.\1')
    )
  order by o.created_at
  limit 1000;
end $$;
revoke execute on function public.claim_photo_cleanup(text, int, boolean) from public, anon, authenticated;
grant execute on function public.claim_photo_cleanup(text, int, boolean) to service_role;
