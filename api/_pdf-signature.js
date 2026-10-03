// api/_pdf-signature.js — Verificação de assinaturas digitais em PDF (PAdES/CMS)
//
// Confere, para cada assinatura do PDF:
//   1. Integridade: o hash dos bytes assinados (ByteRange) bate com a assinatura CMS e a
//      assinatura criptográfica do signatário é válida.
//   2. Cadeia: o certificado do signatário chega a uma âncora oficial
//      (AC Raiz ICP-Brasil => assinatura QUALIFICADA; AC Raiz Gov.br => assinatura AVANÇADA).
//   3. Revogação: consulta a LCR (lista de certificados revogados) indicada no certificado.
//   4. Cobertura: se o documento foi alterado depois da última assinatura.
//
// Resultado por assinatura e do documento: 'valida' | 'indeterminada' | 'invalida'
// (mesma classificação do Verificador de Conformidade do ITI / ETSI EN 319 102-1).
// Este módulo roda no backend Node (Render). O Worker encaminha a rota para lá porque
// cadeia + LCR excedem o limite de CPU do plano gratuito do Workers.

import crypto from 'crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import { TRUST_ANCHORS, BUNDLED_INTERMEDIATES } from './_trust-anchors-br.js';

const OID = {
  signingTime: '1.2.840.113549.1.9.5',
  timeStampToken: '1.2.840.113549.1.9.16.2.14',
  crlDistributionPoints: '2.5.29.31',
  authorityInfoAccess: '1.3.6.1.5.5.7.1.1',
  caIssuers: '1.3.6.1.5.5.7.48.2',
  commonName: '2.5.4.3',
  organization: '2.5.4.10'
};

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_FETCH_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;
const crlCache = new Map(); // url -> { crl, expiresAt }

