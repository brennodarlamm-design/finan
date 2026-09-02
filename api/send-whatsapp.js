// api/send-whatsapp.js — Serverless Proxy para disparo silencioso de WhatsApp via Evolution API / Webhook

export default async function handler(req, res) {
  // Configura CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, apikey, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { phone, number, text, message, base64, mimeType, fileName, caption, apiUrl, apiKey, instance } = req.body || {};
    const destPhone = (phone || number || '').replace(/\D/g, '');
    const msgText = text || message || caption || '';

    if (!destPhone || (!msgText && !base64)) {
      return res.status(400).json({ error: 'Telefone e mensagem/arquivo são obrigatórios.' });
    }

    const numFmt = destPhone.startsWith('55') ? destPhone : `55${destPhone}`;
    let targetBaseUrl = (apiUrl || process.env.EVOLUTION_API_URL || 'https://finan-wf12.onrender.com/send-message').trim();
    
    // Se a URL enviada for um túnel temporário que expirou ou localhost, redireciona para o Render
    if (targetBaseUrl.includes('trycloudflare.com') || targetBaseUrl.includes('loca.lt') || targetBaseUrl.includes('ngrok')) {
      targetBaseUrl = 'https://finan-wf12.onrender.com/send-message';
    }

    const targetApiKey = (apiKey || process.env.EVOLUTION_API_KEY || '').trim();
    const targetInstance = (instance || process.env.EVOLUTION_INSTANCE || 'angelim').trim();

    let targetUrl = targetBaseUrl;
    const headers = {
      'Content-Type': 'application/json',
      'bypass-tunnel-reminder': 'true',
      'Bypass-Tunnel-Reminder': 'true',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    };

    if (!targetBaseUrl.includes('/send-message') && !targetBaseUrl.includes('/message/sendText')) {
      const cleanBase = targetBaseUrl.replace(/\/$/, '');
      targetUrl = `${cleanBase}/message/sendText/${targetInstance}`;
      if (targetApiKey) {
        headers['apikey'] = targetApiKey;
        headers['Authorization'] = `Bearer ${targetApiKey}`;
      }
    } else if (targetApiKey) {
      headers['apikey'] = targetApiKey;
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

    let response;
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers: headers,
        body: bodyPayload,
        signal: AbortSignal.timeout(6000)
      });
    } catch (primaryErr) {
      console.warn('Falha no targetUrl primário, tentando fallback Render 24/7:', primaryErr.message);
      // Fallback automático para o backend em nuvem do Render
      const cloudUrl = 'https://finan-wf12.onrender.com/send-message';
      response = await fetch(cloudUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyPayload,
        signal: AbortSignal.timeout(10000)
      });
    }

    const data = await response.json().catch(() => ({ status: response.status }));

    if (response.ok) {
      return res.status(200).json({ success: true, to: numFmt, result: data });
    } else {
      return res.status(response.status).json({ success: false, error: data.error || 'Erro no envio', details: data });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
