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
  console.log('=== APLICANDO MIGRAÇÃO 032 (RLS Validação Pública de Assinaturas e Audit Logs Anônimos) ===');

  console.log('1. Aplicando política pública signatures_public_read em document_signatures...');
  await sql`DROP POLICY IF EXISTS signatures_public_read ON document_signatures;`;
  await sql`
    CREATE POLICY signatures_public_read ON document_signatures
      FOR SELECT
      USING (codigo_validacao IS NOT NULL);
  `;
  console.log('✅ Política pública de leitura de assinaturas por código aplicada com sucesso!');

  console.log('2. Recriando política de audit_logs para aceitar eventos anônimos (Fail2Ban)...');
  await sql`DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;`;
  await sql`
    CREATE POLICY tenant_isolation_audit_logs ON audit_logs
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR tenant_id IS NULL
      );
  `;
  console.log('✅ Política de audit_logs com suporte a logs anônimos aplicada com sucesso!');

  console.log('3. Registrando migração 032 em schema_migrations...');
  await sql`
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES (
      '032_rls_public_validation_and_audit.sql',
      CURRENT_TIMESTAMP,
      'patch56_rls_public_validation_audit_hotfix',
      0
    )
    ON CONFLICT (version) DO NOTHING;
  `;

  console.log('🎉 Migração 032 aplicada com 100% de sucesso!');
}

run().catch(err => {
  console.error('❌ Falha ao aplicar migração 032:', err);
  process.exit(1);
});
