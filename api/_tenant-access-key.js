import crypto from 'crypto';

function isProduction() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export function normalizeTenantAccessKey(value = '') {
  return String(value || '').trim().replace(/[\s-]+/g, '').toUpperCase();
}

export function generateTenantAccessKey() {
  // PATCH 50.2: Chave de 6 dígitos numéricos (100000 a 999999) para máxima simplicidade do cliente
  return String(crypto.randomInt(100000, 1000000));
}

export function getTenantKeyPepper(customPepper) {
  const dedicated = String(customPepper || process.env.TENANT_KEY_PEPPER || '').trim();
  if (dedicated) {
    if (dedicated.length < 32) {
      throw new Error('TENANT_KEY_PEPPER deve possuir pelo menos 32 caracteres.');
    }
    return dedicated;
  }

  // Patch 56: produção exige segredo dedicado e nunca usa segredo público/hardcoded.
  if (isProduction()) {
    throw new Error('TENANT_KEY_PEPPER não configurado em produção.');
  }

  // Compatibilidade apenas para desenvolvimento/testes locais.
  const devFallback = String(process.env.SESSION_SIGNING_SECRET || '').trim();
  if (devFallback.length >= 32) return devFallback;

  throw new Error('TENANT_KEY_PEPPER não configurado.');
}

export function hashTenantAccessKey(value, customPepper) {
  const normalized = normalizeTenantAccessKey(value);
  if (!normalized) return '';
  const pepper = getTenantKeyPepper(customPepper);
  return crypto.createHmac('sha256', pepper).update(normalized, 'utf8').digest('hex');
}

export function hashTenantAccessKeyLegacy(value) {
  const normalized = normalizeTenantAccessKey(value);
  if (!normalized) return '';
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function tenantAccessKeyLast4(value) {
  const normalized = normalizeTenantAccessKey(value);
  return normalized.slice(-4);
}

export function isTenantAccessKeyShapeValid(value) {
  const normalized = normalizeTenantAccessKey(value);
  // Aceita 6 dígitos numéricos (padrão FinObra) e suporta legado FO-XXXXXX-...
  return /^\d{6}$/.test(normalized) || /^FO-[A-Z0-9]{6}(?:-[A-Z0-9]{1,6}){3,5}$/.test(normalized);
}

export function timingSafeHashEqual(leftHash, rightHash) {
  const left = Buffer.from(String(leftHash || ''), 'utf8');
  const right = Buffer.from(String(rightHash || ''), 'utf8');
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function resolveTenantByAccessKey(sql, accessKey) {
  if (!isTenantAccessKeyShapeValid(accessKey)) return null;
  const pepperedHash = hashTenantAccessKey(accessKey);
  const rows = await sql`
    SELECT id, razao_social, nome_fantasia, cnpj, telefone, plano, status,
           created_at, vencimento, access_key_hash, access_key_last4, access_key_created_at
    FROM tenants
    WHERE access_key_hash = ${pepperedHash}
      AND status NOT IN ('cancelado', 'bloqueado')
    LIMIT 1;
  `;
  if (rows.length && timingSafeHashEqual(pepperedHash, rows[0].access_key_hash)) {
    return rows[0];
  }

  // Fallback transparente: hash legado sem pepper (auto-migração on-the-fly)
  const legacyHash = hashTenantAccessKeyLegacy(accessKey);
  const legacyRows = await sql`
    SELECT id, razao_social, nome_fantasia, cnpj, telefone, plano, status,
           created_at, vencimento, access_key_hash, access_key_last4, access_key_created_at
    FROM tenants
    WHERE access_key_hash = ${legacyHash}
      AND status NOT IN ('cancelado', 'bloqueado')
    LIMIT 1;
  `;
  if (legacyRows.length && timingSafeHashEqual(legacyHash, legacyRows[0].access_key_hash)) {
    const tenant = legacyRows[0];
    try {
      await sql`UPDATE tenants SET access_key_hash = ${pepperedHash} WHERE id = ${tenant.id};`;
      tenant.access_key_hash = pepperedHash;
    } catch (err) {
      console.warn('[Tenant Key] Falha na auto-migração de hash com pepper:', err.message);
    }
    return tenant;
  }

  return null;
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
      t.telefone      AS tenant_telefone,
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
