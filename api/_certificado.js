// api/certificado.js — Gestão Segura de Certificado Digital A1 com Criptografia AES-256-GCM

import crypto from 'crypto';
import tls from 'tls';
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { canAccessModule, permissionError } from './_permissions.js';
import { writeAudit } from './_audit.js';

const ALLOWED_ORIGINS = [
  'https://finobra.app.br',
  'https://www.finobra.app.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey, x-tenant-id');
}

function getEncryptionKey() {
  const secret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();
  if (!secret) throw new Error('Chave de criptografia não configurada no servidor (API_SECRET pendente).');
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptCertData(pfxBuffer, passphrase) {
  const key = getEncryptionKey();
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

export function decryptCertData(encBase64, ivHex, authTagHex) {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encBase64, 'base64')), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

function extractX509FromPfx(buffer) {
  let bestCert = null;
  for (let i = 0; i < buffer.length - 100; i++) {
    if (buffer[i] === 0x30 && buffer[i + 1] === 0x82) {
      const len = (buffer[i + 2] << 8) | buffer[i + 3];
      const totalLen = len + 4;
      if (totalLen > 100 && i + totalLen <= buffer.length) {
        try {
          const slice = buffer.subarray(i, i + totalLen);
          const cert = new crypto.X509Certificate(slice);
          if (cert.subject && cert.validTo) {
            const subj = cert.subject || '';
            if (/(\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/.test(subj)) {
              return cert;
            }
            if (!bestCert) bestCert = cert;
            i += totalLen - 1;
          }
        } catch {}
      }
    }
  }
  return bestCert;
}

function parseCertDetails(cert) {
  const subject = cert.subject || '';
  const issuer = cert.issuer || '';

  const cnMatch = subject.match(/CN=([^,\n/]+)/i);
  const commonName = cnMatch ? cnMatch[1].trim() : '';

  let cnpj = null;
  const fullText = subject + ' ' + (cert.subjectAltName || '');
  const cnpjMatch = fullText.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})|(?<!\d)(\d{14})(?!\d)/);
  if (cnpjMatch) {
    cnpj = (cnpjMatch[1] || cnpjMatch[2]).replace(/\D/g, '');
  }

  let razaoSocial = commonName;
  if (commonName.includes(':')) {
    razaoSocial = commonName.split(':')[0].trim();
  }

  return {
    cnpj,
    razaoSocial: razaoSocial || 'Empresa Certificada',
    validoDe: cert.validFrom ? new Date(cert.validFrom).toISOString() : null,
    validoAte: cert.validTo ? new Date(cert.validTo).toISOString() : null,
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

  const conn = process.env.DATABASE_URL;
  if (!conn) {
    return res.status(500).json({ success: false, error: 'Banco de dados não configurado no servidor.' });
  }
  const sql = neon(conn);

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
      const senha = String(req.body?.senha || req.body?.passphrase || '').trim();
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

      // Extração de metadados do certificado X.509
      const certX509 = extractX509FromPfx(pfxBuffer);
      if (!certX509) {
        return res.status(400).json({
          success: false,
          error: 'Não foi possível extrair o certificado X.509 do arquivo informado.'
        });
      }

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
      error: 'Erro interno no processamento do certificado digital.',
      detail: err.message
    });
  }
}
