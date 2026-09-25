// frontend/modules/atendimento.js — Módulo de Atendimento & Notificações (Bounded Context: atendimento)
export const Atendimento = {
  get Suporte() { return typeof window !== 'undefined' ? window.Suporte : undefined; },
  get SuporteDev() { return typeof window !== 'undefined' ? window.SuporteDev : undefined; },
  get WhatsApp() { return typeof window !== 'undefined' ? window.WhatsApp : undefined; },
  get Notificacoes() { return typeof window !== 'undefined' ? window.Notificacoes : undefined; }
};
export default Atendimento;
