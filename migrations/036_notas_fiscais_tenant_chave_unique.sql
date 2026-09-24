-- migrations/036_notas_fiscais_tenant_chave_unique.sql
-- Escopo multi-tenant estrito para chaves de acesso NF-e na tabela notas_fiscais
-- Substitui constraint global UNIQUE (chave_acesso) por UNIQUE (tenant_id, chave_acesso)

BEGIN;

-- 1. Remover constraint global legada se ainda existir
ALTER TABLE notas_fiscais DROP CONSTRAINT IF EXISTS notas_fiscais_chave_acesso_key;

-- 2. Garantir constraint única no escopo de cada tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_notas_tenant_chave'
  ) THEN
    ALTER TABLE notas_fiscais ADD CONSTRAINT uq_notas_tenant_chave UNIQUE (tenant_id, chave_acesso);
  END IF;
END $$;

-- 3. Registrar migração no schema_migrations se a tabela existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('036_notas_fiscais_tenant_chave_unique.sql', CURRENT_TIMESTAMP, 'patch54_tenant_chave_unique', 0)
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;

COMMIT;
