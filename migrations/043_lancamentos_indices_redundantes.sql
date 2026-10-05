-- migrations/043_lancamentos_indices_redundantes.sql (também remove um índice duplicado de audit_logs)
-- AUDITORIA 2026-10-04 #37: índices de lancamentos que não começam por tenant_id (toda consulta de
-- negócio filtra por tenant_id, e o RLS também) ou que repetem o prefixo de outro índice. Cada um
-- custa escrita em todo INSERT/UPDATE e não é usado pelo planejador (idx_scan = 0 em produção).
-- Remove só índices; nenhum dado é alterado. Idempotente.

DROP INDEX IF EXISTS idx_lancamentos_obra;              -- (obra_id): coberto por (tenant_id, obra_id, ...)
DROP INDEX IF EXISTS idx_lancamentos_status;            -- (status): coberto por (tenant_id, status, data_vencimento)
DROP INDEX IF EXISTS idx_lancamentos_vencimento;        -- (data_vencimento): coberto por (tenant_id, data_vencimento)
DROP INDEX IF EXISTS idx_lancamentos_tenant;            -- (tenant_id): prefixo de vários outros
DROP INDEX IF EXISTS idx_lancamentos_tenant_obra_data;  -- (tenant_id, obra_id, data): prefixo de ..._obra_data_desc
DROP INDEX IF EXISTS idx_audit_tenant_created;           -- duplicado exato de idx_audit_logs_tenant_created
