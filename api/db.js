// api/db.js — API Serverless REST & Sincronização Multi-Tenant (Neon PostgreSQL)

import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { getPlanRule, isActiveObraStatus } from './_plans.js';
import { canWriteData, canDeleteData, canAccessTable, permissionError } from './_permissions.js';
import { writeAudit } from './_audit.js';

function tableAllowed(auth, table, action = 'read') {
  return canAccessTable(auth, table, action);
}

const SYNC_COLLECTION_TABLE = Object.freeze({
  clientes:'obras', fornecedores:'fornecedores', lancamentos:'lancamentos', notas:'notas',
  contas:'contas', precompras:'precompras', contratos:'contratos', recibos:'recibos',
  orcamentos_sinapi:'orcamentos_sinapi', doc_fases:'doc_fases', preferencias:'preferencias'
});

function deniedSyncCollection(auth, payload) {
  for (const [key, table] of Object.entries(SYNC_COLLECTION_TABLE)) {
    const value = payload?.[key];
    const hasData = Array.isArray(value) ? value.length > 0 : (value && typeof value === 'object' && Object.keys(value).length > 0);
    if (hasData && !tableAllowed(auth, table, 'write')) return { key, table };
  }
  return null;
}

function getSql() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    throw new Error('Variável de ambiente DATABASE_URL não configurada.');
  }
  return neon(conn);
}

function cleanDate(d) {
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

function cleanNum(n) {
  const val = Number(n);
  return isNaN(val) ? 0 : val;
}


function safeJsonParse(value, fallback = []) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch (err) {
    console.warn('[DB] safeJsonParse: falha ao interpretar JSON:', err.message);
    return fallback;
  }
}

function jsonPayload(row) {
  if (!row) return {};
  const raw = row.payload;
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  }
  return { ...(parsed && typeof parsed === 'object' ? parsed : {}), id: row.id };
}

function docPhasePayload(row) {
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

function validCloudId(value, max = 180) {
  const v = String(value || '').trim();
  return !!v && v.length <= max && /^[A-Za-z0-9_.:@-]+$/.test(v);
}

function sanitizeTenantPreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const cleanCats = (list) => (Array.isArray(list) ? list : []).slice(0, 100).map(item => ({
    value: String(item?.value || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 80),
    label: String(item?.label || '').slice(0, 100),
    emoji: String(item?.emoji || '').slice(0, 16)
  })).filter(item => item.value && item.label);
  const out = {};
  if ('categorias_fornecedor' in input) out.categorias_fornecedor = cleanCats(input.categorias_fornecedor);
  if ('categorias_despesa' in input) out.categorias_despesa = cleanCats(input.categorias_despesa);
  if ('whatsapp_telefone' in input) out.whatsapp_telefone = String(input.whatsapp_telefone || '').replace(/\D/g, '').slice(0, 15);
  if ('whatsapp_modo' in input) out.whatsapp_modo = ['api','web'].includes(String(input.whatsapp_modo)) ? String(input.whatsapp_modo) : 'api';
  if ('bdi_padrao' in input) out.bdi_padrao = sanitizeBdiConfig(input.bdi_padrao);
  return out;
}

function finitePercent(value, fallback = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(max, n));
}

function sanitizeBdiConfig(input) {
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

function sanitizeCronogramaConfig(input) {
  if (input == null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) return null;
  const totalMesesRaw = Number.parseInt(input.totalMeses, 10);
  const totalMeses = Number.isFinite(totalMesesRaw) ? Math.max(3, Math.min(36, totalMesesRaw)) : 12;
  const mesInicio = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(input.mesInicio || '')) ? String(input.mesInicio) : null;
  const modoRaw = String(input.modoDistribuicao || input.modeloCurva || 'gaussiana');
  const modoDistribuicao = ['gaussiana','linear'].includes(modoRaw) ? modoRaw : 'gaussiana';
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
  return { totalMeses, mesInicio, modoDistribuicao, modeloCurva: modoDistribuicao, etapas, updated_at: new Date().toISOString() };
}

function todayBoaVista() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Boa_Vista',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parsePagination(query = {}) {
  if (query.limit === undefined && query.offset === undefined) return null;
  const rawLimit = Number.parseInt(query.limit, 10);
  const rawOffset = Number.parseInt(query.offset, 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 250, 1), 500);
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
  return { limit, offset };
}


function auditPreview(table, data) {
  if (!data || typeof data !== 'object') return null;
  const out = { id: data.id || null };
  for (const k of ['nome','descricao','titulo','numero_nf','status','tipo','categoria','obra_id','valor','valor_total','nome_arquivo']) {
    if (data[k] !== undefined && data[k] !== null && data[k] !== '') out[k] = data[k];
  }
  return out;
}

async function auditDb(sql, req, auth, acao, table, data, id = null) {
  await writeAudit(sql, req, auth, {
    acao,
    entidade: String(table || 'dados').slice(0,80),
    entidadeId: String(id || data?.id || '').slice(0,128) || null,
    depois: acao === 'excluir' ? null : auditPreview(table, data),
    antes: acao === 'excluir' ? auditPreview(table, data) : null
  });
}

function pageResponse(items, pagination) {
  if (!pagination) return { success: true, data: items };
  return {
    success: true,
    data: items,
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      count: items.length,
      hasMore: items.length === pagination.limit,
      nextOffset: pagination.offset + items.length
    }
  };
}

