// scripts/seed-neon-all.js — Popula o Neon PostgreSQL com todas as obras, fornecedores, lançamentos e orçamentos

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const sql = neon(connectionString);

function _fmtDateAdd(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function main() {
  console.log('Populando dados completos no Neon PostgreSQL...');

  // 1. Obras / Clientes
  const obras = [
    { id: 'escritorio', nome: '🏢 Sede / Escritório Central', cliente: 'Angelim Construtora LTDA', endereco: 'Boa Vista - RR', orcamento_total: 0, status: 'em_andamento', data_inicio: '2025-01-01', data_previsao: null },
    { id: 'cli_001', nome: 'João Carlos Ferreira', cliente: 'João Carlos Ferreira', endereco: 'Rua das Acácias, 120, Jd. Paraíso, Sorocaba - SP', orcamento_total: 320000, status: 'em_andamento', data_inicio: '2026-01-10', data_previsao: '2026-12-10' },
    { id: 'cli_002', nome: 'Maria Aparecida Santos', cliente: 'Maria Aparecida Santos', endereco: 'Av. Brasil, 450, Vila São Bento, Campinas - SP', orcamento_total: 215000, status: 'em_andamento', data_inicio: '2026-02-15', data_previsao: '2026-11-15' },
    { id: 'cli_003', nome: 'Roberto Silva Lima', cliente: 'Roberto Silva Lima', endereco: 'Rua das Flores, 78, Jd. Bonfiglioli, Jundiaí - SP', orcamento_total: 400000, status: 'concluida', data_inicio: '2025-06-01', data_previsao: '2026-06-30' }
  ];

  for (const o of obras) {
    await sql`
      INSERT INTO obras (id, nome, cliente, endereco, orcamento_total, status, data_inicio, data_previsao)
      VALUES (${o.id}, ${o.nome}, ${o.cliente}, ${o.endereco}, ${o.orcamento_total}, ${o.status}, ${o.data_inicio}, ${o.data_previsao})
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        cliente = EXCLUDED.cliente,
        endereco = EXCLUDED.endereco,
        orcamento_total = EXCLUDED.orcamento_total,
        status = EXCLUDED.status;
    `;
  }
  console.log(`  ✓ ${obras.length} obras gravadas.`);

  // 2. Fornecedores
  const fornecedores = [
    { id: 'forn_001', nome: 'Madeireira Central Ltda', razao_social: 'Madeireira Central Ltda', cnpj_cpf: '67.890.123/0001-45', telefone: '(15) 99888-7766', email: 'vendas@madeireiracentral.com.br', categoria: 'Madeiras e Esquadrias' },
    { id: 'forn_002', nome: 'Votorantim Cimentos S.A.', razao_social: 'Votorantim Cimentos S.A.', cnpj_cpf: '01.234.567/0001-89', telefone: '0800 701 9898', email: 'contato@votorantim.com.br', categoria: 'Cimento e Concreto' },
    { id: 'forn_003', nome: 'Cerâmica Vale Verde', razao_social: 'Cerâmica Vale Verde ME', cnpj_cpf: '23.456.789/0001-12', telefone: '(15) 3211-4455', email: 'contato@valeverde.com.br', categoria: 'Tijolos e Telhas' },
    { id: 'forn_004', nome: 'Siderúrgica Paulo & Cia', razao_social: 'Siderúrgica Paulo & Cia Ltda', cnpj_cpf: '12.345.678/0001-99', telefone: '(15) 99123-4455', email: 'pedidos@siderurgicapaulo.com.br', categoria: 'Aço e Ferragens' },
    { id: 'forn_005', nome: 'Elétrica Silva ME', razao_social: 'Elétrica Silva Materiais Elétricos', cnpj_cpf: '34.567.890/0001-23', telefone: '(19) 99777-6655', email: 'silva@eletricasilva.com.br', categoria: 'Material Elétrico' },
    { id: 'forn_006', nome: 'Casa das Tintas RR', razao_social: 'Casa das Tintas e Revestimentos', cnpj_cpf: '45.678.901/0001-34', telefone: '(95) 99123-8899', email: 'tintas@casadastintasrr.com.br', categoria: 'Pintura e Acabamento' },
    { id: 'forn_007', nome: 'Tigre Materiais Hidráulicos', razao_social: 'Tigre S.A. Tubos e Conexões', cnpj_cpf: '56.789.012/0001-45', telefone: '0800 707 4444', email: 'atendimento@tigre.com.br', categoria: 'Hidráulica' },
    { id: 'forn_008', nome: 'Empreiteira Lima & Filhos ME', razao_social: 'Empreiteira Lima & Filhos Construções', cnpj_cpf: '78.901.234/0001-56', telefone: '(15) 99654-3210', email: 'lima.empreiteira@email.com', categoria: 'Mão de Obra' }
  ];

  for (const f of fornecedores) {
    await sql`
      INSERT INTO fornecedores (id, nome, razao_social, cnpj_cpf, telefone, email, categoria)
      VALUES (${f.id}, ${f.nome}, ${f.razao_social}, ${f.cnpj_cpf}, ${f.telefone}, ${f.email}, ${f.categoria})
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        razao_social = EXCLUDED.razao_social,
        cnpj_cpf = EXCLUDED.cnpj_cpf,
        telefone = EXCLUDED.telefone;
    `;
  }
  console.log(`  ✓ ${fornecedores.length} fornecedores gravados.`);

  // 3. Boletos e Lançamentos
  const lancamentos = [
    // Sede
    { id:'l_adm_001', obra_id:'escritorio', tipo:'despesa', data:_fmtDateAdd(0), data_vencimento:_fmtDateAdd(5), descricao:'Conta de Energia Elétrica — Sede Escritório Central', categoria:'energia', valor:1280, status:'a_pagar', fornecedor_beneficiario:'Equatorial / Roraima Energia', conta_bancaria:'BB — Movimento Principal', codigo_barras:'83640.00001 28000.123456 78901.234567 1 99200000128000', conciliado:false },
    { id:'l_adm_002', obra_id:'escritorio', tipo:'despesa', data:_fmtDateAdd(-10), data_vencimento:_fmtDateAdd(-5), data_pagamento:_fmtDateAdd(-5), descricao:'Conta de Água e Esgoto — Sede', categoria:'agua', valor:340, status:'pago', fornecedor_beneficiario:'CAER Companhia de Águas', conta_bancaria:'BB — Movimento Principal', codigo_barras:'83620.00000 34000.987654 32100.123456 8 98800000034000', conciliado:true },
    { id:'l_adm_003', obra_id:'escritorio', tipo:'despesa', data:_fmtDateAdd(0), data_vencimento:_fmtDateAdd(3), descricao:'Guia DAS — Simples Nacional (Comp. 07/2026)', categoria:'imposto_simples', valor:4850, status:'a_pagar', fornecedor_beneficiario:'Receita Federal do Brasil / Simples Nacional', conta_bancaria:'BB — Movimento Principal', codigo_barras:'85820.00004 85000.104050 12345.678901 3 99200000485000', conciliado:false },
    { id:'l_adm_004', obra_id:'escritorio', tipo:'despesa', data:_fmtDateAdd(-12), data_vencimento:_fmtDateAdd(-8), data_pagamento:_fmtDateAdd(-8), descricao:'Aluguel da Sede Comercial — Angelim Construtora', categoria:'aluguel_sede', valor:3500, status:'pago', fornecedor_beneficiario:'Imobiliária Nova Era Ltda', conta_bancaria:'BB — Movimento Principal', codigo_barras:'00190.00009 01234.567890 12345.678901 9 99200000350000', conciliado:true },
    { id:'l_adm_005', obra_id:'escritorio', tipo:'despesa', data:_fmtDateAdd(-15), data_vencimento:_fmtDateAdd(-10), data_pagamento:_fmtDateAdd(-10), descricao:'Internet Fibra Óptica Empresarial 500MB + Telefonia', categoria:'internet_tel', valor:249.90, status:'pago', fornecedor_beneficiario:'Vivo / Telefônica Brasil', conta_bancaria:'BB — Movimento Principal', conciliado:true },
    { id:'l_adm_006', obra_id:'escritorio', tipo:'despesa', data:_fmtDateAdd(0), data_vencimento:_fmtDateAdd(8), descricao:'Honorários Contábeis e Assessoria Fiscal Mensal', categoria:'contabilidade', valor:1800, status:'a_pagar', fornecedor_beneficiario:'Meta Contabilidade & Consultoria', conta_bancaria:'BB — Movimento Principal', codigo_barras:'23793.38128 60000.123456 78000.654321 3 98900000180000', conciliado:false },
    { id:'l_adm_007', obra_id:'escritorio', tipo:'despesa', data:_fmtDateAdd(-10), data_vencimento:_fmtDateAdd(-5), data_pagamento:_fmtDateAdd(-5), descricao:'Folha de Pagamento Funcionários — Equipe Sede', categoria:'salario', valor:14200, status:'pago', fornecedor_beneficiario:'Colaboradores Angelim Construtora', conta_bancaria:'BB — Movimento Principal', conciliado:true },
    
    // Boletos Dinâmicos
    { id:'l021', obra_id:'cli_001', tipo:'despesa', data:_fmtDateAdd(0), data_vencimento:_fmtDateAdd(6), descricao:'Boleto Madeireira Central — Esquadrias e Vigas', categoria:'material', valor:14500, status:'a_pagar', fornecedor_beneficiario:'Madeireira Central Ltda', conta_bancaria:'CC 0501-123456-7', codigo_barras:'34191.79001 01043.510047 91020.150008 5 98760001450000', conciliado:false },
    { id:'l026', obra_id:'cli_001', tipo:'despesa', data:_fmtDateAdd(0), data_vencimento:_fmtDateAdd(9), descricao:'Boleto Votorantim Cimentos — CP-II e Argamassa', categoria:'material', valor:3850, status:'a_pagar', fornecedor_beneficiario:'Votorantim Cimentos S.A.', conta_bancaria:'CC 0501-123456-7', codigo_barras:'23793.38128 60000.778899 12000.456789 4 98850000385000', conciliado:false },
    { id:'l022', obra_id:'cli_001', tipo:'despesa', data:_fmtDateAdd(0), data_vencimento:_fmtDateAdd(15), descricao:'Boleto Cerâmica Vale Verde — Tijolos e Pisos', categoria:'material', valor:8200, status:'a_pagar', fornecedor_beneficiario:'Cerâmica Vale Verde', conta_bancaria:'CC 0501-123456-7', codigo_barras:'03399.81234 12345.678901 23456.789012 1 98800000820000', conciliado:false },
    { id:'l027', obra_id:'cli_002', tipo:'despesa', data:_fmtDateAdd(0), data_vencimento:_fmtDateAdd(21), descricao:'Boleto Tubos Tigre — Tubulações e Conexões', categoria:'material', valor:2940, status:'a_pagar', fornecedor_beneficiario:'Tigre Materiais Hidráulicos', conta_bancaria:'CC 0843-987654-3', codigo_barras:'34191.79001 01043.998877 66020.150008 2 98890000294000', conciliado:false },
    { id:'l023', obra_id:'cli_001', tipo:'despesa', data:_fmtDateAdd(0), data_vencimento:_fmtDateAdd(28), descricao:'Boleto Siderúrgica Paulo — Ferragens CA-50', categoria:'material', valor:6800, status:'a_pagar', fornecedor_beneficiario:'Siderúrgica Paulo & Cia', conta_bancaria:'CC 0501-123456-7', codigo_barras:'23793.38128 60000.123456 78000.654321 3 98900000680000', conciliado:false },
    { id:'l024', obra_id:'cli_002', tipo:'despesa', data:_fmtDateAdd(0), data_vencimento:_fmtDateAdd(38), descricao:'Boleto Elétrica Silva — Fiação e Disjuntores', categoria:'material', valor:5400, status:'a_pagar', fornecedor_beneficiario:'Elétrica Silva ME', conta_bancaria:'CC 0843-987654-3', codigo_barras:'10491.82345 98765.432109 87654.321098 7 99000000540000', conciliado:false },
    { id:'l025', obra_id:'cli_002', tipo:'despesa', data:_fmtDateAdd(0), data_vencimento:_fmtDateAdd(52), descricao:'Boleto Tintas Coral — Textura e Pintura', categoria:'material', valor:4300, status:'a_pagar', fornecedor_beneficiario:'Casa das Tintas RR', conta_bancaria:'CC 0843-987654-3', codigo_barras:'00190.00009 01234.567890 12345.678901 9 99200000430000', conciliado:false }
  ];

  for (const l of lancamentos) {
    await sql`
      INSERT INTO lancamentos (id, data, data_vencimento, data_pagamento, descricao, categoria, fornecedor_beneficiario, conta_bancaria, tipo, valor, status, obra_id, codigo_barras, conciliado)
      VALUES (${l.id}, ${l.data}, ${l.data_vencimento}, ${l.data_pagamento || null}, ${l.descricao}, ${l.categoria}, ${l.fornecedor_beneficiario}, ${l.conta_bancaria}, ${l.tipo}, ${l.valor}, ${l.status}, ${l.obra_id}, ${l.codigo_barras || null}, ${l.conciliado})
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        data_vencimento = EXCLUDED.data_vencimento,
        data_pagamento = EXCLUDED.data_pagamento,
        descricao = EXCLUDED.descricao,
        valor = EXCLUDED.valor,
        status = EXCLUDED.status,
        codigo_barras = EXCLUDED.codigo_barras;
    `;
  }
  console.log(`  ✓ ${lancamentos.length} lançamentos e boletos atualizados.`);

  console.log('\n======================================================');
  console.log('🎉 NEON POSTGRESQL TOTALMENTE POVOADO E ATUALIZADO!');
  console.log('======================================================\n');
}

main().catch(console.error);
