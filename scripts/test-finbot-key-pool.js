// scripts/test-finbot-key-pool.js — Teste do Pool de Chaves com Rotação e Cooldown do FinBot
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

let fails = 0;
function test(name, cond) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}`);
    fails++;
  }
}

console.log('=== Suíte de Testes do Pool de Chaves & Inteligência do FinBot ===\n');

const poolFile = path.resolve('api/_ai-key-pool.js');
const usersFile = path.resolve('api/users.js');

test('api/_ai-key-pool.js existe fisicamente', fs.existsSync(poolFile));
test('api/users.js existe fisicamente', fs.existsSync(usersFile));

const poolContent = fs.readFileSync(poolFile, 'utf8');
const usersContent = fs.readFileSync(usersFile, 'utf8');

test('Pool usa prefixo _ para respeitar limite de 12 funções públicas Vercel', path.basename(poolFile).startsWith('_'));
test('Pool exporta callGeminiKeyPool e getKeyPoolStatus', /export async function callGeminiKeyPool/.test(poolContent) && /export function getKeyPoolStatus/.test(poolContent));
test('Pool suporta rotação e tratamento de HTTP 429 / RESOURCE_EXHAUSTED', /markKeyCooldown/.test(poolContent) && /RESOURCE_EXHAUSTED|429/i.test(poolContent));
test('Pool possui modelos modernos gemini-3.6-flash e gemini-flash-latest', /gemini-3\.6-flash/.test(poolContent) && /gemini-flash-latest/.test(poolContent));

test('api/users.js importa callGeminiKeyPool', /import\s*\{\s*callGeminiKeyPool\s*\}\s*from\s*['"]\.\/_ai-key-pool\.js['"]/.test(usersContent));
test('api/users.js define FINBOT_SYSTEM_PROMPT especializado em engenharia/construção civil', /FINBOT_SYSTEM_PROMPT/.test(usersContent) && /construção civil brasileira/i.test(usersContent) && /SINAPI Caixa/i.test(usersContent));
test('api/users.js passa histórico de mensagens para a IA', /loadSupportMessages/.test(usersContent) && /history/.test(usersContent));
test('api/users.js mantém fallback de segurança para suporte humano e KB', /findLearnedSupportAnswer/.test(usersContent) && /supportBotReply/.test(usersContent));

const { getKeyPoolStatus } = await import('../api/_ai-key-pool.js');
const status = getKeyPoolStatus();
test('Pool lê as chaves do ambiente com sucesso', typeof status.totalKeys === 'number' && status.totalKeys >= 1);
test('Pool mascara as chaves para proteger segredos nos logs', status.details.every(d => d.masked.includes('...')));

console.log(`\nResultado: ${12 - fails}/12 testes aprovados.`);
if (fails > 0) {
  process.exit(1);
}
console.log('🚀 Pool de Chaves e FinBot validados com sucesso!\n');
