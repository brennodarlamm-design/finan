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
const {
  V2_ROUTE_SPEC,
  resolveV2Route,
  handleV2SystemHealth,
  handleV2SystemRoutes,
  handleV2CurvaAbc,
  handleV2SinapiExport,
  handleV2BoletimMedicao
} = await import('../api/_v2-routes.js');

assert(Array.isArray(V2_ROUTE_SPEC) && V2_ROUTE_SPEC.length >= 10, 'V2_ROUTE_SPEC deve listar todas as rotas v2');
assert(typeof resolveV2Route === 'function', 'resolveV2Route deve ser uma função');
assert(typeof handleV2CurvaAbc === 'function', 'handleV2CurvaAbc deve ser uma função');
assert(typeof handleV2SinapiExport === 'function', 'handleV2SinapiExport deve ser uma função');
assert(typeof handleV2BoletimMedicao === 'function', 'handleV2BoletimMedicao deve ser uma função');

console.log(`   ✓ Roteador v2 exporta ${V2_ROUTE_SPEC.length} endpoints modulares especificados.`);

// 3. Resolução de Rotas v2
console.log('\n3. Validando resolução e normalização de parâmetros em rotas v2...');

// Sistema
const healthRoute = resolveV2Route('/api/v2/system/health', new URLSearchParams());
assert(healthRoute && healthRoute.moduleName === 'v2-system-health', 'Deve resolver /api/v2/system/health');

// Webhook segregado
const pixRoute = resolveV2Route('/api/v2/webhooks/pix', new URLSearchParams());
assert(pixRoute && pixRoute.moduleName === 'v2-webhook-pix', 'Deve resolver /api/v2/webhooks/pix diretamente para o handler');

// Curva ABC de Pareto
const curvaRoute = resolveV2Route('/api/v2/engineering/obras/obra-alpha-123/curva-abc', new URLSearchParams());
assert(curvaRoute && curvaRoute.moduleName === 'v2-engineering-curva-abc');
assert.strictEqual(curvaRoute.query.obraId, 'obra-alpha-123', 'Deve extrair obraId do caminho');

// SINAPI Export
const exportRoute = resolveV2Route('/api/v2/engineering/sinapi/export', new URLSearchParams());
assert(exportRoute && exportRoute.moduleName === 'v2-engineering-sinapi-export');

// Boletins de Medição
const boletimRoute = resolveV2Route('/api/v2/measurements/boletins', new URLSearchParams());
assert(boletimRoute && boletimRoute.moduleName === 'v2-measurements-boletins');

console.log('   ✓ Todas as rotas v2 resolvem handlers corretos com parâmetros normalizados.');

// 4. Teste de Invocação dos Handlers
console.log('\n4. Testando execução dos handlers de telemetria e engenharia v2...');

function createMockResponse() {
  const headers = {};
  let statusCode = 200;
  let jsonBody = null;
  let rawBody = null;
  return {
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    status(c) { statusCode = c; return this; },
    json(b) { jsonBody = b; return this; },
    send(b) { rawBody = b; return this; },
    getStatusCode: () => statusCode,
    getBody: () => jsonBody,
    getRawBody: () => rawBody,
    getHeaders: () => headers
  };
}

// 4.1 Health
const resHealth = createMockResponse();
await handleV2SystemHealth({}, resHealth);
assert.strictEqual(resHealth.getStatusCode(), 200);
assert.strictEqual(resHealth.getBody().ok, true);

// 4.2 Curva ABC (Classificação de Pareto)
const resCurva = createMockResponse();
await handleV2CurvaAbc({
  query: { obraId: 'obra-teste' },
  body: {
    itens: [
      { codigo: '01', descricao: 'Estrutura Concreto', valor_total: 80000 },
      { codigo: '02', descricao: 'Alvenaria', valor_total: 15000 },
      { codigo: '03', descricao: 'Pintura', valor_total: 5000 }
    ]
  }
}, resCurva);
assert.strictEqual(resCurva.getStatusCode(), 200);
const curvaData = resCurva.getBody();
assert.strictEqual(curvaData.totalGeral, 100000);
assert.strictEqual(curvaData.itens[0].classe, 'A');
assert.strictEqual(curvaData.itens[1].classe, 'B');
assert.strictEqual(curvaData.itens[2].classe, 'C');
console.log('   ✓ Curva ABC de Pareto calculou classes A (80%), B (15%) e C (5%) com exatidão.');

