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
  console.log('Aplicando Migration 025: Criando tabela access_requests...');

  await sql`
    CREATE TABLE IF NOT EXISTS access_requests (
      id VARCHAR(64) PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      telefone VARCHAR(64),
      empresa_nome VARCHAR(255),
      cnpj VARCHAR(32),
      mensagem TEXT,
      status VARCHAR(24) NOT NULL DEFAULT 'pendente',
      ip VARCHAR(64),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_access_requests_created_at
      ON access_requests (created_at DESC);
  `;

  await sql`
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('025_access_requests.sql', CURRENT_TIMESTAMP, 'patch50_access_requests', 0)
    ON CONFLICT (version) DO NOTHING;
  `;

  console.log('Migration 025 aplicada com sucesso!');
}

run().catch(err => {
  console.error('Erro na migracao 025:', err);
  process.exit(1);
});
