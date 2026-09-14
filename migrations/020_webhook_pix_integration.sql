-- Migração 020: Webhook de Pagamento PIX e Baixa Automática SaaS
-- Build 2026.09.14-p44

-- 1. Ampliar tamanho do TXID para suportar identificadores de múltiplos gateways (Asaas, OpenPix, Efí, Mercado Pago)
ALTER TABLE billing_invoices ALTER COLUMN txid TYPE VARCHAR(128);

-- 2. Colunas de rastreabilidade de gateway e payload do webhook
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS gateway VARCHAR(32) DEFAULT 'pix_manual';
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS webhook_payload JSONB DEFAULT '{}'::jsonb;

-- 3. Índices complementares de busca rápida por txid e id
CREATE INDEX IF NOT EXISTS idx_billing_invoices_txid_status ON billing_invoices (txid, status);

-- 4. Registro no histórico de migrações
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('020_webhook_pix_integration.sql', CURRENT_TIMESTAMP, 'patch44_webhook_pix_integration', 0)
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