// 4.3 SINAPI Export (CSV)
const resSinapi = createMockResponse();
await handleV2SinapiExport({ query: { uf: 'SP', formato: 'csv', bdi: '20' } }, resSinapi);
assert.strictEqual(resSinapi.getStatusCode(), 200);
assert(resSinapi.getHeaders()['content-type'].includes('text/csv'));
assert(resSinapi.getRawBody().includes('104658'));
console.log('   ✓ Exportação SINAPI gerou arquivo CSV estruturado com BDI de 20%.');

// 4.4 Boletim de Medição com Retenções Tributárias
const resBoletim = createMockResponse();
await handleV2BoletimMedicao({
  body: {
    valorBruto: 10000,
    aliqISS: 5,
    desonerado: true,
    aliqIRRF: 1.5,
    aliqRetencaoGarantia: 5
  }
}, resBoletim);
assert.strictEqual(resBoletim.getStatusCode(), 200);
const bol = resBoletim.getBody().boletim;
assert.strictEqual(bol.valorBruto, 10000);
assert.strictEqual(bol.retencoes.iss.valor, 500);
assert.strictEqual(bol.retencoes.inss.valor, 350); // 3.5% desonerado
assert.strictEqual(bol.retencoes.irrf.valor, 150); // 1.5%
assert.strictEqual(bol.retencoes.pisCofinsCsll.valor, 465); // 4.65% acima de R$ 5.000
assert.strictEqual(bol.retencoes.garantiaContratual.valor, 500); // 5%
assert.strictEqual(bol.totalRetencoes, 1965);
assert.strictEqual(bol.valorLiquido, 8035);
console.log('   ✓ Boletim de Medição calculou todas as 5 retenções na fonte (INSS, ISS, IRRF, PIS/COFINS, Garantia) perfeitamente.');

// 4.5 Newsletter Radar FinGo (Subscribe & Unsubscribe)
const { handleV2Newsletter } = await import('../api/_v2-routes.js');
const newsletterWrites = [];
const newsletterSql = async (strings, ...values) => {
  newsletterWrites.push({ query: strings.join('?'), values });
  return [];
};

const resSub = createMockResponse();
await handleV2Newsletter({
  body: { email: 'Contato@Construtora.com.br' },
  newsletterSql
}, resSub);
assert.strictEqual(resSub.getStatusCode(), 200);
assert.strictEqual(resSub.getBody().action, 'subscribed');
assert.strictEqual(resSub.getBody().email, 'contato@construtora.com.br');

const resUnsub = createMockResponse();
await handleV2Newsletter({
  url: '/api/v2/public/newsletter/unsubscribe',
  body: { email: 'contato@construtora.com.br' },
  newsletterSql
}, resUnsub);
assert.strictEqual(resUnsub.getStatusCode(), 200);
assert.strictEqual(resUnsub.getBody().action, 'unsubscribed');
assert.strictEqual(newsletterWrites.length, 2, 'Subscribe e unsubscribe devem persistir no storage');

const resInvalidNewsletter = createMockResponse();
await handleV2Newsletter({ body: { email: 'email-invalido' }, newsletterSql }, resInvalidNewsletter);
assert.strictEqual(resInvalidNewsletter.getStatusCode(), 400);
assert.strictEqual(newsletterWrites.length, 2, 'E-mail inválido não deve tocar o banco');
console.log('   ✓ Newsletter persiste opt-in/opt-out, normaliza e-mail e rejeita entrada inválida.');

console.log('\n======================================================');
console.log('🎉 TODOS OS TESTES DA FASE 5 PASSARAM COM SUCESSO!');
console.log('======================================================\n');
