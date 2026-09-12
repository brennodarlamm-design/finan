// scripts/run-migration.js — Migration Runner Transacional com Controle em schema_migrations

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

async function ensureSchemaMigrationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(64) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64),
      execution_time_ms INTEGER DEFAULT 0
    );
  `;
}

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
      if (stmt) {
        statements.push(stmt);
      }
      current = '';
    } else {
      current += char;
    }
  }
  const last = current.trim();
  if (last) {
    statements.push(last);
  }
  return statements;
}

async function executeSqlFile(filePath, isManualTarget = false) {
  const fileName = path.basename(filePath);
  const rawContent = fs.readFileSync(filePath, 'utf8');
  const checksum = calculateChecksum(rawContent);

  // Verifica se já foi aplicada
  const existing = await sql`
    SELECT version, applied_at, checksum 
    FROM schema_migrations 
    WHERE version = ${fileName} 
    LIMIT 1;
  `;

  if (existing.length > 0 && !isManualTarget) {
    const previousChecksum = String(existing[0].checksum || '');
    const isBaseline = previousChecksum.startsWith('baseline_');
    const isHashChecksum = /^[0-9a-f]{16}$/i.test(previousChecksum);
    if (isHashChecksum && !isBaseline && previousChecksum !== checksum) {
      throw new Error(`Checksum divergente para ${fileName}. A migration aplicada não deve ser alterada; crie uma nova migration.`);
    }
    console.log(`⏩ [PULADA] ${fileName} (já aplicada em ${new Date(existing[0].applied_at).toLocaleString('pt-BR')})`);
    return false;
  }

  console.log(`\n======================================================`);
  console.log(`📄 Executando migração: ${fileName} [checksum: ${checksum}]`);
  console.log(`======================================================`);

  const statements = splitSqlStatements(rawContent);
  console.log(`Instruções a executar: ${statements.length}`);

  const startMs = Date.now();
  const durationForRegistry = 0; // atualizado logo após a transação em uma query curta

  // Neon HTTP suporta transações não interativas: todas as instruções são
  // confirmadas juntas ou integralmente revertidas pelo PostgreSQL.
  // O registro da migration participa da MESMA transação, evitando schema
  // parcialmente aplicado sem linha correspondente em schema_migrations.
  try {
    await sql.transaction(txn => [
      ...statements.map(statement => txn(statement)),
      txn`
        INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
        VALUES (${fileName}, CURRENT_TIMESTAMP, ${checksum}, ${durationForRegistry})
        ON CONFLICT (version) DO UPDATE SET
          applied_at = CURRENT_TIMESTAMP,
          checksum = EXCLUDED.checksum,
          execution_time_ms = EXCLUDED.execution_time_ms
      `
    ]);
  } catch (err) {
    console.error(`  ❌ ${fileName} foi revertida integralmente pelo PostgreSQL.`);
    console.error(`     Detalhe: ${err.message}`);
    throw err;
  }

  const durationMs = Date.now() - startMs;
  // Tempo de execução é telemetria; atualizar depois não altera o schema.
  await sql`UPDATE schema_migrations SET execution_time_ms=${durationMs} WHERE version=${fileName};`;
  statements.forEach((statement, i) => {
    const firstLine = statement.split('\n')[0].slice(0, 65);
    console.log(`  [${i + 1}/${statements.length}] ✔ ${firstLine}...`);
  });

  console.log(`✅ ${fileName} executado atomicamente em ${durationMs}ms e registrado em schema_migrations!`);
  return true;
}

async function run() {
  try {
    const test = await sql`SELECT current_database(), current_user, version();`;
    console.log(`✅ Conexão estabelecida com sucesso!`);
    console.log(`   Database: ${test[0].current_database}`);
    console.log(`   User: ${test[0].current_user}`);
    console.log(`   Engine: ${test[0].version.split(',')[0]}`);

    await ensureSchemaMigrationsTable();

    const targetArg = process.argv[2];
    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    let filesToRun = [];

    if (targetArg) {
      const p = path.resolve(process.cwd(), targetArg);
      if (fs.existsSync(p)) filesToRun.push(p);
      else throw new Error(`Arquivo de migração não encontrado: ${targetArg}`);
      await executeSqlFile(filesToRun[0], true);
    } else {
      const allFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      filesToRun = allFiles.map(f => path.join(migrationsDir, f));
      for (const f of filesToRun) {
        await executeSqlFile(f, false);
      }
    }

    // Validação final de schema_migrations
    const count = await sql`SELECT COUNT(*) FROM schema_migrations;`;
    console.log(`\n🎉 Governança de migrações ativa: ${count[0].count} registro(s) em schema_migrations!`);
  } catch (err) {
    console.error('\n❌ Falha durante a execução das migrações:', err.message);
    process.exit(1);
  }
}

run();
