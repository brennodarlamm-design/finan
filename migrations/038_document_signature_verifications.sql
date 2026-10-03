-- migrations/038_document_signature_verifications.sql
-- Registro das verificações de assinaturas digitais (ICP-Brasil qualificada / Gov.br avançada)
-- feitas pelo FinGo em PDFs anexados a contratos e recibos. Guarda a prova da verificação:
-- hash do arquivo, resultado, signatários e relatório técnico.

BEGIN;

CREATE TABLE IF NOT EXISTS document_signature_verifications (
    id VARCHAR(80) PRIMARY KEY,
    tenant_id VARCHAR(80) NOT NULL,
    entity VARCHAR(40) NOT NULL CHECK (entity IN ('contratos', 'recibos')),
    entity_id VARCHAR(120) NOT NULL,
    file_name VARCHAR(255),
    file_sha256 CHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('valida', 'indeterminada', 'invalida', 'sem_assinatura')),
    nivel VARCHAR(20),
    signatarios JSONB NOT NULL DEFAULT '[]'::jsonb,
    relatorio JSONB NOT NULL DEFAULT '{}'::jsonb,
    verified_by VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sigver_tenant_entity ON document_signature_verifications (tenant_id, entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sigver_tenant_hash ON document_signature_verifications (tenant_id, file_sha256);

ALTER TABLE document_signature_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signature_verifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_document_signature_verifications ON document_signature_verifications;
CREATE POLICY tenant_isolation_document_signature_verifications ON document_signature_verifications
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finobra_app') THEN
    -- Registro de prova: a aplicação insere e consulta, nunca altera nem apaga.
    GRANT SELECT, INSERT ON document_signature_verifications TO finobra_app;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('038_document_signature_verifications.sql', CURRENT_TIMESTAMP, 'audit_2026_10_icp_verification', 0)
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;

COMMIT;
