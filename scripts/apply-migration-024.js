import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_URL não configurada em .env.local');
  process.exit(1);
}

const sql = neon(conn);

async function run() {
  console.log('Aplicando Migration 024: Adicionando colunas de Chave de Acesso em tenants...');

  await sql`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS access_key_hash       TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS access_key_last4      CHAR(4),
      ADD COLUMN IF NOT EXISTS access_key_created_at TIMESTAMPTZ;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_tenants_access_key_hash
      ON tenants (access_key_hash);
  `;

  await sql`
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('024_tenant_access_key.sql', CURRENT_TIMESTAMP, 'patch50_tenant_access_key', 0)
    ON CONFLICT (version) DO NOTHING;
  `;

  console.log('Migration 024 aplicada com sucesso!');
}

run().catch(err => {
  console.error('Erro na migracao 024:', err);
  process.exit(1);
});
