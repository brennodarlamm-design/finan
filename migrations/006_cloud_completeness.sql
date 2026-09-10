-- FinObra Patch 07 — completar persistência SaaS e isolamento por tenant
-- Idempotente: pode ser executada mais de uma vez com segurança.

BEGIN;

-- Garante chave candidata para relações compostas tenant + obra.
CREATE UNIQUE INDEX IF NOT EXISTS uq_obras_tenant_id ON obras (tenant_id, id);

-- Orçamentos SINAPI: antes ficavam apenas no navegador.
CREATE TABLE IF NOT EXISTS orcamentos_sinapi (
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id VARCHAR(80) NOT NULL,
  obra_id VARCHAR(64),
  nome VARCHAR(255),
  status VARCHAR(80),
  valor_total NUMERIC(15,2) DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT fk_orcamentos_sinapi_obra_tenant
    FOREIGN KEY (tenant_id, obra_id) REFERENCES obras (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_orcamentos_sinapi_tenant_obra
  ON orcamentos_sinapi (tenant_id, obra_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orcamentos_sinapi_tenant_status
  ON orcamentos_sinapi (tenant_id, status, updated_at DESC);

-- Checklist/fases documentais de cada obra: antes ficavam apenas no navegador.
CREATE TABLE IF NOT EXISTS obra_doc_fases (
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id VARCHAR(180) NOT NULL,
  obra_id VARCHAR(64) NOT NULL,
  doc_id VARCHAR(100) NOT NULL,
  fase_key VARCHAR(80),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT fk_obra_doc_fases_obra_tenant
    FOREIGN KEY (tenant_id, obra_id) REFERENCES obras (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_obra_doc_fases_tenant_obra
  ON obra_doc_fases (tenant_id, obra_id, updated_at DESC);

-- Se as tabelas já existiam por uma execução parcial, adiciona as FKs compostas sem duplicar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orcamentos_sinapi_obra_tenant') THEN
    ALTER TABLE orcamentos_sinapi
      ADD CONSTRAINT fk_orcamentos_sinapi_obra_tenant
      FOREIGN KEY (tenant_id, obra_id) REFERENCES obras (tenant_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_obra_doc_fases_obra_tenant') THEN
    ALTER TABLE obra_doc_fases
      ADD CONSTRAINT fk_obra_doc_fases_obra_tenant
      FOREIGN KEY (tenant_id, obra_id) REFERENCES obras (tenant_id, id) ON DELETE CASCADE;
  END IF;
END $$;

-- Preferências compartilhadas do tenant (categorias personalizadas, modo/telefone WhatsApp etc.).
CREATE TABLE IF NOT EXISTS tenant_preferences (
  tenant_id VARCHAR(64) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
