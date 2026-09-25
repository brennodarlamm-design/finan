// frontend/modules/suprimentos.js — Módulo de Suprimentos & Compras (Bounded Context: suprimentos)
export const Suprimentos = {
  get Precompras() { return typeof window !== 'undefined' ? window.Precompras : undefined; },
  get PrecomprasWorkflow() { return typeof window !== 'undefined' ? window.PrecomprasWorkflow : undefined; },
  get Produtos() { return typeof window !== 'undefined' ? window.Produtos : undefined; },
  get Fornecedores() { return typeof window !== 'undefined' ? window.Fornecedores : undefined; }
};
export default Suprimentos;
