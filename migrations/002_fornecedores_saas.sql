-- FINOBRA PATCH 02 — Persistência completa de fornecedores no SaaS
BEGIN;

ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS municipio VARCHAR(120);
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS uf VARCHAR(2);
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_fornecedores_tenant_uf ON fornecedores(tenant_id, uf);
CREATE INDEX IF NOT EXISTS idx_fornecedores_tenant_ativo ON fornecedores(tenant_id, ativo);

COMMIT;
