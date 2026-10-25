-- =====================================================================
-- Desapega — chat preparado para crescer
-- Rode depois dos arquivos anteriores, no SQL Editor do Supabase.
--
-- 1. Cada pessoa escuta só o próprio canal ("user:<id>"). Antes, todo app
--    aberto escutava a tabela messages inteira e o banco conferia, pessoa
--    por pessoa, quem podia ver cada mensagem nova.
-- 2. A notificação no celular sai do próprio banco quando a mensagem é
--    gravada (pg_net chama a função enviar-push), e não mais do app de quem
--    enviou — funciona mesmo se a pessoa fechar o app logo depois de enviar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Mensagem nova vai para o canal particular de quem está na conversa
-- ---------------------------------------------------------------------
create or replace function public.broadcast_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c record;
  payload jsonb;
begin
  select buyer_id, seller_id into c from public.conversations where id = new.conversation_id;
  payload := jsonb_build_object(
    'id', new.id, 'conversation_id', new.conversation_id, 'sender_id', new.sender_id,
    'body', new.body, 'created_at', new.created_at
  );
  perform realtime.send(payload, 'message', 'user:' || c.buyer_id, true);
  perform realtime.send(payload, 'message', 'user:' || c.seller_id, true);
  return null;
end $$;
revoke execute on function public.broadcast_new_message() from public, anon, authenticated;

drop trigger if exists messages_broadcast on public.messages;
create trigger messages_broadcast after insert on public.messages
  for each row execute function public.broadcast_new_message();

-- Só a própria pessoa entra no seu canal, e ninguém envia por ele pelo app
-- (sem regra de insert: só o banco publica).
drop policy if exists "chat: so o proprio canal" on realtime.messages;
create policy "chat: so o proprio canal" on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and realtime.topic() = 'user:' || auth.uid()::text);

-- O app não escuta mais a tabela direto.
do $$
begin
  alter publication supabase_realtime drop table public.messages;
exception when undefined_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 2. Notificação no celular disparada pelo banco
-- ---------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;

-- Sem p_sender (chamada do gatilho): avisa a outra pessoa da conversa.
-- Cada mensagem continua gerando no máximo uma notificação (pushed_at).
drop function if exists public.message_push_targets(text, uuid, uuid);
create or replace function public.message_push_targets(p_secret text, p_message uuid, p_sender uuid default null)
returns table (endpoint text, p256dh text, auth text, conversation_id uuid, item_title text, sender_name text, body text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.reminders_check_secret(p_secret);
  return query
  with m as (
    update public.messages
       set pushed_at = now()
     where id = p_message and (p_sender is null or sender_id = p_sender) and pushed_at is null
       and created_at > now() - interval '5 minutes'
    returning messages.conversation_id, messages.sender_id, messages.body
  )
  select ps.endpoint, ps.p256dh, ps.auth, c.id, c.item_title, coalesce(p.name, 'Alguém'), left(m.body, 160)
  from m
  join public.conversations c on c.id = m.conversation_id
  join public.push_subscriptions ps
    on ps.user_id = case when c.buyer_id = m.sender_id then c.seller_id else c.buyer_id end
  left join public.profiles p on p.id = m.sender_id;
end $$;
revoke execute on function public.message_push_targets(text, uuid, uuid) from public;
grant execute on function public.message_push_targets(text, uuid, uuid) to anon;

create or replace function public.push_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://jadxgfwguzcbmuvjutvq.supabase.co/functions/v1/enviar-push',
    body := jsonb_build_object('hook_message_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );
  return null;
exception when others then
  return null; -- falha no aviso nunca impede a mensagem
end $$;
revoke execute on function public.push_new_message() from public, anon, authenticated;

drop trigger if exists messages_push on public.messages;
create trigger messages_push after insert on public.messages
  for each row execute function public.push_new_message();
