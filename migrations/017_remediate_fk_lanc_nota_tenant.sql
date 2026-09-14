-- migrations/017_remediate_fk_lanc_nota_tenant.sql
-- Saneamento de referências órfãs em lancamentos.nota_fiscal_id e validação da constraint fk_lanc_nota_tenant

BEGIN;

-- 1. Desvincular notas fiscais inexistentes em lancamentos (mantendo os dados financeiros intactos)
UPDATE lancamentos
SET nota_fiscal_id = NULL
WHERE nota_fiscal_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notas_fiscais n
    WHERE n.tenant_id = lancamentos.tenant_id AND n.id = lancamentos.nota_fiscal_id
  );

-- 2. Validar formalmente a foreign key no Postgres
ALTER TABLE lancamentos VALIDATE CONSTRAINT fk_lanc_nota_tenant;

-- 3. Atualizar o log oficial de auditoria multi-tenant
INSERT INTO tenant_integrity_audit (constraint_name, table_name, issue_count, validated, notes)
VALUES ('fk_lanc_nota_tenant', 'lancamentos', 0, true, 'Legado inconsistente saneado e constraint validada');

-- 4. Registrar migração no schema_migrations se a tabela existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
    INSERT INTO schema_migrations (version, executed_at, checksum, execution_time_ms)
    VALUES ('017_remediate_fk_lanc_nota_tenant.sql', CURRENT_TIMESTAMP, 'patch40_integrity_remediation', 0)
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;

COMMIT;
