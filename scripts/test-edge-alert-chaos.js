import assert from 'node:assert/strict';
import { _resetAlertsHistory, dispatchEdgeAlert } from '../api/_edge-alerts.js';

const realFetch = globalThis.fetch;
const realNow = Date.now;
let now = 1_800_000_000_000;
Date.now = () => now;

const env = {
  FINOBRA_SUPPORT_WHATSAPP: '5595999999999',
  INTERNAL_API_SECRET: 'test-internal-secret',
  RENDER_WHATSAPP_URL: 'https://whatsapp.invalid'
};
const alert = {
  type: 'CHAOS_PROVIDER_FAILURE',
  severity: 'CRITICAL',
  title: 'Teste de indisponibilidade do canal operacional',
  message: 'Falha simulada do provedor.'
};

try {
  _resetAlertsHistory();

  globalThis.fetch = async () => {
    throw new Error('simulated-provider-down');
  };

  const failed = await dispatchEdgeAlert(env, alert);
  assert.equal(failed.dispatched, true);
  assert.equal(failed.throttled, false);
  assert.equal(failed.channels.whatsapp, false);
  assert.equal(failed.retryAfterMs, 30_000, 'Falha externa deve usar retry curto, não cooldown de 5 minutos.');

  const immediate = await dispatchEdgeAlert(env, alert);
  assert.equal(immediate.throttled, true);
  assert.ok(immediate.retryAfterMs > 0 && immediate.retryAfterMs <= 30_000);

  now += 31_000;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() { return { success: true, messageId: 'msg-chaos-ok' }; }
  });

  const recovered = await dispatchEdgeAlert(env, alert);
  assert.equal(recovered.throttled, false, 'Canal deve ser tentado novamente após a janela curta.');
  assert.equal(recovered.channels.whatsapp, true);
  assert.equal(recovered.retryAfterMs, 0);

  const afterSuccess = await dispatchEdgeAlert(env, alert);
  assert.equal(afterSuccess.throttled, true, 'Após entrega, deve aplicar cooldown normal anti-flood.');
  assert.ok(afterSuccess.retryAfterMs > 4 * 60 * 1000);

  console.log('✅ Chaos test de alertas: falha, retry curto, recuperação e anti-flood validados.');
} finally {
  globalThis.fetch = realFetch;
  Date.now = realNow;
  _resetAlertsHistory();
}
