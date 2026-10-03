// api/_ofx-registry.js — Registro no servidor das transações OFX já importadas (FITID por conta).
//
// VARREDURA 2026-10-03 #8: a proteção contra reimportar o mesmo extrato ficava só no aparelho.
// POST /api/v2/ofx/fitids
//   { action: 'check',      conta, fitids: [...] }            → { existentes: [...] }
//   { action: 'register',   conta, fitids: [...], import_id } → { registrados: n }
//   { action: 'unregister', import_id }                       → { removidos: n }   (desfazer import)
// Tabela: migrations/039_ofx_transacoes_importadas.sql (RLS por tenant).

import { resolveAuthAndTenant } from './_auth.js';
import { canAccessModule, canWriteData, permissionError } from './_permissions.js';
import { createRuntimeSql } from './_database.js';
import { createTenantSql } from './_tenant-sql.js';
import { checkRateLimit } from './_ratelimit.js';

export const OFX_MAX_FITIDS = 2000;

const limpa = (v, max) => String(v ?? '').trim().slice(0, max);

export function normalizarFitids(lista) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  for (const item of lista) {
    const f = limpa(item, 255);
    if (f) vistos.add(f);
    if (vistos.size >= OFX_MAX_FITIDS) break;
  }
  return [...vistos];
}

export async function handleOfxFitids(req, res, deps = {}) {
  res.setHeader?.('Content-Type', 'application/json; charset=utf-8');
  if (req.method && req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método não permitido.' });
  const auth = await (deps.resolveAuth || resolveAuthAndTenant)(req);
  if (!auth?.authenticated || !auth.tenantId) return res.status(auth?.status || 401).json({ success: false, error: auth?.error || 'Não autorizado.' });

  const body = req.body || {};
  const action = limpa(body.action, 20);
  const escrita = action === 'register' || action === 'unregister';
  if (!canAccessModule(auth, 'financeiro', escrita ? 'write' : 'read')) {
    return res.status(403).json(permissionError(escrita ? 'MODULE_WRITE_FORBIDDEN' : 'MODULE_READ_FORBIDDEN', 'financeiro'));
  }
  if (escrita && !canWriteData(auth)) return res.status(403).json(permissionError('ROLE_READ_ONLY'));

  const rl = await (deps.rateLimit || checkRateLimit)(`ofx:fitids:${auth.tenantId}`, 120, 60_000);
  if (rl && rl.allowed === false) return res.status(429).json({ success: false, error: 'Muitas requisições. Aguarde um minuto.' });

  const sql = deps.sql || createTenantSql(createRuntimeSql(), { tenantId: auth.tenantId });
  const tenantId = auth.tenantId;

  try {
    if (action === 'unregister') {
      const importId = limpa(body.import_id, 120);
      if (!importId) return res.status(400).json({ success: false, error: 'Informe o import_id.' });
      const rows = await sql`DELETE FROM ofx_transacoes_importadas WHERE tenant_id = ${tenantId} AND import_id = ${importId} RETURNING fitid;`;
      return res.status(200).json({ success: true, removidos: rows.length });
    }

    const conta = limpa(body.conta, 120);
    const fitids = normalizarFitids(body.fitids);
    if (!conta) return res.status(400).json({ success: false, error: 'Informe a conta do extrato.' });
    if (!fitids.length) return res.status(200).json({ success: true, existentes: [], registrados: 0 });

    if (action === 'check') {
      const rows = await sql`
        SELECT fitid FROM ofx_transacoes_importadas
        WHERE tenant_id = ${tenantId} AND conta_chave = ${conta} AND fitid = ANY(${fitids});
      `;
      return res.status(200).json({ success: true, existentes: rows.map(r => r.fitid) });
    }

    if (action === 'register') {
      const importId = limpa(body.import_id, 120) || null;
      const rows = await sql`
        INSERT INTO ofx_transacoes_importadas (tenant_id, conta_chave, fitid, import_id, imported_by)
        SELECT ${tenantId}, ${conta}, f, ${importId}, ${limpa(auth.user?.id, 80) || null}
        FROM unnest(${fitids}::text[]) AS f
        ON CONFLICT (tenant_id, conta_chave, fitid) DO NOTHING
        RETURNING fitid;
      `;
      return res.status(200).json({ success: true, registrados: rows.length });
    }

    return res.status(400).json({ success: false, error: 'Ação inválida. Use check, register ou unregister.' });
  } catch (err) {
    console.error('[OFX] Registro de FITIDs falhou:', err?.message || err);
    return res.status(503).json({ success: false, error: 'Registro de extratos indisponível no momento.' });
  }
}
