// scripts/setup-neon.js — Inicialização e criação de tabelas no Neon PostgreSQL

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_5gVqFJ3NRyvK@ep-solitary-river-ach3x8za-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('Conectando ao Neon PostgreSQL (sa-east-1)...');

const sql = neon(connectionString);

async function main() {
  try {
    const versionRes = await sql`SELECT version();`;
    console.log('✅ Conexão estabelecida com sucesso!');
    console.log('PostgreSQL Versão:', versionRes[0]?.version);

    console.log('Criando tabelas...');

    // 1. Obras
    await sql`
      CREATE TABLE IF NOT EXISTS obras (
        id VARCHAR(64) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        cliente VARCHAR(255),
        endereco TEXT,
        orcamento_total NUMERIC(15, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'em_andamento',
        data_inicio DATE,
        data_previsao DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Tabela obras pronta');

    // 2. Fornecedores
    await sql`
      CREATE TABLE IF NOT EXISTS fornecedores (
        id VARCHAR(64) PRIMARY KEY,
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
    `;
    console.log('  ✓ Tabela fornecedores pronta');

    // 3. Notas Fiscais
    await sql`
      CREATE TABLE IF NOT EXISTS notas_fiscais (
        id VARCHAR(64) PRIMARY KEY,
        numero_nf VARCHAR(64),
        serie VARCHAR(32),
        chave_acesso VARCHAR(64) UNIQUE,
        emitente VARCHAR(255),
        cnpj_emitente VARCHAR(32),
        valor_total NUMERIC(15, 2) DEFAULT 0,
        data_emissao DATE,
        obra_id VARCHAR(64) REFERENCES obras(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'ativo',
        pdf_url TEXT,
        xml_data TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Tabela notas_fiscais pronta');

    // 4. Lançamentos
    await sql`
      CREATE TABLE IF NOT EXISTS lancamentos (
        id VARCHAR(64) PRIMARY KEY,
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Tabela lancamentos pronta');

    // 5. Orçamentos
    await sql`
      CREATE TABLE IF NOT EXISTS orcamentos (
        id VARCHAR(64) PRIMARY KEY,
        obra_id VARCHAR(64) REFERENCES obras(id) ON DELETE CASCADE,
        titulo VARCHAR(255),
        valor_total NUMERIC(15, 2) DEFAULT 0,
        itens_json JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Tabela orcamentos pronta');

    // 6. Medições
    await sql`
      CREATE TABLE IF NOT EXISTS medicoes (
        id VARCHAR(64) PRIMARY KEY,
        obra_id VARCHAR(64) REFERENCES obras(id) ON DELETE CASCADE,
        numero INT,
        data DATE,
        valor_medido NUMERIC(15, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pendente',
        itens_json JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Tabela medicoes pronta');

    // 7. Documentos
    await sql`
      CREATE TABLE IF NOT EXISTS documentos (
        id VARCHAR(64) PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL,
        referencia_id VARCHAR(64) NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        categoria VARCHAR(100),
        nome_arquivo VARCHAR(255),
        tipo_arquivo VARCHAR(100),
        tamanho_bytes BIGINT,
        base64_data TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('  ✓ Tabela documentos pronta');

    // Índices
    await sql`CREATE INDEX IF NOT EXISTS idx_lancamentos_vencimento ON lancamentos(data_vencimento);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lancamentos_obra ON lancamentos(obra_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON lancamentos(status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_nfe_chave ON notas_fiscais(chave_acesso);`;
    console.log('  ✓ Índices de alta performance criados');

    // Lista tabelas criadas
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log('\n======================================================');
    console.log('🎉 BANCO DE DADOS NEON CONFIGURADO COM SUCESSO!');
    console.log('Tabelas no PostgreSQL:');
    tables.forEach(t => console.log(`  - 📁 ${t.table_name}`));
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
}

main();
