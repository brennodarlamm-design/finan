-- migrations/024_tenant_access_key.sql
-- Adiciona suporte a Chave de Acesso da Empresa (P50 Company Access Key)
-- Armazena apenas o hash criptográfico SHA-256 e os últimos 4 caracteres para exibição

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS access_key_hash       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS access_key_last4      CHAR(4),
  ADD COLUMN IF NOT EXISTS access_key_created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_access_key_hash
  ON tenants (access_key_hash);
