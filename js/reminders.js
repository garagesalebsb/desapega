// Lembretes das vendas salvas por notificação (Web Push).
// O envio acontece no GitHub Actions (scripts/send-reminders.mjs); aqui só se inscreve o aparelho.

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// 'ok' | 'ios-instalar' (iPhone só recebe com o app na tela de início) | 'sem-suporte'
export function pushSupport() {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok';
  if (isIOS() && !isStandalone()) return 'ios-instalar';
  return 'sem-suporte';
}

const keyBytes = (b64) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Ativo neste aparelho = permissão dada + inscrição existente.
export async function remindersActive() {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return false;
  return !!(await currentSubscription());
}

// Pede a permissão (precisa vir de um toque do usuário) e grava a inscrição na conta.
// Devolve 'ativo' | 'negado' | 'sem-suporte'.
export async function enableReminders(sb, vapidKey) {
  if (pushSupport() !== 'ok') return 'sem-suporte';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'negado';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
  await saveSubscription(sb, sub);
  return 'ativo';
}

export async function disableReminders(sb) {
  const sub = pushSupport() === 'ok' ? await currentSubscription() : null;
  if (!sub) return;
  const { error } = await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  if (error) throw error;
  await sub.unsubscribe();
}

// Ao entrar na conta: se o aparelho já tinha aceitado, garante que a inscrição está nesta conta.
export async function syncReminders(sb) {
  if (!(await remindersActive())) return;
  await saveSubscription(sb, await currentSubscription());
}

async function saveSubscription(sb, sub) {
  const { keys } = sub.toJSON();
  const { error } = await sb.rpc('save_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
  if (error) throw error;
}
