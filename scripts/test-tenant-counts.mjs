import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createRuntimeSql } from '../api/_database.js';
import { createTenantSql } from '../api/_tenant-sql.js';

async function main() {
  const baseSql = createRuntimeSql();
  const sql = createTenantSql(baseSql, { tenantId: 'angelim' });

  const obras = await sql`SELECT count(*)::int as c FROM obras;`;
  const lancamentos = await sql`SELECT count(*)::int as c FROM lancamentos;`;
  const fornecedores = await sql`SELECT count(*)::int as c FROM fornecedores;`;
  const contas = await sql`SELECT count(*)::int as c FROM contas_bancarias;`;
  const notas = await sql`SELECT count(*)::int as c FROM notas_fiscais;`;
  const docs = await sql`SELECT count(*)::int as c FROM documentos;`;

  console.log('✅ Contagem com createTenantSql (RLS ativo para angelim):');
  console.log(`   - Obras/Clientes: ${obras[0].c}`);
  console.log(`   - Lançamentos: ${lancamentos[0].c}`);
  console.log(`   - Fornecedores: ${fornecedores[0].c}`);
  console.log(`   - Contas Bancárias: ${contas[0].c}`);
  console.log(`   - Notas Fiscais: ${notas[0].c}`);
  console.log(`   - Documentos: ${docs[0].c}`);
}

main().catch(console.error);
