// scripts/test-patch56-security.js
// Patch 56 — Rate limit + bloqueio por IP + Fail2Ban lógico + secrets fail-closed.

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
import { getMfaEncryptionKey } from '../api/_totp.js';
import { getTenantKeyPepper } from '../api/_tenant-access-key.js';

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

// Fail-closed: produção não pode cair para strings hardcoded nem reutilizar SESSION_SIGNING_SECRET.
const saved = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  NODE_ENV: process.env.NODE_ENV,
  IP_BAN_PEPPER: process.env.IP_BAN_PEPPER,
  MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY,
  TENANT_KEY_PEPPER: process.env.TENANT_KEY_PEPPER,
  SESSION_SIGNING_SECRET: process.env.SESSION_SIGNING_SECRET
};

process.env.VERCEL_ENV = 'production';
delete process.env.NODE_ENV;
delete process.env.IP_BAN_PEPPER;
delete process.env.MFA_ENCRYPTION_KEY;
delete process.env.TENANT_KEY_PEPPER;
process.env.SESSION_SIGNING_SECRET = 'S'.repeat(48);

assert.throws(() => getIpBanPepper(), /IP_BAN_PEPPER não configurado/, 'Produção deve exigir IP_BAN_PEPPER dedicado.');
assert.throws(() => getMfaEncryptionKey(), /MFA_ENCRYPTION_KEY não configurado/, 'Produção deve exigir MFA_ENCRYPTION_KEY dedicado.');
assert.throws(() => getTenantKeyPepper(), /TENANT_KEY_PEPPER não configurado/, 'Produção deve exigir TENANT_KEY_PEPPER dedicado.');

for (const [key, value] of Object.entries(saved)) {
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
}

// Custom keys fortes continuam aceitas e permitem testes determinísticos.
assert.strictEqual(getIpBanPepper('I'.repeat(40)), 'I'.repeat(40));
assert.strictEqual(getMfaEncryptionKey('M'.repeat(40)), 'M'.repeat(40));
assert.strictEqual(getTenantKeyPepper('T'.repeat(40)), 'T'.repeat(40));

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

const totp = read('api/_totp.js');
assert(!totp.includes('finobra_mfa_enc_fallback_key_2026'), 'MFA não pode conter chave criptográfica hardcoded.');
assert(totp.includes('MFA_ENCRYPTION_KEY não configurado em produção'), 'MFA deve falhar fechado sem chave dedicada em produção.');

const tenantKey = read('api/_tenant-access-key.js');
assert(!tenantKey.includes('finobra_pepper_access_key_seed_2026'), 'Chave da empresa não pode conter pepper hardcoded.');
assert(tenantKey.includes('TENANT_KEY_PEPPER não configurado em produção'), 'Tenant key deve falhar fechado sem pepper dedicado em produção.');

console.log('✅ Patch 56: IP ban, Fail2Ban e secrets fail-closed validados.');
