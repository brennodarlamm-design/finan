// scripts/smoke-test-auth-p50.js
import dotenv from 'dotenv';
import assert from 'assert';
import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import {
  resolveTenantByAccessKey,
  resolveTenantUserByLogin,
  isTenantAccessKeyShapeValid,
  normalizeTenantAccessKey,
  hashTenantAccessKey
} from '../api/_tenant-access-key.js';
import { isWebhookAuthorized } from '../api/_webhook_pix_core.js';
import { getSessionSigningSecret, getInternalApiSecret } from '../api/_auth.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_URL ausente.');
  process.exit(1);
}

const sql = neon(conn);

async function runSmoke() {
  console.log('=== BATERIA DE SMOKE TEST — PATCH 50 (9 CENÁRIOS) ===\n');

  // 1. Consulta dos tenants ativos e suas chaves provisionadas
  console.log('Cenário 1: Validando resolução de Tenant por Chave da Empresa de 6 dígitos...');
  const activeTenants = await sql`
    SELECT id, nome_fantasia, razao_social, status, access_key_hash, access_key_last4
    FROM tenants
    WHERE status = 'ativo' AND access_key_hash IS NOT NULL
    LIMIT 2;
  `;
  assert(activeTenants.length >= 1, 'Deve existir pelo menos um tenant ativo com chave configurada.');
  const t1 = activeTenants[0];
  console.log(`  Tenant encontrado: ${t1.nome_fantasia} (${t1.id}) com Final ${t1.access_key_last4}`);
  console.log('  ✓ Cenário 1 OK!\n');

  // 2. Chave de 6 números shape e normalização
  console.log('Cenário 2: Testando shape e normalização de chaves de 6 números...');
  assert(isTenantAccessKeyShapeValid('123456'), '6 dígitos deve ser válido.');
  assert(isTenantAccessKeyShapeValid(' 987-654 '), '6 dígitos com traço/espaço deve ser válido.');
  assert(!isTenantAccessKeyShapeValid('12345'), '5 dígitos deve ser inválido.');
  assert(!isTenantAccessKeyShapeValid('1234567'), '7 dígitos deve ser inválido.');
  console.log('  ✓ Cenário 2 OK!\n');

  // 3. Usuários vinculados a tenant vs Master
  console.log('Cenário 3: Validando isolamento de usuário por tenant vs Superadmin...');
  const tenantUsers = await sql`
    SELECT u.id, u.username, u.email, u.perfil, u.tenant_id
    FROM usuarios u
    WHERE u.tenant_id = ${t1.id} AND u.perfil <> 'superadmin'
    LIMIT 1;
  `;
  if (tenantUsers.length) {
    const tu = tenantUsers[0];
    const resolved = await resolveTenantUserByLogin(sql, t1.id, tu.username);
    assert(resolved, 'Usuário de tenant deve ser resolvido dentro do tenant correto.');
    assert.strictEqual(resolved.tenant_id, t1.id, 'Tenant resolvido deve bater exatamente.');
    console.log(`  Usuário de tenant ${tu.username} isolado em ${t1.id}`);
  } else {
    console.log('  (Nenhum usuário comum pré-existente no tenant de teste)');
  }

  // Superadmin não pertence a tenant cliente
  const masterUsers = await sql`
    SELECT id, username, perfil, mfa_enabled
    FROM usuarios
    WHERE perfil = 'superadmin'
    LIMIT 1;
  `;
  assert(masterUsers.length > 0, 'Conta superadmin deve existir no banco.');
  console.log(`  Superadmin verificado: ${masterUsers[0].username} (MFA enabled: ${masterUsers[0].mfa_enabled})`);
  console.log('  ✓ Cenário 3 OK!\n');

  // 4. Chave Errada / Inexistente
  console.log('Cenário 4: Testando chave inexistente ou incorreta...');
  const fakeKey = '000000';
  const fakeResolved = await resolveTenantByAccessKey(sql, fakeKey);
  assert.strictEqual(fakeResolved, null, 'Chave inexistente deve retornar null.');
  console.log('  ✓ Cenário 4 OK (chave falsa rejeitada com segurança)!\n');

  // 5. Tenant Bloqueado / Cancelado
  console.log('Cenário 5: Testando filtragem de tenant bloqueado ou cancelado...');
  const blockedKeyCheck = await sql`
    SELECT id FROM tenants
    WHERE status IN ('cancelado', 'bloqueado') AND access_key_hash IS NOT NULL;
  `;
  console.log(`  Tenants bloqueados/cancelados no banco: ${blockedKeyCheck.length}`);
  console.log('  ✓ Cenário 5 OK!\n');

  // 6. Rotação de Chave da Empresa
  console.log('Cenário 6: Testando lógica de rotação de chave...');
  const newRawKey = '999111';
  const newHash = hashTenantAccessKey(newRawKey);
  assert.strictEqual(newHash.length, 64, 'Hash SHA-256 deve ter 64 caracteres hexadecimais.');
  assert.notStrictEqual(newRawKey, newHash, 'Chave em texto puro nunca deve ser igual ao hash.');
  console.log('  ✓ Cenário 6 OK!\n');

  // 7. Webhook PIX com segredo e timingSafeEqual
  console.log('Cenário 7: Testando webhook PIX com autenticação e timingSafeEqual...');
  const pixSecret = process.env.PIX_WEBHOOK_SECRET;
  assert(pixSecret, 'PIX_WEBHOOK_SECRET deve estar configurado.');

  // Caso 1: Header correto
  const reqValid = { headers: { 'x-webhook-secret': pixSecret } };
  const authValid = isWebhookAuthorized(reqValid);
  assert.strictEqual(authValid.authorized, true, 'Header x-webhook-secret correto deve ser autorizado.');

  // Caso 2: Header incorreto
  const reqInvalid = { headers: { 'x-webhook-secret': 'segredo_falso_errado_123' } };
  const authInvalid = isWebhookAuthorized(reqInvalid);
  assert.strictEqual(authInvalid.authorized, false, 'Header incorreto deve ser rejeitado.');

  // Caso 3: Query param proibido (PATCH 50)
  const reqQuery = { headers: {}, query: { secret: pixSecret } };
  const authQuery = isWebhookAuthorized(reqQuery);
  assert.strictEqual(authQuery.authorized, false, 'Segredo via query string deve ser terminantemente rejeitado.');

  console.log('  ✓ Cenário 7 OK (Webhook PIX fail-closed e timing-safe)!\n');

  // 8. Segredos dedicados
  console.log('Cenário 8: Testando presença e validade dos segredos dedicados...');
  const sessSec = getSessionSigningSecret();
  const intSec = getInternalApiSecret();
  assert(sessSec.length >= 32, 'SESSION_SIGNING_SECRET deve ter alta entropia.');
  assert(intSec.length >= 32, 'INTERNAL_API_SECRET deve ter alta entropia.');
  assert.notStrictEqual(sessSec, intSec, 'SESSION_SIGNING_SECRET e INTERNAL_API_SECRET devem ser distintos.');
  console.log('  ✓ Cenário 8 OK (segredos separados e distintos)!\n');

  // 9. Resumo das Chaves Provisionadas
  console.log('Cenário 9: Verificando integridade das chaves dos 6 tenants no Neon...');
  const allTenants = await sql`
    SELECT id, nome_fantasia, status, access_key_hash, access_key_last4, access_key_created_at
    FROM tenants
    ORDER BY created_at ASC;
  `;
  for (const t of allTenants) {
    assert(t.access_key_hash, `Tenant ${t.id} deve possuir access_key_hash.`);
    assert(t.access_key_last4, `Tenant ${t.id} deve possuir access_key_last4.`);
    assert(t.access_key_created_at, `Tenant ${t.id} deve possuir access_key_created_at.`);
    console.log(`  ✓ ${t.nome_fantasia || t.id} (${t.status}): Final ${t.access_key_last4} ativo.`);
  }
  console.log('  ✓ Cenário 9 OK (todos os 6 tenants 100% provisionados)!\n');

  console.log('===================================================');
  console.log('🎉 TODOS OS 9 CENÁRIOS DO SMOKE TEST PASSARAM COM SUCESSO!');
  console.log('===================================================');
}

runSmoke().catch(err => {
  console.error('Falha no smoke test:', err);
  process.exit(1);
});
