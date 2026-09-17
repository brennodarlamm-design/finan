// api/admin.js — wrapper seguro das rotas Master sensíveis.
// A implementação histórica permanece em _admin-route.js; este arquivo intercepta
// apenas fluxos que exigem separação estrita entre segredo de sessão e segredo interno.

import { neon } from '@neondatabase/serverless';
import originalAdminHandler from './_admin-route.js';
import devTenantKeysHandler from './_dev-tenant-keys.js';
import {
  resolveAuthAndTenant,
  signToken,
  verifyToken,
  getSessionSigningSecret,
  getInternalApiSecret
} from './_auth.js';
import { writeAudit } from './_audit.js';

const SESSION_COOKIE = 'finobra_session_token';
const MASTER_RESTORE_COOKIE = 'finobra_master_restore_token';

function getSql() {
  const conn = String(process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL || '').trim();
  if (!conn) throw new Error('DATABASE_OWNER_URL ou DATABASE_URL não configurada no servidor.');
  return neon(conn);
}

function cookieSecure(req) {
  const proto = String(req.headers?.['x-forwarded-proto'] || '').toLowerCase();
  return proto === 'https' || Boolean(process.env.VERCEL);
}

function readCookie(req, name) {
  const raw = String(req.headers?.cookie || '');
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0 || part.slice(0, idx).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(idx + 1).trim()); } catch { return part.slice(idx + 1).trim(); }
  }
  return '';
}

function requestCredential(req) {
  const h = String(req.headers?.authorization || req.headers?.Authorization || '');
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return readCookie(req, SESSION_COOKIE);
}

function cookieLine(req, name, value, maxAgeSeconds) {
  const parts = [
    `${name}=${encodeURIComponent(value || '')}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds || 0))}`
  ];
  if (cookieSecure(req)) parts.push('Secure');
  return parts.join('; ');
}

function setCookies(res, lines) {
  const current = res.getHeader('Set-Cookie');
  const base = Array.isArray(current) ? current : (current ? [current] : []);
  res.setHeader('Set-Cookie', [...base, ...lines]);
}

function cloneRequest(req, { query = null, body = null } = {}) {
  const clone = Object.create(req);
  clone.query = query ? { ...(req.query || {}), ...query } : { ...(req.query || {}) };
  clone.body = body ? { ...(req.body || {}), ...body } : { ...(req.body || {}) };
  return clone;
}

function captureResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: undefined,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end(value) { this.body = value; return this; }
  };
}

async function runOriginal(req, overrides = {}) {
  const cap = captureResponse();
  await originalAdminHandler(cloneRequest(req, overrides), cap);
  return cap;
}

async function requireMaster(req, { humanOnly = true } = {}) {
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return { ok: false, auth, status: auth.status || 401, error: auth.error || 'Acesso não autorizado.' };
  }
  if (auth.isSystem) {
    if (humanOnly) return { ok: false, auth, status: 403, error: 'Operação restrita ao Super Admin humano.' };
    return { ok: true, auth };
  }
  if (auth.user?.perfil !== 'superadmin') {
    return { ok: false, auth, status: 403, error: 'Acesso restrito ao Super Admin.' };
  }
  if (!auth.user?.mfa_enabled || !auth.user?.mfa_verified) {
    return { ok: false, auth, status: 403, error: 'MFA obrigatório para esta operação.' };
  }
  return { ok: true, auth };
}

