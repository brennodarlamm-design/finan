// api/_db-sync.js — Motor de Sincronização em Massa (sync_all Local -> Neon)
// Skill: architecture-patterns & api-design-principles

import {
  cleanDate, cleanNum, safeJsonParse, validCloudId,
  todayBoaVista, sanitizeCronogramaConfig, sanitizeBdiConfig, sanitizeTenantPreferences
} from './_db-normalizers.js';
import { validateObraTenant, validateBulkObraPlanLimit } from './_db-mutations.js';
import { setPrivateNoCache } from './_http.js';
import { isTenantStorageUrl } from './_edge-r2.js';
import { dadosExtrasDaObra, dadosExtrasDoLancamento, dadosExtras } from './_obra-dados.js';
import { writeAudit, writeAuditBatch } from './_audit.js';
import { syncVersionConflict, withoutSyncVersion, prefetchSyncVersions } from './_sync-guard.js';
import { validarArquivoBase64 } from './_file-validation.js';

/**
 * Executa a sincronização em lote de todas as coleções do cliente com isolamento multi-tenant.
 */
export async function handleSyncAll(sql, tenantId, auth, req, res, payload) {
  setPrivateNoCache(res);

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

  const validObrasSet = new Set(['escritorio', 'geral']);
  const validNotasSet = new Set();

  // AUDITORIA 2026-10-04 #14: o delta das outras telas acha alterações por created_at ou por
  // audit_logs (entidade + id). O "Sincronizar tudo" gravava um único log genérico, então um registro
  // ALTERADO aqui não chegava aos outros aparelhos. Agora os ids gravados vão para audit_logs em lote.
  // AUDITORIA 2026-10-04 #15: versões de cada tabela lidas uma vez (antes: 1 consulta por registro).
  const cacheVersoes = new Map();
  const versoesDe = async (tabela) => {
    if (!cacheVersoes.has(tabela)) cacheVersoes.set(tabela, await prefetchSyncVersions(sql, tabela, tenantId, payload?.[tabela]));
    return cacheVersoes.get(tabela);
  };
  const tocadosDelta = new Map();
  const marcarDelta = (entidade, id) => {
    if (!id) return;
    if (!tocadosDelta.has(entidade)) tocadosDelta.set(entidade, new Set());
    tocadosDelta.get(entidade).add(String(id).slice(0, 128));
  };

  // 1. Obras — valida o lote inteiro antes da primeira gravação para evitar sync parcial
  if (Array.isArray(payload.clientes)) {
    if (!auth.isSystem && auth.user?.perfil !== 'superadmin') {
      const planCheck = await validateBulkObraPlanLimit(sql, tenantId, auth.user?.tenantPlan, payload.clientes);
      if (!planCheck.allowed) return res.status(planCheck.status).json(planCheck.body);
    }
    for (const o of payload.clientes) {
      // Concorrência otimista (VARREDURA 2026-10-03 #4): não sobrescreve versão mais nova nem recria excluído.
      const conflito = await syncVersionConflict(sql, 'clientes', tenantId, o, await versoesDe('clientes'));
      if (conflito) { recordFailure('clientes', o, conflito.error, 'SYNC_CONFLICT'); continue; }
      if (!o.id || !o.nome) continue;
      const cronogramaJson = o.cronograma_config == null && !Array.isArray(o.processos_sla) ? null : JSON.stringify(sanitizeCronogramaConfig({ ...(o.cronograma_config || {}), processos_sla: o.cronograma_config?.processos_sla || o.processos_sla }));
      const bdiJson = o.bdi_config == null ? null : JSON.stringify(sanitizeBdiConfig(o.bdi_config));
      try {
        await sql`
          INSERT INTO obras (id, tenant_id, nome, cliente, endereco, orcamento_total, status, data_inicio, data_previsao, cronograma_config, bdi_config, dados)
          VALUES (
            ${o.id}, ${tenantId}, ${o.nome}, ${o.cliente || ''}, ${o.endereco || ''},
            ${cleanNum(o.orcamento_total || o.valor_contrato)}, ${o.status || 'em_andamento'},
            ${cleanDate(o.data_inicio)}, ${cleanDate(o.data_previsao || o.data_previsao_termino)},
            ${cronogramaJson}::jsonb, ${bdiJson}::jsonb, ${JSON.stringify(dadosExtrasDaObra(o))}::jsonb
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
            bdi_config = EXCLUDED.bdi_config,
            -- Cadastro completo (migração 045). Mescla: um envio parcial não apaga o que já estava salvo.
            dados = COALESCE(obras.dados, '{}'::jsonb) || EXCLUDED.dados;
        `;
        validObrasSet.add(o.id);
        totalCount++;
        marcarDelta('obras', o.id);
      } catch (err) {
        console.warn('[Sync All] Falha ao salvar obra:', err.message);
        recordFailure('clientes', o, err.message, 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 2. Fornecedores
  if (Array.isArray(payload.fornecedores)) {
    for (const f of payload.fornecedores) {
      // Concorrência otimista (VARREDURA 2026-10-03 #4): não sobrescreve versão mais nova nem recria excluído.
      const conflito = await syncVersionConflict(sql, 'fornecedores', tenantId, f, await versoesDe('fornecedores'));
      if (conflito) { recordFailure('fornecedores', f, conflito.error, 'SYNC_CONFLICT'); continue; }
      if (!f.id) continue;
      const nomeFinal = (f.nome || f.nome_fantasia || f.razao_social || f.razao || 'Fornecedor').trim();
      const razaoSocialFinal = (f.razao_social || f.nome_fantasia || f.nome || nomeFinal).trim();
      const cnpjCpfFinal = (f.cnpj_cpf || f.cnpj || f.cpf || '').replace(/\D/g, '');
      try {
        await sql`
          INSERT INTO fornecedores (
            id, tenant_id, nome, razao_social, cnpj_cpf, telefone, email, categoria,
            chave_pix, banco_info, endereco, municipio, uf, ativo, dados
          )
          VALUES (
            ${f.id}, ${tenantId}, ${nomeFinal}, ${razaoSocialFinal}, ${cnpjCpfFinal},
            ${f.telefone || ''}, ${f.email || ''}, ${f.categoria || 'outros'}, ${f.chave_pix || ''}, ${f.banco_info || ''},
            ${f.endereco || ''}, ${f.municipio || ''}, ${(f.uf || '').toUpperCase().slice(0, 2)}, ${f.ativo !== false},
            ${JSON.stringify(dadosExtras('fornecedores', f))}::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            dados = COALESCE(fornecedores.dados, '{}'::jsonb) || EXCLUDED.dados,
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
        marcarDelta('fornecedores', f.id);
      } catch (err) {
        console.warn('[Sync All] Falha ao salvar fornecedor:', err.message);
        recordFailure('fornecedores', f, err.message, 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 3. Contas Bancárias
  if (Array.isArray(payload.contas)) {
    for (const c of payload.contas) {
      // Concorrência otimista (VARREDURA 2026-10-03 #4): não sobrescreve versão mais nova nem recria excluído.
      const conflito = await syncVersionConflict(sql, 'contas', tenantId, c, await versoesDe('contas'));
      if (conflito) { recordFailure('contas', c, conflito.error, 'SYNC_CONFLICT'); continue; }
      if (!c.id) continue;
      try {
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
        marcarDelta('contas', c.id);
      } catch (err) {
        console.warn('[Sync All] Falha ao salvar conta bancária:', err.message);
        recordFailure('contas', c, err.message, 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 4. Produtos (normalização defensiva de nome/descrição)
  if (Array.isArray(payload.produtos)) {
    for (const p of payload.produtos) {
      // Concorrência otimista (VARREDURA 2026-10-03 #4): não sobrescreve versão mais nova nem recria excluído.
      const conflito = await syncVersionConflict(sql, 'produtos', tenantId, p, await versoesDe('produtos'));
      if (conflito) { recordFailure('produtos', p, conflito.error, 'SYNC_CONFLICT'); continue; }
      const prodId = String(p?.id || '').trim();
      const nomeFinal = String(p?.nome || p?.descricao || p?.titulo || '').trim();
      if (!prodId || !nomeFinal) continue;
      try {
        await sql`
          INSERT INTO produtos (id, tenant_id, nome, unidade, categoria, codigo, valor_medio, observacoes, dados)
          VALUES (${prodId}, ${tenantId}, ${nomeFinal.slice(0, 255)}, ${String(p.unidade || 'un').trim().slice(0, 32)}, ${String(p.categoria || 'material').trim().slice(0, 100)}, ${p.codigo ? String(p.codigo).trim().slice(0, 64) : null}, ${cleanNum(p.valor_medio)}, ${String(p.observacoes || '')}, ${JSON.stringify(dadosExtras('produtos', p))}::jsonb)
          ON CONFLICT (id) DO UPDATE SET
            dados = COALESCE(produtos.dados, '{}'::jsonb) || EXCLUDED.dados,
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
        marcarDelta('produtos', prodId);
      } catch (err) {
        console.warn('[Sync All] Falha ao salvar produto:', err.message);
        recordFailure('produtos', p, err.message, 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 5. Notas Fiscais (Processadas ANTES de Lançamentos para garantir FK referencial)
  if (Array.isArray(payload.notas)) {
    for (const n of payload.notas) {
      // Concorrência otimista (VARREDURA 2026-10-03 #4): não sobrescreve versão mais nova nem recria excluído.
      const conflito = await syncVersionConflict(sql, 'notas', tenantId, n, await versoesDe('notas'));
      if (conflito) { recordFailure('notas', n, conflito.error, 'SYNC_CONFLICT'); continue; }
      if (!n.id) continue;
      const vBruto = cleanNum(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total);
      const vImp = cleanNum(n.impostos);
      const vLiq = cleanNum(n.valor_liquido !== undefined ? n.valor_liquido : (vBruto - vImp));
      // O formulário de notas edita valor_bruto; o valor_total antigo (vindo da nuvem) não pode prevalecer.
      const vTot = (n.valor_bruto !== undefined && n.valor_bruto !== null && n.valor_bruto !== '') ? vBruto : cleanNum(n.valor_total);
      const itensNotaJson = JSON.stringify(Array.isArray(n.itens) ? n.itens : []);
      const safeNotaObraId = (n.obra_id && (validObrasSet.has(n.obra_id))) ? n.obra_id : null;
      const chave = (n.chave_nfe || n.chave_acesso || '').trim() || null;

      try {
        if (chave) {
          const existing = await sql`
            SELECT id, obra_id
            FROM notas_fiscais
            WHERE (chave_acesso = ${chave} OR chave_nfe = ${chave})
              AND tenant_id = ${tenantId}
            LIMIT 1;
          `;
          if (existing.length > 0) {
            const targetId = existing[0].id;
            await sql`
              UPDATE notas_fiscais
              SET
                numero_nf = ${n.numero_nf || ''},
                serie = ${n.serie || ''},
                chave_acesso = ${chave},
                chave_nfe = ${chave || ''},
                emitente = ${n.emitente || ''},
                cnpj_emitente = ${n.cnpj_emitente || ''},
                destinatario = ${n.destinatario || ''},
                data_emissao = ${cleanDate(n.data_emissao)},
                data_vencimento = ${cleanDate(n.data_vencimento)},
                data_pagamento = ${cleanDate(n.data_pagamento)},
                valor_bruto = ${vBruto},
                impostos = ${vImp},
                valor_liquido = ${vLiq},
                valor_total = ${vTot},
                tipo = ${n.tipo || 'entrada'},
                categoria = ${n.categoria || 'material'},
                status = ${n.status || 'paga'},
                lancamento_id = ${n.lancamento_id || null},
                observacoes = ${n.observacoes || ''},
                obra_id = ${safeNotaObraId || existing[0].obra_id || null},
                itens = ${itensNotaJson}::jsonb,
                updated_at = NOW()
              WHERE id = ${targetId} AND tenant_id = ${tenantId};
            `;
            validNotasSet.add(targetId);
            validNotasSet.add(n.id);
            totalCount++;
            marcarDelta('notas', targetId);
            continue;
          }
        }

        await sql`
          INSERT INTO notas_fiscais (
            id, tenant_id, numero_nf, serie, chave_acesso, chave_nfe, emitente, cnpj_emitente, destinatario,
            data_emissao, data_vencimento, data_pagamento, valor_bruto, impostos, valor_liquido, valor_total,
            tipo, categoria, status, lancamento_id, observacoes, obra_id, itens
          )
          VALUES (
            ${n.id}, ${tenantId}, ${n.numero_nf || ''}, ${n.serie || ''}, ${chave}, ${chave || ''},
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
            itens = EXCLUDED.itens,
            updated_at = NOW()
          WHERE notas_fiscais.tenant_id = ${tenantId};
        `;
        validNotasSet.add(n.id);
        totalCount++;
        marcarDelta('notas', n.id);
      } catch (notaSyncErr) {
        console.warn('[Sync All] Falha ao salvar nota fiscal:', notaSyncErr.message);
        recordFailure('notas', n, 'Falha ao sincronizar nota fiscal.', 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 6. Lançamentos (com validação estrita de integridade referencial com obras e notas já persistidas)
  if (Array.isArray(payload.lancamentos) && payload.lancamentos.length > 0) {
    const [tenantObrasList, tenantNotasList, tenantFornecedoresList] = await Promise.all([
      sql`SELECT id FROM obras WHERE tenant_id = ${tenantId};`,
      sql`SELECT id FROM notas_fiscais WHERE tenant_id = ${tenantId};`,
      sql`SELECT id FROM fornecedores WHERE tenant_id = ${tenantId};`
    ]);
    tenantObrasList.forEach(r => validObrasSet.add(r.id));
    tenantNotasList.forEach(r => validNotasSet.add(r.id));
    const validFornecedoresSet = new Set(tenantFornecedoresList.map(r => r.id));

    for (const l of payload.lancamentos) {
      if (!l.id || !l.descricao) continue;
      const dataLanc = cleanDate(l.data) || todayBoaVista();
      const dataVenc = cleanDate(l.data_vencimento) || dataLanc;
      const dataPag = cleanDate(l.data_pagamento);
      const itensJson = JSON.stringify(Array.isArray(l.itens) ? l.itens : []);

      const safeObraId = (l.obra_id && (validObrasSet.has(l.obra_id))) ? l.obra_id : null;
      const safeNotaId = (l.nota_fiscal_id && validNotasSet.has(l.nota_fiscal_id)) ? l.nota_fiscal_id : null;
      const safeFornecedorId = (l.fornecedor_id && validFornecedoresSet.has(String(l.fornecedor_id))) ? String(l.fornecedor_id) : null;

      try {
        const saved = await sql`
          INSERT INTO lancamentos (
            id, tenant_id, data, data_vencimento, data_pagamento, descricao, categoria,
            fornecedor_beneficiario, conta_bancaria, tipo, valor, status,
            obra_id, nota_fiscal_id, codigo_barras, chave_nfe, observacoes, conciliado, itens, fornecedor_id, dados
          )
          SELECT
            ${l.id}, ${tenantId}, ${dataLanc}, ${dataVenc}, ${dataPag}, ${l.descricao}, ${l.categoria || 'Outros'},
            ${l.fornecedor_beneficiario || ''}, ${l.conta_bancaria || ''}, ${l.tipo || 'despesa'}, ${cleanNum(l.valor)}, ${l.status || 'pendente'},
            ${safeObraId}, ${safeNotaId}, ${l.codigo_barras || null}, ${l.chave_nfe || null}, ${l.observacoes || ''}, ${!!l.conciliado},
            ${itensJson}::jsonb, ${safeFornecedorId}, ${JSON.stringify(dadosExtrasDoLancamento(l))}::jsonb
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
            itens = EXCLUDED.itens,
            fornecedor_id = EXCLUDED.fornecedor_id,
            dados = COALESCE(lancamentos.dados, '{}'::jsonb) || EXCLUDED.dados
          WHERE lancamentos.tenant_id = ${tenantId}
            AND (lancamentos.xmin::text = ${String(l.sync_version || '')} OR
              ROW(lancamentos.data, lancamentos.data_vencimento, lancamentos.data_pagamento, lancamentos.descricao, lancamentos.categoria, lancamentos.fornecedor_beneficiario, lancamentos.conta_bancaria, lancamentos.tipo, lancamentos.valor, lancamentos.status, lancamentos.obra_id, lancamentos.nota_fiscal_id, lancamentos.codigo_barras, lancamentos.chave_nfe, lancamentos.observacoes, lancamentos.conciliado, lancamentos.itens, lancamentos.fornecedor_id, lancamentos.dados)
              IS NOT DISTINCT FROM ROW(EXCLUDED.data, EXCLUDED.data_vencimento, EXCLUDED.data_pagamento, EXCLUDED.descricao, EXCLUDED.categoria, EXCLUDED.fornecedor_beneficiario, EXCLUDED.conta_bancaria, EXCLUDED.tipo, EXCLUDED.valor, EXCLUDED.status, EXCLUDED.obra_id, EXCLUDED.nota_fiscal_id, EXCLUDED.codigo_barras, EXCLUDED.chave_nfe, EXCLUDED.observacoes, EXCLUDED.conciliado, EXCLUDED.itens, EXCLUDED.fornecedor_id, COALESCE(lancamentos.dados, '{}'::jsonb) || EXCLUDED.dados))
          RETURNING id, xmin::text AS sync_version;
        `;
        if (!saved.length) {
          recordFailure('lancamentos', l, 'Lançamento alterado ou excluído em outro dispositivo. Atualize os dados e revise a alteração.', 'SYNC_CONFLICT');
          continue;
        }
        totalCount++;
        marcarDelta('lancamentos', l.id);
      } catch (err) {
        console.warn('[Sync All] Falha ao salvar lançamento:', err.message);
        recordFailure('lancamentos', l, err.message, 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 7. Pré-Compras
  if (Array.isArray(payload.precompras)) {
    for (const pc of payload.precompras) {
      // Concorrência otimista (VARREDURA 2026-10-03 #4): não sobrescreve versão mais nova nem recria excluído.
      const conflito = await syncVersionConflict(sql, 'precompras', tenantId, pc, await versoesDe('precompras'));
      if (conflito) { recordFailure('precompras', pc, conflito.error, 'SYNC_CONFLICT'); continue; }
      if (!pc?.id) continue;
      const safeObraId = await validateObraTenant(sql, pc.obra_id, tenantId);
      const rawJson = JSON.stringify(withoutSyncVersion(pc));
      try {
        await sql`
          INSERT INTO precompras (tenant_id,id,obra_id,numero_ordem,status,valor_total,data_solicitacao,payload)
          VALUES (${tenantId},${pc.id},${safeObraId},${pc.numero_ordem || null},${pc.status || 'rascunho'},${cleanNum(pc.valor_total)},${cleanDate(pc.data_solicitacao)},${rawJson}::jsonb)
          ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,numero_ordem=EXCLUDED.numero_ordem,status=EXCLUDED.status,valor_total=EXCLUDED.valor_total,data_solicitacao=EXCLUDED.data_solicitacao,payload=EXCLUDED.payload,updated_at=NOW();
        `;
        totalCount++;
      } catch (err) {
        console.warn('[Sync All] Falha ao salvar pré-compra:', err.message);
        recordFailure('precompras', pc, err.message, 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 8. Contratos
  if (Array.isArray(payload.contratos)) {
    for (const c of payload.contratos) {
      // Concorrência otimista (VARREDURA 2026-10-03 #4): não sobrescreve versão mais nova nem recria excluído.
      const conflito = await syncVersionConflict(sql, 'contratos', tenantId, c, await versoesDe('contratos'));
      if (conflito) { recordFailure('contratos', c, conflito.error, 'SYNC_CONFLICT'); continue; }
      if (!c?.id) continue;
      const safeObraId = await validateObraTenant(sql, c.obra_id, tenantId);
      const rawJson = JSON.stringify(withoutSyncVersion(c));
      try {
        await sql`
          INSERT INTO contratos (tenant_id,id,obra_id,numero,status,payload)
          VALUES (${tenantId},${c.id},${safeObraId},${c.numero || null},${c.status || 'pendente'},${rawJson}::jsonb)
          ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,numero=EXCLUDED.numero,status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=NOW();
        `;
        totalCount++;
      } catch (err) {
        console.warn('[Sync All] Falha ao salvar contrato:', err.message);
        recordFailure('contratos', c, err.message, 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 9. Recibos
  if (Array.isArray(payload.recibos)) {
    for (const r of payload.recibos) {
      // Concorrência otimista (VARREDURA 2026-10-03 #4): não sobrescreve versão mais nova nem recria excluído.
      const conflito = await syncVersionConflict(sql, 'recibos', tenantId, r, await versoesDe('recibos'));
      if (conflito) { recordFailure('recibos', r, conflito.error, 'SYNC_CONFLICT'); continue; }
      if (!r?.id) continue;
      const safeObraId = await validateObraTenant(sql, r.obra_id, tenantId);
      const rawJson = JSON.stringify(withoutSyncVersion(r));
      const recStatus = r.assinatura ? 'assinado' : (r.status || 'pendente');
      try {
        await sql`
          INSERT INTO recibos (tenant_id,id,obra_id,numero,tipo,valor,data,status,payload)
          VALUES (${tenantId},${r.id},${safeObraId},${r.numero || null},${r.tipo || null},${cleanNum(r.valor)},${cleanDate(r.data)},${recStatus},${rawJson}::jsonb)
          ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,numero=EXCLUDED.numero,tipo=EXCLUDED.tipo,valor=EXCLUDED.valor,data=EXCLUDED.data,status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=NOW();
        `;
        totalCount++;
      } catch (err) {
        console.warn('[Sync All] Falha ao salvar recibo:', err.message);
        recordFailure('recibos', r, err.message, 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 10. Orçamentos SINAPI
  if (Array.isArray(payload.orcamentos_sinapi)) {
    for (const o of payload.orcamentos_sinapi) {
      // Concorrência otimista (VARREDURA 2026-10-03 #4): não sobrescreve versão mais nova nem recria excluído.
      const conflito = await syncVersionConflict(sql, 'orcamentos_sinapi', tenantId, o, await versoesDe('orcamentos_sinapi'));
      if (conflito) { recordFailure('orcamentos_sinapi', o, conflito.error, 'SYNC_CONFLICT'); continue; }
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
      const rawJson = JSON.stringify(withoutSyncVersion(o));
      const subtotal = (Array.isArray(o.itens) ? o.itens : []).reduce((sum, item) => sum + cleanNum(item?.total), 0);
      const total = cleanNum(o.valor_total) > 0 ? cleanNum(o.valor_total) : (subtotal * (1 + cleanNum(o.bdi) / 100));
      try {
        await sql`
          INSERT INTO orcamentos_sinapi (tenant_id,id,obra_id,nome,status,valor_total,payload)
          VALUES (${tenantId},${o.id},${dbObraId},${o.nome || 'Orçamento SINAPI'},${o.status || 'ativo'},${total},${rawJson}::jsonb)
          ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,nome=EXCLUDED.nome,status=EXCLUDED.status,valor_total=EXCLUDED.valor_total,payload=EXCLUDED.payload,updated_at=NOW();
        `;
        totalCount++;
      } catch (bulkErr) {
        console.warn('[Sync All] Falha ao salvar orcamento_sinapi:', bulkErr.message);
        recordFailure('orcamentos_sinapi', o, 'Falha de escrita no banco de dados.', 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 11. Orçamentos
  if (Array.isArray(payload.orcamentos)) {
    for (const o of payload.orcamentos) {
      // Concorrência otimista (VARREDURA 2026-10-03 #4): não sobrescreve versão mais nova nem recria excluído.
      const conflito = await syncVersionConflict(sql, 'orcamentos', tenantId, o, await versoesDe('orcamentos'));
      if (conflito) { recordFailure('orcamentos', o, conflito.error, 'SYNC_CONFLICT'); continue; }
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

      try {
        await sql`
          INSERT INTO orcamentos (id, tenant_id, obra_id, titulo, valor_total, itens_json, status, descricao, data_criacao, dados)
          VALUES (${o.id}, ${tenantId}, ${safeOrcObraId}, ${titulo}, ${valorTotal}, ${payloadJson}::jsonb, ${status}, ${descricao}, ${dataCriacao}, ${JSON.stringify(dadosExtras('orcamentos', o))}::jsonb)
          ON CONFLICT (id) DO UPDATE SET
            dados = COALESCE(orcamentos.dados, '{}'::jsonb) || EXCLUDED.dados,
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
        marcarDelta('orcamentos', o.id);
      } catch (err) {
        console.warn('[Sync All] Falha ao salvar orçamento:', err.message);
        recordFailure('orcamentos', o, err.message, 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 12. Medições
  if (Array.isArray(payload.medicoes)) {
    for (const m of payload.medicoes) {
      // Concorrência otimista (VARREDURA 2026-10-03 #4): não sobrescreve versão mais nova nem recria excluído.
      const conflito = await syncVersionConflict(sql, 'medicoes', tenantId, m, await versoesDe('medicoes'));
      if (conflito) { recordFailure('medicoes', m, conflito.error, 'SYNC_CONFLICT'); continue; }
      if (!m.id) continue;
      const safeMedObraId = await validateObraTenant(sql, m.obra_id, tenantId);
      // O formulário edita numero_medicao/data_medicao; numero/data vêm da leitura da nuvem e, antes,
      // tinham prioridade: a edição do número ou da data voltava ao valor antigo na sincronização.
      const numMed = parseInt(m.numero_medicao || m.numero) || 1;
      // Medição "não realizada" (data_medicao vazia) fica sem data, em vez de ganhar a data de hoje.
      const dataMed = ('data_medicao' in m) ? cleanDate(m.data_medicao) : (cleanDate(m.data) || todayBoaVista());
      const valMed = cleanNum(m.valor_medido || m.valor_solicitado);
      const rawItens = m.itens || (typeof m.itens_json === 'string' ? safeJsonParse(m.itens_json, []) : m.itens_json) || [];
      const itensJson = JSON.stringify(Array.isArray(rawItens) ? rawItens : []);
      const { payload: _payloadAnterior, ...mSemPayload } = m; // a leitura devolve `payload`: sem isso ele se aninhava a cada gravação
      const payloadJson = JSON.stringify(withoutSyncVersion(mSemPayload));

      try {
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
        marcarDelta('medicoes', m.id);
      } catch (err) {
        console.warn('[Sync All] Falha ao salvar medição:', err.message);
        recordFailure('medicoes', m, err.message, 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 13. Fases Documentais
  if (Array.isArray(payload.doc_fases)) {
    for (const d of payload.doc_fases) {
      const cloudId = String(d?.cloud_id || d?.id || '').trim();
      if (!validCloudId(cloudId, 180) || !d?.obra_id || !d?.doc_id) {
        recordFailure('doc_fases', d, 'Fase documental com identificadores incompletos.', 'INVALID_ID');
        continue;
      }
      const safeObraId = await validateObraTenant(sql, d.obra_id, tenantId);
      if (!safeObraId || ['escritorio', 'geral'].includes(safeObraId)) {
        recordFailure('doc_fases', d, 'A obra da fase documental não pertence ao tenant autenticado.', 'INVALID_TENANT_RELATION');
        continue;
      }
      const rawJson = JSON.stringify({ ...withoutSyncVersion(d), id: d.doc_id });
      try {
        await sql`
          INSERT INTO obra_doc_fases (tenant_id,id,obra_id,doc_id,fase_key,payload)
          VALUES (${tenantId},${cloudId},${safeObraId},${String(d.doc_id).slice(0, 100)},${d.fase_key || null},${rawJson}::jsonb)
          ON CONFLICT (tenant_id,id) DO UPDATE SET obra_id=EXCLUDED.obra_id,doc_id=EXCLUDED.doc_id,fase_key=EXCLUDED.fase_key,payload=EXCLUDED.payload,updated_at=NOW();
        `;
        totalCount++;
      } catch (err) {
        console.warn('[Sync All] Falha ao salvar fase documental:', err.message);
        recordFailure('doc_fases', d, err.message, 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 14. Documentos
  if (Array.isArray(payload.documentos)) {
    for (const doc of payload.documentos) {
      // Concorrência otimista (VARREDURA 2026-10-03 #4): não sobrescreve versão mais nova nem recria excluído.
      const conflito = await syncVersionConflict(sql, 'documentos', tenantId, doc, await versoesDe('documentos'));
      if (conflito) { recordFailure('documentos', doc, conflito.error, 'SYNC_CONFLICT'); continue; }
      if (!doc.id) continue;
      if (!isTenantStorageUrl(doc.url, tenantId)) {
        recordFailure('documentos', doc, 'URL de arquivo de outra empresa.', 'STORAGE_OWNERSHIP_DENIED');
        continue;
      }
      try {
        let cleanBase64 = doc.url ? null : (doc.data_base64 || doc.base64_data || null);
        // AUDITORIA 2026-10-04 #31: mesma política do /api/upload; arquivo recusado não é gravado.
        if (cleanBase64) {
          const validacao = validarArquivoBase64({ nomeArquivo: doc.nome_arquivo || doc.titulo, mime: doc.tipo_mime || doc.tipo_arquivo, base64: cleanBase64 });
          if (!validacao.ok) {
            console.warn('[Sync All] Arquivo do documento recusado:', doc.id, validacao.code);
            cleanBase64 = null;
          }
        }
        await sql`
          INSERT INTO documentos (
            id, tenant_id, tipo, referencia_id, titulo, categoria, nome_arquivo,
            tipo_arquivo, tamanho_bytes, url, base64_data, created_at, dados
          )
          VALUES (
            ${doc.id}, ${tenantId}, ${doc.entidade_tipo || doc.tipo || 'geral'}, ${doc.entidade_id || doc.referencia_id || ''},
            ${doc.titulo || doc.nome_arquivo || 'Documento'}, ${doc.categoria || ''}, ${doc.nome_arquivo || ''},
            ${doc.tipo_mime || doc.tipo_arquivo || 'application/octet-stream'}, ${cleanNum(doc.tamanho || doc.tamanho_bytes)},
            ${doc.url || null}, ${cleanBase64}, ${doc.criado_em || new Date().toISOString()},
            ${JSON.stringify(dadosExtras('documentos', doc))}::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            dados = COALESCE(documentos.dados, '{}'::jsonb) || EXCLUDED.dados,
            titulo = EXCLUDED.titulo,
            categoria = EXCLUDED.categoria,
            nome_arquivo = EXCLUDED.nome_arquivo,
            url = COALESCE(EXCLUDED.url, documentos.url),
            base64_data = CASE 
              WHEN COALESCE(EXCLUDED.url, documentos.url) IS NOT NULL THEN NULL
              ELSE EXCLUDED.base64_data
            END
          WHERE documentos.tenant_id = ${tenantId};
        `;
        totalCount++;
        marcarDelta('documentos', doc.id);
      } catch (err) {
        console.warn('[Sync All] Falha ao salvar documento:', err.message);
        recordFailure('documentos', doc, err.message, 'DATABASE_WRITE_FAILED');
      }
    }
  }

  // 15. Preferências do Tenant
  if (payload.preferencias && typeof payload.preferencias === 'object' && !Array.isArray(payload.preferencias)) {
    try {
      const safePrefs = sanitizeTenantPreferences(payload.preferencias);
      const prefJson = JSON.stringify(safePrefs);
      await sql`
        INSERT INTO tenant_preferences (tenant_id,preferences)
        VALUES (${tenantId},${prefJson}::jsonb)
        ON CONFLICT (tenant_id) DO UPDATE SET preferences=tenant_preferences.preferences || EXCLUDED.preferences,updated_at=NOW();
      `;
      totalCount++;
    } catch (err) {
      console.warn('[Sync All] Falha ao salvar preferências:', err.message);
      recordFailure('preferencias', { id: tenantId }, err.message, 'DATABASE_WRITE_FAILED');
    }
  }

  await writeAuditBatch(sql, req, auth, 'sincronizar_registro', tocadosDelta);

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
