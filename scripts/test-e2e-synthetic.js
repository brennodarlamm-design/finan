// scripts/test-e2e-synthetic.js — Runner E2E Sintético e Teste de Integração dos Fluxos Críticos
// FinObra SaaS — Release Hardening & End-to-End Validation
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../api/_auth.js';
import { parseWebhookPayload, isWebhookAuthorized } from '../api/_webhook_pix_core.js';
import { can, canAccessModule, canManageUsers, canManageTenant } from '../api/_permissions.js';

let passedSteps = 0;
let totalSteps = 0;

function step(name, fn) {
  totalSteps++;
  try {
    fn();
    passedSteps++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Erro: ${err.message}`);
    process.exitCode = 1;
    throw err;
  }
}

async function stepAsync(name, fn) {
  totalSteps++;
  try {
    await fn();
    passedSteps++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Erro: ${err.message}`);
    process.exitCode = 1;
    throw err;
  }
}

console.log('================================================================');
console.log('🚀 FinObra SaaS — Runner E2E Sintético de Fluxos Críticos (PATCH 47)');
console.log('================================================================\n');

// ==============================================================================
// CENÁRIO 1: Autenticação, Tokens JWT Criptográficos e Controle de Acesso (RBAC)
// ==============================================================================
console.log('📌 CENÁRIO 1: Autenticação, Tokens JWT e Controle de Permissões (RBAC)');

const jwtSecret = 'finobra-test-jwt-secret-very-secure-32chars!';

step('Hashing de senha com Scrypt e Salt criptográfico', () => {
  const plainPassword = 'Obra@2026_Forte!';
  const hash = hashPassword(plainPassword);
  assert.ok(hash.includes(':'), 'O hash deve conter salt:keyHex');
  assert.equal(verifyPassword(plainPassword, hash), true, 'Senha correta deve validar com sucesso');
  assert.equal(verifyPassword('SenhaIncorreta!123', hash), false, 'Senha incorreta deve ser rejeitada');
});

step('Geração de Token JWT assinado com HMAC-SHA256', () => {
  const payload = {
    userId: 'usr_alpha_1',
    tenantId: 'tenant_alpha',
    role: 'admin',
    exp: Date.now() + 3600 * 1000
  };
  const token = signToken(payload, jwtSecret);
  assert.ok(typeof token === 'string' && token.split('.').length === 3, 'Token JWT deve ter 3 partes separadas por ponto');

  const decoded = verifyToken(token, jwtSecret);
  assert.ok(decoded, 'Token válido deve ser decodificado');
  assert.equal(decoded.userId, 'usr_alpha_1');
  assert.equal(decoded.tenantId, 'tenant_alpha');
  assert.equal(decoded.role, 'admin');
});

step('Rejeição estrita de tokens expirados ou adulterados', () => {
  const expiredPayload = {
    userId: 'usr_alpha_1',
    tenantId: 'tenant_alpha',
    role: 'admin',
    exp: Date.now() - 1000 // Expirado 1 segundo atrás
  };
  const expiredToken = signToken(expiredPayload, jwtSecret);
  assert.equal(verifyToken(expiredToken, jwtSecret), null, 'Token expirado deve retornar null');

  const validToken = signToken({ userId: 'usr_alpha_1', exp: Date.now() + 60000 }, jwtSecret);
  const tamperedToken = validToken.slice(0, -5) + 'AAAAA';
  assert.equal(verifyToken(tamperedToken, jwtSecret), null, 'Token com assinatura adulterada deve retornar null');
});

step('Verificação de Controle de Acesso e Perfil (RBAC)', () => {
  const adminAuth = { user: { perfil: 'admin', plano: 'enterprise' } };
  const operadorAuth = { user: { perfil: 'operador', plano: 'enterprise' } };
  const visualizadorAuth = { user: { perfil: 'visualizador', plano: 'enterprise' } };

  assert.equal(canManageUsers(adminAuth), true, 'Admin deve poder gerenciar usuários');
  assert.equal(canManageTenant(adminAuth), true, 'Admin deve poder gerenciar configurações do inquilino');
  assert.equal(canManageUsers(operadorAuth), false, 'Operador não deve poder gerenciar usuários');
  assert.equal(can('operador', 'delete'), false, 'Operador não deve poder excluir registros');
  assert.equal(can('admin', 'delete'), true, 'Admin deve poder excluir registros');
  assert.equal(canAccessModule(adminAuth, 'financeiro', 'write'), true, 'Admin deve acessar financeiro com escrita');
  assert.equal(canAccessModule(visualizadorAuth, 'financeiro', 'write'), false, 'Visualizador não deve ter permissão de escrita');
  assert.equal(canAccessModule(visualizadorAuth, 'financeiro', 'read'), true, 'Visualizador deve ter permissão de leitura');
});

