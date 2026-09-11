-- FinObra Patch 10 — Cookie HttpOnly, CSP e integridade relacional multi-tenant
-- Idempotente. As FKs compostas entram como NOT VALID: passam a proteger todas
-- as novas gravações sem derrubar o deploy caso exista algum legado inconsistente.

BEGIN;

-- 1) Nenhuma tabela operacional deve criar novos registros em um tenant implícito.
ALTER TABLE obras            ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE fornecedores     ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE notas_fiscais    ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE lancamentos      ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE orcamentos       ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE medicoes         ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE documentos       ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE contas_bancarias ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE produtos         ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE ocr_historico    ALTER COLUMN tenant_id DROP DEFAULT;

-- CHECK NOT VALID impede novos NULLs imediatamente e tolera eventual legado antigo.
DO $$
DECLARE
  tbl text;
  cname text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['obras','fornecedores','notas_fiscais','lancamentos','orcamentos','medicoes','documentos','contas_bancarias','produtos','ocr_historico'] LOOP
    cname := 'chk_' || tbl || '_tenant_required';
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=cname) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (tenant_id IS NOT NULL) NOT VALID', tbl, cname);
    END IF;
  END LOOP;
END $$;

-- 2) Chaves candidatas compostas para relacionamentos tenant + id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_obras_tenant_id        ON obras(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fornecedores_tenant_id ON fornecedores(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notas_tenant_id        ON notas_fiscais(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamentos_tenant_id   ON orcamentos(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_medicoes_tenant_id     ON medicoes(tenant_id,id);

-- 3) Integridade composta: um registro de um tenant não pode referenciar pai de outro.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_notas_obra_tenant') THEN
    ALTER TABLE notas_fiscais ADD CONSTRAINT fk_notas_obra_tenant
      FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id,id)
      ON DELETE SET NULL (obra_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_lanc_fornecedor_tenant') THEN
    ALTER TABLE lancamentos ADD CONSTRAINT fk_lanc_fornecedor_tenant
      FOREIGN KEY (tenant_id, fornecedor_id) REFERENCES fornecedores(tenant_id,id)
      ON DELETE SET NULL (fornecedor_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_lanc_obra_tenant') THEN
    ALTER TABLE lancamentos ADD CONSTRAINT fk_lanc_obra_tenant
      FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id,id)
      ON DELETE SET NULL (obra_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_lanc_nota_tenant') THEN
    ALTER TABLE lancamentos ADD CONSTRAINT fk_lanc_nota_tenant
      FOREIGN KEY (tenant_id, nota_fiscal_id) REFERENCES notas_fiscais(tenant_id,id)
      ON DELETE SET NULL (nota_fiscal_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_orcamentos_obra_tenant') THEN
    ALTER TABLE orcamentos ADD CONSTRAINT fk_orcamentos_obra_tenant
      FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id,id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_medicoes_obra_tenant') THEN
    ALTER TABLE medicoes ADD CONSTRAINT fk_medicoes_obra_tenant
      FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id,id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- Índices úteis aos FKs e rotinas de auditoria/limpeza.
CREATE INDEX IF NOT EXISTS idx_notas_tenant_obra ON notas_fiscais(tenant_id,obra_id);
CREATE INDEX IF NOT EXISTS idx_lanc_tenant_fornecedor ON lancamentos(tenant_id,fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_lanc_tenant_nota ON lancamentos(tenant_id,nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_tenant_obra ON orcamentos(tenant_id,obra_id);
CREATE INDEX IF NOT EXISTS idx_medicoes_tenant_obra ON medicoes(tenant_id,obra_id);

COMMIT;