// ── utilitários ──────────────────────────────────────────────────────────────
const toAB = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const sha256Hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function pemToDer(pem) {
  return Buffer.from(String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64');
}

function parseCertDer(der) {
  const asn = asn1js.fromBER(toAB(Buffer.from(der)));
  if (asn.offset === -1) throw new Error('Certificado malformado.');
  return new pkijs.Certificate({ schema: asn.result });
}

function certDer(cert) {
  return Buffer.from(cert.toSchema(true).toBER(false));
}

function certFingerprint(cert) {
  return sha256Hex(certDer(cert));
}

function dnValue(name, oid) {
  const tv = (name?.typesAndValues || []).find(t => t.type === oid);
  return tv ? String(tv.value?.valueBlock?.value ?? '') : '';
}

function dnString(name) {
  return (name?.typesAndValues || [])
    .map(t => `${({ '2.5.4.3': 'CN', '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.6': 'C' })[t.type] || t.type}=${t.value?.valueBlock?.value ?? ''}`)
    .join(', ');
}

function maskCpf(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : '';
}

function maskCnpj(cnpj) {
  const d = String(cnpj || '').replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.***.***/${d.slice(8, 12)}-**` : '';
}

/** Lê o valor ASCII de um otherName ICP-Brasil (OID 2.16.76.1.3.x) no DER do certificado. */
function icpOtherNameDigits(der, lastArc) {
  // 2.16.76.1.3.<n> => 06 06 60 4C 01 03 <n>
  const needle = Buffer.from([0x06, 0x06, 0x60, 0x4c, 0x01, 0x03, lastArc]);
  const at = der.indexOf(needle);
  if (at < 0) return '';
  const tail = der.subarray(at + needle.length, at + needle.length + 80).toString('latin1');
  const m = tail.match(/\d{8,}/);
  return m ? m[0] : '';
}

/** Identificação do titular: nome, CPF (e-CPF / Gov.br) e CNPJ (e-CNPJ), com mascaramento LGPD. */
export function describeSigner(cert) {
  const der = certDer(cert);
  const cn = dnValue(cert.subject, OID.commonName);
  let nome = cn;
  let cpf = '';
  let cnpj = '';
  const cnDoc = cn.match(/^(.*?)[:\s-]+(\d{11}|\d{14})$/);
  if (cnDoc) {
    nome = cnDoc[1].trim();
    if (cnDoc[2].length === 11) cpf = cnDoc[2]; else cnpj = cnDoc[2];
  }
  const pf = icpOtherNameDigits(der, 0x01); // 2.16.76.1.3.1: nascimento(8) + CPF(11) + ...
  if (!cpf && pf.length >= 19) cpf = pf.slice(8, 19);
  const pj = icpOtherNameDigits(der, 0x03); // 2.16.76.1.3.3: CNPJ(14)
  if (!cnpj && pj.length >= 14) cnpj = pj.slice(0, 14);
  const resp = icpOtherNameDigits(der, 0x04); // 2.16.76.1.3.4: responsável pelo e-CNPJ
  if (!cpf && cnpj && resp.length >= 19) cpf = resp.slice(8, 19);
  return {
    nome: nome || 'Titular não identificado',
    cpf_mascarado: maskCpf(cpf),
    cnpj_mascarado: maskCnpj(cnpj),
    emissor: dnValue(cert.issuer, OID.commonName),
    serie: Buffer.from(cert.serialNumber.valueBlock.valueHexView).toString('hex'),
    valido_de: cert.notBefore.value.toISOString(),
    valido_ate: cert.notAfter.value.toISOString()
  };
}

// ── âncoras e intermediárias ─────────────────────────────────────────────────
let anchorCache = null;
export function loadTrustAnchors(override = null) {
  if (override) {
    return override.map(a => {
      const der = pemToDer(a.pem);
      return { ...a, cert: parseCertDer(der), fingerprint: sha256Hex(der) };
    });
  }
  if (anchorCache) return anchorCache;
  anchorCache = TRUST_ANCHORS.map(a => {
    const der = pemToDer(a.pem);
    const fp = sha256Hex(der);
    if (fp !== a.sha256) throw new Error(`Âncora de confiança alterada: ${a.nome}`);
    return { ...a, cert: parseCertDer(der), fingerprint: fp };
  });
  return anchorCache;
}

let intermediateCache = null;
async function loadBundledIntermediates() {
  if (intermediateCache) return intermediateCache;
  const certs = BUNDLED_INTERMEDIATES.map(p => parseCertDer(pemToDer(p)));
  try {
    const fs = await import('node:fs/promises');
    const url = new URL('./_icp-intermediates.txt', import.meta.url);
    const text = await fs.readFile(url, 'utf8');
    for (const block of text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || []) {
      try { certs.push(parseCertDer(pemToDer(block))); } catch { /* ignora bloco inválido */ }
    }
  } catch { /* arquivo opcional: cadeia ainda pode vir no PDF ou via AIA */ }
  intermediateCache = certs;
  return certs;
}

// ── rede (AIA / LCR) com proteção contra SSRF ────────────────────────────────
export function isSafeFetchUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { return false; }
  if (!['http:', 'https:'].includes(u.protocol)) return false;
  if (u.username || u.password) return false;
  if (u.port && !['80', '443'].includes(u.port)) return false;
  const host = u.hostname.toLowerCase();
  if (!host.includes('.')) return false; // nomes internos (rede privada do Render)
  if (/^[\d.]+$/.test(host) || host.includes(':')) return false; // IP literal
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  return true;
}

async function fetchBytes(url, fetchImpl) {
  if (!isSafeFetchUrl(url)) throw new Error('URL não permitida');
  const res = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers?.get?.('content-length') || 0);
  if (len > MAX_FETCH_BYTES) throw new Error('Arquivo grande demais');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_FETCH_BYTES) throw new Error('Arquivo grande demais');
  return buf;
}

function extensionUrls(cert, extOid) {
  const ext = (cert.extensions || []).find(e => e.extnID === extOid);
  if (!ext) return [];
  const raw = Buffer.from(ext.extnValue.valueBlock.valueHexView).toString('latin1');
  const urls = raw.match(/https?:\/\/[\x21-\x7e]+/g) || [];
  return [...new Set(urls.map(u => u.replace(/[\x00-\x20]+$/, '')))].slice(0, 4);
}

function certsFromBytes(buf) {
  // .cer/.crt (DER ou PEM) ou .p7b/.p7c (PKCS#7 só com certificados)
  const text = buf.toString('latin1');
  if (text.includes('-----BEGIN CERTIFICATE-----')) {
    return (text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || []).map(p => parseCertDer(pemToDer(p)));
  }
  try { return [parseCertDer(buf)]; } catch { /* tenta PKCS#7 */ }
  const asn = asn1js.fromBER(toAB(buf));
  const ci = new pkijs.ContentInfo({ schema: asn.result });
  const sd = new pkijs.SignedData({ schema: ci.content });
  return (sd.certificates || []).filter(c => c instanceof pkijs.Certificate);
}

// ── extração das assinaturas do PDF ──────────────────────────────────────────
export function extractPdfSignatures(pdf) {
  const text = pdf.toString('latin1');
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const [a, b, c, d] = m.slice(1, 5).map(Number);
    const key = `${a}:${b}:${c}:${d}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (a !== 0 || b <= 0 || c <= b || c + d > pdf.length) {
      out.push({ byteRange: [a, b, c, d], error: 'ByteRange inconsistente' });
      continue;
    }
    const holder = text.slice(b, c).trim();
    const hex = holder.replace(/^</, '').replace(/>$/, '').replace(/\s+/g, '');
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      out.push({ byteRange: [a, b, c, d], error: 'Conteúdo da assinatura ausente' });
      continue;
    }
    out.push({
      byteRange: [a, b, c, d],
      cms: Buffer.from(hex.replace(/(00)+$/, '') || '00', 'hex'),
      signedBytes: Buffer.concat([pdf.subarray(a, a + b), pdf.subarray(c, c + d)]),
      coversWholeFile: c + d === pdf.length
    });
  }
  return out;
}

