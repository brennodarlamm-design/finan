// api/_sync-guard.js — Controle de versão (concorrência otimista) para gravações vindas do app.
//
// VARREDURA 2026-10-03 #4: fora de `lancamentos`, o servidor gravava "quem chegar por último
// vence". Um celular que ficou dias offline sobrescrevia edições mais novas feitas no escritório
// e recriava registros já excluídos ("Sincronizar tudo" fazia o mesmo com o cache inteiro).
//
// Regra (a mesma de `lancamentos`, que usa o xmin do Postgres como versão):
//   • registro novo (o app ainda não tem `sync_version`) → grava normalmente;
//   • registro que veio da nuvem (tem `sync_version`) → só grava se a linha ainda existir e
//     estiver na mesma versão. Senão responde 409 SYNC_CONFLICT e o app abre a revisão.
// As leituras devolvem `xmin::text AS sync_version` para o app guardar a versão de cada registro.

/** Tabela lógica do app → tabela do banco. */
export const SYNC_GUARD_TABLES = Object.freeze({
  obras: 'obras',
  clientes: 'obras',
  fornecedores: 'fornecedores',
  notas: 'notas_fiscais',
  notas_fiscais: 'notas_fiscais',
  produtos: 'produtos',
  contas: 'contas_bancarias',
  contas_bancarias: 'contas_bancarias',
  orcamentos: 'orcamentos',
  medicoes: 'medicoes',
  documentos: 'documentos',
  precompras: 'precompras',
  contratos: 'contratos',
  recibos: 'recibos',
  orcamentos_sinapi: 'orcamentos_sinapi'
  // doc_fases fica de fora: o app guarda as fases por obra, fora das coleções, e não teria
  // como atualizar a versão local após cada gravação (a 2ª edição viraria conflito falso).
});

/** ID gravado no banco para o registro. */
export function syncRecordId(_table, data) {
  if (!data || typeof data !== 'object') return '';
  return String(data.id || '').trim();
}

/** Versão atual da linha (xmin) ou null se não existir. Identificadores nunca vêm do cliente. */
export async function readSyncVersion(sql, table, tenantId, id) {
  const dbTable = SYNC_GUARD_TABLES[table];
  if (!dbTable || !id) return null;
  let rows;
  switch (dbTable) {
    case 'obras': rows = await sql`SELECT xmin::text AS v FROM obras WHERE tenant_id = ${tenantId} AND id = ${id}`; break;
    case 'fornecedores': rows = await sql`SELECT xmin::text AS v FROM fornecedores WHERE tenant_id = ${tenantId} AND id = ${id}`; break;
    case 'notas_fiscais': rows = await sql`SELECT xmin::text AS v FROM notas_fiscais WHERE tenant_id = ${tenantId} AND id = ${id}`; break;
    case 'produtos': rows = await sql`SELECT xmin::text AS v FROM produtos WHERE tenant_id = ${tenantId} AND id = ${id}`; break;
    case 'contas_bancarias': rows = await sql`SELECT xmin::text AS v FROM contas_bancarias WHERE tenant_id = ${tenantId} AND id = ${id}`; break;
    case 'orcamentos': rows = await sql`SELECT xmin::text AS v FROM orcamentos WHERE tenant_id = ${tenantId} AND id = ${id}`; break;
    case 'medicoes': rows = await sql`SELECT xmin::text AS v FROM medicoes WHERE tenant_id = ${tenantId} AND id = ${id}`; break;
    case 'documentos': rows = await sql`SELECT xmin::text AS v FROM documentos WHERE tenant_id = ${tenantId} AND id = ${id}`; break;
    case 'precompras': rows = await sql`SELECT xmin::text AS v FROM precompras WHERE tenant_id = ${tenantId} AND id = ${id}`; break;
    case 'contratos': rows = await sql`SELECT xmin::text AS v FROM contratos WHERE tenant_id = ${tenantId} AND id = ${id}`; break;
    case 'recibos': rows = await sql`SELECT xmin::text AS v FROM recibos WHERE tenant_id = ${tenantId} AND id = ${id}`; break;
    case 'orcamentos_sinapi': rows = await sql`SELECT xmin::text AS v FROM orcamentos_sinapi WHERE tenant_id = ${tenantId} AND id = ${id}`; break;
    default: return null;
  }
  const row = Array.isArray(rows) ? rows[0] : rows?.rows?.[0];
  return row?.v ?? null;
}

/**
 * Retorna o corpo do 409 quando a gravação usaria uma versão desatualizada (ou recriaria
 * um registro excluído); null quando pode gravar.
 */
export async function syncVersionConflict(sql, table, tenantId, data) {
  if (!SYNC_GUARD_TABLES[table]) return null;
  const expected = String(data?.sync_version ?? '').trim();
  if (!expected) return null; // registro criado neste aparelho e ainda não confirmado pela nuvem
  const id = syncRecordId(table, data);
  if (!id) return null;
  const current = await readSyncVersion(sql, table, tenantId, id);
  if (current === null) {
    return { success: false, code: 'SYNC_CONFLICT', deleted: true, id, error: 'Este registro foi excluído em outro dispositivo. Revise a alteração antes de recriá-lo.' };
  }
  if (current !== expected) {
    return { success: false, code: 'SYNC_CONFLICT', id, error: 'Este registro foi alterado em outro dispositivo. Atualize os dados e revise a alteração.' };
  }
  return null;
}

/** Cópia do registro sem a versão (para não gravar a versão antiga dentro do payload JSON). */
export function withoutSyncVersion(data) {
  if (!data || typeof data !== 'object' || !('sync_version' in data)) return data;
  const { sync_version: _ignored, ...rest } = data;
  return rest;
}
