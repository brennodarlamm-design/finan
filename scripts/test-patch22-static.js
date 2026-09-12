import fs from 'fs';

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const patch = read('js/patch22.js');
const app = read('app.html');
const db = read('api/db.js');
const auth = read('api/auth.js');
const backend = read('backend/server.js');
const migration = read('migrations/015_engineering_config_persistence.sql');
const runner = read('scripts/run-migration.js');

const checks = [
  ['Patch 22 carregado depois de obra_detalhe', app.includes('/js/patch22.js') && app.indexOf('/js/patch22.js') > app.indexOf('/js/obra_detalhe.js')],
  ['Cronograma aceita restauração null', patch.includes('config == null') && patch.includes('cronograma_config: null')],
  ['Cronograma normaliza array/objeto e código', patch.includes('normalizeEtapas') && patch.includes('codigo: l.codigo || l.id')],
  ['BDI normaliza SG/T e persiste padrão do tenant', patch.includes('normalizeBdi') && patch.includes('bdi_padrao: normalized') && patch.includes('saveTenantPreferences')],
  ['API persiste cronograma_config', db.includes('cronograma_config') && db.includes('sanitizeCronogramaConfig')],
  ['API persiste bdi_config e bdi_padrao', db.includes('bdi_config') && db.includes('bdi_padrao') && db.includes('sanitizeBdiConfig')],
  ['Migration 015 cria as colunas de engenharia', migration.includes('cronograma_config JSONB') && migration.includes('bdi_config JSONB')],
  ['Runner usa transação real', runner.includes('sql.transaction') && runner.includes('checksum')],
  ['Recovery usa requestId opaco', auth.includes('requestId') && !auth.includes('userName: user.nome')],
  ['Recovery exige 8 caracteres', auth.includes('newPassword).length < 8') || auth.includes('newPassword.length < 8')],
  ['WhatsApp não autentica QR por query token', !backend.includes('req.query.token')],
  ['WhatsApp usa cookie HttpOnly assinado', backend.includes('HttpOnly') && backend.includes('signQrAccess') && backend.includes('timingSafeEqual')],
  ['Status WhatsApp exige autenticação', backend.includes("app.get('/status', requireAuth")],
  ['Health não expõe tenants', backend.includes("app.get('/health'") && !backend.includes("tenants: Array.from")]
];
let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`✓ ${name}`);
  else { console.error(`✗ ${name}`); failed++; }
}
console.log(`\nPatch 22: ${checks.length - failed}/${checks.length} verificações passaram.`);
if (failed) process.exit(1);
