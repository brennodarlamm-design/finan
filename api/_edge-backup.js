// api/_edge-backup.js — snapshot diário dos dados críticos do FinGo em Cloudflare R2.
// Complementa o PITR limitado do Neon e o pg_dump do GitHub Actions.

import { neon } from '@neondatabase/serverless';
import { putR2Object, getR2Object, buildR2ObjectKey } from './_edge-r2.js';
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


function decodeStoredDataUrl(value, fallbackMime = 'application/octet-stream') {
  const raw = String(value || '');
  const match = raw.match(/^data:([^;,]+)?;base64,([\s\S]+)$/i);
  if (match) {
    return {
      mime: String(match[1] || fallbackMime),
      bytes: Buffer.from(match[2], 'base64')
    };
  }
  return { mime: fallbackMime, bytes: Buffer.from(raw, 'base64') };
}

export async function migrateLegacyDocumentsToR2(env, { limit = 25 } = {}) {
  const conn = String(env?.DATABASE_OWNER_URL || env?.DATABASE_URL || '').trim();
  if (!conn || !env?.ATTACHMENTS_R2 || typeof env.ATTACHMENTS_R2.put !== 'function') {
    return { skipped:true, reason:'storage_or_database_not_ready' };
  }

  const sql = neon(conn);
  const rowsResult = await sql.query(
    `SELECT id, tenant_id, nome_arquivo, tipo_arquivo, tamanho_bytes, base64_data, url
       FROM documentos
       WHERE url ILIKE '%blob.vercel-storage.com%'
         AND base64_data IS NOT NULL
         AND length(base64_data) > 0
       ORDER BY created_at ASC NULLS LAST, id ASC
       LIMIT ${Math.max(1, Math.min(Number(limit) || 25, 100))}`
  );
  const rows = Array.isArray(rowsResult) ? rowsResult : (rowsResult?.rows || []);
  if (!rows.length) return { migrated:0, remaining:false };

  let migrated = 0;
  const failures = [];

  for (const row of rows) {
    try {
      const decoded = decodeStoredDataUrl(row.base64_data, row.tipo_arquivo || 'application/octet-stream');
      if (!decoded.bytes.length) throw new Error('Documento legado sem conteúdo decodificável.');

      const key = buildR2ObjectKey(
        row.tenant_id,
        'documentos',
        row.nome_arquivo || `${row.id}.bin`
      );
      const stored = await putR2Object(env, key, decoded.bytes, {
        contentType: decoded.mime,
        customMetadata: {
          tenantId: String(row.tenant_id || ''),
          documentId: String(row.id || ''),
          migratedFrom: 'vercel_blob',
          originalName: String(row.nome_arquivo || '')
        }
      });

      const verify = await getR2Object(env, key);
      if (!verify || Number(verify.size || 0) !== Number(stored.size || decoded.bytes.length)) {
        throw new Error('Validação do objeto R2 falhou após upload.');
      }

      const newUrl = `r2://${key}`;
      await sql`
        UPDATE documentos
        SET url = ${newUrl},
            tipo_arquivo = ${decoded.mime},
            tamanho_bytes = ${decoded.bytes.length}
        WHERE id = ${row.id}
          AND tenant_id = ${row.tenant_id}
          AND url = ${row.url}
      `;
      migrated++;
    } catch (err) {
      failures.push({ id:row.id, error:String(err?.message || err).slice(0, 300) });
    }
  }

  if (failures.length) {
    await dispatchEdgeAlert(env, {
      type:'LEGACY_STORAGE_MIGRATION_ERROR',
      severity:'CRITICAL',
      title:'Migração Vercel Blob → R2 incompleta',
      message:`${failures.length} documento(s) não foram migrados.`,
      details:{ failures }
    }).catch(() => {});
  }

  return { migrated, failures, remaining: rows.length >= limit };
}

export { CRITICAL_TABLES };
