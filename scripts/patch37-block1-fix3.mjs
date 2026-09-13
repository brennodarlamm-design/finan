import fs from 'fs';
const file='scripts/test-patch34-static.js';
let src=fs.readFileSync(file,'utf8');
const old="assert(worker.includes(\"headers.set('X-FinObra-Route', 'app-shell')\"), 'Resposta do app shell deve ser identificável em produção.');";
const next="assert(worker.includes(\"routeName = 'app-shell'\") && worker.includes(\"headers.set('X-FinObra-Route', routeName)\"), 'Resposta do app shell deve continuar identificável dentro do roteador multi-shell.');";
if(!src.includes(old) && !src.includes(next)) throw new Error('Patch37: asserção histórica do app-shell não encontrada.');
if(src.includes(old)) src=src.replace(old,next);
fs.writeFileSync(file,src,'utf8');
console.log('✅ Patch 34 atualizado para validar o app-shell dentro do roteamento público multi-shell.');
