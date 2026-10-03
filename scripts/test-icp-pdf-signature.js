// scripts/test-icp-pdf-signature.js
// Verificação de assinaturas digitais em PDF (ICP-Brasil qualificada / Gov.br avançada).
// Gera uma PKI de teste com pkijs (raiz, intermediária, titular com CPF no padrão ICP, LCR)
// e PDFs assinados no formato PAdES, sem depender de rede nem de openssl.
import assert from 'assert';
import crypto from 'crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

process.env.SESSION_SIGNING_SECRET ||= 'test-only-session-signing-secret-icp-0123456789';
const mod = await import('../api/_pdf-signature.js');
const { verifyPdfSignatures, extractPdfSignatures, isSafeFetchUrl, loadTrustAnchors, __test } = mod;

console.log('=== Verificação de assinaturas digitais em PDF (ICP-Brasil / Gov.br) ===\n');

const subtle = globalThis.crypto.subtle;
const ALG = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
const CRL_URL = 'http://lcr.teste-icp.example.br/ac-teste.crl';

function name(cn) {
  return new pkijs.RelativeDistinguishedNames({
    typesAndValues: [
      new pkijs.AttributeTypeAndValue({ type: '2.5.4.6', value: new asn1js.PrintableString({ value: 'BR' }) }),
      new pkijs.AttributeTypeAndValue({ type: '2.5.4.10', value: new asn1js.Utf8String({ value: 'ICP-Brasil' }) }),
      new pkijs.AttributeTypeAndValue({ type: '2.5.4.3', value: new asn1js.Utf8String({ value: cn }) })
    ]
  });
}

async function makeCert({ cn, serial, issuerCn, issuerKey, publicKey, ca, crlUrl, notAfter }) {
  const cert = new pkijs.Certificate();
  cert.version = 2;
  cert.serialNumber = new asn1js.Integer({ value: serial });
  cert.issuer = name(issuerCn);
  cert.subject = name(cn);
  cert.notBefore.value = new Date(Date.now() - 86400000);
  cert.notAfter.value = notAfter || new Date(Date.now() + 365 * 86400000);
  cert.extensions = [];
  const bc = new pkijs.BasicConstraints({ cA: Boolean(ca), pathLenConstraint: ca ? 2 : undefined });
  cert.extensions.push(new pkijs.Extension({ extnID: '2.5.29.19', critical: true, extnValue: bc.toSchema().toBER(false), parsedValue: bc }));
  const ku = new asn1js.BitString({ valueHex: new Uint8Array([ca ? 0x06 : 0xc0]).buffer });
  cert.extensions.push(new pkijs.Extension({ extnID: '2.5.29.15', critical: true, extnValue: ku.toBER(false) }));
  if (crlUrl) {
    const dp = new pkijs.CRLDistributionPoints({
      distributionPoints: [new pkijs.DistributionPoint({ distributionPoint: [new pkijs.GeneralName({ type: 6, value: crlUrl })] })]
    });
    cert.extensions.push(new pkijs.Extension({ extnID: '2.5.29.31', extnValue: dp.toSchema().toBER(false), parsedValue: dp }));
  }
  await cert.subjectPublicKeyInfo.importKey(publicKey);
  await cert.sign(issuerKey, 'SHA-256');
  return cert;
}

