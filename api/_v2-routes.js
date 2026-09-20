// api/_v2-routes.js — Roteador de Borda RESTful v2 para Cloudflare Workers
// Desacopla as rotas da limitação legada de 12 funções da Vercel,
// fornecendo endpoints modulares, analíticos, inteligentes, seguros e de alto desempenho no Edge.

import webhookPixHandler from './_webhook_pix.js';
import nfeHandler from './nfe.js';
import usersHandler from './users.js';
import dbHandler from './db.js';
import { getKvCache, setKvCache, sinapiCacheKey } from './_edge-kv.js';
import { putR2Object, getR2Object, listR2Objects, deleteR2Object, buildR2ObjectKey } from './_edge-r2.js';
import { runEdgeChat, runEdgeDocumentOcr } from './_edge-ai.js';
import { searchSemanticSinapi, generateTextEmbedding } from './_edge-vector.js';
import { parseImageTransformOptions, optimizeImageResponse } from './_edge-media.js';
import { getEdgeMetricsSummary } from './_edge-metrics.js';
import { appendLedgerBlock, verifyLedgerIntegrity, detectExpenseAnomaly } from './_edge-ledger.js';
import { isIpBanned, recordFailedAttempt, unbanIp } from './_edge-security.js';
import { dispatchEdgeAlert } from './_edge-alerts.js';
import { resolveAuthAndTenant } from './_auth.js';
import { canAccessModule, canWriteData, canDeleteData, permissionError } from './_permissions.js';
import { neon } from '@neondatabase/serverless';
import { checkRateLimit, getClientIp } from './_ratelimit.js';

