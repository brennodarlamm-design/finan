// api/assinaturas.js — Registro autenticado e validação pública de assinaturas eletrônicas
import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';
import { canUseFeature, planError } from './_plans.js';
import { canWriteData, canAccessModule, permissionError } from './_permissions.js';
import { writeAudit } from './_audit.js';
import { createTenantSql } from './_tenant-sql.js';
import { createRuntimeSql } from './_database.js';

function getSql() {
  return createRuntimeSql();
}

function cors(req, res) {
  const allowed = [
    'https://fingo.api.br', 'https://www.fingo.api.br',
    'http://localhost:3000', 'http://localhost:3333', 'http://localhost:5000',
    'http://127.0.0.1:3000', 'http://127.0.0.1:3333', 'http://127.0.0.1:5000'
  ];
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
}

const clean = (v, max = 255) => String(v ?? '').trim().slice(0, max);

function maskDocument(value) {
  const raw = clean(value, 64);
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) return `***.${digits.slice(3,6)}.${digits.slice(6,9)}-**`;
  if (digits.length === 14) return `${digits.slice(0,2)}.***.***/****-${digits.slice(-2)}`;
  if (raw.length <= 4) return raw ? '***' : '';
  return `${raw.slice(0,2)}***${raw.slice(-2)}`;
}

