// Preencha com os dados do seu projeto Supabase (Project Settings > API).
// A chave "anon"/"publishable" é pública por natureza: a segurança vem das regras RLS do schema.sql.
export const CONFIG = {
  SUPABASE_URL: 'https://jadxgfwguzcbmuvjutvq.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_GAcisaQRatOCvvcf6-FxQQ_tVfGY7dW',
  APP_NAME: 'Desapego Brasília',
  // Monitoramento de erros (opcional): cole aqui o DSN do projeto no Sentry (sentry.io).
  SENTRY_DSN: 'https://c8f352c643add0e7dc34791eaa94ac9b@o4512308208926720.ingest.us.sentry.io/4512308223410176',
  // Chave pública dos lembretes por notificação (a privada fica só nos segredos do GitHub).
  VAPID_PUBLIC_KEY: 'BPCCGwRTzsUQVKTms2XJiZQ5UxAe3Mhd3SUiBhRJ2VoSW8rQAbrbZ9VSN8MrWPgKsvrTeol4KrfrxXXApCvbjwk',
};
