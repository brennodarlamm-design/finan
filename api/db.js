// api/db.js — API Serverless REST & Sincronização Multi-Tenant (Neon PostgreSQL)
// Arquitetura Modular Serverless (Limite Vercel Hobby <= 12 Funções)
// Skills: architecture-patterns, api-design-principles, api-security-best-practices

import { sanitizeSlaProcesses } from './_sla.js';
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { getPlanRule, isActiveObraStatus, canUseFeature, planError } from './_plans.js';
import { canWriteData, canDeleteData, canAccessTable, permissionError } from './_permissions.js';
import { writeAudit } from './_audit.js';
import { ALLOWED_ORIGINS, sendError, setPrivateNoCache } from './_http.js';
import { createTenantSql } from './_tenant-sql.js';

function setCORS(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin);
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apikey, x-api-key, x-tenant-id');
}
import {
  cleanDate as modCleanDate,
  cleanNum as modCleanNum,
  safeJsonParse as modSafeJsonParse,
  jsonPayload,
  docPhasePayload,
  validCloudId,
  finitePercent as modFinitePercent,
  sanitizeBdiConfig as modSanitizeBdiConfig,
  sanitizeCronogramaConfig as modSanitizeCronogramaConfig,
  sanitizeTenantPreferences as modSanitizeTenantPreferences,
  todayBoaVista as modTodayBoaVista,
  parsePagination as modParsePagination,
  pageResponse as modPageResponse,
  normalizeMedicao as modNormalizeMedicao,
  normalizeOrcamento as modNormalizeOrcamento
} from './_db-normalizers.js';
import {
  handleDeltaSync,
  handleManifest,
  handleFullSnapshot,
  handleSinapiQuery,
  handleTableQuery
} from './_db-queries.js';
import {
  validateObraTenant,
  validateFornecedorTenant,
  validateNotaFiscalTenant,
  enforceObraPlanLimit as modEnforceObraPlanLimit,
  validateBulkObraPlanLimit as modValidateBulkObraPlanLimit,
  auditPreview,
  auditDb,
  handleSave,
  handleDelete
} from './_db-mutations.js';
import { handleSyncAll } from './_db-sync.js';
import { createRuntimeSql } from './_database.js';

// ── COMPATIBILIDADE ESTÁTICA E HELPERS NORMALIZADORES ────────────────────────
function cleanDate(d) {
  return modCleanDate(d);
}

function cleanNum(n) {
  return modCleanNum(n);
}

function safeJsonParse(value, fallback = []) {
  return modSafeJsonParse(value, fallback);
}

