// scripts/apply-migration-036.js — Aplica migration 036 no Neon DB
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const ownerUrl = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL;
if (!ownerUrl) {
  console.error('❌ DATABASE_OWNER_URL ou DATABASE_URL não encontrado.');
  process.exit(1);
}

const sql = neon(ownerUrl);

async function run() {
  console.log('🚀 Aplicando Migration 036 no Neon: Constraint Única Tenant-Scoped para Chave de Acesso NF-e...');

  await sql`
    ALTER TABLE notas_fiscais DROP CONSTRAINT IF EXISTS notas_fiscais_chave_acesso_key;
  `;
  console.log('✅ Constraint global legada notas_fiscais_chave_acesso_key removida');

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_notas_tenant_chave'
      ) THEN
        ALTER TABLE notas_fiscais ADD CONSTRAINT uq_notas_tenant_chave UNIQUE (tenant_id, chave_acesso);
      END IF;
    END $$;
  `;
  console.log('✅ Constraint uq_notas_tenant_chave (tenant_id, chave_acesso) garantida');

  await sql`
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('036_notas_fiscais_tenant_chave_unique.sql', CURRENT_TIMESTAMP, 'patch54_tenant_chave_unique', 0)
    ON CONFLICT (version) DO NOTHING;
  `;
  console.log('✅ Registro gravado em schema_migrations');
}

run().catch(err => {
  console.error('❌ Falha ao aplicar migration 036:', err);
  process.exit(1);
});
