import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('🚀 Aplicando Migration 022 no Neon: Master Multi-Factor Authentication (TOTP / Google Authenticator)...');

  // 1. Coluna mfa_secret
  await sql`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(128);
  `;
  console.log('✅ Coluna mfa_secret VARCHAR(128) adicionada em usuarios');

  // 2. Coluna mfa_enabled
  await sql`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
  `;
  console.log('✅ Coluna mfa_enabled BOOLEAN adicionada em usuarios');

  // 3. Coluna mfa_backup_codes
  await sql`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB DEFAULT '[]'::jsonb;
  `;
  console.log('✅ Coluna mfa_backup_codes JSONB adicionada em usuarios');

  // 4. Coluna mfa_last_used_step
  await sql`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_last_used_step BIGINT DEFAULT 0;
  `;
  console.log('✅ Coluna mfa_last_used_step BIGINT adicionada em usuarios');

  // 5. Registro no schema_migrations
  await sql`
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('022_master_mfa_totp.sql', CURRENT_TIMESTAMP, 'patch49_master_mfa_totp', 0)
    ON CONFLICT (version) DO NOTHING;
  `;
  console.log('✅ Registro gravado em schema_migrations');

  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'usuarios' AND column_name LIKE 'mfa_%'
    ORDER BY ordinal_position;
  `;
  console.log('Colunas MFA ativas na tabela usuarios:');
  console.table(cols);
}

run().catch(err => {
  console.error('❌ Erro na migração 022:', err);
  process.exit(1);
});
