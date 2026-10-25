-- =====================================================================
-- Desapega — barreiras contra vendas falsas
-- Rode depois dos arquivos anteriores, no SQL Editor do Supabase.
--
-- 1. Regras da venda: local dentro do mapa do DF, começa em até 60 dias,
--    dura no máximo 7 dias e só publica com pelo menos um item ou foto.
-- 2. Limite por conta: 5 vendas criadas por dia (rascunhos contam) e
--    3 vendas publicadas ao mesmo tempo (as que ainda não terminaram).
-- 3. Denúncias: 3 pessoas diferentes denunciando escondem a venda na hora,
--    o dono é avisado e os moderadores recebem um aviso para revisar.
--    Conta com 2 vendas escondidas pela moderação não publica mais.
--
-- As regras valem para quem usa o app. Pelo SQL Editor (exemplos, ajustes
-- manuais) nada é bloqueado.
--
-- Para virar moderador, rode uma vez (troque o e-mail):
--   insert into public.moderators (user_id)
--   select id from auth.users where email = 'seu-email@gmail.com';
-- =====================================================================

-- Erros de regra usam o código DS400: o app mostra a mensagem e não
-- registra como falha no monitoramento.

-- ---------------------------------------------------------------------
-- Moderadores
-- ---------------------------------------------------------------------
create table if not exists public.moderators (
  user_id    uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.moderators enable row level security;
revoke all on public.moderators from anon;
revoke insert, update, delete on public.moderators from authenticated;
drop policy if exists "moderators le o proprio" on public.moderators;
create policy "moderators le o proprio" on public.moderators for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderators where user_id = auth.uid())
$$;
revoke execute on function public.is_moderator() from public;
grant execute on function public.is_moderator() to anon, authenticated; -- usada nas regras de leitura

-- Moderador vê vendas escondidas (para revisar) e as denúncias.
drop policy if exists "sales leitura" on public.sales;
create policy "sales leitura" on public.sales for select
  using ((not hidden and not draft) or owner_id = auth.uid() or (hidden and (select public.is_moderator())));

drop policy if exists "items leitura" on public.items;
create policy "items leitura" on public.items for select
  using (exists (select 1 from public.sales s where s.id = sale_id
    and ((not s.hidden and not s.draft) or s.owner_id = auth.uid() or (s.hidden and (select public.is_moderator())))));

drop policy if exists "profiles leitura" on public.profiles;
create policy "profiles leitura" on public.profiles for select
  using (
    id = auth.uid()
    or exists (select 1 from public.sales s where s.owner_id = profiles.id and not s.hidden and not s.draft)
    or (select public.is_moderator())
  );

drop policy if exists "reports moderador le" on public.reports;
create policy "reports moderador le" on public.reports for select to authenticated
  using ((select public.is_moderator()));

-- ---------------------------------------------------------------------
-- 1 e 2. Regras ao criar e editar a venda
-- ---------------------------------------------------------------------
create or replace function public.check_sale_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if me is null then
    return new; -- SQL Editor e funções internas
  end if;

  if tg_op = 'INSERT' then
    new.draft := true;  -- venda nova sempre passa por "Publicar"
    new.hidden := false;
    if (select count(*) from public.sales where owner_id = me and hidden) >= 2 then
      raise exception 'Sua conta não pode criar vendas porque duas vendas suas foram retiradas após denúncias.' using errcode = 'DS400';
    end if;
    if (select count(*) from public.sales where owner_id = me and created_at > now() - interval '1 day') >= 5 then
      raise exception 'Limite de 5 vendas novas por dia. Tente de novo amanhã.' using errcode = 'DS400';
    end if;
    if new.ends_on < today then
      raise exception 'A venda não pode terminar no passado.' using errcode = 'DS400';
    end if;
  end if;

  if tg_op = 'INSERT' or (new.lat, new.lng) is distinct from (old.lat, old.lng) then
    if new.lat not between -16.4 and -15.2 or new.lng not between -48.65 and -47.05 then
      raise exception 'O local da venda precisa ficar no Distrito Federal ou arredores.' using errcode = 'DS400';
    end if;
  end if;

  if tg_op = 'INSERT' or (new.starts_on, new.ends_on) is distinct from (old.starts_on, old.ends_on) then
    if new.starts_on > today + 60 then
      raise exception 'A venda precisa começar em até 60 dias.' using errcode = 'DS400';
    end if;
    if new.ends_on - new.starts_on > 6 then
      raise exception 'A venda pode durar no máximo 7 dias.' using errcode = 'DS400';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.check_sale_rules() from public, anon, authenticated;

drop trigger if exists sales_check_rules on public.sales;
create trigger sales_check_rules before insert or update on public.sales
  for each row execute function public.check_sale_rules();

