import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;
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
}

check().catch(console.error);
