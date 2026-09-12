const DEFAULT_API_ORIGIN = 'https://finan-as.vercel.app';
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

export async function onRequest(context) {
  const { request, env } = context;
  const method = String(request.method || 'GET').toUpperCase();

  // O navegador fala apenas com o domínio Cloudflare. Antes de encaminhar cookies
  // HttpOnly à Vercel, o edge rejeita mutações cross-site para preservar a proteção CSRF.
  if (!SAFE_METHODS.has(method) && !sameOriginBrowserRequest(request)) {
    return Response.json({ ok: false, error: 'Origem não autorizada.' }, { status: 403 });
  }

  let target;
  try {
    const incoming = new URL(request.url);
    target = new URL(incoming.pathname + incoming.search, upstreamOrigin(env));
  } catch (err) {
    console.error('[Cloudflare API proxy] configuração inválida:', err?.message || err);
    return Response.json({ ok: false, error: 'Gateway de API indisponível.' }, { status: 503 });
  }

  const headers = new Headers(request.headers);
  for (const name of [
    'host', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor',
    'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip'
  ]) headers.delete(name);

  // A API atual valida Origin para mutações autenticadas por cookie. Como o proxy
  // já validou same-origin na borda, encaminhamos a origem canônica conhecida pela API.
  if (!SAFE_METHODS.has(method)) headers.set('Origin', canonicalOrigin(env));
  headers.set('X-FinObra-Edge', 'cloudflare-pages');

  const init = {
    method,
    headers,
    redirect: 'manual'
  };
  if (!['GET', 'HEAD'].includes(method)) init.body = request.body;

  try {
    const upstream = await fetch(target.toString(), init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    console.error('[Cloudflare API proxy] upstream indisponível:', err?.message || err);
    return Response.json({ ok: false, error: 'Não foi possível acessar a API no momento.' }, { status: 502 });
  }
}
