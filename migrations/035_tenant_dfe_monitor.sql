-- migrations/035_tenant_dfe_monitor.sql
-- Monitor DF-e Nativo da SEFAZ (Multi-Tenant) — NFeDistribuicaoDFe & CTeDistribuicaoDFe

-- 1. TABELA DE ESTADO DE SINCRONIZAÇÃO E CONTROLE DE NSU POR TENANT
CREATE TABLE IF NOT EXISTS tenant_dfe_sync (
    tenant_id VARCHAR(64) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    ultimo_nsu VARCHAR(15) NOT NULL DEFAULT '000000000000000',
    max_nsu VARCHAR(15) NOT NULL DEFAULT '000000000000000',
    ultima_sincronizacao TIMESTAMP WITH TIME ZONE,
    proxima_consulta_permitida TIMESTAMP WITH TIME ZONE,
    status_sefaz VARCHAR(20) DEFAULT 'pendente',
    mensagem_sefaz TEXT,
    total_documentos INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE DOCUMENTOS FISCAIS CAPTURADOS DA SEFAZ (NF-e, CT-e, Eventos)
CREATE TABLE IF NOT EXISTS tenant_dfe_documentos (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo_documento VARCHAR(10) NOT NULL, -- 'NFE', 'CTE', 'EVENTO'
    nsu VARCHAR(15) NOT NULL,
    chave VARCHAR(44) NOT NULL,
    cnpj_emitente VARCHAR(14),
    nome_emitente VARCHAR(255),
    valor_total NUMERIC(15,2) DEFAULT 0,
    data_emissao TIMESTAMP WITH TIME ZONE,
    situacao VARCHAR(30) DEFAULT 'autorizada',
    schema_tipo VARCHAR(50),
    xml_completo TEXT,
    danfe_url TEXT,
    manifesto_status VARCHAR(30) DEFAULT 'sem_manifesto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_dfe_chave UNIQUE (tenant_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_tenant_dfe_doc_tenant ON tenant_dfe_documentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_dfe_doc_chave ON tenant_dfe_documentos(chave);
CREATE INDEX IF NOT EXISTS idx_tenant_dfe_doc_emissao ON tenant_dfe_documentos(tenant_id, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_dfe_doc_tipo ON tenant_dfe_documentos(tenant_id, tipo_documento);
CREATE INDEX IF NOT EXISTS idx_tenant_dfe_doc_emitente ON tenant_dfe_documentos(tenant_id, cnpj_emitente);

-- 3. HABILITAÇÃO DE RLS E POLÍTICAS DE ISOLAMENTO MULTI-TENANT
ALTER TABLE tenant_dfe_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_dfe_sync FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tenant_dfe_sync ON tenant_dfe_sync;
CREATE POLICY tenant_isolation_tenant_dfe_sync ON tenant_dfe_sync
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

ALTER TABLE tenant_dfe_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_dfe_documentos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tenant_dfe_documentos ON tenant_dfe_documentos;
CREATE POLICY tenant_isolation_tenant_dfe_documentos ON tenant_dfe_documentos
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- 4. CONCESSÃO DE PRIVILÉGIOS AO ROLE finobra_app (SE EXISTIR)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finobra_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_dfe_sync TO finobra_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_dfe_documentos TO finobra_app;
  END IF;
END $$;

-- 5. REGISTRO NO schema_migrations
INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
VALUES (
  '035_tenant_dfe_monitor.sql',
  CURRENT_TIMESTAMP,
  'patch57_tenant_dfe_monitor_v1',
  0
)
ON CONFLICT (version) DO NOTHING;
