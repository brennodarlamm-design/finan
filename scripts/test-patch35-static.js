import fs from 'fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

const pkg = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
const server = fs.readFileSync('backend/server.js', 'utf8');
const auditWorkflow = fs.readFileSync('.github/workflows/patch35-audit.yml', 'utf8');

assert(/^\^?4\./.test(pkg.dependencies?.['node-cron'] || ''), 'Backend usa node-cron 4.x sem cadeia legada de uuid vulnerável.');
assert(pkg.dependencies?.express === '^4.22.2', 'Backend fixa a linha Express 4.22.2 atualizada.');
assert(pkg.overrides?.qs === '6.16.0', 'Backend força qs corrigido via override determinístico.');

assert(server.includes("cron.schedule('0 8 * * *'"), 'Resumo matinal agenda 08:00 em horário local explícito.');
assert(server.includes("timezone: 'America/Boa_Vista'"), 'Cron diário usa timezone America/Boa_Vista.');
assert(server.includes("name: 'finobra-daily-summary'"), 'Cron diário possui identificação operacional.');
assert(server.includes("name: 'finobra-keep-alive'"), 'Keep-alive possui identificação operacional.');
assert((server.match(/noOverlap: true/g) || []).length >= 2, 'Crons críticos impedem execuções sobrepostas.');
assert(server.includes('await executarResumoMatinal();'), 'Agendador aguarda o resumo matinal assíncrono.');
assert(server.includes("console.error('❌ [Cron] Falha no resumo matinal:'"), 'Falha assíncrona do resumo matinal é observável e tratada.');

assert(auditWorkflow.includes('workflow_dispatch:'), 'Auditoria grande continua somente manual.');
assert(!auditWorkflow.includes('continue-on-error: true'), 'Auditorias de dependência são bloqueantes.');
assert((auditWorkflow.match(/npm audit --omit=dev --audit-level=moderate/g) || []).length === 2, 'Root e backend bloqueiam vulnerabilidades moderadas ou superiores.');
assert(auditWorkflow.includes('wrangler deploy --dry-run'), 'Auditoria Cloudflare continua dry-run, sem publicar produção.');

console.log('\n✅ Patch 35 bloco 1: dependências, cron e gates de segurança validados.');
