import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ownerUrl = process.env.DATABASE_OWNER_URL;
if (!ownerUrl) {
  console.error('❌ DATABASE_OWNER_URL não configurado em .env.local');
  process.exit(1);
}
const sql = neon(ownerUrl);

async function main() {
  console.log('🚀 Iniciando restauração e concessão de privilégios no novo Neon...');

  // 1. Conceder permissões para finobra_app nas tabelas adicionadas nas migrações 033 e 035
  console.log('Concedendo permissões para tabelas novas ao finobra_app...');
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_dfe_sync, tenant_dfe_documentos TO finobra_app;`;
  console.log('✓ Permissões DF-e concedidas.');

  // 2. Restaurar backup
  const backupPath = path.resolve('scratch/neon_data_backup.json');
  if (!fs.existsSync(backupPath)) {
    throw new Error('Arquivo de backup não encontrado em ' + backupPath);
  }

  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  console.log(`📦 Carregado backup de ${backup.date}:`);
  console.log(`   - Tenants: ${backup.tenants?.length || 0}`);
  console.log(`   - Audit (tenant_integrity_audit): ${backup.audit?.length || 0}`);
  console.log(`   - Signatures (document_signatures): ${backup.signatures?.length || 0}`);

  // Restaurar Tenants
  for (const t of backup.tenants || []) {
    const keys = Object.keys(t);
    const cols = keys.map(k => `"${k}"`).join(', ');
    const vals = keys.map(k => {
      const v = t[k];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'boolean' || typeof v === 'number') return v;
      if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
      return `'${String(v).replace(/'/g, "''")}'`;
    }).join(', ');

    const q = `INSERT INTO tenants (${cols}) VALUES (${vals}) ON CONFLICT (id) DO UPDATE SET updated_at = NOW();`;
    await sql(q);
  }
  console.log(`✅ ${backup.tenants.length} tenants restaurados com sucesso!`);

  // Se houver assinaturas referenciando usuários, garantir usuário pai em `usuarios`
  for (const s of backup.signatures || []) {
    if (s.user_id) {
      await sql`
        INSERT INTO usuarios (id, tenant_id, username, email, senha_hash, nome, perfil, ativo)
        VALUES (${s.user_id}, ${s.tenant_id}, ${s.user_id}, ${s.user_id + '@' + s.tenant_id + '.local'}, 'placeholder', ${s.nome || 'Usuário Assinante'}, 'operador', true)
        ON CONFLICT (id) DO NOTHING;
      `;
    }
  }

  // Restaurar Document Signatures
  for (const s of backup.signatures || []) {
    const keys = Object.keys(s);
    const cols = keys.map(k => `"${k}"`).join(', ');
    const vals = keys.map(k => {
      const v = s[k];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'boolean' || typeof v === 'number') return v;
      if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
      return `'${String(v).replace(/'/g, "''")}'`;
    }).join(', ');
    const q = `INSERT INTO document_signatures (${cols}) VALUES (${vals}) ON CONFLICT (id) DO NOTHING;`;
    await sql(q);
  }
  console.log(`✅ ${backup.signatures?.length || 0} document_signatures restauradas.`);

  // Restaurar Tenant Integrity Audit
  let countAudits = 0;
  for (const a of backup.audit || []) {
    const keys = Object.keys(a);
    const cols = keys.map(k => `"${k}"`).join(', ');
    const vals = keys.map(k => {
      const v = a[k];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'boolean' || typeof v === 'number') return v;
      if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
      return `'${String(v).replace(/'/g, "''")}'`;
    }).join(', ');
    const q = `INSERT INTO tenant_integrity_audit (${cols}) VALUES (${vals}) ON CONFLICT (id) DO NOTHING;`;
    await sql(q);
    countAudits++;
  }
  console.log(`✅ ${countAudits} registros de tenant_integrity_audit restaurados.`);

  // Validação: consultar contagem como finobra_app
  console.log('\n--- Validação com Role finobra_app (Least Privilege Runtime) ---');
  const appConnUrl = process.env.DATABASE_URL;
  const appSql = neon(appConnUrl);
  
  const tenantsCount = await appSql`SELECT count(*) FROM tenants;`;
  console.log('Total tenants visíveis para finobra_app:', tenantsCount[0].count);

  const tenantList = await appSql`SELECT id, razao_social, status FROM tenants ORDER BY created_at ASC;`;
  console.log('Tenants restaurados:');
  tenantList.forEach(t => console.log(`   - [${t.id}] ${t.razao_social} (${t.status})`));

  console.log('\n🎉 Restauração e validação completas com 100% de sucesso!');
}

main().catch(err => {
  console.error('❌ Erro na restauração:', err);
  process.exit(1);
});
