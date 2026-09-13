import fs from 'fs';

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
}

const build = fs.readFileSync('scripts/build-cloudflare-pages.cjs', 'utf8');
const worker = fs.readFileSync('cloudflare-worker.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/production-cicd.yml', 'utf8');

assert(build.includes('function writeDeploymentMetadata()'), 'Build deve gerar metadados de deploy.');
assert(build.includes('function resolveBuildContext()'), 'Build deve identificar o provedor de CI/CD.');
assert(build.includes('process.env.GITHUB_SHA'), 'Build deve registrar o SHA do GitHub Actions.');
assert(build.includes('process.env.WORKERS_CI_COMMIT_SHA'), 'Build pode reconhecer metadados legados do Workers Builds para rastreabilidade.');
assert(build.includes('process.env.WORKERS_CI_BUILD_UUID'), 'Build pode reconhecer UUID legado do Workers Builds.');
assert(build.includes('process.env.WORKERS_CI_BRANCH'), 'Build pode reconhecer branch legado do Workers Builds.');
assert(build.includes("source: 'github-actions'"), 'Build deve reconhecer GitHub Actions.');
assert(build.includes("source: 'cloudflare-workers-builds'"), 'Build deve continuar capaz de identificar um build Cloudflare caso seja executado manualmente/legado.');
assert(build.includes("fs.writeFileSync(path.join(out, 'version.json')"), 'Build deve sobrescrever version.json dentro de dist.');
assert(build.includes("deploymentMetadata.commit === 'unknown'"), 'Build deve falhar quando não conseguir identificar o commit.');

assert(worker.includes('async function readDeploymentMetadata(request, env)'), 'Worker deve ler os metadados publicados.');
assert(worker.includes("new URL('/version.json', request.url)"), 'Worker deve obter version.json do binding de assets.');
assert(worker.includes('deploymentMetadataOk'), 'Health deve indicar validade dos metadados de deploy.');
assert(worker.includes('deployment'), 'Health deve expor os dados do deploy.');
assert(worker.includes('const healthy = configOk && !loopRisk && deploymentMetadataOk'), 'Health deve falhar se a procedência do deploy não estiver disponível.');

assert(workflow.includes('"deploymentMetadataOk":true'), 'Smoke test deve exigir metadados válidos.');
assert(workflow.includes('$GITHUB_SHA'), 'Smoke test deve comparar o SHA publicado com GITHUB_SHA.');
assert(workflow.includes('https://finobra.app.br/version.json'), 'Smoke test deve validar version.json publicado.');
assert(workflow.includes('"source":"github-actions"'), 'Deploy de produção controlado deve exigir GitHub Actions como origem.');
assert(!workflow.includes('"source":"cloudflare-workers-builds"'), 'Workflow de produção não deve aceitar Workers Builds concorrente após a desconexão.');
assert(workflow.includes('Production smoke test passed for commit $GITHUB_SHA'), 'Log final deve identificar o commit validado, podendo acrescentar o contrato de smoke atual.');

console.log('✅ Patch 33/38: proveniência preservada e produção restrita ao deploy controlado via GitHub Actions.');
