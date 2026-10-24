-- =====================================================================
-- Desapega — descrição dos itens e limite de uso da IA (Gemini)
-- Rode depois dos arquivos anteriores, no SQL Editor do Supabase.
--
-- A chave do Gemini NÃO fica no banco nem no site: fica nos segredos da
-- função "descrever-item" (Edge Function). Aqui só controlamos quantas
-- fotos cada conta pode mandar para a IA, para ninguém esgotar a cota.
-- =====================================================================

-- 1. Descrição do item (preenchida pela IA ou pelo vendedor)
alter table public.items
  add column if not exists description text check (char_length(description) <= 1000);
grant update (description) on public.items to authenticated;

-- 2. Uso da IA: 60 fotos por hora e 300 por dia, por conta
create table if not exists public.ai_usage (
  user_id     uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists ai_usage_user_idx on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

create or replace function public.ai_take_quota()
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'não autenticado';
  end if;
  if (select count(*) from public.ai_usage where user_id = me and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Limite de 60 fotos por hora na descrição automática. Tente de novo mais tarde.';
  end if;
  if (select count(*) from public.ai_usage where user_id = me and created_at > now() - interval '1 day') >= 300 then
    raise exception 'Limite de 300 fotos por dia na descrição automática. Tente de novo amanhã.';
  end if;
  delete from public.ai_usage where created_at < now() - interval '2 days';
  insert into public.ai_usage (user_id) values (me);
end $$;
revoke execute on function public.ai_take_quota() from anon, public;
grant execute on function public.ai_take_quota() to authenticated;
