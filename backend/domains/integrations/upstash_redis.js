// backend/domains/integrations/upstash_redis.js — Adaptador Upstash Redis para o Backend FinGo (Node.js)
// Reexporta os primitivos de cache e rate-limit de alta performance com interface unificada.

export {
  getUpstashCredentials,
  upstashCommand,
  upstashPipeline,
  redisGet,
  redisSet,
  redisSetNx,
  redisDel,
  redisIncr,
  checkRateLimitRedis,
  redisPing
} from '../../../api/_edge-redis.js';