function attrValue(attrs, oid) {
  const at = (attrs?.attributes || []).find(x => x.type === oid);
  return at ? at.values?.[0] : null;
}

function readSigningTime(signerInfo) {
  const v = attrValue(signerInfo.signedAttrs, OID.signingTime);
  const d = v?.toDate?.();
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function hasTimestamp(signerInfo) {
  return Boolean(attrValue(signerInfo.unsignedAttrs, OID.timeStampToken));
}

// ── revogação (LCR) ──────────────────────────────────────────────────────────
async function checkRevocation(cert, issuer, fetchImpl, now) {
  const urls = extensionUrls(cert, OID.crlDistributionPoints);
  if (!urls.length) return { situacao: 'nao_verificado', motivo: 'Certificado sem endereço de LCR.' };
  for (const url of urls) {
    try {
      let entry = crlCache.get(url);
      if (!entry || entry.expiresAt < now.getTime()) {
        const buf = await fetchBytes(url, fetchImpl);
        const asn = asn1js.fromBER(toAB(buf));
        const crl = new pkijs.CertificateRevocationList({ schema: asn.result });
        const next = crl.nextUpdate?.value?.getTime?.() || (now.getTime() + 3600_000);
        entry = { crl, expiresAt: Math.min(next, now.getTime() + 6 * 3600_000) };
        crlCache.set(url, entry);
      }
      const { crl } = entry;
      const sigOk = await crl.verify({ issuerCertificate: issuer });
      if (!sigOk) continue;
      if (crl.nextUpdate && crl.nextUpdate.value.getTime() < now.getTime()) {
        return { situacao: 'nao_verificado', motivo: 'LCR publicada está vencida.', fonte: url };
      }
      if (crl.isCertificateRevoked(cert)) {
        const serial = Buffer.from(cert.serialNumber.valueBlock.valueHexView).toString('hex');
        const rev = (crl.revokedCertificates || []).find(r => Buffer.from(r.userCertificate.valueBlock.valueHexView).toString('hex') === serial);
        return { situacao: 'revogado', em: rev?.revocationDate?.value?.toISOString?.() || null, fonte: url };
      }
      return { situacao: 'nao_revogado', fonte: url, lcr_emitida_em: crl.thisUpdate?.value?.toISOString?.() || null };
    } catch {
      // tenta o próximo endereço
    }
  }
  return { situacao: 'nao_verificado', motivo: 'Não foi possível obter ou validar a LCR do emissor.' };
}

// ── cadeia ───────────────────────────────────────────────────────────────────
async function buildChain(signerCert, embedded, fetchImpl, checkDate, anchorsOverride) {
  const anchors = loadTrustAnchors(anchorsOverride);
  // Pré-seleciona só as intermediárias candidatas (emissor por nome, até 6 níveis): o motor do
  // pkijs não monta o caminho de forma confiável com centenas de certificados no conjunto.
  const bundled = await loadBundledIntermediates();
  const selectCandidates = (available) => {
    const chosen = [];
    let current = [signerCert];
    for (let depth = 0; depth < 6 && current.length; depth++) {
      const next = [];
      for (const c of current) {
        const issuerDn = dnString(c.issuer);
        if (issuerDn === dnString(c.subject)) continue;
        for (const cand of available) {
          if (dnString(cand.subject) === issuerDn && !chosen.includes(cand)) { chosen.push(cand); next.push(cand); }
        }
      }
      current = next;
    }
    return chosen;
  };
  const pool = selectCandidates([...embedded, ...bundled]);
  const tryValidate = async (certs) => {
    const engine = new pkijs.CertificateChainValidationEngine({
      trustedCerts: anchors.map(a => a.cert),
      certs: [signerCert, ...certs],
      checkDate
    });
    return engine.verify();
  };
  let result = await tryValidate(pool);
  if (!result.result) {
    // Busca intermediárias faltantes pelo AIA (caIssuers) do certificado e dos emissores.
    const fetched = [];
    let frontier = [signerCert];
    for (let depth = 0; depth < 3 && !result.result; depth++) {
      const next = [];
      for (const c of frontier) {
        for (const url of extensionUrls(c, OID.authorityInfoAccess)) {
          try { next.push(...certsFromBytes(await fetchBytes(url, fetchImpl))); } catch { /* ignora */ }
        }
      }
      if (!next.length) break;
      fetched.push(...next);
      frontier = next;
      result = await tryValidate(selectCandidates([...embedded, ...bundled, ...fetched]));
    }
  }
  // certificatePath do pkijs vem do emissor até a raiz (sem o signatário): normaliza para
  // [signatário, intermediárias..., raiz].
  const rawPath = result.certificatePath || [];
  const signerFp = certFingerprint(signerCert);
  const path = rawPath.length && certFingerprint(rawPath[0]) === signerFp ? rawPath : [signerCert, ...rawPath];
  const root = path.length > 1 ? path[path.length - 1] : null;
  const anchor = root ? anchors.find(a => a.fingerprint === certFingerprint(root)) : null;
  return { ok: Boolean(result.result && anchor), result, path, anchor };
}

// ── verificação de uma assinatura ────────────────────────────────────────────
async function verifyOne(sig, { fetchImpl, now, anchorsOverride }) {
  const report = { cobre_documento_inteiro: Boolean(sig.coversWholeFile), problemas: [] };
  if (sig.error) {
    return { ...report, status: 'invalida', problemas: [sig.error] };
  }
  let sd;
  try {
    const asn = asn1js.fromBER(toAB(sig.cms));
    if (asn.offset === -1) throw new Error('CMS malformado');
    const ci = new pkijs.ContentInfo({ schema: asn.result });
    sd = new pkijs.SignedData({ schema: ci.content });
  } catch {
    return { ...report, status: 'invalida', problemas: ['Assinatura CMS ilegível.'] };
  }

  const signerInfo = sd.signerInfos?.[0];
  const embedded = (sd.certificates || []).filter(c => c instanceof pkijs.Certificate);
  const signingTime = signerInfo ? readSigningTime(signerInfo) : null;
  report.horario_declarado = signingTime ? signingTime.toISOString() : null;
  report.carimbo_do_tempo = signerInfo ? hasTimestamp(signerInfo) : false;

  let verified;
  try {
    verified = await sd.verify({ signer: 0, data: toAB(sig.signedBytes), extendedMode: true, checkChain: false });
  } catch (err) {
    verified = err && typeof err === 'object' ? err : { signatureVerified: false };
  }
  const signerCert = verified?.signerCertificate || null;
  report.integridade = Boolean(verified?.signatureVerified);
  if (signerCert) report.signatario = describeSigner(signerCert);
  if (!report.integridade) {
    return { ...report, status: 'invalida', problemas: ['O conteúdo foi alterado depois da assinatura ou a assinatura não confere.'] };
  }
  if (!signerCert) {
    return { ...report, status: 'indeterminada', problemas: ['Certificado do signatário não incluído na assinatura.'] };
  }

  // Cadeia: primeiro na data atual; se o certificado já expirou, tenta na data declarada.
  let chain = await buildChain(signerCert, embedded, fetchImpl, now, anchorsOverride);
  let usedDeclaredDate = false;
  if (!chain.ok && signingTime && signerCert.notAfter.value < now) {
    const retry = await buildChain(signerCert, embedded, fetchImpl, signingTime, anchorsOverride);
    if (retry.ok) { chain = retry; usedDeclaredDate = true; }
  }
  if (!chain.ok) {
    return {
      ...report,
      status: 'indeterminada',
      nivel: null,
      problemas: ['O certificado não pertence à ICP-Brasil nem ao Gov.br, ou a cadeia não pôde ser montada.']
    };
  }
  report.nivel = chain.anchor.nivel;
  report.ac_raiz = chain.anchor.nome;
  report.cadeia = chain.path.map(c => dnValue(c.subject, OID.commonName));

  const issuer = chain.path[1] || null;
  report.revogacao = issuer
    ? await checkRevocation(signerCert, issuer, fetchImpl, now)
    : { situacao: 'nao_verificado', motivo: 'Emissor não identificado.' };

  if (report.revogacao.situacao === 'revogado') {
    return { ...report, status: 'invalida', problemas: ['O certificado do signatário foi revogado.'] };
  }
  const problemas = [];
  if (report.revogacao.situacao !== 'nao_revogado') problemas.push(report.revogacao.motivo || 'Revogação não verificada.');
  if (usedDeclaredDate) problemas.push('O certificado já expirou e não há carimbo do tempo validado; a data da assinatura é a declarada pelo signatário.');
  return { ...report, status: problemas.length ? 'indeterminada' : 'valida', problemas };
}

// ── API pública ──────────────────────────────────────────────────────────────
// `anchorsOverride` existe só para testes automatizados; a rota HTTP nunca o repassa.
export async function verifyPdfSignatures(pdfInput, { fetchImpl = globalThis.fetch, now = new Date(), anchorsOverride = null } = {}) {
  const pdf = Buffer.from(pdfInput);
  if (!pdf.length || pdf.length > MAX_PDF_BYTES) throw new Error('PDF ausente ou acima de 10 MB.');
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('O arquivo não é um PDF.');

  const file_sha256 = sha256Hex(pdf);
  const sigs = extractPdfSignatures(pdf);
  if (!sigs.length) {
    return { status: 'sem_assinatura', nivel: null, file_sha256, assinaturas: [], verificado_em: now.toISOString() };
  }
  const assinaturas = [];
  for (const sig of sigs.slice(0, 10)) assinaturas.push(await verifyOne(sig, { fetchImpl, now, anchorsOverride }));

  const last = assinaturas[assinaturas.length - 1];
  const alteradoDepois = !last.cobre_documento_inteiro;
  let status = 'valida';
  if (assinaturas.some(a => a.status === 'invalida')) status = 'invalida';
  else if (assinaturas.some(a => a.status === 'indeterminada') || alteradoDepois) status = 'indeterminada';
  const niveis = [...new Set(assinaturas.map(a => a.nivel).filter(Boolean))];
  const nivel = niveis.length === 1 ? niveis[0] : (niveis.includes('avancada') ? 'avancada' : (niveis[0] || null));

  return {
    status,
    nivel,
    file_sha256,
    alterado_apos_ultima_assinatura: alteradoDepois,
    assinaturas,
    verificado_em: now.toISOString()
  };
}

export const __test = { crlCache, pemToDer, parseCertDer, buildChain, loadBundledIntermediates };
