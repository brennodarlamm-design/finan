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

// ── Link v2 (VARREDURA 2026-10-03 #15) ──────────────────────────────────────
// O link v1 levava a obra inteira na URL (14 a 23 mil caracteres: acima do limite de
// várias bordas) e congelava os dados no momento em que era gerado. O v2 leva só
// empresa + obra + validade + assinatura; o portal busca os dados atuais no servidor.

export function signPortalRef(tenantId, obraId, exp, key = portalLinkKey()) {
  if (!key) throw new Error('Chave de assinatura do portal não configurada.');
  return crypto.createHmac('sha256', key).update(`v2.${tenantId}.${obraId}.${exp}`).digest('base64url');
}

export function verifyPortalRef({ tenant, obra, exp, sig }, key = portalLinkKey(), now = Date.now()) {
  if (!key || !tenant || !obra || !sig) return { valid: false, reason: 'missing' };
  if (String(tenant).length > 80 || String(obra).length > 180) return { valid: false, reason: 'invalid' };
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum <= now) return { valid: false, reason: 'expired' };
  const expected = Buffer.from(signPortalRef(String(tenant), String(obra), expNum, key));
  const given = Buffer.from(String(sig));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return { valid: false, reason: 'bad_signature' };
  return { valid: true };
}

const parseJson = (v) => {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(v || '{}'); } catch { return {}; }
};
const isoDate = (v) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : '');

/** Monta, a partir do banco, o mesmo pacote que o portal já sabe exibir. */
export async function buildPortalBundle(sql, tenantId, obraId) {
  const [obras, tenants, medicoes, despesas, documentos, contratos] = await Promise.all([
    sql`SELECT id, nome, cliente, endereco, status, data_inicio, data_previsao, cronograma_config FROM obras WHERE tenant_id = ${tenantId} AND id = ${obraId} LIMIT 1;`,
    sql`SELECT nome_fantasia, razao_social, logo_url, telefone, responsavel FROM tenants WHERE id = ${tenantId} LIMIT 1;`,
    sql`SELECT id, numero, etapa_descricao, percentual_fisico, valor_liberado, valor_solicitado, data FROM medicoes WHERE tenant_id = ${tenantId} AND obra_id = ${obraId} ORDER BY data ASC NULLS LAST, numero ASC;`,
    sql`SELECT id, descricao, categoria, valor, data FROM lancamentos WHERE tenant_id = ${tenantId} AND obra_id = ${obraId} AND tipo = 'despesa' ORDER BY data DESC NULLS LAST LIMIT 50;`,
    sql`SELECT id, titulo, nome_arquivo, tipo_arquivo, url, created_at FROM documentos WHERE tenant_id = ${tenantId} AND referencia_id = ${obraId} AND tipo IN ('obra', 'orcamento') ORDER BY created_at DESC LIMIT 30;`,
    sql`SELECT id, status, payload FROM contratos WHERE tenant_id = ${tenantId} AND obra_id = ${obraId};`
  ]);
  const o = obras[0];
  if (!o) return null;
  const t = tenants[0] || {};
  const cron = parseJson(o.cronograma_config);
  return {
    t: tenantId,
    oid: o.id,
    atualizadoEm: new Date().toISOString(),
    emp: { n: t.nome_fantasia || t.razao_social || 'Construtora', logo: t.logo_url || '', tel: t.telefone || '', resp: t.responsavel || '' },
    o: {
      id: o.id,
      n: o.nome || 'Obra',
      c: o.cliente || o.nome || 'Proprietário',
      e: o.endereco || '',
      di: isoDate(o.data_inicio),
      df: isoDate(o.data_previsao),
      st: o.status || 'em_andamento',
      // Processos salvos da obra; o portal recalcula as datas em cascata.
      sla_raw: Array.isArray(cron.processos_sla) ? cron.processos_sla : []
    },
    med: medicoes.map(m => ({ id: m.id, num: m.numero || 1, desc: m.etapa_descricao || 'Vistoria e Execução', pct: Number(m.percentual_fisico) || 0, val: Number(m.valor_liberado || m.valor_solicitado) || 0, dt: isoDate(m.data) })),
    nfe: despesas.map(l => ({ id: l.id, desc: l.descricao || 'Despesa de Obra', cat: l.categoria || 'Geral', nf: '', val: Number(l.valor) || 0, dt: isoDate(l.data) })),
    // Só links externos https: arquivos do armazenamento privado não abrem sem login.
    doc: documentos.map(d => ({ id: d.id, tit: d.titulo || d.nome_arquivo || 'Documento', tipo: d.tipo_arquivo || 'Arquivo', url: /^https:\/\//i.test(String(d.url || '')) && !/blob\.vercel-storage\.com/i.test(String(d.url)) ? d.url : '', dt: isoDate(d.created_at) })),
    ctr: contratos.map(c => {
      const pl = parseJson(c.payload);
      return { id: c.id, tit: pl.titulo || 'Contrato de Obra', st: c.status || pl.status || 'ativo', ass: !!pl.assinado_por_cliente, dtAss: pl.data_assinatura_cliente || null, signatario: pl.assinatura_cliente_nome || null };
    })
  };
}

/** POST /api/v2/portal/data — dados atuais da obra para um link v2 válido (público, sem login). */
export async function handlePortalData(req, res, deps = {}) {
  if (String(req.method || '').toUpperCase() !== 'POST') return json(res, 405, { success: false, error: 'Método não permitido.' });
  const rl = await checkRateLimit(`portal-data:${getClientIp(req)}`, 60, 60 * 1000);
  if (!rl.allowed) return json(res, 429, { success: false, error: 'Muitas consultas. Aguarde um minuto.' });
  const ref = { tenant: req.body?.tenant, obra: req.body?.obra, exp: req.body?.exp, sig: req.body?.sig };
  const check = verifyPortalRef(ref, deps.key);
  if (!check.valid) return json(res, 401, { success: false, valid: false, reason: check.reason });
  try {
    const bundle = await buildPortalBundle(deps.sql || createOwnerSql(), String(ref.tenant), String(ref.obra));
    if (!bundle) return json(res, 404, { success: false, valid: false, reason: 'not_found' });
    return json(res, 200, { success: true, valid: true, bundle });
  } catch (err) {
    console.error('[Portal Data]', err?.message || err);
    return json(res, 503, { success: false, error: 'Não foi possível carregar a obra agora.' });
  }
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

  // v2: só a referência da obra (o portal busca os dados atuais no servidor).
  const obraIdV2 = String(req.body?.obraId || '').trim();
  if (obraIdV2) {
    if (obraIdV2.length > 180) return json(res, 400, { success: false, error: 'Obra inválida.' });
    try {
      const sql = deps.sql || createOwnerSql();
      const found = await sql`SELECT 1 FROM obras WHERE tenant_id = ${auth.tenantId} AND id = ${obraIdV2} LIMIT 1;`;
      if (!found.length) return json(res, 404, { success: false, error: 'Obra não encontrada na nuvem. Sincronize e tente de novo.' });
      const exp = Date.now() + PORTAL_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;
      const sig = signPortalRef(auth.tenantId, obraIdV2, exp);
      return json(res, 200, { success: true, v: 2, tenant: auth.tenantId, obra: obraIdV2, exp, sig });
    } catch (err) {
      console.error('[Portal Link v2]', err?.message || err);
      return json(res, 503, { success: false, error: 'Não foi possível gerar o link agora.' });
    }
  }

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
