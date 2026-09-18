// scripts/test-edge-v2-routes.js
// Suíte de Testes Automatizados — Expansão RESTful Modular Edge v2 no Cloudflare Workers

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

console.log('=== Suíte de Testes da Fase 5: Expansão Edge API v2 ===\n');

// 1. Verificação de Arquivos e Limite de Funções
console.log('1. Validando integridade física e regra de funções serverless...');
const v2Path = path.join(root, 'api/_v2-routes.js');
assert(fs.existsSync(v2Path), 'api/_v2-routes.js deve existir fisicamente');

const apiFiles = fs.readdirSync(path.join(root, 'api')).filter(f => f.endsWith('.js') && !f.startsWith('_'));
assert(apiFiles.length <= 12, `Total de funções públicas em api/ deve ser <= 12 (Atual: ${apiFiles.length})`);
console.log(`   ✓ api/_v2-routes.js criado sem ultrapassar o teto legado (Funções públicas: ${apiFiles.length}/12).`);

// 2. Importação e Estrutura do Roteador v2
console.log('\n2. Validando interface e especificações do Roteador v2...');
const { V2_ROUTE_SPEC, resolveV2Route, handleV2SystemHealth, handleV2SystemRoutes } = await import('../api/_v2-routes.js');

assert(Array.isArray(V2_ROUTE_SPEC) && V2_ROUTE_SPEC.length >= 8, 'V2_ROUTE_SPEC deve listar todas as rotas v2');
assert(typeof resolveV2Route === 'function', 'resolveV2Route deve ser uma função');
assert(typeof handleV2SystemHealth === 'function', 'handleV2SystemHealth deve ser uma função');
assert(typeof handleV2SystemRoutes === 'function', 'handleV2SystemRoutes deve ser uma função');

console.log(`   ✓ Roteador v2 exporta ${V2_ROUTE_SPEC.length} endpoints modulares especificados.`);

// 3. Resolução de Rotas v2
console.log('\n3. Validando resolução e normalização de parâmetros em rotas v2...');

// Sistema
const healthRoute = resolveV2Route('/api/v2/system/health', new URLSearchParams());
assert(healthRoute && healthRoute.moduleName === 'v2-system-health', 'Deve resolver /api/v2/system/health');

const routesRoute = resolveV2Route('/api/v2/system/routes', new URLSearchParams());
assert(routesRoute && routesRoute.moduleName === 'v2-system-routes', 'Deve resolver /api/v2/system/routes');

// Webhook segregado
const pixRoute = resolveV2Route('/api/v2/webhooks/pix', new URLSearchParams());
assert(pixRoute && pixRoute.moduleName === 'v2-webhook-pix', 'Deve resolver /api/v2/webhooks/pix diretamente para o handler');

// Consultas públicas com extração de parâmetros
const cnpjRoute = resolveV2Route('/api/v2/public/cnpj/12.345.678/0001-95', new URLSearchParams());
assert(cnpjRoute && cnpjRoute.moduleName === 'v2-public-cnpj', 'Deve resolver /api/v2/public/cnpj/:cnpj');
assert.strictEqual(cnpjRoute.query.cnpj, '12345678000195', 'Deve sanitizar pontuação do CNPJ na URL');

const cepRoute = resolveV2Route('/api/v2/public/cep/01310-100', new URLSearchParams());
assert(cepRoute && cepRoute.moduleName === 'v2-public-cep', 'Deve resolver /api/v2/public/cep/:cep');
assert.strictEqual(cepRoute.query.cep, '01310100', 'Deve sanitizar hífen do CEP na URL');

// Tenant e Suporte
const tenantRoute = resolveV2Route('/api/v2/tenants/current', new URLSearchParams());
assert(tenantRoute && tenantRoute.query.target === 'tenant', 'Deve rotear /api/v2/tenants/current para users?target=tenant');

const supportRoute = resolveV2Route('/api/v2/support/chat', new URLSearchParams());
assert(supportRoute && supportRoute.query.target === 'support', 'Deve rotear /api/v2/support/chat para users?target=support');

// Engenharia e Finanças
const sinapiRoute = resolveV2Route('/api/v2/engineering/sinapi', new URLSearchParams());
assert(sinapiRoute && sinapiRoute.query.table === 'sinapi', 'Deve rotear /api/v2/engineering/sinapi para db?table=sinapi');

const obrasRoute = resolveV2Route('/api/v2/engineering/obras', new URLSearchParams());
assert(obrasRoute && obrasRoute.query.table === 'obras', 'Deve rotear /api/v2/engineering/obras para db?table=obras');

const transRoute = resolveV2Route('/api/v2/financial/transactions', new URLSearchParams());
assert(transRoute && transRoute.query.table === 'lancamentos', 'Deve rotear /api/v2/financial/transactions para db?table=lancamentos');

console.log('   ✓ Todas as rotas v2 resolvem handlers corretos com parâmetros normalizados.');

// 4. Teste de Invocação dos Handlers de Sistema
console.log('\n4. Testando execução dos handlers de sistema v2...');

function createMockResponse() {
  const headers = {};
  let statusCode = 200;
  let jsonBody = null;
  return {
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    status(c) { statusCode = c; return this; },
    json(b) { jsonBody = b; return this; },
    getStatusCode: () => statusCode,
    getBody: () => jsonBody,
    getHeaders: () => headers
  };
}

const resHealth = createMockResponse();
await handleV2SystemHealth({}, resHealth);
assert.strictEqual(resHealth.getStatusCode(), 200, 'Healthcheck v2 deve retornar 200 OK');
const healthData = resHealth.getBody();
assert.strictEqual(healthData.ok, true);
assert.strictEqual(healthData.service, 'fingo-edge-v2');
assert.strictEqual(healthData.version, '2.38.0');
assert.strictEqual(healthData.runtime, 'cloudflare-workers');

const resRoutes = createMockResponse();
await handleV2SystemRoutes({}, resRoutes);
assert.strictEqual(resRoutes.getStatusCode(), 200, 'Routes catalog deve retornar 200 OK');
const routesData = resRoutes.getBody();
assert.strictEqual(routesData.ok, true);
assert(Array.isArray(routesData.routes) && routesData.routes.length >= 8);

console.log('   ✓ Handlers de telemetria /api/v2/system/* responderam com sucesso.');

// 5. Integração com _edge-adapter.js
console.log('\n5. Validando integração no _edge-adapter.js...');
const edgeAdapterCode = fs.readFileSync(path.join(root, 'api/_edge-adapter.js'), 'utf8');
assert(edgeAdapterCode.includes("import { resolveV2Route } from './_v2-routes.js'"), 'Deve importar resolveV2Route');
assert(edgeAdapterCode.includes("pathname.startsWith('/api/v2/')"), 'Deve interceptar /api/v2/* no roteador principal');

console.log('   ✓ Integração no Edge Adapter validada.');

console.log('\n======================================================');
console.log('🎉 TODOS OS TESTES DA FASE 5 PASSARAM COM SUCESSO!');
console.log('======================================================\n');