async function handleImpersonate(req, res) {
  const guard = await requireMaster(req, { humanOnly: true });
  if (!guard.ok) return res.status(guard.status).json({ success: false, error: guard.error });
  const auth = guard.auth;

  if (auth.user?.impersonated === true || auth.user?.impersonatedBy || auth.user?.isImpersonated) {
    return res.status(409).json({ success: false, error: 'Encerre o modo suporte atual antes de acessar outra empresa.' });
  }

  const tenantId = String(req.body?.tenantId || '').trim();
  if (!tenantId) return res.status(400).json({ success: false, error: 'Identificador do tenant não informado.' });

  const sessionSecret = getSessionSigningSecret();
  if (!sessionSecret) return res.status(500).json({ success: false, error: 'Configuração de segurança pendente no servidor.' });

  const sql = getSql();
  const tenantRows = await sql`
    SELECT id, nome_fantasia, razao_social, plano, status, vencimento
    FROM tenants WHERE id = ${tenantId} LIMIT 1;
  `;
  if (!tenantRows.length) return res.status(404).json({ success: false, error: 'Empresa solicitada não encontrada.' });
  const target = tenantRows[0];

  const originalCredential = requestCredential(req);
  const originalPayload = originalCredential ? verifyToken(originalCredential, sessionSecret) : null;
  const liveSessionId = String(auth.user?.sessionId || '');
  const originalSessionId = String(originalPayload?.sessionId || '');
  const originalTenantId = String(auth.user?.realTenantId || auth.user?.tenantId || auth.tenantId || '');
  const originalIsMaster = Boolean(
    originalPayload && originalPayload.userId === auth.user.id &&
    originalPayload.perfil === 'superadmin' && !originalPayload.impersonated
  );
  const sameSession = !liveSessionId || !originalSessionId || liveSessionId === originalSessionId;

  if (!originalCredential || !originalIsMaster || !sameSession || String(originalPayload.tenantId || '') !== originalTenantId) {
    return res.status(401).json({ success: false, error: 'Não foi possível preservar a sessão Master para retorno seguro.' });
  }

  const maxSupportExp = Date.now() + (4 * 60 * 60 * 1000);
  const originalExp = Number(originalPayload.exp || 0);
  const impExp = Math.min(originalExp || maxSupportExp, maxSupportExp);
  if (!Number.isFinite(impExp) || impExp <= Date.now() + 60_000) {
    return res.status(401).json({ success: false, error: 'Sua sessão Master está próxima de expirar. Entre novamente antes de iniciar o modo suporte.' });
  }

  const impersonatedToken = signToken({
    userId: auth.user.id,
    username: auth.user.username,
    nome: auth.user.nome,
    email: auth.user.email,
    perfil: 'superadmin',
    tenantId: target.id,
    empresaNome: target.nome_fantasia || target.razao_social,
    impersonated: true,
    impersonatedBy: 'superadmin',
    originalTenantId,
    sessionId: liveSessionId,
    mfa_verified: true,
    exp: impExp
  }, sessionSecret);

  const supportSeconds = Math.max(60, Math.floor((impExp - Date.now()) / 1000));
  const restoreSeconds = Math.max(60, Math.floor((originalExp - Date.now()) / 1000));
  setCookies(res, [
    cookieLine(req, MASTER_RESTORE_COOKIE, originalCredential, restoreSeconds),
    cookieLine(req, SESSION_COOKIE, impersonatedToken, supportSeconds)
  ]);

  await writeAudit(sql, req, auth, {
    acao: 'impersonate', entidade: 'tenant', entidadeId: target.id,
    depois: { tenantId: target.id, empresa: target.nome_fantasia || target.razao_social }
  });

  return res.status(200).json({
    success: true,
    cookieAuth: true,
    session: {
      userId: auth.user.id,
      username: auth.user.username,
      nome: auth.user.nome,
      perfil: 'superadmin',
      avatar: (target.nome_fantasia || 'SU').slice(0, 2).toUpperCase(),
      tenantId: target.id,
      empresaNome: target.nome_fantasia || target.razao_social,
      impersonated: true,
      impersonatedBy: 'superadmin',
      loginAt: new Date().toISOString()
    }
  });
}

