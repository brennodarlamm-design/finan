// Verificações estáticas de segurança do patch SaaS (não acessa banco nem internet)
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let failed = 0;
function ok(name, cond) {
  console.log(`${cond ? '✅' : '❌'} ${name}`);
  if (!cond) failed++;
}

const auth = read('api/_auth.js');
const admin = read('api/admin.js');
const master = read('js/master.js');
const masterHtml = read('master.html');
const wa = read('js/whatsapp.js');
const cfg = read('js/configuracoes.js');
const data = read('js/data.js');

ok('Superadmin não depende de username=admin', !/username\s*===\s*['"]admin['"]/.test(auth + admin + master + masterHtml));
ok('API_SECRET não é aceito em query string na autenticação', !/req\.query\s*&&\s*req\.query\.secret|req\.query\.secret/.test(auth));
ok('WhatsApp frontend não contém chave Evolution hardcoded', !/ANGELIM-FINANCAS-EVOLUTION|finobra_evolution_key/.test(wa));
ok('Painel Master usa data.success', !/data\.ok/.test(master) && /data\.success/.test(master));
ok('Configuração de usuários grava via /api/users', /fetch\('\/api\/users'/.test(cfg));
ok('Configuração de empresa grava via /api/tenant', /fetch\('\/api\/tenant'/.test(cfg));
ok('Fila de sincronização está habilitada', /_syncQueueKey\(\)/.test(data) && /_flushCloudQueue\(\)/.test(data));
ok('Auth live consulta usuários/tenants no Neon', /FROM usuarios u[\s\S]*JOIN tenants t/.test(auth));

if (failed) {
  console.error(`\n${failed} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\n✅ Hardening estático: todas as verificações passaram.');
