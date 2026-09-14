-- Migração 019: Automação de Cobrança SaaS, Idempotência Diária e Rastreamento Anti-Spam
-- Build 2026.09.14-p42

CREATE TABLE IF NOT EXISTS billing_notifications_sent (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL, -- 'reminder_10d', 'reminder_3d', 'due_today', 'overdue_1d', 'overdue_5d', 'trial_ending'
  channel VARCHAR(20) NOT NULL, -- 'whatsapp', 'email', 'both'
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recipient_phone VARCHAR(50),
  recipient_email VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_billing_notice_day UNIQUE (tenant_id, stage, sent_date)
);

CREATE INDEX IF NOT EXISTS idx_billing_notif_tenant_date ON billing_notifications_sent (tenant_id, sent_date);
CREATE INDEX IF NOT EXISTS idx_billing_notif_stage_date ON billing_notifications_sent (stage, sent_date);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('019_billing_automation_idempotency.sql', CURRENT_TIMESTAMP, 'patch42_billing_idempotency', 0)
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