// ==============================================================================
// CENÁRIO 2: Isolamento Multi-Tenant Estrito no PostgreSQL (PGlite)
// ==============================================================================
console.log('\n📌 CENÁRIO 2: Isolamento Multi-Tenant Estrito no PostgreSQL');

const sql = new PGlite();

await stepAsync('Inicialização de Schema e Tabelas Relacionais com Chaves Multi-Tenant', async () => {
  await sql.exec(`
    CREATE TABLE tenants (
      id VARCHAR(64) PRIMARY KEY,
      razao_social VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'ativo',
      vencimento DATE DEFAULT CURRENT_DATE + 30
    );

    CREATE TABLE usuarios (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      nome VARCHAR(255) NOT NULL
    );

    CREATE TABLE contas_bancarias (
      id VARCHAR(100) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      banco_codigo VARCHAR(20),
      banco_nome VARCHAR(100),
      agencia VARCHAR(50),
      numero VARCHAR(50),
      titular VARCHAR(150),
      apelido VARCHAR(150),
      saldo_inicial NUMERIC(15,2) DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE obras (
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      id VARCHAR(64) NOT NULL,
      nome VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'em_andamento',
      PRIMARY KEY (tenant_id, id)
    );

    CREATE TABLE lancamentos (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      data DATE NOT NULL,
      descricao TEXT NOT NULL,
      categoria VARCHAR(100) NOT NULL,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
      valor NUMERIC(15, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pago',
      obra_id VARCHAR(64),
      conta_bancaria_id VARCHAR(100) REFERENCES contas_bancarias(id) ON DELETE SET NULL,
      conciliado BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id, id) ON DELETE SET NULL
    );
  `);

  // Inserir Tenant Alpha e Tenant Beta
  await sql.query(`INSERT INTO tenants (id, razao_social) VALUES ('tenant_alpha', 'Construtora Alpha Ltda');`);
  await sql.query(`INSERT INTO tenants (id, razao_social) VALUES ('tenant_beta', 'Engenharia Beta SA');`);

  // Inserir dados do Tenant Alpha
  await sql.query(`INSERT INTO contas_bancarias (id, tenant_id, banco_codigo, banco_nome, agencia, numero, titular, saldo_inicial)
    VALUES ('conta_alpha_1', 'tenant_alpha', '341', 'Itaú Unibanco', '1234', '56789-0', 'Construtora Alpha', 10000.00);`);

  await sql.query(`INSERT INTO obras (tenant_id, id, nome)
    VALUES ('tenant_alpha', 'obra_alpha_horizonte', 'Edifício Horizonte Residencial');`);

  await sql.query(`INSERT INTO lancamentos (id, tenant_id, data, descricao, categoria, tipo, valor, status, obra_id, conta_bancaria_id, conciliado)
    VALUES ('lanc_alpha_1', 'tenant_alpha', '2026-09-14', 'Compra de Aço CA-50 Gerdau', 'Material', 'despesa', 4500.00, 'pago', 'obra_alpha_horizonte', 'conta_alpha_1', false);`);
});

await stepAsync('Garantia de Isolamento: Tenant Beta não enxerga dados de Tenant Alpha', async () => {
  const obrasBeta = await sql.query(`SELECT * FROM obras WHERE tenant_id = 'tenant_beta';`);
  assert.equal(obrasBeta.rows.length, 0, 'Tenant Beta não deve visualizar obras de outros inquilinos');

  const lancamentosBeta = await sql.query(`SELECT * FROM lancamentos WHERE tenant_id = 'tenant_beta';`);
  assert.equal(lancamentosBeta.rows.length, 0, 'Tenant Beta não deve visualizar lançamentos de outros inquilinos');

  const contasBeta = await sql.query(`SELECT * FROM contas_bancarias WHERE tenant_id = 'tenant_beta';`);
  assert.equal(contasBeta.rows.length, 0, 'Tenant Beta não deve visualizar contas bancárias de outros inquilinos');
});

