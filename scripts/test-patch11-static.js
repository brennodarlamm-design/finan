import fs from 'fs';
const read=p=>fs.readFileSync(p,'utf8');
let passed=0,failed=0; const test=(n,c)=>{ if(c){console.log('✅',n);passed++;}else{console.error('❌',n);failed++;} };
const auth=read('js/auth.js'), data=read('js/data.js'), docs=read('js/documentos.js'), nfe=read('js/nfe.js');
const migration=read('migrations/010_security_closure.sql'), admin=read('api/admin.js'), master=read('js/master.js');
const app=read('js/app.js'), vercel=read('vercel.json'), version=read('version.json'), guard=read('js/version_guard.js');

test('Browser não lê Bearer do storage', !/getToken\(\)[\s\S]{0,250}localStorage\.getItem/i.test(auth) && !/Authorization.*Bearer.*token/i.test(data));
test('Headers do frontend usam cookie + contexto tenant', /Cookie HttpOnly é a única credencial do navegador/i.test(data) && !/headers\['Authorization'\]/i.test(data));
test('Tenant frontend deriva apenas do snapshot da sessão', /getCurrentTenantId\(\)[\s\S]*session\?\.tenantId[\s\S]*return 'public'/i.test(auth));
test('Legado NFe não assume Angelim', !/finobra_angelim_nfe_cache/i.test(nfe));
test('Blob IndexedDB é sempre namespaceado por tenant', /return `\$\{tenant \|\| 'public'\}:\$\{String\(id \|\| ''\)\}`/i.test(docs));
test('Blob legado só migra se documento pertence ao tenant atual', /_ownsDocumentId/i.test(docs) && /Migração única do formato antigo/i.test(docs));
test('Migração 010 cria auditoria de integridade', /CREATE TABLE IF NOT EXISTS tenant_integrity_audit/i.test(migration));
test('Migração valida constraints apenas quando issue_count é zero', /IF issues=0[\s\S]*VALIDATE CONSTRAINT/i.test(migration));
test('Migração audita FKs compostas principais', /fk_lanc_obra_tenant/i.test(migration) && /fk_lanc_fornecedor_tenant/i.test(migration) && /fk_notas_obra_tenant/i.test(migration));
test('Master API expõe integridade sem alterar dados', /action === 'integrity_status'/i.test(admin) && /tenant_integrity_audit/i.test(admin));
test('Painel Master mostra integridade e Blob', /_renderIntegridade/i.test(master) && /Integridade Multi-Tenant/i.test(master));
test('Monitor captura violações CSP', /securitypolicyviolation/i.test(app));
test('CSP estrita permanece também em Report-Only para telemetria', /Content-Security-Policy-Report-Only/i.test(vercel) && /script-src-attr 'none'/i.test(vercel));
test('CSP ativa promove bloqueio de handlers inline', /"key": "Content-Security-Policy"[\s\S]{0,1800}script-src-attr 'none'/i.test(vercel) && !/script-src-attr 'unsafe-inline'/i.test(vercel));
let versionMeta = {};
try { versionMeta = JSON.parse(version); } catch {}
test('Version guard existe', /^20\d{2}\.\d{2}\.\d{2}-p\d+(?:[-._a-z0-9]*)?$/i.test(String(versionMeta.build || '')) && /FINOBRA_BUILD/i.test(guard) && /version\.json/i.test(guard));
console.log(`\nPatch 11: ${passed} passou, ${failed} falhou.`); if(failed) process.exit(1);
