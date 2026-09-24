// api/_db-normalizers.js — Sanitizadores, Normalizadores e Conversores de Dados de Domínio
import { sanitizeSlaProcesses } from './_sla.js';

export function cleanDate(d) {
  if (!d || d === '—' || d === '-') return null;
  if (d instanceof Date) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
  }
  return null;
}

export function cleanNum(n) {
  const val = Number(n);
  return isNaN(val) ? 0 : val;
}

export function safeJsonParse(value, fallback = []) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch (err) {
    return fallback;
  }
}

export function jsonPayload(row) {
  if (!row) return {};
  const raw = row.payload;
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  }
  return { ...(parsed && typeof parsed === 'object' ? parsed : {}), id: row.id };
}

export function docPhasePayload(row) {
  if (!row) return {};
  let parsed = row.payload;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
  }
  return {
    ...(parsed && typeof parsed === 'object' ? parsed : {}),
    cloud_id: row.id,
    obra_id: row.obra_id,
    doc_id: row.doc_id,
    fase_key: row.fase_key || null
  };
}

export function validCloudId(value, max = 180) {
  const v = String(value || '').trim();
  return !!v && v.length <= max && /^[A-Za-z0-9_.:@-]+$/.test(v);
}

export function finitePercent(value, fallback = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(max, n));
}

export function sanitizeBdiConfig(input) {
  if (input == null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) return null;
  const desonerado = !!input.desonerado;
  const pis = 0.65;
  const cofins = 3.00;
  const cprb = desonerado ? 4.50 : 0;
  const sg = finitePercent(input.sg, finitePercent(input.s, 0.8) + finitePercent(input.g, 0.4), 30);
  const s = finitePercent(input.s, sg * 0.65, 30);
  const g = finitePercent(input.g, Math.max(0, sg - s), 30);
  const t = finitePercent(input.t, pis + cofins + finitePercent(input.iss, 3) + cprb, 50);
  const iss = finitePercent(input.iss, Math.max(0, t - pis - cofins - cprb), 10);
  return {
    ac: finitePercent(input.ac, 4, 30),
    sg, s, g,
    r: finitePercent(input.r, 1.2, 30),
    df: finitePercent(input.df, 1.23, 30),
    l: finitePercent(input.l, 7.4, 50),
    t, iss, desonerado,
    updated_at: typeof input.updated_at === 'string' ? input.updated_at.slice(0, 40) : new Date().toISOString()
  };
}

export function sanitizeCronogramaConfig(input) {
  if (input == null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) return null;
  const totalMesesRaw = Number.parseInt(input.totalMeses, 10);
  const totalMeses = Number.isFinite(totalMesesRaw) ? Math.max(3, Math.min(36, totalMesesRaw)) : 12;
  const mesInicio = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(input.mesInicio || '')) ? String(input.mesInicio) : null;
  const modoRaw = String(input.modoDistribuicao || input.modeloCurva || 'gaussiana');
  const modoDistribuicao = ['gaussiana', 'linear'].includes(modoRaw) ? modoRaw : 'gaussiana';
  const etapas = {};
  const source = Array.isArray(input.etapas)
    ? input.etapas.map((item, index) => [String(item?.id || item?.codigo || index), item])
    : Object.entries(input.etapas || {});
  for (const [rawId, raw] of source.slice(0, 60)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const id = String(raw.id || raw.codigo || rawId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    if (!id) continue;
    const previsto = raw.previstoTotal ?? raw.valorPrevisto;
    etapas[id] = {
      ativo: raw.ativo !== undefined ? !!raw.ativo : (raw.ativa !== undefined ? !!raw.ativa : true),
      previstoTotal: Math.max(0, cleanNum(previsto)),
      meses: Array.isArray(raw.meses) ? raw.meses.slice(0, totalMeses).map(v => Math.max(0, finitePercent(v, 0, 1000))) : []
    };
  }
  return {
    processos_sla: sanitizeSlaProcesses(input.processos_sla),
    totalMeses,
    mesInicio,
    modoDistribuicao,
    modeloCurva: modoDistribuicao,
    etapas,
    updated_at: new Date().toISOString()
  };
}

export function sanitizeTenantPreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const cleanCats = (list) => (Array.isArray(list) ? list : []).slice(0, 100).map(item => ({
    value: String(item?.value || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 80),
    label: String(item?.label || '').slice(0, 100),
    emoji: String(item?.emoji || '').slice(0, 16)
  })).filter(item => item.value && item.label);
  const out = {};
  if ('slas_padrao' in input) out.slas_padrao = sanitizeSlaProcesses(input.slas_padrao);
  if ('categorias_fornecedor' in input) out.categorias_fornecedor = cleanCats(input.categorias_fornecedor);
  if ('categorias_despesa' in input) out.categorias_despesa = cleanCats(input.categorias_despesa);
  if ('categorias_receita' in input) out.categorias_receita = cleanCats(input.categorias_receita);
  if ('whatsapp_telefone' in input) out.whatsapp_telefone = String(input.whatsapp_telefone || '').replace(/\D/g, '').slice(0, 15);
  if ('whatsapp_modo' in input) out.whatsapp_modo = ['api', 'web'].includes(String(input.whatsapp_modo)) ? String(input.whatsapp_modo) : 'api';
  if ('bdi_padrao' in input) out.bdi_padrao = sanitizeBdiConfig(input.bdi_padrao);
  return out;
}

