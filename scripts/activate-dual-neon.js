// scripts/activate-dual-neon.js — Ativação da Arquitetura Dual Neon (Separação de Workload)
// Palavra-chave: ATIVAR DUAL NEON
//
// Esta rotina direciona o Evolution Go (WhatsApp) para o Banco Antigo (Neon 2 - sa-east-1)
// assim que a cota gratuita de CPU mensal resetar, mantendo o FinGo Core SaaS no Banco Novo (Neon 1).

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.RENDER_API_KEY;
if (!apiKey) {
  console.error('❌ RENDER_API_KEY não configurada no .env.local.');
  process.exit(1);
}

const EVOLUTION_GO_SERVICE_ID = 'srv-dart4pnpn0mc73dufvcg';

// Banco Antigo (Neon 2 - São Paulo sa-east-1)
const OLD_NEON_OWNER_URL = process.env.OLD_DATABASE_OWNER_URL || process.env.DATABASE_OWNER_URL;
const OLD_NEON_HOST = OLD_NEON_OWNER_URL ? new URL(OLD_NEON_OWNER_URL).host : '';

async function testOldNeonActive() {
  console.log('🔍 Testando conectividade com o Banco Antigo (Neon 2)...');
  try {
    const res = await fetch(`https://${OLD_NEON_HOST}/sql`, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': OLD_NEON_OWNER_URL,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: 'SELECT 1 as reset_ok;' })
    });
    const data = await res.json();
    if (res.ok && data.rows && data.rows.length > 0) {
      console.log('✅ Banco Antigo (Neon 2) está ATIVO e com cota disponível!');
      return true;
    } else {
      console.warn('⚠️ Banco Antigo respondeu com restrição ou erro:', data);
      return false;
    }
  } catch (err) {
    console.error('❌ Falha ao conectar ao Banco Antigo:', err.message);
    return false;
  }
}

async function updateRenderEnvVar(serviceId, key, value) {
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars/${key}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value })
  });
  if (!res.ok) {
    throw new Error(`Falha ao atualizar ${key} no Render (${res.status}): ${await res.text()}`);
  }
  console.log(`   ✓ ${key} atualizada com sucesso no Render.`);
}

async function triggerDeploy(serviceId) {
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ clearCache: 'do_not_clear' })
  });
  if (!res.ok) {
    throw new Error(`Falha ao disparar deploy (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  console.log('🚀 Deploy disparado no Evolution Go:', data.id);
  return data.id;
}

async function main() {
  console.log('===========================================================');
  console.log('🚀 FINGO — ATIVAÇÃO DA ARQUITETURA DUAL NEON (WORKLOAD SPLIT)');
  console.log('===========================================================\n');

  // 1. Validar status do banco antigo
  const isAvailable = await testOldNeonActive();
  if (!isAvailable) {
    console.error('\n❌ O Banco Antigo ainda não resetou a cota gratuita no Neon.');
    console.error('   Aguarde o primeiro dia do ciclo de faturamento no console do Neon.');
    process.exit(1);
  }

  // 2. Atualizar variáveis no Render do Evolution Go
  console.log('\n⚙️ Apontando Evolution Go para o Banco Antigo (Neon 2)...');
  await updateRenderEnvVar(EVOLUTION_GO_SERVICE_ID, 'POSTGRES_AUTH_DB', OLD_NEON_OWNER_URL);
  await updateRenderEnvVar(EVOLUTION_GO_SERVICE_ID, 'POSTGRES_USERS_DB', OLD_NEON_OWNER_URL);

  // 3. Reiniciar container do Evolution Go
  console.log('\n🔄 Reiniciando serviço fingo-evolution-go no Render...');
  await triggerDeploy(EVOLUTION_GO_SERVICE_ID);

  console.log('\n🎉 SUCESSO! A separação de workloads foi aplicada:');
  console.log('   • SaaS Core FinGo: Operando no Banco Novo (100h CPU)');
  console.log('   • Evolution Go WhatsApp: Operando no Banco Antigo (100h CPU)');
  console.log('   • Total de Computação Gratuita Disponível: 200h/mês!');
}

main().catch(err => {
  console.error('\n❌ Erro durante a ativação:', err.message);
  process.exit(1);
});
