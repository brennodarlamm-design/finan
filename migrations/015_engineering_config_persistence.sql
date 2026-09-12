-- ============================================================================
-- MIGRATION 015: Persistencia de configuracoes de Engenharia por Obra
-- Data: 2026-09-12
-- ============================================================================

ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS cronograma_config JSONB,
  ADD COLUMN IF NOT EXISTS bdi_config JSONB;

COMMENT ON COLUMN obras.cronograma_config IS
  'Configuracao personalizada do cronograma fisico-financeiro da obra.';
COMMENT ON COLUMN obras.bdi_config IS
  'Configuracao personalizada de BDI da obra.';