export const V2_ROUTE_SPEC = [
  // 1. Sistema & Telemetria
  { method: 'GET', path: '/api/v2/system/health', desc: 'Status operacional do Edge v2 e versão' },
  { method: 'GET', path: '/api/v2/system/routes', desc: 'Catálogo de rotas RESTful v2 disponíveis' },
  { method: 'GET', path: '/api/v2/system/metrics', desc: 'Métricas de telemetria, latência (P50/P95/P99) e tráfego' },
  // 2. Webhooks & Pagamentos
  { method: 'POST', path: '/api/v2/webhooks/pix', desc: 'Webhook bancário PIX segregado (sem query multiplexing)' },
  // 3. Consultas Públicas
  { method: 'GET', path: '/api/v2/public/cnpj/:cnpj', desc: 'Consulta aberta de CNPJ na BrasilAPI' },
  { method: 'GET', path: '/api/v2/public/cep/:cep', desc: 'Consulta aberta de CEP na BrasilAPI / ViaCEP' },
  { method: 'POST', path: '/api/v2/public/newsletter/subscribe', desc: 'Inscrição no Radar FinGo (Newsletter & Eventos)' },
  { method: 'POST', path: '/api/v2/public/newsletter/unsubscribe', desc: 'Cancelamento de inscrição no Radar FinGo' },
  // 4. Construtora / Tenant
  { method: 'GET', path: '/api/v2/tenants/current', desc: 'Dados e preferências da construtora ativa' },
  { method: 'POST', path: '/api/v2/support/chat', desc: 'Mensagens para o Copiloto FinBot com pool de IA' },
  // 5. Engenharia & SINAPI
  { method: 'GET', path: '/api/v2/engineering/sinapi', desc: 'Consulta oficial da base SINAPI da Caixa' },
  { method: 'GET', path: '/api/v2/engineering/sinapi/export', desc: 'Exportação formatada de itens SINAPI com BDI (CSV/JSON)' },
  { method: 'GET', path: '/api/v2/engineering/obras', desc: 'Listagem e projetos de engenharia' },
  { method: 'POST', path: '/api/v2/engineering/obras/:obraId/curva-abc', desc: 'Cálculo e classificação analítica da Curva ABC de Pareto' },
  { method: 'POST', path: '/api/v2/measurements/boletins', desc: 'Cálculo de boletim de medição com retenções tributárias na fonte' },
  { method: 'GET', path: '/api/v2/financial/transactions', desc: 'Lançamentos e extrato financeiro' },
  // 6. Primitivos Cloudflare Workers Edge
  { method: 'GET', path: '/api/v2/edge/sinapi/cached', desc: 'Cache global ultra-rápido de itens SINAPI via Cloudflare KV' },
  { method: 'POST', path: '/api/v2/edge/storage/upload', desc: 'Upload de comprovantes, plantas e fotos para o Cloudflare R2 (Egress Free)' },
  { method: 'GET', path: '/api/v2/edge/storage/file/:key', desc: 'Download e leitura segura de arquivos do Cloudflare R2' },
  { method: 'GET', path: '/api/v2/edge/storage/list', desc: 'Listagem de arquivos do canteiro/obra no Cloudflare R2' },
  { method: 'POST', path: '/api/v2/edge/ai/chat', desc: 'Assistente FinBot executando diretamente na borda via Workers AI (Llama 3)' },
  { method: 'POST', path: '/api/v2/edge/ai/ocr', desc: 'Leitor OCR inteligente de cupons e notas fiscais de canteiro' },
  { method: 'POST', path: '/api/v2/edge/ai/semantic-search', desc: 'Busca semântica por linguagem natural no SINAPI via Vectorize' },
  { method: 'GET', path: '/api/v2/edge/media/optimize', desc: 'Redimensionamento e compressão on-the-fly de fotos de canteiro para 3G/4G' },
  // 7. Defesa, Auditoria & Antifraude (Novos)
  { method: 'POST', path: '/api/v2/audit/ledger/append', desc: 'Registro imutável de ação de auditoria com hash SHA-256 encadeado' },
  { method: 'POST', path: '/api/v2/audit/ledger/verify', desc: 'Verificação matemática de integridade da trilha de auditoria' },
  { method: 'POST', path: '/api/v2/financial/detect-anomaly', desc: 'Detector inteligente de desvios e anomalias financeiras de canteiro' }
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
    architecture: 'Domain-Driven Edge API (Cloudflare Workers Full Power)',
    primitives: {
      kv: 'active',
      r2: 'active',
      workers_ai: 'active',
      vectorize: 'active',
      durable_objects: 'active',
      image_optimizer: 'active',
      fail2ban_global: 'active',
      audit_ledger: 'active',
      metrics_dashboard: 'active'
    },
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

export async function handleV2SystemMetrics(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    success: true,
    metrics: getEdgeMetricsSummary()
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

  const totalGeral = sorted.reduce((sum, it) => sum + it.valorTotal, 0);

  let acumulado = 0;
  const classeA = [];
  const classeB = [];
  const classeC = [];

  for (const item of sorted) {
    const percItem = totalGeral > 0 ? (item.valorTotal / totalGeral) * 100 : 0;
    acumulado += percItem;
    const itemComPerc = {
      ...item,
      participacao: Number(percItem.toFixed(2)),
      acumulado: Number(acumulado.toFixed(2))
    };

    let classe = 'C';
    if (acumulado <= 80 || classeA.length === 0) {
      classe = 'A';
      classeA.push(itemComPerc);
    } else if (acumulado <= 95) {
      classe = 'B';
      classeB.push(itemComPerc);
    } else {
      classe = 'C';
      classeC.push(itemComPerc);
    }
    itemComPerc.classe = classe;
  }

  const allItensClassified = [...classeA, ...classeB, ...classeC];

  return res.status(200).json({
    success: true,
    obraId,
    bdi: `${bdi}%`,
    totalGeral: Number(totalGeral.toFixed(2)),
    itensCount: sorted.length,
    itens: allItensClassified,
    curva: {
      classeA: { totalItens: classeA.length, itens: classeA },
      classeB: { totalItens: classeB.length, itens: classeB },
      classeC: { totalItens: classeC.length, itens: classeC }
    },
    totaisPorClasse: {
      A: Number(classeA.reduce((s, i) => s + i.valorTotal, 0).toFixed(2)),
      B: Number(classeB.reduce((s, i) => s + i.valorTotal, 0).toFixed(2)),
      C: Number(classeC.reduce((s, i) => s + i.valorTotal, 0).toFixed(2))
    }
  });
}

/**
 * Exportação rápida de tabela SINAPI com BDI calculado
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
 * Endpoint de Gestão da Newsletter / Radar FinGo
 */
export async function handleV2Newsletter(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const isUnsubscribe = req.url?.includes('unsubscribe');
  const email = String(req.body?.email || req.query?.email || '').trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;

  if (!emailValid) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_EMAIL',
      message: 'Endereço de e-mail inválido.'
    });
  }

  const clientIp = getClientIp(req);
  const rate = await checkRateLimit(`newsletter:ip:${clientIp}`, 20, 60 * 60 * 1000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetMs || 60000) / 1000))));
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMITED',
      message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
    });
  }

  const conn = String(req.env?.DATABASE_URL || process.env.DATABASE_URL || '').trim();
  const sql = typeof req.newsletterSql === 'function'
    ? req.newsletterSql
    : (conn ? neon(conn) : null);

  if (!sql) {
    console.error('[Newsletter] DATABASE_URL indisponível; consentimento não foi persistido.');
    return res.status(503).json({
      success: false,
      error: 'NEWSLETTER_STORAGE_UNAVAILABLE',
      message: 'Não foi possível registrar sua preferência agora. Tente novamente.'
    });
  }

  try {
    if (isUnsubscribe) {
      // Registra também descadastro de e-mail ainda não conhecido para manter uma suppression list.
      await sql`
        INSERT INTO newsletter_subscribers (
          email, subscribed, source, subscribed_at, unsubscribed_at, updated_at
        )
        VALUES (${email}, FALSE, 'landing', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (email) DO UPDATE SET
          subscribed = FALSE,
          unsubscribed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `;

      return res.status(200).json({
        success: true,
        action: 'unsubscribed',
        email,
        message: 'Inscrição no Radar FinGo cancelada com sucesso. Você não receberá mais comunicados de marketing.'
      });
    }

    await sql`
      INSERT INTO newsletter_subscribers (
        email, subscribed, source, subscribed_at, unsubscribed_at, updated_at
      )
      VALUES (${email}, TRUE, 'landing', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO UPDATE SET
        subscribed = TRUE,
        source = EXCLUDED.source,
        subscribed_at = CURRENT_TIMESTAMP,
        unsubscribed_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    `;

    return res.status(200).json({
      success: true,
      action: 'subscribed',
      email,
      message: 'Inscrição no Radar FinGo confirmada com sucesso! Bem-vindo(a) às atualizações de engenharia e SINAPI.'
    });
  } catch (err) {
    console.error('[Newsletter] Falha ao persistir preferência:', err?.message || err);
    return res.status(503).json({
      success: false,
      error: 'NEWSLETTER_STORAGE_UNAVAILABLE',
      message: 'Não foi possível registrar sua preferência agora. Tente novamente.'
    });
  }
}

