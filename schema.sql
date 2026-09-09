-- ==============================================================================
--  ANGELIM CONSTRUTORA & FINOBRA — Schema PostgreSQL Multi-Tenant (Neon Database)
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
    plano VARCHAR(50) DEFAULT 'pro',
    status VARCHAR(50) DEFAULT 'ativo',
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) DEFAULT 'angelim',
    nome VARCHAR(255) NOT NULL,
    cliente VARCHAR(255),
    endereco TEXT,
    orcamento_total NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'em_andamento',
    data_inicio DATE,
    data_previsao DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Fornecedores e Prestadores de Serviço
CREATE TABLE IF NOT EXISTS fornecedores (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) DEFAULT 'angelim',
    nome VARCHAR(255) NOT NULL,
    razao_social VARCHAR(255),
    cnpj_cpf VARCHAR(32),
    telefone VARCHAR(32),
    email VARCHAR(255),
    categoria VARCHAR(100),
    chave_pix VARCHAR(255),
    banco_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Notas Fiscais (NF-e)
CREATE TABLE IF NOT EXISTS notas_fiscais (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) DEFAULT 'angelim',
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
    obra_id VARCHAR(64) REFERENCES obras(id) ON DELETE SET NULL,
    lancamento_id VARCHAR(64),
    status VARCHAR(50) DEFAULT 'paga',
    observacoes TEXT,
    pdf_url TEXT,
    xml_data TEXT,
    itens JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 4. Lançamentos Financeiros (Contas a Pagar, Contas a Receber, Boletos)
CREATE TABLE IF NOT EXISTS lancamentos (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) DEFAULT 'angelim',
    data DATE NOT NULL,
    data_vencimento DATE,
    data_pagamento DATE,
    descricao TEXT NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    fornecedor_beneficiario VARCHAR(255),
    fornecedor_id VARCHAR(64) REFERENCES fornecedores(id) ON DELETE SET NULL,
    conta_bancaria VARCHAR(100),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    valor NUMERIC(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente',
    obra_id VARCHAR(64) REFERENCES obras(id) ON DELETE SET NULL,
    nota_fiscal_id VARCHAR(64) REFERENCES notas_fiscais(id) ON DELETE SET NULL,
    codigo_barras VARCHAR(120),
    chave_nfe VARCHAR(64),
    observacoes TEXT,
    conciliado BOOLEAN DEFAULT FALSE,
    itens JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Orçamentos da Obra
CREATE TABLE IF NOT EXISTS orcamentos (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) DEFAULT 'angelim',
    obra_id VARCHAR(64) REFERENCES obras(id) ON DELETE CASCADE,
    titulo VARCHAR(255),
    valor_total NUMERIC(15, 2) DEFAULT 0,
    itens_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Medições de Obra
CREATE TABLE IF NOT EXISTS medicoes (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) DEFAULT 'angelim',
    obra_id VARCHAR(64) REFERENCES obras(id) ON DELETE CASCADE,
    numero INT,
    data DATE,
    valor_medido NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pendente',
    itens_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Documentos e Comprovantes (GED)
CREATE TABLE IF NOT EXISTS documentos (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) DEFAULT 'angelim',
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
    tenant_id VARCHAR(64) DEFAULT 'angelim',
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
    tenant_id VARCHAR(64) DEFAULT 'angelim',
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
    tenant_id VARCHAR(64) DEFAULT 'angelim',
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
