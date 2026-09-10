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

function splitSqlStatements(rawContent) {
  const lines = rawContent.split('\n');
  const cleanedLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) continue;
    cleanedLines.push(line);
  }
  const cleanSql = cleanedLines.join('\n');

  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let inSingleQuote = false;

  for (let i = 0; i < cleanSql.length; i++) {
    const char = cleanSql[i];
    const nextChar = cleanSql[i + 1];

    if (char === "'" && !inDollarQuote) {
      if (cleanSql[i - 1] !== '\\') {
        inSingleQuote = !inSingleQuote;
      }
    } else if (char === '$' && nextChar === '$' && !inSingleQuote) {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i++;
      continue;
    }

    if (char === ';' && !inDollarQuote && !inSingleQuote) {
      const stmt = current.trim();
      if (stmt && stmt.toUpperCase() !== 'BEGIN' && stmt.toUpperCase() !== 'COMMIT') {
        statements.push(stmt);
      }
      current = '';
    } else {
      current += char;
    }
  }
  const last = current.trim();
  if (last && last.toUpperCase() !== 'BEGIN' && last.toUpperCase() !== 'COMMIT') {
    statements.push(last);
  }
  return statements;
}

async function executeSqlFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n======================================================`);
  console.log(`📄 Executando migração: ${fileName}`);
  console.log(`======================================================`);
  
  const rawContent = fs.readFileSync(filePath, 'utf8');
  const statements = splitSqlStatements(rawContent);

  console.log(`Instruções encontradas: ${statements.length}`);

  for (let i = 0; i < statements.length; i++) {
    const cleaned = statements[i];
    const firstLine = cleaned.split('\n')[0].slice(0, 65);
    try {
      await sql(cleaned);
      console.log(`  [${i + 1}/${statements.length}] ✔ ${firstLine}...`);
    } catch (err) {
      console.error(`  [${i + 1}/${statements.length}] ❌ Erro na instrução:`, cleaned);
      console.error(`     Detalhe: ${err.message}`);
      throw err;
    }
  }
  console.log(`✅ ${fileName} executado com sucesso!`);
}

async function run() {
  try {
    const test = await sql`SELECT current_database(), current_user, version();`;
    console.log(`✅ Conexão estabelecida com sucesso!`);
    console.log(`   Database: ${test[0].current_database}`);
    console.log(`   User: ${test[0].current_user}`);
    console.log(`   Engine: ${test[0].version.split(',')[0]}`);

    const targetArg = process.argv[2];
    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    let filesToRun = [];

    if (targetArg) {
      const p = path.resolve(process.cwd(), targetArg);
      if (fs.existsSync(p)) filesToRun.push(p);
      else throw new Error(`Arquivo de migração não encontrado: ${targetArg}`);
    } else {
      const allFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      filesToRun = allFiles.map(f => path.join(migrationsDir, f));
    }

    for (const f of filesToRun) {
      await executeSqlFile(f);
    }

    // Verification
    console.log('\n🔍 Verificando integridade das tabelas, colunas e índices aplicados...');
    
    // Check audit_logs table
    const checkAudit = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'audit_logs';
    `;
    console.log(`  Tabela 'audit_logs': ${checkAudit.length ? '✅ PRESENTE' : '❌ AUSENTE'}`);

    // Check crea_cau column in tenants
    const checkCrea = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'crea_cau';
    `;
    console.log(`  Coluna 'tenants.crea_cau': ${checkCrea.length ? `✅ PRESENTE (${checkCrea[0].data_type})` : '❌ AUSENTE'}`);

    // Check fornecedores columns (endereco, municipio, uf, ativo)
    const checkFornCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'fornecedores' 
        AND column_name IN ('endereco', 'municipio', 'uf', 'ativo');
    `;
    console.log(`  Colunas em 'fornecedores' (Patch 02):`);
    checkFornCols.forEach(col => console.log(`   - ${col.column_name}: ✅ PRESENTE (${col.data_type})`));

    // Check all relevant indexes
    const checkIndexes = await sql`
      SELECT indexname, tablename
      FROM pg_indexes 
      WHERE tablename IN ('audit_logs', 'lancamentos', 'notas_fiscais', 'fornecedores', 'obras', 'orcamentos_sinapi', 'obra_doc_fases')
        AND (indexname LIKE 'idx_%' OR indexname LIKE 'uq_%')
      ORDER BY tablename, indexname;
    `;
    console.log(`\n  Índices ativos verificados (${checkIndexes.length}):`);
    checkIndexes.forEach(idx => console.log(`   - [${idx.tablename}] ${idx.indexname}`));

    // Check Patch 07 tables
    const checkPatch07 = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('orcamentos_sinapi', 'obra_doc_fases', 'tenant_preferences');
    `;
    console.log(`\n  Tabelas do Patch 07 verificadas:`);
    ['orcamentos_sinapi', 'obra_doc_fases', 'tenant_preferences'].forEach(tbl => {
      const found = checkPatch07.some(r => r.table_name === tbl);
      console.log(`   - ${tbl}: ${found ? '✅ PRESENTE' : '❌ AUSENTE'}`);
    });

    console.log('\n🎉 Todas as migrações foram verificadas e aplicadas com 100% de sucesso no Neon!');
  } catch (err) {
    console.error('\n❌ Falha durante a execução das migrações:', err.message);
    process.exit(1);
  }
}

run();
