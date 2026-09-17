import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_URL não configurada em .env.local / .env');
  process.exit(1);
}

const sql = neon(conn);

async function run() {
  console.log('=== APLICANDO MIGRAÇÃO 029 (RLS Produção, Data API Revoke, MFA Envelopes) ===');

  // 1. Expansão de coluna
  console.log('1. Expandindo coluna mfa_secret para VARCHAR(255)...');
  await sql`ALTER TABLE usuarios ALTER COLUMN mfa_secret TYPE VARCHAR(255);`;

  // 2. Revogação de acesso da Data API
  console.log('2. Revogando privilégios de authenticated e anonymous na schema public...');
  await sql`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated, anonymous;`;
  await sql`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated, anonymous;`;
  await sql`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated, anonymous;`;
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated, anonymous;`;
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated, anonymous;`;
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated, anonymous;`;

  // 3. Aplicação de RLS em todas as 33 tabelas multi-tenant
  const tbls = [
    'audit_logs',
    'auth_sessions',
    'billing_invoices',
    'billing_notifications_sent',
    'client_error_logs',
    'contas_bancarias',
    'contract_clause_versions',
    'contratos',
    'dev_tenant_keys',
    'document_signatures',
    'documentos',
    'fornecedores',
    'lancamentos',
    'medicoes',
    'notas_fiscais',
    'obra_cadastro_geral',
    'obra_doc_fases',
    'obras',
    'ocr_historico',
    'orcamentos',
    'orcamentos_sinapi',
    'precompras',
    'produtos',
    'recibos',
    'support_conversations',
    'support_messages',
    'tenant_certificates',
    'tenant_patch51_settings',
    'tenant_preferences',
    'tenant_whatsapp_auth',
    'usuarios',
    'workflow_etapas',
    'workflow_historico'
  ];

  console.log(`3. Habilitando RLS e criando políticas de isolamento para ${tbls.length} tabelas...`);
  for (const tbl of tbls) {
    // ENABLE ROW LEVEL SECURITY
    await sql.transaction([
      sql`EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', ${tbl})`,
      sql`EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', ${'tenant_isolation_' + tbl}, ${tbl})`,
      sql`EXECUTE format('
        CREATE POLICY %I ON %I
          FOR ALL
          USING (
            tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')
            OR current_setting(''app.is_system'', true) = ''true''
          )
          WITH CHECK (
            tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')
            OR current_setting(''app.is_system'', true) = ''true''
          );
      ', ${'tenant_isolation_' + tbl}, ${tbl})`
    ]).catch(async () => {
      // Fallback para execução direta
      await sql(`ALTER TABLE ${tbl} ENABLE ROW LEVEL SECURITY;`);
      await sql(`DROP POLICY IF EXISTS tenant_isolation_${tbl} ON ${tbl};`);
      await sql(`
        CREATE POLICY tenant_isolation_${tbl} ON ${tbl}
          FOR ALL
          USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
            OR current_setting('app.is_system', true) = 'true'
          )
          WITH CHECK (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
            OR current_setting('app.is_system', true) = 'true'
          );
      `);
    });
    process.stdout.write('.');
  }
  console.log('\n  ✓ Todas as 33 tabelas configuradas com RLS!');

  // 4. Registro no schema_migrations
  await sql`
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('029_enable_rls_production.sql', CURRENT_TIMESTAMP, 'patch55_rls_data_api_revoke_mfa_enc', 0)
    ON CONFLICT (version) DO UPDATE
      SET applied_at = CURRENT_TIMESTAMP, checksum = 'patch55_rls_data_api_revoke_mfa_enc';
  `;

  console.log('4. Migração registrada com sucesso em schema_migrations.');
  console.log('=== MIGRAÇÃO 029 CONCLUÍDA COM SUCESSO! ===');
}

run().catch(err => {
  console.error('Erro ao aplicar migração 029:', err);
  process.exit(1);
});
