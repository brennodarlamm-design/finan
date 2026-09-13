import fs from 'fs';
const file='scripts/test-patch11-static.js';
let src=fs.readFileSync(file,'utf8');
const old="test('Version guard existe', /^20\\d{2}\\.\\d{2}\\.\\d{2}-p\\d+(?:[-._a-z0-9]*)?$/i.test(String(versionMeta.build || '')) && /FINOBRA_BUILD/i.test(guard) && /version\\.json/i.test(guard));";
const next="test('Version guard existe', /version\\.json/i.test(guard) && /finobra_edge_release_commit/i.test(guard) && /FINOBRA_RELEASE_ALIGNED/i.test(guard) && /\\/api\\/health/i.test(guard));";
if(!src.includes(old) && !src.includes(next)) throw new Error('Patch37: asserção histórica do version guard não encontrada.');
if(src.includes(old)) src=src.replace(old,next);
fs.writeFileSync(file,src,'utf8');
console.log('✅ Patch 11 atualizado para validar release guard por commit real.');
