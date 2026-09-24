import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { neon } from '@neondatabase/serverless';

const conn = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_OWNER_URL ou DATABASE_URL não configurada.');
  process.exit(1);
}

const sql = neon(conn);

async function run() {
  console.log('=== APLICANDO MIGRAÇÃO 035 (Tabelas do Monitor DF-e com RLS Estrito) ===');

  console.log('1. Criando tabela tenant_dfe_sync...');
  await sql`
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
  `;

  console.log('2. Criando tabela tenant_dfe_documentos...');
  await sql`
    CREATE TABLE IF NOT EXISTS tenant_dfe_documentos (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      tipo_documento VARCHAR(10) NOT NULL,
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
  `;

  console.log('3. Criando índices...');
  await sql`CREATE INDEX IF NOT EXISTS idx_tenant_dfe_doc_tenant ON tenant_dfe_documentos(tenant_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tenant_dfe_doc_chave ON tenant_dfe_documentos(chave);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tenant_dfe_doc_emissao ON tenant_dfe_documentos(tenant_id, data_emissao DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tenant_dfe_doc_tipo ON tenant_dfe_documentos(tenant_id, tipo_documento);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tenant_dfe_doc_emitente ON tenant_dfe_documentos(tenant_id, cnpj_emitente);`;

  console.log('4. Habilitando RLS e FORCE RLS...');
  await sql`ALTER TABLE tenant_dfe_sync ENABLE ROW LEVEL SECURITY;`;
  await sql`ALTER TABLE tenant_dfe_sync FORCE ROW LEVEL SECURITY;`;
  await sql`DROP POLICY IF EXISTS tenant_isolation_tenant_dfe_sync ON tenant_dfe_sync;`;
  await sql`
    CREATE POLICY tenant_isolation_tenant_dfe_sync ON tenant_dfe_sync
      AS RESTRICTIVE
      FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
  `;

  await sql`ALTER TABLE tenant_dfe_documentos ENABLE ROW LEVEL SECURITY;`;
  await sql`ALTER TABLE tenant_dfe_documentos FORCE ROW LEVEL SECURITY;`;
  await sql`DROP POLICY IF EXISTS tenant_isolation_tenant_dfe_documentos ON tenant_dfe_documentos;`;
  await sql`
    CREATE POLICY tenant_isolation_tenant_dfe_documentos ON tenant_dfe_documentos
      AS RESTRICTIVE
      FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
  `;

  console.log('5. Concedendo permissões para finobra_app...');
  try {
    await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_dfe_sync TO finobra_app;`;
    await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_dfe_documentos TO finobra_app;`;
  } catch (grantErr) {
    console.warn('finobra_app grant warning:', grantErr.message);
  }

  console.log('6. Registrando migração 035 no schema_migrations...');
  await sql`
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES (
      '035_tenant_dfe_monitor.sql',
      CURRENT_TIMESTAMP,
      'patch57_tenant_dfe_monitor_v1',
      0
    )
    ON CONFLICT (version) DO NOTHING;
  `;

  console.log('🎉 Migração 035 aplicada com 100% de sucesso!');
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name IN ('tenant_dfe_sync', 'tenant_dfe_documentos')
    ORDER BY table_name;
  `;
  console.table(tables);
}

run().catch(err => {
  console.error('❌ Falha ao aplicar migração 035:', err);
  process.exit(1);
});
