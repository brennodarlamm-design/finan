// frontend/modules/configuracoes.js — Módulo de Configurações & Administração (Bounded Context: configuracoes)
export const Configuracoes = {
  get Configuracoes() { return typeof window !== 'undefined' ? window.Configuracoes : undefined; },
  get Master() { return typeof window !== 'undefined' ? window.Master : undefined; },
  get MasterPage() { return typeof window !== 'undefined' ? window.MasterPage : undefined; },
  get DevTenantKeys() { return typeof window !== 'undefined' ? window.DevTenantKeys : undefined; },
  get Academia() { return typeof window !== 'undefined' ? window.Academia : undefined; },
  get OCR() { return typeof window !== 'undefined' ? window.OCR : undefined; }
};
export default Configuracoes;
