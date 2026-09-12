import fs from 'fs';

let failed = 0;
const ok = (name, cond) => {
  if (cond) console.log(`✓ ${name}`);
  else { console.error(`✗ ${name}`); failed++; }
};

const bridge = fs.readFileSync('js/patch26-events.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

console.log('=== Patch 26.1 — lexical-root button hotfix ===');
ok('bridge contém hotfix de raízes léxicas', bridge.includes('FINOBRA_PATCH26_LEXICAL_ROOTS_HOTFIX'));
ok('bridge registra tabela ROOTS', bridge.includes('const ROOTS = Object.freeze'));
ok('Clientes const é resolvido por identificador léxico', bridge.includes("typeof Clientes !== 'undefined' ? Clientes"));
ok('resolver usa ROOTS antes de globalThis', bridge.includes("Object.prototype.hasOwnProperty.call(ROOTS, parts[0]) ? ROOTS[parts[0]] : globalThis[parts[0]]"));
ok('hotfix não usa eval/new Function', !/\beval\s*\(|new\s+Function\s*\(/.test(bridge));
ok('postinstall executa hotfix depois do Patch 26', String(pkg.scripts?.postinstall || '').includes('apply-patch26-build.cjs && node fix-patch26-lexical-roots.cjs'));
ok('pretest executa hotfix depois do Patch 26', String(pkg.scripts?.pretest || '').includes('apply-patch26-build.cjs && node fix-patch26-lexical-roots.cjs'));

console.log(`\nPatch 26.1: ${failed ? 'FALHOU' : 'OK'}`);
if (failed) process.exit(1);
