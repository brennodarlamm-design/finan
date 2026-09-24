// api/certificado.js — Gestão Segura de Certificado Digital A1 com Criptografia AES-256-GCM

import crypto from 'crypto';
import tls from 'tls';
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { canAccessModule, permissionError } from './_permissions.js';
import { writeAudit } from './_audit.js';
import { createTenantSql } from './_tenant-sql.js';
import { createRuntimeSql } from './_database.js';

const ALLOWED_ORIGINS = [
  'https://fingo.api.br',
  'https://www.fingo.api.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

function setCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin);
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey, x-tenant-id');
}

function deriveEncryptionKey(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function getEncryptionSecrets() {
  const dedicated = String(process.env.CERT_ENCRYPTION_KEY || '').trim();
  const legacy = String(process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();
  if (!dedicated && !legacy) {
    throw new Error('Chave de criptografia do certificado não configurada no servidor.');
  }
  return {
    primary: dedicated || legacy,
    legacy: dedicated && legacy && dedicated !== legacy ? legacy : null
  };
}

function encryptCertData(pfxBuffer, passphrase) {
  const dedicated = String(process.env.CERT_ENCRYPTION_KEY || '').trim();
  if (!dedicated) {
    console.warn('⚠️ [Segurança] CERT_ENCRYPTION_KEY não configurada no servidor. Recomenda-se chave dedicada para isolamento criptográfico.');
  }
  const { primary } = getEncryptionSecrets();
  const key = deriveEncryptionKey(primary);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plainText = JSON.stringify({
    pfx_base64: pfxBuffer.toString('base64'),
    passphrase: String(passphrase)
  });
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encBase64: encrypted.toString('base64'),
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex')
  };
}

function decryptWithSecret(secret, encBase64, ivHex, authTagHex) {
  const key = deriveEncryptionKey(secret);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encBase64, 'base64')), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

export function decryptCertData(encBase64, ivHex, authTagHex) {
  const { primary, legacy } = getEncryptionSecrets();
  try {
    return decryptWithSecret(primary, encBase64, ivHex, authTagHex);
  } catch (primaryErr) {
    if (!legacy) throw primaryErr;
    // Compatibilidade: certificados gravados antes do CERT_ENCRYPTION_KEY continuam legíveis.
    return decryptWithSecret(legacy, encBase64, ivHex, authTagHex);
  }
}

// ─── Parser DER/ASN.1 mínimo — zero dependências externas ────────────────────

/**
 * Lê um elemento TLV (tag-length-value) DER na posição `pos` do buffer.
 * Suporta comprimentos definidos de até 4 bytes (cobrindo qualquer cert real).
 * Retorna null se o buffer estiver mal-formado ou fora dos limites.
 */
function derTLV(buf, pos) {
  if (pos >= buf.length) return null;
  const tag = buf[pos];
  let i = pos + 1;
  if (i >= buf.length) return null;
  const fb = buf[i++];
  let len;
  if (fb < 0x80) {
    len = fb;
  } else {
    const nb = fb & 0x7f;
    if (nb === 0 || nb > 4 || i + nb > buf.length) return null;
    len = 0;
    for (let k = 0; k < nb; k++) len = (len << 8) | buf[i++];
  }
  if (i + len > buf.length) return null;
  return { tag, val: buf.subarray(i, i + len), next: i + len };
}

/** Itera todos os elementos filho de uma SEQUENCE ou SET DER. */
function* derChildren(buf) {
  let pos = 0;
  while (pos < buf.length) {
    const item = derTLV(buf, pos);
    if (!item) break;
    yield item;
    pos = item.next;
  }
}

// OIDs relevantes para PKCS#12 (value bytes DER, sem tag 0x06 nem length)
const _OID_PKCS7_DATA           = Buffer.from('2a864886f70d010701',    'hex'); // 1.2.840.113549.1.7.1
const _OID_PKCS7_ENCRYPTED_DATA = Buffer.from('2a864886f70d010706',    'hex'); // 1.2.840.113549.1.7.6
const _OID_CERT_BAG             = Buffer.from('2a864886f70d010c0a0103','hex'); // 1.2.840.113549.1.12.10.1.3
const _OID_X509_CERT_TYPE       = Buffer.from('2a864886f70d01091601',  'hex'); // 1.2.840.113549.1.9.22.1

// Algoritmos de cifra PBES1 / PKCS#12
const _OID_PBE_SHA1_3DES        = Buffer.from('2a864886f70d010c0103',  'hex'); // 1.2.840.113549.1.12.1.3
const _OID_PBE_SHA1_2KEY_3DES   = Buffer.from('2a864886f70d010c0104',  'hex'); // 1.2.840.113549.1.12.1.4
const _OID_PBES2                = Buffer.from('2a864886f70d01050d',    'hex'); // 1.2.840.113549.1.5.13
const _OID_PBKDF2               = Buffer.from('2a864886f70d01050c',    'hex'); // 1.2.840.113549.1.5.12

