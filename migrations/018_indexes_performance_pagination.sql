-- migrations/018_indexes_performance_pagination.sql
-- Índices B-Tree compostos de alta performance para ordenação temporal e filtros multi-tenant no Neon PostgreSQL

BEGIN;

-- 1. Tabela lancamentos: otimizar ordenações por data DESC, created_at DESC e filtros combinados com obra_id e tipo
CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant_data_desc
  ON lancamentos (tenant_id, data DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant_obra_data_desc
  ON lancamentos (tenant_id, obra_id, data DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant_tipo_data
  ON lancamentos (tenant_id, tipo, data DESC);

-- 2. Tabela notas_fiscais: otimizar ordenação por emissão DESC e busca por obra
CREATE INDEX IF NOT EXISTS idx_notas_tenant_emissao_desc
  ON notas_fiscais (tenant_id, data_emissao DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_notas_tenant_obra_emissao
  ON notas_fiscais (tenant_id, obra_id, data_emissao DESC);

-- 3. Tabela documentos: ordenação por created_at DESC e buscas por tipo/referência
CREATE INDEX IF NOT EXISTS idx_documentos_tenant_created_desc
  ON documentos (tenant_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_documentos_tenant_tipo_ref
  ON documentos (tenant_id, tipo, referencia_id);

-- 4. Tabelas de Auditoria e Telemetria: ordenação temporal decrescente
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_error_logs_tenant_created
  ON client_error_logs (tenant_id, created_at DESC);

-- 5. Tabela tenants: otimização de status e vencimento para régua de cobrança SaaS
CREATE INDEX IF NOT EXISTS idx_tenants_status_vencimento
  ON tenants (status, vencimento);

-- 6. Registro formal no controle de migrações
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('018_indexes_performance_pagination.sql', CURRENT_TIMESTAMP, 'patch41_indexes_performance', 0)
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;

COMMIT;
