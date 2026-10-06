// scripts/build-sentry.cjs — Build isolado do bundle Sentry Browser com injeção de Release
const esbuild = require('esbuild');
const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
let commit = 'unknown';
try {
  commit = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
} catch {}

const opcoes = {
  bundle: true,
  minify: true,
  sourcemap: true,
  format: 'iife',
  define: {
    '__SENTRY_RELEASE__': JSON.stringify(commit)
  }
};
esbuild.buildSync({ ...opcoes, entryPoints: [path.join(root, 'scripts', 'sentry-entry.js')], globalName: 'FinGoSentry', outfile: path.join(root, 'js', 'sentry.js') });
// AUDITORIA 2026-10-04 #35: Replay separado, carregado sob demanda no app e no master.
esbuild.buildSync({ ...opcoes, entryPoints: [path.join(root, 'scripts', 'sentry-replay-entry.js')], outfile: path.join(root, 'js', 'sentry-replay.js') });
const fs = require('fs');
for (const f of ['sentry.js', 'sentry-replay.js']) {
  try {
    fs.copyFileSync(path.join(root, 'js', f), path.join(root, 'frontend', 'core', f));
  } catch {}
}
console.log(`[Sentry] Bundle gerado com release: ${commit}`);
