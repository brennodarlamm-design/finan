// tests/test-pix-brcode.js — Validação estrita do gerador PIX EMV BR Code
import assert from 'assert';

function tlv(id, value) {
  const v = String(value ?? '');
  return `${id}${String(v.length).padStart(2, '0')}${v}`;
}

function crc16Ccitt(text) {
  let crc = 0xFFFF;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function normalizePixKey(key) {
  let k = String(key || '').trim();
  if (!k) return '';
  if (k.startsWith('+')) return k;
  if (k.includes('@') || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(k)) return k;
  const digits = k.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return '+55' + digits;
  if (digits.length === 13 && digits.startsWith('55')) return '+' + digits;
  return digits || k;
}

function buildPixPayload({ key, amountCents, txid, merchantName, merchantCity }) {
  const cleanKey = normalizePixKey(key);
  if (!cleanKey) return '';
  const mName = String(merchantName || 'BRENNO DARLAN A COSTA').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 .\-]/g, '').slice(0, 25);
  const mCity = String(merchantCity || 'BOA VISTA').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 .\-]/g, '').slice(0, 15);
  const merchantAccount = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', cleanKey);
  const amount = (Number(amountCents || 0) / 100).toFixed(2);
  const additional = tlv('05', String(txid || '***').slice(0, 25));
  const base =
    tlv('00', '01') +
    tlv('01', '11') +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (Number(amountCents) > 0 ? tlv('54', amount) : '') +
    tlv('58', 'BR') +
    tlv('59', mName) +
    tlv('60', mCity) +
    tlv('62', additional) +
    '6304';
  return base + crc16Ccitt(base);
}

// 1. Normalização de chave de telefone
assert.strictEqual(normalizePixKey('95991363678'), '+5595991363678');
assert.strictEqual(normalizePixKey('5595991363678'), '+5595991363678');
assert.strictEqual(normalizePixKey('+5595991363678'), '+5595991363678');
assert.strictEqual(normalizePixKey('(95) 99136-3678'), '+5595991363678');

// 2. Geração do payload EMV com chave normalizada
const payload = buildPixPayload({
  key: '95991363678',
  amountCents: 27990,
  txid: 'FINGO123',
  merchantName: 'BRENNO DARLAN A COSTA',
  merchantCity: 'BOA VISTA'
});

assert.ok(payload.startsWith('000201010211'), 'Deve começar com indicador de payload e método estático 11');
assert.ok(payload.includes('0014BR.GOV.BCB.PIX0114+5595991363678'), 'Deve conter chave de telefone internacional +5595991363678');
assert.ok(payload.includes('5406279.90'), 'Deve conter o valor formatado');
assert.ok(payload.includes('5802BR'), 'Deve conter país BR');
assert.ok(payload.includes('5921BRENNO DARLAN A COSTA'), 'Deve conter o beneficiário em Tag 59');
assert.ok(payload.includes('6009BOA VISTA'), 'Deve conter a cidade em Tag 60');
assert.ok(payload.endsWith(crc16Ccitt(payload.slice(0, -4))), 'CRC16 deve ser matematicamente válido');

console.log('✅ Todos os testes de conformidade do PIX EMV BR Code passaram!');
console.log('Exemplo de payload gerado:', payload);