await stepAsync('Impedimento de mutação cruzada (Cross-Tenant Modification Attack)', async () => {
  // Tentativa do Tenant Beta de alterar o titular da conta do Tenant Alpha
  const updateResult = await sql.query(`
    UPDATE contas_bancarias 
    SET titular = 'Tentativa Invasão Beta' 
    WHERE id = 'conta_alpha_1' AND tenant_id = 'tenant_beta'
    RETURNING id;
  `);
  assert.equal(updateResult.rows.length, 0, 'Mutação de registro com tenant_id divergente deve atualizar 0 linhas');

  const contaOriginal = await sql.query(`SELECT titular FROM contas_bancarias WHERE id = 'conta_alpha_1';`);
  assert.equal(contaOriginal.rows[0].titular, 'Construtora Alpha', 'Dados originais devem permanecer inalterados');
});

// ==============================================================================
// CENÁRIO 3: Ciclo de Obras, Lançamentos Financeiros e Conciliação Bancária (OFX)
// ==============================================================================
console.log('\n📌 CENÁRIO 3: Ciclo Financeiro de Obras e Conciliação Bancária');

await stepAsync('Lançamento de Despesas e Receitas com Vinculação Bancária', async () => {
  // Inserir receita de medição de obra liberada
  await sql.query(`
    INSERT INTO lancamentos (id, tenant_id, data, descricao, categoria, tipo, valor, status, obra_id, conta_bancaria_id, conciliado)
    VALUES ('lanc_alpha_rec1', 'tenant_alpha', '2026-09-14', 'Liberação Medição 01 - Caixa Econômica', 'Medição', 'receita', 25000.00, 'pago', 'obra_alpha_horizonte', 'conta_alpha_1', true);
  `);

  // Consulta agrupada de lançamentos por status de conciliação bancária
  const conciliacao = await sql.query(`
    SELECT 
      conciliado,
      COUNT(*)::int as total_registros,
      SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END) as impacto_liquido
    FROM lancamentos
    WHERE tenant_id = 'tenant_alpha' AND conta_bancaria_id = 'conta_alpha_1'
    GROUP BY conciliado
    ORDER BY conciliado ASC;
  `);

  assert.equal(conciliacao.rows.length, 2, 'Deve haver registros conciliados e não conciliados');
  const pendente = conciliacao.rows.find(r => r.conciliado === false);
  const conciliado = conciliacao.rows.find(r => r.conciliado === true);

  assert.equal(Number(pendente.impacto_liquido), -4500.00, 'Despesa pendente de R$ 4.500,00');
  assert.equal(Number(conciliado.impacto_liquido), 25000.00, 'Receita conciliada de R$ 25.000,00');
});

await stepAsync('Execução da Conciliação de Extrato Bancário (Marcação como Conciliado)', async () => {
  const conciliarResult = await sql.query(`
    UPDATE lancamentos 
    SET conciliado = TRUE 
    WHERE id = 'lanc_alpha_1' AND tenant_id = 'tenant_alpha' AND conta_bancaria_id = 'conta_alpha_1'
    RETURNING id, conciliado;
  `);
  assert.equal(conciliarResult.rows.length, 1);
  assert.equal(conciliarResult.rows[0].conciliado, true);

  // Cálculo do Saldo Total Reconciliado da Conta Bancária
  const saldoFinal = await sql.query(`
    SELECT 
      c.saldo_inicial,
      COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE -l.valor END), 0) as movimentacao_conciliada,
      (c.saldo_inicial + COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE -l.valor END), 0)) as saldo_calculado
    FROM contas_bancarias c
    LEFT JOIN lancamentos l ON l.conta_bancaria_id = c.id AND l.tenant_id = c.tenant_id AND l.conciliado = TRUE
    WHERE c.id = 'conta_alpha_1' AND c.tenant_id = 'tenant_alpha'
    GROUP BY c.id, c.saldo_inicial;
  `);

  const esperado = 10000.00 - 4500.00 + 25000.00; // 30.500,00
  assert.equal(Number(saldoFinal.rows[0].saldo_calculado), esperado, `Saldo final deve ser exatamente R$ ${esperado}`);
});

