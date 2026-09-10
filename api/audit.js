// api/audit.js — Consulta paginada da trilha de auditoria do tenant
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { canViewAudit, permissionError } from './_permissions.js';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

function setCors(req, res) {
  const allowed = ['https://finobra.app.br','https://www.finobra.app.br','http://localhost:3000','http://localhost:3333','http://localhost:5000','http://127.0.0.1:3000','http://127.0.0.1:3333','http://127.0.0.1:5000'];
  const origin = req.headers.origin;
  if (origin && (allowed.includes(origin) || origin.endsWith('.vercel.app'))) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método não permitido.' });

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Não autorizado.' });
  if (!canViewAudit(auth)) return res.status(403).json(permissionError('ROLE_AUDIT_FORBIDDEN'));

  try {
    const sql = getSql();
    const limit = clampInt(req.query?.limit, 50, 1, 100);
    const offset = clampInt(req.query?.offset, 0, 0, 1_000_000);
    const acao = String(req.query?.acao || '').trim().slice(0, 80);
    const entidade = String(req.query?.entidade || '').trim().slice(0, 80);
    const userId = String(req.query?.user_id || '').trim().slice(0, 64);

    const rows = await sql`
      SELECT a.id, a.acao, a.entidade, a.entidade_id, a.dados_anteriores, a.dados_novos,
             a.ip, a.user_agent, a.created_at, a.user_id,
             COALESCE(u.nome, u.username, 'Sistema') AS usuario_nome,
             u.username AS usuario_username
      FROM audit_logs a
      LEFT JOIN usuarios u ON u.id = a.user_id AND u.tenant_id = a.tenant_id
      WHERE a.tenant_id = ${auth.tenantId}
        AND (${acao} = '' OR a.acao = ${acao})
        AND (${entidade} = '' OR a.entidade = ${entidade})
        AND (${userId} = '' OR a.user_id = ${userId})
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        limit,
        offset,
        count: rows.length,
        hasMore: rows.length === limit,
        nextOffset: offset + rows.length
      }
    });
  } catch (err) {
    console.error('[Audit API]', err);
    return res.status(500).json({ success: false, error: 'Não foi possível carregar a auditoria.' });
  }
}
