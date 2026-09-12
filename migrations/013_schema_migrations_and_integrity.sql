-- ============================================================================
-- MIGRATION 013: Controle Transacional de Schema e Governança de Migrações
-- Data: 2026-09-11
-- ============================================================================

-- 1. TABELA DE CONTROLE DE VERSÕES DE MIGRAÇÃO (schema_migrations)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64),
    execution_time_ms INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);

-- 2. REGISTRO RETROATIVO DAS MIGRAÇÕES 001 A 012 SE JÁ APLICADAS NO BANCO
INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
VALUES
    ('001_initial_neon.sql', CURRENT_TIMESTAMP, 'baseline_001', 0),
    ('002_fornecedores_enderecos.sql', CURRENT_TIMESTAMP, 'baseline_002', 0),
    ('003_assinaturas_central.sql', CURRENT_TIMESTAMP, 'baseline_003', 0),
    ('004_master_admin_saas.sql', CURRENT_TIMESTAMP, 'baseline_004', 0),
    ('005_finbot_memory.sql', CURRENT_TIMESTAMP, 'baseline_005', 0),
    ('006_billing_signatures_tenants.sql', CURRENT_TIMESTAMP, 'baseline_006', 0),
    ('007_sinapi_docfases_prefs.sql', CURRENT_TIMESTAMP, 'baseline_007', 0),
    ('008_rbac_sessions_telemetry.sql', CURRENT_TIMESTAMP, 'baseline_008', 0),
    ('009_cookie_csp_tenant_integrity.sql', CURRENT_TIMESTAMP, 'baseline_009', 0),
    ('010_security_closure.sql', CURRENT_TIMESTAMP, 'baseline_010', 0),
    ('011_escritorio_fk_repair.sql', CURRENT_TIMESTAMP, 'baseline_011', 0),
    ('012_certificados_medicoes_whatsapp_multitenant.sql', CURRENT_TIMESTAMP, 'baseline_012', 0),
    ('013_schema_migrations_and_integrity.sql', CURRENT_TIMESTAMP, 'baseline_013', 0)
ON CONFLICT (version) DO NOTHING;

-- 3. GARANTIR INTEGRIDADE DE RECUPERAÇÃO DE SENHAS (Tentativas e Expiração)
CREATE TABLE IF NOT EXISTS recuperacao_senhas (
    id VARCHAR(64) PRIMARY KEY,
    usuario_id VARCHAR(64) NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo_hash VARCHAR(255) NOT NULL,
    tentativas INTEGER DEFAULT 0,
    max_tentativas INTEGER DEFAULT 3,
    usado BOOLEAN DEFAULT FALSE,
    expira_em TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recuperacao_senhas_user ON recuperacao_senhas(usuario_id, usado, expira_em);