async function handleRestoreMaster(req, res) {
  const guard = await requireMaster(req, { humanOnly: true });
  if (!guard.ok) return res.status(guard.status).json({ success: false, error: guard.error });
  const auth = guard.auth;
  const sessionSecret = getSessionSigningSecret();
  if (!sessionSecret) return res.status(500).json({ success: false, error: 'Configuração de segurança pendente no servidor.' });

  let restoreToken = readCookie(req, MASTER_RESTORE_COOKIE);
  let payload = restoreToken ? verifyToken(restoreToken, sessionSecret) : null;
  let recoveredFromImpersonatedSession = false;

  const currentSessionId = String(auth.user?.sessionId || '');
  const restoreSessionId = String(payload?.sessionId || '');
  const realTenantId = String(auth.user?.realTenantId || auth.user?.originalTenantId || '').trim();
  const restoreCookieValid = Boolean(
    payload && payload.userId === auth.user.id && payload.perfil === 'superadmin' &&
    !payload.impersonated && String(payload.tenantId || '') === realTenantId &&
    (!currentSessionId || !restoreSessionId || currentSessionId === restoreSessionId)
  );

  if (!restoreCookieValid) {
    const isImpersonatedMaster = Boolean(
      auth.user?.perfil === 'superadmin' && auth.user?.impersonated === true &&
      auth.user?.impersonatedBy === 'superadmin' && auth.user?.isImpersonated
    );
    if (!isImpersonatedMaster || !realTenantId) {
      return res.status(401).json({ success: false, error: 'Não foi possível restaurar automaticamente a sessão Master. Entre novamente no painel Master.' });
    }
    const fallbackExp = Math.min(Number(auth.user?.exp || (Date.now() + 4 * 60 * 60 * 1000)), Date.now() + 4 * 60 * 60 * 1000);
    restoreToken = signToken({
      userId: auth.user.id,
      username: auth.user.username,
      nome: auth.user.nome,
      email: auth.user.email,
      perfil: 'superadmin',
      tenantId: realTenantId,
      sessionId: auth.user.sessionId || '',
      mfa_verified: true,
      exp: fallbackExp
    }, sessionSecret);
    payload = verifyToken(restoreToken, sessionSecret);
    recoveredFromImpersonatedSession = true;
  }

  const sql = getSql();
  const rows = await sql`SELECT perfil, ativo, tenant_id FROM usuarios WHERE id=${payload.userId} LIMIT 1;`;
  if (!rows.length || !rows[0].ativo || rows[0].perfil !== 'superadmin' || String(rows[0].tenant_id || '') !== String(payload.tenantId || '')) {
    return res.status(403).json({ success: false, error: 'A conta Master não está autorizada.' });
  }

  const remaining = Math.max(60, Math.floor((Number(payload.exp || Date.now()) - Date.now()) / 1000));
  setCookies(res, [
    cookieLine(req, SESSION_COOKIE, restoreToken, remaining),
    cookieLine(req, MASTER_RESTORE_COOKIE, '', 0)
  ]);
  await writeAudit(sql, req, { ...auth, tenantId: auth.tenantId }, {
    acao: 'suporte_encerrado', entidade: 'suporte_master', entidadeId: String(req.body?.tenantId || auth.tenantId || ''),
    depois: { restored: true, recoveredFromImpersonatedSession, superadmin: auth.user?.username || auth.user?.email || 'superadmin' }
  });
  return res.status(200).json({ success: true, restored: true, recoveredFromImpersonatedSession });
}

async function handleTenantKeyAction(req, res, action) {
  const mapped = action === 'generate_tenant_access_key' || action === 'rotate_tenant_access_key' ? 'rotate' : action;
  const vaultReq = cloneRequest(req, {
    query: { action: mapped },
    body: { action: mapped }
  });
  return devTenantKeysHandler(vaultReq, res);
}

