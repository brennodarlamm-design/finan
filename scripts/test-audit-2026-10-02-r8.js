// scripts/test-audit-2026-10-02-r8.js
// Regressões da oitava rodada da auditoria de 02/10/2026 (X4 — links assinados do Portal do Cliente).
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

process.env.SESSION_SIGNING_SECRET ||= 'test-only-session-signing-secret-r8-0123456789';

console.log('=== Auditoria 2026-10-02 (8ª rodada) — portal do cliente assinado ===\n');

const portal = await import('../api/_portal-link.js');

function mockRes() {
  let status = 200; let body; const headers = {};
  return {
    status(c) { status = c; return this; }, json(b) { body = b; return this; },
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    get statusCode() { return status; }, get body() { return body; }
  };
}

// Assinatura: válida, adulterada, vencida, sem assinatura.
{
  const pdata = portal.encodePortalPayload({ t: 'acme', o: { id: 'ob1', n: 'Casa' } });
  const exp = Date.now() + 60_000;
  const sig = portal.signPortalLink(pdata, exp);
  assert.strictEqual(portal.verifyPortalLink({ pdata, exp, sig }).valid, true, 'link assinado válido');
  const forged = portal.encodePortalPayload({ t: 'acme', o: { id: 'ob1', n: 'Casa' }, emp: { tel: '5599999999999' } });
  assert.strictEqual(portal.verifyPortalLink({ pdata: forged, exp, sig }).valid, false, 'payload alterado é recusado');
  assert.strictEqual(portal.verifyPortalLink({ pdata, exp: exp + 1, sig }).valid, false, 'validade alterada é recusada');
  assert.strictEqual(portal.verifyPortalLink({ pdata, exp: Date.now() - 1, sig: portal.signPortalLink(pdata, Date.now() - 1) }).valid, false, 'link vencido é recusado');
  assert.strictEqual(portal.verifyPortalLink({ pdata, exp, sig: '' }).valid, false, 'sem assinatura é recusado');
  console.log('  ✓ X4 assinatura HMAC: adulteração, validade e ausência recusadas');
}

// Geração: exige login, força o tenant autenticado e usa dados da construtora do banco.
{
  const res401 = mockRes();
  await portal.handlePortalLinkSign({ method: 'POST', headers: {}, body: {} }, res401, { resolveAuth: async () => ({ authenticated: false, status: 401 }) });
  assert.strictEqual(res401.statusCode, 401, 'gerar link exige login');

  const forjado = portal.encodePortalPayload({ t: 'outra', o: { id: 'ob1', n: 'Casa' }, emp: { n: 'Golpe', tel: '5599999999999' } });
  const res = mockRes();
  const auth = { authenticated: true, tenantId: 'acme', user: { id: 'u1', perfil: 'admin', tenantPlan: 'profissional' } };
  const sql = async () => [{ nome_fantasia: 'Acme Construtora', razao_social: 'Acme LTDA', logo_url: '', telefone: '95999990000', responsavel: 'Eng. Ana' }];
  await portal.handlePortalLinkSign({ method: 'POST', headers: {}, body: { pdata: forjado } }, res, { resolveAuth: async () => auth, sql });
  assert.strictEqual(res.statusCode, 200, 'link gerado');
  const bundle = portal.decodePortalPayload(res.body.pdata);
  assert.strictEqual(bundle.t, 'acme', 'tenant do link = tenant autenticado');
  assert.strictEqual(bundle.emp.n, 'Acme Construtora', 'nome da construtora vem do cadastro');
  assert.strictEqual(bundle.emp.tel, '95999990000', 'telefone vem do cadastro');
  assert.strictEqual(portal.verifyPortalLink(res.body).valid, true, 'link gerado é verificável');
  console.log('  ✓ X4 link gerado só com login, para a própria empresa e com dados do cadastro');
}

// Verificação pública.
{
  const res = mockRes();
  await portal.handlePortalLinkVerify({ method: 'POST', headers: {}, body: { pdata: 'eyJ9', exp: Date.now() + 1000, sig: 'x' } }, res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.valid, false);
  const v2 = read('api/_v2-routes.js');
  assert(v2.includes("pathname === '/api/v2/portal/link'") && v2.includes("pathname === '/api/v2/portal/verify'"), 'rotas registradas');
  console.log('  ✓ X4 verificação pública recusa link inválido');
}

// Frontend: sem token previsível, link pedido ao servidor e página só após verificar.
{
  for (const f of ['js/portal_cliente.js', 'frontend/domains/gestao/portal_cliente.js']) {
    const src = read(f);
    assert(!src.includes('finobra_portal_'), `${f}: token previsível removido`);
    assert(!src.includes('getUrlPortal('), `${f}: gerador de link sem assinatura removido`);
    assert(src.includes("fetch('/api/v2/portal/link'"), `${f}: link pedido ao servidor`);
    assert(src.includes("fetch('/api/v2/portal/verify'"), `${f}: página pública verifica assinatura`);
    const pub = src.slice(src.indexOf('renderTelaPublica(searchParams) {'), src.indexOf('async _verificarLinkAssinado('));
    assert(pub.indexOf('_verificarLinkAssinado(pdata') > 0 && !pub.includes('this._decodificarPayload(pdata);\n'), `${f}: payload só decodificado após verificação`);
  }
  for (const f of ['js/patch26-events.js', 'frontend/core/patch26-events.js']) {
    assert(read(f).includes('"PortalCliente.enviarWhatsAppLink"'), `${f}: nova ação na allowlist`);
  }
  assert(read('backend/domains/edge/_portal-link.js') === read('api/_portal-link.js'), 'espelho do backend idêntico');
  console.log('  ✓ X4 frontend usa apenas links assinados');
}

console.log('\n✅ Auditoria 2026-10-02 (8ª rodada): todas as regressões passaram.');
