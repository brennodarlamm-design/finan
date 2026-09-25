// frontend/modules/financeiro.js — Módulo Financeiro (Bounded Context: financeiro)
export const Financeiro = {
  get Contas() { return typeof window !== 'undefined' ? window.Contas : undefined; },
  get Lancamentos() { return typeof window !== 'undefined' ? window.Lancamentos : undefined; },
  get Recibos() { return typeof window !== 'undefined' ? window.Recibos : undefined; },
  get Parcelamento() { return typeof window !== 'undefined' ? window.Parcelamento : undefined; },
  get Cobranca() { return typeof window !== 'undefined' ? window.Cobranca : undefined; },
  get Exportar() { return typeof window !== 'undefined' ? window.Exportar : undefined; },
  get Ofx() { return typeof window !== 'undefined' ? window.Ofx : undefined; },
  get ImportarExcel() { return typeof window !== 'undefined' ? window.ImportarExcel : undefined; },
  get ExportarTemplates() { return typeof window !== 'undefined' ? window.ExportarTemplates : undefined; }
};
export default Financeiro;
