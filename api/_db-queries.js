// api/_db-queries.js — Motor Modular de Consultas, Filtros, Snapshot e Delta Sync
// Skill: neon-postgres-egress-optimizer & api-design-principles

import {
  cleanDate, cleanNum, safeJsonParse, jsonPayload, docPhasePayload,
  normalizeMedicao, normalizeOrcamento, todayBoaVista, parsePagination, pageResponse
} from './_db-normalizers.js';
import { setEdgeCacheHeaders, setPrivateNoCache } from './_http.js';
import { canAccessTable } from './_permissions.js';
import { canUseFeature, planError } from './_plans.js';

function planFeatureErrorForTable(auth, table) {
  const feature = String(table || '') === 'orcamentos_sinapi' ? 'sinapi' : null;
  if (!feature || auth?.isSystem || auth?.user?.perfil === 'superadmin') return null;
  return canUseFeature(auth?.user?.tenantPlan, feature) ? null : planError(feature, auth?.user?.tenantPlan);
}

function tableAllowed(auth, table, action = 'read') {
  if (planFeatureErrorForTable(auth, table)) return false;
  return canAccessTable(auth, table, action);
}

/**
 * ── 1. DELTA SYNC INCREMENTAL BASEADO EM CURSOR TEMPORAL ────────────────────
 */
