// api/_edge-alerts.js — Despachante de Alertas Críticos de Incidentes e Falhas no Edge
// Dispara notificações instantâneas para canais operacionais (WhatsApp/Telegram/Logs) com controle de taxa (throttle).

const recentAlerts = new Map(); // signature -> timestamp
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos de cooldown por assinatura de erro

/**
 * Gera uma assinatura única para o incidente para evitar repetições.
 */
function getAlertSignature(type, key) {
  return `${type}:${String(key || '').trim().toLowerCase()}`;
}

/**
 * Dispara um alerta operacional de incidente no Edge.
 */
export async function dispatchEdgeAlert(env, alert) {
  const {
    type = 'SYSTEM_ERROR',
    severity = 'CRITICAL',
    title = 'Alerta no Edge FinGo',
    message = '',
    details = {},
    source = 'cloudflare_worker'
  } = alert || {};

  const signature = getAlertSignature(type, title);
  const now = Date.now();
  const lastSent = recentAlerts.get(signature);

  // Aplica throttle: não reenvia o mesmo erro se ocorreu nos últimos 5 minutos
  if (lastSent && now - lastSent < ALERT_COOLDOWN_MS) {
    return {
      dispatched: false,
      throttled: true,
      reason: 'Cooldown ativo para este tipo de alerta.',
      signature
    };
  }

  recentAlerts.set(signature, now);

  const payload = {
    timestamp: new Date().toISOString(),
    severity,
    type,
    title,
    message,
    details,
    source
  };

  console.warn(`[FinGo Edge Alert] [${severity}] ${type}: ${title} — ${message}`, details);

  // 1. Envio via WhatsApp Operacional (se configurado)
  const targetPhone = env?.FINOBRA_SUPPORT_WHATSAPP || process.env?.FINOBRA_SUPPORT_WHATSAPP;
  let whatsappDispatched = false;

  if (targetPhone && severity === 'CRITICAL') {
    try {
      const alertMsg = `🚨 *[FinGo Edge Alert - ${severity}]*\n*Tipo:* ${type}\n*Título:* ${title}\n*Detalhe:* ${message}\n*Horário:* ${new Date().toISOString()}`;
      const renderBase = String(env?.RENDER_WHATSAPP_URL || env?.RENDER_HEALTH_URL || process.env?.RENDER_WHATSAPP_URL || 'https://finan-backend-9rxw.onrender.com')
        .replace(/\/healthz\/?$/, '')
        .replace(/\/+$/, '');
      const internalSecret = String(env?.INTERNAL_API_SECRET || process.env?.INTERNAL_API_SECRET || '').trim();
      if (!internalSecret) throw new Error('INTERNAL_API_SECRET não configurado para alertas operacionais.');

      const response = await fetch(`${renderBase}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalSecret}`,
          'x-api-key': internalSecret,
          'x-tenant-id': String(env?.FINOBRA_MASTER_TENANT || 'angelim')
        },
        body: JSON.stringify({
          phone: String(targetPhone).replace(/\D/g, ''),
          number: String(targetPhone).replace(/\D/g, ''),
          message: alertMsg,
          text: alertMsg
        }),
        signal: AbortSignal.timeout(8000)
      });
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok || !(responseData.success || responseData.messageId)) {
        throw new Error(responseData.error || `HTTP ${response.status}`);
      }
      whatsappDispatched = true;
    } catch (err) {
      console.warn('[FinGo Edge Alert] Falha ao enviar alerta WhatsApp:', err?.message || err);
    }
  }

  // Limpeza periódica do mapa de alertas (mantém até 500 itens)
  if (recentAlerts.size > 500) {
    for (const [k, ts] of recentAlerts.entries()) {
      if (now - ts > ALERT_COOLDOWN_MS) recentAlerts.delete(k);
    }
  }

  return {
    dispatched: true,
    throttled: false,
    signature,
    payload,
    channels: {
      console: true,
      whatsapp: whatsappDispatched
    }
  };
}

/**
 * Reseta o mapa de histórico de alertas (útil para suíte de testes).
 */
export function _resetAlertsHistory() {
  recentAlerts.clear();
}
