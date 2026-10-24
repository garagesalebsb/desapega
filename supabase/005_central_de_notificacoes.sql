-- =====================================================================
-- Desapego Brasília — central de notificações dentro do app
-- Rode depois de schema.sql, 002, 003 e 004, no SQL Editor do Supabase.
--
-- Avisos gerados pelo próprio banco (gatilhos), sem depender do app:
--   lembrete_vespera / lembrete_hoje  venda salva começa amanhã / hoje
--   venda_alterada                    venda salva mudou de data, horário ou endereço
--   venda_cancelada                   venda salva foi apagada pelo vendedor
--   venda_salva                       (vendedor) pessoas salvaram sua venda
--   venda_oculta                      (vendedor) sua venda saiu do ar após denúncia
-- Ninguém fica sabendo QUEM salvou a venda: o vendedor só vê a quantidade.
-- =====================================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  kind        text not null check (kind in ('lembrete_vespera', 'lembrete_hoje', 'venda_alterada', 'venda_cancelada', 'venda_salva', 'venda_oculta')),
  sale_id     uuid references public.sales on delete set null,
  sale_title  text,          -- guardado à parte: continua aparecendo se a venda for apagada
  detail      text,          -- ex.: 'data,horário' em venda_alterada
  count       integer not null default 1,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

drop policy if exists "notifications le as proprias" on public.notifications;
create policy "notifications le as proprias" on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "notifications marca como lida" on public.notifications;
create policy "notifications marca como lida" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications apaga as proprias" on public.notifications;
create policy "notifications apaga as proprias" on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Vendedor: alguém salvou a venda. Junta num aviso só enquanto não for lido.
-- ---------------------------------------------------------------------
create or replace function public.notify_sale_saved()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v public.sales;
begin
  select * into v from public.sales where id = new.sale_id;
  if v.id is null or v.owner_id = new.user_id then
    return null;
  end if;
  update public.notifications
     set count = count + 1, created_at = now(), sale_title = v.title
   where user_id = v.owner_id and kind = 'venda_salva' and sale_id = v.id and read_at is null;
  if not found then
    insert into public.notifications (user_id, kind, sale_id, sale_title)
    values (v.owner_id, 'venda_salva', v.id, v.title);
  end if;
  return null;
end $$;

drop trigger if exists favorites_notify_owner on public.favorites;
create trigger favorites_notify_owner after insert on public.favorites
  for each row execute function public.notify_sale_saved();

-- ---------------------------------------------------------------------
-- Venda mudou: avisa quem salvou (data, horário, endereço) e o dono (ocultada).
-- ---------------------------------------------------------------------
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

drop trigger if exists sales_notify_change on public.sales;
create trigger sales_notify_change after update on public.sales
  for each row execute function public.notify_sale_changed();

-- Venda apagada antes de acontecer: avisa quem salvou.
create or replace function public.notify_sale_cancelled()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.hidden or old.ends_on < (now() at time zone 'America/Sao_Paulo')::date then
    return old;
  end if;
  insert into public.notifications (user_id, kind, sale_id, sale_title)
  select f.user_id, 'venda_cancelada', null, old.title
  from public.favorites f
  where f.sale_id = old.id and f.user_id <> old.owner_id;
  return old;
end $$;

drop trigger if exists sales_notify_cancel on public.sales;
create trigger sales_notify_cancel before delete on public.sales
  for each row execute function public.notify_sale_cancelled();

-- ---------------------------------------------------------------------
-- Lembretes (substitui a versão do 004): agora todo mundo que salvou
-- recebe o aviso na central; quem ativou no celular recebe também lá.
-- ---------------------------------------------------------------------
create or replace function public.claim_reminders(p_secret text, p_kind text)
returns table (
  user_id uuid, sale_id uuid, title text, region text, start_time time, end_time time,
  endpoint text, p256dh text, auth text
)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  alvo date;
begin
  perform public.reminders_check_secret(p_secret);
  if p_kind = 'vespera' then
    alvo := hoje + 1;
  elsif p_kind = 'hoje' then
    alvo := hoje;
  else
    raise exception 'tipo de lembrete inválido';
  end if;

  -- Avisos lidos ou não, com mais de 60 dias, saem da central.
  delete from public.notifications where created_at < now() - interval '60 days';

  return query
  with novos as (
    insert into public.reminders_sent (user_id, sale_id, kind)
    select f.user_id, s.id, p_kind
    from public.favorites f
    join public.sales s on s.id = f.sale_id
    where s.starts_on = alvo
      and not s.hidden
      and s.owner_id <> f.user_id
    on conflict do nothing
    returning reminders_sent.user_id, reminders_sent.sale_id
  ),
  avisos as (
    insert into public.notifications (user_id, kind, sale_id, sale_title)
    select n.user_id, 'lembrete_' || p_kind, s.id, s.title
    from novos n
    join public.sales s on s.id = n.sale_id
  )
  select n.user_id, s.id, s.title, s.region, s.start_time, s.end_time, ps.endpoint, ps.p256dh, ps.auth
  from novos n
  join public.sales s on s.id = n.sale_id
  join public.push_subscriptions ps on ps.user_id = n.user_id;
end $$;
revoke execute on function public.claim_reminders(text, text) from public;
grant execute on function public.claim_reminders(text, text) to anon;