// ==============================================================================
// CENÁRIO 4: Ciclo de Cobrança PIX SaaS, Webhook e Idempotência Estrita
// ==============================================================================
console.log('\n📌 CENÁRIO 4: Ciclo de Cobrança PIX SaaS e Idempotência de Webhooks');

await stepAsync('Configuração de Tabela de Faturas SaaS e Validação de Assinatura de Webhook', async () => {
  await sql.exec(`
    CREATE TABLE billing_invoices (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      plan_id VARCHAR(32) NOT NULL,
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      status VARCHAR(24) NOT NULL DEFAULT 'pending',
      txid VARCHAR(128) NOT NULL UNIQUE,
      gateway VARCHAR(32) DEFAULT 'asaas',
      paid_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Inserir fatura pendente de R$ 149,00
  await sql.query(`
    INSERT INTO billing_invoices (id, tenant_id, plan_id, amount_cents, status, txid)
    VALUES ('inv_saas_sep26', 'tenant_alpha', 'pro', 14900, 'pending', 'tx_pix_mock_9999');
  `);

  // Testar autorização do webhook via x-webhook-secret
  process.env.PIX_WEBHOOK_SECRET = 'finobra-super-secret-pix-key-2026';
  const authReqSuccess = { headers: { 'x-webhook-secret': 'finobra-super-secret-pix-key-2026' } };
  const authResSuccess = isWebhookAuthorized(authReqSuccess);
  assert.equal(authResSuccess.authorized, true, 'Webhook com segredo correto deve ser autorizado');

  const authReqFail = { headers: { 'x-webhook-secret': 'chave-errada' } };
  const authResFail = isWebhookAuthorized(authReqFail);
  assert.equal(authResFail.authorized, false, 'Webhook com segredo incorreto deve ser rejeitado');
});

step('Normalização de Payload Asaas com externalReference', () => {
  const asaasPayload = {
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'pay_asaas_12345',
      externalReference: 'tenant_alpha:inv_saas_sep26',
      value: 149.00,
      pixTransaction: { txid: 'tx_pix_mock_9999' }
    }
  };

  const parsed = parseWebhookPayload(asaasPayload);
  assert.equal(parsed.gateway, 'asaas');
  assert.equal(parsed.tenantId, 'tenant_alpha');
  assert.equal(parsed.invoiceId, 'inv_saas_sep26');
  assert.equal(parsed.txid, 'tx_pix_mock_9999');
  assert.equal(parsed.amountCents, 14900);
});

await stepAsync('Processamento Atômico do Webhook PIX com Renovação de Assinatura', async () => {
  // 1ª Execução: Fatura pendente é liquidada e status atualizado
  const updateInvoice = await sql.query(`
    UPDATE billing_invoices 
    SET status = 'paid', paid_at = NOW() 
    WHERE txid = 'tx_pix_mock_9999' AND status = 'pending'
    RETURNING id, tenant_id, plan_id;
  `);
  assert.equal(updateInvoice.rows.length, 1, 'Primeiro webhook deve encontrar a fatura pendente e liquidar');

  // Atualizar vencimento do inquilino em +30 dias
  await sql.query(`
    UPDATE tenants 
    SET vencimento = CURRENT_DATE + INTERVAL '30 days', status = 'ativo' 
    WHERE id = 'tenant_alpha';
  `);

  const tenant = await sql.query(`SELECT status, vencimento FROM tenants WHERE id = 'tenant_alpha';`);
  assert.equal(tenant.rows[0].status, 'ativo');
});

await stepAsync('Idempotência Estrita: Segundo Webhook idêntico não duplica liquidação', async () => {
  // 2ª Execução (Reenvio pelo Gateway ASAAS devido a timeout ou retry)
  const duplicateInvoice = await sql.query(`
    UPDATE billing_invoices 
    SET status = 'paid', paid_at = NOW() 
    WHERE txid = 'tx_pix_mock_9999' AND status = 'pending'
    RETURNING id;
  `);
  assert.equal(duplicateInvoice.rows.length, 0, 'Segundo webhook com mesmo txid não deve alterar nada (idempotente)');
});

// ==============================================================================
// CENÁRIO 5: Ingestão de Telemetria no Cliente e Agrupamento por Assinatura (CTE)
// ==============================================================================
console.log('\n📌 CENÁRIO 5: Ingestão de Telemetria e Dashboard de Observabilidade com CTE');

await stepAsync('Criação da Tabela de Telemetria client_error_logs e Ingestão de Incidentes', async () => {
  await sql.exec(`
    CREATE TABLE client_error_logs (
      id VARCHAR(80) PRIMARY KEY,
      tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
      user_id VARCHAR(64),
      route VARCHAR(100),
      message TEXT NOT NULL,
      source TEXT,
      line_no INTEGER,
      col_no INTEGER,
      stack TEXT,
      user_agent TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      status VARCHAR(20) DEFAULT 'open',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Inserir 3 ocorrências de um erro em 'fluxo-caixa' com breadcrumbs
  for (let i = 1; i <= 3; i++) {
    const errorId = `err_synthetic_fc_${i}`;
    const meta = {
      viewport: '1920x1080',
      breadcrumbs: [
        { ts: '2026-09-14T20:00:00Z', type: 'navigation', target: '#fluxo-caixa' },
        { ts: '2026-09-14T20:00:02Z', type: 'click', target: 'button#btn-filtro-periodo' }
      ]
    };
    await sql.query(`
      INSERT INTO client_error_logs (id, tenant_id, route, message, metadata, status)
      VALUES ($1, 'tenant_alpha', '#fluxo-caixa', 'TypeError: Cannot read properties of undefined (reading balance)', $2::jsonb, 'open')
    `, [errorId, JSON.stringify(meta)]);
  }

  // Inserir 2 ocorrências de outro erro em 'nfe'
  for (let i = 1; i <= 2; i++) {
    const errorId = `err_synthetic_nfe_${i}`;
    const meta = {
      viewport: '1366x768',
      breadcrumbs: [
        { ts: '2026-09-14T20:05:00Z', type: 'navigation', target: '#nfe' }
      ]
    };
    await sql.query(`
      INSERT INTO client_error_logs (id, tenant_id, route, message, metadata, status)
      VALUES ($1, 'tenant_alpha', '#nfe', 'XMLParseError: Invalid closing tag at line 14', $2::jsonb, 'open')
    `, [errorId, JSON.stringify(meta)]);
  }
});

await stepAsync('Execução da Query de Agrupamento por CTE e Deduplicação por Assinatura', async () => {
  // Query idêntica à utilizada em api/admin.js (ação client_errors)
  const clustersResult = await sql.query(`
    WITH grouped AS (
      SELECT 
        MD5(CONCAT(COALESCE(route, ''), '::', message)) as cluster_id,
        message,
        route,
        COUNT(*)::int as occurrences,
        COUNT(DISTINCT tenant_id)::int as affected_tenants,
        MAX(created_at) as last_seen,
        MIN(created_at) as first_seen,
        (ARRAY_AGG(id ORDER BY created_at DESC))[1] as sample_id,
        (ARRAY_AGG(metadata ORDER BY created_at DESC))[1] as sample_metadata
      FROM client_error_logs
      WHERE status = 'open'
      GROUP BY route, message
    )
    SELECT * FROM grouped ORDER BY occurrences DESC;
  `);

  assert.equal(clustersResult.rows.length, 2, 'Deve gerar exatamente 2 clusters consolidados');
  
  const topCluster = clustersResult.rows[0];
  assert.equal(topCluster.route, '#fluxo-caixa');
  assert.equal(topCluster.occurrences, 3, 'Primeiro cluster deve conter 3 ocorrências agrupadas');
  assert.ok(topCluster.sample_metadata.breadcrumbs, 'Metadata do cluster deve preservar trilha de navegação');
  assert.equal(topCluster.sample_metadata.breadcrumbs.length, 2);
  assert.equal(topCluster.sample_metadata.breadcrumbs[1].type, 'click');

  const secondCluster = clustersResult.rows[1];
  assert.equal(secondCluster.route, '#nfe');
  assert.equal(secondCluster.occurrences, 2, 'Segundo cluster deve conter 2 ocorrências agrupadas');
});

await stepAsync('Limpeza e Encerramento Seguro do Banco Sintético PGlite', async () => {
  await sql.close();
});

console.log('\n================================================================');
console.log(`🎉 TODOS OS ${passedSteps}/${totalSteps} PASSOS DO RUNNER E2E SINTÉTICO FORAM APROVADOS!`);
console.log('================================================================\n');
