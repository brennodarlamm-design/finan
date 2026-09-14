-- migrations/022_master_mfa_totp.sql
-- PATCH 49: Segurança Reforçada do Master Backoffice e MFA via Google Authenticator (TOTP)
-- Adiciona suporte a autenticação em duas etapas (RFC 6238 TOTP), códigos de emergência e proteção contra replay

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(128);

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB DEFAULT '[]'::jsonb;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS mfa_last_used_step BIGINT DEFAULT 0;

-- Registra a migração em schema_migrations
INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
VALUES (
  '022_master_mfa_totp.sql',
  CURRENT_TIMESTAMP,
  'patch49_master_mfa_totp',
  0
)
ON CONFLICT (version) DO NOTHING;
