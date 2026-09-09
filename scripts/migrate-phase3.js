// scripts/migrate-phase3.js — Script de Migração Multi-Tenant e Usuários (Neon PostgreSQL)

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL não configurada no .env.local');
  process.exit(1);
}

const sql = neon(connectionString);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function migrate() {
  console.log('🚀 Iniciando migração Fase 3 (Multi-Tenancy & Autenticação Segura)...');

  // 1. Criar tabela de Tenants (Empresas)
  console.log('📦 1. Criando tabela tenants...');
  await sql`
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
  `;

  // 2. Criar tabela de Usuários com Senha Criptografada (scrypt)
  console.log('👤 2. Criando tabela usuarios...');
  await sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      nome VARCHAR(255) NOT NULL,
      perfil VARCHAR(50) DEFAULT 'admin',
      avatar VARCHAR(255),
      ativo BOOLEAN DEFAULT TRUE,
      google_auth BOOLEAN DEFAULT FALSE,
      google_sub VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 3. Criar tabela de Recuperação de Senhas (OTP Server-Side)
  console.log('🔑 3. Criando tabela recuperacao_senhas...');
  await sql`
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
  `;

  // 4. Inserir Tenants Padrão
  console.log('🏢 4. Cadastrando tenants padrão...');
  await sql`
    INSERT INTO tenants (id, razao_social, nome_fantasia, cnpj, telefone, email, cidade, uf, responsavel, plano, status)
    VALUES 
      ('angelim', 'ANGELIM CONSTRUTORA LTDA', 'Angelim Construtora', '65.512.273/0001-60', '(95) 99142-3559', 'angelimconstrutora@gmail.com', 'Boa Vista', 'RR', 'Naira de Amorim da Silva', 'unlimited', 'ativo'),
      ('tenant_empresa_zerada', 'Minha Empresa Construtora LTDA', 'Minha Empresa Construtora', '', '', 'contato@minhaempresa.com', '', '', 'Diretor / Construtor', 'pro', 'ativo')
    ON CONFLICT (id) DO UPDATE SET
      razao_social = EXCLUDED.razao_social,
      nome_fantasia = EXCLUDED.nome_fantasia,
      status = EXCLUDED.status;
  `;

  // 5. Inserir Usuários Padrão com Hash Seguro
  console.log('🔐 5. Cadastrando usuários padrão com hash seguro (scrypt)...');
  const adminHash = hashPassword('admin123');
  const gestorHash = hashPassword('gestor123');
  const empresaHash = hashPassword('empresa123');

  await sql`
    INSERT INTO usuarios (id, tenant_id, username, email, senha_hash, nome, perfil, avatar, ativo)
    VALUES 
      ('u1', 'angelim', 'admin', 'admin@finobra.com', ${adminHash}, 'Administrador (Angelim)', 'superadmin', 'AD', TRUE),
      ('u2', 'angelim', 'gestor', 'gestor@finobra.com', ${gestorHash}, 'Gestor Obras', 'gestor', 'GO', TRUE),
      ('u_empresa', 'tenant_empresa_zerada', 'empresa', 'contato@minhaempresa.com', ${empresaHash}, 'Diretor / Construtor', 'admin', 'ME', TRUE)
    ON CONFLICT (username) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      perfil = EXCLUDED.perfil,
      ativo = EXCLUDED.ativo;
  `;

  // 6. Adicionar coluna tenant_id em todas as tabelas existentes
  console.log('🧱 6. Adicionando coluna tenant_id nas tabelas existentes...');

  // 6.1 Obras
  await sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'angelim';`;
  await sql`UPDATE obras SET tenant_id = 'angelim' WHERE tenant_id IS NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_obras_tenant ON obras(tenant_id);`;
  console.log('   ✓ Tabela obras atualizada.');

  // 6.2 Fornecedores
  await sql`ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'angelim';`;
  await sql`UPDATE fornecedores SET tenant_id = 'angelim' WHERE tenant_id IS NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_fornecedores_tenant ON fornecedores(tenant_id);`;
  console.log('   ✓ Tabela fornecedores atualizada.');

  // 6.3 Notas Fiscais
  await sql`ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'angelim';`;
  await sql`UPDATE notas_fiscais SET tenant_id = 'angelim' WHERE tenant_id IS NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notas_fiscais_tenant ON notas_fiscais(tenant_id);`;
  console.log('   ✓ Tabela notas_fiscais atualizada.');

  // 6.4 Lançamentos
  await sql`ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'angelim';`;
  await sql`UPDATE lancamentos SET tenant_id = 'angelim' WHERE tenant_id IS NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant ON lancamentos(tenant_id);`;
  console.log('   ✓ Tabela lancamentos atualizada.');

  // 6.5 Orçamentos
  await sql`ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'angelim';`;
  await sql`UPDATE orcamentos SET tenant_id = 'angelim' WHERE tenant_id IS NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orcamentos_tenant ON orcamentos(tenant_id);`;
  console.log('   ✓ Tabela orcamentos atualizada.');

  // 6.6 Medições
  await sql`ALTER TABLE medicoes ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'angelim';`;
  await sql`UPDATE medicoes SET tenant_id = 'angelim' WHERE tenant_id IS NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_medicoes_tenant ON medicoes(tenant_id);`;
  console.log('   ✓ Tabela medicoes atualizada.');

  // 6.7 Documentos
  await sql`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'angelim';`;
  await sql`UPDATE documentos SET tenant_id = 'angelim' WHERE tenant_id IS NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_documentos_tenant ON documentos(tenant_id);`;
  console.log('   ✓ Tabela documentos atualizada.');

  // 6.8 Contas Bancárias
  await sql`ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'angelim';`;
  await sql`UPDATE contas_bancarias SET tenant_id = 'angelim' WHERE tenant_id IS NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_contas_bancarias_tenant ON contas_bancarias(tenant_id);`;
  console.log('   ✓ Tabela contas_bancarias atualizada.');

  // 6.9 Produtos
  await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'angelim';`;
  await sql`UPDATE produtos SET tenant_id = 'angelim' WHERE tenant_id IS NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_produtos_tenant ON produtos(tenant_id);`;
  console.log('   ✓ Tabela produtos atualizada.');

  // 6.10 OCR Histórico
  await sql`ALTER TABLE ocr_historico ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'angelim';`;
  await sql`UPDATE ocr_historico SET tenant_id = 'angelim' WHERE tenant_id IS NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ocr_historico_tenant ON ocr_historico(tenant_id);`;
  console.log('   ✓ Tabela ocr_historico atualizada.');

  // 7. Índices extras para usuários
  await sql`CREATE INDEX IF NOT EXISTS idx_usuarios_tenant ON usuarios(tenant_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);`;

  console.log('\n✅ MIGRAÇÃO FASE 3 CONCLUÍDA COM SUCESSO NO NEON POSTGRESQL!');
}

migrate().catch(err => {
  console.error('❌ Erro na migração:', err);
  process.exit(1);
});
