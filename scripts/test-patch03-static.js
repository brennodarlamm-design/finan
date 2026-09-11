import fs from 'fs';

let fails = 0;
function read(p){ return fs.readFileSync(p,'utf8'); }
function ok(name, cond){
  if(cond) console.log('✅ ' + name);
  else { console.error('❌ ' + name); fails++; }
}

const app = read('js/app.js');
const data = read('js/data.js');
const ass = read('js/assinador.js');
const val = read('validar.html') + '\n' + (fs.existsSync('js/validar_page.js') ? read('js/validar_page.js') : '');
const apiSig = read('api/assinaturas.js');
const migration = read('migrations/003_assinaturas_central.sql');
const contas = read('js/contas.js');
const backend = read('backend/server.js');
const utils = read('js/utils.js');
const contratos = read('js/contratos.js');
const recibos = read('js/recibos.js');

ok('Inicialização usa cache antes da sincronização bloqueante', app.indexOf('this.renderShell();') < app.indexOf('DB.syncFromCloud().then'));
ok('Interface possui indicador de sincronização', app.includes('sync-status-indicator') && data.includes("finobra:sync-status"));
ok('Fila de sincronização persiste operações pendentes', data.includes('_syncQueueKey()') && data.includes('_flushCloudQueue()'));
ok('Validação pública consulta API central', val.includes("fetch('/api/assinaturas?") && !val.includes('finobra_assinaturas_registry'));
ok('URL de validação não leva nome/CPF/papel', ass.includes("params.set('val'") && !/params\.set\(['\"](?:nome|doc|papel|data)['\"]/.test(ass));
ok('Assinatura usa código aleatório FIN-SIG', ass.includes('crypto.getRandomValues') && ass.includes('FIN-SIG-'));
ok('API de assinaturas exige registro real no Neon', apiSig.includes('FROM document_signatures') && apiSig.includes('resolveAuthAndTenant(req)'));
ok('Migração cria registro central de assinaturas', migration.includes('CREATE TABLE IF NOT EXISTS document_signatures'));
ok('Contas novas não recebem bancos fictícios da Angelim', /DEFAULT_CONTAS\s*:\s*\[\s*\]/.test(contas));
ok('Backend cron exige tenant e telefone explícitos', backend.includes('if (!TARGET_TENANT_ID || !TARGET_PHONE)') && !backend.includes("const TARGET_PHONE = process.env.TARGET_PHONE || '"));
ok('Backend não aceita API_SECRET por query/body', !backend.includes('queryToken') && !backend.includes("req.query?.secret"));
ok('Backend cron filtra lançamentos pelo tenant', backend.includes('l.tenant_id = ${TARGET_TENANT_ID}'));
ok('Utils.confirm escapa HTML por padrão', utils.includes('allowHtml') && utils.includes('this.escapeHtml'));
ok('Cláusulas de contratos são escapadas', contratos.includes('Utils.escapeHtml(cl.texto') && contratos.includes('Utils.escapeHtml(cl.titulo'));
ok('Recibos usam cidade/UF do tenant e escapam dados', recibos.includes('cidadeUfPadrao') && recibos.includes('Utils.safeUrl(emp.logo_url)'));
ok('Módulos principais não têm marca Angelim fixa', !/Angelim Construtora|ANGELIM CONSTRUTORA/i.test([ass,val,contas,contratos,recibos].join('\n')));

if (fails) {
  console.error(`\n❌ Patch 03: ${fails} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\n✅ Patch 03: todas as verificações passaram.');
