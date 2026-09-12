// Build-time security overlay for FinObra Patch 23.
// Runs after Patch 22. Idempotent and safe for Vercel install/test builds.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const patchFile = path.join(root, '.patch23/root-security.diff');

function gitApply(args) {
  return spawnSync('git', ['apply', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function applyIdempotentPatch(file) {
  const check = gitApply(['--check', file]);
  if (check.status === 0) {
    const apply = gitApply([file]);
    if (apply.status !== 0) {
      console.error(apply.stderr || apply.stdout || `Falha ao aplicar ${file}`);
      process.exit(apply.status || 1);
    }
    console.log(`[Patch23] aplicado: ${path.relative(root, file)}`);
    return;
  }
  const reverse = gitApply(['--reverse', '--check', file]);
  if (reverse.status === 0) {
    console.log(`[Patch23] já aplicado: ${path.relative(root, file)}`);
    return;
  }
  console.error(`[Patch23] não foi possível aplicar ${path.relative(root, file)}.`);
  console.error(check.stderr || check.stdout || 'git apply --check falhou');
  process.exit(1);
}

applyIdempotentPatch(patchFile);

// CORS: não aceitar qualquer projeto *.vercel.app. Apenas o projeto FinObra.
const apiDir = path.join(root, 'api');
const corsReplacement = "/^https:\\/\\/finan-as(?:-[a-z0-9-]+)?\\.vercel\\.app$/i.test(origin)";
for (const name of fs.readdirSync(apiDir)) {
  if (!name.endsWith('.js')) continue;
  const file = path.join(apiDir, name);
  const before = fs.readFileSync(file, 'utf8');
  const after = before
    .split("origin.endsWith('.vercel.app')").join(corsReplacement)
    .split('origin.endsWith(".vercel.app")').join(corsReplacement);
  if (after !== before) {
    fs.writeFileSync(file, after);
    console.log(`[Patch23] CORS restrito: api/${name}`);
  }
}
