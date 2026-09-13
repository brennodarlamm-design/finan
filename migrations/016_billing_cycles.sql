-- Migração 016: Adicionar coluna cycle na tabela billing_invoices
-- Idempotente: pode ser executada com segurança em qualquer ambiente.

ALTER TABLE billing_invoices
  ADD COLUMN IF NOT EXISTS cycle VARCHAR(24) DEFAULT 'monthly';

CREATE INDEX IF NOT EXISTS idx_billing_cycle
  ON billing_invoices (cycle);
