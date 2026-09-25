// frontend/modules/contratos.js — Módulo de Contratos & Documentos (Bounded Context: contratos)
export const Contratos = {
  get Contratos() { return typeof window !== 'undefined' ? window.Contratos : undefined; },
  get Assinador() { return typeof window !== 'undefined' ? window.Assinador : undefined; },
  get Documentos() { return typeof window !== 'undefined' ? window.Documentos : undefined; },
  get GDrive() { return typeof window !== 'undefined' ? window.GDrive : undefined; },
  get ValidarPage() { return typeof window !== 'undefined' ? window.ValidarPage : undefined; }
};
export default Contratos;
