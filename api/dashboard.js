// api/dashboard.js — Snapshot leve e atualizado do dashboard, calculado no Neon
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
}

function num(v) { return Number(v || 0); }

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método não permitido.' });

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Não autorizado.' });

  try {
    const sql = getSql();
    const rawObraId = String(req.query?.obra_id || '').trim();
    let obraId = rawObraId && rawObraId !== 'todas' ? rawObraId : '';
    if (obraId && !['escritorio', 'geral'].includes(obraId)) {
      const valid = await sql`SELECT id FROM obras WHERE tenant_id=${auth.tenantId} AND id=${obraId} LIMIT 1;`;
      if (!valid.length) obraId = '';
    }

    const filter = obraId;
    const [financeRows, nfRows, obraRows, medRows, recentRows] = await Promise.all([
      sql`
        SELECT
          COALESCE(SUM(valor) FILTER (WHERE tipo='receita' AND status='recebido'),0)::numeric AS total_receitas,
          COALESCE(SUM(valor) FILTER (WHERE tipo='despesa' AND status='pago'),0)::numeric AS total_despesas,
          COUNT(*) FILTER (WHERE tipo='despesa' AND status='a_pagar')::int AS a_pagar,
          COALESCE(SUM(valor) FILTER (WHERE tipo='despesa' AND status='a_pagar'),0)::numeric AS a_pagar_valor,
          COUNT(*) FILTER (WHERE tipo='receita' AND status='a_receber')::int AS a_receber,
          COALESCE(SUM(valor) FILTER (WHERE tipo='receita' AND status='a_receber'),0)::numeric AS a_receber_valor
        FROM lancamentos
        WHERE tenant_id=${auth.tenantId}
          AND (${filter}='' OR obra_id=${filter});
      `,
      sql`
        SELECT COUNT(*)::int AS qtd,
               COALESCE(SUM(COALESCE(valor_total, valor_bruto, 0)),0)::numeric AS valor
        FROM notas_fiscais
        WHERE tenant_id=${auth.tenantId} AND status='pendente'
          AND (${filter}='' OR obra_id=${filter});
      `,
      sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(status,'em_andamento')) NOT IN ('concluida','concluída','concluido','concluído','cancelada','cancelado'))::int AS ativas
        FROM obras WHERE tenant_id=${auth.tenantId};
      `,
      sql`
        SELECT COUNT(*)::int AS pendentes
        FROM medicoes
        WHERE tenant_id=${auth.tenantId}
          AND status IN ('em_analise','submetida')
          AND (${filter}='' OR obra_id=${filter});
      `,
      sql`
        SELECT l.id,l.data,l.descricao,l.categoria,l.tipo,l.valor,l.status,l.obra_id,o.nome AS obra_nome
        FROM lancamentos l
        LEFT JOIN obras o ON o.id=l.obra_id AND o.tenant_id=l.tenant_id
        WHERE l.tenant_id=${auth.tenantId}
          AND (${filter}='' OR l.obra_id=${filter})
        ORDER BY l.data DESC,l.created_at DESC,l.id DESC
        LIMIT 10;
      `
    ]);

    const f = financeRows[0] || {};
    const n = nfRows[0] || {};
    const o = obraRows[0] || {};
    const m = medRows[0] || {};
    const totalReceitas = num(f.total_receitas);
    const totalDespesas = num(f.total_despesas);

    return res.status(200).json({
      success: true,
      snapshot: {
        totalReceitas,
        totalDespesas,
        saldo: totalReceitas - totalDespesas,
        nfPendentes: num(n.qtd),
        nfPendentesValor: num(n.valor),
        aPagar: num(f.a_pagar),
        aPagarValor: num(f.a_pagar_valor),
        aReceber: num(f.a_receber),
        aReceberValor: num(f.a_receber_valor),
        obrasAtivas: num(o.ativas),
        obrasTotal: num(o.total),
        medicoesPendentes: num(m.pendentes),
        recent: recentRows.map(r => ({ ...r, valor: num(r.valor) }))
      }
    });
  } catch (err) {
    console.error('[Dashboard API]', err);
    return res.status(500).json({ success: false, error: 'Não foi possível atualizar o dashboard.' });
  }
}
