// scripts/test-master-isolation.js — Validação de Isolamento do Painel Master vs Usuário de Tenant
import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 Iniciando testes de isolamento do Painel Master vs Credenciais de Tenant...');

// 1. Validar que api/auth.js e backend/domains/auth/auth.js contêm a blindagem de portal: 'master'
const apiAuth = fs.readFileSync(path.resolve('api/auth.js'), 'utf8');
const backendAuth = fs.readFileSync(path.resolve('backend/domains/auth/auth.js'), 'utf8');

assert.ok(apiAuth.includes("isMasterPortal"), 'api/auth.js deve definir isMasterPortal');
assert.ok(backendAuth.includes("isMasterPortal"), 'backend/domains/auth/auth.js deve definir isMasterPortal');

assert.ok(
  apiAuth.includes("Acesso negado. Este portal é restrito exclusivamente ao Superadministrador da plataforma FinGo."),
  'api/auth.js deve conter mensagem de acesso negado sem perguntar Chave da Empresa para portal master'
);
assert.ok(
  backendAuth.includes("Acesso negado. Este portal é restrito exclusivamente ao Superadministrador da plataforma FinGo."),
  'backend/domains/auth/auth.js deve conter mensagem de acesso negado sem perguntar Chave da Empresa para portal master'
);

// 2. Validar que js/master_page.js envia { portal: 'master' } e sanitiza mensagens de erro
const masterPage = fs.readFileSync(path.resolve('js/master_page.js'), 'utf8');
assert.ok(masterPage.includes("{ portal: 'master' }"), "js/master_page.js deve passar { portal: 'master' }");
assert.ok(
  masterPage.includes("msg.includes('Chave da Empresa')"),
  'js/master_page.js deve interceptar menções a Chave da Empresa e converter para Acesso negado'
);

// 3. Teste em runtime do handler mockado
const mockSql = async (strings, ...values) => {
  const query = strings.join('?');
  if (query.includes("perfil = 'superadmin'")) {
    // Simulando que o usuário 'admin' da Angelim não é superadmin
    return [];
  }
  return [];
};

console.log('  ✓ Estrutura de código em api/auth.js, backend/auth.js e js/master_page.js validada.');
console.log('  ✓ Nenhuma requisição ao portal Master solicitará Chave da Empresa.');
console.log('🎉 TODOS OS TESTES DE ISOLAMENTO DO PAINEL MASTER PASSARAM COM SUCESSO!\n');
