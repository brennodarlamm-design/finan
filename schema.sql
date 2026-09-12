-- ==============================================================================
--  FINOBRA — Schema PostgreSQL Multi-Tenant (Neon Database)
-- ==============================================================================

-- 0. Inquilinos / Empresas Contratantes do SaaS (Multi-Tenancy)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj VARCHAR(32),
    telefone VARCHAR(32),
    email VARCHAR(255),
    cidade VARCHAR(100),
    uf VARCHAR(2),
    endereco TEXT,
    responsavel VARCHAR(255),
    logo_url TEXT,
    crea_cau VARCHAR(100),
    plano VARCHAR(50) DEFAULT 'pro',
    status VARCHAR(50) DEFAULT 'ativo',
    vencimento DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 0.1 Usuários Autenticados com Hash de Senha Criptográfico
CREATE TABLE IF NOT EXISTS usuarios (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    perfil VARCHAR(50) DEFAULT 'admin', -- 'superadmin', 'admin', 'gestor', 'operador'
    avatar VARCHAR(255),
    ativo BOOLEAN DEFAULT TRUE,
    google_auth BOOLEAN DEFAULT FALSE,
    google_sub VARCHAR(255),
    permissoes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 0.15 Cobranças / Assinaturas SaaS
CREATE TABLE IF NOT EXISTS billing_invoices (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    plan_id VARCHAR(32) NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    status VARCHAR(24) NOT NULL DEFAULT 'pending',
    txid VARCHAR(35) NOT NULL,
    pix_payload TEXT,
    created_by VARCHAR(64),
    paid_by VARCHAR(64),
    paid_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_invoices_txid ON billing_invoices (txid);
CREATE INDEX IF NOT EXISTS idx_billing_tenant_status_created ON billing_invoices (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_status_created ON billing_invoices (status, created_at DESC);

-- 0.18 Central de Atendimento DEV / FinBot
CREATE TABLE IF NOT EXISTS support_conversations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    status VARCHAR(24) NOT NULL DEFAULT 'bot',
    assigned_to VARCHAR(64),
    human_requested_at TIMESTAMP WITH TIME ZONE,
    notified_at TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_messages (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sender_type VARCHAR(24) NOT NULL,
    sender_user_id VARCHAR(64),
    sender_name VARCHAR(255),
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_support_conversations_queue ON support_conversations (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_conversations_tenant_user ON support_conversations (tenant_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_conversation ON support_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_support_messages_tenant ON support_messages (tenant_id, created_at DESC);

-- 0.2 Recuperação de Senhas e Códigos OTP Server-Side
CREATE TABLE IF NOT EXISTS recuperacao_senhas (
    id VARCHAR(64) PRIMARY KEY,
    usuario_id VARCHAR(64) NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo_hash VARCHAR(255) NOT NULL,
    tentativas INT DEFAULT 0,
    max_tentativas INT DEFAULT 5,
    expira_em TIMESTAMP WITH TIME ZONE NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1. Obras / Centros de Custo
CREATE TABLE IF NOT EXISTS obras (
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    id VARCHAR(64) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    cliente VARCHAR(255),
    endereco TEXT,
    orcamento_total NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'em_andamento',
    data_inicio DATE,
    data_previsao DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, id)
);

-- 2. Fornecedores e Prestadores de Serviço
CREATE TABLE IF NOT EXISTS fornecedores (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    razao_social VARCHAR(255),
    cnpj_cpf VARCHAR(32),
    telefone VARCHAR(32),
    email VARCHAR(255),
    categoria VARCHAR(100),
    chave_pix VARCHAR(255),
    banco_info TEXT,
    endereco TEXT,
    municipio VARCHAR(120),
    uf VARCHAR(2),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, id)
);

-- 3. Notas Fiscais (NF-e)
CREATE TABLE IF NOT EXISTS notas_fiscais (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    numero_nf VARCHAR(64),
    serie VARCHAR(32),
    chave_acesso VARCHAR(64),
    chave_nfe VARCHAR(64),
    emitente VARCHAR(255),
    cnpj_emitente VARCHAR(32),
    destinatario VARCHAR(255),
    data_emissao DATE,
    data_vencimento DATE,
    data_pagamento DATE,
    valor_bruto NUMERIC(15, 2) DEFAULT 0,
    impostos NUMERIC(15, 2) DEFAULT 0,
    valor_liquido NUMERIC(15, 2) DEFAULT 0,
    valor_total NUMERIC(15, 2) DEFAULT 0,
    tipo VARCHAR(20) DEFAULT 'entrada',
    categoria VARCHAR(100),
    obra_id VARCHAR(64),
    lancamento_id VARCHAR(64),
    status VARCHAR(50) DEFAULT 'paga',
    observacoes TEXT,
    pdf_url TEXT,
    xml_data TEXT,
    itens JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id,id) ON DELETE SET NULL (obra_id)
);

-- 4. Lançamentos Financeiros (Contas a Pagar, Contas a Receber, Boletos)
CREATE TABLE IF NOT EXISTS lancamentos (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    data_vencimento DATE,
    data_pagamento DATE,
    descricao TEXT NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    fornecedor_beneficiario VARCHAR(255),
    fornecedor_id VARCHAR(64),
    conta_bancaria VARCHAR(100),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    valor NUMERIC(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente',
    obra_id VARCHAR(64),
    nota_fiscal_id VARCHAR(64),
    codigo_barras VARCHAR(120),
    chave_nfe VARCHAR(64),
    observacoes TEXT,
    conciliado BOOLEAN DEFAULT FALSE,
    itens JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id, fornecedor_id) REFERENCES fornecedores(tenant_id,id) ON DELETE SET NULL (fornecedor_id),
    FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id,id) ON DELETE SET NULL (obra_id),
    FOREIGN KEY (tenant_id, nota_fiscal_id) REFERENCES notas_fiscais(tenant_id,id) ON DELETE SET NULL (nota_fiscal_id)
);

-- 5. Orçamentos da Obra
CREATE TABLE IF NOT EXISTS orcamentos (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    obra_id VARCHAR(64),
    titulo VARCHAR(255),
    valor_total NUMERIC(15, 2) DEFAULT 0,
    itens_json JSONB,
    status VARCHAR(32) DEFAULT 'ativo',
    descricao TEXT DEFAULT '',
    data_criacao DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_orcamentos_tenant_status ON orcamentos(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_tenant_obra_status ON orcamentos(tenant_id, obra_id, status);

-- 6. Medições de Obra
CREATE TABLE IF NOT EXISTS medicoes (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    obra_id VARCHAR(64),
    numero INT,
    data DATE,
    valor_medido NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pendente',
    observacoes TEXT,
    itens_json JSONB,
    percentual_fisico NUMERIC(5,2) DEFAULT 0,
    percentual_financeiro NUMERIC(5,2) DEFAULT 0,
    valor_solicitado NUMERIC(15,2) DEFAULT 0,
    valor_aprovado NUMERIC(15,2),
    valor_liberado NUMERIC(15,2),
    data_previsao DATE,
    data_submissao DATE,
    data_aprovacao DATE,
    data_liberacao DATE,
    engenheiro_responsavel VARCHAR(150),
    etapa_descricao TEXT,
    documentos_ok BOOLEAN DEFAULT FALSE,
    lancamento_id VARCHAR(64),
    retencao_tecnica NUMERIC(15,2) DEFAULT 0,
    descontos NUMERIC(15,2) DEFAULT 0,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id,id) ON DELETE CASCADE
);

-- 7. Documentos e Comprovantes (GED)
CREATE TABLE IF NOT EXISTS documentos (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    referencia_id VARCHAR(64) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    categoria VARCHAR(100),
    nome_arquivo VARCHAR(255),
    tipo_arquivo VARCHAR(100),
    tamanho_bytes BIGINT,
    base64_data TEXT,
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Contas Bancárias
CREATE TABLE IF NOT EXISTS contas_bancarias (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    banco_codigo VARCHAR(20),
    banco_nome VARCHAR(100),
    agencia VARCHAR(50),
    numero VARCHAR(50),
    tipo VARCHAR(50),
    titular VARCHAR(150),
    apelido VARCHAR(150),
    obra_id VARCHAR(100),
    obs TEXT,
    saldo_inicial NUMERIC(15, 2) DEFAULT 0,
    saldo_atual NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Produtos e Catálogo de Insumos
CREATE TABLE IF NOT EXISTS produtos (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    unidade VARCHAR(50) DEFAULT 'un',
    categoria VARCHAR(100) DEFAULT 'material',
    codigo VARCHAR(100),
    valor_medio NUMERIC(15, 2) DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Histórico de OCR e Documentos Fiscais Lidos
CREATE TABLE IF NOT EXISTS ocr_historico (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    nome_arquivo VARCHAR(255),
    tipo_documento VARCHAR(100),
    fornecedor VARCHAR(255),
    valor NUMERIC(15, 2) DEFAULT 0,
    data_vencimento DATE,
    confianca NUMERIC(5, 2) DEFAULT 0,
    dados JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para alta performance e isolamento multi-tenant
CREATE INDEX IF NOT EXISTS idx_obras_tenant ON obras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant ON lancamentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_vencimento ON lancamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_lancamentos_obra ON lancamentos(obra_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_nfe_tenant ON notas_fiscais(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nfe_chave ON notas_fiscais(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_contas_tenant ON contas_bancarias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_tenant ON fornecedores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tenant ON documentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_produtos_tenant ON produtos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ocr_tenant ON ocr_historico(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant ON usuarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- Integridade relacional composta multi-tenant (garante unicidade de id por tenant)
CREATE UNIQUE INDEX IF NOT EXISTS uq_obras_tenant_id ON obras(tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fornecedores_tenant_id ON fornecedores(tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notas_tenant_id ON notas_fiscais(tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lancamentos_tenant_id ON lancamentos(tenant_id, id);



-- Auditoria de operações administrativas e cadastrais
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
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_logs (user_id, created_at DESC);


-- Registro central de assinaturas eletrônicas (validação pública real)
CREATE TABLE IF NOT EXISTS document_signatures (
  id VARCHAR(80) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64) REFERENCES usuarios(id) ON DELETE SET NULL,
  codigo_validacao VARCHAR(80) NOT NULL UNIQUE,
  hash_sha256 VARCHAR(128) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  doc VARCHAR(64),
  papel VARCHAR(120),
  doc_tipo VARCHAR(50) DEFAULT 'documento',
  doc_id VARCHAR(64),
  doc_numero VARCHAR(100),
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  data_hora_fmt VARCHAR(100),
  ip_dispositivo VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_document_signatures_tenant_created ON document_signatures (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_signatures_doc ON document_signatures (tenant_id, doc_tipo, doc_id);

-- ==============================================================================
-- PATCH 05 — Registros de negócio antes locais, agora persistidos no Neon
-- ==============================================================================
CREATE TABLE IF NOT EXISTS precompras (
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id VARCHAR(64) NOT NULL,
  obra_id VARCHAR(64), numero_ordem VARCHAR(100), status VARCHAR(80),
  valor_total NUMERIC(15,2) DEFAULT 0, data_solicitacao DATE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_precompras_tenant_status ON precompras (tenant_id, status, data_solicitacao DESC);
CREATE INDEX IF NOT EXISTS idx_precompras_tenant_obra ON precompras (tenant_id, obra_id, data_solicitacao DESC);

CREATE TABLE IF NOT EXISTS contratos (
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id VARCHAR(64) NOT NULL,
  obra_id VARCHAR(64), numero VARCHAR(100), status VARCHAR(80),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_contratos_tenant_status ON contratos (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_tenant_obra ON contratos (tenant_id, obra_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS recibos (
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id VARCHAR(64) NOT NULL,
  obra_id VARCHAR(64), numero VARCHAR(100), tipo VARCHAR(50),
  valor NUMERIC(15,2) DEFAULT 0, data DATE, status VARCHAR(80),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_recibos_tenant_data ON recibos (tenant_id, data DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_recibos_tenant_obra ON recibos (tenant_id, obra_id, data DESC);


-- ==============================================================================
-- PATCH 07 — Persistência completa de SINAPI, fases documentais e preferências
-- ==============================================================================
-- FinObra Patch 07 — completar persistência SaaS e isolamento por tenant
-- Idempotente: pode ser executada mais de uma vez com segurança.



-- Orçamentos SINAPI: antes ficavam apenas no navegador.
CREATE TABLE IF NOT EXISTS orcamentos_sinapi (
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id VARCHAR(80) NOT NULL,
  obra_id VARCHAR(64),
  nome VARCHAR(255),
  status VARCHAR(80),
  valor_total NUMERIC(15,2) DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT fk_orcamentos_sinapi_obra_tenant
    FOREIGN KEY (tenant_id, obra_id) REFERENCES obras (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_orcamentos_sinapi_tenant_obra
  ON orcamentos_sinapi (tenant_id, obra_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orcamentos_sinapi_tenant_status
  ON orcamentos_sinapi (tenant_id, status, updated_at DESC);

-- Checklist/fases documentais de cada obra: antes ficavam apenas no navegador.
CREATE TABLE IF NOT EXISTS obra_doc_fases (
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id VARCHAR(180) NOT NULL,
  obra_id VARCHAR(64) NOT NULL,
  doc_id VARCHAR(100) NOT NULL,
  fase_key VARCHAR(80),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT fk_obra_doc_fases_obra_tenant
    FOREIGN KEY (tenant_id, obra_id) REFERENCES obras (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_obra_doc_fases_tenant_obra
  ON obra_doc_fases (tenant_id, obra_id, updated_at DESC);

-- Preferências compartilhadas do tenant (categorias personalizadas, modo/telefone WhatsApp etc.).
CREATE TABLE IF NOT EXISTS tenant_preferences (
  tenant_id VARCHAR(64) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==============================================================================
-- PATCH 08 — Sessões revogáveis, permissões por módulo e observabilidade
-- ==============================================================================
CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(80) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_name VARCHAR(160), user_agent TEXT, ip VARCHAR(80),
  remember BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active ON auth_sessions (user_id, revoked_at, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_tenant_created ON auth_sessions (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS client_error_logs (
  id VARCHAR(80) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64) REFERENCES usuarios(id) ON DELETE SET NULL,
  route VARCHAR(100), message TEXT NOT NULL, source TEXT, line_no INTEGER, col_no INTEGER, stack TEXT, user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_client_errors_tenant_created ON client_error_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_errors_user_created ON client_error_logs (user_id, created_at DESC);


-- Patch 09: rate limiting distribuído entre instâncias serverless
CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key VARCHAR(64) PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires_at ON api_rate_limits (expires_at);


-- ==============================================================================
-- PATCH 10 — Cookie HttpOnly, CSP e integridade relacional multi-tenant
-- ==============================================================================
-- Novas instalações já usam tenant obrigatório e FKs compostas nas tabelas acima.


-- PATCH 11 — histórico de auditoria das constraints multi-tenant
CREATE TABLE IF NOT EXISTS tenant_integrity_audit (
  id BIGSERIAL PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  constraint_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  issue_count INTEGER NOT NULL DEFAULT 0,
  validated BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_tenant_integrity_audit_checked ON tenant_integrity_audit(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_integrity_audit_constraint ON tenant_integrity_audit(constraint_name,checked_at DESC);

-- PATCH 11 / MIGRATION 011 — Obra de sistema 'escritorio' para despesas administrativas e integridade de FK
CREATE OR REPLACE FUNCTION ensure_tenant_system_obras()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO obras (id, tenant_id, nome, cliente, status)
  VALUES ('escritorio', NEW.id, 'Sede / Escritório Central', 'Administrativo', 'sistema')
  ON CONFLICT (tenant_id, id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_system_obras ON tenants;
CREATE TRIGGER trg_tenant_system_obras
AFTER INSERT ON tenants
FOR EACH ROW EXECUTE FUNCTION ensure_tenant_system_obras();

-- ==============================================================================
-- PATCH 12 — Certificados Digitais A1 e WhatsApp Multi-Tenant
-- ==============================================================================
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

CREATE TABLE IF NOT EXISTS tenant_whatsapp_auth (
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, key)
);
CREATE INDEX IF NOT EXISTS idx_tenant_whatsapp_auth_tenant ON tenant_whatsapp_auth(tenant_id);

-- ==============================================================================
-- PATCH 13 — Governança de Migrações e Recuperação Segura de Senhas
-- ==============================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64),
    execution_time_ms INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);

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
