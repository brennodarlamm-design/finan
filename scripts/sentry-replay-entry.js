// scripts/sentry-replay-entry.js — Session Replay do Sentry, carregado sob demanda.
// AUDITORIA 2026-10-04 #35: o js/sentry.js injeta este arquivo só no app e no painel master,
// depois do carregamento. Ele usa o cliente já iniciado pelo js/sentry.js (window.Sentry); as
// taxas de amostragem (replaysSessionSampleRate / replaysOnErrorSampleRate) vêm daquele init.
import { replayIntegration } from '@sentry/browser';

if (typeof window !== 'undefined' && window.Sentry && typeof window.Sentry.addIntegration === 'function') {
  window.Sentry.addIntegration(replayIntegration());
}