-- Publicar: venda com item, ainda não terminada, até 3 no ar por conta.
create or replace function public.publish_sale(p_sale uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  s public.sales;
begin
  select * into s from public.sales where id = p_sale and owner_id = me and draft;
  if s.id is null then
    raise exception 'Venda não encontrada ou já publicada.';
  end if;
  if (select count(*) from public.sales where owner_id = me and hidden) >= 2 then
    raise exception 'Sua conta não pode publicar vendas porque duas vendas suas foram retiradas após denúncias.' using errcode = 'DS400';
  end if;
  if s.ends_on < today then
    raise exception 'Esta venda já terminou. Ajuste as datas antes de publicar.' using errcode = 'DS400';
  end if;
  if not exists (select 1 from public.items where sale_id = p_sale) then
    raise exception 'Cadastre pelo menos um item ou foto antes de publicar.' using errcode = 'DS400';
  end if;
  if (select count(*) from public.sales
       where owner_id = me and not draft and not hidden and ends_on >= today) >= 3 then
    raise exception 'Você já tem 3 vendas no ar. Espere uma terminar ou exclua uma delas para publicar outra.' using errcode = 'DS400';
  end if;
  update public.sales set draft = false where id = p_sale;
  update public.items set ai_price = false where sale_id = p_sale and ai_price;
end $$;
revoke execute on function public.publish_sale(uuid) from public, anon;
grant execute on function public.publish_sale(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Denúncias
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'lembrete_vespera', 'lembrete_hoje', 'venda_alterada', 'venda_cancelada', 'venda_salva', 'venda_oculta',
  'venda_liberada',     -- (vendedor) a moderação revisou e a venda voltou ao ar
  'denuncia_revisar'    -- (moderador) venda recebeu denúncia; detail = 'oculta' quando saiu do ar
));

-- Conta para esconder a venda: denúncias abertas do anúncio ou do vendedor
-- dela (a denúncia de um comprador feita pelo vendedor no chat não conta).
create or replace function public.check_report()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Limite de 10 denúncias por dia. Obrigado por ajudar; tente de novo amanhã.' using errcode = 'DS400';
  end if;
  if exists (select 1 from public.reports r
              where r.reporter_id = new.reporter_id
                and r.sale_id is not distinct from new.sale_id
                and r.reported_user_id is not distinct from new.reported_user_id) then
    raise exception 'Você já enviou esta denúncia. Ela está em análise.' using errcode = 'DS400';
  end if;
  return new;
end $$;
revoke execute on function public.check_report() from public, anon, authenticated;

drop trigger if exists reports_check on public.reports;
create trigger reports_check before insert on public.reports
  for each row execute function public.check_report();

create or replace function public.handle_report()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s public.sales;
  n integer;
begin
  select * into s from public.sales where id = new.sale_id;
  if s.id is null or new.reporter_id = s.owner_id
     or (new.reported_user_id is not null and new.reported_user_id <> s.owner_id) then
    return null;
  end if;
  select count(distinct r.reporter_id) into n
    from public.reports r
   where r.sale_id = s.id and r.status = 'aberta' and r.reporter_id <> s.owner_id
     and (r.reported_user_id is null or r.reported_user_id = s.owner_id);

  if n >= 3 and not s.hidden then
    update public.sales set hidden = true where id = s.id; -- avisa o dono (venda_oculta, arquivo 005)
    s.hidden := true;
  end if;

  -- Um aviso por venda para cada moderador, atualizado enquanto não for lido.
  update public.notifications
     set count = n, created_at = now(), sale_title = s.title, detail = case when s.hidden then 'oculta' end
   where kind = 'denuncia_revisar' and sale_id = s.id and read_at is null;
  insert into public.notifications (user_id, kind, sale_id, sale_title, count, detail)
  select m.user_id, 'denuncia_revisar', s.id, s.title, n, case when s.hidden then 'oculta' end
    from public.moderators m
   where not exists (select 1 from public.notifications x
                      where x.user_id = m.user_id and x.kind = 'denuncia_revisar' and x.sale_id = s.id and x.read_at is null);
  return null;
end $$;
revoke execute on function public.handle_report() from public, anon, authenticated;

drop trigger if exists reports_handle on public.reports;
create trigger reports_handle after insert on public.reports
  for each row execute function public.handle_report();

-- Moderador decide: p_show = true reexibe (denúncias descartadas),
-- false esconde ou mantém escondida (denúncias aceitas).
create or replace function public.moderate_sale(p_sale uuid, p_show boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.sales;
begin
  if not public.is_moderator() then
    raise exception 'Só moderadores podem fazer isso.';
  end if;
  select * into s from public.sales where id = p_sale;
  if s.id is null then
    raise exception 'Venda não encontrada.';
  end if;
  update public.sales set hidden = not p_show where id = p_sale;
  update public.reports set status = case when p_show then 'rejeitada' else 'procedente' end
   where sale_id = p_sale and status = 'aberta';
  update public.notifications set read_at = now()
   where kind = 'denuncia_revisar' and sale_id = p_sale and read_at is null;
  if p_show and s.hidden then
    insert into public.notifications (user_id, kind, sale_id, sale_title)
    values (s.owner_id, 'venda_liberada', s.id, s.title);
  end if;
end $$;
revoke execute on function public.moderate_sale(uuid, boolean) from public, anon;
grant execute on function public.moderate_sale(uuid, boolean) to authenticated;