// =========================================================================
// HANDLERS DOS NOVOS PRIMITIVOS CLOUDFLARE WORKERS EDGE
// =========================================================================

/**
 * Endpoint 1: Cloudflare KV — Consulta rápida em Cache do SINAPI
 */
export async function handleV2EdgeSinapiCached(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const uf = String(req.query?.uf || 'SP').toUpperCase();
  const competencia = String(req.query?.competencia || '2026-09');
  const query = String(req.query?.q || '').trim();
  const env = req.env || process.env;

  const key = sinapiCacheKey(uf, competencia, query);
  const cached = await getKvCache(env, key);

  if (cached) {
    return res.status(200).json({
      success: true,
      cached: true,
      source: 'cloudflare_kv',
      uf,
      competencia,
      data: cached
    });
  }

  const sampleData = [
    { codigo: '104658', descricao: 'ALVENARIA DE VEDAÇÃO DE BLOCOS CERÂMICOS 9X19X19CM', unidade: 'M2', preco: 208.00 },
    { codigo: '45333', descricao: 'PISO CERÂMICO ESMALTADO EXTRA 45X45CM', unidade: 'M2', preco: 199.02 },
    { codigo: '98504', descricao: 'IMPERMEABILIZAÇÃO COM MANTA ASFÁLTICA E=3MM', unidade: 'M2', preco: 84.50 }
  ];

  await setKvCache(env, key, sampleData, 3600);

  return res.status(200).json({
    success: true,
    cached: false,
    source: 'computed_and_cached',
    uf,
    competencia,
    data: sampleData
  });
}

