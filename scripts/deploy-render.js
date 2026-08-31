import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const API_BASE = 'https://api.render.com/v1';

if (!RENDER_API_KEY) {
  console.error('❌ ERRO: RENDER_API_KEY não foi definida nas variáveis de ambiente ou no .env.local');
  process.exit(1);
}

async function req(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Erro API Render [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log('Conectando à API do Render...');

  // 1. Obter Owner ID
  const owners = await req('/owners');
  if (!owners || owners.length === 0) {
    throw new Error('Nenhum proprietário encontrado na conta do Render.');
  }

  const owner = owners[0].owner;
  console.log(`Proprietário identificado: ${owner.name} (${owner.id}) - ${owner.email}`);

  // 2. Verificar se o serviço já existe
  const services = await req('/services?limit=50');
  let existing = services.find(s => s.service?.name === 'angelim-backend' || s.service?.repo?.includes('finan'));

  if (existing) {
    console.log(`Serviço existente encontrado: ${existing.service.name} (${existing.service.id})`);
    console.log(`URL do serviço: ${existing.service.serviceDetails?.url}`);
    
    // Dispara novo deploy
    console.log('Disparando deploy da versão mais recente...');
    const deploy = await req(`/services/${existing.service.id}/deploys`, {
      method: 'POST',
      body: JSON.stringify({ clearCache: 'do_not_clear' })
    });
    console.log(`✅ Deploy iniciado! ID: ${deploy.id}`);
    console.log(`🔗 Acompanhe em: https://dashboard.render.com/web/${existing.service.id}`);
    console.log(`🌐 URL Pública: ${existing.service.serviceDetails?.url}`);
    return;
  }

  // 3. Criar novo Web Service
  console.log('Criando novo Web Service no Render para Angelim Construtora...');

  const payload = {
    type: 'web_service',
    name: 'angelim-backend',
    ownerId: owner.id,
    repo: 'https://github.com/brennodarlamm-design/finan',
    branch: 'main',
    rootDir: 'backend',
    autoDeploy: 'yes',
    serviceDetails: {
      env: 'node',
      plan: 'free',
      region: 'ohio',
      buildCommand: 'npm install',
      startCommand: 'node server.js',
      envVars: [
        {
          key: 'DATABASE_URL',
          value: process.env.DATABASE_URL || ''
        },
        {
          key: 'TARGET_PHONE',
          value: process.env.TARGET_PHONE || '5595991363678'
        },
        {
          key: 'PORT',
          value: '3333'
        }
      ]
    }
  };

  const created = await req('/services', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  console.log('\n======================================================');
  console.log('🎉 SERVIÇO CRIADO COM SUCESSO NO RENDER!');
  console.log(`Nome: ${created.name}`);
  console.log(`ID: ${created.id}`);
  console.log(`🔗 Painel: https://dashboard.render.com/web/${created.id}`);
  console.log(`🌐 URL Pública: ${created.serviceDetails?.url || 'Aguardando provisionamento...'}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('❌ Erro no script Render:', err.message);
  process.exit(1);
});
