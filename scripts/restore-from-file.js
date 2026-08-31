// scripts/restore-from-file.js — Restaura arquivo de backup JSON diretamente no Neon PostgreSQL

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const sql = neon(connectionString);

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

async function main() {
  const backupPaths = [
    'D:/angelim_backup_2026-08-31.json',
    'd:/angelim_backup_2026-08-31.json',
    'D:\\angelim_backup_2026-08-31.json',
    './angelim_backup_2026-08-31.json'
  ];

  let backupFile = null;
  for (const p of backupPaths) {
    if (fs.existsSync(p)) {
      backupFile = p;
      break;
    }
  }

  if (!backupFile) {
    console.error('Arquivo de backup não encontrado nos caminhos testados.');
    process.exit(1);
  }

  console.log(`Lendo arquivo de backup: ${backupFile}...`);
  const rawData = fs.readFileSync(backupFile, 'utf8');
  const backup = JSON.parse(rawData);

  console.log('Iniciando restauração no Neon PostgreSQL...');

  // 1. Obras (Clientes)
  let countObras = 0;
  if (Array.isArray(backup.clientes)) {
    for (const o of backup.clientes) {
      if (!o.id || !o.nome) continue;
      await sql`
        INSERT INTO obras (id, nome, cliente, endereco, orcamento_total, status, data_inicio, data_previsao)
        VALUES (
          ${o.id}, ${o.nome}, ${o.cliente || o.nome}, ${o.endereco || ''},
          ${cleanNum(o.orcamento_total || o.valor_financiado || o.valor_contrato)}, ${o.status || 'em_andamento'},
          ${cleanDate(o.data_inicio)}, ${cleanDate(o.data_previsao_termino || o.data_previsao)}
        )
        ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          cliente = EXCLUDED.cliente,
          endereco = EXCLUDED.endereco,
          orcamento_total = EXCLUDED.orcamento_total,
          status = EXCLUDED.status;
      `;
      countObras++;
    }
  }

  // 2. Fornecedores
  let countForn = 0;
  if (Array.isArray(backup.fornecedores)) {
    for (const f of backup.fornecedores) {
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
      countForn++;
    }
  }

  // 3. Notas Fiscais
  let countNotas = 0;
  if (Array.isArray(backup.notas)) {
    for (const n of backup.notas) {
      if (!n.id) continue;
      await sql`
        INSERT INTO notas_fiscais (id, numero_nf, serie, chave_acesso, emitente, cnpj_emitente, valor_total, data_emissao, obra_id, status, pdf_url, xml_data)
        VALUES (
          ${n.id}, ${n.numero_nf || n.numero || ''}, ${n.serie || ''}, ${n.chave_acesso || n.chave || null},
          ${n.emitente || n.razao_social || ''}, ${n.cnpj_emitente || n.cnpj || ''},
          ${cleanNum(n.valor_total || n.valor_bruto || n.valor)}, ${cleanDate(n.data_emissao || n.data)},
          ${n.obra_id || null}, ${n.status || 'ativo'}, ${n.pdf_url || null}, ${n.xml_content || n.xml || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          valor_total = EXCLUDED.valor_total,
          status = EXCLUDED.status;
      `;
      countNotas++;
    }
  }

  // 4. Lançamentos Financeiros
  let countLans = 0;
  if (Array.isArray(backup.lancamentos)) {
    for (const l of backup.lancamentos) {
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
      countLans++;
    }
  }

  // 5. Documentos e Comprovantes
  let countDocs = 0;
  if (Array.isArray(backup.documentos)) {
    for (const d of backup.documentos) {
      if (!d.id) continue;
      await sql`
        INSERT INTO documentos (id, tipo, referencia_id, titulo, categoria, nome_arquivo, tipo_arquivo, tamanho_bytes, base64_data)
        VALUES (
          ${d.id}, ${d.tipo || 'comprovante'}, ${d.referencia_id || d.lancamento_id || ''}, ${d.titulo || d.nome || 'Documento'},
          ${d.categoria || ''}, ${d.nome_arquivo || ''}, ${d.tipo_arquivo || ''}, ${cleanNum(d.tamanho_bytes || d.tamanho)}, ${d.base64_data || d.base64 || null}
        )
        ON CONFLICT (id) DO NOTHING;
      `;
      countDocs++;
    }
  }

  console.log('\n======================================================');
  console.log('🎉 BACKUP RESTAURADO COM SUCESSO NO NEON POSTGRESQL!');
  console.log(`  - 👥 Obras restauradas: ${countObras}`);
  console.log(`  - 🏗️ Fornecedores restaurados: ${countForn}`);
  console.log(`  - 💰 Lançamentos restaurados: ${countLans}`);
  console.log(`  - 🧾 Notas Fiscais restauradas: ${countNotas}`);
  console.log(`  - 📎 Documentos restaurados: ${countDocs}`);
  console.log('======================================================\n');
}

main().catch(console.error);