// Cifras suportadas em PBES2
const _OID_AES128_CBC           = Buffer.from('608648016503040102',    'hex'); // 2.16.840.1.101.3.4.1.2
const _OID_AES192_CBC           = Buffer.from('608648016503040116',    'hex'); // 2.16.840.1.101.3.4.1.22
const _OID_AES256_CBC           = Buffer.from('60864801650304012a',    'hex'); // 2.16.840.1.101.3.4.1.42
const _OID_DES_EDE3_CBC         = Buffer.from('2a864886f70d0307',      'hex'); // 1.2.840.113549.3.7

// PRF para PBKDF2
const _OID_HMAC_SHA1            = Buffer.from('2a864886f70d0207',      'hex'); // 1.2.840.113549.2.7
const _OID_HMAC_SHA256          = Buffer.from('2a864886f70d0209',      'hex'); // 1.2.840.113549.2.9
const _OID_HMAC_SHA384          = Buffer.from('2a864886f70d020a',      'hex'); // 1.2.840.113549.2.10
const _OID_HMAC_SHA512          = Buffer.from('2a864886f70d020b',      'hex'); // 1.2.840.113549.2.11

// Hashes para MacData
const _OID_DIGEST_SHA1          = Buffer.from('2b0e03021a',            'hex'); // 1.3.14.3.2.26
const _OID_DIGEST_SHA256        = Buffer.from('608648016503040201',    'hex'); // 2.16.840.1.101.3.4.2.1
const _OID_DIGEST_SHA384        = Buffer.from('608648016503040202',    'hex'); // 2.16.840.1.101.3.4.2.2
const _OID_DIGEST_SHA512        = Buffer.from('608648016503040203',    'hex'); // 2.16.840.1.101.3.4.2.3

/**
 * Converte a senha de string para bytes no formato BMPString (UTF-16BE com
 * terminador nulo de 2 bytes), conforme especificação RFC 7292 Apêndice B.
 */
export function passwordToPkcs12Bytes(password) {
  if (password === null || password === undefined) return Buffer.alloc(0);
  const str = String(password);
  const buf = Buffer.alloc(str.length * 2 + 2);
  for (let i = 0; i < str.length; i++) {
    buf.writeUInt16BE(str.charCodeAt(i), i * 2);
  }
  buf.writeUInt16BE(0, str.length * 2);
  return buf;
}

/**
 * Derivação de chaves e IVs conforme RFC 7292 Apêndice B (PKCS#12 KDF).
 * Suporta ID 1 (chave de encriptação), ID 2 (IV) e ID 3 (chave MAC).
 */
export function pkcs12Kdf(id, n, salt, passwordBytes, iterations = 1, hashAlgorithm = 'sha1') {
  const u = (hashAlgorithm === 'sha256' ? 32 : (hashAlgorithm === 'sha384' ? 48 : (hashAlgorithm === 'sha512' ? 64 : 20)));
  const v = (hashAlgorithm === 'sha384' || hashAlgorithm === 'sha512') ? 128 : 64;

  const D = Buffer.alloc(v, id);

  const sLen = salt ? salt.length : 0;
  let sHat = Buffer.alloc(0);
  if (sLen > 0) {
    const sBlocks = Math.ceil(sLen / v);
    sHat = Buffer.alloc(v * sBlocks);
    for (let i = 0; i < sHat.length; i++) {
      sHat[i] = salt[i % sLen];
    }
  }

  const pLen = passwordBytes ? passwordBytes.length : 0;
  let pHat = Buffer.alloc(0);
  if (pLen > 0) {
    const pBlocks = Math.ceil(pLen / v);
    pHat = Buffer.alloc(v * pBlocks);
    for (let i = 0; i < pHat.length; i++) {
      pHat[i] = passwordBytes[i % pLen];
    }
  }

  const I = Buffer.concat([sHat, pHat]);
  const cBlocks = Math.ceil(n / u);
  const A = [];

  for (let i = 0; i < cBlocks; i++) {
    let hash = crypto.createHash(hashAlgorithm);
    hash.update(D);
    hash.update(I);
    let H = hash.digest();

    for (let iter = 1; iter < iterations; iter++) {
      hash = crypto.createHash(hashAlgorithm);
      hash.update(H);
      H = hash.digest();
    }
    A.push(H);

    if (i === cBlocks - 1) break;

    const B = Buffer.alloc(v);
    for (let k = 0; k < v; k++) {
      B[k] = H[k % u];
    }

    const numBlocksI = Math.floor(I.length / v);
    for (let j = 0; j < numBlocksI; j++) {
      let carry = 1;
      const offset = j * v;
      for (let k = v - 1; k >= 0; k--) {
        const sum = I[offset + k] + B[k] + carry;
        I[offset + k] = sum & 0xff;
        carry = sum >> 8;
      }
    }
  }

  return Buffer.concat(A).subarray(0, n);
}

/**
 * Validação de integridade e senha de arquivo PKCS#12 através da MacData (RFC 7292 Seção 4.2.1).
 */
