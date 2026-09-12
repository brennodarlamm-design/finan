import { spawnSync } from 'child_process';
import fs from 'fs';
const tests = [
  'scripts/test-hardening-static.js',
  'scripts/test-patch02-static.js',
  'scripts/test-patch03-static.js',
  'scripts/test-patch04-static.js',
  'scripts/test-patch05-static.js',
  'scripts/test-patch06-static.js',
  'scripts/test-patch07-static.js',
  'scripts/test-patch08-static.js',
  'scripts/test-patch09-static.js',
  'scripts/test-patch10-static.js',
  'scripts/test-patch11-static.js',
  'scripts/test-patch12-static.js',
  'scripts/test-patch13-static.js',
  'scripts/test-patch14-static.js',
  'scripts/test-patch15-static.js',
  'scripts/test-patch16-static.js',
  'scripts/test-patch17-static.js',
  'scripts/test-patch18-static.js',
  'scripts/test-patch19-static.js',
  'scripts/test-patch20-static.js',
  'scripts/test-patch21-static.js',
  'scripts/test-openai-static.js',
  'scripts/test-patch22-static.js',
  'scripts/test-patch23-static.js',
  'scripts/test-patch24-static.js',
  'scripts/test-patch25-static.js'
].filter(fs.existsSync);
for (const file of tests) {
  console.log(`\n=== ${file} ===`);
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log('\n✅ Todas as verificações estáticas passaram.');
