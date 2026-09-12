// Build-time overlay for Patch 24 — XSS + spreadsheet hardening.
// Idempotent: applies once and accepts an already-applied working tree.
const { spawnSync } = require('child_process');
const path = require('path');

const root = __dirname;
const patch = path.join(root, '.patch24/frontend-xss.diff');

function run(args) {
  return spawnSync('git', ['apply', '--recount', ...args, patch], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

const check = run(['--check']);
if (check.status === 0) {
  const applied = run([]);
  if (applied.status !== 0) {
    console.error(applied.stderr || applied.stdout || '[Patch24] falha ao aplicar patch.');
    process.exit(applied.status || 1);
  }
  console.log('[Patch24] XSS/planilha aplicado.');
  process.exit(0);
}

const reverse = run(['--reverse', '--check']);
if (reverse.status === 0) {
  console.log('[Patch24] já aplicado.');
  process.exit(0);
}

console.error('[Patch24] patch incompatível com a árvore atual.');
console.error(check.stderr || check.stdout || 'git apply --check falhou');
process.exit(1);
