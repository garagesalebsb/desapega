-- =====================================================================
-- Desapego Brasília — lembretes das vendas salvas (notificação no celular)
-- Rode depois de schema.sql, 002 e 003, no SQL Editor do Supabase.
--
-- Quem salva uma venda e ativa os lembretes recebe um aviso na véspera
-- (19h) e no dia (7h). Quem envia é o GitHub Actions
-- (.github/workflows/lembretes.yml), que só consegue ler os lembretes
-- com a senha guardada nos segredos do GitHub. Aqui fica apenas o hash
-- dessa senha, então este arquivo pode ficar público sem risco.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Aparelhos que aceitaram receber notificações
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint    text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
revoke insert, update on public.push_subscriptions from authenticated;
drop policy if exists "push le os proprios" on public.push_subscriptions;
create policy "push le os proprios" on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "push apaga os proprios" on public.push_subscriptions;
create policy "push apaga os proprios" on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

-- Grava (ou passa para a conta atual) a inscrição deste aparelho.
-- Num celular compartilhado, o aviso vai para quem entrou por último.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;
revoke execute on function public.save_push_subscription(text, text, text) from anon, public;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Registro do que já foi avisado (para não avisar duas vezes)
-- ---------------------------------------------------------------------
create table if not exists public.reminders_sent (
  user_id  uuid not null references auth.users on delete cascade,
  sale_id  uuid not null references public.sales on delete cascade,
  kind     text not null check (kind in ('vespera', 'hoje')),
  sent_at  timestamptz not null default now(),
  primary key (user_id, sale_id, kind)
);
alter table public.reminders_sent enable row level security;
revoke all on public.reminders_sent from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Funções usadas só pelo envio (GitHub Actions), protegidas por senha
-- ---------------------------------------------------------------------
create or replace function public.reminders_check_secret(p_secret text)
returns void language plpgsql stable set search_path = '' as $$
begin
  if p_secret is null
     or encode(extensions.digest(p_secret, 'sha256'), 'hex')
        <> '67b745ca7be4f5ffbbbd16e89b70daf5527447da538cd293a56ec75246ab224c' then
    raise exception 'acesso negado';
  end if;
end $$;
revoke execute on function public.reminders_check_secret(text) from anon, authenticated, public;

-- Separa os lembretes a enviar agora e já os marca como enviados.
-- kind 'vespera': vendas que começam amanhã; 'hoje': vendas que começam hoje.
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

  return query
  with novos as (
    insert into public.reminders_sent (user_id, sale_id, kind)
    select f.user_id, s.id, p_kind
    from public.favorites f
    join public.sales s on s.id = f.sale_id
    where s.starts_on = alvo
      and not s.hidden
      and s.owner_id <> f.user_id
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = f.user_id)
    on conflict do nothing
    returning reminders_sent.user_id, reminders_sent.sale_id
  )
  select n.user_id, s.id, s.title, s.region, s.start_time, s.end_time, ps.endpoint, ps.p256dh, ps.auth
  from novos n
  join public.sales s on s.id = n.sale_id
  join public.push_subscriptions ps on ps.user_id = n.user_id;
end $$;
revoke execute on function public.claim_reminders(text, text) from public;
grant execute on function public.claim_reminders(text, text) to anon;

-- Aparelho que desinstalou o app ou bloqueou as notificações: some da lista.
create or replace function public.forget_push_subscription(p_secret text, p_endpoint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.reminders_check_secret(p_secret);
  delete from public.push_subscriptions where endpoint = p_endpoint;
end $$;
revoke execute on function public.forget_push_subscription(text, text) from public;
grant execute on function public.forget_push_subscription(text, text) to anon;
