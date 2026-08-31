// scripts/restore-real-suppliers.js — Restaura exatamente todos os fornecedores reais do backup

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const sql = neon(connectionString);

async function main() {
  console.log('Lendo fornecedores reais de D:/angelim_backup_2026-08-31.json...');
  const rawData = fs.readFileSync('D:/angelim_backup_2026-08-31.json', 'utf8');
  const backup = JSON.parse(rawData);

  // Limpa os fornecedores antigos do banco
  await sql`DELETE FROM fornecedores;`;
  console.log('Tabela fornecedores limpa no Neon.');

  const fornMap = new Map();

  // 1. Pega do array fornecedores
  if (Array.isArray(backup.fornecedores)) {
    backup.fornecedores.forEach(f => {
      const nome = (f.nome_fantasia || f.razao_social || f.nome || '').trim();
      if (nome) {
        fornMap.set(nome, {
          id: f.id || ('forn_' + Math.random().toString(36).substr(2, 9)),
          nome: nome,
          razao_social: f.razao_social || nome,
          cnpj_cpf: f.cnpj || f.cnpj_cpf || f.cpf || '',
          telefone: f.telefone || '',
          email: f.email || '',
          categoria: f.categoria || 'outros',
          banco_info: f.endereco ? `${f.endereco}, ${f.numero || ''} - ${f.bairro || ''}, ${f.municipio || ''}/${f.uf || ''}` : ''
        });
      }
    });
  }

  // 2. Garante fornecedores que estão nos lançamentos
  if (Array.isArray(backup.lancamentos)) {
    backup.lancamentos.forEach(l => {
      const nome = (l.fornecedor_beneficiario || '').trim();
      if (nome && nome !== '—' && nome !== '-' && !fornMap.has(nome)) {
        fornMap.set(nome, {
          id: 'forn_' + Math.random().toString(36).substr(2, 9),
          nome: nome,
          razao_social: nome,
          cnpj_cpf: '',
          telefone: '',
          email: '',
          categoria: l.categoria || 'outros',
          banco_info: ''
        });
      }
    });
  }

  // 3. Garante fornecedores das notas fiscais
  if (Array.isArray(backup.notas)) {
    backup.notas.forEach(n => {
      const nome = (n.emitente || n.razao_social || '').trim();
      if (nome && !fornMap.has(nome)) {
        fornMap.set(nome, {
          id: 'forn_' + Math.random().toString(36).substr(2, 9),
          nome: nome,
          razao_social: nome,
          cnpj_cpf: n.cnpj_emitente || n.cnpj || '',
          telefone: '',
          email: '',
          categoria: 'material',
          banco_info: ''
        });
      }
    });
  }

  console.log(`Gravando ${fornMap.size} fornecedores reais no Neon PostgreSQL...`);

  let count = 0;
  for (const [_, f] of fornMap.entries()) {
    await sql`
      INSERT INTO fornecedores (id, nome, razao_social, cnpj_cpf, telefone, email, categoria, banco_info)
      VALUES (${f.id}, ${f.nome}, ${f.razao_social}, ${f.cnpj_cpf}, ${f.telefone}, ${f.email}, ${f.categoria}, ${f.banco_info})
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        razao_social = EXCLUDED.razao_social,
        cnpj_cpf = EXCLUDED.cnpj_cpf,
        telefone = EXCLUDED.telefone,
        email = EXCLUDED.email,
        categoria = EXCLUDED.categoria;
    `;
    console.log(`  ✓ Fornecedor gravado: ${f.nome} (CNPJ: ${f.cnpj_cpf || 'N/A'})`);
    count++;
  }

  console.log('\n======================================================');
  console.log(`🎉 ${count} FORNECEDORES REAIS RESTAURADOS COM SUCESSO NO NEON!`);
  console.log('======================================================\n');
}

main().catch(console.error);
