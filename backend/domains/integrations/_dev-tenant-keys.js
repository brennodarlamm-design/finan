// api/_dev-tenant-keys.js — Cofre server-side das Chaves da Empresa para DEV / Master
// Helper interno compartilhado por uma rota serverless existente para respeitar o limite Hobby da Vercel.

import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant, getInternalApiSecret } from './_auth.js';
import { generateTenantAccessKey, hashTenantAccessKey, hashTenantAccessKeyLegacy, tenantAccessKeyLast4 } from './_tenant-access-key.js';
import { writeAudit } from './_audit.js';
import { createOwnerSql } from './_database.js';

function getSql() {
  return createOwnerSql();
}

function deriveVaultKey() {
  const secret = getInternalApiSecret();
  if (!secret) throw new Error('INTERNAL_API_SECRET não configurado para o cofre de chaves.');
  return crypto.createHash('sha256').update(`finobra:dev-tenant-keys:v1:${secret}`, 'utf8').digest();
}

function encryptAccessKey(accessKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveVaultKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(accessKey), 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex')
  };
}

function decryptAccessKey(row) {
  if (!row?.key_ciphertext || !row?.key_iv || !row?.key_auth_tag) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveVaultKey(), Buffer.from(row.key_iv, 'hex'));
  decipher.setAuthTag(Buffer.from(row.key_auth_tag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.key_ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

async function requireMasterMfa(req) {
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return { ok: false, auth, status: auth.status || 401, error: auth.error || 'Não autorizado.' };
  if (auth.isSystem || auth.user?.perfil !== 'superadmin') {
    return { ok: false, auth, status: 403, error: 'Rota restrita ao Super Admin humano.' };
  }
  if (!auth.user?.mfa_enabled || !auth.user?.mfa_verified) {
    return { ok: false, auth, status: 403, error: 'MFA obrigatório para consultar chaves de empresas.' };
  }
  return { ok: true, auth };
}

function safeTenantId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{1,100}$/.test(id) ? id : '';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');

  if (!['GET', 'POST'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  const guard = await requireMasterMfa(req);
  if (!guard.ok) return res.status(guard.status).json({ success: false, error: guard.error });

  const sql = getSql();

  try {
    if (req.method === 'GET') {
      const action = String(req.query?.action || 'list').trim().toLowerCase();

      if (action === 'reveal') {
        const tenantId = safeTenantId(req.query?.tenantId || req.query?.tenant_id);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant inválido.' });

        const rows = await sql`
          SELECT t.id, t.nome_fantasia, t.razao_social, t.access_key_hash, t.access_key_last4,
                 v.key_ciphertext, v.key_iv, v.key_auth_tag, v.updated_at AS vault_updated_at
          FROM tenants t
          LEFT JOIN dev_tenant_keys v ON v.tenant_id = t.id
          WHERE t.id = ${tenantId}
          LIMIT 1;
        `;
        if (!rows.length) return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
        if (!rows[0].key_ciphertext) {
          return res.status(409).json({
            success: false,
            needsRotation: true,
            error: 'A chave atual existe apenas como hash. Rotacione a chave uma vez para gravá-la no cofre DEV criptografado.'
          });
        }

        let accessKey;
        try {
          accessKey = decryptAccessKey(rows[0]);
        } catch (err) {
          console.error('[DEV Tenant Keys] Falha ao descriptografar chave:', tenantId, err.message);
          return res.status(409).json({ success: false, error: 'A chave armazenada não pôde ser descriptografada. Rotacione-a.' });
        }

        const pepperedMatch = accessKey && hashTenantAccessKey(accessKey) === rows[0].access_key_hash;
        const legacyMatch = !pepperedMatch && accessKey && hashTenantAccessKeyLegacy(accessKey) === rows[0].access_key_hash;

        if (!pepperedMatch && !legacyMatch) {
          return res.status(409).json({ success: false, error: 'A chave do cofre não corresponde ao hash ativo. Rotacione-a.' });
        }

        if (legacyMatch) {
          try {
            const upgradedHash = hashTenantAccessKey(accessKey);
            await sql`UPDATE tenants SET access_key_hash = ${upgradedHash} WHERE id = ${tenantId};`;
            rows[0].access_key_hash = upgradedHash;
          } catch (mErr) {
            console.warn('[DEV Tenant Keys] Falha ao auto-migrar hash com pepper:', mErr.message);
          }
        }

        await writeAudit(sql, req, guard.auth, {
          acao: 'tenant_access_key_revealed',
          entidade: 'tenant',
          entidadeId: tenantId,
          depois: { last4: rows[0].access_key_last4 || null }
        });

        return res.status(200).json({
          success: true,
          tenantId,
          nomeFantasia: rows[0].nome_fantasia || rows[0].razao_social || tenantId,
          accessKey,
          last4: rows[0].access_key_last4 || tenantAccessKeyLast4(accessKey),
          vaultUpdatedAt: rows[0].vault_updated_at || null
        });
      }

      if (action !== 'list') return res.status(400).json({ success: false, error: 'Ação inválida.' });

      const rows = await sql`
        SELECT
          t.id,
          t.nome_fantasia,
          t.razao_social,
          t.status,
          t.access_key_last4,
          t.access_key_created_at,
          (v.tenant_id IS NOT NULL) AS vault_ready,
          v.updated_at AS vault_updated_at
        FROM tenants t
        LEFT JOIN dev_tenant_keys v ON v.tenant_id = t.id
        ORDER BY t.created_at ASC;
      `;

      return res.status(200).json({
        success: true,
        keys: rows.map(row => ({
          tenantId: row.id,
          nomeFantasia: row.nome_fantasia || row.razao_social || row.id,
          razaoSocial: row.razao_social || '',
          status: row.status,
          last4: row.access_key_last4 || null,
          createdAt: row.access_key_created_at || null,
          vaultReady: Boolean(row.vault_ready),
          vaultUpdatedAt: row.vault_updated_at || null
        }))
      });
    }

    const action = String(req.query?.action || req.body?.action || 'rotate').trim().toLowerCase();
    if (action !== 'rotate') return res.status(400).json({ success: false, error: 'Ação inválida.' });

    const tenantId = safeTenantId(req.body?.tenantId || req.body?.tenant_id);
    if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant inválido.' });

    const tenantRows = await sql`
      SELECT id, nome_fantasia, razao_social, status, access_key_last4
      FROM tenants
      WHERE id = ${tenantId}
      LIMIT 1;
    `;
    if (!tenantRows.length) return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });

    let accessKey = '';
    let keyHash = '';
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = generateTenantAccessKey();
      const candidateHash = hashTenantAccessKey(candidate);
      const collision = await sql`
        SELECT 1 FROM tenants
        WHERE access_key_hash = ${candidateHash} AND id <> ${tenantId}
        LIMIT 1;
      `;
      if (!collision.length) {
        accessKey = candidate;
        keyHash = candidateHash;
        break;
      }
    }
    if (!accessKey) throw new Error('Não foi possível gerar uma chave única para a empresa.');

    const last4 = tenantAccessKeyLast4(accessKey);
    const enc = encryptAccessKey(accessKey);

    const rotated = await sql`
      WITH updated AS (
        UPDATE tenants
        SET access_key_hash = ${keyHash},
            access_key_last4 = ${last4},
            access_key_created_at = NOW(),
            updated_at = NOW()
        WHERE id = ${tenantId}
        RETURNING id
      )
      INSERT INTO dev_tenant_keys (
        tenant_id, key_ciphertext, key_iv, key_auth_tag, encryption_version, created_at, updated_at
      )
      SELECT id, ${enc.ciphertext}, ${enc.iv}, ${enc.authTag}, 1, NOW(), NOW()
      FROM updated
      ON CONFLICT (tenant_id) DO UPDATE SET
        key_ciphertext = EXCLUDED.key_ciphertext,
        key_iv = EXCLUDED.key_iv,
        key_auth_tag = EXCLUDED.key_auth_tag,
        encryption_version = EXCLUDED.encryption_version,
        updated_at = NOW()
      RETURNING tenant_id, updated_at;
    `;

    if (!rotated.length) throw new Error('A rotação não atualizou a empresa informada.');

    await writeAudit(sql, req, guard.auth, {
      acao: 'tenant_access_key_rotated',
      entidade: 'tenant',
      entidadeId: tenantId,
      antes: { last4: tenantRows[0].access_key_last4 || null },
      depois: { last4, vault: 'aes-256-gcm' }
    });

    return res.status(200).json({
      success: true,
      tenantId,
      nomeFantasia: tenantRows[0].nome_fantasia || tenantRows[0].razao_social || tenantId,
      accessKey,
      last4,
      message: 'Chave rotacionada e armazenada no cofre DEV criptografado.'
    });
  } catch (err) {
    if (err?.code === '42P01') {
      return res.status(503).json({
        success: false,
        error: 'Cofre DEV ainda não foi criado no banco. Aplique a migration 027 antes de consultar ou rotacionar chaves.'
      });
    }
    console.error('[DEV Tenant Keys] Erro:', err);
    return res.status(500).json({ success: false, error: 'Falha interna ao acessar o cofre de chaves das empresas.' });
  }
}
