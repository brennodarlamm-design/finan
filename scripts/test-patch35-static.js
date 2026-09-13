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
const dataLayer = fs.readFileSync('js/data.js', 'utf8');
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
assert(!server.includes('json({ error: err.message })'), 'Backend não devolve err.message bruto em respostas JSON.');
assert(!server.includes('json({ success: false, error: err.message })'), 'Teste Neon não devolve detalhe interno bruto.');
assert(server.includes("error: 'Não foi possível enviar a mensagem pelo WhatsApp no momento.'"), 'Falha de envio WhatsApp usa mensagem pública estável.');
assert(server.includes("console.error('❌ [Neon] Falha no teste autenticado de conexão:'"), 'Detalhe de falha Neon permanece observável apenas no servidor.');
assert(server.includes("console.error('❌ [Cron] Falha na execução manual do resumo matinal:'"), 'Execução manual do cron captura rejeições assíncronas.');
assert(server.includes("error: 'Não foi possível executar a rotina matinal no momento.'"), 'Cron manual devolve falha pública controlada.');

assert(dataLayer.includes("console.error('[Sync] Falha crítica ao persistir fila offline:'"), 'Fila offline faz retry e registra falha crítica de persistência.');
assert(dataLayer.includes("console.error('[Sync] Falha crítica ao persistir fila de atenção:'"), 'Fila de atenção faz retry e registra falha crítica de persistência.');
assert(dataLayer.includes("if (!this._saveSyncFailed(failed))"), 'Item não sai da fila pendente se Requer atenção não foi persistido.');
assert((dataLayer.match(/if \(moved < 0\)/g) || []).length >= 2, 'Flush interrompe e agenda retry quando a fila de atenção não é durável.');
assert(dataLayer.includes("if (!this._saveSyncQueue(queue))"), 'Enfileiramento verifica sucesso real da persistência offline.');
assert(dataLayer.includes('Libere espaço no navegador antes de fechar esta aba.'), 'Usuário é avisado quando a fila offline não pode ser persistida.');
assert(dataLayer.includes("storageFailure:true"), 'Estado de sincronização expõe falha de storage para a interface.');

assert(auditWorkflow.includes('workflow_dispatch:'), 'Auditoria grande continua somente manual.');
assert(!auditWorkflow.includes('continue-on-error: true'), 'Auditorias de dependência são bloqueantes.');
assert((auditWorkflow.match(/npm audit --omit=dev --audit-level=moderate/g) || []).length === 2, 'Root e backend bloqueiam vulnerabilidades moderadas ou superiores.');
assert(auditWorkflow.includes('wrangler deploy --dry-run'), 'Auditoria Cloudflare continua dry-run, sem publicar produção.');

const corsFiles = [
  'api/auth.js',
  'api/reconhecer-documento.js',
  'api/nfe.js',
  'api/db.js',
  'api/upload.js',
  'api/whatsapp.js',
  'api/_certificado.js',
  'api/admin.js'
];
for (const file of corsFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert(!source.includes("Access-Control-Allow-Origin', '*"), `${file} não libera fallback CORS wildcard.`);
  assert(source.includes("res.setHeader('Vary', 'Origin')"), `${file} varia cache por Origin.`);
  assert(source.includes("res.setHeader('Access-Control-Allow-Origin', origin)"), `${file} continua refletindo apenas origem aprovada.`);
  assert(source.includes("Access-Control-Allow-Credentials', 'true"), `${file} preserva credenciais somente no ramo allowlisted.`);
}

console.log('\n✅ Patch 35 blocos 1–4: dependências, cron, CORS, erros e fila offline validados.');