export function todayBoaVista() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Boa_Vista',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function parsePagination(query = {}) {
  if (query.limit === undefined && query.offset === undefined && query.cursor === undefined) return null;
  const rawLimit = Number.parseInt(query.limit, 10);
  const rawOffset = Number.parseInt(query.offset, 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 250, 1), 500);
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
  const cursor = query.cursor ? String(query.cursor).trim() : null;
  return { limit, offset, cursor };
}

export function pageResponse(items, pagination) {
  if (!pagination) return { success: true, data: items };
  const lastItem = items.length ? items[items.length - 1] : null;
  const nextCursor = (items.length === pagination.limit && lastItem?.id) ? String(lastItem.id) : null;
  return {
    success: true,
    data: items,
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      cursor: pagination.cursor,
      nextCursor,
      count: items.length,
      hasMore: items.length === pagination.limit,
      nextOffset: pagination.offset + items.length
    }
  };
}

export function normalizeMedicao(m) {
  if (!m) return null;
  return {
    ...m,
    data: cleanDate(m.data),
    data_medicao: cleanDate(m.data),
    numero: m.numero,
    numero_medicao: m.numero_medicao || m.numero,
    percentual_fisico: cleanNum(m.percentual_fisico),
    percentual_financeiro: cleanNum(m.percentual_financeiro),
    valor_medido: cleanNum(m.valor_medido),
    valor_solicitado: cleanNum(m.valor_solicitado || m.valor_medido),
    valor_aprovado: m.valor_aprovado !== null && m.valor_aprovado !== undefined ? cleanNum(m.valor_aprovado) : null,
    valor_liberado: m.valor_liberado !== null && m.valor_liberado !== undefined ? cleanNum(m.valor_liberado) : null,
    data_previsao: cleanDate(m.data_previsao),
    data_submissao: cleanDate(m.data_submissao),
    data_aprovacao: cleanDate(m.data_aprovacao),
    data_liberacao: cleanDate(m.data_liberacao),
    engenheiro_responsavel: m.engenheiro_responsavel || '',
    etapa_descricao: m.etapa_descricao || '',
    documentos_ok: Boolean(m.documentos_ok),
    lancamento_id: m.lancamento_id || null,
    retencao_tecnica: cleanNum(m.retencao_tecnica),
    descontos: cleanNum(m.descontos),
    itens: (typeof m.itens_json === 'string' ? safeJsonParse(m.itens_json, []) : m.itens_json) || m.itens || []
  };
}

export function normalizeOrcamento(o) {
  if (!o) return null;
  const rawParsed = (typeof o.itens_json === 'string' ? safeJsonParse(o.itens_json, []) : o.itens_json) || o.itens || o.etapas || [];
  let itens = [];
  let categorias = [];
  let meta = {};

  if (Array.isArray(rawParsed)) {
    itens = rawParsed;
  } else if (rawParsed && typeof rawParsed === 'object') {
    itens = Array.isArray(rawParsed.itens) ? rawParsed.itens : (Array.isArray(rawParsed.etapas) ? rawParsed.etapas : []);
    categorias = Array.isArray(rawParsed.categorias) ? rawParsed.categorias : [];
    meta = rawParsed.meta || {};
  }

  const status = o.status || meta.status || rawParsed.status || 'ativo';
  const descricao = o.descricao || meta.descricao || rawParsed.descricao || '';
  const dataCriacao = cleanDate(o.data_criacao) || cleanDate(meta.data_criacao) || (o.created_at ? String(o.created_at).split('T')[0] : todayBoaVista());
  const titulo = o.titulo || o.nome || meta.titulo || meta.nome || 'Orçamento';
  const valorTotal = cleanNum(o.valor_total || o.valor_total_previsto || meta.valor_total);

  return {
    ...o,
    id: o.id,
    tenant_id: o.tenant_id,
    obra_id: o.obra_id,
    nome: titulo,
    titulo: titulo,
    status: status,
    descricao: descricao,
    data_criacao: dataCriacao,
    created_at: o.created_at,
    valor_total: valorTotal,
    valor_total_previsto: valorTotal,
    itens: itens,
    etapas: itens,
    categorias: categorias
  };
}
