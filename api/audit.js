// api/audit.js — Auditoria + diagnóstico de erros do cliente (Patch 08)
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { canViewAudit, permissionError } from './_permissions.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

function setCors(req, res) {
  const allowed = ['https://finobra.app.br','https://www.finobra.app.br','http://localhost:3000','http://localhost:3333','http://localhost:5000','http://127.0.0.1:3000','http://127.0.0.1:3333','http://127.0.0.1:5000'];
  const origin = req.headers.origin;
  if (origin && (allowed.includes(origin) || origin.endsWith('.vercel.app'))) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function clean(value, max = 1000) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function redactSensitive(value, max = 1000) {
  let text = clean(value, max * 2);
  // Evita persistir credenciais acidentalmente presentes em mensagens/stack/URLs.
  text = text
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/(re_)[A-Za-z0-9_-]{12,}/gi, '$1[REDACTED]')
    .replace(/([?&](?:token|apikey|api_key|key|secret|password|senha)=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/((?:token|apikey|api_key|secret|password|senha)\s*[:=]\s*)["']?[^\s,;"']+/gi, '$1[REDACTED]');
  return text.slice(0, max);
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Não autorizado.' });

  try {
    const sql = getSql();
    const action = String(req.query?.action || req.body?.action || '').trim().toLowerCase();

    // Qualquer usuário autenticado pode reportar um erro do próprio navegador.
    // O rate-limit evita que um loop de frontend lote a tabela.
    if (req.method === 'POST' && action === 'client_error') {
      const rl = await checkRateLimit(`client-error:${auth.user?.userId || getClientIp(req)}`, 30, 10 * 60 * 1000);
      if (!rl.allowed) return res.status(202).json({ success:true, throttled:true });

      const b = req.body || {};
      const message = redactSensitive(b.message, 1500);
      if (!message) return res.status(400).json({ success:false, error:'Mensagem do erro não informada.' });
      const id = `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
      await sql`
        INSERT INTO client_error_logs (id,tenant_id,user_id,route,message,source,line_no,col_no,stack,user_agent)
        VALUES (
          ${id}, ${auth.tenantId}, ${auth.user?.userId || null}, ${redactSensitive(b.route,120) || null}, ${message},
          ${redactSensitive(b.source,500) || null}, ${Number.isFinite(Number(b.line)) ? Number(b.line) : null},
          ${Number.isFinite(Number(b.col)) ? Number(b.col) : null}, ${redactSensitive(b.stack,5000) || null},
          ${clean(req.headers['user-agent'],1000) || null}
        );
      `;
      return res.status(201).json({ success:true, id });
    }

    if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método não permitido.' });
    if (!canViewAudit(auth)) return res.status(403).json(permissionError('ROLE_AUDIT_FORBIDDEN'));

    const limit = clampInt(req.query?.limit, 50, 1, 100);
    const offset = clampInt(req.query?.offset, 0, 0, 1_000_000);

    if (action === 'errors') {
      const rows = await sql`
        SELECT e.id,e.route,e.message,e.source,e.line_no,e.col_no,e.stack,e.user_agent,e.created_at,e.user_id,
               COALESCE(u.nome,u.username,'Usuário') AS usuario_nome,u.username AS usuario_username
        FROM client_error_logs e
        LEFT JOIN usuarios u ON u.id=e.user_id
        WHERE e.tenant_id=${auth.tenantId}
        ORDER BY e.created_at DESC,e.id DESC
        LIMIT ${limit} OFFSET ${offset};
      `;
      return res.status(200).json({
        success:true,
        data:rows,
        pagination:{ limit,offset,count:rows.length,hasMore:rows.length===limit,nextOffset:offset+rows.length }
      });
    }

    const acao = clean(req.query?.acao, 80);
    const entidade = clean(req.query?.entidade, 80);
    const userId = clean(req.query?.user_id, 64);
    const rows = await sql`
      SELECT a.id, a.acao, a.entidade, a.entidade_id, a.dados_anteriores, a.dados_novos,
             a.ip, a.user_agent, a.created_at, a.user_id,
             COALESCE(u.nome, u.username, 'Sistema') AS usuario_nome,
             u.username AS usuario_username
      FROM audit_logs a
      LEFT JOIN usuarios u ON u.id = a.user_id
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
      pagination: { limit, offset, count: rows.length, hasMore: rows.length === limit, nextOffset: offset + rows.length }
    });
  } catch (err) {
    console.error('[Audit API]', err);
    return res.status(500).json({ success: false, error: 'Não foi possível processar o diagnóstico/auditoria.' });
  }
}
