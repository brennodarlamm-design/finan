#!/usr/bin/env node
// scripts/test-rls-cross-tenant.js
// Patch 56 — Fase 4: Testes de isolamento real Tenant A × Tenant B
//
// PRÉ-REQUISITOS obrigatórios (não rodar em produção):
//   1. DATABASE_URL apontando para branch Neon isolada de teste
//   2. Role da conexão: finobra_app (sem BYPASSRLS, sem SUPERUSER)
//   3. FORCE ROW LEVEL SECURITY ativo nas tabelas-alvo
//   4. Dois tenants reais na branch de teste: TENANT_A_ID e TENANT_B_ID
//
// Uso:
//   TENANT_A_ID=ten_abc TENANT_B_ID=ten_xyz node scripts/test-rls-cross-tenant.js

import { neon } from '@neondatabase/serverless';
import { createTenantSql } from '../api/_tenant-sql.js';

const DATABASE_URL = process.env.DATABASE_URL;
const TENANT_A_ID = process.env.TENANT_A_ID;
const TENANT_B_ID = process.env.TENANT_B_ID;

// ── Validação de ambiente ────────────────────────────────────────────────────

if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL não configurada.');
  process.exit(1);
}
if (!TENANT_A_ID || !TENANT_B_ID) {
  console.error('❌  Defina TENANT_A_ID e TENANT_B_ID no ambiente.');
  process.exit(1);
}
if (TENANT_A_ID === TENANT_B_ID) {
  console.error('❌  TENANT_A_ID e TENANT_B_ID devem ser diferentes.');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(name) {
  console.log(`  ✅  ${name}`);
  passed++;
}

function fail(name, reason) {
  console.error(`  ❌  ${name}`);
  console.error(`       ${reason}`);
  failed++;
}

async function assertZeroRows(label, queryFn) {
  try {
    const rows = await queryFn();
    if (Array.isArray(rows) && rows.length === 0) {
      pass(label);
    } else {
      fail(label, `Esperado 0 linhas, obteve ${rows.length}. VAZAMENTO DE DADOS!`);
    }
  } catch (err) {
    // Erro de RLS é aceitável — o banco bloqueou a operação
    if (/permission denied|rls|policy/i.test(err.message)) {
      pass(`${label} (bloqueado por RLS)`);
    } else {
      fail(label, `Erro inesperado: ${err.message}`);
    }
  }
}

async function assertZeroAffected(label, queryFn) {
  try {
    const result = await queryFn();
    const count = Array.isArray(result) ? result.length : 0;
    if (count === 0) {
      pass(label);
    } else {
      fail(label, `Esperado 0 linhas afetadas, obteve ${count}. ESCRITA CRUZADA!`);
    }
  } catch (err) {
    if (/permission denied|rls|policy/i.test(err.message)) {
      pass(`${label} (bloqueado por RLS)`);
    } else {
      fail(label, `Erro inesperado: ${err.message}`);
    }
  }
}

async function assertThrows(label, fn) {
  try {
    await fn();
    fail(label, 'Deveria ter lançado erro mas não lançou (fail-open).');
  } catch {
    pass(label);
  }
}

// ── Suite de testes ──────────────────────────────────────────────────────────

const baseSql = neon(DATABASE_URL);
const sqlA = createTenantSql(baseSql, { tenantId: TENANT_A_ID });
const sqlB = createTenantSql(baseSql, { tenantId: TENANT_B_ID });

console.log('\n🔐  Patch 56 — Testes de Isolamento RLS Tenant A × Tenant B');
console.log(`    Tenant A: ${TENANT_A_ID}`);
console.log(`    Tenant B: ${TENANT_B_ID}`);
console.log(`    Database: ${DATABASE_URL.replace(/:[^:@]*@/, ':***@')}\n`);

// ── Bloco 1: Fail-closed sem contexto tenant ─────────────────────────────────
console.log('📋  Bloco 1: Fail-closed');

await assertThrows(
  'createTenantSql com tenantId vazio deve lançar erro',
  () => createTenantSql(baseSql, { tenantId: '' })
);

await assertThrows(
  'createTenantSql sem contexto deve lançar erro',
  () => createTenantSql(baseSql, {})
);

// ── Bloco 2: Leitura cruzada (Tenant A lendo dados do Tenant B) ─────────────
console.log('\n📋  Bloco 2: Leitura cruzada — Tenant A lendo dados do Tenant B');

await assertZeroRows(
  'SELECT em "obras" do Tenant B via contexto do Tenant A',
  () => sqlA`SELECT id FROM obras WHERE tenant_id = ${TENANT_B_ID} LIMIT 5`
);

await assertZeroRows(
  'SELECT em "lancamentos" do Tenant B via contexto do Tenant A',
  () => sqlA`SELECT id FROM lancamentos WHERE tenant_id = ${TENANT_B_ID} LIMIT 5`
);

await assertZeroRows(
  'SELECT em "fornecedores" do Tenant B via contexto do Tenant A',
  () => sqlA`SELECT id FROM fornecedores WHERE tenant_id = ${TENANT_B_ID} LIMIT 5`
);

await assertZeroRows(
  'SELECT em "notas_fiscais" do Tenant B via contexto do Tenant A',
  () => sqlA`SELECT id FROM notas_fiscais WHERE tenant_id = ${TENANT_B_ID} LIMIT 5`
);

await assertZeroRows(
  'SELECT em "medicoes" do Tenant B via contexto do Tenant A',
  () => sqlA`SELECT id FROM medicoes WHERE tenant_id = ${TENANT_B_ID} LIMIT 5`
);

// ── Bloco 3: Escrita cruzada (Tenant A escrevendo em tabelas do Tenant B) ───
console.log('\n📋  Bloco 3: Escrita cruzada — Tenant A escrevendo no Tenant B');

await assertZeroAffected(
  'UPDATE em "obras" do Tenant B via contexto do Tenant A',
  () => sqlA`UPDATE obras SET nome = 'hack_tentativa' WHERE tenant_id = ${TENANT_B_ID} RETURNING id`
);

await assertZeroAffected(
  'DELETE em "lancamentos" do Tenant B via contexto do Tenant A',
  () => sqlA`DELETE FROM lancamentos WHERE tenant_id = ${TENANT_B_ID} RETURNING id`
);

// ── Bloco 4: INSERT com tenant_id cruzado ────────────────────────────────────
console.log('\n📋  Bloco 4: INSERT com tenant_id cruzado');

await assertZeroAffected(
  'INSERT em "obras" com tenant_id do Tenant B via contexto do Tenant A',
  () => sqlA`
    INSERT INTO obras (id, tenant_id, nome, status, created_at)
    VALUES (
      'rls_test_' || substr(md5(random()::text), 1, 8),
      ${TENANT_B_ID},
      '__RLS_TEST_DEVE_FALHAR__',
      'planejamento',
      NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `
);

// ── Bloco 5: Leitura legítima (Tenant A lê apenas seus próprios dados) ───────
console.log('\n📋  Bloco 5: Leitura legítima — Tenant A lê apenas os próprios dados');

try {
  const rowsA = await sqlA`SELECT tenant_id FROM obras WHERE tenant_id != ${TENANT_A_ID} LIMIT 1`;
  if (rowsA.length === 0) {
    pass('Nenhum dado de outro tenant visível para o Tenant A');
  } else {
    fail('Dados de outro tenant visíveis para o Tenant A', `tenant_id encontrado: ${rowsA[0].tenant_id}`);
  }
} catch (err) {
  fail('Leitura legítima do Tenant A', err.message);
}

// ── Bloco 6: Simetria Tenant B → Tenant A ───────────────────────────────────
console.log('\n📋  Bloco 6: Simetria — Tenant B lendo dados do Tenant A');

await assertZeroRows(
  'SELECT em "obras" do Tenant A via contexto do Tenant B',
  () => sqlB`SELECT id FROM obras WHERE tenant_id = ${TENANT_A_ID} LIMIT 5`
);

await assertZeroRows(
  'SELECT em "lancamentos" do Tenant A via contexto do Tenant B',
  () => sqlB`SELECT id FROM lancamentos WHERE tenant_id = ${TENANT_A_ID} LIMIT 5`
);

// ── Bloco 7: Modo system (isSystem: true) ────────────────────────────────────
console.log('\n📋  Bloco 7: Modo system — isSystem deve permitir leitura cross-tenant');

const sqlSystem = createTenantSql(baseSql, { tenantId: TENANT_A_ID, isSystem: true });

try {
  // Com isSystem=true, a política RLS deve permitir acesso.
  // Não testamos que retorna dados (pode não haver dados no Tenant B),
  // mas a query não deve ser rejeitada por RLS.
  await sqlSystem`SELECT COUNT(*)::int AS total FROM obras WHERE tenant_id = ${TENANT_B_ID}`;
  pass('Acesso system cross-tenant não rejeitado por RLS (comportamento esperado)');
} catch (err) {
  if (/permission denied|rls|policy/i.test(err.message)) {
    fail('Modo system bloqueado por RLS — política app.is_system não está configurada', err.message);
  } else {
    fail('Erro inesperado no modo system', err.message);
  }
}

// ── Resultado final ──────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`  Resultado: ${passed} ✅  passaram | ${failed} ❌  falharam`);
console.log('─'.repeat(60) + '\n');

if (failed > 0) {
  console.error('🚨  FALHAS DETECTADAS — NÃO trocar DATABASE_URL em produção.');
  process.exit(1);
} else {
  console.log('🎉  Todos os testes passaram. Isolamento RLS confirmado.');
  process.exit(0);
}
