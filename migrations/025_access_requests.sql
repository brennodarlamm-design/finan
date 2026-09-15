-- migrations/025_access_requests.sql
-- Armazena solicitações comerciais de acesso após fechamento do cadastro público (P50)

CREATE TABLE IF NOT EXISTS access_requests (
  id VARCHAR(64) PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefone VARCHAR(64),
  empresa_nome VARCHAR(255),
  cnpj VARCHAR(32),
  mensagem TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'pendente',
  ip VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_access_requests_created_at
  ON access_requests (created_at DESC);
