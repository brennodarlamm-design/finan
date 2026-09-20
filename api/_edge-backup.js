// api/_edge-backup.js — snapshot diário dos dados críticos do FinGo em Cloudflare R2.
// Complementa o PITR limitado do Neon e o pg_dump do GitHub Actions.

import { neon } from '@neondatabase/serverless';
import { putR2Object } from './_edge-r2.js';
import { dispatchEdgeAlert } from './_edge-alerts.js';

const CRITICAL_TABLES = Object.freeze([
  'tenants',
  'usuarios',
  'obras',
  'clientes',
  'lancamentos',
  'fornecedores',
  'produtos',
  'contas',
  'contas_bancarias',
  'orcamentos',
  'orcamentos_sinapi',
  'medicoes',
  'contratos',
  'documentos',
  'billing_invoices',
  'audit_logs'
]);

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function safeJson(value) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') return item.toString();
    return item;
  });
}

async function readCriticalTable(sql, table) {
  // Identificadores nunca vêm de entrada externa: apenas da allowlist acima.
  const query = `SELECT * FROM "${table.replace(/"/g, '""')}" ORDER BY 1`;
  const rows = await sql.query(query);
  return Array.isArray(rows) ? rows : (rows?.rows || []);
}

export async function createCriticalR2Backup(env, { force = false } = {}) {
  const now = new Date();
  const dateKey = utcDateKey(now);
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();

  // O cron roda a cada 10 min. A janela 07:00 UTC corresponde a 03:00 em Boa Vista.
  if (!force && (hour !== 7 || minute >= 10)) {
    return { skipped: true, reason: 'outside_backup_window', date: dateKey };
  }

  const conn = String(env?.DATABASE_OWNER_URL || env?.DATABASE_URL || '').trim();
  if (!conn) {
    const error = 'DATABASE_OWNER_URL/DATABASE_URL ausente no Worker para backup.';
    await dispatchEdgeAlert(env, {
      type: 'BACKUP_CONFIGURATION_ERROR',
      severity: 'CRITICAL',
      title: 'Backup diário do FinGo não pôde iniciar',
      message: error
    }).catch(() => {});
    throw new Error(error);
  }

  if (!env?.ATTACHMENTS_R2 || typeof env.ATTACHMENTS_R2.put !== 'function') {
    const error = 'Binding ATTACHMENTS_R2 ausente no Worker para backup.';
    await dispatchEdgeAlert(env, {
      type: 'BACKUP_CONFIGURATION_ERROR',
      severity: 'CRITICAL',
      title: 'Backup diário do FinGo sem R2',
      message: error
    }).catch(() => {});
    throw new Error(error);
  }

  const sql = neon(conn);
  const snapshot = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    source: 'cloudflare-worker-neon-critical-snapshot',
    date: dateKey,
    tables: {}
  };

  for (const table of CRITICAL_TABLES) {
    const rows = await readCriticalTable(sql, table);
    snapshot.tables[table] = {
      count: rows.length,
      rows
    };
  }

  const json = safeJson(snapshot);
  const bytes = new TextEncoder().encode(json);
  const key = `backups/neon-critical/${dateKey}/snapshot.json`;

  const stored = await putR2Object(env, key, bytes, {
    contentType: 'application/json',
    customMetadata: {
      backupType: 'neon-critical',
      date: dateKey,
      generatedAt: snapshot.generatedAt,
      tableCount: String(CRITICAL_TABLES.length)
    }
  });

  // Manifesto separado facilita validar existência/tamanho sem baixar todo o snapshot.
  const manifest = {
    ok: true,
    key,
    generatedAt: snapshot.generatedAt,
    bytes: stored.size,
    tables: Object.fromEntries(
      Object.entries(snapshot.tables).map(([name, value]) => [name, value.count])
    )
  };
  await putR2Object(
    env,
    `backups/neon-critical/${dateKey}/manifest.json`,
    new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    { contentType: 'application/json', customMetadata: { backupType: 'manifest', date: dateKey } }
  );

  return manifest;
}

export { CRITICAL_TABLES };
