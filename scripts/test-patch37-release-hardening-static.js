import fs from 'fs';
const admin=fs.readFileSync('api/admin.js','utf8');
const ci=fs.readFileSync('.github/workflows/production-cicd.yml','utf8');
function ok(v,m){if(!v) throw new Error(m); console.log('✅',m)}
ok(admin.includes('Encerre o modo suporte atual antes de acessar outra empresa.'),'impersonação aninhada bloqueada');
ok(admin.includes('Math.min(originalExp || maxSupportExp, maxSupportExp)'),'sessão suporte limitada pela validade da sessão Master');
ok(admin.includes("auth.user?.impersonated === true && auth.user?.impersonatedBy === 'superadmin'"),'fallback de retorno exige sessão impersonada explícita');
ok(admin.includes('SELECT perfil, ativo, tenant_id FROM usuarios'),'retorno valida tenant real do Master');
ok(ci.includes('wait-vercel-api:'),'CI possui gate Vercel antes do Cloudflare');
ok(ci.includes('needs: [validate, wait-vercel-api]'),'Cloudflare depende do gate Vercel');
ok(ci.includes("https://api.fingo.api.br/api/auth?action=health") || ci.includes("https://api.finobra.app.br/api/auth?action=health"),'gate consulta health público da API');
ok(ci.includes('Cloudflare deploy is blocked'),'falha do backend bloqueia rollout do frontend');
console.log('\n✅ Patch 37 release hardening validado.');