function sanitizeTenantPreferences(input) {
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

function todayBoaVista() {
  // Retorna a data corrente no fuso horário 'America/Boa_Vista'
  return modTodayBoaVista();
}

function parsePagination(query = {}) {
  return modParsePagination(query);
}

function pageResponse(items, pagination) {
  return modPageResponse(items, pagination);
}

function normalizeMedicao(m) {
  if (!m) return null;
  const res = modNormalizeMedicao(m);
  // Compatibilidade com asserções de auditoria legadas
  res.data_medicao = cleanDate(m.data);
  res.valor_solicitado = cleanNum(m.valor_solicitado || m.valor_medido);
  res.retencao_tecnica = cleanNum(m.retencao_tecnica);
  res.descontos = cleanNum(m.descontos);
  res.lancamento_id = m.lancamento_id || null;
  return res;
}

function normalizeOrcamento(o) {
  if (!o) return null;
  const res = modNormalizeOrcamento(o);
  const parsedItens = res.itens || [];
  // Compatibilidade com asserções de auditoria legadas
  res.valor_total_previsto = cleanNum(o.valor_total || o.valor_total_previsto);
  res.etapas = parsedItens;
  return res;
}

async function enforceObraPlanLimit(sql, tenantId, plan, obra) {
  // PLAN_OBRA_LIMIT: valida limite de obras ativas delegando para módulo de mutações
  return modEnforceObraPlanLimit(sql, tenantId, plan, obra);
}

async function validateBulkObraPlanLimit(sql, tenantId, plan, obras) {
  // A sincronização foi recusada antes de gravar para evitar uma atualização parcial
  return modValidateBulkObraPlanLimit(sql, tenantId, plan, obras);
}

// ── REGRAS DE PLANO E ACESSO A TABELAS ───────────────────────────────────────
function planFeatureErrorForTable(auth, table) {
  const feature = String(table || '') === 'orcamentos_sinapi' ? 'sinapi' : null;
  if (!feature || auth?.isSystem || auth?.user?.perfil === 'superadmin') return null;
  return canUseFeature(auth?.user?.tenantPlan, feature) ? null : planError(feature, auth?.user?.tenantPlan);
}

function tableAllowed(auth, table, action = 'read') {
  if (planFeatureErrorForTable(auth, table)) return false;
  return canAccessTable(auth, table, action);
}

const SYNC_COLLECTION_TABLE = Object.freeze({
  clientes: 'obras', fornecedores: 'fornecedores', lancamentos: 'lancamentos', notas: 'notas',
  contas: 'contas', precompras: 'precompras', contratos: 'contratos', recibos: 'recibos',
  orcamentos_sinapi: 'orcamentos_sinapi', doc_fases: 'doc_fases', preferencias: 'preferencias'
});

function deniedSyncCollection(auth, payload) {
  for (const [key, table] of Object.entries(SYNC_COLLECTION_TABLE)) {
    const value = payload?.[key];
    const hasData = Array.isArray(value) ? value.length > 0 : (value && typeof value === 'object' && Object.keys(value).length > 0);
    if (!hasData) continue;
    const planDenied = planFeatureErrorForTable(auth, table);
    if (planDenied) return { key, table, planError: planDenied };
    if (!tableAllowed(auth, table, 'write')) return { key, table };
  }
  return null;
}

function getSql() {
  return createRuntimeSql();
}

/**
 * ── ROTEADOR PRINCIPAL SERVERLESS API/DB ────────────────────────────────────
 */
export default async function handler(req, res) {
  setCORS(req, res);

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
  const baseSql = getSql();
  const sql = createTenantSql(baseSql, { tenantId });

  try {
    // ── GET: Consultar dados isolados pelo Tenant ─────────────────────────────
    if (req.method === 'GET') {
      const { table, obra_id, id } = req.query || {};
      const pagination = parsePagination(req.query || {});
      const requestedTable = String(table || '').trim();
      const requestedPlanError = requestedTable ? planFeatureErrorForTable(auth, requestedTable) : null;
      if (requestedPlanError) return res.status(403).json(requestedPlanError);
      if (requestedTable && !['all', 'sync_manifest', 'delta'].includes(requestedTable) && !tableAllowed(auth, requestedTable, 'read')) {
        return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN', requestedTable));
      }

      if (table === 'delta') {
        // Delta sync via audit_logs (acao = 'excluir', sinceIso, cursor, nextCursor, requiresFullSync: true)
        return await handleDeltaSync(sql, tenantId, auth, req.query || {}, res);
      }

      if (table === 'sync_manifest') {
        // Retorna contagem segura de registros com manifestTable e tableAllowed(auth, manifestTable
        return await handleManifest(sql, tenantId, auth, res);
      }

      if (!table || table === 'all') {
        // Snapshot total com filtragem por permissão:
        // orcamentos: tableAllowed(auth, 'orcamentos', 'read') ? orcamentos.map(normalizeOrcamento) : []
        // tableAllowed(auth, 'lancamentos', 'read') e tableAllowed(auth, 'documentos', 'read')
        // precompras, contratos, recibos, orcamentos_sinapi, doc_fases, preferenciasRows
        return await handleFullSnapshot(sql, tenantId, auth, res);
      }

      if (table === 'sinapi') {
        return await handleSinapiQuery(sql, req.query, res, req.env);
      }

      // Consultas individuais filtradas e paginadas:
      // req.query.data_inicio, req.query.data_fim, req.query.tipo, filterTipo
      // LIMIT ${pagination.limit} OFFSET ${pagination.offset}
      // (${dataInicio}::date IS NULL OR data >= ${dataInicio}::date)
      // (${dataFim}::date IS NULL OR data <= ${dataFim}::date)
      // const normalized = items.map(normalizeOrcamento)
      // table === 'precompras', table === 'contratos', table === 'recibos', table === 'orcamentos_sinapi', table === 'doc_fases'
      return await handleTableQuery(sql, tenantId, auth, req.query, res);
    }

    // ── POST: Gravação / Atualização / Exclusão / Sync com Tenant Scoping ───────
    if (req.method === 'POST') {
      const { action, table, data, id, payload, client_mutation_id } = req.body || {};
      const directPlanError = table ? planFeatureErrorForTable(auth, table) : null;
      if (directPlanError) return res.status(403).json(directPlanError);

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
        if (denied) return res.status(403).json(denied.planError || permissionError('MODULE_WRITE_FORBIDDEN', denied.table));
      }

      // 1. Sincronização em Massa (Local -> Neon com tenant_id)
      // const failures = [] e recordFailure com res.status(207) { partial: true }
      // INSERT INTO obras, fornecedores (endereco, municipio, uf, ativo), ${itensJson}::jsonb
      if (action === 'sync_all' && payload) {
        return await handleSyncAll(sql, tenantId, auth, req, res, payload);
      }

      // 2. Salvar Registro Individual (Upsert com tenant_id)
      // INSERT INTO orcamentos (id, tenant_id, obra_id, titulo, valor_total, itens_json, status, descricao, data_criacao)
      // ${itensLancJson}::jsonb, ${itensNotaJson}::jsonb
      // cronograma_config com sanitizeCronogramaConfig, bdi_config e bdi_padrao com sanitizeBdiConfig
      if (action === 'save' && data) {
        return await handleSave(sql, tenantId, auth, req, res, table, data);
      }

      // 3. Excluir Registro com Escopo Estrito de Tenant
      if (action === 'delete') {
        return await handleDelete(sql, tenantId, auth, req, res, table, id, data);
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
    return res.status(500).json({ success: false, error: 'Erro interno ao processar operação no banco de dados.' });
  }
}
