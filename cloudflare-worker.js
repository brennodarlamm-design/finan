const DEFAULT_API_ORIGIN = 'https://finobra.app.br';
const DEFAULT_CANONICAL_ORIGIN = 'https://finobra.app.br';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function sameOriginBrowserRequest(request) {
  const origin = String(request.headers.get('Origin') || '').trim();
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function upstreamOrigin(env) {
  const raw = String(env.FINOBRA_API_ORIGIN || DEFAULT_API_ORIGIN).trim();
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('FINOBRA_API_ORIGIN deve usar HTTPS.');
  return url.origin;
}

function canonicalOrigin(env) {
  const raw = String(env.FINOBRA_CANONICAL_ORIGIN || DEFAULT_CANONICAL_ORIGIN).trim();
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('FINOBRA_CANONICAL_ORIGIN deve usar HTTPS.');
  return url.origin;
}

function isAuthAction(url, action) {
  return url.pathname === '/api/auth' && url.searchParams.get('action') === action;
}

function addRecoveryAliases(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const next = { ...payload };
  if (next.requestId && !next.userId) next.userId = next.requestId;
  if (next.userId && !next.requestId) next.requestId = next.userId;
  return next;
}

async function proxyApi(request, env) {
  const method = String(request.method || 'GET').toUpperCase();

  if (!SAFE_METHODS.has(method) && !sameOriginBrowserRequest(request)) {
    return Response.json({ ok: false, error: 'Origem não autorizada.' }, { status: 403 });
  }

  let incoming;
  let target;
  try {
    incoming = new URL(request.url);
    target = new URL(incoming.pathname + incoming.search, upstreamOrigin(env));
  } catch (err) {
    console.error('[FinObra Cloudflare] configuração de API inválida:', err?.message || err);
    return Response.json({ ok: false, error: 'Gateway de API indisponível.' }, { status: 503 });
  }

  const headers = new Headers(request.headers);
  for (const name of [
    'host', 'content-length', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor',
    'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip'
  ]) headers.delete(name);

  if (!SAFE_METHODS.has(method)) headers.set('Origin', canonicalOrigin(env));
  headers.set('X-FinObra-Edge', 'cloudflare-worker');

  const init = { method, headers, redirect: 'manual' };

  if (!['GET', 'HEAD'].includes(method)) {
    const rawBody = await request.arrayBuffer();
    let body = rawBody;

    // Compatibilidade bidirecional entre contratos antigos (userId)
    // e novos (requestId) do fluxo de recuperação de senha.
    if (isAuthAction(incoming, 'verify_reset') && rawBody.byteLength) {
      try {
        const text = new TextDecoder().decode(rawBody);
        const payload = addRecoveryAliases(JSON.parse(text));
        body = JSON.stringify(payload);
        headers.set('Content-Type', 'application/json');
      } catch (err) {
        console.warn('[FinObra Cloudflare] não foi possível normalizar verify_reset:', err?.message || err);
      }
    }

    init.body = body;
  }

  try {
    const upstream = await fetch(target.toString(), init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (isAuthAction(incoming, 'request_reset') && upstream.ok) {
      const data = await upstream.clone().json().catch(() => null);
      if (data && data.success) {
        const normalized = addRecoveryAliases(data);
        responseHeaders.delete('content-length');
        responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify(normalized), {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: responseHeaders
        });
      }
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    console.error('[FinObra Cloudflare] upstream indisponível:', err?.message || err);
    return Response.json({ ok: false, error: 'Não foi possível acessar a API no momento.' }, { status: 502 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return proxyApi(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
