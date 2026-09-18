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

// Novos testes de inteligência: Cadastros, Administrativo e Governança de Acessos
test('FINBOT_SYSTEM_PROMPT possui guia de cadastros e onboarding (empresa, obras, clientes, fornecedores)',
  /Cadastro da Empresa/i.test(usersContent) &&
  /CREA\/CAU/i.test(usersContent) &&
  /Cadastro de Obras/i.test(usersContent) &&
  /Cadastro de Fornecedores/i.test(usersContent) &&
  /Centros de Custo/i.test(usersContent)
);

test('FINBOT_SYSTEM_PROMPT possui administrativo, planos e faturamento PIX',
  /Conta & Assinatura/i.test(usersContent) &&
  /Plano Básico/i.test(usersContent) &&
  /Plano Profissional/i.test(usersContent) &&
  /Construtora Ilimitado/i.test(usersContent) &&
  /PIX/i.test(usersContent) &&
  /upgrade/i.test(usersContent)
);

test('FINBOT_SYSTEM_PROMPT possui governança de acessos (perfis RBAC, módulos granulares e sessões multi-device)',
  /Configurações > Usuários/i.test(usersContent) &&
  /Administrador/i.test(usersContent) &&
  /Gestor/i.test(usersContent) &&
  /Operador/i.test(usersContent) &&
  /Visualizador/i.test(usersContent) &&
  /Permissões Granulares por Módulo/i.test(usersContent) &&
  /Dispositivos Conectados e Sessões Ativas/i.test(usersContent) &&
  /LAST_ADMIN/i.test(usersContent)
);

const { getKeyPoolStatus } = await import('../api/_ai-key-pool.js');
const status = getKeyPoolStatus();
test('Pool lê as chaves do ambiente com sucesso', typeof status.totalKeys === 'number' && status.totalKeys >= 1);
test('Pool mascara as chaves para proteger segredos nos logs', status.details.every(d => d.masked.includes('...')));

// Validação funcional da Base de Conhecimento Estruturada do FinBot (Fallback KB)
const { supportBotReply } = await import('../api/users.js');

const replyEmpresa = supportBotReply('como cadastrar minha empresa e anexar o logo?');
test('KB responde corretamente sobre cadastro de empresa e logotipo',
  replyEmpresa && replyEmpresa.includes('Configurações > Empresa') && replyEmpresa.includes('logotipo')
);

const replyAcesso = supportBotReply('como definir acesso e permissoes para minha equipe?');
test('KB responde corretamente sobre definição de acessos e permissões',
  replyAcesso && replyAcesso.includes('Configurações > Usuários') && replyAcesso.includes('perfil nativo')
);

const replyPerfis = supportBotReply('qual a diferença dos perfis de acesso gestor e operador?');
test('KB responde corretamente sobre os 4 perfis nativos do FinGo',
  replyPerfis && replyPerfis.includes('Admin') && replyPerfis.includes('Gestor') && replyPerfis.includes('Operador')
);

const replySessoes = supportBotReply('posso usar no celular e no notebook ao mesmo tempo sem pagar extra?');
test('KB responde corretamente sobre sessões multi-dispositivo sem custo extra',
  replySessoes && replySessoes.includes('Não há custo extra por dispositivo') && replySessoes.includes('Configurações > Sessões')
);

const replyPlanos = supportBotReply('como funciona o pagamento via pix e fazer upgrade de plano?');
test('KB responde corretamente sobre planos, faturamento e upgrade',
  replyPlanos && replyPlanos.includes('Conta & Assinatura') && replyPlanos.includes('PIX')
);

const totalTests = 12 + 3 + 5;
console.log(`\nResultado: ${totalTests - fails}/${totalTests} testes aprovados.`);
if (fails > 0) {
  process.exit(1);
}
console.log('🚀 Pool de Chaves, FinBot (Onboarding, Admin, RBAC) e KB validados com 100% de sucesso!\n');
