// api/_v2-routes.js — Roteador de Borda RESTful v2 para Cloudflare Workers
// Desacopla as rotas da limitação legada de 12 funções da Vercel,
// fornecendo endpoints modulares, analíticos e de alto desempenho.

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
  { method: 'GET', path: '/api/v2/engineering/sinapi/export', desc: 'Exportação formatada de itens SINAPI com BDI (CSV/JSON)' },
  { method: 'GET', path: '/api/v2/engineering/obras', desc: 'Listagem e projetos de engenharia' },
  { method: 'POST', path: '/api/v2/engineering/obras/:obraId/curva-abc', desc: 'Cálculo e classificação analítica da Curva ABC de Pareto' },
  { method: 'POST', path: '/api/v2/measurements/boletins', desc: 'Cálculo de boletim de medição com retenções tributárias na fonte' },
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
 * Endpoint analítico de Curva ABC (Classificação de Pareto A/B/C)
 */
export async function handleV2CurvaAbc(req, res) {
  res.setHeader('Cache-Control', 'private, no-cache');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const obraId = req.query?.obraId || '';
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
  const bdi = Number(req.body?.bdi || req.query?.bdi || 0);

  if (!itens.length) {
    return res.status(200).json({
      success: true,
      obraId,
      totalGeral: 0,
      itensCount: 0,
      curva: { classeA: [], classeB: [], classeC: [] },
      totaisPorClasse: { A: 0, B: 0, C: 0 }
    });
  }

function parseNumeric(val, fallback = 0) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  let str = String(val).trim();
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const n = Number(str);
  return Number.isFinite(n) ? n : fallback;
}

  const sorted = itens.map(item => {
    const qtd = parseNumeric(item.quantidade ?? item.qtd, 1);
    const preco = parseNumeric(item.preco_unitario ?? item.preco ?? item.total, 0);
    const total = parseNumeric(item.valor_total, qtd * preco);
    return {
      codigo: String(item.codigo || item.id || ''),
      descricao: String(item.descricao || item.nome || 'Item'),
      unidade: String(item.unidade || 'un'),
      quantidade: qtd,
      precoUnitario: preco,
      valorTotal: total
    };
  }).sort((a, b) => b.valorTotal - a.valorTotal);

  const totalGeral = sorted.reduce((acc, it) => acc + it.valorTotal, 0);
  let acumulado = 0;

  const resultado = sorted.map(item => {
    acumulado += item.valorTotal;
    const percItem = totalGeral > 0 ? (item.valorTotal / totalGeral) * 100 : 0;
    const percAcumulado = totalGeral > 0 ? (acumulado / totalGeral) * 100 : 0;
    let classe = 'C';
    if (percAcumulado <= 80 || (percAcumulado - percItem < 80)) {
      classe = 'A';
    } else if (percAcumulado <= 95 || (percAcumulado - percItem < 95)) {
      classe = 'B';
    }
    return {
      ...item,
      percItem: Number(percItem.toFixed(2)),
      percAcumulado: Number(percAcumulado.toFixed(2)),
      classe
    };
  });

  const totais = { A: 0, B: 0, C: 0 };
  const contagem = { A: 0, B: 0, C: 0 };
  resultado.forEach(it => {
    totais[it.classe] += it.valorTotal;
    contagem[it.classe]++;
  });

  return res.status(200).json({
    success: true,
    obraId,
    bdiAplicado: bdi,
    totalGeral: Number(totalGeral.toFixed(2)),
    itensCount: resultado.length,
    totaisPorClasse: {
      A: Number(totais.A.toFixed(2)),
      B: Number(totais.B.toFixed(2)),
      C: Number(totais.C.toFixed(2))
    },
    contagemPorClasse: contagem,
    itens: resultado
  });
}

/**
 * Exportação de composições SINAPI Caixa formatadas em CSV ou JSON
 */
export async function handleV2SinapiExport(req, res) {
  const uf = String(req.query?.uf || 'SP').toUpperCase();
  const formato = String(req.query?.formato || 'json').toLowerCase();
  const bdi = Number(req.query?.bdi || 25.0);

  const composicoesExemplo = [
    { codigo: '104658', descricao: 'ALVENARIA DE VEDAÇÃO DE BLOCOS CERÂMICOS', unidade: 'M2', precoBase: 208.00 },
    { codigo: '45333', descricao: 'PISO CERÂMICO ESMALTADO EXTRA', unidade: 'M2', precoBase: 199.02 },
    { codigo: '98504', descricao: 'IMPERMEABILIZAÇÃO COM MANTA ASFÁLTICA', unidade: 'M2', precoBase: 84.50 },
    { codigo: '92762', descricao: 'ARMAÇÃO DE PILAR OU VIGA DE ESTRUTURA', unidade: 'KG', precoBase: 14.80 }
  ];

  const dados = composicoesExemplo.map(c => {
    const valorComBdi = c.precoBase * (1 + bdi / 100);
    return {
      ...c,
      uf,
      bdi: `${bdi}%`,
      precoComBdi: Number(valorComBdi.toFixed(2))
    };
  });

  if (formato === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sinapi_${uf}_export.csv"`);
    const header = 'Codigo;Descricao;Unidade;PrecoBase;BDI;PrecoComBDI\n';
    const rows = dados.map(d => `${d.codigo};"${d.descricao}";${d.unidade};${d.precoBase.toFixed(2)};${d.bdi};${d.precoComBdi.toFixed(2)}`).join('\n');
    return res.status(200).send(header + rows);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    success: true,
    uf,
    bdi,
    totalItens: dados.length,
    dados
  });
}

