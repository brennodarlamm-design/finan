// scripts/seed-contas.js — Restaura e sincroniza contas bancárias no Neon PostgreSQL
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida em .env.local');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('Criando tabela contas_bancarias se não existir...');
  await sql`
    CREATE TABLE IF NOT EXISTS contas_bancarias (
      id VARCHAR(100) PRIMARY KEY,
      banco_codigo VARCHAR(20),
      banco_nome VARCHAR(100),
      agencia VARCHAR(50),
      numero VARCHAR(50),
      tipo VARCHAR(50),
      titular VARCHAR(150),
      apelido VARCHAR(150),
      obra_id VARCHAR(100),
      obs TEXT,
      saldo_inicial NUMERIC DEFAULT 0,
      saldo_atual NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  const contas = [
    {
      id: 'cta_sicredi_0812',
      banco_codigo: '748',
      banco_nome: 'Sicredi',
      agencia: '0812',
      numero: '60096-3',
      tipo: 'corrente',
      titular: 'ANGELIM CONSTRUTORA LTDA',
      apelido: 'Sicredi Ag:0812 Cc:60096-3',
      obra_id: null,
      obs: 'Conta corrente principal Sicredi vinculada às movimentações e conciliação OFX da construtora'
    },
    {
      id: 'cta_bb_principal',
      banco_codigo: '001',
      banco_nome: 'Banco do Brasil',
      agencia: '0001',
      numero: 'Principal',
      tipo: 'corrente',
      titular: 'ANGELIM CONSTRUTORA LTDA',
      apelido: 'BB — Movimento Principal',
      obra_id: null,
      obs: 'Conta corrente Banco do Brasil — Movimentação geral de despesas e receitas'
    },
    {
      id: 'cta_btg_invest',
      banco_codigo: '208',
      banco_nome: 'BTG Pactual',
      agencia: '0001',
      numero: 'Investimentos',
      tipo: 'investimento',
      titular: 'ANGELIM CONSTRUTORA LTDA',
      apelido: 'BTG Pactual',
      obra_id: null,
      obs: 'Conta investimentos / rendimentos BTG Pactual'
    },
    {
      id: 'cta_cef_obras',
      banco_codigo: '104',
      banco_nome: 'Caixa Econômica Federal',
      agencia: '0501',
      numero: '12345-6',
      tipo: 'obras',
      titular: 'ANGELIM CONSTRUTORA LTDA',
      apelido: 'Caixa — Conta Obras CEF',
      obra_id: null,
      obs: 'Conta vinculada a recursos de financiamentos habitacionais Caixa'
    }
  ];

  for (const c of contas) {
    await sql`
      INSERT INTO contas_bancarias (id, banco_codigo, banco_nome, agencia, numero, tipo, titular, apelido, obra_id, obs)
      VALUES (${c.id}, ${c.banco_codigo}, ${c.banco_nome}, ${c.agencia}, ${c.numero}, ${c.tipo}, ${c.titular}, ${c.apelido}, ${c.obra_id}, ${c.obs})
      ON CONFLICT (id) DO UPDATE SET
        banco_codigo = EXCLUDED.banco_codigo,
        banco_nome = EXCLUDED.banco_nome,
        agencia = EXCLUDED.agencia,
        numero = EXCLUDED.numero,
        tipo = EXCLUDED.tipo,
        titular = EXCLUDED.titular,
        apelido = EXCLUDED.apelido,
        obra_id = EXCLUDED.obra_id,
        obs = EXCLUDED.obs,
        updated_at = NOW();
    `;
    console.log(`✓ Conta sincronizada: ${c.apelido}`);
  }

  const todas = await sql`SELECT id, apelido, banco_nome, agencia, numero FROM contas_bancarias ORDER BY created_at ASC;`;
  console.log('\nContas ativas no Neon PostgreSQL:');
  console.table(todas);
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
