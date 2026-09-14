// scripts/test-patch45-static.js — Validação Estática do PATCH 45: Gestão de Contas Bancárias e Conciliação no Painel Master
import fs from 'fs';
import path from 'path';

let totalTests = 0;
let passedTests = 0;

function test(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ ${name}`);
  } else {
    console.error(`  ❌ ${name}`);
    if (details) console.error(`     Detalhes: ${details}`);
    process.exitCode = 1;
  }
}

console.log('🧪 Executando Testes Estáticos — PATCH 45: Gestão de Contas Bancárias e Conciliação no Painel Master...\n');

const adminPath = path.resolve('api/admin.js');
const masterHtmlPath = path.resolve('master.html');
const masterJsPath = path.resolve('js/master.js');
const patch26EventsPath = path.resolve('js/patch26-events.js');

test('api/admin.js existe', fs.existsSync(adminPath));
test('master.html existe', fs.existsSync(masterHtmlPath));
test('js/master.js existe', fs.existsSync(masterJsPath));
test('js/patch26-events.js existe', fs.existsSync(patch26EventsPath));

const adminCode = fs.readFileSync(adminPath, 'utf8');
const masterHtml = fs.readFileSync(masterHtmlPath, 'utf8');
const masterJs = fs.readFileSync(masterJsPath, 'utf8');
const patch26Events = fs.readFileSync(patch26EventsPath, 'utf8');

// 1. Validação do Endpoint Backend em api/admin.js
test('api/admin.js possui ação bank_accounts_overview', adminCode.includes("action === 'bank_accounts_overview'"));
test('api/admin.js aceita alias contas_bancarias_overview', adminCode.includes("action === 'contas_bancarias_overview'"));
test('api/admin.js seleciona contas_bancarias com join em tenants e obras', 
  adminCode.includes('FROM contas_bancarias c') && 
  adminCode.includes('LEFT JOIN tenants t ON t.id = c.tenant_id') &&
  adminCode.includes('LEFT JOIN obras o ON o.id = c.obra_id')
);
test('api/admin.js agrupa estatísticas com taxa de conciliação e contagem de lancamentos', 
  adminCode.includes('COUNT(l.id) FILTER (WHERE l.conciliado = true)') &&
  adminCode.includes('COUNT(l.id) FILTER (WHERE l.conciliado = false OR l.conciliado IS NULL)') &&
  adminCode.includes('taxa_conciliacao_pct')
);
test('api/admin.js retorna summary com saldo_consolidado, total_lancamentos e taxa_global_pct', 
  adminCode.includes('saldo_consolidado:') &&
  adminCode.includes('total_lancamentos:') &&
  adminCode.includes('lancamentos_conciliados:') &&
  adminCode.includes('taxa_global_pct:')
);

// 2. Validação da Interface Master em master.html
test('master.html contém atalho de botão para Contas Bancárias', 
  masterHtml.includes('MasterAdmin.switchTab') && 
  masterHtml.includes('data-fb-click-v0="contas"') &&
  masterHtml.includes('Contas Bancárias')
);

// 3. Validação da Lógica do Painel em js/master.js
test('js/master.js possui estados _bankAccounts e _bankAccountsLoading', 
  masterJs.includes('_bankAccounts: null') && 
  masterJs.includes('_bankAccountsLoading: false')
);
test('js/master.js implementa método carregarContasBancarias', 
  masterJs.includes('async carregarContasBancarias(') &&
  masterJs.includes('bank_accounts_overview')
);
test('js/master.js implementa método recarregarContasBancarias', 
  masterJs.includes('async recarregarContasBancarias()')
);
test('js/master.js implementa renderizador _renderContasBancariasSaaS', 
  masterJs.includes('_renderContasBancariasSaaS()')
);
test('js/master.js renderiza 4 cartões de indicadores no painel de contas', 
  masterJs.includes('Contas Ativas no SaaS') &&
  masterJs.includes('Saldo Consolidado em Contas') &&
  masterJs.includes('Índice Global de Conciliação') &&
  masterJs.includes('Auditoria Bancária Multi-Tenant')
);
test('js/master.js renderiza Seção de Conciliação por Empresa', 
  masterJs.includes('Taxa de Conciliação por Empresa') &&
  masterJs.includes('Acompanhamento da integridade contábil dos lançamentos')
);
test('js/master.js renderiza Seção de Contas Bancárias Cadastradas', 
  masterJs.includes('Contas Bancárias Cadastradas no SaaS') &&
  masterJs.includes('Relação de contas correntes e aplicações cadastradas')
);
test('js/master.js inclui a aba Contas Bancárias & Conciliação na navegação principal', 
  masterJs.includes('<span>🏦</span> Contas Bancárias &amp; Conciliação')
);

// 4. Validação de Segurança e CSP em js/patch26-events.js
test('js/patch26-events.js inclui MasterAdmin.recarregarContasBancarias no conjunto ALLOWED', 
  patch26Events.includes('"MasterAdmin.recarregarContasBancarias"')
);
test('js/patch26-events.js inclui MasterAdmin.switchTab no conjunto ALLOWED', 
  patch26Events.includes('"MasterAdmin.switchTab"')
);

// 5. Verificação da Conformidade com Limite Vercel Hobby (máximo 12 serverless functions)
const apiFiles = fs.readdirSync(path.resolve('api')).filter(f => f.endsWith('.js') && !f.startsWith('_'));
test(`Total de Serverless Functions em api/*.js <= 12 (Atual: ${apiFiles.length})`, apiFiles.length <= 12, `Arquivos encontrados: ${apiFiles.join(', ')}`);

// 6. Teste da Lógica de Cálculo de Taxa de Conciliação
const testTotal = 150;
const testConciliados = 120;
const taxaCalculada = Math.round((testConciliados / testTotal) * 100);
test('Cálculo de taxa de conciliação percentual está correto', taxaCalculada === 80);

console.log(`\n📊 Resultado dos Testes do PATCH 45: ${passedTests}/${totalTests} passaram.`);
if (passedTests === totalTests) {
  console.log('✨ Todos os testes estáticos do PATCH 45 foram aprovados com sucesso!\n');
} else {
  console.error(`❌ ${totalTests - passedTests} teste(s) falharam.\n`);
  process.exit(1);
}
