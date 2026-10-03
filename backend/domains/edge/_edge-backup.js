// api/_edge-backup.js — snapshot diário dos dados críticos do FinGo em Cloudflare R2.
// Complementa o PITR limitado do Neon e o pg_dump do GitHub Actions.

import { neon } from '@neondatabase/serverless';
import { putR2Object, getR2Object, buildR2ObjectKey } from './_edge-r2.js';
import { dispatchEdgeAlert } from './_edge-alerts.js';

// Nomes reais das tabelas no Neon. "clientes" e "contas" não existem (as obras ficam
// em "obras" e as contas em "contas_bancarias"): a primeira consulta falhava e
// abortava o snapshot inteiro.
const CRITICAL_TABLES = Object.freeze([
  'tenants',
  'usuarios',
  'obras',
  'obra_cadastro_geral',
  'lancamentos',
  'fornecedores',
  'produtos',
  'contas_bancarias',
  'notas_fiscais',
  'precompras',
  'orcamentos',
  'orcamentos_sinapi',
  'medicoes',
  'contratos',
  'recibos',
  'documentos',
  'obra_doc_fases',
  'document_signatures',
  'ocr_historico',
  'tenant_preferences',
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

// AUDIT-2026-10-02 R3: o snapshot tinha todas as tabelas críticas (inclusive `usuarios`)
// em JSON puro, no mesmo bucket dos anexos dos clientes. Agora:
//   1. é cifrado com AES-256-GCM (chave derivada de BACKUP_ENCRYPTION_KEY via SHA-256);
//   2. vai para o bucket dedicado BACKUPS_R2 (fallback: ATTACHMENTS_R2, sempre cifrado, com alerta);
//   3. sem chave de cifra, o backup NÃO é gravado (falha fechada) e um alerta crítico é disparado.
// Formato do arquivo .enc: "FGBK1" (5 bytes) | IV (12 bytes) | ciphertext+tag (AES-GCM).
// Para restaurar: node scripts/decrypt-r2-backup.mjs <arquivo.enc> <saida.json>
export const BACKUP_MAGIC = 'FGBK1';

async function deriveBackupKey(secret) {
  const material = new TextEncoder().encode(String(secret));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', material);
  return globalThis.crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptBackupPayload(plainBytes, secret) {
  const key = await deriveBackupKey(secret);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plainBytes));
  const magic = new TextEncoder().encode(BACKUP_MAGIC);
  const out = new Uint8Array(magic.length + iv.length + cipher.length);
  out.set(magic, 0);
  out.set(iv, magic.length);
  out.set(cipher, magic.length + iv.length);
  return out;
}

export async function decryptBackupPayload(encBytes, secret) {
  const bytes = encBytes instanceof Uint8Array ? encBytes : new Uint8Array(encBytes);
  const magic = new TextDecoder().decode(bytes.slice(0, BACKUP_MAGIC.length));
  if (magic !== BACKUP_MAGIC) throw new Error('Arquivo não é um backup cifrado FinGo (FGBK1).');
  const iv = bytes.slice(BACKUP_MAGIC.length, BACKUP_MAGIC.length + 12);
  const cipher = bytes.slice(BACKUP_MAGIC.length + 12);
  const key = await deriveBackupKey(secret);
  return new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher));
}

function resolveBackupBucket(env) {
  if (env?.BACKUPS_R2 && typeof env.BACKUPS_R2.put === 'function') return { bucket: env.BACKUPS_R2, isolated: true };
  if (env?.ATTACHMENTS_R2 && typeof env.ATTACHMENTS_R2.put === 'function') return { bucket: env.ATTACHMENTS_R2, isolated: false };
  return { bucket: null, isolated: false };
}

