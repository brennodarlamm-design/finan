// scripts/test-password-policy.js — Teste Unitário e de Integração da Política de Senhas e Scrypt Assíncrono
import assert from 'node:assert/strict';
import {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  verifyPasswordSync,
  validatePasswordPolicy,
  hasSequentialNumbers
} from '../api/_auth.js';

console.log('🔐 Iniciando validação da Política de Senhas e Scrypt Assíncrono...');

// 1. Testes de Sequências Numéricas
console.log('  1. Testando detecção de sequências numéricas...');
assert.strictEqual(hasSequentialNumbers('Senha123!'), true, 'Deve detectar 123 como sequência crescente');
assert.strictEqual(hasSequentialNumbers('Senha321!'), true, 'Deve detectar 321 como sequência decrescente');
assert.strictEqual(hasSequentialNumbers('Senha678!'), true, 'Deve detectar 678 como sequência crescente');
assert.strictEqual(hasSequentialNumbers('Senha987!'), true, 'Deve detectar 987 como sequência decrescente');
assert.strictEqual(hasSequentialNumbers('Senha111!'), true, 'Deve detectar 111 como repetição contígua');
assert.strictEqual(hasSequentialNumbers('Senha000!'), true, 'Deve detectar 000 como repetição contígua');
assert.strictEqual(hasSequentialNumbers('Senha999!'), true, 'Deve detectar 999 como repetição contígua');
assert.strictEqual(hasSequentialNumbers('FinGo#2026'), false, 'Não deve detectar 2026 como sequência');
assert.strictEqual(hasSequentialNumbers('Obra@2026_Forte!'), false, 'Não deve detectar ano não-sequencial');
assert.strictEqual(hasSequentialNumbers('Admin#12!Pass'), false, 'Dois dígitos não formam sequência de 3');
console.log('    ✓ Sequências numéricas validadas com precisão');

// 2. Testes da Política de Senhas Completa
console.log('  2. Testando requisitos da política de senhas...');

// Requisito: Mínimo 8 caracteres
const rShort = validatePasswordPolicy('Ab1!xyz');
assert.strictEqual(rShort.valid, false);
assert.match(rShort.error, /mínimo 8 caracteres/i);

// Requisito: Letra maiúscula
const rNoUpper = validatePasswordPolicy('senha@2026');
assert.strictEqual(rNoUpper.valid, false);
assert.match(rNoUpper.error, /letra maiúscula/i);

// Requisito: Letra minúscula
const rNoLower = validatePasswordPolicy('SENHA@2026');
assert.strictEqual(rNoLower.valid, false);
assert.match(rNoLower.error, /letra minúscula/i);

// Requisito: Número
const rNoNum = validatePasswordPolicy('Senha@ForteSemNum');
assert.strictEqual(rNoNum.valid, false);
assert.match(rNoNum.error, /número/i);

// Requisito: Caractere especial / símbolo
const rNoSymbol = validatePasswordPolicy('SenhaForte2026SemSym');
assert.strictEqual(rNoSymbol.valid, false);
assert.match(rNoSymbol.error, /caractere especial/i);

// Requisito: Proibição de sequência numérica
const rSeqAsc = validatePasswordPolicy('Senha@123Forte');
assert.strictEqual(rSeqAsc.valid, false);
assert.match(rSeqAsc.error, /sequências numéricas/i);

const rSeqDesc = validatePasswordPolicy('Senha@321Forte');
assert.strictEqual(rSeqDesc.valid, false);
assert.match(rSeqDesc.error, /sequências numéricas/i);

const rSeqRep = validatePasswordPolicy('Senha@222Forte');
assert.strictEqual(rSeqRep.valid, false);
assert.match(rSeqRep.error, /sequências numéricas/i);

// Senhas Válidas
const rValid1 = validatePasswordPolicy('FinGo#2026');
assert.strictEqual(rValid1.valid, true);

const rValid2 = validatePasswordPolicy('Obra@2026_Forte!');
assert.strictEqual(rValid2.valid, true);

const rValid3 = validatePasswordPolicy('Engenharia$981A');
assert.strictEqual(rValid3.valid, true);

console.log('    ✓ Todos os requisitos da política de senhas validados com sucesso');

// 3. Testes do Cripto-Hashing Assíncrono com Scrypt
console.log('  3. Testando hashPassword e verifyPassword assíncronos...');

const plainPw = 'FinGo#2026_Construcao!';
const hash = await hashPassword(plainPw);

assert.ok(typeof hash === 'string', 'Hash deve ser string');
assert.ok(hash.includes(':'), 'Hash deve conter salt:keyHex');
const [salt, hexKey] = hash.split(':');
assert.strictEqual(salt.length, 32, 'Salt hex deve ter 32 caracteres (16 bytes)');
assert.strictEqual(hexKey.length, 128, 'Chave derivada hex deve ter 128 caracteres (64 bytes)');

// Verificação assíncrona com senha correta
const isOk = await verifyPassword(plainPw, hash);
assert.strictEqual(isOk, true, 'Senha correta deve verificar com sucesso (true)');

// Verificação assíncrona com senha incorreta
const isBad = await verifyPassword('SenhaErrada!2026', hash);
assert.strictEqual(isBad, false, 'Senha incorreta deve retornar false');

// Verificação com parâmetros inválidos
assert.strictEqual(await verifyPassword('', hash), false);
assert.strictEqual(await verifyPassword(plainPw, ''), false);
assert.strictEqual(await verifyPassword(plainPw, 'invalid-hash-without-colon'), false);

// 4. Interoperabilidade Sync / Async (Compatibilidade Retrógrada)
console.log('  4. Testando compatibilidade retrógrada entre sync e async...');
const syncHash = hashPasswordSync(plainPw);
assert.strictEqual(await verifyPassword(plainPw, syncHash), true, 'Hash gerado via sync deve validar via verifyPassword async');
assert.strictEqual(verifyPasswordSync(plainPw, hash), true, 'Hash gerado via async deve validar via verifyPasswordSync');

console.log('🎉 Todos os testes de Política de Senhas e Scrypt Assíncrono passaram com êxito!\n');
