-- migrations/039_ofx_transacoes_importadas.sql
-- VARREDURA 2026-10-03 #8: registro das transações de extrato OFX já importadas (FITID por conta).
-- Antes a proteção contra reimportar o mesmo extrato valia só no aparelho que importou: em outro
-- celular/computador o mesmo extrato entrava de novo e podia conciliar/baixar contas em dobro.

BEGIN;

CREATE TABLE IF NOT EXISTS ofx_transacoes_importadas (
    tenant_id VARCHAR(80) NOT NULL,
    conta_chave VARCHAR(120) NOT NULL,   -- banco + agência/conta normalizados pelo app (OFX._chaveConta)
    fitid VARCHAR(255) NOT NULL,          -- identificador único da transação no extrato
    import_id VARCHAR(120),
    imported_by VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, conta_chave, fitid)
);

CREATE INDEX IF NOT EXISTS idx_ofx_importadas_tenant_import ON ofx_transacoes_importadas (tenant_id, import_id);

ALTER TABLE ofx_transacoes_importadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ofx_transacoes_importadas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ofx_transacoes_importadas ON ofx_transacoes_importadas;
CREATE POLICY tenant_isolation_ofx_transacoes_importadas ON ofx_transacoes_importadas
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finobra_app') THEN
    -- A aplicação registra e consulta; apagar só ao desfazer um import (DELETE por import_id).
    GRANT SELECT, INSERT, DELETE ON ofx_transacoes_importadas TO finobra_app;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('039_ofx_transacoes_importadas.sql', CURRENT_TIMESTAMP, 'varredura_2026_10_ofx_fitid', 0)
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;

COMMIT;
