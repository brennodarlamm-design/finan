// frontend/modules/core.js — Kernel e Infraestrutura Frontend
export const Core = {
  get Auth() { return typeof window !== 'undefined' ? window.Auth : undefined; },
  get DB() { return typeof window !== 'undefined' ? window.DB : undefined; },
  get UI() { return typeof window !== 'undefined' ? window.UI : undefined; },
  get Utils() { return typeof window !== 'undefined' ? window.Utils : undefined; },
  get Assets() { return typeof window !== 'undefined' ? window.Assets : undefined; },
  get Storage() { return typeof window !== 'undefined' ? window.IDBStorage : undefined; },
  get Sentry() { return typeof window !== 'undefined' ? window.Sentry : undefined; }
};
export default Core;