export async function handleDeltaSync(sql, tenantId, auth, query, res) {
  setPrivateNoCache(res);
  const queryObj = (query && typeof query === 'object' && query.query) ? query.query : (query || {});
  const rawCursor = queryObj.cursor || queryObj.since || null;
  const nextCursor = new Date().toISOString();

  let sinceDate = null;
  let isValidSince = false;

  if (rawCursor) {
    const parsed = new Date(rawCursor);
    if (!isNaN(parsed.getTime())) {
      const diffDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 30 && diffDays >= 0) {
        sinceDate = parsed;
        isValidSince = true;
      }
    }
  }

  if (!isValidSince) {
    return res.status(200).json({
      success: true,
      requiresFullSync: true,
      cursor: nextCursor,
      delta: { mutated: {}, deleted: {} }
    });
  }

  const sinceIso = sinceDate.toISOString();

  const deletedRows = await sql`
    SELECT DISTINCT entidade, entidade_id
    FROM audit_logs
    WHERE tenant_id = ${tenantId}
      AND acao = 'excluir'
      AND created_at >= ${sinceIso};
  `;
  const deleted = {};
  for (const row of deletedRows) {
    let ent = row.entidade;
    if (ent === 'notas_fiscais') ent = 'notas';
    if (ent === 'obras') ent = 'clientes';
    if (ent === 'contas_bancarias') ent = 'contas';
    if (!deleted[ent]) deleted[ent] = [];
    if (row.entidade_id) deleted[ent].push(row.entidade_id);
  }

  const [
    precompras, contratos, recibos, orcamentosSinapi, docFases, prefs,
    obrasMutated, fornecedoresMutated, lancamentosMutated, notasMutated, orcamentosMutated, medicoesMutated, docsMutated, produtosMutated, contasMutated
  ] = await Promise.all([
    tableAllowed(auth, 'precompras', 'read')
      ? sql`SELECT * FROM precompras WHERE tenant_id = ${tenantId} AND (updated_at >= ${sinceIso} OR created_at >= ${sinceIso}) ORDER BY updated_at ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'contratos', 'read')
      ? sql`SELECT * FROM contratos WHERE tenant_id = ${tenantId} AND (updated_at >= ${sinceIso} OR created_at >= ${sinceIso}) ORDER BY updated_at ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'recibos', 'read')
      ? sql`SELECT * FROM recibos WHERE tenant_id = ${tenantId} AND (updated_at >= ${sinceIso} OR created_at >= ${sinceIso}) ORDER BY updated_at ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'orcamentos_sinapi', 'read')
      ? sql`SELECT * FROM orcamentos_sinapi WHERE tenant_id = ${tenantId} AND (updated_at >= ${sinceIso} OR created_at >= ${sinceIso}) ORDER BY updated_at ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'doc_fases', 'read')
      ? sql`SELECT * FROM obra_doc_fases WHERE tenant_id = ${tenantId} AND (updated_at >= ${sinceIso} OR created_at >= ${sinceIso}) ORDER BY updated_at ASC;`
      : Promise.resolve([]),
    sql`SELECT preferences, updated_at FROM tenant_preferences WHERE tenant_id = ${tenantId} AND updated_at >= ${sinceIso} LIMIT 1;`,

    tableAllowed(auth, 'obras', 'read')
      ? sql`SELECT * FROM obras WHERE tenant_id = ${tenantId} AND id NOT IN ('escritorio', 'geral') AND id IN (SELECT entidade_id FROM audit_logs WHERE tenant_id = ${tenantId} AND entidade = 'obras' AND created_at >= ${sinceIso});`
      : Promise.resolve([]),
    tableAllowed(auth, 'fornecedores', 'read')
      ? sql`SELECT * FROM fornecedores WHERE tenant_id = ${tenantId} AND id IN (SELECT entidade_id FROM audit_logs WHERE tenant_id = ${tenantId} AND entidade = 'fornecedores' AND created_at >= ${sinceIso});`
      : Promise.resolve([]),
    tableAllowed(auth, 'lancamentos', 'read')
      ? sql`SELECT *, xmin::text AS sync_version FROM lancamentos WHERE tenant_id = ${tenantId} AND (created_at >= ${sinceIso} OR id IN (SELECT entidade_id FROM audit_logs WHERE tenant_id = ${tenantId} AND entidade = 'lancamentos' AND created_at >= ${sinceIso})) ORDER BY data DESC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'notas', 'read')
      ? sql`SELECT * FROM notas_fiscais WHERE tenant_id = ${tenantId} AND (created_at >= ${sinceIso} OR id IN (SELECT entidade_id FROM audit_logs WHERE tenant_id = ${tenantId} AND entidade IN ('notas','notas_fiscais') AND created_at >= ${sinceIso})) ORDER BY data_emissao DESC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'orcamentos', 'read')
      ? sql`SELECT * FROM orcamentos WHERE tenant_id = ${tenantId} AND (created_at >= ${sinceIso} OR id IN (SELECT entidade_id FROM audit_logs WHERE tenant_id = ${tenantId} AND entidade = 'orcamentos' AND created_at >= ${sinceIso})) ORDER BY created_at DESC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'medicoes', 'read')
      ? sql`SELECT * FROM medicoes WHERE tenant_id = ${tenantId} AND (created_at >= ${sinceIso} OR id IN (SELECT entidade_id FROM audit_logs WHERE tenant_id = ${tenantId} AND entidade = 'medicoes' AND created_at >= ${sinceIso})) ORDER BY data DESC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'documentos', 'read')
      ? sql`SELECT id, tipo, referencia_id, titulo, categoria, nome_arquivo, tipo_arquivo, tamanho_bytes, url, created_at FROM documentos WHERE tenant_id = ${tenantId} AND (created_at >= ${sinceIso} OR id IN (SELECT entidade_id FROM audit_logs WHERE tenant_id = ${tenantId} AND entidade = 'documentos' AND created_at >= ${sinceIso})) ORDER BY created_at DESC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'produtos', 'read')
      ? sql`SELECT * FROM produtos WHERE tenant_id = ${tenantId} AND id IN (SELECT entidade_id FROM audit_logs WHERE tenant_id = ${tenantId} AND entidade = 'produtos' AND created_at >= ${sinceIso}) ORDER BY nome ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'contas', 'read')
      ? sql`SELECT * FROM contas_bancarias WHERE tenant_id = ${tenantId} AND (created_at >= ${sinceIso} OR updated_at >= ${sinceIso} OR id IN (SELECT entidade_id FROM audit_logs WHERE tenant_id = ${tenantId} AND entidade IN ('contas','contas_bancarias') AND created_at >= ${sinceIso})) ORDER BY created_at ASC;`
      : Promise.resolve([])
  ]);

  const mutated = {
    clientes: obrasMutated.map(o => ({ ...o, data_inicio: cleanDate(o.data_inicio), data_previsao: cleanDate(o.data_previsao) })),
    fornecedores: fornecedoresMutated.map(f => ({ ...f, cnpj: f.cnpj_cpf || f.cnpj || '', razao_social: f.razao_social || f.nome, nome_fantasia: f.nome, endereco: f.endereco || '', municipio: f.municipio || '', uf: f.uf || '', ativo: f.ativo !== false })),
    lancamentos: lancamentosMutated.map(l => ({ ...l, data: cleanDate(l.data) || todayBoaVista(), data_vencimento: cleanDate(l.data_vencimento) || cleanDate(l.data), data_pagamento: cleanDate(l.data_pagamento), valor: cleanNum(l.valor), itens: Array.isArray(l.itens) ? l.itens : safeJsonParse(l.itens, []) })),
    notas: notasMutated.map(n => ({ ...n, data_emissao: cleanDate(n.data_emissao), data_vencimento: cleanDate(n.data_vencimento), data_pagamento: cleanDate(n.data_pagamento), valor_bruto: cleanNum(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total), impostos: cleanNum(n.impostos), valor_liquido: cleanNum(n.valor_liquido !== undefined ? n.valor_liquido : (n.valor_bruto || n.valor_total)), valor_total: cleanNum(n.valor_total !== undefined ? n.valor_total : n.valor_bruto), categoria: n.categoria || 'material', tipo: n.tipo || 'entrada', chave_nfe: n.chave_nfe || n.chave_acesso || '', itens: Array.isArray(n.itens) ? n.itens : safeJsonParse(n.itens, []) })),
    produtos: produtosMutated.map(p => ({ ...p, valor_medio: cleanNum(p.valor_medio) })),
    orcamentos: orcamentosMutated.map(normalizeOrcamento),
    medicoes: medicoesMutated.map(normalizeMedicao),
    documentos: docsMutated,
    contas: contasMutated,
    precompras: precompras.map(jsonPayload),
    contratos: contratos.map(jsonPayload),
    recibos: recibos.map(jsonPayload),
    orcamentos_sinapi: orcamentosSinapi.map(jsonPayload),
    doc_fases: docFases.map(docPhasePayload),
    preferencias: prefs[0]?.preferences || null
  };

  return res.status(200).json({
    success: true,
    requiresFullSync: false,
    cursor: nextCursor,
    delta: { mutated, deleted }
  });
}

