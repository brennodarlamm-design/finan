-- migrations/029_enable_rls_production.sql
-- PATCH 55: Isolamento Multi-Tenant com RLS em Produção, Revogação Neon Data API e Criptografia MFA
-- Aplica Row-Level Security (RLS) em todas as 33 tabelas multi-tenant com tenant_id,
-- revoga privilégios do role 'authenticated' e 'anonymous' da Neon Data API,
-- e expande coluna mfa_secret para suportar envelopes criptografados AES-256-GCM.

-- 1. Expansão de mfa_secret em usuarios
ALTER TABLE usuarios ALTER COLUMN mfa_secret TYPE VARCHAR(255);

-- 2. Revogação de acesso da Neon Data API (authenticated / anonymous)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated, anonymous;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated, anonymous;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated, anonymous;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated, anonymous;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated, anonymous;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated, anonymous;

-- 3. Habilitação de RLS e Políticas de Isolamento por tenant_id (33 tabelas)

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'audit_logs',
    'auth_sessions',
    'billing_invoices',
    'billing_notifications_sent',
    'client_error_logs',
    'contas_bancarias',
    'contract_clause_versions',
    'contratos',
    'dev_tenant_keys',
    'document_signatures',
    'documentos',
    'fornecedores',
    'lancamentos',
    'medicoes',
    'notas_fiscais',
    'obra_cadastro_geral',
    'obra_doc_fases',
    'obras',
    'ocr_historico',
    'orcamentos',
    'orcamentos_sinapi',
    'precompras',
    'produtos',
    'recibos',
    'support_conversations',
    'support_messages',
    'tenant_certificates',
    'tenant_patch51_settings',
    'tenant_preferences',
    'tenant_whatsapp_auth',
    'usuarios',
    'workflow_etapas',
    'workflow_historico'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- Habilita RLS na tabela
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);

    -- Remove política anterior se existir
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'tenant_isolation_' || tbl, tbl);

    -- Cria política de isolamento estrito por tenant_id ou bypass de sistema
    EXECUTE format('
      CREATE POLICY %I ON %I
        FOR ALL
        USING (
          tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')
          OR current_setting(''app.is_system'', true) = ''true''
        )
        WITH CHECK (
          tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')
          OR current_setting(''app.is_system'', true) = ''true''
        );
    ', 'tenant_isolation_' || tbl, tbl);
  END LOOP;
END $$;

-- 4. Registro da Migração no schema_migrations
INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
VALUES (
  '029_enable_rls_production.sql',
  CURRENT_TIMESTAMP,
  'patch55_rls_data_api_revoke_mfa_enc',
  0
)
ON CONFLICT (version) DO NOTHING;