function normalizeMedicao(m) {
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

function normalizeOrcamento(o) {
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

async function validateBulkObraPlanLimit(sql, tenantId, plan, obras) {
  if (!Array.isArray(obras) || obras.length === 0) return { allowed: true };
  const rule = getPlanRule(plan);
  if (rule.maxActiveObras == null) return { allowed: true };

  const rows = await sql`SELECT id, status FROM obras WHERE tenant_id = ${tenantId};`;
  const projected = new Map(rows.map((r) => [String(r.id), r.status]));
  let activeCount = rows.reduce((count, r) => count + (isActiveObraStatus(r.status) ? 1 : 0), 0);

  for (const obra of obras) {
    if (!obra?.id || !obra?.nome) continue;
    const key = String(obra.id);
    const previousActive = projected.has(key) && isActiveObraStatus(projected.get(key));
    const nextActive = isActiveObraStatus(obra.status);

    if (!previousActive && nextActive) activeCount += 1;
    if (previousActive && !nextActive) activeCount -= 1;
    projected.set(key, obra.status || 'em_andamento');

    if (activeCount > rule.maxActiveObras) {
      return {
        allowed: false,
        status: 409,
        body: {
          success: false,
          code: 'PLAN_OBRA_LIMIT',
          plan: rule.id,
          limit: rule.maxActiveObras,
          current: activeCount,
          error: `Seu ${rule.label} permite até ${rule.maxActiveObras} obras ativas simultâneas. A sincronização foi recusada antes de gravar para evitar uma atualização parcial.`
        }
      };
    }
  }

  return { allowed: true };
}

async function enforceObraPlanLimit(sql, tenantId, plan, obra) {
  if (!obra?.id || !isActiveObraStatus(obra.status)) return { allowed: true };
  const rule = getPlanRule(plan);
  if (rule.maxActiveObras == null) return { allowed: true };

  const existing = await sql`SELECT status FROM obras WHERE id = ${obra.id} AND tenant_id = ${tenantId} LIMIT 1;`;
  if (existing.length && isActiveObraStatus(existing[0].status)) return { allowed: true };

  const countRows = await sql`
    SELECT COUNT(*)::int AS total
    FROM obras
    WHERE tenant_id = ${tenantId}
      AND LOWER(COALESCE(status, 'em_andamento')) NOT IN ('concluida','concluído','concluido','cancelada','cancelado');
  `;
  const current = Number(countRows[0]?.total || 0);
  if (current >= rule.maxActiveObras) {
    return {
      allowed: false,
      status: 409,
      body: {
        success: false,
        code: 'PLAN_OBRA_LIMIT',
        plan: rule.id,
        limit: rule.maxActiveObras,
        current,
        error: `Seu ${rule.label} permite até ${rule.maxActiveObras} obras ativas simultâneas. Conclua/cancele uma obra ou faça upgrade do plano para cadastrar outra.`
      }
    };
  }
  return { allowed: true };
}

// ── VALIDAÇÃO DE INTEGRIDADE REFERENCIAL MULTI-TENANT ────────────────────────
async function validateObraTenant(sql, obraId, tenantId) {
  if (!obraId) return null;
  const clean = obraId.toString().trim();
  if (clean === 'escritorio' || clean === 'geral') {
    await sql`
      INSERT INTO obras (id, tenant_id, nome, cliente, status)
      VALUES ('escritorio', ${tenantId}, 'Sede / Escritório Central', 'Administrativo', 'sistema')
      ON CONFLICT (tenant_id, id) DO NOTHING;
    `;
    return 'escritorio';
  }
  const rows = await sql`SELECT id FROM obras WHERE id = ${clean} AND tenant_id = ${tenantId} LIMIT 1;`;
  return rows.length > 0 ? clean : null;
}

async function validateFornecedorTenant(sql, fornecedorId, tenantId) {
  if (!fornecedorId) return null;
  const clean = fornecedorId.toString().trim();
  const rows = await sql`SELECT id FROM fornecedores WHERE id = ${clean} AND tenant_id = ${tenantId} LIMIT 1;`;
  return rows.length > 0 ? clean : null;
}

async function validateNotaFiscalTenant(sql, notaId, tenantId) {
  if (!notaId) return null;
  const clean = notaId.toString().trim();
  const rows = await sql`SELECT id FROM notas_fiscais WHERE id = ${clean} AND tenant_id = ${tenantId} LIMIT 1;`;
  return rows.length > 0 ? clean : null;
}

const ALLOWED_ORIGINS = [
  'https://finobra.app.br',
  'https://www.finobra.app.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/finan-as(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apikey, x-api-key, x-tenant-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validação estrita de autenticação e resolução segura de tenant
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({
      success: false,
      error: auth.error || 'Acesso não autorizado. Forneça Authorization: Bearer <token> ou x-api-key válido.'
    });
  }

  const tenantId = auth.tenantId;
  const sql = getSql();

  try {
    // ── GET: Consultar dados isolados pelo Tenant ─────────────────────────────
    if (req.method === 'GET') {
      const { table, obra_id, id } = req.query || {};
      const pagination = parsePagination(req.query || {});
      const requestedTable = String(table || '').trim();
      if (requestedTable && !['all','sync_manifest'].includes(requestedTable) && !tableAllowed(auth, requestedTable, 'read')) {
        return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN', requestedTable));
      }

      if (table === 'sync_manifest') {
        const rows = await sql`
          SELECT
            (SELECT COUNT(*)::int FROM obras WHERE tenant_id = ${tenantId}) AS obras,
            (SELECT COUNT(*)::int FROM fornecedores WHERE tenant_id = ${tenantId}) AS fornecedores,
            (SELECT COUNT(*)::int FROM lancamentos WHERE tenant_id = ${tenantId}) AS lancamentos,
            (SELECT COUNT(*)::int FROM notas_fiscais WHERE tenant_id = ${tenantId}) AS notas,
            (SELECT COUNT(*)::int FROM orcamentos WHERE tenant_id = ${tenantId}) AS orcamentos,
            (SELECT COUNT(*)::int FROM medicoes WHERE tenant_id = ${tenantId}) AS medicoes,
            (SELECT COUNT(*)::int FROM documentos WHERE tenant_id = ${tenantId}) AS documentos,
            (SELECT COUNT(*)::int FROM produtos WHERE tenant_id = ${tenantId}) AS produtos,
            (SELECT COUNT(*)::int FROM contas_bancarias WHERE tenant_id = ${tenantId}) AS contas,
            (SELECT COUNT(*)::int FROM precompras WHERE tenant_id = ${tenantId}) AS precompras,
            (SELECT COUNT(*)::int FROM contratos WHERE tenant_id = ${tenantId}) AS contratos,
            (SELECT COUNT(*)::int FROM recibos WHERE tenant_id = ${tenantId}) AS recibos,
            (SELECT COUNT(*)::int FROM orcamentos_sinapi WHERE tenant_id = ${tenantId}) AS orcamentos_sinapi,
            (SELECT COUNT(*)::int FROM obra_doc_fases WHERE tenant_id = ${tenantId}) AS doc_fases;
        `;
        const counts = rows[0] || {};
        const manifestTable = { obras:'obras', fornecedores:'fornecedores', lancamentos:'lancamentos', notas:'notas', orcamentos:'orcamentos', medicoes:'medicoes', documentos:'documentos', produtos:'produtos', contas:'contas', precompras:'precompras', contratos:'contratos', recibos:'recibos', orcamentos_sinapi:'orcamentos_sinapi', doc_fases:'doc_fases' };
        const normalized = Object.fromEntries(Object.entries(counts).map(([k,v]) => [k, tableAllowed(auth, manifestTable[k] || k, 'read') ? (Number(v) || 0) : 0]));
        return res.status(200).json({ success: true, counts: normalized, total: Object.values(normalized).reduce((a,b) => a + b, 0) });
      }

      if (!table || table === 'all') {
        const [obras, fornecedores, lancamentos, notas, orcamentos, medicoes, documentos, produtos, contas, precompras, contratos, recibos, orcamentosSinapi, docFases, preferenciasRows] = await Promise.all([
          sql`SELECT * FROM obras WHERE tenant_id = ${tenantId} AND id NOT IN ('escritorio', 'geral') ORDER BY nome ASC;`,
          sql`SELECT * FROM fornecedores WHERE tenant_id = ${tenantId} ORDER BY nome ASC;`,
          sql`SELECT * FROM lancamentos WHERE tenant_id = ${tenantId} ORDER BY data DESC, created_at DESC;`,
          sql`SELECT * FROM notas_fiscais WHERE tenant_id = ${tenantId} ORDER BY data_emissao DESC;`,
          sql`SELECT * FROM orcamentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC;`,
          sql`SELECT * FROM medicoes WHERE tenant_id = ${tenantId} ORDER BY data DESC;`,
          sql`SELECT id, tipo, referencia_id, titulo, categoria, nome_arquivo, tipo_arquivo, tamanho_bytes, url, created_at FROM documentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC;`,
          sql`SELECT * FROM produtos WHERE tenant_id = ${tenantId} ORDER BY nome ASC;`,
          sql`SELECT * FROM contas_bancarias WHERE tenant_id = ${tenantId} ORDER BY created_at ASC;`,
          sql`SELECT * FROM precompras WHERE tenant_id = ${tenantId} ORDER BY data_solicitacao DESC NULLS LAST, updated_at DESC;`,
          sql`SELECT * FROM contratos WHERE tenant_id = ${tenantId} ORDER BY updated_at DESC;`,
          sql`SELECT * FROM recibos WHERE tenant_id = ${tenantId} ORDER BY data DESC NULLS LAST, updated_at DESC;`,
          sql`SELECT * FROM orcamentos_sinapi WHERE tenant_id = ${tenantId} ORDER BY updated_at DESC;`,
          sql`SELECT * FROM obra_doc_fases WHERE tenant_id = ${tenantId} ORDER BY updated_at DESC;`,
          sql`SELECT preferences FROM tenant_preferences WHERE tenant_id = ${tenantId} LIMIT 1;`
        ]);

        return res.status(200).json({
          success: true,
          tenantId,
          data: {
            clientes: tableAllowed(auth, 'obras', 'read') ? obras.map(o => ({
              ...o,
              data_inicio: cleanDate(o.data_inicio),
              data_previsao: cleanDate(o.data_previsao)
            })) : [],
            fornecedores: tableAllowed(auth, 'fornecedores', 'read') ? fornecedores.map(f => ({
              ...f,
              cnpj: f.cnpj_cpf || f.cnpj || '',
              razao_social: f.razao_social || f.nome,
              nome_fantasia: f.nome,
              endereco: f.endereco || '',
              municipio: f.municipio || '',
              uf: f.uf || '',
              ativo: f.ativo !== false
            })) : [],
            lancamentos: tableAllowed(auth, 'lancamentos', 'read') ? lancamentos.map(l => ({
              ...l,
              data: cleanDate(l.data) || todayBoaVista(),
              data_vencimento: cleanDate(l.data_vencimento) || cleanDate(l.data),
              data_pagamento: cleanDate(l.data_pagamento),
              valor: cleanNum(l.valor),
              itens: Array.isArray(l.itens) ? l.itens : safeJsonParse(l.itens, [])
            })) : [],
            notas: tableAllowed(auth, 'notas', 'read') ? notas.map(n => ({
              ...n,
              data_emissao: cleanDate(n.data_emissao),
              data_vencimento: cleanDate(n.data_vencimento),
              data_pagamento: cleanDate(n.data_pagamento),
              valor_bruto: cleanNum(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total),
              impostos: cleanNum(n.impostos),
              valor_liquido: cleanNum(n.valor_liquido !== undefined ? n.valor_liquido : (n.valor_bruto || n.valor_total)),
              valor_total: cleanNum(n.valor_total !== undefined ? n.valor_total : n.valor_bruto),
              categoria: n.categoria || 'material',
              tipo: n.tipo || 'entrada',
              chave_nfe: n.chave_nfe || n.chave_acesso || '',
              itens: Array.isArray(n.itens) ? n.itens : safeJsonParse(n.itens, [])
            })) : [],
            produtos: tableAllowed(auth, 'produtos', 'read') ? (produtos || []).map(p => ({
              ...p,
              valor_medio: cleanNum(p.valor_medio)
            })) : [],
            orcamentos: tableAllowed(auth, 'orcamentos', 'read') ? orcamentos.map(normalizeOrcamento) : [],
            medicoes: tableAllowed(auth, 'medicoes', 'read') ? medicoes.map(normalizeMedicao) : [],
            documentos: tableAllowed(auth, 'documentos', 'read') ? documentos : [],
            contas: tableAllowed(auth, 'contas', 'read') ? (contas || []) : [],
            precompras: tableAllowed(auth, 'precompras', 'read') ? (precompras || []).map(jsonPayload) : [],
            contratos: tableAllowed(auth, 'contratos', 'read') ? (contratos || []).map(jsonPayload) : [],
            recibos: tableAllowed(auth, 'recibos', 'read') ? (recibos || []).map(jsonPayload) : [],
            orcamentos_sinapi: tableAllowed(auth, 'orcamentos_sinapi', 'read') ? (orcamentosSinapi || []).map(jsonPayload) : [],
            doc_fases: tableAllowed(auth, 'doc_fases', 'read') ? (docFases || []).map(docPhasePayload) : [],
            preferencias: tableAllowed(auth, 'preferencias', 'read') ? (preferenciasRows?.[0]?.preferences || {}) : {}
          }
        });
      }

      if (table === 'lancamentos') {
        let items;
        if (obra_id) {
          items = pagination
            ? await sql`SELECT * FROM lancamentos WHERE tenant_id = ${tenantId} AND obra_id = ${obra_id} ORDER BY data DESC, created_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
            : await sql`SELECT * FROM lancamentos WHERE tenant_id = ${tenantId} AND obra_id = ${obra_id} ORDER BY data DESC, created_at DESC, id DESC;`;
        } else {
          items = pagination
            ? await sql`SELECT * FROM lancamentos WHERE tenant_id = ${tenantId} ORDER BY data DESC, created_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
            : await sql`SELECT * FROM lancamentos WHERE tenant_id = ${tenantId} ORDER BY data DESC, created_at DESC, id DESC;`;
        }
        const normalized = items.map(l => ({
          ...l,
          data: cleanDate(l.data) || todayBoaVista(),
          data_vencimento: cleanDate(l.data_vencimento) || cleanDate(l.data),
          data_pagamento: cleanDate(l.data_pagamento),
          valor: cleanNum(l.valor)
        }));
        return res.status(200).json(pageResponse(normalized, pagination));
      }

      if (table === 'notas' || table === 'notas_fiscais') {
        let items;
        if (obra_id) {
          items = pagination
            ? await sql`SELECT * FROM notas_fiscais WHERE tenant_id = ${tenantId} AND obra_id = ${obra_id} ORDER BY data_emissao DESC, created_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
            : await sql`SELECT * FROM notas_fiscais WHERE tenant_id = ${tenantId} AND obra_id = ${obra_id} ORDER BY data_emissao DESC, created_at DESC, id DESC;`;
        } else {
          items = pagination
            ? await sql`SELECT * FROM notas_fiscais WHERE tenant_id = ${tenantId} ORDER BY data_emissao DESC, created_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
            : await sql`SELECT * FROM notas_fiscais WHERE tenant_id = ${tenantId} ORDER BY data_emissao DESC, created_at DESC, id DESC;`;
        }
        const normalized = items.map(n => ({
          ...n,
          data_emissao: cleanDate(n.data_emissao),
          data_vencimento: cleanDate(n.data_vencimento),
          data_pagamento: cleanDate(n.data_pagamento),
          valor_bruto: cleanNum(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total),
          impostos: cleanNum(n.impostos),
          valor_liquido: cleanNum(n.valor_liquido !== undefined ? n.valor_liquido : (n.valor_bruto || n.valor_total)),
          valor_total: cleanNum(n.valor_total !== undefined ? n.valor_total : n.valor_bruto),
          categoria: n.categoria || 'material',
          tipo: n.tipo || 'entrada',
          chave_nfe: n.chave_nfe || n.chave_acesso || ''
        }));
        return res.status(200).json(pageResponse(normalized, pagination));
      }

      if (table === 'obras' || table === 'clientes') {
        const items = await sql`SELECT * FROM obras WHERE tenant_id = ${tenantId} AND id NOT IN ('escritorio', 'geral') ORDER BY nome ASC;`;
        return res.status(200).json({
          success: true,
          data: items.map(o => ({
            ...o,
            data_inicio: cleanDate(o.data_inicio),
            data_previsao: cleanDate(o.data_previsao)
          }))
        });
      }

      if (table === 'fornecedores') {
        const items = await sql`SELECT * FROM fornecedores WHERE tenant_id = ${tenantId} ORDER BY nome ASC;`;
        return res.status(200).json({ success: true, data: items });
      }

      if (table === 'produtos') {
        const items = await sql`SELECT * FROM produtos WHERE tenant_id = ${tenantId} ORDER BY nome ASC;`;
        return res.status(200).json({ success: true, data: items.map(p => ({ ...p, valor_medio: cleanNum(p.valor_medio) })) });
      }

      if (table === 'documentos') {
        const items = pagination
          ? await sql`SELECT id, tipo, referencia_id, titulo, categoria, nome_arquivo, tipo_arquivo, tamanho_bytes, url, created_at FROM documentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`SELECT id, tipo, referencia_id, titulo, categoria, nome_arquivo, tipo_arquivo, tamanho_bytes, url, created_at FROM documentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC, id DESC;`;
        return res.status(200).json(pageResponse(items, pagination));
      }

      if (table === 'documento_conteudo') {
        const docId = id || req.query.id;
        if (!docId) return res.status(400).json({ error: 'ID do documento obrigatório' });
        const rows = await sql`SELECT base64_data, url, tipo_arquivo, nome_arquivo FROM documentos WHERE id = ${docId} AND tenant_id = ${tenantId} LIMIT 1;`;
        if (!rows.length || (!rows[0].base64_data && !rows[0].url)) {
          return res.status(404).json({ success: false, error: 'Conteúdo do arquivo não encontrado na nuvem' });
        }
        return res.status(200).json({
          success: true,
          url: rows[0].url || null,
          base64: rows[0].base64_data || null,
          tipo: rows[0].tipo_arquivo,
          nome: rows[0].nome_arquivo
        });
      }

      if (table === 'ocr_historico') {
        const items = await sql`SELECT * FROM ocr_historico WHERE tenant_id = ${tenantId} ORDER BY data_hora DESC LIMIT 50;`;
        return res.status(200).json({
          success: true,
          data: items.map(h => ({
            ...h,
            valor: cleanNum(h.valor),
            confianca: cleanNum(h.confianca),
            dados: typeof h.dados === 'string' ? JSON.parse(h.dados) : (h.dados || {})
          }))
        });
      }

      if (table === 'contas' || table === 'contas_bancarias') {
        const items = await sql`SELECT * FROM contas_bancarias WHERE tenant_id = ${tenantId} ORDER BY created_at ASC;`;
        return res.status(200).json({ success: true, data: items });
      }

      if (table === 'precompras') {
        const items = pagination
          ? await sql`SELECT * FROM precompras WHERE tenant_id=${tenantId} ORDER BY data_solicitacao DESC NULLS LAST, updated_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`SELECT * FROM precompras WHERE tenant_id=${tenantId} ORDER BY data_solicitacao DESC NULLS LAST, updated_at DESC, id DESC;`;
        return res.status(200).json(pageResponse(items.map(jsonPayload), pagination));
      }

      if (table === 'contratos') {
        const items = pagination
          ? await sql`SELECT * FROM contratos WHERE tenant_id=${tenantId} ORDER BY updated_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`SELECT * FROM contratos WHERE tenant_id=${tenantId} ORDER BY updated_at DESC, id DESC;`;
        return res.status(200).json(pageResponse(items.map(jsonPayload), pagination));
      }

      if (table === 'recibos') {
        const items = pagination
          ? await sql`SELECT * FROM recibos WHERE tenant_id=${tenantId} ORDER BY data DESC NULLS LAST, updated_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`SELECT * FROM recibos WHERE tenant_id=${tenantId} ORDER BY data DESC NULLS LAST, updated_at DESC, id DESC;`;
        return res.status(200).json(pageResponse(items.map(jsonPayload), pagination));
      }

      if (table === 'orcamentos_sinapi') {
        const items = pagination
          ? await sql`SELECT * FROM orcamentos_sinapi WHERE tenant_id=${tenantId} ORDER BY updated_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`SELECT * FROM orcamentos_sinapi WHERE tenant_id=${tenantId} ORDER BY updated_at DESC, id DESC;`;
        return res.status(200).json(pageResponse(items.map(jsonPayload), pagination));
      }

      if (table === 'doc_fases') {
        let items;
        if (obra_id) {
          items = pagination
            ? await sql`SELECT * FROM obra_doc_fases WHERE tenant_id=${tenantId} AND obra_id=${obra_id} ORDER BY updated_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
            : await sql`SELECT * FROM obra_doc_fases WHERE tenant_id=${tenantId} AND obra_id=${obra_id} ORDER BY updated_at DESC, id DESC;`;
        } else {
          items = pagination
            ? await sql`SELECT * FROM obra_doc_fases WHERE tenant_id=${tenantId} ORDER BY updated_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
            : await sql`SELECT * FROM obra_doc_fases WHERE tenant_id=${tenantId} ORDER BY updated_at DESC, id DESC;`;
        }
        return res.status(200).json(pageResponse(items.map(docPhasePayload), pagination));
      }

      if (table === 'preferencias') {
        const rows = await sql`SELECT preferences FROM tenant_preferences WHERE tenant_id=${tenantId} LIMIT 1;`;
        return res.status(200).json({ success:true, data:rows[0]?.preferences || {} });
      }

      if (table === 'orcamentos') {
        const items = pagination
          ? await sql`SELECT * FROM orcamentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`SELECT * FROM orcamentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC, id DESC;`;
        const normalized = items.map(normalizeOrcamento);
        return res.status(200).json(pageResponse(normalized, pagination));
      }

      if (table === 'medicoes') {
        const items = pagination
          ? await sql`SELECT * FROM medicoes WHERE tenant_id = ${tenantId} ORDER BY data DESC, created_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`SELECT * FROM medicoes WHERE tenant_id = ${tenantId} ORDER BY data DESC, created_at DESC, id DESC;`;
        const normalized = items.map(normalizeMedicao);
        return res.status(200).json(pageResponse(normalized, pagination));
      }

      return res.status(400).json({ success: false, error: `Tabela '${table}' desconhecida para consulta.`, code: 'UNKNOWN_TABLE' });
    }

    // ── POST: Gravação / Atualização / Exclusão / Sync com Tenant Scoping ───────
    if (req.method === 'POST') {
      const { action, table, data, id, payload } = req.body || {};

      if ((action === 'sync_all' || action === 'save') && !canWriteData(auth)) {
        return res.status(403).json(permissionError('ROLE_READ_ONLY'));
      }
      if (action === 'delete' && !canDeleteData(auth)) {
        return res.status(403).json(permissionError('ROLE_DELETE_FORBIDDEN'));
      }
      if (action === 'save' && table && !tableAllowed(auth, table, 'write')) {
        return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN', String(table)));
      }
      if (action === 'delete' && table && !tableAllowed(auth, table, 'delete')) {
        return res.status(403).json(permissionError('MODULE_DELETE_FORBIDDEN', String(table)));
      }
      if (action === 'sync_all' && payload) {
        const denied = deniedSyncCollection(auth, payload);
        if (denied) return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN', denied.table));
      }

      // 1. Sincronização em Massa (Local -> Neon com tenant_id)
      if (action === 'sync_all' && payload) {
        let totalCount = 0;
        const failures = [];
        const recordFailure = (table, item, error, code = 'SYNC_ITEM_FAILED') => {
          failures.push({
            table,
            id: String(item?.cloud_id || item?.id || '').slice(0, 180) || null,
            code,
            error: String(error || 'Falha ao sincronizar registro.').slice(0, 500)
          });
        };

        // Obras — valida o lote inteiro antes da primeira gravação para evitar sync parcial
        if (Array.isArray(payload.clientes)) {
          if (!auth.isSystem && auth.user?.perfil !== 'superadmin') {
            const planCheck = await validateBulkObraPlanLimit(sql, tenantId, auth.user?.tenantPlan, payload.clientes);
            if (!planCheck.allowed) return res.status(planCheck.status).json(planCheck.body);
          }
          for (const o of payload.clientes) {
            if (!o.id || !o.nome) continue;
            const cronogramaJson = o.cronograma_config == null ? null : JSON.stringify(sanitizeCronogramaConfig(o.cronograma_config));
            const bdiJson = o.bdi_config == null ? null : JSON.stringify(sanitizeBdiConfig(o.bdi_config));
            await sql`
              INSERT INTO obras (id, tenant_id, nome, cliente, endereco, orcamento_total, status, data_inicio, data_previsao, cronograma_config, bdi_config)
              VALUES (
                ${o.id}, ${tenantId}, ${o.nome}, ${o.cliente || ''}, ${o.endereco || ''},
                ${cleanNum(o.orcamento_total || o.valor_contrato)}, ${o.status || 'em_andamento'},
                ${cleanDate(o.data_inicio)}, ${cleanDate(o.data_previsao)},
                ${cronogramaJson}::jsonb, ${bdiJson}::jsonb
              )
              ON CONFLICT (tenant_id, id) DO UPDATE SET
                nome = EXCLUDED.nome,
                cliente = EXCLUDED.cliente,
                endereco = EXCLUDED.endereco,
                orcamento_total = EXCLUDED.orcamento_total,
                status = EXCLUDED.status,
                data_inicio = EXCLUDED.data_inicio,
                data_previsao = EXCLUDED.data_previsao,
                cronograma_config = EXCLUDED.cronograma_config,
                bdi_config = EXCLUDED.bdi_config;
            `;
            totalCount++;
          }
        }

        // Fornecedores
        if (Array.isArray(payload.fornecedores)) {
          for (const f of payload.fornecedores) {
            if (!f.id) continue;
            const nomeFinal = (f.nome || f.nome_fantasia || f.razao_social || f.razao || 'Fornecedor').trim();
            const razaoSocialFinal = (f.razao_social || f.nome_fantasia || f.nome || nomeFinal).trim();
            const cnpjCpfFinal = (f.cnpj_cpf || f.cnpj || f.cpf || '').replace(/\D/g, '');
            await sql`
              INSERT INTO fornecedores (
                id, tenant_id, nome, razao_social, cnpj_cpf, telefone, email, categoria,
                chave_pix, banco_info, endereco, municipio, uf, ativo
              )
              VALUES (
                ${f.id}, ${tenantId}, ${nomeFinal}, ${razaoSocialFinal}, ${cnpjCpfFinal},
                ${f.telefone || ''}, ${f.email || ''}, ${f.categoria || 'outros'}, ${f.chave_pix || ''}, ${f.banco_info || ''},
                ${f.endereco || ''}, ${f.municipio || ''}, ${(f.uf || '').toUpperCase().slice(0, 2)}, ${f.ativo !== false}
              )
              ON CONFLICT (id) DO UPDATE SET
                nome = EXCLUDED.nome,
                razao_social = EXCLUDED.razao_social,
                cnpj_cpf = EXCLUDED.cnpj_cpf,
                telefone = EXCLUDED.telefone,
                email = EXCLUDED.email,
                categoria = EXCLUDED.categoria,
                chave_pix = EXCLUDED.chave_pix,
                banco_info = EXCLUDED.banco_info,
                endereco = EXCLUDED.endereco,
                municipio = EXCLUDED.municipio,
                uf = EXCLUDED.uf,
                ativo = EXCLUDED.ativo
              WHERE fornecedores.tenant_id = ${tenantId};
            `;
            totalCount++;
          }
        }

        // Pré-Compras — payload completo com campos indexáveis
        if (Array.isArray(payload.precompras)) {
          for (const pc of payload.precompras) {
            if (!pc?.id) continue;
            const safeObraId = await validateObraTenant(sql, pc.obra_id, tenantId);
            const rawJson = JSON.stringify(pc);
            await sql`
              INSERT INTO precompras (tenant_id,id,obra_id,numero_ordem,status,valor_total,data_solicitacao,payload)
              VALUES (${tenantId},${pc.id},${safeObraId},${pc.numero_ordem || null},${pc.status || 'rascunho'},${cleanNum(pc.valor_total)},${cleanDate(pc.data_solicitacao)},${rawJson}::jsonb)
              ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,numero_ordem=EXCLUDED.numero_ordem,status=EXCLUDED.status,valor_total=EXCLUDED.valor_total,data_solicitacao=EXCLUDED.data_solicitacao,payload=EXCLUDED.payload,updated_at=NOW();
            `;
            totalCount++;
          }
        }

        if (Array.isArray(payload.contratos)) {
          for (const c of payload.contratos) {
            if (!c?.id) continue;
            const safeObraId = await validateObraTenant(sql, c.obra_id, tenantId);
            const rawJson = JSON.stringify(c);
            await sql`
              INSERT INTO contratos (tenant_id,id,obra_id,numero,status,payload)
              VALUES (${tenantId},${c.id},${safeObraId},${c.numero || null},${c.status || 'pendente'},${rawJson}::jsonb)
              ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,numero=EXCLUDED.numero,status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=NOW();
            `;
            totalCount++;
          }
        }

        if (Array.isArray(payload.recibos)) {
          for (const r of payload.recibos) {
            if (!r?.id) continue;
            const safeObraId = await validateObraTenant(sql, r.obra_id, tenantId);
            const rawJson = JSON.stringify(r);
            const recStatus = r.assinatura ? 'assinado' : (r.status || 'pendente');
            await sql`
              INSERT INTO recibos (tenant_id,id,obra_id,numero,tipo,valor,data,status,payload)
              VALUES (${tenantId},${r.id},${safeObraId},${r.numero || null},${r.tipo || null},${cleanNum(r.valor)},${cleanDate(r.data)},${recStatus},${rawJson}::jsonb)
              ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,numero=EXCLUDED.numero,tipo=EXCLUDED.tipo,valor=EXCLUDED.valor,data=EXCLUDED.data,status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=NOW();
            `;
            totalCount++;
          }
        }

        if (Array.isArray(payload.orcamentos_sinapi)) {
          for (const o of payload.orcamentos_sinapi) {
            if (!o?.id || !validCloudId(o.id, 80)) {
              recordFailure('orcamentos_sinapi', o, 'ID de orçamento SINAPI inválido.', 'INVALID_ID');
              continue;
            }
            const safeObraId = await validateObraTenant(sql, o.obra_id, tenantId);
            if (o.obra_id && !safeObraId) {
              recordFailure('orcamentos_sinapi', o, 'A obra vinculada não pertence ao tenant autenticado.', 'INVALID_TENANT_RELATION');
              continue;
            }
            const dbObraId = (!safeObraId || safeObraId === 'escritorio' || safeObraId === 'geral') ? null : safeObraId;
            const rawJson = JSON.stringify(o);
            const subtotal = (Array.isArray(o.itens) ? o.itens : []).reduce((sum, item) => sum + cleanNum(item?.total), 0);
            const total = subtotal * (1 + cleanNum(o.bdi) / 100);
            try {
              await sql`
                INSERT INTO orcamentos_sinapi (tenant_id,id,obra_id,nome,status,valor_total,payload)
                VALUES (${tenantId},${o.id},${dbObraId},${o.nome || 'Orçamento SINAPI'},${o.status || 'ativo'},${total},${rawJson}::jsonb)
                ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,nome=EXCLUDED.nome,status=EXCLUDED.status,valor_total=EXCLUDED.valor_total,payload=EXCLUDED.payload,updated_at=NOW();
              `;
              totalCount++;
            } catch (bulkErr) {
              console.warn('[Sync All] Falha ao salvar orcamento_sinapi:', bulkErr.message);
              recordFailure('orcamentos_sinapi', o, bulkErr.message, 'DATABASE_WRITE_FAILED');
            }
          }
        }

        if (Array.isArray(payload.doc_fases)) {
          for (const d of payload.doc_fases) {
            const cloudId = String(d?.cloud_id || d?.id || '').trim();
            if (!validCloudId(cloudId, 180) || !d?.obra_id || !d?.doc_id) {
              recordFailure('doc_fases', d, 'Fase documental com identificadores incompletos.', 'INVALID_ID');
              continue;
            }
            const safeObraId = await validateObraTenant(sql, d.obra_id, tenantId);
            if (!safeObraId || ['escritorio','geral'].includes(safeObraId)) {
              recordFailure('doc_fases', d, 'A obra da fase documental não pertence ao tenant autenticado.', 'INVALID_TENANT_RELATION');
              continue;
            }
            const rawJson = JSON.stringify({ ...d, id:d.doc_id });
            await sql`
              INSERT INTO obra_doc_fases (tenant_id,id,obra_id,doc_id,fase_key,payload)
              VALUES (${tenantId},${cloudId},${safeObraId},${String(d.doc_id).slice(0,100)},${d.fase_key || null},${rawJson}::jsonb)
              ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,doc_id=EXCLUDED.doc_id,fase_key=EXCLUDED.fase_key,payload=EXCLUDED.payload,updated_at=NOW();
            `;
            totalCount++;
          }
        }

        if (payload.preferencias && typeof payload.preferencias === 'object' && !Array.isArray(payload.preferencias)) {
          const safePrefs = sanitizeTenantPreferences(payload.preferencias);
          const prefJson = JSON.stringify(safePrefs);
          await sql`
            INSERT INTO tenant_preferences (tenant_id,preferences)
            VALUES (${tenantId},${prefJson}::jsonb)
            ON CONFLICT (tenant_id) DO UPDATE SET preferences=tenant_preferences.preferences || EXCLUDED.preferences,updated_at=NOW();
          `;
          totalCount++;
        }

        // Lançamentos (com validação estrita de tenant nos relacionamentos)
        const [tenantObrasList, tenantFornecedoresList, tenantNotasList] = await Promise.all([
          sql`SELECT id FROM obras WHERE tenant_id = ${tenantId};`,
          sql`SELECT id FROM fornecedores WHERE tenant_id = ${tenantId};`,
          sql`SELECT id FROM notas_fiscais WHERE tenant_id = ${tenantId};`
        ]);
        const validObrasSet = new Set(tenantObrasList.map(r => r.id));
        validObrasSet.add('escritorio');
        validObrasSet.add('geral');
        const validFornecedoresSet = new Set(tenantFornecedoresList.map(r => r.id));
        const validNotasSet = new Set(tenantNotasList.map(r => r.id));

        if (Array.isArray(payload.lancamentos)) {
          for (const l of payload.lancamentos) {
            if (!l.id || !l.descricao) continue;
            const dataLanc = cleanDate(l.data) || todayBoaVista();
            const dataVenc = cleanDate(l.data_vencimento) || dataLanc;
            const dataPag = cleanDate(l.data_pagamento);
            const itensJson = JSON.stringify(Array.isArray(l.itens) ? l.itens : []);

            const safeObraId = (l.obra_id && (l.obra_id === 'escritorio' || l.obra_id === 'geral' || validObrasSet.has(l.obra_id))) ? l.obra_id : null;
            const safeNotaId = (l.nota_fiscal_id && validNotasSet.has(l.nota_fiscal_id)) ? l.nota_fiscal_id : null;

            await sql`
              INSERT INTO lancamentos (
                id, tenant_id, data, data_vencimento, data_pagamento, descricao, categoria,
                fornecedor_beneficiario, conta_bancaria, tipo, valor, status,
                obra_id, nota_fiscal_id, codigo_barras, chave_nfe, observacoes, conciliado, itens
              )
              VALUES (
                ${l.id}, ${tenantId}, ${dataLanc}, ${dataVenc}, ${dataPag}, ${l.descricao}, ${l.categoria || 'Outros'},
                ${l.fornecedor_beneficiario || ''}, ${l.conta_bancaria || ''}, ${l.tipo || 'despesa'}, ${cleanNum(l.valor)}, ${l.status || 'pendente'},
                ${safeObraId}, ${safeNotaId}, ${l.codigo_barras || null}, ${l.chave_nfe || null}, ${l.observacoes || ''}, ${!!l.conciliado},
                ${itensJson}::jsonb
              )
              ON CONFLICT (id) DO UPDATE SET
                data = EXCLUDED.data,
                data_vencimento = EXCLUDED.data_vencimento,
                data_pagamento = EXCLUDED.data_pagamento,
                descricao = EXCLUDED.descricao,
                categoria = EXCLUDED.categoria,
                fornecedor_beneficiario = EXCLUDED.fornecedor_beneficiario,
                conta_bancaria = EXCLUDED.conta_bancaria,
                tipo = EXCLUDED.tipo,
                valor = EXCLUDED.valor,
                status = EXCLUDED.status,
                obra_id = EXCLUDED.obra_id,
                nota_fiscal_id = EXCLUDED.nota_fiscal_id,
                codigo_barras = EXCLUDED.codigo_barras,
                chave_nfe = EXCLUDED.chave_nfe,
                observacoes = EXCLUDED.observacoes,
                conciliado = EXCLUDED.conciliado,
                itens = EXCLUDED.itens
              WHERE lancamentos.tenant_id = ${tenantId};
            `;
            totalCount++;
          }
        }

        // Notas Fiscais
        if (Array.isArray(payload.notas)) {
          for (const n of payload.notas) {
            if (!n.id) continue;
            const vBruto = cleanNum(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total);
            const vImp = cleanNum(n.impostos);
            const vLiq = cleanNum(n.valor_liquido !== undefined ? n.valor_liquido : (vBruto - vImp));
            const vTot = cleanNum(n.valor_total !== undefined ? n.valor_total : vBruto);
            const itensNotaJson = JSON.stringify(Array.isArray(n.itens) ? n.itens : []);
            const safeNotaObraId = (n.obra_id && (n.obra_id === 'escritorio' || n.obra_id === 'geral' || validObrasSet.has(n.obra_id))) ? n.obra_id : null;

            await sql`
              INSERT INTO notas_fiscais (
                id, tenant_id, numero_nf, serie, chave_acesso, chave_nfe, emitente, cnpj_emitente, destinatario,
                data_emissao, data_vencimento, data_pagamento, valor_bruto, impostos, valor_liquido, valor_total,
                tipo, categoria, status, lancamento_id, observacoes, obra_id, itens
              )
              VALUES (
                ${n.id}, ${tenantId}, ${n.numero_nf || ''}, ${n.serie || ''}, ${n.chave_nfe || n.chave_acesso || null}, ${n.chave_nfe || n.chave_acesso || ''},
                ${n.emitente || ''}, ${n.cnpj_emitente || ''}, ${n.destinatario || ''},
                ${cleanDate(n.data_emissao)}, ${cleanDate(n.data_vencimento)}, ${cleanDate(n.data_pagamento)},
                ${vBruto}, ${vImp}, ${vLiq}, ${vTot},
                ${n.tipo || 'entrada'}, ${n.categoria || 'material'}, ${n.status || 'paga'},
                ${n.lancamento_id || null}, ${n.observacoes || ''}, ${safeNotaObraId},
                ${itensNotaJson}::jsonb
              )
              ON CONFLICT (id) DO UPDATE SET
                numero_nf = EXCLUDED.numero_nf,
                serie = EXCLUDED.serie,
                chave_acesso = EXCLUDED.chave_acesso,
                chave_nfe = EXCLUDED.chave_nfe,
                emitente = EXCLUDED.emitente,
                cnpj_emitente = EXCLUDED.cnpj_emitente,
                destinatario = EXCLUDED.destinatario,
                data_emissao = EXCLUDED.data_emissao,
                data_vencimento = EXCLUDED.data_vencimento,
                data_pagamento = EXCLUDED.data_pagamento,
                valor_bruto = EXCLUDED.valor_bruto,
                impostos = EXCLUDED.impostos,
                valor_liquido = EXCLUDED.valor_liquido,
                valor_total = EXCLUDED.valor_total,
                tipo = EXCLUDED.tipo,
                categoria = EXCLUDED.categoria,
                status = EXCLUDED.status,
                lancamento_id = EXCLUDED.lancamento_id,
                observacoes = EXCLUDED.observacoes,
                obra_id = EXCLUDED.obra_id,
                itens = EXCLUDED.itens
              WHERE notas_fiscais.tenant_id = ${tenantId};
            `;
            totalCount++;
          }
        }

        // Contas Bancárias
        if (Array.isArray(payload.contas)) {
          for (const c of payload.contas) {
            if (!c.id) continue;
            await sql`
              INSERT INTO contas_bancarias (id, tenant_id, banco_codigo, banco_nome, agencia, numero, tipo, titular, apelido, obra_id, obs)
              VALUES (
                ${c.id}, ${tenantId}, ${c.banco_codigo || ''}, ${c.banco_nome || ''}, ${c.agencia || ''},
                ${c.numero || ''}, ${c.tipo || 'corrente'}, ${c.titular || ''},
                ${c.apelido || ''}, ${c.obra_id || null}, ${c.obs || ''}
              )
              ON CONFLICT (id) DO UPDATE SET
                banco_codigo = EXCLUDED.banco_codigo,
                banco_nome = EXCLUDED.banco_nome,
                agencia = EXCLUDED.agencia,
                numero = EXCLUDED.numero,
                tipo = EXCLUDED.tipo,
                titular = EXCLUDED.titular,
                apelido = EXCLUDED.apelido,
                obra_id = EXCLUDED.obra_id,
                obs = EXCLUDED.obs,
                updated_at = NOW()
              WHERE contas_bancarias.tenant_id = ${tenantId};
            `;
            totalCount++;
          }
        }

        // Medições
        if (Array.isArray(payload.medicoes)) {
          for (const m of payload.medicoes) {
            if (!m.id) continue;
            const safeMedObraId = await validateObraTenant(sql, m.obra_id, tenantId);
            const numMed = parseInt(m.numero || m.numero_medicao) || 1;
            const dataMed = cleanDate(m.data || m.data_medicao) || todayBoaVista();
            const valMed = cleanNum(m.valor_medido || m.valor_solicitado);
            const rawItens = m.itens || (typeof m.itens_json === 'string' ? safeJsonParse(m.itens_json, []) : m.itens_json) || [];
            const itensJson = JSON.stringify(Array.isArray(rawItens) ? rawItens : []);
            const payloadJson = JSON.stringify(m);

            await sql`
              INSERT INTO medicoes (
                id, tenant_id, obra_id, numero, data, valor_medido, status, observacoes, itens_json,
                percentual_fisico, percentual_financeiro, valor_solicitado, valor_aprovado, valor_liberado,
                data_previsao, data_submissao, data_aprovacao, data_liberacao, engenheiro_responsavel,
                etapa_descricao, documentos_ok, lancamento_id, retencao_tecnica, descontos, payload
              )
              VALUES (
                ${m.id}, ${tenantId}, ${safeMedObraId}, ${numMed}, ${dataMed}, ${valMed}, ${m.status || 'pendente'},
                ${m.observacoes || ''}, ${itensJson}::jsonb, ${cleanNum(m.percentual_fisico)}, ${cleanNum(m.percentual_financeiro)},
                ${cleanNum(m.valor_solicitado || valMed)}, ${m.valor_aprovado !== null && m.valor_aprovado !== undefined ? cleanNum(m.valor_aprovado) : null},
                ${m.valor_liberado !== null && m.valor_liberado !== undefined ? cleanNum(m.valor_liberado) : null},
                ${cleanDate(m.data_previsao)}, ${cleanDate(m.data_submissao)}, ${cleanDate(m.data_aprovacao)}, ${cleanDate(m.data_liberacao)},
                ${m.engenheiro_responsavel || ''}, ${m.etapa_descricao || ''}, ${Boolean(m.documentos_ok)}, ${m.lancamento_id || null},
                ${cleanNum(m.retencao_tecnica)}, ${cleanNum(m.descontos)}, ${payloadJson}::jsonb
              )
              ON CONFLICT (id) DO UPDATE SET
                obra_id = EXCLUDED.obra_id,
                numero = EXCLUDED.numero,
                data = EXCLUDED.data,
                valor_medido = EXCLUDED.valor_medido,
                status = EXCLUDED.status,
                observacoes = EXCLUDED.observacoes,
                itens_json = EXCLUDED.itens_json,
                percentual_fisico = EXCLUDED.percentual_fisico,
                percentual_financeiro = EXCLUDED.percentual_financeiro,
                valor_solicitado = EXCLUDED.valor_solicitado,
                valor_aprovado = EXCLUDED.valor_aprovado,
                valor_liberado = EXCLUDED.valor_liberado,
                data_previsao = EXCLUDED.data_previsao,
                data_submissao = EXCLUDED.data_submissao,
                data_aprovacao = EXCLUDED.data_aprovacao,
                data_liberacao = EXCLUDED.data_liberacao,
                engenheiro_responsavel = EXCLUDED.engenheiro_responsavel,
                etapa_descricao = EXCLUDED.etapa_descricao,
                documentos_ok = EXCLUDED.documentos_ok,
                lancamento_id = EXCLUDED.lancamento_id,
                retencao_tecnica = EXCLUDED.retencao_tecnica,
                descontos = EXCLUDED.descontos,
                payload = EXCLUDED.payload
              WHERE medicoes.tenant_id = ${tenantId};
            `;
            totalCount++;
          }
        }

        // Orçamentos
        if (Array.isArray(payload.orcamentos)) {
          for (const o of payload.orcamentos) {
            if (!o.id) continue;
            const safeOrcObraId = await validateObraTenant(sql, o.obra_id, tenantId);
            const rawItens = o.etapas || o.itens || (typeof o.itens_json === 'string' ? safeJsonParse(o.itens_json, []) : o.itens_json) || [];
            const rawCategorias = Array.isArray(o.categorias) ? o.categorias : (Array.isArray(rawItens?.categorias) ? rawItens.categorias : []);
            const itensList = Array.isArray(rawItens) ? rawItens : (Array.isArray(rawItens?.itens) ? rawItens.itens : []);

            const payloadJson = JSON.stringify({
              itens: itensList,
              categorias: rawCategorias,
              meta: {
                status: o.status || 'ativo',
                descricao: o.descricao || '',
                data_criacao: cleanDate(o.data_criacao) || todayBoaVista()
              }
            });

            const titulo = (o.titulo || o.nome || 'Orçamento').slice(0, 255);
            const valorTotal = cleanNum(o.valor_total || o.valor_total_previsto);
            const status = (o.status || 'ativo').slice(0, 32);
            const descricao = o.descricao || '';
            const dataCriacao = cleanDate(o.data_criacao) || todayBoaVista();

            await sql`
              INSERT INTO orcamentos (id, tenant_id, obra_id, titulo, valor_total, itens_json, status, descricao, data_criacao)
              VALUES (${o.id}, ${tenantId}, ${safeOrcObraId}, ${titulo}, ${valorTotal}, ${payloadJson}::jsonb, ${status}, ${descricao}, ${dataCriacao})
              ON CONFLICT (id) DO UPDATE SET
                obra_id = EXCLUDED.obra_id,
                titulo = EXCLUDED.titulo,
                valor_total = EXCLUDED.valor_total,
                itens_json = EXCLUDED.itens_json,
                status = EXCLUDED.status,
                descricao = EXCLUDED.descricao,
                data_criacao = EXCLUDED.data_criacao
              WHERE orcamentos.tenant_id = ${tenantId};
            `;
            totalCount++;
          }
        }

        // Produtos
        if (Array.isArray(payload.produtos)) {
          for (const p of payload.produtos) {
            if (!p.id || !p.nome) continue;
            await sql`
              INSERT INTO produtos (id, tenant_id, nome, unidade, categoria, codigo, valor_medio, observacoes)
              VALUES (${p.id}, ${tenantId}, ${p.nome}, ${p.unidade || 'un'}, ${p.categoria || 'material'}, ${p.codigo || null}, ${cleanNum(p.valor_medio)}, ${p.observacoes || ''})
              ON CONFLICT (id) DO UPDATE SET
                nome = EXCLUDED.nome,
                unidade = EXCLUDED.unidade,
                categoria = EXCLUDED.categoria,
                codigo = EXCLUDED.codigo,
                valor_medio = EXCLUDED.valor_medio,
                observacoes = EXCLUDED.observacoes,
                updated_at = NOW()
              WHERE produtos.tenant_id = ${tenantId};
            `;
            totalCount++;
          }
        }

        // Documentos
        if (Array.isArray(payload.documentos)) {
          for (const doc of payload.documentos) {
            if (!doc.id) continue;
            await sql`
              INSERT INTO documentos (
                id, tenant_id, tipo, referencia_id, titulo, categoria, nome_arquivo,
                tipo_arquivo, tamanho_bytes, url, base64_data, created_at
              )
              VALUES (
                ${doc.id}, ${tenantId}, ${doc.entidade_tipo || doc.tipo || 'geral'}, ${doc.entidade_id || doc.referencia_id || ''},
                ${doc.titulo || doc.nome_arquivo || 'Documento'}, ${doc.categoria || ''}, ${doc.nome_arquivo || ''},
                ${doc.tipo_mime || doc.tipo_arquivo || 'application/octet-stream'}, ${cleanNum(doc.tamanho || doc.tamanho_bytes)},
                ${doc.url || null}, ${doc.data_base64 || doc.base64_data || null}, ${doc.criado_em || new Date().toISOString()}
              )
              ON CONFLICT (id) DO UPDATE SET
                titulo = EXCLUDED.titulo,
                categoria = EXCLUDED.categoria,
                nome_arquivo = EXCLUDED.nome_arquivo,
                url = COALESCE(EXCLUDED.url, documentos.url),
                base64_data = COALESCE(EXCLUDED.base64_data, documentos.base64_data)
              WHERE documentos.tenant_id = ${tenantId};
            `;
            totalCount++;
          }
        }

        await writeAudit(sql, req, auth, {
          acao: 'sincronizar', entidade: 'dados', entidadeId: null,
          depois: { total: totalCount, colecoes: Object.keys(payload || {}).filter(k => Array.isArray(payload[k]) && payload[k].length > 0) }
        });
        if (failures.length) {
          return res.status(207).json({
            success: false, partial: true, synced: totalCount, failed: failures,
            error: `${failures.length} registro(s) não foram confirmados. A migração permanecerá pendente para nova tentativa.`
          });
        }
        return res.status(200).json({ success: true, synced: totalCount, failed: [], message: 'Dados sincronizados com o Neon PostgreSQL!' });
      }

      // 2. Salvar Registro Individual (Upsert com tenant_id)
      if (action === 'save' && data) {
        if (table === 'lancamentos') {
          const l = data;
          const dataLanc = cleanDate(l.data) || todayBoaVista();
          const dataVenc = cleanDate(l.data_vencimento) || dataLanc;
          const dataPag = cleanDate(l.data_pagamento);
          const safeObraId = await validateObraTenant(sql, l.obra_id, tenantId);
          const safeNotaId = await validateNotaFiscalTenant(sql, l.nota_fiscal_id, tenantId);

          const itensLancJson = JSON.stringify(Array.isArray(l.itens) ? l.itens : []);

          await sql`
            INSERT INTO lancamentos (
              id, tenant_id, data, data_vencimento, data_pagamento, descricao, categoria,
              fornecedor_beneficiario, conta_bancaria, tipo, valor, status,
              obra_id, nota_fiscal_id, codigo_barras, chave_nfe, observacoes, conciliado, itens
            )
            VALUES (
              ${l.id}, ${tenantId}, ${dataLanc}, ${dataVenc}, ${dataPag}, ${l.descricao}, ${l.categoria || 'Outros'},
              ${l.fornecedor_beneficiario || ''}, ${l.conta_bancaria || ''}, ${l.tipo || 'despesa'}, ${cleanNum(l.valor)}, ${l.status || 'pendente'},
              ${safeObraId}, ${safeNotaId}, ${l.codigo_barras || null}, ${l.chave_nfe || null}, ${l.observacoes || ''}, ${!!l.conciliado},
              ${itensLancJson}::jsonb
            )
            ON CONFLICT (id) DO UPDATE SET
              data = EXCLUDED.data,
              data_vencimento = EXCLUDED.data_vencimento,
              data_pagamento = EXCLUDED.data_pagamento,
              descricao = EXCLUDED.descricao,
              categoria = EXCLUDED.categoria,
              fornecedor_beneficiario = EXCLUDED.fornecedor_beneficiario,
              conta_bancaria = EXCLUDED.conta_bancaria,
              tipo = EXCLUDED.tipo,
              valor = EXCLUDED.valor,
              status = EXCLUDED.status,
              obra_id = EXCLUDED.obra_id,
              nota_fiscal_id = EXCLUDED.nota_fiscal_id,
              codigo_barras = EXCLUDED.codigo_barras,
              chave_nfe = EXCLUDED.chave_nfe,
              observacoes = EXCLUDED.observacoes,
              conciliado = EXCLUDED.conciliado,
              itens = EXCLUDED.itens
            WHERE lancamentos.tenant_id = ${tenantId};
          `;
          await auditDb(sql, req, auth, 'salvar', 'lancamentos', l);
          return res.status(200).json({ success: true, id: l.id });
        }

        if (table === 'notas' || table === 'notas_fiscais') {
          const n = data;
          const vBruto = cleanNum(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total);
          const vImp = cleanNum(n.impostos);
          const vLiq = cleanNum(n.valor_liquido !== undefined ? n.valor_liquido : (vBruto - vImp));
          const vTot = cleanNum(n.valor_total !== undefined ? n.valor_total : vBruto);
          const safeNotaObraId = await validateObraTenant(sql, n.obra_id, tenantId);

          const itensNotaJson = JSON.stringify(Array.isArray(n.itens) ? n.itens : []);

          await sql`
            INSERT INTO notas_fiscais (
              id, tenant_id, numero_nf, serie, chave_acesso, chave_nfe, emitente, cnpj_emitente, destinatario,
              data_emissao, data_vencimento, data_pagamento, valor_bruto, impostos, valor_liquido, valor_total,
              tipo, categoria, status, lancamento_id, observacoes, obra_id, itens
            )
            VALUES (
              ${n.id}, ${tenantId}, ${n.numero_nf || ''}, ${n.serie || ''}, ${n.chave_nfe || n.chave_acesso || null}, ${n.chave_nfe || n.chave_acesso || ''},
              ${n.emitente || ''}, ${n.cnpj_emitente || ''}, ${n.destinatario || ''},
              ${cleanDate(n.data_emissao)}, ${cleanDate(n.data_vencimento)}, ${cleanDate(n.data_pagamento)},
              ${vBruto}, ${vImp}, ${vLiq}, ${vTot},
              ${n.tipo || 'entrada'}, ${n.categoria || 'material'}, ${n.status || 'paga'},
              ${n.lancamento_id || null}, ${n.observacoes || ''}, ${safeNotaObraId},
              ${itensNotaJson}::jsonb
            )
            ON CONFLICT (id) DO UPDATE SET
              numero_nf = EXCLUDED.numero_nf,
              serie = EXCLUDED.serie,
              chave_acesso = EXCLUDED.chave_acesso,
              chave_nfe = EXCLUDED.chave_nfe,
              emitente = EXCLUDED.emitente,
              cnpj_emitente = EXCLUDED.cnpj_emitente,
              destinatario = EXCLUDED.destinatario,
              data_emissao = EXCLUDED.data_emissao,
              data_vencimento = EXCLUDED.data_vencimento,
              data_pagamento = EXCLUDED.data_pagamento,
              valor_bruto = EXCLUDED.valor_bruto,
              impostos = EXCLUDED.impostos,
              valor_liquido = EXCLUDED.valor_liquido,
              valor_total = EXCLUDED.valor_total,
              tipo = EXCLUDED.tipo,
              categoria = EXCLUDED.categoria,
              status = EXCLUDED.status,
              lancamento_id = EXCLUDED.lancamento_id,
              observacoes = EXCLUDED.observacoes,
              obra_id = EXCLUDED.obra_id,
              itens = EXCLUDED.itens
            WHERE notas_fiscais.tenant_id = ${tenantId};
          `;
          await auditDb(sql, req, auth, 'salvar', 'notas_fiscais', n);
          return res.status(200).json({ success: true, id: n.id });
        }

        if (table === 'obras' || table === 'clientes') {
          const o = data;
          if (!auth.isSystem && auth.user?.perfil !== 'superadmin') {
            const planCheck = await enforceObraPlanLimit(sql, tenantId, auth.user?.tenantPlan, o);
            if (!planCheck.allowed) return res.status(planCheck.status).json(planCheck.body);
          }
          const cronogramaJson = o.cronograma_config == null ? null : JSON.stringify(sanitizeCronogramaConfig(o.cronograma_config));
          const bdiJson = o.bdi_config == null ? null : JSON.stringify(sanitizeBdiConfig(o.bdi_config));
          await sql`
            INSERT INTO obras (id, tenant_id, nome, cliente, endereco, orcamento_total, status, data_inicio, data_previsao, cronograma_config, bdi_config)
            VALUES (
              ${o.id}, ${tenantId}, ${o.nome}, ${o.cliente || ''}, ${o.endereco || ''},
              ${cleanNum(o.orcamento_total || o.valor_contrato)}, ${o.status || 'em_andamento'},
              ${cleanDate(o.data_inicio)}, ${cleanDate(o.data_previsao)},
              ${cronogramaJson}::jsonb, ${bdiJson}::jsonb
            )
            ON CONFLICT (tenant_id, id) DO UPDATE SET
              nome = EXCLUDED.nome,
              cliente = EXCLUDED.cliente,
              endereco = EXCLUDED.endereco,
              orcamento_total = EXCLUDED.orcamento_total,
              status = EXCLUDED.status,
              data_inicio = EXCLUDED.data_inicio,
              data_previsao = EXCLUDED.data_previsao,
              cronograma_config = EXCLUDED.cronograma_config,
              bdi_config = EXCLUDED.bdi_config;
          `;
          await auditDb(sql, req, auth, 'salvar', table === 'clientes' ? 'obras' : table, o);
          return res.status(200).json({ success: true, id: o.id });
        }

        if (table === 'fornecedores') {
          const f = data;
          const nomeFinal = (f.nome || f.nome_fantasia || f.razao_social || f.razao || 'Fornecedor').trim();
          const razaoSocialFinal = (f.razao_social || f.nome_fantasia || f.nome || nomeFinal).trim();
          const cnpjCpfFinal = (f.cnpj_cpf || f.cnpj || f.cpf || '').replace(/\D/g, '');

          await sql`
            INSERT INTO fornecedores (
              id, tenant_id, nome, razao_social, cnpj_cpf, telefone, email, categoria,
              chave_pix, banco_info, endereco, municipio, uf, ativo
            )
            VALUES (
              ${f.id}, ${tenantId}, ${nomeFinal}, ${razaoSocialFinal}, ${cnpjCpfFinal},
              ${f.telefone || ''}, ${f.email || ''}, ${f.categoria || 'outros'}, ${f.chave_pix || ''}, ${f.banco_info || ''},
              ${f.endereco || ''}, ${f.municipio || ''}, ${(f.uf || '').toUpperCase().slice(0, 2)}, ${f.ativo !== false}
            )
            ON CONFLICT (id) DO UPDATE SET
              nome = EXCLUDED.nome,
              razao_social = EXCLUDED.razao_social,
              cnpj_cpf = EXCLUDED.cnpj_cpf,
              telefone = EXCLUDED.telefone,
              email = EXCLUDED.email,
              categoria = EXCLUDED.categoria,
              chave_pix = EXCLUDED.chave_pix,
              banco_info = EXCLUDED.banco_info,
              endereco = EXCLUDED.endereco,
              municipio = EXCLUDED.municipio,
              uf = EXCLUDED.uf,
              ativo = EXCLUDED.ativo
            WHERE fornecedores.tenant_id = ${tenantId};
          `;
          await auditDb(sql, req, auth, 'salvar', 'fornecedores', f);
          return res.status(200).json({ success: true, id: f.id });
        }

        if (table === 'documentos') {
          const doc = data;
          await sql`
            INSERT INTO documentos (
              id, tenant_id, tipo, referencia_id, titulo, categoria, nome_arquivo,
              tipo_arquivo, tamanho_bytes, url, base64_data, created_at
            )
            VALUES (
              ${doc.id}, ${tenantId}, ${doc.entidade_tipo || doc.tipo || 'geral'}, ${doc.entidade_id || doc.referencia_id || ''},
              ${doc.titulo || doc.nome_arquivo || 'Documento'}, ${doc.categoria || ''}, ${doc.nome_arquivo || ''},
              ${doc.tipo_mime || doc.tipo_arquivo || 'application/octet-stream'}, ${cleanNum(doc.tamanho || doc.tamanho_bytes)},
              ${doc.url || null}, ${doc.data_base64 || doc.base64_data || null}, ${doc.criado_em || new Date().toISOString()}
            )
            ON CONFLICT (id) DO UPDATE SET
              titulo = EXCLUDED.titulo,
              categoria = EXCLUDED.categoria,
              nome_arquivo = EXCLUDED.nome_arquivo,
              url = COALESCE(EXCLUDED.url, documentos.url),
              base64_data = COALESCE(EXCLUDED.base64_data, documentos.base64_data)
            WHERE documentos.tenant_id = ${tenantId};
          `;
          await auditDb(sql, req, auth, 'salvar', 'documentos', doc);
          return res.status(200).json({ success: true, id: doc.id });
        }

        if (table === 'produtos') {
          const p = data;
          await sql`
            INSERT INTO produtos (id, tenant_id, nome, unidade, categoria, codigo, valor_medio, observacoes)
            VALUES (
              ${p.id}, ${tenantId}, ${p.nome}, ${p.unidade || 'un'}, ${p.categoria || 'material'},
              ${p.codigo || null}, ${cleanNum(p.valor_medio)}, ${p.observacoes || ''}
            )
            ON CONFLICT (id) DO UPDATE SET
              nome = EXCLUDED.nome,
              unidade = EXCLUDED.unidade,
              categoria = EXCLUDED.categoria,
              codigo = EXCLUDED.codigo,
              valor_medio = EXCLUDED.valor_medio,
              observacoes = EXCLUDED.observacoes,
              updated_at = NOW()
            WHERE produtos.tenant_id = ${tenantId};
          `;
          await auditDb(sql, req, auth, 'salvar', 'produtos', p);
          return res.status(200).json({ success: true, id: p.id });
        }

        if (table === 'precompras') {
          const pc = data;
          const safeObraId = await validateObraTenant(sql, pc.obra_id, tenantId);
          const rawJson = JSON.stringify(pc);
          await sql`
            INSERT INTO precompras (tenant_id,id,obra_id,numero_ordem,status,valor_total,data_solicitacao,payload)
            VALUES (${tenantId},${pc.id},${safeObraId},${pc.numero_ordem || null},${pc.status || 'rascunho'},${cleanNum(pc.valor_total)},${cleanDate(pc.data_solicitacao)},${rawJson}::jsonb)
            ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,numero_ordem=EXCLUDED.numero_ordem,status=EXCLUDED.status,valor_total=EXCLUDED.valor_total,data_solicitacao=EXCLUDED.data_solicitacao,payload=EXCLUDED.payload,updated_at=NOW();
          `;
          await auditDb(sql, req, auth, 'salvar', 'precompras', pc);
          return res.status(200).json({ success:true, id:pc.id });
        }

        if (table === 'contratos') {
          const c = data;
          const safeObraId = await validateObraTenant(sql, c.obra_id, tenantId);
          const rawJson = JSON.stringify(c);
          await sql`
            INSERT INTO contratos (tenant_id,id,obra_id,numero,status,payload)
            VALUES (${tenantId},${c.id},${safeObraId},${c.numero || null},${c.status || 'pendente'},${rawJson}::jsonb)
            ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,numero=EXCLUDED.numero,status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=NOW();
          `;
          await auditDb(sql, req, auth, 'salvar', 'contratos', c);
          return res.status(200).json({ success:true, id:c.id });
        }

        if (table === 'recibos') {
          const r = data;
          const safeObraId = await validateObraTenant(sql, r.obra_id, tenantId);
          const rawJson = JSON.stringify(r);
          const recStatus = r.assinatura ? 'assinado' : (r.status || 'pendente');
          await sql`
            INSERT INTO recibos (tenant_id,id,obra_id,numero,tipo,valor,data,status,payload)
            VALUES (${tenantId},${r.id},${safeObraId},${r.numero || null},${r.tipo || null},${cleanNum(r.valor)},${cleanDate(r.data)},${recStatus},${rawJson}::jsonb)
            ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,numero=EXCLUDED.numero,tipo=EXCLUDED.tipo,valor=EXCLUDED.valor,data=EXCLUDED.data,status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=NOW();
          `;
          await auditDb(sql, req, auth, 'salvar', 'recibos', r);
          return res.status(200).json({ success:true, id:r.id });
        }

        if (table === 'orcamentos_sinapi') {
          const o = data || {};
          if (!validCloudId(o.id, 80)) return res.status(400).json({ success:false, error:'ID de orçamento SINAPI inválido.' });
          const safeObraId = await validateObraTenant(sql, o.obra_id, tenantId);
          if (o.obra_id && !safeObraId) return res.status(400).json({ success:false, error:'A obra informada não pertence à empresa autenticada.' });
          const dbObraId = (!safeObraId || safeObraId === 'escritorio' || safeObraId === 'geral') ? null : safeObraId;
          const rawJson = JSON.stringify(o);
          const subtotal = (Array.isArray(o.itens) ? o.itens : []).reduce((sum, item) => sum + cleanNum(item?.total), 0);
          const total = subtotal * (1 + cleanNum(o.bdi) / 100);
          try {
            await sql`
              INSERT INTO orcamentos_sinapi (tenant_id,id,obra_id,nome,status,valor_total,payload)
              VALUES (${tenantId},${o.id},${dbObraId},${o.nome || 'Orçamento SINAPI'},${o.status || 'ativo'},${total},${rawJson}::jsonb)
              ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,nome=EXCLUDED.nome,status=EXCLUDED.status,valor_total=EXCLUDED.valor_total,payload=EXCLUDED.payload,updated_at=NOW();
            `;
          } catch (dbErr) {
            console.error('[API /api/db] Erro ao salvar orcamento_sinapi:', dbErr.message);
            return res.status(400).json({ success:false, error:`Erro ao salvar orçamento SINAPI: ${dbErr.message}` });
          }
          await auditDb(sql, req, auth, 'salvar', 'orcamentos_sinapi', o);
          return res.status(200).json({ success:true, id:o.id });
        }

        if (table === 'doc_fases') {
          const d = data || {};
          const cloudId = String(d.cloud_id || d.id || '').trim();
          if (!validCloudId(cloudId, 180) || !d.obra_id || !d.doc_id) return res.status(400).json({ success:false, error:'Dados da fase documental incompletos.' });
          const safeObraId = await validateObraTenant(sql, d.obra_id, tenantId);
          if (!safeObraId || ['escritorio','geral'].includes(safeObraId)) return res.status(400).json({ success:false, error:'A obra informada não pertence à empresa autenticada.' });
          const rawJson = JSON.stringify({ ...d, id:d.doc_id });
          await sql`
            INSERT INTO obra_doc_fases (tenant_id,id,obra_id,doc_id,fase_key,payload)
            VALUES (${tenantId},${cloudId},${safeObraId},${String(d.doc_id).slice(0,100)},${d.fase_key || null},${rawJson}::jsonb)
            ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,doc_id=EXCLUDED.doc_id,fase_key=EXCLUDED.fase_key,payload=EXCLUDED.payload,updated_at=NOW();
          `;
          await auditDb(sql, req, auth, 'salvar', 'doc_fases', d, cloudId);
          return res.status(200).json({ success:true, id:cloudId });
        }

        if (table === 'preferencias') {
          const prefs = sanitizeTenantPreferences(data?.preferences);
          const prefJson = JSON.stringify(prefs);
          await sql`
            INSERT INTO tenant_preferences (tenant_id,preferences)
            VALUES (${tenantId},${prefJson}::jsonb)
            ON CONFLICT (tenant_id) DO UPDATE SET preferences=tenant_preferences.preferences || EXCLUDED.preferences,updated_at=NOW();
          `;
          await auditDb(sql, req, auth, 'salvar', 'preferencias', { id:tenantId, chaves:Object.keys(prefs).slice(0,20) });
          return res.status(200).json({ success:true });
        }

        if (table === 'ocr_historico') {
          const h = data;
          const dadosJson = JSON.stringify(h.dados || {});
          await sql`
            INSERT INTO ocr_historico (id, tenant_id, data_hora, nome_arquivo, tipo_documento, fornecedor, valor, data_vencimento, confianca, dados)
            VALUES (
              ${h.id}, ${tenantId}, ${h.data_hora || new Date().toISOString()}, ${h.nome_arquivo || ''},
              ${h.tipo_documento || 'outro'}, ${h.fornecedor || 'Não informado'}, ${cleanNum(h.valor)},
              ${h.data_vencimento || null}, ${cleanNum(h.confianca)}, ${dadosJson}
            )
            ON CONFLICT (id) DO UPDATE SET
              data_hora = EXCLUDED.data_hora,
              nome_arquivo = EXCLUDED.nome_arquivo,
              tipo_documento = EXCLUDED.tipo_documento,
              fornecedor = EXCLUDED.fornecedor,
              valor = EXCLUDED.valor,
              data_vencimento = EXCLUDED.data_vencimento,
              confianca = EXCLUDED.confianca,
              dados = EXCLUDED.dados
            WHERE ocr_historico.tenant_id = ${tenantId};
          `;
          await auditDb(sql, req, auth, 'salvar', 'ocr_historico', h);
          return res.status(200).json({ success: true, id: h.id });
        }

        if (table === 'contas' || table === 'contas_bancarias') {
          const c = data;
          await sql`
            INSERT INTO contas_bancarias (id, tenant_id, banco_codigo, banco_nome, agencia, numero, tipo, titular, apelido, obra_id, obs)
            VALUES (
              ${c.id}, ${tenantId}, ${c.banco_codigo || ''}, ${c.banco_nome || ''}, ${c.agencia || ''},
              ${c.numero || ''}, ${c.tipo || 'corrente'}, ${c.titular || ''},
              ${c.apelido || ''}, ${c.obra_id || null}, ${c.obs || ''}
            )
            ON CONFLICT (id) DO UPDATE SET
              banco_codigo = EXCLUDED.banco_codigo,
              banco_nome = EXCLUDED.banco_nome,
              agencia = EXCLUDED.agencia,
              numero = EXCLUDED.numero,
              tipo = EXCLUDED.tipo,
              titular = EXCLUDED.titular,
              apelido = EXCLUDED.apelido,
              obra_id = EXCLUDED.obra_id,
              obs = EXCLUDED.obs,
              updated_at = NOW()
            WHERE contas_bancarias.tenant_id = ${tenantId};
          `;
          await auditDb(sql, req, auth, 'salvar', 'contas_bancarias', c);
          return res.status(200).json({ success: true, id: c.id });
        }

        if (table === 'orcamentos') {
          const o = data;
          const safeObraId = await validateObraTenant(sql, o.obra_id, tenantId);
          const rawItens = o.etapas || o.itens || (typeof o.itens_json === 'string' ? safeJsonParse(o.itens_json, []) : o.itens_json) || [];
          const rawCategorias = Array.isArray(o.categorias) ? o.categorias : (Array.isArray(rawItens?.categorias) ? rawItens.categorias : []);
          const itensList = Array.isArray(rawItens) ? rawItens : (Array.isArray(rawItens?.itens) ? rawItens.itens : []);

          const payloadJson = JSON.stringify({
            itens: itensList,
            categorias: rawCategorias,
            meta: {
              status: o.status || 'ativo',
              descricao: o.descricao || '',
              data_criacao: cleanDate(o.data_criacao) || todayBoaVista()
            }
          });

          const titulo = (o.titulo || o.nome || 'Orçamento').slice(0, 255);
          const valorTotal = cleanNum(o.valor_total || o.valor_total_previsto);
          const status = (o.status || 'ativo').slice(0, 32);
          const descricao = o.descricao || '';
          const dataCriacao = cleanDate(o.data_criacao) || todayBoaVista();

          await sql`
            INSERT INTO orcamentos (id, tenant_id, obra_id, titulo, valor_total, itens_json, status, descricao, data_criacao)
            VALUES (
              ${o.id}, ${tenantId}, ${safeObraId}, ${titulo},
              ${valorTotal}, ${payloadJson}::jsonb, ${status}, ${descricao}, ${dataCriacao}
            )
            ON CONFLICT (id) DO UPDATE SET
              obra_id = EXCLUDED.obra_id,
              titulo = EXCLUDED.titulo,
              valor_total = EXCLUDED.valor_total,
              itens_json = EXCLUDED.itens_json,
              status = EXCLUDED.status,
              descricao = EXCLUDED.descricao,
              data_criacao = EXCLUDED.data_criacao
            WHERE orcamentos.tenant_id = ${tenantId};
          `;
          await auditDb(sql, req, auth, 'salvar', 'orcamentos', o);
          return res.status(200).json({ success: true, id: o.id });
        }

        if (table === 'medicoes') {
          const m = data;
          const safeObraId = await validateObraTenant(sql, m.obra_id, tenantId);
          const numMed = parseInt(m.numero || m.numero_medicao) || 1;
          const dataMed = cleanDate(m.data || m.data_medicao) || todayBoaVista();
          const valMed = cleanNum(m.valor_medido || m.valor_solicitado);
          const rawItens = m.itens || (typeof m.itens_json === 'string' ? safeJsonParse(m.itens_json, []) : m.itens_json) || [];
          const itensJson = JSON.stringify(Array.isArray(rawItens) ? rawItens : []);
          const payloadJson = JSON.stringify(m);

          await sql`
            INSERT INTO medicoes (
              id, tenant_id, obra_id, numero, data, valor_medido, status, observacoes, itens_json,
              percentual_fisico, percentual_financeiro, valor_solicitado, valor_aprovado, valor_liberado,
              data_previsao, data_submissao, data_aprovacao, data_liberacao, engenheiro_responsavel,
              etapa_descricao, documentos_ok, lancamento_id, retencao_tecnica, descontos, payload
            )
            VALUES (
              ${m.id}, ${tenantId}, ${safeObraId}, ${numMed}, ${dataMed}, ${valMed}, ${m.status || 'pendente'},
              ${m.observacoes || ''}, ${itensJson}::jsonb, ${cleanNum(m.percentual_fisico)}, ${cleanNum(m.percentual_financeiro)},
              ${cleanNum(m.valor_solicitado || valMed)}, ${m.valor_aprovado !== null && m.valor_aprovado !== undefined ? cleanNum(m.valor_aprovado) : null},
              ${m.valor_liberado !== null && m.valor_liberado !== undefined ? cleanNum(m.valor_liberado) : null},
              ${cleanDate(m.data_previsao)}, ${cleanDate(m.data_submissao)}, ${cleanDate(m.data_aprovacao)}, ${cleanDate(m.data_liberacao)},
              ${m.engenheiro_responsavel || ''}, ${m.etapa_descricao || ''}, ${Boolean(m.documentos_ok)}, ${m.lancamento_id || null},
              ${cleanNum(m.retencao_tecnica)}, ${cleanNum(m.descontos)}, ${payloadJson}::jsonb
            )
            ON CONFLICT (id) DO UPDATE SET
              obra_id = EXCLUDED.obra_id,
              numero = EXCLUDED.numero,
              data = EXCLUDED.data,
              valor_medido = EXCLUDED.valor_medido,
              status = EXCLUDED.status,
              observacoes = EXCLUDED.observacoes,
              itens_json = EXCLUDED.itens_json,
              percentual_fisico = EXCLUDED.percentual_fisico,
              percentual_financeiro = EXCLUDED.percentual_financeiro,
              valor_solicitado = EXCLUDED.valor_solicitado,
              valor_aprovado = EXCLUDED.valor_aprovado,
              valor_liberado = EXCLUDED.valor_liberado,
              data_previsao = EXCLUDED.data_previsao,
              data_submissao = EXCLUDED.data_submissao,
              data_aprovacao = EXCLUDED.data_aprovacao,
              data_liberacao = EXCLUDED.data_liberacao,
              engenheiro_responsavel = EXCLUDED.engenheiro_responsavel,
              etapa_descricao = EXCLUDED.etapa_descricao,
              documentos_ok = EXCLUDED.documentos_ok,
              lancamento_id = EXCLUDED.lancamento_id,
              retencao_tecnica = EXCLUDED.retencao_tecnica,
              descontos = EXCLUDED.descontos,
              payload = EXCLUDED.payload
            WHERE medicoes.tenant_id = ${tenantId};
          `;
          await auditDb(sql, req, auth, 'salvar', 'medicoes', m);
          return res.status(200).json({ success: true, id: m.id });
        }
      }

      // 3. Excluir Registro Individual (Estritamente com tenant_id)
      if (action === 'delete' && id) {
        if (table === 'lancamentos') {
          await sql`DELETE FROM lancamentos WHERE id = ${id} AND tenant_id = ${tenantId};`;
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:'lancamentos', entidadeId:id, antes:{ id } });
          return res.status(200).json({ success: true, id });
        }
        if (table === 'notas' || table === 'notas_fiscais') {
          await sql`DELETE FROM notas_fiscais WHERE id = ${id} AND tenant_id = ${tenantId};`;
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:'notas_fiscais', entidadeId:id, antes:{ id } });
          return res.status(200).json({ success: true, id });
        }
        if (table === 'obras' || table === 'clientes') {
          await sql`DELETE FROM obras WHERE id = ${id} AND tenant_id = ${tenantId};`;
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:'obras', entidadeId:id, antes:{ id } });
          return res.status(200).json({ success: true, id });
        }
        if (table === 'fornecedores') {
          await sql`DELETE FROM fornecedores WHERE id = ${id} AND tenant_id = ${tenantId};`;
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:'fornecedores', entidadeId:id, antes:{ id } });
          return res.status(200).json({ success: true, id });
        }
        if (table === 'documentos') {
          try {
            const rows = await sql`SELECT url FROM documentos WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1;`;
            if (rows.length && rows[0].url && rows[0].url.includes('blob.vercel-storage.com')) {
              import('@vercel/blob').then(({ del }) => del(rows[0].url)).catch(() => {});
            }
          } catch (e) {}
          await sql`DELETE FROM documentos WHERE id = ${id} AND tenant_id = ${tenantId};`;
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:'documentos', entidadeId:id, antes:{ id } });
          return res.status(200).json({ success: true, id });
        }
        if (table === 'produtos') {
          await sql`DELETE FROM produtos WHERE id = ${id} AND tenant_id = ${tenantId};`;
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:'produtos', entidadeId:id, antes:{ id } });
          return res.status(200).json({ success: true, id });
        }
        if (table === 'precompras' || table === 'contratos' || table === 'recibos') {
          const tableName = table;
          if (tableName === 'precompras') await sql`DELETE FROM precompras WHERE tenant_id=${tenantId} AND id=${id};`;
          if (tableName === 'contratos') await sql`DELETE FROM contratos WHERE tenant_id=${tenantId} AND id=${id};`;
          if (tableName === 'recibos') await sql`DELETE FROM recibos WHERE tenant_id=${tenantId} AND id=${id};`;
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:tableName, entidadeId:id, antes:{ id } });
          return res.status(200).json({ success:true, id });
        }
        if (table === 'orcamentos_sinapi') {
          await sql`DELETE FROM orcamentos_sinapi WHERE tenant_id=${tenantId} AND id=${id};`;
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:'orcamentos_sinapi', entidadeId:id, antes:{ id } });
          return res.status(200).json({ success:true, id });
        }
        if (table === 'doc_fases') {
          await sql`DELETE FROM obra_doc_fases WHERE tenant_id=${tenantId} AND id=${id};`;
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:'doc_fases', entidadeId:id, antes:{ id } });
          return res.status(200).json({ success:true, id });
        }
        if (table === 'ocr_historico') {
          if (id === 'all') {
            await sql`DELETE FROM ocr_historico WHERE tenant_id = ${tenantId};`;
          } else {
            await sql`DELETE FROM ocr_historico WHERE id = ${id} AND tenant_id = ${tenantId};`;
          }
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:'ocr_historico', entidadeId:id, antes:{ id } });
          return res.status(200).json({ success: true, id });
        }
        if (table === 'contas' || table === 'contas_bancarias') {
          await sql`DELETE FROM contas_bancarias WHERE id = ${id} AND tenant_id = ${tenantId};`;
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:'contas_bancarias', entidadeId:id, antes:{ id } });
          return res.status(200).json({ success: true, id });
        }
        if (table === 'orcamentos') {
          await sql`DELETE FROM orcamentos WHERE id = ${id} AND tenant_id = ${tenantId};`;
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:'orcamentos', entidadeId:id, antes:{ id } });
          return res.status(200).json({ success: true, id });
        }
        if (table === 'medicoes') {
          await sql`DELETE FROM medicoes WHERE id = ${id} AND tenant_id = ${tenantId};`;
          await writeAudit(sql, req, auth, { acao:'excluir', entidade:'medicoes', entidadeId:id, antes:{ id } });
          return res.status(200).json({ success: true, id });
        }
      }

      return res.status(400).json({
        success: false,
        error: `Ação '${action}' ou tabela '${table}' não reconhecida ou não suportada.`,
        code: 'UNKNOWN_OPERATION'
      });
    }

    return res.status(405).json({ error: 'Método não suportado' });
  } catch (err) {
    console.error('Erro na API Neon DB:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
