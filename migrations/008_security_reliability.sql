-- FinObra Patch 09 — Segurança e Confiabilidade
-- Pode ser executado mais de uma vez com segurança.

CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key VARCHAR(64) PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires_at
  ON api_rate_limits (expires_at);

-- Limpeza imediata de buckets antigos em instalações que já tenham usado a tabela.
DELETE FROM api_rate_limits WHERE expires_at < NOW() - INTERVAL '1 day';
