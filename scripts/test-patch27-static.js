import fs from 'fs';

let failed = 0;
const ok = (name, cond) => {
  if (cond) console.log(`✓ ${name}`);
  else { console.error(`✗ ${name}`); failed++; }
};
const read = p => fs.readFileSync(p, 'utf8');

const pkg = JSON.parse(read('./package.json'));
const version = JSON.parse(read('./version.json'));
const docker = read('./backend/Dockerfile');
const backend = read('./backend/server.js');
const obra = read('./js/obra_detalhe.js');
const events = read('./js/patch26-events.js');
const app = read('./app.html');

console.log('=== Patch 27 — Fonte materializada / build imutável ===\n');

const lifecycle = `${pkg.scripts?.postinstall || ''} ${pkg.scripts?.pretest || ''}`;
ok('package está em 2.27.0 ou superior', Number(String(pkg.version).split('.')[1] || 0) >= 27);
ok('version.json está alinhado com Patch 27', /^2\.(?:2[7-9]|[3-9]\d)\./.test(String(version.version)) && String(version.build).includes('p27'));
ok('npm install/test não executa overlays Patch 22–26', !/(?:apply|prepare)-patch2[2-6]|apply-backend-build-patches/.test(lifecycle));
ok('Docker do Render não aplica git patch em produção', !/git\s+apply|patch22-server\.diff|patch23-server\.diff/.test(docker));
ok('backend materializado contém autenticação QR HttpOnly', backend.includes('signQrAccess') && backend.includes('HttpOnly') && backend.includes("app.get('/status', requireAuth"));
ok('backend materializado contém limites de mídia Patch 23', backend.includes('MAX_MEDIA_BYTES = 8 * 1024 * 1024') && backend.includes('forbiddenMime'));
ok('ObraDetalhe materializado contém bridge Patch 25', obra.includes('FINOBRA_PATCH25_EVENT_BRIDGE'));
ok('bridge global Patch 26 está versionado', events.includes('FINOBRA_PATCH26_EVENT_BRIDGE') && events.includes('const ALLOWED = new Set('));
ok('hotfix lexical do Patch 26 está materializado', events.includes('FINOBRA_PATCH26_LEXICAL_ROOTS_HOTFIX') && events.includes('const ROOTS = Object.freeze({'));
ok('Clientes é resolvido pelo binding lexical antes de globalThis', events.includes("typeof Clientes !== 'undefined' ? Clientes : globalThis[\"Clientes\"]"));
ok('resolver prefere ROOTS allowlisted antes de globalThis', events.includes('Object.prototype.hasOwnProperty.call(ROOTS, parts[0]) ? ROOTS[parts[0]] : globalThis[parts[0]]'));
ok('app carrega bridge global materializado', app.includes('/js/patch26-actions.js') && app.includes('/js/patch26-events.js'));
ok('fonte materializada não usa eval/new Function no bridge global', !/\beval\s*\(|new\s+Function\s*\(/.test(events));
ok('build Cloudflare não depende dos overlays legados', pkg.scripts?.['build:cloudflare'] === 'node scripts/build-cloudflare-pages.cjs');

console.log(`\nPatch 27: ${failed ? 'FALHOU' : 'OK'}\n`);
if (failed) process.exit(1);
