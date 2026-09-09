// api/send-whatsapp.js — Serverless Proxy seguro para disparo de WhatsApp via Render Backend / Evolution API

import { resolveAuthAndTenant } from './_auth.js';

const ALLOWED_ORIGINS = [
  'https://finobra.app.br',
  'https://www.finobra.app.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

export default async function handler(req, res) {
  // Configura CORS seguro
  const origin = req.headers.origin;
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-api-key, x-tenant-id, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const auth = resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error || 'Não autorizado. Forneça o token de autenticação.' });
  }

  try {
    const { phone, number, text, message, base64, mimeType, fileName, caption } = req.body || {};
    const destPhone = (phone || number || '').replace(/\D/g, '');
    const msgText = text || message || caption || '';

    if (!destPhone || (!msgText && !base64)) {
      return res.status(400).json({ error: 'Telefone e mensagem/arquivo são obrigatórios.' });
    }

    const numFmt = destPhone.startsWith('55') ? destPhone : `55${destPhone}`;
    
    // Proteção contra SSRF: Destino estritamente fixado no servidor oficial do Render
    const targetUrl = (process.env.RENDER_WHATSAPP_URL || 'https://finan-wf12.onrender.com/send-message').trim();
    const internalSecret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'FinObra-API/2.3'
    };
    if (internalSecret) {
      headers['Authorization'] = `Bearer ${internalSecret}`;
      headers['x-api-key'] = internalSecret;
    }

    const payloadObj = {
      number: numFmt,
      phone: numFmt,
      to: numFmt,
      text: msgText,
      message: msgText,
      caption: caption || msgText
    };
    if (base64) {
      payloadObj.base64 = base64;
      payloadObj.mimeType = mimeType;
      payloadObj.fileName = fileName;
    }

    const bodyPayload = JSON.stringify(payloadObj);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: headers,
      body: bodyPayload,
      signal: AbortSignal.timeout(15000)
    });

    const data = await response.json().catch(() => ({ status: response.status }));

    if (response.ok) {
      return res.status(200).json({ success: true, to: numFmt, result: data });
    } else if (response.status === 503) {
      return res.status(200).json({
        success: false,
        notConnected: true,
        error: data.error || 'WhatsApp ainda não está conectado no servidor.',
        status: data.status || 'qr_ready'
      });
    } else {
      return res.status(response.status).json({ success: false, error: data.error || 'Erro no envio pelo servidor WhatsApp', details: data });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

