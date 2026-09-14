import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('🚀 Aplicando Migration 021 no Neon: Telemetria de Erros no Cliente e Observabilidade...');

  // 1. Adicionar metadata JSONB
  await sql`
    ALTER TABLE client_error_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
  `;
  console.log('✅ Coluna metadata JSONB adicionada em client_error_logs');

  // 2. Adicionar status VARCHAR(20)
  await sql`
    ALTER TABLE client_error_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open';
  `;
  console.log('✅ Coluna status adicionada em client_error_logs');

  // 3. Índice por status e created_at
  await sql`
    CREATE INDEX IF NOT EXISTS idx_client_error_logs_status_created ON client_error_logs (status, created_at DESC);
  `;
  console.log('✅ Índice idx_client_error_logs_status_created criado com sucesso');

  // 4. Registro no schema_migrations
  await sql`
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('021_client_observability_metadata.sql', CURRENT_TIMESTAMP, 'patch46_client_observability_metadata', 0)
    ON CONFLICT (version) DO NOTHING;
  `;
  console.log('✅ Registro gravado em schema_migrations');

  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'client_error_logs'
    ORDER BY ordinal_position;
  `;
  console.log('Estrutura atual de client_error_logs:');
  console.table(cols);
}

run().catch(err => {
  console.error('❌ Erro na migração 021:', err);
  process.exit(1);
});
