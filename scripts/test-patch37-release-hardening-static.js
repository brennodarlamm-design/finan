import fs from 'fs';
const admin=fs.readFileSync('api/admin.js','utf8');
const ci=fs.readFileSync('.github/workflows/production-cicd.yml','utf8');
function ok(v,m){if(!v) throw new Error(m); console.log('✅',m)}
ok(admin.includes('Encerre o modo suporte atual antes de acessar outra empresa.'),'impersonação aninhada bloqueada');
ok(admin.includes('Math.min(originalExp || maxSupportExp, maxSupportExp)'),'sessão suporte limitada pela validade da sessão Master');
ok(admin.includes("auth.user?.impersonated === true && auth.user?.impersonatedBy === 'superadmin'"),'fallback de retorno exige sessão impersonada explícita');
ok(admin.includes('SELECT perfil, ativo, tenant_id FROM usuarios'),'retorno valida tenant real do Master');
ok(!ci.includes('wait-vercel-api:'),'CI de produção não depende mais de gate Vercel');
ok(ci.includes('needs: validate'),'deploy Cloudflare depende apenas da validação do próprio release');
ok(ci.includes("https://fingo.api.br/api/v2/system/health"),'smoke de produção valida Edge API no domínio canônico');
ok(ci.includes("'\"runtime\":\"cloudflare-workers\"'"),'smoke exige runtime Cloudflare Workers');
console.log('\n✅ Patch 37 release hardening validado para Cloudflare-only.');
