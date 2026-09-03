// scripts/executar-lancamentos-ofx.js
// Executa o lançamento em lote das 39 transações no Neon PostgreSQL e cadastra/atualiza fornecedores
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = (process.env.DATABASE_URL || '').trim().replace(/^["']|["']$/g, '');
const sql = neon(connectionString);

function uid(prefix = 'lan_') {
  return prefix + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 6);
}

// 39 transações identificadas
const transacoes = [
  { data: '2026-04-27', valor: 7.52, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '21949266171' },
  { data: '2026-05-04', valor: 6.35, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '21995677035' },
  { data: '2026-05-04', valor: 20.86, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '22009842204' },
  { data: '2026-05-04', valor: 29.79, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '220195990002' },
  { data: '2026-05-11', valor: 46.82, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '22097116932' },
  { data: '2026-05-11', valor: 50.07, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '22116990402' },
  { data: '2026-05-18', valor: 41.23, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '22182036009' },
  { data: '2026-05-25', valor: 169.05, forn: 'SUPERMERCADOS DB LTDA', cnpj: '22.991.939/0001-06', memo: 'PAGAMENTO PIX-PIX_DEB   22991939000106 SUPERMERCADOS DB LTDA', fitid: '22245250632' },
  { data: '2026-05-27', valor: 46.93, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '22281657537' },
  { data: '2026-06-15', valor: 31.03, forn: 'ARAUJO & SARAIVA LTDA', cnpj: '07.573.569/0001-95', memo: 'PAGAMENTO PIX-CX743595  07573569000195 ARAUJO  SARAIVA LTDA', fitid: '22503927176' },
  { data: '2026-06-22', valor: 47.68, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '22565880666' },
  { data: '2026-06-25', valor: 21.68, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0893283 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '22610574928' },
  { data: '2026-06-30', valor: 16.92, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '22653126882' },
  { data: '2026-06-30', valor: 65.72, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0174509 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '22653390601' },
  { data: '2026-06-30', valor: 9.28, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '22653861398' },
  { data: '2026-07-15', valor: 41.96, forn: 'SUPERMERCADOS DB LTDA', cnpj: '22.991.939/0001-06', memo: 'PAGAMENTO PIX-PIX_DEB   22991939000106 SUPERMERCADOS DB LTDA', fitid: '22838178264' },
  { data: '2026-07-16', valor: 25.86, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '22842232616' },
  { data: '2026-07-17', valor: 51.96, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0451607 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '22853406657' },
  { data: '2026-07-17', valor: 39.76, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0081037 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '22856502955' },
  { data: '2026-07-20', valor: 303.30, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0924894 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '22872930353' },
  { data: '2026-07-20', valor: 21.12, forn: 'SUPERMERCADO GABRIEL', cnpj: '', memo: 'COMPRAS NACIONAIS-VE0163722 SUPERMERCADO GABR        BOA VISTA    BR', fitid: '22873573451' },
  { data: '2026-07-20', valor: 105.17, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0857416 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '22887401327' },
  { data: '2026-07-20', valor: 11.99, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0948128 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '22888575206' },
  { data: '2026-07-24', valor: 21.56, forn: 'ARAUJO & SARAIVA LTDA', cnpj: '07.573.569/0001-95', memo: 'PAGAMENTO PIX-CX200891  07573569000195 ARAUJO  SARAIVA LTDA', fitid: '22930716512' },
  { data: '2026-07-29', valor: 19.57, forn: 'SUPERMERCADO GOIANA (ARAUJO & SARAIVA)', cnpj: '07.573.569/0001-95', memo: 'COMPRAS NACIONAIS-VE0530696 SUPERMERCADO GOIANA      BOA VISTA    BR', fitid: '22975019931' },
  { data: '2026-07-30', valor: 29.57, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0727769 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '22977414717' },
  { data: '2026-08-04', valor: 12.52, forn: 'ARAUJO & SARAIVA LTDA', cnpj: '07.573.569/0001-95', memo: 'PAGAMENTO PIX-CX318690  07573569000195 ARAUJO  SARAIVA LTDA', fitid: '23037863217' },
  { data: '2026-08-06', valor: 6.49, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0663109 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '23064543661' },
  { data: '2026-08-10', valor: 32.98, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0093392 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '23094420987' },
  { data: '2026-08-13', valor: 62.03, forn: 'SUPERMERCADO GOIANA (ARAUJO & SARAIVA)', cnpj: '07.573.569/0001-95', memo: 'COMPRAS NACIONAIS-VE0433161 SUPERMERCADO GOIANA      BOA VISTA    BR', fitid: '23145932516' },
  { data: '2026-08-13', valor: 130.09, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0970099 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '23152679008' },
  { data: '2026-08-17', valor: 88.46, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0997447 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '23167913350' },
  { data: '2026-08-17', valor: 82.66, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '23172540372' },
  { data: '2026-08-17', valor: 46.79, forn: 'ARAUJO & SARAIVA LTDA', cnpj: '07.573.569/0001-95', memo: 'PAGAMENTO PIX-CX734344  07573569000195 ARAUJO  SARAIVA LTDA', fitid: '23176718959' },
  { data: '2026-08-19', valor: 123.51, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '23212220601' },
  { data: '2026-08-21', valor: 17.76, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'PAGAMENTO PIX-PIX_DEB   05730257000112 SUPERMERCADO GAVIAO LTDA', fitid: '23236329533' },
  { data: '2026-08-24', valor: 58.30, forn: 'ARAUJO & SARAIVA LTDA', cnpj: '07.573.569/0001-95', memo: 'PAGAMENTO PIX-CX433720  07573569000195 ARAUJO  SARAIVA LTDA', fitid: '23241852825' },
  { data: '2026-08-24', valor: 30.62, forn: 'SUPERMERCADO GOIANA (ARAUJO & SARAIVA)', cnpj: '07.573.569/0001-95', memo: 'COMPRAS NACIONAIS-VE0612660 SUPERMERCADO GOIANA      BOA VISTA    BR', fitid: '23257250586' },
  { data: '2026-05-18', valor: 4.99, forn: 'SUPER FRIBOI (R R S DOS SANTOS LTDA)', cnpj: '08.013.550/0001-57', memo: 'PAGAMENTO PIX-PIX_DEB   08013550000157 SUPER FRIBOI', fitid: '22179152183' },
  { data: '2026-08-31', valor: 173.99, forn: 'SUPERMERCADO GAVIAO LTDA', cnpj: '05.730.257/0001-12', memo: 'COMPRAS NACIONAIS-VE0468818 SUPERMERCADO GAVIAO LT   BOA VISTA    BR', fitid: '23327434347' }
];

export async function executar() {
  console.log('Iniciando cadastro/atualização de fornecedores e lançamentos no Neon...');

  // 1. Cadastrar SUPERMERCADOS DB LTDA se não existir
  const dbForn = await sql`SELECT id FROM fornecedores WHERE cnpj_cpf LIKE '%22.991.939%' OR nome ILIKE '%SUPERMERCADOS DB%';`;
  let dbFornId = dbForn.length ? dbForn[0].id : null;
  if (!dbFornId) {
    dbFornId = uid('forn_');
    await sql`
      INSERT INTO fornecedores (id, nome, razao_social, cnpj_cpf, categoria)
      VALUES (${dbFornId}, 'SUPERMERCADOS DB LTDA', 'SUPERMERCADOS DB LTDA', '22.991.939/0001-06', 'Alimentação / Supermercado');
    `;
    console.log(`✔ Fornecedor SUPERMERCADOS DB LTDA cadastrado: ID ${dbFornId}`);
  }

  // 2. Cadastrar SUPER FRIBOI se não existir
  const friboiForn = await sql`SELECT id FROM fornecedores WHERE cnpj_cpf LIKE '%08.013.550%' OR nome ILIKE '%SUPER FRIBOI%';`;
  let friboiFornId = friboiForn.length ? friboiForn[0].id : null;
  if (!friboiFornId) {
    friboiFornId = uid('forn_');
    await sql`
      INSERT INTO fornecedores (id, nome, razao_social, cnpj_cpf, categoria)
      VALUES (${friboiFornId}, 'SUPER FRIBOI', 'R R S DOS SANTOS LTDA', '08.013.550/0001-57', 'Alimentação / Supermercado');
    `;
    console.log(`✔ Fornecedor SUPER FRIBOI cadastrado: ID ${friboiFornId}`);
  }

  // 3. Atualizar CNPJ do ATACADÃO se estiver em branco
  await sql`
    UPDATE fornecedores
    SET cnpj_cpf = '75.315.333/0001-09', razao_social = 'ATACADAO S.A.'
    WHERE nome ILIKE '%ATACADAO%' AND (cnpj_cpf IS NULL OR cnpj_cpf = '');
  `;
  console.log(`✔ Dados do ATACADÃO conferidos/atualizados`);

  // 4. Atualizar CNPJ do NOVA ERA se estiver em branco
  await sql`
    UPDATE fornecedores
    SET cnpj_cpf = '04.240.370/0043-06', razao_social = 'MERCANTIL NOVA ERA LTDA'
    WHERE nome ILIKE '%NOVA ERA%' AND (cnpj_cpf IS NULL OR cnpj_cpf = '');
  `;
  console.log(`✔ Dados do NOVA ERA conferidos/atualizados`);

  // 5. Cadastrar fornecedor SUPERMERCADO GABRIEL se não existir
  const gabrForn = await sql`SELECT id FROM fornecedores WHERE nome ILIKE '%SUPERMERCADO GABRIEL%';`;
  let gabrFornId = gabrForn.length ? gabrForn[0].id : null;
  if (!gabrFornId) {
    gabrFornId = uid('forn_');
    await sql`
      INSERT INTO fornecedores (id, nome, razao_social, categoria)
      VALUES (${gabrFornId}, 'SUPERMERCADO GABRIEL', 'SUPERMERCADO GABRIEL', 'Alimentação / Supermercado');
    `;
    console.log(`✔ Fornecedor SUPERMERCADO GABRIEL cadastrado: ID ${gabrFornId}`);
  }


  // Mapear IDs dos fornecedores
  const allForns = await sql`SELECT id, nome, razao_social, cnpj_cpf FROM fornecedores;`;
  function getFornId(name, cnpj) {
    const cleanCnpj = (cnpj || '').replace(/\D/g, '');
    const found = allForns.find(f => {
      const fC = (f.cnpj_cpf || '').replace(/\D/g, '');
      if (cleanCnpj && fC && fC === cleanCnpj) return true;
      return (f.nome || '').toUpperCase().includes(name.toUpperCase()) ||
             (f.razao_social || '').toUpperCase().includes(name.toUpperCase());
    });
    return found ? found.id : null;
  }

  // 4. Inserir Lançamentos
  let inseridos = 0;
  for (const t of transacoes) {
    const id = uid('mt');
    const fId = getFornId(t.forn, t.cnpj);

    await sql`
      INSERT INTO lancamentos (
        id, data, data_vencimento, data_pagamento,
        descricao, categoria, fornecedor_beneficiario, fornecedor_id,
        conta_bancaria, tipo, valor, status, obra_id,
        observacoes, conciliado
      ) VALUES (
        ${id}, ${t.data}::date, ${t.data}::date, ${t.data}::date,
        'COMIDA', 'material_escritorio', ${t.forn}, ${fId},
        'Sicredi Ag:0812 Cc:60096-3', 'despesa', ${t.valor}, 'pago', 'escritorio',
        ${t.memo}, true
      );
    `;
    inseridos++;
  }

  console.log(`\n🎉 Sucesso! ${inseridos} lançamentos inseridos com o centro de custo SEDE e descritivo COMIDA!`);
}

if (process.argv.includes('--run')) {
  executar().catch(console.error);
}
