// scripts/restore-all-business-data.mjs
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const ownerUrl = process.env.DATABASE_OWNER_URL;
if (!ownerUrl) {
  console.error('❌ DATABASE_OWNER_URL não configurado.');
  process.exit(1);
}

const sql = neon(ownerUrl);

function cleanVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function restoreAngelim() {
  const jsonPath = path.resolve('scratch/angelim_complete_restoration.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error('Arquivo scratch/angelim_complete_restoration.json não encontrado.');
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`🚀 Iniciando restauração total de dados para o tenant: ${data.tenant_id}`);

  // 1. Contas Bancárias
  console.log(`\n🏦 Restaurando ${data.contas.length} contas bancárias...`);
  for (const c of data.contas) {
    await sql(`
      INSERT INTO contas_bancarias (id, tenant_id, banco_codigo, banco_nome, agencia, numero, tipo, titular, apelido, saldo_inicial, saldo_atual)
      VALUES (${cleanVal(c.id)}, ${cleanVal(c.tenant_id)}, ${cleanVal(c.banco_codigo)}, ${cleanVal(c.banco_nome)}, ${cleanVal(c.agencia)}, ${cleanVal(c.numero)}, ${cleanVal(c.tipo)}, ${cleanVal(c.titular)}, ${cleanVal(c.apelido)}, ${cleanVal(c.saldo_inicial)}, ${cleanVal(c.saldo_atual)})
      ON CONFLICT (id) DO UPDATE SET
        banco_codigo = EXCLUDED.banco_codigo,
        banco_nome = EXCLUDED.banco_nome,
        agencia = EXCLUDED.agencia,
        numero = EXCLUDED.numero,
        titular = EXCLUDED.titular,
        apelido = EXCLUDED.apelido,
        updated_at = NOW();
    `);
  }
  console.log(`✓ Contas bancárias restauradas.`);

  // 2. Obras
  console.log(`\n🏗️ Restaurando ${data.obras.length} obras/clientes...`);
  for (const o of data.obras) {
    await sql(`
      INSERT INTO obras (id, tenant_id, nome, cliente, endereco, orcamento_total, status, data_inicio, data_previsao)
      VALUES (${cleanVal(o.id)}, ${cleanVal(o.tenant_id)}, ${cleanVal(o.nome)}, ${cleanVal(o.cliente)}, ${cleanVal(o.endereco)}, ${cleanVal(o.orcamento_total)}, ${cleanVal(o.status)}, ${cleanVal(o.data_inicio)}, ${cleanVal(o.data_previsao)})
      ON CONFLICT (tenant_id, id) DO UPDATE SET
        nome = EXCLUDED.nome,
        cliente = EXCLUDED.cliente,
        endereco = EXCLUDED.endereco,
        orcamento_total = EXCLUDED.orcamento_total,
        status = EXCLUDED.status,
        data_inicio = EXCLUDED.data_inicio,
        data_previsao = EXCLUDED.data_previsao;
    `);
  }
  console.log(`✓ Obras restauradas.`);

  // 3. Fornecedores
  console.log(`\n🤝 Restaurando ${data.fornecedores.length} fornecedores...`);
  // Inserção em lotes de 20
  for (let i = 0; i < data.fornecedores.length; i += 20) {
    const batch = data.fornecedores.slice(i, i + 20);
    for (const f of batch) {
      await sql(`
        INSERT INTO fornecedores (id, tenant_id, nome, razao_social, cnpj_cpf, telefone, email, categoria, chave_pix, banco_info, endereco, municipio, uf, ativo)
        VALUES (${cleanVal(f.id)}, ${cleanVal(f.tenant_id)}, ${cleanVal(f.nome)}, ${cleanVal(f.razao_social)}, ${cleanVal(f.cnpj_cpf)}, ${cleanVal(f.telefone)}, ${cleanVal(f.email)}, ${cleanVal(f.categoria)}, ${cleanVal(f.chave_pix)}, ${cleanVal(f.banco_info)}, ${cleanVal(f.endereco)}, ${cleanVal(f.municipio)}, ${cleanVal(f.uf)}, ${cleanVal(f.ativo)})
        ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          razao_social = EXCLUDED.razao_social,
          cnpj_cpf = EXCLUDED.cnpj_cpf,
          telefone = EXCLUDED.telefone,
          email = EXCLUDED.email,
          categoria = EXCLUDED.categoria,
          endereco = EXCLUDED.endereco,
          municipio = EXCLUDED.municipio,
          uf = EXCLUDED.uf,
          ativo = EXCLUDED.ativo;
      `);
    }
  }
  console.log(`✓ Fornecedores restaurados.`);

  // 4. Notas Fiscais
  console.log(`\n🧾 Restaurando ${data.notas.length} notas fiscais...`);
  for (const n of data.notas) {
    await sql(`
      INSERT INTO notas_fiscais (id, tenant_id, numero_nf, serie, chave_acesso, chave_nfe, emitente, cnpj_emitente, destinatario, data_emissao, data_vencimento, data_pagamento, valor_bruto, impostos, valor_liquido, valor_total, tipo, categoria, obra_id, status, observacoes, pdf_url, xml_data)
      VALUES (${cleanVal(n.id)}, ${cleanVal(n.tenant_id)}, ${cleanVal(n.numero_nf)}, ${cleanVal(n.serie)}, ${cleanVal(n.chave_acesso)}, ${cleanVal(n.chave_nfe)}, ${cleanVal(n.emitente)}, ${cleanVal(n.cnpj_emitente)}, ${cleanVal(n.destinatario)}, ${cleanVal(n.data_emissao)}, ${cleanVal(n.data_vencimento)}, ${cleanVal(n.data_pagamento)}, ${cleanVal(n.valor_bruto)}, ${cleanVal(n.impostos)}, ${cleanVal(n.valor_liquido)}, ${cleanVal(n.valor_total)}, ${cleanVal(n.tipo)}, ${cleanVal(n.categoria)}, ${cleanVal(n.obra_id)}, ${cleanVal(n.status)}, ${cleanVal(n.observacoes)}, ${cleanVal(n.pdf_url)}, ${cleanVal(n.xml_data)})
      ON CONFLICT (id) DO UPDATE SET
        valor_total = EXCLUDED.valor_total,
        status = EXCLUDED.status;
    `);
  }
  console.log(`✓ Notas fiscais restauradas.`);

  // 5. Documentos
  console.log(`\n📎 Restaurando ${data.documentos.length} documentos anexos...`);
  for (const d of data.documentos) {
    await sql(`
      INSERT INTO documentos (id, tenant_id, tipo, referencia_id, titulo, categoria, nome_arquivo, tipo_arquivo, tamanho_bytes, base64_data, url)
      VALUES (${cleanVal(d.id)}, ${cleanVal(d.tenant_id)}, ${cleanVal(d.tipo)}, ${cleanVal(d.referencia_id)}, ${cleanVal(d.titulo)}, ${cleanVal(d.categoria)}, ${cleanVal(d.nome_arquivo)}, ${cleanVal(d.tipo_arquivo)}, ${cleanVal(d.tamanho_bytes)}, ${cleanVal(d.base64_data)}, ${cleanVal(d.url)})
      ON CONFLICT (id) DO NOTHING;
    `);
  }
  console.log(`✓ Documentos restaurados.`);

  // 6. Lançamentos
  console.log(`\n💰 Restaurando ${data.lancamentos.length} lançamentos financeiros...`);
  for (let i = 0; i < data.lancamentos.length; i += 25) {
    const batch = data.lancamentos.slice(i, i + 25);
    for (const l of batch) {
      await sql(`
        INSERT INTO lancamentos (
          id, tenant_id, data, data_vencimento, data_pagamento, descricao, categoria,
          fornecedor_beneficiario, fornecedor_id, conta_bancaria, tipo, valor, status,
          obra_id, nota_fiscal_id, codigo_barras, chave_nfe, observacoes, conciliado, itens
        )
        VALUES (
          ${cleanVal(l.id)}, ${cleanVal(l.tenant_id)}, ${cleanVal(l.data)}, ${cleanVal(l.data_vencimento)}, ${cleanVal(l.data_pagamento)},
          ${cleanVal(l.descricao)}, ${cleanVal(l.categoria)}, ${cleanVal(l.fornecedor_beneficiario)}, ${cleanVal(l.fornecedor_id)},
          ${cleanVal(l.conta_bancaria)}, ${cleanVal(l.tipo)}, ${cleanVal(l.valor)}, ${cleanVal(l.status)},
          ${cleanVal(l.obra_id)}, ${cleanVal(l.nota_fiscal_id)}, ${cleanVal(l.codigo_barras)}, ${cleanVal(l.chave_nfe)},
          ${cleanVal(l.observacoes)}, ${cleanVal(l.conciliado)}, ${cleanVal(l.itens)}
        )
        ON CONFLICT (id) DO UPDATE SET
          data = EXCLUDED.data,
          data_vencimento = EXCLUDED.data_vencimento,
          data_pagamento = EXCLUDED.data_pagamento,
          descricao = EXCLUDED.descricao,
          categoria = EXCLUDED.categoria,
          fornecedor_beneficiario = EXCLUDED.fornecedor_beneficiario,
          fornecedor_id = EXCLUDED.fornecedor_id,
          conta_bancaria = EXCLUDED.conta_bancaria,
          tipo = EXCLUDED.tipo,
          valor = EXCLUDED.valor,
          status = EXCLUDED.status,
          obra_id = EXCLUDED.obra_id,
          codigo_barras = EXCLUDED.codigo_barras,
          chave_nfe = EXCLUDED.chave_nfe,
          observacoes = EXCLUDED.observacoes,
          conciliado = EXCLUDED.conciliado;
      `);
    }
    process.stdout.write(`   Lote ${Math.floor(i / 25) + 1}/${Math.ceil(data.lancamentos.length / 25)} inserido...\r`);
  }
  console.log(`\n✓ Todos os ${data.lancamentos.length} lançamentos restaurados com sucesso!`);
}

