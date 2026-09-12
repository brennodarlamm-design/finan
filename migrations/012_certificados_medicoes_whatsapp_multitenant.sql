-- ============================================================================
-- MIGRATION 012: Certificados Digitais A1, Medições Completas e WhatsApp Multi-Tenant
-- Data: 2026-09-11
-- ============================================================================

-- 1. TABELA DE CERTIFICADOS DIGITAIS A1 (Criptografados com AES-256-GCM por Tenant)
CREATE TABLE IF NOT EXISTS tenant_certificates (
    tenant_id VARCHAR(64) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    cert_pfx_base64_enc TEXT NOT NULL,
    cert_pass_enc TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    cnpj VARCHAR(14),
    razao_social VARCHAR(255),
    valido_de TIMESTAMP WITH TIME ZONE,
    valido_ate TIMESTAMP WITH TIME ZONE,
    emissor VARCHAR(255),
    serial_number VARCHAR(100),
    nome_arquivo VARCHAR(255),
    tamanho_bytes BIGINT,
    status VARCHAR(20) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_certificates_cnpj ON tenant_certificates(cnpj);
CREATE INDEX IF NOT EXISTS idx_tenant_certificates_validade ON tenant_certificates(valido_ate);

-- 2. EXPANSÃO DA TABELA DE MEDIÇÕES (Campos físicos, financeiros e contratuais)
ALTER TABLE medicoes
    ADD COLUMN IF NOT EXISTS percentual_fisico NUMERIC(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS percentual_financeiro NUMERIC(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valor_solicitado NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valor_aprovado NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS valor_liberado NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS data_previsao DATE,
    ADD COLUMN IF NOT EXISTS data_submissao DATE,
    ADD COLUMN IF NOT EXISTS data_aprovacao DATE,
    ADD COLUMN IF NOT EXISTS data_liberacao DATE,
    ADD COLUMN IF NOT EXISTS engenheiro_responsavel VARCHAR(150),
    ADD COLUMN IF NOT EXISTS etapa_descricao TEXT,
    ADD COLUMN IF NOT EXISTS documentos_ok BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS lancamento_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS retencao_tecnica NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS descontos NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payload JSONB;

CREATE INDEX IF NOT EXISTS idx_medicoes_tenant_obra ON medicoes(tenant_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_medicoes_status ON medicoes(tenant_id, status);

-- 3. TABELA DE AUTENTICAÇÃO WHATSAPP MULTI-TENANT (Sessões Baileys Isoladas)
CREATE TABLE IF NOT EXISTS tenant_whatsapp_auth (
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_whatsapp_auth_tenant ON tenant_whatsapp_auth(tenant_id);

-- Migração de chaves legadas se a tabela antiga whatsapp_auth existir
DO $$
DECLARE
    v_first_tenant VARCHAR(64);
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_auth'
    ) THEN
        SELECT id INTO v_first_tenant FROM tenants ORDER BY created_at ASC LIMIT 1;
        IF v_first_tenant IS NOT NULL THEN
            INSERT INTO tenant_whatsapp_auth (tenant_id, key, value, updated_at)
            SELECT v_first_tenant, key, value, updated_at
            FROM whatsapp_auth
            ON CONFLICT (tenant_id, key) DO NOTHING;
        END IF;
    END IF;
END $$;
