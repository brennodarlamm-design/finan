import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = (process.env.DATABASE_URL || '').trim().replace(/^["']|["']$/g, '');
const sql = neon(connectionString);

async function check() {
  const [o, f, l, n, d] = await Promise.all([
    sql`SELECT COUNT(*) FROM obras;`,
    sql`SELECT COUNT(*) FROM fornecedores;`,
    sql`SELECT COUNT(*) FROM lancamentos;`,
    sql`SELECT COUNT(*) FROM notas_fiscais;`,
    sql`SELECT COUNT(*) FROM documentos;`
  ]);
  console.log('--- CONTAGEM ATUAL NO NEON ---');
  console.log('Obras:', o[0].count);
  console.log('Fornecedores:', f[0].count);
  console.log('Lançamentos:', l[0].count);
  console.log('Notas Fiscais:', n[0].count);
  console.log('Documentos:', d[0].count);

  const statusCount = await sql`SELECT status, count(*) FROM lancamentos GROUP BY status;`;
  console.log('\n--- STATUS DOS LANÇAMENTOS ---', statusCount);

  const hoje = new Date().toISOString().split('T')[0];
  console.log('\nData Hoje UTC:', hoje);
  const boletos = await sql`
    SELECT l.id, l.descricao, l.tipo, l.status, l.data_vencimento, l.data, l.valor, l.fornecedor_beneficiario
    FROM lancamentos l
    WHERE l.tipo = 'despesa'
      AND l.status = 'a_pagar'
      AND (DATE(l.data_vencimento) <= ${hoje}::date OR DATE(l.data) <= ${hoje}::date)
    ORDER BY l.data_vencimento ASC;
  `;
  console.log('\n--- BOLETOS A PAGAR COM DATE() CASTING ---');
  console.log('Total:', boletos.length);
  boletos.forEach(b => console.log(`- ${b.descricao}: R$ ${b.valor} (Venc: ${b.data_vencimento})`));
}

check().catch(console.error);