async function restoreDemoConstrutora() {
  console.log('\n--- Populando Dados Demo para demo_construtora ---');
  const obras = [
    { id: 'escritorio', nome: '🏢 Sede / Escritório Central', cliente: 'Alpha Engenharia & Construções', endereco: 'Sorocaba - SP', orcamento_total: 0, status: 'em_andamento', data_inicio: '2025-01-01', data_previsao: null },
    { id: 'cli_001', nome: 'João Carlos Ferreira', cliente: 'João Carlos Ferreira', endereco: 'Rua das Acácias, 120, Jd. Paraíso, Sorocaba - SP', orcamento_total: 320000, status: 'em_andamento', data_inicio: '2026-01-10', data_previsao: '2026-12-10' },
    { id: 'cli_002', nome: 'Maria Aparecida Santos', cliente: 'Maria Aparecida Santos', endereco: 'Av. Brasil, 450, Vila São Bento, Campinas - SP', orcamento_total: 215000, status: 'em_andamento', data_inicio: '2026-02-15', data_previsao: '2026-11-15' },
    { id: 'cli_003', nome: 'Roberto Silva Lima', cliente: 'Roberto Silva Lima', endereco: 'Rua das Flores, 78, Jd. Bonfiglioli, Jundiaí - SP', orcamento_total: 400000, status: 'concluida', data_inicio: '2025-06-01', data_previsao: '2026-06-30' }
  ];

  for (const o of obras) {
    await sql(`
      INSERT INTO obras (id, tenant_id, nome, cliente, endereco, orcamento_total, status, data_inicio, data_previsao)
      VALUES (${cleanVal(o.id)}, 'demo_construtora', ${cleanVal(o.nome)}, ${cleanVal(o.cliente)}, ${cleanVal(o.endereco)}, ${cleanVal(o.orcamento_total)}, ${cleanVal(o.status)}, ${cleanVal(o.data_inicio)}, ${cleanVal(o.data_previsao)})
      ON CONFLICT (tenant_id, id) DO NOTHING;
    `);
  }

  const fornecedores = [
    { id: 'forn_demo_001', nome: 'Madeireira Central Ltda', razao_social: 'Madeireira Central Ltda', cnpj_cpf: '67.890.123/0001-45', telefone: '(15) 99888-7766', email: 'vendas@madeireiracentral.com.br', categoria: 'Madeiras e Esquadrias' },
    { id: 'forn_demo_002', nome: 'Votorantim Cimentos S.A.', razao_social: 'Votorantim Cimentos S.A.', cnpj_cpf: '01.234.567/0001-89', telefone: '0800 701 9898', email: 'contato@votorantim.com.br', categoria: 'Cimento e Concreto' },
    { id: 'forn_demo_003', nome: 'Cerâmica Vale Verde', razao_social: 'Cerâmica Vale Verde ME', cnpj_cpf: '23.456.789/0001-12', telefone: '(15) 3211-4455', email: 'contato@valeverde.com.br', categoria: 'Tijolos e Telhas' }
  ];

  for (const f of fornecedores) {
    await sql(`
      INSERT INTO fornecedores (id, tenant_id, nome, razao_social, cnpj_cpf, telefone, email, categoria)
      VALUES (${cleanVal(f.id)}, 'demo_construtora', ${cleanVal(f.nome)}, ${cleanVal(f.razao_social)}, ${cleanVal(f.cnpj_cpf)}, ${cleanVal(f.telefone)}, ${cleanVal(f.email)}, ${cleanVal(f.categoria)})
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  console.log('✓ Dados demo concluídos.');
}

async function validateAsRuntime() {
  console.log('\n--- Validação com Role de Runtime (finobra_app) ---');
  const runtimeUrl = process.env.DATABASE_URL;
  const appSql = neon(runtimeUrl);

  const [obras, lancamentos, fornecedores, contas, notas, docs] = await Promise.all([
    appSql`SELECT count(*)::int as c FROM obras WHERE tenant_id = 'angelim';`,
    appSql`SELECT count(*)::int as c FROM lancamentos WHERE tenant_id = 'angelim';`,
    appSql`SELECT count(*)::int as c FROM fornecedores WHERE tenant_id = 'angelim';`,
    appSql`SELECT count(*)::int as c FROM contas_bancarias WHERE tenant_id = 'angelim';`,
    appSql`SELECT count(*)::int as c FROM notas_fiscais WHERE tenant_id = 'angelim';`,
    appSql`SELECT count(*)::int as c FROM documentos WHERE tenant_id = 'angelim';`
  ]);

  console.log(`✅ Contagem validada para tenant angelim:`);
  console.log(`   - 🏗️  Obras/Clientes: ${obras[0].c}`);
  console.log(`   - 💰 Lançamentos: ${lancamentos[0].c}`);
  console.log(`   - 🤝 Fornecedores: ${fornecedores[0].c}`);
  console.log(`   - 🏦 Contas Bancárias: ${contas[0].c}`);
  console.log(`   - 🧾 Notas Fiscais: ${notas[0].c}`);
  console.log(`   - 📎 Documentos: ${docs[0].c}`);
}

async function main() {
  await restoreAngelim();
  await restoreDemoConstrutora();
  await validateAsRuntime();
  console.log('\n🎉 RESTAURAÇÃO TOTAL CONCLUÍDA COM SUCESSO!\n');
}

main().catch(err => {
  console.error('\n❌ ERRO NA RESTAURAÇÃO:', err);
  process.exit(1);
});
