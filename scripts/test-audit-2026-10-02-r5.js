// scripts/test-audit-2026-10-02-r5.js
// Regressões da quinta rodada da auditoria de 02/10/2026 (V1–V4).
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('=== Auditoria 2026-10-02 (5ª rodada) — regressões ===\n');

// V1 — request_reset: caminho de conta inexistente também calcula hash.
{
  const src = read('api/auth.js');
  const block = src.slice(src.indexOf("action === 'request_reset'"), src.indexOf("action === 'verify_reset'"));
  assert(block.includes('const genericFakeResponse = async () =>'), 'V1: helper de resposta genérica com custo');
  assert.strictEqual(block.split('return genericResponse(fakeRequestId());').length - 1, 1, 'V1: só o helper responde com id falso');
  assert(block.split('return genericFakeResponse();').length - 1 >= 6, 'V1: todos os caminhos sem conta usam o helper');
  console.log('  ✓ V1 recuperação de senha com tempo semelhante para conta inexistente');
}

// V2 — Código MFA consumido de forma atômica (sem reuso simultâneo).
{
  const src = read('api/auth.js');
  assert(src.includes('AND COALESCE(mfa_last_used_step, 0) < ${newStep}'), 'V2: step TOTP gravado só se for novo');
  assert(src.includes('AND mfa_backup_codes = ${JSON.stringify(user.mfa_backup_codes || [])}::jsonb'), 'V2: código de backup consumido com comparação');
  assert.strictEqual(src.split('await consumeMfaFactor(sql, user,').length - 1, 2, 'V2: login e mfa_verify');
  assert(!src.includes('UPDATE usuarios SET mfa_last_used_step = ${newStep} WHERE id = ${user.id};'), 'V2: gravação incondicional removida');

  // Simulação: duas requisições com o mesmo step; só a primeira consome.
  let stored = 10;
  const sql = (strings, ...values) => {
    const text = strings.join('?');
    if (text.includes('mfa_last_used_step')) {
      const newStep = values[0];
      if (stored < values[2]) { stored = newStep; return Promise.resolve([{ id: 'u' }]); }
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  };
  // Reproduz o helper do código-fonte (não exportado) a partir do texto para garantir o mesmo SQL.
  const fnSrc = src.slice(src.indexOf('async function consumeMfaFactor'), src.indexOf('// AUDIT-2026-10-02 T2'));
  const consume = new Function('return ' + fnSrc.replace('async function consumeMfaFactor', 'async function'))();
  assert.strictEqual(await consume(sql, { id: 'u' }, { usedBackup: false, newBackupCodes: [], newStep: 11 }), true);
  assert.strictEqual(await consume(sql, { id: 'u' }, { usedBackup: false, newBackupCodes: [], newStep: 11 }), false, 'V2: mesmo código não passa duas vezes');
  console.log('  ✓ V2 TOTP e código de backup não podem ser reutilizados em paralelo');
}

// V3 — Certificado A1: só administrador troca ou remove.
{
  const src = read('api/_certificado.js');
  assert.strictEqual(src.split('if (!canManageTenant(auth)) {').length - 1, 2, 'V3: upload e remoção exigem administrador');
  const status = src.slice(src.indexOf("if (action === 'status'"), src.indexOf("if (action === 'upload'"));
  assert(!status.includes('canManageTenant'), 'V3: consulta de status continua liberada para leitura');
  console.log('  ✓ V3 certificado A1 gerenciado apenas por administrador');
}

// V4 — Sala de tempo real respeita permissão do módulo de orçamentos.
{
  const worker = read('cloudflare-worker.js');
  assert(worker.includes("canRead:canAccessModule(moduleAuth, 'orcamentos', 'read')"), 'V4: leitura do módulo');
  assert(worker.includes('if (!identity.canRead) {'), 'V4: sem leitura não entra');
  assert(worker.includes("trustedHeaders.set('x-fingo-can-edit'"), 'V4: edição repassada pelo Worker');

  const { BudgetSyncRoom } = await import('../api/_edge-realtime.js');
  const room = new BudgetSyncRoom({}, {});
  const sent = [];
  const fakeSocket = () => {
    const handlers = {};
    return { accept() {}, readyState: 1, send(m) { sent.push(JSON.parse(m)); }, addEventListener(t, h) { handlers[t] = h; }, handlers };
  };
  const sock = fakeSocket();
  await room.handleSession(sock, { userId: 'u1', userName: 'Op', role: 'operador', tenantId: 't', canEdit: false });
  await sock.handlers.message({ data: JSON.stringify({ type: 'item_updated', id: 'x' }) });
  assert(sent.some(m => m.code === 'READ_ONLY'), 'V4: usuário sem escrita no módulo não edita');
  console.log('  ✓ V4 colaboração em tempo real respeita permissão do módulo');
}

console.log('\n✅ Auditoria 2026-10-02 (5ª rodada): todas as regressões passaram.');
