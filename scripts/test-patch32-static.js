import fs from 'fs';

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
}

const workflowPath = '.github/workflows/production-cicd.yml';
assert(fs.existsSync(workflowPath), 'Workflow de produção do Patch 32 deve existir.');

const workflow = fs.readFileSync(workflowPath, 'utf8');
const pkg = fs.readFileSync('package.json', 'utf8');

assert(workflow.includes('name: FinObra production CI/CD'), 'Workflow deve ter identificação de produção.');
assert(workflow.includes('      - main'), 'Workflow deve reagir a push no branch main.');
assert(workflow.includes('workflow_dispatch:'), 'Workflow deve permitir execução manual controlada.');
assert(workflow.includes('cancel-in-progress: false'), 'Deploy de produção não deve cancelar execução anterior no meio do processo.');
assert(workflow.includes('run: npm test'), 'Pipeline deve executar regressão completa antes do deploy.');
assert(workflow.includes('node scripts/check-all-syntax.js'), 'Pipeline deve verificar sintaxe antes do deploy.');
assert(workflow.includes('npm run build:cloudflare'), 'Pipeline deve construir assets Cloudflare.');
assert(workflow.includes('wrangler deploy --dry-run'), 'Pipeline deve validar bundle Wrangler antes do deploy real.');
assert(workflow.includes('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}'), 'Token Cloudflare deve vir de GitHub Actions secret.');
assert(workflow.includes('CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}'), 'Account ID Cloudflare deve vir de GitHub Actions secret.');
assert(workflow.includes("if: steps.cloudflare.outputs.ready == 'true'"), 'Deploy deve ser protegido por checagem de credenciais.');
assert(workflow.includes('Cloudflare deploy skipped.'), 'Ausência de secrets deve gerar aviso, não deploy inseguro.');
assert(workflow.includes("'\"securityMode\":\"nonce-csp\"'"), 'Smoke test deve validar CSP nonce em produção.');
assert(workflow.includes("'\"loopRisk\":false'"), 'Smoke test deve validar proteção contra loop.');
assert(workflow.includes('https://www.finobra.app.br/'), 'Smoke test deve verificar canonicalização do www.');
assert(workflow.includes("auth_status"), 'Smoke test deve verificar rota de autenticação sem credenciais.');
assert(workflow.includes("[[ \"$auth_status\" == '401' ]]"), 'Auth smoke test deve esperar 401 para usuário não autenticado.');
assert(pkg.includes('"deploy:cloudflare": "npx wrangler deploy"'), 'Deploy deve reutilizar script Wrangler versionado no package.json.');

console.log('✅ Patch 32: CI/CD de produção, secrets guard e smoke tests validados.');
