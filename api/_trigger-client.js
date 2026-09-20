// api/_trigger-client.js — Dispatcher Serverless de Tarefas para Trigger.dev
// Permite que as funções da Vercel despachem tarefas em background sem esperar execução pesada.

import { tasks } from '@trigger.dev/sdk';

export function getTriggerSecretKey() {
  return (process.env.TRIGGER_SECRET_KEY || process.env.TRIGGER_API_KEY || '').trim();
}

export function isTriggerConfigured() {
  const key = getTriggerSecretKey();
  return Boolean(key && key.startsWith('tr_'));
}

function withDeadline(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} excedeu ${timeoutMs}ms`);
      err.name = 'TimeoutError';
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Despacha uma tarefa para o Trigger.dev de forma assíncrona e desacoplada.
 * Retorna imediatamente com o ID da execução (runId) ou fallback seguro se não configurado.
 */
export async function triggerJob(taskId, payload = {}, options = {}) {
  const key = getTriggerSecretKey();
  if (!key) {
    console.warn(`[TriggerClient] ⚠️ TRIGGER_SECRET_KEY não configurada. Tarefa '${taskId}' não despachada em modo live.`);
    return { success: false, mode: 'unconfigured', taskId, skipped: true };
  }

  const idempotencyKey = options.idempotencyKey || options.idempotency_key;

  try {
    // Utiliza o SDK oficial @trigger.dev/sdk para enfileirar a execução
    const handle = await withDeadline(tasks.trigger(taskId, payload, {
      idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
      delay: options.delay,
      tags: options.tags || ['finobra', String(options.tenantId || 'public')]
    }), Number(options.timeoutMs || 8000), 'Trigger.dev SDK');

    return {
      success: true,
      taskId,
      runId: handle?.id || null,
      handle
    };
  } catch (err) {
    console.warn(`[TriggerClient] Falha ao despachar '${taskId}' via SDK; tentando HTTP REST direto:`, err?.message || err);

    // Fallback direto via REST API do Trigger.dev v3
    try {
      const res = await fetch(`https://api.trigger.dev/api/v1/tasks/${encodeURIComponent(taskId)}/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          payload,
          options: {
            idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
            tags: options.tags || ['finobra', String(options.tenantId || 'public')]
          }
        }),
        signal: AbortSignal.timeout(Number(options.timeoutMs || 8000))
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, taskId, runId: data?.id || data?.runId || null, data };
      }

      console.error(`[TriggerClient] Erro na API REST do Trigger.dev [${res.status}]:`, data);
      return { success: false, error: data?.message || `HTTP ${res.status}`, taskId };
    } catch (restErr) {
      console.error(`[TriggerClient] Erro crítico de rede ao despachar '${taskId}':`, restErr?.message || restErr);
      return { success: false, error: restErr?.message || 'Falha de conexão com Trigger.dev', taskId };
    }
  }
}

// Helpers de atalho para as tarefas principais do FinObra
export async function triggerEmail(payload, options = {}) {
  return triggerJob('send-transactional-email', payload, options);
}

export async function triggerBillingSweep(payload = {}, options = {}) {
  return triggerJob('scheduled-billing-sweep', payload, options);
}

export async function triggerSlaAudit(payload = {}, options = {}) {
  return triggerJob('daily-sla-audit', payload, options);
}

export async function triggerOcr(payload, options = {}) {
  return triggerJob('async-fiscal-ocr', payload, options);
}

export async function triggerNeonMaintenance(payload = {}, options = {}) {
  return triggerJob('weekly-neon-maintenance', payload, options);
}
