-- migrations/037_email_hub_central.sql
-- Central de E-mails FinGo: Histórico Unificado de Envios (Outbound) e Recebimento (Inbound)
-- Suporta multicanal: contato@fingo.api.br (principal), suporte@fingo.api.br, comercial@fingo.api.br, no-reply@fingo.api.br, novidades@fingo.api.br

BEGIN;

CREATE TABLE IF NOT EXISTS email_messages (
    id VARCHAR(80) PRIMARY KEY,
    tenant_id VARCHAR(80),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('outbound', 'inbound')),
    channel VARCHAR(100) NOT NULL DEFAULT 'contato@fingo.api.br',
    sender VARCHAR(255) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    reply_to VARCHAR(255) DEFAULT 'contato@fingo.api.br',
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'sent',
    provider_id VARCHAR(100),
    message_id VARCHAR(255),
    in_reply_to VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_messages_created ON email_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON email_messages (direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_channel ON email_messages (channel);
CREATE INDEX IF NOT EXISTS idx_email_messages_recipient ON email_messages (recipient);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender ON email_messages (sender);
CREATE INDEX IF NOT EXISTS idx_email_messages_tenant ON email_messages (tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_in_reply ON email_messages (in_reply_to) WHERE in_reply_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_messages_unread ON email_messages (is_read) WHERE is_read = FALSE;

-- Registrar migração no schema_migrations se a tabela existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('037_email_hub_central.sql', CURRENT_TIMESTAMP, 'patch55_email_hub_central', 0)
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;

COMMIT;