export async function createCriticalR2Backup(env, { force = false, sqlFactory = neon } = {}) {
  const now = new Date();
  const dateKey = utcDateKey(now);
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();

  // O cron roda a cada 10 min. A janela 07:00 UTC corresponde a 03:00 em Boa Vista.
  if (!force && (hour !== 7 || minute >= 10)) {
    return { skipped: true, reason: 'outside_backup_window', date: dateKey };
  }

  const encryptionSecret = String(env?.BACKUP_ENCRYPTION_KEY || '').trim();
  if (encryptionSecret.length < 32) {
    const error = 'BACKUP_ENCRYPTION_KEY ausente ou curta (mín. 32 caracteres). Backup não gravado para não expor dados em texto puro.';
    await dispatchEdgeAlert(env, {
      type: 'BACKUP_CONFIGURATION_ERROR',
      severity: 'CRITICAL',
      title: 'Backup diário do FinGo sem chave de criptografia',
      message: error
    }).catch(() => {});
    throw new Error(error);
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

  const { bucket, isolated } = resolveBackupBucket(env);
  if (!bucket) {
    const error = 'Nenhum bucket R2 (BACKUPS_R2/ATTACHMENTS_R2) disponível no Worker para backup.';
    await dispatchEdgeAlert(env, {
      type: 'BACKUP_CONFIGURATION_ERROR',
      severity: 'CRITICAL',
      title: 'Backup diário do FinGo sem R2',
      message: error
    }).catch(() => {});
    throw new Error(error);
  }
  if (!isolated) {
    await dispatchEdgeAlert(env, {
      type: 'BACKUP_BUCKET_NOT_ISOLATED',
      severity: 'WARNING',
      title: 'Backup cifrado gravado no bucket de anexos',
      message: 'Binding BACKUPS_R2 ausente; o snapshot cifrado foi gravado em ATTACHMENTS_R2. Crie o bucket dedicado.'
    }).catch(() => {});
  }

  const sql = sqlFactory(conn);
  const snapshot = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    source: 'cloudflare-worker-neon-critical-snapshot',
    date: dateKey,
    tables: {}
  };

  // Uma tabela com problema não pode derrubar o backup das demais: registra a falha,
  // segue com as outras e alerta no fim.
  const failedTables = [];
  for (const table of CRITICAL_TABLES) {
    try {
      const rows = await readCriticalTable(sql, table);
      snapshot.tables[table] = { count: rows.length, rows };
    } catch (err) {
      failedTables.push(table);
      snapshot.tables[table] = { count: 0, rows: [], error: String(err?.message || err).slice(0, 200) };
    }
  }
  if (failedTables.length === CRITICAL_TABLES.length) {
    const error = 'Nenhuma tabela pôde ser lida para o backup diário.';
    await dispatchEdgeAlert(env, { type: 'BACKUP_FAILED', severity: 'CRITICAL', title: 'Backup diário do FinGo falhou', message: error }).catch(() => {});
    throw new Error(error);
  }
  if (failedTables.length) {
    await dispatchEdgeAlert(env, {
      type: 'BACKUP_PARTIAL',
      severity: 'HIGH',
      title: 'Backup diário do FinGo incompleto',
      message: `Tabelas não copiadas: ${failedTables.join(', ')}`
    }).catch(() => {});
  }

  const plainBytes = new TextEncoder().encode(safeJson(snapshot));
  const encrypted = await encryptBackupPayload(plainBytes, encryptionSecret);
  const key = `backups/neon-critical/${dateKey}/snapshot.json.enc`;

  const stored = await bucket.put(key, encrypted, {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: {
      backupType: 'neon-critical',
      encryption: 'AES-256-GCM/FGBK1',
      date: dateKey,
      generatedAt: snapshot.generatedAt,
      tableCount: String(CRITICAL_TABLES.length)
    }
  });

  // Manifesto separado (somente contagens, sem dados) facilita validar existência/tamanho.
  const manifest = {
    ok: failedTables.length === 0,
    failedTables,
    key,
    encrypted: true,
    isolatedBucket: isolated,
    generatedAt: snapshot.generatedAt,
    bytes: stored?.size ?? encrypted.byteLength,
    tables: Object.fromEntries(
      Object.entries(snapshot.tables).map(([name, value]) => [name, value.count])
    )
  };
  await bucket.put(
    `backups/neon-critical/${dateKey}/manifest.json`,
    new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    { httpMetadata: { contentType: 'application/json' }, customMetadata: { backupType: 'manifest', date: dateKey } }
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
       WHERE (url IS NULL OR url = '' OR url ILIKE '%blob.vercel-storage.com%')
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
            tamanho_bytes = ${decoded.bytes.length},
            base64_data = NULL
        WHERE id = ${row.id}
          AND tenant_id = ${row.tenant_id}
      `;
      migrated++;
    } catch (err) {
      failures.push({ id:row.id, error:String(err?.message || err).slice(0, 300) });
    }
  }

  // Limpeza de segurança: anular base64_data duplicado para documentos que já possuem URL válida
  await sql.query(
    `UPDATE documentos
        SET base64_data = NULL
      WHERE url IS NOT NULL
        AND url != ''
        AND base64_data IS NOT NULL`
  ).catch(() => {});

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
