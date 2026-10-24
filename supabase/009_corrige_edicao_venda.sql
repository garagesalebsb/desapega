-- =====================================================================
-- Desapega — corrige o erro "malformed array literal" ao editar uma venda
-- (aviso de venda alterada, do arquivo 005). Rode no SQL Editor do Supabase.
-- =====================================================================

create or replace function public.notify_sale_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  what text[] := '{}';
begin
  if new.hidden and not old.hidden then
    insert into public.notifications (user_id, kind, sale_id, sale_title)
    values (new.owner_id, 'venda_oculta', new.id, new.title);
    return null;
  end if;
  if new.hidden or new.ends_on < (now() at time zone 'America/Sao_Paulo')::date then
    return null;
  end if;

  if (new.starts_on, new.ends_on) is distinct from (old.starts_on, old.ends_on) then
    what := array_append(what, 'data');
  end if;
  if (new.start_time, new.end_time) is distinct from (old.start_time, old.end_time) then
    what := array_append(what, 'horário');
  end if;
  if (new.address, new.reference, new.region, new.lat, new.lng) is distinct from (old.address, old.reference, old.region, old.lat, old.lng) then
    what := array_append(what, 'endereço');
  end if;
  if cardinality(what) = 0 then
    return null;
  end if;

  -- Várias edições seguidas viram um aviso só, enquanto a pessoa não ler.
  update public.notifications n
     set detail = (select string_agg(distinct x, ',') from unnest(string_to_array(n.detail, ',') || what) x),
         sale_title = new.title, created_at = now()
   where n.kind = 'venda_alterada' and n.sale_id = new.id and n.read_at is null;
  insert into public.notifications (user_id, kind, sale_id, sale_title, detail)
  select f.user_id, 'venda_alterada', new.id, new.title, array_to_string(what, ',')
  from public.favorites f
  where f.sale_id = new.id and f.user_id <> new.owner_id
    and not exists (
      select 1 from public.notifications n
      where n.user_id = f.user_id and n.kind = 'venda_alterada' and n.sale_id = new.id and n.read_at is null
    );
  return null;
end $$;
