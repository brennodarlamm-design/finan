// scripts/provision-tenant-keys.js
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import {
  generateTenantAccessKey,
  hashTenantAccessKey,
  tenantAccessKeyLast4,
  isTenantAccessKeyShapeValid
} from '../api/_tenant-access-key.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('ERRO: DATABASE_URL não configurada.');
  process.exit(1);
}

const sql = neon(conn);
const isExecute = process.argv.includes('--execute');

async function main() {
  console.log(`=== Provisionamento Seguro de Chaves da Empresa (Tenants) ===`);
  console.log(`Modo: ${isExecute ? 'EXECUÇÃO (GRAVAR NO BANCO)' : 'DRY-RUN (SOMENTE LEITURA)'}\n`);

  const tenants = await sql`
    SELECT id, razao_social, nome_fantasia, cnpj, status, access_key_hash, access_key_last4, access_key_created_at
    FROM tenants
    ORDER BY created_at ASC;
  `;

  console.log(`Total de tenants encontrados: ${tenants.length}\n`);

  const provisioned = [];

  for (const t of tenants) {
    const hasKey = Boolean(t.access_key_hash);
    console.log(`------------------------------------------------------------`);
    console.log(`Tenant ID: ${t.id}`);
    console.log(`Nome Fantasia: ${t.nome_fantasia || '(sem nome)'}`);
    console.log(`Razão Social: ${t.razao_social || '(sem razão)'}`);
    console.log(`CNPJ: ${t.cnpj || '(sem cnpj)'}`);
    console.log(`Status: ${t.status}`);
    console.log(`Chave Atual: ${hasKey ? `Ativa (Final ${t.access_key_last4})` : 'SEM CHAVE (NULL)'}`);

    if (!hasKey) {
      const rawKey = generateTenantAccessKey();
      const keyHash = hashTenantAccessKey(rawKey);
      const last4 = tenantAccessKeyLast4(rawKey);

      if (!isTenantAccessKeyShapeValid(rawKey)) {
        throw new Error(`Chave gerada inválida para tenant ${t.id}: ${rawKey}`);
      }

      console.log(`>> NOVA CHAVE GERADA: ${rawKey}`);
      console.log(`>> Hash SHA-256: ${keyHash}`);
      console.log(`>> Final: ${last4}`);

      if (isExecute) {
        await sql`
          UPDATE tenants
          SET access_key_hash = ${keyHash},
              access_key_last4 = ${last4},
              access_key_created_at = NOW(),
              updated_at = NOW()
          WHERE id = ${t.id};
        `;
        console.log(`>> [SUCESSO] Atualizado no banco de dados!`);
      } else {
        console.log(`>> [DRY-RUN] Nenhuma alteração feita. Execute com --execute para aplicar.`);
      }

      provisioned.push({
        id: t.id,
        nome: t.nome_fantasia || t.razao_social,
        cnpj: t.cnpj,
        status: t.status,
        accessKey: rawKey,
        last4
      });
    } else {
      console.log(`>> Ignorado (chave já configurada).`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`Resumo do Provisionamento:`);
  console.log(`Total provisionados: ${provisioned.length}`);
  if (provisioned.length > 0) {
    console.log(`\nGUARDAR ESTAS CHAVES EM LOCAL SEGURO PARA ENTREGA AOS CLIENTES:`);
    for (const item of provisioned) {
      console.log(`- ${item.nome} (${item.status}) [ID: ${item.id}]:`);
      console.log(`  Chave da Empresa: ${item.accessKey}`);
    }
  }
}

main().catch(err => {
  console.error('Falha na execução:', err);
  process.exit(1);
});