export function verifyPkcs12Mac(pfxBuf, password) {
  try {
    const pfxSeq = derTLV(pfxBuf, 0);
    if (!pfxSeq || pfxSeq.tag !== 0x30) return { hasMac: false, ok: false, error: 'Não é um arquivo PFX/PKCS#12 válido.' };
    const pfxKids = [...derChildren(pfxSeq.val)];
    if (pfxKids.length < 3) return { hasMac: false, ok: true };

    const authSafeCI = pfxKids[1];
    if (!authSafeCI || authSafeCI.tag !== 0x30) return { hasMac: false, ok: false };
    const authSafeKids = [...derChildren(authSafeCI.val)];
    const authContent = authSafeKids[1];
    if (!authContent) return { hasMac: false, ok: false };
    const authOctet = derTLV(authContent.val, 0);
    if (!authOctet || authOctet.tag !== 0x04) return { hasMac: false, ok: false };
    const authSafeData = authOctet.val;

    const macData = pfxKids[2];
    if (!macData || macData.tag !== 0x30) return { hasMac: false, ok: true };
    const macKids = [...derChildren(macData.val)];
    const digestInfo = macKids[0];
    if (!digestInfo || digestInfo.tag !== 0x30) return { hasMac: false, ok: false };
    const diKids = [...derChildren(digestInfo.val)];
    const algId = diKids[0];
    const algKids = [...derChildren(algId.val)];
    const hashOid = algKids[0]?.val;
    const storedDigest = diKids[1]?.val;

    const salt = macKids[1]?.val;
    let iterations = 1;
    if (macKids[2] && macKids[2].tag === 0x02) {
      iterations = 0;
      for (const b of macKids[2].val) iterations = (iterations << 8) | b;
    }

    let hashAlg = 'sha1';
    let u = 20;
    if (hashOid && hashOid.equals(_OID_DIGEST_SHA256)) { hashAlg = 'sha256'; u = 32; }
    else if (hashOid && hashOid.equals(_OID_DIGEST_SHA1)) { hashAlg = 'sha1'; u = 20; }
    else if (hashOid && hashOid.equals(_OID_DIGEST_SHA384)) { hashAlg = 'sha384'; u = 48; }
    else if (hashOid && hashOid.equals(_OID_DIGEST_SHA512)) { hashAlg = 'sha512'; u = 64; }

    const pwBytes = passwordToPkcs12Bytes(password);
    const key = pkcs12Kdf(3, u, salt, pwBytes, iterations, hashAlg);
    const computedMac = crypto.createHmac(hashAlg, key).update(authSafeData).digest();

    const ok = storedDigest && computedMac.length === storedDigest.length && crypto.timingSafeEqual(computedMac, storedDigest);
    return { hasMac: true, ok, hashAlg, iterations };
  } catch (err) {
    return { hasMac: false, ok: false, error: err.message };
  }
}

/**
 * Decripta contêiner PKCS#7 EncryptedData em memória via RFC 7292 (PBES1 / PBES2).
 */
export function decryptPkcs7EncryptedData(encDataSeqVal, passphrase) {
  try {
    const encDataKids = [...derChildren(encDataSeqVal)];
    const eci = encDataKids[1]; // EncryptedContentInfo
    if (!eci || eci.tag !== 0x30) return null;
    const eciKids = [...derChildren(eci.val)];
    const algId = eciKids[1];
    const encContent = eciKids[2];
    if (!algId || !encContent) return null;

    const algKids = [...derChildren(algId.val)];
    const algOid = algKids[0]?.val;
    const algParams = algKids[1];
    const ciphertext = encContent.val;
    if (!algOid || !ciphertext) return null;

    // 1. PBES1 com 3DES / 2-Key 3DES
    if (algOid.equals(_OID_PBE_SHA1_3DES) || algOid.equals(_OID_PBE_SHA1_2KEY_3DES)) {
      if (!algParams) return null;
      const paramsKids = [...derChildren(algParams.val)];
      const salt = paramsKids[0]?.val;
      const iterBuf = paramsKids[1]?.val;
      let iterations = 1;
      if (iterBuf) {
        iterations = 0;
        for (const b of iterBuf) iterations = (iterations << 8) | b;
      }

      const is2Key = algOid.equals(_OID_PBE_SHA1_2KEY_3DES);
      const keyLen = is2Key ? 16 : 24;
      const pwBytes = passwordToPkcs12Bytes(passphrase);
      let key = pkcs12Kdf(1, keyLen, salt, pwBytes, iterations, 'sha1');
      if (is2Key) {
        key = Buffer.concat([key, key.subarray(0, 8)]); // K1, K2, K1
      }
      const iv = pkcs12Kdf(2, 8, salt, pwBytes, iterations, 'sha1');

      try {
        const decipher = crypto.createDecipheriv('des-ede3-cbc', key, iv);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } catch {
        return null;
      }
    }

    // 2. PBES2 (RFC 8018 / PKCS#5 v2.0)
    if (algOid.equals(_OID_PBES2)) {
      if (!algParams) return null;
      const pbes2Params = [...derChildren(algParams.val)];
      const kdf = pbes2Params[0];
      const encScheme = pbes2Params[1];
      if (!kdf || !encScheme) return null;

      const kdfKids = [...derChildren(kdf.val)];
      const kdfOid = kdfKids[0]?.val;
      if (!kdfOid || !kdfOid.equals(_OID_PBKDF2)) return null;

      const pbkdf2Params = [...derChildren(kdfKids[1].val)];
      const salt = pbkdf2Params[0]?.val;
      let iterations = 1;
      if (pbkdf2Params[1]) {
        iterations = 0;
        for (const b of pbkdf2Params[1].val) iterations = (iterations << 8) | b;
      }

      let prf = 'sha1';
      if (pbkdf2Params[2]) {
        const prfKids = [...derChildren(pbkdf2Params[2].val)];
        const prfOid = prfKids[0]?.val;
        if (prfOid && prfOid.equals(_OID_HMAC_SHA256)) prf = 'sha256';
        else if (prfOid && prfOid.equals(_OID_HMAC_SHA384)) prf = 'sha384';
        else if (prfOid && prfOid.equals(_OID_HMAC_SHA512)) prf = 'sha512';
        else if (prfOid && prfOid.equals(_OID_HMAC_SHA1)) prf = 'sha1';
      }

      const encSchemeKids = [...derChildren(encScheme.val)];
      const encSchemeOid = encSchemeKids[0]?.val;
      const iv = encSchemeKids[1]?.val;

      let cipherName = 'aes-256-cbc';
      let keyLen = 32;
      if (encSchemeOid && encSchemeOid.equals(_OID_AES256_CBC)) { cipherName = 'aes-256-cbc'; keyLen = 32; }
      else if (encSchemeOid && encSchemeOid.equals(_OID_AES128_CBC)) { cipherName = 'aes-128-cbc'; keyLen = 16; }
      else if (encSchemeOid && encSchemeOid.equals(_OID_AES192_CBC)) { cipherName = 'aes-192-cbc'; keyLen = 24; }
      else if (encSchemeOid && encSchemeOid.equals(_OID_DES_EDE3_CBC)) { cipherName = 'des-ede3-cbc'; keyLen = 24; }
      else return null;

      // Suporta senhas em UTF-8 nativo ou codificação BMPString
      for (const pwCandidate of [String(passphrase || ''), passwordToPkcs12Bytes(passphrase)]) {
        try {
          const key = crypto.pbkdf2Sync(pwCandidate, salt, iterations, keyLen, prf);
          const decipher = crypto.createDecipheriv(cipherName, key, iv);
          const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
          if (decrypted && decrypted.length > 0) return decrypted;
        } catch {}
      }
    }
  } catch {}

  return null;
}