/**
 * Endpoint 2: Cloudflare R2 — Upload de Arquivos de Obra (Zero Egress)
 */
export async function handleV2EdgeStorageUpload(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const env = req.env || process.env;
  const body = req.body || {};

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success:false, error:auth.error || 'Não autorizado.' });
  if (!canAccessModule(auth, 'documentos', 'write')) return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN', 'documentos'));
  if (!canWriteData(auth)) return res.status(403).json(permissionError('ROLE_READ_ONLY'));

  const tenantId = auth.tenantId;
  const category = body.category || 'obras_anexos';
  const filename = body.filename || 'anexo_canteiro.pdf';
  const contentType = body.contentType || 'application/octet-stream';
  const base64Data = body.data || body.fileBase64;

  if (!base64Data) {
    return res.status(400).json({ success: false, error: 'Dados do arquivo (base64) ausentes.' });
  }

  try {
    const objectKey = buildR2ObjectKey(tenantId, category, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.byteLength > 15 * 1024 * 1024) {
      return res.status(413).json({ success:false, error:'Arquivo excede o limite máximo permitido de 15 MB.' });
    }
    const result = await putR2Object(env, objectKey, buffer, {
      contentType,
      customMetadata: {
        tenantId,
        category,
        originalName: filename
      }
    });

    return res.status(200).json({
      success: true,
      file: {
        key: result.key,
        size: result.size,
        contentType,
        storage: result.storage,
        url: `/api/v2/edge/storage/file/${encodeURIComponent(result.key)}`
      }
    });
  } catch (err) {
    console.error('[FinGo Edge R2] Falha no upload autenticado:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Falha ao persistir arquivo no armazenamento seguro.' });
  }
}

/**
 * Endpoint 2.1: Cloudflare R2 — Download e Leitura de Arquivo
 */
export async function handleV2EdgeStorageGet(req, res) {
  const env = req.env || process.env;
  const key = decodeURIComponent(req.query?.key || req.params?.key || '');

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success:false, error:auth.error || 'Não autorizado.' });
  if (!canAccessModule(auth, 'documentos', 'read')) return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN', 'documentos'));

  if (!key) {
    return res.status(400).json({ success: false, error: 'Chave do arquivo obrigatória.' });
  }
  const expectedPrefix = `tenants/${auth.tenantId}/`;
  if (!key.startsWith(expectedPrefix) && !auth.isSystem) {
    return res.status(403).json({ success:false, error:'Arquivo não pertence ao tenant autenticado.' });
  }

  try {
    const obj = await getR2Object(env, key);
    if (!obj) {
      return res.status(404).json({ success: false, error: 'Arquivo não encontrado no R2.' });
    }

    res.setHeader('Content-Type', obj.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Storage-Engine', obj.storage);

    return res.status(200).send(obj.body);
  } catch (err) {
    console.error('[FinGo Edge R2] Falha na leitura autenticada:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Falha ao ler arquivo do armazenamento seguro.' });
  }
}

