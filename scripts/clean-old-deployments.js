// scripts/clean-old-deployments.js
// Limpeza automatizada de deployments antigos no Vercel para liberação de Deployment Storage
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error('VERCEL_TOKEN ausente.');
  process.exit(1);
}

const projectId = 'prj_3qDU2AdJGoQJmHT6JgALUyROhtzm';
const teamId = 'team_ylnZdlb9zHA7t3DQz1Kq4mDF';

async function fetchAllDeployments() {
  let all = [];
  let until = null;

  while (true) {
    let url = `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=100`;
    if (until) url += `&until=${until}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Erro ao listar deployments:', data);
      break;
    }

    const list = data.deployments || [];
    if (!list.length) break;

    all.push(...list);
    console.log(`Carregados ${all.length} deployments...`);

    if (list.length < 100) break;
    until = list[list.length - 1].created;
  }

  return all;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== LIMPEZA DE DEPLOYMENTS ANTIGOS NO VERCEL ===');
  console.log('1. Carregando lista completa de deployments...');
  const allDeployments = await fetchAllDeployments();
  console.log(`Total encontrado: ${allDeployments.length} deployments.`);

  // Separa produção e preview
  const prod = allDeployments.filter(d => d.target === 'production');
  const preview = allDeployments.filter(d => d.target !== 'production');

  console.log(`- Produção: ${prod.length}`);
  console.log(`- Preview: ${preview.length}`);

  // Preserva os 2 deploys mais recentes de produção (rollback safety)
  const KEEP_PROD_COUNT = 2;
  const prodToKeep = prod.slice(0, KEEP_PROD_COUNT);
  const prodToDelete = prod.slice(KEEP_PROD_COUNT);

  console.log('\n🔒 Deployments de produção PRESERVADOS (Rollback Safety):');
  prodToKeep.forEach(d => {
    console.log(`  ✓ ${d.uid} | ${d.state} | ${new Date(d.created).toISOString()} | ${d.url}`);
  });

  // Todos os previews e deploys de produção antigos serão excluídos
  const toDelete = [...preview, ...prodToDelete];
  console.log(`\n🗑️ Total de deployments elegíveis para exclusão: ${toDelete.length}`);
  console.log(`  - ${preview.length} previews/branches`);
  console.log(`  - ${prodToDelete.length} versões antigas de produção`);

  if (!toDelete.length) {
    console.log('Nenhum deployment antigo para deletar.');
    return;
  }

  let deletedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < toDelete.length; i++) {
    const d = toDelete[i];
    process.stdout.write(`[${i + 1}/${toDelete.length}] Deletando ${d.uid} (${d.target || 'preview'})... `);

    try {
      const res = await fetch(`https://api.vercel.com/v13/deployments/${d.uid}?teamId=${teamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        deletedCount++;
        console.log('OK');
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.log(`FALHA (${res.status}): ${errJson.error?.message || errJson.message || 'Erro desconhecido'}`);
        errorCount++;
      }
    } catch (e) {
      console.log(`ERRO: ${e.message}`);
      errorCount++;
    }

    // Pequena pausa a cada 5 requisições para respeitar rate limits da Vercel
    if (i % 5 === 0) {
      await sleep(250);
    }
  }

  console.log('\n=== RESULTADO DA LIMPEZA ===');
  console.log(`Deployments excluídos com sucesso: ${deletedCount}`);
  console.log(`Erros/Não excluídos: ${errorCount}`);
  console.log('Deployment Storage liberado na conta Vercel!');
}

main().catch(console.error);
