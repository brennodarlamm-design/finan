import fs from 'fs';

let fails = 0;
function read(p){ return fs.readFileSync(p,'utf8'); }
function ok(name, cond){
  if(cond) console.log(`✅ ${name}`);
  else { console.error(`❌ ${name}`); fails++; }
}

const db = read('./api/db.js');
const ocr = read('./api/reconhecer-documento.js');
const schema = read('./schema.sql');
const utils = read('./js/utils.js');
const compose = read('./monitor-nfe/evolution-api/docker-compose.yml');
const evo = read('./monitor-nfe/evolution-api/CriarInstancia.ps1');
const forn = read('./js/fornecedores.js');

ok('OCR não usa Gemini 1.5/2.0 descontinuados', !/gemini-1\.5-flash|gemini-2\.0-flash/.test(ocr));
ok('OCR usa Gemini Flash atual', /gemini-3\.6-flash|gemini-flash-latest/.test(ocr));
ok('API DB usa data de America\/Boa_Vista', /function todayBoaVista\(\)/.test(db) && /America\/Boa_Vista/.test(db));
ok('Fornecedor persiste endereco/municipio/uf/ativo', /INSERT INTO fornecedores[\s\S]{0,400}endereco, municipio, uf, ativo/.test(db));
ok('Schema possui campos SaaS do fornecedor', /municipio VARCHAR\(120\)/.test(schema) && /ativo BOOLEAN DEFAULT TRUE/.test(schema));
ok('Fornecedor não força Boa Vista \/ RR', !/\|\| 'Boa Vista \/ RR'/.test(forn) && !/uf: 'RR'/.test(db));
ok('Toast usa textContent para mensagem não confiável', /text\.textContent = String\(msg/.test(utils));
ok('Evolution Docker exige segredo externo', /EVOLUTION_API_KEY:\?/.test(compose) && !/ANGELIM-FINANCAS-EVOLUTION-2026-KEY/.test(compose));
ok('Script Evolution não contém chave fixa', /EVOLUTION_API_KEY/.test(evo) && !/ANGELIM-FINANCAS-EVOLUTION-2026-KEY/.test(evo));

if (fails) {
  console.error(`\n${fails} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\n✅ Patch 02: todas as verificações passaram.');
