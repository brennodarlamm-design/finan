import fs from 'fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Patch 41: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

const migrationSql = fs.readFileSync('migrations/018_indexes_performance_pagination.sql', 'utf8');
const dbJs = fs.readFileSync('api/db.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = JSON.parse(fs.readFileSync('version.json', 'utf8'));

console.log('=== Patch 41 — Índices PostgreSQL, Filtros de Performance e Paginação no Neon ===\n');

// 1. Migração 018 e Índices Compostos B-Tree de Alta Performance
assert(
  migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant_data_desc') &&
  migrationSql.includes('ON lancamentos (tenant_id, data DESC, created_at DESC, id DESC)'),
  'Migração 018 cria índice composto temporal decrescente para lançamentos.'
);

assert(
  migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant_obra_data_desc') &&
  migrationSql.includes('ON lancamentos (tenant_id, obra_id, data DESC, created_at DESC, id DESC)'),
  'Migração 018 cria índice composto por tenant, obra e data decrescente para lançamentos.'
);

assert(
  migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant_tipo_data') &&
  migrationSql.includes('ON lancamentos (tenant_id, tipo, data DESC)'),
  'Migração 018 cria índice para filtro rápido por tipo (receita/despesa).'
);

assert(
  migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_notas_tenant_emissao_desc') &&
  migrationSql.includes('ON notas_fiscais (tenant_id, data_emissao DESC, created_at DESC, id DESC)'),
  'Migração 018 cria índice composto por emissão decrescente para notas fiscais.'
);

assert(
  migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_notas_tenant_obra_emissao') &&
  migrationSql.includes('ON notas_fiscais (tenant_id, obra_id, data_emissao DESC)'),
  'Migração 018 cria índice composto por tenant, obra e data de emissão para notas.'
);

assert(
  migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_documentos_tenant_created_desc') &&
  migrationSql.includes('ON documentos (tenant_id, created_at DESC, id DESC)'),
  'Migração 018 cria índice composto por data de upload decrescente para documentos.'
);

assert(
  migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_documentos_tenant_tipo_ref') &&
  migrationSql.includes('ON documentos (tenant_id, tipo, referencia_id)'),
  'Migração 018 cria índice por tipo e referência de documento para buscas de anexos.'
);

assert(
  migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created') &&
  migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_client_error_logs_tenant_created'),
  'Migração 018 cria índices temporais para logs de auditoria e erros de cliente.'
);

assert(
  migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_tenants_status_vencimento') &&
  migrationSql.includes('ON tenants (status, vencimento)'),
  'Migração 018 cria índice composto por status e vencimento para o faturamento SaaS.'
);

assert(
  migrationSql.includes("INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)") &&
  migrationSql.includes("'018_indexes_performance_pagination.sql'"),
  'Migração 018 registra versão em schema_migrations usando applied_at.'
);

// 2. Filtros Temporais e Paginação em api/db.js
assert(
  dbJs.includes('req.query.data_inicio') && dbJs.includes('req.query.data_fim'),
  'api/db.js aceita parâmetros data_inicio e data_fim para consultas filtradas.'
);

assert(
  dbJs.includes('req.query.tipo') && dbJs.includes('filterTipo'),
  'api/db.js aceita filtro por tipo em lançamentos.'
);

assert(
  dbJs.includes('function parsePagination') && dbJs.includes('function pageResponse'),
  'api/db.js implementa analisador seguro de paginação e envelope de resposta padronizado.'
);

assert(
  dbJs.includes('LIMIT ${pagination.limit} OFFSET ${pagination.offset}'),
  'api/db.js aplica LIMIT e OFFSET parametrizados no PostgreSQL.'
);

assert(
  dbJs.includes('(${dataInicio}::date IS NULL OR data >= ${dataInicio}::date)') &&
  dbJs.includes('(${dataFim}::date IS NULL OR data <= ${dataFim}::date)'),
  'api/db.js preserva compatibilidade retroativa quando filtros de data não são informados.'
);

// 3. Versionamento e Pacote
assert(pkg.scripts?.['test:patch41'] === 'node scripts/test-patch41-static.js', 'package.json expõe comando test:patch41.');
assert(pkg.version >= '2.30.0', 'package.json está na versão >= 2.30.0.');
assert(version.version >= '2.30.0', 'version.json está na versão >= 2.30.0.');
assert(/-p(41|[4-9]\d|\d{3,})\b/.test(version.build || ''), 'version.json registra build com sufixo >= -p41.');

console.log('\n🎉 Patch 41: todas as 18 verificações passaram com 100% de sucesso!');