async function handleBillingNotice(req, res) {
  const channel = String(req.body?.channel || 'both').trim().toLowerCase();
  if (channel === 'preview' || channel === 'email') return originalAdminHandler(req, res);
  if (!['whatsapp', 'both'].includes(channel)) return originalAdminHandler(req, res);

  const guard = await requireMaster(req, { humanOnly: true });
  if (!guard.ok) return res.status(guard.status).json({ success: false, error: guard.error });

  const internalSecret = getInternalApiSecret();
  if (!internalSecret) return res.status(500).json({ success: false, error: 'Configuração de segurança interna pendente no servidor.' });

  const previewCap = await runOriginal(req, { body: { channel: 'preview' } });
  const preview = previewCap.body || {};
  if (previewCap.statusCode >= 400 || !preview.success) {
    return res.status(previewCap.statusCode || 400).json(preview);
  }

  const tenantId = String(preview.tenant?.id || req.body?.tenantId || '').trim();
  const destPhone = String(preview.destPhone || '').replace(/\D/g, '');
  if (!tenantId) return res.status(400).json({ success: false, error: 'Empresa não informada.' });

  const results = {
    whatsapp: { attempted: true, success: false },
    email: { attempted: false, success: false },
    waLink: destPhone ? `https://wa.me/${destPhone}?text=${encodeURIComponent(preview.message || '')}` : null
  };

  if (!destPhone || destPhone.length < 10) {
    results.whatsapp.error = 'Telefone do cliente inválido ou não cadastrado.';
  } else {
    try {
      const renderBaseUrl = String(process.env.RENDER_WHATSAPP_URL || 'https://finan-backend-9rxw.onrender.com')
        .replace(/\/send-message\/?$/, '').replace(/\/+$/, '');
      const wpRes = await fetch(`${renderBaseUrl}/send-message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${internalSecret}`,
          'x-api-key': internalSecret,
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({ tenantId, phone: destPhone, number: destPhone, message: preview.message, text: preview.message }),
        signal: AbortSignal.timeout(15000)
      });
      const wpData = await wpRes.json().catch(() => ({}));
      if (wpRes.ok && (wpData.success || wpData.messageId)) {
        results.whatsapp.success = true;
        results.whatsapp.messageId = wpData.messageId || null;
      } else {
        results.whatsapp.error = wpData.error || `Servidor WhatsApp retornou status ${wpRes.status}`;
      }
    } catch (err) {
      results.whatsapp.error = 'Não foi possível conectar ao robô de WhatsApp.';
      console.warn('[Admin Billing] Falha no WhatsApp:', err?.message || err);
    }
  }

  if (channel === 'both') {
    const emailCap = await runOriginal(req, { body: { channel: 'email' } });
    const emailBody = emailCap.body || {};
    results.email = emailBody?.results?.email || {
      attempted: true,
      success: false,
      error: emailBody.error || 'Falha ao processar envio de e-mail.'
    };
  }

  const sql = getSql();
  await writeAudit(sql, req, { ...guard.auth, tenantId }, {
    acao: 'cobranca_whatsapp_enviada', entidade: 'tenant', entidadeId: tenantId,
    depois: { canal: channel, whatsapp: results.whatsapp, email: results.email }
  });

  return res.status(200).json({
    success: true,
    tenantId,
    nomeEmpresa: preview.tenant?.nome || '',
    channel,
    results,
    message: 'Processamento de cobrança concluído.'
  });
}

