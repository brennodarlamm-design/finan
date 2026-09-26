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

  // 1. Atualizar FinGo Backend
  const backendVars = {
    DATABASE_URL: 'postgresql://finobra_app:fingo_app_kYKWKMZW3TpTcSqd5nmq3Gk8uLh8stR1@ep-proud-recipe-b4encxce-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
    DATABASE_OWNER_URL: 'postgresql://neondb_owner:npg_9xuOtBcag6Sh@ep-proud-recipe-b4encxce-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
    DATABASE_URL_UNPOOLED: 'postgresql://finobra_app:fingo_app_kYKWKMZW3TpTcSqd5nmq3Gk8uLh8stR1@ep-proud-recipe-b4encxce.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require'
  };

  for (const [k, v] of Object.entries(backendVars)) {
    await updateEnvVar(FINAN_BACKEND_ID, 'finan-backend', k, v);
  }

  // 2. Atualizar Evolution Go
  const evoVars = {
    POSTGRES_AUTH_DB: 'postgresql://neondb_owner:npg_9xuOtBcag6Sh@ep-proud-recipe-b4encxce.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    POSTGRES_USERS_DB: 'postgresql://neondb_owner:npg_9xuOtBcag6Sh@ep-proud-recipe-b4encxce.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  };

  for (const [k, v] of Object.entries(evoVars)) {
    await updateEnvVar(EVOLUTION_GO_ID, 'evolution-go', k, v);
  }

  console.log('\n🚀 Disparando novo deploy nos 2 serviços para carregar a nova configuração...');
  await triggerDeploy(FINAN_BACKEND_ID, 'finan-backend');
  await triggerDeploy(EVOLUTION_GO_ID, 'evolution-go');

  console.log('\n🏁 Configurações enviadas e deploys solicitados no Render!');
}

main().catch(console.error);
