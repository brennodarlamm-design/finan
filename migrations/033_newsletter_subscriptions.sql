-- migrations/033_newsletter_subscriptions.sql
-- Persistência durável e idempotente do consentimento do Radar FinGo.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  subscribed BOOLEAN NOT NULL DEFAULT TRUE,
  source VARCHAR(50) NOT NULL DEFAULT 'landing',
  subscribed_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_newsletter_subscribers_email UNIQUE (email),
  CONSTRAINT ck_newsletter_subscribers_email_lower CHECK (email = LOWER(email))
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_active
  ON newsletter_subscribers (subscribed, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email
  ON newsletter_subscribers (email);
