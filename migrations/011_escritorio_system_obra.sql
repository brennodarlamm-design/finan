-- FinObra Migration 011: Obra de sistema 'escritorio' e chave composta para integridade relacional multi-tenant
-- Permite que cada tenant possua seu registro de sistema 'escritorio' e valide as constraints fk_lanc_obra_tenant e fk_notas_obra_tenant.

BEGIN;

-- 1. Converte a chave primária de obras para composta (tenant_id, id) se ainda for simples
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'obras'::regclass AND conname = 'obras_pkey' AND contype = 'p'
      AND array_length(conkey, 1) = 1
  ) THEN
    ALTER TABLE obras DROP CONSTRAINT obras_pkey;
    ALTER TABLE obras ADD CONSTRAINT obras_pkey PRIMARY KEY (tenant_id, id);
  END IF;
END $$;

-- 2. Popula a obra de sistema 'escritorio' para todos os tenants existentes
INSERT INTO obras (id, tenant_id, nome, cliente, status)
SELECT 'escritorio', id, 'Sede / Escritório Central', 'Administrativo', 'sistema'
FROM tenants
ON CONFLICT (tenant_id, id) DO NOTHING;

-- 3. Função e Trigger para novos tenants automaticamente receberem a obra 'escritorio'
CREATE OR REPLACE FUNCTION ensure_tenant_system_obras()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO obras (id, tenant_id, nome, cliente, status)
  VALUES ('escritorio', NEW.id, 'Sede / Escritório Central', 'Administrativo', 'sistema')
  ON CONFLICT (tenant_id, id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_system_obras ON tenants;

CREATE TRIGGER trg_tenant_system_obras
AFTER INSERT ON tenants
FOR EACH ROW EXECUTE FUNCTION ensure_tenant_system_obras();

-- 4. Re-validação e auditoria das FKs no tenant_integrity_audit
DO $$
DECLARE
  issues integer;
  is_valid boolean;
BEGIN
  -- fk_notas_obra_tenant
  SELECT COUNT(*) INTO issues FROM notas_fiscais n 
  WHERE n.obra_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM obras o WHERE o.tenant_id = n.tenant_id AND o.id = n.obra_id
  );
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname = 'fk_notas_obra_tenant';
  IF issues = 0 AND is_valid IS NOT NULL AND is_valid = false THEN 
    ALTER TABLE notas_fiscais VALIDATE CONSTRAINT fk_notas_obra_tenant; 
    is_valid := true; 
  END IF;
  INSERT INTO tenant_integrity_audit(constraint_name, table_name, issue_count, validated, notes) 
  VALUES ('fk_notas_obra_tenant', 'notas_fiscais', issues, COALESCE(is_valid, false), 'obra_id sem pai no mesmo tenant (pos-011)');

  -- fk_lanc_obra_tenant
  SELECT COUNT(*) INTO issues FROM lancamentos l 
  WHERE l.obra_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM obras o WHERE o.tenant_id = l.tenant_id AND o.id = l.obra_id
  );
  SELECT convalidated INTO is_valid FROM pg_constraint WHERE conname = 'fk_lanc_obra_tenant';
  IF issues = 0 AND is_valid IS NOT NULL AND is_valid = false THEN 
    ALTER TABLE lancamentos VALIDATE CONSTRAINT fk_lanc_obra_tenant; 
    is_valid := true; 
  END IF;
  INSERT INTO tenant_integrity_audit(constraint_name, table_name, issue_count, validated, notes) 
  VALUES ('fk_lanc_obra_tenant', 'lancamentos', issues, COALESCE(is_valid, false), 'obra_id sem pai no mesmo tenant (pos-011)');
END $$;

COMMIT;
