// scripts/test-upstash-redis-integration.js — Validação da Integração Upstash Redis e Evolution Go
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env.local') });

console.log('🧪 Iniciando testes de integração do Upstash Redis e Evolution Go...\n');

// 1. Verificação do módulo Edge Redis
const edgeRedisPath = path.join(ROOT, 'api', '_edge-redis.js');
assert(fs.existsSync(edgeRedisPath), 'api/_edge-redis.js deve existir');
const edgeRedisSrc = fs.readFileSync(edgeRedisPath, 'utf8');

assert(edgeRedisSrc.includes('export async function redisGet'), 'redisGet deve ser exportado');
assert(edgeRedisSrc.includes('export async function redisSet'), 'redisSet deve ser exportado');
assert(edgeRedisSrc.includes('export async function redisSetNx'), 'redisSetNx deve ser exportado');
assert(edgeRedisSrc.includes('export async function redisDel'), 'redisDel deve ser exportado');
assert(edgeRedisSrc.includes('export async function checkRateLimitRedis'), 'checkRateLimitRedis deve ser exportado');
assert(edgeRedisSrc.includes('export async function redisPing'), 'redisPing deve ser exportado');
console.log('  ✓ api/_edge-redis.js possui todos os métodos primitivos e pipeline atômico.');

// 2. Verificação do módulo Backend Integrations
const backendRedisPath = path.join(ROOT, 'backend', 'domains', 'integrations', 'upstash_redis.js');
assert(fs.existsSync(backendRedisPath), 'backend/domains/integrations/upstash_redis.js deve existir');
const backendRedisSrc = fs.readFileSync(backendRedisPath, 'utf8');
assert(backendRedisSrc.includes("from '../../../api/_edge-redis.js'"), 'Deve reexportar de api/_edge-redis.js');
console.log('  ✓ backend/domains/integrations/upstash_redis.js reexporta a interface unificada.');

// 3. Verificação do _edge-kv.js L2
const edgeKvPath = path.join(ROOT, 'api', '_edge-kv.js');
const edgeKvSrc = fs.readFileSync(edgeKvPath, 'utf8');
assert(edgeKvSrc.includes("import { redisGet, redisSet, redisDel } from './_edge-redis.js'"), 'edge-kv deve importar redis');
assert(edgeKvSrc.includes('redisGet(normalizedKey'), 'getKvCache deve consultar redis no L2');
assert(edgeKvSrc.includes('redisSet(normalizedKey'), 'setKvCache deve persistir no redis');
assert(edgeKvSrc.includes('redisDel(normalizedKey'), 'deleteKvCache deve remover do redis');
console.log('  ✓ api/_edge-kv.js integra Upstash Redis como camada de cache L2.');

// 4. Verificação de rate limit
const ratelimitPath = path.join(ROOT, 'api', '_ratelimit.js');
const ratelimitSrc = fs.readFileSync(ratelimitPath, 'utf8');
assert(ratelimitSrc.includes("export { checkRateLimitRedis } from './_edge-redis.js'"), '_ratelimit.js deve exportar checkRateLimitRedis');
console.log('  ✓ api/_ratelimit.js expõe rate-limiting distribuído atômico.');

// 5. Verificação do Docker Compose do Evolution Go
const dockerComposePath = path.join(ROOT, 'docker-compose.evolution-go.yml');
const dockerComposeSrc = fs.readFileSync(dockerComposePath, 'utf8');
assert(dockerComposeSrc.includes('CACHE_REDIS_ENABLED'), 'docker-compose deve conter CACHE_REDIS_ENABLED');
assert(dockerComposeSrc.includes('CACHE_REDIS_URI'), 'docker-compose deve conter CACHE_REDIS_URI');
assert(dockerComposeSrc.includes('CACHE_REDIS_PREFIX_KEY'), 'docker-compose deve conter CACHE_REDIS_PREFIX_KEY');
assert(dockerComposeSrc.includes('CACHE_REDIS_SAVE_INSTANCES'), 'docker-compose deve conter CACHE_REDIS_SAVE_INSTANCES');
assert(dockerComposeSrc.includes('REDIS_URL'), 'docker-compose deve conter REDIS_URL');
console.log('  ✓ docker-compose.evolution-go.yml contém os parâmetros oficiais do Evolution Foundation.');

// 6. Verificação do .env.evolution-go.example
const envExamplePath = path.join(ROOT, '.env.evolution-go.example');
const envExampleSrc = fs.readFileSync(envExamplePath, 'utf8');
assert(envExampleSrc.includes('CACHE_REDIS_URI='), '.env.example deve conter CACHE_REDIS_URI');
assert(envExampleSrc.includes('UPSTASH_REDIS_REST_URL='), '.env.example deve conter UPSTASH_REDIS_REST_URL');
assert(envExampleSrc.includes('UPSTASH_REDIS_REST_TOKEN='), '.env.example deve conter UPSTASH_REDIS_REST_TOKEN');
console.log('  ✓ .env.evolution-go.example documenta variáveis do Upstash e Evolution Redis.');

// 7. Verificação do MCP Config
const mcpConfigPath = path.join(ROOT, '.agents', 'mcp_config.json');
assert(fs.existsSync(mcpConfigPath), '.agents/mcp_config.json deve existir');
const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
assert(mcpConfig?.mcpServers?.upstash?.url === 'https://mcp.upstash.com/mcp', 'MCP URL deve ser https://mcp.upstash.com/mcp');
console.log('  ✓ .agents/mcp_config.json configurado com o Upstash Remote MCP Server.');

// 8. Teste em runtime dos primitivos Redis
const { redisPing, redisSet, redisGet, redisSetNx, redisDel, checkRateLimitRedis } = await import('../api/_edge-redis.js');
const pingOk = await redisPing();
assert.strictEqual(pingOk, true, 'redisPing deve responder PONG com sucesso');

const testKey = `fingo:test:${Date.now()}`;
const setOk = await redisSet(testKey, { active: true, engine: 'evolution-go' }, 30);
assert.strictEqual(setOk, true, 'redisSet deve gravar objeto');

const val = await redisGet(testKey);
assert.deepStrictEqual(val, { active: true, engine: 'evolution-go' }, 'redisGet deve recuperar objeto');

const nx1 = await redisSetNx(`${testKey}:lock`, 'worker1', 30);
const nx2 = await redisSetNx(`${testKey}:lock`, 'worker2', 30);
assert.strictEqual(nx1, true, 'Primeiro SetNx deve vencer');
assert.strictEqual(nx2, false, 'Segundo SetNx deve ser bloqueado');

const rl = await checkRateLimitRedis(`test_rl:${Date.now()}`, 5, 30);
assert.strictEqual(rl.allowed, true, 'Rate limit inicial deve ser permitido');
assert.strictEqual(rl.remaining, 4, 'Remaining deve ser 4');

await redisDel(testKey);
await redisDel(`${testKey}:lock`);
console.log('  ✓ Teste em runtime com Upstash Redis REST executado com 100% de sucesso.');

console.log('\n======================================================');
console.log('🎉 TODOS OS TESTES DO UPSTASH REDIS PASSARAM COM SUCESSO!');
console.log('======================================================');
