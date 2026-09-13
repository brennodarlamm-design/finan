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
const nfeApi = fs.readFileSync('api/nfe.js', 'utf8');
const whatsappApi = fs.readFileSync('api/whatsapp.js', 'utf8');
const ocrApi = fs.readFileSync('api/reconhecer-documento.js', 'utf8');
const usersApi = fs.readFileSync('api/users.js', 'utf8');
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

assert(nfeApi.includes('AbortSignal.timeout(7000)'), 'Consulta pública de CNPJ possui timeout explícito.');
assert((nfeApi.match(/AbortSignal\.timeout\(15000\)/g) || []).length >= 4, 'Operações de leitura/consulta MeuDanfe possuem timeout explícito.');
assert(nfeApi.includes('AbortSignal.timeout(20000)'), 'Envio de XML para MeuDanfe possui timeout explícito.');
assert(!/detail:\s*err(?:Cep)?\.message/.test(nfeApi), 'NF-e/CNPJ/CEP não devolvem exceções internas ao navegador.');
assert(nfeApi.includes("const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'"), 'NF-e diferencia timeout de falha genérica sem expor stack interna.');

assert(!whatsappApi.includes("error: 'Falha ao solicitar desconexão ao servidor Render: ' + err.message"), 'Proxy WhatsApp não concatena exceção interna na resposta de reset.');
assert(!whatsappApi.includes('details: data'), 'Proxy WhatsApp não devolve payload bruto de erro do Render.');
assert(!whatsappApi.includes('json({ success: false, error: err.message })'), 'Proxy WhatsApp não devolve err.message bruto.');
assert((whatsappApi.match(/AbortSignal\.timeout\(/g) || []).length >= 5, 'Chamadas do proxy WhatsApp continuam limitadas por timeout.');

assert(ocrApi.includes('AbortSignal.timeout(35000)'), 'OCR OpenAI possui timeout abaixo do limite da função.');
assert(ocrApi.includes('AbortSignal.timeout(20000)'), 'Fallback Gemini possui timeout por tentativa.');
assert(!ocrApi.includes('detalhe: erroConsolidado'), 'OCR não devolve erro consolidado bruto dos provedores.');
assert(!ocrApi.includes('detalhe: err.message'), 'OCR não devolve exceção interna inesperada.');
assert(ocrApi.includes('/credit_balance_exhausted|insufficient_quota/i'), 'OCR mantém detecção interna de limite de uso para mensagem amigável.');
assert(usersApi.includes('AbortSignal.timeout(15000)'), 'FinBot ChatGPT possui timeout explícito e fallback local.');

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
const wildcardCorsLiteral = "Access-Control-Allow-Origin', " + "'*";
for (const file of corsFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert(!source.includes(wildcardCorsLiteral), `${file} não libera fallback CORS wildcard.`);
  assert(source.includes("res.setHeader('Vary', 'Origin')"), `${file} varia cache por Origin.`);
  assert(source.includes("res.setHeader('Access-Control-Allow-Origin', origin)"), `${file} continua refletindo apenas origem aprovada.`);
  assert(source.includes("Access-Control-Allow-Credentials', 'true"), `${file} preserva credenciais somente no ramo allowlisted.`);
}

console.log('\n✅ Patch 35 blocos 1–5: dependências, cron, CORS, erros, fila offline e upstreams validados.');
