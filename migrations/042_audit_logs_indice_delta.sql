-- migrations/042_audit_logs_indice_delta.sql
-- AUDITORIA 2026-10-04 #37: o delta do "Sincronizar tudo" (api/_db-queries.js) consulta
--   SELECT entidade_id FROM audit_logs WHERE tenant_id = $1 AND entidade = $2 AND created_at >= $3
-- para nove tabelas a cada sincronização. Sem este índice, cada consulta varre todos os logs da
-- empresa. O INCLUDE permite responder só pelo índice. Idempotente e só aditivo.

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_entidade_created
  ON audit_logs (tenant_id, entidade, created_at DESC) INCLUDE (entidade_id);
