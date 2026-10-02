// scripts/test-audit-2026-10-02-r9.js
// Regressões da nona rodada da auditoria de 02/10/2026 (Y1 — minimização de dados no link do portal).
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

process.env.SESSION_SIGNING_SECRET ||= 'test-only-session-signing-secret-r9-0123456789';

console.log('=== Auditoria 2026-10-02 (9ª rodada) — regressões ===\n');

// Y1 — CPF/CNPJ do cliente e valor financiado não vão no link do portal.
{
  for (const f of ['js/portal_cliente.js', 'frontend/domains/gestao/portal_cliente.js']) {
    const src = read(f);
    assert(!src.includes('doc: obra.cpf_cnpj') && !src.includes('doc: obraLocal.cpf_cnpj'), `${f}: sem CPF/CNPJ no payload`);
    assert(!src.includes('v: obra.valor_financiado') && !src.includes('v: obraLocal.valor_financiado'), `${f}: sem valor financiado no payload`);
  }
  const portal = await import('../api/_portal-link.js');
  const pdata = portal.encodePortalPayload({ t: 'x', o: { id: 'ob1', n: 'Casa', doc: '123.456.789-00', v: 350000 } });
  let body;
  const res = { status() { return this; }, json(b) { body = b; return this; }, setHeader() {} };
  await portal.handlePortalLinkSign({ method: 'POST', headers: {}, body: { pdata } }, res, {
    resolveAuth: async () => ({ authenticated: true, tenantId: 'acme', user: { id: 'u1', perfil: 'admin', tenantPlan: 'profissional' } }),
    sql: async () => [{ nome_fantasia: 'Acme' }]
  });
  const bundle = portal.decodePortalPayload(body.pdata);
  assert.strictEqual(bundle.o.doc, undefined, 'Y1: servidor remove CPF/CNPJ');
  assert.strictEqual(bundle.o.v, undefined, 'Y1: servidor remove valor financiado');
  assert(read('backend/domains/edge/_portal-link.js') === read('api/_portal-link.js'), 'espelho idêntico');
  console.log('  ✓ Y1 link do portal sem CPF/CNPJ do cliente e sem valor financiado');
}

console.log('\n✅ Auditoria 2026-10-02 (9ª rodada): todas as regressões passaram.');
