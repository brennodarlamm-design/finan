// scripts/sentry-entry.js — Ponto de entrada para empacotar o Sentry Browser
import * as Sentry from '@sentry/browser';

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
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration()
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

if (typeof window !== 'undefined') {
  window.Sentry = Sentry;

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
