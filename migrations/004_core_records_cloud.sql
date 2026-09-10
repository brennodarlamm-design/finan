-- Patch 05 — Persistência SaaS de Pré-Compras, Contratos e Recibos
-- Não remove dados existentes. Execute uma vez no Neon antes do deploy.

CREATE TABLE IF NOT EXISTS precompras (
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id VARCHAR(64) NOT NULL,
  obra_id VARCHAR(64),
  numero_ordem VARCHAR(100),
  status VARCHAR(80),
  valor_total NUMERIC(15,2) DEFAULT 0,
  data_solicitacao DATE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_precompras_tenant_status ON precompras (tenant_id, status, data_solicitacao DESC);
CREATE INDEX IF NOT EXISTS idx_precompras_tenant_obra ON precompras (tenant_id, obra_id, data_solicitacao DESC);

CREATE TABLE IF NOT EXISTS contratos (
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id VARCHAR(64) NOT NULL,
  obra_id VARCHAR(64),
  numero VARCHAR(100),
  status VARCHAR(80),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_contratos_tenant_status ON contratos (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_tenant_obra ON contratos (tenant_id, obra_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS recibos (
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id VARCHAR(64) NOT NULL,
  obra_id VARCHAR(64),
  numero VARCHAR(100),
  tipo VARCHAR(50),
  valor NUMERIC(15,2) DEFAULT 0,
  data DATE,
  status VARCHAR(80),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_recibos_tenant_data ON recibos (tenant_id, data DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_recibos_tenant_obra ON recibos (tenant_id, obra_id, data DESC);
