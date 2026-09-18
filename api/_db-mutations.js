// api/_db-mutations.js — Motor Modular de Mutações (Save e Delete Individual)
// Skill: architecture-patterns & api-security-best-practices

import {
  cleanDate, cleanNum, safeJsonParse, validCloudId,
  todayBoaVista, sanitizeCronogramaConfig, sanitizeBdiConfig, sanitizeTenantPreferences
} from './_db-normalizers.js';
import { setPrivateNoCache } from './_http.js';
import { getPlanRule, isActiveObraStatus } from './_plans.js';
import { writeAudit } from './_audit.js';

export async function validateObraTenant(sql, obraId, tenantId) {
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

export async function validateFornecedorTenant(sql, fornecedorId, tenantId) {
  if (!fornecedorId) return null;
  const clean = fornecedorId.toString().trim();
  const rows = await sql`SELECT id FROM fornecedores WHERE id = ${clean} AND tenant_id = ${tenantId} LIMIT 1;`;
  return rows.length > 0 ? clean : null;
}

export async function validateNotaFiscalTenant(sql, notaId, tenantId) {
  if (!notaId) return null;
  const clean = notaId.toString().trim();
  const rows = await sql`SELECT id FROM notas_fiscais WHERE id = ${clean} AND tenant_id = ${tenantId} LIMIT 1;`;
  return rows.length > 0 ? clean : null;
}

export async function enforceObraPlanLimit(sql, tenantId, plan, obra) {
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

export async function validateBulkObraPlanLimit(sql, tenantId, plan, obras) {
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

export function auditPreview(table, data) {
  if (!data || typeof data !== 'object') return null;
  const out = { id: data.id || null };
  for (const k of ['nome', 'descricao', 'titulo', 'numero_nf', 'status', 'tipo', 'categoria', 'obra_id', 'valor', 'valor_total', 'nome_arquivo']) {
    if (data[k] !== undefined && data[k] !== null && data[k] !== '') out[k] = data[k];
  }
  return out;
}

export async function auditDb(sql, req, auth, acao, table, data, id = null) {
  await writeAudit(sql, req, auth, {
    acao,
    entidade: String(table || 'dados').slice(0, 80),
    entidadeId: String(id || data?.id || '').slice(0, 128) || null,
    depois: acao === 'excluir' ? null : auditPreview(table, data),
    antes: acao === 'excluir' ? auditPreview(table, data) : null
  });
}

/**
 * ── SALVAR REGISTRO INDIVIDUAL (UPSERT COM ISOLAMENTO DE TENANT) ─────────────
 */
export async function handleSave(sql, tenantId, auth, req, res, table, data) {
  setPrivateNoCache(res);

  if (table === 'lancamentos') {
    const l = data;
    const dataLanc = cleanDate(l.data) || todayBoaVista();
    const dataVenc = cleanDate(l.data_vencimento) || dataLanc;
    const dataPag = cleanDate(l.data_pagamento);
    const safeObraId = await validateObraTenant(sql, l.obra_id, tenantId);
    const safeNotaId = await validateNotaFiscalTenant(sql, l.nota_fiscal_id, tenantId);

    const itensLancJson = JSON.stringify(Array.isArray(l.itens) ? l.itens : []);

    const saved = await sql`
      INSERT INTO lancamentos (
        id, tenant_id, data, data_vencimento, data_pagamento, descricao, categoria,
        fornecedor_beneficiario, conta_bancaria, tipo, valor, status,
        obra_id, nota_fiscal_id, codigo_barras, chave_nfe, observacoes, conciliado, itens
      )
      SELECT
        ${l.id}, ${tenantId}, ${dataLanc}, ${dataVenc}, ${dataPag}, ${l.descricao}, ${l.categoria || 'Outros'},
        ${l.fornecedor_beneficiario || ''}, ${l.conta_bancaria || ''}, ${l.tipo || 'despesa'}, ${cleanNum(l.valor)}, ${l.status || 'pendente'},
        ${safeObraId}, ${safeNotaId}, ${l.codigo_barras || null}, ${l.chave_nfe || null}, ${l.observacoes || ''}, ${!!l.conciliado},
        ${itensLancJson}::jsonb
      WHERE ${String(l.sync_version || '')} = '' OR EXISTS (
        SELECT 1 FROM lancamentos WHERE id = ${l.id} AND tenant_id = ${tenantId} FOR UPDATE
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
      WHERE lancamentos.tenant_id = ${tenantId}
        AND (lancamentos.xmin::text = ${String(l.sync_version || '')} OR
            ROW(lancamentos.data, lancamentos.data_vencimento, lancamentos.data_pagamento, lancamentos.descricao, lancamentos.categoria, lancamentos.fornecedor_beneficiario, lancamentos.conta_bancaria, lancamentos.tipo, lancamentos.valor, lancamentos.status, lancamentos.obra_id, lancamentos.nota_fiscal_id, lancamentos.codigo_barras, lancamentos.chave_nfe, lancamentos.observacoes, lancamentos.conciliado, lancamentos.itens)
            IS NOT DISTINCT FROM ROW(EXCLUDED.data, EXCLUDED.data_vencimento, EXCLUDED.data_pagamento, EXCLUDED.descricao, EXCLUDED.categoria, EXCLUDED.fornecedor_beneficiario, EXCLUDED.conta_bancaria, EXCLUDED.tipo, EXCLUDED.valor, EXCLUDED.status, EXCLUDED.obra_id, EXCLUDED.nota_fiscal_id, EXCLUDED.codigo_barras, EXCLUDED.chave_nfe, EXCLUDED.observacoes, EXCLUDED.conciliado, EXCLUDED.itens))
      RETURNING id, xmin::text AS sync_version;
    `;
    if (!saved.length) return res.status(409).json({ success: false, code: 'SYNC_CONFLICT', error: 'Lançamento alterado ou excluído em outro dispositivo. Atualize os dados e revise a alteração.' });
    await auditDb(sql, req, auth, 'salvar', 'lancamentos', l);
    return res.status(200).json({ success: true, id: l.id, sync_version: saved[0].sync_version });
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
    const cronogramaJson = o.cronograma_config == null && !Array.isArray(o.processos_sla) ? null : JSON.stringify(sanitizeCronogramaConfig({ ...(o.cronograma_config || {}), processos_sla: o.cronograma_config?.processos_sla || o.processos_sla }));
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
    return res.status(200).json({ success: true, id: pc.id });
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
    return res.status(200).json({ success: true, id: c.id });
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
    return res.status(200).json({ success: true, id: r.id });
  }

  if (table === 'orcamentos_sinapi') {
    const o = data || {};
    if (!validCloudId(o.id, 80)) return res.status(400).json({ success: false, error: 'ID de orçamento SINAPI inválido.' });
    const safeObraId = await validateObraTenant(sql, o.obra_id, tenantId);
    if (o.obra_id && !safeObraId) return res.status(400).json({ success: false, error: 'A obra informada não pertence à empresa autenticada.' });
    const dbObraId = (!safeObraId || safeObraId === 'escritorio' || safeObraId === 'geral') ? null : safeObraId;
    const rawJson = JSON.stringify(o);
    const subtotal = (Array.isArray(o.itens) ? o.itens : []).reduce((sum, item) => sum + cleanNum(item?.total), 0);
    const total = cleanNum(o.valor_total) > 0 ? cleanNum(o.valor_total) : (subtotal * (1 + cleanNum(o.bdi) / 100));
    try {
      await sql`
        INSERT INTO orcamentos_sinapi (tenant_id,id,obra_id,nome,status,valor_total,payload)
        VALUES (${tenantId},${o.id},${dbObraId},${o.nome || 'Orçamento SINAPI'},${o.status || 'ativo'},${total},${rawJson}::jsonb)
        ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,nome=EXCLUDED.nome,status=EXCLUDED.status,valor_total=EXCLUDED.valor_total,payload=EXCLUDED.payload,updated_at=NOW();
      `;
    } catch (dbErr) {
      console.error('[API /api/db] Erro ao salvar orcamento_sinapi:', dbErr.message);
      return res.status(500).json({ success: false, error: 'Erro ao salvar orçamento SINAPI no banco de dados.' });
    }
    await auditDb(sql, req, auth, 'salvar', 'orcamentos_sinapi', o);
    return res.status(200).json({ success: true, id: o.id });
  }

  if (table === 'doc_fases') {
    const d = data || {};
    const cloudId = String(d.cloud_id || d.id || '').trim();
    if (!validCloudId(cloudId, 180) || !d.obra_id || !d.doc_id) return res.status(400).json({ success: false, error: 'Dados da fase documental incompletos.' });
    const safeObraId = await validateObraTenant(sql, d.obra_id, tenantId);
    if (!safeObraId || ['escritorio', 'geral'].includes(safeObraId)) return res.status(400).json({ success: false, error: 'A obra informada não pertence à empresa autenticada.' });
    const rawJson = JSON.stringify({ ...d, id: d.doc_id });
    await sql`
      INSERT INTO obra_doc_fases (tenant_id,id,obra_id,doc_id,fase_key,payload)
      VALUES (${tenantId},${cloudId},${safeObraId},${String(d.doc_id).slice(0, 100)},${d.fase_key || null},${rawJson}::jsonb)
      ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,doc_id=EXCLUDED.doc_id,fase_key=EXCLUDED.fase_key,payload=EXCLUDED.payload,updated_at=NOW();
    `;
    await auditDb(sql, req, auth, 'salvar', 'doc_fases', d, cloudId);
    return res.status(200).json({ success: true, id: cloudId });
  }

  if (table === 'preferencias') {
    const prefs = sanitizeTenantPreferences(data?.preferences);
    const prefJson = JSON.stringify(prefs);
    await sql`
      INSERT INTO tenant_preferences (tenant_id,preferences)
      VALUES (${tenantId},${prefJson}::jsonb)
      ON CONFLICT (tenant_id) DO UPDATE SET preferences=tenant_preferences.preferences || EXCLUDED.preferences,updated_at=NOW();
    `;
    await auditDb(sql, req, auth, 'salvar', 'preferencias', { id: tenantId, chaves: Object.keys(prefs).slice(0, 20) });
    return res.status(200).json({ success: true });
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

  return res.status(400).json({ success: false, error: `Tabela '${table}' desconhecida para salvamento.` });
}

/**
 * ── EXCLUIR REGISTRO INDIVIDUAL COM TOMBSTONE PARA PROPAGAÇÃO OFFLINE ────────
 */
export async function handleDelete(sql, tenantId, auth, req, res, table, id) {
  setPrivateNoCache(res);

  if (table === 'lancamentos') {
    await sql`DELETE FROM lancamentos WHERE id = ${id} AND tenant_id = ${tenantId};`;
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: 'lancamentos', entidadeId: id, antes: { id } });
    return res.status(200).json({ success: true, id });
  }

  if (table === 'notas' || table === 'notas_fiscais') {
    await sql`DELETE FROM notas_fiscais WHERE id = ${id} AND tenant_id = ${tenantId};`;
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: 'notas_fiscais', entidadeId: id, antes: { id } });
    return res.status(200).json({ success: true, id });
  }

  if (table === 'obras' || table === 'clientes') {
    await sql`DELETE FROM obras WHERE id = ${id} AND tenant_id = ${tenantId};`;
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: 'obras', entidadeId: id, antes: { id } });
    return res.status(200).json({ success: true, id });
  }

  if (table === 'fornecedores') {
    await sql`DELETE FROM fornecedores WHERE id = ${id} AND tenant_id = ${tenantId};`;
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: 'fornecedores', entidadeId: id, antes: { id } });
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
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: 'documentos', entidadeId: id, antes: { id } });
    return res.status(200).json({ success: true, id });
  }

  if (table === 'produtos') {
    await sql`DELETE FROM produtos WHERE id = ${id} AND tenant_id = ${tenantId};`;
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: 'produtos', entidadeId: id, antes: { id } });
    return res.status(200).json({ success: true, id });
  }

  if (table === 'precompras' || table === 'contratos' || table === 'recibos') {
    const tableName = table;
    if (tableName === 'precompras') await sql`DELETE FROM precompras WHERE tenant_id=${tenantId} AND id=${id};`;
    if (tableName === 'contratos') await sql`DELETE FROM contratos WHERE tenant_id=${tenantId} AND id=${id};`;
    if (tableName === 'recibos') await sql`DELETE FROM recibos WHERE tenant_id=${tenantId} AND id=${id};`;
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: tableName, entidadeId: id, antes: { id } });
    return res.status(200).json({ success: true, id });
  }

  if (table === 'orcamentos_sinapi') {
    await sql`DELETE FROM orcamentos_sinapi WHERE tenant_id=${tenantId} AND id=${id};`;
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: 'orcamentos_sinapi', entidadeId: id, antes: { id } });
    return res.status(200).json({ success: true, id });
  }

  if (table === 'doc_fases') {
    await sql`DELETE FROM obra_doc_fases WHERE tenant_id=${tenantId} AND id=${id};`;
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: 'doc_fases', entidadeId: id, antes: { id } });
    return res.status(200).json({ success: true, id });
  }

  if (table === 'ocr_historico') {
    if (id === 'all') {
      await sql`DELETE FROM ocr_historico WHERE tenant_id = ${tenantId};`;
    } else {
      await sql`DELETE FROM ocr_historico WHERE id = ${id} AND tenant_id = ${tenantId};`;
    }
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: 'ocr_historico', entidadeId: id, antes: { id } });
    return res.status(200).json({ success: true, id });
  }

  if (table === 'contas' || table === 'contas_bancarias') {
    await sql`DELETE FROM contas_bancarias WHERE id = ${id} AND tenant_id = ${tenantId};`;
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: 'contas_bancarias', entidadeId: id, antes: { id } });
    return res.status(200).json({ success: true, id });
  }

  if (table === 'orcamentos') {
    await sql`DELETE FROM orcamentos WHERE id = ${id} AND tenant_id = ${tenantId};`;
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: 'orcamentos', entidadeId: id, antes: { id } });
    return res.status(200).json({ success: true, id });
  }

  if (table === 'medicoes') {
    await sql`DELETE FROM medicoes WHERE id = ${id} AND tenant_id = ${tenantId};`;
    await writeAudit(sql, req, auth, { acao: 'excluir', entidade: 'medicoes', entidadeId: id, antes: { id } });
    return res.status(200).json({ success: true, id });
  }

  return res.status(400).json({ success: false, error: `Tabela '${table}' desconhecida para exclusão.` });
}
