// api/plano.js — Plano, uso real e cobrança PIX auditável do tenant
import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { getPlanRule, normalizePlan, getPlanCyclePrice, PLAN_BILLING_CYCLES, PLAN_CYCLE_PRICING } from './_plans.js';
import { canManageTenant, canAccessModule, permissionError } from './_permissions.js';
import { writeAudit } from './_audit.js';
import { setEdgeCacheHeaders } from './_http.js';
import webhookPixHandler from './_webhook_pix.js';
import { createTenantSql } from './_tenant-sql.js';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

function setCors(req, res) {
  const allowed = ['https://fingo.api.br','https://www.fingo.api.br','http://localhost:3000','http://localhost:3333','http://localhost:5000','http://127.0.0.1:3000','http://127.0.0.1:3333','http://127.0.0.1:5000'];
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
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
  const merchantName = onlyAscii(process.env.FINOBRA_PIX_MERCHANT_NAME || process.env.FINGO_PIX_MERCHANT_NAME || 'FINGO SISTEMA', 25) || 'FINGO';
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

  // ── DESPACHO PARA WEBHOOK PIX E BAIXA AUTOMÁTICA SAAS ──────────────────
  const isWebhookPix = req.query?.sub === 'webhook_pix' ||
    req.query?.scope === 'webhook_pix' ||
    req.query?.action === 'webhook_pix' ||
    String(req.url || '').includes('webhook-pix');

  if (isWebhookPix) {
    return webhookPixHandler(req, res);
  }

  // ── CATÁLOGO PÚBLICO DE PREÇOS COM EDGE CACHING ──────────────────────────
  if (req.method === 'GET' && req.query?.action === 'pricing') {
    setEdgeCacheHeaders(res, { sMaxAge: 3600, staleWhileRevalidate: 86400, isPublic: true });
    return res.status(200).json({
      success: true,
      billingCycles: PLAN_BILLING_CYCLES,
      pricing: PLAN_CYCLE_PRICING
    });
  }

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Não autorizado.' });
  if (!canAccessModule(auth,'planos',req.method === 'POST' ? 'write' : 'read')) return res.status(403).json(permissionError(req.method === 'POST' ? 'MODULE_WRITE_FORBIDDEN' : 'MODULE_READ_FORBIDDEN','planos'));

  try {
    // sql com contexto RLS: set_config(app.current_tenant_id) em cada transação.
    const sql = createTenantSql(getSql(), { tenantId: auth.tenantId });

    // ── CONSULTA DE STATUS EM TEMPO REAL PARA MODAL PIX ──────────────────────
    if (req.method === 'GET' && req.query?.action === 'check_invoice') {
      const invoiceId = String(req.query?.invoiceId || req.query?.invoice_id || '').trim();
      if (!invoiceId) return res.status(400).json({ success: false, error: 'invoiceId é obrigatório.' });

      const rows = await sql`
        SELECT id, tenant_id, plan_id, cycle, amount_cents, txid, status, paid_at
        FROM billing_invoices
        WHERE id = ${invoiceId} AND tenant_id = ${auth.tenantId}
        LIMIT 1;
      `;
      if (!rows.length) return res.status(404).json({ success: false, error: 'Fatura não encontrada.' });
      const inv = rows[0];
      return res.status(200).json({
        success: true,
        status: inv.status,
        paid: inv.status === 'paid',
        paidAt: inv.paid_at || null,
        invoiceId: inv.id,
        txid: inv.txid || null,
        planId: inv.plan_id
      });
    }

    if (req.method === 'POST') {
      const action = String(req.query?.action || req.body?.action || '').trim();
      if (!canManageTenant(auth)) return res.status(403).json(permissionError('ROLE_MANAGE_TENANT_FORBIDDEN'));

      if (action === 'cancel_subscription') {
        const tenantRows = await sql`
          SELECT id, plano, status, vencimento, created_at
          FROM tenants
          WHERE id = ${auth.tenantId}
          LIMIT 1;
        `;
        if (!tenantRows.length) return res.status(404).json({ success:false, error:'Empresa não encontrada.' });
        const tenant = tenantRows[0];
        if (tenant.status === 'cancelado' || tenant.status === 'cancelamento_agendado') {
          return res.status(200).json({
            success:true,
            alreadyCanceled:true,
            status:tenant.status,
            accessUntil:dateOnly(tenant.vencimento) || null
          });
        }

        await sql`
          UPDATE billing_invoices
          SET status='canceled', canceled_at=NOW(), updated_at=NOW()
          WHERE tenant_id=${auth.tenantId} AND status='pending';
        `;
        const canceledTenantRows = await sql`
          UPDATE tenants
          SET status='cancelamento_agendado',
              vencimento=COALESCE(
                vencimento,
                CASE
                  WHEN status='trial' OR plano='trial' THEN (COALESCE(created_at, NOW())::date + 15)
                  ELSE CURRENT_DATE
                END
              ),
              updated_at=NOW()
          WHERE id=${auth.tenantId}
          RETURNING status, vencimento;
        `;
        const accessUntil = dateOnly(canceledTenantRows[0]?.vencimento || tenant.vencimento) || null;
        await writeAudit(sql, req, auth, {
          acao:'cancelar_assinatura',
          entidade:'plano',
          entidadeId:auth.tenantId,
          antes:{ status:tenant.status, plano:tenant.plano, vencimento:tenant.vencimento || null },
          depois:{ status:'cancelamento_agendado', acesso_ate:accessUntil }
        });
        return res.status(200).json({
          success:true,
          status:'cancelamento_agendado',
          accessUntil,
          message:'Cancelamento agendado. O acesso continua disponível até o fim do período atual; cobranças pendentes foram canceladas.'
        });
      }

      if (action !== 'create_invoice') return res.status(400).json({ success:false, error:'Ação de cobrança inválida.' });

      const planId = normalizePlan(req.body?.plan_id);
      if (planId === 'trial') return res.status(400).json({ success:false, error:'O plano Trial não gera cobrança.' });
      const rule = getPlanRule(planId);
      const requestedCycle = String(req.body?.cycle || 'monthly').trim().toLowerCase();
      const cycleInfo = getPlanCyclePrice(planId, requestedCycle);
      const cycle = cycleInfo ? cycleInfo.cycle : 'monthly';
      const amountCents = cycleInfo ? Number(cycleInfo.totalCents) : Number(rule.monthlyPriceCents || 0);
      if (!amountCents) return res.status(400).json({ success:false, error:'Plano sem valor configurado.' });

      await sql`UPDATE billing_invoices SET status='expired', updated_at=NOW() WHERE tenant_id=${auth.tenantId} AND status='pending' AND expires_at IS NOT NULL AND expires_at < NOW();`;
      const existing = await sql`
        SELECT id, tenant_id, plan_id, COALESCE(cycle, 'monthly') AS cycle, amount_cents, status, txid, pix_payload, expires_at, created_at
        FROM billing_invoices
        WHERE tenant_id=${auth.tenantId} AND plan_id=${planId} AND COALESCE(cycle, 'monthly')=${cycle} AND status='pending'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC LIMIT 1;
      `;
      if (existing.length) {
        return res.status(200).json({ success:true, invoice:existing[0], cycleInfo, billingWhatsapp:billingWhatsapp(), reused:true });
      }

      const id = 'inv_' + crypto.randomBytes(10).toString('hex');
      const txid = ('FIN' + crypto.randomBytes(10).toString('hex')).toUpperCase().slice(0, 25);
      const pixKey = String(process.env.FINOBRA_PIX_KEY || '+5595991363678').trim();
      const pixPayload = buildPixPayload({ key: pixKey, amountCents, txid });
      const rows = await sql`
        INSERT INTO billing_invoices (id, tenant_id, plan_id, cycle, amount_cents, status, txid, pix_payload, created_by, expires_at)
        VALUES (${id}, ${auth.tenantId}, ${planId}, ${cycle}, ${amountCents}, 'pending', ${txid}, ${pixPayload || null}, ${auth.user?.userId || auth.user?.id || null}, NOW() + INTERVAL '1 day')
        RETURNING id, tenant_id, plan_id, cycle, amount_cents, status, txid, pix_payload, expires_at, created_at;
      `;
      await writeAudit(sql, req, auth, { acao:'criar', entidade:'cobranca', entidadeId:id, depois:{ plan_id:planId, cycle, amount_cents:amountCents, txid } });
      return res.status(201).json({ success:true, invoice:rows[0], cycleInfo, billingWhatsapp:billingWhatsapp(), reused:false });
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
    const userCounts = await sql`
      SELECT COUNT(*) FILTER (WHERE ativo=TRUE)::int AS usuarios_ativos, COUNT(*)::int AS usuarios_total
      FROM usuarios WHERE tenant_id=${auth.tenantId};
    `;
    const activeUsers = Number(userCounts[0]?.usuarios_ativos || 0);
    const totalUsers = Number(userCounts[0]?.usuarios_total || 0);

    let invoices = undefined;
    if (String(req.query?.billing || '') === '1' && canManageTenant(auth)) {
      invoices = await sql`
        SELECT id, plan_id, amount_cents, status, txid, paid_at, expires_at, created_at,
               TO_CHAR(created_at AT TIME ZONE 'America/Boa_Vista', 'MM/YYYY') AS competencia
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
        maxUsers: rule.maxUsers,
        idealFor: rule.idealFor,
        supportLevel: rule.supportLevel,
        modules: rule.modules,
        features: rule.features,
        billingCycles: PLAN_BILLING_CYCLES,
        pricingByCycle: PLAN_CYCLE_PRICING[rule.id] || null,
        usage: {
          activeObras: active,
          totalObras: total,
          remainingActiveObras: max == null ? null : Math.max(0, max - active),
          activeUsers,
          totalUsers,
          remainingUsers: rule.maxUsers == null ? null : Math.max(0, rule.maxUsers - activeUsers)
        }
      },
      billingCycles: PLAN_BILLING_CYCLES,
      allPlansPricing: PLAN_CYCLE_PRICING,
      ...(invoices ? { invoices } : {}),
      billingWhatsapp: billingWhatsapp()
    });
  } catch (err) {
    console.error('[Plano API]', err);
    return res.status(500).json({ success: false, error: 'Não foi possível consultar ou gerar a cobrança.' });
  }
}
