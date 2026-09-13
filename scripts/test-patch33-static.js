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
assert(build.includes('process.env.GITHUB_SHA'), 'Build deve registrar o SHA do GitHub Actions.');
assert(build.includes("source: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local-build'"), 'Build deve registrar a origem do deploy.');
assert(build.includes("fs.writeFileSync(path.join(out, 'version.json')"), 'Build deve sobrescrever version.json dentro de dist.');
assert(build.includes("deploymentMetadata.commit === 'unknown'"), 'Build deve falhar quando não conseguir identificar o commit.');

assert(worker.includes('async function readDeploymentMetadata(request, env)'), 'Worker deve ler os metadados publicados.');
assert(worker.includes("new URL('/version.json', request.url)"), 'Worker deve obter version.json do binding de assets.');
assert(worker.includes('deploymentMetadataOk'), 'Health deve indicar validade dos metadados de deploy.');
assert(worker.includes('deployment'), 'Health deve expor os dados do deploy.');
assert(worker.includes('const healthy = configOk && !loopRisk && deploymentMetadataOk'), 'Health deve falhar se a procedência do deploy não estiver disponível.');

assert(workflow.includes('"deploymentMetadataOk":true'), 'Smoke test deve exigir metadados válidos.');
assert(workflow.includes('"commit\\":\\"$GITHUB_SHA"') || workflow.includes('"commit\\":\\"$GITHUB_SHA\\"'), 'Smoke test deve comparar o SHA publicado com GITHUB_SHA.');
assert(workflow.includes('https://finobra.app.br/version.json'), 'Smoke test deve validar version.json publicado.');
assert(workflow.includes('"source":"github-actions"'), 'Smoke test deve confirmar origem GitHub Actions.');
assert(workflow.includes('Production smoke test passed for commit $GITHUB_SHA.'), 'Log final deve identificar o commit validado.');

console.log('✅ Patch 33: proveniência de deploy e verificação do commit em produção validadas.');
