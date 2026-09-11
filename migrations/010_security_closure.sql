-- FinObra Patch 11 — auditoria/validação de integridade multi-tenant e fechamento de legado
-- Idempotente. Não apaga nem move registros históricos automaticamente.

BEGIN;

CREATE TABLE IF NOT EXISTS tenant_integrity_audit (
  id BIGSERIAL PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  constraint_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  issue_count INTEGER NOT NULL DEFAULT 0,
  validated BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_tenant_integrity_audit_checked ON tenant_integrity_audit(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_integrity_audit_constraint ON tenant_integrity_audit(constraint_name, checked_at DESC);

-- Mantém somente histórico recente para não crescer indefinidamente.
DELETE FROM tenant_integrity_audit WHERE checked_at < NOW() - INTERVAL '180 days';

DO $$
DECLARE
  issues integer;
  is_valid boolean;
BEGIN
  -- CHECKs tenant_id obrigatório
  SELECT COUNT(*) INTO issues FROM obras WHERE tenant_id IS NULL;
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='chk_obras_tenant_required';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE obras VALIDATE CONSTRAINT chk_obras_tenant_required; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('chk_obras_tenant_required','obras',issues,COALESCE(is_valid,false),'tenant_id nulo');

  SELECT COUNT(*) INTO issues FROM fornecedores WHERE tenant_id IS NULL;
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='chk_fornecedores_tenant_required';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE fornecedores VALIDATE CONSTRAINT chk_fornecedores_tenant_required; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('chk_fornecedores_tenant_required','fornecedores',issues,COALESCE(is_valid,false),'tenant_id nulo');

  SELECT COUNT(*) INTO issues FROM notas_fiscais WHERE tenant_id IS NULL;
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='chk_notas_fiscais_tenant_required';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE notas_fiscais VALIDATE CONSTRAINT chk_notas_fiscais_tenant_required; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('chk_notas_fiscais_tenant_required','notas_fiscais',issues,COALESCE(is_valid,false),'tenant_id nulo');

  SELECT COUNT(*) INTO issues FROM lancamentos WHERE tenant_id IS NULL;
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='chk_lancamentos_tenant_required';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE lancamentos VALIDATE CONSTRAINT chk_lancamentos_tenant_required; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('chk_lancamentos_tenant_required','lancamentos',issues,COALESCE(is_valid,false),'tenant_id nulo');

  SELECT COUNT(*) INTO issues FROM orcamentos WHERE tenant_id IS NULL;
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='chk_orcamentos_tenant_required';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE orcamentos VALIDATE CONSTRAINT chk_orcamentos_tenant_required; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('chk_orcamentos_tenant_required','orcamentos',issues,COALESCE(is_valid,false),'tenant_id nulo');

  SELECT COUNT(*) INTO issues FROM medicoes WHERE tenant_id IS NULL;
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='chk_medicoes_tenant_required';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE medicoes VALIDATE CONSTRAINT chk_medicoes_tenant_required; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('chk_medicoes_tenant_required','medicoes',issues,COALESCE(is_valid,false),'tenant_id nulo');

  SELECT COUNT(*) INTO issues FROM documentos WHERE tenant_id IS NULL;
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='chk_documentos_tenant_required';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE documentos VALIDATE CONSTRAINT chk_documentos_tenant_required; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('chk_documentos_tenant_required','documentos',issues,COALESCE(is_valid,false),'tenant_id nulo');

  SELECT COUNT(*) INTO issues FROM contas_bancarias WHERE tenant_id IS NULL;
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='chk_contas_bancarias_tenant_required';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE contas_bancarias VALIDATE CONSTRAINT chk_contas_bancarias_tenant_required; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('chk_contas_bancarias_tenant_required','contas_bancarias',issues,COALESCE(is_valid,false),'tenant_id nulo');

  SELECT COUNT(*) INTO issues FROM produtos WHERE tenant_id IS NULL;
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='chk_produtos_tenant_required';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE produtos VALIDATE CONSTRAINT chk_produtos_tenant_required; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('chk_produtos_tenant_required','produtos',issues,COALESCE(is_valid,false),'tenant_id nulo');

  SELECT COUNT(*) INTO issues FROM ocr_historico WHERE tenant_id IS NULL;
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='chk_ocr_historico_tenant_required';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE ocr_historico VALIDATE CONSTRAINT chk_ocr_historico_tenant_required; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('chk_ocr_historico_tenant_required','ocr_historico',issues,COALESCE(is_valid,false),'tenant_id nulo');

  -- FKs compostas: conta somente referências que apontam para outro tenant ou pai inexistente.
  SELECT COUNT(*) INTO issues FROM notas_fiscais n WHERE n.obra_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM obras o WHERE o.tenant_id=n.tenant_id AND o.id=n.obra_id);
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='fk_notas_obra_tenant';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE notas_fiscais VALIDATE CONSTRAINT fk_notas_obra_tenant; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('fk_notas_obra_tenant','notas_fiscais',issues,COALESCE(is_valid,false),'obra_id sem pai no mesmo tenant');

  SELECT COUNT(*) INTO issues FROM lancamentos l WHERE l.fornecedor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM fornecedores f WHERE f.tenant_id=l.tenant_id AND f.id=l.fornecedor_id);
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='fk_lanc_fornecedor_tenant';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE lancamentos VALIDATE CONSTRAINT fk_lanc_fornecedor_tenant; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('fk_lanc_fornecedor_tenant','lancamentos',issues,COALESCE(is_valid,false),'fornecedor_id sem pai no mesmo tenant');

  SELECT COUNT(*) INTO issues FROM lancamentos l WHERE l.obra_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM obras o WHERE o.tenant_id=l.tenant_id AND o.id=l.obra_id);
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='fk_lanc_obra_tenant';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE lancamentos VALIDATE CONSTRAINT fk_lanc_obra_tenant; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('fk_lanc_obra_tenant','lancamentos',issues,COALESCE(is_valid,false),'obra_id sem pai no mesmo tenant');

  SELECT COUNT(*) INTO issues FROM lancamentos l WHERE l.nota_fiscal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM notas_fiscais n WHERE n.tenant_id=l.tenant_id AND n.id=l.nota_fiscal_id);
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='fk_lanc_nota_tenant';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE lancamentos VALIDATE CONSTRAINT fk_lanc_nota_tenant; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('fk_lanc_nota_tenant','lancamentos',issues,COALESCE(is_valid,false),'nota_fiscal_id sem pai no mesmo tenant');

  SELECT COUNT(*) INTO issues FROM orcamentos x WHERE x.obra_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM obras o WHERE o.tenant_id=x.tenant_id AND o.id=x.obra_id);
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='fk_orcamentos_obra_tenant';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE orcamentos VALIDATE CONSTRAINT fk_orcamentos_obra_tenant; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('fk_orcamentos_obra_tenant','orcamentos',issues,COALESCE(is_valid,false),'obra_id sem pai no mesmo tenant');

  SELECT COUNT(*) INTO issues FROM medicoes x WHERE x.obra_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM obras o WHERE o.tenant_id=x.tenant_id AND o.id=x.obra_id);
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname='fk_medicoes_obra_tenant';
  IF issues=0 AND is_valid IS NOT NULL AND is_valid=false THEN ALTER TABLE medicoes VALIDATE CONSTRAINT fk_medicoes_obra_tenant; is_valid:=true; END IF;
  INSERT INTO tenant_integrity_audit(constraint_name,table_name,issue_count,validated,notes) VALUES ('fk_medicoes_obra_tenant','medicoes',issues,COALESCE(is_valid,false),'obra_id sem pai no mesmo tenant');
END $$;

COMMIT;
