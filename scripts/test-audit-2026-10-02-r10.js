// scripts/test-audit-2026-10-02-r10.js
// Regressões da décima rodada da auditoria de 02/10/2026 (Z1 — token das instâncias do Evolution Go).
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('=== Auditoria 2026-10-02 (10ª rodada) — regressões ===\n');

const mod = await import('../backend/domains/atendimento/evolution_client.js');
const { EvolutionGoClient, generateInstanceToken, isLegacyPredictableInstanceToken } = mod;

// Z1 — Token aleatório e detecção do formato antigo.
{
  const a = generateInstanceToken();
  const b = generateInstanceToken();
  assert(/^fgo_[0-9a-f]{48}$/.test(a), 'Z1: token com 192 bits aleatórios');
  assert.notStrictEqual(a, b, 'Z1: tokens diferentes a cada geração');
  assert.strictEqual(isLegacyPredictableInstanceToken({ name: 'angelim', token: 'token_angelim_fingo' }), true);
  assert.strictEqual(isLegacyPredictableInstanceToken({ name: 'angelim', token: a }), false);
  const src = read('backend/domains/atendimento/evolution_client.js');
  assert(!src.includes('const token = `token_${instanceName}_fingo`;'), 'Z1: geração previsível removida');
  console.log('  ✓ Z1 token de instância aleatório');
}

// Z1 — Instância antiga desconectada é recriada com token novo ao pedir o QR.
{
  const client = new EvolutionGoClient({ baseUrl: 'http://evo.test' });
  const calls = [];
  let instances = [{ id: 'i1', name: 'acme', token: 'token_acme_fingo', connected: false, qrcode: '' }];
  client.request = async (pathName, opts = {}) => {
    calls.push({ pathName, opts });
    if (pathName === '/instance/all') return { ok: true, data: { data: instances } };
    if (pathName.startsWith('/instance/delete/')) { instances = []; return { ok: true, status: 200, data: {} }; }
    if (pathName === '/instance/create') {
      instances = [{ id: 'i2', name: opts.body.name, token: opts.body.token, connected: false, qrcode: 'QRDATA' }];
      return { ok: true, data: { data: { id: 'i2' } } };
    }
    return { ok: true, status: 200, data: {} };
  };
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realTimeout(fn, 0);
  try {
    await client.getQrCode('acme');
  } finally {
    globalThis.setTimeout = realTimeout;
  }
  assert(calls.some(c => c.pathName.startsWith('/instance/delete/')), 'Z1: instância antiga removida');
  const created = calls.find(c => c.pathName === '/instance/create');
  assert(created && /^fgo_/.test(created.opts.body.token), 'Z1: instância recriada com token aleatório');
  console.log('  ✓ Z1 instância antiga desconectada é recriada com token novo');
}

// Z2 — Chave global do Evolution: padrão público e chave curta em produção são recusados.
{
  const { evolutionApiKeyProblem } = mod;
  assert(evolutionApiKeyProblem('fingo-evo-secret-change-me-in-production', {}), 'Z2: padrão público recusado');
  assert(evolutionApiKeyProblem('', {}), 'Z2: chave vazia recusada');
  assert(evolutionApiKeyProblem('curta', { NODE_ENV: 'production' }), 'Z2: chave curta recusada em produção');
  assert.strictEqual(evolutionApiKeyProblem('a'.repeat(32), { NODE_ENV: 'production' }), '', 'Z2: chave forte aceita');
  const weak = new EvolutionGoClient({ baseUrl: 'http://evo.test', apiKey: 'fingo-evo-secret-change-me-in-production' });
  assert.strictEqual(weak.isConfigured(), false, 'Z2: integração bloqueada com chave padrão');
  assert(!read('docker-compose.evolution-go.yml').includes('fingo-evo-secret-change-me-in-production'), 'Z2: compose sem chave padrão');
  assert(!read('.env.evolution-go.example').includes('fingo-evo-secret-change-me-in-production'), 'Z2: exemplo sem chave padrão');
  console.log('  ✓ Z2 chave global fraca ou padrão bloqueia a integração');
}

console.log('\n✅ Auditoria 2026-10-02 (10ª rodada): todas as regressões passaram.');
