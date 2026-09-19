// api/_bim-render.js — Endpoint de Renderização Fotorrealista por IA do FinGo BIM Studio
import { resolveAuthAndTenant } from './_auth.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';
import { callGeminiImageGeneration } from './_ai-key-pool.js';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '6mb'
    }
  }
};

const ALLOWED_ORIGINS = [
  'https://fingo.api.br',
  'https://www.fingo.api.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

export default async function handler(req, res) {
  const origin = req.headers?.origin;
  if (res.setHeader) {
    res.setHeader('Vary', 'Origin');
    if (origin) {
      const isAllowed = ALLOWED_ORIGINS.includes(origin) || 
        /^https:\/\/finan-as(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin) ||
        /^https:\/\/[a-z0-9-]+\.workers\.dev$/i.test(origin);
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-api-key, x-tenant-id, X-Requested-With');
  }

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método não permitido' });

  // Autenticação opcional mas recomendada (permite uso de sessão ou IP rate-limit)
  const auth = await resolveAuthAndTenant(req);
  const clientIp = getClientIp(req);
  const rateKey = auth.authenticated ? `bim_render:user:${auth.user?.userId}` : `bim_render:ip:${clientIp}`;

  const rl = await checkRateLimit(rateKey, 15, 300000); // 15 renders a cada 5 min
  if (!rl.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Limite de renderizações atingido (máximo 15 a cada 5 minutos). Aguarde alguns instantes.'
    });
  }

  try {
    const { prompt, image } = req.body || {};
    let base64 = '';
    let mimeType = 'image/jpeg';

    if (image && typeof image === 'string') {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64 = match[2];
      } else {
        base64 = image;
      }
    }

    const result = await callGeminiImageGeneration({
      prompt,
      imageBase64: base64,
      mimeType
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || 'Falha na renderização de IA' });
    }

    return res.status(200).json({
      success: true,
      imageUrl: result.imageUrl,
      provider: result.provider,
      source: result.source
    });
  } catch (err) {
    console.error('[FinGo BIM Render] Erro inesperado:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao processar renderização com IA' });
  }
}