function maskIp(value) {
  const raw = clean(value, 64);
  if (!raw) return '';
  // AUDIT-2026-10-02 U2: o assinador grava o tipo de aparelho ("Computador / Desktop"), não o IP.
  // Só mascara o que parece endereço IP; antes o rótulo do aparelho virava "***".
  const looksLikeIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(raw) || (raw.includes(':') && /^[0-9a-f:]+$/i.test(raw));
  if (!looksLikeIp) return raw;
  if (raw.includes('.')) {
    const parts = raw.split('.');
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : '***';
  }
  if (raw.includes(':')) return raw.split(':').slice(0, 2).join(':') + ':****';
  return '***';
}

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Verificação de PDFs assinados (ICP-Brasil / Gov.br) — rotas autenticadas.
  const action = String(req.query?.action || req.body?.action || '').trim().toLowerCase();
  if (action === 'verificar_pdf' || action === 'verificacoes') {
    return handlePdfVerification(req, res, action);
  }

  // publicSql: acesso global sem contexto de tenant (GET de validação pública por código único).
  const publicSql = getSql();

  try {
    // Consulta pública: valida somente registros realmente existentes no Neon.
    if (req.method === 'GET') {
      const ip = getClientIp(req);
      const rl = await checkRateLimit(`assinatura:public:${ip}`, 30, 60_000);
      if (!rl.allowed) return res.status(429).json({ success: false, error: 'Muitas consultas. Tente novamente em instantes.' });

      const code = clean(req.query?.code || req.query?.val, 80).toUpperCase();
      if (!/^[A-Z0-9-]{8,80}$/.test(code)) {
        return res.status(400).json({ success: false, valid: false, error: 'Código de validação inválido.' });
      }

      // AUDITORIA 2026-10-04 #12: leitura pela função da migração 040 (só o registro deste código),
      // sem depender da política RLS pública que expunha as assinaturas de todas as empresas.
      // Até a migração 040 ser aplicada, cai na consulta antiga.
      let rows;
      try {
        rows = await publicSql`SELECT * FROM validar_assinatura_publica(${code});`;
      } catch (fnErr) {
        if (!/validar_assinatura_publica/.test(String(fnErr?.message || ''))) throw fnErr;
        rows = await publicSql`
          SELECT
            s.codigo_validacao, s.hash_sha256, s.nome, s.doc, s.papel,
            s.doc_tipo, s.doc_id, s.doc_numero, s.data_hora, s.data_hora_fmt,
            s.ip_dispositivo, s.created_at,
            t.nome_fantasia, t.razao_social, t.cnpj, t.cidade, t.uf
          FROM document_signatures s
          JOIN tenants t ON t.id = s.tenant_id
          WHERE UPPER(s.codigo_validacao) = ${code}
          LIMIT 1;
        `;
      }

      if (!rows.length) {
        return res.status(404).json({ success: true, valid: false, error: 'Código não localizado na base central.' });
      }

      const r = rows[0];
      const requestedHash = clean(req.query?.hash, 128).toLowerCase();
      const storedHash = clean(r.hash_sha256, 128).toLowerCase();
      if (requestedHash && !storedHash.startsWith(requestedHash)) {
        return res.status(409).json({ success: true, valid: false, error: 'O hash informado não corresponde ao registro central.' });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        record: {
          codigo_validacao: r.codigo_validacao,
          hash_sha256: r.hash_sha256,
          nome: r.nome,
          doc: maskDocument(r.doc),
          papel: r.papel,
          doc_tipo: r.doc_tipo,
          doc_id: r.doc_id,
          doc_numero: r.doc_numero,
          data_hora: r.data_hora,
          data_hora_fmt: r.data_hora_fmt,
          // AUDIT-2026-10-02 F10: IP do signatário é dado pessoal (LGPD); a validação pública mostra só um trecho.
          ip_dispositivo: maskIp(r.ip_dispositivo),
          // AUDIT-2026-10-02 U3: horário gravado pelo servidor (data_hora vem do navegador).
          registrado_em: r.created_at,
          empresa: r.nome_fantasia || r.razao_social || 'Empresa usuária do FinGo',
          empresa_cnpj: maskDocument(r.cnpj),
          empresa_cidade: r.cidade || '',
          empresa_uf: r.uf || ''
        }
      });
    }

    // Registro: somente usuário autenticado do tenant pode registrar assinatura.
    if (req.method === 'POST') {
      const auth = await resolveAuthAndTenant(req);
      if (!auth.authenticated) return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Não autorizado.' });
      if (!canWriteData(auth)) return res.status(403).json(permissionError('ROLE_READ_ONLY'));
      if (!canAccessModule(auth,'assinatura','write')) return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN','assinatura'));
      if (!auth.isSystem && auth.user?.perfil !== 'superadmin' && !canUseFeature(auth.user?.tenantPlan, 'signatures')) {
        return res.status(403).json(planError('signatures', auth.user?.tenantPlan));
      }

      // tenantSql: contexto RLS ativo via set_config(app.current_tenant_id) por transação.
      const tenantSql = createTenantSql(getSql(), { tenantId: auth.tenantId });

      const rl = await checkRateLimit(`assinatura:write:${auth.tenantId}:${auth.user?.id || 'user'}`, 60, 60_000);
      if (!rl.allowed) return res.status(429).json({ success: false, error: 'Limite de registros atingido. Tente novamente em instantes.' });

      const b = req.body || {};
      const codigo = clean(b.codigo_validacao, 80).toUpperCase();
      const hash = clean(b.hash_sha256, 128).toLowerCase();
      if (!/^[A-Z0-9-]{8,80}$/.test(codigo)) return res.status(400).json({ success: false, error: 'Código de validação inválido.' });
      if (!/^[a-f0-9]{64}$/.test(hash)) return res.status(400).json({ success: false, error: 'Hash SHA-256 inválido.' });

      const id = `sig_${crypto.randomUUID()}`;
      const parsedDate = b.data_hora ? new Date(b.data_hora) : new Date();
      const dataHoraIso = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
      // AUDIT-2026-10-02 U3: a data/hora vem do navegador. Sem limite, era possível registrar
      // assinatura com data retroativa ou futura. Tolera só diferença de relógio (24 h).
      if (Math.abs(new Date(dataHoraIso).getTime() - Date.now()) > 24 * 60 * 60 * 1000) {
        return res.status(400).json({ success: false, error: 'Data/hora da assinatura fora do horário atual. Verifique o relógio do dispositivo.' });
      }
      try {
        await tenantSql`
          INSERT INTO document_signatures (
            id, tenant_id, user_id, codigo_validacao, hash_sha256, nome, doc, papel,
            doc_tipo, doc_id, doc_numero, data_hora, data_hora_fmt, ip_dispositivo
          ) VALUES (
            ${id}, ${auth.tenantId}, ${auth.user?.id || null}, ${codigo}, ${hash},
            ${clean(b.nome,255)}, ${clean(b.doc,64) || null}, ${clean(b.papel,120) || null},
            ${clean(b.doc_tipo,50) || 'documento'}, ${clean(b.doc_id,64) || null}, ${clean(b.doc_numero,100) || null},
            ${dataHoraIso}, ${clean(b.data_hora_fmt,100) || null}, ${clean(b.ip_dispositivo,255) || null}
          );
        `;
      } catch (err) {
        if (String(err?.message || '').toLowerCase().includes('unique')) {
          // AUDITORIA 2026-10-04 #12: status pelo banco, sem ler a linha de outra empresa.
          let mesmoRegistro = false;
          try {
            const st = await tenantSql`SELECT codigo_assinatura_status(${codigo}, ${auth.tenantId}, ${hash}) AS st;`;
            mesmoRegistro = st[0]?.st === 'mesmo_registro';
          } catch {
            const existing = await tenantSql`SELECT tenant_id, hash_sha256 FROM document_signatures WHERE codigo_validacao=${codigo} LIMIT 1;`;
            mesmoRegistro = !!(existing.length && existing[0].tenant_id === auth.tenantId && String(existing[0].hash_sha256).toLowerCase() === hash);
          }
          if (mesmoRegistro) {
            return res.status(200).json({ success: true, codigo_validacao: codigo, already_registered: true });
          }
          return res.status(409).json({ success: false, error: 'Código de validação já registrado.' });
        }
        throw err;
      }

      await writeAudit(tenantSql, req, auth, {
        acao: 'assinar', entidade: clean(b.doc_tipo,50) || 'documento', entidadeId: clean(b.doc_id,64) || codigo,
        depois: { codigo_validacao: codigo, hash_sha256: hash, papel: clean(b.papel,120) || null, doc_numero: clean(b.doc_numero,100) || null }
      });
      return res.status(201).json({ success: true, codigo_validacao: codigo });
    }

    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  } catch (err) {
    console.error('[Assinaturas API]', err);
    return res.status(500).json({ success: false, error: 'Falha ao processar a assinatura.' });
  }
}

