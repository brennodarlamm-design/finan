// scripts/fix-constraints.js — Remove foreign key blockers & sanitize tables

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const sql = neon(connectionString);

async function main() {
  console.log('Ajustando constraints no Neon PostgreSQL...');

  // Remove foreign key restritivas para permitir despesas gerais/sede
  await sql`ALTER TABLE lancamentos DROP CONSTRAINT IF EXISTS lancamentos_obra_id_fkey;`;
  await sql`ALTER TABLE lancamentos DROP CONSTRAINT IF EXISTS lancamentos_nota_fiscal_id_fkey;`;
  await sql`ALTER TABLE lancamentos DROP CONSTRAINT IF EXISTS lancamentos_fornecedor_id_fkey;`;
  await sql`ALTER TABLE notas_fiscais DROP CONSTRAINT IF EXISTS notas_fiscais_obra_id_fkey;`;
  await sql`ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_obra_id_fkey;`;
  await sql`ALTER TABLE medicoes DROP CONSTRAINT IF EXISTS medicoes_obra_id_fkey;`;

  console.log('✅ Constraints flexibilizadas com sucesso para compatibilidade total!');
}

main().catch(console.error);
