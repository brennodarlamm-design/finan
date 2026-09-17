-- migrations/032_rls_public_validation_and_audit.sql
-- PATCH 56 — Correção Crítica de RLS (SEC-01 e SEC-02)
--
-- 1. [SEC-01] Permite leitura pública de document_signatures por código de validação.
--    Evita que o RLS estrito retorne 404 em consultas públicas de QR Code/contratos.
-- 2. [SEC-02] Permite inserção de audit_logs com tenant_id IS NULL para falhas anônimas.
--    Evita que tentativas de invasão/brute force falhem silenciosamente e ceguem o Fail2Ban.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Leitura Pública de Assinaturas por Código de Validação
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS signatures_public_read ON document_signatures;

CREATE POLICY signatures_public_read ON document_signatures
  FOR SELECT
  USING (codigo_validacao IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS de audit_logs: Isolamento de Leitura + Permissão de Log Anônimo
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR tenant_id IS NULL
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Registro no schema_migrations
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
VALUES (
  '032_rls_public_validation_and_audit.sql',
  CURRENT_TIMESTAMP,
  'patch56_rls_public_validation_audit_hotfix',
  0
)
ON CONFLICT (version) DO NOTHING;
