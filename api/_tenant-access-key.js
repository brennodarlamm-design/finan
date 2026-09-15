import crypto from 'crypto';

const KEY_PREFIX = 'FO';
const KEY_BYTES = 24;

function normalizeAccessKey(value = '') {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function generateTenantAccessKey() {
  const raw = crypto.randomBytes(KEY_BYTES).toString('base64url').toUpperCase();
  const compact = raw.replace(/[^A-Z0-9]/g, '').slice(0, 30);
  return `${KEY_PREFIX}-${compact.match(/.{1,6}/g).join('-')}`;
}

export function hashTenantAccessKey(value) {
  const normalized = normalizeAccessKey(value);
  if (!normalized) return '';
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function tenantAccessKeyLast4(value) {
  const normalized = normalizeAccessKey(value).replace(/[^A-Z0-9]/g, '');
  return normalized.slice(-4);
}

export function isTenantAccessKeyShapeValid(value) {
  const normalized = normalizeAccessKey(value);
  return /^FO-[A-Z0-9]{6}(?:-[A-Z0-9]{1,6}){3,5}$/.test(normalized);
}

export function timingSafeHashEqual(leftHash, rightHash) {
  const left = Buffer.from(String(leftHash || ''), 'utf8');
  const right = Buffer.from(String(rightHash || ''), 'utf8');
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
