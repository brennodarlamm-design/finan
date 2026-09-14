-- migrations/021_client_observability_metadata.sql
-- PATCH 46: Telemetria de Erros no Cliente e Dashboard de Observabilidade
-- Adiciona suporte a metadados estruturados (breadcrumbs, viewport, url) e status de resolução

ALTER TABLE client_error_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE client_error_logs
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open';

CREATE INDEX IF NOT EXISTS idx_client_error_logs_status_created
  ON client_error_logs (status, created_at DESC);

-- Registra a migração em schema_migrations
INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
VALUES (
  '021_client_observability_metadata.sql',
  CURRENT_TIMESTAMP,
  'patch46_client_observability_metadata',
  0
)
ON CONFLICT (version) DO NOTHING;
