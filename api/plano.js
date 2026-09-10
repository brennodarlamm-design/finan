// api/plano.js — Uso e permissões do plano atual, sempre calculados no servidor
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { getPlanRule } from './_plans.js';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
    return res.status(200).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método não permitido.' });

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Não autorizado.' });

  try {
    const sql = getSql();
    const tenantRows = await sql`SELECT plano, status, created_at, vencimento FROM tenants WHERE id = ${auth.tenantId} LIMIT 1;`;
    if (!tenantRows.length) return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });

    const tenant = tenantRows[0];
    const rule = getPlanRule(tenant.plano);

    let vencStr = '';
    if (tenant.vencimento) {
      const vDate = new Date(tenant.vencimento);
      if (!isNaN(vDate.getTime())) vencStr = vDate.toISOString().split('T')[0];
    }
    if (!vencStr && tenant.created_at) {
      const cDate = new Date(tenant.created_at);
      if (!isNaN(cDate.getTime())) {
        const addDays = (tenant.status === 'trial' || tenant.plano === 'trial') ? 15 : 30;
        cDate.setDate(cDate.getDate() + addDays);
        vencStr = cDate.toISOString().split('T')[0];
      }
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let diasRestantes = null;
    let expirado = false;
    if (vencStr) {
      const target = new Date(vencStr + 'T00:00:00');
      const diffMs = target.getTime() - hoje.getTime();
      diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      expirado = diasRestantes < 0;
    }

    const counts = await sql`
      SELECT
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(status, 'em_andamento')) NOT IN ('concluida','concluído','concluido','cancelada','cancelado')
        )::int AS obras_ativas,
        COUNT(*)::int AS obras_total
      FROM obras
      WHERE tenant_id = ${auth.tenantId};
    `;

    const active = Number(counts[0]?.obras_ativas || 0);
    const total = Number(counts[0]?.obras_total || 0);
    const max = rule.maxActiveObras;

    return res.status(200).json({
      success: true,
      plan: {
        id: rule.id,
        label: rule.label,
        status: tenant.status || 'trial',
        vencimento: vencStr,
        diasRestantes,
        expirado,
        maxActiveObras: max,
        features: rule.features,
        usage: {
          activeObras: active,
          totalObras: total,
          remainingActiveObras: max == null ? null : Math.max(0, max - active)
        }
      }
    });
  } catch (err) {
    console.error('[Plano API]', err);
    return res.status(500).json({ success: false, error: 'Não foi possível consultar o plano.' });
  }
}
