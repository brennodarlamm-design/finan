import fs from 'fs';
const read=p=>fs.readFileSync(p,'utf8');
let passed=0,failed=0; const test=(n,c)=>{ if(c){console.log('✅',n);passed++;}else{console.error('❌',n);failed++;} };
const migration=read('migrations/009_cookie_csp_tenant_integrity.sql');
const schema=read('schema.sql');
const authCore=read('api/_auth.js');
const authApi=read('api/auth.js');
const admin=read('api/admin.js');
const auth=read('js/auth.js');
const master=read('js/master.js');
const app=read('js/app.js');
const upload=read('api/upload.js');
const docs=read('js/documentos.js');
const vercel=read('vercel.json');
const htmls=['index.html','master.html','validar.html','landing.html','app.html'].map(read).join('\n');

test('Migração remove defaults implícitos de tenant', /ALTER TABLE obras\s+ALTER COLUMN tenant_id DROP DEFAULT/i.test(migration) && /ALTER TABLE lancamentos\s+ALTER COLUMN tenant_id DROP DEFAULT/i.test(migration));
test('Migração protege tenant obrigatório em novas gravações', /CHECK \(tenant_id IS NOT NULL\) NOT VALID/i.test(migration));
test('Migração cria FK composta lançamento→obra', /fk_lanc_obra_tenant/i.test(migration) && /FOREIGN KEY \(tenant_id, obra_id\)/i.test(migration));
test('Migração cria FK composta lançamento→fornecedor/nota', /fk_lanc_fornecedor_tenant/i.test(migration) && /fk_lanc_nota_tenant/i.test(migration));
test('Schema novo não possui DEFAULT angelim', !/tenant_id VARCHAR\(64\) DEFAULT 'angelim'/i.test(schema));
test('Schema novo usa tenant obrigatório nas tabelas operacionais', /CREATE TABLE IF NOT EXISTS obras[\s\S]*tenant_id VARCHAR\(64\) NOT NULL REFERENCES tenants/i.test(schema));

test('Cookie HttpOnly é credencial primária com compatibilidade Bearer', /source: 'cookie'/i.test(authCore) && /source: 'bearer'/i.test(authCore));
test('Mutações por cookie validam Origin contra CSRF', /cookieMutationOriginAllowed/i.test(authCore) && /Origem da requisição não autorizada/i.test(authCore));
test('Auth promove Bearer legado para cookie HttpOnly', /promove a mesma credencial[\s\S]*setSessionCookie/i.test(authApi));
test('Bearer de compatibilidade exige opt-in explícito', authApi.includes('x-finobra-token-mode') && authApi.includes('tokenFieldForExplicitClient(req, token)'));
test('Frontend não persiste token em novo login', /credencial fica exclusivamente no cookie HttpOnly/i.test(auth) && /_purgeLegacyToken/i.test(auth));
test('Sessão visual não exige token legível por JS', /isLoggedIn\(\)[\s\S]*return !!this\.getSession\(\)/i.test(auth));
test('App valida sessão online antes de abrir dados', /firstCheck = await Auth\.refreshSessionFromServer/i.test(app));

test('Impersonação Master usa cookie HttpOnly', /MASTER_RESTORE_COOKIE/i.test(admin) && /cookieAuth: true/i.test(admin));
test('Master restaura sessão no servidor', /restore_master_session/i.test(admin) && /restore_master_session/i.test(auth));
test('Frontend Master não grava token de impersonação', !/setItem\(['"]finobra_token['"],\s*data\.token/i.test(master));

test('CSP está habilitada', /Content-Security-Policy/i.test(vercel) && /object-src 'none'/i.test(vercel) && /frame-ancestors 'self'/i.test(vercel));
test('CSP bloqueia script inline comum', /script-src 'self'[^;]*; script-src-attr 'unsafe-inline'/i.test(vercel) && !/script-src 'self'[^;]*'unsafe-inline'/i.test(vercel));
test('HTMLs principais não têm bloco script inline', !/<script(?![^>]*\bsrc=)[^>]*>\s*[^<\s]/i.test(htmls));
test('Scripts de página foram externalizados', /\/js\/login_page\.js/i.test(htmls) && /\/js\/master_page\.js/i.test(htmls) && /\/js\/validar_page\.js/i.test(htmls));
test('JS e HTML são revalidados após deploy', /\/js\/\(\.\*\)[\s\S]*must-revalidate/i.test(vercel));

test('Blob privado vira padrão quando store privado está configurado', /privateBlobReady/i.test(upload) && /privateBlobReady \? 'private' : 'public'/i.test(upload));
test('Documento externo usa URL sanitizada', /safeUrl\(d\.url_externa\)/i.test(docs));
test('Documento escapa títulos e nomes persistentes', /esc\(d\.titulo \|\| d\.nome_arquivo\)/i.test(docs) && /esc\(d\.nome_arquivo\)/i.test(docs));

console.log(`\nPatch 10: ${passed} passou, ${failed} falhou.`); if(failed) process.exit(1);
