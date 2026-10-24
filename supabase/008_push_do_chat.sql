-- =====================================================================
-- Desapega — notificação no celular quando chega mensagem no chat
-- Rode depois dos arquivos anteriores, no SQL Editor do Supabase.
--
-- Quem envia é a função "enviar-push" (supabase/functions/enviar-push).
-- Ela só consegue ler os aparelhos com a mesma senha dos lembretes
-- (REMINDERS_SECRET; aqui fica só o hash, em reminders_check_secret).
-- =====================================================================

-- Cada mensagem gera no máximo uma notificação.
alter table public.messages add column if not exists pushed_at timestamptz;

-- Aparelhos de quem deve ser avisado sobre a mensagem (a outra pessoa da conversa).
-- Confere que a mensagem é mesmo de quem pediu, recente e ainda não avisada.
create or replace function public.message_push_targets(p_secret text, p_message uuid, p_sender uuid)
returns table (endpoint text, p256dh text, auth text, conversation_id uuid, item_title text, sender_name text, body text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.reminders_check_secret(p_secret);
  return query
  with m as (
    update public.messages
       set pushed_at = now()
     where id = p_message and sender_id = p_sender and pushed_at is null
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

-- Teste do administrador: aparelhos de uma conta (para mandar uma notificação de teste).
create or replace function public.push_targets_for_user(p_secret text, p_user uuid)
returns table (endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.reminders_check_secret(p_secret);
  return query select ps.endpoint, ps.p256dh, ps.auth from public.push_subscriptions ps where ps.user_id = p_user;
end $$;
revoke execute on function public.push_targets_for_user(text, uuid) from public;
grant execute on function public.push_targets_for_user(text, uuid) to anon;
