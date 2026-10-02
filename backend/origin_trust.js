// backend/origin_trust.js — fronteira de confiança da origem Render (AUDIT-2026-10-02 R2).
//
// - Requisição vinda do Worker (X-FinGo-Origin-Auth == ORIGIN_SHARED_SECRET): o IP real do
//   cliente vem em X-FinGo-Client-IP.
// - Qualquer outra (acesso direto ao *.onrender.com): cabeçalhos de IP de CDN/proxy enviados
//   pelo cliente são descartados e vale o último salto do X-Forwarded-For (adicionado pelo
//   balanceador do Render, não pelo cliente).
// - ORIGIN_ENFORCE_EDGE=true: rotas /api/* aceitam somente tráfego do Worker
//   (webhooks e health continuam liberados porque têm autenticação própria).
// - Sem ORIGIN_SHARED_SECRET, nada muda (evita agrupar todos os usuários sob o IP do proxy
//   antes de o segredo estar configurado no Worker e no Render).
import crypto from 'crypto';

export const ORIGIN_EDGE_EXEMPT = ['/api/health', '/api/webhook-pix', '/api/webhook-email', '/api/webhook-whatsapp'];
const SPOOFABLE_HEADERS = ['cf-connecting-ip', 'cf-ray', 'true-client-ip', 'x-real-ip', 'x-vercel-id', 'x-vercel-forwarded-for', 'x-fingo-client-ip', 'x-fingo-origin-auth'];

export function isTrustedEdgeRequest(headers, secret) {
  const provided = String(headers['x-fingo-origin-auth'] || '').trim();
  if (!secret || !provided) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

export function createOriginTrustMiddleware(getEnv = () => process.env) {
  return function originTrust(req, res, next) {
    const env = getEnv();
    const secret = String(env.ORIGIN_SHARED_SECRET || '').trim();
    if (!secret) return next();

    const trusted = isTrustedEdgeRequest(req.headers, secret);
    const edgeClientIp = String(req.headers['x-fingo-client-ip'] || '').trim();
    for (const h of SPOOFABLE_HEADERS) delete req.headers[h];

    if (trusted && edgeClientIp) {
      req.headers['x-real-ip'] = edgeClientIp;
    } else {
      const hops = String(req.headers['x-forwarded-for'] || '').split(',').map(v => v.trim()).filter(Boolean);
      if (hops.length) req.headers['x-real-ip'] = hops[hops.length - 1];
    }
    req.fromTrustedEdge = trusted;

    const enforce = String(env.ORIGIN_ENFORCE_EDGE || '').trim().toLowerCase() === 'true';
    const path = String(req.path || req.url || '').split('?')[0];
    if (enforce && !trusted && path.startsWith('/api/') && !ORIGIN_EDGE_EXEMPT.some(p => path === p || path.startsWith(p + '/'))) {
      return res.status(403).json({ error: 'Acesse a API pelo domínio oficial.' });
    }
    return next();
  };
}
