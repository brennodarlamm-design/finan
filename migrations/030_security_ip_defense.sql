-- migrations/030_security_ip_defense.sql
-- PATCH 56: Rate limit distribuído + Fail2Ban lógico por IP para ambiente serverless.
-- Não armazena IP puro: usa HMAC-SHA256(ip, IP_BAN_PEPPER).

CREATE TABLE IF NOT EXISTS security_ip_state (
  ip_hash VARCHAR(64) PRIMARY KEY,
  failure_score INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  first_failure_at TIMESTAMPTZ NULL,
  last_failure_at TIMESTAMPTZ NULL,
  last_reason VARCHAR(80) NULL,
  last_source VARCHAR(80) NULL,
  blocked_until TIMESTAMPTZ NULL,
  permanent BOOLEAN NOT NULL DEFAULT FALSE,
  ban_level INTEGER NOT NULL DEFAULT 0,
  ban_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_ip_state_blocked_until
  ON security_ip_state (blocked_until)
  WHERE blocked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_security_ip_state_last_failure
  ON security_ip_state (last_failure_at DESC);

CREATE TABLE IF NOT EXISTS security_ip_events (
  id BIGSERIAL PRIMARY KEY,
  ip_hash VARCHAR(64) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  reason VARCHAR(80) NULL,
  source VARCHAR(80) NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_ip_events_ip_created
  ON security_ip_events (ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_ip_events_created
  ON security_ip_events (created_at DESC);

CREATE TABLE IF NOT EXISTS security_ip_allowlist (
  ip_hash VARCHAR(64) PRIMARY KEY,
  label VARCHAR(160) NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(160) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Higiene: eventos de segurança são operacionais; retenção longa deve ir para SIEM/log externo.
-- A limpeza é feita por job e não por trigger síncrona.

INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
VALUES (
  '030_security_ip_defense.sql',
  CURRENT_TIMESTAMP,
  'patch56_security_ip_failban_v1',
  0
)
ON CONFLICT (version) DO NOTHING;
