-- Migration 026: Row-Level Security (RLS) — AMBIENTE DE SANDBOX APENAS
-- NÃO APLICAR NO BANCO DE PRODUÇÃO (Neon principal).
-- Esta migration está em migrations/sandbox/ intencionalmente.
--
-- Pré-requisitos antes de aplicar em produção:
--   1. Testar em branch Neon separado com dados reais de tenant.
--   2. Identificar o role exato usado por Vercel / Render (não o owner).
--   3. Criar GRANT de SELECT/INSERT/UPDATE/DELETE para esse role ANTES de ENABLE.
--   4. Validar que o contexto app.current_tenant_id está sendo setado corretamente.
--
-- Contexto esperado (setado pelo middleware antes de cada query):
--   SET LOCAL app.current_tenant_id = '<uuid>';
--   SET LOCAL app.is_system = 'false'; -- 'true' apenas para jobs internos

DO $$
BEGIN

  -- FORCE ROW LEVEL SECURITY impede que o owner das tabelas bypasse as políticas
  ALTER TABLE obras            ENABLE ROW LEVEL SECURITY;
  ALTER TABLE obras            FORCE ROW LEVEL SECURITY;

  ALTER TABLE lancamentos      ENABLE ROW LEVEL SECURITY;
  ALTER TABLE lancamentos      FORCE ROW LEVEL SECURITY;

  ALTER TABLE notas_fiscais    ENABLE ROW LEVEL SECURITY;
  ALTER TABLE notas_fiscais    FORCE ROW LEVEL SECURITY;

  ALTER TABLE fornecedores     ENABLE ROW LEVEL SECURITY;
  ALTER TABLE fornecedores     FORCE ROW LEVEL SECURITY;

  ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
  ALTER TABLE contas_bancarias FORCE ROW LEVEL SECURITY;

  ALTER TABLE documentos       ENABLE ROW LEVEL SECURITY;
  ALTER TABLE documentos       FORCE ROW LEVEL SECURITY;

  ALTER TABLE contratos        ENABLE ROW LEVEL SECURITY;
  ALTER TABLE contratos        FORCE ROW LEVEL SECURITY;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Aviso na preparação de RLS: %', SQLERRM;
END $$;

-- Política: acesso permitido apenas se tenant_id da linha == contexto da sessão,
-- ou se a sessão for marcada como sistema interno (is_system = 'true').

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

DROP POLICY IF EXISTS tenant_isolation_notas_fiscais ON notas_fiscais;
CREATE POLICY tenant_isolation_notas_fiscais ON notas_fiscais
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

DROP POLICY IF EXISTS tenant_isolation_contas_bancarias ON contas_bancarias;
CREATE POLICY tenant_isolation_contas_bancarias ON contas_bancarias
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR current_setting('app.is_system', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_isolation_documentos ON documentos;
CREATE POLICY tenant_isolation_documentos ON documentos
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR current_setting('app.is_system', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_isolation_contratos ON contratos;
CREATE POLICY tenant_isolation_contratos ON contratos
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR current_setting('app.is_system', true) = 'true'
  );
