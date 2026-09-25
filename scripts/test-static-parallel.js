// scripts/test-static-parallel.js — Executor Paralelo de Testes Estáticos do FinGo
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

// Lê a lista de testes diretamente de test-static-all.js para manter 100% de paridade
const allSrc = fs.readFileSync('scripts/test-static-all.js', 'utf8');
const testsMatch = allSrc.match(/const tests = \[([\s\S]*?)\]\.filter/);
if (!testsMatch) {
  throw new Error('Não foi possível ler a lista de testes de scripts/test-static-all.js');
}

const tests = testsMatch[1]
  .split('\n')
  .map(l => l.trim().replace(/^['"]|['"],?$/g, ''))
  .filter(l => l.startsWith('scripts/test-'));

const p50Match = allSrc.match(/const p50NativeSourceTests = new Set\(\[([\s\S]*?)\]\);/);
const p50NativeSourceTests = new Set(
  p50Match
    ? p50Match[1].split('\n').map(l => l.trim().replace(/^['"]|['"],?$/g, '')).filter(Boolean)
    : []
);

const preload = path.resolve('scripts/test-api-wrapper-preload.cjs');
const maxConcurrency = Math.min(6, Math.max(2, os.cpus().length || 4));

console.log(`⚡ Iniciando suíte de testes paralela (${tests.length} testes em ${maxConcurrency} workers)...`);
const startTime = Date.now();

let completedCount = 0;
let hasFailure = false;
const queue = [...tests];

function runNextWorker() {
  return new Promise((resolve) => {
    function processNext() {
      if (queue.length === 0 || hasFailure) {
        return resolve();
      }

      const file = queue.shift();
      const env = { ...process.env };
      env.SESSION_SIGNING_SECRET ||= 'test-only-session-signing-secret-0123456789abcdef';
      env.MFA_ENCRYPTION_KEY ||= 'test-only-mfa-encryption-key-0123456789abcdef';
      env.TENANT_KEY_PEPPER ||= 'test-only-tenant-key-pepper-0123456789abcdef';
      env.IP_BAN_PEPPER ||= 'test-only-ip-ban-pepper-0123456789abcdef';

      if (!p50NativeSourceTests.has(file)) {
        const prior = String(env.NODE_OPTIONS || '').trim();
        env.NODE_OPTIONS = `${prior}${prior ? ' ' : ''}--require=${preload}`;
      }

      let stdout = '';
      let stderr = '';

      const child = spawn(process.execPath, [file], { env });
      child.stdout.on('data', d => { stdout += d; });
      child.stderr.on('data', d => { stderr += d; });

      child.on('close', (code) => {
        completedCount++;
        const percent = Math.round((completedCount / tests.length) * 100);
        if (code === 0) {
          process.stdout.write(`\r[${percent}%] (${completedCount}/${tests.length}) ✓ ${path.basename(file)}`.padEnd(80));
          processNext();
        } else {
          hasFailure = true;
          console.error(`\n\n❌ FALHA em ${file} (código ${code}):`);
          if (stdout) console.log(stdout);
          if (stderr) console.error(stderr);
          resolve();
        }
      });
    }

    processNext();
  });
}

const workers = Array.from({ length: maxConcurrency }, () => runNextWorker());
await Promise.all(workers);

const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

if (hasFailure) {
  console.error(`\n💥 A suíte paralela falhou após ${elapsedSec}s.`);
  process.exit(1);
} else {
  console.log(`\n\n🎉 Sucesso total! Todos os ${tests.length} testes passaram em apenas ${elapsedSec}s!`);
}
