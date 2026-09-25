// frontend/modules/fiscal.js — Módulo Fiscal (Bounded Context: fiscal)
export const Fiscal = {
  get Notas() { return typeof window !== 'undefined' ? window.Notas : undefined; },
  get NFe() { return typeof window !== 'undefined' ? window.NFe : undefined; },
  get NfeParser() { return typeof window !== 'undefined' ? window.NfeParser : undefined; }
};
export default Fiscal;
