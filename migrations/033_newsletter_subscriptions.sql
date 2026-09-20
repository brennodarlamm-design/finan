-- migrations/033_newsletter_subscriptions.sql
-- Persiste consentimento e descadastro do Radar FinGo.
-- Tabela global administrativa: não contém tenant_id e não é exposta ao runtime tenant.

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  email VARCHAR(254) PRIMARY KEY,
  status VARCHAR(24) NOT NULL DEFAULT 'subscribed'
    CHECK (status IN ('subscribed', 'unsubscribed')),
  source VARCHAR(48) NOT NULL DEFAULT 'landing',
  subscribed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_status_updated
  ON newsletter_subscriptions (status, updated_at DESC);

REVOKE ALL ON TABLE newsletter_subscriptions FROM PUBLIC;
