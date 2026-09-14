import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('🚀 Aplicando Migration 020 no Neon: Webhook de Pagamento PIX e Baixa Automática SaaS...');
  
  // 1. Ampliar txid para VARCHAR(128)
  await sql`
    ALTER TABLE billing_invoices ALTER COLUMN txid TYPE VARCHAR(128);
  `;
  console.log('✅ billing_invoices.txid ampliado para VARCHAR(128)');

  // 2. Adicionar gateway e webhook_payload
  await sql`
    ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS gateway VARCHAR(32) DEFAULT 'pix_manual';
  `;
  await sql`
    ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS webhook_payload JSONB DEFAULT '{}'::jsonb;
  `;
  console.log('✅ Colunas gateway e webhook_payload adicionadas em billing_invoices');

  // 3. Índice em txid e status
  await sql`
    CREATE INDEX IF NOT EXISTS idx_billing_invoices_txid_status ON billing_invoices (txid, status);
  `;
  console.log('✅ Índice idx_billing_invoices_txid_status criado');

  // 4. Registro no schema_migrations
  await sql`
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('020_webhook_pix_integration.sql', CURRENT_TIMESTAMP, 'patch44_webhook_pix_integration', 0)
    ON CONFLICT (version) DO NOTHING;
  `;
  console.log('✅ Registro gravado em schema_migrations');

  const cols = await sql`
    SELECT column_name, data_type, character_maximum_length 
    FROM information_schema.columns 
    WHERE table_name = 'billing_invoices'
    ORDER BY ordinal_position;
  `;
  console.log('Estrutura atual de billing_invoices:');
  console.table(cols);
}

run().catch(err => {
  console.error('❌ Falha na migration 020:', err);
  process.exit(1);
});
