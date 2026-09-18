import test from 'node:test';
import assert from 'node:assert';
import { handleFullSnapshot } from '../api/_db-queries.js';

test('handleFullSnapshot retorna success: true, tenantId e envelope data com espalhamento retrocompativel', async () => {
  const fakeSql = (strings, ...values) => {
    return Promise.resolve([]);
  };

  const fakeRes = {
    statusCode: null,
    headers: {},
    payload: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; }
  };

  const fakeAuth = {
    authenticated: true,
    tenantId: 'tenant-test-123',
    user: { perfil: 'admin', tenantPlan: 'pro' }
  };

  await handleFullSnapshot(fakeSql, 'tenant-test-123', fakeAuth, fakeRes);

  assert.strictEqual(fakeRes.statusCode, 200, 'HTTP Status deve ser 200');
  assert.strictEqual(fakeRes.payload.success, true, 'payload.success deve ser true');
  assert.strictEqual(fakeRes.payload.tenantId, 'tenant-test-123', 'tenantId deve ser preservado');
  assert.ok(fakeRes.payload.data, 'payload.data deve existir');
  assert.ok(Array.isArray(fakeRes.payload.data.clientes), 'payload.data.clientes deve ser array');
  assert.ok(Array.isArray(fakeRes.payload.clientes), 'payload.clientes (retrocompatibilidade) deve ser array');
  assert.ok(Array.isArray(fakeRes.payload.data.lancamentos), 'payload.data.lancamentos deve ser array');
  assert.ok(Array.isArray(fakeRes.payload.lancamentos), 'payload.lancamentos (retrocompatibilidade) deve ser array');
});

test('Parsing de snapshot no client suporta tanto envelope { success, data } quanto objeto direto', () => {
  const extractPayload = (json) => {
    const payload = (json && json.data && typeof json.data === 'object')
      ? json.data
      : (json && typeof json === 'object' && Array.isArray(json.clientes) ? json : null);
    if (!payload) throw new Error('Snapshot da nuvem invalido');
    return payload;
  };

  // Formato Envelopado
  const enveloped = { success: true, data: { clientes: [{ id: 1 }] } };
  const p1 = extractPayload(enveloped);
  assert.deepStrictEqual(p1, { clientes: [{ id: 1 }] });

  // Formato Direto
  const direct = { clientes: [{ id: 2 }], lancamentos: [] };
  const p2 = extractPayload(direct);
  assert.deepStrictEqual(p2, direct);

  // Formato Invalido
  assert.throws(() => extractPayload({ success: false }), /Snapshot da nuvem invalido/);
  assert.throws(() => extractPayload(null), /Snapshot da nuvem invalido/);
  assert.throws(() => extractPayload({ foo: 'bar' }), /Snapshot da nuvem invalido/);
});
