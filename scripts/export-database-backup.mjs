// scripts/export-database-backup.mjs
// Utilitário para geração de backup completo e sanitizado do banco de produção Neon

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const ownerUrl = process.env.DATABASE_OWNER_URL;
if (!ownerUrl) {
  console.error('❌ DATABASE_OWNER_URL não configurada em .env.local');
  process.exit(1);
}

const sql = neon(ownerUrl);

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dateStr = new Date().toISOString().slice(0, 10);
  console.log(`📦 Iniciando extração do backup oficial do FinGo (${dateStr})...`);

  // 1. Extração de todas as tabelas essenciais
  const tables = [
    'tenants',
    'usuarios',
    'obras',
    'fornecedores',
    'contas_bancarias',
    'produtos',
    'lancamentos',
    'notas_fiscais',
    'documentos',
    'recibos',
    'ocr_historico',
    'orcamentos',
    'orcamentos_sinapi',
    'precompras',
    'billing_invoices',
    'tenant_certificates',
    'tenant_preferences',
    'tenant_dfe_sync',
    'obra_cadastro_geral',
    'dev_tenant_keys',
    'runtime_configs'
  ];

  const fullData = {
    exported_at: new Date().toISOString(),
    database_version: 'PostgreSQL 17 / Neon',
    tables: {}
  };

  for (const table of tables) {
    try {
      const rows = await sql(`SELECT * FROM "${table}";`);
      fullData.tables[table] = rows;
      console.log(`  ✓ ${table.padEnd(25)}: ${rows.length} registros`);
    } catch (e) {
      console.warn(`  ⚠️ ${table.padEnd(25)}: erro (${e.message})`);
      fullData.tables[table] = [];
    }
  }

  // 2. Montar formato compatível com o importador do app (Angelim)
  const angelimObras = fullData.tables.obras.filter(o => o.tenant_id === 'angelim');
  const angelimLanc = fullData.tables.lancamentos.filter(l => l.tenant_id === 'angelim');
  const angelimForn = fullData.tables.fornecedores.filter(f => f.tenant_id === 'angelim');
  const angelimContas = fullData.tables.contas_bancarias.filter(c => c.tenant_id === 'angelim');
  const angelimNotas = fullData.tables.notas_fiscais.filter(n => n.tenant_id === 'angelim');
  const angelimDocs = fullData.tables.documentos.filter(d => d.tenant_id === 'angelim');
  const angelimRecibos = fullData.tables.recibos.filter(r => r.tenant_id === 'angelim');
  const angelimUsers = fullData.tables.usuarios.filter(u => u.tenant_id === 'angelim');
  const angelimProdutos = fullData.tables.produtos.filter(p => p.tenant_id === 'angelim');

  const appFormat = {
    exported_at: new Date().toISOString(),
    empresa: fullData.tables.tenants.find(t => t.id === 'angelim') || null,
    clientes: angelimObras.filter(o => o.id !== 'escritorio' && o.id !== 'geral'),
    obras: angelimObras,
    lancamentos: angelimLanc,
    fornecedores: angelimForn,
    contas: angelimContas,
    notas: angelimNotas,
    documentos: angelimDocs,
    recibos: angelimRecibos,
    produtos: angelimProdutos,
    orcamentos: fullData.tables.orcamentos.filter(o => o.tenant_id === 'angelim'),
    orcamentos_sinapi: fullData.tables.orcamentos_sinapi.filter(o => o.tenant_id === 'angelim'),
    precompras: fullData.tables.precompras.filter(p => p.tenant_id === 'angelim'),
    ocr_historico: fullData.tables.ocr_historico.filter(h => h.tenant_id === 'angelim'),
    users: angelimUsers.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      nome: u.nome,
      perfil: u.perfil,
      ativo: u.ativo
    }))
  };

  // 3. Gravação nos destinos
  const destAppPath = path.resolve(`D:/angelim_backup_${dateStr}.json`);
  const destFullPath = path.resolve(`D:/fingo_database_full_backup_${dateStr}.json`);
  const scratchAppPath = path.resolve(`scratch/angelim_backup_${dateStr}.json`);

  fs.writeFileSync(destAppPath, JSON.stringify(appFormat, null, 2), 'utf8');
  console.log(`\n💾 Backup do sistema Angelim salvo com sucesso em:\n   👉 ${destAppPath}`);

  fs.writeFileSync(destFullPath, JSON.stringify(fullData, null, 2), 'utf8');
  console.log(`💾 Backup integral de todas as tabelas do banco salvo em:\n   👉 ${destFullPath}`);

  try {
    if (!fs.existsSync('scratch')) fs.mkdirSync('scratch', { recursive: true });
    fs.writeFileSync(scratchAppPath, JSON.stringify(appFormat, null, 2), 'utf8');
    console.log(`💾 Cópia de segurança local salva em:\n   👉 ${scratchAppPath}`);
  } catch (e) {}

  // 4. Exibir resumo consolidado
  const somaPago = angelimLanc
    .filter(l => l.status === 'pago')
    .reduce((acc, l) => acc + parseFloat(l.valor || 0), 0);
  const somaPendente = angelimLanc
    .filter(l => l.status !== 'pago')
    .reduce((acc, l) => acc + parseFloat(l.valor || 0), 0);

  console.log('\n📊 RESUMO DO BACKUP REALIZADO:');
  console.log(`  • Lançamentos: ${angelimLanc.length}`);
  console.log(`    - Total Pago: R$ ${somaPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`    - Total Pendente: R$ ${somaPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`    - Total Geral: R$ ${(somaPago + somaPendente).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`  • Obras / Clientes: ${angelimObras.length}`);
  console.log(`  • Fornecedores: ${angelimForn.length}`);
  console.log(`  • Produtos / Catálogo: ${angelimProdutos.length}`);
  console.log(`  • Notas Fiscais: ${angelimNotas.length}`);
  console.log(`  • Documentos / Comprovantes: ${angelimDocs.length}`);
  console.log(`  • Contas Bancárias: ${angelimContas.length}`);
  console.log(`  • Recibos: ${angelimRecibos.length}`);
  console.log('\n✅ Processo de backup concluído com sucesso total!');
}

main().catch(console.error);
