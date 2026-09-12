// api/plano.js — Plano, uso real e cobrança PIX auditável do tenant
import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { getPlanRule, normalizePlan } from './_plans.js';
import { canManageTenant, canAccessModule, permissionError } from './_permissions.js';
import { writeAudit } from './_audit.js';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

function setCors(req, res) {
  const allowed = ['https://finobra.app.br','https://www.finobra.app.br','http://localhost:3000','http://localhost:3333','http://localhost:5000','http://127.0.0.1:3000','http://127.0.0.1:3333','http://127.0.0.1:5000'];
  const origin = req.headers.origin;
  if (origin && (allowed.includes(origin) || /^https:\/\/finan-as(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin))) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
}

function onlyAscii(value, max) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 .\-]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

function tlv(id, value) {
  const v = String(value ?? '');
  return `${id}${String(v.length).padStart(2, '0')}${v}`;
}

function crc16Ccitt(text) {
  let crc = 0xFFFF;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildPixPayload({ key, amountCents, txid }) {
  const cleanKey = String(key || '').trim();
  if (!cleanKey) return '';
  const merchantName = onlyAscii(process.env.FINOBRA_PIX_MERCHANT_NAME || 'FINOBRA SISTEMA', 25) || 'FINOBRA';
  const merchantCity = onlyAscii(process.env.FINOBRA_PIX_CITY || 'BOA VISTA', 15) || 'BOA VISTA';
  const merchantAccount = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', cleanKey);
  const amount = (Number(amountCents || 0) / 100).toFixed(2);
  const additional = tlv('05', onlyAscii(txid, 25) || '***');
  const base =
    tlv('00', '01') +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', amount) +
    tlv('58', 'BR') +
    tlv('59', merchantName) +
    tlv('60', merchantCity) +
    tlv('62', additional) +
    '6304';
  return base + crc16Ccitt(base);
}

function billingWhatsapp() {
  return String(process.env.FINOBRA_BILLING_WHATSAPP || '5595991363678').replace(/\D/g, '').slice(0, 20);
}

function dateOnly(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ success: false, error: 'Método não permitido.' });

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Não autorizado.' });
  if (!canAccessModule(auth,'planos',req.method === 'POST' ? 'write' : 'read')) return res.status(403).json(permissionError(req.method === 'POST' ? 'MODULE_WRITE_FORBIDDEN' : 'MODULE_READ_FORBIDDEN','planos'));

  try {
    const sql = getSql();

    if (req.method === 'POST') {
      const action = String(req.query?.action || req.body?.action || '').trim();
      if (action !== 'create_invoice') return res.status(400).json({ success:false, error:'Ação de cobrança inválida.' });
      if (!canManageTenant(auth)) return res.status(403).json(permissionError('ROLE_MANAGE_TENANT_FORBIDDEN'));

      const planId = normalizePlan(req.body?.plan_id);
      if (planId === 'trial') return res.status(400).json({ success:false, error:'O plano Trial não gera cobrança.' });
      const rule = getPlanRule(planId);
      const amountCents = Number(rule.monthlyPriceCents || 0);
      if (!amountCents) return res.status(400).json({ success:false, error:'Plano sem valor mensal configurado.' });

      await sql`UPDATE billing_invoices SET status='expired', updated_at=NOW() WHERE tenant_id=${auth.tenantId} AND status='pending' AND expires_at IS NOT NULL AND expires_at < NOW();`;
      const existing = await sql`
        SELECT id, tenant_id, plan_id, amount_cents, status, txid, pix_payload, expires_at, created_at
        FROM billing_invoices
        WHERE tenant_id=${auth.tenantId} AND plan_id=${planId} AND status='pending'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC LIMIT 1;
      `;
      if (existing.length) {
        return res.status(200).json({ success:true, invoice:existing[0], billingWhatsapp:billingWhatsapp(), reused:true });
      }

      const id = 'inv_' + crypto.randomBytes(10).toString('hex');
      const txid = ('FIN' + crypto.randomBytes(10).toString('hex')).toUpperCase().slice(0, 25);
      const pixKey = String(process.env.FINOBRA_PIX_KEY || '+5595991363678').trim();
      const pixPayload = buildPixPayload({ key: pixKey, amountCents, txid });
      const rows = await sql`
        INSERT INTO billing_invoices (id, tenant_id, plan_id, amount_cents, status, txid, pix_payload, created_by, expires_at)
        VALUES (${id}, ${auth.tenantId}, ${planId}, ${amountCents}, 'pending', ${txid}, ${pixPayload || null}, ${auth.user?.userId || auth.user?.id || null}, NOW() + INTERVAL '1 day')
        RETURNING id, tenant_id, plan_id, amount_cents, status, txid, pix_payload, expires_at, created_at;
      `;
      await writeAudit(sql, req, auth, { acao:'criar', entidade:'cobranca', entidadeId:id, depois:{ plan_id:planId, amount_cents:amountCents, txid } });
      return res.status(201).json({ success:true, invoice:rows[0], billingWhatsapp:billingWhatsapp(), reused:false });
    }

    const tenantRows = await sql`SELECT plano, status, created_at, vencimento FROM tenants WHERE id = ${auth.tenantId} LIMIT 1;`;
    if (!tenantRows.length) return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });

    const tenant = tenantRows[0];
    const rule = getPlanRule(tenant.plano);
    let vencStr = dateOnly(tenant.vencimento);
    if (!vencStr && tenant.created_at) {
      const cDate = new Date(tenant.created_at);
      if (!Number.isNaN(cDate.getTime())) {
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
        COUNT(*) FILTER (WHERE LOWER(COALESCE(status, 'em_andamento')) NOT IN ('concluida','concluído','concluido','cancelada','cancelado'))::int AS obras_ativas,
        COUNT(*)::int AS obras_total
      FROM obras WHERE tenant_id = ${auth.tenantId};
    `;
    const active = Number(counts[0]?.obras_ativas || 0);
    const total = Number(counts[0]?.obras_total || 0);
    const max = rule.maxActiveObras;

    let invoices = undefined;
    if (String(req.query?.billing || '') === '1' && canManageTenant(auth)) {
      invoices = await sql`
        SELECT id, plan_id, amount_cents, status, txid, paid_at, expires_at, created_at
        FROM billing_invoices
        WHERE tenant_id=${auth.tenantId}
        ORDER BY created_at DESC LIMIT 12;
      `;
    }

    return res.status(200).json({
      success: true,
      plan: {
        id: rule.id,
        label: rule.label,
        status: tenant.status || 'trial',
        monthlyPriceCents: Number(rule.monthlyPriceCents || 0),
        vencimento: vencStr,
        diasRestantes,
        expirado,
        maxActiveObras: max,
        features: rule.features,
        usage: { activeObras: active, totalObras: total, remainingActiveObras: max == null ? null : Math.max(0, max - active) }
      },
      ...(invoices ? { invoices } : {}),
      billingWhatsapp: billingWhatsapp()
    });
  } catch (err) {
    console.error('[Plano API]', err);
    return res.status(500).json({ success: false, error: 'Não foi possível consultar ou gerar a cobrança.' });
  }
}
