import { executeEdgeApi } from './api/_edge-adapter.js';

const DEFAULT_API_ORIGIN = 'https://api.fingo.api.br';
const DEFAULT_CANONICAL_ORIGIN = 'https://fingo.api.br';
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

function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function isAppShellPath(pathname) {
  return pathname === '/app' || pathname === '/app.html' || pathname.startsWith('/app/') || pathname === '/portal' || pathname.startsWith('/portal/');
}

function isLoginShellPath(pathname) {
  return pathname === '/login' || pathname === '/login.html' || pathname === '/cadastro';
}

function isMasterShellPath(pathname) {
  return pathname === '/master' || pathname === '/master.html';
}

function canonicalRedirect(request, env) {
  const method = String(request.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) return null;

  try {
    const incoming = new URL(request.url);
    const canonical = new URL(canonicalOrigin(env));
    const wwwHost = `www.${canonical.hostname}`;
    if (isApiPath(incoming.pathname)) return null;

    const forceCanonicalHost = incoming.hostname === wwwHost;
    const target = new URL(incoming.pathname + incoming.search, forceCanonicalHost ? canonical : incoming.origin);
    let changed = forceCanonicalHost;

    if (['/landing', '/landing.html', '/index.html'].includes(target.pathname)) {
      target.pathname = '/';
      changed = true;
    }

    if (target.pathname === '/app.html') {
      target.pathname = '/app';
      changed = true;
    } else if (target.pathname === '/login.html') {
      target.pathname = '/login';
      changed = true;
    } else if (target.pathname === '/master.html') {
      target.pathname = '/master';
      changed = true;
    }

    const cadastro = target.searchParams.get('cadastro') === '1';
    const expired = target.searchParams.get('expired') === '1';
    if ((target.pathname === '/' || target.pathname === '/login') && cadastro) {
      target.pathname = '/cadastro';
      target.searchParams.delete('cadastro');
      changed = true;
    } else if (target.pathname === '/' && expired) {
      target.pathname = '/login';
      changed = true;
    }

    if (!changed) return null;
    return new Response(null, {
      status: 308,
      headers: {
        Location: target.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (err) {
    console.warn('[FinObra Cloudflare] não foi possível aplicar redirect canônico:', err?.message || err);
    return null;
  }
}

function buildContentSecurityPolicy(nonce) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' https://accounts.google.com https://apis.google.com https://cdn.sheetjs.com https://cdnjs.cloudflare.com https://static.cloudflareinsights.com`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://accounts.google.com https://apis.google.com https://www.googleapis.com https://content.googleapis.com https://generativelanguage.googleapis.com https://brasilapi.com.br https://viacep.com.br https://api.meudanfe.com.br https://finan-wf12.onrender.com https://*.blob.vercel-storage.com https://cloudflareinsights.com",
    "frame-src 'self' blob: data: https://accounts.google.com https://drive.google.com https://docs.google.com",
    "worker-src 'self' blob: https://cdnjs.cloudflare.com",
    "manifest-src 'self'",
    "media-src 'self' blob: https:",
    'upgrade-insecure-requests'
  ].join('; ');
}

function secureHtmlResponse(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html')) return response;

  const nonce = crypto.randomUUID().replaceAll('-', '');
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function fetchFrontendResponse(request, env) {
  const method = String(request.method || 'GET').toUpperCase();
  const incoming = new URL(request.url);
  const shellMethod = ['GET', 'HEAD'].includes(method);
  const appShell = shellMethod && isAppShellPath(incoming.pathname);
  const loginShell = shellMethod && isLoginShellPath(incoming.pathname);
  const masterShell = shellMethod && isMasterShellPath(incoming.pathname);
  const landingShell = shellMethod && incoming.pathname === '/';

  // With html_handling:"none", ASSETS.fetch('/login.html') returns 200 directly.
  // We rewrite clean URLs to explicit .html so the binding locates the file.
  let routeName = null;
  let assetPath = incoming.pathname;

  if (appShell) {
    assetPath = '/app.html';
    routeName = 'app-shell';
  } else if (loginShell) {
    assetPath = '/login.html';
    routeName = incoming.pathname === '/cadastro' ? 'signup-shell' : 'login-shell';
  } else if (masterShell) {
    assetPath = '/master.html';
    routeName = 'master-shell';
  } else if (landingShell) {
    assetPath = '/index.html';
    routeName = 'landing-shell';
  }

  const assetRequest = assetPath !== incoming.pathname
    ? new Request(new URL(assetPath, incoming).toString(), { method, headers: request.headers })
    : request;

  const assetResponse = await env.ASSETS.fetch(assetRequest);

  if (incoming.pathname === '/llms.txt' || incoming.pathname === '/llms-full.txt') {
    let text = await assetResponse.text();
    text = text.replace(/# FinObra (?:—|\()[\s\S]*?Documentação Completa para LLMs\)/g, '# FinGo — Obras em Fluxo — SaaS de Gestão Financeira e Operacional para Construtoras (Documentação Completa para LLMs)')
               .replace(/O FinObra é uma solução B2B/g, 'O FinGo é uma solução B2B')
               .replace(/O FinGo \(FinObra\) é uma solução B2B/g, 'O FinGo é uma solução B2B')
               .replace(/# FinObra — SaaS de Gestão/g, '# FinGo — Obras em Fluxo — SaaS de Gestão')
               .replace(/> FinObra é uma plataforma/g, '> FinGo é uma plataforma');
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  const securedResponse = secureHtmlResponse(assetResponse);
  if (!routeName) return securedResponse;

  const headers = new Headers(securedResponse.headers);
  headers.set('X-FinObra-Route', routeName);
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  if (routeName === 'login-shell' || routeName === 'signup-shell' || routeName === 'app-shell' || routeName === 'master-shell') {
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return new Response(securedResponse.body, {
    status: securedResponse.status,
    statusText: securedResponse.statusText,
    headers
  });
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

async function readDeploymentMetadata(request, env) {
  try {
    const versionUrl = new URL('/version.json', request.url);
    const response = await env.ASSETS.fetch(new Request(versionUrl.toString(), {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' }
    }));
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || typeof data !== 'object') return null;
    return {
      version: data.version || null,
      build: data.build || null,
      released_at: data.released_at || null,
      commit: data.commit || null,
      source: data.source || null,
      run_id: data.run_id || null,
      run_attempt: data.run_attempt || null
    };
  } catch (err) {
    console.warn('[FinObra Cloudflare] metadados de deploy indisponíveis:', err?.message || err);
    return null;
  }
}

async function healthResponse(request, env) {
  let configuredApiOrigin = null;
  let configuredCanonicalOrigin = null;
  let configOk = true;
  let loopRisk = false;
  try {
    configuredApiOrigin = upstreamOrigin(env);
    configuredCanonicalOrigin = canonicalOrigin(env);
    loopRisk = configuredApiOrigin === new URL(request.url).origin;
  } catch {
    configOk = false;
  }

  const deployment = await readDeploymentMetadata(request, env);
  const deploymentMetadataOk = !!deployment?.commit && deployment.commit !== 'unknown';
  const healthy = configOk && !loopRisk && deploymentMetadataOk;

  return Response.json({
    ok: healthy,
    service: 'finobra-edge',
    configuredApiOrigin,
    configuredCanonicalOrigin,
    loopRisk,
    securityMode: 'nonce-csp',
    deploymentMetadataOk,
    deployment
  }, {
    status: healthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

async function proxyApi(request, env) {
  const method = String(request.method || 'GET').toUpperCase();

  if (!SAFE_METHODS.has(method) && !sameOriginBrowserRequest(request)) {
    return Response.json({ ok: false, error: 'Origem não autorizada.' }, { status: 403 });
  }

  let incoming;
  let target;
  let apiOrigin;
  try {
    incoming = new URL(request.url);
    apiOrigin = upstreamOrigin(env);

    if (apiOrigin === incoming.origin) {
      console.error('[FinObra Cloudflare] API upstream loop detected:', apiOrigin);
      return Response.json({ ok: false, error: 'Gateway de API não configurado para este domínio.' }, { status: 503 });
    }

    target = new URL(incoming.pathname + incoming.search, apiOrigin);
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

async function handleApi(request, env) {
  try {
    let response = await executeEdgeApi(request, env);
    if (response && response.status >= 500 && env.FINOBRA_API_ORIGIN) {
      console.warn('[FinGo Edge] Resposta 5xx no Edge, acionando fallback upstream...');
      response = await proxyApi(request, env);
    }
    if (response) {
      const secureHeaders = new Headers(response.headers);
      if (!secureHeaders.has('Strict-Transport-Security')) {
        secureHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
      if (!secureHeaders.has('X-Content-Type-Options')) {
        secureHeaders.set('X-Content-Type-Options', 'nosniff');
      }
      if (!secureHeaders.has('Referrer-Policy')) {
        secureHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: secureHeaders
      });
    }
    return response;
  } catch (err) {
    console.error('[FinGo Edge] Falha ao processar API no Edge:', err?.message || err);
    if (env.FINOBRA_API_ORIGIN) {
      return await proxyApi(request, env);
    }
    return Response.json({
      success: false,
      error: 'Erro interno no gateway Edge.',
      code: 'EDGE_ERROR'
    }, {
      status: 500,
      headers: {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const redirect = canonicalRedirect(request, env);
    if (redirect) return redirect;

    if (url.pathname === '/__finobra/health') {
      return healthResponse(request, env);
    }
    if (isApiPath(url.pathname)) {
      return handleApi(request, env);
    }

    return fetchFrontendResponse(request, env);
  },

  /**
   * Robô Cron 24/7 Edge: executa periodicamente para manter o serviço Render
   * acordado e ativo, prevenindo o sleep de 15 minutos do tier gratuito.
   */
  async scheduled(event, env, ctx) {
    const targetUrl = env.RENDER_HEALTH_URL || 'https://finan-backend-9rxw.onrender.com/healthz';
    ctx.waitUntil(
      fetch(targetUrl, {
        headers: { 'User-Agent': 'FinObra-KeepAlive/1.0 (Cloudflare Edge Worker)' }
      }).then(res => {
        console.log(`[Cloudflare Keep-Alive] Ping no Render status: ${res.status}`);
      }).catch(err => {
        console.warn(`[Cloudflare Keep-Alive] Aviso no ping do Render: ${err.message}`);
      })
    );
  }
};
