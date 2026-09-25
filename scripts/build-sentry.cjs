// scripts/build-sentry.cjs — Build isolado do bundle Sentry Browser com injeção de Release
const esbuild = require('esbuild');
const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
let commit = 'unknown';
try {
  commit = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
} catch {}

esbuild.buildSync({
  entryPoints: [path.join(root, 'scripts', 'sentry-entry.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'FinGoSentry',
  outfile: path.join(root, 'js', 'sentry.js'),
  define: {
    '__SENTRY_RELEASE__': JSON.stringify(commit)
  }
});
console.log(`[Sentry] Bundle gerado com release: ${commit}`);
