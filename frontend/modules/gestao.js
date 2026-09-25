// frontend/modules/gestao.js — Módulo de Gestão & BI (Bounded Context: gestao)
export const Gestao = {
  get Dashboard() { return typeof window !== 'undefined' ? window.Dashboard : undefined; },
  get CentralGestor() { return typeof window !== 'undefined' ? window.CentralGestor : undefined; },
  get MinhasDemandas() { return typeof window !== 'undefined' ? window.MinhasDemandas : undefined; },
  get AgendaEventos() { return typeof window !== 'undefined' ? window.AgendaEventos : undefined; },
  get PortalCliente() { return typeof window !== 'undefined' ? window.PortalCliente : undefined; },
  get Escritorio() { return typeof window !== 'undefined' ? window.Escritorio : undefined; }
};
export default Gestao;
