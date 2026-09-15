import crypto from 'crypto';

const KEY_PREFIX = 'FO';
const KEY_BYTES = 24;

export function normalizeTenantAccessKey(value = '') {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function generateTenantAccessKey() {
  const raw = crypto.randomBytes(KEY_BYTES).toString('base64url').toUpperCase();
  const compact = raw.replace(/[^A-Z0-9]/g, '').slice(0, 30);
  return `${KEY_PREFIX}-${compact.match(/.{1,6}/g).join('-')}`;
}

export function hashTenantAccessKey(value) {
  const normalized = normalizeTenantAccessKey(value);
  if (!normalized) return '';
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function tenantAccessKeyLast4(value) {
  const normalized = normalizeTenantAccessKey(value).replace(/[^A-Z0-9]/g, '');
  return normalized.slice(-4);
}

export function isTenantAccessKeyShapeValid(value) {
  const normalized = normalizeTenantAccessKey(value);
  return /^FO-[A-Z0-9]{6}(?:-[A-Z0-9]{1,6}){3,5}$/.test(normalized);
}

export function timingSafeHashEqual(leftHash, rightHash) {
  const left = Buffer.from(String(leftHash || ''), 'utf8');
  const right = Buffer.from(String(rightHash || ''), 'utf8');
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function resolveTenantByAccessKey(sql, accessKey) {
  if (!isTenantAccessKeyShapeValid(accessKey)) return null;
  const keyHash = hashTenantAccessKey(accessKey);
  const rows = await sql`
    SELECT id, razao_social, nome_fantasia, cnpj, telefone, plano, status,
           created_at, vencimento, access_key_hash, access_key_last4, access_key_created_at
    FROM tenants
    WHERE access_key_hash = ${keyHash}
    LIMIT 1;
  `;
  if (!rows.length) return null;
  const tenant = rows[0];
  if (!timingSafeHashEqual(keyHash, tenant.access_key_hash)) return null;
  return tenant;
}

export async function resolveTenantUserByLogin(sql, tenantId, usernameOrEmail) {
  const cleanUser = String(usernameOrEmail || '').trim().toLowerCase();
  if (!tenantId || !cleanUser) return null;
  const rows = await sql`
    SELECT
      u.id,
      u.username,
      u.email,
      u.senha_hash,
      u.nome,
      u.perfil,
      u.avatar,
      u.ativo,
      u.tenant_id,
      u.permissoes,
      u.mfa_secret,
      u.mfa_enabled,
      u.mfa_backup_codes,
      u.mfa_last_used_step,
      t.razao_social,
      t.nome_fantasia,
      t.status        AS tenant_status,
      t.created_at    AS tenant_created_at,
      t.vencimento    AS tenant_vencimento
    FROM usuarios u
    LEFT JOIN tenants t ON u.tenant_id = t.id
    WHERE
      u.tenant_id = ${tenantId}
      AND u.perfil <> 'superadmin'
      AND (
        LOWER(u.username) = ${cleanUser}
        OR LOWER(u.email)  = ${cleanUser}
      )
    LIMIT 1;
  `;
  return rows[0] || null;
}
