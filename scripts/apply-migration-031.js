import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { neon } from '@neondatabase/serverless';

// Migrações DDL e criação de roles devem rodar via DATABASE_OWNER_URL
const conn = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_OWNER_URL ou DATABASE_URL não configurada.');
  process.exit(1);
}

const sql = neon(conn);

async function run() {
  console.log('=== APLICANDO MIGRAÇÃO 031 (RLS Estrito, FORCE RLS, Least Privilege finobra_app) ===');

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

  console.log(`1. Aplicando FORCE RLS e recriando políticas estritas em ${tbls.length} tabelas multi-tenant...`);

  for (const tbl of tbls) {
    await sql(`ALTER TABLE "${tbl}" ENABLE ROW LEVEL SECURITY;`);
    await sql(`ALTER TABLE "${tbl}" FORCE ROW LEVEL SECURITY;`);
    await sql(`DROP POLICY IF EXISTS "tenant_isolation_${tbl}" ON "${tbl}";`);
    await sql(`
      CREATE POLICY "tenant_isolation_${tbl}" ON "${tbl}"
        FOR ALL
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
    `);
    process.stdout.write('.');
  }
  console.log('\n✅ Políticas RLS estritas (sem bypass app.is_system) e FORCE RLS aplicadas com sucesso!');

  console.log('2. Verificando/Criando role finobra_app com NOBYPASSRLS...');
  const roleCheck = await sql`SELECT rolname FROM pg_roles WHERE rolname = 'finobra_app'`;
  if (!roleCheck.length) {
    // Cria role com login e sem privilégios de bypass
    await sql`CREATE ROLE finobra_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;`;
    console.log('✅ Role finobra_app criado.');
  } else {
    await sql`ALTER ROLE finobra_app WITH NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;`;
    console.log('✅ Role finobra_app atualizado com restrições de menor privilégio.');
  }

  console.log('3. Configurando GRANTs de Menor Privilégio para finobra_app...');
  await sql`GRANT USAGE ON SCHEMA public TO finobra_app;`;
  await sql`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO finobra_app;`;

  // Limpa baseline
  await sql`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM finobra_app;`;

  // Tabelas de referência (Somente Leitura)
  await sql`GRANT SELECT ON bases_referenciais, itens_referenciais TO finobra_app;`;

  // Tabelas de segurança / Fail2Ban
  await sql`GRANT SELECT ON security_ip_allowlist TO finobra_app;`;
  await sql`GRANT SELECT, INSERT, UPDATE ON security_ip_state TO finobra_app;`;
  await sql`GRANT SELECT, INSERT ON security_ip_events TO finobra_app;`;

  // Rate limit, solicitações e auditoria
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON api_rate_limits TO finobra_app;`;
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON recuperacao_senhas TO finobra_app;`;
  await sql`GRANT SELECT, INSERT, UPDATE ON access_requests TO finobra_app;`;
  await sql`GRANT SELECT, INSERT ON tenant_integrity_audit TO finobra_app;`;

  // Tenants: Leitura e Atualização controlada (sem exclusão)
  await sql`GRANT SELECT, UPDATE ON tenants TO finobra_app;`;

  // 33 tabelas multi-tenant: CRUD controlado por RLS
  for (const tbl of tbls) {
    await sql(`GRANT SELECT, INSERT, UPDATE, DELETE ON "${tbl}" TO finobra_app;`);
  }
  console.log('✅ Menor privilégio configurado para finobra_app (sem acesso a schema_migrations).');

  console.log('4. Registrando migração 031 em schema_migrations...');
  await sql`
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES (
      '031_strict_rls_least_privilege.sql',
      CURRENT_TIMESTAMP,
      'patch56_strict_rls_least_privilege_v1',
      0
    )
    ON CONFLICT (version) DO NOTHING;
  `;

  console.log('🎉 Migração 031 aplicada com 100% de sucesso!');
}

run().catch((err) => {
  console.error('❌ Falha ao aplicar migração 031:', err);
  process.exit(1);
});
