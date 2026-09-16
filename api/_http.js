// api/_http.js — Camada Compartilhada de HTTP, CORS, Cache-Control e Envelopes RESTful
// Skill: api-design-principles & api-security-best-practices

export const ALLOWED_ORIGINS = Object.freeze([
  'https://finobra.app.br',
  'https://www.finobra.app.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
]);

/**
 * Valida e aplica cabeçalhos de CORS restrito e seguro.
 */
export function setCORS(req, res, options = {}) {
  const origin = req.headers?.origin;
  res.setHeader('Vary', 'Origin');

  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/finan-as(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }

  const methods = options.methods || 'GET,OPTIONS,PATCH,DELETE,POST,PUT';
  const headers = options.headers || 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apikey, x-api-key, x-tenant-id';

  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // Indicador de que a requisição OPTIONS foi finalizada
  }

  return false;
}

/**
 * Aplica cabeçalhos de Cache Privado (Zero Cache / No-Store) para dados multi-tenant sensíveis.
 */
export function setPrivateNoCache(res) {
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

/**
 * Aplica cabeçalhos de Edge Caching Inteligente no Cloudflare / CDN para catálogos estáticos e leituras públicas.
 */
export function setEdgeCacheHeaders(res, { sMaxAge = 3600, staleWhileRevalidate = 86400, isPublic = true } = {}) {
  const scope = isPublic ? 'public' : 'private';
  const headerVal = `${scope}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
  res.setHeader('Cache-Control', headerVal);
  res.setHeader('CDN-Cache-Control', headerVal);
}

/**
 * Retorna resposta de sucesso padronizada no formato RESTful.
 */
export function sendSuccess(res, payload, { status = 200, cache = 'private', edgeCacheOptions = null } = {}) {
  if (cache === 'edge' || edgeCacheOptions) {
    setEdgeCacheHeaders(res, edgeCacheOptions || {});
  } else {
    setPrivateNoCache(res);
  }

  // Se payload já for um objeto com success explícito ou array puro, envia diretamente
  if (payload && typeof payload === 'object') {
    return res.status(status).json(payload);
  }

  return res.status(status).json({
    success: true,
    data: payload
  });
}

/**
 * Retorna resposta de erro estruturada, impedindo vazamento de mensagens internas e stacktraces.
 */
export function sendError(res, message, { status = 400, code = 'BAD_REQUEST', details = null } = {}) {
  setPrivateNoCache(res);

  const body = {
    success: false,
    error: String(message || 'Erro inesperado no servidor'),
    code: String(code)
  };

  if (details && typeof details === 'object') {
    body.details = details;
  }

  return res.status(status).json(body);
}