/**
 * Extrai buffers DER brutos dos certificados X.509 contidos em um arquivo PKCS#12 (.pfx/.p12),
 * com suporte nativo em pura memória para cert bags não-encriptadas e contêineres encryptedData.
 *
 * Estrutura percorrida (RFC 7292):
 *   PFX → authSafe ContentInfo → AuthenticatedSafe (SEQUENCE OF ContentInfo)
 *     → SafeContents (data direta ou payload de encryptedData decifrado)
 *       → SafeBag (bagId = certBag)
 *         → CertBag → [0] OCTET STRING → DER X.509
 */
export function _extractCertDERsFromPkcs12(pfxBuf, passphrase = '') {
  const results = [];
  try {
    // 1. PFX ::= SEQUENCE { version INTEGER, authSafe ContentInfo, ... }
    const pfxSeq = derTLV(pfxBuf, 0);
    if (!pfxSeq || pfxSeq.tag !== 0x30) return results;

    // authSafe é o 2º filho (índice 1), após o version INTEGER
    const pfxKids = [...derChildren(pfxSeq.val)];
    const authSafeCI = pfxKids[1];
    if (!authSafeCI || authSafeCI.tag !== 0x30) return results;

    // 2. ContentInfo = SEQUENCE { contentType OID, [0] EXPLICIT content }
    const authSafeKids = [...derChildren(authSafeCI.val)];
    const authOid     = authSafeKids[0];
    const authContent = authSafeKids[1];
    if (!authOid || authOid.tag !== 0x06) return results;
    if (!authOid.val.equals(_OID_PKCS7_DATA)) return results;
    if (!authContent || (authContent.tag & 0xe0) !== 0xa0) return results;

    // 3. [0] EXPLICIT → OCTET STRING → AuthenticatedSafe DER
    const authOctet = derTLV(authContent.val, 0);
    if (!authOctet || authOctet.tag !== 0x04) return results;

    // 4. AuthenticatedSafe ::= SEQUENCE OF ContentInfo
    const authSafeSeq = derTLV(authOctet.val, 0);
    if (!authSafeSeq || authSafeSeq.tag !== 0x30) return results;

    // 5. Itera cada ContentInfo dentro da AuthenticatedSafe
    for (const ci of derChildren(authSafeSeq.val)) {
      if (ci.tag !== 0x30) continue;
      const ciKids   = [...derChildren(ci.val)];
      const ciOid    = ciKids[0];
      const ciCont   = ciKids[1];
      if (!ciOid || ciOid.tag !== 0x06 || !ciCont || (ciCont.tag & 0xe0) !== 0xa0) continue;

      let safeContentsBuf = null;

      if (ciOid.val.equals(_OID_PKCS7_DATA)) {
        // ContentInfo tipo data (não-encriptada)
        const scOctet = derTLV(ciCont.val, 0);
        if (scOctet && scOctet.tag === 0x04) {
          safeContentsBuf = scOctet.val;
        }
      } else if (ciOid.val.equals(_OID_PKCS7_ENCRYPTED_DATA) && passphrase) {
        // ContentInfo tipo encryptedData — decripta em memória via RFC 7292
        const encDataWrap = derTLV(ciCont.val, 0);
        if (encDataWrap && encDataWrap.tag === 0x30) {
          safeContentsBuf = decryptPkcs7EncryptedData(encDataWrap.val, passphrase);
        }
      }

      if (!safeContentsBuf) continue;

      // 6. SafeContents ::= SEQUENCE OF SafeBag
      let foundInBags = false;
      const scSeq = derTLV(safeContentsBuf, 0);
      if (scSeq && scSeq.tag === 0x30) {
        for (const safeBag of derChildren(scSeq.val)) {
          if (safeBag.tag !== 0x30) continue;
          const sbKids  = [...derChildren(safeBag.val)];
          const bagId   = sbKids[0];
          const bagVal  = sbKids[1];
          if (!bagId || bagId.tag !== 0x06) continue;
          if (!bagId.val.equals(_OID_CERT_BAG)) continue;       // filtra certBag
          if (!bagVal || (bagVal.tag & 0xe0) !== 0xa0) continue;

          // bagValue [0] → CertBag ::= SEQUENCE { certId OID, [0] certValue }
          const cbSeq = derTLV(bagVal.val, 0);
          if (!cbSeq || cbSeq.tag !== 0x30) continue;
          const cbKids      = [...derChildren(cbSeq.val)];
          const certId      = cbKids[0];
          const certValWrap = cbKids[1];
          if (!certId || certId.tag !== 0x06) continue;
          if (!certId.val.equals(_OID_X509_CERT_TYPE)) continue; // x509Certificate
          if (!certValWrap || (certValWrap.tag & 0xe0) !== 0xa0) continue;

          // [0] EXPLICIT → OCTET STRING → DER X.509
          const x509Oct = derTLV(certValWrap.val, 0);
          if (!x509Oct || x509Oct.tag !== 0x04) continue;
          results.push(x509Oct.val);
          foundInBags = true;
        }
      }

      // Varredura byte-a-byte no payload decifrado se os bags não foram identificados diretamente
      if (!foundInBags) {
        for (let i = 0; i < safeContentsBuf.length - 100; i++) {
          if (safeContentsBuf[i] === 0x30 && safeContentsBuf[i + 1] === 0x82) {
            const len = (safeContentsBuf[i + 2] << 8) | safeContentsBuf[i + 3];
            const totalLen = len + 4;
            if (totalLen > 100 && i + totalLen <= safeContentsBuf.length) {
              const candidate = safeContentsBuf.subarray(i, i + totalLen);
              try {
                const cert = new crypto.X509Certificate(candidate);
                if (cert.subject && cert.validTo) {
                  results.push(candidate);
                  i += totalLen - 1;
                }
              } catch {}
            }
          }
        }
      }
    }
  } catch { /* buffer malformado — retorna o que foi coletado até aqui */ }
  return results;
}

