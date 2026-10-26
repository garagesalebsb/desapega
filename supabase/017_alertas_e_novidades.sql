-- =====================================================================
-- Desapega — alertas de vendas perto de você e aceite de novidades
-- Rode depois dos arquivos anteriores, no SQL Editor do Supabase.
--
-- Cada pessoa escolhe a região onde mora (e, se quiser, as vizinhas) e
-- os interesses (categorias). Quando uma venda é publicada nessas regiões
-- com itens desses interesses, ela recebe um aviso na central e no celular,
-- no máximo 3 por dia. O aceite de novidades por e-mail fica registrado
-- com data (LGPD); nada é enviado ainda.
--
-- As preferências ficam numa tabela própria, que só o dono lê: a tabela
-- de perfis é pública para quem tem venda publicada.
-- =====================================================================

create table if not exists public.preferences (
  user_id      uuid primary key default auth.uid() references auth.users on delete cascade,
  home_region  text check (char_length(home_region) <= 60),
  nearby       boolean not null default true,      -- incluir as regiões vizinhas
  regions      text[] not null default '{}' check (cardinality(regions) <= 40),
  interests    text[] not null default '{}' check (cardinality(interests) <= 20), -- vazio = tudo
  alerts       boolean not null default false,
  news_email   boolean not null default false,
  news_email_at timestamptz,                       -- quando aceitou (ou recusou) as novidades
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists preferences_regions_idx on public.preferences using gin (regions) where alerts;

alter table public.preferences enable row level security;
revoke all on public.preferences from anon;
revoke insert, update, delete on public.preferences from authenticated;
grant insert (user_id, home_region, nearby, regions, interests, alerts, news_email) on public.preferences to authenticated;
grant update (home_region, nearby, regions, interests, alerts, news_email) on public.preferences to authenticated;

drop policy if exists "preferences do dono" on public.preferences;
create policy "preferences do dono" on public.preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Registra quando o aceite de novidades mudou.
create or replace function public.touch_preferences()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' or new.news_email is distinct from old.news_email then
    new.news_email_at := now();
  end if;
  return new;
end $$;

drop trigger if exists preferences_touch on public.preferences;
create trigger preferences_touch before insert or update on public.preferences
  for each row execute function public.touch_preferences();

-- ---------------------------------------------------------------------
-- Aviso "venda nova perto de você"
-- ---------------------------------------------------------------------
alter table public.notifications add column if not exists pushed_at timestamptz;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'lembrete_vespera', 'lembrete_hoje', 'venda_alterada', 'venda_cancelada', 'venda_salva', 'venda_oculta',
  'venda_liberada', 'denuncia_revisar',
  'venda_perto'         -- venda nova na região e nos interesses escolhidos; detail = região
));

-- Na publicação: avisa quem escolheu a região e os interesses da venda.
create or replace function public.alert_new_sale()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  n integer;
begin
  if not (old.draft and not new.draft) or new.hidden or new.ends_on < today then
    return null;
  end if;
  insert into public.notifications (user_id, kind, sale_id, sale_title, detail)
  select p.user_id, 'venda_perto', new.id, new.title, new.region
    from public.preferences p
   where p.alerts
     and new.region = any (p.regions)
     and p.user_id <> new.owner_id
     and (cardinality(p.interests) = 0
          or exists (select 1 from public.items i where i.sale_id = new.id and i.category = any (p.interests)))
     and (select count(*) from public.notifications x
           where x.user_id = p.user_id and x.kind = 'venda_perto' and x.created_at > now() - interval '1 day') < 3;
  get diagnostics n = row_count;
  if n > 0 then
    perform net.http_post(
      url := 'https://jadxgfwguzcbmuvjutvq.supabase.co/functions/v1/enviar-push',
      body := jsonb_build_object('hook_alert_sale', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 5000
    );
  end if;
  return null;
exception when others then
  return null; -- falha no alerta nunca impede a publicação
end $$;
revoke execute on function public.alert_new_sale() from public, anon, authenticated;

drop trigger if exists sales_alert on public.sales;
create trigger sales_alert after update of draft on public.sales
  for each row execute function public.alert_new_sale();

-- Aparelhos a avisar de uma venda nova. Cada aviso vai para o celular uma vez só (pushed_at),
-- e só nos primeiros 10 minutos, então repetir a chamada não gera aviso extra.
create or replace function public.alert_push_targets(p_secret text, p_sale uuid)
returns table (endpoint text, p256dh text, auth text, sale_id uuid, sale_title text, region text, starts_on date)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.reminders_check_secret(p_secret);
  return query
  with n as (
    update public.notifications
       set pushed_at = now()
     where kind = 'venda_perto' and notifications.sale_id = p_sale and pushed_at is null
       and created_at > now() - interval '10 minutes'
    returning user_id
  )
  select ps.endpoint, ps.p256dh, ps.auth, s.id, s.title, s.region, s.starts_on
    from n
    join public.push_subscriptions ps on ps.user_id = n.user_id
    join public.sales s on s.id = p_sale;
end $$;
revoke execute on function public.alert_push_targets(text, uuid) from public;
grant execute on function public.alert_push_targets(text, uuid) to anon;

-- ---------------------------------------------------------------------
-- Para você (administrador): quem aceitou receber novidades por e-mail.
-- Rode no SQL Editor quando for mandar uma novidade:
--   select u.email, pr.name, p.news_email_at
--     from public.preferences p
--     join auth.users u on u.id = p.user_id
--     left join public.profiles pr on pr.id = p.user_id
--    where p.news_email
--    order by p.news_email_at;
-- ---------------------------------------------------------------------
