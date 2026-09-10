-- FinObra — hardening SaaS / auditoria / dados cadastrais
-- Executar uma única vez no Neon antes de publicar os novos endpoints.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS crea_cau VARCHAR(100);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64),
  user_id VARCHAR(64),
  acao VARCHAR(80) NOT NULL,
  entidade VARCHAR(80) NOT NULL,
  entidade_id VARCHAR(128),
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip VARCHAR(80),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_created
  ON audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user_created
  ON audit_logs (user_id, created_at DESC);

-- Índices úteis para consultas SaaS por tenant.
CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant_vencimento
  ON lancamentos (tenant_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant_status_vencimento
  ON lancamentos (tenant_id, status, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant_obra_data
  ON lancamentos (tenant_id, obra_id, data);
CREATE INDEX IF NOT EXISTS idx_notas_tenant_chave
  ON notas_fiscais (tenant_id, chave_acesso);
CREATE INDEX IF NOT EXISTS idx_fornecedores_tenant_doc
  ON fornecedores (tenant_id, cnpj_cpf);
