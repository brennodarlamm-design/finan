// scripts/render-deploy.js — Dispara deploy no Render usando a Render API / CLI
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.RENDER_API_KEY;
if (!apiKey) {
  console.error('❌ RENDER_API_KEY não encontrado em .env.local');
  process.exit(1);
}

const SERVICE_ID = 'srv-daad9ghsrm7s73ekn020'; // finan-wf12

console.log('🚀 Disparando novo deploy no Render (serviço finan-wf12)...');

try {
  const res = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ clearCache: 'do_not_clear' })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ Erro no Render (${res.status}):`, errorText);
    process.exit(1);
  }

  const deploy = await res.json();
  console.log('✅ Deploy disparado com sucesso!');
  console.log(`📋 Deploy ID: ${deploy.id}`);
  console.log(`⏱️ Status: ${deploy.status}`);
  console.log(`🔗 Dashboard: https://dashboard.render.com/web/${SERVICE_ID}`);
} catch (err) {
  console.error('❌ Erro inesperado ao disparar deploy no Render:', err.message);
  process.exit(1);
}
