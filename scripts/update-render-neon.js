import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.RENDER_API_KEY;
if (!apiKey) {
  console.error('❌ RENDER_API_KEY ausente.');
  process.exit(1);
}

const FINAN_BACKEND_ID = 'srv-dak05l8jo6nc73fh98cg';
const EVOLUTION_GO_ID = 'srv-dart4pnpn0mc73dufvcg';

async function updateEnvVar(serviceId, serviceName, key, value) {
  try {
    const res = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars/${key}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    });
    if (res.ok) {
      console.log(`✅ [${serviceName}] ${key} atualizada.`);
    } else {
      console.warn(`❌ [${serviceName}] ${key} falhou (${res.status}):`, await res.text());
    }
  } catch (err) {
    console.error(`❌ [${serviceName}] ${key} erro:`, err.message);
  }
}

async function triggerDeploy(serviceId, serviceName) {
  try {
    const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ clearCache: 'do_not_clear' })
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`🚀 [${serviceName}] Deploy disparado com sucesso:`, data.id);
    } else {
      console.warn(`⚠️ [${serviceName}] Deploy falhou (${res.status}):`, await res.text());
    }
  } catch (err) {
    console.error(`⚠️ [${serviceName}] Deploy erro:`, err.message);
  }
}

async function main() {
  console.log('🔄 Atualizando credenciais do novo Neon no Render...');

  // 1. Atualizar FinGo Backend a partir do .env.local
  const backendVars = {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_OWNER_URL: process.env.DATABASE_OWNER_URL,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  };

  for (const [k, v] of Object.entries(backendVars)) {
    if (v) await updateEnvVar(FINAN_BACKEND_ID, 'finan-backend', k, v);
  }

  // 2. Atualizar Evolution Go a partir do .env.local
  const evoVars = {
    POSTGRES_AUTH_DB: process.env.POSTGRES_AUTH_DB || process.env.DATABASE_OWNER_URL,
    POSTGRES_USERS_DB: process.env.POSTGRES_USERS_DB || process.env.DATABASE_OWNER_URL
  };

  for (const [k, v] of Object.entries(evoVars)) {
    if (v) await updateEnvVar(EVOLUTION_GO_ID, 'evolution-go', k, v);
  }

  console.log('\n🚀 Disparando novo deploy nos 2 serviços para carregar a nova configuração...');
  await triggerDeploy(FINAN_BACKEND_ID, 'finan-backend');
  await triggerDeploy(EVOLUTION_GO_ID, 'evolution-go');

  console.log('\n🏁 Configurações enviadas e deploys solicitados no Render!');
}

main().catch(console.error);
