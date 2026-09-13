import fs from 'fs';

const path = 'scripts/patch36-block2.mjs';
let source = fs.readFileSync(path, 'utf8');

const beforeStatus = "\\`${p.label||'Plano'} • \\${p.status||'ativo'}";
const afterStatus = "\\`\\${p.label||'Plano'} • \\${p.status||'ativo'}";
if (source.includes(beforeStatus)) {
  source = source.replace(beforeStatus, afterStatus);
} else if (!source.includes(afterStatus)) {
  throw new Error('Trecho de template do status do plano não encontrado.');
}

const beforeAppDecl = "const app=fs.readFileSync('js/app.js','utf8');";
const afterAppDecl = "const appJs=fs.readFileSync('js/app.js','utf8');";
if (source.includes(beforeAppDecl)) source = source.replace(beforeAppDecl, afterAppDecl);
else if (!source.includes(afterAppDecl)) throw new Error('Declaração do teste js/app.js não encontrada.');

const beforeAppAssert = "assert(app.includes('Cobranca.showLockedModule') && app.includes('Disponível em outro plano'),'Menu explica módulos de outro plano em vez de sumir silenciosamente.');";
const afterAppAssert = "assert(appJs.includes('Cobranca.showLockedModule') && appJs.includes('Disponível em outro plano'),'Menu explica módulos de outro plano em vez de sumir silenciosamente.');";
if (source.includes(beforeAppAssert)) source = source.replace(beforeAppAssert, afterAppAssert);
else if (!source.includes(afterAppAssert)) throw new Error('Asserção do teste js/app.js não encontrada.');

fs.writeFileSync(path, source, 'utf8');
console.log('Patch36 block2: gerador corrigido (template interno + nomes do teste).');
