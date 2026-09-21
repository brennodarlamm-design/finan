// scripts/migrate-legacy-mfa-secrets.js
// Patch 56 — Migração controlada de segredos MFA legados para AES-256-GCM.
// Por padrão roda em dry-run. Para aplicar: node scripts/migrate-legacy-mfa-secrets.js --apply

import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { encryptMfaSecret } from '../api/_totp.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const apply = process.argv.includes('--apply');
const conn = String(process.env.DATABASE_OWNER_URL || '').trim();
const mfaKey = String(process.env.MFA_ENCRYPTION_KEY || '').trim();

if (!conn) {
  console.error('DATABASE_OWNER_URL privilegiada não configurada.');
  process.exit(1);
}

if (mfaKey.length < 32) {
  console.error('MFA_ENCRYPTION_KEY dedicada deve possuir pelo menos 32 caracteres.');
  process.exit(1);
}

const sql = neon(conn);
const rows = await sql`
  SELECT id, username, email, mfa_secret, mfa_enabled
  FROM usuarios
  WHERE perfil = 'superadmin'
    AND mfa_enabled = TRUE
    AND mfa_secret IS NOT NULL;
`;

const encrypted = rows.filter(r => String(r.mfa_secret || '').startsWith('v1$'));
const legacy = rows.filter(r => r.mfa_secret && !String(r.mfa_secret).startsWith('v1$'));

console.log(`Superadmins MFA encontrados: ${rows.length}`);
console.log(`Já criptografados: ${encrypted.length}`);
console.log(`Legados a migrar: ${legacy.length}`);

if (!legacy.length) {
  console.log('Nenhum segredo MFA legado pendente.');
  process.exit(0);
}

if (!apply) {
  console.log('DRY-RUN: nenhuma alteração foi realizada. Use --apply somente após validar ambiente e backup.');
  process.exit(0);
}

for (const user of legacy) {
  const original = String(user.mfa_secret);
  const sealed = encryptMfaSecret(original, mfaKey);
  const updated = await sql`
    UPDATE usuarios
    SET mfa_secret = ${sealed}
    WHERE id = ${user.id}
      AND mfa_secret = ${original}
      AND perfil = 'superadmin'
    RETURNING id;
  `;

  if (!updated.length) {
    throw new Error(`Falha de concorrência ao migrar MFA do usuário ${user.id}.`);
  }
  console.log(`MFA criptografado para usuário ${user.id}.`);
}

const remaining = await sql`
  SELECT COUNT(*)::int AS count
  FROM usuarios
  WHERE perfil = 'superadmin'
    AND mfa_enabled = TRUE
    AND mfa_secret IS NOT NULL
    AND mfa_secret NOT LIKE 'v1$%';
`;

if (Number(remaining[0]?.count || 0) !== 0) {
  throw new Error('Ainda existem segredos MFA legados após a migração.');
}

console.log('Migração MFA concluída: 0 segredos legados restantes.');
