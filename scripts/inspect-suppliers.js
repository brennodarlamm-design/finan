// scripts/inspect-suppliers.js — Analisa fornecedores no arquivo de backup

import fs from 'fs';

const rawData = fs.readFileSync('D:/angelim_backup_2026-08-31.json', 'utf8');
const backup = JSON.parse(rawData);

console.log('--- FORNECEDORES NA CHAVE "fornecedores" ---');
console.log(backup.fornecedores || 'Nenhum');

// Extrai fornecedores únicos dos lançamentos e das notas
const fornMap = new Map();

if (Array.isArray(backup.fornecedores)) {
  backup.fornecedores.forEach(f => {
    if (f.nome) fornMap.set(f.nome.trim(), { ...f, origem: 'cadastro' });
  });
}

if (Array.isArray(backup.lancamentos)) {
  backup.lancamentos.forEach(l => {
    const nome = (l.fornecedor_beneficiario || '').trim();
    if (nome && nome !== '—' && nome !== '-' && !fornMap.has(nome)) {
      fornMap.set(nome, {
        id: 'forn_' + Math.random().toString(36).substr(2, 9),
        nome: nome,
        razao_social: nome,
        categoria: l.categoria || 'Geral',
        origem: 'lancamentos'
      });
    }
  });
}

if (Array.isArray(backup.notas)) {
  backup.notas.forEach(n => {
    const nome = (n.emitente || n.razao_social || '').trim();
    if (nome && !fornMap.has(nome)) {
      fornMap.set(nome, {
        id: 'forn_' + Math.random().toString(36).substr(2, 9),
        nome: nome,
        razao_social: nome,
        cnpj_cpf: n.cnpj_emitente || n.cnpj || '',
        categoria: 'NF-e',
        origem: 'notas'
      });
    }
  });
}

console.log(`\nTotal de fornecedores únicos encontrados no seu backup: ${fornMap.size}`);
for (const [nome, dados] of fornMap.entries()) {
  console.log(` - 🏗️ ${nome} (Origem: ${dados.origem})`);
}
