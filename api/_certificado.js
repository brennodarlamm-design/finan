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
const _OID_PKCS7_DATA     = Buffer.from('2a864886f70d010701',    'hex'); // 1.2.840.113549.1.7.1
const _OID_CERT_BAG       = Buffer.from('2a864886f70d010c0a0103','hex'); // 1.2.840.113549.1.12.10.1.3
const _OID_X509_CERT_TYPE = Buffer.from('2a864886f70d01091601',  'hex'); // 1.2.840.113549.1.9.22.1

/**
 * Extrai buffers DER brutos dos certificados X.509 contidos em cert bags
 * não-encriptadas de um arquivo PKCS#12 (.pfx/.p12).
 *
 * Estrutura percorrida (RFC 7292):
 *   PFX → authSafe ContentInfo → AuthenticatedSafe (SEQUENCE OF ContentInfo)
 *     → SafeContents (para cada ContentInfo data não-encriptada)
 *       → SafeBag (bagId = certBag)
 *         → CertBag → [0] OCTET STRING → DER X.509
 */
function _extractCertDERsFromPkcs12(pfxBuf) {
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
      if (!ciOid || ciOid.tag !== 0x06) continue;
      // Processa apenas ContentInfos do tipo data (não-encriptadas)
      if (!ciOid.val.equals(_OID_PKCS7_DATA)) continue;
      if (!ciCont || (ciCont.tag & 0xe0) !== 0xa0) continue;

      // [0] EXPLICIT → OCTET STRING → SafeContents DER
      const scOctet = derTLV(ciCont.val, 0);
      if (!scOctet || scOctet.tag !== 0x04) continue;
      const scSeq = derTLV(scOctet.val, 0);
      if (!scSeq || scSeq.tag !== 0x30) continue;

      // 6. SafeContents ::= SEQUENCE OF SafeBag
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
 * Extrai o certificado X.509 utilizando o engine OpenSSL nativo do Node.js através de um
 * handshake TLS local temporário sobre interface de loopback (127.0.0.1 com porta efêmera 0).
 *
 * Suporta perfeitamente arquivos PKCS#12 (.pfx/.p12) modernos e legados da ICP-Brasil onde as
 * cert bags estão dentro de ContentInfo do tipo encryptedData (3DES PBE, AES PBES2 ou RC2).
 */
function extractCertViaTls(pfxBuffer, passphrase) {
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
 * Estratégia em três etapas:
 *   1. Extração nativa OpenSSL via handshake TLS local em loopback:
 *      decifra com perfeição PKCS#12 com bags cifradas (3DES, AES, RC2)
 *      utilizando a senha fornecida pelo usuário.
 *   2. Parser PKCS#12 estruturado via DER: lida com cert bags não-cifradas.
 *   3. Fallback: varredura byte-a-byte buscando sequências SEQUENCE 0x30 0x82.
 */
export async function extractX509FromPfx(buffer, passphrase = '') {
  // ── Tentativa 1: Handshake TLS local com engine nativa OpenSSL ─────────────
  if (passphrase) {
    try {
      const tlsCert = await extractCertViaTls(buffer, passphrase);
      if (tlsCert && (tlsCert.subject || tlsCert.raw)) {
        return tlsCert;
      }
    } catch {
      // Falha no handshake local — segue para os parsers DER
    }
  }

  // ── Tentativa 2: parse PKCS#12 estruturado via DER (bags não-cifradas) ─────
  const derList = _extractCertDERsFromPkcs12(buffer);
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

  // 1. OID ICP-Brasil para CNPJ: 2.16.76.1.3.3=<14 dígitos>
  const icpCnpjMatch = fullText.match(/2\.16\.76\.1\.3\.3[^\d]*(\d{14})/i) ||
                       subject.match(/OID\.2\.16\.76\.1\.3\.3=(\d{14})/i);
  if (icpCnpjMatch) {
    cnpj = icpCnpjMatch[1];
  }

  // 2. CNPJ formatado (XX.XXX.XXX/XXXX-XX) em qualquer campo legível
  if (!cnpj) {
    const fmtMatch = fullText.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (fmtMatch) cnpj = fmtMatch[1].replace(/\D/g, '');
  }

  // 3. CNPJ puro de 14 dígitos isolado — ex.: CN=EMPRESA LTDA:12345678000195
  if (!cnpj) {
    const pureMatch = fullText.match(/(?<!\d)(\d{14})(?!\d)/);
    if (pureMatch) cnpj = pureMatch[1];
  }

  // 4. CNPJ embutido no CN no padrão ICP-Brasil A1: "RAZÃO SOCIAL:CNPJ"
  if (!cnpj && commonName.includes(':')) {
    const cnParts = commonName.split(':');
    const candidate = (cnParts[cnParts.length - 1] || '').replace(/\D/g, '');
    if (candidate.length === 14) cnpj = candidate;
  }

  // 5. Fallback para CPF ICP-Brasil (e-CPF): OID 2.16.76.1.3.1 ou 11 dígitos
  if (!cnpj) {
    const icpCpfMatch = fullText.match(/2\.16\.76\.1\.3\.1[^\d]*(\d{11})/i) ||
                        subject.match(/OID\.2\.16\.76\.1\.3\.1=(\d{11})/i);
    if (icpCpfMatch) {
      cnpj = icpCpfMatch[1];
    } else if (commonName.includes(':')) {
      const cnParts = commonName.split(':');
      const candidate = (cnParts[cnParts.length - 1] || '').replace(/\D/g, '');
      if (candidate.length === 11) cnpj = candidate;
    }
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

      // Validação criptográfica com engine nativa OpenSSL
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

      console.log('[Certificado] PFX validado pelo OpenSSL/Node');

      // Extração de metadados do certificado X.509
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