/**
 * ── 2. MANIFESTO DE CONTAGENS RÁPIDAS ────────────────────────────────────────
 */
export async function handleManifest(sql, tenantId, auth, res) {
  setPrivateNoCache(res);
  const tables = ['obras', 'fornecedores', 'lancamentos', 'notas', 'produtos', 'orcamentos', 'medicoes', 'documentos', 'contas', 'precompras', 'contratos', 'recibos', 'orcamentos_sinapi', 'doc_fases'];
  const counts = {};

  const manifestQueries = {
    obras: tableAllowed(auth, 'obras', 'read') ? sql`SELECT COUNT(*)::int as c FROM obras WHERE tenant_id = ${tenantId} AND id NOT IN ('escritorio', 'geral');` : Promise.resolve([{ c: 0 }]),
    fornecedores: tableAllowed(auth, 'fornecedores', 'read') ? sql`SELECT COUNT(*)::int as c FROM fornecedores WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }]),
    lancamentos: tableAllowed(auth, 'lancamentos', 'read') ? sql`SELECT COUNT(*)::int as c FROM lancamentos WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }]),
    notas: tableAllowed(auth, 'notas', 'read') ? sql`SELECT COUNT(*)::int as c FROM notas_fiscais WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }]),
    produtos: tableAllowed(auth, 'produtos', 'read') ? sql`SELECT COUNT(*)::int as c FROM produtos WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }]),
    orcamentos: tableAllowed(auth, 'orcamentos', 'read') ? sql`SELECT COUNT(*)::int as c FROM orcamentos WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }]),
    medicoes: tableAllowed(auth, 'medicoes', 'read') ? sql`SELECT COUNT(*)::int as c FROM medicoes WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }]),
    documentos: tableAllowed(auth, 'documentos', 'read') ? sql`SELECT COUNT(*)::int as c FROM documentos WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }]),
    contas: tableAllowed(auth, 'contas', 'read') ? sql`SELECT COUNT(*)::int as c FROM contas_bancarias WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }]),
    precompras: tableAllowed(auth, 'precompras', 'read') ? sql`SELECT COUNT(*)::int as c FROM precompras WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }]),
    contratos: tableAllowed(auth, 'contratos', 'read') ? sql`SELECT COUNT(*)::int as c FROM contratos WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }]),
    recibos: tableAllowed(auth, 'recibos', 'read') ? sql`SELECT COUNT(*)::int as c FROM recibos WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }]),
    orcamentos_sinapi: tableAllowed(auth, 'orcamentos_sinapi', 'read') ? sql`SELECT COUNT(*)::int as c FROM orcamentos_sinapi WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }]),
    doc_fases: tableAllowed(auth, 'doc_fases', 'read') ? sql`SELECT COUNT(*)::int as c FROM obra_doc_fases WHERE tenant_id = ${tenantId};` : Promise.resolve([{ c: 0 }])
  };

  const results = await Promise.all(Object.values(manifestQueries));
  const keys = Object.keys(manifestQueries);
  for (let i = 0; i < keys.length; i++) {
    counts[keys[i]] = results[i][0]?.c || 0;
  }

  return res.status(200).json({
    success: true,
    counts,
    paginationThreshold: 500,
    timestamp: new Date().toISOString()
  });
}

