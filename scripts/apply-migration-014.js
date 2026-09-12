import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('Aplicando Migration 014 em orcamentos...');
  
  await sql`
    ALTER TABLE orcamentos 
      ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ativo',
      ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS data_criacao DATE DEFAULT CURRENT_DATE;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_orcamentos_tenant_status 
      ON orcamentos (tenant_id, status);
  `;

  await sql`
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('014_orcamentos_enrichment.sql', CURRENT_TIMESTAMP, 'orcamentos_v2', 0)
    ON CONFLICT (version) DO NOTHING;
  `;

  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'orcamentos'
    ORDER BY ordinal_position;
  `;

  console.log('Colunas de orcamentos atualizadas:');
  console.table(cols);
}

run().catch(console.error);