const toPem = (cert) => `-----BEGIN CERTIFICATE-----\n${Buffer.from(cert.toSchema(true).toBER(false)).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;

async function makePki() {
  const rootKeys = await subtle.generateKey(ALG, true, ['sign', 'verify']);
  const interKeys = await subtle.generateKey(ALG, true, ['sign', 'verify']);
  const leafKeys = await subtle.generateKey(ALG, true, ['sign', 'verify']);
  const root = await makeCert({ cn: 'AC Raiz de Teste', serial: 1, issuerCn: 'AC Raiz de Teste', issuerKey: rootKeys.privateKey, publicKey: rootKeys.publicKey, ca: true });
  const inter = await makeCert({ cn: 'AC Intermediaria de Teste', serial: 2, issuerCn: 'AC Raiz de Teste', issuerKey: rootKeys.privateKey, publicKey: interKeys.publicKey, ca: true });
  const leaf = await makeCert({ cn: 'FULANO DE TAL:12345678901', serial: 777, issuerCn: 'AC Intermediaria de Teste', issuerKey: interKeys.privateKey, publicKey: leafKeys.publicKey, crlUrl: CRL_URL });
  return { root, inter, leaf, rootKeys, interKeys, leafKeys };
}

async function makeCrl(pki, revokedSerials = []) {
  const crl = new pkijs.CertificateRevocationList();
  crl.version = 1;
  crl.issuer = name('AC Intermediaria de Teste');
  crl.thisUpdate = new pkijs.Time({ type: 0, value: new Date(Date.now() - 3600000) });
  crl.nextUpdate = new pkijs.Time({ type: 0, value: new Date(Date.now() + 86400000) });
  if (revokedSerials.length) {
    crl.revokedCertificates = revokedSerials.map(s => new pkijs.RevokedCertificate({
      userCertificate: new asn1js.Integer({ value: s }),
      revocationDate: new pkijs.Time({ type: 0, value: new Date(Date.now() - 1800000) })
    }));
  }
  await crl.sign(pki.interKeys.privateKey, 'SHA-256');
  return Buffer.from(crl.toSchema(true).toBER(false));
}

async function signCms(pki, data) {
  const digest = Buffer.from(await subtle.digest('SHA-256', data));
  const sd = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: '1.2.840.113549.1.7.1' }),
    signerInfos: [new pkijs.SignerInfo({
      version: 1,
      sid: new pkijs.IssuerAndSerialNumber({ issuer: pki.leaf.issuer, serialNumber: pki.leaf.serialNumber }),
      signedAttrs: new pkijs.SignedAndUnsignedAttributes({
        type: 0,
        attributes: [
          new pkijs.Attribute({ type: '1.2.840.113549.1.9.3', values: [new asn1js.ObjectIdentifier({ value: '1.2.840.113549.1.7.1' })] }),
          new pkijs.Attribute({ type: '1.2.840.113549.1.9.5', values: [new asn1js.UTCTime({ valueDate: new Date() })] }),
          new pkijs.Attribute({ type: '1.2.840.113549.1.9.4', values: [new asn1js.OctetString({ valueHex: digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength) })] })
        ]
      })
    })],
    certificates: [pki.leaf, pki.inter]
  });
  await sd.sign(pki.leafKeys.privateKey, 0, 'SHA-256');
  const ci = new pkijs.ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: sd.toSchema(true) });
  return Buffer.from(ci.toSchema().toBER(false));
}

async function makeSignedPdf(pki) {
  const PLACEHOLDER = 16384;
  const head = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n2 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /ETSI.CAdES.detached /ByteRange [0 ';
  const pad = (n) => String(n).padEnd(10, ' ');
  const build = (b, c, d) => `${head}${pad(b)} ${pad(c)} ${pad(d)}] /Contents <${'0'.repeat(PLACEHOLDER)}> >>\nendobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`;
  let text = build(0, 0, 0);
  const b = text.indexOf('<' + '0'.repeat(10));
  const c = b + PLACEHOLDER + 2;
  const d = text.length - c;
  text = build(b, c, d);
  const pdf = Buffer.from(text, 'latin1');
  const signed = Buffer.concat([pdf.subarray(0, b), pdf.subarray(c)]);
  const cms = await signCms(pki, signed);
  const hex = cms.toString('hex').padEnd(PLACEHOLDER, '0');
  pdf.write(hex, b + 1, 'latin1');
  return pdf;
}

function mockFetch(routes) {
  return async (url) => {
    const body = routes[url];
    if (!body) return { ok: false, status: 404, headers: new Map(), arrayBuffer: async () => new ArrayBuffer(0) };
    return { ok: true, status: 200, headers: new Map([['content-length', String(body.length)]]), arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) };
  };
}

const pki = await makePki();
const anchorsOverride = [{ nome: 'AC Raiz de Teste', nivel: 'qualificada', pem: toPem(pki.root) }];
const pdf = await makeSignedPdf(pki);
const cleanCrl = await makeCrl(pki);

// 1. Âncoras reais carregam com impressões digitais conferidas.
{
  const anchors = loadTrustAnchors();
  assert(anchors.some(a => a.nome.includes('v5') && a.nivel === 'qualificada'), 'raiz ICP-Brasil v5');
  assert(anchors.some(a => a.nome.includes('v12')), 'raiz ICP-Brasil v12');
  assert(anchors.some(a => a.nivel === 'avancada' && a.nome.includes('Gov.br')), 'raiz Gov.br');
  console.log(`  ✓ ${anchors.length} âncoras oficiais carregadas e conferidas por SHA-256`);
}

// 2. Assinatura íntegra, cadeia confiável e LCR sem revogação → válida.
{
  __test.crlCache.clear();
  const r = await verifyPdfSignatures(pdf, { anchorsOverride, fetchImpl: mockFetch({ [CRL_URL]: cleanCrl }) });
  assert.strictEqual(r.status, 'valida', JSON.stringify(r.assinaturas[0]?.problemas));
  assert.strictEqual(r.nivel, 'qualificada');
  const s = r.assinaturas[0];
  assert.strictEqual(s.integridade, true);
  assert.strictEqual(s.revogacao.situacao, 'nao_revogado');
  assert.strictEqual(s.signatario.nome, 'FULANO DE TAL');
  assert.strictEqual(s.signatario.cpf_mascarado, '***.456.789-**', 'CPF mascarado (LGPD)');
  assert.deepStrictEqual(s.cadeia, ['FULANO DE TAL:12345678901', 'AC Intermediaria de Teste', 'AC Raiz de Teste']);
  assert.strictEqual(r.alterado_apos_ultima_assinatura, false);
  assert(/^[0-9a-f]{64}$/.test(r.file_sha256));
  console.log('  ✓ PDF íntegro, cadeia até a raiz e LCR sem revogação → VÁLIDA (qualificada)');
}

// 3. Conteúdo adulterado depois da assinatura → inválida.
{
  const tampered = Buffer.from(pdf);
  tampered[30] = tampered[30] === 0x41 ? 0x42 : 0x41;
  const r = await verifyPdfSignatures(tampered, { anchorsOverride, fetchImpl: mockFetch({ [CRL_URL]: cleanCrl }) });
  assert.strictEqual(r.status, 'invalida');
  assert.strictEqual(r.assinaturas[0].integridade, false);
  console.log('  ✓ conteúdo alterado → INVÁLIDA');
}

// 4. Certificado revogado → inválida.
{
  __test.crlCache.clear();
  const revoked = await makeCrl(pki, [777]);
  const r = await verifyPdfSignatures(pdf, { anchorsOverride, fetchImpl: mockFetch({ [CRL_URL]: revoked }) });
  assert.strictEqual(r.status, 'invalida');
  assert.strictEqual(r.assinaturas[0].revogacao.situacao, 'revogado');
  console.log('  ✓ certificado na LCR → INVÁLIDA');
}

// 5. Raiz fora da ICP-Brasil/Gov.br (âncoras reais) → indeterminada, sem nível.
{
  const r = await verifyPdfSignatures(pdf, { fetchImpl: mockFetch({}) });
  assert.strictEqual(r.status, 'indeterminada');
  assert.strictEqual(r.nivel, null);
  console.log('  ✓ certificado fora da ICP-Brasil/Gov.br → INDETERMINADA');
}

// 6. LCR inacessível → indeterminada (não afirma validade sem checar revogação).
{
  __test.crlCache.clear();
  const r = await verifyPdfSignatures(pdf, { anchorsOverride, fetchImpl: mockFetch({}) });
  assert.strictEqual(r.status, 'indeterminada');
  assert.strictEqual(r.assinaturas[0].revogacao.situacao, 'nao_verificado');
  console.log('  ✓ LCR indisponível → INDETERMINADA');
}

// 7. Alteração anexada depois da assinatura → indeterminada e sinalizada.
{
  __test.crlCache.clear();
  const appended = Buffer.concat([pdf, Buffer.from('\n3 0 obj << /Injected true >> endobj\n%%EOF\n', 'latin1')]);
  const r = await verifyPdfSignatures(appended, { anchorsOverride, fetchImpl: mockFetch({ [CRL_URL]: cleanCrl }) });
  assert.strictEqual(r.assinaturas[0].integridade, true);
  assert.strictEqual(r.alterado_apos_ultima_assinatura, true);
  assert.strictEqual(r.status, 'indeterminada');
  console.log('  ✓ conteúdo acrescentado após a assinatura → INDETERMINADA (sinalizado)');
}

// 8. PDF sem assinatura e arquivo que não é PDF.
{
  const r = await verifyPdfSignatures(Buffer.from('%PDF-1.4\n%%EOF\n'));
  assert.strictEqual(r.status, 'sem_assinatura');
  await assert.rejects(() => verifyPdfSignatures(Buffer.from('<html>')), /não é um PDF/);
  assert.strictEqual(extractPdfSignatures(pdf).length, 1);
  console.log('  ✓ PDF sem assinatura identificado; arquivo não-PDF recusado');
}

// 9. Proteção contra SSRF nas URLs de LCR/AIA vindas do certificado.
{
  assert.strictEqual(isSafeFetchUrl('http://acraiz.icpbrasil.gov.br/LCRacraizv5.crl'), true);
  for (const bad of ['http://127.0.0.1/x.crl', 'http://169.254.169.254/latest', 'http://localhost/x', 'http://fingo-evolution-go:8080/', 'file:///etc/passwd', 'http://[::1]/x', 'http://exemplo.com.br:8080/x.crl']) {
    assert.strictEqual(isSafeFetchUrl(bad), false, bad);
  }
  console.log('  ✓ URLs internas/IP/portas não padrão bloqueadas na busca de LCR/AIA');
}

// 10. Cadeias REAIS: ACs oficiais do pacote chegam às raízes oficiais (sem rede).
{
  const inter = await __test.loadBundledIntermediates();
  const cn = c => c.subject.typesAndValues.find(t => t.type === '2.5.4.3')?.value.valueBlock.value;
  const noNet = mockFetch({});
  const casos = [
    ['AC SOLUTI v5', 'AC Raiz ICP-Brasil v5', 'qualificada'],
    ['AC Certisign G8', 'AC Raiz ICP-Brasil v12', 'qualificada'],
    ['AC Final do Governo Federal do Brasil v1', 'AC Raiz do Governo Federal do Brasil v1 (Gov.br)', 'avancada']
  ];
  for (const [ac, raiz, nivel] of casos) {
    const cert = inter.find(c => cn(c) === ac);
    assert(cert, `intermediária ${ac} presente`);
    const r = await __test.buildChain(cert, [], noNet, new Date('2026-10-01T12:00:00Z'));
    assert.strictEqual(r.ok, true, `${ac} chega à raiz`);
    assert.strictEqual(r.anchor.nome, raiz);
    assert.strictEqual(r.anchor.nivel, nivel);
  }
  console.log('  ✓ cadeias reais: AC SOLUTI v5 → Raiz v5, AC Certisign G8 → Raiz v12, AC Final Gov.br → Raiz Gov.br');
}

// 11. Rota HTTP: exige login e entidade válida; Worker encaminha ao backend Node.
{
  const fs = await import('fs');
  const handler = (await import('../api/assinaturas.js')).default;
  const mkRes = () => { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, setHeader() {}, end() { return r; } }; return r; };
  const r1 = mkRes();
  await handler({ method: 'POST', headers: {}, query: { action: 'verificar_pdf' }, body: { entity: 'contratos', entity_id: 'c1', base64: 'JVBERi0=' } }, r1);
  assert.strictEqual(r1.code, 401, 'verificar_pdf exige login');
  const worker = fs.readFileSync(new URL('../cloudflare-worker.js', import.meta.url), 'utf8');
  assert(worker.includes("apiUrl.searchParams.get('action') === 'verificar_pdf'") && worker.includes('return await proxyApi(request, env);'), 'Worker encaminha verificar_pdf ao Render');
  const mig = fs.readFileSync(new URL('../migrations/038_document_signature_verifications.sql', import.meta.url), 'utf8');
  assert(mig.includes('FORCE ROW LEVEL SECURITY') && mig.includes('GRANT SELECT, INSERT ON document_signature_verifications'), 'migração com RLS e sem UPDATE/DELETE para a aplicação');
  for (const f of ['js/patch26-events.js', 'frontend/core/patch26-events.js']) {
    assert(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').includes('"Assinador.verificarPdfAssinado"'), `${f}: ação liberada no barramento`);
  }
  console.log('  ✓ rota exige login; Worker encaminha ao backend; migração com RLS; ação no barramento');
}

console.log('\n✅ Verificação de assinaturas em PDF: todos os cenários passaram.');
void crypto;
