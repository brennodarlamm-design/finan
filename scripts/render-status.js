// scripts/render-status.js — Verifica o status do servico e variaveis no Render
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.RENDER_API_KEY;
if (!apiKey) {
  console.error('❌ RENDER_API_KEY não encontrado em .env.local');
  process.exit(1);
}

const SERVICE_ID = 'srv-daad9ghsrm7s73ekn020';

console.log('🔍 Consultando status do serviço no Render...');

try {
  const [srvRes, deploysRes, healthRes] = await Promise.all([
    fetch(`https://api.render.com/v1/services/${SERVICE_ID}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    }).then(r => r.json()),
    fetch(`https://api.render.com/v1/services/${SERVICE_ID}/deploys?limit=1`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    }).then(r => r.json()),
    fetch('https://finan-wf12.onrender.com/health').then(r => r.json()).catch(e => ({ error: e.message }))
  ]);

  console.log('----------------------------------------------------');
  console.log(`📦 Serviço: ${srvRes.name} (${srvRes.slug})`);
  console.log(`🌐 URL: ${srvRes.serviceDetails?.url}`);
  console.log(`🌿 Branch: ${srvRes.branch}`);
  console.log(`🚀 Último Deploy: ${deploysRes[0]?.deploy?.status} (${deploysRes[0]?.deploy?.commit?.message?.slice(0, 50)}...)`);
  console.log(`🩺 Healthcheck:`, healthRes);
  console.log('----------------------------------------------------');
} catch (err) {
  console.error('❌ Erro ao consultar Render:', err.message);
}