/** Aplica scoring ICP-Brasil para selecionar o certificado folha mais relevante. */
function _scoreCert(cert) {
  const subj     = cert.subject || '';
  const fullText = subj + ' ' + (cert.subjectAltName || '');
  if (/OID\.2\.16\.76\.1\.3\.3=/.test(subj))              return 3; // CNPJ ICP OID
  if (/OID\.2\.16\.76\.1\.3\.1=/.test(subj))              return 2; // CPF ICP OID
  if (/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/.test(fullText)) return 3; // CNPJ formatado
  if (/(?<!\d)(\d{14})(?!\d)/.test(fullText))              return 2; // CNPJ puro 14d
  return 1; // qualquer cert válido aceito como último recurso
}

/**
 * Fallback de extração via engine OpenSSL local (Node.js).
 */
function extractCertViaTls(pfxBuffer, passphrase) {
  if (typeof tls?.createServer !== 'function') {
    return Promise.reject(new Error('tls.createServer indisponível neste ambiente.'));
  }
  return new Promise((resolve, reject) => {
    let server = null;
    let client = null;
    let timer = null;
    let resolved = false;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (client && !client.destroyed) {
        try { client.destroy(); } catch {}
      }
      if (server) {
        try { server.close(); } catch {}
      }
    };

    const done = (err, cert) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      if (err) reject(err);
      else resolve(cert);
    };

    try {
      server = tls.createServer({
        pfx: pfxBuffer,
        passphrase: String(passphrase || ''),
        rejectUnauthorized: false
      });
    } catch (e) {
      return reject(e);
    }

    server.once('error', (err) => done(err));

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        return done(new Error('Falha ao obter porta local para validação do certificado.'));
      }

      try {
        client = tls.connect({
          host: '127.0.0.1',
          port: addr.port,
          rejectUnauthorized: false
        }, () => {
          try {
            const peerX509 = client.getPeerX509Certificate();
            if (peerX509) {
              return done(null, peerX509);
            }
            const rawPeer = client.getPeerCertificate(true);
            if (rawPeer && rawPeer.raw) {
              return done(null, new crypto.X509Certificate(rawPeer.raw));
            }
            done(new Error('Certificado não retornado durante o handshake TLS.'));
          } catch (e) {
            done(e);
          }
        });
      } catch (connErr) {
        return done(connErr);
      }

      client.once('error', (err) => done(err));

      timer = setTimeout(() => {
        done(new Error('Timeout na extração do certificado digital A1 via TLS.'));
      }, 5000);
      if (timer.unref) timer.unref();
    });
  });
}

