import fs from 'fs';

const root = process.cwd();
const read = p => fs.readFileSync(`${root}/${p}`, 'utf8');
let passed = 0, failed = 0;
function test(name, cond) {
  if (cond) { console.log(`✅ ${name}`); passed++; }
  else { console.error(`❌ ${name}`); failed++; }
}

const migration = read('migrations/008_security_reliability.sql');
const schema = read('schema.sql');
const rl = read('api/_ratelimit.js');
const authCore = read('api/_auth.js');
const authApi = read('api/auth.js');
const db = read('api/db.js');
const data = read('js/data.js');
const app = read('js/app.js');
const sinapi = read('js/sinapi.js');
const orc = read('js/orcamento_sinapi.js');
const nfe = read('js/nfe.js');
const parser = read('js/nfe_parser.js');
const ofx = read('js/ofx.js');
const utils = read('js/utils.js');
const vercel = read('vercel.json');
const pkg = JSON.parse(read('package.json'));

// Rate limiting distribuído
test('Migração cria api_rate_limits', /CREATE TABLE IF NOT EXISTS api_rate_limits/i.test(migration));
test('Schema incorpora api_rate_limits', /CREATE TABLE IF NOT EXISTS api_rate_limits/i.test(schema));
test('Rate limit usa Neon compartilhado', /neon\(conn\)/i.test(rl) && /ON CONFLICT \(bucket_key\) DO UPDATE/i.test(rl));
test('Rate limit mantém fallback local restrito', /fallbackCheck/i.test(rl) && /safeLimit \* 0\.8/i.test(rl));
test('Rate limit limpa buckets expirados', /DELETE FROM api_rate_limits WHERE expires_at/i.test(rl));
test('Login usa rate limit assíncrono', /await checkRateLimit\(`login:/i.test(authApi));
test('Cadastro usa rate limit assíncrono', /await checkRateLimit\(`reg:/i.test(authApi));
test('Google possui rate limit por IP', /await checkRateLimit\(`google:/i.test(authApi));
test('Validação de OTP possui rate limit', /await checkRateLimit\(`verify-reset:/i.test(authApi));

// Cookie HttpOnly em migração compatível
test('Auth emite cookie HttpOnly', /HttpOnly/i.test(authApi) && /finobra_session_token/i.test(authApi));
test('Cookie usa SameSite e Secure em produção', /SameSite=Lax/i.test(authApi) && /parts\.push\('Secure'\)/i.test(authApi));
test('Auth aceita cookie como fallback', /getCookie\(req, 'finobra_session_token'\)/i.test(authCore));
test('Bearer continua prioritário para compatibilidade', /Bearer[\s\S]*x-api-key[\s\S]*getCookie/i.test(authCore));
test('Logout remove cookie no servidor', /clearSessionCookie/i.test(authApi) && /Max-Age=0/i.test(authApi));
test('Resposta de autenticação não é cacheada', /Cache-Control', 'no-store/i.test(authApi));
test('Login ainda retorna token durante fase de transição', /success:\s*true,\s*token,/i.test(authApi));

// SINAPI correto por contexto
test('SINAPI declara snapshots com UF, competência e série', /OFFICIAL_SNAPSHOTS/i.test(sinapi) && /uf:'RR'/i.test(sinapi) && /referencia:'2024-12'/i.test(sinapi));
test('Snapshot 1-clique exige correspondência exata', /snapshotFor\(uf, referencia, desonerado/i.test(sinapi) && /x\.uf===u && x\.referencia===r/i.test(sinapi));
test('SINAPI não usa mais fallback falso /api/sinapi', !/fetch\(`?\/api\/sinapi/i.test(sinapi) && !/"source": "\/api\/sinapi"/i.test(vercel));
test('UI informa quando não existe snapshot da seleção', /Sem snapshot 1-clique/i.test(orc));
test('UI envia UF e referência ao carregar snapshot', /SINAPI\.puxarOficial\(orc\.desonerado, orc\.uf, orc\.referencia_sinapi/i.test(orc));
test('Busca SINAPI usa UF e referência do orçamento', /SINAPI\.buscar\(termo, orc\.desonerado, 30, orc\.uf, orc\.referencia_sinapi\)/i.test(orc));
test('Cache SINAPI diferencia UF, referência e série', /finobra_sinapi_base_/i.test(sinapi) && /desonerado \? 'des' : 'on'/i.test(sinapi));
test('Seleção ativa SINAPI continua isolada por tenant', /finobra_\$\{this\._tenant\(\)\}_sinapi_active_/i.test(sinapi));
test('Cache SINAPI legado é migrado com metadados', /_migrateLegacyBase/i.test(sinapi) && /sinapi_base_desonerado/i.test(sinapi));

// Sync sem perda silenciosa
test('sync_all registra falhas por item', /const failures = \[\]/i.test(db) && /recordFailure/i.test(db));
test('sync_all retorna 207 em falha parcial', /res\.status\(207\)/i.test(db) && /partial:\s*true/i.test(db));
test('Cliente reconhece sync parcial como falha', /partialFailure/i.test(data) && /SYNC_PARTIAL/i.test(data));
test('Retry é persistido na fila', /_updateQueuedItem\(item, \{ _retries:retries/i.test(data));
test('Falha repetida vai para Requer atenção e não é apagada', /_moveSyncItemToAttention/i.test(data) && /MAX_RETRIES/i.test(data));
test('Fila de atenção pode ser reenviada manualmente', /retryFailedSyncItems/i.test(data));
test('Interface mostra estado Requer atenção', /attention: \['⚠'/i.test(app) && /retrySyncIssues/i.test(app));
test('Coalescência preserva última versão offline', /Coalesce saves/i.test(data) && /updatedAt:new Date\(\)\.toISOString\(\), payload/i.test(data));

// XSS residual em fontes externas
test('Erros/status de NF-e são escapados', /escapeHtml\(resultado\.status/i.test(nfe) && /escapeHtml\(err\?\.message/i.test(nfe));
test('Parser de NF-e escapa arquivo e status externo', /escapeHtml\(item\.arquivo/i.test(parser) && /escapeHtml\(item\.statusMessage/i.test(parser));
test('OFX escapa instituição e conta do arquivo', /escapeHtml\(data\.org/i.test(ofx) && /escapeHtml\(data\.acctId/i.test(ofx));
test('OFX escapa memo e descrição antes do innerHTML', /e\(trn\.memo\.slice/i.test(ofx) && /title="\$\{e\(t\.memo\)\}"/i.test(ofx));
test('OFX protege IDs externos usados em handlers inline', /escapeJsAttr/i.test(utils) && /j\(t\.id\)/i.test(ofx));
test('Resultados SINAPI externos são escapados', /escapeHtml\(resultado\.msg/i.test(orc));

// Headers / suíte
test('HSTS habilitado na Vercel', /Strict-Transport-Security/i.test(vercel));
test('Package expõe comando de teste Patch 09', !!pkg.scripts?.['test:patch09']);

console.log(`\nPatch 09: ${passed} passou, ${failed} falhou.`);
if (failed) process.exit(1);
