-- FinObra Patch 08 — governança, sessões, permissões por módulo e observabilidade
-- Idempotente: pode ser executada mais de uma vez.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS permissoes JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(80) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_name VARCHAR(160),
  user_agent TEXT,
  ip VARCHAR(80),
  remember BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active ON auth_sessions (user_id, revoked_at, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_tenant_created ON auth_sessions (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS client_error_logs (
  id VARCHAR(80) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64) REFERENCES usuarios(id) ON DELETE SET NULL,
  route VARCHAR(100),
  message TEXT NOT NULL,
  source TEXT,
  line_no INTEGER,
  col_no INTEGER,
  stack TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_client_errors_tenant_created ON client_error_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_errors_user_created ON client_error_logs (user_id, created_at DESC);
