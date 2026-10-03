// backend/billing_stages.js — Estágio do aviso de cobrança conforme os dias até o vencimento.
//
// VARREDURA 2026-10-03 #16: os avisos usavam dia exato (10, 3, 0, -1, -5) e o cron roda de
// segunda a sexta, então o que caía no fim de semana nunca saía. Agora são faixas; o
// anti-spam do servidor (billing_notifications_sent) garante um envio por estágio e ciclo.

export function billingStageFor(plano, diasRestantes) {
  const d = Number(diasRestantes);
  const out = { stage: null, templateType: null, situacaoTxt: '', badgeStatus: 'Aviso' };
  if (!Number.isFinite(d)) return out;
  if (plano === 'trial' && d <= 2 && d >= 0) {
    return { stage: 'trial_ending', templateType: 'trial_ending', situacaoTxt: d === 0 ? 'termina hoje' : `termina em ${d} dia(s)`, badgeStatus: 'Fim do Trial' };
  }
  if (d >= 4 && d <= 10) return { stage: 'reminder_10d', templateType: 'reminder', situacaoTxt: `vence em ${d} dias`, badgeStatus: `Vence em ${d}d` };
  if (d >= 1 && d <= 3) return { stage: 'reminder_3d', templateType: 'reminder', situacaoTxt: d === 1 ? 'vence amanhã' : `vence em ${d} dias`, badgeStatus: `Vence em ${d}d` };
  if (d === 0) return { stage: 'due_today', templateType: 'due_today', situacaoTxt: 'vence hoje', badgeStatus: 'Vence Hoje' };
  if (d <= -1 && d >= -4) return { stage: 'overdue_1d', templateType: 'overdue', situacaoTxt: `vencido há ${-d} dia${d === -1 ? '' : 's'}`, badgeStatus: `Vencido há ${-d}d` };
  if (d <= -5 && d >= -15) return { stage: 'overdue_5d', templateType: 'overdue', situacaoTxt: `vencido há ${-d} dias`, badgeStatus: `Vencido há ${-d}d` };
  return out;
}
