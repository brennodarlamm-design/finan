// Reproduz no npm test o mesmo pipeline de hardening executado pelo Dockerfile do Render.
// Idempotente: aplica Patch 22 e Patch 23 uma vez, na mesma ordem da imagem de produção.
const { spawnSync } = require('child_process');
const path = require('path');

const backendDir = path.resolve(__dirname, '..', 'backend');
const patches = ['patch22-server.diff', 'patch23-server.diff'];

function gitApply(args) {
  return spawnSync('git', ['apply', ...args], {
    cwd: backendDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

for (const patch of patches) {
  const check = gitApply(['--check', '-p2', patch]);
  if (check.status === 0) {
    const apply = gitApply(['-p2', patch]);
    if (apply.status !== 0) {
      console.error(apply.stderr || apply.stdout || `[Backend build] falha ao aplicar ${patch}`);
      process.exit(apply.status || 1);
    }
    console.log(`[Backend build] aplicado: ${patch}`);
    continue;
  }

  const reverse = gitApply(['--reverse', '--check', '-p2', patch]);
  if (reverse.status === 0) {
    console.log(`[Backend build] já aplicado: ${patch}`);
    continue;
  }

  console.error(`[Backend build] ${patch} é incompatível com backend/server.js atual.`);
  console.error(check.stderr || check.stdout || 'git apply --check falhou');
  process.exit(1);
}

const syntax = spawnSync(process.execPath, ['--check', path.join(backendDir, 'server.js')], {
  cwd: backendDir,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});
if (syntax.status !== 0) {
  console.error('[Backend build] server.js inválido após hardening.');
  console.error(syntax.stderr || syntax.stdout || 'node --check falhou');
  process.exit(syntax.status || 1);
}
console.log('[Backend build] pipeline Render reproduzido e sintaxe validada.');
