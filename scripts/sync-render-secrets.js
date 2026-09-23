import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.RENDER_API_KEY;
const SERVICE_ID = 'srv-dak05l8jo6nc73fh98cg';

// Variables to sync from .env.local to Render
const varsToSync = {
  DATABASE_OWNER_URL: process.env.DATABASE_OWNER_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  CERT_ENCRYPTION_KEY: process.env.CERT_ENCRYPTION_KEY || process.env.API_SECRET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_API_KEYS: process.env.GEMINI_API_KEYS,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  MEUDANFE_API_KEY: process.env.MEUDANFE_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY,
  TRIGGER_API_KEY: process.env.TRIGGER_API_KEY,
  MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY,
  TENANT_KEY_PEPPER: process.env.TENANT_KEY_PEPPER,
  IP_BAN_PEPPER: process.env.IP_BAN_PEPPER,
  FINOBRA_BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  FINOBRA_SUPPORT_EMAIL: process.env.FINOBRA_SUPPORT_EMAIL,
  FINOBRA_SUPPORT_EMAIL_FROM: process.env.FINOBRA_SUPPORT_EMAIL_FROM,
  FINOBRA_SUPPORT_WHATSAPP: process.env.FINOBRA_SUPPORT_WHATSAPP,
  FINOBRA_MASTER_URL: 'https://fingo.api.br'
};

console.log('🔄 Sincronizando variáveis de ambiente no Render...');

for (const [key, val] of Object.entries(varsToSync)) {
  if (!val) {
    console.log(`⚠️ ${key}: valor não encontrado localmente, pulando.`);
    continue;
  }
  try {
    const res = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/env-vars/${key}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: val })
    });
    if (res.ok) {
      console.log(`✅ ${key}: sincronizada com sucesso.`);
    } else {
      console.warn(`❌ ${key}: falha (${res.status}):`, await res.text());
    }
  } catch (err) {
    console.error(`❌ ${key}: erro na requisição:`, err.message);
  }
}

console.log('🏁 Sincronização concluída.');
