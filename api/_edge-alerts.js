// api/_edge-alerts.js — Despachante de Alertas Críticos de Incidentes e Falhas no Edge
// Dispara notificações instantâneas para canais operacionais (WhatsApp/Telegram/Logs) com controle de taxa (throttle).

const recentAlerts = new Map(); // signature -> timestamp
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos após entrega/log bem-sucedido
const ALERT_RETRY_COOLDOWN_MS = 30 * 1000; // retry curto quando o canal operacional falha

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
  const lastWindow = recentAlerts.get(signature);
  const lastSentAt = typeof lastWindow === 'number' ? lastWindow : Number(lastWindow?.timestamp || 0);
  const cooldownMs = typeof lastWindow === 'number'
    ? ALERT_COOLDOWN_MS
    : Number(lastWindow?.cooldownMs || ALERT_COOLDOWN_MS);

  // Em falha de canal externo usamos uma janela curta, permitindo nova tentativa sem
  // transformar cada erro 5xx em uma tempestade de notificações.
  if (lastSentAt && now - lastSentAt < cooldownMs) {
    return {
      dispatched: false,
      throttled: true,
      reason: cooldownMs === ALERT_RETRY_COOLDOWN_MS
        ? 'Retry operacional aguardando a janela curta de 30 segundos.'
        : 'Cooldown ativo para este tipo de alerta.',
      retryAfterMs: Math.max(0, cooldownMs - (now - lastSentAt)),
      signature
    };
  }

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

  const externalChannelRequired = Boolean(targetPhone && severity === 'CRITICAL');
  const appliedCooldownMs = externalChannelRequired && !whatsappDispatched
    ? ALERT_RETRY_COOLDOWN_MS
    : ALERT_COOLDOWN_MS;
  recentAlerts.set(signature, { timestamp: now, cooldownMs: appliedCooldownMs });

  // Limpeza periódica do mapa de alertas (mantém até 500 itens)
  if (recentAlerts.size > 500) {
    for (const [k, window] of recentAlerts.entries()) {
      const ts = typeof window === 'number' ? window : Number(window?.timestamp || 0);
      if (!ts || now - ts > ALERT_COOLDOWN_MS) recentAlerts.delete(k);
    }
  }

  return {
    dispatched: true,
    throttled: false,
    signature,
    payload,
    retryAfterMs: externalChannelRequired && !whatsappDispatched ? ALERT_RETRY_COOLDOWN_MS : 0,
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
