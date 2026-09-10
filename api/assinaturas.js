// api/assinaturas.js — Registro autenticado e validação pública de assinaturas eletrônicas
import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';
import { canUseFeature, planError } from './_plans.js';
import { canWriteData, permissionError } from './_permissions.js';
import { writeAudit } from './_audit.js';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

function cors(req, res) {
  const allowed = [
    'https://finobra.app.br', 'https://www.finobra.app.br',
    'http://localhost:3000', 'http://localhost:3333', 'http://localhost:5000',
    'http://127.0.0.1:3000', 'http://127.0.0.1:3333', 'http://127.0.0.1:5000'
  ];
  const origin = req.headers.origin;
  if (origin && (allowed.includes(origin) || origin.endsWith('.vercel.app'))) {
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

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getSql();

  try {
    // Consulta pública: valida somente registros realmente existentes no Neon.
    if (req.method === 'GET') {
      const ip = getClientIp(req);
      const rl = checkRateLimit(`assinatura:public:${ip}`, 30, 60_000);
      if (!rl.allowed) return res.status(429).json({ success: false, error: 'Muitas consultas. Tente novamente em instantes.' });

      const code = clean(req.query?.code || req.query?.val, 80).toUpperCase();
      if (!/^[A-Z0-9-]{8,80}$/.test(code)) {
        return res.status(400).json({ success: false, valid: false, error: 'Código de validação inválido.' });
      }

      const rows = await sql`
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
          ip_dispositivo: r.ip_dispositivo,
          empresa: r.nome_fantasia || r.razao_social || 'Empresa usuária do FinObra',
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
      if (!auth.isSystem && auth.user?.perfil !== 'superadmin' && !canUseFeature(auth.user?.tenantPlan, 'signatures')) {
        return res.status(403).json(planError('signatures', auth.user?.tenantPlan));
      }

      const rl = checkRateLimit(`assinatura:write:${auth.tenantId}:${auth.user?.id || 'user'}`, 60, 60_000);
      if (!rl.allowed) return res.status(429).json({ success: false, error: 'Limite de registros atingido. Tente novamente em instantes.' });

      const b = req.body || {};
      const codigo = clean(b.codigo_validacao, 80).toUpperCase();
      const hash = clean(b.hash_sha256, 128).toLowerCase();
      if (!/^[A-Z0-9-]{8,80}$/.test(codigo)) return res.status(400).json({ success: false, error: 'Código de validação inválido.' });
      if (!/^[a-f0-9]{64}$/.test(hash)) return res.status(400).json({ success: false, error: 'Hash SHA-256 inválido.' });

      const id = `sig_${crypto.randomUUID()}`;
      const parsedDate = b.data_hora ? new Date(b.data_hora) : new Date();
      const dataHoraIso = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
      try {
        await sql`
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
          const existing = await sql`SELECT tenant_id, hash_sha256 FROM document_signatures WHERE codigo_validacao=${codigo} LIMIT 1;`;
          if (existing.length && existing[0].tenant_id === auth.tenantId && String(existing[0].hash_sha256).toLowerCase() === hash) {
            return res.status(200).json({ success: true, codigo_validacao: codigo, already_registered: true });
          }
          return res.status(409).json({ success: false, error: 'Código de validação já registrado.' });
        }
        throw err;
      }

      await writeAudit(sql, req, auth, {
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
