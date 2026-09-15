-- Migration 027: cofre criptografado das Chaves da Empresa para DEV / Master
-- A chave completa nunca deve existir em código frontend ou localStorage.
-- O conteúdo é cifrado em aplicação com AES-256-GCM antes de chegar ao banco.

CREATE TABLE IF NOT EXISTS dev_tenant_keys (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  key_ciphertext TEXT NOT NULL,
  key_iv TEXT NOT NULL,
  key_auth_tag TEXT NOT NULL,
  encryption_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dev_tenant_keys IS 'Cofre server-side das Chaves da Empresa para acesso exclusivo do DEV/Master com MFA.';
COMMENT ON COLUMN dev_tenant_keys.key_ciphertext IS 'Chave cifrada em AES-256-GCM no backend. Nunca armazenar plaintext.';

REVOKE ALL ON TABLE dev_tenant_keys FROM PUBLIC;
