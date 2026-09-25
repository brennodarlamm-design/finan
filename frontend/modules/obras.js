// frontend/modules/obras.js — Módulo de Obras & Engenharia (Bounded Context: obras)
export const Obras = {
  get Clientes() { return typeof window !== 'undefined' ? window.Clientes : undefined; },
  get ObraDetalhe() { return typeof window !== 'undefined' ? window.ObraDetalhe : undefined; },
  get Medicoes() { return typeof window !== 'undefined' ? window.Medicoes : undefined; },
  get CronogramaSLA() { return typeof window !== 'undefined' ? window.CronogramaSLA : undefined; },
  get FasesDoc() { return typeof window !== 'undefined' ? window.FasesDoc : undefined; },
  get BIMViewer() { return typeof window !== 'undefined' ? window.BIMViewer : undefined; },
  get BIMClashEngine() { return typeof window !== 'undefined' ? window.BIMClashEngine : undefined; },
  get BIMCSG() { return typeof window !== 'undefined' ? window.BIMCSG : undefined; },
  get BIMGeometryImporter() { return typeof window !== 'undefined' ? window.BIMGeometryImporter : undefined; },
  get BIMPresets() { return typeof window !== 'undefined' ? window.BIMPresets : undefined; },
  get BIMStudio() { return typeof window !== 'undefined' ? window.BIMStudio : undefined; },
  get BIMIFCExtended() { return typeof window !== 'undefined' ? window.BIMIFCExtended : undefined; },
  get CalculadoraBDI() { return typeof window !== 'undefined' ? window.CalculadoraBDI : undefined; },
  get Orcamentos() { return typeof window !== 'undefined' ? window.Orcamentos : undefined; },
  get OrcamentoBancos() { return typeof window !== 'undefined' ? window.OrcamentoBancos : undefined; },
  get OrcamentoProposta() { return typeof window !== 'undefined' ? window.OrcamentoProposta : undefined; },
  get OrcamentoSinapi() { return typeof window !== 'undefined' ? window.OrcamentoSinapi : undefined; },
  get OrcamentoTemplates() { return typeof window !== 'undefined' ? window.OrcamentoTemplates : undefined; },
  get Sinapi() { return typeof window !== 'undefined' ? window.Sinapi : undefined; }
};
export default Obras;
