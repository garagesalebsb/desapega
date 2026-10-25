// Limpeza diária das fotos (chamada pelo workflow limpeza-fotos.yml, com a senha REMINDERS_SECRET).
// O banco diz o que apagar (claim_photo_cleanup, em supabase/011_limpeza_de_fotos.sql) e esta
// função apaga do Storage, que não deixa apagar arquivos direto pelo banco.
// Com {"dry_run": true} só conta o que seria apagado, sem mudar nada.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

Deno.serve(async (req) => {
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });

  const secret = Deno.env.get('REMINDERS_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return reply(401, { error: 'Senha inválida.' });

  let body: { dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch {}
  const dryRun = body.dry_run === true;

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data, error } = await sb.rpc('claim_photo_cleanup', { p_secret: secret, p_dry_run: dryRun });
  if (error) return reply(500, { error: error.message });
  const names = (data as { name: string }[]).map((r) => r.name);
  if (dryRun) return reply(200, { dry_run: true, would_remove: names.length, sample: names.slice(0, 5) });

  let removed = 0;
  for (let i = 0; i < names.length; i += 100) {
    const { data: gone, error: rmError } = await sb.storage.from('photos').remove(names.slice(i, i + 100));
    if (rmError) return reply(500, { error: rmError.message, removed });
    removed += gone?.length ?? 0;
  }
  return reply(200, { removed, more: names.length === 1000 });
});
