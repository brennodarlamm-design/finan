// scripts/test-patch56-security.js
// Patch 56 — Rate limit + bloqueio por IP + Fail2Ban lógico serverless.

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getTrustedClientIp,
  getIpBanPepper,
  hashIp,
  reasonWeight
} from '../api/_security-ip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

console.log('=== Patch 56 Security Hardening ===');

const pepper = 'P'.repeat(48);
const h1 = hashIp('203.0.113.10', pepper);
const h2 = hashIp('203.0.113.10', pepper);
const h3 = hashIp('203.0.113.11', pepper);
assert.strictEqual(h1.length, 64, 'IP deve ser HMAC-SHA256 hexadecimal.');
assert.strictEqual(h1, h2, 'HMAC do mesmo IP deve ser determinístico.');
assert.notStrictEqual(h1, h3, 'IPs diferentes devem gerar hashes diferentes.');

const oldVercel = process.env.VERCEL;
process.env.VERCEL = '1';
assert.strictEqual(
  getTrustedClientIp({ headers: { 'x-real-ip': '198.51.100.20', 'x-forwarded-for': '6.6.6.6' }, socket: {} }),
  '198.51.100.20',
  'Em Vercel, x-real-ip confiável deve prevalecer sobre X-Forwarded-For fornecido pelo cliente.'
);
if (oldVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = oldVercel;

assert.strictEqual(reasonWeight('invalid_password'), 1);
assert.strictEqual(reasonWeight('mfa_invalid'), 2);
assert.strictEqual(reasonWeight('rate_limit_exceeded'), 4);
assert.strictEqual(reasonWeight('sql_injection_probe'), 15);

const oldEnv = process.env.VERCEL_ENV;
const oldPepper = process.env.IP_BAN_PEPPER;
const oldSession = process.env.SESSION_SIGNING_SECRET;
process.env.VERCEL_ENV = 'production';
delete process.env.IP_BAN_PEPPER;
delete process.env.SESSION_SIGNING_SECRET;
assert.throws(() => getIpBanPepper(), /IP_BAN_PEPPER não configurado/, 'Produção deve falhar fechado sem IP_BAN_PEPPER.');
if (oldEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnv;
if (oldPepper === undefined) delete process.env.IP_BAN_PEPPER; else process.env.IP_BAN_PEPPER = oldPepper;
if (oldSession === undefined) delete process.env.SESSION_SIGNING_SECRET; else process.env.SESSION_SIGNING_SECRET = oldSession;

const migration = read('migrations/030_security_ip_defense.sql');
assert(migration.includes('CREATE TABLE IF NOT EXISTS security_ip_state'));
assert(migration.includes('CREATE TABLE IF NOT EXISTS security_ip_events'));
assert(migration.includes('CREATE TABLE IF NOT EXISTS security_ip_allowlist'));
assert(!migration.toLowerCase().includes('ip_address'), 'Migração não deve persistir IP em texto puro.');

const rateLimit = read('api/_ratelimit.js');
assert(rateLimit.includes('checkIpBan'));
assert(rateLimit.includes('recordIpFailure'));
assert(rateLimit.includes("reason: 'rate_limit_exceeded'"));
assert(rateLimit.includes("value.startsWith('login:ip:')"));
assert(rateLimit.includes("value.startsWith('mfa:')"));

const audit = read('api/_audit.js');
assert(audit.includes("reason === 'invalid_password'"));
assert(audit.includes("action === 'mfa_invalido'"));
assert(audit.includes('recordIpFailure'));

const sec = read('api/_security-ip.js');
assert(sec.includes('score >= 8'));
assert(sec.includes('score >= 15'));
assert(sec.includes('score >= 25'));
assert(sec.includes('score >= 40'));
assert(sec.includes("createHmac('sha256'"));
assert(!sec.includes('finobra_ip_ban_fallback'), 'Não pode existir pepper hardcoded de produção.');

console.log('✅ Patch 56: defesa por IP, rate limit e Fail2Ban lógico validados.');
