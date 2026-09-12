import fs from 'fs';

let failed = 0;
const ok = (name, cond) => {
  if (cond) console.log(`✓ ${name}`);
  else { console.error(`✗ ${name}`); failed++; }
};

const exists = p => fs.existsSync(p);
const read = p => fs.readFileSync(p, 'utf8');
const pkg = JSON.parse(read('./package.json'));
const docker = read('./backend/Dockerfile');
const vercelIgnore = read('./.vercelignore');

console.log('=== Patch 28 — limpeza estrutural ===\n');

const dead = [
  '.patch22', '.patch23', '.patch24',
  'apply-patch22-build.cjs', 'apply-patch23-build.cjs', 'apply-patch24-build.cjs',
  'prepare-patch25-build.cjs', 'apply-patch25-build.cjs',
  'prepare-patch26-complex.cjs', 'prepare-patch26-final.cjs', 'apply-patch26-build.cjs',
  'fix-patch26-lexical-roots.cjs',
  'backend/patch22-server.diff', 'backend/patch23-server.diff',
  'scripts/apply-backend-build-patches.cjs'
];

ok('overlays e transformadores legados foram removidos', dead.every(p => !exists(p)));
ok('lifecycle npm não referencia overlays', !/(apply|prepare)-patch2[2-6]|apply-backend-build-patches|fix-patch26-lexical-roots/.test(`${pkg.scripts?.postinstall || ''} ${pkg.scripts?.pretest || ''}`));
ok('.vercelignore não reinclui patches legados', !/\.patch2[2-4]|apply-patch2[2-6]|prepare-patch2[5-6]/.test(vercelIgnore));
ok('build Cloudflare continua disponível na Vercel quando necessário', vercelIgnore.includes('!scripts/build-cloudflare-pages.cjs'));
ok('Docker não instala git nem aplica patches', !/\bgit\b|git\s+apply/.test(docker));
ok('Docker usa instalação determinística pelo lockfile', docker.includes('npm ci --omit=dev'));
ok('lockfile raiz existe', exists('package-lock.json'));
ok('lockfile do backend existe', exists('backend/package-lock.json'));

console.log(`\nPatch 28: ${failed ? 'FALHOU' : 'OK'}\n`);
if (failed) process.exit(1);
