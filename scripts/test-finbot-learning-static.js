import fs from 'fs';

let fails = 0;
function read(p){ return fs.readFileSync(p, 'utf8'); }
function ok(name, cond){ if (cond) console.log(`  ✓ ${name}`); else { console.error(`  ✗ ${name}`); fails++; } }

console.log('=== FinBot aprendizado + OCR Gemini-only ===\n');
const ocrApi = read('./api/reconhecer-documento.js');
const usersApi = read('./api/users.js');
const ocrJs = read('./js/ocr.js');
const cfg = read('./js/configuracoes.js');
const master = read('./js/master.js');

ok('OCR não contém OpenAI', !/OPENAI_API_KEY|api\.openai\.com|gpt-4o-mini|ChatGPT Vision/.test(ocrApi));
ok('OCR usa somente Gemini configurado no servidor', /GEMINI_API_KEY/.test(ocrApi) && /gemini-3\.6-flash/.test(ocrApi) && /gemini-3\.5-flash/.test(ocrApi));
ok('Frontend OCR identifica apenas Gemini Vision', /IA Vision Gemini/.test(ocrJs) && !/ChatGPT & Gemini|ChatGPT Vision/.test(ocrJs));
ok('FinBot não depende de OpenAI', !/OPENAI_API_KEY|api\.openai\.com|getOpenAIBotReply/.test(usersApi));
ok('FinBot possui conhecimento ampliado do FinObra', /topic:'orcamentos'/.test(usersApi) && /topic:'sinapi'/.test(usersApi) && /topic:'engenharia'/.test(usersApi) && /topic:'precompras'/.test(usersApi) && /topic:'relatorios'/.test(usersApi));
ok('FinBot aprende de respostas humanas', /findLearnedSupportAnswer/.test(usersApi) && /sender_type='agent'/.test(usersApi));
ok('Aprendizado é isolado por tenant', /q\.tenant_id=\$\{tenantId\}/.test(usersApi));
ok('Aprendizado não auto-reforça resposta de bot', /a\.sender_type='agent'/.test(usersApi) && !/a\.sender_type='bot'/.test(usersApi));
ok('Cliente não possui aba Diagnóstico', !/cfg-tab-diagnostico|_renderDiagnostico|action=errors/.test(cfg));
ok('Diagnóstico permanece no painel DEV/Master', /carregarErrosSaaS/.test(master) && /Saúde do Sistema/.test(master) && /client_errors/.test(master));

console.log(`\nResultado: ${10 - fails}/10.`);
if (fails) process.exit(1);
console.log('✅ FinBot, OCR e diagnóstico validados.');
