// Build-time overlay for Patch 22.
// Idempotent: applies each diff once and accepts an already-applied working tree.
const { spawnSync } = require('child_process');
const path = require('path');

const root = __dirname;
const full = process.argv.includes('--full');

const patches = [
  { file: '.patch22/01_auth_admin.diff', include: [] },
  { file: '.patch22/02_db_backend.diff', include: ['api/db.js', 'api/users.js', 'app.html'] },
  { file: '.patch22/03_frontend_schema.diff', include: [] }
];
if (full) patches.push({ file: '.patch22/04_migrations_tests.diff', include: [] });

function gitApply(args) {
  return spawnSync('git', ['apply', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function argsFor(entry, mode = 'check') {
  const args = [];
  if (mode === 'reverse-check') args.push('--reverse', '--check');
  else if (mode === 'check') args.push('--check');
  for (const file of entry.include) args.push(`--include=${file}`);
  args.push(path.join(root, entry.file));
  return args;
}

for (const entry of patches) {
  const check = gitApply(argsFor(entry, 'check'));
  if (check.status === 0) {
    const apply = gitApply(argsFor(entry, 'apply'));
    if (apply.status !== 0) {
      console.error(apply.stderr || apply.stdout || `Falha ao aplicar ${entry.file}`);
      process.exit(apply.status || 1);
    }
    console.log(`[Patch22] aplicado: ${entry.file}`);
    continue;
  }

  const reverse = gitApply(argsFor(entry, 'reverse-check'));
  if (reverse.status === 0) {
    console.log(`[Patch22] já aplicado: ${entry.file}`);
    continue;
  }

  console.error(`[Patch22] não foi possível aplicar ${entry.file}.`);
  console.error(check.stderr || check.stdout || 'git apply --check falhou');
  process.exit(1);
}
