-- Migration 026: Row-Level Security (RLS) Sandbox para Neon PostgreSQL Multi-Tenant
-- Esta migração define e habilita RLS em modo isolado para testes em branch de desenvolvimento.
-- Permite validar se o contexto 'app.current_tenant_id' ou 'app.is_system' previne vazamentos.

DO $$
BEGIN

  -- Habilita RLS nas tabelas multi-tenant principais (sandbox)
  ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
  ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;
  ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
  ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
  ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Aviso na preparação de RLS: %', SQLERRM;
END $$;

-- Política de isolamento estrito por tenant_id
DROP POLICY IF EXISTS tenant_isolation_obras ON obras;
CREATE POLICY tenant_isolation_obras ON obras
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR current_setting('app.is_system', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_isolation_lancamentos ON lancamentos;
CREATE POLICY tenant_isolation_lancamentos ON lancamentos
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR current_setting('app.is_system', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_isolation_fornecedores ON fornecedores;
CREATE POLICY tenant_isolation_fornecedores ON fornecedores
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR current_setting('app.is_system', true) = 'true'
  );