/**
 * Cálculo e conferência de boletim de medição com retenções tributárias na fonte
 */
export async function handleV2BoletimMedicao(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const body = req.body || {};

  const valorBruto = Number(body.valorBruto || body.valor || 0);
  if (valorBruto <= 0) {
    return res.status(400).json({ success: false, error: 'valorBruto deve ser maior que zero.' });
  }

  const aliqISS = Number(body.aliqISS !== undefined ? body.aliqISS : 5.0);
  const desonerado = Boolean(body.desonerado);
  const optanteSimples = Boolean(body.optanteSimples || body.simplesNacional);
  const aliqINSS = desonerado ? 3.5 : 11.0;
  const aliqIRRF = Number(body.aliqIRRF !== undefined ? body.aliqIRRF : 1.5);
  const aliqRetencaoGarantia = Number(body.aliqRetencaoGarantia !== undefined ? body.aliqRetencaoGarantia : 5.0);

  const valorISS = Number((valorBruto * (aliqISS / 100)).toFixed(2));
  const valorINSS = Number((valorBruto * (aliqINSS / 100)).toFixed(2));
  const valorIRRF = Number((valorBruto * (aliqIRRF / 100)).toFixed(2));

  // Lei 13.137/2015: dispensa retenção de PIS/COFINS/CSLL quando o valor da retenção for igual ou inferior a R$ 10,00.
  // Empresas optantes pelo Simples Nacional não sofrem retenção na fonte (IN RFB 459/2004).
  const rawPisCofins = valorBruto * 0.0465;
  const valorPisCofinsCsll = (optanteSimples || rawPisCofins <= 10.0) ? 0 : Number(rawPisCofins.toFixed(2));
  const valorGarantia = Number((valorBruto * (aliqRetencaoGarantia / 100)).toFixed(2));

  const totalRetencoes = Number((valorISS + valorINSS + valorIRRF + valorPisCofinsCsll + valorGarantia).toFixed(2));
  const valorLiquido = Number((valorBruto - totalRetencoes).toFixed(2));

  return res.status(200).json({
    success: true,
    boletim: {
      valorBruto,
      retencoes: {
        iss: { aliquota: `${aliqISS}%`, valor: valorISS },
        inss: { aliquota: `${aliqINSS}%`, regime: desonerado ? 'Desonerado (Lei 12.546)' : 'Geral', valor: valorINSS },
        irrf: { aliquota: `${aliqIRRF}%`, valor: valorIRRF },
        pisCofinsCsll: {
          aliquota: optanteSimples ? 'Isento (Simples Nacional)' : (rawPisCofins <= 10.0 ? 'Dispensado (DARF <= R$ 10,00)' : '4.65% (CSRF)'),
          regime: optanteSimples ? 'Simples Nacional' : 'Lei 13.137/2015',
          valor: valorPisCofinsCsll
        },
        garantiaContratual: { aliquota: `${aliqRetencaoGarantia}%`, valor: valorGarantia }
      },
      totalRetencoes,
      valorLiquido
    }
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

  // 6. Engenharia (SINAPI, Obras, Curva ABC e Medições)
  if (pathname === '/api/v2/engineering/sinapi/export') {
    return { handler: handleV2SinapiExport, query, moduleName: 'v2-engineering-sinapi-export' };
  }
  if (pathname === '/api/v2/engineering/sinapi') {
    query.table = 'sinapi';
    return { handler: dbHandler, query, moduleName: 'v2-engineering-sinapi' };
  }
  if (pathname.includes('/curva-abc')) {
    const match = pathname.match(/\/api\/v2\/engineering\/obras\/([^\/]+)\/curva-abc/);
    if (match) {
      query.obraId = match[1];
    }
    return { handler: handleV2CurvaAbc, query, moduleName: 'v2-engineering-curva-abc' };
  }
  if (pathname === '/api/v2/engineering/obras') {
    query.table = 'obras';
    return { handler: dbHandler, query, moduleName: 'v2-engineering-obras' };
  }

  // 7. Medições & Boletins
  if (pathname === '/api/v2/measurements/boletins') {
    return { handler: handleV2BoletimMedicao, query, moduleName: 'v2-measurements-boletins' };
  }

  // 8. Financeiro (Lançamentos / Transações)
  if (pathname === '/api/v2/financial/transactions') {
    query.table = 'lancamentos';
    return { handler: dbHandler, query, moduleName: 'v2-financial-transactions' };
  }

  return null;
}
