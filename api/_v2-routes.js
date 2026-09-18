// api/_v2-routes.js — Roteador de Borda RESTful v2 para Cloudflare Workers
// Desacopla as rotas da limitação legada de 12 funções da Vercel,
// fornecendo endpoints modulares, previsíveis e com alto desempenho.

import webhookPixHandler from './_webhook_pix.js';
import nfeHandler from './nfe.js';
import usersHandler from './users.js';
import dbHandler from './db.js';

export const V2_ROUTE_SPEC = [
  { method: 'GET', path: '/api/v2/system/health', desc: 'Status operacional do Edge v2 e versão' },
  { method: 'GET', path: '/api/v2/system/routes', desc: 'Catálogo de rotas RESTful v2 disponíveis' },
  { method: 'POST', path: '/api/v2/webhooks/pix', desc: 'Webhook bancário PIX segregado (sem query multiplexing)' },
  { method: 'GET', path: '/api/v2/public/cnpj/:cnpj', desc: 'Consulta aberta de CNPJ na BrasilAPI' },
  { method: 'GET', path: '/api/v2/public/cep/:cep', desc: 'Consulta aberta de CEP na BrasilAPI / ViaCEP' },
  { method: 'GET', path: '/api/v2/tenants/current', desc: 'Dados e preferências da construtora ativa' },
  { method: 'POST', path: '/api/v2/support/chat', desc: 'Mensagens para o Copiloto FinBot com pool de IA' },
  { method: 'GET', path: '/api/v2/engineering/sinapi', desc: 'Consulta oficial da base SINAPI da Caixa' },
  { method: 'GET', path: '/api/v2/engineering/obras', desc: 'Listagem e projetos de engenharia' },
  { method: 'GET', path: '/api/v2/financial/transactions', desc: 'Lançamentos e extrato financeiro' }
];

export async function handleV2SystemHealth(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    ok: true,
    service: 'fingo-edge-v2',
    version: '2.38.0',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
    architecture: 'Domain-Driven Edge API (Post-Vercel Modular)',
    endpointsCount: V2_ROUTE_SPEC.length
  });
}

export async function handleV2SystemRoutes(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    ok: true,
    version: '2.38.0',
    routes: V2_ROUTE_SPEC
  });
}

/**
 * Resolve e despacha requisições /api/v2/* para handlers especializados.
 */
export function resolveV2Route(pathname, searchParams) {
  const query = {};
  for (const [k, v] of searchParams.entries()) {
    query[k] = v;
  }

  // 1. Sistema & Telemetria
  if (pathname === '/api/v2/system/health') {
    return { handler: handleV2SystemHealth, query, moduleName: 'v2-system-health' };
  }
  if (pathname === '/api/v2/system/routes') {
    return { handler: handleV2SystemRoutes, query, moduleName: 'v2-system-routes' };
  }

  // 2. Webhooks Segregados
  if (pathname === '/api/v2/webhooks/pix') {
    return { handler: webhookPixHandler, query, moduleName: 'v2-webhook-pix' };
  }

  // 3. Consultas Públicas (CNPJ e CEP)
  if (pathname === '/api/v2/public/cnpj' || pathname.startsWith('/api/v2/public/cnpj/')) {
    query.action = 'cnpj';
    if (pathname.startsWith('/api/v2/public/cnpj/')) {
      query.cnpj = pathname.replace('/api/v2/public/cnpj/', '').replace(/\D/g, '');
    }
    return { handler: nfeHandler, query, moduleName: 'v2-public-cnpj' };
  }

  if (pathname === '/api/v2/public/cep' || pathname.startsWith('/api/v2/public/cep/')) {
    query.action = 'cep';
    if (pathname.startsWith('/api/v2/public/cep/')) {
      query.cep = pathname.replace('/api/v2/public/cep/', '').replace(/\D/g, '');
    }
    return { handler: nfeHandler, query, moduleName: 'v2-public-cep' };
  }

  // 4. Construtora / Tenant
  if (pathname === '/api/v2/tenants/current') {
    query.target = 'tenant';
    return { handler: usersHandler, query, moduleName: 'v2-tenants-current' };
  }

  // 5. Suporte & FinBot
  if (pathname === '/api/v2/support/chat') {
    query.target = 'support';
    return { handler: usersHandler, query, moduleName: 'v2-support-chat' };
  }

  // 6. Engenharia (SINAPI e Obras)
  if (pathname === '/api/v2/engineering/sinapi') {
    query.table = 'sinapi';
    return { handler: dbHandler, query, moduleName: 'v2-engineering-sinapi' };
  }
  if (pathname === '/api/v2/engineering/obras') {
    query.table = 'obras';
    return { handler: dbHandler, query, moduleName: 'v2-engineering-obras' };
  }

  // 7. Financeiro (Lançamentos / Transações)
  if (pathname === '/api/v2/financial/transactions') {
    query.table = 'lancamentos';
    return { handler: dbHandler, query, moduleName: 'v2-financial-transactions' };
  }

  return null;
}
