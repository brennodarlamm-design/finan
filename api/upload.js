// api/upload.js — Endpoint Serverless para Upload e Gerenciamento no Vercel Blob
import { put, del } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';

function getSql() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    throw new Error('DATABASE_URL não configurada no servidor.');
  }
  return neon(conn);
}

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

const ALLOWED_ORIGINS = [
  'https://finobra.app.br',
  'https://www.finobra.app.br',
  'http://localhost:3000',
  'http://localhost:3333',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3333',
  'http://127.0.0.1:5000'
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-api-key, x-tenant-id, X-Requested-With');
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Validação de Autenticação Segura
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({
      success: false,
      error: auth.error || 'Acesso não autorizado para upload de documentos.'
    });
  }

  const tenantId = auth.tenantId || 'angelim';

  // ── DELETE: Excluir documento do Vercel Blob com Validação Estrita de Tenant ──
  if (req.method === 'DELETE') {
    try {
      const url = req.query.url || (req.body && req.body.url);
      const documentId = req.query.document_id || req.query.id || (req.body && (req.body.document_id || req.body.id));

      if (!url && !documentId) {
        return res.status(400).json({ success: false, error: 'URL ou ID do documento é obrigatório para exclusão.' });
      }

      // 1. Validação de segurança e posse no banco Neon
      const sql = getSql();
      let docRows = [];
      if (documentId) {
        docRows = await sql`SELECT id, url, tenant_id FROM documentos WHERE id = ${documentId} AND tenant_id = ${tenantId} LIMIT 1;`;
      } else if (url) {
        docRows = await sql`SELECT id, url, tenant_id FROM documentos WHERE url = ${url} AND tenant_id = ${tenantId} LIMIT 1;`;
      }

      let finalUrl = url;
      if (docRows.length > 0) {
        finalUrl = docRows[0].url || url;
      } else {
        // Se não foi localizado na tabela pelo tenant, verifica se a URL contém o path explícito do tenant
        const isTenantBlob = url && url.includes(`/${tenantId}/`);
        if (!isTenantBlob && !auth.isSystem) {
          return res.status(403).json({
            success: false,
            error: 'Permissão negada. O arquivo não pertence ao seu tenant ou já foi excluído.'
          });
        }
      }

      // 2. Exclusão no Vercel Blob
      if (finalUrl && finalUrl.includes('blob.vercel-storage.com')) {
        await del(finalUrl);
      }

      // 3. Remoção no banco de dados Neon
      if (docRows.length > 0) {
        await sql`DELETE FROM documentos WHERE id = ${docRows[0].id} AND tenant_id = ${tenantId};`;
      }

      return res.status(200).json({ success: true, message: 'Arquivo e registro excluídos com sucesso.' });
    } catch (err) {
      console.error('[Blob] Erro ao excluir arquivo:', err);
      return res.status(500).json({ success: false, error: 'Erro ao excluir arquivo: ' + err.message });
    }
  }

  // ── POST: Upload de documento ───────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  try {
    // A. Suporte a Client-side Upload token (@vercel/blob/client handleUpload)
    if (req.body && req.body.type === 'blob.generate-client-token') {
      const jsonResponse = await handleUpload({
        body: req.body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          const now = new Date();
          const ano = now.getFullYear();
          const mes = String(now.getMonth() + 1).padStart(2, '0');
          const cleanName = (pathname || 'documento').replace(/[^a-zA-Z0-9._-]/g, '_');
          const targetPath = `${tenantId}/documentos/${ano}/${mes}/${Date.now()}_${cleanName}`;

          return {
            allowedContentTypes: [
              'application/pdf',
              'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
              'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/x-7z-compressed',
              'application/acad', 'application/x-acad', 'image/vnd.dwg', 'image/vnd.dxf',
              'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'text/plain', 'text/csv', 'application/xml', 'text/xml'
            ],
            maximumSizeInBytes: 30 * 1024 * 1024, // 30 MB
            tokenPayload: JSON.stringify({ tenantId, targetPath })
          };
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          console.log(`[Blob] Upload concluído para ${blob.url} (tenant: ${tokenPayload})`);
        }
      });
      return res.status(200).json(jsonResponse);
    }

    // B. Upload Direto via Payload JSON (base64)
    const { filename, base64, contentType } = req.body || {};

    if (!base64 || !filename) {
      return res.status(400).json({
        success: false,
        error: 'Campos "filename" e "base64" são obrigatórios para upload.'
      });
    }

    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const cleanMime = (contentType || 'application/octet-stream').includes(';')
      ? contentType.split(';')[0]
      : (contentType || 'application/octet-stream');

    const buffer = Buffer.from(cleanBase64, 'base64');

    // Estrutura de pastas no Blob: <tenantId>/documentos/<ano>/<mes>/<timestamp>_<filename>
    const now = new Date();
    const ano = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathname = `${tenantId}/documentos/${ano}/${mes}/${Date.now()}_${safeFilename}`;

    const blob = await put(pathname, buffer, {
      access: 'public',
      contentType: cleanMime
    });

    return res.status(200).json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      size: buffer.length,
      contentType: blob.contentType
    });

  } catch (err) {
    console.error('[Blob] Erro no upload:', err);
    return res.status(500).json({
      success: false,
      error: 'Falha ao processar upload no Vercel Blob: ' + err.message
    });
  }
}
