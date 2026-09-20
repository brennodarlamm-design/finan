-- FinGo — idempotência forte para criação de cobrança PIX pendente.
-- Impede faturas duplicadas quando o usuário clica duas vezes ou duas requisições
-- create_invoice chegam simultaneamente.

UPDATE billing_invoices
SET cycle = 'monthly'
WHERE cycle IS NULL;

ALTER TABLE billing_invoices
  ALTER COLUMN cycle SET DEFAULT 'monthly',
  ALTER COLUMN cycle SET NOT NULL;

WITH ranked_pending AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tenant_id, plan_id, cycle
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM billing_invoices
  WHERE status = 'pending'
)
UPDATE billing_invoices b
SET status = 'expired',
    updated_at = NOW()
FROM ranked_pending r
WHERE b.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_pending_tenant_plan_cycle
  ON billing_invoices (tenant_id, plan_id, cycle)
  WHERE status = 'pending';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('034_billing_pending_invoice_idempotency.sql', CURRENT_TIMESTAMP, 'billing_pending_invoice_idempotency_v1', 0)
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
