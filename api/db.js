// api/db.js — API Serverless REST & Sincronização Multi-Tenant (Neon PostgreSQL)

import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';

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
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
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
  const auth = resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(401).json({
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

      if (!table || table === 'all') {
        const [obras, fornecedores, lancamentos, notas, orcamentos, medicoes, documentos, produtos, contas] = await Promise.all([
          sql`SELECT * FROM obras WHERE tenant_id = ${tenantId} ORDER BY nome ASC;`,
          sql`SELECT * FROM fornecedores WHERE tenant_id = ${tenantId} ORDER BY nome ASC;`,
          sql`SELECT * FROM lancamentos WHERE tenant_id = ${tenantId} ORDER BY data DESC, created_at DESC;`,
          sql`SELECT * FROM notas_fiscais WHERE tenant_id = ${tenantId} ORDER BY data_emissao DESC;`,
          sql`SELECT * FROM orcamentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC;`,
          sql`SELECT * FROM medicoes WHERE tenant_id = ${tenantId} ORDER BY data DESC;`,
          sql`SELECT id, tipo, referencia_id, titulo, categoria, nome_arquivo, tipo_arquivo, tamanho_bytes, url, created_at FROM documentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC;`,
          sql`SELECT * FROM produtos WHERE tenant_id = ${tenantId} ORDER BY nome ASC;`,
          sql`SELECT * FROM contas_bancarias WHERE tenant_id = ${tenantId} ORDER BY created_at ASC;`
        ]);

        return res.status(200).json({
          success: true,
          tenantId,
          data: {
            clientes: obras.map(o => ({
              ...o,
              data_inicio: cleanDate(o.data_inicio),
              data_previsao: cleanDate(o.data_previsao)
            })),
            fornecedores: fornecedores.map(f => ({
              ...f,
              cnpj: f.cnpj_cpf || f.cnpj || '',
              razao_social: f.razao_social || f.nome,
              nome_fantasia: f.nome,
              municipio: f.banco_info && f.banco_info.includes('/') ? f.banco_info.split(',').pop().split('/')[0].trim() : 'Boa Vista',
              uf: 'RR',
              ativo: true
            })),
            lancamentos: lancamentos.map(l => ({
              ...l,
              data: cleanDate(l.data) || new Date().toISOString().split('T')[0],
              data_vencimento: cleanDate(l.data_vencimento) || cleanDate(l.data),
              data_pagamento: cleanDate(l.data_pagamento),
              valor: cleanNum(l.valor),
              itens: Array.isArray(l.itens) ? l.itens : (typeof l.itens === 'string' ? JSON.parse(l.itens || '[]') : [])
            })),
            notas: notas.map(n => ({
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
              itens: Array.isArray(n.itens) ? n.itens : (typeof n.itens === 'string' ? JSON.parse(n.itens || '[]') : [])
            })),
            produtos: (produtos || []).map(p => ({
              ...p,
              valor_medio: cleanNum(p.valor_medio)
            })),
            orcamentos: orcamentos.map(o => ({
              ...o,
              itens: (typeof o.itens_json === 'string' ? JSON.parse(o.itens_json) : o.itens_json) || o.itens || []
            })),
            medicoes: medicoes.map(m => ({
              ...m,
              data: cleanDate(m.data),
              valor_medido: cleanNum(m.valor_medido),
              itens: (typeof m.itens_json === 'string' ? JSON.parse(m.itens_json) : m.itens_json) || m.itens || []
            })),
            documentos: documentos,
            contas: contas || []
          }
        });
      }

      if (table === 'lancamentos') {
        let items;
        if (obra_id) {
          items = await sql`SELECT * FROM lancamentos WHERE tenant_id = ${tenantId} AND obra_id = ${obra_id} ORDER BY data DESC;`;
        } else {
          items = await sql`SELECT * FROM lancamentos WHERE tenant_id = ${tenantId} ORDER BY data DESC;`;
        }
        return res.status(200).json({
          success: true,
          data: items.map(l => ({
            ...l,
            data: cleanDate(l.data) || new Date().toISOString().split('T')[0],
            data_vencimento: cleanDate(l.data_vencimento) || cleanDate(l.data),
            data_pagamento: cleanDate(l.data_pagamento),
            valor: cleanNum(l.valor)
          }))
        });
      }

      if (table === 'notas' || table === 'notas_fiscais') {
        let items;
        if (obra_id) {
          items = await sql`SELECT * FROM notas_fiscais WHERE tenant_id = ${tenantId} AND obra_id = ${obra_id} ORDER BY data_emissao DESC;`;
        } else {
          items = await sql`SELECT * FROM notas_fiscais WHERE tenant_id = ${tenantId} ORDER BY data_emissao DESC;`;
        }
        return res.status(200).json({
          success: true,
          data: items.map(n => ({
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
          }))
        });
      }

      if (table === 'obras' || table === 'clientes') {
        const items = await sql`SELECT * FROM obras WHERE tenant_id = ${tenantId} ORDER BY nome ASC;`;
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
        const items = await sql`SELECT id, tipo, referencia_id, titulo, categoria, nome_arquivo, tipo_arquivo, tamanho_bytes, url, created_at FROM documentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC;`;
        return res.status(200).json({ success: true, data: items });
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

      if (table === 'orcamentos') {
        const items = await sql`SELECT * FROM orcamentos WHERE tenant_id = ${tenantId} ORDER BY created_at DESC;`;
        return res.status(200).json({
          success: true,
          data: items.map(o => ({
            ...o,
            itens: (typeof o.itens_json === 'string' ? JSON.parse(o.itens_json) : o.itens_json) || o.itens || []
          }))
        });
      }

      if (table === 'medicoes') {
        const items = await sql`SELECT * FROM medicoes WHERE tenant_id = ${tenantId} ORDER BY data DESC;`;
        return res.status(200).json({
          success: true,
          data: items.map(m => ({
            ...m,
            data: cleanDate(m.data),
            valor_medido: cleanNum(m.valor_medido),
            itens: (typeof m.itens_json === 'string' ? JSON.parse(m.itens_json) : m.itens_json) || m.itens || []
          }))
        });
      }

      return res.status(200).json({ success: true, data: [], message: `Tabela '${table}' consultada.` });
    }

    // ── POST: Gravação / Atualização / Exclusão / Sync com Tenant Scoping ───────
    if (req.method === 'POST') {
      const { action, table, data, id, payload } = req.body || {};

      // 1. Sincronização em Massa (Local -> Neon com tenant_id)
      if (action === 'sync_all' && payload) {
        let totalCount = 0;

        // Obras
        if (Array.isArray(payload.clientes)) {
          for (const o of payload.clientes) {
            if (!o.id || !o.nome) continue;
            await sql`
              INSERT INTO obras (id, tenant_id, nome, cliente, endereco, orcamento_total, status, data_inicio, data_previsao)
              VALUES (
                ${o.id}, ${tenantId}, ${o.nome}, ${o.cliente || ''}, ${o.endereco || ''},
                ${cleanNum(o.orcamento_total || o.valor_contrato)}, ${o.status || 'em_andamento'},
                ${cleanDate(o.data_inicio)}, ${cleanDate(o.data_previsao)}
              )
              ON CONFLICT (id) DO UPDATE SET
                nome = EXCLUDED.nome,
                cliente = EXCLUDED.cliente,
                endereco = EXCLUDED.endereco,
                orcamento_total = EXCLUDED.orcamento_total,
                status = EXCLUDED.status
              WHERE obras.tenant_id = ${tenantId};
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
              INSERT INTO fornecedores (id, tenant_id, nome, razao_social, cnpj_cpf, telefone, email, categoria, chave_pix, banco_info)
              VALUES (
                ${f.id}, ${tenantId}, ${nomeFinal}, ${razaoSocialFinal}, ${cnpjCpfFinal},
                ${f.telefone || ''}, ${f.email || ''}, ${f.categoria || 'outros'}, ${f.chave_pix || ''}, ${f.banco_info || ''}
              )
              ON CONFLICT (id) DO UPDATE SET
                nome = EXCLUDED.nome,
                razao_social = EXCLUDED.razao_social,
                cnpj_cpf = EXCLUDED.cnpj_cpf,
                telefone = EXCLUDED.telefone
              WHERE fornecedores.tenant_id = ${tenantId};
            `;
            totalCount++;
          }
        }

        // Lançamentos
        if (Array.isArray(payload.lancamentos)) {
          for (const l of payload.lancamentos) {
            if (!l.id || !l.descricao) continue;
            const dataLanc = cleanDate(l.data) || new Date().toISOString().split('T')[0];
            const dataVenc = cleanDate(l.data_vencimento) || dataLanc;
            const dataPag = cleanDate(l.data_pagamento);
            const itensJson = JSON.stringify(Array.isArray(l.itens) ? l.itens : []);

            await sql`
              INSERT INTO lancamentos (
                id, tenant_id, data, data_vencimento, data_pagamento, descricao, categoria,
                fornecedor_beneficiario, conta_bancaria, tipo, valor, status,
                obra_id, nota_fiscal_id, codigo_barras, chave_nfe, observacoes, conciliado, itens
              )
              VALUES (
                ${l.id}, ${tenantId}, ${dataLanc}, ${dataVenc}, ${dataPag}, ${l.descricao}, ${l.categoria || 'Outros'},
                ${l.fornecedor_beneficiario || ''}, ${l.conta_bancaria || ''}, ${l.tipo || 'despesa'}, ${cleanNum(l.valor)}, ${l.status || 'pendente'},
                ${l.obra_id || null}, ${l.nota_fiscal_id || null}, ${l.codigo_barras || null}, ${l.chave_nfe || null}, ${l.observacoes || ''}, ${!!l.conciliado},
                ${itensJson}
              )
              ON CONFLICT (id) DO UPDATE SET
                data = EXCLUDED.data,
                data_vencimento = EXCLUDED.data_vencimento,
                data_pagamento = EXCLUDED.data_pagamento,
                descricao = EXCLUDED.descricao,
                valor = EXCLUDED.valor,
                status = EXCLUDED.status,
                codigo_barras = EXCLUDED.codigo_barras,
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
                ${n.lancamento_id || null}, ${n.observacoes || ''}, ${n.obra_id || null},
                ${itensNotaJson}
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

        return res.status(200).json({ success: true, synced: totalCount, message: 'Dados sincronizados com o Neon PostgreSQL!' });
      }

      // 2. Salvar Registro Individual (Upsert com tenant_id)
      if (action === 'save' && data) {
        if (table === 'lancamentos') {
          const l = data;
          const dataLanc = cleanDate(l.data) || new Date().toISOString().split('T')[0];
          const dataVenc = cleanDate(l.data_vencimento) || dataLanc;
          const dataPag = cleanDate(l.data_pagamento);

          await sql`
            INSERT INTO lancamentos (
              id, tenant_id, data, data_vencimento, data_pagamento, descricao, categoria,
              fornecedor_beneficiario, conta_bancaria, tipo, valor, status,
              obra_id, nota_fiscal_id, codigo_barras, chave_nfe, observacoes, conciliado
            )
            VALUES (
              ${l.id}, ${tenantId}, ${dataLanc}, ${dataVenc}, ${dataPag}, ${l.descricao}, ${l.categoria || 'Outros'},
              ${l.fornecedor_beneficiario || ''}, ${l.conta_bancaria || ''}, ${l.tipo || 'despesa'}, ${cleanNum(l.valor)}, ${l.status || 'pendente'},
              ${l.obra_id || null}, ${l.nota_fiscal_id || null}, ${l.codigo_barras || null}, ${l.chave_nfe || null}, ${l.observacoes || ''}, ${!!l.conciliado}
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
              conciliado = EXCLUDED.conciliado
            WHERE lancamentos.tenant_id = ${tenantId};
          `;
          return res.status(200).json({ success: true, id: l.id });
        }

        if (table === 'notas' || table === 'notas_fiscais') {
          const n = data;
          const vBruto = cleanNum(n.valor_bruto !== undefined ? n.valor_bruto : n.valor_total);
          const vImp = cleanNum(n.impostos);
          const vLiq = cleanNum(n.valor_liquido !== undefined ? n.valor_liquido : (vBruto - vImp));
          const vTot = cleanNum(n.valor_total !== undefined ? n.valor_total : vBruto);

          await sql`
            INSERT INTO notas_fiscais (
              id, tenant_id, numero_nf, serie, chave_acesso, chave_nfe, emitente, cnpj_emitente, destinatario,
              data_emissao, data_vencimento, data_pagamento, valor_bruto, impostos, valor_liquido, valor_total,
              tipo, categoria, status, lancamento_id, observacoes, obra_id
            )
            VALUES (
              ${n.id}, ${tenantId}, ${n.numero_nf || ''}, ${n.serie || ''}, ${n.chave_nfe || n.chave_acesso || null}, ${n.chave_nfe || n.chave_acesso || ''},
              ${n.emitente || ''}, ${n.cnpj_emitente || ''}, ${n.destinatario || ''},
              ${cleanDate(n.data_emissao)}, ${cleanDate(n.data_vencimento)}, ${cleanDate(n.data_pagamento)},
              ${vBruto}, ${vImp}, ${vLiq}, ${vTot},
              ${n.tipo || 'entrada'}, ${n.categoria || 'material'}, ${n.status || 'paga'},
              ${n.lancamento_id || null}, ${n.observacoes || ''}, ${n.obra_id || null}
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
              obra_id = EXCLUDED.obra_id
            WHERE notas_fiscais.tenant_id = ${tenantId};
          `;
          return res.status(200).json({ success: true, id: n.id });
        }

        if (table === 'obras' || table === 'clientes') {
          const o = data;
          await sql`
            INSERT INTO obras (id, tenant_id, nome, cliente, endereco, orcamento_total, status, data_inicio, data_previsao)
            VALUES (
              ${o.id}, ${tenantId}, ${o.nome}, ${o.cliente || ''}, ${o.endereco || ''},
              ${cleanNum(o.orcamento_total || o.valor_contrato)}, ${o.status || 'em_andamento'},
              ${cleanDate(o.data_inicio)}, ${cleanDate(o.data_previsao)}
            )
            ON CONFLICT (id) DO UPDATE SET
              nome = EXCLUDED.nome,
              cliente = EXCLUDED.cliente,
              endereco = EXCLUDED.endereco,
              orcamento_total = EXCLUDED.orcamento_total,
              status = EXCLUDED.status
            WHERE obras.tenant_id = ${tenantId};
          `;
          return res.status(200).json({ success: true, id: o.id });
        }

        if (table === 'fornecedores') {
          const f = data;
          const nomeFinal = (f.nome || f.nome_fantasia || f.razao_social || f.razao || 'Fornecedor').trim();
          const razaoSocialFinal = (f.razao_social || f.nome_fantasia || f.nome || nomeFinal).trim();
          const cnpjCpfFinal = (f.cnpj_cpf || f.cnpj || f.cpf || '').replace(/\D/g, '');

          await sql`
            INSERT INTO fornecedores (id, tenant_id, nome, razao_social, cnpj_cpf, telefone, email, categoria, chave_pix, banco_info)
            VALUES (
              ${f.id}, ${tenantId}, ${nomeFinal}, ${razaoSocialFinal}, ${cnpjCpfFinal},
              ${f.telefone || ''}, ${f.email || ''}, ${f.categoria || 'outros'}, ${f.chave_pix || ''}, ${f.banco_info || ''}
            )
            ON CONFLICT (id) DO UPDATE SET
              nome = EXCLUDED.nome,
              razao_social = EXCLUDED.razao_social,
              cnpj_cpf = EXCLUDED.cnpj_cpf,
              telefone = EXCLUDED.telefone,
              email = EXCLUDED.email,
              categoria = EXCLUDED.categoria,
              chave_pix = EXCLUDED.chave_pix,
              banco_info = EXCLUDED.banco_info
            WHERE fornecedores.tenant_id = ${tenantId};
          `;
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
          return res.status(200).json({ success: true, id: p.id });
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
          return res.status(200).json({ success: true, id: c.id });
        }

        if (table === 'orcamentos') {
          const o = data;
          const itensJson = JSON.stringify(Array.isArray(o.itens) ? o.itens : (Array.isArray(o.itens_json) ? o.itens_json : []));
          await sql`
            INSERT INTO orcamentos (id, tenant_id, obra_id, titulo, valor_total, itens_json)
            VALUES (
              ${o.id}, ${tenantId}, ${o.obra_id || null}, ${o.titulo || ''},
              ${cleanNum(o.valor_total)}, ${itensJson}
            )
            ON CONFLICT (id) DO UPDATE SET
              obra_id = EXCLUDED.obra_id,
              titulo = EXCLUDED.titulo,
              valor_total = EXCLUDED.valor_total,
              itens_json = EXCLUDED.itens_json
            WHERE orcamentos.tenant_id = ${tenantId};
          `;
          return res.status(200).json({ success: true, id: o.id });
        }

        if (table === 'medicoes') {
          const m = data;
          await sql`
            INSERT INTO medicoes (id, tenant_id, obra_id, numero, data, valor_medido, status, observacoes)
            VALUES (
              ${m.id}, ${tenantId}, ${m.obra_id || null}, ${m.numero || 1},
              ${cleanDate(m.data) || new Date().toISOString().split('T')[0]},
              ${cleanNum(m.valor_medido)}, ${m.status || 'aprovada'}, ${m.observacoes || ''}
            )
            ON CONFLICT (id) DO UPDATE SET
              obra_id = EXCLUDED.obra_id,
              numero = EXCLUDED.numero,
              data = EXCLUDED.data,
              valor_medido = EXCLUDED.valor_medido,
              status = EXCLUDED.status,
              observacoes = EXCLUDED.observacoes
            WHERE medicoes.tenant_id = ${tenantId};
          `;
          return res.status(200).json({ success: true, id: m.id });
        }
      }

      // 3. Excluir Registro Individual (Estritamente com tenant_id)
      if (action === 'delete' && id) {
        if (table === 'lancamentos') {
          await sql`DELETE FROM lancamentos WHERE id = ${id} AND tenant_id = ${tenantId};`;
          return res.status(200).json({ success: true, id });
        }
        if (table === 'notas' || table === 'notas_fiscais') {
          await sql`DELETE FROM notas_fiscais WHERE id = ${id} AND tenant_id = ${tenantId};`;
          return res.status(200).json({ success: true, id });
        }
        if (table === 'obras' || table === 'clientes') {
          await sql`DELETE FROM obras WHERE id = ${id} AND tenant_id = ${tenantId};`;
          return res.status(200).json({ success: true, id });
        }
        if (table === 'fornecedores') {
          await sql`DELETE FROM fornecedores WHERE id = ${id} AND tenant_id = ${tenantId};`;
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
          return res.status(200).json({ success: true, id });
        }
        if (table === 'produtos') {
          await sql`DELETE FROM produtos WHERE id = ${id} AND tenant_id = ${tenantId};`;
          return res.status(200).json({ success: true, id });
        }
        if (table === 'ocr_historico') {
          if (id === 'all') {
            await sql`DELETE FROM ocr_historico WHERE tenant_id = ${tenantId};`;
          } else {
            await sql`DELETE FROM ocr_historico WHERE id = ${id} AND tenant_id = ${tenantId};`;
          }
          return res.status(200).json({ success: true, id });
        }
        if (table === 'contas' || table === 'contas_bancarias') {
          await sql`DELETE FROM contas_bancarias WHERE id = ${id} AND tenant_id = ${tenantId};`;
          return res.status(200).json({ success: true, id });
        }
        if (table === 'orcamentos') {
          await sql`DELETE FROM orcamentos WHERE id = ${id} AND tenant_id = ${tenantId};`;
          return res.status(200).json({ success: true, id });
        }
        if (table === 'medicoes') {
          await sql`DELETE FROM medicoes WHERE id = ${id} AND tenant_id = ${tenantId};`;
          return res.status(200).json({ success: true, id });
        }
      }

      return res.status(200).json({ success: true, message: `Operação para tabela '${table}' registrada.` });
    }

    return res.status(405).json({ error: 'Método não suportado' });
  } catch (err) {
    console.error('Erro na API Neon DB:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
