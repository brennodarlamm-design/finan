// scripts/sentry-entry.js — Ponto de entrada para empacotar o Sentry Browser
import {
  init, browserTracingIntegration, addIntegration, setUser, setTag, setContext,
  captureException, captureMessage, addBreadcrumb, withScope, getClient
} from '@sentry/browser';

// Só o que o app usa fica exposto; importar o SDK inteiro (`import * as`) impedia o tree-shaking
// e trazia o Replay de volta para o bundle principal.
const Sentry = { init, browserTracingIntegration, addIntegration, setUser, setTag, setContext, captureException, captureMessage, addBreadcrumb, withScope, getClient };

const isDev = typeof window !== 'undefined' && Boolean(window.location) && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

const release = typeof __SENTRY_RELEASE__ !== 'undefined'
  ? __SENTRY_RELEASE__
  : (typeof process !== 'undefined' && process.env?.SENTRY_RELEASE ? process.env.SENTRY_RELEASE : undefined);

Sentry.init({
  dsn: "https://4cbf4bd58a1c50cedb4dae263b24008f@o4511236225892352.ingest.us.sentry.io/4512148402929664",
  release: release,
  environment: isDev ? 'development' : 'production',
  tracesSampleRate: isDev ? 1.0 : 0.2,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  // AUDITORIA 2026-10-04 #35: o Replay (a maior parte do bundle) não vem mais aqui. Ele fica em
  // /js/sentry-replay.js e só é carregado no app e no painel master, depois que a página termina
  // de carregar. Login, landing e demais páginas levam só a captura de erros e o tracing.
  integrations: [
    Sentry.browserTracingIntegration()
  ],
  beforeSend(event) {
    // Sanitiza cabeçalhos sensíveis antes do envio para o Sentry
    if (event.request && event.request.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  }
});

function carregarReplay() {
  if (typeof document === 'undefined') return;
  const pagina = String(window.location?.pathname || '');
  if (!/^\/(app|master)(\.html)?(\/|$)/.test(pagina)) return;
  const injetar = () => {
    if (document.querySelector('script[data-sentry-replay]')) return;
    const script = document.createElement('script');
    script.src = '/js/sentry-replay.js';
    script.async = true;
    script.dataset.sentryReplay = '1';
    document.head.appendChild(script);
  };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(injetar, { timeout: 5000 });
  else setTimeout(injetar, 2000);
}

if (typeof window !== 'undefined') {
  window.Sentry = Sentry;
  if (typeof document !== 'undefined' && document.readyState === 'complete') carregarReplay();
  else window.addEventListener?.('load', carregarReplay, { once: true });

  window.addEventListener?.('load', () => {
    try {
      if (window.Auth && typeof window.Auth.getUser === 'function') {
        const u = window.Auth.getUser();
        if (u && u.id) {
          Sentry.setUser({
            id: u.id,
            username: u.username,
            tenant_id: u.tenantId || u.tenant_id,
            perfil: u.perfil
          });
        }
      }
    } catch {}
  });
}

export default Sentry;
