// scripts/migrate-initial.js — Envia dados iniciais da construtora para o Neon PostgreSQL

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const sql = neon(connectionString);

async function main() {
  console.log('Verificando dados atuais no Neon...');
  const countObras = await sql`SELECT COUNT(*) FROM obras;`;
  console.log(`Total de obras cadastradas no Neon: ${countObras[0].count}`);

  // Inserção da Sede / Escritório Central se não existir
  await sql`
    INSERT INTO obras (id, nome, cliente, endereco, orcamento_total, status)
    VALUES ('escritorio', '🏢 Sede / Escritório Central', 'Angelim Construtora LTDA', 'Boa Vista - RR', 0, 'em_andamento')
    ON CONFLICT (id) DO NOTHING;
  `;
  console.log('✅ Sede / Escritório Central garantido no Neon.');
}

main().catch(console.error);