/**
 * Extrai o certificado X.509 folha mais relevante de um buffer PFX/P12.
 *
 * Estratégia em três etapas com processamento síncrono em memória prioritário:
 *   1. Parser PKCS#12 estruturado via DER em memória (RFC 7292): decifra bags
 *      3DES / AES PBES2 e extrai certBags sem dependência de sockets ou portas TCP.
 *   2. Fallback de TLS loopback local quando suportado no ambiente Node.js.
 *   3. Fallback de varredura byte-a-byte buscando sequências SEQUENCE 0x30 0x82.
 */
export async function extractX509FromPfx(buffer, passphrase = '') {
  // ── Tentativa 1: parse PKCS#12 estruturado via DER em pura memória ─────────
  const derList = _extractCertDERsFromPkcs12(buffer, passphrase);
  if (derList.length > 0) {
    let best = null, bestScore = -1;
    for (const der of derList) {
      try {
        const cert = new crypto.X509Certificate(der);
        if (!cert.subject || !cert.validTo) continue;
        const score = _scoreCert(cert);
        if (score > bestScore) { bestScore = score; best = cert; }
      } catch {}
    }
    if (best) return best;
  }

  // ── Tentativa 2: Handshake TLS local com engine nativa OpenSSL (Node.js) ───
  if (passphrase) {
    try {
      const tlsCert = await extractCertViaTls(buffer, passphrase);
      if (tlsCert && (tlsCert.subject || tlsCert.raw)) {
        return tlsCert;
      }
    } catch {
      // Falha no handshake local — segue para o fallback byte-a-byte
    }
  }

  // ── Tentativa 3: fallback varredura byte-a-byte (PFX legados/simples) ──────
  let bestCert = null;
  let bestScore = -1;
  for (let i = 0; i < buffer.length - 100; i++) {
    if (buffer[i] === 0x30 && buffer[i + 1] === 0x82) {
      const len = (buffer[i + 2] << 8) | buffer[i + 3];
      const totalLen = len + 4;
      if (totalLen > 100 && i + totalLen <= buffer.length) {
        try {
          const slice = buffer.subarray(i, i + totalLen);
          const cert = new crypto.X509Certificate(slice);
          if (cert.subject && cert.validTo) {
            const score = _scoreCert(cert);
            if (score > bestScore) { bestScore = score; bestCert = cert; }
            // Avança o cursor apenas se o cert foi consumido (evita reanálise)
            i += totalLen - 1;
          }
        } catch {}
      }
    }
  }
  return bestCert;
}

function safeIsoDate(d) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  } catch {
    return null;
  }
}

export function parseCertDetails(cert) {
  const subject = cert.subject || '';
  const issuer = cert.issuer || '';

  const cnMatch = subject.match(/CN=([^,\n/]+)/i);
  const commonName = cnMatch ? cnMatch[1].trim() : '';

  let cnpj = null;
  const altName = cert.subjectAltName || '';
  const fullText = subject + ' ' + altName;

  // 1. CNPJ embutido no CN no padrão oficial ICP-Brasil A1: "RAZÃO SOCIAL:CNPJ" ou "RAZÃO SOCIAL - CNPJ" (14 dígitos)
  if (commonName.includes(':') || commonName.includes(' - ')) {
    const sep = commonName.includes(':') ? ':' : ' - ';
    const cnParts = commonName.split(sep);
    const candidate = (cnParts[cnParts.length - 1] || '').replace(/\D/g, '');
    if (candidate.length === 14) cnpj = candidate;
  }

  // 2. OID ICP-Brasil para CNPJ: 2.16.76.1.3.3=<14 dígitos>
  if (!cnpj) {
    const icpCnpjMatch = fullText.match(/2\.16\.76\.1\.3\.3[^\d]*(\d{14})/i) ||
                         subject.match(/OID\.2\.16\.76\.1\.3\.3=(\d{14})/i);
    if (icpCnpjMatch) {
      cnpj = icpCnpjMatch[1];
    }
  }

  // 3. CNPJ formatado (XX.XXX.XXX/XXXX-XX) em qualquer campo legível
  if (!cnpj) {
    const fmtMatch = fullText.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (fmtMatch) cnpj = fmtMatch[1].replace(/\D/g, '');
  }

  // 4. Fallback para CPF ICP-Brasil (e-CPF): CN=:11digits ou OID 2.16.76.1.3.1
  if (!cnpj) {
    if (commonName.includes(':')) {
      const cnParts = commonName.split(':');
      const candidate = (cnParts[cnParts.length - 1] || '').replace(/\D/g, '');
      if (candidate.length === 11) cnpj = candidate;
    }
    if (!cnpj) {
      const icpCpfMatch = fullText.match(/2\.16\.76\.1\.3\.1[^\d]*(\d{11})/i) ||
                          subject.match(/OID\.2\.16\.76\.1\.3\.1=(\d{11})/i);
      if (icpCpfMatch) cnpj = icpCpfMatch[1];
    }
  }

  // 5. Último recurso: 14 dígitos isolados fora de OU=
  if (!cnpj) {
    // Remove ocorrências de OU=... para não capturar número de chamado/AR de Autoridades Certificadoras
    const sanitizedText = fullText.replace(/OU=[^,\n/]+/gi, '');
    const pureMatch = sanitizedText.match(/(?<!\d)(\d{14})(?!\d)/);
    if (pureMatch) cnpj = pureMatch[1];
  }

  let razaoSocial = commonName;
  if (commonName.includes(':')) {
    razaoSocial = commonName.split(':')[0].trim();
  }

  return {
    cnpj,
    razaoSocial: razaoSocial || 'Empresa Certificada',
    validoDe: safeIsoDate(cert.validFrom),
    validoAte: safeIsoDate(cert.validTo),
    emissor: issuer,
    serialNumber: cert.serialNumber || null
  };
}


