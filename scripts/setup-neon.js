// scripts/setup-neon.js — Inicialização e criação de tabelas multi-tenant no Neon PostgreSQL
// Alinhado ao ecossistema moderno SaaS do FinGo com isolamento estrito por tenant_id

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ ERRO: DATABASE_OWNER_URL ou DATABASE_URL não foi definida.');
  process.exit(1);
}

console.log('🚀 Conectando ao Neon PostgreSQL com suporte multi-tenant...');
const sql = neon(connectionString);

async function main() {
  try {
    const versionRes = await sql`SELECT version();`;
    console.log('✅ Conexão estabelecida com sucesso!');
    console.log('PostgreSQL Versão:', versionRes[0]?.version);

    console.log('Criando tabelas estruturais multi-tenant...');

    // 0. Tenants & Usuários
    await sql`
      CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR(64) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        cnpj VARCHAR(32),
        plano VARCHAR(50) DEFAULT 'starter',
        status VARCHAR(50) DEFAULT 'ativo',
        criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        senha_hash VARCHAR(255) NOT NULL,
        perfil VARCHAR(50) DEFAULT 'operador',
        ativo BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 1. Obras
    await sql`
      CREATE TABLE IF NOT EXISTS obras (
        id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        cliente VARCHAR(255),
        endereco TEXT,
        orcamento_total NUMERIC(15, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'em_andamento',
        data_inicio DATE,
        data_previsao DATE,
        cronograma_config JSONB,
        bdi_config JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_obras_tenant_id ON obras(tenant_id, id);`;
    console.log('  ✓ Tabela obras pronta com isolamento por tenant');

    // 2. Fornecedores
    await sql`
      CREATE TABLE IF NOT EXISTS fornecedores (
        id VARCHAR(64) NOT NULL,
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
        municipio VARCHAR(100),
        uf VARCHAR(2),
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_fornecedores_tenant_id ON fornecedores(tenant_id, id);`;
    console.log('  ✓ Tabela fornecedores pronta com isolamento por tenant');

    // 3. Notas Fiscais
    await sql`
      CREATE TABLE IF NOT EXISTS notas_fiscais (
        id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        numero_nf VARCHAR(64),
        serie VARCHAR(32),
        chave_acesso VARCHAR(64),
        chave_nfe VARCHAR(64),
        emitente VARCHAR(255),
        cnpj_emitente VARCHAR(32),
        destinatario VARCHAR(255),
        valor_total NUMERIC(15, 2) DEFAULT 0,
        valor_bruto NUMERIC(15, 2) DEFAULT 0,
        impostos NUMERIC(15, 2) DEFAULT 0,
        valor_liquido NUMERIC(15, 2) DEFAULT 0,
        data_emissao DATE,
        data_vencimento DATE,
        data_pagamento DATE,
        tipo VARCHAR(32) DEFAULT 'entrada',
        categoria VARCHAR(64) DEFAULT 'material',
        obra_id VARCHAR(64) REFERENCES obras(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'ativo',
        pdf_url TEXT,
        xml_data TEXT,
        itens JSONB,
        observacoes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_notas_tenant_id ON notas_fiscais(tenant_id, id);`;
    console.log('  ✓ Tabela notas_fiscais pronta com isolamento por tenant');

    // 4. Lançamentos
    await sql`
      CREATE TABLE IF NOT EXISTS lancamentos (
        id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_lancamentos_tenant_id ON lancamentos(tenant_id, id);`;
    console.log('  ✓ Tabela lancamentos pronta com isolamento por tenant');

    // 5. Orçamentos
    await sql`
      CREATE TABLE IF NOT EXISTS orcamentos (
        id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        obra_id VARCHAR(64) REFERENCES obras(id) ON DELETE CASCADE,
        titulo VARCHAR(255),
        valor_total NUMERIC(15, 2) DEFAULT 0,
        itens_json JSONB,
        status VARCHAR(50) DEFAULT 'ativo',
        descricao TEXT,
        data_criacao DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamentos_tenant_id ON orcamentos(tenant_id, id);`;
    console.log('  ✓ Tabela orcamentos pronta com isolamento por tenant');

    // 6. Medições
    await sql`
      CREATE TABLE IF NOT EXISTS medicoes (
        id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        obra_id VARCHAR(64) REFERENCES obras(id) ON DELETE CASCADE,
        numero INT,
        data DATE,
        valor_medido NUMERIC(15, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pendente',
        itens_json JSONB,
        payload JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_medicoes_tenant_id ON medicoes(tenant_id, id);`;
    console.log('  ✓ Tabela medicoes pronta com isolamento por tenant');

    // 7. Documentos
    await sql`
      CREATE TABLE IF NOT EXISTS documentos (
        id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL,
        referencia_id VARCHAR(64) NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        categoria VARCHAR(100),
        nome_arquivo VARCHAR(255),
        tipo_arquivo VARCHAR(100),
        tamanho_bytes BIGINT,
        url TEXT,
        base64_data TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_documentos_tenant_id ON documentos(tenant_id, id);`;
    console.log('  ✓ Tabela documentos pronta com isolamento por tenant');

    // 8. Contas Bancárias
    await sql`
      CREATE TABLE IF NOT EXISTS contas_bancarias (
        id VARCHAR(100) NOT NULL,
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
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_contas_tenant_id ON contas_bancarias(tenant_id, id);`;
    console.log('  ✓ Tabela contas_bancarias pronta com isolamento por tenant');

    // 9. Produtos
    await sql`
      CREATE TABLE IF NOT EXISTS produtos (
        id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        unidade VARCHAR(32) DEFAULT 'un',
        categoria VARCHAR(100) DEFAULT 'material',
        codigo VARCHAR(64),
        valor_medio NUMERIC(15, 2) DEFAULT 0,
        observacoes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_tenant_id ON produtos(tenant_id, id);`;
    console.log('  ✓ Tabela produtos pronta com isolamento por tenant');

    // 10. Audit Logs e Preferências
    await sql`
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
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS tenant_preferences (
        tenant_id VARCHAR(64) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Tabelas de auditoria e preferências criadas');

    console.log('\n======================================================');
    console.log('🎉 BANCO DE DADOS NEON CONFIGURADO COM SUCESSO (MULTI-TENANT READY)!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Erro durante o setup do banco:', err);
    process.exit(1);
  }
}

main();