async function handleBillingSweep(req, res) {
  const guard = await requireMaster(req, { humanOnly: false });
  if (!guard.ok) return res.status(guard.status).json({ success: false, error: guard.error });

  const internalSecret = getInternalApiSecret();
  if (!internalSecret) return res.status(500).json({ success: false, error: 'Configuração de segurança interna pendente no servidor.' });

  const forcedTenantId = req.body?.tenantId ? String(req.body.tenantId).trim() : null;
  const renderBaseUrl = String(process.env.RENDER_WHATSAPP_URL || 'https://finan-backend-9rxw.onrender.com')
    .replace(/\/send-message\/?$/, '').replace(/\/+$/, '');

  let sweepResult = null;
  let usedEngine = 'render';
  try {
    const renderRes = await fetch(`${renderBaseUrl}/cron/billing-sweep`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${internalSecret}`,
        'x-api-key': internalSecret,
        'Content-Type': 'application/json',
        ...(forcedTenantId ? { 'x-tenant-id': forcedTenantId } : { 'x-tenant-id': guard.auth.tenantId || 'system' })
      },
      body: JSON.stringify({ tenantId: forcedTenantId }),
      signal: AbortSignal.timeout(12000)
    });
    if (renderRes.ok) sweepResult = await renderRes.json().catch(() => null);
  } catch (err) {
    console.warn('[Admin Billing] Render indisponível para sweep:', err?.message || err);
  }

  const sql = getSql();
  if (!sweepResult?.success) {
    usedEngine = 'neon_fallback';
    const hoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Boa_Vista', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    const tenants = forcedTenantId
      ? await sql`SELECT id, razao_social, nome_fantasia, telefone, email, responsavel, plano, status, vencimento FROM tenants WHERE id=${forcedTenantId};`
      : await sql`SELECT id, razao_social, nome_fantasia, telefone, email, responsavel, plano, status, vencimento FROM tenants WHERE status NOT IN ('cancelado','arquivado') AND vencimento IS NOT NULL;`;

    let evaluated = 0;
    let notified = 0;
    let skipped = 0;
    for (const t of tenants) {
      evaluated++;
      const parts = String(t.vencimento || '').slice(0, 10).split('-');
      if (parts.length !== 3) continue;
      const vencDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`);
      const todayDate = new Date(`${hoje}T00:00:00`);
      const diff = Math.round((vencDate.getTime() - todayDate.getTime()) / 86400000);

      let stage = null;
      if (t.plano === 'trial' && diff <= 2 && diff >= 0) stage = 'trial_ending';
      else if (diff === 10) stage = 'reminder_10d';
      else if (diff === 3) stage = 'reminder_3d';
      else if (diff === 0) stage = 'due_today';
      else if (diff === -1) stage = 'overdue_1d';
      else if (diff === -5) stage = 'overdue_5d';
      if (!stage) continue;

      const check = await sql`
        SELECT id FROM billing_notifications_sent
        WHERE tenant_id=${t.id} AND stage=${stage} AND sent_date=${hoje}::date LIMIT 1;
      `;
      if (check.length) { skipped++; continue; }

      const inserted = await sql`
        INSERT INTO billing_notifications_sent (
          tenant_id, stage, channel, sent_date, recipient_phone, recipient_email, status, metadata
        ) VALUES (
          ${t.id}, ${stage}, 'email', ${hoje}::date, ${t.telefone || null}, ${t.email || null}, 'pending_dispatch',
          ${JSON.stringify({ diff, plano: t.plano, vencimento: t.vencimento, via: 'master_secure_fallback' })}::jsonb
        ) ON CONFLICT (tenant_id, stage, sent_date) DO NOTHING RETURNING id;
      `;
      if (inserted.length) notified++;
      else skipped++;
    }
    sweepResult = { success: true, totalEvaluated: evaluated, notified, skippedAntiSpam: skipped };
  }

  await writeAudit(sql, req, guard.auth, {
    acao: 'varredura_cobranca_executada', entidade: 'cobranca_cron',
    depois: { engine: usedEngine, result: sweepResult }
  });

  return res.status(200).json({
    success: true,
    engine: usedEngine,
    result: sweepResult,
    message: 'Varredura de cobrança executada com sucesso.'
  });
}

export default async function handler(req, res) {
  const action = String(req.query?.action || req.body?.action || 'tenants').trim().toLowerCase();

  try {
    if (req.method === 'POST' && action === 'impersonate') return handleImpersonate(req, res);
    if (req.method === 'POST' && action === 'restore_master_session') return handleRestoreMaster(req, res);
    if (req.method === 'POST' && (action === 'generate_tenant_access_key' || action === 'rotate_tenant_access_key')) {
      return handleTenantKeyAction(req, res, action);
    }
    if (req.method === 'POST' && action === 'send_billing_notice') return handleBillingNotice(req, res);
    if (req.method === 'POST' && action === 'trigger_billing_sweep') return handleBillingSweep(req, res);

    return originalAdminHandler(req, res);
  } catch (err) {
    console.error('[Admin Secure Wrapper] Falha:', err);
    return res.status(500).json({ success: false, error: 'Erro interno no servidor Master.' });
  }
}
