// Monitoramento de erros (Sentry). Só liga se SENTRY_DSN estiver preenchido em config.js.
// Não envia dados pessoais: sem IP, sem e-mail, sem conteúdo digitado; links de login são limpos.

const SDK = 'https://browser.sentry-cdn.com/8.33.1/bundle.min.js';
const pending = [];
let ready = false;

const scrub = (s) => String(s ?? '').replace(/([?&#](code|access_token|refresh_token|token)=)[^&#]*/gi, '$1[removido]');

export function initMonitoring(dsn) {
  if (!dsn || location.hostname === 'localhost') return;
  const script = document.createElement('script');
  script.src = SDK;
  script.crossOrigin = 'anonymous';
  script.onload = () => {
    window.Sentry.init({
      dsn,
      environment: 'producao',
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.request?.url) event.request.url = scrub(event.request.url);
        delete event.user;
        return event;
      },
      beforeBreadcrumb(crumb) {
        if (crumb.category === 'ui.input') return null; // nada do que a pessoa digita
        if (crumb.data?.url) crumb.data.url = scrub(crumb.data.url);
        if (crumb.data?.to) crumb.data.to = scrub(crumb.data.to);
        if (crumb.data?.from) crumb.data.from = scrub(crumb.data.from);
        return crumb;
      },
    });
    ready = true;
    pending.splice(0).forEach(([err, where]) => reportError(err, where));
  };
  document.head.appendChild(script);
  // Erros que acontecem antes de o Sentry carregar também são guardados.
  addEventListener('error', (e) => !ready && pending.push([e.error || e.message, 'inicio']));
  addEventListener('unhandledrejection', (e) => !ready && pending.push([e.reason, 'inicio']));
}

// Registra uma falha que o usuário viu (ex.: erro ao salvar), com o lugar onde aconteceu.
export function reportError(err, where = 'app') {
  if (!ready) {
    if (pending.length < 20) pending.push([err, where]);
    return;
  }
  const S = window.Sentry;
  S.withScope((scope) => {
    scope.setTag('onde', where);
    if (err instanceof Error) S.captureException(err);
    else S.captureMessage(scrub(err?.message || err), 'error');
  });
}
