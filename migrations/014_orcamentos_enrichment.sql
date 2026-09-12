-- ============================================================================
-- MIGRATION 014: Enriquecimento da Tabela de Orçamentos e Índices de Performance
-- Data: 2026-09-11
-- ============================================================================

-- 1. ADICIONAR CAMPOS DE GOVERNANÇA E STATUS NA TABELA orcamentos
ALTER TABLE orcamentos 
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS data_criacao DATE DEFAULT CURRENT_DATE;

-- 2. ÍNDICES DE BUSCA E PERFORMANCE POR TENANT E STATUS
CREATE INDEX IF NOT EXISTS idx_orcamentos_tenant_status 
  ON orcamentos (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_orcamentos_tenant_obra_status 
  ON orcamentos (tenant_id, obra_id, status);

-- 3. REGISTRAR MIGRAÇÃO NA TABELA schema_migrations
INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
VALUES ('014_orcamentos_enrichment.sql', CURRENT_TIMESTAMP, 'orcamentos_v2', 0)
ON CONFLICT (version) DO NOTHING;