// ── Verificação de assinaturas digitais em PDF (contratos e recibos) ─────────────────────────
// Executa no backend Node (o Worker encaminha action=verificar_pdf ao Render). Guarda a prova
// da verificação (hash do arquivo, resultado e signatários) em document_signature_verifications.
const VERIFY_ENTITIES = new Set(['contratos', 'recibos']);

async function handlePdfVerification(req, res, action) {
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success: false, error: auth.error || 'Não autorizado.' });

  const entity = clean(req.query?.entity || req.body?.entity, 40);
  const entityId = clean(req.query?.entity_id || req.body?.entity_id, 120);
  if (!VERIFY_ENTITIES.has(entity) || !entityId) {
    return res.status(400).json({ success: false, error: 'Informe o contrato ou recibo da verificação.' });
  }
  const tenantSql = createTenantSql(getSql(), { tenantId: auth.tenantId });

  try {
    if (action === 'verificacoes' && req.method === 'GET') {
      if (!canAccessModule(auth, entity, 'read')) return res.status(403).json(permissionError('MODULE_READ_FORBIDDEN', entity));
      const rows = await tenantSql`
        SELECT id, entity, entity_id, file_name, file_sha256, status, nivel, signatarios, relatorio, created_at
        FROM document_signature_verifications
        WHERE tenant_id = ${auth.tenantId} AND entity = ${entity} AND entity_id = ${entityId}
        ORDER BY created_at DESC LIMIT 10;
      `;
      return res.status(200).json({ success: true, verificacoes: rows });
    }

    if (action !== 'verificar_pdf' || req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Método não permitido.' });
    }
    if (!canAccessModule(auth, entity, 'write')) return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN', entity));
    if (!canWriteData(auth)) return res.status(403).json(permissionError('ROLE_READ_ONLY'));

    const rl = await checkRateLimit(`assinatura:verify:${auth.tenantId}`, 20, 60_000);
    if (!rl.allowed) return res.status(429).json({ success: false, error: 'Muitas verificações seguidas. Aguarde um minuto.' });

    const raw = String(req.body?.base64 || '');
    const b64 = raw.includes(',') ? raw.split(',').pop() : raw;
    if (!b64 || b64.length > 14_000_000) return res.status(413).json({ success: false, error: 'Envie um PDF de até 10 MB.' });
    const pdf = Buffer.from(b64, 'base64');

    const { verifyPdfSignatures } = await import('./_pdf-signature.js');
    let report;
    try {
      report = await verifyPdfSignatures(pdf);
    } catch (err) {
      // AUDITORIA 2026-10-04 #33: só as mensagens pensadas para o usuário saem; o resto vai para o log.
      const mensagensPublicas = ['PDF ausente ou acima de 10 MB.', 'O arquivo não é um PDF.'];
      if (!mensagensPublicas.includes(err?.message)) console.error('[Assinaturas] Falha ao verificar PDF:', err?.message || err);
      return res.status(400).json({ success: false, error: mensagensPublicas.includes(err?.message) ? err.message : 'Não foi possível ler o PDF.' });
    }

    const signatarios = (report.assinaturas || []).map(a => ({
      nome: a.signatario?.nome || null,
      cpf_mascarado: a.signatario?.cpf_mascarado || null,
      cnpj_mascarado: a.signatario?.cnpj_mascarado || null,
      nivel: a.nivel || null,
      status: a.status
    }));
    const id = `sigver_${crypto.randomUUID()}`;
    const fileName = clean(req.body?.file_name, 255) || null;
    await tenantSql`
      INSERT INTO document_signature_verifications
        (id, tenant_id, entity, entity_id, file_name, file_sha256, status, nivel, signatarios, relatorio, verified_by)
      VALUES
        (${id}, ${auth.tenantId}, ${entity}, ${entityId}, ${fileName}, ${report.file_sha256}, ${report.status},
         ${report.nivel || null}, ${JSON.stringify(signatarios)}::jsonb, ${JSON.stringify(report)}::jsonb, ${auth.user?.id || null});
    `;
    await writeAudit(tenantSql, req, auth, {
      acao: 'verificar_assinatura_pdf', entidade: entity, entidadeId: entityId,
      depois: { verificacao_id: id, status: report.status, nivel: report.nivel, file_sha256: report.file_sha256 }
    });
    return res.status(200).json({ success: true, id, ...report, signatarios });
  } catch (err) {
    console.error('[Assinaturas API] Falha na verificação de PDF:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Falha ao verificar o PDF assinado.' });
  }
}
