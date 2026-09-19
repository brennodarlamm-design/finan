// api/_edge-adapter.js — Adaptador Universal de Serverless Functions para Cloudflare Workers
// Permite que as APIs existentes em api/*.js rodem no Cloudflare Workers com nodejs_compat.

import authHandler from './auth.js';
import dbHandler from './db.js';
import usersHandler from './users.js';
import adminHandler from './admin.js';
import assinaturasHandler from './assinaturas.js';
import planoHandler from './plano.js';
import nfeHandler from './nfe.js';
import dashboardHandler from './dashboard.js';
import uploadHandler from './upload.js';
import whatsappHandler from './whatsapp.js';
import auditHandler from './audit.js';
import reconhecerHandler from './reconhecer-documento.js';
import bimRenderHandler from './_bim-render.js';
import { resolveV2Route } from './_v2-routes.js';

const HANDLERS = {
  auth: authHandler,
  db: dbHandler,
  users: usersHandler,
  admin: adminHandler,
  assinaturas: assinaturasHandler,
  plano: planoHandler,
  nfe: nfeHandler,
  dashboard: dashboardHandler,
  upload: uploadHandler,
  whatsapp: whatsappHandler,
  audit: auditHandler,
  'reconhecer-documento': reconhecerHandler
};

/**
 * Normaliza os cabeçalhos de uma Request Web Standard para objeto Node.js (lowercase).
 */
function extractHeaders(request) {
  const headers = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }
  return headers;
}

/**
 * Converte cookies do header 'cookie' para dicionário.
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  }
  return cookies;
}

/**
 * Injeta variáveis do binding env do Cloudflare Worker no process.env global.
 */
export function injectWorkerEnv(env) {
  if (!env || typeof env !== 'object') return;
  for (const [key, val] of Object.entries(env)) {
    if (typeof val === 'string' && (!process.env[key] || process.env[key] !== val)) {
      process.env[key] = val;
    }
  }
}

/**
 * Resolve a rota da API e os parâmetros de consulta conforme regras do vercel.json.
 */
function resolveRouteAndQuery(pathname, searchParams) {
  const query = {};
  for (const [k, v] of searchParams.entries()) {
    query[k] = v;
  }

  // 1. Roteador RESTful Modular Edge v2 (Cloudflare Workers nativo)
  if (pathname.startsWith('/api/v2/')) {
    const v2Target = resolveV2Route(pathname, searchParams);
    if (v2Target) return v2Target;
  }

  // Rewrites específicos do sistema v1
  if (pathname === '/api/health') {
    query.action = query.action || 'health';
    return { handler: HANDLERS.auth, query, moduleName: 'auth' };
  }
  if (pathname === '/api/send-whatsapp') {
    query.action = query.action || 'send';
    return { handler: HANDLERS.whatsapp, query, moduleName: 'whatsapp' };
  }
  if (pathname === '/api/cnpj') {
    query.action = query.action || 'cnpj';
    return { handler: HANDLERS.nfe, query, moduleName: 'nfe' };
  }
  if (pathname === '/api/cep') {
    query.action = query.action || 'cep';
    return { handler: HANDLERS.nfe, query, moduleName: 'nfe' };
  }
  if (pathname.startsWith('/api/cep/')) {
    query.action = query.action || 'cep';
    query.cep = pathname.replace('/api/cep/', '');
    return { handler: HANDLERS.nfe, query, moduleName: 'nfe' };
  }
  if (pathname === '/api/support') {
    query.target = query.target || 'support';
    return { handler: HANDLERS.users, query, moduleName: 'users' };
  }
  if (pathname === '/api/tenant') {
    query.target = query.target || 'tenant';
    return { handler: HANDLERS.users, query, moduleName: 'users' };
  }
  if (pathname === '/api/certificado') {
    query.sub = query.sub || 'certificado';
    return { handler: HANDLERS.nfe, query, moduleName: 'nfe' };
  }
  if (pathname.startsWith('/api/certificado/')) {
    query.sub = query.sub || 'certificado';
    query.path = pathname.replace('/api/certificado/', '');
    return { handler: HANDLERS.nfe, query, moduleName: 'nfe' };
  }
  if (pathname === '/api/webhook-pix') {
    query.sub = query.sub || 'webhook_pix';
    return { handler: HANDLERS.plano, query, moduleName: 'plano' };
  }
  if (pathname.startsWith('/api/webhook-pix/')) {
    query.sub = query.sub || 'webhook_pix';
    query.path = pathname.replace('/api/webhook-pix/', '');
    return { handler: HANDLERS.plano, query, moduleName: 'plano' };
  }

  if (pathname === '/api/bim-render' || pathname === '/api/bim/render') {
    return { handler: bimRenderHandler, query, moduleName: 'bim-render' };
  }

  // Roteamento padrão: /api/:module
  const parts = pathname.replace(/^\/api\/?/, '').split('/');
  const moduleName = parts[0] || '';
  const handler = HANDLERS[moduleName];

  if (parts.length > 1) {
    query.subpath = parts.slice(1).join('/');
  }

  return { handler, query, moduleName };
}

