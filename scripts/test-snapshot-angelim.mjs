import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createRuntimeSql } from '../api/_database.js';
import { createTenantSql } from '../api/_tenant-sql.js';
import { handleFullSnapshot } from '../api/_db-queries.js';

async function main() {
  const baseSql = createRuntimeSql();
  const sql = createTenantSql(baseSql, { tenantId: 'angelim' });

  const fakeRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) {
      console.log('✅ handleFullSnapshot finalizado com sucesso!');
      console.log('Status:', this.statusCode);
      console.log('Success:', payload.success);
      console.log('Tenant:', payload.tenantId);
      console.log('Clientes:', payload.data?.clientes?.length);
      console.log('Lançamentos:', payload.data?.lancamentos?.length);
      console.log('Fornecedores:', payload.data?.fornecedores?.length);
      console.log('Notas:', payload.data?.notas?.length);
      console.log('Contas:', payload.data?.contas?.length);
      console.log('Documentos:', payload.data?.documentos?.length);
      console.log('\nPrimeiros 3 clientes:');
      for (const c of (payload.data?.clientes || []).slice(0, 3)) {
        console.log(`  - ${c.id}: ${c.nome} (${c.cliente})`);
      }
      return this;
    }
  };

  const auth = {
    authenticated: true,
    tenantId: 'angelim',
    user: { perfil: 'admin', tenantPlan: 'unlimited' }
  };

  await handleFullSnapshot(sql, 'angelim', auth, fakeRes);
}

main().catch(console.error);
