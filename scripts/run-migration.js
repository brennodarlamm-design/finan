import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...v] = trimmed.split('=');
      const val = v.join('=').trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k.trim()]) {
        process.env[k.trim()] = val;
      }
    }
  }
}

loadEnv();

const dbUrl = (process.env.DATABASE_URL || '').trim();
if (!dbUrl) {
  console.error('❌ DATABASE_URL não encontrada no arquivo .env.local.');
  process.exit(1);
}

console.log('🚀 Conectando ao Lakebase Postgres (Neon)...');
const sql = neon(dbUrl);

async function run() {
  try {
    const test = await sql`SELECT current_database(), current_user, version();`;
    console.log(`✅ Conexão estabelecida com sucesso!`);
    console.log(`   Database: ${test[0].current_database}`);
    console.log(`   User: ${test[0].current_user}`);
    console.log(`   Engine: ${test[0].version.split(',')[0]}\n`);

    const migrationPath = path.resolve(process.cwd(), 'migrations/001_saas_hardening.sql');
    const rawContent = fs.readFileSync(migrationPath, 'utf8');

    // Strip line comments safely
    const cleanedContent = rawContent.replace(/--.*$/gm, '');
    const statements = cleanedContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📄 Executando ${statements.length} instruções de migração...\n`);

    for (let i = 0; i < statements.length; i++) {
      const cleaned = statements[i];
      const firstLine = cleaned.split('\n')[0].slice(0, 65);
      try {
        await sql(cleaned);
        console.log(`  [${i + 1}/${statements.length}] ✔ ${firstLine}...`);
      } catch (retryErr) {
        console.error(`  [${i + 1}/${statements.length}] ❌ Erro na instrução:`, cleaned);
        console.error(`     Detalhe: ${retryErr.message}`);
        throw retryErr;
      }
    }

    // 3. Verification
    console.log('\n🔍 Verificando integridade das tabelas e colunas aplicadas...');
    
    const checkAudit = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'audit_logs';
    `;
    console.log(`  Tabela 'audit_logs': ${checkAudit.length ? '✅ PRESENTE' : '❌ AUSENTE'}`);

    const checkCrea = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'crea_cau';
    `;
    console.log(`  Coluna 'tenants.crea_cau': ${checkCrea.length ? `✅ PRESENTE (${checkCrea[0].data_type})` : '❌ AUSENTE'}`);

    const checkIndexes = await sql`
      SELECT indexname, tablename
      FROM pg_indexes 
      WHERE tablename IN ('audit_logs', 'lancamentos', 'notas_fiscais', 'fornecedores')
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `;
    console.log(`\n  Índices ativos verificados (${checkIndexes.length}):`);
    checkIndexes.forEach(idx => console.log(`   - [${idx.tablename}] ${idx.indexname}`));

    console.log('\n🎉 Migração 001_saas_hardening.sql executada com 100% de sucesso no Neon!');
  } catch (err) {
    console.error('\n❌ Falha durante a execução da migração:', err.message);
    process.exit(1);
  }
}

run();
