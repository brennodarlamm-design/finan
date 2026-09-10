-- FinObra Patch 06 Revisado — cobrança + Central de Atendimento DEV
-- Idempotente: pode ser executada mais de uma vez com segurança.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS vencimento DATE;

CREATE TABLE IF NOT EXISTS billing_invoices (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  plan_id VARCHAR(32) NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  txid VARCHAR(35) NOT NULL,
  pix_payload TEXT,
  created_by VARCHAR(64),
  paid_by VARCHAR(64),
  paid_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_invoices_txid
  ON billing_invoices (txid);
CREATE INDEX IF NOT EXISTS idx_billing_tenant_status_created
  ON billing_invoices (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_status_created
  ON billing_invoices (status, created_at DESC);

-- Conversas de suporte. O cliente vê somente as próprias conversas;
-- o Super Admin/DEV usa /api/admin para operar a fila global.
CREATE TABLE IF NOT EXISTS support_conversations (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL DEFAULT 'bot',
  assigned_to VARCHAR(64),
  human_requested_at TIMESTAMP WITH TIME ZONE,
  notified_at TIMESTAMP WITH TIME ZONE,
  assigned_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_messages (
  id VARCHAR(64) PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_type VARCHAR(24) NOT NULL,
  sender_user_id VARCHAR(64),
  sender_name VARCHAR(255),
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_conversations_queue
  ON support_conversations (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_conversations_tenant_user
  ON support_conversations (tenant_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_conversation
  ON support_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_support_messages_tenant
  ON support_messages (tenant_id, created_at DESC);
