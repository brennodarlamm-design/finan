// api/db.js — API Serverless REST & Sincronização em Nuvem (Neon PostgreSQL)

import { neon } from '@neondatabase/serverless';

function getSql() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    throw new Error('Variável de ambiente DATABASE_URL não configurada.');
  }
  return neon(conn);
}

function cleanDate(d) {
  if (!d || typeof d !== 'string' || d.trim() === '' || d === '—' || d === '-') return null;
  const match = d.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  return null;
}

function cleanNum(n) {
  const val = Number(n);
  return isNaN(val) ? 0 : val;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sql = getSql();

  try {
    // ── GET: Consultar dados ───────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { table, obra_id } = req.query;

      if (!table || table === 'all') {
        const [obras, fornecedores, lancamentos, notas, orcamentos, medicoes, documentos] = await Promise.all([
          sql`SELECT * FROM obras ORDER BY nome ASC;`,
          sql`SELECT * FROM fornecedores ORDER BY nome ASC;`,
          sql`SELECT * FROM lancamentos ORDER BY data DESC, created_at DESC;`,
          sql`SELECT * FROM notas_fiscais ORDER BY data_emissao DESC;`,
          sql`SELECT * FROM orcamentos ORDER BY created_at DESC;`,
          sql`SELECT * FROM medicoes ORDER BY data DESC;`,
          sql`SELECT id, tipo, referencia_id, titulo, categoria, nome_arquivo, tipo_arquivo, tamanho_bytes, created_at FROM documentos ORDER BY created_at DESC;`
        ]);

        return res.status(200).json({
          success: true,
          data: {
            clientes: obras,
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
              valor: Number(l.valor) || 0
            })),
            notas: notas.map(n => ({
              ...n,
              valor_total: Number(n.valor_total) || 0
            })),
            orcamentos: orcamentos,
            medicoes: medicoes,
            documentos: documentos
          }
        });
      }

      if (table === 'lancamentos') {
        let items;
        if (obra_id) {
          items = await sql`SELECT * FROM lancamentos WHERE obra_id = ${obra_id} ORDER BY data DESC;`;
        } else {
          items = await sql`SELECT * FROM lancamentos ORDER BY data DESC;`;
        }
        return res.status(200).json({ success: true, data: items });
      }

      if (table === 'obras' || table === 'clientes') {
        const items = await sql`SELECT * FROM obras ORDER BY nome ASC;`;
        return res.status(200).json({ success: true, data: items });
      }

      if (table === 'fornecedores') {
        const items = await sql`SELECT * FROM fornecedores ORDER BY nome ASC;`;
        return res.status(200).json({ success: true, data: items });
      }

      return res.status(400).json({ error: 'Tabela desconhecida' });
    }

    // ── POST: Gravação / Atualização / Exclusão / Sync ────────────────────────
    if (req.method === 'POST') {
      const { action, table, data, id, payload } = req.body || {};

      // 1. Sincronização em Massa (Local -> Neon)
      if (action === 'sync_all' && payload) {
        let totalCount = 0;

        // Obras
        if (Array.isArray(payload.clientes)) {
          for (const o of payload.clientes) {
            if (!o.id || !o.nome) continue;
            await sql`
              INSERT INTO obras (id, nome, cliente, endereco, orcamento_total, status, data_inicio, data_previsao)
              VALUES (
                ${o.id}, ${o.nome}, ${o.cliente || ''}, ${o.endereco || ''},
                ${cleanNum(o.orcamento_total || o.valor_contrato)}, ${o.status || 'em_andamento'},
                ${cleanDate(o.data_inicio)}, ${cleanDate(o.data_previsao)}
              )
              ON CONFLICT (id) DO UPDATE SET
                nome = EXCLUDED.nome,
                cliente = EXCLUDED.cliente,
                endereco = EXCLUDED.endereco,
                orcamento_total = EXCLUDED.orcamento_total,
                status = EXCLUDED.status;
            `;
            totalCount++;
          }
        }

        // Fornecedores
        if (Array.isArray(payload.fornecedores)) {
          for (const f of payload.fornecedores) {
            if (!f.id || !f.nome) continue;
            await sql`
              INSERT INTO fornecedores (id, nome, razao_social, cnpj_cpf, telefone, email, categoria, chave_pix, banco_info)
              VALUES (
                ${f.id}, ${f.nome}, ${f.razao_social || f.nome}, ${f.cnpj_cpf || f.cnpj || ''},
                ${f.telefone || ''}, ${f.email || ''}, ${f.categoria || ''}, ${f.chave_pix || ''}, ${f.banco_info || ''}
              )
              ON CONFLICT (id) DO UPDATE SET
                nome = EXCLUDED.nome,
                razao_social = EXCLUDED.razao_social,
                cnpj_cpf = EXCLUDED.cnpj_cpf,
                telefone = EXCLUDED.telefone;
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

            await sql`
              INSERT INTO lancamentos (
                id, data, data_vencimento, data_pagamento, descricao, categoria,
                fornecedor_beneficiario, conta_bancaria, tipo, valor, status,
                obra_id, nota_fiscal_id, codigo_barras, chave_nfe, observacoes, conciliado
              )
              VALUES (
                ${l.id}, ${dataLanc}, ${dataVenc}, ${dataPag}, ${l.descricao}, ${l.categoria || 'Outros'},
                ${l.fornecedor_beneficiario || ''}, ${l.conta_bancaria || ''}, ${l.tipo || 'despesa'}, ${cleanNum(l.valor)}, ${l.status || 'pendente'},
                ${l.obra_id || null}, ${l.nota_fiscal_id || null}, ${l.codigo_barras || null}, ${l.chave_nfe || null}, ${l.observacoes || ''}, ${!!l.conciliado}
              )
              ON CONFLICT (id) DO UPDATE SET
                data = EXCLUDED.data,
                data_vencimento = EXCLUDED.data_vencimento,
                data_pagamento = EXCLUDED.data_pagamento,
                descricao = EXCLUDED.descricao,
                valor = EXCLUDED.valor,
                status = EXCLUDED.status,
                codigo_barras = EXCLUDED.codigo_barras,
                conciliado = EXCLUDED.conciliado;
            `;
            totalCount++;
          }
        }

        return res.status(200).json({ success: true, synced: totalCount, message: 'Dados sincronizados com o Neon PostgreSQL!' });
      }

      // 2. Salvar Registro Individual (Upsert)
      if (action === 'save' && data) {
        if (table === 'lancamentos') {
          const l = data;
          const dataLanc = cleanDate(l.data) || new Date().toISOString().split('T')[0];
          const dataVenc = cleanDate(l.data_vencimento) || dataLanc;
          const dataPag = cleanDate(l.data_pagamento);

          await sql`
            INSERT INTO lancamentos (
              id, data, data_vencimento, data_pagamento, descricao, categoria,
              fornecedor_beneficiario, conta_bancaria, tipo, valor, status,
              obra_id, nota_fiscal_id, codigo_barras, chave_nfe, observacoes, conciliado
            )
            VALUES (
              ${l.id}, ${dataLanc}, ${dataVenc}, ${dataPag}, ${l.descricao}, ${l.categoria || 'Outros'},
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
              conciliado = EXCLUDED.conciliado;
          `;
          return res.status(200).json({ success: true, id: l.id });
        }

        if (table === 'obras' || table === 'clientes') {
          const o = data;
          await sql`
            INSERT INTO obras (id, nome, cliente, endereco, orcamento_total, status, data_inicio, data_previsao)
            VALUES (
              ${o.id}, ${o.nome}, ${o.cliente || ''}, ${o.endereco || ''},
              ${cleanNum(o.orcamento_total || o.valor_contrato)}, ${o.status || 'em_andamento'},
              ${cleanDate(o.data_inicio)}, ${cleanDate(o.data_previsao)}
            )
            ON CONFLICT (id) DO UPDATE SET
              nome = EXCLUDED.nome,
              cliente = EXCLUDED.cliente,
              endereco = EXCLUDED.endereco,
              orcamento_total = EXCLUDED.orcamento_total,
              status = EXCLUDED.status;
          `;
          return res.status(200).json({ success: true, id: o.id });
        }

        if (table === 'fornecedores') {
          const f = data;
          await sql`
            INSERT INTO fornecedores (id, nome, razao_social, cnpj_cpf, telefone, email, categoria, chave_pix, banco_info)
            VALUES (
              ${f.id}, ${f.nome}, ${f.razao_social || f.nome}, ${f.cnpj_cpf || f.cnpj || ''},
              ${f.telefone || ''}, ${f.email || ''}, ${f.categoria || ''}, ${f.chave_pix || ''}, ${f.banco_info || ''}
            )
            ON CONFLICT (id) DO UPDATE SET
              nome = EXCLUDED.nome,
              razao_social = EXCLUDED.razao_social,
              cnpj_cpf = EXCLUDED.cnpj_cpf,
              telefone = EXCLUDED.telefone,
              email = EXCLUDED.email,
              categoria = EXCLUDED.categoria,
              chave_pix = EXCLUDED.chave_pix,
              banco_info = EXCLUDED.banco_info;
          `;
          return res.status(200).json({ success: true, id: f.id });
        }
      }

      // 3. Excluir Registro Individual
      if (action === 'delete' && id) {
        if (table === 'lancamentos') {
          await sql`DELETE FROM lancamentos WHERE id = ${id};`;
          return res.status(200).json({ success: true, id });
        }
        if (table === 'obras' || table === 'clientes') {
          await sql`DELETE FROM obras WHERE id = ${id};`;
          return res.status(200).json({ success: true, id });
        }
        if (table === 'fornecedores') {
          await sql`DELETE FROM fornecedores WHERE id = ${id};`;
          return res.status(200).json({ success: true, id });
        }
      }

      return res.status(400).json({ error: 'Ação inválida' });
    }

    return res.status(405).json({ error: 'Método não suportado' });
  } catch (err) {
    console.error('Erro na API Neon DB:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
