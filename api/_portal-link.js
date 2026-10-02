// api/_portal-link.js — Assinatura e verificação dos links do Portal do Cliente
// AUDIT-2026-10-02 X4: o portal público é montado a partir de `pdata` (JSON em base64url na URL).
// Antes, qualquer pessoa podia montar um link em fingo.api.br com construtora, valores e telefone
// à escolha (o "token" era btoa previsível). Agora o link é assinado pelo servidor (HMAC-SHA256),
// os dados da construtora vêm do cadastro e a página só exibe o conteúdo após a verificação.

import crypto from 'crypto';
import { resolveAuthAndTenant } from './_auth.js';
import { canAccessModule, permissionError } from './_permissions.js';
import { createOwnerSql } from './_database.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';

export const PORTAL_LINK_TTL_DAYS = 90;
const MAX_PDATA_CHARS = 200 * 1024;

function portalLinkKey() {
  const dedicated = String(process.env.PORTAL_LINK_SECRET || '').trim();
  if (dedicated.length >= 32) return dedicated;
  const session = String(process.env.SESSION_SIGNING_SECRET || '').trim();
  if (!session) return '';
  // Chave derivada: um link do portal nunca é aceito como token de sessão (e vice-versa).
  return crypto.createHmac('sha256', session).update('fingo-portal-link-v1').digest('base64url');
}

export function encodePortalPayload(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

export function decodePortalPayload(pdata) {
  try {
    const raw = String(pdata || '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function signPortalLink(pdata, exp, key = portalLinkKey()) {
  if (!key) throw new Error('Chave de assinatura do portal não configurada.');
  return crypto.createHmac('sha256', key).update(`v1.${exp}.${pdata}`).digest('base64url');
}

export function verifyPortalLink({ pdata, exp, sig }, key = portalLinkKey(), now = Date.now()) {
  if (!key || !pdata || !sig) return { valid: false, reason: 'missing' };
  if (String(pdata).length > MAX_PDATA_CHARS) return { valid: false, reason: 'too_large' };
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum <= now) return { valid: false, reason: 'expired' };
  const expected = Buffer.from(signPortalLink(String(pdata), expNum, key));
  const given = Buffer.from(String(sig));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return { valid: false, reason: 'bad_signature' };
  return { valid: true };
}

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

/** POST /api/v2/portal/link — gera link assinado (usuário autenticado da empresa). */
export async function handlePortalLinkSign(req, res, deps = {}) {
  if (String(req.method || '').toUpperCase() !== 'POST') return json(res, 405, { success: false, error: 'Método não permitido.' });
  const auth = await (deps.resolveAuth || resolveAuthAndTenant)(req);
  if (!auth.authenticated) return json(res, auth.status || 401, { success: false, error: auth.error || 'Não autorizado.' });
  if (!canAccessModule(auth, 'obras', 'read')) return json(res, 403, permissionError('MODULE_READ_FORBIDDEN', 'obras'));

  const rl = await checkRateLimit(`portal-link:${auth.tenantId}:${auth.user?.id || 'user'}`, 60, 60 * 1000);
  if (!rl.allowed) return json(res, 429, { success: false, error: 'Muitos links gerados em pouco tempo. Aguarde um minuto.' });

  const rawPdata = String(req.body?.pdata || '');
  if (!rawPdata || rawPdata.length > MAX_PDATA_CHARS) return json(res, 400, { success: false, error: 'Dados do portal ausentes ou grandes demais.' });
  const bundle = decodePortalPayload(rawPdata);
  if (!bundle || typeof bundle !== 'object' || !bundle.o) return json(res, 400, { success: false, error: 'Dados do portal inválidos.' });

  // O link sempre pertence à empresa autenticada; os dados da construtora vêm do cadastro.
  bundle.t = auth.tenantId;
  // AUDIT-2026-10-02 Y1: dados pessoais/financeiros não exibidos no portal não entram no link.
  if (bundle.o && typeof bundle.o === 'object') { delete bundle.o.doc; delete bundle.o.v; }
  try {
    const sql = deps.sql || createOwnerSql();
    const rows = await sql`
      SELECT nome_fantasia, razao_social, logo_url, telefone, responsavel
      FROM tenants WHERE id = ${auth.tenantId} LIMIT 1;
    `;
    const t = rows[0] || {};
    bundle.emp = {
      n: t.nome_fantasia || t.razao_social || 'Construtora',
      logo: t.logo_url || '',
      tel: t.telefone || '',
      resp: t.responsavel || ''
    };
  } catch (err) {
    console.error('[Portal Link] Falha ao carregar dados da empresa:', err?.message || err);
    return json(res, 503, { success: false, error: 'Não foi possível gerar o link agora.' });
  }

  const pdata = encodePortalPayload(bundle);
  const exp = Date.now() + PORTAL_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;
  let sig;
  try {
    sig = signPortalLink(pdata, exp);
  } catch (err) {
    console.error('[Portal Link]', err?.message || err);
    return json(res, 500, { success: false, error: 'Configuração de segurança pendente no servidor.' });
  }
  return json(res, 200, { success: true, pdata, exp, sig, tenant: auth.tenantId });
}

/** POST /api/v2/portal/verify — verificação pública do link (sem login). */
export async function handlePortalLinkVerify(req, res) {
  if (String(req.method || '').toUpperCase() !== 'POST') return json(res, 405, { success: false, error: 'Método não permitido.' });
  const rl = await checkRateLimit(`portal-verify:${getClientIp(req)}`, 60, 60 * 1000);
  if (!rl.allowed) return json(res, 429, { success: false, valid: false, error: 'Muitas consultas. Aguarde um minuto.' });
  const result = verifyPortalLink({ pdata: req.body?.pdata, exp: req.body?.exp, sig: req.body?.sig });
  return json(res, result.valid ? 200 : 401, { success: result.valid, valid: result.valid, reason: result.valid ? undefined : result.reason });
}