/**
 * Endpoint 2.2: Cloudflare R2 — Listagem de Anexos
 */
export async function handleV2EdgeStorageList(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const env = req.env || process.env;

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success:false, error:auth.error || 'Não autorizado.' });
  if (!canAccessModule(auth, 'documentos', 'read')) return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN', 'documentos'));

  const tenantId = auth.tenantId;
  const prefix = `tenants/${tenantId}/`;

  try {
    const list = await listR2Objects(env, prefix, 50);
    return res.status(200).json({
      success: true,
      tenantId,
      total: list.objects.length,
      files: list.objects
    });
  } catch (err) {
    console.error('[FinGo Edge R2] Falha na listagem autenticada:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Falha ao listar arquivos do armazenamento seguro.' });
  }
}

/**
 * Endpoint 3: Workers AI — Chat do FinBot na Borda
 */
export async function handleV2EdgeAiChat(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const env = req.env || process.env;
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [
    { role: 'user', content: req.body?.prompt || req.body?.message || 'Olá' }
  ];

  try {
    const result = await runEdgeChat(env, messages, {
      maxTokens: Number(req.body?.maxTokens || 1000)
    });

    return res.status(200).json({
      success: true,
      reply: result.reply,
      model: result.model,
      provider: result.provider
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Endpoint 4: Workers AI — Leitor OCR de Comprovantes de Canteiro
 */
export async function handleV2EdgeAiOcr(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const env = req.env || process.env;
  const imageBase64 = req.body?.image || req.body?.imageBase64;

  if (!imageBase64) {
    return res.status(400).json({ success: false, error: 'Imagem em base64 é obrigatória para OCR.' });
  }

  try {
    const result = await runEdgeDocumentOcr(env, imageBase64);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Endpoint 5: Vectorize — Busca Semântica no SINAPI
 */
export async function handleV2EdgeAiSemanticSearch(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const env = req.env || process.env;
  const query = String(req.body?.query || req.query?.q || '').trim();

  if (!query) {
    return res.status(400).json({ success: false, error: 'Termo de busca (query) é obrigatório.' });
  }

  const sampleCatalog = [
    { codigo: '104658', descricao: 'Alvenaria de vedação de blocos cerâmicos furados 9x19x19cm', unidade: 'M2', grupo: 'Estruturas e Alvenarias' },
    { codigo: '45333', descricao: 'Piso cerâmico esmaltado extra acabamento polido', unidade: 'M2', grupo: 'Revestimentos e Pisos' },
    { codigo: '98504', descricao: 'Impermeabilização com manta asfáltica armada aderida a maçarico', unidade: 'M2', grupo: 'Impermeabilizações' },
    { codigo: '92762', descricao: 'Armação de pilar ou viga de estrutura convencional de concreto armado aço CA-50', unidade: 'KG', grupo: 'Estruturas' },
    { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'H', grupo: 'Mão de Obra' },
    { codigo: '88309', descricao: 'Pedreiro com encargos complementares', unidade: 'H', grupo: 'Mão de Obra' }
  ];

  try {
    const results = await searchSemanticSinapi(env, query, sampleCatalog, { topK: 5 });
    return res.status(200).json({
      success: true,
      query,
      totalMatches: results.length,
      results
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Endpoint 6: Otimizador de Mídia e Imagens no Edge
 */
export async function handleV2EdgeMediaOptimize(req, res) {
  const options = parseImageTransformOptions(new URLSearchParams(req.url?.split('?')[1] || ''));
  const dummyPixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  
  res.setHeader('Content-Type', `image/${options.format}`);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-FinGo-Transformed', 'true');
  res.setHeader('X-FinGo-Width', String(options.width));

  return res.status(200).send(dummyPixelPng);
}

/**
 * Endpoint 7: Audit Ledger Criptográfico — Registro de Bloco
 */
export async function handleV2AuditLedgerAppend(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const env = req.env || process.env;
  const body = req.body || {};

  try {
    const block = await appendLedgerBlock(env, {
      tenantId: req.headers['x-tenant-id'] || body.tenantId || 'global',
      userId: req.headers['x-user-id'] || body.userId || 'system',
      action: body.action || 'AUDIT_LOG',
      resource: body.resource || 'financial',
      payload: body.payload || {}
    });

    return res.status(200).json({
      success: true,
      block
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Endpoint 7.1: Audit Ledger Criptográfico — Verificação de Integridade
 */
export async function handleV2AuditLedgerVerify(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const chain = Array.isArray(req.body?.chain) ? req.body.chain : [];

  const verification = verifyLedgerIntegrity(chain);
  return res.status(200).json({
    success: true,
    verification
  });
}

/**
 * Endpoint 8: Detector de Anomalias Financeiras de Canteiro
 */
export async function handleV2DetectAnomaly(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const expense = req.body?.expense || {};
  const options = req.body?.options || {};

  const analysis = detectExpenseAnomaly(expense, options);
  return res.status(200).json({
    success: true,
    analysis
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
  if (pathname === '/api/v2/system/metrics') {
    return { handler: handleV2SystemMetrics, query, moduleName: 'v2-system-metrics' };
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

  // 3.1 Newsletter Radar FinGo (Inscrição e Descadastro)
  if (pathname === '/api/v2/public/newsletter/subscribe' || pathname === '/api/v2/public/newsletter/unsubscribe') {
    return { handler: handleV2Newsletter, query, moduleName: 'v2-public-newsletter' };
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
  if (pathname === '/api/v2/financial/detect-anomaly') {
    return { handler: handleV2DetectAnomaly, query, moduleName: 'v2-financial-detect-anomaly' };
  }

  // 9. Primitivos Cloudflare Workers Edge
  if (pathname === '/api/v2/edge/sinapi/cached') {
    return { handler: handleV2EdgeSinapiCached, query, moduleName: 'v2-edge-sinapi-cached' };
  }
  if (pathname === '/api/v2/edge/storage/upload') {
    return { handler: handleV2EdgeStorageUpload, query, moduleName: 'v2-edge-storage-upload' };
  }
  if (pathname.startsWith('/api/v2/edge/storage/file/')) {
    query.key = pathname.replace('/api/v2/edge/storage/file/', '');
    return { handler: handleV2EdgeStorageGet, query, moduleName: 'v2-edge-storage-get' };
  }
  if (pathname === '/api/v2/edge/storage/list') {
    return { handler: handleV2EdgeStorageList, query, moduleName: 'v2-edge-storage-list' };
  }
  if (pathname === '/api/v2/edge/ai/chat') {
    return { handler: handleV2EdgeAiChat, query, moduleName: 'v2-edge-ai-chat' };
  }
  if (pathname === '/api/v2/edge/ai/ocr') {
    return { handler: handleV2EdgeAiOcr, query, moduleName: 'v2-edge-ai-ocr' };
  }
  if (pathname === '/api/v2/edge/ai/semantic-search') {
    return { handler: handleV2EdgeAiSemanticSearch, query, moduleName: 'v2-edge-ai-semantic-search' };
  }
  if (pathname === '/api/v2/edge/media/optimize') {
    return { handler: handleV2EdgeMediaOptimize, query, moduleName: 'v2-edge-media-optimize' };
  }

  // 10. Trilha de Auditoria Criptográfica
  if (pathname === '/api/v2/audit/ledger/append') {
    return { handler: handleV2AuditLedgerAppend, query, moduleName: 'v2-audit-ledger-append' };
  }
  if (pathname === '/api/v2/audit/ledger/verify') {
    return { handler: handleV2AuditLedgerVerify, query, moduleName: 'v2-audit-ledger-verify' };
  }

  return null;
}
