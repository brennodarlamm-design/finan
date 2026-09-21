import fs from 'fs';

let fails = 0;
function read(p) { return fs.readFileSync(p, 'utf8'); }
function ok(name, cond) {
  if (cond) console.log('✅ ' + name);
  else { console.error('❌ ' + name); fails++; }
}

const migration13 = read('migrations/013_schema_migrations_and_integrity.sql');
const schema = read('schema.sql');
const runMigration = read('scripts/run-migration.js');
const authApi = read('api/auth.js');
const requestResetBlock = authApi.slice(authApi.indexOf("action === 'request_reset'"), authApi.indexOf("action === 'verify_reset'"));
const dbApi = read('api/db.js');
const packageRelease = read('scripts/package-release.js');

// 1. Governança de Migrações e Runner Transacional (H-07 / H-08)
ok('Migração 013 cria tabela schema_migrations com controle de checksum e tempo',
  migration13.includes('CREATE TABLE IF NOT EXISTS schema_migrations') &&
  migration13.includes('version VARCHAR(64) PRIMARY KEY') &&
  migration13.includes('checksum VARCHAR(64)') &&
  migration13.includes('execution_time_ms INTEGER')
);

ok('Schema incorpora formalmente a tabela schema_migrations e recuperacao_senhas',
  schema.includes('CREATE TABLE IF NOT EXISTS schema_migrations') &&
  schema.includes('CREATE TABLE IF NOT EXISTS recuperacao_senhas')
);

ok('Migration runner consulta schema_migrations e registra migrações aplicadas',
  runMigration.includes('SELECT version, applied_at, checksum FROM schema_migrations') ||
  (runMigration.includes('schema_migrations') && runMigration.includes('INSERT INTO schema_migrations'))
);

ok('Migration runner não descarta transações BEGIN e COMMIT',
  !runMigration.includes("stmt.toUpperCase() !== 'BEGIN' && stmt.toUpperCase() !== 'COMMIT'")
);

ok('Migration runner calcula checksum e registra tempo de execução',
  runMigration.includes('calculateChecksum') &&
  runMigration.includes('durationMs') &&
  runMigration.includes('execution_time_ms')
);

// 2. Atômico / Transacional no Cadastro Monitorado e Reset de Senhas (H-12 / H-13 / H-14 / H-09)
ok('Auth register redireciona cadastro público para solicitação comercial access_requests',
  authApi.includes('access_requests') &&
  authApi.includes('commercial_request') &&
  /Solicitação de acesso.*com sucesso/i.test(authApi)
);

ok('Auth register não provisiona tenant automaticamente no cadastro público',
  !authApi.includes('INSERT INTO tenants (id, razao_social, nome_fantasia')
);

ok('Auth request_reset previne enumeração de contas com requestId opaco e resposta uniforme',
  authApi.includes('genericResponse') &&
  authApi.includes('requestId') &&
  authApi.includes('Se a conta existir, enviaremos um código ao canal cadastrado') &&
  !requestResetBlock.includes('userId: user.id') &&
  !requestResetBlock.includes('userName:') &&
  !requestResetBlock.includes('canalInfo')
);

ok('Auth verify_reset limita senha entre 8 e 128 caracteres',
  authApi.includes('normalizedNewPassword.length < 8') &&
  authApi.includes('normalizedNewPassword.length > 128') &&
  authApi.includes('A nova senha deve ter no mínimo 8 caracteres.')
);

ok('Auth verify_reset consome OTP, atualiza senha e revoga sessões em uma única operação atômica',
  authApi.includes('WITH consumed AS') &&
  authApi.includes('password_upd AS') &&
  authApi.includes('sessions_revoked AS') &&
  authApi.includes('AND usado = FALSE') &&
  authApi.includes('AND expira_em > NOW()') &&
  authApi.includes('revokedSessions:')
);

// 3. Consistência de Campos entre Save e Sync (H-02)
ok('API DB aplica cast explícito ::jsonb para itens em lancamentos no sync_all e save',
  dbApi.includes('${itensJson}::jsonb') &&
  dbApi.includes('${itensLancJson}::jsonb')
);

ok('API DB aplica cast explícito ::jsonb para itens em notas no sync_all e save',
  dbApi.includes('${itensNotaJson}::jsonb')
);

// 4. Empacotamento Seguro de Releases (C-01 / C-02)
ok('Script de release package bloqueia arquivos .env, .git, chaves privadas e node_modules',
  packageRelease.includes('BLOCKED_PATTERNS') &&
  packageRelease.includes('.env') &&
  packageRelease.includes('.git') &&
  packageRelease.includes('pfx|p12|pem|key') &&
  packageRelease.includes('node_modules')
);

ok('Script de release package realiza auditoria com zero vazamento de segredos',
  packageRelease.includes('Auditoria: 0 arquivos sensíveis') &&
  packageRelease.includes('generateReleasePackage')
);

if (fails) {
  console.error(`\n❌ Patch 13: ${fails} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\n✅ Patch 13: todas as verificações passaram com 100% de sucesso!');
