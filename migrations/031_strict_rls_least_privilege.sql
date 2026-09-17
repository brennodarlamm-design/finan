-- migrations/031_strict_rls_least_privilege.sql
-- PATCH 56 — Hardening Definitivo de RLS e Menor Privilégio (Least Privilege)
--
-- 1. Remove bypass de sistema (app.is_system) de todas as 33 políticas RLS.
--    O role de aplicação finobra_app NUNCA pode bypassar isolamento multi-tenant.
-- 2. Habilita FORCE ROW LEVEL SECURITY nas 33 tabelas multi-tenant.
-- 3. Cria o role finobra_app com NOBYPASSRLS e menor privilégio estrito (não 44 CRUD indiscriminados).
-- 4. Mantém acesso global e administrativo restrito ao neondb_owner (DATABASE_OWNER_URL).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RLS Estrito por tenant_id (sem bypass app.is_system) + FORCE RLS (33 tabelas)
-- ─────────────────────────────────────────────────────────────────────────────

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
    -- Garante RLS habilitado
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    
    -- Força RLS mesmo para donos de tabelas
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);

    -- Remove política anterior
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'tenant_isolation_' || tbl, tbl);

    -- Cria política estrita: isolamento garantido por app.current_tenant_id SEM bypass
    EXECUTE format('
      CREATE POLICY %I ON %I
        FOR ALL
        USING (
          tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')
        )
        WITH CHECK (
          tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')
        );
    ', 'tenant_isolation_' || tbl, tbl);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Role finobra_app com NOBYPASSRLS e menor privilégio
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finobra_app') THEN
    CREATE ROLE finobra_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE finobra_app WITH NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- Permissão de uso no schema public e sequências
GRANT USAGE ON SCHEMA public TO finobra_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO finobra_app;

-- Revoga permissões prévias amplas para garantir baseline limpo
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM finobra_app;

-- 2.1 Tabelas de Referência Globais: Somente Leitura
GRANT SELECT ON bases_referenciais, itens_referenciais TO finobra_app;

-- 2.2 Segurança e Fail2Ban: Permissões Mínimas
GRANT SELECT ON security_ip_allowlist TO finobra_app;
GRANT SELECT, INSERT, UPDATE ON security_ip_state TO finobra_app;
GRANT SELECT, INSERT ON security_ip_events TO finobra_app;

-- 2.3 Rate Limit, Acesso e Recuperação
GRANT SELECT, INSERT, UPDATE, DELETE ON api_rate_limits TO finobra_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON recuperacao_senhas TO finobra_app;
GRANT SELECT, INSERT, UPDATE ON access_requests TO finobra_app;
GRANT SELECT, INSERT ON tenant_integrity_audit TO finobra_app;

-- 2.4 Tenants: Leitura e Atualização controlada (sem exclusão)
GRANT SELECT, UPDATE ON tenants TO finobra_app;

-- 2.5 Tabelas Multi-Tenant (33 tabelas): CRUD completo controlado pelo RLS
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
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO finobra_app;', tbl);
  END LOOP;
END $$;

-- 2.6 schema_migrations: NENHUM ACESSO concedido ao finobra_app
-- Somente neondb_owner pode auditar e alterar migrations.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Registro no schema_migrations
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
VALUES (
  '031_strict_rls_least_privilege.sql',
  CURRENT_TIMESTAMP,
  'patch56_strict_rls_least_privilege_v1',
  0
)
ON CONFLICT (version) DO NOTHING;
