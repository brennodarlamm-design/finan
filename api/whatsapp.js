// api/whatsapp.js — Serverless Proxy Seguro para Gerenciamento do WhatsApp no FinObra

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

function getRenderBaseUrl() {
  const custom = (process.env.RENDER_WHATSAPP_URL || '').trim();
  if (custom) {
    return custom.replace(/\/send-message\/?$/, '').replace(/\/+$/, '');
  }
  return 'https://finan-wf12.onrender.com';
}

export default async function handler(req, res) {
  // CORS Seguro
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

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-api-key, x-tenant-id, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Validação de Autenticação do Usuário FinObra
  const auth = resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(401).json({
      success: false,
      error: auth.error || 'Acesso não autorizado. Efetue login no sistema.'
    });
  }

  const action = req.query?.action || req.body?.action || 'session';
  const renderBase = getRenderBaseUrl();
  const internalSecret = (process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();

  const authHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'FinObra-WhatsApp-Proxy/1.0'
  };

  if (internalSecret) {
    authHeaders['Authorization'] = `Bearer ${internalSecret}`;
    authHeaders['x-api-key'] = internalSecret;
  }

  try {
    // ── AÇÃO: CONSULTAR STATUS DA SESSÃO E QR CODE ──────────────────────────
    if (action === 'session' || action === 'status') {
      try {
        const response = await fetch(`${renderBase}/whatsapp-session`, {
          method: 'GET',
          headers: authHeaders,
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          // Se o backend ainda não tiver a rota /whatsapp-session (durante transição de deploy), tenta o /status
          if (response.status === 404) {
            const fallbackRes = await fetch(`${renderBase}/status`, {
              method: 'GET',
              headers: authHeaders,
              signal: AbortSignal.timeout(6000)
            });
            const fallbackData = await fallbackRes.json().catch(() => ({}));
            return res.status(200).json({
              success: true,
              status: fallbackData.status || (fallbackData.connected ? 'connected' : 'connecting'),
              connected: !!fallbackData.connected,
              connectedNumber: null,
              qrDataUrl: null,
              lastConnectedAt: fallbackData.last_connected || null,
              isDeploying: true
            });
          }
          return res.status(response.status).json({
            success: false,
            error: `Servidor WhatsApp retornou status ${response.status}`
          });
        }

        const data = await response.json();
        return res.status(200).json(data);
      } catch (fetchErr) {
        return res.status(200).json({
          success: true,
          status: 'connecting',
          connected: false,
          connectedNumber: null,
          qrDataUrl: null,
          warmingUp: true,
          message: 'Iniciando servidor de WhatsApp...'
        });
      }
    }

    // ── AÇÃO: DESCONECTAR OU FORÇAR NOVO QR CODE ───────────────────────────
    if (action === 'disconnect' || action === 'reset') {
      try {
        const response = await fetch(`${renderBase}/reset-auth`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ reason: 'Desconexão solicitada pelo usuário no painel' }),
          signal: AbortSignal.timeout(15000)
        });

        const data = await response.json().catch(() => ({ success: true }));
        return res.status(200).json({
          success: true,
          message: 'Sessão desconectada com sucesso. Gerando novo QR Code...',
          data
        });
      } catch (err) {
        return res.status(500).json({
          success: false,
          error: 'Falha ao solicitar desconexão ao servidor Render: ' + err.message
        });
      }
    }

    // ── AÇÃO: DISPARO DE TESTE ─────────────────────────────────────────────
    if (action === 'test') {
      const destPhone = (req.body?.phone || req.query?.phone || '').replace(/\D/g, '');
      const testMsg = req.body?.message || `*FinObra — Teste de Notificação*\n\n✅ Olá! Seu WhatsApp está conectado e pronto para enviar relatórios, alertas de vencimento de boletos e comprovantes da sua construtora.`;

      const response = await fetch(`${renderBase}/send-message`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          phone: destPhone,
          message: testMsg,
          text: testMsg
        }),
        signal: AbortSignal.timeout(15000)
      });

      const data = await response.json().catch(() => ({ status: response.status }));
      if (response.ok) {
        return res.status(200).json({ success: true, message: 'Mensagem de teste enviada!', result: data });
      } else if (response.status === 503) {
        return res.status(200).json({
          success: false,
          notConnected: true,
          error: data.error || 'WhatsApp ainda não está conectado no servidor.',
          status: data.status || 'qr_ready'
        });
      } else {
        return res.status(response.status).json({
          success: false,
          error: data.error || 'Erro ao enviar mensagem de teste',
          details: data
        });
      }
    }

    return res.status(400).json({ error: `Ação "${action}" desconhecida.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
