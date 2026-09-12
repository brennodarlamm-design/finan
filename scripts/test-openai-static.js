import fs from 'fs';

let fails = 0;
function read(p){ return fs.readFileSync(p, 'utf8'); }
function ok(name, cond){
  if (cond) console.log(`  ✓ ${name}`);
  else { console.error(`  ✗ ${name}`); fails++; }
}

console.log('=== Iniciando Testes Estáticos Integração OpenAI (ChatGPT) ===\n');

const ocrApi = read('./api/reconhecer-documento.js');
const usersApi = read('./api/users.js');
const ocrJs = read('./js/ocr.js');
const envLocal = fs.existsSync('./.env.local') ? read('./.env.local') : '';

console.log('[1] Backend OCR (api/reconhecer-documento.js)');
ok('api/reconhecer-documento.js lê OPENAI_API_KEY', /process\.env\.OPENAI_API_KEY/.test(ocrApi));
ok('api/reconhecer-documento.js suporta modelo gpt-4o-mini', /gpt-4o-mini/.test(ocrApi));
ok('api/reconhecer-documento.js envia imagem base64 na chamada de visão da OpenAI', /image_url[\s\S]{1,120}data:\$\{cleanMime\};base64,\$\{cleanBase64\}/.test(ocrApi));
ok('api/reconhecer-documento.js mantém fallback automático para Google Gemini', /gemini-3\.6-flash/.test(ocrApi) && /provedorUsado\s*=\s*'gemini'/.test(ocrApi));
ok('api/reconhecer-documento.js reporta erro amigável de créditos esgotados da OpenAI', /credit_balance_exhausted|insufficient_quota/.test(ocrApi));

console.log('\n[2] Assistente FinBot (api/users.js)');
ok('api/users.js implementa getOpenAIBotReply com OpenAI ChatGPT', /function getOpenAIBotReply/.test(usersApi));
ok('api/users.js preserva fallback seguro para base de conhecimento supportBotReply', /reply\s*=\s*supportBotReply\(text\)/.test(usersApi));

console.log('\n[3] Frontend OCR (js/ocr.js)');
ok('js/ocr.js atualizou o cabeçalho para ChatGPT & Gemini Vision IA', /IA Vision \(ChatGPT & Gemini\)/.test(ocrJs));
ok('js/ocr.js exibe badge de ChatGPT Vision quando provido por OpenAI', /ChatGPT Vision/.test(ocrJs));

console.log('\n[4] Configuração de Ambiente');
ok('.env.local contém OPENAI_API_KEY configurada', /OPENAI_API_KEY="sk-proj-/.test(envLocal));

console.log('\n========================================');
console.log(`Testes OpenAI: ${10 - fails} de 10 passaram.`);
console.log('========================================\n');

if (fails > 0) {
  process.exit(1);
} else {
  console.log('🎉 Todos os testes de integração OpenAI passaram com sucesso!\n');
}
