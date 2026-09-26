import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.RENDER_API_KEY;
const FINAN_BACKEND_ID = 'srv-dak05l8jo6nc73fh98cg';
const EVOLUTION_GO_ID = 'srv-dart4pnpn0mc73dufvcg';

async function checkService(serviceId, name) {
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys?limit=1`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const deploys = await res.json();
  const d = deploys[0]?.deploy || deploys[0];
  console.log(`[${name}] Deploy ID: ${d?.id}, Status: ${d?.status}, CreatedAt: ${d?.createdAt}`);
}

async function main() {
  console.log('Verificando status dos deploys no Render:');
  await checkService(FINAN_BACKEND_ID, 'finan-backend');
  await checkService(EVOLUTION_GO_ID, 'evolution-go');
}

main().catch(console.error);
