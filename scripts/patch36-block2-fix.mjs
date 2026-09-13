import fs from 'fs';

const path = 'scripts/patch36-block2.mjs';
let source = fs.readFileSync(path, 'utf8');
const before = "\\`${p.label||'Plano'} • \\${p.status||'ativo'}";
const after = "\\`\\${p.label||'Plano'} • \\${p.status||'ativo'}";
if (!source.includes(before)) {
  if (source.includes(after)) {
    console.log('Patch36 block2 template já corrigido.');
    process.exit(0);
  }
  throw new Error('Trecho de template do status do plano não encontrado.');
}
source = source.replace(before, after);
fs.writeFileSync(path, source, 'utf8');
console.log('Patch36 block2: interpolação interna escapada corretamente.');
