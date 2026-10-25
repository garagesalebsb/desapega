-- =====================================================================
-- Desapega — o repositório passou a se chamar "desapega"
-- Rode depois dos arquivos anteriores, no SQL Editor do Supabase.
--
-- A republicação do site (quando uma venda muda) chama a API do GitHub
-- pelo nome do repositório. O token do Vault continua o mesmo.
-- =====================================================================

create or replace function public.request_site_rebuild()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  tok text;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'github_deploy_token' limit 1;
  if tok is null then
    return null;
  end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/garagesalebsb/desapega/actions/workflows/deploy.yml/dispatches',
    body := '{"ref":"main"}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || tok,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'desapega-supabase',
      'Content-Type', 'application/json'
    )
  );
  return null;
end $$;
