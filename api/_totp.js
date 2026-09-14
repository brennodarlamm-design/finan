// api/_totp.js — Motor Criptográfico de Autenticação Multifator (TOTP RFC 6238 e RFC 4648 Base32)
// Compatível com Google Authenticator, Microsoft Authenticator, 1Password e Authy.
// 100% nativo para geração/validação TOTP. O enrollment visual usa fallback manual seguro.

import crypto from 'crypto';

// Alfabeto padrão Base32 (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Codifica um Buffer em string Base32 (sem padding =)
 */
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodifica uma string Base32 em Buffer
 */
export function base32Decode(input) {
  const cleanInput = String(input || '')
    .toUpperCase()
    .replace(/[\s=-]/g, '');

  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleanInput[i]);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Gera um segredo aleatório seguro de 20 bytes (160 bits) codificado em Base32 (32 caracteres)
 */
export function generateTotpSecret(numBytes = 20) {
  const buf = crypto.randomBytes(numBytes);
  return base32Encode(buf);
}

/**
 * Calcula o código numérico de 6 dígitos para um dado time-step counter
 */
export function calculateHotp(secret, counter) {
  const key = Buffer.isBuffer(secret) ? secret : base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return String(otp).padStart(6, '0');
}

/**
 * Retorna o time-step atual (intervalo de 30 segundos)
 */
export function getCurrentTimeStep(timestamp = Date.now(), timeStepSeconds = 30) {
  const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  return Math.floor(ms / 1000 / timeStepSeconds);
}

/**
 * Gera o código TOTP de 6 dígitos atual
 */
export function generateTotpToken(secret, timestampMs = Date.now()) {
  const step = getCurrentTimeStep(timestampMs);
  return calculateHotp(secret, step);
}

/**
 * Verifica um código TOTP com tolerância de janela (default window = 1 => step-1, step, step+1)
 */
export function verifyTotpCode(secret, code, options = {}) {
  if (!secret || !code) return { valid: false };

  const cleanCode = String(code).trim().replace(/[\s-]/g, '');
  if (!/^\d{6}$/.test(cleanCode)) return { valid: false };

  const window = options.window ?? 1;
  const timestampMs = options.timestampMs || Date.now();
  const currentStep = getCurrentTimeStep(timestampMs, options.timeStepSeconds || options.timeStepSec || 30);
  const lastUsedStep = Number(options.lastUsedStep || 0);

  for (let i = -window; i <= window; i++) {
    const step = currentStep + i;

    // Proteção contra replay: o step verificado não pode ser igual ou anterior ao último já utilizado.
    if (step <= lastUsedStep) continue;

    const expectedCode = calculateHotp(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(expectedCode))) {
      return { valid: true, step };
    }
  }

  return { valid: false };
}

/**
 * Formata URI oficial compatível com Google Authenticator e apps padrão
 */
export function generateTotpUri(optionsOrSecret, maybeAccount, maybeIssuer) {
  let secret, account = 'admin', issuer = 'FinObra Master';
  if (typeof optionsOrSecret === 'object' && optionsOrSecret !== null) {
    secret = optionsOrSecret.secret;
    account = optionsOrSecret.account || account;
    issuer = optionsOrSecret.issuer || issuer;
  } else {
    secret = optionsOrSecret;
    account = maybeAccount || account;
    issuer = maybeIssuer || issuer;
  }

  const cleanSecret = String(secret || '').replace(/\s/g, '').toUpperCase();
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${cleanSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Gera códigos de recuperação de emergência e seus respectivos hashes SHA-256
 */
export function generateBackupCodes(count = 6) {
  const rawCodes = [];
  const hashedCodes = [];

  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(2).toString('hex');
    const part2 = crypto.randomBytes(2).toString('hex');
    const raw = `${part1}-${part2}`.toUpperCase();
    const hash = crypto.createHash('sha256').update(raw.replace('-', '').toLowerCase()).digest('hex');

    rawCodes.push(raw);
    hashedCodes.push(hash);
  }

  return { rawCodes, codes: rawCodes, hashedCodes };
}

/**
 * Valida se um código digitado bate com algum código de emergência válido
 */
export function verifyBackupCode(enteredCode, hashedCodesList = []) {
  if (!enteredCode || !Array.isArray(hashedCodesList) || !hashedCodesList.length) {
    return { valid: false, remainingHashedCodes: hashedCodesList };
  }

  const clean = String(enteredCode).trim().replace(/[\s-]/g, '').toLowerCase();
  const enteredHash = crypto.createHash('sha256').update(clean).digest('hex');

  const idx = hashedCodesList.findIndex(h => h === enteredHash);
  if (idx !== -1) {
    const remaining = [...hashedCodesList];
    remaining.splice(idx, 1);
    return { valid: true, remainingHashedCodes: remaining };
  }

  return { valid: false, remainingHashedCodes: hashedCodesList };
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Enrollment visual seguro para o MFA.
 *
 * PATCH 50: o gerador anterior desenhava uma matriz parecida com QR Code, mas não
 * codificava a URI otpauth conforme o padrão QR. Isso podia levar o usuário a
 * cadastrar um segredo incorreto ou tornar o QR ilegível. Até existir um encoder
 * QR real e testado no bundle, exibimos um fallback seguro: a chave manual segue
 * visível na tela e, em dispositivos móveis, este card abre diretamente a URI
 * otpauth no aplicativo autenticador. O segredo nunca é enviado a terceiros.
 */
export function generateQrSvg(text, size = 220) {
  const safeHref = escapeXml(text);
  const safeSize = Math.max(180, Math.min(Number(size) || 220, 320));

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="${safeSize}" height="${safeSize}" role="img" aria-label="Configuração segura do autenticador" data-finobra-mfa-manual="true">
      <rect width="220" height="220" rx="16" fill="#091208" stroke="#c9a227" stroke-opacity="0.45"/>
      <path d="M110 34l45 18v34c0 36-19 67-45 82-26-15-45-46-45-82V52l45-18zm0 18L81 64v22c0 27 13 50 29 62 16-12 29-35 29-62V64l-29-12z" fill="#e8c84a"/>
      <text x="110" y="115" text-anchor="middle" fill="#f8fafc" font-family="Arial, sans-serif" font-size="13" font-weight="700">CONFIGURAÇÃO MFA</text>
      <text x="110" y="137" text-anchor="middle" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="10">Use a chave manual abaixo</text>
      <text x="110" y="153" text-anchor="middle" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="10">ou toque para abrir o autenticador</text>
      <a href="${safeHref}" target="_self">
        <rect x="48" y="169" width="124" height="30" rx="8" fill="#c9a227"/>
        <text x="110" y="189" text-anchor="middle" fill="#091208" font-family="Arial, sans-serif" font-size="11" font-weight="700">ABRIR AUTENTICADOR</text>
      </a>
    </svg>
  `.trim();
}