/**
 * ── 3. SNAPSHOT COMPLETO DE TODAS AS COLEÇÕES ───────────────────────────────
 */
export async function handleFullSnapshot(sql, tenantId, auth, res) {
  setPrivateNoCache(res);
  const [
    obras, fornecedores, lancamentos, notas, produtos,
    orcamentos, medicoes, documentos, contas,
    precompras, contratos, recibos, orcamentosSinapi, docFases, prefs
  ] = await Promise.all([
    tableAllowed(auth, 'obras', 'read')
      ? sql`SELECT * FROM obras WHERE tenant_id = ${tenantId} AND id NOT IN ('escritorio', 'geral') ORDER BY nome ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'fornecedores', 'read')
      ? sql`SELECT * FROM fornecedores WHERE tenant_id = ${tenantId} ORDER BY nome ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'lancamentos', 'read')
      ? sql`SELECT *, xmin::text AS sync_version FROM lancamentos WHERE tenant_id = ${tenantId} ORDER BY data DESC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'notas', 'read')
      ? sql`SELECT * FROM notas_fiscais WHERE tenant_id = ${tenantId} ORDER BY data_emissao DESC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'produtos', 'read')
      ? sql`SELECT * FROM produtos WHERE tenant_id = ${tenantId} ORDER BY nome ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'orcamentos', 'read')
      ? sql`SELECT * FROM orcamentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'medicoes', 'read')
      ? sql`SELECT * FROM medicoes WHERE tenant_id = ${tenantId} ORDER BY data DESC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'documentos', 'read')
      ? sql`SELECT id, tipo, referencia_id, titulo, categoria, nome_arquivo, tipo_arquivo, tamanho_bytes, url, created_at FROM documentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'contas', 'read')
      ? sql`SELECT * FROM contas_bancarias WHERE tenant_id = ${tenantId} ORDER BY created_at ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'precompras', 'read')
      ? sql`SELECT * FROM precompras WHERE tenant_id = ${tenantId} ORDER BY updated_at ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'contratos', 'read')
      ? sql`SELECT * FROM contratos WHERE tenant_id = ${tenantId} ORDER BY updated_at ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'recibos', 'read')
      ? sql`SELECT * FROM recibos WHERE tenant_id = ${tenantId} ORDER BY updated_at ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'orcamentos_sinapi', 'read')
      ? sql`SELECT * FROM orcamentos_sinapi WHERE tenant_id = ${tenantId} ORDER BY updated_at ASC;`
      : Promise.resolve([]),
    tableAllowed(auth, 'doc_fases', 'read')
      ? sql`SELECT * FROM obra_doc_fases WHERE tenant_id = ${tenantId} ORDER BY updated_at ASC;`
      : Promise.resolve([]),
    sql`SELECT preferences FROM tenant_preferences WHERE tenant_id = ${tenantId} LIMIT 1;`
  ]);

  return res.status(200).json({
    clientes: obras.map(o => ({ ...o, data_inicio: cleanDate(o.data_inicio), data_previsao: cleanDate(o.data_previsao) })),
    fornecedores: fornecedores.map(f => ({ ...f, cnpj: f.cnpj_cpf || f.cnpj || '', razao_social: f.razao_social || f.nome, nome_fantasia: f.nome, endereco: f.endereco || '', municipio: f.municipio || '', uf: f.uf || '', ativo: f.ativo !== false })),
    lancamentos: lancamentos.map(l => ({ ...l, data: cleanDate(l.data) || todayBoaVista(), data_vencimento: cleanDate(l.data_vencimento) || cleanDate(l.data), data_pagamento: cleanDate(l.data_pagamento), valor: cleanNum(l.valor), itens: Array.isArray(l.itens) ? l.itens : safeJsonParse(l.itens, []) })),
    notas: notas.map(n => ({ ...n, data_emissao: cleanDate(n.data_emissao), data_vencimento: cleanDate(n.data_vencimento), data_pagamento: cleanDate(n.data_pagamento), valor_bruto: cleanNum(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total), impostos: cleanNum(n.impostos), valor_liquido: cleanNum(n.valor_liquido !== undefined ? n.valor_liquido : (n.valor_bruto || n.valor_total)), valor_total: cleanNum(n.valor_total !== undefined ? n.valor_total : n.valor_bruto), categoria: n.categoria || 'material', tipo: n.tipo || 'entrada', chave_nfe: n.chave_nfe || n.chave_acesso || '', itens: Array.isArray(n.itens) ? n.itens : safeJsonParse(n.itens, []) })),
    produtos: produtos.map(p => ({ ...p, valor_medio: cleanNum(p.valor_medio) })),
    orcamentos: orcamentos.map(normalizeOrcamento),
    medicoes: medicoes.map(normalizeMedicao),
    documentos,
    contas,
    precompras: precompras.map(jsonPayload),
    contratos: contratos.map(jsonPayload),
    recibos: recibos.map(jsonPayload),
    orcamentos_sinapi: orcamentosSinapi.map(jsonPayload),
    doc_fases: docFases.map(docPhasePayload),
    preferencias: prefs[0]?.preferences || null
  });
}