export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({
      success: false,
      error: auth.error || 'Acesso não autorizado.'
    });
  }

  let baseSql;
  try {
    baseSql = createRuntimeSql();
  } catch (err) {
    console.error('[Certificado] Runtime database indisponível:', err.message);
    return res.status(500).json({ success: false, error: 'Banco de dados não configurado no servidor.' });
  }
  const sql = createTenantSql(baseSql, { tenantId: auth.tenantId });

  const action = req.query.action || (req.body && req.body.action) || (req.method === 'GET' ? 'status' : '');

  try {
    // ── 1. STATUS DO CERTIFICADO ──────────────────────────────────────────────
    if (action === 'status' || (req.method === 'GET' && !action)) {
      if (!canAccessModule(auth, 'notas', 'read')) {
        return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN', 'notas'));
      }

      const rows = await sql`
        SELECT
          tenant_id, cnpj, razao_social, valido_de, valido_ate,
          emissor, serial_number, nome_arquivo, tamanho_bytes,
          status, updated_at
        FROM tenant_certificates
        WHERE tenant_id = ${auth.tenantId}
        LIMIT 1;
      `;

      if (!rows || rows.length === 0) {
        return res.status(200).json({
          success: true,
          configurado: false,
          certificado: null
        });
      }

      const cert = rows[0];
      const validadeMs = cert.valido_ate ? new Date(cert.valido_ate).getTime() : 0;
      const agoraMs = Date.now();
      const diasRestantes = Math.ceil((validadeMs - agoraMs) / (1000 * 60 * 60 * 24));
      const vencido = diasRestantes <= 0;
      const expirando = !vencido && diasRestantes <= 30;

      return res.status(200).json({
        success: true,
        configurado: true,
        certificado: {
          cnpj: cert.cnpj,
          razao_social: cert.razao_social,
          valido_de: cert.valido_de,
          valido_ate: cert.valido_ate,
          dias_restantes: diasRestantes,
          vencido,
          expirando,
          emissor: cert.emissor,
          serial_number: cert.serial_number,
          nome_arquivo: cert.nome_arquivo,
          tamanho_bytes: Number(cert.tamanho_bytes || 0),
          status: cert.status,
          updated_at: cert.updated_at
        }
      });
    }

    // ── 2. UPLOAD E VINCULAÇÃO DE CERTIFICADO A1 (.pfx / .p12) ─────────────────
    if (action === 'upload' || (req.method === 'POST' && action === 'upload')) {
      if (!canAccessModule(auth, 'notas', 'write')) {
        return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN', 'notas'));
      }

      const pfxRaw = req.body?.pfx_base64 || req.body?.base64 || req.body?.arquivo;
      const senha = String(req.body?.senha ?? req.body?.passphrase ?? '');
      const nomeArquivo = String(req.body?.nome_arquivo || 'certificado_a1.pfx').slice(0, 255);

      if (!pfxRaw) {
        return res.status(400).json({ success: false, error: 'Arquivo do certificado digital A1 não informado.' });
      }
      if (!senha) {
        return res.status(400).json({ success: false, error: 'A senha do certificado digital é obrigatória.' });
      }

      const cleanBase64 = String(pfxRaw).replace(/^data:[^;]+;base64,/, '').trim();
      const pfxBuffer = Buffer.from(cleanBase64, 'base64');

      if (pfxBuffer.length === 0) {
        return res.status(400).json({ success: false, error: 'Arquivo de certificado digital vazio ou corrompido.' });
      }
      if (pfxBuffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: 'Tamanho do certificado excede o limite máximo de 5MB.' });
      }

      console.log('[Certificado] PFX recebido:', {
        bytes: pfxBuffer.length,
        nomeArquivo,
        senhaInformada: Boolean(senha)
      });

      // Validação de integridade e senha PKCS#12 em memória (RFC 7292)
      const macCheck = verifyPkcs12Mac(pfxBuffer, senha);
      if (macCheck.hasMac && !macCheck.ok) {
        return res.status(400).json({
          success: false,
          error: 'Senha do certificado digital incorreta. Verifique a senha digitada.'
        });
      }

      // Validação criptográfica com engine nativa OpenSSL (Node.js)
      try {
        tls.createSecureContext({
          pfx: pfxBuffer,
          passphrase: senha
        });
      } catch (tlsErr) {
        const msg = String(tlsErr.message || '').toLowerCase();
        if (msg.includes('mac verify') || msg.includes('bad decrypt') || msg.includes('pkcs12_parse') || msg.includes('password')) {
          return res.status(400).json({
            success: false,
            error: 'Senha do certificado digital incorreta. Verifique a senha digitada.'
          });
        }
        return res.status(400).json({
          success: false,
          error: 'Arquivo PKCS#12 inválido ou formato não suportado. Envie um arquivo .pfx ou .p12 válido.'
        });
      }

      console.log('[Certificado] PFX validado com sucesso');

      // Extração de metadados do certificado X.509 diretamente em memória
      const certX509 = await extractX509FromPfx(pfxBuffer, senha);
      if (!certX509) {
        return res.status(400).json({
          success: false,
          error: 'Não foi possível extrair o certificado X.509 do arquivo informado.'
        });
      }

      console.log('[Certificado] X509 extraído:', {
        subject: certX509?.subject,
        issuer: certX509?.issuer,
        validFrom: certX509?.validFrom,
        validTo: certX509?.validTo
      });

      const details = parseCertDetails(certX509);
      if (!details.validoAte) {
        return res.status(400).json({
          success: false,
          error: 'Certificado não contém data de validade legível.'
        });
      }

      const validadeDate = new Date(details.validoAte);
      if (validadeDate.getTime() < Date.now()) {
        return res.status(400).json({
          success: false,
          error: `O certificado digital informado está expirado desde ${validadeDate.toLocaleDateString('pt-BR')}.`
        });
      }

      // Criptografia AES-256-GCM em repouso
      const enc = encryptCertData(pfxBuffer, senha);

      const antes = await sql`
        SELECT cnpj, razao_social, valido_ate, status FROM tenant_certificates WHERE tenant_id = ${auth.tenantId} LIMIT 1;
      `;

      await sql`
        INSERT INTO tenant_certificates (
          tenant_id, cert_pfx_base64_enc, cert_pass_enc, iv, auth_tag,
          cnpj, razao_social, valido_de, valido_ate, emissor, serial_number,
          nome_arquivo, tamanho_bytes, status, updated_at
        ) VALUES (
          ${auth.tenantId}, ${enc.encBase64}, 'aes-256-gcm', ${enc.ivHex}, ${enc.authTagHex},
          ${details.cnpj}, ${details.razaoSocial}, ${details.validoDe}, ${details.validoAte},
          ${details.emissor}, ${details.serialNumber}, ${nomeArquivo}, ${pfxBuffer.length},
          'ativo', NOW()
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          cert_pfx_base64_enc = EXCLUDED.cert_pfx_base64_enc,
          cert_pass_enc = EXCLUDED.cert_pass_enc,
          iv = EXCLUDED.iv,
          auth_tag = EXCLUDED.auth_tag,
          cnpj = EXCLUDED.cnpj,
          razao_social = EXCLUDED.razao_social,
          valido_de = EXCLUDED.valido_de,
          valido_ate = EXCLUDED.valido_ate,
          emissor = EXCLUDED.emissor,
          serial_number = EXCLUDED.serial_number,
          nome_arquivo = EXCLUDED.nome_arquivo,
          tamanho_bytes = EXCLUDED.tamanho_bytes,
          status = 'ativo',
          updated_at = NOW();
      `;

      await writeAudit(sql, req, auth, {
        acao: 'VINCULAR_CERTIFICADO_A1',
        entidade: 'tenant_certificates',
        entidadeId: auth.tenantId,
        antes: antes[0] || null,
        depois: {
          cnpj: details.cnpj,
          razao_social: details.razaoSocial,
          valido_ate: details.validoAte,
          nome_arquivo: nomeArquivo
        }
      });

      const diasRestantes = Math.ceil((validadeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return res.status(200).json({
        success: true,
        message: 'Certificado Digital A1 validado e vinculado com sucesso!',
        certificado: {
          cnpj: details.cnpj,
          razao_social: details.razaoSocial,
          valido_de: details.validoDe,
          valido_ate: details.validoAte,
          dias_restantes: diasRestantes,
          emissor: details.emissor,
          nome_arquivo: nomeArquivo
        }
      });
    }

    // ── 3. REMOÇÃO DE CERTIFICADO ─────────────────────────────────────────────
    if (action === 'remover' || req.method === 'DELETE') {
      if (!canAccessModule(auth, 'notas', 'delete')) {
        return res.status(403).json(permissionError('MODULE_DELETE_FORBIDDEN', 'notas'));
      }

      const antes = await sql`
        SELECT cnpj, razao_social, valido_ate, nome_arquivo FROM tenant_certificates WHERE tenant_id = ${auth.tenantId} LIMIT 1;
      `;

      if (!antes || antes.length === 0) {
        return res.status(404).json({ success: false, error: 'Nenhum certificado digital cadastrado para este tenant.' });
      }

      await sql`
        DELETE FROM tenant_certificates WHERE tenant_id = ${auth.tenantId};
      `;

      await writeAudit(sql, req, auth, {
        acao: 'REMOVER_CERTIFICADO_A1',
        entidade: 'tenant_certificates',
        entidadeId: auth.tenantId,
        antes: antes[0],
        depois: null
      });

      return res.status(200).json({
        success: true,
        message: 'Certificado Digital A1 removido com sucesso.'
      });
    }

    return res.status(400).json({ success: false, error: 'Ação não suportada.' });
  } catch (err) {
    console.error('🚨 [Certificado] Erro:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno no processamento do certificado digital.'
    });
  }
}
