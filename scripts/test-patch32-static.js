import fs from 'fs';

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
}

const workflowPath = '.github/workflows/production-cicd.yml';
assert(fs.existsSync(workflowPath), 'Workflow de produção deve existir.');

const workflow = fs.readFileSync(workflowPath, 'utf8');
const pkg = fs.readFileSync('package.json', 'utf8');

assert(workflow.includes('name: FinGo CI / manual Cloudflare production deploy'), 'Workflow deve identificar CI e deploy manual Cloudflare.');
assert(workflow.includes('      - main'), 'Workflow deve validar pushes no branch main.');
assert(workflow.includes('workflow_dispatch:'), 'Workflow deve permitir execução manual controlada.');
assert(workflow.includes('deploy_production:'), 'Deploy manual deve exigir confirmação explícita.');
assert(workflow.includes("github.event_name == 'workflow_dispatch'"), 'Deploy real não pode executar em push comum.');
assert(workflow.includes("github.ref == 'refs/heads/main'"), 'Deploy real só pode partir do branch main.');
assert(workflow.includes('inputs.deploy_production == true'), 'Deploy real deve exigir confirmação booleana.');
assert(workflow.includes('cancel-in-progress: true'), 'Execuções antigas devem ser canceladas.');
assert(workflow.includes('run: npm test'), 'Pipeline deve executar regressão completa antes de qualquer deploy.');
assert(workflow.includes('node scripts/check-all-syntax.js'), 'Pipeline deve verificar sintaxe.');
assert(workflow.includes('npm run build:cloudflare'), 'Pipeline deve construir assets Cloudflare.');
assert(workflow.includes('wrangler deploy --dry-run'), 'Pipeline deve validar bundle Wrangler sem publicar.');
assert(workflow.includes('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}'), 'Token Cloudflare deve vir de GitHub Actions secret.');
assert(workflow.includes('CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}'), 'Account ID Cloudflare deve vir de GitHub Actions secret.');
assert(workflow.includes('manual production deploy enabled'), 'Checagem de credenciais deve deixar claro que o deploy é manual.');
assert(workflow.includes("'\"securityMode\":\"nonce-csp\"'"), 'Smoke test deve validar CSP nonce em produção.');
assert(workflow.includes("'\"loopRisk\":false'"), 'Smoke test deve validar proteção contra loop.');
assert(workflow.includes("check_route 'https://fingo.api.br/' 'landing-shell'"), 'Smoke test deve validar diretamente o domínio canônico FinGo.');
assert(workflow.includes('auth_status'), 'Smoke test deve verificar rota de autenticação sem credenciais.');
assert(workflow.includes("[[ \"$auth_status\" == '401' ]]"), 'Auth smoke test deve esperar 401 para usuário não autenticado.');
const hasLegacyAppStatus = workflow.includes('app_status=');
const hasStructuredAppCheck = workflow.includes('check_route') &&
  (workflow.includes("'https://fingo.api.br/app/dashboard' 'app-shell'") || workflow.includes("'https://finobra.app.br/app/dashboard' 'app-shell'")) &&
  workflow.includes("'<div id=\"app-root\"></div>'");
assert(hasLegacyAppStatus || hasStructuredAppCheck, 'Smoke test deve validar deep link do app por GET, incluindo shell e conteúdo.');
assert(!workflow.includes("if: steps.cloudflare.outputs.ready == 'true'"), 'Deploy não deve depender de fluxo automático por push.');
assert(pkg.includes('"deploy:cloudflare": "npx wrangler deploy"'), 'Deploy deve reutilizar script Wrangler versionado no package.json.');

console.log('✅ Patch 32/38: pushes validam sem publicar; deploy de produção é manual/controlado e smoke cobre o deep link do app.');
