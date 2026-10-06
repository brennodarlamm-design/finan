-- migrations/041_newsletter_double_opt_in.sql
-- AUDITORIA 2026-10-04 #32: inscrição na newsletter só vale após o dono do e-mail confirmar
-- (status 'pending' até o clique no link assinado). Idempotente.

ALTER TABLE newsletter_subscriptions DROP CONSTRAINT IF EXISTS newsletter_subscriptions_status_check;
ALTER TABLE newsletter_subscriptions
  ADD CONSTRAINT newsletter_subscriptions_status_check
  CHECK (status IN ('pending', 'subscribed', 'unsubscribed'));

ALTER TABLE newsletter_subscriptions ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;
ALTER TABLE newsletter_subscriptions ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