/**
 * Executa uma requisição Web Standard contra o handler Node.js compatível.
 */
export async function executeEdgeApi(request, env) {
  injectWorkerEnv(env);

  const url = new URL(request.url);
  const { handler, query, moduleName } = resolveRouteAndQuery(url.pathname, url.searchParams);

  if (!handler) {
    return Response.json({
      success: false,
      error: `Endpoint '${url.pathname}' não encontrado no Edge API Gateway.`,
      code: 'NOT_FOUND'
    }, { status: 404 });
  }

  const method = String(request.method || 'GET').toUpperCase();
  const headers = extractHeaders(request);
  const cookies = parseCookies(headers.cookie);

  let body = null;
  if (!['GET', 'HEAD'].includes(method)) {
    const contentType = headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await request.text();
    }
  }

  // SEC-EDGE-01: Garante headers canônicos de Edge (HTTPS, IP real e Cloudflare Ray)
  const cfIp = request.headers.get('cf-connecting-ip') || '';
  headers['x-forwarded-proto'] = headers['x-forwarded-proto'] || (url.protocol ? url.protocol.replace(':', '') : 'https');
  headers['x-forwarded-for'] = headers['x-forwarded-for'] || cfIp;
  headers['cf-connecting-ip'] = headers['cf-connecting-ip'] || cfIp;
  headers['cf-ray'] = headers['cf-ray'] || request.headers.get('cf-ray') || '';

  // Objeto req compatível com Vercel/Express
  const req = {
    method,
    url: url.pathname + url.search,
    headers,
    query,
    cookies,
    body,
    env
  };

  // Criação do objeto res simulado com Promise
  return new Promise(async (resolve) => {
    let statusCode = 200;
    const responseHeaders = new Headers();
    let finished = false;

    // SEC-EDGE-06: Aplica cabeçalhos defensivos globais de API
    function ensureSecurityHeaders() {
      if (!responseHeaders.has('strict-transport-security')) {
        responseHeaders.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
      }
      if (!responseHeaders.has('x-content-type-options')) {
        responseHeaders.set('x-content-type-options', 'nosniff');
      }
    }

    const res = {
      status(code) {
        statusCode = Number(code) || 200;
        return res;
      },
      setHeader(name, value) {
        if (value === null || value === undefined) {
          responseHeaders.delete(name);
        } else if (Array.isArray(value)) {
          responseHeaders.delete(name);
          for (const v of value) responseHeaders.append(name, String(v));
        } else {
          responseHeaders.set(name, String(value));
        }
        return res;
      },
      getHeader(name) {
        return responseHeaders.get(name);
      },
      hasHeader(name) {
        return responseHeaders.has(name);
      },
      removeHeader(name) {
        responseHeaders.delete(name);
        return res;
      },
      json(data) {
        if (finished) return res;
        finished = true;
        if (!responseHeaders.has('content-type')) {
          responseHeaders.set('content-type', 'application/json; charset=utf-8');
        }
        ensureSecurityHeaders();
        const text = JSON.stringify(data);
        resolve(new Response(text, { status: statusCode, headers: responseHeaders }));
        return res;
      },
      send(data) {
        if (finished) return res;
        finished = true;
        ensureSecurityHeaders();
        if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
          return res.json(data);
        }
        resolve(new Response(data, { status: statusCode, headers: responseHeaders }));
        return res;
      },
      end(data) {
        if (finished) return res;
        finished = true;
        ensureSecurityHeaders();
        resolve(new Response(data || null, { status: statusCode, headers: responseHeaders }));
        return res;
      },
      redirect(statusOrUrl, url) {
        if (finished) return res;
        finished = true;
        ensureSecurityHeaders();
        let redirectStatus = 302;
        let targetUrl = statusOrUrl;
        if (typeof statusOrUrl === 'number') {
          redirectStatus = statusOrUrl;
          targetUrl = url;
        }
        responseHeaders.set('location', String(targetUrl));
        resolve(new Response(null, { status: redirectStatus, headers: responseHeaders }));
        return res;
      }
    };

    try {
      await handler(req, res);
    } catch (handlerErr) {
      // SEC-EDGE-04: Sanitiza qualquer credencial ou string de conexão dos logs do Edge
      const safeErr = String(handlerErr?.stack || handlerErr?.message || handlerErr)
        .replace(/postgres(?:ql)?:\/\/[^:]+:[^@]+@[^\s"']+/gi, 'postgresql://[REDACTED_CREDENTIALS]');
      console.error(`[Edge API Error] Erro ao executar ${moduleName}:`, safeErr);
      if (!finished) {
        finished = true;
        ensureSecurityHeaders();
        resolve(Response.json({
          success: false,
          error: 'Erro interno ao processar requisição no Edge.',
          code: 'INTERNAL_SERVER_ERROR'
        }, { status: 500, headers: responseHeaders }));
      }
    }
  });
}