/**
 * ── 4. CONSULTA DAS BASES OFICIAIS SINAPI (COM EDGE CACHING) ────────────────
 */
export async function handleSinapiQuery(sql, query, res) {
  const sinapiPlanError = planFeatureErrorForTable(null, 'orcamentos_sinapi');
  if (sinapiPlanError) return res.status(403).json(sinapiPlanError);

  // Snapshot oficial Caixa é imutável: Cache de 24h no Cloudflare Edge
  setEdgeCacheHeaders(res, { sMaxAge: 86400, staleWhileRevalidate: 604800, isPublic: true });

  const rows = await sql`
    SELECT id, codigo, descricao, unidade, valor, data_referencia, estado
    FROM sinapi_itens
    LIMIT 200;
  `;
  return res.status(200).json(rows);
}

/**
 * ── 5. CONSULTA PAGINADA E FILTRADA DE UMA TABELA INDIVIDUAL ─────────────────
 */
export async function handleTableQuery(sql, tenantId, auth, query, res) {
  setPrivateNoCache(res);
  const table = query.table;
  const pagination = parsePagination(query);

  const filterInicio = cleanDate(query.data_inicio || query.desde);
  const filterFim = cleanDate(query.data_fim || query.ate);
  const filterTipo = query.tipo ? String(query.tipo).toLowerCase().trim() : null;
  const filterObra = (query.obra_id || '').toString().trim() || null;

  switch (table) {
    case 'obras':
    case 'clientes': {
      if (!tableAllowed(auth, 'obras', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      const rows = pagination
        ? (pagination.cursor
            ? await sql`SELECT * FROM obras WHERE tenant_id = ${tenantId} AND id NOT IN ('escritorio', 'geral') AND id > ${pagination.cursor} ORDER BY id ASC LIMIT ${pagination.limit};`
            : await sql`SELECT * FROM obras WHERE tenant_id = ${tenantId} AND id NOT IN ('escritorio', 'geral') ORDER BY id ASC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`)
        : await sql`SELECT * FROM obras WHERE tenant_id = ${tenantId} AND id NOT IN ('escritorio', 'geral') ORDER BY nome ASC;`;
      return res.status(200).json(pageResponse(rows.map(o => ({ ...o, data_inicio: cleanDate(o.data_inicio), data_previsao: cleanDate(o.data_previsao) })), pagination));
    }

    case 'fornecedores': {
      if (!tableAllowed(auth, 'fornecedores', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      const rows = pagination
        ? (pagination.cursor
            ? await sql`SELECT * FROM fornecedores WHERE tenant_id = ${tenantId} AND id > ${pagination.cursor} ORDER BY id ASC LIMIT ${pagination.limit};`
            : await sql`SELECT * FROM fornecedores WHERE tenant_id = ${tenantId} ORDER BY id ASC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`)
        : await sql`SELECT * FROM fornecedores WHERE tenant_id = ${tenantId} ORDER BY nome ASC;`;
      return res.status(200).json(pageResponse(rows.map(f => ({ ...f, cnpj: f.cnpj_cpf || f.cnpj || '', razao_social: f.razao_social || f.nome, nome_fantasia: f.nome, endereco: f.endereco || '', municipio: f.municipio || '', uf: f.uf || '', ativo: f.ativo !== false })), pagination));
    }

    case 'produtos': {
      if (!tableAllowed(auth, 'produtos', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      const rows = pagination
        ? (pagination.cursor
            ? await sql`SELECT * FROM produtos WHERE tenant_id = ${tenantId} AND id > ${pagination.cursor} ORDER BY id ASC LIMIT ${pagination.limit};`
            : await sql`SELECT * FROM produtos WHERE tenant_id = ${tenantId} ORDER BY nome ASC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`)
        : await sql`SELECT * FROM produtos WHERE tenant_id = ${tenantId} ORDER BY nome ASC;`;
      return res.status(200).json(pageResponse(rows.map(p => ({ ...p, valor_medio: cleanNum(p.valor_medio) })), pagination));
    }

    case 'contas':
    case 'contas_bancarias': {
      if (!tableAllowed(auth, 'contas', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      const rows = pagination
        ? (pagination.cursor
            ? await sql`SELECT * FROM contas_bancarias WHERE tenant_id = ${tenantId} AND id > ${pagination.cursor} ORDER BY id ASC LIMIT ${pagination.limit};`
            : await sql`SELECT * FROM contas_bancarias WHERE tenant_id = ${tenantId} ORDER BY created_at ASC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`)
        : await sql`SELECT * FROM contas_bancarias WHERE tenant_id = ${tenantId} ORDER BY created_at ASC;`;
      return res.status(200).json(pageResponse(rows, pagination));
    }

    case 'lancamentos': {
      if (!tableAllowed(auth, 'lancamentos', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      let rows;
      if (filterObra) {
        rows = pagination
          ? await sql`
              SELECT *, xmin::text AS sync_version FROM lancamentos 
              WHERE tenant_id = ${tenantId} 
                AND obra_id = ${filterObra}
                AND (${filterInicio}::date IS NULL OR data >= ${filterInicio}::date)
                AND (${filterFim}::date IS NULL OR data <= ${filterFim}::date)
                AND (${filterTipo}::text IS NULL OR tipo = ${filterTipo})
              ORDER BY data DESC, created_at DESC, id DESC 
              LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`
              SELECT *, xmin::text AS sync_version FROM lancamentos 
              WHERE tenant_id = ${tenantId} 
                AND obra_id = ${filterObra}
                AND (${filterInicio}::date IS NULL OR data >= ${filterInicio}::date)
                AND (${filterFim}::date IS NULL OR data <= ${filterFim}::date)
                AND (${filterTipo}::text IS NULL OR tipo = ${filterTipo})
              ORDER BY data DESC, created_at DESC, id DESC;`;
      } else {
        rows = pagination
          ? await sql`
              SELECT *, xmin::text AS sync_version FROM lancamentos 
              WHERE tenant_id = ${tenantId}
                AND (${filterInicio}::date IS NULL OR data >= ${filterInicio}::date)
                AND (${filterFim}::date IS NULL OR data <= ${filterFim}::date)
                AND (${filterTipo}::text IS NULL OR tipo = ${filterTipo})
              ORDER BY data DESC, created_at DESC, id DESC 
              LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`
              SELECT *, xmin::text AS sync_version FROM lancamentos 
              WHERE tenant_id = ${tenantId}
                AND (${filterInicio}::date IS NULL OR data >= ${filterInicio}::date)
                AND (${filterFim}::date IS NULL OR data <= ${filterFim}::date)
                AND (${filterTipo}::text IS NULL OR tipo = ${filterTipo})
              ORDER BY data DESC, created_at DESC, id DESC;`;
      }
      return res.status(200).json(pageResponse(rows.map(l => ({
        ...l,
        data: cleanDate(l.data) || todayBoaVista(),
        data_vencimento: cleanDate(l.data_vencimento) || cleanDate(l.data),
        data_pagamento: cleanDate(l.data_pagamento),
        valor: cleanNum(l.valor),
        itens: Array.isArray(l.itens) ? l.itens : safeJsonParse(l.itens, [])
      })), pagination));
    }

    case 'notas':
    case 'notas_fiscais': {
      if (!tableAllowed(auth, 'notas', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      let rows;
      if (filterObra) {
        rows = pagination
          ? await sql`
              SELECT * FROM notas_fiscais 
              WHERE tenant_id = ${tenantId}
                AND obra_id = ${filterObra}
                AND (${filterInicio}::date IS NULL OR data_emissao >= ${filterInicio}::date)
                AND (${filterFim}::date IS NULL OR data_emissao <= ${filterFim}::date)
              ORDER BY data_emissao DESC, created_at DESC, id DESC 
              LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`
              SELECT * FROM notas_fiscais 
              WHERE tenant_id = ${tenantId}
                AND obra_id = ${filterObra}
                AND (${filterInicio}::date IS NULL OR data_emissao >= ${filterInicio}::date)
                AND (${filterFim}::date IS NULL OR data_emissao <= ${filterFim}::date)
              ORDER BY data_emissao DESC, created_at DESC, id DESC;`;
      } else {
        rows = pagination
          ? await sql`
              SELECT * FROM notas_fiscais 
              WHERE tenant_id = ${tenantId}
                AND (${filterInicio}::date IS NULL OR data_emissao >= ${filterInicio}::date)
                AND (${filterFim}::date IS NULL OR data_emissao <= ${filterFim}::date)
              ORDER BY data_emissao DESC, created_at DESC, id DESC 
              LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`
              SELECT * FROM notas_fiscais 
              WHERE tenant_id = ${tenantId}
                AND (${filterInicio}::date IS NULL OR data_emissao >= ${filterInicio}::date)
                AND (${filterFim}::date IS NULL OR data_emissao <= ${filterFim}::date)
              ORDER BY data_emissao DESC, created_at DESC, id DESC;`;
      }
      return res.status(200).json(pageResponse(rows.map(n => ({
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
      })), pagination));
    }

    case 'orcamentos': {
      if (!tableAllowed(auth, 'orcamentos', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      const rows = pagination
        ? await sql`SELECT * FROM orcamentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
        : await sql`SELECT * FROM orcamentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC, id DESC;`;
      return res.status(200).json(pageResponse(rows.map(normalizeOrcamento), pagination));
    }

    case 'medicoes': {
      if (!tableAllowed(auth, 'medicoes', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      const rows = pagination
        ? await sql`SELECT * FROM medicoes WHERE tenant_id = ${tenantId} ORDER BY data DESC, created_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
        : await sql`SELECT * FROM medicoes WHERE tenant_id = ${tenantId} ORDER BY data DESC, created_at DESC, id DESC;`;
      return res.status(200).json(pageResponse(rows.map(normalizeMedicao), pagination));
    }

    case 'documentos': {
      if (!tableAllowed(auth, 'documentos', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      const rows = pagination
        ? await sql`SELECT id, tipo, referencia_id, titulo, categoria, nome_arquivo, tipo_arquivo, tamanho_bytes, url, created_at FROM documentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
        : await sql`SELECT id, tipo, referencia_id, titulo, categoria, nome_arquivo, tipo_arquivo, tamanho_bytes, url, created_at FROM documentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC, id DESC;`;
      return res.status(200).json(pageResponse(rows, pagination));
    }

    case 'documento_conteudo': {
      if (!tableAllowed(auth, 'documentos', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      const docId = query.id;
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

    case 'precompras': {
      if (!tableAllowed(auth, 'precompras', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      const rows = pagination
        ? await sql`SELECT * FROM precompras WHERE tenant_id=${tenantId} ORDER BY data_solicitacao DESC NULLS LAST, updated_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
        : await sql`SELECT * FROM precompras WHERE tenant_id=${tenantId} ORDER BY data_solicitacao DESC NULLS LAST, updated_at DESC, id DESC;`;
      return res.status(200).json(pageResponse(rows.map(jsonPayload), pagination));
    }

    case 'contratos': {
      if (!tableAllowed(auth, 'contratos', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      const rows = pagination
        ? await sql`SELECT * FROM contratos WHERE tenant_id=${tenantId} ORDER BY updated_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
        : await sql`SELECT * FROM contratos WHERE tenant_id=${tenantId} ORDER BY updated_at DESC, id DESC;`;
      return res.status(200).json(pageResponse(rows.map(jsonPayload), pagination));
    }

    case 'recibos': {
      if (!tableAllowed(auth, 'recibos', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      const rows = pagination
        ? await sql`SELECT * FROM recibos WHERE tenant_id=${tenantId} ORDER BY data DESC NULLS LAST, updated_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
        : await sql`SELECT * FROM recibos WHERE tenant_id=${tenantId} ORDER BY data DESC NULLS LAST, updated_at DESC, id DESC;`;
      return res.status(200).json(pageResponse(rows.map(jsonPayload), pagination));
    }

    case 'orcamentos_sinapi': {
      if (!tableAllowed(auth, 'orcamentos_sinapi', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      const rows = pagination
        ? await sql`SELECT * FROM orcamentos_sinapi WHERE tenant_id=${tenantId} ORDER BY updated_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
        : await sql`SELECT * FROM orcamentos_sinapi WHERE tenant_id=${tenantId} ORDER BY updated_at DESC, id DESC;`;
      return res.status(200).json(pageResponse(rows.map(jsonPayload), pagination));
    }

    case 'doc_fases': {
      if (!tableAllowed(auth, 'doc_fases', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      let rows;
      if (filterObra) {
        rows = pagination
          ? await sql`SELECT * FROM obra_doc_fases WHERE tenant_id=${tenantId} AND obra_id=${filterObra} ORDER BY updated_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`SELECT * FROM obra_doc_fases WHERE tenant_id=${tenantId} AND obra_id=${filterObra} ORDER BY updated_at DESC, id DESC;`;
      } else {
        rows = pagination
          ? await sql`SELECT * FROM obra_doc_fases WHERE tenant_id=${tenantId} ORDER BY updated_at DESC, id DESC LIMIT ${pagination.limit} OFFSET ${pagination.offset};`
          : await sql`SELECT * FROM obra_doc_fases WHERE tenant_id=${tenantId} ORDER BY updated_at DESC, id DESC;`;
      }
      return res.status(200).json(pageResponse(rows.map(docPhasePayload), pagination));
    }

    case 'cronograma_config': {
      if (!tableAllowed(auth, 'obras', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      if (!filterObra) return res.status(400).json({ error: 'obra_id é obrigatório para consultar cronograma_config.' });
      const rows = await sql`SELECT cronograma_config FROM obras WHERE id = ${filterObra} AND tenant_id = ${tenantId} LIMIT 1;`;
      return res.status(200).json({ success: true, cronograma_config: rows[0]?.cronograma_config || null });
    }

    case 'bdi_config': {
      if (!tableAllowed(auth, 'obras', 'read')) return res.status(403).json({ error: 'Acesso não permitido.' });
      if (!filterObra) return res.status(400).json({ error: 'obra_id é obrigatório para consultar bdi_config.' });
      const rows = await sql`SELECT bdi_config FROM obras WHERE id = ${filterObra} AND tenant_id = ${tenantId} LIMIT 1;`;
      return res.status(200).json({ success: true, bdi_config: rows[0]?.bdi_config || null });
    }

    case 'preferencias': {
      const rows = await sql`SELECT preferences FROM tenant_preferences WHERE tenant_id = ${tenantId} LIMIT 1;`;
      return res.status(200).json({ success: true, data: rows[0]?.preferences || {}, preferencias: rows[0]?.preferences || {} });
    }

    case 'ocr_historico': {
      const rows = await sql`SELECT * FROM ocr_historico WHERE tenant_id = ${tenantId} ORDER BY data_hora DESC LIMIT 50;`;
      return res.status(200).json({
        success: true,
        data: rows.map(h => ({
          ...h,
          valor: cleanNum(h.valor),
          confianca: cleanNum(h.confianca),
          dados: typeof h.dados === 'string' ? safeJsonParse(h.dados, {}) : (h.dados || {})
        }))
      });
    }

    default:
      return res.status(400).json({ error: `Tabela '${table}' desconhecida ou não suportada para leitura.`, code: 'UNKNOWN_TABLE' });
  }
}
